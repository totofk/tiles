import { BAG_CAPACITY_START, FLOOR_SEED, INITIAL_RNG_SEED, STARTING_CASH, STAR_CARRY_CAP, energyMax, orderStartSlots, renownStartSeeds, startTiles, type MachineKind, type MineDropId } from './balance'
import { ALL_CROP_IDS, STARTING_CROP, type CropId } from './data/crops'
import type { DistrictId } from './data/districts'
import type { RelicId } from './data/relics'
import type { FieldTraitId, HomeTraitId } from './data/soil'
// state ↔ listings is a cycle of bindings used at call time only
import { PLAIN_LISTING, type Listing } from './listings'
// state → mining is a call-time-only cycle too (mining imports only types from here)
import { rollFloor } from './mining'
import type { BarId, ForgeGoodId, ForgeRecipeId, ItemId, OreId, PickaxeTier } from './data/items'
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
  /** durability per OWNED pickaxe tier; 0 = blunt: still owned, mines by hand until repaired */
  rack: Partial<Record<PickaxeTier, number>>
  /** the rack tier in hand (null = none crafted yet); the mine worker uses it and never switches by itself */
  selectedPickaxe: PickaxeTier | null
  /** every item counts toward bagCapacity (displayed as "Storage") */
  inventory: Partial<Record<ItemId, number>>
  bagCapacity: number
  /** storage upgrade level; each level already added its slots to bagCapacity */
  storageLevel: number
  /** rock = what the current rock drops (rolled when the previous one broke); progress = hits into it */
  vein: { level: number; progress: number; rock: ItemId }
  /** batch 37: the floor grid the player mines; the vein above stays the mine workers' rock */
  floor: FloorState
  /** batch 37: the zone the mine workers dig (null = the deepest zone, vein.level) */
  minerZone: number | null
  /** 🧺 Ore sorting per vein drop: a missing kind is locked; 'sell' sells it the moment it is dug */
  oreSort: Partial<Record<MineDropId, 'keep' | 'sell'>>
  /** 🧺 Keep N bought (batch 32) */
  keepN: boolean
  /** per kind set to Sell on dig: the amount kept in storage before the excess sells (missing = 0) */
  oreKeep: Partial<Record<MineDropId, number>>
  /** after the Tractor (batch 35.2): bars above this amount sell as they leave the furnace (missing = off, keeps all) */
  barKeep: Partial<Record<BarId, number>>
  /** the fuel loader buys one wood into the fire when storage has no coal (batch 35.2) */
  autoBuyWood: boolean
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
  /** ⭐ held (whole); earned only by completing orders, spent only on ⭐ rows (never bought or sold for cash) */
  stars: number
  /** ⭐ Favours bought that live outside the existing ladders (batch 34): Bunkhouse levels, the Seam survey and its aim */
  favours: Favours
  /** renown points per crop (batch 31; absent = 0): home harvests by hand +2, by a worker +1; raises the market floor */
  renown: Partial<Record<CropId, number>>
  /** the listing this run was bought as (batch 36.1): its soil changes grow times; plain = no soil */
  listing: Listing
  /** Orchard Valley's 🌳 fruit tree bed (batch 36.2); null until planted */
  tree: TreeBed | null
  /** Iron Hills' 🔨 forge (batch 36.2) */
  forge: Forge
  /** batch 36.4 dig finds: 🏺 shards held, this run's ✨ / 🦴 totals, the 📖 book (found on the run's first dig) */
  finds: Finds
  /** batch 36.4: relic rules owned this run, in pick order; lost when the farm is sold */
  relics: RelicId[]
  /** batch 36.4: ⚡ banked past max by the 🔋 Reserve relic */
  energyReserve: number
  /** batch 36.5: the 🧭 soil survey — ⭐ levels bought this run, a trait per home bed and per rolled Estate field */
  survey: Survey
}

/** batch 37: one rock of the player's floor grid */
export type FloorRock = { kind: ItemId; hits: number; broken: boolean }

