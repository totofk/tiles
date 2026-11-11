import {
  doubleHarvestChance,
  energyMax,
  energyRegenPerTick,
  fireUnitTicks,
  growTimeFactor,
  masteredPreserveBonus,
  masteryLevel,
  multiplier,
  seedKeepChance,
  sellPriceFactor,
  waterMoisture,
} from './balance'
import { CROPS, CROP_IDS } from './data/crops'
import { PICKAXE_NAMES } from './data/items'
import { MILESTONES, earlierMilestones } from './data/milestones'
import { STAR_EMOJI } from './data/orders'
import { TOOLS, TOOL_JOBS, tierName, type ToolJob } from './data/tools'
import { UPGRADES } from './data/upgrades'
import { dropText, expectedUses, pickaxePreserve } from './mining'
import type { CounterId, GameState, RunState } from './state'
import { toolCount } from './tools'
import { HIDDEN_JOBS, WORKER_JOBS } from './data/workers'
import { freeWorkers } from './workers'

const SHOWN_JOBS = WORKER_JOBS.filter((job) => !HIDDEN_JOBS.includes(job))

/** one Stats tab line; `source` = what sets the value (an upgrade level, mastery, …) */
export type StatRow = { label: string; value: string; source?: string }
export type Stats = { totals: StatRow[]; multipliers: StatRow[] }

/** shown counters */
const COUNTER_LABELS: Record<CounterId, string> = {
  harvests: 'Harvests',
  sales: 'Items sold',
  mines: 'Mine actions',
  digs: 'Soil digs',
  waters: 'Waterings',
  plants: 'Plantings',
  bars: 'Copper bars collected',
  orders: 'Orders completed',
  contractsByHand: 'Contracts delivered by hand',
}

const times = (f: number) => `×${Math.round(f * 100) / 100}`
const pct = (f: number) => `${Math.round(f * 100)} %`

/** what the job's material tier does to each of its actions */
const TIER_EFFECT: Record<ToolJob, (tier: number) => string> = {
  water: (t) => `waters to ${waterMoisture(t)} (${times(waterMoisture(t) / waterMoisture(0))} moist time)`,
  harvest: (t) => `${pct(doubleHarvestChance(t))} double harvest`,
  plant: (t) => `${pct(seedKeepChance(t))} seed kept`,
}

