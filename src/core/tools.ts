import { fail, harvest, isAmount, plant, water, withRun, type ActionError, type ActionResult } from './actions'
import { toolCost, toolMaxLevel, toolNMax, toolTierCost, toolTierMax, toolUnlock, waterMoisture } from './balance'
import { pay } from './mining'
import type { CropId } from './data/crops'
import type { ToolJob } from './data/tools'
import type { GameState, RunState } from './state'
import { isMature } from './tile'

// A tool press is the job's manual action applied to tiles in priority order, so it costs exactly what the same
// taps would. Level 1 = 1 tile, level 2 = toolCount tiles, level 3 = every eligible tile.

/**
 * ok with done < wanted when energy / seeds / cash ran out part way (stoppedBy = that action's error).
 * bonus = extra crops from copper double harvests, or seeds a copper dibber kept.
 */
export type ToolPress =
  | { ok: true; state: GameState; done: number; wanted: number; stoppedBy: ActionError | null; bonus: number }
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
 * harvest: ripe, longest ripe first. water: growing (not ripe) below what a watering sets, driest first. plant: tilled.
 */
export function toolTargets(state: GameState, job: ToolJob): number[] {
  const { tiles } = state.run
  const full = waterMoisture(state.run.toolTier.water)
  const all = tiles.map((_, i) => i)
  switch (job) {
    case 'harvest':
      return all.filter((i) => isMature(tiles[i], state)).sort((a, b) => tiles[b].ticksSinceMature - tiles[a].ticksSinceMature)
    case 'water':
      return all
        .filter((i) => tiles[i].status === 'planted' && !isMature(tiles[i], state) && tiles[i].moisture < full)
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
  let bonus = 0
  for (const i of targets.slice(0, wanted)) {
    const r = MANUAL[job](s, i, cropId)
    if (!r.ok) {
      stoppedBy = r.error
      break
    }
    bonus += pressBonus(job, s.run, r.state.run, cropId)
    s = r.state
    done++
  }
  return { ok: true, state: s, done, wanted, stoppedBy, bonus }
}

/** a harvest that sold more than 1 crop, or a planting that used neither a pouch seed nor cash (the seed was kept) */
function pressBonus(job: ToolJob, before: RunState, after: RunState, cropId: CropId): number {
  if (job === 'harvest') return after.counters.sales - before.counters.sales - 1
  if (job === 'plant') return after.seeds[cropId] === before.seeds[cropId] && after.cash === before.cash ? 1 : 0
  return 0
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

// The job's next material tier (Shop): copper, then iron; tier t needs tier t − 1, so copper needs the job's tool Lv1.
// Order: ALREADY_OWNED, LOCKED, NOT_ENOUGH_ITEMS, NO_CASH.
export function buyToolTier(state: GameState, job: ToolJob): ActionResult {
  const { run } = state
  const tier = run.toolTier[job]
  if (tier >= toolTierMax(job)) return fail('ALREADY_OWNED')
  if (run.tools[job] < 1) return fail('LOCKED')
  return pay(state, toolTierCost(tier + 1, state.meta), { toolTier: { ...run.toolTier, [job]: tier + 1 } })
}

/** sets level-2 tiles per press; n must be a whole number in 1 … toolNMax(tiles) */
export function setToolN(state: GameState, job: ToolJob, n: number): ActionResult {
  const { run } = state
  if (!isAmount(n) || n > toolNMax(run.tiles.length)) return fail('BAD_AMOUNT')
  return withRun(state, { toolN: { ...run.toolN, [job]: n } })
}
