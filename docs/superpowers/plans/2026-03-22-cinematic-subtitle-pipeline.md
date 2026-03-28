# Cinematic Subtitle Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an AI-powered cinematic subtitle pipeline that analyzes transcripts and produces per-word/per-sentence cinematic directives consumed by a new renderer component.

**Architecture:** A new `analyze-captions` worker job runs after every transcription, producing `captionAnalysis` data stored in the manifest. A new `CinematicSubtitle` Remotion component renders subtitles using this analysis when the selected preset opts in via `useCinematicRenderer: true`. The analysis layer is parallel to existing word data — existing presets and renderers are unchanged.

**Tech Stack:** TypeScript, Zod, Remotion, BullMQ, OpenAI GPT-4o-mini, Vitest

**Spec:** `docs/superpowers/specs/2026-03-22-cinematic-subtitle-pipeline-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `packages/shared/src/caption-analysis.ts` | Types + Zod schemas for CaptionAnalysis, WordDirective, SentenceDirective, EmphasisMarker |
| `packages/shared/src/caption-analysis.test.ts` | Validation and schema tests |
| `packages/worker/src/processors/analyze-captions.ts` | Worker job: emphasis detection + LLM passes + validation + manifest write |
| `packages/worker/src/processors/analyze-captions.test.ts` | Tests for emphasis detection and validation logic |
| `packages/renderer/src/components/CinematicWord.tsx` | Per-word renderer: font, scale, animation, delay, color, effects |
| `packages/renderer/src/components/PhraseLayout.tsx` | 4 layout modes: single-line, stacked, split, cascade |
| `packages/renderer/src/components/CinematicSubtitle.tsx` | Root component: finds active phrase, manages transitions |

### Modified Files
| File | Change |
|------|--------|
| `packages/shared/src/manifest-v2.ts:142-170` | Add `captionAnalysis` optional field to manifestV2Schema |
| `packages/shared/src/manifest-ops.ts:7-65` | Add `update_caption_analysis` op; handle in `applyManifestOp` (lines 71-200) |
| `packages/shared/src/manifest-convert.ts:76-357,362-443` | Read/write `captionAnalysis` from/to `videoSettings` JSONB in `dbToManifest()` and `syncManifestToDb()` |
| `packages/shared/src/manifest-shared.ts:16-75` | Add 4 optional cinematic fields to `manifestCaptionPresetSchema` |
| `apps/web/src/lib/subtitle-presets.ts:29-67,369,371-381` | Add cinematic fields to SubtitlePreset interface, add "Cinematic Luxe" preset, add to PRESET_ORDER |
| `packages/worker/src/processors/transcribe.ts:699-711` | Queue `analyze-captions` job after transcription completes |
| `packages/worker/src/index.ts:49+` | Register `analyze-captions` worker |
| `packages/api/src/workspace/workspace-codegen.ts:210-250` | Embed captionAnalysis, conditional CinematicSubtitle import, copy components |

---

### Task 1: Shared Types + Zod Schemas

**Files:**
- Create: `packages/shared/src/caption-analysis.ts`
- Create: `packages/shared/src/caption-analysis.test.ts`

- [ ] **Step 1: Write the test file for Zod schemas**

```typescript
// packages/shared/src/caption-analysis.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/shared && npx vitest run src/caption-analysis.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement shared types + Zod schemas + validation**

```typescript
// packages/shared/src/caption-analysis.ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/shared && npx vitest run src/caption-analysis.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/caption-analysis.ts packages/shared/src/caption-analysis.test.ts
git commit -m "feat: add shared caption analysis types, Zod schemas, and validation"
```

---

### Task 2: Manifest Schema Extension

**Files:**
- Modify: `packages/shared/src/manifest-v2.ts:142-174`
- Modify: `packages/shared/src/manifest-ops.ts:7-67,71-200`
- Modify: `packages/shared/src/manifest-shared.ts:16-75`

- [ ] **Step 1: Add captionAnalysis to manifestV2Schema**

In `packages/shared/src/manifest-v2.ts`, import `captionAnalysisSchema` from `./caption-analysis` and add it as an optional field to `manifestV2Schema` (before the closing of the z.object at ~line 170):

```typescript
captionAnalysis: z.record(z.string(), captionAnalysisSchema).optional(),
```

Also update the `ManifestV2` TypeScript type (line 174) to include:
```typescript
captionAnalysis?: Record<string, CaptionAnalysis>
```

- [ ] **Step 2: Add update_caption_analysis manifest op**

In `packages/shared/src/manifest-ops.ts`, add to the `manifestOpSchema` discriminated union (after the last op at ~line 65):

```typescript
z.object({
  op: z.literal('update_caption_analysis'),
  captionAnalysis: z.record(z.string(), captionAnalysisSchema),
}),
```

Add handling in `applyManifestOp()` (in the switch/if chain, ~lines 71-200):

```typescript
case 'update_caption_analysis':
  manifest.captionAnalysis = op.captionAnalysis;
  break;
```

- [ ] **Step 3: Add cinematic preset fields to manifestCaptionPresetSchema**

In `packages/shared/src/manifest-shared.ts`, add 4 optional fields to `manifestCaptionPresetSchema` (before `.passthrough()` at line 75):

```typescript
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
```

- [ ] **Step 4: Verify existing tests still pass**

