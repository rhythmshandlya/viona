## OVERLAY MODE — {ew}×{eh} (portrait, TRANSPARENT background, speaker visible behind)

This is a SPECIAL mode: the speaker's face video plays full-screen, and your visual elements
float ON TOP of the speaker. Think: lower-third graphics, corner annotations, floating labels.
The speaker is the STAR — your visuals are supporting annotations only.

**BACKGROUND — ZERO TOLERANCE:**
- DO NOT import or render a `Background` component
- DO NOT set `backgroundColor` on ANY element
- DO NOT use `background:` CSS with solid colors, gradients, or images
- DO NOT use `<Img>` as a background layer
- The root `<AbsoluteFill>` MUST have NO background styles whatsoever
- All elements must float on a fully transparent canvas
- index.tsx conditionally removes Background during overlay frames via `OVERLAY_RANGES`.
  In the editor, real alpha compositing is used. In FFmpeg export, screen blend handles
  the H.264 opaque-to-transparent conversion.
- Prefer BRIGHT colors (white, yellow, cyan) for text — bright elements look best in both
  editor (real alpha) and export (screen blend fallback).

**SPEAKER GRID — FACE-AWARE PLACEMENT:**
Read the `speakerGrid` field from the scene's entry in scenes.json. It is pre-computed and
looks like this:

```json
{
  "speakerGrid": {
    "grid": [
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,0,0],
      "... (24 rows x 24 cols — each cell ≈ 4% of each axis) ..."
    ],
    "occupancy": "18%",
    "safePlacement": ["top-left","bottom-left","top","bottom","left"]
  }
}
```

- `grid`: 24x24 matrix — 1 = speaker present, 0 = safe zone. Each cell covers ~4% of each axis.
- `safePlacement`: array of safe regions — place ALL content within these regions
- `occupancy`: percentage of cells occupied by speaker

**How to use the grid for pixel-precise placement:**
The 24x24 grid maps directly to canvas coordinates. For a 1080x1920 canvas:
- Each cell = 45px wide × 80px tall
- Cell [row][col] covers: x = col × (canvasWidth/24), y = row × (canvasHeight/24)
- To place an element: find a contiguous rectangle of 0-cells large enough, convert to pixel position
- Leave a 1-cell buffer around occupied cells (1 cells) for breathing room

**How to use safePlacement (quick reference):**
- `"left"` → left ~17% of canvas is clear
- `"top-left"` / `"bottom-left"` → that quadrant is clear
- `"top"` → top ~17% strip is clear for banners/titles
- Use the raw grid for precise positioning when safePlacement regions are too coarse

**Fallback:** If `speakerGrid` is missing from scenes.json, call `mcp__assets__get_speaker_grid`
with the scene's startMs and endMs. If that also fails, design centered with generous margins.

**Rules:**
- Place text, icons, charts in safe zones (0 cells) only
- Prefer edges/corners away from the speaker
- If occupancy > 50%, use minimal floating annotations only (small labels, corner icons)
- Use BRIGHT colors (white, yellow, cyan) for best visibility

**OPACITY — DO NOT REDUCE:**
Elements are placed in safe zones AWAY from the speaker. There is no reason to reduce opacity.

- ✅ All elements should reach **opacity 1.0** at rest — fully opaque
- ✅ Fade-in animations (0→1) are fine — but the FINAL resting state must be 1.0
- ❌ NEVER multiply opacity by a fraction (e.g., `animProgress * 0.6`) — this makes content ghostly
- ❌ NEVER cap max opacity below 1.0 on any element
- Use bright colors (white, yellow, cyan) + text shadow for readability

**ANIMATION — SUBTLE BUT POLISHED:**
Overlay scenes use lighter animations than fullscreen — the speaker is still the focal point,
but visuals should feel crafted, not invisible.

- ✅ Simple fade-in (opacity 0→1 over 15-25 frames) — the default for overlay elements
- ✅ Gentle slide from nearest edge (10-20px translateX/Y) with fade
- ✅ Soft pulse/breathe on persistent elements (scale 1.0↔1.02, very slow)
- ✅ Gentle springs allowed: damping ≥ 28, stiffness ≤ 60 (soft, not bouncy)
- ✅ Light stagger: 4-8 frames between elements for a polished cascade
- ✅ Subtle scale entrance from 0.85→1.0 (not from zero — that's too dramatic)
- ❌ NO scale-from-zero entrances — too dramatic for overlay context
- ❌ NO rotating, spinning, or complex transforms
- ❌ NO heavy spring bounce (damping < 28 or stiffness > 60)

Use `interpolate()` with `Easing.out(Easing.ease)` or gentle `spring()` for motion.
Total animation time per element: 15-30 frames. Elements should appear
smoothly, then remain still. Speaker is always the star.

**Overlay uses full canvas dimensions** — EW={ew}, EH={eh} (same as fullscreen).
Use these for positioning, but elements must avoid the speaker's grid cells.

### Overlay Layout Example (speaker in center-top):
```
┌─────────────────────────────┐
│  [speaker face occupies     │  ← Speaker cells — DO NOT place content here
│   center-top area]          │
│                             │
│                             │
├─────────────────────────────┤
│                             │
│  ┌─ Lower-Third Banner ──┐ │  ← Safe zone: bottom area
│  │  "Follow for More"    │ │     Use: floating label, CTA button, stat card
│  └───────────────────────┘ │
│                             │
│  [subtitle area]            │  ← Bottom 15% reserved for subtitles
└─────────────────────────────┘
```

### What works in overlay:
- Lower-third banners with text (bottom 30% of canvas)
- Corner labels: "11 Agents" in bottom-left, "Follow" button in bottom-right
- Small floating stat cards (width: EW * 0.3) pinned to safe corners
- Subtle animated underlines or highlights on text

### What does NOT work in overlay:
- Full-screen diagrams, charts, or complex layouts (they cover the speaker)
- Large centered text that overlaps the face
- Particle effects or background animations (transparent canvas!)
- Any element wider than EW * 0.4 positioned over the speaker area
