import type { ActionResult } from '../core/actions'
import { sprinklerCost, sprinklerHopper, sprinklerMax, sprinklerTiles, valveCost, type Price } from '../core/balance'
import { ITEMS, ITEM_IDS } from '../core/data/items'
import type { GameState } from '../core/state'
import { buySprinkler, buyValve } from '../core/workshop'
import { Bar } from './Bar'
import { priceText } from './Mine'
import type { Act } from './useGame'

const SPRINKLER_EMOJI = '💧' // Unicode 6, like every glyph in the UI
const VALVE_EMOJI = '🎛️' // Unicode 7

/** one token per material the recipe is short of, the TierTool "needs 🟨2 💰2500 more" pattern */
export function shortOf(cost: Price, run: GameState['run']): string[] {
  return [
    ...ITEM_IDS.filter((id) => (cost[id] ?? 0) > (run.inventory[id] ?? 0)).map((id) => `${ITEMS[id].emoji}${cost[id]! - (run.inventory[id] ?? 0)}`),
    ...(cost.cash > run.cash ? [`💰${cost.cash - run.cash}`] : []),
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
    <div className="worker-row">
      <span>
        {emoji} {name}
      </span>
      <button className={owned ? 'owned' : undefined} disabled={owned || !buy(state).ok} onClick={() => act((s) => buy(s))}>
        {verb}
        <small>{owned ? `✓ ${ownedText}` : `${effect} · ${priceText(cost)}`}</small>
        {!owned && hint && <small>{hint}</small>}
      </button>
    </div>
  )
}

/** the 🔧 Workshop card: per-machine coal gauges (a stalled machine is the one the valve covers; an aggregate would hide it) */
export function Workshop({ state, act }: { state: GameState; act: Act }) {
  const { run, meta } = state
  const { workshop } = run
  if (!workshop.built) return null
  const n = workshop.hoppers.length
  return (
    <details className="workers">
      <summary>
        {`🔧 Workshop · ${SPRINKLER_EMOJI} Sprinklers ${n}/${sprinklerMax()} — waters ${n * sprinklerTiles()} tiles`}
        {workshop.hoppers.some((h) => h < 1) && <span className="unpaid">stalled</span>}
      </summary>
      {workshop.hoppers.map((h, i) => (
        <div className="worker-row" key={i}>
          <span>
            {`${SPRINKLER_EMOJI} Machine ${i + 1}`}
            {h < 1 && ' — stalled'}
          </span>
          <Bar value={h / sprinklerHopper()} kind="fire" />
          <small>{`${ITEMS.coal.emoji} ${h}/${sprinklerHopper()}`}</small>
        </div>
      ))}
      <RecipeRow
        state={state}
        act={act}
        emoji={SPRINKLER_EMOJI}
        name="Sprinkler"
        verb="Build"
        cost={sprinklerCost(meta)}
        effect={`waters ${sprinklerTiles()} tiles`}
        owned={n >= sprinklerMax()}
        ownedText={`${sprinklerMax()} machines`}
        buy={buySprinkler}
      />
      <RecipeRow
        state={state}
        act={act}
        emoji={VALVE_EMOJI}
        name="Smart valve"
        verb="Buy"
        cost={valveCost(meta)}
        effect="holds moisture during a coal stall"
        owned={workshop.valve}
        ownedText="holds moisture during a coal stall"
        buy={buyValve}
      />
    </details>
  )
}
