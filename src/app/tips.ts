import type { FurnaceUpgradeId } from '../core/balance'
import type { CropId } from '../core/data/crops'
import type { ToolJob } from '../core/data/tools'
import type { UpgradeId } from '../core/data/upgrades'
import type { WorkerJob } from '../core/data/workers'

// ⓘ texts for every Shop and Upgrades row: what it does, what it costs over time. No numbers (those live in balance.ts).

export const CROP_TIPS: Record<CropId, string> = {
  radish: 'Your starting crop: cheap seeds and the fastest harvest. It earns the least per energy, so it is the crop to grow out of.',
  chilli: 'Grows slower than carrot but earns more per energy. The license is paid once; each seed costs a little.',
  pumpkin: 'A long grow for a big sale, more cash per energy than chilli. Seeds cost more, so keep cash for replanting.',
  lemon: 'The slowest crop and the best cash per energy. Seeds are expensive, and waiting, not energy, becomes the limit.',
}

/** index 0 = level 1 */
export const TOOL_TIPS: Record<ToolJob, [string, string, string]> = {
  water: [
    'Waters one tile per press, the driest first. A one-time buy; each tile still costs the energy it costs by hand.',
    'Waters as many tiles per press as you set, the driest first. A one-time buy; energy per tile is unchanged.',
    'Waters every tile that needs it in one press. A one-time buy; energy per tile is unchanged.',
  ],
  harvest: [
    'Harvests one ripe tile per press, the one ripe longest first. A one-time buy; each tile still costs the energy it costs by hand.',
    'Harvests as many ripe tiles per press as you set, the oldest first. A one-time buy; energy per tile is unchanged.',
    'Harvests every ripe tile in one press. A one-time buy; energy per tile is unchanged.',
  ],
  plant: [
    'Plants one empty tilled tile per press with the selected crop. A one-time buy; seeds and energy cost what they cost by hand.',
    'Plants as many empty tilled tiles per press as you set. A one-time buy; seeds and energy per tile are unchanged.',
    'Plants every empty tilled tile in one press. A one-time buy; seeds and energy per tile are unchanged.',
  ],
}

/** the job's material tiers (copper, iron, then gold for the sickle and dibber): change every action of the job, taps, tool presses and workers alike */
export const TIER_TIPS: Record<ToolJob, string> = {
  water: 'Each watering holds more moisture, so a tile stays moist longer between waterings and a waterer works less. Copper needs the Watering Can, iron needs copper; each is made once from bars. Iron is the last watering can.',
  harvest: 'Now and then a harvest yields a second crop that sells too. Copper needs the Sickle, iron needs copper, gold (3 in 10) needs iron; each is made once from bars.',
  plant: 'Now and then a planting keeps its seed, so the pouch lasts longer. Copper needs the Dibber, iron needs copper, gold (every other seed) needs iron; each is made once from bars.',
}

export const UPGRADE_TIPS: Record<UpgradeId, string> = {
  energyMax: 'Raises your energy cap, so a full bar lasts longer between breaks. Each level costs more than the last.',
  energyRegen: 'Energy refills faster, so you can act more often. Each level costs more than the last.',
  sellPrice: 'Every crop sells for more. Unlocked by selling; each level costs more than the last.',
  fertilizer: 'Crops grow faster, so you harvest more often. Unlocked by harvesting; each level costs more than the last.',
}

export const TIPS = {
  pouch: 'Seeds you hold for planting; each planting uses one. Ten at once cost the same per seed as one.',
  autoBuy: 'When the pouch is empty, planting buys one seed for you at the normal price. Turn it off to plant only seeds you hold.',
  mineLicense: 'Opens the mine: spend spare energy on stone while crops grow. A one-time cost.',
  wood: 'Crafts and repairs pickaxes. A pickaxe wears with use, so it needs wood again from time to time.',
  tile: 'One more farm tile. Each new tile costs more than the last, up to the tile cap.',
  board: 'Orders for what you make now. An accepted crop order takes your harvests of that crop at a bonus price, with no market glut; item orders are delivered from storage. Every finished order pays stars. No timers: discard any order for free.',
  storage: 'More room for stone and other mined items. Paid in stone and cash; the price rises each level.',
  vein: 'A deeper vein drops new items beside stone. Paid once per level in stone and cash.',
  furnace: 'Smelts copper ore into bars with coal or wood, no energy needed. Bought once; it opens the next vein level.',
  workshop: 'A shed for the sprinkler machines you build inside it. Sprinklers water your driest tiles on their own clock, burning coal from their hopper; a fuel loader keeps the hoppers topped up. Bought once; it needs the deepest vein.',
  hire: 'Adds one worker to your pool; put them on a job with + and −. Workers act on their own clock without your energy, also while you are away. Each action costs a small wage, paid only when they work; with no cash they wait. Each hire costs more than the last, up to a cap.',
}

/** the 🔥 Furnace card: the fire gauge and each furnace upgrade */
export const FURNACE_TIPS: Record<'fire' | FurnaceUpgradeId, string> = {
  fire: 'Fill the fire with wood or coal; coal burns longer than wood. A plain furnace burns whenever it is lit, also with no ore loaded or a full tray, so fill it only when you smelt.',
  fireCap: 'A bigger fire holds more fuel, so the furnace runs longer between fills. Paid once per level in copper bars and cash.',
  batch: 'Each smelt turns more ore into more bars for the same fire, so every bar costs less fuel. Paid once per level in copper bars and cash.',
  smart: 'The fire burns only while a bar is smelting, so no fuel is wasted when the ore runs out or the tray is full. A one-time buy.',
}

/** the job's certificate row: what a worker on this job does */
export const WORKER_TIPS: Record<WorkerJob, string> = {
  plant: 'A one-time certificate, paid in copper bars and cash, once you own the Seed Spreader. Planters till empty soil and plant your "Crop to plant" with seeds from the pouch, buying one only when auto-buy is on. No seed, no planting. Your copper dibber works for them too.',
  water: 'A one-time certificate, paid in stone and cash, once you own the Water Cart. Waterers water the tile that would dry out soonest, slower than you. Your copper can makes each of their waterings last longer too.',
  harvest: 'A one-time certificate, paid in stone, coal and cash, once you own the Reaper. Harvesters pick the crop ripe longest first, so nothing rots while you are away. Your copper sickle works for them too.',
  ore: 'A one-time certificate, paid in copper bars and cash. Ore loaders move finished bars from the furnace into storage, and when there are none, load one smelt of ore from storage.',
  fuel: 'A one-time certificate, paid in copper bars and cash. Fuel loaders add coal to the fire whenever it has room, also with no ore in the furnace. Never wood, so repair wood is safe.',
  mine: 'A one-time certificate, paid in iron bars and cash, once you own the deepest vein. Miners press Mine for you with your pickaxe, wearing it and training its mastery like your own presses. They stop when storage is full or the pickaxe is blunt; repairs are yours.',
  clerk: 'A one-time certificate, paid in stars, copper bars and cash, once you have finished enough orders. Clerks deliver item orders that storage can fill, else accept orders for a crop you grow or an item your vein drops. They never discard; that choice stays yours.',
}
