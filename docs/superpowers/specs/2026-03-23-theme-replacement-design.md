# Theme Replacement: Studio → Blackboard + Magazine

## Goal

Replace the studio-dark/studio-light theme family with two purpose-built themes — **Blackboard Glow** (explainer videos) and **Magazine** (informative media) — that match the existing template libraries. Rename all studio-specific functions to generic names for future many-to-many theme/genre support.

## Architecture

The current theme system has two tiers: a prompt-level tier (themes.json + design-system.md + style-guide.md in `prompts/themes/`) and a template-level tier (JSON metadata + component code in `packages/templates/`). The studio theme family is the only one wired into the prompt tier. Blackboard and magazine have rich template libraries (25+ magazine, 8+ blackboard) but no prompt-tier integration.

This spec replaces the studio prompt-tier files with blackboard and magazine equivalents, updates the registry, renames studio-specific pipeline functions to generic names, and wires genre selection from the theme's `genre` field.

## Tech Stack

- Python (theme_loader.py, animator.py, pipeline files)
- TypeScript (theme-loader.ts, ThemePicker.tsx, prompt-loader.ts)
- Markdown (design-system.md prompt files)
- JSON (themes.json registry)

---

## 1. themes.json Registry

**Delete** both `studio-dark` and `studio-light` entries.

**Add** `blackboard` and `magazine`:

```json
{
  "themes": {
    "blackboard": {
      "family": "blackboard",
      "label": "Blackboard Glow",
      "genre": "explainer-videos",
      "templateTags": ["blackboard-theme"],
      "colors": {
        "background": "#0a0a14",
        "text": "#f1f5f9",
        "textMuted": "rgba(241,245,249,0.45)",
        "accent": "#f59e0b",
        "secondary": "#06b6d4"
      }
    },
    "magazine": {
      "family": "magazine",
      "label": "Magazine",
      "genre": "informative-media",
      "templateTags": ["magazine-theme"],
      "colors": {
        "background": "#ffffff",
        "text": "#0f172a",
        "textMuted": "rgba(15,23,42,0.45)",
        "accent": "#e11d48",
        "secondary": "#64748b"
      }
    }
  }
}
```

Key changes vs studio:
- No `variant` field — each theme is a single look
- New `genre` field — 1:1 mapping to strategy (data-driven, removable for future many-to-many)
- Colors sourced from existing template constants (blackboard/constants.ts, magazine/constants.ts)
- Dropped studio-specific color keys (`gridColor`, `cardBg`, `cardBorder`) — each design-system.md defines its own background/container conventions

## 2. Theme Prompt Files

### Delete

- `themes/studio/design-system.md`
- `themes/studio/dark/style-guide.md`
- `themes/studio/light/style-guide.md`
- `themes/studio/` directory entirely

### Create: `themes/blackboard/design-system.md`

Content derived from existing blackboard template patterns (definition, process, cause-effect, stats, bar-chart):

