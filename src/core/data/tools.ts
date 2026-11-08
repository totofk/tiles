// Identity only; unlock counters and prices live in balance.ts.
export const TOOL_JOBS = ['water', 'harvest', 'plant'] as const
export type ToolJob = (typeof TOOL_JOBS)[number]

/** tool name per level (index 0 = level 1) and per material tier (index 0 = tier 1: copper, iron) */
export const TOOLS: Record<ToolJob, { names: readonly [string, string, string]; tiers: readonly [string, string] }> = {
  water: { names: ['Watering Can', 'Garden Hose', 'Water Cart'], tiers: ['Copper Can', 'Iron Can'] },
  harvest: { names: ['Sickle', 'Scythe', 'Reaper'], tiers: ['Copper Sickle', 'Iron Sickle'] },
  plant: { names: ['Dibber', 'Seed Drill', 'Seed Spreader'], tiers: ['Copper Dibber', 'Iron Dibber'] },
}

/** the name of a job's material tier (0 = basic) */
export const tierName = (job: ToolJob, tier: number): string => (tier ? TOOLS[job].tiers[tier - 1] : 'basic')
