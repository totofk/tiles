const clamp = (v: number) => Math.max(0, Math.min(1, v))

/** 0 … 1 fills the bar; anything above 1 (moisture from a copper can) shows as a darker band over it */
export function Bar({ value, kind }: { value: number; kind: 'grow' | 'water' | 'energy' | 'rot' | 'tool' }) {
  return (
    <span className={`bar bar-${kind}`}>
      <span style={{ width: `${clamp(value) * 100}%` }} />
      {value > 1 && <span className="bar-over" style={{ width: `${clamp(value - 1) * 100}%` }} />}
    </span>
  )
}
