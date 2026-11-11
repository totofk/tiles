// One number formatter for the whole game (batch 31.1, docs/research/number-notation.md). Hand-rolled en-US, no Intl or
// locale APIs. Held amounts round down and prices round up, so "shown held ≥ shown price" means affordable.

const UNITS = [
  [1e3, 'k'],
  [1e6, 'M'],
  [1e9, 'B'],
  [1e12, 'T'],
  [1e15, 'Qa'],
] as const

type Round = (x: number) => number

/** 15266 → "15,266" (an integer) */
const group = (n: number): string => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

/** NaN → "0"; a negative gets "-" before the magnitude's text */
const signed = (n: number, f: (abs: number) => string): string => (Number.isNaN(n) ? '0' : n < 0 ? `-${f(-n)}` : f(n))

/**
 * `n` ≥ `from` in the largest unit ≤ n with `decimals(mantissa)` decimals, rounded by `round`; a mantissa that rounds
 * up to 1000 carries to the next unit (999,999,500 → 1B). Below `from`: grouped digits, rounded by `round`.
 */
function scaled(n: number, from: number, round: Round, decimals: (m: number) => number, trim: boolean): string {
  const whole = round(n)
  if (whole < from) return group(whole)
  // k only when `from` is below 1e6; then the largest unit ≤ n
  let i = from < 1e6 ? 0 : 1
  while (i < UNITS.length - 1 && UNITS[i + 1]![0] <= n) i++
  for (;;) {
    const [unit, suffix] = UNITS[i]!
    const d = decimals(n / unit)
    const m = round(n / (unit / 10 ** d))
    if (m >= 1000 * 10 ** d && i < UNITS.length - 1) {
      i++
      continue
    }
    const text = (m / 10 ** d).toFixed(d)
    return `${trim && d > 0 ? text.replace(/\.?0+$/, '') : text}${suffix}`
  }
}

const UP: Round = Math.ceil
const DOWN: Round = Math.floor
const NEAR: Round = Math.round

/** HUD balance: 15,266 · 15.266M (three decimals, rounded down) */
export const held = (n: number): string => signed(n, (a) => scaled(a, 1e6, DOWN, () => 3, false))

/** costs and shortfalls: 500,000 · 1.5M · 3M (rounded up, trailing zeros trimmed) */
export const price = (n: number): string => signed(n, (a) => scaled(a, 1e6, UP, () => 3, true))

/** toast gains: like held, trailing zeros trimmed (1.5M) */
export const gain = (n: number): string => signed(n, (a) => scaled(a, 1e6, DOWN, () => 3, true))

/** ≈ rates: 3 significant digits, k from 10,000: 7,500 · 386k · 1.2M */
export const approx = (n: number): string =>
  signed(n, (a) => scaled(a, 1e4, NEAR, (m) => (m >= 100 ? 0 : m >= 10 ? 1 : 2), true))

/** a 52 px Estate cell: 5,500 · 386k · 1M · 1.2M · 16M · 1.2B (rounded up) */
export const cell = (n: number): string => signed(n, (a) => scaled(a, 1e4, UP, (m) => (m >= 10 ? 0 : 1), true))

/** ⭐, bars, counters: grouped, never abbreviated */
export const count = (n: number): string => signed(n, (a) => group(Math.round(a)))

/** "1h 02m 05s" */
export function duration(ticks: number): string {
  const h = Math.floor(ticks / 3600)
  const m = Math.floor((ticks % 3600) / 60)
  const s = ticks % 60
  const two = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}h ${two(m)}m ${two(s)}s` : `${m}m ${two(s)}s`
}
