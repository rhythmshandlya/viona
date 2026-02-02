# Visual Generator Improvements Plan

## Problem Statement

The Visual Director creates detailed, high-quality plans, but the Generator Agent produces minimal implementations that don't match the plan's specified techniques, effects, and animations. Result: videos that are technically valid but visually boring and not postable.

### Evidence from proj-c9b2ab0e

| Plan Specifies | Code Implements | Gap |
|----------------|-----------------|-----|
| `particle-emitter` with motion-blur | 50 simple circles in a loop | No physics, no blur |
| `mask-reveal` spotlight | Static Token + text | No masking animation |
| `cell-division-animation` | 5 static slots appearing | No splitting animation |
| `glass-shimmer` effect | Plain semi-transparent div | No shimmer |
| `drop-with-gravity` | Linear interpolate | No physics |
| Hero moments with treatments | Basic fade-in | No emphasis |

**Root cause**: The Generator doesn't know HOW to implement technique names as actual code.

---

## Solution Architecture

### 1. Animation Techniques Library (New Skill)

Create `animation-techniques.md` that maps technique names to production-ready Remotion implementations.

**Key techniques to implement:**
- `particle-emitter` - Physics-based particle system
- `mask-reveal` - SVG clipPath animations
- `cell-division` - Spring-based cloning
- `drop-with-gravity` - Physics simulation
- `glass-shimmer` - Animated gradient overlay
- `path-follow` - Bezier curve motion
- `scale-spring` - Bouncy entrance
- `fade-in-blur` - Gaussian blur transition
- `draw-stroke` - SVG stroke animation

### 2. Enhanced Generator Prompt

Force step-by-step implementation with explicit checklist:

```
For EACH scene in the plan:
1. Create a SceneXX component
2. Implement EVERY item in build_sequence:
   - Log: "Implementing S01 build_sequence[0]: particle-emitter"
   - Use the technique code from animation-techniques
3. Implement hero_moment with EXTRA emphasis:
   - Glow effects (box-shadow with color)
   - Scale boost (1.2x normal)
   - Longer hold time (20+ frames)
4. Export component and use in index.tsx
```

### 3. Plan Compliance Scoring

Update `scoring-rubric.md` to verify each plan item has matching code:

```
### Plan Compliance (NEW - 15 points from Visual Quality)

For each build_sequence item in the plan:
- Check component exists for the element
- Check technique is implemented (not just basic fade)
- Check at_frame timing is respected

Scoring:
- 15 points: All build_sequence items implemented
- 10 points: 80%+ items implemented
- 5 points: 50%+ items implemented
- 0 points: Less than 50%
```

### 4. Scene Component Architecture

Enforce one component per scene with full implementation:

```tsx
// src/proj_xxx/scenes/S01_CommentStream.tsx
export const S01_CommentStream: React.FC<{
  frameRange: [number, number];
}> = ({ frameRange }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Scene active check
  const isActive = frame >= frameRange[0] && frame <= frameRange[1];
  if (!isActive) return null;

  // Local frame for scene-relative animations
  const localFrame = frame - frameRange[0];

  // build_sequence[0] at_frame: 10 - particle-emitter
  const particlesActive = localFrame >= 10;

  // hero_moment frame_range: [30, 120]
  const heroActive = localFrame >= 30 && localFrame <= 120;

  return (
    <AbsoluteFill>
      {particlesActive && <ParticleEmitter ... />}
      {heroActive && <Counter glow={true} ... />}
    </AbsoluteFill>
  );
};
```

---

## Implementation Details

### File 1: `skills/animation-techniques.md`

```markdown
# Animation Techniques Library

When the Visual Plan specifies a technique, use the corresponding implementation below.

## particle-emitter

Creates a stream of particles with physics-like behavior.

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
  count: number;
  emitFrom: { x: number; y: number };
  spread: number;
  speed: number;
  gravity?: number;
}> = ({ count, emitFrom, spread, speed, gravity = 0.5 }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const particles = useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      x: emitFrom.x + (Math.random() - 0.5) * spread,
      y: emitFrom.y,
      vx: (Math.random() - 0.5) * speed * 0.3,
      vy: speed + Math.random() * speed * 0.5,
      size: 10 + Math.random() * 20,
      color: Math.random() > 0.8 ? COLORS.primary : COLORS.secondary,
      delay: i * 2, // Staggered emission
    }));
  }, [count, emitFrom, spread, speed]);

  return (
    <>
      {particles.map((p) => {
        const t = Math.max(0, frame - p.delay);
        const x = p.x + p.vx * t;
        const y = p.y + p.vy * t + 0.5 * gravity * t * t; // Physics!
        const opacity = interpolate(t, [0, 10, 100], [0, 1, 0], {
          extrapolateRight: 'clamp'
        });

        if (y > height * 1.1) return null; // Off screen

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
              background: p.color,
              opacity,
              boxShadow: `0 0 ${p.size}px ${p.color}`, // Glow
              filter: 'blur(1px)', // Motion blur effect
            }}
          />
        );
      })}
    </>
  );
};
```

