import { describe, expect, it } from 'vitest'
import { nextRandom, type ActionResult } from '../src/core/actions'
import {
  BAG_CAPACITY_START,
  MINE_DROP_IDS,
  itemSellPrice,
  keepNCost,
  oreSortUnlockCost,
  masteryThresholds,
  mineHits,
  mineLicenseCost,
  pickaxeCraftCost,
  pickaxeDurability,
  pickaxeRepairCost,
  rockHits,
  rockPickaxe,
  storageCost,
  storageMaxLevel,
  storageSlotsPerLevel,
  veinDrops,
  veinMaxLevel,
  veinWeights,
  masteredOreBonus,
  veinNeedsPickaxe,
  veinUpgradeCost,
  woodCost,
  type Price,
} from '../src/core/balance'
import {
  activePickaxe,
  bestPickaxeTier,
  buyKeepN,
  buyMineLicense,
  buyStorage,
  upgradeVein,
  buyWood,
  craftPickaxe,
  dig,
  dropText,
  expectedUses,
  heldPickaxe,
  minedRock,
  pickaxePreserve,
  repairPickaxe,
  selectPickaxe,
  sellItem,
  setOreKeep,
  setOreSort,
  unlockOreSort,
} from '../src/core/mining'
import { sellFarm } from '../src/core/prestige'
import { createFurnace, createInitialState, type GameState, type Pickaxe } from '../src/core/state'
import { ITEMS } from '../src/core/data/items'

/** `pickaxe` = that one tier on the rack, in hand (null = none); the run fields otherwise */
function withRun({ pickaxe, ...run }: Partial<GameState['run']> & { pickaxe?: Pickaxe | null }): GameState {
  const s = createInitialState()
  const held = pickaxe === undefined ? {} : { rack: pickaxe ? { [pickaxe.tier]: pickaxe.durability } : {}, selectedPickaxe: pickaxe?.tier ?? null }
  s.run = { ...s.run, ...held, ...run }
  return s
}

function okState(r: ActionResult): GameState {
  if (!r.ok) throw new Error(`expected ok, got ${r.error}`)
  return r.state
}

const meta = createInitialState().meta
type RunInput = Parameters<typeof withRun>[0]
const miner = (run: RunInput = {}) =>
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
    expect(heldPickaxe(next.run)).toEqual({ tier: 'wooden', durability: pickaxeDurability('wooden') })
    expect(next.run.inventory.wood).toBe(1)
  })
  it('rejects without enough wood or with the tier already on the rack', () => {
    expect(craftPickaxe(withRun({ inventory: { wood: 2 } }))).toEqual({ ok: false, error: 'NOT_ENOUGH_ITEMS' })
    expect(craftPickaxe(miner({ inventory: { wood: 3 } }))).toEqual({ ok: false, error: 'ALREADY_OWNED' })
  })
  it('the gold tier: 5 gold bars + 💰500, 8 hits, durability 600 (batch 32), repaired with 2 gold bars', () => {
    const gold = (bars: number, cash: number) => miner({ pickaxe: { tier: 'iron', durability: 7 }, inventory: { goldBar: bars }, cash })
    expect(craftPickaxe(gold(4, 500), 'gold')).toEqual({ ok: false, error: 'NOT_ENOUGH_ITEMS' })
    expect(craftPickaxe(gold(5, 499), 'gold')).toEqual({ ok: false, error: 'NO_CASH' })
    const next = okState(craftPickaxe(gold(5, 500), 'gold'))
    expect([next.run.rack, next.run.selectedPickaxe, next.run.cash, next.run.inventory]).toEqual([{ iron: 7, gold: 600 }, 'gold', 0, { goldBar: 0 }])
    expect([mineHits('gold'), pickaxeRepairCost('gold', meta)]).toEqual([8, { goldBar: 2, cash: 0 }])
  })
  it('batch 32: crafting adds the tier to the rack and selects it; an owned tier (any durability) fails ALREADY_OWNED', () => {
    const bluntGold = (run: RunInput) => miner({ pickaxe: { tier: 'gold', durability: 0 }, mastery: { gold: 7 }, ...run })
    const next = okState(craftPickaxe(bluntGold({ cash: 200, inventory: { ironBar: 5 } }), 'iron'))
    expect([next.run.rack, next.run.selectedPickaxe, next.run.cash, next.run.inventory, next.run.mastery.gold]).toEqual([
      { gold: 0, iron: 1200 },
      'iron',
      0,
      { ironBar: 0 },
      7,
    ])
    expect(craftPickaxe(bluntGold({ cash: 1e3, inventory: { goldBar: 9 } }), 'gold')).toEqual({ ok: false, error: 'ALREADY_OWNED' })
    expect(craftPickaxe(next, 'iron')).toEqual({ ok: false, error: 'ALREADY_OWNED' })
    expect(craftPickaxe(bluntGold({ cash: 0, inventory: { ironBar: 4 } }), 'iron')).toEqual({ ok: false, error: 'NOT_ENOUGH_ITEMS' })
    expect(craftPickaxe(bluntGold({ cash: 199, inventory: { ironBar: 5 } }), 'iron')).toEqual({ ok: false, error: 'NO_CASH' })
  })
})

