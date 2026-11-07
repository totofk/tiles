// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Mine } from '../src/app/Mine'
import type { Act } from '../src/app/useGame'
import { itemSellPrice, pickaxeDurability } from '../src/core/balance'
import { ITEMS } from '../src/core/data/items'
import { createInitialState, type GameState } from '../src/core/state'

afterEach(cleanup)
const WOOD = ITEMS.wood.emoji
const STONE = ITEMS.stone.emoji
const ORE = ITEMS.copperOre.emoji
const BAR = ITEMS.copperBar.emoji

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
    expect(text()).toContain(`Vein Lv0: ${STONE} Stone 100 %`)
    expect(screen.getByText(`Lv1: ${STONE} Stone 80 % · ⚫ Coal 20 % — ${STONE}25 💰100`)).toBeTruthy()
    const iron = screen.getByText(/iron ore/)
    expect(iron.textContent).toBe('🔒 Lv3: iron ore — coming')
    expect(iron.textContent).not.toMatch(new RegExp(`%|💰|${STONE}|\\d\\s`))
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
    expect(screen.getByText(/^Lv2: /).textContent).toBe(`Lv2: ${STONE} Stone 65 % · ⚫ Coal 20 % · ${ORE} Copper ore 15 % — ${STONE}30 ⚫10 💰200`)
    expect(screen.getByRole('button', { name: /^Upgrade vein to Lv2/ }).textContent).toBe('Upgrade vein to Lv2 — Build the furnace first')
    cleanup()
    setup({ ...rich, furnace: { built: true, queue: 0, progress: 0, ready: 0 } })
    expect((screen.getByRole('button', { name: /^Upgrade vein to Lv2/ }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('at the last vein level shows only the current table and the iron teaser', () => {
    setup({ vein: { level: 2, progress: 0, rock: 'stone' } })
    expect(text()).toContain(`Vein Lv2: ${STONE} Stone 65 % · ⚫ Coal 20 % · ${ORE} Copper ore 15 %`)
    expect(screen.queryByText(/^Lv3: /)).toBeNull()
    expect(screen.getByText(/iron ore/)).toBeTruthy()
  })

  it('shows the current rock type and its hits: a copper rock takes 3', () => {
    setup({ vein: { level: 2, progress: 2, rock: 'copperOre' } })
    expect(screen.getByRole('button', { name: /Dig/ }).textContent).toContain(`${ORE} cracked 2/3`)
  })

  it('shows a crack on a half-mined stone', () => {
    setup({ vein: { level: 0, progress: 1, rock: 'stone' } })
    expect(screen.getByRole('button', { name: /Dig/ }).textContent).toContain(`${STONE} cracked 1/2`)
  })

  it('shows "~N more uses" from the current durability, mastery level + xp, and the badge only once mastered', () => {
    setup({ pickaxe: wooden(), mastery: { wooden: 5 } })
    expect(text()).toContain('Wooden pickaxe 25 / 25 · ~25 more uses')
    expect(text()).toContain('Mastery Lv 0/10 · 5/10 xp')
    expect(screen.queryByText(/Mastered/)).toBeNull()
    cleanup()
    setup({ pickaxe: { tier: 'copper', durability: 187 }, mastery: { copper: 0 } })
    expect(text()).toContain('Copper pickaxe 187 / 200 · ~187 more uses')
    cleanup()
    setup({ pickaxe: wooden(), mastery: { wooden: 400 }, masteredTiers: ['wooden'] })
    expect(text()).toContain('Wooden pickaxe 25 / 25 · ~125 more uses')
    expect(text()).toContain('Mastery Lv 10/10 · 400 xp')
    expect(screen.getByText('Mastered ✓ +5 % all pickaxes')).toBeTruthy()
  })

  it('a blunt pickaxe shows the repair button with its wood cost', () => {
    setup({ pickaxe: wooden(0), inventory: { wood: 2 } })
    const repair = screen.getByRole('button', { name: `Blunt wooden pickaxe — repair (${WOOD}2)` }) as HTMLButtonElement
    expect(repair.disabled).toBe(false)
  })

  it('with the furnace built, offers the copper pickaxe (disabled with the reason) and shows it once crafted', () => {
    const furnace = { built: true, queue: 0, progress: 0, ready: 0 }
    setup({ pickaxe: wooden(), furnace, cash: 50, inventory: { copperBar: 4 } })
    const craft = screen.getByRole('button', { name: /^Craft copper pickaxe/ }) as HTMLButtonElement
    expect(craft.textContent).toBe(`Craft copper pickaxe (${BAR}5 💰50) — Not enough items`)
    expect(craft.disabled).toBe(true)
    cleanup()
    const t = setup({ pickaxe: wooden(), furnace, cash: 50, inventory: { copperBar: 5 }, mastery: { wooden: 33 } })
    fireEvent.click(screen.getByRole('button', { name: /^Craft copper pickaxe/ }))
    t.rerender()
    expect(text()).toContain('Copper pickaxe 200 / 200 · ~200 more uses')
    expect(text()).toContain('Mastery Lv 0/10 · 0/20 xp')
    expect(screen.queryByRole('button', { name: /^Craft copper pickaxe/ })).toBeNull()
  })

  it('furnace: a pointer to the Shop until built, then a collapsible section that smelts and collects', () => {
    setup({ vein: { level: 1, progress: 0, rock: 'stone' } })
    expect(text()).toContain('🔥 Furnace — buy it in the 🛒 Shop')
    cleanup()
    const t = setup({ furnace: { built: true, queue: 0, progress: 0, ready: 1 }, inventory: { copperOre: 3, coal: 1, wood: 1 } })
    const summary = () => document.querySelector('.mine-furnace summary')!.textContent
    expect(summary()).toBe('🔥 Furnace · 0 queued · 1 ready')
    const smelt = (fuel: RegExp) => screen.getByRole('button', { name: fuel }) as HTMLButtonElement
    // short reasons on their own line, so a ≈ 100 px button stays two lines; stock items never split
    expect(smelt(new RegExp(`^Smelt with ${WOOD}2`)).textContent).toBe(`Smelt with ${WOOD}2no fuel`)
    expect([...document.querySelectorAll('.mine-furnace .nowrap')].map((e) => e.textContent)).toEqual(['ore 3', 'coal 1', 'wood 1'])
    fireEvent.click(smelt(/^Smelt with ⚫1/))
    t.rerender()
    expect(t.get().run.furnace.queue).toBe(1)
    expect(summary()).toBe('🔥 Furnace · 1 queued · 1 ready · next bar 60s')
    expect(smelt(/^Smelt with ⚫1/).textContent).toBe('Smelt with ⚫1no ore')
    fireEvent.click(screen.getByRole('button', { name: /^Collect 1/ }))
    expect([t.get().run.inventory.copperBar, t.get().run.furnace.ready]).toEqual([1, 0])
    // bars have no sell buttons
    t.rerender()
    expect(within(screen.getByText(/Copper bar ×1/).parentElement!).queryByRole('button')).toBeNull()
  })

  it('furnace: the auto-smelt toggle starts off and switches run.autoSmelt', () => {
    const t = setup({ furnace: { built: true, queue: 0, progress: 0, ready: 0 } })
    const toggle = screen.getByRole('checkbox', { name: /Auto-smelt/ }) as HTMLInputElement
    expect(toggle.checked).toBe(false)
    fireEvent.click(toggle)
    t.rerender()
    expect(t.get().run.autoSmelt).toBe(true)
    expect((screen.getByRole('checkbox', { name: /Auto-smelt/ }) as HTMLInputElement).checked).toBe(true)
  })

  it('when storage is full, sells stone and coal from the panel and keeps the wood', () => {
    const t = setup({ cash: 0, inventory: { stone: 15, coal: 3, wood: 2 } })
    expect(screen.getByRole('button', { name: /Dig/ }).textContent).toContain('Storage is full')
    const meta = t.get().meta
    const value = 15 * itemSellPrice('stone', meta, 0) + 3 * itemSellPrice('coal', meta, 0)
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^Sell all ${STONE} ⚫ 💰${value}$`) }))
    t.rerender()
    expect(t.get().run.cash).toBe(value)
    expect(t.get().run.inventory).toEqual({ stone: 0, coal: 0, wood: 2 })
    expect(screen.queryByRole('button', { name: /^Sell all/ })).toBeNull()
  })
})