Run: `cd packages/shared && npx vitest run`
Expected: All existing tests PASS (no regressions)

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/manifest-v2.ts packages/shared/src/manifest-ops.ts packages/shared/src/manifest-shared.ts
git commit -m "feat: extend manifest schema with captionAnalysis field and cinematic preset options"
```

---

### Task 3: Manifest DB Persistence

**Files:**
- Modify: `packages/shared/src/manifest-convert.ts:76-357,362-443`

- [ ] **Step 1: Add captionAnalysis to dbToManifest()**

In `packages/shared/src/manifest-convert.ts`, in the `dbToManifest()` function. The raw manifest object is constructed at ~lines 338-354 and then parsed at line 356 (`return manifestV2Schema.parse(raw)`). Add `captionAnalysis` inside the `raw` object literal (at ~line 348, alongside other top-level fields):

```typescript
// Inside the raw object literal at ~line 348 (before the closing })
captionAnalysis: (project.videoSettings as any)?.captionAnalysis ?? undefined,
```

- [ ] **Step 2: Add captionAnalysis to syncManifestToDb()**

In `manifestToDb()` (~line 362), the `videoSettings` object is built at ~lines 430-440. Add `captionAnalysis` inside that object literal (at ~line 439, alongside `captionStyle`):

```typescript
// Inside the videoSettings object literal at ~line 439
captionAnalysis: manifest.captionAnalysis ?? undefined,
```

- [ ] **Step 3: Verify existing tests still pass**

Run: `cd packages/shared && npx vitest run`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/manifest-convert.ts
git commit -m "feat: persist captionAnalysis through DB round-trip via videoSettings JSONB"
```

---

### Task 4: Speaker Emphasis Detection

**Files:**
- Create: `packages/worker/src/processors/analyze-captions.ts` (partial — emphasis detection only)
- Create: `packages/worker/src/processors/analyze-captions.test.ts`

- [ ] **Step 1: Write tests for emphasis detection**

```typescript
// packages/worker/src/processors/analyze-captions.test.ts
import { describe, it, expect } from 'vitest';
import { detectSpeakerEmphasis } from './analyze-captions';

const makeWord = (text: string, startMs: number, endMs: number) => ({ text, startMs, endMs });

describe('detectSpeakerEmphasis', () => {
  it('detects slow delivery', () => {
    // Average word ~200ms. "empire" is 600ms → 3x ratio
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
      // 500ms gap before "empire"
      makeWord('empire', 900, 1100),
      makeWord('from', 1100, 1300),
    ];
    const markers = detectSpeakerEmphasis(words);
    const pauseMarkers = markers.filter(m => m.type === 'pause-before');
    expect(pauseMarkers.some(m => m.wordIndex === 2)).toBe(true);
  });

  it('detects pause-after', () => {
    const words = [
      makeWord('empire', 0, 200),
      // 600ms gap after "empire"
      makeWord('from', 800, 1000),
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/worker && npx vitest run src/processors/analyze-captions.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement detectSpeakerEmphasis**

```typescript
// packages/worker/src/processors/analyze-captions.ts (initial — emphasis detection only)
import type { EmphasisMarker } from '@viona/shared/caption-analysis';

interface CaptionWord {
  text: string;
  startMs: number;
  endMs: number;
}

const SLOW_DELIVERY_THRESHOLD = 1.8;
const PAUSE_THRESHOLD_MS = 400;
const PACE_CHANGE_FACTOR = 2.0;

