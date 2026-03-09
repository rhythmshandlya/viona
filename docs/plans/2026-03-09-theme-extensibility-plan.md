# Theme Extensibility Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace hardcoded theme logic across 9 files with a manifest-driven theme system that supports adding new themes and design families with zero code changes.

**Architecture:** Single `themes.json` manifest as source of truth. Theme loader modules (TypeScript + Python) read manifest and load prompt files with color placeholder substitution. Directory convention `themes/{family}/{variant}/` organizes prompt content. All `startswith("studio")` and `=== 'studio-dark'` checks replaced with `getTheme(preset)` existence checks.

**Tech Stack:** TypeScript (Node.js fs), Python 3.11, JSON manifest, Markdown prompt templates with `{placeholder}` substitution.

---

### Task 1: Create themes.json manifest

**Files:**
- Create: `packages/worker/src/prompts/themes/themes.json`

**Step 1: Create the themes directory and manifest**

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

Values are taken directly from `packages/worker/src/prompts/_themes.py:3-26`.

**Step 2: Verify the file is valid JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('packages/worker/src/prompts/themes/themes.json','utf-8')); console.log('Valid')"`
Expected: `Valid`

**Step 3: Commit**

```bash
git add packages/worker/src/prompts/themes/themes.json
git commit -m "feat(worker): add themes.json manifest as single source of truth for theme data"
```

---

### Task 2: Move prompt files to theme directory structure

**Files:**
- Move: `packages/worker/src/prompts/generate-visuals/style-studio-dark.md` → `packages/worker/src/prompts/themes/studio/dark/style-guide.md`
- Move: `packages/worker/src/prompts/generate-visuals/style-studio-light.md` → `packages/worker/src/prompts/themes/studio/light/style-guide.md`
- Move: `packages/worker/src/prompts/animator/studio-design-system.md` → `packages/worker/src/prompts/themes/studio/design-system.md`
- Move: `packages/worker/src/prompts/director/studio-style-template.md` → `packages/worker/src/prompts/themes/studio/director-style.md`

**Step 1: Create directory structure and move files**

```bash
mkdir -p packages/worker/src/prompts/themes/studio/dark
mkdir -p packages/worker/src/prompts/themes/studio/light
cp packages/worker/src/prompts/generate-visuals/style-studio-dark.md packages/worker/src/prompts/themes/studio/dark/style-guide.md
cp packages/worker/src/prompts/generate-visuals/style-studio-light.md packages/worker/src/prompts/themes/studio/light/style-guide.md
cp packages/worker/src/prompts/animator/studio-design-system.md packages/worker/src/prompts/themes/studio/design-system.md
cp packages/worker/src/prompts/director/studio-style-template.md packages/worker/src/prompts/themes/studio/director-style.md
```

Do NOT delete the old files yet — they'll be deleted after all consumers are migrated.

**Step 2: Verify all files exist**

```bash
ls -la packages/worker/src/prompts/themes/studio/
ls -la packages/worker/src/prompts/themes/studio/dark/
ls -la packages/worker/src/prompts/themes/studio/light/
```

Expected: `themes.json`, `design-system.md`, `director-style.md` at studio level; `style-guide.md` in each variant dir.

**Step 3: Commit**

```bash
git add packages/worker/src/prompts/themes/studio/
git commit -m "feat(worker): add studio theme prompt files in new directory convention"
```

---

### Task 3: Write TypeScript theme loader

**Files:**
- Create: `packages/worker/src/prompts/theme-loader.ts`
- Test: manually verify with a quick script

**Step 1: Write theme-loader.ts**

