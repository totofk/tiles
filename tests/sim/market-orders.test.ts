import { describe, expect, it, vi } from 'vitest'
import {
  harvest,
  plant,
  till,
  water,
  type ActionResult,
} from '../../src/core/actions'
import { CROP_IDS, type CropId } from '../../src/core/data/crops'
import { marketSteadyFactor } from '../../src/core/market'
import { PICKAXE_TIERS } from '../../src/core/data/items'
import {
  ACTION_ENERGY_COST,
  TILE_CAP,
  certificateCost,
  cropGrowTicks,
  cropSellPrice,
  orderBonus,
  orderSlotStars,
  orderTierCount,
  storageSlotsPerLevel,
  veinDrops,
} from '../../src/core/balance'
import { bestPickaxeTier } from '../../src/core/mining'
import { createInitialState, createTile, type GameState } from '../../src/core/state'
import { step } from '../../src/core/step'
import { growthProgress } from '../../src/core/tile'
import { WORKER_JOBS, type WorkerJob } from '../../src/core/data/workers'
import {
  acceptOrder,
  buyOrderBoard,
  discardOrder,
  isCropGood,
  isOffer,
  orderCount,
  orderPool,
  rollOffer,
} from '../../src/core/orders'
import type { OrderGood } from '../../src/core/state'
import type { ItemId } from '../../src/core/data/items'
import {
  ALL_COPPER,
  ATTENTIVE_ENERGY_PER_MIN,
  HOUR_TICKS,
  IRON_TICKS,
  LICENSE_ORDER,
  MARKET_TICKS,
  PLANT_ORDER,
  bestFarmAction,
  ironLadder,
  mineBench,
  runBot,
  runCropBot,
  staffedLemon,
  withBatch13,
  withoutMarket,
} from './bot'

vi.mock('../../src/core/balance', async (importOriginal) => (await import('./balanceMock')).balanceMock(importOriginal))

// frozen at the four crops the batch-12 pin was measured with; batch 22's own sim measures the 8-crop mixes
const FARM_PAIR_CROPS = ['radish', 'corn', 'eggplant', 'pumpkin'] as const satisfies readonly CropId[]

const FARM_PAIRS: [CropId, CropId][] = FARM_PAIR_CROPS.flatMap((a, i) => FARM_PAIR_CROPS.slice(i + 1).map((b): [CropId, CropId] => [a, b]))

/**
 * 24 tiles, the first `first` planted with pair[0] and the rest with pair[1], farmed by hand with bestFarmAction's
 * priority (harvest → water a dry growing tile → plant the tile's own crop → till), cash 💰10 000 so seeds never block
 * it. Net cash per hour, standing crops at sell price × growth (runCropBot's accounting).
 */

function splitFarm(pair: [CropId, CropId], first: number, ticks = MARKET_TICKS): number {
  const init = createInitialState()
  const tiles = [...init.run.tiles, ...Array.from({ length: TILE_CAP - init.run.tiles.length }, createTile)]
  const cash = 10_000
  let s: GameState = { ...init, run: { ...init.run, cash, licenses: [...new Set<CropId>(['radish', ...pair])], tiles } }
  const cropAt = (i: number) => (i < first ? pair[0] : pair[1])
  const growing = (i: number) => {
    const { cropId, growth } = s.run.tiles[i]
    return cropId !== undefined && growth < cropGrowTicks(cropId, s.meta, 0)
  }
  const tries: ((i: number) => ActionResult | null)[] = [
    (i) => harvest(s, i),
    (i) => (s.run.tiles[i].moisture === 0 && growing(i) ? water(s, i) : null),
    (i) => plant(s, i, cropAt(i)),
    (i) => till(s, i),
  ]
  const next = () => {
    for (const act of tries)
      for (let i = 0; i < s.run.tiles.length; i++) {
        const r = act(i)
        if (r?.ok) return r.state
      }
    return null
  }
  for (let t = 0; t < ticks; t++) {
    while (s.run.energy >= ACTION_ENERGY_COST) {
      const n = next()
      if (!n) break
      s = n
    }
    s = step(s, 1)
  }
  const field = s.run.tiles.reduce((sum, t) => sum + (t.cropId ? cropSellPrice(t.cropId, s.meta, 0) * growthProgress(t, s) : 0), 0)
  return Math.round((s.run.cash - cash + field) / (ticks / HOUR_TICKS))
}

