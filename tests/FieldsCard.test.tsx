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

  it('one line — plots, ready, pressure — and an Open Estate button that calls onOpen', () => {
    let opened = 0
    const state = unlocked()
    render(<Fields state={state} onOpen={() => { opened++ }} />)
    // an empty tank cannot pay the pivot's 5 plots: ×1
    expect(screen.getByText('🚜 Fields · 5 plots · 🌾 1 ready · ⛽ ×1')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Open Estate' }))
    expect(opened).toBe(1)
  })

  it('batch 28.2: one plot reads "1 plot"', () => {
    const s = unlocked()
    const list = s.run.fields.list.map((f, i) => (i === 0 ? { ...f, plots: f.plots.slice(0, 1) } : f))
    render(<Fields state={{ ...s, run: { ...s.run, fields: { ...s.run.fields, list } } }} onOpen={() => {}} />)
    expect(screen.getByText(/^🚜 Fields · 1 plot · /)).toBeTruthy()
  })

  it('a tank that pays the burn shows ⛽ ×2', () => {
    const s = unlocked()
    render(<Fields state={{ ...s, run: { ...s.run, fields: { ...s.run.fields, tank: 5 } } }} onOpen={() => {}} />)
    expect(screen.getByText('🚜 Fields · 5 plots · 🌾 1 ready · ⛽ ×2')).toBeTruthy()
  })
})
