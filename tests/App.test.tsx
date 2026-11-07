// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../src/app/App'
import { UI_KEY } from '../src/app/uiState'
import { createInitialState } from '../src/core/state'
import { serialize } from '../src/save/serialize'
import { SAVE_KEY } from '../src/save/storage'

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
    expect(labels).toEqual(['🌱 Farm', '⛏️ Mine', '🛒 Shop', '⬆️ Upgrades', '🏦 Bank'])
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

  it('the welcome-back banner says how many bars the furnace finished while away', () => {
    const s = createInitialState()
    const furnace = { built: true, queue: 3, progress: 0, ready: 0 }
    localStorage.setItem(SAVE_KEY, serialize({ ...s, run: { ...s.run, furnace } }, Date.now() - 150_000))
    render(<App />)
    expect(screen.getByRole('status').textContent).toMatch(/ticks simulated · 🔥 2 bars ready/)
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

  it('keeps Reset save in the side panel and the Farm view', () => {
    render(<App />)
    const resets = screen.getAllByRole('button', { name: 'Reset save' })
    expect(resets.map((b) => b.closest('.panel, .farm')?.className)).toEqual(['farm', 'panel'])
  })
})
