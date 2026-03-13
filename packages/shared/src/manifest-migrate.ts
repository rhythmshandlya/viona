import type { Manifest, ManifestItem, ManifestLayout } from './manifest.js';
import type {
  ManifestV2,
  ManifestItemV2,
  ManifestTrackV2,
  TransformV2,
} from './manifest-v2.js';
import { manifestV2Schema } from './manifest-v2.js';

// ---- Types for v1 item data (to avoid `any`) ----

interface V1VideoData {
  src: string;
  crop: { x: number; y: number; scale: number };
  volume: number;
  playbackRate: number;
}

interface V1AudioData {
  src: string;
  volume: number;
  enhancedSrc?: string | null;
}

interface V1VisualData {
  sceneFile: string;
  displayMode: 'default' | 'fullscreen' | 'overlay';
  frameOffset?: number;
  overlayZone?: string;
  transition?: unknown;
  speakerBbox?: unknown;
}

interface V1CaptionData {
  words: Array<{
    text: string;
    startMs: number;
    endMs: number;
    classification?: 'power' | 'medium' | 'filler';
    styleOverrides?: Record<string, unknown>;
  }>;
}

interface V1BrollData {
  sourceType?: string;
  src: string;
  filename?: string;
  photographer?: string;
  previewUrl?: string;
  volume?: number;
}

interface V1TextData {
  text: string;
  style?: Record<string, unknown>;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
}

interface V1ImageData {
  src: string;
  width?: number;
  height?: number;
  position?: { x: number; y: number };
  opacity?: number;
}

// ---- Helpers ----

const FULLSCREEN_TRANSFORM: TransformV2 = {
  x: 0,
  y: 0,
  width: '100%',
  height: '100%',
  rotation: 0,
  opacity: 1,
};

function mapTrackType(v1Type: string): ManifestTrackV2['type'] {
  switch (v1Type) {
    case 'visual':
    case 'text':
    case 'image':
      return 'overlay';
    case 'broll':
      return 'video';
    case 'video':
    case 'audio':
    case 'caption':
      return v1Type;
    default:
      return 'overlay';
  }
}

function computePipTransform(layout: ManifestLayout): TransformV2 {
  const pip = layout.pip;
  const size = pip.size;
  const offsetX = pip.offsetX;
  const offsetY = pip.offsetY;

  let x: string;
  let y: string;

  switch (pip.position) {
    case 'top-left':
      x = `${offsetX}%`;
      y = `${offsetY}%`;
      break;
    case 'top-right':
      x = `${100 - size - offsetX}%`;
      y = `${offsetY}%`;
      break;
    case 'bottom-left':
      x = `${offsetX}%`;
      y = `${100 - size - offsetY}%`;
      break;
    case 'bottom-right':
    default:
      x = `${100 - size - offsetX}%`;
      y = `${100 - size - offsetY}%`;
      break;
  }

  return {
    x,
    y,
    width: `${size}%`,
    height: `${size}%`,
    rotation: pip.rotation,
    opacity: pip.opacity,
  };
}

function computeStackedTransform(
  layout: ManifestLayout,
  isVideo: boolean,
): TransformV2 {
  const { ratio, position, gap } = layout.split;
  const halfGap = gap / 2;

  // ratio is the percentage for the first panel
  const firstPct = ratio;
  const secondPct = 100 - ratio;

  const isFirst =
    (position === 'video-first' && isVideo) ||
    (position === 'visuals-first' && !isVideo);

  if (isFirst) {
    return {
      x: 0,
      y: 0,
      width: '100%',
      height: `${firstPct - halfGap}%`,
      rotation: 0,
      opacity: 1,
    };
  } else {
    return {
      x: 0,
      y: `${firstPct + halfGap}%`,
      width: '100%',
      height: `${secondPct - halfGap}%`,
      rotation: 0,
      opacity: 1,
    };
  }
}

// ---- Per-item migration helpers ----

