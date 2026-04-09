# Plan 1: Theme DNA Pipeline Infrastructure

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the sandbox pipeline theme-DNA-aware — when a theme has DNA files (planner-dna.md, animator-dna.md, etc.), they get copied to the workspace and agents are told to read them. Fully backward-compatible: themes without DNA files (like magazine today) work exactly as before.

**Architecture:** DNA files live alongside each theme's design-system.md in `packages/worker/src/prompts/themes/{family}/`. During workspace init, any DNA files for the active theme are copied to `/workspace/docs/guidelines/`. The orchestrator dispatch messages append "read DNA" instructions only when the files exist. No agent prompts are rewritten.

**Tech Stack:** TypeScript, Node.js fs/promises, markdown files

**Spec reference:** `docs/superpowers/specs/2026-04-09-vox-theme-research.md` Part III

---

### Task 1: Add `vox` to themes.json manifest

**Files:**
- Modify: `packages/worker/src/prompts/themes/themes.json`

- [ ] **Step 1: Add vox theme entry**

```json
{
  "themes": {
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
    },
    "vox": {
      "family": "vox",
      "label": "Vox Explainer",
      "genre": "informative-media",
      "templateTags": ["vox-theme"],
      "colors": {
        "background": "#F1F3F2",
        "text": "#4C4E4D",
        "textMuted": "rgba(76,78,77,0.5)",
        "accent": "#FFEB00",
        "secondary": "#6D98A8"
      }
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/worker/src/prompts/themes/themes.json
git commit -m "feat(themes): add vox theme entry to manifest"
```

---

### Task 2: Create vox theme directory with design-system.md

**Files:**
- Create: `packages/worker/src/prompts/themes/vox/design-system.md`

- [ ] **Step 1: Create the vox theme directory**

```bash
mkdir -p packages/worker/src/prompts/themes/vox
```

- [ ] **Step 2: Write design-system.md**

This is the color/font/spring token file that gets copied to `/workspace/docs/guidelines/theme.md`. It uses `{placeholder}` syntax that gets filled by workspace-init.ts from themes.json colors.

```markdown
# Vox Explainer — Design System

## Color Palette

| Token | Value | Usage |
|-------|-------|-------|
| background | {background} | Light backgrounds, off-white base |
| text | {text} | Primary text on light backgrounds |
| textMuted | {textMuted} | Secondary text, captions |
| accent | {accent} | THE signature yellow — highlighter, emphasis bars |
| secondary | {secondary} | Muted teal — secondary accent, borders, data viz |

### Extended Palette (hardcoded — not overridable via themes.json)

| Token | Hex | Usage |
|-------|-----|-------|
| deepPurple | #35313F | Dark backgrounds, cinematic overlays |
| lightGray | #BBBBBB | Tertiary text, borders |
| medGray | #AAAAAA | Disabled/muted elements |
| white | #FFFFFF | Text on dark backgrounds |
| warmBlack | #1A1A2E | Rich dark cinematic |
| mutedRed | #C84B4B | Negative/cons (never bright red) |
| mutedGreen | #5B8A72 | Positive/pros (never bright green) |

## Typography

| Role | Font | Weight | Size Range |
|------|------|--------|------------|
| Headline | Playfair Display | Bold (700) | s(48)–s(64) |
| Body | Inter | Regular–Medium (400–500) | s(24)–s(32) |
| Label | Inter | Medium (500), ALL-CAPS | s(18)–s(22) |
| Hero Number | Inter | Bold (700) | s(56)–s(72) |
| Mono/Code | JetBrains Mono | Regular (400) | s(20)–s(24) |

Font pair preset: `voxDocumentary`

## Spacing (at 1080px base, use s() for scaling)

| Token | Value |
|-------|-------|
| xs | 8 |
| sm | 16 |
| md | 24 |
| lg | 40 |
| xl | 64 |
| canvasEdge | 48 |

## Spring Configs

| Name | Damping | Stiffness | Mass | Usage |
|------|---------|-----------|------|-------|
| entrance | 20 | 180 | 1 | Primary element entrances |
| settle | 25 | 200 | 1 | Secondary element settling |

Vox uses mild overshoot (5-10% past target), NOT bouncy springs.

## Easing

| Name | Bezier | Usage |
|------|--------|-------|
| entrance | (0.25, 0.1, 0.25, 1.0) | Slide-in, reveals |
| exit | (0.4, 0.0, 1.0, 1.0) | Fade-out, exits |

## Timing

| Token | Frames | Usage |
|-------|--------|-------|
| stutterStep | 2.5 | 12fps stutter quantization (30fps/12fps) |
| entranceDuration | 10 | Default entrance |
| exitDuration | 8 | Default exit (75% of entrance) |
| staggerDelay | 5 | Between staggered items |
| holdMinimum | 20 | Minimum hold before exit |
| highlighterSpeed | 10 | Yellow highlight sweep |
| typewriterSpeed | 2 | Frames per character |

## Surface Treatment

Every scene MUST have:
1. Film grain — cycling noise at 25-35% opacity
2. Rough edges — feTurbulence displacement on rectangular shapes
3. NO drop shadows. NO gradients on text. NO glossy surfaces.

## Animation Language — "Deliberate Imperfection"

- ALL graphic elements animate at 12fps stutter (quantize frame to stutterStep intervals)
- Photographs and footage stay at full 30fps (smooth Ken Burns)
- Opacity transitions stay at full 30fps (stuttered opacity looks broken)
- Entrances: slide-in with easeOut, overshoot 5-10%
- Holds: micro-motion (0.5px vertical breathe, 60-frame period)
- Exits: reverse of entrance, 75% of entrance duration
```

