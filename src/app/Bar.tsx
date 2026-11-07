export function Bar({ value, kind }: { value: number; kind: 'grow' | 'water' | 'energy' | 'rot' | 'tool' }) {
  return (
    <span className={`bar bar-${kind}`}>
      <span style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </span>
  )
}
