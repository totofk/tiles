// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../src/app/App'
import { onForeignSaveEvent } from '../src/app/crossTab'
import { SAVE_KEY } from '../src/save/storage'

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('cross-tab save guard (task 117)', () => {
  it('onForeignSaveEvent freezes only on a tiles.save rewrite', () => {
    const freeze = vi.fn()
    onForeignSaveEvent({ key: SAVE_KEY }, freeze)
    expect(freeze).toHaveBeenCalledTimes(1)
    onForeignSaveEvent({ key: 'tiles.ui' }, freeze)
    onForeignSaveEvent({ key: null }, freeze) // storage.clear() from another tab
    expect(freeze).toHaveBeenCalledTimes(1)
  })

  it('a tiles.save storage event shows the reload banner once', () => {
    render(<App />)
    expect(screen.queryByRole('alert')).toBeNull()
    fireEvent(window, new StorageEvent('storage', { key: SAVE_KEY }))
    expect(screen.getByRole('alert').textContent).toContain('Save changed in another tab')
    // a second event does not duplicate the banner
    fireEvent(window, new StorageEvent('storage', { key: SAVE_KEY }))
    expect(screen.getAllByRole('alert')).toHaveLength(1)
  })

  it('a storage event for another key shows nothing', () => {
    render(<App />)
    fireEvent(window, new StorageEvent('storage', { key: 'something.else' }))
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
