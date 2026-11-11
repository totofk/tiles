import { describe, expect, it } from 'vitest'
import {
  FIELD_PRESSURE,
  TANK_UNITS_PER_COAL,
  cropGrowTicks,
  fieldCoalPerPlotHour,
  fieldPlots,
  fieldTileCost,
  fieldsCost,
  fieldsCropHarvests,
  machineCost,
  machineMaintPerHour,
  machineMaxTiers,
  machineTilesPerHour,
  pivotCost,
  plotCost,
  plotTiles,
  pumpCost,
  pumpFieldCap,
  pumpMaxTiers,
  reapPlotEnergy,
  tankCapCoal,
} from '../src/core/balance'
import {
  buildPivot,
  buyMachine,
  buyPlot,
  buyPump,
  fieldsGates,
  fieldsHarvest,
  fieldsMarginalIncomePerHour,
  fieldsOverview,
  fieldsPaybackHours,
  fieldsPlantAction,
  fillTank,
  machinesAct,
  pivotsOwned,
  plantedTiles,
  plotState,
  reapNext,
  reapPlot,
  setFieldCrop,
  sowNext,
  sowPlot,
  unlockFields,
} from '../src/core/fields'
import { CROP_IDS, type CropId } from '../src/core/data/crops'
import { createInitialState, createMachines, type Field, type GameState, type Machines, type Plot } from '../src/core/state'
import { step } from '../src/core/step'
import { catchUp } from '../src/save/serialize'

const init = createInitialState()
const LEMON = cropGrowTicks('lemon', init.meta, 0) // 360
const empty = (): Plot => ({ crop: null, readyTick: 0 })
const lemon = (readyTick: number): Plot => ({ crop: 'lemon', readyTick })
const field = (plots: Plot[], crop: CropId | null = 'lemon', pivot = true): Field => ({ pivot, crop, pinned: false, plots })
const fleet = (m: Partial<Machines>): Machines => ({ ...createMachines(), ...m })
const ok = (r: ReturnType<typeof buyPlot>): GameState => {
  if (!r.ok) throw new Error(r.error)
  return r.state
}
const sown = (s: GameState) => s.run.fields.list.flatMap((f) => f.plots).filter((p) => p.crop !== null).length

/** a fields-ready run: unlocked with `list`, both certificates, one sprinkler, lemon fields-plantable, a full Pump-0
 *  tank (so batch 28's pressure never slows these plots); `f` overrides the fields */
function withFields(list: Field[] = [field([empty()])], extra: Partial<GameState['run']> = {}, f: Partial<GameState['run']['fields']> = {}): GameState {
  return {
    ...init,
    run: {
      ...init.run,
      cash: 1000,
      licenses: [...init.run.licenses, 'lemon', 'pumpkin'],
      lifetime: { ...init.run.lifetime, harvests: { lemon: 50, pumpkin: 50 } },
      fields: { ...init.run.fields, unlocked: true, list, tank: tankCapCoal(0) * TANK_UNITS_PER_COAL, ...f },
      workers: { ...init.run.workers, certificates: [...init.run.workers.certificates, 'plant', 'harvest'] },
      workshop: { built: true, beds: [true, false, false, false], valve: false },
      ...extra,
    },
  }
}

describe('fields: balance (batch 28 — plots, pivots, pumps)', () => {
  it('plot = 10 tiles priced as their sum, field = 5 plots, pressure ×2, the pump caps and tank sizes, pivot and pump recipes', () => {
    expect(fieldTileCost(0, init.meta)).toBe(100)
    expect(fieldsCost(init.meta)).toEqual({ ironBar: 10, cash: fieldsCost(init.meta).cash })
    expect(fieldsCropHarvests()).toBe(50)
    expect([plotTiles(), fieldPlots(), FIELD_PRESSURE, TANK_UNITS_PER_COAL, reapPlotEnergy(), fieldCoalPerPlotHour()]).toEqual([10, 5, 2, 7200, 10, 0.5])
    // the ten-tile sum: 💰10,000·p + 5,500 at base
    for (const p of [0, 1, 7, 39]) {
      expect(plotCost(p, init.meta)).toBe(Array.from({ length: 10 }, (_, i) => fieldTileCost(10 * p + i, init.meta)).reduce((a, b) => a + b, 0))
      expect(plotCost(p, init.meta)).toBe(10_000 * p + 5_500)
    }
    expect([0, 1, 2, 3].map(pumpFieldCap)).toEqual([2, 6, 12, 20])
    expect([0, 1, 2, 3].map(tankCapCoal)).toEqual([40, 120, 240, 400])
    expect(pumpMaxTiers()).toBe(3)
    expect([0, 1, 2, 3].map((p) => pumpCost(p, init.meta))).toEqual([
      { copperBar: 8, cash: 500_000 },
      { ironBar: 8, cash: 1_500_000 },
      { goldBar: 8, cash: 3_000_000 },
      null,
    ])
    expect(pivotCost(1, init.meta)).toEqual({ goldBar: 3, ironBar: 6, copperBar: 6, cash: 0 })
    expect(pivotCost(2, init.meta)).toEqual({ goldBar: 3, ironBar: 6, copperBar: 6, cash: 50_000 })
    expect(pivotCost(20, init.meta).cash).toBe(950_000)
  })
})

