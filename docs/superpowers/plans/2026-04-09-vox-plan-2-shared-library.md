# Plan 2: Vox Shared Library

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Vox shared library (`packages/templates/src/vox/`) — the React components, animation helpers, effects, textures, typography, and decorations that all vox templates import. This is the visual DNA encoded as code.

**Architecture:** Mirrors the magazine shared library pattern (`packages/templates/src/magazine/`). Six files: constants.ts, animations.ts, effects.tsx, textures.tsx, typography.tsx, decorations.tsx. All templates will import from `../../vox/` (rewritten to `../../theme/vox/` on fork).

**Tech Stack:** React, Remotion (useCurrentFrame, useVideoConfig, interpolate, spring, Easing), Zod, SVG filters (feTurbulence, feDisplacementMap)

**Spec reference:** `docs/superpowers/specs/2026-04-09-vox-theme-research.md` Part V

**Prerequisite:** Plan 1 (pipeline DNA system) must be completed first.

---

### Task 1: Create `constants.ts`

**Files:**
- Create: `packages/templates/src/vox/constants.ts`

- [ ] **Step 1: Write constants file**

Model after `packages/templates/src/magazine/constants.ts`. Export VOX_COLORS, VOX_FONTS, VOX_SIZES, VOX_TIMING, VOX_SPRING, VOX_EASING, VOX_GRAIN, VOX_ROUGH, and the `sf()` stutter helper.

```typescript
import { Easing } from 'remotion';

// === COLORS ===
export const VOX_COLORS = {
  highlight: '#FFEB00',
  teal: '#6D98A8',
  offWhite: '#F1F3F2',
  charcoal: '#4C4E4D',
  darkGray: '#444745',
  deepPurple: '#35313F',
  lightGray: '#BBBBBB',
  medGray: '#AAAAAA',
  white: '#FFFFFF',
  warmBlack: '#1A1A2E',
  mutedRed: '#C84B4B',
  mutedGreen: '#5B8A72',
} as const;

// === FONTS ===
export const VOX_FONTS = {
  headline: 'Playfair Display',
  body: 'Inter',
  mono: 'JetBrains Mono',
} as const;

// === FONT SIZES (at 1080px base) ===
export const VOX_SIZES = {
  hero: 72,
  h1: 56,
  h2: 44,
  h3: 36,
  body: 28,
  label: 22,
  tiny: 16,
} as const;

// === TIMING ===
export const VOX_TIMING = {
  stutterStep: 2.5,
  entranceDuration: 10,
  exitDuration: 8,
  staggerDelay: 5,
  holdMinimum: 20,
  highlighterSpeed: 10,
  typewriterSpeed: 2,
  drawOnSpeed: 10,
} as const;

// === SPRING ===
export const VOX_SPRING = {
  entrance: { damping: 20, stiffness: 180, mass: 1 },
  settle: { damping: 25, stiffness: 200, mass: 1 },
} as const;

// === EASING ===
export const voxEaseOut = Easing.bezier(0.25, 0.1, 0.25, 1.0);
export const voxEaseIn = Easing.bezier(0.4, 0.0, 1.0, 1.0);

// === GRAIN ===
export const VOX_GRAIN = {
  opacity: 0.3,
  cycleFrames: 8,
} as const;

// === ROUGH EDGE ===
export const VOX_ROUGH = {
  turbulenceFrequency: 0.04,
  displacementScale: 3,
} as const;

// === STUTTER HELPER ===
/** Quantize frame to 12fps steps within 30fps timeline */
export const sf = (frame: number): number =>
  Math.floor(frame / VOX_TIMING.stutterStep) * VOX_TIMING.stutterStep;
```

- [ ] **Step 2: Commit**

```bash
git add packages/templates/src/vox/constants.ts
git commit -m "feat(vox): add constants — colors, fonts, timing, springs, stutter helper"
```

---

### Task 2: Create `animations.ts`

**Files:**
- Create: `packages/templates/src/vox/animations.ts`

