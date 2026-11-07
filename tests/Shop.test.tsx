// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Shop } from '../src/app/Shop'
import type { Act } from '../src/app/useGame'
import { cropSeedCost } from '../src/core/balance'
import { createInitialState, type GameState } from '../src/core/state'

afterEach(cleanup)

function setup(run: Partial<GameState['run']>) {
  const s = createInitialState()
  let state: GameState = { ...s, run: { ...s.run, ...run } }
  const act: Act = (fn) => {
    const r = fn(state)
    if (r.ok) state = r.state
  }
  const ui = () => <Shop state={state} act={act} cropId="radish" onSelectCrop={() => {}} />
  const view = render(ui())
  return { get: () => state, rerender: () => view.rerender(ui()) }
}
const btn = (name: RegExp) => screen.getByRole('button', { name }) as HTMLButtonElement

describe('Shop seed pouch', () => {
  it('shows a row per licensed crop with its stock; ×1 and ×10 fill the pouch', () => {
    const seed = cropSeedCost('radish', createInitialState().meta)
    const t = setup({ cash: 100, seeds: { radish: 3 } })
    expect(screen.getByText(/Carrot × 3/)).toBeTruthy()
    expect(screen.queryByText(/Pumpkin ×/)).toBeNull()
    fireEvent.click(btn(/Buy ×10/))
    t.rerender()
    expect(t.get().run.seeds.radish).toBe(13)
    expect(t.get().run.cash).toBe(100 - 10 * seed)
    expect(screen.getByText(/Carrot × 13/)).toBeTruthy()
  })

  it('disables a buy the cash cannot cover', () => {
    setup({ cash: 3 })
    expect(btn(/Buy ×1 /).disabled).toBe(false)
    expect(btn(/Buy ×10/).disabled).toBe(true)
  })

  it('the auto-buy toggle switches run.autoBuySeeds', () => {
    const t = setup({})
    const box = screen.getByRole('checkbox', { name: /Auto-buy/ }) as HTMLInputElement
    expect(box.checked).toBe(true)
    fireEvent.click(box)
    t.rerender()
    expect(t.get().run.autoBuySeeds).toBe(false)
    expect((screen.getByRole('checkbox', { name: /Auto-buy/ }) as HTMLInputElement).checked).toBe(false)
  })
})
