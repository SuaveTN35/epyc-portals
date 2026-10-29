import { describe, it, expect } from 'vitest';
import {
  pacificToday,
  expiryState,
  offerBlockReason,
  newWorkBlockReason,
  requiredItemsBlockReason,
  NEW_WORK_REQUIRED_ITEM_IDS,
  requiredItemsInGrace,
  insuranceLapsed,
  INSURANCE_LAPSED_FLAG,
  checklist,
  profileGaps,
  dispatchBadges,
  driverHasEquipment,
  driverDeclaresEquipment,
  declaredGear,
  gearMatch,
  gearLabels,
  parseRequiredEquipment,
  isItemRequired,
  isHeicFile,
  driverWarnings,
  validateDimensions,
  validateInsuranceDetails,
  validateRegistrationExpiry,
  isOwnUploadPath,
  buildUploadPath,
  parseReviewDecision,
  onboardingMissing,
  isValidDateString,
  type DriverProfileFields,
  type ReviewRow,
} from './driver-profile';
import { PROFILE_ITEMS, REQUIRED_ITEMS, GEAR_ITEMS, getProfileItem } from './driver-profile-items';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const TODAY = '2026-11-01';
const P = '33333333-3333-3333-3333-333333333333';
const CARD = `drivers/${P}/insurance_card-1.jpg`;

const fullDriver: DriverProfileFields = {
  insurance_card_url: CARD,
  insurance_expiry: '2027-05-01',
  insurance_policy: 'POL1',
  insurance_carrier: 'Acme Mutual',
  insurance_bi_per_person: 30000,
  insurance_bi_per_accident: 60000,
  insurance_pd_limit: 15000,
  insurance_business_use: true,
  registration_url: `drivers/${P}/registration-1.jpg`,
  registration_expiry: '2027-03-01',
  vehicle_photo_front_url: `drivers/${P}/f.jpg`,
  vehicle_photo_back_url: `drivers/${P}/b.jpg`,
  vehicle_photo_side_url: `drivers/${P}/s.jpg`,
  vehicle_photo_cargo_url: `drivers/${P}/c.jpg`,
  cargo_length_in: 120,
  cargo_width_in: 60,
  cargo_height_in: 50,
  cargo_capacity_lbs: 2000,
};

function approvedRows(
  d: DriverProfileFields,
  ids = PROFILE_ITEMS.filter((i) => i.group !== 'badge').map((i) => i.id) as string[]
): ReviewRow[] {
  return ids.map((id) => {
    const def = getProfileItem(id)!;
    const path = def.kind === 'data' ? null : def.column ? (d[def.column] as string) : `drivers/${P}/${id}.jpg`;
    return { item: id, photo_path: path, status: 'approved', reason: null };
  });
}

describe('pacificToday', () => {
  it('uses the Pacific calendar date, not UTC', () => {
    // 2026-11-02 05:00 UTC is still Nov 1 in Los Angeles.
    expect(pacificToday(new Date('2026-11-02T05:00:00Z'))).toBe('2026-11-01');
    expect(pacificToday(new Date('2026-11-02T09:00:00Z'))).toBe('2026-11-02');
  });
});

describe('expiryState (14-day warning)', () => {
  it('classifies dates', () => {
    expect(expiryState(null, TODAY)).toBe('missing');
    expect(expiryState('2026-10-31', TODAY)).toBe('expired');
    expect(expiryState('2026-11-01', TODAY)).toBe('expiring'); // expires today: still covered
    expect(expiryState('2026-11-15', TODAY)).toBe('expiring'); // exactly 14 days
    expect(expiryState('2026-11-16', TODAY)).toBe('ok'); // 15 days
    expect(expiryState('not-a-date', TODAY)).toBe('missing');
  });
});

