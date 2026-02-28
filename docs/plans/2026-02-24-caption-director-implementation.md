# Caption Director Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade `generate-caption-styles.ts` into a Caption Director that classifies every word into 5 tiers (emphasis/emotional/action/normal/filler) and generates both per-caption and per-word style overrides in a single AI call, running as a blocking step after transcription.

**Architecture:** Single-pass upgrade of the existing caption style generator. The AI receives the full transcript with word indices, returns a preset selection + sparse per-caption overrides + sparse per-word tier classifications with style overrides. Integrates inline in the transcription pipeline before project status becomes `ready`. A new "Dynamic Flow" preset serves as the default canvas for AI-styled output.

**Tech Stack:** TypeScript, Vitest, Anthropic SDK / OpenRouter, Zustand (Immer), React, Remotion

**Design doc:** `docs/plans/2026-02-24-caption-director-design.md`

---

### Task 1: Align `WordStyleOverrides` in shared types

**Files:**
- Modify: `packages/shared/src/types/index.ts:238-243`

**Step 1: Update `WordStyleOverrides` in shared types**

The shared `WordStyleOverrides` (line 238) is missing `activeColor`, `fontFamily`, `fontSize`, `letterSpacing`, and `textTransform` that the editor store type already has. Align them so the worker can write full overrides that flow through to the renderer.

In `packages/shared/src/types/index.ts`, replace lines 238-243:

```typescript
export interface WordStyleOverrides {
  color?: string;
  fontWeight?: number;
  scale?: number;        // 1.0 = normal, 1.2 = 20% bigger
  emphasisBg?: string;   // highlight background color
}
```

With:

```typescript
export interface WordStyleOverrides {
  color?: string;
  activeColor?: string;
  fontWeight?: number;
  fontFamily?: string;
  fontSize?: number;
  scale?: number;        // 1.0 = normal, 1.2 = 20% bigger
  letterSpacing?: number;
  textTransform?: 'none' | 'uppercase' | 'lowercase';
  emphasisBg?: string;   // highlight background color
}
```

**Step 2: Add `aiWordOverrides` to `SubtitleData`**

In `packages/shared/src/types/index.ts`, replace lines 293-298:

```typescript
export interface SubtitleData {
  text: string;
  words: SubtitleWord[];
  style: SubtitleStyle;
  styleOverrides?: Partial<SubtitleStyle>;
}
```

With:

```typescript
export interface SubtitleData {
  text: string;
  words: SubtitleWord[];
  style: SubtitleStyle;
  styleOverrides?: Partial<SubtitleStyle>;
  aiWordOverrides?: Record<number, WordStyleOverrides>;
}
```

**Step 3: Verify no TypeScript errors**

Run: `cd /Users/sarthakpant/project/clippify && npx tsc --noEmit -p packages/shared/tsconfig.json`
Expected: No errors (we only added optional fields)

**Step 4: Commit**

```bash
git add packages/shared/src/types/index.ts
git commit -m "feat: align WordStyleOverrides across shared types, add aiWordOverrides to SubtitleData"
```

---

### Task 2: Add "Dynamic Flow" preset

**Files:**
- Modify: `apps/web/src/lib/subtitle-presets.ts:1592` (after the closing `};` of `SUBTITLE_PRESETS`, before `PRESET_ORDER`)

**Step 1: Add the preset definition**

In `apps/web/src/lib/subtitle-presets.ts`, add a new entry to `SUBTITLE_PRESETS` just before the closing `};` (before line 1592). Insert after the `neon-flicker` preset (after line 1591):

```typescript
  // Dynamic Flow — AI Caption Director's default canvas
  // Clean base with spring animation; word-level AI overrides create the hierarchy
  'dynamic-flow': {
    id: 'dynamic-flow',
    name: 'Dynamic Flow',
    category: 'motion',
    fontFamily: 'Outfit, system-ui, sans-serif',
    fontSize: 56,
    fontWeight: 600,
    textTransform: 'none',
    letterSpacing: 1,
    color: '#ffffff',
    activeColor: '#00FF88',
    backgroundColor: 'transparent',
    activeBackgroundColor: 'transparent',
    stroke: { width: 2.5, color: '#000000' },
    effects: {
      shadow: { offsetX: 0, offsetY: 3, blur: 6, color: '#000000', opacity: 0.35 },
      shadowSecondary: null,
      glow: null,
    },
    animation: { in: 'elastic-pop', active: 'none', out: 'none', easing: 'spring' },
    displayMode: 'karaoke',
    wordsPerPhrase: 6,
    position: {
      anchor: 'bottom',
      offsetX: 0,
      offsetY: 5,
      rotation: 0,
      textAlign: 'center',
    },
  },
```

**Step 2: Add to PRESET_ORDER**

In `apps/web/src/lib/subtitle-presets.ts`, add `'dynamic-flow'` to the Motion section of `PRESET_ORDER` (line 1609, after `'neon-flicker'`):

```typescript
  'underline-wipe', 'y2k-chrome', 'brutalist', 'neon-flicker', 'dynamic-flow',
```

**Step 3: Verify the preset loads**

Run: `cd /Users/sarthakpant/project/clippify && node -e "const p = require('./apps/web/src/lib/subtitle-presets.ts'); console.log(p)" 2>&1 || echo "TypeScript — check with tsc instead"`

Since this is TypeScript, just verify no type errors:
Run: `cd /Users/sarthakpant/project/clippify && npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | head -20`
Expected: No new errors related to subtitle-presets.ts

**Step 4: Commit**

```bash
git add apps/web/src/lib/subtitle-presets.ts
git commit -m "feat: add Dynamic Flow preset for AI Caption Director"
```

---

### Task 3: Write Caption Director tests

**Files:**
- Create: `packages/worker/src/processors/generate-caption-styles.test.ts`

**Step 1: Write tests for the new parsing and sanitization logic**

The existing `generate-caption-styles.ts` will be rewritten. Write tests first for the new functions: `parseCaptionDirectorResponse()`, `sanitizeWordOverride()`, `buildCaptionDirectorPrompt()`, and `mapTierToOverrides()`.