- [ ] **Step 3: Commit**

```bash
git add packages/worker/src/prompts/themes/vox/
git commit -m "feat(themes): add vox design-system.md with color tokens and motion rules"
```

---

### Task 3: Write the 4 Vox DNA files

**Files:**
- Create: `packages/worker/src/prompts/themes/vox/planner-dna.md`
- Create: `packages/worker/src/prompts/themes/vox/animator-dna.md`
- Create: `packages/worker/src/prompts/themes/vox/caption-dna.md`
- Create: `packages/worker/src/prompts/themes/vox/anti-patterns.md`

- [ ] **Step 1: Write planner-dna.md**

Content from spec Part III, Layer 2. Full content:

```markdown
## Vox Storytelling Structure — Planner DNA

### Opening Pattern (first 15-20 seconds)
Vox videos ALWAYS open with one of:
1. **Surprising claim** — a bold statement that challenges assumptions ("This tiny line on a map caused a war")
2. **Visual mystery** — show something unexpected, then ask "why?" ("Look at this chart. Notice anything weird?")
3. **Personal hook** — connect to viewer's experience ("You've probably seen this but never thought about why")

NEVER open with: definitions, history, or "today we'll talk about..." — that's lecture style, not Vox.

### Scene Flow Pattern
Vox videos follow a SPIRAL structure, not linear:
1. Hook (surprising claim) — 3-5s
2. Zoom out (broader context) — 4-6s
3. Zoom in (specific evidence) — 4-6s
4. New angle (reframe the question) — 3-5s
5. Deeper evidence (data, documents, experts) — 5-8s
6. Synthesis (connect the dots) — 4-6s
7. Implications (so what?) — 3-5s

Each scene should be 3-8 seconds. Vox scenes are SHORT and punchy. Maximum 15 seconds per scene.

### Scene Type Selection
When choosing visual approaches for scenes:
- If the scene CLAIMS something → use `vox-headline` or `vox-highlight`
- If the scene PROVES something → use `vox-annotation`, `vox-evidence`, or `vox-source`
- If the scene COMPARES things → use `vox-versus`, `vox-beforeafter`, or `vox-factcheck`
- If the scene LOCATES something → use `vox-map`, `vox-country`, or `vox-location`
- If the scene QUESTIONS something → use `vox-question`
- If the scene DEFINES something → use `vox-definition`
- If the scene QUANTIFIES something → use `vox-stats`, `vox-counter`, or `vox-barchart`
- If the scene SHOWS PROCESS → use `vox-process`, `vox-causeeffect`, or `vox-timeline`
- If the scene INTRODUCES PEOPLE → use `vox-collage` or `vox-profile`
- If the scene RANKS things → use `vox-ranking` or `vox-checklist`
- If the scene ALERTS → use `vox-alert` or `vox-callout`
- If the scene CONCLUDES → use `vox-takeaway` or `vox-verdict`

### Display Mode Guidance
- **Overlay**: prefer for PUNCHY moments — key stats, bold claims, single words, questions
- **Stacked**: prefer for EVIDENCE — data + speaker explaining it, quotes with attribution
- **Fullscreen**: prefer for COMPLEX VISUALS — maps, charts, process diagrams, collages

### Transition Preferences
- Default: **jump cut** (hard cut, no transition effect)
- Between major sections: blur-bridge (4-6 frame gaussian blur peaking at cut)
- NEVER: dissolves, wipes, or any "transition effect" look
```

