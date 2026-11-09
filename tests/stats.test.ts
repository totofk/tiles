import { describe, expect, it } from 'vitest'
import { harvest } from '../src/core/actions'
import { STARTING_CASH, cropGrowTicks, cropSellPrice, energyMax, handPickedBonus, energyRegenPerTick, fireUnitTicks } from '../src/core/balance'
import type { CropId } from '../src/core/data/crops'
import { ITEMS } from '../src/core/data/items'
import { createInitialState, type GameState } from '../src/core/state'
import { feedbackSummary, stats, timelineLines } from '../src/core/stats'

const row = (rows: { label: string }[], label: string) => rows.find((r) => r.label === label)

describe('stats(state)', () => {
  it('a fresh run: zero totals, base values, no pickaxe, no tools, vein Lv0', () => {
    const { totals, multipliers } = stats(createInitialState())
    expect(totals).toEqual([
      { label: 'Time played', value: '0m 00s' },
      { label: 'Cash earned', value: '💰0' },
      { label: 'Energy spent', value: '⚡0' },
      { label: 'Harvests', value: '0' },
      { label: 'Items sold', value: '0' },
      { label: 'Mine actions', value: '0' },
      { label: 'Soil digs', value: '0' },
      { label: 'Waterings', value: '0' },
      { label: 'Plantings', value: '0' },
      { label: 'Copper bars collected', value: '0' },
      { label: 'Orders completed', value: '0' },
      { label: 'Carrot harvests', value: '0' },
      { label: 'Copper bars smelted', value: '0' },
      { label: 'Iron bars smelted', value: '0' },
      { label: 'Iron bars collected', value: '0' },
      { label: 'Gold bars smelted', value: '0' },
      { label: 'Gold bars collected', value: '0' },
      { label: 'Fire wasted', value: '0 units' },
      { label: 'Wages paid', value: '💰0' },
      { label: 'Plants by workers', value: '0' },
      { label: 'Mines by workers', value: '0' },
      { label: '⭐ earned', value: '0' },
    ])
    const meta = createInitialState().meta
    expect(multipliers).toEqual([
      { label: 'Sell price', value: '×1', source: 'Better prices Lv0' },
      { label: 'Grow time', value: '×1', source: 'Fertilizer Lv0' },
      { label: 'Energy max', value: `${energyMax(0, meta)}`, source: 'Bigger stamina Lv0' },
      { label: 'Energy regen', value: `${energyRegenPerTick(0, meta).toFixed(2)}/s`, source: 'Faster recovery Lv0' },
      { label: 'Pickaxe preserve', value: 'no pickaxe' },
      { label: 'Storage', value: '20 slots', source: 'Storage Lv0' },
      { label: 'Water tool', value: 'none' },
      { label: 'Harvest tool', value: 'none' },
      { label: 'Plant tool', value: 'none' },
      { label: 'Water tier', value: 'waters to 1 (×1 moist time)', source: 'basic' },
      { label: 'Harvest tier', value: '0 % double harvest', source: 'basic' },
      { label: 'Plant tier', value: '0 % seed kept', source: 'basic' },
      { label: 'Drop table', value: `${ITEMS.stone.emoji} Stone 100 %`, source: 'Vein Lv0' },
      { label: 'Workers', value: '0 hired · 0 free', source: 'plant 0 · water 0 · harvest 0 · ore 0 · fuel 0 · mine 0 · clerk 0' },
    ])
  })

  it('copper tiers show their effect from the same balance functions', () => {
    const s = createInitialState()
    const { multipliers } = stats({ ...s, run: { ...s.run, toolTier: { water: 1, harvest: 1, plant: 1 } } })
    expect(row(multipliers, 'Water tier')).toEqual({ label: 'Water tier', value: 'waters to 2 (×2 moist time)', source: 'Copper Can' })
    expect(row(multipliers, 'Harvest tier')).toEqual({ label: 'Harvest tier', value: '10 % double harvest', source: 'Copper Sickle' })
    expect(row(multipliers, 'Plant tier')).toEqual({ label: 'Plant tier', value: '20 % seed kept', source: 'Copper Dibber' })
  })

  it('the gold tier (batch 16): 30 % double harvest, every other seed kept — never a gold can', () => {
    const s = createInitialState()
    const { multipliers } = stats({ ...s, run: { ...s.run, toolTier: { water: 2, harvest: 3, plant: 3 } } })
    expect(row(multipliers, 'Water tier')).toEqual({ label: 'Water tier', value: 'waters to 4 (×4 moist time)', source: 'Iron Can' })
    expect(row(multipliers, 'Harvest tier')).toEqual({ label: 'Harvest tier', value: '30 % double harvest', source: 'Gold Sickle' })
    expect(row(multipliers, 'Plant tier')).toEqual({ label: 'Plant tier', value: '50 % seed kept', source: 'Gold Dibber' })
  })

  it('per-crop harvests say "since v6" when a migrated save has harvests no crop was credited with', () => {
    const s = createInitialState()
    const counters = { ...s.run.counters, harvests: 38 }
    const migrated = { ...s, run: { ...s.run, licenses: ['radish', 'pumpkin'] as CropId[], counters, lifetime: { ...s.run.lifetime, harvests: { pumpkin: 2 } } } }
    expect(stats(migrated).totals.filter((r) => /harvests/i.test(r.label)).map((r) => [r.label, r.value])).toEqual([
      ['Harvests', '38'],
      ['Carrot harvests since v6', '0'],
      ['Pumpkin harvests since v6', '2'],
    ])
    const tracked = { ...migrated, run: { ...migrated.run, lifetime: { ...s.run.lifetime, harvests: { radish: 36, pumpkin: 2 } } } }
    expect(row(stats(tracked).totals, 'Carrot harvests')).toMatchObject({ value: '36' })
  })

  it('a later run: the same balance functions give each value and its source', () => {
    const s = createInitialState()
    let state: GameState = {
      ...s,
      run: {
        ...s.run,
        tick: 3725,
        licenses: ['radish', 'pumpkin'],
        upgrades: { energyMax: 2, energyRegen: 1, sellPrice: 5, fertilizer: 3 },
        pickaxe: { tier: 'copper', durability: 150 },
        mastery: { wooden: 400, copper: 20 },
        masteredTiers: ['wooden'],
        storageLevel: 2,
        bagCapacity: 40,
        vein: { level: 2, progress: 0, rock: 'stone' },
        tools: { water: 2, harvest: 3, plant: 0 },
        toolN: { water: 2, harvest: 1, plant: 1 },
        lifetime: { cashEarned: 1234, energySpent: 567, bars: 6, harvests: { radish: 40 }, wagesPaid: 0, fireBurnt: 400, fireWasted: 75, barsSmelted: 6, workerPlants: 0, workerMines: 31, ironBars: 4, ironBarsSmelted: 5, ordersCompleted: 0, starsEarned: 0, goldBars: 0, goldBarsSmelted: 0 },
      },
    }
    // a pumpkin harvest counts toward cash earned and the pumpkin row
    state.run.tiles[0] = { status: 'planted', cropId: 'pumpkin', growth: cropGrowTicks('pumpkin', s.meta, 3), moisture: 0, ticksSinceMature: 0 }
    const r = harvest(state, 0)
    if (!r.ok) throw new Error(r.error)
    state = r.state
    const { totals, multipliers } = stats(state)
    expect(row(totals, 'Time played')).toEqual({ label: 'Time played', value: '1h 02m 05s' })
    expect(row(totals, 'Cash earned')!).toMatchObject({ value: `💰${1234 + Math.round(cropSellPrice('pumpkin', s.meta, 5) * handPickedBonus())}` })
    expect(row(totals, 'Pumpkin harvests')).toMatchObject({ value: '1' })
    expect(row(totals, 'Carrot harvests')).toMatchObject({ value: '40' })
    expect(row(totals, 'Copper bars smelted')).toMatchObject({ value: '6' })
    const iron = ['Iron bars smelted', 'Iron bars collected', 'Mines by workers']
    expect(totals.filter((r) => iron.includes(r.label)).map((r) => r.value)).toEqual(['5', '4', '31'])
    // 75 burn ticks = 2.5 units; a part-burnt unit counts as wasted
    expect(row(totals, 'Fire wasted')).toMatchObject({ value: `${Math.ceil(75 / fireUnitTicks())} units` })
    expect(row(multipliers, 'Sell price')).toEqual({ label: 'Sell price', value: '×1.5', source: 'Better prices Lv5' })
    expect(row(multipliers, 'Grow time')).toEqual({ label: 'Grow time', value: '×0.7', source: 'Fertilizer Lv3' })
    // copper Lv1 (20 xp) = 1 − 1/1.4 ≈ 28.6 % + 5 % for the mastered wooden tier
    expect(row(multipliers, 'Copper pickaxe preserve')).toEqual({
      label: 'Copper pickaxe preserve',
      value: '34 % · lasts ~301 uses',
      source: 'mastery Lv1 + 1 mastered × 5 %',
    })
    expect(row(multipliers, 'Storage')).toEqual({ label: 'Storage', value: '40 slots', source: 'Storage Lv2' })
    expect(row(multipliers, 'Water tool')).toEqual({ label: 'Water tool', value: '2 tiles per press', source: 'Garden Hose' })
    expect(row(multipliers, 'Harvest tool')).toEqual({ label: 'Harvest tool', value: 'all tiles per press', source: 'Reaper' })
    expect(row(multipliers, 'Drop table')).toEqual({
      label: 'Drop table',
      value: `${ITEMS.stone.emoji} Stone 65 % · ⚫ Coal 20 % · ${ITEMS.copperOre.emoji} Copper ore 15 %`,
      source: 'Vein Lv2',
    })
  })
})

