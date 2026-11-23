// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { Act } from '../src/app/useGame'
import { SoilTraits } from '../src/app/SoilTraits'
import type { FieldTraitId, HomeTraitId } from '../src/core/data/soil'
import { createInitialState, type GameState, type RunState } from '../src/core/state'

afterEach(cleanup)

const init = createInitialState()
const withRun = (run: Partial<RunState>): GameState => ({ ...init, run: { ...init.run, ...run } })
/** a state holder: `act` applies an ok action to it */
function holder(s: GameState) {
  let state = s
  const act: Act = (fn) => {
    const r = fn(state)
    if (r.ok) state = r.state
  }
  return { act, get: () => state }
}

// batch 36.5 list, moved to the 🌾 Farm tab in batch 36.7 (task 242)
describe('the 🧭 soil traits card (under the Workshop)', () => {
  const fieldsOpen = { ...init.run.fields, unlocked: true }
  const survey = (level: number, fields: (FieldTraitId | null)[] = []): RunState['survey'] => ({
    level,
    beds: (['roots', 'clay', 'fertile', 'rich'] as HomeTraitId[]).map((trait) => ({ trait, rerolls: 0 })),
    fields: fields.map((trait) => ({ trait, rerolls: 0 })),
  })

  it('renders nothing before the survey is bought (level 0)', () => {
    const { container } = render(<SoilTraits state={withRun({})} act={() => {}} />)
    expect(container.querySelector('.soil-traits')).toBeNull()
  })

  it('Lv2: the closed list names every rolled bed and field, its effect line, and its ⭐16 reroll', () => {
    render(<SoilTraits state={withRun({ stars: 20, survey: survey(2, ['berryPrice', 'creek']), fields: fieldsOpen })} act={() => {}} />)
    const list = document.querySelector<HTMLDetailsElement>('.soil-traits')!
    expect(list.open).toBe(false)
    expect(list.querySelector('summary')!.textContent).toBe('🧭 Soil traits · 4 beds · 2 fields')
    expect([...list.querySelectorAll('.soil-row')].map((r) => r.textContent)).toEqual([
      'Bed 1: 🥔 Root soilroots crops sell +15 %Reroll ⭐16',
      'Bed 2: 🧱 Claydrains 40 % slowerReroll ⭐16',
      'Bed 3: 🌻 Fertile soilgrows 10 % fasterReroll ⭐16',
      'Bed 4: 💎 Rich soil+10 % double harvestReroll ⭐16',
      'Field 1: 🍓 Berry soilberry crops sell +20 %Reroll ⭐16',
      'Field 2: 💦 Creekgrows ×1.3 with an empty tankReroll ⭐16',
    ])
    expect(list.querySelector<HTMLButtonElement>('[aria-label="Reroll field 1\'s soil"]')!.textContent).toBe('Reroll ⭐16')
  })

  it('Lv3 re-reads the pair: +22.5 %; a reroll spends ⭐16 and the next one costs ⭐24', () => {
    render(<SoilTraits state={withRun({ stars: 400, survey: survey(3), fields: fieldsOpen })} act={() => {}} />)
    expect(document.querySelector('.soil-row')!.textContent).toContain('roots crops sell +22.5 %')
    cleanup()
    const h = holder(withRun({ stars: 20, survey: survey(1), fields: fieldsOpen }))
    const view = render(<SoilTraits state={h.get()} act={h.act} />)
    const reroll = () => screen.getByRole('button', { name: `Reroll bed 2's soil` }) as HTMLButtonElement
    expect(reroll().textContent).toBe('Reroll ⭐16')
    fireEvent.click(reroll())
    expect([h.get().run.stars, h.get().run.survey.beds[1].rerolls]).toEqual([4, 1])
    view.rerender(<SoilTraits state={h.get()} act={h.act} />)
    expect(reroll().textContent).toBe('Reroll ⭐24')
    expect(reroll().disabled).toBe(true)
  })
})
