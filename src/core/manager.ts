// The 💼 Manager's plan (batch 29, PLAN.md task 150d): which crop chip each managed field (a pivot, not 📌 pinned)
// should show. Accepted contracts take the fields they still need first; the rest go to the best steady 💰/h split.
import { doubleHarvestChance, fieldPlots, plotTiles } from './balance'
import { CROP_IDS, type CropId } from './data/crops'
import { fieldsCropIncomeCurve, fieldsPlantable, plantedTiles } from './fields'
import { isCropGood, isOffer } from './orders'
import type { GameState } from './state'

export type ManagerPlan = {
  contracts: { slot: number; crop: CropId; fields: number[] }[]
  rest: { crop: CropId; fields: number[] }[]
  /** the chip the Manager wants on field k; null for unmanaged fields */
  target: (CropId | null)[]
}

export function managerPlan(state: GameState): ManagerPlan {
  const { run } = state
  const list = run.fields.list
  const target: (CropId | null)[] = list.map(() => null)
  const managed = run.fields.unlocked ? list.flatMap((f, k) => (f.pivot && !f.pinned ? [k] : [])) : []
  if (managed.length === 0) return { contracts: [], rest: [], target }
  const fieldTiles = fieldPlots() * plotTiles()
  const perTile = 1 + doubleHarvestChance(run.toolTier.harvest)
  const fixed = Object.fromEntries(CROP_IDS.map((c) => [c, 0])) as Record<CropId, number>
  for (const f of list) if (f.pivot && f.pinned && f.crop) fixed[f.crop] += f.plots.length * plotTiles()
  let free = managed
  // fields already showing the chip first, then the lowest free index
  const take = (crop: CropId, n: number): number[] => {
    const picked = [...free.filter((k) => list[k].crop === crop), ...free.filter((k) => list[k].crop !== crop)].slice(0, n)
    free = free.filter((k) => !picked.includes(k))
    for (const k of picked) target[k] = crop
    return picked
  }

  const contracts: ManagerPlan['contracts'] = []
  run.orders.offers.forEach((o, slot) => {
    if (!isOffer(o) || !o.accepted || o.done >= o.count || !isCropGood(o.good) || !fieldsPlantable(run, o.good)) return
    const shortfall = o.count - o.done - plantedTiles(run.fields, o.good) * perTile
    const need = Math.min(free.length, Math.max(0, Math.ceil(shortfall / (fieldTiles * perTile))))
    if (need === 0) return
    contracts.push({ slot, crop: o.good, fields: take(o.good, need) })
    fixed[o.good] += need * fieldTiles
  })

  // exact DP over crops × fields: the market floor makes income non-concave, so greedy misses the best split
  const crops = CROP_IDS.filter((c) => fieldsPlantable(run, c))
  const m = free.length
  const value = crops.map((c) => {
    const income = fieldsCropIncomeCurve(state, c)
    const base = income(fixed[c])
    return Array.from({ length: m + 1 }, (_, j) => income(fixed[c] + j * fieldTiles) - base)
  })
  const best: number[][] = [Array(m + 1).fill(0)]
  const pick: number[][] = []
  crops.forEach((_, i) => {
    best.push([])
    pick.push([])
    for (let n = 0; n <= m; n++) {
      let b = -Infinity
      let bj = 0
      for (let j = 0; j <= n; j++) {
        const v = best[i][n - j] + value[i][j]
        if (v > b) [b, bj] = [v, j]
      }
      best[i + 1].push(b)
      pick[i].push(bj)
    }
  })
  const count = new Map<CropId, number>()
  for (let i = crops.length - 1, n = m; i >= 0; i--) {
    const j = pick[i][n]
    if (j > 0) count.set(crops[i], j)
    n -= j
  }

  // a field whose chip is already in the plan keeps it; the others take what is left, crops in CROP_IDS order
  const rest = crops.filter((c) => count.has(c)).map((crop) => ({ crop, fields: [] as number[] }))
  const restOf = (c: CropId) => rest.find((r) => r.crop === c)!
  const open: number[] = []
  for (const k of free) {
    const c = list[k].crop
    if (c && (count.get(c) ?? 0) > 0) {
      count.set(c, count.get(c)! - 1)
      restOf(c).fields.push(k)
      target[k] = c
    } else open.push(k)
  }
  for (const r of rest)
    for (; count.get(r.crop)! > 0 && open.length > 0; count.set(r.crop, count.get(r.crop)! - 1)) {
      const k = open.shift()!
      r.fields.push(k)
      target[k] = r.crop
    }
  for (const r of rest) r.fields.sort((a, b) => a - b)
  return { contracts, rest, target }
}
