# Studio Theme: Viona Glass

> Viona's signature glassmorphic design language. Dark, translucent, violet-accented, depth-driven.
> Every animator agent MUST follow this theme. All constants in `constants.ts` must match these values.

## Color Palette

### Background Layers
```typescript
const COLORS = {
  // Backgrounds — layered depth system, darkest to lightest
  bgBase: '#08080C',                          // Deepest background
  bgSurface: 'rgba(28, 28, 35, 0.55)',        // Glass panel surface
  bgElevated: 'rgba(38, 38, 48, 0.65)',       // Elevated elements (cards, popups)
  bgSubtle: '#111111',                         // Solid subtle background

  // Primary accent — violet
  primary: '#8B5CF6',                          // Main accent (buttons, highlights, active states)
  primaryHover: '#7C3AED',                     // Hover/pressed state
  primaryMuted: 'rgba(139, 92, 246, 0.15)',    // Soft violet background
  primarySoft: 'rgba(139, 92, 246, 0.08)',     // Very soft violet tint

  // Text — opacity-based hierarchy, NOT different colors
  textPrimary: 'rgba(255, 255, 255, 0.95)',    // Headings, key content
  textSecondary: 'rgba(255, 255, 255, 0.55)',  // Supporting text, labels
  textMuted: 'rgba(255, 255, 255, 0.32)',      // Disabled, hints

  // Borders — white at very low opacity
  borderSubtle: 'rgba(255, 255, 255, 0.06)',   // Faint separation
  borderDefault: 'rgba(255, 255, 255, 0.1)',   // Standard borders
  borderFocus: '#7C3AED',                      // Focus/active rings

  // Semantic
  success: '#10b981',                          // Emerald
  warning: '#f59e0b',                          // Amber
  error: '#dc2626',                            // Red

  // Chart / data visualization
  chart1: '#7C3AED',                           // Violet
  chart2: '#3b82f6',                           // Blue
  chart3: '#8b5cf6',                           // Light violet
  chart4: '#10b981',                           // Emerald
  chart5: '#A78BFA',                           // Lavender
};
```

### Content-Adaptive Color

Color direction comes from the scene content, not a fixed palette. Read the scene's description from the plan:
- Growth/money/success -> emerald/gold tones (`#10b981`, `#f59e0b`)
- Danger/urgency/warning -> warm red/amber (`#ef4444`, `#f97316`)
- Technical/data/analysis -> cool blue/cyan (`#3b82f6`, `#06b6d4`)
- Creative/inspiration -> violet/magenta (`#8b5cf6`, `#ec4899`)
- Calm/health/nature -> teal/green (`#14b8a6`, `#22c55e`)

The violet accent (`#8B5CF6`) is ONE option, not the default. Each scene should feel like it belongs to the video's topic. The background base can shift too -- deep navy (`#0a0a1a`), dark warm gray (`#1a1412`), or deep emerald (`#0a1a12`) instead of always `#08080C`.

**Implementation:** `constants.ts` defines `COLORS.primary` as a single value (written by Setup Agent). Animators use inline hex colors per scene rather than relying on `COLORS.primary` for accent color. `COLORS.primary` remains as a fallback.

### Liquid Glass Effect (Remotion-Compatible)

`backdrop-filter` is unreliable in Remotion canvas rendering. Liquid glass is achieved through animated gradients, specular sweeps, and depth shadows instead.

**Base GLASS constant** (starting point -- animators MUST animate these properties per frame):
```typescript
const GLASS = {
  background: 'rgba(28, 28, 35, 0.55)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  borderTop: '1px solid rgba(255, 255, 255, 0.12)',
  borderRadius: 20,
  shadow: '0 8px 32px rgba(0, 0, 0, 0.35), 0 2px 8px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
};
```

**1. Animated gradient surface** -- the glass background shifts color angle over time:
```tsx
const glassAngle = 135 + Math.sin(frame * 0.02) * 15;
const glassBg = `linear-gradient(${glassAngle}deg, rgba(28, 28, 35, 0.6), rgba(45, 40, 65, 0.4), rgba(28, 28, 35, 0.55))`;
```

**2. Specular highlight sweep** -- a bright gradient translates across the surface:
```tsx
const specularX = interpolate(frame, [entryFrame, entryFrame + 40], [-100, 200], {
  extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
});
const specularHighlight = `linear-gradient(105deg, transparent ${specularX}%, rgba(255,255,255,0.12) ${specularX + 10}%, transparent ${specularX + 20}%)`;
// Apply as a positioned overlay div inside the glass container
```

