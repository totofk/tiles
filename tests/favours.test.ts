import { describe, expect, it } from 'vitest'
import { buyUpgrade, type ActionResult } from '../src/core/actions'
import { favourStars, furnaceSpeedRate, growTimeFactor, veinWeights, workerActionTicks } from '../src/core/balance'
import { ORE_IDS, type OreId } from '../src/core/data/items'
import { buyFavour, favourLevel, favourLock, setSeamAim, type FavourId } from '../src/core/favours'
import { buyFurnaceUpgrade } from '../src/core/furnace'
import { createFurnace, createInitialState, type GameState, type RunState } from '../src/core/state'
import { step } from '../src/core/step'
import { assignWorker, hireWorker } from '../src/core/workers'

const init = createInitialState()
const withRun = (run: Partial<RunState>): GameState => ({ ...init, run: { ...init.run, ...run } })
const okState = (r: ActionResult): GameState => {
  if (!r.ok) throw new Error(r.error)
  return r.state
}
/** the bar ladder done: furnace speed Lv2, batch Lv4 (5 bars), tray / slot at `tray` / `slot` */
const furnaceTop = (tray = 2, slot = 2) => ({ ...createFurnace(), built: true, fire: 5000, levels: { fireCap: 4, batch: 4, speed: 2, tray, slot } })

describe('batch 34: ⭐ Favours — prices', () => {
  it('the k-th ⭐ level of every row for k = 0 … 4 is the table (null past a capped row)', () => {
    const rows: [Exclude<FavourId, 'stoker'>, (number | null)[]][] = [
      ['bunkhouse', [15, 24, 38, 61, null]],
      ['mist', [8, 11, 15, 20, 27]],
      ['sell', [10, 14, 20, 27, 38]],
      ['furnaceSpeed', [10, 15, 23, 34, 51]],
      ['furnaceBatch', [15, 23, 34, 51, 76]],
      ['seam', [12, null, null, null, null]],
    ]
    for (const [id, want] of rows) expect([0, 1, 2, 3, 4].map((k) => favourStars(id, k))).toEqual(want)
  })

  it('NO_STARS when ⭐ is short; ⭐ is never scaled by the cost multiplier', () => {
    const s = withRun({ upgrades: { ...init.run.upgrades, sellPrice: 5 }, stars: 9 })
    expect(buyFavour(s, 'sell')).toEqual({ ok: false, error: 'NO_STARS' })
    const bought = okState(buyFavour({ ...s, run: { ...s.run, stars: 10 }, meta: { ...s.meta, upgrades: { ...s.meta.upgrades, cost: 5 } } }, 'sell'))
    expect([bought.run.stars, bought.run.upgrades.sellPrice, bought.run.cash]).toEqual([0, 6, init.run.cash])
  })
})

