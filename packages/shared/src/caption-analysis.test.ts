import { describe, it, expect } from 'vitest';
import {
  wordDirectiveSchema,
  sentenceDirectiveSchema,
  emphasisMarkerSchema,
  captionAnalysisSchema,
  validateCaptionAnalysis,
} from './caption-analysis';

describe('wordDirectiveSchema', () => {
  it('accepts valid word directive', () => {
    const valid = {
      wordIndex: 0,
      tier: 'hero',
      fontRole: 'bold-sans',
      animation: 'elastic-pop',
      entryDelayMs: 150,
      colorRole: 'accent',
    };
    expect(wordDirectiveSchema.parse(valid)).toEqual(valid);
  });

  it('rejects invalid animation name', () => {
    const invalid = {
      wordIndex: 0,
      tier: 'hero',
      fontRole: 'bold-sans',
      animation: 'pop', // not a registered name
      entryDelayMs: 0,
      colorRole: 'primary',
    };
    expect(() => wordDirectiveSchema.parse(invalid)).toThrow();
  });

  it('accepts optional fields', () => {
    const withOptional = {
      wordIndex: 3,
      tier: 'accent',
      fontRole: 'elegant-cursive',
      animation: 'fade-rise',
      entryDelayMs: 0,
      colorRole: 'glow',
      textTransform: 'uppercase',
      scaleOverride: 2.8,
    };
    const parsed = wordDirectiveSchema.parse(withOptional);
    expect(parsed.textTransform).toBe('uppercase');
    expect(parsed.scaleOverride).toBe(2.8);
  });
});

describe('sentenceDirectiveSchema', () => {
  it('accepts valid sentence directive', () => {
    const valid = {
      wordRange: [0, 6],
      phraseGroups: [
        { wordIndices: [0, 1, 2], layout: 'single-line', alignment: 'center', durationMs: 800 },
        { wordIndices: [3], layout: 'stacked', alignment: 'center', durationMs: 1200 },
        { wordIndices: [4, 5], layout: 'split', alignment: 'center', durationMs: 1000 },
      ],
      mood: 'impactful',
    };
    expect(sentenceDirectiveSchema.parse(valid)).toEqual(valid);
  });

  it('accepts optional punctuationEffect', () => {
    const valid = {
      wordRange: [0, 3],
      phraseGroups: [{ wordIndices: [0, 1, 2], layout: 'cascade', alignment: 'left', durationMs: 1500 }],
      mood: 'curious',
      punctuationEffect: 'question-pop',
    };
    expect(sentenceDirectiveSchema.parse(valid).punctuationEffect).toBe('question-pop');
  });
});

describe('emphasisMarkerSchema', () => {
  it('accepts valid emphasis marker', () => {
    const valid = { wordIndex: 3, confidence: 0.85, type: 'slow-delivery', durationRatio: 2.1 };
    expect(emphasisMarkerSchema.parse(valid)).toEqual(valid);
  });
});

describe('captionAnalysisSchema', () => {
  it('accepts full analysis object', () => {
    const valid = {
      words: [{ wordIndex: 0, tier: 'normal', fontRole: 'default', animation: 'fade-rise', entryDelayMs: 0, colorRole: 'primary' }],
      sentences: [{ wordRange: [0, 1], phraseGroups: [{ wordIndices: [0], layout: 'single-line', alignment: 'center', durationMs: 1000 }], mood: 'calm' }],
      speakerEmphasis: [],
      metadata: { analyzedAt: '2026-03-22T00:00:00Z', model: 'gpt-4o-mini', version: 1 },
    };
    expect(() => captionAnalysisSchema.parse(valid)).not.toThrow();
  });
});

describe('validateCaptionAnalysis', () => {
  it('returns valid for correct analysis', () => {
    const analysis = {
      words: [
        { wordIndex: 0, tier: 'whisper' as const, fontRole: 'default' as const, animation: 'fade' as const, entryDelayMs: 0, colorRole: 'primary' as const },
        { wordIndex: 1, tier: 'hero' as const, fontRole: 'bold-sans' as const, animation: 'elastic-pop' as const, entryDelayMs: 150, colorRole: 'accent' as const },
      ],
      sentences: [{ wordRange: [0, 2] as [number, number], phraseGroups: [{ wordIndices: [0, 1], layout: 'stacked' as const, alignment: 'center' as const, durationMs: 1000 }], mood: 'dramatic' as const }],
      speakerEmphasis: [],
      metadata: { analyzedAt: '2026-03-22T00:00:00Z', model: 'gpt-4o-mini', version: 1 },
    };
    expect(validateCaptionAnalysis(analysis, 2).valid).toBe(true);
  });

  it('detects out-of-bounds wordIndex', () => {
    const analysis = {
      words: [{ wordIndex: 5, tier: 'normal' as const, fontRole: 'default' as const, animation: 'fade' as const, entryDelayMs: 0, colorRole: 'primary' as const }],
      sentences: [{ wordRange: [0, 1] as [number, number], phraseGroups: [{ wordIndices: [0], layout: 'single-line' as const, alignment: 'center' as const, durationMs: 1000 }], mood: 'calm' as const }],
      speakerEmphasis: [],
      metadata: { analyzedAt: '2026-03-22T00:00:00Z', model: 'gpt-4o-mini', version: 1 },
    };
    const result = validateCaptionAnalysis(analysis, 2);
    expect(result.valid).toBe(false);
  });

  it('detects duplicate wordIndex', () => {
    const analysis = {
      words: [
        { wordIndex: 0, tier: 'normal' as const, fontRole: 'default' as const, animation: 'fade' as const, entryDelayMs: 0, colorRole: 'primary' as const },
        { wordIndex: 0, tier: 'hero' as const, fontRole: 'bold-sans' as const, animation: 'elastic-pop' as const, entryDelayMs: 0, colorRole: 'accent' as const },
      ],
      sentences: [{ wordRange: [0, 1] as [number, number], phraseGroups: [{ wordIndices: [0], layout: 'single-line' as const, alignment: 'center' as const, durationMs: 1000 }], mood: 'calm' as const }],
      speakerEmphasis: [],
      metadata: { analyzedAt: '2026-03-22T00:00:00Z', model: 'gpt-4o-mini', version: 1 },
    };
    const result = validateCaptionAnalysis(analysis, 1);
    expect(result.valid).toBe(false);
  });
});
