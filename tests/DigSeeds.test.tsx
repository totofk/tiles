// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { DigSeeds, Farm, SeedPouch } from '../src/app/Farm'
import type { PanelProps } from '../src/app/panelTabs'
import type { Act } from '../src/app/useGame'
import { selectCrop } from '../src/core/actions'
import { RELIC_IDS } from '../src/core/data/relics'
import { createInitialState, type GameState, type RunState } from '../src/core/state'

afterEach(cleanup)

const init = createInitialState()

function setup(run: Partial<RunState> = {}) {
  let state: GameState = { ...init, run: { ...init.run, ...run } }
  const act: Act = (fn) => {
    const r = fn(state)
    if (r.ok) state = r.state
  }
  return { get: () => state, act }
}

const finds = (shards: number): RunState['finds'] => ({ shards, starDust: 0, ancientSeeds: 0, book: true })

describe('📖 the collection book (batch 36.4)', () => {
  it('is hidden until the run’s first dig, then shows the shards line and every unowned rule', () => {
    const t = setup({ energy: 10 })
    const view = render(<DigSeeds state={t.get()} act={t.act} />)
    expect(screen.queryByRole('heading', { name: '📖 Collection book' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Dig for seeds/ }))
    view.rerender(<DigSeeds state={t.get()} act={t.act} />)
    expect(screen.getByText('🏺 Shards 0 · 5 buy one rule')).toBeTruthy()
    expect(screen.getAllByText('Take 🏺5')).toHaveLength(RELIC_IDS.length)
  })

  it('Take is disabled at 4 shards; at 5 it picks: the row turns ✓ owned and the shards are spent', () => {
    const t4 = setup({ finds: finds(4) })
    render(<DigSeeds state={t4.get()} act={t4.act} />)
    expect((screen.getAllByText('Take 🏺5')[0]!.closest('button') as HTMLButtonElement).disabled).toBe(true)
    cleanup()
    const t5 = setup({ finds: finds(5) })
    const view = render(<DigSeeds state={t5.get()} act={t5.act} />)
    fireEvent.click(screen.getAllByText('Take 🏺5')[0]!)
    view.rerender(<DigSeeds state={t5.get()} act={t5.act} />)
    expect([t5.get().run.relics, t5.get().run.finds.shards, t5.get().run.lifetime.relicsEver]).toEqual([['orderBonus'], 0, ['orderBonus']])
    expect(within(document.querySelector('.relic-book')!).getAllByText('✓ owned')).toHaveLength(1)
  })

  it('the set: no Take buttons, every rule ✓ owned, the ×1.5 line, the 🔋 reserve and the lifetime line', () => {
    const t = setup({ relics: [...RELIC_IDS], finds: finds(0), energyReserve: 150 })
    render(<DigSeeds state={t.get()} act={t.act} />)
    expect(screen.queryByText('Take 🏺5')).toBeNull()
    expect(within(document.querySelector('.relic-book')!).getAllByText('✓ owned')).toHaveLength(RELIC_IDS.length)
    expect(screen.getByText('🏺 Set complete — every rule ×1.5')).toBeTruthy()
    expect(screen.getByText(/🔋 Reserve 150 \/ 300/)).toBeTruthy() // 30 × the ⚡ max 10 in a set
    expect(screen.getByText(/Ever found: 🏺 0 · ✨ 0 · 🦴 0 · rules 0 \/ 6 · relics are lost when the farm is sold/)).toBeTruthy()
  })
})

describe('the ancient seed in the panels (batch 36.4)', () => {
  it('🦴 pouch row appears once held, with no Buy buttons', () => {
    const none = setup({})
    render(<SeedPouch state={none.get()} act={none.act} />)
    expect(screen.queryByText('🦴 Ancient seed')).toBeNull()
    cleanup()
    const held = setup({ seeds: { ancientFruit: 1 } })
    render(<SeedPouch state={held.get()} act={held.act} />)
    const row = screen.getByText('🦴 Ancient seed').closest('.item-row')! as HTMLElement
    expect(row.textContent).toContain('×1')
    expect(within(row).queryByRole('button', { name: /Buy/ })).toBeNull() // the ⓘ tip is the row's only button
  })

  it('🌰 joins “Crop to plant” while held and selects like any crop', () => {
    const farm = (state: GameState, act: Act): PanelProps =>
      ({
        state,
        act,
        cropId: state.run.plantCrop,
        onSelectCrop: (id: string) => act((s) => selectCrop(s, id as Parameters<typeof selectCrop>[1])),
        farmTab: true,
        ui: { toolsOpen: false, priceShown: {} },
        toggleTools: () => {},
        openEstate: () => {},
        openBank: () => {},
        worked: [],
      }) as unknown as PanelProps
    const none = setup({})
    render(<Farm {...farm(none.get(), none.act)} />)
    expect(screen.queryByRole('button', { name: /🌰 Ancient fruit/ })).toBeNull()
    cleanup()
    const held = setup({ seeds: { ancientFruit: 2 } })
    const view = render(<Farm {...farm(held.get(), held.act)} />)
    fireEvent.click(screen.getByRole('button', { name: /🌰 Ancient fruit/ }))
    view.rerender(<Farm {...farm(held.get(), held.act)} />)
    expect(held.get().run.plantCrop).toBe('ancientFruit')
    expect(screen.getByRole('button', { name: /🌰 Ancient fruit/ }).className).toContain('selected')
  })
})