describe('batch 34: ⭐ Favours — each row', () => {
  it('Bunkhouse: the 7th hire after one level; MAX_LEVEL after 4; buyable at any pool size once hiring is unlocked', () => {
    const counters = { ...init.run.counters, harvests: 30 }
    expect(favourLock(init.run, 'bunkhouse')).toBe('hire')
    const six = withRun({ counters, cash: 1e9, stars: 1000, workers: { ...init.run.workers, pool: 6 } })
    expect(hireWorker(six)).toEqual({ ok: false, error: 'POOL_FULL' })
    expect(buyFavour(withRun({ counters, stars: 15 }), 'bunkhouse').ok).toBe(true)
    let s = okState(buyFavour(six, 'bunkhouse'))
    expect(okState(hireWorker(s)).run.workers.pool).toBe(7)
    for (let i = 1; i < 4; i++) s = okState(buyFavour(s, 'bunkhouse'))
    expect([s.run.favours.bunkhouse, s.run.stars]).toEqual([4, 1000 - 15 - 24 - 38 - 61])
    expect(buyFavour(s, 'bunkhouse')).toEqual({ ok: false, error: 'MAX_LEVEL' })
  })

  it('Fine mist: LOCKED below fertilizer Lv5; at Lv5 + 2 grow time × 0.5 × 0.9025; the cash ladder still says MAX_LEVEL', () => {
    expect(buyFavour(withRun({ stars: 99, upgrades: { ...init.run.upgrades, fertilizer: 4 } }), 'mist')).toEqual({ ok: false, error: 'LOCKED' })
    let s = withRun({ stars: 99, cash: 1e9, upgrades: { ...init.run.upgrades, fertilizer: 5 }, counters: { ...init.run.counters, harvests: 1e6, sales: 1e6 } })
    s = okState(buyFavour(okState(buyFavour(s, 'mist')), 'mist'))
    expect([s.run.upgrades.fertilizer, favourLevel(s.run, 'mist'), s.run.stars]).toEqual([7, 2, 99 - 8 - 11])
    expect(growTimeFactor(7)).toBeCloseTo(0.5 * 0.9025, 12)
    expect(growTimeFactor(5)).toBe(0.5)
    expect(buyUpgrade(s, 'fertilizer')).toEqual({ ok: false, error: 'MAX_LEVEL' })
  })

  it('⭐ Sell price: LOCKED below sell price Lv5', () => {
    expect(buyFavour(withRun({ stars: 99, upgrades: { ...init.run.upgrades, sellPrice: 4 } }), 'sell')).toEqual({ ok: false, error: 'LOCKED' })
  })

  it('furnace ⭐ speed: LOCKED with no furnace or below speed Lv2; Lv3 = rate 1.953125; the bar row stays MAX_LEVEL', () => {
    expect(favourLock(init.run, 'furnaceSpeed')).toBe('furnace')
    const low = withRun({ stars: 99, furnace: { ...furnaceTop(), levels: { ...furnaceTop().levels, speed: 1 } } })
    expect(buyFavour(low, 'furnaceSpeed')).toEqual({ ok: false, error: 'LOCKED' })
    const s = okState(buyFavour(withRun({ stars: 99, furnace: furnaceTop() }), 'furnaceSpeed'))
    expect([s.run.furnace.levels.speed, furnaceSpeedRate(3), s.run.stars]).toEqual([3, 1.953125, 89])
    expect([furnaceSpeedRate(0), furnaceSpeedRate(1), furnaceSpeedRate(2)]).toEqual([1, 1.25, 1.5625])
    expect(buyFurnaceUpgrade(s, 'speed')).toEqual({ ok: false, error: 'MAX_LEVEL' })
  })

  it('⭐ batch 6: LOCKED without tray Lv2 (and batch 7+ without ore slot Lv2); 10 bars is the max', () => {
    expect(favourLock(withRun({ furnace: furnaceTop(1, 1) }).run, 'furnaceBatch')).toBe('tray')
    expect(buyFavour(withRun({ stars: 99, furnace: furnaceTop(1, 1) }), 'furnaceBatch')).toEqual({ ok: false, error: 'LOCKED' })
    let s = okState(buyFavour(withRun({ stars: 999, furnace: furnaceTop(2, 1) }), 'furnaceBatch'))
    expect(s.run.furnace.levels.batch).toBe(5)
    expect(favourLock(s.run, 'furnaceBatch')).toBe('slot')
    s = { ...s, run: { ...s.run, furnace: { ...s.run.furnace, levels: { ...s.run.furnace.levels, slot: 2 } } } }
    for (let i = 0; i < 4; i++) s = okState(buyFavour(s, 'furnaceBatch'))
    expect([s.run.furnace.levels.batch, favourLevel(s.run, 'furnaceBatch')]).toEqual([9, 5])
    expect(buyFavour(s, 'furnaceBatch')).toEqual({ ok: false, error: 'MAX_LEVEL' })
  })

  it('Seam survey: aimed weights for vein Lv3–4 × mastered 0 … 4 × every aim are never negative and sum to the unaimed total', () => {
    const sum = (w: Partial<Record<string, number>>) => Object.values(w).reduce<number>((a, b) => a + (b ?? 0), 0)
    for (const level of [3, 4])
      for (let mastered = 0; mastered <= 4; mastered++) {
        const base = veinWeights(level, mastered)
        for (const aim of [null, ...ORE_IDS] as (OreId | null)[]) {
          const w = veinWeights(level, mastered, aim)
          expect(Object.values(w).every((x) => x! >= 0)).toBe(true)
          expect(sum(w)).toBeCloseTo(sum(base), 12)
          if (aim && base[aim]) expect([w[aim], w.coal]).toEqual([base[aim]! * 2, base.coal])
        }
      }
  })

  it('Seam survey: LOCKED below vein Lv3; the aim is free, LOCKED without the survey, BAD_ORE for an ore the vein does not drop', () => {
    expect(buyFavour(withRun({ stars: 99, vein: { level: 2, progress: 0, rock: 'stone' } }), 'seam')).toEqual({ ok: false, error: 'LOCKED' })
    const v3 = withRun({ stars: 12, vein: { level: 3, progress: 0, rock: 'stone' } })
    expect(setSeamAim(v3, 'ironOre')).toEqual({ ok: false, error: 'LOCKED' })
    const owned = okState(buyFavour(v3, 'seam'))
    expect(buyFavour({ ...owned, run: { ...owned.run, stars: 99 } }, 'seam')).toEqual({ ok: false, error: 'MAX_LEVEL' })
    expect(setSeamAim(owned, 'goldOre')).toEqual({ ok: false, error: 'BAD_ORE' })
    const aimed = okState(setSeamAim(owned, 'ironOre'))
    expect([aimed.run.favours.aim, aimed.run.stars]).toEqual(['ironOre', 0])
    expect(okState(setSeamAim(aimed, null)).run.favours.aim).toBeNull()
  })
})

