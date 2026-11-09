// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { FarmGrid } from '../src/app/FarmGrid'
import { Hud } from '../src/app/Hud'
import { Orders } from '../src/app/Orders'
import { Shop } from '../src/app/Shop'
import type { Act } from '../src/app/useGame'
import { cropGrowTicks, cropSellPrice, itemSellPrice, orderBonus, orderCooldownTicks } from '../src/core/balance'
import { createInitialState, type GameState, type Offer, type RunState } from '../src/core/state'

afterEach(cleanup)

const init = createInitialState()
const offer = (o: Partial<Offer>): Offer => ({ good: 'radish', count: 40, done: 12, tier: 1, accepted: false, ...o })

function setup(run: Partial<RunState>, card = false) {
  let state: GameState = { ...init, run: { ...init.run, ...run } }
  const act: Act = (fn) => {
    const r = fn(state)
    if (r.ok) state = r.state
  }
  const ui = () => <Orders state={state} act={act} card={card} />
  const view = render(ui())
  return { get: () => state, rerender: () => view.rerender(ui()) }
}

const board = (offers: RunState['orders']['offers'], extra: Partial<RunState> = {}) => ({ orders: { unlocked: true, slots: offers.length, offers }, stars: 5, ...extra })
const rows = () => Array.from(document.querySelectorAll('.order-row')) as HTMLElement[]

describe('📋 Orders', () => {
  it('nothing before the board is bought', () => {
    setup({})
    expect(document.querySelector('.orders')).toBeNull()
  })

  it('one row per slot: emoji + done / count, tier dots, ⭐, cash bonus; Accept + Discard on an open offer', () => {
    setup(board([offer({}), { cooldownTicks: 432 }]))
    expect(screen.getByRole('heading').textContent).toBe('📋 Orders · ⭐ 5')
    const [open, wait] = rows()
    const bonus = Math.round(40 * cropSellPrice('radish', init.meta, 0) * orderBonus())
    expect(open.textContent).toContain('🥕 12 / 40')
    expect(open.textContent).toContain(`●●○ · ⭐2 · +💰${bonus}`)
    expect(within(open).getAllByRole('button').map((b) => b.textContent)).toEqual(['Accept', '✕'])
    expect(wait.textContent).toBe('⏳ next order in 7:12')
  })

  it('Accept, then an accepted crop order has ✕ only; an item order Deliver (enabled when storage holds the rest)', () => {
    const t = setup(board([offer({}), offer({ good: 'stone', count: 8, done: 0, tier: 0, accepted: true })], { inventory: { stone: 8 } }))
    within(rows()[0]).getByRole('button', { name: /Accept Carrot order/ }).click()
    t.rerender()
    expect(within(rows()[0]).getAllByRole('button').map((b) => b.textContent)).toEqual(['✕'])
    const item = rows()[1]
    expect(item.textContent).toContain(`+💰${Math.round(8 * itemSellPrice('stone', init.meta, 0) * orderBonus())}`)
    within(item).getByRole('button', { name: /Deliver Stone order/ }).click()
    t.rerender()
    expect(t.get().run.inventory.stone).toBe(0)
    expect(t.get().run.stars).toBe(6)
  })

  it('Discard starts the cooldown', () => {
    const t = setup(board([offer({})]))
    screen.getByRole('button', { name: /Discard/ }).click()
    t.rerender()
    expect(t.get().run.orders.offers[0]).toEqual({ cooldownTicks: orderCooldownTicks() })
    expect(rows()[0].textContent).toBe('⏳ next order in 10:00')
  })

  it('⭐ shop row: + Slot 3 ⭐10 and 🔄 Reroll ⭐2, bought with ⭐ only; no slot button at 4 slots', () => {
    const t = setup(board([offer({}), offer({})], { stars: 12 }))
    const shop = document.querySelector('.order-shop') as HTMLElement
    expect(within(shop).getAllByRole('button').map((b) => b.textContent)).toEqual(['+ Slot 3 ⭐10', '🔄 Reroll ⭐2'])
    within(shop).getByRole('button', { name: /Slot 3/ }).click()
    t.rerender()
    expect([t.get().run.stars, t.get().run.orders.slots]).toEqual([2, 3])
    cleanup()
    setup(board([offer({}), offer({}), offer({}), offer({})], { stars: 0 }))
    const full = document.querySelector('.order-shop') as HTMLElement
    expect(within(full).getAllByRole('button').map((b) => [b.textContent, (b as HTMLButtonElement).disabled])).toEqual([['🔄 Reroll ⭐2', true]])
  })

  it('in the farm column it is a closed card whose summary shows ⭐', () => {
    setup(board([offer({})]), true)
    const details = document.querySelector('details.orders') as HTMLDetailsElement
    expect(details.open).toBe(false)
    expect(details.querySelector('summary')!.textContent).toBe('📋 Orders · ⭐ 5')
  })

  it('batch 24.1: offer / accepted / ready rows carry their state class and badge; the item row shows the storage count, the summary counts ready', () => {
    setup(
      board(
        [
          offer({}), // open offer
          offer({ count: 40, done: 12, accepted: true }), // accepted crop order, filling
          offer({ good: 'stone', count: 8, done: 0, tier: 0, accepted: true }), // ready item order
        ],
        { inventory: { stone: 8 } },
      ),
    )
    const [open, accepted, ready] = rows()
    expect(open.classList.contains('order-offer')).toBe(true)
    expect(open.textContent).toContain('New')
    expect(accepted.classList.contains('order-accepted')).toBe(true)
    expect(accepted.textContent).toContain('filling from harvests')
    expect(accepted.querySelector('.bar')).toBeTruthy()
    expect(ready.classList.contains('order-ready')).toBe(true)
    expect(ready.textContent).toContain('✓ Ready')
    expect(ready.textContent).toContain('in storage') // not the old done 0/8
    expect(ready.querySelector('button.order-deliver')).toBeTruthy()
    expect(screen.getByRole('heading').textContent).toBe('📋 Orders · ⭐ 5 · 1 ready')
  })

  it('batch 24.1: ✕ on an accepted order with progress needs a second press; offers and zero-progress orders discard on one', () => {
    const t = setup(board([offer({ done: 12, accepted: true })]))
    within(rows()[0])
      .getByRole('button', { name: /Discard/ })
      .click()
    t.rerender()
    expect(t.get().run.orders.offers[0]).toEqual(expect.objectContaining({ accepted: true })) // armed, not discarded
    expect(within(rows()[0]).getByRole('button', { name: /Discard/ }).textContent).toBe('Discard?')
    within(rows()[0])
      .getByRole('button', { name: /Discard/ })
      .click()
    t.rerender()
    expect(t.get().run.orders.offers[0]).toEqual({ cooldownTicks: orderCooldownTicks() })
    cleanup()
    const one = setup(board([offer({})]))
    within(rows()[0])
      .getByRole('button', { name: /Discard/ })
      .click()
    one.rerender()
    expect(one.get().run.orders.offers[0]).toEqual({ cooldownTicks: orderCooldownTicks() })
  })

  it('batch 24.1: flashSlot adds the amber worker flash to that row only (the clerk acted on it)', () => {
    const state = { ...init, run: { ...init.run, ...board([offer({}), offer({})]) } }
    const view = render(<Orders state={state} act={() => {}} card flashSlot={1} />)
    expect(rows()[0].classList.contains('mine-flash')).toBe(false)
    expect(rows()[1].classList.contains('mine-flash')).toBe(true)
    view.unmount()
  })
})

