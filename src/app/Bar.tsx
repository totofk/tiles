import { useState } from 'react'

const clamp = (v: number) => Math.max(0, Math.min(1, v))

/**
 * 0 … 1 fills the bar; anything above 1 (moisture from a copper can) shows as a darker band over it. The fill eases
 * over a tick while it grows (CSS); `bar-down` turns that off when the value drops, so a reset jumps instead of sliding.
 */
export function Bar({ value, kind }: { value: number; kind: 'grow' | 'water' | 'energy' | 'rot' | 'tool' | 'fire' }) {
  // the value seen last render, kept in state (React's "previous props" pattern) so StrictMode renders agree
  const [prev, setPrev] = useState(value)
  const [down, setDown] = useState(false)
  if (value !== prev) {
    setPrev(value)
    setDown(value < prev)
  }
  return (
    <span className={`bar bar-${kind}${down ? ' bar-down' : ''}`}>
      <span style={{ width: `${clamp(value) * 100}%` }} />
      {value > 1 && <span className="bar-over" style={{ width: `${clamp(value - 1) * 100}%` }} />}
    </span>
  )
}
