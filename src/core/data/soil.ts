/** the 🧭 soil survey's two trait pools (batch 36.5): home rolls per BED, the Estate per FIELD */
export const HOME_TRAITS = ['roots', 'fruitVeg', 'berry', 'clay', 'loose', 'rich', 'fertile'] as const
export const FIELD_TRAITS = ['rootsPrice', 'fruitVegPrice', 'berryPrice', 'creek', 'dense', 'contract', 'easySell', 'fertile'] as const
export type HomeTraitId = (typeof HOME_TRAITS)[number]
export type FieldTraitId = (typeof FIELD_TRAITS)[number]
export type SoilTraitId = HomeTraitId | FieldTraitId

export const SURVEY_EMOJI = '🧭'

export const SOIL_TRAITS: Record<SoilTraitId, { emoji: string; name: string }> = {
  roots: { emoji: '🥔', name: 'Root soil' },
  fruitVeg: { emoji: '🍅', name: 'Veg soil' },
  berry: { emoji: '🍓', name: 'Berry soil' },
  clay: { emoji: '🧱', name: 'Clay' },
  loose: { emoji: '🍂', name: 'Loose soil' },
  rich: { emoji: '💎', name: 'Rich soil' },
  fertile: { emoji: '🌻', name: 'Fertile soil' },
  rootsPrice: { emoji: '🥔', name: 'Root soil' },
  fruitVegPrice: { emoji: '🍅', name: 'Veg soil' },
  berryPrice: { emoji: '🍓', name: 'Berry soil' },
  creek: { emoji: '💦', name: 'Creek' },
  dense: { emoji: '🌑', name: 'Dense soil' },
  contract: { emoji: '📜', name: 'Contract land' },
  easySell: { emoji: '🤝', name: 'Easy market' },
}