- [ ] **Step 1: Write animation helpers**

These are the core motion functions all vox templates use. Each returns interpolated values for a given frame.

```typescript
import { interpolate, Easing } from 'remotion';
import { sf, VOX_TIMING, voxEaseOut, voxEaseIn } from './constants';

/**
 * Stuttered slide-in entrance.
 * Returns { opacity, translateX, translateY } for the given frame.
 */
export function voxEntrance(
  frame: number,
  start: number,
  duration = VOX_TIMING.entranceDuration,
  direction: 'up' | 'down' | 'left' | 'right' = 'up',
  travel = 30,
): { opacity: number; translateX: number; translateY: number } {
  const stuttered = sf(frame);
  // Opacity leads position by 4 frames
  const opacity = interpolate(frame, [start, start + duration + 4], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: voxEaseOut,
  });
  const progress = interpolate(stuttered, [start + 4, start + duration + 4], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: voxEaseOut,
  });
  const dirs = { up: [0, travel], down: [0, -travel], left: [travel, 0], right: [-travel, 0] };
  const [dx, dy] = dirs[direction];
  return { opacity, translateX: dx * progress, translateY: dy * progress };
}

/**
 * Fade-down exit. Duration = 75% of entrance by default.
 */
export function voxExit(
  frame: number,
  start: number,
  duration = VOX_TIMING.exitDuration,
): { opacity: number; translateY: number } {
  const opacity = interpolate(frame, [start, start + duration], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: voxEaseIn,
  });
  const translateY = interpolate(sf(frame), [start, start + duration], [0, 15], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: voxEaseIn,
  });
  return { opacity, translateY };
}

/**
 * Yellow highlighter sweep — returns width% and rotation for the highlight bar.
 */
export function highlighterSweep(
  frame: number,
  start: number,
  duration = VOX_TIMING.highlighterSpeed,
): { widthPercent: number; rotation: number; yOffset: number } {
  const widthPercent = interpolate(frame, [start, start + duration], [0, 100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: voxEaseOut,
  });
  // Slight imperfection — fixed per instance, not animated
  const rotation = 0.8;
  const yOffset = -1;
  return { widthPercent, rotation, yOffset };
}

/**
 * Character-by-character typewriter reveal.
 */
export function typewriterReveal(
  frame: number,
  start: number,
  totalChars: number,
  speed = VOX_TIMING.typewriterSpeed,
): { visibleChars: number } {
  const elapsed = Math.max(0, sf(frame) - start);
  const visibleChars = Math.min(totalChars, Math.floor(elapsed / speed));
  return { visibleChars };
}

/**
 * Draw-on progress for lines, borders, connectors.
 */
export function drawOn(
  frame: number,
  start: number,
  duration = VOX_TIMING.drawOnSpeed,
): { progress: number } {
  const progress = interpolate(sf(frame), [start, start + duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: voxEaseOut,
  });
  return { progress };
}

/**
 * Counter roll — number ticks from 0 to target with overshoot.
 */
export function counterRoll(
  frame: number,
  start: number,
  duration: number,
  target: number,
): { displayValue: number } {
  const raw = interpolate(sf(frame), [start, start + duration], [0, target * 1.08], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: voxEaseOut,
  });
  // Settle from overshoot
  const settle = interpolate(sf(frame), [start + duration, start + duration + 8], [raw, target], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const displayValue = sf(frame) >= start + duration ? Math.round(settle) : Math.round(raw);
  return { displayValue };
}

/**
 * Staggered item reveal — returns per-item opacity array.
 */
export function progressiveBuild(
  frame: number,
  start: number,
  itemCount: number,
  stagger = VOX_TIMING.staggerDelay,
): { itemOpacities: number[] } {
  const itemOpacities = Array.from({ length: itemCount }, (_, i) => {
    const itemStart = start + i * stagger;
    return interpolate(frame, [itemStart, itemStart + VOX_TIMING.entranceDuration], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: voxEaseOut,
    });
  });
  return { itemOpacities };
}

/**
 * Pop-in with overshoot — for icons, data points, badges.
 */
export function popIn(
  frame: number,
  start: number,
  duration = 6,
): { scale: number; opacity: number } {
  const opacity = interpolate(frame, [start, start + 4], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const scale = interpolate(sf(frame), [start, start + duration, start + duration + 6], [0, 1.08, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: voxEaseOut,
  });
  return { scale, opacity };
}

/**
 * Micro-motion for holds — prevents static frames.
 */
export function voxIdle(
  frame: number,
  seed: number,
  type: 'breathe' | 'scale' = 'breathe',
): { translateY: number; scale: number } {
  const period = type === 'breathe' ? 60 : 90;
  const phase = (seed % 100) / 100 * Math.PI * 2;
  const wave = Math.sin((frame / period) * Math.PI * 2 + phase);
  if (type === 'breathe') {
    return { translateY: wave * 0.5, scale: 1 };
  }
  return { translateY: 0, scale: 1 + wave * 0.002 };
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/templates/src/vox/animations.ts
git commit -m "feat(vox): add animation helpers — stutter, highlight sweep, typewriter, counter, idle"
```

