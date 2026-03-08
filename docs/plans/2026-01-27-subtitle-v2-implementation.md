# Subtitle System V2 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an animation engine with 11 animations, expand presets from 6→12, add three-layer customization (global/per-caption/per-word), and build a hybrid transcript+timeline subtitle editing UX.

**Architecture:** The animation engine lives in `packages/renderer/src/animations/` as pure functions shared between editor preview and export. Type changes go in `packages/shared/src/types/index.ts` and `apps/web/src/features/editor-v2/store/types.ts`. New UI panels live in `apps/web/src/features/editor-v2/panels/`. Presets expand in `apps/web/src/lib/subtitle-presets.ts`.

**Tech Stack:** TypeScript, React 19, Remotion 4, Zustand + Immer, Tailwind CSS, Google Fonts API.

---

## Task 1: Add Animation Types to Shared Package

**Files:**
- Modify: `packages/shared/src/types/index.ts:10-14` (replace SubtitleAnimation)
- Modify: `packages/shared/src/types/index.ts:39-68` (update SubtitleStyle)
- Modify: `packages/shared/src/types/index.ts:293-321` (update DEFAULT_SUBTITLE_STYLE)

**Step 1: Add AnimationType, EasingType, AnimationConfig to shared types**

In `packages/shared/src/types/index.ts`, replace lines 10-14:

```typescript
// OLD
export type SubtitleDisplayMode = 'word-by-word' | 'phrase' | 'karaoke';
export type SubtitleAnimation = 'none' | 'pop' | 'fade' | 'highlight';
export type SubtitlePosition = 'top' | 'center' | 'bottom';
```

```typescript
// NEW
export type SubtitleDisplayMode = 'word-by-word' | 'phrase' | 'karaoke';
export type SubtitlePosition = 'top' | 'center' | 'bottom';

// Legacy animation type (for backward compatibility)
export type SubtitleAnimationLegacy = 'none' | 'pop' | 'fade' | 'highlight';

// V2 Animation System
export type AnimationType =
  | 'none'
  // Viral
  | 'elastic-pop'
  | 'bounce-up'
  | 'shake'
  | 'color-wipe'
  | '3d-flip'
  | 'punch'
  // Cinematic
  | 'fade-rise'
  | 'typewriter'
  | 'smooth-slide'
  | 'soft-scale'
  | 'underline-wipe';

export type EasingType = 'linear' | 'ease-out' | 'spring' | 'elastic' | 'bounce';

export interface AnimationConfig {
  in: AnimationType;
  active: AnimationType;
  out: AnimationType;
  easing: EasingType;
}
```

**Step 2: Add WordStyleOverrides to SubtitleWord**

In the same file, update `SubtitleWord` (lines 32-37):

```typescript
// OLD
export interface SubtitleWord {
  text: string;
  startMs: number;
  endMs: number;
  confidence?: number;
}
```

```typescript
// NEW
export interface WordStyleOverrides {
  color?: string;
  fontWeight?: number;
  scale?: number;        // 1.0 = normal, 1.2 = 20% bigger
  emphasisBg?: string;   // highlight background color
}

export interface SubtitleWord {
  text: string;
  startMs: number;
  endMs: number;
  confidence?: number;
  styleOverrides?: WordStyleOverrides;
}
```

**Step 3: Update SubtitleStyle with new fields**

Replace `SubtitleStyle` interface (lines 39-68):

```typescript
export interface SubtitleStyle {
  // Display mode
  displayMode: SubtitleDisplayMode;
  wordsPerPhrase: number;

  // Animation — V2: AnimationConfig object, V1: string (migrated at load)
  animation: AnimationConfig | SubtitleAnimationLegacy;

  // Typography
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  letterSpacing?: number;          // default 0
  textTransform?: 'none' | 'uppercase' | 'lowercase';

  // Colors
  color: string;
  activeColor: string;
  backgroundColor: string;
  activeBackgroundColor: string;

  // Effects
  textStroke?: string;
  textShadow?: string;

  // Background box
  backgroundPadding?: { x: number; y: number };
  backgroundRadius?: number;

  // Position
  position: SubtitlePosition;
  offsetY: number;

  // Preset reference
  presetId?: string;
}
```

**Step 4: Update SubtitleData to support per-caption overrides**

Update `SubtitleData` (lines 70-74):

```typescript
export interface SubtitleData {
  text: string;
  words: SubtitleWord[];
  style: SubtitleStyle;
  styleOverrides?: Partial<SubtitleStyle>;  // Per-caption overrides
}
```

**Step 5: Update DEFAULT_SUBTITLE_STYLE**

Replace DEFAULT_SUBTITLE_STYLE (lines 293-321):

```typescript
export const DEFAULT_SUBTITLE_STYLE: SubtitleStyle = {
  displayMode: 'phrase',
  wordsPerPhrase: 5,

  animation: {
    in: 'elastic-pop',
    active: 'none',
    out: 'none',
    easing: 'spring',
  },

  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 56,
  fontWeight: 800,
  letterSpacing: 0,
  textTransform: 'none',

  color: '#ffffff',
  activeColor: '#ffff00',
  backgroundColor: 'transparent',
  activeBackgroundColor: 'transparent',

  textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8)',

  backgroundPadding: { x: 4, y: 2 },
  backgroundRadius: 8,

  position: 'bottom',
  offsetY: 0,

  presetId: 'mrbeast-bold',
};
```

**Step 6: Build shared package**

Run: `pnpm --filter @viona/shared build`
Expected: Build succeeds with new types exported.

**Step 7: Commit**

```bash
git add packages/shared/src/types/index.ts
git commit -m "feat: add V2 animation types and per-word/caption style overrides to shared types"
```

---

## Task 2: Mirror Type Changes in Editor Store Types

**Files:**
- Modify: `apps/web/src/features/editor-v2/store/types.ts:42-84` (update CaptionWord, CaptionStyle)
- Modify: `apps/web/src/features/editor-v2/store/types.ts:345-371` (update DEFAULT_CAPTION_STYLE)

**Step 1: Update CaptionWord with styleOverrides**

In `apps/web/src/features/editor-v2/store/types.ts`, update `CaptionWord` and add types (lines 48-84):

