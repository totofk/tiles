import { describe, expect, it, vi } from 'vitest'
import { buyLicense, digForSeeds } from '../../src/core/actions'
import { type CropId } from '../../src/core/data/crops'
import { type PickaxeTier } from '../../src/core/data/items'
import { TOOL_JOBS, type ToolJob } from '../../src/core/data/tools'
import { buyTool, pressTool, toolTargets } from '../../src/core/tools'
import {
  ACTION_ENERGY_COST,
  OFFLINE_CAP_TICKS,
  barTicks,
  certificateCost,
  cropSeedCost,
  furnaceUpgradeCost,
  furnaceUpgradeMaxLevel,
  cropSellPrice,
  furnaceCost,
  furnaceTrayCap,
  moldPrice,
  pickaxeCraftCost,
  pickaxeRepairCost,
  smeltOre,
  storageCost,
  toolTierCost,
  veinUpgradeCost,
  type Price,
} from '../../src/core/balance'
import { debtDue, repayAll, takeLoan } from '../../src/core/bank'
import { addFuel, loadOre } from '../../src/core/furnace'
import { catchUp } from '../../src/save/serialize'
import { bagCount } from '../../src/core/mining'
import { createInitialState, type GameState } from '../../src/core/state'
import { step } from '../../src/core/step'
import { growthProgress } from '../../src/core/tile'
import { assignWorker, freeWorkers } from '../../src/core/workers'
import {
  ALL_COPPER,
  HOUR_TICKS,
  LICENSE_ORDER,
  PLANT_ORDER,
  SESSION,
  TICKS,
  bestFarmAction,
  mineBench,
  runBot,
  runCropBot,
  withoutMarket,
} from './bot'

vi.mock('../../src/core/balance', async (importOriginal) => (await import('./balanceMock')).balanceMock(importOriginal))

describe.each([
  // pumpkin license by ~250 holds only when the mine license waits for it; see PLAN.md "Batch 3 results"
  {
    name: 'pumpkin-first',
    mineEarly: false,
    // re-pinned batch 35 (was 250): crop re-ladder: potato start, carrot licence 💰25 — the eggplant row bought at 288
    pumpkinBy: 290,
    harvestsPumpkin: true,
    // re-pinned batch 35 (was carrot 100, mine 124, pumpkin 200 / 207 / 215 / 455, mine bought 455, dig 464, minCash 2,
    // cash 394, harvests 31 / mines 19): crop re-ladder: potato start, carrot licence 💰25; "pumpkin" = its old row, eggplant
    batch3: {
      milestones: {
        firstRadishHarvest: 178,
        mineLicenseAffordable: 205,
        pumpkinLicenseAffordable: 287,
        pumpkinLicenseBought: 288,
        firstPumpkinPlanted: 296,
        firstPumpkinHarvest: 536,
        mineLicenseBought: 536,
        firstDig: 545,
      },
      minCash: 0,
      finalCash: 313,
      counters: { harvests: 37, sales: 37, mines: 9, digs: 0 },
    },
  },
  {
    name: 'mine-early',
    mineEarly: true,
    // re-pinned batch 35 (was 350): crop re-ladder: potato start, carrot licence 💰25 — bought at 361
    pumpkinBy: 365,
    // batch 35: the eggplant planted at 402 ripens at 642, after the 600-tick cut-off (was harvested at 594)
    harvestsPumpkin: false,
    // re-pinned batch 35 (was carrot 100, mine 124 / 129, dig 147, pumpkin 336 / 337 / 354 / 594, cash 132, harvests 30,
    // sales 70, mines 43): crop re-ladder: potato start, carrot licence 💰25
    batch3: {
      milestones: {
        firstRadishHarvest: 178,
        mineLicenseAffordable: 205,
        mineLicenseBought: 214,
        firstDig: 220,
        pumpkinLicenseAffordable: 360,
        pumpkinLicenseBought: 361,
        firstPumpkinPlanted: 402,
      },
      minCash: 0,
      // batch 3–5: 116. Batch 6: durability 25 and repair (2 wood) instead of a 3rd craft save 4 wood over 43 mines
      finalCash: 43,
      counters: { harvests: 38, sales: 58, mines: 28, digs: 0 },
    },
  },
])('greedy bot $name (farm first, dig with idle energy), 600 ticks', ({ name, mineEarly, pumpkinBy, harvestsPumpkin, batch3 }) => {
  const summary = runBot(mineEarly)
  console.log(`sim summary ${name}`, JSON.stringify(summary, null, 1))

  it('never borrows, and its batch-3 numbers are unchanged', () => {
    expect(summary.borrowed).toBe(false)
    expect(summary).toMatchObject(batch3)
  })

  it('never goes negative on cash', () => {
    expect(summary.minCash).toBeGreaterThanOrEqual(0)
    expect(summary.finalTick).toBe(TICKS)
  })

  // re-pinned batch 35 (was ~150, measured 124): crop re-ladder: potato start, carrot licence 💰25 — measured 205
  it('can afford the mine license by tick ~210', () => {
    expect(summary.milestones.mineLicenseAffordable).toBeLessThanOrEqual(210)
  })

  it(`buys the pumpkin license by tick ${pumpkinBy} and plants it${harvestsPumpkin ? ' and harvests it' : ''}`, () => {
    expect(summary.milestones.pumpkinLicenseBought).toBeLessThanOrEqual(pumpkinBy)
    expect(summary.milestones.firstPumpkinPlanted).toBeDefined()
    expect(summary.milestones.firstPumpkinHarvest !== undefined).toBe(harvestsPumpkin)
  })

  it('mining earns less cash per energy than farming', () => {
    expect(summary.mine.energy).toBeGreaterThan(0)
    expect(summary.farm.energy).toBeGreaterThan(0)
    expect(summary.miningCashPerEnergy).toBeLessThan(summary.farmingCashPerEnergy)
  })
})

