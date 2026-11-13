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
