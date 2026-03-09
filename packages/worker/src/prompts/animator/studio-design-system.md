<studio_templates>
## STUDIO THEME — TEMPLATE LIBRARY (shadcn model)

Templates are **source code you own**. Like shadcn/ui, you copy the source into your
scene file and customize freely — they are NOT imported as black-box packages.

### Template Location
Each template lives in `src/.templates/{{slug}}/` with:
- `index.tsx` — Main component
- `schema.ts` — Zod props schema (self-defaults via `schema.parse({{}})`)
- `constants.ts` — BACKGROUNDS object + `getConstants()` for colors/fonts
- `components/` — Reusable sub-components (CardShell, TrendBadge, etc.)

### MANDATORY: Theme Immersion Before Implementation

**Before writing ANY scene code, you MUST complete this step:**

1. Read at least 3 different templates from `src/.templates/` (e.g., `stat-counter`, `quote-pulse`, `versus-screen`)
2. Study how they use: DotGrid backgrounds, glass card containers, `useScale()`, `FONT_PAIRS`, spring configs, accent color transparency
3. Write `constants.ts` using the STUDIO THEME COLORS below — NOT the Director's `colorPalette` field

The Director's `colorPalette` in scenes.json is a **topic hint only**. Your constants.ts MUST use these exact studio theme values:
```tsx
export const THEME = {{{{
  background: '{background}',
  text: '{text}',
  textMuted: '{textMuted}',
  gridColor: '{gridColor}',
  cardBg: '{cardBg}',
  cardBorder: '{cardBorder}',
  accent: '{accentDefault}',
  secondary: '{secondaryDefault}',
}}}};
```

If you skip this step, your scenes will look generic and off-brand. Templates show you **what good looks like** — the DotGrid, the glass cards, the spring entrances, the font system, the accent glow conventions. Internalize these patterns before you write a single line.

### Workflow
1. **Read 3+ templates** to absorb the studio design language (MANDATORY — see above)
2. Check `suggestedTemplates` in `scenes.json` for each scene
3. Read suggested template source — `src/.templates/{{slug}}/index.tsx` (and `components/`)
4. Implement scene — use template patterns (DotGrid, cards, springs, fonts) whether copying or going custom
5. When adapting template code, use **`BACKGROUNDS.{variant}`** for theme colors

### ACTIVE THEME: {variant_label}

**Theme Colors (from BACKGROUNDS.{variant}):**
- background: `{background}`
- text: `{text}`
- textMuted: `{textMuted}`
- gridColor: `{gridColor}`
- cardBg: `{cardBg}`
- cardBorder: `{cardBorder}`

Default accents: primary `{accentDefault}` (indigo), secondary `{secondaryDefault}` (pink).

### RESPONSIVE SCALING (CRITICAL)

Templates use `useScale()` from `../../use-scale` for ALL pixel values.
Base canvas: 1080px wide. `s(32)` = 32px at 1080w, scales proportionally.

```tsx
import {{{{ useScale }}}} from '../../use-scale';
const s = useScale();
// Use s() for ALL numeric values:
fontSize: s(48),  padding: s(56),  borderRadius: s(32),  gap: s(20)
```

**You MUST use `s()` for every pixel value in your scene code.** Raw pixel numbers
will break on non-1080 canvases.

### FONT SYSTEM

Import from shared fonts module — do NOT use raw font-family strings:
```tsx
import {{{{ FONT_PAIRS }}}} from '../../fonts';
const FONTS = FONT_PAIRS['boldImpact']; // or cleanMinimal, modernTech, etc.
// Then use: fontFamily: FONTS.headline, fontFamily: FONTS.body
```

Available pairs:
| Key | Headline | Body |
|-----|----------|------|
| boldImpact | Bebas Neue | Roboto |
| cleanMinimal | Inter | Inter |
| modernTech | Montserrat | Inter |
| elegantEditorial | Playfair Display | Lato |
| friendlyTech | Poppins | Inter |

### DOT GRID BACKGROUND (MANDATORY in every non-overlay scene)

**Every scene with `displayMode: "default"` or `displayMode: "fullscreen"` MUST have:**
1. A solid background fill using `THEME.background` (`{background}`)
2. The DotGrid overlay on top

