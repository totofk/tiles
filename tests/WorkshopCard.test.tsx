// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import App from '../src/app/App'
import { FarmGrid } from '../src/app/FarmGrid'
import { Workers } from '../src/app/Workers'
import { Shop } from '../src/app/Shop'
import { Workshop } from '../src/app/Workshop'
import type { Act } from '../src/app/useGame'
import { priceText } from '../src/app/Mine'
import { sprinklerCost, sprinklerMax, workshopCost } from '../src/core/balance'
import { SPRINKLER_EMOJI } from '../src/core/workshop'
import { createInitialState, createTile, type GameState, type Tile } from '../src/core/state'
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
const row = (label: RegExp) => screen.getByText(label).closest('.recipe-row, .gauge-row, .worker-row') as HTMLElement
/** growing lemon tiles with the given moistures (far from done, so nothing matures during a test) */
const growingTiles = (moistures: number[]): Tile[] =>
  moistures.map((moisture) => ({ status: 'planted' as const, cropId: 'lemon' as const, growth: 10, moisture, ticksSinceMature: 0 }))
const NO_BEDS: GameState['run']['workshop']['beds'] = [false, false, false, false]

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

describe('🔧 Workshop card (batch 26)', () => {
  it('is hidden until the workshop is built; the summary and its one line count beds', () => {
    setup({ workshop: { built: false, beds: NO_BEDS, valve: false } })
    expect(screen.queryByText(/🔧 Workshop/)).toBeNull()
    cleanup()
    setup({ workshop: { built: true, beds: [true, true, false, false], valve: false } })
    expect(summary()).toBe(`🔧 Workshop · ${SPRINKLER_EMOJI} 2/${sprinklerMax()} beds`)
    expect(row(new RegExp(`${SPRINKLER_EMOJI} 2/4 beds —`)).textContent).toBe(`${SPRINKLER_EMOJI} 2/4 beds — the water worker retires at 4/4`)
  })

  it('two groups — the one-line gauge group, then one Build grid with an h3, a hint and no buy buttons', () => {
    setup({ workshop: { built: true, beds: [true], valve: false } as GameState['run']['workshop'] })
    const card = document.querySelector('details.workers')!
    const groups = [...card.children].filter((c) => c.tagName === 'DIV')
    expect(groups.map((g) => g.className)).toEqual(['group gauge-grid', 'recipe-wrap'])
    const build = card.querySelector('.recipe-grid')!
    expect([...build.querySelectorAll('h3')].map((h) => h.textContent)).toEqual(['Build'])
    expect(build.querySelector('.hint')!.textContent).toBe(`Build on a bed's socket ${SPRINKLER_EMOJI} on the farm`)
    expect(build.querySelectorAll('button')).toHaveLength(0)
  })

  it('the Smart valve row shows ✓ Built with its batch-28 note only when owned', () => {
    setup({ workshop: { built: true, beds: NO_BEDS, valve: false } })
    expect(screen.queryByText(/Smart valve/)).toBeNull()
    cleanup()
    setup({ workshop: { built: true, beds: NO_BEDS, valve: true } })
    expect(row(/Smart valve/).querySelector('.owned-badge')!.textContent).toBe('✓ Built')
    expect(row(/Smart valve/).textContent).toContain('gets a job when Fields get pressure')
  })

  it('sits below 👷 Workers in the mobile farm column', () => {
    const s = createInitialState()
    localStorage.setItem(SAVE_KEY, serialize({ ...s, run: { ...s.run, workshop: { built: true, beds: NO_BEDS, valve: false } } }, Date.now()))
    render(<App />)
    const farm = document.querySelector<HTMLElement>('.farm')!
    expect(within(farm).getByText(/🔧 Workshop/)).toBeTruthy()
    localStorage.clear()
  })
})