describe('unlockFields: the Tractor gift', () => {
  it('is LOCKED until the gates hold, then pays and gives Field 1 with its pivot and plot 1; ALREADY_OWNED, items before cash', () => {
    const certs = (jobs: GameState['run']['workers']['certificates']) => ({ ...init.run.workers, certificates: jobs })
    expect(fieldsGates(init.run)).toEqual({ plant: false, harvest: false, water: false })
    expect(unlockFields(init)).toEqual({ ok: false, error: 'LOCKED' })
    const both = { ...init, run: { ...init.run, workshop: { built: true, beds: [true, false, false, false], valve: false }, workers: certs(['plant', 'harvest']) } }
    expect(fieldsGates(both.run)).toEqual({ plant: true, harvest: true, water: true })
    const paid = { ...both, run: { ...both.run, inventory: { ironBar: 10 }, cash: 99999 } }
    const r = ok(unlockFields(paid))
    expect(r.run.fields).toMatchObject({ unlocked: true, pump: 0, tank: 0, list: [{ pivot: true, crop: null, pinned: false, plots: [empty()] }] })
    expect(r.run.inventory.ironBar).toBe(0)
    expect([r.run.milestones.fieldsUnlocked, r.run.milestones.firstField]).toEqual([r.run.tick, r.run.tick])
    expect(unlockFields(r)).toEqual({ ok: false, error: 'ALREADY_OWNED' })
    expect(unlockFields({ ...paid, run: { ...paid.run, inventory: {} } })).toEqual({ ok: false, error: 'NOT_ENOUGH_ITEMS' })
    expect(unlockFields({ ...paid, run: { ...paid.run, cash: 0 } })).toEqual({ ok: false, error: 'NO_CASH' })
  })
})

describe('buyPlot', () => {
  it('order LOCKED, PUMP_FULL, NO_CASH; the price is plotCost(plots owned); fills the first field with room', () => {
    expect(buyPlot({ ...init, run: { ...init.run, cash: 1e9 } })).toEqual({ ok: false, error: 'LOCKED' })
    const s = withFields([field([empty(), empty()]), field([empty()], null, false)], { cash: 1e9 })
    const r = ok(buyPlot(s))
    expect(r.run.cash).toBe(1e9 - plotCost(3, init.meta))
    expect(r.run.fields.list.map((f) => f.plots.length)).toEqual([3, 1])
    expect(buyPlot({ ...s, run: { ...s.run, cash: plotCost(3, init.meta) - 1 } })).toEqual({ ok: false, error: 'NO_CASH' })
    // PUMP_FULL comes before NO_CASH
    const capped = withFields([field(Array.from({ length: 5 }, empty)), field(Array.from({ length: 5 }, empty))], { cash: 0 })
    expect(buyPlot(capped)).toEqual({ ok: false, error: 'PUMP_FULL' })
  })

  it('opens a new dry field with no chip when every field is full, only below the pump cap', () => {
    const full = withFields([field(Array.from({ length: 5 }, empty))], { cash: 1e9 })
    const r = ok(buyPlot(full))
    expect(r.run.fields.list[1]).toEqual({ pivot: false, crop: null, pinned: false, plots: [empty()] })
    // two fields full at Pump 0 (cap 2): PUMP_FULL; Pump 1 (cap 6) opens a third
    const two = ok(buyPlot(ok(buyPlot(ok(buyPlot(ok(buyPlot(r))))))))
    expect(two.run.fields.list.map((f) => f.plots.length)).toEqual([5, 5])
    expect(buyPlot(two)).toEqual({ ok: false, error: 'PUMP_FULL' })
    expect(ok(buyPlot({ ...two, run: { ...two.run, fields: { ...two.run.fields, pump: 1 } } })).run.fields.list).toHaveLength(3)
  })

  it('milestones keep their ids: fields100 at 100 owned tiles (10 plots), fields500 waits', () => {
    const nine = withFields([field(Array.from({ length: 5 }, empty)), field(Array.from({ length: 4 }, empty))], { cash: 1e9 })
    const r = ok(buyPlot(nine))
    expect(r.run.milestones.fields100).toBe(r.run.tick)
    expect(r.run.milestones.fields500).toBeUndefined()
  })
})

describe('buildPivot', () => {
  const bars = { goldBar: 99, ironBar: 99, copperBar: 99 }
  it('order LOCKED, BAD_TILE, ALREADY_OWNED, PUMP_FULL, NOT_ENOUGH_ITEMS, NO_CASH; pivot n costs its recipe + 50,000 × (n − 1)', () => {
    expect(buildPivot(init, 0)).toEqual({ ok: false, error: 'LOCKED' })
    const s = withFields([field([empty()]), field([empty()], null, false)], { cash: 1e6, inventory: bars })
    expect(buildPivot(s, 2)).toEqual({ ok: false, error: 'BAD_TILE' })
    expect(buildPivot(s, -1)).toEqual({ ok: false, error: 'BAD_TILE' })
    expect(buildPivot(s, 0)).toEqual({ ok: false, error: 'ALREADY_OWNED' })
    const r = ok(buildPivot(s, 1))
    expect(r.run.fields.list[1].pivot).toBe(true)
    expect(r.run.cash).toBe(1e6 - 50_000)
    expect(r.run.inventory).toEqual({ goldBar: 96, ironBar: 93, copperBar: 93 })
    expect(pivotsOwned(r.run.fields)).toBe(2)
    // a third field at Pump 0 (cap 2 pivots): PUMP_FULL before the items and the cash
    const third = withFields([field([empty()]), field([empty()]), field([empty()], null, false)], { cash: 0, inventory: {} }, { pump: 1 })
    expect(buildPivot({ ...third, run: { ...third.run, fields: { ...third.run.fields, pump: 0 } } }, 2)).toEqual({ ok: false, error: 'PUMP_FULL' })
    expect(buildPivot(third, 2)).toEqual({ ok: false, error: 'NOT_ENOUGH_ITEMS' })
    expect(buildPivot({ ...third, run: { ...third.run, inventory: bars } }, 2)).toEqual({ ok: false, error: 'NO_CASH' })
  })
})

