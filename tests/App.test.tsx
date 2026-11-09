// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../src/app/App'
import { UI_KEY } from '../src/app/uiState'
import { createInitialState } from '../src/core/state'
import { deserialize, serialize } from '../src/save/serialize'
import { IMPORT_BACKUP_KEY, RESET_BACKUP_KEY, SAVE_KEY } from '../src/save/storage'
import { encodeSave } from '../src/save/codec'
import codeV15 from './fixtures/code-v15.txt?raw'

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
    expect(panel().getByText(/Chilli × 1/)).toBeTruthy()
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

  it('the 📊 Stats feedback draft survives a tab switch', () => {
    render(<App />)
    fireEvent.click(panelTab(/Stats/))
    fireEvent.change(screen.getByRole('textbox', { name: /Details/ }), { target: { value: 'half-written idea' } })
    fireEvent.click(panelTab(/Shop/))
    expect(screen.queryByRole('textbox', { name: /Details/ })).toBeNull()
    fireEvent.click(panelTab(/Stats/))
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
    expect(screen.getByText(/Will migrate v15 → v19/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Replace this save' }))
    expect(deserialize(localStorage.getItem(SAVE_KEY)!)!.version).toBe(19)
    expect(deserialize(localStorage.getItem(IMPORT_BACKUP_KEY)!)!.state.run.cash).toBe(s.run.cash)
  })
})
