
## 🔧 COMMON PATTERNS (Use in ALL compositions)

### Responsive Sizing Helper
```tsx
const { width, height, fps } = useVideoConfig();
const minDim = Math.min(width, height);

// Font sizes - relative to height for readability
const fontSize = {
  xs: height * 0.018,
  sm: height * 0.022,
  md: height * 0.032,
  lg: height * 0.045,
  xl: height * 0.06,
};

// Spacing - relative to minDim
const padding = minDim * 0.05;
const gap = minDim * 0.03;
const borderRadius = minDim * 0.02;
const borderWidth = Math.max(2, minDim * 0.003);

// Glow effects
const glow = minDim * 0.025;
```

### Standard Color Palettes
```tsx
// Modern palette (most common)
const COLORS = {
  bg: '#0f0f23',
  primary: '#8b5cf6',    // Purple
  secondary: '#3b82f6',  // Blue
  accent: '#06b6d4',     // Cyan
  success: '#22c55e',    // Green
  danger: '#ef4444',     // Red
  warning: '#f97316',    // Orange
  muted: '#888888',
};
```

### Ball Physics Simulation
```tsx
// Frame-based physics - pure function of frame number (Remotion-safe)
const simulateBallPhysics = (
  frame: number,
  dropFrame: number,
  targetY: number,
  fps: number
): { y: number; settled: boolean } => {
  const elapsed = frame - dropFrame;
  if (elapsed < 0) return { y: -100, settled: false };

  const gravity = 0.004;
  const bounceDamping = 0.5;
  let y = 0, velocity = 0, bounces = 0;

  for (let t = 0; t < elapsed; t++) {
    velocity += gravity;
    y += velocity;
    if (y >= targetY) {
      y = targetY;
      velocity = -velocity * bounceDamping;
      if (++bounces >= 4 || Math.abs(velocity) < 0.02) {
        return { y: targetY, settled: true };
      }
    }
  }
  return { y: Math.min(y, targetY), settled: false };
};
```

### Shake Effect (Stress Indicator)
```tsx
const shakeIntensity = interpolate(stressLevel, [0.7, 1], [0, 1], {
  extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
});
const shakeX = Math.sin(frame * 1.5) * shakeIntensity * minDim * 0.008;
const shakeY = Math.cos(frame * 1.8) * shakeIntensity * minDim * 0.005;
// Apply: transform: `translate(${shakeX}px, ${shakeY}px)`
```

### Squash & Stretch
```tsx
// During fall - stretch vertically
const velocity = Math.min((frame - dropFrame) * 0.02, 0.3);
const scaleX = isSettled ? 1 : 1 - velocity * 0.2;
const scaleY = isSettled ? 1 : 1 + velocity * 0.3;

// On landing - squash horizontally
const landingSquash = justLanded
  ? interpolate(frame - landFrame, [0, 8, 15], [1, 0.7, 1], { extrapolateRight: 'clamp' })
  : 1;
```

### Spring Configs by Style
```tsx
const SPRING_CONFIGS = {
  minimal: { damping: 20, stiffness: 60 },   // Smooth, no bounce
  modern: { damping: 12, stiffness: 80 },    // Bouncy, satisfying
  playful: { damping: 8, stiffness: 200 },   // Very bouncy
  bold: { damping: 15, stiffness: 150 },     // Snappy, powerful
  classic: { damping: 25, stiffness: 50 },   // Dignified, no bounce
};
```

### Layout Structure (Flexbox)
```tsx
<AbsoluteFill style={{ background: `radial-gradient(ellipse at center, #1a1a3e 0%, #0f0f23 70%)` }}>
  <div style={{
    width: '100%', height: '100%',
    display: 'flex', flexDirection: 'column',
    justifyContent: 'center', alignItems: 'center',
    padding: minDim * 0.05, gap: minDim * 0.03,
  }}>
    {/* Content */}
  </div>
</AbsoluteFill>
```
