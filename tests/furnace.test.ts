import { describe, expect, it } from 'vitest'
import type { ActionResult } from '../src/core/actions'
import {
  BAG_CAPACITY_START,
  OFFLINE_CAP_TICKS,
  barTicks,
  furnaceCost,
  furnaceQueueCap,
  furnaceVeinLevel,
  isSellable,
  smeltFuel,
  smeltOre,
} from '../src/core/balance'
import { advanceFurnace, buildFurnace, collectBars, enqueueSmelt, setAutoSmelt } from '../src/core/furnace'
import { bagCount, sellItem } from '../src/core/mining'
import { createInitialState, type GameState } from '../src/core/state'
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
    expect(next.run.furnace).toEqual({ built: true, queue: 0, progress: 0, ready: 0 })
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

const built = { built: true, queue: 0, progress: 0, ready: 0 }
const smelter = (run: Partial<GameState['run']> = {}) => withRun({ furnace: built, ...run })

describe('enqueueSmelt', () => {
  it('pays 2 copper ore + 1 coal or 2 wood now, queues one job, no energy', () => {
    expect([smeltOre(), smeltFuel('coal'), smeltFuel('wood'), barTicks(), furnaceQueueCap()]).toEqual([2, 1, 2, 60, 5])
    const s = smelter({ inventory: { copperOre: 5, coal: 1, wood: 2 } })
    const coal = okState(enqueueSmelt(s, 'coal'))
    expect([coal.run.inventory, coal.run.furnace.queue, coal.run.energy]).toEqual([{ copperOre: 3, coal: 0, wood: 2 }, 1, s.run.energy])
    const wood = okState(enqueueSmelt(coal, 'wood'))
    expect([wood.run.inventory, wood.run.furnace.queue]).toEqual([{ copperOre: 1, coal: 0, wood: 0 }, 2])
  })

  it('validates furnace, full queue (queued + tray), ore, fuel in that order', () => {
    const rich = { inventory: { copperOre: 99, coal: 99, wood: 99 } }
    expect(enqueueSmelt(withRun(rich), 'coal')).toEqual({ ok: false, error: 'NO_FURNACE' })
    expect(enqueueSmelt(smelter({ ...rich, furnace: { ...built, queue: 5 } }), 'coal')).toEqual({ ok: false, error: 'QUEUE_FULL' })
    expect(enqueueSmelt(smelter({ ...rich, furnace: { ...built, queue: 3, ready: 2 } }), 'coal')).toEqual({ ok: false, error: 'QUEUE_FULL' })
    expect(enqueueSmelt(smelter({ inventory: { copperOre: 1, coal: 9 } }), 'coal')).toEqual({ ok: false, error: 'NOT_ENOUGH_ORE' })
    expect(enqueueSmelt(smelter({ inventory: { copperOre: 2, wood: 1, coal: 9 } }), 'wood')).toEqual({ ok: false, error: 'NOT_ENOUGH_FUEL' })
    expect(enqueueSmelt(smelter({ inventory: { copperOre: 2, wood: 9 } }), 'coal')).toEqual({ ok: false, error: 'NOT_ENOUGH_FUEL' })
  })
})

