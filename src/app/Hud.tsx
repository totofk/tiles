import { energyMax } from '../core/balance'
import { debtDue } from '../core/bank'
import type { GameState } from '../core/state'
import { Bar } from './Bar'

export function Hud({ state }: { state: GameState }) {
  const { run, meta } = state
  const max = energyMax(run.upgrades.energyMax, meta)
  return (
    <header className="hud">
      <span>💰 {run.cash}</span>
      <span className="hud-energy">
        ⚡ {Math.floor(run.energy)} / {max}
        <Bar value={run.energy / max} kind="energy" />
      </span>
      {run.loan && (
        <span className="hud-debt" title="Bank debt">
          🏦 −💰{debtDue(run.loan)}
        </span>
      )}
      {run.workers.pool > 0 && <span title="Workers hired">👷 {run.workers.pool}</span>}
      <span>⏱ {run.tick}</span>
    </header>
  )
}