/** the round-2 playtest soft-lock: cash 0 (< potato seed 1; batch 35, was 1 < carrot 2), all 9 tiles tilled, empty bag, no pickaxe */
function softLockState(): GameState {
  const s = createInitialState()
  const tiles = s.run.tiles.map((t) => ({ ...t, status: 'tilled' as const }))
  return { ...s, run: { ...s.run, cash: 0, tiles, mineLicense: true, rack: {}, selectedPickaxe: null, inventory: {} } }
}

// Borrows only when stuck (no loan, no crop in the ground, cash below a potato seed), farms greedily, and
// repays in full once that still leaves a seed's worth of cash, so repaying never soft-locks it again.
function runRecovery() {
  let s = softLockState()
  const startCash = s.run.cash
  const seed = cropSeedCost('potato', s.meta)
  const r: { loans: number; borrowedAt?: number; repaidAt?: number; paid?: number } = { loans: 0 }
  for (let t = 0; t < TICKS; t++) {
    const stuck = !s.run.loan && s.run.cash < seed && s.run.tiles.every((tile) => tile.status !== 'planted')
    if (stuck) {
      const loan = takeLoan(s)
      if (loan.ok) {
        s = loan.state
        r.loans++
        r.borrowedAt ??= s.run.tick
      }
    }
    while (s.run.energy >= ACTION_ENERGY_COST) {
      const next = bestFarmAction(s)
      if (!next) break
      s = next.state
    }
    if (s.run.loan && s.run.cash - debtDue(s.run.loan) >= seed) {
      const due = debtDue(s.run.loan)
      const paid = repayAll(s)
      if (paid.ok) {
        s = paid.state
        r.repaidAt ??= s.run.tick
        r.paid ??= due
      }
    }
    s = step(s, 1)
  }
  return { ...r, startCash, finalCash: s.run.cash, loan: s.run.loan, ticksToRepay: r.repaidAt! - r.borrowedAt! }
}

describe('soft-lock recovery through a loan (round-2 state), 600 ticks', () => {
  const summary = runRecovery()
  console.log('recovery summary', JSON.stringify(summary, null, 1))

  it('is stuck without a loan: no farm action is possible', () => {
    expect(bestFarmAction(softLockState())).toBeNull()
  })

  it('takes one loan, repays it in full, and ends with more cash than it started with', () => {
    expect(summary.loans).toBe(1)
    expect(summary.borrowedAt).toBe(0)
    expect(summary.repaidAt).toBeDefined()
    expect(summary.loan).toBeNull()
    expect(summary.finalCash).toBeGreaterThan(summary.startCash)
  })
})

// Batch 5 (a), "a tool press equals the same manual actions in sequence, at every level", is the tools.test.ts case
// of that name; it is not repeated here.