Scenes with `displayMode: "overlay"` skip the background (they render over video).

```tsx
// MANDATORY: Add this to every non-overlay scene
<div style={{{{{{ position: 'absolute', inset: 0, background: '{background}' }}}}}} />
<DotGrid color="{gridColor}" s={{{{s}}}} />

const DotGrid: React.FC<{{{{ color: string; s: (px: number) => number }}}}> = ({{{{ color, s }}}}) => (
  <svg width="100%" height="100%" style={{{{{{ position: 'absolute', inset: 0, pointerEvents: 'none' }}}}}}>
    <defs>
      <pattern id="dot-grid" width={{{{s(80)}}}} height={{{{s(80)}}}} patternUnits="userSpaceOnUse">
        <circle cx={{{{s(40)}}}} cy={{{{s(40)}}}} r={{{{s(3)}}}} fill={{{{color}}}} />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#dot-grid)" />
  </svg>
);
```

**A scene without the studio background (`{background}` + DotGrid) is BROKEN.** Do not skip this.

### ANIMATION QUALITY STANDARDS (MANDATORY)

These 8 rules separate professional motion design from AI slop. Violating any rule = revision.

**RULE 1: Combine opacity + scale + slide (NEVER animate one dimension alone)**
WRONG:
```tsx
style={{{{{{ opacity: fadeIn }}}}}}
```
RIGHT:
```tsx
style={{{{{{ opacity: fadeIn, transform: `scale(${{{{popScale}}}}) translateY(${{{{slideY}}}}px)` }}}}}}
```

**RULE 2: Vary animation types across staggered elements**
WRONG: all items use identical `spring()` + opacity with only delay offset.
RIGHT: item 0 pops with snappy spring, item 1 slides from left, item 2 scales up from below. Each element has its own animation character.

**RULE 3: Spring config MUST match animation intent**
- Impact/pop: `{{{{ damping: 10, stiffness: 200, mass: 1.4 }}}}` — bouncy overshoot
- Smooth settle: `{{{{ damping: 26, stiffness: 120, mass: 1.0 }}}}` — no overshoot
- Connecting lines/paths: use `Easing.out(Easing.cubic)` not springs
- WRONG: every animation uses the same spring config

**RULE 4: No emoji as content**
Emoji (e.g. stars, icons, symbols) is placeholder thinking. Use custom SVG `<path>` elements or fetch professional icons via MCP icon tools.

**RULE 5: No placeholder SVG shapes**
WRONG:
```tsx
<ellipse cx={{{{50}}}} cy={{{{50}}}} rx={{{{40}}}} ry={{{{40}}}} fill="blue" />
```
RIGHT: Use detailed `<path d="...">` with curves, or use Iconify/Freepik MCP tools for professional icons. Simple geometric primitives without detail look AI-generated.

**RULE 6: Glow/shadow intensity must match narrative moments**
Glow should INTENSIFY at key sync points, not remain constant.
```tsx
textShadow: `0 0 ${{{{s(glowRadius)}}}}px ${{{{accentColor}}}}88, 0 0 ${{{{s(glowRadius * 2)}}}}px ${{{{accentColor}}}}44, 0 0 ${{{{s(glowRadius * 3)}}}}px ${{{{accentColor}}}}22`
```
Use 3 layered opacity tiers (88/44/22) for depth. Animate `glowRadius` to peak at sync points.

**RULE 7: Gradient direction must encode meaning**
- `90deg` = progression/timeline
- `135deg` = emphasis/growth
- `radial-gradient` = energy radiating from a point
- Never use arbitrary angles. The direction must reinforce the visual narrative.

**RULE 8: Every visual moment must connect to narration**
Map each narration phrase to a specific visual change. Pause test: at any random frame, the viewer should understand what is being said from the visuals alone.

### VISUAL CONTENT HIERARCHY (MANDATORY)

Every scene MUST have three layers. A scene with only text is BROKEN.

