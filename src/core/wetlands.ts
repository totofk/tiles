// Wetlands (batch 36.3): the farm with no mine. The river waters the bank beds; the barge sells what the mine would.
import type { Listing } from './listings'

/** a Wetlands run that does not own the mine licence; one bought before 36.3 keeps its whole mine */
export const noMine = (run: { listing: Listing; mineLicense: boolean }): boolean => run.listing.district === 'wetlands' && !run.mineLicense
