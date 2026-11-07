// Identity only; costs and effects live in balance.ts.
export const UPGRADE_IDS = ['energyMax', 'energyRegen', 'sellPrice', 'fertilizer'] as const
export type UpgradeId = (typeof UPGRADE_IDS)[number]

export const UPGRADES: Record<UpgradeId, { name: string }> = {
  energyMax: { name: 'Bigger stamina' },
  energyRegen: { name: 'Faster recovery' },
  sellPrice: { name: 'Better prices' },
  fertilizer: { name: 'Fertilizer' },
}
