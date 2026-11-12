import { describe, expect, it } from 'vitest'
import type { ActionResult } from '../src/core/actions'
import {
  BAG_CAPACITY_START,
  FURNACE_UPGRADE_IDS,
  OFFLINE_CAP_TICKS,
  barTicks,
  batchBars,
  certificateCost,
  furnaceSpeedRate,
  furnaceUpgradeCost,
  furnaceUpgradeMaxLevel,
  fireCapTicks,
  fireCapUnits,
  fireUnitTicks,
  fuelUnits,
  furnaceCost,
  furnaceTrayCap,
  furnaceVeinLevel,
  isSellable,
  moldPrice,
  oreBar,
  oreSlotCap,
  smeltFuel,
  smeltOre,
} from '../src/core/balance'
import type { OreId } from '../src/core/data/items'
import { addFuel, batchLocked, buildFurnace, buyFurnaceUpgrade, buyMold, collectAll, collectBars, furnaceUpgradeLevel, loadOre, moldSmelting } from '../src/core/furnace'
import { bagCount, sellItem } from '../src/core/mining'
import { createFurnace, createInitialState, type Furnace, type GameState, type Mold } from '../src/core/state'
import { step } from '../src/core/step'
import { catchUp } from '../src/save/serialize'

function withRun(run: Partial<GameState['run']>): GameState {
  const s = createInitialState()
  return { ...s, run: { ...s.run, mineLicense: true, ...run } }
}

function okState(r: ActionResult): GameState {
  if (!r.ok) throw new Error(`expected ok, got ${r.error}`)
  return r.state
}

const meta = createInitialState().meta
const veinLv1 = { level: 1, progress: 0, rock: 'stone' as const }
const BASE_LEVELS = { fireCap: 0, batch: 0, speed: 0, tray: 0, slot: 0 }
const EMPTY: Mold = { ore: 0, progress: 0, ready: 0 }

