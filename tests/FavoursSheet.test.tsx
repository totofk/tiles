// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from '../src/app/App'
import { Favours } from '../src/app/Favours'
import { SellCard } from '../src/app/Legacy'
import { Mine } from '../src/app/Mine'
import { Orders } from '../src/app/Orders'
import { Upgrades } from '../src/app/Upgrades'
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
  it('the HUD ⭐ is a button that opens the ⭐ Favours sheet', () => {
    localStorage.setItem(SAVE_KEY, serialize(withRun({ stars: 12, orders: { unlocked: true, slots: 2, offers: [] } }), Date.now()))
    render(<App />)
    const star = document.querySelector<HTMLElement>('button.hud-stars')!
    expect([star.textContent, star.title]).toEqual(['⭐ 12', '⭐ Favours'])
    fireEvent.click(star)
    const sheet = screen.getByRole('dialog', { name: '⭐ Favours' })
    expect(within(sheet).getByText('⭐ 12 to spend · resets when you sell the farm (up to 50 ⭐ carry over)')).toBeTruthy()
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
    expect(rowOf(/Stoker/).querySelector('small')!.textContent).toBe(`furnace ×1.5, fuel ×2 · ⭐15 ${ITEMS.ironBar.emoji}6`)
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
    render(<Orders state={withRun({ orders: { unlocked: true, slots: 1, offers: [offer] } })} act={() => {}} />)
    expect(document.querySelector('.order-row')!.textContent).toContain('⭐0.4 · ')
  })

  it('the Sell card says how much ⭐ carries and how much is lost above 50', () => {
    const gate = withRun({ stars: 64, lifetime: { ...init.run.lifetime, cashEarned: 640_000 }, workers: { ...init.run.workers, certificates: ['plant', 'harvest'] }, workshop: { built: true, beds: [true, false, false, false], valve: false } })
    render(<SellCard state={gate} sell={() => {}} />)
    expect(screen.getByText('⭐ 50 carried to the next farm · ⭐14 lost above 50')).toBeTruthy()
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
