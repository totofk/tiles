import { START_TILES, STARTING_CASH, energyMax } from './balance'
import { STARTING_CROP, type CropId } from './data/crops'
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
}

/** sales = units sold for cash (each harvest sells 1 crop) */
export type Counters = { harvests: number; sales: number; digs: number }
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
      counters: { harvests: 0, sales: 0, digs: 0 },
      tick: 0,
    },
  }
}
