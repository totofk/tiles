import { describe, expect, it } from 'vitest'
import { harvest, type ActionResult } from '../src/core/actions'
import {
  MARKET_FLOOR,
  cropGrowTicks,
  cropRotGraceTicks,
  cropSellPrice,
  deedCost,
  nextRenownTier,
  renownBadge,
  renownFloor,
  renownGrow,
  renownTier,
} from '../src/core/balance'
import type { CropId } from '../src/core/data/crops'
import { fieldsCropIncomePerHour, pressuredCycle } from '../src/core/fields'
import { buyMetaUpgrade, sellFarm } from '../src/core/prestige'
import { createInitialState, type GameState, type Tile } from '../src/core/state'
import { step } from '../src/core/step'
import { isMature, ticksUntilRot } from '../src/core/tile'
import { pressTool } from '../src/core/tools'

const ok = (r: ActionResult): GameState => {
  if (!r.ok) throw new Error(r.error)
  return r.state
}

/** tile 0 ripe radish; the rest of the run as given */
function ripe(run: Partial<GameState['run']> = {}): GameState {
  const s = createInitialState()
  const tile: Tile = { status: 'planted', cropId: 'radish', growth: cropGrowTicks('radish', s.meta, 0), moisture: 1, ticksSinceMature: 0 }
  return { ...s, run: { ...s.run, ...run, tiles: s.run.tiles.map((t, i) => (i === 0 ? tile : t)) } }
}

describe('renown gain (home harvests only)', () => {
  it('a tap +2, a tool press +2, a worker +1', () => {
    expect(ok(harvest(ripe(), 0)).run.renown).toEqual({ radish: 2 })
    const press = pressTool(ripe({ tools: { water: 0, harvest: 1, plant: 0 } }), 'harvest', 'radish')
    expect(press.ok && press.state.run.renown).toEqual({ radish: 2 })
    // a worker harvests at energy 0 (workers.ts WORK.harvest)
    expect(ok(harvest(ripe(), 0, 0)).run.renown).toEqual({ radish: 1 })
    expect(ok(harvest(ripe({ renown: { radish: 10, lemon: 3 } }), 0)).run.renown).toEqual({ radish: 12, lemon: 3 })
  })

  it('a double harvest (gold sickle) is still one harvest = one gain', () => {
    const s = ripe({ toolTier: { water: 0, harvest: 3, plant: 0 } })
    // find a seed whose roll doubles, so the test pins the double case and not the single one
    const doubled = Array.from({ length: 50 }, (_, seed) => ok(harvest({ ...s, run: { ...s.run, rngState: seed } }, 0)).run).find((r) => r.counters.sales === 2)!
    expect(doubled.renown).toEqual({ radish: 2 })
  })
})

describe('renown tiers', () => {
  it('PIN36t: tier, floor, next, badge and grow at the 5 thresholds', () => {
    const at = (p: number) => [renownTier(p), renownFloor(p), nextRenownTier(p), renownBadge(p), renownGrow(p)]
    expect(at(0)).toEqual([0, MARKET_FLOOR, 250, '', 1])
    expect(at(249)).toEqual([0, 0.5, 250, '', 1])
    expect(at(250)).toEqual([1, 0.55, 1000, '🥉', 1])
    expect(at(999)).toEqual([1, 0.55, 1000, '🥉', 1])
    expect(at(1000)).toEqual([2, 0.6, 4000, '🥈', 0.95])
    expect(at(3999)).toEqual([2, 0.6, 4000, '🥈', 0.95])
    expect(at(4000)).toEqual([3, 0.7, 12000, '🥇', 0.9])
    expect(at(11999)).toEqual([3, 0.7, 12000, '🥇', 0.9])
    expect(at(12000)).toEqual([4, 0.7, 30000, '🏅', 0.85])
    expect(at(29999)).toEqual([4, 0.7, 30000, '🏅', 0.85])
    expect(at(30000)).toEqual([5, 0.75, null, '🏆', 0.8])
    expect(at(99999)).toEqual([5, 0.75, null, '🏆', 0.8])
  })

  it('PIN36t: the grow factor sits inside the rounding; a home tile matures on it; rot grace stays unboosted', () => {
    const s = createInitialState()
    const base = cropGrowTicks('strawberry', s.meta, 0)
    expect(cropGrowTicks('strawberry', s.meta, 0, null, 0.8)).toBe(Math.round(base * 0.8))
    const fast = Math.round(base * 0.95)
    // a home strawberry tile at renown 1,000: stepTile, harvest and isMature agree on round(base × 0.95)
    const tile: Tile = { status: 'planted', cropId: 'strawberry', growth: fast - 1, moisture: 1, ticksSinceMature: 0 }
    const run = { ...s.run, licenses: [...s.run.licenses, 'strawberry' as const], renown: { strawberry: 1000 }, tiles: s.run.tiles.map((t, i) => (i === 0 ? tile : t)) }
    const before = { ...s, run }
    expect(isMature(before.run.tiles[0], before)).toBe(false)
    expect(harvest(before, 0)).toEqual({ ok: false, error: 'NOT_MATURE' })
    const after = step(before, 1)
    expect(after.run.tiles[0].growth).toBe(fast)
    expect(isMature(after.run.tiles[0], after)).toBe(true)
    expect(harvest(after, 0).ok).toBe(true)
    // one more tick: the grown tile starts its rot clock (it no longer grows)
    expect(step(after, 1).run.tiles[0]).toMatchObject({ growth: fast, ticksSinceMature: 1 })
    // the rot grace reads the unboosted grow time (ROT_GRACE_FACTOR 2)
    expect(cropRotGraceTicks('strawberry', s.meta)).toBe(2 * base)
    expect(ticksUntilRot({ ...tile, growth: fast, ticksSinceMature: 0 }, before)).toBe(2 * base + 1)
  })
})