**3. Depth shadows that animate in** -- shadows grow from nothing over 15 frames:
```tsx
const shadowProgress = interpolate(frame, [entryFrame, entryFrame + 15], [0, 1], {
  extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
});
const animatedShadow = `0 ${8 * shadowProgress}px ${32 * shadowProgress}px rgba(0, 0, 0, ${0.35 * shadowProgress}), 0 ${2 * shadowProgress}px ${8 * shadowProgress}px rgba(0, 0, 0, ${0.2 * shadowProgress})`;
```

**4. Grain texture** -- shift background position every 3-4 frames, 5-8% opacity:
```tsx
const grainShift = Math.floor(frame / 3) * 100;
// Add a grain overlay div:
// backgroundImage: url("data:image/svg+xml,...") or noise pattern
// backgroundPosition: `${grainShift}px ${grainShift}px`
// opacity: 0.06
```

**5. Glass shimmer** -- oscillating opacity adds life to the surface:
```tsx
const shimmer = 0.55 + Math.sin(frame * 0.04) * 0.05;
// Use shimmer as the alpha in the glass background color
```

**Key rule:** A glass surface with a static background and no animated properties is NOT liquid glass. Every glass element must have at least one continuously animated visual property (angle shift, shimmer, specular sweep).

### Hover/Interactive States (for animated elements)
```typescript
const INTERACTIVE = {
  hoverBg: 'rgba(255, 255, 255, 0.06)',
  hoverBorder: 'rgba(255, 255, 255, 0.12)',
  hoverLift: -2,                                // translateY(-2px)
  activeBg: 'rgba(139, 92, 246, 0.08)',
  activeScale: 0.94,                            // scale down on "press"
};
```

## Typography

### Fonts
```typescript
const FONTS = {
  heading: 'Sora, system-ui, sans-serif',       // All headings and labels
  body: 'Sora, system-ui, sans-serif',           // Body text (same family, different weight)
  mono: 'monospace',                              // Code, numbers, data
};
```

### Sizes (for 1080x1920 vertical canvas)
```typescript
const FONT_SIZES = {
  title: 72,        // Hero titles, big reveals
  heading: 56,      // Section headings
  subheading: 40,   // Sub-sections, card titles
  body: 32,         // Explanatory text, descriptions
  label: 24,        // Small labels, captions, annotations
  tiny: 18,         // Fine print, attribution
};
```

### Weight & Emphasis
- **Hero text** (main numbers, key phrases, titles): weight **700-800**. Bold text stops the scroll.
- **Heading weight:** 500
- **Body weight:** 400
- **Label weight:** 400
- Letter spacing: `0.025em` standard, `-0.025em` for tight headings
- The weight differential (700+ vs 400) creates hierarchy that reads at scroll speed on a phone screen.

## Animation Style

### Spring Vocabulary

Replace the single universal spring with semantic-purpose springs. Select based on what the element IS, not random choice.

```typescript
const SPRINGS = {
  SNAPPY:  { damping: 20, mass: 1, stiffness: 180 },   // Hero reveals, key numbers, emphasis
  SMOOTH:  { damping: 28, mass: 1, stiffness: 120 },   // Cards, containers, supporting elements
  BOUNCY:  { damping: 12, mass: 0.8, stiffness: 200 }, // Icons, small accents, playful moments
  HEAVY:   { damping: 35, mass: 1.5, stiffness: 100 }, // Large panels, backgrounds, weighty arrivals
};
```

**Rule:** Adjacent elements SHOULD use different springs. A hero number enters SNAPPY while its label enters SMOOTH. A card enters HEAVY while its icon enters BOUNCY. Spring contrast creates choreography. Same spring on adjacent elements is acceptable if semantically justified, but never the default.

### Ease Curve
```typescript
const EASE_SMOOTH = [0.2, 0.65, 0.3, 0.9];  // Cubic bezier for non-spring animations
```
Used for exits, repositions, and fade-outs.

### Timing
```typescript
const TIMING = {
  staggerMin: 6,          // Minimum 6 frames between element entrances
  staggerDefault: 8,      // Default stagger
  entranceDuration: 20,   // Frames for entrance animations
  exitDuration: 12,       // Frames for exit animations (faster than entrance)
  holdMin: 30,            // Minimum frames to hold before exit
  transitionFast: 150,    // ms — quick micro-interactions
  transitionNormal: 250,  // ms — standard transitions
};
```

### Motion Principles

