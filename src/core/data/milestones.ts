// Identity and predicates only; every threshold number is a count already defined elsewhere
// (tiles, cash tiers excepted — they are the milestone itself). `trackingStarted` is written by the save v12
// migration, never by recordMilestones.
import type { RunState } from '../state'
import { CROPS, CROP_IDS, type CropId } from './crops'
import { PICKAXE_TIERS } from './items'
import { STAR_EMOJI } from './orders'
import { TOOLS, TOOL_JOBS, type ToolJob } from './tools'
import { WORKER_JOBS, type WorkerJob } from './workers'

export type MilestoneId =
  | 'firstHarvest'
  | 'sales25'
  | `first${Capitalize<CropId>}`
  | `license${Capitalize<CropId>}`
  | `tool${Capitalize<ToolJob>}${1 | 2 | 3}`
  | `copper${Capitalize<ToolJob>}`
  | `iron${Capitalize<ToolJob>}`
  | `cert${Capitalize<WorkerJob>}`
  | 'hire2'
  | 'hire4'
  | 'hire6'
  | 'mineLicense'
  | 'vein1'
  | 'vein2'
  | 'vein3'
  | 'vein4'
  | 'furnace'
  | 'workshop'
  | 'firstSprinkler'
  | 'valve'
  | 'fieldsUnlocked'
  | 'firstField'
  | 'fields100'
  | 'fields500'
  | 'harvester1'
  | 'seeder1'
  | 'harvester3'
  | 'firstBar'
  | 'firstGoldBar'
  | 'copperPickaxe'
  | 'ironPickaxe'
  | 'goldPickaxe'
  | 'tiles12'
  | 'tiles16'
  | 'tiles20'
  | 'tiles24'
  | 'cash1k'
  | 'cash10k'
  | 'cash100k'
  | 'cash1M'
  | 'orderBoard'
  | 'firstOrder'
  | 'stars10'
  | 'trackingStarted'

export type Milestone = { id: MilestoneId; label: string; when: (run: RunState) => boolean }

const capitalize = <T extends string>(id: T) => (id[0].toUpperCase() + id.slice(1)) as Capitalize<T>
const pickaxeAt = (run: RunState, tier: number) => PICKAXE_TIERS.indexOf(run.pickaxe?.tier ?? 'wooden') >= tier

