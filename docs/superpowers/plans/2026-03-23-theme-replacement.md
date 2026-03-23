# Theme Replacement: Studio → Blackboard + Magazine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace studio-dark/studio-light themes with blackboard and magazine themes across the prompt tier, sandbox pipeline, API, and frontend.

**Architecture:** Update themes.json registry, create two design-system.md files, rename studio-specific functions to generic names, update all hardcoded `studio-dark` defaults to `blackboard`, and make sandbox prompts reference a dynamic theme file instead of hardcoded `studio-theme.md`.

**Tech Stack:** Python, TypeScript, Markdown, JSON

**Spec:** `docs/superpowers/specs/2026-03-23-theme-replacement-design.md`

---

### Task 1: Replace themes.json registry

**Files:**
- Modify: `packages/worker/src/prompts/themes/themes.json`

- [ ] **Step 1: Replace themes.json content**

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

- [ ] **Step 2: Commit**

```bash
git add packages/worker/src/prompts/themes/themes.json
git commit -m "feat(themes): replace studio-dark/light with blackboard and magazine"
```

---

### Task 2: Delete studio theme files, create blackboard design-system.md

**Files:**
- Delete: `packages/worker/src/prompts/themes/studio/` (entire directory)
- Create: `packages/worker/src/prompts/themes/blackboard/design-system.md`

- [ ] **Step 1: Delete studio directory**

```bash
rm -rf packages/worker/src/prompts/themes/studio/
```

- [ ] **Step 2: Create `themes/blackboard/design-system.md`**

Write the blackboard design system derived from existing blackboard template patterns. Must use `{placeholder}` syntax for color substitution by theme_loader:

```markdown
<blackboard_theme>
## BLACKBOARD GLOW — TEMPLATE LIBRARY (shadcn model)

Templates are **source code you own**. Use `browse_templates` with `theme: "blackboard"` to discover available templates, then `fork_template` to copy source into your workspace and customize freely.

### MANDATORY: Theme Immersion Before Implementation

**Before writing ANY scene code, you MUST complete this step:**

1. Use `browse_templates` with `theme: "blackboard"` to see available templates
2. Fork at least 2 templates with `fork_template` and read their source code
3. Study how they use: BoardTexture backgrounds, GlowPanel containers, `useScale()`, `FONT_PAIRS`, glow animations, accent color conventions
4. Write `constants.ts` using the THEME COLORS below — NOT the Director's `colorPalette` field

The Director's `colorPalette` in scenes.json is a **topic hint only**. Your constants.ts MUST use these exact theme values:
```tsx
export const THEME = {{
  background: '{background}',
  text: '{text}',
  textMuted: '{textMuted}',
  accent: '{accent}',
  secondary: '{secondary}',
  surface: '#18181b',
  surfaceBorder: '#27272a',
}};
```

If you skip this step, your scenes will look generic and off-brand. Templates show you **what good looks like** — the board texture, the glow panels, the neon bloom entrances, the font system. Internalize these patterns before you write a single line.

### ACTIVE THEME: {label}

**Theme Colors:**
- background: `{background}` (near-black board)
- text: `{text}` (off-white)
- textMuted: `{textMuted}`
- accent: `{accent}` (warm amber)
- secondary: `{secondary}` (cool cyan)
- surface: `#18181b` (panel fill)
- surfaceBorder: `#27272a` (panel border)

### RESPONSIVE SCALING (CRITICAL)

Templates use `useScale()` from `../../use-scale` for ALL pixel values.
Base canvas: 1080px wide. `s(32)` = 32px at 1080w, scales proportionally.

```tsx
import {{ useScale }} from '../../use-scale';
const s = useScale();
// Use s() for ALL numeric values:
fontSize: s(48),  padding: s(56),  borderRadius: s(32),  gap: s(20)
```

**You MUST use `s()` for every pixel value in your scene code.** Raw pixel numbers will break on non-1080 canvases.

### FONT SYSTEM

