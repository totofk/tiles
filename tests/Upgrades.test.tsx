// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Upgrades } from '../src/app/Upgrades'
import { upgradeCost, upgradeMaxLevel } from '../src/core/balance'
import { ITEMS } from '../src/core/data/items'
import { buyStorage } from '../src/core/mining'
import { createInitialState, type GameState } from '../src/core/state'

afterEach(cleanup)

const noop = () => {}
/** the buy buttons in the row under a heading (not the ⓘ buttons) */
const row = (heading: string) =>
  (within(screen.getByRole('heading', { name: heading }).nextElementSibling as HTMLElement).getAllByRole('button') as HTMLButtonElement[]).filter(
    (b) => !b.classList.contains('info-btn'),
  )
const names = (heading: string) => row(heading).map((b) => b.firstChild?.textContent)
const headings = () => screen.getAllByRole('heading').map((h) => h.textContent)
const withRun = (run: Partial<GameState['run']>): GameState => {
  const s = createInitialState()
  return { ...s, run: { ...s.run, ...run } }
}

describe('Upgrades tab', () => {
  it('groups by Energy / Farm / Mine; empty groups are hidden', () => {
    render(<Upgrades state={createInitialState()} act={noop} />)
    expect(headings()).toEqual(['⚡ Energy'])
    expect(names('⚡ Energy')).toEqual(['Bigger stamina', 'Faster recovery'])
  })

  it('shows milestone upgrades in 🌱 Farm once their counters pass the threshold', () => {
    const s = createInitialState()
    render(<Upgrades state={withRun({ counters: { ...s.run.counters, harvests: 1000, sales: 1000 } })} act={noop} />)
    expect(headings()).toEqual(['⚡ Energy', '🌱 Farm'])
    expect(names('🌱 Farm')).toEqual(['Better prices', 'Fertilizer'])
  })

  it('every row says its effect as "now → next" with the price', () => {
    const s = createInitialState()
    render(<Upgrades state={withRun({ counters: { ...s.run.counters, harvests: 1000, sales: 1000 } })} act={noop} />)
    const [stamina, regen] = row('⚡ Energy')
    expect(stamina.textContent).toBe(`Bigger stamina Lv 0/10Energy max 10 → 15 · 💰${upgradeCost('energyMax', 0, s.meta)}`)
    expect(regen.textContent).toContain('Regen 0.33/s → 0.42/s')
    const [prices, fert] = row('🌱 Farm')
    expect(prices.textContent).toContain('Sell price +0 % → +10 %')
    expect(fert.textContent).toContain('Grow time −0 % → −10 %')
  })

  it('a maxed upgrade is disabled and shows its value and "max"', () => {
    const level = upgradeMaxLevel('energyMax')
    const s = createInitialState()
    render(<Upgrades state={withRun({ cash: 1e9, upgrades: { ...s.run.upgrades, energyMax: level } })} act={noop} />)
    const [btn] = row('⚡ Energy')
    expect(btn.disabled).toBe(true)
    expect(btn.textContent).toBe('Bigger stamina Lv 10/10Energy max 60 · max')
  })
})

describe('Mine upgrades in the Upgrades tab', () => {
  it('appear only with the mine license: storage and vein, now → next with stone + cash prices', () => {
    render(<Upgrades state={createInitialState()} act={noop} />)
    expect(screen.queryByRole('heading', { name: '⛏ Mine' })).toBeNull()
    cleanup()

    const act = vi.fn()
    const state = withRun({ mineLicense: true, cash: 50, inventory: { stone: 20 } })
    render(<Upgrades state={state} act={act} />)
    const [storage, vein] = row('⛏ Mine')
    const STONE = ITEMS.stone.emoji
    expect(storage.textContent).toBe(`📦 Storage Lv 0/10Storage 20 → 30 slots · ${STONE}⁠15 💰⁠50`)
    expect(storage.disabled).toBe(false)
    expect(vein.textContent).toBe(`⛏️ Vein Lv 0/4${STONE} Stone 100 % → ${STONE} Stone 80 % · ⚫ Coal 20 % · ${STONE}⁠25 💰⁠100`)
    expect(vein.disabled).toBe(true)
    fireEvent.click(storage)
    const fn = act.mock.calls[0][0] as (s: GameState) => ReturnType<typeof buyStorage>
    expect(fn(state)).toEqual(buyStorage(state))
  })

  it('maxed storage and vein say "max"', () => {
    const state = withRun({ mineLicense: true, storageLevel: 10, bagCapacity: 120, vein: { level: 4, progress: 0, rock: 'stone' } })
    render(<Upgrades state={state} act={noop} />)
    const [storage, vein] = row('⛏ Mine')
    expect(storage.textContent).toContain('📦 Storage Lv 10/10Storage 120 slots · max')
    const { stone, copperOre, ironOre, goldOre } = ITEMS
    expect(vein.textContent).toContain(`${stone.emoji} Stone 50 % · ⚫ Coal 20 % · ${copperOre.emoji} Copper ore 12 % · ${ironOre.emoji} Iron ore 10 % · ${goldOre.emoji} Gold ore 8 % · max`)
  })
})