---

### Task 3: Create `effects.tsx`

**Files:**
- Create: `packages/templates/src/vox/effects.tsx`

- [ ] **Step 1: Write effects components**

```tsx
import React from 'react';
import { useCurrentFrame } from 'remotion';
import { VOX_GRAIN, VOX_ROUGH } from './constants';

/**
 * Cycling film grain overlay — shifts pattern every N frames.
 * Must be placed as last child (on top) of the scene.
 */
export const FilmGrain: React.FC<{
  opacity?: number;
  cycleFrames?: number;
  seed?: number;
}> = ({ opacity = VOX_GRAIN.opacity, cycleFrames = VOX_GRAIN.cycleFrames, seed = 1 }) => {
  const frame = useCurrentFrame();
  const cycleSeed = seed + Math.floor(frame / cycleFrames);
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', mixBlendMode: 'overlay' }}>
      <svg width="100%" height="100%" style={{ opacity }}>
        <filter id={`vox-grain-${cycleSeed}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="3" seed={cycleSeed} />
        </filter>
        <rect width="100%" height="100%" filter={`url(#vox-grain-${cycleSeed})`} />
      </svg>
    </div>
  );
};

/**
 * Rough edge mask — wraps children in a jagged container via SVG displacement.
 */
export const RoughEdgeMask: React.FC<{
  frequency?: number;
  scale?: number;
  seed?: number;
  children: React.ReactNode;
}> = ({
  frequency = VOX_ROUGH.turbulenceFrequency,
  scale = VOX_ROUGH.displacementScale,
  seed = 42,
  children,
}) => {
  const filterId = `vox-rough-${seed}`;
  return (
    <div style={{ position: 'relative' }}>
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <filter id={filterId}>
          <feTurbulence type="turbulence" baseFrequency={frequency} numOctaves="2" seed={seed} result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale={scale} xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
      <div style={{ filter: `url(#${filterId})` }}>
        {children}
      </div>
    </div>
  );
};

/**
 * Animated yellow highlighter mark behind text.
 */
export const HighlighterMark: React.FC<{
  widthPercent: number;
  height: number;
  rotation?: number;
  yOffset?: number;
  color?: string;
  opacity?: number;
}> = ({
  widthPercent,
  height,
  rotation = 0.8,
  yOffset = -1,
  color = '#FFEB00',
  opacity = 0.85,
}) => (
  <div
    style={{
      position: 'absolute',
      left: 0,
      top: yOffset,
      width: `${widthPercent}%`,
      height,
      backgroundColor: color,
      opacity,
      transform: `rotate(${rotation}deg)`,
      zIndex: -1,
    }}
  />
);

/**
 * Chromatic aberration — wraps children with RGB channel offset.
 */
