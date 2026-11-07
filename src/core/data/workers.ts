// Identity only; prices, gates, speed and wage live in balance.ts. Farm jobs (batch 8), furnace loaders (batch 9);
// plant and mine join later.
export const WORKER_JOBS = ['water', 'harvest', 'ore', 'fuel'] as const
export type WorkerJob = (typeof WORKER_JOBS)[number]