Create `packages/worker/src/processors/generate-caption-styles.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

// These will be exported from the rewritten generate-caption-styles.ts
import {
  parseCaptionDirectorResponse,
  sanitizeWordOverride,
  mapTierToOverrides,
  buildCaptionDirectorPrompt,
  type CaptionDirectorResponse,
  type WordTier,
} from './generate-caption-styles.js';

describe('parseCaptionDirectorResponse', () => {
  it('parses a valid Caption Director JSON response', () => {
    const raw = JSON.stringify({
      presetId: 'dynamic-flow',
      tone: 'energetic',
      captionOverrides: [
        { index: 0, activeColor: '#FF3366', fontSize: 68 },
      ],
      wordOverrides: {
        '0:2': { tier: 'emphasis', scale: 1.4, fontWeight: 900 },
        '1:0': { tier: 'filler', scale: 0.85 },
      },
    });

    const result = parseCaptionDirectorResponse(raw, 3);
    expect(result.presetId).toBe('dynamic-flow');
    expect(result.tone).toBe('energetic');
    expect(result.captionOverrides).toHaveLength(1);
    expect(result.captionOverrides[0].index).toBe(0);
    expect(result.captionOverrides[0].activeColor).toBe('#FF3366');
    expect(result.wordOverrides['0:2'].tier).toBe('emphasis');
    expect(result.wordOverrides['1:0'].tier).toBe('filler');
  });

  it('handles response wrapped in markdown code fences', () => {
    const raw = '```json\n{"presetId":"dynamic-flow","tone":"calm","captionOverrides":[],"wordOverrides":{}}\n```';
    const result = parseCaptionDirectorResponse(raw, 1);
    expect(result.presetId).toBe('dynamic-flow');
    expect(result.captionOverrides).toEqual([]);
  });

  it('falls back to defaults on invalid JSON', () => {
    const result = parseCaptionDirectorResponse('not json at all', 2);
    expect(result.presetId).toBe('dynamic-flow');
    expect(result.captionOverrides).toEqual([]);
    expect(result.wordOverrides).toEqual({});
  });

  it('strips invalid caption override indices', () => {
    const raw = JSON.stringify({
      presetId: 'dynamic-flow',
      tone: 'neutral',
      captionOverrides: [
        { index: 0, activeColor: '#FF0000' },
        { index: 99, activeColor: '#00FF00' },  // out of range
      ],
      wordOverrides: {},
    });
    const result = parseCaptionDirectorResponse(raw, 3);
    expect(result.captionOverrides).toHaveLength(1);
    expect(result.captionOverrides[0].index).toBe(0);
  });
});

describe('sanitizeWordOverride', () => {
  it('validates a correct word override', () => {
    const result = sanitizeWordOverride({
      tier: 'emphasis',
      scale: 1.4,
      fontWeight: 900,
      color: '#FF3366',
    });
    expect(result.tier).toBe('emphasis');
    expect(result.scale).toBe(1.4);
    expect(result.fontWeight).toBe(900);
    expect(result.color).toBe('#FF3366');
  });

  it('clamps scale to valid range', () => {
    const result = sanitizeWordOverride({ tier: 'emphasis', scale: 5.0 });
    expect(result.scale).toBeLessThanOrEqual(3.0);
  });

  it('rejects invalid tier and defaults to normal', () => {
    const result = sanitizeWordOverride({ tier: 'super-duper' as any, scale: 1.2 });
    expect(result.tier).toBe('normal');
  });

  it('rejects invalid hex colors', () => {
    const result = sanitizeWordOverride({ tier: 'emphasis', color: 'red' });
    expect(result.color).toBeUndefined();
  });
});

describe('mapTierToOverrides', () => {
  it('maps emphasis tier to large scale and bold weight', () => {
    const result = mapTierToOverrides('emphasis');
    expect(result.scale).toBeGreaterThanOrEqual(1.3);
    expect(result.fontWeight).toBe(900);
  });

  it('maps emotional tier to medium scale', () => {
    const result = mapTierToOverrides('emotional');
    expect(result.scale).toBeGreaterThanOrEqual(1.1);
    expect(result.fontWeight).toBe(700);
  });

  it('maps action tier with uppercase', () => {
    const result = mapTierToOverrides('action');
    expect(result.scale).toBeGreaterThanOrEqual(1.1);
    expect(result.textTransform).toBe('uppercase');
  });

  it('maps normal tier to empty overrides', () => {
    const result = mapTierToOverrides('normal');
    expect(Object.keys(result)).toHaveLength(0);
  });

  it('maps filler tier to small scale and light weight', () => {
    const result = mapTierToOverrides('filler');
    expect(result.scale).toBeLessThan(1.0);
    expect(result.fontWeight).toBeLessThanOrEqual(400);
  });
});

describe('buildCaptionDirectorPrompt', () => {
  it('includes all caption text and word indices', () => {
    const captions = [
      {
        index: 0,
        text: 'Hello world',
        startMs: 0,
        endMs: 2000,
        words: [
          { text: 'Hello', startMs: 0, endMs: 500 },
          { text: 'world', startMs: 600, endMs: 1000 },
        ],
      },
    ];
    const prompt = buildCaptionDirectorPrompt(captions);
    expect(prompt).toContain('Hello');
    expect(prompt).toContain('world');
    expect(prompt).toContain('emphasis');
    expect(prompt).toContain('emotional');
    expect(prompt).toContain('action');
    expect(prompt).toContain('filler');
    expect(prompt).toContain('dynamic-flow');
  });

  it('includes preset descriptions', () => {
    const prompt = buildCaptionDirectorPrompt([]);
    expect(prompt).toContain('mrbeast');
    expect(prompt).toContain('dynamic-flow');
  });
});
```

**Step 2: Run the tests to verify they fail**

Run: `cd /Users/sarthakpant/project/clippify/packages/worker && npx vitest run src/processors/generate-caption-styles.test.ts 2>&1 | tail -20`
Expected: FAIL — the new functions don't exist yet

**Step 3: Commit**

```bash
git add packages/worker/src/processors/generate-caption-styles.test.ts
git commit -m "test: add Caption Director parsing and classification tests"
```

---

### Task 4: Rewrite `generate-caption-styles.ts` — types, prompt, and parsing

**Files:**
- Modify: `packages/worker/src/processors/generate-caption-styles.ts` (full rewrite)

**Step 1: Rewrite the file with the Caption Director logic**

Replace the entire contents of `packages/worker/src/processors/generate-caption-styles.ts` with the new implementation. The key changes:

1. **New exported types:** `WordTier`, `CaptionDirectorResponse`, `WordOverrideEntry`
2. **New prompt** (`buildCaptionDirectorPrompt`): sends captions with nested word indices, available presets with short descriptions, 5-tier classification instructions
3. **New parser** (`parseCaptionDirectorResponse`): parses the `{ presetId, tone, captionOverrides[], wordOverrides{} }` shape with graceful fallback
4. **New sanitizer** (`sanitizeWordOverride`): validates tier, clamps scale (0.5-3.0), validates hex colors
5. **Tier mapper** (`mapTierToOverrides`): converts tier label → concrete `WordStyleOverrides`
6. **Preserved:** `callLLM()` function unchanged, `sanitizeStyleOverride()` unchanged, `sanitizeShadow()`/`sanitizeGlow()` unchanged
7. **Rewritten processor** (`processGenerateCaptionStylesJob`): loads captions, calls LLM with new prompt, parses response, writes `presetId` + caption `styleOverrides` + word `styleOverrides` + `aiWordOverrides` to each timeline item

