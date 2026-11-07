// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Stats } from '../src/app/Stats'
import { createInitialState, type GameState } from '../src/core/state'
import { stats } from '../src/core/stats'

afterEach(cleanup)

describe('Stats panel', () => {
  it('renders every row of stats(state): label, value and (source), under Lifetime and Now', () => {
    const s = createInitialState()
    const state: GameState = {
      ...s,
      run: {
        ...s.run,
        pickaxe: { tier: 'copper', durability: 120 },
        mastery: { copper: 50 },
        vein: { level: 2, progress: 0, rock: 'stone' },
        tools: { water: 1, harvest: 0, plant: 2 },
        lifetime: { cashEarned: 321, energySpent: 99, bars: 4, harvests: { radish: 12 }, wagesPaid: 0 },
      },
    }
    const { container } = render(<Stats state={state} />)
    expect(screen.getByRole('heading', { name: 'Lifetime' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Now' })).toBeTruthy()
    const shown = [...container.querySelectorAll('.stats > div')].map((d) => d.textContent)
    const { totals, multipliers } = stats(state)
    expect(shown).toEqual([...totals, ...multipliers].map((r) => `${r.label}${r.value}${r.source ? ` (${r.source})` : ''}`))
  })
})