**Entrances -- vary the direction:**
- Entrance directions MUST vary across elements in the same scene. Use a mix of: bottom rise, left/right slide, scale up from 0.8, scale down from 1.2, slight rotation (-3deg to 0deg).
- NEVER have all elements enter from the same direction. If three cards enter, one from left, one from bottom, one from right (or scale).
- **Overlapping action:** Opacity and transform should be offset by 3-5 frames. Opacity starts first, transform follows. This creates a softer, more organic arrival.
- Opacity ALWAYS fades in from 0 -- never pop in instantly.
- Stagger elements by 6-10 frames minimum.
- Use SPRINGS vocabulary (SNAPPY, SMOOTH, BOUNCY, HEAVY) matched to element purpose.

**Mandatory continuous idle motion:**
- After an element enters, it must NOT become static. Apply at least one idle animation:
  - Float: `translateY(Math.sin(frame * 0.03) * 3)` -- gentle vertical bob
  - Breathe: `scale(1 + Math.sin(frame * 0.025) * 0.015)` -- subtle pulse
  - Rotate drift: `rotate(Math.sin(frame * 0.02) * 0.5)` -- micro-rotation
  - Glow pulse: oscillating box-shadow opacity or border brightness
- **Background is NEVER static.** Use gradient angle shift, mesh gradient movement, or slow color drift on the base background.
- **45 frames frozen = needs attention.** If any visible element has zero property changes for 45+ consecutive frames, add idle motion.

**Exits:**
- Fade out (`opacity: 1 -> 0`) with slight downward drift (`translateY(0 -> 10px)`)
- Use `ease-out` easing, NOT spring
- Faster than entrances (12 frames vs 20 frames)
- Exit animations should feel like a gentle release, not an abrupt cut

**Scene choreography:**
- Motion energy should follow audio energy. Louder/faster speech = more simultaneous entrances. Quiet moments = slower, individual reveals.
- **No dead air rule:** Never allow 20+ frames where nothing is entering, exiting, or animating. If the scene holds, idle motion keeps it alive.
- Scene transitions: last elements exit 5-10 frames before the scene cut. Clean handoff, no leftover elements.

### Stagger Delays
```typescript
const STAGGER = {
  delay1: 50,   // ms
  delay2: 100,
  delay3: 150,
  delay4: 200,
  delay5: 250,
  delay6: 300,
};
```

## Shape & Layout

### Border Radius
```typescript
const RADIUS = {
  sm: 6,        // Small elements (tags, chips)
  md: 10,       // Buttons, inputs
  lg: 14,       // Cards, panels
  xl: 20,       // Glass cards, major containers
  full: 9999,   // Pills, circles
};
```

### Spacing
```typescript
const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  canvasEdge: 48,   // Minimum distance from canvas edge for any content
};
```

### Shadows
```typescript
const SHADOWS = {
  sm: '0 1px 3px rgba(0, 0, 0, 0.25), 0 1px 2px rgba(0, 0, 0, 0.15)',
  md: '0 8px 32px rgba(0, 0, 0, 0.35), 0 2px 8px rgba(0, 0, 0, 0.2)',
  lg: '0 16px 48px rgba(0, 0, 0, 0.45), 0 4px 16px rgba(0, 0, 0, 0.25)',
  glow: '0 0 12px rgba(139, 92, 246, 0.3)',  // Violet glow for accent elements
};
```

## Visual Elements

### Icon Style
- Style: **outline** (not filled)
- Stroke width: 1.5px
- Color: follows `COLORS.textSecondary` default, `COLORS.primary` when active
- Sizes: 14px (small), 16px (medium), 20px (large)

### Decorative Elements
- **Specular highlights:** Top edges of glass elements get `rgba(255, 255, 255, 0.12)` border
- **Inset glow:** Subtle `inset 0 1px 0 rgba(255, 255, 255, 0.06)` on glass surfaces
- **Gradient mesh backgrounds:** Radial gradients with violet/blue tints at low opacity for depth:
  ```typescript
  const MESH_GRADIENT = [
    'radial-gradient(ellipse at 20% 15%, rgba(139, 92, 246, 0.07) 0%, transparent 50%)',
    'radial-gradient(ellipse at 80% 20%, rgba(59, 130, 246, 0.05) 0%, transparent 50%)',
    'radial-gradient(ellipse at 50% 75%, rgba(168, 85, 247, 0.04) 0%, transparent 45%)',
  ];
  ```
- **No gradients on text** — text is always solid color at varying opacity
- **No harsh borders** — all borders are white at 6-12% opacity

