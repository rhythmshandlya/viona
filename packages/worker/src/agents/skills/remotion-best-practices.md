# Remotion Best Practices

## Core Patterns

### Animation Basics
```tsx
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';

const MyComponent = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Use interpolate for linear animations
  const opacity = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: 'clamp' });

  // Use spring for physics-based animations
  const scale = spring({ frame, fps, config: { damping: 12, stiffness: 80 } });

  return <div style={{ opacity, transform: `scale(${scale})` }} />;
};
```

### Responsive Sizing (CRITICAL)
All sizes MUST be relative to canvas dimensions:

```tsx
const { width, height } = useVideoConfig();
const minDim = Math.min(width, height);

// Sizes as percentages
const fontSize = height * 0.04;        // 4% of height
const padding = minDim * 0.05;         // 5% of min dimension
const iconSize = minDim * 0.08;        // 8% of min dimension
const borderRadius = minDim * 0.02;    // 2% of min dimension
```

**NEVER use hardcoded pixel values** - they break in different layout modes.

### Sequence Timing
```tsx
import { Sequence } from 'remotion';

// Use Sequence for scene/element timing
<AbsoluteFill>
  <Sequence from={0} durationInFrames={90}>
    <IntroScene />
  </Sequence>
  <Sequence from={90} durationInFrames={120}>
    <MainScene />
  </Sequence>
</AbsoluteFill>
```

## Forbidden Patterns

- ❌ CSS transitions or @keyframes
- ❌ setTimeout/setInterval
- ❌ useState for animation values
- ❌ Hardcoded pixel dimensions
- ❌ Missing key props in .map()

## Required Patterns

- ✅ `useCurrentFrame()` for all animation values
- ✅ `useVideoConfig()` for dimensions
- ✅ `interpolate()` with `extrapolateRight: 'clamp'`
- ✅ `spring()` with appropriate damping
- ✅ Relative sizing with percentages
- ✅ `key` prop on all mapped elements

## Animation Guidelines

### Spring Configurations
| Style | Damping | Stiffness | Use Case |
|-------|---------|-----------|----------|
| Smooth | 20-25 | 50-70 | Subtle, professional |
| Bouncy | 10-15 | 80-100 | Playful, energetic |
| Snappy | 15-18 | 120-150 | Quick, impactful |

### Stagger Timing
- Minimum 8 frames between element entries
- Hero animations: 45+ frames duration
- Hold after key moments: 20+ frames

## Path Animations for Process Flows

```tsx
// Object traveling along a path
const progress = interpolate(frame, [startFrame, endFrame], [0, 1], {
  extrapolateRight: 'clamp'
});

// Bezier curve path
const pathX = interpolate(progress, [0, 0.5, 1], [startX, midX, endX]);
const pathY = interpolate(progress, [0, 0.5, 1], [startY, midY - arcHeight, endY]);

<div style={{
  transform: `translate(${pathX}px, ${pathY}px)`,
  opacity: interpolate(progress, [0, 0.1, 0.9, 1], [0, 1, 1, 0]),
}}>
  {/* Traveling object */}
</div>
```

## Layout Structure

```tsx
<AbsoluteFill style={{ background: COLORS.bg }}>
  <div style={{
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    padding: minDim * 0.04,
    gap: minDim * 0.025,
    boxSizing: 'border-box',
  }}>
    {/* Title Zone - Fixed */}
    <div style={{ flex: '0 0 auto', minHeight: height * 0.08 }}>
      <Title />
    </div>

    {/* Visual Zone - Expands */}
    <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <Diagram />
    </div>

    {/* Caption Zone - Fixed (respect subtitle safe zone) */}
    <div style={{ flex: '0 0 auto', minHeight: height * 0.06 }}>
      <Caption />
    </div>
  </div>
</AbsoluteFill>
```
