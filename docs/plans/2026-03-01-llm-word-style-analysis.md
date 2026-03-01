# LLM Word Style Analysis Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** After transcription completes, call an LLM to classify every word as power/medium/filler and store per-word style overrides (color, scale, fontWeight) directly on each subtitle word so the renderer emphasises important words and dims filler words automatically.

**Architecture:** A new `analyzeWordStyles()` function is inserted into `processTranscribeJob` between transcription (step 4, 70%) and caption grouping (step 5, 82%). It sends the full word list to OpenAI `gpt-4o-mini` in batches of 200 and maps the JSON response to `WordStyleOverrides` stored in `word.styleOverrides` on each created subtitle item. The existing renderer already reads `word.styleOverrides` for all presets — no frontend changes needed. The `dynamic-hierarchy` preset's rule-based tier values are also updated to match the new proportions (filler 1.0× not 0.65×, power 1.6× not 1.8×).

**Tech Stack:** TypeScript, OpenAI SDK (already installed), Vitest, BullMQ worker pipeline

---

### Task 1: Add config flag for word style analysis

**Files:**
- Modify: `packages/worker/src/config.ts`

**Step 1: Add the config block**

In `config.ts`, add after the `enhance` block (before `freepik`):

```typescript
  wordStyleAnalysis: {
    // Set WORD_STYLE_ANALYSIS_ENABLED=false to skip LLM word analysis
    enabled: process.env.WORD_STYLE_ANALYSIS_ENABLED !== 'false',
    model: process.env.WORD_STYLE_ANALYSIS_MODEL || 'gpt-4o-mini',
  },
```

**Step 2: Verify TypeScript compiles**

```bash
cd packages/worker && npx tsc --noEmit
```
Expected: no errors

**Step 3: Commit**

```bash
git add packages/worker/src/config.ts
git commit -m "feat: add wordStyleAnalysis config flag"
```

---

### Task 2: Create the pure mapping helper and write tests for it

**Files:**
- Modify: `packages/worker/src/processors/transcribe.ts`
- Create: `packages/worker/src/processors/transcribe.test.ts`

**Context:** `mapWordTypeToOverrides` is a pure function — easy to test in isolation. The renderer in `Composition.tsx` reads `overrides?.scale`, `overrides?.fontWeight`, `overrides?.color`, `overrides?.activeColor`, and `overrides?.textTransform` from each word's `styleOverrides`. We store all five.

**Step 1: Write the failing tests first**

Create `packages/worker/src/processors/transcribe.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { mapWordTypeToOverrides } from './transcribe.js';

describe('mapWordTypeToOverrides', () => {
  it('returns power overrides for power words', () => {
    const result = mapWordTypeToOverrides('power');
    expect(result).not.toBeNull();
    expect(result!.scale).toBe(1.6);
    expect(result!.fontWeight).toBe(900);
    expect(result!.color).toBe('#ffffff');
    expect(result!.activeColor).toBe('#FFD400');
    expect(result!.textTransform).toBe('uppercase');
  });

  it('returns filler overrides for filler words', () => {
    const result = mapWordTypeToOverrides('filler');
    expect(result).not.toBeNull();
    expect(result!.scale).toBe(1.0);
    expect(result!.fontWeight).toBe(500);
    expect(result!.color).toBe('rgba(255,255,255,0.7)');
    expect(result!.activeColor).toBe('rgba(255,255,255,0.85)');
    expect(result!.textTransform).toBeUndefined();
  });

  it('returns null for medium words (use preset defaults)', () => {
    const result = mapWordTypeToOverrides('medium');
    expect(result).toBeNull();
  });
});
```

**Step 2: Run tests — expect failure**

```bash
cd packages/worker && npx vitest run src/processors/transcribe.test.ts
```
Expected: FAIL — `mapWordTypeToOverrides is not exported`

**Step 3: Add the type and function to `transcribe.ts`**

At the top of `transcribe.ts`, after the existing interfaces, add:

