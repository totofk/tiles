// @vitest-environment jsdom
import { act as reactAct, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { deedCost, startTiles } from '../src/core/balance'
import { buyMetaUpgrade } from '../src/core/prestige'
import { Legacy, SellCard } from '../src/app/Legacy'
import { createInitialState, type GameState } from '../src/core/state'
import type { Act } from '../src/app/useGame'

afterEach(cleanup)

const withDeeds = (deeds: number): GameState => ({ ...createInitialState(), meta: { ...createInitialState().meta, prestigeCount: 1, deeds } })
/** applies the action and feeds the result back, like the real act() does */
const act = (): Act => (fn) => {
  const r = fn(current!)
  if (r.ok) current = r.state
}
let current: GameState | null = null

/** a run at the sale gate (prestige.test.ts has the same shape; repeated here to keep the files independent) */
const atGate = (): GameState => {
  const s = createInitialState()
  return {
    ...s,
    run: {
      ...s.run,
      lifetime: { ...s.run.lifetime, cashEarned: 640_000 },
      workers: { ...s.run.workers, certificates: ['plant', 'harvest'] },
      workshop: { built: true, beds: [true, false, false, false], valve: false },
      stars: 37,
      orders: { unlocked: true, slots: 4, offers: [] },
    },
  }
}

describe('🏆 Legacy deed shop', () => {
  it('spends deeds on levels: the button buys through act, the price curve doubles, MAX_LEVEL and NO_DEEDS disable', () => {
    current = withDeeds(9)
    const { container, rerender } = render(<Legacy state={current} act={act()} />)
    // 9 rows (plus each row's ⓘ tip button), priced 2 for the first level and fixed for the one-time keeps
    expect(container.querySelectorAll('.shop-row > Item, .shop-row > *')).toHaveLength(9)
    expect(screen.getByRole('button', { name: /Fast crops/ }).textContent).toMatch(/Grow ×1\.00 → ×0\.96 · 2 deeds/)
    expect(screen.getByRole('button', { name: /Seed vault/ }).textContent).toMatch(/Crop licenses survive the sale · 2 deeds/)
    expect(screen.getByRole('button', { name: /Kept certificates/ }).textContent).toMatch(/certificates survive the sale · 3 deeds/)
    expect(screen.getByRole('button', { name: /Kept renown/ }).textContent).toMatch(/Renown tiers survive the sale · 3 deeds/)
    // buying growTime L1 (2 deeds) then L2 (4) — the 2 / 4 / 8 / 16 / 32 curve
    reactAct(() => fireEvent.click(screen.getByRole('button', { name: /Fast crops/ })))
    rerender(<Legacy state={current!} act={act()} />)
    expect(current!.meta.deeds).toBe(7)
    expect(current!.meta.upgrades.growTime).toBe(1)
    expect(screen.getByRole('button', { name: /Fast crops/ }).textContent).toMatch(/Lv 1\/5 Grow ×0\.96 → ×0\.92 · 4 deeds/)
    // 3 deeds left: the 8-deed L3 and the keeps stay enabled until tried; workerSpeed L1 (2) buys, L2 (4) is disabled
    reactAct(() => fireEvent.click(screen.getByRole('button', { name: /Quick crews/ })))
    rerender(<Legacy state={current!} act={act()} />)
    expect(current!.meta.deeds).toBe(5)
    reactAct(() => fireEvent.click(screen.getByRole('button', { name: /Quick crews/ })))
    rerender(<Legacy state={current!} act={act()} />)
    expect(current!.meta.upgrades.workerSpeed).toBe(2)
    expect(screen.getByRole('button', { name: /Quick crews/ }).hasAttribute('disabled')).toBe(true)
    // core mirror: the same buys refused at MAX_LEVEL / NO_DEEDS
    expect(buyMetaUpgrade(current!, 'workerSpeed')).toEqual({ ok: false, error: 'MAX_LEVEL' })
    current = { ...current!, meta: { ...current!.meta, deeds: 1 } }
    expect(buyMetaUpgrade(current!, 'growTime')).toEqual({ ok: false, error: 'NO_DEEDS' })
    // the price curve and max levels are the DECISIONS table
    expect([1, 2, 3, 4, 5].map((l) => deedCost('growTime', l - 1))).toEqual([2, 4, 8, 16, 32])
    expect(deedCost('keepFirstCertificates', 0)).toBe(3)
  })

  it('startTiles buys read through balance: 3 levels reach 15 starting tiles', () => {
    current = withDeeds(2 + 4 + 8)
    const { rerender } = render(<Legacy state={current} act={act()} />)
    for (let i = 0; i < 3; i++) {
      reactAct(() => fireEvent.click(screen.getByRole('button', { name: /Bigger start/ })))
      rerender(<Legacy state={current!} act={act()} />)
    }
    expect(current!.meta.upgrades.startTiles).toBe(3)
    expect(startTiles(current!.meta)).toBe(15)
    expect(screen.getByRole('button', { name: /Bigger start/ }).textContent).toMatch(/Start 15 tiles · kept/)
  })
})

describe('🏆 Sell the farm card', () => {
  it('previews exactly what resets and what carries, the deeds gained, and sells on the second press', () => {
    const sold: GameState[] = []
    const s = atGate()
    render(<SellCard state={s} sell={() => sold.push(s)} />)
    expect(screen.getByText('Sell now: +9 deeds (💰8 + 1 from ⭐)')).toBeTruthy()
    expect([...screen.getAllByRole('list')].map((l) => l.textContent)).toEqual([
      'Tiles, cash, market, storage, tools' +
        'Mine, furnace, workshop, fields, machines' +
        'Licenses, workers and certificates' +
        "⭐ balance (it converts above) and this run's timeline" +
        'Renown',
      '🏆 deeds and every Legacy row bought' + 'The ⭐-bought order slots (4)' + 'Lifetime totals — the deed meter keeps counting',
    ])
    // two presses: the first arms, the second sells exactly once
    reactAct(() => fireEvent.click(screen.getByRole('button', { name: 'Sell the farm' })))
    expect(sold).toHaveLength(0)
    expect(screen.getByRole('button', { name: 'Press again to sell the farm' })).toBeTruthy()
    reactAct(() => fireEvent.click(screen.getByRole('button', { name: 'Press again to sell the farm' })))
    expect(sold).toHaveLength(1)
  })

  it('is disabled with no gain (gate open, deeds already claimed, ⭐ under 25)', () => {
    const claimed = { ...atGate(), meta: { ...atGate().meta, deedsClaimed: 8 } }
    const sold: GameState[] = []
    render(<SellCard state={{ ...claimed, run: { ...claimed.run, stars: 3 } }} sell={() => sold.push(claimed)} />)
    expect(screen.getByText('Sell now: +0 deeds (💰0 + 0 from ⭐)')).toBeTruthy()
    const button = screen.getByRole('button', { name: 'No deeds to gain — play on' }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
  })

  it('batch 31: with Kept renown the Resets list says the tiers are kept', () => {
    const s = atGate()
    render(<SellCard state={{ ...s, meta: { ...s.meta, upgrades: { ...s.meta.upgrades, keepRenown: 1 } } }} sell={() => {}} />)
    expect(screen.getByText('Renown — tiers kept')).toBeTruthy()
  })
})