/** batch 37: the floor the player stands on — a FLOOR_COLS × FLOOR_ROWS grid (ladder = the rock hiding the ⬇️),
 * its own mulberry32 stream (never run.rngState), the deepest floor ever reached and whether the ladder is found */
export type FloorState = { n: number; deepest: number; rocks: FloorRock[]; ladder: number; found: boolean; rng: number }

/** batch 36.5: level 0–3; beds always 4 entries (bed k = tiles 6k…6k+5, one sprinkler socket); a field entry exists
 * only once that field's trait is rolled (shorter than fields.list before Lv2), so read it through survey.ts helpers */
export type Survey = {
  level: number
  beds: { trait: HomeTraitId | null; rerolls: number }[]
  fields: { trait: FieldTraitId | null; rerolls: number }[]
}

/** the survey's fresh default: no level, no traits, no rerolls (a fresh run, a migrated save, a sale) */
export function createSurvey(): Survey {
  return { level: 0, beds: Array.from({ length: 4 }, () => ({ trait: null, rerolls: 0 })), fields: [] }
}

/** the dig finds of one run (batch 36.4); shards are the relic currency, the rest are run totals */
export type Finds = { shards: number; starDust: number; ancientSeeds: number; book: boolean }

/** one home bed (tiles 6·bed … 6·bed+5), locked for the run; per tile: ticks toward the next fruit, fruit waiting */
export type TreeBed = { bed: number; crop: CropId; ticks: number[]; stock: number[] }

export type Forge = {
  built: boolean
  /** the player's chosen recipe; null = Off */
  recipe: ForgeRecipeId | null
  /** the loaded cycle (its inputs already spent) */
  job: ForgeRecipeId | null
  progress: number
  tray: Partial<Record<ForgeGoodId, number>>
}

/** what an order may ask for: a crop (filled by harvests) or an item (delivered from storage) */
export type OrderGood = CropId | ItemId
/** tier indexes the balance order tiers (minutes); stars = the ⭐ it pays, set when rolled (the tier's, batch 35.3); an
 * accepted crop order takes every harvest of its crop */
export type Offer = { good: OrderGood; count: number; done: number; tier: number; accepted: boolean; stars: number }
/** batch 34: bunkhouse = ⭐ pool-cap levels; seam = the Seam survey owned; aim = the ore it aims at (null = none) */
export type Favours = { bunkhouse: number; seam: boolean; aim: OreId | null }
/** a slot holds an offer, or counts down to its next one after a discard */
export type OrderSlot = Offer | { cooldownTicks: number }
/** offers has one entry per owned slot once the board is bought (empty before); rerolls = rerolls since the last
 * completed order (batch 35.3, prices the next one) */
export type Orders = { unlocked: boolean; slots: number; offers: OrderSlot[]; rerolls: number }

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
 * One mold per ore kind (batch 33): ore = ore of its kind in its slot (leaves it when a cycle completes); progress =
 * fire ticks into the current cycle (fractional with speed levels); ready = bars waiting in its tray
 */
export type Mold = { ore: number; progress: number; ready: number }

/**
 * fire = burn ticks left (filled with fuel, shared by every mold); smart = fire burns only while a mold smelts; levels =
 * bought furnace-wide levels (0 = base); molds = the owned molds by ore kind (a mold is owned when its key exists; the
 * copper mold comes with the furnace); collectAll = the one-time Collect all button
 */
export type Furnace = {
  built: boolean
  fire: number
  smart: boolean
  levels: { fireCap: number; batch: number; speed: number; tray: number; slot: number }
  molds: Partial<Record<OreId, Mold>>
  collectAll: boolean
  /** ticks of stoking left (batch 34): while > 0 every smelting mold runs ×STOKER.speed at ×STOKER.fire per bar */
  stoked: number
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
 * accumulators — whole tiles to reap / to plant, and maintenance cash accrued past the last whole cash paid. Batch 36.8:
 * rigs = HIRED extra units in hire order (newest last; the Nth entry pays the Nth sign-on on the ONE shared ladder
 * across both kinds), carry.rigFee = management cash accrued past the last whole cash paid.
 */
export type Machines = { harvester: number[]; seeder: number[]; carry: { harvest: number; plant: number; maint: number; rigFee: number }; rigs: MachineKind[] }

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
  /** batch 35: crops fields-plantable without their home harvests (a v26 save's fields access kept over the re-ladder) */
  fieldsGranted: CropId[]
  /** batch 36.4 dig finds, ever; ⭐ from ✨ dust is NOT starsEarned (that stays the orders' total) */
  shardsFound: number
  starDustFound: number
  ancientSeedsFound: number
  /** every relic rule ever picked, no repeats (the 📖 book's lifetime line; survives the sale) */
  relicsEver: RelicId[]
}