// Farms greedily; when no farm action is possible it digs for seeds (never borrows, never mines). Dug seeds are
// valued at their buy price on both sides: income for digging, a cost for the farming that plants them.
function runDigBot(start: GameState, ticks: number) {
  let s = start
  // batch 35: dug seeds are potato
  const seed = cropSeedCost('potato', s.meta)
  const farm = { cash: 0, energy: 0 }
  const digging = { seeds: 0, energy: 0 }
  let minCash = s.run.cash
  let firstHarvest: number | undefined
  for (let t = 0; t < ticks; t++) {
    while (s.run.energy >= ACTION_ENERGY_COST) {
      const pouch = s.run.seeds.potato ?? 0
      const next = bestFarmAction(s)
      if (next) {
        const used = pouch - (next.state.run.seeds.potato ?? 0)
        farm.cash += next.state.run.cash - s.run.cash - used * seed
        farm.energy += ACTION_ENERGY_COST
        if (next.kind.startsWith('harvest')) firstHarvest ??= s.run.tick
        s = next.state
      } else {
        const dug = digForSeeds(s)
        if (!dug.ok) break
        digging.seeds += (dug.state.run.seeds.potato ?? 0) - pouch
        digging.energy += ACTION_ENERGY_COST
        s = dug.state
      }
      minCash = Math.min(minCash, s.run.cash)
    }
    s = step(s, 1)
  }
  const fieldValue = s.run.tiles.reduce((sum, t) => sum + (t.cropId ? cropSellPrice(t.cropId, s.meta, 0) * growthProgress(t, s) : 0), 0)
  return {
    startCash: start.run.cash,
    finalCash: s.run.cash,
    minCash,
    firstHarvest,
    loan: s.run.loan,
    counters: s.run.counters,
    digging,
    farm,
    digCashPerEnergy: (digging.seeds * seed) / digging.energy,
    farmingCashPerEnergy: (farm.cash + fieldValue) / farm.energy,
  }
}

describe('soft-lock recovery by digging for seeds alone (round-2 state, no loan), 600 ticks', () => {
  const start = softLockState()
  const summary = runDigBot(start, TICKS)
  console.log('dig recovery summary', JSON.stringify(summary, null, 1))

  it('starts stuck: no farm action is possible, no loan', () => {
    expect(start.run.loan).toBeNull()
    expect(bestFarmAction(start)).toBeNull()
  })

  it('digs its way back to farming and ends with more cash, never borrowing or mining', () => {
    expect(summary.firstHarvest).toBeDefined()
    expect(summary.finalCash).toBeGreaterThan(summary.startCash)
    expect(summary.minCash).toBeGreaterThanOrEqual(0)
    expect(summary.loan).toBeNull()
    expect(summary.counters.mines).toBe(0)
  })

  it('digging earns less cash per energy than farming (seeds valued at their buy price)', () => {
    expect(summary.digging.energy).toBeGreaterThan(0)
    expect(summary.digCashPerEnergy).toBeLessThan(summary.farmingCashPerEnergy)
  })
})

// Greedy farmer that buys every tool level the moment buyTool allows it (unlocked, cash, level k − 1 owned) and uses
// its tools before manual taps: harvest press, water press only while some growing tile is dry, plant press.
// The pumpkin license is bought first, as in the greedy bot. No digging, mining or loans.
function runToolBot(ticks: number) {
  let s = createInitialState()
  let minCash = s.run.cash
  // per job, the tick each level became affordable (index 0 = level 1); the bot buys it that same tick
  const affordable = { water: [], harvest: [], plant: [] } as Record<ToolJob, number[]>
  const dry = (st: GameState) => toolTargets(st, 'water').some((i) => st.run.tiles[i].moisture === 0)
  const buy = () => {
    for (const job of TOOL_JOBS) {
      const r = buyTool(s, job)
      if (!r.ok) continue
      affordable[job].push(s.run.tick)
      s = r.state
    }
  }
  const press = (job: ToolJob, cropId: CropId) => {
    if (s.run.tools[job] < 1) return false
    const r = pressTool(s, job, cropId)
    if (!r.ok || r.done === 0) return false
    s = r.state
    return true
  }
  for (let t = 0; t < ticks; t++) {
    if (!s.run.licenses.includes('eggplant')) {
      const r = buyLicense(s, 'eggplant')
      if (r.ok) s = r.state
    }
    buy()
    while (s.run.energy >= ACTION_ENERGY_COST) {
      const crop: CropId = s.run.licenses.includes('eggplant') && s.run.cash >= cropSeedCost('eggplant', s.meta) ? 'eggplant' : 'potato'
      const acted =
        press('harvest', crop) ||
        (dry(s) && press('water', crop)) ||
        press('plant', crop) ||
        (() => {
          const next = bestFarmAction(s)
          if (next) s = next.state
          return next !== null
        })()
      if (!acted) break
      minCash = Math.min(minCash, s.run.cash)
      buy()
    }
    s = step(s, 1)
  }
  return { affordable, minCash, finalCash: s.run.cash, finalTick: s.run.tick, owned: s.run.tools, counters: s.run.counters }
}

