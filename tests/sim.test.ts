import { describe, expect, it } from 'vitest'
import { buyLicense, harvest, plant, till, water, type ActionResult } from '../src/core/actions'
import {
  ACTION_ENERGY_COST,
  cropGrowTicks,
  itemSellPrice,
  licenseCost,
  mineLicenseCost,
  pickaxeRecipe,
} from '../src/core/balance'
import { ITEM_IDS } from '../src/core/data/items'
import { bagCount, buyMineLicense, buyWood, craftPickaxe, dig, sellItem } from '../src/core/mining'
import { createInitialState, type GameState } from '../src/core/state'
import { step } from '../src/core/step'

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
function bestFarmAction(s: GameState): { state: GameState; kind: string } | null {
  const tiles = s.run.tiles
  const growing = (i: number) => {
    const { cropId, growth } = tiles[i]
    return cropId !== undefined && growth < cropGrowTicks(cropId, s.meta, s.run.upgrades.fertilizer)
  }
  const tries: Array<[string, (i: number) => ActionResult | null]> = [
    ['harvest', (i) => harvest(s, i)],
    ['water', (i) => (tiles[i].moisture === 0 && growing(i) ? water(s, i) : null)],
    ['plant:pumpkin', (i) => plant(s, i, 'pumpkin')],
    ['plant:radish', (i) => plant(s, i, 'radish')],
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

/** mineEarly: buy the mine license as soon as it is affordable while energy is idle;
 *  otherwise only once the pumpkin license is owned (the main crop is never delayed) */
function runBot(mineEarly: boolean) {
  let s = createInitialState()
  const m: Milestones = {}
  let minCash = s.run.cash
  // net cash and energy per activity; licenses are one-off capital and excluded from both
  const farm = { cash: 0, energy: 0 }
  const mine = { cash: 0, energy: 0 }
  const pumpkinLicense = licenseCost('pumpkin', s.meta)
  const mineLicense = mineLicenseCost(s.meta)
  const track = (next: GameState, into: { cash: number; energy: number }, energy = 0) => {
    into.cash += next.run.cash - s.run.cash
    into.energy += energy
    s = next
    minCash = Math.min(minCash, s.run.cash)
  }
  const tryAct = (r: ActionResult, into: { cash: number; energy: number } | null, energy = 0) => {
    if (!r.ok) return false
    if (into) track(r.state, into, energy)
    else {
      s = r.state
      minCash = Math.min(minCash, s.run.cash)
    }
    return true
  }

  // Mining fills idle energy only. Order: license → sell stone when the bag is full
  // → wood + pickaxe when broken → dig.
  const mineOnce = (tick: number): boolean => {
    if (!s.run.mineLicense) {
      if (!mineEarly && !s.run.licenses.includes('pumpkin')) return false
      if (!tryAct(buyMineLicense(s), null)) return false
      m.mineLicenseBought ??= tick
    }
    if (bagCount(s.run) >= s.run.bagCapacity) tryAct(sellItem(s, 'stone', s.run.inventory.stone ?? 0), mine)
    if (!s.run.pickaxe) {
      const need = pickaxeRecipe('wooden').wood - (s.run.inventory.wood ?? 0)
      if (need > 0 && !tryAct(buyWood(s, need), mine)) return false
      if (!tryAct(craftPickaxe(s), mine)) return false
    }
    if (!tryAct(dig(s), mine, ACTION_ENERGY_COST)) return false
    m.firstDig ??= tick
    return true
  }

  for (let t = 0; t < TICKS; t++) {
    const tick = s.run.tick
    const milestones = () => {
      if (!s.run.licenses.includes('pumpkin') && s.run.cash >= pumpkinLicense) m.pumpkinLicenseAffordable ??= tick
      if (s.run.cash >= mineLicense) m.mineLicenseAffordable ??= tick
    }
    milestones()
    if (!s.run.licenses.includes('pumpkin') && tryAct(buyLicense(s, 'pumpkin'), null)) m.pumpkinLicenseBought ??= tick
    while (s.run.energy >= ACTION_ENERGY_COST) {
      const next = bestFarmAction(s)
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
  }
  // items still in the bag count at their sell price, so mining is not undercounted at the cut-off
  const bagValue = ITEM_IDS.reduce(
    (sum, id) => sum + (s.run.inventory[id] ?? 0) * itemSellPrice(id, s.meta, s.run.upgrades.sellPrice),
    0,
  )
  return {
    milestones: m,
    minCash,
    finalCash: s.run.cash,
    finalTick: s.run.tick,
    counters: s.run.counters,
    bagValue,
    farm,
    mine,
    farmingCashPerEnergy: farm.cash / farm.energy,
    miningCashPerEnergy: (mine.cash + bagValue) / mine.energy,
  }
}

describe.each([
  // pumpkin license by ~250 holds only when the mine license waits for it; see PLAN.md "Batch 3 results"
  { name: 'pumpkin-first', mineEarly: false, pumpkinBy: 250 },
  { name: 'mine-early', mineEarly: true, pumpkinBy: 350 },
])('greedy bot $name (farm first, dig with idle energy), 600 ticks', ({ name, mineEarly, pumpkinBy }) => {
  const summary = runBot(mineEarly)
  console.log(`sim summary ${name}`, JSON.stringify(summary, null, 1))

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
