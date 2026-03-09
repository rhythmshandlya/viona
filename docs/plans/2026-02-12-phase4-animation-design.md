# Phase 4: Animation System Enhancement

## Overview

Upgrade the subtitle animation system with timing controls, new animation types, and better customization. This phase transforms animations from preset-only to fully controllable, matching professional tools like CapCut and Descript.

## Current State Analysis

### Existing Animation Properties

```typescript
interface AnimationConfig {
  in: AnimationType;      // Entrance animation
  active: AnimationType;  // While word is active
  out: AnimationType;     // Exit animation
  easing: EasingType;     // Easing curve
}
```

**Available animation types (12):**
- Viral: `elastic-pop`, `bounce-up`, `shake`, `color-wipe`, `3d-flip`, `punch`
- Cinematic: `fade-rise`, `typewriter`, `smooth-slide`, `soft-scale`, `underline-wipe`
- None: `none`

**Available easing types (5):**
- `linear`, `ease-out`, `spring`, `elastic`, `bounce`

### Fixed Timing (Hardcoded)

Current timing in `packages/renderer/src/animations/resolve.ts`:
- In phase: First 30% of word duration (max 200ms)
- Active phase: Middle portion
- Out phase: Last 20% of word duration (max 200ms)

### Competitor Capabilities

| Feature | CapCut | Captions | Descript | Current |
|---------|--------|----------|----------|---------|
| In/Out/Active phases | ✓ | ✓ | ✓ | ✓ |
| Duration control | ✓ | ✓ | ✓ | ✗ |
| Delay control | ✓ | - | ✓ | ✗ |
| Easing selection | ✓ | - | ✓ | ✓ |
| Animation intensity | ✓ | - | - | ✗ |
| Stagger/offset | ✓ | - | ✓ | ✗ |
| More animation types | ✓ | ✓ | ✓ | Limited |

### Identified Gaps

1. **No duration control** - Can't adjust animation speed
2. **No intensity control** - Can't make animations more/less dramatic
3. **No stagger control** - Words animate together, not sequentially
4. **Limited animation types** - Missing popular effects (blur, spin, split)
5. **No animation preview** - Must play video to see animations

---

## Phase 4a: Data Model Changes

### Enhanced Animation Config

```typescript
// In packages/shared/src/types/index.ts
// In apps/web/src/features/editor-v2/store/types.ts

// Extended animation types
export type AnimationType =
  | 'none'
  // Viral (existing)
  | 'elastic-pop'
  | 'bounce-up'
  | 'shake'
  | 'color-wipe'
  | '3d-flip'
  | 'punch'
  // Cinematic (existing)
  | 'fade-rise'
  | 'typewriter'
  | 'smooth-slide'
  | 'soft-scale'
  | 'underline-wipe'
  // NEW: Additional types
  | 'blur-in'        // Blur to sharp
  | 'spin'           // Rotate in
  | 'split-reveal'   // Split from center
  | 'drop'           // Fall from above
  | 'rise'           // Rise from below
  | 'zoom-blur'      // Zoom with motion blur
  | 'glitch'         // Digital glitch effect
  | 'wave';          // Wave distortion

// Animation timing configuration
export interface AnimationTiming {
  // Duration of in/out animations (ms)
  inDuration: number;    // 50-500ms, default 150
  outDuration: number;   // 50-500ms, default 100

  // Delay before animation starts (ms)
  inDelay: number;       // 0-200ms, default 0

  // Stagger: delay between each word's animation (ms)
  stagger: number;       // 0-100ms, default 0
}

// Animation intensity/scale
export interface AnimationIntensity {
  // Scale of animation movement (0.5 = subtle, 1 = normal, 2 = dramatic)
  scale: number;         // 0.5-2.0, default 1.0
}

// Complete animation configuration
export interface AnimationConfig {
  // Animation types for each phase
  in: AnimationType;
  active: AnimationType;
  out: AnimationType;

  // Easing curve
  easing: EasingType;

  // NEW: Timing controls
  timing: AnimationTiming;

  // NEW: Intensity
  intensity: AnimationIntensity;
}
```

### Migration from Legacy Format