describe('buyPump', () => {
  it('order LOCKED, NO_WORKSHOP, MAX_LEVEL, NOT_ENOUGH_ITEMS, NO_CASH; each tier pays its recipe', () => {
    expect(buyPump({ ...init, run: { ...init.run, cash: 1e9 } })).toEqual({ ok: false, error: 'LOCKED' })
    const s = withFields(undefined, { cash: 1e7, inventory: { copperBar: 8, ironBar: 8, goldBar: 8 } })
    expect(buyPump({ ...s, run: { ...s.run, workshop: { ...s.run.workshop, built: false } } })).toEqual({ ok: false, error: 'NO_WORKSHOP' })
    expect(buyPump({ ...s, run: { ...s.run, inventory: {} } })).toEqual({ ok: false, error: 'NOT_ENOUGH_ITEMS' })
    expect(buyPump({ ...s, run: { ...s.run, cash: 0 } })).toEqual({ ok: false, error: 'NO_CASH' })
    const three = ok(buyPump(ok(buyPump(ok(buyPump(s))))))
    expect(three.run.fields.pump).toBe(3)
    expect(three.run.cash).toBe(1e7 - 5_000_000)
    expect(buyPump(three)).toEqual({ ok: false, error: 'MAX_LEVEL' })
  })
})

describe('setFieldCrop: the field chip', () => {
  it('order LOCKED, BAD_TILE, NOTHING_TO_DO (same chip), NO_LICENSE, LOCKED (under the harvest gate); null clears it; free', () => {
    expect(setFieldCrop(init, 0, 'lemon')).toEqual({ ok: false, error: 'LOCKED' })
    const s = withFields([field([lemon(999)], 'lemon')])
    expect(setFieldCrop(s, 1, 'lemon')).toEqual({ ok: false, error: 'BAD_TILE' })
    expect(setFieldCrop(s, 0, 'lemon')).toEqual({ ok: false, error: 'NOTHING_TO_DO' })
    expect(setFieldCrop(s, 0, 'grape')).toEqual({ ok: false, error: 'NO_LICENSE' })
    expect(setFieldCrop(s, 0, 'radish')).toEqual({ ok: false, error: 'LOCKED' }) // licensed, 0 home harvests
    const r = ok(setFieldCrop(s, 0, 'pumpkin'))
    expect(r.run.fields.list[0].crop).toBe('pumpkin')
    expect(r.run.fields.list[0].plots).toEqual([lemon(999)]) // standing plots finish as they are
    expect(r.run.cash).toBe(s.run.cash)
    expect(ok(setFieldCrop(r, 0, null)).run.fields.list[0].crop).toBeNull()
  })
})

