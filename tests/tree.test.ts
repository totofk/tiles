import { describe, expect, it } from 'vitest'
import { harvest, plant, till, water } from '../src/core/actions'
import { RENOWN_BY_HAND, RENOWN_BY_WORKER, TREE_STOCK_CAP, cropSeedCost, handPickedBonus, treeCadenceTicks, treePlantCost } from '../src/core/balance'
import { harvestSale } from '../src/core/orders'
import { createFreshRun, createInitialState, type GameState, type Tile } from '../src/core/state'
import { step } from '../src/core/step'
import { tapTile } from '../src/core/tile'
import { pressTool, toolTargets } from '../src/core/tools'
import { isTreeTile, plantTreeBed } from '../src/core/tree'

const untilled: Tile = { status: 'untilled', growth: 0, moisture: 0, ticksSinceMature: 0 }
const orchard = (run: Partial<GameState['run']> = {}): GameState => {
  const s = createInitialState()
  return {
    ...s,
    run: {
      ...s.run,
      listing: { district: 'orchardValley', soil: null },
      tiles: Array.from({ length: 12 }, () => untilled),
      licenses: ['potato', 'lemon', 'strawberry'],
      cash: 10_000,
      ...run,
    },
  }
}
const ok = (r: { ok: true; state: GameState } | { ok: false; error: string }): GameState => {
  if (!r.ok) throw new Error(r.error)
  return r.state
}
/** an Orchard run with a lemon tree on bed 1 (tiles 6 … 11) holding `stock` fruit per tile */
const withFruit = (stock: number[], run: Partial<GameState['run']> = {}): GameState => {
  const s = ok(plantTreeBed(orchard(run), 1, 'lemon'))
  return { ...s, run: { ...s.run, tree: { ...s.run.tree!, stock } } }
}
const LEMON = treeCadenceTicks('lemon')