```typescript
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const THEMES_DIR = join(__dirname, 'themes');

export interface ThemeColors {
  background: string;
  text: string;
  textMuted: string;
  gridColor: string;
  cardBg: string;
  cardBorder: string;
  accentDefault: string;
  secondaryDefault: string;
}

export interface ThemeConfig {
  family: string;
  variant: string;
  label: string;
  templateTags: string[];
  colors: ThemeColors;
}

interface ThemeManifest {
  themes: Record<string, ThemeConfig>;
}

let _manifest: ThemeManifest | null = null;

function loadManifest(): ThemeManifest {
  if (!_manifest) {
    _manifest = JSON.parse(readFileSync(join(THEMES_DIR, 'themes.json'), 'utf-8'));
  }
  return _manifest!;
}

export function getTheme(preset: string): ThemeConfig | undefined {
  return loadManifest().themes[preset];
}

export function listThemePresets(): string[] {
  return Object.keys(loadManifest().themes);
}

export function getTemplateTags(preset: string): string[] {
  const theme = getTheme(preset);
  if (!theme) throw new Error(`Unknown theme preset: ${preset}`);
  return theme.templateTags;
}

/**
 * Load a markdown prompt file and substitute color placeholders.
 * Replaces {background}, {text}, {variant_label}, etc.
 */
function loadThemePrompt(filePath: string, theme: ThemeConfig): string {
  const raw = readFileSync(join(THEMES_DIR, filePath), 'utf-8');
  const variantLabel = theme.variant.charAt(0).toUpperCase() + theme.variant.slice(1) + ' mode';
  const replacements: Record<string, string> = {
    ...theme.colors,
    variant_label: variantLabel,
    variant: theme.variant,
    family: theme.family,
    label: theme.label,
  };
  return raw.replace(/\{(\w+)\}/g, (match, key) => replacements[key] ?? match);
}

/** Load {family}/{variant}/style-guide.md with color placeholders filled. */
export function getStyleGuide(preset: string): string {
  const theme = getTheme(preset);
  if (!theme) throw new Error(`Unknown theme preset: ${preset}`);
  return loadThemePrompt(`${theme.family}/${theme.variant}/style-guide.md`, theme);
}

/** Load {family}/design-system.md with color placeholders filled. */
export function getDesignSystem(preset: string): string {
  const theme = getTheme(preset);
  if (!theme) throw new Error(`Unknown theme preset: ${preset}`);
  return loadThemePrompt(`${theme.family}/design-system.md`, theme);
}

/** Load {family}/director-style.md with color placeholders filled. */
export function getDirectorStyle(preset: string): string {
  const theme = getTheme(preset);
  if (!theme) throw new Error(`Unknown theme preset: ${preset}`);
  return loadThemePrompt(`${theme.family}/director-style.md`, theme);
}
```

**Step 2: Verify it compiles**

Run: `cd packages/worker && npx tsc --noEmit src/prompts/theme-loader.ts`
Expected: no errors (or only unrelated errors from other files — check that no errors reference `theme-loader.ts`)

**Step 3: Commit**

```bash
git add packages/worker/src/prompts/theme-loader.ts
git commit -m "feat(worker): add TypeScript theme loader with placeholder substitution"
```

---

### Task 4: Write Python theme loader

**Files:**
- Create: `packages/worker/src/prompts/theme_loader.py`

**Step 1: Write theme_loader.py**

```python
"""Theme loader — reads themes.json and loads prompt files with placeholder substitution."""

import json
from pathlib import Path

_THEMES_DIR = Path(__file__).parent / "themes"
_manifest = None


def _load_manifest() -> dict:
    global _manifest
    if _manifest is None:
        with open(_THEMES_DIR / "themes.json") as f:
            _manifest = json.load(f)
    return _manifest


def get_theme(preset: str) -> dict | None:
    """Return theme config dict, or None if preset is not in manifest."""
    return _load_manifest()["themes"].get(preset)


def list_theme_presets() -> list[str]:
    """Return all registered theme preset names."""
    return list(_load_manifest()["themes"].keys())


def get_template_tags(preset: str) -> list[str]:
    """Return the templateTags list for the given preset."""
    theme = get_theme(preset)
    if not theme:
        raise ValueError(f"Unknown theme preset: {preset}")
    return theme["templateTags"]


def _load_theme_prompt(file_path: str, theme: dict) -> str:
    """Load a markdown prompt and substitute color placeholders."""
    raw = (_THEMES_DIR / file_path).read_text(encoding="utf-8")
    variant_label = theme["variant"].capitalize() + " mode"
    replacements = {
        **theme["colors"],
        "variant_label": variant_label,
        "variant": theme["variant"],
        "family": theme["family"],
        "label": theme["label"],
    }
    result = raw
    for key, value in replacements.items():
        result = result.replace(f"{{{key}}}", value)
    return result


def get_style_guide(preset: str) -> str:
    """Load {family}/{variant}/style-guide.md with placeholders filled."""
    theme = get_theme(preset)
    if not theme:
        raise ValueError(f"Unknown theme preset: {preset}")
    return _load_theme_prompt(f"{theme['family']}/{theme['variant']}/style-guide.md", theme)


def get_design_system(preset: str) -> str:
    """Load {family}/design-system.md with placeholders filled."""
    theme = get_theme(preset)
    if not theme:
        raise ValueError(f"Unknown theme preset: {preset}")
    return _load_theme_prompt(f"{theme['family']}/design-system.md", theme)


def get_director_style(preset: str) -> str:
    """Load {family}/director-style.md with placeholders filled."""
    theme = get_theme(preset)
    if not theme:
        raise ValueError(f"Unknown theme preset: {preset}")
    return _load_theme_prompt(f"{theme['family']}/director-style.md", theme)
```

