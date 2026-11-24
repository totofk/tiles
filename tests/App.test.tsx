// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import App from '../src/app/App'
import { UI_KEY } from '../src/app/uiState'
import { ERROR_TEXT } from '../src/app/useGame'
import { plant } from '../src/core/actions'
import { cropGrowTicks } from '../src/core/balance'
import { createInitialState, type GameState } from '../src/core/state'
import { SAVE_VERSION, deserialize, serialize } from '../src/save/serialize'
import { IMPORT_BACKUP_KEY, RESET_BACKUP_KEY, SAVE_KEY } from '../src/save/storage'
import { encodeSave } from '../src/save/codec'
import codeV15 from './fixtures/code-v15.txt?raw'
import v19 from './fixtures/save-v19.json?raw'

beforeEach(() => localStorage.clear())
afterEach(cleanup)

const app = () => screen.getByRole('main')
const panelTab = (name: RegExp) => screen.getByRole('tab', { name })
const mainTab = (name: RegExp) => within(screen.getByRole('navigation')).getByRole('button', { name })
const menuBtn = () => screen.getByRole('button', { name: 'Open menu' })
const menu = () => within(document.querySelector<HTMLElement>('.menu')!)
const farm = () => within(document.querySelector<HTMLElement>('.farm')!)
const openMenu = () => fireEvent.click(menuBtn())
const selected = (el: HTMLElement) => el.getAttribute('aria-selected') === 'true'
const pressed = (el: HTMLElement) => el.getAttribute('aria-pressed') === 'true'

describe('the side menu (a ☰ drawer below 1024 px, always open above)', () => {
  it('🌾 Farm is the default tab; Shop and Upgrades switch; milestone upgrades stay hidden', () => {
    render(<App />)
    openMenu()
    expect(selected(panelTab(/Farm/))).toBe(true)
    fireEvent.click(panelTab(/Shop/))
    expect(selected(panelTab(/Shop/))).toBe(true)
    expect(screen.getByRole('heading', { name: 'Seeds' })).toBeTruthy()
    expect(screen.queryByText(/Bigger stamina/)).toBeNull()

    fireEvent.click(panelTab(/Upgrades/))
    expect(selected(panelTab(/Upgrades/))).toBe(true)
    expect(screen.queryByRole('heading', { name: 'Seeds' })).toBeNull()
    expect(screen.getByText(/Bigger stamina/)).toBeTruthy()
    expect(screen.queryByText(/Better prices/)).toBeNull()
  })

  it('batch 38: ☰ opens the drawer with the five menu tabs; the scrim, Escape and ✕ close it', () => {
    render(<App />)
    expect(app().classList.contains('menu-open')).toBe(false)
    expect(menuBtn().getAttribute('aria-expanded')).toBe('false')
    expect(panelTab(/Farm/)).toBeTruthy() // the menu stays mounted; app.css hides it while closed

    openMenu()
    expect(app().classList.contains('menu-open')).toBe(true)
    expect(menuBtn().getAttribute('aria-expanded')).toBe('true')
    expect(document.querySelector('.menu-scrim')).toBeTruthy()
    expect(menu().getAllByRole('tab').map((t) => t.textContent)).toEqual([
      '🌾 Farm',
      '🛒 Shop',
      '⬆️ Upgrades',
      '🏦 Bank',
      '📊 Stats',
    ])

    fireEvent.click(document.querySelector<HTMLElement>('.menu-scrim')!)
    expect(app().classList.contains('menu-open')).toBe(false)
    expect(document.querySelector('.menu-scrim')).toBeNull()

    openMenu()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(app().classList.contains('menu-open')).toBe(false)

    openMenu()
    fireEvent.click(screen.getByRole('button', { name: 'Close menu' }))
    expect(app().classList.contains('menu-open')).toBe(false)
  })
})

