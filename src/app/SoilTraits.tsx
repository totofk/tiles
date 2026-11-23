// batch 36.7 (task 242): the 🧭 soil traits list moved from ⭐ Favours to a collapsible card on the 🌾 Farm tab
// (and under the Workshop where there is no Farm tab). Verbatim move from Favours.tsx (batch 36.5) — default closed.
import { soilRerollStars } from '../core/balance'
import { STAR_EMOJI } from '../core/data/orders'
import { SOIL_TRAITS, SURVEY_EMOJI } from '../core/data/soil'
import type { GameState } from '../core/state'
import { rerollSoil, soilStrong } from '../core/survey'
import { soilTraitText } from './soilText'
import type { Act } from './useGame'

/** the rolled soil of every bed and field, each with its effect line and its ⭐ reroll (renders nothing before Lv 1) */
export function SoilTraits({ state, act }: { state: GameState; act: Act }) {
  const { run } = state
  if (run.survey.level < 1) return null
  return (
    <details className="soil-traits">
      <summary>{`${SURVEY_EMOJI} Soil traits · ${run.survey.beds.length} beds · ${run.survey.fields.length} fields`}</summary>
      {run.survey.beds.map((_, k) => (
        <SoilRow key={`b${k}`} state={state} act={act} where="bed" k={k} name={`Bed ${k + 1}`} />
      ))}
      {run.survey.fields.map((_, k) => (
        <SoilRow key={`f${k}`} state={state} act={act} where="field" k={k} name={`Field ${k + 1}`} />
      ))}
    </details>
  )
}

/** one rolled unit's row in the soil list (batch 36.5): the trait, its effect line, and its ⭐ reroll */
function SoilRow({ state, act, where, k, name }: { state: GameState; act: Act; where: 'bed' | 'field'; k: number; name: string }) {
  const unit = (where === 'bed' ? state.run.survey.beds[k] : state.run.survey.fields[k]) ?? null
  const trait = unit?.trait ?? null
  if (unit === null || trait === null) return null
  const t = SOIL_TRAITS[trait]
  return (
    <div className="soil-row">
      <span>{`${name}: ${t.emoji} ${t.name}`}</span>
      <small>{soilTraitText(trait, soilStrong(state.run))}</small>
      <button
        aria-label={`Reroll ${name.toLowerCase()}'s soil`}
        disabled={!rerollSoil(state, where, k).ok}
        onClick={() => act((s) => rerollSoil(s, where, k))}
      >
        {`Reroll ${STAR_EMOJI}${soilRerollStars(unit.rerolls)}`}
      </button>
    </div>
  )
}