**Background pattern:** `BoardTexture` component — radial gradient center `#0c0c28` to edge `#09090b`, feTurbulence fractal noise overlay (baseFrequency 0.55, 4 octaves, opacity 0.05), radial vignette fading to `rgba(0,0,0,0.4)` at edges. MANDATORY in every non-overlay scene (replaces studio's DotGrid).

**Container pattern:** `GlowPanel` — surface color `#18181b` with border `#27272a`, top highlight, box-shadow glow. `GlowCircle` for numbered steps. `GlowBorder` for outline-only containers. No solid card containers like studio.

**Color immersion rules:** Theme colors from constants.ts MUST be used (same principle as studio — Director's colorPalette is topic hint only):
```tsx
export const THEME = {
  background: '{background}',
  text: '{text}',
  textMuted: '{textMuted}',
  accent: '{accent}',
  secondary: '{secondary}',
};
```

**Typography:** Inter (heading 600wt, body 400-500wt), Fira Code (mono/data 700wt). FONT_PAIRS key: `cleanMinimal`. Letter-spacing: headings `-0.025em`, labels `0.05em` uppercase.

**Animation language:** "Neon bloom" — glow appears first (half duration), then content scales in (0.97→1.0). Two-phase via `glowFadeIn()` pattern. Exit: fade out + glowScale shrink. Stagger: 7 frames between elements. Easing: `bezier(0.25, 0.1, 0.25, 1.0)`.

**Glow conventions:** Amber glow: `drop-shadow(0 0 6px rgba(255,140,66,0.5))`. Cyan bars: `boxShadow: '0 0 10px rgba(77,216,232,0.3)'`. Scale-based intensity: `0 0 ${progress * 40}px rgba(255,140,66,${progress * 0.2})`.

**Rendering rules:** Same as studio — pure inline styles, SVG graphics, `useScale()` for all pixel values, `interpolate()` with extrapolate clamp, stagger minimum 6 frames.

### Create: `themes/magazine/design-system.md`

Content derived from existing magazine template patterns (typewriter, inkmap, newspaper, checklist, timeline, stats, comparison):

**Background pattern:** `PaperTexture` component — clean white base, SVG feTurbulence fiber grain overlay (opacity 0.03-0.05), optional age parameter (0-1). MANDATORY in every non-overlay scene (replaces studio's DotGrid).

**Container pattern:** Open editorial layouts with centered flex columns. No card containers. Horizontal rules (3px accent bars) as section dividers. Padding: 80px horizontal. Typography-driven hierarchy rather than container-driven.

**Color immersion rules:** Same principle — theme colors from constants.ts:
```tsx
export const THEME = {
  background: '{background}',
  text: '{text}',
  textMuted: '{textMuted}',
  accent: '{accent}',
  secondary: '{secondary}',
};
```

**Typography:** Playfair Display (headline 700wt), Lora (body 400wt), Merriweather (accent). FONT_PAIRS key: `elegantEditorial`. Letter-spacing: headlines tight `-0.025em`, bylines `0.1em` uppercase. Typography is the hero — strong weight contrast, generous white space.

**Animation language:** "Editorial precision" — simple fade + translateY up (15px travel, 20 frame duration). `editorialReveal()` pattern. `paperSlide()` for directional entrances with slight rotation (-3 to +3 degrees). Stagger: 12 frames between elements. Easing: `bezier(0.25, 0.1, 0.25, 1.0)`.

**Special effects:** `TornEdge` (polygon clip-path, 20 points per edge, 0.3 roughness). `FoldShadow` (linear gradient). `NewsprintGrain` (feTurbulence 0.02 opacity). Use sparingly — clean white space is the default.

**Rendering rules:** Same as blackboard — pure inline styles, SVG graphics, `useScale()`, interpolate clamping, stagger minimum 6 frames.

## 3. Function Renames & Studio Reference Cleanup

All studio-specific names become generic:

| Location | Current | New |
|----------|---------|-----|
| `prompts/animator/animator.py` | `get_studio_section()` | `get_theme_section()` |
| `prompts/animator/__init__.py` | `get_studio_section` export | `get_theme_section` |
| `prompts/__init__.py` | `get_studio_section` export | `get_theme_section` |
| `agents/visual_generator/_animator.py` | `_resolve_studio_templates()` | `_resolve_templates()` |
| `agents/visual_generator/_animator.py` | `studio_section` local var | `theme_section` |
| `agents/visual_generator/_scene_verification.py` | `studio_section` param | `theme_section` |
| `agents/visual_generator/_visual_verification.py` | `studio_section` local var | `theme_section` |
| `agents/visual_generator/_pipeline.py` | `_resolve_studio_templates()` call | `_resolve_templates()` |
| `agents/claude_visual_generator.py` | `_resolve_studio_templates()` call | `_resolve_templates()` |

Function bodies stay the same — they already delegate to `get_design_system(preset)` and `get_theme(preset)`. Only names change.

### 3a. `get_style_description()` in `director/director.py`

This function reads `theme["variant"]` (which no longer exists) and uses old color keys `accentDefault`/`secondaryDefault`. Update to use the new schema:

```python
def get_style_description(style_preset: str) -> str:
    theme = get_theme(style_preset)
    if not theme:
        return ""
    colors = theme.get("colors", {})
    label = theme.get("label", style_preset)
    return (
        f"Theme: {label}. "
        f"Background: {colors.get('background')}, "
        f"text: {colors.get('text')}, "
        f"accent: {colors.get('accent')}, "
        f"secondary: {colors.get('secondary')}."
    )
```

### 3b. `build_animator_user_message()` in `animator/animator.py`

This function contains hardcoded studio references:
- `default="studio-dark"` → `default="blackboard"`
- `"STUDIO THEME: COLORS must ONLY use these keys"` → `"THEME: COLORS must ONLY use these keys"`
- `"## STUDIO TEMPLATE WORKFLOW"` → `"## TEMPLATE WORKFLOW"`
- `"Write constants.ts using STUDIO THEME COLORS"` → `"Write constants.ts using THEME COLORS"`
- `theme["variant"]` access → use `theme["label"]` instead
- All `accentDefault`/`secondaryDefault` color key references → `accent`/`secondary`

### 3c. `build_scene_task_prompt()` in `animator/animator.py`

- `default="studio-dark"` → `default="blackboard"`
- `"## STUDIO TEMPLATES"` → `"## TEMPLATES"`

### 3d. Director prompt file `director/system.md`

Hardcoded studio references that must be updated:
- `"theme": "studio-dark"` in JSON example → `"theme": "blackboard"`
- `"colorPalette": "studio-dark (accent: #6366F1, secondary: #EC4899)"` → generic example with blackboard colors
- `"STUDIO THEME COLOR RULE"` section → rename to `"THEME COLOR RULE"` and update example colors
- `"Default to studio-dark or studio-light"` → `"Default to blackboard or magazine"`
- `"suggestedTemplates (studio preset only)"` → `"suggestedTemplates"` (templates work for all themes now)

### 3e. `_validate_dotgrid()` in `_scene_verification.py`

This validates DotGrid usage which is studio-specific. Update to be theme-aware:
- If blackboard: validate `BoardTexture` usage (radial gradient background)
- If magazine: validate `PaperTexture` usage (white background with grain)
- Rename to `_validate_background()` for clarity

## 4. theme_loader.py Changes

- Remove `variant`-related logic in `_load_theme_prompt()`:
  - Remove `variant_label` construction (`theme["variant"].capitalize() + " mode"`)
  - Remove `variant` and `variant_label` from replacements dict
  - Keep: `colors`, `family`, `label`, `genre` in replacements
- `get_design_system()` path stays `{family}/design-system.md` (already works without variant)
- Remove `get_style_guide()` entirely — no variant-based style guides
- Keep: `get_theme()`, `list_theme_presets()`, `get_template_tags()`, `_load_theme_prompt()`, `get_design_system()`
- Add: `get_genre(preset)` — returns `theme["genre"]` for the 1:1 mapping

## 5. theme-loader.ts Changes (TypeScript mirror)

- Update `ThemeColors` interface — remove `gridColor`, `cardBg`, `cardBorder`, rename `accentDefault` → `accent`, `secondaryDefault` → `secondary`:
  ```ts
  export interface ThemeColors {
    background: string;
    text: string;
    textMuted: string;
    accent: string;
    secondary: string;
  }
  ```
- Update `ThemeConfig` interface — remove `variant`, add `genre`:
  ```ts
  export interface ThemeConfig {
    family: string;
    label: string;
    genre: string;
    templateTags: string[];
    colors: ThemeColors;
  }
  ```
- Remove `variant_label` and `variant` from `loadThemePrompt()` replacements
- Remove `getStyleGuide()` entirely
- Remove `getDirectorStyle()` (references deleted file)
- Update `generate-visuals.ts`: change `getStyleGuidelines()` to use `getDesignSystem()` instead of deleted `getStyleGuide()`
- Add `getGenre(preset: string): string`
- Keep: `getTheme()`, `listThemePresets()`, `getTemplateTags()`, `getDesignSystem()`

## 6. Default Preset Changes

All `default="studio-dark"` become `default="blackboard"`:

| File | Location |
|------|----------|
| `agents/claude_visual_generator.py` | argparse `--style-preset` default |
| `agents/visual_generator/_pipeline.py` | `style_preset` param default |
| `agents/visual_generator/_animator.py` | `build_scene_task_prompt()` default, `_run_animator_phase()` default |
| `agents/visual_generator/_director.py` | `_run_director_phase()` default |
| `agents/visual_generator/_visual_verification.py` | `_run_visual_verification()` default |
| `packages/sandbox/src/prompts/prompt-loader.ts` | `{{THEME}}` fallback |

## 7. Genre from Theme

Current flow: `classify_transcript()` picks genre independently of theme.

New flow:
1. Theme is user-selected (stored in DB `style_preset` column)
2. Genre derived from `themes.json` via `get_genre(preset)` → `theme["genre"]`
3. `classify_transcript()` becomes fallback only when preset is unknown or missing
4. Pipeline: `genre = get_genre(style_preset) or classify_transcript(transcript)`

This preserves the many-to-many door — later, remove `genre` from themes.json and let them be independent axes.

## 8. Frontend ThemePicker

Update `apps/web/src/features/editor-v2/components/agent-widgets/ThemePicker.tsx`:

```tsx
const themes = [
  { id: 'blackboard', label: 'Blackboard Glow', description: 'Dark explainer with amber glow accents', colors: ['#0a0a14', '#f59e0b', '#06b6d4'] },
  { id: 'magazine', label: 'Magazine', description: 'Clean editorial with serif typography', colors: ['#ffffff', '#e11d48', '#0f172a'] },
];
```

## 9. Dockerfile

No changes needed — existing `COPY packages/worker/src/prompts/themes/ /app/prompts/themes/` copies the entire directory. Replacing studio files with blackboard/magazine files is picked up automatically.

## 10. DB Migration

Not required. The `style_preset` column is a free-form varchar(50). Existing rows with `studio-dark` or `studio-light` will simply not match any theme and fall through to the default (`blackboard`). No data migration needed.

## 11. README Update

Update `prompts/README.md` to replace all studio references (mermaid diagrams, theme preset examples, `get_studio_section` references) with generic/blackboard/magazine equivalents.

## Out of Scope

- Many-to-many theme/genre decoupling (future work)
- New themes beyond blackboard/magazine
- Template code changes (templates already work, only prompt-tier integration changes)
- Workspace CLAUDE.md updates (already cleaned in prior prompt architecture work)
