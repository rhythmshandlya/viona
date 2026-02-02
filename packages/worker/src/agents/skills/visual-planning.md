# Implementing Visual Plans

When you receive a Visual Plan from the Visual Director, your job is IMPLEMENTATION, not creative decisions.

## Understanding the Visual Plan

The plan contains:
1. **concept_analysis** - What entities, relationships, and processes exist
2. **visual_system** - How to visualize them (metaphors, colors, layout)
3. **scenes** - Frame-by-frame breakdown of what happens when
4. **global_directives** - Hard constraints to follow

## Implementation Rules

### 1. Use the Metaphors Exactly
```tsx
// From visual_system.metaphor_mapping
"Client": {
  "visual": "laptop-computer-icon",
  "style": { "color": "style.primary", "size_percent": 12 }
}

// Implement as:
const Client = () => {
  const { width, height } = useVideoConfig();
  const minDim = Math.min(width, height);
  return (
    <div style={{
      width: minDim * 0.12,
      height: minDim * 0.12,
      backgroundColor: COLORS.primary,
    }}>
      <LaptopIcon />
    </div>
  );
};
```

### 2. Use Percentage Positions
```tsx
// From element_positions
"Client": { "x_percent": 15, "y_percent": 40 }

// Implement as:
const { width, height } = useVideoConfig();
const clientX = width * 0.15;
const clientY = height * 0.40;

<div style={{
  position: 'absolute',
  left: clientX,
  top: clientY,
  transform: 'translate(-50%, -50%)', // Center on position
}}>
  <Client />
</div>
```

### 3. Follow the Build Sequence
```tsx
// From scenes[].visual_story.build_sequence
{
  "at_frame": 15,
  "action": "Client icon materializes",
  "technique": "scale-spring-from-zero",
  "rationale": "Dramatic entrance"
}

// Implement as:
const frame = useCurrentFrame();
const { fps } = useVideoConfig();

// Animation starts at frame 15
const clientScale = spring({
  frame: frame - 15,
  fps,
  config: { damping: 12, stiffness: 80 }
});

// Only visible after frame 15
const clientOpacity = frame >= 15 ? 1 : 0;

<div style={{
  opacity: clientOpacity,
  transform: `scale(${Math.max(0, clientScale)})`,
}}>
  <Client />
</div>
```

### 4. Implement Process Animations
```tsx
// From scenes[].visual_story.process_animations
{
  "name": "request_travel",
  "object": "Request",
  "path": "client_to_server_arc",
  "duration_frames": 120
}

// Implement as:
const requestStartFrame = 420;
const requestProgress = interpolate(
  frame,
  [requestStartFrame, requestStartFrame + 120],
  [0, 1],
  { extrapolateRight: 'clamp' }
);

// Curved path from client to server
const requestX = interpolate(requestProgress, [0, 1], [clientX, serverX]);
const requestY = interpolate(
  requestProgress,
  [0, 0.5, 1],
  [clientY, (clientY + serverY) / 2 - arcHeight, serverY]
);

// Motion trail effect
const trailOpacity = interpolate(requestProgress, [0, 0.1, 0.9, 1], [0, 1, 1, 0]);

<div style={{
  position: 'absolute',
  left: requestX,
  top: requestY,
  transform: 'translate(-50%, -50%)',
  opacity: trailOpacity,
}}>
  <Request />
  {/* Trail effect */}
  <div style={{
    position: 'absolute',
    width: minDim * 0.3,
    height: 2,
    background: `linear-gradient(to left, ${COLORS.accent}, transparent)`,
    transform: `rotate(${angle}rad)`,
  }} />
</div>
```

### 5. Respect Hero Moments
```tsx
// From scenes[].visual_story.hero_moment
{
  "what": "Request traveling from Client to Server",
  "frame_range": [420, 540],
  "treatment": "Extra attention - motion trail, visible path"
}

// Make this animation special:
// - Longer duration (already specified)
// - Motion trail effect
// - Maybe slight glow
// - Ensure no other animations compete during this range
```

## Color Token Mapping

Map style tokens to actual colors:
```tsx
const COLORS = {
  bg: '#0f0f23',        // style.bg
  primary: '#8b5cf6',   // style.primary
  secondary: '#3b82f6', // style.secondary
  accent: '#06b6d4',    // style.accent
  success: '#22c55e',   // style.success
  text: '#ffffff',      // style.text
  muted: '#64748b',     // style.muted
};
```

## Scene Structure Template

```tsx
const Scene = ({ from, durationInFrames, elements, buildSequence }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();

  return (
    <Sequence from={from} durationInFrames={durationInFrames}>
      <AbsoluteFill>
        {/* Background */}
        <Background />

        {/* Elements with their animations */}
        {buildSequence.map((step, i) => (
          <AnimatedElement
            key={i}
            element={elements[step.element]}
            startFrame={step.at_frame - from}
            technique={step.technique}
            position={step.position}
          />
        ))}
      </AbsoluteFill>
    </Sequence>
  );
};
```

## Checklist Before Completion

- [ ] All entities from concept_analysis have visual implementations
- [ ] All positions use percentages from element_positions
- [ ] Build sequence timing matches the specified frames
- [ ] Process animations follow the specified paths
- [ ] Hero moments have extra visual attention
- [ ] No elements in bottom 15% (subtitle zone)
- [ ] Colors use the style tokens, not hardcoded values
- [ ] All .map() calls have key props
