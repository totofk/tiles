import { describe, expect, it } from 'vitest'
import { buyLicense, harvest, plant, till, water, type ActionResult } from '../src/core/actions'
import { ACTION_ENERGY_COST, cropGrowTicks, licenseCost } from '../src/core/balance'
import { createInitialState, type GameState } from '../src/core/state'
import { step } from '../src/core/step'

const TICKS = 600

type Milestones = {
  firstRadishHarvest?: number
  licenseAffordable?: number
  licenseBought?: number
  firstPumpkinPlanted?: number
  firstPumpkinHarvest?: number
}

// Greedy bot: one best action at a time, by priority, across all tiles (lowest index first).
// "Dry" = moisture exactly 0 (step snaps float residue to 0); mature crops are never watered.
function bestAction(s: GameState): { state: GameState; kind: string } | null {
  const tiles = s.run.tiles
  const growing = (i: number) => {
    const { cropId, growth } = tiles[i]
    return cropId !== undefined && growth < cropGrowTicks(cropId, s.meta, s.run.upgrades.fertilizer)
  }
  const tries: Array<[string, (i: number) => ActionResult | null]> = [
    ['harvest', (i) => harvest(s, i)],
    ['water', (i) => (tiles[i].moisture === 0 && growing(i) ? water(s, i) : null)],
    ['plant:pumpkin', (i) => plant(s, i, 'pumpkin')],
    ['plant:radish', (i) => plant(s, i, 'radish')],
    ['till', (i) => till(s, i)],
  ]
  for (const [kind, act] of tries) {
    for (let i = 0; i < tiles.length; i++) {
      const result = act(i)
      if (result?.ok) return { state: result.state, kind: `${kind}:${tiles[i].cropId ?? ''}` }
    }
  }
  return null
}

function runBot() {
  let s = createInitialState()
  const m: Milestones = {}
  let minCash = s.run.cash
  const pumpkinLicense = licenseCost('pumpkin', s.meta)
  for (let t = 0; t < TICKS; t++) {
    const tick = s.run.tick
    if (!s.run.licenses.includes('pumpkin')) {
      if (s.run.cash >= pumpkinLicense) m.licenseAffordable ??= tick
      const bought = buyLicense(s, 'pumpkin')
      if (bought.ok) {
        s = bought.state
        m.licenseBought ??= tick
      }
    }
    while (s.run.energy >= ACTION_ENERGY_COST) {
      const next = bestAction(s)
      if (!next) break
      s = next.state
      if (next.kind.startsWith('harvest') && next.kind.endsWith(':radish')) m.firstRadishHarvest ??= tick
      if (next.kind.startsWith('harvest') && next.kind.endsWith(':pumpkin')) m.firstPumpkinHarvest ??= tick
      if (next.kind.startsWith('plant:pumpkin')) m.firstPumpkinPlanted ??= tick
      minCash = Math.min(minCash, s.run.cash)
    }
    if (!s.run.licenses.includes('pumpkin') && s.run.cash >= pumpkinLicense) m.licenseAffordable ??= tick
    s = step(s, 1)
  }
  return { milestones: m, minCash, finalCash: s.run.cash, finalTick: s.run.tick }
}

describe('greedy bot, 600 ticks', () => {
  const summary = runBot()
  console.log('sim summary', JSON.stringify(summary))

  it('never goes negative on cash', () => {
    expect(summary.minCash).toBeGreaterThanOrEqual(0)
    expect(summary.finalTick).toBe(TICKS)
  })

  it('can afford the pumpkin license by tick 300', () => {
    expect(summary.milestones.licenseAffordable).toBeLessThanOrEqual(300)
  })

  it('harvests at least one pumpkin by tick 600', () => {
    expect(summary.milestones.firstPumpkinHarvest).toBeDefined()
  })
})
