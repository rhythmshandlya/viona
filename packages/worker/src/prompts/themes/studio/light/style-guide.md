
Style: Studio Light (Polished Motion Graphics — Light Mode)

**DESIGN SYSTEM — DotGrid Theme:**
This style has a template library AND a rich custom animation toolkit. Use templates for data displays and stats. Use custom SVG animation, path drawing, kinetic typography, and morphing for storytelling scenes.

**DESIGN:**
- Diverse visual techniques on dot-grid backgrounds: SVG illustrations, path-drawing animations, kinetic typography, morphing shapes, card-based data displays, and animated diagrams
- Centered content with clean composition — cards for data, open layouts for illustrations
- Clean typography hierarchy using Google Font pairs
- VARIETY across scenes — no two adjacent scenes should use the same visual structure

**COLOR PALETTE (Light Mode):**
- Background: #F8F9FB
- Text: #111827
- Text muted: rgba(0,0,0,0.45)
- Grid: rgba(0,0,0,0.04)
- Card bg: #EDEEF2
- Card border: #D1D5DB
- Accent: Indigo #6366F1 (primary), Pink #EC4899 (secondary)

**BACKGROUND:**
Every scene MUST include a DotGrid SVG background layer:
```tsx
<svg style={{ position: 'absolute', inset: 0 }} width="100%" height="100%">
  <pattern id="dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
    <circle cx="2" cy="2" r="1" fill="rgba(0,0,0,0.04)" />
  </pattern>
  <rect width="100%" height="100%" fill="#F8F9FB" />
  <rect width="100%" height="100%" fill="url(#dots)" />
</svg>
```

**TYPOGRAPHY (FONT_PAIRS):**
Import from shared fonts module. Default: boldImpact (Bebas Neue + Roboto).
Available: modernTech (Montserrat + Inter), friendlyTech (Poppins + Inter), elegantEditorial (Playfair Display + Lato), cleanMinimal (Inter + Inter).

**CARD LAYOUT:**
Scenes use centered card containers with rounded corners (borderRadius: 20px), padding: 48px, maxWidth: 85%. Cards float on the dot-grid background. Card style: background #EDEEF2, border #D1D5DB, boxShadow for depth.

**ANIMATION:**
- Use spring({ damping: 22, stiffness: 100 }) for card entrances
- Stagger elements by 8-12 frames
- Standard timeline: fade-in (0-15 frames), content animate (20-260), hold (280-330), fade-out (330-360)
- Progress bars, counters, charts use smooth interpolate over 100+ frames

**MANDATORY: { extrapolateRight: 'clamp' } on ALL interpolate calls**

**ANIMATION QUALITY (MANDATORY):**
- All text enters via fade + gentle scale (1.05-1.15x max) or slide-up — NEVER slam, crash, or zoom
- Always pair opacity with translateY or scale — never animate opacity alone
- Exits are 75% the duration of entries
- Stagger delays should vary (4, 6, 8 frames) not be uniform
- Spring damping >= 18 always, no exceptions
- No frozen frames — add micro-motion (0.5% scale oscillation) to persistent elements

Use `BACKGROUNDS.light` when adapting template code.
