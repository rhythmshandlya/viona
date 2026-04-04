<blackboard_theme>
## BLACKBOARD GLOW — TEMPLATE LIBRARY (shadcn model)

Templates are **source code you own**. Use `browse_templates` with `theme: "blackboard"` to discover available templates, then `fork_template` to copy source into your workspace and customize freely.

### MANDATORY: Theme Immersion Before Implementation

**Before writing ANY scene code, you MUST complete this step:**

1. Use `browse_templates` with `theme: "blackboard"` to see available templates
2. Fork at least 2 templates with `fork_template` and read their source code
3. Study how they use: BoardTexture backgrounds, GlowPanel containers, `useScale()`, `FONT_PAIRS`, glow animations, accent color conventions
4. Write `constants.ts` using the THEME COLORS below — NOT the Director's `colorPalette` field

The Director's `colorPalette` in scenes.json is a **topic hint only**. Your constants.ts MUST use these exact theme values:
```tsx
export const THEME = {
  background: '{background}',
  text: '{text}',
  textMuted: '{textMuted}',
  accent: '{accent}',
  secondary: '{secondary}',
  surface: '#18181b',
  surfaceBorder: '#27272a',
};
```

If you skip this step, your scenes will look generic and off-brand. Templates show you **what good looks like** — the board texture, the glow panels, the neon bloom entrances, the font system. Internalize these patterns before you write a single line.

### ACTIVE THEME: {label}

**Theme Colors:**
- background: `{background}` (near-black board)
- text: `{text}` (off-white)
- textMuted: `{textMuted}`
- accent: `{accent}` (warm amber)
- secondary: `{secondary}` (cool cyan)
- surface: `#18181b` (panel fill)
- surfaceBorder: `#27272a` (panel border)

### RESPONSIVE SCALING (CRITICAL)

Templates use `useScale()` from `../../use-scale` for ALL pixel values.
Base canvas: 1080px wide. `s(32)` = 32px at 1080w, scales proportionally.

```tsx
import { useScale } from '../../use-scale';
const s = useScale();
// Use s() for ALL numeric values:
fontSize: s(48),  padding: s(56),  borderRadius: s(32),  gap: s(20)
```

**You MUST use `s()` for every pixel value in your scene code.** Raw pixel numbers will break on non-1080 canvases.

### FONT SYSTEM

```tsx
import { FONT_PAIRS } from '../../fonts';
const FONTS = FONT_PAIRS['cleanMinimal']; // Inter for both headline and body
// Then use: fontFamily: FONTS.headline, fontFamily: FONTS.body
```

For monospace/data displays: use Fira Code (import from `@remotion/google-fonts/FiraCode`).

### BOARD TEXTURE BACKGROUND (MANDATORY in every non-overlay scene)

**Every scene with `displayMode: "default"` or `displayMode: "fullscreen"` MUST have:**
1. A radial gradient background from `#0c0c28` (center) to `{background}` (edges)
2. An feTurbulence noise overlay (baseFrequency 0.55, 4 octaves, opacity 0.05)
3. A radial vignette fading to `rgba(0,0,0,0.4)` at edges

Scenes with `displayMode: "overlay"` skip the background (they render over video).

```tsx
const BoardTexture: React.FC<{ s: (px: number) => number }> = ({ s }) => (
  <>
    <div style={{ position: 'absolute', inset: 0,
      background: 'radial-gradient(ellipse at center, #0c0c28 0%, {background} 100%)' }} />
    <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.05, pointerEvents: 'none' }}>
      <filter id="board-noise">
        <feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="4" />
      </filter>
      <rect width="100%" height="100%" filter="url(#board-noise)" />
    </svg>
    <div style={{ position: 'absolute', inset: 0,
      background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.4) 100%)' }} />
  </>
);
```

### GLOW PANEL CONTAINERS

```tsx
{
  background: '#18181b',
  borderRadius: s(16),
  padding: `${s(32)}px ${s(40)}px`,
  boxShadow: `0 0 ${s(20)}px rgba(245,158,11,0.1), 0 ${s(8)}px ${s(32)}px rgba(0,0,0,0.4)`,
}
```

**Do NOT use thin borders (`1px solid`).** Use `boxShadow` for edge definition and depth — not outlines. Professional motion graphics use filled surfaces with shadow/glow for depth, not wireframe borders.

### GLOW CONVENTIONS

Amber glow: `drop-shadow(0 0 6px rgba(255,140,66,0.5))`
Cyan bars: `boxShadow: '0 0 10px rgba(77,216,232,0.3)'`
Scale-based: `0 0 ${progress * 40}px rgba(255,140,66,${progress * 0.2})`

### ANIMATION LANGUAGE: "Neon Bloom"

Two-phase reveals — glow appears first, then content fills in:
1. Glow rises (half duration, opacity 0→1 on glow layer)
2. Content scales in (0.97→1.0, remaining duration)
Exit: fade out + scale shrink. Stagger: 7 frames between elements.
Easing: `Easing.bezier(0.25, 0.1, 0.25, 1.0)`

### SPRING CONFIGS

- Panel entrance: `{ damping: 20, stiffness: 120, mass: 0.8 }`
- Text reveal: `{ damping: 20, stiffness: 170 }`
- Gentle slide: `{ damping: 20, stiffness: 90, mass: 1 }`

### RENDERING RULES

- Pure inline styles ONLY: `style={{...}}`. No CSS files, no CSS-in-JS.
- All graphics via inline SVG. No image imports.
- Every `interpolate()` MUST have `{ extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }`
- Stagger minimum 6 frames between elements
</blackboard_theme>
