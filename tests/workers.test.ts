import { describe, expect, it } from 'vitest'
import { harvest, plant, till, water, type ActionResult } from '../src/core/actions'
import {
  OFFLINE_CAP_TICKS,
  certificateCost,
  certificateUnlock,
  cropGrowTicks,
  cropSellPrice,
  moistureDrainPerTick,
  waterMoisture,
  workerActionTicks,
  workerHireCost,
  workerHireUnlock,
  workerPoolCap,
  workerWage,
} from '../src/core/balance'
import type { CropId } from '../src/core/data/crops'
import { createInitialState, type Counters, type GameState, type Tile } from '../src/core/state'
import { step } from '../src/core/step'
import { growthProgress } from '../src/core/tile'
import { catchUp } from '../src/save/serialize'
import {
  assignWorker,
  buyCertificate,
  certificateUnlocked,
  freeWorkers,
  hireUnlocked,
  hireWorker,
  workerTargets,
  workerUnpaid,
  workersAct,
} from '../src/core/workers'

const init = createInitialState()
const meta = init.meta

function withRun(run: Partial<GameState['run']>, counters: Partial<Counters> = {}): GameState {
  return { ...init, run: { ...init.run, ...run, counters: { ...init.run.counters, ...counters } } }
}

function okState(r: ActionResult): GameState {
  if (!r.ok) throw new Error(`expected ok, got ${r.error}`)
  return r.state
}

const workers = (pool: number, water = 0, harvest = 0, certificates: ('water' | 'harvest')[] = ['water', 'harvest']) => ({
  workers: { pool, assigned: { water, harvest }, certificates },
})

describe('workers: balance', () => {
  it('hire k costs 80 × 1.7^(k − 1), pool cap 6, hiring unlocks at 30 harvests', () => {
    expect([0, 1, 2, 3, 4, 5].map((pool) => workerHireCost(pool, meta))).toEqual([80, 136, 231, 393, 668, 1136])
    expect(workerPoolCap()).toBe(6)
    expect(workerHireUnlock()).toEqual({ counter: 'harvests', at: 30 })
  })

  it('certificates: water 💰100 after 40 waters, harvest 💰150 + 20 stone after 40 harvests', () => {
    expect(certificateCost('water', meta)).toEqual({ cash: 100 })
    expect(certificateCost('harvest', meta)).toEqual({ stone: 20, cash: 150 })
    expect(certificateUnlock('water')).toEqual({ counter: 'waters', at: 40 })
    expect(certificateUnlock('harvest')).toEqual({ counter: 'harvests', at: 40 })
  })
})

describe('hireWorker', () => {
  it('is LOCKED until 30 harvests, then adds one to the pool for its price, no energy', () => {
    expect(hireUnlocked(withRun({ cash: 1000 }, { harvests: 29 }).run)).toBe(false)
    expect(hireWorker(withRun({ cash: 1000 }, { harvests: 29 }))).toEqual({ ok: false, error: 'LOCKED' })
    const s = withRun({ cash: 300 }, { harvests: 30 })
    const one = okState(hireWorker(s))
    expect([one.run.cash, one.run.workers.pool, one.run.energy]).toEqual([220, 1, s.run.energy])
    const two = okState(hireWorker(one))
    expect([two.run.cash, two.run.workers.pool]).toEqual([84, 2])
    expect(hireWorker(two)).toEqual({ ok: false, error: 'NO_CASH' })
  })

  it('stops at the pool cap with POOL_FULL before checking cash', () => {
    const s = withRun({ cash: 0, ...workers(6) }, { harvests: 30 })
    expect(hireWorker(s)).toEqual({ ok: false, error: 'POOL_FULL' })
  })
})

