import { describe, expect, it } from 'vitest'
import type { ActionResult } from '../src/core/actions'
import { loanDebtCap, loanDebtPerTick, loanPrincipal, loanRepayStep, loanStartDebt } from '../src/core/balance'
import { debtDue, loanTicksToCap, repay, repayAll, takeLoan } from '../src/core/bank'
import { createInitialState, type GameState } from '../src/core/state'
import { step } from '../src/core/step'
import { catchUp } from '../src/save/serialize'

function withRun(run: Partial<GameState['run']>): GameState {
  const s = createInitialState()
  return { ...s, run: { ...s.run, ...run } }
}

function okState(r: ActionResult): GameState {
  if (!r.ok) throw new Error(`expected ok, got ${r.error}`)
  return r.state
}

const meta = createInitialState().meta
/** the pre-v12 multiplier table every value of legacyMultipliers replaces */
const allOne = { growTime: 1, sellPrice: 1, cost: 1, energy: 1, moistureDrain: 1 }

describe('placeholder numbers (PLAN.md batch 4.5)', () => {
  it('borrow 30, owe 33, grows 0.06 per tick to at most 60', () => {
    expect(loanPrincipal(meta)).toBe(30)
    expect(loanStartDebt(30)).toBeCloseTo(33)
    expect(loanDebtPerTick(30)).toBeCloseTo(0.06)
    expect(loanDebtCap(30)).toBe(60)
    expect(loanRepayStep(meta)).toBe(10)
  })

  it('principal and repay step follow the cost multiplier', () => {
    const cheap = { ...meta, legacyMultipliers: { ...allOne, cost: 0.5 } }
    expect(loanPrincipal(cheap)).toBe(15)
    expect(loanRepayStep(cheap)).toBe(5)
  })
})

describe('takeLoan', () => {
  it('adds the principal to cash and starts the debt at principal × (1 + fee)', () => {
    const s = okState(takeLoan(withRun({ cash: 1 })))
    expect(s.run.cash).toBe(31)
    expect(s.run.loan).toEqual({ principal: 30, debt: loanStartDebt(30) })
    expect(debtDue(s.run.loan!)).toBe(33)
  })

  it('costs no energy and refuses a second loan', () => {
    const s = okState(takeLoan(withRun({ energy: 0 })))
    expect(s.run.energy).toBe(0)
    expect(takeLoan(s)).toEqual({ ok: false, error: 'LOAN_ACTIVE' })
  })
})

describe('debt growth in step', () => {
  const borrowed = okState(takeLoan(createInitialState()))

  it('grows by principal × rate per tick', () => {
    expect(step(borrowed, 1).run.loan!.debt).toBeCloseTo(33.06)
    expect(step(borrowed, 100).run.loan!.debt).toBeCloseTo(39)
  })

  it('reaches the 200 % cap after ~450 ticks and never goes above it', () => {
    expect(loanTicksToCap(borrowed.run.loan!)).toBe(450)
    expect(step(borrowed, 449).run.loan!.debt).toBeLessThan(60)
    expect(step(borrowed, 451).run.loan!.debt).toBe(60)
    expect(step(borrowed, 2000).run.loan!.debt).toBe(60)
    expect(loanTicksToCap(step(borrowed, 2000).run.loan!)).toBe(0)
  })

  it('offline catch-up does not grow it (live ticks only)', () => {
    expect(catchUp(borrowed, 100_000).run.loan).toEqual(borrowed.run.loan)
    expect(catchUp(borrowed, 8 * 3600 * 1000).run.loan).toEqual(borrowed.run.loan)
    expect(catchUp(borrowed, 100_000).run.tick).toBe(100)
  })

  it('no loan stays no loan', () => {
    expect(step(createInitialState(), 10).run.loan).toBeNull()
  })

  it('float drift never rounds the due amount up by an extra 1', () => {
    for (let t = 0; t <= 450; t += 50) {
      expect(debtDue(step(borrowed, t).run.loan!)).toBe(Math.ceil(33 + 0.06 * t - 1e-6))
    }
  })
})

describe('exploit check: borrow → repay always loses cash', () => {
  it.each([0.5, 1, 2])('cost multiplier %s: the fee makes repaying at any tick cost more than was borrowed', (cost) => {
    const start = withRun({ cash: 100 })
    const s0 = { ...start, meta: { ...start.meta, legacyMultipliers: { ...allOne, cost } } }
    const principal = loanPrincipal(s0.meta)
    expect(loanStartDebt(principal)).toBeGreaterThan(principal)
    let s = okState(takeLoan(s0))
    for (let t = 0; t <= 600; t++) {
      expect(okState(repayAll(s)).run.cash).toBeLessThan(100)
      s = step(s, 1)
    }
  })

  it('repaying immediately loses exactly the fee', () => {
    const s = okState(repayAll(okState(takeLoan(withRun({ cash: 100 })))))
    expect(s.run.cash).toBe(97)
  })
})

describe('repay', () => {
  const borrowed = okState(takeLoan(withRun({ cash: 50 })))

  it('partial repay lowers the debt and keeps whole cash', () => {
    const s = okState(repay(borrowed, 10))
    expect(s.run.cash).toBe(70)
    expect(s.run.loan!.debt).toBeCloseTo(23)
  })

  it('caps the payment at the amount due and clears the loan', () => {
    const s = okState(repay(borrowed, 1000))
    expect(s.run.cash).toBe(80 - 33)
    expect(s.run.loan).toBeNull()
  })

  it('repayAll pays Math.ceil(debt) and clears the loan', () => {
    const later = step(borrowed, 7) // debt 33.42
    const s = okState(repayAll(later))
    expect(s.run.cash).toBe(80 - 34)
    expect(s.run.loan).toBeNull()
  })

  it('errors: NO_LOAN, BAD_AMOUNT, NOT_ENOUGH_CASH', () => {
    expect(repay(createInitialState(), 5)).toEqual({ ok: false, error: 'NO_LOAN' })
    expect(repayAll(createInitialState())).toEqual({ ok: false, error: 'NO_LOAN' })
    expect(repay(borrowed, 0)).toEqual({ ok: false, error: 'BAD_AMOUNT' })
    expect(repay(borrowed, 2.5)).toEqual({ ok: false, error: 'BAD_AMOUNT' })
    const short = withRun({ cash: 5, loan: { principal: 30, debt: 33 } })
    expect(repay(short, 10)).toEqual({ ok: false, error: 'NOT_ENOUGH_CASH' })
    expect(repayAll(short)).toEqual({ ok: false, error: 'NOT_ENOUGH_CASH' })
    expect(okState(repay(short, 5)).run.cash).toBe(0)
  })
})
