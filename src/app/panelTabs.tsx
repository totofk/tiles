import type { ReactNode } from 'react'
import type { CropId } from '../core/data/crops'
import type { GameState } from '../core/state'
import { Bank } from './Bank'
import { Shop } from './Shop'
import { Stats } from './Stats'
import { Upgrades } from './Upgrades'
import type { Act } from './useGame'

export type PanelProps = { state: GameState; act: Act; cropId: CropId; onSelectCrop: (id: CropId) => void }

/**
 * Side panel tabs, also the panel entries of the mobile tab bar. Adding a tab is one entry here;
 * `tiles.ui` validates the remembered tab against these ids.
 */
export const PANEL_TABS = [
  { id: 'shop', label: '🛒 Shop', Panel: Shop },
  { id: 'upgrades', label: '⬆️ Upgrades', Panel: Upgrades },
  { id: 'bank', label: '🏦 Bank', Panel: Bank },
  { id: 'stats', label: '📊 Stats', Panel: Stats },
] as const satisfies readonly { id: string; label: string; Panel: (p: PanelProps) => ReactNode }[]

export type PanelTabId = (typeof PANEL_TABS)[number]['id']
