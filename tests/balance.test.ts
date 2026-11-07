import { describe, expect, it } from 'vitest'
import {
  START_TILES,
  STARTING_CASH,
  TILE_CAP,
  cropGrowTicks,
  cropRotGraceTicks,
  energyMax,
  moistureDrainPerTick,
  tileCost,
  upgradeCost,
} from '../src/core/balance'
import { CROP_IDS } from '../src/core/data/crops'
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
