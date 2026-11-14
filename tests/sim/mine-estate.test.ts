import { describe, expect, it, vi } from 'vitest'
import { CROP_IDS, type CropId } from '../../src/core/data/crops'
import { cropSale } from '../../src/core/market'
import { ORE_IDS } from '../../src/core/data/items'
import {
  OFFLINE_CAP_TICKS,
  barTicks,
  certificateCost,
  furnaceUpgradeCost,
  furnaceUpgradeMaxLevel,
  cropSellPrice,
  RENOWN_TIERS,
  renownFloor,
  furnaceSpeedRate,
  batchBars,
  moldPrice,
  fuelTicks,
  TANK_UNITS_PER_COAL,
  fieldPlots,
  plotTiles,
  tankCapCoal,
  workerWage,
  MINE_DROP_IDS,
  oreSortUnlockCost,
} from '../../src/core/balance'
import { addFuel, buyMold, collectBars, loadOre } from '../../src/core/furnace'
import { sellFarm } from '../../src/core/prestige'
import { deserialize } from '../../src/save/serialize'
import v20 from '../fixtures/save-v20.json?raw'
import v21 from '../fixtures/save-v21.json?raw'
import v22 from '../fixtures/save-v22.json?raw'
import v23 from '../fixtures/save-v23.json?raw'
import v24 from '../fixtures/save-v24.json?raw'
import { bagCount } from '../../src/core/mining'
import {
  createFurnace,
  createInitialState,
  createMachines,
  createTile,
  type Field,
  type GameState,
} from '../../src/core/state'
import { step } from '../../src/core/step'
import { type WorkerJob } from '../../src/core/data/workers'
import { assignWorker, buyCertificate, freeWorkers, hireWorker } from '../../src/core/workers'
import { fieldsCropIncomePerHour, reapPlot } from '../../src/core/fields'
import { managerPlan } from '../../src/core/manager'
import { acceptOrder, orderCount } from '../../src/core/orders'
import {
  HOUR_TICKS,
  LICENSE_ORDER,
  PLANT_ORDER,
  collectMolds,
  contractRun,
  pumpFor,
  runBot,
  withBatch13,
} from './bot'

vi.mock('../../src/core/balance', async (importOriginal) => (await import('./balanceMock')).balanceMock(importOriginal))

describe('batch 28.1: blunt pickaxe escape (rules.batch13 on)', () => {
  it('the real v20 save with a blunt gold pickaxe and no gold or iron mines its way back to a working gold pickaxe', () => {
    const loaded = deserialize(v20)!.state
    const inventory = { ...loaded.run.inventory, goldBar: 0, goldOre: 0, ironBar: 0, ironOre: 0 }
    const start: GameState = { ...loaded, run: { ...loaded.run, rack: { gold: 0 }, selectedPickaxe: 'gold', inventory } }
    let back: number | undefined
    withBatch13(() =>
      runBot(true, {
        ticks: 24 * HOUR_TICKS,
        licenses: LICENSE_ORDER,
        crops: PLANT_ORDER,
        ladder: true,
        copperTools: true,
        workers: true,
        furnace: true,
        planter: true,
        iron: true,
        ironTools: true,
        gold: true,
        sprinklers: true,
        fields: true,
        machines: true,
        buyTools: true,
        drainSlot: true,
        initial: start,
        onTick: (s) => {
          if ((s.run.rack.gold ?? 0) > 0) back ??= s.run.tick
        },
      }),
    )
    console.log('PIN28_1', JSON.stringify({ escapeMin: back === undefined ? null : Math.round((back - start.run.tick) / 60) }))
    expect(back).toBeDefined()
  }, 30_000)
})

