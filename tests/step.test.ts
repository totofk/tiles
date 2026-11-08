import { describe, expect, it } from 'vitest'
import { cropGrowTicks, cropRotGraceTicks, energyMax, moistureDrainPerTick, waterMoisture } from '../src/core/balance'
import { createInitialState, type GameState, type Tile } from '../src/core/state'
import { step } from '../src/core/step'

function withTile(tile: Partial<Tile>, energy = 20): GameState {
  const s = createInitialState()
  s.run.energy = energy
  s.run.tiles[0] = { ...s.run.tiles[0], ...tile }
  return s
}

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object') {
    Object.values(o).forEach(deepFreeze)
    Object.freeze(o)
  }
  return o
}

const meta = createInitialState().meta
const fillTicks = Math.round(1 / moistureDrainPerTick(meta))

describe('step', () => {
  it('increments run.tick', () => {
    expect(step(createInitialState(), 7).run.tick).toBe(7)
  })

  it('drains moisture to exactly 0 and never below', () => {
    const s = withTile({ status: 'tilled', moisture: 1 })
    expect(step(s, 1).run.tiles[0].moisture).toBeCloseTo(1 - 1 / fillTicks)
    expect(step(s, fillTicks).run.tiles[0].moisture).toBe(0)
    expect(step(s, fillTicks + 10).run.tiles[0].moisture).toBe(0)
  })

  it('grows only while moist: one full bar buys exactly fillTicks of growth, then pauses', () => {
    const s = withTile({ status: 'planted', cropId: 'radish', moisture: 1 })
    expect(step(s, fillTicks).run.tiles[0].growth).toBe(fillTicks)
    const dry = step(s, fillTicks + 1).run.tiles[0]
    expect(dry.growth).toBe(fillTicks)
    expect(dry.status).toBe('planted')
    expect(step(withTile({ status: 'planted', cropId: 'radish', moisture: 0 }), 50).run.tiles[0].growth).toBe(0)
  })

  it('a copper-watered tile (moisture 2) grows exactly 2 × fillTicks, and step(s, n) equals n single steps', () => {
    const s = withTile({ status: 'planted', cropId: 'lemon', moisture: waterMoisture(1) })
    expect(waterMoisture(1)).toBe(2)
    const after = step(s, 2 * fillTicks + 30).run.tiles[0]
    expect([after.growth, after.moisture]).toEqual([2 * fillTicks, 0])
    let single = s
    for (let n = 1; n <= 2 * fillTicks + 5; n++) {
      single = step(single, 1)
      expect(single).toEqual(step(s, n))
    }
  })

  it('regens energy without float drift and caps at max', () => {
    expect(step(withTile({}, 0), 30).run.energy).toBe(10)
    expect(step(withTile({}, 0), 3).run.energy).toBe(1)
    expect(step(withTile({}, 19), 100).run.energy).toBe(energyMax(0, meta))
  })

  it('rots a mature crop once ticksSinceMature exceeds the grace window, not before', () => {
    const grow = cropGrowTicks('radish', meta, 0)
    const grace = cropRotGraceTicks('radish', meta)
    const s = withTile({ status: 'planted', cropId: 'radish', growth: grow, moisture: 0 })
    const atGrace = step(s, grace).run.tiles[0]
    expect(atGrace.status).toBe('planted')
    expect(atGrace.ticksSinceMature).toBe(grace)
    const rotten = step(s, grace + 1).run.tiles[0]
    expect(rotten.status).toBe('tilled')
    expect(rotten.cropId).toBeUndefined()
    expect(rotten.growth).toBe(0)
  })

  it('is pure: input unchanged, and step(s, a + b) equals step(step(s, a), b)', () => {
    const s = deepFreeze(withTile({ status: 'planted', cropId: 'radish', moisture: 1 }, 3))
    const snapshot = structuredClone(s)
    const whole = step(s, 250)
    expect(s).toEqual(snapshot)
    expect(whole).toEqual(step(step(s, 90), 160))
  })

  // batch 12: with market decay, milestone recording and workers on, one step(s, n) is still exactly n single steps
  it('step(s, n) = n × step(s, 1) with the market, milestones and workers active', () => {
    const s = createInitialState()
    const tilled = s.run.tiles.map((t, i): Tile => ({ ...t, status: i < 6 ? 'planted' : 'tilled', cropId: i < 6 ? 'lemon' : undefined, growth: i < 6 ? 300 : 0, moisture: 1 }))
    const market = { radish: 900, chilli: 100, pumpkin: 10, lemon: 500 }
    const assigned = { plant: 1, water: 1, harvest: 1, ore: 0, fuel: 0, mine: 0, clerk: 0 }
    const withAll: GameState = {
      ...s,
      run: {
        ...s.run,
        tick: 15, // a worker action tick
        cash: 500,
        tiles: tilled,
        licenses: [...s.run.licenses, 'chilli', 'pumpkin', 'lemon'],
        plantCrop: 'lemon',
        market,
        furnace: { ...s.run.furnace, built: true, fire: 120, ore: 6, progress: 30 },
        workers: { pool: 3, assigned, certificates: ['plant', 'water', 'harvest'] },
      },
    }
    let single = withAll
    for (let n = 1; n <= 40; n++) {
      single = step(single, 1)
      expect(single).toEqual(step(withAll, n))
    }
    // the run really exercised all three: glut decayed, milestones recorded, workers acted
    expect(single.run.market.lemon).toBeLessThan(500)
    expect(Object.keys(single.run.milestones).length).toBeGreaterThan(0)
    expect(single.run.lifetime.wagesPaid).toBeGreaterThan(0)
  })
})
