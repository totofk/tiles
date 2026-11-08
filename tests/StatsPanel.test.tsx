// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Deeds, Stats, Timeline } from '../src/app/Stats'
import { createInitialState, type GameState } from '../src/core/state'
import { reportLines, stats } from '../src/core/stats'
import { SAVE_VERSION } from '../src/save/serialize'

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
        lifetime: { cashEarned: 321, energySpent: 99, bars: 4, harvests: { radish: 12 }, wagesPaid: 0, fireBurnt: 0, fireWasted: 0, barsSmelted: 0, workerPlants: 0, workerMines: 0, ironBars: 0, ironBarsSmelted: 0, ordersCompleted: 0, starsEarned: 0, goldBars: 0, goldBarsSmelted: 0 },
      },
    }
    const { container } = render(<Stats state={state} />)
    expect(screen.getByRole('heading', { name: 'Lifetime' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Now' })).toBeTruthy()
    const shown = [...container.querySelectorAll('.stats > div')].map((d) => d.textContent)
    const { totals, multipliers } = stats(state)
    expect(shown).toEqual([...totals, ...multipliers].map((r) => `${r.label}${r.value}${r.source ? ` (${r.source})` : ''}`))
  })

  it('deed meter: ⌊√(lifetime cash ÷ 10 000)⌋ deeds, a meter only', () => {
    const s = createInitialState()
    render(<Deeds state={{ ...s, run: { ...s.run, lifetime: { ...s.run.lifetime, cashEarned: 1_040_000 } } }} />)
    expect(screen.getByText('Lifetime cash 💰1,040,000 → 10 deeds when "Sell the farm" opens')).toBeTruthy()
  })

  it('timeline lists the recorded milestones; Copy report copies reportLines with the build and save version', async () => {
    const writeText = vi.fn(() => Promise.resolve())
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const s = createInitialState()
    const state: GameState = { ...s, run: { ...s.run, counters: { ...s.run.counters, harvests: 1 }, milestones: { firstHarvest: 100 } } }
    render(<Timeline state={state} />)
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['First harvest — 1m'])
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copy report' })))
    expect(writeText).toHaveBeenCalledWith(reportLines(state, [`Build: ${__BUILD__}`, `Save: v${SAVE_VERSION}`]).join('\n'))
    expect(screen.getByRole('status').textContent).toMatch(/Report copied/)
    vi.unstubAllGlobals()
  })
})
