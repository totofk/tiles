import { fail, isAmount, nextRandom, withRun, type ActionResult } from './actions'
import {
  ACTION_ENERGY_COST,
  itemSellPrice,
  mineLicenseCost,
  pickaxeRecipe,
  veinDrops,
  woodCost,
} from './balance'
import { ITEM_IDS, type ItemId } from './data/items'
import type { GameState, RunState } from './state'

// Mining actions cost no energy except dig. Every item, wood included, takes one bag slot.

export function bagCount(run: RunState): number {
  return ITEM_IDS.reduce((n, id) => n + (run.inventory[id] ?? 0), 0)
}

function addItems(run: RunState, id: ItemId, n: number): RunState['inventory'] {
  return { ...run.inventory, [id]: (run.inventory[id] ?? 0) + n }
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

export function craftPickaxe(state: GameState): ActionResult {
  const { run } = state
  if (run.pickaxe) return fail('ALREADY_OWNED')
  const recipe = pickaxeRecipe('wooden')
  if ((run.inventory.wood ?? 0) < recipe.wood) return fail('NOT_ENOUGH_ITEMS')
  return withRun(state, {
    inventory: addItems(run, 'wood', -recipe.wood),
    pickaxe: { tier: 'wooden', durability: recipe.durability },
  })
}

// Dig validates in this order: NO_MINE_LICENSE, NO_PICKAXE, BAG_FULL, NO_ENERGY.
export function dig(state: GameState): ActionResult {
  const { run } = state
  if (!run.mineLicense) return fail('NO_MINE_LICENSE')
  if (!run.pickaxe) return fail('NO_PICKAXE')
  if (bagCount(run) >= run.bagCapacity) return fail('BAG_FULL')
  if (run.energy < ACTION_ENERGY_COST) return fail('NO_ENERGY')
  const [r, rngState] = nextRandom(run.rngState)
  const durability = run.pickaxe.durability - 1
  return withRun(state, {
    energy: run.energy - ACTION_ENERGY_COST,
    rngState,
    pickaxe: durability > 0 ? { ...run.pickaxe, durability } : null,
    inventory: addItems(run, pickDrop(veinDrops(run.vein.level), r), 1),
    counters: { ...run.counters, mines: run.counters.mines + 1 },
  })
}

/** each unit sold counts as one sale */
export function sellItem(state: GameState, id: ItemId, n: number): ActionResult {
  const { run } = state
  if (!isAmount(n)) return fail('BAD_AMOUNT')
  if ((run.inventory[id] ?? 0) < n) return fail('NOT_ENOUGH_ITEMS')
  return withRun(state, {
    cash: run.cash + n * itemSellPrice(id, state.meta, run.upgrades.sellPrice),
    inventory: addItems(run, id, -n),
    counters: { ...run.counters, sales: run.counters.sales + n },
  })
}
