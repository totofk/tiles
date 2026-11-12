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
  veinNeedsFurnace,
  veinNeedsPickaxe,
  veinUpgradeCost,
  veinWeights,
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

/** "⛰️ Stone 80 % · ⚫ Coal 20 %" for a vein level with `mastered` tiers' ore bonus (the weights dig rolls from) */
export function dropText(level: number, mastered: number): string {
  const drops = veinWeights(level, mastered)
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

// Every crafted tier stays on the rack (blunt ones too); crafting adds the tier and selects it. Every tier's mastery xp
// stays in run.mastery. Order: ALREADY_OWNED (on the rack, any durability), NOT_ENOUGH_ITEMS, NO_CASH. No energy.
export function craftPickaxe(state: GameState, tier: PickaxeTier = 'wooden'): ActionResult {
  const { run } = state
  if (run.rack[tier] !== undefined) return fail('ALREADY_OWNED')
  return pay(state, pickaxeCraftCost(tier, state.meta), { rack: { ...run.rack, [tier]: pickaxeDurability(tier) }, selectedPickaxe: tier })
}

/** takes an owned tier in hand (a blunt one mines by hand); free, no energy. NO_PICKAXE when not on the rack */
export function selectPickaxe(state: GameState, tier: PickaxeTier): ActionResult {
  if (state.run.rack[tier] === undefined) return fail('NO_PICKAXE')
  return withRun(state, { selectedPickaxe: tier })
}

/** the selected tier and its durability, blunt included; null = nothing selected */
export function heldPickaxe(run: RunState): Pickaxe | null {
  const tier = run.selectedPickaxe
  const durability = tier ? run.rack[tier] : undefined
  return tier && durability !== undefined ? { tier, durability } : null
}

/** the pickaxe this mine action uses; null = by hand (none held, or blunt) */
export function activePickaxe(run: RunState): Pickaxe | null {
  const held = heldPickaxe(run)
  return held && held.durability > 0 ? held : null
}

/** the highest tier on the rack, any durability; null = none crafted */
export function bestPickaxeTier(run: RunState): PickaxeTier | null {
  return PICKAXE_TIERS.findLast((t) => run.rack[t] !== undefined) ?? null
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

/** the state of a result that cannot fail (withRun; sellItem of one item just stored) */
const okState = (r: ActionResult) => (r as Extract<ActionResult, { ok: true }>).state

/** what breaking a rock of `rock` does to its drop: stored, sold at once (its kind is set to Sell on dig), or nothing
 * (storage full) */
function breakDrop(run: RunState, rock: ItemId): 'store' | 'sell' | 'full' {
  if ((run.oreSort as Partial<Record<ItemId, string>>)[rock] === 'sell') return 'sell'
  return bagCount(run) < run.bagCapacity ? 'store' : 'full'
}

// The mine action (still called dig). Validates in this order: NO_MINE_LICENSE, BAG_FULL (the current rock's drop
// has no room), NO_ENERGY. A pickaxe action rolls preserve first (mastery level before this action's xp), else loses
// 1 durability; at 0 it goes blunt (kept, mines by hand until repaired). Only pickaxe actions earn mastery xp; one
// press counts one mine. Hits carry over (batch 32): each rock that breaks drops its item and rolls the next rock from
// veinWeights (one roll per break), and the press's remaining hits go into it, so one press can break several rocks.
// A drop that must be stored with storage full leaves its rock unbroken at full progress and the press's remaining
// hits are lost. A rock that needs a better pickaxe than the active one (iron: copper or better) is mined as a stone
// rock: stone's hits, drops stone. A kind set to Sell on dig never fails BAG_FULL: its drop is stored and sold at once
// (sellItem). The mine worker presses it with `energy` 0.
export function dig(state: GameState, energy = ACTION_ENERGY_COST): ActionResult {
  const { run } = state
  if (!run.mineLicense) return fail('NO_MINE_LICENSE')
  const pickaxe = activePickaxe(run)
  const tier = pickaxe?.tier ?? null
  if (breakDrop(run, minedRock(run.vein.rock, tier)) === 'full') return fail('BAG_FULL')
  if (run.energy < energy) return fail('NO_ENERGY')
  const [keep, rngState] = pickaxe ? nextRandom(run.rngState) : [1, run.rngState]
  const used = pickaxe && keep >= pickaxePreserve(pickaxe.tier, run)
  let s = okState(
    withRun(state, {
      energy: run.energy - energy,
      rngState,
      rack: pickaxe && used ? { ...run.rack, [pickaxe.tier]: pickaxe.durability - 1 } : run.rack,
      counters: { ...run.counters, mines: run.counters.mines + 1 },
      lifetime: addLifetime(run, energy, 0),
      ...(pickaxe && gainMastery(run, pickaxe.tier)),
    }),
  )
  const weights = veinWeights(run.vein.level, run.masteredTiers.length)
  let hits = run.vein.progress + mineHits(tier)
  for (;;) {
    const { vein } = s.run
    const rock = minedRock(vein.rock, tier)
    const need = rockHits(rock)
    const drop = hits >= need ? breakDrop(s.run, rock) : null
    if (!drop || drop === 'full') return withRun(s, { vein: { ...vein, progress: drop ? need : hits } })
    const [r, next] = nextRandom(s.run.rngState)
    s = okState(withRun(s, { rngState: next, vein: { ...vein, progress: 0, rock: pickDrop(weights, r) }, inventory: addItems(s.run, rock, 1) }))
    if (drop === 'sell') s = okState(sellItem(s, rock, 1))
    hits -= need
  }
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

// Repair pays the tier's repair price (wood, bars) for that rack tier only (default: the selected one).
// Order: NO_PICKAXE, NOT_BLUNT, NOT_ENOUGH_ITEMS, NO_CASH. No energy; back to full durability.
export function repairPickaxe(state: GameState, tier: PickaxeTier | null = state.run.selectedPickaxe): ActionResult {
  const { rack } = state.run
  const durability = tier ? rack[tier] : undefined
  if (!tier || durability === undefined) return fail('NO_PICKAXE')
  if (durability > 0) return fail('NOT_BLUNT')
  return pay(state, pickaxeRepairCost(tier, state.meta), { rack: { ...rack, [tier]: pickaxeDurability(tier) } })
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
  const { vein, furnace } = state.run
  const next = vein.level + 1
  const best = bestPickaxeTier(state.run)
  // Lv4 drops gold rocks, which only the iron pickaxe or better breaks as gold (anything less mines them as stone)
  const blocked =
    veinNeedsFurnace(next) && !furnace.built ? 'NO_FURNACE' : veinNeedsPickaxe(next) && best !== 'iron' && best !== 'gold' ? 'NO_IRON_PICKAXE' : null
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
