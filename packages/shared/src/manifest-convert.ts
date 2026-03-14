import type { ManifestV2, ManifestItemV2, ManifestTrackV2, TransformV2 } from './manifest-v2.js';
import { manifestV2Schema } from './manifest-v2.js';

/**
 * Data structures matching what the DB returns.
 * These mirror the Drizzle schema shapes without importing Drizzle.
 */
export interface DbTrack {
  id: string;
  type: string;
  name: string;
  position: number;
  locked: boolean;
  visible: boolean;
}

export interface DbTimelineItem {
  id: string;
  trackId: string;
  type: string;
  startMs: number;
  endMs: number;
  data: Record<string, unknown>;
}

export interface DbProject {
  fps: number;
  durationMs: number;
  sourceWidth: number;
  sourceHeight: number;
  videoSettings: Record<string, unknown> | null;
}

export interface DbToManifestInput {
  project: DbProject;
  tracks: DbTrack[];
  items: DbTimelineItem[];
  canvasWidth?: number;
  canvasHeight?: number;
}

// ---- Transform helpers ----

const FULLSCREEN_TRANSFORM: TransformV2 = {
  x: 0,
  y: 0,
  width: '100%',
  height: '100%',
  rotation: 0,
  opacity: 1,
};

/** Map DB track type → v2 manifest track type */
function mapDbTrackType(dbType: string): ManifestTrackV2['type'] {
  switch (dbType) {
    case 'subtitle':
      return 'caption';
    case 'visual':
    case 'text':
    case 'image':
      return 'overlay';
    case 'broll':
      return 'video';
    case 'video':
    case 'audio':
    case 'caption':
      return dbType;
    default:
      return 'overlay';
  }
}

/**
 * Generate a v2 manifest from DB state. Used on workspace spin-up.
 */
