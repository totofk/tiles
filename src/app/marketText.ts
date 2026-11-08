import { MARKET_FLOOR, handPickedBonus, marketFactor, marketRecoveryTicks } from '../core/balance'
import { CROPS, CROP_IDS, type CropId } from '../core/data/crops'
import { marketCropPrice } from '../core/market'
import type { GameState } from '../core/state'
import { CROP_EMOJI } from './FarmGrid'

// Display-only thresholds of the Shop depth bar and the away banner; they colour and filter text, never game state.
const DEPTH_GREEN = 0.85
const DEPTH_YELLOW = 0.65
/** the away banner names a crop only when its factor moved more than this */
const BANNER_MOVE = 0.05

const percent = (f: number) => Math.round(f * 100)

export const cropFactor = (state: GameState, crop: CropId) => marketFactor(crop, state.run.market[crop])

/** "🍋 💰99 (90 % ▼)": the price the next unit sells for and its market factor; ▲▼ against the factor the tag last
 * showed on screen (`last`, remembered in `tiles.ui`), and "floor" once the factor sits on MARKET_FLOOR */
export function priceTag(state: GameState, crop: CropId, last?: number): string {
  const factor = cropFactor(state, crop)
  const p = percent(factor)
  const trend = last === undefined || factor === last ? '' : factor > last ? ' ▲' : ' ▼'
  const floor = factor <= MARKET_FLOOR ? ' floor' : ''
  return `${CROP_EMOJI[crop]} 💰${marketCropPrice(state, crop, state.run.market[crop])} (${p} %${trend}${floor})`
}

/** the Shop depth bar's colour band */
export function depthBand(factor: number): 'green' | 'yellow' | 'red' {
  return factor >= DEPTH_GREEN ? 'green' : factor >= DEPTH_YELLOW ? 'yellow' : 'red'
}

/** done by the player's own hand: dig for seeds, hand-picked crops; Unicode 6.0 (the old 🪏 is Unicode 13) */
export const HAND_EMOJI = '✋'
/** "✋ ×1.25": what a crop the player harvests sells at, on top of the market price (batch 13) */
export const HAND_PICKED = `${HAND_EMOJI} ×${handPickedBonus()}`

/** the ⓘ tip's market sentence; the recovery time only while the market is still glutted */
export function marketTip(state: GameState, crop: CropId): string {
  const ticks = marketRecoveryTicks(crop, state.run.market[crop])
  const recover = ticks > 0 ? ` Recovers in ~${Math.max(1, Math.round(ticks / 60))} min if you stop selling.` : ''
  return `Sells for ${priceTag(state, crop)} now; selling a lot at once lowers the price.${recover} You harvest it: ${HAND_PICKED}; workers sell at ×1.`
}

/** "market: lemon 72 % → 95 %" for every crop whose factor moved more than BANNER_MOVE; null when none did */
export function marketMoves(before: GameState, after: GameState): string | null {
  const moved = CROP_IDS.flatMap((crop) => {
    const a = cropFactor(before, crop)
    const b = cropFactor(after, crop)
    return Math.abs(b - a) > BANNER_MOVE ? [`${CROPS[crop].name.toLowerCase()} ${percent(a)} % → ${percent(b)} %`] : []
  })
  return moved.length ? `market: ${moved.join(', ')}` : null
}