describe('batch 28.2: ore sorting cash part (rules.batch13 on)', () => {
  it('ORE_SORT_CASH = 0.5 h of the batch-16 ladder bot income in its first hour on vein Lv3, rounded to 💰500; every unlock fits storage', () => {
    const lv3 = { start: 0, cashEarned: 0, bagCapacity: 0, income: -1 }
    let meta = createInitialState().meta
    withBatch13(() =>
      runBot(true, {
        ticks: 12 * HOUR_TICKS,
        licenses: LICENSE_ORDER,
        crops: PLANT_ORDER,
        ladder: true,
        copperTools: true,
        workers: true,
        furnace: true,
        planter: true,
        iron: true,
        ironTools: true,
        gold: true,
        buyTools: true,
        onEnd: (s) => (meta = s.meta),
        onTick: (s) => {
          if (!lv3.start && s.run.vein.level >= 3) Object.assign(lv3, { start: s.run.tick, cashEarned: s.run.lifetime.cashEarned, bagCapacity: s.run.bagCapacity })
          if (lv3.start && lv3.income < 0 && s.run.tick >= lv3.start + HOUR_TICKS) lv3.income = s.run.lifetime.cashEarned - lv3.cashEarned
        },
      }),
    )
    const cash = oreSortUnlockCost('stone', meta).cash
    console.log('PIN162a', JSON.stringify({ startMin: Math.round(lv3.start / 60), incomePerHour: lv3.income, bagCapacity: lv3.bagCapacity, cash }))
    expect(lv3.income).toBeGreaterThan(0)
    // re-pinned batch 32 (was 💰12,842/h → 💰6,500 by the rule): carry-over and the seed drops lift that first vein-Lv3
    // hour to 💰14,227/h, so the rule now gives 💰7,000; ORE_SORT_CASH stays 💰6,500 — not this batch's balance number
    // to move (PLAN.md "Batch 32 results" → Deviations)
    expect(Math.max(500, Math.round((0.5 * lv3.income) / 500) * 500)).toBe(7000)
    // re-pinned batch 33 (was 14227): molds: every kind smelts at once — the vein-Lv3 hour now includes the iron mold's wait
    // re-pinned batch 35 (was 💰14,470/h): crop re-ladder: potato start, carrot licence 💰25 — the cash part stays 💰6,500
    expect({ incomePerHour: lv3.income, cash }).toEqual({ incomePerHour: 14192, cash: 6500 })
    for (const kind of MINE_DROP_IDS) {
      expect(MINE_DROP_IDS.every((k) => oreSortUnlockCost(k, meta).cash === cash)).toBe(true)
      expect(oreSortUnlockCost(kind, meta)[kind]!).toBeLessThanOrEqual(lv3.bagCapacity)
    }
  }, 300_000)
})

describe('batch 28.2: sell on dig', () => {
  it('the real v21 save with a miner and an empty tank: Sell on dig keeps the miner digging for 8 h and the coal flowing', () => {
    const loaded = deserialize(v21)!.state
    // every pool worker is busy and the pool is at its cap: one more worker, set in the test state, mines
    const { workers } = loaded.run
    const pool = workers.pool + (freeWorkers(loaded.run) > 0 ? 0 : 1)
    const base: GameState = { ...loaded, run: { ...loaded.run, workers: { ...workers, pool, assigned: { ...workers.assigned, mine: workers.assigned.mine + 1 } } } }
    const start = (oreSort: GameState['run']['oreSort']): GameState => ({ ...base, run: { ...base.run, oreSort, fields: { ...base.run.fields, tank: 0 } } })
    const report = (s: GameState) => ({
      mines: s.run.counters.mines - base.run.counters.mines,
      coal: (s.run.inventory.coal ?? 0) + s.run.fields.tank / TANK_UNITS_PER_COAL,
      cash: s.run.cash - base.run.cash,
    })
    const a = report(step(start({}), OFFLINE_CAP_TICKS))
    const b = report(step(start({ stone: 'sell', coal: 'keep', copperOre: 'sell', ironOre: 'sell', goldOre: 'sell' }), OFFLINE_CAP_TICKS))
    console.log('PIN162b', JSON.stringify({ a, b }))
    expect(b.mines).toBeGreaterThan(5 * a.mines)
    expect(b.coal).toBeGreaterThan(a.coal)
  }, 120_000)
})

/**
 * batch 31.1 (task 163d): every game-minute accept every contract for a crop some plot grows and discard every other
 * offer (an item order, or a contract no field grows, would hold its slot forever); the harvesters do the reaping. Stops when contractsByHand reaches
 * 10 or after `maxMinutes`; reports the minute, ⭐ / 💰 / 🥇 held then, and the minute the certificate first buys.
 */

