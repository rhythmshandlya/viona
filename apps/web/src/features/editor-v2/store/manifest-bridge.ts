/**
 * Manifest-Store Bridge
 *
 * Converts between @viona/shared Manifest format and the Zustand editor store format.
 * Used when loading workspace state from the API or applying remote manifest updates.
 *
 * Supports both v1 manifests (version: 1) and v2 manifests (version: 2).
 * v2 adds per-item transform/keyframes/filters, asset resolution, and scene/shape types.
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

import type {
  Transform,
  Keyframe,
  Filters,
  ShapeItemData as StoreShapeItemData,
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
  /** URL to the source video stream (e.g. proxy URL). Optional for v2 (resolved from assets). */
  videoUrl?: string;
  /** URL to the Remotion bundle for visual scenes */
  bundleUrl: string;
  /** Composition ID for Remotion Player */
  compositionId: string;
  /** Optional per-visual metadata (bundleUrl overrides, etc.) */
  visualMeta?: Record<string, { bundleUrl?: string; compositionId?: string }>;
  /** v2 asset key to presigned URL mapping */
  assets?: Record<string, string>;
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
 * Supports both v1 and v2 manifests — v2 detection is automatic.
 */
export function manifestToStore(
  manifest: any,  // Accept any — could be v1 or v2
  context: ManifestToStoreContext,
): ManifestToStoreResult {
  const isV2 = manifest.version === 2 || manifest.items?.some((i: any) => i.transform);

  const tracks = (manifest.tracks as any[]).map<Track>((t: any) => ({
    id: t.id,
    type: isV2
      ? (t.type === 'overlay' ? 'overlay' : t.type as Track['type'])
      : (t.type === 'broll' ? 'overlay' : t.type as Track['type']),
    name: t.name,
    position: t.position,
    locked: false,
    visible: true,
    height: 48,
    collapsed: false,
  }));

  const captionStyle = manifest.captionStyle
    ? convertManifestCaptionStyle(manifest.captionStyle)
    : DEFAULT_CAPTION_STYLE;
  const items: Record<string, TimelineItem> = {};
  const itemIds: string[] = [];

  /** Resolve an asset key (e.g. "asset:main-video") to a presigned URL */
  const resolvedSrc = (key: string) => {
    if (!key) return context.videoUrl ?? '';
    return context.assets?.[key] ?? key;
  };

  for (const manifestItem of manifest.items) {
    const storeItem = isV2
      ? convertManifestItemV2(manifestItem, context, captionStyle, resolvedSrc)
      : convertManifestItem(manifestItem as ManifestItem, context, captionStyle);
    items[storeItem.id] = storeItem;
    itemIds.push(storeItem.id);
  }

  const videoSettings: VideoSettings = isV2
    ? {
        canvasWidth: manifest.canvas.width,
        canvasHeight: manifest.canvas.height,
        cropX: 50,
        cropY: 50,
        scale: 1,
      }
    : {
        canvasWidth: manifest.canvas.width,
        canvasHeight: manifest.canvas.height,
        cropX: manifest.videoSettings.cropX,
        cropY: manifest.videoSettings.cropY,
        scale: manifest.videoSettings.scale,
      };

  const layoutSettings = isV2
    ? {
        mode: 'stacked' as const,
        pip: DEFAULT_PIP_SETTINGS,
        split: DEFAULT_SPLIT_SETTINGS,
      }
    : convertManifestLayout(manifest.layout);

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
 * Convert store state back to a v2 manifest format.
 * Used when saving editor changes back to the API.
 */
export function storeToManifest(
  state: {
    tracks: Track[];
    items: Record<string, TimelineItem>;
    itemIds: string[];
    duration: number;
    fps: number;
    videoSettings: VideoSettings;
    layoutSettings?: LayoutSettings;
  },
  captionStyle: CaptionStyle,
): Record<string, unknown> {
  const tracks = state.tracks.map((t) => ({
    id: t.id,
    // Map store track types back to manifest track types
    type: t.type === 'visual' ? 'overlay' : t.type,
    name: t.name,
    position: t.position,
  }));

  const items = state.itemIds
    .map((id) => state.items[id])
    .filter(Boolean)
    .map((item) => {
      const base: Record<string, unknown> = {
        id: item.id,
        type: convertStoreItemType(item.type),
        trackId: item.trackId,
        startMs: item.startMs,
        endMs: item.endMs,
        data: convertStoreItemData(item),
      };

      // Attach v2 fields if present
      if (item.transform) base.transform = item.transform;
      if (item.keyframes && item.keyframes.length > 0) base.keyframes = item.keyframes;
      if (item.filters) base.filters = item.filters;

      return base;
    });

  const manifest: Record<string, unknown> = {
    version: 2,
    fps: state.fps,
    durationMs: state.duration,
    canvas: {
      width: state.videoSettings.canvasWidth,
      height: state.videoSettings.canvasHeight,
    },
    tracks,
    items,
    captionStyle: convertStoreCaptionStyle(captionStyle),
    videoSettings: {
      cropX: state.videoSettings.cropX,
      cropY: state.videoSettings.cropY,
      scale: state.videoSettings.scale,
      sourceWidth: 1920,
      sourceHeight: 1080,
    },
  };

  // Include layout if present (v1 backward compat)
  if (state.layoutSettings) {
    manifest.layout = {
      mode: state.layoutSettings.mode,
      pip: {
        position: state.layoutSettings.pip.position,
        offsetX: state.layoutSettings.pip.offsetX,
        offsetY: state.layoutSettings.pip.offsetY,
        size: state.layoutSettings.pip.customSize,
        shape: state.layoutSettings.pip.shape,
        borderRadius: state.layoutSettings.pip.borderRadius,
        rotation: state.layoutSettings.pip.rotation,
        borderWidth: state.layoutSettings.pip.borderWidth,
        borderColor: state.layoutSettings.pip.borderColor,
        shadowEnabled: state.layoutSettings.pip.shadowEnabled,
        shadowColor: state.layoutSettings.pip.shadowColor,
        shadowBlur: state.layoutSettings.pip.shadowBlur,
        opacity: state.layoutSettings.pip.opacity,
        crop: state.layoutSettings.pip.crop,
      },
      split: {
        position: state.layoutSettings.split.position,
        ratio: state.layoutSettings.split.ratio,
        gap: state.layoutSettings.split.gap,
      },
    };
  }

  return manifest;
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
// Internal Helpers — v1
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
        src: context.videoUrl ?? '',
        width: 1920,
        height: 1080,
        volume: d.volume ?? 1,
        playbackRate: d.playbackRate ?? 1,
      };
      return { ...base, data };
    }

    case 'audio': {
      const d = item.data as any;
      // d.src from manifest is a worker-internal path like 'source.mp4';
      // use absolute videoUrl for the editor preview instead
      const videoUrl = context.videoUrl ?? '';
      const audioSrc = (d.src && /^https?:\/\//.test(d.src)) ? d.src : videoUrl;
      const data: AudioItemData = {
        src: audioSrc,
        originalSrc: audioSrc,
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
        // Convert absolute word timestamps to relative (matching store convention).
        // DB/manifest stores absolute ms; the store uses relative-to-item-start.
        startMs: w.startMs - item.startMs,
        endMs: w.endMs - item.startMs,
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

// ============================================
// Internal Helpers — v2
// ============================================

function convertManifestItemV2(
  item: any,
  context: ManifestToStoreContext,
  captionStyle: CaptionStyle,
  resolvedSrc: (key: string) => string,
): TimelineItem {
  const base: Partial<TimelineItem> = {
    id: item.id,
    type: item.type as TimelineItem['type'],
    trackId: item.trackId,
    startMs: item.startMs,
    endMs: item.endMs,
  };

  // Attach v2 optional fields if present on the manifest item
  if (item.transform) {
    base.transform = item.transform as Transform;
  }
  if (item.keyframes && item.keyframes.length > 0) {
    base.keyframes = item.keyframes as Keyframe[];
  }
  if (item.filters) {
    base.filters = item.filters as Filters;
  }

  const d = item.data as any;

  switch (item.type) {
    case 'video': {
      const data: VideoItemData = {
        src: resolvedSrc(d.src || ''),
        width: d.width || 1920,
        height: d.height || 1080,
        volume: d.volume ?? 1,
        playbackRate: d.playbackRate ?? 1,
      };
      return { ...base, data } as TimelineItem;
    }

    case 'audio': {
      const src = resolvedSrc(d.src || '');
      const data: AudioItemData = {
        src,
        originalSrc: src,
        enhancedSrc: d.enhancedSrc ? resolvedSrc(d.enhancedSrc) : undefined,
        isEnhanced: !!d.enhancedSrc,
        sourceVideoItemId: d.sourceVideoItemId || '',
        volume: d.volume ?? 1,
      };
      return { ...base, data } as TimelineItem;
    }

    case 'caption': {
      const words = (d.words || []).map((w: any) => ({
        text: w.text,
        // Convert absolute word timestamps to relative (matching store convention)
        startMs: w.startMs - item.startMs,
        endMs: w.endMs - item.startMs,
        ...(w.styleOverrides ? { styleOverrides: w.styleOverrides } : {}),
      }));
      const text = words.map((w: any) => w.text).join(' ');
      const data: CaptionItemData = {
        text,
        words,
        style: captionStyle,
      };
      return { ...base, data } as TimelineItem;
    }

    case 'scene': {
      // v2 scene type maps to visual-like data in the store
      const meta = context.visualMeta?.[item.id];
      const sceneId = extractSceneId(d.sceneFile || '');
      const data: VisualItemData = {
        visualId: item.id,
        compositionId: meta?.compositionId || context.compositionId,
        bundleUrl: meta?.bundleUrl || context.bundleUrl,
        videoUrl: context.videoUrl,
        type: 'visual',
        description: d.description || '',
        width: d.width || 1920,
        height: d.height || 1080,
        fps: d.fps || 30,
        sourceSceneId: sceneId,
        displayMode: (d.displayMode as VisualDisplayMode) || 'default',
        overlayZone: d.overlayZone as OverlayZone | undefined,
        transition: d.transition,
        speakerBbox: d.speakerBbox,
      };
      // Keep type as 'scene' in the store
      return { ...base, type: 'scene', data } as TimelineItem;
    }

    case 'shape': {
      const data: StoreShapeItemData = {
        shape: d.shape || 'rectangle',
        fill: d.fill,
        stroke: d.stroke,
        strokeWidth: d.strokeWidth,
        borderRadius: d.borderRadius,
      };
      return { ...base, data } as TimelineItem;
    }

    case 'text': {
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
      return { ...base, data } as TimelineItem;
    }

    case 'image': {
      const data: ImageItemData = {
        src: resolvedSrc(d.src || ''),
        width: d.width || 400,
        height: d.height || 300,
        position: d.position || { x: 0, y: 0 },
        opacity: d.opacity ?? 1,
      };
      return { ...base, data } as TimelineItem;
    }

    default:
      // Fallback for unknown v2 types — pass data through
      return { ...base, data: d } as TimelineItem;
  }
}

// ============================================
// Internal Helpers — storeToManifest
// ============================================

/** Map store item type to manifest item type */
function convertStoreItemType(storeType: string): string {
  switch (storeType) {
    case 'visual': return 'scene';
    case 'broll': return 'video';
    default: return storeType;
  }
}

/** Convert store item data to manifest item data */
function convertStoreItemData(item: TimelineItem): Record<string, unknown> {
  const d = item.data as any;

  switch (item.type) {
    case 'video':
      return {
        src: d.src || '',
        crop: { x: 50, y: 50, scale: 1 },
        volume: d.volume ?? 1,
        playbackRate: d.playbackRate ?? 1,
      };

    case 'audio':
      return {
        src: d.src || '',
        volume: d.volume ?? 1,
        enhancedSrc: d.enhancedSrc || null,
      };

    case 'caption': {
      // Convert relative word timestamps back to absolute
      const words = (d.words || []).map((w: any) => ({
        text: w.text,
        startMs: w.startMs + item.startMs,
        endMs: w.endMs + item.startMs,
        ...(w.styleOverrides ? { styleOverrides: w.styleOverrides } : {}),
      }));
      return { words };
    }

    case 'visual':
    case 'scene': {
      const result: Record<string, unknown> = {
        sceneFile: d.sourceSceneId != null ? `scenes/Scene${d.sourceSceneId}.tsx` : '',
        displayMode: d.displayMode || 'default',
        frameOffset: 0,
      };
      if (d.overlayZone) result.overlayZone = d.overlayZone;
      if (d.transition) result.transition = d.transition;
      if (d.speakerBbox) result.speakerBbox = d.speakerBbox;
      return result;
    }

    case 'broll':
      return {
        src: d.src || '',
        sourceType: d.sourceType || 'upload',
        filename: d.filename,
        photographer: d.photographer,
        previewUrl: d.previewUrl,
        volume: d.volume ?? 1,
      };

    case 'text':
      return {
        text: d.text || '',
        style: d.style,
        position: d.position,
        size: d.size,
      };

    case 'image':
      return {
        src: d.src || '',
        width: d.width,
        height: d.height,
        position: d.position,
        opacity: d.opacity ?? 1,
      };

    case 'shape':
      return {
        shape: d.shape || 'rectangle',
        fill: d.fill,
        stroke: d.stroke,
        strokeWidth: d.strokeWidth,
        borderRadius: d.borderRadius,
      };

    default:
      return d || {};
  }
}

/** Convert store CaptionStyle back to manifest captionStyle format */
function convertStoreCaptionStyle(style: CaptionStyle): Record<string, unknown> {
  const result: Record<string, unknown> = {
    displayMode: style.displayMode,
    wordsPerPhrase: style.wordsPerPhrase,
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    color: style.color,
    activeColor: style.activeColor,
    backgroundColor: style.backgroundColor,
    activeBackgroundColor: style.activeBackgroundColor,
  };

  if (style.letterSpacing != null) result.letterSpacing = style.letterSpacing;
  if (style.textTransform) result.textTransform = style.textTransform;
  if (style.opacity != null) result.opacity = style.opacity;
  if (style.lineHeight != null) result.lineHeight = style.lineHeight;
  if (style.stroke !== undefined) result.stroke = style.stroke;
  if (style.backgroundPadding) result.backgroundPadding = style.backgroundPadding;
  if (style.backgroundRadius != null) result.backgroundRadius = style.backgroundRadius;
  if (style.presetId) result.presetId = style.presetId;

  // Animation
  if (style.animation && typeof style.animation === 'object') {
    result.animation = {
      in: (style.animation as any).in,
      active: (style.animation as any).active,
      out: (style.animation as any).out,
      easing: (style.animation as any).easing,
    };
  }

  // Position
  if (style.position && typeof style.position === 'object' && 'anchor' in style.position) {
    result.position = {
      anchor: style.position.anchor,
      offsetX: style.position.offsetX,
      offsetY: style.position.offsetY,
      textAlign: style.position.textAlign,
      rotation: style.position.rotation,
    };
  }

  // Effects
  if (style.effects) {
    result.effects = {
      shadow: style.effects.shadow,
      shadowSecondary: style.effects.shadowSecondary,
      glow: style.effects.glow,
    };
  }

  return result;
}

// ============================================
// Internal Helpers — shared
// ============================================

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
