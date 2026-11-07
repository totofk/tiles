// Every tunable number lives here. Read them through the functions, never the tables,
// so prestige multipliers (meta) apply everywhere. 1 tick = 1 second.
import type { CropId } from './data/crops'
import type { UpgradeId } from './data/upgrades'
import type { ItemId } from './data/items'
import type { ToolJob } from './data/tools'
import type { CounterId, MetaState, MultiplierKey, PickaxeTier } from './state'

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
  // license 100 (was 150): affordable after the 2nd radish cycle, so pumpkins planted at ~300 mature by 600
  pumpkin: { growTicks: 240, seedCost: 10, sellPrice: 60, licenseCost: 100 },
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
// wood sells below its buy price, so buying and reselling wood never makes money
const ITEM_SELL_PRICE: Record<ItemId, number> = { wood: 2, stone: 2 }
const PICKAXES: Record<PickaxeTier, { wood: number; durability: number }> = {
  wooden: { wood: 3, durability: 20 },
}
export const BAG_CAPACITY_START = 20
/** run.rngState for a new run and for migrated v1 saves */
export const INITIAL_RNG_SEED = 0x2f6b1a3d
/** drop weights per vein level (index = level); weights need not sum to 1 */
const VEIN_DROPS: ReadonlyArray<Partial<Record<ItemId, number>>> = [{ stone: 1 }]

// Farm tools (PLAN.md batch 5 starting numbers): per job, the counter that unlocks each level and the level's
// one-time price; levels[0] is level 1. Level 2 does toolN tiles per press, 1 … ceil(tiles × TOOL_N_RATIO).
const TOOL_LEVELS: Record<ToolJob, { counter: CounterId; levels: ReadonlyArray<{ at: number; cost: number }> }> = {
  water: { counter: 'waters', levels: [{ at: 20, cost: 40 }, { at: 60, cost: 120 }, { at: 150, cost: 300 }] },
  harvest: { counter: 'harvests', levels: [{ at: 15, cost: 50 }, { at: 50, cost: 150 }, { at: 120, cost: 350 }] },
  plant: { counter: 'plants', levels: [{ at: 15, cost: 40 }, { at: 50, cost: 120 }, { at: 120, cost: 300 }] },
}
const TOOL_N_RATIO = 1 / 3

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

export function itemSellPrice(itemId: ItemId, meta: MetaState, sellPriceLevel: number): number {
  return sellPrice(ITEM_SELL_PRICE[itemId], meta, sellPriceLevel)
}

export function pickaxeRecipe(tier: PickaxeTier): { wood: number; durability: number } {
  return PICKAXES[tier]
}

export function veinDrops(level: number): Partial<Record<ItemId, number>> {
  return VEIN_DROPS[Math.min(level, VEIN_DROPS.length - 1)]
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
