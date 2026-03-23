# Blackboard Glow Explainer Theme — Design Spec

## Overview

A new theme and template set for explainer video overlays. Dark near-black background with warm amber/orange primary glow and cool cyan secondary accents. Elements materialize with neon bloom fade-in effects.

Templates default to 9:16 (matching the existing pipeline) but are built responsively — all positioning and sizing is relative to `useVideoConfig()` dimensions, so they adapt cleanly when rendered at 16:9 or 1:1 without layout breakage. The `metadata.json` defines the default 9:16 composition; alternative aspect ratios are rendered by overriding `compositionWidth`/`compositionHeight` at render time.

This is a standalone template set — new content types designed for explainer videos, not magazine templates reskinned.

## Visual Identity

### Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `background` | `#0a0a14` | Near-black base |
| `surface` | `#141420` | Raised panels, cards |
| `surfaceBorder` | `#1e1e30` | Subtle panel borders |
| `primary` | `#f59e0b` | Warm amber — primary glow, highlights, key numbers |
| `secondary` | `#06b6d4` | Cool cyan — data accents, secondary highlights, contrast |
| `text` | `#f1f5f9` | Off-white body text |
| `textMuted` | `#94a3b8` | Subdued labels, captions |
| `textDim` | `#64748b` | Lowest emphasis text |

### Typography

- **Heading:** Space Grotesk — geometric, technical, modern
- **Body:** Inter — clean, highly readable at all sizes
- **Accent/Mono:** Fira Code — for data values, counts, code-like elements

### Glow Effects

All glow effects use CSS `boxShadow` and `textShadow` — no SVG filters needed for the bloom:

- **Primary glow:** `0 0 20px rgba(245, 158, 11, 0.4), 0 0 60px rgba(245, 158, 11, 0.15)`
- **Secondary glow:** `0 0 20px rgba(6, 182, 212, 0.4), 0 0 60px rgba(6, 182, 212, 0.15)`
- **Text glow (heading):** `0 0 30px rgba(245, 158, 11, 0.3)`
- **Subtle surface glow:** `0 0 1px rgba(245, 158, 11, 0.2)` on card borders

### Background Texture

