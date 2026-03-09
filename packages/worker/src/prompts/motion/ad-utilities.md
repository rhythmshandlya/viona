## Ad Motion Utilities (Copy-Paste Ready)

### Smooth Fade + Blur (Apple Signature)
```tsx
// Fade in with blur dissolve — Apple's signature transition
const fadeBlurIn = (frame: number, startFrame: number, duration = 30) => {
  const progress = interpolate(frame, [startFrame, startFrame + duration], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
  return {
    opacity: progress,
    filter: `blur(${(1 - progress) * 4}px)`,
  };
};
```

### Material Slide-Up (Google Signature)
```tsx
// Slide up with fade — Google Material motion
const slideUpIn = (frame: number, startFrame: number, fps: number) => {
  const progress = spring({ frame: frame - startFrame, fps, config: { damping: 18, stiffness: 100 } });
  return {
    opacity: progress,
    transform: `translateY(${(1 - progress) * 16}px)`,
  };
};
```

### Staggered Entrance Helper
```tsx
// Stagger multiple elements with consistent timing
const stagger = (index: number, baseDelay: number, staggerFrames: number) => {
  return baseDelay + index * staggerFrames;
};

// Usage: elements.map((el, i) => {
//   const delay = stagger(i, 10, 12); // Google: 12-frame stagger
//   const style = slideUpIn(frame, delay, fps);
//   return <div key={i} style={style}>{el}</div>;
// })
```

### Scale Settle (Apple)
```tsx
// Scale from 0.95 to 1.0 — subtle settle, never overshoots
const scaleSettle = (frame: number, startFrame: number, fps: number) => {
  const progress = spring({ frame: frame - startFrame, fps, config: { damping: 30, stiffness: 40 } });
  const scale = interpolate(progress, [0, 1], [0.95, 1]);
  return {
    transform: `scale(${scale})`,
    opacity: progress,
  };
};
```

### Elevation Shadow (Google Material)
```tsx
// Animated elevation — card rises into view with growing shadow
const elevationShadow = (progress: number, level: 1 | 2 | 3 = 2) => {
  const shadows: Record<number, string> = {
    1: `0 ${1 * progress}px ${3 * progress}px rgba(0,0,0,${0.08 * progress})`,
    2: `0 ${2 * progress}px ${8 * progress}px rgba(0,0,0,${0.1 * progress})`,
    3: `0 ${4 * progress}px ${16 * progress}px rgba(0,0,0,${0.15 * progress})`,
  };
  return { boxShadow: shadows[level] };
};
```

### Animated Number Counter
```tsx
// Count from 0 to target — great for stats and metrics
const animatedCount = (frame: number, startFrame: number, target: number, duration = 60) => {
  const progress = interpolate(frame, [startFrame, startFrame + duration], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
  return Math.round(progress * target);
};
// Usage: <span>{animatedCount(frame, 30, 1000000)}</span>
```