# Caption Director Design

**Date:** 2026-02-24
**Status:** Approved
**Approach:** Single-Pass Upgrade (Approach A)

## Overview

Upgrade the existing `generate-caption-styles.ts` into a "Caption Director" that runs as a blocking step after transcription. It analyzes the full transcript, classifies every word into one of 5 tiers, selects a preset, and generates both per-caption and per-word style overrides in a single Claude API call.

## Pipeline Integration

```
Transcribe → Create subtitle items → Caption Director → Project ready
```

- Runs inline at the end of `processTranscribeJob()` in `transcribe.ts`, after subtitle items are inserted and before project status is set to `ready`.
- Progress: subtitle creation ends at 85%, Caption Director runs 85-95%, final cleanup 95-100%.
- No new job type or queue. Single function call.
- **Graceful degradation:** If the Caption Director fails, it logs a warning and proceeds. Captions work with default styling, just without AI enhancements.

## Word Classification System

5 tiers with context-aware AI classification:

| Tier | When | Visual Treatment |
|------|------|-----------------|
| **Emphasis** | Key nouns, brands, numbers, superlatives | scale: 1.4, fontWeight: 900, activeColor from palette |
| **Emotional** | Feeling words, exclamations, dramatic moments | scale: 1.2, fontWeight: 700, warm/cool color shift |
| **Action** | Verbs, CTAs ("subscribe", "click", "try") | scale: 1.15, fontWeight: 800, uppercase |
| **Normal** | Standard words | No overrides (inherits base style) |
| **Filler** | Articles, prepositions, conjunctions | scale: 0.85, fontWeight: 400, lighter color |

The AI understands context — "Apple" in a tech video gets emphasis, but not in a cooking video.

## AI Prompt & Response Format

### Prompt sends:
- Full caption list with text + timing
- All words nested under each caption with indices
- List of available presets (id + short description)
- Available fonts

### AI returns a single JSON object:

```json
{
  "presetId": "dynamic-flow",
  "tone": "energetic",
  "captionOverrides": [
    { "index": 0, "activeColor": "#FF3366", "fontSize": 68, "textTransform": "uppercase" },
    { "index": 3, "effects": { "glow": { "enabled": true, "color": "#FFD700", "intensity": 0.6, "size": 20 } } }
  ],
  "wordOverrides": {
    "0:2": { "tier": "emphasis", "scale": 1.4, "fontWeight": 900 },
    "0:5": { "tier": "filler", "scale": 0.85 },
    "1:0": { "tier": "action", "scale": 1.15, "textTransform": "uppercase" },
    "2:3": { "tier": "emotional", "scale": 1.2, "color": "#FF6B6B" }
  }
}
```

- `captionOverrides` — sparse, only captions that need changes
- `wordOverrides` — sparse, only non-normal words. Key format `captionIndex:wordIndex`
- `presetId` — AI-selected from available presets, written to each caption's `style.presetId`
- Tier-to-style mapping done server-side after parsing. AI provides tier label + optional per-word style value overrides for context-specific styling (e.g., brand name getting a specific color)

### Parsing & Sanitization

- `parseCaptionDirectorResponse()` replaces existing `parseAiResponse()`
- Reuses `sanitizeStyleOverride()` for caption-level overrides
- New `sanitizeWordOverride()` for word-level overrides
- Validates tiers, clamps numeric ranges, validates hex colors

## "Dynamic Flow" Preset

New preset in `subtitle-presets.ts`, category `motion`:

```
id: "dynamic-flow"
category: "motion"
fontFamily: "Outfit"
fontSize: 56
fontWeight: 600
color: "#FFFFFF"
activeColor: "#00FF88"
backgroundColor: "transparent"
activeBackgroundColor: "transparent"
displayMode: "karaoke"
wordsPerPhrase: 6
textTransform: "none"
letterSpacing: 1
stroke: { width: 2.5, color: "#000000" }
effects: subtle drop shadow, no glow (reserved for AI emphasis moments)
animation: { in: "elastic-pop", active: "none", out: "none", easing: "spring" }
position: bottom-center
```

Neutral white base with green active highlight, spring-animated entry, clean stroke. The AI's word-level overrides create the "flow" — emphasis words pop bigger, fillers shrink, emotional words shift color. Works standalone without AI styling as a clean karaoke preset.

## Database & Type Changes

### Shared types (`packages/shared/src/types/index.ts`)

Add to `WordStyleOverrides`:
- `activeColor?: string`
- `textTransform?: 'none' | 'uppercase' | 'lowercase'`

(Both already exist in the renderer's local type but missing from shared.)

Add to `SubtitleData`:
- `aiWordOverrides?: Record<number, WordStyleOverrides>` — stores original AI overrides keyed by word index, enables "Reset to AI" functionality

### Database writes

After parsing AI response, iterate subtitle timeline items:
1. Set `data.style.presetId` to AI-selected preset on all caption items
2. Write `data.styleOverrides` per caption (same pattern as today)
3. Write `data.words[i].styleOverrides` per word
4. Write `data.aiWordOverrides` with the AI originals for reset support

Single pass, one `db.update()` per item.

## Preview Override Flow

When users land on the preview screen:
- Captions render with AI-applied word overrides immediately (already supported by renderer)
- Clicking a word in TranscriptPanel opens existing WordToolbar
- Words with AI overrides show dotted underline indicator (already exists)
- Users edit via WordToolbar — changes write to `word.styleOverrides`, overwriting AI values
- **New:** "Reset to AI" button on WordToolbar copies from `aiWordOverrides[wordIndex]` back to `words[wordIndex].styleOverrides`

## Files Changed

| File | Change |
|------|--------|
| `packages/shared/src/types/index.ts` | Add `activeColor`, `textTransform` to `WordStyleOverrides`; add `aiWordOverrides` to `SubtitleData` |
| `packages/worker/src/processors/generate-caption-styles.ts` | Full rewrite: new prompt, new response parser, word-level override logic |
| `packages/worker/src/processors/transcribe.ts` | Call Caption Director after subtitle creation, adjust progress percentages |
| `apps/web/src/lib/subtitle-presets.ts` | Add "dynamic-flow" preset |
| `apps/web/src/features/editor-v2/panels/WordToolbar.tsx` | Add "Reset to AI" button |
| `packages/renderer/src/components/AnimatedSubtitle.tsx` | Align local `WordStyleOverrides` with shared type (already has the fields) |
