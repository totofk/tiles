import {
  DEED_ROW_IDS,
  LISTING_REROLL_MAX,
  PRESTIGE_GATE_DEEDS,
  STAR_CARRY_CAP,
  deedCost,
  deedMaxLevel,
  deedsFor,
  energyMax,
  listingRerollStars,
  multiplier,
  nextDeedCash,
  renownBadge,
  renownTier,
  startTiles,
  workerActionTicks,
  type DeedRowId,
} from '../core/balance'
import { CROPS, CROP_IDS, STARTING_CROP } from '../core/data/crops'
import { STAR_EMOJI } from '../core/data/orders'
import { useState } from 'react'
import { DISTRICTS, DISTRICT_HINT } from '../core/data/districts'
import { fieldsGates } from '../core/fields'
import { currentListings, rerollListings, soilText, type Listing } from '../core/listings'
import { buyMetaUpgrade, deedsClaimable, sellFarmUnlocked } from '../core/prestige'
import { createFreshRun, type GameState, type MetaState } from '../core/state'
import { useTwoPress } from './DangerZone'
import { CROP_EMOJI } from './FarmGrid'
import { count } from './fmt'
import { Item } from './Info'
import type { Act } from './useGame'

const NAMES: Record<DeedRowId, string> = {
  growTime: 'Fast crops',
  sellPrice: 'Rich harvest',
  cost: 'Cheap everything',
  energy: 'Deep stamina',
  startTiles: 'Bigger start',
  workerSpeed: 'Quick crews',
  keepLicenses: 'Seed vault',
  keepFirstCertificates: 'Kept certificates',
  keepRenown: 'Apprentices',
  keepClerk: 'Kept Clerk',
  keepCertificates2: 'Kept certificates II',
  mineStart: "Miner's start",
  keepBoard: 'Kept Noticeboard',
  keepManager: 'Kept Manager',
}

const TIPS: Record<DeedRowId, string> = {
  growTime: 'Every crop grows 4 % faster per level, forever.',
  sellPrice: 'Every sale pays 5 % more per level, forever.',
  cost: 'Everything bought with cash costs 4 % less per level, forever.',
  energy: '+2 max energy per level, on top of the run upgrade.',
  startTiles: 'The next sold run starts with 2 more tiles per level.',
  workerSpeed: 'Workers and sprinklers act 0.5 s sooner per level.',
  keepLicenses: 'One-time: selling the farm keeps every crop license.',
  keepFirstCertificates: 'One-time: selling the farm keeps the plant, water and harvest certificates.',
  keepRenown: 'One-time: worker harvests earn renown like a hand harvest (+2 instead of +1).',
  keepClerk: 'One-time: selling the farm keeps the Clerk certificate.',
  keepCertificates2: 'One-time: selling the farm keeps the ore, fuel and mine certificates.',
  mineStart: 'One-time: every new farm starts with the mine license and a copper pickaxe (not in Wetlands).',
  keepBoard: 'One-time: every new farm starts with the order board open.',
  keepManager: 'One-time: selling the farm keeps the Manager certificate.',
}

/** the sale preview's Kept column: one row per owned keep, in this order */
const KEPT_ROWS: [DeedRowId, string][] = [
  ['keepLicenses', 'every crop license'],
  ['keepFirstCertificates', 'plant, water, harvest'],
  ['keepClerk', 'the Clerk certificate'],
  ['keepCertificates2', 'ore, fuel, mine'],
  ['keepBoard', 'the order board'],
  ['mineStart', 'mine license + copper pickaxe'],
  ['keepManager', 'the Manager certificate'],
  ['keepRenown', 'workers earn +2 renown'],
]

/** 🏆 the Legacy chip (batch 36.6): deeds held and what a sale adds once the gate is open, the next deed's lifetime
 * cash before it; a tap opens the 🏦 Bank tab */
export function LegacyChip({ state, openBank }: { state: GameState; openBank: () => void }) {
  return (
    <button className="legacy-chip" onClick={openBank}>
      {sellFarmUnlocked(state)
        ? `🏆 ${state.meta.deeds} · sale +${deedsClaimable(state)}`
        : `🏆 next deed at 💰${count(nextDeedCash(state.run.lifetime.cashEarned))} lifetime`}
    </button>
  )
}

