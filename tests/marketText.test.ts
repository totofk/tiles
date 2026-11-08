import { describe, expect, it } from 'vitest'
import { HAND_PICKED, depthBand, marketMoves, marketTip, priceTag } from '../src/app/marketText'
import { bannerText } from '../src/app/useGame'
import { cropSellPrice, marketDepthGlut } from '../src/core/balance'
import type { CropId } from '../src/core/data/crops'
import { createInitialState, type GameState } from '../src/core/state'

/** a state whose `crop` market sits at `factor` (glut = 2 × (1 − factor) × depth) */
function at(crop: CropId, factor: number, s: GameState = createInitialState()): GameState {
  const glut = 2 * (1 - factor) * marketDepthGlut(crop)
  return { ...s, run: { ...s.run, market: { ...s.run.market, [crop]: glut } } }
}

describe('market text', () => {
  it('priceTag: the next unit price and factor, ▼ only below 100 %', () => {
    const s = createInitialState()
    const base = cropSellPrice('lemon', s.meta, 0)
    expect(priceTag(s, 'lemon')).toBe(`🍋 💰${base} (100 %)`)
    expect(priceTag(at('lemon', 0.9), 'lemon')).toBe(`🍋 💰${Math.round(base * 0.9)} (90 % ▼)`)
  })

  it('depthBand: green ≥ 85 %, yellow ≥ 65 %, red below', () => {
    expect([1, 0.85, 0.84, 0.65, 0.64, 0.5].map(depthBand)).toEqual(['green', 'green', 'yellow', 'yellow', 'red', 'red'])
  })

  it('batch 13: the ⓘ tip names the hand-picked bonus and that workers sell at ×1', () => {
    expect(HAND_PICKED).toBe('✋ ×1.25')
    expect(marketTip(createInitialState(), 'lemon')).toMatch(/You harvest it: ✋ ×1\.25; workers sell at ×1\.$/)
  })

  it('marketTip: names the recovery only while glutted', () => {
    expect(marketTip(createInitialState(), 'lemon')).not.toMatch(/Recovers/)
    // factor 0.9 → 0.99 is a tenfold glut drop: log2(10) half-lives of 30 min ≈ 100 min
    expect(marketTip(at('lemon', 0.9), 'lemon')).toMatch(/Recovers in ~100 min/)
  })

  it('marketMoves / away banner: crops that moved more than 5 points, lower-case, before → after', () => {
    const before = at('pumpkin', 0.97, at('lemon', 0.72))
    const after = at('pumpkin', 0.99, at('lemon', 0.95))
    expect(marketMoves(before, after)).toBe('market: lemon 72 % → 95 %')
    expect(marketMoves(after, after)).toBeNull()
    expect(bannerText(60_000, before, after)).toBe('Away for 1m — 60 ticks simulated · market: lemon 72 % → 95 %')
  })
})
