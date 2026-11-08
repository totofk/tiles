import { describe, expect, it } from 'vitest'
import { harvest, nextRandom, plant, water, type ActionResult } from '../src/core/actions'
import {
  cropGrowTicks,
  cropSeedCost,
  cropSellPrice,
  doubleHarvestChance,
  handPickedBonus,
  seedKeepChance,
  toolCost,
  toolNMax,
  toolTierCost,
  toolTierMax,
  toolUnlock,
  waterMoisture,
} from '../src/core/balance'
import { TOOLS, TOOL_JOBS, type ToolJob } from '../src/core/data/tools'
import { createInitialState, createTile, type GameState, type Tile } from '../src/core/state'
import { buyCopperTool, buyTool, pressTool, setToolN, toolCount, toolTargets, type ToolPress } from '../src/core/tools'

/** rngState after n draws */
const advance = (rng: number, n: number) => Array.from({ length: n }).reduce<number>((r) => nextRandom(r)[1], rng)

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

  it('a press equals the same manual actions in sequence, at every level and tier (PRNG position included)', () => {
    const field = [ripe(3), tilled, growing(0.3), ripe(50), tilled, growing(0), ripe(7), tilled, growing(1.5)]
    const manual = { water, harvest, plant: (s: GameState, i: number) => plant(s, i, 'radish') }
    for (const tier of [0, 1])
      for (const job of TOOL_JOBS)
        for (const level of [1, 2, 3]) {
          const toolTier = { water: tier, harvest: tier, plant: tier }
          const s = withRun(field, { tools: tools(job, level), toolN: { water: 2, harvest: 2, plant: 2 }, toolTier, seeds: { radish: 2 } })
          const r = pressed(pressTool(s, job, 'radish'))
          const expected = toolTargets(s, job)
            .slice(0, r.wanted)
            .reduce((acc, i) => okState(manual[job](acc, i)), s)
          expect(r.state).toEqual(expected)
          expect(r.done).toBe(r.wanted)
          // one draw per harvested / planted tile at tier 1, none at tier 0 or for watering
          const draws = tier === 1 && job !== 'water' ? r.done : 0
          expect(r.state.run.rngState).toBe(advance(s.run.rngState, draws))
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
    expect(pressTool(s, 'water', 'radish')).toEqual({ ok: true, state: s, done: 0, wanted: 5, stoppedBy: 'NO_ENERGY', bonus: 0 })
  })

  it('plant uses pouch seeds first, then auto-buys', () => {
    const s = withRun([tilled, tilled], { tools: tools('plant', 3), seeds: { radish: 1 }, cash: 100 })
    const r = pressed(pressTool(s, 'plant', 'radish'))
    expect(r.state.run.seeds.radish).toBe(0)
    expect(r.state.run.cash).toBe(100 - cropSeedCost('radish', meta)) // 1 from the pouch, then 1 bought
  })
})

