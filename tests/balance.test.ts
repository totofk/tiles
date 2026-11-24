import { describe, expect, it } from 'vitest'
import {
  BARGE_ITEMS,
  FORGE_RECIPES,
  treeCadenceTicks,
  type SellableItemId,
  START_TILES,
  STARTING_CASH,
  TILE_CAP,
  barTicks,
  batchBars,
  cropGrowTicks,
  cropRotGraceTicks,
  cropSeedCost,
  cropSellPrice,
  energyMax,
  furnaceUpgradeMaxLevel,
  furnaceSpeedRate,
  isSellable,
  itemSellPrice,
  licenseCost,
  masteryLevel,
  masteryMaxLevel,
  masteryThresholds,
  mineHits,
  moistureDrainPerTick,
  digSeedDrop,
  FLOOR_COLS,
  FLOOR_ORE_GRADIENT,
  FLOORS_PER_ZONE,
  FLOOR_ROWS,
  floorWeights,
  floorZone,
  MINE_BOTTOM_FLOOR,
  multiplier,
  oreBar,
  pickaxeDurability,
  preserveChance,
  sealFloor,
  tileCost,
  upgradeCost,
  veinWeights,
  zoneFirstFloor,
} from '../src/core/balance'
import { buySeeds } from '../src/core/actions'
import { buyWood } from '../src/core/mining'
import { bargePrice } from '../src/core/wetlands'
import { CROP_IDS } from '../src/core/data/crops'
import { FORGE_GOOD_IDS, ORE_IDS, PICKAXE_TIERS, type ItemId, type PickaxeTier } from '../src/core/data/items'
import { createInitialMeta, createInitialState, type MetaState } from '../src/core/state'

const meta = createInitialMeta()

