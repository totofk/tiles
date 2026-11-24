import { addLifetime, fail, isAmount, nextRandom, withRun, type ActionError, type ActionResult } from './actions'
import {
  ACTION_ENERGY_COST,
  FLOOR_COLS,
  FLOOR_ROWS,
  floorWeights,
  floorZone,
  isSellable,
  itemSellPrice,
  keepNCost,
  masteryLevel,
  masteryMaxLevel,
  MINE_BOTTOM_FLOOR,
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
  sealFloor,
  storageCost,
  storageMaxLevel,
  storageSlotsPerLevel,
  veinNeedsFurnace,
  veinNeedsPickaxe,
  veinUpgradeCost,
  veinWeights,
  woodCost,
  zoneFirstFloor,
  type MineDropId,
  type Price,
} from './balance'
import { ITEMS, ITEM_IDS, PICKAXE_TIERS, type BarId, type ItemId, type OreId, type PickaxeTier } from './data/items'
import { noMine } from './wetlands'
import { spendEnergy } from './relics'
import type { FloorRock, GameState, Pickaxe, RunState } from './state'

// Mining actions cost no energy except dig (the mine action). Every item, wood included, takes one storage slot.

export function bagCount(run: RunState): number {
  return ITEM_IDS.reduce((n, id) => n + (run.inventory[id] ?? 0), 0)
}

function addItems(run: RunState, id: ItemId, n: number): RunState['inventory'] {
  return { ...run.inventory, [id]: (run.inventory[id] ?? 0) + n }
}

/** "⛰️ Stone 80 % · ⚫ Coal 20 %" — the shared rendering of a weights table */
function weightsText(weights: Partial<Record<ItemId, number>>): string {
  const total = ITEM_IDS.reduce((sum, id) => sum + (weights[id] ?? 0), 0)
  return ITEM_IDS.filter((id) => (weights[id] ?? 0) > 0)
    .map((id) => `${ITEMS[id].emoji} ${ITEMS[id].name} ${Math.round(((weights[id] ?? 0) / total) * 100)} %`)
    .join(' · ')
}

/** the miners' vein table: `mastered` tiers' ore bonus and the Seam aim (the weights dig rolls from) */
export function dropText(level: number, mastered: number, aim: OreId | null = null): string {
  return weightsText(veinWeights(level, mastered, aim))
}

