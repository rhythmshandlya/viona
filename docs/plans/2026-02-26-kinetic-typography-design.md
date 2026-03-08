# Kinetic Typography Visual Style

## Summary

Add a "kinetic-typography" visual style to the existing Director/Animator pipeline. When selected, the Director plans scenes as text cards (2-8 words per card with background colors, emphasis words, doodle annotations) instead of data visualizations. The Animator generates Remotion components that render full-screen colored backgrounds with large animated text and hand-drawn SVG doodle overlays.

## Architecture

Same Director → Animator → Render pipeline, different prompts and output style.

```
User uploads video/audio
  → Selects "Kinetic Typography" style + brand colors + resolution
  → Director agent gets kinetic-typography-specific system prompt
  → Director plans scenes: word grouping, bg colors, emphasis words, doodles
  → Animator agent gets kinetic-typography-specific system prompt
  → Animator generates Remotion components: Scene, PhraseReveal, WordByWord, Doodle* components
  → Renders via existing pipeline
  → Displayed in editor as visual layer (PiP, split, fullscreen, overlay)
```

## Director Changes

New mode when `style === "kinetic-typography"`:

1. Groups transcript words into text cards (2-8 words each)
2. Assigns background colors from user's palette (3 colors, rotating, never 3x in a row)
3. Picks text color per scene (contrast against background)
4. Selects displayMode per scene: `"phrase"` (short punchy) or `"word-by-word"` (dramatic reveal)
5. Picks 1 emphasis word per scene with doodle type: `underline` (50%), `circle` (20%), `arrow` (15%), `checkmark` (10%), `null` (5%)
6. Outputs `scenes.json` in kinetic-typography-specific schema

### Scene Schema (Director Output)

```json
{
  "segments": [{
    "id": 1,
    "text": "Every product",
    "words": [{ "word": "Every", "start": 0.48, "end": 0.72 }],
    "startTime": 0.48,
    "endTime": 1.12,
    "background": "#00E556",
    "textColor": "#000000",
    "displayMode": "phrase",
    "emphasis": { "word": "product", "doodle": "underline" }
  }]
}
```

## Animator Changes

Generates these Remotion components:

- **Scene.tsx** — full-screen colored background + text + doodle container
- **PhraseReveal.tsx** — whole phrase scales/fades in with spring animation
- **WordByWord.tsx** — words pop in one at a time synced to timestamps
- **DoodleUnderline.tsx** — hand-drawn wavy SVG underline with stroke-draw animation
- **DoodleCircle.tsx** — hand-drawn ellipse around emphasis word
- **DoodleArrow.tsx** — curved arrow pointing to word
- **DoodleCheckmark.tsx** — hand-drawn check next to word
- **styles.ts** — user's brand colors, font sizes (60-120px), weights (900)

All components use Remotion primitives (`spring`, `Sequence`, `interpolate`). Hard cuts between scenes, no dissolves.

## Visual Style

| Element | Description |
|---------|-------------|
| Backgrounds | Alternating solid fills from user's 3 brand colors |
| Typography | Clean heavy sans-serif (Inter Black or user-chosen), 60-120px, centered |
| Text animation | Phrase: scale 0.7→1 with spring. Word-by-word: scale 0.5→1 per word synced to timestamps |
| Doodle annotations | Hand-drawn SVG overlays with stroke-draw animation (spring-based), appear ~6 frames after text |
| Doodle colors | Contrast against background (white on dark, dark on light) |
| Transitions | Hard cuts, no dissolves. Occasional quick scale-up over 3-5 frames |
| Pacing | Fast — each text card 0.6-4 seconds matching voiceover speed |

## User Inputs (StyleSelectionModal)

| Input | Required | Default |
|-------|----------|---------|
| Brand color 1 (accent) | Yes | `#00E556` |
| Brand color 2 (dark) | Yes | `#000000` |
| Brand color 3 (light) | Yes | `#EBEBEB` |
| Resolution | Yes | Current project canvas size |
| Font family | No | Inter Black |

## Files to Change

| File | Change |
|------|--------|
| `packages/worker/src/agents/prompts/director.py` | Add kinetic-typography scene planning mode |
| `packages/worker/src/agents/prompts/animator.py` | Add kinetic-typography component generation instructions |
| `apps/web/src/features/editor-v2/components/StyleSelectionModal.tsx` | Add "kinetic-typography" style with color pickers + resolution selector |
| `apps/web/src/lib/api.ts` | Add `StylePreset` enum value if needed |

## What Stays the Same

- Rendering pipeline (Remotion bundling, FFmpeg)
- Layout system (PiP, split, fullscreen, overlay)
- Timeline, captions, export — all untouched
- The visual layer renders kinetic typography instead of charts/diagrams
