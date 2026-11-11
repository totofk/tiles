// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Mine } from '../src/app/Mine'
import type { Act } from '../src/app/useGame'
import { itemSellPrice, oreSortUnlockCost, pickaxeDurability } from '../src/core/balance'
import { ITEMS } from '../src/core/data/items'
import { createFurnace, createInitialState, type GameState } from '../src/core/state'

afterEach(cleanup)
const built = { ...createFurnace(), built: true }
const WOOD = ITEMS.wood.emoji
const STONE = ITEMS.stone.emoji
const ORE = ITEMS.copperOre.emoji
const BAR = ITEMS.copperBar.emoji
const IRON_ORE = ITEMS.ironOre.emoji
const IRON_BAR = ITEMS.ironBar.emoji

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
  it('shows the current vein with % and the next level greyed with its cost; the vein ends at Lv4 (no teaser)', () => {
    setup({})
    expect(text()).toContain(`Vein Lv0: ${STONE} Stone 100 %`)
    expect(screen.getByText(`Lv1: ${STONE} Stone 80 % · ⚫ Coal 20 % — ${STONE}⁠25 💰⁠100`)).toBeTruthy()
    expect(screen.queryByText(/coming/)).toBeNull()
  })

  it('the next vein level has an Upgrade button, disabled with the reason until it is affordable', () => {
    setup({ cash: 100, inventory: { stone: 24 } })
    const upgrade = () => screen.getByRole('button', { name: /^Upgrade vein to Lv1/ }) as HTMLButtonElement
    expect(upgrade().disabled).toBe(true)
    // 25 stone cannot fit the starting 20 slots: the reason names the storage to buy
    expect(upgrade().textContent).toBe('Upgrade vein to Lv1 — Needs 📦 25 storage')
    cleanup()
    setup({ cash: 100, inventory: { stone: 24 }, bagCapacity: 30 })
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
    expect(screen.getByText(/^Lv2: /).textContent).toBe(`Lv2: ${STONE} Stone 65 % · ⚫ Coal 20 % · ${ORE} Copper ore 15 % — ${STONE}⁠30 ⚫⁠10 💰⁠200`)
    expect(screen.getByRole('button', { name: /^Upgrade vein to Lv2/ }).textContent).toBe('Upgrade vein to Lv2 — Build the furnace first')
    cleanup()
    setup({ ...rich, furnace: built })
    expect((screen.getByRole('button', { name: /^Upgrade vein to Lv2/ }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('vein Lv4 needs the iron pickaxe: the row shows the gold table and price, the button says so over copper', () => {
    const GOLD_ORE = ITEMS.goldOre.emoji
    const lv3 = { cash: 7500, inventory: { stone: 45, ironBar: 8 }, bagCapacity: 60, furnace: built, vein: { level: 3, progress: 0, rock: 'stone' as const } }
    setup({ ...lv3, pickaxe: { tier: 'copper', durability: 100 } })
    expect(screen.getByText(/^Lv4: /).textContent).toBe(
      `Lv4: ${STONE} Stone 50 % · ⚫ Coal 20 % · ${ORE} Copper ore 12 % · ${ITEMS.ironOre.emoji} Iron ore 10 % · ${GOLD_ORE} Gold ore 8 % — ${STONE}⁠45 ${IRON_BAR}⁠8 💰⁠7500`,
    )
    expect(screen.getByRole('button', { name: /^Upgrade vein to Lv4/ }).textContent).toBe('Upgrade vein to Lv4 — Needs the iron pickaxe')
    cleanup()
    const t = setup({ ...lv3, pickaxe: { tier: 'iron', durability: 100 } })
    fireEvent.click(screen.getByRole('button', { name: /^Upgrade vein to Lv4/ }))
    t.rerender()
    expect(t.get().run.vein.level).toBe(4)
    // the gold pickaxe is offered once the vein drops gold ore (never at Lv3)
    expect(screen.getByRole('button', { name: /^Craft gold pickaxe/ }).textContent).toBe(`Craft gold pickaxe (${ITEMS.goldBar.emoji}⁠5 💰⁠500) — Not enough items`)
  })

  it('at the last vein level (Lv4) shows only the current table, gold in it', () => {
    setup({ vein: { level: 4, progress: 0, rock: 'goldOre' }, pickaxe: { tier: 'iron', durability: 100 } })
    expect(text()).toContain(`Vein Lv4: ${STONE} Stone 50 % · ⚫ Coal 20 % · ${ORE} Copper ore 12 % · ${ITEMS.ironOre.emoji} Iron ore 10 % · ${ITEMS.goldOre.emoji} Gold ore 8 %`)
    expect(screen.queryByText(/^Lv5: /)).toBeNull()
    expect(screen.queryByText(/coming/)).toBeNull()
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
    const repair = screen.getByRole('button', { name: `Blunt wooden pickaxe — repair (${WOOD}⁠2)` }) as HTMLButtonElement
    expect(repair.disabled).toBe(false)
  })

  it('with the furnace built, offers the copper pickaxe (disabled with the reason) and shows it once crafted', () => {
    const furnace = built
    setup({ pickaxe: wooden(), furnace, cash: 50, inventory: { copperBar: 4 } })
    const craft = screen.getByRole('button', { name: /^Craft copper pickaxe/ }) as HTMLButtonElement
    expect(craft.textContent).toBe(`Craft copper pickaxe (${BAR}⁠5 💰⁠50) — Not enough items`)
    expect(craft.disabled).toBe(true)
    cleanup()
    const t = setup({ pickaxe: wooden(), furnace, cash: 50, inventory: { copperBar: 5 }, mastery: { wooden: 33 } })
    fireEvent.click(screen.getByRole('button', { name: /^Craft copper pickaxe/ }))
    t.rerender()
    expect(text()).toContain('Copper pickaxe 200 / 200 · ~200 more uses')
    expect(text()).toContain('Mastery Lv 0/10 · 0/20 xp')
    expect(screen.queryByRole('button', { name: /^Craft copper pickaxe/ })).toBeNull()
  })

  it('furnace: a pointer to the Shop until built, then a collapsible section that loads ore, fills fuel and collects', () => {
    setup({ vein: { level: 1, progress: 0, rock: 'stone' } })
    expect(text()).toContain('🔥 Furnace — buy it in the 🛒 Shop')
    cleanup()
    const t = setup({ furnace: { ...built, ready: 1 }, inventory: { copperOre: 3, coal: 1 } })
    const summary = () => document.querySelector('.mine-furnace summary')!.textContent
    expect(summary()).toBe('🔥 Furnace · fire 0/10 · ore 0 · 1 ready')
    const button = (name: RegExp) => screen.getByRole('button', { name }) as HTMLButtonElement
    // second line: how many items the press uses, or the short reason it cannot; stock items never split
    expect(button(new RegExp(`^Fill with ${WOOD}`)).textContent).toBe(`Fill with ${WOOD} woodno fuel`)
    expect(button(/^Fill with ⚫/).textContent).toBe('Fill with ⚫ coaluses 1')
    expect(button(/^Load/).textContent).toBe(`Load ${ORE} oreuses 3`)
    expect(button(/^Collect 1/).textContent).toBe(`Collect 1 ${BAR}tray 1/5`)
    expect([...document.querySelectorAll('.mine-furnace .furnace-stock .nowrap')].map((e) => e.textContent)).toEqual(['ore 3', 'coal 1', 'wood 0'])
    expect(text()).toContain('🔥 fire 0 / 10')
    expect(text()).toContain(`${ORE} ore 0 / 12`)
    expect(text()).not.toContain('nothing to smelt')
    fireEvent.click(button(/^Load/))
    fireEvent.click(button(/^Fill with ⚫/))
    t.rerender()
    expect(t.get().run.furnace).toMatchObject({ ore: 3, fire: 60 })
    expect(summary()).toBe('🔥 Furnace · fire 2/10 · ore 3 · 1 ready')
    expect(text()).toContain('🔥 fire 2 / 10')
    expect(button(/^Load/).textContent).toBe(`Load ${ORE} oreno ore`)
    fireEvent.click(button(/^Collect 1/))
    expect([t.get().run.inventory.copperBar, t.get().run.furnace.ready]).toEqual([1, 0])
  })

  it('a plain furnace lit with nothing to smelt says so; a smart one does not', () => {
    setup({ furnace: { ...built, fire: 90 } })
    expect(document.querySelector('.furnace-hint')?.textContent).toBe('burning with nothing to smelt')
    cleanup()
    setup({ furnace: { ...built, fire: 90, ore: 2 } })
    expect(document.querySelector('.furnace-hint')).toBeNull()
    cleanup()
    // a full tray also stops the cycle, but ore is loaded: the hint is only about missing ore
    setup({ furnace: { ...built, fire: 90, ore: 2, ready: 5 } })
    expect(document.querySelector('.furnace-hint')).toBeNull()
    cleanup()
    setup({ furnace: { ...built, fire: 90, smart: true } })
    expect(document.querySelector('.furnace-hint')).toBeNull()
    expect(text()).toContain('🔥 fire 3 / 10 · smart')
  })

  it('batch 24: the furnace card renders four groups — Fire / Smelt / Output / Upgrades — in order, with the heading', () => {
    setup({ furnace: built, vein: { level: 3, progress: 0, rock: 'stone' } })
    const groups = [...document.querySelectorAll('.mine-furnace > .group')]
    expect(groups).toHaveLength(4)
    expect(groups.map((g) => g.querySelector('h3')?.textContent ?? null)).toEqual([null, null, null, 'Upgrades'])
    // Fire: the status line + fire bar + ⓘ + the Fill buttons
    expect(groups[0].textContent).toContain('🔥 fire 0 / 10')
    expect([...groups[0].querySelectorAll('button')].filter((b) => !b.classList.contains('info-btn')).map((b) => b.textContent!.slice(0, 4))).toEqual(['Fill', 'Fill'])
    // Smelt: the ore picker, the recipe line and Load; Output: Collect alone
    expect(groups[1].querySelector('[aria-label="Ore to smelt"]')).toBeTruthy()
    expect([...groups[1].querySelectorAll('button')].some((b) => b.textContent!.startsWith('Load'))).toBe(true)
    expect([...groups[2].querySelectorAll('button')].map((b) => b.textContent!.slice(0, 7))).toEqual(['Collect'])
  })

  it('furnace upgrades: next level and price, disabled with the reason, bought, hidden at max', () => {
    const t = setup({ furnace: built, cash: 150, inventory: { copperBar: 3 } })
    const upgrade = (name: RegExp) => screen.getByRole('button', { name }) as HTMLButtonElement
    expect(upgrade(/^Fire cap/).textContent).toBe(`Fire cap 10 → 20${BAR}⁠4 💰⁠150 · Not enough items`)
    expect(upgrade(/^Fire cap/).disabled).toBe(true)
    expect(upgrade(/^Batch/).textContent).toBe(`Batch 1 → 2 bars${BAR}⁠6 💰⁠200 · Not enough items`)
    expect(upgrade(/^Smart furnace/).textContent).toBe(`Smart furnace${BAR}⁠10 💰⁠400 · Not enough items`)
    cleanup()
    const rich = setup({ furnace: { ...built, levels: { fireCap: 1, batch: 2 } }, cash: 1e4, inventory: { copperBar: 30 } })
    expect(upgrade(/^Fire cap/).textContent).toBe(`Fire cap 20 → 40${BAR}⁠8 💰⁠300`)
    expect(screen.queryByRole('button', { name: /^Batch/ })).toBeNull() // max level
    fireEvent.click(upgrade(/^Fire cap/))
    fireEvent.click(upgrade(/^Smart furnace/))
    rich.rerender()
    expect(rich.get().run.furnace).toMatchObject({ smart: true, levels: { fireCap: 2, batch: 2 } })
    expect(screen.queryByRole('button', { name: /^(Fire cap|Smart furnace)/ })).toBeNull()
    expect(t.get().run.furnace.levels.fireCap).toBe(0)
    // the recipe line follows the batch level: 6 ore → 3 bars per cycle
    expect(text()).toContain(`${ORE}6 + ⚫1 or ${WOOD}2 → ${BAR}3 · 60 s`)
  })

  it('vein Lv3 row: iron ore 10 %, priced for storage Lv3, and a hint while the pickaxe is too weak for iron', () => {
    const lv2 = { cash: 400, furnace: built, vein: { level: 2, progress: 0, rock: 'stone' as const } }
    setup({ ...lv2, bagCapacity: 40, inventory: { stone: 35, copperBar: 5 }, pickaxe: wooden() })
    expect(screen.getByText(/^Lv3: /).textContent).toBe(
      `Lv3: ${STONE} Stone 55 % · ⚫ Coal 20 % · ${ORE} Copper ore 15 % · ${IRON_ORE} Iron ore 10 % — ${STONE}⁠40 ${BAR}⁠5 💰⁠400`,
    )
    expect(screen.getByRole('button', { name: /^Upgrade vein to Lv3/ }).textContent).toBe('Upgrade vein to Lv3 — Needs 📦 45 storage')
    expect(screen.getByText(/needs a copper pickaxe/).textContent).toBe(`${IRON_ORE} Iron ore needs a copper pickaxe or better, else it is mined as ${STONE} stone`)
    cleanup()
    const t = setup({ ...lv2, bagCapacity: 50, inventory: { stone: 40, copperBar: 5 }, pickaxe: { tier: 'copper', durability: 200 } })
    expect(screen.queryByText(/needs a copper pickaxe/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /^Upgrade vein to Lv3/ }))
    expect(t.get().run.vein.level).toBe(3)
  })

  it('batch 13: iron is open to everyone: on vein Lv2 the Lv3 upgrade and the iron hint show, no locked-level teaser', () => {
    setup({ cash: 400, furnace: built, vein: { level: 2, progress: 0, rock: 'stone' }, bagCapacity: 50, inventory: { stone: 40, copperBar: 5 }, pickaxe: wooden() })
    expect(screen.getByRole('button', { name: /^Upgrade vein to Lv3/ })).toBeTruthy()
    expect(screen.getByText(/needs a copper pickaxe/)).toBeTruthy()
    expect(screen.queryByText(/— coming/)).toBeNull()
  })

  it('an iron rock shows "as stone" with stone hits below a copper pickaxe, its own 4 hits with one', () => {
    const rock = { level: 3, progress: 0, rock: 'ironOre' as const }
    setup({ vein: rock, pickaxe: wooden() })
    expect(screen.getByRole('button', { name: /Dig/ }).textContent).toContain(`· ${IRON_ORE} as ${STONE} 0/2`)
    expect(screen.getByText(/needs a copper pickaxe/)).toBeTruthy()
    cleanup()
    setup({ vein: { ...rock, progress: 3 }, pickaxe: { tier: 'copper', durability: 200 } })
    expect(screen.getByRole('button', { name: /Dig/ }).textContent).toContain(`${IRON_ORE} cracked 3/4`)
  })

  it('ore picker: from vein Lv3, copper or iron; a switch with ore in the slot asks twice and forfeits it (batch 21)', () => {
    setup({ furnace: built, vein: { level: 2, progress: 0, rock: 'stone' } })
    expect(screen.queryByRole('group', { name: 'Ore to smelt' })).toBeNull()
    cleanup()
    const lv3 = { level: 3, progress: 0, rock: 'stone' as const }
    const t = setup({ furnace: built, vein: lv3, inventory: { ironOre: 3, coal: 4 } })
    const kind = (name: RegExp) => within(screen.getByRole('group', { name: 'Ore to smelt' })).getByRole('button', { name }) as HTMLButtonElement
    expect(kind(/Copper ore/).textContent).toBe(`${ORE} Copper oreneeds 2 more to smelt`)
    expect([kind(/Copper ore/).getAttribute('aria-pressed'), kind(/Copper ore/).disabled]).toEqual(['true', true])
    expect(kind(/Iron ore/).textContent).toBe(`${IRON_ORE} Iron oreswitch`)
    fireEvent.click(kind(/Iron ore/))
    t.rerender()
    expect(t.get().run.furnace.oreKind).toBe('ironOre')
    expect(kind(/Iron ore/).getAttribute('aria-pressed')).toBe('true')
    expect(text()).toContain(`${IRON_ORE}2 + ⚫2 or ${WOOD}4 → ${IRON_BAR}1 · 120 s`)
    expect(text()).toContain(`${IRON_ORE} ore 0 / 12`)
    expect([...document.querySelectorAll('.mine-furnace .furnace-stock .nowrap')].map((e) => e.textContent)).toEqual(['ore 3', 'coal 4', 'wood 0'])
    fireEvent.click(screen.getByRole('button', { name: /^Load/ }))
    t.rerender()
    expect(screen.getByRole('button', { name: /^Load/ }).textContent).toBe(`Load ${IRON_ORE} oreno ore`)
    expect(t.get().run.furnace.ore).toBe(3)
    // tray empty: switching is allowed, forfeits the 3 ore, and needs a second press
    expect(kind(/Copper ore/).textContent).toBe(`${ORE} Copper oreswitch — forfeits 3`)
    expect(kind(/Copper ore/).disabled).toBe(false)
    fireEvent.click(kind(/Copper ore/))
    t.rerender()
    expect(t.get().run.furnace.oreKind).toBe('ironOre')
    expect(kind(/Copper ore/).textContent).toBe(`${ORE} Copper orepress again — forfeit 3 ${IRON_ORE}`)
    fireEvent.click(kind(/Copper ore/))
    t.rerender()
    expect([t.get().run.furnace.oreKind, t.get().run.furnace.ore]).toEqual(['copperOre', 0])
    cleanup()
    setup({ furnace: { ...built, oreKind: 'ironOre', ready: 2, progress: 30 }, vein: lv3 })
    expect(kind(/Copper ore/).textContent).toBe(`${ORE} Copper orecollect first`)
    expect(kind(/Copper ore/).disabled).toBe(true)
    expect(screen.getByRole('button', { name: /^Collect 2/ }).textContent).toBe(`Collect 2 ${IRON_BAR}tray 2/5`)
    expect(text()).toContain(`${IRON_ORE} ore 0 / 12 · 30/120 s`)
  })

  it('iron pickaxe: offered from vein Lv3 over a copper one, crafted from iron bars, repaired with iron bars', () => {
    const copper = { tier: 'copper' as const, durability: 200 }
    setup({ furnace: built, vein: { level: 2, progress: 0, rock: 'stone' }, pickaxe: copper })
    expect(screen.queryByRole('button', { name: /^Craft/ })).toBeNull()
    cleanup()
    const lv3 = { level: 3, progress: 0, rock: 'stone' as const }
    setup({ furnace: built, vein: lv3, pickaxe: copper, cash: 200, inventory: { ironBar: 4 } })
    expect(screen.getByRole('button', { name: /^Craft/ }).textContent).toBe(`Craft iron pickaxe (${IRON_BAR}⁠5 💰⁠200) — Not enough items`)
    cleanup()
    const t = setup({ furnace: built, vein: lv3, pickaxe: copper, cash: 200, inventory: { ironBar: 5 } })
    fireEvent.click(screen.getByRole('button', { name: /^Craft iron pickaxe/ }))
    t.rerender()
    expect(text()).toContain('Iron pickaxe 1200 / 1200')
    // nothing above iron yet, and no copper offer with a better pickaxe in hand
    expect(screen.queryByRole('button', { name: /^Craft/ })).toBeNull()
    cleanup()
    setup({ furnace: built, vein: lv3, pickaxe: { tier: 'iron', durability: 0 }, inventory: { ironBar: 2 } })
    expect((screen.getByRole('button', { name: `Blunt iron pickaxe — repair (${IRON_BAR}⁠2)` }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('a blunt pickaxe whose repair is out of reach offers a cheaper tier instead (batch 28.1)', () => {
    const bluntGold = { tier: 'gold' as const, durability: 0 }
    const instead = () => screen.queryByRole('button', { name: /instead/ }) as HTMLButtonElement | null
    const t = setup({ furnace: built, pickaxe: bluntGold, cash: 200, inventory: { ironBar: 5 } })
    expect(instead()?.textContent).toBe(`Craft iron pickaxe instead (${IRON_BAR}⁠5 💰⁠200) — replaces the blunt gold pickaxe`)
    expect(instead()?.disabled).toBe(false)
    fireEvent.click(instead()!)
    expect(t.get().run.pickaxe).toEqual({ tier: 'iron', durability: 1200 })
    cleanup()
    setup({ furnace: built, pickaxe: bluntGold, cash: 50, inventory: { copperBar: 5 } })
    expect(instead()?.textContent).toMatch(/^Craft copper pickaxe instead/)
    expect(instead()?.disabled).toBe(false)
    cleanup()
    setup({ furnace: built, pickaxe: bluntGold, inventory: { goldBar: 2 } })
    expect(instead()).toBeNull()
    cleanup()
    setup({ pickaxe: wooden(0) })
    expect(instead()).toBeNull()
  })

  it('a mine worker press flashes the Mine button and pops ⛏️; nothing otherwise', () => {
    const s = createInitialState()
    const state: GameState = { ...s, run: { ...s.run, mineLicense: true } }
    const { rerender } = render(<Mine state={state} act={() => {}} />)
    const dig = () => screen.getByRole('button', { name: /Dig/ })
    expect(dig().classList.contains('mine-flash')).toBe(false)
    expect(dig().querySelector('.cell-pop')).toBeNull()
    rerender(<Mine state={state} act={() => {}} minerActed />)
    expect(dig().classList.contains('mine-flash')).toBe(true)
    expect(dig().querySelector('.cell-pop')!.textContent).toBe('⛏️')
  })

  it('when storage is full, sells the stone from the panel and keeps the wood and the coal (it fuels the Fields tank)', () => {
    const t = setup({ cash: 0, inventory: { stone: 15, coal: 3, wood: 2 } })
    expect(screen.getByRole('button', { name: /Dig/ }).textContent).toContain('Storage is full')
    const value = 15 * itemSellPrice('stone', t.get().meta, 0)
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^Sell all ${STONE} 💰${value}$`) }))
    t.rerender()
    expect(t.get().run.cash).toBe(value)
    expect(t.get().run.inventory).toEqual({ stone: 0, coal: 3, wood: 2 })
    expect(screen.queryByRole('button', { name: /^Sell all/ })).toBeNull()
  })

  it('batch 24: bars sell as disposal through the shared item grid — sell 1 pays their price, sell all clears them', () => {
    const t = setup({ cash: 0, inventory: { copperBar: 2, wood: 1 } })
    expect(document.querySelector('.mine .item-grid')).toBeTruthy()
    const barRow = () => screen.getByText(`${BAR} Copper bar`).closest('.item-row') as HTMLElement
    // the price-each column, ×N count and both sell buttons; every mine item is sellable since bars joined
    expect(barRow().textContent).toBe(`${BAR} Copper bar×2💰2sell 1sell all`)
    const woodRow = () => screen.getByText(`${WOOD} Wood`).closest('.item-row')!
    // batch 28.2: the 6th column (Keep / Sell on dig) is an empty cell on rows that are not an unlocked vein drop
    expect([...woodRow().children].map((c) => c.textContent)).toEqual([`${WOOD} Wood`, '×1', '💰2', 'sell 1', 'sell all', ''])
    fireEvent.click(within(barRow()).getByRole('button', { name: 'sell 1' }))
    t.rerender()
    expect([t.get().run.cash, t.get().run.inventory.copperBar]).toEqual([2, 1])
    fireEvent.click(within(barRow()).getByRole('button', { name: 'sell all' }))
    t.rerender()
    expect([t.get().run.cash, t.get().run.inventory.copperBar]).toEqual([4, 0])
  })

  it('batch 24.1: the grid sits inside its .item-grid-wrap, every row holds exactly 6 cells, the recipe is two lines', () => {
    setup({ furnace: built, inventory: { copperBar: 2, wood: 1 } })
    // both users render through the wrapper: the sell list here, the seed pouch in the Farm tab (Shop tests)
    expect(document.querySelector('.mine .item-grid-wrap .item-grid')).toBeTruthy()
    // batch 28.2: name | count | extra | sell 1 | sell all | Keep / Sell on dig
    for (const row of document.querySelectorAll('.mine .item-row')) expect(row.children).toHaveLength(6)
    const recipe = document.querySelector('.mine-furnace .furnace-recipe')!
    const stock = document.querySelector('.mine-furnace .furnace-stock')!
    expect(recipe.textContent).toBe(`${ORE}2 + ⚫1 or ${WOOD}2 → ${BAR}1 · 60 s`)
    expect(stock.textContent).toBe('have: ore 0 · coal 0 · wood 1')
    // every emoji+number of the recipe is its own unbreakable token
    expect([...recipe.querySelectorAll('.nowrap')].map((e) => e.textContent)).toEqual([`${ORE}2`, `⚫1`, `${WOOD}2`, `${BAR}1`, '60 s'])
  })

  it('batch 24: "Sell all when full" never sells bars — they pay for upgrades (own-row buttons only)', () => {
    const t = setup({ cash: 0, inventory: { stone: 15, copperBar: 5 } })
    expect(screen.getByRole('button', { name: /Dig/ }).textContent).toContain('Storage is full')
    const value = 15 * itemSellPrice('stone', t.get().meta, 0)
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^Sell all ${STONE} 💰${value}$`) }))
    t.rerender()
    expect(t.get().run.cash).toBe(value)
    expect(t.get().run.inventory).toEqual({ stone: 0, copperBar: 5 })
  })
})

describe('batch 28.2: 🧺 ore sorting', () => {
  const vein = (level: number) => ({ level, progress: 0, rock: 'stone' as const })
  const group = () => screen.queryByRole('heading', { name: '🧺 Ore sorting' })?.parentElement ?? null
  const unlockRows = () => [...(group()?.querySelectorAll('.sort-row') ?? [])].map((r) => r.querySelector('span')!.textContent)

  it('vein Lv2 shows no sorting group; vein Lv3 shows 5 unlock rows with their price and the hint', () => {
    setup({ vein: vein(2) })
    expect(group()).toBeNull()
    cleanup()
    const t = setup({ vein: vein(3) })
    const cash = oreSortUnlockCost('stone', t.get().meta).cash
    expect(unlockRows()).toEqual([
      `Sell ${STONE} Stone on dig — ${STONE}⁠30 💰⁠${cash}`,
      `Sell ⚫ Coal on dig — ⚫⁠15 💰⁠${cash}`,
      `Sell ${ORE} Copper ore on dig — ${ORE}⁠15 💰⁠${cash}`,
      `Sell ${IRON_ORE} Iron ore on dig — ${IRON_ORE}⁠15 💰⁠${cash}`,
      `Sell ${ITEMS.goldOre.emoji} Gold ore on dig — ${ITEMS.goldOre.emoji}⁠10 💰⁠${cash}`,
    ])
    expect(group()!.textContent).toContain('Unlocked kinds can be sold the moment you dig them, so the miner never stops on a full storage.')
    // disabled with the action's reason, in the craft rows' shape
    expect(within(group()!).getAllByRole('button')[0].textContent).toBe('Unlock — Not enough items')
  })

  it('unlocking stone moves it to a Keep toggle in the sell list; the toggle flips aria-pressed and the state', () => {
    const cash = oreSortUnlockCost('stone', createInitialState().meta).cash
    const t = setup({ vein: vein(3), cash, inventory: { stone: 30 }, bagCapacity: 60 })
    fireEvent.click(within(group()!).getAllByRole('button')[0])
    t.rerender()
    expect(t.get().run.oreSort).toEqual({ stone: 'keep' })
    expect(unlockRows()).toHaveLength(4)
    expect(unlockRows()[0]).toContain('Coal')
    // the stone row stays at ×0 so its toggle is reachable
    const row = screen.getByText(`${STONE} Stone`).closest('.item-row') as HTMLElement
    const toggle = () => within(row).getByRole('button', { name: /^(Keep|Sell on dig)$/ })
    expect([toggle().textContent, toggle().getAttribute('aria-pressed')]).toEqual(['Keep', 'false'])
    fireEvent.click(toggle())
    t.rerender()
    expect(t.get().run.oreSort).toEqual({ stone: 'sell' })
    expect([toggle().textContent, toggle().getAttribute('aria-pressed')]).toEqual(['Sell on dig', 'true'])
    fireEvent.click(toggle())
    t.rerender()
    expect(t.get().run.oreSort).toEqual({ stone: 'keep' })
  })

  it('the group is hidden once every kind is unlocked', () => {
    setup({ vein: vein(4), oreSort: { stone: 'sell', coal: 'keep', copperOre: 'sell', ironOre: 'sell', goldOre: 'sell' } })
    expect(group()).toBeNull()
    expect(screen.getAllByRole('button', { name: /^(Keep|Sell on dig)$/ })).toHaveLength(5)
  })
})
