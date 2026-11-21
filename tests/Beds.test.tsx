// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FarmGrid } from '../src/app/FarmGrid'
import type { ActionResult } from '../src/core/actions'
import { createInitialState, type GameState, type Tile } from '../src/core/state'
import { plantTreeBed } from '../src/core/tree'

const ok = (r: ActionResult): GameState => {
  if (!r.ok) throw new Error(r.error)
  return r.state
}

afterEach(cleanup)

const untilled: Tile = { status: 'untilled', growth: 0, moisture: 0, ticksSinceMature: 0 }
const at = (n: number): GameState => {
  const s = createInitialState()
  return { ...s, run: { ...s.run, tiles: Array.from({ length: n }, () => untilled) } }
}
const beds = () => [...document.querySelectorAll<HTMLElement>('.bed')]

describe('home lot beds layout (batch 25, task 135)', () => {
  it('9 tiles → 2 beds; the second keeps its 3×2 shape with 3 cells + 3 hidden slots', () => {
    render(<FarmGrid state={at(9)} onTap={() => {}} />)
    expect(beds()).toHaveLength(2)
    expect(beds()[0].getAttribute('role')).toBe('group')
    expect(beds()[0].getAttribute('aria-label')).toBe('Bed 1')
    expect(beds()[0].querySelectorAll('.cell')).toHaveLength(6)
    expect(beds()[0].querySelectorAll('.cell-slot')).toHaveLength(0)
    expect(beds()[1].getAttribute('aria-label')).toBe('Bed 2')
    expect(beds()[1].querySelectorAll('.cell')).toHaveLength(3)
    expect(beds()[1].querySelectorAll('.cell-slot[aria-hidden="true"]')).toHaveLength(3)
  })

  it('24 tiles → 4 beds × 6 cells, no slots', () => {
    render(<FarmGrid state={at(24)} onTap={() => {}} />)
    expect(beds()).toHaveLength(4)
    expect(beds().map((b) => b.querySelectorAll('.cell').length)).toEqual([6, 6, 6, 6])
    expect(document.querySelectorAll('.cell-slot')).toHaveLength(0)
  })

  it('tapping the 8th cell calls onTap(7) — the GLOBAL tile index survives the bed split', () => {
    const onTap = vi.fn()
    render(<FarmGrid state={at(9)} onTap={onTap} />)
    fireEvent.click(document.querySelectorAll('.cell')[7]!)
    expect(onTap).toHaveBeenCalledExactlyOnceWith(7)
  })

  it('the old --n custom property is gone; .beds carries the stacked/paired row counts instead', () => {
    render(<FarmGrid state={at(9)} onTap={() => {}} />)
    expect(document.querySelector('[style*="--n"]')).toBeNull()
    const el = document.querySelector<HTMLElement>('.beds')!
    expect(el.style.getPropertyValue('--rows-stacked')).toBe('4') // 2 beds stacked → 4 tile rows
    expect(el.style.getPropertyValue('--rows-paired')).toBe('2') // 2 beds paired → 1 bed row
  })
})

describe('batch 36.2: the 🌳 fruit tree in the beds', () => {
  const orchard = (run: Partial<GameState['run']> = {}): GameState => {
    const s = at(12)
    return { ...s, run: { ...s.run, listing: { district: 'orchardValley', soil: null }, licenses: ['potato', 'lemon'], cash: 5000, ...run } }
  }
  const act = () => {}

  it('an Orchard run with no tree: the bed socket sheet shows "🌳 Fruit tree" with the lemon button and its lines', () => {
    render(<FarmGrid state={orchard()} onTap={() => {}} act={act} />)
    fireEvent.click(screen.getByRole('button', { name: 'Bed 2 tree socket' }))
    expect(screen.getByRole('heading', { name: '🌳 Fruit tree' })).toBeTruthy()
    const lemon = screen.getByRole('button', { name: /🍋 Lemon · 💰900/ }) as HTMLButtonElement
    expect(lemon.disabled).toBe(false)
    expect(screen.getByText('Fruits every 13 min, no water, never rots')).toBeTruthy()
    expect(screen.getByText('Permanent for this farm — cannot be moved')).toBeTruthy()
  })

  it('a lemon the player cannot afford is disabled with the short reason', () => {
    render(<FarmGrid state={orchard({ cash: 10 })} onTap={() => {}} act={act} />)
    fireEvent.click(screen.getByRole('button', { name: 'Bed 1 tree socket' }))
    const lemon = screen.getByRole('button', { name: /🍋 Lemon/ }) as HTMLButtonElement
    expect(lemon.disabled).toBe(true)
    expect(lemon.textContent).toContain('Not enough cash')
  })

  it('no tree block on plain, on Iron Hills, or once a tree is planted', () => {
    for (const s of [at(12), { ...orchard(), run: { ...orchard().run, listing: { district: 'ironHills' as const, soil: null } } }, ok(plantTreeBed(orchard(), 0, 'lemon'))]) {
      render(<FarmGrid state={s} onTap={() => {}} act={act} />)
      expect(screen.queryByRole('button', { name: /tree socket/ })).toBeNull()
      expect(screen.queryByText('🌳 Fruit tree')).toBeNull()
      cleanup()
    }
  })

  it('tree tiles render 🌳 and their fruit count, no water bar; 🌳 only before the first fruit', () => {
    const planted = ok(plantTreeBed(orchard(), 1, 'lemon'))
    const s = { ...planted, run: { ...planted.run, tree: { ...planted.run.tree!, stock: [2, 0, 0, 0, 0, 3] } } }
    render(<FarmGrid state={s} onTap={() => {}} act={act} />)
    const trees = [...beds()[1].querySelectorAll<HTMLElement>('.cell')]
    expect(trees.map((c) => c.textContent)).toEqual(['🌳🍋2', '🌳', '🌳', '🌳', '🌳', '🌳🍋3'])
    expect(beds()[1].querySelectorAll('.bar')).toHaveLength(0)
    expect(beds()[0].querySelectorAll('.cell-tree')).toHaveLength(0)
  })
})