```typescript
/**
 * Caption Director — AI-powered caption styling with word-level classification
 * Analyzes transcript, classifies words into 5 tiers (emphasis/emotional/action/normal/filler),
 * selects a preset, and generates per-caption + per-word style overrides.
 */

import { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { db, projects, tracks, timelineItems, jobs } from '../db/index.js';
import { publishJobProgress, publishJobComplete, publishJobError } from '../services/redis.js';
import { logger } from '../logger.js';

// ── Types ──

export type WordTier = 'emphasis' | 'emotional' | 'action' | 'normal' | 'filler';

const VALID_TIERS: WordTier[] = ['emphasis', 'emotional', 'action', 'normal', 'filler'];

export interface GenerateCaptionStylesJobData {
  projectId: string;
  jobId: string;
}

export interface CaptionStyleOverride {
  index: number;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  color?: string;
  activeColor?: string;
  backgroundColor?: string;
  textTransform?: 'none' | 'uppercase' | 'lowercase';
  letterSpacing?: number;
  stroke?: { width: number; color: string } | null;
  effects?: {
    shadow: { offsetX: number; offsetY: number; blur: number; color: string; opacity: number } | null;
    shadowSecondary: { offsetX: number; offsetY: number; blur: number; color: string; opacity: number } | null;
    glow: { enabled: boolean; color: string; intensity: number; size: number } | null;
  };
}

export interface WordOverrideEntry {
  tier: WordTier;
  color?: string;
  activeColor?: string;
  fontWeight?: number;
  fontFamily?: string;
  fontSize?: number;
  scale?: number;
  letterSpacing?: number;
  textTransform?: 'none' | 'uppercase' | 'lowercase';
  emphasisBg?: string;
}

export interface CaptionDirectorResponse {
  presetId: string;
  tone: string;
  captionOverrides: CaptionStyleOverride[];
  wordOverrides: Record<string, WordOverrideEntry>;
}

interface CaptionForPrompt {
  index: number;
  text: string;
  startMs: number;
  endMs: number;
  words: { text: string; startMs: number; endMs: number }[];
}

// Available fonts that AI can choose from (mirrors font-registry.ts)
const AVAILABLE_FONTS = [
  'Inter', 'Montserrat', 'Poppins', 'Source Sans 3', 'Space Grotesk',
  'DM Sans', 'Outfit', 'Nunito', 'Playfair Display', 'Lora',
  'Merriweather', 'JetBrains Mono', 'Fira Code', 'Bebas Neue', 'Rubik',
];

// Short descriptions of presets the AI can choose from
const PRESET_OPTIONS = [
  { id: 'mrbeast', desc: 'Bold green highlight, uppercase, scale-bounce (viral creator)' },
  { id: 'hormozi', desc: 'Yellow highlight, dark bg, professional speaker' },
  { id: 'ali-abdaal', desc: 'Clean light bg, fade animation, word-by-word' },
  { id: 'dynamic-hierarchy', desc: 'Auto power/filler word sizing, Anton font, phrase mode' },
  { id: 'netflix', desc: 'Cinematic serif, subtle fade, bottom-center' },
  { id: 'cinematic', desc: 'Warm gold tones, dramatic, Playfair Display' },
  { id: 'minimal', desc: 'Clean sans-serif, subtle shadow, phrase mode' },
  { id: 'default', desc: 'Universal clean starting point, Inter font' },
  { id: 'dynamic-flow', desc: 'AI-optimized canvas: Outfit font, karaoke mode, green active, spring animation. Designed for word-level AI overrides.' },
  { id: 'spotlight', desc: 'Bold motion, bright yellow active, film-grain feel' },
  { id: 'glitch-text', desc: 'Glitch animation, neon green, tech vibe' },
  { id: 'slam', desc: 'Impact font, brutal-slam animation, high energy' },
];

// ── Exported functions (used by tests) ──

export function buildCaptionDirectorPrompt(captions: CaptionForPrompt[]): string {
  const captionList = captions.map(c => {
    const wordList = c.words.map((w, wi) =>
      `    [${wi}] "${w.text}"`
    ).join('\n');
    return `[Caption ${c.index}] "${c.text}" (${(c.startMs / 1000).toFixed(1)}s - ${(c.endMs / 1000).toFixed(1)}s)\n  Words:\n${wordList}`;
  }).join('\n\n');

  const presetList = PRESET_OPTIONS.map(p => `  - ${p.id}: ${p.desc}`).join('\n');

  return `You are a Caption Director for short-form video (TikTok/Reels/Shorts). Your job is to analyze a transcript and make the captions visually compelling by:
1. Selecting the best caption preset for the overall tone
2. Generating per-caption style overrides for key moments
3. Classifying EVERY word into one of 5 tiers for visual hierarchy

TRANSCRIPT:
${captionList}

AVAILABLE PRESETS:
${presetList}

AVAILABLE FONTS: ${AVAILABLE_FONTS.join(', ')}

WORD CLASSIFICATION TIERS:
- emphasis: Key nouns, brands, numbers, superlatives — the words viewers MUST notice
- emotional: Feeling words, exclamations, dramatic moments — words that convey emotion
- action: Verbs, CTAs ("subscribe", "click", "try", "watch") — words that drive engagement
- normal: Standard words that don't need special treatment (DON'T include these in wordOverrides)
- filler: Articles, prepositions, conjunctions (the, a, of, in, and, but) — de-emphasize these

STYLE PHILOSOPHY:
- Emphasis words should POP: bigger scale, bolder weight, vivid activeColor
- Emotional words get warm/cool color shifts based on sentiment (warm for positive, cool for dramatic)
- Action words get slight emphasis + uppercase to drive engagement
- Filler words should shrink and fade — they're structural, not meaningful
- Use VIVID activeColor per caption — cycle through: #FF3366, #00FF88, #FFD700, #00BFFF, #FF6B35, #A855F7
- Context matters: "Apple" in tech = emphasis, "apple" in cooking = normal

RULES:
1. Return a single JSON object (no markdown, no explanation)
2. presetId: pick the best preset from the list above
3. captionOverrides: sparse array — only captions that need style changes. Each has "index" + override properties
4. wordOverrides: sparse map keyed by "captionIndex:wordIndex" — ONLY non-normal words
5. Every word override MUST have "tier" field
6. Word overrides can optionally include: scale, fontWeight, color, activeColor, textTransform, emphasisBg
7. For captions: activeColor is REQUIRED, vary across captions. fontSize range: 40-84

