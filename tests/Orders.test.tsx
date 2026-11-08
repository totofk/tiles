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
    expect(within(open).getAllByRole('button').map((b) => b.textContent)).toEqual(['Accept', 'Discard'])
    expect(wait.textContent).toBe('⏳ next order in 7:12')
  })

  it('Accept, then an accepted crop order has Discard only; an item order Deliver (enabled when storage holds the rest)', () => {
    const t = setup(board([offer({}), offer({ good: 'stone', count: 8, done: 0, tier: 0, accepted: true })], { inventory: { stone: 8 } }))
    within(rows()[0]).getByRole('button', { name: /Accept Carrot order/ }).click()
    t.rerender()
    expect(within(rows()[0]).getAllByRole('button').map((b) => b.textContent)).toEqual(['Discard'])
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

  it('in the farm column it is a closed card whose summary shows ⭐', () => {
    setup(board([offer({})]), true)
    const details = document.querySelector('details.orders') as HTMLDetailsElement
    expect(details.open).toBe(false)
    expect(details.querySelector('summary')!.textContent).toBe('📋 Orders · ⭐ 5')
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
    expect(card(at(50))).toBe('📋 Notice board⛰️10 💰100')
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