describe('the main view tabs', () => {
  it('🌱 Farm and ⛏️ Mine before the Tractor; one view renders at a time', () => {
    render(<App />)
    expect(within(screen.getByRole('navigation')).getAllByRole('button').map((b) => b.textContent)).toEqual(['🌱 Farm', '⛏️ Mine'])
    expect(app().dataset.view).toBe('farm')
    expect(document.querySelector('.farm')).toBeTruthy()
    expect(document.querySelector('.mine')).toBeNull()

    fireEvent.click(mainTab(/Mine/))
    expect(app().dataset.view).toBe('mine')
    expect(pressed(mainTab(/Mine/))).toBe(true)
    expect(document.querySelector('.mine')).toBeTruthy()
    expect(document.querySelector('.farm')).toBeNull()

    fireEvent.click(mainTab(/Farm/))
    expect(app().dataset.view).toBe('farm')
    expect(pressed(mainTab(/Farm/))).toBe(true)
    expect(document.querySelector('.farm')).toBeTruthy()
    expect(document.querySelector('.mine')).toBeNull()
  })

  it('batch 38: after the Tractor 🚜 Estate sits between Farm and Mine and switches the view', () => {
    localStorage.setItem(SAVE_KEY, serialize(deserialize(v19)!.state, Date.now()))
    localStorage.setItem(UI_KEY, JSON.stringify({ pulledBack: true, view: 'farm' }))
    render(<App />)
    expect(within(screen.getByRole('navigation')).getAllByRole('button').map((b) => b.textContent)).toEqual(['🌱 Farm', '🚜 Estate', '⛏️ Mine'])
    fireEvent.click(mainTab(/Estate/))
    expect(app().dataset.view).toBe('estate')
    fireEvent.click(mainTab(/Farm/))
    expect(app().dataset.view).toBe('farm')
  })

  it('batch 36.3: the Mine tab reads "🌊 River" on a no-mine Wetlands run and opens the River view', () => {
    const s = createInitialState()
    localStorage.setItem(SAVE_KEY, serialize({ ...s, run: { ...s.run, listing: { district: 'wetlands', soil: null } } }, Date.now()))
    render(<App />)
    const labels = within(screen.getByRole('navigation'))
      .getAllByRole('button')
      .map((b) => b.textContent)
    expect(labels).toEqual(['🌱 Farm', '🌊 River'])
    fireEvent.click(mainTab(/River/))
    expect(pressed(mainTab(/River/))).toBe(true)
    expect(document.querySelector('.mine-river')).toBeTruthy()
  })

  it('the 🏦 Bank menu tab borrows and the HUD shows the debt badge', () => {
    render(<App />)
    expect(screen.queryByTitle('Bank debt')).toBeNull()
    openMenu()
    fireEvent.click(panelTab(/Bank/))
    expect(selected(panelTab(/Bank/))).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: /Borrow/ }))
    expect(screen.getByTitle('Bank debt').textContent).toBe('🏦 −💰33')
  })
})

