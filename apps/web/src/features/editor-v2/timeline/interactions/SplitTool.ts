/**
 * Split Tool
 * Handles split mode interaction - finding items at a given time position
 * and tracking the cursor position for the split line indicator.
 */

import { TimelineItem } from '../../store/types';

export class SplitTool {
  private cursorTimeMs: number = 0;

  setCursorTime(timeMs: number): void {
    this.cursorTimeMs = timeMs;
  }

  getCursorTime(): number {
    return this.cursorTimeMs;
  }

  /**
   * Find the item on a specific track at the given time position.
   * Returns the item ID if found, null otherwise.
   */
  findItemAtPosition(
    timeMs: number,
    trackId: string,
    items: Record<string, TimelineItem>,
    itemIds: string[]
  ): string | null {
    for (const id of itemIds) {
      const item = items[id];
      if (
        item?.trackId === trackId &&
        item.startMs <= timeMs &&
        item.endMs > timeMs
      ) {
        return id;
      }
    }
    return null;
  }
}

let instance: SplitTool | null = null;
export function getSplitTool(): SplitTool {
  if (!instance) instance = new SplitTool();
  return instance;
}