## mask-reveal

Reveals an element through an animated mask/spotlight.

```tsx
const MaskReveal: React.FC<{
  startFrame: number;
  duration: number;
  children: React.ReactNode;
}> = ({ startFrame, duration, children }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const progress = interpolate(
    frame,
    [startFrame, startFrame + duration],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // Circular reveal expanding from center
  const radius = progress * Math.max(width, height);

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      clipPath: `circle(${radius}px at 50% 50%)`,
    }}>
      {children}
      {/* Spotlight glow at edge */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: `radial-gradient(circle at 50% 50%, transparent ${radius - 50}px, ${COLORS.primary}44 ${radius}px, transparent ${radius + 50}px)`,
        pointerEvents: 'none',
      }} />
    </div>
  );
};
```

## cell-division-animation

Animates one element splitting into multiple.

```tsx
const CellDivision: React.FC<{
  startFrame: number;
  count: number;
  children: (index: number) => React.ReactNode;
}> = ({ startFrame, count, children }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();

  const localFrame = frame - startFrame;
  if (localFrame < 0) return null;

  // Phase 1: Single element wobbles (frames 0-30)
  // Phase 2: Splits with particles (frames 30-60)
  // Phase 3: Elements settle into positions (frames 60-90)

  const phase = localFrame < 30 ? 1 : localFrame < 60 ? 2 : 3;

  const spacing = width * 0.12;
  const totalWidth = (count - 1) * spacing;
  const startX = -totalWidth / 2;

  return (
    <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
      {Array.from({ length: count }, (_, i) => {
        const targetX = startX + i * spacing;

        // In phase 1, all at center
        // In phase 2, explosively move outward
        // In phase 3, spring settle

        const x = phase === 1
          ? 0
          : spring({
              frame: localFrame - 30,
              fps,
              config: { damping: 12, stiffness: 80 },
            }) * targetX;

        const scale = phase === 1
          ? 1 + Math.sin(localFrame * 0.3) * 0.1 // Wobble
          : spring({
              frame: localFrame - 30 - i * 5, // Staggered
              fps,
              config: { damping: 15, stiffness: 100 },
            });

        const opacity = i === 0 || phase >= 2
          ? 1
          : interpolate(localFrame, [30, 40 + i * 5], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              transform: `translateX(${x}px) scale(${scale})`,
              opacity,
            }}
          >
            {children(i)}
          </div>
        );
      })}

      {/* Particles during split */}
      {phase === 2 && (
        <SplitParticles frame={localFrame - 30} />
      )}
    </div>
  );
};
```

## drop-with-gravity

Realistic drop animation with bounce.

```tsx
const DropWithGravity: React.FC<{
  startFrame: number;
  startY: number;
  endY: number;
  bounceHeight?: number;
  children: React.ReactNode;
}> = ({ startFrame, startY, endY, bounceHeight = 50, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const localFrame = frame - startFrame;
  if (localFrame < 0) return <div style={{ position: 'absolute', top: startY, opacity: 0 }}>{children}</div>;

  const dropDuration = 30;
  const bounceDuration = 20;

  let y: number;
  let rotation: number;

  if (localFrame < dropDuration) {
    // Accelerating drop (gravity)
    const t = localFrame / dropDuration;
    y = startY + (endY - startY) * (t * t); // Quadratic easing
    rotation = t * 15; // Slight tumble
  } else if (localFrame < dropDuration + bounceDuration) {
    // Bounce
    const bounceT = (localFrame - dropDuration) / bounceDuration;
    const bounceProgress = Math.sin(bounceT * Math.PI);
    y = endY - bounceHeight * bounceProgress * (1 - bounceT * 0.5); // Dampened bounce
    rotation = 15 * (1 - bounceT);
  } else {
    // Settled
    y = endY;
    rotation = 0;
  }

  const scale = spring({
    frame: localFrame,
    fps,
    config: { damping: 20, stiffness: 100 },
  });

  return (
    <div style={{
      position: 'absolute',
      top: y,
      left: '50%',
      transform: `translateX(-50%) rotate(${rotation}deg) scale(${scale})`,
    }}>
      {children}
    </div>
  );
};
```

## glass-shimmer

Animated glass/shimmer effect overlay.

