# Typography Pairings for Dynamic Subtitle System

**Date:** 2026-03-23
**Status:** Approved

## Summary

Add a typography pairing system that assigns two fonts per subtitle — a **display font** for power/strong words and a **body font** for medium/filler words. The cinematic analysis pipeline (LLM) selects the best pairing per video based on transcript tone. Applies to both the dynamic hierarchy renderer and the cinematic renderer.

## Typography Pairing Map

New shared module: `packages/shared/src/typography-pairings.ts`

### Interface

```ts
export type TypographyPairingId =
  | 'montserrat-inter'
  | 'oswald-roboto'
  | 'bebas-opensans'
  | 'playfair-lato'
  | 'anton-nunito'
  | 'poppins-dmsans'
  | 'robotocond-sourcesans'
  | 'spacegrotesk-inter';

export const DEFAULT_TYPOGRAPHY_PAIRING_ID: TypographyPairingId = 'montserrat-inter';

export interface TypographyPairing {
  id: TypographyPairingId;
  name: string;         // e.g. "Montserrat + Inter"
  vibe: string;         // e.g. "Modern / Versatile"
  displayFont: {        // Used for power + strong words
    family: string;
    weight: number;
  };
  bodyFont: {           // Used for medium + filler words
    family: string;
    weight: number;
  };
}
```

### Pairings (all 8)

| ID | Display Font | Body Font | Vibe |
|----|-------------|-----------|------|
| `montserrat-inter` | Montserrat 800 | Inter 500 | Modern / Versatile |
| `oswald-roboto` | Oswald 700 | Roboto 500 | YouTube / Bold Energy |
| `bebas-opensans` | Bebas Neue 400 | Open Sans 500 | High Impact / Cinematic |
| `playfair-lato` | Playfair Display 800 | Lato 400 | Elegant / Editorial |
| `anton-nunito` | Anton 400 | Nunito 600 | Viral / Social Media |
| `poppins-dmsans` | Poppins 800 | DM Sans 500 | Friendly / Rounded |
| `robotocond-sourcesans` | Roboto Condensed 900 | Source Sans 3 400 | Professional / Clean |
| `spacegrotesk-inter` | Space Grotesk 700 | Inter 500 | Tech / Startup |

**Note:** Nunito uses weight 600 (not 500) because 500 is not in `FONT_REGISTRY`.

Default fallback: `montserrat-inter` (via `DEFAULT_TYPOGRAPHY_PAIRING_ID`).

Exported as `TYPOGRAPHY_PAIRINGS: Record<TypographyPairingId, TypographyPairing>` and helper `getPairing(id: string): TypographyPairing` (falls back to default pairing for unknown IDs) from `@viona/shared`.

## Pipeline Extension

### Changes to Zod schema (`packages/shared/src/caption-analysis.ts`)

The canonical `CaptionAnalysis` type is a Zod schema. Add `typographyPairingId` as **optional with default** to avoid breaking existing stored data:

```ts
export const captionAnalysisSchema = z.object({
  words: z.array(wordDirectiveSchema),
  sentences: z.array(sentenceDirectiveSchema),
  speakerEmphasis: z.array(emphasisMarkerSchema),
  typographyPairingId: z.string().optional().default('montserrat-inter'),  // NEW
  metadata: captionAnalysisMetadataSchema,
});
```

The optional + default ensures existing `captionAnalysis` records without this field parse correctly and default to `montserrat-inter`.

### Changes to `analyze-captions.ts`

1. Update the local mirrored `CaptionAnalysis` interface to include `typographyPairingId: string`.
2. Extend the LLM system prompt with the list of pairing IDs and vibes:

```
TYPOGRAPHY PAIRING (pick ONE id based on content tone):
- montserrat-inter: Modern / Versatile (tech, education, general)
- oswald-roboto: YouTube / Bold Energy (reactions, commentary, gaming)
- bebas-opensans: High Impact / Cinematic (trailers, dramatic, storytelling)
- playfair-lato: Elegant / Editorial (luxury, fashion, documentary)
- anton-nunito: Viral / Social Media (trends, challenges, memes)
- poppins-dmsans: Friendly / Rounded (lifestyle, cooking, DIY)
- robotocond-sourcesans: Professional / Clean (business, news, corporate)
- spacegrotesk-inter: Tech / Startup (product demos, dev content, SaaS)

Return in JSON: { "words": [...], "typographyPairingId": "<id>" }
```

