// Identity only (batch 36.1); district mechanics come in 36.2 / 36.3.
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
