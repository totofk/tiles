// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Bank, BankTab, Deeds } from '../src/app/Bank'
import { EMPTY_FEEDBACK } from '../src/app/feedback'
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

describe('prestige group in the Bank tab (batch 21)', () => {
  const panel = (state: GameState) => (
    <BankTab
      state={state}
      act={noop}
      cropId="radish"
      onSelectCrop={noop}
      farmTab={false}
      ui={{ view: 'farm', tab: 'farm', collapsed: false, seen: { shop: [], upgrades: [] }, priceShown: {} }}
      reset={noop}
      sell={noop}
      feedback={EMPTY_FEEDBACK}
      setFeedback={noop}
      exportCode={() => null}
      importCode={() => ({ ok: false, error: 'BAD_SAVE' })}
    />
  )

  it('deed meter: ⌊√(lifetime cash ÷ 10 000)⌋ deeds, a meter only', () => {
    render(<Deeds state={withRun({ lifetime: { ...createInitialState().run.lifetime, cashEarned: 1_040_000 } })} />)
    expect(screen.getByText('Lifetime cash 💰1,040,000 → 10 deeds when "Sell the farm" opens')).toBeTruthy()
  })

  it('pre-gate: the loan, the meter and a locked teaser row naming what is missing', () => {
    render(panel(createInitialState()))
    expect(screen.getByText('Borrow 💰30 · repay 💰33 now, grows to at most 💰60')).toBeTruthy()
    expect(screen.getByText(/→ 0 deeds when "Sell the farm" opens/)).toBeTruthy()
    expect(button(/🔒 Sell the farm/).textContent).toBe('🔒 Sell the farmneeds planter certificate + harvester certificate + 1 sprinkler + 8 more deeds')
    expect(button(/🔒 Sell the farm/).disabled).toBe(true)
    expect(screen.queryByRole('heading', { name: '🏆 Legacy' })).toBeNull()
  })

  it('the teaser shrinks as gates close; the sale card shows once the gate is open', () => {
    const atGate = withRun({
      lifetime: { ...createInitialState().run.lifetime, cashEarned: 640_000 },
      workers: { ...createInitialState().run.workers, certificates: ['plant', 'harvest'] },
      workshop: { built: true, hoppers: [5], valve: false },
    })
    // 8 deeds on the meter, every job covered: the gate is open
    render(panel(atGate))
    expect(screen.getByRole('heading', { name: '🏆 Sell the farm' })).toBeTruthy()
    expect(screen.getByText('Sell now: +8 deeds (💰8 + 0 from ⭐)')).toBeTruthy()
    expect(screen.queryByText(/needs /)).toBeNull()
  })

  it('the 🏆 Legacy shop shows once a farm has been sold', () => {
    const s = createInitialState()
    const sold = { ...s, meta: { ...s.meta, prestigeCount: 1, deeds: 9 } }
    render(panel(sold))
    expect(screen.getByRole('heading', { name: '🏆 Legacy' })).toBeTruthy()
    expect(screen.getByText(/9 deeds to spend — 1 farm sold/)).toBeTruthy()
  })
})
