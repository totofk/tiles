import { memo, useCallback, useState, type CSSProperties } from 'react'
import { fieldPlots, pivotCost, plotTiles, pumpCost, pumpFieldCap } from '../core/balance'
import { CROPS, type CropId } from '../core/data/crops'
import {
  buildPivot,
  buyPlot,
  fieldsPaybackHours,
  fieldsPlantable,
  pinField,
  pivotsOwned,
  reapPlot,
  setFieldCrop,
  sowPlot,
} from '../core/fields'
import type { GameState } from '../core/state'
import { SPRINKLER_EMOJI } from '../core/workshop'
import { CROP_EMOJI } from './FarmGrid'
import { priceTag } from './marketText'
import { priceText } from './Mine'
import { Modal } from './Modal'
import type { UiState } from './uiState'
import type { Act } from './useGame'
import { shortOf } from './Workshop'
import { compactCash, cropOptionText, estateCropIncomePerHour, ghostRowPrice, plotCellView, type PlotCellKind } from './estateText'

export const ORDER_EMOJI = '📋' // Unicode 6
export const BEYOND_EMOJI = '🚱' // Unicode 6
const PIN_EMOJI = '📌' // Unicode 6
const MARKER_EMOJI = '🚜' // Unicode 6

type CellProps = {
  kind: PlotCellKind
  emoji: string
  /** whole percent, so a quiet tick does not re-render a growing cell */
  pct: number
  label: string
  marker: boolean
  ordered: boolean
  k: number
  j: number
  /** the ghost cell's price and payback lines ('' / 0 on every other cell) */
  price: string
  payback: number
  onTap: (k: number, j: number, kind: PlotCellKind) => void
}

/** one plot square (batch 30, task 152c); memo'd so a tick re-renders only the cells whose view changed */
export const PlotCell = memo(function PlotCell({ kind, emoji, pct, label, marker, ordered, k, j, price, payback, onTap }: CellProps) {
  if (kind === 'none') return <span className="map-cell map-none" aria-hidden="true" />
  return (
    <button className={`map-cell map-${kind}`} aria-label={label} onClick={() => onTap(k, j, kind)}>
      {kind === 'ghost' ? (
        <>
          <small>＋ plot</small>
          <small>{`💰${price}`}</small>
          {payback > 0 && <small>{`~${payback} h`}</small>}
        </>
      ) : (
        emoji && <span aria-hidden="true">{emoji}</span>
      )}
      {kind === 'growing' && <span className="map-bar" style={{ '--pct': `${pct}%` } as CSSProperties} />}
      {ordered && <span className="map-badge map-badge-order" aria-hidden="true">{ORDER_EMOJI}</span>}
      {marker && <span className="map-badge map-marker" aria-hidden="true">{MARKER_EMOJI}</span>}
    </button>
  )
})

/**
 * The Estate map (batch 30): a legend, one row per field the pump waters — a chip that opens the field sheet, then
 * five plot squares (tap to sow / reap / buy) — the collapsed row past the pump, and the ghost field.
 */
