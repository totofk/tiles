import { describe, expect, it } from 'vitest'
import type { ActionResult } from '../src/core/actions'
import { furnaceCost, furnaceVeinLevel, isSellable } from '../src/core/balance'
import { buildFurnace } from '../src/core/furnace'
import { bagCount, sellItem } from '../src/core/mining'
import { createInitialState, type GameState } from '../src/core/state'

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

describe('copper items', () => {
  it('ore sells for 1 and takes a storage slot; bars take a slot and have no sell path', () => {
    const s = withRun({ cash: 0, inventory: { copperOre: 2, copperBar: 3 } })
    expect(bagCount(s.run)).toBe(5)
    expect(okState(sellItem(s, 'copperOre', 2)).run.cash).toBe(2)
    expect(isSellable('copperBar')).toBe(false)
    expect(sellItem(s, 'copperBar', 1)).toEqual({ ok: false, error: 'NOT_SELLABLE' })
  })
})