VALID CAPTION OVERRIDE PROPERTIES:
- fontFamily, fontSize (40-84), fontWeight (400-900), color, activeColor, backgroundColor
- textTransform: "none" | "uppercase" | "lowercase"
- letterSpacing (0-6)
- stroke: { width (1-4), color } | null
- effects: { shadow: { offsetX, offsetY, blur, color, opacity } | null, shadowSecondary: null, glow: { enabled: true, color, intensity (0.3-1), size (10-35) } | null }

RESPOND ONLY with valid JSON:
{
  "presetId": "preset-id",
  "tone": "one-word-tone",
  "captionOverrides": [{ "index": 0, "activeColor": "#hex", ... }],
  "wordOverrides": { "0:2": { "tier": "emphasis", "scale": 1.4 }, "0:5": { "tier": "filler" } }
}`;
}

export function parseCaptionDirectorResponse(response: string, captionCount: number): CaptionDirectorResponse {
  const defaults: CaptionDirectorResponse = {
    presetId: 'dynamic-flow',
    tone: 'neutral',
    captionOverrides: [],
    wordOverrides: {},
  };

  let jsonStr = response.trim();

  // Remove markdown code fences if present
  const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    jsonStr = fenceMatch[1].trim();
  }

  // Find the JSON object
  const objStart = jsonStr.indexOf('{');
  const objEnd = jsonStr.lastIndexOf('}');
  if (objStart === -1 || objEnd === -1) {
    logger.warn({ response: response.slice(0, 200) }, 'Caption Director: no JSON object found, using defaults');
    return defaults;
  }
  jsonStr = jsonStr.slice(objStart, objEnd + 1);

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    logger.warn({ response: response.slice(0, 200) }, 'Caption Director: invalid JSON, using defaults');
    return defaults;
  }

  // Extract presetId
  const presetId = typeof parsed.presetId === 'string' ? parsed.presetId : 'dynamic-flow';
  const tone = typeof parsed.tone === 'string' ? parsed.tone : 'neutral';

  // Parse caption overrides — filter out invalid indices
  let captionOverrides: CaptionStyleOverride[] = [];
  if (Array.isArray(parsed.captionOverrides)) {
    captionOverrides = parsed.captionOverrides
      .filter((item: any) => item && typeof item === 'object' && typeof item.index === 'number')
      .filter((item: any) => item.index >= 0 && item.index < captionCount)
      .map((item: any) => ({
        index: item.index,
        ...sanitizeCaptionOverride(item),
      }));
  }

  // Parse word overrides — validate key format and tier
  const wordOverrides: Record<string, WordOverrideEntry> = {};
  if (parsed.wordOverrides && typeof parsed.wordOverrides === 'object' && !Array.isArray(parsed.wordOverrides)) {
    for (const [key, value] of Object.entries(parsed.wordOverrides as Record<string, unknown>)) {
      // Validate key format: "captionIndex:wordIndex"
      if (!/^\d+:\d+$/.test(key)) continue;
      if (!value || typeof value !== 'object') continue;
      const sanitized = sanitizeWordOverride(value as Record<string, unknown>);
      if (sanitized.tier !== 'normal') {
        wordOverrides[key] = sanitized;
      }
    }
  }

  return { presetId, tone, captionOverrides, wordOverrides };
}

export function sanitizeWordOverride(raw: Record<string, unknown>): WordOverrideEntry {
  const hexRegex = /^#[0-9a-fA-F]{6}$/;

  // Tier — default to normal if invalid
  let tier: WordTier = 'normal';
  if (typeof raw.tier === 'string' && VALID_TIERS.includes(raw.tier as WordTier)) {
    tier = raw.tier as WordTier;
  }

  const result: WordOverrideEntry = { tier };

  // Scale — clamp 0.5 to 3.0
  if (typeof raw.scale === 'number' && raw.scale >= 0.3 && raw.scale <= 5.0) {
    result.scale = Math.min(3.0, Math.max(0.5, raw.scale));
  }

  // fontWeight — 100-900
  if (typeof raw.fontWeight === 'number' && raw.fontWeight >= 100 && raw.fontWeight <= 900) {
    result.fontWeight = Math.round(raw.fontWeight / 100) * 100;
  }

  // Colors
  if (typeof raw.color === 'string' && hexRegex.test(raw.color)) {
    result.color = raw.color;
  }
  if (typeof raw.activeColor === 'string' && hexRegex.test(raw.activeColor)) {
    result.activeColor = raw.activeColor;
  }
  if (typeof raw.emphasisBg === 'string' && hexRegex.test(raw.emphasisBg)) {
    result.emphasisBg = raw.emphasisBg;
  }

  // fontFamily
  if (typeof raw.fontFamily === 'string') {
    const primary = raw.fontFamily.split(',')[0].trim();
    if (AVAILABLE_FONTS.includes(primary)) {
      result.fontFamily = raw.fontFamily;
    }
  }

  // fontSize — 20-120
  if (typeof raw.fontSize === 'number' && raw.fontSize >= 20 && raw.fontSize <= 120) {
    result.fontSize = Math.round(raw.fontSize);
  }

  // textTransform
  if (raw.textTransform === 'uppercase' || raw.textTransform === 'lowercase' || raw.textTransform === 'none') {
    result.textTransform = raw.textTransform;
  }

  // letterSpacing
  if (typeof raw.letterSpacing === 'number' && raw.letterSpacing >= -2 && raw.letterSpacing <= 10) {
    result.letterSpacing = raw.letterSpacing;
  }

  return result;
}

export function mapTierToOverrides(tier: WordTier): Omit<WordOverrideEntry, 'tier'> {
  switch (tier) {
    case 'emphasis':
      return { scale: 1.4, fontWeight: 900 };
    case 'emotional':
      return { scale: 1.2, fontWeight: 700 };
    case 'action':
      return { scale: 1.15, fontWeight: 800, textTransform: 'uppercase' };
    case 'filler':
      return { scale: 0.85, fontWeight: 400 };
    case 'normal':
    default:
      return {};
  }
}

// ── Caption-level sanitization (preserved from original) ──

function sanitizeCaptionOverride(raw: Record<string, unknown>): Omit<CaptionStyleOverride, 'index'> {
  const result: Omit<CaptionStyleOverride, 'index'> = {};
  const hexRegex = /^#[0-9a-fA-F]{6}$/;

  if (typeof raw.fontFamily === 'string') {
    const primary = raw.fontFamily.split(',')[0].trim();
    if (AVAILABLE_FONTS.includes(primary)) {
      result.fontFamily = raw.fontFamily;
    }
  }
  if (typeof raw.fontSize === 'number' && raw.fontSize >= 36 && raw.fontSize <= 84) {
    result.fontSize = Math.round(raw.fontSize);
  }
  if (typeof raw.fontWeight === 'number' && raw.fontWeight >= 400 && raw.fontWeight <= 900) {
    result.fontWeight = Math.round(raw.fontWeight / 100) * 100;
  }
  if (typeof raw.color === 'string' && hexRegex.test(raw.color)) result.color = raw.color;
  if (typeof raw.activeColor === 'string' && hexRegex.test(raw.activeColor)) result.activeColor = raw.activeColor;
  if (typeof raw.backgroundColor === 'string') {
    if (raw.backgroundColor === 'transparent' || hexRegex.test(raw.backgroundColor)) {
      result.backgroundColor = raw.backgroundColor;
    }
  }
  if (raw.textTransform === 'none' || raw.textTransform === 'uppercase' || raw.textTransform === 'lowercase') {
    result.textTransform = raw.textTransform;
  }
  if (typeof raw.letterSpacing === 'number' && raw.letterSpacing >= 0 && raw.letterSpacing <= 6) {
    result.letterSpacing = raw.letterSpacing;
  }
  if (raw.stroke === null) {
    result.stroke = null;
  } else if (raw.stroke && typeof raw.stroke === 'object') {
    const s = raw.stroke as Record<string, unknown>;
    if (typeof s.width === 'number' && typeof s.color === 'string' && hexRegex.test(s.color)) {
      result.stroke = { width: Math.min(6, Math.max(0.5, s.width)), color: s.color };
    }
  }
  if (raw.effects && typeof raw.effects === 'object') {
    const e = raw.effects as Record<string, unknown>;
    result.effects = {
      shadow: sanitizeShadow(e.shadow),
      shadowSecondary: sanitizeShadow(e.shadowSecondary),
      glow: sanitizeGlow(e.glow),
    };
  }

  return result;
}

function sanitizeShadow(raw: unknown): { offsetX: number; offsetY: number; blur: number; color: string; opacity: number } | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object') return null;
  const s = raw as Record<string, unknown>;
  const hexRegex = /^#[0-9a-fA-F]{6}$/;
  if (
    typeof s.offsetX === 'number' && typeof s.offsetY === 'number' &&
    typeof s.blur === 'number' && typeof s.color === 'string' && hexRegex.test(s.color) &&
    typeof s.opacity === 'number'
  ) {
    return {
      offsetX: Math.min(20, Math.max(-20, s.offsetX)),
      offsetY: Math.min(20, Math.max(-20, s.offsetY)),
      blur: Math.min(30, Math.max(0, s.blur)),
      color: s.color,
      opacity: Math.min(1, Math.max(0, s.opacity)),
    };
  }
  return null;
}

function sanitizeGlow(raw: unknown): { enabled: boolean; color: string; intensity: number; size: number } | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object') return null;
  const g = raw as Record<string, unknown>;
  const hexRegex = /^#[0-9a-fA-F]{6}$/;
  if (
    g.enabled === true &&
    typeof g.color === 'string' && hexRegex.test(g.color) &&
    typeof g.intensity === 'number' && typeof g.size === 'number'
  ) {
    return {
      enabled: true,
      color: g.color,
      intensity: Math.min(1, Math.max(0, g.intensity)),
      size: Math.min(50, Math.max(5, g.size)),
    };
  }
  return null;
}

// ── LLM call (preserved from original) ──

async function callLLM(prompt: string): Promise<string> {
  if (process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_MAX_PROXY_URL) {
    try {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const config: Record<string, string> = {};
      if (process.env.CLAUDE_MAX_PROXY_URL) {
        config.baseURL = process.env.CLAUDE_MAX_PROXY_URL;
        config.apiKey = process.env.ANTHROPIC_API_KEY || 'proxy';
      }
      const anthropic = new Anthropic(config);
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250514',
        max_tokens: 8192,
        messages: [{ role: 'user', content: prompt }],
      });
      return response.content[0].type === 'text' ? response.content[0].text : '';
    } catch (err) {
      logger.warn({ err }, 'Anthropic API/proxy failed, trying OpenRouter fallback');
    }
  }

  if (process.env.OPENROUTER_API_KEY) {
    const models = ['anthropic/claude-sonnet-4.5', 'anthropic/claude-3.5-sonnet'];
    let lastError: string | null = null;
    for (const model of models) {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        },
        body: JSON.stringify({ model, max_tokens: 8192, messages: [{ role: 'user', content: prompt }] }),
      });
      if (response.ok) {
        const data = await response.json() as { choices: Array<{ message: { content: string } }> };
        return data.choices[0]?.message?.content || '';
      }
      lastError = await response.text();
      logger.warn({ model, status: response.status }, 'OpenRouter model failed, trying next');
    }
    throw new Error(`OpenRouter API error: ${lastError}`);
  }

  throw new Error('No LLM API key configured. Set ANTHROPIC_API_KEY or OPENROUTER_API_KEY.');
}

// ── Main processor ──

export async function processGenerateCaptionStylesJob(job: Job<GenerateCaptionStylesJobData>) {
  const { projectId, jobId } = job.data;

  try {
    await db.update(jobs).set({ status: 'processing', progress: 0 }).where(eq(jobs.id, jobId));
    await publishJobProgress(jobId, 5, 'Loading captions...');

    const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
    if (!project) throw new Error('Project not found');

    const projectTracks = await db.query.tracks.findMany({ where: eq(tracks.projectId, projectId) });
    const captionTrack = projectTracks.find(t => t.type === 'subtitle' || t.type === 'caption');
    if (!captionTrack) throw new Error('No caption track found');

    const allItems = await db.select().from(timelineItems).where(eq(timelineItems.trackId, captionTrack.id));
    const captionItems = allItems.filter(item => item.type === 'subtitle').sort((a, b) => a.startMs - b.startMs);
    if (captionItems.length === 0) throw new Error('No caption items found');

    logger.info({ projectId, jobId, captionCount: captionItems.length }, 'Caption Director: analyzing captions');
    await publishJobProgress(jobId, 10, `Analyzing ${captionItems.length} captions...`);

    // Build prompt with full word data
    const captionsForPrompt: CaptionForPrompt[] = captionItems.map((item, index) => {
      const data = item.data as Record<string, unknown>;
      const words = (data.words as Array<{ text: string; startMs: number; endMs: number }>) || [];
      return {
        index,
        text: (data.text as string) || '',
        startMs: item.startMs,
        endMs: item.endMs,
        words: words.map(w => ({ text: w.text, startMs: w.startMs, endMs: w.endMs })),
      };
    });

    const prompt = buildCaptionDirectorPrompt(captionsForPrompt);
    await publishJobProgress(jobId, 20, 'AI Caption Director is styling...');

    const aiResponse = await callLLM(prompt);
    await publishJobProgress(jobId, 70, 'Parsing AI response...');

    const directorResult = parseCaptionDirectorResponse(aiResponse, captionItems.length);
    logger.info({ projectId, presetId: directorResult.presetId, tone: directorResult.tone, wordOverrideCount: Object.keys(directorResult.wordOverrides).length }, 'Caption Director: parsed response');

    await publishJobProgress(jobId, 80, 'Applying styles to captions...');

    // Build a lookup for caption overrides by index
    const captionOverrideMap = new Map<number, Omit<CaptionStyleOverride, 'index'>>();
    for (const co of directorResult.captionOverrides) {
      captionOverrideMap.set(co.index, co);
    }

    // Write to each caption item
    for (let i = 0; i < captionItems.length; i++) {
      const item = captionItems[i];
      const currentData = item.data as Record<string, unknown>;
      const currentStyle = (currentData.style as Record<string, unknown>) || {};
      const words = (currentData.words as Array<Record<string, unknown>>) || [];

      // 1. Set presetId on style
      const updatedStyle = { ...currentStyle, presetId: directorResult.presetId };

      // 2. Caption-level styleOverrides
      const captionOverride = captionOverrideMap.get(i);

      // 3. Word-level overrides
      const aiWordOverrides: Record<number, Record<string, unknown>> = {};
      const updatedWords = words.map((word, wi) => {
        const key = `${i}:${wi}`;
        const wordOverride = directorResult.wordOverrides[key];
        if (!wordOverride || wordOverride.tier === 'normal') return word;

        // Merge tier defaults with AI-specific overrides
        const tierDefaults = mapTierToOverrides(wordOverride.tier);
        const { tier, ...aiSpecific } = wordOverride;
        // AI-specific values override tier defaults
        const merged = { ...tierDefaults, ...aiSpecific };
        // Remove tier from the stored override (it's metadata, not a style prop)
        const styleOverride: Record<string, unknown> = {};
        if (merged.scale !== undefined) styleOverride.scale = merged.scale;
        if (merged.fontWeight !== undefined) styleOverride.fontWeight = merged.fontWeight;
        if (merged.color !== undefined) styleOverride.color = merged.color;
        if (merged.activeColor !== undefined) styleOverride.activeColor = merged.activeColor;
        if (merged.fontFamily !== undefined) styleOverride.fontFamily = merged.fontFamily;
        if (merged.fontSize !== undefined) styleOverride.fontSize = merged.fontSize;
        if (merged.textTransform !== undefined) styleOverride.textTransform = merged.textTransform;
        if (merged.letterSpacing !== undefined) styleOverride.letterSpacing = merged.letterSpacing;
        if (merged.emphasisBg !== undefined) styleOverride.emphasisBg = merged.emphasisBg;

        if (Object.keys(styleOverride).length > 0) {
          aiWordOverrides[wi] = styleOverride;
          return { ...word, styleOverrides: styleOverride };
        }
        return word;
      });

      const updatedData: Record<string, unknown> = {
        ...currentData,
        style: updatedStyle,
        words: updatedWords,
      };

      if (captionOverride) {
        const { index: _idx, ...overrideProps } = captionOverride as CaptionStyleOverride;
        if (Object.keys(overrideProps).length > 0) {
          updatedData.styleOverrides = overrideProps;
        }
      }

      if (Object.keys(aiWordOverrides).length > 0) {
        updatedData.aiWordOverrides = aiWordOverrides;
      }

      await db.update(timelineItems).set({ data: updatedData }).where(eq(timelineItems.id, item.id));
    }

    // Update project videoSettings
    const currentVideoSettings = (project.videoSettings as Record<string, unknown>) || {};
    await db.update(projects).set({
      videoSettings: { ...currentVideoSettings, aiCaptionStyleStatus: 'complete' },
    }).where(eq(projects.id, projectId));

    await db.update(jobs).set({
      status: 'complete', progress: 100,
      progressMessage: 'Caption Director styles applied',
      completedAt: new Date(),
    }).where(eq(jobs.id, jobId));

    await publishJobProgress(jobId, 100, 'Complete');
    await publishJobComplete(jobId, projectId);

    logger.info({ projectId, jobId, styledCount: captionItems.length }, 'Caption Director: styles applied');
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error({ projectId, jobId, err }, 'Caption Director job failed');

    await db.update(jobs).set({ status: 'failed', error: errorMsg }).where(eq(jobs.id, jobId));

    try {
      const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
      if (project) {
        const currentVideoSettings = (project.videoSettings as Record<string, unknown>) || {};
        await db.update(projects).set({
          videoSettings: { ...currentVideoSettings, aiCaptionStyleStatus: 'error' },
        }).where(eq(projects.id, projectId));
      }
    } catch { /* ignore cleanup */ }

    await publishJobError(jobId, errorMsg);
    throw err;
  }
}
```

