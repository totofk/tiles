import type { ActionResult } from '../core/actions'
import { sprinklerMax, type Price } from '../core/balance'
import { ITEMS, ITEM_IDS } from '../core/data/items'
import type { GameState } from '../core/state'
import { SPRINKLER_EMOJI } from '../core/workshop'
import { priceText } from './Mine'
import type { Act } from './useGame'

const VALVE_EMOJI = '🎛️' // Unicode 7

/** one token per material the recipe is short of, the TierTool "needs 🟨2 💰2500 more" pattern */
export function shortOf(cost: Price, run: GameState['run']): string[] {
  return [
    ...ITEM_IDS.filter((id) => (cost[id] ?? 0) > (run.inventory[id] ?? 0)).map((id) => `${ITEMS[id].emoji}⁠${cost[id]! - (run.inventory[id] ?? 0)}`),
    ...(cost.cash > run.cash ? [`💰⁠${cost.cash - run.cash}`] : []),
  ]
}

/** one recipe row: label + a buy button whose lines carry the effect, the price and what is missing;
 * `reason` replaces the "needs … more" line when the recipe is locked, not just unaffordable (the Fields machines) */
export function RecipeRow({ state, act, emoji, name, verb, cost, effect, owned, ownedText, reason = null, buy }: {
  state: GameState
  act: Act
  emoji: string
  name: string
  verb: string
  cost: Price
  effect: string
  owned: boolean
  ownedText: string
  reason?: string | null
  buy: (s: GameState) => ActionResult
}) {
  const short = shortOf(cost, state.run)
  const hint = reason ?? (short.length > 0 ? `needs ${short.join(' ')} more` : '')
  return (
    <div className="recipe-row">
      <span>
        {emoji} {name}
        <small>{owned ? ownedText : effect}</small>
        {!owned && hint && <small>{hint}</small>}
      </span>
      {owned ? (
        <span className="owned-badge">✓ Built</span>
      ) : (
        <button disabled={!buy(state).ok} onClick={() => act((s) => buy(s))}>
          {verb}
          <small className="recipe-price">{priceText(cost)}</small>
        </button>
      )}
    </div>
  )
}

/** the 🔧 Workshop card: sprinklers are built on the farm, on each bed's socket (batch 26); nothing is bought here */
export function Workshop({ state }: { state: GameState; act: Act }) {
  const { workshop } = state.run
  if (!workshop.built) return null
  const n = workshop.beds.filter(Boolean).length
  return (
    <details className="workers">
      <summary>{`🔧 Workshop · ${SPRINKLER_EMOJI} ${n}/${sprinklerMax()} beds`}</summary>
      <div className="group gauge-grid">
        <div className="gauge-row">
          <span>{`${SPRINKLER_EMOJI} ${n}/${sprinklerMax()} beds — the water worker retires at 4/4`}</span>
        </div>
      </div>
      <div className="recipe-wrap">
        <div className="recipe-grid">
          <div className="group">
            <h3>Build</h3>
            <p className="hint">Build on a bed's socket {SPRINKLER_EMOJI} on the farm</p>
            {workshop.valve && (
              <div className="recipe-row">
                <span>
                  {VALVE_EMOJI} Smart valve<small>gets a job when Fields get pressure</small>
                </span>
                <span className="owned-badge">✓ Built</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </details>
  )
}
