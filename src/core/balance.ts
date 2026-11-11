// Every tunable number lives here. Read them through the functions, never the tables,
// so prestige multipliers (meta) apply everywhere. 1 tick = 1 second.
import type { CropId } from './data/crops'
import type { UpgradeId } from './data/upgrades'
import { PICKAXE_TIERS, type ItemId, type OreId, type PickaxeTier } from './data/items'
import type { ToolJob } from './data/tools'
import type { WorkerJob } from './data/workers'
import type { CounterId, MetaState, MultiplierKey } from './state'

export const START_TILES = 9
export const TILE_CAP = 24
export const ACTION_ENERGY_COST = 1
export const STARTING_CASH = 20
/** offline catch-up simulates at most 8 hours */
export const OFFLINE_CAP_TICKS = 8 * 3600
/** float residue below this is snapped away (energy to the nearest integer, moisture to 0) */
export const FLOAT_EPSILON = 1e-9

const CROP_BASE: Record<CropId, { growTicks: number; seedCost: number; sellPrice: number; licenseCost: number }> = {
  // 100 ticks with a 60 s moisture bar = water at plant + once more
  radish: { growTicks: 100, seedCost: 2, sellPrice: 10, licenseCost: 0 },
  chilli: { growTicks: 160, seedCost: 5, sellPrice: 25, licenseCost: 50 },
  // license 100 (was 150): affordable after the 2nd radish cycle, so pumpkins planted at ~300 mature by 600
  pumpkin: { growTicks: 240, seedCost: 10, sellPrice: 60, licenseCost: 100 },
  lemon: { growTicks: 360, seedCost: 20, sellPrice: 110, licenseCost: 400 },
  // batch 22: the ladder keeps its compression — sell ×~1.8, seed ×~1.9, floor margin ≥ 2.2×, income/tick rising.
  // Licenses priced from the sim (task 115): ~0.6–1.0 h of the income at each unlock, all bought before the Fields
  tomato: { growTicks: 480, seedCost: 40, sellPrice: 200, licenseCost: 7_000 },
  corn: { growTicks: 620, seedCost: 75, sellPrice: 360, licenseCost: 10_000 },
  grape: { growTicks: 780, seedCost: 140, sellPrice: 640, licenseCost: 15_000 },
  strawberry: { growTicks: 960, seedCost: 260, sellPrice: 1_150, licenseCost: 22_000 },
}
const ROT_GRACE_FACTOR = 2

const MOISTURE_FULL_TICKS = 60

const ENERGY_MAX_BASE = 10
const ENERGY_MAX_PER_LEVEL = 5
const ENERGY_REGEN_BASE = 1 / 3
const ENERGY_REGEN_PER_LEVEL = 0.25 // +25% of base per level
const SELL_PRICE_PER_LEVEL = 0.1 // +10% sell price per level
const FERTILIZER_PER_LEVEL = 0.1 // -10% grow time per level

const UPGRADE_BASE: Record<UpgradeId, { cost: number; growth: number; maxLevel: number }> = {
  energyMax: { cost: 50, growth: 1.6, maxLevel: 10 },
  energyRegen: { cost: 75, growth: 1.7, maxLevel: 10 },
  sellPrice: { cost: 80, growth: 1.6, maxLevel: 5 },
  fertilizer: { cost: 120, growth: 1.7, maxLevel: 5 },
}

/** upgrades hidden from the shop until a run counter reaches `at` */
const UPGRADE_UNLOCK: Partial<Record<UpgradeId, { counter: CounterId; at: number }>> = {
  sellPrice: { counter: 'sales', at: 25 },
  fertilizer: { counter: 'harvests', at: 15 },
}

const TILE_BASE_COST = 100
const TILE_COST_GROWTH = 1.5