export const MULTIPLIER_KEYS = ['growTime', 'sellPrice', 'cost', 'energy', 'moistureDrain'] as const
export type MultiplierKey = (typeof MULTIPLIER_KEYS)[number]
/** one meta upgrade per multiplier, plus the batch-20 deed rows; meta stores levels only, every number is in balance.ts */
export type MetaUpgradeId =
  | MultiplierKey
  | 'startTiles'
  | 'workerSpeed'
  | 'keepLicenses'
  | 'keepFirstCertificates'
  | 'keepRenown'
  | 'keepClerk'
  | 'keepCertificates2'
  | 'mineStart'
  | 'keepBoard'
  | 'keepManager'

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
  /** batch 36.1: the listings roll from (listingSeed, prestigeCount, listingRerolls), never run.rngState;
   * listingRerolls = ⭐ rerolls this sale; districtsPlayed = the district of every sale, in order */
  listingSeed: number
  listingRerolls: number
  districtsPlayed: DistrictId[]
}

export type GameState = { run: RunState; meta: MetaState }

export function createTile(): Tile {
  return { status: 'untilled', growth: 0, moisture: 0, ticksSinceMature: 0 }
}

const META_UPGRADE_KEYS: readonly MetaUpgradeId[] = [...MULTIPLIER_KEYS, 'startTiles', 'workerSpeed', 'keepLicenses', 'keepFirstCertificates', 'keepRenown', 'keepClerk', 'keepCertificates2', 'mineStart', 'keepBoard', 'keepManager']

export function createInitialMeta(): MetaState {
  return {
    prestigeCount: 0,
    upgrades: Object.fromEntries(META_UPGRADE_KEYS.map((key) => [key, 0])) as Record<MetaUpgradeId, number>,
    deeds: 0,
    deedsClaimed: 0,
    runs: [],
    listingSeed: 0,
    listingRerolls: 0,
    districtsPlayed: [],
  }
}

/** what a sold run carries into the next one: the Legacy keep rows' licenses and farm certificates, the ⭐-bought
 * order slots, the lifetime totals (they are Stats totals — and the deed meter reads them) and the ⭐ balance (batch 34,
 * capped at STAR_CARRY_CAP) */
export type RunCarry = {
  licenses: CropId[]
  certificates: WorkerJob[]
  orderSlots: number
  lifetime: Lifetime
  renown: Partial<Record<CropId, number>>
  stars: number
  listing?: Listing
}

/** a run at tick 0: what a new game starts, and what "Sell the farm" starts after it — honors the start-tiles and
 * energy Legacy rows and the keeps */
