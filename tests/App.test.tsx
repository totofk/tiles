// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../src/app/App'
import { UI_KEY } from '../src/app/uiState'
import { ERROR_TEXT } from '../src/app/useGame'
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
const mobileTab = (name: RegExp) => within(screen.getByRole('navigation')).getByRole('button', { name })
const selected = (el: HTMLElement) => el.getAttribute('aria-selected') === 'true'
const pressed = (el: HTMLElement) => el.getAttribute('aria-pressed') === 'true'

describe('side panel tabs', () => {
  it('switch between Shop and Upgrades; milestone upgrades stay hidden', () => {
    render(<App />)
    expect(selected(panelTab(/Shop/))).toBe(true)
    expect(screen.getByRole('heading', { name: 'Seeds' })).toBeTruthy()
    expect(screen.queryByText(/Bigger stamina/)).toBeNull()

    fireEvent.click(panelTab(/Upgrades/))
    expect(selected(panelTab(/Upgrades/))).toBe(true)
    expect(screen.queryByRole('heading', { name: 'Seeds' })).toBeNull()
    expect(screen.getByText(/Bigger stamina/)).toBeTruthy()
    expect(screen.queryByText(/Better prices/)).toBeNull()
  })

  it('collapse toggles the panel-collapsed layout', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Collapse panel' }))
    expect(app().classList.contains('panel-collapsed')).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Expand panel' }))
    expect(app().classList.contains('panel-collapsed')).toBe(false)
  })
})

describe('mobile tab bar', () => {
  it('has Farm, Mine and one entry per panel tab', () => {
    render(<App />)
    const labels = within(screen.getByRole('navigation'))
      .getAllByRole('button')
      .map((b) => b.textContent)
    expect(labels).toEqual(['🌱 Farm', '⛏️ Mine', '🛒 Shop', '⬆️ Upgrades', '🏦 Bank', '📊 Stats'])
  })

  it('the Bank tab borrows and the HUD shows the debt badge', () => {
    render(<App />)
    expect(screen.queryByTitle('Bank debt')).toBeNull()
    fireEvent.click(mobileTab(/Bank/))
    expect(selected(panelTab(/Bank/))).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: /Borrow/ }))
    expect(screen.getByTitle('Bank debt').textContent).toBe('🏦 −💰33')
  })

  it('shows one view at a time and selects the panel tab', () => {
    render(<App />)
    expect(app().dataset.view).toBe('farm')
    fireEvent.click(mobileTab(/Mine/))
    expect(app().dataset.view).toBe('mine')
    expect(pressed(mobileTab(/Mine/))).toBe(true)

    fireEvent.click(mobileTab(/Upgrades/))
    expect(app().dataset.view).toBe('panel')
    expect(selected(panelTab(/Upgrades/))).toBe(true)
    expect(pressed(mobileTab(/Upgrades/))).toBe(true)
    expect(pressed(mobileTab(/Shop/))).toBe(false)
  })
})

describe('badge dot on Shop / Upgrades (jsdom = mobile layout)', () => {
  const hasDot = (el: HTMLElement) => el.querySelector('.badge-dot') !== null

  it('shows what is new since the tab was last opened and clears on open', () => {
    render(<App />)
    // fresh game: the two energy upgrades are unlocked and never seen; nothing in the Shop is affordable on 💰20
    expect(hasDot(mobileTab(/Upgrades/))).toBe(true)
    expect(hasDot(panelTab(/Upgrades/))).toBe(true)
    expect(hasDot(mobileTab(/Shop/))).toBe(false)
    expect(hasDot(mobileTab(/Bank/))).toBe(false)

    fireEvent.click(mobileTab(/Upgrades/))
    expect(hasDot(mobileTab(/Upgrades/))).toBe(false)
    expect(JSON.parse(localStorage.getItem(UI_KEY)!).seen.upgrades).toEqual(['energyMax', 'energyRegen'])

    // borrowing makes 💰50: the chilli and mine licenses and Bigger stamina Lv1 become affordable
    fireEvent.click(mobileTab(/Bank/))
    fireEvent.click(screen.getByRole('button', { name: /Borrow/ }))
    expect(hasDot(mobileTab(/Shop/))).toBe(true)
    expect(hasDot(mobileTab(/Upgrades/))).toBe(true)
    fireEvent.click(mobileTab(/Upgrades/))
    expect(JSON.parse(localStorage.getItem(UI_KEY)!).seen.upgrades).toEqual(['energyMax', 'energyRegen', 'energyMax@0'])

    fireEvent.click(mobileTab(/Shop/))
    expect(hasDot(mobileTab(/Shop/))).toBe(false)
    fireEvent.click(mobileTab(/Farm/))
    expect(hasDot(mobileTab(/Shop/))).toBe(false)

    // seen survives a reload
    cleanup()
    render(<App />)
    expect(hasDot(mobileTab(/Shop/))).toBe(false)
    expect(hasDot(mobileTab(/Upgrades/))).toBe(false)
  })

  it('the dot does not change the tab labels', () => {
    render(<App />)
    expect(mobileTab(/Upgrades/).textContent).toBe('⬆️ Upgrades')
  })
})