describe('offerBlockReason (insurance eligibility)', () => {
  const approved = { status: 'approved', photo_path: CARD };
  it('allows a current, approved card', () => {
    expect(offerBlockReason(fullDriver, approved, TODAY)).toBeNull();
  });
  it('allows a card expiring within 14 days (warn only)', () => {
    expect(offerBlockReason({ ...fullDriver, insurance_expiry: '2026-11-10' }, approved, TODAY)).toBeNull();
  });
  it('allows a card that expires today', () => {
    expect(offerBlockReason({ ...fullDriver, insurance_expiry: TODAY }, approved, TODAY)).toBeNull();
  });
  it('blocks an expired card even if approved', () => {
    expect(offerBlockReason({ ...fullDriver, insurance_expiry: '2026-10-31' }, approved, TODAY)).toBe(
      'Insurance expired on 2026-10-31'
    );
  });
  it('blocks a null expiry', () => {
    expect(offerBlockReason({ ...fullDriver, insurance_expiry: null }, approved, TODAY)).toBe(
      'No insurance expiry date on file'
    );
  });
  it('blocks no card', () => {
    expect(offerBlockReason({ ...fullDriver, insurance_card_url: null }, approved, TODAY)).toBe('No insurance card on file');
  });
  it('blocks pending, rejected, unreviewed, and stale approvals', () => {
    expect(offerBlockReason(fullDriver, { status: 'pending', photo_path: CARD }, TODAY)).toBe(
      'Insurance card is waiting for dispatch review'
    );
    expect(offerBlockReason(fullDriver, { status: 'rejected', photo_path: CARD }, TODAY)).toBe(
      'Insurance card was rejected by dispatch'
    );
    expect(offerBlockReason(fullDriver, null, TODAY)).toBe('Insurance card has not been reviewed by dispatch');
    expect(offerBlockReason(fullDriver, { status: 'approved', photo_path: 'insurance/old.jpg' }, TODAY)).toBe(
      'Insurance card changed and needs dispatch review'
    );
  });
  it('uses the same reason strings as the SQL function', () => {
    const sql = readFileSync(
      join(__dirname, '../../../packages/supabase/migrations/20261028000500_p366_driver_profile.sql'),
      'utf8'
    );
    for (const s of [
      'No insurance card on file',
      'No insurance expiry date on file',
      'Insurance expired on ',
      'Insurance card has not been reviewed by dispatch',
      'Insurance card changed and needs dispatch review',
      'Insurance card is waiting for dispatch review',
      'Insurance card was rejected by dispatch',
    ]) {
      expect(sql).toContain(`'${s}`);
    }
  });
});

