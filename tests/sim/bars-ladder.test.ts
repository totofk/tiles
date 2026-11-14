import { describe, expect, it, vi } from 'vitest'
import { buyLicense, digForSeeds } from '../../src/core/actions'
import { ORE_IDS, type OreId } from '../../src/core/data/items'
import {
  ACTION_ENERGY_COST,
  OFFLINE_CAP_TICKS,
  barTicks,
  fireCapTicks,
  cropSellPrice,
  sellPrice,
  itemSellPrice,
  batchBars,
  smeltOre,
  plotTiles,
} from '../../src/core/balance'
import { catchUp, deserialize } from '../../src/save/serialize'
import v25 from '../fixtures/save-v25.json?raw'
import v26 from '../fixtures/save-v26.json?raw'
import { bagCount, repairPickaxe, sellItem } from '../../src/core/mining'
import { createFurnace, createInitialState, type GameState } from '../../src/core/state'
import { step } from '../../src/core/step'
import { isOffer } from '../../src/core/orders'
import type { ItemId } from '../../src/core/data/items'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { simLogPath } from '../simLog'
import {
  HOUR_TICKS,
  LICENSE_ORDER,
  PLANT_ORDER,
  bestFarmAction,
  lowestValue,
  runBot,
} from './bot'

vi.mock('../../src/core/balance', async (importOriginal) => (await import('./balanceMock')).balanceMock(importOriginal))

function barsBench({ miners = 1, vein = 4, sellPrice = 5, levels = {}, hours = 2 }: { miners?: number; vein?: number; sellPrice?: number; levels?: Partial<GameState['run']['furnace']['levels']>; hours?: number } = {}) {
  const loaded = deserialize(v25)!.state
  const r = loaded.run
  const start: GameState = {
    ...loaded,
    run: {
      ...r,
      vein: { ...r.vein, level: vein },
      upgrades: { ...r.upgrades, sellPrice },
      favours: { ...r.favours, bunkhouse: miners },
      furnace: { ...r.furnace, levels: { ...r.furnace.levels, batch: 4, speed: 2, tray: 2, slot: 2, ...levels } },
      workers: { ...r.workers, pool: r.workers.pool + miners, assigned: { ...r.workers.assigned, mine: miners } },
    },
  }
  let s = start
  const sold = { bars: 0, junk: 0 }
  const sell = (id: ItemId, n: number, into: 'bars' | 'junk') => {
    const r = n > 0 ? sellItem(s, id, n) : null
    if (r?.ok) {
      sold[into] += r.state.run.cash - s.run.cash
      s = r.state
    }
  }
  for (let t = 0; t < hours * HOUR_TICKS; t++) {
    if (s.run.rack.gold === 0) {
      const fixed = repairPickaxe(s, 'gold')
      if (fixed.ok) s = fixed.state
    }
    if (bagCount(s.run) >= s.run.bagCapacity) {
      for (const bar of ['copperBar', 'ironBar'] as const) sell(bar, s.run.inventory[bar] ?? 0, 'bars')
      sell('goldBar', (s.run.inventory.goldBar ?? 0) - 2, 'bars')
      sell('stone', s.run.inventory.stone ?? 0, 'junk')
      sell('coal', (s.run.inventory.coal ?? 0) - 20, 'junk')
    }
    s = step(s, 1)
  }
  const KINDS = [
    ['copper', 'copperOre', 'barsSmelted', 'copperBar'],
    ['iron', 'ironOre', 'ironBarsSmelted', 'ironBar'],
    ['gold', 'goldOre', 'goldBarsSmelted', 'goldBar'],
  ] as const
  const ore = (g: GameState, k: OreId) => (g.run.inventory[k] ?? 0) + (g.run.furnace.molds[k]?.ore ?? 0)
  const per = (n: number) => Math.round(n / hours)
  const bars = Object.fromEntries(KINDS.map(([name, , smelted]) => [name, per(s.run.lifetime[smelted] - start.run.lifetime[smelted])]))
  const oreMined = Object.fromEntries(
    KINDS.map(([name, k, smelted]) => [name, per(ore(s, k) - ore(start, k) + smeltOre() * (s.run.lifetime[smelted] - start.run.lifetime[smelted]))]),
  )
  const barValuePerHour = KINDS.reduce((sum, [name, , , bar]) => sum + bars[name]! * itemSellPrice(bar, s.meta, sellPrice), 0)
  return {
    oreMined,
    bars,
    barValuePerHour,
    barSalesPerHour: per(sold.bars),
    junkPerHour: per(sold.junk),
    farmPerHour: per(s.run.lifetime.cashEarned - start.run.lifetime.cashEarned - sold.bars - sold.junk),
    end: s,
  }
}

