# Component Library Reference

**This library is OPTIONAL.** Create custom components whenever needed - the library just provides shortcuts for common patterns. Custom code is often better for unique visualizations.

## Available Components (Optional Shortcuts)

### Animation & Motion
| You Need | Use This Component | Import |
|----------|-------------------|--------|
| Objects falling with bounce | `GravityDrop` | `from './components'` |
| Bouncy entrance | `Bounce` or `SpringScale` | `from './components'` |
| Object traveling along a path | `PathFollow` | `from './components'` |
| Arc motion between points | `ArcTravel` | `from './components'` |
| List items entering sequentially | `Stagger` | `from './components'` |
| Chained animations | `SequenceAnimation` | `from './components'` |

### Visual Effects
| You Need | Use This Component | Import |
|----------|-------------------|--------|
| Flowing particles (data streams) | `ParticleStream` | `from './components'` |
| Celebration effect | `Confetti` | `from './components'` |
| Radial burst/explosion | `Burst` | `from './components'` |
| Pulsing orb (server/node) | `GlowingOrb` | `from './components'` |
| Glassmorphism card | `GlassCard` | `from './components'` |
| Animated gradient text | `GradientText` | `from './components'` |
| Glow wrapper | `Glow` | `from './components'` |
| Shimmer/shine effect | `Shimmer` | `from './components'` |
| Procedural noise background | `NoiseBackground` | `from './components'` |
| Animated geometric shapes | `AnimatedShape` | `from './components'` |
| Audio waveform visualization | `AudioWaveform` | `from './components'` |

### Advanced Effects (Official Remotion Packages)
| You Need | Use This Component | Import |
|----------|-------------------|--------|
| Motion blur/trails | `MotionBlurWrapper` | `from './components'` |
| Scene transitions | `SceneTransition` | `from './components'` |

### Data Visualization
| You Need | Use This Component | Import |
|----------|-------------------|--------|
| Circular progress | `ProgressRing` | `from './components'` |
| Animated counting numbers | `Counter` | `from './components'` |
| Bar chart with animation | `BarChart` | `from './components'` |
| Line graph with drawing | `LineGraph` | `from './components'` |
| Hero statistic with context | `BigNumber` | `from './components'` |
| Percentage with visual | `PercentageBar` | `from './components'` |

### Educational Components (Short-Form Content)
| You Need | Use This Component | Import |
|----------|-------------------|--------|
| A vs B comparison | `ComparisonSplit` | `from './components'` |
| Step-by-step process | `ProcessFlow` | `from './components'` |
| Hierarchical structure | `TreeDiagram` | `from './components'` |
| Layered architecture | `LayerStack` | `from './components'` |
| Syntax-highlighted code | `CodeBlock` | `from './components'` |
| Terminal/CLI output | `Terminal` | `from './components'` |
| Browser window frame | `BrowserMockup` | `from './components'` |
| Draw attention to area | `Callout` | `from './components'` |
| Label with pointer | `Annotation` | `from './components'` |
| Focus/highlight region | `Spotlight` | `from './components'` |
| Zoom into detail | `Magnify` | `from './components'` |
| Hidden → revealed content | `Reveal` | `from './components'` |
| Strikethrough/wrong way | `CrossOut` | `from './components'` |
| Correct indicator | `Checkmark` | `from './components'` |
| Wrong indicator | `XMark` | `from './components'` |
| Group items with brace | `Bracket` | `from './components'` |
| Pose question to viewer | `QuestionPrompt` | `from './components'` |

### Layout
| You Need | Use This Component | Import |
|----------|-------------------|--------|
| Subtitle-safe container | `SafeZone` | `from './components'` |
| Typewriter text | `TypeWriter` | `from './components'` |

### Utilities (also available)
| You Need | Use This | Import |
|----------|----------|--------|
| Easing curves | `EASING.smoothOut`, `EASING.dramatic` | `from './components'` |
| Spring presets | `SPRING_CONFIGS.bouncy`, etc. | `from './components'` |
| Timing constants | `TIMING.fast`, `TIMING.hero` | `from './components'` |
| Color palettes | `PALETTES.modern`, `withAlpha()` | `from './components'` |

---

## Custom vs. Library - Your Choice

**Default: Create custom components.** The library is just a time-saver for common patterns.

### When Library Might Help:
- Exact match to a pattern above (e.g., you need a counter that counts up)
- You want physics animation without writing the math
- Quick prototype before customizing

### When to Create Custom (Most Cases):
- Unique visuals specific to the content
- Custom shapes, diagrams, or illustrations
- Any creative visualization
- When you have a specific vision
- When library components don't quite fit

**The best explainer videos have unique, creative visuals - don't limit yourself to pre-built components.**

---

## Component Usage Examples

### GravityDrop - Physics Falling Animation
```tsx
import { GravityDrop } from './components';

// Ball drops from above and bounces
<GravityDrop dropFrame={30} targetY={80} bounceCount={3}>
  <div style={{
    width: minDim * 0.08,
    height: minDim * 0.08,
    borderRadius: '50%',
    background: '#ef4444',
  }} />
</GravityDrop>
```

### PathFollow - Data Flow Animation
```tsx
import { PathFollow } from './components';

// Request traveling from client to server
<PathFollow
  startX={10} startY={50}
  endX={90} endY={50}
  arcHeight={-15}
  startFrame={0}
  durationFrames={60}
  showTrail
  trailColor="#8b5cf6"
>
  <DataPacketIcon />
</PathFollow>
```

### Stagger - List Entrance
```tsx
import { Stagger } from './components';

// Steps appearing one by one
<Stagger startFrame={30} delayFrames={10} animationType="slideUp">
  <Step>Step 1: Initialize</Step>
  <Step>Step 2: Process</Step>
  <Step>Step 3: Return</Step>
</Stagger>
```

### ParticleStream - Data Flow Visualization
```tsx
import { ParticleStream } from './components';

// Premium data stream with trails and depth
<ParticleStream
  direction="right"
  density={50}
  color="#06b6d4"
  secondaryColor="#8b5cf6"
  speed={1.5}
  trails
  depth
  glowIntensity={1.2}
/>
```

### Counter - Animated Statistics
```tsx
import { Counter } from './components';

// Premium counter with glow and gradient
<Counter
  from={0}
  to={1000000}
  startFrame={30}
  durationFrames={60}
  format="compact"  // Shows "1M"
  suffix=" req/s"
  animationStyle="dramatic"
  glow
  gradient
  gradientColors={['#8b5cf6', '#06b6d4']}
  punchOnComplete
/>
```

### BarChart - Comparing Values
```tsx
import { BarChart } from './components';

<BarChart
  data={[
    { label: 'Redis', value: 95, color: '#ef4444' },
    { label: 'PostgreSQL', value: 60, color: '#3b82f6' },
    { label: 'MongoDB', value: 75, color: '#22c55e' },
  ]}
  startFrame={45}
  staggerFrames={8}
  orientation="horizontal"
/>
```

### GlowingOrb - Server/Node Representation
```tsx
import { GlowingOrb } from './components';

// Premium pulsing server node with sparkle and ring
<GlowingOrb
  size={1.5}
  color="#8b5cf6"
  secondaryColor="#06b6d4"
  glowIntensity={1.2}
  pulseSpeed={0.8}
  sparkle
  ring
/>
```

### SafeZone - Layout Container
```tsx
import { SafeZone } from './components';

// Wrap all content to respect subtitle area
<AbsoluteFill style={{ background: '#0f0f23' }}>
  <SafeZone direction="column" gap={3}>
    <Title>System Architecture</Title>
    <Diagram />
  </SafeZone>
</AbsoluteFill>
```

### NoiseBackground - Procedural Textures
```tsx
import { NoiseBackground } from './components';

// Animated cloud-like background
<NoiseBackground
  color="#8b5cf6"
  secondaryColor="#06b6d4"
  type="clouds"
  speed={0.5}
  opacity={0.3}
/>
```

### AnimatedShape - Geometric Shapes
```tsx
import { AnimatedShape } from './components';

// Star that draws itself
<AnimatedShape
  shape="star"
  size={100}
  fill="#8b5cf6"
  animation="draw"
  startFrame={30}
  durationFrames={45}
  points={5}
  glow
/>
```

### MotionBlurWrapper - Cinematic Blur
```tsx
import { MotionBlurWrapper } from './components';

// Add motion trail to fast-moving element
<MotionBlurWrapper type="trail" trailAmount={5} trailLag={0.1}>
  <FlyingObject style={{ position: 'absolute', transform: `translateX(${x}px)` }} />
</MotionBlurWrapper>
```

### SceneTransition - Professional Transitions
```tsx
import { SceneTransition } from './components';

// Multi-scene video with slide transitions
<SceneTransition
  transition="slide-left"
  transitionDuration={20}
  scenes={[
    { durationInFrames: 90, content: <IntroScene /> },
    { durationInFrames: 120, content: <MainScene /> },
    { durationInFrames: 90, content: <OutroScene /> },
  ]}
/>
```

