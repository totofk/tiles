import { loanDebtCap, loanPrincipal, loanRepayStep, loanStartDebt } from '../core/balance'
import { debtDue, loanTicksToCap, repay, repayAll, takeLoan } from '../core/bank'
import type { GameState } from '../core/state'
import { ERROR_TEXT, type Act } from './useGame'

/** 1 tick = 1 s */
const duration = (ticks: number) => (ticks >= 60 ? `${Math.floor(ticks / 60)}m ${ticks % 60}s` : `${ticks}s`)

export function Bank({ state, act }: { state: GameState; act: Act }) {
  const { run, meta } = state
  const { loan } = run
  const principal = loan?.principal ?? loanPrincipal(meta)
  const due = (debt: number) => debtDue({ principal, debt })
  // the core actions double as "can I?" checks, so the disabled reason is the action's own error
  const borrow = takeLoan(state)
  const repayStep = loanRepayStep(meta)
  const part = repay(state, repayStep)
  const all = repayAll(state)
  const cap = due(loanDebtCap(principal))

  return (
    <section className="shop bank">
      <h2>Bank</h2>
      <p className="bank-terms">
        {`Borrow 💰${principal} · repay 💰${due(loanStartDebt(principal))} now, grows to at most 💰${cap}`}
      </p>
      {loan ? (
        <>
          <p className="bank-debt">
            Debt 💰{debtDue(loan)} / 💰{cap} cap
            <small>
              {loanTicksToCap(loan) > 0 ? `reaches the cap in ${duration(loanTicksToCap(loan))}` : 'at the cap, no longer growing'}
            </small>
          </p>
          <div className="shop-row">
            <button disabled={!part.ok} onClick={() => act((s) => repay(s, repayStep))}>
              Repay 💰{Math.min(repayStep, debtDue(loan))}
              <small>{part.ok ? 'pay part' : ERROR_TEXT[part.error]}</small>
            </button>
            <button disabled={!all.ok} onClick={() => act(repayAll)}>
              Repay all 💰{debtDue(loan)}
              <small>{all.ok ? 'clear the loan' : ERROR_TEXT[all.error]}</small>
            </button>
          </div>
        </>
      ) : (
        <div className="shop-row">
          <button disabled={!borrow.ok} onClick={() => act(takeLoan)}>
            🏦 Borrow 💰{principal}
            <small>{borrow.ok ? `+💰${principal} cash now` : ERROR_TEXT[borrow.error]}</small>
          </button>
        </div>
      )}
    </section>
  )
}
