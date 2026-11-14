import { describe, expect, it, vi } from 'vitest'
import { selectCrop, type ActionResult } from '../../src/core/actions'
import { type PickaxeTier } from '../../src/core/data/items'
import {
  OFFLINE_CAP_TICKS,
  barTicks,
  fireCapTicks,
  fireUnitTicks,
  pickaxeDurability,
  storageSlotsPerLevel,
} from '../../src/core/balance'
import { addFuel, collectBars, loadOre } from '../../src/core/furnace'
import { catchUp } from '../../src/save/serialize'
import { bagCount, heldPickaxe, sellItem } from '../../src/core/mining'
import { createFurnace, createInitialState, type GameState } from '../../src/core/state'
import { step } from '../../src/core/step'
import { type WorkerJob } from '../../src/core/data/workers'
import { assignWorker } from '../../src/core/workers'
import {
  ALL_COPPER,
  HOUR_TICKS,
  IRON_TICKS,
  LICENSE_ORDER,
  PLANT_ORDER,
  ironLadder,
  lowestValue,
  mineBench,
  runBot,
  runCropBot,
  withoutMarket,
} from './bot'

vi.mock('../../src/core/balance', async (importOriginal) => (await import('./balanceMock')).balanceMock(importOriginal))

// ---- Batch 9: fuelled furnace, furnace loaders, smart furnace ----

type Loaders = { ore?: boolean; fuel?: boolean }

/** a built furnace at base levels with ore and coal in a roomy storage and cash for wages; loaders certified + staffed */
function smeltery({ ore = 0, coal = 0, fire = 0, fireCap = 0, smart = false, loaders = {} as Loaders } = {}): GameState {
  const init = createInitialState()
  const assigned = { plant: 0, water: 0, harvest: 0, ore: Number(!!loaders.ore), fuel: Number(!!loaders.fuel), mine: 0, clerk: 0, manager: 0, stoker: 0 }
  const furnace = { ...createFurnace(), built: true, fire, smart, levels: { ...createFurnace().levels, fireCap } }
  const workers = { pool: assigned.ore + assigned.fuel, assigned, certificates: ['ore', 'fuel'] as WorkerJob[] }
  return { ...init, run: { ...init.run, cash: 1000, bagCapacity: 1e4, inventory: { copperOre: ore, coal }, furnace, workers } }
}

/** what a furnace run did: bars smelted, fire wasted (units), coal used, wages, and the lowest value seen */
function furnaceReport(before: GameState, after: GameState, lowest = lowestValue(after)) {
  const { barsSmelted, fireWasted, wagesPaid } = after.run.lifetime
  return {
    bars: barsSmelted - before.run.lifetime.barsSmelted,
    wastedUnits: (fireWasted - before.run.lifetime.fireWasted) / fireUnitTicks(),
    coalUsed: (before.run.inventory.coal ?? 0) - (after.run.inventory.coal ?? 0),
    wages: wagesPaid - before.run.lifetime.wagesPaid,
    lowest,
  }
}

const STOCK = { ore: 1000, coal: 500 }
/**
 * Bars per hour from an unlimited stock. The player tends the furnace every `cadence` ticks (collect the tray, load
 * the ore slot full, fill the fire with coal) and skips what a loader does; loaders act on their own clock.
 */

function furnaceBench({ cadence = HOUR_TICKS, loaders = {}, smart = false, fireCap = 0 }: { cadence?: number; loaders?: Loaders; smart?: boolean; fireCap?: number }) {
  const start = smeltery({ ...STOCK, smart, loaders, fireCap })
  const tend: Array<(s: GameState) => ActionResult> = [
    ...(loaders.ore ? [] : [(s: GameState) => collectBars(s, 'copperOre'), (s: GameState) => loadOre(s, 'copperOre')]),
    ...(loaders.fuel ? [] : [(s: GameState) => addFuel(s, 'coal')]),
  ]
  let s = start
  let lowest = lowestValue(s)
  for (let t = 0; t < HOUR_TICKS; t++) {
    if (t % cadence === 0)
      for (const f of tend) {
        const r = f(s)
        if (r.ok) s = r.state
      }
    s = step(s, 1)
    lowest = Math.min(lowest, lowestValue(s))
  }
  return furnaceReport(start, s, lowest)
}