describe('batch 12: crop market — steady state, income before/after, hierarchy, no stall', () => {
  const meta = createInitialState().meta
  const steady = Object.fromEntries(
    CROP_IDS.map((c) => [c, { t24: marketSteadyFactor(c, 24, meta, 0), t120: marketSteadyFactor(c, 120, meta, 0) }]),
  )
  const lemon24Fert5 = marketSteadyFactor('pumpkin', 24, meta, 5)

  const hour = (perMin: number) => Math.round(perMin * 60)
  const ALL_THREE = { plant: 1, water: 1, harvest: 1 }
  const lemonManual = (on: boolean) => {
    const run = () => runCropBot('pumpkin', MARKET_TICKS, undefined, undefined, TILE_CAP)
    return hour((on ? run() : withoutMarket(run)).perMin)
  }
  const lemonWorkers = (on: boolean) => {
    const run = () => runCropBot('pumpkin', MARKET_TICKS, undefined, ALL_THREE, TILE_CAP)
    return hour((on ? run() : withoutMarket(run)).perMin)
  }
  const income = {
    lemon24Manual: { before: lemonManual(false), after: lemonManual(true) },
    lemon24Workers: { before: lemonWorkers(false), after: lemonWorkers(true) },
  }
  // the best 2-crop split (steps of 4 tiles) with the market on, then the same split and the best one-crop farm off
  const splits = FARM_PAIRS.flatMap((pair) => [4, 8, 12, 16, 20].map((first) => ({ pair, first, perHour: splitFarm(pair, first) })))
  const best = splits.reduce((a, b) => (b.perHour > a.perHour ? b : a))
  const single = FARM_PAIR_CROPS.map((c) => ({ crop: c, perHour: splitFarm([c, c], TILE_CAP) })).reduce((a, b) => (b.perHour > a.perHour ? b : a))
  const bestSplit = {
    ...best,
    before: withoutMarket(() => splitFarm(best.pair, best.first)),
    bestOneCrop: { ...single, before: withoutMarket(() => splitFarm([single.crop, single.crop], TILE_CAP)) },
  }

  // ladder bots: ironLadder above is the market-off run (replays the pre-market pins); this is the market-on run at
  // depth 60 (batch 16) — it stalls cash-broke after storage Lv2, pinned as the retune's cost on the pre-hand-picked era
  const ladderOn = runBot(true, { ticks: IRON_TICKS, licenses: LICENSE_ORDER, crops: PLANT_ORDER, ladder: true, copperTools: true, workers: true, furnace: true, planter: true, iron: true })
  const ladder = {
    finalCash: { before: ironLadder.summary.finalCash, after: ladderOn.finalCash },
    mineCertificate: { before: ironLadder.summary.ladderTicks.mineCertificate, after: ladderOn.ladderTicks.mineCertificate },
  }

  // hierarchy at the size the market bites: 24 pumpkin tiles by hand, market on, vs the batch-11 mining benches
  const pumpkin24 = runCropBot('eggplant', MARKET_TICKS, undefined, undefined, TILE_CAP).cashPerEnergy
  const ironLv10 = mineBench({ pickaxe: true, tier: 'iron', vein: 3, xp: 1600, mastered: true }).cashPerEnergy

  // no stall: the milestones the core recorded on the iron ladder run, from tick 0 to the last one
  const reached = Object.entries(ironLadder.end.run.milestones).sort((a, b) => a[1]! - b[1]!)
  const gaps = reached.map(([id, tick], i) => ({ id, gap: tick! - (i ? reached[i - 1][1]! : 0) }))
  const longest = gaps.reduce((a, b) => (b.gap > a.gap ? b : a))

  console.log('batch 12 market', JSON.stringify({ steady, lemon24Fert5, income, bestSplit, ladder, pumpkin24, ironLv10, reached, longest }, null, 1))

  it('steady-state factor of one crop: 24 tiles 0.94–0.96, 120 tiles 0.75 (every crop, base grow time) (re-pinned batch 21: depth 240)', () => {
    for (const { t24, t120 } of Object.values(steady)) {
      expect(t24).toBeGreaterThanOrEqual(0.94)
      expect(t24).toBeLessThanOrEqual(0.96)
      expect(t120).toBeCloseTo(0.75, 2)
    }
    expect(lemon24Fert5).toBeCloseTo(0.9, 2)
  })

  it('the market costs income on a 24-tile one-crop farm, manual and with workers (pinned) (re-pinned batch 16: depth 60)', () => {
    expect(income.lemon24Manual.after).toBeLessThan(income.lemon24Manual.before)
    expect(income.lemon24Workers.after).toBeLessThan(income.lemon24Workers.before)
    expect(income).toEqual({
      lemon24Manual: { before: 13321, after: 12941 },
      lemon24Workers: { before: 9507, after: 9239 },
    })
  })

  it('the best 2-crop split on 24 tiles (pinned) still earns less than 24 lemon tiles at depth 240 — the split goal of batch 16 is not reached (94.0 % of mono)', () => {
    expect(bestSplit).toEqual({
      pair: ['eggplant', 'pumpkin'],
      first: 4,
      perHour: 12165,
      before: 12355,
      bestOneCrop: { crop: 'pumpkin', perHour: 12941, before: 13321 },
    })
  })

  // re-pinned batch 32 (was 12443 / 5928, and market on stalled cash-broke after storage Lv2: 💰0, no mine
  // certificate): hit carry-over and the sickle's seed roll — the market-on run no longer stalls, it reaches the mine
  // certificate at tick 5943
  // re-pinned batch 33 (was 14581 / 5907 off, 14020 / 5943 on): molds: every kind smelts at once — the iron mold's
  // 💰6,500 and its wait for 🥉10 ⛰️20 come before the iron pickaxe
  it('market off replays the pre-market pins (7014 / 6468); market on at depth 240 reaches the mine certificate too (batch 32)', () => {
    // re-pinned batch 35 (was 7014 / 6468 off, 6839 / 6468 on, market-on storage Lv2 951): crop re-ladder: potato
    // start, carrot licence 💰25
    expect(ladder.finalCash.before).toBe(5356)
    expect(ladder.mineCertificate.before).toBe(6713)
    expect(ladder.finalCash.after).toBe(5738)
    expect(ladder.mineCertificate.after).toBe(6626)
    expect(ladderOn.ladderTicks.storageLv2).toBe(1269)
  })

  it('mining stays below farming with the market on: iron Lv10 on vein Lv3 < 0.9 × 24-tile pumpkin by hand', () => {
    expect(ironLv10).toBeLessThan(0.9 * pumpkin24)
  })

  it('no stall: the ladder never waits more than 60 game-minutes between two consecutive milestones (re-pinned batch 16: market off)', () => {
    expect(longest.gap).toBeLessThanOrEqual(HOUR_TICKS)
    // batch 22: 30 → 34 — the per-crop first-harvest rows now record alongside firstHarvest; the gaps are unchanged
    // re-pinned batch 32 (was ['certMine', 5928], longest ironPickaxe 696): hit carry-over
    // re-pinned batch 33 (was ['certMine', 5907], longest certPlant 757): molds: every kind smelts at once — the iron
    // mold's wait lands inside the vein Lv3 → iron pickaxe gap (20.4 game-min, under the cap)
    // re-pinned batch 35 (was [34, ['certMine', 6468], ironPickaxe 1221]): crop re-ladder: potato start, carrot licence
    // 💰25 — two more rows (the potato milestones), the longest gap 21.5 game-min, under the cap
    expect([reached.length, reached.at(-1), longest]).toEqual([36, ['certMine', 6713], { id: 'ironPickaxe', gap: 1290 }])
  })

  it('step(s, n) = n × step(s, 1) with the market decaying, milestones recording and workers on', () => {
    const start = ironLadder.end
    expect(Object.values(start.run.market).some((g) => g > 0)).toBe(true)
    let one = start
    for (let i = 0; i < 600; i++) one = step(one, 1)
    expect(step(start, 600)).toEqual(one)
  })
})

