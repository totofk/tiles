import { describe, expect, it } from 'vitest'
import { TANK_UNITS_PER_COAL, cropGrowTicks, cropSeedCost, cropSellPrice, machineCost, marketFactor, pivotCost, plotCost, pumpCost, tankCapCoal } from '../src/core/balance'
import { CROPS, type CropId } from '../src/core/data/crops'
import { createInitialState, createMachines, type Field, type GameState, type Plot } from '../src/core/state'
import { compactCash, cropOptionText, estateBottleneck, estateCropIncomePerHour, estateIncomePerHour, fleetTilesPerHour, ghostRowPrice, managerPlanText, nextReadyText, plotCellView } from '../src/app/estateText'
import { fieldsCropIncomePerHour, nextReapTarget, nextSowTarget, pressuredCycle } from '../src/core/fields'
import { CROP_EMOJI } from '../src/app/FarmGrid'
import { priceText } from '../src/app/Mine'

/** a Tractor-era run forged from a fresh state: one field per entry of `fields`, a full Pump-0 tank, machines and cash
 *  as each test needs */
function at(over: {
  fields?: Field[]
  machines?: { harvester?: number[]; seeder?: number[] }
  cash?: number
  certificates?: string[]
  inventory?: GameState['run']['inventory']
  pump?: number
  tank?: number
}): GameState {
  const s = createInitialState()
  return {
    ...s,
    run: {
      ...s.run,
      cash: over.cash ?? 1_000_000,
      licenses: ['radish'],
      inventory: { ...s.run.inventory, coal: 5, copperBar: 99, ironBar: 99, goldBar: 99, ...over.inventory },
      workers: { ...s.run.workers, certificates: (over.certificates ?? ['plant', 'harvest']) as GameState['run']['workers']['certificates'] },
      fields: {
        ...s.run.fields,
        unlocked: true,
        list: over.fields ?? [],
        pump: over.pump ?? 0,
        tank: over.tank ?? tankCapCoal(over.pump ?? 0) * TANK_UNITS_PER_COAL,
        machines: { ...createMachines(), harvester: over.machines?.harvester ?? [], seeder: over.machines?.seeder ?? [] },
      },
    },
  }
}

const empty = (): Plot => ({ crop: null, readyTick: 0 })
// a growing radish plot far from ready / a ripened one (readyTick below any fresh tick)
const growing = (): Plot => ({ crop: 'radish' as CropId, readyTick: 999_999 })
const ripe = (): Plot => ({ crop: 'radish' as CropId, readyTick: 0 })
const field = (plots: Plot[], crop: CropId | null = 'radish', pivot = true): Field => ({ pivot, crop, pinned: false, plots })
const full = (crop: CropId | null = 'radish') => field([growing(), growing(), growing(), growing(), growing()], crop)
const machines = { harvester: [1], seeder: [1] }

