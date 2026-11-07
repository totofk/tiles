import { BAG_CAPACITY_START, INITIAL_RNG_SEED, START_TILES, STARTING_CASH, energyMax } from './balance'
import { STARTING_CROP, type CropId } from './data/crops'
import type { ItemId } from './data/items'
import type { ToolJob } from './data/tools'
import type { UpgradeId } from './data/upgrades'

export type TileStatus = 'untilled' | 'tilled' | 'planted'

export type Tile = {
  status: TileStatus
  cropId?: CropId
  /** ticks grown so far; only advances while moisture > 0 */
  growth: number
  /** 0..1 */
  moisture: number
  /** ticks since growth reached cropGrowTicks; rots past cropRotGraceTicks */
  ticksSinceMature: number
}

export type RunState = {
  cash: number
  /** fractional: regen adds energyRegenPerTick every tick, capped at energyMax */
  energy: number
  tiles: Tile[]
  /** crop ids the player may plant */
  licenses: CropId[]
  upgrades: Record<UpgradeId, number>
  /** milestone counters; only actions change them, never step() */
  counters: Counters
  /** total ticks simulated this run */
  tick: number
  mineLicense: boolean
  pickaxe: Pickaxe | null
  /** every item counts toward bagCapacity */
  inventory: Partial<Record<ItemId, number>>
  bagCapacity: number
  vein: { level: number }
  /** mulberry32 state (uint32); advanced by actions that roll, so runs replay exactly */
  rngState: number
  /** one loan at a time; step() grows its debt */
  loan: Loan | null
  /** seed pouch per crop; separate from the bag, never counts toward bagCapacity */
  seeds: Partial<Record<CropId, number>>
  /** planting with 0 seeds of that crop buys one at the seed price */
  autoBuySeeds: boolean
  /** farm tool level per job, 0 (none) … 3 */
  tools: Record<ToolJob, number>
  /** tiles per press for a level-2 tool; read through toolCount, which clamps it to the tile count */
  toolN: Record<ToolJob, number>
}

/** debt is a float (it grows every tick); the player pays it rounded up, see debtDue */
export type Loan = { principal: number; debt: number }

export type PickaxeTier = 'wooden'
export type Pickaxe = { tier: PickaxeTier; durability: number }

/** sales = units sold for cash (each harvest sells 1 crop); mines = mine actions; digs = soil digs for seeds */
export type Counters = { harvests: number; sales: number; mines: number; digs: number; waters: number; plants: number }
export type CounterId = keyof Counters

export type MultiplierKey = 'growTime' | 'sellPrice' | 'cost' | 'energy' | 'moistureDrain'

/** survives prestige; multipliers are all 1 until prestige exists */
export type MetaState = {
  prestigeCount: number
  multipliers: Record<MultiplierKey, number>
}

export type GameState = { run: RunState; meta: MetaState }

export function createTile(): Tile {
  return { status: 'untilled', growth: 0, moisture: 0, ticksSinceMature: 0 }
}

export function createInitialMeta(): MetaState {
  return {
    prestigeCount: 0,
    multipliers: { growTime: 1, sellPrice: 1, cost: 1, energy: 1, moistureDrain: 1 },
  }
}

export function createInitialState(): GameState {
  const meta = createInitialMeta()
  return {
    meta,
    run: {
      cash: STARTING_CASH,
      energy: energyMax(0, meta),
      tiles: Array.from({ length: START_TILES }, createTile),
      licenses: [STARTING_CROP],
      upgrades: { energyMax: 0, energyRegen: 0, sellPrice: 0, fertilizer: 0 },
      counters: { harvests: 0, sales: 0, mines: 0, digs: 0, waters: 0, plants: 0 },
      tick: 0,
      mineLicense: false,
      pickaxe: null,
      inventory: {},
      bagCapacity: BAG_CAPACITY_START,
      vein: { level: 0 },
      rngState: INITIAL_RNG_SEED,
      loan: null,
      seeds: {},
      autoBuySeeds: true,
      tools: { water: 0, harvest: 0, plant: 0 },
      toolN: { water: 1, harvest: 1, plant: 1 },
    },
  }
}