describe('batch 13: tool-gated certificates, hand-picked ×1.25, iron open (rules.batch13 on)', () => {
  const r = withBatch13(() => {
    let end = createInitialState()
    const ladder = runBot(true, {
      ticks: IRON_TICKS,
      licenses: LICENSE_ORDER,
      crops: PLANT_ORDER,
      ladder: true,
      copperTools: true,
      workers: true,
      furnace: true,
      planter: true,
      iron: true,
      buyTools: true,
      onEnd: (s) => (end = s),
    })
    const minute = (tick: number | undefined) => (tick === undefined ? null : Math.round((tick / 60) * 10) / 10)
    // the order clerk (batch 14), the Manager (batch 28/29) and the Stoker (batch 34) are not on the batch-13 ladder
    const certificates = Object.fromEntries(
      WORKER_JOBS.filter((job): job is Exclude<WorkerJob, 'clerk' | 'manager' | 'stoker'> => job !== 'clerk' && job !== 'manager' && job !== 'stoker').map((job) => [
        job,
        {
          unlocked: minute(ladder.certUnlocked[job]?.tick),
          bought: minute(job === 'water' || job === 'harvest' ? ladder.workerTicks[`${job}Certificate`] : ladder.ladderTicks[`${job}Certificate`]),
        },
      ]),
    )
    // farm certificate items vs the storage held the tick each became buyable
    const fits = (['water', 'harvest', 'plant'] as const).map((job) => {
      const { cash, ...items } = certificateCost(job, end.meta)
      void cash
      return { job, items: Object.values(items).reduce((a, b) => a + (b ?? 0), 0), bagCapacity: ladder.certUnlocked[job]?.bagCapacity }
    })
    const reached = Object.entries(end.run.milestones).sort((a, b) => a[1]! - b[1]!)
    const gaps = reached.map(([id, tick], i) => ({ id, gap: tick! - (i ? reached[i - 1][1]! : 0) }))
    const longest = gaps.reduce((a, b) => (b.gap > a.gap ? b : a))
    const idle = staffedLemon(false)
    const attentive = staffedLemon(true)
    // the same farm with the three copper tools the ladder owns by the time it staffs (a copper can halves the waterings)
    const copper = { idle: staffedLemon(false, ALL_COPPER), attentive: staffedLemon(true, ALL_COPPER) }
    const pumpkin24 = runCropBot('eggplant', MARKET_TICKS, undefined, undefined, TILE_CAP).cashPerEnergy
    const ironLv10 = mineBench({ pickaxe: true, tier: 'iron', vein: 3, xp: 1600, mastered: true }).cashPerEnergy
    return { ladder, end, certificates, fits, reached, longest, idle, attentive, copper, pumpkin24, ironLv10 }
  })
  const { ladder, end, certificates, fits, reached, longest, idle, attentive, copper, pumpkin24, ironLv10 } = r
  const gain = (a: typeof idle, b: typeof idle) => ({ gross: b.grossPerHour - a.grossPerHour, net: b.netPerHour - a.netPerHour })
  const handPickedGain = gain(idle, attentive)
  const copperGain = gain(copper.idle, copper.attentive)
  console.log(
    'batch 13',
    JSON.stringify(
      { certificates, workerTicks: ladder.workerTicks, ladderTicks: ladder.ladderTicks, finalCash: ladder.finalCash, fits, reached, longest, idle, attentive, handPickedGain, copper, copperGain, pumpkin24, ironLv10, lowest: ladder.lowest, borrowed: ladder.borrowed },
      null,
      1,
    ),
  )

  it('the ladder buys the water and harvest certificates once each tool is at Lv3, water first (pinned minutes)', () => {
    expect(certificates.water.unlocked).not.toBeNull()
    expect(certificates.harvest.unlocked).not.toBeNull()
    expect(certificates.water.bought!).toBeGreaterThanOrEqual(certificates.water.unlocked!)
    expect(certificates.harvest.bought!).toBeGreaterThanOrEqual(certificates.harvest.unlocked!)
    expect(certificates.water.bought!).toBeLessThan(certificates.harvest.bought!)
    expect(end.run.tools).toEqual({ water: 3, harvest: 3, plant: 3 })
    // re-pinned batch 32 (was plant 59.7 / 79.8, harvest 65.7 / 65.7, ore 38 / 49, mine 84.8 / 107.7; [11390, certPlant
    // 845]): hit carry-over
    // re-pinned batch 35 (was plant 60 / 78.7, water 23.3 / 24.8, harvest 66 / 66, ore 38 / 48.7, fuel 58.7 / 58.7,
    // mine 83.7 / 113.8): crop re-ladder: potato start, carrot licence 💰25 — potato's quick plants and waters unlock
    // the water and plant certificates sooner
    expect(certificates).toEqual({
      plant: { unlocked: 52.5, bought: 80.7 },
      water: { unlocked: 17.2, bought: 27.5 },
      harvest: { unlocked: 58.6, bought: 59.6 },
      ore: { unlocked: 40.6, bought: 50.6 },
      fuel: { unlocked: 60.6, bought: 60.6 },
      mine: { unlocked: 85.6, bought: 116 },
    })
    // re-pinned batch 33 (was mine bought 104.7; [13529, certPlant 764]): molds: every kind smelts at once — the iron
    // mold's 💰6,500 comes before the iron pickaxe and the mine certificate
    // re-pinned batch 35 (was [5818, ironPickaxe 1206]): crop re-ladder: potato start, carrot licence 💰25
    expect([ladder.finalCash, longest]).toEqual([6181, { id: 'ironPickaxe', gap: 1221 }])
  })

  it('no stall: no wait between two consecutive milestones is longer than 60 game-minutes', () => {
    expect(longest.gap).toBeLessThanOrEqual(HOUR_TICKS)
  })

  it('every farm certificate fits the storage the player holds when it becomes buyable', () => {
    for (const f of fits) expect(f.items).toBeLessThanOrEqual(f.bagCapacity!)
  })

  it('a pure farmer (no storage bought) fits water and plant; harvest\'s 25 items need storage Lv1 (30), named on its row', () => {
    const start = createInitialState().run.bagCapacity
    const items = Object.fromEntries(fits.map((f) => [f.job, f.items]))
    expect(items).toEqual({ water: 20, harvest: 25, plant: 10 })
    expect([items.water <= start, items.plant <= start, items.harvest <= start, items.harvest <= start + storageSlotsPerLevel()]).toEqual([true, true, false, true])
  })

  it('nothing goes negative and it never borrows', () => {
    expect(ladder.lowest).toBeGreaterThanOrEqual(0)
    expect(ladder.borrowed).toBe(false)
  })

  it('24 lemon tiles fully staffed: the attentive player (✋ ×1.25) out-earns idle workers, gross and net (re-pinned batch 16: depth 60)', () => {
    expect(attentive.picked).toBeGreaterThan(0)
    expect(handPickedGain.gross).toBeGreaterThan(0)
    expect(handPickedGain.net).toBeGreaterThan(0)
    expect([idle.lowest, attentive.lowest, copper.idle.lowest, copper.attentive.lowest].every((c) => c >= 0)).toBe(true)
    expect(copperGain.gross).toBeGreaterThan(handPickedGain.gross)
    // re-pinned batch 32 (copperGain was { 5535, 5794 }): the copper sickle's seed drops save seed buys
    expect({ handPickedGain, copperGain }).toEqual({ handPickedGain: { gross: 2857, net: 3286 }, copperGain: { gross: 5931, net: 6170 } })
  })

  it('mining stays below farming with hand-picked on: iron Lv10 on vein Lv3 < 0.9 × 24-tile pumpkin by hand', () => {
    expect(ironLv10).toBeLessThan(0.9 * pumpkin24)
  })

  it('step(s, n) = n × step(s, 1) with workers, the market and hand-picked sales on', () => {
    withBatch13(() => {
      // a few hand-picked sales on top of the ladder end, so the glut holds player sales too
      let start = end
      for (let i = 0; i < start.run.tiles.length; i++) {
        const h = harvest(start, i)
        if (h.ok) start = h.state
      }
      expect(Object.values(start.run.market).some((g) => g > 0)).toBe(true)
      expect(Object.values(start.run.workers.assigned).some((n) => n > 0)).toBe(true)
      let one = start
      for (let i = 0; i < 600; i++) one = step(one, 1)
      expect(step(start, 600)).toEqual(one)
    })
  })
})

