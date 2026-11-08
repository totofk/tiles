import { describe, expect, it } from 'vitest'
import {
  fieldTileCost,
  fieldsCost,
  fieldsCropHarvests,
  harvestBatch,
  plantBatch,
  pipeCoalPer10Tiles,
  pipeCoalPerTick,
  pipeCost,
  pipeCover,
  pipeMaxTiers,
} from '../src/core/balance'
import {
  buyField,
  buyPipes,
  fieldsAct,
  fieldsFree,
  fieldsGates,
  fieldsHarvest,
  fieldsMarginalIncomePerHour,
  fieldsPaybackHours,
  fieldsPlantable,
  fieldsStanding,
  fieldsStats,
  plantFields,
  stopFieldsPlant,
  unlockFields,
} from '../src/core/fields'
import { createInitialState, type Cohort, type GameState } from '../src/core/state'
import { step } from '../src/core/step'
import { catchUp } from '../src/save/serialize'

const init = createInitialState()

/** a fields-ready run: unlocked, `count` fields, both certificates and one sprinkler; `f` overrides the fields */
function withFields(count = 0, extra: Partial<GameState['run']> = {}, f: Partial<GameState['run']['fields']> = {}): GameState {
  return {
    ...init,
    run: {
      ...init.run,
      fields: { ...init.run.fields, unlocked: true, count, ...f },
      workers: { ...init.run.workers, certificates: [...init.run.workers.certificates, 'plant', 'harvest'] },
      workshop: { built: true, hoppers: [24], valve: false },
      ...extra,
    },
  }
}

describe('fields: balance', () => {
  it('field tile base price, the unlock price, the 50-harvest gate, batches, pipe tiers and the coal draw', () => {
    expect(fieldTileCost(0, init.meta)).toBe(100)
    expect(fieldTileCost(9, init.meta)).toBe(1000)
    expect(fieldsCost(init.meta)).toEqual({ ironBar: 10, cash: fieldsCost(init.meta).cash })
    expect(fieldsCropHarvests()).toBe(50)
    expect(plantBatch()).toBe(10)
    expect(harvestBatch()).toBe(10)
    expect(pipeMaxTiers()).toBe(3)
    expect([pipeCover(0), pipeCover(1), pipeCover(2), pipeCover(3)]).toEqual([0, 60, 150, 300])
    expect(pipeCost(0, init.meta)).toEqual({ copperBar: 8, cash: pipeCost(0, init.meta)!.cash })
    expect(pipeCost(1, init.meta)).toEqual({ ironBar: 8, cash: pipeCost(1, init.meta)!.cash })
    expect(pipeCost(2, init.meta)).toEqual({ goldBar: 8, cash: pipeCost(2, init.meta)!.cash })
    expect(pipeCost(3, init.meta)).toBeNull()
    expect(pipeCoalPer10Tiles()).toBe(0.5)
    // 60 covered tiles = 3 coal/h = 1 coal per 1200 ticks
    expect(pipeCoalPerTick(60)).toBeCloseTo(3 / 3600, 10)
  })
})

describe('unlockFields', () => {
  it('is LOCKED until planter + harvester certificates are owned and a sprinkler covers watering, then pays', () => {
    const certs = (jobs: GameState['run']['workers']['certificates']) => ({ ...init.run.workers, certificates: jobs })
    expect(fieldsGates(init.run)).toEqual({ plant: false, harvest: false, water: false })
    expect(unlockFields(init)).toEqual({ ok: false, error: 'LOCKED' })
    const withMachines = { ...init, run: { ...init.run, workshop: { built: true, hoppers: [24], valve: false } } }
    expect(fieldsGates(withMachines.run)).toEqual({ plant: false, harvest: false, water: true })
    const both = { ...withMachines, run: { ...withMachines.run, workers: certs(['plant', 'harvest']) } }
    expect(fieldsGates(both.run)).toEqual({ plant: true, harvest: true, water: true })
    // pays 10 iron bars + cash; the milestone records; ALREADY_OWNED once unlocked; items before cash
    const paid = { ...both, run: { ...both.run, inventory: { ironBar: 10 }, cash: 99999 } }
    const r = unlockFields(paid)
    if (!r?.ok) throw new Error(r?.error ?? 'nothing ready')
    expect([r.state.run.fields.unlocked, r.state.run.inventory.ironBar]).toEqual([true, 0])
    expect(r.state.run.milestones.fieldsUnlocked).toBeDefined()
    expect(unlockFields(r.state)).toEqual({ ok: false, error: 'ALREADY_OWNED' })
    expect(unlockFields({ ...paid, run: { ...paid.run, inventory: {} } })).toEqual({ ok: false, error: 'NOT_ENOUGH_ITEMS' })
    expect(unlockFields({ ...paid, run: { ...paid.run, cash: 0 } })).toEqual({ ok: false, error: 'NO_CASH' })
  })
})

