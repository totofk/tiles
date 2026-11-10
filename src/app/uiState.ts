import { CROP_IDS, type CropId } from '../core/data/crops'
import { BADGE_TABS, type BadgeTab } from './badges'
import { PANEL_TABS, type PanelTabId } from './panelTabs'

/** UI-only state lives under its own key; the game save (src/save) never reads or writes it */
export const UI_KEY = 'tiles.ui'

/** mobile (< 768 px) shows one of these at a time; wider layouts show all of them */
export type View = 'farm' | 'mine' | 'panel'
const VIEWS: readonly View[] = ['farm', 'mine', 'panel']

/** the Estate surface's two stops (batch 27, only read once the Tractor is owned) */
export type Stop = 'estate' | 'home'
const STOPS: readonly Stop[] = ['estate', 'home']

export type UiState = {
  view: View
  tab: PanelTabId
  /** desktop only: a collapsed panel gives its width to the farm */
  collapsed: boolean
  /** the 🌾 Farm tab's 🧰 Tools card (batch 24); a tiles.ui from before batch 24 reads as open */
  toolsOpen: boolean
  /** the Estate surface's stop (batch 27); the pull-back and a welcome-back banner override it at load */
  stop: Stop
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
  collapsed: false,
  toolsOpen: true,
  stop: 'estate',
  pulledBack: false,
  seen: { shop: [], upgrades: [] },
  priceShown: {},
}

const isStrings = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string')

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
  const shown = (o.priceShown ?? null) as Record<string, unknown> | null
  return {
    view: VIEWS.find((x) => x === o.view) ?? DEFAULT_UI.view,
    tab: PANEL_TABS.find((t) => t.id === o.tab)?.id ?? DEFAULT_UI.tab,
    collapsed: typeof o.collapsed === 'boolean' ? o.collapsed : DEFAULT_UI.collapsed,
    toolsOpen: typeof o.toolsOpen === 'boolean' ? o.toolsOpen : DEFAULT_UI.toolsOpen,
    stop: STOPS.find((x) => x === o.stop) ?? DEFAULT_UI.stop,
    pulledBack: typeof o.pulledBack === 'boolean' ? o.pulledBack : DEFAULT_UI.pulledBack,
    seen: Object.fromEntries(
      BADGE_TABS.map((t) => {
        const v = (o.seen as Record<string, unknown> | null | undefined)?.[t]
        return [t, isStrings(v) ? v : DEFAULT_UI.seen[t]]
      }),
    ) as UiState['seen'],
    priceShown: Object.fromEntries(CROP_IDS.filter((c) => typeof shown?.[c] === 'number').map((c) => [c, shown![c] as number])) as UiState['priceShown'],
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
