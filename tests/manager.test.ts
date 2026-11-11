import { describe, expect, it } from 'vitest'
import { TANK_UNITS_PER_COAL, doubleHarvestChance, fieldPlots, plotTiles, tankCapCoal, workerActionTicks } from '../src/core/balance'
import { CROP_IDS, type CropId } from '../src/core/data/crops'
import { fieldsCropIncomePerHour } from '../src/core/fields'
import { managerPlan } from '../src/core/manager'
import { createInitialState, type Field, type GameState, type Offer, type Plot } from '../src/core/state'
import { step } from '../src/core/step'
import { catchUp } from '../src/save/serialize'

const init = createInitialState()
const FIELD = fieldPlots() * plotTiles()
const emptyPlots = (): Plot[] => Array.from({ length: fieldPlots() }, () => ({ crop: null, readyTick: 0 }))
const field = (crop: CropId | null = null, pinned = false, plots = emptyPlots()): Field => ({ pivot: true, crop, pinned, plots })
const ROUND = workerActionTicks(init.meta)

/** `n` pivoted empty fields, every crop licensed and past the gate, a Manager assigned, cash 1,000,000 */
function managed(list: Field[], extra: Partial<GameState['run']> = {}): GameState {
  return {
    ...init,
    run: {
      ...init.run,
      cash: 1_000_000,
      autoBuySeeds: false,
      licenses: [...CROP_IDS],
      lifetime: { ...init.run.lifetime, harvests: Object.fromEntries(CROP_IDS.map((c) => [c, 50])) },
      fields: { ...init.run.fields, unlocked: true, pump: 3, list, tank: tankCapCoal(3) * TANK_UNITS_PER_COAL },
      workers: { pool: 1, assigned: { ...init.run.workers.assigned, manager: 1 }, certificates: ['manager'] },
      ...extra,
    },
  }
}
const fields = (n: number) => Array.from({ length: n }, () => field())
const offer = (good: CropId, count: number, done = 0): Offer => ({ good, count, done, tier: 2, accepted: true })
const withOffers = (s: GameState, offers: Offer[]): GameState => ({ ...s, run: { ...s.run, orders: { ...s.run.orders, unlocked: true, offers } } })

describe('batch 29: 💼 managerPlan', () => {
  it('no fields unlocked or no managed field → empty plan', () => {
    expect(managerPlan(init)).toEqual({ contracts: [], rest: [], target: [] })
    expect(managerPlan(managed([field('lemon', true)]))).toEqual({ contracts: [], rest: [], target: [null] })
  })

  it('a contract with shortfall S reserves ceil(S ÷ (50 × yield)) fields, standing plots of its crop counted', () => {
    const perTile = 1 + doubleHarvestChance(init.run.toolTier.harvest)
    const standing = field('lemon', true, [{ crop: 'strawberry', readyTick: 99 }, ...emptyPlots().slice(1)])
    const s = withOffers(managed([standing, ...fields(5)]), [offer('strawberry', 260, 20)])
    const S = 260 - 20 - plotTiles() * perTile
    const plan = managerPlan(s)
    expect(plan.contracts).toEqual([{ slot: 0, crop: 'strawberry', fields: [1, 2, 3, 4, 5].slice(0, Math.ceil(S / (FIELD * perTile))) }])
    expect(plan.target[0]).toBe(null) // pinned: never managed
  })

  it('a contract takes fields already showing its chip first', () => {
    const s = withOffers(managed([field(), field(), field('strawberry')]), [offer('strawberry', 40)])
    expect(managerPlan(s).contracts[0]!.fields).toEqual([2])
  })

  it('rest income ≥ 0.999 × an exhaustive enumeration at 1–6 fields', () => {
    for (let m = 1; m <= 6; m++) {
      const s = managed(fields(m))
      const income = (c: CropId, j: number) => fieldsCropIncomePerHour(s, c, j * FIELD)
      let best = 0
      const walk = (i: number, left: number, sum: number) => {
        if (i === CROP_IDS.length) return void (best = Math.max(best, sum))
        for (let j = 0; j <= left; j++) walk(i + 1, left - j, sum + income(CROP_IDS[i]!, j))
      }
      walk(0, m, 0)
      const plan = managerPlan(s)
      const got = plan.rest.reduce((sum, r) => sum + income(r.crop, r.fields.length), 0)
      expect(got).toBeGreaterThanOrEqual(0.999 * best)
      expect(plan.target.every((c) => c !== null)).toBe(true)
    }
  })

  it('a field whose chip is already in the plan keeps it', () => {
    const s = managed(fields(3))
    const plan = managerPlan(s)
    const flipped = managed(plan.target.map((c) => field(c)).reverse())
    expect(managerPlan(flipped).target).toEqual([...plan.target].reverse())
  })
})

describe('batch 29: 💼 the Manager at work', () => {
  it('flips one differing chip per round for 💰28 and idles unpaid once the plan is applied', () => {
    const s = managed(fields(3))
    const once = step(s, 1)
    expect(s.run.cash - once.run.cash).toBe(28)
    expect(once.run.fields.list.filter((f) => f.crop !== null)).toHaveLength(1)
    const done = step(s, 3 * ROUND + 1)
    const { target } = managerPlan(s)
    expect(done.run.fields.list.map((f) => f.crop)).toEqual(target)
    expect(s.run.cash - done.run.cash).toBe(28 * target.filter((c) => c !== null).length)
    expect(step(done, 10 * ROUND).run.cash).toBe(done.run.cash)
  })

  it('cash < 28: the Manager idles, an earlier job still acts', () => {
    const s = managed(fields(2), { cash: 27 })
    const withFuel: GameState = {
      ...s,
      run: {
        ...s.run,
        inventory: { ...s.run.inventory, coal: 5 },
        fields: { ...s.run.fields, tank: 0 },
        workers: { pool: 2, assigned: { ...s.run.workers.assigned, fuel: 1 }, certificates: ['manager', 'fuel'] },
      },
    }
    const next = step(withFuel, 1)
    expect(next.run.fields.list.map((f) => f.crop)).toEqual([null, null])
    expect(next.run.cash).toBe(26)
    expect(next.run.inventory.coal).toBe(4)
  })

  it('pinned fields and their chips never change; offers are never accepted or discarded (100 rounds)', () => {
    const pinned = [field('lemon', true), field(null, true)]
    const s = withOffers(managed([...pinned, ...fields(3)]), [offer('pumpkin', 500), { ...offer('corn', 30), accepted: false }])
    const after = step(s, 100 * ROUND)
    const idle = step({ ...s, run: { ...s.run, workers: { ...s.run.workers, assigned: init.run.workers.assigned } } }, 100 * ROUND)
    expect(after.run.fields.list.slice(0, 2).map((f) => [f.crop, f.pinned])).toEqual([['lemon', true], [null, true]])
    expect(after.run.fields.list.slice(2).some((f) => f.crop !== null)).toBe(true)
    expect(after.run.orders).toEqual(idle.run.orders)
  })

  it('8 h offline with a Manager on 20 fields', () => {
    const back = catchUp(managed(fields(20), { autoBuySeeds: true }), 8 * 3600 * 1000)
    expect(back.run.fields.list.every((f) => f.crop !== null)).toBe(true)
  }, 20_000) // 0.5–1.2 s alone; timed out once at 5,148 ms under a loaded full run (batch 30)
})
