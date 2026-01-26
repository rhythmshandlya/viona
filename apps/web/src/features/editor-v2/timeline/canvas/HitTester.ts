/**
 * Hit Tester
 * Handles click detection on timeline items
 */

import {
  Track,
  TimelineItem,
  Viewport,
  DragType,
} from '../../store/types';

export interface HitResult {
  type: 'item' | 'track' | 'empty' | 'playhead';
  itemId?: string;
  trackId?: string;
  edge?: 'left' | 'right' | 'body';
  timeMs?: number;
}

export interface HitTestState {
  tracks: Track[];
  items: Record<string, TimelineItem>;
  itemIds: string[];
  viewport: Viewport;
  currentTimeMs: number;
}

const EDGE_THRESHOLD = 8; // pixels from edge to detect resize
const PLAYHEAD_THRESHOLD = 8; // pixels from playhead to detect

export class HitTester {
  /**
   * Test what was clicked at the given canvas coordinates
   */
  public hitTest(x: number, y: number, state: HitTestState): HitResult {
    const { tracks, items, itemIds, viewport, currentTimeMs } = state;

    // Check playhead first
    const playheadX = currentTimeMs * viewport.zoom - viewport.scrollX;
    if (Math.abs(x - playheadX) < PLAYHEAD_THRESHOLD) {
      return { type: 'playhead', timeMs: currentTimeMs };
    }

    // Build track position map
    const trackYMap = new Map<string, { track: Track; y: number }>();
    let trackY = -viewport.scrollY;
    for (const track of tracks) {
      trackYMap.set(track.id, { track, y: trackY });
      trackY += track.height;
    }

    // Check items (reverse order so top items are hit first)
    for (let i = itemIds.length - 1; i >= 0; i--) {
      const itemId = itemIds[i];
      const item = items[itemId];
      if (!item) continue;

      const trackInfo = trackYMap.get(item.trackId);
      if (!trackInfo) continue;

      const result = this.hitTestItem(x, y, item, trackInfo.track, trackInfo.y, viewport);
      if (result) {
        return result;
      }
    }

    // Check if we hit a track (empty area)
    for (const [trackId, { track, y: trackStartY }] of trackYMap) {
      if (y >= trackStartY && y < trackStartY + track.height) {
        const timeMs = (x + viewport.scrollX) / viewport.zoom;
        return { type: 'track', trackId, timeMs };
      }
    }

    // Empty space
    return { type: 'empty', timeMs: (x + viewport.scrollX) / viewport.zoom };
  }

  private hitTestItem(
    x: number,
    y: number,
    item: TimelineItem,
    track: Track,
    trackY: number,
    viewport: Viewport
  ): HitResult | null {
    // Calculate item bounds
    const itemX = item.startMs * viewport.zoom - viewport.scrollX;
    const itemWidth = (item.endMs - item.startMs) * viewport.zoom;
    const itemY = trackY + 4; // padding
    const itemHeight = track.height - 8;

    // Check if point is within item bounds
    if (x < itemX || x > itemX + itemWidth || y < itemY || y > itemY + itemHeight) {
      return null;
    }

    // Check which part of the item was hit
    const relativeX = x - itemX;

    if (relativeX < EDGE_THRESHOLD) {
      return { type: 'item', itemId: item.id, trackId: item.trackId, edge: 'left' };
    }

    if (relativeX > itemWidth - EDGE_THRESHOLD) {
      return { type: 'item', itemId: item.id, trackId: item.trackId, edge: 'right' };
    }

    return { type: 'item', itemId: item.id, trackId: item.trackId, edge: 'body' };
  }

  /**
   * Get all items within a selection box
   */
  public getItemsInBox(
    box: { startX: number; startY: number; endX: number; endY: number },
    state: HitTestState
  ): string[] {
    const { tracks, items, itemIds, viewport } = state;

    // Normalize box coordinates
    const boxLeft = Math.min(box.startX, box.endX);
    const boxRight = Math.max(box.startX, box.endX);
    const boxTop = Math.min(box.startY, box.endY);
    const boxBottom = Math.max(box.startY, box.endY);

    // Build track position map
    const trackYMap = new Map<string, { track: Track; y: number }>();
    let trackY = -viewport.scrollY;
    for (const track of tracks) {
      trackYMap.set(track.id, { track, y: trackY });
      trackY += track.height;
    }

    const selectedIds: string[] = [];

    for (const itemId of itemIds) {
      const item = items[itemId];
      if (!item) continue;

      const trackInfo = trackYMap.get(item.trackId);
      if (!trackInfo) continue;

      // Calculate item bounds
      const itemX = item.startMs * viewport.zoom - viewport.scrollX;
      const itemWidth = (item.endMs - item.startMs) * viewport.zoom;
      const itemY = trackInfo.y + 4;
      const itemHeight = trackInfo.track.height - 8;

      // Check if item intersects with box
      const intersects =
        itemX < boxRight &&
        itemX + itemWidth > boxLeft &&
        itemY < boxBottom &&
        itemY + itemHeight > boxTop;

      if (intersects) {
        selectedIds.push(itemId);
      }
    }

    return selectedIds;
  }

  /**
   * Determine drag type from hit result
   */
  public getDragTypeFromHit(hit: HitResult): DragType | null {
    if (hit.type === 'playhead') {
      return 'scrub';
    }

    if (hit.type === 'item') {
      switch (hit.edge) {
        case 'left':
          return 'resize-left';
        case 'right':
          return 'resize-right';
        case 'body':
          return 'move';
      }
    }

    if (hit.type === 'track' || hit.type === 'empty') {
      return 'select-box';
    }

    return null;
  }

  /**
   * Get cursor style for a hit result
   */
  public getCursorForHit(hit: HitResult): string {
    if (hit.type === 'playhead') {
      return 'ew-resize';
    }

    if (hit.type === 'item') {
      switch (hit.edge) {
        case 'left':
        case 'right':
          return 'ew-resize';
        case 'body':
          return 'grab';
      }
    }

    return 'default';
  }

  /**
   * Find track at Y position
   */
  public getTrackAtY(y: number, state: HitTestState): Track | null {
    const { tracks, viewport } = state;

    let trackY = -viewport.scrollY;
    for (const track of tracks) {
      if (y >= trackY && y < trackY + track.height) {
        return track;
      }
      trackY += track.height;
    }

    return null;
  }

  /**
   * Convert X coordinate to time in milliseconds
   */
  public xToTime(x: number, viewport: Viewport): number {
    return (x + viewport.scrollX) / viewport.zoom;
  }

  /**
   * Convert time in milliseconds to X coordinate
   */
  public timeToX(timeMs: number, viewport: Viewport): number {
    return timeMs * viewport.zoom - viewport.scrollX;
  }
}