```typescript
// OLD
export interface CaptionWord {
  text: string;
  startMs: number;
  endMs: number;
}

export type CaptionDisplayMode = 'word-by-word' | 'phrase' | 'karaoke';
export type CaptionAnimation = 'none' | 'pop' | 'fade' | 'highlight';

export interface CaptionStyle {
  displayMode: CaptionDisplayMode;
  wordsPerPhrase: number;
  animation: CaptionAnimation;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  activeColor: string;
  backgroundColor: string;
  activeBackgroundColor: string;
  textStroke?: string;
  textShadow?: string;
  position: 'top' | 'center' | 'bottom';
  offsetY: number;
  textAlign: 'left' | 'center' | 'right';
}
```

```typescript
// NEW
export interface WordStyleOverrides {
  color?: string;
  fontWeight?: number;
  scale?: number;
  emphasisBg?: string;
}

export interface CaptionWord {
  text: string;
  startMs: number; // Relative to caption start
  endMs: number;   // Relative to caption start
  styleOverrides?: WordStyleOverrides;
}

export type CaptionDisplayMode = 'word-by-word' | 'phrase' | 'karaoke';

// Legacy animation type kept for backward compat
export type CaptionAnimationLegacy = 'none' | 'pop' | 'fade' | 'highlight';

// V2 animation types
export type AnimationType =
  | 'none'
  | 'elastic-pop' | 'bounce-up' | 'shake' | 'color-wipe'
  | '3d-flip' | 'punch'
  | 'fade-rise' | 'typewriter' | 'smooth-slide' | 'soft-scale'
  | 'underline-wipe';

export type EasingType = 'linear' | 'ease-out' | 'spring' | 'elastic' | 'bounce';

export interface AnimationConfig {
  in: AnimationType;
  active: AnimationType;
  out: AnimationType;
  easing: EasingType;
}

export interface CaptionStyle {
  // Display mode
  displayMode: CaptionDisplayMode;
  wordsPerPhrase: number;

  // Animation — V2 config or legacy string
  animation: AnimationConfig | CaptionAnimationLegacy;

  // Typography
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  letterSpacing?: number;
  textTransform?: 'none' | 'uppercase' | 'lowercase';

  // Colors
  color: string;
  activeColor: string;
  backgroundColor: string;
  activeBackgroundColor: string;

  // Effects
  textStroke?: string;
  textShadow?: string;

  // Background box
  backgroundPadding?: { x: number; y: number };
  backgroundRadius?: number;

  // Position
  position: 'top' | 'center' | 'bottom';
  offsetY: number;
  textAlign: 'left' | 'center' | 'right';

  // Preset reference
  presetId?: string;
}
```

**Step 2: Update CaptionItemData with styleOverrides**

Update `CaptionItemData` (lines 42-46):

```typescript
export interface CaptionItemData {
  text: string;
  words: CaptionWord[];
  style: CaptionStyle;
  styleOverrides?: Partial<CaptionStyle>;  // Per-caption overrides
}
```

**Step 3: Update DEFAULT_CAPTION_STYLE**

Replace the default (lines 345-371):

```typescript
export const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  displayMode: 'phrase',
  wordsPerPhrase: 5,

  animation: {
    in: 'elastic-pop',
    active: 'none',
    out: 'none',
    easing: 'spring',
  },

  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 56,
  fontWeight: 800,
  letterSpacing: 0,
  textTransform: 'none',

  color: '#ffffff',
  activeColor: '#ffff00',
  backgroundColor: 'transparent',
  activeBackgroundColor: 'transparent',

  textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8)',

  backgroundPadding: { x: 4, y: 2 },
  backgroundRadius: 8,

  position: 'bottom',
  offsetY: 0,
  textAlign: 'center',

  presetId: 'mrbeast-bold',
};
```

**Step 4: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No new errors from type changes (there may be existing errors).

**Step 5: Commit**

```bash
git add apps/web/src/features/editor-v2/store/types.ts
git commit -m "feat: mirror V2 animation types and style overrides in editor store types"
```

---

## Task 3: Build Animation Engine

**Files:**
- Create: `packages/renderer/src/animations/types.ts`
- Create: `packages/renderer/src/animations/easing.ts`
- Create: `packages/renderer/src/animations/animations.ts`
- Create: `packages/renderer/src/animations/resolve.ts`
- Create: `packages/renderer/src/animations/migrate.ts`
- Create: `packages/renderer/src/animations/index.ts`

**Step 1: Create `packages/renderer/src/animations/types.ts`**

```typescript
import type { CSSProperties } from 'react';

export type AnimationType =
  | 'none'
  | 'elastic-pop' | 'bounce-up' | 'shake' | 'color-wipe'
  | '3d-flip' | 'punch'
  | 'fade-rise' | 'typewriter' | 'smooth-slide' | 'soft-scale'
  | 'underline-wipe';

export type EasingType = 'linear' | 'ease-out' | 'spring' | 'elastic' | 'bounce';

export interface AnimationConfig {
  in: AnimationType;
  active: AnimationType;
  out: AnimationType;
  easing: EasingType;
}

/**
 * An animation function takes a progress value (0-1) and returns CSS properties.
 * Progress 0 = start of phase, 1 = end of phase.
 */
export type AnimationFn = (progress: number) => CSSProperties;

/** Phase of the word animation lifecycle */
export type AnimationPhase = 'in' | 'active' | 'out' | 'idle';

/** Resolved CSS for a word at a given frame */
export interface ResolvedAnimation {
  style: CSSProperties;
  phase: AnimationPhase;
}
```

**Step 2: Create `packages/renderer/src/animations/easing.ts`**

