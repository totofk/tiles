// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Mine } from '../src/app/Mine'
import type { Act } from '../src/app/useGame'
import { itemSellPrice, pickaxeDurability } from '../src/core/balance'
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
const wooden = (durability = pickaxeDurability('wooden')) => ({ tier: 'wooden' as const, durability })

describe('Mine panel', () => {
  it('shows the current vein with %, the next level greyed with its cost, and the iron teaser with no numbers', () => {
    setup({})
    expect(text()).toContain('Vein Lv0: 🪨 Stone 100 %')
    expect(screen.getByText(/^Lv1: 🪨 Stone 80 % · ⚫ Coal 20 % — 🪨25 💰100$/)).toBeTruthy()
    const iron = screen.getByText(/iron ore/)
    expect(iron.textContent).toBe('🔒 Lv3: iron ore — coming')
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
    expect(screen.queryByRole('button', { name: /^Upgrade vein to Lv1/ })).toBeNull()
    expect(screen.getByRole('button', { name: /^Upgrade vein to Lv2/ })).toBeTruthy()
  })

  it('vein Lv2 is copper ore and needs the furnace: the Upgrade button says so until it is built', () => {
    const rich = { cash: 1e3, inventory: { stone: 30, coal: 10 }, bagCapacity: 40, vein: { level: 1, progress: 0, rock: 'stone' as const } }
    setup(rich)
    expect(screen.getByText(/^Lv2: /).textContent).toBe('Lv2: 🪨 Stone 65 % · ⚫ Coal 20 % · 🟤 Copper ore 15 % — 🪨30 ⚫10 💰200')
    expect(screen.getByRole('button', { name: /^Upgrade vein to Lv2/ }).textContent).toBe('Upgrade vein to Lv2 — Build the furnace first')
    cleanup()
    setup({ ...rich, furnace: { built: true, queue: 0, progress: 0, ready: 0 } })
    expect((screen.getByRole('button', { name: /^Upgrade vein to Lv2/ }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('at the last vein level shows only the current table and the iron teaser', () => {
    setup({ vein: { level: 2, progress: 0, rock: 'stone' } })
    expect(text()).toContain('Vein Lv2: 🪨 Stone 65 % · ⚫ Coal 20 % · 🟤 Copper ore 15 %')
    expect(screen.queryByText(/^Lv3: /)).toBeNull()
    expect(screen.getByText(/iron ore/)).toBeTruthy()
  })

  it('shows the current rock type and its hits: a copper rock takes 3', () => {
    setup({ vein: { level: 2, progress: 2, rock: 'copperOre' } })
    expect(screen.getByRole('button', { name: /Dig/ }).textContent).toContain('🟤 cracked 2/3')
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
    const repair = screen.getByRole('button', { name: /Blunt wooden pickaxe — repair \(🪵2\)/ }) as HTMLButtonElement
    expect(repair.disabled).toBe(false)
  })

  it('with the furnace built, offers the copper pickaxe (disabled with the reason) and shows it once crafted', () => {
    const furnace = { built: true, queue: 0, progress: 0, ready: 0 }
    setup({ pickaxe: wooden(), furnace, cash: 50, inventory: { copperBar: 4 } })
    const craft = screen.getByRole('button', { name: /^Craft copper pickaxe/ }) as HTMLButtonElement
    expect(craft.textContent).toBe('Craft copper pickaxe (🟧5 💰50) — Not enough items')
    expect(craft.disabled).toBe(true)
    cleanup()
    const t = setup({ pickaxe: wooden(), furnace, cash: 50, inventory: { copperBar: 5 }, mastery: { wooden: 33 } })
    fireEvent.click(screen.getByRole('button', { name: /^Craft copper pickaxe/ }))
    t.rerender()
    expect(text()).toContain('Copper pickaxe 200 / 200 · lasts ~200 uses')
    expect(text()).toContain('Mastery Lv 0/10 · 0/20 xp')
    expect(screen.queryByRole('button', { name: /^Craft copper pickaxe/ })).toBeNull()
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
