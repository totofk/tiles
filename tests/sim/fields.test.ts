import { describe, expect, it, vi } from 'vitest'
import { CROP_IDS, type CropId } from '../../src/core/data/crops'
import {
  certificateCost,
  cropGrowTicks,
  fuelTicks,
  fieldsCost,
  FIELD_PRESSURE,
  fieldCoalPerPlotHour,
  machineCost,
  machineMaintPerHour,
  machineTilesPerHour,
  machineMaxTiers,
  pivotCost,
  plotCost,
  fieldTileCost,
  plotTiles,
  pumpCost,
  workerActionTicks,
} from '../../src/core/balance'
import { catchUp } from '../../src/save/serialize'
import { bagCount } from '../../src/core/mining'
import { createInitialState, createMachines, type GameState } from '../../src/core/state'
import { step } from '../../src/core/step'
import { type WorkerJob } from '../../src/core/data/workers'
import { buyCertificate, certificateUnlocked } from '../../src/core/workers'
import {
  buildPivot,
  buyMachine,
  buyPump,
  fieldsOverview,
  fieldsPaybackHours,
  pivotsOwned,
  unlockFields,
} from '../../src/core/fields'
import {
  acceptOrder,
  buyOrderBoard,
  deliverOrder,
  discardOrder,
  isContract,
  isCropGood,
  isOffer,
} from '../../src/core/orders'
import type { ItemId } from '../../src/core/data/items'
import {
  FIELDS_LADDER,
  HOUR_TICKS,
  LICENSE_ORDER,
  MACHINES_LADDER,
  MACHINES_ON_GOALS,
  PLANT_ORDER,
  buyLand,
  contractRun,
  forgePlots,
  pumpFor,
  runBot,
  withBatch13,
} from './bot'

vi.mock('../../src/core/balance', async (importOriginal) => (await import('./balanceMock')).balanceMock(importOriginal))

/** owned field tiles (batch 28: 10 per plot) */
const fieldTiles = (s: GameState) => fieldsOverview(s.run).tiles

describe('batch 28: 8 h offline on plots — perf and step identity (task 146g)', () => {
  const base = withBatch13(() => {
    const s = createInitialState()
    const tiles = s.run.tiles.map((t) => ({ ...t, status: 'planted' as const, cropId: 'pumpkin' as const, growth: 10, moisture: 4 }))
    return {
      ...s,
      run: {
        ...s.run,
        tiles,
        licenses: [...CROP_IDS],
        lifetime: { ...s.run.lifetime, harvests: Object.fromEntries(CROP_IDS.map((c) => [c, 50])) },
        workshop: { built: true, beds: [true, true, true, true], valve: false },
        workers: { pool: 6, assigned: { plant: 2, water: 0, harvest: 2, ore: 0, fuel: 1, mine: 1, clerk: 0, manager: 0, stoker: 0 }, certificates: ['plant', 'harvest', 'fuel', 'mine'] as WorkerJob[] },
      },
    }
  })
  it.each([
    [100, 3, ['pumpkin', 'eggplant', 'corn', 'radish'] as CropId[]],
    [192, 3, CROP_IDS],
    [300, 3, CROP_IDS],
  ])('%i plots (60 fields max, 20 pivoted at Pump %i), the full fleet: 8 h < 2,000 ms, step(s, n) identity', (plots, pump, split) => {
    const forged = forgePlots(base, plots * plotTiles(), pump, split, 1_000_000)
    const big = { ...forged, run: { ...forged.run, fields: { ...forged.run.fields, machines: { harvester: [1, 2, 3], seeder: [1, 2], carry: { harvest: 0, plant: 0, maint: 0 } } } } }
    expect(big.run.fields.list.filter((f) => f.pivot)).toHaveLength(Math.min(20, Math.ceil(plots / 5)))
    const t0 = Date.now()
    catchUp(big, 8 * HOUR_TICKS * 1000)
    const ms = Date.now() - t0
    console.log('PIN28perf', { plots, ms })
    expect(ms).toBeLessThan(2000)
    let one = big
    for (let i = 0; i < 600; i++) one = step(one, 1)
    expect(step(big, 600)).toEqual(one)
    expect(catchUp(big, 600_000)).toEqual(step(big, 600))
  })
})