3. Validate the returned ID against `TYPOGRAPHY_PAIRINGS` keys. Fallback to `DEFAULT_TYPOGRAPHY_PAIRING_ID` if invalid.
4. Update `validateAndRepairAnalysis` to validate `typographyPairingId` against the pairing map and fallback to default if unknown.

## Integration: Dynamic Hierarchy

The dynamic hierarchy system (`packages/shared/src/dynamic-hierarchy.ts`) classifies words into 4 tiers. At render time, when the subtitle has a `captionAnalysis` with a `typographyPairingId`:

1. Look up `captionAnalysis.typographyPairingId` from the project's videoSettings.
2. Resolve the `TypographyPairing` from the map via `getPairing()`.
3. Apply fonts per tier:
   - **power** + **strong** → `displayFont.family` at `displayFont.weight`
   - **medium** + **filler** → `bodyFont.family` at `bodyFont.weight`

**Important:** The local `classifyWordTier()` functions in both `AnimatedSubtitle.tsx` files (renderer and sandbox) currently only return 3 tiers (`power`, `medium`, `filler`) — they lack `strong`. These must be updated to import from `@viona/shared` or add the `strong` tier locally. Without this, the display font would only apply to `power` words.

This applies in all three rendering paths:
- **Web preview** (`WorkspacePlayer.tsx` / `CaptionItem.tsx`) — via direct tier-based font lookup
- **Remotion renderer** (`AnimatedSubtitle.tsx`) — via direct tier-based font lookup
- **FFmpeg/ASS export** (`render-template.ts`) — both fonts downloaded, ASS styles use appropriate font per tier

## Integration: Cinematic Renderer

When the preset is `cinematic-luxe`:

1. Look up `captionAnalysis.typographyPairingId`.
2. Map to `cinematicFonts`:
   - `displayFont.family` → `boldSans`
   - `bodyFont.family` → `default`
   - `elegantCursive`: If the pairing's display font is a serif (e.g. `playfair-lato`), use a different cursive to avoid duplication with `boldSans`. Otherwise, keep the preset default (Playfair Display).
3. Override the preset's `cinematicFonts` at render time with the pipeline-selected pairing.

## Font Loading

All fonts in the 8 pairings are already in `FONT_REGISTRY` (`font-registry.ts`), so:
- Browser preview: load both fonts via Google Fonts `<link>` tags
- Remotion headless: `@remotion/google-fonts` in `remotion-entry.tsx`
- FFmpeg export: download TTFs via CSS API (existing pipeline in `render-template.ts`)

No new fonts need to be added to the registry.

## Files Changed

| File | Change |
|------|--------|
| `packages/shared/src/typography-pairings.ts` | **NEW** — pairing map, types, `getPairing()` helper |
| `packages/shared/src/caption-analysis.ts` | Add `typographyPairingId` to Zod schema (optional + default) |
| `packages/shared/src/index.ts` | Export new module |
| `packages/worker/src/processors/analyze-captions.ts` | Add `typographyPairingId` to local mirror, extend LLM prompt, validate in repair fn |
| `packages/renderer/src/components/AnimatedSubtitle.tsx` | Add `strong` tier to local `classifyWordTier`, resolve font per tier from pairing |
| `packages/sandbox/template/src/composition/AnimatedSubtitle.tsx` | Same as above |
| `packages/sandbox/template/src/items/CaptionItem.tsx` | Resolve font per tier from pairing |
| `apps/web/src/features/editor-v2/player/WorkspacePlayer.tsx` | Preview: resolve pairing fonts |
| `packages/worker/src/processors/render-template.ts` | FFmpeg export: download both pairing fonts, use in ASS |
| `packages/shared/src/caption-analysis.test.ts` | Tests for new field parsing and default behavior |
