// Identity only; every relic number lives in balance.ts, the spending logic in core/relics.ts.
/** the 6 run-long rules dig shards buy (batch 36.4); order = the 📖 book's row order */
export const RELIC_IDS = ['orderBonus', 'marketFloor', 'orderCooldown', 'energyRegen', 'overflowReserve', 'stoneFuel'] as const
export type RelicId = (typeof RELIC_IDS)[number]

/** name and one-line rule text as the 📖 book shows them (names/texts are Hermes's wording, DECISIONS "Batch 36.4 refined") */
export const RELICS: Record<RelicId, { name: string; text: string }> = {
  orderBonus: { name: '📋 Order bonus', text: 'Orders pay +20 % instead of +10 % (+30 % in a set).' },
  marketFloor: { name: '📉 Market floor', text: "Every crop's price floor +0.10 (+0.15 in a set)." },
  orderCooldown: { name: '⏳ Quick notices', text: 'A discarded order refills in half the time (a third in a set).' },
  energyRegen: { name: '⚡ Second wind', text: '⚡ regen +10 % (+15 % in a set).' },
  overflowReserve: { name: '🔋 Reserve', text: '⚡ regen past full is banked, up to 20 × your ⚡ max (30 × in a set).' },
  stoneFuel: { name: '⛰️ Stone fire', text: 'Stone burns in the furnace: 2 fire units each (3 in a set).' },
}
