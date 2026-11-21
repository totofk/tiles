import { describe, expect, it } from 'vitest'
import type { ActionResult } from '../src/core/actions'
import { FORGE_CYCLE_TICKS, FORGE_TRAY, itemSellPrice, orderBonus } from '../src/core/balance'
import { buildForge, collectForge, loadForge, setForgeRecipe } from '../src/core/forge'
import { bagCount } from '../src/core/mining'
import { itemOrderValue, orderPerMinute, orderPool } from '../src/core/orders'
import { createInitialState, type GameState, type RunState } from '../src/core/state'
import { step } from '../src/core/step'

const ok = (r: ActionResult): GameState => {
  if (!r.ok) throw new Error(r.error)
  return r.state
}
const base = createInitialState()
const iron = (run: Partial<RunState> = {}): GameState => ({
  ...base,
  run: {
    ...base.run,
    listing: { district: 'ironHills', soil: null },
    cash: 100_000,
    bagCapacity: 200,
    furnace: { ...base.run.furnace, built: true },
    inventory: { stone: 30, coal: 10, copperBar: 5 },
    ...run,
  },
})
/** an Iron Hills run with the forge built and this storage */
const forged = (inventory: RunState['inventory'] = {}, forge: Partial<RunState['forge']> = {}): GameState => {
  const s = ok(buildForge(iron()))
  return { ...s, run: { ...s.run, inventory, forge: { ...s.run.forge, ...forge } } }
}