describe('estateText (batch 27, task 143; plots since batch 28)', () => {
  it('estateCropIncomePerHour: field k chip crop tiles × pressured cycles/h × (market-priced sale − seed), rounded — hand arithmetic', () => {
    const state = at({ fields: [field([growing(), growing()]), field([growing()], null)] })
    const cycle = Math.ceil(cropGrowTicks('radish', state.meta, 0) / 2)
    const net = cropSellPrice('radish', state.meta, 0) * marketFactor('radish', 0) - cropSeedCost('radish', state.meta)
    expect(estateCropIncomePerHour(state, 0)).toBe(Math.round((20 * 3600 * net) / cycle))
    // no chip: no income from that row; the total sums the rows
    expect(estateCropIncomePerHour(state, 1)).toBe(0)
    expect(estateIncomePerHour(state)).toBe(estateCropIncomePerHour(state, 0))
    expect(estateIncomePerHour(at({}))).toBe(0)
  })

  it('ghostRowPrice: the next plot (the ten-tile sum); nextReadyText formats m/h', () => {
    const state = at({ fields: [field([empty(), empty()])] })
    expect(ghostRowPrice(state)).toBe(plotCost(2, state.meta))
    expect(nextReadyText(190)).toBe('3m')
    expect(nextReadyText(20)).toBe('1m') // never 0m
    expect(nextReadyText(7200)).toBe('2h')
    expect(fleetTilesPerHour({ ...createMachines(), harvester: [1, 2] }, 'harvester')).toBeGreaterThan(0)
    expect(fleetTilesPerHour(createMachines(), 'seeder')).toBe(0)
  })

  it('bottleneck 1: pressure off with growing plots → Fill tank, or mine coal with none in storage — before a dry field', () => {
    const dry = [field([growing()]), field([empty()], null, false)]
    expect(estateBottleneck(at({ fields: dry, tank: 0 }))).toEqual({ label: '⚠ Pressure off ×1 — tank empty', fix: 'Fill tank' })
    expect(estateBottleneck(at({ fields: dry, tank: 0, inventory: { coal: 0 } })).fix).toBe('mine coal')
    // nothing growing: an empty tank is not the bottleneck
    expect(estateBottleneck(at({ fields: [field([empty()])], tank: 0, machines })).label).not.toMatch(/Pressure/)
  })

  it('bottleneck 2: a field holding plots has no pivot → its pivot with price and affordability — before a missing chip', () => {
    const s = at({ fields: [field([growing()]), field([empty()], null, false), field([empty()], null)], pump: 1 })
    expect(estateBottleneck(s)).toEqual({ label: '⚠ Dry — Field 2 has no pivot', fix: `Pivot ${priceText(pivotCost(3, s.meta))} · now` }) // fields 1 and 3 hold pivots: this is pivot 3
    const short = at({ fields: [field([growing()]), field([empty()], null, false)], pump: 1, inventory: { goldBar: 0 } })
    expect(estateBottleneck(short).fix).toMatch(/^Pivot .+ · needs .+ more$/)
  })

  it('bottleneck 3: an empty plot in a pivoted field with no crop picked', () => {
    expect(estateBottleneck(at({ fields: [field([growing()]), field([empty()], null)] }))).toEqual({ label: '⚠ Sowing — Field 2 waits for a crop', fix: 'pick a crop' })
  })

  it('batch 29 bottleneck 3: a working Manager picks unpinned fields; pinned ones still wait; unpaid says so', () => {
    const withManager = (s: GameState, cash: number): GameState => ({
      ...s,
      run: {
        ...s.run,
        cash,
        lifetime: { ...s.run.lifetime, harvests: { radish: 50 } },
        workers: { pool: 1, assigned: { ...s.run.workers.assigned, manager: 1 }, certificates: ['plant', 'harvest', 'manager'] },
      },
    })
    const owned = (s: GameState): GameState => ({ ...s, run: { ...s.run, workers: { ...s.run.workers, certificates: [...s.run.workers.certificates, 'manager'] } } })
    const fields = [field([growing()]), field([empty()], null)]
    expect(estateBottleneck(owned(at({ fields }))).fix).toBe('pick a crop or assign the 💼 Manager')
    expect(estateBottleneck(withManager(at({ fields }), 1_000_000)).label).not.toMatch(/Field 2 waits/)
    const pinned = [field([growing()]), { ...field([empty()], null), pinned: true }]
    expect(estateBottleneck(withManager(at({ fields: pinned }), 1_000_000)).label).toBe('⚠ Sowing — Field 2 waits for a crop')
    expect(estateBottleneck(withManager(at({ fields }), 27))).toEqual({ label: '⚠ Manager unpaid — Field 2 waits', fix: 'needs 💰28 per change' })
  })

  it('batch 29: cropOptionText — current chip short, marginal ≈💰/h and market factor, the 🏡 gate', () => {
    const s0 = at({ fields: [field([growing()]), field([empty(), empty()], null)] })
    const s: GameState = { ...s0, run: { ...s0.run, licenses: ['radish', 'lemon'], lifetime: { ...s0.run.lifetime, harvests: { radish: 50, lemon: 7 } } } }
    const R = `${CROP_EMOJI.radish} ${CROPS.radish.name}`
    expect(cropOptionText(s, 0, 'radish')).toBe(R)
    expect(cropOptionText(s, 0, 'lemon')).toBe(`${CROP_EMOJI.lemon} ${CROPS.lemon.name} · 🏡 7/50`)
    // field 2 (two plots) on radish while field 1 already shows radish: the marginal over field 1's 10 tiles
    const m = Math.round(fieldsCropIncomePerHour(s, 'radish', 30) - fieldsCropIncomePerHour(s, 'radish', 10))
    expect(cropOptionText(s, 1, 'radish')).toBe(`${R} · ≈💰${m}/h · ×${marketFactor('radish', s.run.market.radish).toFixed(2)}`)
  })

  it('bottleneck 4: sowable plots, no seeder — the cheapest Seeder (certificate gate, then price)', () => {
    const base = at({ fields: [field([growing(), empty()])] })
    expect(estateBottleneck(base).label).toBe('⚠ Sowing')
    const noCert = { ...base, run: { ...base.run, workers: { ...base.run.workers, certificates: [] as GameState['run']['workers']['certificates'] } } }
    expect(estateBottleneck(noCert).fix).toBe('Seeder Mk1 needs the plant certificate')
    expect(estateBottleneck(base).fix).toMatch(/^Seeder Mk1 .+ · now$/)
  })

  it('bottleneck 5: ready plots, no harvester → the cheapest Harvester (bar shortfall beats a time)', () => {
    const base = at({ fields: [field([ripe()])], machines: { seeder: [1] } })
    expect(estateBottleneck(base).label).toBe('⚠ Reaping — 1 ready')
    const broke = { ...base, run: { ...base.run, inventory: { ...base.run.inventory, ironBar: 0 } } }
    expect(estateBottleneck(broke).fix).toMatch(/^Harvester Mk1 .+ · needs .+ more$/)
    expect(machineCost('harvester', 1, base.meta).ironBar).toBeGreaterThan(0)
  })

  it('bottleneck 6: the next plot needs a field past the pump cap → the next pump with its price, or max pump', () => {
    const s = at({ fields: [full(), full()], machines })
    expect(estateBottleneck(s)).toEqual({ label: '⚠ Pump — Field 3 needs Pump Lv1', fix: `${priceText(pumpCost(0, s.meta)!)} · now` })
    const top = at({ fields: Array.from({ length: 20 }, () => full()), machines, pump: 3 })
    expect(estateBottleneck(top)).toEqual({ label: '⚠ Pump — Field 21 needs Pump Lv4', fix: 'max pump' })
  })

  it('bottleneck 7: nothing blocks → the next plot, affordable now / in cash-gap time', () => {
    const clear = at({ fields: [field([growing()])], machines })
    const chip = estateBottleneck(clear)
    expect(chip.label).toBe('✓ Land — next plot')
    expect(chip.fix).toBe(`＋ Plot 💰${ghostRowPrice(clear)} · now`)
    const gap = { ...clear, run: { ...clear.run, cash: 1 } }
    expect(estateBottleneck(gap).fix).toMatch(new RegExp(`^＋ Plot 💰${ghostRowPrice(clear)} · ≈~\\d+ (min|h)$`))
  })
})