### AudioWaveform - Audio Visualization
```tsx
import { AudioWaveform } from './components';
import { staticFile } from 'remotion';

// Bar-style audio waveform
<AudioWaveform
  audioSrc={staticFile('podcast.mp3')}
  style="bars"
  color="#8b5cf6"
  secondaryColor="#06b6d4"
  numberOfSamples={32}
  glow
  mirror
/>
```

---

## Combining Components

### Example: Server Communication Flow
```tsx
import {
  SafeZone,
  GlowingOrb,
  PathFollow,
  Burst,
  Counter,
} from './components';

const ServerFlow = () => {
  const frame = useCurrentFrame();

  return (
    <SafeZone>
      {/* Client */}
      <div style={{ position: 'absolute', left: '15%', top: '50%' }}>
        <GlowingOrb color="#3b82f6" />
      </div>

      {/* Request traveling */}
      <PathFollow
        startX={15} startY={50}
        endX={85} endY={50}
        arcHeight={-10}
        startFrame={30}
        durationFrames={45}
      >
        <RequestIcon />
      </PathFollow>

      {/* Server */}
      <div style={{ position: 'absolute', left: '85%', top: '50%' }}>
        <GlowingOrb color="#8b5cf6" size={1.2} />
      </div>

      {/* Impact burst when request arrives */}
      <Burst triggerFrame={75} x={85} y={50} color="#22c55e" />

      {/* Response counter */}
      {frame >= 80 && (
        <Counter from={0} to={200} startFrame={80} durationFrames={30} suffix="ms" />
      )}
    </SafeZone>
  );
};
```

---

## Props Quick Reference

### Animation Components

| Component | Key Props |
|-----------|-----------|
| `GravityDrop` | `dropFrame`, `targetY`, `bounceCount` |
| `Bounce` | `startFrame`, `damping`, `stiffness` |
| `SpringScale` | `startFrame`, `fromScale`, `toScale`, `config` |
| `PathFollow` | `startX/Y`, `endX/Y`, `arcHeight`, `startFrame`, `durationFrames` |
| `ArcTravel` | `from`, `to`, `startFrame`, `durationFrames`, `arcDirection` |
| `Stagger` | `startFrame`, `delayFrames`, `animationType` |
| `SequenceAnimation` | `steps`, `startFrame` |
| `SceneTransition` | `scenes`, `transition`, `transitionDuration`, `timing` |
| `MotionBlurWrapper` | `type`, `trailAmount`, `trailLag`, `cameraSamples` |

### Visual Components

| Component | Key Props |
|-----------|-----------|
| `ParticleStream` | `direction`, `density`, `color`, `trails`, `depth`, `glowIntensity` |
| `Confetti` | `triggerFrame`, `colors`, `count`, `originX/Y` |
| `Burst` | `triggerFrame`, `x`, `y`, `color`, `radius` |
| `GlowingOrb` | `size`, `color`, `glowIntensity`, `sparkle`, `ring` |
| `ProgressRing` | `startFrame`, `endFrame` OR `progress`, `color` |
| `GlassCard` | `enterFrame`, `animation`, `glow`, `innerHighlight`, `shimmer` |
| `GradientText` | `text`, `colors`, `animateGradient`, `glow` |
| `Counter` | `from`, `to`, `format`, `glow`, `gradient`, `animationStyle` |
| `BarChart` | `data`, `startFrame`, `orientation` |
| `LineGraph` | `data`, `startFrame`, `durationFrames`, `color` |
| `AudioWaveform` | `audioSrc`, `style`, `color`, `numberOfSamples`, `glow` |
| `NoiseBackground` | `color`, `type`, `speed`, `opacity`, `scale` |
| `AnimatedShape` | `shape`, `size`, `fill`, `animation`, `startFrame` |

### Layout Components

| Component | Key Props |
|-----------|-----------|
| `SafeZone` | `padding`, `direction`, `alignItems`, `gap` |

### Educational Components (Short-Form Content)

| Component | Key Props |
|-----------|-----------|
| `ComparisonSplit` | `startFrame`, `leftLabel`, `rightLabel`, `animationStyle`, `showDivider` |
| `ProcessFlow` | `startFrame`, `direction`, `staggerFrames`, `connectionStyle` |
| `TreeDiagram` | `startFrame`, `staggerFrames`, `lineColor`, `animationStyle` |
| `LayerStack` | `startFrame`, `staggerFrames`, `direction`, `style` |
| `CodeBlock` | `code`, `language`, `highlightLines`, `typewriter`, `focusLines` |
| `Terminal` | `startFrame`, `title`, `theme` |
| `BrowserMockup` | `url`, `startFrame`, `showAddressBar`, `showButtons` |
| `Callout` | `startFrame`, `targetX/Y`, `text`, `position`, `showArrow`, `pulse` |
| `Annotation` | `startFrame`, `x`, `y`, `text`, `pointerDirection`, `animated` |
| `Spotlight` | `startFrame`, `x`, `y`, `radius`, `dimmingOpacity`, `animationStyle` |
| `Magnify` | `startFrame`, `x`, `y`, `scale`, `radius`, `showBorder` |
| `Reveal` | `startFrame`, `effect`, `duration`, `direction` |
| `CrossOut` | `startFrame`, `color`, `thickness`, `style`, `animated` |
| `Checkmark` | `startFrame`, `color`, `size`, `glow`, `animated` |
| `XMark` | `startFrame`, `color`, `size`, `glow`, `animated`, `shake` |
| `Bracket` | `startFrame`, `side`, `label`, `color`, `animated` |
| `QuestionPrompt` | `startFrame`, `question`, `style`, `options`, `revealFrame` |
| `BigNumber` | `value`, `label`, `format`, `countUp`, `glow`, `color` |
| `PercentageBar` | `value`, `startFrame`, `color`, `label`, `showValue`, `animated` |

---

## Common Patterns

### "Data flowing from A to B"
```tsx
<PathFollow startX={10} startY={50} endX={90} endY={50} startFrame={0} durationFrames={60}>
  <DataIcon />
</PathFollow>
```

### "Numbers counting up"
```tsx
<Counter from={0} to={targetValue} startFrame={0} durationFrames={90} format="compact" />
```

### "Items appearing one by one"
```tsx
<Stagger startFrame={0} delayFrames={8}>
  {items.map((item, i) => <Item key={i} data={item} />)}
</Stagger>
```

### "Success celebration"
```tsx
<Confetti triggerFrame={successFrame} colors={['#22c55e', '#06b6d4', '#8b5cf6']} />
```

### "Impact moment"
```tsx
<Burst triggerFrame={impactFrame} x={50} y={50} color="#ef4444" />
```

### "Background data stream"
```tsx
<ParticleStream direction="right" density={30} color="#06b6d480" />
```

### "Premium card with glassmorphism"
```tsx
<GlassCard enterFrame={30} animation="scale" glow accentColor="#8b5cf6">
  <h2>Feature Name</h2>
  <p>Description</p>
</GlassCard>
```

### "Eye-catching gradient title"
```tsx
<GradientText
  text="Amazing Feature"
  colors={['#8b5cf6', '#06b6d4', '#22c55e']}
  animateGradient
  glow
/>
```

### "Code/terminal typing effect"
```tsx
<TypeWriter text="npm install awesome" startFrame={30} showCursor />
```

### "A vs B comparison"
```tsx
<ComparisonSplit leftLabel="Bad" rightLabel="Good" animationStyle="wipe">
  <ComparisonSplit.Left><CodeBlock code={badCode} /></ComparisonSplit.Left>
  <ComparisonSplit.Right><CodeBlock code={goodCode} highlight={[2]} /></ComparisonSplit.Right>
</ComparisonSplit>
```

### "Step-by-step process"
```tsx
<ProcessFlow startFrame={0} staggerFrames={20} connectionStyle="arrow">
  <ProcessFlow.Step icon="📥" label="Input" />
  <ProcessFlow.Step icon="⚙️" label="Process" />
  <ProcessFlow.Step icon="📤" label="Output" />
</ProcessFlow>
```

### "Code with annotations"
```tsx
<div style={{ position: 'relative' }}>
  <CodeBlock code={code} highlightLines={[3]} />
  <Annotation x={85} y={30} text="Key line!" startFrame={45} />
</div>
```

### "Reveal the answer"
```tsx
<Reveal startFrame={60} effect="blur">
  <BigNumber value={42} label="The Answer" glow />
</Reveal>
```

### "Wrong vs right way"
```tsx
<CrossOut startFrame={30}><Text>Bad approach</Text></CrossOut>
<Checkmark startFrame={60} /><Text>Good approach</Text>
```

### "Architecture layers"
```tsx
<LayerStack startFrame={0} style="3d" staggerFrames={15}>
  <LayerStack.Layer label="Frontend" color="#3b82f6" />
  <LayerStack.Layer label="API" color="#8b5cf6" />
  <LayerStack.Layer label="Database" color="#22c55e" />
</LayerStack>
```

### "Quiz engagement"
```tsx
<QuestionPrompt question="What's the complexity?" startFrame={0} style="dramatic" />
```

### "Focus on specific area"
```tsx
<Spotlight startFrame={45} x={50} y={40} radius={15} />
```

### "Group related items"
```tsx
<Bracket side="right" label="O(n) total" startFrame={30}>
  <OperationsList />
</Bracket>
```

