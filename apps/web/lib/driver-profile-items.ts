// ONE source of truth for the driver profile checklist (P-366).
//
// To make an item required or optional, flip `required` on its line below.
// No migration is needed: the database accepts every id in this list
// regardless of the flag (driver_review_items_item_check in
// packages/supabase/migrations/20261028000500_p366_driver_profile.sql).
// Adding a NEW id does need that CHECK constraint extended.
//
// required: true  -> needed to finish onboarding; shows in "complete your
//                    profile" and in the dispatch badges when missing.
// required: false -> a plus ("Extras that get you more jobs"); never blocks
//                    anything; approved extras show to dispatch for matching.
//
// Nothing here blocks job offers. Only insurance does (see offerBlockReason
// in lib/driver-profile.ts and driver_offer_block_reason() in the database).
//
// GEAR (group 'equipment') IS DECLARED, NEVER REQUIRED. Commander ruling
// 2026-10-28 on TRIBUNAL P-367 R12 (AB 5 control-factor risk): the driver
// says which gear they own (photo optional); each job lists the gear that
// job needs, shown before accept, and the driver may decline any job. Do
// not flip a gear item to required: true without counsel sign-off. The code
// ignores the flag for gear anyway (profileGaps / onboardingMissing skip it).
//
// ID BADGE PHOTO (group 'badge'): collected only after dispatch approves the
// driver (TRIBUNAL R1, 2 CCR 11016(c)(2)). Never at application; never
// compared to any other photo by software.

export type ProfileItemGroup = 'vehicle' | 'documents' | 'equipment' | 'badge';

/** drivers columns that hold the file for a document or vehicle photo item. */
export type DriverFileColumn =
  | 'insurance_card_url'
  | 'registration_url'
  | 'vehicle_photo_front_url'
  | 'vehicle_photo_back_url'
  | 'vehicle_photo_side_url'
  | 'vehicle_photo_cargo_url';

export interface ProfileItemDef {
  id: string;
  label: string;
  /** One line telling the driver what the photo should show. */
  hint: string;
  group: ProfileItemGroup;
  required: boolean;
  /** 'photo' items carry a file; 'data' items are form values (dimensions). */
  kind: 'photo' | 'data';
  /** For document / vehicle items, the drivers column the file lives in. */
  column?: DriverFileColumn;
  allowPdf?: boolean;
  /** Short tag for dispatch screens (extras only). */
  shortLabel?: string;
}

export const PROFILE_ITEMS = [
  // Vehicle
  { id: 'vehicle_front', label: 'Vehicle - front', hint: 'Whole front of the vehicle, plate readable', group: 'vehicle', required: true, kind: 'photo', column: 'vehicle_photo_front_url' },
  { id: 'vehicle_back', label: 'Vehicle - back', hint: 'Whole back of the vehicle, plate readable', group: 'vehicle', required: true, kind: 'photo', column: 'vehicle_photo_back_url' },
  { id: 'vehicle_side', label: 'Vehicle - side', hint: 'Full side view', group: 'vehicle', required: true, kind: 'photo', column: 'vehicle_photo_side_url' },
  { id: 'vehicle_cargo', label: 'Cargo area', hint: 'Where the load goes (trunk, bed, or cargo box), empty', group: 'vehicle', required: true, kind: 'photo', column: 'vehicle_photo_cargo_url' },
  { id: 'cargo_dimensions', label: 'Cargo size and capacity', hint: 'Length, width, height in inches and max load in pounds', group: 'vehicle', required: true, kind: 'data' },
  // Documents
  { id: 'insurance_card', label: 'Insurance card', hint: 'Current card showing your name, policy number, and dates', group: 'documents', required: true, kind: 'photo', column: 'insurance_card_url', allowPdf: true },
  { id: 'registration', label: 'Vehicle registration', hint: 'Current registration card for this vehicle', group: 'documents', required: true, kind: 'photo', column: 'registration_url', allowPdf: true },
  // Gear the driver owns (declared, never required; see header)
  { id: 'hi_vis_vest', label: 'Hi-vis safety vest', hint: 'Some sites ask for one', group: 'equipment', required: false, kind: 'photo', shortLabel: 'Vest' },
  { id: 'safety_glasses', label: 'Safety glasses', hint: 'Some sites ask for them', group: 'equipment', required: false, kind: 'photo', shortLabel: 'Glasses' },
  { id: 'boots', label: 'Work boots', hint: 'Closed-toe work boots', group: 'equipment', required: false, kind: 'photo', shortLabel: 'Boots' },
  { id: 'gloves', label: 'Work gloves', hint: 'For heavy or rough loads', group: 'equipment', required: false, kind: 'photo', shortLabel: 'Gloves' },
  { id: 'mask', label: 'Face mask', hint: 'Some medical and clean-room stops ask for one', group: 'equipment', required: false, kind: 'photo', shortLabel: 'Mask' },
  { id: 'hand_truck', label: 'Hand truck / dolly', hint: 'For heavy or multi-piece loads', group: 'equipment', required: false, kind: 'photo', shortLabel: 'Dolly' },
  { id: 'straps_blankets', label: 'Straps and moving blankets', hint: 'For furniture and fragile loads', group: 'equipment', required: false, kind: 'photo', shortLabel: 'Straps/blankets' },
  { id: 'cooler_temp_kit', label: 'Insulated cooler / temp kit', hint: 'For cold-chain and medical loads', group: 'equipment', required: false, kind: 'photo', shortLabel: 'Cooler' },
  // After approval only (R1)
  { id: 'id_badge_photo', label: 'ID badge photo', hint: 'A clear photo of you for your driver ID badge, shown to customers at pickup and drop-off', group: 'badge', required: false, kind: 'photo' },
] as const satisfies readonly ProfileItemDef[];

export type ProfileItemId = (typeof PROFILE_ITEMS)[number]['id'];

export const PROFILE_ITEM_IDS: readonly ProfileItemId[] = PROFILE_ITEMS.map((i) => i.id);

const BY_ID: Record<string, ProfileItemDef> = Object.fromEntries(
  (PROFILE_ITEMS as readonly ProfileItemDef[]).map((i) => [i.id, i])
);

export function getProfileItem(id: string): ProfileItemDef | null {
  return BY_ID[id] ?? null;
}

export function isProfileItemId(value: unknown): value is ProfileItemId {
  return typeof value === 'string' && value in BY_ID;
}

export function itemsInGroup(group: ProfileItemGroup): ProfileItemDef[] {
  return (PROFILE_ITEMS as readonly ProfileItemDef[]).filter((i) => i.group === group);
}

/** Items that can gate onboarding / show as gaps. Gear and the badge never do. */
export const REQUIRED_ITEMS: ProfileItemDef[] = (PROFILE_ITEMS as readonly ProfileItemDef[]).filter(
  (i) => i.required && i.group !== 'equipment' && i.group !== 'badge'
);

export const GROUP_LABELS: Record<ProfileItemGroup, string> = {
  vehicle: 'Vehicle',
  documents: 'Documents',
  equipment: 'Gear you own',
  badge: 'ID badge',
};

/** The 8 gear ids (declared by drivers; listed per job). */
export const GEAR_ITEMS: ProfileItemDef[] = (PROFILE_ITEMS as readonly ProfileItemDef[]).filter((i) => i.group === 'equipment');
export const GEAR_IDS: string[] = GEAR_ITEMS.map((i) => i.id);

export function isGearId(value: unknown): boolean {
  return typeof value === 'string' && GEAR_IDS.includes(value);
}
