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
// smelting); copper bars have no price at all, so there is no smelt-to-sell loop.
const ITEM_SELL_PRICE = { wood: 2, stone: 2, coal: 4, copperOre: 1, ironOre: 1 } satisfies Partial<Record<ItemId, number>>
export type SellableItemId = keyof typeof ITEM_SELL_PRICE
/** a price in cash plus items from storage */
export type Price = { cash: number } & Partial<Record<ItemId, number>>
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
}
/** a rock drops its item after this many hits (stone when unlisted); by hand (no pickaxe, or a blunt one) = HAND_HITS */
const STONE_HITS = 2
const ROCK_HITS: Partial<Record<ItemId, number>> = { copperOre: 3, ironOre: 4 }
/** rocks that need at least this pickaxe tier; with less (or by hand) the rock is a stone rock (hits and drop) */
const ROCK_PICKAXE: Partial<Record<ItemId, PickaxeTier>> = { ironOre: 'copper' }
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
]
/** price of vein level index + 1, paid in items from storage and cash; Lv3 (45 items) comes after storage Lv3 (50) */
const VEIN_UPGRADES: ReadonlyArray<Price> = [
  { stone: 25, cash: 100 },
  { stone: 30, coal: 10, cash: 200 },
  { stone: 40, copperBar: 5, cash: 400 },
]
/** vein levels from this one up need the furnace */
const VEIN_FURNACE_LEVEL = 2
// Storage upgrade (the stone sink): +slots capacity per level; level 1 costs the base, stone +stoneStep per level
// (so each price fits the capacity before it), cash ×growth per level.
const STORAGE = { slots: 10, stone: 15, stoneStep: 5, cash: 50, growth: 1.6, maxLevel: 5 }

// Farm tools (PLAN.md batch 5 starting numbers): per job, the counter that unlocks each level and the level's
// one-time price; levels[0] is level 1. Level 2 does toolN tiles per press, 1 … ceil(tiles × TOOL_N_RATIO).
const TOOL_LEVELS: Record<ToolJob, { counter: CounterId; levels: ReadonlyArray<{ at: number; cost: number }> }> = {
  water: { counter: 'waters', levels: [{ at: 20, cost: 40 }, { at: 60, cost: 120 }, { at: 150, cost: 300 }] },
  harvest: { counter: 'harvests', levels: [{ at: 15, cost: 50 }, { at: 50, cost: 150 }, { at: 120, cost: 350 }] },
  plant: { counter: 'plants', levels: [{ at: 15, cost: 40 }, { at: 50, cost: 120 }, { at: 120, cost: 300 }] },
}
const TOOL_N_RATIO = 1 / 3
// Material tier per farm job (batch 7.1; index = tier, 0 basic, 1 copper). Watering fills moisture to WATER_MOISTURE;
// harvest yields 2 crops with DOUBLE_HARVEST chance; planting keeps the seed with SEED_KEEP chance. TOOL_TIER_COST[t − 1]
// = price of tier t, the same for every job. Iron/gold later: moisture 4/8, 20/30 %, 35/50 %.
const WATER_MOISTURE = [1, 2]
const DOUBLE_HARVEST = [0, 0.1]
const SEED_KEEP = [0, 0.2]
const TOOL_TIER_COST: ReadonlyArray<Price> = [{ copperBar: 4, cash: 100 }]

// Workers v1 (batch 8, DECISIONS "Workers v1"): hire k (pool k − 1 → k) costs HIRE_BASE × HIRE_GROWTH^(k − 1), pool
// capped; the hire button needs HIRE_UNLOCK. A job takes workers once its certificate is bought (needs its unlock
// counter). Every WORKER_ACTION_TICKS each assigned worker does one action of its job, paid WORKER_WAGE at that moment.
const WORKER_HIRE_BASE = 80
const WORKER_HIRE_GROWTH = 1.7
const WORKER_POOL_CAP = 6
const WORKER_HIRE_UNLOCK: { counter: CounterId; at: number } = { counter: 'harvests', at: 30 }
const WORKER_ACTION_TICKS = 5
const WORKER_WAGE = 1
const CERTIFICATES: Record<WorkerJob, { price: Price; counter: CounterId; at: number }> = {
  // plant worker (batch 10): copper bars, so the mine → furnace path comes first
  plant: { price: { copperBar: 10, cash: 300 }, counter: 'plants', at: 60 },
  water: { price: { cash: 100 }, counter: 'waters', at: 40 },
  harvest: { price: { stone: 20, cash: 150 }, counter: 'harvests', at: 40 },
  // furnace loaders (batch 9): gated by copper bars collected, paid in bars
  ore: { price: { copperBar: 3, cash: 100 }, counter: 'bars', at: 10 },
  fuel: { price: { copperBar: 8, cash: 200 }, counter: 'bars', at: 30 },
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

export function multiplier(meta: MetaState, key: MultiplierKey): number {
  return meta.multipliers[key]
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
  return (ENERGY_MAX_BASE + ENERGY_MAX_PER_LEVEL * level) * multiplier(meta, 'energy')
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

export function toolTierMax(): number {
  return TOOL_TIER_COST.length
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

/** buying the job's certificate needs counters[counter] ≥ at */
export function certificateUnlock(job: WorkerJob): { counter: CounterId; at: number } {
  return { counter: CERTIFICATES[job].counter, at: CERTIFICATES[job].at }
}

export function certificateCost(job: WorkerJob, meta: MetaState): Price {
  return scalePrice(CERTIFICATES[job].price, meta)
}

/** ticks between two actions of one worker */
export function workerActionTicks(): number {
  return WORKER_ACTION_TICKS
}

/** cash per worker action */
export function workerWage(meta: MetaState): number {
  return Math.round(WORKER_WAGE * multiplier(meta, 'cost'))
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

/** cost of the next tile; Infinity once TILE_CAP tiles are owned */
export function tileCost(ownedTiles: number, meta: MetaState): number {
  if (ownedTiles >= TILE_CAP) return Infinity
  return Math.round(TILE_BASE_COST * TILE_COST_GROWTH ** (ownedTiles - START_TILES) * multiplier(meta, 'cost'))
}
