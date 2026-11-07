import { useEffect, useRef, useState } from 'react'
import { CROPS, STARTING_CROP, type CropId } from '../core/data/crops'
import { isMature, tapTile } from '../core/tile'
import { CROP_EMOJI, FarmGrid } from './FarmGrid'
import { Hud } from './Hud'
import { Mine } from './Mine'
import { PANEL_TABS, type PanelTabId } from './panelTabs'
import { loadUi, saveUi, type View } from './uiState'
import { useGame } from './useGame'

/** display-only: ignore taps on a tile for this long after harvesting it */
const TAP_GUARD_MS = 400

export default function App() {
  const { state, act, reset, toast, banner, dismissBanner } = useGame()
  const [cropId, setCropId] = useState<CropId>(STARTING_CROP)
  const [ui, setUi] = useState(() => loadUi(localStorage))
  useEffect(() => saveUi(localStorage, ui), [ui])
  const { view, tab, collapsed } = ui
  const setView = (v: View) => setUi((u) => ({ ...u, view: v }))
  const setTab = (t: PanelTabId) => setUi((u) => ({ ...u, tab: t }))
  const setCollapsed = (c: boolean) => setUi((u) => ({ ...u, collapsed: c }))
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

  const panelProps = { state, act, cropId, onSelectCrop: setCropId }
  const Panel = PANEL_TABS.find((t) => t.id === tab)!.Panel
  const mobileTabs = [
    { label: '🌱 Farm', active: view === 'farm', select: () => setView('farm') },
    { label: '⛏️ Mine', active: view === 'mine', select: () => setView('mine') },
    ...PANEL_TABS.map((t) => ({
      label: t.label,
      active: view === 'panel' && tab === t.id,
      select: () => {
        setView('panel')
        setTab(t.id)
      },
    })),
  ]

  return (
    <main className={`app${slideOpen ? ' slide-open' : ''}${collapsed ? ' panel-collapsed' : ''}`} data-view={view}>
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
          Planting: {CROP_EMOJI[cropId]} {CROPS[cropId].name} · seeds {state.run.seeds[cropId] ?? 0}
        </p>
        <FarmGrid state={state} onTap={onTap} />
        {resetButton('farm')}
      </section>
      <aside className="panel">
        <div className="panel-head">
          <div className="panel-tabs" role="tablist">
            {PANEL_TABS.map((t) => (
              <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
          <button
            className="panel-toggle"
            aria-label={collapsed ? 'Expand panel' : 'Collapse panel'}
            aria-expanded={!collapsed}
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? '‹' : '›'}
          </button>
          <button className="panel-close" aria-label="Close panel" onClick={() => setSlideOpen(false)}>
            ✕
          </button>
        </div>
        <Panel {...panelProps} />
        {resetButton('panel')}
      </aside>
      <nav className="tabbar">
        {mobileTabs.map((t) => (
          <button key={t.label} aria-pressed={t.active} onClick={t.select}>
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
