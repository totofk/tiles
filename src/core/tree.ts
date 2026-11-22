// Orchard Valley's 🌳 fruit tree bed (batch 36.2, DECISIONS "Batch 36.2 refined" call 8–9): one home bed planted once
// with a berry crop, locked for the run. Its 6 tiles stay plain `tilled` tiles marked by run.tree.bed; they need no
// water, never rot, and each grows fruit on its own until 3 wait. Harvest takes a tile's whole stock as one action.
import { addLifetime, fail, farmAction, withRun, type ActionResult } from './actions'
import { spendEnergy } from './relics'
import { RENOWN_BY_HAND, RENOWN_BY_WORKER, TREE_MATURE_CYCLES, TREE_PLANT_ENERGY, TREE_STOCK_CAP, addRenown, handPickedBonus, treeCadenceTicks, treePlantCost } from './balance'
import { CROP_GROUPS, type CropId } from './data/crops'
import { harvestSale } from './orders'
import type { GameState, RunState, TreeBed } from './state'

export const BED_TILES = 6

export const isTreeTile = (run: RunState, i: number): boolean => run.tree !== null && Math.floor(i / BED_TILES) === run.tree.bed

/** the tree tile's index within its bed */
const slot = (tree: TreeBed, i: number): number => i - tree.bed * BED_TILES

// Order: LOCKED (not Orchard Valley, a tree already planted, not a berry), BAD_TILE, NO_LICENSE, BED_BUSY, NO_ENERGY,
// NO_CASH.
export function plantTreeBed(state: GameState, bed: number, crop: CropId): ActionResult {
  const { run } = state
  if (run.listing.district !== 'orchardValley' || run.tree !== null || !CROP_GROUPS.berry.includes(crop)) return fail('LOCKED')
  if (!Number.isInteger(bed) || bed < 0 || (bed + 1) * BED_TILES > run.tiles.length) return fail('BAD_TILE')
  if (!run.licenses.includes(crop)) return fail('NO_LICENSE')
  const first = bed * BED_TILES
  const inBed = (j: number) => j >= first && j < first + BED_TILES
  if (run.tiles.some((t, j) => inBed(j) && t.status === 'planted')) return fail('BED_BUSY')
  const spent = spendEnergy(run, TREE_PLANT_ENERGY)
  if (!spent) return fail('NO_ENERGY')
  const cost = treePlantCost(crop, state.meta)
  if (run.cash < cost) return fail('NO_CASH')
  const start = -(TREE_MATURE_CYCLES - 1) * treeCadenceTicks(crop)
  return withRun(state, {
    energy: spent.energy,
    energyReserve: spent.energyReserve,
    cash: run.cash - cost,
    tiles: run.tiles.map((t, j) => (inBed(j) ? { status: 'tilled', growth: 0, moisture: 0, ticksSinceMature: 0 } : t)),
    tree: { bed, crop, ticks: Array(BED_TILES).fill(start), stock: Array(BED_TILES).fill(0) },
    lifetime: addLifetime(run, TREE_PLANT_ENERGY, 0),
  })
}

/** one tick of growth: a tile below the stock cap advances; at the cadence it gains a fruit; a full tile pauses */
export function tickTree(tree: TreeBed | null): TreeBed | null {
  if (tree === null) return null
  const cadence = treeCadenceTicks(tree.crop)
  const ticks = [...tree.ticks]
  const stock = [...tree.stock]
  for (let k = 0; k < BED_TILES; k++) {
    if (stock[k] >= TREE_STOCK_CAP) continue
    ticks[k]++
    if (ticks[k] >= cadence) {
      stock[k]++
      ticks[k] -= cadence
    }
  }
  return { ...tree, ticks, stock }
}

/** the whole stock of tree tile i as one harvest: orders first, then the market; ×1.25 by hand; no sickle, no rng */
export function harvestTreeTile(state: GameState, i: number, energy: number): ActionResult {
  const tree = state.run.tree!
  const units = tree.stock[slot(tree, i)]
  return farmAction(
    state,
    i,
    () => (units > 0 ? null : 'NOT_MATURE'),
    (t) => {
      const { run } = state
      const sale = harvestSale(state, tree.crop, units, energy > 0 ? handPickedBonus() : 1)
      return {
        tile: t,
        cashDelta: sale.cash,
        counters: { harvests: run.counters.harvests + 1, sales: run.counters.sales + units },
        harvested: tree.crop,
        run: {
          ...sale.run,
          tree: { ...tree, stock: tree.stock.map((n, k) => (k === slot(tree, i) ? 0 : n)) },
          renown: addRenown(sale.run.renown, tree.crop, energy > 0 ? RENOWN_BY_HAND : RENOWN_BY_WORKER),
        },
      }
    },
    energy,
  )
}
