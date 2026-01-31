# Motion Graphics Cookbook

## CRITICAL: No Simple Fades

**Every animation must involve MOVEMENT, not just opacity.**

❌ BANNED: `opacity: 0 → 1` alone
✅ REQUIRED: Scale, position, rotation, blur, or stroke animation

If you catch yourself writing just a fade, STOP and choose a technique from this cookbook.

---

# Element Entrances

## 1. Scale with Overshoot (Primary Choice)

The most versatile entrance. Element grows from nothing with a satisfying bounce.

```tsx
const scale = spring({
  frame: frame - delay,
  fps,
  config: { damping: 10, stiffness: 100, mass: 0.5 },
});

<div style={{
  transform: `scale(${scale})`,
  opacity: scale, // Opacity follows scale, not separate
}} />
```

**When to use:** Hero elements, titles, key numbers, icons
**Timing:** 15-25 frames (0.5-0.8s)
**Config variations:**
- Bouncy: `{ damping: 8, stiffness: 150, mass: 0.3 }`
- Smooth: `{ damping: 15, stiffness: 80, mass: 0.8 }`
- Snappy: `{ damping: 20, stiffness: 200, mass: 0.2 }`

---

## 2. Slide with Bounce

Element enters from off-screen with momentum.

```tsx
const y = spring({
  frame: frame - delay,
  fps,
  config: { damping: 12, stiffness: 200 },
  from: 100,  // Start 100px below
  to: 0,
});

const opacity = interpolate(frame - delay, [0, 10], [0, 1], {
  extrapolateRight: 'clamp',
});

<div style={{
  transform: `translateY(${y}px)`,
  opacity,
}} />
```

**Directions:**
- From bottom: `from: 100, to: 0` with `translateY`
- From top: `from: -100, to: 0` with `translateY`
- From left: `from: -100, to: 0` with `translateX`
- From right: `from: 100, to: 0` with `translateX`

**When to use:** Lists, cards, sequential content, secondary elements
**Timing:** 12-20 frames

---

## 3. Draw/Stroke Reveal

For lines, shapes, borders - element draws itself into existence.

```tsx
// First, get the path length (measure once, use as constant)
const pathLength = 500; // or measure with ref

const strokeProgress = interpolate(frame - delay, [0, 30], [pathLength, 0], {
  extrapolateRight: 'clamp',
});

<svg width={width} height={height}>
  <path
    d="M10,50 Q50,10 90,50 T170,50"
    fill="none"
    stroke="#3b82f6"
    strokeWidth={3}
    strokeDasharray={pathLength}
    strokeDashoffset={strokeProgress}
    strokeLinecap="round"
  />
</svg>
```

**When to use:** Connections, graphs, icons, underlines, borders
**Timing:** 20-40 frames (longer = more dramatic)

---

## 4. Blur to Sharp (Cinematic)

Element starts blurry and focuses into clarity.

```tsx
const blur = interpolate(frame - delay, [0, 20], [15, 0], {
  extrapolateRight: 'clamp',
});

const scale = interpolate(frame - delay, [0, 20], [1.1, 1], {
  extrapolateRight: 'clamp',
});

const opacity = interpolate(frame - delay, [0, 10], [0, 1], {
  extrapolateRight: 'clamp',
});

<div style={{
  filter: `blur(${blur}px)`,
  transform: `scale(${scale})`,
  opacity,
}} />
```

**When to use:** Hero moments, reveals, transitions between concepts
**Timing:** 15-25 frames

---

## 5. Counter/Number Tick-Up

Numbers should NEVER appear instantly. Always count up.

```tsx
const targetNumber = 1250000;

const progress = spring({
  frame: frame - delay,
  fps,
  config: { damping: 50, stiffness: 100, mass: 1 },
});

const displayNumber = Math.floor(targetNumber * progress);

// Format with commas
const formatted = displayNumber.toLocaleString();

<span style={{ fontVariantNumeric: 'tabular-nums' }}>
  {formatted}
</span>
```

**Variations:**
- Percentage: `${Math.floor(progress * 100)}%`
- Currency: `$${displayNumber.toLocaleString()}`
- Decimal: `(targetNumber * progress).toFixed(2)`

**When to use:** ANY number display - stats, metrics, prices, percentages
**Timing:** 30-60 frames (numbers deserve time)

---

## 6. Typewriter/Character Reveal

Text appears character by character.

```tsx
const text = "Important Message";
const charsToShow = Math.floor(
  interpolate(frame - delay, [0, text.length * 2], [0, text.length], {
    extrapolateRight: 'clamp',
  })
);

<span>{text.slice(0, charsToShow)}</span>
```

**When to use:** Titles, callouts, emphasis text
**Timing:** 2-3 frames per character

---

# Dynamic Backgrounds