### "Using easing utilities"
```tsx
import { EASING, SPRING_CONFIGS, TIMING, PALETTES, GRADIENTS } from './components';

// Cinematic easing
const opacity = interpolate(frame, [0, 30], [0, 1], { easing: EASING.smoothOut });

// Spring with preset
const scale = spring({ frame, fps, config: SPRING_CONFIGS.bouncy });

// Premium color palette (8 available: modern, minimal, luxury, playful, nature, ocean, sunset, midnight)
const bg = PALETTES.modern.bg;
const accent = PALETTES.modern.accent;
const primaryLight = PALETTES.modern.primaryLight;

// Pre-built gradients
const techGradient = GRADIENTS.tech; // purple to cyan
const meshBg = GRADIENTS.mesh; // premium mesh background
```

### "Using color utilities"
```tsx
import { lighten, darken, withAlpha, layeredGlow, premiumShadow, colorScheme } from './components';

// Color manipulation
const lighter = lighten('#8b5cf6', 20);
const darker = darken('#8b5cf6', 20);
const transparent = withAlpha('#8b5cf6', 0.5);

// Premium effects
const glow = layeredGlow('#8b5cf6', 20, 1.2); // multi-layered glow shadow
const shadow = premiumShadow('lg'); // premium shadow stack

// Generate color scheme from base
const scheme = colorScheme('#8b5cf6');
// scheme.base, scheme.light, scheme.dark, scheme.muted, scheme.glow
```

---

## Educational Components (Short-Form Content Moat)

These components are specifically designed for educational explainer videos with **premium, cinematic aesthetics**. The design language is "Editorial Noir" - dramatic lighting, precise typography, and purposeful negative space.

### Design System Constants

```tsx
// Premium typography - use throughout for consistency
const TYPOGRAPHY = {
  // Display: Bold, dramatic headlines
  display: {
    fontFamily: "'Instrument Sans', 'SF Pro Display', system-ui",
    fontWeight: 700,
    letterSpacing: '-0.03em',
  },
  // Mono: Code and technical content
  mono: {
    fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
    fontWeight: 500,
    letterSpacing: '-0.01em',
  },
  // Label: Small caps, tracking
  label: {
    fontFamily: "'Instrument Sans', system-ui",
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
  },
};

// Cinematic color system
const CINEMA = {
  // Deep blacks with blue undertone
  void: '#05080f',
  ink: '#0a0f1a',
  slate: '#151c2c',

  // Accent spectrum
  electric: '#6366f1',  // Primary - electric indigo
  cyan: '#22d3ee',      // Secondary - sharp cyan
  ember: '#f43f5e',     // Danger/wrong - rose
  mint: '#34d399',      // Success/correct - emerald
  gold: '#fbbf24',      // Highlight - amber

  // Neutrals with warmth
  ash: '#64748b',
  silver: '#94a3b8',
  bone: '#f1f5f9',
};

// Premium shadows and glows
const EFFECTS = {
  // Layered depth shadows
  shadowDeep: `
    0 4px 6px -1px rgba(0, 0, 0, 0.3),
    0 10px 20px -2px rgba(0, 0, 0, 0.25),
    0 25px 50px -5px rgba(0, 0, 0, 0.2)
  `,
  // Inner glow for containers
  innerGlow: (color: string) => `inset 0 1px 0 0 ${color}22, inset 0 -1px 0 0 ${color}11`,
  // Neon glow for accents
  neonGlow: (color: string, intensity = 1) => `
    0 0 ${10 * intensity}px ${color}40,
    0 0 ${30 * intensity}px ${color}20,
    0 0 ${60 * intensity}px ${color}10
  `,
};
```

### ComparisonSplit - Cinematic A vs B

A dramatic split-screen comparison with diagonal wipe transitions and premium labeling.

```tsx
import { ComparisonSplit } from './components';

// Premium comparison with diagonal wipe
<ComparisonSplit
  startFrame={30}
  leftLabel="BEFORE"
  rightLabel="AFTER"
  // Cinematic diagonal wipe with glow edge
  animationStyle="diagonal"  // "diagonal" | "vertical" | "horizontal" | "iris"
  // Edge treatments
  dividerStyle="glow"  // "glow" | "sharp" | "gradient" | "none"
  dividerColor={CINEMA.electric}
  // Label positioning
  labelPosition="corner"  // "corner" | "center" | "floating"
  // Background treatment per side
  leftTint={CINEMA.ember + '15'}
  rightTint={CINEMA.mint + '15'}
>
  <ComparisonSplit.Left>
    {/* Content styled with "wrong" treatment */}
    <div style={{
      filter: 'saturate(0.7)',
      opacity: 0.85,
    }}>
      <BigNumber value={2500} suffix="ms" mood="negative" />
    </div>
  </ComparisonSplit.Left>
  <ComparisonSplit.Right>
    {/* Content styled with "right" treatment */}
    <div style={{
      filter: 'saturate(1.1)',
    }}>
      <BigNumber value={50} suffix="ms" mood="positive" glow />
    </div>
  </ComparisonSplit.Right>
</ComparisonSplit>

// Minimal editorial style
<ComparisonSplit
  startFrame={0}
  leftLabel="Naive"
  rightLabel="Optimized"
  animationStyle="vertical"
  dividerStyle="sharp"
  labelPosition="floating"
  // Floating labels with backdrop blur
  labelStyle={{
    ...TYPOGRAPHY.label,
    fontSize: height * 0.018,
    padding: `${height * 0.008}px ${height * 0.016}px`,
    background: 'rgba(0,0,0,0.6)',
    backdropFilter: 'blur(12px)',
    borderRadius: height * 0.006,
    border: `1px solid ${CINEMA.silver}22`,
  }}
>
  {/* ... content ... */}
</ComparisonSplit>
```

### ProcessFlow - Cinematic Step Sequences

Premium step-by-step visualization with animated connectors, particle trails, and dramatic reveals.

```tsx
import { ProcessFlow } from './components';

// Horizontal timeline with animated beam connectors
<ProcessFlow
  startFrame={30}
  direction="horizontal"
  staggerFrames={25}
  // Premium connector styles
  connectionStyle="beam"  // "beam" | "particles" | "pulse" | "dashed" | "none"
  connectionColor={CINEMA.cyan}
  connectionGlow  // Adds neon glow to connectors
  // Step appearance animation
  stepAnimation="scale-blur"  // "scale-blur" | "drop" | "typewriter" | "glitch"
  // Step styling
  stepStyle="pill"  // "pill" | "circle" | "square" | "minimal"
>
  <ProcessFlow.Step
    number={1}
    label="PARSE"
    sublabel="Extract data"
    color={CINEMA.electric}
    // Optional icon (SVG or emoji)
    icon={<ParseIcon />}
  />
  <ProcessFlow.Step
    number={2}
    label="VALIDATE"
    sublabel="Check schema"
    color={CINEMA.cyan}
    icon={<ValidateIcon />}
  />
  <ProcessFlow.Step
    number={3}
    label="TRANSFORM"
    sublabel="Apply rules"
    color={CINEMA.gold}
    icon={<TransformIcon />}
    // Highlight current step
    active={frame >= 80 && frame < 105}
  />
  <ProcessFlow.Step
    number={4}
    label="RESPOND"
    sublabel="Return result"
    color={CINEMA.mint}
    icon={<RespondIcon />}
  />
</ProcessFlow>

// Vertical flow with card-based steps
<ProcessFlow
  startFrame={0}
  direction="vertical"
  staggerFrames={30}
  connectionStyle="particles"
  // Cards appear with staggered content
  stepAnimation="typewriter"
>
  <ProcessFlow.Step>
    <ProcessCard
      number="01"
      title="Initialize State"
      code="const state = { count: 0 };"
      annotation="O(1)"
    />
  </ProcessFlow.Step>
  <ProcessFlow.Step>
    <ProcessCard
      number="02"
      title="Iterate Stream"
      code="for (const item of stream) {"
      annotation="O(n)"
      highlight  // Glowing border treatment
    />
  </ProcessFlow.Step>
</ProcessFlow>

// Minimal numbered list style
<ProcessFlow
  startFrame={0}
  direction="vertical"
  staggerFrames={15}
  connectionStyle="none"
  stepStyle="minimal"
  // Numbers styled like editorial callouts
  numberStyle={{
    ...TYPOGRAPHY.display,
    fontSize: height * 0.08,
    color: CINEMA.electric,
    opacity: 0.3,
    marginRight: width * 0.03,
  }}
>
  <ProcessFlow.Step label="Keep first element unconditionally" />
  <ProcessFlow.Step label="For nth element, replace with probability 1/n" />
  <ProcessFlow.Step label="Result: uniform random sample" />
</ProcessFlow>
```

