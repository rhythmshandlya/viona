---
name: remotion-best-practices
description: Frame-based animation patterns for Remotion video compositions. Covers hooks, interpolation, springs, and forbidden patterns that break rendering.
triggers:
  - remotion
  - video composition
  - frame animation
  - useCurrentFrame
  - useVideoConfig
  - interpolate
  - spring
---

# Remotion Best Practices

## Forbidden Patterns (Break Rendering)

```tsx
// ❌ CSS transitions/animations - non-deterministic
style={{ transition: 'all 0.3s ease' }}
@keyframes fadeIn { ... }

// ❌ Timers/state for animation - non-deterministic
setTimeout(() => setVisible(true), 1000);
const [position, setPosition] = useState(0);
```

Remotion renders each frame independently. Every value MUST be a pure function of frame number.

## Core Hooks

```tsx
const frame = useCurrentFrame();
const { width, height, fps, durationInFrames } = useVideoConfig();

// interpolate - ALWAYS use clamp
const opacity = interpolate(frame, [0, 30], [0, 1], {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
});

// spring - fps REQUIRED
const scale = spring({ frame, fps, config: { damping: 10, stiffness: 100 } });
```

## Common Patterns

```tsx
// Staggered list
{items.map((item, i) => {
  const delay = i * 5;
  const opacity = interpolate(frame, [delay, delay + 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return <div key={i} style={{ opacity }}>{item}</div>;
})}

// Counter animation
const count = Math.floor(interpolate(frame, [0, 90], [0, 1000]));
```

## Rules

1. `spring()` requires fps from `useVideoConfig()`
2. Only import what you use (strict mode)
3. Always use `key` prop in `.map()`
4. Run TypeScript validation frequently