## RULE: Backgrounds must NEVER be static

Every scene needs at least one of these background techniques.

---

## 1. Floating Particles

Subtle particles that drift and float.

```tsx
const Particle: React.FC<{
  x: number;
  y: number;
  size: number;
  delay: number;
  color: string;
}> = ({ x, y, size, delay, color }) => {
  const frame = useCurrentFrame();

  // Vertical float
  const float = Math.sin((frame + delay) * 0.03) * 30;

  // Horizontal drift
  const drift = Math.sin((frame + delay) * 0.02 + delay) * 20;

  // Pulse opacity
  const opacity = interpolate(
    Math.sin((frame + delay) * 0.05),
    [-1, 1],
    [0.2, 0.5]
  );

  return (
    <div
      style={{
        position: 'absolute',
        left: x + drift,
        top: y + float,
        width: size,
        height: size,
        borderRadius: '50%',
        background: color,
        opacity,
        filter: `blur(${size / 3}px)`,
      }}
    />
  );
};

// Generate 15-30 particles across the canvas
const particles = Array.from({ length: 20 }, (_, i) => ({
  x: Math.random() * 1920,
  y: Math.random() * 1080,
  size: 10 + Math.random() * 40,
  delay: i * 10,
  color: 'rgba(255, 255, 255, 0.3)',
}));
```

**When to use:** Any scene - particles add life without distraction
**Intensity:** 15-30 particles for subtle, 50+ for prominent

---

## 2. Gradient Shift

Background gradient that slowly evolves.

```tsx
const { durationInFrames } = useVideoConfig();

// Hue rotation over time
const hue1 = interpolate(frame, [0, durationInFrames], [220, 260]);
const hue2 = interpolate(frame, [0, durationInFrames], [280, 320]);

// Position shift
const angle = interpolate(frame, [0, durationInFrames], [135, 180]);

<AbsoluteFill
  style={{
    background: `linear-gradient(
      ${angle}deg,
      hsl(${hue1}, 70%, 15%),
      hsl(${hue2}, 60%, 25%)
    )`,
  }}
/>
```

**Variations:**
- Radial: `radial-gradient(circle at ${x}% ${y}%, ...)`
- Multi-stop: Add more color stops for complexity

---

## 3. Flowing Wave Lines

Animated SVG waves that flow across the screen.

```tsx
const Wave: React.FC<{
  yOffset: number;
  amplitude: number;
  frequency: number;
  speed: number;
  color: string;
  strokeWidth: number;
}> = ({ yOffset, amplitude, frequency, speed, color, strokeWidth }) => {
  const frame = useCurrentFrame();

  const points = Array.from({ length: 50 }, (_, i) => {
    const x = (i / 49) * 1920;
    const y = yOffset + Math.sin((i * frequency) + frame * speed) * amplitude;
    return `${x},${y}`;
  }).join(' ');

  return (
    <polyline
      points={points}
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
    />
  );
};

// Layer multiple waves
<svg width={1920} height={1080} style={{ position: 'absolute' }}>
  <Wave yOffset={800} amplitude={50} frequency={0.1} speed={0.05} color="rgba(99,102,241,0.3)" strokeWidth={2} />
  <Wave yOffset={850} amplitude={30} frequency={0.15} speed={0.03} color="rgba(139,92,246,0.2)" strokeWidth={1.5} />
  <Wave yOffset={900} amplitude={40} frequency={0.08} speed={0.04} color="rgba(6,182,212,0.25)" strokeWidth={2} />
</svg>
```

---

## 4. Pulsing Grid

Geometric grid that breathes.

```tsx
const gridOpacity = interpolate(
  Math.sin(frame * 0.05),
  [-1, 1],
  [0.03, 0.1]
);

const gridScale = interpolate(
  Math.sin(frame * 0.03),
  [-1, 1],
  [0.98, 1.02]
);

<div
  style={{
    position: 'absolute',
    inset: 0,
    backgroundImage: `
      linear-gradient(rgba(255,255,255,${gridOpacity}) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,${gridOpacity}) 1px, transparent 1px)
    `,
    backgroundSize: '60px 60px',
    transform: `scale(${gridScale})`,
  }}
/>
```

---

## 5. Orbiting Elements

Decorative elements that rotate around a point.

```tsx
const OrbitingDot: React.FC<{
  centerX: number;
  centerY: number;
  radius: number;
  index: number;
  size: number;
  color: string;
}> = ({ centerX, centerY, radius, index, size, color }) => {
  const frame = useCurrentFrame();

  // Each dot offset by index
  const angle = ((frame * 1.5) + (index * 60)) * (Math.PI / 180);
  const x = centerX + Math.cos(angle) * radius;
  const y = centerY + Math.sin(angle) * radius;

  return (
    <div
      style={{
        position: 'absolute',
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        borderRadius: '50%',
        background: color,
      }}
    />
  );
};

// Create orbit with 6 dots
{Array.from({ length: 6 }, (_, i) => (
  <OrbitingDot
    key={i}
    centerX={960}
    centerY={540}
    radius={300}
    index={i}
    size={8}
    color="rgba(255,255,255,0.4)"
  />
))}
```

