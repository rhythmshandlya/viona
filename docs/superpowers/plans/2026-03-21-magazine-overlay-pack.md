# Magazine Overlay Pack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build 5 cinematic magazine-themed overlay templates (newspaper, dossier, collage, ink map, typewriter) with a shared library of procedural paper textures, torn edges, ink effects, and editorial typography.

**Architecture:** Shared magazine library at `src/magazine/` provides procedural SVG textures, effects, typography, and animation utilities. Each overlay is an independent template at `src/templates/magazine-{name}/` importing from the shared library. All overlays have transparent backgrounds for compositing on speaker video.

**Tech Stack:** Remotion 4.0.422, React 19, Zod 3, TypeScript, SVG filters (`feTurbulence`, `feColorMatrix`, `feGaussianBlur`)

---

## File Structure

```
packages/templates/src/
├── magazine/                          # NEW — shared library
│   ├── constants.ts                   # Colors, fonts, timing
│   ├── textures.tsx                   # PaperTexture, NewsprintGrain, CoffeeStain
│   ├── effects.tsx                    # TornEdge, FoldShadow, BurnEdge, InkBleed
│   ├── typography.tsx                 # SerifHeadline, Byline, Dateline, SectionLabel
│   └── animations.ts                 # magazineEasing, editorialReveal, paperSlide, exitTear
├── templates/
│   ├── magazine-newspaper/            # NEW — overlay 1
│   │   ├── meta.json
│   │   ├── metadata.json
│   │   ├── schema.ts
│   │   ├── index.tsx
│   │   ├── register.ts
│   │   └── components/
│   │       ├── NewspaperPage.tsx
│   │       ├── HeadlineZoom.tsx
│   │       └── TearTransition.tsx
│   ├── magazine-dossier/              # NEW — overlay 2
│   │   ├── meta.json
│   │   ├── metadata.json
│   │   ├── schema.ts
│   │   ├── index.tsx
│   │   ├── register.ts
│   │   └── components/
│   │       ├── DocumentSheet.tsx
│   │       ├── ClassificationStamp.tsx
│   │       └── RedactionBar.tsx
│   ├── magazine-collage/              # NEW — overlay 3
│   │   ├── meta.json
│   │   ├── metadata.json
│   │   ├── schema.ts
│   │   ├── index.tsx
│   │   ├── register.ts
│   │   └── components/
│   │       ├── PaperClipping.tsx
│   │       ├── TapeMark.tsx
│   │       ├── PinMark.tsx
│   │       └── TopicWord.tsx
│   ├── magazine-inkmap/               # NEW — overlay 4
│   │   ├── meta.json
│   │   ├── metadata.json
│   │   ├── schema.ts
│   │   ├── index.tsx
│   │   ├── register.ts
│   │   └── components/
│   │       ├── PaperMapBase.tsx
│   │       ├── InkMapTiles.tsx
│   │       ├── InkBorders.tsx
│   │       ├── InkRoute.tsx
│   │       └── MapLabel.tsx
│   └── magazine-typewriter/           # NEW — overlay 5
│       ├── meta.json
│       ├── metadata.json
│       ├── schema.ts
│       ├── index.tsx
│       ├── register.ts
│       └── components/
│           ├── TypewriterPaper.tsx
│           ├── TypewriterText.tsx
│           └── TypewriterCursor.tsx
├── types.ts                           # MODIFY — add 'overlay' category, type field, themes field
├── registry.ts                        # MODIFY — update theme filter to check themes array
├── index.ts                           # MODIFY — register 5 new templates
└── fonts.ts                           # NO CHANGES — fonts already loaded
```

**Files modified:**
- `packages/templates/src/types.ts` — add `'overlay'` to category union, add `type` and `themes` fields
- `packages/templates/src/registry.ts` — update theme filter to check `meta.themes` array
- `packages/templates/src/index.ts` — add 5 register imports
- `packages/templates/themes/magazine.json` — update font recommendations to match loaded fonts

---

### Task 1: Type system and registry updates

**Files:**
- Modify: `packages/templates/src/types.ts`
- Modify: `packages/templates/src/registry.ts`
- Modify: `packages/templates/themes/magazine.json`

- [ ] **Step 1: Update TemplateMeta in types.ts**

In `packages/templates/src/types.ts`, add `'overlay'` to the category union, and add `type` and `themes` fields to the interface:

```typescript
export interface TemplateMeta {
  slug: string;
  name: string;
  description: string;
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
  tags: string[];
  stylePreset: string;
  aspectRatio: '16:9' | '9:16' | '1:1';
  sceneCount: number;
  estimatedDuration: string;
  thumbnail: string;
  type?: 'scene' | 'overlay';
  themes?: string[];
}
```

- [ ] **Step 2: Update theme filter in registry.ts**

In `packages/templates/src/registry.ts`, replace the existing theme filter block (line ~32-34):

```typescript
  if (filters.theme) {
    entries = entries.filter((e) =>
      e.meta.themes?.includes(filters.theme!) ||
      e.meta.tags.includes(`${filters.theme}-theme`)
    );
  }
```

This supports both the new `themes` array and the existing tag-based filter for backward compatibility.

- [ ] **Step 3: Update magazine.json font recommendations**

In `packages/templates/themes/magazine.json`, update the font recommendations to match fonts loaded in `src/fonts.ts`:

