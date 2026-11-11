import {
  FIELD_PRESSURE,
  TANK_UNITS_PER_COAL,
  fieldPlots,
  machineCost,
  machineMaintPerHour,
  machineMaxTiers,
  machineTilesPerHour,
  pivotCost,
  pumpCost,
  pumpFieldCap,
  tankCapCoal,
  valveCost,
} from '../core/balance'
import { CROPS, type CropId } from '../core/data/crops'
import { ITEMS } from '../core/data/items'
import { isOffer } from '../core/orders'
import type { GameState, Offer } from '../core/state'
import {
  buildPivot,
  buyMachine,
  buyPlot,
  buyPump,
  fieldsOverview,
  fieldsPaybackHours,
  fieldsPlantable,
  fieldsPressure,
  fillTank,
  pivotsOwned,
  plotState,
  reapNext,
  reapPlot,
  setFieldCrop,
  sowNext,
  sowPlot,
} from '../core/fields'
import { CROP_EMOJI } from './FarmGrid'
import { goodEmoji } from './Orders'
import { priceTag } from './marketText'
import { priceText } from './Mine'
import type { UiState } from './uiState'
import { ERROR_TEXT, type Act } from './useGame'
import { RecipeRow, VALVE_EMOJI } from './Workshop'
import { buyValve } from '../core/workshop'
import { estateBottleneck, estateCropIncomePerHour, fleetTilesPerHour, ghostRowPrice, nextReadyText } from './estateText'

const PUMP_EMOJI = '🚰' // Unicode 6
const ORDER_EMOJI = '📋' // Unicode 6
const WATER_EMOJI = '💧' // Unicode 6
const SEEDER_EMOJI = '🌱' // Unicode 6
const HARVESTER_EMOJI = '🌾' // Unicode 6
const TANK_EMOJI = '⛽' // Unicode 5.2
const BEYOND_EMOJI = '🚱' // Unicode 6
const MACHINE_NAMES = { harvester: 'Harvester', seeder: 'Seeder' } as const
const MACHINE_VERBS = { harvester: 'harvests', seeder: 'plants' } as const

/**
 * The phone Estate stop's tool bar (batch 27, task 144; plots since batch 28): Sow / Reap / ＋ Plot where the 🧰 Tools
 * bar sits on the Home stop.
 */
export function EstateBar({ state, act }: { state: GameState; act: Act }) {
  const sow = sowNext(state)
  return (
    <div className="tools estate-tools">
      <button disabled={!sow.ok} title={sow.ok ? undefined : ERROR_TEXT[sow.error]} onClick={() => act(sowNext)}>
        🌱 Sow
      </button>
      <button disabled={!reapNext(state).ok} onClick={() => act(reapNext)}>
        {`🌾 Reap · ${fieldsOverview(state.run).ready}`}
      </button>
      <button disabled={!buyPlot(state).ok} onClick={() => act(buyPlot)}>
        ＋ Plot
      </button>
    </div>
  )
}

/** the field's oldest ready plot and its first empty one (-1 = none) */
function fieldTargets(state: GameState, k: number): { ready: number; empty: number; readyCount: number; next: number | null } {
  const { run } = state
  const plots = run.fields.list[k].plots
  let ready = -1
  let next: number | null = null
  plots.forEach((p, j) => {
    const st = plotState(p, run.tick)
    if (st === 'ready' && (ready < 0 || p.readyTick < plots[ready].readyTick)) ready = j
    if (st === 'growing') next = Math.min(next ?? Infinity, p.readyTick - run.tick)
  })
  const readyCount = plots.filter((p) => plotState(p, run.tick) === 'ready').length
  return { ready, empty: plots.findIndex((p) => p.crop === null), readyCount, next }
}

/**
 * The 🚜 Estate stop's content (batch 27, task 143; plots since batch 28, task 148): a capacity strip, the MiniLot,
 * one row per field the pump waters (crop chip, Sow / Build pivot, Reap) and one collapsed row for the rest, the
 * Expand group (next plot, pump, fill tank, smart valve), and the machines behind a closed details.
 */
