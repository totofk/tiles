import { energyMax } from '../core/balance'
import { debtDue } from '../core/bank'
import { STAR_EMOJI } from '../core/data/orders'
import type { GameState } from '../core/state'
import { Bar } from './Bar'
import { approx, count, duration, held, price } from './fmt'
import type { Rates } from './useGame'

const INCOME_TITLE = 'Harvest and sale income, last 10 game-minutes'
const WAGES_TITLE = 'Wages paid, last 10 game-minutes'

/** `rates`: the trailing 10-game-minute window (null until it spans a minute); shown only while workers are hired */
export function Hud({ state, rates = null }: { state: GameState; rates?: Rates | null }) {
  const { run, meta } = state
  const max = energyMax(run.upgrades.energyMax, meta)
  const shown = run.workers.pool > 0 ? rates : null
  const income = shown && `+≈💰${approx(shown.income)}/h`
  const wages = shown && `−≈💰${approx(shown.wages)}/h`
  return (
    <header className="hud">
      <span>💰 {held(run.cash)}</span>
      {income && (
        <span className="hud-rate" title={INCOME_TITLE}>
          {income}
        </span>
      )}
      {run.orders.unlocked && (
        <span title="Stars, from orders">
          {STAR_EMOJI} {count(run.stars)}
        </span>
      )}
      <span className="hud-energy">
        ⚡ {Math.floor(run.energy)} / {max}
        <Bar value={run.energy / max} kind="energy" />
      </span>
      {run.loan && (
        <span className="hud-debt" title="Bank debt">
          🏦 −💰{price(debtDue(run.loan))}
        </span>
      )}
      {run.workers.pool > 0 && (
        // the phone hides the rate spans (they do not fit 375 px on one line); this title carries them there
        <span title={shown ? `Workers hired\n${INCOME_TITLE}: ${income}\n${WAGES_TITLE}: ${wages}` : 'Workers hired'}>
          👷 {run.workers.pool}
        </span>
      )}
      {wages && (
        <span className="hud-rate" title={WAGES_TITLE}>
          {wages}
        </span>
      )}
      <span>⏱ {duration(run.tick)}</span>
    </header>
  )
}
