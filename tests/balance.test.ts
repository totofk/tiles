import { describe, expect, it } from 'vitest'
import {
  START_TILES,
  STARTING_CASH,
  TILE_CAP,
  cropGrowTicks,
  cropRotGraceTicks,
  cropSeedCost,
  cropSellPrice,
  energyMax,
  licenseCost,
  masteryLevel,
  masteryMaxLevel,
  masteryThresholds,
  moistureDrainPerTick,
  pickaxeDurability,
  preserveChance,
  tileCost,
  upgradeCost,
} from '../src/core/balance'
import { CROP_IDS } from '../src/core/data/crops'
import { PICKAXE_TIERS, type PickaxeTier } from '../src/core/data/items'
import { createInitialMeta, createInitialState } from '../src/core/state'

const meta = createInitialMeta()

describe('createInitialState', () => {
  it('starts with 9 untilled tiles, starting cash, full energy and radish licensed', () => {
    const { run, meta } = createInitialState()
    expect(run.tiles).toHaveLength(START_TILES)
    expect(START_TILES).toBe(9)
    expect(run.tiles.every((t) => t.status === 'untilled' && t.cropId === undefined)).toBe(true)
    expect(run.cash).toBe(STARTING_CASH)
    expect(run.energy).toBe(energyMax(0, meta))
    expect(run.energy).toBe(10)
    expect(run.licenses).toEqual(['radish'])
    expect(run.upgrades).toEqual({ energyMax: 0, energyRegen: 0, sellPrice: 0, fertilizer: 0 })
    expect(run.counters).toEqual({ harvests: 0, sales: 0, mines: 0, digs: 0, waters: 0, plants: 0 })
    expect(run.seeds).toEqual({})
    expect(run.autoBuySeeds).toBe(true)
    expect(meta.prestigeCount).toBe(0)
  })

  it('returns independent tile objects', () => {
    const { run } = createInitialState()
    run.tiles[0].status = 'tilled'
    expect(run.tiles[1].status).toBe('untilled')
  })
})

describe('balance', () => {
  it('rot grace is 2x grow time for every crop', () => {
    for (const id of CROP_IDS) expect(cropRotGraceTicks(id, meta)).toBe(2 * cropGrowTicks(id, meta, 0))
  })

  it('radish needs about two waterings per cycle', () => {
    const ticksPerFill = 1 / moistureDrainPerTick(meta)
    expect(Math.ceil(cropGrowTicks('radish', meta, 0) / ticksPerFill)).toBe(2)
  })

  it('crops in CROP_IDS order cost more to license (carrot < chilli < pumpkin < lemon)', () => {
    expect(CROP_IDS).toEqual(['radish', 'chilli', 'pumpkin', 'lemon'])
    const costs = CROP_IDS.map((id) => licenseCost(id, meta))
    expect(costs).toEqual([0, 50, 100, 400])
    expect(CROP_IDS.map((id) => [cropSeedCost(id, meta), cropSellPrice(id, meta, 0), cropGrowTicks(id, meta, 0)])).toEqual([
      [2, 10, 100],
      [5, 25, 160],
      [10, 60, 240],
      [20, 110, 360],
    ])
  })

  it('tile cost grows geometrically and is Infinity at the cap', () => {
    const c6 = tileCost(START_TILES, meta)
    const c7 = tileCost(START_TILES + 1, meta)
    const c8 = tileCost(START_TILES + 2, meta)
    expect(c7).toBeGreaterThan(c6)
    expect(c8 / c7).toBeCloseTo(c7 / c6, 1)
    expect(Number.isFinite(tileCost(TILE_CAP - 1, meta))).toBe(true)
    expect(tileCost(TILE_CAP, meta)).toBe(Infinity)
  })

  it('upgrade cost rises with level', () => {
    expect(upgradeCost('energyMax', 1, meta)).toBeGreaterThan(upgradeCost('energyMax', 0, meta))
  })

  it('meta multipliers flow through balance functions', () => {
    const boosted = createInitialMeta()
    boosted.multipliers.growTime = 0.5
    expect(cropGrowTicks('radish', boosted, 0)).toBe(cropGrowTicks('radish', meta, 0) / 2)
  })
})

describe('pickaxe mastery', () => {
  const lv10Lifetime = (tier: PickaxeTier) => pickaxeDurability(tier) / (1 - preserveChance(masteryMaxLevel(), 0))

  it('wooden thresholds, levels 0 … 10', () => {
    expect(masteryThresholds('wooden')).toEqual([10, 25, 45, 70, 100, 140, 190, 250, 320, 400])
    expect([9, 10, 24, 25, 399, 400, 9999].map((xp) => masteryLevel('wooden', xp))).toEqual([0, 1, 1, 2, 9, 10, 10])
  })

  it('later tiers double the previous tier thresholds', () => {
    PICKAXE_TIERS.slice(1).forEach((tier, i) =>
      expect(masteryThresholds(tier)).toEqual(masteryThresholds(PICKAXE_TIERS[i]).map((xp) => 2 * xp)),
    )
  })

  it('preserve chance 1 − 1/(1 + 0.4·L), +5 % per mastered tier, capped at 0.8', () => {
    expect(preserveChance(0, 0)).toBe(0)
    expect(preserveChance(1, 0)).toBeCloseTo(1 - 1 / 1.4)
    expect(preserveChance(10, 0)).toBeCloseTo(0.8)
    expect(preserveChance(1, 1)).toBeCloseTo(1 - 1 / 1.4 + 0.05)
    expect(preserveChance(0, 2)).toBeCloseTo(0.1)
    expect(preserveChance(9, 1)).toBe(0.8)
    expect(preserveChance(10, 3)).toBe(0.8)
  })

  // The tier rule (DECISIONS.md round 4): a new tier must outlast the previous tier at Lv10, so a new tier at Lv0
  // never feels like a downgrade.
  it('each tier base durability exceeds the previous tier Lv10 lifetime (wood Lv10 = 125 < copper 200)', () => {
    expect(lv10Lifetime('wooden')).toBeCloseTo(125)
    expect(pickaxeDurability('copper')).toBe(200)
    PICKAXE_TIERS.slice(1).forEach((tier, i) => expect(pickaxeDurability(tier)).toBeGreaterThan(lv10Lifetime(PICKAXE_TIERS[i])))
  })

  it('copper mastery thresholds are wood ×2 (20 … 800 xp)', () => {
    expect(masteryThresholds('copper')).toEqual([20, 50, 90, 140, 200, 280, 380, 500, 640, 800])
  })
})
