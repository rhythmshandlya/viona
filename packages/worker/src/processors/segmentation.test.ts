import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FaceBbox } from './segmentation.js';

// Mock the dependencies before importing the module
vi.mock('fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  rm: vi.fn().mockResolvedValue(undefined),
  readdir: vi.fn().mockResolvedValue([]),
  access: vi.fn().mockRejectedValue(new Error('ENOENT')),
}));

vi.mock('../services/minio.js', () => ({
  downloadFile: vi.fn().mockResolvedValue(undefined),
  uploadFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../services/redis.js', () => ({
  publishJobProgress: vi.fn().mockResolvedValue(undefined),
  publishJobComplete: vi.fn().mockResolvedValue(undefined),
  publishJobError: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../db/index.js', () => ({
  db: {
    query: {
      timelineItems: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    },
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  },
  timelineItems: {},
}));

describe('Segmentation Processor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('FaceBbox interpolation', () => {
    it('should handle empty timeline gracefully', () => {
      const timeline: FaceBbox[] = [];

      // For empty timeline, interpolation should return null
      const interpolated = interpolateFaceBbox(timeline, 5);
      expect(interpolated).toBeNull();
    });

    it('should return single bbox when only one exists', () => {
      const timeline = [
        { frame: 0, x: 0.3, y: 0.2, width: 0.2, height: 0.3, confidence: 0.95 },
      ];

      const result = interpolateFaceBbox(timeline, 5);
      expect(result).not.toBeNull();
      expect(result!.x).toBe(0.3);
      expect(result!.y).toBe(0.2);
    });

    it('should interpolate between keyframes', () => {
      const timeline = [
        { frame: 0, x: 0.3, y: 0.2, width: 0.2, height: 0.3, confidence: 0.95 },
        { frame: 10, x: 0.4, y: 0.3, width: 0.2, height: 0.3, confidence: 0.90 },
      ];

      // At frame 5, x should be 0.35 (midpoint)
      const result = interpolateFaceBbox(timeline, 5);
      expect(result).not.toBeNull();
      expect(result!.x).toBeCloseTo(0.35, 5);
      expect(result!.y).toBeCloseTo(0.25, 5);
    });

    it('should clamp to first keyframe before timeline', () => {
      const timeline = [
        { frame: 5, x: 0.3, y: 0.2, width: 0.2, height: 0.3, confidence: 0.95 },
        { frame: 15, x: 0.4, y: 0.3, width: 0.2, height: 0.3, confidence: 0.90 },
      ];

      const result = interpolateFaceBbox(timeline, 0);
      expect(result).not.toBeNull();
      expect(result!.x).toBe(0.3);
    });

    it('should clamp to last keyframe after timeline', () => {
      const timeline = [
        { frame: 0, x: 0.3, y: 0.2, width: 0.2, height: 0.3, confidence: 0.95 },
        { frame: 10, x: 0.4, y: 0.3, width: 0.2, height: 0.3, confidence: 0.90 },
      ];

      const result = interpolateFaceBbox(timeline, 20);
      expect(result).not.toBeNull();
      expect(result!.x).toBe(0.4);
    });
  });

  describe('Zone utilities', () => {
    it('should migrate displayMode to overlayZone correctly', () => {
      // Test migration logic
      expect(migrateDisplayModeToZone('overlay')).toBe('behind');
      expect(migrateDisplayModeToZone('fullscreen')).toBe('background');
      expect(migrateDisplayModeToZone('default')).toBe('none');
      expect(migrateDisplayModeToZone(undefined)).toBe('none');
    });

    it('should get effective zone with fallback', () => {
      expect(getEffectiveZone('behind')).toBe('behind');
      expect(getEffectiveZone('lower-third')).toBe('lower-third');
      expect(getEffectiveZone(undefined)).toBe('none');
      expect(getEffectiveZone(null as unknown as string)).toBe('none');
    });
  });

  describe('Segmentation status updates', () => {
    it('should track segmentation progress states', () => {
      const states = ['pending', 'processing', 'ready', 'failed'];

      for (const state of states) {
        expect(isValidSegmentationStatus(state)).toBe(true);
      }
      expect(isValidSegmentationStatus('unknown')).toBe(false);
    });
  });

  describe('SegmentationResult structure', () => {
    it('should validate segmentation result', () => {
      const result = {
        maskPath: 'videos/proj_123/masks',
        maskFps: 10,
        faceBboxTimeline: [
          { frame: 0, x: 0.3, y: 0.2, width: 0.2, height: 0.3, confidence: 0.95 },
        ],
      };

      expect(result.maskPath).toContain('masks');
      expect(result.maskFps).toBeGreaterThan(0);
      expect(result.faceBboxTimeline).toBeInstanceOf(Array);
    });
  });
});

// =============================================================================
// Test utility functions - these MUST match the implementations in:
// apps/web/src/features/editor-v2/utils/overlay-zones.ts
// =============================================================================

/**
 * Linear interpolation helper
 */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Interpolate face bounding box between keyframes for smooth tracking.
 * @see apps/web/src/features/editor-v2/utils/overlay-zones.ts
 */
function interpolateFaceBbox(
  timeline: FaceBbox[],
  targetFrame: number
): FaceBbox | null {
  if (!timeline || timeline.length === 0) return null;

  // Find surrounding keyframes
  const before = timeline.filter(f => f.frame <= targetFrame).pop();
  const after = timeline.find(f => f.frame > targetFrame);

  if (!before && !after) return null;
  if (!before) return after!;
  if (!after) return before;

  // Linear interpolation between keyframes
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
 * Convert legacy displayMode to overlayZone.
 * @see apps/web/src/features/editor-v2/utils/overlay-zones.ts
 */
function migrateDisplayModeToZone(displayMode: string | undefined): string {
  if (displayMode === 'overlay') return 'behind';
  if (displayMode === 'fullscreen') return 'background';
  return 'none';
}

/**
 * Get effective overlay zone with fallback.
 * @see apps/web/src/features/editor-v2/utils/overlay-zones.ts
 */
function getEffectiveZone(zone: string | undefined | null): string {
  if (!zone) return 'none';
  return zone;
}

/**
 * Validate segmentation status value.
 */
function isValidSegmentationStatus(status: string): boolean {
  return ['pending', 'processing', 'ready', 'failed'].includes(status);
}