```typescript
// Old format (may not have timing/intensity):
{
  in: 'elastic-pop',
  active: 'none',
  out: 'none',
  easing: 'spring',
}

// New format with defaults:
{
  in: 'elastic-pop',
  active: 'none',
  out: 'none',
  easing: 'spring',
  timing: {
    inDuration: 150,
    outDuration: 100,
    inDelay: 0,
    stagger: 0,
  },
  intensity: {
    scale: 1.0,
  },
}

function migrateAnimationConfig(legacy: any): AnimationConfig {
  return {
    in: legacy.in ?? 'none',
    active: legacy.active ?? 'none',
    out: legacy.out ?? 'none',
    easing: legacy.easing ?? 'ease-out',
    timing: legacy.timing ?? DEFAULT_ANIMATION_TIMING,
    intensity: legacy.intensity ?? DEFAULT_ANIMATION_INTENSITY,
  };
}
```

### Default Values

```typescript
export const DEFAULT_ANIMATION_TIMING: AnimationTiming = {
  inDuration: 150,
  outDuration: 100,
  inDelay: 0,
  stagger: 0,
};

export const DEFAULT_ANIMATION_INTENSITY: AnimationIntensity = {
  scale: 1.0,
};

export const DEFAULT_ANIMATION_CONFIG: AnimationConfig = {
  in: 'elastic-pop',
  active: 'none',
  out: 'none',
  easing: 'spring',
  timing: DEFAULT_ANIMATION_TIMING,
  intensity: DEFAULT_ANIMATION_INTENSITY,
};
```

---

## Phase 4a: UI Changes

### StylePanel Animation Section

Location: `apps/web/src/features/editor-v2/panels/StylePanel.tsx`

New expanded animation controls:

```
┌─────────────────────────────────────┐
│ ANIMATION                        ▼  │
├─────────────────────────────────────┤
│ In Animation                        │
│ [elastic-pop                    ▼]  │
│                                     │
│ Out Animation                       │
│ [none                           ▼]  │
│                                     │
│ Active Animation                    │
│ [none                           ▼]  │
│                                     │
│ Easing         [spring          ▼]  │
├─────────────────────────────────────┤
│ TIMING                              │
│                                     │
│ In Duration   [───●─────] 150ms     │
│ Out Duration  [──●──────] 100ms     │
│ Delay         [●────────] 0ms       │
│ Stagger       [●────────] 0ms       │
├─────────────────────────────────────┤
│ INTENSITY                           │
│                                     │
│ Scale         [────●────] 1.0x      │
│               Subtle ──── Dramatic  │
└─────────────────────────────────────┘
```

### Animation Type Selector

Grouped dropdown with categories:

```
┌─────────────────────────────────────┐
│ In Animation                        │
│ ┌─────────────────────────────────┐ │
│ │ ▼ Viral                         │ │
│ │   • Elastic Pop                 │ │
│ │   • Bounce Up                   │ │
│ │   • Shake                       │ │
│ │   • Punch                       │ │
│ │   • 3D Flip                     │ │
│ │   • Color Wipe                  │ │
│ │   • Glitch ★                    │ │
│ │ ▼ Cinematic                     │ │
│ │   • Fade Rise                   │ │
│ │   • Smooth Slide                │ │
│ │   • Soft Scale                  │ │
│ │   • Typewriter                  │ │
│ │   • Blur In ★                   │ │
│ │ ▼ Dynamic                       │ │
│ │   • Spin ★                      │ │
│ │   • Drop ★                      │ │
│ │   • Rise ★                      │ │
│ │   • Wave ★                      │ │
│ │   • Zoom Blur ★                 │ │
│ │   • Split Reveal ★              │ │
│ │ ─────────────────               │ │
│ │   • None                        │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
(★ = new in this phase)
```

### Control Specifications

#### Animation Type Dropdowns

| Control | Options | Default |
|---------|---------|---------|
| In Animation | All 20 types | elastic-pop |
| Out Animation | All 20 types | none |
| Active Animation | All 20 types | none |
| Easing | 5 easing types | spring |

#### Timing Controls

| Control | Range | Step | Default |
|---------|-------|------|---------|
| In Duration | 50-500ms | 10 | 150ms |
| Out Duration | 50-500ms | 10 | 100ms |
| Delay | 0-200ms | 10 | 0ms |
| Stagger | 0-100ms | 5 | 0ms |

#### Intensity Control

| Control | Range | Step | Default |
|---------|-------|------|---------|
| Scale | 0.5-2.0 | 0.1 | 1.0 |

Display labels: 0.5 = "Subtle", 1.0 = "Normal", 2.0 = "Dramatic"

---

## Phase 4a: New Animation Implementations

### New Animations to Add

Location: `packages/renderer/src/animations/animations.ts`

