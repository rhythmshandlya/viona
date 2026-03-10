---
name: animation-patterns
description: Animation patterns for Remotion video compositions. Covers spring entrances, staggered lists, scene transitions, and state-driven animation. Use when implementing animated scenes in Remotion.
---

# Animation Patterns for Remotion

All animations use `spring()`, `interpolate()`, `useCurrentFrame()` from `'remotion'`. No external animation libraries.

## Spring Entrance (Fade + Slide)

```tsx
import { useCurrentFrame, useVideoConfig, spring, interpolate, AbsoluteFill } from 'remotion';

const frame = useCurrentFrame();
const { fps } = useVideoConfig();

const enter = spring({ frame, fps, config: { damping: 26, stiffness: 120, mass: 1.0 } });
const opacity = interpolate(enter, [0, 1], [0, 1]);
const y = interpolate(enter, [0, 1], [30, 0]);

<div style={{ opacity, transform: `translateY(${y}px)` }}>Content</div>
```

## Staggered List

```tsx
const STAGGER = 6; // frames between each item

{items.map((item, i) => {
  const delay = i * STAGGER;
  const enter = spring({ frame: frame - delay, fps, config: { damping: 26, stiffness: 120, mass: 1.0 } });
  const opacity = interpolate(enter, [0, 1], [0, 1]);
  const x = interpolate(enter, [0, 1], [-20, 0]);
  return (
    <div key={i} style={{ opacity, transform: `translateX(${x}px)` }}>
      {item}
    </div>
  );
})}
```

## Exit Animation

```tsx
const exitStart = 90; // frame when exit begins
const exitProgress = interpolate(frame, [exitStart, exitStart + 15], [0, 1], {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
});
const opacity = interpolate(exitProgress, [0, 1], [1, 0]);
const scale = interpolate(exitProgress, [0, 1], [1, 0.95]);

<div style={{ opacity, transform: `scale(${scale})` }}>Exits smoothly</div>
```

## State-Driven Animation (Variants Pattern)

```tsx
// Instead of framer-motion variants, use frame-based conditional interpolation
const isActive = frame >= activateFrame;
const progress = spring({
  frame: frame - activateFrame,
  fps,
  config: { damping: 26, stiffness: 120, mass: 1.0 },
});
const scale = isActive ? interpolate(progress, [0, 1], [0.8, 1]) : 0.8;
const opacity = isActive ? interpolate(progress, [0, 1], [0, 1]) : 0;
```

## Scene Transitions with Sequence

```tsx
import { Sequence, useCurrentFrame, interpolate, AbsoluteFill } from 'remotion';

// Cross-fade between sections within a scene
const fadeOut = interpolate(frame, [transitionStart, transitionStart + 15], [1, 0], {
  extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
});
const fadeIn = interpolate(frame, [transitionStart, transitionStart + 15], [0, 1], {
  extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
});

<AbsoluteFill style={{ opacity: fadeOut }}>Section A</AbsoluteFill>
<AbsoluteFill style={{ opacity: fadeIn }}>Section B</AbsoluteFill>
```

## Scale + Rotate Entrance

```tsx
const enter = spring({ frame, fps, config: { damping: 22, stiffness: 120, mass: 0.8 } });
const scale = interpolate(enter, [0, 1], [0, 1]);
const rotate = interpolate(enter, [0, 1], [-15, 0]);

<div style={{ transform: `scale(${scale}) rotate(${rotate}deg)` }}>Pop in</div>
```

## Orchestrated Multi-Element Animation

```tsx
// Title enters first, then subtitle, then content
const titleEnter = spring({ frame, fps, config: { damping: 26, stiffness: 120, mass: 1.0 } });
const subtitleEnter = spring({ frame: frame - 8, fps, config: { damping: 26, stiffness: 120, mass: 1.0 } });
const contentEnter = spring({ frame: frame - 16, fps, config: { damping: 26, stiffness: 120, mass: 1.0 } });

<div style={{ opacity: interpolate(titleEnter, [0, 1], [0, 1]) }}>Title</div>
<div style={{ opacity: interpolate(subtitleEnter, [0, 1], [0, 1]) }}>Subtitle</div>
<div style={{ opacity: interpolate(contentEnter, [0, 1], [0, 1]) }}>Content</div>
```

