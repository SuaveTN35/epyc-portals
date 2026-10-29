// Driver profile rules (P-366): insurance eligibility, expiry warnings,
// checklist state, profile gaps, dispatch badges, and input validation.
// Pure functions only (no Supabase, no React) so they are unit tested in
// driver-profile.test.ts. The database enforces the same new-work rule in
// driver_offer_block_reason() (migrations 20261028000500 and 0600); keep the
// reason strings and their order in step with it.

import {
  PROFILE_ITEMS,
  GEAR_ITEMS,
  getProfileItem,
  isGearId,
  isProfileItemId,
  type ProfileItemDef,
  type ProfileItemGroup,
  type ProfileItemId,
} from './driver-profile-items';

export const WARN_DAYS_BEFORE_EXPIRY = 14;
export const PACIFIC_TZ = 'America/Los_Angeles';

export type ReviewStatus = 'pending' | 'approved' | 'rejected';

export interface ReviewRow {
  item: string;
  photo_path: string | null;
  status: ReviewStatus | string;
  reason: string | null;
  /** Gear only: false when the driver no longer lists the item. */
  owned?: boolean | null;
  uploaded_at?: string | null;
  reviewed_at?: string | null;
}

/** The drivers columns these rules read. Every field is optional/nullable. */
export interface DriverProfileFields {
  insurance_card_url?: string | null;
  insurance_expiry?: string | null;
  insurance_policy?: string | null;
  insurance_carrier?: string | null;
  insurance_bi_per_person?: number | null;
  insurance_bi_per_accident?: number | null;
  insurance_pd_limit?: number | null;
  insurance_business_use?: boolean | null;
  registration_url?: string | null;
  registration_expiry?: string | null;
  vehicle_photo_front_url?: string | null;
  vehicle_photo_back_url?: string | null;
  vehicle_photo_side_url?: string | null;
  vehicle_photo_cargo_url?: string | null;
  cargo_length_in?: number | string | null;
  cargo_width_in?: number | string | null;
  cargo_height_in?: number | string | null;
  cargo_capacity_lbs?: number | string | null;
  /** Required-items grace (0650): until this date (Pacific) missing items only warn. */
  items_required_from?: string | null;
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

/** Today's calendar date in Pacific time, as YYYY-MM-DD. */
export function pacificToday(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: PACIFIC_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Valid YYYY-MM-DD calendar date (rejects 2026-02-30). */
export function isValidDateString(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
}

/** Whole days from `today` to `date` (both YYYY-MM-DD). Negative when past. */
export function daysUntil(date: string, today: string): number {
  const a = Date.parse(`${date}T00:00:00Z`);
  const b = Date.parse(`${today}T00:00:00Z`);
  return Math.round((a - b) / 86_400_000);
}

export type ExpiryState = 'missing' | 'expired' | 'expiring' | 'ok';

/**
 * 'expired' when the date is before today; 'expiring' from 14 days before
 * through the expiry date itself (the expiry day still counts as covered).
 */
export function expiryState(date: string | null | undefined, today: string): ExpiryState {
  if (!date || !isValidDateString(date.slice(0, 10))) return 'missing';
  const days = daysUntil(date.slice(0, 10), today);
  if (days < 0) return 'expired';
  if (days <= WARN_DAYS_BEFORE_EXPIRY) return 'expiring';
  return 'ok';
}

// ---------------------------------------------------------------------------
// New-work eligibility: insurance, then required items
// ---------------------------------------------------------------------------

/**
 * Null when the driver may get new job offers; otherwise the reason.
 * Same rule, strings, and order as driver_offer_block_reason() in SQL.
 * Jobs already assigned are not affected.
 */
export function offerBlockReason(
  driver: Pick<DriverProfileFields, 'insurance_card_url' | 'insurance_expiry'>,
  insuranceReview: Pick<ReviewRow, 'status' | 'photo_path'> | null | undefined,
  today: string
): string | null {
  if (!driver.insurance_card_url) return 'No insurance card on file';
  if (!driver.insurance_expiry) return 'No insurance expiry date on file';
  const exp = driver.insurance_expiry.slice(0, 10);
  if (daysUntil(exp, today) < 0) return `Insurance expired on ${exp}`;
  if (!insuranceReview) return 'Insurance card has not been reviewed by dispatch';
  if (insuranceReview.photo_path !== driver.insurance_card_url) {
    return 'Insurance card changed and needs dispatch review';
  }
  if (insuranceReview.status === 'pending') return 'Insurance card is waiting for dispatch review';
  if (insuranceReview.status === 'rejected') return 'Insurance card was rejected by dispatch';
  return null;
}

/**
 * Required vehicle and document items (besides insurance) that block new
 * work while missing or rejected (Commander ruling 2026-10-28, "until
 * uploaded"). Must equal the list in driver_offer_block_reason()
 * (migration 20261028000600); driver-profile.test.ts pins it.
 */
export const NEW_WORK_REQUIRED_ITEM_IDS: readonly ProfileItemId[] = (PROFILE_ITEMS as readonly ProfileItemDef[])
  .filter((d) => d.required && (d.group === 'vehicle' || d.group === 'documents') && d.id !== 'insurance_card')
  .map((d) => d.id as ProfileItemId);

/** Required items that are missing, and those rejected (current file), in config order. */
export function requiredItemProblems(
  driver: DriverProfileFields,
  reviewRows: ReviewRow[] | null | undefined
): { missing: string[]; rejected: string[] } {
  const reviews = indexReviews(reviewRows);
  const missing: string[] = [];
  const rejected: string[] = [];
  for (const id of NEW_WORK_REQUIRED_ITEM_IDS) {
    const def = getProfileItem(id)!;
    const row = reviews[id];
    if (def.kind === 'data') {
      if (!dimensionsComplete(driver)) missing.push(def.label);
      else if (row?.status === 'rejected') rejected.push(def.label);
      continue;
    }
    const file = def.column ? driver[def.column] ?? null : null;
    if (!file) missing.push(def.label);
    else if (row?.status === 'rejected' && row.photo_path === file) rejected.push(def.label);
  }
  return { missing, rejected };
}

/**
 * Null when every required item is uploaded and none is rejected. Pending
 * or unreviewed items do not block; registration expiry does not block.
 * Ignores the grace window (see requiredItemsInGrace).
 */
export function requiredItemsBlockReason(
  driver: DriverProfileFields,
  reviewRows: ReviewRow[] | null | undefined
): string | null {
  const { missing, rejected } = requiredItemProblems(driver, reviewRows);
  if (missing.length > 0) return `Missing required items: ${missing.join(', ')}`;
  if (rejected.length > 0) return `Rejected items need a new upload: ${rejected.join(', ')}`;
  return null;
}

/**
 * True while the driver is inside the required-items grace window (0650:
 * drivers already active when the rule shipped get 14 days). Insurance has
 * no grace.
 */
export function requiredItemsInGrace(driver: Pick<DriverProfileFields, 'items_required_from'>, today: string): boolean {
  const from = driver.items_required_from?.slice(0, 10);
  return !!from && daysUntil(from, today) > 0;
}

/** In grace with items still to fix: the due date and the item labels, else null. */
export function requiredItemsDue(
  driver: DriverProfileFields,
  reviewRows: ReviewRow[] | null | undefined,
  today: string
): { date: string; items: string[] } | null {
  if (!requiredItemsInGrace(driver, today)) return null;
  const { missing, rejected } = requiredItemProblems(driver, reviewRows);
  const items = [...missing, ...rejected];
  return items.length > 0 ? { date: driver.items_required_from!.slice(0, 10), items } : null;
}

/**
 * Null when the driver may get new job offers. Insurance first, then the
 * required items. Same rule, strings, and order as driver_offer_block_reason().
 */
export function newWorkBlockReason(
  driver: DriverProfileFields,
  reviewRows: ReviewRow[] | null | undefined,
  today: string
): string | null {
  const insurance = (reviewRows || []).find((r) => r.item === 'insurance_card') ?? null;
  return (
    offerBlockReason(driver, insurance, today) ??
    (requiredItemsInGrace(driver, today) ? null : requiredItemsBlockReason(driver, reviewRows))
  );
}

// ---------------------------------------------------------------------------
// Lapsed insurance on a job already in progress (dispatch alert)
// ---------------------------------------------------------------------------

/**
 * Commander ruling 2026-10-28: a job already accepted continues when the
 * driver's insurance lapses (no new offers, no auto-reassign); dispatch sees
 * this flag and decides. Lapsed = the expiry date is before today (Pacific;
 * the expiry day itself still counts as covered, same as offerBlockReason),
 * or dispatch rejected the card that is on file.
 */
export const INSURANCE_LAPSED_FLAG = 'Driver insurance lapsed - consider reassigning';

export function insuranceLapsed(
  driver: Pick<DriverProfileFields, 'insurance_card_url' | 'insurance_expiry'>,
  insuranceReview: Pick<ReviewRow, 'status' | 'photo_path'> | null | undefined,
  today: string
): boolean {
  const exp = driver.insurance_expiry?.slice(0, 10);
  if (exp && isValidDateString(exp) && daysUntil(exp, today) < 0) return true;
  return (
    !!insuranceReview &&
    insuranceReview.status === 'rejected' &&
    !!driver.insurance_card_url &&
    insuranceReview.photo_path === driver.insurance_card_url
  );
}

// ---------------------------------------------------------------------------
// Checklist state
// ---------------------------------------------------------------------------

/**
 * missing    nothing uploaded / entered
 * unreviewed on file (older upload or edit) with no review yet
 * pending    submitted, waiting for dispatch
 * approved   dispatch approved this exact file / these values
 * rejected   dispatch rejected it (reason given); driver should redo it
 * declared   gear only: the driver says they own it, no photo added
 */
export type ItemState = 'missing' | 'unreviewed' | 'pending' | 'approved' | 'rejected' | 'declared';

export interface ItemStatus {
  def: ProfileItemDef;
  state: ItemState;
  /** The file to show (storage path), if any. */
  path: string | null;
  reason: string | null;
}

export function indexReviews(rows: ReviewRow[] | null | undefined): Record<string, ReviewRow> {
  const out: Record<string, ReviewRow> = {};
  for (const r of rows || []) out[r.item] = r;
  return out;
}

export function dimensionsComplete(driver: DriverProfileFields): boolean {
  return (
    driver.cargo_length_in != null &&
    driver.cargo_width_in != null &&
    driver.cargo_height_in != null &&
    driver.cargo_capacity_lbs != null
  );
}

export function itemStatus(
  def: ProfileItemDef,
  driver: DriverProfileFields,
  reviews: Record<string, ReviewRow>
): ItemStatus {
  const row = reviews[def.id] ?? null;

  if (def.kind === 'data') {
    if (!dimensionsComplete(driver)) return { def, state: 'missing', path: null, reason: null };
    if (!row) return { def, state: 'unreviewed', path: null, reason: null };
    return { def, state: rowState(row), path: null, reason: row.status === 'rejected' ? row.reason : null };
  }

  if (def.column) {
    const file = driver[def.column] ?? null;
    if (!file) return { def, state: 'missing', path: null, reason: null };
    if (!row) return { def, state: 'unreviewed', path: file, reason: null };
    if (row.photo_path !== file) return { def, state: 'pending', path: file, reason: null };
    return { def, state: rowState(row), path: file, reason: row.status === 'rejected' ? row.reason : null };
  }

  // Gear and the badge photo: the review row is the only record. For gear,
  // the row means "I own this"; owned = false or no row means not listed.
  if (!row || row.owned === false) return { def, state: 'missing', path: null, reason: null };
  if (!row.photo_path) {
    return { def, state: def.group === 'equipment' ? 'declared' : 'missing', path: null, reason: null };
  }
  return { def, state: rowState(row), path: row.photo_path, reason: row.status === 'rejected' ? row.reason : null };
}

function rowState(row: ReviewRow): ItemState {
  return row.status === 'approved' ? 'approved' : row.status === 'rejected' ? 'rejected' : 'pending';
}

export function checklist(driver: DriverProfileFields, reviewRows: ReviewRow[] | null | undefined): ItemStatus[] {
  const reviews = indexReviews(reviewRows);
  return (PROFILE_ITEMS as readonly ProfileItemDef[]).map((def) => itemStatus(def, driver, reviews));
}

/** The driver lists this gear as owned (photo or not). */
export function driverDeclaresEquipment(reviewRows: ReviewRow[] | null | undefined, item: ProfileItemId): boolean {
  return (reviewRows || []).some((r) => r.item === item && r.owned !== false);
}

/** The driver owns this gear AND dispatch approved its photo. For job matching. */
export function driverHasEquipment(
  reviewRows: ReviewRow[] | null | undefined,
  item: ProfileItemId
): boolean {
  return (reviewRows || []).some(
    (r) => r.item === item && r.owned !== false && r.status === 'approved' && !!r.photo_path
  );
}

export interface DeclaredGear {
  def: ProfileItemDef;
  approved: boolean;
}

/** Gear the driver lists as owned, with whether dispatch approved its photo. */
export function declaredGear(reviewRows: ReviewRow[] | null | undefined): DeclaredGear[] {
  return GEAR_ITEMS.filter((def) => driverDeclaresEquipment(reviewRows, def.id as ProfileItemId)).map((def) => ({
    def,
    approved: driverHasEquipment(reviewRows, def.id as ProfileItemId),
  }));
}

export interface GearMatch {
  needed: string[];
  /** Needed items the driver lists as owned (approved or not). */
  declared: string[];
  /** Needed items owned with an approved photo. */
  approved: string[];
  /** Needed items the driver does not list. */
  missing: string[];
}

/**
 * Informational only (never a block): how a driver's declared gear lines up
 * with what a job needs. The driver sees the list on the offer and may decline.
 */
export function gearMatch(reviewRows: ReviewRow[] | null | undefined, needed: readonly string[] | null | undefined): GearMatch {
  const list = (needed || []).filter(isGearId);
  return {
    needed: list,
    declared: list.filter((id) => driverDeclaresEquipment(reviewRows, id as ProfileItemId)),
    approved: list.filter((id) => driverHasEquipment(reviewRows, id as ProfileItemId)),
    missing: list.filter((id) => !driverDeclaresEquipment(reviewRows, id as ProfileItemId)),
  };
}

/** Validates a job's "gear this job needs" list: known gear ids, de-duplicated, config order. */
export function parseRequiredEquipment(value: unknown): Validation<string[]> {
  if (value == null) return { ok: true, value: [] };
  if (!Array.isArray(value)) return { ok: false, error: 'Gear list must be a list' };
  for (const v of value) if (!isGearId(v)) return { ok: false, error: 'Unknown gear item' };
  return { ok: true, value: GEAR_ITEMS.map((d) => d.id).filter((id) => value.includes(id)) };
}

/** Labels for a job's gear list, for the driver offer card. */
export function gearLabels(ids: readonly string[] | null | undefined): string[] {
  return (ids || []).filter(isGearId).map((id) => getProfileItem(id)!.label);
}

// ---------------------------------------------------------------------------
// Gaps (REQUIRED items only) and dispatch badges
// ---------------------------------------------------------------------------

// Gear is never a gap (TRIBUNAL R12): no 'equipment' group here.
export type GapGroup = 'vehicle_photos' | 'dimensions' | 'registration' | 'insurance';

export const GAP_GROUP_LABELS: Record<GapGroup, string> = {
  vehicle_photos: 'Vehicle photos',
  dimensions: 'Dimensions',
  registration: 'Registration',
  insurance: 'Insurance',
};

/** Gear and the badge photo never count as missing, whatever the config says. */
function canGate(def: ProfileItemDef): boolean {
  return def.required && def.group !== 'equipment' && def.group !== 'badge';
}

export interface ProfileGap {
  group: GapGroup;
  label: string;
  /** Human list of what is missing or needs redoing. */
  missing: string[];
}

function gapGroupFor(def: ProfileItemDef): GapGroup {
  if (def.id === 'cargo_dimensions') return 'dimensions';
  if (def.id === 'insurance_card') return 'insurance';
  if (def.id === 'registration') return 'registration';
  return 'vehicle_photos';
}

/** Insurance form fields still blank (what the driver must fill in). */
export function insuranceDetailsMissing(driver: DriverProfileFields): string[] {
  const out: string[] = [];
  if (!driver.insurance_carrier) out.push('Insurance company');
  if (!driver.insurance_policy) out.push('Policy number');
  if (!driver.insurance_expiry) out.push('Insurance expiry date');
  if (
    driver.insurance_bi_per_person == null ||
    driver.insurance_bi_per_accident == null ||
    driver.insurance_pd_limit == null
  ) {
    out.push('Coverage limits');
  }
  if (driver.insurance_business_use == null) out.push('Delivery / business use answer');
  return out;
}

/**
 * What a driver still has to do, REQUIRED items only. Missing items and
 * rejected items ("redo") count; pending and unreviewed do not (the driver
 * has done their part). Plus items never appear here.
 */
export function profileGaps(driver: DriverProfileFields, reviewRows: ReviewRow[] | null | undefined): ProfileGap[] {
  const groups = new Map<GapGroup, string[]>();
  const add = (g: GapGroup, text: string) => {
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(text);
  };

  for (const s of checklist(driver, reviewRows)) {
    if (!canGate(s.def)) continue;
    if (s.state === 'missing') add(gapGroupFor(s.def), s.def.label);
    if (s.state === 'rejected') add(gapGroupFor(s.def), `${s.def.label} (redo)`);
  }
  if (getProfileItem('insurance_card')?.required) {
    for (const f of insuranceDetailsMissing(driver)) add('insurance', f);
  }
  if (getProfileItem('registration')?.required && !driver.registration_expiry) {
    add('registration', 'Registration expiry date');
  }

  const order: GapGroup[] = ['insurance', 'registration', 'vehicle_photos', 'dimensions'];
  return order
    .filter((g) => groups.has(g))
    .map((g) => ({ group: g, label: GAP_GROUP_LABELS[g], missing: groups.get(g)! }));
}

export type BadgeTone = 'red' | 'amber' | 'gray';
export interface DispatchBadge {
  key: string;
  label: string;
  tone: BadgeTone;
}

/** Badges for the dispatch drivers list. Gap badges count REQUIRED items only. */
export function dispatchBadges(
  driver: DriverProfileFields,
  reviewRows: ReviewRow[] | null | undefined,
  today: string
): DispatchBadge[] {
  const badges: DispatchBadge[] = [];
  const reviews = indexReviews(reviewRows);

  const ins = expiryState(driver.insurance_expiry, today);
  if (ins === 'expired') badges.push({ key: 'ins-expired', label: 'Insurance expired', tone: 'red' });
  else if (ins === 'expiring') badges.push({ key: 'ins-expiring', label: 'Insurance expiring', tone: 'amber' });

  const block = offerBlockReason(driver, reviews['insurance_card'] ?? null, today);
  if (block && ins !== 'expired') {
    badges.push({ key: 'ins-blocked', label: 'No new jobs: insurance', tone: 'red' });
  } else if (!block && !requiredItemsInGrace(driver, today) && requiredItemsBlockReason(driver, reviewRows)) {
    badges.push({ key: 'items-blocked', label: 'No new jobs: required items', tone: 'red' });
  }
  const itemsDue = requiredItemsDue(driver, reviewRows, today);
  if (itemsDue) badges.push({ key: 'items-due', label: `Required items due ${itemsDue.date}`, tone: 'amber' });

  const reg = expiryState(driver.registration_expiry, today);
  if (reg === 'expired') badges.push({ key: 'reg-expired', label: 'Registration expired', tone: 'red' });
  else if (reg === 'expiring') badges.push({ key: 'reg-expiring', label: 'Registration expiring', tone: 'amber' });

  for (const gap of profileGaps(driver, reviewRows)) {
    badges.push({ key: `gap-${gap.group}`, label: `${gap.label} incomplete`, tone: 'gray' });
  }
  return badges;
}

/** Items waiting on dispatch (pending or unreviewed), for a count badge. */
export function itemsAwaitingReview(driver: DriverProfileFields, reviewRows: ReviewRow[] | null | undefined): number {
  return checklist(driver, reviewRows).filter((s) => (s.state === 'pending' || s.state === 'unreviewed') && !!s.path).length;
}

// ---------------------------------------------------------------------------
// Driver-side warnings
// ---------------------------------------------------------------------------

export interface DriverWarning {
  tone: 'red' | 'amber';
  text: string;
}

export function driverWarnings(
  driver: DriverProfileFields,
  reviewRows: ReviewRow[] | null | undefined,
  today: string
): DriverWarning[] {
  const out: DriverWarning[] = [];
  const ins = expiryState(driver.insurance_expiry, today);
  const block = newWorkBlockReason(driver, reviewRows, today);

  if (ins === 'expired') {
    out.push({ tone: 'red', text: 'Your insurance has expired. You will not get new job offers until you upload your current card and dispatch approves it.' });
  } else if (block) {
    out.push({ tone: 'red', text: `You will not get new job offers right now: ${block}.` });
  }
  if (ins === 'expiring') {
    const d = daysUntil(driver.insurance_expiry!.slice(0, 10), today);
    out.push({
      tone: 'amber',
      text: `Your insurance expires ${d === 0 ? 'today' : `in ${d} day${d === 1 ? '' : 's'}`}. Upload your new card before then to keep getting jobs.`,
    });
  }
  const itemsDue = requiredItemsDue(driver, reviewRows, today);
  if (itemsDue) {
    out.push({ tone: 'amber', text: `Upload by ${itemsDue.date} to keep getting offers: ${itemsDue.items.join(', ')}.` });
  }
  const reg = expiryState(driver.registration_expiry, today);
  if (reg === 'expired') out.push({ tone: 'amber', text: 'Your vehicle registration has expired. Upload your current registration.' });
  else if (reg === 'expiring') {
    const d = daysUntil(driver.registration_expiry!.slice(0, 10), today);
    out.push({ tone: 'amber', text: `Your registration expires ${d === 0 ? 'today' : `in ${d} day${d === 1 ? '' : 's'}`}. Upload the renewed card when you have it.` });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Validation (driver forms and API bodies)
// ---------------------------------------------------------------------------

/** Mirrors the CHECK constraints in the migration. */
export const DIMENSION_BOUNDS = {
  cargo_length_in: { min: 12, max: 480, label: 'Cargo length', unit: 'in' },
  cargo_width_in: { min: 12, max: 120, label: 'Cargo width', unit: 'in' },
  cargo_height_in: { min: 6, max: 144, label: 'Cargo height', unit: 'in' },
  cargo_capacity_lbs: { min: 25, max: 26000, label: 'Max load', unit: 'lbs' },
} as const;

export type DimensionKey = keyof typeof DIMENSION_BOUNDS;
export type Dimensions = Record<DimensionKey, number>;

export type Validation<T> = { ok: true; value: T } | { ok: false; error: string };

function toNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v.trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function validateDimensions(input: Record<string, unknown>): Validation<Dimensions> {
  const out = {} as Dimensions;
  for (const key of Object.keys(DIMENSION_BOUNDS) as DimensionKey[]) {
    const b = DIMENSION_BOUNDS[key];
    const n = toNumber(input[key]);
    if (n == null) return { ok: false, error: `${b.label} is required (${b.unit})` };
    if (n < b.min || n > b.max) {
      return { ok: false, error: `${b.label} must be between ${b.min} and ${b.max} ${b.unit}` };
    }
    out[key] = key === 'cargo_capacity_lbs' ? Math.round(n) : Math.round(n * 10) / 10;
  }
  return { ok: true, value: out };
}

export const LIMIT_MAX = 100_000_000;

export interface InsuranceDetails {
  insurance_carrier: string;
  insurance_policy: string;
  insurance_expiry: string;
  insurance_bi_per_person: number;
  insurance_bi_per_accident: number;
  insurance_pd_limit: number;
  insurance_business_use: boolean;
}

function cleanText(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim().replace(/\s+/g, ' ');
  if (!t || t.length > max) return null;
  return t;
}

function money(v: unknown): number | null {
  const n = toNumber(typeof v === 'string' ? v.replace(/[$,\s]/g, '') : v);
  if (n == null || n < 0 || n > LIMIT_MAX) return null;
  return Math.round(n);
}

export function validateInsuranceDetails(input: Record<string, unknown>, today: string): Validation<InsuranceDetails> {
  const carrier = cleanText(input.insurance_carrier, 100);
  if (!carrier) return { ok: false, error: 'Insurance company is required' };
  const policy = cleanText(input.insurance_policy, 60);
  if (!policy) return { ok: false, error: 'Policy number is required' };
  const expiry = input.insurance_expiry;
  if (!isValidDateString(expiry)) return { ok: false, error: 'Insurance expiry date is required' };
  if (daysUntil(expiry, today) < 0) return { ok: false, error: 'That policy has already expired. Enter your current policy.' };
  const perPerson = money(input.insurance_bi_per_person);
  const perAccident = money(input.insurance_bi_per_accident);
  const pd = money(input.insurance_pd_limit);
  if (perPerson == null || perAccident == null || pd == null) {
    return { ok: false, error: 'Enter all three coverage limits in dollars' };
  }
  if (typeof input.insurance_business_use !== 'boolean') {
    return { ok: false, error: 'Answer whether your policy covers delivery / business use' };
  }
  return {
    ok: true,
    value: {
      insurance_carrier: carrier,
      insurance_policy: policy,
      insurance_expiry: expiry,
      insurance_bi_per_person: perPerson,
      insurance_bi_per_accident: perAccident,
      insurance_pd_limit: pd,
      insurance_business_use: input.insurance_business_use,
    },
  };
}

export function validateRegistrationExpiry(input: Record<string, unknown>, today: string): Validation<{ registration_expiry: string }> {
  const v = input.registration_expiry;
  if (!isValidDateString(v)) return { ok: false, error: 'Registration expiry date is required' };
  if (daysUntil(v, today) < 0) return { ok: false, error: 'That registration has already expired. Enter your current one.' };
  return { ok: true, value: { registration_expiry: v } };
}

/** "$30,000 / $60,000 / $15,000" style summary, or null. */
export function formatLimits(d: DriverProfileFields): string | null {
  if (d.insurance_bi_per_person == null && d.insurance_bi_per_accident == null && d.insurance_pd_limit == null) return null;
  const f = (n: number | null | undefined) => (n == null ? '-' : `$${Number(n).toLocaleString('en-US')}`);
  return `${f(d.insurance_bi_per_person)} / ${f(d.insurance_bi_per_accident)} / ${f(d.insurance_pd_limit)}`;
}

// ---------------------------------------------------------------------------
// Storage paths
// ---------------------------------------------------------------------------

/** QA N4: shown when a HEIC/HEIF photo could not be converted in the browser. */
export const HEIC_MESSAGE =
  'This phone photo format (HEIC) could not be opened. Take the photo again with the camera button, or set your camera to "Most Compatible" and retry.';

export function isHeicFile(file: { type?: string; name?: string }): boolean {
  const t = (file.type || '').toLowerCase();
  return t === 'image/heic' || t === 'image/heif' || /\.(heic|heif)$/i.test(file.name || '');
}

const SAFE_FILE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/;

/** drivers/<profileId>/<one safe file>. Mirrors is_driver_own_upload_path(). */
export function isOwnUploadPath(path: unknown, profileId: string): boolean {
  if (typeof path !== 'string' || !profileId) return false;
  const prefix = `drivers/${profileId}/`;
  if (!path.startsWith(prefix) || path.includes('..')) return false;
  return SAFE_FILE.test(path.slice(prefix.length));
}

export function buildUploadPath(profileId: string, item: ProfileItemId, ext: string, now = Date.now(), rand = Math.random()): string {
  const suffix = rand.toString(36).slice(2, 8) || 'x';
  return `drivers/${profileId}/${item}-${now}-${suffix}.${ext}`;
}

// ---------------------------------------------------------------------------
// Dispatch review request
// ---------------------------------------------------------------------------

export interface ReviewDecision {
  item: ProfileItemId;
  decision: 'approve' | 'reject';
  reason: string | null;
  /** The file dispatch looked at; the route refuses if it has changed. */
  photo_path: string | null;
  /**
   * The review row version dispatch looked at (driver_review_items.uploaded_at,
   * null when there was no row). Every driver write bumps it, so a change to
   * insurance dates or limits after dispatch opened the page is caught (QA N2).
   */
  uploaded_at: string | null;
}

export function parseReviewDecision(body: unknown): Validation<ReviewDecision> {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Invalid request' };
  const b = body as Record<string, unknown>;
  if (!isProfileItemId(b.item)) return { ok: false, error: 'Unknown item' };
  if (b.decision !== 'approve' && b.decision !== 'reject') {
    return { ok: false, error: "decision must be 'approve' or 'reject'" };
  }
  let reason: string | null = null;
  if (b.decision === 'reject') {
    reason = typeof b.reason === 'string' ? b.reason.trim() : '';
    if (reason.length < 3) return { ok: false, error: 'Give the driver a reason (at least 3 characters)' };
    if (reason.length > 500) return { ok: false, error: 'Reason is too long (500 characters max)' };
  }
  const photoPath = typeof b.photo_path === 'string' && b.photo_path ? b.photo_path : null;
  if (!('uploaded_at' in b) || (b.uploaded_at !== null && typeof b.uploaded_at !== 'string')) {
    return { ok: false, error: 'Reload the page and review again' };
  }
  return {
    ok: true,
    value: { item: b.item, decision: b.decision, reason, photo_path: photoPath, uploaded_at: (b.uploaded_at as string | null) ?? null },
  };
}

/** Required items not yet uploaded / entered during onboarding. Gear and the badge never block. */
export function onboardingMissing(uploaded: Partial<Record<ProfileItemId, boolean>>): ProfileItemDef[] {
  return (PROFILE_ITEMS as readonly ProfileItemDef[]).filter((d) => canGate(d) && !uploaded[d.id as ProfileItemId]);
}

/** Whether onboarding must collect this item's form data (QA N5: read from the config). */
export function isItemRequired(id: ProfileItemId): boolean {
  const def = getProfileItem(id);
  return !!def && canGate(def);
}

export function groupOf(id: string): ProfileItemGroup | null {
  return getProfileItem(id)?.group ?? null;
}
