# Animation Techniques Library

When the Visual Plan specifies a technique, implement it properly using either:
1. **Component Library** (preferred for common patterns) - see `component-library` skill
2. **Custom implementation** (from this file) - for unique/complex techniques

## Quick Reference: Plan Technique → Implementation

| Plan Technique | Component Library | Custom (this file) |
|----------------|-------------------|-------------------|
| `particle-emitter` | `<ParticleStream>` | ParticleEmitter code below |
| `drop-with-gravity` | `<GravityDrop>` | DropWithGravity code below |
| `scale-spring` | `<Bounce>` or `<SpringScale>` | ScaleSpring code below |
| `glass-shimmer` | `<GlassCard shimmer>` | GlassShimmer code below |
| `mask-reveal` | - | **Use MaskReveal below** |
| `cell-division-animation` | - | **Use CellDivision below** |
| `fade-in-blur` | - | **Use FadeInBlur below** |
| `draw-stroke` | - | **Use DrawStroke below** |
| `3d-rotation` | - | **Use Rotating3D below** |
| `fill-animation` | `<ProgressRing>` | FillAnimation code below |

**Rule**: If Component Library has it, use that. If not, use the custom implementation below.

## particle-emitter

**Preferred**: Use `<ParticleStream>` from Component Library:
```tsx
import { ParticleStream } from './components';
<ParticleStream direction="down" density={50} color="#06b6d4" trails depth glowIntensity={1.2} />
```

**Custom alternative** (if you need more control):
Creates a stream of particles with physics-based behavior. Use for "millions of items", "stream", "flow" concepts.

```tsx
interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  delay: number;
}

const ParticleEmitter: React.FC<{
  count?: number;
  emitX?: number;
  emitY?: number;
  spread?: number;
  speed?: number;
  gravity?: number;
  colors?: string[];
}> = ({
  count = 60,
  emitX = 0.5,
  emitY = 0,
  spread = 0.4,
  speed = 8,
  gravity = 0.3,
  colors = [COLORS.primary, COLORS.secondary],
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const particles = useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      x: width * emitX + (Math.random() - 0.5) * width * spread,
      y: height * emitY - 50,
      vx: (Math.random() - 0.5) * speed * 0.5,
      vy: speed + Math.random() * speed * 0.5,
      size: height * 0.01 + Math.random() * height * 0.015,
      color: colors[Math.floor(Math.random() * colors.length)],
      delay: i * 2,
    }));
  }, [count, width, height, emitX, emitY, spread, speed, colors]);

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {particles.map((p) => {
        const t = Math.max(0, frame - p.delay);
        const x = p.x + p.vx * t;
        const y = p.y + p.vy * t + 0.5 * gravity * t * t;
        const opacity = interpolate(t, [0, 10, 80, 100], [0, 0.9, 0.9, 0], {
          extrapolateRight: 'clamp',
        });

        if (y > height * 1.1 || opacity <= 0) return null;

        return (
          <div
            key={p.id}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: p.size,
              height: p.size,
              borderRadius: '50%',
              background: `radial-gradient(circle at 30% 30%, ${p.color}, ${p.color}88)`,
              opacity,
              boxShadow: `0 0 ${p.size * 0.8}px ${p.color}`,
              filter: 'blur(0.5px)',
            }}
          />
        );
      })}
    </div>
  );
};
```

## mask-reveal

**No library equivalent - USE THIS CUSTOM IMPLEMENTATION**

Reveals an element through an animated circular or rectangular mask. Use for "spotlight", "focus", "reveal" moments.