/** "Grow ×1 → ×0.96"; at the max level only the current value */
function effect(id: DeedRowId, level: number, meta: MetaState, runLevel: number, maxed: boolean): string {
  const withLevel = (l: number): MetaState => ({ ...meta, upgrades: { ...meta.upgrades, [id]: l } })
  const show = (label: string, value: (m: MetaState) => string) =>
    maxed ? `${label} ${value(meta)}` : `${label} ${value(meta)} → ${value(withLevel(level + 1))}`
  switch (id) {
    case 'growTime':
      return show('Grow', (m) => `×${multiplier(m, 'growTime').toFixed(2)}`)
    case 'sellPrice':
      return show('Sell', (m) => `×${multiplier(m, 'sellPrice').toFixed(2)}`)
    case 'cost':
      return show('Cost', (m) => `×${multiplier(m, 'cost').toFixed(2)}`)
    case 'energy':
      return show('Energy max', (m) => `${energyMax(runLevel, m)}`)
    case 'startTiles':
      return show('Start', (m) => `${startTiles(m)} tiles`)
    case 'workerSpeed':
      return show('Crew', (m) => `every ${workerActionTicks(m).toFixed(1)}s`)
    case 'keepLicenses':
      return 'Crop licenses survive the sale'
    case 'keepFirstCertificates':
      return 'The 3 farm certificates survive the sale'
    case 'keepRenown':
      return 'Workers earn +2 renown'
    case 'keepClerk':
      return 'The Clerk certificate survives the sale'
    case 'keepCertificates2':
      return 'Ore, fuel and mine certificates survive the sale'
    case 'mineStart':
      return 'Mine license + copper pickaxe at the start'
    case 'keepBoard':
      return 'Order board open from the start'
    case 'keepManager':
      return 'The Manager certificate survives the sale'
  }
}

/** 🏆 Legacy: the deed shop — levels on the meta upgrade table, priced in deeds (shown once a farm has been sold) */
export function Legacy({ state, act }: { state: GameState; act: Act }) {
  const { meta, run } = state
  return (
    <section className="shop">
      <h2>🏆 Legacy</h2>
      <p className="deeds">
        🏆 {meta.deeds} deed{meta.deeds === 1 ? '' : 's'} to spend — {meta.prestigeCount} farm{meta.prestigeCount === 1 ? '' : 's'} sold
      </p>
      <div className="shop-row one-col">
        {DEED_ROW_IDS.map((id) => {
          const level = meta.upgrades[id]
          const max = deedMaxLevel(id)
          const cost = deedCost(id, level)
          const maxed = level >= max
          return (
            <Item key={id} tip={TIPS[id]}>
              <button disabled={maxed || meta.deeds < cost} onClick={() => act((s) => buyMetaUpgrade(s, id))}>
                {NAMES[id]} {max === 1 ? '' : `Lv ${level}/${max} `}
                <small>{`${effect(id, level, meta, run.upgrades.energyMax, maxed)} · ${maxed ? 'kept' : `${cost} deed${cost === 1 ? '' : 's'}`}`}</small>
              </button>
            </Item>
          )
        })}
      </div>
    </section>
  )
}

/** what still blocks the sale gate, in the Fields-unlock "needs …" style: uncovered farm jobs, then deeds short */
function gateShort(state: GameState): string {
  const { run } = state
  const deeds = deedsFor(run.lifetime.cashEarned)
  return [
    !run.workers.certificates.includes('plant') && 'planter certificate',
    !run.workers.certificates.includes('harvest') && 'harvester certificate',
    !fieldsGates(run).water && '1 bed sprinkler',
    deeds < PRESTIGE_GATE_DEEDS && `${PRESTIGE_GATE_DEEDS - deeds} more deeds`,
  ]
    .filter(Boolean)
    .join(' + ')
}

/**
 * The sale card, shown at every stage (batch 35.4: information only, no nudge): exactly what resets and what carries,
 * the deeds selling gives once the gate is open, then the two-press "Sell the farm" once the gate is open (disabled with no gain) — before
 * that a locked teaser naming what is missing.
 */
