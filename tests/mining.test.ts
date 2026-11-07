import { describe, expect, it } from 'vitest'
import { nextRandom, type ActionResult } from '../src/core/actions'
import {
  BAG_CAPACITY_START,
  itemSellPrice,
  mineHits,
  mineLicenseCost,
  pickaxeCraftCost,
  pickaxeDurability,
  pickaxeRepairCost,
  rockHits,
  storageCost,
  storageMaxLevel,
  storageSlotsPerLevel,
  veinDrops,
  veinMaxLevel,
  veinUpgradeCost,
  woodCost,
  type Price,
} from '../src/core/balance'
import {
  activePickaxe,
  buyMineLicense,
  buyStorage,
  upgradeVein,
  buyWood,
  craftPickaxe,
  dig,
  expectedUses,
  pickaxePreserve,
  repairPickaxe,
  sellItem,
} from '../src/core/mining'
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
    expect(next.run.pickaxe).toEqual({ tier: 'wooden', durability: pickaxeDurability('wooden') })
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
    expect([rockHits('stone'), mineHits(null), mineHits('wooden')]).toEqual([2, 1, 2])
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
  it('a pickaxe finishes a half-mined stone; extra hits are lost (one rock per action)', () => {
    const next = okState(dig(miner({ vein: { level: 0, progress: 1, rock: 'stone' } })))
    expect(next.run.inventory).toEqual({ stone: 1 })
    expect(next.run.vein.progress).toBe(0)
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

describe('pickaxe mastery', () => {
  const mineN = (s: GameState, n: number) => {
    for (let i = 0; i < n; i++) s = okState(dig(s))
    return s
  }

  it('1 xp per pickaxe mine action, none by hand or with a blunt pickaxe', () => {
    expect(mineN(miner({ energy: 1e6 }), 3).run.mastery).toEqual({ wooden: 3 })
    expect(mineN(withRun({ mineLicense: true, energy: 1e6 }), 3).run.mastery).toEqual({})
    const blunt = miner({ pickaxe: { tier: 'wooden', durability: 0 }, mastery: { wooden: 5 } })
    expect(okState(dig(blunt)).run.mastery).toEqual({ wooden: 5 })
  })

  it('at Lv0 (the first 10 actions) every pickaxe action uses durability', () => {
    expect(mineN(miner({ energy: 1e6 }), 10).run.pickaxe?.durability).toBe(10)
  })

  it('mastery preserves durability: at Lv10 about 1 action in 5 uses it', () => {
    const s = mineN(miner({ energy: 1e6, bagCapacity: 1e6, pickaxe: { tier: 'wooden', durability: 1000 }, mastery: { wooden: 400 } }), 1000)
    const used = 1000 - s.run.pickaxe!.durability
    expect(used).toBeGreaterThan(150)
    expect(used).toBeLessThan(250)
  })

  it('reaching Lv10 adds the tier to masteredTiers once', () => {
    const s = okState(dig(miner({ mastery: { wooden: 399 } })))
    expect(s.run.mastery.wooden).toBe(400)
    expect(s.run.masteredTiers).toEqual(['wooden'])
    expect(okState(dig(s)).run.masteredTiers).toEqual(['wooden'])
    expect(okState(dig(miner({ mastery: { wooden: 398 } }))).run.masteredTiers).toEqual([])
  })

  it('expectedUses = base durability / (1 − preserve): 25 at Lv0, 125 at Lv10, mastered bonus inside the cap', () => {
    const run = (r: Partial<GameState['run']>) => withRun(r).run
    expect(expectedUses('wooden', run({}))).toBe(25)
    expect(expectedUses('wooden', run({ mastery: { wooden: 10 } }))).toBeCloseTo(35)
    expect(expectedUses('wooden', run({ mastery: { wooden: 400 } }))).toBeCloseTo(125)
    expect(expectedUses('wooden', run({ mastery: { wooden: 400 }, masteredTiers: ['wooden'] }))).toBeCloseTo(125)
    expect(pickaxePreserve('wooden', run({ masteredTiers: ['wooden'] }))).toBeCloseTo(0.05)
  })
})

describe('upgradeVein', () => {
  it('vein Lv1 costs 25 stone + 100 cash and drops 80 % stone / 20 % coal; coal sells for 4', () => {
    expect([veinMaxLevel(), veinUpgradeCost(0, meta), veinUpgradeCost(2, meta)]).toEqual([2, { stone: 25, cash: 100 }, null])
    expect(veinDrops(1)).toEqual({ stone: 0.8, coal: 0.2 })
    expect(itemSellPrice('coal', meta, 0)).toBe(4)
    const s = miner({ cash: 100, inventory: { stone: 26 }, bagCapacity: 50, vein: { level: 0, progress: 1, rock: 'stone' } })
    const next = okState(upgradeVein(s))
    expect(next.run.vein).toEqual({ level: 1, progress: 1, rock: 'stone' })
    expect(next.run.cash).toBe(0)
    expect(next.run.inventory.stone).toBe(1)
  })
  it('vein Lv2 costs 30 stone + 10 coal + 200 cash, needs the furnace, and drops 65 % stone / 20 % coal / 15 % copper ore', () => {
    expect(veinUpgradeCost(1, meta)).toEqual({ stone: 30, coal: 10, cash: 200 })
    expect(veinDrops(2)).toEqual({ stone: 0.65, coal: 0.2, copperOre: 0.15 })
    const lv1 = { level: 1, progress: 0, rock: 'stone' as const }
    const s = miner({ cash: 200, inventory: { stone: 30, coal: 10 }, bagCapacity: 40, vein: lv1 })
    expect(upgradeVein(s)).toEqual({ ok: false, error: 'NO_FURNACE' })
    const next = okState(upgradeVein({ ...s, run: { ...s.run, furnace: { built: true, queue: 0, progress: 0, ready: 0 } } }))
    expect([next.run.vein.level, next.run.cash, next.run.inventory]).toEqual([2, 0, { stone: 0, coal: 0 }])
    expect(upgradeVein({ ...next, run: { ...next.run, cash: 1e6, inventory: { stone: 1e3, coal: 1e3 } } })).toEqual({ ok: false, error: 'MAX_LEVEL' })
  })
  it('a copper rock takes 3 hits: 2 wooden-pickaxe actions, the 3rd hit lost', () => {
    expect(rockHits('copperOre')).toBe(3)
    const s = miner({ vein: { level: 2, progress: 0, rock: 'copperOre' } })
    const half = okState(dig(s))
    expect([half.run.vein.progress, half.run.inventory]).toEqual([2, {}])
    const done = okState(dig(half))
    expect([done.run.vein.progress, done.run.inventory]).toEqual([0, { copperOre: 1 }])
  })
  it('vein Lv2 drops copper ore about 3 times in 20 rocks', () => {
    let s = miner({ energy: 1e6, bagCapacity: 1e6, pickaxe: { tier: 'wooden', durability: 1e6 }, vein: { level: 2, progress: 0, rock: 'stone' } })
    for (let i = 0; i < 2000; i++) s = okState(dig(s))
    const { stone = 0, coal = 0, copperOre = 0 } = s.run.inventory
    const rocks = stone + coal + copperOre
    expect(copperOre / rocks).toBeGreaterThan(0.11)
    expect(copperOre / rocks).toBeLessThan(0.19)
  })
  it('vein Lv1 drops coal about 1 time in 5', () => {
    let s = miner({ energy: 1e6, bagCapacity: 1e6, pickaxe: { tier: 'wooden', durability: 1e6 }, vein: { level: 1, progress: 0, rock: 'stone' } })
    for (let i = 0; i < 1000; i++) s = okState(dig(s))
    expect(s.run.inventory.stone! + s.run.inventory.coal!).toBe(1000)
    expect(s.run.inventory.coal).toBeGreaterThan(150)
    expect(s.run.inventory.coal).toBeLessThan(250)
  })
  it('validates license, max level, stone, cash in that order', () => {
    expect(upgradeVein(withRun({ cash: 1e6, inventory: { stone: 25 } }))).toEqual({ ok: false, error: 'NO_MINE_LICENSE' })
    expect(upgradeVein(miner({ cash: 1e6, inventory: { stone: 24 } }))).toEqual({ ok: false, error: 'NOT_ENOUGH_ITEMS' })
    expect(upgradeVein(miner({ cash: 99, inventory: { stone: 25 } }))).toEqual({ ok: false, error: 'NO_CASH' })
  })
})

describe('buyStorage', () => {
  it('costs 15 stone +5 per level and 50 cash ×1.6 per level in whole numbers, max 5', () => {
    expect(storageMaxLevel()).toBe(5)
    expect([0, 1, 2, 3, 4].map((l) => storageCost(l, meta))).toEqual([
      { stone: 15, cash: 50 },
      { stone: 20, cash: 80 },
      { stone: 25, cash: 128 },
      { stone: 30, cash: 205 },
      { stone: 35, cash: 328 },
    ])
  })
  it('every stone price fits the storage the player has when it becomes buyable', () => {
    const capacity = (storageLevel: number) => BAG_CAPACITY_START + storageSlotsPerLevel() * storageLevel
    for (let l = 0; l < storageMaxLevel(); l++) expect(storageCost(l, meta).stone).toBeLessThanOrEqual(capacity(l))
    // vein Lv1 is meant to come after storage Lv1
    expect(veinUpgradeCost(0, meta)!.stone).toBeGreaterThan(capacity(0))
    // vein level v + 1 comes after storage level v + 1; the price is the sum of its items
    const items = (p: Price) => Object.entries(p).reduce((a, [k, n]) => (k === 'cash' ? a : a + n), 0)
    for (let v = 0; v < veinMaxLevel(); v++) expect(items(veinUpgradeCost(v, meta)!)).toBeLessThanOrEqual(capacity(v + 1))
  })
  it('adds 10 capacity per level and pays stone from storage', () => {
    const next = okState(buyStorage(miner({ cash: 60, inventory: { stone: 15 } })))
    expect([next.run.storageLevel, next.run.bagCapacity, next.run.cash, next.run.inventory.stone]).toEqual([1, BAG_CAPACITY_START + 10, 10, 0])
  })
  it('validates license, max level, stone, cash in that order', () => {
    expect(buyStorage(withRun({ cash: 1e6, inventory: { stone: 15 } }))).toEqual({ ok: false, error: 'NO_MINE_LICENSE' })
    expect(buyStorage(miner({ cash: 1e6, inventory: { stone: 1e3 }, storageLevel: 5 }))).toEqual({ ok: false, error: 'MAX_LEVEL' })
    expect(buyStorage(miner({ cash: 1e6, inventory: { stone: 14 } }))).toEqual({ ok: false, error: 'NOT_ENOUGH_ITEMS' })
    expect(buyStorage(miner({ cash: 49, inventory: { stone: 15 } }))).toEqual({ ok: false, error: 'NO_CASH' })
  })
})

describe('repairPickaxe', () => {
  const blunt = (wood: number) => miner({ pickaxe: { tier: 'wooden', durability: 0 }, inventory: { wood } })
  it('spends repair wood (less than crafting) and restores full durability, no energy', () => {
    expect([pickaxeCraftCost('wooden', meta), pickaxeRepairCost('wooden', meta), pickaxeDurability('wooden')]).toEqual([
      { wood: 3, cash: 0 },
      { wood: 2, cash: 0 },
      25,
    ])
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
    expect(repairPickaxe(blunt(1))).toEqual({ ok: false, error: 'NOT_ENOUGH_ITEMS' })
  })
})

describe('copper pickaxe', () => {
  const copper = (durability = 200) => ({ tier: 'copper' as const, durability })
  it('5 copper bars + 50 cash, durability 200, 3 hits per action; replaces the wooden one, whose mastery stays', () => {
    expect([pickaxeCraftCost('copper', meta), pickaxeRepairCost('copper', meta), pickaxeDurability('copper'), mineHits('copper')]).toEqual([
      { copperBar: 5, cash: 50 },
      { copperBar: 2, cash: 0 },
      200,
      3,
    ])
    const s = miner({ cash: 60, inventory: { copperBar: 6 }, mastery: { wooden: 400 }, masteredTiers: ['wooden'] })
    const next = okState(craftPickaxe(s, 'copper'))
    expect([next.run.pickaxe, next.run.cash, next.run.inventory, next.run.mastery]).toEqual([copper(), 10, { copperBar: 1 }, { wooden: 400 }])
    expect(craftPickaxe({ ...next, run: { ...next.run, inventory: { wood: 9 } } })).toEqual({ ok: false, error: 'ALREADY_OWNED' })
    expect(craftPickaxe({ ...next, run: { ...next.run, cash: 1e3, inventory: { copperBar: 9 } } }, 'copper')).toEqual({
      ok: false,
      error: 'ALREADY_OWNED',
    })
  })
  it('validates bars, then cash', () => {
    expect(craftPickaxe(miner({ cash: 1e3, inventory: { copperBar: 4 } }), 'copper')).toEqual({ ok: false, error: 'NOT_ENOUGH_ITEMS' })
    expect(craftPickaxe(miner({ cash: 49, inventory: { copperBar: 5 } }), 'copper')).toEqual({ ok: false, error: 'NO_CASH' })
  })
  it('breaks any rock in one action and earns copper xp; preserve = copper mastery + the wooden mastered bonus', () => {
    const s = miner({ pickaxe: copper(), vein: { level: 2, progress: 0, rock: 'copperOre' }, mastery: { wooden: 400 }, masteredTiers: ['wooden'] })
    const next = okState(dig(s))
    expect([next.run.inventory.copperOre, next.run.vein.progress, next.run.mastery]).toEqual([1, 0, { wooden: 400, copper: 1 }])
    // copper Lv0 + one mastered tier = 5 %; copper Lv1 (20 xp) = 1 − 1/1.4 + 5 %
    expect(pickaxePreserve('copper', s.run)).toBeCloseTo(0.05)
    expect(pickaxePreserve('copper', { ...s.run, mastery: { copper: 20 } })).toBeCloseTo(1 - 1 / 1.4 + 0.05)
    expect(expectedUses('copper', { ...s.run, masteredTiers: [] })).toBe(200)
  })
  it('repairs with 2 copper bars when blunt', () => {
    const s = miner({ pickaxe: copper(0), inventory: { copperBar: 2 } })
    const next = okState(repairPickaxe(s))
    expect([next.run.pickaxe, next.run.inventory]).toEqual([copper(), { copperBar: 0 }])
    expect(repairPickaxe(miner({ pickaxe: copper(0), inventory: { copperBar: 1, wood: 9 } }))).toEqual({ ok: false, error: 'NOT_ENOUGH_ITEMS' })
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