```json
{
  "slug": "magazine",
  "name": "Magazine",
  "description": "Editorial magazine style with serif typography, warm earth tones, and cinematic parallax motion",
  "colorPalette": {
    "primary": "#2D1B0E",
    "secondary": "#8B6914",
    "accent": "#C4A265",
    "background": "#F5F0E8",
    "text": "#1A1A1A"
  },
  "fontRecommendations": {
    "heading": "Playfair Display",
    "body": "Lora",
    "accent": "Merriweather"
  },
  "styleGuidance": "Magazine theme uses serif headlines with editorial grid layouts. Warm earth tones dominate with gold accents. Motion should be subtle and cinematic — parallax scrolling, gentle zoom, smooth reveals. Text should feel typeset, not animated. Prefer clean negative space over busy compositions. Photography-forward with minimal overlay text."
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd packages/templates && npx tsc --noEmit --pretty false
```

Expected: no new errors from these changes (existing errors may remain).

- [ ] **Step 5: Commit**

```bash
git add packages/templates/src/types.ts packages/templates/src/registry.ts packages/templates/themes/magazine.json
git commit -m "feat(templates): add overlay category, type/themes fields, update magazine fonts"
```

---

### Task 2: Shared magazine library — constants and animations

**Files:**
- Create: `packages/templates/src/magazine/constants.ts`
- Create: `packages/templates/src/magazine/animations.ts`

- [ ] **Step 1: Create constants.ts**

Create `packages/templates/src/magazine/constants.ts`:

```typescript
import { FONTS, FONT_SIZES } from '../fonts';

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
  revealDuration: 20,
  staggerDelay: 12,
  holdMinimum: 30,
} as const;

export { FONT_SIZES };
```

- [ ] **Step 2: Create animations.ts**

Create `packages/templates/src/magazine/animations.ts`:

```typescript
import { interpolate, Easing } from 'remotion';

export const magazineEasing = Easing.bezier(0.25, 0.1, 0.25, 1.0);

export function editorialReveal(frame: number, start: number, duration = 20) {
  const opacity = interpolate(frame, [start, start + duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: magazineEasing,
  });
  const translateY = interpolate(frame, [start, start + duration], [15, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: magazineEasing,
  });
  return { opacity, translateY };
}

export function paperSlide(
  frame: number,
  start: number,
  duration = 25,
  direction: 'left' | 'right' | 'up' | 'down' = 'up',
) {
  const progress = interpolate(frame, [start, start + duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: magazineEasing,
  });
  const rotation = interpolate(
    frame,
    [start, start + duration],
    [direction === 'left' ? -3 : 3, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: magazineEasing },
  );
  // Direction = where element enters FROM. Offsets sized for 1080x1920 viewport.
  const offsets = { left: [-1200, 0], right: [1200, 0], up: [0, 2000], down: [0, -2000] };
  const [startX, startY] = offsets[direction];
  const translateX = interpolate(progress, [0, 1], [startX, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const translateY = interpolate(progress, [0, 1], [startY, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  return { translateX, translateY, rotation, opacity: progress };
}

export function exitTear(frame: number, start: number, duration = 20) {
  const progress = interpolate(frame, [start, start + duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: magazineEasing,
  });
  return { progress, opacity: 1 - progress };
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/templates/src/magazine/
git commit -m "feat(magazine): add shared constants and animation utilities"
```

---

### Task 3: Shared magazine library — textures

**Files:**
- Create: `packages/templates/src/magazine/textures.tsx`

- [ ] **Step 1: Create textures.tsx**

Create `packages/templates/src/magazine/textures.tsx`:

```typescript
import React from 'react';
import { AbsoluteFill, random } from 'remotion';

// Deterministic filter IDs — no mutable counter (breaks Remotion SSR/multi-thread rendering).
// Each component receives a `seed` prop for unique but stable IDs.

/**
 * Aged parchment paper texture using SVG feTurbulence.
 * @param age 0-1: 0 = fresh white paper, 1 = heavily aged/yellowed
 * @param opacity overall opacity of the texture layer
 */
export function PaperTexture({ age = 0.5, opacity = 1, seed = 'paper' }: { age?: number; opacity?: number; seed?: string }) {
  const filterId = `magazine-${seed}`;
  // Interpolate base color from fresh cream to aged yellow-brown
  const r = Math.round(245 - age * 30);
  const g = Math.round(240 - age * 40);
  const b = Math.round(232 - age * 60);

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', opacity }}>
      {/* Base paper color */}
      <AbsoluteFill style={{ backgroundColor: `rgb(${r},${g},${b})` }} />
      {/* Fiber grain */}
      <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0 }}>
        <defs>
          <filter id={filterId}>
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.65"
              numOctaves={6}
              stitchTiles="stitch"
            />
            <feColorMatrix
              type="matrix"
              values={`0 0 0 0 ${0.9 - age * 0.15}
                       0 0 0 0 ${0.85 - age * 0.2}
                       0 0 0 0 ${0.78 - age * 0.25}
                       0 0 0 ${0.08 + age * 0.06} 0`}
            />
          </filter>
        </defs>
        <rect width="100%" height="100%" filter={`url(#${filterId})`} />
      </svg>
    </AbsoluteFill>
  );
}

/**
 * Fine newsprint dot-matrix grain overlay.
 * @param seed Deterministic seed for unique SVG filter ID (required for SSR)
 */
