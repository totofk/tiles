// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Mine } from '../src/app/Mine'
import type { Act } from '../src/app/useGame'
import { itemSellPrice, oreSortUnlockCost, pickaxeDurability } from '../src/core/balance'
import { ITEMS } from '../src/core/data/items'
import { price } from '../src/app/fmt'
import { createFields, createFurnace, createInitialState, type FloorState, type GameState, type Pickaxe } from '../src/core/state'
import type { ItemId } from '../src/core/data/items'

afterEach(cleanup)
const built = { ...createFurnace(), built: true }
const WOOD = ITEMS.wood.emoji
const STONE = ITEMS.stone.emoji
const ORE = ITEMS.copperOre.emoji
const BAR = ITEMS.copperBar.emoji
const IRON_ORE = ITEMS.ironOre.emoji
const IRON_BAR = ITEMS.ironBar.emoji
const GOLD_ORE = ITEMS.goldOre.emoji

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
/** a hand-built floor: `kinds` = one ItemId for all 12 rocks, or the 12 kinds themselves */
const floorOf = (n: number, kinds: ItemId | readonly ItemId[], ladder = 0, found = false): FloorState => ({
  n,
  deepest: n,
  rocks: (typeof kinds === 'string' ? Array.from({ length: 12 }, () => kinds) : [...kinds]).map((kind) => ({ kind, hits: 0, broken: false })),
  ladder,
  found,
  rng: 123,
})
/** 12 kinds with `first` in cell 0, `rest` everywhere else */
const kinds12 = (first: ItemId, rest: ItemId = 'stone') => [first, ...Array.from({ length: 11 }, () => rest)]