describe('sowPlot / sowNext', () => {
  it('sowPlot order LOCKED, BAD_TILE, NO_PIVOT, NO_CROP, NOTHING_TO_DO, NO_SEEDS, NO_CASH', () => {
    expect(sowPlot(init, 0, 0)).toEqual({ ok: false, error: 'LOCKED' })
    const s = withFields([field([empty(), lemon(999)]), field([empty()], 'lemon', false), field([empty()], null)])
    expect(sowPlot(s, 3, 0)).toEqual({ ok: false, error: 'BAD_TILE' })
    expect(sowPlot(s, 0, 2)).toEqual({ ok: false, error: 'BAD_TILE' })
    expect(sowPlot(s, 1, 0)).toEqual({ ok: false, error: 'NO_PIVOT' })
    expect(sowPlot(s, 2, 0)).toEqual({ ok: false, error: 'NO_CROP' })
    expect(sowPlot(s, 0, 1)).toEqual({ ok: false, error: 'NOTHING_TO_DO' })
    expect(sowPlot({ ...s, run: { ...s.run, autoBuySeeds: false, seeds: { lemon: 9 } } }, 0, 0)).toEqual({ ok: false, error: 'NO_SEEDS' })
    expect(sowPlot({ ...s, run: { ...s.run, cash: 9 * 20 - 1, seeds: { lemon: 1 } } }, 0, 0)).toEqual({ ok: false, error: 'NO_CASH' })
  })

  it('all-or-nothing: ten pouch seeds, or auto-buy for the missing ones; ripens at tick + ceil(grow / 2); no energy', () => {
    const s = withFields([field([empty()])], { tick: 7, seeds: { lemon: 4 }, cash: 6 * 20 })
    const r = ok(sowPlot(s, 0, 0))
    expect(r.run.fields.list[0].plots[0]).toEqual(lemon(7 + Math.ceil(LEMON / FIELD_PRESSURE)))
    expect([r.run.seeds.lemon, r.run.cash, r.run.energy]).toEqual([0, 0, s.run.energy])
    // a full pouch: no cash moves
    const pouch = ok(sowPlot({ ...s, run: { ...s.run, seeds: { lemon: 15 }, cash: 0 } }, 0, 0))
    expect([pouch.run.seeds.lemon, pouch.run.cash]).toEqual([5, 0])
    // fertilizer applies like the home plot
    const fert = ok(sowPlot({ ...s, run: { ...s.run, upgrades: { ...s.run.upgrades, fertilizer: 2 } } }, 0, 0))
    expect(fert.run.fields.list[0].plots[0].readyTick).toBe(7 + Math.ceil(cropGrowTicks('lemon', init.meta, 2) / 2))
  })

  it('the dibber rolls its seed-keep once per tile above the basic tier (tier 0 keeps the RNG untouched)', () => {
    const s = withFields([field([empty()])], { seeds: { lemon: 10 }, cash: 0 })
    const basic = ok(sowPlot(s, 0, 0))
    expect([basic.run.seeds.lemon, basic.run.rngState]).toEqual([0, s.run.rngState])
    const gold = ok(sowPlot({ ...s, run: { ...s.run, toolTier: { ...s.run.toolTier, plant: 3 } } }, 0, 0))
    expect(gold.run.rngState).not.toBe(s.run.rngState)
    expect(gold.run.seeds.lemon).toBeGreaterThan(0) // 50 % keep over ten rolls: some seeds stay (this seed's sequence)
    expect(gold.run.seeds.lemon).toBeLessThan(10)
  })

  it('sowNext takes the first empty plot of the first field with pivot + chip; NOTHING_TO_DO with none, then sowPlot errors', () => {
    expect(sowNext(init)).toEqual({ ok: false, error: 'LOCKED' })
    const s = withFields([field([lemon(999)]), field([empty()], null), field([empty()], 'lemon', false), field([lemon(999), empty(), empty()])])
    const r = ok(sowNext(s))
    expect(r.run.fields.list[3].plots.map((p) => p.crop)).toEqual(['lemon', 'lemon', null])
    expect(sowNext(withFields([field([lemon(999)]), field([empty()], null)]))).toEqual({ ok: false, error: 'NOTHING_TO_DO' })
    expect(sowNext({ ...s, run: { ...s.run, cash: 0 } })).toEqual({ ok: false, error: 'NO_CASH' })
  })
})

describe('reapPlot / reapNext (by hand)', () => {
  it('order LOCKED, BAD_TILE, NOT_MATURE, NO_ENERGY; 10 ⚡ into energySpent, sold at ×1, home counters untouched', () => {
    expect(reapPlot(init, 0, 0)).toEqual({ ok: false, error: 'LOCKED' })
    const s = withFields([field([lemon(5), lemon(999), empty()])], { tick: 10, energy: 10, cash: 0 })
    expect(reapPlot(s, 1, 0)).toEqual({ ok: false, error: 'BAD_TILE' })
    expect(reapPlot(s, 0, 1)).toEqual({ ok: false, error: 'NOT_MATURE' })
    expect(reapPlot(s, 0, 2)).toEqual({ ok: false, error: 'NOT_MATURE' })
    expect(reapPlot({ ...s, run: { ...s.run, energy: 9 } }, 0, 0)).toEqual({ ok: false, error: 'NO_ENERGY' })
    const r = ok(reapPlot(s, 0, 0))
    expect(r.run.fields.list[0].plots[0]).toEqual(empty())
    expect(r.run.energy).toBe(0)
    expect(r.run.lifetime.energySpent).toBe(s.run.lifetime.energySpent + 10)
    expect(r.run.cash).toBeGreaterThan(0)
    expect(r.run.lifetime.cashEarned).toBe(r.run.cash)
    expect(r.run.counters).toEqual(s.run.counters)
    expect(r.run.lifetime.harvests).toEqual(s.run.lifetime.harvests)
    // ×1: the same ten units a worker sells
    const worker = fieldsHarvest(s)!
    expect(worker.ok && worker.state.run.cash).toBe(r.run.cash)
  })

  it('reapNext reaps the oldest ready plot; NOTHING_TO_DO with none ready, NO_ENERGY after', () => {
    expect(reapNext(init)).toEqual({ ok: false, error: 'LOCKED' })
    const s = withFields([field([lemon(8), lemon(3)]), field([lemon(3)])], { tick: 10, energy: 20 })
    const r = ok(reapNext(s))
    expect(r.run.fields.list.map((f) => f.plots.map((p) => p.crop))).toEqual([['lemon', null], ['lemon']]) // tie → field order
    expect(reapNext(withFields([field([lemon(99)])], { tick: 10 }))).toEqual({ ok: false, error: 'NOTHING_TO_DO' })
    expect(reapNext({ ...s, run: { ...s.run, energy: 0 } })).toEqual({ ok: false, error: 'NO_ENERGY' })
  })

  it('a reaped plot fills an accepted order first at the order price, exactly like a home-plot harvest', () => {
    const orders = { unlocked: true, slots: 1, offers: [{ good: 'lemon' as const, count: 3, done: 0, tier: 0, accepted: true }] }
    const s = withFields([field([lemon(900)])], { cash: 0, tick: 1000, orders })
    const r = fieldsHarvest(s)
    if (!r?.ok) throw new Error(r?.error ?? 'nothing ready')
    expect(r.state.run.lifetime.ordersCompleted).toBe(1)
    // 3 units at the order price (110 × 1.1) beat the market's glutted 110s
    const market = fieldsHarvest(withFields([field([lemon(900)])], { cash: 0, tick: 1000 }))!
    expect(market.ok && r.state.run.cash > market.state.run.cash).toBe(true)
  })

  it('a gold sickle rolls the double harvest per tile, by hand and by the worker; a basic sickle keeps the RNG', () => {
    const at = (harvest: number) => withFields([field([lemon(900)])], { cash: 0, tick: 1000, energy: 10, toolTier: { ...init.run.toolTier, harvest } })
    const gold = at(3)
    const hand = ok(reapPlot(gold, 0, 0))
    const worker = fieldsHarvest(gold)!
    const basic = ok(reapPlot(at(0), 0, 0))
    expect(hand.run.rngState).not.toBe(gold.run.rngState)
    expect(worker.ok && worker.state.run.rngState).not.toBe(gold.run.rngState)
    expect(basic.run.rngState).toBe(at(0).run.rngState)
    expect(hand.run.cash).toBeGreaterThanOrEqual(basic.run.cash)
  })
})