describe('buyField', () => {
  it('is LOCKED before the unlock, then prices FIELDS_TILE_BASE × (count + 1); planted stays, milestones record', () => {
    expect(buyField({ ...init, run: { ...init.run, cash: 99999 } })).toEqual({ ok: false, error: 'LOCKED' })
    const first = buyField(withFields(0, { cash: 99999 }))
    if (!first.ok) throw new Error(first.error)
    expect([first.state.run.fields.count, first.state.run.cash, first.state.run.milestones.firstField]).toEqual([1, 99999 - 100, first.state.run.tick])
    const third = buyField(withFields(2, { cash: 99999 }))
    expect(third.ok && third.state.run.cash).toBe(99999 - 300)
    expect(buyField(withFields(2, { cash: 299 }))).toEqual({ ok: false, error: 'NO_CASH' })
  })
})

describe('plantFields', () => {
  const lemonReady = { licenses: [...init.run.licenses, 'lemon' as const], lifetime: { ...init.run.lifetime, harvests: { lemon: 50 } } }

  it('is LOCKED (fields), NO_LICENSE, LOCKED (the 50-home-harvest gate), NOTHING_TO_DO when every tile stands', () => {
    expect(plantFields({ ...init, run: { ...init.run, cash: 99999 } }, 'lemon')).toEqual({ ok: false, error: 'LOCKED' })
    const licensed = withFields(10, { cash: 99999, licenses: lemonReady.licenses })
    expect(fieldsPlantable(licensed.run, 'lemon')).toBe(false)
    expect(plantFields(licensed, 'lemon')).toEqual({ ok: false, error: 'LOCKED' })
    expect(plantFields(withFields(10, { cash: 99999, ...lemonReady }), 'chilli')).toEqual({ ok: false, error: 'NO_LICENSE' })
    expect(plantFields(withFields(0, { cash: 99999, ...lemonReady }), 'lemon')).toEqual({ ok: false, error: 'NOTHING_TO_DO' })
  })

  it('plants one cohort of 10 at tick + growTicks (fertilizer applies), auto-buys seeds, sets plantCrop', () => {
    // fertilizer 3: lemon 360 → 252 ticks
    const ready = withFields(12, { cash: 1000, tick: 100, ...lemonReady, upgrades: { ...init.run.upgrades, fertilizer: 3 } })
    const r = plantFields(ready, 'lemon')
    expect(r.ok && r.state.run.fields.cohorts).toEqual([{ crop: 'lemon', count: 10, readyTick: 100 + 252 }])
    expect(r.ok && r.state.run.fields.plantCrop).toBe('lemon')
    expect(r.ok && [r.state.run.fields.planted.lemon, fieldsFree(r.state.run)]).toEqual([10, 2])
    expect(r.ok && r.state.run.cash).toBe(1000 - 10 * 20) // 10 seeds at 💰20, auto-bought
    // capped by the free tiles
    const five = plantFields(withFields(5, { cash: 1000, ...lemonReady }), 'lemon')
    if (!five.ok) throw new Error(five.error)
    expect(five.state.run.fields.cohorts[0].count).toBe(5)
    expect(plantFields(five.state, 'lemon')).toEqual({ ok: false, error: 'NOTHING_TO_DO' })
  })

  it('uses pouch seeds first, rolls the dibber seed-keep per tile, and stops early on no cash (partial cohort)', () => {
    const stocked = withFields(12, { cash: 20, seeds: { lemon: 8 }, ...lemonReady })
    const r = plantFields(stocked, 'lemon')
    if (!r?.ok) throw new Error(r?.error ?? 'nothing ready')
    expect(r.state.run.fields.cohorts[0].count).toBe(9) // 8 from the pouch + 1 bought, then 💰0 < 20
    expect([r.state.run.cash, r.state.run.seeds.lemon]).toEqual([0, 0])
    // gold dibber: the seed-keep rolls per tile, so the rng advances and some seeds stay unpaid
    const gold = withFields(12, { cash: 99999, toolTier: { water: 0, harvest: 0, plant: 3 }, ...lemonReady })
    const g = plantFields(gold, 'lemon')
    expect(g.ok && g.state.run.rngState).not.toBe(gold.run.rngState)
    expect(g.ok && g.state.run.cash).toBeGreaterThan(99999 - 10 * 20)
    // auto-buy off with an empty pouch plants nothing
    const dry = plantFields(withFields(12, { cash: 99999, autoBuySeeds: false, ...lemonReady }), 'lemon')
    expect(dry).toEqual({ ok: false, error: 'NO_SEEDS' })
  })

  it('"stop" clears the plant crop; NOTHING_TO_DO when none is set', () => {
    const s = plantFields(withFields(12, { cash: 1000, ...lemonReady }), 'lemon')
    if (!s.ok) throw new Error(s.error)
    const stopped = stopFieldsPlant(s.state)
    if (!stopped.ok) throw new Error(stopped.error)
    expect(stopped.state.run.fields.plantCrop).toBeNull()
    expect(stopFieldsPlant(stopped.state)).toEqual({ ok: false, error: 'NOTHING_TO_DO' })
    expect(stopFieldsPlant(init)).toEqual({ ok: false, error: 'LOCKED' })
  })
})

