// Identity and supply lists; district mechanics come in 36.2 / 36.3.
import { CROP_IDS, type CropId } from './crops'

export const DISTRICT_IDS = ['plain', 'orchardValley', 'ironHills', 'wetlands'] as const
export type DistrictId = (typeof DISTRICT_IDS)[number]

export const DISTRICTS: Record<DistrictId, { name: string; emoji: string }> = {
  plain: { name: 'The plain farm', emoji: '🏡' },
  orchardValley: { name: 'Orchard Valley', emoji: '🌳' },
  ironHills: { name: 'Iron Hills', emoji: '⛏️' },
  wetlands: { name: 'Wetlands', emoji: '🌊' },
}

/** the districts a listing can roll */
export const ROLLED_DISTRICTS: readonly DistrictId[] = ['orchardValley', 'ironHills', 'wetlands']

const CHEAP_RUNGS: readonly CropId[] = ['potato', 'radish', 'corn', 'eggplant', 'pumpkin']

/** the licences a district's shop sells (batch 36.2); wetlands' own list goes live in 36.3 */
export const DISTRICT_SELLS: Record<DistrictId, readonly CropId[]> = {
  plain: CROP_IDS,
  orchardValley: [...CHEAP_RUNGS, 'lemon', 'grape', 'strawberry'],
  ironHills: [...CHEAP_RUNGS, 'tomato', 'chilli'],
  wetlands: CROP_IDS,
}

export const districtSells = (district: DistrictId, crop: CropId): boolean => DISTRICT_SELLS[district].includes(crop)

/** the Next farm row's second line */
export const DISTRICT_HINT: Partial<Record<DistrictId, string>> = {
  orchardValley: 'sells 8 of 10 crops · berries ×1.4 · 🌳 fruit tree',
  ironHills: 'sells 7 of 10 crops · 🔨 forge',
}
