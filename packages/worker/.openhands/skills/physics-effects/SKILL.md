---
triggers:
  - physics
  - gravity
  - bounce
  - squash stretch
  - shake
  - particles
  - explosion
---

# Physics & Effects

Frame-based physics that work with Remotion's rendering model.
All functions are **pure functions of frame number** - no state!

## Ball Physics Simulation

```tsx
const simulateBallPhysics = (
  frame: number,
  dropFrame: number,
  targetY: number,
  fps: number
): { y: number; settled: boolean } => {
  const elapsed = frame - dropFrame;
  if (elapsed < 0) return { y: -100, settled: false };

  const gravity = 0.004;      // Acceleration per frame²
  const bounceDamping = 0.5;  // Energy loss per bounce
  const maxBounces = 4;

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
  return {
    scaleX: 1 - stretch * 0.2,  // Compress horizontally
    scaleY: 1 + stretch * 0.3,  // Stretch vertically
  };
};
```

## Shake Effect

```tsx
const getShake = (frame: number, intensity: number, minDim: number) => {
  if (intensity <= 0) return { x: 0, y: 0 };

  return {
    x: Math.sin(frame * 1.5) * intensity * minDim * 0.008,
    y: Math.cos(frame * 1.8) * intensity * minDim * 0.005,
  };
};
```

## Explosion Particles

```tsx
const generateParticles = (count: number, progress: number, minDim: number) => {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + i * 0.5;
    const velocity = minDim * 0.3 + (i % 5) * minDim * 0.1;
    const size = minDim * 0.015 + (i % 3) * minDim * 0.01;

    return {
      x: Math.cos(angle) * velocity * progress,
      y: Math.sin(angle) * velocity * progress
         - (progress * progress * minDim * 0.2), // gravity
      size: size * (1 - progress * 0.5),
      opacity: 1 - progress,
      rotation: progress * 360 * (i % 2 === 0 ? 1 : -1),
    };
  });
};
```

## Key Principle

**All physics must be deterministic!**
- Frame 100 MUST always produce the same result
- No random() without seed
- No external state
