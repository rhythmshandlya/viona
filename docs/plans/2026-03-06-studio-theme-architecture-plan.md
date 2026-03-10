# Studio Theme Architecture — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove all non-studio themes, keep only `studio-dark` and `studio-light`, and make theme injection clean, robust, and aligned with the actual template design system.

**Architecture:** Define a `STUDIO_THEMES` color dict as single source of truth. Template the `STUDIO_DESIGN_SYSTEM` prompt with color placeholders filled per-theme. Inject a verbatim Background.tsx in the setup prompt. Rewrite the design system rules to match what templates actually do (useScale, FONT_PAIRS import, BACKGROUNDS pattern, CardShell, accent transparency). Remove all 7 non-studio presets and kinetic-typography special handling.

**Tech Stack:** TypeScript (Next.js, Fastify, Zod), Python (prompt engineering)

---

## Task 1: Update frontend types and StyleSelectionModal

**Files:**
- Modify: `apps/web/src/lib/api.ts:134`
- Modify: `apps/web/src/features/editor-v2/components/StyleSelectionModal.tsx`

**Step 1: Update the StylePreset type**

In `apps/web/src/lib/api.ts`, change line 134 from:
```ts
export type StylePreset = 'minimal' | 'modern' | 'playful' | 'bold' | 'classic' | 'apple' | 'google' | 'studio' | 'kinetic-typography';
```
to:
```ts
export type StylePreset = 'studio-dark' | 'studio-light';
```

**Step 2: Rewrite STYLE_OPTIONS in StyleSelectionModal.tsx**

Replace the entire `STYLE_OPTIONS` array (lines 31-128) with:
```tsx
const STYLE_OPTIONS: StyleOption[] = [
  {
    id: 'studio-dark',
    name: 'Studio Dark',
    description: 'Polished cards on dot-grid, dark navy background',
    colors: ['#0B0F1A', '#6366F1', '#EC4899'],
    preview: (
      <div className="w-full h-full bg-[#0B0F1A] flex items-center justify-center">
        <div className="w-10 h-6 bg-white/5 backdrop-blur rounded-lg border border-white/10" />
      </div>
    ),
  },
  {
    id: 'studio-light',
    name: 'Studio Light',
    description: 'Polished cards on dot-grid, clean light background',
    colors: ['#F8F9FB', '#6366F1', '#EC4899'],
    preview: (
      <div className="w-full h-full bg-[#F8F9FB] flex items-center justify-center">
        <div className="w-10 h-6 bg-black/[0.04] rounded-lg border border-black/[0.08]" />
      </div>
    ),
  },
];
```

**Step 3: Remove kinetic-typography brand colors UI**

Delete the entire `{selectedStyle === 'kinetic-typography' && (...)}` block (lines 541-563).

**Step 4: Update default selected style**

Change line 190:
```tsx
const [selectedStyle, setSelectedStyle] = useState<StylePreset>('modern');
```
to:
```tsx
const [selectedStyle, setSelectedStyle] = useState<StylePreset>('studio-dark');
```

**Step 5: Remove kinetic-typography color encoding from handleGenerate**

In `handleGenerate()` (lines 202-221), remove the `if (selectedStyle === 'kinetic-typography')` block (lines 205-213). Keep only:
```tsx
const handleGenerate = () => {
    const finalStyleGuide = styleGuide.trim() || undefined;
    onSelect({
      stylePreset: selectedStyle,
      layoutMode,
      dimensions,
      styleGuide: finalStyleGuide,
    });
  };
```

**Step 6: Verify — run TypeScript check**

```bash
cd apps/web && npx tsc --noEmit --pretty false 2>&1 | head -30
```
Expected: No errors related to StylePreset (there may be downstream errors in agent-tools.ts — those are fixed in Task 2).

**Step 7: Commit**

```bash
git add apps/web/src/lib/api.ts apps/web/src/features/editor-v2/components/StyleSelectionModal.tsx
git commit -m "feat(web): replace 9 style presets with studio-dark and studio-light

Remove minimal, modern, playful, bold, classic, apple, google, kinetic-typography.
Keep only studio-dark and studio-light with proper preview cards.
Remove kinetic-typography brand colors UI."
```