```tsx
import {{ FONT_PAIRS }} from '../../fonts';
const FONTS = FONT_PAIRS['cleanMinimal']; // Inter for both headline and body
// Then use: fontFamily: FONTS.headline, fontFamily: FONTS.body
```

For monospace/data displays: use Fira Code (import from `@remotion/google-fonts/FiraCode`).

### BOARD TEXTURE BACKGROUND (MANDATORY in every non-overlay scene)

**Every scene with `displayMode: "default"` or `displayMode: "fullscreen"` MUST have:**
1. A radial gradient background from `#0c0c28` (center) to `{background}` (edges)
2. An feTurbulence noise overlay (baseFrequency 0.55, 4 octaves, opacity 0.05)
3. A radial vignette fading to `rgba(0,0,0,0.4)` at edges

Scenes with `displayMode: "overlay"` skip the background (they render over video).

```tsx
const BoardTexture: React.FC<{{ s: (px: number) => number }}> = ({{ s }}) => (
  <>
    <div style={{{{ position: 'absolute', inset: 0,
      background: 'radial-gradient(ellipse at center, #0c0c28 0%, {background} 100%)' }}}} />
    <svg width="100%" height="100%" style={{{{ position: 'absolute', inset: 0, opacity: 0.05, pointerEvents: 'none' }}}}>
      <filter id="board-noise">
        <feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="4" />
      </filter>
      <rect width="100%" height="100%" filter="url(#board-noise)" />
    </svg>
    <div style={{{{ position: 'absolute', inset: 0,
      background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.4) 100%)' }}}} />
  </>
);
```

### GLOW PANEL CONTAINERS

```tsx
{{
  background: '#18181b',
  border: '1px solid #27272a',
  borderTop: '1px solid rgba(255,255,255,0.05)',
  borderRadius: s(16),
  padding: `${{s(32)}}px ${{s(40)}}px`,
  boxShadow: `0 0 ${{s(20)}}px rgba(245,158,11,0.1)`,
}}
```

### GLOW CONVENTIONS

Amber glow: `drop-shadow(0 0 6px rgba(255,140,66,0.5))`
Cyan bars: `boxShadow: '0 0 10px rgba(77,216,232,0.3)'`
Scale-based: `0 0 ${{progress * 40}}px rgba(255,140,66,${{progress * 0.2}})`

### ANIMATION LANGUAGE: "Neon Bloom"

Two-phase reveals — glow appears first, then content fills in:
1. Glow rises (half duration, opacity 0→1 on glow layer)
2. Content scales in (0.97→1.0, remaining duration)
Exit: fade out + scale shrink. Stagger: 7 frames between elements.
Easing: `Easing.bezier(0.25, 0.1, 0.25, 1.0)`

### SPRING CONFIGS

- Panel entrance: `{{ damping: 20, stiffness: 120, mass: 0.8 }}`
- Text reveal: `{{ damping: 20, stiffness: 170 }}`
- Gentle slide: `{{ damping: 20, stiffness: 90, mass: 1 }}`

### RENDERING RULES

- Pure inline styles ONLY: `style={{{{...}}}}`. No CSS files, no CSS-in-JS.
- All graphics via inline SVG. No image imports.
- Every `interpolate()` MUST have `{{ extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }}`
- Stagger minimum 6 frames between elements
</blackboard_theme>
```

- [ ] **Step 3: Commit**

```bash
git add -A packages/worker/src/prompts/themes/
git commit -m "feat(themes): add blackboard design-system, delete studio"
```

---

### Task 3: Create magazine design-system.md

**Files:**
- Create: `packages/worker/src/prompts/themes/magazine/design-system.md`

- [ ] **Step 1: Create `themes/magazine/design-system.md`**

```markdown
<magazine_theme>
## MAGAZINE — TEMPLATE LIBRARY (shadcn model)

Templates are **source code you own**. Use `browse_templates` with `theme: "magazine"` to discover available templates, then `fork_template` to copy source into your workspace and customize freely.

### MANDATORY: Theme Immersion Before Implementation

**Before writing ANY scene code, you MUST complete this step:**

