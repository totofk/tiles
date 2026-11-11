/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('../src/app/app.css', import.meta.url), 'utf8')

describe('app.css class hygiene (batch 24)', () => {
  it('the old .pouch-row / .mine-item flex-wrap rules are gone — the shared .item-grid replaced them', () => {
    expect(css).toContain('.item-grid')
    expect(css).not.toContain('pouch-row')
    expect(css).not.toContain('mine-item')
  })

  it('the spacing scale tokens exist and the hard-coded 6 px gaps are gone', () => {
    expect(css).toContain('--s1: 4px')
    expect(css).toContain('--s2: 8px')
    expect(css).toContain('--s3: 12px')
    expect(css).toContain('--s4: 16px')
    expect(css).not.toMatch(/gap: 6px/)
  })
})

describe('app.css shared columns (batch 24.1)', () => {
  it('.item-grid declares the five columns; rows are subgrids of them', () => {
    expect(css).toContain('grid-template-columns: minmax(0, 1fr) auto auto 64px 64px')
    expect(css).toMatch(/\.item-row\s*{[^}]*grid-template-columns: subgrid/s)
  })

  it('the two-line fallback is a container query on the wrapper, and the old viewport .item-sub swap is gone', () => {
    expect(css).toContain('.item-grid-wrap')
    expect(css).toContain('@container (max-width: 359px)')
    expect(css).not.toContain('.item-sub')
  })

  it('gauge and recipe rows are subgrids sharing one grid per card; the narrow fallback is a container query', () => {
    expect(css).toMatch(/\.gauge-grid\s*{[^}]*grid-template-columns: max-content minmax\(48px, 1fr\) max-content/s)
    expect(css).toMatch(/\.gauge-row\s*{[^}]*grid-template-columns: subgrid/s)
    expect(css).toMatch(/\.recipe-grid\s*{[^}]*grid-template-columns: minmax\(0, 1fr\) 144px/s)
    expect(css).toMatch(/\.recipe-row\s*{[^}]*grid-template-columns: subgrid/s)
    expect(css).toMatch(/\.recipe-grid > \.group\s*{[^}]*grid-template-columns: subgrid/s)
    expect(css).toContain('.recipe-wrap')
    expect(css).toContain('@container (max-width: 299px)')
  })

  it('the worker ring and activity dot pulse, and reduced motion turns both steady (task 132)', () => {
    expect(css).toMatch(/\.cell-target\s*{[^}]*animation: ring-pulse 1\.5s/s)
    expect(css).toMatch(/\.job-dot-on\s*{[^}]*animation: dot-pulse 1\.5s/s)
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{[^{}]*\.cell-target[^{}]*\.job-dot-on/s)
  })
})

describe('app.css beds layout (batch 25, re-pinned batch 27)', () => {
  it('.beds pairs the beds in a 380px container query and .bed is a 3-column grid', () => {
    expect(css).toContain('@container (min-width: 380px)')
    // phones pair only when six 96 px tiles fit; the 380 px rule sits inside the ≥ 768 px media query
    expect(css).toMatch(/@media \(min-width: 768px\)\s*\{\s*@container \(min-width: 380px\)/)
    expect(css).toMatch(/@container \(min-width: 680px\)\s*\{[^}]*\.beds\s*\{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/s)
    expect(css).toMatch(/@container \(min-width: 380px\)\s*\{[^}]*\.beds\s*\{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/s)
    expect(css).toMatch(/\.bed\s*{[^}]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/s)
  })

  it('the sqrt .grid rules and the --n custom property are gone; .beds owns the tile-size formula', () => {
    expect(css).not.toContain('.grid')
    expect(css).not.toContain('--n')
    expect(css).toMatch(/\.beds\s*{[^}]*--tile:/s)
    expect(css).toContain('.cell-slot')
  })

  it('the ≥ 768 px tile floor is 52 px (batch 27: 24 tiles fit 1024 × 768 paired at 54 px, no scroll)', () => {
    expect(css).toMatch(/\.beds\s*{[^}]*--tile: max\(\s*52px,/s)
    expect(css).not.toContain('max(72px')
  })

  it('a cell compacts by its own width (batch 27): the label hides < 80 px, the "rots in" text < 64 px', () => {
    expect(css).toMatch(/\.cell\s*{[^}]*container-type: inline-size/s)
    expect(css).toMatch(/@container \(max-width: 79px\)\s*\{[^}]*\.cell-label\s*{[^}]*clip-path: inset\(50%\)/s)
    expect(css).toMatch(/@container \(max-width: 63px\)\s*\{[^}]*\.cell-rot\s*{[^}]*display: none/s)
  })
})

describe('app.css Estate map (batch 30)', () => {
  it('a row is a 56 px chip + five 52 px cells with 5 px gaps = 341 px, and the rows grid columns are 341 px', () => {
    expect(css).toMatch(/\.map-row\s*{[^}]*grid-template-columns: 56px repeat\(5, 52px\);[^}]*gap: 5px;/s)
    expect(56 + 5 * 52 + 5 * 5).toBe(341)
    expect(css).toMatch(/\.map-rows\s*{[^}]*grid-template-columns: repeat\(auto-fill, 341px\);[^}]*column-gap: 40px;[^}]*row-gap: 8px;/s)
    // every cell and the chip are 52 px tall (≥ 44 px tap targets) with no padding pushing past the column
    expect(css).toMatch(/\.map-chip,\s*\.map-cell\s*{[^}]*height: 52px;[^}]*min-width: 0;[^}]*padding: 0;/s)
  })
})
