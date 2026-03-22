import { describe, it, expect } from 'vitest';
import { detectSpeakerEmphasis, formatWordsForLLM, validateAndRepairAnalysis } from './analyze-captions';

const makeWord = (text: string, startMs: number, endMs: number) => ({ text, startMs, endMs });

describe('detectSpeakerEmphasis', () => {
  it('detects slow delivery', () => {
    const words = [
      makeWord('She', 0, 200),
      makeWord('built', 200, 400),
      makeWord('an', 400, 500),
      makeWord('empire', 500, 1100), // 600ms, ~3x avg
      makeWord('from', 1100, 1300),
      makeWord('nothing', 1300, 1500),
    ];
    const markers = detectSpeakerEmphasis(words);
    const slowMarkers = markers.filter(m => m.type === 'slow-delivery');
    expect(slowMarkers.some(m => m.wordIndex === 3)).toBe(true);
  });

  it('detects pause-before', () => {
    const words = [
      makeWord('She', 0, 200),
      makeWord('built', 200, 400),
      makeWord('empire', 900, 1100), // 500ms gap before
      makeWord('from', 1100, 1300),
    ];
    const markers = detectSpeakerEmphasis(words);
    const pauseMarkers = markers.filter(m => m.type === 'pause-before');
    expect(pauseMarkers.some(m => m.wordIndex === 2)).toBe(true);
  });

  it('detects pause-after', () => {
    const words = [
      makeWord('empire', 0, 200),
      makeWord('from', 800, 1000), // 600ms gap after empire
    ];
    const markers = detectSpeakerEmphasis(words);
    const pauseMarkers = markers.filter(m => m.type === 'pause-after');
    expect(pauseMarkers.some(m => m.wordIndex === 0)).toBe(true);
  });

  it('returns empty array for uniform speech', () => {
    const words = [
      makeWord('the', 0, 200),
      makeWord('cat', 200, 400),
      makeWord('sat', 400, 600),
      makeWord('down', 600, 800),
    ];
    const markers = detectSpeakerEmphasis(words);
    expect(markers.length).toBe(0);
  });

  it('assigns confidence based on deviation magnitude', () => {
    const words = [
      makeWord('a', 0, 100),
      makeWord('b', 100, 200),
      makeWord('c', 200, 300),
      makeWord('SLOW', 300, 900), // 600ms, 6x avg of 100ms
      makeWord('d', 900, 1000),
    ];
    const markers = detectSpeakerEmphasis(words);
    const slow = markers.find(m => m.wordIndex === 3 && m.type === 'slow-delivery');
    expect(slow).toBeDefined();
    expect(slow!.confidence).toBeGreaterThan(0.5);
  });
});

describe('formatWordsForLLM', () => {
  it('formats words with emphasis markers', () => {
    const words = [makeWord('She', 0, 180), makeWord('empire', 200, 680)];
    const emphasis = [{ wordIndex: 1, confidence: 0.9, type: 'slow-delivery' as const, durationRatio: 2.1 }];
    const result = formatWordsForLLM(words, emphasis);
    expect(result).toContain('0 | She | 180');
    expect(result).toContain('1 | empire | 480');
    expect(result).toContain('slow-delivery');
  });

  it('shows dash for words without emphasis', () => {
    const words = [makeWord('the', 0, 100), makeWord('cat', 100, 200)];
    const result = formatWordsForLLM(words, []);
    expect(result).toContain('0 | the | 100');
    expect(result).toContain('1 | cat | 100');
    // No emphasis markers — should show dash
    expect(result).toContain('—');
  });
});

describe('validateAndRepairAnalysis', () => {
  it('fills missing word directives with defaults', () => {
    const analysis = {
      words: [{ wordIndex: 0, tier: 'hero' as const, fontRole: 'bold-sans' as const, animation: 'elastic-pop' as const, entryDelayMs: 0, colorRole: 'accent' as const }],
      sentences: [{ wordRange: [0, 3] as [number, number], phraseGroups: [{ wordIndices: [0, 1, 2], layout: 'single-line' as const, alignment: 'center' as const, durationMs: 1000 }], mood: 'calm' as const }],
      speakerEmphasis: [] as any[],
      metadata: { analyzedAt: '2026-01-01T00:00:00Z', model: 'gpt-4o-mini', version: 1 },
    };
    const repaired = validateAndRepairAnalysis(analysis, 3);
    expect(repaired.words.length).toBe(3);
    expect(repaired.words[1].tier).toBe('normal');
    expect(repaired.words[2].tier).toBe('normal');
  });

  it('clamps out-of-bounds wordIndex', () => {
    const analysis = {
      words: [{ wordIndex: 99, tier: 'hero' as const, fontRole: 'bold-sans' as const, animation: 'elastic-pop' as const, entryDelayMs: 0, colorRole: 'accent' as const }],
      sentences: [{ wordRange: [0, 2] as [number, number], phraseGroups: [{ wordIndices: [0, 1], layout: 'single-line' as const, alignment: 'center' as const, durationMs: 1000 }], mood: 'calm' as const }],
      speakerEmphasis: [] as any[],
      metadata: { analyzedAt: '2026-01-01T00:00:00Z', model: 'gpt-4o-mini', version: 1 },
    };
    const repaired = validateAndRepairAnalysis(analysis, 2);
    expect(repaired.words.every(w => w.wordIndex >= 0 && w.wordIndex < 2)).toBe(true);
    expect(repaired.words.length).toBe(2);
  });

  it('deduplicates word directives keeping first occurrence', () => {
    const analysis = {
      words: [
        { wordIndex: 0, tier: 'hero' as const, fontRole: 'bold-sans' as const, animation: 'elastic-pop' as const, entryDelayMs: 0, colorRole: 'accent' as const },
        { wordIndex: 0, tier: 'normal' as const, fontRole: 'default' as const, animation: 'fade-rise' as const, entryDelayMs: 0, colorRole: 'primary' as const },
      ],
      sentences: [],
      speakerEmphasis: [] as any[],
      metadata: { analyzedAt: '2026-01-01T00:00:00Z', model: 'gpt-4o-mini', version: 1 },
    };
    const repaired = validateAndRepairAnalysis(analysis, 2);
    expect(repaired.words.filter(w => w.wordIndex === 0).length).toBe(1);
    expect(repaired.words.find(w => w.wordIndex === 0)?.tier).toBe('hero');
  });

  it('sorts word directives by wordIndex', () => {
    const analysis = {
      words: [
        { wordIndex: 2, tier: 'hero' as const, fontRole: 'bold-sans' as const, animation: 'elastic-pop' as const, entryDelayMs: 0, colorRole: 'accent' as const },
        { wordIndex: 0, tier: 'accent' as const, fontRole: 'default' as const, animation: 'slide-up' as const, entryDelayMs: 0, colorRole: 'primary' as const },
      ],
      sentences: [],
      speakerEmphasis: [] as any[],
      metadata: { analyzedAt: '2026-01-01T00:00:00Z', model: 'gpt-4o-mini', version: 1 },
    };
    const repaired = validateAndRepairAnalysis(analysis, 3);
    expect(repaired.words[0].wordIndex).toBe(0);
    expect(repaired.words[1].wordIndex).toBe(1);
    expect(repaired.words[2].wordIndex).toBe(2);
  });
});
