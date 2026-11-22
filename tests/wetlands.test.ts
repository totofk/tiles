import { describe, expect, it } from 'vitest'
import { water } from '../src/core/actions'
import { BARGE_ITEMS, TANK_UNITS_PER_COAL, cropGrowTicks, waterMoisture, type BargeItemId } from '../src/core/balance'
import type { DistrictId } from '../src/core/data/districts'
import { WORKER_JOBS, type WorkerJob } from '../src/core/data/workers'
import { buyPump, fieldsGates, unlockFields } from '../src/core/fields'
import { buildFurnace } from '../src/core/furnace'
import { buyMineLicense, buyStorage, craftPickaxe, dig, upgradeVein } from '../src/core/mining'
import { buyOrderBoard, orderPool } from '../src/core/orders'
import { createInitialState, createTile, type GameState } from '../src/core/state'
import { step } from '../src/core/step'
import { buyToolTier } from '../src/core/tools'
import { buyCertificate, certificateUnlocked } from '../src/core/workers'
import { buyBarge } from '../src/core/wetlands'
import { buildSprinkler, buildWorkshop, isIrrigated } from '../src/core/workshop'

const on = (district: DistrictId, run: Partial<GameState['run']> = {}): GameState => {
  const s = createInitialState()
  return { ...s, run: { ...s.run, listing: { district, soil: null }, ...run } }
}
/** plenty of every barge good, cash and room */
const STOCK = { copperBar: 500, ironBar: 500, goldBar: 500, stone: 5000, coal: 500 }
const funded = (district: DistrictId, run: Partial<GameState['run']> = {}) => on(district, { cash: 1e9, bagCapacity: 1e5, inventory: { ...STOCK }, ...run })
const ok = (r: { ok: true; state: GameState } | { ok: false; error: string }): GameState => {
  if (!r.ok) throw new Error(r.error)
  return r.state
}
const NO_WORKERS = Object.fromEntries(WORKER_JOBS.map((j) => [j, 0])) as Record<WorkerJob, number>
const U = TANK_UNITS_PER_COAL
/** Fields unlocked with one pivoted field of one plot */
const withFields = (s: GameState, tank: number, plot = { crop: null as null | 'potato', readyTick: 0 }): GameState => ({
  ...s,
  run: { ...s.run, fields: { ...s.run.fields, unlocked: true, tank, list: [{ pivot: true, crop: null, pinned: false, plots: [plot] }] } },
})