describe('batch 34: scenario B — the real v25 save, migrated, 2 game-hours with its own workers (report)', () => {
  it('reports ⭐/h and 💰/h; its three migrated offers pay ⭐4 / ⭐1 / ⭐1', () => {
    const start = deserialize(v25)!.state
    const s = step(start, 2 * HOUR_TICKS)
    const offers = start.run.orders.offers.map((o) => (isOffer(o) ? o.stars : null))
    console.log('PIN34b', JSON.stringify({ starsPerHour: (s.run.lifetime.starsEarned - start.run.lifetime.starsEarned) / 2, cashEarnedPerHour: Math.round((s.run.lifetime.cashEarned - start.run.lifetime.cashEarned) / 2), offers, stars: s.run.stars }))
    expect(offers).toEqual([4, 1, 1])
  }, 120_000)
})

describe('batch 34: PIN34bars — one miner at vein Lv4 with the bar ladder at its top, sell Lv5, 2 game-hours (report)', () => {
  it('ore/h and bars/h per kind and 💰/h from bars, measured ÷ calculator (270 / 225 / 180 ore/h, 💰239,625/h)', () => {
    const b = barsBench()
    const calc = { ore: { copper: 270, iron: 225, gold: 180 }, cash: 239_625 }
    console.log('PIN34bars', JSON.stringify({
      oreMined: b.oreMined,
      bars: b.bars,
      barValuePerHour: b.barValuePerHour,
      barSalesPerHour: b.barSalesPerHour,
      ratio: {
        ore: Object.fromEntries(Object.entries(calc.ore).map(([k, v]) => [k, Math.round((b.oreMined[k]! / v) * 100) / 100])),
        cash: Math.round((b.barValuePerHour / calc.cash) * 100) / 100,
      },
      rack: b.end.run.rack,
    }))
    expect(b.barValuePerHour).toBeGreaterThan(0)
  }, 300_000)
})

describe('batch 34: PIN34furnaceStars — two miners: the bar top vs ⭐ speed Lv3 vs ⭐ batch 6 + speed Lv3 (report)', () => {
  it('bars/h per setup (calculator: +8 % at speed Lv3 for 2 miners, no mastered tier past wooden)', () => {
    const top = barsBench({ miners: 2 })
    const speed3 = barsBench({ miners: 2, levels: { speed: 3 } })
    const both = barsBench({ miners: 2, levels: { speed: 3, batch: 5 } })
    const total = (b: ReturnType<typeof barsBench>) => Object.values(b.bars).reduce((a, n) => a + n, 0)
    console.log('PIN34furnaceStars', JSON.stringify({
      barsPerHour: { top: top.bars, speed3: speed3.bars, batch6speed3: both.bars },
      barValuePerHour: { top: top.barValuePerHour, speed3: speed3.barValuePerHour, batch6speed3: both.barValuePerHour },
      gain: { speed3: Math.round((speed3.barValuePerHour / top.barValuePerHour - 1) * 1000) / 10, batch6speed3: Math.round((both.barValuePerHour / top.barValuePerHour - 1) * 1000) / 10 },
      oreMined: top.oreMined,
      totals: [total(top), total(speed3), total(both)],
    }))
    expect(total(top)).toBeGreaterThan(0)
  }, 600_000)
})