describe('batch 31.1 task 166: 🌾 Farm tab dot, the unlock toast, a seed buy switches the crop (jsdom = phone, drawer closed)', () => {
  const hasDot = (el: HTMLElement) => el.querySelector('.badge-dot') !== null
  const toastText = () => screen.queryByRole('status')?.textContent ?? null

  it('a certificate reaching its unlock lights the 🌾 Farm tab dot and toasts once; opening the menu clears it', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      const s = createInitialState()
      const ripe = { status: 'planted' as const, cropId: 'radish' as const, growth: cropGrowTicks('radish', s.meta, 0), moisture: 0, ticksSinceMature: 0 }
      const run = { ...s.run, tiles: [ripe, ...s.run.tiles.slice(1)], tools: { ...s.run.tools, harvest: 3 }, counters: { ...s.run.counters, harvests: 39 } }
      localStorage.setItem(SAVE_KEY, serialize({ ...s, run }, Date.now()))
      localStorage.setItem(UI_KEY, JSON.stringify({ view: 'farm' }))
      render(<App />)
      expect(hasDot(panelTab(/Farm/))).toBe(false)
      fireEvent.click(screen.getByRole('button', { name: /Mature — harvest!/ }))
      expect(toastText()).toBe('New worker: 🌾 Harvest')
      expect(hasDot(panelTab(/Farm/))).toBe(true)
      expect(hasDot(mainTab(/Mine/))).toBe(false)
      // the drawer opens on the 🌾 Farm tab, so the tab's content is on screen and the dot clears
      openMenu()
      fireEvent.click(panelTab(/Farm/))
      expect(hasDot(panelTab(/Farm/))).toBe(false)
      expect(JSON.parse(localStorage.getItem(UI_KEY)!).seen.farm).toEqual(['cert:harvest'])
      // once: the toast times out, and the next commit (a loan) does not raise it again
      act(() => vi.advanceTimersByTime(2500))
      expect(toastText()).toBeNull()
      fireEvent.click(panelTab(/Bank/))
      fireEvent.click(screen.getByRole('button', { name: /Borrow/ }))
      expect(toastText()).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('a certificate already owned (Sell the farm keep row) that re-crosses its gate neither toasts nor dots', () => {
    const s = createInitialState()
    const ripe = { status: 'planted' as const, cropId: 'radish' as const, growth: cropGrowTicks('radish', s.meta, 0), moisture: 0, ticksSinceMature: 0 }
    const workers = { ...s.run.workers, certificates: ['harvest' as const] }
    const run = { ...s.run, tiles: [ripe, ...s.run.tiles.slice(1)], tools: { ...s.run.tools, harvest: 3 }, counters: { ...s.run.counters, harvests: 39 }, workers }
    localStorage.setItem(SAVE_KEY, serialize({ ...s, run }, Date.now()))
    localStorage.setItem(UI_KEY, JSON.stringify({ view: 'farm' }))
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /Mature — harvest!/ }))
    expect(toastText()).not.toContain('New worker')
    expect(hasDot(panelTab(/Farm/))).toBe(false)
  })

  // the 🥕 Carrot's id is `radish`
  it('buying carrot seeds while pumpkin is selected switches to carrot and toasts (the Buy rows sit in the Seed pouch)', () => {
    const s = createInitialState()
    localStorage.setItem(SAVE_KEY, serialize({ ...s, run: { ...s.run, cash: 100, licenses: ['radish', 'pumpkin'], plantCrop: 'pumpkin' } }, Date.now()))
    localStorage.setItem(UI_KEY, JSON.stringify({ view: 'farm', tab: 'farm' }))
    render(<App />)
    openMenu()
    const carrot = () => menu().getByRole('button', { name: /^🥕 Carrotseed/ })
    expect(pressed(carrot())).toBe(false)
    const buyCarrot = () =>
      within(
        within(document.querySelector<HTMLElement>('.pouch-grid')!)
          .getAllByText(/Carrot/)
          .map((el) => el.closest<HTMLElement>('.item-row'))
          .find(Boolean)!,
      ).getByRole('button', { name: /^Buy ×1 / })
    fireEvent.click(buyCarrot())
    expect(toastText()).toBe('Now planting 🥕 Carrot')
    expect(pressed(carrot())).toBe(true)
  })

  it('auto-buy (planting with an empty pouch) never switches the crop to plant', () => {
    const s = createInitialState()
    const tilled = { ...s.run.tiles[0]!, status: 'tilled' as const }
    const r = plant({ ...s, run: { ...s.run, tiles: [tilled, ...s.run.tiles.slice(1)], licenses: ['radish', 'pumpkin'], plantCrop: 'pumpkin', seeds: {}, autoBuySeeds: true } }, 0, 'radish')
    if (!r.ok) throw new Error(r.error)
    expect([r.state.run.tiles[0]!.cropId, r.state.run.plantCrop]).toEqual(['radish', 'pumpkin'])
  })
})

describe('badge dot on the menu tabs (jsdom = phone, drawer closed)', () => {
  const hasDot = (el: HTMLElement) => el.querySelector('.badge-dot') !== null

  it('shows what is new since the tab was last opened and clears on open', () => {
    render(<App />)
    // fresh game: the two energy upgrades are unlocked and never seen; nothing in the Shop is affordable on 💰20
    expect(hasDot(panelTab(/Upgrades/))).toBe(true)
    expect(hasDot(panelTab(/Shop/))).toBe(false)
    expect(hasDot(panelTab(/Bank/))).toBe(false)

    openMenu()
    fireEvent.click(panelTab(/Upgrades/))
    expect(hasDot(panelTab(/Upgrades/))).toBe(false)
    expect(JSON.parse(localStorage.getItem(UI_KEY)!).seen.upgrades).toEqual(['energyMax', 'energyRegen'])

    // borrowing makes 💰50: the chilli and mine licenses and Bigger stamina Lv1 become affordable
    fireEvent.click(panelTab(/Bank/))
    fireEvent.click(screen.getByRole('button', { name: /Borrow/ }))
    expect(hasDot(panelTab(/Shop/))).toBe(true)
    expect(hasDot(panelTab(/Upgrades/))).toBe(true)
    fireEvent.click(panelTab(/Upgrades/))
    expect(JSON.parse(localStorage.getItem(UI_KEY)!).seen.upgrades).toEqual(['energyMax', 'energyRegen', 'energyMax@0'])

    fireEvent.click(panelTab(/Shop/))
    expect(hasDot(panelTab(/Shop/))).toBe(false)
    // closing the drawer hides the tabs but what was seen stays seen
    fireEvent.click(screen.getByRole('button', { name: 'Close menu' }))
    expect(hasDot(panelTab(/Shop/))).toBe(false)

    // seen survives a reload
    cleanup()
    render(<App />)
    expect(hasDot(panelTab(/Shop/))).toBe(false)
    expect(hasDot(panelTab(/Upgrades/))).toBe(false)
  })

  it('the dot does not change the tab labels', () => {
    render(<App />)
    expect(panelTab(/Upgrades/).textContent).toBe('⬆️ Upgrades')
  })
})

