import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'

/** a Shop / Upgrades row: its buy button with the ⓘ in the corner */
export function Item({ tip, children }: { tip: string; children: ReactNode }) {
  return (
    <div className="item">
      {children}
      <Info text={tip} />
    </div>
  )
}

/** px kept free between the tip and the viewport edges (app.css caps the tip at 100vw − 2 × this) */
const TIP_MARGIN = 8
/** px between the ⓘ and its tip */
const TIP_GAP = 4

type Rect = { top: number; bottom: number; left: number; width: number }
type Size = { width: number; height: number }

/** fixed-position tip: below the ⓘ, above it when it would pass the viewport bottom, centred and clamped left/right */
export function placeTip(anchor: Rect, tip: Size, viewport: Size): { top: number; left: number } {
  const below = anchor.bottom + TIP_GAP
  const above = anchor.top - TIP_GAP - tip.height
  const flip = below + tip.height > viewport.height - TIP_MARGIN && above >= TIP_MARGIN
  const centred = anchor.left + anchor.width / 2 - tip.width / 2
  const left = Math.max(TIP_MARGIN, Math.min(centred, viewport.width - TIP_MARGIN - tip.width))
  return { top: flip ? above : below, left }
}

/**
 * ⓘ button + tip, rendered as siblings of the row's own button (a button cannot hold a button).
 * The tip floats (position: fixed), so it moves no row and no scrolling panel clips it. A mouse hover or keyboard
 * focus shows it; a tap or click pins it until a second tap, Esc, a pointer-down elsewhere or a scroll.
 */
export function Info({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const [hover, setHover] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const btn = useRef<HTMLButtonElement>(null)
  const tip = useRef<HTMLSpanElement>(null)
  const id = useId()
  const shown = open || hover

  useLayoutEffect(() => {
    if (!shown || !btn.current || !tip.current) return setPos(null)
    const { width, height } = tip.current.getBoundingClientRect()
    setPos(placeTip(btn.current.getBoundingClientRect(), { width, height }, { width: window.innerWidth, height: window.innerHeight }))
  }, [shown])

  useEffect(() => {
    if (!shown) return
    const close = () => {
      setOpen(false)
      setHover(false)
    }
    const outside = (e: PointerEvent) => {
      const t = e.target as Node
      if (!btn.current?.contains(t) && !tip.current?.contains(t)) close()
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && close()
    // scroll does not bubble: capture catches the panel's, the column's and the page's own scroll
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', esc)
    document.addEventListener('scroll', close, true)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', esc)
      document.removeEventListener('scroll', close, true)
    }
  }, [shown])

  return (
    <>
      <button
        ref={btn}
        type="button"
        className="info-btn"
        aria-label="More info"
        aria-expanded={shown}
        aria-describedby={id}
        onClick={() => setOpen(!open)}
        // mouse only: a touch tap also fires an emulated enter, which would open the tip the click then closes
        onPointerEnter={(e) => e.pointerType === 'mouse' && setHover(true)}
        onPointerLeave={(e) => e.pointerType === 'mouse' && setHover(false)}
        onFocus={(e) => e.currentTarget.matches(':focus-visible') && setHover(true)}
        onBlur={() => setHover(false)}
      >
        ⓘ
      </button>
      <span ref={tip} id={id} className="tip" role="tooltip" hidden={!shown} style={pos ?? undefined}>
        {text}
      </span>
    </>
  )
}