describe('batch 34: PIN34stoker — 2× fire per bar, and never more fire than the cap offline (guard)', () => {
  const init = createInitialState()
  const empty = { ore: 0, progress: 0, ready: 0 }
  const forge = (stokers: number, cash: number, run: Partial<GameState['run']> = {}): GameState => ({
    ...init,
    run: {
      ...init.run,
      cash,
      bagCapacity: 1e7,
      inventory: { copperOre: 1e5, ironOre: 1e5, goldOre: 1e5, coal: 1e5 },
      furnace: { ...createFurnace(), built: true, smart: true, fire: fireCapTicks(4), levels: { fireCap: 4, batch: 4, speed: 2, tray: 2, slot: 2 }, molds: { copperOre: empty, ironOre: empty, goldOre: empty } },
      workers: { pool: 3, assigned: { ...init.run.workers.assigned, ore: 1, fuel: 1, stoker: stokers }, certificates: ['ore', 'fuel', 'stoker'] },
      ...run,
    },
  })
  /** fire burnt per tick of cycle progress done (bars × the kind's barTicks + the progress change) */
  const firePerProgress = (a: GameState, b: GameState) => {
    const done = ORE_IDS.reduce((sum, k) => {
      const smelted = { copperOre: 'barsSmelted', ironOre: 'ironBarsSmelted', goldOre: 'goldBarsSmelted' } as const
      const cycles = (b.run.lifetime[smelted[k]] - a.run.lifetime[smelted[k]]) / batchBars(4)
      return sum + cycles * barTicks(k) + (b.run.furnace.molds[k]!.progress - a.run.furnace.molds[k]!.progress)
    }, 0)
    return (b.run.lifetime.fireBurnt - a.run.lifetime.fireBurnt) / done
  }

  it('over 1 game-hour a stoked furnace burns exactly 2× the fire per bar of an unstoked one', () => {
    const plain = forge(0, 1e6)
    const stoked = forge(1, 1e6)
    const p = step(plain, HOUR_TICKS)
    const k = step(stoked, HOUR_TICKS)
    const bars = (g: GameState) => g.run.lifetime.barsSmelted + g.run.lifetime.ironBarsSmelted + g.run.lifetime.goldBarsSmelted
    console.log('PIN34stoker', JSON.stringify({ barsPerHour: { plain: bars(p), stoked: bars(k) }, firePerProgress: { plain: firePerProgress(plain, p), stoked: firePerProgress(stoked, k) }, fireBurnt: { plain: p.run.lifetime.fireBurnt, stoked: k.run.lifetime.fireBurnt } }))
    expect(firePerProgress(plain, p)).toBeCloseTo(1, 9)
    expect(firePerProgress(stoked, k)).toBeCloseTo(2, 9)
  }, 120_000)

  it('8 h catch-up from a full fire with the stoker unpaid (cash 0, no fuel in storage) burns at most the fire cap', () => {
    const loaded = { copperOre: { ...empty, ore: 48 }, ironOre: { ...empty, ore: 48 }, goldOre: { ...empty, ore: 48 } }
    const s = forge(1, 0, { inventory: {}, furnace: { ...forge(1, 0).run.furnace, molds: loaded } })
    const after = catchUp(s, 8 * HOUR_TICKS * 1000)
    console.log('PIN34stokerOffline', JSON.stringify({ fireBurnt: after.run.lifetime.fireBurnt, cap: fireCapTicks(4), stoked: after.run.furnace.stoked, wages: after.run.lifetime.wagesPaid }))
    expect(after.run.lifetime.fireBurnt).toBeLessThanOrEqual(fireCapTicks(4))
    expect([after.run.furnace.stoked, after.run.lifetime.wagesPaid, after.run.cash]).toEqual([0, 0, 0])
  }, 120_000)
})

describe('batch 34: cash per system at vein Lv3 and Lv4 (report, not guard)', () => {
  it('the farm\'s and the mine\'s 💰/h side by side (the v25 save, one miner, the bar ladder top, sell Lv5)', () => {
    const rows = [3, 4].map((vein) => {
      const b = barsBench({ vein })
      return { vein, farmPerHour: b.farmPerHour, minePerHour: b.barValuePerHour + b.junkPerHour, barValuePerHour: b.barValuePerHour, junkPerHour: b.junkPerHour }
    })
    console.log('PIN34systems', JSON.stringify(rows))
    expect(rows.every((r) => r.farmPerHour >= 0 && r.minePerHour >= 0)).toBe(true)
  }, 300_000)
})

