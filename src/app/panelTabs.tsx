import type { ReactNode } from 'react'
import type { CropId } from '../core/data/crops'
import type { Listing } from '../core/listings'
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

/** farmTab: the 🌾 Farm menu tab is shown (batch 38: true at every width; the prop keeps Shop's owned-row
 * variant); feedback: the 📊 Stats tab's form, held by App;
 * ui: the cosmetic `tiles.ui` state, so the price tags can trend against what they last showed;
 * toggleTools: flips ui.toolsOpen (the 🌱 Farm main view's 🧰 Tools bar, batch 24) */
export type PanelProps = {
  state: GameState
  act: Act
  cropId: CropId
  onSelectCrop: (id: CropId) => void
  farmTab: boolean
  ui: UiState
  toggleTools: () => void
  /** task 143e: the Fields card's Open Estate — land on the 🚜 stop (and the farm view on phones) */
  openEstate: () => void
  /** batch 36.6: the 🏆 Legacy chip lands on the 🏦 Bank tab */
  openBank: () => void
  /** task 132: the jobs that acted in the last work round (worker dots, clerk flash) */
  worked: WorkTouch[]
  reset: () => void
  sell: (choice: Listing) => void
  /** 💾 Data modal hooks: serialise the live run (TILES2, async), and commit a decoded import (backup + write + reload) */
  exportCode: () => Promise<string>
  applyImport: (save: Save) => ImportResult
} & Omit<FeedbackProps, 'state'>

/**
 * The side menu's tabs (batch 38: the menu is a ☰ drawer below 1024 px, always open on desktop). Adding a
 * tab is one entry here; `tiles.ui` validates the remembered tab against these ids. 🌾 Farm exists at every
 * width; the label is "<icon> <name>", split at the first space by App.
 */
export const PANEL_TABS = [
  { id: 'farm', label: '🌾 Farm', Panel: Farm },
  { id: 'shop', label: '🛒 Shop', Panel: Shop },
  { id: 'upgrades', label: '⬆️ Upgrades', Panel: Upgrades },
  { id: 'bank', label: '🏦 Bank', Panel: BankTab },
  { id: 'stats', label: '📊 Stats', Panel: StatsTab },
] as const satisfies readonly { id: string; label: string; Panel: (p: PanelProps) => ReactNode }[]

export type PanelTabId = (typeof PANEL_TABS)[number]['id']
