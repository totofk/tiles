import { BAG_CAPACITY_START, INITIAL_RNG_SEED, STARTING_CASH, energyMax, orderStartSlots, startTiles, type MineDropId } from './balance'
import { CROP_IDS, STARTING_CROP, type CropId } from './data/crops'
import type { ItemId, OreId, PickaxeTier } from './data/items'
import type { MilestoneId } from './data/milestones'
import type { ToolJob } from './data/tools'
import type { UpgradeId } from './data/upgrades'
import type { WorkerJob } from './data/workers'

export type TileStatus = 'untilled' | 'tilled' | 'planted'

export type Tile = {
  status: TileStatus
  cropId?: CropId
  /** ticks grown so far; only advances while moisture > 0 */
  growth: number
  /** 0 … waterMoisture of the water tool's tier (1 basic, 2 copper, 4 iron); drains 1 per MOISTURE_FULL_TICKS */
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
  /** 🧺 Ore sorting per vein drop: a missing kind is locked; 'sell' sells it the moment it is dug */
  oreSort: Partial<Record<MineDropId, 'keep' | 'sell'>>
  furnace: Furnace
  workshop: Workshop
  fields: Fields
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
  /** material tier per job, 0 basic, 1 copper, 2 iron, 3 gold for the sickle and dibber (toolTierMax(job)); changes what every action of the job does */
  toolTier: Record<ToolJob, number>
  workers: Workers
  /** unsold glut per crop (units); every crop unit sold adds 1, each tick decays it, and it lowers the sale price */
  market: Record<CropId, number>
  /** tick each milestone was first reached; a milestone already true when tracking started stays absent (before tracking) */
  milestones: Partial<Record<MilestoneId, number>>
  /** the 📋 Noticeboard (batch 14) */
  orders: Orders
  /** ⭐ held; earned only by completing orders, spent only on ⭐ rows (never bought or sold for cash) */
  stars: number
}

/** what an order may ask for: a crop (filled by harvests) or an item (delivered from storage) */
export type OrderGood = CropId | ItemId
/** tier indexes the balance order tiers (minutes, ⭐); an accepted crop order takes every harvest of its crop */
export type Offer = { good: OrderGood; count: number; done: number; tier: number; accepted: boolean }
/** a slot holds an offer, or counts down to its next one after a discard */
export type OrderSlot = Offer | { cooldownTicks: number }
/** offers has one entry per owned slot once the board is bought (empty before) */
export type Orders = { unlocked: boolean; slots: number; offers: OrderSlot[] }

/** pool = hired; assigned per job ≤ pool in total; a job takes workers only once its certificate is bought */
export type Workers = { pool: number; assigned: Record<WorkerJob, number>; certificates: WorkerJob[] }

/** debt is a float (it grows every tick); the player pays it rounded up, see debtDue */
export type Loan = { principal: number; debt: number }

export type { PickaxeTier }
export type Pickaxe = { tier: PickaxeTier; durability: number }

/**
 * sales = units sold for cash (each harvest sells 1 crop); mines = mine actions; digs = soil digs for seeds;
 * bars = copper bars collected from the furnace tray; orders = orders completed
 */
