// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../src/app/App'
import { FarmGrid } from '../src/app/FarmGrid'
import { Shop } from '../src/app/Shop'
import { Workshop } from '../src/app/Workshop'
import type { Act } from '../src/app/useGame'
import { priceText } from '../src/app/Mine'
import { sprinklerHopper, sprinklerTiles, workshopCost } from '../src/core/balance'
import { ITEMS } from '../src/core/data/items'
import { createInitialState, type GameState, type Tile } from '../src/core/state'
import { sprinklerWatered } from '../src/core/workshop'
import { serialize } from '../src/save/serialize'
import { SAVE_KEY } from '../src/save/storage'

afterEach(cleanup)

/** a workshop-built run: vein Lv4 so the recipes are reachable */
function setup(run: Partial<GameState['run']>) {
  const s = createInitialState()
  let state: GameState = { ...s, run: { ...s.run, vein: { ...s.run.vein, level: 4 }, ...run } }
  const act: Act = (fn) => {
    const r = fn(state)
    if (r.ok) state = r.state
  }
  const ui = () => <Workshop state={state} act={act} />
  const view = render(ui())
  return { get: () => state, rerender: () => view.rerender(ui()) }
}

const summary = () => document.querySelector('summary')!.textContent
const btn = (name: RegExp) => screen.getByRole('button', { name }) as HTMLButtonElement
const row = (label: RegExp) => screen.getByText(label).closest('.worker-row') as HTMLElement
/** growing lemon tiles with the given moistures (far from done, so nothing matures during a test) */
const growingTiles = (moistures: number[]): Tile[] =>
  moistures.map((moisture) => ({ status: 'planted' as const, cropId: 'lemon' as const, growth: 10, moisture, ticksSinceMature: 0 }))

describe('the Shop sells the workshop like the furnace (task 91)', () => {
  function setupShop(run: Partial<GameState['run']>) {
    const s = createInitialState()
    let state: GameState = { ...s, run: { ...s.run, ...run } }
    const act: Act = (fn) => {
      const r = fn(state)
      if (r.ok) state = r.state
    }
    const ui = () => <Shop state={state} act={act} cropId="radish" onSelectCrop={() => {}} />
    const view = render(ui())
    return { get: () => state, rerender: () => view.rerender(ui()) }
  }

  it('appears at vein Lv4, disabled until affordable, and disappears once bought', () => {
    setupShop({ vein: { level: 3, progress: 0, rock: 'stone' } })
    expect(screen.queryByRole('button', { name: /🔧 Workshop/ })).toBeNull()
    cleanup()
    setupShop({ vein: { level: 4, progress: 0, rock: 'stone' }, inventory: { stone: 30, ironBar: 6 } })
    expect(btn(/🔧 Workshop/).disabled).toBe(true)
    cleanup()
    const t = setupShop({ vein: { level: 4, progress: 0, rock: 'stone' }, cash: 20000, inventory: { stone: 30, ironBar: 6 } })
    const card = btn(/🔧 Workshop/)
    expect(card.disabled).toBe(false)
    expect(card.textContent).toContain(priceText(workshopCost(t.get().meta)))
    fireEvent.click(card)
    t.rerender()
    expect(t.get().run.workshop.built).toBe(true)
    expect(t.get().run.inventory.stone).toBe(0)
    expect(screen.queryByRole('button', { name: /🔧 Workshop/ })).toBeNull()
  })
})

