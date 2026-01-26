/**
 * Snap Engine
 * Handles snapping timeline items to other items, playhead, and markers
 */

import { TimelineItem, Viewport, SnapTarget } from '../../store/types';

export interface SnapResult {
  snapped: boolean;
  position: number;      // The snapped position in ms
  target: SnapTarget | null;
  delta: number;         // How much we moved to snap
}

export interface SnapEngineOptions {
  /** Snap threshold in pixels */
  threshold: number;
  /** Enable snapping to playhead */
  snapToPlayhead: boolean;
  /** Enable snapping to item edges */
  snapToItems: boolean;
  /** Enable snapping to grid (if implemented) */
  snapToGrid: boolean;
  /** Grid interval in ms (if snapToGrid is true) */
  gridInterval: number;
}

const DEFAULT_OPTIONS: SnapEngineOptions = {
  threshold: 10,
  snapToPlayhead: true,
  snapToItems: true,
  snapToGrid: false,
  gridInterval: 1000,
};

export class SnapEngine {
  private options: SnapEngineOptions;

  constructor(options?: Partial<SnapEngineOptions>) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Update snap options
   */
  public setOptions(options: Partial<SnapEngineOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * Get all potential snap targets from current state
   */
  public getSnapTargets(
    items: Record<string, TimelineItem>,
    itemIds: string[],
    currentTimeMs: number,
    excludeItemIds: string[] = []
  ): SnapTarget[] {
    const targets: SnapTarget[] = [];

    // Add playhead as snap target
    if (this.options.snapToPlayhead) {
      targets.push({
        position: currentTimeMs,
        type: 'playhead',
      });
    }

    // Add item edges as snap targets
    if (this.options.snapToItems) {
      for (const itemId of itemIds) {
        if (excludeItemIds.includes(itemId)) continue;

        const item = items[itemId];
        if (!item) continue;

        // Start edge
        targets.push({
          position: item.startMs,
          type: 'item-start',
          itemId,
        });

        // End edge
        targets.push({
          position: item.endMs,
          type: 'item-end',
          itemId,
        });
      }
    }

    // Add grid points if enabled
    if (this.options.snapToGrid && this.options.gridInterval > 0) {
      // We'd need to know the visible range to add grid points
      // For now, skip grid snapping
    }

    return targets;
  }

  /**
   * Find the nearest snap target for a given position
   */
  public findSnapTarget(
    positionMs: number,
    targets: SnapTarget[],
    viewport: Viewport
  ): SnapResult {
    // Convert threshold from pixels to milliseconds
    const thresholdMs = this.options.threshold / viewport.zoom;

    let nearestTarget: SnapTarget | null = null;
    let nearestDistance = Infinity;

    for (const target of targets) {
      const distance = Math.abs(target.position - positionMs);
      if (distance < nearestDistance && distance <= thresholdMs) {
        nearestDistance = distance;
        nearestTarget = target;
      }
    }

    if (nearestTarget) {
      return {
        snapped: true,
        position: nearestTarget.position,
        target: nearestTarget,
        delta: nearestTarget.position - positionMs,
      };
    }

    return {
      snapped: false,
      position: positionMs,
      target: null,
      delta: 0,
    };
  }

  /**
   * Snap item start position (when moving)
   */
  public snapItemStart(
    startMs: number,
    endMs: number,
    targets: SnapTarget[],
    viewport: Viewport
  ): { startMs: number; endMs: number; snapResult: SnapResult } {
    const duration = endMs - startMs;

    // Try snapping the start edge
    const startSnap = this.findSnapTarget(startMs, targets, viewport);
    if (startSnap.snapped) {
      return {
        startMs: startSnap.position,
        endMs: startSnap.position + duration,
        snapResult: startSnap,
      };
    }

    // Try snapping the end edge
    const endSnap = this.findSnapTarget(endMs, targets, viewport);
    if (endSnap.snapped) {
      return {
        startMs: endSnap.position - duration,
        endMs: endSnap.position,
        snapResult: endSnap,
      };
    }

    return {
      startMs,
      endMs,
      snapResult: { snapped: false, position: startMs, target: null, delta: 0 },
    };
  }

  /**
   * Snap item left edge (when resizing left)
   */
  public snapLeftEdge(
    startMs: number,
    targets: SnapTarget[],
    viewport: Viewport
  ): SnapResult {
    return this.findSnapTarget(startMs, targets, viewport);
  }

  /**
   * Snap item right edge (when resizing right)
   */
  public snapRightEdge(
    endMs: number,
    targets: SnapTarget[],
    viewport: Viewport
  ): SnapResult {
    return this.findSnapTarget(endMs, targets, viewport);
  }

  /**
   * Get snap lines for rendering (positions that should show snap indicators)
   */
  public getActiveSnapLines(
    snapResult: SnapResult,
    viewport: Viewport
  ): { x: number; type: SnapTarget['type'] }[] {
    if (!snapResult.snapped || !snapResult.target) {
      return [];
    }

    const x = snapResult.target.position * viewport.zoom - viewport.scrollX;
    return [{ x, type: snapResult.target.type }];
  }
}

/**
 * Singleton instance for easy access
 */
let snapEngineInstance: SnapEngine | null = null;

export function getSnapEngine(options?: Partial<SnapEngineOptions>): SnapEngine {
  if (!snapEngineInstance) {
    snapEngineInstance = new SnapEngine(options);
  } else if (options) {
    snapEngineInstance.setOptions(options);
  }
  return snapEngineInstance;
}