export function detectSpeakerEmphasis(words: CaptionWord[]): EmphasisMarker[] {
  if (words.length < 2) return [];

  const markers: EmphasisMarker[] = [];
  const durations = words.map(w => w.endMs - w.startMs);
  const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;

  for (let i = 0; i < words.length; i++) {
    const duration = durations[i];
    const charCount = words[i].text.replace(/[^a-zA-Z]/g, '').length || 1;
    // Normalize for word length: longer words naturally take longer
    const normalizedRatio = (duration / avgDuration) / (charCount / 4);
    const durationRatio = duration / avgDuration;

    // Slow delivery
    if (normalizedRatio > SLOW_DELIVERY_THRESHOLD) {
      const confidence = Math.min(1, (normalizedRatio - SLOW_DELIVERY_THRESHOLD) / 2 + 0.5);
      markers.push({ wordIndex: i, confidence, type: 'slow-delivery', durationRatio });
    }

    // Pause before
    if (i > 0) {
      const gap = words[i].startMs - words[i - 1].endMs;
      if (gap > PAUSE_THRESHOLD_MS) {
        const confidence = Math.min(1, (gap - PAUSE_THRESHOLD_MS) / 600 + 0.5);
        markers.push({ wordIndex: i, confidence, type: 'pause-before', durationRatio: gap / avgDuration });
      }
    }

    // Pause after
    if (i < words.length - 1) {
      const gap = words[i + 1].startMs - words[i].endMs;
      if (gap > PAUSE_THRESHOLD_MS) {
        const confidence = Math.min(1, (gap - PAUSE_THRESHOLD_MS) / 600 + 0.5);
        markers.push({ wordIndex: i, confidence, type: 'pause-after', durationRatio: gap / avgDuration });
      }
    }

    // Pace change (3-word sliding window)
    if (i >= 1 && i < words.length - 1) {
      const localAvg = (durations[i - 1] + durations[i] + durations[i + 1]) / 3;
      const neighborAvg = i >= 2 && i < words.length - 2
        ? (durations[i - 2] + durations[i + 2]) / 2
        : avgDuration;
      const ratio = localAvg / neighborAvg;
      if (ratio > PACE_CHANGE_FACTOR || ratio < 1 / PACE_CHANGE_FACTOR) {
        const confidence = Math.min(1, Math.abs(ratio - 1) / 2 + 0.3);
        markers.push({ wordIndex: i, confidence, type: 'pace-change', durationRatio });
      }
    }
  }

  return markers;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/worker && npx vitest run src/processors/analyze-captions.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/worker/src/processors/analyze-captions.ts packages/worker/src/processors/analyze-captions.test.ts
git commit -m "feat: implement speaker emphasis detection heuristic for cinematic subtitles"
```

---

### Task 5: LLM Analysis + Validation + Job Wiring

**Files:**
- Modify: `packages/worker/src/processors/analyze-captions.ts`
- Modify: `packages/worker/src/processors/analyze-captions.test.ts`

- [ ] **Step 1: Write tests for LLM prompt formatting and validation**

Add to `analyze-captions.test.ts`:

```typescript
import { formatWordsForLLM, validateAndRepairAnalysis } from './analyze-captions';
import type { CaptionAnalysis } from '@viona/shared/caption-analysis';

describe('formatWordsForLLM', () => {
  it('formats words with emphasis markers', () => {
    const words = [makeWord('She', 0, 180), makeWord('empire', 200, 680)];
    const emphasis = [{ wordIndex: 1, confidence: 0.9, type: 'slow-delivery' as const, durationRatio: 2.1 }];
    const result = formatWordsForLLM(words, emphasis);
    expect(result).toContain('0 | She | 180 | —');
    expect(result).toContain('1 | empire | 480 | ⚡slow-delivery(2.1x)');
  });
});

describe('validateAndRepairAnalysis', () => {
  it('fills missing word directives with defaults', () => {
    // Only provide directive for word 0, but wordCount is 3
    const analysis: CaptionAnalysis = {
      words: [{ wordIndex: 0, tier: 'hero', fontRole: 'bold-sans', animation: 'elastic-pop', entryDelayMs: 0, colorRole: 'accent' }],
      sentences: [{ wordRange: [0, 3], phraseGroups: [{ wordIndices: [0, 1, 2], layout: 'single-line', alignment: 'center', durationMs: 1000 }], mood: 'calm' }],
      speakerEmphasis: [],
      metadata: { analyzedAt: '2026-01-01T00:00:00Z', model: 'gpt-4o-mini', version: 1 },
    };
    const repaired = validateAndRepairAnalysis(analysis, 3);
    expect(repaired.words.length).toBe(3);
    expect(repaired.words[1].tier).toBe('normal'); // default
    expect(repaired.words[2].tier).toBe('normal'); // default
  });

  it('clamps out-of-bounds wordIndex', () => {
    const analysis: CaptionAnalysis = {
      words: [{ wordIndex: 99, tier: 'hero', fontRole: 'bold-sans', animation: 'elastic-pop', entryDelayMs: 0, colorRole: 'accent' }],
      sentences: [{ wordRange: [0, 2], phraseGroups: [{ wordIndices: [0, 1], layout: 'single-line', alignment: 'center', durationMs: 1000 }], mood: 'calm' }],
      speakerEmphasis: [],
      metadata: { analyzedAt: '2026-01-01T00:00:00Z', model: 'gpt-4o-mini', version: 1 },
    };
    const repaired = validateAndRepairAnalysis(analysis, 2);
    // Out-of-bounds word removed, defaults filled
    expect(repaired.words.every(w => w.wordIndex >= 0 && w.wordIndex < 2)).toBe(true);
    expect(repaired.words.length).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/worker && npx vitest run src/processors/analyze-captions.test.ts`
Expected: FAIL — functions not found

- [ ] **Step 3: Implement LLM analysis functions**

Add to `packages/worker/src/processors/analyze-captions.ts`:

```typescript
import OpenAI from 'openai';
import {
  type CaptionAnalysis,
  type WordDirective,
  type SentenceDirective,
  type EmphasisMarker,
  captionAnalysisSchema,
  DEFAULT_WORD_DIRECTIVE,
  validateCaptionAnalysis,
} from '@viona/shared/caption-analysis';

export function formatWordsForLLM(words: CaptionWord[], emphasis: EmphasisMarker[]): string {
  const emphasisByIndex = new Map<number, EmphasisMarker[]>();
  for (const e of emphasis) {
    const list = emphasisByIndex.get(e.wordIndex) || [];
    list.push(e);
    emphasisByIndex.set(e.wordIndex, list);
  }

  return words.map((w, i) => {
    const dur = w.endMs - w.startMs;
    const markers = emphasisByIndex.get(i);
    const emphasisStr = markers
      ? markers.map(m => `⚡${m.type}(${m.durationRatio.toFixed(1)}x)`).join(',')
      : '—';
    return `${i} | ${w.text} | ${dur} | ${emphasisStr}`;
  }).join('\n');
}

const WORD_CLASSIFICATION_PROMPT = `You are a cinematic subtitle director for viral short-form video.
Classify each word for maximum visual impact.

Rules:
- 1-2 HERO words per sentence (the showstoppers, 2-3x size)
- Hero words = emotional peaks, key nouns, power verbs, numbers
- Words the speaker EMPHASIZED (marked with ⚡) should be hero/accent
- Assign fontRole: bold-sans for impact/power, elegant-cursive for emotion/beauty/flow, default for everything else
- Animation (use EXACT names):
  elastic-pop / slam-down / scale-bounce → power/impact words
  fade-rise / slide-up → emotional/flowing words
  typewriter → technical/precise words
  bounce-up → playful/energetic words
  none → filler/diminished words
- entryDelayMs: 50-200ms for dramatic builds, 0 for rapid sequences
- colorRole: accent for hero words, glow for emotional accents, primary for everything else

Return ONLY a JSON array of objects with: wordIndex, tier, fontRole, animation, entryDelayMs, colorRole.
Optional: textTransform ("uppercase" for impact), scaleOverride (number for fine control).`;

const SENTENCE_COMPOSITION_PROMPT = `You are composing cinematic subtitle layouts for 9:16 vertical video.

Given word-level classifications, group words into display phrases and decide layout.

Rules:
- Max 1-2 seconds per phrase on screen
- Hero words get their own line (stacked) or dominate
- cascade: dramatic builds (words appear one by one)
- split: contrasting two ideas
- single-line: quick phrases
- Vary alignment for visual movement (don't always center)
- Set mood: dramatic, urgent, curious, calm, impactful
- Flag punctuation: ? → question-pop, ! → exclaim-shake, ... → ellipsis-fade
- Every word index must be in exactly one phraseGroup
- wordRange uses exclusive end: [startIdx, endIdx)

Return ONLY a JSON array of objects with: wordRange, phraseGroups, mood.
Optional: punctuationEffect.`;

export async function classifyWords(
  openai: OpenAI,
  words: CaptionWord[],
  emphasis: EmphasisMarker[],
): Promise<WordDirective[]> {
  const input = formatWordsForLLM(words, emphasis);
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: WORD_CLASSIFICATION_PROMPT },
      { role: 'user', content: `Words:\n${input}\n\nReturn JSON: { "words": [...] }` },
    ],
    temperature: 0.3,
  });
  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('Empty LLM response for word classification');
  const parsed = JSON.parse(content);
  return parsed.words || parsed;
}

export async function composeSentences(
  openai: OpenAI,
  words: CaptionWord[],
  wordDirectives: WordDirective[],
): Promise<SentenceDirective[]> {
  const directiveSummary = wordDirectives.map(d =>
    `${d.wordIndex} | ${words[d.wordIndex]?.text} | tier=${d.tier} | font=${d.fontRole}`
  ).join('\n');
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SENTENCE_COMPOSITION_PROMPT },
      { role: 'user', content: `Word directives:\n${directiveSummary}\n\nReturn JSON: { "sentences": [...] }` },
    ],
    temperature: 0.3,
  });
  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('Empty LLM response for sentence composition');
  const parsed = JSON.parse(content);
  return parsed.sentences || parsed;
}

