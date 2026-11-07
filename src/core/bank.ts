import { fail, withRun, type ActionResult } from './actions'
import { FLOAT_EPSILON, loanDebtCap, loanDebtPerTick, loanPrincipal, loanStartDebt } from './balance'
import type { GameState, Loan } from './state'

// Bank actions cost no energy. Cash stays a whole number: repayments are whole amounts and the
// float debt is paid rounded up. step() grows the debt (see stepLoan in step.ts).

/** whole cash that clears the loan; the epsilon keeps float drift (36.000…01) from adding 1 */
export function debtDue(loan: Loan): number {
  return Math.ceil(loan.debt - FLOAT_EPSILON)
}

/** ticks until the debt stops growing; 0 once it is at the cap */
export function loanTicksToCap(loan: Loan): number {
  return Math.max(0, Math.ceil((loanDebtCap(loan.principal) - loan.debt) / loanDebtPerTick(loan.principal) - FLOAT_EPSILON))
}

export function takeLoan(state: GameState): ActionResult {
  const { run } = state
  if (run.loan) return fail('LOAN_ACTIVE')
  const principal = loanPrincipal(state.meta)
  return withRun(state, { cash: run.cash + principal, loan: { principal, debt: loanStartDebt(principal) } })
}

// Validates in this order: NO_LOAN, BAD_AMOUNT, NOT_ENOUGH_CASH. Pays min(amount, debtDue) and never a
// partial of that when cash is short. The loan is cleared once nothing is left.
export function repay(state: GameState, amount: number): ActionResult {
  const { run } = state
  if (!run.loan) return fail('NO_LOAN')
  if (!Number.isInteger(amount) || amount < 1) return fail('BAD_AMOUNT')
  const paid = Math.min(amount, debtDue(run.loan))
  if (run.cash < paid) return fail('NOT_ENOUGH_CASH')
  const debt = run.loan.debt - paid
  return withRun(state, { cash: run.cash - paid, loan: debt > FLOAT_EPSILON ? { ...run.loan, debt } : null })
}

export function repayAll(state: GameState): ActionResult {
  return state.run.loan ? repay(state, debtDue(state.run.loan)) : fail('NO_LOAN')
}