export const ChromaticAberration: React.FC<{
  offset?: number;
  children: React.ReactNode;
}> = ({ offset = 1.5, children }) => (
  <div style={{ position: 'relative' }}>
    <div style={{ position: 'absolute', inset: 0, mixBlendMode: 'screen', opacity: 0.3, transform: `translate(${offset}px, 0)`, filter: 'url(#vox-red)' }}>
      {children}
    </div>
    <div style={{ position: 'absolute', inset: 0, mixBlendMode: 'screen', opacity: 0.3, transform: `translate(-${offset}px, 0)`, filter: 'url(#vox-blue)' }}>
      {children}
    </div>
    <div style={{ position: 'relative' }}>
      {children}
    </div>
  </div>
);

/**
 * Warm color temperature shift overlay.
 */
export const WarmShift: React.FC<{
  intensity?: number;
}> = ({ intensity = 0.04 }) => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      backgroundColor: `rgba(255, 200, 100, ${intensity})`,
      pointerEvents: 'none',
      mixBlendMode: 'overlay',
    }}
  />
);
```

- [ ] **Step 2: Commit**

```bash
git add packages/templates/src/vox/effects.tsx
git commit -m "feat(vox): add effects — FilmGrain, RoughEdgeMask, HighlighterMark, ChromaticAberration"
```

---

### Task 4: Create `textures.tsx`

**Files:**
- Create: `packages/templates/src/vox/textures.tsx`

- [ ] **Step 1: Write texture components**

```tsx
import React from 'react';
import { useCurrentFrame } from 'remotion';

/**
 * Construction paper background texture.
 */
export const ConstructionPaper: React.FC<{
  color?: string;
  opacity?: number;
  seed?: number;
}> = ({ color = '#F1F3F2', opacity = 0.6, seed = 7 }) => (
  <div style={{ position: 'absolute', inset: 0, backgroundColor: color }}>
    <svg width="100%" height="100%" style={{ opacity }}>
      <filter id={`vox-paper-${seed}`}>
        <feTurbulence type="fractalNoise" baseFrequency="0.5" numOctaves="4" seed={seed} />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter={`url(#vox-paper-${seed})`} />
    </svg>
  </div>
);

/**
 * Halftone dot-matrix newsprint overlay.
 */
export const NewsprintOverlay: React.FC<{
  opacity?: number;
  dotSize?: number;
  seed?: number;
}> = ({ opacity = 0.08, dotSize = 2, seed = 13 }) => (
  <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
    <svg width="100%" height="100%" style={{ opacity }}>
      <filter id={`vox-newsprint-${seed}`}>
        <feTurbulence type="turbulence" baseFrequency={0.1 / dotSize} numOctaves="1" seed={seed} />
        <feComponentTransfer>
          <feFuncA type="discrete" tableValues="0 1" />
        </feComponentTransfer>
      </filter>
      <rect width="100%" height="100%" filter={`url(#vox-newsprint-${seed})`} />
    </svg>
  </div>
);

/**
 * Frame-aware cycling grain texture — shifts every N frames for organic movement.
 */
