import { BAG_CAPACITY_START, INITIAL_RNG_SEED, START_TILES, STARTING_CASH, energyMax } from './balance'
import { STARTING_CROP, type CropId } from './data/crops'
import type { ItemId, OreId, PickaxeTier } from './data/items'
import type { ToolJob } from './data/tools'
import type { UpgradeId } from './data/upgrades'
import type { WorkerJob } from './data/workers'

export type TileStatus = 'untilled' | 'tilled' | 'planted'

export type Tile = {
  status: TileStatus
  cropId?: CropId
  /** ticks grown so far; only advances while moisture > 0 */
  growth: number
  /** 0 … waterMoisture of the water tool's tier (1 basic, 2 copper); drains 1 per MOISTURE_FULL_TICKS */
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
  /** milestone counters; only actions change them (the player's, or a worker's inside step()) */
  counters: Counters
  /** total ticks simulated this run */
  tick: number
  mineLicense: boolean
  /** durability 0 = blunt: still owned, mines by hand until repaired */
  pickaxe: Pickaxe | null
  /** every item counts toward bagCapacity (displayed as "Storage") */
  inventory: Partial<Record<ItemId, number>>
  bagCapacity: number
  /** storage upgrade level; each level already added its slots to bagCapacity */
  storageLevel: number
  /** rock = what the current rock drops (rolled when the previous one broke); progress = hits into it */
  vein: { level: number; progress: number; rock: ItemId }
  furnace: Furnace
  /** totals for the Stats tab; never unlock anything */
  lifetime: Lifetime
  /** mastery xp per pickaxe tier (1 per mine action with that tier) */
  mastery: Partial<Record<PickaxeTier, number>>
  /** tiers that reached max mastery; each adds preserve chance to every tier */
  masteredTiers: PickaxeTier[]
  /** mulberry32 state (uint32); advanced by actions that roll, so runs replay exactly */
  rngState: number
  /** one loan at a time; step() grows its debt */
  loan: Loan | null
  /** seed pouch per crop; separate from the bag, never counts toward bagCapacity */
  seeds: Partial<Record<CropId, number>>
  /** planting with 0 seeds of that crop buys one at the seed price */
  autoBuySeeds: boolean
  /** "Crop to plant": what a tap on a tilled tile and the plant worker plant (saved, so the worker plants it offline) */
  plantCrop: CropId
  /** farm tool level per job, 0 (none) … 3 */
  tools: Record<ToolJob, number>
  /** tiles per press for a level-2 tool; read through toolCount, which clamps it to the tile count */
  toolN: Record<ToolJob, number>
  /** material tier per job, 0 basic … toolTierMax (1 copper); changes what every action of the job does */
  toolTier: Record<ToolJob, number>
  workers: Workers
}

/** pool = hired; assigned per job ≤ pool in total; a job takes workers only once its certificate is bought */
export type Workers = { pool: number; assigned: Record<WorkerJob, number>; certificates: WorkerJob[] }

/** debt is a float (it grows every tick); the player pays it rounded up, see debtDue */
export type Loan = { principal: number; debt: number }

export type { PickaxeTier }
export type Pickaxe = { tier: PickaxeTier; durability: number }

/**
 * sales = units sold for cash (each harvest sells 1 crop); mines = mine actions; digs = soil digs for seeds;
 * bars = copper bars collected from the furnace tray
 */
export type Counters = { harvests: number; sales: number; mines: number; digs: number; waters: number; plants: number; bars: number }
export type CounterId = keyof Counters

/**
 * fire = burn ticks left (filled with fuel); ore = copper ore in the ore slot (leaves it when a cycle completes);
 * progress = ticks into the current cycle; ready = bars waiting in the output tray; smart = fire burns only while a
 * cycle progresses; levels = bought fire-capacity and batch levels (0 = base); oreKind = the one ore the slot takes and
 * the tray's bars are made of
 */
export type Furnace = {
  built: boolean
  oreKind: OreId
  fire: number
  ore: number
  progress: number
  ready: number
  smart: boolean
  levels: { fireCap: number; batch: number }
}

/**
 * cashEarned = harvest and sale income (never loans); bars = bars collected; harvests = per crop; wagesPaid = cash;
 * fireBurnt / fireWasted = furnace burn ticks in total / with no cycle progressing; barsSmelted = bars the furnace made;
 * workerPlants = crops the plant worker planted (its tills not counted); bars / barsSmelted are copper bars, ironBars /
 * ironBarsSmelted the same for iron
 */
export type Lifetime = {
  cashEarned: number
  energySpent: number
  bars: number
  harvests: Partial<Record<CropId, number>>
  wagesPaid: number
  fireBurnt: number
  fireWasted: number
  barsSmelted: number
  workerPlants: number
  ironBars: number
  ironBarsSmelted: number
}

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
      counters: { harvests: 0, sales: 0, mines: 0, digs: 0, waters: 0, plants: 0, bars: 0 },
      tick: 0,
      mineLicense: false,
      pickaxe: null,
      inventory: {},
      bagCapacity: BAG_CAPACITY_START,
      storageLevel: 0,
      vein: { level: 0, progress: 0, rock: 'stone' },
      furnace: createFurnace(),
      lifetime: { cashEarned: 0, energySpent: 0, bars: 0, harvests: {}, wagesPaid: 0, fireBurnt: 0, fireWasted: 0, barsSmelted: 0, workerPlants: 0, ironBars: 0, ironBarsSmelted: 0 },
      mastery: {},
      masteredTiers: [],
      rngState: INITIAL_RNG_SEED,
      loan: null,
      seeds: {},
      autoBuySeeds: true,
      plantCrop: STARTING_CROP,
      tools: { water: 0, harvest: 0, plant: 0 },
      toolN: { water: 1, harvest: 1, plant: 1 },
      toolTier: { water: 0, harvest: 0, plant: 0 },
      workers: { pool: 0, assigned: { plant: 0, water: 0, harvest: 0, ore: 0, fuel: 0 }, certificates: [] },
    },
  }
}

/** a furnace not yet built: copper, no fire, empty slot and tray, base levels */
export function createFurnace(): Furnace {
  return { built: false, oreKind: 'copperOre', fire: 0, ore: 0, progress: 0, ready: 0, smart: false, levels: { fireCap: 0, batch: 0 } }
}
