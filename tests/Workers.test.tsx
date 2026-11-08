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
  workers: { pool, assigned: { plant: 0, water, harvest, ore: 0, fuel: 0, mine: 0, clerk: 0 }, certificates: ['water', 'harvest'] as ('water' | 'harvest')[] },
})

describe('👷 Workers card', () => {
  it('a fresh run: free 0 / 0, both certificates with their price and gate progress, no hire button', () => {
    setup({})
    expect(summary()).toBe('👷 Workers · free 0 / 0')
    expect(row('Water').textContent).toContain('waters 0/40')
    expect(within(row('Water')).getByRole('button', { name: /Certificate/ }).textContent).toBe(`Certificate ${ITEMS.stone.emoji}20 💰500`)
    expect(within(row('Harvest')).getByRole('button', { name: /Certificate/ }).textContent).toBe(
      `Certificate ${ITEMS.stone.emoji}20 ${ITEMS.coal.emoji}5 💰750`,
    )
    expect(row('Harvest').textContent).toContain('harvests 0/40')
    expect(row('Water').textContent).toContain('needs 💧 Water Cart (tool Lv3)')
    expect(row('Harvest').textContent).toContain('needs 🌾 Reaper (tool Lv3)')
    // 20 stone + 5 coal = 25 items, more than the starting storage of 20
    expect(row('Harvest').textContent).toContain('needs 📦 25 storage')
    expect(row('Water').textContent).not.toContain('storage')
    for (const b of screen.getAllByRole('button', { name: /Certificate/ })) expect((b as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByRole('button', { name: /Hire/ })).toBeNull()
  })

  it('batch 13: the counter reached but the tool below Lv3 keeps the certificate locked with only the tool line', () => {
    setup({ cash: 5000, inventory: { stone: 20 }, tools: { water: 2, harvest: 0, plant: 0 } }, { waters: 40 })
    expect(row('Water').textContent).not.toContain('waters')
    expect(row('Water').textContent).toContain('needs 💧 Water Cart (tool Lv3)')
    expect(within(row('Water')).getByRole('button', { name: /Certificate/ }).hasAttribute('disabled')).toBe(true)
  })

  it('buying the water certificate turns its row into [−] 0 [+]; the gate progress goes once unlocked', () => {
    const t = setup({ cash: 500, inventory: { stone: 20 }, tools: { water: 3, harvest: 0, plant: 0 } }, { waters: 40 })
    expect(row('Water').textContent).not.toContain('waters')
    expect(row('Water').textContent).not.toContain('needs')
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

  it('rows follow the farm loop, Plant / Water / Harvest, then the furnace jobs, then Mine, then Clerk; the plant certificate shows its price and gate', () => {
    setup({}, { plants: 12 })
    const labels = [...document.querySelectorAll('.worker-row > span:first-child')].map((s) => s.firstChild!.textContent)
    expect(labels).toEqual(['🌱 Plant', '💧 Water', '🌾 Harvest', `${ITEMS.copperOre.emoji} Ore`, `${ITEMS.coal.emoji} Fuel`, '⛏️ Mine', '📋 Clerk'])
    // the clerk certificate is priced in ⭐ + copper bars + cash and gated by orders completed
    const clerk = screen.getByText('📋 Clerk').closest('.worker-row') as HTMLElement
    expect(clerk.textContent).toContain('orders 0/20')
    expect(within(clerk).getByRole('button', { name: /Certificate/ }).textContent).toBe(`Certificate ${ITEMS.copperBar.emoji}6 ⭐20 💰200`)
    const plant = screen.getByText('🌱 Plant').closest('.worker-row') as HTMLElement
    expect(plant.textContent).toContain('plants 12/60')
    expect(within(plant).getByRole('button', { name: /Certificate/ }).textContent).toBe(`Certificate ${ITEMS.copperBar.emoji}10 💰300`)
  })

  it('the mine row shows only the gates still missing, one line each: mines n/200, vein Lv3; its certificate is in iron bars', () => {
    const mineRow = () => screen.getByText('⛏️ Mine').closest('.worker-row') as HTMLElement
    const gates = () => [...mineRow().querySelectorAll('span:first-child > small')].map((e) => e.textContent)
    setup({ vein: { level: 1, progress: 0, rock: 'stone' } }, { mines: 10 })
    expect(gates()).toEqual(['mines 10/200', 'vein Lv3'])
    expect(within(mineRow()).getByRole('button', { name: /Certificate/ }).textContent).toBe(`Certificate ${ITEMS.ironBar.emoji}5 💰500`)
    cleanup()
    setup({ vein: { level: 2, progress: 0, rock: 'stone' } }, { mines: 682 })
    expect(gates()).toEqual(['vein Lv3'])
    cleanup()
    setup({ vein: { level: 3, progress: 0, rock: 'stone' } }, { mines: 150 })
    expect(gates()).toEqual(['mines 150/200'])
    cleanup()
    setup({ vein: { level: 3, progress: 0, rock: 'stone' }, cash: 500, inventory: { ironBar: 5 } }, { mines: 200 })
    expect(gates()).toEqual([])
    expect((within(mineRow()).getByRole('button', { name: /Certificate/ }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('a certified planter gets [−] n [+] like the other jobs', () => {
    const t = setup({ cash: 0, workers: { pool: 1, assigned: { plant: 0, water: 0, harvest: 0, ore: 0, fuel: 0, mine: 0, clerk: 0 }, certificates: ['plant'] } })
    fireEvent.click(btn(/One more on Plant/))
    t.rerender()
    expect(t.get().run.workers.assigned.plant).toBe(1)
    // the fresh farm's untilled soil is work for it, and cash 0 cannot pay the wage
    expect(summary()).toBe('👷 Workers · free 0 / 1unpaid')
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

  it('a planter rings the empty tile it plants next (green) and its flash pops 🌱', () => {
    const tilled = { ...s.run.tiles[0], status: 'tilled' as const }
    const planted = { status: 'planted' as const, cropId: 'radish' as const, growth: 1, moisture: 1, ticksSinceMature: 0 }
    const state: GameState = {
      ...s,
      run: {
        ...s.run,
        cash: 10,
        tiles: s.run.tiles.map((_, i) => (i === 2 ? tilled : planted)),
        workers: { pool: 1, assigned: { plant: 1, water: 0, harvest: 0, ore: 0, fuel: 0, mine: 0, clerk: 0 }, certificates: ['plant'] },
      },
    }
    const { rerender } = render(<FarmGrid state={state} onTap={() => {}} />)
    expect(where('cell-target-plant')).toEqual([2])
    rerender(<FarmGrid state={state} onTap={() => {}} acted={[{ job: 'plant', tile: 2 }]} />)
    expect(cells()[2].querySelector('.cell-pop')!.textContent).toBe('🌱')
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

  it('in the app the Mine button flashes on the tick a mine worker presses it, and stops a tick later', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'] })
    const miner: GameState = {
      ...s,
      run: {
        ...s.run,
        cash: 10,
        mineLicense: true,
        pickaxe: { tier: 'wooden', durability: 25 },
        workers: { pool: 1, assigned: { plant: 0, water: 0, harvest: 0, ore: 0, fuel: 0, mine: 1, clerk: 0 }, certificates: ['mine'] },
      },
    }
    localStorage.setItem(SAVE_KEY, serialize(miner, Date.now()))
    render(<App />)
    const dig = () => document.querySelector('.mine-dig')!
    expect(dig().classList.contains('mine-flash')).toBe(false)
    // tick 0 is a worker tick: the first step presses Mine
    act(() => void vi.advanceTimersByTime(1000))
    expect(dig().classList.contains('mine-flash')).toBe(true)
    expect(dig().querySelector('.cell-pop')!.textContent).toBe('⛏️')
    act(() => void vi.advanceTimersByTime(1000))
    expect(dig().classList.contains('mine-flash')).toBe(false)
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

  it('the away banner counts the crops the planters planted while away, first', () => {
    const s = createInitialState()
    const at = (workerPlants: number, wagesPaid: number) => ({ ...s, run: { ...s.run, lifetime: { ...s.run.lifetime, workerPlants, wagesPaid } } })
    expect(bannerText(60_000, at(4, 0), at(4, 0))).toBe('Away for 1m — 60 ticks simulated')
    expect(bannerText(60_000, at(4, 0), at(13, 20))).toBe('Away for 1m — 60 ticks simulated · 🌱 9 planted · wages paid 💰20')
  })

  it('the away banner counts the miners\' presses and the iron bars smelted, only when non-zero', () => {
    const s = createInitialState()
    const at = (workerMines: number, ironBarsSmelted: number) => ({ ...s, run: { ...s.run, lifetime: { ...s.run.lifetime, workerMines, ironBarsSmelted } } })
    expect(bannerText(60_000, at(5, 1), at(5, 1))).toBe('Away for 1m — 60 ticks simulated')
    expect(bannerText(60_000, at(5, 1), at(17, 4))).toBe(`Away for 1m — 60 ticks simulated · ⛏️ 12 mined · ${ITEMS.ironBar.emoji} 3 smelted`)
  })
})