export const MILESTONES: readonly Milestone[] = [
  { id: 'firstHarvest', label: 'First harvest', when: (r) => r.counters.harvests >= 1 },
  { id: 'sales25', label: '25 sales', when: (r) => r.counters.sales >= 25 },
  // batch 22: data-driven over CROP_IDS, so the four new crops got theirs with the table (task 114)
  ...CROP_IDS.map((crop): Milestone => ({ id: `first${capitalize(crop)}`, label: `First ${CROPS[crop].name} harvest`, when: (r) => (r.lifetime.harvests[crop] ?? 0) >= 1 })),
  ...CROP_IDS.map((crop): Milestone => ({ id: `license${capitalize(crop)}`, label: `${CROPS[crop].name} license`, when: (r) => r.licenses.includes(crop) })),
  ...TOOL_JOBS.flatMap((job) =>
    TOOLS[job].names.map((name, i): Milestone => ({ id: `tool${capitalize(job)}${(i + 1) as 1 | 2 | 3}`, label: name, when: (r) => r.tools[job] >= i + 1 })),
  ),
  ...TOOL_JOBS.map((job): Milestone => ({ id: `copper${capitalize(job)}`, label: TOOLS[job].tiers[0], when: (r) => r.toolTier[job] >= 1 })),
  ...TOOL_JOBS.map((job): Milestone => ({ id: `iron${capitalize(job)}`, label: TOOLS[job].tiers[1], when: (r) => r.toolTier[job] >= 2 })),
  ...WORKER_JOBS.map((job): Milestone => ({ id: `cert${capitalize(job)}`, label: `${capitalize(job)} certificate`, when: (r) => r.workers.certificates.includes(job) })),
  { id: 'hire2', label: '2 workers', when: (r) => r.workers.pool >= 2 },
  { id: 'hire4', label: '4 workers', when: (r) => r.workers.pool >= 4 },
  { id: 'hire6', label: '6 workers', when: (r) => r.workers.pool >= 6 },
  { id: 'mineLicense', label: 'Mine license', when: (r) => r.mineLicense },
  { id: 'vein1', label: 'Vein Lv1', when: (r) => r.vein.level >= 1 },
  { id: 'vein2', label: 'Vein Lv2', when: (r) => r.vein.level >= 2 },
  { id: 'vein3', label: 'Vein Lv3', when: (r) => r.vein.level >= 3 },
  { id: 'vein4', label: 'Vein Lv4', when: (r) => r.vein.level >= 4 },
  { id: 'furnace', label: 'Furnace', when: (r) => r.furnace.built },
  // batch 17: the workshop itself, the first machine, the smart valve
  { id: 'workshop', label: 'Workshop', when: (r) => r.workshop.built },
  { id: 'firstSprinkler', label: 'First sprinkler', when: (r) => r.workshop.beds.some(Boolean) },
  { id: 'valve', label: 'Smart valve', when: (r) => r.workshop.valve },
  // batch 18: the Fields unlocked, then tile counts
  { id: 'fieldsUnlocked', label: 'Fields unlocked', when: (r) => r.fields.unlocked },
  { id: 'firstField', label: 'First field', when: (r) => r.fields.count >= 1 },
  { id: 'fields100', label: '100 fields', when: (r) => r.fields.count >= 100 },
  { id: 'fields500', label: '500 fields', when: (r) => r.fields.count >= 500 },
  // batch 19: the throughput machines (a tier bought, not just affordable)
  { id: 'harvester1', label: 'Harvester Mk1', when: (r) => r.fields.machines.harvester.includes(1) },
  { id: 'seeder1', label: 'Seeder Mk1', when: (r) => r.fields.machines.seeder.includes(1) },
  { id: 'harvester3', label: 'Harvester Mk3', when: (r) => r.fields.machines.harvester.includes(3) },
  { id: 'firstBar', label: 'First bar', when: (r) => r.lifetime.barsSmelted >= 1 },
  { id: 'firstGoldBar', label: 'First gold bar', when: (r) => r.lifetime.goldBarsSmelted >= 1 },
  { id: 'copperPickaxe', label: 'Copper pickaxe', when: (r) => pickaxeAt(r, 1) },
  { id: 'ironPickaxe', label: 'Iron pickaxe', when: (r) => pickaxeAt(r, 2) },
  { id: 'goldPickaxe', label: 'Gold pickaxe', when: (r) => pickaxeAt(r, 3) },
  { id: 'tiles12', label: '12 tiles', when: (r) => r.tiles.length >= 12 },
  { id: 'tiles16', label: '16 tiles', when: (r) => r.tiles.length >= 16 },
  { id: 'tiles20', label: '20 tiles', when: (r) => r.tiles.length >= 20 },
  { id: 'tiles24', label: '24 tiles', when: (r) => r.tiles.length >= 24 },
  { id: 'cash1k', label: 'Earned 💰1k', when: (r) => r.lifetime.cashEarned >= 1_000 },
  { id: 'cash10k', label: 'Earned 💰10k', when: (r) => r.lifetime.cashEarned >= 10_000 },
  { id: 'cash100k', label: 'Earned 💰100k', when: (r) => r.lifetime.cashEarned >= 100_000 },
  { id: 'cash1M', label: 'Earned 💰1M', when: (r) => r.lifetime.cashEarned >= 1_000_000 },
  // batch 14; the clerk certificate is the certClerk row above (every worker job has one)
  { id: 'orderBoard', label: 'Notice board', when: (r) => r.orders.unlocked },
  { id: 'firstOrder', label: 'First order', when: (r) => r.lifetime.ordersCompleted >= 1 },
  { id: 'stars10', label: `Earned ${STAR_EMOJI}10`, when: (r) => r.lifetime.starsEarned >= 10 },
]

/**
 * Writes the tick of every milestone that just became true between `prev` and `next` and is not recorded yet.
 * A milestone that was already true at `prev` (true since before tracking) stays absent — the timeline shows it
 * as "before tracking", never back-dated. Pure: returns `next` itself when nothing is recorded.
 */
export function recordMilestones(prev: RunState, next: RunState): RunState {
  let milestones = next.milestones
  for (const m of MILESTONES) {
    if (milestones[m.id] !== undefined) continue
    if (m.when(prev) || !m.when(next)) continue
    if (milestones === next.milestones) milestones = { ...milestones }
    milestones[m.id] = next.tick
  }
  return milestones === next.milestones ? next : { ...next, milestones }
}

/** milestones whose predicate is true but were reached before tracking (absent); the timeline shows this count once */
export function earlierMilestones(run: RunState): number {
  return MILESTONES.filter((m) => run.milestones[m.id] === undefined && m.when(run)).length
}
