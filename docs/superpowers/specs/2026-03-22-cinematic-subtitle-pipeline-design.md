# Cinematic Subtitle Pipeline Design

## Overview

A new end-to-end pipeline that transforms raw transcription data into cinematic, visually dynamic subtitles for viral short-form video. Unlike the current preset-based system where styling is static per-preset, this pipeline uses AI to analyze each transcript and produce per-word and per-sentence cinematic directives that drive a new rendering component.

**Pipeline:**
```
transcribe → analyze-captions (new worker job) → enriched manifest → CinematicSubtitle renderer
```

**Key principles:**
- Analysis runs automatically after every transcription — cinematic data is always available
- Presets opt-in to consuming the analysis via `useCinematicRenderer: true`
- Existing presets and renderers are completely unchanged
- Manifest stores analysis in a parallel `captionAnalysis` layer, keeping word timing data pure

## Data Model

### Manifest Extension

A new optional top-level field on `ManifestV2`, keyed by caption item ID:

```typescript
interface ManifestV2 {
  // ... existing fields unchanged ...
  captionAnalysis?: Record<string, CaptionAnalysis>
}

interface CaptionAnalysis {
  words: WordDirective[]
  sentences: SentenceDirective[]
  speakerEmphasis: EmphasisMarker[]
  metadata: {
    analyzedAt: string       // ISO timestamp
    model: string            // LLM model used
    version: number          // schema version for future compat
  }
}
```

**Zod schema:** A corresponding `captionAnalysisSchema` must be defined in `packages/shared/src/caption-analysis.ts` alongside the TypeScript interfaces, and referenced as an optional field in `manifestV2Schema` in `manifest-v2.ts`. This ensures validation does not strip the field during `manifestV2Schema.parse()`.

### Per-Word Directives

Every word gets classified by the AI. The renderer reads these to decide how each word looks, moves, and feels:

```typescript
interface WordDirective {
  wordIndex: number          // Absolute index into the caption item's words array

  // Emphasis tier — drives size scaling
  tier: 'hero'        // 2-3x scale, the showstopper (1-2 per sentence)
       | 'accent'     // 1.3-1.5x, supporting emphasis
       | 'normal'     // 1.0x, standard
       | 'whisper'    // 0.6-0.7x, diminished fillers

  // Font assignment — the luxury dual-font system
  fontRole: 'bold-sans'       // Impact, power (e.g., Montserrat Black)
           | 'elegant-cursive' // Elegance, emotion (e.g., Playfair Display)
           | 'default'         // Preset's base font

  // Per-word animation override (must match registered AnimationType names)
  animation: 'elastic-pop' | 'slide-up' | 'blur-zoom' | 'bounce-up'
            | 'typewriter' | 'fade-rise' | 'slam-down'
            | 'scale-bounce' | 'fade' | 'none'

  // Dramatic delay before this word appears (ms)
  // Frame-quantized at render time: Math.round(delayMs / (1000/fps)) frames
  entryDelayMs: number     // 0-300ms typical

  // Color assignment
  colorRole: 'primary'     // White (default)
            | 'accent'     // Gradient accent (red/orange/yellow)
            | 'glow'       // White + glow effect

  // Text transform override
  textTransform?: 'uppercase' | 'none'

  // Custom scale override (if AI wants finer control than tier)
  scaleOverride?: number   // e.g., 2.5 for a specific hero word
}
```

**Note on animation names:** All values in `animation` must correspond to registered names in `packages/renderer/src/animations/animations.ts`. The values listed above are validated against the current animation registry. The LLM prompt must include only these exact names.

### Per-Sentence Directives

After word-level classification, the AI composes words into sentences with layout and rhythm decisions:

