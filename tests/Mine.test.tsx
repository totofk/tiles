// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Mine } from '../src/app/Mine'
import type { Act } from '../src/app/useGame'
import { itemSellPrice, pickaxeRecipe } from '../src/core/balance'
import { createInitialState, type GameState } from '../src/core/state'

afterEach(cleanup)

function setup(run: Partial<GameState['run']>) {
  const s = createInitialState()
  let state: GameState = { ...s, run: { ...s.run, mineLicense: true, ...run } }
  const act: Act = (fn) => {
    const r = fn(state)
    if (r.ok) state = r.state
  }
  const ui = () => <Mine state={state} act={act} />
  const view = render(ui())
  return { get: () => state, rerender: () => view.rerender(ui()) }
}
const text = () => document.body.textContent ?? ''
const wooden = (durability = pickaxeRecipe('wooden').durability) => ({ tier: 'wooden' as const, durability })

describe('Mine panel', () => {
  it('shows the current vein with %, the next level greyed with its cost, and the iron teaser with no numbers', () => {
    setup({})
    expect(text()).toContain('Vein Lv0: 🪨 Stone 100 %')
    expect(screen.getByText(/^Lv1: 🪨 Stone 80 % · ⚫ Coal 20 % — 25 🪨 \+ 💰100$/)).toBeTruthy()
    const iron = screen.getByText(/iron ore/)
    expect(iron.textContent).toBe('🔒 Lv2: iron ore — needs Furnace (coming)')
    expect(iron.textContent).not.toMatch(/%|💰|🪨|\d\s/)
  })

  it('the next vein level has an Upgrade button, disabled with the reason until it is affordable', () => {
    setup({ cash: 100, inventory: { stone: 24 } })
    const upgrade = () => screen.getByRole('button', { name: /^Upgrade vein to Lv1/ }) as HTMLButtonElement
    expect(upgrade().disabled).toBe(true)
    expect(upgrade().textContent).toBe('Upgrade vein to Lv1 — Not enough items')
    cleanup()
    const affordable = setup({ cash: 100, inventory: { stone: 25 } })
    fireEvent.click(upgrade())
    expect(affordable.get().run.vein.level).toBe(1)
    affordable.rerender()
    expect(screen.queryByRole('button', { name: /^Upgrade vein/ })).toBeNull()
  })

  it('at the last vein level shows only the current table and the iron teaser', () => {
    setup({ vein: { level: 1, progress: 0, rock: 'stone' } })
    expect(text()).toContain('Vein Lv1: 🪨 Stone 80 % · ⚫ Coal 20 %')
    expect(screen.queryByText(/^Lv2: /)).toBeNull()
    expect(screen.getByText(/iron ore/)).toBeTruthy()
  })

  it('shows a crack on a half-mined stone', () => {
    setup({ vein: { level: 0, progress: 1, rock: 'stone' } })
    expect(screen.getByRole('button', { name: /Dig/ }).textContent).toContain('🪨 cracked 1/2')
  })

  it('shows "lasts ~N uses" on the durability line, mastery level + xp, and the badge only once mastered', () => {
    setup({ pickaxe: wooden(), mastery: { wooden: 5 } })
    expect(text()).toContain('Wooden pickaxe 25 / 25 · lasts ~25 uses')
    expect(text()).toContain('Mastery Lv 0/10 · 5/10 xp')
    expect(screen.queryByText(/Mastered/)).toBeNull()
    cleanup()
    setup({ pickaxe: wooden(), mastery: { wooden: 400 }, masteredTiers: ['wooden'] })
    expect(text()).toContain('Wooden pickaxe 25 / 25 · lasts ~125 uses')
    expect(text()).toContain('Mastery Lv 10/10 · 400 xp')
    expect(screen.getByText('Mastered ✓ +5 % all pickaxes')).toBeTruthy()
  })

  it('a blunt pickaxe shows the repair button with its wood cost', () => {
    setup({ pickaxe: wooden(0), inventory: { wood: 2 } })
    const repair = screen.getByRole('button', { name: /Blunt pickaxe — repair \(2 🪵\)/ }) as HTMLButtonElement
    expect(repair.disabled).toBe(false)
  })

  it('when storage is full, sells stone and coal from the panel and keeps the wood', () => {
    const t = setup({ cash: 0, inventory: { stone: 15, coal: 3, wood: 2 } })
    expect(screen.getByRole('button', { name: /Dig/ }).textContent).toContain('Storage is full')
    const meta = t.get().meta
    const value = 15 * itemSellPrice('stone', meta, 0) + 3 * itemSellPrice('coal', meta, 0)
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^Sell all 🪨 ⚫ 💰${value}$`) }))
    t.rerender()
    expect(t.get().run.cash).toBe(value)
    expect(t.get().run.inventory).toEqual({ stone: 0, coal: 0, wood: 2 })
    expect(screen.queryByRole('button', { name: /^Sell all/ })).toBeNull()
  })
})