describe('batch 9: bars per hour, manual vs ore loader vs both loaders vs smart (unlimited stock, base levels)', () => {
  const bench = {
    manual120: furnaceBench({ cadence: 120 }),
    manual600: furnaceBench({ cadence: 600 }),
    oreLoader600: furnaceBench({ cadence: 600, loaders: { ore: true } }),
    oreLoader600FireCap1: furnaceBench({ cadence: 600, loaders: { ore: true }, fireCap: 1 }),
    both: furnaceBench({ loaders: { ore: true, fuel: true } }),
    bothSmart: furnaceBench({ loaders: { ore: true, fuel: true }, smart: true }),
    manual600Smart: furnaceBench({ cadence: 600, smart: true }),
  }
  console.log('batch 9 bars/hour', JSON.stringify(bench, null, 1))
  const pick = (k: keyof typeof bench) => [bench[k].bars, bench[k].wages]

  it('pins bars and wages per hour (PLAN.md "Batch 9 results")', () => {
    expect(Object.keys(bench).map((k) => pick(k as keyof typeof bench))).toEqual([
      [60, 0],
      [30, 0],
      [30, 66],
      [60, 124],
      [60, 188],
      [60, 188],
      [30, 0],
    ])
  })

  it('both loaders run the furnace at full speed with no player; a 10-minute player needs the ore loader and fire cap Lv1 for it', () => {
    const full = HOUR_TICKS / barTicks()
    expect(bench.both.bars).toBe(full)
    expect(bench.manual600.bars).toBeLessThan(full)
    expect(bench.oreLoader600.bars).toBeLessThan(full) // one base tank lasts 5 cycles, half the 10 minutes
    expect(bench.oreLoader600FireCap1.bars).toBe(full)
  })

  it('with ore always in stock nothing is wasted, smart or plain, and nothing goes negative', () => {
    for (const r of Object.values(bench)) {
      expect(r.wastedUnits).toBe(0)
      expect(r.lowest).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('batch 9: a plain furnace wastes at most one tank', () => {
  it.each([0, 1, 2])('fire cap level %i: a full tank and no ore burns away in 8 h, and no more', (fireCap) => {
    const s = smeltery({ fire: fireCapTicks(fireCap), fireCap })
    const r = furnaceReport(s, catchUp(s, OFFLINE_CAP_TICKS * 1000))
    console.log('batch 9 idle tank', fireCap, JSON.stringify(r))
    expect(r.wastedUnits * fireUnitTicks()).toBe(fireCapTicks(fireCap))
  })
})

describe('batch 9: 8 h offline with loaders when the ore runs out (ore for 10 bars, 30 coal)', () => {
  const offline = (loaders: Loaders, smart: boolean, fire = 0) => {
    const s = smeltery({ ore: 20, coal: 30, loaders, smart, fire })
    return furnaceReport(s, catchUp(s, OFFLINE_CAP_TICKS * 1000))
  }
  const runs = {
    bothPlain: offline({ ore: true, fuel: true }, false),
    bothSmart: offline({ ore: true, fuel: true }, true),
    orePlainFullTank: offline({ ore: true }, false, fireCapTicks(0)),
    // ore for 3 bars only: the full tank outlasts it
    orePlainFullTankShortOre: (() => {
      const s = smeltery({ ore: 6, coal: 30, loaders: { ore: true }, fire: fireCapTicks(0) })
      return furnaceReport(s, catchUp(s, OFFLINE_CAP_TICKS * 1000))
    })(),
  }
  console.log('batch 9 offline 8 h', JSON.stringify(runs, null, 1))
  const tank = fireCapTicks(0) / fireUnitTicks()

  it('both loaders smelt every bar the ore allows, plain or smart; smart wastes nothing and keeps the coal', () => {
    expect([runs.bothPlain.bars, runs.bothSmart.bars]).toEqual([10, 10])
    expect(runs.bothSmart.wastedUnits).toBe(0)
    expect(runs.bothSmart.coalUsed).toBe(15) // 10 bars + a full tank (5 coal) left in the fire
  })

  it('plain with only the ore loader wastes at most the tank it was left with', () => {
    expect(runs.orePlainFullTankShortOre.bars).toBe(3)
    expect(runs.orePlainFullTankShortOre.wastedUnits).toBeLessThanOrEqual(tank)
    expect(runs.orePlainFullTank.wastedUnits).toBe(0)
  })

  // DECISIONS "Fuelled furnace": the fuel loader keeps a plain furnace burning after the ore runs out; that loss is
  // what the smart furnace buys. Bounded by the coal in storage, not by one tank (see PLAN.md Deviations, task 61).
  it('plain with both loaders burns the rest of the coal stock once the ore is gone (pinned, more than one tank)', () => {
    expect(runs.bothPlain).toMatchObject({ wastedUnits: 40, coalUsed: 30 })
    expect(runs.bothPlain.wastedUnits).toBeGreaterThan(tank)
  })

  it('cash and every stock stay ≥ 0', () => {
    for (const r of Object.values(runs)) expect(r.lowest).toBeGreaterThanOrEqual(0)
  })
})

describe('batch 9: ladder bot continues to the ore / fuel certificates and the smart furnace', () => {
  let end = createInitialState()
  // batch 16: market off — see the batch-8 note; off, it replays the pre-market pins
  const summary = withoutMarket(() =>
    runBot(true, {
      ticks: 2 * HOUR_TICKS,
      licenses: LICENSE_ORDER,
      crops: PLANT_ORDER,
      ladder: true,
      copperTools: true,
      workers: true,
      furnace: true,
      onEnd: (s) => (end = s),
    }),
  )
  const { ladderTicks, workerTicks, finalCash, wagesPaid, counters, lowest, borrowed } = summary
  const { fireBurnt, fireWasted, barsSmelted } = end.run.lifetime
  console.log(
    'batch 9 ladder',
    JSON.stringify({ ladderTicks, workerTicks, finalCash, wagesPaid, counters, lowest, borrowed, fireBurnt, fireWasted, barsSmelted, workers: end.run.workers.assigned }, null, 1),
  )

  // re-pinned batch 32 (was firstBar 1389, copperPickaxe 1644, copper:water 1884 / harvest 2196 / plant 2361, fuel 3141,
  // smart 3741; [13901, 897, 80, 80]): hit carry-over
  it('the batch-8 steps are unchanged; ore certificate → fuel certificate → smart furnace follow, pinned (re-pinned batch 16: market off, replays the pre-market pins)', () => {
    expect(ladderTicks).toEqual({
      // re-pinned batch 35 (was 477 / 666 / 885 / 951 / 1255 / 1386 / 1737 / 1944 / 2151 / 2367 / 2550 / 3147 / 3747):
      // crop re-ladder: potato start, carrot licence 💰25
      storageLv1: 486,
      veinLv1: 890,
      furnace: 1206,
      storageLv2: 1269,
      veinLv2: 1511,
      firstBar: 1580,
      copperPickaxe: 1823,
      'copper:water': 2129,
      'copper:harvest': 2303,
      'copper:plant': 2543,
      oreCertificate: 2723,
      fuelCertificate: 3329,
      smart: 3923,
    })
    // re-pinned batch 35 (was 628 / 628 / 1141 / 643 / 1024): crop re-ladder: potato start, carrot licence 💰25
    expect(workerTicks).toEqual({ firstCertificate: 733, waterCertificate: 733, harvestCertificate: 1027, firstHire: 517, pool3: 1396 })
    // re-pinned batch 28.1 (was [13900, 898, 80, 80]): the blunt-pickaxe repair collects the tray first
    // re-pinned batch 35 (was [15994, 885, 81, 81]): crop re-ladder: potato start, carrot licence 💰25
    expect([finalCash, wagesPaid, counters.bars, barsSmelted]).toEqual([12847, 895, 80, 83])
  })

  it('each loader gets a worker; mining keeps ore coming, so the fire is never wasted', () => {
    expect(end.run.workers.assigned).toEqual({ plant: 0, water: 2, harvest: 2, ore: 1, fuel: 1, mine: 0, clerk: 0, manager: 0, stoker: 0 })
    expect(fireBurnt).toBe(barsSmelted * barTicks())
    expect(fireWasted).toBe(0)
  })

  it('nothing goes negative and it never borrows', () => {
    expect(lowest).toBeGreaterThanOrEqual(0)
    expect(borrowed).toBe(false)
  })
})

// ---- Batch 10: plant worker ----

describe('batch 10: plant + water + harvest workers vs manual, one crop on 9 tiles, 1 h (runCropBot, net cash per hour)', () => {
  const ALL = { plant: 1, water: 1, harvest: 1 }
  const runs = Object.fromEntries(
    (['eggplant', 'pumpkin'] as const).map((c) => [
      c,
      {
        manual: runCropBot(c, HOUR_TICKS),
        waterHarvest: runCropBot(c, HOUR_TICKS, undefined, { water: 1, harvest: 1 }),
        all: runCropBot(c, HOUR_TICKS, undefined, ALL),
        allCopper: runCropBot(c, HOUR_TICKS, ALL_COPPER, ALL),
      },
    ]),
  )
  const perHour = (r: ReturnType<typeof runCropBot>) => Math.round(r.perMin * 60)
  const table = Object.fromEntries(
    Object.entries(runs).map(([c, r]) => [
      c,
      Object.fromEntries(Object.entries(r).map(([k, v]) => [k, { perHour: perHour(v), wages: v.wages, playerEnergy: v.energy, workerPlants: v.workerPlants, lowest: v.lowest }])),
    ]),
  )
  console.log('batch 10 cash/hour', JSON.stringify(table, null, 1))

  it('with all three farm workers the player spends no energy on the farm; cash never goes below 0', () => {
    for (const r of Object.values(runs)) {
      expect(r.all.energy).toBe(0)
      expect(r.all.workerPlants).toBeGreaterThan(0)
      for (const v of Object.values(r)) expect(v.lowest).toBeGreaterThanOrEqual(0)
    }
  })

  it('all three farm workers net ≥ 80 % of the manual rate, and above it with the three copper tools', () => {
    for (const r of Object.values(runs)) {
      expect(r.all.perMin / r.manual.perMin).toBeGreaterThanOrEqual(0.8)
      expect(r.allCopper.perMin).toBeGreaterThan(r.manual.perMin)
    }
  })

  it('pins cash per hour (PLAN.md "Batch 10 results") (re-pinned batch 16: depth 60)', () => {
    const pinned = (c: string) => Object.fromEntries(Object.entries(table[c]).map(([k, v]) => [k, [v.perHour, v.wages, v.workerPlants]]))
    // re-pinned batch 32 (allCopper was [6648, 536, 135] / [8484, 448, 90]): the copper sickle's seed roll moves the RNG
    // stream behind the double harvest
    expect(pinned('eggplant')).toEqual({ manual: [6611, 0, 0], waterHarvest: [5746, 715, 0], all: [5540, 855, 135], allCopper: [6730, 536, 135] })
    expect(pinned('pumpkin')).toEqual({ manual: [7941, 0, 0], waterHarvest: [7157, 670, 0], all: [6982, 765, 90], allCopper: [8106, 448, 90] })
  })
})

describe('batch 10: 8 h offline from the batch-8 workers ladder end, with one worker moved to planting', () => {
  let end = createInitialState()
  // batch 16: market off — see the batch-8 note; off, it replays the pre-market pins
  withoutMarket(() => runBot(true, { ticks: HOUR_TICKS, licenses: LICENSE_ORDER, crops: PLANT_ORDER, ladder: true, copperTools: true, workers: true, onEnd: (s) => (end = s) }))
  // batch 8's start: the player loads the furnace before leaving
  const ok = (r: ActionResult, s: GameState) => (r.ok ? r.state : s)
  const loaded = ok(addFuel(ok(loadOre(end, 'copperOre'), end), 'coal'), ok(loadOre(end, 'copperOre'), end))
  const best = PLANT_ORDER.find((c) => loaded.run.licenses.includes(c))!
  const certified: GameState = { ...loaded, run: { ...loaded.run, workers: { ...loaded.run.workers, certificates: [...loaded.run.workers.certificates, 'plant'] } } }
  const planter = ok(selectCrop(ok(assignWorker(ok(assignWorker(certified, 'water', -1), certified), 'plant', 1), certified), best), certified)
  /** the 8 h catch-up one tick at a time (step(s, n) = n × step(s, 1)), keeping the lowest cash */
  const away = (s: GameState) => {
    let t = s
    let lowest = t.run.cash
    for (let i = 0; i < OFFLINE_CAP_TICKS; i++) {
      t = step(t, 1)
      lowest = Math.min(lowest, t.run.cash)
    }
    return { after: t, lowest, gain: t.run.cash - s.run.cash, wages: t.run.lifetime.wagesPaid - s.run.lifetime.wagesPaid }
  }
  // batch 16: the whole offline measurement runs market off, like its ladder start
  const base = withoutMarket(() => away(loaded))
  const planted = withoutMarket(() => away(planter))
  const noSeeds = (s: GameState): GameState => ({ ...s, run: { ...s.run, autoBuySeeds: false, seeds: {} } })
  const idle = withoutMarket(() => away(noSeeds(planter)))
  const unstaffed = withoutMarket(() => away(noSeeds(ok(assignWorker(planter, 'plant', -1), planter))))
  console.log(
    'batch 10 offline 8 h',
    JSON.stringify({
      start: { cash: loaded.run.cash, assigned: planter.run.workers.assigned, crop: best, tiles: loaded.run.tiles.length, seeds: loaded.run.seeds },
      base: { gain: base.gain, wages: base.wages, lowest: base.lowest },
      planter: { gain: planted.gain, wages: planted.wages, lowest: planted.lowest, workerPlants: planted.after.run.lifetime.workerPlants, harvests: planted.after.run.counters.harvests - planter.run.counters.harvests },
      autoBuyOff: { gain: idle.gain, wages: idle.wages, workerPlants: idle.after.run.lifetime.workerPlants },
    }),
  )

  it('the base run is batch 8\'s gain on the same start, no planter (re-pinned batch 16: market off)', () => {
    // re-pinned batch 28.1 (was 1085): the batch 8 end state moved (the blunt-pickaxe repair collects the tray first)
    // re-pinned batch 32 (was 1195): hit carry-over and the sickle's seed roll move the batch 8 end state
    // re-pinned batch 35 (was 965): crop re-ladder: potato start, carrot licence 💰25 (the batch 8 end state moved)
    expect(base.gain).toBe(1082)
  })

  it('a planter keeps the loop running offline: more cash than batch 8, never below 0 (pinned) (re-pinned batch 16: market off)', () => {
    expect(planted.gain).toBeGreaterThan(base.gain)
    // re-pinned batch 28.1 (was [69849, 3551, 711])
    // re-pinned batch 32 (was [70009, 3551, 711]): hit carry-over moves the start, the sickle's seed roll the run
    // re-pinned batch 35 (was [70297, 3553, 710]): crop re-ladder: potato start, carrot licence 💰25
    expect([planted.gain, planted.wages, planted.after.run.lifetime.workerPlants]).toEqual([71409, 3551, 711])
    expect(planted.lowest).toBeGreaterThanOrEqual(0)
  })

  // re-pinned batch 32 (was 0 plants, cash and wages equal to no planter): the copper sickle now finds seeds, so the
  // planter plants the one seed the harvests drop into the empty pouch, then idles
  // re-pinned batch 35 (was [1, 4991, 30]): crop re-ladder: potato start, carrot licence 💰25 — this start's sickle
  // rolls find no seed, so the planter plants nothing and idles
  it('auto-buy off and an empty pouch: the planter plants only the seeds the sickle finds, then idles', () => {
    expect([idle.after.run.lifetime.workerPlants, idle.after.run.cash, idle.wages]).toEqual([0, 3774, 18])
    // batch 35: no seed found, so the planter changes nothing — the same run as no planter (was [0, 4886, 25])
    expect([unstaffed.after.run.lifetime.workerPlants, unstaffed.after.run.cash, unstaffed.wages]).toEqual([0, 3774, 18])
  })
})

describe('batch 10: ladder bot continues to the plant certificate after the furnace loaders and smart furnace', () => {
  let end = createInitialState()
  // batch 16: market off — see the batch-8 note; off, it replays the pre-market pins
  const summary = withoutMarket(() =>
    runBot(true, {
      ticks: 2 * HOUR_TICKS,
      licenses: LICENSE_ORDER,
      crops: PLANT_ORDER,
      ladder: true,
      copperTools: true,
      workers: true,
      furnace: true,
      planter: true,
      onEnd: (s) => (end = s),
    }),
  )
  const { ladderTicks, finalCash, wagesPaid, lowest, borrowed } = summary
  console.log('batch 10 ladder', JSON.stringify({ ladderTicks, finalCash, wagesPaid, lowest, borrowed, workerPlants: end.run.lifetime.workerPlants, plantCrop: end.run.plantCrop, workers: end.run.workers.assigned }, null, 1))

  // re-pinned batch 32 (the batch 9 steps above, plantCertificate 4341, [13694, 999, 72]): hit carry-over
  it('every batch-9 step is unchanged; the plant certificate follows the smart furnace, pinned (re-pinned batch 16: market off, replays the pre-market pins)', () => {
    expect(ladderTicks).toEqual({
      // re-pinned batch 35 (was 477 / 666 / 885 / 951 / 1255 / 1386 / 1737 / 1944 / 2151 / 2367 / 2550 / 3147 / 3747):
      // crop re-ladder: potato start, carrot licence 💰25
      storageLv1: 486,
      veinLv1: 890,
      furnace: 1206,
      storageLv2: 1269,
      veinLv2: 1511,
      firstBar: 1580,
      copperPickaxe: 1823,
      'copper:water': 2129,
      'copper:harvest': 2303,
      'copper:plant': 2543,
      oreCertificate: 2723,
      fuelCertificate: 3329,
      smart: 3923,
      plantCertificate: 4523,
    })
    // re-pinned batch 35 (was [14976, 984, 69]): crop re-ladder: potato start, carrot licence 💰25
    expect([finalCash, wagesPaid, end.run.lifetime.workerPlants]).toEqual([13415, 995, 65])
  })

  it('the planter gets a worker and plants; nothing goes negative and it never borrows', () => {
    expect(end.run.workers.assigned.plant).toBe(1)
    expect(end.run.lifetime.workerPlants).toBeGreaterThan(0)
    expect(lowest).toBeGreaterThanOrEqual(0)
    expect(borrowed).toBe(false)
  })
})

describe('batch 11: ladder bot continues to storage Lv3, vein Lv3, the first iron bar, the iron pickaxe and the mine worker', () => {
  const { summary, end } = ironLadder
  const { ladderTicks, finalCash, wagesPaid, lowest, borrowed } = summary
  const { ironBarsSmelted, ironBars, workerMines, workerPlants } = end.run.lifetime
  console.log(
    'batch 11 ladder',
    JSON.stringify({ ladderTicks, finalCash, wagesPaid, lowest, borrowed, ironBarsSmelted, ironBars, workerMines, workerPlants, workers: end.run.workers.assigned, rack: end.run.rack }, null, 1),
  )

  it('every batch-10 step is unchanged; storage Lv3 → vein Lv3 → iron mold → first iron bar → iron pickaxe → mine certificate follow, pinned (re-pinned batch 16: market off, replays the pre-market pins)', () => {
    const { storageLv3, veinLv3, ironMold, firstIronBar, ironPickaxe, mineCertificate, ...older } = ladderTicks
    // re-pinned batch 32 (was the batch 10 steps; storageLv3 4389, veinLv3 / ironPicked 4641, firstIronBar 4845,
    // ironPickaxe 5337, mineCertificate 5928; [12443, 1235, 248, 20]): hit carry-over
    expect(older).toEqual({
      // re-pinned batch 35 (was 477 / 666 / 885 / 951 / 1255 / 1386 / 1737 / 1944 / 2151 / 2367 / 2550 / 3147 / 3747):
      // crop re-ladder: potato start, carrot licence 💰25
      storageLv1: 486,
      veinLv1: 890,
      furnace: 1206,
      storageLv2: 1269,
      veinLv2: 1511,
      firstBar: 1580,
      copperPickaxe: 1823,
      'copper:water': 2129,
      'copper:harvest': 2303,
      'copper:plant': 2543,
      oreCertificate: 2723,
      fuelCertificate: 3329,
      smart: 3923,
      plantCertificate: 4523,
    })
    const order = [storageLv3, veinLv3, ironMold, firstIronBar, ironPickaxe, mineCertificate]
    for (const tick of order) expect(tick).toBeLessThanOrEqual(IRON_TICKS)
    expect([...order].sort((a, b) => a! - b!)).toEqual(order)
    // re-pinned batch 33 (was ironPicked 4647, firstIronBar 4825, ironPickaxe 5307, mineCertificate 5907; [14581, 1213,
    // 247, 20]): molds: every kind smelts at once — the iron mold (🥉10 ⛰️20 💰6,500) replaces the free switch
    expect({ storageLv3, veinLv3, ironMold, firstIronBar, ironPickaxe, mineCertificate }).toEqual({
      // re-pinned batch 35 (was 4410 / 4647 / 5246 / 5385 / 5868 / 6468): crop re-ladder: potato start, carrot licence 💰25
      storageLv3: 4601,
      veinLv3: 4823,
      ironMold: 5474,
      firstIronBar: 5630,
      ironPickaxe: 6113,
      mineCertificate: 6713,
    })
    // (task 172: the sickle's seed roll moves these again)
    // re-pinned batch 35 (was [7014, 1167, 143, 16]): crop re-ladder: potato start, carrot licence 💰25 — the mine
    // certificate lands 245 ticks later, so less of the hour is left for the mine worker
    expect([finalCash, wagesPaid, workerMines, ironBarsSmelted]).toEqual([5356, 1114, 95, 14])
  })

  it('the miner gets a worker and mines; nothing goes negative and it never borrows', () => {
    expect(end.run.workers.assigned.mine).toBe(1)
    expect(workerMines).toBeGreaterThan(0)
    expect(lowest).toBeGreaterThanOrEqual(0)
    expect(borrowed).toBe(false)
  })
})

/** vein Lv3, storage Lv3, a fresh iron pickaxe and a furnace on iron, with a miner (and the two loaders) staffed */
function ironWorks({ smart = false, loaders = true }: { smart?: boolean; loaders?: boolean }): GameState {
  const init = createInitialState()
  const assigned = { plant: 0, water: 0, harvest: 0, ore: Number(loaders), fuel: Number(loaders), mine: 1, clerk: 0, manager: 0, stoker: 0 }
  const furnace = { ...createFurnace(), built: true, smart, molds: { ...createFurnace().molds, ironOre: { ore: 0, progress: 0, ready: 0 } } }
  const workers = { pool: assigned.ore + assigned.fuel + 1, assigned, certificates: ['ore', 'fuel', 'mine'] as WorkerJob[] }
  return {
    ...init,
    run: {
      ...init.run,
      cash: 1000,
      mineLicense: true,
      storageLevel: 3,
      bagCapacity: init.run.bagCapacity + 3 * storageSlotsPerLevel(),
      vein: { level: 3, progress: 0, rock: 'stone' },
      rack: { iron: pickaxeDurability('iron') },
      selectedPickaxe: 'iron',
      furnace,
      workers,
    },
  }
}

/** coal the player leaves in storage for the fuel loader when selling */
const KEEP_COAL = 10
/**
 * One hour of the mine → furnace chain with no player but a seller: every `cadence` ticks the player sells what the
 * chain does not use (stone, copper ore, coal above KEEP_COAL; with no loaders also the iron ore), so storage has room.
 */

function ironBench({ cadence, smart = false, loaders = true }: { cadence: number; smart?: boolean; loaders?: boolean }) {
  const start = ironWorks({ smart, loaders })
  let s = start
  let lowest = lowestValue(s)
  const sell = (id: 'stone' | 'copperOre' | 'coal' | 'ironOre', keep = 0) => {
    const r = sellItem(s, id, (s.run.inventory[id] ?? 0) - keep)
    if (r.ok) s = r.state
  }
  for (let t = 0; t < HOUR_TICKS; t++) {
    if (t % cadence === 0) {
      sell('stone')
      sell('copperOre')
      sell('coal', loaders ? KEEP_COAL : 0)
      if (!loaders) sell('ironOre')
    }
    s = step(s, 1)
    lowest = Math.min(lowest, lowestValue(s))
  }
  const was = start.run.lifetime
  const now = s.run.lifetime
  return {
    ironBars: now.ironBarsSmelted - was.ironBarsSmelted,
    workerMines: now.workerMines - was.workerMines,
    wages: now.wagesPaid - was.wagesPaid,
    wastedUnits: (now.fireWasted - was.fireWasted) / fireUnitTicks(),
    cash: s.run.cash - start.run.cash,
    durability: heldPickaxe(s.run)!.durability,
    lowest,
  }
}

describe('batch 11: iron bars per hour with mine + ore + fuel workers, plain vs smart (player only sells)', () => {
  const bench = {
    plain120: ironBench({ cadence: 120 }),
    smart120: ironBench({ cadence: 120, smart: true }),
    plain600: ironBench({ cadence: 600 }),
    smart600: ironBench({ cadence: 600, smart: true }),
    minerOnly120: ironBench({ cadence: 120, loaders: false }),
  }
  console.log('batch 11 iron bars/hour', JSON.stringify(bench, null, 1))

  // re-pinned batch 32 (was plain120 [28, 679, 801, 4], smart120 [28, 679, 799, 0], plain600 [15, 329, 418, 60],
  // smart600 [11, 269, 315, 0]): hit carry-over — an iron pickaxe's spare hits break the next rock, so storage fills in
  // fewer presses and the miner idles sooner
  it('pins iron bars, miner presses, wages and fire wasted per hour (PLAN.md "Batch 11 results")', () => {
    expect(Object.fromEntries(Object.entries(bench).map(([k, v]) => [k, [v.ironBars, v.workerMines, v.wages, Math.ceil(v.wastedUnits)]]))).toEqual({
      // re-pinned batch 33 (was plain120 [29, 447, 572, 2], smart120 [29, 436, 560, 0], plain600 [12, 199, 282, 69],
      // smart600 [11, 159, 203, 0]): molds: every kind smelts at once — the loader also smelts the copper ore mined
      // between sales in the copper mold, so copper bars fill storage and the miner idles sooner
      plain120: [23, 289, 462, 8],
      smart120: [23, 288, 460, 0],
      plain600: [15, 202, 322, 48],
      smart600: [12, 166, 251, 0],
      minerOnly120: [0, 720, 720, 0],
    })
  })

  it('the furnace never beats its iron ceiling (one bar per 120 s), smart wastes no fire, nothing goes negative', () => {
    for (const r of Object.values(bench)) {
      expect(r.ironBars).toBeLessThanOrEqual(HOUR_TICKS / barTicks('ironOre'))
      expect(r.lowest).toBeGreaterThanOrEqual(0)
    }
    expect([bench.smart120.wastedUnits, bench.smart600.wastedUnits]).toEqual([0, 0])
  })
})

describe('batch 11: 8 h offline from the batch-11 ladder end with the whole chain (miner, loaders, farm workers)', () => {
  // before leaving the player sells the stone and copper ore (the coal and iron ore stay for the loaders)
  const sold = (s: GameState, id: 'stone' | 'copperOre') => {
    const r = sellItem(s, id, s.run.inventory[id] ?? 0)
    return r.ok ? r.state : s
  }
  // batch 16: the whole offline measurement runs market off, like its ladder start
  const { start, t, offline, minerStop, lowest } = withoutMarket(() => {
    const start = sold(sold(ironLadder.end, 'stone'), 'copperOre')
    let t = start
    let lowest = t.run.cash
    let minerStop = 0
    for (let i = 0; i < OFFLINE_CAP_TICKS; i++) {
      const mines = t.run.lifetime.workerMines
      t = step(t, 1)
      if (t.run.lifetime.workerMines > mines) minerStop = i + 1
      lowest = Math.min(lowest, t.run.cash)
    }
    const was = start.run.lifetime
    const now = t.run.lifetime
    const offline = {
      start: {
        cash: start.run.cash,
        storage: `${bagCount(start.run)}/${start.run.bagCapacity}`,
        inventory: start.run.inventory,
        durability: heldPickaxe(start.run)?.durability,
        assigned: start.run.workers.assigned,
      },
      minerStop,
      storage: `${bagCount(t.run)}/${t.run.bagCapacity}`,
      inventory: t.run.inventory,
      durability: heldPickaxe(t.run)?.durability,
      mines: now.workerMines - was.workerMines,
      ironBars: now.ironBarsSmelted - was.ironBarsSmelted,
      copperBars: now.barsSmelted - was.barsSmelted,
      plants: now.workerPlants - was.workerPlants,
      gain: t.run.cash - start.run.cash,
      wages: now.wagesPaid - was.wagesPaid,
      lowest,
    }
    return { start, t, offline, minerStop, lowest }
  })
  console.log('batch 11 offline 8 h', JSON.stringify(offline, null, 1))

  it('the miner stops because storage is full, not because the pickaxe went blunt (pinned) (re-pinned batch 16: market off)', () => {
    expect(bagCount(t.run)).toBe(t.run.bagCapacity)
    expect(heldPickaxe(t.run)!.durability).toBeGreaterThan(0)
    expect(minerStop).toBeLessThan(OFFLINE_CAP_TICKS)
    // re-pinned batch 32 (was [766, 45, 7, 70974, 3616]): hit carry-over fills storage in fewer presses
    // re-pinned batch 33 (was [871, 42, 8, 72860, 3610]): molds: every kind smelts at once — the ladder end now banks
    // copper bars from the copper mold, so storage starts fuller and the miner stops sooner
    // re-pinned batch 35 (was [346, 27, 3, 72908, 3592]): crop re-ladder: potato start, carrot licence 💰25
    expect([minerStop, offline.mines, offline.ironBars, offline.gain, offline.wages]).toEqual([471, 33, 4, 72511, 3609])
  })

  it('cash never goes below 0 and step(s, n) = n × step(s, 1) over the whole 8 h', () => {
    expect(lowest).toBeGreaterThanOrEqual(0)
    expect(withoutMarket(() => step(start, OFFLINE_CAP_TICKS))).toEqual(t)
  })
})

describe('batch 11: mining stays below the farm cap with the iron tier', () => {
  const pumpkin = runCropBot('eggplant').cashPerEnergy
  const bench = (tier: PickaxeTier, lv10: boolean) =>
    mineBench({ pickaxe: true, tier, vein: 3, xp: lv10 ? 400 * { wooden: 1, copper: 2, iron: 4, gold: 8 }[tier] : 0, mastered: lv10 }).cashPerEnergy
  const mining = {
    woodLv10Vein3: bench('wooden', true),
    copperLv10Vein3: bench('copper', true),
    ironLv0Vein3: bench('iron', false),
    ironLv10Vein3: bench('iron', true),
  }
  // the miner spends no player energy: compare its net cash per hour (sales − its wages) with farm workers'
  const miner = ironBench({ cadence: 120, loaders: false })
  const farmWorkers = runCropBot('eggplant', HOUR_TICKS, undefined, { plant: 1, water: 1, harvest: 1 }).perMin * 60
  console.log('batch 11 mining', JSON.stringify({ pumpkin, mining, minerCashPerHour: miner.cash, farmWorkersCashPerHour: farmWorkers }, null, 1))

  it('every pickaxe on vein Lv3 stays below 0.9 × pumpkin (cash per energy, repairs at input value)', () => {
    for (const v of Object.values(mining)) expect(v).toBeLessThan(0.9 * pumpkin)
  })

  // batch 32 (task 172d): a report, not an assert (the hierarchy is a design stance, DECISIONS 2026-11-09)
  it('reports a miner\'s net cash per hour vs the three pumpkin farm workers', () => {
    console.log('PIN32h12', JSON.stringify({ miner: miner.cash, farmWorkers, ratio: miner.cash / farmWorkers }))
  })
})
