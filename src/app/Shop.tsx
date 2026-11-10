import { buyLicense, buyTile } from '../core/actions'
import {
  TILE_CAP,
  cropSeedCost,
  furnaceCost,
  furnaceVeinLevel,
  licenseCost,
  mineLicenseCost,
  orderBoardCost,
  tileCost,
  toolCost,
  toolNMax,
  doubleHarvestChance,
  seedKeepChance,
  toolTierCost,
  toolTierMax,
  toolUnlock,
  waterMoisture,
  woodCost,
  workshopCost,
  workshopVeinLevel,
  fieldsCost,
} from '../core/balance'
import { buildFurnace } from '../core/furnace'
import { buildWorkshop } from '../core/workshop'
import { fieldsUnlockable, unlockFields } from '../core/fields'
import { BOARD_EMOJI } from '../core/data/orders'
import { buyOrderBoard, orderBoardUnlocked } from '../core/orders'
import { priceText } from './Mine'
import { CROPS, CROP_IDS, type CropId } from '../core/data/crops'
import { ITEMS, ITEM_IDS } from '../core/data/items'
import { TOOLS, TOOL_JOBS, type ToolJob } from '../core/data/tools'
import { buyMineLicense, buyWood } from '../core/mining'
import type { GameState } from '../core/state'
import { buyToolTier, buyTool } from '../core/tools'
import { CROP_EMOJI } from './FarmGrid'
import { SeedPouch } from './Farm'
import { Item } from './Info'
import { cropFactor, depthBand, marketTip, priceTag } from './marketText'
import { CROP_TIPS, TIER_TIPS, TIPS, TOOL_TIPS } from './tips'
import type { UiState } from './uiState'
import { FIRE_EMOJI, type Act } from './useGame'

/** per press, by level (index 0 = level 1) */
const TOOL_EFFECT = [() => '1 tile', (tiles: number) => `up to ${toolNMax(tiles)} tiles`, () => 'all tiles']

/** farmTab: the desktop 🌾 Farm tab holds the crop picker and the pouch, so the Shop only sells;
 * ui: the remembered price-tag factors (trend arrows), optional so stand-alone renders show no arrow */
type Props = { state: GameState; cropId: CropId; onSelectCrop: (id: CropId) => void; act: Act; farmTab?: boolean; ui?: Pick<UiState, 'priceShown'> }

/** what one material tier does to each action of the job */
const TIER_EFFECT: Record<ToolJob, (tier: number) => string> = {
  water: (t) => `moisture ${waterMoisture(t)}`,
  harvest: (t) => `${Math.round(doubleHarvestChance(t) * 100)} % double`,
  plant: (t) => `${Math.round(seedKeepChance(t) * 100)} % seed kept`,
}
/** the bar each tier is made from (index 0 = tier 1) */
const TIER_BAR = ['copperBar', 'ironBar', 'goldBar'] as const

/**
 * the job's next material tier (copper, then iron, then gold for the sickle and dibber) under its three tool levels;
 * locked until the job's tool Lv1 (copper) or the tier below. Water stops at iron — the button says so. A second line
 * names the bars or cash still missing.
 */
function TierTool({ state, act, job }: { state: GameState; act: Act; job: ToolJob }) {
  const { run, meta } = state
  const max = toolTierMax(job)
  const owned = run.toolTier[job] >= max
  const tier = Math.min(run.toolTier[job] + 1, max)
  const cost = toolTierCost(tier, meta)
  const short = [
    ...ITEM_IDS.filter((id) => (cost[id] ?? 0) > (run.inventory[id] ?? 0)).map((id) => `${ITEMS[id].emoji}${cost[id]! - (run.inventory[id] ?? 0)}`),
    ...(cost.cash > run.cash ? [`💰${cost.cash - run.cash}`] : []),
  ]
  const status = owned
    ? `✓ ${TIER_EFFECT[job](tier)}${job === 'water' ? ' · Iron is the last watering can' : ''}`
    : run.tools[job] < 1
      ? `needs ${TOOLS[job].names[0]}`
      : `${TIER_EFFECT[job](tier)} · ${priceText(cost)}`
  const ladder = Array.from({ length: max + 1 }, (_, t) => `${t ? TOOLS[job].tiers[t - 1] : 'Basic'}: ${TIER_EFFECT[job](t)}`).join(' · ')
  return (
    <Item tip={`${TIER_TIPS[job]} ${ladder}.`}>
      <button className={owned ? 'owned' : undefined} disabled={!buyToolTier(state, job).ok} onClick={() => act((s) => buyToolTier(s, job))}>
        {`${ITEMS[TIER_BAR[tier - 1]].emoji} ${TOOLS[job].tiers[tier - 1]}`}
        <small>{status}</small>
        {!owned && run.tools[job] >= 1 && short.length > 0 && <small>{`needs ${short.join(' ')} more`}</small>}
      </button>
    </Item>
  )
}