**Step 2: Verify syntax**

Run: `python -c "import ast; ast.parse(open('packages/worker/src/prompts/theme_loader.py').read()); print('Valid')"`
Expected: `Valid`

**Step 3: Commit**

```bash
git add packages/worker/src/prompts/theme_loader.py
git commit -m "feat(worker): add Python theme loader with placeholder substitution"
```

---

### Task 5: Refactor generate-visuals.ts to use theme loader

**Files:**
- Modify: `packages/worker/src/prompts/generate-visuals.ts:8-11`

**Step 1: Replace STYLE_GUIDELINES dict with theme loader call**

At the top of `packages/worker/src/prompts/generate-visuals.ts`, replace:

```typescript
import { buildReferenceExamplesSection } from './visual-references.js';
import { loadPrompt } from './loader.js';

/**
 * Style guidelines with SPECIFIC design tokens.
 * Each style includes exact CSS values the AI should use.
 */
export const STYLE_GUIDELINES: Record<string, string> = {
  'studio-dark': loadPrompt('generate-visuals/style-studio-dark'),
  'studio-light': loadPrompt('generate-visuals/style-studio-light'),
};
```

With:

```typescript
import { buildReferenceExamplesSection } from './visual-references.js';
import { loadPrompt } from './loader.js';
import { getStyleGuide, getTheme } from './theme-loader.js';

/**
 * Style guidelines loaded from theme manifest.
 * Falls back to empty string for unknown presets.
 */
export function getStyleGuidelines(stylePreset: string): string {
  if (!getTheme(stylePreset)) return '';
  return getStyleGuide(stylePreset);
}
```

**Step 2: Find all usages of STYLE_GUIDELINES in the file and update them**

Search the file for `STYLE_GUIDELINES` references. Replace each `STYLE_GUIDELINES[stylePreset]` or `STYLE_GUIDELINES[options.stylePreset]` with `getStyleGuidelines(stylePreset)` or `getStyleGuidelines(options.stylePreset)`.

Run: `grep -n "STYLE_GUIDELINES" packages/worker/src/prompts/generate-visuals.ts`

Update each occurrence.

**Step 3: Verify the file compiles**

Run: `cd packages/worker && npx tsc --noEmit src/prompts/generate-visuals.ts 2>&1 | head -20`
Expected: no errors referencing `generate-visuals.ts`

**Step 4: Commit**

```bash
git add packages/worker/src/prompts/generate-visuals.ts
git commit -m "refactor(worker): use theme loader for style guidelines in generate-visuals prompt"
```

---

### Task 6: Refactor director.py to use theme loader

**Files:**
- Modify: `packages/worker/src/prompts/director/director.py:9-31`

**Step 1: Replace _themes import and hardcoded dicts**

In `packages/worker/src/prompts/director/director.py`, replace lines 15-31:

```python
from prompts._themes import STUDIO_THEMES

_STUDIO_STYLE_TEMPLATE = load_prompt('director/studio-style-template')


def get_style_description(style_preset: str) -> str:
    """Get the style description for the given preset, filled with theme colors."""
    theme = STUDIO_THEMES.get(style_preset, STUDIO_THEMES["studio-dark"])
    variant_label = "Dark mode" if theme["variant"] == "dark" else "Light mode"
    return _STUDIO_STYLE_TEMPLATE.format(variant_label=variant_label, **theme)


# Backward compat — some code may still reference this dict
STYLE_PRESET_DESCRIPTIONS = {
    "studio-dark": get_style_description("studio-dark"),
    "studio-light": get_style_description("studio-light"),
}
```