export function validateAndRepairAnalysis(
  analysis: CaptionAnalysis,
  wordCount: number,
): CaptionAnalysis {
  // Remove out-of-bounds word directives
  const validWords = analysis.words.filter(w => w.wordIndex >= 0 && w.wordIndex < wordCount);

  // Remove duplicates (keep first)
  const seen = new Set<number>();
  const deduped: WordDirective[] = [];
  for (const w of validWords) {
    if (!seen.has(w.wordIndex)) {
      deduped.push(w);
      seen.add(w.wordIndex);
    }
  }

  // Fill missing word indices with defaults
  for (let i = 0; i < wordCount; i++) {
    if (!seen.has(i)) {
      deduped.push({ wordIndex: i, ...DEFAULT_WORD_DIRECTIVE });
    }
  }
  deduped.sort((a, b) => a.wordIndex - b.wordIndex);

  return { ...analysis, words: deduped };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/worker && npx vitest run src/processors/analyze-captions.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/worker/src/processors/analyze-captions.ts packages/worker/src/processors/analyze-captions.test.ts
git commit -m "feat: add LLM word classification, sentence composition, and validation for cinematic analysis"
```

---

### Task 6: analyze-captions Worker Job + Registration

**Files:**
- Modify: `packages/worker/src/processors/analyze-captions.ts`
- Modify: `packages/worker/src/index.ts:49+`
- Modify: `packages/worker/src/processors/transcribe.ts:699-711`

- [ ] **Step 1: Add the full processAnalyzeCaptions job handler**

Add to `packages/worker/src/processors/analyze-captions.ts`:

```typescript
import { db } from '../db/index.js';
import { tracks, timelineItems, projects } from '../db/schema.js';
import { eq, and, inArray } from 'drizzle-orm';

export interface AnalyzeCaptionsJobData {
  projectId: string;
  jobId: string;
}

export async function processAnalyzeCaptions(jobData: AnalyzeCaptionsJobData): Promise<void> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // 1. Query caption items from DB (join through tracks)
  const subtitleTracks = await db.select().from(tracks)
    .where(and(eq(tracks.projectId, jobData.projectId), eq(tracks.type, 'subtitle')));
  const trackIds = subtitleTracks.map(t => t.id);
  if (trackIds.length === 0) return;

  const captionItems = await db.select().from(timelineItems)
    .where(inArray(timelineItems.trackId, trackIds));
  if (captionItems.length === 0) return;

  // 2. Analyze each caption item
  const captionAnalysis: Record<string, CaptionAnalysis> = {};

  for (const item of captionItems) {
    const words: CaptionWord[] = (item.data as any)?.words || [];
    if (words.length === 0) continue;

    try {
      // Step 1: Speaker emphasis detection
      const emphasis = detectSpeakerEmphasis(words);

      // Step 2: LLM word classification (with retry)
      let wordDirectives: WordDirective[];
      try {
        wordDirectives = await classifyWords(openai, words, emphasis);
      } catch (e) {
        // Retry once
        try {
          wordDirectives = await classifyWords(openai, words, emphasis);
        } catch {
          console.error(`[analyze-captions] Word classification failed for item ${item.id}:`, e);
          continue; // Skip this item
        }
      }

      // Step 3: LLM sentence composition (with retry)
      let sentenceDirectives: SentenceDirective[];
      try {
        sentenceDirectives = await composeSentences(openai, words, wordDirectives);
      } catch (e) {
        try {
          sentenceDirectives = await composeSentences(openai, words, wordDirectives);
        } catch {
          console.error(`[analyze-captions] Sentence composition failed for item ${item.id}:`, e);
          continue;
        }
      }

      // Step 4: Validate and repair
      const rawAnalysis: CaptionAnalysis = {
        words: wordDirectives,
        sentences: sentenceDirectives,
        speakerEmphasis: emphasis,
        metadata: {
          analyzedAt: new Date().toISOString(),
          model: 'gpt-4o-mini',
          version: 1,
        },
      };
      captionAnalysis[item.id] = validateAndRepairAnalysis(rawAnalysis, words.length);
    } catch (e) {
      console.error(`[analyze-captions] Failed for item ${item.id}:`, e);
      // Partial results are acceptable — skip this item
    }
  }

  if (Object.keys(captionAnalysis).length === 0) return;

  // 3. Write to DB (videoSettings.captionAnalysis)
  // Read current project to get the existing videoSettings
  const [project] = await db.select().from(projects)
    .where(eq(projects.id, jobData.projectId));
  if (!project) return;

  const videoSettings = (project.videoSettings as any) || {};
  videoSettings.captionAnalysis = captionAnalysis;

  await db.update(projects)
    .set({ videoSettings })
    .where(eq(projects.id, jobData.projectId));

  // 4. Notify frontend via WebSocket (if workspace is active)
  // Follow the pattern used by other worker jobs that notify the frontend.
  // Look at how the transcribe processor or render processor emits completion events.
  // At minimum, publish a Redis event that the API server picks up and forwards via WS:
  try {
    const redis = new (await import('ioredis')).default(process.env.REDIS_URL);
    await redis.publish(`project:${jobData.projectId}:events`, JSON.stringify({
      type: 'caption-analysis-complete',
      captionAnalysis,
    }));
    await redis.quit();
  } catch (e) {
    console.error('[analyze-captions] Failed to publish WebSocket notification:', e);
    // Non-blocking — data is persisted in DB, user can reload
  }

  console.log(`[analyze-captions] Completed for project ${jobData.projectId}: ${Object.keys(captionAnalysis).length} items analyzed`);
}
```

- [ ] **Step 2: Register the worker in index.ts**

In `packages/worker/src/index.ts`, add after the last worker registration (~line 150+):

```typescript
import { processAnalyzeCaptions } from './processors/analyze-captions';

