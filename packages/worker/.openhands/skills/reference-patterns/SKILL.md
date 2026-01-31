---
name: reference-patterns
description: Production-ready animation examples demonstrating meaningful motion. Includes search race, stack overflow, and hash collision visualizations.
triggers:
  - search race
  - stack overflow
  - hash collisions
  - linear binary
  - reference example
  - physics-based
---

# Reference Patterns

## Linear vs Binary Search Race

Two algorithms racing - binary finishes in 4 steps while linear crawls.

```tsx
const linearIndex = Math.min(Math.floor(frame / 10), targetIndex);
const binaryChecks = Math.floor(Math.log2(arrayLength));

// Viewer SEES O(n) vs O(log n)
```

**Elements:** Parallel state machines, check counters, eliminated elements fade, found element glows.

## Stack Overflow with Physics

Frames pile up, memory fills, shake increases, EXPLOSION.

```tsx
const memoryPercent = stackFrames.length / maxFrames;
const shakeIntensity = memoryPercent > 0.7 ? (memoryPercent - 0.7) * 10 : 0;
const barColor = memoryPercent < 0.5 ? '#22c55e'
              : memoryPercent < 0.8 ? '#eab308' : '#ef4444';
```

**Insight:** Viewer FEELS impending crash through increasing chaos.

## Hash Collisions with Gravity

Balls fall into buckets, collisions stack, lookup digs through.

```tsx
const ballsInBucket = balls.filter(b => b.targetBucket === bucketIndex);
const stackHeight = ballsInBucket.length * ballSize;
const scanProgress = interpolate(frame, [startScan, endScan], [0, stackHeight]);
```

**Insight:** Viewer SEES why collisions hurt performance.

## Design System

```tsx
const COLORS = {
  bgDeep: '#0f0f23',
  primary: '#8b5cf6',
  secondary: '#3b82f6',
  accent: '#06b6d4',
  success: '#22c55e',
  warning: '#eab308',
  danger: '#ef4444',
};

const useResponsive = () => {
  const { width, height } = useVideoConfig();
  const minDim = Math.min(width, height);
  return {
    fontSize: { sm: height * 0.022, md: height * 0.032, lg: height * 0.045 },
    padding: minDim * 0.05,
    gap: minDim * 0.03,
  };
};
```