```typescript
/**
 * Easing functions
 * Each takes t (0-1) and returns eased value (0-1, may overshoot for spring/elastic)
 */

export function linear(t: number): number {
  return t;
}

export function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function spring(t: number): number {
  const stiffness = 100;
  const damping = 10;
  const w = Math.sqrt(stiffness);
  const d = damping / (2 * Math.sqrt(stiffness));
  if (d < 1) {
    const wd = w * Math.sqrt(1 - d * d);
    return 1 - Math.exp(-d * w * t) * (Math.cos(wd * t) + (d * w / wd) * Math.sin(wd * t));
  }
  return 1 - (1 + w * t) * Math.exp(-w * t);
}

export function elastic(t: number): number {
  if (t === 0 || t === 1) return t;
  const p = 0.3;
  return Math.pow(2, -10 * t) * Math.sin(((t - p / 4) * (2 * Math.PI)) / p) + 1;
}

export function bounce(t: number): number {
  if (t < 1 / 2.75) {
    return 7.5625 * t * t;
  } else if (t < 2 / 2.75) {
    const t2 = t - 1.5 / 2.75;
    return 7.5625 * t2 * t2 + 0.75;
  } else if (t < 2.5 / 2.75) {
    const t2 = t - 2.25 / 2.75;
    return 7.5625 * t2 * t2 + 0.9375;
  } else {
    const t2 = t - 2.625 / 2.75;
    return 7.5625 * t2 * t2 + 0.984375;
  }
}

import type { EasingType } from './types';

const EASING_MAP: Record<EasingType, (t: number) => number> = {
  linear,
  'ease-out': easeOut,
  spring,
  elastic,
  bounce,
};

export function getEasing(type: EasingType): (t: number) => number {
  return EASING_MAP[type] || linear;
}
```

**Step 3: Create `packages/renderer/src/animations/animations.ts`**

```typescript
import type { CSSProperties } from 'react';
import type { AnimationType, AnimationFn } from './types';

/**
 * Registry of animation functions.
 * Each animation is a function: (progress: 0-1) => CSSProperties
 * For "in" animations: progress 0 = hidden, 1 = fully visible
 * For "out" animations: progress 0 = fully visible, 1 = hidden
 * For "active" animations: progress oscillates or loops
 */

// ============================================
// No-op
// ============================================

const none: AnimationFn = () => ({});

// ============================================
// Viral Animations
// ============================================

const elasticPopIn: AnimationFn = (p) => ({
  transform: `scale(${p < 0.6 ? p * 2 : 1 + (1 - p) * 0.4})`,
  opacity: Math.min(p * 2, 1),
});

const elasticPopOut: AnimationFn = (p) => ({
  transform: `scale(${1 - p * 0.3})`,
  opacity: 1 - p,
});

const elasticPopActive: AnimationFn = (p) => {
  // Gentle pulse: scale between 1.0 and 1.05
  const pulse = 1 + 0.05 * Math.sin(p * Math.PI * 2);
  return { transform: `scale(${pulse})` };
};

const bounceUpIn: AnimationFn = (p) => ({
  transform: `translateY(${(1 - p) * 30}px)`,
  opacity: Math.min(p * 1.5, 1),
});

const bounceUpOut: AnimationFn = (p) => ({
  transform: `translateY(${p * -20}px)`,
  opacity: 1 - p,
});

const bounceUpActive: AnimationFn = (p) => {
  const bounce = Math.abs(Math.sin(p * Math.PI * 3)) * 3;
  return { transform: `translateY(${-bounce}px)` };
};

const shakeIn: AnimationFn = (p) => ({
  transform: `scale(${p})`,
  opacity: Math.min(p * 2, 1),
});

const shakeActive: AnimationFn = (p) => {
  const x = (Math.random() - 0.5) * 4;
  const y = (Math.random() - 0.5) * 4;
  return { transform: `translate(${x}px, ${y}px)` };
};

const shakeOut: AnimationFn = (p) => ({
  transform: `scale(${1 - p})`,
  opacity: 1 - p,
});

const colorWipeIn: AnimationFn = (p) => ({
  clipPath: `inset(0 ${(1 - p) * 100}% 0 0)`,
});

const colorWipeActive: AnimationFn = (p) => {
  const glow = 0.8 + 0.2 * Math.sin(p * Math.PI * 2);
  return { filter: `brightness(${glow})` };
};

const colorWipeOut: AnimationFn = (p) => ({
  clipPath: `inset(0 0 0 ${p * 100}%)`,
});

const flip3dIn: AnimationFn = (p) => ({
  transform: `perspective(400px) rotateX(${(1 - p) * 90}deg)`,
  opacity: p,
});

const flip3dOut: AnimationFn = (p) => ({
  transform: `perspective(400px) rotateX(${p * -90}deg)`,
  opacity: 1 - p,
});

const punchIn: AnimationFn = (p) => {
  // Scale 0 → 1.4 → 1
  const scale = p < 0.5 ? p * 2.8 : 1.4 - (p - 0.5) * 0.8;
  return {
    transform: `scale(${scale})`,
    opacity: Math.min(p * 3, 1),
  };
};

const punchOut: AnimationFn = (p) => ({
  transform: `scale(${1 - p * 0.8})`,
  opacity: 1 - p * 1.5,
});

// ============================================
// Cinematic Animations
// ============================================

const fadeRiseIn: AnimationFn = (p) => ({
  transform: `translateY(${(1 - p) * 10}px)`,
  opacity: p,
});

const fadeRiseOut: AnimationFn = (p) => ({
  transform: `translateY(${p * -10}px)`,
  opacity: 1 - p,
});

const typewriterIn: AnimationFn = (p) => ({
  clipPath: `inset(0 ${(1 - p) * 100}% 0 0)`,
});

const typewriterActive: AnimationFn = (p) => {
  // Cursor blink effect
  const blink = Math.floor(p * 6) % 2 === 0 ? 1 : 0;
  return { borderRight: `2px solid rgba(255,255,255,${blink})` };
};

const typewriterOut: AnimationFn = (p) => ({
  opacity: 1 - p,
});

const smoothSlideIn: AnimationFn = (p) => ({
  transform: `translateX(${(1 - p) * -30}px)`,
  opacity: p,
});

const smoothSlideOut: AnimationFn = (p) => ({
  transform: `translateX(${p * 30}px)`,
  opacity: 1 - p,
});

const softScaleIn: AnimationFn = (p) => ({
  transform: `scale(${0.8 + p * 0.2})`,
  opacity: p,
});

const softScaleOut: AnimationFn = (p) => ({
  transform: `scale(${1 - p * 0.2})`,
  opacity: 1 - p,
});

const underlineWipeIn: AnimationFn = (p) => ({
  borderBottom: `3px solid currentColor`,
  borderImage: `linear-gradient(90deg, currentColor ${p * 100}%, transparent ${p * 100}%) 1`,
});

const underlineWipeOut: AnimationFn = (p) => ({
  borderBottom: `3px solid currentColor`,
  borderImage: `linear-gradient(90deg, transparent ${p * 100}%, currentColor ${p * 100}%) 1`,
});

// ============================================
// Registry
// ============================================

interface AnimationSet {
  in: AnimationFn;
  active: AnimationFn;
  out: AnimationFn;
}

const ANIMATION_REGISTRY: Record<AnimationType, AnimationSet> = {
  'none':           { in: none, active: none, out: none },
  'elastic-pop':    { in: elasticPopIn, active: elasticPopActive, out: elasticPopOut },
  'bounce-up':      { in: bounceUpIn, active: bounceUpActive, out: bounceUpOut },
  'shake':          { in: shakeIn, active: shakeActive, out: shakeOut },
  'color-wipe':     { in: colorWipeIn, active: colorWipeActive, out: colorWipeOut },
  '3d-flip':        { in: flip3dIn, active: none, out: flip3dOut },
  'punch':          { in: punchIn, active: none, out: punchOut },
  'fade-rise':      { in: fadeRiseIn, active: none, out: fadeRiseOut },
  'typewriter':     { in: typewriterIn, active: typewriterActive, out: typewriterOut },
  'smooth-slide':   { in: smoothSlideIn, active: none, out: smoothSlideOut },
  'soft-scale':     { in: softScaleIn, active: none, out: softScaleOut },
  'underline-wipe': { in: underlineWipeIn, active: none, out: underlineWipeOut },
};

export function getAnimation(type: AnimationType, phase: 'in' | 'active' | 'out'): AnimationFn {
  const set = ANIMATION_REGISTRY[type] || ANIMATION_REGISTRY['none'];
  return set[phase];
}

export { ANIMATION_REGISTRY };
```

