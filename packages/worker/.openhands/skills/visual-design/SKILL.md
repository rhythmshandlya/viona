---
triggers:
  - visual design
  - style preset
  - color palette
  - animation design
  - motion graphics
  - glass morphism
---

# Visual Design Guidelines

## Style Presets

### Minimal
```tsx
const MinimalStyle = {
  background: '#ffffff',
  text: '#1a1a1a',
  accent: '#3b82f6',
  fontFamily: 'Inter, system-ui, sans-serif',
};
// Clean lines, whitespace, monochrome with single accent
```

### Modern
```tsx
const ModernStyle = {
  background: '#0f0f23',
  gradient: 'linear-gradient(135deg, #6366f1, #8b5cf6, #06b6d4)',
  text: '#ffffff',
  borderRadius: 16,
};
// Vibrant gradients, glass morphism, spring animations
```

### Playful
```tsx
const PlayfulStyle = {
  colors: ['#f97316', '#eab308', '#22c55e', '#3b82f6'],
  background: '#fef3c7',
};
// Bright colors, bouncy animations, rounded shapes
```

### Bold
```tsx
const BoldStyle = {
  background: '#000000',
  text: '#ffffff',
  accent: '#ef4444',
};
// High contrast, large text, dramatic entrances
```

### Classic
```tsx
const ClassicStyle = {
  background: '#f5f5dc',
  primary: '#1e3a5f',
  gold: '#d4af37',
};
// Traditional, serif fonts, chart-style visualizations
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
}}>
  Gradient Text
</span>
```

## Animation Timing

| Type | Duration |
|------|----------|
| Micro-interactions | 100-200ms |
| Transitions | 200-400ms |
| Complex animations | 400-800ms |
| Scene transitions | 500-1000ms |

## Animation Sequence

1. Background/container appears first
2. Primary content animates in
3. Secondary content follows (staggered)
4. Decorative elements last

## Quality Checklist

- [ ] Text readable (contrast > 4.5:1)
- [ ] Animations have purpose
- [ ] Consistent spacing
- [ ] Color palette cohesive
- [ ] Visual hierarchy clear
