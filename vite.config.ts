import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves the site at https://totofk.github.io/tiles/
  base: process.env.GITHUB_PAGES ? '/tiles/' : '/',
  plugins: [react()],
  test: {
    // node by default; DOM tests opt in with a `// @vitest-environment jsdom` comment
    include: ['tests/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
    passWithNoTests: true,
  },
})
