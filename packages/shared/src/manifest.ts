// ---- Re-export shared schemas so existing consumers of './manifest' still work ----
export { captionWordSchema, manifestCaptionStyleSchema } from './manifest-shared.js';
export type { ManifestCaptionStyle, ManifestCaptionWord } from './manifest-shared.js';

// ---- Re-export v2 as canonical types ----
// Derived type for videoSettings (not explicitly exported from manifest-v2)
import { z } from 'zod';
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
