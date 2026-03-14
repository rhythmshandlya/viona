import { z } from 'zod';

// ---- Zod schemas ----

export const manifestTrackSchema = z.object({
  id: z.string(),
  type: z.enum(['video', 'audio', 'visual', 'caption', 'broll', 'text', 'image']),
  name: z.string(),
  position: z.number().int(),
});

export const transitionConfigSchema = z.object({
  type: z.enum(['cut', 'crossfade', 'slide-left', 'slide-up', 'zoom', 'morph', 'fade']),
  durationMs: z.number().min(0).max(2000),
});

export const visualItemDataSchema = z.object({
  sceneFile: z.string(),
  displayMode: z.enum(['default', 'fullscreen', 'overlay']),
  frameOffset: z.number().int().min(0).default(0),
  transition: z.object({
    enter: transitionConfigSchema.optional(),
    exit: transitionConfigSchema.optional(),
  }).optional(),
  overlayZone: z.enum(['behind', 'lower-third', 'top', 'frame', 'background', 'none']).optional(),
  speakerBbox: z.object({
    x: z.number(), y: z.number(), w: z.number(), h: z.number(),
  }).optional(),
});

export const videoItemDataSchema = z.object({
  src: z.string(),
  crop: z.object({
    x: z.number().min(0).max(100),
    y: z.number().min(0).max(100),
    scale: z.number().min(0.5).max(3),
  }),
  volume: z.number().min(0).max(2).default(1),
  playbackRate: z.number().min(0.25).max(4).default(1),
});

export const audioItemDataSchema = z.object({
  src: z.string(),
  volume: z.number().min(0).max(2).default(1),
  enhancedSrc: z.string().nullable().default(null),
});

export const captionWordSchema = z.object({
  text: z.string(),
  startMs: z.number().min(0),
  endMs: z.number().min(0),
  classification: z.enum(['power', 'medium', 'filler']).optional(),
  styleOverrides: z.record(z.string(), z.unknown()).optional(),
});

export const captionItemDataSchema = z.object({
  words: z.array(captionWordSchema),
});

export const brollItemDataSchema = z.object({
  sourceType: z.enum(['upload', 'pexels']).default('upload'),
  src: z.string(),
  filename: z.string().optional(),
  photographer: z.string().optional(),
  previewUrl: z.string().optional(),
  volume: z.number().min(0).max(2).default(1),
});

export const textItemDataSchema = z.object({
  text: z.string(),
  style: z.record(z.string(), z.unknown()).optional(),
  position: z.object({ x: z.number(), y: z.number() }).optional(),
  size: z.object({ width: z.number(), height: z.number() }).optional(),
});

export const imageItemDataSchema = z.object({
  src: z.string(),
  width: z.number().optional(),
  height: z.number().optional(),
  position: z.object({ x: z.number(), y: z.number() }).optional(),
  opacity: z.number().min(0).max(1).default(1),
});

export const manifestItemSchema = z.object({
  id: z.string(),
  type: z.enum(['video', 'audio', 'visual', 'caption', 'broll', 'text', 'image']),
  trackId: z.string(),
  startMs: z.number().min(0),
  endMs: z.number().min(0),
  data: z.union([
    visualItemDataSchema,
    videoItemDataSchema,
    audioItemDataSchema,
    captionItemDataSchema,
    brollItemDataSchema,
    textItemDataSchema,
    imageItemDataSchema,
  ]),
});

// DB JSONB can store numbers as strings — use z.coerce.number() for all numeric pip fields
export const manifestPiPSettingsSchema = z.object({
  position: z.enum(['top-left', 'top-right', 'bottom-left', 'bottom-right']),
  offsetX: z.coerce.number().default(0),
  offsetY: z.coerce.number().default(0),
  size: z.coerce.number().min(5).max(50).default(25),
  shape: z.enum(['square', 'circle', 'rounded']).default('circle'),
  borderRadius: z.coerce.number().default(9999),
  borderWidth: z.coerce.number().default(2),
  borderColor: z.string().default('#FFFFFF'),
  shadowEnabled: z.boolean().default(true),
  shadowColor: z.string().default('#000000'),
  shadowBlur: z.coerce.number().default(10),
  opacity: z.coerce.number().min(0).max(1).default(1),
  rotation: z.coerce.number().default(0),
  crop: z.object({
    cropX: z.coerce.number().min(0).max(100).default(50),
    cropY: z.coerce.number().min(0).max(100).default(50),
    zoom: z.coerce.number().min(0.5).max(3).default(1),
  }).default(() => ({ cropX: 50, cropY: 50, zoom: 1 })),
});

