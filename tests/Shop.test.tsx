// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { priceTag } from '../src/app/marketText'
import { Shop } from '../src/app/Shop'
import type { Act } from '../src/app/useGame'
import { cropSeedCost, marketDepthGlut, toolCost } from '../src/core/balance'
import type { CropId } from '../src/core/data/crops'
import { ITEMS } from '../src/core/data/items'
import { createInitialState, type GameState } from '../src/core/state'

afterEach(cleanup)

function setup(run: Partial<GameState['run']>, uiState?: { priceShown: Partial<Record<CropId, number>> }) {
  const s = createInitialState()
  let state: GameState = { ...s, run: { ...s.run, ...run } }
  const act: Act = (fn) => {
    const r = fn(state)
    if (r.ok) state = r.state
  }
  const ui = () => <Shop state={state} act={act} cropId="radish" onSelectCrop={() => {}} ui={uiState} />
  const view = render(ui())
  return { get: () => state, rerender: () => view.rerender(ui()) }
}
const BAR = ITEMS.copperBar.emoji
const btn = (name: RegExp) => screen.getByRole('button', { name }) as HTMLButtonElement
// batch 24: the shared item grid — the crop name also sits on its seed button, so scope to the pouch row
const pouchRow = (name: RegExp) => screen.getAllByText(name).map((el) => el.closest('.item-row')).find(Boolean)

describe('Shop seeds', () => {
  it('lists every crop in license order: owned ones as seed buttons, the rest as 🔒 license cards', () => {
    const { get } = setup({ cash: 60, licenses: ['radish', 'pumpkin'] })
    const row = btn(/Carrot/).closest('.shop-row')!
    expect([...row.querySelectorAll('button:not(.info-btn)')].map((b) => b.textContent)).toEqual([
      `🥕 Carrotseed 💰2${priceTag(get(), 'radish')}`,
      '🔒 Chillilicense 💰50',
      `🎃 Pumpkinseed 💰10${priceTag(get(), 'pumpkin')}`,
      '🔒 Lemonlicense 💰400',
      '🔒 Tomatolicense 💰7,000',
      '🔒 Cornlicense 💰10,000',
      '🔒 Grapelicense 💰15,000',
      '🔒 Strawberrylicense 💰22,000',
    ])
    expect(btn(/Chilli/).disabled).toBe(false)
    expect(btn(/Lemon/).disabled).toBe(true)
  })

  it('an owned crop row shows its market price and a depth bar filled to the factor', () => {
    const s = createInitialState()
    setup({ licenses: ['radish'], market: { ...s.run.market, radish: 2 * 0.4 * marketDepthGlut('radish') } })
    expect(btn(/Carrot/).textContent).toMatch(/\(60 %\)$/)
    const bar = btn(/Carrot/).querySelector('.depth > span') as HTMLElement
    expect([bar.className, bar.style.width]).toEqual(['depth-red', '60%'])
  })

  it('the price tag trends ▲▼ against the last shown factor and badges the floor (batch 21)', () => {
    const s = createInitialState()
    const glut = 2 * 0.4 * marketDepthGlut('radish')
    setup({ licenses: ['radish'], market: { ...s.run.market, radish: glut } }, { priceShown: { radish: 0.7 } })
    expect(btn(/Carrot/).textContent).toMatch(/\(60 % ▼\)$/)
    cleanup()
    setup({ licenses: ['radish'], market: { ...s.run.market, radish: glut } }, { priceShown: { radish: 0.5 } })
    expect(btn(/Carrot/).textContent).toMatch(/\(60 % ▲\)$/)
    cleanup()
    setup({ licenses: ['radish'], market: { ...s.run.market, radish: marketDepthGlut('radish') } }, { priceShown: { radish: 0.6 } })
    expect(btn(/Carrot/).textContent).toMatch(/\(50 % ▼ floor\)$/)
  })

  it('buying the chilli license adds a 🌶️ pouch row', () => {
    const t = setup({ cash: 50 })
    fireEvent.click(btn(/Chilli/))
    t.rerender()
    expect(t.get().run.licenses).toEqual(['radish', 'chilli'])
    expect(pouchRow(/Chilli/)!.textContent).toContain('×0')
  })

  it('batch 24.1: the seed pouch renders through the shared grid inside its wrapper, 5 cells per row', () => {
    setup({ cash: 50, licenses: ['radish', 'chilli'] })
    expect(document.querySelector('.shop .item-grid-wrap .item-grid')).toBeTruthy()
    for (const row of document.querySelectorAll('.shop .item-row')) expect(row.children).toHaveLength(5)
  })

  it('batch 22: the four new crops come from the same table — seed tag with trend, license buy adds a pouch row', () => {
    const s = createInitialState()
    const t = setup(
      { cash: 12_000, licenses: ['radish', 'tomato'], market: { ...s.run.market, tomato: 2 * 0.4 * marketDepthGlut('tomato') } },
      { priceShown: { tomato: 0.7 } },
    )
    expect(btn(/Tomato/).textContent).toBe(`🍅 Tomatoseed 💰40${priceTag(t.get(), 'tomato', 0.7)}`)
    expect(btn(/Tomato/).textContent).toMatch(/\(60 % ▼\)$/)
    fireEvent.click(btn(/Corn/))
    t.rerender()
    expect(t.get().run.licenses).toEqual(['radish', 'tomato', 'corn'])
    expect(pouchRow(/Corn/)!.textContent).toContain('×0')
  })
})