```typescript
// blur-in: Text starts blurred, sharpens into focus
export const blurIn: AnimationFn = (phase, progress, eased) => {
  if (phase === 'in') {
    const blur = (1 - eased) * 10;  // 10px to 0px
    return {
      filter: `blur(${blur}px)`,
      opacity: eased,
    };
  }
  return {};
};

// spin: Rotate in from angle
export const spin: AnimationFn = (phase, progress, eased) => {
  if (phase === 'in') {
    const rotation = (1 - eased) * 180;  // 180deg to 0deg
    return {
      transform: `rotate(${rotation}deg) scale(${eased})`,
      opacity: eased,
    };
  }
  if (phase === 'out') {
    const rotation = eased * -180;
    return {
      transform: `rotate(${rotation}deg) scale(${1 - eased})`,
      opacity: 1 - eased,
    };
  }
  return {};
};

// drop: Fall from above with bounce
export const drop: AnimationFn = (phase, progress, eased) => {
  if (phase === 'in') {
    const y = (1 - eased) * -50;  // -50px to 0
    return {
      transform: `translateY(${y}px)`,
      opacity: eased,
    };
  }
  return {};
};

// rise: Rise from below
export const rise: AnimationFn = (phase, progress, eased) => {
  if (phase === 'in') {
    const y = (1 - eased) * 50;  // 50px to 0
    return {
      transform: `translateY(${y}px)`,
      opacity: eased,
    };
  }
  return {};
};

// zoom-blur: Zoom with motion blur
export const zoomBlur: AnimationFn = (phase, progress, eased) => {
  if (phase === 'in') {
    const scale = 0.5 + (eased * 0.5);  // 0.5 to 1
    const blur = (1 - eased) * 5;
    return {
      transform: `scale(${scale})`,
      filter: `blur(${blur}px)`,
      opacity: eased,
    };
  }
  return {};
};

// glitch: Digital glitch with offset
export const glitch: AnimationFn = (phase, progress, eased) => {
  if (phase === 'in' || phase === 'active') {
    const offset = Math.random() * 4 - 2;  // -2 to 2px random
    const skew = Math.random() * 2 - 1;    // -1 to 1deg
    return {
      transform: `translate(${offset}px, ${offset}px) skewX(${skew}deg)`,
      opacity: phase === 'in' ? eased : 1,
    };
  }
  return {};
};

// wave: Vertical wave motion
export const wave: AnimationFn = (phase, progress, eased) => {
  if (phase === 'active') {
    const y = Math.sin(progress * Math.PI * 4) * 3;  // Oscillate
    return {
      transform: `translateY(${y}px)`,
    };
  }
  if (phase === 'in') {
    return { opacity: eased };
  }
  return {};
};

// split-reveal: Split from center
export const splitReveal: AnimationFn = (phase, progress, eased) => {
  if (phase === 'in') {
    // Clip path reveals from center
    const clip = 50 - (eased * 50);  // 50% to 0%
    return {
      clipPath: `inset(0 ${clip}% 0 ${clip}%)`,
      opacity: 1,
    };
  }
  return {};
};
```

### Animation Registry Update

```typescript
export const ANIMATIONS: Record<AnimationType, AnimationFn> = {
  // Existing
  'none': none,
  'elastic-pop': elasticPop,
  'bounce-up': bounceUp,
  'shake': shake,
  'color-wipe': colorWipe,
  '3d-flip': flip3d,
  'punch': punch,
  'fade-rise': fadeRise,
  'typewriter': typewriter,
  'smooth-slide': smoothSlide,
  'soft-scale': softScale,
  'underline-wipe': underlineWipe,
  // NEW
  'blur-in': blurIn,
  'spin': spin,
  'drop': drop,
  'rise': rise,
  'zoom-blur': zoomBlur,
  'glitch': glitch,
  'wave': wave,
  'split-reveal': splitReveal,
};
```

---

## Phase 4a: Animation Resolver Updates

### Update resolveAnimation

Location: `packages/renderer/src/animations/resolve.ts`

