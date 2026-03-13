import { z } from 'zod';
import { captionWordSchema, manifestCaptionStyleSchema } from './manifest.js';

// ---- Transform & Keyframes ----

export const transformSchema = z.object({
  x: z.union([z.number(), z.string()]).default(0),
  y: z.union([z.number(), z.string()]).default(0),
  width: z.union([z.number(), z.string()]).default('100%'),
  height: z.union([z.number(), z.string()]).default('100%'),
  rotation: z.number().default(0),
  opacity: z.number().min(0).max(1).default(1),
});

export const keyframeSchema = z.object({
  timeMs: z.number().min(0),
  props: transformSchema.partial(),
  easing: z.enum(['linear', 'ease-in', 'ease-out', 'ease-in-out', 'spring']).default('linear'),
});

export const filtersSchema = z.object({
  brightness: z.number().min(0).max(2).default(1),
  contrast: z.number().min(0).max(2).default(1),
  saturation: z.number().min(0).max(2).default(1),
  blur: z.number().min(0).default(0),
  hue: z.number().default(0),
  grayscale: z.number().min(0).max(1).default(0),
  sepia: z.number().min(0).max(1).default(0),
}).partial();

// ---- Track ----

export const trackTypeV2 = z.enum(['video', 'audio', 'overlay', 'caption']);

export const manifestTrackV2Schema = z.object({
  id: z.string(),
  type: trackTypeV2,
  name: z.string(),
  position: z.number().int(),
});

// ---- Item type data schemas ----

export const videoItemDataV2Schema = z.object({
  src: z.string(),
  startFrom: z.number().min(0).default(0),
  volume: z.number().min(0).max(2).default(1),
  playbackRate: z.number().min(0.25).max(4).default(1),
  fadeInMs: z.number().min(0).optional(),
  fadeOutMs: z.number().min(0).optional(),
  crop: z.object({
    x: z.number().min(0).max(100).default(50),
    y: z.number().min(0).max(100).default(50),
    scale: z.number().min(0.5).max(3).default(1),
  }).optional(),
});

export const audioItemDataV2Schema = z.object({
  src: z.string(),
  volume: z.number().min(0).max(2).default(1),
  playbackRate: z.number().min(0.25).max(4).default(1),
  fadeInMs: z.number().min(0).optional(),
  fadeOutMs: z.number().min(0).optional(),
});

export const textItemDataV2Schema = z.object({
  text: z.string(),
  fontFamily: z.string().default('Inter'),
  fontSize: z.number().min(1).default(48),
  fontWeight: z.number().min(100).max(900).default(600),
  color: z.string().default('#FFFFFF'),
  backgroundColor: z.string().optional(),
  borderRadius: z.number().optional(),
  padding: z.number().optional(),
  textAlign: z.enum(['left', 'center', 'right']).default('center'),
  lineHeight: z.number().optional(),
  letterSpacing: z.number().optional(),
  textTransform: z.enum(['none', 'uppercase', 'lowercase']).default('none'),
});

export const imageItemDataV2Schema = z.object({
  src: z.string(),
});

export const sceneItemDataV2Schema = z.object({
  sceneFile: z.string(),
});

export const shapeItemDataV2Schema = z.object({
  shape: z.enum(['rectangle', 'circle', 'line']),
  fill: z.string().default('#FFFFFF'),
  stroke: z.string().optional(),
  strokeWidth: z.number().optional(),
  borderRadius: z.number().optional(),
});

export const captionItemDataV2Schema = z.object({
  words: z.array(captionWordSchema),
});

// ---- Item (discriminated by type) ----

export const itemTypeV2 = z.enum(['video', 'audio', 'text', 'image', 'scene', 'caption', 'shape']);

const itemBaseV2 = {
  id: z.string(),
  trackId: z.string(),
  startMs: z.number().min(0),
  endMs: z.number().min(0),
  transform: transformSchema.optional(),
  keyframes: z.array(keyframeSchema).default([]),
  filters: filtersSchema.optional(),
};

