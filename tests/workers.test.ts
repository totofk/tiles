import { describe, expect, it } from 'vitest'
import type { ActionResult } from '../src/core/actions'
import { certificateCost, certificateUnlock, workerHireCost, workerHireUnlock, workerPoolCap } from '../src/core/balance'
import { createInitialState, type Counters, type GameState } from '../src/core/state'
import { assignWorker, buyCertificate, certificateUnlocked, freeWorkers, hireUnlocked, hireWorker } from '../src/core/workers'

const init = createInitialState()
const meta = init.meta

function withRun(run: Partial<GameState['run']>, counters: Partial<Counters> = {}): GameState {
  return { ...init, run: { ...init.run, ...run, counters: { ...init.run.counters, ...counters } } }
}

function okState(r: ActionResult): GameState {
  if (!r.ok) throw new Error(`expected ok, got ${r.error}`)
  return r.state
}

const workers = (pool: number, water = 0, harvest = 0, certificates: ('water' | 'harvest')[] = ['water', 'harvest']) => ({
  workers: { pool, assigned: { water, harvest }, certificates },
})

describe('workers: balance', () => {
  it('hire k costs 80 × 1.7^(k − 1), pool cap 6, hiring unlocks at 30 harvests', () => {
    expect([0, 1, 2, 3, 4, 5].map((pool) => workerHireCost(pool, meta))).toEqual([80, 136, 231, 393, 668, 1136])
    expect(workerPoolCap()).toBe(6)
    expect(workerHireUnlock()).toEqual({ counter: 'harvests', at: 30 })
  })

  it('certificates: water 💰100 after 40 waters, harvest 💰150 + 20 stone after 40 harvests', () => {
    expect(certificateCost('water', meta)).toEqual({ cash: 100 })
    expect(certificateCost('harvest', meta)).toEqual({ stone: 20, cash: 150 })
    expect(certificateUnlock('water')).toEqual({ counter: 'waters', at: 40 })
    expect(certificateUnlock('harvest')).toEqual({ counter: 'harvests', at: 40 })
  })
})

describe('hireWorker', () => {
  it('is LOCKED until 30 harvests, then adds one to the pool for its price, no energy', () => {
    expect(hireUnlocked(withRun({ cash: 1000 }, { harvests: 29 }).run)).toBe(false)
    expect(hireWorker(withRun({ cash: 1000 }, { harvests: 29 }))).toEqual({ ok: false, error: 'LOCKED' })
    const s = withRun({ cash: 300 }, { harvests: 30 })
    const one = okState(hireWorker(s))
    expect([one.run.cash, one.run.workers.pool, one.run.energy]).toEqual([220, 1, s.run.energy])
    const two = okState(hireWorker(one))
    expect([two.run.cash, two.run.workers.pool]).toEqual([84, 2])
    expect(hireWorker(two)).toEqual({ ok: false, error: 'NO_CASH' })
  })

  it('stops at the pool cap with POOL_FULL before checking cash', () => {
    const s = withRun({ cash: 0, ...workers(6) }, { harvests: 30 })
    expect(hireWorker(s)).toEqual({ ok: false, error: 'POOL_FULL' })
  })
})

describe('buyCertificate', () => {
  it('water: LOCKED below 40 waters, then 💰100 once', () => {
    expect(buyCertificate(withRun({ cash: 500 }, { waters: 39 }), 'water')).toEqual({ ok: false, error: 'LOCKED' })
    const s = withRun({ cash: 500 }, { waters: 40 })
    expect(certificateUnlocked(s.run, 'water')).toBe(true)
    const next = okState(buyCertificate(s, 'water'))
    expect([next.run.cash, next.run.workers.certificates]).toEqual([400, ['water']])
    expect(buyCertificate(next, 'water')).toEqual({ ok: false, error: 'ALREADY_OWNED' })
  })

  it('harvest: 💰150 + 20 stone, NOT_ENOUGH_ITEMS before NO_CASH', () => {
    const s = withRun({ cash: 150, inventory: { stone: 19 } }, { harvests: 40 })
    expect(buyCertificate(s, 'harvest')).toEqual({ ok: false, error: 'NOT_ENOUGH_ITEMS' })
    const broke = withRun({ cash: 149, inventory: { stone: 20 } }, { harvests: 40 })
    expect(buyCertificate(broke, 'harvest')).toEqual({ ok: false, error: 'NO_CASH' })
    const next = okState(buyCertificate({ ...s, run: { ...s.run, inventory: { stone: 25 } } }, 'harvest'))
    expect([next.run.cash, next.run.inventory.stone, next.run.workers.certificates]).toEqual([0, 5, ['harvest']])
  })
})

describe('assignWorker', () => {
  it('+1 needs the certificate, then a free worker; −1 frees one', () => {
    const s = withRun(workers(2, 0, 0, []))
    expect(assignWorker(s, 'water', 1)).toEqual({ ok: false, error: 'NO_CERTIFICATE' })
    const certified = withRun(workers(2, 0, 0, ['water']))
    const one = okState(assignWorker(certified, 'water', 1))
    const two = okState(assignWorker(one, 'water', 1))
    expect([two.run.workers.assigned, freeWorkers(two.run)]).toEqual([{ water: 2, harvest: 0 }, 0])
    expect(assignWorker(two, 'water', 1)).toEqual({ ok: false, error: 'NO_FREE_WORKER' })
    const back = okState(assignWorker(two, 'water', -1))
    expect([back.run.workers.assigned.water, freeWorkers(back.run)]).toEqual([1, 1])
    expect(assignWorker(certified, 'harvest', -1)).toEqual({ ok: false, error: 'NOTHING_TO_DO' })
  })

  it('a worker moves between jobs through the free pool', () => {
    const s = withRun(workers(1, 1, 0))
    expect(assignWorker(s, 'harvest', 1)).toEqual({ ok: false, error: 'NO_FREE_WORKER' })
    const moved = okState(assignWorker(okState(assignWorker(s, 'water', -1)), 'harvest', 1))
    expect(moved.run.workers.assigned).toEqual({ water: 0, harvest: 1 })
  })
})

describe('new runs', () => {
  it('start with no workers, no certificates, no wages paid and auto-smelt off', () => {
    expect(init.run.workers).toEqual({ pool: 0, assigned: { water: 0, harvest: 0 }, certificates: [] })
    expect([init.run.lifetime.wagesPaid, init.run.autoSmelt, freeWorkers(init.run)]).toEqual([0, false, 0])
  })
})
