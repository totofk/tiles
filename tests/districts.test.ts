import { describe, expect, it } from 'vitest'
import { buyLicense, buySeeds, plant } from '../src/core/actions'
import { cropSeedCost, cropSellPrice, licenseCost } from '../src/core/balance'
import { CROP_IDS, type CropId } from '../src/core/data/crops'
import { DISTRICT_HINT, DISTRICT_IDS, DISTRICT_SELLS, districtSells, type DistrictId } from '../src/core/data/districts'
import { buyMineLicense } from '../src/core/mining'
import { noMine } from '../src/core/wetlands'
import { estateCropIncomePerHour } from '../src/app/estateText'
import { marketCropPrice } from '../src/core/market'
import { cropOrderPrice, orderPool } from '../src/core/orders'
import { createInitialState, type GameState } from '../src/core/state'

const on = (district: DistrictId, run: Partial<GameState['run']> = {}): GameState => {
  const s = createInitialState()
  return { ...s, run: { ...s.run, listing: { district, soil: null }, ...run } }
}

describe('batch 36.2: district supply lists', () => {
  it('districtSells matches the lists: plain all 10, wetlands 9, orchard 8, iron 7, the cheap 5 everywhere', () => {
    expect(DISTRICT_SELLS.plain).toEqual(CROP_IDS)
    expect(DISTRICT_SELLS.wetlands).toEqual(['potato', 'radish', 'corn', 'eggplant', 'pumpkin', 'tomato', 'lemon', 'grape', 'strawberry'])
    expect(DISTRICT_SELLS.orchardValley).toEqual(['potato', 'radish', 'corn', 'eggplant', 'pumpkin', 'lemon', 'grape', 'strawberry'])
    expect(DISTRICT_SELLS.ironHills).toEqual(['potato', 'radish', 'corn', 'eggplant', 'pumpkin', 'tomato', 'chilli'])
    for (const d of DISTRICT_IDS) for (const c of ['potato', 'radish', 'corn', 'eggplant', 'pumpkin'] as CropId[]) expect(districtSells(d, c)).toBe(true)
    expect(districtSells('orchardValley', 'chilli')).toBe(false)
    expect(districtSells('ironHills', 'lemon')).toBe(false)
  })

  it('buyLicense: ALREADY_OWNED, NOT_SOLD_HERE, NO_CASH; tomato on Orchard is not sold, lemon is', () => {
    const rich = on('orchardValley', { cash: 1_000_000 })
    expect(buyLicense(rich, 'tomato')).toEqual({ ok: false, error: 'NOT_SOLD_HERE' })
    expect(buyLicense({ ...rich, run: { ...rich.run, licenses: [...rich.run.licenses, 'tomato'] } }, 'tomato')).toEqual({ ok: false, error: 'ALREADY_OWNED' })
    expect(buyLicense(on('orchardValley', { cash: 0 }), 'tomato')).toEqual({ ok: false, error: 'NOT_SOLD_HERE' })
    expect(buyLicense(on('orchardValley', { cash: 0 }), 'lemon')).toEqual({ ok: false, error: 'NO_CASH' })
    const bought = buyLicense(rich, 'lemon')
    expect(bought.ok && bought.state.run.cash).toBe(1_000_000 - licenseCost('lemon', rich.meta))
    expect(buyLicense(on('ironHills', { cash: 1_000_000 }), 'lemon')).toEqual({ ok: false, error: 'NOT_SOLD_HERE' })
    expect(buyLicense(on('wetlands', { cash: 1_000_000 }), 'lemon').ok).toBe(true)
  })

  it('an owned unlisted licence still plants, buys seeds and joins the order pool', () => {
    const s = on('orchardValley', { cash: 1000, licenses: ['potato', 'chilli'] })
    const tiles = s.run.tiles.map((t, i) => (i === 0 ? { ...t, status: 'tilled' as const } : t))
    expect(plant({ ...s, run: { ...s.run, tiles, autoBuySeeds: true } }, 0, 'chilli').ok).toBe(true)
    const seeds = buySeeds(s, 'chilli', 1)
    expect(seeds.ok && seeds.state.run.cash).toBe(1000 - cropSeedCost('chilli', s.meta))
    expect(orderPool(s.run)).toContain('chilli')
  })
})