- [ ] **Step 2: Write animator-dna.md**

Content from spec Part III, Layer 3 + Part VII micro-animation specs:

```markdown
## Vox Motion DNA — Animator Rules

### The Stutter Rule (NON-NEGOTIABLE)
ALL graphic elements (text, shapes, icons, data) animate at 12fps stutter:
```ts
import { sf } from '../constants';
// Use sf(frame) for ALL position/scale/rotation interpolations on graphics
// sf() quantizes frame: Math.floor(frame / 2.5) * 2.5
```
- Photographs and video footage stay at full 30fps (smooth Ken Burns pans)
- Opacity transitions stay at full 30fps (stuttered opacity looks broken, not stylish)
- The CONTRAST between stuttered graphics and smooth footage IS the Vox feel

### Easing — NOT Default
Vox uses aggressive ease-out (75% influence), NOT gentle default curves:
```ts
import { Easing } from 'remotion';
const voxEase = Easing.bezier(0.25, 0.1, 0.25, 1.0);
```

### Opacity/Position Offset Rule
Opacity ALWAYS leads position by 3-6 frames:
- Frame 0: opacity starts 0→1
- Frame 4: position starts moving
- Frame 12: position arrives
- Frame 14: opacity reaches 1.0

### Background-Before-Text Rule
Background shapes enter BEFORE their text content:
- Background: frame 0 of element entrance
- Text: delayed 6-12 frames after background settles

### Entrance Vocabulary
| Move | When to use | Duration |
|------|-------------|----------|
| **Slide-in** | Headlines, labels | 8-12 stuttered frames, easeOut |
| **Pop** | Icons, data points | 6 frames, scale 0→1.08→1 |
| **Highlight sweep** | Key claims, evidence | 10 frames, yellow bar width 0%→100%, 1deg rotation |
| **Typewriter** | Definitions, quotes | 2 frames/char, mask-wipe from left |
| **Draw-on** | Lines, borders, connectors | 8-12 frames, width/clip animation |
| **Progressive build** | Charts, lists, steps | Each item 4-6 frames after previous |

### Exit Rules
- Exits = 75% of entrance duration (12-frame entrance → 9-frame exit)
- Direction: reverse of entrance (slide DOWN if entered UP)
- Opacity drops FASTER than position changes
- Last in = first out (reverse stagger)

### Overshoot
Vox overshoot: 5-10% past target, 50% decay per bounce, 10-15 frames to settle.
- Primary elements: damping 20-22
- Secondary elements: damping 18-20 (slightly more bounce for follow-through)

### Hold/Idle (every element must have micro-motion)
- Text: 0.5px vertical breathe (sine wave, 60-frame period)
- Shapes: scale oscillation 0.998–1.002 (90-frame period)
- Background grain: cycling offset every 8 frames
- NO rotation idle. Vox elements don't wobble.

### Surface Treatment (EVERY scene)
1. **Film grain** — cycling noise at 25-35% opacity
2. **Rough edges** — feTurbulence displacement on clip-paths of rectangular shapes
3. NO drop shadows. NO gradients on text. NO glossy surfaces.

### Color Per Scene
- Pick 2 colors from theme: one dominant, one accent
- Yellow highlight RESERVED for single most important element
- If no "most important" element, don't use yellow
- Gray tones for secondary elements
- NEVER all theme colors in one scene

### Typography
- Headlines: Playfair Display, bold, s(48)-s(64)
- Body/labels: Inter, regular-medium, s(24)-s(32)
- Numbers: Inter, bold, s(56)-s(72) for hero stats
- ALL-CAPS only for: labels, section markers, attribution text
- NEVER: italic body text, outlined text, all-caps body

### Three-Layer Composition Rule
Every frame has 3 simultaneous layers:
1. Ambient background — grain cycling, subtle texture shift (10-15% visual weight)
2. Primary element — the hero graphic/text being narrated
3. Secondary details — supporting labels, annotations in idle micro-motion
```

