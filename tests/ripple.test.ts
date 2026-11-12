// @vitest-environment jsdom
/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { installRipple } from '../src/app/ripple'

// jsdom: zero rects (so --rx = clientX) and no matchMedia
const press = (el: Element, init: MouseEventInit = {}) => el.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 12, clientY: 7, ...init }))
const button = (attrs: Record<string, string> = {}) => {
  const b = document.createElement('button')
  for (const [k, v] of Object.entries(attrs)) b.setAttribute(k, v)
  b.appendChild(document.createElement('span'))
  document.body.appendChild(b)
  return b
}

let uninstall = () => {}
afterEach(() => {
  uninstall()
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

describe('batch 32.2 task 176: the button press ripple', () => {
  it('a press on a span inside a button sets data-ripple a / b / a and --rx / --ry; no DOM nodes are added', () => {
    uninstall = installRipple()
    const b = button()
    const nodes = b.childNodes.length
    press(b.firstElementChild!)
    expect([b.dataset.ripple, b.style.getPropertyValue('--rx'), b.style.getPropertyValue('--ry')]).toEqual(['a', '12px', '7px'])
    press(b.firstElementChild!)
    expect(b.dataset.ripple).toBe('b')
    press(b)
    expect(b.dataset.ripple).toBe('a')
    expect(b.childNodes.length).toBe(nodes)
  })

  it('no ripple on a disabled or aria-disabled button, a non-primary press, or a press outside any button', () => {
    uninstall = installRipple()
    const disabled = button({ disabled: '' })
    const aria = button({ 'aria-disabled': 'true' })
    const plain = button()
    const outside = document.createElement('div')
    document.body.appendChild(outside)
    expect(() => {
      press(disabled)
      press(aria)
      press(plain, { button: 2 })
      press(outside)
    }).not.toThrow()
    for (const b of [disabled, aria, plain]) expect(b.hasAttribute('data-ripple')).toBe(false)
  })

  it('no ripple under prefers-reduced-motion: reduce', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q === '(prefers-reduced-motion: reduce)' }))
    uninstall = installRipple()
    const b = button()
    press(b)
    expect(b.hasAttribute('data-ripple')).toBe(false)
  })

  it('after the uninstall a press sets nothing', () => {
    installRipple()()
    const b = button()
    press(b)
    expect(b.hasAttribute('data-ripple')).toBe(false)
  })

  it('CSS: @property --ripple; the keyframes animate no layout or ring property; reduced motion turns it off', () => {
    // under jsdom import.meta.url is not a file: URL, so the path is from the repo root (vitest's cwd)
    const css = readFileSync('src/app/app.css', 'utf8')
    expect(css).toContain('@property --ripple')
    for (const name of ['ripple-a', 'ripple-b']) {
      const body = css.match(new RegExp(`@keyframes ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1]
      expect(body).toBeDefined()
      expect(body).not.toMatch(/transform|width|height|top|left|box-shadow|outline/)
    }
    const reduce = [...css.matchAll(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/g)].map((m) => m[1])
    expect(reduce.some((b) => /button\)::after[\s\S]*animation: none/.test(b))).toBe(true)
  })
})
