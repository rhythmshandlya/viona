/**
 * Manifest-Store Bridge
 *
 * Converts between @viona/shared Manifest format and the Zustand editor store format.
 * Used when loading workspace state from the API or applying remote manifest updates.
 */

import type {
  Manifest,
  ManifestItem,
  ManifestCaptionStyle,
  ManifestLayout,
} from '@viona/shared/manifest';

import type {
  Track,
  TimelineItem,
  VideoSettings,
  LayoutSettings,
  LayoutPresetId,
  CaptionStyle,
  CaptionItemData,
  VideoItemData,
  AudioItemData,
  VisualItemData,
  BrollItemData,
  TextItemData,
  ImageItemData,
  VisualDisplayMode,
  OverlayZone,
} from './types';

import {
  DEFAULT_PIP_SETTINGS,
  DEFAULT_SPLIT_SETTINGS,
  DEFAULT_CAPTION_STYLE,
} from './types';

// ============================================
// Types
// ============================================

export interface ManifestToStoreContext {
  /** URL to the source video stream (e.g. proxy URL) */
  videoUrl: string;
  /** URL to the Remotion bundle for visual scenes */
  bundleUrl: string;
  /** Composition ID for Remotion Player */
  compositionId: string;
  /** Optional per-visual metadata (bundleUrl overrides, etc.) */
  visualMeta?: Record<string, { bundleUrl?: string; compositionId?: string }>;
}

export interface ManifestToStoreResult {
  tracks: Track[];
  items: Record<string, TimelineItem>;
  itemIds: string[];
  duration: number;
  fps: number;
  videoSettings: VideoSettings;
  layoutSettings: LayoutSettings;
  layoutPresetId: LayoutPresetId;
}

export type StoreManifestOp =
  | { op: 'update_item'; itemId: string; updates: { startMs?: number; endMs?: number; trackId?: string } }
  | { op: 'update_item_data'; itemId: string; dataUpdates: Record<string, unknown> }
  | { op: 'delete_item'; itemId: string }
  | { op: 'set_layout'; layout: Record<string, unknown> }
  | { op: 'set_display_mode'; itemId: string; displayMode: 'default' | 'fullscreen' | 'overlay' }
  | { op: 'set_transition'; itemId: string; enter?: { type: string; durationMs: number }; exit?: { type: string; durationMs: number } }
  | { op: 'move_item'; itemId: string; startMs: number; endMs: number }
  | { op: 'update_caption_style'; updates: Record<string, unknown> }
  | { op: 'split_item'; itemId: string; atMs: number }
  | { op: 'reorder_tracks'; trackIds: string[] }
  | { op: 'update_video_settings'; updates: Record<string, unknown> };

// ============================================
// Public API
// ============================================

/**
 * Convert a Manifest (from @viona/shared) into the shape expected by the Zustand editor store.
 */
export function manifestToStore(
  manifest: Manifest,
  context: ManifestToStoreContext,
): ManifestToStoreResult {
  const tracks = manifest.tracks.map<Track>((t) => ({
    id: t.id,
    type: t.type === 'broll' ? 'overlay' : (t.type as Track['type']),
    name: t.name,
    position: t.position,
    locked: false,
    visible: true,
    height: 48,
    collapsed: false,
  }));

  const captionStyle = convertManifestCaptionStyle(manifest.captionStyle);
  const items: Record<string, TimelineItem> = {};
  const itemIds: string[] = [];

  for (const manifestItem of manifest.items) {
    const storeItem = convertManifestItem(manifestItem, context, captionStyle);
    items[storeItem.id] = storeItem;
    itemIds.push(storeItem.id);
  }

  const videoSettings: VideoSettings = {
    canvasWidth: manifest.canvas.width,
    canvasHeight: manifest.canvas.height,
    cropX: manifest.videoSettings.cropX,
    cropY: manifest.videoSettings.cropY,
    scale: manifest.videoSettings.scale,
  };

  const layoutSettings = convertManifestLayout(manifest.layout);

  return {
    tracks,
    items,
    itemIds,
    duration: manifest.durationMs,
    fps: manifest.fps,
    videoSettings,
    layoutSettings,
    layoutPresetId: 'custom' as LayoutPresetId,
  };
}

/**
 * Extract 1-indexed scene ID from a scene file path.
 * "scenes/Scene3.tsx" -> 3
 * Returns undefined if the path doesn't match (e.g. workspace-remapped paths).
 */