describe('persisted UI state (tiles.ui)', () => {
  it('records the factor each licensed crop\'s price tag showed while the Shop tab is on screen (batch 21 trend arrows)', async () => {
    render(<App />)
    fireEvent.click(mobileTab(/Shop/))
    await waitFor(() => expect(JSON.parse(localStorage.getItem(UI_KEY)!).priceShown).toEqual({ radish: 1 }))
  })

  it('restores view, tab and collapse after a reload', () => {
    render(<App />)
    fireEvent.click(mobileTab(/Mine/))
    fireEvent.click(panelTab(/Upgrades/))
    fireEvent.click(screen.getByRole('button', { name: 'Collapse panel' }))
    expect(JSON.parse(localStorage.getItem(UI_KEY)!)).toEqual({
      view: 'mine',
      tab: 'upgrades',
      collapsed: true,
      toolsOpen: true,
      stop: 'estate',
      pulledBack: false,
      seen: { shop: [], upgrades: [] },
      priceShown: {},
    })

    cleanup()
    render(<App />)
    expect(app().dataset.view).toBe('mine')
    expect(selected(panelTab(/Upgrades/))).toBe(true)
    expect(app().classList.contains('panel-collapsed')).toBe(true)
  })

  it('a broken value falls back to the defaults', () => {
    localStorage.setItem(UI_KEY, '{oops')
    render(<App />)
    expect(app().dataset.view).toBe('farm')
    expect(selected(panelTab(/Shop/))).toBe(true)
    expect(app().classList.contains('panel-collapsed')).toBe(false)
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
    fireEvent.click(mobileTab(/Bank/))
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
    const furnace = { ...s.run.furnace, built: true, fire: 300, ore: 6 }
    localStorage.setItem(SAVE_KEY, serialize({ ...s, run: { ...s.run, furnace } }, Date.now() - 150_000))
    render(<App />)
    // 150 ticks: two 60-tick cycles done, the third half way; 150 burn ticks = 5 units
    expect(screen.getByRole('status').textContent).toMatch(/150 ticks simulated · 🔥 fire burnt 5 · 🥉 2 smelted · 2 bars ready/)
  })
})