```typescript
export function resolveAnimation(
  config: AnimationConfig,
  context: WordTimingContext
): { style: React.CSSProperties } {
  const {
    in: inAnim,
    active: activeAnim,
    out: outAnim,
    easing,
    timing,
    intensity,
  } = config;

  const {
    elapsedMs,
    wordDurationMs,
    isActive,
    hasAppeared,
    isFuture,
    wordIndex,  // NEW: for stagger calculation
  } = context;

  // Apply stagger delay per word
  const staggerDelay = (wordIndex ?? 0) * (timing?.stagger ?? 0);
  const adjustedElapsed = elapsedMs - staggerDelay;

  // Use configurable durations (with fallbacks)
  const inDuration = timing?.inDuration ?? 150;
  const outDuration = timing?.outDuration ?? 100;
  const inDelay = timing?.inDelay ?? 0;

  // Calculate phase based on timing
  const inEndMs = inDelay + inDuration;
  const outStartMs = wordDurationMs - outDuration;

  let phase: 'in' | 'active' | 'out' | 'future' | 'past';
  let progress: number;

  if (isFuture || adjustedElapsed < inDelay) {
    phase = 'future';
    progress = 0;
  } else if (adjustedElapsed < inEndMs) {
    phase = 'in';
    progress = (adjustedElapsed - inDelay) / inDuration;
  } else if (adjustedElapsed < outStartMs) {
    phase = 'active';
    progress = (adjustedElapsed - inEndMs) / (outStartMs - inEndMs);
  } else if (adjustedElapsed < wordDurationMs) {
    phase = 'out';
    progress = (adjustedElapsed - outStartMs) / outDuration;
  } else {
    phase = 'past';
    progress = 1;
  }

  // Get easing function
  const easingFn = EASINGS[easing] ?? EASINGS['ease-out'];
  const eased = easingFn(Math.max(0, Math.min(1, progress)));

  // Get animation function
  const animType = phase === 'in' ? inAnim
    : phase === 'active' ? activeAnim
    : phase === 'out' ? outAnim
    : 'none';

  const animFn = ANIMATIONS[animType] ?? ANIMATIONS['none'];

  // Apply intensity scaling
  const intensityScale = intensity?.scale ?? 1.0;
  const rawStyle = animFn(phase, progress, eased, intensityScale);

  return { style: rawStyle };
}
```

### Update Animation Functions for Intensity

```typescript
// Example: elastic-pop with intensity
export const elasticPop: AnimationFn = (phase, progress, eased, intensity = 1) => {
  if (phase === 'in') {
    // Scale overshoot affected by intensity
    const overshoot = 0.2 * intensity;  // 20% overshoot at intensity 1
    const scale = eased * (1 + overshoot) - (overshoot * eased * eased);
    return {
      transform: `scale(${scale})`,
      opacity: eased,
    };
  }
  return {};
};
```

---

## Phase 4b: Server Rendering Updates

### AnimatedSubtitle.tsx Updates

Location: `packages/renderer/src/components/AnimatedSubtitle.tsx`

Ensure timing and intensity are passed through:

```typescript
// In Word component
const { style: animStyle } = resolveAnimation(animConfig, {
  elapsedMs: Math.max(0, elapsedMs),
  wordDurationMs,
  isActive,
  hasAppeared: hasAppeared && !isActive,
  isFuture: !hasAppeared,
  wordIndex: index,  // Pass word index for stagger
});
```

---

## Preset Updates

### Update presets with timing

```typescript
'mrbeast-bold': {
  // ... existing ...
  animation: {
    in: 'elastic-pop',
    active: 'none',
    out: 'none',
    easing: 'spring',
    timing: { inDuration: 180, outDuration: 100, inDelay: 0, stagger: 0 },
    intensity: { scale: 1.2 },  // Slightly more dramatic
  },
},

'hormozi': {
  // ... existing ...
  animation: {
    in: 'punch',
    active: 'none',
    out: 'none',
    easing: 'spring',
    timing: { inDuration: 120, outDuration: 80, inDelay: 0, stagger: 30 },  // Staggered words
    intensity: { scale: 1.5 },  // Very punchy
  },
},

'cinema-fade': {
  // ... existing ...
  animation: {
    in: 'fade-rise',
    active: 'none',
    out: 'fade-rise',
    easing: 'ease-out',
    timing: { inDuration: 250, outDuration: 200, inDelay: 0, stagger: 0 },  // Slower, elegant
    intensity: { scale: 0.7 },  // Subtle
  },
},

'glitch-out': {
  // ... existing ...
  animation: {
    in: 'glitch',  // NEW animation type
    active: 'glitch',
    out: 'glitch',
    easing: 'linear',
    timing: { inDuration: 100, outDuration: 100, inDelay: 0, stagger: 0 },
    intensity: { scale: 1.0 },
  },
},
```

---

## Animation Categories for UI

