import type { GameState } from '../core/state'
import { stats, type StatRow } from '../core/stats'
import { DangerZone } from './DangerZone'
import { ironHidden } from './devFlags'
import { FeedbackCard } from './FeedbackCard'
import type { PanelProps } from './panelTabs'

/** iron rows that are still zero while iron is gated off (devFlags) */
const IRON_ROW = /\biron\b|by workers.*mine|mines by workers/i

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
  const hide = ironHidden(state.run.vein.level)
  const shown = (rows: StatRow[]) => (hide ? rows.filter((r) => !(IRON_ROW.test(r.label) && r.value === '0')) : rows)
  return (
    <section className="shop">
      <h2>Lifetime</h2>
      <Rows rows={shown(totals)} />
      <h2>Now</h2>
      <Rows rows={shown(multipliers)} />
    </section>
  )
}

/** the 📊 Stats tab: the stats, 💬 Feedback, then the Danger zone with Reset */
export function StatsTab({ state, feedback, setFeedback, reset }: PanelProps) {
  return (
    <>
      <Stats state={state} />
      <FeedbackCard state={state} feedback={feedback} setFeedback={setFeedback} />
      <DangerZone reset={reset} />
    </>
  )
}