---

## Task 2: Update agent-tools.ts Zod enums and type casts

**Files:**
- Modify: `packages/api/src/agent/agent-tools.ts:651,731,818,898`

**Step 1: Fix plan_visuals tool Zod enum (line 651)**

Change:
```ts
stylePreset: z.enum(['minimal', 'modern', 'playful', 'bold', 'classic', 'studio', 'apple', 'google', 'kinetic-typography']),
```
to:
```ts
stylePreset: z.enum(['studio-dark', 'studio-light']),
```

**Step 2: Fix plan_visuals type cast (line 731)**

Change:
```ts
stylePreset: stylePreset as 'minimal' | 'modern' | 'playful' | 'bold' | 'classic' | 'studio',
```
to:
```ts
stylePreset: stylePreset as 'studio-dark' | 'studio-light',
```

**Step 3: Fix start_generation tool Zod enum (line 818)**

Change:
```ts
stylePreset: z.enum(['minimal', 'modern', 'playful', 'bold', 'classic', 'studio', 'apple', 'google', 'kinetic-typography']),
```
to:
```ts
stylePreset: z.enum(['studio-dark', 'studio-light']),
```

**Step 4: Fix start_generation type cast (line 898)**

Change:
```ts
stylePreset: stylePreset as 'minimal' | 'modern' | 'playful' | 'bold' | 'classic' | 'studio',
```
to:
```ts
stylePreset: stylePreset as 'studio-dark' | 'studio-light',
```

**Step 5: Verify**

```bash
cd packages/api && npx tsc --noEmit --pretty false 2>&1 | head -20
```

**Step 6: Commit**

```bash
git add packages/api/src/agent/agent-tools.ts
git commit -m "feat(agent): update stylePreset Zod enums to studio-dark | studio-light"
```

---

## Task 3: Update agent system prompt

**Files:**
- Modify: `packages/api/src/agent/agent-system-prompt.ts:190`

**Step 1: Replace style list**

Find the line containing the STYLES description (line 190) and replace the full style list with:
```
STYLES: studio-dark (polished card animations on dot-grid, dark navy #0B0F1A background, glassmorphic cards, 60+ pre-built template library), studio-light (same card system on light #F8F9FB background)
```

Remove all mentions of: minimal, modern, playful, bold, classic, apple, google, kinetic-typography.

**Step 2: Commit**

```bash
git add packages/api/src/agent/agent-system-prompt.ts
git commit -m "feat(agent): update system prompt style descriptions for studio-dark/light"
```

---

## Task 4: Update TypeScript job data interfaces

**Files:**
- Modify: `packages/worker/src/processors/plan-visuals.ts:39`
- Modify: `packages/worker/src/processors/generate-visuals.ts:425`

**Step 1: Fix PlanVisualsJobData (plan-visuals.ts line 39)**

Change:
```ts
stylePreset: 'minimal' | 'modern' | 'playful' | 'bold' | 'classic' | 'apple' | 'google' | 'studio';
```
to:
```ts
stylePreset: 'studio-dark' | 'studio-light';
```

**Step 2: Fix GenerateVisualsJobData (generate-visuals.ts line 425)**

Change:
```ts
stylePreset: 'minimal' | 'modern' | 'playful' | 'bold' | 'classic' | 'apple' | 'google' | 'studio' | 'kinetic-typography';
```
to:
```ts
stylePreset: 'studio-dark' | 'studio-light';
```

**Step 3: Fix template copy condition (generate-visuals.ts line 797)**

Change:
```ts
if (stylePreset === 'studio') {
```
to:
```ts
if (stylePreset === 'studio-dark' || stylePreset === 'studio-light') {
```

Also on line 812, where `listTemplates` is called:
```ts
const studioTemplates = listTemplates({ theme: 'studio' });
```
Keep this as-is — templates are tagged `studio-theme` and shared between both variants.

