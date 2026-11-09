import type { ReactNode } from 'react'
import type { CropId } from '../core/data/crops'
import type { GameState } from '../core/state'
import type { WorkTouch } from '../core/workers'
import type { Save } from '../save/serialize'
import type { ImportResult } from '../save/storage'
import { BankTab } from './Bank'
import { Farm } from './Farm'
import { Shop } from './Shop'
import type { FeedbackProps } from './FeedbackCard'
import { StatsTab } from './Stats'
import type { UiState } from './uiState'
import { Upgrades } from './Upgrades'
import type { Act } from './useGame'

/** farmTab: the 🌾 Farm tab is shown (desktop side panel, expanded); feedback: the 📊 Stats tab's form, held by App;
 * ui: the cosmetic `tiles.ui` state, so the price tags can trend against what they last showed;
 * toggleTools: flips ui.toolsOpen (the 🌾 Farm tab's 🧰 Tools card, batch 24) */
export type PanelProps = {
  state: GameState
  act: Act
  cropId: CropId
  onSelectCrop: (id: CropId) => void
  farmTab: boolean
  ui: UiState
  toggleTools: () => void
  /** task 132: the jobs that acted in the last work round (worker dots, clerk flash) */
  worked: WorkTouch[]
  reset: () => void
  sell: () => void
  /** 💾 Data modal hooks: serialise the live run, and commit a decoded import (backup + write + reload) */
  exportCode: () => string
  applyImport: (save: Save) => ImportResult
} & Omit<FeedbackProps, 'state'>

/**
 * Side panel tabs, also the panel entries of the mobile tab bar. Adding a tab is one entry here;
 * `tiles.ui` validates the remembered tab against these ids. 🌾 Farm exists only in the desktop side panel
 * (App filters it out elsewhere); the label is "<icon> <name>", split at the first space by App.
 */
export const PANEL_TABS = [
  { id: 'farm', label: '🌾 Farm', Panel: Farm },
  { id: 'shop', label: '🛒 Shop', Panel: Shop },
  { id: 'upgrades', label: '⬆️ Upgrades', Panel: Upgrades },
  { id: 'bank', label: '🏦 Bank', Panel: BankTab },
  { id: 'stats', label: '📊 Stats', Panel: StatsTab },
] as const satisfies readonly { id: string; label: string; Panel: (p: PanelProps) => ReactNode }[]

export type PanelTabId = (typeof PANEL_TABS)[number]['id']