Subtle chalk-dust noise using SVG `feTurbulence` (same pattern as magazine's `PaperTexture` but tuned for dark):
- Very low opacity (0.03-0.05)
- Warm-tinted grain on near-black base
- Creates blackboard feel without being distracting

## Motion Language

### Primary Animation: Neon Glow Fade-In

Elements materialize with expanding bloom. Two-phase animation:
1. **Glow appears first** (frames 0-10): `boxShadow` bloom fades from 0 to full spread
2. **Content fills in** (frames 5-20): opacity 0→1, slight scale 0.97→1.0

```typescript
function glowFadeIn(frame: number, start: number, duration = 20) {
  const glowProgress = interpolate(frame, [start, start + duration * 0.5], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const contentProgress = interpolate(frame, [start + duration * 0.25, start + duration], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const scale = interpolate(contentProgress, [0, 1], [0.97, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  return { glowProgress, contentProgress, scale };
}
```

### All Animation Functions

```typescript
import { interpolate, Easing } from 'remotion';

export const blackboardEasing = Easing.bezier(0.25, 0.1, 0.25, 1.0);

/**
 * Primary reveal: glow bloom appears first, then content materializes.
 * Use for any element entrance.
 */
export function glowFadeIn(frame: number, start: number, duration = 20) {
  const glowProgress = interpolate(frame, [start, start + duration * 0.5], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const contentProgress = interpolate(frame, [start + duration * 0.25, start + duration], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const scale = interpolate(contentProgress, [0, 1], [0.97, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  return { glowProgress, contentProgress, scale };
}

/**
 * Brief glow intensity pulse — use when a stat lands or a checkmark appears.
 * Returns a 0→1→0 intensity value over `duration` frames.
 */
export function glowPulse(frame: number, start: number, duration = 15) {
  const progress = interpolate(frame, [start, start + duration], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  // sin curve: peaks at 0.5 progress
  const intensity = Math.sin(progress * Math.PI);
  return { intensity, active: frame >= start && frame <= start + duration };
}

/**
 * Exit animation: glow contracts, content fades out.
 * Typically starts at durationInFrames - BLACKBOARD_TIMING.exitDuration.
 */
export function glowExit(frame: number, start: number, duration = 15) {
  const progress = interpolate(frame, [start, start + duration], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    easing: Easing.in(Easing.cubic),
  });
  return { opacity: 1 - progress, glowScale: 1 - progress * 0.3 };
}

/**
 * Stagger helper: returns glowFadeIn result for item at `index` in a sequence.
 */
export function staggeredGlowIn(frame: number, baseStart: number, index: number, staggerDelay = 7, duration = 20) {
  return glowFadeIn(frame, baseStart + index * staggerDelay, duration);
}

/**
 * Animated line draw — interpolates a 0→1 progress for stroke-dashoffset.
 * Use for connecting lines, timeline axes, arrow paths.
 */
export function drawLine(frame: number, start: number, duration = 25) {
  const progress = interpolate(frame, [start, start + duration], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    easing: blackboardEasing,
  });
  return { progress };
}
```

### Timing Constants

```typescript
export const BLACKBOARD_TIMING = {
  glowRevealDuration: 20,
  contentRevealDuration: 15,
  staggerDelay: 7,
  holdMinimum: 30,
  exitDuration: 15,
};
```

Exit timing formula: `exitStart = durationInFrames - BLACKBOARD_TIMING.exitDuration` (frame 135 for 150-frame compositions).

## Responsive System

Templates use `useVideoConfig()` to get actual `width`/`height` and adapt layout accordingly. The default composition is 1080x1920 (9:16), but all sizing and positioning is relative so templates render correctly at any aspect ratio when the composition dimensions are overridden at render time.

Layout adaptation rules (based on `width`/`height` ratio, not a prop):

- **Portrait (height > width):** Vertical stack — heading top, content flows down
- **Landscape (width > height):** Horizontal split — heading left or top, content fills width
- **Square (w ≈ h):** Compact centered layout, reduced padding

Font sizes and spacing scale relative to canvas width: `baseFontSize = width / 27` (gives ~40px on 1080w). All positioning uses percentage-based or `width/height`-relative calculations, not hardcoded pixel values.

Helper function in `src/blackboard/constants.ts`:

```typescript
export function responsive(width: number, height: number) {
  const isPortrait = height > width;
  const isLandscape = width > height;
  const isSquare = !isPortrait && !isLandscape;
  const scale = width / 1080;
  return { isPortrait, isLandscape, isSquare, scale };
}
```

## Template Set (10 Templates)

### Category A: Conceptual / Educational

#### 1. `explainer-definition`
**Term + pronunciation + definition with glow underline reveal**

- Schema: `term` (string), `pronunciation` (string, optional), `partOfSpeech` (string, optional), `definition` (string), `example` (string, optional)
- Defaults: `term: "Algorithm"`, `pronunciation: "/ˈæl.ɡə.rɪ.ðəm/"`, `partOfSpeech: "noun"`, `definition: "A step-by-step procedure for solving a problem or accomplishing a task"`, `example: "Search engines use algorithms to rank web pages"`
- Layout: Large term centered with amber glow underline, pronunciation below in muted text, definition in body text, example in cyan accent
- Animation: Term glows in → underline draws left-to-right → definition fades up → example fades in last

#### 2. `explainer-process`
**Step-by-step flow with glowing connecting lines**

- Schema: `title` (string), `steps` (array of `{ label, description }`, 3-6 items)
- Defaults: `title: "How Data Travels"`, `steps: [{ label: "Request", description: "Browser sends HTTP request" }, { label: "Server", description: "Server processes the query" }, { label: "Database", description: "Data is retrieved from storage" }, { label: "Response", description: "Results sent back to browser" }]`
- Layout portrait: Vertical flow, steps stacked with amber connecting line. Layout landscape: Horizontal flow, steps in a row
- Animation: Title glow-in → connecting line draws → each step node glows in with stagger → labels fade up

#### 3. `explainer-cause-effect`
**Two panels (cause → effect) with animated arrow bridge**

- Schema: `cause` (string), `effect` (string), `label` (string, optional, default "Therefore")
- Defaults: `cause: "Rising global temperatures melt polar ice caps"`, `effect: "Sea levels rise, threatening coastal cities"`, `label: "Therefore"`
- Layout: Two surface panels — cause on left/top (amber accent), effect on right/bottom (cyan accent), arrow bridge between
- Animation: Cause panel glows in → arrow draws across with glow trail → effect panel glows in

#### 4. `explainer-analogy`
**"X is like Y" split card with icon placeholders**

- Schema: `subject` (string), `analogy` (string), `connector` (string, default "is like"), `explanation` (string, optional)
- Defaults: `subject: "A Firewall"`, `analogy: "A Security Guard"`, `connector: "is like"`, `explanation: "It checks everything coming in and blocks anything suspicious"`
- Layout: Split card — subject left/top, analogy right/bottom, connector centered in divider
- Animation: Subject panel glow-in → connector pulses amber → analogy panel glow-in → explanation fades up

#### 5. `explainer-howitworks`
**Numbered breakdown with expanding glow circles**

- Schema: `title` (string), `items` (array of `{ label, description }`, 3-5 items)
- Defaults: `title: "How WiFi Works"`, `items: [{ label: "Signal", description: "Router broadcasts radio waves" }, { label: "Connect", description: "Device authenticates with network" }, { label: "Transfer", description: "Data packets travel wirelessly" }]`
- Layout: Title top, items in grid (2-col for portrait, row for landscape) with numbered glow circles
- Animation: Title glow-in → each number circle expands with bloom → label and description fade in with stagger

### Category B: Data / Evidence

#### 6. `explainer-stats`
**Big number count-up with glow pulse on landing**

- Schema: `stats` (array of `{ value: number, label, prefix?, suffix? }`, 2-4 items), `title` (string, optional)
- Defaults: `title: "The Internet in Numbers"`, `stats: [{ value: 5.3, label: "Billion Users", suffix: "B" }, { value: 1.13, label: "Billion Websites", suffix: "B" }, { value: 333, label: "Million Terabytes Daily", suffix: "M" }]`
- Note: `value` is `number` (not string) to enable count-up animation. `prefix`/`suffix` fields wrap the displayed number (e.g., prefix "$" + value 200 + suffix "B" → "$200B").
- Layout: Stats in centered grid (2x2 for 4, row for 2-3), large amber numbers in Fira Code, muted labels below
- Animation: Title glow-in → each stat number counts up → glow pulse on landing

#### 7. `explainer-barchart`
**Horizontal bars with cyan fill + amber labels**

- Schema: `title` (string), `bars` (array of `{ label, value: number, maxValue?: number }`, 3-6 items)
- Defaults: `title: "Programming Languages 2026"`, `bars: [{ label: "Python", value: 28 }, { label: "JavaScript", value: 22 }, { label: "TypeScript", value: 18 }, { label: "Rust", value: 12 }, { label: "Go", value: 10 }]`
- Note: `maxValue` is optional; if omitted, the largest `value` in the array is used. Values are rendered as percentage of max.
- Layout: Title top, bars stacked vertically with labels left, value numbers right
- Animation: Title glow-in → bars fill left-to-right in cyan with stagger → value numbers glow in amber at bar ends

#### 8. `explainer-comparison`
**Side-by-side columns with dual-color glow accents**

- Schema: `titleA` (string), `titleB` (string), `pointsA` (string[]), `pointsB` (string[]), `heading` (string, optional)
- Defaults: `heading: "Cloud vs On-Premise"`, `titleA: "Cloud"`, `titleB: "On-Premise"`, `pointsA: ["Scales instantly", "Pay per use", "Managed updates"]`, `pointsB: ["Full control", "One-time cost", "Data stays local"]`
- Layout: Two columns — left with amber accent, right with cyan accent, optional heading above
- Animation: Heading glow-in → column headers glow-in simultaneously → bullet points stagger from top in each column

#### 9. `explainer-ranking`
**Numbered list with staggered glow reveals**

- Schema: `title` (string), `items` (array of `{ rank: number, label, detail? }`, 3-7 items), `ascending` (boolean, default false)
- Defaults: `title: "Top 5 Renewable Energy Sources"`, `items: [{ rank: 1, label: "Solar", detail: "Most widely adopted" }, { rank: 2, label: "Wind", detail: "Fastest growing" }, { rank: 3, label: "Hydroelectric", detail: "Most reliable" }, { rank: 4, label: "Geothermal" }, { rank: 5, label: "Biomass" }]`
- Layout: Title top, ranked items stacked with large amber rank numbers, label + detail in body text
- Animation: Title glow-in → each item reveals from top (or bottom if ascending) with stagger → rank number gets brief pulse

#### 10. `explainer-timeline`
**Horizontal or vertical timeline with glowing node dots**

- Schema: `title` (string, optional), `events` (array of `{ date, label, detail? }`, 3-6 items)
- Defaults: `title: "History of the Internet"`, `events: [{ date: "1969", label: "ARPANET", detail: "First network connection" }, { date: "1983", label: "TCP/IP", detail: "Standard protocol adopted" }, { date: "1991", label: "World Wide Web", detail: "Tim Berners-Lee goes public" }, { date: "2007", label: "Mobile Era", detail: "iPhone launches" }]`
- Layout portrait: Vertical timeline with amber line, cyan node dots. Layout landscape: Horizontal timeline
- Animation: Line draws along axis → each node dot glows in with bloom → date and label fade in at each node

## Theme Infrastructure

### File: `themes/blackboard.json`

```json
{
  "slug": "blackboard",
  "name": "Blackboard Glow",
  "description": "Dark explainer theme with warm amber glow accents, cool cyan highlights, and neon bloom animations",
  "colorPalette": {
    "primary": "#f59e0b",
    "secondary": "#06b6d4",
    "accent": "#f59e0b",
    "background": "#0a0a14",
    "text": "#f1f5f9"
  },
  "fontRecommendations": {
    "heading": "Space Grotesk",
    "body": "Inter",
    "accent": "Fira Code"
  },
  "styleGuidance": "Dark educational — near-black board, warm amber glow accents, cool cyan data highlights. Motion should feel like neon signs turning on: glow appears first, then content fills in. Typography is clean and geometric. Generous dark space, minimal texture. Data-forward with glowing number reveals."
}
```

### File: `src/blackboard/constants.ts`

Exports: `BLACKBOARD_COLORS`, `BLACKBOARD_FONTS`, `BLACKBOARD_TIMING`, `BLACKBOARD_GLOW`, `responsive()` helper.

### File: `src/blackboard/animations.ts`

Exports: `glowFadeIn()`, `glowPulse()`, `glowExit()`, `staggeredGlowIn()`, `drawLine()`. All use `interpolate` with mandatory `extrapolateLeft: 'clamp'` and `extrapolateRight: 'clamp'`.

### File: `src/blackboard/effects.tsx`

Exports:
- `GlowPanel` — Surface card with configurable glow color/spread
- `GlowBorder` — Animated border that "charges up" with glow
- `GlowCircle` — Expanding circle with bloom (for step numbers, timeline nodes)

### File: `src/blackboard/textures.tsx`

Exports:
- `BoardTexture` — SVG feTurbulence noise on dark background
- `ChalkDust` — Very faint warm-tinted particle layer

### File: `src/blackboard/typography.tsx`

Exports:
- `GlowHeading` — Space Grotesk heading with amber text-shadow glow
- `GlowLabel` — Small label with subtle glow
- `DataValue` — Fira Code large number with glow pulse capability

## Template File Structure

Each template follows existing conventions:

```
src/templates/explainer-{name}/
├── index.tsx          # Main component
├── schema.ts          # Zod schema + defaultProps
├── meta.json          # Template metadata
├── metadata.json      # Composition metadata (fps, duration)
├── register.ts        # Registration with shared blackboard files
└── components/        # Template-specific sub-components (if needed)
```

### meta.json Pattern

```json
{
  "slug": "explainer-{name}",
  "name": "Explainer {Display Name}",
  "description": "...",
  "category": "overlay",
  "tags": ["blackboard-theme", "overlay", "explainer", ...],
  "stylePreset": "cleanMinimal",
  "aspectRatio": "9:16",
  "sceneCount": 1,
  "estimatedDuration": "5s",
  "thumbnail": "thumbnail.png",
  "type": "overlay",
  "themes": ["blackboard"]
}
```

Note on `stylePreset`: Uses `"cleanMinimal"` which maps to Inter/Inter in `FONT_PAIRS`. This is metadata only — actual font usage comes from `BLACKBOARD_FONTS` in the template code. The preset is a hint for the AI pipeline's font selection, not a runtime binding.

### metadata.json Pattern

```json
{
  "compositionId": "explainer-{name}",
  "durationInFrames": 150,
  "fps": 30,
  "width": 1080,
  "height": 1920
}
```

All 5 fields are required by the `CompositionMeta` type. Default is 9:16 (1080x1920). Alternative aspect ratios are achieved by overriding `compositionWidth`/`compositionHeight` at render time.

### register.ts Pattern

Each template's `getFiles()` includes own files + shared blackboard modules. Templates with sub-components must include them in `ownFileNames`:

```typescript
const ownFileNames = [
  'meta.json',
  'metadata.json',
  'schema.ts',
  'index.tsx',
  'register.ts',
  // Add any components/*.tsx files here per template
];

const sharedFileNames = [
  'constants.ts',
  'textures.tsx',
  'effects.tsx',
  'typography.tsx',
  'animations.ts',
];
// Read shared from ../../blackboard/
```

Templates that may need `components/` sub-files: `explainer-stats` (CountUp component), `explainer-barchart` (BarItem component), `explainer-process` (StepNode component).

## Registry Integration

Add all 10 templates to `packages/templates/registry.json` with:
- `"type": "registry:component"`
- `"categories": ["overlay"]`
- `"tags": ["blackboard-theme", "overlay", "explainer", ...]`
- `"meta": { "stylePreset": "cleanMinimal", "aspectRatio": "9:16", "estimatedDuration": "5s" }`

## Template Index Registration

Add imports to `packages/templates/src/index.ts`:

```typescript
import './templates/explainer-definition/register';
import './templates/explainer-process/register';
// ... all 10
```

## Fonts

Space Grotesk, Inter, and Fira Code are already loaded in `src/fonts.ts`. No new font imports needed.

## Out of Scope

- Custom font loading (all fonts already available)
- Video/image asset integration (these are pure overlay templates)
- Playground modifications (existing playground already handles new themes/templates)
- Sound effects or audio