**Step 2: Run the tests**

Run: `cd /Users/sarthakpant/project/clippify/packages/worker && npx vitest run src/processors/generate-caption-styles.test.ts 2>&1 | tail -30`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add packages/worker/src/processors/generate-caption-styles.ts
git commit -m "feat: rewrite generate-caption-styles as Caption Director with word-level classification"
```

---

### Task 5: Integrate Caption Director into transcription pipeline

**Files:**
- Modify: `packages/worker/src/processors/transcribe.ts:604-646`

**Step 1: Import and call the Caption Director**

In `packages/worker/src/processors/transcribe.ts`, add import at the top (after existing imports, around line 14):

```typescript
import { processGenerateCaptionStylesInline } from './generate-caption-styles.js';
```

Wait — the existing processor is job-based (`processGenerateCaptionStylesJob`). For inline usage we need a simpler function. Add a new exported function to `generate-caption-styles.ts` that takes `projectId` directly and doesn't need a BullMQ job. Add this at the bottom of `generate-caption-styles.ts`:

```typescript
/**
 * Inline Caption Director — called directly from the transcription pipeline.
 * Does not create a separate job. Progress is reported via the parent job's progress.
 */
export async function runCaptionDirectorInline(
  projectId: string,
  parentJobId: string,
): Promise<void> {
  const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
  if (!project) throw new Error('Project not found');

  const projectTracks = await db.query.tracks.findMany({ where: eq(tracks.projectId, projectId) });
  const captionTrack = projectTracks.find(t => t.type === 'subtitle' || t.type === 'caption');
  if (!captionTrack) throw new Error('No caption track found');

  const allItems = await db.select().from(timelineItems).where(eq(timelineItems.trackId, captionTrack.id));
  const captionItems = allItems.filter(item => item.type === 'subtitle').sort((a, b) => a.startMs - b.startMs);
  if (captionItems.length === 0) return; // Nothing to style

  const captionsForPrompt: CaptionForPrompt[] = captionItems.map((item, index) => {
    const data = item.data as Record<string, unknown>;
    const words = (data.words as Array<{ text: string; startMs: number; endMs: number }>) || [];
    return {
      index,
      text: (data.text as string) || '',
      startMs: item.startMs,
      endMs: item.endMs,
      words: words.map(w => ({ text: w.text, startMs: w.startMs, endMs: w.endMs })),
    };
  });

  const prompt = buildCaptionDirectorPrompt(captionsForPrompt);
  const aiResponse = await callLLM(prompt);
  const directorResult = parseCaptionDirectorResponse(aiResponse, captionItems.length);

  logger.info({ projectId, presetId: directorResult.presetId, tone: directorResult.tone, wordOverrideCount: Object.keys(directorResult.wordOverrides).length }, 'Caption Director (inline): parsed response');

  const captionOverrideMap = new Map<number, Omit<CaptionStyleOverride, 'index'>>();
  for (const co of directorResult.captionOverrides) {
    captionOverrideMap.set(co.index, co);
  }

  for (let i = 0; i < captionItems.length; i++) {
    const item = captionItems[i];
    const currentData = item.data as Record<string, unknown>;
    const currentStyle = (currentData.style as Record<string, unknown>) || {};
    const words = (currentData.words as Array<Record<string, unknown>>) || [];

    const updatedStyle = { ...currentStyle, presetId: directorResult.presetId };
    const captionOverride = captionOverrideMap.get(i);

    const aiWordOverrides: Record<number, Record<string, unknown>> = {};
    const updatedWords = words.map((word, wi) => {
      const key = `${i}:${wi}`;
      const wordOverride = directorResult.wordOverrides[key];
      if (!wordOverride || wordOverride.tier === 'normal') return word;

      const tierDefaults = mapTierToOverrides(wordOverride.tier);
      const { tier, ...aiSpecific } = wordOverride;
      const merged = { ...tierDefaults, ...aiSpecific };
      const styleOverride: Record<string, unknown> = {};
      if (merged.scale !== undefined) styleOverride.scale = merged.scale;
      if (merged.fontWeight !== undefined) styleOverride.fontWeight = merged.fontWeight;
      if (merged.color !== undefined) styleOverride.color = merged.color;
      if (merged.activeColor !== undefined) styleOverride.activeColor = merged.activeColor;
      if (merged.fontFamily !== undefined) styleOverride.fontFamily = merged.fontFamily;
      if (merged.fontSize !== undefined) styleOverride.fontSize = merged.fontSize;
      if (merged.textTransform !== undefined) styleOverride.textTransform = merged.textTransform;
      if (merged.letterSpacing !== undefined) styleOverride.letterSpacing = merged.letterSpacing;
      if (merged.emphasisBg !== undefined) styleOverride.emphasisBg = merged.emphasisBg;

      if (Object.keys(styleOverride).length > 0) {
        aiWordOverrides[wi] = styleOverride;
        return { ...word, styleOverrides: styleOverride };
      }
      return word;
    });

    const updatedData: Record<string, unknown> = { ...currentData, style: updatedStyle, words: updatedWords };
    if (captionOverride) {
      const { index: _idx, ...overrideProps } = captionOverride as CaptionStyleOverride;
      if (Object.keys(overrideProps).length > 0) updatedData.styleOverrides = overrideProps;
    }
    if (Object.keys(aiWordOverrides).length > 0) updatedData.aiWordOverrides = aiWordOverrides;

    await db.update(timelineItems).set({ data: updatedData }).where(eq(timelineItems.id, item.id));
  }

  const currentVideoSettings = (project.videoSettings as Record<string, unknown>) || {};
  await db.update(projects).set({
    videoSettings: { ...currentVideoSettings, aiCaptionStyleStatus: 'complete' },
  }).where(eq(projects.id, projectId));
}
```

Then in `transcribe.ts`, after the subtitle items are inserted (after the `publishJobProgress(jobId, 90, ...)` call around line 608), add the Caption Director call:

```typescript
    // Step 8: Run Caption Director (AI word-level styling)
    await publishJobProgress(jobId, 90, 'AI Caption Director styling...', pubExtras);
    try {
      await runCaptionDirectorInline(projectId, jobId);
      await publishJobProgress(jobId, 95, 'Caption styles applied', pubExtras);
    } catch (captionErr) {
      // Non-fatal: captions work without AI styling
      logger.warn({ projectId, err: captionErr }, 'Caption Director failed, proceeding without AI styles');
      await publishJobProgress(jobId, 95, 'Caption styling skipped', pubExtras);
    }
