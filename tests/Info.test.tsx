// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Info } from '../src/app/Info'
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

  it('every Shop and Upgrades row has one, with a text', () => {
    const s = createInitialState()
    // everything visible: all licenses (pouch rows), the mine license (wood, Mine upgrades), all milestone upgrades
    const state: GameState = {
      ...s,
      run: { ...s.run, licenses: [...CROP_IDS], mineLicense: true, counters: { ...s.run.counters, harvests: 1e4, sales: 1e4 } },
    }
    const { container } = render(
      <>
        <Shop state={state} act={noop} cropId="radish" onSelectCrop={noop} />
        <Upgrades state={state} act={noop} />
      </>,
    )
    const rows = [...container.querySelectorAll('.shop-row > *, .pouch-row, .pouch-auto')]
    // 4 crops + wood + tile + 9 tools, 4 pouch rows + auto-buy, 4 upgrades + storage + vein
    expect(rows).toHaveLength(15 + 5 + 6)
    for (const r of rows) {
      expect(r.querySelectorAll('.info-btn')).toHaveLength(1)
      expect(r.querySelector('.tip')?.textContent?.length).toBeGreaterThan(20)
    }
  })
})
