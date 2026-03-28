import { z } from 'zod';

// --- Enums ---

export const cinematicTierEnum = z.enum(['hero', 'accent', 'normal', 'whisper']);
export type CinematicTier = z.infer<typeof cinematicTierEnum>;

export const fontRoleEnum = z.enum(['bold-sans', 'elegant-cursive', 'default']);
export type FontRole = z.infer<typeof fontRoleEnum>;

// Only registered animation names from packages/renderer/src/animations/animations.ts
export const cinematicAnimationEnum = z.enum([
  'elastic-pop', 'slide-up', 'blur-zoom', 'bounce-up',
  'typewriter', 'fade-rise', 'slam-down',
  'scale-bounce', 'fade', 'none',
]);

export const colorRoleEnum = z.enum(['primary', 'accent', 'glow']);
export type ColorRole = z.infer<typeof colorRoleEnum>;

export const phraseLayoutEnum = z.enum(['single-line', 'stacked', 'split', 'cascade']);
export type PhraseLayout = z.infer<typeof phraseLayoutEnum>;

export const moodEnum = z.enum(['dramatic', 'urgent', 'curious', 'calm', 'impactful']);

export const punctuationEffectEnum = z.enum(['question-pop', 'exclaim-shake', 'ellipsis-fade', 'none']);

export const emphasisTypeEnum = z.enum(['slow-delivery', 'pause-before', 'pause-after', 'pace-change']);

// --- Schemas ---

export const wordDirectiveSchema = z.object({
  wordIndex: z.number().int().min(0),
  tier: cinematicTierEnum,
  fontRole: fontRoleEnum,
  animation: cinematicAnimationEnum,
  entryDelayMs: z.number().min(0).max(500),
  colorRole: colorRoleEnum,
  textTransform: z.enum(['uppercase', 'none']).optional(),
  scaleOverride: z.number().min(0.1).max(10).optional(),
});
export type WordDirective = z.infer<typeof wordDirectiveSchema>;

export const phraseGroupSchema = z.object({
  wordIndices: z.array(z.number().int().min(0)),
  layout: phraseLayoutEnum,
  alignment: z.enum(['center', 'left', 'right']),
  durationMs: z.number().min(100).max(5000),
});

export const sentenceDirectiveSchema = z.object({
  wordRange: z.tuple([z.number().int().min(0), z.number().int().min(0)]),
  phraseGroups: z.array(phraseGroupSchema).min(1),
  mood: moodEnum,
  punctuationEffect: punctuationEffectEnum.optional(),
});
export type SentenceDirective = z.infer<typeof sentenceDirectiveSchema>;

export const emphasisMarkerSchema = z.object({
  wordIndex: z.number().int().min(0),
  confidence: z.number().min(0).max(1),
  type: emphasisTypeEnum,
  durationRatio: z.number().min(0),
});
export type EmphasisMarker = z.infer<typeof emphasisMarkerSchema>;

export const captionAnalysisMetadataSchema = z.object({
  analyzedAt: z.string(),
  model: z.string(),
  version: z.number().int(),
});

export const captionAnalysisSchema = z.object({
  words: z.array(wordDirectiveSchema),
  sentences: z.array(sentenceDirectiveSchema),
  speakerEmphasis: z.array(emphasisMarkerSchema),
  metadata: captionAnalysisMetadataSchema,
});
export type CaptionAnalysis = z.infer<typeof captionAnalysisSchema>;

// --- Validation ---

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateCaptionAnalysis(
  analysis: CaptionAnalysis,
  wordCount: number,
): ValidationResult {
  const errors: string[] = [];

  // 1. Check wordIndex bounds
  for (const w of analysis.words) {
    if (w.wordIndex < 0 || w.wordIndex >= wordCount) {
      errors.push(`wordIndex ${w.wordIndex} out of bounds [0, ${wordCount})`);
    }
  }

  // 2. Check duplicate wordIndex
  const seen = new Set<number>();
  for (const w of analysis.words) {
    if (seen.has(w.wordIndex)) {
      errors.push(`duplicate wordIndex ${w.wordIndex}`);
    }
    seen.add(w.wordIndex);
  }

  // 3. Check sentence wordRange coverage (no overlaps)
  const covered = new Set<number>();
  for (const s of analysis.sentences) {
    const [start, end] = s.wordRange;
    for (let i = start; i < end; i++) {
      if (covered.has(i)) {
        errors.push(`word index ${i} covered by multiple sentences`);
      }
      covered.add(i);
    }
  }

  // 4. Check phraseGroup indices within wordRange
  for (const s of analysis.sentences) {
    const [start, end] = s.wordRange;
    for (const pg of s.phraseGroups) {
      for (const idx of pg.wordIndices) {
        if (idx < start || idx >= end) {
          errors.push(`phraseGroup index ${idx} outside wordRange [${start}, ${end})`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// --- Defaults ---

export const DEFAULT_WORD_DIRECTIVE: Omit<WordDirective, 'wordIndex'> = {
  tier: 'normal',
  fontRole: 'default',
  animation: 'fade-rise',
  entryDelayMs: 0,
  colorRole: 'primary',
};
