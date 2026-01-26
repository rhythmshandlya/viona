/**
 * Drag Manager
 * Handles drag operations with preview, snapping, and multi-item support
 */

import {
  TimelineItem,
  Track,
  Viewport,
  DragState,
  DragType,
  SnapTarget,
} from '../../store/types';
import { SnapEngine, SnapResult, getSnapEngine } from './SnapEngine';

export interface DragPreview {
  itemId: string;
  originalStartMs: number;
  originalEndMs: number;
  originalTrackId: string;
  previewStartMs: number;
  previewEndMs: number;
  previewTrackId: string;
  isValid: boolean;
}

export interface DragOperation {
  type: DragType;
  itemIds: string[];
  previews: DragPreview[];
  snapResult: SnapResult;
  isActive: boolean;
}

export interface DragManagerState {
  tracks: Track[];
  items: Record<string, TimelineItem>;
  itemIds: string[];
  selectedIds: string[];
  viewport: Viewport;
  currentTimeMs: number;
}

export class DragManager {
  private snapEngine: SnapEngine;
  private currentOperation: DragOperation | null = null;

  constructor() {
    this.snapEngine = getSnapEngine();
  }

  /**
   * Start a drag operation
   */
  public startDrag(
    dragState: DragState,
    state: DragManagerState
  ): DragOperation {
    const { type, itemId } = dragState;
    const { items, selectedIds } = state;

    // Determine which items are being dragged
    let draggedItemIds: string[] = [];

    if (itemId) {
      // If dragging a selected item, drag all selected items
      if (selectedIds.includes(itemId)) {
        draggedItemIds = [...selectedIds];
      } else {
        // Otherwise just drag this item
        draggedItemIds = [itemId];
      }
    }

    // Create initial previews
    const previews: DragPreview[] = draggedItemIds.map((id) => {
      const item = items[id];
      return {
        itemId: id,
        originalStartMs: item.startMs,
        originalEndMs: item.endMs,
        originalTrackId: item.trackId,
        previewStartMs: item.startMs,
        previewEndMs: item.endMs,
        previewTrackId: item.trackId,
        isValid: true,
      };
    });

    this.currentOperation = {
      type,
      itemIds: draggedItemIds,
      previews,
      snapResult: { snapped: false, position: 0, target: null, delta: 0 },
      isActive: true,
    };

    return this.currentOperation;
  }

  /**
   * Update drag operation based on current pointer position
   */
  public updateDrag(
    dragState: DragState,
    state: DragManagerState
  ): DragOperation | null {
    if (!this.currentOperation || !this.currentOperation.isActive) {
      return null;
    }

    const { type } = this.currentOperation;
    const { viewport, items, itemIds, currentTimeMs } = state;

    // Calculate delta in milliseconds
    const deltaX = dragState.currentX - dragState.startX;
    const deltaMs = deltaX / viewport.zoom;

    // Get snap targets (exclude items being dragged)
    const snapTargets = this.snapEngine.getSnapTargets(
      items,
      itemIds,
      currentTimeMs,
      this.currentOperation.itemIds
    );

    switch (type) {
      case 'move':
        this.updateMovePreviews(deltaMs, dragState, state, snapTargets);
        break;
      case 'resize-left':
        this.updateResizeLeftPreviews(deltaMs, state, snapTargets);
        break;
      case 'resize-right':
        this.updateResizeRightPreviews(deltaMs, state, snapTargets);
        break;
    }

    return this.currentOperation;
  }

