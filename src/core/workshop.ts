// Workshop + sprinklers (batch 17, DECISIONS "Workshop + sprinklers"). The shop purchases and the machines'
// per-tick run: sprinklersAct is called at the very start of stepOnce, before the workers, so a machine's watering
// lands before the water worker picks targets (a covered farm leaves it nothing due, if the player still staffs it).
import { fail, withRun, type ActionResult } from './actions'
import {
  sprinklerCoalTicks,
  sprinklerCost,
  sprinklerHopper,
  sprinklerMax,
  sprinklerTiles,
  valveCost,
  waterMoisture,
  workerActionTicks,
  workshopCost,
  workshopVeinLevel,
} from './balance'
import { pay } from './mining'
import type { GameState, RunState, Tile } from './state'
import { isMature } from './tile'

/** the tiles a sprinkler may water: planted, with a crop, not yet mature */
function waterable(tile: Tile, s: GameState): boolean {
  return tile.status === 'planted' && !!tile.cropId && !isMature(tile, s)
}

// Order: LOCKED, ALREADY_OWNED, NOT_ENOUGH_ITEMS, NO_CASH.
export function buildWorkshop(state: GameState): ActionResult {
  const { run } = state
  if (run.vein.level < workshopVeinLevel()) return fail('LOCKED')
  if (run.workshop.built) return fail('ALREADY_OWNED')
  return pay(state, workshopCost(state.meta), { workshop: { ...run.workshop, built: true } })
}

// Order: NO_WORKSHOP, MAX_LEVEL, NOT_ENOUGH_ITEMS, NO_CASH. The machine arrives with an empty hopper — the fuel
// loader fills it from storage, exactly as it feeds the furnace.
export function buySprinkler(state: GameState): ActionResult {
  const { run } = state
  if (!run.workshop.built) return fail('NO_WORKSHOP')
  if (run.workshop.hoppers.length >= sprinklerMax()) return fail('MAX_LEVEL')
  return pay(state, sprinklerCost(state.meta), { workshop: { ...run.workshop, hoppers: [...run.workshop.hoppers, 0] } })
}

// Order: NO_WORKSHOP, ALREADY_OWNED, NOT_ENOUGH_ITEMS, NO_CASH.
export function buyValve(state: GameState): ActionResult {
  const { run } = state
  if (!run.workshop.built) return fail('NO_WORKSHOP')
  if (run.workshop.valve) return fail('ALREADY_OWNED')
  return pay(state, valveCost(state.meta), { workshop: { ...run.workshop, valve: true } })
}

// Order: NO_WORKSHOP, FULL, NO_FUEL. Moves `amount` coal (default 1, the loader's pace) from storage into the
// machine's hopper, capped by the hopper's room and the coal in storage.
export function fillHopper(state: GameState, machine: number, amount = 1): ActionResult {
  const { run } = state
  if (!run.workshop.built) return fail('NO_WORKSHOP')
  const hopper = run.workshop.hoppers[machine]
  if (hopper === undefined) return fail('FULL')
  const room = sprinklerHopper() - hopper
  if (room < 1) return fail('FULL')
  const coal = run.inventory.coal ?? 0
  if (coal < 1) return fail('NO_FUEL')
  const n = Math.min(amount, room, coal)
  return withRun(state, {
    inventory: { ...run.inventory, coal: coal - n },
    workshop: { ...run.workshop, hoppers: run.workshop.hoppers.map((h, i) => (i === machine ? h + n : h)) },
  })
}

/**
 * The tiles machine `machine` waters on its next action: the driest waterable tiles below the iron-can fill,
 * machine after machine (machine 1 takes the 6 driest, machine 2 the next 6), skipping dry machines. A machine
 * with an empty hopper takes no chunk, so its tiles are the ones the next machine picks up.
 */
export function sprinklerTargets(state: GameState, machine: number): number[] {
  const fill = waterMoisture(2)
  if ((state.run.workshop.hoppers[machine] ?? 0) < 1) return []
  let pool = state.run.tiles
    .flatMap((t, i) => (waterable(t, state) && t.moisture < fill ? [i] : []))
    .sort((a, b) => state.run.tiles[a].moisture - state.run.tiles[b].moisture || a - b)
  for (let m = 0; m < machine; m++) {
    if ((state.run.workshop.hoppers[m] ?? 0) >= 1) pool = pool.slice(sprinklerTiles())
  }
  return pool.slice(0, sprinklerTiles())
}

/**
 * One tick of the machines, run at the start of stepOnce before the workers:
 * - on the worker clock (WORKER_ACTION_TICKS) every machine with coal waters its chunk to the iron-can fill;
 * - the coal pump burns 1 coal per machine every sprinklerCoalTicks while it has coal;
 * - with the valve, a machine out of coal holds every waterable tile below the fill at its current moisture for
 *   the tick (`held`; stepTile skips their drain but they keep growing). Held tiles never change, so the held set
 *   only grows until coal returns — no set to save, no tile left to drain dry.
 * Returns the run plus the held flags, index-aligned with run.tiles.
 */
export function sprinklersAct(state: GameState): { run: RunState; held: boolean[] } {
  const { run } = state
  const w = run.workshop
  const held = run.tiles.map(() => false)
  if (!w.built || w.hoppers.length === 0) return { run, held }
  const fill = waterMoisture(2)
  let tiles = run.tiles
  if (run.tick % workerActionTicks() === 0) {
    for (let m = 0; m < w.hoppers.length; m++) {
      if (w.hoppers[m] < 1) continue
      // tiles watered earlier this tick sit at the fill, so each machine's chunk falls out of the pool by itself
      const chunk = new Set(
        tiles
          .flatMap((t, i) => (waterable(t, state) && t.moisture < fill ? [i] : []))
          .sort((a, b) => tiles[a].moisture - tiles[b].moisture || a - b)
          .slice(0, sprinklerTiles()),
      )
      if (chunk.size === 0) break
      tiles = tiles.map((t, i) => (chunk.has(i) ? { ...t, moisture: fill } : t))
    }
  }
  if (w.valve && w.hoppers.some((h) => h < 1)) {
    tiles.forEach((t, i) => {
      if (waterable(t, state) && t.moisture < fill) held[i] = true
    })
  }
  const workshop = run.tick % sprinklerCoalTicks() === 0 ? { ...w, hoppers: w.hoppers.map((h) => (h >= 1 ? h - 1 : h)) } : w
  return { run: { ...run, tiles, workshop }, held }
}
