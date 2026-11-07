import { useRef, useState } from 'react'
import { CROPS, STARTING_CROP, type CropId } from '../core/data/crops'
import { isMature, tapTile } from '../core/tile'
import { FarmGrid } from './FarmGrid'
import { Hud } from './Hud'
import { Shop } from './Shop'
import { useGame } from './useGame'

/** display-only: ignore taps on a tile for this long after harvesting it */
const TAP_GUARD_MS = 400

export default function App() {
  const { state, act, reset, toast, banner, dismissBanner } = useGame()
  const [cropId, setCropId] = useState<CropId>(STARTING_CROP)
  // per tile: taps before this performance.now() are ignored, so a double tap at harvest cannot replant
  const guardUntil = useRef<Record<number, number>>({})

  const onTap = (i: number) => {
    const now = performance.now()
    if (now < (guardUntil.current[i] ?? 0)) return
    act(
      (s) => tapTile(s, i, cropId),
      (prev, next) => {
        const tile = prev.run.tiles[i]
        if (!isMature(tile, prev.meta)) return null
        guardUntil.current[i] = now + TAP_GUARD_MS
        return `+💰${next.run.cash - prev.run.cash} ${CROPS[tile.cropId!].name}`
      },
    )
  }

  return (
    <main className="app">
      <Hud state={state} />
      {banner && (
        <div className="banner" role="status">
          <span>{banner}</span>
          <button aria-label="Dismiss" onClick={dismissBanner}>
            ✕
          </button>
        </div>
      )}
      <FarmGrid state={state} onTap={onTap} />
      <Shop state={state} cropId={cropId} onSelectCrop={setCropId} act={act} />
      <button
        className="reset"
        onClick={() => {
          if (!window.confirm('Reset save? All progress is lost.')) return
          reset()
          setCropId(STARTING_CROP)
        }}
      >
        Reset save
      </button>
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </main>
  )
}