```

Also update the progress percentages for earlier steps:
- Change line 608 (`publishJobProgress(jobId, 90, ...)`) to `85`
- The Caption Director runs at 85-95%
- Audio track creation for audio projects stays at ~95%
- Final completion at 100%

**Step 2: Run existing transcription tests to ensure nothing breaks**

Run: `cd /Users/sarthakpant/project/clippify/packages/worker && npx vitest run 2>&1 | tail -20`
Expected: All existing tests pass

**Step 3: Commit**

```bash
git add packages/worker/src/processors/generate-caption-styles.ts packages/worker/src/processors/transcribe.ts
git commit -m "feat: integrate Caption Director inline in transcription pipeline"
```

---

### Task 6: Add "Reset to AI" button in WordToolbar

**Files:**
- Modify: `apps/web/src/features/editor-v2/panels/WordToolbar.tsx`
- Modify: `apps/web/src/features/editor-v2/store/types.ts:566`
- Modify: `apps/web/src/features/editor-v2/store/editor-store.ts:716`
- Modify: `apps/web/src/features/editor-v2/store/use-editor-store.ts:426`

**Step 1: Add `resetWordToAi` action to store types**

In `apps/web/src/features/editor-v2/store/types.ts`, after the `updateWordStyleOverrides` line (line 566), add:

```typescript
  resetWordToAi: (captionId: string, wordIndex: number) => void;