/** "1h 02m 05s" */
function duration(ticks: number): string {
  const h = Math.floor(ticks / 3600)
  const m = Math.floor((ticks % 3600) / 60)
  const s = ticks % 60
  const two = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}h ${two(m)}m ${two(s)}s` : `${m}m ${two(s)}s`
}

/**
 * Everything the 📊 Stats tab shows, computed by the same balance functions the game uses, so the tab can never
 * disagree with play. (a) lifetime totals, (b) current values with their source.
 */
export function stats(state: GameState): Stats {
  const { run, meta } = state
  const { lifetime, upgrades } = run
  const lv = (id: keyof typeof upgrades) => `${UPGRADES[id].name} Lv${upgrades[id]}`
  // a save migrated from before v6 with several licenses has harvests no crop was credited with
  const tracked = Object.values(lifetime.harvests).reduce((sum, n) => sum + (n ?? 0), 0)
  const since = tracked < run.counters.harvests ? ' since v6' : ''

  const totals: StatRow[] = [
    { label: 'Time played', value: duration(run.tick) },
    { label: 'Cash earned', value: `💰${Math.round(lifetime.cashEarned)}` },
    { label: 'Energy spent', value: `⚡${lifetime.energySpent}` },
    ...(Object.keys(COUNTER_LABELS) as (keyof typeof COUNTER_LABELS)[]).map((id) => ({ label: COUNTER_LABELS[id], value: `${run.counters[id]}` })),
    ...CROP_IDS.filter((id) => run.licenses.includes(id)).map((id) => ({
      label: `${CROPS[id].name} harvests${since}`,
      value: `${lifetime.harvests[id] ?? 0}`,
    })),
    { label: 'Copper bars smelted', value: `${lifetime.barsSmelted}` },
    { label: 'Iron bars smelted', value: `${lifetime.ironBarsSmelted}` },
    { label: 'Iron bars collected', value: `${lifetime.ironBars}` },
    { label: 'Gold bars smelted', value: `${lifetime.goldBarsSmelted}` },
    { label: 'Gold bars collected', value: `${lifetime.goldBars}` },
    // fire units burnt with no cycle progressing (a plain furnace lit with no ore or a full tray)
    { label: 'Fire wasted', value: `${Math.ceil(lifetime.fireWasted / fireUnitTicks())} units` },
    { label: 'Wages paid', value: `💰${lifetime.wagesPaid}` },
    { label: 'Plants by workers', value: `${lifetime.workerPlants}` },
    { label: 'Mines by workers', value: `${lifetime.workerMines}` },
    { label: `${STAR_EMOJI} earned`, value: `${lifetime.starsEarned}` },
  ]
  const { pool, assigned } = run.workers

  const pickaxe = run.pickaxe
  const multipliers: StatRow[] = [
    { label: 'Sell price', value: times(sellPriceFactor(upgrades.sellPrice) * multiplier(meta, 'sellPrice')), source: lv('sellPrice') },
    { label: 'Grow time', value: times(growTimeFactor(upgrades.fertilizer) * multiplier(meta, 'growTime')), source: lv('fertilizer') },
    { label: 'Energy max', value: `${energyMax(upgrades.energyMax, meta)}`, source: lv('energyMax') },
    { label: 'Energy regen', value: `${energyRegenPerTick(upgrades.energyRegen, meta).toFixed(2)}/s`, source: lv('energyRegen') },
    pickaxe
      ? {
          label: `${PICKAXE_NAMES[pickaxe.tier]} preserve`,
          value: `${pct(pickaxePreserve(pickaxe.tier, run))} · lasts ~${Math.round(expectedUses(pickaxe.tier, run))} uses`,
          source: `mastery Lv${masteryLevel(pickaxe.tier, run.mastery[pickaxe.tier] ?? 0)} + ${run.masteredTiers.length} mastered × ${pct(masteredPreserveBonus())}`,
        }
      : { label: 'Pickaxe preserve', value: 'no pickaxe' },
    { label: 'Storage', value: `${run.bagCapacity} slots`, source: `Storage Lv${run.storageLevel}` },
    ...TOOL_JOBS.map((job) => {
      const level = run.tools[job]
      const perPress = ['1 tile', `${toolCount(run, job)} tiles`, 'all tiles'][level - 1]
      const label = `${job[0].toUpperCase()}${job.slice(1)} tool`
      return level ? { label, value: `${perPress} per press`, source: TOOLS[job].names[level - 1] } : { label, value: 'none' }
    }),
    ...TOOL_JOBS.map((job) => {
      const tier = run.toolTier[job]
      const label = `${job[0].toUpperCase()}${job.slice(1)} tier`
      return { label, value: TIER_EFFECT[job](tier), source: tierName(job, tier) }
    }),
    { label: 'Drop table', value: dropText(run.vein.level), source: `Vein Lv${run.vein.level}` },
    {
      label: 'Workers',
      value: `${pool} hired · ${freeWorkers(run)} free`,
      source: SHOWN_JOBS.map((job) => `${job} ${assigned[job]}`).join(' · '),
    },
  ]
  return { totals, multipliers }
}

/** "1h 12m" / "4m": play time on a timeline line */
function playTime(ticks: number): string {
  const h = Math.floor(ticks / 3600)
  const m = Math.floor((ticks % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

/**
 * The 📊 Stats timeline: "Lemon license — 1h 12m" per recorded milestone, by tick (play time from tick 0), led by
 * one "… N earlier milestones before tracking" line when a migrated save (the only kind with trackingStarted) had
 * reached some before v12. A new run has none: what it starts with (the carrot license) is not a milestone reached.
 */
export function timelineLines(run: RunState): string[] {
  const since = run.milestones.trackingStarted
  const earlier = since === undefined ? 0 : earlierMilestones(run)
  const head = earlier
    ? [`… ${earlier} earlier milestone${earlier === 1 ? '' : 's'} before tracking (tracking since ${playTime(since!)})`]
    : []
  const reached = MILESTONES.flatMap((m) => {
    const tick = run.milestones[m.id]
    return tick === undefined ? [] : [{ tick, line: `${m.label} — ${playTime(tick)}` }]
  })
  return [...head, ...reached.sort((a, b) => a.tick - b.tick).map((r) => r.line)]
}

/** One plain-text line about the run for a feedback report (never the save). */
export function feedbackSummary(state: GameState): string {
  const { run } = state
  const { furnace, workers, pickaxe } = run
  return [
    `cash ${Math.floor(run.cash)}`,
    `licenses ${run.licenses.join(', ')}`,
    `tools ${TOOL_JOBS.map((job) => `${job} Lv${run.tools[job]} tier ${run.toolTier[job]}`).join(', ')}`,
    `pickaxe ${pickaxe ? `${pickaxe.tier} ${pickaxe.durability}` : 'none'}`,
    `workers ${workers.pool} (${SHOWN_JOBS.map((job) => `${job} ${workers.assigned[job]}`).join(', ')})`,
    `vein Lv${run.vein.level}`,
    `furnace ${furnace.built ? `${furnace.smart ? 'smart' : 'plain'} fire Lv${furnace.levels.fireCap} batch Lv${furnace.levels.batch}` : 'none'}`,
    `played ${duration(run.tick)}`,
  ].join(' · ')
}
