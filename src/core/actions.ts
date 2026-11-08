import {
  ACTION_ENERGY_COST,
  TILE_CAP,
  cropGrowTicks,
  cropSeedCost,
  digSeedDrop,
  doubleHarvestChance,
  handPickedBonus,
  licenseCost,
  seedKeepChance,
  tileCost,
  upgradeCost,
  upgradeMaxLevel,
  upgradeUnlocked,
  waterMoisture,
} from './balance'
import type { CropId } from './data/crops'
import { recordMilestones } from './data/milestones'
import type { UpgradeId } from './data/upgrades'
// actions ↔ orders is a cycle of function bindings only (used at call time), like step ↔ workers
import { harvestSale } from './orders'
import { createTile, type GameState, type Lifetime, type RunState, type Tile } from './state'
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
  | 'NO_MINE_LICENSE'
  | 'NO_PICKAXE'
  | 'NO_IRON_PICKAXE'
  | 'NOT_BLUNT'
  | 'BAG_FULL'
  | 'NOT_ENOUGH_ITEMS'
  | 'BAD_AMOUNT'
  | 'LOAN_ACTIVE'
  | 'NO_LOAN'
  | 'NOT_ENOUGH_CASH'
  | 'NO_SEEDS'
  | 'NOTHING_TO_DO'
  | 'NOT_SELLABLE'
  | 'NO_FURNACE'
  | 'FULL'
  | 'NO_ORE'
  | 'NO_FUEL'
  | 'NOT_EMPTY'
  | 'NO_CERTIFICATE'
  | 'POOL_FULL'
  | 'NO_FREE_WORKER'
  | 'BAD_SLOT'
  | 'NO_STARS'

export type ActionResult = { ok: true; state: GameState } | { ok: false; error: ActionError }

export const fail = (error: ActionError): ActionResult => ({ ok: false, error })

export function withRun(state: GameState, run: Partial<RunState>): ActionResult {
  const merged = { ...state.run, ...run }
  return { ok: true, state: { meta: state.meta, run: recordMilestones(state.run, merged) } }
}

export const isAmount = (n: number) => Number.isInteger(n) && n >= 1

/** lifetime totals after an action that spent `energy`, earned `cash` and harvested `crop` */
export function addLifetime(run: RunState, energy: number, cash: number, crop?: CropId): Lifetime {
  const l = run.lifetime
  return {
    ...l,
    energySpent: l.energySpent + energy,
    cashEarned: l.cashEarned + cash,
    harvests: crop ? { ...l.harvests, [crop]: (l.harvests[crop] ?? 0) + 1 } : l.harvests,
  }
}

/** mulberry32: a float in [0, 1) and the next uint32 state */
export function nextRandom(rngState: number): [number, number] {
  const next = (rngState + 0x6d2b79f5) >>> 0
  let t = Math.imul(next ^ (next >>> 15), next | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next]
}

// Farm actions validate in this order: BAD_TILE, tile status, license/seeds/cash (plant), NO_ENERGY.
// `energy` = what the action costs the player (0 when a worker does it). `run` = the run with the action's other
// changes (seeds, rngState, market, orders …); energy, cash, tiles, counters and lifetime are applied on top of it.
function farmAction(
  state: GameState,
  i: number,
  check: (tile: Tile) => ActionError | null,
  apply: (tile: Tile) => {
    tile: Tile
    cashDelta?: number
    counters?: Partial<RunState['counters']>
    harvested?: CropId
    run?: RunState
  },
  energy = ACTION_ENERGY_COST,
): ActionResult {
  const { run } = state
  if (!Number.isInteger(i) || i < 0 || i >= run.tiles.length) return fail('BAD_TILE')
  const error = check(run.tiles[i])
  if (error) return fail(error)
  if (run.energy < energy) return fail('NO_ENERGY')
  const { tile, cashDelta = 0, counters, harvested, run: next = run } = apply(run.tiles[i])
  return withRun(state, {
    ...next,
    energy: run.energy - energy,
    cash: run.cash + cashDelta,
    tiles: run.tiles.map((t, j) => (j === i ? tile : t)),
    counters: { ...next.counters, ...counters },
    lifetime: addLifetime(next, energy, harvested ? cashDelta : 0, harvested),
  })
}

/** one roll against `chance`, only for a tier above basic, so tier-0 runs keep their exact PRNG sequence */
function tierRoll(run: RunState, tier: number, chance: number): { hit: boolean; rngState: number } {
  if (tier === 0) return { hit: false, rngState: run.rngState }
  const [r, rngState] = nextRandom(run.rngState)
  return { hit: r < chance, rngState }
}

export function till(state: GameState, i: number, energy = ACTION_ENERGY_COST): ActionResult {
  return farmAction(
    state,
    i,
    (t) => (t.status === 'untilled' ? null : 'NOT_UNTILLED'),
    (t) => ({ tile: { ...t, status: 'tilled' } }),
    energy,
  )
}