describe('advanceFurnace / step', () => {
  it('finishes one bar per 60 ticks into the tray, then idles with progress 0', () => {
    const f = { ...built, queue: 2 }
    expect(advanceFurnace(f, 59)).toEqual({ ...built, queue: 2, progress: 59 })
    expect(advanceFurnace(f, 60)).toEqual({ ...built, queue: 1, ready: 1, progress: 0 })
    expect(advanceFurnace(f, 150)).toEqual({ ...built, queue: 0, ready: 2, progress: 0 })
    expect(advanceFurnace(built, 500)).toBe(built)
  })

  it('one call over n ticks equals n calls of 1 tick, for the helper and for step()', () => {
    const f = { ...built, queue: 4, progress: 13, ready: 1 }
    for (const n of [0, 1, 46, 47, 107, 200, 1000]) {
      let one = f
      for (let i = 0; i < n; i++) one = advanceFurnace(one, 1)
      expect(advanceFurnace(f, n)).toEqual(one)
    }
    const s = smelter({ furnace: f })
    let ticked = s
    for (let i = 0; i < 300; i++) ticked = step(ticked, 1)
    expect(step(s, 300)).toEqual(ticked)
    expect(ticked.run.furnace).toEqual({ ...built, queue: 0, progress: 0, ready: 5 })
  })

  it('8 h of offline catch-up with a full queue gives 5 bars and progress 0', () => {
    const s = smelter({ furnace: { ...built, queue: 5 } })
    expect(catchUp(s, OFFLINE_CAP_TICKS * 1000).run.furnace).toEqual({ ...built, queue: 0, progress: 0, ready: 5 })
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

describe('auto-smelt', () => {
  it('is a free toggle once the furnace is built, off in a new run', () => {
    expect(createInitialState().run.autoSmelt).toBe(false)
    expect(setAutoSmelt(withRun({}), true)).toEqual({ ok: false, error: 'NO_FURNACE' })
    const on = okState(setAutoSmelt(smelter({ cash: 7 }), true))
    expect([on.run.autoSmelt, on.run.cash]).toEqual([true, 7])
    expect(okState(setAutoSmelt(on, false)).run.autoSmelt).toBe(false)
  })

  it('off: step never queues or collects', () => {
    const s = smelter({ inventory: { copperOre: 4, coal: 2 }, furnace: { ...built, ready: 1 } })
    expect(step(s, 10).run.inventory).toEqual(s.run.inventory)
    expect(step(s, 10).run.furnace).toEqual(s.run.furnace)
  })

  it('on: queues coal jobs while ore, coal and room last, never wood, and collects bars into storage', () => {
    const s = smelter({ autoSmelt: true, inventory: { copperOre: 7, coal: 2, wood: 6 } })
    const next = step(s, 1)
    expect(next.run.inventory).toEqual({ copperOre: 3, coal: 0, wood: 6 })
    expect(next.run.furnace.queue).toBe(2)
    const done = step(s, 2 * barTicks() + 1)
    expect(done.run.furnace).toEqual(built)
    expect(done.run.inventory).toEqual({ copperOre: 3, coal: 0, wood: 6, copperBar: 2 })
    expect(done.run.lifetime.bars).toBe(2)
  })

  it('collects first, so a full tray frees room for new jobs; a full storage leaves bars in the tray', () => {
    const tray = smelter({ autoSmelt: true, furnace: { ...built, ready: 5 }, inventory: { copperOre: 2, coal: 1 } })
    const next = step(tray, 1)
    expect([next.run.inventory.copperBar, next.run.furnace.ready, next.run.furnace.queue]).toEqual([5, 0, 1])
    const full = smelter({ autoSmelt: true, furnace: { ...built, ready: 2 }, inventory: { stone: BAG_CAPACITY_START } })
    expect(step(full, 3).run.furnace.ready).toBe(2)
  })

  it('uses only what is in storage: step(s, n) equals n × step(s, 1), with ore arriving between ticks', () => {
    const s = smelter({ autoSmelt: true, inventory: { copperOre: 9, coal: 3, wood: 4 }, furnace: { ...built, queue: 1, progress: 30 } })
    let one = s
    for (let i = 0; i < 400; i++) one = step(one, 1)
    expect(step(s, 400)).toEqual(one)
    // 1 queued + 3 coal jobs = 4 bars; 3 ore left (no coal for them), wood untouched
    expect(one.run.inventory).toEqual({ copperOre: 3, coal: 0, wood: 4, copperBar: 4 })
    // coal that arrives later (e.g. from mining between ticks) is picked up on the next tick
    const more: GameState = { ...one, run: { ...one.run, inventory: { ...one.run.inventory, coal: 1 } } }
    let a = more
    for (let i = 0; i < 100; i++) a = step(a, 1)
    expect(step(more, 100)).toEqual(a)
    expect(a.run.inventory).toMatchObject({ copperOre: 1, coal: 0, copperBar: 5 })
  })

  it('8 h of offline catch-up smelts everything storage allows', () => {
    const s = smelter({ autoSmelt: true, inventory: { copperOre: 20, coal: 10 } })
    const after = catchUp(s, OFFLINE_CAP_TICKS * 1000)
    expect(after.run.inventory).toEqual({ copperOre: 0, coal: 0, copperBar: 10 })
    expect(after.run.furnace).toEqual(built)
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