```typescript
// Per-word style overrides stored in subtitle item JSONB data.
// Uses the full editor-side field set (activeColor, textTransform) even though
// @viona/shared's WordStyleOverrides is narrower — JSONB accepts any shape.
interface PerWordStyleOverrides {
  scale?: number;
  fontWeight?: number;
  color?: string;
  activeColor?: string;
  textTransform?: 'uppercase' | 'lowercase' | 'none';
}

type WordTier = 'power' | 'medium' | 'filler';

export function mapWordTypeToOverrides(type: WordTier): PerWordStyleOverrides | null {
  if (type === 'power') {
    return {
      scale: 1.6,
      fontWeight: 900,
      color: '#ffffff',
      activeColor: '#FFD400',
      textTransform: 'uppercase',
    };
  }
  if (type === 'filler') {
    return {
      scale: 1.0,
      fontWeight: 500,
      color: 'rgba(255,255,255,0.7)',
      activeColor: 'rgba(255,255,255,0.85)',
    };
  }
  // medium — let the preset's base style apply
  return null;
}
```

**Step 4: Run tests — expect pass**

```bash
cd packages/worker && npx vitest run src/processors/transcribe.test.ts
```
Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add packages/worker/src/processors/transcribe.ts \
        packages/worker/src/processors/transcribe.test.ts
git commit -m "feat: add mapWordTypeToOverrides pure helper with tests"
```

---

### Task 3: Implement `analyzeWordStyles()` using OpenAI

**Files:**
- Modify: `packages/worker/src/processors/transcribe.ts`

**Context:** Uses `gpt-4o-mini` with JSON mode. Batches words in groups of 200 to stay under token limits. Returns only power/filler entries — medium words are omitted to keep the response compact. Wrapped in try/catch so a failure never blocks transcription.

**Step 1: Add the `analyzeWordStyles` function after `mapWordTypeToOverrides`**

```typescript
const WORD_ANALYSIS_BATCH_SIZE = 200;

const WORD_ANALYSIS_SYSTEM_PROMPT = `You are a subtitle typography designer.
Classify each spoken word for visual emphasis in short-form video subtitles.

Types:
- "power": emotionally strong, surprising, impactful, or key-information words (nouns, strong verbs, numbers, dollar amounts, superlatives, emotional adjectives)
- "filler": articles (a, an, the), prepositions (in, on, at, to, of, for, with, by, from), conjunctions (and, but, or), auxiliary verbs (is, are, was, were, be, been, do, did, has, had, have, will, would, could, should), pronouns (i, you, we, they, he, she, it, me, us, them)
- "medium": everything else (default — do not include in output)

Return ONLY a JSON object. Keys = word index (string), values = {"type":"power"|"filler"}.
Include ONLY power and filler words. Omit medium words entirely.
Example: {"3":{"type":"power"},"7":{"type":"filler"},"12":{"type":"power"}}`;