describe('Farm tools in the Shop', () => {
  const toolRow = () => [...screen.getByRole('heading', { name: 'Farm tools' }).nextElementSibling!.querySelectorAll<HTMLButtonElement>('button:not(.info-btn)')]
  const tool = (name: string) => btn(new RegExp(`^${name}`))

  it('lists all 9 tool levels, each job followed by its copper tier, locked ones with their progress', () => {
    const s = createInitialState()
    setup({ counters: { ...s.run.counters, harvests: 7 } })
    expect(toolRow().map((b) => b.firstChild?.textContent)).toEqual([
      'Watering Can', 'Garden Hose', 'Water Cart', `${BAR} Copper Can`,
      'Sickle', 'Scythe', 'Reaper', `${BAR} Copper Sickle`,
      'Dibber', 'Seed Drill', 'Seed Spreader', `${BAR} Copper Dibber`,
    ])
    expect(tool(`${BAR} Copper Can`).textContent).toContain('needs Watering Can')
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

  it('the tier row sells copper at tool Lv1, then iron; the owned card appears at the max tier', () => {
    const IRON = ITEMS.ironBar.emoji
    const t = setup({ cash: 10100, inventory: { copperBar: 4 }, tools: { water: 1, harvest: 0, plant: 0 } })
    expect(tool(`${BAR} Copper Can`).textContent).toContain(`moisture 2 · ${BAR}⁠4 💰⁠100`)
    expect(tool(`${BAR} Copper Sickle`).disabled).toBe(true) // no Sickle Lv1
    fireEvent.click(tool(`${BAR} Copper Can`))
    t.rerender()
    expect(t.get().run.toolTier.water).toBe(1)
    const iron = tool(`${IRON} Iron Can`)
    expect(iron.textContent).toContain(`moisture 4 · ${IRON}⁠4 💰⁠10,000`)
    expect(iron.textContent).toContain(`needs ${IRON}4 more`) // cash in hand, bars not
    expect(iron.disabled).toBe(true)

    cleanup()
    const t2 = setup({ cash: 10000, inventory: { ironBar: 4 }, tools: { water: 1, harvest: 0, plant: 0 }, toolTier: { water: 1, harvest: 0, plant: 0 } })
    fireEvent.click(tool(`${IRON} Iron Can`))
    t2.rerender()
    expect(t2.get().run.toolTier.water).toBe(2)
    expect([t2.get().run.cash, t2.get().run.inventory.ironBar]).toEqual([0, 0])
    expect(tool(`${IRON} Iron Can`).textContent).toContain('✓ moisture 4')
    expect(tool(`${IRON} Iron Can`).classList.contains('owned')).toBe(true)
  })

  it('the gold tier row (batch 16): 🥇 Gold Sickle after iron; water says iron is the last can', () => {
    const IRON = ITEMS.ironBar.emoji
    const GOLD = ITEMS.goldBar.emoji
    const t = setup({ cash: 10000, inventory: { goldBar: 4 }, tools: { water: 1, harvest: 1, plant: 1 }, toolTier: { water: 2, harvest: 2, plant: 2 } })
    expect(tool(`${IRON} Iron Can`).textContent).toContain('Iron is the last watering can')
    const gold = tool(`${GOLD} Gold Sickle`)
    expect(gold.textContent).toContain(`30 % double · 30 % seed · ${GOLD}⁠4 💰⁠10,000`)
    fireEvent.click(gold)
    t.rerender()
    expect(t.get().run.toolTier.harvest).toBe(3)
    expect(tool(`${GOLD} Gold Sickle`).textContent).toContain('✓ 30 % double')
  })
})

describe('Shop seed pouch', () => {
  it('shows a row per licensed crop with its stock; ×1 and ×10 fill the pouch', () => {
    const seed = cropSeedCost('radish', createInitialState().meta)
    const t = setup({ cash: 100, seeds: { radish: 3 } })
    // batch 24: the shared item grid — name and ×N count in their own cells
    expect(pouchRow(/Carrot/)?.textContent).toContain('×3')
    expect(pouchRow(/Pumpkin/)).toBeUndefined()
    fireEvent.click(btn(/Buy ×10/))
    t.rerender()
    expect(t.get().run.seeds.radish).toBe(13)
    expect(t.get().run.cash).toBe(100 - 10 * seed)
    expect(pouchRow(/Carrot/)!.textContent).toContain('×13')
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
