// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../src/app/App'
import { FarmGrid } from '../src/app/FarmGrid'
import { Hud } from '../src/app/Hud'
import { bannerText, type Act } from '../src/app/useGame'
import { Workers } from '../src/app/Workers'
import { workerHireCost } from '../src/core/balance'
import { ITEMS } from '../src/core/data/items'
import { createInitialState, type Counters, type GameState } from '../src/core/state'
import { serialize } from '../src/save/serialize'
import { SAVE_KEY } from '../src/save/storage'

afterEach(cleanup)

function setup(run: Partial<GameState['run']>, counters: Partial<Counters> = {}) {
  const s = createInitialState()
  let state: GameState = { ...s, run: { ...s.run, ...run, counters: { ...s.run.counters, ...counters } } }
  const act: Act = (fn) => {
    const r = fn(state)
    if (r.ok) state = r.state
  }
  const ui = () => <Workers state={state} act={act} />
  const view = render(ui())
  return { get: () => state, rerender: () => view.rerender(ui()) }
}

const btn = (name: RegExp) => screen.getByRole('button', { name }) as HTMLButtonElement
const LABEL = { Water: '💧 Water', Harvest: '🌾 Harvest' }
/** the job's row, found by its exact label (tips also say "water") */
const row = (job: keyof typeof LABEL) => screen.getByText(LABEL[job]).closest('.worker-row') as HTMLElement
const summary = () => document.querySelector('summary')!.textContent
const certified = (pool: number, water = 0, harvest = 0) => ({
  workers: { pool, assigned: { water, harvest, ore: 0, fuel: 0 }, certificates: ['water', 'harvest'] as ('water' | 'harvest')[] },
})

