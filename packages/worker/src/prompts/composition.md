# Composition Patterns — Display Modes

<display_mode_overview>
## Display Mode Overview

Three modes control how visuals composite with the speaker video:

| Mode | What Happens | When to Use | Frequency |
|------|-------------|-------------|-----------|
| `"stacked"` | Video + visuals split vertically | Standard explanation, diagrams, animations | 60-70% of beats |
| `"fullscreen"` | Visuals fill entire canvas, speaker hidden | Big reveals, complex diagrams, title cards | 1-3 key moments |
| `"overlay"` | Speaker fills canvas, visuals float on top | Speaker-focused moments, emotional beats | Accent/complement |

Each beat in scenes.json specifies its display mode. Consecutive beats with the same layout go in one segment.

**PLANNING GUIDELINES:**
- Use `"stacked"` for most scenes (60-70%) — the bread and butter
- Use `"fullscreen"` for 1-3 key moments — big reveals, complex visuals that need full attention
- Use `"overlay"` for speaker-focused moments — personal stories, emotional beats, or transitions. These scenes still need a visual description but it can be minimal (e.g., "subtle accent shapes"). The Animator will generate lightweight visuals for these.
- NEVER use the same displayMode for ALL scenes — variety creates visual rhythm
- NOTE: Legacy value `"pip"` is treated as `"default"` / `"stacked"` — always use `"stacked"` for new plans
- Transition between modes at natural narrative beats (topic changes, revelations, conclusions)
- VISUAL DENSITY RULE: Every scene's visual description must specify what the viewer sees IMMEDIATELY (frame 0) — not just the payoff at the key sync point.

Each scene can also specify a `transition` for smooth mode changes:
- `"cut"` (instant, 0ms) — default, clean and fast
- `"fade"` (300-500ms) — smooth opacity transition, good for mood changes
- `"zoom-in"` (200-400ms) — draws attention inward, good for reveals
- `"zoom-out"` (200-400ms) — pulls back, good for context shifts

INFORMATION DENSITY BREATHING:
After a complex scene, follow with a simpler beat (stat reveal, metaphor, pause-and-reflect). Alternate dense and sparse beats throughout.
</display_mode_overview>

<overlay_rules>
## OVERLAY MODE — {ew}×{eh} (portrait, TRANSPARENT background, speaker visible behind)

**You are designing graphics that render ON TOP OF a talking head video with a real person speaking to camera.** The speaker is the star — your visuals are compact, punchy keyword annotations that reinforce what the speaker says. Think: broadcast lower-thirds, not dashboards.

**BACKGROUND — ZERO TOLERANCE:**
- DO NOT import or render a `Background` component
- DO NOT set `backgroundColor` on ANY element
- DO NOT use `background:` CSS with solid colors, gradients, or images
- The root `<AbsoluteFill>` MUST have NO background styles whatsoever
- All elements float on a fully transparent canvas
- Prefer BRIGHT colors (white, yellow, cyan) for text visibility over video

**SPEAKER GRID — FACE-AWARE PLACEMENT:**
Read the `speakerGrid` field from the scene's entry in scenes.json:

```json
{
  "speakerGrid": {
    "grid": [
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,0,0],
      "... (24 rows x 24 cols — each cell ≈ 4% of each axis) ..."
    ],
    "occupancy": "18%",
    "safePlacement": ["top-left","bottom-left","top","bottom","left"]
  }
}
```

- `grid`: 24x24 matrix — 1 = speaker present, 0 = safe zone
- `safePlacement`: array of safe regions for content placement
- `occupancy`: percentage of cells occupied by speaker

**Grid-to-pixel mapping** (1080×1920 canvas): each cell = 45px wide × 80px tall.

**SPEAKER-POSITION-AWARE LAYOUT (CRITICAL):**

Determine speaker position from `safePlacement` and adapt your layout:

```
SPEAKER CENTERED → center overlays in lower-third:
  <div style={{ position: 'absolute', left: 0, right: 0, bottom: EH * 0.15,
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: `0 ${EW * 0.2}px` }}>

SPEAKER LEFT → float overlays to the RIGHT:
  <div style={{ position: 'absolute', right: EW * 0.05, bottom: EH * 0.15,
    display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
    maxWidth: EW * 0.5 }}>

SPEAKER RIGHT → float overlays to the LEFT:
  <div style={{ position: 'absolute', left: EW * 0.05, bottom: EH * 0.15,
    display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
    maxWidth: EW * 0.5 }}>
```

**NEVER design on the face.** The speaker's face is the viewer's primary attention anchor. All content must avoid the face area completely.

**TWO ZONES ONLY:**
```
TOP STRIP (0-15% Y):    Short labels (1-2 words max)
[SPEAKER FACE 15-58%:   OFF-LIMITS — never place content here]
LOWER-THIRD (58-85%):   Primary content zone
[SUBTITLE AREA 85-100%: Reserved for captions]
```

**ELEMENT DESIGN — COMPACT AND PUNCHY:**
- **Max 2 elements visible** at any moment. Prefer 1.
- **1-3 words per element.** The speaker provides context verbally. You show the KEY WORD only. "EFFICIENCY" not "MORE EFFICIENCY IN YOUR STROKE TECHNIQUE".
- **Typography IS the visual.** Large bold text with textShadow is your primary tool:
  ```tsx
  textShadow: '0 2px 12px rgba(0,0,0,0.8), 0 0 4px rgba(0,0,0,0.5)',
  ```
- **Icons are small accents** — max 1 per overlay moment, never the focus.
- **Compact footprint.** Container max-width: EW * 0.55. Floating text max-width: EW * 0.45.
- **One element per sync point.** Minimum 15 frames between element entrances.

**OPACITY — FULL AT REST:**
- All elements reach opacity 1.0 at rest — fully opaque
- Fade-in animations (0→1) are fine, but resting state must be 1.0
- NEVER multiply opacity by a fraction

**ANIMATION — ENTRANCE + LIVING IDLE:**
Overlay animations are lighter than fullscreen, but elements must feel alive:

- ✅ **Entrance** (15-25 frames): fade-in + gentle slide from edge (10-20px) with gentle spring (damping ≥ 28, stiffness ≤ 60)
- ✅ **Idle breathing** (after settling): `scale(${1 + Math.sin(frame * 0.05) * 0.015})` or `translateY(${Math.sin(frame * 0.04) * 2.5}px)` — elements are NEVER frozen
- ✅ **Exit** (10-15 frames): fade-out with slight scale-down to 0.95
- ✅ Subtle scale entrance from 0.85→1.0

- ❌ NO scale-from-zero entrances
- ❌ NO rotating, spinning, or complex transforms
- ❌ NO heavy spring bounce (damping < 28 or stiffness > 60)
- ❌ NO dashboard layouts (feature rows, split panels, icon grids, multi-row lists)
- ❌ NO cards wider than 55% of EW
- ❌ NO sentences or phrases longer than 3 words
- ❌ NO content in the 15-58% Y speaker face zone
- ❌ NO particle effects or scatter animations (compete with speaker)

**Overlay uses full canvas dimensions** — EW={ew}, EH={eh}.

### Overlay Layout Examples:

```
Speaker centered:
┌─────────────────────────────┐
│    [short label - centered] │  ← Top strip (0-15%)
│                             │
│      [SPEAKER - center]     │  ← Face zone (15-58%) — OFF LIMITS
│                             │
│     ┌── KEYWORD ──┐        │  ← Lower-third (58-85%)
│     │  (bold text) │        │
│     └─────────────┘        │
│     [subtitles]             │
└─────────────────────────────┘

Speaker on left:
┌─────────────────────────────┐
│                             │
│ [SPEAKER]     ┌─ KEYWORD ─┐│
│ [on left]     │ (right)    ││
│               └────────────┘│
│                             │
└─────────────────────────────┘

Speaker on right:
┌─────────────────────────────┐
│                             │
│┌─ KEYWORD ─┐     [SPEAKER] │
││ (left)     │     [on right]│
│└────────────┘               │
│                             │
└─────────────────────────────┘
```