1. Use `browse_templates` with `theme: "magazine"` to see available templates
2. Fork at least 2 templates with `fork_template` and read their source code
3. Study how they use: PaperTexture backgrounds, editorial layouts, `useScale()`, serif typography, reveal animations
4. Write `constants.ts` using the THEME COLORS below — NOT the Director's `colorPalette` field

The Director's `colorPalette` in scenes.json is a **topic hint only**. Your constants.ts MUST use these exact theme values:
```tsx
export const THEME = {{
  background: '{background}',
  text: '{text}',
  textMuted: '{textMuted}',
  accent: '{accent}',
  secondary: '{secondary}',
}};
```

### ACTIVE THEME: {label}

**Theme Colors:**
- background: `{background}` (clean white)
- text: `{text}` (dark slate)
- textMuted: `{textMuted}`
- accent: `{accent}` (editorial red)
- secondary: `{secondary}` (slate gray)

### RESPONSIVE SCALING (CRITICAL)

Templates use `useScale()` from `../../use-scale` for ALL pixel values.
Base canvas: 1080px wide. `s(32)` = 32px at 1080w, scales proportionally.

```tsx
import {{ useScale }} from '../../use-scale';
const s = useScale();
fontSize: s(48),  padding: s(56),  borderRadius: s(32),  gap: s(20)
```

### FONT SYSTEM

```tsx
import {{ FONT_PAIRS }} from '../../fonts';
const FONTS = FONT_PAIRS['elegantEditorial']; // Playfair Display + Lato
// Headlines: fontFamily: FONTS.headline (serif, 700)
// Body: fontFamily: FONTS.body (sans-serif, 400)
```

For accent text: Merriweather (serif, import from `@remotion/google-fonts/Merriweather`).
Typography is the hero — tight letter-spacing on headlines (`-0.025em`), generous white space, strong weight contrast.

### PAPER TEXTURE BACKGROUND (MANDATORY in every non-overlay scene)

**Every scene with `displayMode: "default"` or `displayMode: "fullscreen"` MUST have:**
1. A clean white base (`{background}`)
2. An optional SVG feTurbulence fiber grain overlay (opacity 0.03-0.05)

Scenes with `displayMode: "overlay"` skip the background.

```tsx
const PaperTexture: React.FC<{{ age?: number }}> = ({{ age = 0.3 }}) => (
  <>
    <div style={{{{ position: 'absolute', inset: 0, background: '{background}' }}}} />
    <svg width="100%" height="100%" style={{{{ position: 'absolute', inset: 0, opacity: age * 0.05, pointerEvents: 'none' }}}}>
      <filter id="paper-grain">
        <feTurbulence type="fractalNoise" baseFrequency="0.4" numOctaves="3" seed="42" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#paper-grain)" />
    </svg>
  </>
);
```

### LAYOUT PATTERNS

Open editorial layouts — NO card containers. Typography-driven hierarchy:
- Centered flex columns with `s(80)` horizontal padding
- Horizontal rules (`3px` accent bars) as section dividers
- Generous white space between elements

```tsx
{{
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: `${{s(60)}}px ${{s(80)}}px`,
  gap: s(32),
}}
```

### ANIMATION LANGUAGE: "Editorial Precision"

Simple, confident motion:
- `editorialReveal`: fade in + translateY up (s(15) travel, 20 frame duration)
- `paperSlide`: enters from direction with slight rotation (-3° to +3°)
- Stagger: 12 frames between elements
- Easing: `Easing.bezier(0.25, 0.1, 0.25, 1.0)`

### SPECIAL EFFECTS (use sparingly)

- `TornEdge`: polygon clip-path with jagged edges
- `FoldShadow`: linear gradient simulating paper fold
- `NewsprintGrain`: feTurbulence overlay at 0.02 opacity
Clean white space is the default — effects are accents, not foundations.

### SPRING CONFIGS

- Panel entrance: `{{ damping: 22, stiffness: 120, mass: 0.8 }}`
- Text reveal: `{{ damping: 20, stiffness: 150 }}`
- Slide: `{{ damping: 24, stiffness: 90, mass: 1 }}`

