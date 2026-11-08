import { describe, expect, it } from 'vitest'
import { buyLicense, buyTile, harvest } from '../src/core/actions'
import { MILESTONES, earlierMilestones, recordMilestones } from '../src/core/data/milestones'
import { createFurnace, createInitialState, type GameState, type RunState, type Tile } from '../src/core/state'
import { step } from '../src/core/step'
import { assignWorker, buyCertificate, hireWorker } from '../src/core/workers'

function ok<T extends { ok: true; state: GameState }>(r: T | { ok: false; error: string }): GameState {
  if (!r.ok) throw new Error(r.error)
  return r.state
}

const withRun = (run: Partial<RunState>): GameState => {
  const s = createInitialState()
  return { ...s, run: { ...s.run, ...run } }
}
const mature = (cropId: 'radish', growth = 100): Tile => ({ status: 'planted', cropId, growth, moisture: 1, ticksSinceMature: 0 })
const ripe = (run: Partial<RunState> = {}): GameState => {
  const s = withRun(run)
  return { ...s, run: { ...s.run, tiles: [mature('radish'), ...s.run.tiles.slice(1)] } }
}

describe('the milestone table', () => {
  it('has unique ids and no trackingStarted (that one is migration-written)', () => {
    expect(new Set(MILESTONES.map((m) => m.id)).size).toBe(MILESTONES.length)
    expect(MILESTONES.find((m) => m.id === 'trackingStarted')).toBeUndefined()
  })
})

describe('recordMilestones', () => {
  it('records firstHarvest at the harvest\'s tick, once', () => {
    const s = ripe({ tick: 7 })
    const next = ok(harvest(s, 0))
    expect(next.run.milestones.firstHarvest).toBe(7)
    const again = ok(harvest({ ...next, run: { ...next.run, tiles: [mature('radish'), ...next.run.tiles.slice(1)] } }, 0))
    expect(again.run.milestones.firstHarvest).toBe(7)
  })

  it('records sales25 when the counter crosses 25, not before', () => {
    const base = ripe({ tick: 1, counters: { ...withRun({}).run.counters, harvests: 40, sales: 23 } })
    const before = ok(harvest(base, 0))
    expect(before.run.milestones.sales25).toBeUndefined()
    const after = ok(harvest({ ...before, run: { ...before.run, tiles: [mature('radish'), ...before.run.tiles.slice(1)] } }, 0))
    expect(after.run.milestones.sales25).toBe(1)
  })

  it('never back-dates: a milestone already true before tracking stays absent and counts as earlier', () => {
    // like a migrated v11 save: licenses held, milestones empty
    const s = ripe({ tick: 500, licenses: ['radish', 'pumpkin'] })
    const next = ok(harvest(s, 0))
    expect(next.run.milestones.licenseRadish).toBeUndefined()
    expect(next.run.milestones.licensePumpkin).toBeUndefined()
    expect(next.run.milestones.firstHarvest).toBe(500)
    expect(earlierMilestones(next.run)).toBeGreaterThanOrEqual(2)
  })

  it('monotone pickaxe tiers: jumping wooden → iron records copper and iron together', () => {
    const prev = withRun({ tick: 20, pickaxe: null })
    const next = withRun({ ...prev.run, tick: 21, pickaxe: { tier: 'iron', durability: 1200 } })
    const recorded = recordMilestones(prev.run, next.run)
    expect(recorded.milestones.copperPickaxe).toBe(21)
    expect(recorded.milestones.ironPickaxe).toBe(21)
  })

  it('tool levels, copper tiers and certificates each record their own step', () => {
    let s = withRun({ tick: 3, tools: { water: 3, harvest: 1, plant: 1 }, toolTier: { water: 1, harvest: 0, plant: 0 }, cash: 9999, inventory: { stone: 20 } })
    s = ok(buyLicense(s, 'lemon'))
    expect(s.run.milestones.licenseLemon).toBe(3)
    // already true before this action (as in a migrated save): never back-dated
    expect(s.run.milestones.toolWater1).toBeUndefined()
    expect(s.run.milestones.copperWater).toBeUndefined()
    const certified = ok(buyCertificate({ ...s, run: { ...s.run, counters: { ...s.run.counters, waters: 40 }, cash: 9999 } }, 'water'))
    expect(certified.run.milestones.certWater).toBe(3)
  })

  it('hire milestones record at 2, 4 and 6 pool workers', () => {
    let s = withRun({ tick: 9, counters: { ...withRun({}).run.counters, harvests: 30 }, cash: 99999, workers: { pool: 1, assigned: { plant: 0, water: 0, harvest: 0, ore: 0, fuel: 0, mine: 0, clerk: 0 }, certificates: [] } })
    s = ok(hireWorker(s))
    expect(s.run.milestones.hire2).toBe(9)
    expect(s.run.milestones.hire4).toBeUndefined()
  })

  it('tiles milestones record at 12, 16, 20 and 24 tiles', () => {
    let s = withRun({ tick: 2, tiles: Array.from({ length: 11 }, () => ({ status: 'untilled' as const, growth: 0, moisture: 0, ticksSinceMature: 0 })), cash: 1e6 })
    s = ok(buyTile(s))
    expect(s.run.milestones.tiles12).toBe(2)
    expect(s.run.milestones.tiles16).toBeUndefined()
  })

  it('records step-driven milestones per tick: firstBar lands with the first smelted bar', () => {
    const furnace = { ...createFurnace(), built: true, fire: 60, ore: 2, progress: 59 }
    const s = withRun({ tick: 41, furnace, inventory: { stone: 0 } })
    const next = step(s, 1)
    expect(next.run.lifetime.barsSmelted).toBe(1)
    expect(next.run.milestones.firstBar).toBe(42)
    // and the milestone stays absent when the predicate was already true before tracking
    const late = { ...s, run: { ...s.run, lifetime: { ...s.run.lifetime, barsSmelted: 5 } } }
    expect(step(late, 1).run.milestones.firstBar).toBeUndefined()
  })

  it('assignWorker milestones: nothing records for a free action with no new predicate', () => {
    const s = withRun({ tick: 5, workers: { pool: 2, assigned: { plant: 0, water: 0, harvest: 0, ore: 0, fuel: 0, mine: 0, clerk: 0 }, certificates: ['water', 'harvest'] } })
    const next = ok(assignWorker(s, 'water', 1))
    expect(next.run.milestones).toEqual({})
    expect(recordMilestones(s.run, s.run)).toBe(s.run)
  })
})
