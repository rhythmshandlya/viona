# Studio Theme Architecture — Design Doc

**Goal:** Remove all non-studio themes, keep only `studio-dark` and `studio-light`, and make theme injection clean, robust, and error-free across the entire pipeline.

## Problem

1. 9 style presets exist but only `studio` has real assets (templates, design system). The other 8 are just text descriptions the AI freestyles from — inconsistent results.
2. The `studio` preset lumps dark and light palettes into one prompt and says "dark mode (default)" — the AI always picks dark, light mode is unusable.
3. Background.tsx is generated creatively by the setup agent, which reads the Director's topic-specific visual continuity notes and bakes them into the shared background (e.g., pool lanes for a swimming video). The background should be a fixed Studio template pattern.
4. Theme colors are scattered across 4+ files with no single source of truth.

## Architecture

### Theme as Data, Not Prose

Define a `STUDIO_THEMES` dictionary as the single source of truth for color palettes:

```python
STUDIO_THEMES = {
    "studio-dark": {
        "variant": "dark",
        "background": "#0B0F1A",
        "text": "#FFFFFF",
        "textMuted": "rgba(255,255,255,0.45)",
        "gridColor": "rgba(255,255,255,0.04)",
        "cardBg": "rgba(255,255,255,0.06)",
        "cardBorder": "rgba(255,255,255,0.10)",
        "accentDefault": "#6366F1",
        "secondaryDefault": "#EC4899",
    },
    "studio-light": {
        "variant": "light",
        "background": "#F8F9FB",
        "text": "#111827",
        "textMuted": "rgba(0,0,0,0.45)",
        "gridColor": "rgba(0,0,0,0.04)",
        "cardBg": "rgba(0,0,0,0.04)",
        "cardBorder": "rgba(0,0,0,0.08)",
        "accentDefault": "#6366F1",
        "secondaryDefault": "#EC4899",
    },
}
```

### Prompt Injection

One shared `STUDIO_DESIGN_SYSTEM_TEMPLATE` with `{background}`, `{text}`, `{gridColor}`, etc. placeholders. `get_studio_section(style_preset)` resolves the correct theme and formats the template. The AI only sees the selected palette — no ambiguity.

The template workflow section adds: "When adapting template code, use `BACKGROUNDS.{variant}`" so the Animator picks the correct variant from template constants.

### Background.tsx — Verbatim Injection

The setup prompt includes a complete, copy-paste Background.tsx code block (like it already does for motion tokens). Colors come from the theme dict. The setup agent copies it exactly — no creative freedom on the background. Topic-specific visuals belong in scene files only.

### Template Library

No changes to templates themselves. They already have `BACKGROUNDS.dark` and `BACKGROUNDS.light` variants. The prompt tells the Animator which variant to use based on the selected theme.

### Pipeline Flow

```
User picks studio-dark or studio-light in StyleSelectionModal
  → agent-tools.ts validates via Zod enum ['studio-dark', 'studio-light']
  → BullMQ job carries stylePreset
  → plan-visuals.ts passes --style-preset to Python CLI
  → Director uses STYLE_PRESET_DESCRIPTIONS[style_preset] (one entry per theme, colors filled from dict)
  → Director outputs scenes.json with suggestedTemplates
  → generate-visuals.ts copies templates to workspace (triggers for both studio-dark and studio-light)
  → Animator setup agent gets verbatim Background.tsx + theme-specific design system
  → Animator scene agents get "use BACKGROUNDS.{variant}" instruction
  → Templates adapted with correct color variant
```

## Files Changed

| Layer | File | Change |
|-------|------|--------|
| Frontend type | `apps/web/src/lib/api.ts` | `StylePreset = 'studio-dark' \| 'studio-light'` |
| Frontend modal | `apps/web/src/features/editor-v2/components/StyleSelectionModal.tsx` | Remove 7 presets, show studio-dark and studio-light only, remove kinetic-typography brand colors UI |
| Agent tools | `packages/api/src/agent/agent-tools.ts` | Zod enum → `['studio-dark', 'studio-light']`, update type casts |
| Agent system prompt | `packages/api/src/agent/agent-system-prompt.ts` | Update any style preset references |
| Director prompt | `packages/worker/src/agents/prompts/director.py` | Remove 8 preset descriptions, keep one studio template with color placeholders filled from `STUDIO_THEMES` |
| Animator prompt | `packages/worker/src/agents/prompts/animator.py` | Add `STUDIO_THEMES` dict, template `STUDIO_DESIGN_SYSTEM` with placeholders, verbatim Background.tsx in setup prompt, `BACKGROUNDS.{variant}` instruction in template workflow |
| Visual generator | `packages/worker/src/agents/claude_visual_generator.py` | `get_studio_section()` accepts `studio-dark` and `studio-light` |
| Generate visuals | `packages/worker/src/processors/generate-visuals.ts` | Template copy triggers for `stylePreset.startsWith('studio')` instead of `=== 'studio'` |
| Plan visuals | `packages/worker/src/processors/plan-visuals.ts` | No logic change (pass-through) |

## What Gets Deleted

- `STYLE_PRESET_DESCRIPTIONS` entries for: minimal, modern, playful, bold, classic, apple, google, kinetic-typography
- Kinetic-typography special handling: brand colors UI, special Director warning, display mode logic
- Frontend style options for all 7 removed presets
- Any `kinetic-typography` conditionals in the pipeline

## What Stays

- Template library (shared between dark and light)
- Animation lifecycle, spring configs, font pairs
- Director scene planning structure, suggestedTemplates
- Remotion workspace structure
- All existing template source code
