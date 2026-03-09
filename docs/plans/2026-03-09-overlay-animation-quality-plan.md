# Overlay Animation Quality Improvements — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade overlay animation prompts from amateur fade-ins to professional broadcast-quality motion graphics using research-backed techniques.

**Architecture:** Prompt-only changes to two markdown files — Director system prompt (pacing rule for all modes) and Animator overlay rules (HUD techniques, spring configs, entrance patterns for overlay mode only).

**Tech Stack:** Markdown prompt files (no code changes)

---

### Task 1: Strengthen 3-Second Pacing Rule in Director (All Modes)

**Files:**
- Modify: `packages/worker/src/prompts/director/system.md:172-177`

**Step 1: Read the current pacing section**

Read lines 152-184 of `packages/worker/src/prompts/director/system.md` to see the current `<pacing_guide>` section.

**Step 2: Strengthen the sync point cadence**

Replace the SYNC POINT CADENCE section (lines 172-177) with:

```markdown
SYNC POINT CADENCE (HARD RULE):
- Every scene MUST have a visual change every 3 seconds (90 frames at 30fps) — no exceptions
- This is the "Pattern Interrupt" rule: viewers scroll away after 3 seconds of visual stagnation
- A 10-second scene MUST have 3-4 sync points minimum
- Maximum 3 seconds (90 frames) between any two consecutive sync points — if there's a longer gap, add intermediate visual beats (icon entrance, text highlight, counter tick, progress update)
- Types of visual change: new element entering, element transforming, color/glow shift at sync word, data updating, stagger cascade completing
- This is what turns "slides with narration" into a DYNAMIC video
```

**Step 3: Add pacing verification to quality checklist**

Find the quality criteria/checklist section (search for `SYNC GAP TEST` around line 280). Update the sync gap test line from "under 5 seconds" to "under 3 seconds":

```markdown
[ ] SYNC GAP TEST: Is the max gap between any two consecutive sync points within a scene under 3 seconds (90 frames)?
```

**Step 4: Verify**

Read the modified sections back to confirm the changes are correct.

---

### Task 2: Replace Animation Defaults with Combined Entrance Pattern

**Files:**
- Modify: `packages/worker/src/prompts/animator/overlay-rules.md:96-112`

**Step 1: Read the current animation section**

Read lines 96-112 of `packages/worker/src/prompts/animator/overlay-rules.md`.

**Step 2: Replace the animation section**

Replace lines 96-112 (from `**ANIMATION — SUBTLE BUT POLISHED:**` through `Speaker is always the star.`) with:

```markdown
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
```

**Step 3: Verify**

Read the file back to confirm the animation section is updated.

---

### Task 3: Add HUD Techniques Section

**Files:**
- Modify: `packages/worker/src/prompts/animator/overlay-rules.md` (append after animation section, before "Overlay uses full canvas dimensions")

**Step 1: Read the file to find insertion point**

The new section goes after the animation rules (which you just updated in Task 2) and before the line `**Overlay uses full canvas dimensions**`.

**Step 2: Insert the HUD techniques section**

Add this block before the `**Overlay uses full canvas dimensions**` line:

```markdown
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
```

**Step 3: Verify**

Read the file back to confirm the HUD section is properly inserted.

---

### Task 4: Add Quantized Frame Rate and Variable Font Techniques

**Files:**
- Modify: `packages/worker/src/prompts/animator/overlay-rules.md` (append after HUD techniques, before "Overlay uses full canvas dimensions")

**Step 1: Insert advanced techniques section**

Add this block after the HUD techniques section and before `**Overlay uses full canvas dimensions**`:

```markdown
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
```

**Step 2: Verify**

Read the file back to confirm insertion.

---

## Summary

| # | Scope | File | What Changes |
|---|-------|------|-------------|
| 1 | All modes | director/system.md | 3-second pacing rule hardened, sync gap test tightened |
| 2 | Overlay only | animator/overlay-rules.md | Combined entrance pattern, two-tier springs, exit pattern |
| 3 | Overlay only | animator/overlay-rules.md | HUD techniques: scan lines, glow pulse, counters, glass recipe |
| 4 | Overlay only | animator/overlay-rules.md | Quantized frame rate, variable font weight animation |

All tasks are independent and can be executed in parallel if desired.
