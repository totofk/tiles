import { describe, expect, it } from 'vitest'
import { buyLicense, digForSeeds, harvest, plant, till, water, type ActionResult } from '../src/core/actions'
import type { CropId } from '../src/core/data/crops'
import { TOOL_JOBS, type ToolJob } from '../src/core/data/tools'
import { buyTool, pressTool, toolTargets } from '../src/core/tools'
import {
  ACTION_ENERGY_COST,
  cropGrowTicks,
  cropSeedCost,
  cropSellPrice,
  isSellable,
  itemSellPrice,
  licenseCost,
  mineLicenseCost,
  pickaxeCraftCost,
  pickaxeRepairCost,
} from '../src/core/balance'
import { debtDue, repayAll, takeLoan } from '../src/core/bank'
import { ITEM_IDS } from '../src/core/data/items'
import { bagCount, buyMineLicense, buyStorage, buyWood, craftPickaxe, dig, repairPickaxe, sellItem, upgradeVein } from '../src/core/mining'
import { createInitialState, type GameState } from '../src/core/state'
import { step } from '../src/core/step'
import { growthProgress } from '../src/core/tile'

const TICKS = 600

type Milestones = {
  firstRadishHarvest?: number
  pumpkinLicenseAffordable?: number
  pumpkinLicenseBought?: number
  firstPumpkinPlanted?: number
  firstPumpkinHarvest?: number
  mineLicenseAffordable?: number
  mineLicenseBought?: number
  firstDig?: number
}

// Greedy farmer: one best farm action at a time, by priority, across all tiles (lowest index first).
// "Dry" = moisture exactly 0 (step snaps float residue to 0); mature crops are never watered.
// `crops` = what to plant, best first (each tried on every tile before the next).
function bestFarmAction(s: GameState, crops: CropId[] = ['pumpkin', 'radish']): { state: GameState; kind: string } | null {
  const tiles = s.run.tiles
  const growing = (i: number) => {
    const { cropId, growth } = tiles[i]
    return cropId !== undefined && growth < cropGrowTicks(cropId, s.meta, s.run.upgrades.fertilizer)
  }
  const tries: Array<[string, (i: number) => ActionResult | null]> = [
    ['harvest', (i) => harvest(s, i)],
    ['water', (i) => (tiles[i].moisture === 0 && growing(i) ? water(s, i) : null)],
    ...crops.map((crop): [string, (i: number) => ActionResult] => [`plant:${crop}`, (i) => plant(s, i, crop)]),
    ['till', (i) => till(s, i)],
  ]
  for (const [kind, act] of tries) {
    for (let i = 0; i < tiles.length; i++) {
      const result = act(i)
      if (result?.ok) return { state: result.state, kind: `${kind}:${tiles[i].cropId ?? ''}` }
    }
  }
  return null
}

/** the smallest number in the run a bug could push below 0: cash, energy, storage, pouch, durability */
const lowestValue = ({ run }: GameState) =>
  Math.min(run.cash, run.energy, ...Object.values(run.inventory), ...Object.values(run.seeds), run.pickaxe?.durability ?? 0)

/** mineEarly: buy the mine license as soon as it is affordable while energy is idle;
 *  otherwise only once the pumpkin license is owned (the main crop is never delayed).
 *  licenses: bought in this order, each as soon as it is affordable; crops: what to plant, best first. */