async function analyzeWordStyles(
  words: WhisperXWord[],
  apiKey: string,
  model: string,
): Promise<Record<number, PerWordStyleOverrides>> {
  const OpenAI = (await import('openai')).default;
  const openai = new OpenAI({ apiKey });

  const allOverrides: Record<number, PerWordStyleOverrides> = {};

  // Process in batches to stay within token limits
  for (let batchStart = 0; batchStart < words.length; batchStart += WORD_ANALYSIS_BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + WORD_ANALYSIS_BATCH_SIZE, words.length);
    const batchWords = words.slice(batchStart, batchEnd);

    // Build word list with global indices
    const wordList = batchWords
      .map((w, localIdx) => `${batchStart + localIdx}: "${w.text}"`)
      .join('\n');

    const response = await openai.chat.completions.create({
      model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: WORD_ANALYSIS_SYSTEM_PROMPT },
        { role: 'user', content: `Classify these words:\n${wordList}` },
      ],
      temperature: 0,
      max_tokens: 800,
    });

    const raw = response.choices[0]?.message?.content ?? '{}';
    let parsed: Record<string, { type: WordTier }>;
    try {
      parsed = JSON.parse(raw);
    } catch {
      logger.warn({ batchStart }, 'Word style analysis: failed to parse LLM JSON, skipping batch');
      continue;
    }

    for (const [idxStr, entry] of Object.entries(parsed)) {
      const globalIdx = parseInt(idxStr, 10);
      if (isNaN(globalIdx) || globalIdx < 0 || globalIdx >= words.length) continue;
      const tier = entry?.type as WordTier;
      if (tier !== 'power' && tier !== 'filler' && tier !== 'medium') continue;
      const overrides = mapWordTypeToOverrides(tier);
      if (overrides) {
        allOverrides[globalIdx] = overrides;
      }
    }
  }

  return allOverrides;
}
```

**Step 2: Verify TypeScript compiles**

```bash
cd packages/worker && npx tsc --noEmit
```
Expected: no errors

**Step 3: Commit**

```bash
git add packages/worker/src/processors/transcribe.ts
git commit -m "feat: add analyzeWordStyles LLM function"
```

---

### Task 4: Wire `analyzeWordStyles` into the transcription pipeline

**Files:**
- Modify: `packages/worker/src/processors/transcribe.ts` (the `processTranscribeJob` function, lines ~583–636)

**Context:** The hook goes between step 4 (transcription done, 70%) and step 5 (caption grouping). Overrides are applied when mapping `page.words` to the subtitle item data. Failure is non-fatal — log a warning and continue with no overrides.

**Step 1: Add the analysis step in `processTranscribeJob`**

Find this block (around line 587):
```typescript
    await publishJobProgress(jobId, 70, 'Transcription complete', pubExtras);

    // Step 5: Process captions (75%)
    await publishJobProgress(jobId, 72, 'Processing captions...', pubExtras);

    const pages = groupWordsIntoPages(whisperxOutput.words);
```

Replace with:
```typescript
    await publishJobProgress(jobId, 70, 'Transcription complete', pubExtras);

    // Step 4.5: LLM word style analysis (70% → 80%)
    let wordStyleOverrides: Record<number, PerWordStyleOverrides> = {};
    const analysisEnabled = config.wordStyleAnalysis.enabled;
    const analysisApiKey = config.transcription.openaiApiKey;

    if (analysisEnabled && analysisApiKey) {
      try {
        await publishJobProgress(jobId, 71, 'Analysing word styles...', pubExtras);
        wordStyleOverrides = await analyzeWordStyles(
          whisperxOutput.words,
          analysisApiKey,
          config.wordStyleAnalysis.model,
        );
        await publishJobProgress(jobId, 80, 'Word styles analysed', pubExtras);
        logger.info({ projectId, wordCount: whisperxOutput.words.length, overrideCount: Object.keys(wordStyleOverrides).length }, 'Word style analysis complete');
      } catch (err) {
        logger.warn({ projectId, err }, 'Word style analysis failed — continuing without overrides');
      }
    } else if (analysisEnabled && !analysisApiKey) {
      logger.info({ projectId }, 'Word style analysis skipped — no OPENAI_API_KEY');
    }

    // Step 5: Process captions (82%)
    await publishJobProgress(jobId, 81, 'Processing captions...', pubExtras);

    const pages = groupWordsIntoPages(whisperxOutput.words);
```

**Step 2: Apply overrides when building subtitle items**

Find this block (around line 619):
```typescript
    const subtitleItems = pages.map((page) => ({
      trackId: subtitleTrack.id,
      type: 'subtitle' as const,
      startMs: page.startMs,
      endMs: page.endMs,
      data: {
        text: page.text,
        words: page.words.map(w => ({
          text: w.text,
          startMs: w.startMs,
          endMs: w.endMs,
        })),
        style: DEFAULT_SUBTITLE_STYLE,
      },
    }));
