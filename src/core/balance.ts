// Every tunable number lives here. Read them through the functions, never the tables,
// so prestige multipliers (meta) apply everywhere. 1 tick = 1 second.
import type { CropId } from './data/crops'
import type { UpgradeId } from './data/upgrades'
import { PICKAXE_TIERS, type ItemId, type PickaxeTier } from './data/items'
import type { ToolJob } from './data/tools'
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
const ITEM_SELL_PRICE = { wood: 2, stone: 2, coal: 4, copperOre: 1 } satisfies Partial<Record<ItemId, number>>
export type SellableItemId = keyof typeof ITEM_SELL_PRICE
/** a price in cash plus items from storage */
export type Price = { cash: number } & Partial<Record<ItemId, number>>
// Furnace (round-5 research): built once vein level `vein` is owned.
const FURNACE = { cost: { stone: 20, coal: 5, cash: 150 }, vein: 1 }
// One smelt job = `ore` copper ore + one fuel choice → 1 copper bar after barTicks. The furnace holds queueCap jobs,
// counting the bars still waiting in its output tray.
const SMELT = { ore: 2, fuel: { coal: 1, wood: 2 }, barTicks: 60, queueCap: 5 }
export type FuelId = keyof typeof SMELT.fuel
export const FUEL_IDS = Object.keys(SMELT.fuel) as FuelId[]
// wood = craft cost, repairWood = cost to fix a blunt one (below craft), hits = stone hits per mine action
const PICKAXES: Record<PickaxeTier, { wood: number; repairWood: number; durability: number; hits: number }> = {
  wooden: { wood: 3, repairWood: 2, durability: 25, hits: 2 },
}
/** a rock drops its item after this many hits (stone when unlisted); by hand (no pickaxe, or a blunt one) = HAND_HITS */
const STONE_HITS = 2
const ROCK_HITS: Partial<Record<ItemId, number>> = { copperOre: 3 }
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
]
/** price of vein level index + 1, paid in items from storage and cash */
const VEIN_UPGRADES: ReadonlyArray<Price> = [
  { stone: 25, cash: 100 },
  { stone: 30, coal: 10, cash: 200 },
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

/** copper ore per bar */
export function smeltOre(): number {
  return SMELT.ore
}

/** units of this fuel per bar */
export function smeltFuel(fuel: FuelId): number {
  return SMELT.fuel[fuel]
}

export function barTicks(): number {
  return SMELT.barTicks
}

/** queued jobs + bars waiting in the tray */
export function furnaceQueueCap(): number {
  return SMELT.queueCap
}

export function pickaxeRecipe(tier: PickaxeTier): { wood: number; repairWood: number; durability: number } {
  return PICKAXES[tier]
}

/** hits a rock that drops `rock` takes to break */
export function rockHits(rock: ItemId): number {
  return ROCK_HITS[rock] ?? STONE_HITS
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
