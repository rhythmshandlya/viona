## OVERLAY MODE — {ew}×{eh} (portrait, TRANSPARENT background, speaker visible behind)

This is a SPECIAL mode: the speaker's face video plays full-screen, and your visual elements
float ON TOP of the speaker. Think: lower-third graphics, top banners, centered callouts.
The speaker is the STAR — your visuals are supporting annotations only.

**BACKGROUND — ZERO TOLERANCE:**
- DO NOT import or render a `Background` component
- DO NOT set `backgroundColor` on ANY element
- DO NOT use `background:` CSS with solid colors, gradients, or images
- DO NOT use `<Img>` as a background layer
- The root `<AbsoluteFill>` MUST have NO background styles whatsoever
- All elements must float on a fully transparent canvas
- index.tsx has NO global background. Each non-overlay scene renders its own Background
  component. Overlay scenes render on a transparent canvas. The editor uses screen blend
  mode to composite overlays on top of the speaker video.
- Prefer BRIGHT colors (white, yellow, cyan) for text — bright elements look best in both
  editor (real alpha) and export (screen blend fallback).

**LAYOUT — CENTERED, CLEAN, PROFESSIONAL:**

⚠️ **GOLDEN RULE: ALL overlay content MUST be horizontally centered and placed in designated
zones (top strip or lower-third). NEVER scatter small elements at random positions.**

The overlay layout uses TWO placement zones, both horizontally centered:

```
┌─────────────────────────────┐
│  ┌── TOP STRIP (0-15%) ──┐ │  ← Titles, topic labels, short banners
│  │     "NICHE DOWN"       │ │     Centered, full-width container
│  └────────────────────────┘ │
│                             │
│     [speaker occupies       │  ← NEVER place content here (15%-60%)
│      center area]           │     This is the speaker's space
│                             │
│                             │
├─────────────────────────────┤
│  ┌── LOWER-THIRD (60-85%)─┐│  ← Main content zone: stats, callouts,
│  │  Key message, stats,   ││     badges, lists. Centered, full-width.
│  │  badges, lists          ││     Elements stack vertically with gap.
│  └────────────────────────┘ │
│  [subtitle area 85-100%]    │  ← Reserved for captions — do NOT use
└─────────────────────────────┘
```

**Placement rules:**
1. **Default: lower-third zone (60%-85% from top)** — this is where MOST overlay content goes.
   Use a centered flex container:
   ```tsx
   <div style={{
     position: 'absolute', left: 0, right: 0, bottom: EH * 0.15,
     display: 'flex', flexDirection: 'column', alignItems: 'center',
     padding: `0 ${EW * 0.08}px`,
     gap: EH * 0.02,
   }}>
     {/* Stack elements here — they will be centered */}
   </div>
   ```
2. **Top strip (0%-15%)** — for short titles, topic labels, or scene headers only.
   ```tsx
   <div style={{
     position: 'absolute', left: 0, right: 0, top: EH * 0.03,
     display: 'flex', justifyContent: 'center',
   }}>
     {/* Centered title */}
   </div>
   ```
3. **NEVER use absolute left/top pixel positioning** to place elements at random spots.
   ALL elements must be inside a centered container in one of the two zones above.
4. **Left/right placement is ONLY allowed** when the speaker is clearly on one side of the
   screen (occupancy concentrated in left or right 40%) AND there is enough clear space on
   the opposite side for a substantial element (width ≥ EW * 0.4). Even then, the element
   must be vertically centered and properly sized — not a tiny floating widget.

**Minimum sizing:**
- Text: fontSize ≥ EH * 0.025 (48px on 1920 canvas) — NEVER smaller
- Containers/cards: width ≥ EW * 0.6 (648px) — span most of the screen width
- Icons: ≥ 48px — never tiny scattered icons
- ❌ NEVER place multiple small elements at scattered absolute positions
- ❌ NEVER make elements narrower than 60% of canvas width (except icons within a container)

**SPEAKER GRID — USE FOR AVOIDANCE ONLY:**
The `speakerGrid` in scenes.json tells you WHERE THE SPEAKER IS so you can AVOID that area.
Do NOT use it to scatter elements into random "safe zone" corners. Instead:
- Check which rows the speaker occupies to know which vertical zone is safe
- Place your centered containers ABOVE or BELOW the speaker rows
- The lower-third zone (60-85%) is almost always safe

**OPACITY — DO NOT REDUCE:**
- ✅ All elements should reach **opacity 1.0** at rest — fully opaque
- ✅ Fade-in animations (0→1) are fine — but the FINAL resting state must be 1.0
- ❌ NEVER multiply opacity by a fraction (e.g., `animProgress * 0.6`) — this makes content ghostly
- ❌ NEVER cap max opacity below 1.0 on any element
- Use bright colors (white, yellow, cyan) + text shadow for readability

**ANIMATION — POLISHED & PROFESSIONAL:**
Overlay elements should feel like broadcast-quality motion graphics — crafted, intentional, and dynamic.
The speaker is still the star, but your overlays should look like they belong on a TV news segment.