**Layer 1 — PRIMARY CONTENT (60% visual weight):**
The core idea as a VISUAL, not just text. Map concept → template:
| Concept | Use | Not |
|---------|-----|-----|
| Number/stat | stat-counter, animated counter | Plain text "10,000+" |
| Comparison | versus-screen, split layout with metrics | Two text labels |
| Before/After | before-after-reveal, divider wipe | Side-by-side text |
| Process/Steps | process-flow, connecting nodes | Numbered text list |
| Data trend | stat-bar-chart, stat-line-chart | Descriptive paragraph |
| Feature list | bullet-stack with icons | Plain bullet points |
| Quote/Hook | quote-pulse, large typography + accent | Small centered text |

**Layer 2 — SUPPORTING GRAPHICS (30% visual weight):**
Labels, icons, arrows that annotate Layer 1. Rules:
- Icons MUST be paired with text labels (never standalone decorative icons)
- Diagrams MUST have labels on arrows/zones/connections
- Use Freepik/Iconify MCP for icons — never bare emoji or crude SVG shapes

**Layer 3 — AMBIENT ATMOSPHERE (10% visual weight, opacity ≤ 15%):**
Subtle depth: DotGrid, particle flow, glow intensification at sync points.
Direction must match narrative (upward particles = growth, lateral = progression).

### SYNC COVERAGE (MANDATORY)

Every 3-5 seconds of narration MUST have a visual CHANGE (not just animation continuation).

Plan your scene timeline BEFORE coding:
- Frame 0-30: Setup (title, initial composition)
- Frame 0: ALL elements visible in DIMMED/PREVIEW state (40-60% opacity, muted colors, scale 0.85-0.95)
- Every 60-90 frames: Next element ACTIVATES (brightens to 1.0, scales to 1.0, accent glow appears)
- keySync frame: MAJOR transformation (hero element fully activates, multiple elements respond)
- Last 30 frames: Settle (all elements fully active, subtle ambient motion only)

A sync point is a REVEAL/HIGHLIGHT moment — NOT "introduce from nothing." All key elements
should be VISIBLE (dimmed at 40-60% opacity, muted color, small scale) from frame 0.
At sync points, elements ACTIVATE: brighten to 100% opacity, scale up, add glow,
shift from muted to accent color. The screen must NEVER be empty waiting for a sync point.

Good sync events: element brightens + scales + gets glow, counter starts rolling,
diagram arrows light up, card border shifts to accent color, label appears beside
an already-visible icon. Bad: element appears from nothing on an empty screen.

### WHAT NOT TO BUILD (ANTI-PATTERNS)

**Text-Only Scene:** If your scene is just typography fading in, it's broken.
Add a visual metaphor — a diagram, chart, icon set, or comparison layout.

**Decorative Icons:** An icon that bounces/pulses but has no label = decoration.
Every icon needs a text label explaining what it represents.

**Empty Frames:** If narrator speaks for 5+ seconds with a static visual, it's broken.
Add intermediate visual events every 3-5 seconds.

**Caption Duplication:** Overlay text must NEVER repeat the spoken narration verbatim.
Captions/subtitles already display the narrator's words at the bottom of the screen.
Overlay visuals must show SUPPORTING content: stats, icons with labels, comparison badges,
data visualizations, key metrics. If you're typing the same words the narrator says, STOP.
Ask: "What VISUAL DATA supports what the narrator is saying?"

**Raw Shapes as Concepts:** Drawing circles/rectangles to represent complex ideas = lazy.
Use template component structures (stat-counter, process-flow, versus-screen).

**Crude Figurative SVGs:** If you cannot draw a RECOGNIZABLE SVG illustration (person, animal,
building, vehicle, map), DO NOT attempt it. Wavy lines are NOT "swimmer silhouettes." Ellipses
are NOT "world maps." An unrecognizable SVG is worse than no SVG at all. Instead use:
  (a) Geometric abstractions: circles, arcs, progress rings, bar segments, chevrons
  (b) Typography-driven design: large bold text with accent colors, animated counters
  (c) Data visualization: bar charts, progress bars, percentage rings, number tickers
  (d) Professional icons via MCP tools (Iconify/Freepik)
RULE: If a paused viewer would ask "what is that shape?" — delete it and use typography or geometry.

**Over-Animated Text:** Text bouncing with 3 springs, rotating, with particle emitter = slop.
Text gets simple fade+scale. Save dramatic animation for GRAPHICS.

### CARD CONTAINERS

