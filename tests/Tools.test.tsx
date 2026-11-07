// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Tools } from '../src/app/Tools'
import type { Act } from '../src/app/useGame'
import { createInitialState, createTile, type GameState, type Tile } from '../src/core/state'

afterEach(cleanup)

const dry: Tile = { ...createTile(), status: 'planted', cropId: 'radish', growth: 1, moisture: 0 }

function setup(run: Partial<GameState['run']>) {
  const s = createInitialState()
  let state: GameState = { ...s, run: { ...s.run, ...run } }
  const toasts: (string | null)[] = []
  // the same contract as useGame's act: run fn, toast on ok, keep the new state
  const act: Act = (fn, okToast) => {
    const r = fn(state)
    if (!r.ok) return toasts.push(r.error)
    toasts.push(okToast?.(state, r.state) ?? null)
    state = r.state
  }
  const view = render(<Tools state={state} act={act} cropId="radish" />)
  return { toasts, get: () => state, rerender: () => view.rerender(<Tools state={state} act={act} cropId="radish" />) }
}
const labels = () => screen.queryAllByRole('button').map((b) => b.textContent)

describe('farm tool buttons', () => {
  it('render nothing before any tool is owned', () => {
    setup({})
    expect(labels()).toEqual([])
  })

  it('one button per owned tool: level 1 = 1, level 2 = n with −/+, level 3 = all', () => {
    setup({ tools: { water: 1, harvest: 2, plant: 3 }, toolN: { water: 1, harvest: 2, plant: 1 } })
    expect(labels()).toEqual(['Water 1', '−', 'Harvest 2', '+', 'Plant all'])
  })

  it('the level-2 stepper changes n within 1 … ceil(tiles / 3)', () => {
    const t = setup({ tools: { water: 2, harvest: 0, plant: 0 } })
    const fewer = () => screen.getByRole('button', { name: 'Water fewer tiles' }) as HTMLButtonElement
    const more = () => screen.getByRole('button', { name: 'Water more tiles' }) as HTMLButtonElement
    expect(fewer().disabled).toBe(true)
    for (const n of [2, 3]) {
      fireEvent.click(more())
      t.rerender()
      expect(screen.getByRole('button', { name: `Water ${n}` })).toBeTruthy()
    }
    expect(more().disabled).toBe(true) // 9 tiles → at most 3
    fireEvent.click(fewer())
    t.rerender()
    expect(t.get().run.toolN.water).toBe(2)
  })

  it('a press toasts done/wanted and why it stopped', () => {
    const tiles = Array.from({ length: 9 }, () => dry)
    const t = setup({ tiles, tools: { water: 3, harvest: 0, plant: 0 }, energy: 5 })
    fireEvent.click(screen.getByRole('button', { name: 'Water all' }))
    expect(t.toasts).toEqual(['Watered 5/9 — out of energy'])
    expect(t.get().run.energy).toBe(0)
  })

  it('a full press has no reason; nothing eligible gives the action error', () => {
    const t = setup({ tiles: [dry, dry], tools: { water: 3, harvest: 1, plant: 0 } })
    fireEvent.click(screen.getByRole('button', { name: 'Water all' }))
    fireEvent.click(screen.getByRole('button', { name: 'Harvest 1' }))
    expect(t.toasts).toEqual(['Watered 2/2', 'NOTHING_TO_DO'])
  })
})
