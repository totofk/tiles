// Identity only; prices and drop tables live in balance.ts.
export const ITEM_IDS = ['wood', 'stone'] as const
export type ItemId = (typeof ITEM_IDS)[number]

/** pickaxe tiers in order; a tier's index sets its mastery thresholds (balance.ts) */
export const PICKAXE_TIERS = ['wooden'] as const
export type PickaxeTier = (typeof PICKAXE_TIERS)[number]

export const ITEMS: Record<ItemId, { name: string; emoji: string }> = {
  wood: { name: 'Wood', emoji: '🪵' },
  stone: { name: 'Stone', emoji: '🪨' },
}