describe('🔧 Workshop card', () => {
  it('is hidden until the workshop is built; the summary counts machines and the tiles they water', () => {
    setup({ workshop: { built: false, hoppers: [], valve: false } })
    expect(screen.queryByText(/🔧 Workshop/)).toBeNull()
    cleanup()
    setup({ workshop: { built: true, hoppers: [10, 24], valve: false } })
    expect(summary()).toBe(`🔧 Workshop · 💧 Sprinklers 2/4 — waters ${2 * sprinklerTiles()} tiles`)
  })

  it('one row per machine with its own coal gauge; an empty hopper says stalled on the row and the summary', () => {
    setup({ workshop: { built: true, hoppers: [10, 0], valve: false } })
    const first = row(/Machine 1/)
    expect(first.querySelector('.bar-fire')).toBeTruthy()
    expect(first.textContent).toContain(`${ITEMS.coal.emoji} 10/${sprinklerHopper()}`)
    expect(row(/Machine 2/).textContent).toContain(`— stalled`)
    expect(summary()).toContain('stalled')
  })

  it('the sprinkler recipe row: greyed with one token per missing material, builds when affordable, ✓ at 4 machines', () => {
    setup({ workshop: { built: true, hoppers: [], valve: false }, inventory: { goldBar: 2, ironBar: 5, copperBar: 8 }, cash: 3000 })
    const build = btn(/Build/)
    expect(build.disabled).toBe(true)
    const line = row(/^💧 Sprinkler$/).textContent!
    expect(line).toContain(`needs ${ITEMS.ironBar.emoji}3 ${ITEMS.goldBar.emoji}2 💰5000 more`)
    expect(line).toContain(`${ITEMS.copperBar.emoji}8`)
    expect(line).toContain(`waters ${sprinklerTiles()} tiles`)
  })

  it('the sprinkler recipe row builds a machine when affordable, and the max is a solid owned card', () => {
    const t = setup({ workshop: { built: true, hoppers: [], valve: false }, inventory: { goldBar: 4, ironBar: 8, copperBar: 8 }, cash: 8000 })
    expect(btn(/Build/).disabled).toBe(false)
    fireEvent.click(btn(/Build/))
    t.rerender()
    expect(t.get().run.workshop.hoppers).toEqual([0])
    expect(row(/Machine 1/).textContent).toContain(`${ITEMS.coal.emoji} 0/${sprinklerHopper()}`)
    cleanup()
    setup({ workshop: { built: true, hoppers: [24, 24, 24, 24], valve: false }, inventory: { goldBar: 9, ironBar: 9, copperBar: 9 }, cash: 99999 })
    const maxed = btn(/Build/)
    expect(maxed.disabled).toBe(true)
    expect(maxed.classList.contains('owned')).toBe(true)
    expect(maxed.textContent).toContain('✓ 4 machines')
  })

  it('the valve recipe row pays 2 gold bars and cash, then shows ✓; short bars give a needs line', () => {
    setup({ workshop: { built: true, hoppers: [24], valve: false }, cash: 99999 })
    expect(row(/Smart valve/).textContent).toContain(`needs ${ITEMS.goldBar.emoji}2`)
    expect(btn(/^Buy/).disabled).toBe(true)
    cleanup()
    const t = setup({ workshop: { built: true, hoppers: [24], valve: false }, inventory: { goldBar: 2 }, cash: 99999 })
    fireEvent.click(btn(/^Buy/))
    t.rerender()
    expect(t.get().run.workshop.valve).toBe(true)
    expect(t.get().run.inventory.goldBar).toBe(0)
    expect(btn(/^Buy/).textContent).toContain('✓')
  })

  it('sits below 👷 Workers in the mobile farm column', () => {
    const s = createInitialState()
    localStorage.setItem(SAVE_KEY, serialize({ ...s, run: { ...s.run, workshop: { built: true, hoppers: [24], valve: false } } }, Date.now()))
    render(<App />)
    const farm = document.querySelector<HTMLElement>('.farm')!
    expect(within(farm).getByText(/🔧 Workshop/)).toBeTruthy()
    localStorage.clear()
  })
})

describe('the 💧 grid badge on sprinkler-watered tiles (task 91)', () => {
  const moistures = [0.2, 0.4, 0.6, 0.8, 1.0, 1.2, 1.4, 1.6]
  const built = () => {
    const s = createInitialState()
    return { ...s, run: { ...s.run, tiles: growingTiles(moistures), workshop: { built: true, hoppers: [24], valve: false } } }
  }
  const cells = () => [...document.querySelectorAll('.cell')]
  const waterBadges = () => cells().flatMap((c, i) => (c.querySelector('.cell-order')?.textContent === '💧' ? [i] : []))

  afterEach(() => {
    vi.useRealTimers()
    localStorage.clear()
  })

  it('a corner 💧 (top-left, like the 📋 order badge) on the tiles the machines water, not the worker pop', () => {
    const state = built()
    expect(sprinklerWatered(state)).toEqual([0, 1, 2, 3, 4, 5])
    const { rerender } = render(<FarmGrid state={state} onTap={() => {}} watered={[0, 1, 2, 3, 4, 5]} />)
    expect(waterBadges()).toEqual([0, 1, 2, 3, 4, 5])
    expect(document.querySelector('.cell-pop')).toBeNull()
    expect(cells()[6].querySelector('.cell-order')).toBeNull()
    rerender(<FarmGrid state={state} onTap={() => {}} />)
    expect(waterBadges()).toEqual([])
  })

  it('in the app the badge shows on the tick the machines water, and clears a tick later', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'] })
    localStorage.setItem(SAVE_KEY, serialize(built(), Date.now()))
    render(<App />)
    expect(waterBadges()).toEqual([])
    // tick 0 is a worker clock tick: the first step waters the 6 driest tiles
    act(() => void vi.advanceTimersByTime(1000))
    expect(waterBadges()).toEqual([0, 1, 2, 3, 4, 5])
    act(() => void vi.advanceTimersByTime(1000))
    expect(waterBadges()).toEqual([])
  })
})
