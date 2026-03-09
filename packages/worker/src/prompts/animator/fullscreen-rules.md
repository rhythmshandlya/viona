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