describe('newWorkBlockReason (insurance, then required items; ruling 2026-10-28)', () => {
  const rows = approvedRows(fullDriver);
  const sql = () =>
    readFileSync(
      join(__dirname, '../../../packages/supabase/migrations/20261028000600_p366_required_items_block.sql'),
      'utf8'
    );

  it('pins the required list to the SQL function (config order, same labels)', () => {
    expect(NEW_WORK_REQUIRED_ITEM_IDS).toEqual([
      'vehicle_front',
      'vehicle_back',
      'vehicle_side',
      'vehicle_cargo',
      'cargo_dimensions',
      'registration',
    ]);
    const text = sql();
    const pairs = [...text.matchAll(/\(\d+, '([a-z_]+)', '([^']+)'\)/g)].map((m) => [m[1], m[2]]);
    expect(pairs).toEqual(NEW_WORK_REQUIRED_ITEM_IDS.map((id) => [id, getProfileItem(id)!.label]));
    expect(text).toContain("'Missing required items: '");
    expect(text).toContain("'Rejected items need a new upload: '");
  });
  it('allows a fully uploaded, insurance-approved driver', () => {
    expect(newWorkBlockReason(fullDriver, rows, TODAY)).toBeNull();
  });
  it('blocks on a missing photo and on incomplete dimensions, in config order', () => {
    expect(newWorkBlockReason({ ...fullDriver, vehicle_photo_cargo_url: null }, rows, TODAY)).toBe(
      'Missing required items: Cargo area'
    );
    expect(
      newWorkBlockReason({ ...fullDriver, registration_url: null, cargo_height_in: null, vehicle_photo_front_url: null }, rows, TODAY)
    ).toBe('Missing required items: Vehicle - front, Cargo size and capacity, Vehicle registration');
  });
  it('blocks on a rejected current file until it is re-uploaded', () => {
    const rejected = rows.map((r) => (r.item === 'vehicle_side' ? { ...r, status: 'rejected', reason: 'Too dark' } : r));
    expect(newWorkBlockReason(fullDriver, rejected, TODAY)).toBe('Rejected items need a new upload: Vehicle - side');
    // Re-uploaded: the file on record no longer matches the rejected row.
    expect(newWorkBlockReason({ ...fullDriver, vehicle_photo_side_url: `drivers/${P}/s2.jpg` }, rejected, TODAY)).toBeNull();
    const dims = rows.map((r) => (r.item === 'cargo_dimensions' ? { ...r, status: 'rejected', reason: 'x' } : r));
    expect(newWorkBlockReason(fullDriver, dims, TODAY)).toBe('Rejected items need a new upload: Cargo size and capacity');
  });
  it('missing beats rejected', () => {
    const rejected = rows.map((r) => (r.item === 'vehicle_side' ? { ...r, status: 'rejected', reason: 'x' } : r));
    expect(newWorkBlockReason({ ...fullDriver, vehicle_photo_back_url: null }, rejected, TODAY)).toBe(
      'Missing required items: Vehicle - back'
    );
  });
  it('pending or unreviewed items do not block; registration expiry does not block', () => {
    const onlyIns = rows.filter((r) => r.item === 'insurance_card');
    expect(newWorkBlockReason(fullDriver, onlyIns, TODAY)).toBeNull();
    const pending = rows.map((r) => (r.item === 'registration' ? { ...r, status: 'pending' } : r));
    expect(newWorkBlockReason(fullDriver, pending, TODAY)).toBeNull();
    expect(newWorkBlockReason({ ...fullDriver, registration_expiry: '2026-01-01' }, rows, TODAY)).toBeNull();
  });
  it('gear never blocks', () => {
    const gear = new Set(GEAR_ITEMS.map((g) => g.id as string));
    const noGear = rows.filter((r) => !gear.has(r.item));
    expect(newWorkBlockReason(fullDriver, noGear, TODAY)).toBeNull();
    const rejectedGear = rows.map((r) => (gear.has(r.item) ? { ...r, status: 'rejected', reason: 'x' } : r));
    expect(newWorkBlockReason(fullDriver, rejectedGear, TODAY)).toBeNull();
  });
  it('insurance reasons come first', () => {
    expect(newWorkBlockReason({ ...fullDriver, insurance_card_url: null, vehicle_photo_front_url: null }, rows, TODAY)).toBe(
      'No insurance card on file'
    );
    expect(requiredItemsBlockReason({ ...fullDriver, vehicle_photo_front_url: null }, rows)).toBe(
      'Missing required items: Vehicle - front'
    );
  });
});

describe('required-items grace (0650, ruling 2026-10-28)', () => {
  const rows = approvedRows(fullDriver);
  const grace: DriverProfileFields = { ...fullDriver, items_required_from: '2026-11-15', vehicle_photo_cargo_url: null };

  it('inside the grace window missing items warn but do not block', () => {
    expect(requiredItemsInGrace(grace, TODAY)).toBe(true);
    expect(newWorkBlockReason(grace, rows, TODAY)).toBeNull();
    expect(driverWarnings(grace, rows, TODAY)).toEqual([
      { tone: 'amber', text: 'Upload by 2026-11-15 to keep getting offers: Cargo area.' },
    ]);
    const labels = dispatchBadges(grace, rows, TODAY).map((b) => b.label);
    expect(labels).toContain('Required items due 2026-11-15');
    expect(labels).not.toContain('No new jobs: required items');
  });
  it('lists rejected items in the warning too', () => {
    const rejected = rows.map((r) => (r.item === 'registration' ? { ...r, status: 'rejected', reason: 'Old card' } : r));
    expect(driverWarnings({ ...grace, vehicle_photo_cargo_url: `drivers/${P}/c.jpg` }, rejected, TODAY)[0].text).toBe(
      'Upload by 2026-11-15 to keep getting offers: Vehicle registration.'
    );
  });
  it('from the date itself (and with no date) the block applies', () => {
    expect(newWorkBlockReason({ ...grace, items_required_from: TODAY }, rows, TODAY)).toBe('Missing required items: Cargo area');
    expect(newWorkBlockReason({ ...grace, items_required_from: null }, rows, TODAY)).toBe('Missing required items: Cargo area');
    expect(driverWarnings({ ...grace, items_required_from: TODAY }, rows, TODAY)[0].tone).toBe('red');
  });
  it('insurance has no grace', () => {
    expect(newWorkBlockReason({ ...grace, insurance_expiry: '2026-10-01' }, rows, TODAY)).toBe('Insurance expired on 2026-10-01');
    expect(newWorkBlockReason(grace, rows.filter((r) => r.item !== 'insurance_card'), TODAY)).toBe(
      'Insurance card has not been reviewed by dispatch'
    );
  });
  it('no warning when nothing is missing', () => {
    expect(driverWarnings({ ...fullDriver, items_required_from: '2026-11-15' }, rows, TODAY)).toEqual([]);
  });
  it('0650 keeps the same item list and guards the date', () => {
    const text = readFileSync(
      join(__dirname, '../../../packages/supabase/migrations/20261028000650_p366_required_items_grace.sql'),
      'utf8'
    );
    const pairs = [...text.matchAll(/\(\d+, '([a-z_]+)', '([^']+)'\)/g)].map((m) => [m[1], m[2]]);
    expect(pairs).toEqual(NEW_WORK_REQUIRED_ITEM_IDS.map((id) => [id, getProfileItem(id)!.label]));
    expect(text).toContain("'The required items date is set by dispatch'");
    expect(text).toContain("(now() at time zone 'America/Los_Angeles')::date + 14");
  });
});

describe('insuranceLapsed (dispatch alert on active jobs)', () => {
  const approved = { status: 'approved', photo_path: CARD };
  it('flags insurance that expired before today, not on the expiry day', () => {
    expect(insuranceLapsed({ ...fullDriver, insurance_expiry: '2026-10-31' }, approved, TODAY)).toBe(true);
    expect(insuranceLapsed({ ...fullDriver, insurance_expiry: TODAY }, approved, TODAY)).toBe(false);
    expect(insuranceLapsed(fullDriver, approved, TODAY)).toBe(false);
  });
  it('flags a rejected current card, not an old one', () => {
    expect(insuranceLapsed(fullDriver, { status: 'rejected', photo_path: CARD }, TODAY)).toBe(true);
    expect(insuranceLapsed(fullDriver, { status: 'rejected', photo_path: 'insurance/old.jpg' }, TODAY)).toBe(false);
    expect(insuranceLapsed(fullDriver, { status: 'pending', photo_path: CARD }, TODAY)).toBe(false);
  });
  it('uses the exact flag text', () => {
    expect(INSURANCE_LAPSED_FLAG).toBe('Driver insurance lapsed - consider reassigning');
  });
});

describe('item config', () => {
  it('requires vehicle and document items only (Commander ruling 2026-10-28)', () => {
    expect(REQUIRED_ITEMS.map((i) => i.id).sort()).toEqual(
      ['cargo_dimensions', 'insurance_card', 'registration', 'vehicle_back', 'vehicle_cargo', 'vehicle_front', 'vehicle_side'].sort()
    );
  });
  it('every gear item is declared, never required (TRIBUNAL R12)', () => {
    expect(GEAR_ITEMS.map((i) => i.id).sort()).toEqual(
      ['boots', 'cooler_temp_kit', 'gloves', 'hand_truck', 'hi_vis_vest', 'mask', 'safety_glasses', 'straps_blankets']
    );
    expect(GEAR_ITEMS.every((i) => i.required === false)).toBe(true);
    expect(getProfileItem('id_badge_photo')).toMatchObject({ group: 'badge', required: false });
  });
  it('gear never gates even if a flag is flipped to required by mistake', () => {
    const def = getProfileItem('gloves')! as { required: boolean };
    const saved = def.required;
    def.required = true;
    try {
      expect(onboardingMissing({}).map((d) => d.id)).not.toContain('gloves');
      expect(profileGaps(fullDriver, approvedRows(fullDriver, REQUIRED_ITEMS.map((i) => i.id)))).toEqual([]);
      expect(isItemRequired('gloves')).toBe(false);
    } finally {
      def.required = saved;
    }
  });
  it('isItemRequired reads the config (QA N5)', () => {
    expect(isItemRequired('cargo_dimensions')).toBe(true);
    expect(isItemRequired('insurance_card')).toBe(true);
    expect(isItemRequired('registration')).toBe(true);
    expect(isItemRequired('hand_truck')).toBe(false);
  });
  it('every item id is allowed by the database CHECK, required or not', () => {
    const sql = readFileSync(
      join(__dirname, '../../../packages/supabase/migrations/20261028000500_p366_driver_profile.sql'),
      'utf8'
    );
    const check = sql.slice(sql.indexOf('driver_review_items_item_check'), sql.indexOf('driver_review_items_status_check'));
    for (const i of PROFILE_ITEMS) expect(check).toContain(`'${i.id}'`);
  });
});

describe('checklist / equipment completeness', () => {
  it('a fully approved driver is all approved with no gaps', () => {
    const rows = approvedRows(fullDriver);
    const states = checklist(fullDriver, rows);
    expect(states.filter((s) => s.def.group !== 'badge').every((s) => s.state === 'approved')).toBe(true);
    expect(states.find((s) => s.def.id === 'id_badge_photo')!.state).toBe('missing'); // optional, never a gap
    expect(profileGaps(fullDriver, rows)).toEqual([]);
  });

  it('missing gear never creates a gap or a badge', () => {
    const rows = approvedRows(fullDriver, REQUIRED_ITEMS.map((i) => i.id));
    expect(profileGaps(fullDriver, rows)).toEqual([]);
    expect(dispatchBadges(fullDriver, rows, TODAY)).toEqual([]);
    const gear = checklist(fullDriver, rows).filter((s) => s.def.group === 'equipment');
    expect(gear.every((s) => s.state === 'missing')).toBe(true);
  });

  it('gear: declared without photo, un-declared, and photo states', () => {
    const rows: ReviewRow[] = [
      { item: 'boots', photo_path: null, status: 'pending', reason: null, owned: true },
      { item: 'gloves', photo_path: 'g.jpg', status: 'approved', reason: null, owned: false },
      { item: 'mask', photo_path: 'm.jpg', status: 'pending', reason: null, owned: true },
    ];
    const st = Object.fromEntries(checklist(fullDriver, rows).map((s) => [s.def.id, s.state]));
    expect(st.boots).toBe('declared');
    expect(st.gloves).toBe('missing'); // no longer owned
    expect(st.mask).toBe('pending');
    expect(profileGaps(fullDriver, approvedRows(fullDriver, REQUIRED_ITEMS.map((i) => i.id)).concat(rows))).toEqual([]);
  });

  it('a legacy driver with only old columns gets gaps per group (never a block on its own)', () => {
    const legacy: DriverProfileFields = {
      insurance_card_url: 'insurance/1.jpg',
      insurance_expiry: '2027-01-01',
      insurance_policy: 'P',
      registration_url: 'registration/1.jpg',
      vehicle_photo_front_url: 'vehicles/1.jpg',
    };
    const gaps = profileGaps(legacy, []);
    const groups = gaps.map((g) => g.group);
    expect(groups).toEqual(['insurance', 'registration', 'vehicle_photos', 'dimensions']); // never gear
    expect(gaps.find((g) => g.group === 'vehicle_photos')!.missing).toEqual([
      'Vehicle - back', 'Vehicle - side', 'Cargo area',
    ]);
    // Files on record but never reviewed show as "unreviewed", not missing.
    const states = Object.fromEntries(checklist(legacy, []).map((s) => [s.def.id, s.state]));
    expect(states.insurance_card).toBe('unreviewed');
    expect(states.vehicle_front).toBe('unreviewed');
  });

  it('rejected required items show as a redo gap; pending does not; rejected gear never does', () => {
    const rows = approvedRows(fullDriver).map((r) =>
      r.item === 'vehicle_side'
        ? { ...r, status: 'rejected', reason: 'Blurry' }
        : r.item === 'vehicle_back'
        ? { ...r, status: 'pending' }
        : r.item === 'gloves'
        ? { ...r, status: 'rejected', reason: 'Not gloves' }
        : r
    );
    const gaps = profileGaps(fullDriver, rows);
    expect(gaps).toEqual([{ group: 'vehicle_photos', label: 'Vehicle photos', missing: ['Vehicle - side (redo)'] }]);
    const side = checklist(fullDriver, rows).find((s) => s.def.id === 'vehicle_side')!;
    expect(side.reason).toBe('Blurry');
  });

  it('a retaken document whose file changed shows as pending', () => {
    const rows = approvedRows(fullDriver);
    const d = { ...fullDriver, registration_url: `drivers/${P}/registration-2.jpg` };
    expect(checklist(d, rows).find((s) => s.def.id === 'registration')!.state).toBe('pending');
  });

  it('dimensions are missing until all four are entered', () => {
    const d = { ...fullDriver, cargo_capacity_lbs: null };
    expect(checklist(d, approvedRows(fullDriver)).find((s) => s.def.id === 'cargo_dimensions')!.state).toBe('missing');
  });

  it('driverHasEquipment counts approved + owned; driverDeclaresEquipment counts owned', () => {
    const rows: ReviewRow[] = [
      { item: 'hand_truck', photo_path: 'x', status: 'approved', reason: null },
      { item: 'cooler_temp_kit', photo_path: 'y', status: 'pending', reason: null },
      { item: 'boots', photo_path: null, status: 'pending', reason: null, owned: true },
      { item: 'gloves', photo_path: 'z', status: 'approved', reason: null, owned: false },
    ];
    expect(driverHasEquipment(rows, 'hand_truck')).toBe(true);
    expect(driverHasEquipment(rows, 'cooler_temp_kit')).toBe(false);
    expect(driverHasEquipment(rows, 'gloves')).toBe(false); // un-declared
    expect(driverDeclaresEquipment(rows, 'boots')).toBe(true);
    expect(driverDeclaresEquipment(rows, 'gloves')).toBe(false);
    expect(declaredGear(rows).map((g) => [g.def.id, g.approved])).toEqual([
      ['boots', false],
      ['hand_truck', true],
      ['cooler_temp_kit', false],
    ]);
  });

  it('gearMatch is informational: needed vs declared vs approved', () => {
    const rows: ReviewRow[] = [
      { item: 'hi_vis_vest', photo_path: 'v', status: 'approved', reason: null },
      { item: 'boots', photo_path: null, status: 'pending', reason: null },
    ];
    expect(gearMatch(rows, ['hi_vis_vest', 'boots', 'safety_glasses', 'jetpack'])).toEqual({
      needed: ['hi_vis_vest', 'boots', 'safety_glasses'],
      declared: ['hi_vis_vest', 'boots'],
      approved: ['hi_vis_vest'],
      missing: ['safety_glasses'],
    });
    expect(gearMatch(rows, null).needed).toEqual([]);
  });

  it('parseRequiredEquipment / gearLabels', () => {
    expect(parseRequiredEquipment(['boots', 'hi_vis_vest', 'boots'])).toEqual({ ok: true, value: ['hi_vis_vest', 'boots'] });
    expect(parseRequiredEquipment(null)).toEqual({ ok: true, value: [] });
    expect(parseRequiredEquipment(['jetpack'])).toMatchObject({ ok: false });
    expect(parseRequiredEquipment('boots')).toMatchObject({ ok: false });
    expect(parseRequiredEquipment(['insurance_card'])).toMatchObject({ ok: false }); // not gear
    expect(gearLabels(['hi_vis_vest', 'x'])).toEqual(['Hi-vis safety vest']);
  });
});

describe('dispatchBadges', () => {
  it('flags expired / expiring insurance and registration', () => {
    const rows = approvedRows(fullDriver);
    expect(dispatchBadges({ ...fullDriver, insurance_expiry: '2026-10-01' }, rows, TODAY).map((b) => b.label)).toEqual([
      'Insurance expired',
    ]);
    expect(dispatchBadges({ ...fullDriver, insurance_expiry: '2026-11-05' }, rows, TODAY).map((b) => b.label)).toEqual([
      'Insurance expiring',
    ]);
    expect(dispatchBadges({ ...fullDriver, registration_expiry: '2026-10-01' }, rows, TODAY).map((b) => b.label)).toEqual([
      'Registration expired',
    ]);
  });
  it('flags a current but unapproved card as no new jobs', () => {
    const rows = approvedRows(fullDriver).filter((r) => r.item !== 'insurance_card');
    expect(dispatchBadges(fullDriver, rows, TODAY).map((b) => b.label)).toEqual(['No new jobs: insurance']);
  });
  it('flags a missing required item as no new jobs', () => {
    const rows = approvedRows(fullDriver);
    const labels = dispatchBadges({ ...fullDriver, vehicle_photo_cargo_url: null }, rows, TODAY).map((b) => b.label);
    expect(labels).toContain('No new jobs: required items');
    expect(labels).not.toContain('No new jobs: insurance');
  });
});

describe('driverWarnings', () => {
  it('warns from 14 days out and explains a block', () => {
    const rows = approvedRows(fullDriver);
    expect(driverWarnings({ ...fullDriver, insurance_expiry: '2026-11-15' }, rows, TODAY)[0].text).toMatch(/in 14 days/);
    expect(driverWarnings({ ...fullDriver, insurance_expiry: '2026-11-16' }, rows, TODAY)).toEqual([]);
    expect(driverWarnings({ ...fullDriver, insurance_expiry: '2026-10-31' }, rows, TODAY)[0].tone).toBe('red');
    const reg = driverWarnings({ ...fullDriver, registration_expiry: '2026-10-31' }, rows, TODAY);
    expect(reg).toHaveLength(1);
    expect(reg[0].tone).toBe('amber'); // registration warns, never blocks
  });
  it('names missing required items in the red warning', () => {
    const w = driverWarnings({ ...fullDriver, vehicle_photo_front_url: null }, approvedRows(fullDriver), TODAY);
    expect(w[0]).toEqual({ tone: 'red', text: 'You will not get new job offers right now: Missing required items: Vehicle - front.' });
  });
});

describe('validation', () => {
  it('dimensions: required, bounded, rounded', () => {
    expect(validateDimensions({ cargo_length_in: '120', cargo_width_in: 60, cargo_height_in: 50.04, cargo_capacity_lbs: '2000.4' })).toEqual({
      ok: true,
      value: { cargo_length_in: 120, cargo_width_in: 60, cargo_height_in: 50, cargo_capacity_lbs: 2000 },
    });
    expect(validateDimensions({ cargo_length_in: 120, cargo_width_in: 60, cargo_height_in: 50 })).toMatchObject({ ok: false });
    expect(validateDimensions({ cargo_length_in: 5000, cargo_width_in: 60, cargo_height_in: 50, cargo_capacity_lbs: 1 })).toEqual({
      ok: false,
      error: 'Cargo length must be between 12 and 480 in',
    });
    expect(validateDimensions({ cargo_length_in: 120, cargo_width_in: 60, cargo_height_in: 50, cargo_capacity_lbs: 10 })).toMatchObject({ ok: false });
  });

  it('insurance details', () => {
    const good = {
      insurance_carrier: ' Acme  Mutual ',
      insurance_policy: 'POL-1',
      insurance_expiry: '2027-01-01',
      insurance_bi_per_person: '$30,000',
      insurance_bi_per_accident: 60000,
      insurance_pd_limit: '15000',
      insurance_business_use: false,
    };
    const r = validateInsuranceDetails(good, TODAY);
    expect(r).toMatchObject({ ok: true, value: { insurance_carrier: 'Acme Mutual', insurance_bi_per_person: 30000, insurance_business_use: false } });
    expect(validateInsuranceDetails({ ...good, insurance_expiry: '2026-10-31' }, TODAY)).toMatchObject({ ok: false });
    expect(validateInsuranceDetails({ ...good, insurance_expiry: '2026-02-30' }, TODAY)).toMatchObject({ ok: false });
    expect(validateInsuranceDetails({ ...good, insurance_business_use: 'yes' }, TODAY)).toMatchObject({ ok: false });
    expect(validateInsuranceDetails({ ...good, insurance_carrier: '' }, TODAY)).toMatchObject({ ok: false });
    expect(validateInsuranceDetails({ ...good, insurance_pd_limit: -1 }, TODAY)).toMatchObject({ ok: false });
  });

  it('registration expiry', () => {
    expect(validateRegistrationExpiry({ registration_expiry: '2027-01-01' }, TODAY)).toEqual({ ok: true, value: { registration_expiry: '2027-01-01' } });
    expect(validateRegistrationExpiry({ registration_expiry: '2026-01-01' }, TODAY)).toMatchObject({ ok: false });
    expect(isValidDateString('2026-13-01')).toBe(false);
  });
});

describe('storage paths', () => {
  it('own folder only, single safe file segment', () => {
    expect(isOwnUploadPath(`drivers/${P}/gloves-1.jpg`, P)).toBe(true);
    expect(isOwnUploadPath(`drivers/${P}/../x.jpg`, P)).toBe(false);
    expect(isOwnUploadPath(`drivers/${P}/a/b.jpg`, P)).toBe(false);
    expect(isOwnUploadPath(`drivers/other/x.jpg`, P)).toBe(false);
    expect(isOwnUploadPath(`insurance/x.jpg`, P)).toBe(false);
    expect(isOwnUploadPath(42, P)).toBe(false);
    expect(isOwnUploadPath(buildUploadPath(P, 'hand_truck', 'jpg', 1761600000000, 0.123456), P)).toBe(true);
  });
});

describe('parseReviewDecision', () => {
  it('validates item, decision, and reason', () => {
    const v = '2026-10-28T05:00:00.123456+00:00';
    expect(parseReviewDecision({ item: 'gloves', decision: 'approve', photo_path: 'p', uploaded_at: v })).toEqual({
      ok: true,
      value: { item: 'gloves', decision: 'approve', reason: null, photo_path: 'p', uploaded_at: v },
    });
    expect(parseReviewDecision({ item: 'gloves', decision: 'approve', photo_path: 'p' })).toMatchObject({ ok: false }); // N2: version required
    expect(parseReviewDecision({ item: 'gloves', decision: 'approve', uploaded_at: 5 })).toMatchObject({ ok: false });
    expect(parseReviewDecision({ item: 'insurance_card', decision: 'approve', uploaded_at: null })).toMatchObject({ ok: true, value: { uploaded_at: null } });
    expect(parseReviewDecision({ item: 'gloves', decision: 'reject', uploaded_at: null })).toMatchObject({ ok: false });
    expect(parseReviewDecision({ item: 'gloves', decision: 'reject', reason: ' Blurry ', uploaded_at: null })).toMatchObject({ ok: true, value: { reason: 'Blurry' } });
    expect(parseReviewDecision({ item: 'license', decision: 'approve' })).toMatchObject({ ok: false });
    expect(parseReviewDecision({ item: 'gloves', decision: 'maybe' })).toMatchObject({ ok: false });
    expect(parseReviewDecision(null)).toMatchObject({ ok: false });
  });
});

describe('onboardingMissing', () => {
  it('lists only required items; gear and the badge photo never block', () => {
    const all = Object.fromEntries(REQUIRED_ITEMS.map((i) => [i.id, true]));
    expect(onboardingMissing(all)).toEqual([]);
    const missing = onboardingMissing({}).map((d) => d.id);
    for (const g of GEAR_ITEMS) expect(missing).not.toContain(g.id);
    expect(missing).not.toContain('id_badge_photo');
    expect(onboardingMissing({ ...all, registration: false }).map((d) => d.id)).toEqual(['registration']);
  });
});

describe('readinessFor (dispatch offer picker)', async () => {
  const { readinessFor } = await import('./driver-readiness');
  it('skips blocked drivers and exposes approved extras for matching', () => {
    const rows = approvedRows(fullDriver);
    const ok = readinessFor(fullDriver, rows, TODAY);
    expect(ok.blockReason).toBeNull();
    expect(ok.gear).toHaveLength(8);
    expect(ok.gear.every((g) => g.approved)).toBe(true);
    const withNeed = readinessFor(fullDriver, rows, TODAY, ['hi_vis_vest']);
    expect(withNeed.match).toMatchObject({ approved: ['hi_vis_vest'], missing: [] });
    const expired = readinessFor({ ...fullDriver, insurance_expiry: '2026-10-01' }, rows, TODAY);
    expect(expired.blockReason).toBe('Insurance expired on 2026-10-01');
    expect(expired.badges.map((b) => b.label)).toContain('Insurance expired');
  });
});

describe('isHeicFile (QA N4)', () => {
  it('detects HEIC/HEIF by type or name', () => {
    expect(isHeicFile({ type: 'image/heic', name: 'a' })).toBe(true);
    expect(isHeicFile({ type: '', name: 'IMG_1.HEIC' })).toBe(true);
    expect(isHeicFile({ type: 'image/heif', name: 'x' })).toBe(true);
    expect(isHeicFile({ type: 'image/jpeg', name: 'IMG_1.jpg' })).toBe(false);
  });
});