export function NewsprintGrain({ opacity = 0.04, seed = 'newsprint' }: { opacity?: number; seed?: string }) {
  const filterId = `magazine-${seed}`;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', opacity }}>
      <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0 }}>
        <defs>
          <filter id={filterId}>
            <feTurbulence type="turbulence" baseFrequency="1.2" numOctaves={2} />
            <feColorMatrix type="saturate" values="0" />
          </filter>
        </defs>
        <rect width="100%" height="100%" filter={`url(#${filterId})`} />
      </svg>
    </AbsoluteFill>
  );
}

/**
 * Decorative coffee stain watermark.
 */
export function CoffeeStain({
  x, y, size, opacity = 0.08, seed = 0,
}: {
  x: number;
  y: number;
  size: number;
  opacity?: number;
  seed?: number;
}) {
  // Use Remotion's deterministic random for slight position jitter
  const jitterX = random(`coffee-x-${seed}`) * 10 - 5;
  const jitterY = random(`coffee-y-${seed}`) * 10 - 5;

  return (
    <div
      style={{
        position: 'absolute',
        left: x + jitterX - size / 2,
        top: y + jitterY - size / 2,
        width: size,
        height: size,
        borderRadius: '50%',
        background: `radial-gradient(ellipse at 40% 45%, rgba(139,105,20,${opacity}) 0%, rgba(139,105,20,${opacity * 0.4}) 50%, transparent 70%)`,
        pointerEvents: 'none',
      }}
    />
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/templates/src/magazine/textures.tsx
git commit -m "feat(magazine): add procedural paper textures (PaperTexture, NewsprintGrain, CoffeeStain)"
```

---

### Task 4: Shared magazine library — effects

**Files:**
- Create: `packages/templates/src/magazine/effects.tsx`

- [ ] **Step 1: Create effects.tsx**

Create `packages/templates/src/magazine/effects.tsx`:

```typescript
import React from 'react';
import { AbsoluteFill, random } from 'remotion';

// Deterministic filter IDs — no mutable counter (breaks Remotion SSR/multi-thread rendering).
// Each component receives a `seed` prop for unique but stable IDs.

// ── TornEdge ────────────────────────────────────────────────────────────────

type Edge = 'top' | 'bottom' | 'left' | 'right';

/**
 * Generates a CSS polygon clip-path with torn (jagged) edges.
 * Uses Remotion's deterministic `random()` for reproducible results.
 *
 * @param edges Which edges to tear (untorn edges are straight)
 * @param roughness 0-1, controls max offset of torn points (in px: roughness * 15)
 * @param seed Deterministic seed for random()
 * @param width Container width in px (explicit — no DOM measurement)
 * @param height Container height in px (explicit — no DOM measurement)
 */
export function generateTornClipPath(
  edges: Edge[],
  roughness: number,
  seed: number,
  width: number,
  height: number,
): string {
  const pointsPerEdge = 20;
  const maxOffset = roughness * 15;
  const tornSet = new Set(edges);
  const points: string[] = [];

  // Top edge (left to right)
  for (let i = 0; i <= pointsPerEdge; i++) {
    const x = (i / pointsPerEdge) * width;
    const y = tornSet.has('top')
      ? random(`torn-top-${seed}-${i}`) * maxOffset
      : 0;
    points.push(`${x},${y}`);
  }
  // Right edge (top to bottom)
  for (let i = 1; i <= pointsPerEdge; i++) {
    const y = (i / pointsPerEdge) * height;
    const x = tornSet.has('right')
      ? width - random(`torn-right-${seed}-${i}`) * maxOffset
      : width;
    points.push(`${x},${y}`);
  }
  // Bottom edge (right to left)
  for (let i = pointsPerEdge; i >= 0; i--) {
    const x = (i / pointsPerEdge) * width;
    const y = tornSet.has('bottom')
      ? height - random(`torn-bottom-${seed}-${i}`) * maxOffset
      : height;
    points.push(`${x},${y}`);
  }
  // Left edge (bottom to top)
  for (let i = pointsPerEdge - 1; i >= 1; i--) {
    const y = (i / pointsPerEdge) * height;
    const x = tornSet.has('left')
      ? random(`torn-left-${seed}-${i}`) * maxOffset
      : 0;
    points.push(`${x},${y}`);
  }

  return `polygon(${points.map((p) => {
    const [x, y] = p.split(',');
    return `${(parseFloat(x) / width) * 100}% ${(parseFloat(y) / height) * 100}%`;
  }).join(', ')})`;
}

/**
 * Wraps children in a container with a torn-paper clip-path.
 * Uses explicit width/height props — no useRef/useEffect DOM measurement (breaks SSR).
 * Default 1080x1920 matches 9:16 overlay viewport.
 */
export function TornEdge({
  edges = ['top', 'bottom'],
  roughness = 0.6,
  seed = 42,
  width = 1080,
  height = 1920,
  children,
}: {
  edges?: Edge[];
  roughness?: number;
  seed?: number;
  width?: number;
  height?: number;
  children: React.ReactNode;
}) {
  const clipPath = React.useMemo(
    () => generateTornClipPath(edges, roughness, seed, width, height),
    [edges, roughness, seed, width, height],
  );

  return (
    <div style={{ clipPath, width: '100%', height: '100%' }}>
      {children}
    </div>
  );
}

// ── FoldShadow ──────────────────────────────────────────────────────────────

/**
 * CSS gradient simulating a paper fold crease shadow.
 */
export function FoldShadow({
  angle = 90,
  position = 0.5,
  depth = 0.3,
}: {
  angle?: number;
  position?: number;
  depth?: number;
}) {
  return (
    <AbsoluteFill
      style={{
        pointerEvents: 'none',
        background: `linear-gradient(${angle}deg,
          transparent ${(position - 0.02) * 100}%,
          rgba(0,0,0,${depth}) ${position * 100}%,
          transparent ${(position + 0.02) * 100}%
        )`,
      }}
    />
  );
}

// ── BurnEdge ────────────────────────────────────────────────────────────────

/**
 * Dark vignette with irregular edge for an aged/burned paper look.
 * @param seed Deterministic seed for unique SVG filter ID (required for SSR)
 */
export function BurnEdge({
  intensity = 0.4,
  opacity = 1,
  seed = 'burn',
}: {
  intensity?: number;
  opacity?: number;
  seed?: string;
}) {
  const filterId = `magazine-${seed}`;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', opacity }}>
      <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0 }}>
        <defs>
          <filter id={filterId}>
            <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves={3} />
            <feColorMatrix type="matrix"
              values={`0 0 0 0 0
                       0 0 0 0 0
                       0 0 0 0 0
                       0 0 0 ${intensity} 0`}
            />
            <feComposite in2="SourceGraphic" operator="in" />
          </filter>
          <radialGradient id={`${filterId}-grad`} cx="50%" cy="50%" r="50%">
            <stop offset="60%" stopColor="transparent" />
            <stop offset="100%" stopColor={`rgba(30,15,5,${intensity})`} />
          </radialGradient>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${filterId}-grad)`} />
      </svg>
    </AbsoluteFill>
  );
}

// ── InkBleed ────────────────────────────────────────────────────────────────

/**
 * SVG filter definition for ink absorption/bleed effect on text.
 * Renders an invisible <svg> with the filter. Apply via style={{ filter: `url(#${id})` }}.
 * Returns the filter ID string.
 */
export function InkBleedFilter({ id }: { id: string }) {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }}>
      <defs>
        <filter id={id}>
          <feGaussianBlur in="SourceGraphic" stdDeviation="0.5" />
          <feColorMatrix
            type="matrix"
            values="1 0 0 0 0
                    0 1 0 0 0
                    0 0 1 0 0
                    0 0 0 1.8 -0.3"
          />
        </filter>
      </defs>
    </svg>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/templates/src/magazine/effects.tsx
