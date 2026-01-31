# Motion Graphics System Design

## Problem Statement

Generated videos have weak animations - just opacity fades with no movement or transformation. This produces generic "AI slop" aesthetic instead of Instagram-worthy motion graphics.

## Goal

Transform simple fade-in animations into Instagram-worthy visuals with:
- Shapes morphing, particles, flowing lines, dynamic backgrounds
- Elements that move, scale, and draw themselves
- Numbers that count up, progress bars that fill
- Choreographed sequences with energy and polish

## Solution: Animation Cookbook + Enforcement Checklist

### Approach A: Animation Cookbook (`motion-graphics.md`)

A comprehensive skill file with ready-to-use Remotion code recipes:

**1. Element Entrances (not just fades)**
- Scale from zero with overshoot (spring animation)
- Slide from edge with bounce
- Draw/reveal stroke animations
- Blur-to-sharp focus
- Counter/typewriter effects for numbers

**2. Background Dynamics (never static)**
- Floating particles
- Gradient shifts over time
- Geometric patterns that pulse
- Noise/grain overlays
- Flowing lines/waves

**3. Element Behaviors (during screen time)**
- Subtle breathing effects
- Numbers that tick up
- Progress bars that fill
- Pulsing highlights
- Orbital/rotating decorations

**4. Transitions (between concepts)**
- Morphing shapes
- Wipe/reveal effects
- Zoom transitions
- Blur/defocus bridges

### Approach C: Enforcement Checklist

Integrate into `visual-planning.md` - mandatory Animation Inventory:

```
ANIMATION INVENTORY:

Element: [Name]
├── Entrance: [type] - NOT "fade" alone
│   ├── Movement: [direction/path]
│   ├── Duration: [frames] at 30fps
│   └── Easing: [spring config or curve]
├── On-screen behavior: [breathing/pulsing/static]
└── Exit (if any): [type]

Background:
├── Type: [particles/gradient-shift/geometric/waves]
├── Intensity: [subtle/medium/prominent]
└── Motion: [description]
```

**Validation Rules:**
- ❌ REJECT if entrance is only `opacity: 0 → 1`
- ❌ REJECT if background has no motion
- ❌ REJECT if no element has scale or position animation
- ✅ REQUIRE at least one "hero" animation
- ✅ REQUIRE background with continuous subtle motion

---

## Code Recipes

### Element Entrances

```tsx
// Scale from zero with overshoot
const scale = spring({
  frame,
  fps,
  config: { damping: 10, stiffness: 100, mass: 0.5 },
});

// Slide from bottom with bounce
const y = spring({
  frame: frame - delay,
  fps,
  config: { damping: 12, stiffness: 200 },
  from: 100,
  to: 0,
});

// Draw stroke animation
const strokeDashoffset = interpolate(frame, [0, 30], [pathLength, 0], {
  extrapolateRight: 'clamp',
});

// Blur to sharp
const blur = interpolate(frame, [0, 20], [20, 0], { extrapolateRight: 'clamp' });
<div style={{ filter: `blur(${blur}px)` }} />

// Counter tick-up
const displayNumber = Math.floor(interpolate(frame, [0, 60], [0, targetNumber]));
```

### Dynamic Backgrounds

```tsx
// Floating particles
const Particle = ({ delay, x, y, size }) => {
  const float = Math.sin((frame + delay) * 0.05) * 20;
  const drift = (frame + delay) * 0.3;
  return (
    <div style={{
      position: 'absolute',
      left: x + drift % 100,
      top: y + float,
      width: size,
      height: size,
      borderRadius: '50%',
      background: 'rgba(255,255,255,0.3)',
      filter: 'blur(2px)',
    }} />
  );
};

// Gradient shift over time
const hue = interpolate(frame, [0, durationInFrames], [0, 30]);
background: `linear-gradient(135deg, hsl(${hue}, 70%, 50%), hsl(${hue + 40}, 70%, 30%))`

// Pulsing geometric pattern
const pulse = Math.sin(frame * 0.1) * 0.1 + 1;
transform: `scale(${pulse})`

// Flowing wave lines
const Wave = ({ offset, color }) => {
  const points = Array.from({ length: 20 }, (_, i) => {
    const x = (i / 19) * 1920;
    const y = 540 + Math.sin((i * 0.5) + frame * 0.05 + offset) * 100;
    return `${x},${y}`;
  }).join(' ');
  return <polyline points={points} fill="none" stroke={color} strokeWidth={2} />;
};

// Orbiting dots
const angle = (frame * 2 + index * 60) * (Math.PI / 180);
const orbitX = centerX + Math.cos(angle) * radius;
const orbitY = centerY + Math.sin(angle) * radius;
```

### Transitions

```tsx
// Morphing circle to rectangle
const borderRadius = interpolate(frame, [60, 90], [50, 10], { extrapolateRight: 'clamp' });

// Zoom transition
const zoom = interpolate(frame, [startFrame, startFrame + 15], [1, 1.2]);
transform: `scale(${zoom})`

// Clip reveal (left to right)
const clipX = interpolate(frame, [0, 30], [0, 100]);
clipPath: `inset(0 ${100 - clipX}% 0 0)`

// Staggered exit
const exitDelay = index * 3;
const exitY = interpolate(frame, [exitStart + exitDelay, exitStart + exitDelay + 10], [0, -50]);
```

---

## File Changes

### 1. Create `skills/motion-graphics.md` (NEW)
- Element entrance recipes (5 techniques)
- Background dynamics recipes (5 techniques)
- On-screen behaviors
- Transition recipes
- Anti-patterns ("never just fade")

### 2. Update `skills/visual-planning.md`
- Add Step 3.5: Animation Inventory (mandatory)
- Add validation rules (reject fade-only)
- Add example animation inventory format

### 3. Update `skills/scoring-rubric.md`
- Add Animation Quality category (0-25 points)
- 0-5: Only opacity fades, static background
- 6-15: Some movement but generic
- 16-20: Varied entrances, dynamic background
- 21-25: Motion graphics quality

### 4. Update `visual_generator.py`
- Load `motion-graphics.md` skill
- Pass to generator agent in skills list

### 5. Rebuild Docker image

---

## Implementation Order

1. Create `motion-graphics.md` (~400 lines)
2. Update `visual-planning.md` with Animation Inventory
3. Update `scoring-rubric.md` with animation scoring
4. Update `visual_generator.py` to load new skill
5. Rebuild Docker image
6. Test with sample prompts

## Expected Outcome

- Every video has dynamic backgrounds (particles, gradients, waves)
- Elements enter with movement (scale, slide, draw)
- Numbers count up instead of appearing instantly
- Shapes morph and flow
- Instagram-worthy motion graphics quality
