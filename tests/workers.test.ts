import { describe, expect, it } from 'vitest'
import { harvest, plant, till, water, type ActionResult } from '../src/core/actions'
import {
  BAG_CAPACITY_START,
  OFFLINE_CAP_TICKS,
  certificateCost,
  certificateUnlock,
  cropGrowTicks,
  cropSeedCost,
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
import type { WorkerJob } from '../src/core/data/workers'
import { collectBars } from '../src/core/furnace'
import { createFurnace, createInitialState, type Counters, type Furnace, type GameState, type Tile } from '../src/core/state'
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
  ticksUntilWorkers,
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

const workers = (pool: number, water = 0, harvest = 0, certificates: WorkerJob[] = ['water', 'harvest'], ore = 0, fuel = 0, plant = 0) => ({
  workers: { pool, assigned: { plant, water, harvest, ore, fuel }, certificates },
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
    expect([two.run.workers.assigned, freeWorkers(two.run)]).toEqual([{ plant: 0, water: 2, harvest: 0, ore: 0, fuel: 0 }, 0])
    expect(assignWorker(two, 'water', 1)).toEqual({ ok: false, error: 'NO_FREE_WORKER' })
    const back = okState(assignWorker(two, 'water', -1))
    expect([back.run.workers.assigned.water, freeWorkers(back.run)]).toEqual([1, 1])
    expect(assignWorker(certified, 'harvest', -1)).toEqual({ ok: false, error: 'NOTHING_TO_DO' })
  })

  it('a worker moves between jobs through the free pool', () => {
    const s = withRun(workers(1, 1, 0))
    expect(assignWorker(s, 'harvest', 1)).toEqual({ ok: false, error: 'NO_FREE_WORKER' })
    const moved = okState(assignWorker(okState(assignWorker(s, 'water', -1)), 'harvest', 1))
    expect(moved.run.workers.assigned).toEqual({ plant: 0, water: 0, harvest: 1, ore: 0, fuel: 0 })
  })
})

// ---- Task 50: the worker tick ----

const PUMPKIN = cropGrowTicks('pumpkin', meta, 0)
const growing = (moisture: number, growth = 10): Tile => ({ status: 'planted', cropId: 'pumpkin', growth, moisture, ticksSinceMature: 0 })
const ripe = (ticksSinceMature: number): Tile => ({ status: 'planted', cropId: 'pumpkin', growth: PUMPKIN, moisture: 0, ticksSinceMature })
const empty: Tile = { status: 'tilled', growth: 0, moisture: 0, ticksSinceMature: 0 }