describe('fieldsHarvest (the harvester worker)', () => {
  it('reaps up to HARVEST_BATCH of the oldest ready cohort, sells on the market, home counters untouched', () => {
    const ready = withFields(12, { cash: 0, tick: 1000 }, { cohorts: [{ crop: 'lemon', count: 15, readyTick: 800 }, { crop: 'lemon', count: 10, readyTick: 900 }] })
    const r = fieldsHarvest(ready)
    if (!r?.ok) throw new Error(r?.error ?? 'nothing ready')
    // 10 of the oldest cohort; the market prices each unit at its own glut (4 × 110 then 109s)
    expect(r.state.run.fields.cohorts).toEqual([{ crop: 'lemon', count: 5, readyTick: 800 }, { crop: 'lemon', count: 10, readyTick: 900 }])
    expect(r.state.run.cash).toBe(4 * 110 + 6 * 109)
    expect(r.state.run.lifetime.cashEarned).toBe(4 * 110 + 6 * 109)
    expect([r.state.run.counters.harvests, r.state.run.counters.sales, r.state.run.lifetime.harvests.lemon ?? 0]).toEqual([0, 0, 0])
    expect(fieldsHarvest(withFields(12, { tick: 1000 }, { cohorts: [{ crop: 'lemon', count: 4, readyTick: 1200 }] }))).toBeNull()
  })

  it('fills an accepted order first at the order price, exactly like a home-plot harvest', () => {
    const s = withFields(12, {
      cash: 0,
      tick: 1000,
      orders: { unlocked: true, slots: 1, offers: [{ good: 'lemon', count: 3, done: 0, tier: 0, accepted: true }] },
    }, { cohorts: [{ crop: 'lemon', count: 3, readyTick: 900 }] })
    const r = fieldsHarvest(s)
    if (!r?.ok) throw new Error(r?.error ?? 'nothing ready')
    // all 3 units at the order price (110 × 1.1) — no market glut on ordered units
    expect(r.state.run.cash).toBe(3 * 121)
    expect(r.state.run.lifetime.ordersCompleted).toBe(1)
  })

  it('a gold sickle rolls the double harvest per tile', () => {
    const s = withFields(12, { cash: 0, tick: 1000, toolTier: { water: 0, harvest: 3, plant: 0 } }, { cohorts: [{ crop: 'lemon', count: 10, readyTick: 900 }] })
    const r = fieldsHarvest(s)
    if (!r?.ok) throw new Error(r?.error ?? 'nothing ready')
    expect(r.state.run.rngState).not.toBe(s.run.rngState)
    // at gold (3 in 10) 10 tiles sell 10–20 units; the cohort empties either way
    expect(fieldsStanding(r.state.run.fields)).toBe(0)
    expect(r.state.run.cash).toBeGreaterThanOrEqual(10 * 110)
  })
})

