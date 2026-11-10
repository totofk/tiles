import { useState } from 'react'
import { CHANGELOG } from './changelog'

// 🗺 Roadmap: the parked ideas from docs/IDEAS.md (2026-11-09), one line each. Plain data, not JSX per item —
// IDEAS.md stays the source; this list is the player-facing distillation. "Parked — not promises".
export type ParkedIdea = { n: number; icon: string; name: string; line: string }

export const PARKED_LABEL = 'Parked — not promises'
export const PARKED_ORDER =
  'Suggested order: Save-attach first, then Foraging + Crafting & buildings (the base), Artisan, Livestock, Fishing — Marketplace last.'

export const PARKED_IDEAS: ParkedIdea[] = [
  { n: 1, icon: '📎', name: 'Save-attach', line: 'Attach a save to a feedback report, so a reported bug loads and reproduces directly' },
  { n: 2, icon: '🌿', name: 'Foraging', line: 'Workers dig for seeds, chop wood and gather wild items for crafting' },
  { n: 3, icon: '🧱', name: 'Crafting & buildings', line: 'Turn mined and dug materials into buildings and extra storage' },
  { n: 4, icon: '🍯', name: 'Artisan processing', line: 'Process crops into higher-value goods (jam, wine) in craft buildings' },
  { n: 5, icon: '🛒', name: 'Marketplace sink', line: 'Buy resources with cash, priced so it can never skip an upgrade tier' },
  { n: 6, icon: '🐄', name: 'Livestock', line: 'Raise animals for products to sell or process (milk → cheese)' },
  { n: 7, icon: '🎣', name: 'Fishing', line: 'Catch fish to sell, brew into buffs, or collect for permanent bonuses' },
]

type RoadmapTab = 'planned' | 'changelog'

/** the 🗺 Roadmap modal body: two tabs — Planned (parked ideas) and Changelog (one line per shipped batch).
 * The tab choice is local state, not persisted: the modal opens on Planned every time. */
export function RoadmapList() {
  const [tab, setTab] = useState<RoadmapTab>('planned')
  return (
    <section className="shop roadmap">
      <div className="roadmap-tabs" role="tablist" aria-label="Roadmap">
        <button
          role="tab"
          id="roadmap-tab-planned"
          aria-selected={tab === 'planned'}
          aria-controls="roadmap-panel"
          onClick={() => setTab('planned')}
        >
          Planned
        </button>
        <button
          role="tab"
          id="roadmap-tab-changelog"
          aria-selected={tab === 'changelog'}
          aria-controls="roadmap-panel"
          onClick={() => setTab('changelog')}
        >
          Changelog
        </button>
      </div>
      {tab === 'planned' ? (
        <div role="tabpanel" id="roadmap-panel" aria-labelledby="roadmap-tab-planned">
          <p className="roadmap-label">{PARKED_LABEL}</p>
          <ul className="roadmap-list">
            {PARKED_IDEAS.map((idea) => (
              <li key={idea.n}>
                {idea.icon} <strong>{idea.name}</strong> — {idea.line}
              </li>
            ))}
          </ul>
          <p className="roadmap-order">{PARKED_ORDER}</p>
        </div>
      ) : (
        <div role="tabpanel" id="roadmap-panel" aria-labelledby="roadmap-tab-changelog">
          <p className="roadmap-label">Every update so far, newest first.</p>
          <ol className="changelog-list">
            {CHANGELOG.map((e) => (
              <li key={e.batch}>
                <span className="changelog-batch">Batch {e.batch}</span> <time dateTime={e.date}>{e.date}</time> — {e.line}
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  )
}
