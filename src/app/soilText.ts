// 🧭 soil trait one-liners (batch 36.5): every number is read from the balance pair, so a balance change moves
// the text with it; `strong` picks each pair's Lv3 member. One decimal only when needed (15, 22.5, ×1.45).
import {
  SOIL_CLAY_DRAIN,
  SOIL_CONTRACT_COUNT,
  SOIL_CREEK_SLIP,
  SOIL_DENSE_BURN,
  SOIL_EASY_GLUT,
  SOIL_FERTILE_GROW,
  SOIL_FIELD_PRICE,
  SOIL_HOME_PRICE,
  SOIL_LOOSE_ROT,
  SOIL_RICH_DOUBLE,
} from '../core/balance'
import { GROUP_NAMES } from '../core/data/crops'
import type { SoilTraitId } from '../core/data/soil'
import { traitGroup } from '../core/survey'

const num = (n: number) => `${Math.round(n * 100) / 100}`
const pct = (n: number) => `${num(n * 100)} %`
const strong = <T,>(pair: readonly [T, T], isStrong: boolean): T => (isStrong ? pair[1] : pair[0])

/** the trait's effect line; `isStrong` = survey Lv3 (every delta ×1.5) */
export function soilTraitText(id: SoilTraitId, isStrong: boolean): string {
  switch (id) {
    case 'roots':
    case 'fruitVeg':
    case 'berry':
      return `${GROUP_NAMES[traitGroup(id)!]} crops sell +${pct(strong(SOIL_HOME_PRICE, isStrong) - 1)}`
    case 'rootsPrice':
    case 'fruitVegPrice':
    case 'berryPrice':
      return `${GROUP_NAMES[traitGroup(id)!]} crops sell +${pct(strong(SOIL_FIELD_PRICE, isStrong) - 1)}`
    case 'clay':
      return `drains ${pct(1 - strong(SOIL_CLAY_DRAIN, isStrong))} slower`
    case 'loose':
      return `ripe crops wait ×${num(strong(SOIL_LOOSE_ROT, isStrong))} before rotting`
    case 'rich':
      return `+${pct(strong(SOIL_RICH_DOUBLE, isStrong))} double harvest`
    case 'fertile':
      return `grows ${pct(1 - strong(SOIL_FERTILE_GROW, isStrong))} faster`
    case 'creek': {
      const [n, d] = strong(SOIL_CREEK_SLIP, isStrong)
      return `grows ×${num((2 * (d - n)) / d)} with an empty tank`
    }
    case 'dense': {
      const [n, d] = strong(SOIL_DENSE_BURN, isStrong)
      return `burns ${pct(1 - n / d)} less tank coal`
    }
    case 'contract':
      return `each crop counts ×${num(strong(SOIL_CONTRACT_COUNT, isStrong))} toward a contract`
    case 'easySell':
      return `gluts the market ${pct(1 - strong(SOIL_EASY_GLUT, isStrong))} less`
  }
}
