import { energyMax } from '../core/balance'
import { debtDue } from '../core/bank'
import { STAR_EMOJI } from '../core/data/orders'
import type { GameState } from '../core/state'
import { Bar } from './Bar'
import { count, held, price } from './fmt'

export function Hud({ state }: { state: GameState }) {
  const { run, meta } = state
  const max = energyMax(run.upgrades.energyMax, meta)
  return (
    <header className="hud">
      <span>💰 {held(run.cash)}</span>
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
      {run.workers.pool > 0 && <span title="Workers hired">👷 {run.workers.pool}</span>}
      <span>⏱ {run.tick}</span>
    </header>
  )
}