```typescript
export const ANIMATION_CATEGORIES = {
  viral: {
    label: 'Viral',
    animations: ['elastic-pop', 'bounce-up', 'shake', 'punch', '3d-flip', 'color-wipe', 'glitch'],
  },
  cinematic: {
    label: 'Cinematic',
    animations: ['fade-rise', 'smooth-slide', 'soft-scale', 'typewriter', 'blur-in', 'underline-wipe'],
  },
  dynamic: {
    label: 'Dynamic',
    animations: ['spin', 'drop', 'rise', 'wave', 'zoom-blur', 'split-reveal'],
  },
};

export const ANIMATION_LABELS: Record<AnimationType, string> = {
  'none': 'None',
  'elastic-pop': 'Elastic Pop',
  'bounce-up': 'Bounce Up',
  'shake': 'Shake',
  'color-wipe': 'Color Wipe',
  '3d-flip': '3D Flip',
  'punch': 'Punch',
  'fade-rise': 'Fade Rise',
  'typewriter': 'Typewriter',
  'smooth-slide': 'Smooth Slide',
  'soft-scale': 'Soft Scale',
  'underline-wipe': 'Underline Wipe',
  'blur-in': 'Blur In',
  'spin': 'Spin',
  'drop': 'Drop',
  'rise': 'Rise',
  'zoom-blur': 'Zoom Blur',
  'glitch': 'Glitch',
  'wave': 'Wave',
  'split-reveal': 'Split Reveal',
};
```

---

## Testing Checklist

### Unit Tests
- [ ] Animation migration preserves existing behavior
- [ ] New animations render without errors
- [ ] Timing calculations handle edge cases
- [ ] Stagger applies correctly per word
- [ ] Intensity scales animation parameters

### Integration Tests
- [ ] Animation type dropdowns work
- [ ] Duration sliders affect animation speed
- [ ] Delay slider adds pause before animation
- [ ] Stagger creates word-by-word cascade
- [ ] Intensity slider adjusts animation scale
- [ ] Easing dropdown changes animation feel

### Render Parity Tests
- [ ] Export with custom in duration (300ms)
- [ ] Export with stagger (50ms)
- [ ] Export with intensity 1.5x
- [ ] Export with new animation types
- [ ] Compare preview to export frame

### Visual Quality Tests
- [ ] Animations feel smooth at all durations
- [ ] Stagger looks natural
- [ ] Intensity scaling doesn't break animations
- [ ] New animations look polished

---

## Files to Modify

### Phase 4a (Client)

| File | Changes |
|------|---------|
| `packages/shared/src/types/index.ts` | Add `AnimationTiming`, `AnimationIntensity`, update `AnimationConfig`, add new `AnimationType`s |
| `apps/web/src/features/editor-v2/store/types.ts` | Mirror type changes |
| `apps/web/src/features/editor-v2/panels/StylePanel.tsx` | New animation section with timing/intensity controls |
| `apps/web/src/features/editor-v2/player/Composition.tsx` | Pass timing context to resolver |
| `apps/web/src/lib/subtitle-presets.ts` | Update preset animation configs |

### Phase 4a (Renderer - shared)

| File | Changes |
|------|---------|
| `packages/renderer/src/animations/types.ts` | Add types, new animation types |
| `packages/renderer/src/animations/animations.ts` | Add 8 new animation functions |
| `packages/renderer/src/animations/resolve.ts` | Update resolver for timing/intensity/stagger |

### Phase 4b (Server)

| File | Changes |
|------|---------|
| `packages/renderer/src/components/AnimatedSubtitle.tsx` | Pass wordIndex for stagger |

---

## Backward Compatibility

1. **Missing timing**: Defaults applied (150ms in, 100ms out)
2. **Missing intensity**: Defaults to 1.0 (no change)
3. **Old animation configs**: Work unchanged (timing/intensity optional)
4. **Existing projects**: Render identically

---

## Success Criteria

1. User can adjust animation in/out duration
2. User can add delay before animation starts
3. User can enable stagger for word-by-word cascade
4. User can adjust animation intensity (subtle to dramatic)
5. 8 new animation types available
6. Animations grouped by category in dropdown
7. Exported video matches client preview
8. Existing projects render identically

---

## Estimated Scope

- **Type changes**: ~60 lines
- **New animations**: ~150 lines
- **Resolver updates**: ~80 lines
- **UI changes**: ~200 lines
- **Presets**: ~50 lines
- **Total**: ~540 lines of changes
