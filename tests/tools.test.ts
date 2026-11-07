import { describe, expect, it } from 'vitest'
import { harvest, plant, water, type ActionResult } from '../src/core/actions'
import { cropGrowTicks, cropSeedCost, toolCost, toolNMax, toolUnlock } from '../src/core/balance'
import { TOOLS, TOOL_JOBS, type ToolJob } from '../src/core/data/tools'
import { createInitialState, createTile, type GameState, type Tile } from '../src/core/state'
import { buyTool, pressTool, setToolN, toolCount, toolTargets, type ToolPress } from '../src/core/tools'

const meta = createInitialState().meta
const grow = cropGrowTicks('radish', meta, 0)
const growing = (moisture: number): Tile => ({ ...createTile(), status: 'planted', cropId: 'radish', growth: 1, moisture })
const ripe = (ticksSinceMature: number): Tile => ({ ...growing(0), growth: grow, ticksSinceMature })
const tilled: Tile = { ...createTile(), status: 'tilled' }

function withRun(tiles: Tile[], run: Partial<GameState['run']> = {}): GameState {
  const s = createInitialState()
  return { ...s, run: { ...s.run, tiles: [...tiles, ...s.run.tiles.slice(tiles.length)], ...run } }
}
const tools = (job: ToolJob, level: number) => ({ ...createInitialState().run.tools, [job]: level })

function pressed(r: ToolPress) {
  if (!r.ok) throw new Error(`expected ok, got ${r.error}`)
  return r
}
function okState(r: ActionResult): GameState {
  if (!r.ok) throw new Error(`expected ok, got ${r.error}`)
  return r.state
}

describe('balance and names', () => {
  it('level 2 n ranges 1 … ceil(tiles / 3)', () => {
    expect([1, 6, 9, 10, 24].map(toolNMax)).toEqual([1, 2, 3, 4, 8])
  })
  it('starting unlocks and prices (PLAN.md batch 5)', () => {
    const table = TOOL_JOBS.map((job) => [1, 2, 3].map((l) => [toolUnlock(job, l).counter, toolUnlock(job, l).at, toolCost(job, l, meta)]))
    expect(table).toEqual([
      [['waters', 20, 40], ['waters', 60, 120], ['waters', 150, 300]],
      [['harvests', 15, 50], ['harvests', 50, 150], ['harvests', 120, 350]],
      [['plants', 15, 40], ['plants', 50, 120], ['plants', 120, 300]],
    ])
    expect(TOOLS.water.names).toEqual(['Watering Can', 'Garden Hose', 'Water Cart'])
    expect(TOOLS.harvest.names).toEqual(['Sickle', 'Scythe', 'Reaper'])
    expect(TOOLS.plant.names).toEqual(['Dibber', 'Seed Drill', 'Seed Spreader'])
  })
})

describe('toolTargets priority', () => {
  it('harvest: ripe longest first, ties by tile order', () => {
    const s = withRun([ripe(5), growing(0), ripe(40), ripe(5), ripe(90)])
    expect(toolTargets(s, 'harvest')).toEqual([4, 2, 0, 3])
  })
  it('water: growing tiles below full, driest first; ripe and full tiles skipped', () => {
    const s = withRun([growing(0.5), growing(0), ripe(1), growing(1), growing(0.2), tilled])
    expect(toolTargets(s, 'water')).toEqual([1, 4, 0])
  })
  it('plant: tilled tiles in tile order', () => {
    expect(toolTargets(withRun([growing(0), tilled, createTile(), tilled]), 'plant')).toEqual([1, 3])
  })
})

