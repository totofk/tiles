// Batch 32.2 task 176: the press ripple on every <button>, one delegated listener — the look lives in app.css
// (`:where(button)::after`). No DOM nodes, React state or timers per press: alternating data-ripple a / b restarts the
// animation without the remove-class + reflow trick (a forced layout on every Dig tap).
export function installRipple(doc: Document = document): () => void {
  const reduced = doc.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)')
  const onDown = (e: PointerEvent) => {
    if (e.button > 0 || reduced?.matches) return
    const b = (e.target as Element).closest?.('button')
    if (!b || b.disabled || b.getAttribute('aria-disabled') === 'true') return
    const r = b.getBoundingClientRect()
    b.style.setProperty('--rx', `${e.clientX - r.left}px`)
    b.style.setProperty('--ry', `${e.clientY - r.top}px`)
    b.dataset.ripple = b.dataset.ripple === 'a' ? 'b' : 'a'
  }
  doc.addEventListener('pointerdown', onDown, { passive: true })
  return () => doc.removeEventListener('pointerdown', onDown)
}
