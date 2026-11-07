import { describe, expect, it } from 'vitest'
import { PANEL_TABS } from '../src/app/panelTabs'
import { DEFAULT_UI } from '../src/app/uiState'

describe('PANEL_TABS', () => {
  it('has unique ids and contains the default tab', () => {
    const ids = PANEL_TABS.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain(DEFAULT_UI.tab)
  })
})
