import {
  DEED_ROW_IDS,
  deedCost,
  deedMaxLevel,
  energyMax,
  multiplier,
  startTiles,
  workerActionTicks,
  type DeedRowId,
} from '../core/balance'
import { buyMetaUpgrade } from '../core/prestige'
import type { GameState, MetaState } from '../core/state'
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
