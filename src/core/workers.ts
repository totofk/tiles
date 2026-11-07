import { fail, harvest, plant, till, water, withRun, type ActionResult } from './actions'
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
// step ↔ workers is a cycle of function bindings only (hoisted, used at call time), so module order does not matter
import { step } from './step'
import { toolTargets } from './tools'

/**
 * The job's own action (so its copper tier applies), with no player energy. Plant = the player's tap on an empty tile:
 * till it, else plant "Crop to plant" with the pouch and auto-buy rules (and the copper dibber's seed-keep).
 */
const WORK: Record<TileJob, (s: GameState, i: number) => ActionResult> = {
  plant: (s, i) => (s.run.tiles[i].status === 'untilled' ? till(s, i, 0) : plant(s, i, s.run.plantCrop, 0)),
  water: (s, i) => water(s, i, 0),
  harvest: (s, i) => harvest(s, i, 0),
}
export type TileJob = 'plant' | 'water' | 'harvest'
const isTileJob = (job: WorkerJob): job is TileJob => job in WORK

/**
 * Ore loader: collects the tray into storage when it has bars and storage has room, else loads one cycle of the
 * furnace's ore kind (ore × batch) when storage has it and the slot has room. Fuel loader: adds one coal when the fire has room for it
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
    return (run.inventory[f.oreKind] ?? 0) >= need && oreSlotCap() - f.ore >= need ? loadOre(s, need) : null
  },
  fuel: (s) => {
    const f = s.run.furnace
    return f.built && fuelRoom(f, 'coal') >= 1 && (s.run.inventory.coal ?? 0) >= 1 ? addFuel(s, 'coal', 1) : null
  },
}

/**
 * Tiles a worker of this job acts on, best first: the tool's targets, but a waterer only waters a tile that would run
 * dry before its next turn, so a copper can (moisture 2) halves its actions and wages (DECISIONS "Workers v1"). A
 * planter takes the tilled tiles first, then the untilled ones; when the first cannot be planted (no seed, no cash)
 * it idles rather than tilling ahead.
 */
function jobTiles(state: GameState, job: TileJob): number[] {
  const targets = toolTargets(state, job)
  if (job === 'plant') return [...targets, ...state.run.tiles.flatMap((t, i) => (t.status === 'untilled' ? [i] : []))]
  if (job !== 'water') return targets
  const due = workerActionTicks() * moistureDrainPerTick(state.meta)
  return targets.filter((i) => state.run.tiles[i].moisture <= due)
}

/** the next action of a worker on this job and the tile it touches (none for furnace jobs); null = nothing to do */
function workerAction(state: GameState, job: WorkerJob): { result: ActionResult; tile?: number } | null {
  if (!isTileJob(job)) {
    const result = FURNACE_WORK[job](state)
    return result && { result }
  }
  const [tile] = jobTiles(state, job)
  return tile === undefined ? null : { result: WORK[job](state, tile), tile }
}

/** a farm worker's action on a tile */
export type WorkerTarget = { job: TileJob; tile: number }

/** the worker's action, or null when it has nothing to do or the wage would not be left after it (a bought seed) */
function paidAction(state: GameState, job: WorkerJob): { result: { ok: true; state: GameState }; tile?: number } | null {
  const a = workerAction(state, job)
  return a?.result.ok && a.result.state.run.cash >= workerWage(state.meta) ? { result: a.result, tile: a.tile } : null
}

/**
 * One round of every assigned worker, job by job in WORKER_JOBS order, each paying the wage at its action; a worker
 * with nothing to do idles unpaid, and the round stops when cash < wage (never debt). A planter whose seed would leave
 * less than the wage idles too. `touched` = each farm worker's tile, in action order. Returns the same state object
 * when nobody acts.
 */
function workRound(state: GameState): { state: GameState; touched: WorkerTarget[] } {
  const wage = workerWage(state.meta)
  const touched: WorkerTarget[] = []
  let s = state
  for (const job of WORKER_JOBS) {
    for (let k = 0; k < s.run.workers.assigned[job]; k++) {
      if (s.run.cash < wage) return { state: s, touched }
      const a = paidAction(s, job)
      if (!a) break
      if (a.tile !== undefined && isTileJob(job)) touched.push({ job, tile: a.tile })
      const { run } = a.result.state
      const lifetime = {
        ...run.lifetime,
        wagesPaid: run.lifetime.wagesPaid + wage,
        workerPlants: run.lifetime.workerPlants + run.counters.plants - s.run.counters.plants,
      }
      s = { ...a.result.state, run: { ...run, cash: run.cash - wage, lifetime } }
    }
  }
  return { state: s, touched }
}

/** ticks until the workers' next action tick (0 = the next step acts) */
export function ticksUntilWorkers(run: RunState): number {
  const every = workerActionTicks()
  return (every - (run.tick % every)) % every
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
 * The tile each farm worker's next action will touch (task 60, shown as a ring), assuming no player input until then:
 * the state is stepped to the next action tick and the same round workersAct runs is played on it, so two workers on
 * one job, cash running out mid-round and the waterer's "due" rule all match. Derived, never saved.
 */
export function workerTargets(state: GameState): WorkerTarget[] {
  const { assigned } = state.run.workers
  if (assigned.plant + assigned.water + assigned.harvest === 0) return []
  return workRound(step(state, ticksUntilWorkers(state.run))).touched
}

/**
 * A worker on this job has work but no money for it (the "unpaid" badge): its wage, before or (a bought seed) after
 * the action, or the seed itself (NO_CASH). No seed with auto-buy off is plain idle, not unpaid.
 */
export function workerUnpaid(state: GameState, job: WorkerJob): boolean {
  if (state.run.workers.assigned[job] < 1) return false
  const a = workerAction(state, job)
  if (!a) return false
  if (!a.result.ok) return a.result.error === 'NO_CASH'
  return state.run.cash < workerWage(state.meta) || !paidAction(state, job)
}

/**
 * Runs at the start of a tick, before moisture drains and before the furnace burns, so a tile the player just watered
 * (full) or harvested (no longer ripe) is never a target. On every workerActionTicks-th tick each assigned worker does
 * one action (workRound: till or plant an empty tile / driest due tile / ripe longest / collect or load ore / one coal), paying the wage at that
 * moment. Nothing to do or cash < wage = it idles, no charge; never debt.
 */
export function workersAct(state: GameState): GameState {
  if (state.run.tick % workerActionTicks() !== 0) return state
  return workRound(state).state
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