describe('feedbackSummary(state)', () => {
  it('a fresh run in one line', () => {
    expect(feedbackSummary(createInitialState())).toBe(
      `cash ${STARTING_CASH} · licenses radish · tools` +
        ' water Lv0 tier 0, harvest Lv0 tier 0, plant Lv0 tier 0 · pickaxe none · ' +
        'workers 0 (plant 0, water 0, harvest 0, ore 0, fuel 0, mine 0, clerk 0) · vein Lv0 · furnace none · played 0m 00s',
    )
  })

  it('a later run: pickaxe, workers, smart furnace', () => {
    const s = createInitialState()
    const state: GameState = {
      ...s,
      run: {
        ...s.run,
        tick: 3725,
        pickaxe: { tier: 'copper', durability: 120 },
        vein: { level: 2, progress: 0, rock: 'stone' },
        workers: { pool: 3, assigned: { plant: 1, water: 1, harvest: 1, ore: 0, fuel: 0, mine: 0, clerk: 0 }, certificates: [] },
        furnace: { ...s.run.furnace, built: true, smart: true, levels: { fireCap: 1, batch: 2 } },
      },
    }
    const shown = feedbackSummary(state)
    expect(shown).toContain('workers 3 (plant 1, water 1, harvest 1, ore 0, fuel 0, mine 0, clerk 0) · vein Lv2')
    expect(shown).toContain('pickaxe copper 120 · ')
    expect(shown).toContain('furnace smart fire Lv1 batch Lv2 · played 1h 02m 05s')
  })
})

