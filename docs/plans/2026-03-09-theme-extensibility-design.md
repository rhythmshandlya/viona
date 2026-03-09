# Theme Extensibility Design

**Date:** 2026-03-09
**Status:** Approved
**Scope:** `packages/worker/src/prompts/`, `packages/templates/`, `packages/worker/src/processors/`, `packages/worker/src/agents/`

## Problem

The theme system is hardcoded across 15+ files in 3 languages. Adding a new theme requires touching 11 files. Theme preset names (`studio-dark`, `studio-light`) are string-matched with `startswith("studio")`, `=== 'studio-dark' || === 'studio-light'`, and hardcoded dicts. Color values are duplicated in `_themes.py`, two style markdown files, and template constants. Not extensible.

## Design

### 1. Theme Manifest (`themes.json`)

Single source of truth for all theme metadata. Lives at `packages/worker/src/prompts/themes/themes.json`:

```json
{
  "themes": {
    "studio-dark": {
      "family": "studio",
      "variant": "dark",
      "label": "Studio Dark",
      "templateTags": ["studio-theme"],
      "colors": {
        "background": "#0B0F1A",
        "text": "#FFFFFF",
        "textMuted": "rgba(255,255,255,0.45)",
        "gridColor": "rgba(255,255,255,0.04)",
        "cardBg": "rgba(255,255,255,0.06)",
        "cardBorder": "rgba(255,255,255,0.10)",
        "accentDefault": "#6366F1",
        "secondaryDefault": "#EC4899"
      }
    },
    "studio-light": {
      "family": "studio",
      "variant": "light",
      "label": "Studio Light",
      "templateTags": ["studio-theme"],
      "colors": {
        "background": "#F8F9FB",
        "text": "#111827",
        "textMuted": "rgba(0,0,0,0.45)",
        "gridColor": "rgba(0,0,0,0.04)",
        "cardBg": "rgba(0,0,0,0.04)",
        "cardBorder": "rgba(0,0,0,0.08)",
        "accentDefault": "#6366F1",
        "secondaryDefault": "#EC4899"
      }
    }
  }
}
```

**Key fields:**
- `family` — groups variants. `studio-dark` and `studio-light` share family `"studio"`, meaning they share a design system prompt and template pool.
- `variant` — the specific variant within the family.
- `templateTags` — which registry tags to filter templates by. Replaces hardcoded `"studio-theme"` filter.
- `colors` — token values injected into prompt placeholders (`{background}`, `{text}`, etc.).

**Replaces:** `_themes.py` STUDIO_THEMES dict, `STYLE_GUIDELINES` dict in `generate-visuals.ts`, `STYLE_PRESET_DESCRIPTIONS` in `director.py`.

### 2. Theme Directory Convention

```
packages/worker/src/prompts/themes/
├── themes.json                     # manifest (source of truth)
├── studio/                         # family directory
│   ├── design-system.md            # shared design system (cards, DotGrid, fonts, animation rules)
│   ├── director-style.md           # Director prompt section (with color placeholders)
│   ├── dark/                       # variant directory
│   │   └── style-guide.md          # variant-specific style guidelines
│   └── light/
│       └── style-guide.md
└── kinetic/                        # different family entirely
    ├── design-system.md            # different design system (no cards, no DotGrid)
    ├── director-style.md
    └── default/
        └── style-guide.md
```

**Convention rules:**
- `{family}/design-system.md` — shared across all variants in the family. Injected into Animator prompt with color placeholders filled from `themes.json` colors.
- `{family}/director-style.md` — shared Director prompt section, same placeholder approach.
- `{family}/{variant}/style-guide.md` — variant-specific detailed style guidelines.

**Replaces:**
- `prompts/generate-visuals/style-studio-dark.md` → `themes/studio/dark/style-guide.md`
- `prompts/generate-visuals/style-studio-light.md` → `themes/studio/light/style-guide.md`
- `prompts/animator/studio-design-system.md` → `themes/studio/design-system.md`
- `prompts/director/studio-style-template.md` → `themes/studio/director-style.md`

### 3. Theme Loader Module

Single module in both Python and TypeScript that reads `themes.json` and loads prompt files with placeholder substitution.

**TypeScript** (`packages/worker/src/prompts/theme-loader.ts`):

```typescript
export function getTheme(preset: string): ThemeConfig | undefined
export function listThemePresets(): string[]
export function getStyleGuide(preset: string): string       // loads {family}/{variant}/style-guide.md
export function getDesignSystem(preset: string): string     // loads {family}/design-system.md, fills color placeholders
export function getDirectorStyle(preset: string): string    // loads {family}/director-style.md, fills color placeholders
export function getTemplateTags(preset: string): string[]   // returns templateTags array
```

**Python** (`packages/worker/src/prompts/theme_loader.py`):

```python
def get_theme(preset: str) -> dict | None
def get_style_guide(preset: str) -> str
def get_design_system(preset: str) -> str
def get_director_style(preset: str) -> str
def get_template_tags(preset: str) -> list[str]
```

Placeholder substitution: both loaders replace `{background}`, `{text}`, `{variant_label}`, etc. from the theme's `colors` dict + computed fields (`variant_label` = `colors.variant.title()` → "Dark", "Light").