```tsx
// ProcessCard - Premium step card component
const ProcessCard: React.FC<{
  number: string;
  title: string;
  code?: string;
  annotation?: string;
  highlight?: boolean;
}> = ({ number, title, code, annotation, highlight }) => {
  const { height, width } = useVideoConfig();
  const minDim = Math.min(width, height);

  return (
    <div style={{
      display: 'flex',
      gap: minDim * 0.025,
      padding: minDim * 0.03,
      background: highlight
        ? `linear-gradient(135deg, ${CINEMA.electric}15 0%, ${CINEMA.ink} 100%)`
        : CINEMA.ink,
      borderRadius: minDim * 0.015,
      border: `1px solid ${highlight ? CINEMA.electric + '40' : CINEMA.slate}`,
      boxShadow: highlight ? EFFECTS.neonGlow(CINEMA.electric, 0.5) : EFFECTS.shadowDeep,
    }}>
      {/* Large editorial number */}
      <span style={{
        ...TYPOGRAPHY.display,
        fontSize: minDim * 0.06,
        color: CINEMA.electric,
        opacity: 0.4,
        lineHeight: 1,
      }}>
        {number}
      </span>

      <div style={{ flex: 1 }}>
        {/* Title */}
        <div style={{
          ...TYPOGRAPHY.display,
          fontSize: minDim * 0.028,
          color: CINEMA.bone,
          marginBottom: minDim * 0.01,
        }}>
          {title}
        </div>

        {/* Code snippet */}
        {code && (
          <div style={{
            ...TYPOGRAPHY.mono,
            fontSize: minDim * 0.022,
            color: CINEMA.cyan,
            padding: `${minDim * 0.01}px ${minDim * 0.015}px`,
            background: CINEMA.void,
            borderRadius: minDim * 0.008,
            marginTop: minDim * 0.01,
          }}>
            {code}
          </div>
        )}

        {/* Complexity annotation */}
        {annotation && (
          <div style={{
            ...TYPOGRAPHY.label,
            fontSize: minDim * 0.016,
            color: CINEMA.gold,
            marginTop: minDim * 0.012,
          }}>
            {annotation}
          </div>
        )}
      </div>
    </div>
  );
};
```

### TreeDiagram - Cinematic Hierarchies

Premium tree visualizations with organic connector animations and highlighted paths.

```tsx
import { TreeDiagram } from './components';

// File tree with premium styling
<TreeDiagram
  startFrame={30}
  staggerFrames={10}
  // Connector styling
  lineColor={CINEMA.electric}
  lineWidth={2}
  lineStyle="organic"  // "organic" | "straight" | "rounded" | "dashed"
  lineGlow
  // Node styling
  nodeStyle={{
    padding: `${minDim * 0.01}px ${minDim * 0.018}px`,
    borderRadius: minDim * 0.008,
    background: CINEMA.slate,
    border: `1px solid ${CINEMA.ash}40`,
  }}
  labelStyle={{
    ...TYPOGRAPHY.mono,
    fontSize: minDim * 0.022,
    color: CINEMA.bone,
  }}
  // Animation
  animationStyle="grow"  // "grow" | "fade" | "drop" | "trace"
  growFromRoot  // Lines grow outward from root
>
  <TreeDiagram.Node
    label="src"
    icon={<FolderIcon color={CINEMA.gold} />}
    expanded
  >
    <TreeDiagram.Node
      label="components"
      icon={<FolderIcon color={CINEMA.cyan} />}
    >
      <TreeDiagram.Node
        label="Button.tsx"
        icon={<FileIcon color={CINEMA.electric} />}
        highlight  // Glowing highlight
        highlightColor={CINEMA.electric}
      />
      <TreeDiagram.Node
        label="Card.tsx"
        icon={<FileIcon color={CINEMA.electric} />}
      />
    </TreeDiagram.Node>
    <TreeDiagram.Node
      label="index.ts"
      icon={<FileIcon color={CINEMA.mint} />}
    />
  </TreeDiagram.Node>
</TreeDiagram>

// Decision tree with path highlighting
<TreeDiagram
  startFrame={0}
  animationStyle="trace"
  // Highlight the "winning" path
  highlightPath={['root', 'yes', 'result']}
  highlightColor={CINEMA.mint}
  highlightGlow
  // Dim non-highlighted branches
  dimInactive
  dimOpacity={0.4}
>
  <TreeDiagram.Node id="root" label="Is N > 10?">
    <TreeDiagram.Node id="yes" label="Yes">
      <TreeDiagram.Node id="result" label="Use Binary Search" color={CINEMA.mint} />
    </TreeDiagram.Node>
    <TreeDiagram.Node id="no" label="No">
      <TreeDiagram.Node label="Linear is fine" color={CINEMA.silver} />
    </TreeDiagram.Node>
  </TreeDiagram.Node>
</TreeDiagram>

// Horizontal org-chart style
<TreeDiagram
  startFrame={30}
  direction="horizontal"  // "vertical" | "horizontal"
  alignment="center"
  nodeStyle={{
    padding: minDim * 0.015,
    borderRadius: minDim * 0.01,
    background: `linear-gradient(135deg, ${CINEMA.ink} 0%, ${CINEMA.slate} 100%)`,
    boxShadow: EFFECTS.shadowDeep,
  }}
/>
```

### LayerStack - Cinematic Architecture Diagrams

Premium layered stack visualizations with 3D depth, glow effects, and animated data flow.

```tsx
import { LayerStack } from './components';

// 3D isometric tech stack
<LayerStack
  startFrame={30}
  staggerFrames={15}
  direction="up"
  style="3d"
  // 3D configuration
  perspective={1000}
  rotateX={-25}
  rotateY={-10}
  layerDepth={15}  // 3D depth per layer
  // Layer styling
  layerStyle={{
    padding: `${minDim * 0.02}px ${minDim * 0.05}px`,
    borderRadius: minDim * 0.012,
    boxShadow: EFFECTS.shadowDeep,
  }}
  // Animation
  animation="stack"  // "stack" | "drop" | "slide" | "grow"
  // Gap between layers
  gap={minDim * 0.015}
>
  <LayerStack.Layer
    label="Database"
    sublabel="PostgreSQL"
    color={CINEMA.ember}
    icon={<DatabaseIcon />}
    // Per-layer customization
    glow
    glowIntensity={0.3}
  />
  <LayerStack.Layer
    label="Cache"
    sublabel="Redis"
    color={CINEMA.gold}
    icon={<CacheIcon />}
  />
  <LayerStack.Layer
    label="API"
    sublabel="Node.js"
    color={CINEMA.electric}
    icon={<ServerIcon />}
    // Highlight this layer
    highlight
    highlightPulse
  />
  <LayerStack.Layer
    label="Frontend"
    sublabel="React"
    color={CINEMA.cyan}
    icon={<WebIcon />}
  />
  <LayerStack.Layer
    label="CDN"
    sublabel="CloudFlare"
    color={CINEMA.mint}
    icon={<CloudIcon />}
  />
</LayerStack>

// Flat minimal style with data flow
<LayerStack
  startFrame={0}
  style="flat"
  staggerFrames={12}
  // Show data flow between layers
  showDataFlow
  dataFlowColor={CINEMA.cyan}
  dataFlowSpeed={1.5}
  dataFlowParticles={5}
  // Layer styling
  layerStyle={{
    padding: `${minDim * 0.018}px ${minDim * 0.04}px`,
    borderRadius: 0,  // Sharp edges
    borderLeft: `4px solid`,  // Colored left border
    background: CINEMA.ink,
  }}
>
  <LayerStack.Layer label="Application Layer" color={CINEMA.cyan} />
  <LayerStack.Layer label="Transport Layer" color={CINEMA.electric} />
  <LayerStack.Layer label="Network Layer" color={CINEMA.gold} />
  <LayerStack.Layer label="Physical Layer" color={CINEMA.ember} />
</LayerStack>

// Interactive highlight on hover equivalent (frame-based)
<LayerStack
  startFrame={0}
  style="3d"
  // Highlight layer at specific frames
  activeLayer={
    frame < 60 ? 0 :
    frame < 90 ? 1 :
    frame < 120 ? 2 : 3
  }
  activeStyle={{
    transform: 'scale(1.05) translateZ(20px)',
    boxShadow: EFFECTS.neonGlow(CINEMA.cyan),
  }}
  inactiveStyle={{
    opacity: 0.6,
    filter: 'saturate(0.7)',
  }}
/>
```

### CodeBlock - Editor-Quality Syntax Display

Premium code display with VS Code-inspired syntax highlighting, animated line focus, and cinematic typewriter effects.

```tsx
import { CodeBlock } from './components';

// Premium editor-style code display
<CodeBlock
  code={`function reservoir(stream: Iterator<T>): T {
  let result = stream.next().value;
  let count = 1;

  for (const item of stream) {
    count++;
    if (Math.random() < 1 / count) {
      result = item;  // Replace with probability 1/n
    }
  }
  return result;
}`}
  language="typescript"
  startFrame={30}
  // Premium theme with custom colors
  theme="noir"  // "noir" | "monokai" | "github-dark" | "custom"
  customColors={{
    background: CINEMA.void,
    lineNumbers: CINEMA.ash,
    keywords: CINEMA.electric,      // function, const, let, for
    strings: CINEMA.mint,           // "string literals"
    numbers: CINEMA.gold,           // 123, 0.5
    comments: CINEMA.ash,           // // comments
    functions: CINEMA.cyan,         // function names
    types: CINEMA.electric + 'cc',  // TypeScript types
    punctuation: CINEMA.silver,     // brackets, semicolons
  }}
  // Line highlighting with glow
  highlightLines={[7, 8]}
  highlightStyle="glow"  // "glow" | "solid" | "gradient" | "left-border"
  highlightColor={CINEMA.cyan}
  // Line numbers
  showLineNumbers
  lineNumberStyle={{
    ...TYPOGRAPHY.mono,
    fontSize: height * 0.02,
    color: CINEMA.ash,
    opacity: 0.5,
    paddingRight: width * 0.02,
  }}
  // Container styling
  containerStyle={{
    padding: minDim * 0.025,
    borderRadius: minDim * 0.015,
    border: `1px solid ${CINEMA.slate}`,
    boxShadow: EFFECTS.shadowDeep,
    // Subtle noise texture
    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E")`,
  }}
