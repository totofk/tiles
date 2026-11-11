/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CHANGELOG } from '../src/app/changelog'

const plan = readFileSync(new URL('../docs/PLAN.md', import.meta.url), 'utf8')

/** "24.1" → [24, 1], "24" → [24, 0] — so 24.1 sorts after 24 */
function parts(batch: string): [number, number] {
  const [major, minor] = batch.split('.')
  return [Number(major), Number(minor ?? 0)]
}

describe('CHANGELOG data (batch 24.2, task 133)', () => {
  // the cap was 160; batch 28's line is fixed verbatim by PLAN.md task 148i at 175 chars (Batch 28 results, Deviations).
  // Chars are code points (batch 29): the verbatim 180-char line's 💼 is two UTF-16 units
  it('batches are unique; dates are ISO and never increase; batch numbers strictly decrease; lines 1–180 chars', () => {
    expect(new Set(CHANGELOG.map((e) => e.batch)).size).toBe(CHANGELOG.length)
    for (const e of CHANGELOG) {
      expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect([...e.line].length).toBeGreaterThan(0)
      expect([...e.line].length).toBeLessThanOrEqual(180)
    }
    for (let i = 1; i < CHANGELOG.length; i++) {
      expect(CHANGELOG[i].date <= CHANGELOG[i - 1].date).toBe(true)
      const a = parts(CHANGELOG[i - 1].batch)
      const b = parts(CHANGELOG[i].batch)
      expect(b[0] < a[0] || (b[0] === a[0] && b[1] < a[1])).toBe(true)
    }
  })

  it('every shipped batch (a `## Batch N results` heading in docs/PLAN.md) has a CHANGELOG entry', () => {
    const shipped = [...plan.matchAll(/^## Batch ([0-9.]+) results/gm)].map((m) => m[1])
    expect(shipped.length).toBeGreaterThan(0)
    const batches = CHANGELOG.map((e) => e.batch)
    for (const b of shipped) expect(batches).toContain(b)
  })
})