describe('batch 29: managerPlanText', () => {
  const R = CROP_EMOJI.radish
  const radishReady = (s: GameState): GameState => ({ ...s, run: { ...s.run, lifetime: { ...s.run.lifetime, harvests: { radish: 50 } } } })
  it('no managed field → "no wet fields to manage"; one rest crop → "rest"', () => {
    expect(managerPlanText(radishReady(at({ fields: [{ ...field([empty()]), pinned: true }] })))).toBe('no wet fields to manage')
    expect(managerPlanText(radishReady(at({ fields: [field([empty()], null), field([empty()], null)] })))).toBe(`${R} rest`)
  })
  it('a contract part first: "×1 field → order 2", joined with " · "', () => {
    const s = radishReady(at({ fields: [field([empty()], null), field([empty()], null)] }))
    const offers = [{ good: 'coal' as const, count: 3, done: 0, tier: 1, accepted: false }, { good: 'radish' as const, count: 30, done: 0, tier: 2, accepted: true }]
    const withOrder = { ...s, run: { ...s.run, orders: { ...s.run.orders, unlocked: true, offers } } }
    expect(managerPlanText(withOrder)).toBe(`${R} ×1 field → order 2 · ${R} rest`)
  })
})

describe('batch 30: the Estate map cells (plotCellView) and compactCash', () => {
  const plot = (crop: CropId | null, readyTick = 0): Plot => ({ crop, readyTick })
  const field = (plots: Plot[], pivot = true, crop: CropId | null = 'radish'): Field => ({ pivot, crop, pinned: false, plots })

  it('compactCash: 9,999 as is, 10,000 → 10k, 385,500 → 386k (round), 1,234,567 → 1.2M', () => {
    expect([9_999, 10_000, 385_500, 1_234_567].map(compactCash)).toEqual(['9999', '10k', '386k', '1.2M'])
  })

  it('every kind from a forged state: empty, dry, growing (pct + ripe in), ready, ghost, none', () => {
    const base = at({ fields: [] })
    const cycle = pressuredCycle(base, 'radish')
    const half = Math.round(cycle / 2)
    const tick = base.run.tick
    const s = at({ fields: [field([plot(null), plot('radish', tick + half), plot('radish', tick)]), field([plot(null)], false, null)] })
    expect(plotCellView(s, 0, 0)).toEqual({ kind: 'empty', emoji: '', pct: 0, label: 'Field 1 plot 1 · empty — sow', marker: false, ordered: false })
    const g = plotCellView(s, 0, 1)
    expect([g.kind, g.emoji, g.pct]).toEqual(['growing', CROP_EMOJI.radish, 1 - half / cycle])
    expect(g.label).toBe(`Field 1 plot 2 · ${CROPS.radish.name} ${Math.round((1 - half / cycle) * 100)} % · ripe in ${nextReadyText(half)}`)
    const far = at({ fields: [field([plot('radish', tick + 10 * cycle)])] })
    expect(plotCellView(far, 0, 0).pct).toBe(0) // clamped
    expect(plotCellView(s, 0, 2)).toEqual({ kind: 'ready', emoji: CROP_EMOJI.radish, pct: 1, label: `Field 1 plot 3 · ${CROPS.radish.name} ready — reap ⚡10`, marker: false, ordered: false })
    expect(plotCellView(s, 0, 3)).toEqual({ kind: 'ghost', emoji: '', pct: 0, label: `Buy plot 4 of Field 1 · 💰${ghostRowPrice(s)} · 10 tiles`, marker: false, ordered: false })
    expect(plotCellView(s, 0, 4).kind).toBe('none')
    expect(plotCellView(s, 1, 0)).toMatchObject({ kind: 'dry', label: 'Field 2 plot 1 · no pivot' })
    expect(plotCellView(s, 1, 1).kind).toBe('none') // the ghost slot is in Field 1, not here
  })

  it('📋 on a ready plot only while an accepted unfinished order wants that crop', () => {
    const s = at({ fields: [field([plot('radish', 0)])] })
    const order = (accepted: boolean, done: number): GameState => ({
      ...s,
      run: { ...s.run, orders: { ...s.run.orders, unlocked: true, slots: 1, offers: [{ good: 'radish', count: 5, done, tier: 1, accepted }] } },
    })
    expect(plotCellView(order(true, 0), 0, 0).ordered).toBe(true)
    expect(plotCellView(order(false, 0), 0, 0).ordered).toBe(false)
    expect(plotCellView(order(true, 5), 0, 0).ordered).toBe(false)
  })

  it('🚜 marker: on nextReapTarget with a harvester, on nextSowTarget with a seeder, never without the machine', () => {
    const fields = [field([plot('radish', 5), plot(null), plot('radish', 2)]), field([plot(null)])]
    const ticked = (s: GameState): GameState => ({ ...s, run: { ...s.run, tick: 10 } })
    const none = ticked(at({ fields }))
    expect(nextReapTarget(none.run)).toEqual([0, 2])
    expect(nextSowTarget(none.run.fields)).toEqual([0, 1])
    const marked = (s: GameState) => s.run.fields.list.flatMap((f, k) => f.plots.map((_, j) => (plotCellView(s, k, j).marker ? `${k},${j}` : ''))).filter(Boolean)
    expect(marked(none)).toEqual([])
    expect(marked(ticked(at({ fields, machines: { harvester: [1] } })))).toEqual(['0,2'])
    expect(marked(ticked(at({ fields, machines: { seeder: [1] } })))).toEqual(['0,1'])
    expect(plotCellView(ticked(at({ fields, machines: { harvester: [1] } })), 0, 2).label).toMatch(/ · 🚜 next$/)
  })
})