git commit -m "feat(magazine): add TornEdge, FoldShadow, BurnEdge, InkBleed effects"
```

---

### Task 5: Shared magazine library — typography

**Files:**
- Create: `packages/templates/src/magazine/typography.tsx`

- [ ] **Step 1: Create typography.tsx**

Create `packages/templates/src/magazine/typography.tsx`:

```typescript
import React from 'react';
import { MAGAZINE_COLORS, MAGAZINE_FONTS, FONT_SIZES } from './constants';

/**
 * Large serif headline with editorial styling.
 */
export function SerifHeadline({
  text,
  size = FONT_SIZES.hero,
  showRule = false,
  color = MAGAZINE_COLORS.text,
  maxWidth,
}: {
  text: string;
  size?: number;
  showRule?: boolean;
  color?: string;
  maxWidth?: number;
}) {
  const rule = showRule ? (
    <div style={{
      width: '100%', height: 2,
      background: MAGAZINE_COLORS.accent,
      marginBottom: 12,
    }} />
  ) : null;

  return (
    <div style={{ maxWidth }}>
      {rule}
      <div
        style={{
          fontFamily: MAGAZINE_FONTS.headline,
          fontSize: size,
          fontWeight: 700,
          color,
          lineHeight: 1.1,
          letterSpacing: '-0.02em',
        }}
      >
        {text}
      </div>
      {showRule && (
        <div style={{
          width: '100%', height: 1,
          background: MAGAZINE_COLORS.accent,
          marginTop: 12,
          opacity: 0.5,
        }} />
      )}
    </div>
  );
}

/**
 * Byline — "By SOURCE" in small caps.
 */
export function Byline({ source, color = MAGAZINE_COLORS.secondary }: { source: string; color?: string }) {
  return (
    <div
      style={{
        fontFamily: MAGAZINE_FONTS.body,
        fontSize: FONT_SIZES.small,
        fontWeight: 400,
        color,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
      }}
    >
      By {source}
    </div>
  );
}

/**
 * Dateline — "MARCH 21, 2026 • WASHINGTON"
 */
export function Dateline({
  date,
  location,
  color = MAGAZINE_COLORS.secondary,
}: {
  date: string;
  location?: string;
  color?: string;
}) {
  return (
    <div
      style={{
        fontFamily: MAGAZINE_FONTS.body,
        fontSize: FONT_SIZES.caption,
        fontWeight: 400,
        color,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        opacity: 0.7,
      }}
    >
      {date}{location ? ` \u2022 ${location}` : ''}
    </div>
  );
}

/**
 * Section label with horizontal rules: ── ANALYSIS ──
 */
