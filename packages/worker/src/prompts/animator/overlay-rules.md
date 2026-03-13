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