/>

// Typewriter effect with cursor
<CodeBlock
  code={`npm install @reservoir/sampling`}
  language="bash"
  startFrame={0}
  typewriter
  typewriterSpeed={1.5}  // Characters per frame
  // Animated cursor
  cursor={{
    style: "block",  // "block" | "line" | "underscore"
    color: CINEMA.cyan,
    blink: true,
    blinkSpeed: 15,  // frames per blink cycle
  }}
  // Terminal-style prompt
  prompt="$"
  promptColor={CINEMA.mint}
/>

// Animated line focus (dims unfocused lines)
<CodeBlock
  code={fullCode}
  language="typescript"
  startFrame={0}
  // Focus transitions between line groups
  focusSequence={[
    { lines: [1, 2], startFrame: 30, label: "Initialize" },
    { lines: [4, 5, 6, 7, 8], startFrame: 60, label: "Main loop" },
    { lines: [10], startFrame: 90, label: "Return result" },
  ]}
  focusDimOpacity={0.25}
  focusTransitionFrames={15}
  // Show label annotations
  showFocusLabels
  focusLabelStyle={{
    ...TYPOGRAPHY.label,
    fontSize: height * 0.016,
    color: CINEMA.cyan,
    background: CINEMA.ink,
    padding: `${height * 0.006}px ${height * 0.012}px`,
    borderRadius: height * 0.004,
  }}
/>

// Code diff with premium styling
<CodeBlock
  code={`- const data = fetchAll();
- processEach(data);
+ const sample = reservoir(stream);
+ process(sample);`}
  language="diff"
  startFrame={0}
  diffStyle="editorial"  // "editorial" | "github" | "minimal"
  // Diff colors
  additionColor={CINEMA.mint}
  deletionColor={CINEMA.ember}
  // Animated reveal of changes
  animateDiff
  diffStaggerFrames={20}
/>

// Mini inline code snippet
<InlineCode
  code="O(1)"
  color={CINEMA.gold}
  glow
  style={{
    ...TYPOGRAPHY.mono,
    fontSize: height * 0.028,
    padding: `${height * 0.008}px ${height * 0.015}px`,
    background: CINEMA.gold + '20',
    borderRadius: height * 0.006,
  }}
/>
```

### Terminal - Cinematic CLI Experience

Premium terminal emulator with realistic animations, scanline effects, and dramatic output reveals.

```tsx
import { Terminal } from './components';

// Premium terminal with realistic chrome
<Terminal
  startFrame={30}
  title="~/project"
  // Window chrome style
  chrome="macos"  // "macos" | "windows" | "minimal" | "none"
  chromeColor={CINEMA.slate}
  // Terminal styling
  theme="noir"
  backgroundColor={CINEMA.void}
  // Realistic effects
  scanlines  // Subtle CRT scanline effect
  glow       // Terminal text glow
  noise={0.02}  // Background noise texture
  // Container
  containerStyle={{
    borderRadius: minDim * 0.015,
    boxShadow: EFFECTS.shadowDeep,
    overflow: 'hidden',
  }}
>
  <Terminal.Command
    text="npm install @reservoir/sampling"
    delay={0}
    // Prompt styling
    prompt="→"
    promptColor={CINEMA.cyan}
    // Typewriter animation
    typewriter
    typewriterSpeed={2}
  />
  <Terminal.Output
    text={`added 3 packages in 1.2s

📦 @reservoir/sampling@2.1.0
├── @types/node@18.0.0
└── fast-random@1.0.0`}
    delay={45}
    // Staggered line reveal
    lineByLine
    lineDelay={8}
  />
  <Terminal.Command text="npm run benchmark" delay={90} />
  <Terminal.Output
    text="✓ 1,000,000 items sampled in 12ms"
    delay={120}
    success
    // Success styling
    successColor={CINEMA.mint}
    successIcon="✓"
    glow
  />
</Terminal>

// Error state with dramatic effect
<Terminal startFrame={0} chrome="minimal">
  <Terminal.Command text="node server.js" />
  <Terminal.Output
    text={`Error: ECONNREFUSED 127.0.0.1:5432

    at TCPConnectWrap.afterConnect [as oncomplete]
    Connection refused - is the database running?`}
    delay={20}
    error
    // Error styling
    errorColor={CINEMA.ember}
    errorIcon="✗"
    // Shake effect on error
    shake
    shakeIntensity={0.5}
  />
</Terminal>

// Progress/loading animation
<Terminal startFrame={0}>
  <Terminal.Command text="docker build ." />
  <Terminal.Progress
    delay={30}
    steps={[
      { text: "Step 1/5: FROM node:18", duration: 15 },
      { text: "Step 2/5: COPY package*.json ./", duration: 10 },
      { text: "Step 3/5: RUN npm install", duration: 30 },
      { text: "Step 4/5: COPY . .", duration: 10 },
      { text: "Step 5/5: CMD ['node', 'index.js']", duration: 10 },
    ]}
    progressBar
    progressColor={CINEMA.cyan}
  />
  <Terminal.Output
    text="Successfully built abc123def"
    delay={120}
    success
  />
</Terminal>
```

### BrowserMockup - Browser Window Frame
```tsx
import { BrowserMockup } from './components';

// Browser with URL bar
<BrowserMockup
  url="https://api.example.com/users"
  startFrame={30}
  showAddressBar
  showButtons
>
  <div style={{ padding: 20 }}>
    <CodeBlock code={jsonResponse} language="json" />
  </div>
</BrowserMockup>
```

### Callout - Cinematic Attention Director

Premium callout bubbles with animated connectors, backdrop blur, and dramatic entrance animations.

```tsx
import { Callout } from './components';

// Premium callout with elastic connector
<Callout
  startFrame={60}
  // Position (percentage of canvas)
  targetX={75}
  targetY={40}
  // Callout content
  text="This is the key insight!"
  // Or rich content
  content={
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Icon name="lightbulb" color={CINEMA.gold} />
      <span>Key insight!</span>
    </div>
  }
  // Position relative to target
  position="left"  // "left" | "right" | "top" | "bottom" | "auto"
  offset={20}  // distance from target
  // Styling
  backgroundColor={CINEMA.ink}
  borderColor={CINEMA.electric + '60'}
  textColor={CINEMA.bone}
  // Typography
  textStyle={{
    ...TYPOGRAPHY.display,
    fontSize: minDim * 0.024,
  }}
  // Container
  padding={minDim * 0.02}
  borderRadius={minDim * 0.012}
  backdropBlur={12}
  // Shadow
  shadow={EFFECTS.shadowDeep}
  // Connector line
  connector="elastic"  // "elastic" | "straight" | "curved" | "dashed" | "none"
  connectorColor={CINEMA.electric}
  connectorWidth={2}
  connectorGlow
  // Target indicator
  showTarget
  targetStyle="ring"  // "ring" | "dot" | "crosshair" | "none"
  targetColor={CINEMA.electric}
  targetPulse
  // Animation
  animation="pop"  // "pop" | "slide" | "fade" | "typewriter"
  // Attention effects
  pulse
  pulseColor={CINEMA.electric}
/>

// Minimal label callout
<Callout
  startFrame={30}
  targetX={50}
  targetY={30}
  text="O(1)"
  position="right"
  // Minimal style
  style="minimal"
  backgroundColor="transparent"
  textStyle={{
    ...TYPOGRAPHY.mono,
    fontSize: minDim * 0.028,
    color: CINEMA.gold,
  }}
  connector="straight"
  connectorColor={CINEMA.gold + '60'}
/>

// Multiple coordinated callouts
<CalloutGroup staggerFrames={15}>
  <Callout targetX={20} targetY={30} text="Input" icon="arrow-down" />
  <Callout targetX={50} targetY={50} text="Process" icon="cog" />
  <Callout targetX={80} targetY={70} text="Output" icon="arrow-up" />
</CalloutGroup>
```

### Annotation - Editorial Code Labels

Premium annotations with hand-drawn connector lines and editorial-style labels for code and diagram markup.

```tsx
import { Annotation } from './components';

