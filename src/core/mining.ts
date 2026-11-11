import { addLifetime, fail, isAmount, nextRandom, withRun, type ActionError, type ActionResult } from './actions'
import {
  ACTION_ENERGY_COST,
  isSellable,
  itemSellPrice,
  masteryLevel,
  masteryMaxLevel,
  mineHits,
  mineLicenseCost,
  oreSortUnlockCost,
  oreSortVeinLevel,
  pickaxeCraftCost,
  pickaxeDurability,
  pickaxeRepairCost,
  preserveChance,
  rockHits,
  rockPickaxe,
  storageCost,
  storageMaxLevel,
  storageSlotsPerLevel,
  veinDrops,
  veinNeedsFurnace,
  veinNeedsPickaxe,
  veinUpgradeCost,
  woodCost,
  type MineDropId,
  type Price,
} from './balance'
import { ITEMS, ITEM_IDS, PICKAXE_TIERS, type ItemId, type PickaxeTier } from './data/items'
import type { GameState, Pickaxe, RunState } from './state'

// Mining actions cost no energy except dig (the mine action). Every item, wood included, takes one storage slot.

export function bagCount(run: RunState): number {
  return ITEM_IDS.reduce((n, id) => n + (run.inventory[id] ?? 0), 0)
}

function addItems(run: RunState, id: ItemId, n: number): RunState['inventory'] {
  return { ...run.inventory, [id]: (run.inventory[id] ?? 0) + n }
}

/** "⛰️ Stone 80 % · ⚫ Coal 20 %" for a vein level */
export function dropText(level: number): string {
  const drops = veinDrops(level)
  const total = ITEM_IDS.reduce((sum, id) => sum + (drops[id] ?? 0), 0)
  return ITEM_IDS.filter((id) => (drops[id] ?? 0) > 0)
    .map((id) => `${ITEMS[id].emoji} ${ITEMS[id].name} ${Math.round(((drops[id] ?? 0) / total) * 100)} %`)
    .join(' · ')
}

/** weighted pick; r in [0, 1) */
function pickDrop(weights: Partial<Record<ItemId, number>>, r: number): ItemId {
  const ids = ITEM_IDS.filter((id) => (weights[id] ?? 0) > 0)
  let x = r * ids.reduce((sum, id) => sum + weights[id]!, 0)
  for (const id of ids) {
    x -= weights[id]!
    if (x < 0) return id
  }
  return ids[ids.length - 1]
}

export function buyMineLicense(state: GameState): ActionResult {
  const { run } = state
  if (run.mineLicense) return fail('ALREADY_OWNED')
  const cost = mineLicenseCost(state.meta)
  if (run.cash < cost) return fail('NO_CASH')
  return withRun(state, { cash: run.cash - cost, mineLicense: true })
}

export function buyWood(state: GameState, n: number): ActionResult {
  const { run } = state
  if (!isAmount(n)) return fail('BAD_AMOUNT')
  if (bagCount(run) + n > run.bagCapacity) return fail('BAG_FULL')
  const cost = n * woodCost(state.meta)
  if (run.cash < cost) return fail('NO_CASH')
  return withRun(state, { cash: run.cash - cost, inventory: addItems(run, 'wood', n) })
}

// A higher tier replaces the pickaxe in hand; a blunt pickaxe can be replaced by any other tier (the way out when its
// repair is out of reach). Every tier's mastery xp stays in run.mastery.
// Order: ALREADY_OWNED (sharp: this tier or a higher one in hand; blunt: this tier), NOT_ENOUGH_ITEMS, NO_CASH. No energy.
export function craftPickaxe(state: GameState, tier: PickaxeTier = 'wooden'): ActionResult {
  const { run } = state
  const held = run.pickaxe
  if (held && (held.durability > 0 ? PICKAXE_TIERS.indexOf(held.tier) >= PICKAXE_TIERS.indexOf(tier) : held.tier === tier))
    return fail('ALREADY_OWNED')
  return pay(state, pickaxeCraftCost(tier, state.meta), { pickaxe: { tier, durability: pickaxeDurability(tier) } })
}

/** the pickaxe this mine action uses; null = by hand (none owned, or blunt) */
export function activePickaxe(run: RunState): Pickaxe | null {
  return run.pickaxe && run.pickaxe.durability > 0 ? run.pickaxe : null
}

/** chance this run's mine action with a pickaxe of `tier` keeps its durability */
export function pickaxePreserve(tier: PickaxeTier, run: RunState): number {
  return preserveChance(masteryLevel(tier, run.mastery[tier] ?? 0), run.masteredTiers.length)
}

