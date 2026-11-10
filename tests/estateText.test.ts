import { describe, expect, it } from 'vitest'
import { cropGrowTicks, cropSeedCost, cropSellPrice, fieldTileCost, machineCost, marketFactor, pipeCost, pipeMaxTiers } from '../src/core/balance'
import { CROP_IDS, type CropId } from '../src/core/data/crops'
import { createInitialState, createMachines, type GameState } from '../src/core/state'
import { estateBottleneck, estateCropIncomePerHour, estateIncomePerHour, fleetTilesPerHour, ghostRowPrice, nextReadyText } from '../src/app/estateText'
import { priceText } from '../src/app/Mine'

/** a Tractor-era run forged from a fresh state: `count` tiles, cohorts, machines, coal and cash as each test needs */
function at(over: {
  cohorts?: { crop: CropId; count: number; readyTick: number }[]
  machines?: { harvester?: number[]; seeder?: number[] }
  coal?: number
  cash?: number
  pipes?: number
  plantCrop?: CropId | null
  certificates?: string[]
  count?: number
  licenses?: CropId[]
  inventory?: GameState['run']['inventory']
}): GameState {
  const s = createInitialState()
  const cohorts = over.cohorts ?? []
  return {
    ...s,
    run: {
      ...s.run,
      cash: over.cash ?? 1_000_000,
      licenses: over.licenses ?? ['radish'],
      inventory: { ...s.run.inventory, coal: over.coal ?? 5, copperBar: 99, ironBar: 99, goldBar: 99, ...over.inventory },
      workers: { ...s.run.workers, certificates: (over.certificates ?? ['plant', 'harvest']) as GameState['run']['workers']['certificates'] },
      fields: {
        ...s.run.fields,
        unlocked: true,
        count: over.count ?? 100,
        pipes: over.pipes ?? 1,
        plantCrop: over.plantCrop ?? null,
        cohorts,
        planted: Object.fromEntries(CROP_IDS.map((crop) => [crop, cohorts.reduce((n, c) => (c.crop === crop ? n + c.count : 0), 0)])) as GameState['run']['fields']['planted'],
        machines: { ...createMachines(), harvester: over.machines?.harvester ?? [], seeder: over.machines?.seeder ?? [] },
      },
    },
  }
}

// a growing cohort far from ready, so `growing` is 10 and `ready` 0
const growing = () => [{ crop: 'radish' as CropId, count: 10, readyTick: 999_999 }]
// a ripened cohort: readyTick below any fresh tick
const ripe = () => [{ crop: 'radish' as CropId, count: 10, readyTick: 0 }]

