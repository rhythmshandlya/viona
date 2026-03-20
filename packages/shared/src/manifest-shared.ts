import { z } from 'zod';

// ---- Shared schemas (used by both manifest.ts and manifest-v2.ts) ----
// Extracted to break circular dependency between those two modules.

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