With:

```python
from prompts.theme_loader import get_director_style, get_theme


def get_style_description(style_preset: str) -> str:
    """Get the style description for the given preset from theme manifest."""
    if not get_theme(style_preset):
        # Fallback to studio-dark for unknown presets
        return get_director_style("studio-dark")
    return get_director_style(style_preset)


# Backward compat — some code may still reference this dict
STYLE_PRESET_DESCRIPTIONS = {
    "studio-dark": get_style_description("studio-dark"),
    "studio-light": get_style_description("studio-light"),
}
```

Note: Keep `STYLE_PRESET_DESCRIPTIONS` dict for backward compat until we verify no other code reads it.

**Step 2: Search for other references to `_themes` in this file**

Run: `grep -n "_themes\|STUDIO_THEMES" packages/worker/src/prompts/director/director.py`
Expected: no remaining references after the replacement.

**Step 3: Verify Python syntax**

Run: `python -c "import ast; ast.parse(open('packages/worker/src/prompts/director/director.py').read()); print('Valid')"`
Expected: `Valid`

**Step 4: Commit**

```bash
git add packages/worker/src/prompts/director/director.py
git commit -m "refactor(worker): use theme loader in director prompt instead of _themes.py"
```

---

### Task 7: Refactor animator.py to use theme loader

**Files:**
- Modify: `packages/worker/src/prompts/animator/animator.py:10-22, 447, 761`

**Step 1: Replace imports and get_studio_section function**

In `packages/worker/src/prompts/animator/animator.py`, replace lines 10-22:

```python
from prompts._themes import STUDIO_THEMES

_STUDIO_DESIGN_SYSTEM_TEMPLATE = load_prompt('animator/studio-design-system')


def get_studio_section(style_preset: str) -> str:
    """Return the Studio design system prompt for the given theme, or empty string."""
    theme = STUDIO_THEMES.get(style_preset)
    if not theme:
        return ""
    variant_label = "Dark mode" if theme["variant"] == "dark" else "Light mode"
    return _STUDIO_DESIGN_SYSTEM_TEMPLATE.format(variant_label=variant_label, **theme)
```

With:

```python
from prompts.theme_loader import get_design_system, get_theme


def get_studio_section(style_preset: str) -> str:
    """Return the design system prompt for the given theme, or empty string."""
    if not get_theme(style_preset):
        return ""
    return get_design_system(style_preset)
```

**Step 2: Replace startswith("studio") checks**

At line 447 (inside `build_animator_user_message`), replace:

```python
if style_preset.startswith("studio"):
```

With:

```python
if get_theme(style_preset):
```

At line 761 (inside `build_scene_task_prompt`), replace:

```python
if style_preset.startswith("studio"):
```

With:

```python
if get_theme(style_preset):
```

**Step 3: Verify no remaining `_themes` references**

Run: `grep -n "_themes\|STUDIO_THEMES" packages/worker/src/prompts/animator/animator.py`
Expected: no matches.

**Step 4: Verify syntax**

Run: `python -c "import ast; ast.parse(open('packages/worker/src/prompts/animator/animator.py').read()); print('Valid')"`
Expected: `Valid`

**Step 5: Commit**

```bash
git add packages/worker/src/prompts/animator/animator.py
git commit -m "refactor(worker): use theme loader in animator prompt instead of _themes.py"
```

---

### Task 8: Refactor claude_visual_generator.py to use theme loader

**Files:**
- Modify: `packages/worker/src/agents/claude_visual_generator.py:655, 1447, 2488, 2739`

**Step 1: Add import**

At the top of `packages/worker/src/agents/claude_visual_generator.py`, add:

```python
from prompts.theme_loader import get_theme
```

**Step 2: Replace all startswith("studio") checks**

Line 655 — `_resolve_studio_templates`:
```python
# Before
if not style_preset.startswith("studio"):

# After
if not get_theme(style_preset):
```