```

**Step 2: Implement `resetWordToAi` in editor store**

In `apps/web/src/features/editor-v2/store/editor-store.ts`, after the `updateWordStyleOverrides` action (after line 748), add:

```typescript
    resetWordToAi: (captionId: string, wordIndex: number) => {
      set((state) => {
        const item = state.items[captionId];
        if (!item || item.type !== 'caption') return;

        const data = item.data as CaptionItemData;
        const aiOverrides = (data as any).aiWordOverrides as Record<number, WordStyleOverrides> | undefined;
        if (!aiOverrides || !aiOverrides[wordIndex]) return;

        const word = data.words[wordIndex];
        if (!word) return;

        word.styleOverrides = { ...aiOverrides[wordIndex] };
      });
      get().pushHistory();
      debouncedSave(() => get().saveProject());
    },
```

**Step 3: Export from use-editor-store**

In `apps/web/src/features/editor-v2/store/use-editor-store.ts`, after the `updateWordStyleOverrides` line (line 426), add:

```typescript
      resetWordToAi: state.resetWordToAi,
```

**Step 4: Add `CaptionItemData` type extension for `aiWordOverrides`**

In `apps/web/src/features/editor-v2/store/types.ts`, update the `CaptionItemData` interface (lines 50-55) to include `aiWordOverrides`:

```typescript
export interface CaptionItemData {
  text: string;
  words: CaptionWord[];
  style: CaptionStyle;
  styleOverrides?: Partial<CaptionStyle>;
  aiWordOverrides?: Record<number, WordStyleOverrides>;
}
```

**Step 5: Add the Reset to AI button in WordToolbar**

In `apps/web/src/features/editor-v2/panels/WordToolbar.tsx`:

1. Import `RotateCcw` from lucide-react (add to the existing import on line 4):
```typescript
import { Bold, Maximize2, Palette, Highlighter, X, Type, RotateCcw } from 'lucide-react';
```

2. Add `resetWordToAi` to the destructured actions (line 18):
```typescript
  const { updateWordStyleOverrides, resetWordToAi } = useEditorActions();