describe('tool-buying bot, 1200 ticks', () => {
  const summary = runToolBot(1200)
  console.log('tool bot summary', JSON.stringify(summary, null, 1))

  it('never goes negative on cash', () => {
    expect(summary.minCash).toBeGreaterThanOrEqual(0)
    expect(summary.finalTick).toBe(1200)
  })

  // re-pinned batch 35 (was ~300): crop re-ladder: potato start, carrot licence 💰25 — the last level-1 tool at 315
  it('can afford every level-1 tool within ~330 ticks (about 5.5 minutes)', () => {
    for (const job of TOOL_JOBS) expect(summary.affordable[job][0]).toBeLessThanOrEqual(330)
  })

  it('pins the Batch 5 results milestones (PLAN.md)', () => {
    // harvest and plant level 3 need 120 harvests / plants, not reached in 1200 ticks
    // re-pinned batch 35 (was water [120, 655, 984], harvest [233, 886], plant [200, 683]): crop re-ladder: potato
    // start, carrot licence 💰25 — potato's 60-tick grow plants (and so unlocks the dibber) sooner
    expect(summary.affordable).toEqual({ water: [195, 846, 1140], harvest: [315, 999], plant: [108, 891] })
  })
})

/** dig for seeds, energy refilled every time; dug seeds valued at their buy price (batch 5 definition) */
function digBench(actions = 5000) {
  let s = createInitialState()
  for (let i = 0; i < actions; i++) {
    const r = digForSeeds({ ...s, run: { ...s.run, energy: ACTION_ENERGY_COST } })
    if (!r.ok) throw new Error(r.error)
    s = r.state
  }
  return ((s.run.seeds.potato ?? 0) * cropSeedCost('potato', s.meta)) / actions
}

describe('batch 6: two-tier cash/energy hierarchy', () => {
  const farming = Object.fromEntries((['radish', 'corn', 'eggplant', 'pumpkin'] as const).map((c) => [c, runCropBot(c)]))
  const mining = {
    dig: digBench(),
    hand: mineBench({ pickaxe: false }).cashPerEnergy,
    pickaxeLv0: mineBench({ pickaxe: true }).cashPerEnergy,
    pickaxeLv10: mineBench({ pickaxe: true, xp: 400, mastered: true }).cashPerEnergy,
    veinLv1Lv10: mineBench({ pickaxe: true, xp: 400, mastered: true, vein: 1 }).cashPerEnergy,
  }
  console.log('batch 6 hierarchy', JSON.stringify({ farming, mining }, null, 1))
  const carrot = farming.radish.cashPerEnergy
  const pumpkin = farming.eggplant.cashPerEnergy

  it('(a) dig < hand mining < pickaxe Lv0 < 0.9 × carrot farming', () => {
    expect(mining.dig).toBeLessThan(mining.hand)
    expect(mining.hand).toBeLessThan(mining.pickaxeLv0)
    expect(mining.pickaxeLv0).toBeLessThan(0.9 * carrot)
  })

  it('(b) pickaxe Lv10 and vein Lv1 + Lv10, repairs included, < 0.9 × pumpkin farming', () => {
    expect(mining.pickaxeLv10).toBeLessThan(0.9 * pumpkin)
    expect(mining.veinLv1Lv10).toBeLessThan(0.9 * pumpkin)
  })

  it('(c) farming cash/energy: carrot < corn < eggplant < pumpkin', () => {
    const order = [farming.radish, farming.corn, farming.eggplant, farming.pumpkin].map((f) => f.cashPerEnergy)
    expect([...order].sort((x, y) => x - y)).toEqual(order)
    expect(new Set(order).size).toBe(4)
  })
})

describe.each([
  { name: 'pumpkin-first', mineEarly: false },
  { name: 'mine-early', mineEarly: true },
])('batch 6: four-crop session bot $name, 1200 ticks', ({ name, mineEarly }) => {
  const summary = runBot(mineEarly, { ticks: SESSION, licenses: LICENSE_ORDER, crops: PLANT_ORDER })
  console.log(`session summary ${name}`, JSON.stringify(summary, null, 1))

  it('(c) can afford each license in order within the session', () => {
    const ticks = LICENSE_ORDER.map((id) => summary.licenseAffordable[id])
    for (const t of ticks) expect(t).toBeLessThanOrEqual(SESSION)
    expect([...ticks].sort((x, y) => x! - y!)).toEqual(ticks)
  })

  it('(d) storage level 1 becomes affordable within ~600 ticks (checked, not bought)', () => {
    expect(summary.storageAffordable).toBeLessThanOrEqual(600)
  })

  it('(e) nothing goes negative and it never borrows', () => {
    expect(summary.lowest).toBeGreaterThanOrEqual(0)
    expect(summary.borrowed).toBe(false)
    expect(summary.finalTick).toBe(SESSION)
  })
})

