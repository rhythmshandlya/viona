---
triggers:
  - responsive
  - dimension
  - minDim
  - aspect ratio
  - flexbox layout
  - hardcoded pixels
---

# Responsive Layout Rules

## NEVER Hardcode Pixel Values

**Your composition MUST work at any resolution.**

```tsx
// ❌ FORBIDDEN - hardcoded pixels
const fontSize = 48;
const padding = 50;
const width = 1080;

// ✅ CORRECT - relative to dimensions
const { width, height, fps } = useVideoConfig();
const minDim = Math.min(width, height);
const fontSize = height * 0.04;
const padding = minDim * 0.05;
```

## Responsive Value Pattern (MANDATORY)

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

## Layout Structure (Prevent Overlapping)

```
┌─────────────────────────┐
│  Title (top 15%)        │  ← flex: '0 0 15%'
├─────────────────────────┤
│                         │
│  Visual/Diagram         │  ← flex: 1
│  (middle 60%)           │
│                         │
├─────────────────────────┤
│  Labels (bottom 25%)    │  ← flex: '0 0 auto'
└─────────────────────────┘
```

## Flexbox with Responsive Values

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

## Text Overflow Handling

```tsx
// Single-line (truncate)
whiteSpace: 'nowrap',
overflow: 'hidden',
textOverflow: 'ellipsis',

// Multi-line (wrap)
wordWrap: 'break-word',
overflowWrap: 'break-word',
```

## Critical Rules

1. **NEVER** place text directly on top of diagrams
2. **ALWAYS** use useVideoConfig() for dimensions
3. **ALWAYS** calculate sizes relative to width/height/minDim
4. **VERIFY** layout at multiple aspect ratios