```tsx
const MaskReveal: React.FC<{
  startFrame: number;
  duration?: number;
  shape?: 'circle' | 'rect';
  originX?: number;
  originY?: number;
  children: React.ReactNode;
}> = ({
  startFrame,
  duration = 30,
  shape = 'circle',
  originX = 50,
  originY = 50,
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const progress = spring({
    frame: frame - startFrame,
    fps,
    config: { damping: 20, stiffness: 80 },
  });

  const maxRadius = Math.sqrt(width * width + height * height);

  const clipPath = shape === 'circle'
    ? `circle(${progress * maxRadius}px at ${originX}% ${originY}%)`
    : `inset(${(1 - progress) * 50}%)`;

  const glowRadius = progress * 100;

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ clipPath }}>
        {children}
      </div>
      {/* Spotlight glow at reveal edge */}
      {progress > 0 && progress < 1 && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(circle at ${originX}% ${originY}%,
              ${COLORS.primary}33 ${glowRadius - 30}px,
              ${COLORS.primary}00 ${glowRadius + 50}px)`,
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  );
};
```

## cell-division-animation

**No library equivalent - USE THIS CUSTOM IMPLEMENTATION**

Animates one element splitting into multiple. Use for "splits", "multiplies", "scales to K" concepts.

```tsx
const CellDivision: React.FC<{
  startFrame: number;
  count: number;
  spacing?: number;
  renderItem: (index: number, isOriginal: boolean) => React.ReactNode;
}> = ({ startFrame, count, spacing = 0.12, renderItem }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();

  const localFrame = frame - startFrame;
  if (localFrame < 0) {
    return <div style={{ position: 'relative' }}>{renderItem(0, true)}</div>;
  }

  // Phase 1 (0-25): Wobble/tension
  // Phase 2 (25-50): Split explosion
  // Phase 3 (50+): Spring settle

  const totalWidth = (count - 1) * width * spacing;
  const startX = -totalWidth / 2;

  return (
    <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      {Array.from({ length: count }, (_, i) => {
        const targetX = startX + i * width * spacing;

        // Wobble in phase 1
        const wobble = localFrame < 25
          ? Math.sin(localFrame * 0.4) * 10 * (1 - localFrame / 25)
          : 0;

        // Position animation
        const x = localFrame < 25
          ? wobble
          : spring({
              frame: localFrame - 25,
              fps,
              config: { damping: 12, stiffness: 80 },
            }) * targetX;

        // Scale animation (clone pops in)
        const scale = i === 0
          ? 1 // Original always visible
          : localFrame < 25
            ? 0
            : spring({
                frame: localFrame - 25 - i * 4,
                fps,
                config: { damping: 15, stiffness: 120 },
              });

        const opacity = i === 0 ? 1 : Math.min(1, scale);

        return (
          <div
            key={i}
            style={{
              position: i === 0 ? 'relative' : 'absolute',
              transform: `translateX(${x}px) scale(${Math.max(0.01, scale)})`,
              opacity,
            }}
          >
            {renderItem(i, i === 0)}
          </div>
        );
      })}

      {/* Split particles */}
      {localFrame >= 25 && localFrame < 50 && (
        <SplitParticles progress={(localFrame - 25) / 25} />
      )}
    </div>
  );
};

const SplitParticles: React.FC<{ progress: number }> = ({ progress }) => {
  const { width, height } = useVideoConfig();
  const particleCount = 20;

  return (
    <>
      {Array.from({ length: particleCount }, (_, i) => {
        const angle = (i / particleCount) * Math.PI * 2;
        const distance = progress * width * 0.3;
        const x = Math.cos(angle) * distance;
        const y = Math.sin(angle) * distance;
        const opacity = 1 - progress;
        const size = height * 0.008 * (1 - progress * 0.5);

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: size,
              height: size,
              borderRadius: '50%',
              background: COLORS.primary,
              transform: `translate(${x}px, ${y}px)`,
              opacity,
              boxShadow: `0 0 ${size}px ${COLORS.primary}`,
            }}
          />
        );
      })}
    </>
  );
};
```

## drop-with-gravity

**Preferred**: Use `<GravityDrop>` from Component Library:
```tsx
import { GravityDrop } from './components';
<GravityDrop dropFrame={30} targetY={80} bounceCount={3}>
  <MyElement />