export function EstateMap({ state, act, ui }: { state: GameState; act: Act; ui: UiState }) {
  const { run, meta } = state
  const { list, pump } = run.fields
  const cap = pumpFieldCap(pump)
  const [sheet, setSheet] = useState<number | null>(null)
  const onTap = useCallback(
    (k: number, j: number, kind: PlotCellKind) => {
      if (kind === 'dry') setSheet(k)
      else if (kind === 'empty') act((s) => sowPlot(s, k, j), (prev) => `🌱 Sowed ${plotTiles()} tiles of ${CROPS[prev.run.fields.list[k].crop!].name}`)
      else if (kind === 'ready') act((s) => reapPlot(s, k, j), (prev) => `🌾 Reaped ${CROPS[prev.run.fields.list[k].plots[j].crop!].name}`)
      else if (kind === 'growing') act((s) => reapPlot(s, k, j))
      else if (kind === 'ghost') act(buyPlot)
    },
    [act, setSheet],
  )
  const price = compactCash(ghostRowPrice(state))
  const payback = fieldsPaybackHours(state)
  const n = list.length
  const nextPump = n >= cap ? pumpCost(pump, meta) : null
  const ghostField = !list.every((f) => f.plots.length >= fieldPlots())
    ? null
    : n < cap
      ? `＋ Field ${n + 1} · opens with the next plot`
      : nextPump && `＋ Field ${n + 1} · needs Pump Lv${pump + 1} · ${priceText(nextPump)}`
  return (
    <>
      <p className="map-legend">1 square = 1 plot of 10 tiles · a field = 5 plots under one ⛲ pivot</p>
      <div className="map-rows">
        {list.slice(0, cap).map((field, k) => (
          <div className="map-row" key={k}>
            <button
              className="map-chip"
              aria-label={`Field ${k + 1} · ${field.crop ? CROPS[field.crop].name : 'no crop'}${field.pinned ? ' · pinned' : ''}${field.pivot ? '' : ' · no pivot'} — open`}
              onClick={() => setSheet(k)}
            >
              <span aria-hidden="true">{!field.pivot ? BEYOND_EMOJI : field.crop ? CROP_EMOJI[field.crop] : '—'}</span>
              <small>{`${field.pinned ? PIN_EMOJI : ''}F${k + 1}`}</small>
              <span className={`map-badge ${field.pivot ? 'map-badge-pivot' : 'map-badge-none'}`} aria-hidden="true">
                {field.pivot ? SPRINKLER_EMOJI : '＋'}
              </span>
            </button>
            {Array.from({ length: fieldPlots() }, (_, j) => {
              const v = plotCellView(state, k, j)
              return (
                <PlotCell
                  key={j}
                  kind={v.kind}
                  emoji={v.emoji}
                  pct={Math.round(v.pct * 100)}
                  label={v.label}
                  marker={v.marker}
                  ordered={v.ordered}
                  k={k}
                  j={j}
                  price={v.kind === 'ghost' ? price : ''}
                  payback={v.kind === 'ghost' ? payback : 0}
                  onTap={onTap}
                />
              )
            })}
          </div>
        ))}
        {n > cap && (
          <div className="estate-row">
            <span>{`Fields ${cap + 1}–${n} · ${BEYOND_EMOJI} beyond Pump ${pump}`}</span>
          </div>
        )}
        {ghostField && <p className="map-ghost-field">{ghostField}</p>}
      </div>
      {sheet !== null && sheet < n && <FieldSheet state={state} act={act} ui={ui} k={sheet} close={() => setSheet(null)} />}
    </>
  )
}

/** the field sheet a chip opens (batch 30, task 153b): the pivot, the crop pick and the 📌 pin */
function FieldSheet({ state, act, ui, k, close }: { state: GameState; act: Act; ui: UiState; k: number; close: () => void }) {
  const { run, meta } = state
  const f = run.fields
  const field = f.list[k]
  const pivotPrice = pivotCost(pivotsOwned(f) + 1, meta)
  const short = shortOf(pivotPrice, run)
  const atCap = pivotsOwned(f) >= pumpFieldCap(f.pump)
  const pick = (crop: CropId | null) => {
    act(
      (s) => {
        // a hand pick while a Manager works pins the field, so the Manager does not flip it back
        const picked = setFieldCrop(s, k, crop)
        return picked.ok && s.run.workers.assigned.manager > 0 && !s.run.fields.list[k].pinned ? pinField(picked.state, k) : picked
      },
      () => `Field ${k + 1} → ${crop ? CROPS[crop].name : 'no crop'} at the next sowing`,
    )
    close()
  }
  return (
    <Modal title={`Field ${k + 1} · ${field.plots.length}/${fieldPlots()} plots · ${field.plots.length * plotTiles()} tiles`} close={close}>
      {!field.pivot ? (
        <>
          <p className="sheet-line">{`${SPRINKLER_EMOJI} Pivot — waters this field's plots forever · Permanent`}</p>
          <p className="sheet-price">{priceText(pivotPrice)}</p>
          {atCap ? (
            <p className="sheet-short">{`Pump ${f.pump} waters ${pumpFieldCap(f.pump)} fields — build Pump ${f.pump + 1}`}</p>
          ) : (
            short.length > 0 && <p className="sheet-short">needs {short.join(', ')} more</p>
          )}
          <button
            className="sheet-build"
            disabled={!buildPivot(state, k).ok}
            onClick={() =>
              act(
                (s) => buildPivot(s, k),
                () => {
                  close()
                  return null
                },
              )
            }
          >
            Build
          </button>
        </>
      ) : (
        field.crop && <p className="sheet-line">{`≈💰${estateCropIncomePerHour(state, k)}/h · ${priceTag(state, field.crop, ui.priceShown[field.crop])}`}</p>
      )}
      <p className="sheet-line">Crop — applies at the next sowing; standing plots finish as they are</p>
      <div className="map-crops">
        {run.licenses.map((c) => (
          <button key={c} disabled={!fieldsPlantable(run, c)} aria-pressed={field.crop === c} onClick={() => pick(c)}>
            {cropOptionText(state, k, c)}
          </button>
        ))}
        <button aria-pressed={field.crop === null} onClick={() => pick(null)}>
          No crop
        </button>
      </div>
      {run.workers.certificates.includes('manager') && (
        <button className="map-pin" aria-pressed={field.pinned} onClick={() => act((s) => pinField(s, k))}>
          {`${PIN_EMOJI} Pinned — the 💼 Manager skips this field`}
        </button>
      )}
    </Modal>
  )
}
