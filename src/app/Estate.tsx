import type { ActionResult } from '../core/actions'
import { cropSeedCost, fieldTileCost, fieldsCropHarvests, machineCost, machineMaintPerHour, machineMaxTiers, machineTilesPerHour, pipeCoalPer10Tiles, pipeCost, pipeCover, plantBatch } from '../core/balance'
import { CROPS } from '../core/data/crops'
import { ITEMS } from '../core/data/items'
import { isOffer } from '../core/orders'
import type { GameState, Offer } from '../core/state'
import { buyField, buyMachine, buyPipes, fieldsPaybackHours, fieldsPlantable, fieldsStats, plantFields, stopFieldsPlant } from '../core/fields'
import { CROP_EMOJI } from './FarmGrid'
import { goodEmoji } from './Orders'
import { priceTag } from './marketText'
import { priceText } from './Mine'
import type { UiState } from './uiState'
import type { Act } from './useGame'
import { RecipeRow } from './Workshop'
import { estateBottleneck, estateCropIncomePerHour, estateRowCrops, fleetTilesPerHour, ghostRowPrice, nextReadyText } from './estateText'

const PIPES_EMOJI = '🚰' // Unicode 6
const ORDER_EMOJI = '📋' // Unicode 6
const WATER_EMOJI = '💧' // Unicode 6
const SEEDER_EMOJI = '🌱' // Unicode 6
const HARVESTER_EMOJI = '🌾' // Unicode 6
const HOME_EMOJI = '🏡' // Unicode 6
const MACHINE_NAMES = { harvester: 'Harvester', seeder: 'Seeder' } as const
const MACHINE_VERBS = { harvester: 'harvests', seeder: 'plants' } as const

/** the ghost row's action (task 143b, shared with the phone bar in 144): up to ten tiles in ONE act, stopping at
 *  the first tile the run cannot afford — a partial buy (i > 0) still succeeds */
export function buyTenFields(s: GameState): ActionResult {
  let cur = s
  for (let i = 0; i < 10; i++) {
    const r = buyField(cur)
    if (!r.ok) return i === 0 ? r : { ok: true, state: cur }
    cur = r.state
  }
  return { ok: true, state: cur }
}

/**
 * The 🚜 Estate stop's content (batch 27, task 143): a capacity strip, the MiniLot, one row per licensed crop,
 * the ghost row (the next ten tiles), the next pipe tier and the machines behind a closed details.
 */
export function Estate({ state, act, ui, lot }: { state: GameState; act: Act; ui: UiState; lot?: React.ReactNode }) {
  const { run, meta } = state
  if (!run.fields.unlocked) return null
  const { free, covered, ready } = fieldsStats(run)
  const seederRate = fleetTilesPerHour(run.fields.machines, 'seeder')
  const harvesterRate = fleetTilesPerHour(run.fields.machines, 'harvester')
  // the first accepted unfinished order, if any
  const order = run.orders.offers.find((s): s is Offer => isOffer(s) && s.accepted && s.done < s.count)
  const chip = estateBottleneck(state)
  const ghost = ghostRowPrice(state)
  const payback = fieldsPaybackHours(state)
  const pipePrice = pipeCost(run.fields.pipes, meta)
  const pipeCoverNext = pipeCover(run.fields.pipes + 1)
  const firstTile = fieldTileCost(run.fields.count, meta)
  const batch = plantBatch()
  return (
    <div className="estate">
      <div className="capacity-strip" role="group" aria-label="Fields at a glance">
        <span className="estate-chip">{`${WATER_EMOJI} ${covered}/${pipeCover(run.fields.pipes)} watered`}</span>
        <span className="estate-chip">{`${SEEDER_EMOJI} ${seederRate}/h · ${free} empty`}</span>
        <span className="estate-chip">{`${HARVESTER_EMOJI} ${harvesterRate}/h · ${ready} ready`}</span>
        {order && <span className="estate-chip">{`${ORDER_EMOJI} ${goodEmoji(order.good)} ${order.done}/${order.count}`}</span>}
        <span className={`estate-chip${chip.label.startsWith('✓') ? '' : ' estate-chip-warn'}`}>{`${chip.label} — ${chip.fix}`}</span>
      </div>
      {lot}
      <div className="estate-rows">
        {estateRowCrops(state).map((id) => {
          const plantable = fieldsPlantable(run, id)
          const tiles = run.fields.planted[id] ?? 0
          const cohorts = run.fields.cohorts.filter((c) => c.crop === id)
          const readyC = cohorts.filter((c) => c.readyTick <= run.tick).reduce((n, c) => n + c.count, 0)
          const next = cohorts.filter((c) => c.readyTick > run.tick).map((c) => c.readyTick - run.tick).sort((a, b) => a - b)[0] ?? null
          return (
            <div className="estate-row" key={id}>
              <span>
                {`${CROP_EMOJI[id]} ${CROPS[id].name} · ${tiles} tiles (${readyC} ready${next !== null ? `, next in ${nextReadyText(next)}` : ''})`}
                {plantable ? (
                  <small>{`≈💰${estateCropIncomePerHour(state, id)}/h · ${priceTag(state, id, ui.priceShown[id])}`}</small>
                ) : (
                  <small>{`${HOME_EMOJI} ${run.lifetime.harvests[id] ?? 0}/${fieldsCropHarvests()} home harvests · ${priceTag(state, id, ui.priceShown[id])}`}</small>
                )}
              </span>
              {run.fields.plantCrop === id ? (
                <button onClick={() => act((s) => stopFieldsPlant(s))}>Stop</button>
              ) : (
                <button disabled={!plantable || !plantFields(state, id).ok} onClick={() => act((s) => plantFields(s, id))}>
                  {`Plant ${batch}`}
                  <small className="recipe-price">{`no ⚡ · 🌱 ×${batch} 💰${batch * cropSeedCost(id, meta)}`}</small>
                </button>
              )}
            </div>
          )
        })}
      </div>
      <div className="recipe-wrap">
        <div className="recipe-grid">
          <div className="group">
            <h3>Expand</h3>
            <div className="recipe-row ghost-row">
              <span>{`＋ 10 tiles 💰${ghost}${payback > 0 ? ` · ~${payback} h payback` : ''}`}</span>
              <button disabled={!buyField(state).ok} onClick={() => act(buyTenFields)}>
                Buy
                {run.cash < firstTile && <small>{`needs 💰⁠${firstTile - run.cash} more`}</small>}
              </button>
            </div>
            {pipePrice && (
              <div className="recipe-row">
                <span>
                  {`${PIPES_EMOJI} Pipes Lv${run.fields.pipes + 1}`}
                  <small>{`waters ${pipeCoverNext} tiles · ${(pipeCoalPer10Tiles() * pipeCoverNext) / 10}${ITEMS.coal.emoji}/h from the pump`}</small>
                </span>
                <button disabled={!buyPipes(state).ok} onClick={() => act((s) => buyPipes(s))}>
                  Build
                  <small className="recipe-price">{priceText(pipePrice)}</small>
                </button>
              </div>
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