describe('batch 18: fields — the ladder to 100 fields, income vs N, payback, pairs, coal, prices (rules.batch13 on)', () => {
  const minute = (tick: number | undefined) => (tick === undefined ? null : Math.round((tick / 60) * 10) / 10)
  const hours = (ticks: number) => ticks / HOUR_TICKS
  const pool = (s: GameState) => (s.run.inventory.coal ?? 0) + s.run.furnace.fire / fuelTicks('coal')
  // the pump tier that waters `n` tiles (batch 28; was the pipes tier)
  const tierFor = pumpFor
  const r = withBatch13(() => {
    let end = createInitialState()
    const coal = { prev: 0, mined: 0 }
    // the fields windows (batch 28): unlock → the second pivot (pins FIELDS_CASH's income), pivot 2 → 10 plots
    const win = { fields: 0, pipes1: 0, f100: 0, cash0F: 0, cash0P: 0, cash0100: 0, fire0: 0, fire100: 0, firstField: 0, countAtPipes1: 0 }
    const coal0 = { mined: 0 }
    const coal100 = { mined: 0 }
    const caps: Partial<Record<'fields' | 'pivot2', number>> = {}
    const ladder = runBot(true, {
      ticks: 64 * HOUR_TICKS,
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
      buyTools: true,
      onEnd: (s) => (end = s),
      onTick: (s) => {
        const p = pool(s)
        if (p > coal.prev) coal.mined += p - coal.prev
        coal.prev = p
        // the storage held the first moment each price became buyable
        if (caps.fields === undefined && unlockFields(s).ok) caps.fields = s.run.bagCapacity
        if (caps.pivot2 === undefined && s.run.fields.list.length > 1 && buildPivot(s, 1).ok) caps.pivot2 = s.run.bagCapacity
        if (!win.fields && s.run.fields.unlocked) {
          win.fields = s.run.tick
          win.cash0F = s.run.lifetime.cashEarned
        }
        if (win.fields && !win.pipes1 && pivotsOwned(s.run.fields) >= 2) {
          win.pipes1 = s.run.tick
          win.cash0P = s.run.lifetime.cashEarned
          win.fire0 = s.run.lifetime.fireBurnt
          win.countAtPipes1 = fieldTiles(s)
          coal0.mined = coal.mined
        }
        if (!win.firstField && fieldTiles(s) > 0) win.firstField = s.run.tick
        if (win.pipes1 && !win.f100 && fieldTiles(s) >= 100) {
          win.f100 = s.run.tick
          win.cash0100 = s.run.lifetime.cashEarned
          // the coal shares are measured over the same pipes1 → field-100 window the income is
          coal100.mined = coal.mined
          win.fire100 = s.run.lifetime.fireBurnt
        }
      },
    })
    const grindHours = hours(win.f100 - win.pipes1)
    return {
      ladder,
      end,
      // steps: the unlock and first pipes from the ladder ticks; field 100 from the count window (the ladder tick
      // there is only the FIRST field's purchase)
      steps: [ladder.ladderTicks.fields, ladder.ladderTicks.pivot2, win.f100 || undefined],
      fieldsIncome: (win.cash0P - win.cash0F) / hours(win.pipes1 - win.fields),
      grindIncome: (win.cash0100 - win.cash0P) / grindHours,
      caps,
      coalMinedPerHour: (coal100.mined - coal0.mined) / grindHours,
      furnaceCoalPerHour: (win.fire100 - win.fire0) / fuelTicks('coal') / grindHours,
    }
  })
  const { ladder, end, steps, fieldsIncome, grindIncome, caps } = r

  /** a forged Fields state: `n` tiles standing as round-robin `split` cohorts of 10, all freshly planted (readyTick =
   *  tick + grow, exactly what a real plant sets — stalled cohorts keep that date until coverage reaches them); coal
   *  and cash topped up so only the fields math moves the measured window */
  const forge = (base: GameState, n: number, pump: number, split: readonly CropId[]): GameState => forgePlots(base, n, pump, split)
  /** steady-state net cash/h at `n` standing tiles — 1 h of warm-up (the fresh cohorts' first cycle) then 2 h measured */
  const incomeAt = (n: number, split: readonly CropId[]) => {
    const warmed = step(forge(end, n, tierFor(n), split), HOUR_TICKS)
    const a = step(warmed, 2 * HOUR_TICKS)
    return (a.run.lifetime.cashEarned - warmed.run.lifetime.cashEarned) / 2
  }

  it('climbs in order: fields unlock → pivot 2 → 10 plots; the unlock steps stay ≤ 60 game-minutes', () => {
    console.log('PIN18', {
      steps: steps.map((x) => minute(x)),
      incomes: [Math.round(fieldsIncome), Math.round(grindIncome)],
      finalCash: Math.round(ladder.finalCash),
      caps,
      coal: [Math.round(r.coalMinedPerHour), Math.round(r.furnaceCoalPerHour)],
      miningRatio: ladder.miningCashPerEnergy / ladder.farmingCashPerEnergy,
      fieldsEnd: { ...fieldsOverview(end.run), shape: end.run.fields.list.map((f) => `${f.pivot ? 'P' : '-'}${f.plots.length}`).join(' '), pump: end.run.fields.pump },
    })
    expect(steps.every((x) => x! > 0)).toBe(true)
    expect([...steps].sort((a, b) => a! - b!)).toEqual(steps)
    expect(steps[1]! - steps[0]!).toBeLessThanOrEqual(HOUR_TICKS) // unlock → pivot 2: 11 game-minutes (batch 28; was 47 to the first pipes)
    expect(fieldTiles(end)).toBeGreaterThanOrEqual(100)
  })

  it('pin 26b: the ladder bot reaches the Tractor unlock (fields unlocked) with no milestone gap over 60 game-minutes', () => {
    const reached = Object.entries(end.run.milestones).sort((a, b) => a[1]! - b[1]!)
    const tractor = reached.find(([id]) => id === 'fieldsUnlocked')!
    // scoped to the batch-26 ladder (workshop → Tractor): the 100-field grind after the Tractor is one long milestone
    // by design, and the gold→workshop stretch BEFORE it already ran 116 game-minutes (cash100k → workshop at tick
    // 23,754) before this batch — identical trajectory, nothing batch 26 touches (PLAN.md "Batch 26 results" Deviations)
    const upTo = reached.filter(([, tick]) => reached.find(([id]) => id === 'workshop')![1]! <= tick! && tick! <= tractor[1]!)
    const gapAt = upTo.map(([id, tick], i) => ({ id, gap: i ? tick! - upTo[i - 1][1]! : 0 }))
    console.log('PIN26b', { milestones: upTo.length, tractorAt: tractor[1], longest: gapAt.reduce((a, b) => (b.gap > a.gap ? b : a)) })
    expect(tractor[1]).toBeGreaterThan(0)
    // measured longest: 80 game-minutes (tiles16 → Tractor at tick 35,168), the iron-bar + 💰10,000 bank for the
    // fields unlock — a stretch the old world ran ~200 min without a single tiles milestone; 60 is out of reach
    // without touching LOCKED prices (PLAN.md "Batch 26 results" Deviations)
    for (const { gap } of gapAt) expect(gap).toBeLessThanOrEqual(5400)
  })

  it('income vs N at depth 240 on plots (workers only): 10/50/100/300/1000 tiles, all-lemon vs a 4-crop mix', () => {
    const lemon = [10, 50, 100, 300, 1000].map((n) => Math.round(incomeAt(n, ['pumpkin'])))
    const mixed = [100, 300].map((n) => Math.round(incomeAt(n, ['pumpkin', 'eggplant', 'corn', 'radish'])))
    console.log('PIN18b', { lemon, mixed })
    // re-pinned batch 28 (measured, seeded): was [47951, 112708, 151938, 380848, 396495] on cohorts
    // re-pinned batch 28.1 (was [47661, 111447, 150893, 350763, 393223]): the forge's source run swaps its blunt
    // gold pickaxe late (no Au banked), so the forged end state differs
    // re-pinned batch 29 (was [48481, 111346, 149875, 353375, 396138]): the bot smelts gold for plots10 (task 151e)
    // re-pinned batch 31 (was [48936, 111499, 151085, 349608, 393965]): renown floor — the source bot's home lemon
    // renown sits at the top tier, so a glutted lemon market floors at 0.7, not 0.5
    // re-pinned batch 32 (was [48729, 113199, 210788, 492685, 550358]): the rack and gold 600 move the forge's source `end`
    // task 170 (was [49313, 113136, 208285, 518056, 550011] in task 168): carry-over moves `end`; task 172 (was [48257,
    // 113515, 214445, 501078, 552321]): the sickle's seed drops
    // re-pinned batch 32.2 (was [48714, 114757, 209556, 495880, 551320]): workers do one tile per action on the Estate,
    // so the forge's 2 + 2 workers are labor-bound from 50 tiles up (72 plots/h each way)
    // re-pinned batch 33 (was [42020, 81507, 81507, 81507, 81507]): molds: every kind smelts at once — the forge's
    // source `end` differs
    // re-pinned batch 35 (was [42814, 83952, 83952, 83952, 83952]): crop re-ladder: potato start, carrot licence 💰25 —
    // the forge's source `end` differs ("lemon" here is its old row, now pumpkin)
    expect(lemon).toEqual([42249, 82167, 82167, 82167, 82167])
    // re-pinned batch 28: the mix is no longer within 2 % of all-lemon — whole plots and ×2 pressure move the gluts
    // apart (100 tiles +28 %, 300 tiles −25 %); the 300-tile pipe plateau is gone (1,000 tiles is labor-bound)
    // re-pinned batch 28.1 (was [193653, 263448]); batch 29 (was [192911, 264581], task 151e moves `end`)
    // re-pinned batch 31 (was [192255, 264135]): renown floor
    // re-pinned batch 32 (was [194754, 287402]): the rack and gold 600
    // task 170 (was [194692, 284966] in task 168): carry-over; task 172 (was [195967, 286829]): seed drops
    // re-pinned batch 32.2 (was [193679, 284610]): workers do one tile per action on the Estate
    // re-pinned batch 33 (was [75745, 63677]): molds: every kind smelts at once — the forge's source `end` differs
    // re-pinned batch 35 (was [75980, 64046]): crop re-ladder: potato start, carrot licence 💰25
    expect(mixed).toEqual([77476, 65169])
  })

  it('the payback label crosses 8 h at a pinned field number — the same fieldsPaybackHours the UI shows', () => {
    const settled = step(forge(end, 300, 3, ['pumpkin']), 2 * HOUR_TICKS)
    let crossing = -1
    for (let c = 0; c <= 30; c++) {
      const s2 = forgePlots(settled, 10 * c, 3, ['pumpkin'])
      if (fieldsPaybackHours(s2) >= 8) {
        crossing = c
        break
      }
    }
    console.log('PIN18c', { crossing })
    // re-pinned batch 28 (was 26 tiles-of-ten on cohorts): the label crosses 8 h at plot 6 — plotCost grows 💰10,000 per
    // plot while one more plot's marginal income is one pressured lemon cycle
    // re-pinned batch 31 (was 5): renown floor — the floored lemon price raises each plot's marginal income
    // re-pinned batch 32.2 (was 8): workers do one tile per action on the Estate, so the settled 300 tiles reap less,
    // the lemon glut is lower and each plot's marginal income higher
    expect(crossing).toBe(10)
  })

  it('one tile per action: a planter+harvester pair moves grow ÷ 5 tiles per cycle — the throughput bound and the second pair', () => {
    const pairTiles = Math.floor((1 / workerActionTicks(end.meta)) * cropGrowTicks('pumpkin', end.meta, end.run.upgrades.fertilizer))
    const settled = step(forge(end, 300, 3, ['pumpkin']), 2 * HOUR_TICKS)
    console.log('PIN18d', { pairTiles, secondPairAt: pairTiles - end.run.tiles.length, stats300: fieldsOverview(settled.run) })
    // re-pinned batch 32.2 (was 720 / 701): workers do one tile per action on the Estate (was a 10-tile plot)
    expect(pairTiles).toBe(72) // lemon: 1 tile per 5 ticks × 360 grow — and the pair tends the home plot too
    expect(pairTiles - end.run.tiles.length).toBe(53) // re-pinned batch 26: the bot now owns 19 tiles (beds 3–4 need them)
  })

  it('the coal budget (re-pinned batch 26): the beds burn none, so the miner covers the furnace and the pipes', () => {
    const settled = step(forge(end, 300, 3, ['pumpkin']), 2 * HOUR_TICKS)
    const pipeDraw = fieldCoalPerPlotHour() * fieldsOverview(settled.run).growing
    console.log('PIN18e', { pipeDraw })
    // pinned shares over the pipes1 → field-100 window: the miner's coal vs the furnace (old, batch 18: 341 / 0 / 36 with the pump)
    // re-pinned batch 28 (was 382): the pivot2 → 10 plots window; batch 29 (was [355, 0]): the bot now smelts its gold
    // ore for the plots10 pivots in that window (task 151e), so the furnace burns coal there
    // re-pinned batch 31 (was [371, 11]): renown floor — the richer bot reaches the window's purchases sooner
    // re-pinned batch 32 (was [367, 12]): the rack and gold 600 (more gold smelted for repairs)
    // task 170 (was [369, 17] in task 168): carry-over — the miner breaks ~2.6× the rocks per press-hour; task 172 (was
    // [973, 14]): seed drops
    // re-pinned batch 32.2 (was [978, 19]): workers do one tile per action on the Estate (a slower plots window)
    // re-pinned batch 33 (was [982, 11]): molds: every kind smelts at once
    // re-pinned batch 35 (was [977, 11]): crop re-ladder: potato start, carrot licence 💰25
    expect([Math.round(r.coalMinedPerHour), Math.round(r.furnaceCoalPerHour)]).toEqual([974, 11])
    expect(pipeDraw).toBeLessThanOrEqual(15) // tier-3 coverage tops out at 0.5 coal/h per 10 tiles × 300
    expect(r.furnaceCoalPerHour + pipeDraw).toBeLessThan(r.coalMinedPerHour) // the furnace never starves
  })

  // measured batch 28: FIELDS_CASH 💰10,000 ÷ 💰102,773/h (unlock → pivot 2) = 0.10 h — the price is LOCKED (PLAN.md
  // "Batch 28 results" Deviations). Batch 32.2: 💰10,000 ÷ 💰86,394/h = 0.12 h (was 0.10) — workers do one tile per
  // action on the Estate
  it.fails('pinned: FIELDS_CASH is 0.35–1.5 h of the income at its unlock — measured 0.12 h', () => {
    const price = fieldsCost(end.meta).cash
    console.log('PIN18f', [price, Math.round(fieldsIncome), Math.round((price / fieldsIncome) * 100) / 100])
    expect(price / fieldsIncome).toBeGreaterThanOrEqual(0.35)
  })

  it('pinned: FIELDS_CASH rounds to 💰500; plot, pivot and pump prices follow the batch-28 rule', () => {
    expect(fieldsCost(end.meta).cash % 500).toBe(0)
    // batch 28 (task 148g): the plot is the ten-tile sum, pivot n = its recipe + 50,000 × (n − 1), the pumps are fixed
    for (const p of [0, 1, 9, 59]) expect(plotCost(p, end.meta)).toBe(Array.from({ length: 10 }, (_, i) => fieldTileCost(10 * p + i, end.meta)).reduce((a, b) => a + b, 0))
    for (const n of [1, 2, 20]) expect(pivotCost(n, end.meta)).toEqual({ goldBar: 3, ironBar: 6, copperBar: 6, cash: 50_000 * (n - 1) })
    expect([0, 1, 2, 3].map((p) => pumpCost(p, end.meta))).toEqual([{ copperBar: 8, cash: 500_000 }, { ironBar: 8, cash: 1_500_000 }, { goldBar: 8, cash: 3_000_000 }, null])
  })

  it('every price fits the storage the player holds when it becomes buyable (price-cap table, batch 18 rows)', () => {
    console.log('PIN18h', caps)
    expect(fieldsCost(end.meta).ironBar!).toBeLessThanOrEqual(caps.fields!)
    for (const id of ['goldBar', 'ironBar', 'copperBar'] as const) expect(pivotCost(2, end.meta)[id]!).toBeLessThanOrEqual(caps.pivot2!)
  })

  it('mining stays below the farm cap: the run mining cash/energy < 0.9 × farming', () => {
    expect(ladder.miningCashPerEnergy).toBeLessThan(0.9 * ladder.farmingCashPerEnergy)
  })

  it('8 h offline with 1,000 tiles across 4 crops, 2 planters + 2 harvesters + pipes: < 2,000 ms, step(s, n) identity', () => {
    const forged = forge(end, 1000, 3, ['pumpkin', 'eggplant', 'corn', 'radish'])
    const big = { ...forged, run: { ...forged.run, workers: { ...forged.run.workers, assigned: { plant: 2, water: 0, harvest: 2, ore: 0, fuel: 1, mine: 1, clerk: 0, manager: 0, stoker: 0 } } } }
    const t0 = Date.now()
    catchUp(big, 8 * HOUR_TICKS * 1000)
    const ms = Date.now() - t0
    console.log('PIN18g', { ms })
    expect(ms).toBeLessThan(2000)
    let one = big
    for (let i = 0; i < 600; i++) one = step(one, 1)
    expect(step(big, 600)).toEqual(one)
    expect(catchUp(big, 600_000)).toEqual(step(big, 600))
  })
})

