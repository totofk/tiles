// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FarmGrid } from '../src/app/FarmGrid'
import { createInitialState, type GameState, type Tile } from '../src/core/state'

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
