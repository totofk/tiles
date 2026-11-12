// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Mine } from '../src/app/Mine'
import type { Act } from '../src/app/useGame'
import { itemSellPrice, oreSortUnlockCost, pickaxeDurability } from '../src/core/balance'
import { ITEMS } from '../src/core/data/items'
import { price } from '../src/app/fmt'
import { createFurnace, createInitialState, type GameState, type Pickaxe } from '../src/core/state'

afterEach(cleanup)
const built = { ...createFurnace(), built: true }
const WOOD = ITEMS.wood.emoji
const STONE = ITEMS.stone.emoji
const ORE = ITEMS.copperOre.emoji
const BAR = ITEMS.copperBar.emoji
const IRON_ORE = ITEMS.ironOre.emoji
const IRON_BAR = ITEMS.ironBar.emoji

/** `pickaxe` = that one tier on the rack, in hand; the run fields otherwise */
function setup({ pickaxe, ...run }: Partial<GameState['run']> & { pickaxe?: Pickaxe }) {
  const s = createInitialState()
  const held = pickaxe ? { rack: { [pickaxe.tier]: pickaxe.durability }, selectedPickaxe: pickaxe.tier } : {}
  let state: GameState = { ...s, run: { ...s.run, mineLicense: true, ...held, ...run } }
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
      `Lv4: ${STONE} Stone 50 % · ⚫ Coal 20 % · ${ORE} Copper ore 12 % · ${ITEMS.ironOre.emoji} Iron ore 10 % · ${GOLD_ORE} Gold ore 8 % — ${STONE}⁠45 ${IRON_BAR}⁠8 💰⁠7,500`,
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
    expect(screen.getByText('Mastered ✓ +5 % durability · +10 % ore · all pickaxes')).toBeTruthy()
  })

  it('batch 32: the pickaxe group renders between Dig and the vein: rack, status, craft row (unowned offered tiers only), mastery', () => {
    setup({ furnace: built, vein: { level: 3, progress: 0, rock: 'stone' }, rack: { wooden: 0, copper: 120 }, selectedPickaxe: 'copper', masteredTiers: ['wooden'], mastery: { wooden: 400 } })
    const section = document.querySelector('.mine')!
    const dig = screen.getByRole('button', { name: /Dig/ })
    const pickaxes = section.querySelector('.mine-pickaxe-group')!
    const vein = section.querySelector('.mine-vein')!
    expect(dig.compareDocumentPosition(pickaxes) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(pickaxes.compareDocumentPosition(vein) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const rack = within(screen.getByRole('group', { name: 'Pickaxe rack' }))
    expect(rack.getAllByRole('button').map((b) => [b.textContent, b.getAttribute('aria-pressed')])).toEqual([
      ['Wooden pickaxeblunt ✓', 'false'],
      ['Copper pickaxe120/200', 'true'],
    ])
    expect(pickaxes.textContent).toContain('Copper pickaxe 120 / 200')
    // vein Lv3 drops iron, not gold: iron is the only unowned tier on offer
    expect(within(pickaxes as HTMLElement).getAllByRole('button', { name: /^Craft/ }).map((b) => b.textContent)).toEqual([
      `Craft iron pickaxe (${IRON_BAR}⁠5 💰⁠200) — Not enough items`,
    ])
    expect(pickaxes.textContent).toContain('Mastery Lv 0/10')
    cleanup()
    // a fresh mine: no rack, the wooden pickaxe is the one craft (the furnace offers the rest)
    setup({ inventory: { wood: 3 } })
    expect(screen.queryByRole('group', { name: 'Pickaxe rack' })).toBeNull()
    expect(screen.getAllByRole('button', { name: /^Craft/ }).map((b) => b.textContent)).toEqual([`Craft wooden pickaxe (${WOOD}⁠3)`])
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
    const t = setup({ furnace: { ...built, molds: { copperOre: { ore: 0, progress: 0, ready: 1 } } }, inventory: { copperOre: 3, coal: 1 } })
    const summary = () => document.querySelector('.mine-furnace summary')!.textContent
    // batch 33: the summary sums every mold's tray (the "ore n" part is gone)
    expect(summary()).toBe('🔥 Furnace · fire 0/10 · 1 ready')
    const button = (name: RegExp) => screen.getByRole('button', { name }) as HTMLButtonElement
    // second line: how many items the press uses, or the short reason it cannot; stock items never split
    expect(button(new RegExp(`^Fill with ${WOOD}`)).textContent).toBe(`Fill with ${WOOD} woodno fuel`)
    expect(button(/^Fill with ⚫/).textContent).toBe('Fill with ⚫ coaluses 1')
    expect(button(/^Load/).textContent).toBe(`Load ${ORE} oreuses 3`)
    expect(button(/^Collect 1/).textContent).toBe(`Collect 1 ${BAR}tray 1/5`)
    expect([...document.querySelectorAll('.mine-furnace .furnace-stock .nowrap')].map((e) => e.textContent)).toEqual([`${ORE} 3`, 'coal 1', 'wood 0'])
    expect(text()).toContain('🔥 fire 0 / 10')
    expect(text()).toContain(`${ORE} Copper ore · ore 0/12 · fire out`)
    expect(text()).not.toContain('nothing to smelt')
    fireEvent.click(button(/^Load/))
    fireEvent.click(button(/^Fill with ⚫/))
    t.rerender()
    expect([t.get().run.furnace.molds.copperOre!.ore, t.get().run.furnace.fire]).toEqual([3, 60])
    expect(summary()).toBe('🔥 Furnace · fire 2/10 · 1 ready')
    expect(text()).toContain('🔥 fire 2 / 10')
    expect(text()).toContain(`${ORE} Copper ore · ore 3/12 · smelting`)
    expect(button(/^Load/).textContent).toBe(`Load ${ORE} oreno ore`)
    fireEvent.click(button(/^Collect 1/))
    expect([t.get().run.inventory.copperBar, t.get().run.furnace.molds.copperOre!.ready]).toEqual([1, 0])
  })

  it('a plain furnace lit with nothing to smelt says so; a smart one does not', () => {
    setup({ furnace: { ...built, fire: 90 } })
    expect(document.querySelector('.furnace-hint')?.textContent).toBe('burning with nothing to smelt')
    cleanup()
    setup({ furnace: { ...built, fire: 90, molds: { copperOre: { ore: 2, progress: 0, ready: 0 } } } })
    expect(document.querySelector('.furnace-hint')).toBeNull()
    cleanup()
    // batch 33: the hint shows whenever no mold smelts — a full tray burns fire for nothing too
    setup({ furnace: { ...built, fire: 90, molds: { copperOre: { ore: 2, progress: 0, ready: 5 } } } })
    expect(document.querySelector('.furnace-hint')?.textContent).toBe('burning with nothing to smelt')
    expect(text()).toContain(`${ORE} Copper ore · ore 2/12 · tray full`)
    cleanup()
    // one smelting mold is enough to hide it
    setup({ furnace: { ...built, fire: 90, molds: { copperOre: { ore: 2, progress: 0, ready: 5 }, ironOre: { ore: 2, progress: 0, ready: 0 } } } })
    expect(document.querySelector('.furnace-hint')).toBeNull()
    cleanup()
    setup({ furnace: { ...built, fire: 90, smart: true } })
    expect(document.querySelector('.furnace-hint')).toBeNull()
    expect(text()).toContain('🔥 fire 3 / 10 · smart')
  })

  it('batch 33: the furnace card renders three groups — Fire / Smelt (one row per mold) / Upgrades — with the heading', () => {
    setup({ furnace: built, vein: { level: 3, progress: 0, rock: 'stone' } })
    const groups = [...document.querySelectorAll('.mine-furnace > .group')]
    expect(groups).toHaveLength(3)
    expect(groups.map((g) => g.querySelector('h3')?.textContent ?? null)).toEqual([null, null, 'Upgrades'])
    // Fire: the status line + fire bar + ⓘ + the Fill buttons
    expect(groups[0].textContent).toContain('🔥 fire 0 / 10')
    expect([...groups[0].querySelectorAll('button')].filter((b) => !b.classList.contains('info-btn')).map((b) => b.textContent!.slice(0, 4))).toEqual(['Fill', 'Fill'])
    // Smelt: no ore picker; a copper-only furnace has one mold row with Load and Collect in one actions row
    expect(groups[1].querySelector('[aria-label="Ore to smelt"]')).toBeNull()
    expect(groups[1].querySelectorAll('.furnace-mold')).toHaveLength(1)
    expect([...groups[1].querySelectorAll('.furnace-mold .mine-furnace-actions button')].map((b) => b.textContent!.slice(0, 4))).toEqual(['Load', 'Coll'])
  })

  it('batch 33: a vein-Lv3 save shows the Iron mold row; buying it adds a second mold row', () => {
    setup({ furnace: built, vein: { level: 2, progress: 0, rock: 'stone' } })
    expect(screen.queryByRole('button', { name: /Iron mold/ })).toBeNull()
    cleanup()
    const t = setup({ furnace: built, vein: { level: 3, progress: 0, rock: 'stone' }, cash: 6500, inventory: { copperBar: 10, stone: 20 } })
    const mold = () => screen.getByRole('button', { name: /Iron mold/ }) as HTMLButtonElement
    expect(mold().textContent).toBe(`${IRON_ORE} Iron mold${STONE}⁠20 ${BAR}⁠10 💰⁠6,500`)
    expect(screen.queryByRole('button', { name: /Gold mold/ })).toBeNull()
    fireEvent.click(mold())
    t.rerender()
    expect(Object.keys(t.get().run.furnace.molds)).toEqual(['copperOre', 'ironOre'])
    expect(screen.queryByRole('button', { name: /Iron mold/ })).toBeNull()
    expect(document.querySelectorAll('.mine-furnace .furnace-mold')).toHaveLength(2)
    expect(text()).toContain(`${IRON_ORE} Iron ore · ore 0/12 · fire out`)
    expect(text()).toContain(`${IRON_ORE}2 + ⚫2 or ${WOOD}4 → ${IRON_BAR}1 · 120 s`)
    expect([...document.querySelectorAll('.mine-furnace .furnace-stock .nowrap')].map((e) => e.textContent)).toEqual([`${ORE} 0`, `${IRON_ORE} 0`, 'coal 0', 'wood 0'])
    // with two molds the Collect all row appears among the upgrades
    expect(screen.getByRole('button', { name: /^Collect all/ }).textContent).toContain(`${BAR}⁠10 ${IRON_BAR}⁠5 💰⁠6,500`)
  })

  it('batch 33: two molds + Collect all owned shows the Collect all button (n bars); speed shows in the cycle seconds', () => {
    const molds = { copperOre: { ore: 0, progress: 0, ready: 3 }, ironOre: { ore: 0, progress: 0, ready: 2 } }
    const t = setup({ furnace: { ...built, collectAll: true, molds, levels: { ...built.levels, speed: 2 } }, vein: { level: 3, progress: 0, rock: 'stone' } })
    const all = () => screen.getByRole('button', { name: /^Collect all/ }) as HTMLButtonElement
    expect(all().textContent).toBe('Collect all5 bars')
    expect(text()).toContain(`${ORE}2 + ⚫1 or ${WOOD}2 → ${BAR}1 · 39 s`)
    expect(text()).toContain(`${IRON_BAR}1 · 77 s`)
    expect(document.querySelector('.mine-furnace summary')!.textContent).toBe('🔥 Furnace · fire 0/10 · 5 ready')
    fireEvent.click(all())
    t.rerender()
    expect([t.get().run.inventory.copperBar, t.get().run.inventory.ironBar]).toEqual([3, 2])
    expect(all().textContent).toBe('Collect allNothing to do')
    expect(all().disabled).toBe(true)
  })

  it('batch 33: a batch row at Lv2 without tray / ore slot Lv1 says what it needs; the new rows are labelled', () => {
    setup({ furnace: { ...built, levels: { ...built.levels, batch: 2 } }, cash: 1e5, inventory: { ironBar: 20 } })
    const row = (name: RegExp) => screen.getByRole('button', { name }) as HTMLButtonElement
    expect(row(/^Batch/).textContent).toBe(`Batch 3 → 4 bars${IRON_BAR}⁠8 💰⁠7,500 · needs tray 8 + ore slot 16`)
    expect(row(/^Batch/).disabled).toBe(true)
    expect(row(/^Speed/).textContent).toBe(`Speed: cycles 100 % → 80 %${IRON_BAR}⁠10 💰⁠7,500`)
    expect(row(/^Tray/).textContent).toBe(`Tray 5 → 10 bars${STONE}⁠30 ${BAR}⁠8 💰⁠6,500 · Not enough items`)
    expect(row(/^Ore slot/).textContent).toBe(`Ore slot 12 → 24${STONE}⁠30 ${BAR}⁠6 💰⁠6,500 · Not enough items`)
    // one mold: no Collect all row
    expect(screen.queryByRole('button', { name: /^Collect all/ })).toBeNull()
  })

  it('furnace upgrades: next level and price, disabled with the reason, bought, hidden at max', () => {
    const t = setup({ furnace: built, cash: 150, inventory: { copperBar: 3 } })
    const upgrade = (name: RegExp) => screen.getByRole('button', { name }) as HTMLButtonElement
    expect(upgrade(/^Fire cap/).textContent).toBe(`Fire cap 10 → 20${BAR}⁠4 💰⁠150 · Not enough items`)
    expect(upgrade(/^Fire cap/).disabled).toBe(true)
    expect(upgrade(/^Batch/).textContent).toBe(`Batch 1 → 2 bars${BAR}⁠6 💰⁠200 · Not enough items`)
    expect(upgrade(/^Smart furnace/).textContent).toBe(`Smart furnace${BAR}⁠10 💰⁠400 · Not enough items`)
    cleanup()
    const rich = setup({ furnace: { ...built, levels: { ...built.levels, fireCap: 1, batch: 2 } }, cash: 1e4, inventory: { copperBar: 30 } })
    expect(upgrade(/^Fire cap/).textContent).toBe(`Fire cap 20 → 40${BAR}⁠8 💰⁠300`)
    fireEvent.click(upgrade(/^Fire cap/))
    fireEvent.click(upgrade(/^Smart furnace/))
    rich.rerender()
    expect(rich.get().run.furnace).toMatchObject({ smart: true, levels: { fireCap: 2, batch: 2 } })
    expect(screen.queryByRole('button', { name: /^Smart furnace/ })).toBeNull()
    // batch 33: fire cap Lv3 is an iron-bar row
    expect(upgrade(/^Fire cap/).textContent).toBe(`Fire cap 40 → 80${IRON_BAR}⁠6 💰⁠7,500 · Not enough items`)
    expect(t.get().run.furnace.levels.fireCap).toBe(0)
    // the recipe line follows the batch level: 6 ore → 3 bars per cycle
    expect(text()).toContain(`${ORE}6 + ⚫1 or ${WOOD}2 → ${BAR}3 · 60 s`)
    cleanup()
    // every row hides at its max level
    setup({ furnace: { ...built, smart: true, collectAll: true, levels: { fireCap: 4, batch: 4, speed: 2, tray: 2, slot: 2 } }, cash: 1e6 })
    expect(screen.queryByRole('button', { name: /^(Fire cap|Batch|Speed|Tray|Ore slot|Smart furnace|Collect all)/ })).toBeNull()
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

  it('iron pickaxe: offered from vein Lv3 over a copper one, crafted from iron bars, repaired with iron bars', () => {
    const copper = { rack: { wooden: 25, copper: 200 }, selectedPickaxe: 'copper' as const }
    setup({ furnace: built, vein: { level: 2, progress: 0, rock: 'stone' }, ...copper })
    expect(screen.queryByRole('button', { name: /^Craft/ })).toBeNull()
    cleanup()
    const lv3 = { level: 3, progress: 0, rock: 'stone' as const }
    setup({ furnace: built, vein: lv3, ...copper, cash: 200, inventory: { ironBar: 4 } })
    expect(screen.getByRole('button', { name: /^Craft/ }).textContent).toBe(`Craft iron pickaxe (${IRON_BAR}⁠5 💰⁠200) — Not enough items`)
    cleanup()
    const t = setup({ furnace: built, vein: lv3, ...copper, cash: 200, inventory: { ironBar: 5 } })
    fireEvent.click(screen.getByRole('button', { name: /^Craft iron pickaxe/ }))
    t.rerender()
    expect(text()).toContain('Iron pickaxe 1200 / 1200')
    // nothing above iron yet; every owned tier stays on the rack, so nothing below is offered either
    expect(screen.queryByRole('button', { name: /^Craft/ })).toBeNull()
    cleanup()
    setup({ furnace: built, vein: lv3, pickaxe: { tier: 'iron', durability: 0 }, inventory: { ironBar: 2 } })
    expect((screen.getByRole('button', { name: `Blunt iron pickaxe — repair (${IRON_BAR}⁠2)` }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('batch 32: the rack row lists every owned tier, the selected one pressed; a press selects it (the batch-28.1 "instead" escape is gone)', () => {
    const t = setup({ furnace: built, rack: { wooden: 25, iron: 0, gold: 300 }, selectedPickaxe: 'gold', cash: 200, inventory: { ironBar: 5 } })
    const rackRow = () => within(screen.getByRole('group', { name: 'Pickaxe rack' }))
    expect(rackRow().getAllByRole('button').map((b) => [b.textContent, b.getAttribute('aria-pressed')])).toEqual([
      ['Wooden pickaxe25/25', 'false'],
      ['Iron pickaxeblunt', 'false'],
      ['Gold pickaxe300/600', 'true'],
    ])
    expect(screen.queryByRole('button', { name: /instead/ })).toBeNull()
    fireEvent.click(rackRow().getByRole('button', { name: /^Iron pickaxe/ }))
    t.rerender()
    expect(t.get().run.selectedPickaxe).toBe('iron')
    expect(screen.getByRole('button', { name: `Blunt iron pickaxe — repair (${IRON_BAR}⁠2)` })).toBeTruthy()
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

  // re-pinned batch 34 (was 💰2 each, disposal): bars 🥉100 🥈500 🥇1000
  it('batch 24: bars sell through the shared item grid — sell 1 pays their price, sell all clears them', () => {
    const t = setup({ cash: 0, inventory: { copperBar: 2, wood: 1 } })
    expect(document.querySelector('.mine .item-grid')).toBeTruthy()
    const barRow = () => screen.getByText(`${BAR} Copper bar`).closest('.item-row') as HTMLElement
    // the price-each column, ×N count and both sell buttons; every mine item is sellable since bars joined
    expect(barRow().textContent).toBe(`${BAR} Copper bar×2💰100sell 1sell all`)
    const woodRow = () => screen.getByText(`${WOOD} Wood`).closest('.item-row')!
    // batch 32: the sort column left the grid for the 🧺 Ore sorting table
    expect([...woodRow().children].map((c) => c.textContent)).toEqual([`${WOOD} Wood`, '×1', '💰2', 'sell 1', 'sell all'])
    fireEvent.click(within(barRow()).getByRole('button', { name: 'sell 1' }))
    t.rerender()
    expect([t.get().run.cash, t.get().run.inventory.copperBar]).toEqual([100, 1])
    fireEvent.click(within(barRow()).getByRole('button', { name: 'sell all' }))
    t.rerender()
    expect([t.get().run.cash, t.get().run.inventory.copperBar]).toEqual([200, 0])
  })

  it('batch 24.1: the grid sits inside its .item-grid-wrap, every row holds exactly 5 cells, the recipe is two lines', () => {
    setup({ furnace: built, inventory: { copperBar: 2, wood: 1 } })
    // both users render through the wrapper: the sell list here, the seed pouch in the Farm tab (Shop tests)
    expect(document.querySelector('.mine .item-grid-wrap .item-grid')).toBeTruthy()
    // batch 32: name | count | extra | sell 1 | sell all (the sort column moved to 🧺 Ore sorting)
    for (const row of document.querySelectorAll('.mine .item-row')) expect(row.children).toHaveLength(5)
    const recipe = document.querySelector('.mine-furnace .furnace-recipe')!
    const stock = document.querySelector('.mine-furnace .furnace-stock')!
    expect(recipe.textContent).toBe(`${ORE}2 + ⚫1 or ${WOOD}2 → ${BAR}1 · 60 s`)
    // batch 33: the stock line names each owned mold's ore by its emoji
    expect(stock.textContent).toBe(`have: ${ORE} 0 · coal 0 · wood 1`)
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

describe('batch 32: 🧺 ore sorting table', () => {
  const vein = (level: number) => ({ level, progress: 0, rock: 'stone' as const })
  const group = () => screen.queryByRole('heading', { name: '🧺 Ore sorting' })?.parentElement ?? null
  const kinds = () => [...(group()?.querySelectorAll('.sort-row') ?? [])].map((r) => r.querySelector('span')!.textContent)

  it('vein Lv2 shows no sorting group; vein Lv3 shows one row per kind: name + unlock price, an Unlock button, the hint', () => {
    setup({ vein: vein(2) })
    expect(group()).toBeNull()
    cleanup()
    const t = setup({ vein: vein(3) })
    const cash = price(oreSortUnlockCost('stone', t.get().meta).cash)
    expect(kinds()).toEqual([
      `${STONE} Stone ${STONE}⁠30 💰⁠${cash}`,
      `⚫ Coal ⚫⁠15 💰⁠${cash}`,
      `${ORE} Copper ore ${ORE}⁠15 💰⁠${cash}`,
      `${IRON_ORE} Iron ore ${IRON_ORE}⁠15 💰⁠${cash}`,
      `${ITEMS.goldOre.emoji} Gold ore ${ITEMS.goldOre.emoji}⁠10 💰⁠${cash}`,
    ])
    expect(group()!.textContent).toContain('Checked kinds sell the moment you dig them past the amount you keep, so the miner never stops on a full storage.')
    // disabled with the action's reason
    expect(within(group()!).getAllByRole('button')[0].textContent).toBe('UnlockNot enough items')
    expect(within(group()!).queryAllByRole('checkbox')).toHaveLength(0)
  })

  it('an unlocked kind shows a Sell on dig checkbox (no price) that calls setOreSort both ways; the grid has no sort column', () => {
    const cash = oreSortUnlockCost('stone', createInitialState().meta).cash
    const t = setup({ vein: vein(3), cash, inventory: { stone: 30 }, bagCapacity: 60 })
    fireEvent.click(within(group()!).getAllByRole('button')[0])
    t.rerender()
    expect(t.get().run.oreSort).toEqual({ stone: 'keep' })
    expect(kinds()[0]).toBe(`${STONE} Stone`)
    expect(within(group()!).getAllByRole('button', { name: /^Unlock/ })).toHaveLength(4)
    const box = () => screen.getByRole('checkbox', { name: 'Sell Stone on dig' }) as HTMLInputElement
    expect([box().checked, box().closest('label')!.textContent]).toEqual([false, 'Sell on dig'])
    fireEvent.click(box())
    t.rerender()
    expect([t.get().run.oreSort, box().checked]).toEqual([{ stone: 'sell' }, true])
    fireEvent.click(box())
    t.rerender()
    expect(t.get().run.oreSort).toEqual({ stone: 'keep' })
    // the stone row left the grid at ×0 (stone 30 was spent on the unlock)
    expect(document.querySelector('.mine .item-grid')!.textContent).not.toContain('Stone')
  })

  it('Keep N: the buy row until owned, then a keep-up-to stepper per unlocked kind (step 10, disabled while unchecked)', () => {
    const rich = { vein: vein(3), cash: 7000, inventory: { ironBar: 10, goldBar: 5 }, bagCapacity: 50, oreSort: { stone: 'sell' as const, coal: 'keep' as const } }
    const t = setup(rich)
    const buy = () => within(group()!).getByRole('button', { name: /^Buy/ }) as HTMLButtonElement
    expect(group()!.querySelector('.sort-buy > span')!.textContent).toBe(
      `🧺 Keep N — keep some of each checked kind, sell only the excess — ${IRON_BAR}⁠10 ${ITEMS.goldBar.emoji}⁠5 💰⁠7,000`,
    )
    expect(screen.queryByRole('group', { name: /^Keep up to/ })).toBeNull()
    fireEvent.click(buy())
    t.rerender()
    expect(t.get().run.keepN).toBe(true)
    expect(within(group()!).queryByRole('button', { name: /^Buy/ })).toBeNull()
    expect(group()!.textContent).toContain('keep up to')
    // stone (checked) and coal (unchecked) get a stepper; the locked kinds none
    const more = (name: string) => screen.getByRole('button', { name: `Keep 10 more ${name}` }) as HTMLButtonElement
    const fewer = (name: string) => screen.getByRole('button', { name: `Keep 10 fewer ${name}` }) as HTMLButtonElement
    expect(screen.getAllByRole('group', { name: /^Keep up to/ }).map((g) => g.getAttribute('aria-label'))).toEqual(['Keep up to 0 Stone', 'Keep up to 0 Coal'])
    expect([more('Coal').disabled, fewer('Stone').disabled, more('Stone').disabled]).toEqual([true, true, false])
    fireEvent.click(more('Stone'))
    t.rerender()
    fireEvent.click(more('Stone'))
    t.rerender()
    expect(t.get().run.oreKeep).toEqual({ stone: 20 })
    expect(screen.getByRole('group', { name: 'Keep up to 20 Stone' }).textContent).toBe('−20+')
    fireEvent.click(fewer('Stone'))
    t.rerender()
    expect(t.get().run.oreKeep).toEqual({ stone: 10 })
    cleanup()
    setup({ ...rich, inventory: {} })
    expect(buy().disabled).toBe(true)
    expect(buy().textContent).toBe('BuyNot enough items')
  })

  it('the table stays once every kind is unlocked: five checkboxes, no Unlock button', () => {
    setup({ vein: vein(4), oreSort: { stone: 'sell', coal: 'keep', copperOre: 'sell', ironOre: 'sell', goldOre: 'sell' } })
    expect(group()).not.toBeNull()
    const boxes = within(group()!).getAllByRole('checkbox') as HTMLInputElement[]
    expect(boxes.map((b) => [b.getAttribute('aria-label'), b.checked])).toEqual([
      ['Sell Stone on dig', true],
      ['Sell Coal on dig', false],
      ['Sell Copper ore on dig', true],
      ['Sell Iron ore on dig', true],
      ['Sell Gold ore on dig', true],
    ])
    expect(within(group()!).queryAllByRole('button', { name: /^Unlock/ })).toHaveLength(0)
  })
})