describe('fieldsAct: coverage, stalls and the shared coal pump', () => {
  const growing: Cohort[] = [
    { crop: 'lemon', count: 60, readyTick: 5000 },
    { crop: 'lemon', count: 60, readyTick: 5100 },
  ]

  it('covered cohorts grow one tick per step; a stalled cohort recedes with the calendar, never dies or ripens free', () => {
    const s = withFields(120, { inventory: { coal: 99 } }, { pipes: 1, cohorts: growing })
    const after = fieldsAct(s)
    expect(after.run.fields.cohorts[0].readyTick).toBe(4999)
    expect(after.run.fields.cohorts[1].readyTick).toBe(5101) // 60 covered grows; the rest stalls, its date recedes +1
  })

  it('the coverage is a strict prefix: a huge cohort first blocks every later growing cohort too', () => {
    const s = withFields(200, { inventory: { coal: 99 } }, { pipes: 1, cohorts: [{ crop: 'lemon', count: 100, readyTick: 5000 }, { crop: 'lemon', count: 30, readyTick: 5000 }] })
    const after = fieldsAct(s)
    expect(after.run.fields.cohorts.map((c) => c.readyTick)).toEqual([5001, 5001]) // nothing grows, nothing accrues, both recede
    expect(after.run.fields.coalCarry).toBe(0)
  })

  it('with no pipes everything stalls and nothing accrues; ready cohorts take no coverage', () => {
    const noPipes = step(withFields(60, { inventory: { coal: 10 } }, { cohorts: [{ crop: 'lemon', count: 10, readyTick: 400 }] }), 5)
    expect([noPipes.run.fields.cohorts[0].readyTick, noPipes.run.fields.coalCarry]).toEqual([405, 0]) // stalled: the date recedes
    const ready = withFields(60, { tick: 10, inventory: { coal: 10 } }, { pipes: 3, cohorts: [{ crop: 'lemon', count: 5, readyTick: 10 }] })
    expect(step(ready, 3).run.fields).toBe(ready.run.fields)
  })

  it('the pump accrues per covered growing tile and burns 1 whole coal per coal due; a dry pump stalls everything until coal returns', () => {
    // 120 covered tiles at pipes 2 = 6 coal/h = 1 coal per 600 ticks
    const s = withFields(120, {}, { pipes: 2, cohorts: growing })
    const dry = step(s, 1200) // no coal in storage: growth runs the first grace window (600 ticks), then stalls
    expect(dry.run.fields.cohorts[0].readyTick).toBe(5000 - 599 + 601) // 599 grew, then 601 dry ticks each recede +1
    expect(dry.run.fields.coalCarry).toBeGreaterThanOrEqual(1)
    expect(dry.run.inventory.coal ?? 0).toBe(0)
    const withCoal = step({ ...s, run: { ...s.run, inventory: { coal: 5 } } }, 600)
    expect(withCoal.run.inventory.coal).toBe(4)
    expect(withCoal.run.fields.coalCarry).toBeLessThan(1)
    expect(withCoal.run.fields.cohorts[0].readyTick).toBe(5000 - 600)
    // coal back after a dry stall pays the due coal and growth resumes the same tick
    const rescue = step(dry, 1)
    expect(rescue.run.fields.cohorts[0].readyTick).toBe(dry.run.fields.cohorts[0].readyTick + 1) // still dry: recede
    const refuelled = step({ ...dry, run: { ...dry.run, inventory: { coal: 2 } } }, 1)
    expect(refuelled.run.inventory.coal).toBe(1)
    expect(refuelled.run.fields.cohorts[0].readyTick).toBe(dry.run.fields.cohorts[0].readyTick - 1)
  })

  it('the fields is inert while locked, with or without cohorts', () => {
    const locked = { ...init, run: { ...init.run, fields: { ...init.run.fields, cohorts: [{ crop: 'lemon' as const, count: 5, readyTick: 10 }] } } }
    expect(step(locked, 3).run.fields.cohorts[0].readyTick).toBe(10)
  })
})

