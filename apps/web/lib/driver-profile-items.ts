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

export type ProfileItemGroup = 'vehicle' | 'documents' | 'equipment';

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
  // Equipment
  { id: 'hi_vis_vest', label: 'Hi-vis safety vest', hint: 'The vest laid flat or worn', group: 'equipment', required: true, kind: 'photo' },
  { id: 'safety_glasses', label: 'Safety glasses', hint: 'Your safety glasses', group: 'equipment', required: true, kind: 'photo' },
  { id: 'boots', label: 'Work boots', hint: 'Closed-toe work boots', group: 'equipment', required: true, kind: 'photo' },
  { id: 'gloves', label: 'Work gloves', hint: 'Your work gloves', group: 'equipment', required: true, kind: 'photo' },
  { id: 'mask', label: 'Face mask', hint: 'A mask for medical and clean-room stops', group: 'equipment', required: true, kind: 'photo' },
  { id: 'hand_truck', label: 'Hand truck / dolly', hint: 'Your hand truck or dolly', group: 'equipment', required: false, kind: 'photo', shortLabel: 'Dolly' },
  { id: 'straps_blankets', label: 'Straps and moving blankets', hint: 'Tie-down straps and moving blankets together', group: 'equipment', required: false, kind: 'photo', shortLabel: 'Straps/blankets' },
  { id: 'cooler_temp_kit', label: 'Insulated cooler / temp kit', hint: 'Cooler or temperature kit, lid open', group: 'equipment', required: false, kind: 'photo', shortLabel: 'Cooler' },
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

export const REQUIRED_ITEMS: ProfileItemDef[] = (PROFILE_ITEMS as readonly ProfileItemDef[]).filter((i) => i.required);
export const EXTRA_ITEMS: ProfileItemDef[] = (PROFILE_ITEMS as readonly ProfileItemDef[]).filter((i) => !i.required);

export const GROUP_LABELS: Record<ProfileItemGroup, string> = {
  vehicle: 'Vehicle',
  documents: 'Documents',
  equipment: 'Equipment',
};
