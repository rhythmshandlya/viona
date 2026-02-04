---
name: remotion-patterns
description: Animation patterns and components for Remotion video generation. Use when creating visual compositions.
user-invocable: false
---

# Remotion Animation Patterns

## Spring Configuration (ALWAYS use this)

```tsx
// In constants.ts
export const SPRING_CONFIG = { damping: 22, stiffness: 90, mass: 0.9 };

// Usage
const progress = spring({
  frame: frame - startFrame,
  fps,
  config: SPRING_CONFIG
});
```

## Scale Entrance Animation

```tsx
const ScaleIn: React.FC<{startFrame: number, children: React.ReactNode}> = ({startFrame, children}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const scale = spring({
    frame: frame - startFrame,
    fps,
    config: SPRING_CONFIG
  });
  return (
    <div style={{transform: `scale(${scale})`}}>
      {children}
    </div>
  );
};
```

## Fade In Animation

```tsx
const FadeIn: React.FC<{startFrame: number, children: React.ReactNode}> = ({startFrame, children}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(
    frame - startFrame,
    [0, 20],
    [0, 1],
    {extrapolateRight: 'clamp'}
  );
  return <div style={{opacity}}>{children}</div>;
};
```

## Staggered List Animation (REQUIRED for multiple elements)

```tsx
const StaggeredList: React.FC<{items: string[], startFrame: number}> = ({items, startFrame}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  return (
    <div>
      {items.map((item, i) => {
        const delay = i * 6; // 6 frame stagger
        const progress = spring({
          frame: frame - startFrame - delay,
          fps,
          config: SPRING_CONFIG
        });
        return (
          <div key={i} style={{
            opacity: progress,
            transform: `translateY(${interpolate(progress, [0, 1], [20, 0])}px)`
          }}>
            {item}
          </div>
        );
      })}
    </div>
  );
};
```

## Glassmorphism Card

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

## Particle Emitter

```tsx
const ParticleEmitter: React.FC<{count: number, startFrame: number}> = ({count, startFrame}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  return (
    <>
      {Array.from({length: count}).map((_, i) => {
        const delay = i * 6;
        const progress = spring({
          frame: frame - startFrame - delay,
          fps,
          config: SPRING_CONFIG
        });
        const angle = (i / count) * Math.PI * 2;
        const radius = progress * 100;
        return (
          <div key={i} style={{
            position: 'absolute',
            left: `calc(50% + ${Math.cos(angle) * radius}px)`,
            top: `calc(50% + ${Math.sin(angle) * radius}px)`,
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#8b5cf6',
            opacity: interpolate(progress, [0, 0.8, 1], [0, 1, 0]),
          }} />
        );
      })}
    </>
  );
};
```

## Flowing Data Stream

```tsx
const FlowingStream: React.FC<{startFrame: number}> = ({startFrame}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();

  const particles = Array.from({length: 30}).map((_, i) => {
    const speed = 2 + (i % 3);
    const yOffset = (i * 40) % height;
    const x = ((frame - startFrame) * speed + i * 50) % (width + 100) - 50;
    const y = yOffset + Math.sin((frame + i * 20) * 0.03) * 50;

    return (
      <div key={i} style={{
        position: 'absolute',
        left: x,
        top: y,
        width: 16,
        height: 16,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
        opacity: 0.7,
      }} />
    );
  });

  return <>{particles}</>;
};
```

## Animated Counter

```tsx
const AnimatedCounter: React.FC<{target: number, startFrame: number, duration?: number}> = ({
  target,
  startFrame,
  duration = 45
}) => {
  const frame = useCurrentFrame();
  const progress = interpolate(
    frame - startFrame,
    [0, duration],
    [0, 1],
    {extrapolateRight: 'clamp'}
  );
  const value = Math.round(progress * target);

  return (
    <span style={{fontVariantNumeric: 'tabular-nums'}}>
      {value.toLocaleString()}
    </span>
  );
};
```

## PROHIBITED Patterns

**NEVER do these:**

1. **No Math.sin on text position** - causes jittery, unreadable text
   ```tsx
   // BAD
   const y = Math.sin(frame * 0.1) * 20;
   <Text style={{top: y}}>Hello</Text>

   // GOOD - use spring instead
   const y = spring({frame, fps, config: SPRING_CONFIG}) * 20;
   ```

2. **No simultaneous animations** - always stagger
   ```tsx
   // BAD - all animate at once
   {items.map((item, i) => <FadeIn startFrame={0}>{item}</FadeIn>)}

   // GOOD - staggered
   {items.map((item, i) => <FadeIn startFrame={i * 6}>{item}</FadeIn>)}
   ```

3. **No low damping** - too bouncy
   ```tsx
   // BAD
   config: { damping: 10 }

   // GOOD
   config: { damping: 22, stiffness: 90, mass: 0.9 }
   ```

4. **No missing clamp** - animation overshoots
   ```tsx
   // BAD
   interpolate(frame, [0, 30], [0, 1])

   // GOOD
   interpolate(frame, [0, 30], [0, 1], {extrapolateRight: 'clamp'})
   ```
