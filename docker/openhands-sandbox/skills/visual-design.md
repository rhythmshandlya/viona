# Visual Design Guidelines

## Design Philosophy: SOFT, ELEGANT, PREMIUM

**Goal:** Create visuals that feel calm, refined, and aesthetically pleasing.

### AVOID (Tacky/Cheap):
- Bouncy animations (low damping)
- Shake/wiggle effects
- Overly saturated colors
- Fast, jarring motion
- Too many competing elements
- EMOJIS - Never use emojis in visuals. Use icons, shapes, or text instead.

### EMBRACE (Premium/Elegant):
- Smooth, graceful motion
- Muted, sophisticated colors
- Generous whitespace
- Slow, purposeful reveals
- Subtle depth and shadows

---

## Style Presets

### Modern Elegant (DEFAULT - Use This)
- Soft gradients with muted tones
- Generous rounded corners (16-24px)
- Glass morphism with subtle blur
- Smooth animations (damping: 25+, no bounce)

```tsx
const ModernElegantStyle = {
  gradient: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1e3a5f 100%)',
  text: '#f1f5f9',
  accent: '#818cf8',  // Soft purple
  fontFamily: 'Plus Jakarta Sans, sans-serif',
  borderRadius: 20,
  // Spring config: { damping: 25, stiffness: 80 }
};
```

### Minimal
- Clean lines, lots of whitespace
- Monochrome with single soft accent
- Simple geometric shapes
- Very subtle animations

```tsx
const MinimalStyle = {
  background: '#fafafa',
  text: '#1a1a1a',
  accent: '#6366f1',  // Soft indigo
  fontFamily: 'Inter, system-ui, sans-serif',
};
```

### Dark Premium
- Deep, rich dark backgrounds
- Soft glows instead of harsh highlights
- Refined typography
- Elegant transitions

```tsx
const DarkPremiumStyle = {
  background: '#0f0f1a',
  text: '#e2e8f0',
  accent: '#a78bfa',  // Soft violet
  glow: 'rgba(167, 139, 250, 0.2)',
  fontFamily: 'DM Sans, sans-serif',
};
```

### Classic
- Traditional, professional
- Serif fonts
- Navy blue, muted gold
- Dignified, no-bounce motion

```tsx
const ClassicStyle = {
  background: '#f8f6f0',
  primary: '#1e3a5f',
  gold: '#b8860b',  // Muted gold
  fontFamily: 'Playfair Display, Georgia, serif',
  // Spring config: { damping: 30, stiffness: 60 }
};
```

## Visual Components

### Glass Card
```tsx
<div style={{
  background: 'rgba(255, 255, 255, 0.1)',
  backdropFilter: 'blur(10px)',
  borderRadius: 16,
  border: '1px solid rgba(255, 255, 255, 0.2)',
  padding: 24,
}}>
  {children}
</div>
```

### Gradient Text
```tsx
<span style={{
  background: 'linear-gradient(90deg, #6366f1, #ec4899)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  fontWeight: 700,
}}>
  Gradient Text
</span>
```

### Animated Underline
```tsx
const width = interpolate(frame, [0, 20], [0, 100], { extrapolateRight: 'clamp' });
<div>
  <span>Underlined</span>
  <div style={{ height: 3, width: `${width}%`, background: '#3b82f6' }} />
</div>
```

## Animation Timing (Premium Feel)

**Goal:** Responsive but not rushed. Professional polish.

### Timing Guidelines
- **Element entrances**: 500-800ms (16-26 frames) - responsive, not sluggish
- **Counter tick-ups**: 1.2-2s (36-60 frames) - satisfying progression
- **Scene transitions**: 600-900ms - smooth but not slow
- **Stagger delay**: 150-250ms between elements (5-8 frames)

### The Golden Easing Curve

**Material Design Standard: `cubic-bezier(0.4, 0, 0.2, 1)`**
- Fast, responsive start (feels instant)
- Gentle, smooth deceleration (polished landing)

### Spring Configs for Premium Motion

```tsx
// PREMIUM DEFAULT - Responsive & polished
{ damping: 20, stiffness: 100, mass: 0.8 }

// Elegant - Slightly slower, refined
{ damping: 22, stiffness: 90, mass: 0.9 }

// Quick - Snappy but smooth
{ damping: 18, stiffness: 120, mass: 0.6 }
```

## Animation Sequence (12 Principles Applied)

1. **Background**: Subtle continuous motion (gradient shift, soft particles)
2. **Hero content**: Scale + Y movement with ease-out (responsive entrance)
3. **Secondary content**: Staggered 5-8 frames apart with arc motion
4. **Details/labels**: Quick fade + slide, last to appear
5. **Continuous elements**: Subtle breathing, glow pulse (after entrance)

## Disney's Principles Checklist

- [ ] **Ease-out**: Fast start, slow end (not linear)
- [ ] **Stagger**: Elements enter sequentially, not all at once
- [ ] **Arcs**: Movement follows curves, not straight lines
- [ ] **Overlapping**: Different parts move at different times
- [ ] **Follow-through**: Motion settles naturally after stopping
- [ ] **Secondary action**: Supporting micro-movements enhance main action

## Quality Markers (Premium vs Cheap)

| Premium | Cheap |
|---------|-------|
| Ease-out curves | Linear motion |
| Staggered reveals | Everything at once |
| Arc paths | Straight lines |
| Slight overshoot → settle | Abrupt stops |
| Varied timing | Uniform/robotic |
| Subtle secondary motion | Static after entrance |
