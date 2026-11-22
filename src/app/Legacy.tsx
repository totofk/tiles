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
  startTiles,
  workerActionTicks,
  type DeedRowId,
} from '../core/balance'
import { STAR_EMOJI } from '../core/data/orders'
import { useState } from 'react'
import { DISTRICTS, DISTRICT_HINT } from '../core/data/districts'
import { fieldsGates } from '../core/fields'
import { currentListings, rerollListings, soilText, type Listing } from '../core/listings'
import { buyMetaUpgrade, deedsClaimable, sellFarmUnlocked } from '../core/prestige'
import type { GameState, MetaState } from '../core/state'
import { useTwoPress } from './DangerZone'
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
  keepRenown: 'Kept renown',
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
  keepRenown: "One-time: selling the farm keeps each crop's renown tier.",
  keepClerk: 'One-time: selling the farm keeps the Clerk certificate.',
  keepCertificates2: 'One-time: selling the farm keeps the ore, fuel and mine certificates.',
  mineStart: 'One-time: every new farm starts with the mine license and a copper pickaxe (not in Wetlands).',
  keepBoard: 'One-time: every new farm starts with the order board open.',
  keepManager: 'One-time: selling the farm keeps the Manager certificate.',
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
      return 'Renown tiers survive the sale'
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
      <p className="deeds">
        {STAR_EMOJI} {carried} carried to the next farm
        {run.stars > STAR_CARRY_CAP && ` · ${STAR_EMOJI}${run.stars - STAR_CARRY_CAP} lost above ${STAR_CARRY_CAP}`}
      </p>
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
      <h3>Resets</h3>
      <ul className="sell-list">
        <li>Tiles, cash, market, storage, tools</li>
        <li>Mine, furnace, workshop, fields, machines</li>
        <li>
          Licenses{meta.upgrades.keepLicenses > 0 ? ' — kept (Seed vault)' : ''}, workers and certificates
          {meta.upgrades.keepFirstCertificates > 0 ? ' — the 3 farm ones kept' : ''}
        </li>
        <li>⭐ Favours (the ⭐ balance carries, see above) and this run's timeline</li>
        <li>Renown{meta.upgrades.keepRenown > 0 ? ' — tiers kept' : ''}</li>
      </ul>
      <h3>Carries</h3>
      <ul className="sell-list">
        <li>🏆 deeds and every Legacy row bought</li>
        <li>The ⭐-bought order slots ({run.orders.slots})</li>
        <li>Lifetime totals — the deed meter keeps counting</li>
      </ul>
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