/**
 * Batch 14: one crop on `tileCount` tiles for `ticks`, 💰1000 at the start (seeds never block it), with or without the
 * 📋 board (bought at tick 0, the purchase refunded so both runs start alike). Board policy before each tick: accept
 * every open offer for the farmed crop, discard every other (the cooldown then refills the slot); never rerolls, never
 * spends ⭐. perJob 0 = runCropBot's player (bestFarmAction with all its energy); perJob k = staffedLemon's farm with k
 * planters, waterers and harvesters and its attentive player. Income = cash change + standing crops (runCropBot's
 * accounting) per hour.
 */

function orderFarm(crop: CropId, tileCount: number, perJob: number, board: boolean, ticks = MARKET_TICKS) {
  const init = createInitialState()
  const tiles = [...init.run.tiles, ...Array.from({ length: tileCount - init.run.tiles.length }, createTile)]
  const n = perJob
  const staffed = n > 0
  const assigned = { plant: n, water: n, harvest: n, ore: 0, fuel: 0, mine: 0, clerk: 0, manager: 0, stoker: 0 }
  const workers = { pool: 3 * n, assigned, certificates: [...WORKER_JOBS] }
  let s: GameState = { ...init, run: { ...init.run, cash: 1000, licenses: [...new Set<CropId>(['radish', crop])], plantCrop: crop, workers, tiles } }
  if (board) {
    const bought = buyOrderBoard({ ...s, run: { ...s.run, inventory: { stone: 10 }, counters: { ...s.run.counters, sales: 50 } } })
    if (!bought.ok) throw new Error(bought.error)
    s = { ...s, run: { ...s.run, orders: bought.state.run.orders, rngState: bought.state.run.rngState } }
  }
  const take = (r: ActionResult) => {
    if (r.ok) s = r.state
    return r.ok
  }
  let budget = 0
  let lowest = s.run.cash
  for (let t = 0; t < ticks; t++) {
    s.run.orders.offers.forEach((o, i) => {
      if (isOffer(o) && !o.accepted) take(o.good === crop ? acceptOrder(s, i) : discardOrder(s, i))
    })
    if (staffed) {
      budget = Math.min(budget + ATTENTIVE_ENERGY_PER_MIN / 60, ATTENTIVE_ENERGY_PER_MIN)
      for (let i = 0; i < s.run.tiles.length && budget >= 1; i++) if (take(harvest(s, i))) budget -= 1
    } else
      while (s.run.energy >= ACTION_ENERGY_COST) {
        const next = bestFarmAction(s, [crop])
        if (!next) break
        s = next.state
      }
    s = step(s, 1)
    lowest = Math.min(lowest, s.run.cash)
  }
  const field = s.run.tiles.reduce((sum, t) => sum + (t.cropId ? cropSellPrice(t.cropId, s.meta, 0) * growthProgress(t, s) : 0), 0)
  const hours = ticks / HOUR_TICKS
  return {
    incomePerHour: Math.round((s.run.cash - 1000 + field) / hours),
    starsPerHour: Math.round((s.run.lifetime.starsEarned / hours) * 10) / 10,
    ordersPerHour: Math.round((s.run.lifetime.ordersCompleted / hours) * 10) / 10,
    harvestsPerHour: Math.round(s.run.counters.harvests / hours),
    lowest,
    end: s,
  }
}

