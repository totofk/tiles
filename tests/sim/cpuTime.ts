/// <reference types="node" />
import { cpuUsage } from 'node:process'

/**
 * CPU milliseconds (user + system) this process spends inside `run`.
 *
 * The offline perf pins (PIN18g / PIN19e / PIN22d / PIN28perf) used to time `catchUp` with `Date.now()`. Wall-clock
 * time grows with whatever else holds the CPU — the parallel unit files, the next sim file's collection, another
 * process — so a 1.0 s catch-up read 2.7–6.2 s under load and the 2,000 ms bar flaked (batch 40, task 273). CPU time
 * only counts the time this process is scheduled, so the bar measures the code, not the machine's load.
 *
 * Valid under Vitest's default `forks` pool (one test file per process). Under `threads` it would count every worker
 * thread in the process. GC helper threads are counted too, so it can read a little above a quiet wall-clock time.
 */
export function cpuMs(run: () => void): number {
  const start = cpuUsage()
  run()
  const { user, system } = cpuUsage(start)
  return (user + system) / 1000
}
