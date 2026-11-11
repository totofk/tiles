import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { approx, cell, count, duration, gain, held, price } from '../src/app/fmt'

// docs/research/number-notation.md "Recommendation for tiles": value → held, price, gain, approx, cell
const TABLE: [number, string, string, string, string, string][] = [
  [0, '0', '0', '0', '0', '0'],
  [540, '540', '540', '540', '540', '540'],
  [999, '999', '999', '999', '999', '999'],
  [1_000, '1,000', '1,000', '1,000', '1,000', '1,000'],
  [7_500, '7,500', '7,500', '7,500', '7,500', '7,500'],
  [22_000, '22,000', '22,000', '22,000', '22k', '22k'],
  [385_500, '385,500', '385,500', '385,500', '386k', '386k'],
  [500_000, '500,000', '500,000', '500,000', '500k', '500k'],
  [999_999, '999,999', '999,999', '999,999', '1M', '1M'],
  [1_000_000, '1.000M', '1M', '1M', '1M', '1M'],
  [1_005_500, '1.005M', '1.006M', '1.005M', '1.01M', '1.1M'],
  [1_499_999, '1.499M', '1.5M', '1.499M', '1.5M', '1.5M'],
  [1_500_000, '1.500M', '1.5M', '1.5M', '1.5M', '1.5M'],
  [2_572_125, '2.572M', '2.573M', '2.572M', '2.57M', '2.6M'],
  [3_000_000, '3.000M', '3M', '3M', '3M', '3M'],
  [15_266_531, '15.266M', '15.267M', '15.266M', '15.3M', '16M'],
  [152_665_310, '152.665M', '152.666M', '152.665M', '153M', '153M'],
  [999_999_500, '999.999M', '1B', '999.999M', '1B', '1B'],
  [1_528_235_000, '1.528B', '1.529B', '1.528B', '1.53B', '1.6B'],
  [2.5e12, '2.500T', '2.5T', '2.5T', '2.5T', '2.5T'],
  [4e15, '4.000Qa', '4Qa', '4Qa', '4Qa', '4Qa'],
]

/** the number a shown text stands for */
const value = (text: string): number => {
  const m = /^(-?[\d,.]+)(k|M|B|T|Qa)?$/.exec(text)!
  const unit = { k: 1e3, M: 1e6, B: 1e9, T: 1e12, Qa: 1e15 }[m[2] ?? ''] ?? 1
  return Number(m[1]!.replace(/,/g, '')) * unit
}

describe('fmt (batch 31.1, task 164)', () => {
  it.each(TABLE)('%d → held %s · price %s · gain %s · approx %s · cell %s', (n, h, p, g, a, c) => {
    expect([held(n), price(n), gain(n), approx(n), cell(n)]).toEqual([h, p, g, a, c])
  })

  it('negatives, NaN, counts and durations', () => {
    expect([held(-15_266), price(-1_500_000), gain(-540), approx(-385_500)]).toEqual(['-15,266', '-1.5M', '-540', '-386k'])
    expect([held(NaN), price(NaN), gain(NaN), approx(NaN), cell(NaN), count(NaN)]).toEqual(['0', '0', '0', '0', '0', '0'])
    expect([count(39), count(1_234_567)]).toEqual(['39', '1,234,567'])
    expect([duration(59), duration(3725)]).toEqual(['0m 59s', '1h 02m 05s'])
  })

  it('invariant: shown held ≥ shown price implies cash ≥ cost, for every pair in the table and around it', () => {
    const ns = TABLE.flatMap(([n]) => [n - 1, n, n + 1]).filter((n) => n >= 0)
    for (const cash of ns) for (const cost of ns) if (value(held(cash)) >= value(price(cost))) expect([cash, cost, cash >= cost]).toEqual([cash, cost, true])
  })

  it('guard: no raw 💰 interpolation outside fmt.ts, no 💰 + 5 bare digits in a .tsx string, no toLocaleString', () => {
    const files = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [join(dir, e.name)] : []))
    const bad = files('src').flatMap((f) => {
      const text = readFileSync(f, 'utf8')
      const hits: string[] = []
      if (!f.endsWith('fmt.ts') && /💰⁠?\$?\{(?!(held|price|gain|approx|cell|count)\()/.test(text)) hits.push(`${f}: 💰 + raw interpolation`)
      if (f.endsWith('.tsx') && /💰\d{5}/.test(text)) hits.push(`${f}: 💰 + 5 bare digits`)
      if (text.includes('toLocaleString')) hits.push(`${f}: toLocaleString`)
      return hits
    })
    expect(bad).toEqual([])
  })
})