- [ ] **Step 3: Write caption-dna.md**

```markdown
## Vox Caption Style — Caption Agent DNA

### Typography
- Font: Inter (sans-serif, clean, readable)
- Hero words: bold, white, large — highlight key TERMS and DATA, not emotional words
- Satellite words: regular weight, slightly dimmed

### Hero Budget
- LOWER than magazine: 25-35% of phrases (Vox is conversational, not dramatic)
- Yellow highlight on FIRST occurrence of a key term only — never repeat

### Hero Spending Priority (Vox-specific)
1. Opening hook (first phrase)
2. Surprising statistics on FIRST mention
3. Key technical terms on FIRST mention
4. Single-word dramatic pivots ("Why?", "No.", "But.")
5. Evidence citations ("a 2024 study found...")

### Behavior
- Captions feel like ANNOTATIONS, not subtitles
- Grounded, minimal animation — words appear cleanly, they don't dance
- No kinetic-luxe swooping or color cycling
- Consistent white/near-white color throughout
- Minimal scale animation

### Anti-patterns
- No dramatic hero bursts on emotional words (Vox is analytical, not hype)
- No color-coded heroes (consistent white only)
- No more than 2 consecutive hero phrases
```

- [ ] **Step 4: Write anti-patterns.md**

```markdown
## What is NOT Vox — Anti-Patterns for ALL Agents

### Animation Anti-Patterns
- NO smooth 30fps on graphic elements (MUST stutter at 12fps)
- NO bounce/elastic springs on text (too playful — Vox is confident)
- NO rotating idle animations (elements don't spin or wobble)
- NO particle effects or floating elements
- NO 3D transforms or perspective rotations
- NO neon glows, lens flares, or light rays
- NO stroke-based animations (strokeDasharray is banned)
- NO SVG hand-drawn paths

### Visual Anti-Patterns
- NO gradients on text
- NO drop shadows (too corporate)
- NO glossy/glass surfaces
- NO perfectly rounded corners on everything (rough edges preferred)
- NO symmetric layouts (slight asymmetry is intentional)
- NO more than 3 colors per scene (including background)
- NO pure white (#FFFFFF) backgrounds — use off-white (#F1F3F2)
- NO pure black (#000000) — use charcoal (#4C4E4D) or deep purple (#35313F)

### Storytelling Anti-Patterns
- NO "Today we'll learn about..." openings
- NO linear chronological structure (use spiral: hook→context→evidence→reframe)
- NO scenes that exist only to be pretty (every scene serves the argument)
- NO transitions for the sake of transitions (prefer jump cuts)
- NO "in conclusion" or "to summarize" — end with strongest point

### Texture Anti-Patterns
- NO clean, sterile backgrounds (always have grain or texture)
- NO static frames (every element has micro-motion during holds)
```

- [ ] **Step 5: Commit**