function runBot(
  mineEarly: boolean,
  {
    ticks = TICKS,
    licenses = ['pumpkin'],
    crops = ['pumpkin', 'radish'],
    saveForStorage = false,
  }: { ticks?: number; licenses?: CropId[]; crops?: CropId[]; saveForStorage?: boolean } = {},
) {
  let s = createInitialState()
  const m: Milestones = {}
  let minCash = s.run.cash
  let lowest = lowestValue(s)
  // the tick each license became affordable while it was the next one to buy, and the tick it was bought
  const licenseAffordable: Partial<Record<CropId, number>> = {}
  const licenseBought: Partial<Record<CropId, number>> = {}
  let storageAffordable: number | undefined
  let storageBought: number | undefined
  let veinBought: number | undefined
  // net cash and energy per activity; licenses are one-off capital and excluded from both
  const farm = { cash: 0, energy: 0 }
  const mine = { cash: 0, energy: 0 }
  const mineLicense = mineLicenseCost(s.meta)
  const nextLicense = () => licenses.find((id) => !s.run.licenses.includes(id))
  const seen = () => {
    minCash = Math.min(minCash, s.run.cash)
    lowest = Math.min(lowest, lowestValue(s))
  }
  const track = (next: GameState, into: { cash: number; energy: number }, energy = 0) => {
    into.cash += next.run.cash - s.run.cash
    into.energy += energy
    s = next
    seen()
  }
  const tryAct = (r: ActionResult, into: { cash: number; energy: number } | null, energy = 0) => {
    if (!r.ok) return false
    if (into) track(r.state, into, energy)
    else {
      s = r.state
      seen()
    }
    return true
  }

  // Mining fills idle energy only. Order: license → sell stone when the bag is full
  // → wood + pickaxe when it has none, wood + repair when blunt (never mines by hand) → mine.
  const mineOnce = (tick: number): boolean => {
    if (!s.run.mineLicense) {
      if (!mineEarly && !s.run.licenses.includes('pumpkin')) return false
      if (!tryAct(buyMineLicense(s), null)) return false
      m.mineLicenseBought ??= tick
    }
    // the pinned runs only check storage; saveForStorage keeps its stone (and stops mining when storage is full)
    // until it buys storage level 1, then vein level 1
    if (buyStorage(s).ok) storageAffordable ??= tick
    if (saveForStorage && s.run.storageLevel === 0) {
      if (tryAct(buyStorage(s), null)) storageBought = tick
      else if (bagCount(s.run) >= s.run.bagCapacity) return false
    } else if (saveForStorage && s.run.vein.level === 0) {
      if (tryAct(upgradeVein(s), null)) veinBought = tick
      else if (bagCount(s.run) >= s.run.bagCapacity) return false
    }
    if (bagCount(s.run) >= s.run.bagCapacity) tryAct(sellItem(s, 'stone', s.run.inventory.stone ?? 0), mine)
    if (!s.run.pickaxe) {
      const need = pickaxeCraftCost('wooden', s.meta).wood! - (s.run.inventory.wood ?? 0)
      if (need > 0 && !tryAct(buyWood(s, need), mine)) return false
      if (!tryAct(craftPickaxe(s), mine)) return false
    } else if (s.run.pickaxe.durability === 0) {
      const need = pickaxeRepairCost('wooden', s.meta).wood! - (s.run.inventory.wood ?? 0)
      if (need > 0 && !tryAct(buyWood(s, need), mine)) return false
      if (!tryAct(repairPickaxe(s), mine)) return false
    }
    if (!tryAct(dig(s), mine, ACTION_ENERGY_COST)) return false
    m.firstDig ??= tick
    return true
  }

  let borrowed = false
  for (let t = 0; t < ticks; t++) {
    borrowed ||= s.run.loan !== null
    const tick = s.run.tick
    const milestones = () => {
      const want = nextLicense()
      if (want && s.run.cash >= licenseCost(want, s.meta)) licenseAffordable[want] ??= tick
      if (s.run.cash >= mineLicense) m.mineLicenseAffordable ??= tick
      if (buyStorage(s).ok) storageAffordable ??= tick
    }
    milestones()
    const want = nextLicense()
    if (want && tryAct(buyLicense(s, want), null)) licenseBought[want] ??= tick
    while (s.run.energy >= ACTION_ENERGY_COST) {
      const next = bestFarmAction(s, crops)
      if (next) {
        track(next.state, farm, ACTION_ENERGY_COST)
        if (next.kind.startsWith('harvest') && next.kind.endsWith(':radish')) m.firstRadishHarvest ??= tick
        if (next.kind.startsWith('harvest') && next.kind.endsWith(':pumpkin')) m.firstPumpkinHarvest ??= tick
        if (next.kind.startsWith('plant:pumpkin')) m.firstPumpkinPlanted ??= tick
        milestones()
      } else if (!mineOnce(tick)) break
    }
    milestones()
    s = step(s, 1)
    seen()
  }
  // unfinished work at the cut-off counts for both activities: bag items at their sell price,
  // standing crops at sell price × growth progress (their seeds are already charged to farming)
  const bagValue = ITEM_IDS.filter(isSellable).reduce(
    (sum, id) => sum + (s.run.inventory[id] ?? 0) * itemSellPrice(id, s.meta, s.run.upgrades.sellPrice),
    0,
  )
  const fieldValue = s.run.tiles.reduce(
    (sum, t) => sum + (t.cropId ? cropSellPrice(t.cropId, s.meta, s.run.upgrades.sellPrice) * growthProgress(t, s) : 0),
    0,
  )
  borrowed ||= s.run.loan !== null
  return {
    borrowed,
    milestones: { ...m, pumpkinLicenseAffordable: licenseAffordable.pumpkin, pumpkinLicenseBought: licenseBought.pumpkin },
    licenseAffordable,
    licenseBought,
    storageAffordable,
    storageBought,
    veinBought,
    lowest,
    masteryXp: s.run.mastery.wooden ?? 0,
    minCash,
    finalCash: s.run.cash,
    finalTick: s.run.tick,
    counters: s.run.counters,
    bagValue,
    fieldValue,
    farm,
    mine,
    farmingCashPerEnergy: (farm.cash + fieldValue) / farm.energy,
    miningCashPerEnergy: (mine.cash + bagValue) / mine.energy,
  }
}