For every overlay segment:
- `layout.primary.y` MUST be in lower-third (58-85%) or top strip (0-15%)
- `layout.secondary.y` MUST also be in a safe zone — NEVER in 15-58%
- `layout.alignment` MUST reflect speaker position (center/left/right)
- Max 2 elements visible at any moment. Prefer 1.
- SELF-CHECK: Before writing scenes.json, verify no overlay element has y in [15%, 58%]
</overlay_rules>

<stacked_compact_rules>
## STACKED MODE — {ew}×{eh} (nearly square)

This scene renders in the TOP HALF of a split layout. Speaker video appears in the bottom half.
The aspect ratio is nearly SQUARE — very different from fullscreen portrait.
Design COMPACT, HORIZONTAL layouts.

### Dimensions & Layout:
- effectiveDimensions = {ew} wide × {eh} tall (half the canvas height)
- EW = {ew}, EH = {eh} — use EW/EH for all sizing
- VERTICAL space is SCARCE — you only have {eh}px of height!
- Use horizontal layouts: title on left, content on right, or title above with wide content below

### Design for Near-Square Ratio:
```
┌──────────────────────────────────────────────┐
│  TITLE TEXT (EH * 0.06 font)                 │  ← Top 25%: Compact title
├──────────────────────────────────────────────┤
│                                              │
│  WIDE PRIMARY VISUAL (card/chart, EW * 0.85) │  ← Middle 50%: One wide element
│                                              │
├──────────────────────────────────────────────┤
│  Supporting text                  [reserved] │  ← Bottom 25%: Support + subtitle zone
└──────────────────────────────────────────────┘
```

### Rules:
- MUST use a clipping container: `<div style={{ position: 'absolute', top: 0, left: 0, width: EW, height: EH, overflow: 'hidden' }}>`
- ALL sizing relative to EW/EH (e.g., `fontSize: EH * 0.05`, NOT hardcoded px)
- Center X = EW / 2 (NOT canvas width / 2)
- Safe margins: EW * 0.08 from edges
- MAX 3 attention-grabbing elements + ambient — compact space means FEWER elements, not smaller ones
- Title font: EH * 0.05 to EH * 0.07 (NOT the large EH * 0.10 used in fullscreen)
- Cards should be WIDE (EW * 0.85) and SHORT (EH * 0.3 max), not tall
- Background: simple solid color from COLORS.background or subtle gradient
- Subtle ambient OK (max 3 particles, opacity ≤ 0.12) — no heavy effects that clutter the small area
- Think "wide info card" or "dashboard widget" — not "full mobile screen"
</stacked_compact_rules>

<stacked_portrait_rules>
## STACKED MODE — {ew}×{eh} (portrait)

This scene renders FULLSCREEN. A small speaker video bubble (PiP) floats on top.
You have the FULL portrait canvas — design like fullscreen mode but leave the bottom-right
corner area (~15% of canvas) relatively uncluttered for the PiP bubble.

### Dimensions & Layout:
- effectiveDimensions = {ew} wide × {eh} tall (FULL canvas)
- EW = {ew}, EH = {eh} — use EW/EH for all sizing
- Design for TALL portrait format — stack content vertically
- The PiP speaker bubble sits in bottom-right — keep that corner less busy

### Design for Portrait Ratio:
```
┌──────────────────────────────────────────────┐
│                                              │
│  TITLE / HEADER (EH * 0.04 font)            │  ← Top 15%
│                                              │
├──────────────────────────────────────────────┤
│                                              │
│  PRIMARY CONTENT AREA                        │  ← Middle 55%
│  (diagrams, cards, data)                     │
│                                              │
├──────────────────────────────────────────────┤
│                                              │
│  SUPPORTING ELEMENTS            [PiP zone]   │  ← Bottom 30%
│                                              │
└──────────────────────────────────────────────┘
```