describe('helpers', () => {
  it('plotState, fieldsOverview, plantedTiles, pivotsOwned', () => {
    const s = withFields([field([lemon(5), lemon(99), empty()]), field([empty(), { crop: 'pumpkin', readyTick: 99 }], null), field([empty()], 'lemon', false)], { tick: 10 })
    expect([lemon(5), lemon(99), empty()].map((p) => plotState(p, 10))).toEqual(['ready', 'growing', 'empty'])
    expect(fieldsOverview(s.run)).toEqual({ plots: 6, tiles: 60, fields: 3, wetFields: 2, empty: 3, emptyWet: 1, growing: 2, ready: 1 })
    expect([plantedTiles(s.run.fields, 'lemon'), plantedTiles(s.run.fields, 'pumpkin'), plantedTiles(s.run.fields, 'radish')]).toEqual([20, 10, 0])
    expect(pivotsOwned(s.run.fields)).toBe(2)
  })

  it('a fresh run starts locked with nothing owned or planted', () => {
    expect(init.run.fields).toEqual({ unlocked: false, list: [], pump: 0, tank: 0, machines: createMachines() })
    expect(fieldsOverview(init.run)).toEqual({ plots: 0, tiles: 0, fields: 0, wetFields: 0, empty: 0, emptyWet: 0, growing: 0, ready: 0 })
    expect(CROP_IDS.map((c) => plantedTiles(init.run.fields, c))).toEqual(CROP_IDS.map(() => 0))
  })

  it('the Fields are inert while locked, with or without plots', () => {
    const locked = { ...init, run: { ...init.run, fields: { ...init.run.fields, list: [field([lemon(10), lemon(999)])] } } }
    expect(step(locked, 3).run.fields).toEqual(locked.run.fields)
  })

  it('marginal income runs on the pressured cycle; the payback = plotCost ÷ (10 × marginal per tile)', () => {
    const s = withFields([field([empty(), empty()])], { market: { ...init.run.market, pumpkin: 0, lemon: 31.5 } })
    const income = fieldsMarginalIncomePerHour(s)
    expect(income).toBeGreaterThan(0)
    expect(fieldsPaybackHours(s)).toBe(Math.round(plotCost(2, init.meta) / (10 * income)))
    expect(fieldsPaybackHours(withFields(undefined, { licenses: init.run.licenses, lifetime: init.run.lifetime }))).toBe(0)
  })
})

describe('workers on the fields (whole plots)', () => {
  /** every home tile planted and still growing, so the planter and harvester fall through to the Fields */
  function fieldsRun(list: Field[], assigned = { plant: 1, harvest: 0 }, extra: Partial<GameState['run']> = {}): GameState {
    const tiles = init.run.tiles.map((t) => ({ ...t, status: 'planted' as const, cropId: 'lemon' as const, growth: 10, moisture: 4 }))
    return withFields(list, {
      tiles,
      tick: 5,
      workers: { pool: 2, assigned: { plant: assigned.plant, water: 0, harvest: assigned.harvest, ore: 0, fuel: 0, mine: 0, clerk: 0, manager: 0 }, certificates: ['plant', 'harvest'] },
      ...extra,
    })
  }

  it('a planter whose home plot is fully planted sows the next plot by its chip (same wage, no home counters)', () => {
    const after = step(fieldsRun([field([lemon(999), empty()])]), 1)
    expect(after.run.fields.list[0].plots[1]).toEqual(lemon(5 + LEMON / 2))
    expect(after.run.cash).toBe(1000 - 10 * 20 - 1) // ten seeds + the wage
    expect([after.run.lifetime.wagesPaid, after.run.counters.plants]).toEqual([1, 0])
    expect(fieldsPlantAction(fieldsRun([field([empty()], null)]))).toBeNull() // no chip: nothing to sow, plain idle
  })

  it('a harvester with nothing ready at home reaps the oldest ready plot, whole, no energy', () => {
    const s = fieldsRun([field([lemon(4), lemon(2)])], { plant: 0, harvest: 1 })
    const after = step(s, 1)
    expect(after.run.fields.list[0].plots).toEqual([lemon(4), empty()])
    expect(after.run.energy).toBeGreaterThanOrEqual(s.run.energy)
    expect(after.run.lifetime.wagesPaid).toBe(1)
  })

  it('a planter with no sowable plot idles unpaid', () => {
    const after = step(fieldsRun([field([lemon(999)]), field([empty()], 'lemon', false)]), 1)
    expect(after.run.lifetime.wagesPaid).toBe(0)
    expect(sown(after)).toBe(1)
  })
})

