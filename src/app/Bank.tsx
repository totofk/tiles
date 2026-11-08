import { PRESTIGE_GATE_DEEDS, deedsFor, loanDebtCap, loanPrincipal, loanRepayStep, loanStartDebt } from '../core/balance'
import { debtDue, loanTicksToCap, repay, repayAll, takeLoan } from '../core/bank'
import { sellFarmUnlocked } from '../core/prestige'
import type { GameState } from '../core/state'
import { Legacy, SellCard } from './Legacy'
import type { PanelProps } from './panelTabs'
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

/** the deed meter: what the lifetime total will be worth when prestige opens (a meter only, batch 12) */
export function Deeds({ state }: { state: GameState }) {
  const cash = Math.floor(state.run.lifetime.cashEarned)
  const deeds = deedsFor(cash)
  return (
    <p className="deeds">
      Lifetime cash 💰{cash.toLocaleString('en-US')} → {deeds} deed{deeds === 1 ? '' : 's'} when "Sell the farm" opens
    </p>
  )
}

/** what still blocks the sale gate, in the Fields-unlock "needs …" style: uncovered farm jobs, then deeds short */
function gateShort(state: GameState): string {
  const { run } = state
  const deeds = deedsFor(run.lifetime.cashEarned)
  return [
    !run.workers.certificates.includes('plant') && 'planter certificate',
    !run.workers.certificates.includes('harvest') && 'harvester certificate',
    run.workshop.hoppers.length < 1 && '1 sprinkler',
    deeds < PRESTIGE_GATE_DEEDS && `${PRESTIGE_GATE_DEEDS - deeds} more deeds`,
  ]
    .filter(Boolean)
    .join(' + ')
}

/** the 🏦 Bank tab (batch 21): the loan, then the prestige group as one block — the deed meter, the sale card (a
 * locked teaser row naming what is missing until the gate opens), and the 🏆 Legacy shop once a farm has been sold */
export function BankTab({ state, act, sell }: PanelProps) {
  const sold = state.meta.prestigeCount > 0 || state.meta.deeds > 0
  return (
    <>
      <Bank state={state} act={act} />
      <Deeds state={state} />
      {sellFarmUnlocked(state) ? (
        <SellCard state={state} sell={sell} />
      ) : (
        <section className="shop">
          <h2>🏆 Sell the farm</h2>
          <div className="shop-row one-col">
            <button className="locked" disabled>
              🔒 Sell the farm
              <small>needs {gateShort(state)}</small>
            </button>
          </div>
        </section>
      )}
      {sold && <Legacy state={state} act={act} />}
    </>
  )
}