describe('batch 36.3: PIN36k no-soft-lock gates (core)', () => {
  it('the mine is closed on a fresh Wetlands run: licence LOCKED, dig / pickaxe / vein need it, furnace and workshop LOCKED', () => {
    const s = funded('wetlands')
    expect(buyMineLicense(s)).toEqual({ ok: false, error: 'LOCKED' })
    expect(dig(s)).toEqual({ ok: false, error: 'NO_MINE_LICENSE' })
    expect(craftPickaxe(s)).toEqual({ ok: false, error: 'NO_MINE_LICENSE' })
    expect(upgradeVein(s)).toEqual({ ok: false, error: 'NO_MINE_LICENSE' })
    expect(buildFurnace(s)).toEqual({ ok: false, error: 'LOCKED' })
    expect(buildWorkshop(s)).toEqual({ ok: false, error: 'LOCKED' })
  })

  it('storage Lv1 … Lv10 buy with no licence on a no-mine run; plain still needs the licence', () => {
    let s = funded('wetlands')
    for (let lv = 1; lv <= 10; lv++) {
      s = ok(buyStorage(s))
      expect(s.run.storageLevel).toBe(lv)
    }
    expect(buyStorage(funded('plain'))).toEqual({ ok: false, error: 'NO_MINE_LICENSE' })
    expect(buyStorage(funded('orchardValley'))).toEqual({ ok: false, error: 'NO_MINE_LICENSE' })
  })

  it('bank beds 0–1 (tiles 0–11) are irrigated on every Wetlands run, bed 2 and plain / Orchard / Iron Hills are not', () => {
    const tiles = Array.from({ length: 19 }, createTile)
    for (const run of [on('wetlands', { tiles }).run, on('wetlands', { tiles, mineLicense: true }).run]) {
      expect(tiles.map((_, i) => isIrrigated(run, i))).toEqual(tiles.map((_, i) => i < 12))
    }
    for (const d of ['plain', 'orchardValley', 'ironHills'] as DistrictId[]) expect(tiles.some((_, i) => isIrrigated(on(d, { tiles }).run, i))).toBe(false)
  })

  it('bank-bed tiles never dry through step and water says IRRIGATED there; bed 2 still drains', () => {
    const planted = { status: 'planted' as const, cropId: 'pumpkin' as const, growth: 0, moisture: 1, ticksSinceMature: 0 }
    const s = on('wetlands', { tiles: Array.from({ length: 13 }, () => ({ ...planted })), energy: 100 })
    const after = step(s, 120)
    expect(after.run.tiles[0].moisture).toBe(waterMoisture(2))
    expect(after.run.tiles[11].moisture).toBe(waterMoisture(2))
    expect(after.run.tiles[12].moisture).toBeLessThan(1)
    expect(water(s, 0)).toEqual({ ok: false, error: 'IRRIGATED' })
    expect(water(s, 12).ok).toBe(true)
    expect(water(on('plain', { tiles: s.run.tiles, energy: 100 }), 0).ok).toBe(true)
  })

  it('a sprinkler socket on a bank bed is LOCKED (grandfathered run with a workshop); bed 2 builds', () => {
    const tiles = Array.from({ length: 13 }, createTile)
    const s = funded('wetlands', { tiles, mineLicense: true, workshop: { ...createInitialState().run.workshop, built: true } })
    expect(buildSprinkler(s, 0)).toEqual({ ok: false, error: 'LOCKED' })
    expect(buildSprinkler(s, 1)).toEqual({ ok: false, error: 'LOCKED' })
    expect(buildSprinkler(s, 2).ok).toBe(true)
    expect(buildSprinkler({ ...s, run: { ...s.run, listing: { district: 'plain', soil: null } } }, 0).ok).toBe(true)
  })

  it('the Fields water gate is true with no workshop on Wetlands; unlockFields with the planter + harvester certificates', () => {
    expect(fieldsGates(on('wetlands').run).water).toBe(true)
    expect(fieldsGates(on('plain').run).water).toBe(false)
    const certs = { ...createInitialState().run.workers, certificates: ['plant', 'harvest'] as WorkerJob[] }
    const opened = ok(unlockFields(funded('wetlands', { workers: certs })))
    expect(opened.run.fields.unlocked).toBe(true)
    expect(unlockFields(funded('plain', { workers: certs }))).toEqual({ ok: false, error: 'LOCKED' })
  })

  it('pump tiers 1–4 (pump 0 → 3) with no workshop on Wetlands; plain still needs the workshop', () => {
    let s = withFields(funded('wetlands'), 0)
    for (let p = 1; p <= 3; p++) {
      s = ok(buyPump(s))
      expect(s.run.fields.pump).toBe(p)
    }
    expect(buyPump(s)).toEqual({ ok: false, error: 'MAX_LEVEL' })
    expect(buyPump(withFields(funded('plain'), 0))).toEqual({ ok: false, error: 'NO_WORKSHOP' })
  })

  it('the fuel certificate unlocks exactly at the Fields unlock on a no-mine run; plain and grandfathered keep the bars gate', () => {
    const s = on('wetlands')
    expect(certificateUnlocked(s.run, 'fuel')).toBe(false)
    expect(certificateUnlocked(withFields(s, 0).run, 'fuel')).toBe(true)
    expect(certificateUnlocked(withFields(on('plain'), 0).run, 'fuel')).toBe(false)
    expect(certificateUnlocked(withFields(on('wetlands', { mineLicense: true }), 0).run, 'fuel')).toBe(false)
  })

  const loader = (s: GameState, tank: number, coal: number, cash: number) =>
    withFields({ ...s, run: { ...s.run, tick: 5, cash, inventory: { coal }, workers: { pool: 1, assigned: { ...NO_WORKERS, fuel: 1 }, certificates: ['fuel'] } } }, tank)

  it('the tank hand with no coal stored buys one barge coal (💰5) into the tank; with coal it loads stored coal; no cash → idle', () => {
    const bought = step(loader(on('wetlands'), 0, 0, 100), 1)
    // 💰5 coal + 💰1 wage; one unit burns for the field's empty plot (valve off)
    expect([bought.run.cash, bought.run.fields.tank, bought.run.inventory.coal ?? 0, bought.run.lifetime.wagesPaid]).toEqual([94, U - 1, 0, 1])
    const stored = step(loader(on('wetlands'), 0, 3, 100), 1)
    expect([stored.run.cash, stored.run.fields.tank, stored.run.inventory.coal]).toEqual([99, U - 1, 2])
    const broke = step(loader(on('wetlands'), 0, 0, 5), 1)
    expect([broke.run.cash, broke.run.fields.tank, broke.run.lifetime.wagesPaid]).toEqual([5, 0, 0])
    const plain = step(loader(on('plain'), 0, 0, 100), 1)
    expect([plain.run.cash, plain.run.fields.tank]).toEqual([100, 0])
    const grandfathered = step(loader(on('wetlands', { mineLicense: true }), 0, 0, 100), 1)
    expect([grandfathered.run.cash, grandfathered.run.fields.tank]).toEqual([100, 0])
  })

  it('an empty tank with no coal: a sown plot still ripens (×1, never stalls)', () => {
    const grow = cropGrowTicks('potato', createInitialState().meta, 0)
    const s = withFields(on('wetlands', { tick: 0 }), 0, { crop: 'potato', readyTick: grow })
    const after = step(s, 2 * grow + 2)
    expect(after.run.fields.list[0].plots[0].readyTick).toBeLessThanOrEqual(after.run.tick)
  })

  it('orderPool on a no-mine run is the licences only', () => {
    const s = on('wetlands', { licenses: ['potato', 'radish', 'tomato'] })
    expect(orderPool(s.run)).toEqual(['potato', 'radish', 'tomato'])
  })

  it('buyBarge: ×1 / ×10 of every good at its price; LOCKED on plain / Orchard / Iron Hills; BAD_AMOUNT; BAG_FULL; NO_CASH', () => {
    const prices = { copperBar: 125, ironBar: 625, goldBar: 1250, stone: 3, coal: 5 }
    for (const item of BARGE_ITEMS) {
      const s = on('wetlands', { cash: 20_000 })
      const one = ok(buyBarge(s, item, 1))
      expect([one.run.cash, one.run.inventory[item]]).toEqual([20_000 - prices[item], 1])
      const ten = ok(buyBarge(one, item, 10))
      expect([ten.run.cash, ten.run.inventory[item]]).toEqual([20_000 - 11 * prices[item], 11])
      expect([ten.run.energy, ten.run.counters, ten.run.rngState]).toEqual([s.run.energy, s.run.counters, s.run.rngState])
      for (const d of ['plain', 'orchardValley', 'ironHills'] as DistrictId[]) expect(buyBarge(on(d, { cash: 20_000 }), item, 1)).toEqual({ ok: false, error: 'LOCKED' })
    }
    expect(buyBarge(on('wetlands', { cash: 100 }), 'wood' as BargeItemId, 1)).toEqual({ ok: false, error: 'LOCKED' })
    expect(buyBarge(on('wetlands', { cash: 100 }), 'coal', 0)).toEqual({ ok: false, error: 'BAD_AMOUNT' })
    expect(buyBarge(on('wetlands', { cash: 100 }), 'coal', 1.5)).toEqual({ ok: false, error: 'BAD_AMOUNT' })
    expect(buyBarge(on('wetlands', { cash: 1e6, inventory: { stone: 15 } }), 'coal', 6)).toEqual({ ok: false, error: 'BAG_FULL' })
    expect(buyBarge(on('wetlands', { cash: 1e6, inventory: { stone: 15 } }), 'coal', 5).ok).toBe(true)
    expect(buyBarge(on('wetlands', { cash: 49 }), 'coal', 10)).toEqual({ ok: false, error: 'NO_CASH' })
  })

  it('barge-bought goods pay storage Lv1 … Lv10, the Noticeboard, every farm certificate, the clerk, the three tool tiers and the Manager', () => {
    const counters = { harvests: 999, sales: 999, mines: 0, digs: 0, waters: 999, plants: 999, bars: 0, orders: 999, contractsByHand: 999 }
    let s = on('wetlands', { cash: 1e9, stars: 1000, counters, tools: { plant: 3, water: 3, harvest: 3 } })
    /** buys exactly what `need` lacks at the barge, then runs the purchase */
    const viaBarge = (need: Partial<Record<BargeItemId, number>>, buy: (s: GameState) => ReturnType<typeof buyStorage>) => {
      for (const [item, n] of Object.entries(need) as [BargeItemId, number][]) {
        const short = n - (s.run.inventory[item] ?? 0)
        if (short > 0) s = ok(buyBarge(s, item, short))
      }
      s = ok(buy(s))
    }
    for (let lv = 0; lv < 10; lv++) viaBarge({ stone: 15 + 5 * lv }, buyStorage)
    expect(s.run.storageLevel).toBe(10)
    viaBarge({ stone: 10 }, buyOrderBoard)
    viaBarge({ stone: 20 }, (x) => buyCertificate(x, 'water'))
    viaBarge({ stone: 20, coal: 5 }, (x) => buyCertificate(x, 'harvest'))
    viaBarge({ copperBar: 10 }, (x) => buyCertificate(x, 'plant'))
    viaBarge({ copperBar: 6 }, (x) => buyCertificate(x, 'clerk'))
    viaBarge({ goldBar: 4 }, (x) => buyCertificate(x, 'manager'))
    for (const job of ['plant', 'water', 'harvest'] as const) viaBarge({ copperBar: 4 }, (x) => buyToolTier(x, job))
    for (const job of ['plant', 'water', 'harvest'] as const) viaBarge({ ironBar: 4 }, (x) => buyToolTier(x, job))
    for (const job of ['plant', 'harvest'] as const) viaBarge({ goldBar: 4 }, (x) => buyToolTier(x, job))
    viaBarge({ ironBar: 10 }, unlockFields)
    expect(s.run.orders.unlocked).toBe(true)
    expect([...s.run.workers.certificates].sort()).toEqual(['clerk', 'harvest', 'manager', 'plant', 'water'])
    expect(s.run.toolTier).toEqual({ plant: 3, water: 2, harvest: 3 })
    expect(s.run.fields.unlocked).toBe(true)
    // the fuel certificate opens with the Fields and is paid with barge copper bars
    expect(certificateUnlocked(s.run, 'fuel')).toBe(true)
    viaBarge({ copperBar: 8 }, (x) => buyCertificate(x, 'fuel'))
    expect(s.run.workers.certificates).toContain('fuel')
  })

  it('grandfathered: a Wetlands run that owns the mine licence crafts, digs and builds the furnace as today', () => {
    let s = funded('wetlands', { mineLicense: true, energy: 100 })
    s = ok(craftPickaxe({ ...s, run: { ...s.run, inventory: { ...s.run.inventory, wood: 100 } } }))
    expect(dig(s).ok).toBe(true)
    expect(buyStorage(s).ok).toBe(true)
    expect(buildFurnace({ ...s, run: { ...s.run, vein: { ...s.run.vein, level: 1 } } }).ok).toBe(true)
  })
})