const MINE_LICENSE_COST = 50
const WOOD_BUY_COST = 4
// wood sells below its buy price, so buying and reselling wood never makes money. Ore sells ≤ 1 (its value is
// smelting). Bars sell below the sell value of their inputs at the cheapest recipe, so smelting to sell never
// beats selling the ore and coal (batch 24: disposal for a bag full of unused bars, never a profit).
const ITEM_SELL_PRICE = {
  wood: 2,
  stone: 2,
  coal: 4,
  copperOre: 1,
  ironOre: 1,
  goldOre: 1,
  copperBar: 2,
  ironBar: 3,
  goldBar: 5,
} satisfies Partial<Record<ItemId, number>>
export type SellableItemId = keyof typeof ITEM_SELL_PRICE
/** a price in cash plus items from storage, and ⭐ (never scaled by the cost multiplier) */
export type Price = { cash: number; stars?: number } & Partial<Record<ItemId, number>>
// Furnace (round-5 research): built once vein level `vein` is owned.
const FURNACE = { cost: { stone: 20, coal: 5, cash: 150 }, vein: 1 }
// Fuelled furnace (batch 9): fire is kept in burn ticks, one fire unit = FIRE_UNIT_TICKS; a fuel item adds FUEL_UNITS.
// A smelt cycle burns the ore kind's barTicks of fire and turns `ore` × batch ore of the slot's kind (oreSlot ore) into
// batch bars of that ore's bar; it needs tray room for them (ready + batch ≤ trayCap). A copper cycle = 2 units = 1 coal
// or 2 wood, as before; iron burns twice that (4 units, 120 ticks: DECISIONS "Iron tier").
// oreSlot ≥ 2 × the top batch's cycle (2 × 3 × 2 = 12), so a slot short of one cycle always has room for a whole one:
// at 10 a batch-3 slot holding 5 ore could neither smelt (< 6) nor take a loader's cycle (room 5 < 6).
const SMELT = { ore: 2, trayCap: 5, oreSlot: 12 }
const SMELT_ORES: Record<OreId, { bar: ItemId; barTicks: number }> = {
  copperOre: { bar: 'copperBar', barTicks: 60 },
  ironOre: { bar: 'ironBar', barTicks: 120 },
  // gold burns thrice copper: 6 fire units = 3 coal per cycle (batch 16 "Gold core")
  goldOre: { bar: 'goldBar', barTicks: 180 },
}
const FIRE_UNIT_TICKS = 30
const FUEL_UNITS = { coal: 2, wood: 1 }
export type FuelId = keyof typeof FUEL_UNITS
export const FUEL_IDS = Object.keys(FUEL_UNITS) as FuelId[]
/** fire capacity in units per fire-capacity level (index = level) */
const FIRE_CAP_UNITS = [10, 20, 40]
/** bars per cycle per batch level (index = level) */
const BATCH_BARS = [1, 2, 3]
// craft = price of a new one, repair = price to fix a blunt one (below craft), hits = rock hits per mine action.
// Each tier's durability must beat the previous tier's Lv10 lifetime (balance test).
const PICKAXES: Record<PickaxeTier, { craft: Price; repair: Price; durability: number; hits: number }> = {
  wooden: { craft: { wood: 3, cash: 0 }, repair: { wood: 2, cash: 0 }, durability: 25, hits: 2 },
  copper: { craft: { copperBar: 5, cash: 50 }, repair: { copperBar: 2, cash: 0 }, durability: 200, hits: 3 },
  // 1200 beats copper's Lv10 lifetime 200 × (1 + 0.4 × 10) = 1000 (the old 500 guess did not)
  iron: { craft: { ironBar: 5, cash: 200 }, repair: { ironBar: 2, cash: 0 }, durability: 1200, hits: 4 },
  // 6500 beats iron's Lv10 lifetime 1200 × (1 + 0.4 × 10) = 6000
  gold: { craft: { goldBar: 5, cash: 500 }, repair: { goldBar: 2, cash: 0 }, durability: 6500, hits: 5 },
}
/** a rock drops its item after this many hits (stone when unlisted); by hand (no pickaxe, or a blunt one) = HAND_HITS */
const STONE_HITS = 2
const ROCK_HITS: Partial<Record<ItemId, number>> = { copperOre: 3, ironOre: 4, goldOre: 5 }
/** rocks that need at least this pickaxe tier; with less (or by hand) the rock is a stone rock (hits and drop) */
const ROCK_PICKAXE: Partial<Record<ItemId, PickaxeTier>> = { ironOre: 'copper', goldOre: 'iron' }
const HAND_HITS = 1
// Pickaxe mastery: cumulative xp for Lv1 … Lv10 of the first tier; each later tier multiplies them by the factor.
const MASTERY_THRESHOLDS = [10, 25, 45, 70, 100, 140, 190, 250, 320, 400]
const MASTERY_TIER_FACTOR = 2
/** preserve chance (durability not used) = 1 − 1/(1 + PER_LEVEL × L), so lifetime = durability × (1 + 0.4·L) */
const PRESERVE_PER_LEVEL = 0.4
/** each mastered tier adds this to every tier's preserve chance */
const MASTERED_PRESERVE_BONUS = 0.05
const PRESERVE_CAP = 0.8
export const BAG_CAPACITY_START = 20
/** run.rngState for a new run and for migrated v1 saves */
export const INITIAL_RNG_SEED = 0x2f6b1a3d
/** drop weights per vein level (index = level); weights need not sum to 1 */
const VEIN_DROPS: ReadonlyArray<Partial<Record<ItemId, number>>> = [
  { stone: 1 },
  { stone: 0.8, coal: 0.2 },
  { stone: 0.65, coal: 0.2, copperOre: 0.15 },
  { stone: 0.55, coal: 0.2, copperOre: 0.15, ironOre: 0.1 },
  { stone: 0.5, coal: 0.2, copperOre: 0.12, ironOre: 0.1, goldOre: 0.08 },
]
/** the kinds a vein drops: the 🧺 Ore sorting rows */
export const MINE_DROP_IDS = ['stone', 'coal', 'copperOre', 'ironOre', 'goldOre'] as const satisfies ReadonlyArray<ItemId>
export type MineDropId = (typeof MINE_DROP_IDS)[number]
// every convenience costs some of what it eases, priced in what is in surplus at that stage (DECISIONS 'Batch 28.2')
const ORE_SORT_ITEMS: Record<MineDropId, number> = { stone: 30, coal: 15, copperOre: 15, ironOre: 15, goldOre: 10 }
// cash part = 0.5 h of the batch-16 ladder bot's income in its first hour on vein Lv3 (PLAN.md "Batch 28.2 results"):
// 0.5 × its measured 12 842 💰/h, rounded to 💰500
const ORE_SORT_CASH = 6500
/** 🧺 Ore sorting opens at this vein level */
const ORE_SORT_VEIN_LEVEL = 3
// cash part = 0.5–1.5 h of the batch-16 ladder bot's income when the iron tools are done (PLAN.md "Batch 16 results"):
// 0.53 h of its measured 14 118 💰/h in the vein-Lv4 phase, rounded to 💰500
const GOLD_VEIN_CASH = 7500
/** price of vein level index + 1, paid in items from storage and cash; Lv3 (45 items) comes after storage Lv3 (50) */
const VEIN_UPGRADES: ReadonlyArray<Price> = [
  { stone: 25, cash: 100 },
  { stone: 30, coal: 10, cash: 200 },
  { stone: 40, copperBar: 5, cash: 400 },
  { stone: 45, ironBar: 8, cash: GOLD_VEIN_CASH },
]
/** vein levels from this one up need the furnace */
const VEIN_FURNACE_LEVEL = 2
/** vein levels from this one up need the iron pickaxe owned (Lv4 drops gold rocks) */
const VEIN_PICKAXE_LEVEL = 4
// Storage upgrade (the stone sink): +slots capacity per level; level 1 costs the base, stone +stoneStep per level
// (so each price fits the capacity before it), cash ×growth per level.
const STORAGE = { slots: 10, stone: 15, stoneStep: 5, cash: 50, growth: 1.6, maxLevel: 10 }

// Farm tools (PLAN.md batch 5 starting numbers): per job, the counter that unlocks each level and the level's
// one-time price; levels[0] is level 1. Level 2 does toolN tiles per press, 1 … ceil(tiles × TOOL_N_RATIO).
const TOOL_LEVELS: Record<ToolJob, { counter: CounterId; levels: ReadonlyArray<{ at: number; cost: number }> }> = {
  water: { counter: 'waters', levels: [{ at: 20, cost: 40 }, { at: 60, cost: 120 }, { at: 150, cost: 300 }] },
  harvest: { counter: 'harvests', levels: [{ at: 15, cost: 50 }, { at: 50, cost: 150 }, { at: 120, cost: 350 }] },
  plant: { counter: 'plants', levels: [{ at: 15, cost: 40 }, { at: 50, cost: 120 }, { at: 120, cost: 300 }] },
}
const TOOL_N_RATIO = 1 / 3
// Material tier per farm job (batch 7.1 copper, batch 15 iron, batch 16 gold for the sickle and dibber only; index =
// tier, 0 basic, 1 copper, 2 iron, 3 gold). Watering fills moisture to WATER_MOISTURE; harvest yields 2 crops with
// DOUBLE_HARVEST chance; planting keeps the seed with SEED_KEEP chance. TOOL_TIER_COST[t − 1] = price of tier t, the
// same for every job; tier t needs tier t − 1 of the job. No gold can: iron is the last watering can.
const WATER_MOISTURE = [1, 2, 4]
const DOUBLE_HARVEST = [0, 0.1, 0.2, 0.3]
const SEED_KEEP = [0, 0.2, 0.35, 0.5]
// cash part = 0.5–1.5 h of the batch-15 ladder bot's income when the mine certificate lands (PLAN.md "Batch 15 results")
const IRON_TOOL_CASH = 10000
// cash part = 0.5–1.5 h of the batch-16 ladder bot's income when the gold vein lands (PLAN.md "Batch 16 results"):
// 0.75 h of its measured 13 415 💰/h in the gold-tool phase, rounded to 💰500
const GOLD_TOOL_CASH = 10000
const TOOL_TIER_COST: ReadonlyArray<Price> = [
  { copperBar: 4, cash: 100 },
  { ironBar: 4, cash: IRON_TOOL_CASH },
  { goldBar: 4, cash: GOLD_TOOL_CASH },
]