## Reusable Technique Components

### Glassmorphism Card
```tsx
const GlassCard: React.FC<{children: React.ReactNode}> = ({children}) => (
  <div style={{
    background: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    padding: 24,
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
  }}>
    {children}
  </div>
);
```

### Particle Emitter
```tsx
const ParticleEmitter: React.FC<{count: number, startFrame: number}> = ({count, startFrame}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return (
    <>
      {Array.from({length: count}).map((_, i) => {
        const delay = i * 6;
        const progress = spring({frame: frame - startFrame - delay, fps, config: {damping: 26, stiffness: 120}});
        const angle = (i / count) * Math.PI * 2;
        const radius = progress * 100;
        return (
          <div key={i} style={{
            position: 'absolute',
            left: `calc(50% + ${Math.cos(angle) * radius}px)`,
            top: `calc(50% + ${Math.sin(angle) * radius}px)`,
            width: 8, height: 8, borderRadius: '50%',
            background: '#8b5cf6',
            opacity: interpolate(progress, [0, 0.8, 1], [0, 1, 0]),
          }} />
        );
      })}
    </>
  );
};
```

### Animated Counter
```tsx
const AnimatedCounter: React.FC<{target: number, startFrame: number, duration?: number}> = ({target, startFrame, duration = 45}) => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame - startFrame, [0, duration], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const value = Math.round(progress * target);
  return <span style={{fontVariantNumeric: 'tabular-nums'}}>{value.toLocaleString()}</span>;
};
```

### Flowing Data Stream
```tsx
const FlowingStream: React.FC<{startFrame: number}> = ({startFrame}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  return (
    <>
      {Array.from({length: 50}).map((_, i) => {
        const speed = 2 + (i % 3);
        const yOffset = (i * 40) % height;
        const x = ((frame - startFrame) * speed + i * 30) % (width + 100) - 50;
        const y = yOffset + Math.sin((frame + i * 10) * 0.02) * 30;
        return (
          <div key={i} style={{
            position: 'absolute', left: x, top: y,
            width: 12 + (i % 8), height: 12 + (i % 8),
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            opacity: 0.6 + (i % 4) * 0.1,
          }} />
        );
      })}
    </>
  );
};
```

### Probability Gate / Spinner
```tsx
const ProbabilityGate: React.FC<{n: number, startFrame: number}> = ({n, startFrame}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const spinProgress = spring({frame: frame - startFrame, fps, config: {damping: 15, stiffness: 80}});
  const rotation = interpolate(spinProgress, [0, 1], [0, 720]);
  return (
    <div style={{
      width: 80, height: 80,
      background: 'linear-gradient(135deg, #22c55e, #3b82f6)',
      borderRadius: 12,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transform: `rotate(${rotation}deg)`,
      boxShadow: '0 4px 20px rgba(34, 197, 94, 0.4)',
    }}>
      <span style={{fontSize: 24, fontWeight: 'bold', color: 'white'}}>1/{n}</span>
    </div>
  );
};
```

## Prohibited Patterns

- EMPTY FRAMES with just background (kills retention)
- Missing `key` prop on children arrays
- `Math.sin/cos` on text rotation/position (jittery text)
- `damping < 20` in spring config (too bouncy)
- All elements animating simultaneously (no stagger)
- Missing `extrapolateLeft: 'clamp'` AND `extrapolateRight: 'clamp'` — BOTH required
- Scenes with no visual metaphor (just text on background)

## Best Practices

1. **Always use `spring()`** for entrances/exits — never hard-coded opacity tweens
2. **Stagger by 6+ frames** — never animate everything at once
3. **Use `extrapolateRight: 'clamp'`** on all `interpolate()` calls
4. **Inline styles only** — no CSS classes, no external styling libraries
5. **`useCurrentFrame()` for timing** — never CSS animations or `@keyframes`
