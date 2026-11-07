// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Bar } from '../src/app/Bar'

afterEach(cleanup)

describe('Bar', () => {
  it('eases while the value grows and jumps (bar-down) when it drops', () => {
    const { container, rerender } = render(<Bar value={0.5} kind="grow" />)
    const bar = () => container.querySelector('.bar')!
    expect(bar().classList.contains('bar-down')).toBe(false)
    rerender(<Bar value={0.7} kind="grow" />)
    expect(bar().classList.contains('bar-down')).toBe(false)
    expect((bar().firstChild as HTMLElement).style.width).toBe('70%')
    rerender(<Bar value={0} kind="grow" />)
    expect(bar().classList.contains('bar-down')).toBe(true)
    rerender(<Bar value={0} kind="grow" />)
    expect(bar().classList.contains('bar-down')).toBe(true)
    rerender(<Bar value={0.2} kind="grow" />)
    expect(bar().classList.contains('bar-down')).toBe(false)
  })
})
