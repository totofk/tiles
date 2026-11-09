// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { PARKED_IDEAS, PARKED_LABEL, PARKED_ORDER, RoadmapList } from '../src/app/Roadmap'
import { Stats, StatsTab, Timeline } from '../src/app/Stats'
import type { PanelProps } from '../src/app/panelTabs'
import { EMPTY_FEEDBACK } from '../src/app/feedback'
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

  it('timeline lists the recorded milestones; no Copy report button anymore (task 123)', () => {
    const s = createInitialState()
    const state: GameState = { ...s, run: { ...s.run, counters: { ...s.run.counters, harvests: 1 }, milestones: { firstHarvest: 100 } } }
    render(<Timeline state={state} />)
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['First harvest — 1m'])
    expect(screen.queryByRole('button', { name: 'Copy report' })).toBeNull()
  })
})

describe('🗺 Roadmap modal (batch 23, task 119)', () => {
  const props: PanelProps = {
    state: createInitialState(),
    act: () => {},
    cropId: 'radish',
    onSelectCrop: () => {},
    farmTab: false,
    worked: [],
    ui: { view: 'farm', tab: 'farm', collapsed: false, toolsOpen: true, seen: { shop: [], upgrades: [] }, priceShown: {} },
    toggleTools: () => {},
    reset: () => {},
    sell: () => {},
    exportCode: () => '',
    applyImport: () => ({ ok: true } as const),
    feedback: EMPTY_FEEDBACK,
    setFeedback: () => {},
  }

  it('the RoadmapList is data-driven: every parked idea line, the label and the order note', () => {
    render(<RoadmapList />)
    const list = screen.getByRole('list')
    for (const idea of PARKED_IDEAS) expect(list.textContent).toContain(`${idea.name} — ${idea.line}`)
    expect(screen.getByText(PARKED_LABEL)).toBeTruthy()
    expect(screen.getByText(PARKED_ORDER)).toBeTruthy()
  })

  it('StatsTab opens it from the action row and closes on ✕', () => {
    render(<StatsTab {...props} />)
    fireEvent.click(screen.getByRole('button', { name: '🗺 Roadmap' }))
    expect(screen.getByRole('dialog', { name: '🗺 Roadmap' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('💬 Feedback opens as a modal with the unchanged 4 fields (task 120)', () => {
    render(<StatsTab {...props} />)
    expect(screen.queryByRole('textbox', { name: /Title/ })).toBeNull() // nothing inline anymore
    fireEvent.click(screen.getByRole('button', { name: '💬 Feedback' }))
    const dialog = screen.getByRole('dialog', { name: '💬 Feedback' })
    expect(within(dialog).getByRole('group', { name: 'Kind' })).toBeTruthy()
    for (const name of [/Title/, /Details/, /Contact/]) expect(within(dialog).getByRole('textbox', { name })).toBeTruthy()
  })
})
