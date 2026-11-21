// Iron Hills' 🔨 forge (batch 36.2, DECISIONS "Batch 36.2 refined" calls 10–12): stamps bars + coal into order goods.
// The player picks the recipe (Off by default); one cycle's inputs leave storage when a job is loaded, the good lands
// in the tray FORGE_CYCLE_TICKS later. No fire, no fuel; furnace speed / batch / the Stoker do not apply.
import { fail, withRun, type ActionResult } from './actions'
import { FORGE_CYCLE_TICKS, FORGE_RECIPES, FORGE_TRAY, forgeCost } from './balance'
import { FORGE_GOOD_IDS, type ForgeRecipeId } from './data/items'
import { bagCount, pay } from './mining'
import type { Forge, GameState, RunState } from './state'

export const forgeTrayCount = (f: Forge): number => FORGE_GOOD_IDS.reduce((n, id) => n + (f.tray[id] ?? 0), 0)

// Order: LOCKED (not Iron Hills), ALREADY_OWNED, NO_FURNACE, then pay (NOT_ENOUGH_ITEMS, NO_CASH).
export function buildForge(state: GameState): ActionResult {
  const { run } = state
  if (run.listing.district !== 'ironHills') return fail('LOCKED')
  if (run.forge.built) return fail('ALREADY_OWNED')
  if (!run.furnace.built) return fail('NO_FURNACE')
  return pay(state, forgeCost(state.meta), { forge: { ...run.forge, built: true } })
}

/** free; null = Off */
export function setForgeRecipe(state: GameState, recipe: ForgeRecipeId | null): ActionResult {
  const f = state.run.forge
  if (!f.built) return fail('LOCKED')
  return withRun(state, { forge: { ...f, recipe } })
}

// Order: LOCKED (not built), NOTHING_TO_DO (recipe Off), FULL (a job is loaded), NOT_ENOUGH_ITEMS.
export function loadForge(state: GameState): ActionResult {
  const f = state.run.forge
  if (!f.built) return fail('LOCKED')
  if (f.recipe === null) return fail('NOTHING_TO_DO')
  if (f.job !== null) return fail('FULL')
  return pay(state, { cash: 0, ...FORGE_RECIPES[f.recipe].inputs }, { forge: { ...f, job: f.recipe, progress: 0 } })
}

// Moves as many tray goods into storage as fit (collectBars' rule, no Keep N). Order: LOCKED, NOTHING_TO_DO, BAG_FULL.
export function collectForge(state: GameState): ActionResult {
  const { run } = state
  const f = run.forge
  if (!f.built) return fail('LOCKED')
  if (forgeTrayCount(f) === 0) return fail('NOTHING_TO_DO')
  let room = run.bagCapacity - bagCount(run)
  if (room <= 0) return fail('BAG_FULL')
  const inventory = { ...run.inventory }
  const tray = { ...f.tray }
  for (const id of FORGE_GOOD_IDS) {
    const n = Math.min(tray[id] ?? 0, room)
    if (n === 0) continue
    inventory[id] = (inventory[id] ?? 0) + n
    tray[id] = tray[id]! - n
    room -= n
  }
  return withRun(state, { inventory, forge: { ...f, tray } })
}

/** one tick inside step(): a loaded job advances to the cycle, then drops its good into the tray when there is room */
export function tickForge(run: RunState): RunState {
  const f = run.forge
  if (f.job === null) return run
  const progress = Math.min(f.progress + 1, FORGE_CYCLE_TICKS)
  if (progress < FORGE_CYCLE_TICKS || forgeTrayCount(f) >= FORGE_TRAY) return progress === f.progress ? run : { ...run, forge: { ...f, progress } }
  return { ...run, forge: { ...f, job: null, progress: 0, tray: { ...f.tray, [f.job]: (f.tray[f.job] ?? 0) + 1 } } }
}

/** the ore loader's forge work after its furnace work: collect the tray when storage has room, else load the chosen
 *  recipe when no job is loaded and storage holds a cycle; never picks a recipe */
export function forgeLoaderAction(state: GameState): ActionResult | null {
  const { run } = state
  const f = run.forge
  if (!f.built) return null
  if (forgeTrayCount(f) > 0 && bagCount(run) < run.bagCapacity) return collectForge(state)
  if (f.recipe === null || f.job !== null) return null
  const loaded = loadForge(state)
  return loaded.ok ? loaded : null
}
