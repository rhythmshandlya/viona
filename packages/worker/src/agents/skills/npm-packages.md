# NPM Packages Reference

## Pre-installed Packages

These packages are already available in the Remotion template. Use them directly without installation.

### Remotion Core (Always Available)
```tsx
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
  Sequence,
  AbsoluteFill,
  Img,
  Audio,
  Video,
} from 'remotion';
```

### Remotion Player (For Preview)
```tsx
import { Player } from '@remotion/player';
```

### TailwindCSS v4 (Pre-installed)
```tsx
// Use Tailwind classes directly in components
<div className="flex items-center justify-center bg-gradient-to-r from-purple-500 to-cyan-500">
```

---

## Official Remotion Packages (Recommended)

These are official packages that enhance Remotion capabilities. Install with exact versions matching your Remotion version.

### @remotion/shapes - Geometric Shapes
SVG shapes with animation support. Works great with @remotion/paths.
```tsx
import { Star, Triangle, Pie, Circle, Heart, Polygon } from '@remotion/shapes';
import { makeStar, makeTriangle } from '@remotion/shapes';

// As React component
<Star points={5} innerRadius={50} outerRadius={100} fill="#8b5cf6" />

// As pure function (returns SVG path)
const starPath = makeStar({ points: 5, innerRadius: 50, outerRadius: 100 });
```

### @remotion/paths - SVG Path Utilities
Manipulate and animate SVG paths.
```tsx
import { getLength, getPointAtLength, evolvePath } from '@remotion/paths';

const length = getLength(svgPath);
const point = getPointAtLength(svgPath, progress * length);
const evolvedPath = evolvePath(progress, svgPath); // Draw path progressively
```

### @remotion/motion-blur - Motion Blur Effects
Add cinematic motion blur and trail effects.
```tsx
import { Trail, CameraMotionBlur } from '@remotion/motion-blur';

// Trail effect (ghosting)
<Trail amount={5} lagInFrames={0.1}>
  <MovingElement />
</Trail>

// Camera-like motion blur
<CameraMotionBlur samples={10} shutterAngle={180}>
  <FastMovingScene />
</CameraMotionBlur>
```

### @remotion/noise - Procedural Noise
Generate noise for textures, backgrounds, and organic effects.
```tsx
import { noise2D, noise3D, noise4D } from '@remotion/noise';

// 2D noise for textures
const noiseValue = noise2D('seed', x * 0.01, y * 0.01);

// 3D noise (add time dimension for animation)
const animatedNoise = noise3D('seed', x * 0.01, y * 0.01, frame * 0.01);
```

### @remotion/transitions - Scene Transitions
Professional transitions between scenes.
```tsx
import { TransitionSeries, linearTiming, springTiming } from '@remotion/transitions';
import { fade, slide, wipe } from '@remotion/transitions/fade';

<TransitionSeries>
  <TransitionSeries.Sequence durationInFrames={60}>
    <Scene1 />
  </TransitionSeries.Sequence>
  <TransitionSeries.Transition
    presentation={slide({ direction: 'from-left' })}
    timing={springTiming({ config: { damping: 200 } })}
  />
  <TransitionSeries.Sequence durationInFrames={60}>
    <Scene2 />
  </TransitionSeries.Sequence>
</TransitionSeries>
```

### @remotion/animated-emoji - Google Animated Emojis
Animated emoji components from Google Fonts.
```tsx
import { AnimatedEmoji, getAvailableEmoji } from '@remotion/animated-emoji';

<AnimatedEmoji emoji="🎉" />
<AnimatedEmoji emoji="fire" />
```

### @remotion/media-utils - Audio/Video Utilities
Audio visualization and media metadata.
```tsx
import { getAudioData, visualizeAudio, useAudioData } from '@remotion/media-utils';

// Audio waveform visualization
const audioData = useAudioData(audioSrc);
const visualization = visualizeAudio({
  fps,
  frame,
  audioData,
  numberOfSamples: 256,
});
```

### @remotion/gif - GIF Support
Display and control GIFs frame-by-frame.
```tsx
import { Gif } from '@remotion/gif';

<Gif src="https://example.com/animation.gif" />
```

---

## Decision Tree: When to Use What

```
Need animation?
├─ Physics (bounce, gravity, spring)
│   └─ USE: Component Library (GravityDrop, Bounce, SpringScale)
│
├─ Path/motion (traveling, flowing)
│   └─ USE: Component Library (PathFollow, ArcTravel)
│
├─ Simple transforms (fade, scale, move)
│   └─ USE: Remotion primitives (interpolate, spring)
│
├─ Complex easing curves
│   └─ USE: Remotion's interpolate with custom easing
│
└─ 3D transforms
    └─ CSS 3D transforms with Remotion (no extra package needed)

Need visuals?
├─ Particles, effects
│   └─ USE: Component Library (ParticleStream, Confetti, Burst)
│
├─ Charts/graphs
│   └─ USE: Component Library (Counter, BarChart, LineGraph)
│
├─ Icons
│   └─ CREATE: Simple SVG components (no package needed)
│
├─ Complex shapes
│   └─ CREATE: SVG with Remotion animation
│
└─ 3D objects
    └─ AVOID: Too complex for short-form video
```

---

## Packages to AVOID

### Time-Based Animation Libraries
These use real-time animation which breaks Remotion's frame-by-frame rendering:

| Package | Why Avoid |
|---------|-----------|
| `framer-motion` | Uses requestAnimationFrame, not frame-deterministic |
| `gsap` | Time-based animation system |
| `anime.js` | Same issue - not frame-based |
| `react-spring` | Use Remotion's built-in `spring()` instead |
| `@react-spring/web` | Same as above |

### Heavy Dependencies
These add unnecessary bundle size:

| Package | Alternative |
|---------|-------------|
| `three.js` | Avoid 3D for short-form video |
| `d3` | Use Component Library charts or simple SVG |
| `chart.js` | Use Component Library (BarChart, LineGraph) |
| `recharts` | Use Component Library |

---

## Safe to Install (If Needed)

These packages are compatible with Remotion if you absolutely need them:

### Official Remotion Extensions (Highly Recommended)
```bash
# All must match your Remotion version (e.g., 4.0.414)
npm install --save-exact @remotion/shapes@4.0.414
npm install --save-exact @remotion/paths@4.0.414
npm install --save-exact @remotion/motion-blur@4.0.414
npm install --save-exact @remotion/noise@4.0.414
npm install --save-exact @remotion/transitions@4.0.414
npm install --save-exact @remotion/media-utils@4.0.414
npm install --save-exact @remotion/animated-emoji@4.0.414
npm install --save-exact @remotion/gif@4.0.414
```

### Third-Party Compatible Libraries
```bash
# Declarative animations for Remotion
npm install remotion-animated

# Color manipulation (use sparingly - component library has basics)
npm install chroma-js

# SVG path helpers (use @remotion/paths first)
npm install svg-path-properties

# Custom easing curves (Remotion has built-in Easing)
npm install bezier-easing
```

### When You Actually Need Them

**@remotion/shapes + @remotion/paths**: For animated geometric shapes.
```tsx
import { Star } from '@remotion/shapes';
import { evolvePath, getLength } from '@remotion/paths';

// Animated star drawing
const progress = interpolate(frame, [0, 60], [0, 1]);
<Star points={5} innerRadius={50} outerRadius={100}
      strokeDasharray={getLength(starPath)}
      strokeDashoffset={evolvePath(progress, starPath)} />
```

**@remotion/noise**: For organic textures and backgrounds.
```tsx
import { noise2D } from '@remotion/noise';

// Generate noise texture
const pixels = [];
for (let x = 0; x < width; x++) {
  for (let y = 0; y < height; y++) {
    const n = noise2D('texture', x * 0.02, y * 0.02);
    pixels.push({ x, y, opacity: (n + 1) / 2 });
  }
}
```

**@remotion/motion-blur**: For fast-moving elements.
```tsx
import { Trail } from '@remotion/motion-blur';

// Add motion trail to fast-moving element
<Trail amount={4} lagInFrames={0.08}>
  <FlyingObject style={{ transform: `translateX(${x}px)` }} />
</Trail>
```

**remotion-animated**: For declarative animation sequences.
```tsx
import { Animated, Move, Scale, Fade } from 'remotion-animated';

<Animated animations={[
  Move({ y: -50, start: 0, duration: 30 }),
  Scale({ by: 1.2, start: 30, duration: 20 }),
  Fade({ to: 0, start: 50, duration: 10 }),
]}>
  <MyElement />
</Animated>
```

**chroma-js**: Only for complex color scales and blending.
```tsx
import chroma from 'chroma-js';

// Multi-color scale
const scale = chroma.scale(['#8b5cf6', '#06b6d4', '#22c55e']).mode('lch');
const color = scale(progress).hex();

// Color blending
const blended = chroma.blend('#ff0000', '#0000ff', 'multiply');
```

---

## The Right Approach: Remotion Primitives

### Instead of installing packages, use these patterns:

#### Custom Easing (No Package Needed)
```tsx
// Ease in-out cubic
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

const progress = interpolate(frame, [0, 60], [0, 1]);
const easedProgress = easeInOutCubic(progress);
```

#### Color Interpolation (No Package Needed)
```tsx
const interpolateColor = (color1: string, color2: string, t: number) => {
  const c1 = hexToRgb(color1);
  const c2 = hexToRgb(color2);
  const r = Math.round(c1.r + (c2.r - c1.r) * t);
  const g = Math.round(c1.g + (c2.g - c1.g) * t);
  const b = Math.round(c1.b + (c2.b - c1.b) * t);
  return `rgb(${r}, ${g}, ${b})`;
};
```

#### Physics Animation (Use Spring)
```tsx
// Bouncy
const bouncy = spring({ frame, fps, config: { damping: 8, stiffness: 200 } });

// Smooth
const smooth = spring({ frame, fps, config: { damping: 20, stiffness: 60 } });

// Snappy
const snappy = spring({ frame, fps, config: { damping: 15, stiffness: 150 } });
```

---

## Summary

### Priority Order
1. **First**: Check the Component Library (GlowingOrb, ParticleStream, Counter, etc.)
2. **Second**: Use Remotion primitives (interpolate, spring, Easing, Sequence)
3. **Third**: Consider official @remotion/* packages for specific needs:
   - Shapes/paths → `@remotion/shapes` + `@remotion/paths`
   - Motion blur → `@remotion/motion-blur`
   - Audio visualization → `@remotion/media-utils`
   - Scene transitions → `@remotion/transitions`
   - Procedural textures → `@remotion/noise`
4. **Fourth**: Create simple custom code
5. **Last resort**: Install a third-party compatible package

### Package Quick Reference

| Need | Solution |
|------|----------|
| Animated shapes (star, heart, pie) | `@remotion/shapes` |
| SVG path animation | `@remotion/paths` |
| Motion blur/trails | `@remotion/motion-blur` |
| Audio waveforms | `@remotion/media-utils` |
| Scene transitions | `@remotion/transitions` |
| Noise/textures | `@remotion/noise` |
| Animated emojis | `@remotion/animated-emoji` |
| GIF support | `@remotion/gif` |

**Never install**: framer-motion, gsap, anime.js, react-spring, or any time-based animation library.

### Version Alignment
**Critical**: All @remotion/* packages must have the exact same version as your `remotion` core package. Use `--save-exact` and avoid the `^` prefix.
