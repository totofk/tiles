// Identity only; prices, gates, speed and wage live in balance.ts. Plant and mine join later (batch 8 is v1).
export const WORKER_JOBS = ['water', 'harvest'] as const
export type WorkerJob = (typeof WORKER_JOBS)[number]
