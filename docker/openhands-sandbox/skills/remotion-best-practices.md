# Remotion Best Practices

## ⛔ FORBIDDEN - These BREAK Remotion Rendering

**NEVER use these - they cause flickering, non-deterministic output, or render failures:**

```tsx
// ❌ CSS transitions - FORBIDDEN
style={{ transition: 'all 0.3s ease' }}

// ❌ CSS animations - FORBIDDEN
@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }

// ❌ setTimeout/setInterval - FORBIDDEN
setTimeout(() => setVisible(true), 1000);

// ❌ useState for animation values - FORBIDDEN
const [position, setPosition] = useState(0);

// ❌ Relative to previous frame - FORBIDDEN
position = previousPosition + velocity;
```

**WHY?** Remotion renders each frame independently and in any order. Frame 50 might render
before frame 10. CSS animations and React state don't work because they depend on time
passing or previous renders. Every value MUST be a pure function of the frame number.

**ALWAYS calculate animation values like this:**
```tsx
// ✅ CORRECT - Pure function of frame
const frame = useCurrentFrame();
const opacity = interpolate(frame, [0, 30], [0, 1]);
const position = frame * 2; // position at frame 50 = 100, always!
```

---

## CRITICAL - Common Errors to Avoid

1. **spring() REQUIRES fps** - Always get fps from `useVideoConfig()`:
   ```tsx
   const { fps } = useVideoConfig();
   spring({ frame, fps, config: {...} });  // fps is REQUIRED!
   ```

2. **Only import what you use** - TypeScript strict mode fails on unused imports:
   ```tsx
   // BAD: import { COLORS } from '../constants';  // but never use COLORS
   // GOOD: Only import what you actually use
   ```

3. **Only export what exists in constants** - Check constants.ts before importing:
   ```tsx
   // If constants.ts only has: export const COLORS = { background: '...', primary: '...' }
   // Then COLORS.accent, COLORS.secondary, etc. will cause TypeScript errors
   ```

4. **Validate TypeScript after each file** - Run TypeScriptValidatorTool frequently!

## Core Hooks

### useCurrentFrame()
Returns the current frame number (0-indexed). Use this for all animations.

```tsx
import { useCurrentFrame } from 'remotion';

const MyComponent = () => {
  const frame = useCurrentFrame();
  // frame updates every render
};
```

### useVideoConfig()
Returns video configuration (width, height, fps, durationInFrames).

```tsx
import { useVideoConfig } from 'remotion';

const MyComponent = () => {
  const { width, height, fps, durationInFrames } = useVideoConfig();
};
```

### interpolate()
Maps a value from one range to another. Essential for animations.

**ALWAYS use `extrapolateRight: 'clamp'`** to prevent values from continuing to change after the animation ends!

```tsx
import { interpolate } from 'remotion';

// Fade in over first 30 frames
const opacity = interpolate(frame, [0, 30], [0, 1], {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',  // REQUIRED! Stops at 1, doesn't go to 2, 3, etc.
});

// Move from left to center
const translateX = interpolate(frame, [0, 60], [-100, 0], {
  extrapolateRight: 'clamp',  // REQUIRED! Stops at 0, doesn't go to 100, 200, etc.
});

// ❌ BAD - without clamp, values extrapolate forever:
// At frame 120: interpolate(120, [0, 60], [0, 100]) = 200 (not 100!)
```

### spring()
Physics-based animations with natural feel. **fps is REQUIRED!**

```tsx
import { spring, useVideoConfig } from 'remotion';

const MyComponent = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();  // MUST get fps from useVideoConfig!

  // CORRECT: fps is required parameter
  const scale = spring({
    frame,
    fps,        // REQUIRED - get from useVideoConfig()
    config: {
      damping: 10,      // Lower = more bouncy
      stiffness: 100,   // Higher = faster
      mass: 1,          // Higher = slower
    },
  });

  // WRONG - will cause TypeScript error:
  // const scale = spring({ frame, config: {...} });  // Missing fps!
};
```

## Composition Structure

```tsx
import { Composition } from 'remotion';

export const RemotionRoot = () => {
  return (
    <Composition
      id="MyVideo"
      component={MyVideo}
      durationInFrames={300}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
```

## Sequences and Timing

### <Sequence>
Offset content in time.

```tsx
import { Sequence } from 'remotion';

<Sequence from={30} durationInFrames={60}>
  <Title />
</Sequence>
<Sequence from={90}>
  <Content />
</Sequence>
```

### <AbsoluteFill>
Full-screen container with absolute positioning.

```tsx
import { AbsoluteFill } from 'remotion';

<AbsoluteFill style={{ backgroundColor: '#000' }}>
  <Content />
</AbsoluteFill>
```

## Performance Tips

1. **Memoize expensive calculations**
```tsx
const points = useMemo(() => calculatePoints(data), [data]);
```

2. **Avoid inline objects in style**
```tsx
// Bad - creates new object every frame
<div style={{ transform: `scale(${scale})` }} />

// Good - use CSS variables or pre-calculated
const style = useMemo(() => ({ transform: `scale(${scale})` }), [scale]);
```

3. **Use staticFile() for assets**
```tsx
import { staticFile } from 'remotion';
<Img src={staticFile('logo.png')} />
```

## Common Animation Patterns

### Typewriter Effect
```tsx
const text = "Hello World";
const charsShown = Math.floor(interpolate(frame, [0, 60], [0, text.length]));
return <span>{text.slice(0, charsShown)}</span>;
```

### Counter Animation
```tsx
const count = Math.floor(interpolate(frame, [0, 90], [0, 1000]));
return <span>{count.toLocaleString()}</span>;
```

### Staggered List
```tsx
{items.map((item, i) => {
  const delay = i * 5;
  const opacity = interpolate(frame, [delay, delay + 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return <div style={{ opacity }}>{item}</div>;
})}
```

### Progress Bar
```tsx
const progress = interpolate(frame, [0, durationInFrames], [0, 100]);
return (
  <div style={{ width: '100%', height: 4, background: '#333' }}>
    <div style={{ width: `${progress}%`, height: '100%', background: '#00f' }} />
  </div>
);
```
