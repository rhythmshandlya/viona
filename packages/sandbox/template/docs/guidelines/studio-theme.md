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

### Glass Effect Recipe
Every "glass panel" or "glass card" in a scene uses this combination:
```typescript
const GLASS = {
  background: 'rgba(28, 28, 35, 0.55)',
  backdropFilter: 'blur(40px) saturate(180%) brightness(1.1)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  borderTop: '1px solid rgba(255, 255, 255, 0.12)',  // Specular highlight on top edge
  borderRadius: 20,
  shadow: '0 8px 32px rgba(0, 0, 0, 0.35), 0 2px 8px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
};
```

**Example usage in a scene:**
```tsx
<div style={{
  background: GLASS.background,
  backdropFilter: GLASS.backdropFilter,
  border: GLASS.border,
  borderTop: GLASS.borderTop,
  borderRadius: GLASS.borderRadius,
  boxShadow: GLASS.shadow,
  padding: 32,
}}>
  <h2 style={{ color: COLORS.textPrimary, fontSize: 48, fontFamily: FONTS.heading }}>
    Key Insight
  </h2>
</div>
```

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
- **Max font weight: 500** — never use bold (600+). Emphasis comes from opacity and color, not weight.
- Heading weight: 500
- Body weight: 400
- Label weight: 400
- Letter spacing: `0.025em` standard, `-0.025em` for tight headings

## Animation Style

### Spring Configuration
```typescript
const SPRING_CONFIG = {
  damping: 30,
  mass: 1,
  stiffness: 500,
};
```
This produces a snappy, confident feel with minimal overshoot. Used for all entrance animations.

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

**Entrances:**
- Elements enter from bottom (`translateY(20px) → 0`) with opacity fade (`0 → 1`)
- Use spring animation (SPRING_CONFIG) for position
- Scale entrances: start at 90% → 100% (subtle, not dramatic)
- Opacity ALWAYS fades in from 0 — never pop in instantly
- Stagger elements by 6-10 frames minimum

**Exits:**
- Fade out (`opacity: 1 → 0`) with slight downward drift
- Use `ease-out` easing, NOT spring
- Faster than entrances (12 frames vs 20 frames)

**Repositions:**
- Use `ease-in-out` for elements moving between positions
- Duration proportional to distance traveled

**Continuous motion:**
- Subtle floating/breathing animations for ambient elements
- Very slow scale oscillation (0.98 → 1.02) over 60+ frames
- Never distract from primary content

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
- **Glass containers:** Semi-transparent with backdrop blur
- **Never pure black (`#000000`)** — always use `#08080C` or darker grays
- **Never pure white text** — always use `rgba(255, 255, 255, 0.95)` max

## Example Scenes

### Example 1: Three-Step Process
```tsx
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';

const COLORS = { /* as above */ };
const GLASS = { /* as above */ };
const SPRING_CONFIG = { damping: 30, mass: 1, stiffness: 500 };

const ThreeStepProcess: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const steps = ['Research', 'Design', 'Build'];

  return (
    <div style={{
      width, height,
      background: '#08080C',
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
        fontWeight: 500,
        opacity: interpolate(frame, [0, 15], [0, 1], {
          extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
        }),
        transform: `translateY(${interpolate(frame, [0, 15], [20, 0], {
          extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
        })}px)`,
      }}>
        The Process
      </h1>

      {/* Step cards — staggered entrance */}
      <div style={{ display: 'flex', gap: 20 }}>
        {steps.map((step, i) => {
          const delay = 15 + i * 8;  // 8 frame stagger
          const opacity = interpolate(frame, [delay, delay + 20], [0, 1], {
            extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
          });
          const y = interpolate(frame, [delay, delay + 20], [30, 0], {
            extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
          });
          return (
            <div key={step} style={{
              ...GLASS,
              padding: 32,
              width: 280,
              textAlign: 'center',
              opacity,
              transform: `translateY(${y}px)`,
            }}>
              <div style={{ color: COLORS.primary, fontSize: 40, fontWeight: 500 }}>
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
          fontWeight: 500,
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
          fontWeight: 500,
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
        background: 'rgba(28, 28, 35, 0.55)',
        backdropFilter: 'blur(40px) saturate(180%) brightness(1.1)',
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
          fontWeight: 500,
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
- Pure black (`#000000`) or pure white (`#FFFFFF`) — always off-black and off-white
- Font weight above 500 — emphasis via color and opacity only
- Hard borders (1px solid white) — all borders are low-opacity white
- Bright saturated backgrounds — backgrounds are always dark with subtle tints
- Drop shadows with color (colored shadows) — shadows are always neutral black at varying opacity
- Gradients on text
- 3D transforms (rotateX, rotateY, perspective) — keep everything flat/2D
- Heavy textures or patterns — glassmorphism is about translucency, not texture

---

*This is Viona's default studio theme. Every animator agent loads this before generating scene code. All `COLORS`, `GLASS`, `SPRING_CONFIG`, `FONTS`, `SPACING` constants in the workspace `constants.ts` must match these values exactly.*
