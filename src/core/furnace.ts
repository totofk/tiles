import { fail, withRun, type ActionResult } from './actions'
import {
  barTicks,
  batchBars,
  fireCapTicks,
  fuelTicks,
  furnaceCost,
  furnaceSpeedRate,
  furnaceTrayCap,
  furnaceUpgradeCost,
  furnaceVeinLevel,
  moldPrice,
  oreBar,
  oreSlotCap,
  smeltOre,
  type FuelId,
  type FurnaceUpgradeId,
  type MoldOre,
} from './balance'
import { ORE_IDS, type OreId } from './data/items'
import { bagCount, pay } from './mining'
import type { Furnace, GameState, Lifetime, Mold, RunState } from './state'

// The furnace is a machine: building, fuelling, loading and collecting cost no energy, and it rolls no RNG.

// Order: ALREADY_OWNED, LOCKED (vein below furnaceVeinLevel), NOT_ENOUGH_ITEMS, NO_CASH.
export function buildFurnace(state: GameState): ActionResult {
  const { run } = state
  if (run.furnace.built) return fail('ALREADY_OWNED')
  if (run.vein.level < furnaceVeinLevel()) return fail('LOCKED')
  return pay(state, furnaceCost(state.meta), { furnace: { ...run.furnace, built: true } })
}

/** ore one cycle needs at the furnace's batch level */
export function cycleOre(f: Furnace): number {
  return smeltOre() * batchBars(f.levels.batch)
}

/** whole items of this fuel that fit under the fire cap now */
export function fuelRoom(f: Furnace, fuel: FuelId): number {
  return Math.floor((fireCapTicks(f.levels.fireCap) - f.fire) / fuelTicks(fuel))
}

/**
 * The "fill" press: moves as many whole items of this fuel from storage into the fire as fit under the cap (never
 * over it), at most `max`; partial when storage runs short. Order: NO_FURNACE, FULL, NO_FUEL.
 */
export function addFuel(state: GameState, fuel: FuelId, max = Infinity): ActionResult {
  const { run } = state
  const f = run.furnace
  if (!f.built) return fail('NO_FURNACE')
  const room = fuelRoom(f, fuel)
  if (room < 1) return fail('FULL')
  const n = Math.min(room, run.inventory[fuel] ?? 0, max)
  if (n < 1) return fail('NO_FUEL')
  return withRun(state, {
    inventory: { ...run.inventory, [fuel]: run.inventory[fuel]! - n },
    furnace: { ...f, fire: f.fire + n * fuelTicks(fuel) },
  })
}

const withMold = (f: Furnace, ore: OreId, mold: Mold): Furnace => ({ ...f, molds: { ...f.molds, [ore]: mold } })

/**
 * Moves ore of this kind from storage into its mold's slot, as much as fits, at most `max`.
 * Order: NO_FURNACE, LOCKED (mold not owned), FULL, NO_ORE.
 */
export function loadOre(state: GameState, ore: OreId, max = Infinity): ActionResult {
  const { run } = state
  const f = run.furnace
  if (!f.built) return fail('NO_FURNACE')
  const mold = f.molds[ore]
  if (!mold) return fail('LOCKED')
  const room = oreSlotCap(f.levels.slot) - mold.ore
  if (room < 1) return fail('FULL')
  const n = Math.min(room, run.inventory[ore] ?? 0, max)
  if (n < 1) return fail('NO_ORE')
  return withRun(state, { inventory: { ...run.inventory, [ore]: run.inventory[ore]! - n }, furnace: withMold(f, ore, { ...mold, ore: mold.ore + n }) })
}

/** this mold progresses this tick: owned, fire lit, a cycle's ore in its slot, tray room for its bars */
export function moldSmelting(f: Furnace, ore: OreId): boolean {
  const mold = f.molds[ore]
  return mold !== undefined && f.fire > 0 && mold.ore >= cycleOre(f) && mold.ready + batchBars(f.levels.batch) <= furnaceTrayCap(f.levels.tray)
}

const SMELTED: Record<OreId, 'barsSmelted' | 'ironBarsSmelted' | 'goldBarsSmelted'> = { copperOre: 'barsSmelted', ironOre: 'ironBarsSmelted', goldOre: 'goldBarsSmelted' }

/**
 * One tick inside step(). Every smelting mold (copper → iron → gold) burns the speed rate of the shared fire (what is
 * left) and advances its cycle by it; a completed cycle (its kind's barTicks) takes its ore, adds batch bars to its
 * tray and carries the overflow into the next one. With no mold smelting a plain furnace still burns a tick of fire
 * (wasted), a smart one nothing. Called once per tick, so step(s, n) equals n × step(s, 1) by construction.
 */
export function tickFurnace(run: RunState): RunState {
  let f = run.furnace
  if (f.fire <= 0) return run
  const lifetime: Lifetime = { ...run.lifetime }
  const rate = furnaceSpeedRate(f.levels.speed)
  let smelted = false
  for (const ore of ORE_IDS) {
    if (!moldSmelting(f, ore)) continue
    smelted = true
    const mold = f.molds[ore]!
    const burn = Math.min(f.fire, rate)
    lifetime.fireBurnt += burn
    let progress = mold.progress + burn
    const done = progress >= barTicks(ore)
    if (done) progress -= barTicks(ore)
    const bars = done ? batchBars(f.levels.batch) : 0
    lifetime[SMELTED[ore]] += bars
    f = withMold({ ...f, fire: f.fire - burn }, ore, { ore: done ? mold.ore - cycleOre(f) : mold.ore, progress, ready: mold.ready + bars })
  }
  if (smelted) return { ...run, furnace: f, lifetime }
  if (f.smart) return run
  const burn = Math.min(f.fire, 1)
  return {
    ...run,
    furnace: { ...f, fire: f.fire - burn },
    lifetime: { ...lifetime, fireBurnt: lifetime.fireBurnt + burn, fireWasted: lifetime.fireWasted + burn },
  }
}

