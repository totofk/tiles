// Workshop + bed sprinklers (batch 17, permanent bed sockets since batch 26, DECISIONS "Workshop + sprinklers").
// A sprinkler is built on a bed's socket, is permanent, and its six tiles always hold full water — no upkeep, no
// coal. The smart valve stops the Fields' idle burn (batch 28).
import { fail, type ActionResult } from './actions'
import { sprinklerCost, sprinklerMax, valveCost, workshopCost, workshopVeinLevel } from './balance'
import { pay } from './mining'
import type { GameState, RunState } from './state'

/** every sprinkler glyph in the UI */
export const SPRINKLER_EMOJI = '⛲'

// Order: LOCKED, ALREADY_OWNED, NOT_ENOUGH_ITEMS, NO_CASH.
export function buildWorkshop(state: GameState): ActionResult {
  const { run } = state
  if (run.vein.level < workshopVeinLevel()) return fail('LOCKED')
  if (run.workshop.built) return fail('ALREADY_OWNED')
  return pay(state, workshopCost(state.meta), { workshop: { ...run.workshop, built: true } })
}

/** tile i sits in a bed with a built sprinkler: its moisture is kept full by step(). A tile bought into the bed
 * later is irrigated at once — the bed, not the tile, is what the sprinkler owns. */
export function isIrrigated(run: RunState, i: number): boolean {
  return run.workshop.beds[Math.floor(i / 6)] === true
}

// Order: NO_WORKSHOP, LOCKED (no such socket, or the bed has no owned tile), ALREADY_OWNED, NOT_ENOUGH_ITEMS,
// NO_CASH. Payment happens on the build itself: there is no bought-but-unplaced state.
export function buildSprinkler(state: GameState, bed: number): ActionResult {
  const { run } = state
  if (!run.workshop.built) return fail('NO_WORKSHOP')
  if (!Number.isInteger(bed) || bed < 0 || bed >= sprinklerMax() || bed * 6 >= run.tiles.length) return fail('LOCKED')
  if (run.workshop.beds[bed]) return fail('ALREADY_OWNED')
  return pay(state, sprinklerCost(state.meta), { workshop: { ...run.workshop, beds: run.workshop.beds.map((b, i) => (i === bed ? true : b)) } })
}

// The smart valve (batch 28): the Fields' pivots burn tank coal only for growing plots. One-time.
// Order: NO_WORKSHOP, LOCKED (Fields not unlocked), ALREADY_OWNED, NOT_ENOUGH_ITEMS, NO_CASH.
export function buyValve(state: GameState): ActionResult {
  const { run } = state
  if (!run.workshop.built) return fail('NO_WORKSHOP')
  if (!run.fields.unlocked) return fail('LOCKED')
  if (run.workshop.valve) return fail('ALREADY_OWNED')
  return pay(state, valveCost(state.meta), { workshop: { ...run.workshop, valve: true } })
}