export const manifestSplitSettingsSchema = z.object({
  position: z.enum(['visuals-first', 'video-first']).default('visuals-first'),
  ratio: z.number().min(0).max(100).default(50),
  gap: z.number().min(0).default(0),
});

export const manifestLayoutSchema = z.object({
  mode: z.enum(['pip', 'stacked']).default('stacked'),
  split: manifestSplitSettingsSchema.default(() => ({ position: 'visuals-first' as const, ratio: 50, gap: 0 })),
  pip: manifestPiPSettingsSchema.default(() => ({
    position: 'bottom-right' as const,
    offsetX: 0, offsetY: 0, size: 25,
    shape: 'circle' as const, borderRadius: 9999, borderWidth: 2,
    borderColor: '#FFFFFF', shadowEnabled: true, shadowColor: '#000000',
    shadowBlur: 10, opacity: 1, rotation: 0,
    crop: { cropX: 50, cropY: 50, zoom: 1 },
  })),
});

// CaptionStyle uses the existing SubtitleStyle interface from types/index.ts
// We define a permissive Zod schema here for validation; the TypeScript type is the authority
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
}).passthrough(); // passthrough allows future fields without breaking validation

export const manifestVideoSettingsSchema = z.object({
  cropX: z.number().min(0).max(100).default(50),
  cropY: z.number().min(0).max(100).default(50),
  scale: z.number().min(0.5).max(3).default(1),
  sourceWidth: z.number().default(1920),
  sourceHeight: z.number().default(1080),
});

export const manifestSchema = z.object({
  version: z.literal(1),
  fps: z.number().int().min(1).max(120).default(30),
  durationMs: z.number().min(0),
  canvas: z.object({
    width: z.number().int().min(1),
    height: z.number().int().min(1),
  }),
  tracks: z.array(manifestTrackSchema),
  items: z.array(manifestItemSchema),
  layout: manifestLayoutSchema.default(() => ({
    mode: 'stacked' as const,
    split: { position: 'visuals-first' as const, ratio: 50, gap: 0 },
    pip: {
      position: 'bottom-right' as const,
      offsetX: 0, offsetY: 0, size: 25,
      shape: 'circle' as const, borderRadius: 9999, borderWidth: 2,
      borderColor: '#FFFFFF', shadowEnabled: true, shadowColor: '#000000',
      shadowBlur: 10, opacity: 1, rotation: 0,
      crop: { cropX: 50, cropY: 50, zoom: 1 },
    },
  })),
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
  videoSettings: manifestVideoSettingsSchema.default(() => ({
    cropX: 50, cropY: 50, scale: 1, sourceWidth: 1920, sourceHeight: 1080,
  })),
});

// ---- TypeScript types ----

export type ManifestTrack = z.infer<typeof manifestTrackSchema>;
export type ManifestItem = z.infer<typeof manifestItemSchema>;
export type ManifestLayout = z.infer<typeof manifestLayoutSchema>;
export type ManifestCaptionStyle = z.infer<typeof manifestCaptionStyleSchema>;
export type ManifestVideoSettings = z.infer<typeof manifestVideoSettingsSchema>;
export type Manifest = z.infer<typeof manifestSchema>;

export type ManifestVisualItemData = z.infer<typeof visualItemDataSchema>;
export type ManifestVideoItemData = z.infer<typeof videoItemDataSchema>;
export type ManifestAudioItemData = z.infer<typeof audioItemDataSchema>;
export type ManifestCaptionItemData = z.infer<typeof captionItemDataSchema>;
export type ManifestCaptionWord = z.infer<typeof captionWordSchema>;
export type TransitionConfig = z.infer<typeof transitionConfigSchema>;

export type ManifestItemType = ManifestItem['type'];
export type ManifestTrackType = ManifestTrack['type'];
export type SceneTransitionType = TransitionConfig['type'];

// ---- Validation helpers ----

export function validateManifest(data: unknown): Manifest {
  return manifestSchema.parse(data);
}

export function safeValidateManifest(data: unknown) {
  return manifestSchema.safeParse(data);
}
