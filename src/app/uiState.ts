import { CROP_IDS, type CropId } from '../core/data/crops'
import { BADGE_TABS, type BadgeTab } from './badges'
import { PANEL_TABS, type PanelTabId } from './panelTabs'

/** UI-only state lives under its own key; the game save (src/save) never reads or writes it */
export const UI_KEY = 'tiles.ui'

/** the one main view (batch 38): 🌱 Farm / 🚜 Estate / ⛏️ Mine — the main tabs pick it; `tiles.ui` remembers it */
export type View = 'farm' | 'estate' | 'mine'
const VIEWS: readonly View[] = ['farm', 'estate', 'mine']

/** the Estate surface's two stops (batch 27): with batch 38 the 🚜 Estate / 🌱 Farm main views pick them */
export type Stop = 'estate' | 'home'

export type UiState = {
  view: View
  tab: PanelTabId
  /** the 🧰 Tools card's open flag (batch 24); the card now lives on the 🌱 Farm main view (batch 38) */
  toolsOpen: boolean
  /** the pull-back animation has played (batch 27): it plays once per browser, never again */
  pulledBack: boolean
  /** badge keys (badges.ts) the player has seen on each tab; a key not in here is news */
  seen: Record<BadgeTab, string[]>
  /** the market factor each licensed crop's price tag last showed on screen (▲▼ trend arrows, batch 21) */
  priceShown: Partial<Record<CropId, number>>
}

export const DEFAULT_UI: UiState = {
  view: 'farm',
  tab: 'farm',
  toolsOpen: true,
  pulledBack: false,
  seen: { shop: [], upgrades: [], farm: [], mine: [] },
  priceShown: {},
}

export function parseUi(raw: string | null): UiState {
  let v: unknown = null
  try {
    if (raw !== null) v = JSON.parse(raw)
  } catch {
    return DEFAULT_UI
  }
  if (typeof v !== 'object' || v === null) return DEFAULT_UI
  const o = v as Record<string, unknown>
  // batch 38: the old 'panel' view reads as 'farm' — the panel pages became the side menu. An old
  // `stop: 'estate'` saved while viewing the farm reads as the new 'estate' view. `stop` and
  // `collapsed` are gone from the state: a stored value is ignored, never an error.
  const rawView = typeof o.view === 'string' ? o.view : ''
  let view = VIEWS.find((x) => x === rawView) ?? DEFAULT_UI.view
  if (rawView === 'farm' && o.stop === 'estate') view = 'estate'
  const seen: Record<BadgeTab, string[]> = { shop: [], upgrades: [], farm: [], mine: [] }
  const seenObj = (o.seen ?? null) as Record<string, unknown> | null
  for (const t of BADGE_TABS) {
    const list = seenObj?.[t]
    if (Array.isArray(list) && list.every((k) => typeof k === 'string')) seen[t] = list as string[]
  }
  const priceShown: Partial<Record<CropId, number>> = {}
  const shownObj = (o.priceShown ?? null) as Record<string, unknown> | null
  if (shownObj !== null)
    for (const c of CROP_IDS) {
      const factor = shownObj[c]
      if (typeof factor === 'number' && Number.isFinite(factor)) priceShown[c] = factor
    }
  return {
    view,
    tab: PANEL_TABS.find((t) => t.id === o.tab)?.id ?? DEFAULT_UI.tab,
    toolsOpen: typeof o.toolsOpen === 'boolean' ? o.toolsOpen : DEFAULT_UI.toolsOpen,
    pulledBack: typeof o.pulledBack === 'boolean' ? o.pulledBack : DEFAULT_UI.pulledBack,
    seen,
    priceShown,
  }
}

type Store = Pick<Storage, 'getItem' | 'setItem'>

export function saveUi(storage: Store, ui: UiState) {
  try {
    storage.setItem(UI_KEY, JSON.stringify(ui))
  } catch {
    /* a full or blocked store just means defaults next time */
  }
}

export function loadUi(storage: Store): UiState {
  let raw: string | null
  try {
    raw = storage.getItem(UI_KEY)
  } catch {
    return DEFAULT_UI
  }
  return parseUi(raw)
}