**Step 4: Create `packages/renderer/src/animations/resolve.ts`**

```typescript
import type { CSSProperties } from 'react';
import type { AnimationConfig, AnimationPhase, ResolvedAnimation } from './types';
import { getAnimation } from './animations';
import { getEasing } from './easing';

/**
 * Duration of in/out transition phases in milliseconds.
 * Active phase fills the remaining time.
 */
const TRANSITION_DURATION_MS = 200;

export interface WordTimingContext {
  /** Time in ms since the word became active (relative to word start) */
  elapsedMs: number;
  /** Total duration of the word in ms */
  wordDurationMs: number;
  /** Whether this word is the currently active (spoken) word */
  isActive: boolean;
  /** Whether this word has already been spoken */
  hasAppeared: boolean;
  /** Whether this word has not yet been spoken */
  isFuture: boolean;
}

/**
 * Resolve the animation CSS for a single word at a given point in time.
 */
export function resolveAnimation(
  config: AnimationConfig,
  ctx: WordTimingContext
): ResolvedAnimation {
  const easing = getEasing(config.easing);

  // Future word — not yet spoken
  if (ctx.isFuture) {
    return { style: { opacity: 0.4 }, phase: 'idle' };
  }

  // Past word — already spoken, no animation
  if (ctx.hasAppeared && !ctx.isActive) {
    return { style: {}, phase: 'idle' };
  }

  // Active word — determine phase within word duration
  if (ctx.isActive) {
    const inDuration = Math.min(TRANSITION_DURATION_MS, ctx.wordDurationMs * 0.3);
    const outDuration = Math.min(TRANSITION_DURATION_MS, ctx.wordDurationMs * 0.2);
    const activeDuration = ctx.wordDurationMs - inDuration - outDuration;

    let phase: AnimationPhase;
    let progress: number;

    if (ctx.elapsedMs < inDuration) {
      // Entry phase
      phase = 'in';
      progress = easing(ctx.elapsedMs / inDuration);
    } else if (ctx.elapsedMs < inDuration + activeDuration) {
      // Active/loop phase
      phase = 'active';
      progress = (ctx.elapsedMs - inDuration) / Math.max(activeDuration, 1);
    } else {
      // Exit phase
      phase = 'out';
      progress = easing((ctx.elapsedMs - inDuration - activeDuration) / Math.max(outDuration, 1));
    }

    const animFn = getAnimation(config[phase === 'idle' ? 'in' : phase], phase === 'idle' ? 'in' : phase);
    const animStyle = animFn(Math.max(0, Math.min(1, progress)));

    return { style: animStyle, phase };
  }

  // Fallback
  return { style: {}, phase: 'idle' };
}

/**
 * Check if an animation value is a V2 AnimationConfig object (vs legacy string).
 */
export function isAnimationConfig(value: unknown): value is AnimationConfig {
  return (
    typeof value === 'object' &&
    value !== null &&
    'in' in value &&
    'out' in value &&
    'active' in value
  );
}
```

**Step 5: Create `packages/renderer/src/animations/migrate.ts`**

```typescript
import type { AnimationConfig } from './types';

/**
 * Migrate legacy animation string ('pop', 'fade', etc.) to V2 AnimationConfig.
 * Called at project load time — no database migration needed.
 */
export function migrateAnimation(legacy: string): AnimationConfig {
  switch (legacy) {
    case 'pop':
      return { in: 'elastic-pop', active: 'none', out: 'none', easing: 'spring' };
    case 'fade':
      return { in: 'fade-rise', active: 'none', out: 'fade-rise', easing: 'ease-out' };
    case 'highlight':
      return { in: 'soft-scale', active: 'none', out: 'none', easing: 'ease-out' };
    case 'none':
    default:
      return { in: 'none', active: 'none', out: 'none', easing: 'linear' };
  }
}
```

**Step 6: Create `packages/renderer/src/animations/index.ts`**

```typescript
export type {
  AnimationType,
  EasingType,
  AnimationConfig,
  AnimationFn,
  AnimationPhase,
  ResolvedAnimation,
} from './types';

export { getAnimation, ANIMATION_REGISTRY } from './animations';
export { getEasing, linear, easeOut, spring, elastic, bounce } from './easing';
export { resolveAnimation, isAnimationConfig } from './resolve';
export type { WordTimingContext } from './resolve';
export { migrateAnimation } from './migrate';
```