</GravityDrop>
```

**Custom alternative** (if you need more control):
Realistic drop animation with physics and optional bounce. Use for "falls", "drops", "arrives" concepts.

```tsx
const DropWithGravity: React.FC<{
  startFrame: number;
  startY?: number;
  endY?: number;
  bounceHeight?: number;
  bounceDamping?: number;
  children: React.ReactNode;
}> = ({
  startFrame,
  startY = -0.1,
  endY = 0.4,
  bounceHeight = 0.05,
  bounceDamping = 0.6,
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();

  const localFrame = frame - startFrame;

  // Not started yet
  if (localFrame < 0) {
    return (
      <div style={{ position: 'absolute', top: height * startY, left: '50%', transform: 'translateX(-50%)', opacity: 0 }}>
        {children}
      </div>
    );
  }

  const dropDuration = 25;
  const bounceDuration = 15;

  let yPercent: number;
  let rotation: number;
  let squash: number;

  if (localFrame < dropDuration) {
    // Accelerating fall (quadratic easing = gravity)
    const t = localFrame / dropDuration;
    yPercent = startY + (endY - startY) * (t * t);
    rotation = t * 12;
    squash = 1;
  } else if (localFrame < dropDuration + bounceDuration) {
    // First bounce
    const bounceT = (localFrame - dropDuration) / bounceDuration;
    const bounceProgress = Math.sin(bounceT * Math.PI);
    yPercent = endY - bounceHeight * bounceProgress * bounceDamping;
    rotation = 12 * (1 - bounceT);
    // Squash on impact
    squash = bounceT < 0.2 ? 1 - bounceT * 0.3 : 1;
  } else {
    // Settled
    yPercent = endY;
    rotation = 0;
    squash = 1;
  }

  const opacity = interpolate(localFrame, [0, 5], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <div
      style={{
        position: 'absolute',
        top: height * yPercent,
        left: '50%',
        transform: `translateX(-50%) rotate(${rotation}deg) scaleY(${squash}) scaleX(${2 - squash})`,
        opacity,
      }}
    >
      {children}
    </div>
  );
};
```

## glass-shimmer

**Preferred**: Use `<GlassCard>` from Component Library:
```tsx
import { GlassCard } from './components';
<GlassCard enterFrame={30} animation="scale" glow shimmer accentColor="#8b5cf6">
  <Content />
</GlassCard>
```

**Custom alternative** (if you need standalone shimmer overlay):
Animated glass effect with traveling shimmer highlight. Use for "glass", "container", "slot" elements.

```tsx
const GlassShimmer: React.FC<{
  width: number;
  height: number;
  borderRadius?: number;
  shimmerSpeed?: number;
  glassOpacity?: number;
}> = ({
  width: boxWidth,
  height: boxHeight,
  borderRadius = 20,
  shimmerSpeed = 90,
  glassOpacity = 0.1,
}) => {
  const frame = useCurrentFrame();

  // Shimmer travels across every shimmerSpeed frames
  const shimmerProgress = (frame % shimmerSpeed) / shimmerSpeed;
  const shimmerX = interpolate(shimmerProgress, [0, 1], [-boxWidth * 0.5, boxWidth * 1.5]);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      {/* Base glass */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `rgba(255, 255, 255, ${glassOpacity})`,
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius,
        }}
      />

      {/* Top highlight */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '45%',
          background: 'linear-gradient(to bottom, rgba(255,255,255,0.15), transparent)',
          borderTopLeftRadius: borderRadius,
          borderTopRightRadius: borderRadius,
        }}
      />

      {/* Traveling shimmer */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: shimmerX,
          width: boxWidth * 0.25,
          height: '100%',
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)',
          transform: 'skewX(-20deg)',
        }}
      />
    </div>
  );
};
```

## fade-in-blur

Text or element fades in while deblurring. Use for titles, labels, professional reveals.

```tsx
const FadeInBlur: React.FC<{
  startFrame: number;
  duration?: number;
  children: React.ReactNode;
}> = ({ startFrame, duration = 25, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - startFrame,
    fps,
    config: { damping: 25, stiffness: 70 },
  });

  const opacity = Math.min(1, progress);
  const blur = interpolate(progress, [0, 1], [15, 0], { extrapolateRight: 'clamp' });
  const y = interpolate(progress, [0, 1], [20, 0], { extrapolateRight: 'clamp' });

  return (
    <div
      style={{
        opacity,
        filter: `blur(${blur}px)`,
        transform: `translateY(${y}px)`,
      }}
    >
      {children}
    </div>
  );
};
```

## draw-stroke

SVG stroke animation for drawing lines, X marks, checkmarks. Use for "crosses out", "draws", "marks".

```tsx
const DrawStroke: React.FC<{
  startFrame: number;
  duration?: number;
  path: string;
  color?: string;
  strokeWidth?: number;
}> = ({
  startFrame,
  duration = 30,
  path,
  color = COLORS.danger,
  strokeWidth = 8,
}) => {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();

  const progress = interpolate(
    frame,
    [startFrame, startFrame + duration],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // Estimate path length (adjust based on actual path)
  const pathLength = 1000;

  return (
    <svg
      viewBox="0 0 100 100"
      style={{
        width: height * 0.15,
        height: height * 0.15,
        overflow: 'visible',
      }}
    >
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={pathLength}
        strokeDashoffset={pathLength * (1 - progress)}
        style={{
          filter: `drop-shadow(0 0 ${strokeWidth}px ${color})`,
        }}
      />
    </svg>
  );
};

// Common paths
const PATHS = {
  // X mark
  cross: 'M 20 20 L 80 80 M 80 20 L 20 80',
  // Checkmark
  check: 'M 20 50 L 40 70 L 80 30',
  // Circle
  circle: 'M 50 10 A 40 40 0 1 1 49.99 10',
};
```

## scale-spring

**Preferred**: Use `<Bounce>` or `<SpringScale>` from Component Library:
```tsx
import { Bounce, SpringScale } from './components';
<Bounce startFrame={30}>
  <MyElement />
</Bounce>
// or
<SpringScale startFrame={30} fromScale={0} toScale={1}>
  <MyElement />
</SpringScale>
```

**Custom alternative** (if you need specific config):
Bouncy entrance animation. Use for any element that "appears", "pops in", "enters".

```tsx
const ScaleSpring: React.FC<{
  startFrame: number;
  delay?: number;
  config?: { damping?: number; stiffness?: number; mass?: number };
  children: React.ReactNode;
}> = ({
  startFrame,
  delay = 0,
  config = { damping: 12, stiffness: 100, mass: 0.8 },
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    frame: frame - startFrame - delay,
    fps,
    config,
  });

  const opacity = interpolate(scale, [0, 0.5], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <div
      style={{
        transform: `scale(${scale})`,
        opacity,
      }}
    >
      {children}
    </div>
  );
};
```

## 3d-rotation

3D rotating element (like a die). Use for "die", "cube", "spin" concepts.

```tsx
const Rotating3D: React.FC<{
  size: number;
  isSpinning: boolean;
  result?: React.ReactNode;
  spinSpeed?: number;
}> = ({ size, isSpinning, result, spinSpeed = 8 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const rotationX = isSpinning
    ? frame * spinSpeed
    : spring({ frame, fps, config: { damping: 20, stiffness: 60 } }) * 20;

  const rotationY = isSpinning
    ? frame * spinSpeed * 1.3
    : spring({ frame, fps, config: { damping: 20, stiffness: 60 } }) * -20;

  return (
    <div style={{ perspective: 1000, width: size, height: size }}>
      <div
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          transformStyle: 'preserve-3d',
          transform: `rotateX(${rotationX}deg) rotateY(${rotationY}deg)`,
        }}
      >
        {/* Front face */}
        <CubeFace size={size} transform={`translateZ(${size / 2}px)`}>
          {isSpinning ? '?' : result}
        </CubeFace>
        {/* Back face */}
        <CubeFace size={size} transform={`rotateY(180deg) translateZ(${size / 2}px)`} />
        {/* Right face */}
        <CubeFace size={size} transform={`rotateY(90deg) translateZ(${size / 2}px)`} />
        {/* Left face */}
        <CubeFace size={size} transform={`rotateY(-90deg) translateZ(${size / 2}px)`} />
        {/* Top face */}
        <CubeFace size={size} transform={`rotateX(90deg) translateZ(${size / 2}px)`} />
        {/* Bottom face */}
        <CubeFace size={size} transform={`rotateX(-90deg) translateZ(${size / 2}px)`} />
      </div>
    </div>
  );
};