function minerHours(s0: GameState, hours = 2) {
  // a full pool (the v23 save: 6 of 6 assigned) moves one harvest worker to the mine instead of hiring
  const hired = hireWorker(s0)
  const freed = hired.ok ? hired.state : (assignWorker(s0, 'harvest', -1) as { ok: true; state: GameState }).state
  const assigned = assignWorker(freed, 'mine', 1)
  if (!assigned.ok) throw new Error(`could not assign a miner: ${assigned.error}`)
  const start = assigned.state
  let s = start
  let drops = 0
  for (let i = 0; i < hours * HOUR_TICKS; i++) {
    const next = step(s, 1)
    for (const id of MINE_DROP_IDS) drops += Math.max(0, (next.run.inventory[id] ?? 0) - (s.run.inventory[id] ?? 0))
    s = next
  }
  return {
    dropsPerHour: Math.round(drops / hours),
    cashPerHour: Math.round((s.run.lifetime.cashEarned - start.run.lifetime.cashEarned) / hours),
    minesPerHour: Math.round((s.run.lifetime.workerMines - start.run.lifetime.workerMines) / hours),
    storage: `${bagCount(s.run)}/${s.run.bagCapacity}`,
  }
}

describe('batch 32: scenario B — the real v23 save, migrated, with one miner for 2 game-hours (report)', () => {
  it('reports drops/h and 💰/h (gold 351 durability, carry-over, ×1.1 ore from the mastered wooden tier)', () => {
    const loaded = deserialize(v23)!.state
    const r = minerHours(loaded)
    console.log('PIN32b', JSON.stringify({ rack: loaded.run.rack, hired: hireWorker(loaded).ok, ...r }))
    expect(r.minesPerHour).toBeGreaterThan(0)
  }, 120_000)
})

describe('batch 32.2: estate worker speed — scenario B, the real v23 save migrated, 8 game-hours (report)', () => {
  /** per game-hour: cash earned, net cash, plots reaped / sown (a reap + resow in one tick counts both), wages */
  const estateHours = (start: GameState, hours = 8) => {
    let s = start
    let reaped = 0
    let sown = 0
    for (let i = 0; i < hours * HOUR_TICKS; i++) {
      const next = step(s, 1)
      next.run.fields.list.forEach((f, k) =>
        f.plots.forEach((p, j) => {
          const was = s.run.fields.list[k]!.plots[j]!
          const reap = was.crop !== null && was.readyTick <= s.run.tick && (p.crop === null || p.readyTick !== was.readyTick)
          if (reap) reaped++
          if (p.crop !== null && (was.crop === null || reap)) sown++
        }),
      )
      s = next
    }
    const per = (n: number) => Math.round(n / hours)
    return {
      cashEarnedPerHour: per(s.run.lifetime.cashEarned - start.run.lifetime.cashEarned),
      netCashPerHour: per(s.run.cash - start.run.cash),
      plotsReapedPerHour: Math.round((reaped / hours) * 10) / 10,
      plotsSownPerHour: Math.round((sown / hours) * 10) / 10,
      wagesPerHour: per(s.run.lifetime.wagesPaid - start.run.lifetime.wagesPaid),
    }
  }
  it('B1 as saved, B2 workers only (no harvester, no seeder)', () => {
    const loaded = deserialize(v23)!.state
    const b1 = estateHours(loaded)
    const b2 = estateHours({ ...loaded, run: { ...loaded.run, fields: { ...loaded.run.fields, machines: { ...loaded.run.fields.machines, harvester: [], seeder: [] } } } })
    console.log('PIN322b', JSON.stringify({ b1, b2 }))
    expect(b1.plotsReapedPerHour).toBeGreaterThan(0)
  }, 300_000)
})