**Step 4: Fix default fallback (plan-visuals.ts line 162)**

Change:
```ts
stylePreset: stylePreset || 'modern',
```
to:
```ts
stylePreset: stylePreset || 'studio-dark',
```

**Step 5: Verify**

```bash
cd packages/worker && npx tsc --noEmit --pretty false 2>&1 | head -20
```

**Step 6: Commit**

```bash
git add packages/worker/src/processors/plan-visuals.ts packages/worker/src/processors/generate-visuals.ts
git commit -m "feat(worker): update job data interfaces and template copy for studio-dark/light"
```

---

## Task 5: Rewrite Director prompt style descriptions

**Files:**
- Modify: `packages/worker/src/agents/prompts/director.py:700-801,961-1150`

**Step 1: Replace STYLE_PRESET_DESCRIPTIONS dict (lines 700-801)**

Replace the entire dict with:
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
    },
    "studio-light": {
        "variant": "light",
        "background": "#F8F9FB",
        "text": "#111827",
        "textMuted": "rgba(0,0,0,0.45)",
        "gridColor": "rgba(0,0,0,0.04)",
        "cardBg": "rgba(0,0,0,0.04)",
        "cardBorder": "rgba(0,0,0,0.08)",
    },
}

_STUDIO_STYLE_TEMPLATE = """Polished card-based animations floating on dot-grid backgrounds. {variant_label} with glassmorphic cards.
This style has a PRE-BUILT TEMPLATE LIBRARY of 60+ components the Animator can copy and customize.

**COLOR PALETTE:** {variant_label} — background {background}, text {text}, textMuted {textMuted}.
Cards: glassmorphic ({cardBg} bg, blur(20px), 1px {cardBorder} border, 32px radius).
Grid: dot-grid ({gridColor}, 32px spacing, r=1 dots).
Default accents: primary #6366F1 (indigo), secondary #EC4899 (pink).

**FONT PAIRS (pick ONE per project):**
| Key | Headline | Body | Vibe |
|-----|----------|------|------|
| boldImpact | Bebas Neue | Roboto | Bold dramatic |
| cleanMinimal | Inter | Inter | Clean restrained |
| modernTech | Montserrat | Inter | Professional |
| elegantEditorial | Playfair Display | Lato | Sophisticated |
| friendlyTech | Poppins | Inter | Approachable |

**CARD LAYOUT:** Centered flex containers on dot-grid background.
Cards: s(56)-s(64) padding, maxWidth s(900) (or 85% canvas). Glass style default, also solid/gradient/outline.

**TEMPLATE LIBRARY:**
Check src/.templates/ for pre-built template source code. If a template matches the scene purpose,
plan the scene around that template's structure. Categories: data-viz (stat-counter, stat-donut,
bar-chart-race), lower-thirds (speaker-id, guest-intro-card), social (poll-battle, emoji-slider-poll),
comparisons (versus-screen, pros-cons), intros/outros (channel-intro, end-screen, logo-stinger),
marketing (product-card, coupon-badge, qr-code-reveal), education (definition-tooltip, formula-display).

If a STUDIO_TEMPLATES.md file exists in the workspace src/ directory, READ IT FIRST for the full
template catalog. Plan scenes that can leverage existing templates when possible.

**TEMPLATE SUGGESTIONS:**
For each scene, add a "suggestedTemplates" array to scenes.json with 1-2 template slugs that match
the scene's purpose. If no template fits, omit the field.
Examples: revenue growth → ["stat-counter"], comparison → ["versus-screen", "pros-cons"],
timeline → ["timeline-cascade"], process → ["process-flow"].

**ANIMATION FEEL:** SPRINGS.SMOOTH (damping: 26, stiffness: 120) for premium settle, SPRINGS.SNAPPY (damping: 18, stiffness: 180) for hero reveals.
Stagger 6-8 frames. Use spring entrances for cards, interpolate for continuous motion.
"""