### Background Treatment
- **Scene backgrounds:** Dark base (`#08080C`) with optional mesh gradient overlay
- **Glass containers:** Semi-transparent with animated gradient surfaces (liquid glass)
- **Never pure black (`#000000`)** — always use `#08080C` or darker grays
- **Never pure white text** — always use `rgba(255, 255, 255, 0.95)` max

## Example Scenes

### Example 1: Three-Step Process
```tsx
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';

const COLORS = { /* as above */ };
const GLASS = { /* as above */ };
const SPRINGS = {
  SNAPPY:  { damping: 20, mass: 1, stiffness: 180 },
  SMOOTH:  { damping: 28, mass: 1, stiffness: 120 },
};

const ThreeStepProcess: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const steps = ['Research', 'Design', 'Build'];

  // Animated background gradient angle
  const bgAngle = 135 + Math.sin(frame * 0.02) * 15;
  const bgGradient = `linear-gradient(${bgAngle}deg, #08080C 0%, #0f0a1a 50%, #08080C 100%)`;

  // Title entrance -- SNAPPY spring, opacity leads transform by 4 frames
  const titleOpacity = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const titleSpring = spring({ frame: Math.max(0, frame - 4), fps, config: SPRINGS.SNAPPY });
  const titleY = interpolate(titleSpring, [0, 1], [25, 0]);
  // Title idle breathe
  const titleBreathe = 1 + Math.sin(frame * 0.025) * 0.01;

  return (
    <div style={{
      width, height,
      background: bgGradient,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 24,
      padding: 48,
    }}>
      {/* Title */}
      <h1 style={{
        color: COLORS.textPrimary,
        fontSize: 56,
        fontFamily: 'Sora',
        fontWeight: 700,
        opacity: titleOpacity,
        transform: `translateY(${titleY}px) scale(${titleBreathe})`,
      }}>
        The Process
      </h1>

      {/* Step cards -- staggered entrance, SMOOTH spring, liquid glass */}
      <div style={{ display: 'flex', gap: 20 }}>
        {steps.map((step, i) => {
          const delay = 18 + i * 8;
          // Opacity leads transform by 3 frames
          const cardOpacity = interpolate(frame, [delay, delay + 15], [0, 1], {
            extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
          });
          const cardSpring = spring({ frame: Math.max(0, frame - delay - 3), fps, config: SPRINGS.SMOOTH });
          const cardY = interpolate(cardSpring, [0, 1], [30, 0]);
          // Liquid glass animated gradient per card
          const glassAngle = 135 + Math.sin((frame + i * 20) * 0.02) * 15;
          const glassBg = `linear-gradient(${glassAngle}deg, rgba(28, 28, 35, 0.6), rgba(45, 40, 65, 0.4), rgba(28, 28, 35, 0.55))`;
          // Specular highlight sweep
          const specX = interpolate(frame, [delay, delay + 40], [-100, 200], {
            extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
          });
          // Card idle float
          const cardFloat = Math.sin((frame + i * 15) * 0.03) * 3;

          return (
            <div key={step} style={{
              position: 'relative',
              overflow: 'hidden',
              background: glassBg,
              border: GLASS.border,
              borderTop: GLASS.borderTop,
              borderRadius: GLASS.borderRadius,
              boxShadow: GLASS.shadow,
              padding: 32,
              width: 280,
              textAlign: 'center',
              opacity: cardOpacity,
              transform: `translateY(${cardY + cardFloat}px)`,
            }}>
              {/* Specular highlight overlay */}
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                background: `linear-gradient(105deg, transparent ${specX}%, rgba(255,255,255,0.1) ${specX + 10}%, transparent ${specX + 20}%)`,
                pointerEvents: 'none',
              }} />
              <div style={{ color: COLORS.primary, fontSize: 40, fontWeight: 700 }}>
                {i + 1}
              </div>
              <div style={{ color: COLORS.textPrimary, fontSize: 32, marginTop: 12 }}>
                {step}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ThreeStepProcess;
```

### Example 2: Data Comparison (Two Values)
```tsx
import { useCurrentFrame, interpolate } from 'remotion';

const DataComparison: React.FC = () => {
  const frame = useCurrentFrame();

  const barMaxWidth = 600;
  const value1 = 73; // percent
  const value2 = 41; // percent

  const bar1Width = interpolate(frame, [10, 40], [0, barMaxWidth * (value1 / 100)], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const bar2Width = interpolate(frame, [18, 48], [0, barMaxWidth * (value2 / 100)], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  return (
    <div style={{
      width: 1080, height: 1920,
      background: '#08080C',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      padding: 64,
      gap: 48,
    }}>
      {/* Bar 1 */}
      <div>
        <div style={{
          color: 'rgba(255, 255, 255, 0.95)',
          fontSize: 32,
          fontFamily: 'Sora',
          marginBottom: 12,
        }}>
          With AI Editing
        </div>
        <div style={{
          background: 'rgba(255, 255, 255, 0.06)',
          borderRadius: 10,
          height: 48,
          overflow: 'hidden',
        }}>
          <div style={{
            width: bar1Width,
            height: '100%',
            background: 'linear-gradient(90deg, #7C3AED, #8B5CF6)',
            borderRadius: 10,
          }} />
        </div>
        <div style={{
          color: '#8B5CF6',
          fontSize: 40,
          fontWeight: 700,
          marginTop: 8,
          fontFamily: 'Sora',
        }}>
          {Math.round(interpolate(frame, [10, 40], [0, value1], {
            extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
          }))}%
        </div>
      </div>

      {/* Bar 2 */}
      <div>
        <div style={{
          color: 'rgba(255, 255, 255, 0.95)',
          fontSize: 32,
          fontFamily: 'Sora',
          marginBottom: 12,
        }}>
          Manual Editing
        </div>
        <div style={{
          background: 'rgba(255, 255, 255, 0.06)',
          borderRadius: 10,
          height: 48,
          overflow: 'hidden',
        }}>
          <div style={{
            width: bar2Width,
            height: '100%',
            background: 'rgba(255, 255, 255, 0.2)',
            borderRadius: 10,
          }} />
        </div>
        <div style={{
          color: 'rgba(255, 255, 255, 0.55)',
          fontSize: 40,
          fontWeight: 700,
          marginTop: 8,
          fontFamily: 'Sora',
        }}>
          {Math.round(interpolate(frame, [18, 48], [0, value2], {
            extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
          }))}%
        </div>
      </div>
    </div>
  );
};

export default DataComparison;
```

### Example 3: Floating Label Overlay (Transparent)
```tsx
import { useCurrentFrame, interpolate } from 'remotion';

// This scene is meant to be used as a TRANSPARENT OVERLAY on top of speaker video.
// No background — only the floating label renders.
// Place in lower-right quadrant, AWAY from speaker face.

const FloatingLabel: React.FC = () => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const y = interpolate(frame, [0, 15], [12, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  return (
    <div style={{
      position: 'absolute',
      bottom: 280,
      right: 48,
      opacity,
      transform: `translateY(${y}px)`,
    }}>
      <div style={{
        background: `linear-gradient(${135 + Math.sin(frame * 0.02) * 10}deg, rgba(28, 28, 35, 0.6), rgba(45, 40, 65, 0.4), rgba(28, 28, 35, 0.55))`,
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderTop: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: 14,
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35), 0 2px 8px rgba(0, 0, 0, 0.2)',
        padding: '16px 24px',
      }}>
        <div style={{
          color: '#8B5CF6',
          fontSize: 18,
          fontFamily: 'Sora',
          fontWeight: 700,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}>
          Key Point
        </div>
        <div style={{
          color: 'rgba(255, 255, 255, 0.95)',
          fontSize: 28,
          fontFamily: 'Sora',
          fontWeight: 500,
          marginTop: 4,
        }}>
          Consistency is everything
        </div>
      </div>
    </div>
  );
};

export default FloatingLabel;
```

## Do NOT Use
- Pure black (`#000000`) or pure white (`#FFFFFF`) -- always off-black and off-white
- Hard borders (1px solid white) -- all borders are low-opacity white
- Bright saturated backgrounds -- backgrounds are always dark with subtle tints
- Drop shadows with color (colored shadows) -- shadows are always neutral black at varying opacity
- Gradients on text
- 3D transforms (rotateX, rotateY, perspective) -- keep everything flat/2D
- Heavy textures or patterns -- glassmorphism is about translucency, not texture
- Static flat-colored rectangles as containers -- every surface must use liquid glass treatment
- `backdrop-filter` -- unreliable in Remotion canvas rendering. Use animated gradients instead.

---

*This is Viona's default studio theme. Every animator agent loads this before generating scene code. All COLORS, SPRINGS, FONTS, SPACING constants in the workspace constants.ts must match these values. Liquid glass is mandatory on every surface -- no static flat rectangles.*
