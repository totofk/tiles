// Identity only; prices, gates, speed and wage live in balance.ts. Farm jobs in farm-loop order (plant batch 10, water +
// harvest batch 8), then the furnace loaders (batch 9), then the miner (batch 11); this is also the order they act in
// and the Workers card's rows.
export const WORKER_JOBS = ['plant', 'water', 'harvest', 'ore', 'fuel', 'mine'] as const
export type WorkerJob = (typeof WORKER_JOBS)[number]
