import { useEffect, useLayoutEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import type { GameState } from '../core/state'
import { Estate, EstateBar } from './Estate'
import { MiniLot } from './MiniLot'
import type { Act } from './useGame'
import type { Stop, UiState } from './uiState'

const ESTATE_EMOJI = '🚜' // Unicode 6
/** the pull-back's one-time caption (L2: the Tractor is a paradigm shift of the MAIN view, not a tab) */
const PULLBACK_CAPTION = `${ESTATE_EMOJI} Your farm got bigger`

/**
 * The one farm surface after the Tractor (batch 27): two stops — 🚜 Estate (the fields at a glance) and 🏡 Home
 * (today's lot) — on one surface. Batch 38: the stops are the 🚜 Estate / 🌱 Farm main views (`stop` comes from
 * the main tab, `setStop` switches it; the internal switch and the wide `both` mode are gone). The home lot
 * still shrinks into the Estate: the `.home-block` wrapper FLIP-animates between the full grid and the MiniLot.
 */
export function Surface({ state, act, ui, setUi, stop, setStop, phone, planting, tools, grid }: {
  state: GameState
  act: Act
  ui: UiState
  setUi: Dispatch<SetStateAction<UiState>>
  /** the current stop, derived from the main view: 🚜 Estate → 'estate', 🌱 Farm → 'home' */
  stop: Stop
  /** switches the stop — App maps it onto the main view (farm / estate) */
  setStop: (s: Stop) => void
  /** phones (< 768 px): the Estate stop swaps the 🧰 Tools bar for the Sow / Reap / ＋10 tiles bar (task 144) */
  phone: boolean
  /** the Home stop's header line (the Planting paragraph) */
  planting: ReactNode
  /** the Home stop's tool bar / stacked rows, placed beside the grid at ≥ 768 px as today */
  tools: ReactNode
  /** today's FarmGrid, exactly as it renders before the Tractor */
  grid: ReactNode
}) {
  // the pull-back, once per browser (a reload mid-animation does not replay); it switches the main view to
  // the Estate, which is where the caption shows
  const [caption, setCaption] = useState(false)
  useEffect(() => {
    if (ui.pulledBack) return
    setUi((u) => ({ ...u, pulledBack: true }))
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    if (reduced) {
      // switch at once (a timer tick, so no state is set synchronously inside the effect), caption 2 s
      const now = window.setTimeout(() => {
        setCaption(true)
        setStop('estate')
      }, 0)
      const hide = window.setTimeout(() => setCaption(false), 2000)
      return () => {
        window.clearTimeout(now)
        window.clearTimeout(hide)
      }
    }
    const pull = window.setTimeout(() => {
      setCaption(true)
      setStop('estate')
    }, 700)
    const hide = window.setTimeout(() => setCaption(false), 2600)
    return () => {
      window.clearTimeout(pull)
      window.clearTimeout(hide)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // keys: 1 = Home, 2 = Estate; never while typing or while any dialog (the Modal, the field sheet) is open,
  // so those keys keep working. Escape belongs to the menu drawer (batch 38).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t?.closest?.('input, textarea, select')) return
      if (document.querySelector('[role="dialog"]')) return
      if (e.key === '1') setStop('home')
      else if (e.key === '2') setStop('estate')
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // FLIP: the home-lot block animates from its rect on the last layout to its new one on every stop change.
  // The pull-back's Home → Estate move (the only switch that happens while the caption shows) is slower at 700 ms.
  const homeRef = useRef<HTMLDivElement | null>(null)
  const lastRect = useRef<{ left: number; top: number; width: number; height: number } | null>(null)
  useLayoutEffect(() => {
    const el = homeRef.current
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    const last = el?.getBoundingClientRect()
    const first = lastRect.current
    if (el && last && !reduced && first && first.width > 0 && last.width > 0) {
      const { style } = el
      style.transition = 'none'
      style.transform = `translate(${first.left - last.left}px, ${first.top - last.top}px) scale(${first.width / last.width}, ${first.height / last.height})`
      void el.offsetWidth // force a reflow so the invert transform is painted before the transition starts
      style.transition = `transform ${caption ? 700 : 250}ms cubic-bezier(.2,.7,.2,1)`
      style.transform = ''
    }
    lastRect.current = last && last.width > 0 ? { left: last.left, top: last.top, width: last.width, height: last.height } : null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stop])

  const lot = (
    <div className="home-block" ref={homeRef}>
      <MiniLot state={state} onOpen={() => setStop('home')} />
    </div>
  )

  return (
    <div className="surface">
      {stop === 'home' && <div className="surface-head">{planting}</div>}
      {stop === 'home' && tools}
      {phone && stop === 'estate' && <EstateBar state={state} act={act} />}
      <div className="surface-main">
        {stop === 'estate' ? (
          <Estate state={state} act={act} ui={ui} lot={lot} />
        ) : (
          <div className="home-block" ref={homeRef}>
            {grid}
          </div>
        )}
      </div>
      {caption && (
        <div className="pullcap" role="status">
          {PULLBACK_CAPTION}
        </div>
      )}
    </div>
  )
}
