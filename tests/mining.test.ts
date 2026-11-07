import { describe, expect, it } from 'vitest'
import { nextRandom, type ActionResult } from '../src/core/actions'
import {
  BAG_CAPACITY_START,
  itemSellPrice,
  mineHits,
  mineLicenseCost,
  pickaxeRecipe,
  stoneHits,
  veinDrops,
  woodCost,
} from '../src/core/balance'
import { activePickaxe, buyMineLicense, buyWood, craftPickaxe, dig, repairPickaxe, sellItem } from '../src/core/mining'
import { createInitialState, type GameState } from '../src/core/state'

function withRun(run: Partial<GameState['run']>): GameState {
  const s = createInitialState()
  s.run = { ...s.run, ...run }
  return s
}

function okState(r: ActionResult): GameState {
  if (!r.ok) throw new Error(`expected ok, got ${r.error}`)
  return r.state
}

const meta = createInitialState().meta
const miner = (run: Partial<GameState['run']> = {}) =>
  withRun({ mineLicense: true, pickaxe: { tier: 'wooden', durability: 20 }, ...run })

describe('nextRandom (mulberry32)', () => {
  it('is deterministic, in [0, 1), and advances its state', () => {
    const [a, s1] = nextRandom(42)
    expect(nextRandom(42)).toEqual([a, s1])
    expect(s1).not.toBe(42)
    let s = 1
    for (let i = 0; i < 1000; i++) {
      const [r, next] = nextRandom(s)
      expect(r).toBeGreaterThanOrEqual(0)
      expect(r).toBeLessThan(1)
      s = next
    }
  })
})

describe('buyMineLicense', () => {
  it('pays the license once', () => {
    const next = okState(buyMineLicense(withRun({ cash: mineLicenseCost(meta) })))
    expect(next.run.mineLicense).toBe(true)
    expect(next.run.cash).toBe(0)
    expect(buyMineLicense(next)).toEqual({ ok: false, error: 'ALREADY_OWNED' })
  })
  it('rejects when unaffordable', () => {
    expect(buyMineLicense(withRun({ cash: mineLicenseCost(meta) - 1 }))).toEqual({ ok: false, error: 'NO_CASH' })
  })
})

describe('buyWood', () => {
  it('buys n wood into the bag', () => {
    const next = okState(buyWood(withRun({ cash: 3 * woodCost(meta) }), 3))
    expect(next.run.inventory.wood).toBe(3)
    expect(next.run.cash).toBe(0)
  })
  it('rejects bad amounts, a full bag, and missing cash', () => {
    for (const n of [0, -1, 1.5, NaN]) expect(buyWood(withRun({ cash: 1e6 }), n)).toEqual({ ok: false, error: 'BAD_AMOUNT' })
    const full = withRun({ cash: 1e6, inventory: { stone: BAG_CAPACITY_START } })
    expect(buyWood(full, 1)).toEqual({ ok: false, error: 'BAG_FULL' })
    expect(buyWood(withRun({ cash: woodCost(meta) - 1 }), 1)).toEqual({ ok: false, error: 'NO_CASH' })
  })
})

describe('craftPickaxe', () => {
  it('turns 3 wood into a wooden pickaxe', () => {
    const next = okState(craftPickaxe(withRun({ inventory: { wood: 4 } })))
    expect(next.run.pickaxe).toEqual({ tier: 'wooden', durability: pickaxeRecipe('wooden').durability })
    expect(next.run.inventory.wood).toBe(1)
  })
  it('rejects without enough wood or with a pickaxe already in hand', () => {
    expect(craftPickaxe(withRun({ inventory: { wood: 2 } }))).toEqual({ ok: false, error: 'NOT_ENOUGH_ITEMS' })
    expect(craftPickaxe(miner({ inventory: { wood: 3 } }))).toEqual({ ok: false, error: 'ALREADY_OWNED' })
  })
})

