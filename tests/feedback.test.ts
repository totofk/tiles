import { describe, expect, it, vi } from 'vitest'
import {
  COOLDOWN_MS,
  EMPTY_DRAFT,
  FORM_URL,
  buildFeedbackBody,
  canSend,
  cooldownLeft,
  sendFeedback,
  type FeedbackContext,
} from '../src/app/feedback'
import { createInitialState } from '../src/core/state'
import { decodeSave, encodeSave } from '../src/save/codec'
import { SAVE_VERSION } from '../src/save/serialize'

const state = createInitialState()
const saveCode = encodeSave({ version: SAVE_VERSION, savedAtMs: 0, state })
const ctx: FeedbackContext = {
  build: 'abc1234',
  saveVersion: 11,
  screen: '375×812 @3',
  ua: 'TestUA/1.0',
  time: '2026-11-08T00:00:00.000Z',
  summary: 'cash 20 · vein Lv0',
  saveCode,
}
const draft = { ...EMPTY_DRAFT, kind: 'Bug report' as const, title: ' Furnace stuck ', details: 'It stopped.\n', contact: 'me@x.y' }

describe('buildFeedbackBody', () => {
  it('maps the fields to the form entries and appends the context block after ---', () => {
    const body = buildFeedbackBody(draft, ctx)
    expect([...body.keys()]).toEqual(['entry.247767374', 'entry.544014453', 'entry.1552861218', 'entry.767920014'])
    expect(body.get('entry.247767374')).toBe('Bug report')
    expect(body.get('entry.544014453')).toBe('Furnace stuck')
    expect(body.get('entry.767920014')).toBe('me@x.y')
    expect(body.get('entry.1552861218')).toBe(
      'It stopped.\n\n---\nBuild: abc1234\nSave: v11\nScreen: 375×812 @3\nUA: TestUA/1.0\nTime: 2026-11-08T00:00:00.000Z\n' +
        'Game: cash 20 · vein Lv0\n' +
        `Save code: ${saveCode}`,
    )
  })

  it('the last line is the live save as a TILES1 code that decodeImport round-trips; no Timeline lines (task 123)', () => {
    const details = buildFeedbackBody(draft, ctx).get('entry.1552861218')!
    expect(details).not.toContain('Timeline:')
    const code = details.split('Save code: ')[1]!
    const decoded = decodeSave(code)
    expect(decoded.version).toBe(SAVE_VERSION)
    expect(decoded.state.run.cash).toBe(state.run.cash)
    expect(decoded.state.run.tiles).toHaveLength(state.run.tiles.length)
    expect(decoded.state.run.milestones).toEqual(state.run.milestones)
  })

  it('an empty contact is sent empty; the honeypot is never sent', () => {
    const body = buildFeedbackBody({ ...draft, contact: '', website: 'spam' }, ctx)
    expect(body.get('entry.767920014')).toBe('')
    expect(body.toString()).not.toContain('spam')
  })
})

describe('canSend / cooldownLeft', () => {
  it('needs a non-blank title and details', () => {
    expect(canSend(EMPTY_DRAFT)).toBe(false)
    expect(canSend({ ...draft, title: '   ' })).toBe(false)
    expect(canSend({ ...draft, details: ' \n ' })).toBe(false)
    expect(canSend(draft)).toBe(true)
  })

  it('one send per 30 s', () => {
    expect(cooldownLeft(null, 5)).toBe(0)
    expect(cooldownLeft(1000, 1000)).toBe(COOLDOWN_MS)
    expect(cooldownLeft(1000, 1000 + COOLDOWN_MS - 1)).toBe(1)
    expect(cooldownLeft(1000, 1000 + COOLDOWN_MS)).toBe(0)
  })
})

describe('sendFeedback (mocked fetch)', () => {
  it('POSTs no-cors to the form and reports sent', async () => {
    const post = vi.fn(async () => new Response())
    expect(await sendFeedback(draft, ctx, post)).toBe('sent')
    expect(post).toHaveBeenCalledWith(FORM_URL, { method: 'POST', mode: 'no-cors', body: buildFeedbackBody(draft, ctx) })
  })

  it('a filled honeypot pretends success and sends nothing', async () => {
    const post = vi.fn(async () => new Response())
    expect(await sendFeedback({ ...draft, website: 'http://spam' }, ctx, post)).toBe('sent')
    expect(post).not.toHaveBeenCalled()
  })

  it('a network error is failed, never a throw', async () => {
    const post = vi.fn(async () => Promise.reject(new TypeError('Failed to fetch')))
    expect(await sendFeedback(draft, ctx, post)).toBe('failed')
  })
})