describe('buyCertificate', () => {
  it('water: LOCKED below 40 waters, then 💰100 once', () => {
    expect(buyCertificate(withRun({ cash: 500 }, { waters: 39 }), 'water')).toEqual({ ok: false, error: 'LOCKED' })
    const s = withRun({ cash: 500 }, { waters: 40 })
    expect(certificateUnlocked(s.run, 'water')).toBe(true)
    const next = okState(buyCertificate(s, 'water'))
    expect([next.run.cash, next.run.workers.certificates]).toEqual([400, ['water']])
    expect(buyCertificate(next, 'water')).toEqual({ ok: false, error: 'ALREADY_OWNED' })
  })

  it('harvest: 💰150 + 20 stone, NOT_ENOUGH_ITEMS before NO_CASH', () => {
    const s = withRun({ cash: 150, inventory: { stone: 19 } }, { harvests: 40 })
    expect(buyCertificate(s, 'harvest')).toEqual({ ok: false, error: 'NOT_ENOUGH_ITEMS' })
    const broke = withRun({ cash: 149, inventory: { stone: 20 } }, { harvests: 40 })
    expect(buyCertificate(broke, 'harvest')).toEqual({ ok: false, error: 'NO_CASH' })
    const next = okState(buyCertificate({ ...s, run: { ...s.run, inventory: { stone: 25 } } }, 'harvest'))
    expect([next.run.cash, next.run.inventory.stone, next.run.workers.certificates]).toEqual([0, 5, ['harvest']])
  })
})

describe('assignWorker', () => {
  it('+1 needs the certificate, then a free worker; −1 frees one', () => {
    const s = withRun(workers(2, 0, 0, []))
    expect(assignWorker(s, 'water', 1)).toEqual({ ok: false, error: 'NO_CERTIFICATE' })
    const certified = withRun(workers(2, 0, 0, ['water']))
    const one = okState(assignWorker(certified, 'water', 1))
    const two = okState(assignWorker(one, 'water', 1))
    expect([two.run.workers.assigned, freeWorkers(two.run)]).toEqual([{ water: 2, harvest: 0 }, 0])
    expect(assignWorker(two, 'water', 1)).toEqual({ ok: false, error: 'NO_FREE_WORKER' })
    const back = okState(assignWorker(two, 'water', -1))
    expect([back.run.workers.assigned.water, freeWorkers(back.run)]).toEqual([1, 1])
    expect(assignWorker(certified, 'harvest', -1)).toEqual({ ok: false, error: 'NOTHING_TO_DO' })
  })

  it('a worker moves between jobs through the free pool', () => {
    const s = withRun(workers(1, 1, 0))
    expect(assignWorker(s, 'harvest', 1)).toEqual({ ok: false, error: 'NO_FREE_WORKER' })
    const moved = okState(assignWorker(okState(assignWorker(s, 'water', -1)), 'harvest', 1))
    expect(moved.run.workers.assigned).toEqual({ water: 0, harvest: 1 })
  })
})

// ---- Task 50: the worker tick ----

const PUMPKIN = cropGrowTicks('pumpkin', meta, 0)
const growing = (moisture: number, growth = 10): Tile => ({ status: 'planted', cropId: 'pumpkin', growth, moisture, ticksSinceMature: 0 })
const ripe = (ticksSinceMature: number): Tile => ({ status: 'planted', cropId: 'pumpkin', growth: PUMPKIN, moisture: 0, ticksSinceMature })
const empty: Tile = { status: 'tilled', growth: 0, moisture: 0, ticksSinceMature: 0 }

/** a farm whose first tiles are `tiles` (the rest tilled and empty), with workers on water / harvest */
function farm(tiles: Tile[], { cash = 100, water = 1, harvest = 1, energy = 0, tick = 0 } = {}): GameState {
  return withRun({
    cash,
    energy,
    tick,
    licenses: ['radish', 'pumpkin'],
    tiles: init.run.tiles.map((_, i) => tiles[i] ?? empty),
    ...workers(water + harvest, water, harvest),
  })
}

