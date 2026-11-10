// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MiniLot } from '../src/app/MiniLot'
import { createInitialState, type GameState, type Tile } from '../src/core/state'

afterEach(cleanup)

const untilled: Tile = { status: 'untilled', growth: 0, moisture: 0, ticksSinceMature: 0 }
const mature: Tile = { status: 'planted', cropId: 'radish', growth: 1e9, moisture: 1, ticksSinceMature: 0 }
const state = (tiles: Tile[]): GameState => {
  const s = createInitialState()
  return { ...s, run: { ...s.run, tiles } }
}

describe('MiniLot (batch 25, task 136)', () => {
  it('3 mature tiles → a 🧺 3 badge and an aria-label that says 3 ripe; 0 ripe hides the badge', () => {
    render(<MiniLot state={state([mature, mature, mature, ...Array.from({ length: 6 }, () => untilled)])} onOpen={() => {}} />)
    const lot = document.querySelector<HTMLButtonElement>('.mini-lot')!
    expect(lot.getAttribute('aria-label')).toContain('3 ripe')
    expect(lot.getAttribute('aria-label')).toContain('open')
    expect(lot.querySelector('.mini-badge')!.textContent).toBe('🧺 3')
    cleanup()
    render(<MiniLot state={state(Array.from({ length: 9 }, () => untilled))} onOpen={() => {}} />)
    expect(document.querySelector('.mini-badge')).toBeNull()
    expect(document.querySelector('.mini-lot')!.getAttribute('aria-label')).toContain('0 ripe')
  })

  it('one click calls onOpen once; the lot is the only button — no tile is its own tap target', () => {
    const onOpen = vi.fn()
    render(<MiniLot state={state(Array.from({ length: 9 }, () => untilled))} onOpen={onOpen} />)
    fireEvent.click(document.querySelector('.mini-lot')!)
    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(document.querySelector('.mini-lot')!.querySelectorAll('button')).toHaveLength(0)
  })
})
