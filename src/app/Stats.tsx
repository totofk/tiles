import { useState } from 'react'
import { deedsFor } from '../core/balance'
import type { GameState } from '../core/state'
import { reportLines, stats, timelineLines, type StatRow } from '../core/stats'
import { SAVE_VERSION } from '../save/serialize'
import { DangerZone } from './DangerZone'
import { ironHidden } from './devFlags'
import { FeedbackCard } from './FeedbackCard'
import type { PanelProps } from './panelTabs'
import { SaveTransfer, copyText } from './SaveTransfer'

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

/** the milestone timeline and "Copy report" (core `reportLines`, never the save) */
export function Timeline({ state }: { state: GameState }) {
  const [copied, setCopied] = useState<boolean | null>(null)
  const lines = timelineLines(state.run)
  const copy = async () => {
    const header = [`Build: ${__BUILD__}`, `Save: v${SAVE_VERSION}`]
    setCopied(await copyText(reportLines(state, header, ironHidden(state.run.vein.level)).join('\n')))
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

/** the 📊 Stats tab: the stats, deeds, timeline, 💬 Feedback, Save export/import, then the Danger zone with Reset */
export function StatsTab({ state, feedback, setFeedback, reset, exportCode, importCode }: PanelProps) {
  return (
    <>
      <Stats state={state} />
      <Deeds state={state} />
      <Timeline state={state} />
      <FeedbackCard state={state} feedback={feedback} setFeedback={setFeedback} />
      <SaveTransfer exportCode={exportCode} importCode={importCode} />
      <DangerZone reset={reset} />
    </>
  )
}