describe('batch 6.1: stone-keeping mine-early bot buys storage Lv1, then vein Lv1', () => {
  // mine-early as pinned above, but it keeps its stone (stops mining when storage is full) until it buys
  // storage level 1, then vein level 1
  const summary = runBot(true, { saveForStorage: true, ticks: 1200 })
  console.log('storage summary', JSON.stringify(summary, null, 1))

  // re-pinned batch 35 (was ~600): crop re-ladder: potato start, carrot licence 💰25 — storage Lv1 bought at 642
  it('(d) storage level 1 is bought within ~660 ticks, vein level 1 after it within the session', () => {
    expect(summary.storageBought).toBeLessThanOrEqual(660)
    expect(summary.veinBought).toBeGreaterThan(summary.storageBought!)
    expect(summary.veinBought).toBeLessThanOrEqual(1200)
    expect(summary.lowest).toBeGreaterThanOrEqual(0)
  })
})

describe('batch 7: copper pickaxe cash/energy (repairs at input value) < 0.9 × pumpkin farming', () => {
  const pumpkin = runCropBot('eggplant').cashPerEnergy
  const bench = (tier: PickaxeTier, lv10: boolean, vein: number) =>
    mineBench({ pickaxe: true, tier, vein, xp: lv10 ? 400 * (tier === 'copper' ? 2 : 1) : 0, mastered: lv10 }).cashPerEnergy
  const mining = {
    woodLv10Vein1: bench('wooden', true, 1),
    woodLv10Vein2: bench('wooden', true, 2),
    copperLv0Vein1: bench('copper', false, 1),
    copperLv0Vein2: bench('copper', false, 2),
    copperLv10Vein1: bench('copper', true, 1),
    copperLv10Vein2: bench('copper', true, 2),
  }
  console.log('batch 7 mining', JSON.stringify({ pumpkin, mining }, null, 1))

  it('every pickaxe on vein Lv1 and Lv2 stays below 0.9 × pumpkin', () => {
    for (const v of Object.values(mining)) expect(v).toBeLessThan(0.9 * pumpkin)
  })
})

describe('batch 7: ladder bot (four crops, mine-early, keeps what the next goal needs), 3600 ticks', () => {
  const summary = runBot(true, { ticks: HOUR_TICKS, licenses: LICENSE_ORDER, crops: PLANT_ORDER, ladder: true })
  console.log('ladder summary', JSON.stringify(summary, null, 1))
  const t = summary.ladderTicks

  it('reaches vein Lv1 → furnace → storage Lv2 → vein Lv2 → first bar → copper pickaxe, in order, within the hour', () => {
    const order = [t.veinLv1, t.furnace, t.storageLv2, t.veinLv2, t.firstBar, t.copperPickaxe]
    for (const tick of order) expect(tick).toBeLessThanOrEqual(HOUR_TICKS)
    expect([...order].sort((a, b) => a! - b!)).toEqual(order)
  })

  it('nothing goes negative and it never borrows', () => {
    expect(summary.lowest).toBeGreaterThanOrEqual(0)
    expect(summary.borrowed).toBe(false)
    expect(summary.finalTick).toBe(HOUR_TICKS)
  })

  // pinned from the batch-7 code before copper farm tools: a run with every toolTier at 0 must replay exactly,
  // PRNG position included. Cash re-pinned in batch 12 (market prices) and batch 16 (depth 60)
  // re-pinned batch 32 (was firstBar 1776, copperPickaxe 2172, cash 5914, rng 1328891991, sales 386): hit carry-over —
  // a wooden pickaxe's spare hit goes into the next rock, so the same 447 presses break more rocks
  // re-pinned batch 35 (was 477 / 684 / 936 / 1110 / 1350 / 1773 / 2178, rng 1761327770):
  // crop re-ladder: potato start, carrot licence 💰25
  it('pins the Batch 7 results (ticks, final cash, counters, PRNG state)', () => {
    expect(t).toEqual({ storageLv1: 486, veinLv1: 786, furnace: 1065, storageLv2: 1230, veinLv2: 1494, firstBar: 1902, copperPickaxe: 2346 })
    expect(summary.finalCash).toBe(5527)
    expect(summary.rngState).toBe(881303612)
    // bars (batch 9) = the 5 bars the copper pickaxe took, collected from the tray
    // re-pinned batch 35 (was harvests 107, sales 467, mines 447, waters 525, plants 116): crop re-ladder
    expect(summary.counters).toEqual({ harvests: 116, sales: 436, mines: 433, digs: 0, waters: 526, plants: 125, bars: 5, orders: 0, contractsByHand: 0 })
  })
})