/** batch 37: the floor's own table — the zone's base lifted by the floor's ore gradient (the weights rocks roll from) */
export function floorDropText(n: number, mastered: number, aim: OreId | null = null): string {
  return weightsText(floorWeights(n, mastered, aim))
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

/** batch 37.1: `count` fresh rocks from the floor's weights, one nextRandom draw each — the per-rock draw rollFloor
 * makes (the save v37 → v38 migration appends the 4th row with it). Consumes `count` draws. */
export function rollRocks(n: number, mastered: number, aim: OreId | null, rng: number, count: number): { rocks: FloorRock[]; rng: number } {
  const weights = floorWeights(n, mastered, aim)
  const rocks: FloorRock[] = []
  let stream = rng
  for (let i = 0; i < count; i++) {
    const [r, next] = nextRandom(stream)
    rocks.push({ kind: pickDrop(weights, r), hits: 0, broken: false })
    stream = next
  }
  return { rocks, rng: stream }
}

/** batch 37: roll a fresh floor grid — FLOOR_COLS × FLOOR_ROWS rocks (or `count`: the save migrations roll the frozen
 * grid size of the version they build) from the floor's weights, then hide the ⬇️ ladder under one of them (uniform).
 * Consumes count + 1 draws from the floor's own stream. */
export function rollFloor(n: number, mastered: number, aim: OreId | null, rng: number, count = FLOOR_COLS * FLOOR_ROWS): { rocks: FloorRock[]; ladder: number; rng: number } {
  const rolled = rollRocks(n, mastered, aim, rng, count)
  const [r, next] = nextRandom(rolled.rng)
  return { rocks: rolled.rocks, ladder: Math.floor(r * count), rng: next }
}

export function buyMineLicense(state: GameState): ActionResult {
  const { run } = state
  if (run.mineLicense) return fail('ALREADY_OWNED')
  if (run.listing.district === 'wetlands') return fail('LOCKED')
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
// stays in run.mastery. Order: NO_MINE_LICENSE (a no-mine run only, 36.3), ALREADY_OWNED (on the rack, any
// durability), NOT_ENOUGH_ITEMS, NO_CASH. No energy.
export function craftPickaxe(state: GameState, tier: PickaxeTier = 'wooden'): ActionResult {
  const { run } = state
  if (noMine(run)) return fail('NO_MINE_LICENSE')
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

/** what breaking a rock of `rock` does to its drop: stored, sold at once, or nothing (storage full). A kind set to Sell
 * on dig is stored only below its Keep N amount, or (batch 35.2) whenever an accepted, unfilled order asks for it, with
 * room left, else sold — it never reports full */
function breakDrop(run: RunState, rock: ItemId): 'store' | 'sell' | 'full' {
  const room = bagCount(run) < run.bagCapacity
  if ((run.oreSort as Partial<Record<ItemId, string>>)[rock] === 'sell') {
    const keep = run.keepN ? ((run.oreKeep as Partial<Record<ItemId, number>>)[rock] ?? 0) : 0
    return room && ((run.inventory[rock] ?? 0) < keep || orderNeed(run, rock) > 0) ? 'store' : 'sell'
  }
  return room ? 'store' : 'full'
}

/** batch 37: the per-press bookkeeping dig and mineRock share — energy spend, the preserve roll on run.rngState,
 * durability, counters.mines, lifetime and mastery. Nothing floor-specific happens here. */
function pressSetup(state: GameState, energy: number): ActionResult {
  const { run } = state
  const pickaxe = activePickaxe(run)
  const spent = spendEnergy(run, energy)
  if (!spent) return fail('NO_ENERGY')
  const [keep, rngState] = pickaxe ? nextRandom(run.rngState) : [1, run.rngState]
  const used = pickaxe && keep >= pickaxePreserve(pickaxe.tier, run)
  return withRun(state, {
    energy: spent.energy,
    energyReserve: spent.energyReserve,
    rngState,
    rack: pickaxe && used ? { ...run.rack, [pickaxe.tier]: pickaxe.durability - 1 } : run.rack,
    counters: { ...run.counters, mines: run.counters.mines + 1 },
    lifetime: addLifetime(run, energy, 0),
    ...(pickaxe && gainMastery(run, pickaxe.tier)),
  })
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
  const pressed = pressSetup(state, energy)
  if (!pressed.ok) return pressed
  let s = okState(pressed)
  const weights = veinWeights(minerZone(run), run.masteredTiers.length, run.favours.aim)
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

/** batch 37: the zone the mine workers dig — the picked zone, else the deepest (vein.level, today's behaviour) */
export function minerZone(run: RunState): number {
  return run.minerZone ?? run.vein.level
}

/** batch 37: the open row of a floor grid — the first row that still has an unbroken rock (rows open in order);
 * FLOOR_ROWS when every rock is broken (the breaking press re-rolls the floor before anyone looks) */
export function openRow(rocks: FloorRock[]): number {
  for (let row = 0; row < FLOOR_ROWS; row++) {
    for (let col = 0; col < FLOOR_COLS; col++) if (!rocks[row * FLOOR_COLS + col].broken) return row
  }
  return FLOOR_ROWS
}

// The player's floor press (batch 37). Validates in this order: NO_MINE_LICENSE, BAD_TILE (`i` not an unbroken rock
// of the open row; default = the open row's first unbroken rock), BAG_FULL (that rock's drop), NO_ENERGY. Then the
// shared pressSetup bookkeeping. The target rock takes mineHits(tier); a rock the pickaxe is too weak for is mined
// as stone (minedRock), as in dig. Carry-over: leftover hits go to the next unbroken rock of the open row left to
// right, then into the next row once it opens — one press can clear a row. Breaking the ladder rock sets found (its
// item still drops). A drop that hits full storage leaves its rock unbroken at full progress and the remaining hits
// are lost. When all FLOOR_COLS × FLOOR_ROWS rocks break, the floor re-rolls in place from floor.rng (same n; found
// stays found, R4) and the leftover hits continue on the fresh grid.
export function mineRock(state: GameState, i?: number): ActionResult {
  const { run } = state
  if (!run.mineLicense) return fail('NO_MINE_LICENSE')
  const row = openRow(run.floor.rocks)
  const open = run.floor.rocks.flatMap((rock, k) => (k >= row * FLOOR_COLS && k < (row + 1) * FLOOR_COLS && !rock.broken ? [k] : []))
  const target = i === undefined ? open[0] : open.includes(i) ? i : -1
  if (target < 0) return fail('BAD_TILE')
  const tier = activePickaxe(run)?.tier ?? null
  if (breakDrop(run, minedRock(run.floor.rocks[target].kind, tier)) === 'full') return fail('BAG_FULL')
  const pressed = pressSetup(state, ACTION_ENERGY_COST)
  if (!pressed.ok) return pressed
  let s = okState(pressed)
  let hits = run.floor.rocks[target].hits + mineHits(tier)
  let next = target
  for (;;) {
    const { floor } = s.run
    const rock = floor.rocks[next]
    const kind = minedRock(rock.kind, tier)
    const need = rockHits(kind)
    const drop = hits >= need ? breakDrop(s.run, kind) : null
    if (!drop || drop === 'full') {
      const progress = drop ? need : hits
      return withRun(s, { floor: { ...floor, rocks: floor.rocks.map((r, k) => (k === next ? { ...r, hits: progress } : r)) } })
    }
    const found = floor.found || next === floor.ladder
    let rocks = floor.rocks.map((r, k) => (k === next ? { ...r, broken: true, hits: 0 } : r))
    let { rng, ladder } = floor
    if (rocks.every((r) => r.broken)) {
      // R4: the emptied floor re-rolls in place; a found ladder stays found
      const rolled = rollFloor(floor.n, s.run.masteredTiers.length, s.run.favours.aim, rng)
      rocks = rolled.rocks
      ladder = rolled.ladder
      rng = rolled.rng
    }
    s = okState(withRun(s, { floor: { ...floor, rocks, ladder, rng, found }, inventory: addItems(s.run, kind, 1) }))
    if (drop === 'sell') s = okState(sellItem(s, kind, 1))
    hits -= need
    const nextRow = openRow(s.run.floor.rocks)
    const open2 = s.run.floor.rocks.flatMap((rock2, k) => (k >= nextRow * FLOOR_COLS && k < (nextRow + 1) * FLOOR_COLS && !rock2.broken ? [k] : []))
    next = open2[0]
  }
}

// Batch 37: down the found ladder. NO_LADDER, MINE_BOTTOM (floor 25), SEALED (the floor below is a zone's first
// floor past the seals broken). Else one floor down, deepest = max, a fresh grid, found false. No energy.
export function descend(state: GameState): ActionResult {
  const { run } = state
  const { floor } = run
  if (!floor.found) return fail('NO_LADDER')
  if (floor.n >= MINE_BOTTOM_FLOOR) return fail('MINE_BOTTOM')
  if (floorZone(floor.n + 1) > run.vein.level) return fail('SEALED')
  const rolled = rollFloor(floor.n + 1, run.masteredTiers.length, run.favours.aim, floor.rng)
  return withRun(state, { floor: { n: floor.n + 1, deepest: Math.max(floor.deepest, floor.n + 1), rocks: rolled.rocks, ladder: rolled.ladder, found: false, rng: rolled.rng } })
}

// Batch 37: break the 🔒 seal into the next zone (replaces the player's use of upgradeVein). NOT_AT_SEAL unless the
// ladder is found and n = sealFloor(vein.level + 1); then upgradeVein's checks and price unchanged (MAX_LEVEL,
// NO_FURNACE, NO_IRON_PICKAXE, NOT_ENOUGH_ITEMS, NO_CASH). Success = vein.level + 1 AND the player moves to the new
// zone's first floor on a fresh grid. upgradeVein itself stays exported for the tests.
export function breakSeal(state: GameState): ActionResult {
  const { run } = state
  const { floor, vein, furnace } = run
  const next = vein.level + 1
  if (!floor.found || floor.n !== sealFloor(next)) return fail('NOT_AT_SEAL')
  const best = bestPickaxeTier(run)
  const blocked = veinNeedsFurnace(next) && !furnace.built ? 'NO_FURNACE' : veinNeedsPickaxe(next) && best !== 'iron' && best !== 'gold' ? 'NO_IRON_PICKAXE' : null
  const bought = buyMineUpgrade(state, veinUpgradeCost(vein.level, state.meta), { vein: { ...vein, level: next } }, blocked)
  if (!bought.ok) return bought
  const s = okState(bought)
  const n = zoneFirstFloor(next)
  const rolled = rollFloor(n, s.run.masteredTiers.length, s.run.favours.aim, s.run.floor.rng)
  return withRun(s, { floor: { n, deepest: Math.max(s.run.floor.deepest, n), rocks: rolled.rocks, ladder: rolled.ladder, found: false, rng: rolled.rng } })
}

// Batch 37: the free elevator to a built checkpoint (a broken seal's zone first floor). LOCKED past the seals
// broken; BAD_SLOT as the free no-op guard when already standing there on an untouched grid; else a fresh grid at
// zoneFirstFloor(zone), found false. No energy.
export function rideElevator(state: GameState, zone: number): ActionResult {
  const { run } = state
  const { floor } = run
  if (!Number.isInteger(zone) || zone < 0 || zone > run.vein.level) return fail('LOCKED')
  const n = zoneFirstFloor(zone)
  if (floor.n === n && floor.rocks.every((r) => !r.broken)) return fail('BAD_SLOT')
  const rolled = rollFloor(n, run.masteredTiers.length, run.favours.aim, floor.rng)
  return withRun(state, { floor: { n, deepest: Math.max(floor.deepest, n), rocks: rolled.rocks, ladder: rolled.ladder, found: false, rng: rolled.rng } })
}

/** batch 37: point the mine workers at a built zone (null = Deepest); free */
export function setMinerZone(state: GameState, zone: number | null): ActionResult {
  if (zone !== null && !(Number.isInteger(zone) && zone >= 0 && zone <= state.run.vein.level)) return fail('LOCKED')
  return withRun(state, { minerZone: zone })
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

// 🧺 Keep N (batch 32): one purchase. Order: NO_MINE_LICENSE, LOCKED (vein below Lv3), ALREADY_OWNED,
// NOT_ENOUGH_ITEMS, NO_CASH. No energy.
export function buyKeepN(state: GameState): ActionResult {
  const { run } = state
  if (!run.mineLicense) return fail('NO_MINE_LICENSE')
  if (run.vein.level < oreSortVeinLevel()) return fail('LOCKED')
  if (run.keepN) return fail('ALREADY_OWNED')
  return pay(state, keepNCost(state.meta), { keepN: true })
}

/** the amount of an unlocked kind Sell on dig keeps in storage before it sells the excess; free, no energy. LOCKED
 * unless Keep N is owned and the kind unlocked; BAD_AMOUNT unless a whole number 0 … storage capacity */
export function setOreKeep(state: GameState, kind: MineDropId, n: number): ActionResult {
  const { run } = state
  if (!run.keepN || !run.oreSort[kind]) return fail('LOCKED')
  if (!Number.isInteger(n) || n < 0 || n > run.bagCapacity) return fail('BAD_AMOUNT')
  return withRun(state, { oreKeep: { ...run.oreKeep, [kind]: n } })
}

/** bars Keep N (batch 35.2): the amount of a bar storage keeps before the furnace's collect sells the excess; null =
 * off (keeps all). Free, no energy. LOCKED before the Tractor or without Keep N; BAD_AMOUNT unless a whole number 0 …
 * storage capacity */
export function setBarKeep(state: GameState, bar: BarId, n: number | null): ActionResult {
  const { run } = state
  if (!run.fields.unlocked || !run.keepN) return fail('LOCKED')
  if (n === null) {
    const barKeep = { ...run.barKeep }
    delete barKeep[bar]
    return withRun(state, { barKeep })
  }
  if (!Number.isInteger(n) || n < 0 || n > run.bagCapacity) return fail('BAD_AMOUNT')
  return withRun(state, { barKeep: { ...run.barKeep, [bar]: n } })
}

/** units of `good` the accepted item orders still need (count − done, summed over the board) */
export function orderNeed(run: RunState, good: ItemId): number {
  return run.orders.offers.reduce((n, s) => ('good' in s && s.accepted && s.good === good ? n + s.count - s.done : n), 0)
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

// Mine upgrades pay items from storage plus cash, no energy. Order: NO_MINE_LICENSE (unless `licensed`), MAX_LEVEL
// (cost null), `blocked` (a missing building), NOT_ENOUGH_ITEMS, NO_CASH.
function buyMineUpgrade(
  state: GameState,
  cost: Price | null,
  gain: Partial<RunState>,
  blocked: ActionError | null = null,
  licensed = state.run.mineLicense,
): ActionResult {
  if (!licensed) return fail('NO_MINE_LICENSE')
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

/** next storage level: +storageSlotsPerLevel() capacity; a no-mine run needs no licence (stone comes from the barge) */
export function buyStorage(state: GameState): ActionResult {
  const { run } = state
  const cost = run.storageLevel < storageMaxLevel() ? storageCost(run.storageLevel, state.meta) : null
  const gain = { storageLevel: run.storageLevel + 1, bagCapacity: run.bagCapacity + storageSlotsPerLevel() }
  return buyMineUpgrade(state, cost, gain, null, run.mineLicense || noMine(run))
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