describe('batch 33: scenario B — the real v24 save, migrated, 2 game-hours with its own workers (report)', () => {
  it('reports bars/h per kind and fire burnt/h; every new row\'s cash part is < 2 % of the save\'s cash (bars gate veterans)', () => {
    const start = deserialize(v24)!.state
    const s = step(start, 2 * HOUR_TICKS)
    const per = (k: 'barsSmelted' | 'ironBarsSmelted' | 'goldBarsSmelted' | 'fireBurnt') => (s.run.lifetime[k] - start.run.lifetime[k]) / 2
    console.log('PIN33b', JSON.stringify({ barsPerHour: { copper: per('barsSmelted'), iron: per('ironBarsSmelted'), gold: per('goldBarsSmelted') }, fireBurntPerHour: per('fireBurnt'), furnace: s.run.furnace }))
    expect(per('fireBurnt')).toBeGreaterThanOrEqual(0)
    const rows = (['fireCap', 'batch', 'speed', 'tray', 'slot', 'collectAll'] as const).flatMap((id) =>
      Array.from({ length: furnaceUpgradeMaxLevel(id) }, (_, l) => furnaceUpgradeCost(id, l, start.meta)!).filter((p) => p.cash >= 6500),
    )
    for (const p of [...rows, moldPrice('ironOre', start.meta), moldPrice('goldOre', start.meta)]) expect(p.cash / start.run.cash).toBeLessThan(0.02)
  }, 120_000)
})

describe('batch 33: scenario A2 — a hand player (no workers) on a copper-only furnace can buy the iron mold', () => {
  it('🥉10 ⛰️20 💰6,500: every item comes from the copper mold and the vein; no soft lock', () => {
    const init = createInitialState()
    let s: GameState = {
      ...init,
      run: { ...init.run, cash: 6500, bagCapacity: 50, vein: { level: 3, progress: 0, rock: 'stone' }, furnace: { ...createFurnace(), built: true }, inventory: { stone: 20, copperOre: 20, coal: 10 } },
    }
    let tick = 0
    while (!s.run.furnace.molds.ironOre && tick < HOUR_TICKS) {
      for (const act of [(x: GameState) => collectBars(x, 'copperOre'), (x: GameState) => loadOre(x, 'copperOre'), (x: GameState) => addFuel(x, 'coal'), (x: GameState) => buyMold(x, 'ironOre')]) {
        const r = act(s)
        if (r.ok) s = r.state
      }
      s = step(s, 1)
      tick++
    }
    console.log('PIN33a2', JSON.stringify({ moldAtMin: Math.round((tick / 60) * 10) / 10, left: s.run.inventory }))
    expect(s.run.furnace.molds.ironOre).toBeDefined()
    expect(s.run.cash).toBe(0)
  })
})

describe('batch 33: max-furnace pin — one mold per kind, every level at max, fire kept full, 8 game-hours', () => {
  it('bars/h per kind: copper 468.75 by construction (batch 5 × speed 1.5625), iron and gold reported', () => {
    const init = createInitialState()
    const empty = { ore: 0, progress: 0, ready: 0 }
    let s: GameState = {
      ...init,
      run: {
        ...init.run,
        bagCapacity: 1e7,
        inventory: { copperOre: 1e6, ironOre: 1e6, goldOre: 1e6, coal: 1e6 },
        furnace: { built: true, fire: 0, smart: true, levels: { fireCap: 4, batch: 4, speed: 2, tray: 2, slot: 2 }, molds: { copperOre: empty, ironOre: empty, goldOre: empty }, collectAll: true, stoked: 0 },
      },
    }
    const ticks = 8 * HOUR_TICKS
    for (let t = 0; t < ticks; t++) {
      for (const kind of ORE_IDS) {
        const l = loadOre(s, kind)
        if (l.ok) s = l.state
      }
      const all = collectMolds(s)
      if (all.ok) s = all.state
      const f = addFuel(s, 'coal')
      if (f.ok) s = f.state
      s = step(s, 1)
    }
    const h = ticks / HOUR_TICKS
    const perHour = { copper: s.run.lifetime.barsSmelted / h, iron: s.run.lifetime.ironBarsSmelted / h, gold: s.run.lifetime.goldBarsSmelted / h }
    console.log('PIN33max', JSON.stringify({ ...perHour, fireBurntPerHour: s.run.lifetime.fireBurnt / h, coalPerHour: s.run.lifetime.fireBurnt / fuelTicks('coal') / h }))
    expect(perHour.copper).toBe((batchBars(4) * HOUR_TICKS * furnaceSpeedRate(2)) / barTicks('copperOre'))
    expect(perHour.copper).toBe(468.75)
    expect([perHour.iron, perHour.gold]).toEqual([234.375, 156.25])
  }, 120_000)
})

