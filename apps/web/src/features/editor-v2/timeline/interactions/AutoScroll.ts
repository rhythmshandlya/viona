/**
 * AutoScroll
 * Keeps the playhead visible during playback by auto-scrolling the timeline
 */

import { Viewport } from '../../store/types';

export class AutoScroll {
  private lastScrollTimeMs: number = 0;
  private scrollCooldownMs: number = 100; // Prevent too-frequent scrolls

  /**
   * Check if playhead is visible and scroll if needed.
   * Call this on each frame during playback.
   */
  update(
    currentTimeMs: number,
    isPlaying: boolean,
    viewport: Viewport,
    canvasWidth: number,
    setScrollX: (x: number) => void
  ): void {
    if (!isPlaying) return;
    if (canvasWidth <= 0) return;

    const playheadX = currentTimeMs * viewport.zoom - viewport.scrollX;

    // If playhead is beyond 80% of visible width, scroll to put it at 30%
    if (playheadX > canvasWidth * 0.8) {
      const targetScrollX = currentTimeMs * viewport.zoom - canvasWidth * 0.3;
      setScrollX(Math.max(0, targetScrollX));
    }

    // If playhead is before 10% of visible width (and we can scroll back), scroll
    if (playheadX < canvasWidth * 0.1 && viewport.scrollX > 0) {
      const targetScrollX = currentTimeMs * viewport.zoom - canvasWidth * 0.3;
      setScrollX(Math.max(0, targetScrollX));
    }
  }

  /**
   * Reset scroll tracking (call when playback stops)
   */
  reset(): void {
    this.lastScrollTimeMs = 0;
  }
}

// Singleton
let autoScrollInstance: AutoScroll | null = null;

export function getAutoScroll(): AutoScroll {
  if (!autoScrollInstance) {
    autoScrollInstance = new AutoScroll();
  }
  return autoScrollInstance;
}