describe('dig', () => {
  it('spends 1 energy and 1 durability for 1 stone, counts the dig, advances the RNG', () => {
    const s = miner()
    const next = okState(dig(s))
    expect(next.run.energy).toBe(s.run.energy - 1)
    expect(next.run.pickaxe?.durability).toBe(19)
    expect(next.run.inventory).toEqual({ stone: 1 })
    expect(next.run.counters.mines).toBe(1)
    expect(next.run.counters.digs).toBe(0)
    expect(next.run.rngState).not.toBe(s.run.rngState)
    expect(dig(s)).toEqual({ ok: true, state: next }) // same seed, same result
  })
  it('mines by hand with no pickaxe: 1 hit per energy, a stone every 2nd action', () => {
    expect([stoneHits(), mineHits(null), mineHits('wooden')]).toEqual([2, 1, 2])
    const s = withRun({ mineLicense: true })
    const half = okState(dig(s))
    expect(half.run.energy).toBe(s.run.energy - 1)
    expect(half.run.vein.progress).toBe(1)
    expect(half.run.inventory).toEqual({})
    expect(half.run.rngState).toBe(s.run.rngState) // no drop, no roll
    expect(half.run.counters.mines).toBe(1)
    const done = okState(dig(half))
    expect(done.run.vein.progress).toBe(0)
    expect(done.run.inventory).toEqual({ stone: 1 })
    expect(done.run.counters.mines).toBe(2)
  })
  it('a pickaxe finishes a half-mined stone and carries the extra hit over', () => {
    const next = okState(dig(miner({ vein: { level: 0, progress: 1 } })))
    expect(next.run.inventory).toEqual({ stone: 1 })
    expect(next.run.vein.progress).toBe(1)
  })
  it('goes blunt at 0 durability: still owned, then mines by hand and loses no more durability', () => {
    const blunt = okState(dig(miner({ pickaxe: { tier: 'wooden', durability: 1 } })))
    expect(blunt.run.pickaxe).toEqual({ tier: 'wooden', durability: 0 })
    expect(activePickaxe(blunt.run)).toBeNull()
    const hand = okState(dig(blunt))
    expect(hand.run.pickaxe).toEqual({ tier: 'wooden', durability: 0 })
    expect(hand.run.vein.progress).toBe(1)
    expect(craftPickaxe({ ...hand, run: { ...hand.run, inventory: { wood: 3 } } })).toEqual({ ok: false, error: 'ALREADY_OWNED' })
  })
  it('validates license, bag, energy in that order', () => {
    expect(dig(withRun({ energy: 0 }))).toEqual({ ok: false, error: 'NO_MINE_LICENSE' })
    const full = { stone: BAG_CAPACITY_START - 1, wood: 1 }
    expect(dig(withRun({ mineLicense: true, inventory: full, energy: 0 }))).toEqual({ ok: false, error: 'BAG_FULL' })
    expect(dig(miner({ energy: 0.5 }))).toEqual({ ok: false, error: 'NO_ENERGY' })
  })
  it('vein level 0 drops only stone', () => {
    expect(veinDrops(0)).toEqual({ stone: 1 })
    let s = miner({ energy: 1e6 })
    for (let i = 0; i < 20; i++) s = okState(dig(s))
    expect(s.run.inventory).toEqual({ stone: 20 })
  })
})

describe('repairPickaxe', () => {
  const blunt = (wood: number) => miner({ pickaxe: { tier: 'wooden', durability: 0 }, inventory: { wood } })
  it('spends repair wood (less than crafting) and restores full durability, no energy', () => {
    const recipe = pickaxeRecipe('wooden')
    expect(recipe).toMatchObject({ wood: 3, repairWood: 2, durability: 25 })
    const s = blunt(3)
    const next = okState(repairPickaxe(s))
    expect(next.run.pickaxe).toEqual({ tier: 'wooden', durability: 25 })
    expect(next.run.inventory.wood).toBe(1)
    expect(next.run.energy).toBe(s.run.energy)
  })
  it('validates pickaxe, blunt, wood in that order', () => {
    expect(repairPickaxe(withRun({ inventory: { wood: 9 } }))).toEqual({ ok: false, error: 'NO_PICKAXE' })
    expect(repairPickaxe(miner({ pickaxe: { tier: 'wooden', durability: 1 }, inventory: { wood: 9 } }))).toEqual({
      ok: false,
      error: 'NOT_BLUNT',
    })
    expect(repairPickaxe(blunt(1))).toEqual({ ok: false, error: 'NOT_ENOUGH_WOOD' })
  })
})

describe('sellItem', () => {
  it('sells n items for cash and counts each unit as a sale', () => {
    const s = withRun({ cash: 0, inventory: { stone: 7 } })
    const next = okState(sellItem(s, 'stone', 7))
    expect(next.run.cash).toBe(7 * itemSellPrice('stone', meta, 0))
    expect(next.run.inventory.stone).toBe(0)
    expect(next.run.counters.sales).toBe(7)
  })
  it('applies the sellPrice upgrade', () => {
    const upgrades = { ...createInitialState().run.upgrades, sellPrice: 5 }
    expect(itemSellPrice('stone', meta, 5)).toBe(Math.round(itemSellPrice('stone', meta, 0) * 1.5))
    const next = okState(sellItem(withRun({ cash: 0, inventory: { stone: 1 }, upgrades }), 'stone', 1))
    expect(next.run.cash).toBe(itemSellPrice('stone', meta, 5))
  })
  it('rejects bad amounts and missing items', () => {
    const s = withRun({ inventory: { stone: 1 } })
    expect(sellItem(s, 'stone', 0)).toEqual({ ok: false, error: 'BAD_AMOUNT' })
    expect(sellItem(s, 'stone', 2)).toEqual({ ok: false, error: 'NOT_ENOUGH_ITEMS' })
    expect(sellItem(s, 'wood', 1)).toEqual({ ok: false, error: 'NOT_ENOUGH_ITEMS' })
  })
  it('wood resells below its buy price', () => {
    expect(itemSellPrice('wood', meta, 0)).toBeLessThan(woodCost(meta))
  })
})