describe('buildFurnace', () => {
  it('costs 20 stone + 5 coal + 150 cash, needs vein Lv1, no energy; comes with an empty copper mold', () => {
    expect([furnaceCost(meta), furnaceVeinLevel()]).toEqual([{ stone: 20, coal: 5, cash: 150 }, 1])
    const s = withRun({ cash: 160, inventory: { stone: 21, coal: 5 }, vein: veinLv1 })
    const next = okState(buildFurnace(s))
    expect(next.run.furnace).toEqual({ ...createFurnace(), built: true })
    expect(next.run.furnace.molds).toEqual({ copperOre: EMPTY })
    expect([next.run.cash, next.run.inventory, next.run.energy]).toEqual([10, { stone: 1, coal: 0 }, s.run.energy])
    expect(buildFurnace(next)).toEqual({ ok: false, error: 'ALREADY_OWNED' })
  })

  it('validates owned, vein level, items, cash in that order', () => {
    const rich = { cash: 1e6, inventory: { stone: 99, coal: 99 } }
    expect(buildFurnace(withRun({ ...rich, vein: { ...veinLv1, level: 0 } }))).toEqual({ ok: false, error: 'LOCKED' })
    expect(buildFurnace(withRun({ cash: 1e6, inventory: { stone: 99, coal: 4 }, vein: veinLv1 }))).toEqual({ ok: false, error: 'NOT_ENOUGH_ITEMS' })
    expect(buildFurnace(withRun({ cash: 1e6, inventory: { stone: 19, coal: 9 }, vein: veinLv1 }))).toEqual({ ok: false, error: 'NOT_ENOUGH_ITEMS' })
    expect(buildFurnace(withRun({ ...rich, cash: 149, vein: veinLv1 }))).toEqual({ ok: false, error: 'NO_CASH' })
  })

  it('fits the storage the player has when it becomes buyable (vein Lv1 comes after storage Lv1: 30 slots)', () => {
    const { cash, ...items } = furnaceCost(meta)
    expect(cash).toBeGreaterThan(0)
    expect(Object.values(items).reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(30)
  })
})

const built: Furnace = { ...createFurnace(), built: true }
const smelter = (run: Partial<GameState['run']> = {}) => withRun({ furnace: built, ...run })
/** a built furnace with these molds (each a partial over an empty mold) and furnace fields */
const molds = (m: Partial<Record<OreId, Partial<Mold>>>) =>
  Object.fromEntries(Object.entries(m).map(([k, v]) => [k, { ...EMPTY, ...v }])) as Furnace['molds']
const F = (f: Partial<Furnace> = {}, m: Partial<Record<OreId, Partial<Mold>>> = { copperOre: {} }): Furnace => ({ ...built, ...f, molds: molds(m) })
const furnace = (f: Partial<Furnace> = {}, m: Partial<Record<OreId, Partial<Mold>>> = { copperOre: {} }, run: Partial<GameState['run']> = {}) =>
  smelter({ furnace: F(f, m), ...run })
/** n single steps, the reference every step(s, n) must equal */
function oneByOne(s: GameState, n: number): GameState {
  for (let i = 0; i < n; i++) s = step(s, 1)
  return s
}

describe('fuelled furnace: balance', () => {
  it('2 ore per bar, a cycle burns 60 ticks = 2 units = 1 coal or 2 wood; cap 10 units, tray 5, ore slot 12', () => {
    expect([smeltOre(), barTicks(), fireUnitTicks(), fuelUnits('coal'), fuelUnits('wood')]).toEqual([2, 60, 30, 2, 1])
    expect([smeltFuel('coal'), smeltFuel('wood')]).toEqual([1, 2])
    expect([fireCapUnits(0), fireCapTicks(0), batchBars(0), furnaceTrayCap(0), oreSlotCap(0)]).toEqual([10, 300, 1, 5, 12])
  })

  it('batch 33 tables: fire 10 → 160 units, batch 1 → 5 bars, tray 5 / 10 / 20, ore slot 12 / 24 / 48, speed 1 / 1.25 / 1.5625', () => {
    expect([0, 1, 2, 3, 4].map(fireCapUnits)).toEqual([10, 20, 40, 80, 160])
    expect([0, 1, 2, 3, 4].map(batchBars)).toEqual([1, 2, 3, 4, 5])
    expect([0, 1, 2].map(furnaceTrayCap)).toEqual([5, 10, 20])
    expect([0, 1, 2].map(oreSlotCap)).toEqual([12, 24, 48])
    expect([0, 1, 2].map(furnaceSpeedRate)).toEqual([1, 1.25, 1.5625])
  })

  it('each slot level holds two cycles of the top batch it allows, so a slot short of a cycle has room for a whole one', () => {
    // slot 12 ↔ batch 3 (the top batch with no lock); slot 24 and 48 ↔ batch 5 (needs slot Lv1)
    expect(oreSlotCap(0)).toBeGreaterThanOrEqual(2 * smeltOre() * batchBars(2))
    for (const l of [1, 2]) expect(oreSlotCap(l)).toBeGreaterThanOrEqual(2 * smeltOre() * batchBars(furnaceUpgradeMaxLevel('batch')))
  })
})

describe('addFuel', () => {
  it('fills with as many whole items as fit under the cap, partial when storage runs short, no energy', () => {
    const s = smelter({ inventory: { coal: 9, wood: 3 } })
    const coal = okState(addFuel(s, 'coal'))
    expect([coal.run.furnace.fire, coal.run.inventory.coal, coal.run.energy]).toEqual([300, 4, s.run.energy])
    expect(addFuel(coal, 'coal')).toEqual({ ok: false, error: 'FULL' })
    const short = okState(addFuel(smelter({ inventory: { wood: 3 } }), 'wood'))
    expect([short.run.furnace.fire, short.run.inventory.wood]).toEqual([90, 0])
  })

  it('never goes over the cap: a part-burnt fire takes wood where a coal no longer fits', () => {
    const s = furnace({ fire: 250 })
    expect(addFuel({ ...s, run: { ...s.run, inventory: { coal: 5, wood: 5 } } }, 'coal')).toEqual({ ok: false, error: 'FULL' })
    const wood = okState(addFuel({ ...s, run: { ...s.run, inventory: { coal: 5, wood: 5 } } }, 'wood'))
    expect([wood.run.furnace.fire, wood.run.inventory.wood]).toEqual([280, 4])
  })

  it('max limits the items added (one coal for a loader)', () => {
    const one = okState(addFuel(smelter({ inventory: { coal: 9 } }), 'coal', 1))
    expect([one.run.furnace.fire, one.run.inventory.coal]).toEqual([60, 8])
  })

  it('validates furnace, full fire, no fuel in that order', () => {
    expect(addFuel(withRun({ inventory: { coal: 9 } }), 'coal')).toEqual({ ok: false, error: 'NO_FURNACE' })
    expect(addFuel(furnace({ fire: 300 }), 'wood')).toEqual({ ok: false, error: 'FULL' })
    expect(addFuel(smelter({ inventory: { wood: 9 } }), 'coal')).toEqual({ ok: false, error: 'NO_FUEL' })
  })
})

describe('loadOre', () => {
  it("moves ore of the kind from storage into its mold's slot, as much as fits, at most max", () => {
    const s = smelter({ inventory: { copperOre: 14 } })
    const full = okState(loadOre(s, 'copperOre'))
    expect([full.run.furnace.molds.copperOre!.ore, full.run.inventory.copperOre]).toEqual([12, 2])
    expect(loadOre(full, 'copperOre')).toEqual({ ok: false, error: 'FULL' })
    const two = okState(loadOre(s, 'copperOre', 2))
    expect([two.run.furnace.molds.copperOre!.ore, two.run.inventory.copperOre]).toEqual([2, 12])
    // slot Lv1 holds 24
    const big = okState(loadOre(furnace({ levels: { ...BASE_LEVELS, slot: 1 } }, { copperOre: {} }, { inventory: { copperOre: 30 } }), 'copperOre'))
    expect(big.run.furnace.molds.copperOre!.ore).toBe(24)
  })

  it('validates furnace, owned mold, full slot, no ore in that order', () => {
    expect(loadOre(withRun({ inventory: { copperOre: 9 } }), 'copperOre')).toEqual({ ok: false, error: 'NO_FURNACE' })
    expect(loadOre(smelter({ inventory: { ironOre: 9 } }), 'ironOre')).toEqual({ ok: false, error: 'LOCKED' })
    expect(loadOre(furnace({}, { copperOre: { ore: 12 } }), 'copperOre')).toEqual({ ok: false, error: 'FULL' })
    expect(loadOre(smelter(), 'copperOre')).toEqual({ ok: false, error: 'NO_ORE' })
  })
})

describe('fuelled furnace: step', () => {
  it('one cycle burns 60 ticks of fire and turns 2 ore into a bar; the ore leaves the slot when the cycle completes', () => {
    const s = furnace({ fire: 60 }, { copperOre: { ore: 3 } })
    expect(step(s, 59).run.furnace).toEqual(F({ fire: 1 }, { copperOre: { ore: 3, progress: 59 } }))
    const done = step(s, 60)
    expect(done.run.furnace).toEqual(F({ fire: 0 }, { copperOre: { ore: 1, ready: 1 } }))
    expect(done.run.lifetime).toMatchObject({ fireBurnt: 60, fireWasted: 0, barsSmelted: 1 })
  })

  it('a plain furnace with no mold smelting burns 1 per tick (wasted), bounded by one tank; a smart one burns 0', () => {
    const noOre = step(furnace({ fire: 300 }), 1000)
    expect(noOre.run.furnace).toEqual(built)
    expect(noOre.run.lifetime).toMatchObject({ fireBurnt: 300, fireWasted: 300, barsSmelted: 0 })
    const trayFull = step(furnace({ fire: 100 }, { copperOre: { ore: 4, ready: 5 } }), 10)
    expect(trayFull.run.furnace).toEqual(F({ fire: 90 }, { copperOre: { ore: 4, ready: 5 } }))
    expect(trayFull.run.lifetime.fireWasted).toBe(10)
    expect(step(furnace({ fire: 300, smart: true }), 1000).run.furnace).toEqual(F({ fire: 300, smart: true }))
  })

  it('a smart furnace burns only while a mold smelts', () => {
    const s = furnace({ fire: 300, smart: true }, { copperOre: { ore: 2 } })
    const after = step(s, 1000)
    expect(after.run.furnace).toEqual(F({ fire: 240, smart: true }, { copperOre: { ready: 1 } }))
    expect(after.run.lifetime).toMatchObject({ fireBurnt: 60, fireWasted: 0 })
  })

  it('fire running out mid-cycle pauses it; new fuel resumes it where it stopped', () => {
    const paused = step(furnace({ fire: 30 }, { copperOre: { ore: 2 } }), 100)
    expect(paused.run.furnace).toEqual(F({}, { copperOre: { ore: 2, progress: 30 } }))
    const refuelled = okState(addFuel({ ...paused, run: { ...paused.run, inventory: { wood: 1 } } }, 'wood'))
    expect(step(refuelled, 30).run.furnace).toEqual(F({}, { copperOre: { ready: 1 } }))
  })

  it('batch level 1: a cycle takes 4 ore and makes 2 bars for the same fire, and needs tray room for both', () => {
    const levels = { ...BASE_LEVELS, batch: 1 }
    expect(step(furnace({ fire: 60, levels }, { copperOre: { ore: 4 } }), 60).run.furnace).toEqual(F({ levels }, { copperOre: { ready: 2 } }))
    expect(moldSmelting(F({ levels, fire: 60 }, { copperOre: { ore: 3 } }), 'copperOre')).toBe(false)
    expect(moldSmelting(F({ levels, fire: 60 }, { copperOre: { ore: 4, ready: 4 } }), 'copperOre')).toBe(false)
    expect(moldSmelting(F({ levels, fire: 60 }, { copperOre: { ore: 4, ready: 3 } }), 'copperOre')).toBe(true)
    expect(moldSmelting(F({ levels, fire: 60 }, { copperOre: { ore: 4 } }), 'ironOre')).toBe(false)
  })

  it('two molds smelt at once on one fire; fire out stops both; a full copper tray does not stop gold', () => {
    const both = step(furnace({ fire: 120 }, { copperOre: { ore: 2 }, ironOre: { ore: 2 } }), 60)
    expect(both.run.furnace).toEqual(F({ fire: 0 }, { copperOre: { ready: 1 }, ironOre: { ore: 2, progress: 60 } }))
    expect(both.run.lifetime).toMatchObject({ fireBurnt: 120, barsSmelted: 1, ironBarsSmelted: 0 })
    // fire out: neither mold moves
    expect(step(both, 50).run.furnace).toEqual(both.run.furnace)
    const goldOn = step(furnace({ fire: 300 }, { copperOre: { ore: 4, ready: 5 }, goldOre: { ore: 2 } }), 180)
    expect(goldOn.run.furnace).toEqual(F({ fire: 120 }, { copperOre: { ore: 4, ready: 5 }, goldOre: { ready: 1 } }))
    expect(goldOn.run.lifetime).toMatchObject({ fireWasted: 0, goldBarsSmelted: 1 })
  })

  it('speed Lv2: a copper cycle ends on tick 39 and the 2nd on tick 77 (overflow carried); fire burnt per cycle 60', () => {
    const levels = { ...BASE_LEVELS, speed: 2, fireCap: 2 }
    const s = furnace({ fire: 1200, levels }, { copperOre: { ore: 6 } })
    expect(step(s, 38).run.furnace.molds.copperOre!.ready).toBe(0)
    expect(step(s, 39).run.furnace.molds.copperOre!.ready).toBe(1)
    expect(step(s, 76).run.furnace.molds.copperOre!.ready).toBe(1)
    const two = step(s, 77)
    expect(two.run.furnace.molds.copperOre!.ready).toBe(2)
    // 77 ticks × 1.5625 = 120.3125 fire: two cycles of 60 plus 0.3125 carried into the third
    expect(two.run.lifetime.fireBurnt).toBe(77 * 1.5625)
    expect(two.run.furnace.molds.copperOre!.progress).toBe(77 * 1.5625 - 120)
    // the cycle seconds the UI shows
    expect((['copperOre', 'ironOre', 'goldOre'] as const).flatMap((o) => [0, 1, 2].map((l) => Math.ceil(barTicks(o) / furnaceSpeedRate(l))))).toEqual([
      60, 48, 39, 120, 96, 77, 180, 144, 116,
    ])
  })

  it('a fractional fire left by speed never goes negative: the last burn takes only what is left', () => {
    const s = furnace({ fire: 1, levels: { ...BASE_LEVELS, speed: 1 } }, { copperOre: { ore: 2 } })
    const a = step(s, 1)
    expect(a.run.furnace.fire).toBe(0)
    expect(a.run.furnace.molds.copperOre!.progress).toBe(1)
    const plain = step(furnace({ fire: 0.4375 }), 3)
    expect([plain.run.furnace.fire, plain.run.lifetime.fireWasted]).toEqual([0, 0.4375])
  })

  it('step(s, n) equals n × step(s, 1): fire out mid-cycle, ore out, tray filling, smart, molds, speed, and 8 h of catch-up', () => {
    const cases: [Partial<Furnace>, Partial<Record<OreId, Partial<Mold>>>][] = [
      [{ fire: 90 }, { copperOre: { ore: 10 } }], // fire runs out mid-cycle
      [{ fire: 300 }, { copperOre: { ore: 3, progress: 17 } }], // ore runs out, then the fire burns away
      [{ fire: 300 }, { copperOre: { ore: 10, ready: 3 } }], // tray fills, then wasted fire
      [{ fire: 300, smart: true }, { copperOre: { ore: 5 } }], // smart: stops burning when ore runs out
      [{ fire: 1200, levels: { ...BASE_LEVELS, fireCap: 2, batch: 2 } }, { copperOre: { ore: 10 } }],
      [{ fire: 1200, levels: { ...BASE_LEVELS, fireCap: 2, speed: 2 } }, { copperOre: { ore: 10 }, ironOre: { ore: 6 }, goldOre: { ore: 4, progress: 12 } }],
    ]
    for (const [f, m] of cases) {
      const s = furnace(f, m)
      for (const n of [1, 59, 60, 61, 200, 1300]) expect(step(s, n)).toEqual(oneByOne(s, n))
    }
    const s = furnace({ fire: 300 }, { copperOre: { ore: 10 } })
    expect(catchUp(s, OFFLINE_CAP_TICKS * 1000).run.furnace).toEqual(F({}, { copperOre: { ready: 5 } }))
  })
})

describe('furnace upgrades', () => {
  it('rows and prices (PLAN.md batch 33); smart above the fuel certificate', () => {
    expect(FURNACE_UPGRADE_IDS).toEqual(['fireCap', 'batch', 'speed', 'tray', 'slot', 'smart', 'collectAll'])
    expect(FURNACE_UPGRADE_IDS.map((id) => furnaceUpgradeMaxLevel(id))).toEqual([4, 4, 2, 2, 2, 1, 1])
    const cost = (id: (typeof FURNACE_UPGRADE_IDS)[number]) => Array.from({ length: furnaceUpgradeMaxLevel(id) + 1 }, (_, l) => furnaceUpgradeCost(id, l, meta))
    expect(cost('fireCap')).toEqual([{ copperBar: 4, cash: 150 }, { copperBar: 8, cash: 300 }, { ironBar: 6, cash: 7500 }, { goldBar: 4, cash: 7500 }, null])
    expect(cost('batch')).toEqual([{ copperBar: 6, cash: 200 }, { copperBar: 12, cash: 400 }, { ironBar: 8, cash: 7500 }, { goldBar: 5, cash: 7500 }, null])
    expect(cost('speed')).toEqual([{ ironBar: 10, cash: 7500 }, { goldBar: 8, cash: 7500 }, null])
    expect(cost('tray')).toEqual([{ stone: 30, copperBar: 8, cash: 6500 }, { ironBar: 8, cash: 7500 }, null])
    expect(cost('slot')).toEqual([{ stone: 30, copperBar: 6, cash: 6500 }, { ironBar: 6, cash: 7500 }, null])
    expect(cost('collectAll')).toEqual([{ copperBar: 10, ironBar: 5, cash: 6500 }, null])
    expect([moldPrice('ironOre', meta), moldPrice('goldOre', meta)]).toEqual([{ copperBar: 10, stone: 20, cash: 6500 }, { ironBar: 8, stone: 30, cash: 7500 }])
    const smart = furnaceUpgradeCost('smart', 0, meta)!
    const fuelCert = certificateCost('fuel', meta)
    expect(smart.copperBar!).toBeGreaterThan(fuelCert.copperBar!)
    expect(smart.cash).toBeGreaterThan(fuelCert.cash)
  })

  it('the copper-bar ladder (fire cap / batch Lv1–2, smart) fits the storage the player has once the furnace is built (storage Lv2: 40)', () => {
    for (const [id, top] of [['fireCap', 2], ['batch', 2], ['smart', 1]] as const)
      for (let l = 0; l < top; l++) {
        const { cash, ...items } = furnaceUpgradeCost(id, l, meta)!
        expect(cash).toBeGreaterThan(0)
        expect(Object.values(items).reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(40)
      }
  })

  it('buys one level at a time from storage + cash, no energy; smart and Collect all set their flags', () => {
    const s = smelter({ cash: 2000, inventory: { copperBar: 40 } })
    const cap1 = okState(buyFurnaceUpgrade(s, 'fireCap'))
    expect([cap1.run.furnace.levels, cap1.run.cash, cap1.run.inventory.copperBar, cap1.run.energy]).toEqual([{ ...BASE_LEVELS, fireCap: 1 }, 1850, 36, s.run.energy])
    const cap2 = okState(buyFurnaceUpgrade(cap1, 'fireCap'))
    expect(furnaceUpgradeLevel(cap2.run.furnace, 'fireCap')).toBe(2)
    const smart = okState(buyFurnaceUpgrade(cap2, 'smart'))
    expect([smart.run.furnace.smart, furnaceUpgradeLevel(smart.run.furnace, 'smart')]).toEqual([true, 1])
    expect(buyFurnaceUpgrade(smart, 'smart')).toEqual({ ok: false, error: 'MAX_LEVEL' })
    const batch = okState(buyFurnaceUpgrade(smart, 'batch'))
    expect(batch.run.furnace.levels).toEqual({ ...BASE_LEVELS, fireCap: 2, batch: 1 })
    // a bigger fire cap takes more fuel
    const filled = okState(addFuel({ ...batch, run: { ...batch.run, inventory: { coal: 99 } } }, 'coal'))
    expect(filled.run.furnace.fire).toBe(1200)
    const all = okState(buyFurnaceUpgrade({ ...batch, run: { ...batch.run, cash: 1e6, inventory: { copperBar: 10, ironBar: 5 } } }, 'collectAll'))
    expect([all.run.furnace.collectAll, furnaceUpgradeLevel(all.run.furnace, 'collectAll')]).toEqual([true, 1])
    expect(buyFurnaceUpgrade(all, 'collectAll')).toEqual({ ok: false, error: 'MAX_LEVEL' })
    const top = smelter({ furnace: F({ levels: { fireCap: 4, batch: 4, speed: 2, tray: 2, slot: 2 } }), cash: 1e6, inventory: { goldBar: 99, ironBar: 99 } })
    for (const id of ['fireCap', 'batch', 'speed', 'tray', 'slot'] as const) expect(buyFurnaceUpgrade(top, id)).toEqual({ ok: false, error: 'MAX_LEVEL' })
  })

  it('batch Lv1–2 have no lock; Lv3 (4 bars) and Lv4 (5 bars) are LOCKED until tray Lv1 + ore slot Lv1, then buyable', () => {
    const rich = { cash: 1e6, inventory: { copperBar: 99, ironBar: 99, goldBar: 99 } }
    const at = (levels: Partial<Furnace['levels']>) => smelter({ furnace: F({ levels: { ...BASE_LEVELS, ...levels } }), ...rich })
    expect(okState(buyFurnaceUpgrade(at({}), 'batch')).run.furnace.levels.batch).toBe(1)
    expect(okState(buyFurnaceUpgrade(at({ batch: 1 }), 'batch')).run.furnace.levels.batch).toBe(2)
    expect(buyFurnaceUpgrade(at({ batch: 2 }), 'batch')).toEqual({ ok: false, error: 'LOCKED' })
    expect(buyFurnaceUpgrade(at({ batch: 2, tray: 1 }), 'batch')).toEqual({ ok: false, error: 'LOCKED' })
    expect(buyFurnaceUpgrade(at({ batch: 2, slot: 1 }), 'batch')).toEqual({ ok: false, error: 'LOCKED' })
    const b3 = okState(buyFurnaceUpgrade(at({ batch: 2, tray: 1, slot: 1 }), 'batch'))
    expect(b3.run.furnace.levels.batch).toBe(3)
    expect(okState(buyFurnaceUpgrade(b3, 'batch')).run.furnace.levels.batch).toBe(4)
    // the rule is the balance functions': tray ≥ 2 × the new batch, slot ≥ 2 × its cycle
    for (const l of [2, 3]) {
      const ok = F({ levels: { ...BASE_LEVELS, batch: l, tray: 1, slot: 1 } })
      expect(batchLocked(ok)).toBe(!(furnaceTrayCap(1) >= 2 * batchBars(l + 1) && oreSlotCap(1) >= 2 * smeltOre() * batchBars(l + 1)))
    }
  })

  it('validates furnace, max level, lock, items, cash in that order', () => {
    expect(buyFurnaceUpgrade(withRun({ cash: 1e6, inventory: { copperBar: 99 } }), 'batch')).toEqual({ ok: false, error: 'NO_FURNACE' })
    expect(buyFurnaceUpgrade(furnace({ smart: true }), 'smart')).toEqual({ ok: false, error: 'MAX_LEVEL' })
    expect(buyFurnaceUpgrade(furnace({ levels: { ...BASE_LEVELS, batch: 2 } }), 'batch')).toEqual({ ok: false, error: 'LOCKED' })
    expect(buyFurnaceUpgrade(smelter({ cash: 1e6, inventory: { copperBar: 5 } }), 'batch')).toEqual({ ok: false, error: 'NOT_ENOUGH_ITEMS' })
    expect(buyFurnaceUpgrade(smelter({ cash: 199, inventory: { copperBar: 6 } }), 'batch')).toEqual({ ok: false, error: 'NO_CASH' })
  })
})

describe('buyMold', () => {
  it('the iron mold costs 🥉10 ⛰️20 💰6,500 and adds an empty iron mold; copper is never for sale', () => {
    const s = smelter({ cash: 7000, inventory: { copperBar: 12, stone: 20 } })
    const iron = okState(buyMold(s, 'ironOre'))
    expect([iron.run.furnace.molds, iron.run.cash, iron.run.inventory]).toEqual([{ copperOre: EMPTY, ironOre: EMPTY }, 500, { copperBar: 2, stone: 0 }])
    expect(buyMold(iron, 'ironOre')).toEqual({ ok: false, error: 'ALREADY_OWNED' })
    expect(buyMold(s, 'copperOre')).toEqual({ ok: false, error: 'ALREADY_OWNED' })
  })

  it('validates furnace, owned, items, cash in that order', () => {
    expect(buyMold(withRun({ cash: 1e6, inventory: { ironBar: 99, stone: 99 } }), 'goldOre')).toEqual({ ok: false, error: 'NO_FURNACE' })
    expect(buyMold(smelter({ cash: 1e6, inventory: { ironBar: 7, stone: 99 } }), 'goldOre')).toEqual({ ok: false, error: 'NOT_ENOUGH_ITEMS' })
    expect(buyMold(smelter({ cash: 7499, inventory: { ironBar: 8, stone: 30 } }), 'goldOre')).toEqual({ ok: false, error: 'NO_CASH' })
  })
})

describe('collectBars / collectAll', () => {
  it("moves one mold's tray bars into storage, as many as fit, and counts them", () => {
    const s = furnace({}, { copperOre: { ready: 3 } }, { inventory: { stone: BAG_CAPACITY_START - 2 } })
    const next = okState(collectBars(s, 'copperOre'))
    expect([next.run.inventory.copperBar, next.run.furnace.molds.copperOre!.ready, next.run.lifetime.bars, next.run.counters.bars]).toEqual([2, 1, 2, 2])
    expect(collectBars(next, 'copperOre')).toEqual({ ok: false, error: 'BAG_FULL' })
  })

  it('validates furnace, owned mold, empty tray, full storage in that order', () => {
    expect(collectBars(withRun({ furnace: F({ built: false }, { copperOre: { ready: 1 } }) }), 'copperOre')).toEqual({ ok: false, error: 'NO_FURNACE' })
    expect(collectBars(smelter(), 'ironOre')).toEqual({ ok: false, error: 'LOCKED' })
    expect(collectBars(smelter(), 'copperOre')).toEqual({ ok: false, error: 'NOTHING_TO_DO' })
  })

  it('Collect all needs the purchase; collects copper → iron → gold, partial when storage runs short (copper first)', () => {
    const trays = { copperOre: { ready: 3 }, ironOre: { ready: 2 }, goldOre: { ready: 1 } }
    expect(collectAll(furnace({}, trays))).toEqual({ ok: false, error: 'LOCKED' })
    const s = furnace({ collectAll: true }, trays, { inventory: { stone: BAG_CAPACITY_START - 4 } })
    const r = okState(collectAll(s))
    expect([r.run.inventory.copperBar, r.run.inventory.ironBar, r.run.inventory.goldBar]).toEqual([3, 1, undefined])
    expect(r.run.furnace.molds).toEqual(molds({ copperOre: {}, ironOre: { ready: 1 }, goldOre: { ready: 1 } }))
    expect(r.run.lifetime).toMatchObject({ bars: 3, ironBars: 1, goldBars: 0 })
    expect(collectAll(r)).toEqual({ ok: false, error: 'BAG_FULL' })
    expect(collectAll(furnace({ collectAll: true }))).toEqual({ ok: false, error: 'NOTHING_TO_DO' })
    expect(collectAll(withRun({}))).toEqual({ ok: false, error: 'NO_FURNACE' })
  })
})

describe('iron smelting (batch 11)', () => {
  const iron = (m: Partial<Mold> = {}, f: Partial<Furnace> = {}, run: Partial<GameState['run']> = {}) => furnace(f, { copperOre: {}, ironOre: m }, run)

  it('an iron cycle = 2 iron ore + 4 fire units (120 ticks: 2 coal or 4 wood) → 1 iron bar × batch', () => {
    expect([smeltOre(), barTicks('ironOre'), barTicks('copperOre'), oreBar('ironOre'), oreBar('copperOre')]).toEqual([2, 120, 60, 'ironBar', 'copperBar'])
    expect([smeltFuel('coal', 'ironOre'), smeltFuel('wood', 'ironOre')]).toEqual([2, 4])
    const s = iron({ ore: 3 }, { fire: 120 })
    expect(step(s, 119).run.furnace).toEqual(F({ fire: 1 }, { copperOre: {}, ironOre: { ore: 3, progress: 119 } }))
    const done = step(s, 120)
    expect(done.run.furnace).toEqual(F({}, { copperOre: {}, ironOre: { ore: 1, ready: 1 } }))
    expect(done.run.lifetime).toMatchObject({ fireBurnt: 120, barsSmelted: 0, ironBarsSmelted: 1 })
    const levels = { ...BASE_LEVELS, fireCap: 1, batch: 2 }
    expect(step(iron({ ore: 6 }, { fire: 120, levels }), 120).run.furnace).toEqual(F({ levels }, { copperOre: {}, ironOre: { ready: 3 } }))
  })

  it('loads each kind into its own mold, and collects iron bars (not counted as copper bars)', () => {
    const inventory = { copperOre: 5, ironOre: 4 }
    const loaded = okState(loadOre(iron({}, {}, { inventory }), 'ironOre'))
    expect([loaded.run.furnace.molds.ironOre!.ore, loaded.run.inventory]).toEqual([4, { copperOre: 5, ironOre: 0 }])
    expect(okState(loadOre(iron({}, {}, { inventory }), 'copperOre')).run.inventory).toEqual({ copperOre: 0, ironOre: 4 })
    const collected = okState(collectBars(iron({ ready: 2 }), 'ironOre'))
    expect([collected.run.inventory, collected.run.counters.bars, collected.run.lifetime.bars, collected.run.lifetime.ironBars]).toEqual([{ ironBar: 2 }, 0, 0, 2])
    expect(loadOre(iron({}, {}, { inventory: { copperOre: 5 } }), 'ironOre')).toEqual({ ok: false, error: 'NO_ORE' })
  })

  it('step(s, n) equals n × step(s, 1) on iron, plain and smart', () => {
    for (const [m, f] of [
      [{ ore: 5 }, { fire: 300 }],
      [{ ore: 5 }, { fire: 300, smart: true }],
      [{ ore: 12 }, { fire: 1200, levels: { ...BASE_LEVELS, fireCap: 2, batch: 2 } }],
    ] as [Partial<Mold>, Partial<Furnace>][]) {
      const s = iron(m, f)
      for (const n of [119, 120, 121, 700]) expect(step(s, n)).toEqual(oneByOne(s, n))
    }
  })
})

describe('gold smelting (batch 16)', () => {
  const gold = (m: Partial<Mold> = {}, f: Partial<Furnace> = {}) => furnace(f, { copperOre: {}, goldOre: m })

  it('a gold cycle = 2 gold ore + 6 fire units (180 ticks: 3 coal or 6 wood) → 1 gold bar × batch', () => {
    expect([barTicks('goldOre'), oreBar('goldOre'), smeltFuel('coal', 'goldOre'), smeltFuel('wood', 'goldOre')]).toEqual([180, 'goldBar', 3, 6])
    const s = gold({ ore: 3 }, { fire: 180 })
    expect(step(s, 179).run.furnace).toEqual(F({ fire: 1 }, { copperOre: {}, goldOre: { ore: 3, progress: 179 } }))
    const done = step(s, 180)
    expect(done.run.furnace).toEqual(F({}, { copperOre: {}, goldOre: { ore: 1, ready: 1 } }))
    expect(done.run.lifetime).toMatchObject({ fireBurnt: 180, barsSmelted: 0, ironBarsSmelted: 0, goldBarsSmelted: 1 })
  })

  it('collects gold bars into their own lifetime row, not the copper or iron counters', () => {
    const collected = okState(collectBars(gold({ ready: 2 }), 'goldOre'))
    expect([collected.run.inventory, collected.run.counters.bars, collected.run.lifetime.bars, collected.run.lifetime.ironBars, collected.run.lifetime.goldBars]).toEqual([
      { goldBar: 2 },
      0,
      0,
      0,
      2,
    ])
  })

  it('step(s, n) equals n × step(s, 1) on gold, plain and smart', () => {
    for (const f of [{ fire: 400 }, { fire: 400, smart: true }]) {
      const s = gold({ ore: 5 }, f)
      for (const n of [179, 180, 181, 700]) expect(step(s, n)).toEqual(oneByOne(s, n))
    }
  })
})

describe('copper items', () => {
  it('ore sells for 1 and takes a storage slot; bars take a slot and sell below their inputs (batch 24)', () => {
    const s = withRun({ cash: 0, inventory: { copperOre: 2, copperBar: 3 } })
    expect(bagCount(s.run)).toBe(5)
    expect(okState(sellItem(s, 'copperOre', 2)).run.cash).toBe(2)
    expect(isSellable('copperBar')).toBe(true)
    expect(okState(sellItem(s, 'copperBar', 3)).run.cash).toBe(6)
  })
})