const analyzeCaptionsWorker = new Worker<AnalyzeCaptionsJobData>(
  'analyze-captions',
  async (job) => { await processAnalyzeCaptions(job.data); },
  { connection: redisConnection, concurrency: 2 },
);

analyzeCaptionsWorker.on('failed', (job, err) => {
  console.error(`[analyze-captions] Job ${job?.id} failed:`, err);
});
```

- [ ] **Step 3: Queue analyze-captions after transcription**

In `packages/worker/src/processors/transcribe.ts`:

First, add imports at the top of the file:
```typescript
import { Queue } from 'bullmq';
import { redisConnection } from '../utils/redis.js'; // or wherever the shared redis connection is exported
```

Then, after the job completion code (~line 709, after `publishJobComplete`):

```typescript
// Queue cinematic caption analysis
try {
  const analyzeCaptionsQueue = new Queue('analyze-captions', { connection: redisConnection });
  await analyzeCaptionsQueue.add('analyze', {
    projectId: jobData.projectId,
    jobId: `analyze-${jobData.jobId}`,
  });
} catch (e) {
  console.error('[transcribe] Failed to queue analyze-captions:', e);
  // Non-blocking — transcription still succeeds
}
```

Note: Check the existing imports in `transcribe.ts` — the `Queue` and `redisConnection` may already be imported or available through a different path. Follow the pattern used by other processors that queue follow-up jobs.

- [ ] **Step 4: Verify the worker builds**

Run: `cd packages/worker && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add packages/worker/src/processors/analyze-captions.ts packages/worker/src/index.ts packages/worker/src/processors/transcribe.ts
git commit -m "feat: wire analyze-captions worker job with LLM pipeline and auto-queue from transcribe"
```

---

### Task 7: CinematicWord Component

**Files:**
- Create: `packages/renderer/src/components/CinematicWord.tsx`

- [ ] **Step 1: Create CinematicWord component**

```typescript
// packages/renderer/src/components/CinematicWord.tsx
import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import type { WordDirective, CinematicTier } from '@viona/shared/caption-analysis';
import { resolveAnimation } from '../animations/resolve';
import type { AnimationConfig, WordTimingContext } from '../animations/types';

interface CinematicFonts {
  boldSans: string;
  elegantCursive: string;
  default: string;
}

interface CinematicColors {
  primary: string;
  accent: string;
  accentGradient?: string;
  glow: string;
}

interface CinematicScales {
  hero: number;
  accent: number;
  normal: number;
  whisper: number;
}

interface CinematicWordProps {
  word: { text: string; startMs: number; endMs: number };
  directive: WordDirective;
  fonts: CinematicFonts;
  colors: CinematicColors;
  scales: CinematicScales;
  baseFontSize: number;
  canvasWidth: number;
  defaultAnimation: AnimationConfig;
}

const TIER_WEIGHTS: Record<CinematicTier, number> = {
  hero: 900,
  accent: 700,
  normal: 500,
  whisper: 400,
};