describe('pressTool', () => {
  const dryField = [growing(0.5), growing(0), growing(0.2), growing(0.1), growing(0.9)]

  it('without the tool returns LOCKED; with nothing eligible NOTHING_TO_DO and costs nothing', () => {
    expect(pressTool(withRun(dryField), 'water', 'radish')).toEqual({ ok: false, error: 'LOCKED' })
    const empty = withRun([], { tools: tools('harvest', 3) })
    expect(pressTool(empty, 'harvest', 'radish')).toEqual({ ok: false, error: 'NOTHING_TO_DO' })
  })

  it('level 1 does the single best tile', () => {
    const r = pressed(pressTool(withRun(dryField, { tools: tools('water', 1) }), 'water', 'radish'))
    expect([r.done, r.wanted, r.stoppedBy]).toEqual([1, 1, null])
    expect(r.state.run.tiles.slice(0, 5).map((t) => t.moisture)).toEqual([0.5, 1, 0.2, 0.1, 0.9])
  })

  it('level 2 does toolN tiles, clamped to ceil(tiles / 3) and to what is eligible', () => {
    const s = withRun(dryField, { tools: tools('water', 2), toolN: { water: 2, harvest: 1, plant: 1 } })
    const r = pressed(pressTool(s, 'water', 'radish'))
    expect([r.done, r.wanted]).toEqual([2, 2])
    expect(r.state.run.tiles.slice(0, 5).map((t) => t.moisture)).toEqual([0.5, 1, 0.2, 1, 0.9]) // 0, then 0.1
    const big = { ...s, run: { ...s.run, toolN: { ...s.run.toolN, water: 99 } } }
    expect(toolCount(big.run, 'water')).toBe(3)
    expect(pressed(pressTool(big, 'water', 'radish')).wanted).toBe(3)
  })

  it('level 3 does every eligible tile', () => {
    const r = pressed(pressTool(withRun(dryField, { tools: tools('water', 3) }), 'water', 'radish'))
    expect([r.done, r.wanted]).toEqual([5, 5])
    expect(r.state.run.counters.waters).toBe(5)
  })

  it('a press equals the same manual actions in sequence, at every level', () => {
    const field = [ripe(3), tilled, growing(0.3), ripe(50), tilled, growing(0)]
    const manual = { water, harvest, plant: (s: GameState, i: number) => plant(s, i, 'radish') }
    for (const job of TOOL_JOBS)
      for (const level of [1, 2, 3]) {
        const s = withRun(field, { tools: tools(job, level), toolN: { water: 2, harvest: 2, plant: 2 } })
        const r = pressed(pressTool(s, job, 'radish'))
        const expected = toolTargets(s, job)
          .slice(0, r.wanted)
          .reduce((acc, i) => okState(manual[job](acc, i)), s)
        expect(r.state).toEqual(expected)
        expect(r.done).toBe(r.wanted)
      }
  })

  it('runs out part way: does as many as it can and says why', () => {
    const r = pressed(pressTool(withRun(dryField, { tools: tools('water', 3), energy: 2 }), 'water', 'radish'))
    expect([r.done, r.wanted, r.stoppedBy]).toEqual([2, 5, 'NO_ENERGY'])
    expect(r.state.run.energy).toBe(0)

    const cash = 2 * cropSeedCost('radish', meta) + 1
    const p = pressed(pressTool(withRun([tilled, tilled, tilled, tilled], { tools: tools('plant', 3), cash }), 'plant', 'radish'))
    expect([p.done, p.wanted, p.stoppedBy]).toEqual([2, 4, 'NO_CASH'])
    expect(p.state.run.cash).toBe(1)
  })

  it('eligible tiles but no energy: ok, nothing done, state unchanged', () => {
    const s = withRun(dryField, { tools: tools('water', 3), energy: 0 })
    expect(pressTool(s, 'water', 'radish')).toEqual({ ok: true, state: s, done: 0, wanted: 5, stoppedBy: 'NO_ENERGY' })
  })

  it('plant uses pouch seeds first, then auto-buys', () => {
    const s = withRun([tilled, tilled], { tools: tools('plant', 3), seeds: { radish: 1 }, cash: 100 })
    const r = pressed(pressTool(s, 'plant', 'radish'))
    expect(r.state.run.seeds.radish).toBe(0)
    expect(r.state.run.cash).toBe(100 - cropSeedCost('radish', meta)) // 1 from the pouch, then 1 bought
  })
})

describe('buyTool', () => {
  const counters = (n: number) => ({ ...createInitialState().run.counters, waters: n })

  it('is locked until the job counter reaches the next level threshold', () => {
    expect(buyTool(withRun([], { cash: 1000, counters: counters(19) }), 'water')).toEqual({ ok: false, error: 'LOCKED' })
    const s = okState(buyTool(withRun([], { cash: 1000, counters: counters(20) }), 'water'))
    expect(s.run.tools.water).toBe(1)
    expect(s.run.cash).toBe(1000 - 40)
    expect(buyTool(s, 'water')).toEqual({ ok: false, error: 'LOCKED' }) // level 2 needs 60
  })

  it('buys levels in order, once each, up to 3; costs no energy', () => {
    let s = withRun([], { cash: 1000, counters: counters(150) })
    for (const level of [1, 2, 3]) {
      const next = okState(buyTool(s, 'water'))
      expect(next.run.tools.water).toBe(level)
      expect(next.run.energy).toBe(s.run.energy)
      s = next
    }
    expect(s.run.cash).toBe(1000 - 40 - 120 - 300)
    expect(buyTool(s, 'water')).toEqual({ ok: false, error: 'MAX_LEVEL' })
  })

  it('rejects short cash', () => {
    expect(buyTool(withRun([], { cash: 39, counters: counters(20) }), 'water')).toEqual({ ok: false, error: 'NO_CASH' })
  })
})

describe('setToolN', () => {
  it('accepts 1 … ceil(tiles / 3), rejects the rest', () => {
    const s = createInitialState()
    expect(okState(setToolN(s, 'harvest', 3)).run.toolN.harvest).toBe(3)
    for (const n of [0, 4, 1.5, NaN]) expect(setToolN(s, 'harvest', n)).toEqual({ ok: false, error: 'BAD_AMOUNT' })
  })
})
