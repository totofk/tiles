// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Root } from '../src/app/Root'
import { replayCodeFromHash, replayUrl, withoutHash } from '../src/app/replay'
import { createInitialState } from '../src/core/state'
import { encodeSaveCompact } from '../src/save/codec'
import { SAVE_KEY } from '../src/save/storage'
import { SAVE_VERSION, type Save } from '../src/save/serialize'
import codeV15 from './fixtures/code-v15.txt?raw'

afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe('#replay= URL helpers (batch 39)', () => {
  it('reads the code from the hash, keeps a legacy "+", percent-decodes, and ignores other keys', () => {
    expect(replayCodeFromHash('')).toBeNull()
    expect(replayCodeFromHash('#')).toBeNull()
    expect(replayCodeFromHash('#replay=')).toBeNull()
    expect(replayCodeFromHash('#other=1')).toBeNull()
    expect(replayCodeFromHash('#replay=TILES2.ab-_.0123abcd')).toBe('TILES2.ab-_.0123abcd')
    expect(replayCodeFromHash('#x=1&replay=ab+c/d=')).toBe('ab+c/d=')
    expect(replayCodeFromHash('#replay=%20TILES1.a.b%0A')).toBe('TILES1.a.b')
    expect(replayCodeFromHash('#replay=%E0%A4%A')).toBe('%E0%A4%A') // a broken escape is kept raw, not thrown
  })

  it('replayUrl swaps any hash for #replay=<code>; withoutHash drops it', () => {
    expect(replayUrl('https://x.io/tiles/', 'C')).toBe('https://x.io/tiles/#replay=C')
    expect(replayUrl('https://x.io/tiles/?a=1#old', 'C')).toBe('https://x.io/tiles/?a=1#replay=C')
    expect(withoutHash('https://x.io/tiles/#replay=C')).toBe('https://x.io/tiles/')
    expect(withoutHash('https://x.io/tiles/')).toBe('https://x.io/tiles/')
  })
})

describe('Root boot switch (batch 39)', () => {
  it('a TILES2 report code boots App in replay mode with the banner; the own save is untouched', async () => {
    localStorage.setItem(SAVE_KEY, 'own')
    const state = createInitialState()
    state.run.cash = 31337
    const code = await encodeSaveCompact({ version: SAVE_VERSION, savedAtMs: 0, state } as Save)
    render(<Root hash={`#replay=${code}`} />)
    expect(screen.getByText('🔁 Opening the replay…')).toBeTruthy()
    expect((await screen.findByText(/Replay of a save from v38/)).textContent).toContain('nothing is saved')
    expect(screen.getByRole('button', { name: 'Exit replay' })).toBeTruthy()
    expect(localStorage.getItem(SAVE_KEY)).toBe('own')
  })

  it('an old TILES1 code migrates through the same chain and reports its version', async () => {
    render(<Root hash={`#replay=${codeV15.trim()}`} />)
    expect(await screen.findByText(/Replay of a save from v15/)).toBeTruthy()
  })

  it('a damaged code shows why and a way back, and loads nothing', async () => {
    render(<Root hash="#replay=TILES2.Abc.00000000" />)
    expect((await screen.findByRole('alert')).textContent).toContain('damaged')
    expect(screen.getByRole('button', { name: 'Back to my game' })).toBeTruthy()
  })

  it('no #replay hash renders the normal game', () => {
    render(<Root hash="" />)
    expect(screen.queryByText(/Replay of a save/)).toBeNull()
    expect(screen.queryByText('🔁 Opening the replay…')).toBeNull()
  })
})
