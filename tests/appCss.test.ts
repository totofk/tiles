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
})
