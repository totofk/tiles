import { useState } from 'react'
import type { GameState } from '../core/state'
import { reportLines, stats, timelineLines, type StatRow } from '../core/stats'
import { SAVE_VERSION } from '../save/serialize'
import { DataModal } from './DataModal'
import { FeedbackCard } from './FeedbackCard'
import { copyText, Modal } from './Modal'
import { RoadmapList } from './Roadmap'
import type { PanelProps } from './panelTabs'

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

/** the 📊 Stats action row: every entry opens the same shared modal primitive (batch 23) */
const STATS_ACTIONS = [
  { id: 'data', label: '💾 Data' },
  { id: 'roadmap', label: '🗺 Roadmap' },
  { id: 'feedback', label: '💬 Feedback' },
] as const
type StatsActionId = (typeof STATS_ACTIONS)[number]['id']

/** the 📊 Stats tab (batch 23): the stats, timeline, then the three modal buttons — 💾 Data carries export/import
 * and the Danger zone with Reset; the inline Save card, feedback card and Reset button are gone from the layout */
export function StatsTab(props: PanelProps) {
  const { state, feedback, setFeedback } = props
  const [open, setOpen] = useState<StatsActionId | null>(null)
  const close = () => setOpen(null)
  return (
    <>
      <Stats state={state} />
      <Timeline state={state} />
      <nav className="stats-actions" aria-label="Tools">
        {STATS_ACTIONS.map((a) => (
          <button key={a.id} aria-expanded={open === a.id} onClick={() => setOpen(a.id)}>
            {a.label}
          </button>
        ))}
      </nav>
      {open === 'data' && (
        <Modal title="💾 Data" close={close}>
          <DataModal state={state} exportCode={props.exportCode} applyImport={props.applyImport} reset={props.reset} />
        </Modal>
      )}
      {open === 'roadmap' && (
        <Modal title="🗺 Roadmap" close={close}>
          <RoadmapList />
        </Modal>
      )}
      {open === 'feedback' && (
        <Modal title="💬 Feedback" close={close}>
          <FeedbackCard state={state} feedback={feedback} setFeedback={setFeedback} />
        </Modal>
      )}
    </>
  )
}
