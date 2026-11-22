import {
  batchBars,
  furnaceTrayCap,
  furnaceUpgradeMaxLevel,
  growTimeFactor,
  oreSlotCap,
  seamVeinLevel,
  sellPriceFactor,
  smeltOre,
  soilRerollStars,
  STAR_CARRY_CAP,
  upgradeMaxLevel,
  workerPoolCap,
} from '../core/balance'
import { BUNKHOUSE_EMOJI, MIST_EMOJI, SEAM_EMOJI } from '../core/data/favours'
import { ITEMS } from '../core/data/items'
import { STAR_EMOJI } from '../core/data/orders'
import { SOIL_TRAITS, SURVEY_EMOJI } from '../core/data/soil'
import { buyFavour, favourLevel, favourLock, favourPrice, favourShown, FAVOUR_IDS, type FavourId, type FavourLock } from '../core/favours'
import { rerollSoil, soilStrong } from '../core/survey'
import type { GameState, RunState } from '../core/state'
import { count } from './fmt'
import { Item } from './Info'
import { soilTraitText } from './soilText'
import { FAVOUR_TIPS } from './tips'
import { FIRE_EMOJI, type Act } from './useGame'

const ROWS: Record<FavourId, { emoji: string; name: string; once?: true }> = {
  bunkhouse: { emoji: BUNKHOUSE_EMOJI, name: 'Bunkhouse' },
  mist: { emoji: MIST_EMOJI, name: 'Fine mist' },
  sell: { emoji: STAR_EMOJI, name: 'Sell price' },
  furnaceSpeed: { emoji: FIRE_EMOJI, name: 'Furnace speed' },
  furnaceBatch: { emoji: FIRE_EMOJI, name: 'Furnace batch' },
  seam: { emoji: SEAM_EMOJI, name: 'Seam survey', once: true },
  stoker: { emoji: FIRE_EMOJI, name: 'Stoker', once: true },
  soilSurvey: { emoji: SURVEY_EMOJI, name: 'Soil survey' },
}

const pct = (f: number) => `${Math.round(f * 100)} %`
/** the smallest level of a tray / ore slot table that holds `need` */
const levelFor = (cap: (l: number) => number, need: number) => {
  let l = 0
  while (cap(l) !== undefined && cap(l) < need) l++
  return l
}

/** the short reason a row cannot be bought yet */
function lockText(run: RunState, lock: FavourLock): string {
  const next = batchBars(run.furnace.levels.batch + 1)
  switch (lock) {
    case 'hire':
      return 'needs hiring'
    case 'fertilizer':
      return `needs fertilizer Lv${upgradeMaxLevel('fertilizer')}`
    case 'sellPrice':
      return `needs sell price Lv${upgradeMaxLevel('sellPrice')}`
    case 'furnace':
      return 'needs a furnace'
    case 'speed':
      return `needs furnace speed Lv${furnaceUpgradeMaxLevel('speed')}`
    case 'batch':
      return `needs furnace batch ${batchBars(furnaceUpgradeMaxLevel('batch'))} bars`
    case 'tray':
      return `needs tray Lv${levelFor(furnaceTrayCap, 2 * next)}`
    case 'slot':
      return `needs ore slot Lv${levelFor(oreSlotCap, 2 * smeltOre() * next)}`
    case 'vein':
      return `needs vein Lv${seamVeinLevel()}`
    case 'stoker':
      return 'needs the fuel certificate'
    case 'fields':
      return 'needs the 🚜 Fields'
  }
}

/** "now → next" for one more ⭐ level */
function effectText(run: RunState, id: FavourId): string {
  const { fertilizer, sellPrice } = run.upgrades
  const { speed, batch } = run.furnace.levels
  switch (id) {
    case 'bunkhouse':
      return `pool ${workerPoolCap(run)} → ${workerPoolCap(run) + 1}`
    case 'mist':
      return `grow −${pct(1 - growTimeFactor(fertilizer))} → −${pct(1 - growTimeFactor(fertilizer + 1))}`
    case 'sell':
      return `+${pct(sellPriceFactor(sellPrice) - 1)} → +${pct(sellPriceFactor(sellPrice + 1) - 1)}`
    case 'furnaceSpeed':
      return `cycles ${Math.round(100 * 0.8 ** speed)} % → ${Math.round(100 * 0.8 ** (speed + 1))} %`
    case 'furnaceBatch':
      return `${batchBars(batch)} → ${batchBars(batch + 1)} bars`
    case 'seam':
      return 'aim one ore ×2'
    case 'stoker':
      return 'furnace ×1.5, fuel ×2'
    case 'soilSurvey':
      return ['a trait for each home bed', 'a trait for each field', 'every trait ×1.5'][run.survey.level] ?? ''
  }
}

/** a row's second line: effect and ⭐ price, else owned / max / the lock reason */
function rowLine(state: GameState, id: FavourId): string {
  const { run, meta } = state
  const price = favourPrice(run, meta, id)
  if (!price) return ROWS[id].once ? 'owned' : 'max'
  const lock = favourLock(run, id)
  if (lock) return lockText(run, lock)
  const items = price.ironBar ? ` ${ITEMS.ironBar.emoji}${price.ironBar}` : ''
  return `${effectText(run, id)} · ${STAR_EMOJI}${price.stars}${items}`
}

/** the ⭐ Favours section (batch 34; last in ⬆️ Upgrades since batch 35.4): what ⭐ buys, row by row */
export function Favours({ state, act }: { state: GameState; act: Act }) {
  const { run } = state
  return (
    <div id="favours" className="favours">
      <h2>{STAR_EMOJI} Favours</h2>
      <p>
        {STAR_EMOJI} {count(run.stars)} to spend · resets when you sell the farm (up to {STAR_CARRY_CAP} {STAR_EMOJI} carry over)
      </p>
      <div className="shop-row one-col">
        {FAVOUR_IDS.filter((id) => favourShown(run, id)).map((id) => {
          const { emoji, name, once } = ROWS[id]
          return (
            <Item key={id} tip={FAVOUR_TIPS[id]}>
              <button disabled={!buyFavour(state, id).ok} onClick={() => act((s) => buyFavour(s, id))}>
                {once ? `${emoji} ${name}` : `${emoji} ${name} Lv ${favourLevel(run, id)}`}
                <small>{rowLine(state, id)}</small>
              </button>
            </Item>
          )
        })}
      </div>
      {run.survey.level >= 1 && (
        <details className="soil-traits">
          <summary>{`${SURVEY_EMOJI} Soil traits · ${run.survey.beds.length} beds · ${run.survey.fields.length} fields`}</summary>
          {run.survey.beds.map((_, k) => (
            <SoilRow key={`b${k}`} state={state} act={act} where="bed" k={k} name={`Bed ${k + 1}`} />
          ))}
          {run.survey.fields.map((_, k) => (
            <SoilRow key={`f${k}`} state={state} act={act} where="field" k={k} name={`Field ${k + 1}`} />
          ))}
        </details>
      )}
    </div>
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