export function Shop({ state, cropId, onSelectCrop, act, farmTab = false, ui }: Props) {
  const { run, meta } = state
  const tiles = run.tiles.length
  const nextTile = tileCost(tiles, meta)

  return (
    <section className="shop">
      <h2>Seeds</h2>
      <div className="shop-row">
        {CROP_IDS.map((id) => {
          const cost = licenseCost(id, meta)
          const factor = cropFactor(state, id)
          const market = (
            <>
              <small>{priceTag(state, id, ui?.priceShown[id])}</small>
              <span className="depth" aria-hidden="true">
                <span className={`depth-${depthBand(factor)}`} style={{ width: `${Math.round(factor * 100)}%` }} />
              </span>
            </>
          )
          return (
            <Item key={id} tip={`${CROP_TIPS[id]} ${marketTip(state, id)}`}>
              {run.licenses.includes(id) && farmTab ? (
                <button className="owned" disabled>
                  {CROP_EMOJI[id]} {CROPS[id].name}
                  <small>seed 💰{cropSeedCost(id, meta)}</small>
                  {market}
                </button>
              ) : run.licenses.includes(id) ? (
                <button className={id === cropId ? 'selected' : ''} aria-pressed={id === cropId} onClick={() => onSelectCrop(id)}>
                  {CROP_EMOJI[id]} {CROPS[id].name}
                  <small>seed 💰{cropSeedCost(id, meta)}</small>
                  {market}
                </button>
              ) : (
                <button className="locked" disabled={run.cash < cost} onClick={() => act((s) => buyLicense(s, id))}>
                  🔒 {CROPS[id].name}
                  <small>license 💰{cost}</small>
                </button>
              )}
            </Item>
          )
        })}
      </div>

      {!farmTab && <SeedPouch state={state} act={act} />}

      <h2>Supplies</h2>
      <div className="shop-row">
        {run.mineLicense ? (
          <Item tip={TIPS.wood}>
            <button disabled={!buyWood(state, 1).ok} onClick={() => act((s) => buyWood(s, 1))}>
              {ITEMS.wood.emoji} Wood
              <small>💰{woodCost(meta)}</small>
            </button>
          </Item>
        ) : (
          <Item tip={TIPS.mineLicense}>
            <button disabled={run.cash < mineLicenseCost(meta)} onClick={() => act(buyMineLicense)}>
              ⛏️ Mine license
              <small>💰{mineLicenseCost(meta)}</small>
            </button>
          </Item>
        )}
        {run.vein.level >= furnaceVeinLevel() && !run.furnace.built && (
          <Item tip={TIPS.furnace}>
            <button disabled={!buildFurnace(state).ok} onClick={() => act(buildFurnace)}>
              {FIRE_EMOJI} Furnace
              <small>{priceText(furnaceCost(meta))}</small>
            </button>
          </Item>
        )}
        {run.vein.level >= workshopVeinLevel() && !run.workshop.built && (
          <Item tip={TIPS.workshop}>
            <button disabled={!buildWorkshop(state).ok} onClick={() => act(buildWorkshop, () => 'Workshop built — its card sits with 👷 Workers')}>
              🔧 Workshop
              <small>{priceText(workshopCost(meta))}</small>
            </button>
          </Item>
        )}
        {run.workshop.built && !run.fields.unlocked && (
          <Item tip={TIPS.fields}>
            <button
              disabled={!unlockFields(state).ok}
              onClick={() => act(unlockFields, () => 'Fields unlocked — its card sits below the Workshop')}
            >
              🚜 Fields
              <small>
                {fieldsUnlockable(run)
                  ? priceText(fieldsCost(meta))
                  : `needs ${[
                      !run.workers.certificates.includes('plant') && 'planter certificate',
                      !run.workers.certificates.includes('harvest') && 'harvester certificate',
                      !run.workshop.beds.some(Boolean) && '1 bed sprinkler',
                    ]
                      .filter(Boolean)
                      .join(' + ')}`}
              </small>
            </button>
          </Item>
        )}
        {orderBoardUnlocked(run) && !run.orders.unlocked && (
          <Item tip={TIPS.board}>
            <button disabled={!buyOrderBoard(state).ok} onClick={() => act(buyOrderBoard)}>
              {BOARD_EMOJI} Notice board
              <small>{priceText(orderBoardCost(meta))}</small>
            </button>
          </Item>
        )}
        <Item tip={TIPS.tile}>
          <button disabled={tiles >= TILE_CAP || run.cash < nextTile} onClick={() => act(buyTile)}>
            Buy tile ({tiles}/{TILE_CAP})
            <small>{tiles >= TILE_CAP ? 'max tiles' : `💰${nextTile}`}</small>
          </button>
        </Item>
      </div>

      <h2>Farm tools</h2>
      <div className="shop-row">
        {TOOL_JOBS.flatMap((job) => [
          ...[1, 2, 3].map((level) => {
            const owned = run.tools[job]
            const { counter, at } = toolUnlock(job, level)
            const progress = `${job} ${Math.min(run.counters[counter], at)}/${at}`
            const status =
              owned >= level
                ? '✓ Owned'
                : run.counters[counter] < at
                  ? progress
                  : owned < level - 1
                    ? `needs ${TOOLS[job].names[level - 2]}`
                    : `${TOOL_EFFECT[level - 1](tiles)} · 💰${toolCost(job, level, meta)}`
            const next = owned === level - 1
            return (
              <Item key={`${job}${level}`} tip={TOOL_TIPS[job][level - 1]}>
                <button
                  className={owned >= level ? 'owned' : undefined}
                  disabled={!next || !buyTool(state, job).ok}
                  onClick={() => act((s) => buyTool(s, job))}
                >
                  {TOOLS[job].names[level - 1]}
                  <small>{status}</small>
                </button>
              </Item>
            )
          }),
          <TierTool key={`${job}tier`} state={state} act={act} job={job} />,
        ])}
      </div>
    </section>
  )
}
