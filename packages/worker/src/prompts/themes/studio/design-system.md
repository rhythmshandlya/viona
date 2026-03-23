<studio_templates>
## STUDIO THEME — TEMPLATE LIBRARY (shadcn model)

Templates are **source code you own**. Like shadcn/ui, you copy the source into your
scene file and customize freely — they are NOT imported as black-box packages.

### Template Location
Each template lives in `src/.templates/{slug}/` with:
- `index.tsx` — Main component
- `schema.ts` — Zod props schema (self-defaults via `schema.parse({})`)
- `constants.ts` — BACKGROUNDS object + `getConstants()` for colors/fonts
- `components/` — Reusable sub-components (CardShell, TrendBadge, etc.)

### MANDATORY: Theme Immersion Before Implementation

**Before writing ANY scene code, you MUST complete this step:**

1. Read at least 3 different templates from `src/.templates/` (e.g., `stat-counter`, `quote-pulse`, `versus-screen`)
2. Study how they use: DotGrid backgrounds, solid card containers, `useScale()`, `FONT_PAIRS`, spring configs, accent color transparency
3. Write `constants.ts` using the STUDIO THEME COLORS below — NOT the Director's `colorPalette` field

The Director's `colorPalette` in scenes.json is a **topic hint only**. Your constants.ts MUST use these exact studio theme values:
```tsx
export const THEME = {{
  background: '{background}',
  text: '{text}',
  textMuted: '{textMuted}',
  gridColor: '{gridColor}',
  cardBg: '{cardBg}',
  cardBorder: '{cardBorder}',
  accent: '{accentDefault}',
  secondary: '{secondaryDefault}',
}};
```

If you skip this step, your scenes will look generic and off-brand. Templates show you **what good looks like** — the DotGrid, the solid cards, the spring entrances, the font system, the accent glow conventions. Internalize these patterns before you write a single line.

### Workflow
1. **Read 3+ templates** to absorb the studio design language (MANDATORY — see above)
2. Check `suggestedTemplates` in `scenes.json` for each scene
3. Read suggested template source — `src/.templates/{slug}/index.tsx` (and `components/`)
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
import {{ useScale }} from '../../use-scale';
const s = useScale();
// Use s() for ALL numeric values:
fontSize: s(48),  padding: s(56),  borderRadius: s(32),  gap: s(20)
```

**You MUST use `s()` for every pixel value in your scene code.** Raw pixel numbers
will break on non-1080 canvases.

### FONT SYSTEM

Import from shared fonts module — do NOT use raw font-family strings:
```tsx
import {{ FONT_PAIRS }} from '../../fonts';
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
<div style={{{ position: 'absolute', inset: 0, background: '{background}' }}} />
<DotGrid color="{gridColor}" s={{s}} />

const DotGrid: React.FC<{{ color: string; s: (px: number) => number }}> = ({{ color, s }}) => (
  <svg width="100%" height="100%" style={{{ position: 'absolute', inset: 0, pointerEvents: 'none' }}}>
    <defs>
      <pattern id="dot-grid" width={{s(80)}} height={{s(80)}} patternUnits="userSpaceOnUse">
        <circle cx={{s(40)}} cy={{s(40)}} r={{s(3)}} fill={{color}} />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#dot-grid)" />
  </svg>
);
```

**A scene without the studio background (`{background}` + DotGrid) is BROKEN.** Do not skip this.

### CARD CONTAINERS

Card (default):
```tsx
{{
  background: '{cardBg}',
  border: '1px solid {cardBorder}',
  borderRadius: s(32),
  padding: `${{s(56)}}px ${{s(64)}}px`,
  maxWidth: s(900),
  boxShadow: `0 ${{s(8)}}px ${{s(32)}}px rgba(0, 0, 0, 0.3)`,
}}
```
Variants: gradient (`linear-gradient(135deg, ${{accentColor}}18 0%, {cardBg} 100%)`), outline ({cardBg} bg + accent border).

### ACCENT COLOR TRANSPARENCY CONVENTION

When using accent colors for glows, tints, and overlays, append hex alpha:
- `${{accentColor}}18` — 9% opacity (subtle tint, gradient bg)
- `${{accentColor}}30` — 19% (medium tint)
- `${{accentColor}}44` — 27% (radial glow)
- `${{accentColor}}66` — 40% (text shadow glow)
- `${{accentColor}}88` — 53% (strong glow)

### SPRING CONFIGS (from templates)

- Card entrance: `{{ damping: 20, stiffness: 120, mass: 0.8 }}` — smooth settle
- Hero text reveal: `{{ damping: 20, stiffness: 170 }}` — snappy
- Gentle slide: `{{ damping: 20, stiffness: 90, mass: 1 }}` — standard
- **NEVER** damping < 18 (too bouncy) or > 26 (overdamped)

### RENDERING RULES

- Pure inline styles ONLY: `style={{{...}}}`. No CSS files, no CSS-in-JS.
- All graphics via inline SVG (charts, icons, shapes). No image imports.
- Every `interpolate()` MUST have `{{ extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }}`
- Never use `Math.sin/cos` on text positions (causes jitter)
- Card backgrounds use theme colors from COLORS.cardBg
- Stagger minimum 6 frames between elements
</studio_templates>