describe('batch 32: hit carry-over and mastered ore', () => {
  const stone = (progress = 0) => ({ level: 0, progress, rock: 'stone' as const })

  it('a copper pickaxe (3 hits) on stone (2) breaks it and leaves 1 hit on the next rock; one press counts one mine', () => {
    const next = okState(dig(miner({ pickaxe: { tier: 'copper', durability: 200 }, vein: stone() })))
    expect([next.run.inventory, next.run.vein.progress, next.run.counters.mines, next.run.rack.copper]).toEqual([{ stone: 1 }, 1, 1, 199])
  })

  it('a gold pickaxe (8 hits) on stone breaks 4 rocks and rolls 4 rocks (after the one preserve roll)', () => {
    const s = miner({ pickaxe: { tier: 'gold', durability: 600 }, vein: stone() })
    const next = okState(dig(s))
    let rng = s.run.rngState
    for (let i = 0; i < 5; i++) rng = nextRandom(rng)[1]
    expect([next.run.inventory, next.run.vein.progress, next.run.counters.mines, next.run.rngState, next.run.mastery]).toEqual([{ stone: 4 }, 0, 1, rng, { gold: 1 }])
  })

  it('full storage mid-press keeps the rock unbroken at full progress and loses the rest; the next press fails BAG_FULL until there is room, then breaks it at once', () => {
    const s = miner({ pickaxe: { tier: 'gold', durability: 600 }, vein: stone(), inventory: { stone: BAG_CAPACITY_START - 1 } })
    const next = okState(dig(s))
    expect([next.run.inventory.stone, next.run.vein.progress]).toEqual([BAG_CAPACITY_START, 2])
    expect(dig(next)).toEqual({ ok: false, error: 'BAG_FULL' })
    const room = okState(sellItem(next, 'stone', 2))
    const again = okState(dig(room))
    expect([again.run.inventory.stone, again.run.vein.progress]).toEqual([BAG_CAPACITY_START, 2])
  })

  it('a kind set to Sell on dig never stops a press: a full storage still breaks all 4 and sells them', () => {
    const s = miner({ pickaxe: { tier: 'gold', durability: 600 }, vein: stone(), inventory: { wood: BAG_CAPACITY_START }, oreSort: { stone: 'sell' } })
    const next = okState(dig(s))
    expect([next.run.inventory, next.run.vein.progress, next.run.counters.sales, next.run.cash]).toEqual([
      { wood: BAG_CAPACITY_START, stone: 0 },
      0,
      4,
      s.run.cash + 4 * itemSellPrice('stone', meta, 0),
    ])
  })

  it('mastered weights at vein Lv4: each ore × (1 + 0.1 × mastered), stone gives up the gain, coal unchanged; dropText shows them', () => {
    expect(masteredOreBonus()).toBe(0.1)
    const w = veinWeights(4, 4)
    expect([w.copperOre, w.ironOre, w.goldOre, w.stone, w.coal].map((x) => Math.round(x! * 1000) / 1000)).toEqual([0.168, 0.14, 0.112, 0.38, 0.2])
    expect(veinWeights(4, 0)).toEqual(veinDrops(4))
    expect(veinWeights(0, 4)).toEqual({ stone: 1 })
    expect(dropText(2, 4)).toBe(`${ITEMS.stone.emoji} Stone 59 % · ${ITEMS.coal.emoji} Coal 20 % · ${ITEMS.copperOre.emoji} Copper ore 21 %`)
  })
})