**Default entrance pattern (USE THIS for every element):**
Combine opacity + translateY + scale for a professional "land into place" feel:
```tsx
const enter = spring({ frame: frame - enterFrame, fps, config: { damping: 22, stiffness: 100, mass: 1.0 } });
const style = {
  opacity: interpolate(enter, [0, 1], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
  transform: `translateY(${interpolate(enter, [0, 1], [8, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}px) scale(${interpolate(enter, [0, 1], [0.96, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })})`,
};
```

**Exit pattern (30% faster than entrance):**
```tsx
const exitProgress = interpolate(frame, [exitFrame, exitFrame + 7], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
const exitStyle = {
  opacity: interpolate(exitProgress, [0, 1], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
  transform: `translateY(${interpolate(exitProgress, [0, 1], [0, -6], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}px)`,
};
```

**Spring configs — two tiers:**

| Context | Config | When to use |
|---------|--------|-------------|
| Default overlay | `{ damping: 22, stiffness: 100, mass: 1.0 }` | Normal elements entering |
| Hero/emphasis (at keySync) | `{ damping: 15, stiffness: 170, mass: 0.8 }` | Key stat reveal, verdict stamp, main message |

- ✅ Stagger child elements by 2-3 frames (50-100ms) for polished cascade
- ✅ Total entrance: 10-12 frames (330-400ms). Total exit: 7-8 frames (230-270ms)
- ✅ Hold time: minimum 90 frames (3 seconds) before exit
- ✅ Subtle scale entrance from 0.96→1.0 (NOT from zero or 0.85 — too dramatic)
- ✅ Glow/shadow on containers should intensify at sync points (boxShadow driven by interpolate)
- ❌ NEVER use opacity-only fade-in — always combine with translateY and/or scale
- ❌ NO scale-from-zero entrances
- ❌ NO rotating, spinning, or complex transforms
- ❌ NO linear easing — always use spring() or Easing.out()

**HUD TECHNIQUES — MAKING OVERLAYS POP:**
Use these broadcast-quality techniques to elevate overlays beyond basic text cards:

**1. Scan Line Texture (on containers):**
Add subtle horizontal lines to glass panels for a tech/broadcast feel:
```tsx
background: `
  repeating-linear-gradient(
    0deg,
    rgba(255,255,255,0.03) 0px,
    rgba(255,255,255,0.03) 1px,
    transparent 1px,
    transparent 4px
  ),
  rgba(0, 0, 0, 0.45)
`,
```

**2. Glow Pulse at Sync Points:**
Drive boxShadow intensity from a sync-point-triggered interpolation:
```tsx
const glowIntensity = interpolate(frame, [syncFrame, syncFrame + 15, syncFrame + 40], [0, 1, 0.3], {
  extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
});
const style = {
  boxShadow: `0 0 ${12 + glowIntensity * 20}px rgba(accent, ${0.1 + glowIntensity * 0.3})`,
};
```

**3. Animated Border Draw-In:**
A border that appears to "draw" itself using clip-path:
```tsx
const drawProgress = interpolate(frame, [enterFrame, enterFrame + 20], [0, 1], {
  extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
});
// Use a thin accent-colored border that reveals via opacity sections
const borderOpacity = drawProgress;
```

**4. Counter / Ticker Animation:**
Numbers that tick up to their final value at the sync point:
```tsx
const displayValue = Math.round(interpolate(frame, [enterFrame, syncFrame], [0, targetValue], {
  extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
}));
```

**5. Progress Bar Fill:**
A bar that fills to a percentage at the sync point:
```tsx
const fillWidth = interpolate(frame, [enterFrame, syncFrame], [0, targetPercent], {
  extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  easing: Easing.out(Easing.cubic),
});
```

**6. Frosted Glass Recipe (when using glass panels):**
```tsx
const glassStyle = {
  background: 'rgba(15, 15, 15, 0.35)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  borderRadius: EW * 0.015,
  boxShadow: '0 4px 24px rgba(0, 0, 0, 0.15)',
};
```
Always include the 1px border — without it, glass panels look blobby. Blur must be ≥ 8px.

Use these techniques to give overlay elements a "broadcast HUD" feel — data-driven, polished, professional.

**ADVANCED TECHNIQUES (opt-in, use when the plan calls for stylized motion):**

**Quantized Frame Rate (stop-motion feel):**
Make graphic elements move at 15fps while the speaker stays smooth at 30fps.
Creates a hand-crafted, mixed-media aesthetic:
```tsx
// Quantize to 15fps — graphics update every 2nd frame
const qFrame = Math.floor(frame / 2) * 2;
// Use qFrame instead of frame for all interpolations in this element
const enter = spring({ frame: qFrame - enterFrame, fps, config: SPRING_CONFIG });
```
Use sparingly — best for accent elements, badges, or stylized stat cards. Don't apply to text (hurts readability).

**Variable Font Weight Animation:**
Animate font weight on variable fonts for emphasis at sync words:
```tsx
const weightShift = interpolate(frame, [syncFrame - 5, syncFrame, syncFrame + 10], [400, 800, 400], {
  extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
});
const style = {
  fontVariationSettings: `"wght" ${weightShift}`,
  fontFamily: '"Inter Variable", "Inter", sans-serif',
};
```
Only works with variable fonts (Inter, Roboto Flex, etc.). Adds punch to key words without adding new elements.

**Overlay uses full canvas dimensions** — EW={ew}, EH={eh} (same as fullscreen).

### What works in overlay:
- Full-width lower-third banners centered at bottom (60-85% from top)
- Centered stat cards, key messages, badges stacked vertically in lower-third
- Top-strip titles/labels centered horizontally
- Centered callout text with backdrop blur for readability

### What does NOT work in overlay:
- Tiny elements scattered at random absolute positions (looks broken and unprofessional)
- Elements placed at left-center or right-center of screen for no reason
- Small icons or labels floating in isolation without a container
- Any element narrower than 60% of canvas width placed off-center
- Text that repeats the narrator's spoken words (captions already show them — overlay must add VALUE with stats, icons, data, not duplicate words)
- Full-screen diagrams, charts, or complex layouts (they cover the speaker)
- Particle effects or background animations (transparent canvas!)
