// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FeedbackCard } from '../src/app/FeedbackCard'
import { COOLDOWN_MS, EMPTY_FEEDBACK } from '../src/app/feedback'
import { createInitialState } from '../src/core/state'
import { decodeSave } from '../src/save/codec'

const post = vi.fn<typeof fetch>()
beforeEach(() => {
  post.mockReset().mockResolvedValue(new Response())
  vi.stubGlobal('fetch', post)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

function Host() {
  const [feedback, setFeedback] = useState(EMPTY_FEEDBACK)
  return <FeedbackCard state={createInitialState()} feedback={feedback} setFeedback={setFeedback} />
}

const field = (name: RegExp) => screen.getByRole('textbox', { name }) as HTMLInputElement
const type = (name: RegExp, value: string) => fireEvent.change(field(name), { target: { value } })
const sendButton = () => screen.getByRole('button', { name: /^(Send|Retry|Sending)/ }) as HTMLButtonElement
const fill = () => {
  type(/Title/, 'Hi')
  type(/Details/, 'More please')
}
const press = async () => {
  await act(async () => fireEvent.click(sendButton()))
}
const sentDetails = () => new URLSearchParams(String(post.mock.calls[0][1]!.body)).get('entry.1552861218')!

describe('💬 Feedback card', () => {
  it('Send stays disabled until title and details are non-blank; kind defaults to Feedback', () => {
    render(<Host />)
    expect(screen.getByRole('button', { name: 'Feedback' }).getAttribute('aria-pressed')).toBe('true')
    expect(sendButton().disabled).toBe(true)
    type(/Title/, '  ')
    type(/Details/, 'text')
    expect(sendButton().disabled).toBe(true)
    type(/Title/, 'ok')
    expect(sendButton().disabled).toBe(false)
    expect(screen.getByText('2/80')).toBeTruthy()
  })

  it('sends the picked kind and a context block, then clears and thanks; the mine worker is in it (iron is open)', async () => {
    render(<Host />)
    fireEvent.click(screen.getByRole('button', { name: 'Idea' }))
    fill()
    await press()
    expect(post).toHaveBeenCalledTimes(1)
    const body = new URLSearchParams(String(post.mock.calls[0][1]!.body))
    expect(body.get('entry.247767374')).toBe('Idea')
    expect(sentDetails()).toMatch(/^More please\n\n---\nBuild: \S+\nSave: v\d+\nScreen: .+\nUA: .+\nTime: \d{4}-.+Z\nGame: cash /)
    expect(sentDetails()).toContain('fuel 0, mine 0, clerk 0)')
    expect(screen.getByRole('status').textContent).toBe('Sent — thank you')
    expect(field(/Title/).value).toBe('')
  })

  it('attaches the live save as the last body line, no timeline; the form says so (task 123)', async () => {
    render(<Host />)
    fill()
    await press()
    const details = sentDetails()
    expect(details).not.toContain('Timeline:')
    const code = details.split('Save code: ')[1]!
    expect(code).toMatch(/^TILES1\./)
    const decoded = decodeSave(code)
    expect(decoded.state.run.cash).toBe(20)
    expect(decoded.state.run.tiles).toHaveLength(createInitialState().run.tiles.length)
    expect(screen.getByText('Your save and game stats are attached.')).toBeTruthy()
  })

  it('one send per 30 s', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
    render(<Host />)
    fill()
    await press()
    fill()
    expect(sendButton().textContent).toBe('Send (wait 30 s)')
    expect(sendButton().disabled).toBe(true)
    act(() => vi.advanceTimersByTime(COOLDOWN_MS - 1000))
    expect(sendButton().textContent).toBe('Send (wait 1 s)')
    act(() => vi.advanceTimersByTime(1000))
    expect(sendButton().disabled).toBe(false)
  })

  it('a filled honeypot pretends success and sends nothing', async () => {
    render(<Host />)
    fill()
    fireEvent.change(document.querySelector('input[name="website"]')!, { target: { value: 'http://spam' } })
    await press()
    expect(post).not.toHaveBeenCalled()
    expect(screen.getByRole('status').textContent).toBe('Sent — thank you')
  })

  it('a network error keeps the text and offers Retry', async () => {
    post.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    render(<Host />)
    fill()
    await press()
    expect(screen.getByRole('alert').textContent).toBe('Could not send — check your connection')
    expect(field(/Title/).value).toBe('Hi')
    expect(sendButton().textContent).toBe('Retry')
    await press()
    expect(post).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('status').textContent).toBe('Sent — thank you')
  })
})
