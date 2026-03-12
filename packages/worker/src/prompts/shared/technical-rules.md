# Technical Rules — Remotion Animation

<spring_configs>
## Spring Configurations

| Name | damping | stiffness | mass | Use For |
|------|---------|-----------|------|---------|
| SMOOTH | 26 | 120 | 1.0 | Default — titles, cards, premium settle |
| SNAPPY | 18 | 180 | 0.8 | Hero reveals, stat pops, impact moments |
| BOUNCY | 12 | 200 | 1.0 | Playful icons, energetic accents |
| HEAVY | 20 | 150 | 1.5 | Text slams, big number reveals |
| STIFF | 24 | 300 | 0.6 | Micro-interactions, fast snaps |
| GENTLE | 20 | 80 | 1.2 | Background elements, ambient float |

**Rule:** Never use damping < 18. Match spring to intent — SMOOTH for reveals, SNAPPY for impact, HEAVY for weight.
</spring_configs>

<easing_guide>
## Easing Guide — Vary Your Motion

Import: `import { Easing } from 'remotion';`

| Intent | Easing | Why |
|--------|--------|-----|
| Element enters | `Easing.out(Easing.exp)` | Fast start, smooth deceleration |
| Element exits | `Easing.in(Easing.exp)` | Slow start, fast departure |
| Continuous motion (fill, draw) | `Easing.inOut(Easing.cubic)` | Smooth S-curve |
| Dramatic reveal | `Easing.out(Easing.exp)` | Builds suspense |
| Overshoot settle | `spring()` | Physical bounce |
| Counting/numbers | `Easing.out(Easing.exp)` | Fast count, slow approach to final |
| Looping/ambient | `Easing.inOut(Easing.sin)` | Smooth cycle, no hard edges |

### Entrance Easing Hierarchy (by element importance)
1. `spring()` — Hero elements (natural overshoot + settle)
2. `Easing.out(Easing.exp)` — Supporting elements (fast snap-in)
3. `Easing.out(Easing.cubic)` — Tertiary elements (gentle arrival)

**Rules:**
- NEVER use `spring()` for everything — vary with Easing
- NEVER use linear easing for entrances — looks mechanical
- ALWAYS pair opacity + transform — opacity-only fades look cheap
- Exit duration = 75% of entrance duration
</easing_guide>

<interpolate_rules>
## Interpolate Rules (CRITICAL)

### Rule 1: Clamp Both Sides
**EVERY `interpolate()` call MUST include BOTH clamp options:**
```tsx
interpolate(frame, [0, 30], [0, 1], {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
})
```

Without BOTH clamps, values extrapolate linearly beyond the range — causing scale: 13x, opacity: 85, or other catastrophic visual bugs. No exceptions.

### Rule 2: inputRange MUST Be Strictly Monotonically Increasing (FATAL)
The `inputRange` array values MUST be sorted in strictly ascending order. Every value must be greater than the previous one.

```tsx
// ❌ FATAL — CRASHES AT RUNTIME:
interpolate(frame, [0, 1, 0.4], [0, 1, 0])  // 0.4 < 1 — NOT monotonic!
interpolate(frame, [0, 30, 30], [0, 1, 0])   // 30 == 30 — NOT strictly increasing!

// ✅ CORRECT — strictly ascending:
interpolate(frame, [0, 15, 30], [0, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
```

Common mistake: using normalized [0, 1] as inputRange then adding a third value. If you need a 3-point interpolation, use actual frame numbers: `[0, halfway, total]`.
</interpolate_rules>

<frame_timing>
## Frame Timing in Sequences (FATAL BUG PREVENTION)

Inside `<Sequence from={X}>`, `useCurrentFrame()` ALREADY returns frames relative to the Sequence start (starting at 0).

```tsx
// ❌ WRONG — CAUSES BLANK SCENES:
const localFrame = frame - TIMING.scene2Start; // frame is already 0-relative!

// ✅ CORRECT — frame IS the local frame:
const frame = useCurrentFrame(); // 0, 1, 2, ... inside Sequence
const keySyncProgress = spring({ frame: frame - TIMING.scene2KeySync, fps, config: SPRING_CONFIG });
```

All TIMING sync values are PRE-COMPUTED as local offsets in constants.ts.
</frame_timing>

<key_sync>
## Key Sync Pattern (Audio-Visual Alignment)

The keySync frame is when the narrator says the KEY WORD. Your main visual event MUST trigger at that exact frame.

```tsx
// Setup: elements visible BEFORE the key word (anticipation)
const setupProgress = interpolate(frame, [0, TIMING.sceneNKeySync], [0, 1], {
  extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
});

// Payoff: elements appearing AT the key word (reveal)
const payoffProgress = spring({
  frame: frame - TIMING.sceneNKeySync,
  fps, config: SPRINGS.SNAPPY,
});
```

If you get keySync right, the video feels professional. If you ignore it, the video feels random.
</key_sync>

<responsive_sizing>
## Responsive Sizing

ALL sizes relative to EW/EH (effective viewport from scenes.json) — NEVER hardcoded pixels.

| Element | Size |
|---------|------|
| Title text | `fontSize: EH * 0.06` to `EH * 0.10` |
| Body text | `fontSize: EH * 0.03` to `EH * 0.04` |
| Cards | `width: EW * 0.7` to `EW * 0.85` |
| Icons | `width: EW * 0.06` to `EW * 0.08` |
| Safe margin | `EW * 0.08` from edges |
| Bottom reserve | Bottom 15% of EH reserved for subtitles |

Use `EW`/`EH` from TIMING constants, NOT `width`/`height` from `useVideoConfig()`.
</responsive_sizing>