describe('machinesAct on whole plots', () => {
  it('the harvester accrues only while a plot is ready, reaps one plot per 10 accrued oldest-first, then clamps the carry to ≤ 10', () => {
    // Mk3 = 2 tiles/tick: 5 ticks = 10 tiles = one plot
    const s = withFields([field([lemon(50), lemon(40), lemon(9999)])], { tick: 100, cash: 0 }, { machines: fleet({ harvester: [3] }) })
    const four = step(s, 4)
    expect(sown(four)).toBe(3)
    const five = step(s, 5)
    expect(five.run.fields.list[0].plots).toEqual([lemon(50), empty(), lemon(9999)])
    // a big banked carry reaps every ready plot at once, then the carry clamps to one plot
    const banked = machinesAct(withFields([field([lemon(50), lemon(40), lemon(9999)])], { tick: 100 }, { machines: fleet({ harvester: [3], carry: { harvest: 35, plant: 0, maint: 0 } }) }))
    expect(banked.run.fields.list[0].plots).toEqual([empty(), empty(), lemon(9999)])
    expect(banked.run.fields.machines.carry.harvest).toBe(10)
    // nothing ready: nothing accrues, no maintenance
    const idle = withFields([field([lemon(9999)])], { tick: 100, cash: 500 }, { machines: fleet({ harvester: [1, 2, 3] }) })
    expect(step(idle, 600).run.fields.machines.carry).toEqual({ harvest: 0, plant: 0, maint: 0 })
  })

  it('the harvester rolls the best sickle double harvest per tile; a basic sickle rolls nothing', () => {
    const at = (harvest: number) =>
      withFields([field([lemon(50)])], { tick: 100, cash: 0, toolTier: { ...init.run.toolTier, harvest } }, { machines: fleet({ harvester: [3], carry: { harvest: 10, plant: 0, maint: 0 } }) })
    const gold = machinesAct(at(3))
    const basic = machinesAct(at(0))
    expect([sown(gold), sown(basic)]).toEqual([0, 0])
    expect(gold.run.rngState).not.toBe(at(3).run.rngState)
    expect(basic.run.rngState).toBe(at(0).run.rngState)
  })

  it('machines first, workers fill the gap: with one ready plot the machine takes it and the worker idles unpaid', () => {
    const tiles = init.run.tiles.map((t) => ({ ...t, status: 'planted' as const, cropId: 'lemon' as const, growth: 10, moisture: 4 }))
    const base = withFields([field([lemon(4)])], {
      tiles,
      tick: 5,
      workers: { pool: 1, assigned: { plant: 0, water: 0, harvest: 1, ore: 0, fuel: 0, mine: 0, clerk: 0, manager: 0 }, certificates: ['plant', 'harvest'] },
    }, { machines: fleet({ harvester: [3], carry: { harvest: 9, plant: 0, maint: 0 } }) })
    const after = step(base, 1)
    expect(sown(after)).toBe(0)
    expect(after.run.lifetime.wagesPaid).toBe(0)
    const control = step({ ...base, run: { ...base.run, fields: { ...base.run.fields, machines: fleet({}) } } }, 1)
    expect(sown(control)).toBe(0)
    expect(control.run.lifetime.wagesPaid).toBe(1)
  })

  it('maintenance: an hour the cash cannot pay pauses the fleet with the debt capped at it', () => {
    const due = withFields([field([lemon(50)])], { cash: 0, tick: 100 }, { machines: fleet({ harvester: [3], carry: { harvest: 9.5, plant: 0, maint: 0.999 } }) })
    const paused = machinesAct(due)
    expect([paused.run.cash, sown(paused), paused.run.fields.machines.carry.maint]).toEqual([0, 1, 1])
    const paid = machinesAct({ ...due, run: { ...due.run, cash: 5 } })
    expect(sown(paid)).toBe(0)
    expect(paid.run.fields.machines.carry.maint).toBeLessThan(1)
  })

  it('the seeder sows through sowNext by the chips, one plot per 10 accrued; on NO_CASH it holds one plot; no target accrues nothing', () => {
    // Mk2 = 1 tile/tick: 20 ticks = two plots
    const s = withFields([field([empty(), empty(), empty()])], {}, { machines: fleet({ seeder: [2] }) })
    const after = step(s, 20)
    expect(after.run.fields.list[0].plots.map((p) => p.crop)).toEqual(['lemon', 'lemon', null])
    expect(after.run.cash).toBe(1000 - 20 * 20) // seeds only: no wage, maintenance under a whole cash
    const broke = step({ ...s, run: { ...s.run, cash: 5 } }, 30)
    expect(sown(broke)).toBe(0)
    expect(broke.run.fields.machines.carry.plant).toBe(10)
    const noChip = step(withFields([field([empty()], null)], {}, { machines: fleet({ seeder: [2] }) }), 30)
    expect(noChip.run.fields.machines.carry).toEqual({ harvest: 0, plant: 0, maint: 0 })
  })
})

