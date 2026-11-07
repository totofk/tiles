import { describe, expect, it } from 'vitest'
import type { ActionResult } from '../src/core/actions'
import {
  BAG_CAPACITY_START,
  OFFLINE_CAP_TICKS,
  barTicks,
  batchBars,
  fireCapTicks,
  fireCapUnits,
  fireUnitTicks,
  fuelUnits,
  furnaceCost,
  furnaceTrayCap,
  furnaceVeinLevel,
  isSellable,
  oreSlotCap,
  smeltFuel,
  smeltOre,
} from '../src/core/balance'
import { addFuel, buildFurnace, collectBars, loadOre, smelting } from '../src/core/furnace'
import { bagCount, sellItem } from '../src/core/mining'
import { createFurnace, createInitialState, type Furnace, type GameState } from '../src/core/state'
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

describe('buildFurnace', () => {
  it('costs 20 stone + 5 coal + 150 cash, needs vein Lv1, no energy', () => {
    expect([furnaceCost(meta), furnaceVeinLevel()]).toEqual([{ stone: 20, coal: 5, cash: 150 }, 1])
    const s = withRun({ cash: 160, inventory: { stone: 21, coal: 5 }, vein: veinLv1 })
    const next = okState(buildFurnace(s))
    expect(next.run.furnace).toEqual({ ...createFurnace(), built: true })
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
const furnace = (f: Partial<Furnace>) => smelter({ furnace: { ...built, ...f } })
/** n single steps, the reference every step(s, n) must equal */
function oneByOne(s: GameState, n: number): GameState {
  for (let i = 0; i < n; i++) s = step(s, 1)
  return s
}

describe('fuelled furnace: balance', () => {
  it('2 ore per bar, a cycle burns 60 ticks = 2 units = 1 coal or 2 wood; cap 10 units, tray 5, ore slot 10', () => {
    expect([smeltOre(), barTicks(), fireUnitTicks(), fuelUnits('coal'), fuelUnits('wood')]).toEqual([2, 60, 30, 2, 1])
    expect([smeltFuel('coal'), smeltFuel('wood')]).toEqual([1, 2])
    expect([fireCapUnits(0), fireCapTicks(0), batchBars(0), furnaceTrayCap(), oreSlotCap()]).toEqual([10, 300, 1, 5, 10])
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
  it('moves copper ore from storage into the slot, as much as fits, at most max', () => {
    const s = smelter({ inventory: { copperOre: 14 } })
    const full = okState(loadOre(s))
    expect([full.run.furnace.ore, full.run.inventory.copperOre]).toEqual([10, 4])
    expect(loadOre(full)).toEqual({ ok: false, error: 'FULL' })
    const two = okState(loadOre(s, 2))
    expect([two.run.furnace.ore, two.run.inventory.copperOre]).toEqual([2, 12])
  })

  it('validates furnace, full slot, no ore in that order', () => {
    expect(loadOre(withRun({ inventory: { copperOre: 9 } }))).toEqual({ ok: false, error: 'NO_FURNACE' })
    expect(loadOre(furnace({ ore: 10 }))).toEqual({ ok: false, error: 'FULL' })
    expect(loadOre(smelter())).toEqual({ ok: false, error: 'NO_ORE' })
  })
})

describe('fuelled furnace: step', () => {
  it('one cycle burns 60 ticks of fire and turns 2 ore into a bar; the ore leaves the slot when the cycle completes', () => {
    const s = furnace({ fire: 60, ore: 3 })
    expect(step(s, 59).run.furnace).toEqual({ ...built, fire: 1, ore: 3, progress: 59 })
    const done = step(s, 60)
    expect(done.run.furnace).toEqual({ ...built, fire: 0, ore: 1, progress: 0, ready: 1 })
    expect(done.run.lifetime).toMatchObject({ fireBurnt: 60, fireWasted: 0, barsSmelted: 1 })
  })

  it('a plain furnace burns whenever lit: no ore or a full tray wastes fire, bounded by one tank', () => {
    const noOre = step(furnace({ fire: 300 }), 1000)
    expect(noOre.run.furnace).toEqual(built)
    expect(noOre.run.lifetime).toMatchObject({ fireBurnt: 300, fireWasted: 300, barsSmelted: 0 })
    const trayFull = step(furnace({ fire: 100, ore: 4, ready: 5 }), 10)
    expect(trayFull.run.furnace).toEqual({ ...built, fire: 90, ore: 4, ready: 5 })
    expect(trayFull.run.lifetime.fireWasted).toBe(10)
  })

  it('a smart furnace burns only while a cycle progresses', () => {
    expect(step(furnace({ fire: 300, smart: true }), 1000).run.furnace).toEqual({ ...built, fire: 300, smart: true })
    const s = furnace({ fire: 300, ore: 2, smart: true })
    const after = step(s, 1000)
    expect(after.run.furnace).toEqual({ ...built, fire: 240, ready: 1, smart: true })
    expect(after.run.lifetime).toMatchObject({ fireBurnt: 60, fireWasted: 0 })
  })

  it('fire running out mid-cycle pauses it; new fuel resumes it where it stopped', () => {
    const paused = step(furnace({ fire: 30, ore: 2 }), 100)
    expect(paused.run.furnace).toEqual({ ...built, ore: 2, progress: 30 })
    const refuelled = okState(addFuel({ ...paused, run: { ...paused.run, inventory: { wood: 1 } } }, 'wood'))
    expect(step(refuelled, 30).run.furnace).toEqual({ ...built, ready: 1 })
  })

  it('batch level 1: a cycle takes 4 ore and makes 2 bars for the same fire, and needs tray room for both', () => {
    const levels = { fireCap: 0, batch: 1 }
    expect(step(furnace({ fire: 60, ore: 4, levels }), 60).run.furnace).toEqual({ ...built, levels, ready: 2 })
    expect(smelting({ ...built, levels, fire: 60, ore: 3 })).toBe(false)
    expect(smelting({ ...built, levels, fire: 60, ore: 4, ready: 4 })).toBe(false)
    expect(smelting({ ...built, levels, fire: 60, ore: 4, ready: 3 })).toBe(true)
  })

  it('step(s, n) equals n × step(s, 1): fire out mid-cycle, ore out, tray filling, smart, and 8 h of catch-up', () => {
    const cases: Partial<Furnace>[] = [
      { fire: 90, ore: 10 }, // fire runs out mid-cycle
      { fire: 300, ore: 3, progress: 17 }, // ore runs out, then the fire burns away
      { fire: 300, ore: 10, ready: 3 }, // tray fills, then wasted fire
      { fire: 300, ore: 5, smart: true }, // smart: stops burning when ore runs out
      { fire: 1200, ore: 10, levels: { fireCap: 2, batch: 2 } },
    ]
    for (const f of cases) {
      const s = furnace(f)
      for (const n of [1, 59, 60, 61, 200, 1300]) expect(step(s, n)).toEqual(oneByOne(s, n))
    }
    const s = furnace({ fire: 300, ore: 10 })
    expect(catchUp(s, OFFLINE_CAP_TICKS * 1000).run.furnace).toEqual({ ...built, ready: 5 })
  })
})

describe('collectBars', () => {
  it('moves tray bars into storage, as many as fit, and counts them', () => {
    const s = smelter({ furnace: { ...built, ready: 3 }, inventory: { stone: BAG_CAPACITY_START - 2 } })
    const next = okState(collectBars(s))
    expect([next.run.inventory.copperBar, next.run.furnace.ready, next.run.lifetime.bars]).toEqual([2, 1, 2])
    expect(collectBars(next)).toEqual({ ok: false, error: 'BAG_FULL' })
  })

  it('validates furnace, empty tray, full storage in that order', () => {
    expect(collectBars(withRun({ furnace: { ...built, built: false, ready: 1 } }))).toEqual({ ok: false, error: 'NO_FURNACE' })
    expect(collectBars(smelter())).toEqual({ ok: false, error: 'NOTHING_TO_DO' })
  })
})

describe('copper items', () => {
  it('ore sells for 1 and takes a storage slot; bars take a slot and have no sell path', () => {
    const s = withRun({ cash: 0, inventory: { copperOre: 2, copperBar: 3 } })
    expect(bagCount(s.run)).toBe(5)
    expect(okState(sellItem(s, 'copperOre', 2)).run.cash).toBe(2)
    expect(isSellable('copperBar')).toBe(false)
    expect(sellItem(s, 'copperBar', 1)).toEqual({ ok: false, error: 'NOT_SELLABLE' })
  })
})
