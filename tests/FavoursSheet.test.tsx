// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../src/app/App'
import { Favours } from '../src/app/Favours'
import { SellCard } from '../src/app/Legacy'
import { Mine } from '../src/app/Mine'
import { Orders } from '../src/app/Orders'
import { Upgrades } from '../src/app/Upgrades'
import { UI_KEY } from '../src/app/uiState'
import type { Act } from '../src/app/useGame'
import { ITEMS } from '../src/core/data/items'
import { createInitialState, type GameState, type RunState } from '../src/core/state'
import { serialize } from '../src/save/serialize'
import { SAVE_KEY } from '../src/save/storage'

beforeEach(() => localStorage.clear())
afterEach(cleanup)

const init = createInitialState()
const withRun = (run: Partial<RunState>): GameState => ({ ...init, run: { ...init.run, ...run } })
/** a state holder: `act` applies an ok action to it */
function holder(s: GameState) {
  let state = s
  const act: Act = (fn) => {
    const r = fn(state)
    if (r.ok) state = r.state
  }
  return { act, get: () => state }
}
const rowOf = (name: RegExp) => screen.getByRole('button', { name })

describe('batch 34: the ⭐ Favours sheet', () => {
  describe('batch 35.4: the HUD ⭐ jumps to the ⭐ Favours section of ⬆️ Upgrades', () => {
    let scrolled: { id: string; opts: unknown }[] = []
    beforeEach(() => {
      scrolled = []
      Element.prototype.scrollIntoView = vi.fn(function (this: Element, opts?: unknown) {
        scrolled.push({ id: this.id, opts })
      })
      localStorage.setItem(SAVE_KEY, serialize(withRun({ stars: 12, orders: { unlocked: true, slots: 2, offers: [], rerolls: 0 } }), Date.now()))
    })
    afterEach(() => {
      Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
      Reflect.deleteProperty(window, 'matchMedia')
    })
    const stub = (re: RegExp) => {
      window.matchMedia = ((q: string) => ({ matches: re.test(q) })) as typeof window.matchMedia
    }
    const app = () => document.querySelector<HTMLElement>('main.app')!
    const upgradesTabSelected = () => screen.getByRole('tab', { name: /Upgrades/ }).getAttribute('aria-selected')
    const tapStar = () => {
      const star = document.querySelector<HTMLElement>('button.hud-stars')!
      expect([star.textContent, star.title]).toEqual(['⭐ 12', '⭐ Favours'])
      fireEvent.click(star)
    }

    it('phone: opens ⬆️ Upgrades in the panel view and scrolls the section into view; no ⭐ Favours dialog', () => {
      render(<App />)
      expect(app().dataset.view).toBe('farm')
      tapStar()
      expect(app().dataset.view).toBe('panel')
      expect(upgradesTabSelected()).toBe('true')
      expect(within(document.querySelector<HTMLElement>('.panel')!).getByText('⭐ 12 to spend · resets when you sell the farm (up to 400 ⭐ carry over)')).toBeTruthy()
      expect(scrolled).toEqual([{ id: 'favours', opts: { block: 'start', behavior: 'smooth' } }])
      expect(screen.queryByRole('dialog')).toBeNull()
    })

    it('tablet: opens the slide-over on ⬆️ Upgrades; reduced motion scrolls instantly', () => {
      stub(/min-width: 768px|prefers-reduced-motion/)
      render(<App />)
      expect(app().classList.contains('slide-open')).toBe(false)
      tapStar()
      expect(app().classList.contains('slide-open')).toBe(true)
      expect(upgradesTabSelected()).toBe('true')
      expect(scrolled).toEqual([{ id: 'favours', opts: { block: 'start', behavior: 'auto' } }])
    })

    it('1024 with the panel collapsed: expands the panel on ⬆️ Upgrades', () => {
      stub(/min-width: (768|1024)px/)
      localStorage.setItem(UI_KEY, JSON.stringify({ view: 'farm', tab: 'farm', collapsed: true }))
      render(<App />)
      expect(app().classList.contains('panel-collapsed')).toBe(true)
      tapStar()
      expect(app().classList.contains('panel-collapsed')).toBe(false)
      expect(upgradesTabSelected()).toBe('true')
      expect(scrolled.map((s) => s.id)).toEqual(['favours'])
    })
  })

  it('batch 35.4: board bought at ⭐0 with no Favour: the HUD ⭐ is text; after a sale with ⭐ carried it is a button (no board)', () => {
    localStorage.setItem(SAVE_KEY, serialize(withRun({ stars: 0, orders: { unlocked: true, slots: 2, offers: [], rerolls: 0 } }), Date.now()))
    render(<App />)
    expect(document.querySelector('button.hud-stars')).toBeNull()
    const text = document.querySelector<HTMLElement>('span.hud-stars')!
    expect([text.textContent, text.title]).toEqual(['⭐ 0', '⭐ comes from orders'])
    cleanup()
    localStorage.setItem(SAVE_KEY, serialize(withRun({ stars: 50 }), Date.now()))
    render(<App />)
    expect(document.querySelector('button.hud-stars')!.textContent).toBe('⭐ 50')
    cleanup()
    localStorage.setItem(SAVE_KEY, serialize(withRun({ stars: 0 }), Date.now()))
    render(<App />)
    expect(document.querySelector('.hud-stars')).toBeNull()
  })

  it('batch 35.4: the Upgrades panel ends with a "⭐ Favours" section once the player has ⭐ or a Favour level', () => {
    const counters = { ...init.run.counters, harvests: 1e4, sales: 1e4 }
    const headings = () => [...document.querySelectorAll('.shop h2')].map((h) => h.textContent)
    render(<Upgrades state={withRun({ stars: 12, mineLicense: true, counters })} act={() => {}} />)
    expect(headings()).toEqual(['⚡ Energy', '🌱 Farm', '⛏ Mine', '⭐ Favours'])
    expect(document.querySelector('.shop > :last-child')!.id).toBe('favours')
    expect(screen.getByText('⭐ 12 to spend · resets when you sell the farm (up to 400 ⭐ carry over)')).toBeTruthy()
    cleanup()
    render(<Upgrades state={withRun({ stars: 0, counters })} act={() => {}} />)
    expect(document.getElementById('favours')).toBeNull()
    expect(headings()).not.toContain('⭐ Favours')
    cleanup()
    // ⭐0 with Fine mist Lv1 bought (fertilizer one past its cash max)
    render(<Upgrades state={withRun({ stars: 0, counters, upgrades: { ...init.run.upgrades, fertilizer: 6 } })} act={() => {}} />)
    expect(headings().at(-1)).toBe('⭐ Favours')
    expect(rowOf(/Fine mist/).firstChild?.textContent).toBe('💧 Fine mist Lv 1')
  })

  it('every row but the Stoker is listed, with its price or its lock reason', () => {
    const s = withRun({ stars: 20, counters: { ...init.run.counters, harvests: 30 } })
    render(<Favours state={s} act={() => {}} />)
    const names = [...document.querySelectorAll('.favours .item > button:first-child')].map((b) => b.firstChild?.textContent)
    expect(names).toEqual(['🏠 Bunkhouse Lv 0', '💧 Fine mist Lv 0', '⭐ Sell price Lv 0', '🔥 Furnace speed Lv 0', '🔥 Furnace batch Lv 0', '⛏ Seam survey'])
    expect(rowOf(/Bunkhouse/).querySelector('small')!.textContent).toBe('pool 6 → 7 · ⭐15')
    expect((rowOf(/Bunkhouse/) as HTMLButtonElement).disabled).toBe(false)
    expect(rowOf(/Fine mist/).querySelector('small')!.textContent).toBe('needs fertilizer Lv5')
    expect(rowOf(/Sell price/).querySelector('small')!.textContent).toBe('needs sell price Lv5')
    expect(rowOf(/Furnace speed/).querySelector('small')!.textContent).toBe('needs a furnace')
    expect(rowOf(/Seam survey/).querySelector('small')!.textContent).toBe('needs vein Lv3')
    expect((rowOf(/Seam survey/) as HTMLButtonElement).disabled).toBe(true)
  })

  it('the furnace rows past the bar ladder: speed effect and price, batch 6 locked on the tray; the Stoker shows once ready', () => {
    const furnace = { ...init.run.furnace, built: true, levels: { fireCap: 4, batch: 4, speed: 2, tray: 1, slot: 1 } }
    const workers = { ...init.run.workers, certificates: ['fuel' as const] }
    render(<Favours state={withRun({ stars: 50, furnace, workers, counters: { ...init.run.counters, bars: 30 } })} act={() => {}} />)
    expect(rowOf(/Furnace speed/).querySelector('small')!.textContent).toBe('cycles 64 % → 51 % · ⭐10')
    expect(rowOf(/Furnace batch/).querySelector('small')!.textContent).toBe('needs tray Lv2')
    expect(rowOf(/Stoker/).querySelector('small')!.textContent).toBe(`furnace ×1.5, fuel ×2 · ⭐120 ${ITEMS.ironBar.emoji}6`)
  })

  it('buying Fine mist moves the Upgrades row to "Lv 5/5 +⭐1", still disabled as max', () => {
    const h = holder(withRun({ stars: 8, cash: 1e6, upgrades: { ...init.run.upgrades, fertilizer: 5 }, counters: { ...init.run.counters, harvests: 1e4, sales: 1e4 } }))
    const view = render(<Favours state={h.get()} act={h.act} />)
    fireEvent.click(rowOf(/Fine mist/))
    expect([h.get().run.upgrades.fertilizer, h.get().run.stars]).toEqual([6, 0])
    view.unmount()
    render(<Upgrades state={h.get()} act={h.act} />)
    const row = rowOf(/Fertilizer/) as HTMLButtonElement
    expect(row.textContent).toBe('Fertilizer Lv 5/5 +⭐1Grow time −53 % · max')
    expect(row.disabled).toBe(true)
    expect(row.querySelector('small')!.textContent).toBe('Grow time −53 % · max')
  })

  it('an order card shows its own ⭐ with one decimal under 10', () => {
    const offer = { good: 'radish' as const, count: 4, done: 0, tier: 0, accepted: false, stars: 0.4 }
    render(<Orders state={withRun({ orders: { unlocked: true, slots: 1, offers: [offer], rerolls: 0 } })} act={() => {}} />)
    expect(document.querySelector('.order-row')!.textContent).toContain('⭐0.4 · ')
  })

  it('the Sell card says how much ⭐ carries and how much is lost above 400', () => {
    const gate = withRun({ stars: 414, lifetime: { ...init.run.lifetime, cashEarned: 640_000 }, workers: { ...init.run.workers, certificates: ['plant', 'harvest'] }, workshop: { built: true, beds: [true, false, false, false], valve: false } })
    render(<SellCard state={gate} sell={() => {}} />)
    expect(screen.getByText('⭐ 400 carried to the next farm · ⭐14 lost above 400')).toBeTruthy()
  })

  it('reaching the Stoker\'s gate (the last bar batch level) does not toast "New worker" — its certificate is in ⭐ Favours', () => {
    const furnace = { ...init.run.furnace, built: true, levels: { fireCap: 4, batch: 3, speed: 2, tray: 2, slot: 2 } }
    const run = {
      ...init.run,
      cash: 1e5,
      mineLicense: true,
      vein: { level: 4, progress: 0, rock: 'stone' as const },
      inventory: { goldBar: 5 },
      furnace,
      counters: { ...init.run.counters, bars: 30 },
      workers: { ...init.run.workers, certificates: ['fuel' as const] },
    }
    localStorage.setItem(SAVE_KEY, serialize({ ...init, run }, Date.now()))
    localStorage.setItem(UI_KEY, JSON.stringify({ view: 'mine', pulledBack: true }))
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /^Batch 4 → 5 bars/ }))
    expect(screen.queryByRole('status')?.textContent ?? '').not.toContain('New worker')
    expect(screen.getByRole('button', { name: /^Batch 5 bars/ })).toBeTruthy()
  })

  it('Seam survey owned: one aim line under the vein — Off and the ores the vein drops, the active one pressed', () => {
    const h = holder(withRun({ mineLicense: true, vein: { level: 3, progress: 0, rock: 'stone' }, favours: { bunkhouse: 0, seam: true, aim: null } }))
    const view = render(<Mine state={h.get()} act={h.act} />)
    const group = screen.getByRole('group', { name: 'Seam aim' })
    const buttons = () => within(group).getAllByRole('button')
    expect(buttons().map((b) => [b.textContent, b.getAttribute('aria-pressed')])).toEqual([
      ['Off', 'true'],
      [ITEMS.copperOre.emoji, 'false'],
      [ITEMS.ironOre.emoji, 'false'],
    ])
    fireEvent.click(buttons()[2]!)
    expect(h.get().run.favours.aim).toBe('ironOre')
    view.rerender(<Mine state={h.get()} act={h.act} />)
    expect(within(screen.getByRole('group', { name: 'Seam aim' })).getAllByRole('button')[2]!.getAttribute('aria-pressed')).toBe('true')
    cleanup()
    render(<Mine state={withRun({ mineLicense: true, vein: { level: 3, progress: 0, rock: 'stone' } })} act={() => {}} />)
    expect(screen.queryByRole('group', { name: 'Seam aim' })).toBeNull()
  })
})