```

Replace with:
```typescript
    // Track global word index across pages so overrides align correctly
    let globalWordIdx = 0;
    const subtitleItems = pages.map((page) => ({
      trackId: subtitleTrack.id,
      type: 'subtitle' as const,
      startMs: page.startMs,
      endMs: page.endMs,
      data: {
        text: page.text,
        words: page.words.map((w) => {
          const idx = globalWordIdx++;
          const styleOverrides = wordStyleOverrides[idx] ?? undefined;
          return {
            text: w.text,
            startMs: w.startMs,
            endMs: w.endMs,
            ...(styleOverrides ? { styleOverrides } : {}),
          };
        }),
        style: DEFAULT_SUBTITLE_STYLE,
      },
    }));
```

**Step 3: Verify TypeScript compiles**

```bash
cd packages/worker && npx tsc --noEmit
```
Expected: no errors

**Step 4: Run all worker tests**

```bash
cd packages/worker && npx vitest run
```
Expected: all tests pass (including the new transcribe.test.ts)

**Step 5: Commit**

```bash
git add packages/worker/src/processors/transcribe.ts
git commit -m "feat: wire LLM word style analysis into transcription pipeline"
```

---

### Task 5: Update `getDynamicHierarchyOverrides` in Composition.tsx to match new tier values

**Files:**
- Modify: `apps/web/src/features/editor-v2/player/Composition.tsx` (lines ~1080–1105)

**Context:** The rule-based fallback for the `dynamic-hierarchy` preset still uses old values (filler 0.65×, power 1.8×). Users who haven't re-processed their videos will see the old behaviour. Align these to match the new LLM output: filler 1.0× at 70% opacity, power 1.6× yellow.

**Step 1: Update `getDynamicHierarchyOverrides`**

Find:
```typescript
  if (tier === 'power') {
    computed.scale = 1.8;
    computed.fontWeight = 900;
    computed.activeColor = '#FFD400';
    computed.color = '#FFFFFF';
  } else if (tier === 'filler') {
    computed.scale = 0.65;
    computed.fontWeight = 500;
    computed.color = 'rgba(255,255,255,0.6)';
    computed.activeColor = 'rgba(255,255,255,0.8)';
  } else {
    // medium — default size, slight bump
    computed.scale = 1.0;
    computed.fontWeight = 700;
  }
```

Replace with:
```typescript
  if (tier === 'power') {
    computed.scale = 1.6;
    computed.fontWeight = 900;
    computed.color = '#ffffff';
    computed.activeColor = '#FFD400';
    computed.textTransform = 'uppercase';
  } else if (tier === 'filler') {
    computed.scale = 1.0;
    computed.fontWeight = 500;
    computed.color = 'rgba(255,255,255,0.7)';
    computed.activeColor = 'rgba(255,255,255,0.85)';
  } else {
    // medium — normal size, standard weight
    computed.scale = 1.0;
    computed.fontWeight = 700;
  }
```

**Step 2: Verify TypeScript compiles**

```bash
cd apps/web && npx tsc --noEmit
```
Expected: no errors (note: `textTransform` is in `WordStyleOverrides` in the editor store types)

**Step 3: Commit**

```bash
git add apps/web/src/features/editor-v2/player/Composition.tsx
git commit -m "fix: update dynamic-hierarchy tier values (filler=1.0x, power=1.6x uppercase)"
```

---

### Task 6: Manual smoke test

**Step 1: Start the worker locally**

```bash
cd packages/worker && npm run dev
```

**Step 2: Upload a short video/audio clip through the UI**

- Open the app, upload a video or audio file
- In the worker logs you should see:
  ```
  Analysing word styles...
  Word style analysis complete { wordCount: N, overrideCount: M }
  ```

**Step 3: Verify word styles appear in the editor**

- Open the project in the editor
- Check that power words appear larger and yellow on the Dynamic preset
- Check that filler words stay normal-sized but slightly dimmer
- Check that other presets (e.g. mrbeast) also show the word-level emphasis

**Step 4: Test without API key**

- Temporarily unset `OPENAI_API_KEY`
- Upload again — logs should show:
  ```
  Word style analysis skipped — no OPENAI_API_KEY
  ```
- Subtitles should still appear normally (no crash)

**Step 5: Commit any fixes found during smoke test**
