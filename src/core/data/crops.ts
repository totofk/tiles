// Identity only; every number for a crop lives in balance.ts.
/** in license order; the Shop lists them this way */
export const CROP_IDS = ['potato', 'radish', 'corn', 'eggplant', 'pumpkin', 'tomato', 'lemon', 'grape', 'strawberry', 'chilli'] as const
export type CropId = (typeof CROP_IDS)[number]

export const CROPS: Record<CropId, { name: string }> = {
  potato: { name: 'Potato' },
  // displays as Carrot (matches 🥕); the id stays `radish` so saves need no migration
  radish: { name: 'Carrot' },
  corn: { name: 'Corn' },
  eggplant: { name: 'Eggplant' },
  pumpkin: { name: 'Pumpkin' },
  tomato: { name: 'Tomato' },
  lemon: { name: 'Lemon' },
  grape: { name: 'Grape' },
  strawberry: { name: 'Strawberry' },
  chilli: { name: 'Chilli' },
}

export const STARTING_CROP: CropId = 'potato'

/** the crop groups a listing soil speeds up or slows down (batch 36.1); every crop is in exactly one */
export const GROUP_IDS = ['roots', 'fruitVeg', 'berry'] as const
export type GroupId = (typeof GROUP_IDS)[number]

export const CROP_GROUPS: Record<GroupId, readonly CropId[]> = {
  roots: ['potato', 'radish', 'corn'],
  fruitVeg: ['eggplant', 'pumpkin', 'tomato', 'chilli'],
  berry: ['lemon', 'grape', 'strawberry'],
}

export const cropGroup = (cropId: CropId): GroupId => GROUP_IDS.find((g) => CROP_GROUPS[g].includes(cropId))!

export const GROUP_NAMES: Record<GroupId, string> = { roots: 'roots', fruitVeg: 'fruit-veg', berry: 'berry' }

/** a rolled listing's soil: the fast group grows faster, the slow group slower (fast ≠ slow) */
export type ListingSoil = { fast: GroupId; slow: GroupId }
