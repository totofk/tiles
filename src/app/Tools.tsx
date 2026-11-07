import type { ActionError } from '../core/actions'
import { toolNMax } from '../core/balance'
import type { CropId } from '../core/data/crops'
import { TOOL_JOBS, type ToolJob } from '../core/data/tools'
import type { GameState } from '../core/state'
import { pressTool, setToolN, toolCount, type ToolPress } from '../core/tools'
import { ERROR_TEXT, type Act } from './useGame'

const VERB: Record<ToolJob, { now: string; past: string }> = {
  water: { now: 'Water', past: 'Watered' },
  harvest: { now: 'Harvest', past: 'Harvested' },
  plant: { now: 'Plant', past: 'Planted' },
}
const STOP_TEXT: Partial<Record<ActionError, string>> = {
  NO_ENERGY: 'out of energy',
  NO_CASH: 'out of cash',
  NO_SEEDS: 'out of seeds',
}

/** "Watered 5/9 — out of energy"; no reason when every wanted tile was done */
export function pressText(job: ToolJob, { done, wanted, stoppedBy }: Extract<ToolPress, { ok: true }>): string {
  const why = stoppedBy ? ` — ${STOP_TEXT[stoppedBy] ?? ERROR_TEXT[stoppedBy]}` : ''
  return `${VERB[job].past} ${done}/${wanted}${why}`
}

/** one press button per owned tool, above the farm; level 2 gets a tiles-per-press stepper */
export function Tools({ state, act, cropId }: { state: GameState; act: Act; cropId: CropId }) {
  const { run } = state
  const owned = TOOL_JOBS.filter((job) => run.tools[job] > 0)
  if (owned.length === 0) return null

  const press = (job: ToolJob) => {
    let r: ToolPress | undefined
    // act runs fn synchronously, so r holds the press result when okToast reads it
    act(
      (s) => (r = pressTool(s, job, cropId)),
      () => (r?.ok ? pressText(job, r) : null),
    )
  }

  return (
    <div className="tools">
      {owned.map((job) => {
        const level = run.tools[job]
        const n = toolCount(run, job)
        const label = `${VERB[job].now} ${level === 1 ? 1 : level === 2 ? n : 'all'}`
        if (level !== 2)
          return (
            <button key={job} onClick={() => press(job)}>
              {label}
            </button>
          )
        return (
          <span key={job} className="tool-step">
            <button aria-label={`${VERB[job].now} fewer tiles`} disabled={n <= 1} onClick={() => act((s) => setToolN(s, job, n - 1))}>
              −
            </button>
            <button onClick={() => press(job)}>{label}</button>
            <button
              aria-label={`${VERB[job].now} more tiles`}
              disabled={n >= toolNMax(run.tiles.length)}
              onClick={() => act((s) => setToolN(s, job, n + 1))}
            >
              +
            </button>
          </span>
        )
      })}
    </div>
  )
}