---

# On-Screen Behaviors

Elements shouldn't just sit static after appearing.

---

## 1. Subtle Breathing

Element gently pulses while on screen.

```tsx
const breathe = interpolate(
  Math.sin(frame * 0.08),
  [-1, 1],
  [0.98, 1.02]
);

<div style={{ transform: `scale(${breathe})` }} />
```

---

## 2. Glow Pulse

Emphasis glow that pulses.

```tsx
const glowIntensity = interpolate(
  Math.sin(frame * 0.1),
  [-1, 1],
  [10, 30]
);

<div
  style={{
    boxShadow: `0 0 ${glowIntensity}px rgba(99, 102, 241, 0.6)`,
  }}
/>
```

---

## 3. Progress Bar Fill

Bars that animate to their final value.

```tsx
const progress = spring({
  frame: frame - delay,
  fps,
  config: { damping: 20, stiffness: 80 },
});

const width = targetPercent * progress;

<div style={{ width: `${width}%`, height: 12, background: '#3b82f6', borderRadius: 6 }} />
```

---

# Transitions

## 1. Morph Shape

Circle morphs to rectangle or vice versa.

```tsx
const borderRadius = interpolate(
  frame,
  [startFrame, startFrame + 20],
  [50, 8], // 50% = circle, 8px = rounded rect
  { extrapolateRight: 'clamp' }
);
```

---

## 2. Zoom Out Transition

Current scene zooms out as it exits.

```tsx
const exitZoom = interpolate(frame, [exitStart, exitStart + 15], [1, 0.8]);
const exitOpacity = interpolate(frame, [exitStart, exitStart + 15], [1, 0]);

<div style={{
  transform: `scale(${exitZoom})`,
  opacity: exitOpacity,
}} />
```

---

## 3. Staggered Exit

Multiple elements exit in sequence.

```tsx
const exitStagger = (index: number) => {
  const exitDelay = index * 3;
  const y = interpolate(
    frame,
    [exitStart + exitDelay, exitStart + exitDelay + 12],
    [0, -60],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  const opacity = interpolate(
    frame,
    [exitStart + exitDelay, exitStart + exitDelay + 12],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  return { y, opacity };
};
```

---

# Anti-Patterns (NEVER DO THIS)

## ❌ Opacity-Only Fade

```tsx
// BAD - boring, generic, AI slop
const opacity = interpolate(frame, [0, 20], [0, 1]);
<div style={{ opacity }} />
```

**Fix:** Add scale, position, or blur to every entrance.

---

## ❌ Static Background

```tsx
// BAD - feels dead, lifeless
<AbsoluteFill style={{ background: '#1a1a2e' }} />
```

**Fix:** Add particles, gradient shift, or subtle pattern animation.

---

## ❌ Instant Number Appearance

```tsx
// BAD - numbers deserve animation
<span>$1,250,000</span>
```

**Fix:** Always use counter tick-up animation for numbers.

---

## ❌ Everything Animates at Once

```tsx
// BAD - chaotic, no hierarchy
// All elements have delay: 0
```

**Fix:** Stagger entrances. Primary first, secondary follows, labels last.

---

## ❌ Linear Easing

```tsx
// BAD - feels mechanical, robotic
const x = interpolate(frame, [0, 30], [0, 100]);
```

**Fix:** Use `spring()` for organic motion, or add easing:
```tsx
import { Easing } from 'remotion';
const x = interpolate(frame, [0, 30], [0, 100], {
  easing: Easing.bezier(0.25, 0.1, 0.25, 1),
});
```

---

# Quick Reference

| Element Type | Recommended Entrance | Duration |
|--------------|---------------------|----------|
| Hero/Title | Scale with overshoot | 20-30f |
| Numbers | Counter tick-up | 40-60f |
| Cards/Boxes | Slide + scale | 15-20f |
| Lines/Edges | Stroke draw | 25-40f |
| Icons | Scale with bounce | 12-18f |
| Labels | Slide from bottom | 10-15f |
| Background | Always animated | Continuous |

| Spring Config | Feel | Use For |
|---------------|------|---------|
| damping: 8, stiffness: 150 | Bouncy | Playful, energetic |
| damping: 12, stiffness: 100 | Balanced | Most cases |
| damping: 20, stiffness: 200 | Snappy | UI, buttons |
| damping: 30, stiffness: 80 | Smooth | Elegant, subtle |