function migrateVideoItem(
  item: ManifestItem,
  layout: ManifestLayout,
  globalVideoSettings: Manifest['videoSettings'],
  isSecondVideoTrack: boolean,
): ManifestItemV2 {
  const data = item.data as V1VideoData;

  let transform: TransformV2;
  let crop: { x: number; y: number; scale: number } | undefined;

  if (layout.mode === 'pip') {
    if (isSecondVideoTrack) {
      // PiP video gets pip transform
      transform = computePipTransform(layout);
      // pip crop → VideoItemData.crop
      const pipCrop = layout.pip.crop;
      crop = { x: pipCrop.cropX, y: pipCrop.cropY, scale: pipCrop.zoom };
    } else {
      // Main video = fullscreen
      transform = { ...FULLSCREEN_TRANSFORM };
      // Use per-item crop if non-default, else global videoSettings crop
      const itemCrop = data.crop;
      const isDefault =
        itemCrop.x === 50 && itemCrop.y === 50 && itemCrop.scale === 1;
      if (!isDefault) {
        crop = { x: itemCrop.x, y: itemCrop.y, scale: itemCrop.scale };
      } else {
        const gDefault =
          globalVideoSettings.cropX === 50 &&
          globalVideoSettings.cropY === 50 &&
          globalVideoSettings.scale === 1;
        if (!gDefault) {
          crop = {
            x: globalVideoSettings.cropX,
            y: globalVideoSettings.cropY,
            scale: globalVideoSettings.scale,
          };
        }
      }
    }
  } else if (layout.mode === 'stacked') {
    transform = computeStackedTransform(layout, true);
    const itemCrop = data.crop;
    const isDefault =
      itemCrop.x === 50 && itemCrop.y === 50 && itemCrop.scale === 1;
    if (!isDefault) {
      crop = { x: itemCrop.x, y: itemCrop.y, scale: itemCrop.scale };
    }
  } else {
    transform = { ...FULLSCREEN_TRANSFORM };
    const itemCrop = data.crop;
    const isDefault =
      itemCrop.x === 50 && itemCrop.y === 50 && itemCrop.scale === 1;
    if (!isDefault) {
      crop = { x: itemCrop.x, y: itemCrop.y, scale: itemCrop.scale };
    }
  }

  return {
    id: item.id,
    type: 'video',
    trackId: item.trackId,
    startMs: item.startMs,
    endMs: item.endMs,
    transform,
    keyframes: [],
    data: {
      src: data.src,
      startFrom: 0,
      volume: data.volume,
      playbackRate: data.playbackRate,
      ...(crop ? { crop } : {}),
    },
  };
}

function migrateAudioItem(item: ManifestItem): ManifestItemV2 {
  const data = item.data as V1AudioData;
  // Prefer enhancedSrc over src
  const src = data.enhancedSrc || data.src;

  return {
    id: item.id,
    type: 'audio',
    trackId: item.trackId,
    startMs: item.startMs,
    endMs: item.endMs,
    // No transform on audio items
    keyframes: [],
    data: {
      src,
      volume: data.volume,
      playbackRate: 1,
    },
  };
}

function migrateVisualItem(
  item: ManifestItem,
  layout: ManifestLayout,
): ManifestItemV2 {
  const data = item.data as V1VisualData;

  let transform: TransformV2;

  if (data.displayMode === 'fullscreen' || data.displayMode === 'default') {
    if (layout.mode === 'stacked') {
      transform = computeStackedTransform(layout, false);
    } else {
      transform = { ...FULLSCREEN_TRANSFORM };
    }
  } else if (data.displayMode === 'overlay') {
    switch (data.overlayZone) {
      case 'lower-third':
        transform = {
          x: 0,
          y: '70%',
          width: '100%',
          height: '30%',
          rotation: 0,
          opacity: 1,
        };
        break;
      case 'top':
        transform = {
          x: 0,
          y: 0,
          width: '100%',
          height: '30%',
          rotation: 0,
          opacity: 1,
        };
        break;
      case 'frame':
        transform = { ...FULLSCREEN_TRANSFORM };
        break;
      case 'background':
        transform = { ...FULLSCREEN_TRANSFORM };
        break;
      case 'behind':
        transform = { ...FULLSCREEN_TRANSFORM };
        break;
      case 'none':
      default:
        transform = { ...FULLSCREEN_TRANSFORM };
        break;
    }
  } else {
    transform = { ...FULLSCREEN_TRANSFORM };
  }

  return {
    id: item.id,
    type: 'scene',
    trackId: item.trackId,
    startMs: item.startMs,
    endMs: item.endMs,
    transform,
    keyframes: [],
    data: {
      sceneFile: data.sceneFile,
    },
  };
}

function migrateBrollItem(item: ManifestItem): ManifestItemV2 {
  const data = item.data as V1BrollData;
  const src = data.src || data.previewUrl || data.filename || '';

  return {
    id: item.id,
    type: 'video',
    trackId: item.trackId,
    startMs: item.startMs,
    endMs: item.endMs,
    transform: { ...FULLSCREEN_TRANSFORM },
    keyframes: [],
    data: {
      src,
      startFrom: 0,
      volume: data.volume ?? 1,
      playbackRate: 1,
    },
  };
}