// Workers v1 (batch 8, DECISIONS "Workers v1"): hire k (pool k − 1 → k) costs HIRE_BASE × HIRE_GROWTH^(k − 1), pool
// capped; the hire button needs HIRE_UNLOCK. A job takes workers once its certificate is bought (needs its unlock
// counter). Every WORKER_ACTION_TICKS each assigned worker does one action of its job, paid its WORKER_WAGES at that moment.
const WORKER_HIRE_BASE = 150
const WORKER_HIRE_GROWTH = 1.7
const WORKER_POOL_CAP = 6
const WORKER_HIRE_UNLOCK: { counter: CounterId; at: number } = { counter: 'harvests', at: 30 }
const WORKER_ACTION_TICKS = 5
// batch 29: the Manager's 💰28 per chip it changes (calculator 2026-11-11: ≈ 💰20,000/h if it changed one every round)
const WORKER_WAGES: Record<WorkerJob, number> = { plant: 1, water: 1, harvest: 1, ore: 1, fuel: 1, mine: 1, clerk: 1, manager: 28 }
// `vein` = the vein level that must be owned as well; `tool` = the job's farm-tool level that must be owned (batch 13:
// a worker replaces a press, so the press comes first at its top level)
const CERTIFICATES: Record<WorkerJob, { price: Price; counter: CounterId; at: number; vein?: number; tool?: number }> = {
  // plant worker (batch 10): copper bars, so the mine → furnace path comes first
  plant: { price: { copperBar: 10, cash: 300 }, counter: 'plants', at: 60, tool: 3 },
  water: { price: { stone: 20, cash: 500 }, counter: 'waters', at: 40, tool: 3 },
  harvest: { price: { stone: 20, coal: 5, cash: 750 }, counter: 'harvests', at: 40, tool: 3 },
  // furnace loaders (batch 9): gated by copper bars collected, paid in bars
  ore: { price: { copperBar: 3, cash: 100 }, counter: 'bars', at: 10 },
  fuel: { price: { copperBar: 8, cash: 200 }, counter: 'bars', at: 30 },
  // mine worker (batch 11): iron bars, one metal tier above the farm and furnace workers
  mine: { price: { ironBar: 5, cash: 500 }, counter: 'mines', at: 200, vein: 3 },
  // order clerk (batch 14): ⭐ + copper bars after 20 orders completed
  clerk: { price: { stars: 20, copperBar: 6, cash: 200 }, counter: 'orders', at: 20 },
  // Manager (batch 29): 3 contracts completed by hand; the price is pinned by the batch 29 sim (certificate hours)
  manager: { price: { goldBar: 4, cash: 500000 }, counter: 'contractsByHand', at: 3 },
}
// Furnace upgrades (batch 9): price of level index + 1. fireCap levels index FIRE_CAP_UNITS, batch levels BATCH_BARS
// (one fewer price than entries); smart is one-time and costs more than the fuel loader's certificate.
const FURNACE_UPGRADES: Record<'fireCap' | 'batch' | 'smart', ReadonlyArray<Price>> = {
  fireCap: [
    { copperBar: 4, cash: 150 },
    { copperBar: 8, cash: 300 },
  ],
  batch: [
    { copperBar: 6, cash: 200 },
    { copperBar: 12, cash: 400 },
  ],
  smart: [{ copperBar: 10, cash: 400 }],
}
export type FurnaceUpgradeId = keyof typeof FURNACE_UPGRADES
export const FURNACE_UPGRADE_IDS = Object.keys(FURNACE_UPGRADES) as FurnaceUpgradeId[]

// Workshop (batch 17, permanent bed sockets since batch 26, DECISIONS "Workshop + sprinklers"): a Shop card once
// vein Lv4 is owned. A sprinkler is built once on a bed's socket (SPRINKLER_MAX beds, six tiles each) and keeps
// those tiles at full water forever — no coal, no upkeep, no moving or selling. The one-time smart valve stops the
// Fields' idle burn: pivots burn tank coal only for growing plots (batch 28). Workshop goods are never orderable.
const WORKSHOP_VEIN_LEVEL = 4
const SPRINKLER_MAX = 4
// cash parts = 0.5–1.5 h of the batch-17 ladder bot's income at each purchase (pinned in PLAN.md "Batch 17 results")
const WORKSHOP_CASH = 8500
const SPRINKLER_CASH = 8000
const VALVE_CASH = 8000
const WORKSHOP_COST: Price = { stone: 30, ironBar: 6, cash: WORKSHOP_CASH }
const SPRINKLER_COST: Price = { goldBar: 4, ironBar: 8, copperBar: 8, cash: SPRINKLER_CASH }
const VALVE_COST: Price = { goldBar: 2, cash: VALVE_CASH }

export function workshopCost(meta: MetaState): Price {
  return scalePrice(WORKSHOP_COST, meta)
}

/** the vein level the workshop needs */
export function workshopVeinLevel(): number {
  return WORKSHOP_VEIN_LEVEL
}

export function sprinklerCost(meta: MetaState): Price {
  return scalePrice(SPRINKLER_COST, meta)
}

/** bed sockets one workshop holds (one sprinkler per bed, six tiles each) */
export function sprinklerMax(): number {
  return SPRINKLER_MAX
}

export function valveCost(meta: MetaState): Price {
  return scalePrice(VALVE_COST, meta)
}

