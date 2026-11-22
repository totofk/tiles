// 🧭 Soil survey (batch 36.5, DECISIONS "Batch 36.5 refined"): ⭐ levels roll a trait for each of the 4 home beds (Lv1)
// and each Estate field (Lv2); Lv3 (SURVEY_STRONG_LEVEL) multiplies every trait's delta by 1.5. A reroll is a fresh
// uniform roll of that unit's pool and may land on the same trait. Rolls use the run's seeded PRNG; prices in balance.
import { fail, nextRandom, type ActionResult } from './actions'
import { pay } from './mining'
import { PLAIN_SALE, type SaleSoil } from './market'
import {
  SOIL_CREEK_SLIP,
  SOIL_CONTRACT_COUNT,
  SOIL_DENSE_BURN,
  SOIL_EASY_GLUT,
  SOIL_FERTILE_GROW,
  SOIL_FIELD_PRICE,
  SOIL_HOME_PRICE,
  SURVEY_FIELDS_LEVEL,
  SURVEY_STRONG_LEVEL,
  soilRerollStars,
} from './balance'
import { GROUP_IDS, cropGroup, type CropId, type GroupId } from './data/crops'
import { FIELD_TRAITS, HOME_TRAITS, type FieldTraitId, type HomeTraitId } from './data/soil'
import type { GameState, RunState, Survey } from './state'

/** the field trait a group's price trait is spelled as */
const PRICE_OF_GROUP: Record<GroupId, FieldTraitId> = { roots: 'rootsPrice', fruitVeg: 'fruitVegPrice', berry: 'berryPrice' }

/** the crop group a price trait lifts (home and field spellings); null for the non-price traits */
export function traitGroup(trait: HomeTraitId | FieldTraitId | null): GroupId | null {
  if (trait === 'roots' || trait === 'rootsPrice') return 'roots'
  if (trait === 'fruitVeg' || trait === 'fruitVegPrice') return 'fruitVeg'
  if (trait === 'berry' || trait === 'berryPrice') return 'berry'
  return null
}

/** one uniform home draw: 1 draw over the 7 home traits */
function drawHome(rngState: number): [HomeTraitId, number] {
  const [r, next] = nextRandom(rngState)
  return [HOME_TRAITS[Math.floor(r * HOME_TRAITS.length)], next]
}

/** one field draw: 1 draw over {group price, creek, dense, contract, easySell, fertile}; the group price takes a
 * second draw over the 3 groups (a berry price field is 1 in 18) */
export function drawField(rngState: number): [FieldTraitId, number] {
  const [r, afterR] = nextRandom(rngState)
  const k = Math.floor(r * 6)
  if (k === 0) {
    const [r2, next] = nextRandom(afterR)
    return [PRICE_OF_GROUP[GROUP_IDS[Math.floor(r2 * GROUP_IDS.length)]], next]
  }
  return [FIELD_TRAITS[2 + k], afterR]
}

/** rolls every bed's trait (Lv1 purchase), keeping each unit's reroll count */
function rollBeds(survey: Survey, rngState: number): { survey: Survey; rngState: number } {
  let rng = rngState
  const beds = survey.beds.map((bed) => {
    const [trait, next] = drawHome(rng)
    rng = next
    return { trait, rerolls: bed.rerolls }
  })
  return { survey: { ...survey, beds }, rngState: rng }
}

/** rolls a trait for each of the `listLength` fields (Lv2 purchase): fields becomes exactly list.length long */
function rollFields(survey: Survey, listLength: number, rngState: number): { survey: Survey; rngState: number } {
  let rng = rngState
  const fields = Array.from({ length: listLength }, (_, k) => {
    const [trait, next] = drawField(rng)
    rng = next
    return { trait, rerolls: survey.fields[k]?.rerolls ?? 0 }
  })
  return { survey: { ...survey, fields }, rngState: rng }
}

/** what buying the survey's next ⭐ level changes: Lv1 rolls the beds, Lv2 the fields, Lv3 rolls nothing */
export function surveyLevelGain(run: RunState): Partial<RunState> {
  const s = run.survey
  if (s.level === 0) {
    const rolled = rollBeds(s, run.rngState)
    return { survey: { ...rolled.survey, level: 1 }, rngState: rolled.rngState }
  }
  if (s.level === SURVEY_FIELDS_LEVEL - 1) {
    const rolled = rollFields(s, run.fields.list.length, run.rngState)
    return { survey: { ...rolled.survey, level: SURVEY_FIELDS_LEVEL }, rngState: rolled.rngState }
  }
  return { survey: { ...s, level: s.level + 1 } }
}