```bash
git add packages/worker/src/prompts/themes/vox/
git commit -m "feat(themes): add vox DNA files — planner, animator, caption, anti-patterns"
```

---

### Task 4: Update workspace-init.ts to copy DNA files

**Files:**
- Modify: `packages/sandbox/src/workspace-init.ts:441`

- [ ] **Step 1: Add DNA file copying after theme.md copy**

After line 441 (`await writeFile(join(guidelinesDir, 'theme.md'), designSystem);`), add:

```typescript
        if (themeSlug === activeTheme) {
          await writeFile(join(guidelinesDir, 'theme.md'), designSystem);

          // Copy theme DNA files (planner-dna, animator-dna, caption-dna, anti-patterns)
          // if they exist for this theme. Themes without DNA files work unchanged.
          const dnaFileNames = ['planner-dna.md', 'animator-dna.md', 'caption-dna.md', 'anti-patterns.md'];
          for (const dnaFile of dnaFileNames) {
            const dnaSrc = join(themesSrc, config.family, dnaFile);
            try {
              const dnaContent = await readFile(dnaSrc, 'utf-8');
              await writeFile(join(guidelinesDir, dnaFile), dnaContent);
            } catch {
              // DNA file doesn't exist for this theme — that's fine, skip silently
            }
          }
        }
```

The old code:
```typescript
        if (themeSlug === activeTheme) {
          await writeFile(join(guidelinesDir, 'theme.md'), designSystem);
        }
```

Becomes:
```typescript
        if (themeSlug === activeTheme) {
          await writeFile(join(guidelinesDir, 'theme.md'), designSystem);

          // Copy theme DNA files if they exist for this theme
          const dnaFileNames = ['planner-dna.md', 'animator-dna.md', 'caption-dna.md', 'anti-patterns.md'];
          for (const dnaFile of dnaFileNames) {
            const dnaSrc = join(themesSrc, config.family, dnaFile);
            try {
              const dnaContent = await readFile(dnaSrc, 'utf-8');
              await writeFile(join(guidelinesDir, dnaFile), dnaContent);
            } catch {
              // DNA file doesn't exist for this theme — skip silently
            }
          }
        }
```

- [ ] **Step 2: Verify magazine theme still works (no DNA files = no change)**

The `try/catch` around each DNA file read means if magazine has no DNA files, nothing is copied — zero behavior change.

- [ ] **Step 3: Commit**

```bash
git add packages/sandbox/src/workspace-init.ts
git commit -m "feat(sandbox): copy theme DNA files to workspace during init"
```

---

### Task 5: Update orchestrator dispatch to reference DNA files

**Files:**
- Modify: `packages/sandbox/src/prompts/orchestrator/system.md:237-241,289,367`

- [ ] **Step 1: Update Planner dispatch (line 239)**

Old:
```markdown
- **Theme slug** — ALWAYS include: "Theme: {theme_slug}. Call browse_templates with theme: \"{theme_slug}\". Read /workspace/docs/guidelines/theme.md for design tokens."
```

New:
```markdown
- **Theme slug** — ALWAYS include: "Theme: {theme_slug}. Call browse_templates with theme: \"{theme_slug}\". Read /workspace/docs/guidelines/theme.md for design tokens. If /workspace/docs/guidelines/planner-dna.md exists, read it for theme-specific storytelling structure and scene vocabulary. If /workspace/docs/guidelines/anti-patterns.md exists, read it for what NOT to do."
```

- [ ] **Step 2: Update Setup Agent dispatch (line 289)**

Old:
```markdown
**Include theme in dispatch:** "Theme: {theme_slug}. Read /workspace/docs/guidelines/theme.md for design tokens."
```

New:
```markdown
**Include theme in dispatch:** "Theme: {theme_slug}. Read /workspace/docs/guidelines/theme.md for design tokens. If /workspace/docs/guidelines/anti-patterns.md exists, read it for theme-specific constraints."
```

- [ ] **Step 3: Update Animator dispatch (line 367)**

Old:
```markdown
- **Theme slug** — "Theme: {theme_slug}."
```