describe.each([
  // pumpkin license by ~250 holds only when the mine license waits for it; see PLAN.md "Batch 3 results"
  {
    name: 'pumpkin-first',
    mineEarly: false,
    pumpkinBy: 250,
    batch3: {
      milestones: {
        firstRadishHarvest: 100,
        mineLicenseAffordable: 124,
        pumpkinLicenseAffordable: 200,
        pumpkinLicenseBought: 207,
        firstPumpkinPlanted: 215,
        firstPumpkinHarvest: 455,
        mineLicenseBought: 455,
        firstDig: 464,
      },
      minCash: 2,
      finalCash: 394,
      counters: { harvests: 31, sales: 31, mines: 19, digs: 0 },
    },
  },
  {
    name: 'mine-early',
    mineEarly: true,
    pumpkinBy: 350,
    batch3: {
      milestones: {
        firstRadishHarvest: 100,
        mineLicenseAffordable: 124,
        mineLicenseBought: 129,
        firstDig: 147,
        pumpkinLicenseAffordable: 336,
        pumpkinLicenseBought: 337,
        firstPumpkinPlanted: 354,
        firstPumpkinHarvest: 594,
      },
      minCash: 0,
      // batch 3–5: 116. Batch 6: durability 25 and repair (2 wood) instead of a 3rd craft save 4 wood over 43 mines
      finalCash: 132,
      counters: { harvests: 30, sales: 70, mines: 43, digs: 0 },
    },
  },
])('greedy bot $name (farm first, dig with idle energy), 600 ticks', ({ name, mineEarly, pumpkinBy, batch3 }) => {
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

  it('can afford the mine license by tick ~150', () => {
    expect(summary.milestones.mineLicenseAffordable).toBeLessThanOrEqual(150)
  })

  it(`buys the pumpkin license by tick ${pumpkinBy} and harvests a pumpkin`, () => {
    expect(summary.milestones.pumpkinLicenseBought).toBeLessThanOrEqual(pumpkinBy)
    expect(summary.milestones.firstPumpkinHarvest).toBeDefined()
  })

  it('mining earns less cash per energy than farming', () => {
    expect(summary.mine.energy).toBeGreaterThan(0)
    expect(summary.farm.energy).toBeGreaterThan(0)
    expect(summary.miningCashPerEnergy).toBeLessThan(summary.farmingCashPerEnergy)
  })
})

/** the round-2 playtest soft-lock: cash 1 (< radish seed 2), all 9 tiles tilled, empty bag, no pickaxe */
function softLockState(): GameState {
  const s = createInitialState()
  const tiles = s.run.tiles.map((t) => ({ ...t, status: 'tilled' as const }))
  return { ...s, run: { ...s.run, cash: 1, tiles, mineLicense: true, pickaxe: null, inventory: {} } }
}