describe('batch 7: every multi-item price fits the storage the player has when it becomes buyable', () => {
  const meta = createInitialState().meta
  const items = (p: Price) => Object.entries(p).reduce((sum, [k, n]) => (k === 'cash' ? sum : sum + n), 0)
  // capacity when buyable: furnace right after vein Lv1 (storage Lv1 = 30); vein Lv2 and the copper pickaxe after
  // storage Lv2 (40)
  it.each<[string, Price, number]>([
    ['furnace', furnaceCost(meta), 30],
    ['vein Lv2', veinUpgradeCost(1, meta)!, 40],
    ['copper pickaxe', pickaxeCraftCost('copper', meta), 40],
    // batch 7.1: copper farm tools come after the copper pickaxe (storage Lv2)
    ['copper farm tool', toolTierCost(1, meta), 40],
    // batch 9: the loaders' certificates and every furnace upgrade level, all after the copper pickaxe (storage Lv2)
    ['ore loader certificate', certificateCost('ore', meta), 40],
    ['fuel loader certificate', certificateCost('fuel', meta), 40],
    // batch 10: the plant certificate (copper bars, so after the copper pickaxe too)
    ['plant certificate', certificateCost('plant', meta), 40],
    ...(['fireCap', 'batch', 'smart'] as const).flatMap((id) =>
      Array.from({ length: Math.min(2, furnaceUpgradeMaxLevel(id)) }, (_, l): [string, Price, number] => [`${id} Lv${l + 1}`, furnaceUpgradeCost(id, l, meta)!, 40]),
    ),
    // batch 33: the copper-bar mold rows come with vein Lv3 (storage Lv3), the iron/gold-bar rows with vein Lv4 (storage Lv4)
    ['tray Lv1', furnaceUpgradeCost('tray', 0, meta)!, 50],
    ['slot Lv1', furnaceUpgradeCost('slot', 0, meta)!, 50],
    ['iron mold', moldPrice('ironOre', meta), 50],
    ['collectAll', furnaceUpgradeCost('collectAll', 0, meta)!, 50],
    ...(['fireCap', 'batch', 'speed', 'tray', 'slot'] as const).flatMap((id) =>
      Array.from({ length: furnaceUpgradeMaxLevel(id) }, (_, l): [string, Price, number] => [`${id} Lv${l + 1}`, furnaceUpgradeCost(id, l, meta)!, 60]).filter(
        ([, p]) => (p.ironBar ?? 0) + (p.goldBar ?? 0) > 0,
      ),
    ),
    ['gold mold', moldPrice('goldOre', meta), 60],
    // batch 11: vein Lv3 (40 stone + 5 copper bars) comes after storage Lv3 (50), as each vein level after its storage level
    ['vein Lv3', veinUpgradeCost(2, meta)!, 50],
    // storage Lv3 itself is bought with storage Lv2 (40); the iron prices come after vein Lv3 (storage Lv3)
    ['storage Lv3', { ...storageCost(2, meta) }, 40],
    ['iron pickaxe', pickaxeCraftCost('iron', meta), 50],
    ['iron pickaxe repair', pickaxeRepairCost('iron', meta), 50],
    ['mine certificate', certificateCost('mine', meta), 50],
    // batch 15: the iron farm tool (🥈4) comes after storage Lv3 too
    ['iron farm tool', toolTierCost(2, meta), 50],
    // batch 16: vein Lv4 (45 stone + 8 iron bars) and the gold prices all come after storage Lv4 (60)
    ['vein Lv4', veinUpgradeCost(3, meta)!, 60],
    ['gold pickaxe', pickaxeCraftCost('gold', meta), 60],
    ['gold pickaxe repair', pickaxeRepairCost('gold', meta), 60],
    ['gold farm tool', toolTierCost(3, meta), 60],
  ])('%s', (_, price, capacity) => {
    expect(items(price)).toBeLessThanOrEqual(capacity)
  })
})

describe('batch 7.1: copper farm tools vs none, one crop on 9 tiles, 1200 ticks', () => {
  const farming = Object.fromEntries(
    (['radish', 'eggplant'] as const).map((c) => [c, { none: runCropBot(c), copper: runCropBot(c, SESSION, ALL_COPPER) }]),
  )
  console.log('batch 7.1 farming', JSON.stringify(farming, null, 1))

  it.each(['radish', 'eggplant'])('%s: fewer waterings per harvest and more cash per energy with all three copper tools', (crop) => {
    const { none, copper } = farming[crop]
    expect(copper.watersPerHarvest).toBeLessThan(none.watersPerHarvest)
    expect(copper.cashPerEnergy).toBeGreaterThan(none.cashPerEnergy)
  })

  it('mining stays below farming: the batch-7 copper pickaxe benches < 0.9 × pumpkin without copper tools', () => {
    const pumpkin = farming.eggplant.none.cashPerEnergy
    for (const vein of [1, 2])
      for (const lv10 of [false, true])
        expect(mineBench({ pickaxe: true, tier: 'copper', vein, xp: lv10 ? 800 : 0, mastered: lv10 }).cashPerEnergy).toBeLessThan(0.9 * pumpkin)
  })
})