**Step 7: Export animations from renderer package**

Add to `packages/renderer/src/index.ts`:

```typescript
// Animation engine
export * from './animations';
```

**Step 8: Update tsup entry**

In `packages/renderer/tsup.config.ts`, add the animations entry:

```typescript
entry: ['src/index.ts', 'src/remotion-entry.tsx', 'src/animations/index.ts'],
```

**Step 9: Build renderer**

Run: `pnpm --filter @viona/renderer build`
Expected: Build succeeds.

**Step 10: Commit**

```bash
git add packages/renderer/src/animations/ packages/renderer/tsup.config.ts packages/renderer/src/index.ts
git commit -m "feat: build V2 animation engine with 11 animation types, 5 easings, and migration"
```

---

## Task 4: Update AnimatedSubtitle to Use Animation Engine

**Files:**
- Modify: `packages/renderer/src/components/AnimatedSubtitle.tsx` (full rewrite of Word and animation logic)

**Step 1: Rewrite AnimatedSubtitle.tsx to use the animation engine**

Replace the entire file. Key changes:
- Import `resolveAnimation`, `isAnimationConfig`, `migrateAnimation` from `../animations`
- The `Word` component now calls `resolveAnimation()` instead of the manual switch statement
- Support `WordStyleOverrides` for per-word color/weight/scale
- The `Container` component reads new style fields (`letterSpacing`, `textTransform`, `backgroundPadding`, `backgroundRadius`)
- Legacy `animation: string` values are auto-migrated via `migrateAnimation()`

The `AnimatedSubtitle` main component stays structurally similar (switch on displayMode), but each sub-display delegates to the animation engine. The `Word` component becomes:

```typescript
const Word: React.FC<WordProps> = ({ word, style, isActive, hasAppeared, currentTimeMs }) => {
  // Resolve animation config (handle legacy strings)
  const animConfig = isAnimationConfig(style.animation)
    ? style.animation
    : migrateAnimation(style.animation as string);

  // Build timing context
  const elapsedMs = currentTimeMs - word.relStartMs;
  const wordDurationMs = word.relEndMs - word.relStartMs;

  const { style: animStyle } = resolveAnimation(animConfig, {
    elapsedMs: Math.max(0, elapsedMs),
    wordDurationMs,
    isActive,
    hasAppeared: hasAppeared && !isActive,
    isFuture: !hasAppeared,
  });

  // Per-word overrides
  const overrides = word.styleOverrides;

  const wordCss: React.CSSProperties = {
    fontFamily: style.fontFamily,
    fontSize: (overrides?.scale || 1) * style.fontSize,
    fontWeight: overrides?.fontWeight || style.fontWeight,
    letterSpacing: style.letterSpacing || 0,
    textTransform: style.textTransform || 'none',
    color: isActive
      ? (overrides?.color || style.activeColor)
      : (overrides?.color || style.color),
    backgroundColor: overrides?.emphasisBg
      || (isActive ? style.activeBackgroundColor : style.backgroundColor),
    padding: `${style.backgroundPadding?.y || 2}px ${style.backgroundPadding?.x || 4}px`,
    borderRadius: style.backgroundRadius || 8,
    textShadow: style.textShadow,
    WebkitTextStroke: style.textStroke,
    display: 'inline-block',
    whiteSpace: 'nowrap',
    wordBreak: 'keep-all',
    // Merge animation styles
    ...animStyle,
  };

  return <span style={wordCss}>{word.text}</span>;
};
```

**Important:** Pass `currentTimeMs` down to `Word` from each display component.

**Step 2: Build renderer**

Run: `pnpm --filter @viona/renderer build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add packages/renderer/src/components/AnimatedSubtitle.tsx
git commit -m "feat: integrate V2 animation engine into AnimatedSubtitle renderer"
```

---

## Task 5: Update Editor Composition to Use Animation Engine

**Files:**
- Modify: `apps/web/src/features/editor-v2/player/Composition.tsx:186-349` (rewrite CaptionRenderer)

**Step 1: Rewrite CaptionRenderer to use the animation engine**

The `CaptionRenderer` function (line 186) currently has inline animation logic (scale for pop/highlight, opacity for fade). Replace it to import and use `resolveAnimation`, `isAnimationConfig`, `migrateAnimation` from the renderer package (or copy the pure functions locally to avoid import issues in the Next.js client bundle).

The approach: import the animation functions from `@viona/renderer` since they're pure TypeScript with no Node.js dependencies.

Key changes to `CaptionRenderer`:
- For each word, compute `WordTimingContext` from `relativeTimeMs` and call `resolveAnimation()`
- Apply the resolved `animStyle` to each word's `<span>`
- Handle `WordStyleOverrides` the same way as in `AnimatedSubtitle.tsx`
- Remove the inline `scale`/`opacity` logic

**Step 2: Verify preview works**

Run: `pnpm dev:web`
Open the editor, verify captions still render with animation.

**Step 3: Commit**

```bash
git add apps/web/src/features/editor-v2/player/Composition.tsx
git commit -m "feat: use V2 animation engine in editor preview composition"
```

---

## Task 6: Expand Presets from 6 to 12

**Files:**
- Modify: `apps/web/src/lib/subtitle-presets.ts` (full rewrite)

**Step 1: Rewrite subtitle-presets.ts with 12 presets**

Replace the entire file. The new `SubtitlePreset` interface includes `AnimationConfig`, `category`, `letterSpacing`, `textTransform`, `backgroundPadding`, and `backgroundRadius`. The 12 presets are:

1. `mrbeast-bold` — Viral, Montserrat 900, Elastic Pop, White/Yellow, phrase
2. `hormozi` — Viral, Inter 800 uppercase, Punch, White/Red, word-by-word
3. `tiktok-bounce` — Viral, Poppins 700, Bounce Up, White/Cyan, phrase
4. `glitch-out` — Viral, Space Grotesk 700, Shake, Green/Magenta, word-by-word
5. `neon-karaoke` — Viral, Inter 700, Color Wipe, Cyan/Magenta glow, karaoke
6. `cinema-fade` — Cinematic, Playfair Display 600, Fade Rise, White/White, phrase
7. `documentary` — Cinematic, Source Sans 3 400, Soft Scale, White w/ stroke, phrase
8. `keynote` — Cinematic, Inter 500, Smooth Slide, White/Blue, phrase
9. `typewriter` — Cinematic, JetBrains Mono 400, Typewriter, Green on dark, karaoke
10. `minimal` — Minimal, Inter 500, Fade Rise, White w/ shadow, phrase
11. `box-highlight` — Minimal, Inter 700, Soft Scale, White on dark box, phrase
12. `classic-sub` — Minimal, Inter 600, None, White w/ stroke, phrase

Each preset uses the new `AnimationConfig` object format.

Group them by `category: 'viral' | 'cinematic' | 'minimal'`.

Export: `SUBTITLE_PRESETS`, `PRESET_ORDER`, `PRESET_CATEGORIES`, `DEFAULT_PRESET_ID` (now `'mrbeast-bold'`), `getPreset()`.

**Step 2: Commit**

```bash
git add apps/web/src/lib/subtitle-presets.ts
git commit -m "feat: expand subtitle presets from 6 to 12 with V2 animation configs"
```

---

## Task 7: Add Style Migration to Editor Store

**Files:**
- Modify: `apps/web/src/features/editor-v2/store/editor-store.ts:174-212` (convertApiProject caption loading)

**Step 1: Import migrateAnimation and apply during project load**

In `editor-store.ts`, when converting API captions to editor format (the for loop at line 176), after merging with `DEFAULT_CAPTION_STYLE`, check if `captionStyle.animation` is a string and migrate it:

```typescript
import { migrateAnimation, isAnimationConfig } from '@viona/renderer';

// Inside convertApiProject, after line 188:
// Migrate legacy animation string to V2 config
if (captionStyle.animation && !isAnimationConfig(captionStyle.animation)) {
  captionStyle.animation = migrateAnimation(captionStyle.animation as string);
}
```

This ensures old projects with `animation: 'pop'` get transparently upgraded to `AnimationConfig` objects.

**Step 2: Commit**

```bash
git add apps/web/src/features/editor-v2/store/editor-store.ts
git commit -m "feat: auto-migrate legacy animation strings on project load"
```

---

## Task 8: Refactor StylePanel with Progressive Disclosure

**Files:**
- Modify: `apps/web/src/features/editor-v2/panels/StylePanel.tsx` (major refactor)

**Step 1: Rewrite StylePanel with progressive disclosure**

The new StylePanel structure:

```
┌──────────────────────────────┐
│  All Captions  ← breadcrumb  │  (or "Caption #4" when specific)
├──────────────────────────────┤
│  [Viral] [Cinematic] [Min]   │  ← 3 tabs
│  ┌─────┐ ┌─────┐ ┌─────┐   │
│  │preset│ │preset│ │preset│   │  ← grid of animated previews
│  └─────┘ └─────┘ └─────┘   │
│  ┌─────┐ ┌─────┐ ┌─────┐   │
│  │preset│ │preset│ │preset│   │
│  └─────┘ └─────┘ └─────┘   │
├──────────────────────────────┤
│  Position:  [T] [C] [B]     │
│  Mode:  [Word] [Phrase] [K]  │
├──────────────────────────────┤
│  ▸ Customize                 │  ← disclosure toggle (collapsed by default)
│    Font: [Inter      ▾]     │
│    Size: ────●────── 56px    │
│    Weight: ──●────── 800     │
│    Letter Sp: ●───── 0px     │
│    Transform: [Aa] [AA] [aa] │
│    Text Color: [■] #ffffff   │
│    Active Color: [■] #ffff00 │
│    BG Color: [■] transparent │
│    BG Padding: ●──── 4px     │
│    BG Radius: ●──── 8px     │
│    Stroke Width: ●── 0px     │
│    Shadow: [None][Soft][Hard] │
│    [Reset to preset]         │
└──────────────────────────────┘
```

Key implementation notes:
- Import `SUBTITLE_PRESETS`, `PRESET_ORDER`, `PRESET_CATEGORIES` from presets
- Use `useState` for `activeTab` ('viral' | 'cinematic' | 'minimal') and `showCustomize` (boolean)
- Filter presets by `category === activeTab`
- When a preset is clicked, call `updateStyle()` with all preset fields
- The "Customize" section uses a `<details>` or conditional render toggled by `showCustomize`
- When a specific caption is double-clicked (detected via selectedIds changing to a single caption), show "Caption #N" in header with a back button
- "Reset to preset" reads `style.presetId` and re-applies that preset

**Step 2: Commit**

```bash
git add apps/web/src/features/editor-v2/panels/StylePanel.tsx
git commit -m "feat: refactor StylePanel with tabbed presets and progressive disclosure"
```

---

## Task 9: Add Font Registry and Font Picker

**Files:**
- Create: `apps/web/src/lib/font-registry.ts`
- The font picker is embedded in the StylePanel customize section

**Step 1: Create font registry**

Create `apps/web/src/lib/font-registry.ts` with ~25 curated Google Fonts:

```typescript
export interface FontEntry {
  family: string;
  weights: number[];
  category: 'sans-serif' | 'serif' | 'mono' | 'display';
  googleUrl: string;
}

export const FONT_REGISTRY: FontEntry[] = [
  // Sans-serif
  { family: 'Inter', weights: [400,500,600,700,800,900], category: 'sans-serif', googleUrl: 'Inter:wght@400;500;600;700;800;900' },
  { family: 'Montserrat', weights: [400,500,600,700,800,900], category: 'sans-serif', googleUrl: 'Montserrat:wght@400;500;600;700;800;900' },
  { family: 'Poppins', weights: [400,500,600,700,800,900], category: 'sans-serif', googleUrl: 'Poppins:wght@400;500;600;700;800;900' },
  { family: 'Source Sans 3', weights: [400,600,700], category: 'sans-serif', googleUrl: 'Source+Sans+3:wght@400;600;700' },
  { family: 'Space Grotesk', weights: [400,500,600,700], category: 'sans-serif', googleUrl: 'Space+Grotesk:wght@400;500;600;700' },
  { family: 'DM Sans', weights: [400,500,600,700], category: 'sans-serif', googleUrl: 'DM+Sans:wght@400;500;600;700' },
  { family: 'Outfit', weights: [400,500,600,700,800], category: 'sans-serif', googleUrl: 'Outfit:wght@400;500;600;700;800' },
  { family: 'Nunito', weights: [400,600,700,800,900], category: 'sans-serif', googleUrl: 'Nunito:wght@400;600;700;800;900' },
  { family: 'Lexend', weights: [400,500,600,700,800], category: 'sans-serif', googleUrl: 'Lexend:wght@400;500;600;700;800' },
  // Serif
  { family: 'Playfair Display', weights: [400,500,600,700,800,900], category: 'serif', googleUrl: 'Playfair+Display:wght@400;500;600;700;800;900' },
  { family: 'Lora', weights: [400,500,600,700], category: 'serif', googleUrl: 'Lora:wght@400;500;600;700' },
  { family: 'Merriweather', weights: [400,700,900], category: 'serif', googleUrl: 'Merriweather:wght@400;700;900' },
  { family: 'Cormorant Garamond', weights: [400,500,600,700], category: 'serif', googleUrl: 'Cormorant+Garamond:wght@400;500;600;700' },
  // Mono
  { family: 'JetBrains Mono', weights: [400,500,600,700,800], category: 'mono', googleUrl: 'JetBrains+Mono:wght@400;500;600;700;800' },
  { family: 'Fira Code', weights: [400,500,600,700], category: 'mono', googleUrl: 'Fira+Code:wght@400;500;600;700' },
  { family: 'Space Mono', weights: [400,700], category: 'mono', googleUrl: 'Space+Mono:wght@400;700' },
  // Display
  { family: 'Bebas Neue', weights: [400], category: 'display', googleUrl: 'Bebas+Neue' },
  { family: 'Righteous', weights: [400], category: 'display', googleUrl: 'Righteous' },
  { family: 'Rubik', weights: [400,500,600,700,800,900], category: 'display', googleUrl: 'Rubik:wght@400;500;600;700;800;900' },
  { family: 'Titan One', weights: [400], category: 'display', googleUrl: 'Titan+One' },
];

/** Load a Google Font dynamically */
export async function loadFont(entry: FontEntry): Promise<void> {
  const id = `font-${entry.family.replace(/\s+/g, '-').toLowerCase()}`;
  if (document.getElementById(id)) return;

  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${entry.googleUrl}&display=swap`;
  document.head.appendChild(link);

  // Wait for font to actually load
  await document.fonts.ready;
}

/** Get fonts grouped by category */
export function getFontsByCategory() {
  return {
    'sans-serif': FONT_REGISTRY.filter(f => f.category === 'sans-serif'),
    'serif': FONT_REGISTRY.filter(f => f.category === 'serif'),
    'mono': FONT_REGISTRY.filter(f => f.category === 'mono'),
    'display': FONT_REGISTRY.filter(f => f.category === 'display'),
  };
}
```

**Step 2: Commit**

```bash
git add apps/web/src/lib/font-registry.ts
git commit -m "feat: add curated Google Fonts registry with dynamic loading"
```

---

## Task 10: Build TranscriptPanel

**Files:**
- Create: `apps/web/src/features/editor-v2/panels/TranscriptPanel.tsx`
- Modify: `apps/web/src/features/editor-v2/Editor.tsx` (add transcript panel to layout)

**Step 1: Create TranscriptPanel.tsx**

A scrollable list of caption blocks with:
- Auto-scroll following playhead (toggleable via "Following" button in header)
- Click caption → seeks player to that caption's start time
- Click caption text → inline editing (input replaces text, Enter confirms, Escape cancels)
- Split button: scissors icon between words on hover, click splits at that boundary
- Merge: drag one caption into another (or button between adjacent blocks)
- Per-word selection: clicking a word shows the `WordToolbar` popover
- Timestamp on right edge of each block
- Search bar at top (Ctrl+F)

The component reads from store via:
- `useCaptionItems()` — all captions sorted by startMs
- `useCurrentTimeMs()` — for auto-scroll and active highlight
- `useEditorActions()` — for `seek()`, `updateItemData()`, `addItem()`, `deleteItems()`

Layout: vertical list, each item is a card with text content, timestamp, and action buttons.

**Step 2: Add store actions for split/merge**

Add to `editor-store.ts`:

```typescript
// Split caption at word boundary
splitCaption: (captionId: string, wordIndex: number) => { ... }

// Merge two adjacent captions
mergeCaptions: (captionId1: string, captionId2: string) => { ... }

// Update caption text (re-parse words)
updateCaptionText: (captionId: string, newText: string) => { ... }
```

Add corresponding types to `EditorActions` in `types.ts`.

**Step 3: Add TranscriptPanel to Editor layout**

In `Editor.tsx`, add a toggleable transcript panel. Add state `showTranscript` (default false). The panel renders at the left side of the main content area:

```tsx
{showTranscript && (
  <div className="w-80 flex-shrink-0 border-r border-[var(--editor-border-subtle)]">
    <TranscriptPanel />
  </div>
)}
```

**Step 4: Add keyboard shortcut `T` to toggle transcript**

In `hooks/use-keyboard-shortcuts.ts`, add handler for `T` key.

**Step 5: Commit**

```bash
git add apps/web/src/features/editor-v2/panels/TranscriptPanel.tsx \
       apps/web/src/features/editor-v2/Editor.tsx \
       apps/web/src/features/editor-v2/store/editor-store.ts \
       apps/web/src/features/editor-v2/store/types.ts \
       apps/web/src/features/editor-v2/hooks/use-keyboard-shortcuts.ts