// Editorial-style annotation
<Annotation
  startFrame={45}
  x={60}
  y={30}
  // Content
  text="O(1) lookup"
  // Or multi-line
  lines={["Constant time", "Hash table magic"]}
  // Pointer
  pointerDirection="down-left"  // cardinal + diagonal combinations
  pointerLength={40}
  pointerStyle="hand-drawn"  // "hand-drawn" | "straight" | "curved" | "bracket"
  // Colors
  color={CINEMA.mint}
  textColor={CINEMA.bone}
  // Typography
  textStyle={{
    ...TYPOGRAPHY.label,
    fontSize: minDim * 0.018,
  }}
  // Background pill
  showBackground
  backgroundColor={CINEMA.mint + '20'}
  backgroundPadding={minDim * 0.01}
  backgroundRadius={minDim * 0.006}
  // Animation
  animated
  drawDuration={20}  // frames to draw pointer
  textReveal="fade"  // "fade" | "typewriter" | "instant"
/>

// Danger/warning annotation
<Annotation
  startFrame={60}
  x={85}
  y={20}
  text="Bug here!"
  pointerDirection="left"
  color={CINEMA.ember}
  // Warning icon
  icon="warning"
  iconPosition="before"
  // Pulsing attention
  pulse
  pulseIntensity={0.3}
/>

// Complexity annotation (common pattern)
<ComplexityAnnotation
  startFrame={30}
  x={90}
  y={lineY}
  complexity="O(n)"
  color={CINEMA.gold}
/>

// Code line annotation
<div style={{ position: 'relative' }}>
  <CodeBlock code={code} />
  <Annotation
    x={95}
    y={getLineY(3)}  // Helper to get Y position of line 3
    text="The magic happens here"
    pointerDirection="left"
    pointerStyle="bracket"
    lines={3}  // Bracket spans 3 lines
    color={CINEMA.cyan}
    animated
    startFrame={60}
  />
</div>
```

### Spotlight - Cinematic Focus Effect

Premium spotlight/vignette effect that draws focus to key content with dramatic lighting.

```tsx
import { Spotlight } from './components';

// Circular spotlight with vignette
<Spotlight
  startFrame={30}
  // Center position (percentage)
  x={50}
  y={40}
  // Size
  radius={18}  // percentage of screen
  // Feathering
  feather={30}  // percentage of radius for soft edge
  // Dimming
  dimmingColor={CINEMA.void}
  dimmingOpacity={0.85}
  // Edge treatment
  edgeGlow
  edgeGlowColor={CINEMA.electric}
  edgeGlowIntensity={0.5}
  // Animation
  animation="expand"  // "expand" | "fade" | "iris" | "instant"
  animationDuration={25}
  animationEasing="smooth"
>
  <ImportantContent />
</Spotlight>

// Moving spotlight (follows content)
<Spotlight
  startFrame={30}
  // Animated position
  x={interpolate(frame, [30, 60, 90], [20, 50, 80])}
  y={50}
  radius={12}
  // Smooth position transitions
  positionSmoothing={0.15}
  // Smaller, tighter focus
  feather={20}
/>

// Rectangular spotlight
<Spotlight
  startFrame={45}
  x={50}
  y={50}
  shape="rect"  // "circle" | "rect" | "rounded-rect"
  width={40}   // percentage
  height={25}  // percentage
  borderRadius={minDim * 0.02}  // for rounded-rect
  animation="fade"
/>

// Multi-spotlight (multiple areas)
<SpotlightGroup>
  <Spotlight x={25} y={30} radius={10} />
  <Spotlight x={75} y={70} radius={10} />
</SpotlightGroup>
```

### Magnify - Cinematic Zoom Detail

Premium magnification effect with lens distortion, animated zoom, and picture-in-picture modes.

```tsx
import { Magnify } from './components';

// Magnifying lens with realistic effect
<Magnify
  startFrame={45}
  // Position (percentage)
  x={70}
  y={35}
  // Size and zoom
  scale={2.5}
  radius={15}  // percentage of screen
  // Lens styling
  lensStyle="glass"  // "glass" | "flat" | "minimal"
  borderWidth={3}
  borderColor={CINEMA.electric}
  borderGlow
  glowColor={CINEMA.electric}
  glowIntensity={0.8}
  // Glass effect
  glassReflection  // subtle reflection overlay
  glassTint={CINEMA.cyan + '10'}
  // Shadow
  shadow={EFFECTS.shadowDeep}
  // Animation
  animation="pop"  // "pop" | "grow" | "fade" | "slide-in"
  animationDuration={20}
>
  <SmallDetailedContent />
</Magnify>

// Picture-in-picture zoom
<Magnify
  startFrame={30}
  x={80}  // Inset position
  y={20}
  scale={3}
  radius={20}
  // PiP style
  style="pip"  // "lens" | "pip" | "full"
  // Connector line to source area
  showConnector
  connectorColor={CINEMA.cyan}
  connectorStyle="dashed"
  sourceX={30}  // What area is being magnified
  sourceY={50}
  sourceRadius={8}
  // Border treatment
  borderWidth={2}
  borderColor={CINEMA.slate}
  cornerRadius={minDim * 0.015}
/>

// Animated zoom sequence
<Magnify
  startFrame={30}
  endFrame={90}
  // Animate position
  x={interpolate(frame, [30, 60], [30, 70])}
  y={50}
  // Animate scale
  scale={interpolate(frame, [30, 60], [1, 2.5])}
  radius={12}
  // Smooth animations
  positionSmoothing={0.1}
  scaleSmoothing={0.15}
  // Exit animation
  animateOut
  animateOutDuration={15}
/>
```

### Reveal - Cinematic Content Unveiling

Premium reveal effects for "aha moments" with dramatic animations and particle effects.

```tsx
import { Reveal } from './components';

// Dramatic blur-to-sharp reveal
<Reveal
  startFrame={60}
  effect="blur"
  // Blur configuration
  blurStart={20}  // starting blur amount
  blurEnd={0}
  duration={25}
  // Easing
  easing="dramatic"  // "linear" | "smooth" | "dramatic" | "bounce"
  // Optional scale
  scaleFrom={0.95}
  scaleTo={1}
  // Glow on reveal
  glowOnReveal
  glowColor={CINEMA.cyan}
  glowDuration={30}
>
  <BigNumber value={42} label="The Answer" glow />
</Reveal>

// Particle scatter reveal
<Reveal
  startFrame={45}
  effect="particles"
  // Particles scatter away to reveal content
  particleCount={50}
  particleColor={CINEMA.electric}
  particleDirection="radial"  // "radial" | "up" | "down" | "random"
  particleSpeed={1.5}
  duration={30}
>
  <GradientText text="Reservoir Sampling" />
</Reveal>

// Typewriter text reveal
<Reveal
  startFrame={30}
  effect="typewriter"
  // Typewriter specific
  typewriterSpeed={2}  // chars per frame
  cursor
  cursorColor={CINEMA.cyan}
>
  <Text>The time complexity is O(n)</Text>
</Reveal>

// Glitch/digital reveal
<Reveal
  startFrame={60}
  effect="glitch"
  // Glitch configuration
  glitchIntensity={0.8}
  glitchSlices={10}
  glitchColors={[CINEMA.cyan, CINEMA.electric, CINEMA.ember]}
  duration={20}
>
  <CodeBlock code="return result;" />
</Reveal>

// Cover/scratch reveal (like lottery ticket)
<Reveal
  startFrame={45}
  effect="cover"
  // Cover properties
  coverColor={CINEMA.slate}
  coverPattern="noise"  // "solid" | "noise" | "gradient" | "stripes"
  // Reveal animation
  revealDirection="center-out"  // "left" | "right" | "center-out" | "random"
  revealStyle="dissolve"  // "dissolve" | "wipe" | "burn"
  duration={35}
>
  <CorrectAnswer />
</Reveal>

// Slide reveal with overshoot
<Reveal
  startFrame={30}
  effect="slide"
  direction="up"
  // Spring physics
  springConfig={{ damping: 12, stiffness: 100 }}
  // Mask during slide
  maskOverflow
>
  <ProcessFlow />
</Reveal>
```

### Checkmark - Cinematic Success Indicator

Premium animated checkmark with satisfying draw-in animation, particle burst, and optional sound-sync pulse.

```tsx
import { Checkmark } from './components';

// Premium checkmark with particle celebration
<Checkmark
  startFrame={60}
  // Size relative to minDim
  size={1.2}  // multiplier (1 = minDim * 0.08)
  // Colors
  color={CINEMA.mint}
  // Animation style
  animation="draw"  // "draw" | "scale" | "stamp" | "morph"
  drawDuration={20}  // frames to complete drawing
  // Effects
  glow
  glowIntensity={1.5}
  // Particle burst on complete
  particles
  particleCount={12}
  particleColors={[CINEMA.mint, CINEMA.cyan, CINEMA.gold]}
  // Optional circle/ring behind
  ring
  ringColor={CINEMA.mint + '30'}
  // Pulse on complete (for audio sync)
  pulseOnComplete
  pulseScale={1.15}
/>

// Minimal inline checkmark
<div style={{
  display: 'flex',
  alignItems: 'center',
  gap: minDim * 0.015,
}}>
  <Checkmark
    startFrame={30}
    size={0.5}
    animation="scale"
    color={CINEMA.mint}
  />
  <span style={{
    ...TYPOGRAPHY.display,
    fontSize: minDim * 0.032,
    color: CINEMA.bone,
  }}>
    Constant time lookup
  </span>