  /**
   * Update previews for move operation
   */
  private updateMovePreviews(
    deltaMs: number,
    dragState: DragState,
    state: DragManagerState,
    snapTargets: SnapTarget[]
  ): void {
    if (!this.currentOperation) return;

    const { viewport } = state;
    const primaryPreview = this.currentOperation.previews[0];

    if (!primaryPreview) return;

    // Calculate new position for primary item
    let newStartMs = primaryPreview.originalStartMs + deltaMs;
    let newEndMs = primaryPreview.originalEndMs + deltaMs;

    // Apply snapping to primary item
    const snapResult = this.snapEngine.snapItemStart(
      newStartMs,
      newEndMs,
      snapTargets,
      viewport
    );

    newStartMs = snapResult.startMs;
    newEndMs = snapResult.endMs;
    this.currentOperation.snapResult = snapResult.snapResult;

    // Determine target track based on Y position
    const targetTrack = this.getTrackAtY(dragState.currentY, state);
    const targetTrackId = targetTrack?.id || primaryPreview.originalTrackId;

    // Update all previews with the same delta
    const adjustedDeltaMs = newStartMs - primaryPreview.originalStartMs;

    for (const preview of this.currentOperation.previews) {
      preview.previewStartMs = Math.max(0, preview.originalStartMs + adjustedDeltaMs);
      preview.previewEndMs = preview.originalEndMs + adjustedDeltaMs;
      preview.previewTrackId = targetTrackId;

      // Validate the preview
      preview.isValid = this.validatePreview(preview, state);
    }
  }

  /**
   * Update previews for resize-left operation
   */
  private updateResizeLeftPreviews(
    deltaMs: number,
    state: DragManagerState,
    snapTargets: SnapTarget[]
  ): void {
    if (!this.currentOperation) return;

    const { viewport } = state;

    for (const preview of this.currentOperation.previews) {
      let newStartMs = preview.originalStartMs + deltaMs;

      // Apply snapping
      const snapResult = this.snapEngine.snapLeftEdge(newStartMs, snapTargets, viewport);
      if (snapResult.snapped) {
        newStartMs = snapResult.position;
        this.currentOperation.snapResult = snapResult;
      }

      // Ensure minimum duration (100ms)
      const minStart = preview.originalEndMs - 100;
      newStartMs = Math.min(newStartMs, minStart);
      newStartMs = Math.max(0, newStartMs);

      preview.previewStartMs = newStartMs;
      preview.previewEndMs = preview.originalEndMs;
      preview.isValid = true;
    }
  }

  /**
   * Update previews for resize-right operation
   */
  private updateResizeRightPreviews(
    deltaMs: number,
    state: DragManagerState,
    snapTargets: SnapTarget[]
  ): void {
    if (!this.currentOperation) return;

    const { viewport } = state;

    for (const preview of this.currentOperation.previews) {
      let newEndMs = preview.originalEndMs + deltaMs;

      // Apply snapping
      const snapResult = this.snapEngine.snapRightEdge(newEndMs, snapTargets, viewport);
      if (snapResult.snapped) {
        newEndMs = snapResult.position;
        this.currentOperation.snapResult = snapResult;
      }

      // Ensure minimum duration (100ms)
      const minEnd = preview.originalStartMs + 100;
      newEndMs = Math.max(newEndMs, minEnd);

      preview.previewStartMs = preview.originalStartMs;
      preview.previewEndMs = newEndMs;
      preview.isValid = true;
    }
  }

  /**
   * End drag operation and return final positions
   */
  public endDrag(): DragOperation | null {
    const operation = this.currentOperation;
    if (operation) {
      operation.isActive = false;
    }
    this.currentOperation = null;
    return operation;
  }

  /**
   * Cancel drag operation
   */
  public cancelDrag(): void {
    this.currentOperation = null;
  }

  /**
   * Get current drag operation
   */
  public getCurrentOperation(): DragOperation | null {
    return this.currentOperation;
  }

  /**
   * Check if a drag is currently active
   */
  public isDragging(): boolean {
    return this.currentOperation?.isActive ?? false;
  }

  /**
   * Get track at Y position
   */
  private getTrackAtY(y: number, state: DragManagerState): Track | null {
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
   * Validate a preview (check for overlaps, track compatibility, etc.)
   */
  private validatePreview(preview: DragPreview, state: DragManagerState): boolean {
    const { tracks } = state;

    // Check if target track exists
    const targetTrack = tracks.find((t) => t.id === preview.previewTrackId);
    if (!targetTrack) return false;

    // Check if track is locked
    if (targetTrack.locked) return false;

    // Check for overlaps with other items on the same track
    // (Skip for now - could be implemented for stricter validation)

    return true;
  }
}

/**
 * Singleton instance
 */
let dragManagerInstance: DragManager | null = null;

export function getDragManager(): DragManager {
  if (!dragManagerInstance) {
    dragManagerInstance = new DragManager();
  }
  return dragManagerInstance;
}
