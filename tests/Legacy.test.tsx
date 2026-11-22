// @vitest-environment jsdom
import { act as reactAct, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { deedCost, startTiles } from '../src/core/balance'
import { buyMetaUpgrade } from '../src/core/prestige'
import { Legacy, LegacyChip, SellCard } from '../src/app/Legacy'
import { CROP_EMOJI } from '../src/app/FarmGrid'
import { DISTRICTS, DISTRICT_HINT } from '../src/core/data/districts'
import { PLAIN_LISTING, currentListings, soilText, type Listing } from '../src/core/listings'
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
      orders: { unlocked: true, slots: 4, offers: [], rerolls: 0 },
    },
  }
}

describe('🏆 Legacy deed shop', () => {
  it('spends deeds on levels: the button buys through act, the price curve doubles, MAX_LEVEL and NO_DEEDS disable', () => {
    current = withDeeds(9)
    const { container, rerender } = render(<Legacy state={current} act={act()} />)
    // 14 rows (batch 36.6: +5 keeps; plus each row's ⓘ tip button), priced 2 for the first level and fixed for the one-time keeps
    expect(container.querySelectorAll('.shop-row > Item, .shop-row > *')).toHaveLength(14)
    expect(screen.getByRole('button', { name: /Fast crops/ }).textContent).toMatch(/Grow ×1\.00 → ×0\.96 · 2 deeds/)
    expect(screen.getByRole('button', { name: /Seed vault/ }).textContent).toMatch(/Crop licenses survive the sale · 2 deeds/)
    expect(screen.getByRole('button', { name: /Kept certificates The 3/ }).textContent).toMatch(/certificates survive the sale · 3 deeds/)
    expect(screen.getByRole('button', { name: /Apprentices/ }).textContent).toMatch(/Workers earn \+2 renown · 3 deeds/)
    // buying growTime L1 (2 deeds) then L2 (4) — the 2 / 4 / 8 / 16 / 32 curve
    reactAct(() => fireEvent.click(screen.getByRole('button', { name: /Fast crops/ })))
    rerender(<Legacy state={current!} act={act()} />)
    expect(current!.meta.deeds).toBe(7)
    expect(current!.meta.upgrades.growTime).toBe(1)
    expect(screen.getByRole('button', { name: /Fast crops/ }).textContent).toMatch(/Lv 1\/10 Grow ×0\.96 → ×0\.92 · 4 deeds/)
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
    // batch 36.6: Lv 6–10
    expect([6, 7, 8, 9, 10].map((l) => deedCost('growTime', l - 1))).toEqual([64, 128, 256, 512, 1024])
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

describe('batch 36.6: the 🏆 Legacy chip and the five new rows', () => {
  it('before the gate: "next deed at 💰X lifetime"; at the gate: deeds held and the sale gain; a tap opens the Bank', () => {
    let opened = 0
    const { rerender } = render(<LegacyChip state={createInitialState()} openBank={() => opened++} />)
    // 0 lifetime cash → deed 1 at (0 + 1)² × 10,000
    expect(screen.getByRole('button').textContent).toBe('🏆 next deed at 💰10,000 lifetime')
    const s = createInitialState()
    rerender(<LegacyChip state={{ ...s, run: { ...s.run, lifetime: { ...s.run.lifetime, cashEarned: 250_000 } } }} openBank={() => opened++} />)
    expect(screen.getByRole('button').textContent).toBe('🏆 next deed at 💰360,000 lifetime')
    const g = atGate()
    rerender(<LegacyChip state={{ ...g, meta: { ...g.meta, deeds: 3 } }} openBank={() => opened++} />)
    expect(screen.getByRole('button').textContent).toBe('🏆 3 · sale +8')
    expect(screen.getByRole('button').className).toBe('legacy-chip')
    fireEvent.click(screen.getByRole('button'))
    expect(opened).toBe(1)
  })

  it('the 5 new rows: names, prices, effect lines and tips; "Apprentices" for a keepRenown owner', () => {
    const s = withDeeds(30)
    render(<Legacy state={{ ...s, meta: { ...s.meta, upgrades: { ...s.meta.upgrades, keepRenown: 1 } } }} act={act()} />)
    const row = (name: RegExp) => {
      const button = screen.getByRole('button', { name })
      return [button.textContent, button.closest('.item')!.querySelector('[role=tooltip]')!.textContent]
    }
    expect(row(/^Kept Clerk/)).toEqual(['Kept Clerk The Clerk certificate survives the sale · 6 deeds', 'One-time: selling the farm keeps the Clerk certificate.'])
    expect(row(/^Kept certificates II/)).toEqual([
      'Kept certificates II Ore, fuel and mine certificates survive the sale · 8 deeds',
      'One-time: selling the farm keeps the ore, fuel and mine certificates.',
    ])
    expect(row(/^Miner's start/)).toEqual([
      "Miner's start Mine license + copper pickaxe at the start · 4 deeds",
      'One-time: every new farm starts with the mine license and a copper pickaxe (not in Wetlands).',
    ])
    expect(row(/^Kept Noticeboard/)).toEqual(['Kept Noticeboard Order board open from the start · 4 deeds', 'One-time: every new farm starts with the order board open.'])
    expect(row(/^Kept Manager/)).toEqual(['Kept Manager The Manager certificate survives the sale · 24 deeds', 'One-time: selling the farm keeps the Manager certificate.'])
    expect(row(/^Apprentices/)).toEqual(['Apprentices Workers earn +2 renown · kept', 'One-time: worker harvests earn renown like a hand harvest (+2 instead of +1).'])
  })
})

describe('🏆 Sell the farm card', () => {
  it('batch 36.6: the Gain / Lost / Kept columns for ⭐450, chilli 18,811, lemon 300, Seed vault + Kept Clerk; sells on the second press', () => {
    const sold: GameState[] = []
    const g = atGate()
    const s: GameState = {
      meta: { ...g.meta, upgrades: { ...g.meta.upgrades, keepLicenses: 1, keepClerk: 1 } },
      run: { ...g.run, stars: 450, licenses: ['potato', 'lemon', 'chilli'], renown: { chilli: 18811, lemon: 300 } },
    }
    const { container } = render(<SellCard state={s} act={act()} sell={() => sold.push(s)} />)
    // re-pinned batch 34 (was "+9 deeds (💰8 + 1 from ⭐)"): ⭐ carries a sale — cash deeds only
    // batch 35.4: "Sell now:" → "Selling gives" (information only)
    expect(screen.getByText('Selling gives +8 deeds (💰8)')).toBeTruthy()
    expect(container.querySelector('.sell-cols')!.children).toHaveLength(3)
    const cols = [...container.querySelectorAll('.sell-cols > div')].map((d) => [d.querySelector('h3')!.textContent, [...d.querySelectorAll('li')].map((li) => li.textContent)])
    expect(cols).toEqual([
      ['Gain', ['+8 deeds', '⭐400 carried', '🥉 Lemon 300', '🏅 Chilli 18,811', `Start seeds: 6 ${CROP_EMOJI.lemon} 24 ${CROP_EMOJI.chilli}`]],
      [
        'Lost',
        [
          '⭐50 above 400 — spend or reroll listings first',
          'Every ⭐ Favour level',
          'Tiles, cash, market, storage, tools',
          'Mine, furnace, workshop, fields, machines',
          'Licenses, workers and certificates not kept',
          "This run's timeline",
        ],
      ],
      [
        'Kept',
        [
          '🏆 deeds and every Legacy row bought',
          'Seed vault — every crop license',
          'Kept Clerk — the Clerk certificate',
          'The ⭐-bought order slots (4)',
          'Lifetime totals — the deed meter keeps counting',
          "Renown — every crop's points",
        ],
      ],
    ])
    expect(screen.getByText('⭐50 above 400 — spend or reroll listings first').className).toBe('lost')
    // two presses: the first arms, the second sells exactly once
    reactAct(() => fireEvent.click(screen.getByRole('button', { name: 'Sell the farm' })))
    expect(sold).toHaveLength(0)
    expect(screen.getByRole('button', { name: 'Press again to sell the farm' })).toBeTruthy()
    reactAct(() => fireEvent.click(screen.getByRole('button', { name: 'Press again to sell the farm' })))
    expect(sold).toHaveLength(1)
  })

  it('is disabled with no gain (gate open, deeds already claimed); ⭐ never adds a deed', () => {
    const claimed = { ...atGate(), meta: { ...atGate().meta, deedsClaimed: 8 } }
    const sold: GameState[] = []
    render(<SellCard state={{ ...claimed, run: { ...claimed.run, stars: 650 } }} act={act()} sell={() => sold.push(claimed)} />)
    expect(screen.getByText('Selling gives +0 deeds (💰0)')).toBeTruthy()
    expect(screen.getByText('⭐400 carried')).toBeTruthy()
    expect(screen.getByText('⭐250 above 400 — spend or reroll listings first')).toBeTruthy()
    const button = screen.getByRole('button', { name: 'No deeds to gain — play on' }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
  })

  it('batch 35.5 / 36.6: before the gate the card shows Next farm, Gain (no deed row), Lost, Kept and the locked button, with no "Selling gives"', () => {
    const s = createInitialState()
    const { container } = render(<SellCard state={{ ...s, run: { ...s.run, stars: 37 } }} act={act()} sell={() => {}} />)
    expect(screen.getByRole('heading', { name: '🏆 Sell the farm' })).toBeTruthy()
    expect([...container.querySelectorAll('.sell-cols > div:first-child li')].map((li) => li.textContent)).toEqual(['⭐37 carried', 'Renown: none yet'])
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Next farm', 'Gain', 'Lost', 'Kept'])
    expect(container.querySelector('.lost')).toBeNull()
    expect((screen.getByRole('button', { name: /🔒 Sell the farm/ }) as HTMLButtonElement).disabled).toBe(true)
    expect(document.body.textContent).not.toContain('Selling gives')
  })

  it('batch 36.6: an Apprentices owner sees its Kept row; without the vault only the starting crop gets a kit', () => {
    const s = atGate()
    const { container } = render(
      <SellCard
        state={{ ...s, meta: { ...s.meta, upgrades: { ...s.meta.upgrades, keepRenown: 1 } }, run: { ...s.run, licenses: ['potato', 'lemon'], renown: { potato: 12000, lemon: 4000 } } }}
        act={act()}
        sell={() => {}}
      />,
    )
    expect(screen.getByText('Apprentices — workers earn +2 renown')).toBeTruthy()
    expect(screen.getByText(`Start seeds: 24 ${CROP_EMOJI.potato}`)).toBeTruthy()
    expect(container.querySelector('.sell-cols')).toBeTruthy()
  })
})

describe('batch 36.1: the Next farm block', () => {
  const rows = () => screen.getAllByRole('button').filter((b) => b.hasAttribute('aria-pressed'))
  const reroll = () => screen.getByRole('button', { name: /🔄 Reroll/ }) as HTMLButtonElement

  it('shows the plain farm and two rolled listings before and after the gate, the plain row selected', () => {
    for (const s of [createInitialState(), atGate()]) {
      const { unmount } = render(<SellCard state={s} act={act()} sell={() => {}} />)
      expect(screen.getByRole('heading', { name: 'Next farm' })).toBeTruthy()
      const [plain, a, b] = currentListings(s.meta, 'plain')
      expect(rows().map((r) => r.textContent)).toEqual([
        "🏡 The plain farmtoday's farm, no soil",
        `${DISTRICTS[a.district].emoji} ${DISTRICTS[a.district].name}${soilText(a.soil!)}${DISTRICT_HINT[a.district] ?? ''}`,
        `${DISTRICTS[b.district].emoji} ${DISTRICTS[b.district].name}${soilText(b.soil!)}${DISTRICT_HINT[b.district] ?? ''}`,
      ])
      expect(plain).toEqual(PLAIN_LISTING)
      expect(rows().map((r) => r.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false'])
      expect(rows()[0].className).toBe('selected')
      unmount()
    }
  })

  it('sells the selected rolled listing on the second press', () => {
    const s = atGate()
    const sold: Listing[] = []
    render(<SellCard state={s} act={act()} sell={(l) => sold.push(l)} />)
    reactAct(() => fireEvent.click(rows()[2]))
    expect(rows().map((r) => r.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'true'])
    reactAct(() => fireEvent.click(screen.getByRole('button', { name: 'Sell the farm' })))
    reactAct(() => fireEvent.click(screen.getByRole('button', { name: 'Press again to sell the farm' })))
    expect(sold).toEqual([currentListings(s.meta, 'plain')[2]])
  })

  it('the reroll reads "🔄 Reroll ⭐40 · 0/4", is disabled before the gate, without ⭐ and at 4/4, and puts the pick back on plain', () => {
    current = { ...atGate(), run: { ...atGate().run, stars: 100 } }
    const { rerender } = render(<SellCard state={current} act={act()} sell={() => {}} />)
    expect(reroll().textContent).toBe('🔄 Reroll ⭐40 · 0/4')
    expect(reroll().disabled).toBe(false)
    reactAct(() => fireEvent.click(rows()[1]))
    reactAct(() => fireEvent.click(reroll()))
    rerender(<SellCard state={current!} act={act()} sell={() => {}} />)
    expect([current!.run.stars, current!.meta.listingRerolls]).toEqual([60, 1])
    expect(reroll().textContent).toBe('🔄 Reroll ⭐80 · 1/4')
    expect(rows().map((r) => r.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false'])
    // ⭐60 < ⭐80
    expect(reroll().disabled).toBe(true)
    rerender(<SellCard state={{ ...current!, meta: { ...current!.meta, listingRerolls: 4 }, run: { ...current!.run, stars: 999 } }} act={act()} sell={() => {}} />)
    expect(reroll().textContent).toBe('🔄 Reroll · 4/4')
    expect(reroll().disabled).toBe(true)
    rerender(<SellCard state={{ ...createInitialState(), run: { ...createInitialState().run, stars: 999 } }} act={act()} sell={() => {}} />)
    expect(reroll().disabled).toBe(true)
  })
})

describe('batch 36.2: district hints on the Next farm rows', () => {
  it('the Orchard Valley, Iron Hills and Wetlands (36.3) rows carry their hint; plain rows have none', () => {
    const hints: Record<string, string> = {
      orchardValley: 'sells 8 of 10 crops · berries ×1.4 · 🌳 fruit tree',
      ironHills: 'sells 7 of 10 crops · 🔨 forge',
      wetlands: 'sells 9 of 10 crops · berries ×1.4 · 🌊 river beds, no mine',
    }
    const seen = new Set<string>()
    for (let seed = 0; seed < 20; seed++) {
      const s = { ...atGate(), meta: { ...atGate().meta, listingSeed: seed } }
      const { unmount } = render(<SellCard state={s} act={act()} sell={() => {}} />)
      const rows = screen.getAllByRole('button').filter((b) => b.hasAttribute('aria-pressed'))
      currentListings(s.meta, 'plain').forEach((l, i) => {
        const smalls = [...rows[i].querySelectorAll('small')].map((e) => e.textContent)
        expect(smalls.slice(1)).toEqual(hints[l.district] ? [hints[l.district]] : [])
        seen.add(l.district)
      })
      unmount()
    }
    expect([...seen].sort()).toEqual(['ironHills', 'orchardValley', 'plain', 'wetlands'])
  })
})