export function dbToManifest(input: DbToManifestInput): ManifestV2 {
  const { project, tracks, items } = input;

  const videoSettings = (project.videoSettings || {}) as Record<string, unknown>;

  const manifestTracks: ManifestTrackV2[] = tracks.map(t => ({
    id: t.id,
    type: mapDbTrackType(t.type),
    name: t.name,
    position: t.position,
  }));

  const manifestItems: ManifestItemV2[] = items.map(item => {
    const data = item.data || {};

    // Normalize DB type: subtitle → caption in DB convention
    const dbType = item.type === 'subtitle' ? 'caption' : item.type;

    // --- VIDEO items ---
    if (dbType === 'video') {
      const videoEndMs = (item.endMs <= item.startMs && project.durationMs > 0)
        ? project.durationMs
        : item.endMs;

      const storedTransform = ((data as any)._transform || (data as any).transform) as TransformV2 | undefined;
      const storedKeyframes = ((data as any)._keyframes || (data as any).keyframes) as any[] | undefined;
      const storedFilters = ((data as any)._filters || (data as any).filters) as Record<string, unknown> | undefined;

      const transform: TransformV2 = storedTransform || { ...FULLSCREEN_TRANSFORM };

      // Per-item crop from data, fallback to global videoSettings
      let crop: { x: number; y: number; scale: number } | undefined;
      const itemCropX = (data.crop as any)?.x ?? (videoSettings.cropX as number) ?? 50;
      const itemCropY = (data.crop as any)?.y ?? (videoSettings.cropY as number) ?? 50;
      const itemScale = (data.crop as any)?.scale ?? (videoSettings.scale as number) ?? 1;
      if (itemCropX !== 50 || itemCropY !== 50 || itemScale !== 1) {
        crop = { x: itemCropX, y: itemCropY, scale: itemScale };
      }

      return {
        id: item.id,
        type: 'video' as const,
        trackId: item.trackId,
        startMs: item.startMs,
        endMs: videoEndMs,
        transform,
        keyframes: storedKeyframes || [],
        ...(storedFilters ? { filters: storedFilters } : {}),
        data: {
          src: (data as any).src || 'source.mp4',
          startFrom: (data as any).startFrom ?? 0,
          volume: (data as any).volume ?? 1,
          playbackRate: (data as any).playbackRate ?? 1,
          ...(crop ? { crop } : {}),
        },
      };
    }

    // --- AUDIO items ---
    if (dbType === 'audio') {
      const audioEndMs = (item.endMs <= item.startMs && project.durationMs > 0)
        ? project.durationMs
        : item.endMs;
      // Prefer enhancedSrc over src
      const src = (data as any).enhancedSrc || (data as any).src || 'source.mp4';

      return {
        id: item.id,
        type: 'audio' as const,
        trackId: item.trackId,
        startMs: item.startMs,
        endMs: audioEndMs,
        // No transform on audio items
        keyframes: [],
        data: {
          src,
          volume: (data as any).volume ?? 1,
          playbackRate: 1,
        },
      };
    }

    // --- VISUAL items → scene type ---
    if (dbType === 'visual') {
      const storedTransform = ((data as any)._transform || (data as any).transform) as TransformV2 | undefined;
      const storedKeyframes = ((data as any)._keyframes || (data as any).keyframes) as any[] | undefined;
      const storedFilters = ((data as any)._filters || (data as any).filters) as Record<string, unknown> | undefined;

      const transform: TransformV2 = storedTransform || { ...FULLSCREEN_TRANSFORM };

      return {
        id: item.id,
        type: 'scene' as const,
        trackId: item.trackId,
        startMs: item.startMs,
        endMs: item.endMs,
        transform,
        keyframes: storedKeyframes || [],
        ...(storedFilters ? { filters: storedFilters } : {}),
        data: {
          sceneFile: (data as any).sceneFile || `scenes/Scene${(data as any).sourceSceneId || 1}.tsx`,
        },
      };
    }

    // --- BROLL items → video type ---
    if (dbType === 'broll') {
      const src = (data as any).src || (data as any).previewUrl || (data as any).filename || '';
      const storedTransform = ((data as any)._transform || (data as any).transform) as TransformV2 | undefined;
      const storedKeyframes = ((data as any)._keyframes || (data as any).keyframes) as any[] | undefined;
      const storedFilters = ((data as any)._filters || (data as any).filters) as Record<string, unknown> | undefined;

      return {
        id: item.id,
        type: 'video' as const,
        trackId: item.trackId,
        startMs: item.startMs,
        endMs: item.endMs,
        transform: storedTransform || { ...FULLSCREEN_TRANSFORM },
        keyframes: storedKeyframes || [],
        ...(storedFilters ? { filters: storedFilters } : {}),
        data: {
          src,
          startFrom: (data as any).startFrom ?? 0,
          volume: (data as any).volume ?? 1,
          playbackRate: 1,
        },
      };
    }

    // --- CAPTION items ---
    if (dbType === 'caption') {
      const rawWords: any[] = (data as any).words || [];

      // Detect and fix corrupted word timestamps (same logic as v1)
      let words = rawWords;
      if (rawWords.length > 0 && item.endMs > item.startMs) {
        const first = rawWords[0];
        const itemRange = item.endMs - item.startMs;
        if (first.startMs > item.endMs + itemRange) {
          const corrected = Math.round(first.startMs / 10);
          if (corrected >= item.startMs - itemRange && corrected <= item.endMs + itemRange) {
            words = rawWords.map((w: any) => ({
              ...w,
              startMs: Math.round(w.startMs / 10),
              endMs: Math.round(w.endMs / 10),
            }));
          }
        }
      }

      return {
        id: item.id,
        type: 'caption' as const,
        trackId: item.trackId,
        startMs: item.startMs,
        endMs: item.endMs,
        keyframes: [],
        data: {
          words: words.map((w: any) => ({
            text: w.text,
            startMs: w.startMs,
            endMs: w.endMs,
            classification: w.classification,
            styleOverrides: w.styleOverrides,
          })),
        },
      };
    }

    // --- TEXT items ---
    if (dbType === 'text') {
      const style = (data as any).style ?? {};
      const storedTransform = ((data as any)._transform || (data as any).transform) as TransformV2 | undefined;
      const storedKeyframes = ((data as any)._keyframes || (data as any).keyframes) as any[] | undefined;
      const storedFilters = ((data as any)._filters || (data as any).filters) as Record<string, unknown> | undefined;

      const defaultTransform: TransformV2 = {
        x: (data as any).position?.x ?? 0,
        y: (data as any).position?.y ?? 0,
        width: (data as any).size?.width != null ? `${(data as any).size.width}%` : '100%',
        height: (data as any).size?.height != null ? `${(data as any).size.height}%` : '100%',
        rotation: 0,
        opacity: 1,
      };

      const transform: TransformV2 = storedTransform || defaultTransform;

      return {
        id: item.id,
        type: 'text' as const,
        trackId: item.trackId,
        startMs: item.startMs,
        endMs: item.endMs,
        transform,
        keyframes: storedKeyframes || [],
        ...(storedFilters ? { filters: storedFilters } : {}),
        data: {
          text: (data as any).text || '',
          fontFamily: (style.fontFamily as string) ?? 'Inter',
          fontSize: (style.fontSize as number) ?? 48,
          fontWeight: (style.fontWeight as number) ?? 600,
          color: (style.color as string) ?? '#FFFFFF',
          textAlign: ((style.textAlign as string) ?? 'center') as 'left' | 'center' | 'right',
          textTransform: ((style.textTransform as string) ?? 'none') as 'none' | 'uppercase' | 'lowercase',
        },
      };
    }

    // --- IMAGE items ---
    if (dbType === 'image') {
      const storedTransform = ((data as any)._transform || (data as any).transform) as TransformV2 | undefined;
      const storedKeyframes = ((data as any)._keyframes || (data as any).keyframes) as any[] | undefined;
      const storedFilters = ((data as any)._filters || (data as any).filters) as Record<string, unknown> | undefined;

      const defaultTransform: TransformV2 = {
        x: (data as any).position?.x ?? 0,
        y: (data as any).position?.y ?? 0,
        width: (data as any).width != null ? `${(data as any).width}%` : '100%',
        height: (data as any).height != null ? `${(data as any).height}%` : '100%',
        rotation: 0,
        opacity: (data as any).opacity ?? 1,
      };

      const transform: TransformV2 = storedTransform || defaultTransform;

      return {
        id: item.id,
        type: 'image' as const,
        trackId: item.trackId,
        startMs: item.startMs,
        endMs: item.endMs,
        transform,
        keyframes: storedKeyframes || [],
        ...(storedFilters ? { filters: storedFilters } : {}),
        data: {
          src: (data as any).src || '',
        },
      };
    }

    // Fallback: treat unknown types as scene on overlay track
    const storedTransformFallback = ((data as any)._transform || (data as any).transform) as TransformV2 | undefined;
    const storedKeyframesFallback = ((data as any)._keyframes || (data as any).keyframes) as any[] | undefined;
    const storedFiltersFallback = ((data as any)._filters || (data as any).filters) as Record<string, unknown> | undefined;

    return {
      id: item.id,
      type: 'scene' as const,
      trackId: item.trackId,
      startMs: item.startMs,
      endMs: item.endMs,
      transform: storedTransformFallback || { ...FULLSCREEN_TRANSFORM },
      keyframes: storedKeyframesFallback || [],
      ...(storedFiltersFallback ? { filters: storedFiltersFallback } : {}),
      data: { sceneFile: '' },
    };
  });

  const raw = {
    version: 2 as const,
    fps: project.fps || 30,
    durationMs: project.durationMs || 0,
    canvas: {
      width: input.canvasWidth || (videoSettings.canvasWidth as number) || 1080,
      height: input.canvasHeight || (videoSettings.canvasHeight as number) || 1920,
    },
    tracks: manifestTracks,
    items: manifestItems,
    assets: {},
    captionStyle: (videoSettings.captionStyle as any) || {},
    videoSettings: {
      sourceWidth: project.sourceWidth || 1920,
      sourceHeight: project.sourceHeight || 1080,
    },
  };

  return manifestV2Schema.parse(raw);
}