// Borrows only when stuck (no loan, no crop in the ground, cash below a radish seed), farms greedily, and
// repays in full once that still leaves a seed's worth of cash, so repaying never soft-locks it again.
function runRecovery() {
  let s = softLockState()
  const startCash = s.run.cash
  const seed = cropSeedCost('radish', s.meta)
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
  const seed = cropSeedCost('radish', s.meta)
  const farm = { cash: 0, energy: 0 }
  const digging = { seeds: 0, energy: 0 }
  let minCash = s.run.cash
  let firstHarvest: number | undefined
  for (let t = 0; t < ticks; t++) {
    while (s.run.energy >= ACTION_ENERGY_COST) {
      const pouch = s.run.seeds.radish ?? 0
      const next = bestFarmAction(s)
      if (next) {
        const used = pouch - (next.state.run.seeds.radish ?? 0)
        farm.cash += next.state.run.cash - s.run.cash - used * seed
        farm.energy += ACTION_ENERGY_COST
        if (next.kind.startsWith('harvest')) firstHarvest ??= s.run.tick
        s = next.state
      } else {
        const dug = digForSeeds(s)
        if (!dug.ok) break
        digging.seeds += (dug.state.run.seeds.radish ?? 0) - pouch
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
    if (!s.run.licenses.includes('pumpkin')) {
      const r = buyLicense(s, 'pumpkin')
      if (r.ok) s = r.state
    }
    buy()
    while (s.run.energy >= ACTION_ENERGY_COST) {
      const crop: CropId = s.run.licenses.includes('pumpkin') && s.run.cash >= cropSeedCost('pumpkin', s.meta) ? 'pumpkin' : 'radish'
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

  it('can afford every level-1 tool within ~300 ticks (about 5 minutes)', () => {
    for (const job of TOOL_JOBS) expect(summary.affordable[job][0]).toBeLessThanOrEqual(300)
  })

  it('pins the Batch 5 results milestones (PLAN.md)', () => {
    // harvest and plant level 3 need 120 harvests / plants, not reached in 1200 ticks
    expect(summary.affordable).toEqual({ water: [120, 655, 984], harvest: [233, 886], plant: [200, 683] })
  })
})

// ---- Batch 6: two-tier cash/energy hierarchy, four crops, storage ----

const SESSION = 1200
/** license order and best-first planting for the four-crop bots */
const LICENSE_ORDER: CropId[] = ['chilli', 'pumpkin', 'lemon']
const PLANT_ORDER: CropId[] = ['lemon', 'pumpkin', 'chilli', 'radish']

// One crop on the 9 starting tiles for a session, license owned and cash to spare (so seeds never block it), farmed
// by the greedy bot's own priority. Same accounting as runBot: harvest income − seeds per farm action (till, plant,
// water, harvest all count 1 energy), plus the crops standing at the cut-off at sell price × growth progress.
function runCropBot(crop: CropId, ticks = SESSION) {
  const init = createInitialState()
  let s: GameState = { ...init, run: { ...init.run, cash: 1000, licenses: [...new Set<CropId>(['radish', crop])] } }
  const farm = { cash: 0, energy: 0 }
  for (let t = 0; t < ticks; t++) {
    while (s.run.energy >= ACTION_ENERGY_COST) {
      const next = bestFarmAction(s, [crop])
      if (!next) break
      farm.cash += next.state.run.cash - s.run.cash
      farm.energy += ACTION_ENERGY_COST
      s = next.state
    }
    s = step(s, 1)
  }
  const field = s.run.tiles.reduce((sum, t) => sum + (t.cropId ? cropSellPrice(t.cropId, s.meta, 0) * growthProgress(t, s) : 0), 0)
  return { ...farm, field, harvests: s.run.counters.harvests, cashPerEnergy: (farm.cash + field) / farm.energy }
}

// Steady-state mining at a fixed mastery level: energy is refilled before every mine action and the mastery xp put back
// after it, so the level never moves. Sells stone and coal before storage runs out of room, crafts the first pickaxe
// and repairs it when blunt (buying the wood; both count against mining), and values what is left in storage at the end.
function mineBench({ pickaxe, xp = 0, mastered = false, vein = 0, actions = 5000 }: { pickaxe: boolean; xp?: number; mastered?: boolean; vein?: number; actions?: number }) {
  const init = createInitialState()
  const fixed = { mastery: { wooden: xp }, masteredTiers: mastered ? (['wooden'] as const).slice() : [] }
  let s: GameState = { ...init, run: { ...init.run, cash: 1e6, mineLicense: true, vein: { level: vein, progress: 0, rock: 'stone' }, ...fixed } }
  const start = s.run.cash
  const recipe = { wood: pickaxeCraftCost('wooden', init.meta).wood!, repairWood: pickaxeRepairCost('wooden', init.meta).wood! }
  let repairs = 0
  const act = (r: ActionResult) => {
    if (!r.ok) throw new Error(r.error)
    s = r.state
  }
  for (let i = 0; i < actions; i++) {
    if (bagCount(s.run) + recipe.wood >= s.run.bagCapacity)
      for (const id of ['stone', 'coal'] as const) if (s.run.inventory[id]) act(sellItem(s, id, s.run.inventory[id]!))
    if (pickaxe && !s.run.pickaxe) {
      act(buyWood(s, recipe.wood))
      act(craftPickaxe(s))
    } else if (pickaxe && s.run.pickaxe!.durability === 0) {
      act(buyWood(s, recipe.repairWood))
      act(repairPickaxe(s))
      repairs++
    }
    s = { ...s, run: { ...s.run, energy: ACTION_ENERGY_COST } }
    act(dig(s))
    s = { ...s, run: { ...s.run, ...fixed } }
  }
  const bag = ITEM_IDS.filter(isSellable).reduce((sum, id) => sum + (s.run.inventory[id] ?? 0) * itemSellPrice(id, s.meta, 0), 0)
  return { repairs, cashPerEnergy: (s.run.cash - start + bag) / actions }
}

/** dig for seeds, energy refilled every time; dug seeds valued at their buy price (batch 5 definition) */
function digBench(actions = 5000) {
  let s = createInitialState()
  for (let i = 0; i < actions; i++) {
    const r = digForSeeds({ ...s, run: { ...s.run, energy: ACTION_ENERGY_COST } })
    if (!r.ok) throw new Error(r.error)
    s = r.state
  }
  return ((s.run.seeds.radish ?? 0) * cropSeedCost('radish', s.meta)) / actions
}

describe('batch 6: two-tier cash/energy hierarchy', () => {
  const farming = Object.fromEntries((['radish', 'chilli', 'pumpkin', 'lemon'] as const).map((c) => [c, runCropBot(c)]))
  const mining = {
    dig: digBench(),
    hand: mineBench({ pickaxe: false }).cashPerEnergy,
    pickaxeLv0: mineBench({ pickaxe: true }).cashPerEnergy,
    pickaxeLv10: mineBench({ pickaxe: true, xp: 400, mastered: true }).cashPerEnergy,
    veinLv1Lv10: mineBench({ pickaxe: true, xp: 400, mastered: true, vein: 1 }).cashPerEnergy,
  }
  console.log('batch 6 hierarchy', JSON.stringify({ farming, mining }, null, 1))
  const carrot = farming.radish.cashPerEnergy
  const pumpkin = farming.pumpkin.cashPerEnergy

  it('(a) dig < hand mining < pickaxe Lv0 < 0.9 × carrot farming', () => {
    expect(mining.dig).toBeLessThan(mining.hand)
    expect(mining.hand).toBeLessThan(mining.pickaxeLv0)
    expect(mining.pickaxeLv0).toBeLessThan(0.9 * carrot)
  })

  it('(b) pickaxe Lv10 and vein Lv1 + Lv10, repairs included, < 0.9 × pumpkin farming', () => {
    expect(mining.pickaxeLv10).toBeLessThan(0.9 * pumpkin)
    expect(mining.veinLv1Lv10).toBeLessThan(0.9 * pumpkin)
  })

  it('(c) farming cash/energy: carrot < chilli < pumpkin < lemon', () => {
    const order = [farming.radish, farming.chilli, farming.pumpkin, farming.lemon].map((f) => f.cashPerEnergy)
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

  it('(d) storage level 1 is bought within ~600 ticks, vein level 1 after it within the session', () => {
    expect(summary.storageBought).toBeLessThanOrEqual(600)
    expect(summary.veinBought).toBeGreaterThan(summary.storageBought!)
    expect(summary.veinBought).toBeLessThanOrEqual(1200)
    expect(summary.lowest).toBeGreaterThanOrEqual(0)
  })
})
