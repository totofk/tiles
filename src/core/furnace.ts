import { fail, withRun, type ActionResult } from './actions'
import { barTicks, furnaceCost, furnaceQueueCap, furnaceVeinLevel, smeltFuel, smeltOre, type FuelId } from './balance'
import { bagCount, pay } from './mining'
import type { Furnace, GameState } from './state'

// The furnace is a machine: building, smelting and collecting cost no energy, and it rolls no RNG.

// Order: ALREADY_OWNED, LOCKED (vein below furnaceVeinLevel), NOT_ENOUGH_ITEMS, NO_CASH.
export function buildFurnace(state: GameState): ActionResult {
  const { run } = state
  if (run.furnace.built) return fail('ALREADY_OWNED')
  if (run.vein.level < furnaceVeinLevel()) return fail('LOCKED')
  return pay(state, furnaceCost(state.meta), { furnace: { ...run.furnace, built: true } })
}

// One job, inputs paid now (they leave storage). Full = queued jobs + tray bars at the cap, so the tray can never
// outgrow it. Order: NO_FURNACE, QUEUE_FULL, NOT_ENOUGH_ORE, NOT_ENOUGH_FUEL.
export function enqueueSmelt(state: GameState, fuel: FuelId): ActionResult {
  const { run } = state
  const f = run.furnace
  if (!f.built) return fail('NO_FURNACE')
  if (f.queue + f.ready >= furnaceQueueCap()) return fail('QUEUE_FULL')
  const ore = smeltOre()
  const burn = smeltFuel(fuel)
  if ((run.inventory.copperOre ?? 0) < ore) return fail('NOT_ENOUGH_ORE')
  if ((run.inventory[fuel] ?? 0) < burn) return fail('NOT_ENOUGH_FUEL')
  const inventory = { ...run.inventory, copperOre: run.inventory.copperOre! - ore, [fuel]: run.inventory[fuel]! - burn }
  return withRun(state, { inventory, furnace: { ...f, queue: f.queue + 1 } })
}

/**
 * Closed form for any tick count, so one call over n ticks equals n calls of 1 (offline catch-up included):
 * t = progress + ticks; done = min(queue, ⌊t / barTicks⌋); progress = t mod barTicks while jobs remain, else 0.
 */
export function advanceFurnace(f: Furnace, ticks: number): Furnace {
  if (f.queue === 0 || ticks <= 0) return f
  const t = f.progress + ticks
  const done = Math.min(f.queue, Math.floor(t / barTicks()))
  const queue = f.queue - done
  return { ...f, queue, ready: f.ready + done, progress: queue > 0 ? t - done * barTicks() : 0 }
}

/** the auto-smelt toggle; free, needs the furnace */
export function setAutoSmelt(state: GameState, on: boolean): ActionResult {
  if (!state.run.furnace.built) return fail('NO_FURNACE')
  return withRun(state, { autoSmelt: on })
}

/**
 * Runs inside step() after the furnace advanced, when the toggle is on: collects the tray into storage (as much as
 * fits), then queues coal jobs while ore, coal and room last. Coal only, so wood kept for repairs is never burnt.
 * Uses only what is already in storage; deterministic, no RNG.
 */
export function autoSmelt(state: GameState): GameState {
  if (!state.run.autoSmelt) return state
  const collected = collectBars(state)
  let s = collected.ok ? collected.state : state
  for (let r = enqueueSmelt(s, 'coal'); r.ok; r = enqueueSmelt(s, 'coal')) s = r.state
  return s
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
    lifetime: { ...run.lifetime, bars: run.lifetime.bars + n },
  })
}