describe('copper tier (batch 7.1)', () => {
  const copper = { water: 1, harvest: 1, plant: 1 }
  // a player's harvest sells hand-picked (batch 13)
  const sell = Math.round(cropSellPrice('radish', meta, 0) * handPickedBonus())
  const seed = cropSeedCost('radish', meta)

  it('numbers come from balance by tier: moisture 1 → 2, double harvest 0 → 10 %, seed keep 0 → 20 %, 🟧4 💰100', () => {
    expect([0, 1].map(waterMoisture)).toEqual([1, 2])
    expect([0, 1].map(doubleHarvestChance)).toEqual([0, 0.1])
    expect([0, 1].map(seedKeepChance)).toEqual([0, 0.2])
    expect(toolTierMax()).toBe(1)
    expect(toolTierCost(1, meta)).toEqual({ copperBar: 4, cash: 100 })
  })

  it('copper watering fills to 2, and the water tool tops up tiles between 1 and 2', () => {
    const s = withRun([growing(0), growing(1), growing(1.5), growing(2)], { toolTier: copper })
    expect(okState(water(s, 0)).run.tiles[0].moisture).toBe(2)
    expect(toolTargets(s, 'water')).toEqual([0, 1, 2])
    expect(toolTargets(withRun([growing(0), growing(1)]), 'water')).toEqual([0])
  })

  it('copper harvest: one draw; r < 10 % sells 2 crops (sales +2, cash ×2), still one harvest', () => {
    // walk the PRNG to the first double and the first single
    let s = withRun([ripe(0)], { toolTier: copper })
    const outcomes = new Set<number>()
    for (let k = 0; k < 60 && outcomes.size < 2; k++) {
      const [r, next] = nextRandom(s.run.rngState)
      const after = okState(harvest(s, 0)).run
      const crops = r < 0.1 ? 2 : 1
      outcomes.add(crops)
      expect(after.rngState).toBe(next)
      expect(after.cash - s.run.cash).toBe(crops * sell)
      expect(after.counters).toMatchObject({ harvests: s.run.counters.harvests + 1, sales: s.run.counters.sales + crops })
      expect(after.lifetime.harvests.radish).toBe((s.run.lifetime.harvests.radish ?? 0) + 1)
      expect(after.lifetime.cashEarned - s.run.lifetime.cashEarned).toBe(crops * sell)
      s = { ...s, run: { ...s.run, rngState: next } }
    }
    expect([...outcomes].sort()).toEqual([1, 2])
  })

  it('copper plant: one draw; r < 20 % keeps the seed (pouch unchanged, auto-buy charges nothing)', () => {
    for (const seeds of [{ radish: 3 }, {}]) {
      let s = withRun([tilled], { toolTier: copper, seeds, cash: 50 })
      const kept = new Set<boolean>()
      for (let k = 0; k < 60 && kept.size < 2; k++) {
        const [r, next] = nextRandom(s.run.rngState)
        const after = okState(plant(s, 0, 'radish')).run
        const keep = r < 0.2
        kept.add(keep)
        expect(after.rngState).toBe(next)
        expect(after.seeds.radish ?? 0).toBe(keep || !seeds.radish ? (seeds.radish ?? 0) : seeds.radish - 1)
        expect(s.run.cash - after.cash).toBe(keep || seeds.radish ? 0 : seed)
        s = { ...s, run: { ...s.run, rngState: next } }
      }
      expect(kept).toEqual(new Set([true, false]))
    }
  })

  it('a press counts its bonus: extra crops sold, seeds kept; 0 at tier 0', () => {
    const field = [ripe(0), ripe(1), ripe(2), tilled, tilled, tilled, tilled]
    let seen = { harvest: false, plant: false }
    for (let seed = 1; seed < 200 && !(seen.harvest && seen.plant); seed++) {
      const s = withRun(field, { toolTier: copper, tools: { water: 0, harvest: 3, plant: 3 }, rngState: seed, seeds: { radish: 10 } })
      const h = pressed(pressTool(s, 'harvest', 'radish'))
      expect(h.bonus).toBe(h.state.run.counters.sales - s.run.counters.sales - h.done)
      const p = pressed(pressTool(s, 'plant', 'radish'))
      expect(p.bonus).toBe(p.done - (s.run.seeds.radish! - p.state.run.seeds.radish!))
      seen = { harvest: seen.harvest || h.bonus > 0, plant: seen.plant || p.bonus > 0 }
    }
    expect(seen).toEqual({ harvest: true, plant: true })
    const basic = withRun(field, { tools: { water: 0, harvest: 3, plant: 3 } })
    expect([pressed(pressTool(basic, 'harvest', 'radish')).bonus, pressed(pressTool(basic, 'plant', 'radish')).bonus]).toEqual([0, 0])
  })

  it('no draw at tier 0, and none when the action fails at tier 1', () => {
    const s = withRun([ripe(0), tilled])
    expect(okState(harvest(s, 0)).run.rngState).toBe(s.run.rngState)
    expect(okState(plant(s, 1, 'radish')).run.rngState).toBe(s.run.rngState)
    const tired = withRun([ripe(0), tilled], { toolTier: copper, energy: 0 })
    expect(harvest(tired, 0)).toEqual({ ok: false, error: 'NO_ENERGY' })
    const broke = withRun([tilled], { toolTier: copper, cash: 0, seeds: {} })
    expect(plant(broke, 0, 'radish')).toEqual({ ok: false, error: 'NO_CASH' })
  })

  it('over 2000 copper harvests and plantings the rates land near 10 % and 20 %', () => {
    let s = withRun([ripe(0)], { toolTier: copper, seeds: { radish: 1e6 } })
    let doubles = 0
    let keeps = 0
    for (let k = 0; k < 2000; k++) {
      const h = okState(harvest({ ...s, run: { ...s.run, tiles: [ripe(0)], energy: 10 } }, 0))
      doubles += h.run.counters.sales - s.run.counters.sales - 1
      const p = okState(plant({ ...h, run: { ...h.run, energy: 10 } }, 0, 'radish'))
      keeps += p.run.seeds.radish === h.run.seeds.radish ? 1 : 0
      s = p
    }
    expect(doubles / 2000).toBeGreaterThan(0.08)
    expect(doubles / 2000).toBeLessThan(0.12)
    expect(keeps / 2000).toBeGreaterThan(0.17)
    expect(keeps / 2000).toBeLessThan(0.23)
  })

  it('buyCopperTool: ALREADY_OWNED, LOCKED (needs tool Lv1), NOT_ENOUGH_ITEMS, NO_CASH; pays 🟧4 💰100, no energy', () => {
    const rich = { cash: 100, inventory: { copperBar: 4 } }
    expect(buyCopperTool(withRun([], { ...rich, tools: tools('water', 1), toolTier: copper }), 'water')).toEqual({ ok: false, error: 'ALREADY_OWNED' })
    expect(buyCopperTool(withRun([], rich), 'water')).toEqual({ ok: false, error: 'LOCKED' })
    expect(buyCopperTool(withRun([], { cash: 100, inventory: { copperBar: 3 }, tools: tools('water', 1) }), 'water')).toEqual({ ok: false, error: 'NOT_ENOUGH_ITEMS' })
    expect(buyCopperTool(withRun([], { cash: 99, inventory: { copperBar: 4 }, tools: tools('water', 1) }), 'water')).toEqual({ ok: false, error: 'NO_CASH' })
    const s = withRun([], { ...rich, tools: tools('harvest', 3) })
    const after = okState(buyCopperTool(s, 'harvest')).run
    expect(after.toolTier).toEqual({ water: 0, harvest: 1, plant: 0 })
    expect([after.cash, after.inventory.copperBar, after.energy]).toEqual([0, 0, s.run.energy])
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