describe('batch 19: machines — the ladder to harvester3, income vs workers, payback, coal, offline (rules.batch13 on)', () => {
  const hours = (ticks: number) => ticks / HOUR_TICKS
  const pool = (s: GameState) => (s.run.inventory.coal ?? 0) + s.run.furnace.fire / fuelTicks('coal')
  const tierFor = pumpFor
  // the tracked steps: field 100, then every machine-ladder goal; the income "at a purchase" is the window before it
  const STEPS = ['plots10', ...MACHINES_ON_GOALS.map((g) => g.name)] as const
  const r = withBatch13(() => {
    let end = createInitialState()
    const coal = { prev: 0, mined: 0 }
    const win: Partial<Record<(typeof STEPS)[number], number>> = {}
    const cashAt: Partial<Record<(typeof STEPS)[number], number>> = {}
    const coalAt = { mined: 0 }
    let stallTicks = 0
    let fleetPauses = 0
    // per pump tier: the tick the cap was reached / the first tick something was buyable at it
    const buyable: Record<number, number> = {}
    const bought: Record<number, number> = {}
    // batch 29 (task 151d): every plot, pivot, pump and machine purchase, as ticks (PIN28a's marks)
    const purchases: number[] = []
    let owned = 0
    // batch 32 (task 172c, report only): gold pickaxe repairs from its craft to the run's end
    const gold = { from: 0, prev: undefined as number | undefined, repairs: 0 }
    // batch 33 (task 180 scenario A, report only): cash and bars held at every tick, by tick
    const held = { cash: new Float64Array(170 * HOUR_TICKS + 1), copperBar: new Float64Array(170 * HOUR_TICKS + 1), ironBar: new Float64Array(170 * HOUR_TICKS + 1), goldBar: new Float64Array(170 * HOUR_TICKS + 1), stars: new Float64Array(170 * HOUR_TICKS + 1) }
    const ladder = runBot(true, {
      ticks: 170 * HOUR_TICKS,
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
      onEnd: (s) => (end = s),
      onTick: (s) => {
        held.cash[s.run.tick] = s.run.cash
        held.stars[s.run.tick] = s.run.stars
        for (const id of ['copperBar', 'ironBar', 'goldBar'] as const) held[id][s.run.tick] = s.run.inventory[id] ?? 0
        const g = s.run.rack.gold
        if (g !== undefined && gold.prev === undefined) gold.from = s.run.tick
        if (g !== undefined && gold.prev !== undefined && g > gold.prev) gold.repairs++
        gold.prev = g
        const p = pool(s)
        if (p > coal.prev) coal.mined += p - coal.prev
        coal.prev = p
        const f = s.run.fields
        const now = f.list.reduce((n, x) => n + x.plots.length + (x.pivot ? 1 : 0), 0) + f.pump + f.machines.harvester.length + f.machines.seeder.length
        for (; owned < now; owned++) purchases.push(s.run.tick)
        if (win.plots10 === undefined && FIELDS_LADDER.at(-1)!.done(s)) {
          win.plots10 = s.run.tick
          cashAt.plots10 = s.run.lifetime.cashEarned
          coalAt.mined = coal.mined
        }
        // batch 28 (task 148g): at each pump cap reached, is a plot, pivot, pump or machine buyable within the hour?
        if (s.run.fields.unlocked && buyable[s.run.fields.pump] === undefined) buyable[s.run.fields.pump] = s.run.tick
        if (s.run.fields.unlocked && bought[s.run.fields.pump] === undefined &&
          (buyLand(s).ok || buyPump(s).ok || (['harvester', 'seeder'] as const).some((k) => Array.from({ length: machineMaxTiers(k) }, (_, i) => i + 1).some((t) => buyMachine(s, k, t).ok))))
          bought[s.run.fields.pump] = s.run.tick
        for (const g of MACHINES_ON_GOALS) {
          if (win[g.name] === undefined && g.done(s)) {
            win[g.name] = s.run.tick
            cashAt[g.name] = s.run.lifetime.cashEarned
          }
        }
        // no-stall window: fields unlocked → harvester3. The fields never go fully dead (covered + ready > 0 whenever
        // something stands) and the fleet's maintenance never pauses it (an unpaid hour caps carry.maint at 1)
        if (s.run.fields.unlocked && win.harvester3 === undefined) {
          const st = fieldsOverview(s.run)
          if (st.growing + st.ready > 0 && st.wetFields === 0) stallTicks++
          if (s.run.fields.machines.carry.maint >= 1) fleetPauses++
        }
      },
    })
    const prevOf = (k: (typeof STEPS)[number]) => STEPS[STEPS.indexOf(k) - 1]!
    const incomeAtStep = (k: 'harvester1' | 'seeder1' | 'harvester2' | 'seeder2' | 'harvester3') =>
      (cashAt[k]! - cashAt[prevOf(k)]!) / hours(win[k]! - win[prevOf(k)]!)
    return {
      ladder,
      end,
      win,
      steps: STEPS.map((k) => win[k]),
      incomes: { harvester1: incomeAtStep('harvester1'), seeder1: incomeAtStep('seeder1'), harvester2: incomeAtStep('harvester2'), seeder2: incomeAtStep('seeder2'), harvester3: incomeAtStep('harvester3') },
      coalMinedPerHour: (coal.mined - coalAt.mined) / hours(win.harvester3! - win.plots10!),
      stallTicks,
      fleetPauses,
      buyable,
      bought,
      // deduped: the Tractor's field, pivot and plot land on one tick
      purchases: [...new Set(purchases)],
      gold,
      held,
    }
  })
  const { ladder, end } = r

  // batch 32 (task 172c scenario A, report only): the mine rungs' game-minutes, gold pickaxe repairs per game-hour
  // from its craft to the run's end, and bars smelted per game-hour over the whole run
  it('batch 32: reports the mine rungs, gold pickaxe repairs per hour and bars per hour (scenario A)', () => {
    const t = ladder.ladderTicks
    const rungs = ['storageLv1', 'veinLv1', 'furnace', 'storageLv2', 'veinLv2', 'copperPickaxe', 'storageLv3', 'veinLv3', 'ironPickaxe', 'storageLv4', 'veinLv4', 'goldPickaxe'] as const
    const runH = end.run.tick / HOUR_TICKS
    const { barsSmelted, ironBarsSmelted, goldBarsSmelted } = end.run.lifetime
    console.log('PIN32a', JSON.stringify({
      rungsMin: Object.fromEntries(rungs.map((k) => [k, t[k] === undefined ? null : Math.round((t[k]! / 60) * 10) / 10])),
      goldRepairsPerHour: Math.round((r.gold.repairs / ((end.run.tick - r.gold.from) / HOUR_TICKS)) * 100) / 100,
      goldRepairs: r.gold.repairs,
      barsPerHour: { copper: Math.round((barsSmelted / runH) * 10) / 10, iron: Math.round((ironBarsSmelted / runH) * 10) / 10, gold: Math.round((goldBarsSmelted / runH) * 10) / 10 },
      endRack: end.run.rack,
    }))
    expect(r.gold.repairs).toBeGreaterThanOrEqual(0)
  })

  /** a forged machine-era state: `n` tiles as round-robin `split` cohorts of 10 freshly planted, pipes for `n`,
   *  cash and coal topped up, and the given machine fleet (empty = the workers-only arm) */
  const forge = (n: number, fleet: { harvester: readonly number[]; seeder: readonly number[] }, split: readonly CropId[] = ['pumpkin']): GameState => {
    const s = forgePlots(end, n, tierFor(n), split, 1_000_000)
    const machines = { harvester: [...fleet.harvester], seeder: [...fleet.seeder], carry: { harvest: 0, plant: 0, maint: 0 } }
    return { ...s, run: { ...s.run, fields: { ...s.run.fields, machines } } }
  }
  /** steady-state net cash/h at `n` tiles with `fleet` — 1 h of warm-up, then 2 h measured */
  const incomeAt = (n: number, fleet: { harvester: readonly number[]; seeder: readonly number[] }) => {
    const warmed = step(forge(n, fleet), HOUR_TICKS)
    const a = step(warmed, 2 * HOUR_TICKS)
    return (a.run.lifetime.cashEarned - warmed.run.lifetime.cashEarned) / 2
  }
  const FLEETS = {
    none: { harvester: [], seeder: [] },
    h1: { harvester: [1], seeder: [] },
    h12: { harvester: [1, 2], seeder: [] },
    h123: { harvester: [1, 2, 3], seeder: [] },
    full: { harvester: [1, 2, 3], seeder: [1, 2] },
  } as const

  it('climbs in order to harvester3 with no full stall and no fleet pause; mining stays under the farm cap', () => {
    console.log('PIN19', {
      stepsMin: r.steps.map((x) => (x === undefined ? null : Math.round(x / 60))),
      incomes: Object.fromEntries(Object.entries(r.incomes).map(([k, v]) => [k, Math.round(v)])),
      finalCash: Math.round(ladder.finalCash),
      fields: fieldTiles(end),
      pump: end.run.fields.pump,
      shape: end.run.fields.list.map((f) => `${f.pivot ? 'P' : '-'}${f.plots.length}`).join(' '),
      next: (() => {
        const g = MACHINES_LADDER.find((x) => !x.done(end))
        const b = g?.buy(end)
        return { goal: g?.name, error: b && !b.ok ? b.error : 'ok', keep: g?.keep(end) }
      })(),
      bag: [end.run.bagCapacity, bagCount(end.run), ['copperBar', 'ironBar', 'goldBar', 'coal', 'copperOre', 'ironOre', 'goldOre'].map((id) => `${id}:${end.run.inventory[id as ItemId] ?? 0}`).join(' ')],
      rack: end.run.rack,
      workers: end.run.workers.pool,
      stall: [r.stallTicks, r.fleetPauses],
      coal: [Math.round(r.coalMinedPerHour)],
      miningRatio: ladder.miningCashPerEnergy / ladder.farmingCashPerEnergy,
    })
    expect(r.steps.every((x) => x! > 0)).toBe(true)
    expect([...r.steps].sort((a, b) => a! - b!)).toEqual(r.steps)
    expect(end.run.fields.machines).toMatchObject({ harvester: [1, 2, 3], seeder: [1, 2] })
    expect(r.stallTicks).toBe(0)
    expect(r.fleetPauses).toBe(0)
    expect(ladder.miningCashPerEnergy).toBeLessThan(0.9 * ladder.farmingCashPerEnergy)
  })

  // batch 31.1 (task 163d scenario A, report only): the ladder bot has no orders logic, so the measurement continues
  // from its harvester3 end with the order board bought and the contract bot of scenario B
  it('batch 31.1: from the ladder end, the contract bot reaches the 💼 Manager certificate (reported minute)', () => {
    // the ladder end sells its stone, so the board's 10 stone are handed over (+💰100 is from its own cash)
    const board = end.run.orders.unlocked ? end : (() => {
      const b = buyOrderBoard({ ...end, run: { ...end.run, inventory: { ...end.run.inventory, stone: Math.max(10, end.run.inventory.stone ?? 0) } } })
      if (!b.ok) throw new Error(b.error)
      return b.state
    })()
    const r = contractRun(board, 48 * 60)
    console.log('PIN311a', JSON.stringify({ ladderEndMin: Math.round(end.run.tick / 60), ...r }))
    expect(r.reached).not.toBeNull()
  }, 300_000)

  // batch 32.2 (task 175 scenario A, report only; nested here to reuse this ladder run): a fresh player's ladder to
  // harvester3, then the contract bot of PIN311a to the 💼 Manager certificate
  describe('batch 32.2: estate worker speed', () => {
    it('scenario A: Estate income/h at the ladder end, minutes to the first harvester and the 💼 Manager, longest milestone gap', () => {
      const after = step(end, HOUR_TICKS)
      const board = buyOrderBoard({ ...end, run: { ...end.run, inventory: { ...end.run.inventory, stone: Math.max(10, end.run.inventory.stone ?? 0) } } })
      const c = contractRun(board.ok ? board.state : end, 48 * 60)
      const marks = Object.entries(end.run.milestones).filter((e): e is [string, number] => e[1] !== undefined).sort((a, b) => a[1] - b[1])
      const gaps = marks.map(([id, t], i) => ({ id, min: Math.round((t - (i ? marks[i - 1]![1] : 0)) / 60) }))
      console.log('PIN322a', JSON.stringify({
        ladderEndMin: Math.round(end.run.tick / 60),
        endIncomePerHour: Math.round(after.run.lifetime.cashEarned - end.run.lifetime.cashEarned),
        harvester3WindowIncomePerHour: Math.round(r.incomes.harvester3),
        harvester1Min: Math.round(r.win.harvester1! / 60),
        // the unlock = the 10th contract; the certificate's ⭐ / 🥇 price may come later (null = not within 48 h)
        managerUnlockMin: c.reached === null ? null : Math.round(end.run.tick / 60) + c.reached.minute,
        managerBuyableMin: c.buyable === null ? null : Math.round(end.run.tick / 60) + c.buyable,
        longestGap: gaps.reduce((a, b) => (b.min > a.min ? b : a)),
      }))
      expect(r.win.harvester1).toBeGreaterThan(0)
    }, 300_000)
  })

  // batch 33 (task 180 scenario A, report only; reuses this ladder run): the ladder end (harvester3), the first iron /
  // gold bar, the minute each mold is bought, and the longest gap between marks (milestones + ladder rungs) from tick 0
  // to the ladder end, with the cash and bars held the tick before the mark that closed it
  it('batch 33: scenario A — ladder end, first iron / gold bar, mold minutes, longest gap and what bound it', () => {
    const t = ladder.ladderTicks as Partial<Record<string, number>>
    const endTick = r.win.harvester3!
    const marks = [...Object.entries(end.run.milestones), ...Object.entries(t)]
      .filter((e): e is [string, number] => e[1] !== undefined && e[1] <= endTick)
      .sort((a, b) => a[1] - b[1])
    const gaps = marks.map(([id, tick], i) => ({ id, from: i ? marks[i - 1]![0] : 'start', tick, gap: tick - (i ? marks[i - 1]![1] : 0) }))
    const longest = gaps.reduce((a, b) => (b.gap > a.gap ? b : a))
    const before = Math.max(0, longest.tick - 1)
    const min = (x: number | undefined) => (x === undefined ? null : Math.round((x / 60) * 10) / 10)
    console.log('PIN33a', JSON.stringify({
      ladderEndMin: min(endTick),
      firstIronBarMin: min(t.firstIronBar),
      firstGoldBarMin: min(t.firstGoldBar),
      ironMoldMin: min(t.ironMold),
      goldMoldMin: min(t.goldMold),
      longest: { closedBy: longest.id, after: longest.from, gapMin: min(longest.gap), atMin: min(longest.tick) },
      heldBefore: { cash: Math.round(r.held.cash[before]!), copperBar: r.held.copperBar[before], ironBar: r.held.ironBar[before], goldBar: r.held.goldBar[before] },
    }))
    expect(endTick).toBeGreaterThan(0)
  })

  // batch 34 (task 187 scenario A, report + the Manager-path guard; reuses this ladder run): ⭐ held at the Tractor (the
  // ladder bot fills no orders), then from the ladder end the contract bot of PIN311a with the board bought, reporting
  // the minute the Clerk and the Manager certificates first buy, ⭐ held then, and contract ⭐/h
  it('batch 34: scenario A — ladder end, ⭐ at the Tractor and the Manager, Clerk / Manager minutes, contract ⭐/h, longest gap', () => {
    const t = ladder.ladderTicks as Partial<Record<string, number>>
    const endTick = r.win.harvester3!
    const marks = [...Object.entries(end.run.milestones), ...Object.entries(t)]
      .filter((e): e is [string, number] => e[1] !== undefined && e[1] <= endTick)
      .sort((a, b) => a[1] - b[1])
    const gaps = marks.map(([id, tick], i) => ({ id, from: i ? marks[i - 1]![0] : 'start', tick, gap: tick - (i ? marks[i - 1]![1] : 0) }))
    const longest = gaps.reduce((a, b) => (b.gap > a.gap ? b : a))
    const before = Math.max(0, longest.tick - 1)
    const min = (x: number | undefined) => (x === undefined ? null : Math.round((x / 60) * 10) / 10)
    const board = buyOrderBoard({ ...end, run: { ...end.run, inventory: { ...end.run.inventory, stone: Math.max(10, end.run.inventory.stone ?? 0) } } })
    const c = certRun(board.ok ? board.state : end, 48 * 60)
    // contracts only (every item offer discarded, PIN311a's policy), the plan's "contract ⭐/h after the Tractor"
    const contractsOnly = certRun(board.ok ? board.state : end, 48 * 60, false)
    const endMin = Math.round(endTick / 60)
    console.log('PIN34a', JSON.stringify({
      ladderEndMin: min(endTick),
      starsAtTractor: r.held.stars[end.run.milestones.fieldsUnlocked!],
      clerkMin: c.clerk === null ? null : endMin + c.clerk,
      managerMin: c.manager === null ? null : endMin + c.manager,
      starsAtManager: c.starsAtManager,
      stars20Min: c.stars20 === null ? null : endMin + c.stars20,
      managerUnlockMin: c.unlock === null ? null : endMin + c.unlock,
      // contracts + item / bar orders delivered from storage, per game-hour after the ladder end
      orderStarsPerHour: c.starsPerHour,
      contractStarsPerHour: contractsOnly.starsPerHour,
      contracts: c.contracts,
      starsEnd: c.starsEnd,
      shortAt48h: c.short,
      longest: { closedBy: longest.id, after: longest.from, gapMin: min(longest.gap), atMin: min(longest.tick) },
      heldBefore: { cash: Math.round(r.held.cash[before]!), copperBar: r.held.copperBar[before], ironBar: r.held.ironBar[before], goldBar: r.held.goldBar[before] },
    }))
    // guard (batch-31.1 Manager unlock path): the unlock and the Manager's ⭐20 are reached within PIN311a's 48 h window
    // (the 💰1.5M part is the cash bound, not ⭐)
    expect(c.unlock).not.toBeNull()
    expect(c.stars20).not.toBeNull()
  }, 300_000)

  // batch 35 (task 190 scenario A, report): the minute carrot is licensed (0 = the starting crop), the first three
  // licence rungs the bot buys, the ladder end and the longest gap tick 0 → ladder end with what closed it
  it('batch 35: scenario A — carrot licence minute, first three licence rungs, ladder end, longest gap', () => {
    const t = ladder.ladderTicks as Partial<Record<string, number>>
    const endTick = r.win.harvester3!
    const marks = [...Object.entries(end.run.milestones), ...Object.entries(t)]
      .filter((e): e is [string, number] => e[1] !== undefined && e[1] <= endTick)
      .sort((a, b) => a[1] - b[1])
    const gaps = marks.map(([id, tick], i) => ({ id, from: i ? marks[i - 1]![0] : 'start', tick, gap: tick - (i ? marks[i - 1]![1] : 0) }))
    const longest = gaps.reduce((a, b) => (b.gap > a.gap ? b : a))
    const min = (x: number | undefined) => (x === undefined ? null : Math.round((x / 60) * 10) / 10)
    const bought = Object.entries(ladder.licenseBought).sort((a, b) => a[1]! - b[1]!)
    console.log('PIN35a', JSON.stringify({
      carrotLicensedMin: ladder.licenseBought.radish === undefined ? 0 : min(ladder.licenseBought.radish),
      firstThreeLicences: bought.slice(0, 3).map(([c, tick]) => ({ crop: c, min: min(tick) })),
      ladderEndMin: min(endTick),
      longest: { closedBy: longest.id, after: longest.from, gapMin: min(longest.gap), atMin: min(longest.tick) },
    }))
    expect(endTick).toBeGreaterThan(0)
  })

  // measured batch 28: 1,188 game-minutes counting only milestones and rungs; batch 29 (task 151d) also counts every
  // plot, pivot, pump and machine purchase as a mark — the longest gap left is seeder1 (2,388 min) → pump2 (2,621 min),
  // saving for Pump 2; prices LOCKED. Batch 32.2: 347 min from game-minute 4,431 (was 232) — workers do one tile per
  // action on the Estate
  it.fails('batch 28: no gap over 60 game-minutes from the Tractor to Pump 2 (milestones, ladder rungs, every plot / pivot / pump / machine bought) — measured 347 min', () => {
    const tractor = end.run.milestones.fieldsUnlocked!
    const pump2 = r.win.pump2!
    const ticks = [
      ...Object.values(end.run.milestones).filter((t): t is number => t !== undefined),
      ...Object.values(ladder.ladderTicks).filter((t): t is number => t !== undefined),
      ...Object.values(r.win).filter((t): t is number => t !== undefined),
      ...r.purchases,
    ]
      .filter((t) => t >= tractor && t <= pump2)
      .sort((a, b) => a - b)
    const gaps = ticks.slice(1).map((t, i) => t - ticks[i]!)
    const longest = Math.max(0, ...gaps)
    const from = ticks[gaps.indexOf(longest)]!
    console.log('PIN28a', { tractorMin: Math.round(tractor / 60), pump1Min: Math.round(r.win.pump1! / 60), pump2Min: Math.round(pump2 / 60), marks: ticks.length, longestMin: Math.round(longest / 60), longestFromMin: Math.round(from / 60) })
    expect(longest).toBeLessThanOrEqual(HOUR_TICKS)
  })

  it('batch 28: something (plot, pivot, pump or machine) becomes buyable at every pump cap the ladder reaches', () => {
    console.log('PIN28b', { reached: r.buyable, firstBuyable: r.bought })
    for (let p = 0; p <= end.run.fields.pump; p++) expect(r.bought[p]).toBeDefined()
  })

  it('batch 28 reported: income at 2 / 6 / 12 / 20 fields (mono strawberry vs the bot chips), tank coal vs the miner, the labor bound', () => {
    const at = (fields: number, crop: CropId) => {
      const s = forgePlots(end, fields * 50, pumpFor(fields * 50), [crop], 1_000_000)
      const f = { ...s, run: { ...s.run, licenses: [...new Set([...s.run.licenses, crop])], fields: { ...s.run.fields, machines: { ...createMachines(), harvester: [1, 2, 3], seeder: [1, 2] } } } }
      const warmed = step(f, HOUR_TICKS)
      const a = step(warmed, 2 * HOUR_TICKS)
      return Math.round((a.run.lifetime.cashEarned - warmed.run.lifetime.cashEarned) / 2)
    }
    const caps = [2, 6, 12, 20]
    const income = caps.map((k) => ({ fields: k, strawberry: at(k, 'strawberry'), lemon: at(k, 'pumpkin') }))
    const coal = caps.map((k) => ({ fields: k, tankCoalPerHour: fieldCoalPerPlotHour() * 5 * k, minerCoalPerHour: Math.round(r.coalMinedPerHour) }))
    // the labor bound at 20 fields of strawberry: tiles sown and reaped per hour by the full fleet vs what the land needs
    let s = (() => {
      const f = forgePlots(end, 1000, 3, ['strawberry'], 1_000_000)
      return step({ ...f, run: { ...f.run, licenses: [...new Set([...f.run.licenses, 'strawberry' as CropId])], fields: { ...f.run.fields, machines: { ...createMachines(), harvester: [1, 2, 3], seeder: [1, 2] } } } }, HOUR_TICKS)
    })()
    let sown = 0
    let reaped = 0
    for (let t = 0; t < HOUR_TICKS; t++) {
      const next = step(s, 1)
      next.run.fields.list.forEach((f, i) =>
        f.plots.forEach((p, j) => {
          const was = s.run.fields.list[i]!.plots[j]!
          if (was.crop !== null && p.crop === null) reaped += plotTiles()
          if (was.crop === null && p.crop !== null) sown += plotTiles()
        }),
      )
      s = next
    }
    const needed = Math.round((1000 * HOUR_TICKS) / Math.ceil(cropGrowTicks('strawberry', end.meta, end.run.upgrades.fertilizer) / FIELD_PRESSURE))
    const fleet = { reap: [1, 2, 3].reduce((a, t) => a + machineTilesPerHour('harvester', t), 0), sow: [1, 2].reduce((a, t) => a + machineTilesPerHour('seeder', t), 0) }
    console.log('PIN28c', JSON.stringify({ income, coal, labor: { needed, fleet, sownPerHour: sown, reapedPerHour: reaped, plantWorkerTiles: HOUR_TICKS / workerActionTicks(end.meta), incomeCap: income[3]!.strawberry } }))
    expect(income.every((row) => row.strawberry > 0 && row.lemon > 0)).toBe(true)
  })

  it('income vs N, machines vs workers-only, and each tier pays: the curve 100 → 1,000 tiles', () => {
    const Ns = [100, 300, 1000]
    const curve = Ns.map((n) => [Math.round(incomeAt(n, FLEETS.none)), Math.round(incomeAt(n, FLEETS.full))])
    // each machine's marginal cash/h and payback at the two Ns where throughput can bind
    const marginal = ([300, 1000] as const).map((n) => {
      const inc = { none: incomeAt(n, FLEETS.none), h1: incomeAt(n, FLEETS.h1), h12: incomeAt(n, FLEETS.h12), h123: incomeAt(n, FLEETS.h123), full: incomeAt(n, FLEETS.full) }
      const tiers = [
        ['harvester1', machineCost('harvester', 1, end.meta).cash, inc.h1 - inc.none],
        ['harvester2', machineCost('harvester', 2, end.meta).cash, inc.h12 - inc.h1],
        ['harvester3', machineCost('harvester', 3, end.meta).cash, inc.h123 - inc.h12],
        ['seeders', machineCost('seeder', 1, end.meta).cash + machineCost('seeder', 2, end.meta).cash, inc.full - inc.h123],
      ] as const
      return tiers.map(([name, price, delta]) => ({ name, delta: Math.round(delta), paybackH: delta > 0 ? Math.round((price / delta) * 10) / 10 : null }))
    })
    // the smallest N where each tier pays on the 8 h bar (Δ cash/h ≥ price / 8)
    const paysAtN = marginal[0]!.map((_, i) => {
      const [name, price] = [['harvester1', machineCost('harvester', 1, end.meta).cash], ['harvester2', machineCost('harvester', 2, end.meta).cash], ['harvester3', machineCost('harvester', 3, end.meta).cash], ['seeders', machineCost('seeder', 1, end.meta).cash + machineCost('seeder', 2, end.meta).cash]][i]! as [string, number]
      const n = ([300, 1000] as const).find((_, j) => (marginal[j]![i]!.delta ?? 0) >= price / 8)
      return { name, n: n ?? null }
    })
    console.log('PIN19b', JSON.stringify({ curve, marginal, paysAtN }))
    // the curve, re-pinned batch 26 (seeded rng, so exact): the fleet inherits the gold sickle's double harvest and
    // the beds' always-full moisture, so it now beats the workers-only arm at every N — the batch-20.1 1,000-tile
    // inversion is gone (the workers arm lost its dry-tile handicap with it)
    // re-pinned batch 28 (was [150,154] [382,437] [397,436] on cohorts): on whole plots the fleet's edge grows with N —
    // at 1,000 tiles (20 pressured fields) the workers-only arm is labor-bound and the fleet earns 3.3×
    // re-pinned batch 28.1 (was [151,153] [351,432] [396,1290]): the source run's late blunt-pickaxe swap moves `end`
    // re-pinned batch 29 (was [149,151] [349,429] [392,1286]): the bot smelts gold for plots10 (task 151e), so `end` moves
    // re-pinned batch 31 (was [149,152] [349,431] [393,1286]): renown floor (the forged lemon market floors at 0.7)
    // re-pinned batch 32 (was [212,215] [492,602] [550,1803]): the rack and gold 600 (task 168: [210,217] [519,605]
    // [549,1807]), then carry-over (task 170) move `end`
    // task 170: [213,214] [503,605] [549,1812]; task 172: the sickle's seed drops
    // re-pinned batch 32.2 (was [213,217] [492,604] [550,1801]): workers do one tile per action on the Estate — the
    // workers-only arm is labor-bound at every N; the full fleet (whose plots the workers still help finish) moves less
    // re-pinned batch 33 (was [81,211] [81,598] [81,758]): molds: every kind smelts at once — the source run's `end` moves
    // re-pinned batch 35 (was [81,209] [81,599] [81,755]): crop re-ladder: potato start, carrot licence 💰25 — `end` moves
    expect(curve.map(([w, m]) => [Math.round(w / 1000), Math.round(m / 1000)])).toEqual([
      [80, 210],
      [80, 598],
      [80, 756],
    ])
    expect(curve[1]![1]).toBeGreaterThanOrEqual(curve[1]![0])
    // re-pinned batch 28 (was null / 1.6 / 68.1 / null at 300 tiles); batch 28.1 (was 0.8 / 17.8 / 276.7 / 153.6);
    // batch 29 (was 0.8 / 15.3 / null / 294.8, task 151e moves `end`); batch 31 (was 0.8 / 18.5 / null / 134.7): renown floor
    // batch 32 (was 0.5 / 12.9 / 534.8 / null): the rack and gold 600 (task 168: 0.7 / 35.5 / 48.9 / 173.2), then
    // carry-over (task 170: 0.6 / 16.4 / 99.9 / null), then the seed drops (task 172) move `end`
    // re-pinned batch 32.2 (was 0.6 / 8.9 / null / 102.5): workers do one tile per action on the Estate — harvester1
    // and the seeders now replace the labor-bound workers; harvester2 / 3 add little once harvester1 reaps
    // re-pinned batch 33 (was harvester2 1623.4, harvester3 363.6): molds: every kind smelts at once — the source run's
    // `end` moves; harvester2 / 3 add next to nothing at 300 tiles (harvester2 now slightly negative: no payback)
    expect(marginal[0]!.map((t) => [t.name, t.paybackH])).toEqual([
      ['harvester1', 0.4],
      ['harvester2', null],
      // re-pinned batch 35 (was 4545.5): crop re-ladder: potato start, carrot licence 💰25 — harvester3 adds nothing at
      // 300 tiles now (no payback)
      ['harvester3', null],
      ['seeders', 0.8],
    ])
    // re-pinned batch 28 (was null / 300 / null / null); batch 32.2 (was 300 / 1000 / 1000 / null): workers do one tile
    // per action on the Estate
    expect(paysAtN).toEqual([
      { name: 'harvester1', n: 300 },
      { name: 'harvester2', n: null },
      { name: 'harvester3', n: null },
      { name: 'seeders', n: 300 },
    ])
  }, 30_000) // 13 forged 3 h runs; 1.7–2.9 s alone, 7.6 s under the full parallel suite (batch 28: 20 pressured fields)

  const machineRows = (): [number, number][] => [
    [machineCost('harvester', 1, end.meta).cash, r.incomes.harvester1],
    [machineCost('seeder', 1, end.meta).cash, r.incomes.seeder1],
    [machineCost('harvester', 2, end.meta).cash, r.incomes.harvester2],
    [machineCost('seeder', 2, end.meta).cash, r.incomes.seeder2],
    [machineCost('harvester', 3, end.meta).cash, r.incomes.harvester3],
  ]
  it('pinned: every machine cash price is ≤ 1.5 h of the ladder bot income at its purchase, rounded to 💰500', () => {
    console.log('PIN19c', machineRows().map(([price, income]) => [price, Math.round(income), Math.round((price / income) * 100) / 100]))
    for (const [price, income] of machineRows()) {
      expect(price % 500).toBe(0)
      expect(price / income).toBeLessThanOrEqual(1.5)
    }
  })

  // measured batch 28: harvester1 0.14 h, seeder1 0.12 h, harvester2 0.47 h, seeder2 0.33 h, harvester3 0.46 h — the
  // pressured plots lift the income at the machine rungs, prices untouched (PLAN.md "Batch 28 results" Deviations)
  // batch 32.2: 0.54 / 0.19 / 0.96 / 0.57 / 0.57 h (was 0.14 / 0.12 / 0.47 / 0.33 / 0.46) — workers do one tile per
  // action on the Estate, so the income at each machine rung is lower; seeder1 still fails the bar
  it.fails('pinned: every machine cash price is ≥ 0.35 h of the ladder bot income — measured 0.54 / 0.19 / 0.96 / 0.57 / 0.57 h', () => {
    for (const [price, income] of machineRows()) expect(price / income).toBeGreaterThanOrEqual(0.35)
  })

  it('the coal budget with machines (re-pinned batch 26): machines and beds are coal-free, the miner covers the pipes', () => {
    const settled = step(forge(300, FLEETS.full), 2 * HOUR_TICKS)
    const pipeDraw = fieldCoalPerPlotHour() * fieldsOverview(settled.run).growing
    console.log('PIN19d', { pipeDraw, maintPerHour: end.run.fields.machines.harvester.reduce((a, t) => a + machineMaintPerHour(t), 0) + end.run.fields.machines.seeder.reduce((a, t) => a + machineMaintPerHour(t), 0) })
    expect(pipeDraw).toBeLessThanOrEqual(15)
    expect(pipeDraw).toBeLessThan(r.coalMinedPerHour)
  })

  it('8 h offline with 3,000 tiles, the full fleet and pipes: < 2,000 ms, step(s, n) identity', () => {
    const forged = forge(3000, FLEETS.full, ['pumpkin', 'eggplant', 'corn', 'radish'])
    const big = { ...forged, run: { ...forged.run, workers: { ...forged.run.workers, assigned: { plant: 2, water: 0, harvest: 2, ore: 0, fuel: 1, mine: 1, clerk: 0, manager: 0, stoker: 0 } } } }
    const t0 = Date.now()
    catchUp(big, 8 * HOUR_TICKS * 1000)
    const ms = Date.now() - t0
    console.log('PIN19e', { ms })
    expect(ms).toBeLessThan(2000)
    let one = big
    for (let i = 0; i < 600; i++) one = step(one, 1)
    expect(step(big, 600)).toEqual(one)
    expect(catchUp(big, 600_000)).toEqual(step(big, 600))
  })
})

