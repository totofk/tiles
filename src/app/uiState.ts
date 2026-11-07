import { PANEL_TABS, type PanelTabId } from './panelTabs'

/** UI-only state lives under its own key; the game save (src/save) never reads or writes it */
export const UI_KEY = 'tiles.ui'

/** mobile (< 768 px) shows one of these at a time; wider layouts show all of them */
export type View = 'farm' | 'mine' | 'panel'
const VIEWS: readonly View[] = ['farm', 'mine', 'panel']

export type UiState = {
  view: View
  tab: PanelTabId
  /** desktop only: a collapsed panel gives its width to the farm */
  collapsed: boolean
}

export const DEFAULT_UI: UiState = { view: 'farm', tab: 'shop', collapsed: false }

/** a missing, broken or partly invalid value falls back to the defaults, field by field */
export function parseUi(raw: string | null): UiState {
  let v: unknown = null
  try {
    if (raw !== null) v = JSON.parse(raw)
  } catch {
    return DEFAULT_UI
  }
  if (typeof v !== 'object' || v === null) return DEFAULT_UI
  const o = v as Record<string, unknown>
  return {
    view: VIEWS.find((x) => x === o.view) ?? DEFAULT_UI.view,
    tab: PANEL_TABS.find((t) => t.id === o.tab)?.id ?? DEFAULT_UI.tab,
    collapsed: typeof o.collapsed === 'boolean' ? o.collapsed : DEFAULT_UI.collapsed,
  }
}

export function loadUi(storage: Pick<Storage, 'getItem'>): UiState {
  try {
    return parseUi(storage.getItem(UI_KEY))
  } catch {
    return DEFAULT_UI // storage blocked
  }
}

export function saveUi(storage: Pick<Storage, 'setItem'>, ui: UiState): void {
  try {
    storage.setItem(UI_KEY, JSON.stringify(ui))
  } catch {
    // quota full or storage blocked: the layout just resets next visit
  }
}
