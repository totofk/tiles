// Wetlands (batch 36.3): the farm with no mine. The river waters the bank beds; the barge sells what the mine would.
import { fail, isAmount, withRun, type ActionResult } from './actions'
import { BARGE_ITEMS, BARGE_PRICE, TANK_UNITS_PER_COAL, itemSellPrice, multiplier, tankCapCoal, type BargeItemId } from './balance'
import type { Listing } from './listings'
import { bagCount } from './mining'
import type { GameState, MetaState } from './state'

/** a Wetlands run that does not own the mine licence; one bought before 36.3 keeps its whole mine */
export const noMine = (run: { listing: Listing; mineLicense: boolean }): boolean => run.listing.district === 'wetlands' && !run.mineLicense

/** the cost deed scales it like wood; always above what the item sells for, so buy → sell never makes cash */
export function bargePrice(item: BargeItemId, meta: MetaState, sellPriceLevel: number): number {
  return Math.max(Math.round(BARGE_PRICE[item] * multiplier(meta, 'cost')), itemSellPrice(item, meta, sellPriceLevel) + 1)
}

// The buyWood precedent: no energy, no counter (not a sale, not a bar collected), no rng; any Wetlands run.
// Order: LOCKED (not Wetlands, or not a barge good), BAD_AMOUNT, BAG_FULL, NO_CASH.
export function buyBarge(state: GameState, item: BargeItemId, n: number): ActionResult {
  const { run } = state
  if (run.listing.district !== 'wetlands' || !BARGE_ITEMS.includes(item)) return fail('LOCKED')
  if (!isAmount(n)) return fail('BAD_AMOUNT')
  if (bagCount(run) + n > run.bagCapacity) return fail('BAG_FULL')
  const cost = n * bargePrice(item, state.meta, run.upgrades.sellPrice)
  if (run.cash < cost) return fail('NO_CASH')
  return withRun(state, { cash: run.cash - cost, inventory: { ...run.inventory, [item]: (run.inventory[item] ?? 0) + n } })
}

/** the tank hand on a no-mine run with no coal stored: one barge coal straight into the Fields tank. null = not a
 * no-mine run, Fields locked, no room for a coal, or no cash (the hand idles) */
export function bargeCoalToTank(state: GameState): ActionResult | null {
  const { run } = state
  const f = run.fields
  if (!noMine(run) || !f.unlocked || tankCapCoal(f.pump) * TANK_UNITS_PER_COAL - f.tank < TANK_UNITS_PER_COAL) return null
  const cost = bargePrice('coal', state.meta, run.upgrades.sellPrice)
  if (run.cash < cost) return null
  return withRun(state, { cash: run.cash - cost, fields: { ...f, tank: f.tank + TANK_UNITS_PER_COAL } })
}