**Replaces:**
- `_themes.py` — deleted, replaced by `themes.json` + loader
- `generate-visuals.ts` `STYLE_GUIDELINES` dict — replaced by `getStyleGuide(preset)`
- `director.py` `get_style_description()` + `STYLE_PRESET_DESCRIPTIONS` — replaced by `get_director_style(preset)`
- `animator.py` `get_studio_section()` — replaced by `get_design_system(preset)`

### 4. Registry Integration

**Build-registry changes:**
- Remove hardcoded `tags.includes('studio-theme')` filter
- Build ALL templates into the registry (no theme filter at build time)
- Add `tags` field to `registry.json` catalog items so filtering can happen at query time

**Catalog builder changes:**
- `buildStudioTemplateCatalog()` → `buildTemplateCatalog(preset: string)`
- Reads `getTemplateTags(preset)` from theme loader
- Filters `registry.json` items where item tags intersect theme's templateTags
- Still produces categorized markdown output

**Template resolver:**
- No changes needed — it already reads `suggestedTemplates` from scenes.json slugs

### 5. Downstream Code Changes

**All `startswith("studio")` checks → theme existence check:**
```python
# Before
if style_preset.startswith("studio"):

# After
theme = get_theme(style_preset)
if theme is not None:
```

**All `=== 'studio-dark' || === 'studio-light'` checks → same:**
```typescript
// Before
if (stylePreset === 'studio-dark' || stylePreset === 'studio-light')

// After
if (getTheme(stylePreset))
```

**Worker types:**
- `stylePreset: 'studio-dark' | 'studio-light'` → `stylePreset: string`
- Runtime validation via `getTheme(preset)` — throws if not in manifest

**Python agent defaults:**
- `style_preset: str = "studio-dark"` — stays as-is (sensible default)

**Frontend:**
- `StylePreset` type stays as union for now (frontend needs compile-time options for UI)
- Future: make modal data-driven by fetching theme list from API

### 6. Adding a Theme: Step-by-Step

**New variant (e.g., `studio-neon`):**
1. Add entry to `themes.json` with `"family": "studio"`, colors, `"templateTags": ["studio-theme"]`
2. Create `themes/studio/neon/style-guide.md`
3. Existing studio templates automatically available (shared `templateTags`)
4. Zero code changes

**New family (e.g., `kinetic`):**
1. Add entry to `themes.json` with `"family": "kinetic"`, colors, `"templateTags": ["kinetic-theme"]`
2. Create `themes/kinetic/` directory:
   - `design-system.md` — entirely different design system
   - `director-style.md` — different Director prompt section
   - `default/style-guide.md` — variant-specific style
3. Tag any templates with `"kinetic-theme"` in their `meta.json`
4. Rebuild registry
5. Zero code changes

**New template for existing theme:**
1. Create template in `packages/templates/src/templates/{slug}/`
2. Add theme tag (e.g., `"studio-theme"`) to `meta.json` tags
3. Run `pnpm build` (rebuilds registry)
4. Template appears in catalog automatically

## Files Affected

### New files
- `packages/worker/src/prompts/themes/themes.json` — manifest
- `packages/worker/src/prompts/themes/studio/design-system.md` — moved from `animator/studio-design-system.md`
- `packages/worker/src/prompts/themes/studio/director-style.md` — moved from `director/studio-style-template.md`
- `packages/worker/src/prompts/themes/studio/dark/style-guide.md` — moved from `generate-visuals/style-studio-dark.md`
- `packages/worker/src/prompts/themes/studio/light/style-guide.md` — moved from `generate-visuals/style-studio-light.md`
- `packages/worker/src/prompts/theme-loader.ts` — TypeScript theme loader
- `packages/worker/src/prompts/theme_loader.py` — Python theme loader

### Deleted files
- `packages/worker/src/prompts/_themes.py`
- `packages/worker/src/prompts/generate-visuals/style-studio-dark.md`
- `packages/worker/src/prompts/generate-visuals/style-studio-light.md`
- `packages/worker/src/prompts/animator/studio-design-system.md`
- `packages/worker/src/prompts/director/studio-style-template.md`

### Modified files
- `packages/worker/src/prompts/generate-visuals.ts` — use `getStyleGuide(preset)` instead of `STYLE_GUIDELINES` dict
- `packages/worker/src/prompts/director/director.py` — use `get_director_style(preset)` instead of `STYLE_PRESET_DESCRIPTIONS`
- `packages/worker/src/prompts/animator/animator.py` — use `get_design_system(preset)` instead of `get_studio_section()`
- `packages/worker/src/prompts/studio-templates.ts` — `buildTemplateCatalog(preset)` with tag filtering
- `packages/worker/src/processors/generate-visuals/index.ts` — replace hardcoded preset checks
- `packages/worker/src/processors/generate-visuals/types.ts` — `stylePreset: string`
- `packages/worker/src/processors/plan-visuals.ts` — `stylePreset: string`, replace checks
- `packages/worker/src/agents/claude_visual_generator.py` — replace all `startswith("studio")` with theme loader calls
- `packages/templates/scripts/build-registry.ts` — remove theme filter, add tags to catalog items

## Non-Goals

- Frontend data-driven theme selector (future — keep hardcoded union for now)
- Theme hot-reloading (build-time is fine)
- Theme inheritance between families (each family is self-contained)
- Theme versioning