describe('workersAct / step: workers', () => {
  it('on a worker tick each worker does one action, pays the wage, spends no player energy', () => {
    const s = farm([growing(0), growing(0.05), ripe(3), ripe(9)], { energy: 4 })
    const next = workersAct(s)
    const sell = cropSellPrice('pumpkin', meta, 0)
    // waterer: driest first (tile 0); harvester: ripe longest first (tile 3)
    expect(next.run.tiles[0].moisture).toBe(waterMoisture(0))
    expect(next.run.tiles[1].moisture).toBe(0.05)
    expect(next.run.tiles[3].status).toBe('tilled')
    expect(next.run.tiles[2].status).toBe('planted')
    expect(next.run.cash).toBe(100 + sell - 2 * workerWage(meta))
    expect(next.run.energy).toBe(4)
    expect(next.run.counters).toMatchObject({ waters: 1, harvests: 1, sales: 1 })
    expect(next.run.lifetime).toMatchObject({ wagesPaid: 2, energySpent: 0, cashEarned: sell, harvests: { pumpkin: 1 } })
  })

  it('acts only on every workerActionTicks-th tick', () => {
    expect(workerActionTicks()).toBe(5)
    const s = farm([growing(0)], { harvest: 0 })
    for (let tick = 1; tick < 5; tick++) {
      const at = { ...s, run: { ...s.run, tick } }
      expect(workersAct(at)).toBe(at)
    }
    // tick 0 acts (watered to 1); at the start of tick 55 it holds 5/60, due again on that worker tick
    expect(step(s, 1).run.counters.waters).toBe(1)
    expect(step(s, 55).run.counters.waters).toBe(1)
    expect(step(s, 56).run.counters.waters).toBe(2)
  })

  it('two workers on one job act on two different tiles', () => {
    const next = workersAct(farm([growing(0.02), growing(0)], { water: 2, harvest: 0 }))
    expect(next.run.tiles.slice(0, 2).map((t) => t.moisture)).toEqual([1, 1])
    expect(next.run.lifetime.wagesPaid).toBe(2)
  })

  it('a waterer only waters a tile that would run dry before its next turn', () => {
    const due = workerActionTicks() * moistureDrainPerTick(meta)
    const s = farm([growing(due + 0.01), growing(due)], { harvest: 0 })
    expect(workerTargets(s, 'water')).toEqual([1])
    const none = farm([growing(due + 0.01)], { harvest: 0 })
    expect(workersAct(none)).toBe(none)
  })

  it('no target or no cash: the worker idles and nothing is charged; cash never goes negative', () => {
    const idle = farm([growing(0.5)])
    expect(workersAct(idle)).toBe(idle)
    const broke = farm([growing(0), ripe(1)], { cash: 0 })
    expect(workerUnpaid(broke, 'water')).toBe(true)
    expect(workerUnpaid(idle, 'water')).toBe(false)
    expect(workersAct(broke)).toBe(broke)
    const later = step(broke, 600)
    expect(later.run.cash).toBe(0)
    expect(later.run.lifetime.wagesPaid).toBe(0)
    expect(later.run.loan).toBeNull()
  })

  it('never acts on a tile the player just watered or harvested in the same tick (tier 0 and copper)', () => {
    for (const tier of [0, 1]) {
      const s0 = farm([growing(0), ripe(5)])
      const s = { ...s0, run: { ...s0.run, energy: 2, toolTier: { ...s0.run.toolTier, water: tier } } }
      const played = okState(harvest(okState(water(s, 0)), 1))
      const next = step(played, 1)
      expect(next.run.counters).toMatchObject({ waters: 1, harvests: 1 })
      expect(next.run.lifetime.wagesPaid).toBe(0)
      expect(next.run.cash).toBe(played.run.cash)
    }
  })

  it('the job copper tier applies: a copper can worker waters to 2', () => {
    const s = farm([growing(0)], { harvest: 0 })
    const next = workersAct({ ...s, run: { ...s.run, toolTier: { ...s.run.toolTier, water: 1 } } })
    expect(next.run.tiles[0].moisture).toBe(waterMoisture(1))
  })

  it('copper sickle draws stay in action order: two harvesters = two manual harvests, then the wages', () => {
    const s0 = farm([ripe(1), ripe(7), ripe(4)], { water: 0, harvest: 2 })
    const s = { ...s0, run: { ...s0.run, toolTier: { ...s0.run.toolTier, harvest: 1 } } }
    const manual = okState(harvest(okState(harvest(s, 1, 0)), 2, 0))
    const next = workersAct(s)
    expect(next.run).toEqual({ ...manual.run, cash: manual.run.cash - 2, lifetime: { ...manual.run.lifetime, wagesPaid: 2 } })
  })

  it('step(s, n) equals n × step(s, 1) with workers, and 8 h of offline catch-up stays fast', () => {
    const s = farm([growing(0), growing(0.3), ripe(2), growing(0.1, PUMPKIN - 20)], { cash: 40 })
    let one = s
    for (let i = 0; i < 300; i++) one = step(one, 1)
    expect(step(s, 300)).toEqual(one)
    const t0 = performance.now()
    const after = catchUp(s, OFFLINE_CAP_TICKS * 1000)
    expect(performance.now() - t0).toBeLessThan(3000)
    expect(after.run.tick).toBe(OFFLINE_CAP_TICKS)
    expect(after.run.cash).toBeGreaterThanOrEqual(0)
  })
})