export type Counters = { harvests: number; sales: number; mines: number; digs: number; waters: number; plants: number; bars: number; orders: number; contractsByHand: number }
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
 * The workshop (batch 17, bed sockets since batch 26): built once, then one permanent sprinkler per bed socket.
 * beds = one socket per bed (4 = SPRINKLER_MAX); a built bed's six tiles hold full water forever, no coal. valve =
 * the one-time smart valve (batch 28: the Fields' pivots burn tank coal only for growing plots).
 */
export type Workshop = { built: boolean; beds: boolean[]; valve: boolean }

/** one plot = PLOT_TILES tiles; crop null = empty; readyTick = the absolute tick it ripens (ignored when empty) */
export type Plot = { crop: CropId | null; readyTick: number }
/** one field = up to FIELD_PLOTS plots; pivot = wet (sowable); crop = the chip (what gets sown next); pinned =
 *  the Manager leaves it alone (batch 29) */
export type Field = { pivot: boolean; crop: CropId | null; pinned: boolean; plots: Plot[] }

/**
 * The batch-19 throughput machines: owned tiers per kind (max 1 of each, tiers stack) and the fleet's fractional
 * accumulators — whole tiles to reap / to plant, and maintenance cash accrued past the last whole cash paid.
 */
export type Machines = { harvester: number[]; seeder: number[]; carry: { harvest: number; plant: number; maint: number } }

/**
 * The 🚜 Fields (batch 18, plots since batch 28): unlocked once, then land is bought a plot at a time into fields of
 * up to five. pump = owned tier (0 = the Tractor's); tank = burn units, TANK_UNITS_PER_COAL per coal (integers,
 * exact); machines = the batch-19 harvester/seeder tiers and their accumulators.
 */
export type Fields = { unlocked: boolean; list: Field[]; pump: number; tank: number; machines: Machines }

/**
 * cashEarned = harvest and sale income (never loans); bars = bars collected; harvests = per crop; wagesPaid = cash;
 * fireBurnt / fireWasted = furnace burn ticks in total / with no cycle progressing; barsSmelted = bars the furnace made;
 * workerPlants = crops the plant worker planted (its tills not counted); workerMines = mine presses by mine workers; bars / barsSmelted are copper bars, ironBars /
 * ironBarsSmelted the same for iron, goldBars / goldBarsSmelted for gold
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
  workerMines: number
  ironBars: number
  ironBarsSmelted: number
  ordersCompleted: number
  starsEarned: number
  goldBars: number
  goldBarsSmelted: number
}

export const MULTIPLIER_KEYS = ['growTime', 'sellPrice', 'cost', 'energy', 'moistureDrain'] as const
export type MultiplierKey = (typeof MULTIPLIER_KEYS)[number]
/** one meta upgrade per multiplier, plus the batch-20 deed rows; meta stores levels only, every number is in balance.ts */
export type MetaUpgradeId = MultiplierKey | 'startTiles' | 'workerSpeed' | 'keepLicenses' | 'keepFirstCertificates'

/** one sold run in the Legacy history */
export type RunHistoryEntry = { endedAtTick: number; deeds: number }

/**
 * Survives "Sell the farm"; upgrades start at level 0 (multiplier 1); legacyMultipliers carries pre-v12 multipliers
 * forward. The batch-20 deed ledger: deeds = spendable, deedsClaimed = lifetime-cash deeds already granted (the
 * claimable number is deedsFor(lifetime) − deedsClaimed, so the same cash is never paid twice), runs = the last sales.
 */
export type MetaState = {
  prestigeCount: number
  upgrades: Record<MetaUpgradeId, number>
  legacyMultipliers?: Record<MultiplierKey, number>
  deeds: number
  deedsClaimed: number
  runs: RunHistoryEntry[]
}

export type GameState = { run: RunState; meta: MetaState }

export function createTile(): Tile {
  return { status: 'untilled', growth: 0, moisture: 0, ticksSinceMature: 0 }
}

const META_UPGRADE_KEYS: readonly MetaUpgradeId[] = [...MULTIPLIER_KEYS, 'startTiles', 'workerSpeed', 'keepLicenses', 'keepFirstCertificates']

export function createInitialMeta(): MetaState {
  return {
    prestigeCount: 0,
    upgrades: Object.fromEntries(META_UPGRADE_KEYS.map((key) => [key, 0])) as Record<MetaUpgradeId, number>,
    deeds: 0,
    deedsClaimed: 0,
    runs: [],
  }
}

/** what a sold run carries into the next one: the Legacy keep rows' licenses and farm certificates, the ⭐-bought
 * order slots, and the lifetime totals (they are Stats totals — and the deed meter reads them) */
export type RunCarry = { licenses: CropId[]; certificates: WorkerJob[]; orderSlots: number; lifetime: Lifetime }

/** a run at tick 0: what a new game starts, and what "Sell the farm" starts after it — honors the start-tiles and
 * energy Legacy rows and the keeps */
export function createFreshRun(meta: MetaState, carry?: RunCarry): RunState {
  return {
    cash: STARTING_CASH,
    energy: energyMax(0, meta),
    tiles: Array.from({ length: startTiles(meta) }, createTile),
    licenses: carry?.licenses ?? [STARTING_CROP],
    upgrades: { energyMax: 0, energyRegen: 0, sellPrice: 0, fertilizer: 0 },
    counters: { harvests: 0, sales: 0, mines: 0, digs: 0, waters: 0, plants: 0, bars: 0, orders: 0, contractsByHand: 0 },
    tick: 0,
    mineLicense: false,
    pickaxe: null,
    inventory: {},
    bagCapacity: BAG_CAPACITY_START,
    storageLevel: 0,
    vein: { level: 0, progress: 0, rock: 'stone' },
    oreSort: {},
    furnace: createFurnace(),
    workshop: createWorkshop(),
    fields: createFields(),
    lifetime: carry?.lifetime ?? { cashEarned: 0, energySpent: 0, bars: 0, harvests: {}, wagesPaid: 0, fireBurnt: 0, fireWasted: 0, barsSmelted: 0, workerPlants: 0, workerMines: 0, ironBars: 0, ironBarsSmelted: 0, ordersCompleted: 0, starsEarned: 0, goldBars: 0, goldBarsSmelted: 0 },
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
    workers: { pool: 0, assigned: { plant: 0, water: 0, harvest: 0, ore: 0, fuel: 0, mine: 0, clerk: 0, manager: 0 }, certificates: carry?.certificates ?? [] },
    market: Object.fromEntries(CROP_IDS.map((crop) => [crop, 0])) as Record<CropId, number>,
    milestones: {},
    orders: { unlocked: false, slots: carry?.orderSlots ?? orderStartSlots(), offers: [] },
    stars: 0,
  }
}

export function createInitialState(): GameState {
  const meta = createInitialMeta()
  return { meta, run: createFreshRun(meta) }
}

/** a furnace not yet built: copper, no fire, empty slot and tray, base levels */
export function createFurnace(): Furnace {
  return { built: false, oreKind: 'copperOre', fire: 0, ore: 0, progress: 0, ready: 0, smart: false, levels: { fireCap: 0, batch: 0 } }
}

/** a workshop not yet built: four empty bed sockets, no valve */
export function createWorkshop(): Workshop {
  return { built: false, beds: [false, false, false, false], valve: false }
}

/** fields not yet unlocked: no fields, the Tractor's pump tier, an empty tank */
export function createFields(): Fields {
  return { unlocked: false, list: [], pump: 0, tank: 0, machines: createMachines() }
}

/** no machines bought; the fleet's accumulators start empty */
export function createMachines(): Machines {
  return { harvester: [], seeder: [], carry: { harvest: 0, plant: 0, maint: 0 } }
}
