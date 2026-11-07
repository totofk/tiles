// Identity only; prices and drop tables live in balance.ts.
export const ITEM_IDS = ['wood', 'stone', 'coal', 'copperOre', 'copperBar'] as const
export type ItemId = (typeof ITEM_IDS)[number]

/** pickaxe tiers in order; a tier's index sets its mastery thresholds (balance.ts) */
export const PICKAXE_TIERS = ['wooden', 'copper'] as const
export type PickaxeTier = (typeof PICKAXE_TIERS)[number]
export const PICKAXE_NAMES: Record<PickaxeTier, string> = { wooden: 'Wooden pickaxe', copper: 'Copper pickaxe' }

export const ITEMS: Record<ItemId, { name: string; emoji: string }> = {
  // 🌲 (Unicode 6.0) not 🪵 (13.0): 🪵 renders as an empty box on older emoji fonts; every wood icon reads this
  wood: { name: 'Wood', emoji: '🌲' },
  stone: { name: 'Stone', emoji: '🪨' },
  coal: { name: 'Coal', emoji: '⚫' },
  copperOre: { name: 'Copper ore', emoji: '🟤' },
  copperBar: { name: 'Copper bar', emoji: '🟧' },
}
