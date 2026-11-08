import { fail, withRun, type ActionResult } from './actions'
import {
  barTicks,
  batchBars,
  fireCapTicks,
  fuelTicks,
  furnaceCost,
  furnaceTrayCap,
  furnaceUpgradeCost,
  furnaceVeinLevel,
  oreBar,
  oreSlotCap,
  smeltOre,
  type FuelId,
  type FurnaceUpgradeId,
} from './balance'
import type { OreId } from './data/items'
import { bagCount, pay } from './mining'
import type { Furnace, GameState, RunState } from './state'

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

/**
 * Moves ore of the furnace's kind from storage into the ore slot, as much as fits, at most `max`.
 * Order: NO_FURNACE, FULL, NO_ORE.
 */
export function loadOre(state: GameState, max = Infinity): ActionResult {
  const { run } = state
  const f = run.furnace
  if (!f.built) return fail('NO_FURNACE')
  const room = oreSlotCap() - f.ore
  if (room < 1) return fail('FULL')
  const n = Math.min(room, run.inventory[f.oreKind] ?? 0, max)
  if (n < 1) return fail('NO_ORE')
  return withRun(state, { inventory: { ...run.inventory, [f.oreKind]: run.inventory[f.oreKind]! - n }, furnace: { ...f, ore: f.ore + n } })
}

/**
 * Picks the ore kind the slot takes (copper, iron or gold), free. Only with an empty slot and an empty tray, so ore and
 * the tray's bars are always of the kind shown. Order: NO_FURNACE, NOTHING_TO_DO (already that kind), NOT_EMPTY.
 */
export function setOreKind(state: GameState, oreKind: OreId): ActionResult {
  const f = state.run.furnace
  if (!f.built) return fail('NO_FURNACE')
  if (f.oreKind === oreKind) return fail('NOTHING_TO_DO')
  if (f.ore > 0 || f.ready > 0) return fail('NOT_EMPTY')
  return withRun(state, { furnace: { ...f, oreKind } })
}

/** a cycle progresses this tick: fire lit, a cycle's ore in the slot, tray room for its bars */
export function smelting(f: Furnace): boolean {
  return f.fire > 0 && f.ore >= cycleOre(f) && f.ready + batchBars(f.levels.batch) <= furnaceTrayCap()
}

/**
 * One tick inside step(). A plain furnace burns a tick of fire whenever it is lit, ore or not (wasted when no cycle
 * progresses); a smart one burns only while smelting. A completed cycle (the ore kind's barTicks) takes its ore and adds
 * batch bars to the tray. Called once per tick, so step(s, n) equals n × step(s, 1) by construction.
 */
export function tickFurnace(run: RunState): RunState {
  const f = run.furnace
  if (f.fire <= 0) return run
  const lifetime = run.lifetime
  if (!smelting(f)) {
    if (f.smart) return run
    return {
      ...run,
      furnace: { ...f, fire: f.fire - 1 },
      lifetime: { ...lifetime, fireBurnt: lifetime.fireBurnt + 1, fireWasted: lifetime.fireWasted + 1 },
    }
  }
  const progress = f.progress + 1
  const done = progress >= barTicks(f.oreKind)
  const bars = done ? batchBars(f.levels.batch) : 0
  const smelted =
    f.oreKind === 'ironOre'
      ? { ironBarsSmelted: lifetime.ironBarsSmelted + bars }
      : f.oreKind === 'goldOre'
        ? { goldBarsSmelted: lifetime.goldBarsSmelted + bars }
        : { barsSmelted: lifetime.barsSmelted + bars }
  return {
    ...run,
    furnace: {
      ...f,
      fire: f.fire - 1,
      progress: done ? 0 : progress,
      ore: done ? f.ore - cycleOre(f) : f.ore,
      ready: f.ready + bars,
    },
    lifetime: { ...lifetime, fireBurnt: lifetime.fireBurnt + 1, ...smelted },
  }
}

// Moves as many tray bars (of the ore kind's bar) into storage as fit. The bars counter (the loader certificates' gate)
// and lifetime.bars count copper bars; iron and gold bars count in lifetime.ironBars / goldBars. Order: NO_FURNACE,
// NOTHING_TO_DO (tray empty), BAG_FULL.
export function collectBars(state: GameState): ActionResult {
  const { run } = state
  const f = run.furnace
  if (!f.built) return fail('NO_FURNACE')
  if (f.ready === 0) return fail('NOTHING_TO_DO')
  const n = Math.min(f.ready, run.bagCapacity - bagCount(run))
  if (n <= 0) return fail('BAG_FULL')
  const bar = oreBar(f.oreKind)
  const copper = f.oreKind === 'copperOre'
  const collected = copper ? run.lifetime.bars : f.oreKind === 'ironOre' ? run.lifetime.ironBars : run.lifetime.goldBars
  return withRun(state, {
    inventory: { ...run.inventory, [bar]: (run.inventory[bar] ?? 0) + n },
    furnace: { ...f, ready: f.ready - n },
    counters: copper ? { ...run.counters, bars: run.counters.bars + n } : run.counters,
    lifetime: { ...run.lifetime, [copper ? 'bars' : f.oreKind === 'ironOre' ? 'ironBars' : 'goldBars']: collected + n },
  })
}

/** levels bought of this furnace upgrade (smart: 0 or 1) */
export function furnaceUpgradeLevel(f: Furnace, id: FurnaceUpgradeId): number {
  return id === 'smart' ? Number(f.smart) : f.levels[id]
}

// Fire capacity / batch: one level up; smart: once. Paid in bars + cash from storage, no energy.
// Order: NO_FURNACE, MAX_LEVEL, NOT_ENOUGH_ITEMS, NO_CASH.
export function buyFurnaceUpgrade(state: GameState, id: FurnaceUpgradeId): ActionResult {
  const f = state.run.furnace
  if (!f.built) return fail('NO_FURNACE')
  const cost = furnaceUpgradeCost(id, furnaceUpgradeLevel(f, id), state.meta)
  if (!cost) return fail('MAX_LEVEL')
  const furnace: Furnace = id === 'smart' ? { ...f, smart: true } : { ...f, levels: { ...f.levels, [id]: f.levels[id] + 1 } }
  return pay(state, cost, { furnace })
}
