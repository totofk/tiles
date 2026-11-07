import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react'
import type { ActionError } from '../core/actions'
import { toolNMax } from '../core/balance'
import type { CropId } from '../core/data/crops'
import { TOOL_JOBS, type ToolJob } from '../core/data/tools'
import type { GameState } from '../core/state'
import { pressTool, setToolN, toolCount, type ToolPress } from '../core/tools'
import { ERROR_TEXT, type Act } from './useGame'

/** touch hold that opens the tiles-per-press popover instead of pressing */
const LONG_PRESS_MS = 450

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

/** the shared − / count / + popover of a level-2 tool; closes on a pointer-down outside it or Esc */
function StepPopover({ state, act, job, onClose }: { state: GameState; act: Act; job: ToolJob; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const outside = (e: PointerEvent) => ref.current?.contains(e.target as Node) || onClose()
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', esc)
    }
  }, [onClose])
  const n = toolCount(state.run, job)
  return (
    <div ref={ref} className="tool-pop" role="dialog" aria-label={`${VERB[job].now} tiles per press`}>
      <button aria-label={`${VERB[job].now} fewer tiles`} disabled={n <= 1} onClick={() => act((s) => setToolN(s, job, n - 1))}>
        −
      </button>
      <output>{n}</output>
      <button
        aria-label={`${VERB[job].now} more tiles`}
        disabled={n >= toolNMax(state.run.tiles.length)}
        onClick={() => act((s) => setToolN(s, job, n + 1))}
      >
        +
      </button>
    </div>
  )
}

/** one press button per owned tool beside the farm; a level-2 button's ⋯ / right-click / long-press sets n */
export function Tools({ state, act, cropId }: { state: GameState; act: Act; cropId: CropId }) {
  const { run } = state
  const [openJob, setOpenJob] = useState<ToolJob | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  // set when a long-press opened the popover, so the click that ends the touch does not also press
  const held = useRef(false)
  const close = useCallback(() => setOpenJob(null), [])
  useEffect(() => () => clearTimeout(timer.current), [])
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
  const cancelHold = () => clearTimeout(timer.current)

  return (
    <div className="tools">
      {owned.map((job) => {
        const level = run.tools[job]
        const label = `${VERB[job].now} ${level === 1 ? 1 : level === 2 ? toolCount(run, job) : 'all'}`
        if (level !== 2)
          return (
            <button key={job} onClick={() => press(job)}>
              {label}
            </button>
          )
        const onClick = (e: MouseEvent) => {
          if (held.current) held.current = false
          else if ((e.target as Element).closest('.tool-more')) setOpenJob(job)
          else press(job)
        }
        return (
          <button
            key={job}
            aria-haspopup="dialog"
            aria-expanded={openJob === job}
            onClick={onClick}
            onContextMenu={(e) => {
              e.preventDefault()
              setOpenJob(job)
            }}
            onTouchStart={() => {
              held.current = false
              cancelHold()
              timer.current = setTimeout(() => {
                held.current = true
                setOpenJob(job)
              }, LONG_PRESS_MS)
            }}
            onTouchEnd={cancelHold}
            onTouchMove={cancelHold}
            onTouchCancel={cancelHold}
          >
            {label}
            <span className="tool-more" aria-hidden="true">
              ⋯
            </span>
          </button>
        )
      })}
      {openJob && run.tools[openJob] === 2 && <StepPopover state={state} act={act} job={openJob} onClose={close} />}
    </div>
  )
}
