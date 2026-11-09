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

/** the 🗺 Roadmap modal body: one line per parked idea, plus the order and the not-promises label */
export function RoadmapList() {
  return (
    <section className="shop roadmap">
      <p className="roadmap-label">{PARKED_LABEL}</p>
      <ul className="roadmap-list">
        {PARKED_IDEAS.map((idea) => (
          <li key={idea.n}>
            {idea.icon} <strong>{idea.name}</strong> — {idea.line}
          </li>
        ))}
      </ul>
      <p className="roadmap-order">{PARKED_ORDER}</p>
    </section>
  )
}