describe('batch 36.2: Orchard berries sell ×1.4', () => {
  const meta = createInitialState().meta

  it('cropSellPrice with no district = today; Orchard berries ×1.4, other crops and districts ×1', () => {
    for (const c of CROP_IDS) {
      expect(cropSellPrice(c, meta, 0, 'plain')).toBe(cropSellPrice(c, meta, 0))
      expect(cropSellPrice(c, meta, 0, 'ironHills')).toBe(cropSellPrice(c, meta, 0))
      expect(cropSellPrice(c, meta, 0, 'wetlands')).toBe(cropSellPrice(c, meta, 0, 'orchardValley'))
    }
    expect(cropSellPrice('strawberry', meta, 0, 'orchardValley')).toBe(Math.round(cropSellPrice('strawberry', meta, 0) * 1.4))
    expect(cropSellPrice('chilli', meta, 0, 'orchardValley')).toBe(cropSellPrice('chilli', meta, 0))
  })

  it('strawberry: market sale, order price and the Estate text ×1.4 on Orchard, ×1 on plain / Iron Hills', () => {
    const field = { pivot: true, crop: 'strawberry' as CropId, pinned: false, plots: [{ crop: 'strawberry' as CropId, readyTick: 999_999 }] }
    const at = (d: DistrictId) => {
      const s = on(d, { licenses: ['strawberry'] })
      return { ...s, run: { ...s.run, fields: { ...s.run.fields, unlocked: true, list: [field] } } }
    }
    const plain = at('plain')
    const orchard = at('orchardValley')
    expect(marketCropPrice(orchard, 'strawberry', 0)).toBe(Math.round(marketCropPrice(plain, 'strawberry', 0) * 1.4))
    expect(cropOrderPrice(orchard, 'strawberry')).toBeGreaterThan(cropOrderPrice(plain, 'strawberry') * 1.39)
    expect(estateCropIncomePerHour(orchard, 0)).toBeGreaterThan(estateCropIncomePerHour(plain, 0) * 1.4)
    for (const d of ['ironHills'] as DistrictId[]) {
      expect(marketCropPrice(at(d), 'strawberry', 0)).toBe(marketCropPrice(plain, 'strawberry', 0))
      expect(cropOrderPrice(at(d), 'strawberry')).toBe(cropOrderPrice(plain, 'strawberry'))
      expect(estateCropIncomePerHour(at(d), 0)).toBe(estateCropIncomePerHour(plain, 0))
    }
  })
})

describe('batch 36.3: Wetlands framework', () => {
  it('sells 9 (no chilli): buyLicense chilli → NOT_SOLD_HERE; an owned chilli licence still plants', () => {
    expect(buyLicense(on('wetlands', { cash: 1_000_000 }), 'chilli')).toEqual({ ok: false, error: 'NOT_SOLD_HERE' })
    expect(buyLicense(on('wetlands', { cash: 1_000_000 }), 'tomato').ok).toBe(true)
    const s = on('wetlands', { cash: 1000, licenses: ['potato', 'chilli'], autoBuySeeds: true })
    const tiles = s.run.tiles.map((t, i) => (i === 0 ? { ...t, status: 'tilled' as const } : t))
    expect(plant({ ...s, run: { ...s.run, tiles } }, 0, 'chilli').ok).toBe(true)
  })

  it('strawberry sells ×1.4 on Wetlands: market sale and order price; chilli ×1', () => {
    const at = (d: DistrictId) => on(d, { licenses: ['strawberry'] })
    expect(marketCropPrice(at('wetlands'), 'strawberry', 0)).toBe(marketCropPrice(at('orchardValley'), 'strawberry', 0))
    expect(marketCropPrice(at('wetlands'), 'strawberry', 0)).toBe(Math.round(marketCropPrice(at('plain'), 'strawberry', 0) * 1.4))
    expect(cropOrderPrice(at('wetlands'), 'strawberry')).toBe(cropOrderPrice(at('orchardValley'), 'strawberry'))
    expect(cropSellPrice('chilli', createInitialState().meta, 0, 'wetlands')).toBe(cropSellPrice('chilli', createInitialState().meta, 0))
  })

  it('noMine: true on a fresh Wetlands run, false on plain and on a Wetlands run that owns the licence', () => {
    expect(noMine(on('wetlands').run)).toBe(true)
    expect(noMine(on('plain').run)).toBe(false)
    expect(noMine(on('orchardValley').run)).toBe(false)
    expect(noMine(on('wetlands', { mineLicense: true }).run)).toBe(false)
  })

  it('buyMineLicense: ALREADY_OWNED, then LOCKED on Wetlands, then NO_CASH; plain unchanged', () => {
    expect(buyMineLicense(on('wetlands', { cash: 1_000_000 }))).toEqual({ ok: false, error: 'LOCKED' })
    expect(buyMineLicense(on('wetlands', { cash: 0 }))).toEqual({ ok: false, error: 'LOCKED' })
    expect(buyMineLicense(on('wetlands', { mineLicense: true }))).toEqual({ ok: false, error: 'ALREADY_OWNED' })
    expect(buyMineLicense(on('plain', { cash: 1_000_000 })).ok).toBe(true)
    expect(buyMineLicense(on('plain', { cash: 0 }))).toEqual({ ok: false, error: 'NO_CASH' })
  })

  it('the Wetlands Next farm hint', () => {
    expect(DISTRICT_HINT.wetlands).toBe('sells 9 of 10 crops · berries ×1.4 · 🌊 river beds, no mine')
    expect([...DISTRICT_HINT.wetlands!].length).toBe(58)
  })
})