</div>

// Success badge style
<Checkmark
  startFrame={45}
  size={0.8}
  animation="stamp"
  color={CINEMA.bone}
  // Filled circle background
  filled
  fillColor={CINEMA.mint}
  // No glow for cleaner look
  glow={false}
/>
```

### XMark - Cinematic Error Indicator

Premium animated X with dramatic reveal, optional shake effect, and wrong-answer styling.

```tsx
import { XMark } from './components';

// Dramatic X with shake
<XMark
  startFrame={45}
  size={1.2}
  color={CINEMA.ember}
  // Animation
  animation="slash"  // "slash" | "draw" | "scale" | "glitch"
  slashDuration={15}
  // Effects
  glow
  glowIntensity={2}
  // Shake on complete
  shake
  shakeIntensity={0.8}
  shakeDuration={12}
  // Particle scatter (like breaking)
  shatter
  shatterParticles={8}
/>

// Subtle inline X
<XMark
  startFrame={30}
  size={0.5}
  animation="scale"
  color={CINEMA.ember}
  // Softer appearance
  opacity={0.8}
/>

// Filled badge style
<XMark
  startFrame={60}
  size={0.8}
  animation="draw"
  color={CINEMA.bone}
  filled
  fillColor={CINEMA.ember}
/>
```

### CrossOut - Cinematic Strikethrough

Premium strikethrough animation with multiple styles for crossing out wrong answers or deprecated approaches.

```tsx
import { CrossOut } from './components';

// Diagonal slash through content
<CrossOut
  startFrame={45}
  style="slash"  // "slash" | "strikethrough" | "scribble" | "redact"
  color={CINEMA.ember}
  // Slash properties
  thickness={4}
  angle={-15}  // degrees
  overshoot={0.1}  // extends past content edges
  // Animation
  animated
  duration={18}
  // Effects
  glow
  glowColor={CINEMA.ember}
  // Optional particle trail
  trail
  trailParticles={6}
>
  <Text style={{ color: CINEMA.silver }}>
    Store all items in memory
  </Text>
</CrossOut>

// Red-pen scribble style
<CrossOut
  startFrame={30}
  style="scribble"
  color={CINEMA.ember}
  // Multiple overlapping strokes
  strokes={3}
  // Rougher, hand-drawn feel
  roughness={0.5}
  animated
>
  <CodeBlock code={`array.push(item); // O(n) memory!`} />
</CrossOut>

// Redacted/censored style
<CrossOut
  startFrame={60}
  style="redact"
  color={CINEMA.void}
  // Solid bars over text
  barHeight={1.2}  // relative to text height
  // Glitch effect during reveal
  glitchIn
  glitchDuration={10}
>
  <SensitiveContent />
</CrossOut>

// Big dramatic X overlay
<CrossOut
  startFrame={45}
  style="bigX"
  color={CINEMA.ember}
  // X spans full content
  xSize={0.8}  // relative to content
  xThickness={6}
  // Stamp/slam animation
  animation="stamp"
  // Shake the content on impact
  shakeContent
>
  <OldApproachDiagram />
</CrossOut>
```

### Bracket - Cinematic Grouping Braces

Premium curly brace annotations with SVG-drawn animations and editorial labels.

```tsx
import { Bracket } from './components';

// Editorial curly brace with complexity label
<Bracket
  startFrame={30}
  side="right"
  // Label
  label="O(n)"
  labelStyle={{
    ...TYPOGRAPHY.mono,
    fontSize: minDim * 0.028,
    color: CINEMA.gold,
    fontWeight: 600,
  }}
  // Brace styling
  color={CINEMA.electric}
  thickness={3}
  style="curly"  // "curly" | "square" | "angle" | "line"
  glow
  glowIntensity={0.5}
  // Padding from content
  offset={minDim * 0.02}
  // Animation
  animated
  drawDuration={25}  // frames to draw
  drawEasing="smooth"
  // Label appears after brace
  labelDelay={15}
  labelAnimation="fade"  // "fade" | "pop" | "slide"
>
  <Stagger startFrame={0} delayFrames={8}>
    <OperationLine code="for (const item of items)" />
    <OperationLine code="  process(item)" />
    <OperationLine code="}" />
  </Stagger>
</Bracket>

// Square bracket for array notation
<Bracket
  startFrame={45}
  side="left"
  style="square"
  label="Array[0..n]"
  labelPosition="outside"  // "outside" | "inside" | "center"
  color={CINEMA.cyan}
  thickness={4}
>
  <ArrayVisualization />
</Bracket>

// Horizontal bracket (top/bottom)
<Bracket
  startFrame={30}
  side="top"
  label="These execute in parallel"
  labelStyle={{
    ...TYPOGRAPHY.label,
    fontSize: minDim * 0.016,
    color: CINEMA.silver,
    background: CINEMA.ink,
    padding: `${minDim * 0.006}px ${minDim * 0.012}px`,
    borderRadius: minDim * 0.004,
  }}
  style="curly"
  color={CINEMA.mint}
  animated
>
  <div style={{ display: 'flex', gap: minDim * 0.03 }}>
    <Task label="Task A" />
    <Task label="Task B" />
    <Task label="Task C" />
  </div>
</Bracket>

// Nested brackets for complexity breakdown
<Bracket side="right" label="O(n)" color={CINEMA.gold} startFrame={30}>
  <Bracket side="right" label="O(1)" color={CINEMA.mint} startFrame={50} nested>
    <SingleOperation />
  </Bracket>
  <MultipleOperations />
</Bracket>
```

### QuestionPrompt - Cinematic Engagement Hooks

Premium question displays for viewer engagement with dramatic typography and quiz-style interactions.

```tsx
import { QuestionPrompt } from './components';

// Dramatic hook question (opening)
<QuestionPrompt
  startFrame={0}
  question="What's the time complexity?"
  // Style preset
  style="dramatic"  // "dramatic" | "editorial" | "minimal" | "quiz"
  // Typography
  questionStyle={{
    ...TYPOGRAPHY.display,
    fontSize: height * 0.055,
    textAlign: 'center',
    lineHeight: 1.2,
  }}
  // Colors
  color={CINEMA.bone}
  accentColor={CINEMA.cyan}
  // Question mark treatment
  showQuestionMark
  questionMarkStyle="floating"  // "floating" | "inline" | "giant-bg" | "none"
  questionMarkColor={CINEMA.electric}
  questionMarkGlow
  // Animation
  animation="word-by-word"  // "word-by-word" | "char-by-char" | "fade" | "typewriter"
  wordDelay={4}  // frames between words
  // Effects
  pulse
  pulseColor={CINEMA.electric + '30'}
/>

// Quiz-style with options
<QuestionPrompt
  startFrame={30}
  question="Which is faster for lookup?"
  style="quiz"
  // Options
  options={[
    { text: 'Array', value: 'a' },
    { text: 'Linked List', value: 'b' },
    { text: 'Hash Table', value: 'c', correct: true },
  ]}
  optionLayout="horizontal"  // "horizontal" | "vertical" | "grid"
  optionStyle={{
    padding: `${minDim * 0.015}px ${minDim * 0.03}px`,
    borderRadius: minDim * 0.01,
    background: CINEMA.slate,
    border: `2px solid ${CINEMA.ash}`,
  }}
  // Stagger option appearance
  optionStagger={12}
  // Reveal answer
  revealFrame={90}
  // Correct answer treatment
  correctStyle={{
    borderColor: CINEMA.mint,
    background: CINEMA.mint + '20',
    boxShadow: EFFECTS.neonGlow(CINEMA.mint, 0.5),
  }}
  // Wrong answers dim
  wrongStyle={{
    opacity: 0.4,
    filter: 'grayscale(0.5)',
  }}
  // Checkmark on correct
  showCheckmark
/>

// Editorial "But wait..." hook
<QuestionPrompt
  startFrame={120}
  question="But what if we need to scale to millions?"
  style="editorial"
  // Editorial styling
  questionStyle={{
    ...TYPOGRAPHY.display,
    fontSize: height * 0.045,
    fontStyle: 'italic',
    color: CINEMA.silver,
  }}
  // Accent on key phrase
  highlightPhrase="millions"
  highlightColor={CINEMA.gold}
  highlightGlow
  // No fade out (stays as hook)
  fadeOut={false}
  // Subtle ambient animation
  ambientMotion  // slight floating effect
/>

// Minimal inline question
<QuestionPrompt
  startFrame={60}
  question="Why?"
  style="minimal"
  questionStyle={{
    ...TYPOGRAPHY.display,
    fontSize: height * 0.08,
    color: CINEMA.electric,
  }}
  animation="pop"
  showQuestionMark={false}
/>

// Thinking prompt with dots
<QuestionPrompt
  startFrame={45}
  question="Think about it"
  style="minimal"
  // Animated thinking dots
  showThinkingDots
  thinkingDotColor={CINEMA.cyan}
  thinkingDotCount={3}
  thinkingDotDelay={10}
/>
```

### BigNumber - Cinematic Hero Statistics

Premium large-format numbers with dramatic animations, editorial typography, and contextual labeling.

```tsx
import { BigNumber } from './components';

