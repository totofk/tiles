// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Fields } from '../src/app/Fields'
import { createInitialState, createMachines, type GameState } from '../src/core/state'

afterEach(cleanup)

/** a fields-unlocked run (batch 27: the card is a summary line + Open Estate; the rows moved to the 🚜 Estate stop) */
function unlocked(run: Partial<GameState['run']> = {}): GameState {
  const s = createInitialState()
  return {
    ...s,
    run: {
      ...s.run,
      fields: {
        ...s.run.fields,
        unlocked: true,
        list: [{ pivot: true, crop: 'radish', pinned: false, plots: [{ crop: 'radish', readyTick: 0 }, ...Array.from({ length: 4 }, () => ({ crop: null, readyTick: 0 }))] }],
        machines: createMachines(),
      },
      ...run,
    },
  }
}

describe('the 🚜 Fields summary card (batch 27, task 143e)', () => {
  it('renders nothing before the Tractor', () => {
    const { container } = render(<Fields state={createInitialState()} onOpen={() => {}} />)
    expect(container.querySelector('.fields-summary')).toBeNull()
  })

  it('one line — plots, ready — and an Open Estate button that calls onOpen', () => {
    let opened = 0
    const state = unlocked()
    render(<Fields state={state} onOpen={() => { opened++ }} />)
    expect(screen.getByText('🚜 Fields · 5 plots · 🌾 1 ready')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Open Estate' }))
    expect(opened).toBe(1)
  })
})