New:
```markdown
- **Theme slug** — "Theme: {theme_slug}. If /workspace/docs/guidelines/animator-dna.md exists, read it FIRST for theme-specific motion rules. If /workspace/docs/guidelines/anti-patterns.md exists, read it for what NOT to do."
```

- [ ] **Step 4: Update Caption Agent dispatch (around line 208-218)**

Find the caption agent dispatch and add after the theme line:

```markdown
  - "If /workspace/docs/guidelines/caption-dna.md exists, read it for theme-specific caption styling. If /workspace/docs/guidelines/anti-patterns.md exists, read it for theme-specific constraints."
```

- [ ] **Step 5: Commit**

```bash
git add packages/sandbox/src/prompts/orchestrator/system.md
git commit -m "feat(orchestrator): dispatch agents with DNA file references when present"
```

---

### Task 6: Update identity.xml to document DNA file paths

**Files:**
- Modify: `packages/sandbox/src/prompts/shared/identity.xml:19`

- [ ] **Step 1: Add DNA file paths to workspace layout**

After line 19 (`- /workspace/docs/guidelines/theme.md — visual theme (colors, fonts, animations)`), add:

```xml
- /workspace/docs/guidelines/planner-dna.md — (optional, theme-specific) storytelling structure, scene vocabulary, pacing rules
- /workspace/docs/guidelines/animator-dna.md — (optional, theme-specific) motion rules, animation vocabulary, surface treatment
- /workspace/docs/guidelines/caption-dna.md — (optional, theme-specific) caption styling, hero budget, behavior rules
- /workspace/docs/guidelines/anti-patterns.md — (optional, theme-specific) what NOT to do in this theme
```

- [ ] **Step 2: Commit**

```bash
git add packages/sandbox/src/prompts/shared/identity.xml
git commit -m "feat(prompts): document optional DNA file paths in workspace layout"
```

---

### Task 7: Add `vox` to SHARED_LIB_DIRS in template-tools.ts

**Files:**
- Modify: `packages/sandbox/src/tools/template-tools.ts:16`

- [ ] **Step 1: Add vox to shared lib directories**

Old (line 16):
```typescript
const SHARED_LIB_DIRS = ['magazine'];
```

New:
```typescript
const SHARED_LIB_DIRS = ['magazine', 'vox'];
```

- [ ] **Step 2: Commit**

```bash
git add packages/sandbox/src/tools/template-tools.ts
git commit -m "feat(sandbox): add vox to shared library directories for template forking"
```

---

### Task 8: Add `voxDocumentary` font pair

**Files:**
- Modify: `packages/templates/src/fonts.ts:124`

- [ ] **Step 1: Add font pair after cleanMinimal (line 124)**

After the `cleanMinimal` entry, add:

```typescript
  voxDocumentary: {
    headline: FONTS.playfairDisplay,
    body: FONTS.inter,
    mood: "Documentary Editorial",
  },
```

- [ ] **Step 2: Commit**

```bash
git add packages/templates/src/fonts.ts
git commit -m "feat(fonts): add voxDocumentary font pair — Playfair Display + Inter"
```

---

### Task 9: Smoke test — verify magazine still works unchanged

- [ ] **Step 1: Verify themes.json is valid JSON**

```bash
cd packages/worker && node -e "JSON.parse(require('fs').readFileSync('src/prompts/themes/themes.json','utf-8')); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 2: Verify no DNA files exist for magazine (backward compat)**

```bash
ls packages/worker/src/prompts/themes/magazine/planner-dna.md 2>/dev/null && echo "EXISTS" || echo "NONE (correct)"
```

Expected: `NONE (correct)`

- [ ] **Step 3: Verify vox DNA files exist**

```bash
ls packages/worker/src/prompts/themes/vox/*.md | wc -l
```

Expected: `5` (design-system.md + 4 DNA files)

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd packages/sandbox && npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 5: Verify templates package compiles**

```bash
cd packages/templates && npx tsc --noEmit
```

Expected: No errors