// Fields (batch 18, DECISIONS "Fields part 1"; plots, pivots and pumps since batch 28, DECISIONS "Batch 28 refined").
// The unlock card needs every farm job covered by worker or machine (planter + harvester certificates, ≥ 1
// sprinkler); a crop is fields-plantable after FIELDS_CROP_HARVESTS home-plot harvests of it. Land comes a plot
// (PLOT_TILES tiles) at a time, priced as the sum of its tiles at FIELDS_TILE_BASE × (tile index + 1); a field holds
// FIELD_PLOTS plots and is sowable once its pivot is built; the pump tier caps the wet fields and sizes the coal
// tank. A full tank grows every pivoted field ×FIELD_PRESSURE; an empty one ×1 — fields never stall or die.
const FIELDS_TILE_BASE = 100
const FIELDS_CROP_HARVESTS = 50
// cash parts = 0.5–1.5 h of the batch-18 ladder bot's income at each purchase (pinned in PLAN.md "Batch 18 results")
const FIELDS_CASH = 10000
const FIELDS_COST: Price = { ironBar: 10, cash: FIELDS_CASH }
const PLOT_TILES = 10
const FIELD_PLOTS = 5
export const FIELD_PRESSURE = 2 // named and displayed: a full tank grows fields ×2
const PUMP_FIELD_CAP = [2, 6, 12, 20] // index = pump tier owned
const PUMP_COSTS: ReadonlyArray<Price> = [
  { copperBar: 8, cash: 500000 }, { ironBar: 8, cash: 1500000 }, { goldBar: 8, cash: 3000000 },
]
const PIVOT_ITEMS: Price = { goldBar: 3, ironBar: 6, copperBar: 6, cash: 0 }
const PIVOT_CASH_STEP = 50000 // pivot n costs PIVOT_ITEMS + 50,000 × (n − 1), n = 2…20
const FIELD_COAL_PER_PLOT_HOUR = 0.5 // was PIPE_COAL_PER_10_TILES
export const TANK_UNITS_PER_COAL = 7200 // 1 burn unit = 1 plot for 1 tick (0.5 coal / plot / h)
const REAP_PLOT_ENERGY = 10

export function fieldsCost(meta: MetaState): Price {
  return scalePrice(FIELDS_COST, meta)
}

/** the (count + 1)-th field tile's price */
export function fieldTileCost(count: number, meta: MetaState): number {
  return Math.round(FIELDS_TILE_BASE * (count + 1) * multiplier(meta, 'cost'))
}

/** home-plot harvests of a crop before it can be planted in the Fields */
export function fieldsCropHarvests(): number {
  return FIELDS_CROP_HARVESTS
}

/** tiles in one plot (the unit of land and work) */
export function plotTiles(): number {
  return PLOT_TILES
}

/** plots in one field (the unit of water and crop) */
export function fieldPlots(): number {
  return FIELD_PLOTS
}

/** the next plot's price with `plots` owned: the sum of its ten tiles' prices (💰10,000·p + 5,500 at base) */
export function plotCost(plots: number, meta: MetaState): number {
  let sum = 0
  for (let i = 0; i < PLOT_TILES; i++) sum += fieldTileCost(PLOT_TILES * plots + i, meta)
  return sum
}

/** pivot n's recipe (n = 1 … 20; the first comes with the Tractor) */
export function pivotCost(n: number, meta: MetaState): Price {
  return scalePrice({ ...PIVOT_ITEMS, cash: PIVOT_CASH_STEP * (n - 1) }, meta)
}

/** the next pump tier's recipe with `pump` owned, null at the top */
export function pumpCost(pump: number, meta: MetaState): Price | null {
  const price = PUMP_COSTS[pump]
  return price ? scalePrice(price, meta) : null
}

/** the top pump tier (pump 1 … this are Estate recipes) */
export function pumpMaxTiers(): number {
  return PUMP_COSTS.length
}

/** wet fields (pivots) the owned pump tier feeds */
export function pumpFieldCap(pump: number): number {
  return PUMP_FIELD_CAP[Math.min(pump, PUMP_FIELD_CAP.length - 1)]
}

/** whole coal the tank holds at this pump tier: 8 h of burn at the cap (40 / 120 / 240 / 400) */
export function tankCapCoal(pump: number): number {
  return 8 * pumpFieldCap(pump) * FIELD_PLOTS * FIELD_COAL_PER_PLOT_HOUR
}

export function fieldCoalPerPlotHour(): number {
  return FIELD_COAL_PER_PLOT_HOUR
}

/** ⚡ one hand reap of a whole plot costs */
export function reapPlotEnergy(): number {
  return REAP_PLOT_ENERGY
}

// Machines (batch 19, DECISIONS "Fields part 2"; whole plots since batch 28): Workshop recipes that work the Fields. A
// harvester reaps ready plots before the harvester workers (machines first, workers fill the gap); a seeder sows whole
// plots through the same seed rules as the planter. Max 1 of each tier; tiers stack. Coal-free — each machine pays
// MACHINE_MAINT cash per live hour worked (never a % of holdings); watering stays the pivots'. A tier's recipe needs
// its job's worker certificate first (manual → worker → machine).
export type MachineKind = 'harvester' | 'seeder'
const MACHINE_TILES_PER_HOUR: Record<MachineKind, ReadonlyArray<number>> = {
  harvester: [1800, 3600, 7200],
  seeder: [1800, 3600],
}
const MACHINE_MAINT: ReadonlyArray<number> = [60, 120, 240]
// cash parts = 0.5–1.5 h of the batch-19 ladder bot's income at each purchase (pinned in PLAN.md "Batch 19 results");
// tier 2 costs 2.5 h of the pre-machine income — after the tier-1 pair the bot's income triples, so the old 100 000
// landed at 0.26 h; the seeder tiers cost their harvester equals (same throughput, one tier fewer)
const MACHINE_CASH: ReadonlyArray<number> = [50000, 250000, 350000]
const MACHINE_COSTS: Record<MachineKind, ReadonlyArray<Price>> = {
  harvester: [
    { ironBar: 12, cash: MACHINE_CASH[0]! },
    { ironBar: 24, goldBar: 4, cash: MACHINE_CASH[1]! },
    { goldBar: 12, cash: MACHINE_CASH[2]! },
  ],
  seeder: [
    { ironBar: 12, cash: MACHINE_CASH[0]! },
    { ironBar: 24, goldBar: 4, cash: MACHINE_CASH[1]! },
  ],
}

/** tiers a machine kind has (harvester 3, seeder 2) */
export function machineMaxTiers(kind: MachineKind): number {
  return MACHINE_TILES_PER_HOUR[kind].length
}