/** mine actions a pickaxe of this tier lasts on average at the run's mastery: durability / (1 − preserve); fresh by default */
export function expectedUses(tier: PickaxeTier, run: RunState, durability = pickaxeDurability(tier)): number {
  return durability / (1 - pickaxePreserve(tier, run))
}

/** what a rock counts as when mined with `tier` (null = by hand): itself, or stone when the tier is below rockPickaxe */
export function minedRock(rock: ItemId, tier: PickaxeTier | null): ItemId {
  const need = rockPickaxe(rock)
  return need && (!tier || PICKAXE_TIERS.indexOf(tier) < PICKAXE_TIERS.indexOf(need)) ? 'stone' : rock
}

/** +1 xp for the tier; reaching max mastery adds it to masteredTiers once */
function gainMastery(run: RunState, tier: PickaxeTier): Pick<RunState, 'mastery' | 'masteredTiers'> {
  const xp = (run.mastery[tier] ?? 0) + 1
  const mastered = masteryLevel(tier, xp) >= masteryMaxLevel() && !run.masteredTiers.includes(tier)
  return { mastery: { ...run.mastery, [tier]: xp }, masteredTiers: mastered ? [...run.masteredTiers, tier] : run.masteredTiers }
}

// The mine action (still called dig). Validates in this order: NO_MINE_LICENSE, BAG_FULL, NO_ENERGY.
// Hits add to the current rock; at rockHits(rock) it drops its item, extra hits are lost, and the next rock is rolled
// from the vein table (one roll per break, as before the rock had a type). A pickaxe action rolls preserve first
// (mastery level before this action's xp), else loses 1 durability; at 0 it goes blunt (kept, mines by hand until
// repaired). Only pickaxe actions earn mastery xp. A rock that needs a better pickaxe than the active one (iron: copper
// or better) is mined as a stone rock: stone's hits, drops stone. The mine worker presses it with `energy` 0.
// A rock whose kind is set to Sell on dig never fails BAG_FULL: its drop is stored and sold at once (sellItem).
export function dig(state: GameState, energy = ACTION_ENERGY_COST): ActionResult {
  const { run } = state
  if (!run.mineLicense) return fail('NO_MINE_LICENSE')
  const pickaxe = activePickaxe(run)
  const rock = minedRock(run.vein.rock, pickaxe?.tier ?? null)
  const sell = (run.oreSort as Partial<Record<ItemId, string>>)[rock] === 'sell'
  if (!sell && bagCount(run) >= run.bagCapacity) return fail('BAG_FULL')
  if (run.energy < energy) return fail('NO_ENERGY')
  const hits = run.vein.progress + mineHits(pickaxe?.tier ?? null)
  const drop = hits >= rockHits(rock)
  const [keep, afterKeep] = pickaxe ? nextRandom(run.rngState) : [1, run.rngState]
  const [r, rngState] = drop ? nextRandom(afterKeep) : [0, afterKeep]
  const used = pickaxe && keep >= pickaxePreserve(pickaxe.tier, run)
  const mined = withRun(state, {
    energy: run.energy - energy,
    rngState,
    pickaxe: pickaxe && used ? { ...pickaxe, durability: pickaxe.durability - 1 } : run.pickaxe,
    vein: drop ? { ...run.vein, progress: 0, rock: pickDrop(veinDrops(run.vein.level), r) } : { ...run.vein, progress: hits },
    inventory: drop ? addItems(run, rock, 1) : run.inventory,
    counters: { ...run.counters, mines: run.counters.mines + 1 },
    lifetime: addLifetime(run, energy, 0),
    ...(pickaxe && gainMastery(run, pickaxe.tier)),
  })
  return drop && sell && mined.ok ? sellItem(mined.state, rock, 1) : mined
}

// 🧺 Ore sorting: unlock pays the kind's price. Order: NO_MINE_LICENSE, LOCKED (vein below Lv3), ALREADY_OWNED,
// NOT_ENOUGH_ITEMS, NO_CASH. No energy; the kind starts on Keep.
export function unlockOreSort(state: GameState, kind: MineDropId): ActionResult {
  const { run } = state
  if (!run.mineLicense) return fail('NO_MINE_LICENSE')
  if (run.vein.level < oreSortVeinLevel()) return fail('LOCKED')
  if (run.oreSort[kind]) return fail('ALREADY_OWNED')
  return pay(state, oreSortUnlockCost(kind, state.meta), { oreSort: { ...run.oreSort, [kind]: 'keep' } })
}