/**
 * Extract DB-compatible data from a v2 manifest. Used on workspace teardown/checkpoint.
 */
export function manifestToDb(manifest: ManifestV2): {
  tracks: Omit<DbTrack, 'locked' | 'visible'>[];
  items: DbTimelineItem[];
  videoSettings: Record<string, unknown>;
} {
  const tracks = manifest.tracks.map(t => ({
    id: t.id,
    // Manifest uses 'caption' but DB uses 'subtitle' — map back
    // Manifest 'overlay' maps back to specific DB types based on items, but for tracks
    // we store the v2 type (overlay stays overlay in DB)
    type: t.type === 'caption' ? 'subtitle' : t.type,
    name: t.name,
    position: t.position,
  }));

  const items: DbTimelineItem[] = manifest.items.map(item => {
    const data: Record<string, unknown> = { ...(item.data as any) };

    // Preserve transform, keyframes, filters in data for round-trip survival
    if (item.type !== 'audio' && (item as any).transform) {
      data._transform = (item as any).transform;
    }
    if ((item as any).keyframes?.length > 0) {
      data._keyframes = (item as any).keyframes;
    }
    if ((item as any).filters) {
      data._filters = (item as any).filters;
    }

    // Map v2 item types back to DB types
    let dbType: string;
    switch (item.type) {
      case 'scene':
        dbType = 'visual';
        // sceneFile preserved as-is in data (v2 uses sceneFile directly)
        break;
      case 'caption':
        dbType = 'subtitle';
        break;
      case 'video':
      case 'audio':
      case 'text':
      case 'image':
      case 'shape':
        dbType = item.type;
        break;
      default:
        dbType = (item as any).type;
        break;
    }

    return {
      id: item.id,
      trackId: item.trackId,
      type: dbType,
      startMs: item.startMs,
      endMs: item.endMs,
      data,
    };
  });

  // Reconstruct videoSettings for DB storage
  // Get crop from first video item if available
  const firstVideoItem = manifest.items.find(i => i.type === 'video');
  const videoCrop = firstVideoItem?.data && 'crop' in firstVideoItem.data
    ? firstVideoItem.data.crop
    : undefined;

  const videoSettings: Record<string, unknown> = {
    canvasWidth: manifest.canvas.width,
    canvasHeight: manifest.canvas.height,
    cropX: videoCrop?.x ?? 50,
    cropY: videoCrop?.y ?? 50,
    scale: videoCrop?.scale ?? 1,
    sourceWidth: manifest.videoSettings.sourceWidth,
    sourceHeight: manifest.videoSettings.sourceHeight,
    captionStyle: manifest.captionStyle,
  };

  return { tracks, items, videoSettings };
}