### RENDERING RULES

- Pure inline styles ONLY: `style={{{{...}}}}`. No CSS files.
- All graphics via inline SVG. No image imports.
- Every `interpolate()` MUST have `{{ extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }}`
- Stagger minimum 6 frames between elements
</magazine_theme>
```

- [ ] **Step 2: Commit**

```bash
git add packages/worker/src/prompts/themes/magazine/
git commit -m "feat(themes): add magazine design-system"
```

---

### Task 4: Update theme_loader.py — remove variant logic, add get_genre

**Files:**
- Modify: `packages/worker/src/prompts/theme_loader.py`

- [ ] **Step 1: Update `_load_theme_prompt()` and add `get_genre()`**

Replace the full file content:

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


def get_genre(preset: str) -> str | None:
    """Return the genre for the given preset, or None if unknown."""
    theme = get_theme(preset)
    if not theme:
        return None
    return theme.get("genre")


def _load_theme_prompt(file_path: str, theme: dict) -> str:
    """Load a markdown prompt and substitute color placeholders."""
    raw = (_THEMES_DIR / file_path).read_text(encoding="utf-8")
    replacements = {
        **theme["colors"],
        "family": theme["family"],
        "label": theme["label"],
    }
    result = raw
    for key, value in replacements.items():
        result = result.replace(f"{{{key}}}", value)
    return result


def get_design_system(preset: str) -> str:
    """Load {family}/design-system.md with placeholders filled."""
    theme = get_theme(preset)
    if not theme:
        raise ValueError(f"Unknown theme preset: {preset}")
    return _load_theme_prompt(f"{theme['family']}/design-system.md", theme)
```

Note: `get_style_guide()` is deleted (no variant-based style guides anymore).

- [ ] **Step 2: Commit**

```bash
git add packages/worker/src/prompts/theme_loader.py
git commit -m "refactor(themes): remove variant logic, add get_genre, delete get_style_guide"
```

---

### Task 5: Update theme-loader.ts — interfaces, remove variant/style-guide functions

**Files:**
- Modify: `packages/worker/src/prompts/theme-loader.ts`

- [ ] **Step 1: Replace full file content**

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
  accent: string;
  secondary: string;
}

