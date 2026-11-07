import type { GameState } from '../core/state'
import { stats, type StatRow } from '../core/stats'

function Rows({ rows }: { rows: StatRow[] }) {
  return (
    <dl className="stats">
      {rows.map((r) => (
        <div key={r.label}>
          <dt>{r.label}</dt>
          <dd>
            {r.value}
            {r.source && <small> ({r.source})</small>}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/** renders the core `stats()` selector; computes nothing itself */
export function Stats({ state }: { state: GameState }) {
  const { totals, multipliers } = stats(state)
  return (
    <section className="shop">
      <h2>Lifetime</h2>
      <Rows rows={totals} />
      <h2>Now</h2>
      <Rows rows={multipliers} />
    </section>
  )
}