Glass card (default):
```tsx
{{{{
  background: '{cardBg}',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid {cardBorder}',
  borderRadius: s(32),
  padding: `${{{{s(56)}}}}px ${{{{s(64)}}}}px`,
  maxWidth: s(900),
  boxShadow: `0 ${{{{s(8)}}}}px ${{{{s(32)}}}}px rgba(0, 0, 0, 0.2)`,
}}}}
```
Variants: solid (opaque bg), gradient (`linear-gradient(135deg, ${{{{accentColor}}}}18 0%, {cardBg} 100%)`), outline (transparent + border only).

### ACCENT COLOR TRANSPARENCY CONVENTION

When using accent colors for glows, tints, and overlays, append hex alpha:
- `${{{{accentColor}}}}18` — 9% opacity (subtle tint, gradient bg)
- `${{{{accentColor}}}}30` — 19% (medium tint)
- `${{{{accentColor}}}}44` — 27% (radial glow)
- `${{{{accentColor}}}}66` — 40% (text shadow glow)
- `${{{{accentColor}}}}88` — 53% (strong glow)

### ANIMATION LIFECYCLE (every scene MUST follow)

1. **Intro** (frames 0-15): scene fades in, ALL elements visible in DIMMED state (opacity 0.4-0.6, muted color, scale 0.85-0.95)
2. **Progressive activation** (frames 15 to dF-60): elements ACTIVATE one-by-one at sync points (brighten to 1.0, scale to 1.0, add accent glow), staggered 6-8 frames per activation
3. **Hold** (frames dF-60 to dF-30): all elements fully active with continuous ambient motion (see CONTINUOUS MOTION RECIPES below)
4. **Outro** (frames dF-30 to dF): opacity 1→0
- Combine: `const opacity = introOpacity * outroOpacity;`
- DIMMED state example: `opacity: isActivated ? 1.0 : 0.5, color: isActivated ? COLORS.accent : COLORS.textMuted, transform: isActivated ? 'scale(1)' : 'scale(0.9)'`

### CONTINUOUS MOTION RECIPES (use during Hold phase)
"Hold" means ALIVE, not FROZEN. Every visible element should have subtle ambient motion:

| Element Type | Motion | Code Pattern |
|---|---|---|
| Cards/containers | Gentle Y float | `translateY(${{Math.sin(frame * 0.03) * 3}}px)` — 3px amplitude, slow |
| Hero numbers | Scale breathing | `scale(${{1 + Math.sin(frame * 0.04) * 0.01}})` — 1.0 to 1.01 |
| Icons | Gentle rotation | `rotate(${{Math.sin(frame * 0.02) * 2}}deg)` — 2 degrees |
| Accent borders | Glow pulse | `boxShadow` opacity varies 0.3 to 0.45 via Math.sin |
| Progress bars | Shimmer | Moving gradient highlight across the filled area |
| Background grid | Slow drift | `backgroundPosition: ${{frame * 0.1}}px ${{frame * 0.05}}px` |

IMPORTANT: Math.sin/cos is ALLOWED for these subtle ambient motions on non-text elements
or on text SCALE only (not text position). Amplitude must be tiny: 2-5px drift, 0.01-0.02
scale, 1-3 degree rotation. Large amplitudes or text-position sin = JITTER = BROKEN.

### SPRING CONFIGS (from templates)

- Card entrance: `{{{{ damping: 20, stiffness: 120, mass: 0.8 }}}}` — smooth settle
- Hero text reveal: `{{{{ damping: 20, stiffness: 170 }}}}` — snappy
- Gentle slide: `{{{{ damping: 20, stiffness: 90, mass: 1 }}}}` — standard
- **NEVER** damping < 10 (too bouncy) or > 26 (overdamped)

### RENDERING RULES

- Pure inline styles ONLY: `style={{{{{{...}}}}}}`. No CSS files, no CSS-in-JS.
- All graphics via inline SVG (charts, icons, shapes). No image imports.
- Every `interpolate()` MUST have `{{{{ extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }}}}`
- Never use `Math.sin/cos` on text positions (causes jitter)
- `backdropFilter` always paired with `WebkitBackdropFilter`
- Stagger minimum 6 frames between elements
</studio_templates>
