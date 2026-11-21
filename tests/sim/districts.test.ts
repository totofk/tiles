import { describe, expect, it, vi } from 'vitest'
import type { CropId } from '../../src/core/data/crops'
import type { DistrictId } from '../../src/core/data/districts'
import { createInitialState } from '../../src/core/state'
import { HOUR_TICKS, runBot, withBatch13 } from './bot'

vi.mock('../../src/core/balance', async (importOriginal) => (await import('./balanceMock')).balanceMock(importOriginal))

describe('batch 36.2: districts', () => {
  // licence lists per district (potato is the free start); plain10 = every crop
  const runs: Record<string, { district: DistrictId; licenses: CropId[] }> = {
    plain10: { district: 'plain', licenses: ['radish', 'corn', 'eggplant', 'pumpkin', 'tomato', 'lemon', 'grape', 'strawberry', 'chilli'] },
    orchardValley: { district: 'orchardValley', licenses: ['radish', 'corn', 'eggplant', 'pumpkin', 'lemon', 'grape', 'strawberry'] },
    ironHills: { district: 'ironHills', licenses: ['radish', 'corn', 'eggplant', 'pumpkin', 'tomato', 'chilli'] },
  }
  const PLANT: CropId[] = ['chilli', 'strawberry', 'grape', 'lemon', 'tomato', 'pumpkin', 'eggplant', 'corn', 'radish', 'potato']

  it('PIN36c: the shipped ladder bot reaches the Fields unlock in Orchard Valley and Iron Hills within ±20 % of plain10', () => {
    const hours = Object.fromEntries(
      Object.entries(runs).map(([name, { district, licenses }]) => {
        const fresh = createInitialState()
        let end = fresh
        withBatch13(() =>
          runBot(true, {
            ticks: 20 * HOUR_TICKS,
            licenses,
            crops: PLANT.filter((c) => c === 'potato' || licenses.includes(c)),
            ladder: true,
            copperTools: true,
            workers: true,
            furnace: true,
            planter: true,
            iron: true,
            ironTools: true,
            gold: true,
            sprinklers: true,
            fields: true,
            buyTools: true,
            initial: { ...fresh, run: { ...fresh.run, listing: { district, soil: null } } },
            onEnd: (s) => (end = s),
          }),
        )
        const at = end.run.milestones.fieldsUnlocked
        return [name, at === undefined ? null : Math.round((at / HOUR_TICKS) * 100) / 100]
      }),
    )
    console.log('PIN36c', JSON.stringify(hours))
    const plain = hours.plain10!
    expect(plain).toBeGreaterThan(0)
    for (const name of ['orchardValley', 'ironHills']) expect(Math.abs(hours[name]! / plain - 1)).toBeLessThanOrEqual(0.2)
  }, 300_000) // 3 ladder runs to the Tractor
})