/** tiles per hour one machine of this kind and tier (1-based) reaps / plants */
export function machineTilesPerHour(kind: MachineKind, tier: number): number {
  return MACHINE_TILES_PER_HOUR[kind][tier - 1]!
}

/** flat maintenance cash per live hour this machine tier costs while it works */
export function machineMaintPerHour(tier: number): number {
  return MACHINE_MAINT[tier - 1]!
}

export function machineCost(kind: MachineKind, tier: number, meta: MetaState): Price {
  return scalePrice(MACHINE_COSTS[kind][tier - 1]!, meta)
}

/** dig for seeds (farm action): chance per dig of one seed of this crop */
const DIG_SEED_CROP: CropId = 'radish'
const DIG_SEED_CHANCE = 0.2

// Bank v0 placeholders (PLAN.md batch 4.5): debt starts at principal × (1 + fee) and grows by
// principal × rate per tick up to principal × cap (33 → 60 in 450 ticks).
const LOAN_PRINCIPAL = 30
const LOAN_FEE = 0.1
const LOAN_RATE_PER_TICK = 0.002
const LOAN_DEBT_CAP = 2.0
/** the Bank tab's partial-repay button */
const LOAN_REPAY_STEP = 10

// Crop market (batch 12, DECISIONS "Crop market"): glut per crop halves every MARKET_HALF_LIFE_TICKS and each unit
// sold while glut g stands lowers the price by 0.5 × g / depth; the depth scales with the crop's base grow ticks,
// so fertilizer speeds harvests and deepens the glut (intended). Items are not in the market.
export const MARKET_HALF_LIFE_TICKS = 900
export const MARKET_DECAY = 0.5 ** (1 / MARKET_HALF_LIFE_TICKS)
export const MARKET_FLOOR = 0.5
/** tiles of one crop that glut a market to the floor at a continuous harvest (batch 16: 120 → 60; batch 21: 60 → 240) */
export const MARKET_DEPTH_TILES = 240
// Hand-picked (batch 13, DECISIONS "Early-game pacing"): a crop the player harvests (energy spent) sells at this ×
// the market price, per unit after the market factor; workers sell at ×1
const HAND_PICKED_BONUS = 1.25

/** sale multiplier of a crop the player harvested by hand (tap or tool press) */
export function handPickedBonus(): number {
  return HAND_PICKED_BONUS
}

// Noticeboard (batch 14, DECISIONS "📋 Noticeboard + ⭐", docs/research/orders.md): a Shop purchase shown after
// ORDER_BOARD.at sales. An order's count = its tier's minutes × what the player makes per minute (crops: tiles ÷ grow
// ticks × 60; vein items: ORDER_ROCKS_PER_MIN × drop share; bars: furnace bars per minute), so ⭐ is paced by time.
// Item counts are clamped to half the storage capacity. Ordered crops pay base × (1 + ORDER_BOARD.bonus) and add no
// glut; delivered items pay base value × bonus. A discarded order's slot refills after ORDER_COOLDOWN_TICKS.
const ORDER_BOARD: { cost: Price; counter: CounterId; at: number; bonus: number; slots: number } = {
  cost: { stone: 10, cash: 100 },
  counter: 'sales',
  at: 50,
  // batch 16: 0.25 → 0.10 (batch 14 measured +27–41 % income; the goal was +12–18 %)
  bonus: 0.1,
  slots: 2,
}
const ORDER_TIERS: ReadonlyArray<{ minutes: number; weight: number; stars: number }> = [
  { minutes: 5, weight: 0.5, stars: 1 },
  { minutes: 10, weight: 0.35, stars: 2 },
  { minutes: 20, weight: 0.15, stars: 4 },
]
// batch 29: after the Tractor a crop order (a 🚜 contract) is sized by this share of the wet tiles' pressured output
const CONTRACT_WET_SHARE = 0.15
const ORDER_ROCKS_PER_MIN = 12
/** an item order asks for at most this share of the storage capacity (rounded down) */
const ORDER_ITEM_BAG_SHARE = 0.5
const ORDER_COOLDOWN_TICKS = 600
// ⭐ shop (task 81): ⭐ for each slot past the starting ones (3rd, 4th), and for a reroll (every slot without an
// accepted order gets a fresh offer now, cooldowns skipped). Only ⭐ buys these; nothing here sells for cash.
const ORDER_SLOT_STARS = [10, 30]
const ORDER_REROLL_STARS = 2

/** the Noticeboard's price */
export function orderBoardCost(meta: MetaState): Price {
  return scalePrice(ORDER_BOARD.cost, meta)
}

/** the board shows (and can be bought) once counters[counter] ≥ at */
export function orderBoardUnlock(): { counter: CounterId; at: number } {
  return { counter: ORDER_BOARD.counter, at: ORDER_BOARD.at }
}

/** order slots a new board has */
export function orderStartSlots(): number {
  return ORDER_BOARD.slots
}

/** extra share of the base price an ordered good pays */
export function orderBonus(): number {
  return ORDER_BOARD.bonus
}

/** share of the wet tiles' pressured output a contract asks per minute */
export function contractWetShare(): number {
  return CONTRACT_WET_SHARE
}

export function orderTierCount(): number {
  return ORDER_TIERS.length
}

/** minutes of production an order of this tier asks for */
export function orderTierMinutes(tier: number): number {
  return ORDER_TIERS[tier].minutes
}

/** ⭐ for completing an order of this tier */
export function orderTierStars(tier: number): number {
  return ORDER_TIERS[tier].stars
}

/** the tier a roll r in [0, 1) lands on, by weight */
export function rollOrderTier(r: number): number {
  let x = r * ORDER_TIERS.reduce((sum, t) => sum + t.weight, 0)
  const tier = ORDER_TIERS.findIndex((t) => (x -= t.weight) < 0)
  return tier < 0 ? ORDER_TIERS.length - 1 : tier
}

/** rocks per minute an item order's count assumes */
export function orderRocksPerMin(): number {
  return ORDER_ROCKS_PER_MIN
}

/** the largest item order count a storage of this capacity gets */
export function orderItemCap(bagCapacity: number): number {
  return Math.floor(bagCapacity * ORDER_ITEM_BAG_SHARE)
}

export function orderCooldownTicks(): number {
  return ORDER_COOLDOWN_TICKS
}

export function orderMaxSlots(): number {
  return ORDER_BOARD.slots + ORDER_SLOT_STARS.length
}

/** ⭐ for the next slot when `slots` are owned; null at the max */
export function orderSlotStars(slots: number): number | null {
  return ORDER_SLOT_STARS[slots - ORDER_BOARD.slots] ?? null
}

