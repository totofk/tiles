import { useRef, useState } from 'react'
import { CROPS, STARTING_CROP, type CropId } from '../core/data/crops'
import { isMature, tapTile } from '../core/tile'
import { CROP_EMOJI, FarmGrid } from './FarmGrid'
import { Hud } from './Hud'
import { Mine } from './Mine'
import { Shop } from './Shop'
import { useGame } from './useGame'

/** display-only: ignore taps on a tile for this long after harvesting it */
const TAP_GUARD_MS = 400

/** mobile (< 768 px) shows one of these at a time; wider layouts show all of them */
type View = 'farm' | 'mine' | 'panel'

export default function App() {
  const { state, act, reset, toast, banner, dismissBanner } = useGame()
  const [cropId, setCropId] = useState<CropId>(STARTING_CROP)
  const [view, setView] = useState<View>('farm')
  // tablet (768–1023 px) slide-over; a transient overlay, so it always starts closed
  const [slideOpen, setSlideOpen] = useState(false)
  // per tile: taps before this performance.now() are ignored, so a double tap at harvest cannot replant
  const guardUntil = useRef<Record<number, number>>({})

  const onTap = (i: number) => {
    const now = performance.now()
    if (now < (guardUntil.current[i] ?? 0)) return
    act(
      (s) => tapTile(s, i, cropId),
      (prev, next) => {
        const tile = prev.run.tiles[i]
        if (!isMature(tile, prev)) return null
        guardUntil.current[i] = now + TAP_GUARD_MS
        return `+💰${next.run.cash - prev.run.cash} ${CROPS[tile.cropId!].name}`
      },
    )
  }

  // shown at the bottom of the side panel, and of the Farm view on mobile (CSS picks one)
  const resetButton = (where: 'panel' | 'farm') => (
    <button
      className={`reset reset-${where}`}
      onClick={() => {
        if (!window.confirm('Reset save? All progress is lost.')) return
        reset()
        setCropId(STARTING_CROP)
      }}
    >
      Reset save
    </button>
  )

  const tabs: { view: View; label: string }[] = [
    { view: 'farm', label: '🌱 Farm' },
    { view: 'mine', label: '⛏️ Mine' },
    { view: 'panel', label: '🛒 Shop' },
  ]

  return (
    <main className={`app${slideOpen ? ' slide-open' : ''}`} data-view={view}>
      <div className="top">
        <Hud state={state} />
        <button className="panel-open" aria-expanded={slideOpen} onClick={() => setSlideOpen(true)}>
          🛒 Shop
        </button>
        {banner && (
          <div className="banner" role="status">
            <span>{banner}</span>
            <button aria-label="Dismiss" onClick={dismissBanner}>
              ✕
            </button>
          </div>
        )}
      </div>
      <Mine state={state} act={act} />
      <section className="farm">
        <p className="planting">
          Planting: {CROP_EMOJI[cropId]} {CROPS[cropId].name}
        </p>
        <FarmGrid state={state} onTap={onTap} />
        {resetButton('farm')}
      </section>
      <aside className="panel">
        <button className="panel-close" aria-label="Close panel" onClick={() => setSlideOpen(false)}>
          ✕
        </button>
        <Shop state={state} cropId={cropId} onSelectCrop={setCropId} act={act} />
        {resetButton('panel')}
      </aside>
      <nav className="tabbar">
        {tabs.map((t) => (
          <button key={t.view} aria-pressed={view === t.view} onClick={() => setView(t.view)}>
            {t.label}
          </button>
        ))}
      </nav>
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </main>
  )
}
