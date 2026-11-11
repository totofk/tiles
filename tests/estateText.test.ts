import { describe, expect, it } from 'vitest'
import { cropGrowTicks, cropSeedCost, cropSellPrice, machineCost, marketFactor, plotCost } from '../src/core/balance'
import type { CropId } from '../src/core/data/crops'
import { createInitialState, createMachines, type Field, type GameState, type Plot } from '../src/core/state'
import { estateBottleneck, estateCropIncomePerHour, estateIncomePerHour, fleetTilesPerHour, ghostRowPrice, nextReadyText } from '../src/app/estateText'

/** a Tractor-era run forged from a fresh state: one field per entry of `fields`, machines and cash as each test needs
 *  (batch 28: plots; task 148 rewrites the strip and these tests) */
function at(over: {
  fields?: Field[]
  machines?: { harvester?: number[]; seeder?: number[] }
  cash?: number
  certificates?: string[]
  inventory?: GameState['run']['inventory']
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

describe('estateText (batch 27, task 143; plots since batch 28)', () => {
  it('estateCropIncomePerHour: planted tiles × cycles/h × (market-priced sale − seed), rounded — hand arithmetic', () => {
    const state = at({ fields: [field([growing()])] })
    const grow = cropGrowTicks('radish', state.meta, 0)
    const net = cropSellPrice('radish', state.meta, 0) * marketFactor('radish', 0) - cropSeedCost('radish', state.meta)
    expect(estateCropIncomePerHour(state, 'radish')).toBe(Math.round((10 * 3600 * net) / grow))
    expect(estateIncomePerHour(state)).toBe(estateCropIncomePerHour(state, 'radish'))
    // nothing planted: no income from that row
    expect(estateCropIncomePerHour(at({}), 'radish')).toBe(0)
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

  it('bottleneck 1: an empty plot in a pivoted field with no crop picked', () => {
    expect(estateBottleneck(at({ fields: [field([growing()]), field([empty()], null)] }))).toEqual({ label: '⚠ Sowing — pick a crop for Field 2', fix: 'pick a crop' })
  })

  it('bottleneck 2: sowable plots, no seeder — the cheapest Seeder (certificate gate, then price)', () => {
    const base = at({ fields: [field([growing(), empty()])] })
    expect(estateBottleneck(base).label).toBe('⚠ Sowing')
    const noCert = { ...base, run: { ...base.run, workers: { ...base.run.workers, certificates: [] as GameState['run']['workers']['certificates'] } } }
    expect(estateBottleneck(noCert).fix).toBe('Seeder Mk1 needs the plant certificate')
    expect(estateBottleneck(base).fix).toMatch(/^Seeder Mk1 .+ · now$/)
  })

  it('bottleneck 3: ready plots, no harvester → the cheapest Harvester (bar shortfall beats a time)', () => {
    const base = at({ fields: [field([ripe()])], machines: { seeder: [1] } })
    expect(estateBottleneck(base).label).toBe('⚠ Reaping — 1 ready')
    const broke = { ...base, run: { ...base.run, inventory: { ...base.run.inventory, ironBar: 0 } } }
    expect(estateBottleneck(broke).fix).toMatch(/^Harvester Mk1 .+ · needs .+ more$/)
    expect(machineCost('harvester', 1, base.meta).ironBar).toBeGreaterThan(0)
  })

  it('bottleneck 4: nothing blocks → the next plot, affordable now / in cash-gap time', () => {
    const clear = at({ fields: [field([growing()])], machines: { harvester: [1], seeder: [1] } })
    const chip = estateBottleneck(clear)
    expect(chip.label).toBe('✓ Land — next plot')
    expect(chip.fix).toBe(`＋ Plot 💰${ghostRowPrice(clear)} · now`)
    const gap = { ...clear, run: { ...clear.run, cash: 1 } }
    expect(estateBottleneck(gap).fix).toMatch(new RegExp(`^＋ Plot 💰${ghostRowPrice(clear)} · ≈~\\d+ (min|h)$`))
  })
})