describe('👷 Workers card', () => {
  it('a fresh run: free 0 / 0, both certificates with their price and gate progress, no hire button', () => {
    setup({})
    expect(summary()).toBe('👷 Workers · free 0 / 0')
    expect(row('Water').textContent).toContain('waters 0/40')
    expect(within(row('Water')).getByRole('button', { name: /Certificate/ }).textContent).toBe('Certificate 💰100')
    expect(within(row('Harvest')).getByRole('button', { name: /Certificate/ }).textContent).toBe(`Certificate ${ITEMS.stone.emoji}20 💰150`)
    expect(row('Harvest').textContent).toContain('harvests 0/40')
    for (const b of screen.getAllByRole('button', { name: /Certificate/ })) expect((b as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByRole('button', { name: /Hire/ })).toBeNull()
  })

  it('buying the water certificate turns its row into [−] 0 [+]; the gate progress goes once unlocked', () => {
    const t = setup({ cash: 100 }, { waters: 40 })
    expect(row('Water').textContent).not.toContain('waters')
    fireEvent.click(within(row('Water')).getByRole('button', { name: /Certificate/ }))
    t.rerender()
    expect(t.get().run.workers.certificates).toEqual(['water'])
    expect(btn(/One more on Water/).disabled).toBe(true) // no free worker
    expect(btn(/One less on Water/).disabled).toBe(true)
  })

  it('the hire button shows after 30 harvests with its price; hiring and assigning update the free count', () => {
    const t = setup({ cash: 500, ...certified(0) }, { harvests: 30 })
    fireEvent.click(btn(/Hire worker/))
    t.rerender()
    expect(t.get().run.workers.pool).toBe(1)
    expect(btn(/Hire worker/).textContent).toBe(`👷 Hire worker 💰${workerHireCost(1, t.get().meta)}`)
    expect(summary()).toBe('👷 Workers · free 1 / 1')
    fireEvent.click(btn(/One more on Water/))
    t.rerender()
    expect(summary()).toBe('👷 Workers · free 0 / 1')
    expect(within(row('Water')).getByText('1')).toBeTruthy()
    fireEvent.click(btn(/One less on Water/))
    t.rerender()
    expect(t.get().run.workers.assigned.water).toBe(0)
  })

  it('a full pool says so on a disabled hire button', () => {
    setup({ cash: 1e6, ...certified(6) }, { harvests: 30 })
    expect(btn(/Hire worker/).disabled).toBe(true)
    expect(btn(/Hire worker/).textContent).toContain('pool full')
  })

  it('"unpaid" on the row (and the summary) whose worker would act but cannot pay', () => {
    const s = createInitialState()
    const dry = { status: 'planted' as const, cropId: 'radish' as const, growth: 1, moisture: 0, ticksSinceMature: 0 }
    setup({ cash: 0, tiles: [dry, ...s.run.tiles.slice(1)], ...certified(2, 1, 1) })
    expect(within(row('Water')).getByText('unpaid')).toBeTruthy()
    expect(within(row('Harvest')).queryByText('unpaid')).toBeNull() // nothing ripe: idle, not unpaid
    expect(summary()).toBe('👷 Workers · free 0 / 2unpaid')
  })

  it('sits below the grid in the mobile Farm view', () => {
    render(<App />)
    expect(within(document.querySelector<HTMLElement>('.farm')!).getByText(/👷 Workers/)).toBeTruthy()
  })
})

describe('worker targets on the grid (task 60)', () => {
  const s = createInitialState()
  const dry = { status: 'planted' as const, cropId: 'radish' as const, growth: 1, moisture: 0, ticksSinceMature: 0 }
  const watered: GameState = { ...s, run: { ...s.run, cash: 10, tiles: [s.run.tiles[0], dry, ...s.run.tiles.slice(2)], ...certified(1, 1, 0) } }
  const cells = () => [...document.querySelectorAll('.cell')]
  const where = (cls: string) => cells().flatMap((c, i) => (c.classList.contains(cls) ? [i] : []))

  afterEach(() => {
    vi.useRealTimers()
    localStorage.clear()
  })

  it('a dashed ring on the tile a worker acts on next; the acted tiles flash with the job emoji', () => {
    const { rerender } = render(<FarmGrid state={watered} onTap={() => {}} />)
    expect(where('cell-target-water')).toEqual([1])
    expect(where('cell-target')).toEqual([1])
    expect(document.querySelector('.cell-pop')).toBeNull()
    rerender(<FarmGrid state={watered} onTap={() => {}} acted={[{ job: 'water', tile: 1 }]} />)
    expect(where('cell-flash')).toEqual([1])
    expect(cells()[1].querySelector('.cell-pop')!.textContent).toBe('💧')
  })

  it('in the app the ringed tile flashes on the tick the worker acts, and stops a tick later', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'] })
    localStorage.setItem(SAVE_KEY, serialize(watered, Date.now()))
    render(<App />)
    expect(where('cell-target-water')).toEqual([1])
    // tick 0 is a worker tick: the first step waters tile 1
    act(() => void vi.advanceTimersByTime(1000))
    expect(where('cell-flash')).toEqual([1])
    expect(where('cell-target')).toEqual([]) // watered to full: not due at the next worker tick
    act(() => void vi.advanceTimersByTime(1000))
    expect(where('cell-flash')).toEqual([])
  })
})

describe('HUD and away banner', () => {
  it('HUD shows 👷 N once a worker is hired', () => {
    const s = createInitialState()
    const { rerender } = render(<Hud state={s} />)
    expect(screen.queryByText(/👷/)).toBeNull()
    rerender(<Hud state={{ ...s, run: { ...s.run, ...certified(3) } }} />)
    expect(screen.getByText('👷 3')).toBeTruthy()
  })

  it('the away banner adds the wages paid while away, only when there were some', () => {
    const s = createInitialState()
    const paid = (wagesPaid: number) => ({ ...s, run: { ...s.run, lifetime: { ...s.run.lifetime, wagesPaid } } })
    expect(bannerText(60_000, s, s)).toBe('Away for 1m — 60 ticks simulated')
    expect(bannerText(60_000, paid(3), paid(15))).toBe('Away for 1m — 60 ticks simulated · wages paid 💰12')
  })
})