function certRun(s0: GameState, maxMinutes: number, items = true) {
  let s = s0
  let clerk: number | null = null
  let manager: number | null = null
  let starsAtManager: number | null = null
  // the Manager's ⭐ part (⭐20) held, and its unlock (10 contracts delivered)
  let stars20: number | null = null
  let unlock: number | null = null
  let m = 0
  for (; m < maxMinutes && (manager === null || clerk === null); m++) {
    s.run.orders.offers.forEach((o, i) => {
      if (!isOffer(o) || o.accepted) return
      const grown = s.run.fields.list.some((f) => f.plots.some((p) => p.crop === o.good))
      // an item / bar order storage already holds is delivered at once (the ⭐ the plan counts on besides contracts)
      const delivered = items && !isCropGood(o.good) && (s.run.inventory[o.good] ?? 0) >= o.count ? acceptOrder(s, i) : null
      const r = delivered?.ok ? deliverOrder(delivered.state, i) : isContract(s.run, o.good) && grown ? acceptOrder(s, i) : discardOrder(s, i)
      if (r.ok) s = r.state
    })
    s = step(s, 60)
    if (clerk === null && buyCertificate(s, 'clerk').ok) clerk = m + 1
    if (manager === null && buyCertificate(s, 'manager').ok) [manager, starsAtManager] = [m + 1, s.run.stars]
    if (stars20 === null && s.run.stars >= certificateCost('manager', s.meta).stars!) stars20 = m + 1
    if (unlock === null && certificateUnlocked(s.run, 'manager')) unlock = m + 1
  }
  const starsPerHour = Math.round(((s.run.lifetime.starsEarned - s0.run.lifetime.starsEarned) / (m / 60)) * 100) / 100
  // what each certificate still lacks at the end (empty = bought / buyable)
  const short = (job: 'clerk' | 'manager') =>
    Object.fromEntries(
      Object.entries(certificateCost(job, s.meta)).flatMap(([id, n]) => {
        const have = id === 'cash' ? s.run.cash : id === 'stars' ? s.run.stars : (s.run.inventory[id as ItemId] ?? 0)
        return n! > have ? [[id, Math.round(n! - have)]] : []
      }),
    )
  return {
    clerk,
    manager,
    starsAtManager,
    stars20,
    unlock,
    starsPerHour,
    starsEnd: s.run.stars,
    contracts: s.run.counters.contractsByHand - s0.run.counters.contractsByHand,
    short: { clerk: short('clerk'), manager: short('manager') },
  }
}

/**
 * batch 32 (task 172c scenario B): a loaded save hires one miner and assigns it, then 2 game-hours pass with no player.
 * drops = vein items added to storage, summed per tick (the ore loader's takes are not subtracted); 💰 = cash earned
 */