export function orderRerollStars(): number {
  return ORDER_REROLL_STARS
}

// Prestige deeds (batch 12, DECISIONS "Deeds"): one deed per √(lifetime cash / DEED_DIVISOR); "Sell the farm"
// (batch 20) grants and spends them. The Stats deed meter is read through deedsFor.
export const DEED_DIVISOR = 10000
/** the sale opens at this many lifetime-cash deeds AND every farm job covered by worker or machine */
export const PRESTIGE_GATE_DEEDS = 8
/** the ⭐ balance converts to deeds at this rate when the farm is sold (floored) */
export const STARS_PER_DEED = 25
/** how many sold runs meta.runs keeps */
export const RUN_HISTORY_CAP = 20

/**
 * Effect of one multiplier-row level (level 0 = ×1). The batch-20 deed prices retuned these (DECISIONS "Sell the
 * farm"): growTime / cost −4 %, sellPrice +5 %. energy's deed row is flat (+2 max, see energyMax), so its step is 1
 * and only a legacy multiplier moves it; moistureDrain has no deed row (legacy only).
 */
const META_UPGRADE_STEP: Record<MultiplierKey, number> = { growTime: 0.96, sellPrice: 1.05, cost: 0.96, energy: 1, moistureDrain: 0.95 }
/** flat max-energy per Legacy "energy" level */
const META_ENERGY_MAX_FLAT = 2
/** extra starting tiles per Legacy "start tiles" level */
const META_START_TILES_PER_LEVEL = 2
/** seconds shaved off the worker clock per Legacy "worker speed" level */
const META_WORKER_SPEED_STEP = 0.5

/** tiles a fresh run starts with (Legacy "start tiles" row) */
export function startTiles(meta: MetaState): number {
  return START_TILES + META_START_TILES_PER_LEVEL * meta.upgrades.startTiles
}

/**
 * The 🏆 Legacy deed rows: levels on the meta upgrade table bought with deeds. Level prices 2 / 4 / 8 / 16 / 32
 * (2^level, the research curve); the two one-time keeps are fixed. No row multiplies ⭐, deeds or mining.
 */
export const DEED_ROW_IDS = ['growTime', 'sellPrice', 'cost', 'energy', 'startTiles', 'workerSpeed', 'keepLicenses', 'keepFirstCertificates'] as const
export type DeedRowId = (typeof DEED_ROW_IDS)[number]
const DEED_MAX_LEVEL: Record<DeedRowId, number> = {
  growTime: 5,
  sellPrice: 5,
  cost: 5,
  energy: 5,
  startTiles: 3,
  workerSpeed: 2,
  keepLicenses: 1,
  keepFirstCertificates: 1,
}
const DEED_ONE_TIME_COST: Partial<Record<DeedRowId, number>> = { keepLicenses: 2, keepFirstCertificates: 3 }

export const deedMaxLevel = (id: DeedRowId): number => DEED_MAX_LEVEL[id]

/** deeds for the row's next level (2 / 4 / 8 / 16 / 32); the fixed price for the one-time keeps */
export function deedCost(id: DeedRowId, level: number): number {
  return DEED_ONE_TIME_COST[id] ?? 2 ** (level + 1)
}

export function multiplier(meta: MetaState, key: MultiplierKey): number {
  return META_UPGRADE_STEP[key] ** meta.upgrades[key] * (meta.legacyMultipliers?.[key] ?? 1)
}

/** glut (units) at which this crop's price factor bottoms out; deeper for slower crops */
export function marketDepthGlut(cropId: CropId): number {
  return MARKET_DEPTH_TILES / (CROP_BASE[cropId].growTicks * (1 - MARKET_DECAY))
}

/** sale price factor at this glut: 1 with no glut, sinking to MARKET_FLOOR at the depth glut */
export function marketFactor(cropId: CropId, glut: number): number {
  return Math.max(MARKET_FLOOR, 1 - (0.5 * glut) / marketDepthGlut(cropId))
}

/** ticks until the factor is back at 0.99 with no more sales; 0 when it is at or past it */
export function marketRecoveryTicks(cropId: CropId, glut: number): number {
  const target = 0.02 * marketDepthGlut(cropId)
  if (glut <= target) return 0
  return Math.ceil(Math.log(target / glut) / Math.log(MARKET_DECAY))
}

/** deeds held for this much lifetime cash ("Sell the farm" spends them, batch 13) */
export function deedsFor(lifetimeCash: number): number {
  return Math.floor(Math.sqrt(lifetimeCash / DEED_DIVISOR))
}

/** whole ticks; fertilizer shortens growth of crops already in the ground too */
export function cropGrowTicks(cropId: CropId, meta: MetaState, fertilizerLevel: number): number {
  return Math.round(CROP_BASE[cropId].growTicks * growTimeFactor(fertilizerLevel) * multiplier(meta, 'growTime'))
}

/** based on the unfertilized grow time, so fertilizer never shortens the harvest window */
export function cropRotGraceTicks(cropId: CropId, meta: MetaState): number {
  return ROT_GRACE_FACTOR * cropGrowTicks(cropId, meta, 0)
}

export function cropSeedCost(cropId: CropId, meta: MetaState): number {
  return Math.round(CROP_BASE[cropId].seedCost * multiplier(meta, 'cost'))
}

/** applies the sellPrice upgrade and the meta multiplier to a base price */
function sellPrice(base: number, meta: MetaState, sellPriceLevel: number): number {
  return Math.round(base * sellPriceFactor(sellPriceLevel) * multiplier(meta, 'sellPrice'))
}

export function cropSellPrice(cropId: CropId, meta: MetaState, sellPriceLevel: number): number {
  return sellPrice(CROP_BASE[cropId].sellPrice, meta, sellPriceLevel)
}

export function licenseCost(cropId: CropId, meta: MetaState): number {
  return Math.round(CROP_BASE[cropId].licenseCost * multiplier(meta, 'cost'))
}

/** moisture lost per tick; full (1) empties in MOISTURE_FULL_TICKS */
export function moistureDrainPerTick(meta: MetaState): number {
  return (1 / MOISTURE_FULL_TICKS) * multiplier(meta, 'moistureDrain')
}

export function energyMax(level: number, meta: MetaState): number {
  return (ENERGY_MAX_BASE + ENERGY_MAX_PER_LEVEL * level + META_ENERGY_MAX_FLAT * meta.upgrades.energy) * multiplier(meta, 'energy')
}

export function energyRegenPerTick(level: number, meta: MetaState): number {
  return ENERGY_REGEN_BASE * (1 + ENERGY_REGEN_PER_LEVEL * level) * multiplier(meta, 'energy')
}

