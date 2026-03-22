# Viona Studio Theme

> Clean, minimal design system. Dot grid backgrounds, Tailwind Slate palette, content-adaptive accents.
> Every animator agent MUST follow this theme. All constants in `constants.ts` must match these values.

## Color Palette

### Dark Mode (default)
```typescript
const COLORS = {
  // Backgrounds — Tailwind Slate scale
  bgBase: '#020617',              // Slate-950 — deepest background
  bgSurface: '#0f172a',           // Slate-900 — panels, containers
  bgElevated: '#1e293b',          // Slate-800 — elevated elements
  bgSubtle: '#334155',            // Slate-700 — subtle fills

  // Dot grid
  dotColor: 'rgba(148, 163, 184, 0.15)', // Slate-400 at 15% — grid dots
  dotRadius: 1,                           // px
  dotSpacing: 24,                         // px between dots

  // Text — Tailwind Slate
  textPrimary: '#f8fafc',         // Slate-50 — headings, key content
  textSecondary: '#94a3b8',       // Slate-400 — supporting text
  textMuted: '#475569',           // Slate-600 — disabled, hints

  // Borders — Tailwind Slate
  borderSubtle: '#1e293b',        // Slate-800
  borderDefault: '#334155',       // Slate-700
  borderFocus: '#3b82f6',         // Blue-500

  // Semantic
  success: '#10b981',             // Emerald-500
  warning: '#f59e0b',             // Amber-500
  error: '#ef4444',               // Red-500

  // Chart / data visualization
  chart1: '#3b82f6',              // Blue-500
  chart2: '#8b5cf6',              // Violet-500
  chart3: '#10b981',              // Emerald-500
  chart4: '#f59e0b',              // Amber-500
  chart5: '#ec4899',              // Pink-500
};
```

### Light Mode
```typescript
const COLORS = {
  bgBase: '#ffffff',              // White
  bgSurface: '#f8fafc',          // Slate-50
  bgElevated: '#f1f5f9',         // Slate-100
  bgSubtle: '#e2e8f0',           // Slate-200

  dotColor: 'rgba(100, 116, 139, 0.2)',  // Slate-500 at 20%
  dotRadius: 1,
  dotSpacing: 24,

  textPrimary: '#0f172a',        // Slate-900
  textSecondary: '#64748b',      // Slate-500
  textMuted: '#94a3b8',          // Slate-400

  borderSubtle: '#e2e8f0',       // Slate-200
  borderDefault: '#cbd5e1',      // Slate-300
  borderFocus: '#3b82f6',        // Blue-500

  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',

  chart1: '#3b82f6',
  chart2: '#8b5cf6',
  chart3: '#10b981',
  chart4: '#f59e0b',
  chart5: '#ec4899',
};
```

### Content-Adaptive Color

Color direction comes from the scene content, not a fixed palette. Read the scene's description from the plan:
- Growth/money/success -> emerald/gold (`#10b981`, `#f59e0b`)
- Danger/urgency/warning -> red/amber (`#ef4444`, `#f97316`)
- Technical/data/analysis -> blue/cyan (`#3b82f6`, `#06b6d4`)
- Creative/inspiration -> violet/magenta (`#8b5cf6`, `#ec4899`)
- Calm/health/nature -> teal/green (`#14b8a6`, `#22c55e`)

Animators use inline hex colors per scene rather than relying on `COLORS.chart1` for accent color. Constants are a fallback.

## Background

### Dot Grid Pattern

Every scene background uses a dot grid. Implement as an SVG pattern layer:

```tsx
// Dot grid background — add as the first layer in every scene
<svg style={{ position: 'absolute', inset: 0, width: SCENE_WIDTH, height: SCENE_HEIGHT, pointerEvents: 'none' }}>
  <pattern id="dot-grid" x="0" y="0" width={COLORS.dotSpacing} height={COLORS.dotSpacing} patternUnits="userSpaceOnUse">
    <circle cx={COLORS.dotSpacing / 2} cy={COLORS.dotSpacing / 2} r={COLORS.dotRadius} fill={COLORS.dotColor} />
  </pattern>
  <rect width="100%" height="100%" fill={COLORS.bgBase} />
  <rect width="100%" height="100%" fill="url(#dot-grid)" />
</svg>
```

**The dot grid is NEVER static.** Animate at least one property:
- Slow drift: offset the pattern position over time (`x={Math.sin(frame * 0.01) * 3}`)
- Opacity breathe: pulse the dot opacity subtly
- Density shift: change spacing in response to scene energy

### Surfaces

Surfaces use solid Tailwind Slate colors — not transparent/glass. Visual interest comes from:
- **Animated borders** — border color shifts or glows with content accent
- **Depth shadows** — shadows animate in over 15 frames, not instant
- **Subtle background gradients** — `bgSurface` to `bgElevated` with shifting angle

