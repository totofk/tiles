import { useState } from 'react'
import type { GameState } from '../core/state'
import { reportLines, stats, timelineLines, type StatRow } from '../core/stats'
import { SAVE_VERSION } from '../save/serialize'
import { DangerZone } from './DangerZone'
import { FeedbackCard } from './FeedbackCard'
import type { PanelProps } from './panelTabs'
import { SaveTransfer, copyText } from './SaveTransfer'

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

/** the milestone timeline and "Copy report" (core `reportLines`, never the save) */
export function Timeline({ state }: { state: GameState }) {
  const [copied, setCopied] = useState<boolean | null>(null)
  const lines = timelineLines(state.run)
  const copy = async () => {
    const header = [`Build: ${__BUILD__}`, `Save: v${SAVE_VERSION}`]
    setCopied(await copyText(reportLines(state, header).join('\n')))
  }
  return (
    <section className="shop">
      <h2>Timeline</h2>
      {lines.length ? (
        <ol className="timeline">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
      ) : (
        <p className="timeline-empty">No milestones yet — your first harvest starts the list.</p>
      )}
      <button className="report" onClick={copy}>
        Copy report
      </button>
      {copied === true && <p role="status">Report copied — paste it in 💬 Feedback or a message</p>}
      {copied === false && <p role="alert">Could not copy — this browser blocks the clipboard</p>}
    </section>
  )
}

/** the 📊 Stats tab (batch 21: the prestige group moved to 🏦 Bank): the stats, timeline, 💬 Feedback, Save
 * export/import, then the Danger zone with Reset */
export function StatsTab({ state, feedback, setFeedback, reset, exportCode, importCode }: PanelProps) {
  return (
    <>
      <Stats state={state} />
      <Timeline state={state} />
      <FeedbackCard state={state} feedback={feedback} setFeedback={setFeedback} />
      <SaveTransfer exportCode={exportCode} importCode={importCode} />
      <DangerZone reset={reset} />
    </>
  )
}
