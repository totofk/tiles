import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react'
import type { ActionError } from '../core/actions'
import { toolNMax } from '../core/balance'
import type { CropId } from '../core/data/crops'
import { TOOLS, TOOL_JOBS, type ToolJob } from '../core/data/tools'
import type { GameState } from '../core/state'
import { pressTool, setToolN, toolCount, type ToolPress } from '../core/tools'
import { HAND_PICKED } from './marketText'
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

/** copper luck in the press summary; tile taps never toast it */
const BONUS_TEXT: Partial<Record<ToolJob, (n: number) => string>> = {
  harvest: (n) => ` (+${n} bonus)`,
  plant: (n) => ` (${n} seed${n > 1 ? 's' : ''} kept)`,
}

/**
 * "Watered 5/9 — out of energy", "Harvested 6/6 (+1 bonus) +💰540 ✋ ×1.25"; no reason when every wanted tile was done.
 * earned: the cash a harvest press really received (market prices and the hand-picked bonus included), harvests only
 */
export function pressText(job: ToolJob, { done, wanted, stoppedBy, bonus }: Extract<ToolPress, { ok: true }>, earned = 0): string {
  const extra = bonus > 0 ? (BONUS_TEXT[job]?.(bonus) ?? '') : ''
  const cash = job === 'harvest' && earned > 0 ? ` +💰${earned} ${HAND_PICKED}` : ''
  const why = stoppedBy ? ` — ${STOP_TEXT[stoppedBy] ?? ERROR_TEXT[stoppedBy]}` : ''
  return `${VERB[job].past} ${done}/${wanted}${extra}${cash}${why}`
}

/** stacked rows (desktop): the farm loop order */
const STACK_ORDER: readonly ToolJob[] = ['plant', 'water', 'harvest']

/** − or + of a level-2 tool's tiles per press, within 1 … toolNMax */
function StepButton({ state, act, job, dir }: { state: GameState; act: Act; job: ToolJob; dir: -1 | 1 }) {
  const n = toolCount(state.run, job)
  const blocked = dir < 0 ? n <= 1 : n >= toolNMax(state.run.tiles.length)
  return (
    <button
      className="tool-step"
      aria-label={`${VERB[job].now} ${dir < 0 ? 'fewer' : 'more'} tiles`}
      disabled={blocked}
      onClick={() => act((s) => setToolN(s, job, n + dir))}
    >
      {dir < 0 ? '−' : '+'}
    </button>
  )
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
  return (
    <div ref={ref} className="tool-pop" role="dialog" aria-label={`${VERB[job].now} tiles per press`}>
      <StepButton state={state} act={act} job={job} dir={-1} />
      <output>{toolCount(state.run, job)}</output>
      <StepButton state={state} act={act} job={job} dir={1} />
    </div>
  )
}

/**
 * one press button per owned tool. Default (mobile bar, tablet column): a level-2 button's ⋯ / right-click /
 * long-press opens the n popover. stacked (desktop): one row per tool, Plant / Water / Harvest, with − / + beside a
 * level-2 button; level 1 / 3 keep empty slots there so every press button has the same width.
 */
export function Tools({ state, act, cropId, stacked = false }: { state: GameState; act: Act; cropId: CropId; stacked?: boolean }) {
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
      (prev, next) => (r?.ok ? pressText(job, r, next.run.cash - prev.run.cash) : null),
    )
  }
  const cancelHold = () => clearTimeout(timer.current)
  const label = (job: ToolJob) => {
    const level = run.tools[job]
    return `${VERB[job].now} ${level === 1 ? 1 : level === 2 ? toolCount(run, job) : 'all'}`
  }
  // copper tier: a copper stripe inside the frame (no width change), named in the tooltip
  const tier = (job: ToolJob) => (run.toolTier[job] > 0 ? { className: 'copper', title: TOOLS[job].copper } : {})

  if (stacked) {
    const step = (job: ToolJob, dir: -1 | 1) =>
      run.tools[job] === 2 ? <StepButton state={state} act={act} job={job} dir={dir} /> : <span className="tool-step" aria-hidden="true" />
    return (
      <div className="tools tools-stacked">
        {STACK_ORDER.filter((job) => run.tools[job] > 0).map((job) => (
          <div key={job} className="tool-row">
            {step(job, -1)}
            <button {...tier(job)} onClick={() => press(job)}>
              {label(job)}
            </button>
            {step(job, 1)}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="tools">
      {owned.map((job) => {
        if (run.tools[job] !== 2)
          return (
            <button key={job} {...tier(job)} onClick={() => press(job)}>
              {label(job)}
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
            {...tier(job)}
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
            {label(job)}
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
