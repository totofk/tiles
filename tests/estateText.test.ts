import { describe, expect, it } from 'vitest'
import { TANK_UNITS_PER_COAL, cropGrowTicks, cropSeedCost, cropSellPrice, machineCost, marketFactor, pivotCost, plotCost, pumpCost, tankCapCoal } from '../src/core/balance'
import type { CropId } from '../src/core/data/crops'
import { createInitialState, createMachines, type Field, type GameState, type Plot } from '../src/core/state'
import { estateBottleneck, estateCropIncomePerHour, estateIncomePerHour, fleetTilesPerHour, ghostRowPrice, nextReadyText } from '../src/app/estateText'
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
    expect(estateBottleneck(at({ fields: [field([growing()]), field([empty()], null)] }))).toEqual({ label: '⚠ Sowing — pick a crop for Field 2', fix: 'pick a crop' })
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