```

3. Add a check for whether AI overrides exist. After line 20 (`const overrides = word.styleOverrides || {};`), add:
```typescript
  // Check if this word has AI-generated overrides available for reset
  // aiWordOverrides is passed through the caption item data
  const hasAiOverrides = !!word.aiWordOverrides;
```

Wait — the WordToolbar receives a `CaptionWord`, not the full `CaptionItemData`. We need to pass `hasAiOverrides` as a prop.

Update the `WordToolbarProps` interface (line 9):
```typescript
interface WordToolbarProps {
  captionId: string;
  wordIndex: number;
  word: CaptionWord;
  hasAiOverrides?: boolean;
  position?: { x: number; y: number };
  onClose: () => void;
}
```

Update the destructuring (line 17):
```typescript
export function WordToolbar({ captionId, wordIndex, word, hasAiOverrides, position, onClose }: WordToolbarProps) {
```

Add the reset handler after `clearAll` (after line 100):
```typescript
  const resetToAi = () => {
    resetWordToAi(captionId, wordIndex);
  };
```

4. Add the Reset to AI button in the toolbar, before the Clear/Close button (before line 197). Insert between the last divider and the X button:

```tsx
        {/* Reset to AI — only shown when AI overrides exist */}
        {hasAiOverrides && (
          <>
            <button
              onClick={resetToAi}
              className="p-1.5 rounded text-[var(--editor-text-secondary)] hover:bg-[var(--editor-bg-hover)] hover:text-[var(--editor-accent)] transition-colors"
              title="Reset to AI suggestion"
            >
              <RotateCcw size={14} />
            </button>
            <div className="w-px h-5 bg-[var(--editor-border-subtle)]" />
          </>
        )}
```

**Step 6: Pass `hasAiOverrides` prop from TranscriptPanel**

Find where `<WordToolbar>` is rendered in the TranscriptPanel. The parent needs to check whether `captionItem.data.aiWordOverrides?.[wordIndex]` exists and pass `hasAiOverrides={true}`.

Search for the WordToolbar usage in TranscriptPanel:

In `apps/web/src/features/editor-v2/panels/TranscriptPanel.tsx`, where `<WordToolbar>` is rendered, add the `hasAiOverrides` prop:

```tsx
<WordToolbar
  captionId={selectedWord.captionId}
  wordIndex={selectedWord.wordIndex}
  word={captionWords[selectedWord.wordIndex]}
  hasAiOverrides={!!(captionData as any).aiWordOverrides?.[selectedWord.wordIndex]}
  position={toolbarPosition}
  onClose={() => setSelectedWord(null)}
/>
```

The exact location depends on how TranscriptPanel renders the toolbar — find the `<WordToolbar` JSX and add the prop.

**Step 7: Verify TypeScript compiles**

Run: `cd /Users/sarthakpant/project/clippify && npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | head -30`
Expected: No new errors

**Step 8: Commit**

```bash
git add apps/web/src/features/editor-v2/panels/WordToolbar.tsx \
  apps/web/src/features/editor-v2/panels/TranscriptPanel.tsx \
  apps/web/src/features/editor-v2/store/types.ts \
  apps/web/src/features/editor-v2/store/editor-store.ts \
  apps/web/src/features/editor-v2/store/use-editor-store.ts
git commit -m "feat: add Reset to AI button in WordToolbar for AI-styled captions"
```

---

### Task 7: Verify all tests pass and final review

**Files:**
- All modified files

**Step 1: Run all worker tests**

Run: `cd /Users/sarthakpant/project/clippify/packages/worker && npx vitest run 2>&1`
Expected: All tests pass

**Step 2: TypeScript check across all packages**

Run: `cd /Users/sarthakpant/project/clippify && npx tsc --noEmit -p packages/shared/tsconfig.json && npx tsc --noEmit -p packages/worker/tsconfig.json && npx tsc --noEmit -p apps/web/tsconfig.json`
Expected: No errors

**Step 3: Verify the complete file list matches the design**

Verify all files changed match the design doc table:
- `packages/shared/src/types/index.ts` — WordStyleOverrides + SubtitleData
- `packages/worker/src/processors/generate-caption-styles.ts` — Full Caption Director rewrite
- `packages/worker/src/processors/generate-caption-styles.test.ts` — New tests
- `packages/worker/src/processors/transcribe.ts` — Inline Caption Director call
- `apps/web/src/lib/subtitle-presets.ts` — Dynamic Flow preset
- `apps/web/src/features/editor-v2/panels/WordToolbar.tsx` — Reset to AI button
- `apps/web/src/features/editor-v2/panels/TranscriptPanel.tsx` — Pass hasAiOverrides prop
- `apps/web/src/features/editor-v2/store/types.ts` — resetWordToAi action + aiWordOverrides
- `apps/web/src/features/editor-v2/store/editor-store.ts` — resetWordToAi implementation
- `apps/web/src/features/editor-v2/store/use-editor-store.ts` — Export resetWordToAi

**Step 4: Final commit if any cleanup needed**

```bash
git add -A && git status
# Only commit if there are changes
```