```tsx
const GlassShimmer: React.FC<{
  width: number;
  height: number;
  borderRadius?: number;
}> = ({ width, height, borderRadius = 20 }) => {
  const frame = useCurrentFrame();

  // Shimmer travels across the surface
  const shimmerX = interpolate(
    frame % 120, // Loop every 4 seconds at 30fps
    [0, 120],
    [-width, width * 2]
  );

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      borderRadius,
      overflow: 'hidden',
      pointerEvents: 'none',
    }}>
      {/* Base glass effect */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0.1) 100%)',
        backdropFilter: 'blur(10px)',
      }} />

      {/* Traveling shimmer highlight */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: shimmerX,
        width: width * 0.3,
        height: '100%',
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
        transform: 'skewX(-20deg)',
      }} />

      {/* Top edge highlight */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '40%',
        background: 'linear-gradient(to bottom, rgba(255,255,255,0.15), transparent)',
        borderTopLeftRadius: borderRadius,
        borderTopRightRadius: borderRadius,
      }} />
    </div>
  );
};
```

## Hero Moment Treatment

When implementing a hero_moment, ALWAYS add these enhancements:

```tsx
const HeroMoment: React.FC<{
  frameRange: [number, number];
  children: React.ReactNode;
  glowColor?: string;
}> = ({ frameRange, children, glowColor = COLORS.primary }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const isActive = frame >= frameRange[0] && frame <= frameRange[1];
  if (!isActive) return <>{children}</>;

  const localFrame = frame - frameRange[0];
  const duration = frameRange[1] - frameRange[0];

  // Entrance scale boost
  const scale = spring({
    frame: localFrame,
    fps,
    config: { damping: 10, stiffness: 80 },
  }) * 1.15; // 15% larger than normal

  // Pulsing glow
  const glowIntensity = 20 + Math.sin(localFrame * 0.15) * 10;

  // Subtle float
  const floatY = Math.sin(localFrame * 0.1) * 5;

  return (
    <div style={{
      transform: `scale(${scale}) translateY(${floatY}px)`,
      filter: `drop-shadow(0 0 ${glowIntensity}px ${glowColor})`,
      transition: 'none', // Remotion handles all animation
    }}>
      {children}
    </div>
  );
};
```
```

---

### File 2: Updated `scoring-rubric.md` (additions)

Add this section after "Required Elements":

```markdown
### Plan Compliance (15 points) - CRITICAL

If a Visual Plan was provided, verify implementation:

#### build_sequence Verification (10 points)
For EACH item in each scene's build_sequence:
- [ ] Element component exists
- [ ] Technique is implemented (not basic fade)
- [ ] at_frame timing is respected (+/- 5 frames)
- [ ] Effects are present if specified

Scoring:
- 10 points: 90%+ of build_sequence items implemented with correct techniques
- 7 points: 70%+ implemented
- 4 points: 50%+ implemented
- 0 points: <50% or techniques ignored

#### hero_moment Verification (5 points)
For EACH hero_moment in the plan:
- [ ] Has visual emphasis (glow, scale boost, or particles)
- [ ] Frame timing matches plan
- [ ] Treatment matches description (e.g., "slow zoom" = scale interpolation)

Scoring:
- 5 points: All hero moments have proper treatment
- 3 points: Most hero moments implemented
- 0 points: Hero moments missing or basic fade only

### Technique Violations (Deductions)
- -5 points: Plan specifies `particle-emitter` but code uses static elements
- -5 points: Plan specifies `mask-reveal` but code uses basic opacity
- -5 points: Plan specifies physics (`gravity`, `bounce`) but code uses linear interpolation
- -3 points: Hero moment has no visual distinction from regular elements
```

---

### File 3: Enhanced Generator Prompt (in visual_generator.py)

Replace the prompt construction with:

```python
prompt = f'''## VISUAL PLAN - IMPLEMENT EXACTLY

You MUST implement every detail in this plan. The plan is the specification - do not improvise.

### Project: {project_id}
### Canvas: {width}x{height}
### Duration: {duration_frames} frames at {fps} FPS

## The Plan

```json
{plan_json}
```

## MANDATORY Implementation Checklist

### Step 1: Create Scene Components

For EACH scene in the plan, create a dedicated component:

```
src/{project_id}/scenes/S01_SceneName.tsx
src/{project_id}/scenes/S02_SceneName.tsx
...
```

### Step 2: Implement build_sequence EXACTLY

For each `build_sequence` item, you MUST:

1. **Check the technique** - Use the animation-techniques skill for implementation
2. **Respect at_frame** - Animation starts at that exact frame
3. **Include effects** - If effects are listed, implement them

Example for technique "particle-emitter":
- Create actual particles with physics (gravity, velocity)
- NOT just divs with opacity animations
- Include motion-blur effect if specified

Example for technique "mask-reveal":
- Use SVG clipPath or CSS clip-path
- Animate the mask expanding
- NOT just opacity fade

### Step 3: Implement hero_moments with EMPHASIS

Hero moments must be VISUALLY DISTINCT:
- Scale boost: 1.15x - 1.3x larger
- Glow effect: box-shadow with theme color
- Hold time: Keep hero visible for full frame_range
- Treatment: Follow the specific treatment described

### Step 4: Wire Up in index.tsx

```tsx
import {{ S01_StreamScene }} from './scenes/S01_StreamScene';
import {{ S02_WinnerScene }} from './scenes/S02_WinnerScene';
// ... all scenes

export const {component_name}: React.FC = () => {{
  return (
    <AbsoluteFill>
      <S01_StreamScene frameRange={{[0, 150]}} />
      <S02_WinnerScene frameRange={{[180, 240]}} />
      // ... all scenes
    </AbsoluteFill>
  );
}};
```

## Quality Requirements

- Each scene component: 50-150 lines (not 20 lines)
- Total index.tsx + scenes: 400+ lines for 6 scenes
- Every technique from the plan must have matching code
- No placeholders or "TODO" comments

## Animation Techniques Reference

{animation_techniques_content}

Now implement the full plan. Start with Scene 1.
'''
```

---

## Changes to visual_generator.py

### 1. Load Animation Techniques Skill

```python
# In main(), add:
animation_techniques = load_skill(skills_dir / "animation-techniques.md")

