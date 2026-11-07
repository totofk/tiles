// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ARM_MS, DangerZone } from '../src/app/DangerZone'

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const button = () => screen.getByRole('button')

describe('Danger zone', () => {
  it('first press arms for 5 s, then reverts without resetting', () => {
    const reset = vi.fn()
    render(<DangerZone reset={reset} />)
    expect(button().textContent).toBe('Reset save')
    fireEvent.click(button())
    expect(button().textContent).toBe('Press again to erase everything')
    act(() => vi.advanceTimersByTime(ARM_MS - 1))
    expect(button().textContent).toBe('Press again to erase everything')
    act(() => vi.advanceTimersByTime(1))
    expect(button().textContent).toBe('Reset save')
    expect(reset).not.toHaveBeenCalled()
  })

  it('arm → second press resets once and disarms', () => {
    const reset = vi.fn()
    render(<DangerZone reset={reset} />)
    fireEvent.click(button())
    fireEvent.click(button())
    expect(reset).toHaveBeenCalledTimes(1)
    expect(button().textContent).toBe('Reset save')
  })

  it('Esc cancels the armed state', () => {
    const reset = vi.fn()
    render(<DangerZone reset={reset} />)
    fireEvent.click(button())
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(button().textContent).toBe('Reset save')
    fireEvent.click(button())
    expect(reset).not.toHaveBeenCalled()
  })
})
