import { useId, useState, type ReactNode } from 'react'

/** a Shop / Upgrades row: its buy button with the ⓘ in the corner */
export function Item({ tip, children }: { tip: string; children: ReactNode }) {
  return (
    <div className="item">
      {children}
      <Info text={tip} />
    </div>
  )
}

/**
 * ⓘ button + tip, rendered as siblings of the row's own button (a button cannot hold a button).
 * Desktop shows the tip on hover via CSS; a tap toggles it on touch.
 */
export function Info({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <>
      <button type="button" className="info-btn" aria-label="More info" aria-expanded={open} aria-describedby={id} onClick={() => setOpen(!open)}>
        ⓘ
      </button>
      <span id={id} className="tip" role="tooltip" hidden={!open}>
        {text}
      </span>
    </>
  )
}