```tsx
// Surface with animated border glow
const borderGlow = interpolate(frame, [enter, enter + 20], [0, 1], {
  extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
});
{
  background: COLORS.bgSurface,
  border: `1px solid ${accentColor}`,
  borderColor: `rgba(accent, ${0.2 + borderGlow * 0.3})`,
  borderRadius: RADIUS.lg,
  boxShadow: `0 ${4 * borderGlow}px ${16 * borderGlow}px rgba(0,0,0,0.2),
              0 0 ${8 * borderGlow}px rgba(accent, 0.1)`,
}
```

**Key rule:** No flat rectangles. Every surface must have at least one animated visual property (border glow, shadow growth, or gradient shift).

## Typography

### Fonts
```typescript
const FONTS = {
  heading: 'Sora, system-ui, sans-serif',
  body: 'Sora, system-ui, sans-serif',
  mono: 'monospace',
};
```

### Sizes (for 1080x1920 vertical canvas)
```typescript
const FONT_SIZES = {
  title: 72,        // Hero titles, big reveals
  heading: 56,      // Section headings
  subheading: 40,   // Sub-sections, card titles
  body: 32,         // Explanatory text
  label: 24,        // Labels, captions
  tiny: 18,         // Fine print
};
```

### Weight & Emphasis
- **Hero text** (key numbers, titles): weight **700-800**, tight tracking (`-0.025em`)
- **Heading:** weight 600
- **Body:** weight 400
- **Label:** weight 400, wide tracking (`0.05em`)
- Multi-layer text shadows for depth: `textShadow: '0 2px 8px rgba(0,0,0,0.3)'`

## Animation Style

### Spring Vocabulary
```typescript
const SPRINGS = {
  SNAPPY:  { damping: 20, mass: 1, stiffness: 180 },   // Hero reveals, key numbers
  SMOOTH:  { damping: 28, mass: 1, stiffness: 120 },   // Containers, supporting elements
  BOUNCY:  { damping: 12, mass: 0.8, stiffness: 200 }, // Icons, small accents
  HEAVY:   { damping: 35, mass: 1.5, stiffness: 100 }, // Large panels, backgrounds
};
```

**Rule:** Adjacent elements MUST use different springs. Spring contrast creates choreography.

### Ease Curve
```typescript
const EASE_SMOOTH = [0.2, 0.65, 0.3, 0.9];  // Cubic bezier for exits and repositions
```

### Timing
```typescript
const TIMING = {
  staggerMin: 6,
  staggerDefault: 8,
  entranceDuration: 20,
  exitDuration: 12,
  holdMin: 30,
  transitionFast: 150,
  transitionNormal: 250,
};
```

### Motion Principles

**Entrances — vary the direction:**
- NEVER have all elements enter from the same direction
- **Overlapping action:** Opacity starts 3-5 frames BEFORE transform. Creates physical weight.
- Stagger elements by 6-10 frames minimum
- Use SPRINGS vocabulary matched to element purpose

**Continuous idle motion (MANDATORY):**
- Float: `translateY(Math.sin(frame * 0.03) * 5)` — 5px minimum
- Breathe: `scale(1 + Math.sin(frame * 0.025) * 0.025)` — 2.5% minimum
- Rotate drift: `rotate(Math.sin(frame * 0.02) * 2)` — 2° minimum
- Glow pulse: `opacity: 0.3 + Math.sin(frame * 0.04) * 0.15` — visible range
- **Background dot grid is NEVER static** — always drifting or breathing
- **45 frames frozen = scene has FAILED**

**Exits:**
- Fade out with slight downward drift (`translateY(0 → 10px)`)
- Use `EASE_SMOOTH`, NOT spring — exits are a gentle release
- Faster than entrances: ~12 frames vs ~20 frames
- Exit 5-10 frames BEFORE the scene cut

## Shape & Layout

### Border Radius
```typescript
const RADIUS = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 9999,
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
  canvasEdge: 48,
};
```

### Shadows
```typescript
const SHADOWS = {
  sm: '0 1px 3px rgba(0, 0, 0, 0.15), 0 1px 2px rgba(0, 0, 0, 0.1)',
  md: '0 4px 16px rgba(0, 0, 0, 0.2), 0 2px 4px rgba(0, 0, 0, 0.1)',
  lg: '0 8px 32px rgba(0, 0, 0, 0.25), 0 4px 8px rgba(0, 0, 0, 0.15)',
  glow: (color: string) => `0 0 12px ${color}33`,  // Accent glow at 20% opacity
};
```

## Do NOT Use
- Glassmorphic surfaces (`backdrop-filter: blur`, semi-transparent backgrounds)
- Pure black (`#000000`) or pure white text (`#FFFFFF`) — use Slate scale
- Colored shadows — shadows are always neutral
- Gradients on text
- `backdrop-filter` — unreliable in Remotion canvas rendering
- Static flat rectangles as containers — every surface needs animation
- Generic card layouts as default — prefer SVG paths, charts, kinetic typography, visual metaphors
- Heavy textures or patterns beyond the dot grid

---

*Viona's studio theme. Every animator agent loads this before generating scene code. All constants in `constants.ts` must match these values.*