describe('Mine panel', () => {
  it('batch 37: floor 1 status + the zone drop line (the old Lv0 table); no coming-teaser', () => {
    setup({})
    expect(document.querySelector('.floor-status')!.textContent).toBe('Floor 1 · Row 1/3 · ⛏️ 12 left · ⬇️ not found')
    expect(document.querySelector('.mine-vein .vein-label')!.textContent).toBe(`Floor 1 · ${STONE} Stone zone: `)
    expect([...document.querySelectorAll('.mine-vein .vein-drops .vein-drop')].map((d) => d.textContent!.trim())).toEqual([`${STONE} Stone 100 %`])
    expect(screen.queryByText(/coming/)).toBeNull()
  })

  it('batch 37: the seal to zone 1: Break seal is disabled with the reason until it is affordable, then opens floor 6', () => {
    const at = { cash: 100, inventory: { stone: 24 }, floor: floorOf(5, 'stone', 11, true) }
    setup(at)
    const seal = () => screen.getByRole('button', { name: /^Break seal/ }) as HTMLButtonElement
    expect(screen.getByText(/^🔒 Seal to floor 6/).textContent).toBe(`🔒 Seal to floor 6 · ⚫ Coal zone: ${STONE}⁠25 💰⁠100`)
    // 25 stone cannot fit the starting 20 slots: the reason names the storage to buy
    expect(seal().textContent).toBe('Break seal — Needs 📦 25 storage')
    expect(seal().disabled).toBe(true)
    cleanup()
    setup({ ...at, bagCapacity: 30 })
    expect(seal().textContent).toBe('Break seal — Not enough items')
    cleanup()
    const t = setup({ cash: 100, inventory: { stone: 25 }, floor: floorOf(5, 'stone', 11, true) })
    fireEvent.click(seal())
    t.rerender()
    expect(t.get().run.vein.level).toBe(1)
    expect(t.get().run.floor.n).toBe(6)
    // the next seal is floor 10, not here
    expect(screen.queryByRole('button', { name: /^Break seal/ })).toBeNull()
  })

  it('batch 37: zone 2 (copper) needs the furnace: the seal says so until it is built', () => {
    const rich = { cash: 1e3, inventory: { stone: 30, coal: 10 }, bagCapacity: 40, vein: { level: 1, progress: 0, rock: 'stone' as const }, floor: floorOf(10, 'stone', 11, true) }
    setup(rich)
    expect(screen.getByText(/^🔒 Seal to floor 11/).textContent).toBe(`🔒 Seal to floor 11 · ${ORE} Copper zone: ${STONE}⁠30 ⚫⁠10 💰⁠200`)
    expect(screen.getByRole('button', { name: /^Break seal/ }).textContent).toBe('Break seal — Build the furnace first')
    cleanup()
    setup({ ...rich, furnace: built })
    expect((screen.getByRole('button', { name: /^Break seal/ }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('batch 37: zone 4 (gold) needs the iron pickaxe: the seal shows the gold price and says so over copper', () => {
    const lv3 = { cash: 7500, inventory: { stone: 45, ironBar: 8 }, bagCapacity: 60, furnace: built, vein: { level: 3, progress: 0, rock: 'stone' as const }, floor: floorOf(20, 'stone', 11, true) }
    setup({ ...lv3, pickaxe: { tier: 'copper', durability: 100 } })
    expect(screen.getByText(/^🔒 Seal to floor 21/).textContent).toBe(`🔒 Seal to floor 21 · ${GOLD_ORE} Gold zone: ${STONE}⁠45 ${IRON_BAR}⁠8 💰⁠7,500`)
    expect(screen.getByRole('button', { name: /^Break seal/ }).textContent).toBe('Break seal — Needs the iron pickaxe')
    cleanup()
    const t = setup({ ...lv3, pickaxe: { tier: 'iron', durability: 100 } })
    fireEvent.click(screen.getByRole('button', { name: /^Break seal/ }))
    t.rerender()
    expect(t.get().run.vein.level).toBe(4)
    expect(t.get().run.floor.n).toBe(21)
    // the gold pickaxe is offered once the zone drops gold ore (never at zone 3)
    expect(screen.getByRole('button', { name: /^Craft gold pickaxe/ }).textContent).toBe(`Craft gold pickaxe (${ITEMS.goldBar.emoji}⁠5 💰⁠500) — Not enough items`)
  })

  it('batch 37: floor 21 shows the gold zone table (the old Lv4 numbers); no fifth-zone teaser', () => {
    setup({ vein: { level: 4, progress: 0, rock: 'goldOre' }, pickaxe: { tier: 'iron', durability: 100 }, floor: floorOf(21, 'stone') })
    expect(document.querySelector('.mine-vein .vein-label')!.textContent).toBe(`Floor 21 · ${GOLD_ORE} Gold zone: `)
    expect([...document.querySelectorAll('.mine-vein .vein-drops .vein-drop')].map((d) => d.textContent!.trim())).toEqual([
      `${STONE} Stone 50 %`,
      `⚫ Coal 20 %`,
      `${ORE} Copper ore 12 %`,
      `${IRON_ORE} Iron ore 10 %`,
      `${GOLD_ORE} Gold ore 8 %`,
    ])
    expect(screen.queryByText(/coming/)).toBeNull()
  })

  it('shows the target rock and its hits: a copper rock takes 3, a half-hit one is cracked', () => {
    setup({ floor: floorOf(1, kinds12('copperOre')), pickaxe: wooden() })
    expect(screen.getByRole('button', { name: /Mine next/ }).textContent).toContain(`${ORE} 0/3`)
    expect(document.querySelectorAll('.floor-grid button')[0]!.textContent).toBe(`${ORE} 0/3`)
    cleanup()
    const g = floorOf(1, 'stone')
    setup({ floor: { ...g, rocks: g.rocks.map((r, i) => (i === 0 ? { ...r, hits: 1 } : r)) }, pickaxe: wooden() })
    expect(screen.getByRole('button', { name: /Mine next/ }).textContent).toContain(`${STONE} cracked 1/2`)
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

  it('batch 32: the pickaxe group renders between Mine next and the vein: rack, status, craft row (unowned offered tiers only), mastery', () => {
    setup({ furnace: built, vein: { level: 3, progress: 0, rock: 'stone' }, rack: { wooden: 0, copper: 120 }, selectedPickaxe: 'copper', masteredTiers: ['wooden'], mastery: { wooden: 400 }, floor: floorOf(16, 'stone') })
    const section = document.querySelector('.mine')!
    const dig = screen.getByRole('button', { name: /Mine next/ })
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

  it('batch 36.4: ⛰️ stone fuel needs the Stone fire relic — no button without it, 2 fire units with it', () => {
    setup({ furnace: built, inventory: { stone: 5 } })
    expect(screen.queryByRole('button', { name: /^Fill with ⛰️/ })).toBeNull()
    cleanup()
    const t = setup({ furnace: built, inventory: { stone: 1 }, relics: ['stoneFuel'] })
    const stone = () => screen.getByRole('button', { name: /^Fill with ⛰️/ }) as HTMLButtonElement
    expect(stone().textContent).toBe(`Fill with ${STONE} stoneuses 1`)
    fireEvent.click(stone())
    t.rerender()
    expect([t.get().run.furnace.fire, t.get().run.inventory.stone]).toEqual([60, 0])
  })

  it('batch 35.2: the fuel row has an Auto-buy wood toggle, off by default; the fill buttons do not change', () => {
    const t = setup({ furnace: built })
    const box = screen.getByRole('checkbox', { name: /^Auto-buy wood 💰4 into the fire/ }) as HTMLInputElement
    expect(box.checked).toBe(false)
    fireEvent.click(box)
    t.rerender()
    expect(t.get().run.autoBuyWood).toBe(true)
    expect([t.get().run.cash, t.get().run.furnace.fire]).toEqual([createInitialState().run.cash, 0])
  })

  it('batch 35.2: one status line per active blocker under 📦 Storage, none when nothing blocks', () => {
    const lines = () => [...document.querySelectorAll('.mine-status')].map((e) => e.textContent)
    const miner = { workers: { ...createInitialState().run.workers, assigned: { ...createInitialState().run.workers.assigned, mine: 1 } } }
    setup({ pickaxe: wooden(), ...miner })
    expect(lines()).toEqual([])
    cleanup()
    setup({ pickaxe: wooden(), inventory: { stone: 20 } })
    expect(lines()).toEqual(['⚠️ Storage full: miners stopped, Sell-on-dig finds are sold'])
    cleanup()
    setup({ pickaxe: wooden(0), ...miner })
    expect(lines()).toEqual(['⚠️ Pickaxe blunt: miners idle until you repair it'])
    cleanup()
    // blunt with no miner assigned: no line
    setup({ pickaxe: wooden(0) })
    expect(lines()).toEqual([])
    cleanup()
    // Σ Keep N of Sell-on-dig kinds (coal on Keep does not count) + bars after the Tractor
    const keeps = { keepN: true, bagCapacity: 120, oreSort: { coal: 'sell' as const, stone: 'sell' as const, copperOre: 'keep' as const }, oreKeep: { coal: 50, stone: 30, copperOre: 40 } }
    setup({ ...keeps, barKeep: { ironBar: 50 } })
    expect(lines()).toEqual([])
    cleanup()
    setup({ ...keeps, barKeep: { ironBar: 50 }, fields: { ...createFields(), unlocked: true } })
    expect(lines()).toEqual(['⚠️ Keeps add up to 130, storage holds 120'])
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
    // every row hides at its max level, except speed and batch (batch 34): disabled, "max · more in ⭐ Favours"
    setup({ furnace: { ...built, smart: true, collectAll: true, levels: { fireCap: 4, batch: 4, speed: 2, tray: 2, slot: 2 } }, cash: 1e6 })
    expect(screen.queryByRole('button', { name: /^(Fire cap|Tray|Ore slot|Smart furnace|Collect all)/ })).toBeNull()
    const maxed = ['Speed: cycles 64 %', 'Batch 5 bars'].map((label) => screen.getByRole('button', { name: new RegExp(`^${label}`) }) as HTMLButtonElement)
    expect(maxed.map((b) => [b.disabled, b.querySelector('small')!.textContent])).toEqual([
      [true, 'max · more in ⭐ Favours'],
      [true, 'max · more in ⭐ Favours'],
    ])
  })

  it('the seal to zone 3 (iron): priced for storage Lv3, and a hint while the pickaxe is too weak for iron', () => {
    const lv2 = { cash: 400, furnace: built, vein: { level: 2, progress: 0, rock: 'stone' as const }, floor: floorOf(15, 'stone', 11, true) }
    setup({ ...lv2, bagCapacity: 40, inventory: { stone: 35, copperBar: 5 }, pickaxe: wooden() })
    expect(screen.getByText(/^🔒 Seal to floor 16/).textContent).toBe(`🔒 Seal to floor 16 · ${IRON_ORE} Iron zone: ${STONE}⁠40 ${BAR}⁠5 💰⁠400`)
    expect(screen.getByRole('button', { name: /^Break seal/ }).textContent).toBe('Break seal — Needs 📦 45 storage')
    expect(screen.getByText(/needs a copper pickaxe/).textContent).toBe(`${IRON_ORE} Iron ore needs a copper pickaxe or better, else it is mined as ${STONE} stone`)
    cleanup()
    const t = setup({ ...lv2, bagCapacity: 50, inventory: { stone: 40, copperBar: 5 }, pickaxe: { tier: 'copper', durability: 200 } })
    expect(screen.queryByText(/needs a copper pickaxe/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /^Break seal/ }))
    t.rerender()
    expect(t.get().run.vein.level).toBe(3)
    expect(t.get().run.floor.n).toBe(16)
  })

  it('batch 13: iron is open to everyone: on zone 2 the zone-3 seal and the iron hint show, no locked-level teaser', () => {
    setup({ cash: 400, furnace: built, vein: { level: 2, progress: 0, rock: 'stone' }, floor: floorOf(15, 'stone', 11, true), bagCapacity: 50, inventory: { stone: 40, copperBar: 5 }, pickaxe: wooden() })
    expect(screen.getByRole('button', { name: /^Break seal/ })).toBeTruthy()
    expect(screen.getByText(/needs a copper pickaxe/)).toBeTruthy()
    expect(screen.queryByText(/— coming/)).toBeNull()
  })

  it('an iron rock shows "as stone" with stone hits below a copper pickaxe, its own 4 hits with one', () => {
    setup({ vein: { level: 3, progress: 0, rock: 'ironOre' }, floor: floorOf(16, kinds12('ironOre')), pickaxe: wooden() })
    expect(screen.getByRole('button', { name: /Mine next/ }).textContent).toContain(`· ${IRON_ORE} as ${STONE} 0/2`)
    expect(document.querySelectorAll('.floor-grid button')[0]!.textContent).toBe(`${IRON_ORE} as ${STONE} 0/2`)
    expect(screen.getByText(/needs a copper pickaxe/)).toBeTruthy()
    cleanup()
    const g = floorOf(16, kinds12('ironOre'))
    setup({ vein: { level: 3, progress: 0, rock: 'ironOre' }, floor: { ...g, rocks: g.rocks.map((r, i) => (i === 0 ? { ...r, hits: 3 } : r)) }, pickaxe: { tier: 'copper', durability: 200 } })
    expect(screen.getByRole('button', { name: /Mine next/ }).textContent).toContain(`${IRON_ORE} cracked 3/4`)
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

  it("a mine worker press flashes the miners' line and pops ⛏️; no line without a mine worker", () => {
    const s = createInitialState()
    const workers = { ...s.run.workers, assigned: { ...s.run.workers.assigned, mine: 1 } }
    const state: GameState = { ...s, run: { ...s.run, mineLicense: true, workers } }
    const { rerender } = render(<Mine state={state} act={() => {}} />)
    const line = () => document.querySelector('.mine-miners')!
    expect(line().classList.contains('mine-flash')).toBe(false)
    expect(line().querySelector('.cell-pop')).toBeNull()
    rerender(<Mine state={state} act={() => {}} minerActed />)
    expect(line().classList.contains('mine-flash')).toBe(true)
    expect(line().querySelector('.cell-pop')!.textContent).toBe('⛏️')
    cleanup()
    const noWorker: GameState = { ...s, run: { ...s.run, mineLicense: true } }
    render(<Mine state={noWorker} act={() => {}} />)
    expect(document.querySelector('.mine-miners')).toBeNull()
  })

  it('when storage is full, sells the stone from the panel and keeps the wood and the coal (it fuels the Fields tank)', () => {
    const t = setup({ cash: 0, inventory: { stone: 15, coal: 3, wood: 2 } })
    expect(screen.getByRole('button', { name: /Mine next/ }).textContent).toContain('Storage is full')
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
    expect(screen.getByRole('button', { name: /Mine next/ }).textContent).toContain('Storage is full')
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

  it('bars Keep N (batch 35.2): three bar rows after the Tractor, off → 0 → 10 and back to off; hidden before it', () => {
    const owned = { vein: vein(4), keepN: true, bagCapacity: 120, oreSort: { stone: 'sell' as const } }
    setup(owned)
    expect(screen.queryByRole('group', { name: /Copper bar$/ })).toBeNull()
    cleanup()
    const t = setup({ ...owned, fields: { ...createFields(), unlocked: true } })
    const rows = screen.getAllByRole('group', { name: /bar$/ }).map((g) => g.getAttribute('aria-label'))
    expect(rows).toEqual(['Keep up to all Copper bar', 'Keep up to all Iron bar', 'Keep up to all Gold bar'])
    expect(screen.getByRole('group', { name: 'Keep up to all Iron bar' }).textContent).toBe('−off+')
    const more = () => screen.getByRole('button', { name: 'Keep 10 more Iron bar' })
    const fewer = () => screen.getByRole('button', { name: 'Keep 10 fewer Iron bar' }) as HTMLButtonElement
    expect(fewer().disabled).toBe(true)
    fireEvent.click(more())
    t.rerender()
    fireEvent.click(more())
    t.rerender()
    expect(t.get().run.barKeep).toEqual({ ironBar: 10 })
    fireEvent.click(fewer())
    t.rerender()
    fireEvent.click(fewer())
    t.rerender()
    expect(t.get().run.barKeep).toEqual({})
    // bar rows carry no Sell on dig checkbox
    expect(within(group()!).getAllByRole('checkbox')).toHaveLength(1)
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

describe('batch 36.2: the 🔨 Forge card', () => {
  const ironHills = { district: 'ironHills' as const, soil: null }

  it('only on an Iron Hills run: before the build, the line and the build price; disabled "furnace first" without one', () => {
    setup({ furnace: built })
    expect(screen.queryByText(/🔨 Forge/)).toBeNull()
    cleanup()
    setup({ listing: ironHills })
    expect(screen.getByText('🔨 Forge · stamps bars into goods for orders')).toBeTruthy()
    const build = screen.getByRole('button', { name: /Build forge/ }) as HTMLButtonElement
    expect(build.disabled).toBe(true)
    expect(build.textContent).toContain(`${STONE}⁠30 ⚫⁠10 ${BAR}⁠5 💰⁠1,500`)
    expect(build.textContent).toMatch(/furnace/i)
    cleanup()
    const t = setup({ listing: ironHills, furnace: built, cash: 2000, inventory: { stone: 30, coal: 10, copperBar: 5 } })
    fireEvent.click(screen.getByRole('button', { name: /Build forge/ }))
    expect(t.get().run.forge.built).toBe(true)
  })

  it('after the build: recipe rows + Off, Load one, the status line, Tray n / 10 and Collect', () => {
    const forge = { built: true, recipe: null, job: null, progress: 0, tray: {} }
    const t = setup({ listing: ironHills, furnace: built, forge, inventory: { copperBar: 4, coal: 1 } })
    const recipes = within(screen.getByRole('group', { name: 'Forge recipe' })).getAllByRole('button')
    expect(recipes.map((b) => b.textContent)).toEqual([`🔧 Toolbox · ${BAR}⁠4 ⚫⁠1 → 💰520`, `⚙️ Plough blade · ${IRON_BAR}⁠2 ⚫⁠1 → 💰1,250`, `⛓️ Anchor chain · 🥇⁠3 ⚫⁠2 → 💰3,600`, 'Off'])
    expect(recipes.map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'false', 'true'])
    expect(screen.getByText('Idle')).toBeTruthy()
    expect((screen.getByRole('button', { name: /Load one/ }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByRole('button', { name: /^Collect\s*Tray/ }).textContent).toBe('CollectTray 0 / 10')
    fireEvent.click(recipes[0])
    t.rerender()
    fireEvent.click(screen.getByRole('button', { name: /Load one/ }))
    t.rerender()
    expect(t.get().run.forge.job).toBe('toolbox')
    expect(screen.getByText('Stamping 🔧 · 0 / 300 s')).toBeTruthy()
    cleanup()
    setup({ listing: ironHills, furnace: built, forge: { ...forge, job: 'toolbox', progress: 300, tray: { toolbox: 10 } } })
    expect(screen.getByText('Tray full')).toBeTruthy()
    expect(screen.getByRole('button', { name: /^Collect\s*Tray/ }).textContent).toBe('CollectTray 10 / 10')
    cleanup()
    // batch 36.7: a full bag shows the short reason on the Collect button itself
    setup({ listing: ironHills, furnace: built, forge: { ...forge, job: 'toolbox', progress: 300, tray: { toolbox: 1 } }, inventory: { stone: 20 } })
    expect(screen.getByRole('button', { name: /^Collect\s*Tray/ }).textContent).toBe('CollectTray 1 / 10storage full')
  })
})

describe('batch 36.3: the 🌊 River view (Wetlands, no mine)', () => {
  const wetlands = { district: 'wetlands' as const, soil: null }
  const bargeRow = (name: string) => screen.getByText(new RegExp(`^${ITEMS[name as 'coal'].emoji} ${ITEMS[name as 'coal'].name} 💰`)).closest('.mine-furnace-actions') as HTMLElement

  it('a no-mine run shows the River: storage count, 5 barge rows with prices and ×1 / ×10, the item grid; no Dig / licence / vein / furnace', () => {
    const t = setup({ mineLicense: false, listing: wetlands, cash: 200, inventory: { stone: 4 } })
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('🌊 River 📦 Storage 4 / 20')
    expect(document.querySelector('.mine-river')).toBeTruthy()
    const prices = { copperBar: 125, ironBar: 625, goldBar: 1250, stone: 3, coal: 5 }
    for (const [id, p] of Object.entries(prices)) {
      const r = bargeRow(id)
      expect(r.querySelector('span')!.textContent).toBe(`${ITEMS[id as 'coal'].emoji} ${ITEMS[id as 'coal'].name} 💰${price(p)}`)
      expect([...r.querySelectorAll('button')].map((b) => b.firstChild?.textContent)).toEqual(['×1', '×10'])
    }
    // 💰200: ×10 coal (💰50) fits, ×1 gold bar does not; the reason is the error's short text
    const [gold1] = [...bargeRow('goldBar').querySelectorAll('button')]
    expect(gold1.disabled).toBe(true)
    expect(gold1.textContent).toMatch(/^×1.+/)
    const [, coal10] = [...bargeRow('coal').querySelectorAll('button')]
    expect(coal10.disabled).toBe(false)
    fireEvent.click(coal10)
    t.rerender()
    expect([t.get().run.cash, t.get().run.inventory.coal]).toEqual([150, 10])
    expect(screen.getByText(`${ITEMS.coal.emoji} ${ITEMS.coal.name}`, { selector: '.item-label' })).toBeTruthy()
    expect(screen.getByText(`${STONE} ${ITEMS.stone.name}`, { selector: '.item-label' })).toBeTruthy()
    expect(text()).not.toMatch(/Dig|Mine license|Vein|Furnace|Buy wood|Ore sorting/)
  })

  it('plain shows the Mine as today (no barge); a grandfathered Wetlands run shows the Mine plus the barge under the item grid', () => {
    setup({})
    expect(screen.getByRole('heading', { level: 2 }).textContent).toMatch(/^⛏️ Mine/)
    expect(screen.queryByText(/🌊 Barge/)).toBeNull()
    cleanup()
    setup({ listing: wetlands, inventory: { stone: 2 } })
    expect(screen.getByRole('heading', { level: 2 }).textContent).toMatch(/^⛏️ Mine/)
    expect(screen.getByRole('button', { name: /Mine next/ })).toBeTruthy()
    const grid = document.querySelector('.item-grid-wrap')!
    const barge = document.querySelector('.mine-barge')!
    expect(grid.compareDocumentPosition(barge) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})

describe('batch 37: floors', () => {
  it('the grid renders 12 cells; rows past the open row are dimmed and inert; a tap mines that rock', () => {
    const t = setup({ floor: floorOf(1, 'stone'), pickaxe: wooden() })
    const cells = [...document.querySelectorAll('.floor-grid button')] as HTMLButtonElement[]
    expect(cells).toHaveLength(12)
    expect(cells.map((c) => c.getAttribute('aria-disabled'))).toEqual([null, null, null, null, 'true', 'true', 'true', 'true', 'true', 'true', 'true', 'true'])
    fireEvent.click(cells[0]!)
    t.rerender()
    // wooden hits 2 = stone's 2, so one press breaks (and pays) the rock
    expect(t.get().run.floor.rocks[0]!.broken).toBe(true)
    expect(t.get().run.inventory.stone).toBe(1)
    fireEvent.click(cells[8]!)
    t.rerender()
    expect(t.get().run.floor.rocks[8]!.broken).toBe(false)
    expect(t.get().run.floor.rocks[8]!.hits).toBe(0)
  })

  it('⬇️ Down appears only with the ladder found and descends one floor (deepest follows)', () => {
    setup({ floor: floorOf(1, 'stone', 5) })
    expect(screen.queryByRole('button', { name: /^⬇️ Down/ })).toBeNull()
    cleanup()
    const t = setup({ floor: floorOf(3, 'stone', 5, true) })
    fireEvent.click(screen.getByRole('button', { name: /^⬇️ Down to floor 4/ }))
    t.rerender()
    expect(t.get().run.floor.n).toBe(4)
    expect(t.get().run.floor.deepest).toBe(4)
  })

  it('the ↕️ elevator rides to each built zone checkpoint and marks the current one pressed', () => {
    const t = setup({ vein: { level: 2, progress: 0, rock: 'stone' }, floor: floorOf(11, 'stone') })
    const buttons = () => [...screen.getByRole('group', { name: 'Elevator' }).querySelectorAll('button')]
    expect(buttons().map((b) => b.textContent)).toEqual(['Floor 1', 'Floor 6', 'Floor 11'])
    expect(buttons().map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'true'])
    fireEvent.click(buttons()[1]!)
    t.rerender()
    expect(t.get().run.floor.n).toBe(6)
    expect(screen.getByRole('group', { name: 'Elevator' }).querySelectorAll('button')[1]!.getAttribute('aria-pressed')).toBe('true')
  })

  it('floor 25 is the bottom: the way down is blocked, no seal, no Down', () => {
    setup({ vein: { level: 4, progress: 0, rock: 'goldOre' }, floor: floorOf(25, 'stone', 5, true) })
    expect(screen.getByText(/The way down is blocked/).textContent).toBe('The way down is blocked — deeper zones come later')
    expect(screen.queryByRole('button', { name: /^⬇️ Down/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Break seal/ })).toBeNull()
  })

  it("the miners' line: Deepest default, the zone picker follows setMinerZone, their rock shown", () => {
    const base = createInitialState().run.workers
    const t = setup({
      vein: { level: 2, progress: 1, rock: 'copperOre' },
      workers: { ...base, assigned: { ...base.assigned, mine: 1 } },
      pickaxe: { tier: 'copper', durability: 200 },
    })
    expect(document.querySelector('.mine-miners span')!.textContent).toBe(`⛏️ Miners: ${ORE} Copper zone (floor 11) · ${ORE} cracked 1/3`)
    const select = screen.getByLabelText('Miner zone') as HTMLSelectElement
    expect([...select.options].map((o) => o.textContent)).toEqual(['Deepest', `${STONE} Stone zone`, '⚫ Coal zone', `${ORE} Copper zone`])
    fireEvent.change(select, { target: { value: '1' } })
    t.rerender()
    expect(t.get().run.minerZone).toBe(1)
    expect(document.querySelector('.mine-miners span')!.textContent).toContain(`⚫ Coal zone (floor 6)`)
  })

  it('appCss pin: the floor classes exist with 44 px cells (four 44 px columns + gaps fit the 375 px column)', () => {
    // jsdom turns import.meta.url into http://…, so read by cwd path (vitest runs from the repo root)
    const css = readFileSync('src/app/app.css', 'utf8')
    expect(css).toContain('.floor-status')
    expect(css).toContain('.floor-grid')
    expect(css).toContain('.upgrade-vein-info')
    expect(css).toContain('min-height: 44px')
  })
})