describe('persisted UI state (tiles.ui)', () => {
  it("records the factor each licensed crop's price tag showed while the Shop tab is on screen (batch 21 trend arrows)", async () => {
    render(<App />)
    openMenu()
    fireEvent.click(panelTab(/Shop/))
    await waitFor(() => expect(JSON.parse(localStorage.getItem(UI_KEY)!).priceShown).toEqual({ potato: 1 }))
  })

  it('restores view and tab after a reload', () => {
    render(<App />)
    fireEvent.click(mainTab(/Mine/))
    openMenu()
    fireEvent.click(panelTab(/Upgrades/))
    fireEvent.click(screen.getByRole('button', { name: 'Close menu' }))
    expect(JSON.parse(localStorage.getItem(UI_KEY)!)).toEqual({
      view: 'mine',
      tab: 'upgrades',
      toolsOpen: true,
      pulledBack: false,
      seen: { shop: [], upgrades: ['energyMax', 'energyRegen'], farm: [], mine: [] },
      priceShown: {},
    })

    cleanup()
    render(<App />)
    expect(app().dataset.view).toBe('mine')
    expect(selected(panelTab(/Upgrades/))).toBe(true)
    expect(app().classList.contains('menu-open')).toBe(false)
  })

  it('a broken value falls back to the defaults', () => {
    localStorage.setItem(UI_KEY, '{oops')
    render(<App />)
    expect(app().dataset.view).toBe('farm')
    expect(selected(panelTab(/Farm/))).toBe(true)
    expect(app().classList.contains('menu-open')).toBe(false)
  })
})

describe('loan debt with a fake clock', () => {
  afterEach(() => {
    vi.useRealTimers()
    Reflect.deleteProperty(document, 'hidden')
  })

  it('grows on live ticks but not while the tab was hidden (catch-up)', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'] })
    let hidden = false
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
    const badge = () => screen.getByTitle('Bank debt').textContent
    const setHidden = (h: boolean) => {
      hidden = h
      act(() => void document.dispatchEvent(new Event('visibilitychange')))
    }

    render(<App />)
    openMenu()
    fireEvent.click(panelTab(/Bank/))
    fireEvent.click(screen.getByRole('button', { name: /Borrow/ }))
    expect(badge()).toBe('🏦 −💰33')
    act(() => void vi.advanceTimersByTime(10_000))
    expect(badge()).toBe('🏦 −💰34') // 33 + 10 × 0.06, rounded up

    setHidden(true)
    act(() => void vi.advanceTimersByTime(3600_000))
    setHidden(false)
    expect(screen.getByText(/Away for 1h 0m — 3600 ticks simulated/)).toBeTruthy()
    expect(badge()).toBe('🏦 −💰34')

    act(() => void vi.advanceTimersByTime(10_000))
    expect(badge()).toBe('🏦 −💰35') // live again: 34.2
  })

  it('the welcome-back banner says the fire burnt, the bars smelted and the bars waiting in the tray while away', () => {
    const s = createInitialState()
    const furnace = { ...s.run.furnace, built: true, fire: 300, molds: { copperOre: { ore: 6, progress: 0, ready: 0 } } }
    localStorage.setItem(SAVE_KEY, serialize({ ...s, run: { ...s.run, furnace } }, Date.now() - 150_000))
    render(<App />)
    // 150 ticks: two 60-tick cycles done, the third half way; 150 burn ticks = 5 units
    expect(screen.getByRole('status').textContent).toMatch(/150 ticks simulated · 🔥 fire burnt 5 · 🥉 2 smelted · 2 bars ready/)
  })
})

