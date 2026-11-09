import { cropSeedCost, fieldTileCost, fieldsCropHarvests, machineCost, machineMaintPerHour, machineMaxTiers, machineTilesPerHour, pipeCoalPer10Tiles, pipeCost, pipeCover, plantBatch } from '../core/balance'
import { CROPS } from '../core/data/crops'
import { ITEMS } from '../core/data/items'
import type { GameState } from '../core/state'
import { buyField, buyMachine, buyPipes, fieldsPaybackHours, fieldsPlantable, fieldsStats, plantFields, stopFieldsPlant } from '../core/fields'
import { Bar } from './Bar'
import { CROP_EMOJI } from './FarmGrid'
import { priceText } from './Mine'
import type { Act } from './useGame'
import { RecipeRow } from './Workshop'

const FIELDS_EMOJI = '🚜' // Unicode 6, like every glyph in the UI
const PIPES_EMOJI = '🚰' // Unicode 6
const WAIT_EMOJI = '⏳' // Unicode 6; a stalled crop waits, it never dies
const HARVESTER_EMOJI = '🌾' // Unicode 6
const SEEDER_EMOJI = '🌱' // Unicode 6
const MACHINE_NAMES = { harvester: 'Harvester', seeder: 'Seeder' } as const
const MACHINE_VERBS = { harvester: 'harvests', seeder: 'plants' } as const

/** one line of the 3-bar breakdown, the Workshop machine-gauge pattern (label · bar · count) */
function StatLine({ label, value, total, kind }: { label: string; value: number; total: number; kind: 'water' | 'energy' }) {
  return (
    <div className="gauge-row">
      <span>{label}</span>
      <Bar value={total > 0 ? value / total : 0} kind={kind} />
      <small>{`${value}/${total}`}</small>
    </div>
  )
}

/** the 🚜 Fields card: 3 bars, one row per licensed crop, the next field's price with its payback, the next pipe tier */
export function Fields({ state, act }: { state: GameState; act: Act }) {
  const { run, meta } = state
  if (!run.fields.unlocked) return null
  const { free, covered, stalled, ready } = fieldsStats(run)
  const n = run.fields.count
  const payback = fieldsPaybackHours(state)
  const pipePrice = pipeCost(run.fields.pipes, meta)
  const pipeCoverNext = pipeCover(run.fields.pipes + 1)
  return (
    <details className="workers">
      <summary>
        {`${FIELDS_EMOJI} Fields · ${n} tiles · 🌾 ${ready} ready`}
        {stalled > 0 && <span className="unpaid">{`${WAIT_EMOJI} ${stalled} stalled`}</span>}
      </summary>
      <div className="group gauge-grid">
        <StatLine label="To plant" value={free} total={n} kind="water" />
        {/* the growing bar fills with the tiles the pipes actually water; the gap is the stalled tiles */}
        <div className="gauge-row">
          <span>Growing</span>
          <Bar value={n > 0 ? covered / n : 0} kind="grow" />
          <small>{`${covered}/${n}`}</small>
          {stalled > 0 && <span className="unpaid gauge-note">{`${WAIT_EMOJI} ${stalled} beyond pipes`}</span>}
        </div>
        <StatLine label="Ready" value={ready} total={n} kind="energy" />
      </div>
      <div className="recipe-wrap">
        <div className="recipe-grid">
          <div className="group">
            <h3>Plant</h3>
            {run.licenses.map((id) => {
              const plantable = fieldsPlantable(run, id)
              const batch = plantBatch()
              return (
                <div className="recipe-row" key={id}>
                  <span>
                    {CROP_EMOJI[id]} {CROPS[id].name} × {run.fields.planted[id]}
                    {!plantable && <small>{`needs ${fieldsCropHarvests()} home harvests (${run.lifetime.harvests[id] ?? 0}/${fieldsCropHarvests()})`}</small>}
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
          <div className="group">
            <h3>Expand</h3>
            <div className="recipe-row">
              <span>Empty land next</span>
              <button disabled={!buyField(state).ok} onClick={() => act((s) => buyField(s))}>
                +1 Field
                <small className="recipe-price">{`💰${fieldTileCost(n, meta)}${payback > 0 ? ` · ~${payback} h` : ''}`}</small>
                {run.cash < fieldTileCost(n, meta) && <small>{`needs 💰⁠${fieldTileCost(n, meta) - run.cash} more`}</small>}
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
  )
}