export function Estate({ state, act, ui, lot }: { state: GameState; act: Act; ui: UiState; lot?: React.ReactNode }) {
  const { run, meta } = state
  if (!run.fields.unlocked) return null
  const { emptyWet, ready, wetFields } = fieldsOverview(run)
  const seederRate = fleetTilesPerHour(run.fields.machines, 'seeder')
  const harvesterRate = fleetTilesPerHour(run.fields.machines, 'harvester')
  // the first accepted unfinished order, if any
  const order = run.orders.offers.find((s): s is Offer => isOffer(s) && s.accepted && s.done < s.count)
  const chip = estateBottleneck(state)
  const ghost = ghostRowPrice(state)
  const payback = fieldsPaybackHours(state)
  const pump = run.fields.pump
  const pumpPrice = pumpCost(pump, meta)
  const crops = run.licenses.filter((c) => fieldsPlantable(run, c))
  const plot = buyPlot(state)
  const cap = pumpFieldCap(pump)
  const pressure = fieldsPressure(run)
  const opens = run.fields.list.every((field) => field.plots.length >= fieldPlots()) ? run.fields.list.length + 1 : 0
  const fill = fillTank(state)
  const room = Math.floor((tankCapCoal(pump) * TANK_UNITS_PER_COAL - run.fields.tank) / TANK_UNITS_PER_COAL)
  return (
    <div className="estate">
      <div className="capacity-strip" role="group" aria-label="Fields at a glance">
        <span className="estate-chip">{`${WATER_EMOJI} ${wetFields}/${cap} fields wet`}</span>
        <span className={`estate-chip${pressure ? '' : ' estate-chip-warn'}`}>
          {pressure
            ? `${TANK_EMOJI} ${Math.floor(run.fields.tank / TANK_UNITS_PER_COAL)}/${tankCapCoal(pump)} · ×${FIELD_PRESSURE}`
            : `${TANK_EMOJI} empty · ×1`}
        </span>
        <span className="estate-chip">{`${SEEDER_EMOJI} ${seederRate}/h · ${emptyWet} plot${emptyWet === 1 ? '' : 's'} to sow`}</span>
        <span className="estate-chip">{`${HARVESTER_EMOJI} ${harvesterRate}/h · ${ready} ready`}</span>
        {order && <span className="estate-chip">{`${ORDER_EMOJI} ${goodEmoji(order.good)} ${order.done}/${order.count}`}</span>}
        <span className={`estate-chip${chip.label.startsWith('✓') ? '' : ' estate-chip-warn'}`}>{`${chip.label} — ${chip.fix}`}</span>
      </div>
      {lot}
      <div className="estate-rows">
        {run.fields.list.slice(0, cap).map((field, k) => {
          const t = fieldTargets(state, k)
          return (
            <div className="estate-row" key={k}>
              <span>
                {`Field ${k + 1} · ${field.crop ? CROP_EMOJI[field.crop] : '—'} · ${field.plots.length}/${fieldPlots()} plots (${t.readyCount} ready${t.next !== null ? `, next in ${nextReadyText(t.next)}` : ''})`}
                {!field.pivot ? (
                  <small>no pivot — cannot sow</small>
                ) : (
                  field.crop && <small>{`≈💰${estateCropIncomePerHour(state, k)}/h · ${priceTag(state, field.crop, ui.priceShown[field.crop])}`}</small>
                )}
              </span>
              <select
                aria-label={`Field ${k + 1} crop`}
                value={field.crop ?? ''}
                onChange={(e) => act((s) => setFieldCrop(s, k, (e.target.value || null) as CropId | null))}
              >
                <option value="">— none —</option>
                {crops.map((c) => (
                  <option key={c} value={c}>{`${CROP_EMOJI[c]} ${CROPS[c].name}`}</option>
                ))}
              </select>
              {field.pivot ? (
                <button disabled={t.empty < 0 || !sowPlot(state, k, t.empty).ok} onClick={() => act((s) => sowPlot(s, k, t.empty))}>
                  Sow
                </button>
              ) : (
                <button disabled={!buildPivot(state, k).ok} onClick={() => act((s) => buildPivot(s, k))}>
                  Build pivot
                  <small className="recipe-price">{priceText(pivotCost(pivotsOwned(run.fields) + 1, meta))}</small>
                </button>
              )}
              <button disabled={t.ready < 0 || !reapPlot(state, k, t.ready).ok} onClick={() => act((s) => reapPlot(s, k, t.ready))}>
                Reap ⚡10
              </button>
            </div>
          )
        })}
        {run.fields.list.length > cap && (
          <div className="estate-row">
            <span>{`Fields ${cap + 1}–${run.fields.list.length} · ${BEYOND_EMOJI} beyond Pump ${pump}`}</span>
          </div>
        )}
      </div>
      <div className="recipe-wrap">
        <div className="recipe-grid">
          <div className="group">
            <h3>Expand</h3>
            <div className="recipe-row ghost-row">
              <span>{`＋ Plot 💰${ghost}${opens ? ` · opens Field ${opens}` : ''}${payback > 0 ? ` · ~${payback} h payback` : ''}`}</span>
              <button disabled={!plot.ok} onClick={() => act(buyPlot)}>
                Buy
                {!plot.ok && plot.error === 'PUMP_FULL' && <small>{`needs Pump Lv${pump + 1}`}</small>}
                {!plot.ok && plot.error === 'NO_CASH' && <small>{`needs 💰⁠${ghost - run.cash} more`}</small>}
              </button>
            </div>
            {pumpPrice && (
              <div className="recipe-row">
                <span>
                  {`${PUMP_EMOJI} Pump Lv${pump + 1}`}
                  <small>{`waters ${pumpFieldCap(pump + 1)} fields · tank ${tankCapCoal(pump + 1)} ${ITEMS.coal.emoji}`}</small>
                </span>
                <button disabled={!buyPump(state).ok} onClick={() => act(buyPump)}>
                  Build
                  <small className="recipe-price">{priceText(pumpPrice)}</small>
                </button>
              </div>
            )}
            <div className="recipe-row">
              <span>
                {`${TANK_EMOJI} Fill tank`}
                <small>{`+${Math.max(0, Math.min(room, run.inventory.coal ?? 0))} ${ITEMS.coal.emoji} from storage`}</small>
              </span>
              <button disabled={!fill.ok} title={fill.ok ? undefined : ERROR_TEXT[fill.error]} onClick={() => act(fillTank)}>
                Fill
              </button>
            </div>
            {run.workshop.built && !run.workshop.valve && (
              <RecipeRow
                state={state}
                act={act}
                emoji={VALVE_EMOJI}
                name="Smart valve"
                verb="Build"
                cost={valveCost(meta)}
                effect="pivots burn coal only while a plot grows"
                owned={false}
                ownedText=""
                buy={buyValve}
              />
            )}
          </div>
        </div>
      </div>
      <details className="estate-machines">
        <summary>Machines</summary>
        <div className="recipe-wrap">
          <div className="recipe-grid">
            <div className="group">
              <h3>Machines</h3>
              {(['harvester', 'seeder'] as const).flatMap((kind) =>
                Array.from({ length: machineMaxTiers(kind) }, (_, i) => i + 1).map((tier) => {
                  const rate = machineTilesPerHour(kind, tier)
                  const cert = kind === 'harvester' ? 'harvest' : 'plant'
                  return (
                    <RecipeRow
                      key={`${kind}${tier}`}
                      state={state}
                      act={act}
                      emoji={kind === 'harvester' ? HARVESTER_EMOJI : SEEDER_EMOJI}
                      name={`${MACHINE_NAMES[kind]} Mk${tier}`}
                      verb="Build"
                      cost={machineCost(kind, tier, meta)}
                      effect={`${MACHINE_VERBS[kind]} ${rate} tiles/h · 💰${machineMaintPerHour(tier)}/h upkeep · coal-free${kind === 'harvester' ? ' · uses your best sickle' : ''}`}
                      owned={run.fields.machines[kind].includes(tier)}
                      ownedText={`${rate} tiles/h`}
                      reason={run.workers.certificates.includes(cert) ? null : `needs the ${cert} certificate (manual → worker → machine)`}
                      buy={(s) => buyMachine(s, kind, tier)}
                    />
                  )
                }),
              )}
            </div>
          </div>
        </div>
      </details>
    </div>
  )
}