def get_style_description(style_preset: str) -> str:
    theme = STUDIO_THEMES.get(style_preset, STUDIO_THEMES["studio-dark"])
    variant_label = "Dark mode" if theme["variant"] == "dark" else "Light mode"
    return _STUDIO_STYLE_TEMPLATE.format(variant_label=variant_label, **theme)

# Keep this for backward compat in case anything still references it
STYLE_PRESET_DESCRIPTIONS = {
    "studio-dark": get_style_description("studio-dark"),
    "studio-light": get_style_description("studio-light"),
}
```

**Step 2: Delete the kinetic-typography Director function**

Delete the entire `_build_kinetic_typography_director_message()` function (starts around line 961). It's a large function — find it with:
```bash
grep -n "_build_kinetic_typography" packages/worker/src/agents/prompts/director.py
```

**Step 3: Update build_director_user_message**

Find the kinetic-typography early return (around line 1146):
```python
if style_preset == "kinetic-typography":
    return _build_kinetic_typography_director_message(...)
```
Delete this entire conditional block.

Update the style description lookup (around line 1143):
```python
style_desc = STYLE_PRESET_DESCRIPTIONS.get(style_preset, STYLE_PRESET_DESCRIPTIONS["modern"])
```
to:
```python
style_desc = get_style_description(style_preset)
```

**Step 4: Verify no syntax errors**

```bash
cd packages/worker && python -c "import ast; ast.parse(open('src/agents/prompts/director.py').read()); print('OK')"
```
Expected: `OK`

**Step 5: Commit**

```bash
git add packages/worker/src/agents/prompts/director.py
git commit -m "feat(director): replace 9 style descriptions with STUDIO_THEMES dict + template

Single source of truth for studio-dark/light colors. Remove kinetic-typography
Director function. Style descriptions generated from theme dict."
```

---

## Task 6: Rewrite Animator design system and setup prompt

This is the largest task — rewriting the STUDIO_DESIGN_SYSTEM, get_studio_section(), and ANIMATOR_SETUP_PROMPT to be accurate to what templates actually do.

**Files:**
- Modify: `packages/worker/src/agents/prompts/animator.py:12-135,2560,2945-2973,4720-4804,5451-5504`

**Step 1: Replace STUDIO_DESIGN_SYSTEM and get_studio_section (lines 12-135)**

Replace the entire block (from line 12 to line 135) with:

```python
# ---------------------------------------------------------------------------
# Studio Design System — injected when style_preset starts with "studio"
# Single source of truth for studio-dark / studio-light theme colors.
# ---------------------------------------------------------------------------

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

