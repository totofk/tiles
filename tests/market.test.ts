import { describe, expect, it } from 'vitest'
import { harvest, nextRandom } from '../src/core/actions'
import { MARKET_DECAY, MARKET_FLOOR, MARKET_HALF_LIFE_TICKS, cropSellPrice, handPickedBonus, marketDepthGlut, marketFactor, marketRecoveryTicks } from '../src/core/balance'
import { CROP_IDS } from '../src/core/data/crops'
import { cropSale, decayMarket, marketCropPrice, marketSteadyFactor, marketSteadyGlut } from '../src/core/market'
import { sellItem } from '../src/core/mining'
import { createInitialState, type GameState, type Tile } from '../src/core/state'
import { step } from '../src/core/step'

const meta = createInitialState().meta
const glutted = (glut: number): GameState => ({
  ...createInitialState(),
  run: { ...createInitialState().run, market: { ...createInitialState().run.market, radish: glut } },
})
/** a mature radish on tile 0, with the market overridable */
const ripe = (glut: number): GameState => {
  const s = glutted(glut)
  const mature: Tile = { status: 'planted', cropId: 'radish', growth: 100, moisture: 1, ticksSinceMature: 0 }
  return { ...s, run: { ...s.run, tiles: [mature, ...s.run.tiles.slice(1)] } }
}
/** an rngState whose first roll lands in [0, 0.1): a copper sickle's double harvest */
const luckySeed = () => Array.from({ length: 1000 }, (_, i) => i).find((i) => nextRandom(i)[0] < 0.1)!

describe('sale pricing', () => {
  it('prices each unit at the glut before that unit\'s sale, in sequence', () => {
    const s = ripe(700)
    const sale = cropSale(s, 'radish', 3)
    const expected = marketCropPrice(s, 'radish', 700) + marketCropPrice(s, 'radish', 701) + marketCropPrice(s, 'radish', 702)
    expect(sale.cash).toBe(expected)
    expect(sale.market.radish).toBe(703)
  })

  it('selling 2 at once equals selling 1 then 1', () => {
    const s = ripe(700)
    const first = cropSale(s, 'radish', 1)
    const second = cropSale({ ...s, run: { ...s.run, market: first.market } }, 'radish', 1)
    expect(first.cash + second.cash).toBe(cropSale(s, 'radish', 2).cash)
    expect(second.market.radish).toBe(cropSale(s, 'radish', 2).market.radish)
  })

  it('a harvest pays the market price and adds one glut per unit (double harvest adds two)', () => {
    const s = ripe(700)
    const one = harvest(s, 0)
    if (!one.ok) throw new Error(one.error)
    // a player's harvest: the market price × the hand-picked bonus (batch 13)
    expect(one.state.run.cash - s.run.cash).toBe(Math.round(marketCropPrice(s, 'radish', 700) * handPickedBonus()))
    expect(marketCropPrice(s, 'radish', 700)).toBeLessThan(cropSellPrice('radish', meta, 0))
    expect(one.state.run.market.radish).toBe(701)

    const copper = { ...ripe(700).run, toolTier: { water: 0, harvest: 1, plant: 0 }, rngState: luckySeed() }
    const double = harvest({ ...ripe(700), run: copper }, 0)
    if (!double.ok) throw new Error(double.error)
    expect(double.state.run.counters.sales - copper.counters.sales).toBe(2)
    expect(double.state.run.market.radish).toBe(702)
  })

  it('items are not in the market: selling stone never moves a glut', () => {
    let s: GameState = { ...glutted(5), run: { ...glutted(5).run, inventory: { stone: 30 } } }
    const before = { ...s.run.market }
    for (let i = 0; i < 10; i++) {
      const r = sellItem(s, 'stone', 3)
      if (!r.ok) throw new Error(r.error)
      s = r.state
    }
    expect(s.run.market).toEqual(before)
  })
})

describe('decay', () => {
  it('halves the glut every MARKET_HALF_LIFE_TICKS', () => {
    const s = step(glutted(800), MARKET_HALF_LIFE_TICKS)
    expect(s.run.market.radish).toBeCloseTo(800 * MARKET_DECAY ** MARKET_HALF_LIFE_TICKS, 6)
    expect(s.run.market.radish).toBeCloseTo(400, 6)
  })

  it('snaps residue below the float epsilon to 0 and reuses the all-zero table', () => {
    const zeros = createInitialState().run.market
    expect(decayMarket(zeros)).toBe(zeros)
    const tiny = decayMarket({ ...zeros, radish: 1e-10 })
    expect(tiny.radish).toBe(0)
    expect(step(glutted(1e-10), 1).run.market.radish).toBe(0)
  })

  it('decays every crop\'s glut each tick, never another field', () => {
    const s = glutted(0)
    const some: GameState = { ...s, run: { ...s.run, market: { radish: 100, chilli: 50, pumpkin: 10, lemon: 1 } } }
    const after = step(some, 1).run.market
    for (const crop of CROP_IDS) expect(after[crop]).toBeCloseTo(some.run.market[crop] * MARKET_DECAY, 12)
  })
})

describe('factor and depth', () => {
  it('factor is 1 at no glut, sinks to the floor at the depth glut and never below', () => {
    for (const crop of CROP_IDS) {
      expect(marketFactor(crop, 0)).toBe(1)
      expect(marketFactor(crop, marketDepthGlut(crop))).toBeCloseTo(0.5, 9)
      expect(marketFactor(crop, marketDepthGlut(crop) * 100)).toBe(MARKET_FLOOR)
    }
  })

  it('depth uses the base grow ticks (fertilizer deepens the glut only through faster harvests)', () => {
    expect(marketDepthGlut('radish')).toBeCloseTo(120 / (100 * (1 - MARKET_DECAY)), 9)
    expect(marketDepthGlut('lemon')).toBeCloseTo(120 / (360 * (1 - MARKET_DECAY)), 9)
  })

  it('recovery: 0 when the factor is already ≥ 0.99, else the exact tick it gets there', () => {
    const target = 0.02 * marketDepthGlut('radish')
    expect(marketRecoveryTicks('radish', target)).toBe(0)
    const glut = marketDepthGlut('radish')
    const t = marketRecoveryTicks('radish', glut)
    expect(marketFactor('radish', glut * MARKET_DECAY ** t)).toBeGreaterThanOrEqual(0.99)
    expect(marketFactor('radish', glut * MARKET_DECAY ** (t - 1))).toBeLessThan(0.99)
  })
})

describe('steady state (pure closed form)', () => {
  it('24 tiles of one crop settle at 0.88–0.92; 120 tiles bottom out at the floor', () => {
    for (const crop of CROP_IDS) {
      expect(marketSteadyFactor(crop, 24, meta, 0)).toBeGreaterThanOrEqual(0.88)
      expect(marketSteadyFactor(crop, 24, meta, 0)).toBeLessThanOrEqual(0.92)
      expect(marketSteadyFactor(crop, 120, meta, 0)).toBeCloseTo(0.5, 2)
    }
  })

  it('fertilizer speeds harvests and deepens the glut: 24 lemons at Lv5 sit near 0.80', () => {
    expect(marketSteadyGlut(24, 180)).toBeCloseTo(2 * marketSteadyGlut(24, 360), 9)
    expect(marketSteadyFactor('lemon', 24, meta, 5)).toBeCloseTo(0.8, 2)
  })
})
