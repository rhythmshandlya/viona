---
name: physics-effects
description: Frame-based physics simulations for Remotion. Includes gravity, bounce, squash/stretch, shake, and particle effects.
triggers:
  - physics
  - gravity
  - bounce
  - squash stretch
  - shake
  - particles
  - explosion
---

# Physics Effects

All physics must be **pure functions of frame** - deterministic, no state.

## Ball Physics

```tsx
const simulateBallPhysics = (
  frame: number, dropFrame: number, targetY: number, fps: number
): { y: number; settled: boolean } => {
  const elapsed = frame - dropFrame;
  if (elapsed < 0) return { y: -100, settled: false };

  const gravity = 0.004, bounceDamping = 0.5, maxBounces = 4;
  let y = 0, velocity = 0, bounces = 0;

  for (let t = 0; t < elapsed; t++) {
    velocity += gravity;
    y += velocity;
    if (y >= targetY) {
      y = targetY;
      velocity = -velocity * bounceDamping;
      bounces++;
      if (bounces >= maxBounces || Math.abs(velocity) < 0.02) {
        return { y: targetY, settled: true };
      }
    }
  }
  return { y: Math.min(y, targetY), settled: false };
};
```

## Squash & Stretch

```tsx
const getSquashStretch = (velocity: number, settled: boolean) => {
  if (settled) return { scaleX: 1, scaleY: 1 };
  const stretch = Math.min(velocity * 0.02, 0.3);
  return { scaleX: 1 - stretch * 0.2, scaleY: 1 + stretch * 0.3 };
};
```

## Shake

```tsx
const getShake = (frame: number, intensity: number, minDim: number) => ({
  x: Math.sin(frame * 1.5) * intensity * minDim * 0.008,
  y: Math.cos(frame * 1.8) * intensity * minDim * 0.005,
});
```

## Particles

```tsx
const generateParticles = (count: number, progress: number, minDim: number) =>
  Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + i * 0.5;
    const velocity = minDim * 0.3 + (i % 5) * minDim * 0.1;
    return {
      x: Math.cos(angle) * velocity * progress,
      y: Math.sin(angle) * velocity * progress - progress * progress * minDim * 0.2,
      opacity: 1 - progress,
    };
  });
```

## Rules

- Frame N must always produce same result
- No `Math.random()` without seed
- No external state
