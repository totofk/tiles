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
    const [storage] = row('⛏ Mine')
    const STONE = ITEMS.stone.emoji
    expect(storage.textContent).toBe(`📦 Storage Lv 0/10Storage 20 → 30 slots · ${STONE}⁠15 💰⁠50`)
    expect(storage.disabled).toBe(false)
    // batch 37: info only — the seal is broken in the mine, so the zone row is a span with the next seal's price
    const zone = document.querySelector('.upgrade-vein-info')!
    expect(zone.textContent).toBe(`⛏️ Zone 0/4next seal at floor 5: ${STONE}⁠25 💰⁠100`)
    fireEvent.click(storage)
    const fn = act.mock.calls[0][0] as (s: GameState) => ReturnType<typeof buyStorage>
    expect(fn(state)).toEqual(buyStorage(state))
  })

  it('maxed storage says "max"; the deepest zone row has no next seal', () => {
    const state = withRun({ mineLicense: true, storageLevel: 10, bagCapacity: 120, vein: { level: 4, progress: 0, rock: 'stone' } })
    render(<Upgrades state={state} act={noop} />)
    const [storage] = row('⛏ Mine')
    expect(storage.textContent).toContain('📦 Storage Lv 10/10Storage 120 slots · max')
    const zone = document.querySelector('.upgrade-vein-info')!
    expect(zone.textContent).toBe('⛏️ Zone 4/4the deepest zone')
  })
})

describe('batch 36.3: Wetlands storage row', () => {
  it('a no-mine run shows the storage row alone under "📦 Storage" (no vein, no Mine heading) and buys it', () => {
    const act = vi.fn()
    render(<Upgrades state={withRun({ listing: { district: 'wetlands', soil: null }, cash: 50, inventory: { stone: 20 } })} act={act} />)
    expect(screen.queryByRole('heading', { name: '⛏ Mine' })).toBeNull()
    const [storage, ...rest] = row('📦 Storage')
    expect(rest).toEqual([])
    expect(storage.textContent).toMatch(/^📦 Storage Lv 0\/10Storage 20 → 30 slots/)
    expect(storage.disabled).toBe(false)
    expect(screen.queryByText(/Vein Lv/)).toBeNull()
  })
})