/** cost to buy the next level when the upgrade is currently at `level` */
export function upgradeCost(upgradeId: UpgradeId, level: number, meta: MetaState): number {
  const { cost, growth } = UPGRADE_BASE[upgradeId]
  return Math.round(cost * growth ** level * multiplier(meta, 'cost'))
}

export function upgradeMaxLevel(upgradeId: UpgradeId): number {
  return UPGRADE_BASE[upgradeId].maxLevel
}

export function upgradeUnlocked(upgradeId: UpgradeId, counters: Record<CounterId, number>): boolean {
  const unlock = UPGRADE_UNLOCK[upgradeId]
  return !unlock || counters[unlock.counter] >= unlock.at
}

/** sellPrice upgrade: multiplier on base sell prices */
export function sellPriceFactor(level: number): number {
  return 1 + SELL_PRICE_PER_LEVEL * level
}

/** fertilizer upgrade: multiplier on base grow time */
export function growTimeFactor(level: number): number {
  return 1 - FERTILIZER_PER_LEVEL * level
}

export function mineLicenseCost(meta: MetaState): number {
  return Math.round(MINE_LICENSE_COST * multiplier(meta, 'cost'))
}

export function woodCost(meta: MetaState): number {
  return Math.round(WOOD_BUY_COST * multiplier(meta, 'cost'))
}

export function isSellable(itemId: ItemId): itemId is SellableItemId {
  return itemId in ITEM_SELL_PRICE
}

export function itemSellPrice(itemId: SellableItemId, meta: MetaState, sellPriceLevel: number): number {
  return sellPrice(ITEM_SELL_PRICE[itemId], meta, sellPriceLevel)
}

/** items as they are, cash × the cost multiplier */
function scalePrice({ cash, ...items }: Price, meta: MetaState): Price {
  return { ...items, cash: Math.round(cash * multiplier(meta, 'cost')) }
}

export function furnaceCost(meta: MetaState): Price {
  return scalePrice(FURNACE.cost, meta)
}

/** the vein level the furnace needs */
export function furnaceVeinLevel(): number {
  return FURNACE.vein
}

/** ore per bar (copper and iron alike) */
export function smeltOre(): number {
  return SMELT.ore
}

/** items of this fuel one cycle of this ore burns (copper: coal 1, wood 2; iron twice that) */
export function smeltFuel(fuel: FuelId, ore: OreId = 'copperOre'): number {
  return barTicks(ore) / fuelTicks(fuel)
}

/** fire ticks one cycle of this ore burns (copper 60, iron 120) */
export function barTicks(ore: OreId = 'copperOre'): number {
  return SMELT_ORES[ore].barTicks
}

/** the bar this ore smelts into */
export function oreBar(ore: OreId): ItemId {
  return SMELT_ORES[ore].bar
}

/** burn ticks per fire unit */
export function fireUnitTicks(): number {
  return FIRE_UNIT_TICKS
}

/** fire units one item of this fuel adds (wood 1, coal 2) */
export function fuelUnits(fuel: FuelId): number {
  return FUEL_UNITS[fuel]
}

/** burn ticks one item of this fuel adds */
export function fuelTicks(fuel: FuelId): number {
  return FUEL_UNITS[fuel] * FIRE_UNIT_TICKS
}

/** fire capacity in units at this fire-capacity level */
export function fireCapUnits(level: number): number {
  return FIRE_CAP_UNITS[level]
}

/** fire capacity in burn ticks at this fire-capacity level */
export function fireCapTicks(level: number): number {
  return FIRE_CAP_UNITS[level] * FIRE_UNIT_TICKS
}

/** bars one cycle makes at this batch level */
export function batchBars(level: number): number {
  return BATCH_BARS[level]
}

/** bars the output tray holds */
export function furnaceTrayCap(): number {
  return SMELT.trayCap
}

/** ore the furnace's ore slot holds */
export function oreSlotCap(): number {
  return SMELT.oreSlot
}

export function furnaceUpgradeMaxLevel(id: FurnaceUpgradeId): number {
  return FURNACE_UPGRADES[id].length
}

/** price to go from `level` to level + 1; null at the max level */
export function furnaceUpgradeCost(id: FurnaceUpgradeId, level: number, meta: MetaState): Price | null {
  const cost = FURNACE_UPGRADES[id][level]
  return cost ? scalePrice(cost, meta) : null
}

export function pickaxeDurability(tier: PickaxeTier): number {
  return PICKAXES[tier].durability
}

export function pickaxeCraftCost(tier: PickaxeTier, meta: MetaState): Price {
  return scalePrice(PICKAXES[tier].craft, meta)
}

export function pickaxeRepairCost(tier: PickaxeTier, meta: MetaState): Price {
  return scalePrice(PICKAXES[tier].repair, meta)
}

/** hits a rock that drops `rock` takes to break */
export function rockHits(rock: ItemId): number {
  return ROCK_HITS[rock] ?? STONE_HITS
}

/** the lowest pickaxe tier that mines this rock as itself; null = any, by hand too */
export function rockPickaxe(rock: ItemId): PickaxeTier | null {
  return ROCK_PICKAXE[rock] ?? null
}

/** hits per mine action; null = by hand */
export function mineHits(tier: PickaxeTier | null): number {
  return tier ? PICKAXES[tier].hits : HAND_HITS
}

/** cumulative xp for Lv1 … max of this tier */
export function masteryThresholds(tier: PickaxeTier): number[] {
  return MASTERY_THRESHOLDS.map((xp) => xp * MASTERY_TIER_FACTOR ** PICKAXE_TIERS.indexOf(tier))
}

export function masteryMaxLevel(): number {
  return MASTERY_THRESHOLDS.length
}

export function masteryLevel(tier: PickaxeTier, xp: number): number {
  return masteryThresholds(tier).filter((at) => xp >= at).length
}

/** chance a pickaxe mine action keeps its durability; mastered tiers add their bonus, then the cap applies */
export function preserveChance(level: number, masteredTiers: number): number {
  return Math.min(PRESERVE_CAP, 1 - 1 / (1 + PRESERVE_PER_LEVEL * level) + MASTERED_PRESERVE_BONUS * masteredTiers)
}

/** preserve chance each mastered tier adds to every tier */
export function masteredPreserveBonus(): number {
  return MASTERED_PRESERVE_BONUS
}

export function veinDrops(level: number): Partial<Record<ItemId, number>> {
  return VEIN_DROPS[Math.min(level, VEIN_DROPS.length - 1)]
}