export function SellCard({ state, act, sell }: { state: GameState; act: Act; sell: (choice: Listing) => void }) {
  const { run, meta } = state
  const listings = currentListings(meta, run.listing.district)
  // the pick belongs to one offer: a reroll or a sale shows a new one and the selection falls back to the plain row
  const offerKey = `${meta.prestigeCount}/${meta.listingRerolls}`
  const [pick, setPick] = useState({ offerKey, index: 0 })
  const selected = pick.offerKey === offerKey ? pick.index : 0
  const [armed, press] = useTwoPress(() => sell(listings[selected]))
  // batch 34: cash deeds only (⭐ no longer converts); the ⭐ balance carries, capped
  const gain = deedsClaimable(state)
  const carried = Math.min(run.stars, STAR_CARRY_CAP)
  const open = sellFarmUnlocked(state)
  const renowned = CROP_IDS.filter((c) => renownTier(run.renown[c] ?? 0) >= 1)
  // the next run's start-seed kit, exactly as createFreshRun gives it
  const nextSeeds = createFreshRun(meta, {
    licenses: meta.upgrades.keepLicenses > 0 ? run.licenses : [STARTING_CROP],
    certificates: [],
    orderSlots: run.orders.slots,
    lifetime: run.lifetime,
    stars: 0,
    renown: run.renown,
  }).seeds
  const kit = CROP_IDS.filter((c) => (nextSeeds[c] ?? 0) > 0)
  const rerollsLeft = meta.listingRerolls < LISTING_REROLL_MAX
  const rerollStars = listingRerollStars(meta.listingRerolls)
  return (
    <section className="shop">
      <h2>🏆 Sell the farm</h2>
      {open && (
        <p className="deeds">
          Selling gives +{gain} deed{gain === 1 ? '' : 's'} (💰{count(gain)})
        </p>
      )}
      <h3>Next farm</h3>
      <div className="shop-row one-col">
        {listings.map((l, i) => (
          <button key={i} className={i === selected ? 'selected' : ''} aria-pressed={i === selected} onClick={() => setPick({ offerKey, index: i })}>
            {DISTRICTS[l.district].emoji} {DISTRICTS[l.district].name}
            <small>{l.soil ? soilText(l.soil) : "today's farm, no soil"}</small>
            {DISTRICT_HINT[l.district] && <small>{DISTRICT_HINT[l.district]}</small>}
          </button>
        ))}
        <button disabled={!open || !rerollsLeft || run.stars < rerollStars} onClick={() => act(rerollListings)}>
          {rerollsLeft ? `🔄 Reroll ${STAR_EMOJI}${rerollStars} · ${meta.listingRerolls}/${LISTING_REROLL_MAX}` : `🔄 Reroll · ${LISTING_REROLL_MAX}/${LISTING_REROLL_MAX}`}
        </button>
      </div>
      {/* batch 36.7: the wrap is the container the 3-column mode queries (panel width, not viewport) */}
      <div className="sell-cols-wrap">
      <div className="sell-cols">
        <div>
          <h3>Gain</h3>
          <ul className="sell-list">
            {open && <li>{`+${gain} deed${gain === 1 ? '' : 's'}`}</li>}
            <li>{`${STAR_EMOJI}${carried} carried`}</li>
            {renowned.length === 0 ? <li>Renown: none yet</li> : renowned.map((c) => <li key={c}>{`${renownBadge(run.renown[c]!)} ${CROPS[c].name} ${count(run.renown[c]!)}`}</li>)}
            {kit.length > 0 && <li>Start seeds: {kit.map((c) => `${nextSeeds[c]} ${CROP_EMOJI[c]}`).join(' ')}</li>}
          </ul>
        </div>
        <div>
          <h3>Lost</h3>
          <ul className="sell-list">
            {run.stars > STAR_CARRY_CAP && <li className="lost">{`${STAR_EMOJI}${run.stars - STAR_CARRY_CAP} above ${STAR_CARRY_CAP} — spend or reroll listings first`}</li>}
            <li>Every ⭐ Favour level</li>
            <li>Tiles, cash, market, storage, tools</li>
            <li>Mine, furnace, workshop, fields, machines</li>
            <li>Licenses, workers and certificates not kept</li>
            <li>This run's timeline</li>
          </ul>
        </div>
        <div>
          <h3>Kept</h3>
          <ul className="sell-list">
            <li>🏆 deeds and every Legacy row bought</li>
            {KEPT_ROWS.filter(([id]) => meta.upgrades[id] > 0).map(([id, text]) => (
              <li key={id}>{`${NAMES[id]} — ${text}`}</li>
            ))}
            <li>The ⭐-bought order slots ({run.orders.slots})</li>
            <li>Lifetime totals — the deed meter keeps counting</li>
            <li>Renown — every crop's points</li>
          </ul>
        </div>
      </div>
      </div>
      {open ? (
        <button className={armed ? 'reset armed' : 'reset'} disabled={gain < 1} onClick={press}>
          {gain < 1 ? 'No deeds to gain — play on' : armed ? 'Press again to sell the farm' : 'Sell the farm'}
        </button>
      ) : (
        <div className="shop-row one-col">
          <button className="locked" disabled>
            🔒 Sell the farm
            <small>needs {gateShort(state)}</small>
          </button>
        </div>
      )}
    </section>
  )
}
