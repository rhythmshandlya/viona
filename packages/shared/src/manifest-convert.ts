import type { Manifest, ManifestTrack, ManifestItem, ManifestLayout, ManifestCaptionStyle, ManifestVideoSettings } from './manifest.js';
import { manifestSchema } from './manifest.js';

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

/**
 * Generate a manifest from DB state. Used on workspace spin-up.
 */
export function dbToManifest(input: DbToManifestInput): Manifest {
  const { project, tracks, items } = input;

  const videoSettings = (project.videoSettings || {}) as Record<string, unknown>;
  const layoutSettings = (videoSettings.layoutSettings || {}) as Record<string, unknown>;

  const manifestTracks: ManifestTrack[] = tracks.map(t => ({
    id: t.id,
    type: t.type as ManifestTrack['type'],
    name: t.name,
    position: t.position,
  }));

  const manifestItems: ManifestItem[] = items.map(item => {
    const data = item.data || {};

    // DB uses 'subtitle' but manifest uses 'caption' — map between them
    const itemType = item.type === 'subtitle' ? 'caption' : item.type;

    // Map existing DB item data to manifest format
    if (itemType === 'visual') {
      return {
        id: item.id,
        type: 'visual' as const,
        trackId: item.trackId,
        startMs: item.startMs,
        endMs: item.endMs,
        data: {
          sceneFile: `scenes/Scene${(data as any).sourceSceneId || 1}.tsx`,
          displayMode: ((data as any).displayMode || 'default') as 'default' | 'fullscreen' | 'overlay',
          frameOffset: 0,
          transition: (data as any).transition,
          overlayZone: (data as any).overlayZone,
          speakerBbox: (data as any).speakerBbox,
        },
      };
    }

    if (itemType === 'video') {
      return {
        id: item.id,
        type: 'video' as const,
        trackId: item.trackId,
        startMs: item.startMs,
        endMs: item.endMs,
        data: {
          src: (data as any).src || 'source.mp4',
          crop: {
            x: (videoSettings.cropX as number) ?? 50,
            y: (videoSettings.cropY as number) ?? 50,
            scale: (videoSettings.scale as number) ?? 1,
          },
          volume: (data as any).volume ?? 1,
          playbackRate: (data as any).playbackRate ?? 1,
        },
      };
    }

    if (itemType === 'audio') {
      return {
        id: item.id,
        type: 'audio' as const,
        trackId: item.trackId,
        startMs: item.startMs,
        endMs: item.endMs,
        data: {
          src: (data as any).src || 'source.mp4',
          volume: (data as any).volume ?? 1,
          enhancedSrc: (data as any).enhancedSrc || null,
        },
      };
    }

    if (itemType === 'caption') {
      return {
        id: item.id,
        type: 'caption' as const,
        trackId: item.trackId,
        startMs: item.startMs,
        endMs: item.endMs,
        data: {
          words: ((data as any).words || []).map((w: any) => ({
            text: w.text,
            startMs: w.startMs,
            endMs: w.endMs,
            classification: w.classification,
            styleOverrides: w.styleOverrides,
          })),
        },
      };
    }

    // For broll, text, image — pass data through as-is
    return {
      id: item.id,
      type: itemType as ManifestItem['type'],
      trackId: item.trackId,
      startMs: item.startMs,
      endMs: item.endMs,
      data: data as any,
    };
  });

  const raw = {
    version: 1 as const,
    fps: project.fps || 30,
    durationMs: project.durationMs || 0,
    canvas: {
      width: input.canvasWidth || (videoSettings.canvasWidth as number) || 1080,
      height: input.canvasHeight || (videoSettings.canvasHeight as number) || 1920,
    },
    tracks: manifestTracks,
    items: manifestItems,
    layout: {
      mode: (layoutSettings.mode as string) || 'stacked',
      split: (layoutSettings.split as any) || { position: 'visuals-first', ratio: 50, gap: 0 },
      pip: (layoutSettings.pip as any) || { position: 'bottom-right', size: 25, shape: 'circle' },
    },
    captionStyle: (videoSettings.captionStyle as any) || {},
    videoSettings: {
      cropX: (videoSettings.cropX as number) ?? 50,
      cropY: (videoSettings.cropY as number) ?? 50,
      scale: (videoSettings.scale as number) ?? 1,
      sourceWidth: project.sourceWidth || 1920,
      sourceHeight: project.sourceHeight || 1080,
    },
  };

  return manifestSchema.parse(raw);
}

/**
 * Extract DB-compatible data from a manifest. Used on workspace teardown/checkpoint.
 */
export function manifestToDb(manifest: Manifest): {
  tracks: Omit<DbTrack, 'locked' | 'visible'>[];
  items: DbTimelineItem[];
  videoSettings: Record<string, unknown>;
} {
  const tracks = manifest.tracks.map(t => ({
    id: t.id,
    type: t.type,
    name: t.name,
    position: t.position,
  }));

  const items: DbTimelineItem[] = manifest.items.map(item => {
    const data: Record<string, unknown> = { ...(item.data as any) };

    // Manifest uses 'caption' but DB uses 'subtitle' — map back
    const dbType = item.type === 'caption' ? 'subtitle' : item.type;

    // Convert visual sceneFile back to sourceSceneId
    if (item.type === 'visual') {
      const match = (data.sceneFile as string)?.match(/Scene(\d+)\.tsx$/);
      if (match) {
        data.sourceSceneId = parseInt(match[1], 10);
      }
      delete data.sceneFile;
      // Preserve frameOffset — needed for split scenes to know where in the scene to start
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

  const videoSettings: Record<string, unknown> = {
    canvasWidth: manifest.canvas.width,
    canvasHeight: manifest.canvas.height,
    cropX: manifest.videoSettings.cropX,
    cropY: manifest.videoSettings.cropY,
    scale: manifest.videoSettings.scale,
    layoutSettings: manifest.layout,
    captionStyle: manifest.captionStyle,
  };

  return { tracks, items, videoSettings };
}
