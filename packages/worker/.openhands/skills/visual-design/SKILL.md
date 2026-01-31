---
name: visual-design
description: Style presets and visual components for video compositions. Includes color palettes, glass morphism, gradients, and animation sequences.
triggers:
  - visual design
  - style preset
  - color palette
  - animation design
  - motion graphics
  - glass morphism
---

# Visual Design

## Style Presets

```tsx
// Minimal - clean lines, whitespace, single accent
{ background: '#ffffff', text: '#1a1a1a', accent: '#3b82f6' }

// Modern - gradients, glass morphism
{ background: '#0f0f23', gradient: 'linear-gradient(135deg, #6366f1, #8b5cf6, #06b6d4)' }

// Playful - bright colors, bouncy animations
{ colors: ['#f97316', '#eab308', '#22c55e', '#3b82f6'], background: '#fef3c7' }

// Bold - high contrast, dramatic
{ background: '#000000', text: '#ffffff', accent: '#ef4444' }
```

## Components

```tsx
// Glass card
<div style={{
  background: 'rgba(255, 255, 255, 0.1)',
  backdropFilter: 'blur(10px)',
  borderRadius: 16,
  border: '1px solid rgba(255, 255, 255, 0.2)',
}}>

// Gradient text
<span style={{
  background: 'linear-gradient(90deg, #6366f1, #ec4899)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
}}>
```

## Animation Sequence

1. Background/container first
2. Primary content animates in
3. Secondary content (staggered)
4. Decorative elements last

## Quality Checklist

- Text contrast > 4.5:1
- Animations have purpose
- Consistent spacing
- Cohesive color palette
- Clear visual hierarchy
