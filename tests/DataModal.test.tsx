// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DataModal, savedAgo } from '../src/app/DataModal'
import { Modal, copyText } from '../src/app/Modal'
import { decodeSave, encodeSave } from '../src/save/codec'
import type { ImportResult } from '../src/save/storage'
import { SAVE_VERSION, serialize, type Save } from '../src/save/serialize'
import { createInitialState } from '../src/core/state'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  localStorage.clear()
})

const state = () => createInitialState()
const save = (cash: number): Save => JSON.parse(serialize({ ...state(), run: { ...state().run, cash } }, 0))

describe('💾 Data modal', () => {
  it('copyText is false, not a throw, without a clipboard or when it refuses', async () => {
    vi.stubGlobal('navigator', {})
    expect(await copyText('x')).toBe(false)
    vi.stubGlobal('navigator', { clipboard: { writeText: () => Promise.reject(new Error('denied')) } })
    expect(await copyText('x')).toBe(false)
  })

  it('Export shows the auto-selected code, the save ID, and downloads a .txt named after it', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: () => Promise.resolve() } })
    const code = encodeSave(save(5))
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL: vi.fn() })
    render(<DataModal state={state()} exportCode={() => code} applyImport={() => ({ ok: true })} reset={() => {}} />)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Export this save' })))
    const box = screen.getByRole('textbox', { name: 'Exported save' }) as HTMLTextAreaElement
    expect(box.value).toBe(code)
    expect(box.readOnly).toBe(true)
    expect(box.selectionEnd).toBe(code.length) // auto-selected: the mobile copy path
    expect(screen.getByText(code.slice(-8)).tagName).toBe('CODE') // the save ID is the 8-hex CRC
    // Download .txt
    const anchorClick = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(anchorClick)
    fireEvent.click(screen.getByRole('button', { name: 'Download .txt' }))
    expect(anchorClick).toHaveBeenCalledTimes(1)
  })

  it('Import shows one message per decode failure and calls applyImport only on confirm', () => {
    const applyImport = vi.fn((): ImportResult => ({ ok: true }))
    render(<DataModal state={state()} exportCode={() => ''} applyImport={applyImport} reset={() => {}} />)
    const paste = () => screen.getByPlaceholderText('Paste an exported save')
    expect((screen.getByRole('button', { name: 'Check save' }) as HTMLButtonElement).disabled).toBe(true)
    for (const [junk, message] of [
      ['junk', 'That is not a tiles save — nothing changed'],
      ['TILES1.abc', 'The code looks cut off — copy the whole thing again'],
      ['TILES1.Abc.00000000', 'The code is damaged (checksum failed) — nothing changed'],
    ] as const) {
      fireEvent.change(paste(), { target: { value: junk } })
      fireEvent.click(screen.getByRole('button', { name: 'Check save' }))
      expect(screen.getByRole('alert').textContent).toBe(message)
    }
    expect(applyImport).not.toHaveBeenCalled()
    const good = encodeSave(save(9))
    fireEvent.change(paste(), { target: { value: good } })
    fireEvent.click(screen.getByRole('button', { name: 'Check save' }))
    expect(screen.getByRole('table').textContent).toContain('Incoming')
    fireEvent.click(screen.getByRole('button', { name: 'Replace this save' }))
    expect(applyImport).toHaveBeenCalledWith(decodeSave(good))
  })

  it('a newer-version code is rejected with its own message', () => {
    render(<DataModal state={state()} exportCode={() => ''} applyImport={() => ({ ok: true })} reset={() => {}} />)
    fireEvent.change(screen.getByPlaceholderText('Paste an exported save'), {
      target: { value: encodeSave({ ...save(1), version: SAVE_VERSION + 1 } as Save) },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Check save' }))
    expect(screen.getByRole('alert').textContent).toBe('From a newer game version — update the game, then try again')
  })

  it('savedAgo buckets the gap; the Modal closes on backdrop, ✕ and Esc', () => {
    const now = Date.now()
    expect([savedAgo(now - 30_000, now), savedAgo(now - 5 * 60_000, now), savedAgo(now - 3 * 3600_000, now), savedAgo(now - 2 * 86_400_000, now)]).toEqual([
      'just now',
      '5m ago',
      '3h ago',
      '2d ago',
    ])
    const close = vi.fn()
    const { container } = render(
      <Modal title="🗺 Roadmap" close={close}>
        <p>hi</p>
      </Modal>,
    )
    fireEvent.click(container.firstElementChild!) // backdrop
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(close).toHaveBeenCalledTimes(3)
    expect(screen.getByRole('dialog', { name: '🗺 Roadmap' })).toBeTruthy()
  })
})