Line 1447:
```python
# Before
if style_preset.startswith("studio"):

# After
if get_theme(style_preset):
```

Line 2488:
```python
# Before
if style_preset.startswith("studio") and self._resolved_templates_md:

# After
if get_theme(style_preset) and self._resolved_templates_md:
```

Line 2739:
```python
# Before
if style_preset.startswith("studio") and self._resolved_templates_md:

# After
if get_theme(style_preset) and self._resolved_templates_md:
```

**Step 3: Verify no remaining startswith("studio") references**

Run: `grep -n 'startswith("studio")' packages/worker/src/agents/claude_visual_generator.py`
Expected: no matches.

**Step 4: Verify syntax**

Run: `python -c "import ast; ast.parse(open('packages/worker/src/agents/claude_visual_generator.py').read()); print('Valid')"`
Expected: `Valid`

**Step 5: Commit**

```bash
git add packages/worker/src/agents/claude_visual_generator.py
git commit -m "refactor(worker): replace all startswith('studio') with theme loader in visual generator"
```

---

### Task 9: Refactor generate-visuals/index.ts to use theme loader

**Files:**
- Modify: `packages/worker/src/processors/generate-visuals/index.ts:256`

**Step 1: Add import**

Add at top of file:

```typescript
import { getTheme } from '../../prompts/theme-loader.js';
```

**Step 2: Replace hardcoded check**

At line 256, replace:

```typescript
if (stylePreset === 'studio-dark' || stylePreset === 'studio-light') {
```

With:

```typescript
if (getTheme(stylePreset)) {
```

**Step 3: Verify compilation**

Run: `cd packages/worker && npx tsc --noEmit src/processors/generate-visuals/index.ts 2>&1 | head -20`
Expected: no errors referencing this file.

**Step 4: Commit**

```bash
git add packages/worker/src/processors/generate-visuals/index.ts
git commit -m "refactor(worker): use theme loader check in generate-visuals processor"
```

---

### Task 10: Update type definitions to use string for stylePreset

**Files:**
- Modify: `packages/worker/src/processors/generate-visuals/types.ts:53`
- Modify: `packages/worker/src/processors/plan-visuals.ts:38`

**Step 1: Update GenerateVisualsJobData type**

In `packages/worker/src/processors/generate-visuals/types.ts:53`, replace:

```typescript
stylePreset: 'studio-dark' | 'studio-light';
```

With:

```typescript
stylePreset: string;
```

**Step 2: Update PlanVisualsJobData type**

In `packages/worker/src/processors/plan-visuals.ts:38`, replace:

```typescript
stylePreset: 'studio-dark' | 'studio-light';
```

With:

```typescript
stylePreset: string;
```

**Step 3: Verify compilation**

Run: `cd packages/worker && npx tsc --noEmit 2>&1 | grep -i "error" | head -10`
Expected: no new errors.

**Step 4: Commit**

```bash
git add packages/worker/src/processors/generate-visuals/types.ts packages/worker/src/processors/plan-visuals.ts
git commit -m "refactor(worker): widen stylePreset type from union to string for theme extensibility"
```

---

### Task 11: Update studio-templates.ts to accept preset parameter

**Files:**
- Modify: `packages/worker/src/prompts/studio-templates.ts`

**Step 1: Rename and parameterize the catalog builder**

Replace the entire file content:

```typescript
import { readFileSync } from 'fs';
import { join } from 'path';
import { findPackagesRoot } from '../processors/generate-visuals/validation.js';
import { getTemplateTags } from './theme-loader.js';

interface RegistryCatalogItem {
  name: string;
  description: string;
  categories: string[];
  tags?: string[];
  meta: { stylePreset?: string; aspectRatio?: string; estimatedDuration?: string };
}

interface Registry {
  name: string;
  items: RegistryCatalogItem[];
}

const CATEGORY_LABELS: Record<string, string> = {
  'data-visualization': 'Data Visualization',
  'text-typography': 'Text & Typography',
  'comparison': 'Comparison & Versus',
  'social-engagement': 'Social & Engagement',
  'geographic': 'Geographic & Maps',
  'intro-outro': 'Intro & Outro',
  'timeline-process': 'Timeline & Process',
  'media': 'Media & Video',
  'marketing': 'Marketing',
  'education': 'Education',
  'social': 'Social',
  'corporate': 'Corporate',
  'entertainment': 'Entertainment',
};

/**
 * Build a categorized template catalog for the given theme preset.
 * Filters registry items by the preset's templateTags.
 */
export function buildTemplateCatalog(preset: string): string {
  const registryPath = join(findPackagesRoot(), 'templates', 'registry.json');
  const registry: Registry = JSON.parse(readFileSync(registryPath, 'utf-8'));

  const themeTags = getTemplateTags(preset);

  // Filter items that match the theme's tags
  const filtered = registry.items.filter(item => {
    const itemTags = item.tags || [];
    return themeTags.some(tag => itemTags.includes(tag));
  });

  // Group by category
  const groups = new Map<string, RegistryCatalogItem[]>();
  for (const item of filtered) {
    const cat = item.categories[0] || 'other';
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(item);
  }

  // Build categorized catalog
  const sections: string[] = [];
  for (const [cat, items] of groups) {
    const label = CATEGORY_LABELS[cat] || cat;
    const lines = items.map(t => `- \`${t.name}\`: ${t.description}`).join('\n');
    sections.push(`### ${label} (${items.length})\n${lines}`);
  }

  return `## Available Templates by Category

${sections.join('\n\n')}

**How to use:** Select templates by slug in scenes.json \`"templates"\` field. The Animator will receive their full source code.
If no template fits a scene, use an empty array — the Animator will create custom visuals.
`;
}

/** @deprecated Use buildTemplateCatalog(preset) instead */
export function buildStudioTemplateCatalog(): string {
  return buildTemplateCatalog('studio-dark');
}
```

**Step 2: Update the call site in generate-visuals/index.ts**

In `packages/worker/src/processors/generate-visuals/index.ts`, find the import:

```typescript
import { buildStudioTemplateCatalog } from '../../prompts/studio-templates.js';
```

Replace with:

```typescript
import { buildTemplateCatalog } from '../../prompts/studio-templates.js';
```

And update the call site at line ~260:

```typescript
// Before
const catalog = buildStudioTemplateCatalog();

// After
const catalog = buildTemplateCatalog(stylePreset);
```

**Step 3: Verify compilation**

Run: `cd packages/worker && npx tsc --noEmit 2>&1 | grep -i "error" | head -10`
Expected: no new errors.

**Step 4: Commit**

```bash
git add packages/worker/src/prompts/studio-templates.ts packages/worker/src/processors/generate-visuals/index.ts
git commit -m "refactor(worker): parameterize template catalog builder to accept theme preset"
```

---

### Task 12: Add tags to registry.json catalog items

**Files:**
- Modify: `packages/templates/scripts/build-registry.ts:93-94, 125-135`

**Step 1: Remove hardcoded studio-theme filter**

In `packages/templates/scripts/build-registry.ts`, at line 93-94, remove:

```typescript
  const tags = (meta.tags as string[]) || [];
  if (!tags.includes('studio-theme')) continue;
```

Replace with:

```typescript
  const tags = (meta.tags as string[]) || [];
```

(Keep the `tags` variable — we need it below — but remove the filter.)

**Step 2: Add tags to catalog items**

In the `catalogItems.push(...)` block (line ~125-135), add `tags` to the catalog item:

```typescript
  catalogItems.push({
    name: meta.slug as string,
    type: 'registry:component',
    description: (meta.description as string) || '',
    categories: [meta.category as string].filter(Boolean),
    tags,
    meta: {
      stylePreset: meta.stylePreset,
      aspectRatio: meta.aspectRatio,
      estimatedDuration: meta.estimatedDuration,
    },
  });
