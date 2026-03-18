import { z } from 'zod';

// ---- Shared schemas (used by manifest-v2 and other modules) ----

export const captionWordSchema = z.object({
  text: z.string(),
  startMs: z.number().min(0),
  endMs: z.number().min(0),
  classification: z.enum(['power', 'medium', 'filler']).optional(),
  styleOverrides: z.record(z.string(), z.unknown()).optional(),
});

export const manifestCaptionStyleSchema = z.object({
  displayMode: z.enum(['word-by-word', 'phrase', 'karaoke', 'dynamic-hierarchy']).default('phrase'),
  wordsPerPhrase: z.number().min(1).max(10).default(5),
  fontFamily: z.string().default('Inter'),
  fontSize: z.number().min(8).max(200).default(56),
  fontWeight: z.number().min(100).max(900).default(800),
  letterSpacing: z.number().optional(),
  textTransform: z.enum(['none', 'uppercase', 'lowercase']).optional(),
  opacity: z.number().min(0).max(1).optional(),
  lineHeight: z.number().optional(),
  color: z.string().default('#FFFFFF'),
  activeColor: z.string().default('#FFD700'),
  backgroundColor: z.string().default('transparent'),
  activeBackgroundColor: z.string().default('transparent'),
  backgroundPadding: z.object({ x: z.number(), y: z.number() }).optional(),
  backgroundRadius: z.number().optional(),
  stroke: z.object({ width: z.number(), color: z.string() }).nullable().optional(),
  animation: z.object({
    in: z.string(),
    active: z.string(),
    out: z.string(),
    easing: z.string(),
  }).default({ in: 'elastic-pop', active: 'none', out: 'none', easing: 'spring' }),
  position: z.object({
    anchor: z.enum(['top', 'center', 'bottom']).default('bottom'),
    offsetX: z.number().default(0),
    offsetY: z.number().default(0),
    textAlign: z.enum(['left', 'center', 'right']).default('center'),
    rotation: z.number().default(0),
  }).default(() => ({ anchor: 'bottom' as const, offsetX: 0, offsetY: 0, textAlign: 'center' as const, rotation: 0 })),
  effects: z.object({
    shadow: z.object({
      offsetX: z.number(), offsetY: z.number(),
      blur: z.number(), color: z.string(), opacity: z.number(),
    }).nullable().default(null),
    shadowSecondary: z.object({
      offsetX: z.number(), offsetY: z.number(),
      blur: z.number(), color: z.string(), opacity: z.number(),
    }).nullable().default(null),
    glow: z.object({
      enabled: z.boolean(), color: z.string(),
      intensity: z.number(), size: z.number(),
    }).nullable().default(null),
  }).optional(),
  presetId: z.string().nullable().optional(),
}).passthrough();

export type ManifestCaptionStyle = z.infer<typeof manifestCaptionStyleSchema>;
export type ManifestCaptionWord = z.infer<typeof captionWordSchema>;

// ---- Re-export v2 as canonical types ----
// Derived type for videoSettings (not explicitly exported from manifest-v2)
import { videoSettingsV2Schema } from './manifest-v2.js';
export type ManifestVideoSettings = z.infer<typeof videoSettingsV2Schema>;
// v2 IS the manifest format. These re-exports let consumers import from
// either './manifest' or './manifest-v2' interchangeably.

export {
  // Schemas
  transformSchema,
  keyframeSchema,
  filtersSchema,
  trackTypeV2 as trackType,
  manifestTrackV2Schema as manifestTrackSchema,
  videoItemDataV2Schema as videoItemDataSchema,
  audioItemDataV2Schema as audioItemDataSchema,
  textItemDataV2Schema as textItemDataSchema,
  imageItemDataV2Schema as imageItemDataSchema,
  sceneItemDataV2Schema as sceneItemDataSchema,
  shapeItemDataV2Schema as shapeItemDataSchema,
  captionItemDataV2Schema as captionItemDataSchema,
  itemTypeV2 as itemType,
  manifestItemV2Schema as manifestItemSchema,
  videoSettingsV2Schema as manifestVideoSettingsSchema,
  manifestV2Schema as manifestSchema,
  // Types
  type ManifestV2 as Manifest,
  type ManifestTrackV2 as ManifestTrack,
  type ManifestItemV2 as ManifestItem,
  type TransformV2 as Transform,
  type KeyframeV2 as Keyframe,
  type FiltersV2 as Filters,
  type ManifestTrackTypeV2 as ManifestTrackType,
  type ManifestItemTypeV2 as ManifestItemType,
  type VideoItemDataV2 as VideoItemData,
  type AudioItemDataV2 as AudioItemData,
  type TextItemDataV2 as TextItemData,
  type ImageItemDataV2 as ImageItemData,
  type SceneItemDataV2 as SceneItemData,
  type ShapeItemDataV2 as ShapeItemData,
  type CaptionItemDataV2 as CaptionItemData,
  // Validators
  validateManifestV2 as validateManifest,
  safeValidateManifestV2 as safeValidateManifest,
} from './manifest-v2.js';