export function SectionLabel({
  label,
  color = MAGAZINE_COLORS.accent,
}: {
  label: string;
  color?: string;
}) {
  const ruleStyle: React.CSSProperties = {
    flex: 1,
    height: 1,
    background: color,
    opacity: 0.5,
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={ruleStyle} />
      <span
        style={{
          fontFamily: MAGAZINE_FONTS.accent,
          fontSize: FONT_SIZES.small,
          fontWeight: 600,
          color,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
      <div style={ruleStyle} />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/templates/src/magazine/typography.tsx
git commit -m "feat(magazine): add editorial typography components"
```

---

### Task 6: Magazine Newspaper overlay

**Files:**
- Create: `packages/templates/src/templates/magazine-newspaper/meta.json`
- Create: `packages/templates/src/templates/magazine-newspaper/metadata.json`
- Create: `packages/templates/src/templates/magazine-newspaper/schema.ts`
- Create: `packages/templates/src/templates/magazine-newspaper/index.tsx`
- Create: `packages/templates/src/templates/magazine-newspaper/register.ts`
- Create: `packages/templates/src/templates/magazine-newspaper/components/NewspaperPage.tsx`
- Create: `packages/templates/src/templates/magazine-newspaper/components/HeadlineZoom.tsx`
- Create: `packages/templates/src/templates/magazine-newspaper/components/TearTransition.tsx`
- Modify: `packages/templates/src/index.ts` — add register import

- [ ] **Step 1: Create meta.json and metadata.json**

`packages/templates/src/templates/magazine-newspaper/meta.json`:
```json
{
  "slug": "magazine-newspaper",
  "name": "Magazine Newspaper",
  "description": "Newspaper front page unfolds with 3D perspective, zooms into headline, then tears away",
  "category": "overlay",
  "tags": ["magazine-theme", "overlay", "newspaper", "headline", "editorial", "paper", "serif"],
  "stylePreset": "elegantEditorial",
  "aspectRatio": "9:16",
  "sceneCount": 1,
  "estimatedDuration": "4s",
  "thumbnail": "thumbnail.png",
  "type": "overlay",
  "themes": ["magazine"]
}
```

`packages/templates/src/templates/magazine-newspaper/metadata.json`:
```json
{
  "compositionId": "magazine-newspaper",
  "durationInFrames": 120,
  "fps": 30,
  "width": 1080,
  "height": 1920
}
```

- [ ] **Step 2: Create schema.ts**

```typescript
import { z } from 'zod';

export const schema = z.object({
  headline: z.string().default('Breaking Development in Global Trade'),
  subhead: z.string().default('New agreements reshape international commerce'),
  publicationDate: z.string().default('March 21, 2026'),
  section: z.string().default('WORLD AFFAIRS'),
});

export type MagazineNewspaperProps = z.infer<typeof schema>;
export const defaultProps: MagazineNewspaperProps = schema.parse({});
```

- [ ] **Step 3: Create component files**

Create `components/NewspaperPage.tsx` — the full newspaper front page layout with paper texture, masthead, section label, headline, subhead, dateline, column rules, and blurred body text. Uses CSS `perspective` + `transform: rotateX/rotateY` for 3D paper feel. Imports `PaperTexture`, `NewsprintGrain`, `FoldShadow`, `SerifHeadline`, `SectionLabel`, `Dateline` from the shared magazine library.

Create `components/HeadlineZoom.tsx` — handles camera push animation: takes `frame`, `zoomStart`, `zoomEnd` props. Interpolates scale from 1.0 → 2.5 and fades non-headline content. Returns transform/opacity values for the parent to apply.

Create `components/TearTransition.tsx` — animated torn-edge clip-path that sweeps across frame. Uses `generateTornClipPath` from effects, animating the clip region from full-coverage to zero by shifting the polygon right-to-left. Combined with paper sliding out and opacity fading via `exitTear()`.

- [ ] **Step 4: Create index.tsx**

The main Remotion component. Structure:
```typescript
import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import type { MagazineNewspaperProps } from './schema';
import { paperSlide, editorialReveal, exitTear } from '../../magazine/animations';
import { NewspaperPage } from './components/NewspaperPage';

const MagazineNewspaper: React.FC<MagazineNewspaperProps> = (props) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  // Phase 1: Slide in (0-30)
  const slide = paperSlide(frame, 0, 30, 'up');
  const rotateX = interpolate(frame, [0, 30], [8, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const rotateY = interpolate(frame, [0, 30], [-5, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Phase 2: Zoom into headline (30-60)
  const zoomScale = interpolate(frame, [30, 60], [1, 2.5], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const surroundFade = interpolate(frame, [30, 55], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Phase 3: Hold (60-90) — subhead reveal
  const subheadReveal = editorialReveal(frame, 65, 15);

  // Phase 4: Tear exit (90-120)
  const tear = exitTear(frame, 90, 30);

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <div style={{
        width: '100%', height: '100%',
        perspective: 1200,
        opacity: frame < 90 ? slide.opacity : tear.opacity,
        transform: `
          translateX(${slide.translateX}px) translateY(${slide.translateY}px)
          rotateX(${rotateX}deg) rotateY(${rotateY}deg)
          scale(${frame >= 30 ? zoomScale : 1})
        `,
        transformOrigin: '50% 30%',
      }}>
        <NewspaperPage
          headline={props.headline}
          subhead={props.subhead}
          publicationDate={props.publicationDate}
          section={props.section}
          surroundOpacity={surroundFade}
          subheadOpacity={subheadReveal.opacity}
          subheadTranslateY={subheadReveal.translateY}
        />
      </div>
    </AbsoluteFill>
  );
};

export default MagazineNewspaper;
```

The above is the structural pattern — the implementer should build the full version with all 4 animation phases wired together, including the tear transition clip-path in phase 4.

- [ ] **Step 5: Create register.ts**

```typescript
import { registerTemplate } from '../../registry';
import type { TemplateMeta, CompositionMeta } from '../../types';
import { schema, defaultProps } from './schema';
import meta from './meta.json';
import compositionMeta from './metadata.json';

registerTemplate({
  meta: meta as TemplateMeta,
  compositionMeta: compositionMeta as CompositionMeta,
  schema,
  defaultProps,
  getComponent: async () => import('./index'),
  getFiles: async () => {
    const fs = await import('fs');
    const path = await import('path');
    const dir = path.dirname(new URL(import.meta.url).pathname);
    const magazineDir = path.join(dir, '../../magazine');

    const ownFileNames = [
      'meta.json', 'metadata.json', 'schema.ts', 'index.tsx', 'register.ts',
      'components/NewspaperPage.tsx',
      'components/HeadlineZoom.tsx',
      'components/TearTransition.tsx',
    ];

    const sharedFileNames = [
      'constants.ts', 'textures.tsx', 'effects.tsx', 'typography.tsx', 'animations.ts',
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
  },
});
```

- [ ] **Step 6: Add register import to index.ts**

In `packages/templates/src/index.ts`, add at the bottom of the register imports section:

```typescript
import './templates/magazine-newspaper/register';
```

- [ ] **Step 7: Test in playground**

```bash
pnpm --filter @viona/templates playground
```

Verify: magazine-newspaper appears in the gallery, clicking it shows the template detail with player rendering the newspaper animation on a transparent background.

- [ ] **Step 8: Commit**

```bash
git add packages/templates/src/templates/magazine-newspaper/ packages/templates/src/index.ts
git commit -m "feat(templates): add magazine-newspaper overlay template"
```

---

### Task 7: Magazine Dossier overlay

**Files:**
- Create: `packages/templates/src/templates/magazine-dossier/meta.json`
- Create: `packages/templates/src/templates/magazine-dossier/metadata.json`
- Create: `packages/templates/src/templates/magazine-dossier/schema.ts`
- Create: `packages/templates/src/templates/magazine-dossier/index.tsx`
- Create: `packages/templates/src/templates/magazine-dossier/register.ts`
- Create: `packages/templates/src/templates/magazine-dossier/components/DocumentSheet.tsx`
- Create: `packages/templates/src/templates/magazine-dossier/components/ClassificationStamp.tsx`
- Create: `packages/templates/src/templates/magazine-dossier/components/RedactionBar.tsx`
- Modify: `packages/templates/src/index.ts`

Follow the same pattern as Task 6. Key specifics:

- [ ] **Step 1: Create meta.json, metadata.json, schema.ts**

`meta.json`: slug `magazine-dossier`, category `overlay`, type `overlay`, themes `["magazine"]`, tags include `magazine-theme`, estimated duration `5s`.

`metadata.json`: compositionId `magazine-dossier`, durationInFrames `150`, fps 30, 1080x1920.

`schema.ts`:
```typescript
import { z } from 'zod';

export const schema = z.object({
  title: z.string().default('OPERATION: TRADE CORRIDOR'),
  items: z.array(z.string()).default([
    'Bilateral agreement signed 2024',
    'Annual trade volume: $47 billion',
    'Three disputed territories remain',
  ]),
  classification: z.enum(['CONFIDENTIAL', 'TOP SECRET', 'DECLASSIFIED']).default('CONFIDENTIAL'),
});

export type MagazineDossierProps = z.infer<typeof schema>;
export const defaultProps: MagazineDossierProps = schema.parse({});
```

- [ ] **Step 2: Create components**

`DocumentSheet.tsx` — Aged paper with `PaperTexture(age: 0.8)`, `BurnEdge`, `FoldShadow`. Title via `SerifHeadline`. Items as text rows. Dog-ear fold in top-right (CSS triangle via border trick + gradient shadow).

`ClassificationStamp.tsx` — Red stamp text (`MAGAZINE_COLORS.stamp`), rotated -12°, `InkBleedFilter` applied. Entrance: scale 1.3→1.0 with overshoot easing, parent container shakes ±3px for 2 frames.

`RedactionBar.tsx` — Black rectangle over text. Animates via `clipPath: inset(0 ${(1-progress)*100}% 0 0)` revealing text left-to-right. Revealed text has `InkBleedFilter`.

- [ ] **Step 3: Create index.tsx**

Animation phases per spec:
1. Frames 0-25: `paperSlide('right')`, rotation 2°→0°
2. Frames 25-50: Stamp slams down (scale overshoot + shake)
3. Frames 50-120: Redaction bars reveal staggered by 15 frames each
4. Frames 120-150: Reverse slide out + `BurnEdge` intensifies

- [ ] **Step 4: Create register.ts, add import to index.ts**

Same pattern as Task 6. `getFiles()` includes own files + shared magazine files.

Add to `packages/templates/src/index.ts`:
```typescript
import './templates/magazine-dossier/register';
```

- [ ] **Step 5: Test in playground, commit**

```bash
git add packages/templates/src/templates/magazine-dossier/ packages/templates/src/index.ts
git commit -m "feat(templates): add magazine-dossier overlay template"
```

---

### Task 8: Magazine Collage overlay

**Files:**
- Create: `packages/templates/src/templates/magazine-collage/meta.json`
- Create: `packages/templates/src/templates/magazine-collage/metadata.json`
- Create: `packages/templates/src/templates/magazine-collage/schema.ts`
- Create: `packages/templates/src/templates/magazine-collage/index.tsx`
- Create: `packages/templates/src/templates/magazine-collage/register.ts`
- Create: `packages/templates/src/templates/magazine-collage/components/PaperClipping.tsx`
- Create: `packages/templates/src/templates/magazine-collage/components/TapeMark.tsx`
- Create: `packages/templates/src/templates/magazine-collage/components/PinMark.tsx`
- Create: `packages/templates/src/templates/magazine-collage/components/TopicWord.tsx`
- Modify: `packages/templates/src/index.ts`

- [ ] **Step 1: Create meta.json, metadata.json, schema.ts**

`meta.json`: slug `magazine-collage`, duration `5s`.

`metadata.json`: durationInFrames `150`.

`schema.ts`:
```typescript
import { z } from 'zod';

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

export type MagazineCollageProps = z.infer<typeof schema>;
export const defaultProps: MagazineCollageProps = schema.parse({});
```

- [ ] **Step 2: Create components**

`PaperClipping.tsx` — Fragment on torn paper scrap. `TornEdge` all 4 sides, `PaperTexture` bg. Text style depends on `style` prop: `headline` → `SerifHeadline`, `pullquote` → italic Lora with quotation marks, `label` → `SectionLabel`, `stat` → large number in Playfair Display. Random rotation ±5° via `random()` with index-based seed. Drop shadow `0 4px 20px rgba(0,0,0,0.4)`.

`TapeMark.tsx` — Semi-transparent rectangle (cream/yellow, 60% opacity), slight rotation, positioned at a corner. Pure CSS.

`PinMark.tsx` — Small circle (10px) with subtle shadow. Red or brass color. Pure CSS.

`TopicWord.tsx` — The central topic text on the largest paper scrap. Uses `SerifHeadline` at `FONT_SIZES.hero * 1.5`. Wrapped in `TornEdge` with `PaperTexture`.

**Layout algorithm:** Divide the 1080x1920 canvas into a 2-column, 3-row grid (540x640 cells). Place fragments in cells based on index (deterministic). Add random offset within cell using `random()`. The topic word always goes in the center (spanning middle cells). Each fragment gets a z-depth (0, 1, or 2 based on index % 3) for parallax.

- [ ] **Step 3: Create index.tsx**

Animation phases:
1. Frames 0-40: Clippings enter via `paperSlide()` with stagger 8f each, varied directions per index
2. Frames 40-60: TopicWord enters center, scale 1.2→1.0
3. Frames 60-120: Parallax drift — translateX/Y oscillates based on `Math.sin(frame * 0.02)` * depth multiplier
4. Frames 120-150: Reverse scatter exit

- [ ] **Step 4: Create register.ts, add import to index.ts**

Add to `packages/templates/src/index.ts`:
```typescript
import './templates/magazine-collage/register';
```

- [ ] **Step 5: Test in playground, commit**

```bash
git add packages/templates/src/templates/magazine-collage/ packages/templates/src/index.ts
git commit -m "feat(templates): add magazine-collage overlay template"
```

---

### Task 9: Magazine Ink Map overlay

**Files:**
- Create: `packages/templates/src/templates/magazine-inkmap/meta.json`
- Create: `packages/templates/src/templates/magazine-inkmap/metadata.json`
- Create: `packages/templates/src/templates/magazine-inkmap/schema.ts`
- Create: `packages/templates/src/templates/magazine-inkmap/index.tsx`
- Create: `packages/templates/src/templates/magazine-inkmap/register.ts`
- Create: `packages/templates/src/templates/magazine-inkmap/components/PaperMapBase.tsx`
- Create: `packages/templates/src/templates/magazine-inkmap/components/InkMapTiles.tsx`
- Create: `packages/templates/src/templates/magazine-inkmap/components/InkBorders.tsx`
- Create: `packages/templates/src/templates/magazine-inkmap/components/InkRoute.tsx`
- Create: `packages/templates/src/templates/magazine-inkmap/components/MapLabel.tsx`
- Modify: `packages/templates/src/index.ts`

- [ ] **Step 1: Create meta.json, metadata.json, schema.ts**

`meta.json`: slug `magazine-inkmap`, duration `4s`, tags include `magazine-theme`, `map`, `geographic`.

`metadata.json`: durationInFrames `120`.

`schema.ts`:
```typescript
import { z } from 'zod';

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

export type MagazineInkmapProps = z.infer<typeof schema>;
export const defaultProps: MagazineInkmapProps = schema.parse({});
```

- [ ] **Step 2: Create components**

`PaperMapBase.tsx` — `PaperTexture(age: 0.6)` with faint grid lines (1px sepia rules at 80px intervals, 0.1 opacity). Cartography paper feel.

`InkMapTiles.tsx` — **Standalone** tile fetcher (does NOT import from `lib/map`). Constructs tile URLs: `https://tile.openstreetmap.org/{z}/{x}/{y}.png`. Uses tile math functions implemented locally (copy the `lngToTileX`, `latToTileY`, `lngToPixelX`, `latToPixelY` functions — ~30 lines, simpler than importing all of lib/map). Uses Remotion's `<Img maxRetries={3}>` with `delayRender()`/`continueRender()`. Applies SVG filter: `<feColorMatrix>` for sepia desaturation. Rendered with CSS `mix-blend-mode: multiply` against paper texture.

`InkBorders.tsx` — SVG path that draws itself via `stroke-dasharray`/`stroke-dashoffset`. Uses a rectangular border around the region (computed from lat/lng + zoom) as a simplified region outline. Stroke: 2px, `MAGAZINE_COLORS.inkBlack`, `InkBleedFilter` applied. The `stroke-dashoffset` interpolates from path length to 0 over the animation window.

`InkRoute.tsx` — If `routePoints` has 2+ points, draws an animated route. Same `stroke-dashoffset` technique, thicker stroke (3px), `MAGAZINE_COLORS.secondary` color. Small 8px dot markers at each point that fade in when the route reaches them.

`MapLabel.tsx` — `SerifHeadline` with `showRule: true`, positioned at bottom of the composition. Uses `editorialReveal()` for entrance.

- [ ] **Step 3: Create index.tsx**

Animation phases:
1. Frames 0-20: PaperMapBase `editorialReveal()`, grid lines appear
2. Frames 20-60: Tiles fade in (opacity interpolate), InkBorders draw (stroke-dashoffset)
3. Frames 60-90: InkRoute traces, MapLabel reveals
4. Frames 90-120: BurnEdge vignette, fade out

- [ ] **Step 4: Create register.ts, add import to index.ts**

Add to `packages/templates/src/index.ts`:
```typescript
import './templates/magazine-inkmap/register';
```

- [ ] **Step 5: Test in playground, commit**

```bash
git add packages/templates/src/templates/magazine-inkmap/ packages/templates/src/index.ts
git commit -m "feat(templates): add magazine-inkmap overlay template"
```

---

### Task 10: Magazine Typewriter overlay

**Files:**
- Create: `packages/templates/src/templates/magazine-typewriter/meta.json`
- Create: `packages/templates/src/templates/magazine-typewriter/metadata.json`
- Create: `packages/templates/src/templates/magazine-typewriter/schema.ts`
- Create: `packages/templates/src/templates/magazine-typewriter/index.tsx`
- Create: `packages/templates/src/templates/magazine-typewriter/register.ts`
- Create: `packages/templates/src/templates/magazine-typewriter/components/TypewriterPaper.tsx`
- Create: `packages/templates/src/templates/magazine-typewriter/components/TypewriterText.tsx`
- Create: `packages/templates/src/templates/magazine-typewriter/components/TypewriterCursor.tsx`
- Modify: `packages/templates/src/index.ts`

- [ ] **Step 1: Create meta.json, metadata.json, schema.ts**

`meta.json`: slug `magazine-typewriter`, duration `5s`.

`metadata.json`: durationInFrames `150`.

`schema.ts`:
```typescript
import { z } from 'zod';

export const schema = z.object({
  lines: z.array(z.string()).default([
    'The agreement was unprecedented.',
    '47 nations signed in a single day.',
    'Nothing like it had happened before.',
  ]),
  emphasis: z.number().min(0).default(1),
});

export type MagazineTypewriterProps = z.infer<typeof schema>;
export const defaultProps: MagazineTypewriterProps = schema.parse({});
```

- [ ] **Step 2: Create components**

`TypewriterPaper.tsx` — Paper that scrolls upward. `PaperTexture(age: 0.1)` (fresh white). Horizontal rule lines every 60px (1px, `MAGAZINE_COLORS.accent` at 0.1 opacity). The paper div is taller than viewport (enough for all lines) and gets `translateY` from parent.

`TypewriterText.tsx` — Character-by-character reveal. **Typing schedule algorithm:**
1. Total char count = sum of all line lengths
2. Typing window = 85 frames (frame 15-100)
3. Pause between lines = 8 frames
4. Available typing frames = 85 - (pause * (lines.length - 1))
5. Frames per char = available / total chars, emphasis line gets 1.3x multiplier
6. For each `frame`, compute which char index is visible. Everything before that index is rendered, everything after is hidden.

Each rendered char has `random()` vertical offset ±1px (seed: char index). Emphasis line uses `MAGAZINE_FONTS.headline` at 1.3x size, others use `MAGAZINE_FONTS.accent`.

`TypewriterCursor.tsx` — Thin vertical bar (2px wide, `MAGAZINE_COLORS.inkBlack`). Position tracks the next-to-type character. Blinks (opacity toggles 1↔0.3 every 15 frames) during line pauses.

- [ ] **Step 3: Create index.tsx**

Animation phases:
1. Frames 0-15: `paperSlide('up')`, cursor appears
2. Frames 15-100: Typing, paper scrolls up as lines complete
3. Frames 100-130: Hold, emphasis underline draws in
4. Frames 130-150: Paper scrolls up and out, opacity fades

- [ ] **Step 4: Create register.ts, add import to index.ts**

Add to `packages/templates/src/index.ts`:
```typescript
import './templates/magazine-typewriter/register';
```

- [ ] **Step 5: Test in playground, commit**

```bash
git add packages/templates/src/templates/magazine-typewriter/ packages/templates/src/index.ts
git commit -m "feat(templates): add magazine-typewriter overlay template"
```

---

### Task 11: Final integration and playground verification

**Files:**
- Verify: `packages/templates/src/index.ts` has all 5 register imports
- Verify: `packages/templates/themes/magazine.json` updated

- [ ] **Step 1: Verify all 5 overlays appear in playground**

```bash
pnpm --filter @viona/templates playground
```

Check:
1. Gallery shows all 5 magazine overlays (filter by "overlay" category or "magazine" theme)
2. Each overlay renders on transparent background in the player
3. Theme Browser shows "Magazine" theme with all 5 overlays grouped together
4. Clicking a theme badge on any overlay navigates to the Magazine theme in Theme Browser

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd packages/templates && npx tsc --noEmit --pretty false
```

- [ ] **Step 3: Final commit if any fixes needed**

```bash
git add -A packages/templates/
git commit -m "fix(templates): final magazine overlay integration fixes"
```