const CubeFace: React.FC<{
  size: number;
  transform: string;
  children?: React.ReactNode;
}> = ({ size, transform, children }) => (
  <div
    style={{
      position: 'absolute',
      width: size,
      height: size,
      background: COLORS.bg,
      border: `3px solid ${COLORS.primary}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: size * 0.5,
      color: COLORS.primary,
      fontWeight: 'bold',
      transform,
      boxShadow: 'inset 0 0 30px rgba(0,0,0,0.4)',
    }}
  >
    {children}
  </div>
);
```

---

## Hero Moment Treatment

EVERY hero_moment in the plan MUST use this wrapper or equivalent emphasis:

```tsx
const HeroMoment: React.FC<{
  isActive: boolean;
  glowColor?: string;
  scaleBoost?: number;
  children: React.ReactNode;
}> = ({ isActive, glowColor = COLORS.primary, scaleBoost = 1.15, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (!isActive) return <>{children}</>;

  const scale = spring({
    frame,
    fps,
    config: { damping: 10, stiffness: 80 },
  }) * scaleBoost;

  // Pulsing glow
  const glowSize = 20 + Math.sin(frame * 0.15) * 10;

  // Subtle float
  const floatY = Math.sin(frame * 0.08) * 4;

  return (
    <div
      style={{
        transform: `scale(${scale}) translateY(${floatY}px)`,
        filter: `drop-shadow(0 0 ${glowSize}px ${glowColor})`,
      }}
    >
      {children}
    </div>
  );
};
```

---

## Fill Animation (Progress Bars)

Use for "fills up", "loading", "progress" visualizations.

```tsx
const FillAnimation: React.FC<{
  startFrame: number;
  endFrame: number;
  color?: string;
  direction?: 'horizontal' | 'vertical';
}> = ({ startFrame, endFrame, color = COLORS.danger, direction = 'horizontal' }) => {
  const frame = useCurrentFrame();

  const progress = interpolate(
    frame,
    [startFrame, endFrame],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  const transform = direction === 'horizontal'
    ? `scaleX(${progress})`
    : `scaleY(${progress})`;

  const transformOrigin = direction === 'horizontal' ? 'left' : 'bottom';

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: color,
        transform,
        transformOrigin,
      }}
    />
  );
};
```

---

## Usage Rules

1. **Match technique to plan**: If plan says `particle-emitter`, use the ParticleEmitter component above
2. **Don't simplify**: A "particle-emitter" is NOT just divs with opacity - it needs physics
3. **Combine with hero treatment**: Hero moments should wrap content in HeroMoment component
4. **Respect timing**: `at_frame` in the plan = `startFrame` prop in these components
5. **Add effects**: If plan mentions "motion-blur", add `filter: blur(0.5px)` to moving elements