/** Keep ↔ Sell on dig for an unlocked kind; free, no energy; LOCKED when the kind is not unlocked */
export function setOreSort(state: GameState, kind: MineDropId, mode: 'keep' | 'sell'): ActionResult {
  const { run } = state
  if (!run.oreSort[kind]) return fail('LOCKED')
  return withRun(state, { oreSort: { ...run.oreSort, [kind]: mode } })
}

// Repair pays the tier's repair price (wood, copper bars). Order: NO_PICKAXE, NOT_BLUNT, NOT_ENOUGH_ITEMS, NO_CASH.
// No energy; back to full durability.
export function repairPickaxe(state: GameState): ActionResult {
  const { pickaxe } = state.run
  if (!pickaxe) return fail('NO_PICKAXE')
  if (pickaxe.durability > 0) return fail('NOT_BLUNT')
  return pay(state, pickaxeRepairCost(pickaxe.tier, state.meta), { pickaxe: { ...pickaxe, durability: pickaxeDurability(pickaxe.tier) } })
}

/** pays the items from storage, then ⭐, then the cash, and applies `gain`; NOT_ENOUGH_ITEMS, NO_STARS, NO_CASH */
export function pay(state: GameState, price: Price, gain: Partial<RunState> = {}): ActionResult {
  const { run } = state
  const { cash, stars = 0, ...items } = price
  const ids = ITEM_IDS.filter((id) => (items[id] ?? 0) > 0)
  if (ids.some((id) => (run.inventory[id] ?? 0) < items[id]!)) return fail('NOT_ENOUGH_ITEMS')
  if (run.stars < stars) return fail('NO_STARS')
  if (run.cash < cash) return fail('NO_CASH')
  const inventory = { ...run.inventory }
  for (const id of ids) inventory[id] = (inventory[id] ?? 0) - items[id]!
  return withRun(state, { cash: run.cash - cash, stars: run.stars - stars, inventory, ...gain })
}

// Mine upgrades pay items from storage plus cash, no energy. Order: NO_MINE_LICENSE, MAX_LEVEL (cost null),
// `blocked` (a missing building), NOT_ENOUGH_ITEMS, NO_CASH.
function buyMineUpgrade(state: GameState, cost: Price | null, gain: Partial<RunState>, blocked: ActionError | null = null): ActionResult {
  if (!state.run.mineLicense) return fail('NO_MINE_LICENSE')
  if (!cost) return fail('MAX_LEVEL')
  if (blocked) return fail(blocked)
  return pay(state, cost, gain)
}

/** next vein level: a new drop table for the rocks after the current one, which keeps its type and progress */
export function upgradeVein(state: GameState): ActionResult {
  const { vein, furnace, pickaxe } = state.run
  const next = vein.level + 1
  // Lv4 drops gold rocks, which only the iron pickaxe or better breaks as gold (anything less mines them as stone)
  const blocked =
    veinNeedsFurnace(next) && !furnace.built ? 'NO_FURNACE' : veinNeedsPickaxe(next) && pickaxe?.tier !== 'iron' && pickaxe?.tier !== 'gold' ? 'NO_IRON_PICKAXE' : null
  return buyMineUpgrade(state, veinUpgradeCost(vein.level, state.meta), { vein: { ...vein, level: next } }, blocked)
}

/** next storage level: +storageSlotsPerLevel() capacity */
export function buyStorage(state: GameState): ActionResult {
  const { run } = state
  const cost = run.storageLevel < storageMaxLevel() ? storageCost(run.storageLevel, state.meta) : null
  return buyMineUpgrade(state, cost, { storageLevel: run.storageLevel + 1, bagCapacity: run.bagCapacity + storageSlotsPerLevel() })
}

/** each unit sold counts as one sale. Order: BAD_AMOUNT, NOT_SELLABLE (seeds), NOT_ENOUGH_ITEMS */
export function sellItem(state: GameState, id: ItemId, n: number): ActionResult {
  const { run } = state
  if (!isAmount(n)) return fail('BAD_AMOUNT')
  if (!isSellable(id)) return fail('NOT_SELLABLE')
  if ((run.inventory[id] ?? 0) < n) return fail('NOT_ENOUGH_ITEMS')
  const income = n * itemSellPrice(id, state.meta, run.upgrades.sellPrice)
  return withRun(state, {
    cash: run.cash + income,
    inventory: addItems(run, id, -n),
    counters: { ...run.counters, sales: run.counters.sales + n },
    lifetime: addLifetime(run, 0, income),
  })
}