_STUDIO_DESIGN_SYSTEM_TEMPLATE = """
<studio_templates>
## STUDIO THEME — TEMPLATE LIBRARY (shadcn model)

Templates are **source code you own**. Like shadcn/ui, you copy the source into your
scene file and customize freely — they are NOT imported as black-box packages.

### Template Location
Each template lives in `src/.templates/{{slug}}/` with:
- `index.tsx` — Main component
- `schema.ts` — Zod props schema (self-defaults via `schema.parse({{}})`)
- `constants.ts` — BACKGROUNDS object + `getConstants()` for colors/fonts
- `components/` — Reusable sub-components (CardShell, TrendBadge, etc.)

### Workflow
1. Check `suggestedTemplates` in `scenes.json` for each scene
2. Read template source — `src/.templates/{{slug}}/index.tsx` (and `components/`)
3. Copy into Scene file — paste relevant code into `scenes/SceneN.tsx`
4. Adapt — swap data, adjust timing, use the theme colors below
5. When adapting template code, use **`BACKGROUNDS.{variant}`** for theme colors

### ACTIVE THEME: {variant_label}

**Theme Colors (from BACKGROUNDS.{variant}):**
- background: `{background}`
- text: `{text}`
- textMuted: `{textMuted}`
- gridColor: `{gridColor}`
- cardBg: `{cardBg}`
- cardBorder: `{cardBorder}`

Default accents: primary `{accentDefault}` (indigo), secondary `{secondaryDefault}` (pink).

### RESPONSIVE SCALING (CRITICAL)

Templates use `useScale()` from `../../use-scale` for ALL pixel values.
Base canvas: 1080px wide. `s(32)` = 32px at 1080w, scales proportionally.

```tsx
import {{ useScale }} from '../../use-scale';
const s = useScale();
// Use s() for ALL numeric values:
fontSize: s(48),  padding: s(56),  borderRadius: s(32),  gap: s(20)
```

**You MUST use `s()` for every pixel value in your scene code.** Raw pixel numbers
will break on non-1080 canvases.

### FONT SYSTEM

Import from shared fonts module — do NOT use raw font-family strings:
```tsx
import {{ FONT_PAIRS }} from '../../fonts';
const FONTS = FONT_PAIRS['boldImpact']; // or cleanMinimal, modernTech, etc.
// Then use: fontFamily: FONTS.headline, fontFamily: FONTS.body
```

Available pairs:
| Key | Headline | Body |
|-----|----------|------|
| boldImpact | Bebas Neue | Roboto |
| cleanMinimal | Inter | Inter |
| modernTech | Montserrat | Inter |
| elegantEditorial | Playfair Display | Lato |
| friendlyTech | Poppins | Inter |

### DOT GRID BACKGROUND (include in every non-overlay scene)

```tsx
const DotGrid: React.FC<{{ color: string; s: (px: number) => number }}> = ({{ color, s }}) => (
  <svg width="100%" height="100%" style={{{{ position: 'absolute', inset: 0, pointerEvents: 'none' }}}}>
    <defs>
      <pattern id="dot-grid" width={{s(32)}} height={{s(32)}} patternUnits="userSpaceOnUse">
        <circle cx={{s(16)}} cy={{s(16)}} r={{s(1)}} fill={{color}} />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#dot-grid)" />
  </svg>
);
// Usage: <DotGrid color="{gridColor}" s={{s}} />
```

### CARD CONTAINERS

Glass card (default):
```tsx
{{
  background: '{cardBg}',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid {cardBorder}',
  borderRadius: s(32),
  padding: `${{s(56)}}px ${{s(64)}}px`,
  maxWidth: s(900),
  boxShadow: `0 ${{s(8)}}px ${{s(32)}}px rgba(0, 0, 0, 0.2)`,
}}
```
Variants: solid (opaque bg), gradient (`linear-gradient(135deg, ${{accentColor}}18 0%, {cardBg} 100%)`), outline (transparent + border only).

### ACCENT COLOR TRANSPARENCY CONVENTION

When using accent colors for glows, tints, and overlays, append hex alpha:
- `${{accentColor}}18` — 9% opacity (subtle tint, gradient bg)
- `${{accentColor}}30` — 19% (medium tint)
- `${{accentColor}}44` — 27% (radial glow)
- `${{accentColor}}66` — 40% (text shadow glow)
- `${{accentColor}}88` — 53% (strong glow)

### ANIMATION LIFECYCLE (every scene MUST follow)

1. **Intro** (frames 0-15): opacity 0→1
2. **Stagger entrance** (frames 15-100): elements spring in, 6-8 frame delays
3. **Hold** (frames 100 to dF-30): content visible, subtle continuous motion
4. **Outro** (frames dF-30 to dF): opacity 1→0
- Combine: `const opacity = introOpacity * outroOpacity;`

### SPRING CONFIGS (from templates)

- Card entrance: `{{ damping: 20, stiffness: 120, mass: 0.8 }}` — smooth settle
- Hero text reveal: `{{ damping: 20, stiffness: 170 }}` — snappy
- Heavy slam: `{{ damping: 10, stiffness: 200, mass: 1.4 }}` — dramatic impact
- Gentle slide: `{{ damping: 20, stiffness: 90, mass: 1 }}` — standard
- **NEVER** damping < 10 (too bouncy) or > 26 (overdamped)

### RENDERING RULES

- Pure inline styles ONLY: `style={{{{...}}}}`. No CSS files, no CSS-in-JS.
- All graphics via inline SVG (charts, icons, shapes). No image imports.
- Every `interpolate()` MUST have `{{ extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }}`
- Never use `Math.sin/cos` on text positions (causes jitter)
- `backdropFilter` always paired with `WebkitBackdropFilter`
- Stagger minimum 6 frames between elements
</studio_templates>
"""