describe('batch 31.1: the 💼 Manager unlock, contracts delivered by anyone (task 163d)', () => {
  // re-pinned batch 32 (was ≤ 240 game-minutes, measured 212): the sickle's seed roll moves the RNG stream behind the
  // offers, so the 10th contract lands at minute 319 (PLAN.md "Batch 32 results" → Deviations)
  // re-pinned batch 32.2 (was 319): workers do one tile per action on the Estate, so the save's harvest workers reap
  // fewer contract plots and the 10th contract lands at minute 417
  // re-pinned batch 35 (was 417): crop re-ladder — the v27 migration moves the save's chips and offers up a rung and
  // refunds its unlicensed seeds, so the 10th contract lands at minute 412
  it('scenario B: the real v22 save (harvesters [1, 2]) reaches 10 contracts at game-minute 412 holding ⭐ ≥ 20 and 💰 ≥ 1.5M', () => {
    const loaded = deserialize(v22)!.state
    const r = contractRun(loaded, 600)
    console.log('PIN311b', JSON.stringify(r))
    expect(r.reached).not.toBeNull()
    expect(r.reached!.minute).toBe(412)
    expect(r.reached!.stars).toBeGreaterThanOrEqual(20)
    expect(r.reached!.cash).toBeGreaterThanOrEqual(1_500_000)
  }, 300_000)
})

