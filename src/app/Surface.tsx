import { useEffect, useLayoutEffect, useRef, useState, type Dispatch, type ReactNode, type RefObject, type SetStateAction } from 'react'
import { CROP_IDS, type CropId } from '../core/data/crops'
import { fieldsOverview, plantedTiles } from '../core/fields'
import type { GameState } from '../core/state'
import { Estate, EstateBar } from './Estate'
import { CROP_EMOJI } from './FarmGrid'
import { MiniLot } from './MiniLot'
import type { Act } from './useGame'
import type { Stop, UiState } from './uiState'

const ESTATE_EMOJI = '🚜' // Unicode 6
const HOME_EMOJI = '🏡' // Unicode 6
const READY_EMOJI = '🌾' // Unicode 6
/** the farm column this wide shows both stops at once (measured: 1440 → 669, 2560 → 1560, 3440 → both) */
const BOTH_MIN_WIDTH = 1100
/** the pull-back's one-time caption (L2: the Tractor is a paradigm shift of the MAIN view, not a tab) */
const PULLBACK_CAPTION = `${ESTATE_EMOJI} Your farm got bigger`

/**
 * The one farm surface after the Tractor (batch 27): two stops — 🚜 Estate (the fields at a glance) and 🏡 Home
 * (today's lot) — on one surface. Before the Tractor App renders the old farm column unchanged. `both` (a wide
 * farm column) shows the two side by side with no switch. The home lot shrinks into the Estate: the `.home-block`
 * wrapper FLIP-animates between the full grid and the MiniLot on every stop change.
 */
export function Surface({ state, act, ui, setUi, banner, farmRef, phone, planting, tools, grid, below }: {
  state: GameState
  act: Act
  ui: UiState
  setUi: Dispatch<SetStateAction<UiState>>
  /** the welcome-back banner at load: it forces the Estate stop whatever was saved */
  banner: string | null
  farmRef: RefObject<HTMLElement | null>
  /** phones (< 768 px): the Estate stop swaps the 🧰 Tools bar for the Sow / Reap / ＋10 tiles bar (task 144) */
  phone?: boolean
  /** the Home stop's header line (the Planting paragraph, phones and tablets) */
  planting?: ReactNode
  /** the Home stop's tool bar / stacked rows, placed beside the grid at ≥ 768 px as today */
  tools?: ReactNode
  /** today's FarmGrid, exactly as it renders before the Tractor */
  grid: ReactNode
  /** the cards below the grid (phones and tablets): DigSeeds, Orders, Workers, Workshop, Fields */
  below?: ReactNode
}) {
  // both stops at once on a wide farm column; jsdom has no ResizeObserver, so `both` stays false there
  const [both, setBoth] = useState(false)
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return
    const el = farmRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => setBoth(entries[0]!.contentRect.width >= BOTH_MIN_WIDTH))
    ro.observe(el)
    return () => ro.disconnect()
  }, [farmRef])

  // a fresh Tractor (or an existing save that already owns one) starts on Home for the pull-back; a welcome-back
  // banner forces Estate; otherwise the saved stop
  const [stop, setStop] = useState<Stop>(() => (!ui.pulledBack ? 'home' : banner !== null ? 'estate' : ui.stop))
  // a stop written from outside (the Fields card's Open Estate) is followed; Surface's own writes are the same
  // value, so the sync is a no-op for them
  const firstSync = useRef(true)
  useEffect(() => {
    if (firstSync.current) {
      firstSync.current = false
      return
    }
    setStop(ui.stop)
  }, [ui.stop])
  const go = (s: Stop) => {
    setStop(s)
    setUi((u) => ({ ...u, stop: s }))
  }

  // the pull-back, once per browser (a reload mid-animation does not replay)
  const [caption, setCaption] = useState(false)
  useEffect(() => {
    if (ui.pulledBack) return
    setUi((u) => ({ ...u, pulledBack: true }))
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    if (reduced) {
      // switch at once (a timer tick, so no state is set synchronously inside the effect), caption 2 s
      const now = window.setTimeout(() => {
        setCaption(true)
        go('estate')
      }, 0)
      const hide = window.setTimeout(() => setCaption(false), 2000)
      return () => {
        window.clearTimeout(now)
        window.clearTimeout(hide)
      }
    }
    const pull = window.setTimeout(() => {
      setCaption(true)
      go('estate')
    }, 700)
    const hide = window.setTimeout(() => setCaption(false), 2600)
    return () => {
      window.clearTimeout(pull)
      window.clearTimeout(hide)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // keys: 1 = Home, 2 / Escape = Estate; never while typing or while any dialog (the Modal, the tool popover)
  // is open, so Esc still closes those first. In `both` mode there is no stop to switch.
  useEffect(() => {
    if (both) return
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t?.closest?.('input, textarea, select')) return
      if (document.querySelector('[role="dialog"]')) return
      if (e.key === '1') go('home')
      else if (e.key === '2' || e.key === 'Escape') go('estate')
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [both])

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
  }, [stop, both])

  const planted = (c: CropId) => plantedTiles(state.run.fields, c)
  // every planted crop, licensed or not: a re-laddered save's old plots still finish (batch 35)
  const standing = CROP_IDS.filter((c) => planted(c) > 0)
  const ready = fieldsOverview(state.run).ready
  const lot = (
    <div className="home-block" ref={homeRef}>
      <MiniLot state={state} onOpen={() => go('home')} />
    </div>
  )

  if (both) {
    return (
      <div className="surface surface-both">
        <Estate state={state} act={act} ui={ui} />
        <div className="home-block" ref={homeRef}>
          {grid}
        </div>
      </div>
    )
  }
  return (
    <div className="surface">
      <div className="surface-head">
        <div className="stop-switch" role="group" aria-label="Farm view">
          <button aria-pressed={stop === 'estate'} onClick={() => go('estate')}>
            {`${ESTATE_EMOJI} Estate`}
          </button>
          <button aria-pressed={stop === 'home'} onClick={() => go('home')}>
            {`${HOME_EMOJI} Home`}
          </button>
        </div>
        {stop === 'home' && planting}
        {stop === 'home' && (
          <button className="fold-strip" onClick={() => go('estate')}>
            {`${ESTATE_EMOJI} Fields${standing.map((c) => ` · ${CROP_EMOJI[c]} ${planted(c)}`).join('')} · ${READY_EMOJI} ${ready} ready`}
          </button>
        )}
      </div>
      {stop === 'home' && tools}
      {phone && stop === 'estate' && <EstateBar state={state} act={act} />}
      <div className="surface-main">
        {stop === 'estate' ? (
          <Estate state={state} act={act} ui={ui} lot={lot} />
        ) : (
          <>
            <div className="home-block" ref={homeRef}>
              {grid}
            </div>
            {below}
          </>
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
