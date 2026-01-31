# Motion Graphics Cookbook

## Design Philosophy: PREMIUM & POLISHED

**Goal:** Create motion that feels expensive, refined, and professionally crafted.

Based on Disney's 12 Principles of Animation and modern UI/UX motion design best practices.

---

## What Makes Animation Look EXPENSIVE

### DO (Premium Feel):
- **Asymmetric easing**: Fast start, gentle deceleration (ease-out curves)
- **Staggered reveals**: Elements enter sequentially, not all at once
- **Overlapping action**: Different parts move at slightly different times
- **Follow-through**: Motion continues slightly after stopping, then settles
- **Arcs**: Movement follows curved natural paths, not straight lines
- **Secondary action**: Supporting micro-movements that enhance the main action
- **Anticipation**: Brief preparatory movement before the main action
- **Subtle variation**: Add organic imperfection to avoid robotic uniformity

### AVOID (Cheap/Tacky):
- Linear easing (feels mechanical and robotic)
- Everything animating simultaneously (chaotic, overwhelming)
- Excessive bounce or shake (amateurish, stressful)
- Too many effects competing for attention
- Jerky, unnatural motion paths
- Overly uniform/predictable timing
- Straight-line movement (use arcs instead)
- EMOJIS - Never use emojis in visuals. Use geometric shapes, icons, or styled text.

---

## The Golden Easing Curve

**Material Design Standard: `cubic-bezier(0.4, 0, 0.2, 1)`**

This is the industry-standard curve for professional UI motion:
- Starts with moderate acceleration (responsive feel)
- Ends with gentle deceleration (smooth landing)
- Feels premium, polished, and natural

In Remotion spring(), approximate with:
```tsx
// Premium easing - responsive start, gentle landing
{ damping: 20, stiffness: 100, mass: 0.8 }
```

---

## CRITICAL: No Simple Fades

**Every animation must involve MOVEMENT, not just opacity.**

BANNED: `opacity: 0 -> 1` alone
REQUIRED: Combine opacity with scale, position, or blur

---

# Element Entrances

## 1. Scale with Ease-Out (Primary Choice)

Professional scale entrance with responsive start and smooth landing.

```tsx
const scale = spring({
  frame: frame - delay,
  fps,
  config: { damping: 20, stiffness: 100, mass: 0.8 },  // Fast start, smooth end
});

// Combine scale with slight upward movement for depth
const y = spring({
  frame: frame - delay,
  fps,
  config: { damping: 22, stiffness: 90, mass: 0.8 },
  from: 20,
  to: 0,
});

<div style={{
  transform: `scale(${scale}) translateY(${y}px)`,
  opacity: Math.min(scale * 1.5, 1),  // Opacity leads slightly
}} />
```

**When to use:** Hero elements, titles, key numbers, icons
**Timing:** 18-28 frames - responsive but not rushed
**Config variations:**
- **Premium (DEFAULT):** `{ damping: 20, stiffness: 100, mass: 0.8 }` - responsive, polished
- Elegant: `{ damping: 24, stiffness: 80, mass: 1 }` - slightly slower, refined
- Snappy: `{ damping: 18, stiffness: 120, mass: 0.6 }` - quick, responsive

---

## 2. Slide with Arc Motion

Element follows a natural curved path (arc), not a straight line.

```tsx
// Main slide motion
const progress = spring({
  frame: frame - delay,
  fps,
  config: { damping: 20, stiffness: 90, mass: 0.8 },
});

// Arc: combine Y slide with subtle X curve
const y = interpolate(progress, [0, 1], [60, 0]);
const x = interpolate(progress, [0, 0.5, 1], [15, 8, 0]);  // Subtle arc

const opacity = interpolate(frame - delay, [0, 12], [0, 1], {
  extrapolateRight: 'clamp',
});

<div style={{
  transform: `translate(${x}px, ${y}px)`,
  opacity,
}} />
```

**Arc principle:** Objects in nature move in curves, not straight lines. Add a subtle perpendicular component to make motion feel organic.

**When to use:** Lists, cards, sequential content
**Timing:** 16-24 frames

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

## 1. Floating Particles (Soft & Subtle)

Gentle particles that drift slowly - almost imperceptible motion.

