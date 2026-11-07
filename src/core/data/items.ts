// Identity only; prices and drop tables live in balance.ts.
export const ITEM_IDS = ['wood', 'stone'] as const
export type ItemId = (typeof ITEM_IDS)[number]

export const ITEMS: Record<ItemId, { name: string; emoji: string }> = {
  wood: { name: 'Wood', emoji: '🪵' },
  stone: { name: 'Stone', emoji: '🪨' },
}
