// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Bank } from '../src/app/Bank'
import { Hud } from '../src/app/Hud'
import { createInitialState, type GameState, type Loan } from '../src/core/state'

afterEach(cleanup)

const noop = () => {}
const button = (name: RegExp) => screen.getByRole('button', { name }) as HTMLButtonElement

function withRun(run: Partial<GameState['run']>): GameState {
  const s = createInitialState()
  return { ...s, run: { ...s.run, ...run } }
}

const loan = (debt: number): Loan => ({ principal: 30, debt })

describe('Bank tab', () => {
  it('explains the loan in one line with numbers from balance', () => {
    render(<Bank state={createInitialState()} act={noop} />)
    expect(screen.getByText('Borrow 💰30 · repay 💰33 now, grows to at most 💰60')).toBeTruthy()
    expect(button(/Borrow 💰30/).disabled).toBe(false)
    expect(screen.queryByRole('button', { name: /Repay/ })).toBeNull()
  })

  it('shows live debt rounded up, the cap and the time until the cap', () => {
    render(<Bank state={withRun({ cash: 100, loan: loan(39.01) })} act={noop} />)
    expect(screen.getByText(/Debt 💰40 \/ 💰60 cap/)).toBeTruthy()
    expect(screen.getByText('reaches the cap in 5m 50s')).toBeTruthy() // (60 − 39.01) / 0.06 = 349.8 → 350 ticks
    expect(button(/^Repay 💰10/).disabled).toBe(false)
    expect(button(/Repay all 💰40/).disabled).toBe(false)
    expect(screen.queryByRole('button', { name: /Borrow/ })).toBeNull()
  })

  it('says when the debt is at the cap', () => {
    render(<Bank state={withRun({ cash: 100, loan: loan(60) })} act={noop} />)
    expect(screen.getByText('at the cap, no longer growing')).toBeTruthy()
  })

  it('disables the repay buttons with a reason when cash is short', () => {
    render(<Bank state={withRun({ cash: 5, loan: loan(33) })} act={noop} />)
    for (const b of [button(/^Repay 💰10/), button(/Repay all 💰33/)]) {
      expect(b.disabled).toBe(true)
      expect(b.textContent).toContain('Not enough cash')
    }
  })

  it('the repay step never shows more than is due', () => {
    render(<Bank state={withRun({ cash: 100, loan: loan(4.2) })} act={noop} />)
    expect(button(/^Repay 💰5/).disabled).toBe(false)
  })
})

describe('HUD debt badge', () => {
  it('is shown only while a loan is active, rounded up', () => {
    render(<Hud state={createInitialState()} />)
    expect(screen.queryByTitle('Bank debt')).toBeNull()
    cleanup()
    render(<Hud state={withRun({ loan: loan(41.3) })} />)
    expect(screen.getByTitle('Bank debt').textContent).toBe('🏦 −💰42')
  })
})