describe('batch 36.2: the 🔨 forge', () => {
  it('buildForge errors in order: LOCKED (district), ALREADY_OWNED, NO_FURNACE, NOT_ENOUGH_ITEMS, NO_CASH; pays ⛰️30 ⚫10 🥉5 💰1,500', () => {
    expect(buildForge({ ...iron(), run: { ...iron().run, listing: { district: 'plain', soil: null } } })).toEqual({ ok: false, error: 'LOCKED' })
    expect(buildForge(forged())).toEqual({ ok: false, error: 'ALREADY_OWNED' })
    expect(buildForge(iron({ furnace: base.run.furnace }))).toEqual({ ok: false, error: 'NO_FURNACE' })
    expect(buildForge(iron({ inventory: { stone: 30, coal: 10, copperBar: 4 } }))).toEqual({ ok: false, error: 'NOT_ENOUGH_ITEMS' })
    expect(buildForge(iron({ cash: 1499 }))).toEqual({ ok: false, error: 'NO_CASH' })
    const built = ok(buildForge(iron()))
    expect(built.run.forge.built).toBe(true)
    expect([built.run.cash, built.run.inventory]).toEqual([100_000 - 1500, { stone: 0, coal: 0, copperBar: 0 }])
  })

  it('recipe / load / collect errors', () => {
    const unbuilt = iron()
    expect(setForgeRecipe(unbuilt, 'toolbox')).toEqual({ ok: false, error: 'LOCKED' })
    expect(loadForge(unbuilt)).toEqual({ ok: false, error: 'LOCKED' })
    expect(collectForge(unbuilt)).toEqual({ ok: false, error: 'LOCKED' })
    expect(loadForge(forged({ copperBar: 9, coal: 9 }))).toEqual({ ok: false, error: 'NOTHING_TO_DO' })
    expect(loadForge(forged({ copperBar: 9, coal: 9 }, { recipe: 'toolbox', job: 'toolbox' }))).toEqual({ ok: false, error: 'FULL' })
    expect(loadForge(forged({ copperBar: 3, coal: 9 }, { recipe: 'toolbox' }))).toEqual({ ok: false, error: 'NOT_ENOUGH_ITEMS' })
    expect(collectForge(forged())).toEqual({ ok: false, error: 'NOTHING_TO_DO' })
    const full = forged({ stone: 200 }, { tray: { toolbox: 2 } })
    expect(collectForge(full)).toEqual({ ok: false, error: 'BAG_FULL' })
    expect(ok(setForgeRecipe(forged(), 'anchorChain')).run.forge.recipe).toBe('anchorChain')
    expect(ok(setForgeRecipe(forged({}, { recipe: 'toolbox' }), null)).run.forge.recipe).toBeNull()
  })

  it('one good per 300 ticks: load takes 🥉4 ⚫1, the toolbox lands in the tray at tick 300', () => {
    const s = ok(loadForge(forged({ copperBar: 9, coal: 9 }, { recipe: 'toolbox' })))
    expect([s.run.inventory.copperBar, s.run.inventory.coal, s.run.forge.job]).toEqual([5, 8, 'toolbox'])
    const before = step(s, FORGE_CYCLE_TICKS - 1)
    expect([before.run.forge.progress, before.run.forge.tray]).toEqual([FORGE_CYCLE_TICKS - 1, {}])
    const done = step(before, 1)
    expect(done.run.forge).toEqual({ ...s.run.forge, job: null, progress: 0, tray: { toolbox: 1 } })
  })

  it('a full tray (10) holds the finished job until collected; collect moves what storage has room for', () => {
    const s = forged({}, { recipe: 'toolbox', job: 'toolbox', progress: FORGE_CYCLE_TICKS - 1, tray: { toolbox: 4, ploughBlade: 6 } })
    const held = step(s, 5)
    expect(held.run.forge).toEqual({ ...s.run.forge, progress: FORGE_CYCLE_TICKS })
    const room = { ...held, run: { ...held.run, inventory: { stone: held.run.bagCapacity - 7 } } }
    const collected = ok(collectForge(room))
    expect(collected.run.forge.tray).toEqual({ toolbox: 0, ploughBlade: 3 })
    expect(collected.run.inventory).toEqual({ stone: held.run.bagCapacity - 7, toolbox: 4, ploughBlade: 3 })
    expect(step(collected, 1).run.forge.tray).toEqual({ toolbox: 1, ploughBlade: 3 })
    expect(FORGE_TRAY).toBe(10)
  })

  it('the ore loader collects the tray, then loads the chosen recipe; with recipe Off it never loads', () => {
    const loader = (s: GameState): GameState => ({ ...s, run: { ...s.run, workers: { ...s.run.workers, pool: 1, assigned: { ...s.run.workers.assigned, ore: 1 } } } })
    const off = loader(forged({ copperBar: 8, coal: 2 }))
    expect(step(off, 1).run.inventory).toEqual(off.run.inventory)
    const withTray = loader(forged({ copperBar: 8, coal: 2 }, { recipe: 'toolbox', tray: { toolbox: 2 } }))
    const first = step(withTray, 1)
    expect([first.run.forge.tray.toolbox, first.run.inventory.toolbox, first.run.forge.job]).toEqual([0, 2, null])
    const loaded = step(loader(forged({ copperBar: 8, coal: 2 }, { recipe: 'toolbox' })), 1)
    expect([loaded.run.forge.job, loaded.run.inventory.copperBar, loaded.run.inventory.coal]).toEqual(['toolbox', 4, 1])
  })

  it('goods count toward storage and sell at 520 / 1,250 / 3,600; an order pays price × 1.1', () => {
    const s = forged({ toolbox: 1, ploughBlade: 2, anchorChain: 3 })
    expect(bagCount(s.run)).toBe(6)
    expect((['toolbox', 'ploughBlade', 'anchorChain'] as const).map((id) => itemSellPrice(id, s.meta, 0))).toEqual([520, 1250, 3600])
    expect(orderBonus()).toBe(0.1)
    for (const id of ['toolbox', 'ploughBlade', 'anchorChain'] as const) expect(itemOrderValue(s, id)).toBeCloseTo(itemSellPrice(id, s.meta, 0) * 1.1, 9)
    expect(orderPerMinute(s, 'toolbox')).toBe(60 / FORGE_CYCLE_TICKS)
  })

  it('the order pool gains each good only with its bar, and only once the forge is built', () => {
    const empty = { ore: 0, progress: 0, ready: 0 }
    const mine = (level: number, molds: RunState['furnace']['molds']): Partial<RunState> => ({
      mineLicense: true,
      vein: { level, progress: 0, rock: 'stone' },
      rack: { copper: 3, iron: 3 },
      furnace: { ...base.run.furnace, built: true, molds },
    })
    const goods = (s: GameState) => orderPool(s.run).filter((g) => ['toolbox', 'ploughBlade', 'anchorChain'].includes(g))
    const at = (level: number, molds: RunState['furnace']['molds'], built: boolean) => {
      const s = iron(mine(level, molds))
      return { ...s, run: { ...s.run, forge: { ...s.run.forge, built } } }
    }
    expect(goods(at(4, { copperOre: empty, ironOre: empty, goldOre: empty }, false))).toEqual([])
    expect(goods(at(2, { copperOre: empty }, true))).toEqual(['toolbox'])
    expect(goods(at(3, { copperOre: empty, ironOre: empty }, true))).toEqual(['toolbox', 'ploughBlade'])
    expect(goods(at(4, { copperOre: empty, ironOre: empty, goldOre: empty }, true))).toEqual(['toolbox', 'ploughBlade', 'anchorChain'])
  })

  it('step(s, a + b) = step(step(s, a), b) with a running forge', () => {
    const s = ok(loadForge(forged({ goldBar: 9, coal: 9 }, { recipe: 'anchorChain' })))
    expect(step(step(s, 123), 400)).toEqual(step(s, 523))
  })
})