describe('batch 7.1: ladder bot continues to the three copper farm tools', () => {
  // the batch-7 ladder bot, then water → harvest → plant copper tiers (each with its tool Lv1 if missing)
  const summary = runBot(true, { ticks: HOUR_TICKS, licenses: LICENSE_ORDER, crops: PLANT_ORDER, ladder: true, copperTools: true })
  console.log('copper ladder', JSON.stringify({ ...summary.ladderTicks, finalCash: summary.finalCash, counters: summary.counters }, null, 1))
  const t = summary.ladderTicks

  it('the batch-7 steps are unchanged (copper tools only come after the copper pickaxe)', () => {
    const { firstBar, storageLv1, veinLv1, furnace, storageLv2, veinLv2, copperPickaxe } = t
    // re-pinned batch 35 (the batch-7 pin above): crop re-ladder: potato start, carrot licence 💰25
    expect({ storageLv1, veinLv1, furnace, storageLv2, veinLv2, firstBar, copperPickaxe }).toEqual({
      storageLv1: 486, veinLv1: 786, furnace: 1065, storageLv2: 1230, veinLv2: 1494, firstBar: 1902, copperPickaxe: 2346,
    })
  })

  // re-pinned batch 32 (was [2172, 2598, 2835, 3075], cash 6043): hit carry-over, then the copper sickle's seed roll
  it('buys the three copper tools in order after the copper pickaxe, within the hour (pinned) (final cash re-pinned batch 16: depth 60)', () => {
    const order = [t.copperPickaxe, t['copper:water'], t['copper:harvest'], t['copper:plant']]
    // re-pinned batch 35 (was [2178, 2487, 2760, 3027]): crop re-ladder: potato start, carrot licence 💰25
    expect(order).toEqual([2346, 2622, 2859, 3093])
    expect(summary.finalCash).toBe(5666)
  })

  it('nothing goes negative over 3600 ticks and it never borrows', () => {
    expect(summary.lowest).toBeGreaterThanOrEqual(0)
    expect(summary.borrowed).toBe(false)
    expect(summary.finalTick).toBe(HOUR_TICKS)
  })
})

// ---- Batch 8: workers + auto-smelt ----

describe('batch 8: workers vs manual, one crop on 9 tiles, 1200 ticks (runCropBot, net cash per minute)', () => {
  const W = { water: 1, harvest: 1 }
  const farming = Object.fromEntries(
    (['radish', 'eggplant'] as const).map((c) => [
      c,
      {
        manual: runCropBot(c),
        workers: runCropBot(c, SESSION, undefined, W),
        copperCan: { manual: runCropBot(c, SESSION, { ...ALL_COPPER, harvest: 0, plant: 0 }), workers: runCropBot(c, SESSION, { ...ALL_COPPER, harvest: 0, plant: 0 }, W) },
      },
    ]),
  )
  const rates = Object.fromEntries(
    Object.entries(farming).map(([c, f]) => [
      c,
      {
        manual: f.manual.perMin,
        workers: f.workers.perMin,
        share: f.workers.perMin / f.manual.perMin,
        wages: f.workers.wages,
        copperCan: { manual: f.copperCan.manual.perMin, workers: f.copperCan.workers.perMin, share: f.copperCan.workers.perMin / f.copperCan.manual.perMin, wages: f.copperCan.workers.wages },
      },
    ]),
  )
  console.log('batch 8 cash/min manual vs workers', JSON.stringify(rates, null, 1))

  it('pumpkin: water + harvest workers with the player only planting net ≥ 80 % of the manual rate (with a copper can too)', () => {
    expect(rates.eggplant.share).toBeGreaterThanOrEqual(0.8)
    expect(rates.eggplant.copperCan.share).toBeGreaterThanOrEqual(0.8)
  })

  it('the player spends energy only on tilling and planting when workers water and harvest', () => {
    const { manual, workers } = farming.eggplant
    expect(workers.energy).toBeLessThan(manual.energy / 2)
    expect(workers.wages).toBeGreaterThan(0)
  })
})