describe('the bed socket stub and the confirm sheet (batch 26)', () => {
  /** 19 tiles → beds 1–4 exist; sprinkler on bed 0 */
  const at = (workshop: GameState['run']['workshop'], tiles = 19): GameState => {
    const s = createInitialState()
    return { ...s, run: { ...s.run, tiles: Array.from({ length: tiles }, createTile), workshop } }
  }

  it('the stub shows only when the workshop is built, the bed has an owned tile and the bed has no sprinkler', () => {
    const built = at({ built: true, beds: NO_BEDS, valve: false })
    render(<FarmGrid state={built} onTap={() => {}} />)
    // 19 tiles = 4 beds (the last with 1 owned tile), each with its socket stub
    expect(document.querySelectorAll('.bed-socket')).toHaveLength(4)
    cleanup()
    render(<FarmGrid state={at({ built: false, beds: NO_BEDS, valve: false })} onTap={() => {}} />)
    expect(document.querySelectorAll('.bed-socket')).toHaveLength(0)
    cleanup()
    // bed 1 has the sprinkler: a fountain on the frame, no stub on that bed
    render(<FarmGrid state={at({ built: true, beds: [false, true, false, false], valve: false })} onTap={() => {}} />)
    const beds = [...document.querySelectorAll('.bed')]
    expect(beds.filter((b) => b.querySelector('.bed-socket'))).toHaveLength(3)
    expect(beds[1].querySelector('.bed-fountain')!.textContent).toBe(SPRINKLER_EMOJI)
  })

  it('the stub is grey when the recipe is short and pulses (bed-socket-ready) when storage holds it', () => {
    const short = at({ built: true, beds: NO_BEDS, valve: false })
    render(<FarmGrid state={short} onTap={() => {}} />)
    expect(document.querySelector('.bed-socket')!.className).toBe('bed-socket')
    cleanup()
    const ready = { ...short, run: { ...short.run, inventory: { goldBar: 4, ironBar: 8, copperBar: 8 }, cash: 8000 } }
    render(<FarmGrid state={ready} onTap={() => {}} />)
    expect(document.querySelector('.bed-socket')!.className).toBe('bed-socket bed-socket-ready')
  })

  it('a tap opens the sheet: title, both lines and the price; a short recipe disables Build and lists what is missing', () => {
    const s = at({ built: true, beds: NO_BEDS, valve: false })
    render(<FarmGrid state={s} onTap={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Bed 3 sprinkler socket' }))
    expect(screen.getByText('Bed 3 sprinkler')).toBeTruthy()
    expect(screen.getByText('Waters these 6 tiles forever')).toBeTruthy()
    expect(screen.getByText('Permanent — cannot be moved or sold')).toBeTruthy()
    const build = btn(/^Build$/)
    expect(document.querySelector('.sheet-price')!.textContent).toContain(priceText(sprinklerCost(s.meta)))
    expect(build.disabled).toBe(true)
    expect(screen.getByText(/needs /).textContent).toContain(sprinklerCost(s.meta).goldBar! + '')
  })

  it('Build pays and lights the bed; closing the sheet is the cancel (no placement mode)', () => {
    const s = at({ built: true, beds: [true, false, false, false], valve: false }, 19)
    const paid: GameState = { ...s, run: { ...s.run, inventory: { goldBar: 4, ironBar: 8, copperBar: 8 }, cash: 8000 } }
    let state = paid
    const act: Act = (fn) => {
      const r = fn(state)
      if (r.ok) state = r.state
    }
    const { rerender } = render(<FarmGrid state={paid} onTap={() => {}} act={act} />)
    fireEvent.click(screen.getByRole('button', { name: 'Bed 2 sprinkler socket' }))
    fireEvent.click(btn(/^Build$/))
    expect(state.run.workshop.beds[1]).toBe(true)
    expect(state.run.inventory.goldBar).toBe(0)
    expect(screen.queryByText('Bed 2 sprinkler')).toBeNull()
    rerender(<FarmGrid state={state} onTap={() => {}} act={act} />)
    expect(document.querySelectorAll('.bed-fountain')).toHaveLength(2)
  })

  it('a built bed has the blue frame class and its cells render no water bar', () => {
    const s = at({ built: true, beds: [false, true, false, false], valve: false })
    const planted = { ...s, run: { ...s.run, tiles: growingTiles(Array.from({ length: 19 }, (_, i) => (i < 12 ? 2 : 1))) } }
    render(<FarmGrid state={planted} onTap={() => {}} />)
    const beds = [...document.querySelectorAll('.bed')]
    expect(beds[1].className).toBe('bed bed-irrigated')
    expect(beds[0].className).toBe('bed')
    expect(beds[1].querySelectorAll('.bar-water')).toHaveLength(0)
    expect(beds[0].querySelectorAll('.bar-water').length).toBeGreaterThan(0)
  })
})

describe('the Workers card water row (batch 26)', () => {
  it('says "nothing to water — reassign" when every owned tile sits in a sprinklered bed', () => {
    const s = createInitialState()
    const allBeds: GameState['run']['workshop']['beds'] = [true, true, true, true]
    const run: GameState['run'] = {
      ...s.run,
      tiles: growingTiles(Array(24).fill(1)),
      workshop: { built: true, beds: allBeds, valve: false },
      workers: { ...s.run.workers, certificates: ['water'] },
    }
    const act: Act = () => {}
    render(<Workers state={{ ...s, run }} act={act} />)
    expect(row(/💧 Water/).textContent).toContain('nothing to water — reassign')
    cleanup()
    const oneDry = { ...run, workshop: { built: true, beds: [true, true, true, false], valve: false } }
    render(<Workers state={{ ...s, run: oneDry }} act={act} />)
    expect(row(/💧 Water/).textContent).not.toContain('nothing to water')
  })
})