def get_studio_section(style_preset: str) -> str:
    """Return the Studio design system prompt for the given theme, or empty string."""
    theme = STUDIO_THEMES.get(style_preset)
    if not theme:
        return ""
    variant_label = "Dark mode" if theme["variant"] == "dark" else "Light mode"
    return _STUDIO_DESIGN_SYSTEM_TEMPLATE.format(variant_label=variant_label, **theme)
```

**Step 2: Update build_animator_user_message default (around line 2560)**

Change:
```python
def build_animator_user_message(project_id: str, style_preset: str = "modern") -> str:
```
to:
```python
def build_animator_user_message(project_id: str, style_preset: str = "studio-dark") -> str:
```

**Step 3: Update studio template workflow conditional (around line 2945)**

Change:
```python
if style_preset == "studio":
```
to:
```python
if style_preset.startswith("studio"):
```

Also in the appended text, add the BACKGROUNDS variant instruction. After the existing template workflow text, add:
```python
        base_message += f"""
When adapting template code, use `BACKGROUNDS.{STUDIO_THEMES.get(style_preset, {{}}).get('variant', 'dark')}` for theme colors.
"""
```

**Step 4: Update ANIMATOR_SETUP_PROMPT (around line 4720)**

In the setup prompt, replace the Background.tsx instruction (the current lines about "GENERIC Studio Dark background") with a verbatim Background.tsx code block. The setup prompt should say:

Find the current Background.tsx rules section and replace it with:
```
- Background.tsx MUST be copied VERBATIM from the code block below — do NOT improvise:

```tsx
import React from 'react';
import { AbsoluteFill, useVideoConfig } from 'remotion';
import { COLORS } from '../constants';

const DotGrid: React.FC<{ color: string; spacing: number }> = ({ color, spacing }) => {
  const { width, height } = useVideoConfig();
  return (
    <svg width={width} height={height} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <defs>
        <pattern id="dot-grid" width={spacing} height={spacing} patternUnits="userSpaceOnUse">
          <circle cx={spacing / 2} cy={spacing / 2} r={1} fill={color} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#dot-grid)" />
    </svg>
  );
};

export const Background: React.FC = () => {
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.background }}>
      <DotGrid color={COLORS.gridColor || 'rgba(255,255,255,0.04)'} spacing={32} />
    </AbsoluteFill>
  );
};
```

This is the Studio template background — dot-grid only. Do NOT add topic-specific visuals.
The AI must also ensure constants.ts exports `gridColor` in COLORS.
```

**Step 5: Update build_scene_task_prompt default and conditional (around line 5451)**

Change function default:
```python
style_preset: str = "modern",
```
to:
```python
style_preset: str = "studio-dark",
```

Change conditional (around line 5487):
```python
if style_preset == "studio":
```
to:
```python
if style_preset.startswith("studio"):
```

**Step 6: Remove any kinetic-typography conditionals in animator.py**

Search for and remove all `kinetic-typography` references:
```bash
grep -n "kinetic" packages/worker/src/agents/prompts/animator.py
```
Remove any conditionals, comments, or code blocks that handle kinetic-typography specially.

**Step 7: Verify no syntax errors**

```bash
cd packages/worker && python -c "import ast; ast.parse(open('src/agents/prompts/animator.py').read()); print('OK')"
```
Expected: `OK`

**Step 8: Commit**

```bash
git add packages/worker/src/agents/prompts/animator.py
git commit -m "feat(animator): rewrite STUDIO_DESIGN_SYSTEM with accurate template rules

- STUDIO_THEMES dict as single color source of truth
- Design system prompt templated with color placeholders
- Rules match actual template patterns: useScale(), FONT_PAIRS import,
  BACKGROUNDS.variant, CardShell spring configs, accent transparency
