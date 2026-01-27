/**
 * ClipboardManager
 * Thin wrapper coordinating clipboard shortcuts with store actions.
 * The actual clipboard data lives in the Zustand store.
 */

export class ClipboardManager {
  copy(selectedIds: string[], copyAction: (ids: string[]) => void): void {
    if (selectedIds.length === 0) return;
    copyAction(selectedIds);
  }

  paste(currentTimeMs: number, pasteAction: (atMs: number) => void): void {
    pasteAction(currentTimeMs);
  }

  duplicate(selectedIds: string[], duplicateAction: (ids: string[]) => void): void {
    if (selectedIds.length === 0) return;
    duplicateAction(selectedIds);
  }
}

let instance: ClipboardManager | null = null;

export function getClipboardManager(): ClipboardManager {
  if (!instance) instance = new ClipboardManager();
  return instance;
}