# Pass to prompt:
prompt = build_enhanced_prompt(
    plan_json=plan_json,
    project_id=args.project_id,
    animation_techniques_content=animation_techniques,
    ...
)
```

### 2. Add Plan Compliance Verification

```python
def verify_plan_compliance(workspace: str, project_id: str, visual_plan: dict) -> dict:
    """Check if generated code implements the plan."""
    issues = []
    score_deductions = 0

    project_dir = Path(workspace) / "src" / project_id

    # Read all generated code
    code_content = ""
    for f in project_dir.glob("**/*.tsx"):
        code_content += f.read_text(encoding="utf-8")

    # Check each scene's build_sequence
    for scene in visual_plan.get("scenes", []):
        scene_id = scene.get("scene_id", "")
        build_seq = scene.get("visual_story", {}).get("build_sequence", [])

        for item in build_seq:
            technique = item.get("technique", "")
            element = item.get("element", "")

            # Check if technique is implemented (not just mentioned)
            technique_patterns = {
                "particle-emitter": ["velocity", "gravity", "particles.map"],
                "mask-reveal": ["clipPath", "clip-path", "mask"],
                "cell-division": ["split", "Array.from", "spacing"],
                "drop-with-gravity": ["gravity", "bounce", "quadratic"],
                "glass-shimmer": ["shimmer", "backdrop", "gradient"],
            }

            patterns = technique_patterns.get(technique, [])
            if patterns and not any(p in code_content for p in patterns):
                issues.append(f"{scene_id}: {technique} not properly implemented for {element}")
                score_deductions += 5

    # Check hero moments
    for scene in visual_plan.get("scenes", []):
        hero = scene.get("visual_story", {}).get("hero_moment")
        if hero:
            # Check for emphasis patterns
            emphasis_patterns = ["glow", "scale(1.1", "scale(1.2", "drop-shadow", "boxShadow"]
            if not any(p in code_content for p in emphasis_patterns):
                issues.append(f"{scene.get('scene_id')}: hero_moment lacks visual emphasis")
                score_deductions += 3

    return {
        "compliant": len(issues) == 0,
        "issues": issues,
        "score_deductions": score_deductions
    }
```

### 3. Integrate Compliance Check into Evaluation

```python
# In run_critic(), add after regular evaluation:
if visual_plan:
    compliance = verify_plan_compliance(workspace, project_id, visual_plan)
    if compliance["issues"]:
        score_result["issues"].extend(compliance["issues"])
        score_result["score"] -= compliance["score_deductions"]
        score_result["plan_compliance"] = compliance
```

---

## Expected Outcomes

After implementing these changes:

1. **Generator will produce 400+ lines** instead of 180 lines
2. **Each technique will have real implementation** - particles with physics, masks with clipPath
3. **Hero moments will be visually distinct** - glows, scale boosts, emphasis
4. **Evaluation will catch missing techniques** - can't pass with basic fades
5. **Results will be postable** - actual motion graphics, not static diagrams

## Implementation Priority

1. **HIGH**: Create `animation-techniques.md` - immediate impact on code quality
2. **HIGH**: Update generator prompt - forces proper implementation
3. **MEDIUM**: Update scoring rubric - catches issues in iteration
4. **MEDIUM**: Add compliance verification - automated checking
5. **LOW**: Scene component architecture - nice to have structure

## Testing

Re-run the Reservoir Sampling video after changes. Expected:
- S01: Actual particle stream with physics, glowing counter
- S02: Mask reveal spotlight effect
- S03: RAM bar with shake effect (properly implemented)
- S04: Glass shimmer on reservoir box
- S05: Gravity-based drop animation
- S06: Cell division animation (1 splits to 5)
