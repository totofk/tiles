import { fail, harvest, water, withRun, type ActionResult } from './actions'
import {
  certificateCost,
  certificateUnlock,
  moistureDrainPerTick,
  oreSlotCap,
  workerActionTicks,
  workerHireCost,
  workerHireUnlock,
  workerPoolCap,
  workerWage,
} from './balance'
import { WORKER_JOBS, type WorkerJob } from './data/workers'
import { addFuel, collectBars, cycleOre, fuelRoom, loadOre } from './furnace'
import { pay } from './mining'
import type { GameState, RunState } from './state'
import { toolTargets } from './tools'

/** the job's own action (so its copper tier applies), with no player energy */
const WORK: Record<TileJob, (s: GameState, i: number) => ActionResult> = {
  water: (s, i) => water(s, i, 0),
  harvest: (s, i) => harvest(s, i, 0),
}
type TileJob = 'water' | 'harvest'
const isTileJob = (job: WorkerJob): job is TileJob => job in WORK

/**
 * Ore loader: collects the tray into storage when it has bars and storage has room, else loads one cycle of ore
 * (ore × batch) when storage has it and the slot has room. Fuel loader: adds one coal when the fire has room for it
 * (coal only: wood stays for pickaxe repairs). null = nothing to do, so the worker idles unpaid.
 */
const FURNACE_WORK: Record<Exclude<WorkerJob, TileJob>, (s: GameState) => ActionResult | null> = {
  ore: (s) => {
    const { run } = s
    const f = run.furnace
    if (!f.built) return null
    const collected = f.ready > 0 ? collectBars(s) : null
    if (collected?.ok) return collected
    const need = cycleOre(f)
    return (run.inventory.copperOre ?? 0) >= need && oreSlotCap() - f.ore >= need ? loadOre(s, need) : null
  },
  fuel: (s) => {
    const f = s.run.furnace
    return f.built && fuelRoom(f, 'coal') >= 1 && (s.run.inventory.coal ?? 0) >= 1 ? addFuel(s, 'coal', 1) : null
  },
}

/** the next action of a worker on this job; null when it has nothing to do */
function workerAction(state: GameState, job: WorkerJob): ActionResult | null {
  if (!isTileJob(job)) return FURNACE_WORK[job](state)
  const [i] = workerTargets(state, job)
  return i === undefined ? null : WORK[job](state, i)
}

// Workers (batch 8, furnace loaders batch 9): hire into a pool, buy a job's certificate, assign pool workers to
// certified jobs. Hiring and certificates are shop actions (no energy).

/** hired workers not assigned to any job */
export function freeWorkers(run: RunState): number {
  return run.workers.pool - WORKER_JOBS.reduce((n, job) => n + run.workers.assigned[job], 0)
}

/** the hire button shows (and hiring works) once the unlock counter is reached */
export function hireUnlocked(run: RunState): boolean {
  const { counter, at } = workerHireUnlock()
  return run.counters[counter] >= at
}

/** the job's certificate shows (and can be bought) once its unlock counter is reached */
export function certificateUnlocked(run: RunState, job: WorkerJob): boolean {
  const { counter, at } = certificateUnlock(job)
  return run.counters[counter] >= at
}

// Order: LOCKED, POOL_FULL, NO_CASH.
export function hireWorker(state: GameState): ActionResult {
  const { run } = state
  if (!hireUnlocked(run)) return fail('LOCKED')
  if (run.workers.pool >= workerPoolCap()) return fail('POOL_FULL')
  const cost = workerHireCost(run.workers.pool, state.meta)
  if (run.cash < cost) return fail('NO_CASH')
  return withRun(state, { cash: run.cash - cost, workers: { ...run.workers, pool: run.workers.pool + 1 } })
}

// Order: ALREADY_OWNED, LOCKED, NOT_ENOUGH_ITEMS, NO_CASH.
export function buyCertificate(state: GameState, job: WorkerJob): ActionResult {
  const { run } = state
  if (run.workers.certificates.includes(job)) return fail('ALREADY_OWNED')
  if (!certificateUnlocked(run, job)) return fail('LOCKED')
  return pay(state, certificateCost(job, state.meta), { workers: { ...run.workers, certificates: [...run.workers.certificates, job] } })
}

/**
 * Tiles a worker of this job acts on, best first: the tool's targets, but a waterer only waters a tile that would run
 * dry before its next turn, so a copper can (moisture 2) halves its actions and wages (DECISIONS "Workers v1").
 */
export function workerTargets(state: GameState, job: TileJob): number[] {
  const targets = toolTargets(state, job)
  if (job !== 'water') return targets
  const due = workerActionTicks() * moistureDrainPerTick(state.meta)
  return targets.filter((i) => state.run.tiles[i].moisture <= due)
}

/** a worker on this job would act now but cannot pay its wage (the UI's "unpaid" badge) */
export function workerUnpaid(state: GameState, job: WorkerJob): boolean {
  return state.run.workers.assigned[job] > 0 && state.run.cash < workerWage(state.meta) && !!workerAction(state, job)?.ok
}

/**
 * Runs at the start of a tick, before moisture drains and before the furnace burns, so a tile the player just watered
 * (full) or harvested (no longer ripe) is never a target. On every workerActionTicks-th tick each assigned worker, job
 * by job in WORKER_JOBS order, does one action (workerAction: driest due tile / ripe longest / collect or load ore /
 * one coal), paying the wage at that moment. Nothing to do or cash < wage = it idles, no charge; never debt.
 */
export function workersAct(state: GameState): GameState {
  if (state.run.tick % workerActionTicks() !== 0) return state
  const wage = workerWage(state.meta)
  let s = state
  for (const job of WORKER_JOBS) {
    for (let k = 0; k < s.run.workers.assigned[job]; k++) {
      if (s.run.cash < wage) return s
      const r = workerAction(s, job)
      if (!r?.ok) break
      const { run } = r.state
      s = { ...r.state, run: { ...run, cash: run.cash - wage, lifetime: { ...run.lifetime, wagesPaid: run.lifetime.wagesPaid + wage } } }
    }
  }
  return s
}

// +1 takes a free worker onto the job (NO_CERTIFICATE, NO_FREE_WORKER); −1 frees one (NOTHING_TO_DO at 0). Free.
export function assignWorker(state: GameState, job: WorkerJob, delta: 1 | -1): ActionResult {
  const { workers } = state.run
  const n = workers.assigned[job]
  if (delta === 1) {
    if (!workers.certificates.includes(job)) return fail('NO_CERTIFICATE')
    if (freeWorkers(state.run) < 1) return fail('NO_FREE_WORKER')
  } else if (n < 1) return fail('NOTHING_TO_DO')
  return withRun(state, { workers: { ...workers, assigned: { ...workers.assigned, [job]: n + delta } } })
}
