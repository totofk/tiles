// the formatter lives in core (📊 Stats rows use it; core stays pure)
export { approx, cell, count, duration, gain, held, price } from '../core/fmt'

/** an order's ⭐ (batch 34): one decimal below 10 with a trailing ".0" dropped (1, 0.4, 1.5), whole from 10 up */
export const starsText = (stars: number): string => (stars < 10 ? String(Math.round(stars * 10) / 10) : String(Math.round(stars)))
