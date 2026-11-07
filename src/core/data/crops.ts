// Identity only; every number for a crop lives in balance.ts.
/** in license order; the Shop lists them this way */
export const CROP_IDS = ['radish', 'chilli', 'pumpkin', 'lemon'] as const
export type CropId = (typeof CROP_IDS)[number]

export const CROPS: Record<CropId, { name: string }> = {
  // displays as Carrot (matches 🥕); the id stays `radish` so saves need no migration
  radish: { name: 'Carrot' },
  chilli: { name: 'Chilli' },
  pumpkin: { name: 'Pumpkin' },
  lemon: { name: 'Lemon' },
}

export const STARTING_CROP: CropId = 'radish'
