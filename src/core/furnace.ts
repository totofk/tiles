import { fail, type ActionResult } from './actions'
import { furnaceCost, furnaceVeinLevel } from './balance'
import { pay } from './mining'
import type { GameState } from './state'

// The furnace is a machine: building, smelting and collecting cost no energy.

// Order: ALREADY_OWNED, LOCKED (vein below furnaceVeinLevel), NOT_ENOUGH_ITEMS, NO_CASH.
export function buildFurnace(state: GameState): ActionResult {
  const { run } = state
  if (run.furnace.built) return fail('ALREADY_OWNED')
  if (run.vein.level < furnaceVeinLevel()) return fail('LOCKED')
  return pay(state, furnaceCost(state.meta), { furnace: { ...run.furnace, built: true } })
}