export function createFreshRun(meta: MetaState, carry?: RunCarry): RunState {
  const kit = (c: CropId) => renownStartSeeds(carry?.renown[c] ?? 0)
  return {
    cash: STARTING_CASH,
    energy: energyMax(0, meta),
    tiles: Array.from({ length: startTiles(meta) }, createTile),
    licenses: carry?.licenses ?? [STARTING_CROP],
    upgrades: { energyMax: 0, energyRegen: 0, sellPrice: 0, fertilizer: 0 },
    counters: { harvests: 0, sales: 0, mines: 0, digs: 0, waters: 0, plants: 0, bars: 0, orders: 0, contractsByHand: 0 },
    tick: 0,
    mineLicense: false,
    rack: {},
    selectedPickaxe: null,
    inventory: {},
    bagCapacity: BAG_CAPACITY_START,
    storageLevel: 0,
    vein: { level: 0, progress: 0, rock: 'stone' },
    floor: { n: 1, deepest: 1, found: false, ...rollFloor(1, 0, null, FLOOR_SEED) },
    minerZone: null,
    oreSort: {},
    keepN: false,
    oreKeep: {},
    barKeep: {},
    autoBuyWood: false,
    furnace: createFurnace(),
    workshop: createWorkshop(),
    fields: createFields(),
    lifetime: carry?.lifetime ?? { cashEarned: 0, energySpent: 0, bars: 0, harvests: {}, wagesPaid: 0, fireBurnt: 0, fireWasted: 0, barsSmelted: 0, workerPlants: 0, workerMines: 0, ironBars: 0, ironBarsSmelted: 0, ordersCompleted: 0, starsEarned: 0, goldBars: 0, goldBarsSmelted: 0, fieldsGranted: [], shardsFound: 0, starDustFound: 0, ancientSeedsFound: 0, relicsEver: [] },
    mastery: {},
    masteredTiers: [],
    rngState: INITIAL_RNG_SEED,
    loan: null,
    // batch 36.6: a renown kit for every licensed crop at tier ≥ 1; a new game starts empty
    seeds: Object.fromEntries((carry?.licenses ?? []).filter((c) => kit(c) > 0).map((c) => [c, kit(c)])),
    autoBuySeeds: true,
    plantCrop: STARTING_CROP,
    tools: { water: 0, harvest: 0, plant: 0 },
    toolN: { water: 1, harvest: 1, plant: 1 },
    toolTier: { water: 0, harvest: 0, plant: 0 },
    workers: { pool: 0, assigned: { plant: 0, water: 0, harvest: 0, ore: 0, fuel: 0, mine: 0, clerk: 0, manager: 0, stoker: 0 }, certificates: carry?.certificates ?? [] },
    market: Object.fromEntries(ALL_CROP_IDS.map((crop) => [crop, 0])) as Record<CropId, number>,
    milestones: {},
    orders: { unlocked: false, slots: carry?.orderSlots ?? orderStartSlots(), offers: [], rerolls: 0 },
    stars: Math.min(carry?.stars ?? 0, STAR_CARRY_CAP),
    favours: { bunkhouse: 0, seam: false, aim: null },
    renown: carry?.renown ?? {},
    listing: carry?.listing ?? PLAIN_LISTING,
    tree: null,
    forge: createForge(),
    // batch 36.4: a fresh (or sold) run owns no finds, rules or reserve — the set bonus is lost on the sale
    finds: { shards: 0, starDust: 0, ancientSeeds: 0, book: false },
    relics: [],
    energyReserve: 0,
    // batch 36.5: the sale resets the survey — no level, no traits, no rerolls carry over
    survey: createSurvey(),
  }
}

export function createInitialState(): GameState {
  const meta = createInitialMeta()
  return { meta, run: createFreshRun(meta) }
}

/** a furnace not yet built: an empty copper mold, no fire, base levels */
export function createFurnace(): Furnace {
  return {
    built: false,
    fire: 0,
    smart: false,
    levels: { fireCap: 0, batch: 0, speed: 0, tray: 0, slot: 0 },
    molds: { copperOre: { ore: 0, progress: 0, ready: 0 } },
    collectAll: false,
    stoked: 0,
  }
}

/** a forge not yet built (batch 36.2): recipe Off, no job, an empty tray */
export function createForge(): Forge {
  return { built: false, recipe: null, job: null, progress: 0, tray: {} }
}

/** a workshop not yet built: four empty bed sockets, no valve */
export function createWorkshop(): Workshop {
  return { built: false, beds: [false, false, false, false], valve: false }
}

/** fields not yet unlocked: no fields, the Tractor's pump tier, an empty tank */
export function createFields(): Fields {
  return { unlocked: false, list: [], pump: 0, tank: 0, machines: createMachines() }
}

/** no machines bought, no rigs hired; the fleet's accumulators start empty */
export function createMachines(): Machines {
  return { harvester: [], seeder: [], carry: { harvest: 0, plant: 0, maint: 0, rigFee: 0 }, rigs: [] }
}