// Hero statistic with dramatic reveal
<BigNumber
  value={1000000}
  startFrame={30}
  // Formatting
  format="compact"  // "compact" (1M) | "full" | "scientific" | "custom"
  prefix=""
  suffix=" req/s"
  // Typography
  numberStyle={{
    ...TYPOGRAPHY.display,
    fontSize: height * 0.15,  // MASSIVE
    fontWeight: 800,
    letterSpacing: '-0.04em',
    fontFeatureSettings: '"tnum" 1',  // Tabular numbers
  }}
  // Color and effects
  color={CINEMA.cyan}
  gradient={[CINEMA.electric, CINEMA.cyan]}  // Optional gradient
  glow
  glowIntensity={1.5}
  // Animation
  countUp
  countDuration={45}
  countEasing="dramatic"  // "linear" | "easeOut" | "dramatic" | "bounce"
  // Digit animation style
  digitAnimation="slot"  // "slot" | "flip" | "morph" | "typewriter"
  // Punch/scale on complete
  punchOnComplete
  punchScale={1.08}
/>

// With contextual label
<BigNumber
  value={50}
  suffix="ms"
  startFrame={0}
  color={CINEMA.mint}
  // Label configuration
  label="Response Time"
  labelPosition="below"  // "above" | "below" | "inline"
  labelStyle={{
    ...TYPOGRAPHY.label,
    fontSize: height * 0.022,
    color: CINEMA.silver,
    marginTop: height * 0.015,
  }}
  // Mood indicator
  mood="positive"  // "positive" | "negative" | "neutral"
  // Mood adds subtle background tint
  moodIntensity={0.15}
/>

// Side-by-side comparison
<div style={{
  display: 'flex',
  justifyContent: 'center',
  gap: width * 0.1,
}}>
  <BigNumber
    value={2500}
    suffix="ms"
    label="BEFORE"
    labelPosition="above"
    startFrame={0}
    color={CINEMA.ember}
    mood="negative"
    // Subtle de-emphasis
    opacity={0.8}
    glow={false}
    numberStyle={{
      fontSize: height * 0.1,
    }}
  />

  {/* Animated arrow between */}
  <Arrow startFrame={30} color={CINEMA.cyan} />

  <BigNumber
    value={50}
    suffix="ms"
    label="AFTER"
    labelPosition="above"
    startFrame={45}
    color={CINEMA.mint}
    mood="positive"
    glow
    // Winner gets the attention
    numberStyle={{
      fontSize: height * 0.12,
    }}
    punchOnComplete
  />
</div>

// Percentage with ring visualization
<BigNumber
  value={99.9}
  suffix="%"
  label="Uptime"
  startFrame={0}
  color={CINEMA.mint}
  // Circular progress ring behind number
  showRing
  ringSize={1.4}  // relative to number size
  ringThickness={8}
  ringBackground={CINEMA.slate}
  ringAnimated
/>
```

### PercentageBar - Cinematic Progress Visualization

Premium progress bars with fluid animations, gradient fills, and comparison layouts.

```tsx
import { PercentageBar } from './components';

// Single premium bar
<PercentageBar
  value={85}
  startFrame={30}
  // Bar styling
  height={minDim * 0.02}
  borderRadius={minDim * 0.01}
  // Colors
  backgroundColor={CINEMA.slate}
  fillColor={CINEMA.mint}
  // Gradient fill option
  fillGradient={[CINEMA.mint, CINEMA.cyan]}
  gradientDirection="horizontal"  // "horizontal" | "vertical" | "diagonal"
  // Animation
  animated
  animationDuration={45}
  animationEasing="spring"  // "spring" | "smooth" | "bounce"
  // Glow on fill
  glow
  glowColor={CINEMA.mint}
  glowIntensity={0.8}
  // Label
  label="Cache Hit Rate"
  labelPosition="left"  // "left" | "above" | "inline"
  labelStyle={{
    ...TYPOGRAPHY.label,
    fontSize: minDim * 0.018,
    color: CINEMA.silver,
  }}
  // Value display
  showValue
  valuePosition="right"  // "right" | "inside" | "above"
  valueFormat="percent"  // "percent" | "decimal" | "fraction"
  valueStyle={{
    ...TYPOGRAPHY.mono,
    fontSize: minDim * 0.022,
    color: CINEMA.bone,
    fontWeight: 600,
  }}
/>

// Comparison bars with stagger
<div style={{
  display: 'flex',
  flexDirection: 'column',
  gap: minDim * 0.025,
}}>
  <PercentageBar
    value={95}
    label="Redis"
    startFrame={0}
    fillGradient={[CINEMA.ember, '#ff6b6b']}
    glow
    showValue
    // Icon before label
    icon={<RedisIcon />}
  />
  <PercentageBar
    value={60}
    label="PostgreSQL"
    startFrame={15}
    fillGradient={[CINEMA.electric, CINEMA.cyan]}
    showValue
    icon={<PostgresIcon />}
  />
  <PercentageBar
    value={75}
    label="MongoDB"
    startFrame={30}
    fillGradient={[CINEMA.mint, '#6ee7b7']}
    showValue
    icon={<MongoIcon />}
    // Highlight winner
    highlight
    highlightPulse
  />
</div>

// Thin minimal style
<PercentageBar
  value={42}
  startFrame={0}
  height={4}
  borderRadius={2}
  backgroundColor={CINEMA.void}
  fillColor={CINEMA.cyan}
  // No label, just the bar
  showValue={false}
/>

// Segmented/discrete bar
<PercentageBar
  value={7}
  maxValue={10}
  startFrame={0}
  style="segmented"
  segments={10}
  segmentGap={4}
  fillColor={CINEMA.gold}
  emptyColor={CINEMA.slate}
  animated
  segmentStagger={5}  // frames between each segment
/>
```

---

## Educational Patterns (Combining Components)

### Pattern: Problem → Solution
```tsx
// Frame 0-60: Show the problem
<QuestionPrompt question="How do you pick a random winner from an infinite stream?" />

// Frame 60-90: Show why naive approach fails
<CrossOut startFrame={60}>
  <Text>Store all items in memory</Text>
</CrossOut>
<Callout startFrame={75} text="RAM explodes!" color="#ef4444" />

// Frame 90-150: Reveal the solution
<Reveal startFrame={90} effect="blur">
  <GradientText text="Reservoir Sampling" glow />
</Reveal>
```

### Pattern: Step-by-Step Algorithm
```tsx
<ProcessFlow startFrame={0} staggerFrames={30}>
  <ProcessFlow.Step label="1. First item → Keep it" />
  <ProcessFlow.Step label="2. Second item → 50% chance swap" />
  <ProcessFlow.Step label="3. Nth item → 1/n chance swap" />
</ProcessFlow>

// Highlight current step
<Spotlight startFrame={30} x={stepPositions[currentStep]} />
```

### Pattern: Before/After Performance
```tsx
<ComparisonSplit leftLabel="Naive" rightLabel="Optimized">
  <ComparisonSplit.Left>
    <BigNumber value={2500} suffix="ms" color="#ef4444" />
    <XMark startFrame={30} />
  </ComparisonSplit.Left>
  <ComparisonSplit.Right>
    <BigNumber value={50} suffix="ms" color="#22c55e" />
    <Checkmark startFrame={45} glow />
  </ComparisonSplit.Right>
</ComparisonSplit>
```

### Pattern: Code Walkthrough
```tsx
// Show code
<CodeBlock code={fullCode} startFrame={0} />

// Progressively highlight lines
<CodeBlock
  code={fullCode}
  focusLines={frame < 60 ? [1, 2] : frame < 90 ? [3, 4] : [5, 6]}
/>

// Add annotations
<Annotation x={80} y={30} text="Initialize" startFrame={30} />
<Annotation x={80} y={50} text="Loop" startFrame={60} />
<Annotation x={80} y={70} text="Return" startFrame={90} />
```

### Pattern: Architecture Explanation
```tsx
<LayerStack startFrame={0} staggerFrames={20} style="3d">
  <LayerStack.Layer label="Client" color="#3b82f6" />
  <LayerStack.Layer label="Load Balancer" color="#8b5cf6" />
  <LayerStack.Layer label="API Server" color="#06b6d4" />
  <LayerStack.Layer label="Cache" color="#22c55e" highlight />
  <LayerStack.Layer label="Database" color="#ef4444" />
</LayerStack>

// Show data flow
<PathFollow startX={50} startY={10} endX={50} endY={90} startFrame={60}>
  <DataPacketIcon />
</PathFollow>
```

### Pattern: Quiz/Engagement Hook
```tsx
// Start with question
<QuestionPrompt
  startFrame={0}
  question="What's the time complexity?"
  style="dramatic"
/>

// Show options
<Stagger startFrame={30} delayFrames={15}>
  <Option>A. O(n²)</Option>
  <Option>B. O(n log n)</Option>
  <Option>C. O(n)</Option>
</Stagger>

// Reveal answer
<Reveal startFrame={90} effect="blur">
  <Checkmark startFrame={95} />
  <Text>C. O(n) - Linear time!</Text>
</Reveal>
```