// Planting uses 1 seed from the pouch. With 0 in stock and autoBuySeeds on it buys that one seed at the
// seed price instead (the pre-v4 cost, so auto-buy costs exactly what planting always did). A copper dibber may keep
// the seed: the checks still need one in hand, but a kept seed leaves the pouch as it was and auto-buy charges nothing.
export function plant(state: GameState, i: number, cropId: CropId, energy = ACTION_ENERGY_COST): ActionResult {
  const { run } = state
  const stock = run.seeds[cropId] ?? 0
  const price = stock > 0 ? 0 : cropSeedCost(cropId, state.meta)
  return farmAction(
    state,
    i,
    (t) => {
      if (t.status !== 'tilled') return 'NOT_TILLED'
      if (!run.licenses.includes(cropId)) return 'NO_LICENSE'
      if (stock === 0 && !run.autoBuySeeds) return 'NO_SEEDS'
      return run.cash < price ? 'NO_CASH' : null
    },
    (t) => {
      const { hit: kept, rngState } = tierRoll(run, run.toolTier.plant, seedKeepChance(run.toolTier.plant))
      return {
        tile: { ...t, status: 'planted', cropId, growth: 0, ticksSinceMature: 0 },
        cashDelta: kept ? 0 : -price,
        counters: { plants: run.counters.plants + 1 },
        run: { ...run, rngState, seeds: stock > 0 && !kept ? { ...run.seeds, [cropId]: stock - 1 } : run.seeds },
      }
    },
    energy,
  )
}

/** "Crop to plant" for taps, the plant tool and the plant worker; free, needs the license */
export function selectCrop(state: GameState, cropId: CropId): ActionResult {
  return state.run.licenses.includes(cropId) ? withRun(state, { plantCrop: cropId }) : fail('NO_LICENSE')
}

export function water(state: GameState, i: number, energy = ACTION_ENERGY_COST): ActionResult {
  const { run } = state
  return farmAction(
    state,
    i,
    (t) => (t.status === 'planted' ? null : 'NOT_PLANTED'),
    (t) => ({ tile: { ...t, moisture: waterMoisture(run.toolTier.water) }, counters: { waters: run.counters.waters + 1 } }),
    energy,
  )
}

// Harvest sells instantly: there is no inventory and no separate sell action. A copper sickle may yield 2 crops:
// both sell (sales +2, cash ×2), but it is still one harvest (counters and per-crop totals +1). An accepted order for
// the crop takes the units first (harvestSale), so every harvest — tap, tool press or worker — fills it.
export function harvest(state: GameState, i: number, energy = ACTION_ENERGY_COST): ActionResult {
  return farmAction(
    state,
    i,
    (t) => {
      if (t.status !== 'planted' || !t.cropId) return 'NOT_PLANTED'
      return t.growth < cropGrowTicks(t.cropId, state.meta, state.run.upgrades.fertilizer) ? 'NOT_MATURE' : null
    },
    (t) => {
      const { run } = state
      const { harvests, sales } = run.counters
      const { hit, rngState } = tierRoll(run, run.toolTier.harvest, doubleHarvestChance(run.toolTier.harvest))
      const crops = hit ? 2 : 1
      // the market prices each unit at the glut before that unit's sale, in sequence; a player's harvest (energy spent)
      // is hand-picked, a worker's (energy 0) is not
      const sale = harvestSale({ ...state, run: { ...run, rngState } }, t.cropId!, crops, energy > 0 ? handPickedBonus() : 1)
      return {
        tile: clearedTile(t),
        cashDelta: sale.cash,
        counters: { harvests: harvests + 1, sales: sales + crops },
        harvested: t.cropId,
        run: sale.run,
      }
    },
    energy,
  )
}

// Dig for seeds: the anti-soft-lock floor. No tile, no license, free from tick 0; 1 energy, and a chance of one
// seed into the pouch. The roll and the digs counter advance whether or not a seed drops.
export function digForSeeds(state: GameState): ActionResult {
  const { run } = state
  if (run.energy < ACTION_ENERGY_COST) return fail('NO_ENERGY')
  const [r, rngState] = nextRandom(run.rngState)
  const { crop, chance } = digSeedDrop()
  return withRun(state, {
    energy: run.energy - ACTION_ENERGY_COST,
    rngState,
    seeds: r < chance ? { ...run.seeds, [crop]: (run.seeds[crop] ?? 0) + 1 } : run.seeds,
    counters: { ...run.counters, digs: run.counters.digs + 1 },
    lifetime: addLifetime(run, ACTION_ENERGY_COST, 0),
  })
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

/** seeds go to the pouch, not the bag; needs the crop's license */
export function buySeeds(state: GameState, cropId: CropId, n: number): ActionResult {
  const { run } = state
  if (!isAmount(n)) return fail('BAD_AMOUNT')
  if (!run.licenses.includes(cropId)) return fail('NO_LICENSE')
  const cost = n * cropSeedCost(cropId, state.meta)
  if (run.cash < cost) return fail('NO_CASH')
  return withRun(state, { cash: run.cash - cost, seeds: { ...run.seeds, [cropId]: (run.seeds[cropId] ?? 0) + n } })
}

/** one flag for every crop; costs nothing */
export function setAutoBuySeeds(state: GameState, on: boolean): ActionResult {
  return withRun(state, { autoBuySeeds: on })
}

export function buyTile(state: GameState): ActionResult {
  const { run } = state
  // cap before cash: tileCost is Infinity at the cap
  if (run.tiles.length >= TILE_CAP) return fail('TILE_CAP')
  const cost = tileCost(run.tiles.length, state.meta)
  if (run.cash < cost) return fail('NO_CASH')
  return withRun(state, { cash: run.cash - cost, tiles: [...run.tiles, createTile()] })
}