### Rules:
- MUST use a clipping container: `<div style={{ position: 'absolute', top: 0, left: 0, width: EW, height: EH, overflow: 'hidden' }}>`
- ALL sizing relative to EW/EH (e.g., `fontSize: EH * 0.04`, NOT hardcoded px)
- Center X = EW / 2
- Safe margins: EW * 0.08 from edges
- Full vertical space available — use it! Spread content vertically
- Background: gradient or immersive background with depth (you have the whole canvas)
- Ambient effects OK (particles, floating shapes, glows) — you have room
- Bottom-right ~15% area: avoid placing critical text/data (PiP bubble overlaps here)
- Bottom 8% reserved for subtitles — keep text above that line
</stacked_portrait_rules>

<fullscreen_rules>
## FULLSCREEN MODE — {ew}×{eh} (9:16 tall portrait)

This scene uses the FULL canvas. The aspect ratio is TALL — like a phone screen in portrait mode.
Design for VERTICAL stacking, not horizontal layouts.

### Dimensions & Layout:
- effectiveDimensions = full canvas ({ew} wide × {eh} tall)
- EW = {ew}, EH = {eh} — use EW/EH for all sizing
- VERTICAL space is abundant — stack title → content → supporting text top-to-bottom
- HORIZONTAL space is limited ({ew}px) — elements should be near-full-width (EW * 0.8)

### Design for 9:16 Portrait:
```
┌──────────────────┐
│                  │
│   TITLE TEXT     │  ← Top 20%: Large animated title (EH * 0.08 font)
│                  │
├──────────────────┤
│                  │
│  PRIMARY VISUAL  │  ← Middle 40%: One big card, diagram, or counter
│  (card/counter)  │
│                  │
├──────────────────┤
│                  │
│  SUPPORTING      │  ← Bottom 25%: Secondary text or detail
│                  │
│  [subtitles]     │  ← Bottom 15%: RESERVED for subtitles
└──────────────────┘
```

### Rules:
- Include an animated background (gradient shift or dot grid with 80px+ spacing and r=3+ dots — NOT heavy particles or tiny invisible dots)
- Title Fill pattern: titles START large (EH * 0.10) and centered, settle smaller when content appears
- Primary visual MUST be text/data, not decorative effects
- MAX 4 attention-grabbing elements + ambient — fullscreen means BIGGER elements, not MORE elements
- ALL sizes relative to EW/EH — never hardcoded pixels (no `width: 360`, `fontSize: '24px'`)
- Spring entrances, stagger for secondary elements, animated text for key phrases
</fullscreen_rules>

<per_scene_viewport>
## PER-SCENE VIEWPORT (CRITICAL)

Each scene has `effectiveDimensions` in scenes.json: { width, height }.

### Workflow
1. Call `mcp__viewport__get_scene_dimensions` before writing scene code
2. Load `effective-dimensions` skill for sizing patterns
3. Call `mcp__viewport__validate_scene_code` after writing each scene

### Pattern for EVERY scene:
```tsx
const { width: W, height: H } = useVideoConfig(); // full canvas
const EW = TIMING.scene1EffectiveWidth;   // from effectiveDimensions
const EH = TIMING.scene1EffectiveHeight;

<div style={{ position: 'absolute', top: 0, left: 0, width: EW, height: EH, overflow: 'hidden' }}>
  {/* ALL elements within (0,0) to (EW, EH) */}
  {/* Font sizes: EH * 0.04. Center X: EW / 2. Safe margin: EW * 0.1 */}
</div>
```

- effectiveDimensions == full canvas -> fullscreen/overlay
- effectiveDimensions < full canvas -> pip in split layout
- NEVER position content outside effective area
- Overlay mode: full canvas dims but NO background rendering

### Fullscreen Centering
For fullscreen scenes, compute centered startY:
```tsx
const usableHeight = EH * 0.85; // bottom 15% is subtitle zone
const contentHeight = totalGridHeight; // sum of rows + gaps
const startY = (usableHeight - contentHeight) / 2;
```
Do NOT use arbitrary EH * 0.15 or EH * 0.20 — always compute from content height.
</per_scene_viewport>
