import { fail, harvest, isAmount, plant, water, withRun, type ActionError, type ActionResult } from './actions'
import { toolCost, toolMaxLevel, toolNMax, toolUnlock } from './balance'
import type { CropId } from './data/crops'
import type { ToolJob } from './data/tools'
import type { GameState, RunState } from './state'
import { isMature } from './tile'

// A tool press is the job's manual action applied to tiles in priority order, so it costs exactly what the same
// taps would. Level 1 = 1 tile, level 2 = toolCount tiles, level 3 = every eligible tile.

/** ok with done < wanted when energy / seeds / cash ran out part way (stoppedBy = that action's error) */
export type ToolPress =
  | { ok: true; state: GameState; done: number; wanted: number; stoppedBy: ActionError | null }
  | { ok: false; error: ActionError }

const MANUAL: Record<ToolJob, (s: GameState, i: number, cropId: CropId) => ActionResult> = {
  water: (s, i) => water(s, i),
  harvest: (s, i) => harvest(s, i),
  plant,
}

/** tiles per press at level 2; clamped to 1 … toolNMax(tiles) on read, so a tile-count change never breaks it */
export function toolCount(run: RunState, job: ToolJob): number {
  return Math.min(Math.max(1, run.toolN[job]), toolNMax(run.tiles.length))
}

/**
 * Tile indexes the job may act on, best first; ties keep tile order (sort is stable).
 * harvest: ripe, longest ripe first. water: growing (not ripe) with moisture < 1, driest first. plant: tilled.
 */
export function toolTargets(state: GameState, job: ToolJob): number[] {
  const { tiles } = state.run
  const all = tiles.map((_, i) => i)
  switch (job) {
    case 'harvest':
      return all.filter((i) => isMature(tiles[i], state)).sort((a, b) => tiles[b].ticksSinceMature - tiles[a].ticksSinceMature)
    case 'water':
      return all
        .filter((i) => tiles[i].status === 'planted' && !isMature(tiles[i], state) && tiles[i].moisture < 1)
        .sort((a, b) => tiles[a].moisture - tiles[b].moisture)
    case 'plant':
      return all.filter((i) => tiles[i].status === 'tilled')
  }
}

// Validates in this order: LOCKED (no tool), NOTHING_TO_DO (no eligible tile, costs nothing), then per tile.
export function pressTool(state: GameState, job: ToolJob, cropId: CropId): ToolPress {
  const level = state.run.tools[job]
  if (level < 1) return { ok: false, error: 'LOCKED' }
  const targets = toolTargets(state, job)
  if (targets.length === 0) return { ok: false, error: 'NOTHING_TO_DO' }
  const wanted = level === 1 ? 1 : level === 2 ? Math.min(toolCount(state.run, job), targets.length) : targets.length
  let s = state
  let done = 0
  let stoppedBy: ActionError | null = null
  for (const i of targets.slice(0, wanted)) {
    const r = MANUAL[job](s, i, cropId)
    if (!r.ok) {
      stoppedBy = r.error
      break
    }
    s = r.state
    done++
  }
  return { ok: true, state: s, done, wanted, stoppedBy }
}

// Buys the next level only (level k needs k − 1), once; the job's counter must reach that level's threshold.
// Shop actions cost no energy.
export function buyTool(state: GameState, job: ToolJob): ActionResult {
  const { run } = state
  const level = run.tools[job]
  if (level >= toolMaxLevel(job)) return fail('MAX_LEVEL')
  const { counter, at } = toolUnlock(job, level + 1)
  if (run.counters[counter] < at) return fail('LOCKED')
  const cost = toolCost(job, level + 1, state.meta)
  if (run.cash < cost) return fail('NO_CASH')
  return withRun(state, { cash: run.cash - cost, tools: { ...run.tools, [job]: level + 1 } })
}

/** sets level-2 tiles per press; n must be a whole number in 1 … toolNMax(tiles) */
export function setToolN(state: GameState, job: ToolJob, n: number): ActionResult {
  const { run } = state
  if (!isAmount(n) || n > toolNMax(run.tiles.length)) return fail('BAD_AMOUNT')
  return withRun(state, { toolN: { ...run.toolN, [job]: n } })
}
