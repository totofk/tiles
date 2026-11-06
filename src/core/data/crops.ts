// Identity only; every number for a crop lives in balance.ts.
export const CROP_IDS = ['radish', 'pumpkin'] as const
export type CropId = (typeof CROP_IDS)[number]

export const CROPS: Record<CropId, { name: string }> = {
  radish: { name: 'Radish' },
  pumpkin: { name: 'Pumpkin' },
}

export const STARTING_CROP: CropId = 'radish'
