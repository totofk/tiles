import type { ReactNode } from 'react'
import type { GameState } from '../core/state'
import type { Act } from './useGame'
import type { UiState } from './uiState'

/** the 🚜 Estate stop (batch 27, filled in task 143): capacity strip, the home lot shrunk to a MiniLot, the
 *  by-crop rows, the ghost row and the machines. Task 142 mounts just the lot. */
export function Estate({ lot }: { state: GameState; act: Act; ui: UiState; lot?: ReactNode }) {
  return <div className="estate">{lot}</div>
}
