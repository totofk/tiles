import { SAVE_KEY } from '../save/storage'

/**
 * The storage event handler that freezes this tab when another one rewrites the save (batch 23 task 117): a
 * second tab's autosave must not silently clobber this tab's run — or an import done here. Browsers fire
 * `storage` only in OTHER documents, so this tab's own writes never trigger it.
 */
export function onForeignSaveEvent(event: { key: string | null }, freeze: () => void): void {
  if (event.key === SAVE_KEY) freeze()
}
