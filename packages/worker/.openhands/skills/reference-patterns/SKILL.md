---
triggers:
  - search race
  - stack overflow
  - hash collisions
  - linear binary
  - reference example
  - physics-based
---

# Reference Visual Patterns

Production-ready examples demonstrating meaningful animation principles.

## Pattern 1: Linear vs Binary Search Race

**Concept:** Two algorithms racing - binary finishes in 4 steps while linear crawls.

**Key Elements:**
- Parallel state machines (linear at top, binary at bottom)
- Check counters showing comparison count
- Eliminated elements fade/shrink
- Found element scales up with glow

```tsx
// State progression
const linearIndex = Math.min(Math.floor(frame / 10), targetIndex);
const binaryChecks = Math.floor(Math.log2(arrayLength));

// Visual contrast
const linearProgress = linearIndex / arrayLength;  // Slow
const binaryProgress = 1;  // Already done!
```

**Meaningful Insight:** Viewer SEES O(n) vs O(log n) difference.

---

## Pattern 2: Stack Overflow with Physics

**Concept:** Frames pile up, memory fills, shake increases, EXPLOSION.

**Key Elements:**
- Staggered frame entrance (stack grows)
- Memory bar filling with color transition
- Shake intensity based on memory pressure
- Explosion particles with gravity when crash

```tsx
// Memory pressure visualization
const memoryPercent = stackFrames.length / maxFrames;
const shakeIntensity = memoryPercent > 0.7 ? (memoryPercent - 0.7) * 10 : 0;
const barColor = memoryPercent < 0.5 ? '#22c55e'
              : memoryPercent < 0.8 ? '#eab308'
              : '#ef4444';
```

**Meaningful Insight:** Viewer FEELS impending crash through increasing chaos.

---

## Pattern 3: Hash Collisions with Gravity

**Concept:** Balls fall into buckets, collisions stack up, lookup digs through.

**Key Elements:**
- Ball physics (gravity + bounce)
- Collision bucket fills up visually
- Scanner animation digging through collisions
- O(1) vs O(n) indicator at end

```tsx
// Balls physically stack at collision point
const ballsInBucket = balls.filter(b => b.targetBucket === bucketIndex);
const stackHeight = ballsInBucket.length * ballSize;

// Scanner shows lookup cost
const scanProgress = interpolate(frame, [startScan, endScan], [0, stackHeight]);
```

**Meaningful Insight:** Viewer SEES why hash collisions hurt performance.

---

## Design System Constants

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

// Responsive helper
const useResponsive = () => {
  const { width, height } = useVideoConfig();
  const minDim = Math.min(width, height);
  return {
    fontSize: { sm: height * 0.022, md: height * 0.032, lg: height * 0.045 },
    padding: minDim * 0.05,
    gap: minDim * 0.03,
    borderRadius: minDim * 0.02,
  };
};
```
