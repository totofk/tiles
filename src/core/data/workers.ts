// Identity only; prices, gates, speed and wage live in balance.ts. Farm jobs in farm-loop order (plant batch 10, water +
// harvest batch 8), then the furnace loaders (batch 9), then the miner (batch 11), then the order clerk (batch 14),
// then the Manager (batch 28 shape, batch 29 work), then the Stoker (batch 34, appended so every other job keeps its
// action order); this is also the order they act in and the Workers card's rows.
export const WORKER_JOBS = ['plant', 'water', 'harvest', 'ore', 'fuel', 'mine', 'clerk', 'manager', 'stoker'] as const
export type WorkerJob = (typeof WORKER_JOBS)[number]
/** jobs the UI does not show yet (the Workers card rows, the certificate milestone rows); empty since batch 29 */
export const HIDDEN_JOBS: readonly WorkerJob[] = []