/** a farm whose first tiles are `tiles` (the rest tilled and empty), with workers on water / harvest (/ plant) */
function farm(tiles: Tile[], { cash = 100, water = 1, harvest = 1, plant = 0, energy = 0, tick = 0 } = {}): GameState {
  return withRun({
    cash,
    energy,
    tick,
    licenses: ['radish', 'pumpkin'],
    tiles: init.run.tiles.map((_, i) => tiles[i] ?? empty),
    ...workers(water + harvest + plant, water, harvest, undefined, 0, 0, plant),
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
    expect(workerTargets(s)).toEqual([{ job: 'water', tile: 1 }])
    const none = farm([growing(due + 0.01)], { harvest: 0 })
    expect(workersAct(none)).toBe(none)
    expect(workerTargets(none)).toEqual([])
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

// ---- Task 60: which tile a worker works on next ----

/** the tiles a round of workers changed: watered (moisture up) or harvested (crop gone) */
function touchedTiles(before: GameState, after: GameState) {
  return before.run.tiles.flatMap((t, tile) => {
    const now = after.run.tiles[tile]
    if (t.cropId && !now.cropId) return [{ job: 'harvest', tile }]
    return now.moisture > t.moisture ? [{ job: 'water', tile }] : []
  })
}

describe('workerTargets (task 60)', () => {
  it('one target per acting worker, in action order: waterers first (driest first), then harvesters (ripe longest first)', () => {
    const s = farm([growing(0.02), growing(0), ripe(3), ripe(9), growing(0.5)], { water: 2, harvest: 1 })
    expect(workerTargets(s)).toEqual([
      { job: 'water', tile: 1 },
      { job: 'water', tile: 0 },
      { job: 'harvest', tile: 3 },
    ])
  })

  it('between worker ticks it shows the next action tick: a tile that will be due by then is ringed already', () => {
    const due = workerActionTicks() * moistureDrainPerTick(meta)
    // at tick 2 the tile is 2.5 drains above due: not due now, due after the 3 drains to tick 5
    const s = farm([growing(due + 2.5 * moistureDrainPerTick(meta))], { harvest: 0, tick: 2 })
    expect(ticksUntilWorkers(s.run)).toBe(3)
    expect(workerTargets(s)).toEqual([{ job: 'water', tile: 0 }])
    expect(workerTargets({ ...s, run: { ...s.run, tick: 0 } })).toEqual([])
  })

  it('no cash for a wage, no target: nothing is ringed; furnace workers never ring a tile', () => {
    expect(workerTargets(farm([growing(0), ripe(1)], { cash: 0 }))).toEqual([])
    // one wage left: the waterer acts first, the harvester cannot pay
    expect(workerTargets(farm([growing(0), ripe(1)], { cash: workerWage(meta) }))).toEqual([{ job: 'water', tile: 0 }])
    const loaders = withRun({ cash: 100, ...workers(2, 0, 0, ['ore', 'fuel'], 1, 1), furnace: { ...createFurnace(), built: true }, inventory: { coal: 3 } })
    expect(workerTargets(loaders)).toEqual([])
  })

  it('over 60 ticks with no player input, every ring shown before an action tick is exactly what the workers then do', () => {
    let s = farm([growing(0), growing(0.04), ripe(2), growing(0.1, PUMPKIN - 7), growing(0.2), ripe(30)], { water: 2, harvest: 1, cash: 40, tick: 1 })
    let actions = 0
    for (let t = 0; t < 60; t++) {
      const rings = workerTargets(s)
      const at = step(s, ticksUntilWorkers(s.run))
      const acted = workersAct(at)
      expect(touchedTiles(at, acted)).toEqual([...rings].sort((a, b) => a.tile - b.tile))
      actions += rings.length
      s = step(s, 1)
    }
    expect(actions).toBeGreaterThan(10)
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

// ---- Batch 9 (task 58): furnace loaders ----

const ALL: WorkerJob[] = ['water', 'harvest', 'ore', 'fuel']
/** a built furnace with `ore` / `fuel` loaders, the next tick a worker tick, cash to spare */
function smeltery(f: Partial<Furnace>, inventory: GameState['run']['inventory'], { ore = 0, fuel = 0, cash = 100 } = {}): GameState {
  return withRun({ cash, inventory, furnace: { ...createFurnace(), built: true, ...f }, ...workers(ore + fuel, 0, 0, ALL, ore, fuel) })
}
const wage = workerWage(meta)

describe('furnace loaders: certificates', () => {
  it('ore loader 🥉3 + 💰100 after 10 bars collected; fuel loader 🥉8 + 💰200 after 30', () => {
    expect([certificateCost('ore', meta), certificateUnlock('ore')]).toEqual([{ copperBar: 3, cash: 100 }, { counter: 'bars', at: 10 }])
    expect([certificateCost('fuel', meta), certificateUnlock('fuel')]).toEqual([{ copperBar: 8, cash: 200 }, { counter: 'bars', at: 30 }])
    expect(buyCertificate(withRun({ cash: 500, inventory: { copperBar: 9 } }, { bars: 9 }), 'ore')).toEqual({ ok: false, error: 'LOCKED' })
    const ore = okState(buyCertificate(withRun({ cash: 500, inventory: { copperBar: 9 } }, { bars: 10 }), 'ore'))
    expect([ore.run.cash, ore.run.inventory.copperBar, ore.run.workers.certificates]).toEqual([400, 6, ['ore']])
    expect(buyCertificate(withRun({ cash: 500, inventory: { copperBar: 9 } }, { bars: 29 }), 'fuel')).toEqual({ ok: false, error: 'LOCKED' })
    expect(buyCertificate(withRun({ cash: 500, inventory: { copperBar: 7 } }, { bars: 30 }), 'fuel')).toEqual({ ok: false, error: 'NOT_ENOUGH_ITEMS' })
  })

  it('collecting bars (by hand or by a loader) counts toward the gate', () => {
    const s = smeltery({ ready: 3 }, {})
    expect(okState(collectBars(s)).run.counters.bars).toBe(3)
    expect(workersAct(smeltery({ ready: 3 }, {}, { ore: 1 })).run.counters.bars).toBe(3)
  })
})

describe('furnace loaders: workersAct', () => {
  it('ore loader: collects the tray when it has bars and storage has room, for one wage', () => {
    const next = workersAct(smeltery({ ready: 2 }, { copperOre: 6 }, { ore: 1 }))
    expect([next.run.furnace.ready, next.run.inventory.copperBar, next.run.furnace.ore, next.run.cash]).toEqual([0, 2, 0, 100 - wage])
  })

  it('ore loader: with nothing to collect (or storage full) loads one cycle of ore', () => {
    const next = workersAct(smeltery({}, { copperOre: 5 }, { ore: 1 }))
    expect([next.run.furnace.ore, next.run.inventory.copperOre, next.run.cash]).toEqual([2, 3, 100 - wage])
    const full = smeltery({ ready: 1 }, { copperOre: BAG_CAPACITY_START }, { ore: 1 })
    expect(workersAct(full).run.furnace).toMatchObject({ ready: 1, ore: 2 })
    // batch level 2: one cycle = 6 ore
    expect(workersAct(smeltery({ levels: { fireCap: 0, batch: 2 } }, { copperOre: 7 }, { ore: 1 })).run.furnace.ore).toBe(6)
  })

  it('ore loader idles unpaid with nothing to do: no ore for a cycle, slot full, no furnace', () => {
    for (const s of [
      smeltery({}, { copperOre: 1 }, { ore: 1 }),
      smeltery({ ore: 11 }, { copperOre: 5 }, { ore: 1 }),
      { ...smeltery({}, { copperOre: 5 }, { ore: 1 }), run: { ...smeltery({}, { copperOre: 5 }, { ore: 1 }).run, furnace: createFurnace() } },
    ]) {
      expect(workersAct(s)).toBe(s)
      expect(workerUnpaid({ ...s, run: { ...s.run, cash: 0 } }, 'ore')).toBe(false)
    }
    expect(workerUnpaid({ ...smeltery({}, { copperOre: 5 }, { ore: 1 }), run: { ...smeltery({}, { copperOre: 5 }, { ore: 1 }).run, cash: 0 } }, 'ore')).toBe(true)
  })

  it('fuel loader: one coal per action while the fire has room for 2 units, never wood; idle unpaid otherwise', () => {
    const next = workersAct(smeltery({}, { coal: 3, wood: 5 }, { fuel: 1 }))
    expect([next.run.furnace.fire, next.run.inventory.coal, next.run.inventory.wood, next.run.cash]).toEqual([60, 2, 5, 100 - wage])
    const two = workersAct(smeltery({}, { coal: 3 }, { fuel: 2 }))
    expect(two.run.furnace.fire).toBe(120)
    for (const s of [smeltery({ fire: 241 }, { coal: 3 }, { fuel: 1 }), smeltery({}, { wood: 9 }, { fuel: 1 })]) expect(workersAct(s)).toBe(s)
    expect(workersAct(smeltery({ fire: 240 }, { coal: 3 }, { fuel: 1 })).run.furnace.fire).toBe(300)
  })

  it('both loaders keep a plain furnace going, and it burns on (wasted) when the ore runs out', () => {
    const s = smeltery({}, { copperOre: 4, coal: 10 }, { ore: 1, fuel: 1, cash: 1000 })
    const after = step(s, 600)
    expect(after.run.inventory.copperBar).toBe(2)
    expect(after.run.lifetime.barsSmelted).toBe(2)
    expect(after.run.lifetime.fireWasted).toBeGreaterThan(0)
    // smart: the same stock wastes nothing, and the fuel loader stops once the fire is full
    const smart = step({ ...s, run: { ...s.run, furnace: { ...s.run.furnace, smart: true } } }, 600)
    expect(smart.run.inventory.copperBar).toBe(2)
    expect(smart.run.lifetime.fireWasted).toBe(0)
    expect(smart.run.inventory.coal).toBeGreaterThan(after.run.inventory.coal!)
  })

  it('never stalls at the top batch level: a slot short of a cycle always has room for the ore loader to add one', () => {
    const s = smeltery({ ore: 5, fire: 300, levels: { fireCap: 0, batch: 2 } }, { copperOre: 10, coal: 10 }, { ore: 1, fuel: 1, cash: 1000 })
    expect(step(s, 600).run.lifetime.barsSmelted).toBeGreaterThan(0)
  })

  it('step(s, n) equals n × step(s, 1) with both loaders, plain and smart, and 8 h of catch-up stays fast', () => {
    const base = smeltery({ ready: 4, ore: 1, fire: 45, progress: 20 }, { copperOre: 13, coal: 7, wood: 3 }, { ore: 1, fuel: 1, cash: 30 })
    for (const smart of [false, true]) {
      const s = { ...base, run: { ...base.run, furnace: { ...base.run.furnace, smart } } }
      let one = s
      for (let i = 0; i < 900; i++) one = step(one, 1)
      expect(step(s, 900)).toEqual(one)
      const t0 = performance.now()
      const after = catchUp(s, OFFLINE_CAP_TICKS * 1000)
      expect(performance.now() - t0).toBeLessThan(3000)
      expect(after.run.cash).toBeGreaterThanOrEqual(0)
    }
  })
})

// ---- Task 62: plant worker ----

const untilled: Tile = { status: 'untilled', growth: 0, moisture: 0, ticksSinceMature: 0 }
/** every tile planted and growing except `tiles`; only a planter on the farm */
const planterFarm = (tiles: Tile[], opts: { cash?: number; plant?: number } = {}) => {
  const s = farm(init.run.tiles.map((_, i) => tiles[i] ?? growing(1)), { water: 0, harvest: 0, plant: 1, ...opts })
  return { ...s, run: { ...s.run, plantCrop: 'pumpkin' as CropId } }
}
const SEED = (crop: CropId) => cropSeedCost(crop, meta)

describe('plant worker: certificate', () => {
  it('🥉10 + 💰300 after 60 plants; LOCKED below, NOT_ENOUGH_ITEMS before NO_CASH', () => {
    expect(certificateCost('plant', meta)).toEqual({ copperBar: 10, cash: 300 })
    expect(certificateUnlock('plant')).toEqual({ counter: 'plants', at: 60 })
    expect(certificateUnlocked(withRun({}, { plants: 59 }).run, 'plant')).toBe(false)
    expect(buyCertificate(withRun({ cash: 1000, inventory: { copperBar: 10 } }, { plants: 59 }), 'plant')).toEqual({ ok: false, error: 'LOCKED' })
    expect(buyCertificate(withRun({ cash: 1000, inventory: { copperBar: 9 } }, { plants: 60 }), 'plant')).toEqual({ ok: false, error: 'NOT_ENOUGH_ITEMS' })
    expect(buyCertificate(withRun({ cash: 299, inventory: { copperBar: 10 } }, { plants: 60 }), 'plant')).toEqual({ ok: false, error: 'NO_CASH' })
    const bought = okState(buyCertificate(withRun({ cash: 300, inventory: { copperBar: 10 } }, { plants: 60 }), 'plant'))
    expect(bought.run).toMatchObject({ cash: 0, inventory: { copperBar: 0 }, workers: { certificates: ['plant'] } })
  })
})

describe('plant worker: workersAct', () => {
  it('plants "Crop to plant" on an empty tilled tile with a pouch seed: the player tap, no energy, one wage', () => {
    const s0 = planterFarm([untilled, empty], { cash: 50 })
    const s = { ...s0, run: { ...s0.run, seeds: { pumpkin: 3 }, energy: 4 } }
    const next = workersAct(s)
    expect(next.run.tiles[1]).toMatchObject({ status: 'planted', cropId: 'pumpkin', growth: 0 })
    expect(next.run.tiles[0].status).toBe('untilled')
    expect(next.run.seeds.pumpkin).toBe(2)
    expect(next.run).toMatchObject({ cash: 50 - workerWage(meta), energy: 4, counters: { plants: 1 } })
    expect(next.run.lifetime).toMatchObject({ wagesPaid: 1, workerPlants: 1, energySpent: 0 })
    // the same as the player's plant with no energy, plus the wage
    const manual = okState(plant(s, 1, 'pumpkin', 0))
    expect(next.run).toEqual({ ...manual.run, cash: manual.run.cash - 1, lifetime: { ...manual.run.lifetime, wagesPaid: 1, workerPlants: 1 } })
  })

  it('tills an untilled tile when no tilled one is empty (a till is not a plant)', () => {
    const next = workersAct(planterFarm([untilled]))
    expect(next.run.tiles[0].status).toBe('tilled')
    expect(next.run.counters.plants).toBe(0)
    expect(next.run.lifetime).toMatchObject({ wagesPaid: 1, workerPlants: 0 })
    expect(okState(till(planterFarm([untilled]), 0, 0)).run.tiles[0].status).toBe('tilled')
  })

  it('auto-buy on and an empty pouch: buys the one seed at the seed price, like the player', () => {
    const next = workersAct(planterFarm([empty], { cash: 50 }))
    expect(next.run.tiles[0].cropId).toBe('pumpkin')
    expect(next.run.cash).toBe(50 - SEED('pumpkin') - workerWage(meta))
  })

  it('auto-buy off and an empty pouch: idles unpaid, and does not till ahead either', () => {
    const s0 = planterFarm([empty, untilled])
    const s = { ...s0, run: { ...s0.run, autoBuySeeds: false } }
    expect(workersAct(s)).toBe(s)
    expect(workerTargets(s)).toEqual([])
    expect(workerUnpaid(s, 'plant')).toBe(false)
  })

  it('never goes below 0: a seed that would leave less than the wage idles the planter (unpaid badge)', () => {
    const short = planterFarm([empty], { cash: SEED('pumpkin') + workerWage(meta) - 1 })
    expect(workersAct(short)).toBe(short)
    expect(workerUnpaid(short, 'plant')).toBe(true)
    expect(step(short, 600).run.cash).toBe(short.run.cash)
    const exact = planterFarm([empty], { cash: SEED('pumpkin') + workerWage(meta) })
    expect(workersAct(exact).run.cash).toBe(0)
    expect(workerUnpaid(exact, 'plant')).toBe(false)
  })

  it('acts only when a tile is empty: a fully planted farm costs nothing', () => {
    const full = planterFarm([])
    expect(workersAct(full)).toBe(full)
  })

  it('the copper dibber applies: its seed-keep roll is the player plant roll', () => {
    const s0 = planterFarm([empty, empty], { cash: 50, plant: 2 })
    const s = { ...s0, run: { ...s0.run, seeds: { pumpkin: 5 }, toolTier: { ...s0.run.toolTier, plant: 1 } } }
    const manual = okState(plant(okState(plant(s, 0, 'pumpkin', 0)), 1, 'pumpkin', 0))
    const next = workersAct(s)
    expect(next.run).toEqual({ ...manual.run, cash: manual.run.cash - 2, lifetime: { ...manual.run.lifetime, wagesPaid: 2, workerPlants: 2 } })
    expect(next.run.rngState).not.toBe(s.run.rngState)
  })

  it('plants before waterers and harvesters act; workerTargets rings the planter tile first', () => {
    const s0 = planterFarm([empty, growing(0), ripe(3)])
    const s = { ...s0, run: { ...s0.run, workers: { ...s0.run.workers, pool: 3, assigned: { ...s0.run.workers.assigned, water: 1, harvest: 1 } } } }
    // the seed just planted on dry soil is the driest due tile (tile order breaks the tie), so it is watered in the same round
    expect(workerTargets(s)).toEqual([
      { job: 'plant', tile: 0 },
      { job: 'water', tile: 0 },
      { job: 'harvest', tile: 2 },
    ])
  })

  it('step(s, n) equals n × step(s, 1) with all three farm workers on, and the full loop runs 8 h offline at cash ≥ 0', () => {
    const s0 = farm([untilled, empty, growing(0), ripe(2), growing(0.1, PUMPKIN - 20)], { cash: 60, water: 1, harvest: 1, plant: 1 })
    const s: GameState = { ...s0, run: { ...s0.run, plantCrop: 'pumpkin', seeds: { pumpkin: 2 } } }
    let one = s
    for (let i = 0; i < 900; i++) one = step(one, 1)
    expect(step(s, 900)).toEqual(one)
    expect(one.run.lifetime.workerPlants).toBeGreaterThan(0)
    let lowest = Infinity
    let t = s
    for (let i = 0; i < OFFLINE_CAP_TICKS; i += 60) {
      t = step(t, 60)
      lowest = Math.min(lowest, t.run.cash)
    }
    expect(lowest).toBeGreaterThanOrEqual(0)
    expect(t.run.tiles.every((tile) => tile.status !== 'untilled')).toBe(true)
  })
})

describe('new runs', () => {
  it('start with no workers, no certificates and no wages paid', () => {
    expect(init.run.workers).toEqual({ pool: 0, assigned: { plant: 0, water: 0, harvest: 0, ore: 0, fuel: 0 }, certificates: [] })
    expect([init.run.lifetime.wagesPaid, freeWorkers(init.run)]).toEqual([0, 0])
    expect([init.run.plantCrop, init.run.lifetime.workerPlants]).toEqual(['radish', 0])
  })
})