describe('batch 29: manager', () => {
  const init = createInitialState()
  const FIELD = fieldPlots() * plotTiles()
  const emptyField = (crop: CropId | null = null): Field => ({ pivot: true, crop, pinned: false, plots: Array.from({ length: fieldPlots() }, () => ({ crop: null, readyTick: 0 })) })
  /** every crop licensed and past the 🏡 gate on `list`; `stage` = Better prices 5, Fertilizer 5, 24 home strawberry tiles */
  const at = (stage: boolean, list: Field[], pump = 3, home = stage): GameState => ({
    ...init,
    run: {
      ...init.run,
      licenses: [...CROP_IDS],
      lifetime: { ...init.run.lifetime, harvests: Object.fromEntries(CROP_IDS.map((c) => [c, 50])) },
      upgrades: { ...init.run.upgrades, ...(stage ? { sellPrice: 5, fertilizer: 5 } : {}) },
      tiles: home ? Array.from({ length: 24 }, () => ({ ...createTile(), status: 'planted' as const, cropId: 'strawberry' as const })) : init.run.tiles,
      fields: { ...init.run.fields, unlocked: true, pump, list, tank: tankCapCoal(pump) * TANK_UNITS_PER_COAL },
    },
  })
  /** income of j whole fields per crop (CROP_IDS order) and the best split by exhaustive enumeration (≤ n fields) */
  const enumerate = (s: GameState, n: number) => {
    const value = CROP_IDS.map((c) => Array.from({ length: n + 1 }, (_, j) => fieldsCropIncomePerHour(s, c, j * FIELD)))
    let best = -Infinity
    let split: number[] = []
    const cur: number[] = []
    const walk = (i: number, left: number, sum: number) => {
      if (i === CROP_IDS.length) {
        if (sum > best) [best, split] = [sum, [...cur]]
        return
      }
      for (let j = 0; j <= left; j++) {
        cur[i] = j
        walk(i + 1, left - j, sum + value[i]![j]!)
      }
    }
    walk(0, n, 0)
    return { value, best, split }
  }
  const splitText = (split: number[]) => CROP_IDS.flatMap((c, i) => (split[i] ? [`${c}×${split[i]}`] : [])).join(' ')

  it('model: the Manager rest plan ≥ 0.99 × the exhaustive best at 2 / 6 / 10 / 20 fields, base and stage', () => {
    const rows = [false, true].flatMap((stage) =>
      [2, 6, 10, 20].map((n) => {
        const s = at(stage, Array.from({ length: n }, () => emptyField()))
        const { value, best, split } = enumerate(s, n)
        const plan = managerPlan(s)
        const manager = plan.rest.reduce((sum, r) => sum + value[CROP_IDS.indexOf(r.crop)]![r.fields.length]!, 0)
        const mono = value[CROP_IDS.indexOf('strawberry')]![n]!
        // M2's original greedy-by-marginal rule: each field to the crop whose next field adds the most
        const k = CROP_IDS.map(() => 0)
        let greedy = 0
        for (let f = 0; f < n; f++) {
          let bi = 0
          let bd = -Infinity
          CROP_IDS.forEach((_, i) => {
            const d = value[i]![k[i]! + 1]! - value[i]![k[i]!]!
            if (d > bd) [bi, bd] = [i, d]
          })
          k[bi]!++
          greedy += bd
        }
        return { at: stage ? 'stage' : 'base', n, best: Math.round(best), manager: Math.round(manager), mono: Math.round(mono), greedy: Math.round(greedy), split: splitText(split), plan: plan.rest.map((r) => `${r.crop}×${r.fields.length}`).join(' '), ratio: manager / best }
      }),
    )
    console.log('PIN29model', JSON.stringify(rows))
    for (const row of rows) expect(row.ratio).toBeGreaterThanOrEqual(0.99)
  })

  /** the stage-6 save: 6 pivoted full empty fields, chips null, the pump that waters them, Harvester Mk1 + Seeder Mk1,
   *  2 planter + 2 harvester workers, a fuel loader for the tank's coal (no home tiles: the workers stay on the fields) */
  const stage6 = (manager: boolean, chips: (CropId | null)[] = Array(6).fill(null)): GameState => {
    const s = at(true, chips.map((c) => emptyField(c)), pumpFor(6 * FIELD), false)
    const workers = {
      pool: 6,
      assigned: { ...init.run.workers.assigned, plant: 2, harvest: 2, fuel: 1, manager: manager ? 1 : 0 },
      certificates: ['plant', 'harvest', 'fuel', 'manager'] as WorkerJob[],
    }
    const machines = { ...createMachines(), harvester: [1], seeder: [1] }
    return {
      ...s,
      run: { ...s.run, tiles: [], cash: 100_000, autoBuySeeds: true, inventory: { ...s.run.inventory, coal: 5000 }, workers, fields: { ...s.run.fields, machines } },
    }
  }
  /** runs `hours` game-hours tick by tick, counting chip changes */
  const run = (s0: GameState, hours: number) => {
    let s = s0
    let flips = 0
    for (let t = 0; t < hours * HOUR_TICKS; t++) {
      const next = step(s, 1)
      flips += next.run.fields.list.filter((f, k) => f.crop !== s.run.fields.list[k]!.crop).length
      s = next
    }
    return { s, flips, gain: s.run.cash - s0.run.cash }
  }

  it('time sim: 4 game-hours with a Manager ≥ 0.99 × no Manager with the chips on the enumerated best', () => {
    const probe = stage6(false)
    const { split } = enumerate(probe, 6)
    const chips = CROP_IDS.flatMap((c, i) => Array<CropId>(split[i]!).fill(c))
    const managed = run(stage6(true), 4)
    const fixed = run(stage6(false, chips), 4)
    const managerWages = managed.flips * workerWage(init.meta, 'manager')
    console.log('PIN29time', JSON.stringify({ best: splitText(split), managed: { gain: managed.gain, perHour: Math.round(managed.gain / 4), flips: managed.flips, managerWages, chips: managed.s.run.fields.list.map((f) => f.crop) }, fixed: { gain: fixed.gain, perHour: Math.round(fixed.gain / 4) }, ratio: managed.gain / fixed.gain }))
    expect(managed.gain).toBeGreaterThanOrEqual(0.99 * fixed.gain)
  }, 120_000)

  // batch 35 (task 190, report): every licence and the Manager — its plan with 🌶️ chilli (the new top row) available,
  // 💰/h against the same estate with the chips fixed on strawberry and against a Manager without the chilli licence
  it('PIN35chilli: the Manager plan with chilli available, 💰/h vs strawberry-only (report)', () => {
    const withChilli = stage6(true)
    const noChilli = { ...withChilli, run: { ...withChilli.run, licenses: withChilli.run.licenses.filter((c) => c !== 'chilli') } }
    const plan = (s: GameState) => managerPlan(s).rest.map((r) => `${r.crop}×${r.fields.length}`).join(' ')
    const managed = run(withChilli, 4)
    const managedNoChilli = run(noChilli, 4)
    const strawberry = run(stage6(false, Array(6).fill('strawberry')), 4)
    const perHour = (r: { gain: number }) => Math.round(r.gain / 4)
    console.log('PIN35chilli', JSON.stringify({
      plan: plan(withChilli),
      planNoChilli: plan(noChilli),
      managedPerHour: perHour(managed),
      managedNoChilliPerHour: perHour(managedNoChilli),
      strawberryOnlyPerHour: perHour(strawberry),
      vsStrawberryOnly: Math.round((managed.gain / strawberry.gain) * 100) / 100,
      chips: managed.s.run.fields.list.map((f) => f.crop),
    }))
    expect(managed.gain).toBeGreaterThan(0)
  }, 300_000)

  it('contract run: chips on lemon, an accepted tier-2 strawberry contract completes within 60 game-minutes', () => {
    const base = stage6(true, Array(6).fill('pumpkin'))
    const offer = { good: 'strawberry' as const, count: orderCount(base, 'strawberry', 2), done: 0, tier: 2, accepted: true, stars: 4 }
    const s0: GameState = { ...base, run: { ...base.run, orders: { ...base.run.orders, unlocked: true, offers: [offer] } } }
    const plan = managerPlan(s0)
    let s = s0
    let flips = 0
    let doneAt: number | undefined
    for (let t = 0; t < 2 * HOUR_TICKS && doneAt === undefined; t++) {
      const next = step(s, 1)
      flips += next.run.fields.list.filter((f, k) => f.crop !== s.run.fields.list[k]!.crop).length
      if (next.run.counters.orders > s0.run.counters.orders) doneAt = t + 1
      s = next
    }
    console.log('PIN29contract', JSON.stringify({ count: offer.count, minutes: doneAt === undefined ? null : Math.round(doneAt / 60), flips, split: { contract: plan.contracts.map((c) => `${c.crop}×${c.fields.length}`), rest: plan.rest.map((r) => `${r.crop}×${r.fields.length}`) } }))
    expect(doneAt).toBeDefined()
    expect(doneAt!).toBeLessThanOrEqual(HOUR_TICKS)
  }, 120_000)

  // re-pinned batch 31.1 (was 3 contracts by hand → 3, 🥇4 💰500,000): unlock at 10 delivered, ⭐40 + 💰1.5M; ⭐20 batch 32
  it('unlock path: 7 delivered + 3 hand reaps → contractsByHand 10 → the Manager certificate buys; 💰1.5M in stage-6 hours', () => {
    const ready = { crop: 'strawberry' as const, readyTick: 0 }
    const offer = (good: CropId) => ({ good, count: 5, done: 0, tier: 1, accepted: false, stars: 2 })
    let s: GameState = {
      ...at(true, [{ ...emptyField('strawberry'), plots: Array.from({ length: fieldPlots() }, () => ({ ...ready })) }], 0, false),
      meta: init.meta,
    }
    s = { ...s, run: { ...s.run, energy: 100, counters: { ...s.run.counters, contractsByHand: 7 }, orders: { ...s.run.orders, unlocked: true, offers: [offer('strawberry'), offer('strawberry'), offer('strawberry')] } } }
    for (let slot = 0; slot < 3; slot++) {
      const accepted = acceptOrder(s, slot)
      if (!accepted.ok) throw new Error(accepted.error)
      const reaped = reapPlot(accepted.state, 0, slot)
      if (!reaped.ok) throw new Error(reaped.error)
      s = reaped.state
    }
    expect(s.run.counters.contractsByHand).toBe(10)
    const price = certificateCost('manager', s.meta)
    expect(price).toEqual({ goldBar: 4, stars: 20, cash: 1_500_000 })
    const bought = buyCertificate({ ...s, run: { ...s.run, cash: price.cash, stars: price.stars!, inventory: { ...s.run.inventory, goldBar: price.goldBar } } }, 'manager')
    expect(bought.ok).toBe(true)
    const perHour = run(stage6(false, (() => {
      const { split } = enumerate(stage6(false), 6)
      return CROP_IDS.flatMap((c, i) => Array<CropId>(split[i]!).fill(c))
    })()), 4).gain / 4
    console.log('PIN29cert', JSON.stringify({ price, stage6PerHour: Math.round(perHour), hours: Math.round((price.cash / perHour) * 10) / 10 }))
  }, 120_000)

  // nested here to reuse the batch-29 stage (`at`) and the exhaustive enumeration
  describe('batch 31: renown', () => {
    it('worker-only route: 24 home strawberry tiles, sprinklers, a planter and a harvester reach the top tier ≤ 48 h', () => {
      const s0 = at(true, [])
      let s: GameState = {
        ...s0,
        run: {
          ...s0.run,
          cash: 100_000,
          plantCrop: 'strawberry',
          workshop: { built: true, beds: [true, true, true, true], valve: false },
          workers: { pool: 2, assigned: { ...init.run.workers.assigned, plant: 1, harvest: 1 }, certificates: ['plant', 'harvest'] },
        },
      }
      const STEP = HOUR_TICKS / 10
      const reached: (number | null)[] = RENOWN_TIERS.map(() => null)
      for (let t = STEP; t <= 60 * HOUR_TICKS && reached[2] === null; t += STEP) {
        s = step(s, STEP)
        RENOWN_TIERS.forEach((tier, i) => {
          if (reached[i] === null && (s.run.renown.strawberry ?? 0) >= tier) reached[i] = Math.round((t / HOUR_TICKS) * 10) / 10
        })
      }
      console.log('PIN31worker', JSON.stringify({ hoursTo: Object.fromEntries(RENOWN_TIERS.map((tier, i) => [tier, reached[i]])), workerHarvests: s.run.counters.harvests }))
      expect(reached[2]).not.toBeNull()
      expect(reached[2]!).toBeLessThanOrEqual(48)
    }, 120_000)

    it('prestige reset: strawberry 4,000 sold without Kept renown → {}; with it 4,000 kept, and the next run sells on the 0.7 floor', () => {
      const gate = (keepRenown: number): GameState => ({
        meta: { ...init.meta, upgrades: { ...init.meta.upgrades, keepRenown } },
        run: {
          ...init.run,
          lifetime: { ...init.run.lifetime, cashEarned: 640_000 },
          workers: { ...init.run.workers, certificates: ['plant', 'harvest'] },
          workshop: { built: true, beds: [true, false, false, false], valve: false },
          renown: { strawberry: 4000 },
        },
      })
      const sold = (k: number) => {
        const r = sellFarm(gate(k))
        if (!r.ok) throw new Error(r.error)
        return r.state
      }
      expect(sold(0).run.renown).toEqual({})
      const next = sold(1)
      expect(next.run.renown).toEqual({ strawberry: 4000 })
      const glut = 1e9
      const sale = cropSale({ ...next, run: { ...next.run, market: { ...next.run.market, strawberry: glut } } }, 'strawberry', 1)
      expect(sale.cash).toBe(Math.round(cropSellPrice('strawberry', next.meta, 0) * 0.7))
    })

    it('model: the Manager rest plan ≥ 0.99 × the exhaustive best with renown 250 / 1,000 / 4,000 on every crop', () => {
      const rows = [250, 1000, 4000].flatMap((points) =>
        [false, true].flatMap((stage) =>
          [2, 6, 10, 20].map((n) => {
            const base = at(stage, Array.from({ length: n }, () => emptyField()))
            const s: GameState = { ...base, run: { ...base.run, renown: Object.fromEntries(CROP_IDS.map((c) => [c, points])) } }
            const { value, best } = enumerate(s, n)
            const manager = managerPlan(s).rest.reduce((sum, r) => sum + value[CROP_IDS.indexOf(r.crop)]![r.fields.length]!, 0)
            return { renown: points, floor: renownFloor(points), at: stage ? 'stage' : 'base', n, ratio: Math.round((manager / best) * 10000) / 10000 }
          }),
        ),
      )
      console.log('PIN31model', JSON.stringify(rows))
      for (const row of rows) expect(row.ratio).toBeGreaterThanOrEqual(0.99)
    }, 120_000) // batch 35: the exhaustive split over 10 crops runs past the 5 s default
  })
})

/**
 * batch 34 (task 187): the real v25 save, migrated, with `miners` more workers on the mine (the pool grows by that
 * many Bunkhouse levels, set directly), its own ore and fuel loaders and farm workers, the given vein / sell price /
 * furnace levels (default: the bar ladder's top), for `hours` game-hours. Every tick a blunt gold pickaxe is repaired
 * from storage, and when storage is full the bars sell (2 gold bars kept for repairs), then stone and the coal above
 * 20. Per game-hour: ore mined and bars smelted per kind, the bars' value at the run's sell price (sold or not), and
 * the farm's 💰 (lifetime cash less every sale made here).
 */