describe('createInitialState', () => {
  it('starts with 9 untilled tiles, starting cash, full energy and potato licensed and planted', () => {
    const { run, meta } = createInitialState()
    expect(run.tiles).toHaveLength(START_TILES)
    expect(START_TILES).toBe(9)
    expect(run.tiles.every((t) => t.status === 'untilled' && t.cropId === undefined)).toBe(true)
    expect(run.cash).toBe(STARTING_CASH)
    expect(run.energy).toBe(energyMax(0, meta))
    expect(run.energy).toBe(10)
    expect([run.licenses, run.plantCrop]).toEqual([['potato'], 'potato'])
    expect(run.upgrades).toEqual({ energyMax: 0, energyRegen: 0, sellPrice: 0, fertilizer: 0 })
    expect(run.counters).toEqual({ harvests: 0, sales: 0, mines: 0, digs: 0, waters: 0, plants: 0, bars: 0, orders: 0, contractsByHand: 0 })
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

  it('batch 35: the 10-crop ladder, potato free, licences rising along CROP_IDS from carrot on (the rows keep their rank)', () => {
    expect(CROP_IDS).toEqual(['potato', 'radish', 'corn', 'eggplant', 'pumpkin', 'tomato', 'lemon', 'grape', 'strawberry', 'chilli'])
    const costs = CROP_IDS.map((id) => licenseCost(id, meta))
    expect(costs).toEqual([0, 25, 50, 100, 400, 7_000, 10_000, 15_000, 22_000, 32_000])
    for (let i = 2; i < costs.length; i++) expect(costs[i]).toBeGreaterThan(costs[i - 1])
    expect(CROP_IDS.map((id) => [cropSeedCost(id, meta), cropSellPrice(id, meta, 0), cropGrowTicks(id, meta, 0)])).toEqual([
      [1, 5, 60],
      [2, 10, 100],
      [5, 25, 160],
      [10, 60, 240],
      [20, 110, 360],
      [40, 200, 480],
      [75, 360, 620],
      [140, 640, 780],
      [260, 1_150, 960],
      [460, 2_070, 1_160],
    ])
    // every row's market floor still covers its seed ≥ 2.2× (potato 2.5, chilli 2.25)
    for (const id of CROP_IDS) expect((cropSellPrice(id, meta, 0) * 0.5) / cropSeedCost(id, meta)).toBeGreaterThanOrEqual(2.2)
  })

  it('batch 35: potato is one water at planting; a fresh run digs potato seeds', () => {
    expect(cropGrowTicks('potato', meta, 0) * moistureDrainPerTick(meta)).toBeLessThanOrEqual(1)
    expect(digSeedDrop()).toEqual({ crop: 'potato', chance: 0.2 })
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
    const boosted: MetaState = { ...createInitialMeta(), legacyMultipliers: { growTime: 0.5, sellPrice: 1, cost: 1, energy: 1, moistureDrain: 1 } }
    expect(cropGrowTicks('radish', boosted, 0)).toBe(cropGrowTicks('radish', meta, 0) / 2)
    const leveled: MetaState = { ...createInitialMeta(), upgrades: { ...createInitialMeta().upgrades, sellPrice: 1 } }
    // batch 20 retuned the sellPrice step from 1.1 to 1.05 (deed prices, DECISIONS "Sell the farm")
    expect(multiplier(leveled, 'sellPrice')).toBe(1.05)
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
  // never feels like a downgrade. Gold is exempt (batch 32): strong but fragile — 8 hits, 600 durability, and the rack
  // keeps the iron pickaxe for long presses (DECISIONS "Batch 32 refined").
  it('each tier base durability exceeds the previous tier Lv10 lifetime (wood Lv10 = 125 < copper 200), gold exempt', () => {
    expect(lv10Lifetime('wooden')).toBeCloseTo(125)
    expect(pickaxeDurability('copper')).toBe(200)
    PICKAXE_TIERS.slice(1, 3).forEach((tier, i) => expect(pickaxeDurability(tier)).toBeGreaterThan(lv10Lifetime(PICKAXE_TIERS[i])))
    expect([pickaxeDurability('gold'), mineHits('gold')]).toEqual([600, 8])
  })

  it('copper mastery thresholds are wood ×2 (20 … 800 xp)', () => {
    expect(masteryThresholds('copper')).toEqual([20, 50, 90, 140, 200, 280, 380, 500, 640, 800])
  })
})

describe('bar sell prices (batch 34: income prices)', () => {
  it('🥉100 🥈500 🥇1000 at sell price Lv0, sellable', () => {
    expect(ORE_IDS.map((ore) => [isSellable(oreBar(ore)), itemSellPrice(oreBar(ore), meta, 0)])).toEqual([
      [true, 100],
      [true, 500],
      [true, 1000],
    ])
  })

  it('no shop action sells ore for cash, so smelting bought ore can never loop cash: wood and seeds are the only buys', () => {
    const rich = { ...createInitialState(), run: { ...createInitialState().run, cash: 1e9, mineLicense: true } }
    const wood = buyWood(rich, 10)
    const seeds = buySeeds(rich, 'potato', 10)
    for (const r of [wood, seeds]) {
      if (!r.ok) throw new Error(r.error)
      for (const ore of ORE_IDS) expect(r.state.run.inventory[ore] ?? 0).toBe(0)
    }
    expect(wood.ok && wood.state.run.inventory).toEqual({ wood: 10 })
  })
})

describe('furnace molds (batch 33): the throughput bound', () => {
  it('copper at the top batch (5) and speed (Lv2) = 5 × 3600 ÷ 38.4 = 468.75 bars/h per mold', () => {
    const bars = batchBars(furnaceUpgradeMaxLevel('batch'))
    const rate = furnaceSpeedRate(furnaceUpgradeMaxLevel('speed'))
    expect([bars, rate]).toEqual([5, 1.5625])
    expect((bars * 3600 * rate) / barTicks('copperOre')).toBe(468.75)
  })
})

describe('batch 36.2: tree bed and forge numbers', () => {
  const { meta } = createInitialState()

  it('PIN36e: a tree bed earns within ±15 % of a replanted bed of the same crop (lemon 101 %, strawberry 103 %)', () => {
    const ratio = (c: 'lemon' | 'strawberry') => {
      const sell = cropSellPrice(c, meta, 0)
      const tree = (6 * sell * 3600) / treeCadenceTicks(c)
      const replanted = (6 * (sell - cropSeedCost(c, meta)) * 3600) / cropGrowTicks(c, meta, 0)
      return tree / replanted
    }
    expect([Math.round(ratio('lemon') * 100), Math.round(ratio('strawberry') * 100)]).toEqual([101, 103])
    for (const c of ['lemon', 'strawberry'] as const) expect(Math.abs(ratio(c) - 1)).toBeLessThanOrEqual(0.15)
  })

  it('PIN36f: every forge recipe sells above its inputs and at most 1.30 × their sell value', () => {
    for (const id of FORGE_GOOD_IDS) {
      const inputs = (Object.entries(FORGE_RECIPES[id].inputs) as [ItemId, number][]).reduce((sum, [item, n]) => sum + n * itemSellPrice(item as SellableItemId, meta, 0), 0)
      const sell = itemSellPrice(id, meta, 0)
      expect(sell / inputs).toBeGreaterThan(1)
      expect(sell / inputs).toBeLessThanOrEqual(1.3)
    }
  })
})

describe('batch 36.3: PIN36i the barge never buys below sell', () => {
  it('every barge good, Better prices 0 … 30, sell / cost deeds 0 … 10: bargePrice > itemSellPrice; at no upgrades 125 / 625 / 1,250 / 3 / 5', () => {
    const base = createInitialMeta()
    expect(BARGE_ITEMS.map((id) => bargePrice(id, base, 0))).toEqual([125, 625, 1250, 3, 5])
    for (let sellDeed = 0; sellDeed <= 10; sellDeed++)
      for (let costDeed = 0; costDeed <= 10; costDeed++) {
        const meta: MetaState = { ...base, upgrades: { ...base.upgrades, sellPrice: sellDeed, cost: costDeed } }
        for (let level = 0; level <= 30; level++)
          for (const id of BARGE_ITEMS) expect(bargePrice(id, meta, level)).toBeGreaterThan(itemSellPrice(id, meta, level))
      }
  })
})

describe('batch 37: floor numbers (zones of 5 floors)', () => {
  it('the constants: a 4×3 grid, 5 floors per zone, bottom 25, gradient 0.05', () => {
    expect([FLOOR_COLS, FLOOR_ROWS, FLOORS_PER_ZONE, MINE_BOTTOM_FLOOR, FLOOR_ORE_GRADIENT]).toEqual([4, 3, 5, 25, 0.05])
    expect(MINE_BOTTOM_FLOOR).toBe(FLOORS_PER_ZONE * 5)
  })

  it('floorZone: 1/5 stone, 6 coal, 21/25 gold, clamped past the bottom', () => {
    expect([1, 5, 6, 21, 25].map(floorZone)).toEqual([0, 0, 1, 4, 4])
    expect(floorZone(99)).toBe(4)
  })

  it('zone first floors 5z+1 and seal floors 5z', () => {
    expect([0, 1, 2, 3, 4].map(zoneFirstFloor)).toEqual([1, 6, 11, 16, 21])
    expect([1, 2, 3, 4].map(sealFloor)).toEqual([5, 10, 15, 20])
  })

  it("a zone's first floor (21) keeps the old vein table exactly; floor 25's ores × 1.2", () => {
    expect(floorWeights(21, 2, null)).toEqual(veinWeights(4, 2, null))
    expect(floorWeights(25, 0, null).goldOre).toBeCloseTo(0.08 * 1.2, 12)
  })

  it('stone absorbs the gradient: no weight goes negative on any floor, even mastered 3 with an aim', () => {
    for (let n = 1; n <= MINE_BOTTOM_FLOOR; n++)
      for (const aim of [null, ...ORE_IDS] as const) {
        const weights = floorWeights(n, 3, aim)
        for (const id of Object.keys(weights) as ItemId[]) expect(weights[id]!).toBeGreaterThanOrEqual(0)
      }
  })
})
