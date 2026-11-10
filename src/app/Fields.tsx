import { fieldsStats } from '../core/fields'
import type { GameState } from '../core/state'

const FIELDS_EMOJI = '🚜' // Unicode 6, like every glyph in the UI
const READY_EMOJI = '🌾' // Unicode 6
const WAIT_EMOJI = '⏳' // Unicode 6; a stalled crop waits, it never dies

/** the 🚜 Fields card after the Tractor (batch 27, task 143e): one summary line + Open Estate — the rows moved to
 *  the 🚜 Estate stop; nothing before the Tractor */
export function Fields({ state, onOpen }: { state: GameState; onOpen: () => void }) {
  const { run } = state
  if (!run.fields.unlocked) return null
  const { ready, stalled } = fieldsStats(run)
  return (
    <div className="fields-summary">
      <span>{`${FIELDS_EMOJI} Fields · ${run.fields.count} tiles · ${READY_EMOJI} ${ready} ready · ${WAIT_EMOJI} ${stalled} stalled`}</span>
      <button onClick={onOpen}>Open Estate</button>
    </div>
  )
}
