import { marketFactor, marketRecoveryTicks } from '../core/balance'
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

/** "🍋 💰99 (90 % ▼)": the price the next unit sells for and its market factor; ▼ while below 100 % */
export function priceTag(state: GameState, crop: CropId): string {
  const p = percent(cropFactor(state, crop))
  return `${CROP_EMOJI[crop]} 💰${marketCropPrice(state, crop, state.run.market[crop])} (${p} %${p < 100 ? ' ▼' : ''})`
}

/** the Shop depth bar's colour band */
export function depthBand(factor: number): 'green' | 'yellow' | 'red' {
  return factor >= DEPTH_GREEN ? 'green' : factor >= DEPTH_YELLOW ? 'yellow' : 'red'
}

/** the ⓘ tip's market sentence; the recovery time only while the market is still glutted */
export function marketTip(state: GameState, crop: CropId): string {
  const ticks = marketRecoveryTicks(crop, state.run.market[crop])
  const recover = ticks > 0 ? ` Recovers in ~${Math.max(1, Math.round(ticks / 60))} min if you stop selling.` : ''
  return `Sells for ${priceTag(state, crop)} now; selling a lot at once lowers the price.${recover}`
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
