// Identity only; unlock counters and prices live in balance.ts.
export const TOOL_JOBS = ['water', 'harvest', 'plant'] as const
export type ToolJob = (typeof TOOL_JOBS)[number]

/** tool name per level (index 0 = level 1) and the name of the job's copper tier */
export const TOOLS: Record<ToolJob, { names: readonly [string, string, string]; copper: string }> = {
  water: { names: ['Watering Can', 'Garden Hose', 'Water Cart'], copper: 'Copper Can' },
  harvest: { names: ['Sickle', 'Scythe', 'Reaper'], copper: 'Copper Sickle' },
  plant: { names: ['Dibber', 'Seed Drill', 'Seed Spreader'], copper: 'Copper Dibber' },
}