export const manifestItemV2Schema = z.discriminatedUnion('type', [
  z.object({ ...itemBaseV2, type: z.literal('video'), data: videoItemDataV2Schema }),
  z.object({ ...itemBaseV2, type: z.literal('audio'), data: audioItemDataV2Schema }),
  z.object({ ...itemBaseV2, type: z.literal('text'), data: textItemDataV2Schema }),
  z.object({ ...itemBaseV2, type: z.literal('image'), data: imageItemDataV2Schema }),
  z.object({ ...itemBaseV2, type: z.literal('scene'), data: sceneItemDataV2Schema }),
  z.object({ ...itemBaseV2, type: z.literal('caption'), data: captionItemDataV2Schema }),
  z.object({ ...itemBaseV2, type: z.literal('shape'), data: shapeItemDataV2Schema }),
]);

// ---- Video Settings v2 (simplified — crop moved to per-item) ----

export const videoSettingsV2Schema = z.object({
  sourceWidth: z.number().default(1920),
  sourceHeight: z.number().default(1080),
});

// ---- Top-level Manifest v2 ----

export const manifestV2Schema = z.object({
  version: z.literal(2),
  fps: z.number().int().min(1).max(120).default(30),
  durationMs: z.number().min(0),
  canvas: z.object({
    width: z.number().int().min(1),
    height: z.number().int().min(1),
  }),
  tracks: z.array(manifestTrackV2Schema),
  items: z.array(manifestItemV2Schema),
  assets: z.record(z.string(), z.string()).default({}),
  captionStyle: manifestCaptionStyleSchema.default(() => ({
    displayMode: 'phrase' as const,
    wordsPerPhrase: 5,
    fontFamily: 'Inter',
    fontSize: 56,
    fontWeight: 800,
    color: '#FFFFFF',
    activeColor: '#FFD700',
    backgroundColor: 'transparent',
    activeBackgroundColor: 'transparent',
    animation: { in: 'elastic-pop', active: 'none', out: 'none', easing: 'spring' },
    position: { anchor: 'bottom' as const, offsetX: 0, offsetY: 0, textAlign: 'center' as const, rotation: 0 },
  })),
  videoSettings: videoSettingsV2Schema.default(() => ({
    sourceWidth: 1920,
    sourceHeight: 1080,
  })),
});

// ---- TypeScript types ----

export type ManifestV2 = z.infer<typeof manifestV2Schema>;
export type ManifestTrackV2 = z.infer<typeof manifestTrackV2Schema>;
export type ManifestItemV2 = z.infer<typeof manifestItemV2Schema>;
export type TransformV2 = z.infer<typeof transformSchema>;
export type KeyframeV2 = z.infer<typeof keyframeSchema>;
export type FiltersV2 = z.infer<typeof filtersSchema>;
export type ManifestTrackTypeV2 = z.infer<typeof trackTypeV2>;
export type ManifestItemTypeV2 = z.infer<typeof itemTypeV2>;

// Per-item data types
export type VideoItemDataV2 = z.infer<typeof videoItemDataV2Schema>;
export type AudioItemDataV2 = z.infer<typeof audioItemDataV2Schema>;
export type TextItemDataV2 = z.infer<typeof textItemDataV2Schema>;
export type ImageItemDataV2 = z.infer<typeof imageItemDataV2Schema>;
export type SceneItemDataV2 = z.infer<typeof sceneItemDataV2Schema>;
export type ShapeItemDataV2 = z.infer<typeof shapeItemDataV2Schema>;
export type CaptionItemDataV2 = z.infer<typeof captionItemDataV2Schema>;

// ---- Validation helpers ----

export function validateManifestV2(data: unknown): ManifestV2 {
  return manifestV2Schema.parse(data);
}

export function safeValidateManifestV2(data: unknown) {
  return manifestV2Schema.safeParse(data);
}