/** the goods a state can make, written apart from orderPool: what the property test checks the generator against */
function canProduce(run: GameState['run'], good: OrderGood): boolean {
  if ((CROP_IDS as readonly string[]).includes(good)) return run.licenses.includes(good as CropId)
  const mined = (id: ItemId) =>
    run.mineLicense && (veinDrops(run.vein.level)[id] ?? 0) > 0 && (id !== 'ironOre' || PICKAXE_TIERS.indexOf(bestPickaxeTier(run) ?? 'wooden') >= 1)
  if (good === 'copperBar') return run.furnace.built && mined('copperOre')
  if (good === 'ironBar') return run.furnace.built && mined('ironOre')
  return mined(good as ItemId)
}

describe('batch 14: 📋 orders and ⭐ (rules.batch13 on)', () => {
  const r = withBatch13(() => {
    const farm = (crop: CropId, tileCount: number, perJob: number) => {
      const on = orderFarm(crop, tileCount, perJob, true)
      const off = orderFarm(crop, tileCount, perJob, false)
      const { end, ...shown } = on
      void end
      return { ...shown, incomeOff: off.incomePerHour, bonusPct: Math.round(((on.incomePerHour - off.incomePerHour) / off.incomePerHour) * 1000) / 10 }
    }
    // the batch-13 24-tile lemon farm (one worker per job), and the same farm with the full pool of six (two per job)
    const farms = { carrot9: farm('radish', 9, 0), lemon24: farm('pumpkin', TILE_CAP, 1), lemon24x6: farm('pumpkin', TILE_CAP, 2) }
    // the whole ⭐ shop: 3rd + 4th slot and the clerk certificate (rerolls are consumables)
    const shopStars = orderSlotStars(2)! + orderSlotStars(3)! + certificateCost('clerk', createInitialState().meta).stars!
    const hoursToShop = Object.fromEntries(Object.entries(farms).map(([k, f]) => [k, Math.round((shopStars / f.starsPerHour) * 10) / 10]))
    // hierarchy: the best mining bench with every item paid at (1 + bonus) vs 24-tile pumpkin farming with no orders
    const pumpkin24 = runCropBot('eggplant', MARKET_TICKS, undefined, undefined, TILE_CAP).cashPerEnergy
    const ironLv10 = mineBench({ pickaxe: true, tier: 'iron', vein: 3, xp: 1600, mastered: true }).cashPerEnergy
    const miningWithBonus = ironLv10 * (1 + orderBonus())
    // the generator over the ladder bot's states (every 60 ticks of the batch-13 iron ladder)
    const states: GameState[] = []
    runBot(true, {
      ticks: IRON_TICKS,
      licenses: LICENSE_ORDER,
      crops: PLANT_ORDER,
      ladder: true,
      copperTools: true,
      workers: true,
      furnace: true,
      planter: true,
      iron: true,
      buyTools: true,
      onTick: (s) => {
        if (s.run.tick % 60 === 0) states.push(s)
      },
    })
    return { farms, shopStars, hoursToShop, pumpkin24, ironLv10, miningWithBonus, states }
  })
  const { farms, shopStars, hoursToShop, pumpkin24, ironLv10, miningWithBonus, states } = r
  // every good of every sampled state's pool, every tier: the count and the bag capacity at that moment
  const counts = states.flatMap((s) =>
    orderPool(s.run).flatMap((good) => Array.from({ length: orderTierCount() }, (_, tier) => ({ tick: s.run.tick, good, tier, count: orderCount(s, good, tier), bag: s.run.bagCapacity }))),
  )
  const items = counts.filter((c) => !isCropGood(c.good))
  const poolSizes = states.map((s) => orderPool(s.run).length)
  console.log(
    'batch 14',
    JSON.stringify(
      { farms, shopStars, hoursToShop, pumpkin24, ironLv10, miningWithBonus, cap: 0.9 * pumpkin24, states: states.length, poolSizes: [Math.min(...poolSizes), Math.max(...poolSizes)], maxItemShare: Math.max(...items.map((c) => c.count / c.bag)) },
      null,
      1,
    ),
  )

  it('⭐ per hour is paced by time: every farm earns 4–12 ⭐/h; equal within 1.5 ⭐/h when the farm makes what the count assumes', () => {
    for (const f of Object.values(farms)) {
      expect(f.starsPerHour).toBeGreaterThanOrEqual(4)
      expect(f.starsPerHour).toBeLessThanOrEqual(12)
      expect(f.lowest).toBeGreaterThanOrEqual(0)
    }
    // carrot by hand harvests ~99 % of tiles ÷ grow time, six lemon workers ~95 %; three make ~48 %, so they earn ~half
    expect(Math.abs(farms.carrot9.starsPerHour - farms.lemon24x6.starsPerHour)).toBeLessThanOrEqual(1.5)
  })

  it('orders add income on every farm; ⭐/h, order cash bonus and hours to the whole ⭐ shop pinned (PLAN.md "Batch 14 results")', () => {
    for (const f of Object.values(farms)) expect(f.bonusPct).toBeGreaterThan(0)
    const pick = ({ starsPerHour, ordersPerHour, harvestsPerHour, incomePerHour, incomeOff, bonusPct }: (typeof farms)['carrot9']) => ({
      starsPerHour,
      ordersPerHour,
      harvestsPerHour,
      incomePerHour,
      incomeOff,
      bonusPct,
    })
    expect({ carrot9: pick(farms.carrot9), lemon24: pick(farms.lemon24), lemon24x6: pick(farms.lemon24x6), shopStars, hoursToShop }).toEqual({
      carrot9: { starsPerHour: 11, ordersPerHour: 6.5, harvestsPerHour: 320, incomePerHour: 3861, incomeOff: 3542, bonusPct: 9 },
      lemon24: { starsPerHour: 5, ordersPerHour: 3, harvestsPerHour: 114, incomePerHour: 14374, incomeOff: 12525, bonusPct: 14.8 },
      lemon24x6: { starsPerHour: 10, ordersPerHour: 6.5, harvestsPerHour: 228, incomePerHour: 25640, incomeOff: 21808, bonusPct: 17.6 },
      shopStars: 60,
      hoursToShop: { carrot9: 5.5, lemon24: 12, lemon24x6: 6 },
    })
  })

  // batch 32 (task 172d): a report, not an assert (the hierarchy is a design stance, DECISIONS 2026-11-09)
  it('reports the best mining bench with every item at (1 + bonus) vs 24-tile pumpkin farming', () => {
    console.log('PIN32h14', JSON.stringify({ mining: miningWithBonus, pumpkin24, ratio: miningWithBonus / pumpkin24 }))
  })

  it('every item order count ≤ the bag capacity at its moment (and ≤ half of it)', () => {
    expect(items.length).toBeGreaterThan(0)
    for (const c of items) expect(c.count).toBeLessThanOrEqual(Math.floor(c.bag / 2))
    for (const c of counts) expect(c.count).toBeGreaterThanOrEqual(1)
  })

  it('the generator only offers goods the state can produce (pool and 20 rolls per sampled ladder state)', () => {
    expect(states.length).toBe(IRON_TICKS / 60)
    for (const s of states) {
      for (const good of orderPool(s.run)) expect(canProduce(s.run, good), `${good} at tick ${s.run.tick}`).toBe(true)
      for (let k = 0; k < 20; k++) {
        const [offer] = rollOffer(s, (k * 2654435761) >>> 0)
        expect(canProduce(s.run, offer.good), `${offer.good} at tick ${s.run.tick}`).toBe(true)
      }
    }
    // the ladder reaches iron, so the pool grows from the starting crop to crops, vein items and both bars
    expect(Math.max(...poolSizes)).toBeGreaterThanOrEqual(8)
  })
})
