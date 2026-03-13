import type { FaceBbox, OverlayZone, VisualDisplayMode } from '../store/types';

/**
 * Linear interpolation helper
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Interpolate face bounding box between keyframes for smooth tracking
 */
export function interpolateFaceBbox(
  timeline: FaceBbox[],
  targetFrame: number
): FaceBbox | null {
  if (!timeline || timeline.length === 0) return null;

  const before = timeline.filter(f => f.frame <= targetFrame).pop();
  const after = timeline.find(f => f.frame > targetFrame);

  if (!before && !after) return null;
  if (!before) return after!;
  if (!after) return before;

  const t = (targetFrame - before.frame) / (after.frame - before.frame);
  return {
    frame: targetFrame,
    x: lerp(before.x, after.x, t),
    y: lerp(before.y, after.y, t),
    width: lerp(before.width, after.width, t),
    height: lerp(before.height, after.height, t),
    confidence: lerp(before.confidence, after.confidence, t),
  };
}

/**
 * Convert legacy displayMode to overlayZone
 */
export function migrateDisplayModeToZone(
  displayMode: VisualDisplayMode | undefined
): OverlayZone {
  if (displayMode === 'overlay') return 'behind';
  if (displayMode === 'fullscreen') return 'background';
  return 'none';
}

/**
 * Get effective overlay zone (handles migration from displayMode)
 */
export function getEffectiveZone(
  overlayZone: OverlayZone | undefined,
  displayMode: VisualDisplayMode | undefined
): OverlayZone {
  if (overlayZone) return overlayZone;
  return migrateDisplayModeToZone(displayMode);
}

/**
 * Zone z-index mapping for correct layer ordering
 */
export const ZONE_Z_INDEX: Record<OverlayZone, number> = {
  'background': 0,
  'behind': 1,
  'frame': 3,
  'lower-third': 4,
  'top': 5,
  'none': 0,
};

/**
 * Zone dimension constraints (percentage of canvas)
 */
export const ZONE_DIMENSIONS: Record<OverlayZone, { top?: string; bottom?: string; height?: string }> = {
  'background': {},
  'behind': {},
  'frame': {},
  'lower-third': { bottom: '0', height: '20%' },
  'top': { top: '0', height: '15%' },
  'none': {},
};