describe('timelineLines', () => {
  const with_ = (run: Partial<GameState['run']>): GameState => {
    const s = createInitialState()
    return { ...s, run: { ...s.run, ...run } }
  }

  it('a fresh run has no timeline; recorded milestones list by tick with play time from tick 0', () => {
    expect(timelineLines(createInitialState().run)).toEqual([])
    const s = with_({
      licenses: ['radish', 'lemon'],
      counters: { ...createInitialState().run.counters, harvests: 3 },
      milestones: { licenseLemon: 4320, firstHarvest: 100 },
    })
    expect(timelineLines(s.run)).toEqual(['First harvest — 1m', 'Lemon license — 1h 12m'])
  })

  it('milestones reached before tracking show once, with the tick tracking started', () => {
    const s = with_({
      licenses: ['radish', 'pumpkin'],
      counters: { ...createInitialState().run.counters, harvests: 30, sales: 30 },
      milestones: { trackingStarted: 7210, licenseLemon: 9000 },
    })
    // firstHarvest, sales25 and the carrot and pumpkin licenses were true before tracking; lemon is recorded (not owned here)
    expect(timelineLines(s.run)).toEqual(['… 4 earlier milestones before tracking (tracking since 2h 0m)', 'Lemon license — 2h 30m'])
  })
})
