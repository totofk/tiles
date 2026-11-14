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