describe('batch 32: 🧺 Keep N', () => {
  const vein3 = { level: 3, progress: 0, rock: 'stone' as const }
  const keeper = (run: RunInput = {}) =>
    miner({ vein: vein3, oreSort: { stone: 'sell' }, keepN: true, oreKeep: { stone: 20 }, bagCapacity: 50, ...run })

  it('keep 20 stone: the 20th stone is stored, the 21st sells', () => {
    const at19 = okState(dig(keeper({ inventory: { stone: 19 } })))
    expect([at19.run.inventory.stone, at19.run.counters.sales]).toEqual([20, 0])
    const at20 = okState(dig(at19))
    expect([at20.run.inventory.stone, at20.run.counters.sales]).toEqual([20, 1])
  })

  it('a full storage below N sells (never BAG_FULL); N = 0 or Keep N not bought is the plain Sell on dig', () => {
    const full = okState(dig(keeper({ inventory: { stone: 5, wood: 45 } })))
    expect([full.run.inventory.stone, full.run.counters.sales]).toEqual([5, 1])
    const plain = okState(dig(miner({ vein: vein3, oreSort: { stone: 'sell' }, bagCapacity: 50 })))
    for (const run of [{ oreKeep: { stone: 0 } }, { keepN: false }]) {
      const next = okState(dig(keeper(run)))
      expect([next.run.inventory, next.run.counters.sales, next.run.cash]).toEqual([plain.run.inventory, plain.run.counters.sales, plain.run.cash])
    }
  })

  it('buyKeepN: 🥈10 🥇5 💰7,000; NO_MINE_LICENSE, LOCKED (vein below Lv3), ALREADY_OWNED, NOT_ENOUGH_ITEMS, NO_CASH', () => {
    const price = keepNCost(meta)
    expect(price).toEqual({ ironBar: 10, goldBar: 5, cash: 7000 })
    const rich = { vein: vein3, cash: 7000, inventory: { ironBar: 10, goldBar: 5 } }
    expect(buyKeepN(withRun({ ...rich, mineLicense: false }))).toEqual({ ok: false, error: 'NO_MINE_LICENSE' })
    expect(buyKeepN(miner({ ...rich, vein: { ...vein3, level: 2 } }))).toEqual({ ok: false, error: 'LOCKED' })
    expect(buyKeepN(miner({ ...rich, keepN: true }))).toEqual({ ok: false, error: 'ALREADY_OWNED' })
    expect(buyKeepN(miner({ ...rich, inventory: { ironBar: 10, goldBar: 4 } }))).toEqual({ ok: false, error: 'NOT_ENOUGH_ITEMS' })
    expect(buyKeepN(miner({ ...rich, cash: 6999 }))).toEqual({ ok: false, error: 'NO_CASH' })
    const bought = okState(buyKeepN(miner(rich)))
    expect([bought.run.keepN, bought.run.cash, bought.run.inventory]).toEqual([true, 0, { ironBar: 0, goldBar: 0 }])
  })

  it('setOreKeep: LOCKED without Keep N or for a locked kind; BAD_AMOUNT outside 0 … storage or not whole', () => {
    expect(setOreKeep(keeper({ keepN: false }), 'stone', 10)).toEqual({ ok: false, error: 'LOCKED' })
    expect(setOreKeep(keeper(), 'coal', 10)).toEqual({ ok: false, error: 'LOCKED' })
    for (const n of [-1, 51, 2.5, NaN]) expect(setOreKeep(keeper(), 'stone', n)).toEqual({ ok: false, error: 'BAD_AMOUNT' })
    expect(okState(setOreKeep(keeper(), 'stone', 50)).run.oreKeep).toEqual({ stone: 50 })
    expect(okState(setOreKeep(keeper(), 'stone', 0)).run.oreKeep).toEqual({ stone: 0 })
  })

  it('the Keep N price fits storage at vein Lv3 (15 items ≤ 50)', () => {
    const { cash, stars, ...items } = keepNCost(meta)
    void [cash, stars]
    expect(Object.values(items).reduce((a, b) => a + (b ?? 0), 0)).toBe(15)
    expect(15).toBeLessThanOrEqual(BAG_CAPACITY_START + 3 * storageSlotsPerLevel())
  })
})