describe('batch 8: ladder bot with workers (certificates and hires when affordable, water first), 3600 ticks', () => {
  let end = createInitialState()
  // batch 16: market off — at depth 60 the market-on run of this pre-hand-picked era starves the bot of cash
  // (workers wait at cash 0 while crops rot); off, it replays the pre-market pins
  const summary = withoutMarket(() =>
    runBot(true, {
      ticks: HOUR_TICKS,
      licenses: LICENSE_ORDER,
      crops: PLANT_ORDER,
      ladder: true,
      copperTools: true,
      workers: true,
      onEnd: (s) => (end = s),
    }),
  )
  const { workerTicks, ladderTicks, finalCash, wagesPaid, farmingCashPerEnergy, miningCashPerEnergy, counters } = summary
  console.log('batch 8 workers ladder', JSON.stringify({ workerTicks, ladderTicks, finalCash, wagesPaid, farmingCashPerEnergy, miningCashPerEnergy, counters, workers: end.run.workers }, null, 1))

  // re-pinned batch 35 (was certificate 628 → hire 643): crop re-ladder: potato start, carrot licence 💰25 — cash now
  // climbs in smaller steps, so this pre-batch-13 bot's 💰80 hire is affordable (517) before the 💰100 certificate (733)
  it('reaches the first hire, the first certificate and a pool of 3 within the hour, in that order', () => {
    const order = [workerTicks.firstHire, workerTicks.firstCertificate, workerTicks.pool3]
    for (const tick of order) expect(tick).toBeLessThanOrEqual(HOUR_TICKS)
    expect([...order].sort((a, b) => a! - b!)).toEqual(order)
  })

  it('pins the Batch 8 results (worker ticks, final cash, wages) (re-pinned batch 16: market off)', () => {
    // re-pinned batch 35 (was 628 / 628 / 1141 / 643 / 1024): crop re-ladder: potato start, carrot licence 💰25
    expect(workerTicks).toEqual({ firstCertificate: 733, waterCertificate: 733, harvestCertificate: 1027, firstHire: 517, pool3: 1396 })
    // re-pinned batch 28.1 (was [3452, 379]): the blunt copper pickaxe collects its tray bars and repairs at once
    // re-pinned batch 32 (was [3618, 379]): hit carry-over, then the sickle's seed roll
    expect([finalCash, wagesPaid]).toEqual([2692, 370])
  })

  it('nothing goes negative and it never borrows', () => {
    expect(summary.lowest).toBeGreaterThanOrEqual(0)
    expect(summary.borrowed).toBe(false)
    expect(summary.finalTick).toBe(HOUR_TICKS)
  })

  // batch 32 (task 172d): a report, not an assert — the mining < farming hierarchy is a design stance (DECISIONS
  // 2026-11-09), only correctness guards stay hard
  it('reports mining vs farming (cash per player energy, worker income net of wages counted as farming)', () => {
    console.log('PIN32h8', JSON.stringify({ mining: miningCashPerEnergy, farming: farmingCashPerEnergy, ratio: miningCashPerEnergy / farmingCashPerEnergy }))
  })

  it('cash 0 with every worker assigned: they idle, nothing is charged, cash stays 0', () => {
    let s: GameState = { ...end, run: { ...end.run, cash: 0 } }
    while (freeWorkers(s.run) > 0) {
      const r = assignWorker(s, 'water', 1)
      if (!r.ok) break
      s = r.state
    }
    expect(freeWorkers(s.run)).toBe(0)
    for (let t = 0; t < 600; t++) {
      s = step(s, 1)
      expect(s.run.cash).toBe(0)
    }
    expect(s.run.lifetime.wagesPaid).toBe(end.run.lifetime.wagesPaid)
  })

  // batch 9: auto-smelt is gone; the player loads ore and fills the fire with coal before leaving
  it('8 h offline with workers and a loaded furnace: more cash, and every bar the loaded ore, fire and tray allow', () => {
    const loaded = loadOre(end, 'copperOre')
    const ored = loaded.ok ? loaded.state : end
    const fuelled = addFuel(ored, 'coal')
    const before = fuelled.ok ? fuelled.state : ored
    const { inventory, furnace } = before.run
    const mold = furnace.molds.copperOre!
    const ore = mold.ore
    const coal = inventory.coal ?? 0
    const bars = (s: GameState) => (s.run.inventory.copperBar ?? 0) + s.run.furnace.molds.copperOre!.ready
    const allowed =
      bars(before) + Math.min(Math.floor(ore / smeltOre()), Math.floor(furnace.fire / barTicks()), furnaceTrayCap(furnace.levels.tray) - mold.ready)
    const t0 = performance.now()
    const after = withoutMarket(() => catchUp(before, OFFLINE_CAP_TICKS * 1000))
    const runtimeMs = performance.now() - t0
    const offline = {
      cash: [before.run.cash, after.run.cash],
      bars: [bars(before), bars(after)],
      allowed,
      stock: { ore, coal, fire: furnace.fire, ready: mold.ready, storage: `${bagCount(before.run)}/${before.run.bagCapacity}` },
      wagesPaid: after.run.lifetime.wagesPaid - before.run.lifetime.wagesPaid,
      runtimeMs: Math.round(runtimeMs),
    }
    console.log('batch 8 offline 8 h', JSON.stringify(offline))
    expect(after.run.cash).toBeGreaterThan(before.run.cash)
    expect(bars(after)).toBeGreaterThanOrEqual(allowed)
    expect(runtimeMs).toBeLessThan(3000)
  })
})