// 9 pumpkin tiles for 1200 ticks, cash to spare. Manual = the greedy farmer (harvest, water when dry, plant, till);
// workers = `waterers` + 1 harvester while the player only tills and plants. Net cash per minute, standing crops
// valued at sell price × growth (same accounting as the sim's runCropBot); workers spend no energy, so per minute.
function pumpkinRate(waterers: number, waterTier = 0) {
  const ticks = 1200
  const workersOn = waterers > 0
  const base = farm([], { cash: 1000, water: waterers, harvest: workersOn ? 1 : 0, energy: init.run.energy })
  // untilled start, as in the sim
  let s = { ...base, run: { ...base.run, tiles: init.run.tiles, toolTier: { ...base.run.toolTier, water: waterTier } } }
  const crop: CropId = 'pumpkin'
  const start = s.run.cash
  for (let t = 0; t < ticks; t++) {
    act: while (s.run.energy >= 1) {
      const tiles = s.run.tiles
      const tries: ((i: number) => ActionResult | null)[] = workersOn
        ? [(i) => plant(s, i, crop), (i) => till(s, i)]
        : [
            (i) => harvest(s, i),
            (i) => (tiles[i].moisture === 0 && tiles[i].status === 'planted' && tiles[i].growth < PUMPKIN ? water(s, i) : null),
            (i) => plant(s, i, crop),
            (i) => till(s, i),
          ]
      for (const f of tries)
        for (let i = 0; i < tiles.length; i++) {
          const r = f(i)
          if (r?.ok) {
            s = r.state
            continue act
          }
        }
      break
    }
    s = step(s, 1)
  }
  const field = s.run.tiles.reduce((sum, t) => sum + (t.cropId ? cropSellPrice(t.cropId, meta, 0) * growthProgress(t, s) : 0), 0)
  return { perMin: (s.run.cash - start + field) / (ticks / 60), waters: s.run.counters.waters, wages: s.run.lifetime.wagesPaid }
}

describe('workers vs manual, 9 pumpkin tiles, 1200 ticks', () => {
  const manual = pumpkinRate(0)
  const worked = pumpkinRate(1)
  const copper = { manual: pumpkinRate(0, 1), worked: pumpkinRate(1, 1) }
  const twoWaterers = pumpkinRate(2)
  console.log('batch 8 workers vs manual', JSON.stringify({ manual, worked, ratio: worked.perMin / manual.perMin, copper, twoWaterers }))

  it('water + harvest workers with the player only planting net ≥ 80 % of the manual rate', () => {
    expect(worked.perMin).toBeGreaterThanOrEqual(0.8 * manual.perMin)
    expect(copper.worked.perMin).toBeGreaterThanOrEqual(0.8 * copper.manual.perMin)
  })

  it('a copper can halves the waterer actions and wages; a second waterer only idles (costs nothing more)', () => {
    expect(copper.worked.waters).toBeLessThanOrEqual(0.55 * worked.waters)
    expect(copper.worked.wages).toBeLessThan(worked.wages)
    expect(twoWaterers).toEqual(worked)
  })
})

describe('new runs', () => {
  it('start with no workers, no certificates, no wages paid and auto-smelt off', () => {
    expect(init.run.workers).toEqual({ pool: 0, assigned: { water: 0, harvest: 0 }, certificates: [] })
    expect([init.run.lifetime.wagesPaid, init.run.autoSmelt, freeWorkers(init.run)]).toEqual([0, false, 0])
  })
})