export function extractSceneId(sceneFile: string): number | undefined {
  const match = sceneFile.match(/Scene(\d+)\.tsx$/);
  return match ? parseInt(match[1], 10) : undefined;
}

/**
 * Extract compositionId from a workspace-remapped scene file path.
 * "scenes/comp_abc123/index.tsx" -> "comp_abc123"
 */
export function extractCompositionId(sceneFile: string): string | undefined {
  const match = sceneFile.match(/^scenes\/([^/]+)\/index\.tsx$/);
  return match ? match[1] : undefined;
}

// ============================================
// Internal Helpers
// ============================================

function convertManifestItem(
  item: ManifestItem,
  context: ManifestToStoreContext,
  captionStyle: CaptionStyle,
): TimelineItem {
  const base = {
    id: item.id,
    type: item.type as TimelineItem['type'],
    trackId: item.trackId,
    startMs: item.startMs,
    endMs: item.endMs,
  };

  switch (item.type) {
    case 'video': {
      const d = item.data as any;
      const data: VideoItemData = {
        src: context.videoUrl,
        width: 1920,
        height: 1080,
        volume: d.volume ?? 1,
        playbackRate: d.playbackRate ?? 1,
      };
      return { ...base, data };
    }

    case 'audio': {
      const d = item.data as any;
      const data: AudioItemData = {
        src: d.src || context.videoUrl,
        originalSrc: d.src || context.videoUrl,
        enhancedSrc: d.enhancedSrc || undefined,
        isEnhanced: !!d.enhancedSrc,
        sourceVideoItemId: '',
        volume: d.volume ?? 1,
      };
      return { ...base, data };
    }

    case 'caption': {
      const d = item.data as any;
      const words = (d.words || []).map((w: any) => ({
        text: w.text,
        startMs: w.startMs,
        endMs: w.endMs,
        ...(w.styleOverrides ? { styleOverrides: w.styleOverrides } : {}),
      }));
      const text = words.map((w: any) => w.text).join(' ');
      const data: CaptionItemData = {
        text,
        words,
        style: captionStyle,
      };
      return { ...base, data };
    }

    case 'visual': {
      const d = item.data as any;
      const meta = context.visualMeta?.[item.id];
      const sceneId = extractSceneId(d.sceneFile || '');
      const data: VisualItemData = {
        visualId: item.id,
        compositionId: meta?.compositionId || context.compositionId,
        bundleUrl: meta?.bundleUrl || context.bundleUrl,
        videoUrl: context.videoUrl,
        type: 'visual',
        description: '',
        width: 1920,
        height: 1080,
        fps: 30,
        sourceSceneId: sceneId,
        displayMode: (d.displayMode as VisualDisplayMode) || 'default',
        overlayZone: d.overlayZone as OverlayZone | undefined,
        transition: d.transition,
        speakerBbox: d.speakerBbox,
      };
      return { ...base, data };
    }

    case 'broll': {
      const d = item.data as any;
      const data: BrollItemData = {
        sourceType: d.sourceType || 'upload',
        src: d.src || '',
        filename: d.filename,
        photographer: d.photographer,
        previewUrl: d.previewUrl,
        volume: d.volume ?? 1,
      };
      return { ...base, data };
    }

    case 'text': {
      const d = item.data as any;
      const data: TextItemData = {
        text: d.text || '',
        style: d.style || {
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: 48,
          fontWeight: 600,
          color: '#ffffff',
          textAlign: 'center' as const,
        },
        position: d.position || { x: 0, y: 0 },
        size: d.size || { width: 400, height: 100 },
      };
      return { ...base, data };
    }

    case 'image': {
      const d = item.data as any;
      const data: ImageItemData = {
        src: d.src || '',
        width: d.width || 400,
        height: d.height || 300,
        position: d.position || { x: 0, y: 0 },
        opacity: d.opacity ?? 1,
      };
      return { ...base, data };
    }

    default:
      // Fallback — should not happen with well-formed manifests
      return { ...base, data: item.data as any };
  }
}