```tsx
const Particle: React.FC<{
  x: number;
  y: number;
  size: number;
  delay: number;
  color: string;
}> = ({ x, y, size, delay, color }) => {
  const frame = useCurrentFrame();

  // SLOW vertical float - very gentle
  const float = Math.sin((frame + delay) * 0.015) * 15;  // Slow speed, small amplitude

  // SLOW horizontal drift
  const drift = Math.sin((frame + delay) * 0.01 + delay) * 10;

  // Subtle opacity variation
  const opacity = interpolate(
    Math.sin((frame + delay) * 0.02),
    [-1, 1],
    [0.15, 0.3]  // Very subtle range
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
        filter: `blur(${size / 2}px)`,  // More blur = softer
      }}
    />
  );
};

// Generate soft, sparse particles
const particles = Array.from({ length: 12 }, (_, i) => ({
  x: Math.random() * 1920,
  y: Math.random() * 1080,
  size: 20 + Math.random() * 60,  // Larger, softer blobs
  delay: i * 15,
  color: 'rgba(255, 255, 255, 0.15)',  // Very subtle
}));
```

**When to use:** Any scene - adds depth without distraction
**Keep it subtle:** 8-15 particles, low opacity, heavy blur

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

## Opacity-Only Fade (BAD)

```tsx
// BAD - boring, generic, AI slop
const opacity = interpolate(frame, [0, 20], [0, 1]);
<div style={{ opacity }} />
```

**Fix:** Add scale, position, or blur to every entrance.

---

## Static Background (BAD)

```tsx
// BAD - feels dead, lifeless
<AbsoluteFill style={{ background: '#1a1a2e' }} />
```

**Fix:** Add particles, gradient shift, or subtle pattern animation.

---

## Instant Number Appearance (BAD)

```tsx
// BAD - numbers deserve animation
<span>$1,250,000</span>
```

**Fix:** Always use counter tick-up animation for numbers.

---

## Everything Animates at Once (BAD)

```tsx
// BAD - chaotic, no hierarchy
// All elements have delay: 0
```

**Fix:** Stagger entrances. Primary first, secondary follows, labels last.

---

## Linear Easing (BAD)

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

## Element Timing

| Element Type | Entrance Style | Duration | Stagger |
|--------------|---------------|----------|---------|
| Hero/Title | Scale + slight Y movement | 20-28f | First |
| Numbers | Counter tick-up | 40-60f | After title |
| Cards/Boxes | Arc slide + scale | 16-24f | 5-8f apart |
| Lines/Edges | Stroke draw | 25-40f | With content |
| Icons | Scale with ease-out | 14-20f | 4-6f apart |
| Labels | Slide up + fade | 12-18f | Last |
| Background | Continuous subtle motion | Always | N/A |

## Premium Spring Configs

| Spring Config | Feel | Best For |
|---------------|------|----------|
| **damping: 20, stiffness: 100, mass: 0.8** | **Premium (DEFAULT)** | **Most UI elements** |
| damping: 22, stiffness: 90, mass: 0.9 | Polished | Hero elements |
| damping: 18, stiffness: 120, mass: 0.6 | Responsive | Quick interactions |
| damping: 25, stiffness: 70, mass: 1 | Elegant | Slow reveals |

## Disney's 12 Principles - Key Ones for Motion Graphics

| Principle | How to Apply | Example |
|-----------|--------------|---------|
| **Ease-out** | Fast start, slow end | `cubic-bezier(0.4, 0, 0.2, 1)` |
| **Anticipation** | Brief reverse movement first | Scale 0.95 → 1.1 → 1.0 |
| **Follow-through** | Continue past target, settle back | Overshoot then ease to final |
| **Overlapping** | Parts move at different times | Title first, subtitle 8f later |
| **Arcs** | Curved paths, not straight | Add subtle X to Y movement |
| **Stagger** | Sequential, not simultaneous | `delay = index * 6` |

## AVOID (Makes Animation Look Cheap)

| Anti-Pattern | Why It's Bad | Fix |
|--------------|--------------|-----|
| Linear easing | Robotic, mechanical | Use ease-out or spring |
| All at once | Chaotic, overwhelming | Stagger by 5-8 frames |
| Excessive bounce | Amateurish, distracting | damping >= 18 |
| Shake/wiggle | Stressful, tacky | Remove entirely |
| Straight paths | Unnatural | Add arc with subtle X |
| Too uniform | Robotic | Vary timing slightly |
| Emojis | Unprofessional, childish | Use shapes or styled text |

## The Premium Formula

```tsx
// 1. Responsive easing (fast start, gentle end)
const spring = { damping: 20, stiffness: 100, mass: 0.8 };

// 2. Staggered entrance
const delay = index * 6;

// 3. Arc motion (not straight)
const y = interpolate(progress, [0, 1], [40, 0]);
const x = interpolate(progress, [0, 0.5, 1], [10, 5, 0]);

// 4. Overlapping opacity (leads slightly)
const opacity = Math.min(progress * 1.3, 1);

// 5. Combine transforms
transform: `translate(${x}px, ${y}px) scale(${scale})`
```
