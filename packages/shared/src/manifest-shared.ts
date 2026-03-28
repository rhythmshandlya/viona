import { z } from 'zod';

// ---- Shared schemas (used by both manifest.ts and manifest-v2.ts) ----
// Extracted to break circular dependency between those two modules.

export const captionWordSchema = z.object({
  text: z.string(),
  startMs: z.number().min(0),
  endMs: z.number().min(0),
  role: z.string().optional(),
  // Kept for backwards compatibility during migration
  classification: z.enum(['power', 'medium', 'filler']).optional(),
  styleOverrides: z.record(z.string(), z.unknown()).optional(),
});

export const manifestCaptionPresetSchema = z.object({
  displayMode: z.enum(['word-by-word', 'phrase', 'karaoke', 'poster-staircase']).default('phrase'),
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
  wordEmphasis: z.object({
    enabled: z.boolean(),
    roles: z.record(z.string(), z.object({
      fontFamily: z.string().optional(),
      fontSize: z.number().optional(),
      fontWeight: z.number().optional(),
      color: z.string().optional(),
      activeColor: z.string().optional(),
      scale: z.number().optional(),
      letterSpacing: z.number().optional(),
      textTransform: z.enum(['none', 'uppercase', 'lowercase']).optional(),
      emphasisBg: z.string().optional(),
    })),
  }).optional(),
  presetId: z.string().nullable().optional(),
  useCinematicRenderer: z.boolean().optional(),
  cinematicFonts: z.object({
    boldSans: z.string(),
    elegantCursive: z.string(),
    default: z.string(),
  }).optional(),
  cinematicColors: z.object({
    primary: z.string(),
    accent: z.string(),
    accentGradient: z.string().optional(),
    glow: z.string(),
  }).optional(),
  cinematicScales: z.object({
    hero: z.number(),
    accent: z.number(),
    normal: z.number(),
    whisper: z.number(),
  }).optional(),
  // Poster staircase alignment variant
  staircaseAlignment: z.enum(['center', 'left', 'stagger', 'bold-stack', 'impact', 'single', 'scattered']).optional(),
}).passthrough();

/** @deprecated Use `manifestCaptionPresetSchema` instead */
export const manifestCaptionStyleSchema = manifestCaptionPresetSchema;

export type ManifestCaptionPreset = z.infer<typeof manifestCaptionPresetSchema>;
/** @deprecated Use `ManifestCaptionPreset` instead */
export type ManifestCaptionStyle = ManifestCaptionPreset;
export type ManifestCaptionWord = z.infer<typeof captionWordSchema>;
