import {
  ACTION_ENERGY_COST,
  TILE_CAP,
  cropGrowTicks,
  cropSeedCost,
  cropSellPrice,
  licenseCost,
  tileCost,
  upgradeCost,
  upgradeMaxLevel,
  upgradeUnlocked,
} from './balance'
import type { CropId } from './data/crops'
import type { UpgradeId } from './data/upgrades'
import { createTile, type GameState, type RunState, type Tile } from './state'
import { clearedTile } from './step'

export type ActionError =
  | 'NO_ENERGY'
  | 'BAD_TILE'
  | 'NOT_UNTILLED'
  | 'NOT_TILLED'
  | 'NOT_PLANTED'
  | 'NOT_MATURE'
  | 'NO_LICENSE'
  | 'NO_CASH'
  | 'MAX_LEVEL'
  | 'TILE_CAP'
  | 'ALREADY_OWNED'
  | 'LOCKED'

export type ActionResult = { ok: true; state: GameState } | { ok: false; error: ActionError }

export const fail = (error: ActionError): ActionResult => ({ ok: false, error })

export function withRun(state: GameState, run: Partial<RunState>): ActionResult {
  return { ok: true, state: { meta: state.meta, run: { ...state.run, ...run } } }
}

// Farm actions validate in this order: BAD_TILE, tile status, license/cash (plant), NO_ENERGY.
function farmAction(
  state: GameState,
  i: number,
  check: (tile: Tile) => ActionError | null,
  apply: (tile: Tile) => { tile: Tile; cashDelta?: number; counters?: Partial<RunState['counters']> },
): ActionResult {
  const { run } = state
  if (!Number.isInteger(i) || i < 0 || i >= run.tiles.length) return fail('BAD_TILE')
  const error = check(run.tiles[i])
  if (error) return fail(error)
  if (run.energy < ACTION_ENERGY_COST) return fail('NO_ENERGY')
  const { tile, cashDelta = 0, counters } = apply(run.tiles[i])
  return withRun(state, {
    energy: run.energy - ACTION_ENERGY_COST,
    cash: run.cash + cashDelta,
    tiles: run.tiles.map((t, j) => (j === i ? tile : t)),
    counters: { ...run.counters, ...counters },
  })
}

export function till(state: GameState, i: number): ActionResult {
  return farmAction(
    state,
    i,
    (t) => (t.status === 'untilled' ? null : 'NOT_UNTILLED'),
    (t) => ({ tile: { ...t, status: 'tilled' } }),
  )
}

export function plant(state: GameState, i: number, cropId: CropId): ActionResult {
  const seed = cropSeedCost(cropId, state.meta)
  return farmAction(
    state,
    i,
    (t) => {
      if (t.status !== 'tilled') return 'NOT_TILLED'
      if (!state.run.licenses.includes(cropId)) return 'NO_LICENSE'
      return state.run.cash < seed ? 'NO_CASH' : null
    },
    (t) => ({ tile: { ...t, status: 'planted', cropId, growth: 0, ticksSinceMature: 0 }, cashDelta: -seed }),
  )
}

export function water(state: GameState, i: number): ActionResult {
  return farmAction(
    state,
    i,
    (t) => (t.status === 'planted' ? null : 'NOT_PLANTED'),
    (t) => ({ tile: { ...t, moisture: 1 } }),
  )
}

// Harvest sells instantly: there is no inventory and no separate sell action.
export function harvest(state: GameState, i: number): ActionResult {
  return farmAction(
    state,
    i,
    (t) => {
      if (t.status !== 'planted' || !t.cropId) return 'NOT_PLANTED'
      return t.growth < cropGrowTicks(t.cropId, state.meta, state.run.upgrades.fertilizer) ? 'NOT_MATURE' : null
    },
    (t) => {
      const { harvests, sales } = state.run.counters
      return {
        tile: clearedTile(t),
        cashDelta: cropSellPrice(t.cropId!, state.meta, state.run.upgrades.sellPrice),
        counters: { harvests: harvests + 1, sales: sales + 1 },
      }
    },
  )
}

// Shop actions cost no energy. Buying energyMax raises the cap only; current energy is not refilled.
export function buyUpgrade(state: GameState, upgradeId: UpgradeId): ActionResult {
  const { run } = state
  if (!upgradeUnlocked(upgradeId, run.counters)) return fail('LOCKED')
  const level = run.upgrades[upgradeId]
  if (level >= upgradeMaxLevel(upgradeId)) return fail('MAX_LEVEL')
  const cost = upgradeCost(upgradeId, level, state.meta)
  if (run.cash < cost) return fail('NO_CASH')
  return withRun(state, { cash: run.cash - cost, upgrades: { ...run.upgrades, [upgradeId]: level + 1 } })
}

export function buyLicense(state: GameState, cropId: CropId): ActionResult {
  const { run } = state
  if (run.licenses.includes(cropId)) return fail('ALREADY_OWNED')
  const cost = licenseCost(cropId, state.meta)
  if (run.cash < cost) return fail('NO_CASH')
  return withRun(state, { cash: run.cash - cost, licenses: [...run.licenses, cropId] })
}

export function buyTile(state: GameState): ActionResult {
  const { run } = state
  // cap before cash: tileCost is Infinity at the cap
  if (run.tiles.length >= TILE_CAP) return fail('TILE_CAP')
  const cost = tileCost(run.tiles.length, state.meta)
  if (run.cash < cost) return fail('NO_CASH')
  return withRun(state, { cash: run.cash - cost, tiles: [...run.tiles, createTile()] })
}