describe('batch 32: the pickaxe rack', () => {
  const rack = (run: RunInput = {}) => withRun({ mineLicense: true, rack: { wooden: 0, copper: 200, iron: 1200 }, selectedPickaxe: 'copper', ...run })

  it('selectPickaxe takes any owned tier in hand, free and without energy; NO_PICKAXE when not on the rack', () => {
    const s = rack({ energy: 0, cash: 0 })
    expect(okState(selectPickaxe(s, 'iron')).run).toEqual({ ...s.run, selectedPickaxe: 'iron' })
    expect(selectPickaxe(s, 'gold')).toEqual({ ok: false, error: 'NO_PICKAXE' })
    expect([bestPickaxeTier(s.run), bestPickaxeTier(withRun({}).run)]).toEqual(['iron', null])
  })

  it('a blunt tier may be selected: dig then mines by hand and its durability stays 0', () => {
    const hand = okState(dig(okState(selectPickaxe(rack(), 'wooden'))))
    expect([heldPickaxe(hand.run), activePickaxe(hand.run), hand.run.vein.progress, hand.run.mastery]).toEqual([{ tier: 'wooden', durability: 0 }, null, mineHits(null), {}])
    expect(hand.run.rack).toEqual({ wooden: 0, copper: 200, iron: 1200 })
  })

  it('repairPickaxe repairs the named tier only (default: the selected one)', () => {
    const s = rack({ rack: { wooden: 0, copper: 0, iron: 5 }, inventory: { wood: 2, copperBar: 2 } })
    expect(okState(repairPickaxe(s, 'wooden')).run.rack).toEqual({ wooden: 25, copper: 0, iron: 5 })
    expect(okState(repairPickaxe(s)).run.rack).toEqual({ wooden: 0, copper: 200, iron: 5 })
    expect(repairPickaxe(s, 'iron')).toEqual({ ok: false, error: 'NOT_BLUNT' })
    expect(repairPickaxe(s, 'gold')).toEqual({ ok: false, error: 'NO_PICKAXE' })
  })

  it('vein Lv4 opens with iron on the rack while copper is selected', () => {
    const s = rack({ cash: 7500, inventory: { stone: 45, ironBar: 8 }, bagCapacity: 60, furnace: { ...createFurnace(), built: true }, vein: { level: 3, progress: 0, rock: 'stone' } })
    expect(okState(upgradeVein(s)).run.vein.level).toBe(4)
    expect(upgradeVein({ ...s, run: { ...s.run, rack: { copper: 200 } } })).toEqual({ ok: false, error: 'NO_IRON_PICKAXE' })
  })
})

