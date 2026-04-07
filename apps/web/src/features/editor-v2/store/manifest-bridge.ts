/**
 * Manifest-Store Bridge
 *
 * Converts between @viona/shared Manifest (v2) format and the Zustand editor store format.
 * Used when loading workspace state from the API or applying remote manifest updates.
 */

import type {
  ManifestCaptionStyle,
} from '@viona/shared';

import type {
  Track,
  TimelineItem,
  VideoSettings,
  CaptionStyle,
  CaptionItemData,
  VideoItemData,
  AudioItemData,
  VisualItemData,
  TextItemData,
  ImageItemData,
  Transform,
  Keyframe,
  Filters,
  ShapeItemData as StoreShapeItemData,
} from './types';

import {
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
  captionPreset: CaptionStyle;
}

export type StoreManifestOp =
  | { op: 'update_item'; itemId: string; updates: { startMs?: number; endMs?: number; trackId?: string } }
  | { op: 'update_item_data'; itemId: string; dataUpdates: Record<string, unknown> }
  | { op: 'delete_item'; itemId: string }
  | { op: 'set_transition'; itemId: string; enter?: { type: string; durationMs: number }; exit?: { type: string; durationMs: number } }
  | { op: 'move_item'; itemId: string; startMs: number; endMs: number }
  | { op: 'update_caption_preset'; updates: Record<string, unknown> }
  | { op: 'split_item'; itemId: string; atMs: number }
  | { op: 'reorder_tracks'; trackIds: string[] }
  | { op: 'update_video_settings'; updates: Record<string, unknown> }
  | { op: 'update_transform'; itemId: string; transform: Record<string, number | string> };

// ============================================
// Keyframe normalization
// ============================================

/**
 * Strip x/y/width/height from scene keyframes when they just set full-canvas
 * defaults (x:0, y:0, width:'100%', height:'100%'). Agents frequently write
 * keyframes with ALL transform properties when they only intend to animate opacity,
 * which overrides the base transform's positioning and causes scenes to render at (0,0).
 */
function stripRedundantSceneKeyframePositions(keyframes: Keyframe[], transform: Transform): Keyframe[] {
  if (!keyframes || keyframes.length === 0) return keyframes;

  const hasCustomPosition = (transform.x !== 0 && transform.x !== '0') ||
    (transform.y !== 0 && transform.y !== '0') ||
    (transform.width !== '100%') ||
    (transform.height !== '100%');

  if (!hasCustomPosition) return keyframes;

  return keyframes.map(kf => {
    if (!kf.props) return kf;
    const cleaned = { ...kf.props };
    for (const prop of ['x', 'y', 'width', 'height', 'rotation'] as const) {
      const val = cleaned[prop];
      if (val === undefined) continue;
      const isFullCanvasDefault = val === 0 || val === '0' || val === '100%';
      if (isFullCanvasDefault) {
        delete cleaned[prop];
      }
    }
    return { ...kf, props: cleaned };
  });
}

// ============================================
// Public API
// ============================================

/**
 * Convert a Manifest (from @viona/shared) into the shape expected by the Zustand editor store.
 */