// Order: LOCKED (bed: level < 1; field: level < 2), BAD_TILE (no such unit, or a field not rolled), then pay's NO_STARS.
export function rerollSoil(state: GameState, where: 'bed' | 'field', k: number): ActionResult {
  const { run } = state
  const s = run.survey
  if (where === 'bed') {
    if (s.level < 1) return fail('LOCKED')
    if (!Number.isInteger(k) || k < 0 || k >= s.beds.length || !s.beds[k]) return fail('BAD_TILE')
    const rerolls = s.beds[k].rerolls
    const [trait, rngState] = drawHome(run.rngState)
    const beds = s.beds.map((u, i) => (i === k ? { trait, rerolls: rerolls + 1 } : u))
    return pay(state, { cash: 0, stars: soilRerollStars(rerolls) }, { survey: { ...s, beds }, rngState })
  }
  if (s.level < SURVEY_FIELDS_LEVEL) return fail('LOCKED')
  if (!Number.isInteger(k) || k < 0 || k >= run.fields.list.length || !s.fields[k]) return fail('BAD_TILE')
  const rerolls = s.fields[k].rerolls
  const [trait, rngState] = drawField(run.rngState)
  const fields = s.fields.map((u, i) => (i === k ? { trait, rerolls: rerolls + 1 } : u))
  return pay(state, { cash: 0, stars: soilRerollStars(rerolls) }, { survey: { ...s, fields }, rngState })
}

/** the bed's rolled trait, or null (level too low, no such bed) */
export function bedTrait(run: RunState, bed: number): HomeTraitId | null {
  return run.survey.level >= 1 ? run.survey.beds[bed]?.trait ?? null : null
}

/** field k's rolled trait, or null (level too low, k outside the list, or not rolled yet) */
export function fieldTrait(run: RunState, k: number): FieldTraitId | null {
  return run.survey.level >= SURVEY_FIELDS_LEVEL && k >= 0 && k < run.fields.list.length ? run.survey.fields[k]?.trait ?? null : null
}

/** Lv3: every trait's delta ×1.5 */
export function soilStrong(run: RunState): boolean {
  return run.survey.level >= SURVEY_STRONG_LEVEL
}

/** "on n of every d ticks": true when the n/d share's boundary passes with this tick (integer arithmetic) */
export function everyNth(tick: number, rule: readonly [number, number]): boolean {
  const [n, d] = rule
  return Math.floor(((tick + 1) * n) / d) > Math.floor((tick * n) / d)
}

/** the [lv1, lv3] pair's member for this run */
export function soilPair<T>(run: RunState, pair: readonly [T, T]): T {
  return soilStrong(run) ? pair[1] : pair[0]
}

/** the bed's sale factors for `crop` (a 🥔/🍅/🍓 price trait lifts that group's sales from this bed, 🌳 tree tiles
 * included); glut and order stay plain — easy market and contract land are field traits */
export function bedSaleSoil(run: RunState, bed: number, crop: CropId): SaleSoil {
  const trait = bedTrait(run, bed)
  return trait !== null && traitGroup(trait) === cropGroup(crop) ? { ...PLAIN_SALE, price: soilPair(run, SOIL_HOME_PRICE) } : PLAIN_SALE
}

/** field k's sale factors for `crop`: its group's price, 🤝 easy market's glut, 📜 contract's order count */
export function fieldSaleSoil(run: RunState, k: number, crop: CropId): SaleSoil {
  const trait = fieldTrait(run, k)
  if (trait === null) return PLAIN_SALE
  return {
    price: traitGroup(trait) === cropGroup(crop) ? soilPair(run, SOIL_FIELD_PRICE) : 1,
    glut: trait === 'easySell' ? soilPair(run, SOIL_EASY_GLUT) : 1,
    order: trait === 'contract' ? soilPair(run, SOIL_CONTRACT_COUNT) : 1,
  }
}

/** the field's pressured-cycle factor (🌻 fertile: ×0.9 / ×0.85); 1 without the trait */
export function fieldGrowFactor(run: RunState, k: number): number {
  return fieldTrait(run, k) === 'fertile' ? soilPair(run, SOIL_FERTILE_GROW) : 1
}

/** the field's unpaid-slip tick rule (💦 creek), or null */
export function fieldCreekSlip(run: RunState, k: number): readonly [number, number] | null {
  return fieldTrait(run, k) === 'creek' ? soilPair(run, SOIL_CREEK_SLIP) : null
}

/** the field's tank-burn thinning rule (🌑 dense: a plot burns on n of every d ticks), or null */
export function fieldDenseBurn(run: RunState, k: number): readonly [number, number] | null {
  return fieldTrait(run, k) === 'dense' ? soilPair(run, SOIL_DENSE_BURN) : null
}
