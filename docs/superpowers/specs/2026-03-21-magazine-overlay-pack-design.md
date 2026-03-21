# Magazine Overlay Pack — Design Spec

## Goal

Build 5 high-quality, cinematic overlay templates for the magazine theme. Overlays are transparent Remotion compositions that composite on top of speaker video. They target short-form informative content — creators explaining geopolitics, current events, history (think Johnny Harris / TLDR News style for TikTok/Reels/Shorts).

## Context

- **Overlays** are templates with transparent backgrounds, layered on speaker video. No standalone background.
- **Magazine aesthetic**: serif typography (Playfair Display, Lora, Merriweather), warm earth tones (#2D1B0E, #8B6914, #C4A265, #F5F0E8), paper textures, torn edges, ink effects, cinematic subtle motion.
- **Content is AI-generated** from transcript — the pipeline analyzes what the speaker says and auto-generates overlay props (headlines, stats, facts). Schemas should be straightforward for AI to fill.
- **All effects are procedural** — SVG filters for paper grain (`feTurbulence`), SVG clip-paths for torn edges, CSS 3D transforms for folds, CSS gradients for shadows. No binary asset dependencies. Same self-contained pattern as existing map templates.
- **Fonts already loaded** in `src/fonts.ts`: Playfair Display, Lora, Merriweather.
- **Theme JSON** exists at `themes/magazine.json` with color palette, font recommendations, and style guidance.

## Architecture

### Shared Magazine Library

`packages/templates/src/magazine/` — imported by all 5 overlays.

```
src/magazine/
├── constants.ts      # Magazine colors, font families, timing curves
├── textures.tsx      # PaperTexture, NewsprintGrain, CoffeeStain
├── effects.tsx       # TornEdge, FoldShadow, BurnEdge, InkBleed
├── typography.tsx    # SerifHeadline, Byline, Dateline, DropCap, SectionLabel
└── animations.ts     # magazineSpring, editorialReveal(), paperSlide()
```

#### `constants.ts`

```typescript
import { FONTS } from '../../fonts';

export const MAGAZINE_COLORS = {
  primary: '#2D1B0E',
  secondary: '#8B6914',
  accent: '#C4A265',
  background: '#F5F0E8',
  text: '#1A1A1A',
  stamp: '#8B0000',
  redaction: '#1A1A1A',
  paperWhite: '#F5F0E8',
  paperAged: '#E8DCC8',
  inkBlack: '#1A1A1A',
} as const;

export const MAGAZINE_FONTS = {
  headline: FONTS.playfairDisplay,
  body: FONTS.lora,
  accent: FONTS.merriweather,
} as const;

export const MAGAZINE_TIMING = {
  revealDuration: 20,   // frames for a standard editorial reveal
  staggerDelay: 12,     // frames between staggered elements
  holdMinimum: 30,      // minimum frames to hold readable text
} as const;
```

#### `textures.tsx`

Procedural paper and grain components using SVG filters.

- **`PaperTexture`** — Aged parchment using layered `<feTurbulence type="fractalNoise">` + `<feColorMatrix>` for warm cream tone with fiber grain. Props: `age: number` (0-1, controls yellowing), `opacity: number`.
- **`NewsprintGrain`** — Fine dot-matrix noise. High-frequency `feTurbulence` at low opacity for printed-paper feel.
- **`CoffeeStain`** — Decorative circular watermark using radial gradients with irregular edges. Props: `x`, `y`, `size`, `opacity`.

All render as `<AbsoluteFill>` with `pointerEvents: 'none'` so they layer without blocking.

#### `effects.tsx`

Edge and surface effects using SVG.

- **`TornEdge`** — SVG clip-path with programmatically generated jagged path. Props: `edges: ('top' | 'bottom' | 'left' | 'right')[]`, `roughness: number` (0-1), `seed: number` (for deterministic randomness via Remotion's `random()`). Generates a polygon clip-path where specified edges have irregular offsets.
- **`FoldShadow`** — CSS linear gradient simulating a crease shadow. Props: `angle: number`, `position: number` (0-1 across the surface), `depth: number`.
- **`BurnEdge`** — Dark vignette with irregular opacity along edges. SVG radial gradient with `feTurbulence` displacement for organic edge.
- **`InkBleed`** — SVG filter combining `feGaussianBlur` (slight spread) + `feColorMatrix` (threshold to keep it dark) applied to text. Makes text edges look absorbed into paper. Used as a filter `id` applied to text elements via `style={{ filter: 'url(#inkBleed)' }}`.

#### `typography.tsx`

Editorial text components. All use magazine fonts and colors from `constants.ts`.

- **`SerifHeadline`** — Large Playfair Display text. Props: `text`, `size` (default `FONT_SIZES.hero`), `showRule` (optional rule line above/below). Letterspacing -0.02em for editorial tightness.
- **`Byline`** — Small caps Lora. Props: `source: string`. Renders "By {source}" with tracking.
- **`Dateline`** — Formatted date + location. Props: `date: string`, `location?: string`. Renders "MARCH 21, 2026 • WASHINGTON" style.
- **`SectionLabel`** — Small label with rule lines. Props: `label: string` ("ANALYSIS", "BREAKING", etc.). Uppercase Merriweather with horizontal rules on each side.

#### `animations.ts`

Shared motion utilities.

```typescript
import { interpolate, Easing } from 'remotion';

export const magazineEasing = Easing.bezier(0.25, 0.1, 0.25, 1.0); // subtle, cinematic

export function editorialReveal(frame: number, start: number, duration = 20) {
  const opacity = interpolate(frame, [start, start + duration], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: magazineEasing,
  });
  const translateY = interpolate(frame, [start, start + duration], [15, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: magazineEasing,
  });
  return { opacity, translateY };
}

export function paperSlide(frame: number, start: number, duration = 25, direction: 'left' | 'right' | 'up' | 'down' = 'up') {
  const progress = interpolate(frame, [start, start + duration], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: magazineEasing,
  });
  const rotation = interpolate(frame, [start, start + duration], [direction === 'left' ? -3 : 3, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: magazineEasing,
  });
  // Returns transform values based on direction
  const offsets = { left: [-400, 0], right: [400, 0], up: [0, 400], down: [0, -400] };
  const [startX, startY] = offsets[direction];
  const translateX = interpolate(progress, [0, 1], [startX, 0]);
  const translateY = interpolate(progress, [0, 1], [startY, 0]);
  return { translateX, translateY, rotation, opacity: progress };
}

export function exitTear(frame: number, start: number, duration = 20) {
  const progress = interpolate(frame, [start, start + duration], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  return { progress, opacity: 1 - progress };
}
```

### Overlay Templates

All 5 overlays live at `packages/templates/src/templates/magazine-{name}/` and share:
- Transparent background (`backgroundColor: 'transparent'` on root `AbsoluteFill`)
- 9:16 aspect (1080x1920)
- 30fps
- `themes: ["magazine"]` in `meta.json`
- `type: "overlay"` in `meta.json`
- Category: `"overlay"` (new value added to `TemplateMeta` category union)

---

### Overlay 1: Magazine Newspaper (`magazine-newspaper`)

A physical newspaper front page flies in, unfolds with 3D perspective, camera pushes into the headline, then the paper tears away to transparency.

**Duration:** 4s (120 frames)

**Schema:**

```typescript
export const schema = z.object({
  headline: z.string().default('Breaking Development in Global Trade'),
  subhead: z.string().default('New agreements reshape international commerce'),
  publicationDate: z.string().default('March 21, 2026'),
  section: z.string().default('WORLD AFFAIRS'),
});
```

**Components:**
- `NewspaperPage.tsx` — Full front page layout: masthead rule, section label (via `SectionLabel`), headline (via `SerifHeadline`), subhead, dateline, column rules, blurred body text (lorem). All on `PaperTexture` with `NewsprintGrain`. Uses CSS `perspective` + `transform: rotateX/rotateY` for 3D paper feel.
- `HeadlineZoom.tsx` — Handles the camera push: scales up the headline area while fading the surrounding page elements.
- `TearTransition.tsx` — Animated `TornEdge` clip-path that sweeps across the frame, combined with paper sliding out.

**Animation phases:**
1. **Frames 0-30**: Newspaper slides in from bottom-right via `paperSlide()`. 3D rotation settles (rotateX: 8° → 0°, rotateY: -5° → 0°). `FoldShadow` visible at center crease.
2. **Frames 30-60**: Camera zooms into headline area. Scale interpolates 1.0 → 2.5. Non-headline elements fade to 0. Section label and headline become the focus.
3. **Frames 60-90**: Hold on headline + subhead. Clean, readable. `editorialReveal()` on subhead with slight delay.
4. **Frames 90-120**: `TornEdge` clip-path animates left-to-right across the frame. Paper slides out right. `exitTear()` drives the transition.

---

### Overlay 2: Magazine Dossier (`magazine-dossier`)

A classified document slides in with stamps, redacted lines, and progressive information reveal.

**Duration:** 5s (150 frames)

**Schema:**

```typescript
export const schema = z.object({
  title: z.string().default('OPERATION: TRADE CORRIDOR'),
  items: z.array(z.string()).default([
    'Bilateral agreement signed 2024',
    'Annual trade volume: $47 billion',
    'Three disputed territories remain',
  ]),
  classification: z.enum(['CONFIDENTIAL', 'TOP SECRET', 'DECLASSIFIED']).default('CONFIDENTIAL'),
});
```

**Components:**
- `DocumentSheet.tsx` — Aged paper sheet with `PaperTexture` (high age), `BurnEdge`, `FoldShadow`. Displays title in `SerifHeadline`, items as text rows. Sheet has subtle dog-ear fold in top-right corner (CSS triangle + gradient).
- `ClassificationStamp.tsx` — Red ink stamp (`MAGAZINE_COLORS.stamp`). Rotated ~-12°, slightly irregular opacity (SVG filter). Slams in with scale overshoot (1.3 → 1.0) and slight parent-div shake.
- `RedactionBar.tsx` — Black rectangle over each item's text. Animates: bar shrinks from full width to 0 (left-to-right wipe), revealing the text underneath with `InkBleed` filter on the revealed text.

**Animation phases:**
1. **Frames 0-25**: Document slides in via `paperSlide('right')`. Settles with slight rotation (2° → 0°).
2. **Frames 25-50**: `ClassificationStamp` slams down. Scale: 1.3 → 1.0 with fast ease. Container has 2-frame horizontal shake (±3px). Ink bleed spreads on the stamp text.
3. **Frames 50-120**: Each `RedactionBar` reveals its item text, staggered by `MAGAZINE_TIMING.staggerDelay` frames (~15f each). Reveal is a left-to-right wipe. Revealed text has `InkBleed` filter applied, fading in over 10 frames.
4. **Frames 120-150**: Document slides out via reverse `paperSlide()`. `BurnEdge` intensifies during exit.

---

### Overlay 3: Magazine Collage (`magazine-collage`)

Layered magazine clippings with torn edges at different depths, parallax motion, tape/pin decorations.

**Duration:** 5s (150 frames)

**Schema:**

```typescript
export const schema = z.object({
  fragments: z.array(z.object({
    text: z.string(),
    style: z.enum(['headline', 'pullquote', 'label', 'stat']).default('headline'),
  })).default([
    { text: 'The Migration Question', style: 'headline' },
    { text: '2.4 Million Displaced', style: 'stat' },
    { text: 'A crisis decades in the making', style: 'pullquote' },
  ]),
  topic: z.string().default('MIGRATION'),
});
```

**Components:**
- `PaperClipping.tsx` — A text fragment on a torn paper scrap. Uses `TornEdge` on all 4 sides, `PaperTexture` as background. Text style varies by `style` prop: `headline` uses `SerifHeadline`, `pullquote` uses italic Lora with quotation marks, `label` uses `SectionLabel`, `stat` uses large Playfair Display number with smaller context text below. Each clipping has slight random rotation (±5° via `random()` with seed from index) and drop shadow.
- `TapeMark.tsx` — Small semi-transparent tape strip across a corner. Rendered as a CSS rectangle with low opacity and slight rotation. Placed on ~half the clippings randomly.
- `PinMark.tsx` — Small circular pin/tack graphic (CSS circle + shadow). Placed on ~half the clippings that don't have tape.
- `TopicWord.tsx` — The central `topic` text, rendered very large (hero/display size) on the biggest paper scrap. Uses `SerifHeadline` with extra weight.

**Layout:** Clippings are pre-positioned in a scattered arrangement. Positions are calculated from fragment index using `random()` seeds for deterministic layout. Each clipping has a z-depth layer (0-2) which controls parallax speed and drop-shadow size.

**Animation phases:**
1. **Frames 0-40**: Clippings enter from different directions (randomized per index via `paperSlide()` with varied directions). Staggered by ~8 frames each. Foreground pieces enter last (closer = later).
2. **Frames 40-60**: `TopicWord` lands in center, largest piece. Scale: 1.2 → 1.0 with `magazineEasing`.
3. **Frames 60-120**: Slow continuous parallax drift. All pieces translate based on a slow sine wave, but magnitude varies by z-depth layer (foreground moves more). Creates depth.
4. **Frames 120-150**: Pieces scatter outward — reverse of entry, staggered. Foreground exits first.

---

### Overlay 4: Magazine Ink Map (`magazine-inkmap`)

A map draws itself as ink on aged paper with borders bleeding in, route tracing, and watercolor-style region fill.

**Duration:** 4s (120 frames)

**Schema:**

```typescript
export const schema = z.object({
  region: z.string().default('Middle East'),
  regionLat: z.number().default(29.0),
  regionLng: z.number().default(47.0),
  label: z.string().default('THE MIDDLE EAST'),
  routePoints: z.array(z.object({
    lat: z.number(),
    lng: z.number(),
  })).default([]),
  zoomLevel: z.number().min(2).max(8).default(4),
});
```

**Components:**
- `PaperMapBase.tsx` — `PaperTexture` background with faint cartography grid lines (thin rules at regular intervals, very low opacity, sepia-toned). This is the "paper" the map draws on.
- `InkMapTiles.tsx` — Fetches map tiles from a tile server (same `MapTileGrid` pattern as watercolor-map) but applies SVG filters: `feColorMatrix` for sepia desaturation, blended with the paper texture using CSS `mix-blend-mode: multiply`. Tiles appear as if printed on the paper. Uses `delayRender()`/`continueRender()` for async tile loading.
- `InkBorders.tsx` — Country/region borders rendered as SVG paths with `stroke-dasharray`/`stroke-dashoffset` animation, so borders "draw" themselves like an ink pen tracing them. Stroke has slight `InkBleed` filter for feathered edges.
- `InkRoute.tsx` — If `routePoints` provided, draws an animated route between points. Same stroke-dashoffset technique but with a thicker, more prominent stroke. Small dot markers at each point.
- `MapLabel.tsx` — The `label` text rendered with `SerifHeadline`, positioned below the map area. `Dateline`-style formatting.

**Animation phases:**
1. **Frames 0-20**: `PaperMapBase` fades in with `editorialReveal()`. Grid lines appear.
2. **Frames 20-60**: Map tiles load and fade in through the sepia/paper filter. `InkBorders` draw simultaneously — stroke-dashoffset animates from full length to 0.
3. **Frames 60-90**: `InkRoute` traces (if routePoints exist). `MapLabel` reveals with `editorialReveal()`. Region label appears.
4. **Frames 90-120**: Gentle `BurnEdge` vignette darkens edges. Whole overlay fades to ~70% opacity (partial transparency so speaker shows through), then fades out fully.

---

### Overlay 5: Magazine Typewriter (`magazine-typewriter`)

Typewriter types out key text with mechanical character-by-character appearance, ink impact, paper scrolling.

**Duration:** 5s (150 frames)

**Schema:**

```typescript
export const schema = z.object({
  lines: z.array(z.string()).default([
    'The agreement was unprecedented.',
    '47 nations signed in a single day.',
    'Nothing like it had happened before.',
  ]),
  emphasis: z.number().min(0).default(1),
});
```

**Components:**
- `TypewriterPaper.tsx` — Paper background that scrolls upward as lines are typed. `PaperTexture` (low age, more white than yellowed — fresh paper). Faint horizontal rule lines every ~40px like typewriter paper. The paper is taller than the viewport and translates upward as content grows.
- `TypewriterText.tsx` — Handles character-by-character text reveal. Uses a monospace-style approach but with Merriweather (serif) for the magazine feel. Each character has: slight random vertical offset (±1px via `random()` per char index) for mechanical imperfection, and an `InkBleed` filter. The currently-typing character has a brief opacity flash (1 → 0.8 → 1 over 2 frames) simulating ink impact. The `emphasis` line renders at ~1.3x size with Playfair Display instead of Merriweather.
- `TypewriterCursor.tsx` — A thin vertical bar that sits at the current typing position. Advances with each character. Has a subtle blink during pauses between lines.

**Typing schedule:** Total typing budget is ~85 frames (frames 15-100). Characters distributed across lines. Pause of ~8 frames between lines. Typing speed: each char takes 1-2 frames (faster for short words, slight random variation).

**Animation phases:**
1. **Frames 0-15**: Paper slides up into frame via `paperSlide('up')`. Cursor appears at top-left of first line.
2. **Frames 15-100**: Characters type out line by line. Paper scrolls up as lines complete (smooth `translateY` interpolation). Each char appears with ink impact effect. `emphasis` line types ~30% slower for dramatic weight.
3. **Frames 100-130**: Hold on completed text. The `emphasis` line gets a subtle underline that draws in (stroke-dashoffset animation, thin rule).
4. **Frames 130-150**: Paper scrolls up and out of frame. Opacity fades.

---

## Type System Changes

Add to `TemplateMeta` in `packages/templates/src/types.ts`:

```typescript
// Add 'overlay' to category union
category:
  | 'data-visualization'
  | 'text-typography'
  | 'comparison'
  | 'social-engagement'
  | 'geographic'
  | 'intro-outro'
  | 'timeline-process'
  | 'media'
  | 'marketing'
  | 'education'
  | 'social'
  | 'corporate'
  | 'entertainment'
  | 'overlay';

// Add optional type field
type?: 'scene' | 'overlay';
```

## getFiles() Pattern

Each overlay's `register.ts` returns its own files plus the shared magazine library. This means when the AI agent calls `getTemplateFiles('magazine-newspaper')`, it gets everything needed to render — overlay code and shared deps. No separate installation step.

```typescript
getFiles: async () => {
  const fs = await import('fs');
  const path = await import('path');
  const dir = path.dirname(new URL(import.meta.url).pathname);
  const magazineDir = path.join(dir, '../../magazine');

  const ownFileNames = [
    'meta.json', 'metadata.json', 'schema.ts', 'constants.ts',
    'index.tsx', 'register.ts',
    'components/NewspaperPage.tsx',
    'components/HeadlineZoom.tsx',
    'components/TearTransition.tsx',
  ];

  const sharedFileNames = [
    'constants.ts', 'textures.tsx', 'effects.tsx',
    'typography.tsx', 'animations.ts',
  ];

  const ownFiles = ownFileNames.map((f) => ({
    path: f,
    content: fs.readFileSync(path.join(dir, f), 'utf-8'),
  }));

  const sharedFiles = sharedFileNames.map((f) => ({
    path: `../../magazine/${f}`,
    content: fs.readFileSync(path.join(magazineDir, f), 'utf-8'),
  }));

  return [...ownFiles, ...sharedFiles];
}
```

## What This Does NOT Do

- No runtime theme switching — magazine aesthetic is baked into shared library
- No speaker detection or positioning — overlays occupy fixed screen regions, pipeline handles compositing
- No audio/SFX — typewriter clicks, paper rustling, stamp impacts are a separate concern
- No image sourcing for collage — fragments are text-only clippings, not photographs
- No real-time transcript sync — pipeline pre-generates props, overlays render to fixed timelines
- No new pipeline logic — AI agent picks overlays and fills props the same way it picks existing templates