describe('desktop layout (matchMedia stubbed to ≥ 1024 px)', () => {
  beforeEach(() => {
    window.matchMedia = ((q: string) => ({ matches: /min-width: (768|1024)px/.test(q) })) as typeof window.matchMedia
    const s = createInitialState()
    const run = {
      ...s.run,
      licenses: ['radish' as const, 'chilli' as const],
      seeds: { chilli: 2 },
      tools: { water: 1, harvest: 1, plant: 1 },
      tiles: s.run.tiles.map((t) => ({ ...t, status: 'tilled' as const })),
    }
    localStorage.setItem(SAVE_KEY, serialize({ ...s, run }, Date.now()))
  })
  afterEach(() => Reflect.deleteProperty(window, 'matchMedia'))

  it('no ☰ and no ✕: the menu is always open; the farm view holds Planting, the 🧰 Tools bar and the grid only', () => {
    render(<App />)
    expect(screen.queryByRole('button', { name: 'Open menu' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Close menu' })).toBeNull()
    expect(document.querySelector('.menu-scrim')).toBeNull()
    expect(menu().getAllByRole('tab').map((t) => t.textContent)).toEqual([
      '🌾 Farm',
      '🛒 Shop',
      '⬆️ Upgrades',
      '🏦 Bank',
      '📊 Stats',
    ])
    expect(selected(panelTab(/Farm/))).toBe(true)
    expect(farm().getByText(/^Planting:/)).toBeTruthy()
    for (const name of [/^Water 1/, /^Harvest 1/, /^Plant 1/]) expect(farm().getByRole('button', { name })).toBeTruthy()
    // the picker, pouch, dig and workers live in the menu, not the farm view
    expect(menu().getByRole('button', { name: /Chilli/, pressed: false })).toBeTruthy()
    expect(farm().queryByRole('button', { name: /Chilli/ })).toBeNull()
    expect(menu().getByRole('heading', { name: 'Seed pouch' })).toBeTruthy()
    expect(menu().getByRole('button', { name: /Dig for seeds/ })).toBeTruthy()
    expect(farm().queryByRole('button', { name: /Dig for seeds/ })).toBeNull()
    expect(menu().getByText(/👷 Workers/)).toBeTruthy()
    expect(farm().queryByText(/👷 Workers/)).toBeNull()
  })

  it('picking a crop in the menu changes what the farm view plants', () => {
    render(<App />)
    fireEvent.click(menu().getByRole('button', { name: /Chilli/ }))
    expect(menu().getByRole('button', { name: /Chilli/, pressed: true })).toBeTruthy()
    fireEvent.click(farm().getByRole('button', { name: /^Plant 1/ }))
    // batch 24: the shared item grid — name and ×N count in their own cells
    expect(menu().getAllByText(/Chilli/).some((el) => el.closest('.item-row')?.textContent.includes('×1'))).toBe(true)
    expect(farm().getAllByRole('button').filter((b) => b.textContent?.includes('🌶️'))).toHaveLength(1)
  })

  it('Shop no longer has a crop picker or pouch; owned crops show their seed price', () => {
    render(<App />)
    fireEvent.click(panelTab(/Shop/))
    expect(menu().getByRole('heading', { name: 'Seeds' })).toBeTruthy()
    expect(menu().queryAllByRole('button', { pressed: true })).toHaveLength(0)
    expect(menu().queryAllByRole('button', { pressed: false })).toHaveLength(0)
    expect(menu().queryByRole('heading', { name: 'Seed pouch' })).toBeNull()
    expect((menu().getByRole('button', { name: /Chilli/ }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('the 🧰 Tools bar in the farm view collapses and the state persists as tiles.ui.toolsOpen (batch 24)', () => {
    render(<App />)
    expect(document.querySelectorAll('.farm .tool-row')).toHaveLength(3)
    fireEvent.click(farm().getByRole('button', { name: '🧰 Tools' }))
    expect(JSON.parse(localStorage.getItem(UI_KEY)!).toolsOpen).toBe(false)
    expect(document.querySelectorAll('.farm .tool-row')).toHaveLength(0)
    // survives a reload
    cleanup()
    render(<App />)
    expect(document.querySelectorAll('.farm .tool-row')).toHaveLength(0)
    expect(farm().getByRole('button', { name: '🧰 Tools' }).getAttribute('aria-expanded')).toBe('false')
  })
})

describe('layout content', () => {
  it('shows a locked Mine card with the license price before the mine license (the ⛏️ Mine main view)', () => {
    render(<App />)
    fireEvent.click(mainTab(/Mine/))
    const card = screen.getByRole('heading', { name: '🔒 Mine' }).closest('section')!
    expect(within(card).getByRole('button', { name: /Mine license 💰\d+/ })).toBeTruthy()
  })

  it('the 🌾 Farm menu tab has a Dig for seeds button that shows the last result', () => {
    render(<App />)
    openMenu()
    const dig = menu().getByRole('button', { name: /Dig for seeds/ })
    fireEvent.click(dig)
    // batch 36.4: the first dig opens the 📖 collection book, find or no find
    expect(within(dig.parentElement!).getByRole('status').textContent).toBe('Found the 📖 collection book!')
  })

  it('batch 35: a fresh game picks only 🥔 Potato and digs potato seeds', () => {
    window.matchMedia = ((q: string) => ({ matches: /min-width: (768|1024)px/.test(q) })) as typeof window.matchMedia
    onTestFinished(() => void Reflect.deleteProperty(window, 'matchMedia'))
    render(<App />)
    const picker = menu().getByRole('heading', { name: 'Crop to plant' }).closest('.h-with-info')!.nextElementSibling!
    const crops = [...picker.querySelectorAll('button')].map((b) => b.textContent!)
    expect([crops.length, crops[0]!.startsWith('🥔 Potato')]).toEqual([1, true])
    const dig = menu().getByRole('button', { name: /Dig for seeds/ })
    // batch 36.4: the dig now draws 4 values, so the first 🥔 drop lands past a fresh run's ⚡ budget (dig 11);
    // the potato odds stay pinned in actions.farm.test.ts — here the deterministic first dig opens the 📖 book
    fireEvent.click(dig)
    expect(within(dig.parentElement!).getByRole('status').textContent).toBe('Found the 📖 collection book!')
  })

  it('the 📊 Stats feedback draft survives a tab switch (the form lives in the 💬 modal)', () => {
    render(<App />)
    openMenu()
    fireEvent.click(panelTab(/Stats/))
    fireEvent.click(screen.getByRole('button', { name: '💬 Feedback' }))
    fireEvent.change(screen.getByRole('textbox', { name: /Details/ }), { target: { value: 'half-written idea' } })
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    fireEvent.click(panelTab(/Shop/))
    expect(screen.queryByRole('textbox', { name: /Details/ })).toBeNull()
    fireEvent.click(panelTab(/Stats/))
    expect(screen.queryByRole('textbox', { name: /Details/ })).toBeNull() // closed until reopened
    fireEvent.click(screen.getByRole('button', { name: '💬 Feedback' }))
    expect((screen.getByRole('textbox', { name: /Details/ }) as HTMLTextAreaElement).value).toBe('half-written idea')
  })

  it('Reset save lives only in the 💾 Data modal; two presses back the run up to tiles.save.backup.reset', () => {
    const s = createInitialState()
    localStorage.setItem(SAVE_KEY, serialize({ ...s, run: { ...s.run, cash: 777 } }, Date.now()))
    const confirm = vi.spyOn(window, 'confirm')
    render(<App />)
    expect(screen.queryByRole('button', { name: 'Reset save' })).toBeNull()
    openMenu()
    fireEvent.click(panelTab(/Stats/))
    fireEvent.click(screen.getByRole('button', { name: '💾 Data' }))
    expect(screen.getByRole('dialog', { name: '💾 Data' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Reset save' }))
    expect(localStorage.getItem(RESET_BACKUP_KEY)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Press again to erase everything' }))
    expect(deserialize(localStorage.getItem(RESET_BACKUP_KEY)!)!.state.run.cash).toBe(777)
    expect(deserialize(localStorage.getItem(SAVE_KEY)!)!.state.run.cash).toBe(s.run.cash)
    expect(confirm).not.toHaveBeenCalled()
  })

  it('💾 Data Import: the confirm card compares both saves, then backs the live run up and loads the pasted one', () => {
    const s = createInitialState()
    localStorage.setItem(SAVE_KEY, serialize({ ...s, run: { ...s.run, cash: 4321 } }, Date.now()))
    const incoming = JSON.parse(serialize({ ...s, run: { ...s.run, cash: 999 } }, Date.now())) as ReturnType<typeof deserialize>
    const code = encodeSave(incoming!)
    localStorage.setItem(SAVE_KEY, serialize({ ...s, run: { ...s.run, cash: 777 } }, Date.now()))
    render(<App />)
    openMenu()
    fireEvent.click(panelTab(/Stats/))
    fireEvent.click(screen.getByRole('button', { name: '💾 Data' }))
    fireEvent.change(screen.getByPlaceholderText('Paste an exported save'), { target: { value: code } })
    fireEvent.click(screen.getByRole('button', { name: 'Check save' }))
    const card = screen.getByRole('table')
    expect(card.textContent).toContain('This device')
    expect(card.textContent).toContain(String(s.run.tiles.length))
    expect(screen.queryByText(/Will migrate/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Replace this save' }))
    expect(deserialize(localStorage.getItem(IMPORT_BACKUP_KEY)!)!.state.run.cash).toBe(777)
    expect(deserialize(localStorage.getItem(SAVE_KEY)!)!.state.run.cash).toBe(999)
  })

  it('💾 Data Import: an older code shows the migrate note and still imports', () => {
    const s = createInitialState()
    localStorage.setItem(SAVE_KEY, serialize(s, Date.now()))
    render(<App />)
    openMenu()
    fireEvent.click(panelTab(/Stats/))
    fireEvent.click(screen.getByRole('button', { name: '💾 Data' }))
    fireEvent.change(screen.getByPlaceholderText('Paste an exported save'), { target: { value: codeV15 } })
    fireEvent.click(screen.getByRole('button', { name: 'Check save' }))
    expect(screen.getByText(/Will migrate v15 → v38/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Replace this save' }))
    expect(deserialize(localStorage.getItem(SAVE_KEY)!)!.version).toBe(SAVE_VERSION)
    expect(deserialize(localStorage.getItem(IMPORT_BACKUP_KEY)!)!.state.run.cash).toBe(s.run.cash)
  })
})

describe('the Estate surface, two stops (batch 27, task 142; the migrated v19 fixture is the Tractor state)', () => {
  // pulledBack pre-set so the one-time pull-back does not race these assertions
  const load = (ui: Record<string, unknown> = {}, awayMs = 0) => {
    localStorage.setItem(SAVE_KEY, serialize(deserialize(v19)!.state, Date.now() - awayMs))
    localStorage.setItem(UI_KEY, JSON.stringify({ pulledBack: true, view: 'farm', ...ui }))
  }

  it('before the Tractor there is no 🚜 Estate main tab', () => {
    render(<App />)
    expect(within(screen.getByRole('navigation')).getAllByRole('button').map((b) => b.textContent)).toEqual(['🌱 Farm', '⛏️ Mine'])
  })

  it('an old stored `stop: "estate"` loads as the 🚜 Estate main view; keys 1 / 2 switch it, Escape never does', () => {
    load({ stop: 'estate' })
    render(<App />)
    expect(app().dataset.view).toBe('estate')
    fireEvent.keyDown(document, { key: '1' })
    expect(app().dataset.view).toBe('farm')
    fireEvent.keyDown(document, { key: '2' })
    expect(app().dataset.view).toBe('estate')
    // Escape belongs to the menu drawer now (batch 38), not the surface
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(app().dataset.view).toBe('estate')
  })

  it('keys are ignored while a dialog is open, so Esc still closes the dialog — and not the drawer', () => {
    load({ stop: 'home' })
    render(<App />)
    openMenu()
    fireEvent.click(panelTab(/Stats/))
    fireEvent.click(screen.getByRole('button', { name: '💾 Data' }))
    expect(screen.getByRole('dialog')).toBeTruthy()
    fireEvent.keyDown(document, { key: '1' })
    expect(app().dataset.view).toBe('farm') // the view never moved
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull() // the Modal's own Esc
    expect(app().classList.contains('menu-open')).toBe(true) // the drawer stayed open
  })

  it('batch 30: keys 1 / 2 / Esc do not switch views while the field sheet is open; Esc closes the sheet', () => {
    load({ stop: 'estate' })
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /^Field 1 · .+ — open$/ }))
    expect(screen.getByRole('dialog', { name: /^Field 1 · / })).toBeTruthy()
    fireEvent.keyDown(document, { key: '1' })
    expect(app().dataset.view).toBe('estate')
    fireEvent.keyDown(document, { key: '2' })
    expect(screen.getByRole('dialog')).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(app().dataset.view).toBe('estate')
  })

  it('the MiniLot switches the Estate view back to the Farm view, and the main tab returns', () => {
    load({ stop: 'estate' })
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /Home lot —/ }))
    expect(app().dataset.view).toBe('farm')
    fireEvent.click(mainTab(/Estate/))
    expect(app().dataset.view).toBe('estate')
  })

  it('a welcome-back banner at load forces the Estate view over the saved Home', () => {
    load({ stop: 'home' }, 150_000)
    render(<App />)
    expect(document.querySelector('.banner')).toBeTruthy()
    expect(app().dataset.view).toBe('estate')
  })

  it('the pull-back plays once: pulledBack flips to true on first render and the view starts on the Farm', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      localStorage.setItem(SAVE_KEY, serialize(deserialize(v19)!.state, Date.now()))
      render(<App />)
      expect(app().dataset.view).toBe('farm')
      expect(JSON.parse(localStorage.getItem(UI_KEY)!).pulledBack).toBe(true)
      act(() => vi.advanceTimersByTime(700))
      expect(app().dataset.view).toBe('estate')
      expect(document.querySelector('.pullcap')).toBeTruthy()
      act(() => vi.advanceTimersByTime(2600))
      expect(document.querySelector('.pullcap')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('the phone Estate bar (batch 27, task 144; jsdom = a 375 px matchMedia stub, all queries false)', () => {
  const load = (ui: Record<string, unknown> = {}) => {
    localStorage.setItem(SAVE_KEY, serialize(deserialize(v19)!.state, Date.now()))
    localStorage.setItem(UI_KEY, JSON.stringify({ pulledBack: true, view: 'farm', ...ui }))
  }

  it('the Estate view swaps the 🧰 Tools bar for three buttons; Sow sows the next plot (batch 28: whole plots)', async () => {
    // the migrated v19 holds its empty plots in fields past the 3 pivots its pipes earned: pivot them all here
    const s = deserialize(v19)!.state
    const list = s.run.fields.list.map((f) => ({ ...f, pivot: true }))
    localStorage.setItem(SAVE_KEY, serialize({ ...s, run: { ...s.run, fields: { ...s.run.fields, list } } }, Date.now()))
    localStorage.setItem(UI_KEY, JSON.stringify({ pulledBack: true, view: 'farm', stop: 'estate' }))
    render(<App />)
    const sown = (g: GameState) => g.run.fields.list.reduce((n, f) => n + f.plots.filter((p) => p.crop !== null).length, 0)
    const before = sown(s)
    const sow = screen.getByRole('button', { name: '🌱 Sow' }) as HTMLButtonElement
    expect(sow.disabled).toBe(false)
    expect(screen.getByRole('button', { name: /🌾 Reap · \d+/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: '＋ Plot' })).toBeTruthy()
    fireEvent.click(sow)
    await waitFor(() => expect(sown(deserialize(localStorage.getItem(SAVE_KEY)!)!.state)).toBe(before + 1))
  })

  it('Sow is disabled with the error text as its title while no field has a crop picked', () => {
    const s = deserialize(v19)!.state
    const list = s.run.fields.list.map((f) => ({ ...f, crop: null }))
    localStorage.setItem(SAVE_KEY, serialize({ ...s, run: { ...s.run, fields: { ...s.run.fields, list } } }, Date.now()))
    localStorage.setItem(UI_KEY, JSON.stringify({ pulledBack: true, view: 'farm', stop: 'estate' }))
    render(<App />)
    const sow = screen.getByRole('button', { name: '🌱 Sow' }) as HTMLButtonElement
    expect(sow.disabled).toBe(true)
    expect(sow.title).toBe(ERROR_TEXT.NOTHING_TO_DO)
  })

  it('batch 38: the Orders / Workers / Workshop cards live in the 🌾 Farm menu tab (the 📋 sheet is gone)', () => {
    load({ stop: 'home' })
    render(<App />)
    expect(screen.queryByRole('button', { name: /📋 Orders/ })).toBeNull()
    openMenu()
    const tab = document.querySelector('.menu')!
    for (const card of /Orders|Workers|Workshop/.source.split('|')) expect(tab.textContent).toContain(card)
    // Dig for seeds is in the same menu tab now, not below the grid
    expect(menu().getByRole('button', { name: /Dig for seeds/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Close menu' }))
    expect(app().classList.contains('menu-open')).toBe(false)
  })

  it('before the Tractor, phones are unchanged: no Estate bar, no 🚜 Estate tab; the Farm tab cards render in the menu', () => {
    render(<App />)
    expect(screen.queryByRole('button', { name: '🌱 Sow' })).toBeNull()
    expect(within(screen.getByRole('navigation')).queryByRole('button', { name: '🚜 Estate' })).toBeNull()
    openMenu()
    expect(menu().getByRole('button', { name: /Dig for seeds/ })).toBeTruthy() // fresh run: DigSeeds + the Workers card are the Farm tab's cards
    expect(menu().getAllByText(/Workers/).length).toBeGreaterThan(0)
  })
})
