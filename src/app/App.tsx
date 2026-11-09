import { useEffect, useRef, useState } from 'react'
import { selectCrop } from '../core/actions'
import { CROPS, type CropId } from '../core/data/crops'
import { isMature, tapTile } from '../core/tile'
import { DigSeeds } from './Farm'
import { EMPTY_FEEDBACK } from './feedback'
import { Fields } from './Fields'
import { CROP_EMOJI, FarmGrid } from './FarmGrid'
import { Hud } from './Hud'
import { HAND_PICKED, cropFactor } from './marketText'
import { Mine } from './Mine'
import { Orders } from './Orders'
import { availableKeys, isBadgeTab } from './badges'
import { PANEL_TABS, type PanelTabId } from './panelTabs'
import { Tools } from './Tools'
import { loadUi, saveUi, type View } from './uiState'
import { useGame } from './useGame'
import { Workers } from './Workers'
import { Workshop } from './Workshop'

/** display-only: ignore taps on a tile for this long after harvesting it */
const TAP_GUARD_MS = 400

export default function App() {
  const { state, act, reset, sell, exportCode, applyImport, toast, banner, dismissBanner, acted, watered, minerActed, frozen } = useGame()
  // saved in the run: the plant worker plants it offline too
  const cropId = state.run.plantCrop
  const setCropId = (id: CropId) => act((s) => selectCrop(s, id))
  const [ui, setUi] = useState(() => loadUi(localStorage))
  useEffect(() => saveUi(localStorage, ui), [ui])
  const { view, tab, collapsed } = ui
  const setView = (v: View) => setUi((u) => ({ ...u, view: v }))
  const setTab = (t: PanelTabId) => setUi((u) => ({ ...u, tab: t }))
  const setCollapsed = (c: boolean) => setUi((u) => ({ ...u, collapsed: c }))
  const toggleTools = () => setUi((u) => ({ ...u, toolsOpen: !u.toolsOpen }))
  // tablet (768–1023 px) slide-over; a transient overlay, so it always starts closed
  const [slideOpen, setSlideOpen] = useState(false)
  // the 📊 Stats tab's feedback draft and cooldown, here so a tab switch keeps them (not saved)
  const [feedback, setFeedback] = useState(EMPTY_FEEDBACK)

  // a tab is on screen when its content is visible in the current layout (same breakpoints as app.css);
  // App re-renders every tick, so a resize is picked up within a second
  const media = (q: string) => window.matchMedia?.(q).matches ?? false
  const desktop = media('(min-width: 1024px)')
  // batch 24: at ≥ 1440 the panel is always open with no toggle; a saved `collapsed` is ignored there (not
  // overwritten — it still applies at 1024–1439, which keeps the toggle)
  const wide = media('(min-width: 1440px)')
  const panelCollapsed = desktop && !wide && collapsed
  const panelOnScreen = desktop ? !panelCollapsed : media('(min-width: 768px)') ? slideOpen : view === 'panel'
  // the farm actions sit in the side panel only while it is beside the farm; collapsed, they go back to the farm column
  const farmTab = desktop && !panelCollapsed
  const tabs = farmTab ? PANEL_TABS : PANEL_TABS.filter((t) => t.id !== 'farm')
  // a remembered 🌾 Farm shows 🛒 Shop where there is no Farm tab
  const shown = tabs.find((t) => t.id === tab) ?? tabs[0]
  const avail = availableKeys(state)
  const unseen = (t: PanelTabId) => (isBadgeTab(t) ? avail[t].filter((k) => !ui.seen[t].includes(k)) : [])
  const badge = (t: PanelTabId) => !(panelOnScreen && shown.id === t) && unseen(t).length > 0
  // opening a tab (or keeping it open while something new appears) marks what it shows as seen;
  // set during render, guarded, so it re-renders once and never on a tick with nothing new
  const open = shown.id
  const fresh = panelOnScreen ? unseen(open) : []
  if (fresh.length > 0 && isBadgeTab(open))
    setUi((u) => {
      const add = fresh.filter((k) => !u.seen[open].includes(k))
      return add.length ? { ...u, seen: { ...u.seen, [open]: [...u.seen[open], ...add] } } : u
    })
  const dot = (t: PanelTabId) => badge(t) && <span className="badge-dot" aria-hidden="true" />

  // batch 21: while price tags are on screen, remember the factor each showed, so the next render trends ▲▼ against
  // it; deferred past paint (in a timer callback), so this render's arrow is what the player sees, and
  // equality-guarded, so a quiet tick re-renders nothing
  useEffect(() => {
    if (!panelOnScreen || (shown.id !== 'shop' && shown.id !== 'farm')) return
    const record = setTimeout(() => {
      setUi((u) => {
        const priceShown = { ...u.priceShown }
        let changed = false
        for (const id of state.run.licenses) {
          const factor = cropFactor(state, id)
          if (priceShown[id] !== factor) {
            priceShown[id] = factor
            changed = true
          }
        }
        return changed ? { ...u, priceShown } : u
      })
    }, 0)
    return () => clearTimeout(record)
  }, [panelOnScreen, shown.id, state, setUi])

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
        return `+💰${next.run.cash - prev.run.cash} ${CROPS[tile.cropId!].name} ${HAND_PICKED}`
      },
    )
  }

  const panelProps = { state, act, cropId, onSelectCrop: setCropId, farmTab, ui, toggleTools, feedback, setFeedback, reset, sell, exportCode, applyImport }
  const Panel = shown.Panel
  const mobileTabs = [
    { label: '🌱 Farm', active: view === 'farm', select: () => setView('farm'), dot: false },
    { label: '⛏️ Mine', active: view === 'mine', select: () => setView('mine'), dot: false },
    ...tabs.map((t) => ({
      label: t.label,
      dot: dot(t.id),
      active: view === 'panel' && shown.id === t.id,
      select: () => {
        setView('panel')
        setTab(t.id)
      },
    })),
  ]

  return (
    <main className={`app${slideOpen ? ' slide-open' : ''}${collapsed && !wide ? ' panel-collapsed' : ''}`} data-view={view}>
      <div className="top">
        <Hud state={state} />
        <button className="panel-open" aria-expanded={slideOpen} onClick={() => setSlideOpen(true)}>
          🛒 Shop
          {(badge('shop') || badge('upgrades')) && <span className="badge-dot" aria-hidden="true" />}
        </button>
        {banner && (
          <div className="banner" role="status">
            <span>{banner}</span>
            <button aria-label="Dismiss" onClick={dismissBanner}>
              ✕
            </button>
          </div>
        )}
        {frozen && (
          <div className="banner banner-freeze" role="alert">
            <span>Save changed in another tab — this one is paused. Reload to pick up the new save.</span>
            <button onClick={() => window.location.reload()}>Reload</button>
          </div>
        )}
      </div>
      <Mine state={state} act={act} minerActed={minerActed} />
      <section className="farm">
        {!farmTab && (
          <>
            <p className="planting">
              Planting: {CROP_EMOJI[cropId]} {CROPS[cropId].name} · seeds {state.run.seeds[cropId] ?? 0}
            </p>
            {/* on desktop this is the collapsed-panel fallback: the same stacked rows as the 🌾 Farm tab */}
            <Tools state={state} act={act} cropId={cropId} stacked={desktop} />
          </>
        )}
        <FarmGrid state={state} onTap={onTap} acted={acted} watered={watered} />
        {!farmTab && (
          <>
            <DigSeeds act={act} />
            <Orders state={state} act={act} card />
            <Workers state={state} act={act} />
            <Workshop state={state} act={act} />
            <Fields state={state} act={act} />
          </>
        )}
      </section>
      <aside className="panel">
        <div className="panel-head">
          <div className="panel-tabs" role="tablist">
            {tabs.map((t) => {
              const [icon, name] = t.label.split(' ')
              return (
                <button key={t.id} role="tab" aria-selected={shown.id === t.id} title={name} onClick={() => setTab(t.id)}>
                  {icon}
                  <span className="tab-name"> {name}</span>
                  {dot(t.id)}
                </button>
              )
            })}
          </div>
          {!wide && (
            <button
              className="panel-toggle"
              aria-label={collapsed ? 'Expand panel' : 'Collapse panel'}
              aria-expanded={!collapsed}
              onClick={() => setCollapsed(!collapsed)}
            >
              {collapsed ? '‹' : '›'}
            </button>
          )}
          <button className="panel-close" aria-label="Close panel" onClick={() => setSlideOpen(false)}>
            ✕
          </button>
        </div>
        <Panel {...panelProps} />
      </aside>
      <nav className="tabbar">
        {mobileTabs.map((t) => (
          <button key={t.label} aria-pressed={t.active} onClick={t.select}>
            {t.label}
            {t.dot}
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
