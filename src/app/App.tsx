import { useEffect, useRef, useState } from 'react'
import { selectCrop } from '../core/actions'
import { CROPS, type CropId } from '../core/data/crops'
import { isMature, tapTile } from '../core/tile'
import { noMine } from '../core/wetlands'
import { EMPTY_FEEDBACK } from './feedback'
import { CROP_EMOJI, FarmGrid } from './FarmGrid'
import { gain } from './fmt'
import { Hud } from './Hud'
import { HAND_PICKED, cropFactor } from './marketText'
import { Mine } from './Mine'
import { BADGE_TABS, availableKeys, isBadgeTab, type BadgeTab } from './badges'
import { PANEL_TABS, type PanelTabId } from './panelTabs'
import { Surface } from './Surface'
import { Tools } from './Tools'
import { loadUi, saveUi, type View } from './uiState'
import { withoutHash, type Replay } from './replay'
import { useGame } from './useGame'

/** display-only: ignore taps on a tile for this long after harvesting it */
const TAP_GUARD_MS = 400

export type AppProps = {
  /** batch 39: a decoded `#replay=` save — the run is sandboxed in memory (see useGame); null = the player's own save */
  replay?: Replay | null
}

export default function App({ replay = null }: AppProps) {
  const { state, act, reset, sell, exportCode, applyImport, toast, banner, dismissBanner, acted, worked, minerActed, frozen, rates } = useGame(replay)
  // saved in the run: the plant worker plants it offline too
  const cropId = state.run.plantCrop
  const setCropId = (id: CropId) => act((s) => selectCrop(s, id))
  const [ui, setUi] = useState(() => loadUi(localStorage))
  // a replay reads the device's tiles.ui but never writes it back (batch 39)
  useEffect(() => {
    if (!replay) saveUi(localStorage, ui)
  }, [ui, replay])
  // batch 27: after the Tractor the Estate is its own main view (batch 38). A first Tractor starts on the
  // Farm for the pull-back, a welcome-back banner forces the Estate: both override the saved view once
  const estate = state.run.fields.unlocked
  const [viewOverride, setViewOverride] = useState<View | null>(() =>
    !estate ? null : !ui.pulledBack ? 'farm' : banner !== null ? 'estate' : null,
  )
  const setView = (v: View) => {
    setViewOverride(null)
    setUi((u) => ({ ...u, view: v }))
  }
  const setTab = (t: PanelTabId) => setUi((u) => ({ ...u, tab: t }))
  const toggleTools = () => setUi((u) => ({ ...u, toolsOpen: !u.toolsOpen }))
  // a remembered 🚜 Estate without the Tractor shows the Farm (task 263)
  const view: View = viewOverride ?? (estate || ui.view !== 'estate' ? ui.view : 'farm')
  // the side menu: a transient drawer on phones and tablets (task 262), always open on desktop
  const [menuOpen, setMenuOpen] = useState(false)
  // task 143e: the Fields card's Open Estate selects the 🚜 main view
  const openEstate = () => {
    setView('estate')
    setMenuOpen(false)
  }
  // the 📊 Stats tab's feedback draft and cooldown, here so a tab switch keeps them (not saved)
  const [feedback, setFeedback] = useState(EMPTY_FEEDBACK)

  // a tab is on screen when its content is visible in the current layout (same breakpoints as app.css);
  // jsdom has no matchMedia, so tests run as phones unless they stub it
  const media = (q: string) => window.matchMedia?.(q).matches ?? false
  const desktop = media('(min-width: 1024px)')
  const tabletUp = media('(min-width: 768px)')
  const phone = !tabletUp
  const menuVisible = desktop || menuOpen

  const avail = availableKeys(state)
  const shown = PANEL_TABS.find((t) => t.id === ui.tab) ?? PANEL_TABS[0]
  const open = shown.id
  // a badge tab's content is on screen: a menu tab while that tab is open, ⛏️ Mine while that main view is
  const onScreen = (t: BadgeTab) => (t === 'mine' ? view === 'mine' : menuVisible && open === t)
  const unseen = (t: BadgeTab) => avail[t].filter((k) => !ui.seen[t].includes(k))
  const badge = (t: string) => isBadgeTab(t) && !onScreen(t) && unseen(t).length > 0
  // showing a tab (or keeping it shown while something new appears) marks what it shows as seen;
  // set during render, guarded, so it re-renders once and never on a tick with nothing new
  const fresh = BADGE_TABS.filter((t) => onScreen(t) && unseen(t).length > 0)
  if (fresh.length > 0)
    setUi((u) => {
      const seen = { ...u.seen }
      for (const t of fresh) seen[t] = [...seen[t], ...unseen(t).filter((k) => !seen[t].includes(k))]
      return fresh.some((t) => seen[t].length > u.seen[t].length) ? { ...u, seen } : u
    })
  const dot = (t: string) => badge(t) && <span className="badge-dot" aria-hidden="true" />
  // task 264: the ☰ carries a dot while any menu-only tab has news (the ⛏️ Mine tab has its own on the main bar)
  const menuNews = badge('shop') || badge('upgrades') || badge('farm')

  // batch 21: the ▲▼ trend arrows need to know which price tag was last on screen; batch 27: the
  // Estate view's row tags count too. Only licensed crops with the tag actually rendered get recorded.
  const estateOn = estate && view === 'estate'
  useEffect(() => {
    if (!estateOn && (!menuVisible || (shown.id !== 'shop' && shown.id !== 'farm'))) return
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
  }, [estateOn, menuVisible, shown.id, state, setUi])

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
        return `+💰${gain(next.run.cash - prev.run.cash)} ${CROPS[tile.cropId!].name} ${HAND_PICKED}`
      },
    )
  }

  // task 132: off-farm worker flashes — the furnace Smelt group (ore/fuel loaders)
  const smeltActed = worked.some((w) => w.job === 'ore' || w.job === 'fuel')

  // batch 38 task 263: the 🌾 Farm menu tab exists at every width
  const panelProps = { state, act, cropId, onSelectCrop: setCropId, farmTab: true, ui, toggleTools, worked, feedback, setFeedback, reset, sell, exportCode, applyImport, openEstate, openBank: () => setTab('bank') }
  const grid = <FarmGrid state={state} onTap={onTap} acted={acted} act={act} />
  const planting = (
    <p className="planting">
      Planting: {CROP_EMOJI[cropId]} {CROPS[cropId].name} · seeds {state.run.seeds[cropId] ?? 0}
    </p>
  )
  const tools = <Tools state={state} act={act} cropId={cropId} stacked={desktop} open={ui.toolsOpen} onToggle={toggleTools} />
  const Panel = shown.Panel
  const mainTabs = [
    { label: '🌱 Farm', active: view === 'farm', dot: null, select: () => setView('farm') },
    ...(estate ? [{ label: '🚜 Estate', active: view === 'estate', dot: null, select: () => setView('estate') }] : []),
    {
      label: noMine(state.run) ? '🌊 River' : '⛏️ Mine',
      active: view === 'mine',
      dot: dot('mine'),
      select: () => setView('mine'),
    },
  ]

  // Esc closes the drawer (task 263); a dialog (Modal, field sheet) keeps Esc for itself
  useEffect(() => {
    if (desktop || !menuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || document.querySelector('[role="dialog"]')) return
      setMenuOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [desktop, menuOpen])

  return (
    <main className={`app${menuOpen ? ' menu-open' : ''}`} data-view={view}>
      <div className="top">
        <Hud state={state} rates={rates} />
        {!desktop && (
          <button className="menu-btn" aria-label="Open menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}>
            ☰
            {menuNews && <span className="badge-dot" aria-hidden="true" />}
          </button>
        )}
        {banner && (
          <div className="banner" role="status">
            <span>{banner}</span>
            <button aria-label="Dismiss" onClick={dismissBanner}>
              ✕
            </button>
          </div>
        )}
        {replay && (
          <div className="banner banner-replay" role="status">
            <span>
              🔁 Replay of a save from v{replay.fromVersion} — nothing is saved, your own save is untouched.
            </span>
            <button onClick={() => window.location.assign(withoutHash(window.location.href))}>Exit replay</button>
          </div>
        )}
        {frozen && (
          <div className="banner banner-freeze" role="alert">
            <span>Save changed in another tab — this one is paused. Reload to pick up the new save.</span>
            <button onClick={() => window.location.reload()}>Reload</button>
          </div>
        )}
      </div>
      <nav className="tabbar main-tabs" aria-label="Main view">
        {mainTabs.map((t) => (
          <button key={t.label} aria-pressed={t.active} onClick={t.select}>
            {t.label}
            {t.dot}
          </button>
        ))}
      </nav>
      {view === 'mine' ? (
        <Mine state={state} act={act} minerActed={minerActed} smeltActed={smeltActed} />
      ) : (
        <section className="farm">
          {estate ? (
            <Surface
              state={state}
              act={act}
              ui={ui}
              setUi={setUi}
              stop={view === 'estate' ? 'estate' : 'home'}
              setStop={(s) => setView(s === 'estate' ? 'estate' : 'farm')}
              phone={phone}
              planting={planting}
              tools={tools}
              grid={grid}
            />
          ) : (
            <>
              {planting}
              {tools}
              {grid}
            </>
          )}
        </section>
      )}
      {!desktop && menuOpen && <div className="menu-scrim" aria-hidden="true" onClick={() => setMenuOpen(false)} />}
      <aside className="menu">
        <div className="menu-head">
          <div className="menu-tabs" role="tablist">
            {PANEL_TABS.map((t) => {
              const [icon, ...rest] = t.label.split(' ')
              const name = rest.join(' ')
              return (
                <button key={t.id} role="tab" aria-selected={shown.id === t.id} title={name} onClick={() => setTab(t.id)}>
                  {icon}
                  <span className="tab-name"> {name}</span>
                  {dot(t.id)}
                </button>
              )
            })}
          </div>
          {!desktop && (
            <button className="menu-close" aria-label="Close menu" onClick={() => setMenuOpen(false)}>
              ✕
            </button>
          )}
        </div>
        <Panel {...panelProps} />
      </aside>
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </main>
  )
}
