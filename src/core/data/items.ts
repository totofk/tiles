// Identity only; prices and drop tables live in balance.ts.
export const ITEM_IDS = ['wood', 'stone', 'coal', 'copperOre', 'copperBar', 'ironOre', 'ironBar'] as const
export type ItemId = (typeof ITEM_IDS)[number]

/** ores the furnace smelts, one kind in its slot at a time (balance.ts maps each to its bar) */
export const ORE_IDS = ['copperOre', 'ironOre'] as const
export type OreId = (typeof ORE_IDS)[number]

/** pickaxe tiers in order; a tier's index sets its mastery thresholds (balance.ts) */
export const PICKAXE_TIERS = ['wooden', 'copper'] as const
export type PickaxeTier = (typeof PICKAXE_TIERS)[number]
export const PICKAXE_NAMES: Record<PickaxeTier, string> = { wooden: 'Wooden pickaxe', copper: 'Copper pickaxe' }

// Every icon is from Unicode ≤ 11: newer ones (🪵 13, 🪨 13, 🟤 🟧 12) render as an empty box on older emoji fonts.
// Every item icon in the UI reads this. Metal ladder: ore 🔶 / 🔷 (6.0), bars 🥉 / 🥈 (9.0), gold 🥇 later.
export const ITEMS: Record<ItemId, { name: string; emoji: string }> = {
  wood: { name: 'Wood', emoji: '🌲' },
  stone: { name: 'Stone', emoji: '⛰️' },
  coal: { name: 'Coal', emoji: '⚫' },
  copperOre: { name: 'Copper ore', emoji: '🔶' },
  copperBar: { name: 'Copper bar', emoji: '🥉' },
  ironOre: { name: 'Iron ore', emoji: '🔷' },
  ironBar: { name: 'Iron bar', emoji: '🥈' },
}