describe('batch 36.2: the 🌳 fruit tree bed', () => {
  it('cadence 1.25 × base grow ticks and price 12 × seed: lemon 775 / 💰900, grape 975 / 💰1,680, strawberry 1,200 / 💰3,120', () => {
    const { meta } = createInitialState()
    expect((['lemon', 'grape', 'strawberry'] as const).map((c) => [treeCadenceTicks(c), treePlantCost(c, meta)])).toEqual([
      [775, 900],
      [975, 1680],
      [1200, 3120],
    ])
    expect(treePlantCost('lemon', meta)).toBe(12 * cropSeedCost('lemon', meta))
  })

  it('plantTreeBed errors in order: LOCKED, BAD_TILE, NO_LICENSE, BED_BUSY, NO_ENERGY, NO_CASH', () => {
    const planted: Tile = { status: 'planted', cropId: 'potato', growth: 0, moisture: 1, ticksSinceMature: 0 }
    expect(plantTreeBed({ ...orchard(), run: { ...orchard().run, listing: { district: 'plain', soil: null } } }, 0, 'lemon')).toEqual({ ok: false, error: 'LOCKED' })
    expect(plantTreeBed(orchard(), 0, 'chilli')).toEqual({ ok: false, error: 'LOCKED' })
    expect(plantTreeBed(withFruit([0, 0, 0, 0, 0, 0]), 0, 'lemon')).toEqual({ ok: false, error: 'LOCKED' })
    expect(plantTreeBed(orchard(), 1.5, 'lemon')).toEqual({ ok: false, error: 'BAD_TILE' })
    expect(plantTreeBed(orchard(), 2, 'lemon')).toEqual({ ok: false, error: 'BAD_TILE' })
    expect(plantTreeBed(orchard(), 0, 'grape')).toEqual({ ok: false, error: 'NO_LICENSE' })
    const busy = orchard()
    expect(plantTreeBed({ ...busy, run: { ...busy.run, tiles: busy.run.tiles.map((t, i) => (i === 3 ? planted : t)) } }, 0, 'lemon')).toEqual({ ok: false, error: 'BED_BUSY' })
    expect(plantTreeBed(orchard({ energy: 0 }), 0, 'lemon')).toEqual({ ok: false, error: 'NO_ENERGY' })
    expect(plantTreeBed(orchard({ cash: 899 }), 0, 'lemon')).toEqual({ ok: false, error: 'NO_CASH' })
  })

  it('planting spends 💰900 and 1 ⚡, tills the 6 tiles and starts every tile at −1 cadence', () => {
    const s = orchard({ energy: 5 })
    const next = ok(plantTreeBed(s, 1, 'lemon'))
    expect([next.run.cash, next.run.energy]).toEqual([10_000 - 900, 4])
    expect(next.run.tiles.slice(6)).toEqual(Array(6).fill({ status: 'tilled', growth: 0, moisture: 0, ticksSinceMature: 0 }))
    expect(next.run.tiles.slice(0, 6)).toEqual(s.run.tiles.slice(0, 6))
    expect(next.run.tree).toEqual({ bed: 1, crop: 'lemon', ticks: Array(6).fill(-LEMON), stock: Array(6).fill(0) })
    expect([isTreeTile(next.run, 5), isTreeTile(next.run, 6), isTreeTile(next.run, 11)]).toEqual([false, true, true])
  })

  it('first fruit after 2 cadences, then one per cadence per tile; a tile pauses at 3; no water, never rots or dries', () => {
    const s = ok(plantTreeBed(orchard(), 1, 'lemon'))
    const before = step(s, 2 * LEMON - 1)
    expect(before.run.tree!.stock).toEqual(Array(6).fill(0))
    const first = step(before, 1)
    expect(first.run.tree!.stock).toEqual(Array(6).fill(1))
    expect(step(first, LEMON).run.tree!.stock).toEqual(Array(6).fill(2))
    const full = step(first, 2 * LEMON)
    expect(full.run.tree!.stock).toEqual(Array(6).fill(TREE_STOCK_CAP))
    const later = step(full, 3 * LEMON)
    expect(later.run.tree).toEqual(full.run.tree)
    expect(later.run.tiles.slice(6)).toEqual(s.run.tiles.slice(6))
  })

  it('water → IRRIGATED, till / plant → LOCKED on its tiles; plant and water targets skip them', () => {
    const s = withFruit([0, 0, 0, 0, 0, 0])
    expect(water(s, 7)).toEqual({ ok: false, error: 'IRRIGATED' })
    expect(till(s, 7)).toEqual({ ok: false, error: 'LOCKED' })
    expect(plant(s, 7, 'potato')).toEqual({ ok: false, error: 'LOCKED' })
    expect(harvest(s, 7)).toEqual({ ok: false, error: 'NOT_MATURE' })
    const tilled = { ...s, run: { ...s.run, tiles: s.run.tiles.map((t, i) => (i === 0 ? { ...t, status: 'tilled' as const } : t)) } }
    expect(toolTargets(tilled, 'plant')).toEqual([0])
    expect(toolTargets(tilled, 'water')).toEqual([])
  })

  it('harvest takes the whole tile stock: ×1.25 and +2 renown by hand, ×1 and +1 by a worker; harvests +1, lifetime +1', () => {
    const s = withFruit([3, 0, 0, 0, 0, 0], { energy: 5 })
    const hand = ok(harvest(s, 6))
    expect(hand.run.tree!.stock).toEqual([0, 0, 0, 0, 0, 0])
    expect(hand.run.cash - s.run.cash).toBe(harvestSale(s, 'lemon', 3, handPickedBonus()).cash)
    expect([hand.run.energy, hand.run.renown.lemon, hand.run.counters.harvests, hand.run.counters.sales]).toEqual([s.run.energy - 1, RENOWN_BY_HAND, 1, 3])
    expect(hand.run.lifetime.harvests.lemon).toBe(1)
    expect(hand.run.rngState).toBe(s.run.rngState)
    const worker = ok(harvest(s, 6, 0))
    expect(worker.run.cash - s.run.cash).toBe(harvestSale(s, 'lemon', 3).cash)
    expect([worker.run.energy, worker.run.renown.lemon]).toEqual([s.run.energy, RENOWN_BY_WORKER])
    // a tap on a tree tile harvests it
    expect(ok(tapTile(s, 6, 'potato')).run.tree!.stock[0]).toBe(0)
  })

  it('the harvest tool and the harvester take ripe crops first, then tree tiles by most fruit; the waterer skips them', () => {
    const ripe: Tile = { status: 'planted', cropId: 'potato', growth: 999, moisture: 1, ticksSinceMature: 0 }
    const base = withFruit([1, 3, 0, 2, 0, 0], { energy: 10 })
    const s = { ...base, run: { ...base.run, tiles: base.run.tiles.map((t, i) => (i === 2 ? ripe : t)) } }
    expect(toolTargets(s, 'harvest')).toEqual([2, 7, 9, 6])
    const press = pressTool({ ...s, run: { ...s.run, tools: { ...s.run.tools, harvest: 3 } } }, 'harvest', 'potato')
    expect(press.ok && press.state.run.tree!.stock).toEqual([0, 0, 0, 0, 0, 0])
    const workers = (job: 'harvest' | 'water') => ({ ...s, run: { ...s.run, workers: { ...s.run.workers, pool: 1, assigned: { ...s.run.workers.assigned, [job]: 1 } } } })
    // one harvester action on the first worker tick: the ripe potato, then the next action the fullest tree tile
    const h = step(workers('harvest'), 1)
    expect(h.run.tiles[2].status).toBe('tilled')
    expect(h.run.tree!.stock).toEqual([1, 3, 0, 2, 0, 0])
    const noCrop = { ...workers('harvest'), run: { ...workers('harvest').run, tiles: base.run.tiles } }
    const h2 = step(noCrop, 1)
    expect(h2.run.tree!.stock).toEqual([1, 0, 0, 2, 0, 0])
    expect(h2.run.renown.lemon).toBe(RENOWN_BY_WORKER)
    const w = step({ ...workers('water'), run: { ...workers('water').run, tiles: base.run.tiles } }, 1)
    expect(w.run.counters.waters).toBe(0)
    expect(w.run.tiles.slice(6)).toEqual(base.run.tiles.slice(6))
  })

  it('a sale resets the tree; step(s, a + b) = step(step(s, a), b) with a tree', () => {
    const s = withFruit([0, 1, 2, 3, 0, 0])
    expect(createFreshRun(s.meta).tree).toBeNull()
    expect(step(step(s, 400), 1300)).toEqual(step(s, 1700))
  })
})