describe('workers on the fields', () => {
  /** every home tile planted and still growing, so the planter and harvester fall through to the Fields */
  function fieldsRun(extra: Partial<GameState['run']> = {}, assigned = { plant: 1, harvest: 0 }, f: Partial<GameState['run']['fields']> = {}): GameState {
    const tiles = init.run.tiles.map((t) => ({ ...t, status: 'planted' as const, cropId: 'lemon' as const, growth: 10, moisture: 4 }))
    return withFields(12, {
      tiles,
      tick: 5,
      cash: 1000,
      licenses: [...init.run.licenses, 'lemon'],
      lifetime: { ...init.run.lifetime, harvests: { lemon: 50 } },
      workers: { pool: 2, assigned: { plant: assigned.plant, water: 0, harvest: assigned.harvest, ore: 0, fuel: 0, mine: 0, clerk: 0 }, certificates: ['plant', 'harvest'] },
      ...extra,
    }, { pipes: 1, plantCrop: 'lemon', ...f })
  }

  it('a planter whose home plot is fully planted plants a Fields batch (same wage, no home counters)', () => {
    const after = step(fieldsRun(), 1)
    // planted at tick 5, ready at 5 + 360 — and fieldsAct grows it the same tick it is planted
    expect(after.run.fields.cohorts).toEqual([{ crop: 'lemon', count: 10, readyTick: 5 + 360 - 1 }])
    expect(after.run.cash).toBe(1000 - 10 * 20 - 1) // seeds + the wage
    expect(after.run.lifetime.wagesPaid).toBe(1)
    expect(after.run.counters.plants).toBe(0)
  })

  it('a harvester with nothing ready at home reaps ready Fields cohorts', () => {
    const after = step(fieldsRun({}, { plant: 0, harvest: 1 }, { cohorts: [{ crop: 'lemon', count: 7, readyTick: 4 }] }), 1)
    expect(fieldsStanding(after.run.fields)).toBe(0)
    expect(after.run.cash).toBe(1000 + 4 * 110 + 3 * 109 - 1) // per-unit glut, then the wage
  })

  it('a planter with no crop picked ("stop") or no free tiles idles unpaid', () => {
    const stopped = step(fieldsRun({}, { plant: 1, harvest: 0 }, { plantCrop: null }), 1)
    expect(stopped.run.fields.cohorts.length).toBe(0)
    expect(stopped.run.lifetime.wagesPaid).toBe(0)
    const filled = step(fieldsRun({}, { plant: 1, harvest: 0 }, { cohorts: [{ crop: 'lemon', count: 12, readyTick: 9e9 }] }), 1)
    expect(filled.run.fields.cohorts[0].count).toBe(12) // nothing more to plant, nothing ready: idle
    expect(filled.run.lifetime.wagesPaid).toBe(0)
  })
})

describe('fields milestones and marginal income', () => {
  it('fields100 records as fields are bought; fields500 waits', () => {
    const r = buyField(withFields(99, { cash: 999999 }))
    expect(r.ok && r.state.run.milestones.fields100).toBeDefined()
    expect(r.ok && r.state.run.milestones.fields500).toBeUndefined()
  })

  it('marginal income is the best plantable crop at the glut one more tile settles at; the payback rounds its hours', () => {
    const s = withFields(10, {
      licenses: [...init.run.licenses, 'lemon', 'pumpkin'],
      lifetime: { ...init.run.lifetime, harvests: { lemon: 50, pumpkin: 50 } },
      market: { radish: 0, chilli: 0, pumpkin: 0, lemon: 31.5 },
    })
    const income = fieldsMarginalIncomePerHour(s)
    expect(income).toBeGreaterThan(0)
    expect(fieldsPaybackHours(s)).toBe(Math.round(fieldTileCost(10, init.meta) / income))
    expect(fieldsPaybackHours(withFields(0))).toBe(0) // nothing plantable yet
  })
})