export const GrainCycle: React.FC<{
  opacity?: number;
  speed?: number;
}> = ({ opacity = 0.15, speed = 8 }) => {
  const frame = useCurrentFrame();
  const cycleSeed = Math.floor(frame / speed);
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <svg width="100%" height="100%" style={{ opacity }}>
        <filter id={`vox-cycle-${cycleSeed}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="2" seed={cycleSeed * 7 + 3} />
        </filter>
        <rect width="100%" height="100%" filter={`url(#vox-cycle-${cycleSeed})`} />
      </svg>
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add packages/templates/src/vox/textures.tsx
git commit -m "feat(vox): add textures — ConstructionPaper, NewsprintOverlay, GrainCycle"
```

---

### Task 5: Create `typography.tsx`

**Files:**
- Create: `packages/templates/src/vox/typography.tsx`

- [ ] **Step 1: Write typography components**

```tsx
import React from 'react';
import { VOX_FONTS, VOX_SIZES, VOX_COLORS } from './constants';
import { RoughEdgeMask } from './effects';

export const VoxHeadline: React.FC<{
  text: string;
  size?: number;
  color?: string;
  accentBar?: 'left' | 'underline' | 'none';
  accentColor?: string;
}> = ({
  text,
  size = VOX_SIZES.h1,
  color = VOX_COLORS.charcoal,
  accentBar = 'none',
  accentColor = VOX_COLORS.highlight,
}) => (
  <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', gap: accentBar === 'left' ? 12 : 0 }}>
    {accentBar === 'left' && (
      <div style={{ width: 4, backgroundColor: accentColor, alignSelf: 'stretch', borderRadius: 2 }} />
    )}
    <div>
      <div style={{ fontFamily: VOX_FONTS.headline, fontSize: size, fontWeight: 700, color, lineHeight: 1.15 }}>
        {text}
      </div>
      {accentBar === 'underline' && (
        <div style={{ height: 4, backgroundColor: accentColor, marginTop: 6, borderRadius: 2 }} />
      )}
    </div>
  </div>
);

export const VoxBody: React.FC<{
  text: string;
  size?: number;
  color?: string;
  maxWidth?: number;
}> = ({ text, size = VOX_SIZES.body, color = VOX_COLORS.charcoal, maxWidth }) => (
  <div style={{ fontFamily: VOX_FONTS.body, fontSize: size, fontWeight: 400, color, lineHeight: 1.5, maxWidth }}>
    {text}
  </div>
);

export const VoxLabel: React.FC<{
  text: string;
  color?: string;
  background?: string;
}> = ({ text, color = VOX_COLORS.charcoal, background }) => (
  <div style={{ position: 'relative', display: 'inline-block' }}>
    {background && (
      <RoughEdgeMask seed={text.length * 7}>
        <div style={{ position: 'absolute', inset: -4, backgroundColor: background, borderRadius: 2 }} />
      </RoughEdgeMask>
    )}
    <span style={{
      fontFamily: VOX_FONTS.body,
      fontSize: VOX_SIZES.label,
      fontWeight: 500,
      color,
      textTransform: 'uppercase',
      letterSpacing: 1.5,
      position: 'relative',
    }}>
      {text}
    </span>
  </div>
);

export const VoxCounter: React.FC<{
  value: number | string;
  unit?: string;
  size?: number;
  color?: string;
}> = ({ value, unit, size = VOX_SIZES.hero, color = VOX_COLORS.charcoal }) => (
  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
    <span style={{ fontFamily: VOX_FONTS.body, fontSize: size, fontWeight: 700, color }}>
      {value}
    </span>
    {unit && (
      <span style={{ fontFamily: VOX_FONTS.body, fontSize: size * 0.4, fontWeight: 500, color: VOX_COLORS.medGray }}>
        {unit}
      </span>
    )}
  </div>
);

export const VoxQuestion: React.FC<{
  text: string;
  size?: number;
}> = ({ text, size = VOX_SIZES.h1 }) => (
  <div style={{
    fontFamily: VOX_FONTS.headline,
    fontSize: size,
    fontWeight: 700,
    color: VOX_COLORS.charcoal,
    lineHeight: 1.2,
    textAlign: 'center',
    fontStyle: 'italic',
  }}>
    {text}
  </div>
);

export const VoxSourceBadge: React.FC<{
  source: string;
  position?: 'bottom-left' | 'bottom-right' | 'top-right';
}> = ({ source, position = 'bottom-left' }) => {
  const posStyles: Record<string, React.CSSProperties> = {
    'bottom-left': { bottom: 12, left: 12 },
    'bottom-right': { bottom: 12, right: 12 },
    'top-right': { top: 12, right: 12 },
  };
  return (
    <div style={{
      position: 'absolute',
      ...posStyles[position],
      fontFamily: VOX_FONTS.body,
      fontSize: VOX_SIZES.tiny,
      color: VOX_COLORS.medGray,
      textTransform: 'uppercase',
      letterSpacing: 1,
    }}>
      Source: {source}
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add packages/templates/src/vox/typography.tsx
git commit -m "feat(vox): add typography — VoxHeadline, VoxBody, VoxLabel, VoxCounter, VoxQuestion, VoxSourceBadge"
```

---

### Task 6: Create `decorations.tsx`

**Files:**
- Create: `packages/templates/src/vox/decorations.tsx`

- [ ] **Step 1: Write decoration components**

```tsx
import React from 'react';
import { VOX_COLORS } from './constants';
import { RoughEdgeMask } from './effects';

export const HighlighterStroke: React.FC<{
  width: number;
  thickness?: number;
  rotation?: number;
  color?: string;
}> = ({ width, thickness = 8, rotation = 0.8, color = VOX_COLORS.highlight }) => (
  <div style={{
    width,
    height: thickness,
    backgroundColor: color,
    opacity: 0.85,
    transform: `rotate(${rotation}deg)`,
    borderRadius: 1,
  }} />
);

export const AnnotationCircle: React.FC<{
  size: number;
  color?: string;
  strokeWidth?: number;
}> = ({ size, color = VOX_COLORS.highlight, strokeWidth = 3 }) => (
  <RoughEdgeMask seed={size * 3} scale={2}>
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      border: `${strokeWidth}px solid ${color}`,
      boxSizing: 'border-box',
    }} />
  </RoughEdgeMask>
);

export const AnnotationArrow: React.FC<{
  length: number;
  angle?: number;
  color?: string;
  headSize?: number;
}> = ({ length, angle = 0, color = VOX_COLORS.highlight, headSize = 8 }) => (
  <RoughEdgeMask seed={length * 5} scale={1.5}>
    <div style={{ transform: `rotate(${angle}deg)`, display: 'flex', alignItems: 'center' }}>
      <div style={{ width: length - headSize, height: 3, backgroundColor: color }} />
      <div style={{
        width: 0,
        height: 0,
        borderLeft: `${headSize}px solid ${color}`,
        borderTop: `${headSize / 2}px solid transparent`,
        borderBottom: `${headSize / 2}px solid transparent`,
      }} />
    </div>
  </RoughEdgeMask>
);

export const CutoutFrame: React.FC<{
  width: number;
  height: number;
  rotation?: number;
  seed?: number;
  children: React.ReactNode;
}> = ({ width, height, rotation = 0, seed = 99, children }) => (
  <RoughEdgeMask seed={seed} scale={4}>
    <div style={{
      width,
      height,
      overflow: 'hidden',
      transform: `rotate(${rotation}deg)`,
    }}>
      {children}
    </div>
  </RoughEdgeMask>
);

export const RoughDivider: React.FC<{
  length: number;
  direction?: 'horizontal' | 'vertical';
  color?: string;
  thickness?: number;
}> = ({ length, direction = 'horizontal', color = VOX_COLORS.lightGray, thickness = 2 }) => (
  <RoughEdgeMask seed={length * 11} scale={2}>
    <div style={{
      width: direction === 'horizontal' ? length : thickness,
      height: direction === 'vertical' ? length : thickness,
      backgroundColor: color,
    }} />
  </RoughEdgeMask>
);
```

- [ ] **Step 2: Commit**

```bash
git add packages/templates/src/vox/decorations.tsx
git commit -m "feat(vox): add decorations — HighlighterStroke, AnnotationCircle, AnnotationArrow, CutoutFrame, RoughDivider"
```

---

### Task 7: Verify shared library compiles

- [ ] **Step 1: Create a barrel export for the library**

Not strictly required (templates import individual files), but useful for verification:

```bash
cd packages/templates && npx tsc --noEmit
```

Expected: No errors. If there are import issues, fix them.

- [ ] **Step 2: Verify all 6 files exist**

```bash
ls packages/templates/src/vox/
```

Expected: `animations.ts  constants.ts  decorations.tsx  effects.tsx  textures.tsx  typography.tsx`