const COLLECTED: Record<OreId, 'bars' | 'ironBars' | 'goldBars'> = { copperOre: 'bars', ironOre: 'ironBars', goldOre: 'goldBars' }

// Moves as many of this mold's tray bars into storage as fit. The bars counter (the loader certificates' gate) and
// lifetime.bars count copper bars; iron and gold bars count in lifetime.ironBars / goldBars. Order: NO_FURNACE, LOCKED
// (mold not owned), NOTHING_TO_DO (tray empty), BAG_FULL.
export function collectBars(state: GameState, ore: OreId): ActionResult {
  const { run } = state
  const f = run.furnace
  if (!f.built) return fail('NO_FURNACE')
  const mold = f.molds[ore]
  if (!mold) return fail('LOCKED')
  if (mold.ready === 0) return fail('NOTHING_TO_DO')
  const n = Math.min(mold.ready, run.bagCapacity - bagCount(run))
  if (n <= 0) return fail('BAG_FULL')
  const bar = oreBar(ore)
  const key = COLLECTED[ore]
  return withRun(state, {
    inventory: { ...run.inventory, [bar]: (run.inventory[bar] ?? 0) + n },
    furnace: withMold(f, ore, { ...mold, ready: mold.ready - n }),
    counters: ore === 'copperOre' ? { ...run.counters, bars: run.counters.bars + n } : run.counters,
    lifetime: { ...run.lifetime, [key]: run.lifetime[key] + n },
  })
}

// Collect all (bought once): every owned mold's tray, copper → iron → gold, as far as storage room goes.
// Order: NO_FURNACE, LOCKED (not bought), NOTHING_TO_DO (every tray empty), BAG_FULL (nothing fit).
export function collectAll(state: GameState): ActionResult {
  const f = state.run.furnace
  if (!f.built) return fail('NO_FURNACE')
  if (!f.collectAll) return fail('LOCKED')
  if (!ORE_IDS.some((ore) => (f.molds[ore]?.ready ?? 0) > 0)) return fail('NOTHING_TO_DO')
  let s = state
  for (const ore of ORE_IDS) {
    const r = collectBars(s, ore)
    if (r.ok) s = r.state
  }
  return s === state ? fail('BAG_FULL') : { ok: true, state: s }
}

// The iron or gold mold, bought once from storage + cash. Order: NO_FURNACE, ALREADY_OWNED (copper always is),
// NOT_ENOUGH_ITEMS, NO_CASH.
export function buyMold(state: GameState, ore: OreId): ActionResult {
  const f = state.run.furnace
  if (!f.built) return fail('NO_FURNACE')
  if (ore === 'copperOre' || f.molds[ore]) return fail('ALREADY_OWNED')
  return pay(state, moldPrice(ore as MoldOre, state.meta), { furnace: withMold(f, ore, { ore: 0, progress: 0, ready: 0 }) })
}

/** levels bought of this furnace upgrade (smart, collectAll: 0 or 1) */
export function furnaceUpgradeLevel(f: Furnace, id: FurnaceUpgradeId): number {
  return id === 'smart' ? Number(f.smart) : id === 'collectAll' ? Number(f.collectAll) : f.levels[id]
}

/**
 * true while the next batch level needs a bigger tray and ore slot: from batch Lv3 (4 bars) on, every mold's tray must
 * hold two of the new batches and its slot two of the new cycles. Levels 1–2 have no lock (the base tray holds 5 < 2 × 3).
 */
export function batchLocked(f: Furnace): boolean {
  const next = f.levels.batch + 1
  if (next < 3) return false
  const bars = batchBars(next)
  return furnaceTrayCap(f.levels.tray) < 2 * bars || oreSlotCap(f.levels.slot) < 2 * smeltOre() * bars
}

// One level up (smart, collectAll: once). Paid in items + cash from storage, no energy.
// Order: NO_FURNACE, MAX_LEVEL, LOCKED (batch: tray / ore slot too small), NOT_ENOUGH_ITEMS, NO_CASH.
export function buyFurnaceUpgrade(state: GameState, id: FurnaceUpgradeId): ActionResult {
  const f = state.run.furnace
  if (!f.built) return fail('NO_FURNACE')
  const cost = furnaceUpgradeCost(id, furnaceUpgradeLevel(f, id), state.meta)
  if (!cost) return fail('MAX_LEVEL')
  if (id === 'batch' && batchLocked(f)) return fail('LOCKED')
  const furnace: Furnace =
    id === 'smart' ? { ...f, smart: true } : id === 'collectAll' ? { ...f, collectAll: true } : { ...f, levels: { ...f.levels, [id]: f.levels[id] + 1 } }
  return pay(state, cost, { furnace })
}
