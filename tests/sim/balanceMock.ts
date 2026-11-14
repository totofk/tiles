import type { CropId } from '../../src/core/data/crops'
import type { MetaState } from '../../src/core/state'
import type { WorkerJob } from '../../src/core/data/workers'

// Batch 12: the crop market is on in every run; `withoutMarket` switches it off (factor 1). Batch 16: the pre-market
// era ladders (batch 8–11) run off — at depth 60 the market starves the pre-hand-picked worker bot of cash — so they
// keep replaying their pre-market pins; only their market-on ladder is pinned (stalled) in the batch-12 describe.
export const market = { on: true }
// Batch 13: every run before the "batch 13" describe replays the batch-12 rules (certificates without the tool gate at
// their old prices, hire base 80, no hand-picked bonus), so their pins stay the measured history; `batch13` switches
// the real rules on.
export const rules = { batch13: false }
export const OLD_CERTIFICATE: Record<string, { cash: number; stone?: number }> = { water: { cash: 100 }, harvest: { stone: 20, cash: 150 } }

export const balanceMock = async (importOriginal: <T>() => Promise<T>) => {
  const real = await importOriginal<typeof import('../../src/core/balance')>()
  return {
    ...real,
    marketFactor: (crop: CropId, glut: number, floor?: number) => (market.on ? real.marketFactor(crop, glut, floor) : 1),
    certificateUnlock: (job: WorkerJob) => {
      const unlock = real.certificateUnlock(job)
      if (rules.batch13) return unlock
      const { tool, ...old } = unlock
      void tool
      return old
    },
    certificateCost: (job: WorkerJob, meta: MetaState) => {
      const old = OLD_CERTIFICATE[job]
      return rules.batch13 || !old ? real.certificateCost(job, meta) : { ...old, cash: Math.round(old.cash * real.multiplier(meta, 'cost')) }
    },
    workerHireCost: (pool: number, meta: MetaState) =>
      rules.batch13 ? real.workerHireCost(pool, meta) : Math.round(80 * 1.7 ** pool * real.multiplier(meta, 'cost')),
    handPickedBonus: () => (rules.batch13 ? real.handPickedBonus() : 1),
  }
}