- Verbatim Background.tsx in setup prompt (no creative freedom)
- Remove kinetic-typography handling
- All defaults changed from 'modern' to 'studio-dark'"
```

---

## Task 7: Update Python visual generator

**Files:**
- Modify: `packages/worker/src/agents/claude_visual_generator.py`

This file has ~15 locations where `style_preset` appears. The changes are mechanical:

**Step 1: Update all default parameter values**

Find all function signatures with `style_preset: str = "modern"` and change to `style_preset: str = "studio-dark"`. Locations (approximate lines): 3535, 3660, 3871, 4049, 4339, 5096, 5636.

```bash
cd packages/worker && grep -n 'style_preset.*=.*"modern"' src/agents/claude_visual_generator.py
```

For each match, change `"modern"` to `"studio-dark"`.

**Step 2: Update studio conditionals**

Find all `style_preset == "studio"` checks and change to `style_preset.startswith("studio")`:

```bash
cd packages/worker && grep -n 'style_preset == "studio"' src/agents/claude_visual_generator.py
```

For each match (approximate lines: 4105, 4400, 5470), change:
```python
if style_preset == "studio":
```
to:
```python
if style_preset.startswith("studio"):
```

**Step 3: Remove kinetic-typography conditionals**

```bash
cd packages/worker && grep -n 'kinetic' src/agents/claude_visual_generator.py
```

For each match, remove the kinetic-typography conditional block. These are typically `if style_preset == "kinetic-typography":` blocks with special handling — delete them.

**Step 4: Update documentation string (around line 4070)**

Change:
```python
style_preset: Visual style preset (minimal, modern, playful, bold, classic, studio)
```
to:
```python
style_preset: Visual style preset (studio-dark, studio-light)
```

**Step 5: Verify no syntax errors**

```bash
cd packages/worker && python -c "import ast; ast.parse(open('src/agents/claude_visual_generator.py').read()); print('OK')"
```
Expected: `OK`

**Step 6: Commit**

```bash
git add packages/worker/src/agents/claude_visual_generator.py
git commit -m "feat(worker): update visual generator for studio-dark/light presets

- All style_preset defaults changed to 'studio-dark'
- Studio conditionals use startsWith('studio') for both variants
- Remove kinetic-typography special handling"
```

---

## Task 8: Final verification — full TypeScript check

**Step 1: Run full type check across the monorepo**

```bash
cd packages/api && npx tsc --noEmit --pretty false 2>&1 | head -30
cd packages/worker && npx tsc --noEmit --pretty false 2>&1 | head -30
cd apps/web && npx tsc --noEmit --pretty false 2>&1 | head -30
```

Fix any type errors that appear. Common issues:
- Job data interfaces may still reference old preset names
- Agent system prompt may have stale references

**Step 2: Verify Python**

```bash
cd packages/worker && python -c "
import ast
ast.parse(open('src/agents/prompts/director.py').read())
ast.parse(open('src/agents/prompts/animator.py').read())
ast.parse(open('src/agents/claude_visual_generator.py').read())
print('All Python files OK')
"
```

**Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve type errors from studio theme refactor"
```

---

## Summary

| # | What | Why |
|---|------|-----|
| 1 | Frontend: 2 presets only | Remove choice paralysis, both themes are production-quality |
| 2 | Agent tools: Zod enums | Type safety for studio-dark/light only |
| 3 | Agent system prompt | LLM knows available styles |
| 4 | Job data interfaces + template copy | Worker accepts and routes both variants |
| 5 | Director: STUDIO_THEMES dict | Single source of truth for colors, templated descriptions |
| 6 | Animator: rewritten design system | Accurate rules matching actual template patterns (useScale, FONT_PAIRS, BACKGROUNDS.variant, CardShell, accent transparency) |
| 7 | Visual generator: conditionals | Routes both studio-dark and studio-light to template pipeline |
| 8 | Full verification | Catch any remaining type/syntax errors |