```

**Step 3: Add tags to RegistryCatalogItem interface**

At line ~37-43, update the interface:

```typescript
interface RegistryCatalogItem {
  name: string;
  type: string;
  description: string;
  categories: string[];
  tags: string[];
  meta: Record<string, unknown>;
}
```

**Step 4: Rebuild registry to verify**

Run: `cd packages/templates && pnpm build:registry`
Expected: outputs `Built registry: NN templates, NN catalog items` with a HIGHER template count (now includes non-studio templates if any exist).

**Step 5: Verify registry.json has tags**

Run: `node -e "const r = require('./packages/templates/registry.json'); console.log(r.items[0].tags)"`
Expected: should print an array like `['studio-theme']`.

**Step 6: Commit**

```bash
git add packages/templates/scripts/build-registry.ts packages/templates/registry.json
git commit -m "feat(templates): remove hardcoded studio-theme filter, add tags to registry catalog items"
```

---

### Task 13: Delete replaced files and update README

**Files:**
- Delete: `packages/worker/src/prompts/_themes.py`
- Delete: `packages/worker/src/prompts/generate-visuals/style-studio-dark.md`
- Delete: `packages/worker/src/prompts/generate-visuals/style-studio-light.md`
- Delete: `packages/worker/src/prompts/animator/studio-design-system.md`
- Delete: `packages/worker/src/prompts/director/studio-style-template.md`
- Modify: `packages/worker/src/prompts/README.md:324-327` (update startswith references)

**Step 1: Verify no remaining imports of deleted files**

Run these in parallel:
```bash
grep -rn "_themes" packages/worker/src/prompts/ --include="*.py" | grep -v theme_loader | grep -v __pycache__
grep -rn "style-studio-dark\|style-studio-light" packages/worker/src/prompts/ --include="*.ts"
grep -rn "studio-design-system" packages/worker/src/prompts/ --include="*.py"
grep -rn "studio-style-template" packages/worker/src/prompts/ --include="*.py"
```

Expected: no matches (all consumers migrated in Tasks 5-8).

**Step 2: Delete the old files**

```bash
rm packages/worker/src/prompts/_themes.py
rm packages/worker/src/prompts/generate-visuals/style-studio-dark.md
rm packages/worker/src/prompts/generate-visuals/style-studio-light.md
rm packages/worker/src/prompts/animator/studio-design-system.md
rm packages/worker/src/prompts/director/studio-style-template.md
```

**Step 3: Update README.md**

In `packages/worker/src/prompts/README.md`, find the lines referencing `startswith("studio")` at lines ~324-327 and update them to reference the theme loader:

```markdown
| Design system | `get_theme(style_preset)` | Animator system prompt |
| ...
| Style template | `get_theme(style_preset)` | Director user message |
```

**Step 4: Commit**

```bash
git add -u packages/worker/src/prompts/
git add packages/worker/src/prompts/README.md
git commit -m "chore(worker): delete replaced theme files, update README references"
```

---

### Task 14: End-to-end smoke test

**Step 1: Verify TypeScript compilation**

Run: `cd packages/worker && npx tsc --noEmit 2>&1 | tail -5`
Expected: no errors (or only pre-existing unrelated errors).

**Step 2: Verify Python imports work**

Run from `packages/worker/src`:
```bash
cd packages/worker/src && python -c "
from prompts.theme_loader import get_theme, get_style_guide, get_design_system, get_director_style, list_theme_presets
print('Presets:', list_theme_presets())
t = get_theme('studio-dark')
print('Family:', t['family'], 'Variant:', t['variant'])
sg = get_style_guide('studio-dark')
print('Style guide length:', len(sg))
ds = get_design_system('studio-dark')
print('Design system length:', len(ds))
dr = get_director_style('studio-dark')
print('Director style length:', len(dr))
print('All OK')
"
```

Expected: prints preset list, family/variant, non-zero lengths, "All OK".

**Step 3: Verify TypeScript theme loader**

Run:
```bash
cd packages/worker && node -e "
import('./dist/prompts/theme-loader.js').then(m => {
  console.log('Presets:', m.listThemePresets());
  console.log('Theme:', m.getTheme('studio-dark')?.family);
  console.log('OK');
}).catch(e => console.error(e));
"
```

If dist is not built, build first: `cd packages/worker && pnpm build`

**Step 4: Verify registry has tags**

Run: `node -e "const r = JSON.parse(require('fs').readFileSync('packages/templates/registry.json','utf-8')); const withTags = r.items.filter(i => i.tags && i.tags.length > 0); console.log(withTags.length + '/' + r.items.length + ' items have tags')"`
Expected: all items have tags.

**Step 5: Commit (if any fixes were needed)**

```bash
git add -A
git commit -m "fix(worker): smoke test fixes for theme extensibility"
```