export const CinematicWord: React.FC<CinematicWordProps> = ({
  word,
  directive,
  fonts,
  colors,
  scales,
  baseFontSize,
  canvasWidth,
  defaultAnimation,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Font from role
  const fontFamily = {
    'bold-sans': fonts.boldSans,
    'elegant-cursive': fonts.elegantCursive,
    'default': fonts.default,
  }[directive.fontRole];

  // Scale from tier + override
  const tierScale = directive.scaleOverride ?? scales[directive.tier];
  const fontScale = canvasWidth / 1080;
  const fontSize = tierScale * baseFontSize * fontScale;

  // Entry delay (frame-quantized)
  const delayFrames = Math.round(directive.entryDelayMs / (1000 / fps));
  const effectiveStartMs = word.startMs + (delayFrames * (1000 / fps));

  // Current time
  const currentMs = (frame / fps) * 1000;
  const elapsed = currentMs - effectiveStartMs;
  const wordDuration = word.endMs - word.startMs;

  // Not yet visible
  if (currentMs < effectiveStartMs - 150) {
    return null;
  }

  // Animation — uses WordTimingContext from animations/types.ts
  const animConfig: AnimationConfig = {
    in: directive.animation as any, // cinematicAnimationEnum is subset of AnimationType
    active: 'none',
    out: defaultAnimation.out,
    easing: defaultAnimation.easing,
  };
  const timingCtx: WordTimingContext = {
    elapsedMs: elapsed,
    wordDurationMs: wordDuration,
    isActive: elapsed >= 0 && elapsed <= wordDuration,
    hasAppeared: elapsed >= 0,
    isFuture: currentMs < effectiveStartMs,
  };
  const animResult = resolveAnimation(animConfig, timingCtx);

  // Color from role
  let color = colors.primary;
  let backgroundImage: string | undefined;
  if (directive.colorRole === 'accent') {
    if (colors.accentGradient) {
      backgroundImage = colors.accentGradient;
      color = 'transparent';
    } else {
      color = colors.accent;
    }
  } else if (directive.colorRole === 'glow') {
    color = colors.primary;
  }

  // Glow/shadow based on tier
  const textShadow = buildTierShadow(directive.tier, colors.glow);

  // Opacity for whisper
  const opacity = directive.tier === 'whisper' ? 0.6 : 1;

  const style: React.CSSProperties = {
    fontFamily,
    fontSize,
    fontWeight: TIER_WEIGHTS[directive.tier],
    color,
    textShadow,
    opacity: opacity * ((animResult?.style?.opacity as number) ?? 1),
    transform: animResult?.style?.transform as string | undefined,
    textTransform: directive.textTransform ?? 'none',
    display: 'inline-block',
    whiteSpace: 'nowrap',
    lineHeight: 1.2,
    ...(backgroundImage ? {
      backgroundImage,
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
    } : {}),
  };

  return <span style={style}>{word.text}</span>;
};

function buildTierShadow(tier: CinematicTier, glowColor: string): string {
  switch (tier) {
    case 'hero':
      return `0 2px 8px rgba(0,0,0,0.6), 0 0 20px ${glowColor}66, 0 0 40px ${glowColor}33`;
    case 'accent':
      return `0 2px 6px rgba(0,0,0,0.5), 0 0 10px ${glowColor}33`;
    case 'normal':
      return '0 1px 4px rgba(0,0,0,0.4)';
    case 'whisper':
      return 'none';
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd packages/renderer && npx tsc --noEmit`
Expected: No type errors (may need to adjust imports based on actual module resolution)

- [ ] **Step 3: Commit**

```bash
git add packages/renderer/src/components/CinematicWord.tsx
git commit -m "feat: add CinematicWord component with tier-based font, scale, color, and animation"
```

---

### Task 8: PhraseLayout Component

**Files:**
- Create: `packages/renderer/src/components/PhraseLayout.tsx`

- [ ] **Step 1: Create PhraseLayout component**

```typescript
// packages/renderer/src/components/PhraseLayout.tsx
import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';
import type { WordDirective } from '@viona/shared/caption-analysis';
import { CinematicWord } from './CinematicWord';
import type { AnimationConfig } from '../animations/types';

interface PhraseLayoutProps {
  words: { text: string; startMs: number; endMs: number }[];
  directives: WordDirective[];
  layout: 'single-line' | 'stacked' | 'split' | 'cascade';
  alignment: 'center' | 'left' | 'right';
  fonts: { boldSans: string; elegantCursive: string; default: string };
  colors: { primary: string; accent: string; accentGradient?: string; glow: string };
  scales: { hero: number; accent: number; normal: number; whisper: number };
  baseFontSize: number;
  canvasWidth: number;
  defaultAnimation: AnimationConfig;
  phraseStartMs: number;
  phraseDurationMs: number;
}

export const PhraseLayout: React.FC<PhraseLayoutProps> = (props) => {
  const {
    words, directives, layout, alignment,
    fonts, colors, scales, baseFontSize, canvasWidth,
    defaultAnimation, phraseStartMs, phraseDurationMs,
  } = props;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentMs = (frame / fps) * 1000;

  // Phrase enter/exit opacity
  const phraseEndMs = phraseStartMs + phraseDurationMs;
  const phraseOpacity = interpolate(
    currentMs,
    [phraseStartMs - 100, phraseStartMs, phraseEndMs - 50, phraseEndMs],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  if (phraseOpacity <= 0) return null;

  // Find hero words for stacked/split layouts (local index into words/directives arrays)
  const heroIndices = directives
    .map((d, i) => d.tier === 'hero' ? i : -1)
    .filter(i => i >= 0);

  const containerStyle: React.CSSProperties = {
    opacity: phraseOpacity,
    display: 'flex',
    flexDirection: layout === 'single-line' ? 'row' : 'column',
    alignItems: alignment === 'left' ? 'flex-start' : alignment === 'right' ? 'flex-end' : 'center',
    justifyContent: 'center',
    gap: layout === 'single-line' ? '0.3em' : '0.15em',
    flexWrap: 'wrap',
    textAlign: alignment,
  };

  const renderWord = (word: typeof words[0], directive: WordDirective, index: number) => {
    // Cascade stagger
    const cascadeDelay = layout === 'cascade' ? index * 120 : 0;
    const adjustedWord = cascadeDelay > 0
      ? { ...word, startMs: word.startMs + cascadeDelay }
      : word;

    return (
      <CinematicWord
        key={directive.wordIndex}
        word={adjustedWord}
        directive={directive}
        fonts={fonts}
        colors={colors}
        scales={scales}
        baseFontSize={baseFontSize}
        canvasWidth={canvasWidth}
        defaultAnimation={defaultAnimation}
      />
    );
  };

  if (layout === 'stacked' && heroIndices.length > 0) {
    // Non-hero words grouped, hero word(s) on their own line
    const heroIdx = heroIndices[0];
    const before = words.slice(0, heroIdx);
    const hero = words[heroIdx];
    const after = words.slice(heroIdx + 1);

    return (
      <div style={containerStyle}>
        {before.length > 0 && (
          <div style={{ display: 'flex', gap: '0.3em', justifyContent: 'center' }}>
            {before.map((w, i) => renderWord(w, directives[i], i))}
          </div>
        )}
        {hero && renderWord(hero, directives[heroIdx], heroIdx)}
        {after.length > 0 && (
          <div style={{ display: 'flex', gap: '0.3em', justifyContent: 'center' }}>
            {after.map((w, i) => renderWord(w, directives[heroIdx + 1 + i], heroIdx + 1 + i))}
          </div>
        )}
      </div>
    );
  }

  if (layout === 'split' && words.length >= 2) {
    const mid = Math.ceil(words.length / 2);
    return (
      <div style={containerStyle}>
        <div style={{ display: 'flex', gap: '0.3em', justifyContent: 'center' }}>
          {words.slice(0, mid).map((w, i) => renderWord(w, directives[i], i))}
        </div>
        <div style={{ display: 'flex', gap: '0.3em', justifyContent: 'center' }}>
          {words.slice(mid).map((w, i) => renderWord(w, directives[mid + i], mid + i))}
        </div>
      </div>
    );
  }

  // single-line and cascade both render linearly
  return (
    <div style={containerStyle}>
      {words.map((w, i) => renderWord(w, directives[i], i))}
    </div>
  );
};
```

- [ ] **Step 2: Verify it compiles**

Run: `cd packages/renderer && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add packages/renderer/src/components/PhraseLayout.tsx
git commit -m "feat: add PhraseLayout component with single-line, stacked, split, and cascade modes"
```

---

### Task 9: CinematicSubtitle Root Component

**Files:**
- Create: `packages/renderer/src/components/CinematicSubtitle.tsx`

- [ ] **Step 1: Create CinematicSubtitle component**

```typescript
// packages/renderer/src/components/CinematicSubtitle.tsx
import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import type { CaptionAnalysis, SentenceDirective } from '@viona/shared/caption-analysis';
import { PhraseLayout } from './PhraseLayout';
import type { AnimationConfig } from '../animations/types';

interface CinematicSubtitleProps {
  words: { text: string; startMs: number; endMs: number }[];
  analysis: CaptionAnalysis;
  startMs: number;
  endMs: number;
  style: {
    fontFamily: string;
    fontSize: number;
    animation: AnimationConfig;
    position: { anchor: string; offsetX: number; offsetY: number; textAlign: string };
    useCinematicRenderer?: boolean;
    cinematicFonts?: { boldSans: string; elegantCursive: string; default: string };
    cinematicColors?: { primary: string; accent: string; accentGradient?: string; glow: string };
    cinematicScales?: { hero: number; accent: number; normal: number; whisper: number };
  };
  canvasWidth: number;
  canvasHeight: number;
}

const DEFAULT_FONTS = { boldSans: 'Montserrat', elegantCursive: 'Playfair Display', default: 'Inter' };
const DEFAULT_COLORS = { primary: '#FFFFFF', accent: '#FFD700', glow: '#FFA500' };
const DEFAULT_SCALES = { hero: 2.5, accent: 1.4, normal: 1.0, whisper: 0.65 };

export const CinematicSubtitle: React.FC<CinematicSubtitleProps> = ({
  words, analysis, startMs, endMs, style, canvasWidth, canvasHeight,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentMs = (frame / fps) * 1000;

  const fonts = style.cinematicFonts ?? DEFAULT_FONTS;
  const colors = style.cinematicColors ?? DEFAULT_COLORS;
  const scales = style.cinematicScales ?? DEFAULT_SCALES;

  // Find active sentence based on current time
  const activeSentence = findActiveSentence(analysis.sentences, words, currentMs);
  if (!activeSentence) return null;

  // Find active phrase group within the sentence
  const activePhrase = findActivePhrase(activeSentence, words, currentMs);
  if (!activePhrase) return null;

  // Get the words and directives for the active phrase
  const phraseWords = activePhrase.wordIndices.map(i => words[i]).filter(Boolean);
  const phraseDirectives = activePhrase.wordIndices
    .map(i => analysis.words.find(d => d.wordIndex === i))
    .filter(Boolean) as typeof analysis.words;

  if (phraseWords.length === 0) return null;

  // Phrase timing
  const firstWord = phraseWords[0];
  const lastWord = phraseWords[phraseWords.length - 1];
  const phraseStartMs = firstWord.startMs;
  const phraseDurationMs = activePhrase.durationMs || (lastWord.endMs - firstWord.startMs);

  // Position
  const positionStyle = calculatePosition(style.position, canvasHeight);

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      justifyContent: 'center',
      ...positionStyle,
      padding: '0 5%',
    }}>
      <PhraseLayout
        words={phraseWords}
        directives={phraseDirectives}
        layout={activePhrase.layout}
        alignment={activePhrase.alignment}
        fonts={fonts}
        colors={colors}
        scales={scales}
        baseFontSize={style.fontSize}
        canvasWidth={canvasWidth}
        defaultAnimation={style.animation}
        phraseStartMs={phraseStartMs}
        phraseDurationMs={phraseDurationMs}
      />
    </div>
  );
};

function findActiveSentence(
  sentences: SentenceDirective[],
  words: { startMs: number; endMs: number }[],
  currentMs: number,
): SentenceDirective | null {
  for (const s of sentences) {
    const [start, end] = s.wordRange;
    const sentenceStart = words[start]?.startMs ?? 0;
    const sentenceEnd = words[Math.min(end - 1, words.length - 1)]?.endMs ?? 0;
    if (currentMs >= sentenceStart - 100 && currentMs <= sentenceEnd + 50) {
      return s;
    }
  }
  return null;
}

function findActivePhrase(
  sentence: SentenceDirective,
  words: { startMs: number; endMs: number }[],
  currentMs: number,
): (typeof sentence.phraseGroups)[0] | null {
  for (const pg of sentence.phraseGroups) {
    if (pg.wordIndices.length === 0) continue;
    const firstWord = words[pg.wordIndices[0]];
    const lastWord = words[pg.wordIndices[pg.wordIndices.length - 1]];
    if (!firstWord || !lastWord) continue;
    const phraseEnd = firstWord.startMs + pg.durationMs;
    if (currentMs >= firstWord.startMs - 100 && currentMs <= phraseEnd + 50) {
      return pg;
    }
  }
  return null;
}

function calculatePosition(
  position: { anchor: string; offsetX: number; offsetY: number; textAlign: string },
  canvasHeight: number,
): React.CSSProperties {
  const align = position.anchor === 'top' ? 'flex-start'
    : position.anchor === 'bottom' ? 'flex-end'
    : 'center';
  return {
    alignItems: align,
    transform: `translate(${position.offsetX}%, ${position.offsetY}%)`,
  };
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd packages/renderer && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add packages/renderer/src/components/CinematicSubtitle.tsx
git commit -m "feat: add CinematicSubtitle root component with phrase/sentence navigation"
```

---

### Task 10: Cinematic Luxe Preset

**Files:**
- Modify: `apps/web/src/lib/subtitle-presets.ts:29-67,368-381`

- [ ] **Step 1: Add cinematic fields to SubtitlePreset interface**

In `apps/web/src/lib/subtitle-presets.ts`, add to the `SubtitlePreset` interface (~line 67, before the closing brace):

```typescript
  useCinematicRenderer?: boolean;
  cinematicFonts?: {
    boldSans: string;
    elegantCursive: string;
    default: string;
  };
  cinematicColors?: {
    primary: string;
    accent: string;
    accentGradient?: string;
    glow: string;
  };
  cinematicScales?: {
    hero: number;
    accent: number;
    normal: number;
    whisper: number;
  };
```

- [ ] **Step 2: Add "Cinematic Luxe" preset**

After the last preset in `SUBTITLE_PRESETS` (after `google-material` at ~line 368), add the new preset. Use the exact definition from the spec (lines 450-502).

Also add `'cinematic-luxe'` to the `PRESET_ORDER` array (~line 371-381).

- [ ] **Step 3: Verify existing tests still pass**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/subtitle-presets.ts
git commit -m "feat: add Cinematic Luxe preset with dual-font luxury aesthetic"
```

---

### Task 11: Codegen Integration

**Files:**
- Modify: `packages/api/src/workspace/workspace-codegen.ts:210-250`

- [ ] **Step 1: Update codegen to embed captionAnalysis and conditional CinematicSubtitle**

In `packages/api/src/workspace/workspace-codegen.ts`, in the `generatePlayerComposition()` function:

1. **Add cinematic font imports** (~line 240, in the font discovery section):
   If `manifest.captionPreset?.useCinematicRenderer` and `manifest.captionPreset?.cinematicFonts`, add imports for all 3 font families.

2. **Embed captionAnalysis** as a constant in the generated code:
   ```typescript
   const captionAnalysisLine = `const CAPTION_ANALYSIS = ${JSON.stringify(manifest.captionAnalysis || {})};`;
   ```

3. **In the caption item rendering section**, add conditional rendering:
   ```typescript
   // If captionAnalysis exists for this item and preset uses cinematic renderer
   const analysis = CAPTION_ANALYSIS["${item.id}"];
   if (analysis && __captionStyle.useCinematicRenderer) {
     return <CinematicSubtitle words={...} analysis={analysis} ... />;
   }
   // else fallback to existing AnimatedSubtitle
   ```

4. **Copy CinematicSubtitle components** into workspace. Follow the existing pattern for how other renderer components are made available to the workspace bundle.

- [ ] **Step 2: Verify the API builds**

Run: `cd packages/api && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/workspace/workspace-codegen.ts
git commit -m "feat: integrate CinematicSubtitle into workspace codegen with captionAnalysis embedding"
```

---

### Task 12: Re-analysis on Transcript Edit

**Files:**
- Modify: The code path that handles transcript updates (likely in `packages/api/src/workspace/` or `packages/shared/src/manifest-ops.ts`)

- [ ] **Step 1: Add invalidation when caption word data changes**

When caption words are updated (via `update_item_data` manifest op on a caption item, or via re-transcription), the existing `captionAnalysis` for that item must be invalidated. In the `applyManifestOp()` function in `manifest-ops.ts`, after handling `update_item_data` for caption items:

```typescript
// Inside the update_item_data handler, after applying the data update:
// If the updated item is a caption and its words changed, invalidate analysis
if (item.type === 'caption' && op.dataUpdates.words) {
  if (manifest.captionAnalysis?.[op.itemId]) {
    delete manifest.captionAnalysis[op.itemId];
  }
}
```

- [ ] **Step 2: Re-queue analysis after transcript edit**

The frontend or API should re-queue `analyze-captions` when it detects that `captionAnalysis` was invalidated. This can be done in the API layer when the `update_item_data` op is received for caption items. Follow the existing pattern for how ops trigger side effects.

```typescript
// In the API op handler (after applying the manifest op):
if (op.op === 'update_item_data' && manifest.captionAnalysis) {
  // Check if any caption analysis was invalidated
  // If so, queue a new analyze-captions job
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/manifest-ops.ts
git commit -m "feat: invalidate and re-queue caption analysis on transcript edit"
```

---

### Task 13: End-to-End Verification

**Files:** None (verification only)

- [ ] **Step 1: Run all shared package tests**

Run: `cd packages/shared && npx vitest run`
Expected: All tests PASS (including new caption-analysis tests)

- [ ] **Step 2: Run worker tests**

Run: `cd packages/worker && npx vitest run`
Expected: All tests PASS (including new analyze-captions tests)

- [ ] **Step 3: Type-check all packages**

Run: `npx tsc --noEmit` in each of: `packages/shared`, `packages/worker`, `packages/renderer`, `packages/api`, `apps/web`
Expected: No type errors in any package

- [ ] **Step 4: Verify manifest round-trip**

Manually verify: create a mock manifest with `captionAnalysis` data, run through `manifestV2Schema.parse()`, confirm the field survives validation.

- [ ] **Step 5: Final commit with any fixes**

```bash
git add -A
git commit -m "fix: resolve any type errors or test failures from cinematic subtitle integration"
```