```typescript
interface SentenceDirective {
  // [startIdx, endIdx) — exclusive end index into the caption item's words array.
  // All indices are absolute (not relative to sentence start).
  // Every word in the caption must be covered by exactly one SentenceDirective.
  wordRange: [number, number]

  // How words are grouped into display phrases.
  // wordIndices are absolute indices (same index space as wordRange).
  // Every index in wordRange must appear in exactly one phraseGroup.
  phraseGroups: {
    wordIndices: number[]      // which words in this phrase
    layout: 'single-line'      // all words on one line
           | 'stacked'        // hero word on its own line
           | 'split'          // two lines for contrast
           | 'cascade'        // words appear one by one, stacking
    alignment: 'center' | 'left' | 'right'
    durationMs: number         // 1000-2000ms max per phrase
  }[]

  // Overall sentence feel
  mood: 'dramatic' | 'urgent' | 'curious' | 'calm' | 'impactful'

  // Punctuation styling (curiosity hooks, emphasis)
  punctuationEffect?: 'question-pop'   // ? animates with bounce
                     | 'exclaim-shake'  // ! with shake effect
                     | 'ellipsis-fade'  // ... with fade-out
                     | 'none'
}
```

### Speaker Emphasis Markers

Derived from timing analysis — when the speaker stressed words through pacing, pauses, or repetition:

```typescript
interface EmphasisMarker {
  wordIndex: number
  confidence: number        // 0-1, how confident we are this was stressed
  type: 'slow-delivery'    // word spoken slower than avg
       | 'pause-before'    // significant pause before word
       | 'pause-after'     // significant pause after word
       | 'pace-change'     // sudden speed shift around word
  durationRatio: number    // word duration / avg word duration
}
```

### Relationship to Existing Word Classifications

The existing `dynamic-hierarchy.ts` module uses a separate tier system (`power/strong/medium/filler`) with `styleOverrides` baked into word data. The cinematic system (`hero/accent/normal/whisper`) is independent:

- **The cinematic renderer ignores `styleOverrides`** on caption words entirely. It reads only from `captionAnalysis`.
- **Existing presets ignore `captionAnalysis`** entirely. They continue reading `styleOverrides` (when `presetId === 'dynamic-hierarchy'`).
- The two systems coexist in the manifest without conflict — they write to different fields and are consumed by different renderers.

## Analysis Pipeline

### Worker Job: `analyze-captions`

A new BullMQ job type in the worker, auto-queued by the transcribe processor after transcription completes.

**Job data:**
```typescript
interface AnalyzeCaptionsJobData {
  projectId: string
  jobId: string
}
```

**Caption item ID resolution:** The job queries caption items from the database by `projectId`, not from the job payload. This avoids the need for the transcribe processor to return inserted IDs. Since `timelineItems` has no `projectId` column, the query joins through `tracks`:
```typescript
const subtitleTracks = await db.select().from(tracks)
  .where(and(eq(tracks.projectId, jobData.projectId), eq(tracks.type, 'subtitle')));
const trackIds = subtitleTracks.map(t => t.id);
const captionItems = trackIds.length > 0
  ? await db.select().from(timelineItems).where(inArray(timelineItems.trackId, trackIds))
  : [];
```

### Step 1: Speaker Emphasis Detection (Heuristic)

Pure math, no LLM call. Runs in ~10ms.

```typescript
function detectSpeakerEmphasis(words: CaptionWord[]): EmphasisMarker[] {
  // 1. Compute avg word duration (total duration / word count)
  // 2. Compute avg syllable rate (chars / duration as proxy)
  // 3. For each word:
  //    - slow-delivery: duration > 1.8x avg (adjusted for syllable count)
  //    - pause-before: gap from prev word > 400ms
  //    - pause-after: gap to next word > 400ms
  //    - pace-change: local 3-word window speed differs 2x from neighbors
  // 4. Confidence = deviation magnitude / threshold
}
```

### Step 2: LLM Pass 1 — Per-Word Classification

Send words + emphasis markers + timing to the LLM. Batch processing (200 words/request, matching existing transcription pattern).

**LLM input format per word:**
```
index | text | durationMs | emphasis-flags
```

Where emphasis-flags is a comma-separated list from EmphasisMarker results:
```
3 | empire | 480 | ⚡slow(2.1x),⚡pause-before(0.9)
5 | nothing | 350 | ⚡pause-after(0.85)
```
Words without emphasis markers show `—` in the emphasis column.