describe('dig', () => {
  it('spends 1 energy and 1 durability for 1 stone, counts the dig, advances the RNG', () => {
    const s = miner()
    const next = okState(dig(s))
    expect(next.run.energy).toBe(s.run.energy - 1)
    expect(next.run.rack.wooden).toBe(19)
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
  it('batch 32: a pickaxe finishes a half-mined stone and its extra hit carries into the next rock', () => {
    const next = okState(dig(miner({ vein: { level: 0, progress: 1, rock: 'stone' } })))
    expect(next.run.inventory).toEqual({ stone: 1 })
    expect(next.run.vein.progress).toBe(1)
  })
  it('goes blunt at 0 durability: still owned, then mines by hand and loses no more durability', () => {
    const blunt = okState(dig(miner({ pickaxe: { tier: 'wooden', durability: 1 } })))
    expect(heldPickaxe(blunt.run)).toEqual({ tier: 'wooden', durability: 0 })
    expect(activePickaxe(blunt.run)).toBeNull()
    const hand = okState(dig(blunt))
    expect(heldPickaxe(hand.run)).toEqual({ tier: 'wooden', durability: 0 })
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
    expect(mineN(miner({ energy: 1e6 }), 10).run.rack.wooden).toBe(10)
  })

  it('mastery preserves durability: at Lv10 about 1 action in 5 uses it', () => {
    const s = mineN(miner({ energy: 1e6, bagCapacity: 1e6, pickaxe: { tier: 'wooden', durability: 1000 }, mastery: { wooden: 400 } }), 1000)
    const used = 1000 - s.run.rack.wooden!
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
    // from a worn pickaxe's current durability: 187 left at copper Lv0 = 187 more uses, not the fresh 200
    expect(expectedUses('copper', run({}), 187)).toBe(187)
    expect(expectedUses('wooden', run({ mastery: { wooden: 400 } }), 10)).toBeCloseTo(50)
  })
})

describe('upgradeVein', () => {
  it('vein Lv1 costs 25 stone + 100 cash and drops 80 % stone / 20 % coal; coal sells for 4', () => {
    expect([veinMaxLevel(), veinUpgradeCost(0, meta), veinUpgradeCost(4, meta)]).toEqual([4, { stone: 25, cash: 100 }, null])
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
    const next = okState(upgradeVein({ ...s, run: { ...s.run, furnace: { ...s.run.furnace, built: true } } }))
    expect([next.run.vein.level, next.run.cash, next.run.inventory]).toEqual([2, 0, { stone: 0, coal: 0 }])
  })
  it('vein Lv3 costs 40 stone + 5 copper bars + 400 cash and drops 55 % stone / 20 % coal / 15 % copper / 10 % iron ore', () => {
    expect(veinUpgradeCost(2, meta)).toEqual({ stone: 40, copperBar: 5, cash: 400 })
    expect(veinDrops(3)).toEqual({ stone: 0.55, coal: 0.2, copperOre: 0.15, ironOre: 0.1 })
    expect(itemSellPrice('ironOre', meta, 0)).toBe(1)
    const furnace = { ...createInitialState().run.furnace, built: true }
    const s = miner({ cash: 400, inventory: { stone: 40, copperBar: 5 }, bagCapacity: 50, furnace, vein: { level: 2, progress: 1, rock: 'copperOre' } })
    expect(upgradeVein({ ...s, run: { ...s.run, inventory: { stone: 40, copperBar: 4 } } })).toEqual({ ok: false, error: 'NOT_ENOUGH_ITEMS' })
    const next = okState(upgradeVein(s))
    expect([next.run.vein, next.run.cash, next.run.inventory]).toEqual([{ level: 3, progress: 1, rock: 'copperOre' }, 0, { stone: 0, copperBar: 0 }])
  })
  it('vein Lv4 costs 45 stone + 8 iron bars + 💰7500, needs the iron pickaxe, and drops 50/20/12/10/8 gold; max', () => {
    expect([veinUpgradeCost(3, meta), veinDrops(4), veinNeedsPickaxe(4)]).toEqual([
      { stone: 45, ironBar: 8, cash: 7500 },
      { stone: 0.5, coal: 0.2, copperOre: 0.12, ironOre: 0.1, goldOre: 0.08 },
      true,
    ])
    const furnace = { ...createInitialState().run.furnace, built: true }
    const rich = (tier: 'copper' | 'iron' | 'gold') =>
      miner({ cash: 7500, inventory: { stone: 45, ironBar: 8 }, bagCapacity: 60, furnace, pickaxe: { tier, durability: 1000 }, vein: { level: 3, progress: 0, rock: 'stone' } })
    // a copper pickaxe cannot open the gold vein: its gold rocks would only ever be stone
    expect(upgradeVein(rich('copper'))).toEqual({ ok: false, error: 'NO_IRON_PICKAXE' })
    const next = okState(upgradeVein(rich('iron')))
    expect([next.run.vein.level, next.run.cash, next.run.inventory]).toEqual([4, 0, { stone: 0, ironBar: 0 }])
    expect(upgradeVein(rich('gold')).ok).toBe(true)
    expect(upgradeVein({ ...next, run: { ...next.run, cash: 1e6, inventory: { stone: 1e3, ironBar: 1e3 } } })).toEqual({ ok: false, error: 'MAX_LEVEL' })
  })
  it('an iron rock takes 4 hits with a copper pickaxe (2 actions) and drops iron ore; the 2 hits left break the next coal rock (batch 32)', () => {
    expect([rockHits('ironOre'), rockPickaxe('ironOre')]).toEqual([4, 'copper'])
    const s = miner({ pickaxe: { tier: 'copper', durability: 200 }, vein: { level: 3, progress: 0, rock: 'ironOre' } })
    const half = okState(dig(s))
    expect([half.run.vein.progress, half.run.inventory]).toEqual([3, {}])
    const done = okState(dig(half))
    expect([done.run.vein.progress, done.run.inventory]).toEqual([0, { ironOre: 1, coal: 1 }])
  })
  it('a wooden pickaxe, bare hands or a blunt copper pickaxe mine an iron rock as stone (stone hits, stone drop)', () => {
    const rock = { level: 3, progress: 0, rock: 'ironOre' as const }
    expect(okState(dig(miner({ vein: rock }))).run.inventory).toEqual({ stone: 1 })
    const hand = withRun({ mineLicense: true, vein: rock })
    expect(okState(dig(okState(dig(hand)))).run.inventory).toEqual({ stone: 1 })
    const blunt = miner({ pickaxe: { tier: 'copper', durability: 0 }, vein: rock })
    expect(okState(dig(blunt)).run.vein.progress).toBe(1)
    expect(okState(dig(okState(dig(blunt)))).run.inventory).toEqual({ stone: 1 })
    expect(
      [minedRock('ironOre', null), minedRock('ironOre', 'wooden'), minedRock('ironOre', 'copper'), minedRock('copperOre', null), minedRock('goldOre', 'copper'), minedRock('goldOre', 'iron')],
    ).toEqual(['stone', 'stone', 'ironOre', 'copperOre', 'stone', 'goldOre'])
  })
  it('a gold rock takes 5 hits with an iron pickaxe (2 actions) and drops gold ore (3 hits carry on); a copper pickaxe gets stone', () => {
    expect(rockHits('goldOre')).toBe(5)
    const s = miner({ pickaxe: { tier: 'iron', durability: 1200 }, vein: { level: 4, progress: 0, rock: 'goldOre' } })
    const hit = okState(dig(s))
    expect([hit.run.vein.progress, hit.run.inventory]).toEqual([4, {}])
    const done = okState(dig(hit))
    expect([done.run.vein.progress, done.run.inventory]).toEqual([1, { goldOre: 1, coal: 1 }])
    const weak = miner({ pickaxe: { tier: 'copper', durability: 200 }, vein: { level: 4, progress: 0, rock: 'goldOre' } })
    expect(okState(dig(weak)).run.inventory).toEqual({ stone: 1 })
  })
  it('vein Lv3 drops iron ore about 1 time in 10 with a copper pickaxe', () => {
    let s = miner({ energy: 1e6, bagCapacity: 1e6, pickaxe: { tier: 'copper', durability: 1e6 }, vein: { level: 3, progress: 0, rock: 'stone' } })
    for (let i = 0; i < 3000; i++) s = okState(dig(s))
    const { stone = 0, coal = 0, copperOre = 0, ironOre = 0 } = s.run.inventory
    expect(ironOre / (stone + coal + copperOre + ironOre)).toBeGreaterThan(0.07)
    expect(ironOre / (stone + coal + copperOre + ironOre)).toBeLessThan(0.13)
  })
  it('a copper rock takes 3 hits: 2 wooden-pickaxe actions, the 4th hit carries into the next rock (batch 32)', () => {
    expect(rockHits('copperOre')).toBe(3)
    const s = miner({ vein: { level: 2, progress: 0, rock: 'copperOre' } })
    const half = okState(dig(s))
    expect([half.run.vein.progress, half.run.inventory]).toEqual([2, {}])
    const done = okState(dig(half))
    expect([done.run.vein.progress, done.run.inventory]).toEqual([1, { copperOre: 1 }])
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
  it('costs 15 stone +5 per level and 50 cash ×1.6 per level in whole numbers, max 10 (batch 21)', () => {
    expect(storageMaxLevel()).toBe(10)
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((l) => storageCost(l, meta))).toEqual([
      { stone: 15, cash: 50 },
      { stone: 20, cash: 80 },
      { stone: 25, cash: 128 },
      { stone: 30, cash: 205 },
      { stone: 35, cash: 328 },
      { stone: 40, cash: 524 },
      { stone: 45, cash: 839 },
      { stone: 50, cash: 1342 },
      { stone: 55, cash: 2147 },
      { stone: 60, cash: 3436 },
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
    expect(buyStorage(miner({ cash: 1e6, inventory: { stone: 1e3 }, storageLevel: 10 }))).toEqual({ ok: false, error: 'MAX_LEVEL' })
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
    expect(heldPickaxe(next.run)).toEqual({ tier: 'wooden', durability: 25 })
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
  it('5 copper bars + 50 cash, durability 200, 3 hits per action; joins the wooden one on the rack, whose mastery stays', () => {
    expect([pickaxeCraftCost('copper', meta), pickaxeRepairCost('copper', meta), pickaxeDurability('copper'), mineHits('copper')]).toEqual([
      { copperBar: 5, cash: 50 },
      { copperBar: 2, cash: 0 },
      200,
      3,
    ])
    const s = miner({ cash: 60, inventory: { copperBar: 6 }, mastery: { wooden: 400 }, masteredTiers: ['wooden'] })
    const next = okState(craftPickaxe(s, 'copper'))
    expect([heldPickaxe(next.run), next.run.rack.wooden, next.run.cash, next.run.inventory, next.run.mastery]).toEqual([copper(), 20, 10, { copperBar: 1 }, { wooden: 400 }])
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
    expect([heldPickaxe(next.run), next.run.inventory]).toEqual([copper(), { copperBar: 0 }])
    expect(repairPickaxe(miner({ pickaxe: copper(0), inventory: { copperBar: 1, wood: 9 } }))).toEqual({ ok: false, error: 'NOT_ENOUGH_ITEMS' })
  })
})

describe('iron pickaxe (batch 11)', () => {
  const iron = (durability = 1200) => ({ tier: 'iron' as const, durability })
  it('5 iron bars + 200 cash, durability 1200, 4 hits per action, repair 2 iron bars; joins the copper one on the rack', () => {
    expect([pickaxeCraftCost('iron', meta), pickaxeRepairCost('iron', meta), pickaxeDurability('iron'), mineHits('iron')]).toEqual([
      { ironBar: 5, cash: 200 },
      { ironBar: 2, cash: 0 },
      1200,
      4,
    ])
    const s = miner({ pickaxe: { tier: 'copper', durability: 0 }, cash: 250, inventory: { ironBar: 6 }, mastery: { copper: 30 } })
    const next = okState(craftPickaxe(s, 'iron'))
    expect([heldPickaxe(next.run), next.run.rack.copper, next.run.cash, next.run.inventory, next.run.mastery]).toEqual([iron(), 0, 50, { ironBar: 1 }, { copper: 30 }])
    expect(craftPickaxe({ ...next, run: { ...next.run, cash: 1e3, inventory: { copperBar: 9, ironBar: 9 } } }, 'copper')).toEqual({ ok: false, error: 'ALREADY_OWNED' })
    expect(craftPickaxe(miner({ cash: 1e3, inventory: { ironBar: 4 } }), 'iron')).toEqual({ ok: false, error: 'NOT_ENOUGH_ITEMS' })
    expect(craftPickaxe(miner({ cash: 199, inventory: { ironBar: 5 } }), 'iron')).toEqual({ ok: false, error: 'NO_CASH' })
    const repaired = okState(repairPickaxe(miner({ pickaxe: iron(0), inventory: { ironBar: 2, copperBar: 5 } })))
    expect([heldPickaxe(repaired.run), repaired.run.inventory]).toEqual([iron(), { ironBar: 0, copperBar: 5 }])
  })
  it('breaks an iron rock in one action and earns iron xp; iron mastery thresholds are copper × 2 (wooden × 4)', () => {
    const next = okState(dig(miner({ pickaxe: iron(), vein: { level: 3, progress: 0, rock: 'ironOre' } })))
    expect([next.run.inventory, next.run.vein.progress, next.run.mastery]).toEqual([{ ironOre: 1 }, 0, { iron: 1 }])
    expect(masteryThresholds('iron')).toEqual(masteryThresholds('wooden').map((xp) => 4 * xp))
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

describe('🧺 ore sorting (batch 28.2)', () => {
  const meta = createInitialState().meta
  const vein3 = { level: 3, progress: 0, rock: 'stone' as const }
  const price = oreSortUnlockCost('stone', meta)
  const ready = (run: Partial<GameState['run']> = {}) =>
    withRun({ mineLicense: true, vein: vein3, cash: price.cash, inventory: { stone: 30 }, bagCapacity: 60, ...run })

  it('unlock pays the kind in itself plus the cash part and starts on Keep', () => {
    expect(price).toEqual({ stone: 30, cash: price.cash })
    expect(MINE_DROP_IDS.map((k) => oreSortUnlockCost(k, meta)[k])).toEqual([30, 15, 15, 15, 10])
    const next = okState(unlockOreSort(ready(), 'stone'))
    expect(next.run.oreSort).toEqual({ stone: 'keep' })
    expect([next.run.cash, next.run.inventory.stone]).toEqual([0, 0])
  })

  it('errors in order: NO_MINE_LICENSE, LOCKED (vein below Lv3), ALREADY_OWNED, NOT_ENOUGH_ITEMS, NO_CASH', () => {
    const err = (s: GameState) => unlockOreSort(s, 'stone')
    expect(err(ready({ mineLicense: false, vein: { ...vein3, level: 2 }, oreSort: { stone: 'keep' }, inventory: {}, cash: 0 }))).toEqual({ ok: false, error: 'NO_MINE_LICENSE' })
    expect(err(ready({ vein: { ...vein3, level: 2 }, oreSort: { stone: 'keep' }, inventory: {}, cash: 0 }))).toEqual({ ok: false, error: 'LOCKED' })
    expect(err(ready({ oreSort: { stone: 'keep' }, inventory: {}, cash: 0 }))).toEqual({ ok: false, error: 'ALREADY_OWNED' })
    expect(err(ready({ inventory: { stone: 29 }, cash: 0 }))).toEqual({ ok: false, error: 'NOT_ENOUGH_ITEMS' })
    expect(err(ready({ cash: price.cash - 1 }))).toEqual({ ok: false, error: 'NO_CASH' })
  })

  it('a locked kind cannot be toggled; an unlocked one flips for free', () => {
    expect(setOreSort(ready(), 'coal', 'sell')).toEqual({ ok: false, error: 'LOCKED' })
    const s = ready({ oreSort: { coal: 'keep' }, energy: 0 })
    const next = okState(setOreSort(s, 'coal', 'sell'))
    expect(next.run.oreSort).toEqual({ coal: 'sell' })
    expect([next.run.cash, next.run.energy]).toEqual([s.run.cash, 0])
  })

  // by hand on a stone rock 1 hit in: this press breaks it
  const full = (mode: 'keep' | 'sell') =>
    withRun({ mineLicense: true, vein: { ...vein3, progress: 1 }, cash: 0, inventory: { stone: 20 }, bagCapacity: 20, oreSort: { stone: mode } })

  it('a Sell stone drop on a full storage sells it: + its sell price, sales + 1, storage unchanged', () => {
    const s = full('sell')
    const next = okState(dig(s))
    expect(next.run.cash).toBe(itemSellPrice('stone', meta, 0))
    expect(next.run.counters).toMatchObject({ sales: s.run.counters.sales + 1, mines: s.run.counters.mines + 1 })
    expect(next.run.lifetime.cashEarned).toBe(s.run.lifetime.cashEarned + itemSellPrice('stone', meta, 0))
    expect(next.run.inventory).toEqual(s.run.inventory)
  })

  it('a Keep kind on a full storage still fails BAG_FULL', () => {
    expect(dig(full('keep'))).toEqual({ ok: false, error: 'BAG_FULL' })
  })

  it('Sell and Keep runs make identical rolls (same rocks, rng and pickaxe wear)', () => {
    const run = (mode: 'keep' | 'sell') => {
      let s = withRun({ mineLicense: true, vein: vein3, energy: 100, bagCapacity: 500, oreSort: { stone: mode }, pickaxe: { tier: 'copper', durability: 200 } })
      for (let i = 0; i < 60; i++) s = okState(dig(s))
      return s.run
    }
    const [keep, sell] = [run('keep'), run('sell')]
    expect([sell.vein, sell.rngState, sell.rack, sell.counters.mines]).toEqual([keep.vein, keep.rngState, keep.rack, keep.counters.mines])
    expect(keep.inventory.stone).toBeGreaterThan(0)
    expect(sell.inventory.stone ?? 0).toBe(0)
    expect(sell.counters.sales).toBe(keep.inventory.stone)
  })

  it('prestige clears oreSort', () => {
    const s = createInitialState()
    const gate: GameState = {
      ...s,
      run: {
        ...s.run,
        oreSort: { stone: 'sell', coal: 'keep' },
        lifetime: { ...s.run.lifetime, cashEarned: 640_000 },
        workers: { ...s.run.workers, certificates: ['plant', 'harvest'] },
        workshop: { built: true, beds: [true, false, false, false], valve: false },
      },
    }
    expect(okState(sellFarm(gate)).run.oreSort).toEqual({})
  })
})
