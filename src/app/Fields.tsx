import { FIELD_PRESSURE } from '../core/balance'
import { fieldsOverview, fieldsPressure } from '../core/fields'
import type { GameState } from '../core/state'

const FIELDS_EMOJI = '🚜' // Unicode 6, like every glyph in the UI
const READY_EMOJI = '🌾' // Unicode 6

/** the 🚜 Fields card after the Tractor (batch 27, task 143e): one summary line + Open Estate — the rows moved to
 *  the 🚜 Estate stop; nothing before the Tractor */
export function Fields({ state, onOpen }: { state: GameState; onOpen: () => void }) {
  const { run } = state
  if (!run.fields.unlocked) return null
  const { plots, ready } = fieldsOverview(run)
  return (
    <div className="fields-summary">
      <span>{`${FIELDS_EMOJI} Fields · ${plots} plots · ${READY_EMOJI} ${ready} ready · ⛽ ×${fieldsPressure(run) ? FIELD_PRESSURE : 1}`}</span>
      <button onClick={onOpen}>Open Estate</button>
    </div>
  )
}