git commit -m "feat: add transcript panel with inline editing, split/merge, and search"
```

---

## Task 11: Build WordToolbar (Per-Word Styling)

**Files:**
- Create: `apps/web/src/features/editor-v2/panels/WordToolbar.tsx`

**Step 1: Create floating toolbar component**

A small popover that appears above a selected word in the transcript panel. Four buttons:
- **Color** — small color picker (click to open native color input)
- **Bold** — toggle button (sets `fontWeight: 900` or removes override)
- **Scale** — toggle (sets `scale: 1.2` or removes override)
- **Highlight BG** — color picker for `emphasisBg`

The toolbar receives props:
- `captionId: string`
- `wordIndex: number`
- `word: CaptionWord`
- `position: { x: number; y: number }` (calculated from the DOM element position)
- `onClose: () => void`

Uses `useEditorActions().updateItemData()` to write `styleOverrides` on the specific word.

**Step 2: Add store action for updating word overrides**

In `editor-store.ts`:

```typescript
updateWordStyleOverrides: (captionId: string, wordIndex: number, overrides: Partial<WordStyleOverrides> | null) => {
  set((state) => {
    const item = state.items[captionId];
    if (!item || item.type !== 'caption') return;
    const data = item.data as CaptionItemData;
    if (wordIndex < 0 || wordIndex >= data.words.length) return;
    if (overrides === null) {
      delete data.words[wordIndex].styleOverrides;
    } else {
      data.words[wordIndex].styleOverrides = {
        ...data.words[wordIndex].styleOverrides,
        ...overrides,
      };
    }
  });
  get().pushHistory();
}
```

**Step 3: Commit**

```bash
git add apps/web/src/features/editor-v2/panels/WordToolbar.tsx \
       apps/web/src/features/editor-v2/store/editor-store.ts \
       apps/web/src/features/editor-v2/store/types.ts
git commit -m "feat: add per-word styling toolbar with color, bold, scale, and highlight"
```

---

## Task 12: Update VideoComposition (Export Renderer) for V2

**Files:**
- Modify: `packages/renderer/src/components/VideoComposition.tsx:15-22` (update SubtitleItem type)
- The `AnimatedSubtitle` component already handles V2 after Task 4

**Step 1: Update SubtitleItem interface**

In `VideoComposition.tsx`, update the `SubtitleItem` interface to include V2 fields:

```typescript
export interface SubtitleItem {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
  words: SubtitleWord[];
  style: SubtitleStyle;
  styleOverrides?: Partial<SubtitleStyle>;
}
```

The `AnimatedSubtitle` component already handles the new `AnimationConfig` and `WordStyleOverrides` from Task 4.

**Step 2: Build and verify**

Run: `pnpm --filter @viona/renderer build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add packages/renderer/src/components/VideoComposition.tsx
git commit -m "feat: update export renderer SubtitleItem for V2 style overrides"
```

---

## Task 13: Add Keyboard Shortcuts

**Files:**
- Modify: `apps/web/src/features/editor-v2/hooks/use-keyboard-shortcuts.ts`

**Step 1: Add new shortcuts**

Add handlers for:
- `S` — toggle Style panel (new state in Editor.tsx)
- `T` — toggle Transcript panel
- `1` / `2` / `3` — switch display mode (word-by-word / phrase / karaoke)
- `Delete` / `Backspace` — delete selected items (may already exist)

These should only fire when no input is focused (check `document.activeElement`).

**Step 2: Commit**

```bash
git add apps/web/src/features/editor-v2/hooks/use-keyboard-shortcuts.ts \
       apps/web/src/features/editor-v2/Editor.tsx
git commit -m "feat: add keyboard shortcuts for panels and display mode switching"
```

---

## Task 14: Wire Up Panel Toggle State in Editor

**Files:**
- Modify: `apps/web/src/features/editor-v2/Editor.tsx`

**Step 1: Add panel state and layout changes**

Add state for transcript panel visibility:

```typescript
const [showTranscript, setShowTranscript] = useState(false);
```

Update the layout to include the transcript panel on the left side of the main content area, between the scene and the context panel.

Pass `setShowTranscript` toggle to keyboard shortcuts and header (add a transcript toggle button to the header bar).

The context panel (style panel) should also be togglable via the `S` shortcut. Replace the auto-show-on-select behavior with a keyboard/button toggle.

**Step 2: Commit**

```bash
git add apps/web/src/features/editor-v2/Editor.tsx \
       apps/web/src/features/editor-v2/components/Header.tsx
git commit -m "feat: wire transcript and style panel toggles into editor layout"
```

---

## Task 15: Final Integration Build and Smoke Test

**Files:** None new — verification only.

**Step 1: Build all packages**

Run: `pnpm build`
Expected: All packages build successfully.

**Step 2: Start dev server**

Run: `pnpm start`
Expected: Docker services start, then web/api/worker start in parallel.

**Step 3: Manual smoke test checklist**

- [ ] Open a project with existing captions
- [ ] Captions render with V2 animations (elastic pop instead of simple scale)
- [ ] Old projects with `animation: 'pop'` auto-migrate on load
- [ ] Style panel shows 3 tabs (Viral / Cinematic / Minimal)
- [ ] Clicking a preset applies the full style (font, animation, colors)
- [ ] "Customize" disclosure expands to show full controls
- [ ] Font picker loads fonts from Google Fonts
- [ ] Transcript panel toggles with `T` key
- [ ] Caption text is editable inline in transcript
- [ ] Per-word toolbar appears when clicking a word
- [ ] Display mode switchable with `1`/`2`/`3` keys

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: integration fixes for subtitle system V2"
```

---

## Dependency Graph

```
Task 1 (shared types) ──→ Task 2 (editor types) ──→ Task 7 (migration in store)
         │                        │                          │
         └──→ Task 3 (animation engine) ──→ Task 4 (AnimatedSubtitle)
                    │                              │
                    └──→ Task 5 (Composition.tsx) ──→ Task 12 (VideoComposition)
                    │
         Task 6 (presets) ──→ Task 8 (StylePanel) ──→ Task 9 (font registry)
                                     │
                                     └──→ Task 14 (Editor layout)
                                              │
         Task 10 (TranscriptPanel) ──→ Task 11 (WordToolbar) ──→ Task 13 (shortcuts)
                                                                       │
                                                              Task 15 (integration)
```

**Parallel tracks:**
- **Track A** (Tasks 1→3→4→5→12): Animation engine + renderer integration
- **Track B** (Tasks 1→2→6→7→8→9): Types + presets + StylePanel
- **Track C** (Tasks 2→10→11→13→14): Transcript panel + word toolbar + shortcuts
- **Task 15**: Depends on all tracks completing