function convertManifestCaptionStyle(mcs: ManifestCaptionStyle): CaptionStyle {
  return {
    displayMode: (mcs.displayMode as CaptionStyle['displayMode']) || DEFAULT_CAPTION_STYLE.displayMode,
    wordsPerPhrase: mcs.wordsPerPhrase ?? DEFAULT_CAPTION_STYLE.wordsPerPhrase,
    animation: mcs.animation
      ? {
          in: mcs.animation.in as any,
          active: mcs.animation.active as any,
          out: mcs.animation.out as any,
          easing: mcs.animation.easing as any,
        }
      : DEFAULT_CAPTION_STYLE.animation,
    fontFamily: mcs.fontFamily || DEFAULT_CAPTION_STYLE.fontFamily,
    fontSize: mcs.fontSize ?? DEFAULT_CAPTION_STYLE.fontSize,
    fontWeight: mcs.fontWeight ?? DEFAULT_CAPTION_STYLE.fontWeight,
    letterSpacing: mcs.letterSpacing,
    textTransform: mcs.textTransform as CaptionStyle['textTransform'],
    opacity: mcs.opacity,
    lineHeight: mcs.lineHeight,
    color: mcs.color || DEFAULT_CAPTION_STYLE.color,
    activeColor: mcs.activeColor || DEFAULT_CAPTION_STYLE.activeColor,
    backgroundColor: mcs.backgroundColor || DEFAULT_CAPTION_STYLE.backgroundColor,
    activeBackgroundColor: mcs.activeBackgroundColor || DEFAULT_CAPTION_STYLE.activeBackgroundColor,
    stroke: mcs.stroke ?? null,
    effects: mcs.effects ? {
      shadow: mcs.effects.shadow ?? null,
      shadowSecondary: mcs.effects.shadowSecondary ?? null,
      glow: mcs.effects.glow ?? null,
    } : DEFAULT_CAPTION_STYLE.effects,
    backgroundPadding: mcs.backgroundPadding,
    backgroundRadius: mcs.backgroundRadius,
    position: mcs.position
      ? {
          anchor: mcs.position.anchor || 'bottom',
          offsetX: mcs.position.offsetX ?? 0,
          offsetY: mcs.position.offsetY ?? 0,
          rotation: mcs.position.rotation ?? 0,
          textAlign: mcs.position.textAlign || 'center',
        }
      : DEFAULT_CAPTION_STYLE.position,
    presetId: mcs.presetId ?? undefined,
  };
}

function convertManifestLayout(ml: ManifestLayout): LayoutSettings {
  return {
    mode: ml.mode as LayoutSettings['mode'],
    pip: {
      position: (ml.pip.position as any) || DEFAULT_PIP_SETTINGS.position,
      offsetX: ml.pip.offsetX ?? DEFAULT_PIP_SETTINGS.offsetX,
      offsetY: ml.pip.offsetY ?? DEFAULT_PIP_SETTINGS.offsetY,
      size: 'custom',
      customSize: ml.pip.size ?? DEFAULT_PIP_SETTINGS.customSize,
      shape: (ml.pip.shape as any) || DEFAULT_PIP_SETTINGS.shape,
      borderRadius: ml.pip.borderRadius ?? DEFAULT_PIP_SETTINGS.borderRadius,
      rotation: ml.pip.rotation ?? DEFAULT_PIP_SETTINGS.rotation,
      borderWidth: ml.pip.borderWidth ?? DEFAULT_PIP_SETTINGS.borderWidth,
      borderColor: ml.pip.borderColor || DEFAULT_PIP_SETTINGS.borderColor,
      shadowEnabled: ml.pip.shadowEnabled ?? DEFAULT_PIP_SETTINGS.shadowEnabled,
      shadowColor: ml.pip.shadowColor || DEFAULT_PIP_SETTINGS.shadowColor,
      shadowBlur: ml.pip.shadowBlur ?? DEFAULT_PIP_SETTINGS.shadowBlur,
      opacity: ml.pip.opacity ?? DEFAULT_PIP_SETTINGS.opacity,
      crop: ml.pip.crop
        ? {
            cropX: ml.pip.crop.cropX ?? 50,
            cropY: ml.pip.crop.cropY ?? 50,
            zoom: ml.pip.crop.zoom ?? 1,
          }
        : DEFAULT_PIP_SETTINGS.crop,
    },
    split: {
      position: (ml.split.position as any) || DEFAULT_SPLIT_SETTINGS.position,
      ratio: ml.split.ratio ?? DEFAULT_SPLIT_SETTINGS.ratio,
      gap: ml.split.gap ?? DEFAULT_SPLIT_SETTINGS.gap,
    },
  };
}
