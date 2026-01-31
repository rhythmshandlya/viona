---
name: responsive-layout
description: Dimension-independent layouts for any resolution. Covers minDim calculations, flexbox patterns, and avoiding hardcoded pixels.
triggers:
  - responsive
  - dimension
  - minDim
  - aspect ratio
  - flexbox layout
  - hardcoded pixels
---

# Responsive Layout

Compositions MUST work at any resolution. Never hardcode pixels.

## Responsive Values

```tsx
const { width, height, fps } = useVideoConfig();
const minDim = Math.min(width, height);

// Font sizes - relative to height
const fontSize = {
  sm: height * 0.022,
  md: height * 0.032,
  lg: height * 0.045,
};

// Spacing - relative to minDim
const padding = minDim * 0.05;
const gap = minDim * 0.03;
const borderRadius = minDim * 0.02;
const borderWidth = Math.max(2, minDim * 0.003);
```

## Layout Structure

```
┌─────────────────────────┐
│  Title (top 15%)        │  flex: '0 0 15%'
├─────────────────────────┤
│  Visual (middle 60%)    │  flex: 1
├─────────────────────────┤
│  Labels (bottom 25%)    │  flex: '0 0 auto'
└─────────────────────────┘
```

```tsx
<div style={{
  display: 'flex',
  flexDirection: 'column',
  gap: minDim * 0.03,
  padding: minDim * 0.05,
}}>
  <div style={{ flex: '0 0 15%' }}>Title</div>
  <div style={{ flex: 1 }}>Visual</div>
  <div style={{ flex: '0 0 auto' }}>Labels</div>
</div>
```

## Rules

1. Never place text directly on diagrams
2. Always use `useVideoConfig()` for dimensions
3. Calculate sizes relative to width/height/minDim
4. Verify layout at multiple aspect ratios
