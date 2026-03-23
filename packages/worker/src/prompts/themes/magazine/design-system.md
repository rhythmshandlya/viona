<magazine_theme>
## MAGAZINE — TEMPLATE LIBRARY (shadcn model)

Templates are **source code you own**. Use `browse_templates` with `theme: "magazine"` to discover available templates, then `fork_template` to copy source into your workspace and customize freely.

### MANDATORY: Theme Immersion Before Implementation

**Before writing ANY scene code, you MUST complete this step:**

1. Use `browse_templates` with `theme: "magazine"` to see available templates
2. Fork at least 2 templates with `fork_template` and read their source code
3. Study how they use: PaperTexture backgrounds, editorial layouts, `useScale()`, serif typography, reveal animations
4. Write `constants.ts` using the THEME COLORS below — NOT the Director's `colorPalette` field

The Director's `colorPalette` in scenes.json is a **topic hint only**. Your constants.ts MUST use these exact theme values:
```tsx
export const THEME = {
  background: '{background}',
  text: '{text}',
  textMuted: '{textMuted}',
  accent: '{accent}',
  secondary: '{secondary}',
};
```

### ACTIVE THEME: {label}

**Theme Colors:**
- background: `{background}` (clean white)
- text: `{text}` (dark slate)
- textMuted: `{textMuted}`
- accent: `{accent}` (editorial red)
- secondary: `{secondary}` (slate gray)

### RESPONSIVE SCALING (CRITICAL)

Templates use `useScale()` from `../../use-scale` for ALL pixel values.
Base canvas: 1080px wide. `s(32)` = 32px at 1080w, scales proportionally.

```tsx
import { useScale } from '../../use-scale';
const s = useScale();
fontSize: s(48),  padding: s(56),  borderRadius: s(32),  gap: s(20)
```

### FONT SYSTEM

```tsx
import { FONT_PAIRS } from '../../fonts';
const FONTS = FONT_PAIRS['elegantEditorial']; // Playfair Display + Lato
// Headlines: fontFamily: FONTS.headline (serif, 700)
// Body: fontFamily: FONTS.body (sans-serif, 400)
```

For accent text: Merriweather (serif, import from `@remotion/google-fonts/Merriweather`).
Typography is the hero — tight letter-spacing on headlines (`-0.025em`), generous white space, strong weight contrast.

### PAPER TEXTURE BACKGROUND (MANDATORY in every non-overlay scene)

**Every scene with `displayMode: "default"` or `displayMode: "fullscreen"` MUST have:**
1. A clean white base (`{background}`)
2. An optional SVG feTurbulence fiber grain overlay (opacity 0.03-0.05)

Scenes with `displayMode: "overlay"` skip the background.

```tsx
const PaperTexture: React.FC<{ age?: number }> = ({ age = 0.3 }) => (
  <>
    <div style={{ position: 'absolute', inset: 0, background: '{background}' }} />
    <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: age * 0.05, pointerEvents: 'none' }}>
      <filter id="paper-grain">
        <feTurbulence type="fractalNoise" baseFrequency="0.4" numOctaves="3" seed="42" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#paper-grain)" />
    </svg>
  </>
);
```

### LAYOUT PATTERNS

Open editorial layouts — NO card containers. Typography-driven hierarchy:
- Centered flex columns with `s(80)` horizontal padding
- Horizontal rules (`3px` accent bars) as section dividers
- Generous white space between elements

```tsx
{
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: `${s(60)}px ${s(80)}px`,
  gap: s(32),
}
```

### ANIMATION LANGUAGE: "Editorial Precision"

Simple, confident motion:
- `editorialReveal`: fade in + translateY up (s(15) travel, 20 frame duration)
- `paperSlide`: enters from direction with slight rotation (-3° to +3°)
- Stagger: 12 frames between elements
- Easing: `Easing.bezier(0.25, 0.1, 0.25, 1.0)`

### SPECIAL EFFECTS (use sparingly)

- `TornEdge`: polygon clip-path with jagged edges
- `FoldShadow`: linear gradient simulating paper fold
- `NewsprintGrain`: feTurbulence overlay at 0.02 opacity
Clean white space is the default — effects are accents, not foundations.

### SPRING CONFIGS

- Panel entrance: `{ damping: 22, stiffness: 120, mass: 0.8 }`
- Text reveal: `{ damping: 20, stiffness: 150 }`
- Slide: `{ damping: 24, stiffness: 90, mass: 1 }`

### RENDERING RULES

- Pure inline styles ONLY: `style={{...}}`. No CSS files.
- All graphics via inline SVG. No image imports.
- Every `interpolate()` MUST have `{ extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }`
- Stagger minimum 6 frames between elements
</magazine_theme>
