import { execSync } from 'node:child_process'
import react from '@vitejs/plugin-react'
import { configDefaults, defineConfig } from 'vitest/config'

/** short git hash for feedback reports: the checkout, else CI's GITHUB_SHA, else "dev" */
function buildId(): string {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return process.env.GITHUB_SHA?.slice(0, 7) ?? 'dev'
  }
}

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves the site at https://totofk.github.io/tiles/
  base: process.env.GITHUB_PAGES ? '/tiles/' : '/',
  define: { __BUILD__: JSON.stringify(buildId()) },
  plugins: [react()],
  test: {
    // node by default; DOM tests opt in with a `// @vitest-environment jsdom` comment
    passWithNoTests: true,
    // Vitest's 5 s default is wall-clock: the heavy tests (relics' 200,000 digs, the Manager's and the fixtures' 8 h
    // catch-ups, the sim perf pins' step identity) take 0.6–1.3 s alone but 3–6.6 s while other files or processes
    // hold the CPU, so they flaked at 5 s (batch 40, task 274). 20 s keeps a hung test bounded; both projects inherit
    // it (`extends: true`), and the long sim tests keep their own larger timeouts.
    testTimeout: 20_000,
    // The sim suites (tests/sim/, split from one file in batch 35.1) run one file at a time, like the single
    // sim.test.ts did: run in parallel they starve each other of CPU and the 30 s bot tests time out.
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['tests/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
          exclude: [...configDefaults.exclude, 'tests/sim/**'],
        },
      },
      { extends: true, test: { name: 'sim', include: ['tests/sim/**/*.test.ts'], fileParallelism: false } },
    ],
  },
})
