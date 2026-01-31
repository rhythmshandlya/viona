# Animation Quality Standards

## Your Animation Identity

You create PREMIUM, SETTLED animations. Your work feels calm and expensive.
Every animation uses smooth deceleration. Elements glide into place and STAY.
Motion is purposeful - one element moves, completes, then the next begins.

You use high damping values (22+) so elements settle without bouncing.
You stagger elements by 6+ frames so they animate sequentially, not simultaneously.
Text positions remain FIXED after entrance - no wobble, no sway, no oscillation.

---

## Canonical Patterns (USE THESE EXACTLY)

### 1. Text Entrance

Text slides up and settles. Y position NEVER changes after entrance.

```tsx
const textProgress = spring({
  frame: localFrame,
  fps,
  config: { damping: 22, stiffness: 90, mass: 0.9 }
});

const textY = interpolate(textProgress, [0, 1], [40, 0]);
const textOpacity = interpolate(localFrame, [0, 12], [0, 1], {
  extrapolateRight: 'clamp'
});

// Apply to element:
style={{
  opacity: textOpacity,
  transform: `translateY(${textY}px)`
  // NO rotation, NO Math.sin, NO continuous animation
}}
```

### 2. Number Counter

Numbers count up smoothly. No bounce, no overshoot.

```tsx
const counterProgress = interpolate(
  frame,
  [startFrame, startFrame + 45],
  [0, 1],
  { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
);

const displayValue = Math.round(counterProgress * targetValue);
// Renders: 0 → 1 → 2 → ... → targetValue over 45 frames
```

### 3. Staggered Elements

Each element starts 6+ frames after the previous.

```tsx
{items.map((item, index) => {
  const delay = index * 6;  // MINIMUM 6 frames between elements
  const progress = spring({
    frame: Math.max(0, localFrame - delay),
    fps,
    config: { damping: 22, stiffness: 90 }
  });

  const y = interpolate(progress, [0, 1], [30, 0]);
  const opacity = interpolate(
    localFrame - delay,
    [0, 10],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return (
    <div style={{ opacity, transform: `translateY(${y}px)` }}>
      {item}
    </div>
  );
})}
```

### 4. Background Gradient

Subtle hue shift over entire duration. No pulsing, no rapid changes.

```tsx
const hueShift = interpolate(frame, [0, durationInFrames], [0, 15]);
const baseHue = 220;

// Apply to background:
style={{
  background: `linear-gradient(
    135deg,
    hsl(${baseHue + hueShift}, 35%, 12%),
    hsl(${baseHue + hueShift + 20}, 30%, 18%)
  )`
}}
```

---

## Spring Config Standard

Use this config for ALL spring animations:

```tsx
const SPRING_SETTLED = { damping: 22, stiffness: 90, mass: 0.9 };

// Usage:
spring({ frame, fps, config: SPRING_SETTLED })
```

Values explained:
- `damping: 22` - High enough to prevent ANY bounce or overshoot
- `stiffness: 90` - Responsive but not snappy
- `mass: 0.9` - Slightly heavy for elegant deceleration

---

## Quality Checklist (VERIFY BEFORE COMPLETION)

Before finishing, confirm each item:

- [ ] All spring configs have `damping >= 20`
- [ ] Each element's delay differs by `>= 6` frames
- [ ] Text transforms use `extrapolateRight: 'clamp'`
- [ ] NO `Math.sin()` or `Math.cos()` on text positions or rotations
- [ ] NO comments containing "bouncy", "playful", "wiggle", or "shake"
- [ ] Background has subtle frame-based animation (not static)
- [ ] Elements settle and STAY in final position (no continuous motion on text)

If ANY checkbox fails, fix before completing.

---

## Quick Reference

| Element | Animation | Damping | Stagger |
|---------|-----------|---------|---------|
| Title text | Slide up + fade | 22+ | First |
| Subtitle | Slide up + fade | 22+ | +8 frames |
| Numbers | Counter tick-up | N/A (interpolate) | +6 frames |
| Cards/boxes | Scale + fade | 22+ | +6 frames each |
| Background | Hue shift | N/A | Continuous |