function migrateCaptionItem(item: ManifestItem): ManifestItemV2 {
  const data = item.data as V1CaptionData;

  return {
    id: item.id,
    type: 'caption',
    trackId: item.trackId,
    startMs: item.startMs,
    endMs: item.endMs,
    transform: { ...FULLSCREEN_TRANSFORM },
    keyframes: [],
    data: {
      words: data.words,
    },
  };
}

function migrateTextItem(item: ManifestItem): ManifestItemV2 {
  const data = item.data as V1TextData;

  const style = data.style ?? {};
  const transform: TransformV2 = {
    x: data.position?.x ?? 0,
    y: data.position?.y ?? 0,
    width: data.size?.width != null ? `${data.size.width}%` : '100%',
    height: data.size?.height != null ? `${data.size.height}%` : '100%',
    rotation: 0,
    opacity: 1,
  };

  return {
    id: item.id,
    type: 'text',
    trackId: item.trackId,
    startMs: item.startMs,
    endMs: item.endMs,
    transform,
    keyframes: [],
    data: {
      text: data.text,
      fontFamily: (style.fontFamily as string) ?? 'Inter',
      fontSize: (style.fontSize as number) ?? 48,
      fontWeight: (style.fontWeight as number) ?? 600,
      color: (style.color as string) ?? '#FFFFFF',
      textAlign: ((style.textAlign as string) ?? 'center') as 'left' | 'center' | 'right',
      textTransform: ((style.textTransform as string) ?? 'none') as 'none' | 'uppercase' | 'lowercase',
    },
  };
}

function migrateImageItem(item: ManifestItem): ManifestItemV2 {
  const data = item.data as V1ImageData;

  const transform: TransformV2 = {
    x: data.position?.x ?? 0,
    y: data.position?.y ?? 0,
    width: data.width != null ? `${data.width}%` : '100%',
    height: data.height != null ? `${data.height}%` : '100%',
    rotation: 0,
    opacity: data.opacity ?? 1,
  };

  return {
    id: item.id,
    type: 'image',
    trackId: item.trackId,
    startMs: item.startMs,
    endMs: item.endMs,
    transform,
    keyframes: [],
    data: {
      src: data.src,
    },
  };
}

// ---- Main migration function ----

/**
 * Migrate a v1 manifest to v2 format.
 * Handles all v1 item types, layout modes, and settings.
 */
export function migrateManifestV1toV2(v1: Manifest): ManifestV2 {
  const layout = v1.layout;

  // Determine which video tracks exist, to identify "second video track" for PiP
  const videoTracks = v1.tracks.filter((t) => t.type === 'video');
  const secondVideoTrackId =
    layout.mode === 'pip' && videoTracks.length > 1
      ? videoTracks[1]!.id
      : null;

  // Migrate tracks
  const tracks: ManifestTrackV2[] = v1.tracks.map((t) => ({
    id: t.id,
    type: mapTrackType(t.type),
    name: t.name,
    position: t.position,
  }));

  // Migrate items
  const items: ManifestItemV2[] = v1.items.map((item) => {
    switch (item.type) {
      case 'video':
        return migrateVideoItem(
          item,
          layout,
          v1.videoSettings,
          item.trackId === secondVideoTrackId,
        );
      case 'audio':
        return migrateAudioItem(item);
      case 'visual':
        return migrateVisualItem(item, layout);
      case 'broll':
        return migrateBrollItem(item);
      case 'caption':
        return migrateCaptionItem(item);
      case 'text':
        return migrateTextItem(item);
      case 'image':
        return migrateImageItem(item);
      default:
        // Fallback: treat unknown types as scene
        return {
          id: item.id,
          type: 'scene' as const,
          trackId: item.trackId,
          startMs: item.startMs,
          endMs: item.endMs,
          transform: { ...FULLSCREEN_TRANSFORM },
          keyframes: [],
          data: { sceneFile: '' },
        };
    }
  });

  const raw = {
    version: 2 as const,
    fps: v1.fps,
    durationMs: v1.durationMs,
    canvas: v1.canvas,
    tracks,
    items,
    assets: {},
    captionStyle: v1.captionStyle,
    videoSettings: {
      sourceWidth: v1.videoSettings.sourceWidth,
      sourceHeight: v1.videoSettings.sourceHeight,
    },
  };

  // Validate through v2 schema
  return manifestV2Schema.parse(raw);
}