describe('batch 34: the per-run sim log (task 181)', () => {
  it('SIM_LOG=1 writes one JSON file per ladder run with the diagnosis keys; without it nothing is written', () => {
    const path = simLogPath(expect.getState().currentTestName, 'short')
    rmSync(path, { force: true })
    const run = () => runBot(true, { ticks: HOUR_TICKS, licenses: LICENSE_ORDER, crops: PLANT_ORDER, ladder: true, log: 'short' })
    try {
      vi.stubEnv('SIM_LOG', '')
      const off = run()
      expect(existsSync(path)).toBe(false)
      vi.stubEnv('SIM_LOG', '1')
      const on = run()
      // logging only reads state: the run is the same
      expect(on).toEqual(off)
      const file = JSON.parse(readFileSync(path, 'utf8'))
      expect(Object.keys(file)).toEqual(['snapshots', 'attempts', 'furnaceMinutes', 'longestGap'])
      expect(Object.keys(file.snapshots[0])).toEqual(['tick', 'minute', 'events', 'next', 'cash', 'stars', 'held', 'molds', 'fire', 'homePlanted', 'estateSown', 'estatePlots', 'assigned'])
      expect(file.snapshots.some((x: { events: string[] }) => x.events.includes('buy:veinLv1'))).toBe(true)
      expect(file.attempts.some((a: { result: string; gatedBy?: object }) => a.result !== 'ok' && a.gatedBy)).toBe(true)
      expect(Object.keys(file.furnaceMinutes)).toContain('copperOre')
      expect(Object.keys(file.longestGap)).toEqual(['fromTick', 'toTick', 'gapMinutes', 'after', 'closedBy', 'nextWanted', 'gatedByAtStart', 'gatedByAtEnd', 'unlockedUnbought', 'consumedScarce'])
    } finally {
      vi.unstubAllEnvs()
      rmSync(path, { force: true })
    }
  })
})

