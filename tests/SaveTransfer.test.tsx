// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SaveTransfer, copyText } from '../src/app/SaveTransfer'
import type { ImportResult } from '../src/save/storage'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const paste = () => screen.getByPlaceholderText('Paste an exported save')

describe('SaveTransfer', () => {
  it('copyText is false, not a throw, without a clipboard or when it refuses', async () => {
    vi.stubGlobal('navigator', {})
    expect(await copyText('x')).toBe(false)
    vi.stubGlobal('navigator', { clipboard: { writeText: () => Promise.reject(new Error('denied')) } })
    expect(await copyText('x')).toBe(false)
  })

  it('Export copies the code and shows it in a read-only box', async () => {
    const writeText = vi.fn(() => Promise.resolve())
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    render(<SaveTransfer exportCode={() => 'QUJD'} importCode={() => ({ ok: true })} />)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Export save' })))
    expect(writeText).toHaveBeenCalledWith('QUJD')
    expect(screen.getByRole('status').textContent).toBe('Copied — keep it somewhere safe')
    const box = screen.getByRole('textbox', { name: 'Exported save' }) as HTMLTextAreaElement
    expect([box.value, box.readOnly]).toEqual(['QUJD', true])
  })

  it('Import needs a paste and two presses; a bad save shows an error line', () => {
    const importCode = vi.fn((): ImportResult => ({ ok: false, error: 'BAD_SAVE' }))
    render(<SaveTransfer exportCode={() => null} importCode={importCode} />)
    expect((screen.getByRole('button', { name: 'Import save' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(paste(), { target: { value: 'junk' } })
    fireEvent.click(screen.getByRole('button', { name: 'Import save' }))
    expect(importCode).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Press again to replace this save' }))
    expect(importCode).toHaveBeenCalledWith('junk')
    expect(screen.getByRole('alert').textContent).toBe('That is not a tiles save — nothing changed')
    expect((paste() as HTMLTextAreaElement).value).toBe('junk')
  })

  it('a good import clears the box and says the old save is kept', () => {
    render(<SaveTransfer exportCode={() => null} importCode={() => ({ ok: true })} />)
    fireEvent.change(paste(), { target: { value: 'QUJD' } })
    fireEvent.click(screen.getByRole('button', { name: 'Import save' }))
    fireEvent.click(screen.getByRole('button', { name: 'Press again to replace this save' }))
    expect(screen.getByRole('status').textContent).toBe('Save imported — the old one is kept as a backup')
    expect((paste() as HTMLTextAreaElement).value).toBe('')
  })
})
