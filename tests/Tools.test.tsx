// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Bar } from '../src/app/Bar'
import { Tools, pressText } from '../src/app/Tools'
import type { Act } from '../src/app/useGame'
import { createInitialState, createTile, type GameState, type Tile } from '../src/core/state'

afterEach(cleanup)

const dry: Tile = { ...createTile(), status: 'planted', cropId: 'radish', growth: 1, moisture: 0 }

function setup(run: Partial<GameState['run']>, stacked = false) {
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
  const view = render(<Tools state={state} act={act} cropId="radish" stacked={stacked} />)
  return {
    toasts,
    get: () => state,
    rerender: () => view.rerender(<Tools state={state} act={act} cropId="radish" stacked={stacked} />),
  }
}
const labels = () => screen.queryAllByRole('button').map((b) => b.textContent)

describe('farm tool buttons', () => {
  it('render nothing before any tool is owned', () => {
    setup({})
    expect(labels()).toEqual([])
  })

  it('one button per owned tool at every level: 1, n with a ⋯ mark, all', () => {
    setup({ tools: { water: 1, harvest: 2, plant: 3 }, toolN: { water: 1, harvest: 2, plant: 1 } })
    expect(labels()).toEqual(['Water 1', 'Harvest 2⋯', 'Plant all'])
    expect(screen.getByRole('button', { name: 'Harvest 2' })).toBeTruthy()
  })

  it('the ⋯ opens the popover whose −/+ change n within 1 … ceil(tiles / 3); Esc closes it', () => {
    const t = setup({ tools: { water: 2, harvest: 0, plant: 0 } })
    fireEvent.click(document.querySelector('.tool-more')!)
    t.rerender()
    expect(t.toasts).toEqual([])
    const fewer = () => screen.getByRole('button', { name: 'Water fewer tiles' }) as HTMLButtonElement
    const more = () => screen.getByRole('button', { name: 'Water more tiles' }) as HTMLButtonElement
    expect(fewer().disabled).toBe(true)
    for (const n of [2, 3]) {
      fireEvent.click(more())
      t.rerender()
      expect(screen.getByRole('button', { name: `Water ${n}` })).toBeTruthy()
      expect(screen.getByRole('dialog').textContent).toBe(`−${n}+`)
    }
    expect(more().disabled).toBe(true) // 9 tiles → at most 3
    fireEvent.click(fewer())
    t.rerender()
    expect(t.get().run.toolN.water).toBe(2)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('a tap presses; a 450 ms touch hold opens the popover without pressing; a pointer-down outside closes it', () => {
    vi.useFakeTimers()
    try {
      const t = setup({ tiles: [dry, dry], tools: { water: 2, harvest: 0, plant: 0 } })
      const button = () => screen.getByRole('button', { name: 'Water 1' })
      // short tap
      fireEvent.touchStart(button())
      vi.advanceTimersByTime(200)
      fireEvent.touchEnd(button())
      fireEvent.click(button())
      expect(t.toasts).toEqual(['Watered 1/1'])
      expect(screen.queryByRole('dialog')).toBeNull()
      // long press: the click that ends the touch does not also press
      fireEvent.touchStart(button())
      act(() => void vi.advanceTimersByTime(450))
      fireEvent.touchEnd(button())
      fireEvent.click(button())
      expect(t.toasts).toEqual(['Watered 1/1'])
      expect(screen.getByRole('dialog', { name: 'Water tiles per press' })).toBeTruthy()
      fireEvent.pointerDown(document.body)
      expect(screen.queryByRole('dialog')).toBeNull()
      // the next tap presses again
      fireEvent.click(button())
      expect(t.toasts).toEqual(['Watered 1/1', 'Watered 1/1'])
    } finally {
      vi.useRealTimers()
    }
  })

  it('a copper tool gets the copper mark; its press summary names the bonus', () => {
    setup({ tools: { water: 1, harvest: 2, plant: 0 }, toolTier: { water: 1, harvest: 0, plant: 0 } })
    expect(screen.getByRole('button', { name: 'Water 1' }).className).toBe('copper')
    expect(screen.getByRole('button', { name: 'Harvest 1' }).className).toBe('')
    const ok = { ok: true as const, state: createInitialState(), done: 6, wanted: 6, stoppedBy: null }
    expect(pressText('harvest', { ...ok, bonus: 1 })).toBe('Harvested 6/6 (+1 bonus)')
    expect(pressText('harvest', { ...ok, bonus: 1 }, 540)).toBe('Harvested 6/6 (+1 bonus) +💰540')
    expect(pressText('plant', { ...ok, bonus: 0 }, -20)).toBe('Planted 6/6')
    expect(pressText('plant', { ...ok, bonus: 2 })).toBe('Planted 6/6 (2 seeds kept)')
    expect(pressText('plant', { ...ok, bonus: 0, done: 2, stoppedBy: 'NO_ENERGY' })).toBe('Planted 2/6 — out of energy')
  })

  it('the moisture bar shows a darker band for moisture above 1', () => {
    render(<Bar value={1.5} kind="water" />)
    const spans = document.querySelectorAll<HTMLElement>('.bar-water > span')
    expect([...spans].map((s) => [s.className, s.style.width])).toEqual([['', '100%'], ['bar-over', '50%']])
    cleanup()
    render(<Bar value={0.4} kind="water" />)
    expect(document.querySelector('.bar-over')).toBeNull()
  })

  it('right-click opens the popover and does not press', () => {
    const t = setup({ tiles: [dry], tools: { water: 0, harvest: 0, plant: 2 } })
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Plant 1' }))
    expect(screen.getByRole('dialog', { name: 'Plant tiles per press' })).toBeTruthy()
    expect(t.toasts).toEqual([])
  })

  it('a press toasts done/wanted and why it stopped', () => {
    const tiles = Array.from({ length: 9 }, () => dry)
    const t = setup({ tiles, tools: { water: 3, harvest: 0, plant: 0 }, energy: 5 })
    fireEvent.click(screen.getByRole('button', { name: 'Water all' }))
    expect(t.toasts).toEqual(['Watered 5/9 — out of energy'])
    expect(t.get().run.energy).toBe(0)
  })

  describe('stacked rows (desktop)', () => {
    it('one row per owned tool in Plant / Water / Harvest order; − / + only on a level-2 row, empty slots elsewhere', () => {
      setup({ tools: { water: 2, harvest: 3, plant: 1 }, toolN: { water: 1, harvest: 1, plant: 1 } }, true)
      const rows = [...document.querySelectorAll('.tool-row')]
      expect(rows.map((r) => [...r.children].map((c) => c.textContent))).toEqual([
        ['', 'Plant 1', ''],
        ['−', 'Water 1', '+'],
        ['', 'Harvest all', ''],
      ])
      expect(document.querySelectorAll('.tool-row > span.tool-step[aria-hidden="true"]')).toHaveLength(4)
      const names = screen.getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent)
      expect(names).toEqual(['Plant 1', 'Water fewer tiles', 'Water 1', 'Water more tiles', 'Harvest all'])
      expect(document.querySelector('.tool-more')).toBeNull()
    })

    it('− / + set n within 1 … ceil(tiles / 3) with the same disabled states as the popover', () => {
      const t = setup({ tools: { water: 0, harvest: 2, plant: 0 } }, true)
      const fewer = () => screen.getByRole('button', { name: 'Harvest fewer tiles' }) as HTMLButtonElement
      const more = () => screen.getByRole('button', { name: 'Harvest more tiles' }) as HTMLButtonElement
      expect(fewer().disabled).toBe(true)
      for (const n of [2, 3]) {
        fireEvent.click(more())
        t.rerender()
        expect(screen.getByRole('button', { name: `Harvest ${n}` })).toBeTruthy()
      }
      expect(more().disabled).toBe(true) // 9 tiles → at most 3
      fireEvent.click(fewer())
      t.rerender()
      expect(t.get().run.toolN.harvest).toBe(2)
      expect(t.toasts).toEqual([null, null, null])
    })

    it('right-click and a touch hold press or do nothing: no popover; a press still toasts; copper keeps its mark', () => {
      vi.useFakeTimers()
      try {
        const t = setup({ tiles: [dry, dry], tools: { water: 2, harvest: 0, plant: 0 }, toolTier: { water: 1, harvest: 0, plant: 0 } }, true)
        const button = screen.getByRole('button', { name: 'Water 1' })
        expect(button.className).toBe('copper')
        fireEvent.contextMenu(button)
        fireEvent.touchStart(button)
        act(() => void vi.advanceTimersByTime(450))
        expect(screen.queryByRole('dialog')).toBeNull()
        fireEvent.touchEnd(button)
        fireEvent.click(button)
        expect(t.toasts).toEqual(['Watered 1/1'])
      } finally {
        vi.useRealTimers()
      }
    })
  })

  it('a full press has no reason; nothing eligible gives the action error', () => {
    const t = setup({ tiles: [dry, dry], tools: { water: 3, harvest: 1, plant: 0 } })
    fireEvent.click(screen.getByRole('button', { name: 'Water all' }))
    fireEvent.click(screen.getByRole('button', { name: 'Harvest 1' }))
    expect(t.toasts).toEqual(['Watered 2/2', 'NOTHING_TO_DO'])
  })
})
