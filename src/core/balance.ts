// Every tunable number lives here. Read them through the functions, never the tables,
// so prestige multipliers (meta) apply everywhere. 1 tick = 1 second.
import type { CropId } from './data/crops'
import type { UpgradeId } from './data/upgrades'
import type { MetaState, MultiplierKey } from './state'

export const START_TILES = 6
export const TILE_CAP = 24
export const ACTION_ENERGY_COST = 1
export const STARTING_CASH = 20
/** float residue below this is snapped away (energy to the nearest integer, moisture to 0) */
export const FLOAT_EPSILON = 1e-9

const CROP_BASE: Record<CropId, { growTicks: number; seedCost: number; sellPrice: number; licenseCost: number }> = {
  // 100 ticks with a 60 s moisture bar = water at plant + once more
  radish: { growTicks: 100, seedCost: 2, sellPrice: 10, licenseCost: 0 },
  pumpkin: { growTicks: 240, seedCost: 10, sellPrice: 60, licenseCost: 150 },
}
const ROT_GRACE_FACTOR = 2

const MOISTURE_FULL_TICKS = 60

const ENERGY_MAX_BASE = 20
const ENERGY_MAX_PER_LEVEL = 5
const ENERGY_REGEN_BASE = 1 / 3
const ENERGY_REGEN_PER_LEVEL = 0.25 // +25% of base per level

const UPGRADE_BASE: Record<UpgradeId, { cost: number; growth: number }> = {
  energyMax: { cost: 50, growth: 1.6 },
  energyRegen: { cost: 75, growth: 1.7 },
}

const TILE_BASE_COST = 100
const TILE_COST_GROWTH = 1.5

export function multiplier(meta: MetaState, key: MultiplierKey): number {
  return meta.multipliers[key]
}

export function cropGrowTicks(cropId: CropId, meta: MetaState): number {
  return CROP_BASE[cropId].growTicks * multiplier(meta, 'growTime')
}

export function cropRotGraceTicks(cropId: CropId, meta: MetaState): number {
  return ROT_GRACE_FACTOR * cropGrowTicks(cropId, meta)
}

export function cropSeedCost(cropId: CropId, meta: MetaState): number {
  return Math.round(CROP_BASE[cropId].seedCost * multiplier(meta, 'cost'))
}

export function cropSellPrice(cropId: CropId, meta: MetaState): number {
  return Math.round(CROP_BASE[cropId].sellPrice * multiplier(meta, 'sellPrice'))
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

/** cost of the next tile; Infinity once TILE_CAP tiles are owned */
export function tileCost(ownedTiles: number, meta: MetaState): number {
  if (ownedTiles >= TILE_CAP) return Infinity
  return Math.round(TILE_BASE_COST * TILE_COST_GROWTH ** (ownedTiles - START_TILES) * multiplier(meta, 'cost'))
}