**LLM prompt directs:**
- 1-2 HERO words per sentence (the showstoppers, 2-3x size)
- Hero words = emotional peaks, key nouns, power verbs, numbers
- Words the speaker EMPHASIZED (marked with ⚡) should be hero/accent
- fontRole: bold-sans for impact/power, elegant-cursive for emotion/beauty/flow, default for everything else
- Animation matching word energy (using exact registered names):
  - `elastic-pop` / `slam-down` / `scale-bounce` → power/impact words
  - `fade-rise` / `slide-up` → emotional/flowing words
  - `typewriter` → technical/precise words
  - `bounce-up` → playful/energetic words
  - `none` → filler/diminished words
- entryDelayMs: 50-200ms for dramatic builds, 0 for rapid sequences

**LLM output:** JSON array of `WordDirective` objects.

### Step 3: LLM Pass 2 — Sentence Composition

Takes word-level directives and composes them into sentence-level layout decisions.

**LLM prompt directs:**
- Max 1-2 seconds per phrase on screen
- Hero words should get their own line (stacked layout) or dominate
- Use 'cascade' for dramatic builds (words appear one by one)
- Use 'split' when contrasting two ideas
- Vary alignment to create visual movement (don't always center)
- Set mood per sentence for ambient effect adjustment
- Flag punctuation for special effects (? → question-pop, ! → exclaim-shake, ... → ellipsis-fade)
- Every word index must be covered by exactly one phraseGroup — no gaps, no overlaps
- wordRange must use exclusive end: `[startIdx, endIdx)`

**LLM output:** JSON array of `SentenceDirective` objects.

### Step 4: Validation & Error Handling

Before writing results to the manifest, validate LLM output:

```typescript
function validateAnalysis(analysis: CaptionAnalysis, wordCount: number): ValidationResult {
  // 1. Every wordIndex in WordDirective[] must be in [0, wordCount)
  // 2. No duplicate wordIndex values
  // 3. Every word index must be covered by exactly one SentenceDirective.wordRange
  // 4. wordRange pairs must not overlap
  // 5. phraseGroup.wordIndices must be within their parent wordRange
  // 6. animation values must be in REGISTERED_ANIMATIONS set
  // 7. entryDelayMs must be in [0, 500] range
  // 8. tier, fontRole, colorRole must be valid enum values
}
```

**Fallback strategy on failure:**
- If LLM returns invalid JSON: retry once. On second failure, skip analysis for this caption item (subtitles still render via existing AnimatedSubtitle).
- If validation finds out-of-bounds indices: clamp to valid range.
- If validation finds missing word coverage: fill gaps with default directives (`{ tier: 'normal', fontRole: 'default', animation: 'fade-rise', entryDelayMs: 0, colorRole: 'primary' }`).
- If entire analysis job fails: log error, do not write `captionAnalysis` to manifest. Subtitles render normally via AnimatedSubtitle — the cinematic layer is purely additive.
- Partial results are acceptable: if 3 of 5 caption items succeed, write analysis for those 3.

### Step 5: Write to Manifest

The job writes `captionAnalysis` to the manifest via a new manifest operation:

```typescript
// New op added to ManifestOp discriminated union in manifest-ops.ts
// Uses 'op' discriminator key to match existing convention
| { op: 'update_caption_analysis'; captionAnalysis: Record<string, CaptionAnalysis> }
```

The op handler in the sandbox/workspace reads the current manifest, sets `manifest.captionAnalysis = op.captionAnalysis`, validates with Zod, and writes back.

If the workspace is active, the write goes through the workspace manifest file + WebSocket notification. If no workspace is active (analysis completed before workspace spinup), the data is stored in the project's `videoSettings` JSONB column (under a `captionAnalysis` key) and included when the workspace spins up via `dbToManifest()`.

**DB persistence:** The manifest is not stored as a whole JSON document — it is reconstructed from normalized tables by `dbToManifest()`. Since `captionAnalysis` has no corresponding normalized table, it is stored in `projects.videoSettings` JSONB:
- `dbToManifest()` in `manifest-convert.ts`: read `project.videoSettings.captionAnalysis` and attach to manifest
- `manifestToDb()` / `syncManifestToDb()`: extract `manifest.captionAnalysis` and write back to `projects.videoSettings.captionAnalysis`
- On workspace teardown, `captionAnalysis` persists in the DB and survives workspace recreation

### Re-analysis on Transcript Edit

When a user edits the transcript (re-transcription or manual word changes):
1. The existing `captionAnalysis` is deleted from the manifest (word indices are now invalid)
2. A new `analyze-captions` job is queued automatically
3. Until re-analysis completes, subtitles fall back to AnimatedSubtitle rendering

This is triggered by the same code path that handles transcript updates — when caption word data changes, invalidate and re-queue.

### Performance & Cost

| Metric | Value |
|--------|-------|
| Total analysis time | ~2-4 seconds |
| Cost per minute of transcript | ~$0.002 (GPT-4o-mini, ~200 words/min) |
| Blocking? | No — workspace loads in parallel, subtitles upgrade when analysis arrives |
| Re-runnable? | Yes — automatically re-runs on transcript edit, or user can manually trigger |

## Cinematic Renderer

### New Component: CinematicSubtitle

A new Remotion component alongside `AnimatedSubtitle` and `DynamicSubtitles`. Activated when `captionAnalysis` exists for a caption item and the preset has `useCinematicRenderer: true`.

**Component hierarchy:**

```
CinematicSubtitle
  └── PhraseLayout          (handles single-line / stacked / split / cascade)
        ├── CinematicWord    (per-word: font, scale, animation, delay, color)
        └── WordEffects      (glow, shadow, motion blur — tier-adjusted)
```

### CinematicSubtitle (Root)

- Finds the active `SentenceDirective` based on current frame time
- Finds the active `phraseGroup` within that sentence
- Renders the active phrase via `PhraseLayout`
- Manages phrase enter/exit transitions

### PhraseLayout

Handles 4 layout modes:

- **single-line**: All words on one line with varying sizes based on tier
- **stacked**: Hero word isolated on its own line, other words grouped above/below
- **split**: Two contrasting words on separate lines (for contrast pairs)
- **cascade**: Words appear one by one with staggered timing, stacking vertically

Uses flexbox with `alignment` from the sentence directive. Applies phrase-level enter/exit animations.

### CinematicWord

Per-word renderer that reads the `WordDirective`:

- **Font family**: looks up `fontRole` against `preset.cinematicFonts` config
- **Scale**: base from tier mapping (`hero: 2.5, accent: 1.4, normal: 1.0, whisper: 0.65`), overridden by `scaleOverride` if present. Responsive scaling: `scale * baseFontSize * (canvasWidth / 1080)`
- **Animation**: uses the word directive's `animation` field, resolved through the existing `resolveAnimation()` system
- **Entry delay**: adds `entryDelayMs` to the visual appearance time. Frame-quantized: `delayFrames = Math.round(entryDelayMs / (1000 / fps))`. The word's `startMs` from Whisper stays untouched — delay is purely visual.
- **Color**: maps `colorRole` against `preset.cinematicColors` config:
  - `primary` → `cinematicColors.primary` (solid)
  - `accent` → `cinematicColors.accentGradient` if available, else `cinematicColors.accent` (solid)
  - `glow` → `cinematicColors.primary` + glow effect using `cinematicColors.glow`
- **Text transform**: applies `textTransform` from directive

### WordEffects

Tier-adjusted effects using the existing `effectsToCss()` system:

| Tier | Glow | Shadow | Motion Blur |
|------|------|--------|-------------|
| hero | Full intensity | Strong drop shadow | On entrance animation |
| accent | Half intensity | Medium shadow | None |
| normal | None | Subtle shadow only | None |
| whisper | None | None | None |

### Tier → Visual Mapping

| Property | hero | accent | normal | whisper |
|----------|------|--------|--------|---------|
| Scale | 2.0-3.0x | 1.3-1.5x | 1.0x | 0.6-0.7x |
| Font Weight | 900 (Black) | 700 (Bold) | 500 (Medium) | 400 (Regular) |
| Font | From fontRole directive | From fontRole directive | Preset base font | Preset base font |
| Color | Accent gradient | Accent solid | Primary (white) | Primary @ 60% opacity |
| Glow | Full intensity | Half intensity | Subtle shadow only | None |
| Animation | From directive (strong) | From directive (medium) | fade-rise (gentle) | fade (minimal) |

## Preview & Export Rendering

### Web Editor Preview

The workspace codegen generates `PlayerComposition.tsx` which runs in the browser via the workspace player. The `CinematicSubtitle` component lives in the renderer package and is imported into the generated composition code:

```typescript
// Generated in PlayerComposition.tsx by workspace-codegen.ts
import { CinematicSubtitle } from './components/CinematicSubtitle'
```

The codegen copies `CinematicSubtitle.tsx`, `PhraseLayout.tsx`, `CinematicWord.tsx` into the workspace `src/` directory (same pattern used for other renderer components). The generated composition code reads `captionAnalysis` from the manifest and passes it as a prop.

**How captionAnalysis reaches the composition:**
The codegen embeds `captionAnalysis` as a constant in the generated code, alongside the existing per-item data:

```typescript
// Generated code
const CAPTION_ANALYSIS = ${JSON.stringify(manifest.captionAnalysis || {})};

// In caption rendering
const analysis = CAPTION_ANALYSIS[item.id];
if (analysis && __captionStyle.useCinematicRenderer) {
  return <CinematicSubtitle words={item.data.words} analysis={analysis} preset={__captionStyle} ... />;
} else {
  return <AnimatedSubtitle ... />;
}
```

This means both preview and export use the same `CinematicSubtitle` component — WYSIWYG is guaranteed.

### Export Rendering

The Remotion `renderMedia()` call uses the same bundled composition. No separate export path needed — the `CinematicSubtitle` component works identically in headless Chrome.

### Font Loading

All three cinematic font families must be available in all rendering contexts:

| Context | Mechanism | Action Needed |
|---------|-----------|---------------|
| Preview (browser) | Google Fonts `<link>` tags via `font-registry.ts` | Codegen adds link tags for cinematicFonts families |
| Remotion export | `@remotion/google-fonts` in `remotion-entry.tsx` | Montserrat + Playfair Display already imported; verify Inter is present |
| FFmpeg/ASS export | TTF download to local cache | Existing font download pipeline handles Google Font families |

## Preset Integration

### New Fields on SubtitlePreset

4 new optional fields — all existing presets are unaffected. The corresponding `manifestCaptionPresetSchema` Zod schema in `manifest-shared.ts` must also be updated with these optional fields to prevent Zod stripping them during `manifestV2Schema.parse()`:

```typescript
interface SubtitlePreset {
  // ... all existing fields unchanged ...

  useCinematicRenderer?: boolean   // default false

  cinematicFonts?: {
    boldSans: string
    elegantCursive: string
    default: string
  }

  cinematicColors?: {
    primary: string
    accent: string
    accentGradient?: string  // CSS gradient for hero words
    glow: string
  }

  cinematicScales?: {
    hero: number             // default 2.5
    accent: number           // default 1.4
    normal: number           // default 1.0
    whisper: number          // default 0.65
  }
}
```

### Default Cinematic Preset: "Cinematic Luxe"

The first preset opting into the cinematic renderer. Luxury aesthetic for viral vertical video.

The preset's `displayMode` is `'phrase'` with `supportedModes: ['phrase']`. This is intentionally restrictive — cinematic rendering is inherently phrase-based (the AI composes words into phrase groups with specific layouts). Word-by-word and karaoke modes do not apply because the cinematic renderer manages its own word display timing and grouping.

```typescript
'cinematic-luxe': {
  id: 'cinematic-luxe',
  name: 'Cinematic Luxe',

  // Base typography
  fontFamily: 'Inter',
  fontSize: 42,
  fontWeight: 500,
  letterSpacing: 0.5,
  lineHeight: 1.3,

  // Colors
  color: '#FFFFFF',
  activeColor: '#FFD700',
  backgroundColor: 'transparent',
  activeBackgroundColor: 'transparent',

  // Effects
  effects: {
    shadow: { offsetX: 0, offsetY: 2, blur: 8, color: '#000000', opacity: 0.6 },
    shadowSecondary: null,
    glow: { enabled: true, color: '#FFA500', intensity: 0.35, size: 20 },
  },

  // Animation (default — per-word overrides come from analysis)
  animation: { in: 'fade-rise', active: 'none', out: 'fade', easing: 'ease-out' },

  // Display + Position (center, slightly above middle to avoid bottom UI)
  displayMode: 'phrase',
  position: { anchor: 'center', offsetX: 0, offsetY: -5, rotation: 0, textAlign: 'center' },
  supportedModes: ['phrase'],

  // Cinematic config
  useCinematicRenderer: true,
  cinematicFonts: {
    boldSans: 'Montserrat',
    elegantCursive: 'Playfair Display',
    default: 'Inter',
  },
  cinematicColors: {
    primary: '#FFFFFF',
    accent: '#FFD700',
    accentGradient: 'linear-gradient(135deg, #FF6B6B, #FFA500, #FFD700)',
    glow: '#FFA500',
  },
  cinematicScales: {
    hero: 2.5,
    accent: 1.4,
    normal: 1.0,
    whisper: 0.65,
  },
}
```

### Codegen Integration

In `workspace-codegen.ts` — PlayerComposition generation:

1. Detect cinematic fonts from preset config and add `@remotion/google-fonts` imports for all 3 font families
2. Embed `manifest.captionAnalysis` as a `CAPTION_ANALYSIS` constant in the generated code
3. In caption rendering section: check if `CAPTION_ANALYSIS[item.id]` exists AND `__captionStyle.useCinematicRenderer` is true
4. If yes → render with `CinematicSubtitle`; otherwise → existing `AnimatedSubtitle` fallback
5. Copy `CinematicSubtitle.tsx`, `PhraseLayout.tsx`, `CinematicWord.tsx` into workspace `src/components/`

### WebSocket Notification

Since analysis runs async after transcription:

1. `analyze-captions` job completes
2. Writes `captionAnalysis` to manifest via `update_caption_analysis` op
3. Emits `manifest:updated` via WebSocket
4. Editor reloads manifest + re-bundles composition
5. If cinematic preset is selected, subtitles seamlessly upgrade to cinematic rendering

**User experience:** User opens the editor immediately after transcription. Subtitles appear with basic styling. 2-4 seconds later, cinematic analysis arrives — subtitles upgrade to cinematic rendering without any user action.

## Files Changed

### New Files
| File | Purpose |
|------|---------|
| `packages/worker/src/processors/analyze-captions.ts` | New worker job: emphasis detection + LLM analysis + validation |
| `packages/renderer/src/components/CinematicSubtitle.tsx` | Root cinematic renderer component |
| `packages/renderer/src/components/PhraseLayout.tsx` | Phrase layout modes (single-line, stacked, split, cascade) |
| `packages/renderer/src/components/CinematicWord.tsx` | Per-word cinematic renderer with effects |
| `packages/shared/src/caption-analysis.ts` | Shared types + Zod schemas (CaptionAnalysis, WordDirective, SentenceDirective, EmphasisMarker) |

### Modified Files
| File | Change |
|------|--------|
| `packages/shared/src/manifest-v2.ts` | Add optional `captionAnalysis` field to ManifestV2 type + Zod schema |
| `packages/shared/src/manifest-ops.ts` | Add `update_caption_analysis` op to ManifestOp union |
| `apps/web/src/lib/subtitle-presets.ts` | Add `useCinematicRenderer`, `cinematicFonts`, `cinematicColors`, `cinematicScales` fields + "Cinematic Luxe" preset |
| `packages/worker/src/processors/transcribe.ts` | Queue `analyze-captions` job after transcription completes |
| `packages/api/src/workspace/workspace-codegen.ts` | Conditional CinematicSubtitle import, embed captionAnalysis, copy component files, font imports |
| `packages/shared/src/manifest-convert.ts` | Read/write `captionAnalysis` from/to `projects.videoSettings` in `dbToManifest()` and `syncManifestToDb()` |
| `packages/shared/src/manifest-shared.ts` | Add 4 new optional fields to `manifestCaptionPresetSchema` Zod schema |
| `packages/renderer/src/remotion-entry.tsx` | Verify Montserrat + Playfair Display + Inter font imports present |

### Unchanged
- `AnimatedSubtitle.tsx` — no modifications
- `DynamicSubtitles.tsx` — no modifications
- All 9 existing presets — no modifications
- Editor store — no modifications
