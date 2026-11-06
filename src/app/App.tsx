import { useState } from 'react'
import { STARTING_CROP, type CropId } from '../core/data/crops'
import { tapTile } from '../core/tile'
import { FarmGrid } from './FarmGrid'
import { Hud } from './Hud'
import { Shop } from './Shop'
import { useGame } from './useGame'

export default function App() {
  const { state, act, reset, toast, banner, dismissBanner } = useGame()
  const [cropId, setCropId] = useState<CropId>(STARTING_CROP)

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
      <FarmGrid state={state} onTap={(i) => act((s) => tapTile(s, i, cropId), 'Growing — water it when dry')} />
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