describe('board in the Shop, ⭐ in the HUD, 📋 on ordered ready tiles', () => {
  const noop: Act = () => {}

  it('the Shop card shows after 50 sales and until bought', () => {
    const at = (sales: number, unlocked = false): GameState => ({
      ...init,
      run: { ...init.run, counters: { ...init.run.counters, sales }, orders: { ...init.run.orders, unlocked } },
    })
    const card = (s: GameState) => {
      const view = render(<Shop state={s} cropId="radish" onSelectCrop={() => {}} act={noop} />)
      const found = screen.queryByRole('button', { name: /Notice board/ })
      view.unmount()
      return found?.textContent ?? null
    }
    expect(card(at(49))).toBeNull()
    expect(card(at(50))).toBe('📋 Notice board⛰️⁠10 💰⁠100')
    expect(card(at(50, true))).toBeNull()
  })

  it('the HUD shows ⭐ only once the board is bought', () => {
    const view = render(<Hud state={init} />)
    expect(view.container.textContent).not.toContain('⭐')
    view.rerender(<Hud state={{ ...init, run: { ...init.run, ...board([]), stars: 9 } }} />)
    expect(view.container.textContent).toContain('⭐ 9')
  })

  it('a ready tile of an accepted crop order gets the 📋 badge; growing tiles and unaccepted orders do not', () => {
    const grow = cropGrowTicks('radish', init.meta, 0)
    const tiles = init.run.tiles.map((t, i) => ({ ...t, status: 'planted' as const, cropId: 'radish' as const, growth: i === 0 ? grow : 1, moisture: 1 }))
    const badges = (accepted: boolean) => {
      const view = render(<FarmGrid state={{ ...init, run: { ...init.run, tiles, ...board([offer({ accepted })]) } }} onTap={() => {}} />)
      const n = view.container.querySelectorAll('.cell-order').length
      view.unmount()
      return n
    }
    expect(badges(true)).toBe(1)
    expect(badges(false)).toBe(0)
  })
})