describe('buyMachine', () => {
  it('is LOCKED before the fields or the job certificate, ALREADY_OWNED per tier, then pays items and cash', () => {
    expect([machineMaxTiers('harvester'), machineMaxTiers('seeder')]).toEqual([3, 2])
    expect([1, 2, 3].map((t) => machineTilesPerHour('harvester', t))).toEqual([1800, 3600, 7200])
    expect([1, 2, 3].map((t) => machineMaintPerHour(t))).toEqual([60, 120, 240])
    expect([1, 2].map((t) => machineTilesPerHour('seeder', t))).toEqual([1800, 3600])
    expect(machineCost('harvester', 1, init.meta)).toEqual({ ironBar: 12, cash: machineCost('harvester', 1, init.meta).cash })
    expect(machineCost('harvester', 2, init.meta)).toEqual({ ironBar: 24, goldBar: 4, cash: machineCost('harvester', 2, init.meta).cash })
    expect(machineCost('harvester', 3, init.meta)).toEqual({ goldBar: 12, cash: machineCost('harvester', 3, init.meta).cash })
    expect(machineCost('seeder', 1, init.meta)).toEqual({ ironBar: 12, cash: machineCost('seeder', 1, init.meta).cash })
    expect(machineCost('seeder', 2, init.meta)).toEqual({ ironBar: 24, goldBar: 4, cash: machineCost('seeder', 2, init.meta).cash })
    expect(buyMachine(init, 'harvester', 1)).toEqual({ ok: false, error: 'LOCKED' })
    const s = withFields(undefined, { cash: 1e6, inventory: { ironBar: 12 } })
    const r = ok(buyMachine(s, 'harvester', 1))
    expect(r.run.fields.machines.harvester).toEqual([1])
    expect(r.run.cash).toBe(1e6 - machineCost('harvester', 1, init.meta).cash)
    expect(buyMachine(r, 'harvester', 1)).toEqual({ ok: false, error: 'ALREADY_OWNED' })
  })
})