describe('batch 35: the 10-crop ladder (task 190)', () => {
  // guard (skill rule 7): the 💰20 went on potato seeds that rotted — 💰0, an empty pouch, 9 tilled tiles. Digging
  // (potato seeds) and farming them must reach the carrot licence; reports the game-minutes
  it('scenario A-stingy: 💰0 and no seeds digs potato seeds, plants, harvests and buys the carrot licence', () => {
    const s0 = createInitialState()
    let s: GameState = { ...s0, run: { ...s0.run, cash: 0, seeds: {}, tiles: s0.run.tiles.map((t) => ({ ...t, status: 'tilled' as const })) } }
    const r: { firstDugSeed?: number; firstHarvest?: number; carrot?: number; minLowest: number; digs: number } = { minLowest: 0, digs: 0 }
    for (let t = 0; t < 4 * HOUR_TICKS && r.carrot === undefined; t++) {
      while (s.run.energy >= ACTION_ENERGY_COST && r.carrot === undefined) {
        const licence = buyLicense(s, 'radish')
        if (licence.ok) {
          s = licence.state
          r.carrot = s.run.tick
          break
        }
        const next = bestFarmAction(s, ['potato'])
        if (next) {
          if (next.kind.startsWith('harvest')) r.firstHarvest ??= s.run.tick
          s = next.state
          continue
        }
        const dug = digForSeeds(s)
        if (!dug.ok) break
        r.digs++
        if ((dug.state.run.seeds.potato ?? 0) > 0) r.firstDugSeed ??= s.run.tick
        s = dug.state
      }
      r.minLowest = Math.min(r.minLowest, lowestValue(s))
      s = step(s, 1)
    }
    const min = (x?: number) => (x === undefined ? null : Math.round((x / 60) * 10) / 10)
    console.log('PIN35stingy', JSON.stringify({ firstDugSeedMin: min(r.firstDugSeed), firstHarvestMin: min(r.firstHarvest), carrotLicensedMin: min(r.carrot), digs: r.digs, lowest: r.minLowest }))
    expect(r.firstHarvest).toBeDefined()
    expect(r.carrot).toBeDefined()
    expect(r.minLowest).toBeGreaterThanOrEqual(0)
  }, 120_000)

  it('scenario B: the real v26 save, migrated, 2 game-hours with its own workers (report; batch 34: 💰132,549/h, ⭐0/h)', () => {
    const start = deserialize(v26)!.state
    const { run, meta } = start
    const s = step(start, 2 * HOUR_TICKS)
    // the one-time windfall: planted lemon tiles and chilli plots finish at their new price, not the v26 one (base
    // sell lemon 110 / chilli 25 at 1a961fff), before the market factor
    const lvl = run.upgrades.sellPrice
    const lemonTiles = run.tiles.filter((t) => t.status === 'planted' && t.cropId === 'lemon').length
    const chilliTiles = run.fields.list.reduce((n, f) => n + f.plots.filter((p) => p.crop === 'chilli').length, 0) * plotTiles()
    const windfall = {
      lemonTiles,
      chilliTiles,
      lemon: lemonTiles * (cropSellPrice('lemon', meta, lvl) - sellPrice(110, meta, lvl)),
      chilli: chilliTiles * (cropSellPrice('chilli', meta, lvl) - sellPrice(25, meta, lvl)),
    }
    const cashEarnedPerHour = Math.round((s.run.lifetime.cashEarned - run.lifetime.cashEarned) / 2)
    console.log('PIN35b', JSON.stringify({ cashEarnedPerHour, vsBatch34: Math.round((cashEarnedPerHour / 132_549) * 100) / 100, starsPerHour: (s.run.lifetime.starsEarned - run.lifetime.starsEarned) / 2, windfall }))
    expect(cashEarnedPerHour).toBeGreaterThan(0)
  }, 300_000)

  // guard: task 188's synthetic v26 saves, 8 game-hours of offline catch-up after load, checked every tick
  const v26With = (run: object) => {
    const old = JSON.parse(v26)
    return deserialize(JSON.stringify({ ...old, state: { ...old.state, run: { ...old.state.run, ...run } } }))!.state
  }
  const old = JSON.parse(v26).state.run
  type FieldV26 = { crop: string | null; plots: object[] }
  // as a v26 game could hold them: crop-to-plant and every field chip on a crop the save licenses (setFieldCrop and
  // selectCrop refuse an unlicensed one)
  const chips = (crop: string, list: FieldV26[] = old.fields.list) => ({ ...old.fields, list: list.map((f) => ({ ...f, crop: f.crop && crop })) })
  const cornList = old.fields.list.map((f: FieldV26, i: number) => (i === 3 ? { ...f, plots: f.plots.map((p, j) => (j === 0 ? { crop: 'corn', readyTick: old.tick + 100 } : p)) } : f))
  const saves = {
    fixture: v26With({}),
    allEight: v26With({ licenses: ['radish', 'chilli', 'pumpkin', 'lemon', 'tomato', 'corn', 'grape', 'strawberry'] }),
    skipped: v26With({ licenses: ['radish', 'strawberry'], plantCrop: 'radish', fields: chips('radish') }),
    corn: v26With({
      licenses: ['radish', 'corn'],
      plantCrop: 'corn',
      seeds: { corn: 4 },
      tiles: old.tiles.map((t: object, i: number) => (i < 3 ? { ...t, cropId: 'corn' } : t)),
      fields: chips('corn', cornList),
    }),
    chilliOffer: v26With({ orders: { ...old.orders, offers: [{ good: 'chilli', count: 20, done: 3, tier: 1, accepted: true, stars: 2 }, ...old.orders.offers.slice(1)] } }),
  }
  it('PIN35migrate: no unlicensed sowing, every unlicensed crop harvested, nothing negative, licensed sowing goes on', () => {
    const rows = Object.entries(saves).map(([name, s0]) => {
      const licensed = new Set(s0.run.licenses)
      // a sowing between two ticks: a tile's growth restarts; a plot's readyTick jumps a whole cycle (a growing plot's
      // readyTick slips by at most 1 a tick while its field is short of water — not a sowing)
      const standing = (s: GameState) => [
        ...s.run.tiles.map((t) => (t.status === 'planted' && t.cropId ? { crop: t.cropId, tile: true, v: t.growth } : null)),
        ...s.run.fields.list.flatMap((f) => f.plots.map((p) => (p.crop ? { crop: p.crop, tile: false, v: p.readyTick } : null))),
      ]
      const unlicensed = (s: GameState) => standing(s).filter((x) => x && !licensed.has(x.crop)).length
      const atLoad = unlicensed(s0)
      let s = s0
      let resown = 0
      let lowest = lowestValue(s0)
      let prev = standing(s)
      for (let t = 0; t < OFFLINE_CAP_TICKS; t++) {
        s = step(s, 1)
        const cur = standing(s)
        cur.forEach((x, i) => {
          const p = prev[i]
          if (x && !licensed.has(x.crop) && (!p || p.crop !== x.crop || (x.tile ? x.v < p.v : x.v - p.v > 1))) resown++
        })
        prev = cur
        lowest = Math.min(lowest, lowestValue(s))
      }
      const plants = s.run.lifetime.workerPlants - s0.run.lifetime.workerPlants
      return { name, atLoad, leftAfter8h: unlicensed(s), resown, lowest, workerPlants: plants, licensedStanding: standing(s).filter((x) => x && licensed.has(x.crop)).length }
    })
    console.log('PIN35migrate', JSON.stringify(rows))
    for (const r of rows) {
      expect(r.atLoad).toBeGreaterThan(0)
      expect([r.resown, r.leftAfter8h]).toEqual([0, 0])
      expect(r.lowest).toBeGreaterThanOrEqual(0)
      expect(r.workerPlants).toBeGreaterThan(0)
      expect(r.licensedStanding).toBeGreaterThan(0)
    }
  }, 600_000)
})