describe('batch 34: the 🔥 Stoker', () => {
  const ready = (run: Partial<RunState> = {}) =>
    withRun({
      stars: 15,
      inventory: { ironBar: 6 },
      counters: { ...init.run.counters, bars: 30 },
      furnace: furnaceTop(),
      workers: { pool: 2, assigned: { ...init.run.workers.assigned }, certificates: ['fuel'] },
      ...run,
    })

  it('the certificate: ⭐15 + 🥈6, cash 0, LOCKED until the fuel certificate and the bar ladder (speed Lv2, batch 5 bars)', () => {
    expect(buyFavour(ready({ workers: { ...init.run.workers, certificates: [] } }), 'stoker')).toEqual({ ok: false, error: 'LOCKED' })
    expect(buyFavour(ready({ furnace: { ...furnaceTop(), levels: { ...furnaceTop().levels, batch: 3 } } }), 'stoker')).toEqual({ ok: false, error: 'LOCKED' })
    const s = okState(buyFavour(ready(), 'stoker'))
    expect([s.run.workers.certificates, s.run.stars, s.run.inventory.ironBar, s.run.cash]).toEqual([['fuel', 'stoker'], 0, 0, init.run.cash])
    expect(buyFavour(s, 'stoker')).toEqual({ ok: false, error: 'MAX_LEVEL' })
  })

  it('a second stoker fails MAX_LEVEL', () => {
    const one = okState(assignWorker(okState(buyFavour(ready(), 'stoker')), 'stoker', 1))
    expect(assignWorker(one, 'stoker', 1)).toEqual({ ok: false, error: 'MAX_LEVEL' })
  })

  it('a stoked copper cycle at speed Lv2 ends 1.5× sooner and burns 2× the fire per bar', () => {
    const run = (stoked: number, ticks: number) => {
      const furnace = { ...createFurnace(), built: true, fire: 5000, stoked, levels: { fireCap: 4, batch: 0, speed: 2, tray: 2, slot: 2 }, molds: { copperOre: { ore: 20, progress: 0, ready: 0 } } }
      return step(withRun({ furnace }), ticks).run
    }
    // 10 bars: 600 fire at 1.5625 per tick = 384 ticks; stoked 2.34375 progress per tick = 256 ticks, 1,200 fire
    const plain = run(0, 384)
    const stoked = run(1e9, 256)
    expect([plain.lifetime.barsSmelted, plain.lifetime.fireBurnt]).toEqual([10, 600])
    expect([stoked.lifetime.barsSmelted, stoked.lifetime.fireBurnt]).toEqual([10, 1200])
    expect(run(1e9, 255).lifetime.barsSmelted).toBe(9)
  })

  it('a paid stoker keeps the boost on; unpaid (cash < wage) it stops within workerActionTicks ticks; stoking alone burns nothing', () => {
    const working = (cash: number) => {
      const s = okState(assignWorker(okState(buyFavour(ready(), 'stoker')), 'stoker', 1))
      return { ...s, run: { ...s.run, cash, furnace: { ...s.run.furnace, molds: { copperOre: { ore: 40, progress: 0, ready: 0 } } } } }
    }
    // the stoker acts every workerActionTicks-th tick (0, 5, 10, 15) and each stoke covers exactly the ticks to the next
    const paid = step(working(100), 17)
    expect([paid.run.furnace.stoked, paid.run.lifetime.wagesPaid]).toEqual([3, 4])
    const unpaid = working(0)
    expect(step({ ...unpaid, run: { ...unpaid.run, furnace: { ...unpaid.run.furnace, stoked: workerActionTicks(init.meta) } } }, workerActionTicks(init.meta)).run.furnace.stoked).toBe(0)
    // no mold smelting: the stoker idles unpaid and the fire is untouched (smart furnace)
    const idle = { ...working(100), run: { ...working(100).run, furnace: { ...working(100).run.furnace, smart: true, molds: { copperOre: { ore: 0, progress: 0, ready: 0 } } } } }
    const after = step(idle, 20)
    expect([after.run.furnace.fire, after.run.furnace.stoked, after.run.lifetime.wagesPaid]).toEqual([idle.run.furnace.fire, 0, 0])
  })

  it('step(s, n) = n × step(s, 1) with a stoker on a running furnace', () => {
    const s = okState(assignWorker(okState(buyFavour(ready({ cash: 100 }), 'stoker')), 'stoker', 1))
    const start: GameState = { ...s, run: { ...s.run, furnace: { ...s.run.furnace, molds: { copperOre: { ore: 30, progress: 0, ready: 0 } } } } }
    let one = start
    for (let n = 1; n <= 30; n++) {
      one = step(one, 1)
      expect(one).toEqual(step(start, n))
    }
  })
})
