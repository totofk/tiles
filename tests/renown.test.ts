import { describe, expect, it } from 'vitest'
import { harvest, type ActionResult } from '../src/core/actions'
import { MARKET_FLOOR, cropGrowTicks, deedCost, nextRenownTier, renownFloor, renownTier } from '../src/core/balance'
import { buyMetaUpgrade, sellFarm } from '../src/core/prestige'
import { createInitialState, type GameState, type Tile } from '../src/core/state'
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
  it('tier, floor and next at the thresholds', () => {
    const at = (p: number) => [renownTier(p), renownFloor(p), nextRenownTier(p)]
    expect(at(0)).toEqual([0, MARKET_FLOOR, 250])
    expect(at(249)).toEqual([0, 0.5, 250])
    expect(at(250)).toEqual([1, 0.55, 1000])
    expect(at(999)).toEqual([1, 0.55, 1000])
    expect(at(1000)).toEqual([2, 0.6, 4000])
    expect(at(3999)).toEqual([2, 0.6, 4000])
    expect(at(4000)).toEqual([3, 0.7, null])
    expect(at(10000)).toEqual([3, 0.7, null])
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

  it('resets to {} without Kept renown; keeps each reached tier threshold with it (tier 0 dropped)', () => {
    expect(ok(sellFarm(atGate(0))).run.renown).toEqual({})
    expect(ok(sellFarm(atGate(1))).run.renown).toEqual({ lemon: 1000, pumpkin: 4000 })
  })

  it('Kept renown costs 3 deeds, once', () => {
    expect(deedCost('keepRenown', 0)).toBe(3)
    const s = createInitialState()
    const bought = ok(buyMetaUpgrade({ ...s, meta: { ...s.meta, deeds: 5 } }, 'keepRenown'))
    expect([bought.meta.deeds, bought.meta.upgrades.keepRenown]).toEqual([2, 1])
    expect(buyMetaUpgrade({ ...bought, meta: { ...bought.meta, deeds: 9 } }, 'keepRenown')).toEqual({ ok: false, error: 'MAX_LEVEL' })
    expect(buyMetaUpgrade({ ...s, meta: { ...s.meta, deeds: 2 } }, 'keepRenown')).toEqual({ ok: false, error: 'NO_DEEDS' })
  })
})