describe('pressure: the tank, the valve, the loader (task 147)', () => {
  const U = TANK_UNITS_PER_COAL
  const HALF = Math.ceil(LEMON / FIELD_PRESSURE)
  /** odd ticks in [a, b) */
  const oddIn = (a: number, b: number) => Math.floor(b / 2) - Math.floor(a / 2)

  it('a paid tank keeps ×2: a plot sown at t ripens at t + ceil(grow / 2), one burn unit per plot per tick', () => {
    const s = ok(sowPlot(withFields([field([empty(), empty()])], { tick: 10 }, { tank: 1000 }), 0, 0))
    const after = step(s, HALF)
    expect(after.run.fields.list[0].plots[0]).toEqual(lemon(10 + HALF))
    expect(plotState(after.run.fields.list[0].plots[0], after.run.tick)).toBe('ready')
    expect(after.run.fields.tank).toBe(1000 - 2 * HALF) // valve off: the empty plot burns too
  })

  it('an empty tank grows ×1 exactly: readyTick moves 1 later on every odd tick while growing, burns nothing', () => {
    const s = ok(sowPlot(withFields([field([empty()])], { tick: 10 }, { tank: 0 }), 0, 0))
    const t100 = step(s, 100) // ticks 10 … 109: 50 odd ones
    expect(t100.run.fields.list[0].plots[0].readyTick).toBe(10 + HALF + 50)
    expect(t100.run.fields.tank).toBe(0)
    const done = step(s, LEMON + 2)
    const p = done.run.fields.list[0].plots[0]
    expect(plotState(p, done.run.tick)).toBe('ready')
    expect(p.readyTick).toBe(10 + HALF + oddIn(10, p.readyTick)) // t + ceil(grow / 2) + the odd ticks passed (= t + 359)
  })

  it('valve on: empty and ready plots burn nothing; valve off: they burn; a dry field burns nothing and grows ×1', () => {
    const plots = [lemon(999), empty(), lemon(1)]
    const valve = (on: boolean) => withFields([field(plots), field([lemon(999)], 'lemon', false)], { tick: 10, workshop: { built: true, beds: [true, false, false, false], valve: on } }, { tank: 10 })
    expect(step(valve(true), 1).run.fields.tank).toBe(9)
    expect(step(valve(false), 1).run.fields.tank).toBe(7)
    // tick 11 is odd: the dry field's growing plot slips one tick, the pressured one does not
    const two = step(valve(true), 2)
    expect(two.run.fields.list.map((f) => f.plots[0].readyTick)).toEqual([999, 1000])
    // a tank short of the whole burn pays nothing: pressure off, tank kept
    const short = withFields([field([lemon(999), lemon(999)])], { tick: 11 }, { tank: 1 })
    expect(step(short, 1).run.fields).toMatchObject({ tank: 1, list: [{ plots: [lemon(1000), lemon(1000)] }] })
  })

  it('fillTank: order LOCKED, NOTHING_TO_DO (room < 1 coal), NOT_ENOUGH_ITEMS; moves whole coal up to the room', () => {
    expect(fillTank(init)).toEqual({ ok: false, error: 'LOCKED' })
    const s = withFields(undefined, { inventory: { coal: 100 } }, { tank: 30 * U + 5 })
    const r = ok(fillTank(s))
    expect([r.run.inventory.coal, r.run.fields.tank]).toEqual([91, 39 * U + 5]) // room = floor((40·U − 30·U − 5) / U) = 9
    expect(fillTank(r)).toEqual({ ok: false, error: 'NOTHING_TO_DO' })
    expect(fillTank({ ...s, run: { ...s.run, inventory: {} } })).toEqual({ ok: false, error: 'NOT_ENOUGH_ITEMS' })
    const few = ok(fillTank({ ...s, run: { ...s.run, inventory: { coal: 3 } } }))
    expect([few.run.inventory.coal, few.run.fields.tank]).toEqual([0, 33 * U + 5])
  })

  it('the fuel loader: the furnace first, then one coal into the tank, then idle', () => {
    const loader = (furnace: Partial<GameState['run']['furnace']>, tank: number, coal = 5) =>
      withFields(undefined, {
        tick: 5,
        inventory: { coal },
        furnace: { ...init.run.furnace, ...furnace },
        workers: { pool: 1, assigned: { plant: 0, water: 0, harvest: 0, ore: 0, fuel: 1, mine: 0, clerk: 0, manager: 0 }, certificates: ['fuel'] },
      }, { tank })
    const furnace = step(loader({ built: true, fire: 0 }, 0), 1)
    expect([furnace.run.inventory.coal, furnace.run.fields.tank, furnace.run.lifetime.wagesPaid]).toEqual([4, 0, 1])
    const tank = step(loader({ built: false }, 0), 1)
    // one coal in at the worker tick, then Field 1's empty plot burns its unit (valve off)
    expect([tank.run.inventory.coal, tank.run.fields.tank, tank.run.lifetime.wagesPaid]).toEqual([4, U - 1, 1])
    const full = step(loader({ built: false }, 40 * U), 1)
    expect([full.run.inventory.coal, full.run.lifetime.wagesPaid]).toEqual([5, 0])
  })

  /** 20 pivoted fields × 5 plots growing far beyond 8 h, Pump 3, valve off */
  const bigFarm = (tank: number) =>
    withFields(Array.from({ length: 20 }, () => field(Array.from({ length: 5 }, () => lemon(1e9)))), { tick: 0 }, { pump: 3, tank })

  it('pin: a full Pump-3 tank (400 coal) holds ×2 for every one of the 28,800 offline ticks and ends at 0', () => {
    const s = bigFarm(tankCapCoal(3) * U)
    const after = step(s, 28_800)
    expect(after.run.fields.tank).toBe(0)
    expect(after.run.fields.list.every((f) => f.plots.every((p) => p.readyTick === 1e9))).toBe(true) // never slowed
  }, 60_000)

  it('pin: the same farm with an empty tank ripens everything at ×1', () => {
    const sown = withFields(Array.from({ length: 20 }, () => field(Array.from({ length: 5 }, () => lemon(HALF)))), { tick: 0 }, { pump: 3, tank: 0 })
    const after = step(sown, LEMON + 2)
    const r = HALF + oddIn(0, LEMON - 1) // 180 + 179 = 359: the full grow time, ×1
    expect(r).toBe(LEMON - 1)
    expect(after.run.fields.list.every((f) => f.plots.every((p) => p.readyTick === r && plotState(p, after.run.tick) === 'ready'))).toBe(true)
  })

  it('pin: step(s, n) = n × step(s, 1) with the tank crossing empty mid-run', () => {
    const s = bigFarm(100 * 300)
    let one = s
    for (let i = 0; i < 600; i++) one = step(one, 1)
    expect(step(s, 600)).toEqual(one)
    expect(one.run.fields.tank).toBe(0)
    expect(one.run.fields.list[0].plots[0].readyTick).toBe(1e9 + 150) // 300 paid ticks, then 150 odd of the next 300
  })
})

describe('step identity over plots', () => {
  it('step(s, 600) = 600 × step(s, 1) with plots, workers, both machine kinds, the market, an accepted order; catch-up equal', () => {
    const tiles = init.run.tiles.map((t) => ({ ...t, status: 'planted' as const, cropId: 'lemon' as const, growth: 10, moisture: 4 }))
    const s = withFields(
      [field([lemon(300), lemon(3600), empty(), empty(), empty()]), field([{ crop: 'pumpkin', readyTick: 5000 }, empty()], 'pumpkin'), field([empty()], 'lemon', false)],
      {
        tiles,
        tick: 4,
        cash: 5000,
        energy: 30,
        workers: { pool: 2, assigned: { plant: 1, water: 0, harvest: 1, ore: 0, fuel: 0, mine: 0, clerk: 0, manager: 0 }, certificates: ['plant', 'harvest'] },
        orders: { unlocked: true, slots: 1, offers: [{ good: 'lemon', count: 20, done: 0, tier: 0, accepted: true }] },
      },
      { pump: 1, machines: fleet({ harvester: [1, 2], seeder: [1], carry: { harvest: 0.5, plant: 3.25, maint: 0.9 } }) },
    )
    let one = s
    for (let i = 0; i < 600; i++) one = step(one, 1)
    expect(step(s, 600)).toEqual(one)
    expect(catchUp(s, 600_000)).toEqual(step(s, 600))
    expect(sown(one)).toBeGreaterThan(0)
  })
})
