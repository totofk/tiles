import { buyLicense, buyTile } from '../core/actions'
import {
  TILE_CAP,
  cropSeedCost,
  furnaceCost,
  furnaceVeinLevel,
  licenseCost,
  mineLicenseCost,
  tileCost,
  toolCost,
  toolNMax,
  toolTierCost,
  toolUnlock,
  woodCost,
} from '../core/balance'
import { buildFurnace } from '../core/furnace'
import { priceText } from './Mine'
import { CROPS, CROP_IDS, type CropId } from '../core/data/crops'
import { ITEMS } from '../core/data/items'
import { TOOLS, TOOL_JOBS, type ToolJob } from '../core/data/tools'
import { buyMineLicense, buyWood } from '../core/mining'
import type { GameState } from '../core/state'
import { buyCopperTool, buyTool } from '../core/tools'
import { CROP_EMOJI } from './FarmGrid'
import { SeedPouch } from './Farm'
import { Item } from './Info'
import { cropFactor, depthBand, marketTip, priceTag } from './marketText'
import { COPPER_TIPS, CROP_TIPS, TIPS, TOOL_TIPS } from './tips'
import { FIRE_EMOJI, type Act } from './useGame'

/** per press, by level (index 0 = level 1) */
const TOOL_EFFECT = [() => '1 tile', (tiles: number) => `up to ${toolNMax(tiles)} tiles`, () => 'all tiles']

/** farmTab: the desktop 🌾 Farm tab holds the crop picker and the pouch, so the Shop only sells */
type Props = { state: GameState; cropId: CropId; onSelectCrop: (id: CropId) => void; act: Act; farmTab?: boolean }

/** the job's copper tier, under its three tool levels; locked until the job's tool Lv1 */
function CopperTool({ state, act, job }: { state: GameState; act: Act; job: ToolJob }) {
  const { run, meta } = state
  const owned = run.toolTier[job] >= 1
  const status = owned ? '✓ Owned' : run.tools[job] < 1 ? `needs ${TOOLS[job].names[0]}` : priceText(toolTierCost(1, meta))
  return (
    <Item tip={COPPER_TIPS[job]}>
      <button
        className={owned ? 'owned' : undefined}
        disabled={!buyCopperTool(state, job).ok}
        onClick={() => act((s) => buyCopperTool(s, job))}
      >
        {`${ITEMS.copperBar.emoji} ${TOOLS[job].copper}`}
        <small>{status}</small>
      </button>
    </Item>
  )
}

export function Shop({ state, cropId, onSelectCrop, act, farmTab = false }: Props) {
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
              <small>{priceTag(state, id)}</small>
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
          <CopperTool key={`${job}copper`} state={state} act={act} job={job} />,
        ])}
      </div>
    </section>
  )
}