describe('desktop 🌾 Farm tab (matchMedia stubbed to ≥ 1024 px)', () => {
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
  const panel = () => within(document.querySelector<HTMLElement>('.panel')!)
  const farm = () => within(document.querySelector<HTMLElement>('.farm')!)

  it('is the first, default tab and holds the tool buttons, crop picker, pouch and dig; the farm column only the grid', () => {
    render(<App />)
    expect(panel().getAllByRole('tab').map((t) => t.textContent)).toEqual([
      '🌾 Farm',
      '🛒 Shop',
      '⬆️ Upgrades',
      '🏦 Bank',
      '📊 Stats',
    ])
    expect(selected(panelTab(/Farm/))).toBe(true)
    for (const name of [/^Water 1/, /^Harvest 1/, /^Plant 1/]) {
      expect(panel().getByRole('button', { name })).toBeTruthy()
      expect(farm().queryByRole('button', { name })).toBeNull()
    }
    expect(panel().getByRole('button', { name: /Chilli/, pressed: false })).toBeTruthy()
    expect(panel().getByRole('heading', { name: 'Seed pouch' })).toBeTruthy()
    expect(panel().getByRole('button', { name: /Dig for seeds/ })).toBeTruthy()
    expect(farm().queryByRole('button', { name: /Dig for seeds/ })).toBeNull()
    expect(panel().getByText(/👷 Workers/)).toBeTruthy()
    expect(farm().queryByText(/👷 Workers/)).toBeNull()
    expect(screen.queryByText(/^Planting:/)).toBeNull()
  })

  it('picking a crop changes what Plant plants', () => {
    render(<App />)
    fireEvent.click(panel().getByRole('button', { name: /Chilli/ }))
    expect(panel().getByRole('button', { name: /Chilli/, pressed: true })).toBeTruthy()
    fireEvent.click(panel().getByRole('button', { name: /^Plant 1/ }))
    // batch 24: the shared item grid — name and ×N count in their own cells
    expect(panel().getAllByText(/Chilli/).some((el) => el.closest('.item-row')?.textContent.includes('×1'))).toBe(true)
    expect(farm().getAllByRole('button').filter((b) => b.textContent?.includes('🌶️'))).toHaveLength(1)
  })

  it('Shop no longer has a crop picker or pouch; owned crops show their seed price', () => {
    render(<App />)
    fireEvent.click(panelTab(/Shop/))
    expect(panel().getByRole('heading', { name: 'Seeds' })).toBeTruthy()
    expect(panel().queryAllByRole('button', { pressed: true })).toHaveLength(0)
    expect(panel().queryAllByRole('button', { pressed: false })).toHaveLength(0)
    expect(panel().queryByRole('heading', { name: 'Seed pouch' })).toBeNull()
    expect((panel().getByRole('button', { name: /Chilli/ }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('the 🧰 Tools card collapses and the state persists as tiles.ui.toolsOpen (batch 24)', () => {
    render(<App />)
    expect(document.querySelectorAll('.panel .tool-row')).toHaveLength(3)
    fireEvent.click(panel().getByRole('button', { name: '🧰 Tools' }))
    expect(JSON.parse(localStorage.getItem(UI_KEY)!).toolsOpen).toBe(false)
    expect(document.querySelectorAll('.panel .tool-row')).toHaveLength(0)
    // survives a reload
    cleanup()
    render(<App />)
    expect(document.querySelectorAll('.panel .tool-row')).toHaveLength(0)
    expect(panel().getByRole('button', { name: '🧰 Tools' }).getAttribute('aria-expanded')).toBe('false')
  })

  it('collapsing the panel puts the tool bar back on the farm column, as the same stacked rows', () => {
    render(<App />)
    const order = () => [...document.querySelectorAll('.tool-row > :not(.tool-step)')].map((b) => b.textContent)
    expect(order()).toEqual(['Plant 1', 'Water 1', 'Harvest 1'])
    expect(document.querySelectorAll('.panel .tool-row')).toHaveLength(3)
    fireEvent.click(screen.getByRole('button', { name: 'Collapse panel' }))
    expect(farm().getByRole('button', { name: /^Plant 1/ })).toBeTruthy()
    expect(screen.queryAllByRole('button', { name: /^Plant 1/ })).toHaveLength(1)
    expect(document.querySelectorAll('.farm .tool-row')).toHaveLength(3)
    expect(order()).toEqual(['Plant 1', 'Water 1', 'Harvest 1'])
  })
})

describe('always-open panel at ≥ 1440 px (matchMedia stubbed)', () => {
  const stub = (wide: boolean) => {
    window.matchMedia = ((q: string) => ({
      matches: wide ? /min-width: (768|1024|1440)px/.test(q) : /min-width: (768|1024)px/.test(q),
    })) as typeof window.matchMedia
  }
  afterEach(() => Reflect.deleteProperty(window, 'matchMedia'))

  it('a persisted collapsed is ignored: no toggle, the panel content renders (batch 24 task 125)', () => {
    stub(true)
    localStorage.setItem(UI_KEY, JSON.stringify({ view: 'farm', tab: 'farm', collapsed: true }))
    render(<App />)
    expect(app().classList.contains('panel-collapsed')).toBe(false)
    expect(document.querySelector('.panel-toggle')).toBeNull()
    expect(document.querySelector('.panel .farm-tab')).toBeTruthy() // the 🌾 Farm tab is on screen
    // and the saved value is not overwritten: it still applies below 1440
    expect(JSON.parse(localStorage.getItem(UI_KEY)!).collapsed).toBe(true)
  })

  it('at 1024–1439 the toggle is still there and collapsed still hides the panel content', () => {
    stub(false)
    localStorage.setItem(UI_KEY, JSON.stringify({ view: 'farm', tab: 'farm', collapsed: true }))
    render(<App />)
    expect(app().classList.contains('panel-collapsed')).toBe(true)
    expect(document.querySelector('.panel-toggle')).toBeTruthy()
    expect(document.querySelector('.panel .farm-tab')).toBeNull()
  })
})

describe('layout content', () => {
  it('shows a locked Mine card with the license price before the mine license', () => {
    render(<App />)
    const card = screen.getByRole('heading', { name: '🔒 Mine' }).closest('section')!
    expect(within(card).getByRole('button', { name: /Mine license 💰\d+/ })).toBeTruthy()
  })

  it('Farm view has a Dig for seeds button that shows the last result', () => {
    render(<App />)
    const dig = within(document.querySelector<HTMLElement>('.farm')!).getByRole('button', { name: /Dig for seeds/ })
    fireEvent.click(dig)
    expect(within(dig.parentElement!).getByRole('status').textContent).toMatch(/Found a 🥕 Carrot seed!|Nothing this time/)
  })

  it('the 📊 Stats feedback draft survives a tab switch (the form lives in the 💬 modal)', () => {
    render(<App />)
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
    fireEvent.click(panelTab(/Stats/))
    fireEvent.click(screen.getByRole('button', { name: '💾 Data' }))
    fireEvent.change(screen.getByPlaceholderText('Paste an exported save'), { target: { value: codeV15 } })
    fireEvent.click(screen.getByRole('button', { name: 'Check save' }))
    expect(screen.getByText(/Will migrate v15 → v23/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Replace this save' }))
    expect(deserialize(localStorage.getItem(SAVE_KEY)!)!.version).toBe(SAVE_VERSION)
    expect(deserialize(localStorage.getItem(IMPORT_BACKUP_KEY)!)!.state.run.cash).toBe(s.run.cash)
  })
})

describe('the Estate surface, two stops (batch 27, task 142; the migrated v19 fixture is the Tractor state)', () => {
  // pulledBack pre-set so the one-time pull-back does not race these assertions
  const load = (ui: Record<string, unknown> = {}, awayMs = 0) => {
    localStorage.setItem(SAVE_KEY, serialize(deserialize(v19)!.state, Date.now() - awayMs))
    localStorage.setItem(UI_KEY, JSON.stringify({ pulledBack: true, ...ui }))
  }
  const switchBtn = (name: RegExp) => screen.getByRole('button', { name })

  it('before the Tractor there is no stop switch and no fold strip', () => {
    render(<App />)
    expect(screen.queryByRole('button', { name: '🚜 Estate' })).toBeNull()
    expect(screen.queryByRole('button', { name: '🏡 Home' })).toBeNull()
    expect(screen.queryByRole('button', { name: /🚜 Fields ·/ })).toBeNull()
  })

  it('the switch renders with the v19 state; keys 1 / Escape / 2 flip aria-pressed', () => {
    load({ stop: 'estate' })
    render(<App />)
    expect(switchBtn(/🚜 Estate/)).toBeTruthy()
    expect(pressed(switchBtn(/🚜 Estate/))).toBe(true)
    fireEvent.keyDown(document, { key: '1' })
    expect(pressed(switchBtn(/🏡 Home/))).toBe(true)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(pressed(switchBtn(/🚜 Estate/))).toBe(true)
    fireEvent.keyDown(document, { key: '2' })
    expect(pressed(switchBtn(/🏡 Home/))).toBe(false)
    expect(pressed(switchBtn(/🚜 Estate/))).toBe(true)
  })

  it('keys are ignored while a dialog is open, so Esc still closes the dialog first', () => {
    load({ stop: 'home' })
    render(<App />)
    fireEvent.click(mobileTab(/Stats/))
    fireEvent.click(screen.getByRole('button', { name: '💾 Data' }))
    expect(screen.getByRole('dialog')).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull() // the Modal's own Esc
    expect(pressed(switchBtn(/🏡 Home/))).toBe(true) // the stop never moved
  })

  it('batch 30: keys 1 / 2 / Esc do not switch stops while the field sheet is open; Esc closes the sheet', () => {
    load({ stop: 'estate' })
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /^Field 1 · .+ — open$/ }))
    expect(screen.getByRole('dialog', { name: /^Field 1 · / })).toBeTruthy()
    fireEvent.keyDown(document, { key: '1' })
    expect(pressed(switchBtn(/🚜 Estate/))).toBe(true)
    fireEvent.keyDown(document, { key: '2' })
    expect(screen.getByRole('dialog')).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(pressed(switchBtn(/🚜 Estate/))).toBe(true)
  })

  it('the fold strip (Home) and the MiniLot (Estate) switch stops', () => {
    load({ stop: 'home' })
    render(<App />)
    // v19 plants lemon 100, pumpkin 40, chilli 30, nothing ready yet; the v21 migration returns the 20 tiles the old
    // pipes stalled (a lemon and a chilli cohort) to the pouch
    expect(switchBtn(/🚜 Fields ·/).textContent).toBe('🚜 Fields · 🌶️ 20 · 🎃 40 · 🍋 90 · 🌾 0 ready')
    fireEvent.click(switchBtn(/🚜 Fields ·/))
    expect(pressed(switchBtn(/🚜 Estate/))).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: /Home lot —/ }))
    expect(pressed(switchBtn(/🏡 Home/))).toBe(true)
  })

  it('a welcome-back banner at load forces the Estate stop over the saved Home', () => {
    load({ stop: 'home' }, 150_000)
    render(<App />)
    expect(document.querySelector('.banner')).toBeTruthy()
    expect(pressed(switchBtn(/🚜 Estate/))).toBe(true)
  })

  it('the pull-back plays once: pulledBack flips to true on first render and the stop starts on Home', () => {
    localStorage.setItem(SAVE_KEY, serialize(deserialize(v19)!.state, Date.now()))
    render(<App />)
    expect(pressed(switchBtn(/🏡 Home/))).toBe(true)
    expect(JSON.parse(localStorage.getItem(UI_KEY)!).pulledBack).toBe(true)
  })
})

describe('the phone Estate bar + 📋 sheet (batch 27, task 144; jsdom = a 375 px matchMedia stub, all queries false)', () => {
  const load = (ui: Record<string, unknown> = {}) => {
    localStorage.setItem(SAVE_KEY, serialize(deserialize(v19)!.state, Date.now()))
    localStorage.setItem(UI_KEY, JSON.stringify({ pulledBack: true, ...ui }))
  }

  it('the Estate stop swaps the Tools bar for three buttons; Sow sows the next plot (batch 28: whole plots)', async () => {
    // the migrated v19 holds its empty plots in fields past the 3 pivots its pipes earned: pivot them all here
    const s = deserialize(v19)!.state
    const list = s.run.fields.list.map((f) => ({ ...f, pivot: true }))
    localStorage.setItem(SAVE_KEY, serialize({ ...s, run: { ...s.run, fields: { ...s.run.fields, list } } }, Date.now()))
    localStorage.setItem(UI_KEY, JSON.stringify({ pulledBack: true, stop: 'estate' }))
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
    localStorage.setItem(UI_KEY, JSON.stringify({ pulledBack: true, stop: 'estate' }))
    render(<App />)
    const sow = screen.getByRole('button', { name: '🌱 Sow' }) as HTMLButtonElement
    expect(sow.disabled).toBe(true)
    expect(sow.title).toBe(ERROR_TEXT.NOTHING_TO_DO)
  })

  it('the 📋 button opens the Orders / Workers / Workshop sheet in the shared Modal; ✕ closes it', () => {
    load({ stop: 'home' })
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '📋 Orders · Workers · Workshop' }))
    const sheet = screen.getByRole('dialog', { name: '📋 Orders · Workers · Workshop' })
    for (const card of /Orders|Workers|Workshop/.source.split('|'))
      expect(sheet.textContent).toContain(card)
    // DigSeeds and the Fields summary card stay below the grid, outside the sheet
    expect(sheet.textContent).not.toContain('Dig for seeds')
    fireEvent.click(within(sheet).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('before the Tractor, phones are unchanged: no 📋 button, no Estate bar, today’s cards still render below the grid', () => {
    render(<App />)
    expect(screen.queryByRole('button', { name: /📋 Orders/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /🌱 Sow/ })).toBeNull()
    expect(screen.getByText(/Dig for seeds/)).toBeTruthy() // fresh run: DigSeeds + the Workers card are today’s visible cards
    expect(screen.getAllByText(/Workers/).length).toBeGreaterThan(0)
  })
})
