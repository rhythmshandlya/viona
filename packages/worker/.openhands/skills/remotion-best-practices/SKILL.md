---
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
```

**WHY?** Remotion renders each frame independently. Every value MUST be a pure function of the frame number.

```tsx
// ✅ CORRECT - Pure function of frame
const frame = useCurrentFrame();
const opacity = interpolate(frame, [0, 30], [0, 1]);
```

---

## Core Hooks

### useCurrentFrame()
```tsx
const frame = useCurrentFrame(); // 0-indexed frame number
```

### useVideoConfig()
```tsx
const { width, height, fps, durationInFrames } = useVideoConfig();
```

### interpolate() - ALWAYS use extrapolateRight: 'clamp'
```tsx
const opacity = interpolate(frame, [0, 30], [0, 1], {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',  // REQUIRED!
});
```

### spring() - fps is REQUIRED
```tsx
const { fps } = useVideoConfig();
const scale = spring({
  frame,
  fps,        // REQUIRED!
  config: { damping: 10, stiffness: 100 },
});
```

## Common Animation Patterns

### Staggered List
```tsx
{items.map((item, i) => {
  const delay = i * 5;
  const opacity = interpolate(frame, [delay, delay + 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return <div key={i} style={{ opacity }}>{item}</div>;
})}
```

### Counter Animation
```tsx
const count = Math.floor(interpolate(frame, [0, 90], [0, 1000]));
return <span>{count.toLocaleString()}</span>;
```

## Critical Rules

1. **spring() REQUIRES fps** - Always get fps from `useVideoConfig()`
2. **Only import what you use** - TypeScript strict mode fails on unused imports
3. **Validate TypeScript after each file** - Run TypeScriptValidatorTool frequently
4. **ALWAYS use key prop in .map()** - `{items.map((item, i) => <div key={i}>...</div>)}`