export interface ThemeConfig {
  family: string;
  label: string;
  genre: string;
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

export function getGenre(preset: string): string | undefined {
  return getTheme(preset)?.genre;
}

function loadThemePrompt(filePath: string, theme: ThemeConfig): string {
  const raw = readFileSync(join(THEMES_DIR, filePath), 'utf-8');
  const replacements: Record<string, string> = {
    ...theme.colors,
    family: theme.family,
    label: theme.label,
  };
  return raw.replace(/\{(\w+)\}/g, (match, key) => replacements[key] ?? match);
}

export function getDesignSystem(preset: string): string {
  const theme = getTheme(preset);
  if (!theme) throw new Error(`Unknown theme preset: ${preset}`);
  return loadThemePrompt(`${theme.family}/design-system.md`, theme);
}
```

- [ ] **Step 2: Update `generate-visuals.ts` — use `getDesignSystem` instead of deleted `getStyleGuide`**

In `packages/worker/src/prompts/generate-visuals.ts`, change line 3 and line 11:

```typescript
// Line 3: change import
import { getDesignSystem, getTheme } from './theme-loader.js';

// Line 9-11: change function body
export function getStyleGuidelines(stylePreset: string): string {
  if (!getTheme(stylePreset)) return '';
  return getDesignSystem(stylePreset);
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/worker/src/prompts/theme-loader.ts packages/worker/src/prompts/generate-visuals.ts
git commit -m "refactor(themes): update TS theme-loader interfaces, remove variant/style-guide"
```

---

### Task 6: Rename get_studio_section → get_theme_section in prompt tier

**Files:**
- Modify: `packages/worker/src/prompts/animator/animator.py:14-18`
- Modify: `packages/worker/src/prompts/animator/__init__.py`
- Modify: `packages/worker/src/prompts/__init__.py`

- [ ] **Step 1: Rename in `animator/animator.py`**

Change line 14:
```python
def get_theme_section(style_preset: str) -> str:
    """Return the design system prompt for the given theme, or empty string."""
    if not get_theme(style_preset):
        return ""
    return get_design_system(style_preset)
```

- [ ] **Step 2: Update `animator/__init__.py` exports**

Replace `get_studio_section` with `get_theme_section` in all import/export lines.

- [ ] **Step 3: Update `prompts/__init__.py` exports**

Replace `get_studio_section` with `get_theme_section` in import and `__all__`.

- [ ] **Step 4: Commit**

```bash
git add packages/worker/src/prompts/animator/animator.py packages/worker/src/prompts/animator/__init__.py packages/worker/src/prompts/__init__.py
git commit -m "refactor(themes): rename get_studio_section → get_theme_section"
```

---

### Task 7: Update get_style_description and studio references in director

**Files:**
- Modify: `packages/worker/src/prompts/director/director.py:26-39`
- Modify: `packages/worker/src/prompts/director/system.md`

- [ ] **Step 1: Fix `get_style_description()` in `director.py`**

Replace lines 26-39:
```python
def get_style_description(style_preset: str) -> str:
    """Get style description — returns minimal color/font summary from theme."""
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

- [ ] **Step 2: Update `director/system.md` studio references**

Search and replace in the file:
- `"theme": "studio-dark"` → `"theme": "blackboard"`
- `"studio-dark (accent: #6366F1, secondary: #EC4899)"` → `"blackboard (accent: #f59e0b, secondary: #06b6d4)"`
- `STUDIO THEME COLOR RULE` → `THEME COLOR RULE`
- `Default to studio-dark or studio-light` → `Default to blackboard or magazine`
- `suggestedTemplates (studio preset only)` → `suggestedTemplates`

- [ ] **Step 3: Commit**

```bash
git add packages/worker/src/prompts/director/
git commit -m "refactor(themes): update director for blackboard/magazine themes"
```

---

### Task 8: Update animator.py studio references and defaults

**Files:**
- Modify: `packages/worker/src/prompts/animator/animator.py`

- [ ] **Step 1: Update all `studio-dark` defaults and studio text references**

Search and replace throughout the file:
- `style_preset: str = "studio-dark"` → `style_preset: str = "blackboard"` (all occurrences)
- `STUDIO THEME` → `THEME` (all occurrences)
- `STUDIO TEMPLATE` → `TEMPLATE` (all occurrences)
- `STUDIO TEMPLATES` → `TEMPLATES` (all occurrences)
- `theme["variant"]` → `theme["label"]` (or `theme.get("label", "")`)
- `BACKGROUNDS.{variant}` → remove the line or replace with theme-specific reference
- `accentDefault` → `accent` (all occurrences)
- `secondaryDefault` → `secondary` (all occurrences)

- [ ] **Step 2: Commit**

```bash
git add packages/worker/src/prompts/animator/animator.py
git commit -m "refactor(themes): update animator.py studio refs to generic theme refs"
```

---

### Task 9: Update all default preset values across the codebase

**Files:**
- Modify: `packages/worker/src/agents/claude_visual_generator.py:169`
- Modify: `packages/worker/src/agents/visual_generator/_pipeline.py:25`
- Modify: `packages/worker/src/agents/visual_generator/_animator.py:147`
- Modify: `packages/worker/src/agents/visual_generator/_director.py:23`
- Modify: `packages/worker/src/agents/visual_generator/_visual_verification.py:176,291`
- Modify: `packages/sandbox/src/prompts/prompt-loader.ts:117`
- Modify: `packages/api/src/agent/agent-router.ts:105`
- Modify: `packages/api/src/agent/agent-system-prompt.ts:23`

- [ ] **Step 1: Replace all `studio-dark` defaults with `blackboard`**

In each file, find `studio-dark` and replace with `blackboard`:
- `claude_visual_generator.py:169` — argparse default
- `_pipeline.py:25` — param default
- `_animator.py:147` — param default
- `_director.py:23` — param default
- `_visual_verification.py:176,291` — param defaults
- `prompt-loader.ts:117` — `ctx.theme ?? 'blackboard'`
- `agent-router.ts:105` — `|| 'blackboard'`
- `agent-system-prompt.ts:23` — `|| 'blackboard'`

- [ ] **Step 2: Delete `_resolve_studio_templates` and its calls**

In `_animator.py`: delete the `_resolve_studio_templates` method (lines 29-67) and all references to `self._resolved_templates_md`.

In `_pipeline.py:195`: delete the `self._resolve_studio_templates(style_preset)` call.

In `claude_visual_generator.py:353`: delete the `generator._resolve_studio_templates(args.style_preset)` call.

- [ ] **Step 3: Rename `studio_section` → `theme_section` in worker pipeline files**

In `_animator.py`, `_scene_verification.py`, `_visual_verification.py`: replace all `studio_section` variable names and `get_studio_section` imports with `theme_section` and `get_theme_section`.

- [ ] **Step 4: Commit**

```bash
git add packages/worker/src/agents/ packages/sandbox/src/prompts/prompt-loader.ts packages/api/src/agent/
git commit -m "refactor(themes): replace all studio-dark defaults with blackboard"
```

---

### Task 10: Update sandbox prompts — studio-theme.md → theme.md

**Files:**
- Modify: `packages/sandbox/src/prompts/shared/identity.xml:19`
- Modify: `packages/sandbox/src/prompts/planner/system.md:258`
- Modify: `packages/sandbox/src/prompts/animator/system.md:301`
- Modify: `packages/sandbox/src/prompts/setup-agent/system.md:11,15,17,129,256,271`
- Modify: `packages/sandbox/src/prompts/setup-agent/reminder.md:2`
- Modify: `packages/sandbox/template/.claude/CLAUDE.md`

- [ ] **Step 1: Update `identity.xml`**

Line 19: change `studio-theme.md — studio visual theme (colors, fonts, springs, glass effects)` to `theme.md — visual theme (colors, fonts, animations)`

- [ ] **Step 2: Update `planner/system.md`**

Line 258: change `Read /workspace/docs/guidelines/studio-theme.md — the visual system` to `Read /workspace/docs/guidelines/theme.md — the visual system`

- [ ] **Step 3: Update `animator/system.md`**

Line 301: change `Read the studio theme — open /workspace/docs/guidelines/studio-theme.md for design tokens` to `Read the theme — open /workspace/docs/guidelines/theme.md for design tokens`

- [ ] **Step 4: Update `setup-agent/system.md`**

Replace ALL occurrences of `studio-theme.md` with `theme.md` and `studio theme` with `theme` throughout the file (lines 11, 15, 17, 129, 256, 271).

- [ ] **Step 5: Update `setup-agent/reminder.md`**

Line 2: change `Read /workspace/docs/guidelines/studio-theme.md FIRST` to `Read /workspace/docs/guidelines/theme.md FIRST`

- [ ] **Step 6: Update `template/.claude/CLAUDE.md`**

Change `studio-theme.md              # Theme design system tokens` to `theme.md                    # Theme design system tokens`

- [ ] **Step 7: Commit**

```bash
git add packages/sandbox/src/prompts/ packages/sandbox/template/.claude/CLAUDE.md
git commit -m "refactor(themes): update sandbox prompts from studio-theme.md to theme.md"
```

---

### Task 11: Replace static studio-theme.md with dynamic theme file in workspace-init

**Files:**
- Delete: `packages/sandbox/template/docs/guidelines/studio-theme.md`
- Modify: `packages/sandbox/src/workspace-init.ts:419-426`

- [ ] **Step 1: Delete the static studio-theme.md**

```bash
rm packages/sandbox/template/docs/guidelines/studio-theme.md
```

- [ ] **Step 2: Add dynamic theme file writing to workspace-init.ts**

After the existing theme copy block (line 419-426), add logic to write the active theme's design-system.md to `docs/guidelines/theme.md`:

```typescript
  // Write the active theme's design system to the standard guidelines path
  const activeTheme = payload.theme || 'blackboard';
  try {
    const themesJsonPath = join(themesDst, 'themes.json');
    const themesJson = JSON.parse(
      (await import('fs/promises')).readFileSync
        ? readFileSync(themesJsonPath, 'utf-8')
        : ''
    );
    // Actually, use the already-copied themes directory:
    const manifest = JSON.parse(
      (await readFile(join(themesDst, 'themes.json'), 'utf-8'))
    );
    const themeConfig = manifest.themes?.[activeTheme];
    if (themeConfig) {
      const family = themeConfig.family;
      const designSystemPath = join(themesDst, family, 'design-system.md');
      let designSystem = await readFile(designSystemPath, 'utf-8');
      // Substitute color placeholders
      const replacements: Record<string, string> = {
        ...themeConfig.colors,
        family: themeConfig.family,
        label: themeConfig.label,
      };
      for (const [key, value] of Object.entries(replacements)) {
        designSystem = designSystem.replaceAll(`{${key}}`, value);
      }
      const guidelinesDir = join(baseDir, 'docs', 'guidelines');
      await mkdir(guidelinesDir, { recursive: true });
      await writeFile(join(guidelinesDir, 'theme.md'), designSystem);
    }
  } catch (err) {
    logger.warn({ err }, 'Failed to write active theme design system — skipping');
  }
```

Also add `theme` to the `InitPayload` interface if not already present:
```typescript
  theme?: string;  // Active theme preset slug (e.g. 'blackboard', 'magazine')
```

And import `readFile` if not already imported (it is — line 1).

- [ ] **Step 3: Commit**

```bash
git add packages/sandbox/template/docs/guidelines/ packages/sandbox/src/workspace-init.ts
git commit -m "feat(themes): write active theme design-system to workspace at init"
```

---

### Task 12: Update genre selection to use theme's genre field

**Files:**
- Modify: `packages/worker/src/agents/visual_generator/_pipeline.py`
- Modify: `packages/worker/src/agents/visual_generator/genre_classifier.py`

- [ ] **Step 1: Update pipeline to derive genre from theme first**

In `_pipeline.py`, where genre is currently auto-classified from transcript, change to:

```python
from prompts.theme_loader import get_genre

# In the method that sets self.genre:
genre_from_theme = get_genre(style_preset)
if genre_from_theme:
    self.genre = genre_from_theme
else:
    self.genre = classify_transcript(transcript_text)
```

- [ ] **Step 2: Commit**

```bash
git add packages/worker/src/agents/visual_generator/_pipeline.py
git commit -m "feat(themes): derive genre from theme's genre field, fallback to classifier"
```

---

### Task 13: Update frontend ThemePicker

**Files:**
- Modify: `apps/web/src/features/editor-v2/components/agent-widgets/ThemePicker.tsx:3-6`

- [ ] **Step 1: Replace the themes array**

```tsx
const themes = [
  { id: 'blackboard', label: 'Blackboard Glow', description: 'Dark explainer with amber glow accents', colors: ['#0a0a14', '#f59e0b', '#06b6d4'] },
  { id: 'magazine', label: 'Magazine', description: 'Clean editorial with serif typography', colors: ['#ffffff', '#e11d48', '#0f172a'] },
];
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/editor-v2/components/agent-widgets/ThemePicker.tsx
git commit -m "feat(themes): update ThemePicker with blackboard and magazine themes"
```

---

### Task 14: Update prompts/README.md

**Files:**
- Modify: `packages/worker/src/prompts/README.md`

- [ ] **Step 1: Replace all studio references**

Search and replace:
- `studio-dark` → `blackboard`
- `studio-light` → `magazine`
- `get_studio_section` → `get_theme_section`
- `studio-*` → `blackboard/magazine`
- Update mermaid diagrams: `STUDIO` nodes → `THEME` nodes

- [ ] **Step 2: Commit**

```bash
git add packages/worker/src/prompts/README.md
git commit -m "docs: update prompts README for blackboard/magazine themes"
```
