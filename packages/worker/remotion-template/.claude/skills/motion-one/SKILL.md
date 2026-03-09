---
name: animation-timing
description: Animation timing, easing, and Disney's 12 principles applied to Remotion. Use when choosing spring configs, stagger timing, or designing motion choreography.
---

# Animation Timing & Easing for Remotion

Apply animation principles using `spring()` and `interpolate()` from `'remotion'`. No external libraries.

## Disney's 12 Principles in Remotion

### 1. Squash & Stretch
```tsx
const bounce = spring({ frame: frame - hitFrame, fps, config: { damping: 12, stiffness: 200, mass: 0.8 } });
const scaleX = interpolate(bounce, [0, 0.5, 1], [1, 1.2, 1]);
const scaleY = interpolate(bounce, [0, 0.5, 1], [1, 0.8, 1]);
```

### 2. Anticipation
```tsx
// Wind up before the main action
const antic = interpolate(frame, [0, 8], [0, -10], { extrapolateRight: 'clamp' });
const action = spring({ frame: frame - 8, fps, config: { damping: 18, stiffness: 150, mass: 0.9 } });
const y = frame < 8 ? antic : interpolate(action, [0, 1], [-10, -200]);
```

### 3. Staging — Focus attention
```tsx
// Blur/dim background, scale up hero element
const bgBlur = interpolate(frame, [0, 15], [0, 5], { extrapolateRight: 'clamp' });
const heroScale = spring({ frame, fps, config: { damping: 26, stiffness: 120, mass: 1.0 } });
```

### 4. Follow-Through & Overlapping Action
```tsx
// Main element stops, secondary elements overshoot
const main = spring({ frame, fps, config: { damping: 26, stiffness: 120, mass: 1.0 } });
const trail = spring({ frame: frame - 3, fps, config: { damping: 14, stiffness: 80, mass: 1.1 } }); // lower damping = overshoot
```

### 5. Slow In / Slow Out
```tsx
// Use Easing for non-spring interpolation
import { Easing } from 'remotion';
const progress = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: 'clamp', easing: Easing.inOut(Easing.ease) });
```

### 6. Arcs — Natural curved motion
```tsx
const t = interpolate(frame, [0, 45], [0, 1], { extrapolateRight: 'clamp' });
const x = interpolate(t, [0, 1], [0, 300]);
const y = interpolate(t, [0, 0.5, 1], [0, -120, 0]); // parabolic arc
```

### 7. Exaggeration
```tsx
// Low damping = overshoot for dramatic effect
const dramatic = spring({ frame, fps, config: { damping: 10, stiffness: 200, mass: 0.7 } });
const scale = interpolate(dramatic, [0, 1], [0, 1.5]);
```

## Spring Config Guide

| Feel | damping | stiffness | mass | Use for |
|------|---------|-----------|------|---------|
| SNAPPY | 18 | 180 | 0.8 | Hero reveals, card entrances |
| SMOOTH | 26 | 120 | 1.0 | Default — premium settle |
| BOUNCY | 12 | 200 | 1.0 | Playful, energetic pops |
| HEAVY | 20 | 150 | 1.5 | Text slams, big numbers |
| STIFF | 24 | 300 | 0.6 | Micro-interactions, fast snaps |
| GENTLE | 14 | 80 | 1.2 | Background, ambient elements |

**Rule**: Never use damping < 10 (too bouncy for video).

## Easing Functions

```tsx
import { Easing } from 'remotion';

// Available easings for interpolate():
Easing.linear
Easing.ease           // default CSS ease
Easing.in(Easing.ease)
Easing.out(Easing.ease)
Easing.inOut(Easing.ease)
Easing.bezier(0.25, 0.1, 0.25, 1)  // custom cubic-bezier
Easing.circle         // circular easing
Easing.back(1.5)      // overshoot
Easing.elastic(1)     // elastic bounce
Easing.bounce         // bounce at end
```

## Stagger Timing Patterns

```tsx
const STAGGER = 6;  // Standard: 6 frames between items

// Fast cascade (icons, small items)
const FAST_STAGGER = 4;

// Slow reveal (large cards, paragraphs)
const SLOW_STAGGER = 10;

// Accelerating stagger (items appear faster over time)
const delay = i * Math.max(3, STAGGER - i);
```

## Choreography Pattern

```tsx
// Phase 1: Background/container (frame 0)
// Phase 2: Title (frame 0, fills screen)
// Phase 3: Title settles + content appears (frame keySync)
// Phase 4: Details stagger in (frame keySync + 8, +14, +20...)
// Phase 5: Exit (last 15 frames of scene)

const PHASES = {
  titleSettle: TIMING.sceneNKeySync,
  contentStart: TIMING.sceneNKeySync + 8,
  exitStart: sceneDuration - 15,
};
```
