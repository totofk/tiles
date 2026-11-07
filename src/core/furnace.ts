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
  oreSlotCap,
  smeltOre,
  type FuelId,
  type FurnaceUpgradeId,
} from './balance'
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

/** Moves copper ore from storage into the ore slot, as much as fits, at most `max`. Order: NO_FURNACE, FULL, NO_ORE. */
export function loadOre(state: GameState, max = Infinity): ActionResult {
  const { run } = state
  const f = run.furnace
  if (!f.built) return fail('NO_FURNACE')
  const room = oreSlotCap() - f.ore
  if (room < 1) return fail('FULL')
  const n = Math.min(room, run.inventory.copperOre ?? 0, max)
  if (n < 1) return fail('NO_ORE')
  return withRun(state, { inventory: { ...run.inventory, copperOre: run.inventory.copperOre! - n }, furnace: { ...f, ore: f.ore + n } })
}

/** a cycle progresses this tick: fire lit, a cycle's ore in the slot, tray room for its bars */
export function smelting(f: Furnace): boolean {
  return f.fire > 0 && f.ore >= cycleOre(f) && f.ready + batchBars(f.levels.batch) <= furnaceTrayCap()
}

/**
 * One tick inside step(). A plain furnace burns a tick of fire whenever it is lit, ore or not (wasted when no cycle
 * progresses); a smart one burns only while smelting. A completed cycle takes its ore and adds batch bars to the tray.
 * Called once per tick, so step(s, n) equals n × step(s, 1) by construction.
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
  const done = progress >= barTicks()
  const bars = done ? batchBars(f.levels.batch) : 0
  return {
    ...run,
    furnace: {
      ...f,
      fire: f.fire - 1,
      progress: done ? 0 : progress,
      ore: done ? f.ore - cycleOre(f) : f.ore,
      ready: f.ready + bars,
    },
    lifetime: { ...lifetime, fireBurnt: lifetime.fireBurnt + 1, barsSmelted: lifetime.barsSmelted + bars },
  }
}

// Moves as many tray bars into storage as fit. Order: NO_FURNACE, NOTHING_TO_DO (tray empty), BAG_FULL.
export function collectBars(state: GameState): ActionResult {
  const { run } = state
  const f = run.furnace
  if (!f.built) return fail('NO_FURNACE')
  if (f.ready === 0) return fail('NOTHING_TO_DO')
  const n = Math.min(f.ready, run.bagCapacity - bagCount(run))
  if (n <= 0) return fail('BAG_FULL')
  return withRun(state, {
    inventory: { ...run.inventory, copperBar: (run.inventory.copperBar ?? 0) + n },
    furnace: { ...f, ready: f.ready - n },
    counters: { ...run.counters, bars: run.counters.bars + n },
    lifetime: { ...run.lifetime, bars: run.lifetime.bars + n },
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
