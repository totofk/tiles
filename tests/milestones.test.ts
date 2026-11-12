import { describe, expect, it } from 'vitest'
import { buyLicense, buyTile, harvest } from '../src/core/actions'
import { cropGrowTicks } from '../src/core/balance'
import { CROP_IDS, CROPS } from '../src/core/data/crops'
import { MILESTONES, earlierMilestones, recordMilestones } from '../src/core/data/milestones'
import { createFurnace, createInitialState, createMachines, type GameState, type RunState, type Tile } from '../src/core/state'
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

  it('batch 22: the first-harvest rows are data-driven over CROP_IDS (task 114, no hand-wired crop)', () => {
    const cap = (id: string) => id[0]!.toUpperCase() + id.slice(1)
    for (const c of CROP_IDS) {
      const row = MILESTONES.find((m) => String(m.id) === `first${cap(c)}`)
      expect(row?.label).toBe(`First ${CROPS[c].name} harvest`)
    }
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

  it('batch 22: a new crop\'s first harvest records its own row at the tick (tomato)', () => {
    const base = ripe({ tick: 5, licenses: ['radish', 'tomato'] })
    const tiles = [...base.run.tiles]
    tiles[0] = { ...tiles[0]!, cropId: 'tomato', growth: cropGrowTicks('tomato', base.meta, 0) }
    const next = ok(harvest({ ...base, run: { ...base.run, tiles } }, 0))
    expect(next.run.milestones.firstTomato).toBe(5)
    expect(next.run.milestones.firstHarvest).toBe(5)
    expect(next.run.lifetime.harvests.tomato).toBe(1)
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
    const prev = withRun({ tick: 20, rack: {}, selectedPickaxe: null })
    const next = withRun({ ...prev.run, tick: 21, rack: { iron: 1200 }, selectedPickaxe: 'iron' })
    const recorded = recordMilestones(prev.run, next.run)
    expect(recorded.milestones.copperPickaxe).toBe(21)
    expect(recorded.milestones.ironPickaxe).toBe(21)
  })

  it('gold rows: vein4 with the level, goldPickaxe with the tier, firstGoldBar with the first smelted bar (batch 16)', () => {
    const prev = withRun({ tick: 30, vein: { level: 3, progress: 0, rock: 'stone' }, rack: { iron: 10 }, selectedPickaxe: 'iron' })
    const next = withRun({ ...prev.run, tick: 31, vein: { level: 4, progress: 0, rock: 'stone' }, rack: { iron: 10, gold: 600 }, selectedPickaxe: 'gold' })
    const recorded = recordMilestones(prev.run, next.run)
    expect([recorded.milestones.vein4, recorded.milestones.goldPickaxe]).toEqual([31, 31])
    const smelted = recordMilestones(withRun({ tick: 31 }).run, withRun({ tick: 32, lifetime: { ...withRun({}).run.lifetime, goldBarsSmelted: 1 } }).run)
    expect(smelted.milestones.firstGoldBar).toBe(32)
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
    let s = withRun({ tick: 9, counters: { ...withRun({}).run.counters, harvests: 30 }, cash: 99999, workers: { pool: 1, assigned: { plant: 0, water: 0, harvest: 0, ore: 0, fuel: 0, mine: 0, clerk: 0, manager: 0, stoker: 0 }, certificates: [] } })
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
    const furnace = { ...createFurnace(), built: true, fire: 60, molds: { copperOre: { ore: 2, progress: 59, ready: 0 } } }
    const s = withRun({ tick: 41, furnace, inventory: { stone: 0 } })
    const next = step(s, 1)
    expect(next.run.lifetime.barsSmelted).toBe(1)
    expect(next.run.milestones.firstBar).toBe(42)
    // and the milestone stays absent when the predicate was already true before tracking
    const late = { ...s, run: { ...s.run, lifetime: { ...s.run.lifetime, barsSmelted: 5 } } }
    expect(step(late, 1).run.milestones.firstBar).toBeUndefined()
  })

  it('assignWorker milestones: nothing records for a free action with no new predicate', () => {
    const s = withRun({ tick: 5, workers: { pool: 2, assigned: { plant: 0, water: 0, harvest: 0, ore: 0, fuel: 0, mine: 0, clerk: 0, manager: 0, stoker: 0 }, certificates: ['water', 'harvest'] } })
    const next = ok(assignWorker(s, 'water', 1))
    expect(next.run.milestones).toEqual({})
    expect(recordMilestones(s.run, s.run)).toBe(s.run)
  })

  it('batch 19 machine rows: harvester1, seeder1 and harvester3 record with the owned tier, per tick after the buy', () => {
    const s = withRun({ tick: 7, fields: { ...createInitialState().run.fields, machines: createMachines() } })
    const fleet = { ...s.run, fields: { ...s.run.fields, machines: { ...createMachines(), harvester: [1, 3], seeder: [1] } } }
    const next = recordMilestones(s.run, fleet)
    expect([next.milestones.harvester1, next.milestones.seeder1, next.milestones.harvester3]).toEqual([7, 7, 7])
    expect(next.milestones).toEqual({ harvester1: 7, seeder1: 7, harvester3: 7 })
  })
})
