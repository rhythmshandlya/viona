# Visual Design Guidelines

## Style Presets

### Minimal
- Clean lines, lots of whitespace
- Monochrome with single accent color
- Simple geometric shapes
- Subtle animations

```tsx
const MinimalStyle = {
  background: '#ffffff',
  text: '#1a1a1a',
  accent: '#3b82f6',
  fontFamily: 'Inter, system-ui, sans-serif',
};
```

### Modern
- Vibrant gradients
- Rounded corners (16-24px)
- Glass morphism effects
- Smooth spring animations

```tsx
const ModernStyle = {
  gradient: 'linear-gradient(135deg, #6366f1, #8b5cf6, #06b6d4)',
  text: '#ffffff',
  fontFamily: 'Plus Jakarta Sans, sans-serif',
  borderRadius: 16,
};
```

### Playful
- Bright, saturated colors
- Bouncy animations
- Rounded shapes, circles
- Friendly, approachable feel

```tsx
const PlayfulStyle = {
  colors: ['#f97316', '#eab308', '#22c55e', '#3b82f6'],
  background: '#fef3c7',
  fontFamily: 'Nunito, sans-serif',
};
```

### Bold
- High contrast (black/white)
- Large, impactful text
- Strong red accents
- Dramatic entrances

```tsx
const BoldStyle = {
  background: '#000000',
  text: '#ffffff',
  accent: '#ef4444',
  fontFamily: 'Bebas Neue, Impact, sans-serif',
};
```

### Classic
- Traditional, professional
- Serif fonts
- Navy blue, gold accents
- Chart-style visualizations

```tsx
const ClassicStyle = {
  background: '#f5f5dc',
  primary: '#1e3a5f',
  gold: '#d4af37',
  fontFamily: 'Playfair Display, Georgia, serif',
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

## Animation Timing

- **Micro-interactions**: 100-200ms
- **Transitions**: 200-400ms
- **Complex animations**: 400-800ms
- **Scene transitions**: 500-1000ms

## Animation Sequence

1. Background/container appears first
2. Primary content animates in
3. Secondary content follows (staggered)
4. Decorative elements last

## Quality Checklist

- [ ] Text is readable (contrast ratio > 4.5:1)
- [ ] Animations have purpose
- [ ] Consistent spacing throughout
- [ ] Color palette is cohesive
- [ ] Visual hierarchy is clear
- [ ] No jarring transitions
- [ ] Polished entry/exit animations