describe('estateText (batch 27, task 143)', () => {
  it('estateCropIncomePerHour: planted × cycles/h × (market-priced sale − seed), rounded — hand arithmetic', () => {
    const state = at({ cohorts: growing() })
    const grow = cropGrowTicks('radish', state.meta, 0)
    const net = cropSellPrice('radish', state.meta, 0) * marketFactor('radish', 0) - cropSeedCost('radish', state.meta)
    expect(estateCropIncomePerHour(state, 'radish')).toBe(Math.round((10 * 3600 * net) / grow))
    expect(estateIncomePerHour(state)).toBe(estateCropIncomePerHour(state, 'radish'))
    // nothing planted: no income from that row
    expect(estateCropIncomePerHour(at({}), 'radish')).toBe(0)
  })

  it('ghostRowPrice: the next ten field tiles together; nextReadyText formats m/h', () => {
    const state = at({ count: 100 })
    expect(ghostRowPrice(state)).toBe(Array.from({ length: 10 }, (_, i) => fieldTileCost(100 + i, state.meta)).reduce((a, b) => a + b, 0))
    expect(nextReadyText(190)).toBe('3m')
    expect(nextReadyText(20)).toBe('1m') // never 0m
    expect(nextReadyText(7200)).toBe('2h')
    expect(fleetTilesPerHour({ ...createMachines(), harvester: [1, 2] }, 'harvester')).toBeGreaterThan(0)
    expect(fleetTilesPerHour(createMachines(), 'seeder')).toBe(0)
  })

  it('bottleneck 1: a dry pump with anything growing — before stalled pipes (first match wins)', () => {
    // pipes 0 would stall all 10 tiles, but the dry pump is checked first
    expect(estateBottleneck(at({ cohorts: growing(), coal: 0, pipes: 0 }))).toEqual({ label: '⚠ Coal — the pump is dry, growth paused', fix: 'mine or buy coal' })
  })

  it('bottleneck 2: stalled tiles → the next Pipes tier with its price and affordability (or max pipes)', () => {
    const chip = estateBottleneck(at({ cohorts: growing(), pipes: 0 })) // pipeCover(0) = 0 → 10 stalled
    expect(chip.label).toBe('⚠ Pipes — 10 tiles wait')
    const price = pipeCost(0, at({}).meta)!
    expect(chip.fix).toBe(`Pipes Lv1 ${priceText(price)} · now`)
    // at the top tier with a whole cohort beyond the 300 coverage (the prefix rule never splits a cohort): no next price
    const stuck = at({ count: 500, pipes: pipeMaxTiers(), cohorts: [{ crop: 'radish' as CropId, count: 400, readyTick: 999_999 }] })
    expect(estateBottleneck(stuck).label).toBe('⚠ Pipes — 400 tiles wait')
    expect(estateBottleneck(stuck).fix).toBe('max pipes')
  })

  it('bottleneck 3: free land, no seeder — pick a crop, or the cheapest Seeder (certificate gate, then price)', () => {
    const base = at({ cohorts: growing() }) // free 90, seeder none
    expect(estateBottleneck(base)).toEqual({ label: '⚠ Sowing — 90 tiles empty', fix: 'pick a crop to Plant' }) // fields.plantCrop null by default
    // crop picked, no plant certificate
    const noCert = { ...base, run: { ...base.run, fields: { ...base.run.fields, plantCrop: 'radish' as CropId }, workers: { ...base.run.workers, certificates: [] as GameState['run']['workers']['certificates'] } } }
    expect(estateBottleneck(noCert).fix).toBe('Seeder Mk1 needs the plant certificate')
    // certificate held, cash rich → affordable now
    expect(estateBottleneck({ ...base, run: { ...base.run, fields: { ...base.run.fields, plantCrop: 'radish' as CropId } } }).fix).toMatch(/^Seeder Mk1 .+ · now$/)
  })

  it('bottleneck 4: ready tiles, no harvester → the cheapest Harvester (bar shortfall beats a time)', () => {
    const base = at({ cohorts: ripe(), machines: { seeder: [1] } }) // ready 10 (readyTick 0 ≤ tick 0), harvester none, sowing fine
    const chip = estateBottleneck(base)
    expect(chip.label).toBe('⚠ Reaping — 10 ready')
    // no iron bars: a bar shortfall is shown, never a time estimate
    const broke = { ...base, run: { ...base.run, inventory: { ...base.run.inventory, ironBar: 0 } } }
    expect(estateBottleneck(broke).fix).toMatch(/^Harvester Mk1 .+ · needs .+ more$/)
    expect(machineCost('harvester', 1, base.meta).ironBar).toBeGreaterThan(0)
  })

  it('bottleneck 5: nothing blocks → the next 10 tiles, affordable now / in cash-gap time', () => {
    const clear = at({ cohorts: growing(), machines: { harvester: [1], seeder: [1] } })
    const chip = estateBottleneck(clear)
    expect(chip.label).toBe('✓ Land — next 10 tiles')
    expect(chip.fix).toBe(`＋10 tiles 💰${ghostRowPrice(clear)} · now`)
    // cash short of the ten tiles but income flowing: the gap ÷ ≈💰/h as ≈~N min/h
    const gap = { ...clear, run: { ...clear.run, cash: 1 } }
    expect(estateBottleneck(gap).fix).toMatch(new RegExp(`^＋10 tiles 💰${ghostRowPrice(clear)} · ≈~\\d+ (min|h)$`))
  })
})