export function manifestToStore(
  manifest: any,
  context: ManifestToStoreContext,
): ManifestToStoreResult {
  const tracks = (manifest.tracks as any[]).map<Track>((t: any) => ({
    id: t.id,
    type: t.type === 'overlay' ? 'overlay' : t.type as Track['type'],
    name: t.name,
    position: t.position,
    locked: t.name === 'person' ? true : false,
    visible: true,
    height: t.type === 'video' ? 56 : 36,
    collapsed: false,
  }));

  const rawPreset = (manifest as any).captionPreset ?? (manifest as any).captionStyle;
  const captionPreset = rawPreset
    ? convertManifestCaptionStyle(rawPreset)
    : DEFAULT_CAPTION_STYLE;
  const items: Record<string, TimelineItem> = {};
  const itemIds: string[] = [];

  /** Resolve an asset key (e.g. "asset:main-video") to a presigned/proxy URL */
  const resolvedSrc = (key: string) => {
    if (!key) return context.videoUrl ?? '';
    // Check assets map first (presigned URLs)
    if (context.assets?.[key]) return context.assets[key];
    // If the key is already an absolute URL, use as-is
    if (/^https?:\/\//.test(key) || key.startsWith('/api/')) return key;
    // Resolve sandbox-relative paths (e.g. "audio.aac") via the public file proxy
    const projectIdMatch = context.bundleUrl?.match(/\/projects\/([^/]+)\/(workspace|sandbox)\//);
    if (projectIdMatch) {
      return `/api/projects/${projectIdMatch[1]}/${projectIdMatch[2]}/public/${key}`;
    }
    return context.videoUrl ?? '';
  };

  for (const manifestItem of manifest.items) {
    const storeItem = convertManifestItemV2(manifestItem, context, resolvedSrc);
    items[storeItem.id] = storeItem;
    itemIds.push(storeItem.id);
  }


  const videoSettings: VideoSettings = {
    canvasWidth: manifest.canvas.width,
    canvasHeight: manifest.canvas.height,
    cropX: 50,
    cropY: 50,
    scale: 1,
  };

  return {
    tracks,
    items,
    itemIds,
    duration: manifest.durationMs,
    fps: manifest.fps,
    videoSettings,
    captionPreset,
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
    sourceWidth?: number;
    sourceHeight?: number;
    assets?: Record<string, string>;
  },
  captionPreset: CaptionStyle,
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

      // Attach v2 transform — canonical source for all item types
      if (item.transform) base.transform = item.transform;
      if (item.keyframes && item.keyframes.length > 0) {
        // Strip redundant position overrides from scene keyframes — agents often
        // write keyframes with x:0,y:0,width:'100%',height:'100%' that override
        // the base transform's positioning
        if ((item.type === 'scene' || item.type === 'visual') && item.transform) {
          base.keyframes = stripRedundantSceneKeyframePositions(item.keyframes, item.transform);
        } else {
          base.keyframes = item.keyframes;
        }
      }
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
    assets: state.assets ?? {},
    captionPreset: convertStoreCaptionStyle(captionPreset),
    videoSettings: {
      cropX: state.videoSettings.cropX,
      cropY: state.videoSettings.cropY,
      scale: state.videoSettings.scale,
      sourceWidth: state.sourceWidth ?? state.videoSettings.canvasWidth,
      sourceHeight: state.sourceHeight ?? state.videoSettings.canvasHeight,
    },
  };

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
// Internal Helpers — manifest to store
// ============================================

function convertManifestItemV2(
  item: any,
  context: ManifestToStoreContext,
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
    let kfs = item.keyframes as Keyframe[];
    // Fix agent-written keyframes that override scene positioning with full-canvas defaults
    if (item.type === 'scene' && base.transform) {
      kfs = stripRedundantSceneKeyframePositions(kfs, base.transform);
    }
    base.keyframes = kfs;
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
        startFrom: d.startFrom ?? 0,
        ...(d.crop ? { crop: d.crop } : {}),
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
        startFrom: d.startFrom ?? 0,
        playbackRate: d.playbackRate ?? 1,
      };
      return { ...base, data } as TimelineItem;
    }

    case 'caption': {
      const words = (d.words || []).map((w: any) => ({
        text: w.text,
        // Convert absolute word timestamps to relative (matching store convention)
        startMs: w.startMs - item.startMs,
        endMs: w.endMs - item.startMs,
        // Hero annotation from Caption Agent
        ...(w.hero !== undefined ? { hero: w.hero } : {}),
        // Migrate classification → role
        ...(w.role ? { role: w.role } : w.classification ? { role: w.classification } : {}),
        ...(w.styleOverrides ? { styleOverrides: w.styleOverrides } : {}),
      }));
      const text = words.map((w: any) => w.text).join(' ');
      const data: CaptionItemData = {
        text,
        words,
      };
      return { ...base, data } as TimelineItem;
    }

    case 'scene': {
      // v2 scene type maps to visual-like data in the store
      // Preserve ALL manifest data fields so storeToManifest round-trip is lossless
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
        transition: d.transition,
        speakerBbox: d.speakerBbox,
        // Preserve original manifest fields for lossless round-trip
        _sceneFile: d.sceneFile,
        _displayMode: d.displayMode,
        _sceneName: d.sceneName,
        _speakerCenter: d.speakerCenter,
        _visibleZones: d.visibleZones,
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
        style: {
          fontFamily: d.fontFamily || 'Inter',
          fontSize: d.fontSize || 48,
          fontWeight: d.fontWeight || 600,
          color: d.color || '#FFFFFF',
          backgroundColor: d.backgroundColor,
          textAlign: d.textAlign || 'center',
        },
        position: {
          x: typeof item.transform?.x === 'number' ? item.transform.x : 0,
          y: typeof item.transform?.y === 'number' ? item.transform.y : 0,
        },
        size: {
          width: typeof item.transform?.width === 'number' ? item.transform.width : 800,
          height: typeof item.transform?.height === 'number' ? item.transform.height : 200,
        },
      };
      return { ...base, data } as TimelineItem;
    }

    case 'image': {
      const data: ImageItemData = {
        src: resolvedSrc(d.src || ''),
        width: typeof item.transform?.width === 'number' ? item.transform.width : 1920,
        height: typeof item.transform?.height === 'number' ? item.transform.height : 1080,
        position: {
          x: typeof item.transform?.x === 'number' ? item.transform.x : 0,
          y: typeof item.transform?.y === 'number' ? item.transform.y : 0,
        },
        opacity: item.transform?.opacity ?? 1,
      };
      return { ...base, data } as TimelineItem;
    }

    case 'matte': {
      // Keep raw relative paths for fgrSrc/matteSrc — resolution happens at
      // render time in resolveMediaSrc (inside the workspace bundle).
      // Resolving here would store full proxy URLs in the store, preventing
      // the bundle's assets map lookup from matching.
      const data = { ...d };
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
        volume: d.volume ?? 1,
        playbackRate: d.playbackRate ?? 1,
        startFrom: d.startFrom ?? 0,
        ...(d.crop ? { crop: d.crop } : {}),
        ...(d.fadeInMs ? { fadeInMs: d.fadeInMs } : {}),
        ...(d.fadeOutMs ? { fadeOutMs: d.fadeOutMs } : {}),
      };

    case 'audio':
      return {
        src: d.src || '',
        volume: d.volume ?? 1,
        playbackRate: d.playbackRate ?? 1,
        startFrom: d.startFrom ?? 0,
        ...(d.enhancedSrc ? { enhancedSrc: d.enhancedSrc } : {}),
        ...(d.fadeInMs ? { fadeInMs: d.fadeInMs } : {}),
        ...(d.fadeOutMs ? { fadeOutMs: d.fadeOutMs } : {}),
      };

    case 'caption': {
      // Convert relative word timestamps back to absolute
      const words = (d.words || []).map((w: any) => ({
        text: w.text,
        startMs: w.startMs + item.startMs,
        endMs: w.endMs + item.startMs,
        // Preserve hero annotation for Caption Agent round-trip
        ...(w.hero !== undefined ? { hero: w.hero } : {}),
        ...(w.role ? { role: w.role } : {}),
        ...(w.styleOverrides ? { styleOverrides: w.styleOverrides } : {}),
      }));
      return { words };
    }

    case 'visual':
    case 'scene': {
      const result: Record<string, unknown> = {
        // Use preserved original sceneFile if available, otherwise reconstruct
        sceneFile: d._sceneFile || (d.sourceSceneId != null ? `Scene${d.sourceSceneId}.tsx` : ''),
      };
      if (d.transition) result.transition = d.transition;
      if (d.speakerBbox) result.speakerBbox = d.speakerBbox;
      // Restore preserved manifest fields
      if (d._displayMode) result.displayMode = d._displayMode;
      if (d._sceneName) result.sceneName = d._sceneName;
      if (d._speakerCenter) result.speakerCenter = d._speakerCenter;
      if (d._visibleZones) result.visibleZones = d._visibleZones;
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

    case 'text': {
      const td = d as any;
      return {
        text: td.text || '',
        fontFamily: td.style?.fontFamily || 'Inter',
        fontSize: td.style?.fontSize || 48,
        fontWeight: td.style?.fontWeight || 600,
        color: td.style?.color || '#FFFFFF',
        backgroundColor: td.style?.backgroundColor,
        textAlign: td.style?.textAlign || 'center',
        textTransform: td.style?.textTransform || 'none',
        ...(td.style?.lineHeight != null ? { lineHeight: td.style.lineHeight } : {}),
        ...(td.style?.letterSpacing != null ? { letterSpacing: td.style.letterSpacing } : {}),
        ...(td.style?.borderRadius != null ? { borderRadius: td.style.borderRadius } : {}),
        ...(td.style?.padding != null ? { padding: td.style.padding } : {}),
      };
    }

    case 'image':
      return {
        src: d.src || '',
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

  // Dual typography
  if (style.typographyPairingId) result.typographyPairingId = style.typographyPairingId;
  if (style.displayFontFamily) result.displayFontFamily = style.displayFontFamily;
  if (style.bodyFontFamily) result.bodyFontFamily = style.bodyFontFamily;

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
  if (style.position && typeof style.position === 'object') {
    const pos: Record<string, unknown> = {
      anchor: style.position.anchor,
      offsetX: style.position.offsetX,
      offsetY: style.position.offsetY,
      textAlign: style.position.textAlign,
      rotation: style.position.rotation,
    };
    // Free-mode fields (set when user drags caption in preview)
    if (style.position.mode) pos.mode = style.position.mode;
    if (style.position.x != null) pos.x = style.position.x;
    if (style.position.y != null) pos.y = style.position.y;
    if (style.position.width != null) pos.width = style.position.width;
    result.position = pos;
  }

  // Effects
  if (style.effects) {
    result.effects = {
      shadow: style.effects.shadow,
      shadowSecondary: style.effects.shadowSecondary,
      glow: style.effects.glow,
    };
  }

  // Cinematic renderer
  if (style.useCinematicRenderer) {
    result.useCinematicRenderer = true;
    if (style.cinematicFonts) result.cinematicFonts = style.cinematicFonts;
    if (style.cinematicColors) result.cinematicColors = style.cinematicColors;
    if (style.cinematicScales) result.cinematicScales = style.cinematicScales;
  }

  // Poster staircase alignment
  if (style.staircaseAlignment) result.staircaseAlignment = style.staircaseAlignment;

  // Kinetic Luxe fields
  if (style.heroFontFamily) result.heroFontFamily = style.heroFontFamily;
  if (style.heroColor) result.heroColor = style.heroColor;
  if (style.fontPairId) result.fontPairId = style.fontPairId;
  if (style.managedByAgent) result.managedByAgent = style.managedByAgent;

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
          // Preserve free-mode fields so position survives manifest round-trip
          ...((mcs.position as any).mode ? { mode: (mcs.position as any).mode } : {}),
          ...((mcs.position as any).x != null ? { x: (mcs.position as any).x } : {}),
          ...((mcs.position as any).y != null ? { y: (mcs.position as any).y } : {}),
          ...((mcs.position as any).width != null ? { width: (mcs.position as any).width } : {}),
        }
      : DEFAULT_CAPTION_STYLE.position,
    presetId: mcs.presetId ?? undefined,
    // Dual typography
    typographyPairingId: (mcs as any).typographyPairingId ?? undefined,
    displayFontFamily: (mcs as any).displayFontFamily ?? undefined,
    bodyFontFamily: (mcs as any).bodyFontFamily ?? undefined,
    // Cinematic renderer
    ...(mcs.useCinematicRenderer ? {
      useCinematicRenderer: true as const,
      cinematicFonts: mcs.cinematicFonts as CaptionStyle['cinematicFonts'],
      cinematicColors: mcs.cinematicColors as CaptionStyle['cinematicColors'],
      cinematicScales: mcs.cinematicScales as CaptionStyle['cinematicScales'],
    } : {}),
    // Kinetic Luxe
    heroFontFamily: (mcs as any).heroFontFamily ?? undefined,
    heroColor: (mcs as any).heroColor ?? undefined,
    fontPairId: (mcs as any).fontPairId ?? undefined,
    managedByAgent: (mcs as any).managedByAgent ?? undefined,
    // Poster staircase alignment — prefer new staircaseAlignment; fall back to mapping old staircaseVariant
    staircaseAlignment: (() => {
      const sa = (mcs as any).staircaseAlignment;
      if (sa) return sa;
      const sv = (mcs as any).staircaseVariant as string | undefined;
      if (!sv) return undefined;
      // Map old preset-specific variant names to consolidated alignment options
      const variantMap: Record<string, string> = {
        'impact-pop': 'impact',
        'elegant-script': 'single',
        'script-accent': 'single',
        'scattered-poster': 'scattered',
      };
      return variantMap[sv] ?? sv; // 'bold-stack' and 'mega-bold' map to themselves
    })(),
  };
}

