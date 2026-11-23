// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Info, placeTip } from '../src/app/Info'
import { Shop } from '../src/app/Shop'
import { Upgrades } from '../src/app/Upgrades'
import { CROP_IDS } from '../src/core/data/crops'
import { createInitialState, type GameState } from '../src/core/state'

afterEach(cleanup)

const noop = () => {}

describe('ⓘ info button', () => {
  it('a tap toggles the tip', () => {
    render(<Info text="Grows fast." />)
    const btn = screen.getByRole('button', { name: 'More info' })
    const tip = screen.getByText('Grows fast.')
    expect(tip.hidden).toBe(true)
    expect(btn.getAttribute('aria-expanded')).toBe('false')
    expect(btn.getAttribute('aria-describedby')).toBe(tip.id)
    fireEvent.click(btn)
    expect(tip.hidden).toBe(false)
    expect(btn.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(btn)
    expect(tip.hidden).toBe(true)
  })

  it('a mouse hover shows the tip, placed as a fixed box; a touch enter does not', () => {
    render(<Info text="Grows fast." />)
    const btn = screen.getByRole('button', { name: 'More info' })
    const tip = screen.getByRole('tooltip', { hidden: true })
    // the tip is measured at 0,0, so its width is not cut by where its row sits
    let measuredAt: string[] = []
    tip.getBoundingClientRect = () => {
      measuredAt = [tip.style.top, tip.style.left]
      return { width: 200, height: 40 } as DOMRect
    }
    fireEvent.pointerEnter(btn, { pointerType: 'touch' })
    expect(tip.hidden).toBe(true)
    fireEvent.pointerEnter(btn, { pointerType: 'mouse' })
    expect(tip.hidden).toBe(false)
    expect(measuredAt).toEqual(['0px', '0px'])
    // jsdom rects are all 0: below the ⓘ (0 + 4 gap), clamped to the 8 px left margin
    expect([tip.style.top, tip.style.left]).toEqual(['4px', '8px'])
    fireEvent.pointerLeave(btn, { pointerType: 'mouse' })
    expect(tip.hidden).toBe(true)
  })

  it('an open tip closes on Esc, a pointer-down outside or a scroll, not on a pointer-down on itself', () => {
    render(<Info text="Grows fast." />)
    const btn = screen.getByRole('button', { name: 'More info' })
    const tip = screen.getByRole('tooltip', { hidden: true })
    fireEvent.click(btn)
    fireEvent.pointerDown(tip)
    expect(tip.hidden).toBe(false)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(tip.hidden).toBe(true)
    fireEvent.click(btn)
    fireEvent.pointerDown(document.body)
    expect(tip.hidden).toBe(true)
    fireEvent.click(btn)
    fireEvent.scroll(document.body)
    expect(tip.hidden).toBe(true)
  })
})

describe('placeTip', () => {
  const vp = { width: 375, height: 600 }
  const tip = { width: 200, height: 60 }
  const at = (left: number, top: number) => ({ left, top, bottom: top + 28, width: 28 })

  it('opens below the ⓘ, centred on it', () => {
    expect(placeTip(at(160, 100), tip, vp)).toEqual({ top: 132, left: 74 })
  })

  it('flips above when it would pass the viewport bottom (8 px margin)', () => {
    // below would end at 540 + 28 + 4 + 60 = 632 > 592
    expect(placeTip(at(160, 540), tip, vp)).toEqual({ top: 476, left: 74 })
    // ends exactly at 592: stays below
    expect(placeTip(at(160, 500), tip, vp).top).toBe(532)
  })

  it('stays below when there is no room above either', () => {
    expect(placeTip(at(160, 40), { width: 200, height: 560 }, vp).top).toBe(72)
  })

  it('is clamped to 8 px from the left and right edges', () => {
    expect(placeTip(at(0, 100), tip, vp).left).toBe(8)
    expect(placeTip(at(347, 100), tip, vp).left).toBe(375 - 8 - 200)
  })

  it('every Shop and Upgrades row has one, with a text', () => {
    const s = createInitialState()
    // everything visible: all licenses (pouch rows), the mine license (wood, Mine upgrades), vein Lv1 (furnace),
    // all milestone upgrades
    const state: GameState = {
      ...s,
      run: {
        ...s.run,
        licenses: [...CROP_IDS],
        mineLicense: true,
        vein: { level: 1, progress: 0, rock: 'stone' },
        counters: { ...s.run.counters, harvests: 1e4, sales: 1e4 },
      },
    }
    const { container } = render(
      <>
        <Shop state={state} act={noop} cropId="radish" onSelectCrop={noop} />
        <Upgrades state={state} act={noop} />
      </>,
    )
    const rows = [...container.querySelectorAll('.shop-row > *, .item-row, .pouch-auto')]
    // 10 crops + wood + furnace + noticeboard + tile + 9 tools + 3 copper tools, 10 pouch rows + auto-buy, 4 upgrades + storage + vein
    expect(rows).toHaveLength(10 + 16 + 11 + 6)
    for (const r of rows) {
      // batch 36.7 (task 241): pouch rows carry no ⓘ — the tip sits at the "Seed pouch" heading instead
      expect(r.querySelectorAll('.info-btn')).toHaveLength(r.closest('.pouch-grid') ? 0 : 1)
      if (!r.closest('.pouch-grid')) expect(r.querySelector('.tip')?.textContent?.length).toBeGreaterThan(20)
    }
    // one ⓘ per heading: "Seed pouch" ("Crop to plant" lives in the Farm tab, not here)
    expect(container.querySelectorAll('.h-with-info .info-btn')).toHaveLength(1)
    expect(container.querySelector('.h-with-info')!.querySelector('.tip')!.textContent!.length).toBeGreaterThan(20)
  })
})
