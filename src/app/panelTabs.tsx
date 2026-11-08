import type { ReactNode } from 'react'
import type { CropId } from '../core/data/crops'
import type { GameState } from '../core/state'
import { Bank } from './Bank'
import { Farm } from './Farm'
import { Shop } from './Shop'
import type { FeedbackProps } from './FeedbackCard'
import type { SaveTransferProps } from './SaveTransfer'
import { StatsTab } from './Stats'
import { Upgrades } from './Upgrades'
import type { Act } from './useGame'

/** farmTab: the 🌾 Farm tab is shown (desktop side panel, expanded); feedback: the 📊 Stats tab's form, held by App */
export type PanelProps = {
  state: GameState
  act: Act
  cropId: CropId
  onSelectCrop: (id: CropId) => void
  farmTab: boolean
  reset: () => void
  sell: () => void
} & Omit<FeedbackProps, 'state'> &
  SaveTransferProps

/**
 * Side panel tabs, also the panel entries of the mobile tab bar. Adding a tab is one entry here;
 * `tiles.ui` validates the remembered tab against these ids. 🌾 Farm exists only in the desktop side panel
 * (App filters it out elsewhere); the label is "<icon> <name>", split at the first space by App.
 */
export const PANEL_TABS = [
  { id: 'farm', label: '🌾 Farm', Panel: Farm },
  { id: 'shop', label: '🛒 Shop', Panel: Shop },
  { id: 'upgrades', label: '⬆️ Upgrades', Panel: Upgrades },
  { id: 'bank', label: '🏦 Bank', Panel: Bank },
  { id: 'stats', label: '📊 Stats', Panel: StatsTab },
] as const satisfies readonly { id: string; label: string; Panel: (p: PanelProps) => ReactNode }[]

export type PanelTabId = (typeof PANEL_TABS)[number]['id']
