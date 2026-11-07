// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Shop } from '../src/app/Shop'
import type { Act } from '../src/app/useGame'
import { cropSeedCost, toolCost } from '../src/core/balance'
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

describe('Shop seeds', () => {
  it('lists every crop in license order: owned ones as seed buttons, the rest as 🔒 license cards', () => {
    setup({ cash: 60, licenses: ['radish', 'pumpkin'] })
    const row = btn(/Carrot/).closest('.shop-row')!
    expect([...row.querySelectorAll('button:not(.info-btn)')].map((b) => b.textContent)).toEqual([
      '🥕 Carrotseed 💰2',
      '🔒 Chillilicense 💰50',
      '🎃 Pumpkinseed 💰10',
      '🔒 Lemonlicense 💰400',
    ])
    expect(btn(/Chilli/).disabled).toBe(false)
    expect(btn(/Lemon/).disabled).toBe(true)
  })

  it('buying the chilli license adds a 🌶️ pouch row', () => {
    const t = setup({ cash: 50 })
    fireEvent.click(btn(/Chilli/))
    t.rerender()
    expect(t.get().run.licenses).toEqual(['radish', 'chilli'])
    expect(screen.getByText(/🌶️ Chilli × 0/)).toBeTruthy()
  })
})

describe('Farm tools in the Shop', () => {
  const toolRow = () => [...screen.getByRole('heading', { name: 'Farm tools' }).nextElementSibling!.querySelectorAll<HTMLButtonElement>('button:not(.info-btn)')]
  const tool = (name: string) => btn(new RegExp(`^${name}`))

  it('lists all 9 tool levels, each job followed by its copper tier, locked ones with their progress', () => {
    const s = createInitialState()
    setup({ counters: { ...s.run.counters, harvests: 7 } })
    expect(toolRow().map((b) => b.firstChild?.textContent)).toEqual([
      'Watering Can', 'Garden Hose', 'Water Cart', '🟧 Copper Can',
      'Sickle', 'Scythe', 'Reaper', '🟧 Copper Sickle',
      'Dibber', 'Seed Drill', 'Seed Spreader', '🟧 Copper Dibber',
    ])
    expect(tool('🟧 Copper Can').textContent).toContain('needs Watering Can')
    expect(toolRow().every((b) => b.disabled)).toBe(true)
    expect(tool('Sickle').textContent).toContain('harvest 7/15')
    expect(tool('Watering Can').textContent).toContain('water 0/20')
  })

  it('buys only the next level: level k needs k − 1', () => {
    const s = createInitialState()
    // harvests far past every threshold, but no Sickle yet
    const t = setup({ cash: 1000, counters: { ...s.run.counters, harvests: 500 } })
    expect(tool('Sickle').disabled).toBe(false)
    expect(tool('Sickle').textContent).toContain(`💰${toolCost('harvest', 1, s.meta)}`)
    expect(tool('Scythe').disabled).toBe(true)
    expect(tool('Scythe').textContent).toContain('needs Sickle')
    fireEvent.click(tool('Sickle'))
    t.rerender()
    expect(t.get().run.tools.harvest).toBe(1)
    expect(t.get().run.cash).toBe(1000 - toolCost('harvest', 1, s.meta))
    // a solid "owned" card, not the dashed "can't buy" frame
    expect(tool('Sickle').textContent).toContain('✓ Owned')
    expect(tool('Sickle').disabled).toBe(true)
    expect(tool('Sickle').classList.contains('owned')).toBe(true)
    expect(tool('Scythe').classList.contains('owned')).toBe(false)
    expect(tool('Scythe').disabled).toBe(false)
  })

  it('the copper row unlocks with the job tool Lv1, shows 🟧4 💰100 and becomes an owned card', () => {
    const t = setup({ cash: 100, inventory: { copperBar: 4 }, tools: { water: 1, harvest: 0, plant: 0 } })
    expect(tool('🟧 Copper Can').textContent).toContain('🟧4 💰100')
    expect(tool('🟧 Copper Sickle').disabled).toBe(true)
    fireEvent.click(tool('🟧 Copper Can'))
    t.rerender()
    expect(t.get().run.toolTier.water).toBe(1)
    expect([t.get().run.cash, t.get().run.inventory.copperBar]).toEqual([0, 0])
    expect(tool('🟧 Copper Can').textContent).toContain('✓ Owned')
    expect(tool('🟧 Copper Can').classList.contains('owned')).toBe(true)
  })
})

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