describe('step identity over cohorts', () => {
  it('step(s, 600) = 600 × step(s, 1) with 3 cohorts, 2 workers, the market on, an accepted order; catch-up equal', () => {
    const tiles = init.run.tiles.map((t) => ({ ...t, status: 'planted' as const, cropId: 'lemon' as const, growth: 10, moisture: 4 }))
    const s: GameState = {
      ...init,
      run: {
        ...init.run,
        tiles,
        tick: 4,
        cash: 5000,
        licenses: [...init.run.licenses, 'lemon', 'pumpkin'],
        lifetime: { ...init.run.lifetime, harvests: { lemon: 50, pumpkin: 50 } },
        inventory: { coal: 10 },
        workers: { pool: 2, assigned: { plant: 1, water: 0, harvest: 1, ore: 0, fuel: 0, mine: 0, clerk: 0 }, certificates: ['plant', 'harvest'] },
        workshop: { built: true, hoppers: [24], valve: false },
        orders: { unlocked: true, slots: 1, offers: [{ good: 'lemon', count: 20, done: 0, tier: 0, accepted: true }] },
        fields: {
          ...init.run.fields,
          unlocked: true,
          count: 60,
          pipes: 1,
          plantCrop: 'lemon',
          cohorts: [
            { crop: 'lemon', count: 8, readyTick: 300 },
            { crop: 'lemon', count: 30, readyTick: 3600 },
            { crop: 'pumpkin', count: 20, readyTick: 5000 },
          ],
        },
      },
    }
    let one = s
    for (let i = 0; i < 600; i++) one = step(one, 1)
    expect(step(s, 600)).toEqual(one)
    expect(catchUp(s, 600_000)).toEqual(step(s, 600))
  })
})

describe('buyPipes', () => {
  const full = { copperBar: 99, ironBar: 99, goldBar: 99 }

  it('is LOCKED before fields, NO_WORKSHOP without one, MAX_LEVEL at tier 3, and pays each tier', () => {
    expect(buyPipes(init)).toEqual({ ok: false, error: 'LOCKED' })
    const noShop = { ...init, run: { ...init.run, fields: { ...init.run.fields, unlocked: true } } }
    expect(buyPipes(noShop)).toEqual({ ok: false, error: 'NO_WORKSHOP' })
    const r = buyPipes(withFields(60, { inventory: full, cash: 99999 }))
    expect(r.ok && r.state.run.fields.pipes).toBe(1)
    const two = buyPipes(withFields(60, { inventory: full, cash: 999999 }, { pipes: 1 }))
    expect(two.ok && two.state.run.inventory.ironBar).toBe(91)
    const top = buyPipes(withFields(60, { inventory: full, cash: 99999 }, { pipes: 3 }))
    expect(top).toEqual({ ok: false, error: 'MAX_LEVEL' })
    expect(buyPipes(withFields(60, { inventory: {}, cash: 99999 }, { pipes: 1 }))).toEqual({ ok: false, error: 'NOT_ENOUGH_ITEMS' })
  })

  it('coverage is what buyPipes buys: growth starts only past tier 1 (PIPE_COVER[0] = 0)', () => {
    const cohort = { crop: 'lemon' as const, count: 30, readyTick: 400 }
    const stalled = step(withFields(60, { inventory: { coal: 10 } }, { cohorts: [cohort] }), 10)
    expect(stalled.run.fields.cohorts[0].readyTick).toBe(410) // stalled at tier 0: the date recedes, still 400 away
    const piped = step(withFields(60, { inventory: { coal: 10 } }, { pipes: 1, cohorts: [cohort] }), 10)
    expect(piped.run.fields.cohorts[0].readyTick).toBe(390)
  })
})

describe('fields: fresh run', () => {
  it('starts locked with every crop at 0 planted', () => {
    expect(init.run.fields).toEqual({
      unlocked: false,
      count: 0,
      planted: { radish: 0, chilli: 0, pumpkin: 0, lemon: 0 },
      cohorts: [],
      pipes: 0,
      plantCrop: null,
      coalCarry: 0,
    })
    expect([fieldsFree(init.run), fieldsStanding(init.run.fields)]).toEqual([0, 0])
    expect(fieldsStats(init.run)).toEqual({ free: 0, growing: 0, covered: 0, stalled: 0, ready: 0 })
  })

  it('fieldsStats splits by the same prefix rule the growth uses: ready skips the queue, one misfit stalls the rest', () => {
    const s = withFields(120, { tick: 1000 }, {
      pipes: 1,
      cohorts: [
        { crop: 'lemon', count: 5, readyTick: 900 },
        { crop: 'lemon', count: 40, readyTick: 1100 },
        { crop: 'lemon', count: 20, readyTick: 1200 },
        { crop: 'lemon', count: 30, readyTick: 1300 },
      ],
    })
    // ready 5; the 40 then the 20 fill the 60 coverage exactly, the 30 beyond them stalls with the rest of the queue
    expect(fieldsStats(s.run)).toEqual({ free: 120 - 95, growing: 90, covered: 60, stalled: 30, ready: 5 })
  })
})