describe('renown in the plan', () => {
  it('fieldsCropIncomePerHour rises with renown on a glutted crop (2,000 tiles sit on the floor)', () => {
    const s = createInitialState()
    const at = (points: number) => fieldsCropIncomePerHour({ ...s, run: { ...s.run, renown: { lemon: points } } }, 'lemon', 2000)
    const [none, t1, t2, t3] = [0, 250, 1000, 4000].map(at)
    expect(none).toBeLessThan(t1)
    expect(t1).toBeLessThan(t2)
    expect(t2).toBeLessThan(t3)
    // the 0.5 → 0.7 floor lifts the whole sale part by 0.2 × sell per unit
    expect(t3 - none).toBeCloseTo((2000 / pressuredCycle(s, 'lemon')) * 3600 * 0.2 * cropSellPrice('lemon', s.meta, 0), 6)
  })
})

describe('renown and Sell the farm', () => {
  const atGate = (keepRenown: number): GameState => {
    const s = createInitialState()
    return {
      meta: { ...s.meta, upgrades: { ...s.meta.upgrades, keepRenown } },
      run: {
        ...s.run,
        lifetime: { ...s.run.lifetime, cashEarned: 640_000 },
        workers: { ...s.run.workers, certificates: ['plant', 'harvest'] },
        workshop: { built: true, beds: [true, false, false, false], valve: false },
        renown: { lemon: 2413, radish: 150, pumpkin: 4000 },
      },
    }
  }

  it('PIN36t: the sale keeps every crop\'s points with no deed owned (tier 0 kept too)', () => {
    const s = atGate(0)
    const sold = ok(sellFarm({ ...s, run: { ...s.run, renown: { lemon: 1000, pumpkin: 100 } } }))
    expect(sold.run.renown).toEqual({ lemon: 1000, pumpkin: 100 })
    expect(ok(sellFarm(atGate(1))).run.renown).toEqual({ lemon: 2413, radish: 150, pumpkin: 4000 })
  })

  it('PIN36t: Apprentices — a worker harvest +2 with it, +1 without; a tap +2 either way', () => {
    const apprentices = (s: GameState): GameState => ({ ...s, meta: { ...s.meta, upgrades: { ...s.meta.upgrades, keepRenown: 1 } } })
    expect(ok(harvest(ripe(), 0, 0)).run.renown).toEqual({ radish: 1 })
    expect(ok(harvest(apprentices(ripe()), 0, 0)).run.renown).toEqual({ radish: 2 })
    expect(ok(harvest(ripe(), 0)).run.renown).toEqual({ radish: 2 })
    expect(ok(harvest(apprentices(ripe()), 0)).run.renown).toEqual({ radish: 2 })
  })

  it('PIN36t: start seeds — a kit for each licensed crop at tier ≥ 1 (6, 24 from 🏅); without the vault only the starting crop', () => {
    const seedsAt = (renown: Partial<Record<CropId, number>>, vault: boolean) => {
      const s = atGate(0)
      const meta = { ...s.meta, upgrades: { ...s.meta.upgrades, keepLicenses: vault ? 1 : 0 } }
      return ok(sellFarm({ meta, run: { ...s.run, licenses: ['potato', 'radish', 'lemon'], renown } })).run.seeds
    }
    expect(seedsAt({ potato: 250 }, false)).toEqual({ potato: 6 })
    expect(seedsAt({ potato: 12000 }, false)).toEqual({ potato: 24 })
    expect(seedsAt({ potato: 249 }, false)).toEqual({})
    expect(seedsAt({ potato: 250, lemon: 4000 }, false)).toEqual({ potato: 6 })
    expect(seedsAt({ potato: 250, radish: 250, lemon: 4000 }, true)).toEqual({ potato: 6, radish: 6, lemon: 6 })
    expect(seedsAt({ radish: 30000 }, true)).toEqual({ radish: 24 })
    expect(createInitialState().run.seeds).toEqual({})
  })

  it('Kept renown (Apprentices) costs 3 deeds, once', () => {
    expect(deedCost('keepRenown', 0)).toBe(3)
    const s = createInitialState()
    const bought = ok(buyMetaUpgrade({ ...s, meta: { ...s.meta, deeds: 5 } }, 'keepRenown'))
    expect([bought.meta.deeds, bought.meta.upgrades.keepRenown]).toEqual([2, 1])
    expect(buyMetaUpgrade({ ...bought, meta: { ...bought.meta, deeds: 9 } }, 'keepRenown')).toEqual({ ok: false, error: 'MAX_LEVEL' })
    expect(buyMetaUpgrade({ ...s, meta: { ...s.meta, deeds: 2 } }, 'keepRenown')).toEqual({ ok: false, error: 'NO_DEEDS' })
  })
})