/** price to unlock Sell on dig for one kind: some of that kind plus the cash part */
export function oreSortUnlockCost(kind: MineDropId, meta: MetaState): Price {
  return scalePrice({ [kind]: ORE_SORT_ITEMS[kind], cash: ORE_SORT_CASH }, meta)
}

export function oreSortVeinLevel(): number {
  return ORE_SORT_VEIN_LEVEL
}

export function veinMaxLevel(): number {
  return VEIN_UPGRADES.length
}

/** price to go from `level` to level + 1; null at the max level */
export function veinUpgradeCost(level: number, meta: MetaState): Price | null {
  const cost = VEIN_UPGRADES[level]
  return cost ? scalePrice(cost, meta) : null
}

export function veinNeedsFurnace(level: number): boolean {
  return level >= VEIN_FURNACE_LEVEL
}

/** vein levels from this one up need the iron pickaxe owned (their gold rocks break weaker ones) */
export function veinNeedsPickaxe(level: number): boolean {
  return level >= VEIN_PICKAXE_LEVEL
}

export function storageMaxLevel(): number {
  return STORAGE.maxLevel
}

/** capacity each storage level adds */
export function storageSlotsPerLevel(): number {
  return STORAGE.slots
}

/** whole-number price to go from `level` to level + 1 */
export function storageCost(level: number, meta: MetaState): { stone: number; cash: number } {
  return {
    stone: STORAGE.stone + STORAGE.stoneStep * level,
    cash: Math.round(STORAGE.cash * STORAGE.growth ** level * multiplier(meta, 'cost')),
  }
}

export function toolMaxLevel(job: ToolJob): number {
  return TOOL_LEVELS[job].levels.length
}

/** level ≥ 1: buying it needs counters[counter] ≥ at */
export function toolUnlock(job: ToolJob, level: number): { counter: CounterId; at: number } {
  return { counter: TOOL_LEVELS[job].counter, at: TOOL_LEVELS[job].levels[level - 1].at }
}

/** one-time price of tool level ≥ 1 */
export function toolCost(job: ToolJob, level: number, meta: MetaState): number {
  return Math.round(TOOL_LEVELS[job].levels[level - 1].cost * multiplier(meta, 'cost'))
}

/** the largest tiles-per-press a level-2 tool may be set to */
export function toolNMax(tiles: number): number {
  return Math.max(1, Math.ceil(tiles * TOOL_N_RATIO))
}

/** moisture a watering sets with this water-tool tier; growth needs 1 / moistureDrainPerTick ticks per 1 */
export function waterMoisture(tier: number): number {
  return WATER_MOISTURE[tier]
}

/** chance a harvest with this sickle tier yields 2 crops */
export function doubleHarvestChance(tier: number): number {
  return DOUBLE_HARVEST[tier]
}

/** chance a planting with this dibber tier keeps its seed */
export function seedKeepChance(tier: number): number {
  return SEED_KEEP[tier]
}

/** top material tier for a job: gold only for the sickle and the dibber — iron is the last watering can */
export function toolTierMax(job: ToolJob): number {
  return job === 'water' ? 2 : TOOL_TIER_COST.length
}

/** price of material tier ≥ 1 for any job */
export function toolTierCost(tier: number, meta: MetaState): Price {
  return scalePrice(TOOL_TIER_COST[tier - 1], meta)
}

/** price of the next hire when `pool` workers are already hired */
export function workerHireCost(pool: number, meta: MetaState): number {
  return Math.round(WORKER_HIRE_BASE * WORKER_HIRE_GROWTH ** pool * multiplier(meta, 'cost'))
}

export function workerPoolCap(): number {
  return WORKER_POOL_CAP
}

/** hiring needs counters[counter] ≥ at */
export function workerHireUnlock(): { counter: CounterId; at: number } {
  return WORKER_HIRE_UNLOCK
}

/** buying the job's certificate needs counters[counter] ≥ at, vein level ≥ vein and the job's tool level ≥ tool when set */
export function certificateUnlock(job: WorkerJob): { counter: CounterId; at: number; vein?: number; tool?: number } {
  const { price, ...unlock } = CERTIFICATES[job]
  void price
  return unlock
}

export function certificateCost(job: WorkerJob, meta: MetaState): Price {
  return scalePrice(CERTIFICATES[job].price, meta)
}

/** ticks between two actions of one worker; the Legacy "worker speed" row shaves META_WORKER_SPEED_STEP off it */
export function workerActionTicks(meta: MetaState): number {
  return WORKER_ACTION_TICKS - META_WORKER_SPEED_STEP * meta.upgrades.workerSpeed
}

/**
 * The worker clock acts on the tick that crosses each whole multiple of the period (tick 0 included). With an integer
 * period this is exactly the old `tick % every === 0`; the halved period of the worker-speed row spreads the actions
 * evenly (4.5 s → 0, 5, 9, 14, …). Workers and sprinklers share this clock.
 */
export function workerActsAt(tick: number, every: number): boolean {
  return Math.floor(tick / every) > Math.floor((tick - 1) / every)
}

/** cash per action of a worker on this job */
export function workerWage(meta: MetaState, job: WorkerJob): number {
  return Math.round(WORKER_WAGES[job] * multiplier(meta, 'cost'))
}

export function digSeedDrop(): { crop: CropId; chance: number } {
  return { crop: DIG_SEED_CROP, chance: DIG_SEED_CHANCE }
}

/** whole cash; scales with the cost multiplier so a loan buys the same number of seeds */
export function loanPrincipal(meta: MetaState): number {
  return Math.round(LOAN_PRINCIPAL * multiplier(meta, 'cost'))
}

/** debt right after borrowing */
export function loanStartDebt(principal: number): number {
  return principal * (1 + LOAN_FEE)
}

export function loanDebtPerTick(principal: number): number {
  return principal * LOAN_RATE_PER_TICK
}

export function loanDebtCap(principal: number): number {
  return principal * LOAN_DEBT_CAP
}

export function loanRepayStep(meta: MetaState): number {
  return Math.round(LOAN_REPAY_STEP * multiplier(meta, 'cost'))
}

/** cost of the next tile; Infinity once TILE_CAP tiles are owned. The ladder anchors on the run's starting tiles, so
 * a Legacy "start tiles" level prices the first bought tile of every run the same */
export function tileCost(ownedTiles: number, meta: MetaState): number {
  if (ownedTiles >= TILE_CAP) return Infinity
  return Math.round(TILE_BASE_COST * TILE_COST_GROWTH ** (ownedTiles - startTiles(meta)) * multiplier(meta, 'cost'))
}
