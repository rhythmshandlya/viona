# Video Aesthetics Overhaul — Design Spec

**Date:** 2026-03-19
**Status:** Draft
**Scope:** Prompt-layer changes only (no template code, no new components)

## Problem

Pipeline output has 4 critical aesthetic issues:

1. **Liquid glass only in overlays** — Fullscreen scenes use flat styled containers. The glass material (animated gradients, specular highlights, depth shadows) only appears in overlay scenes because they're simple enough for the AI to handle. Fullscreen scenes cut corners.
2. **Black space on 9:16 canvas** — Landscape source video (16:9) sits centered with black bars. No agent applies an initial zoom-to-fill crop.
3. **Missing zoom cuts** — Planner outputs punch-in locations, Layout Editor has steps for them, but the Layout Editor skipped all splits in the last run and used keyframes on unsplit items instead.
4. **Static animations** — One universal spring config (damping:30), everything enters from bottom with opacity fade, no continuous motion, no varied choreography. Animations feel mechanical.

## Decisions

| Question | Decision |
|----------|----------|
| Glass fix: components vs prompts vs both? | **Prompts only (B)** — no new template components |
| Video zoom: where does it happen? | **Layout Editor** — new Step 0 before any scene work |
| Zoom cuts: who executes? | **Both (C)** — Trim Editor: jump-cut coverage at edit points. Layout Editor: plan punch-ins + scene splits (enforced) |
| Motion fix: reinforce vs rewrite vs QC gate? | **Rewrite entirely (B)** — replace conservative spring config, add choreography patterns |

## Design

### 1. Layout Editor — Video Positioning & Enforced Splits

**File:** `packages/sandbox/src/prompts/layout-editor/system.md`
**File:** `packages/sandbox/src/prompts/layout-editor/reminder.md`

#### 1a. New Step 0: Zoom-to-Fill

Before any splits or scene work, the Layout Editor positions the source video on the 9:16 canvas. Added as Step 0 before the current Step 1.

The Layout Editor reads `manifest.canvas` (width/height) and `manifest.videoSettings` (sourceWidth/sourceHeight). If the source aspect ratio differs from canvas, it updates ALL video items with a `data.crop` that zooms to fill the frame.

Calculation:
```
sourceAR = sourceWidth / sourceHeight    (e.g. 1920/1080 = 1.78)
canvasAR = canvasWidth / canvasHeight    (e.g. 1080/1920 = 0.56)
scale = sourceAR / canvasAR              (e.g. 1.78 / 0.56 ≈ 3.17)
→ But this is the ratio needed to fill height. In practice:
scale = (sourceWidth / sourceHeight) * (canvasHeight / canvasWidth)
      = (1920/1080) * (1920/1080) ≈ 3.16...

Simplified: scale = sourceHeight > 0 ? (canvasHeight / canvasWidth) / (sourceHeight / sourceWidth) : 1
```

The Layout Editor applies `update_item` with `data.crop: { x: 50, y: 50, scale }` on every video item. Center-cropped by default. After this step, zero black bars should be visible when rendering a still.

If `speaker-grid.json` exists, the crop center should be adjusted to keep the speaker's face visible (shift y toward the face zone).

#### 1b. Enforce Splits as Non-Negotiable

The last pipeline run had the Layout Editor skip all splits and use keyframes on unsplit items instead. This produced a single 50k ms video item with 26 keyframes.

Changes to Steps 3-5:
- Explicit language: **"You MUST use split_item. Using keyframes on unsplit items to simulate scene boundaries is WRONG and will produce broken output. Each scene boundary requires a physical split_item call on both the video AND its paired audio item."**
- Self-check after splits: **"Read the manifest and count video items. You should have N video items (one per scene + one per gap between scenes). If you still have the original number of items, you skipped splits — go back and execute them."**

#### 1c. Enforce Punch-ins and Multi-Angle Cuts

Steps 4-5 get the same enforcement:
- **"If SCENE_PLAN.md contains a Punch-in Locations table, you MUST execute every entry. Skipping is not acceptable."**
- **"If SCENE_PLAN.md contains a Multi-angle Cuts table, you MUST execute every entry."**
- **"After executing punch-ins, read the manifest and verify that crop values are set on the correct video items."**

#### 1d. Reminder Updates

Add to `reminder.md`:
- `Step 0: zoom-to-fill MUST be done first. No black bars.`
- `Splits are MANDATORY. Keyframes on unsplit items = wrong.`
- `Every punch-in in the plan MUST be executed.`

---

### 2. Trim Editor — Jump-Cut Coverage

**File:** `packages/sandbox/src/prompts/trim-editor/system.md`

Minimal change. After all trims are complete, the Trim Editor applies automatic zoom coverage at every visible edit point (where two clips meet after a section was removed).

Add to the Professional Techniques section:

> **Jump cut coverage:** After trimming, every visible edit point needs coverage. At each cut boundary, apply a subtle crop change — alternate between `{ x: 50, y: 50, scale: 1.0 }` (default framing) and `{ x: 50, y: 45, scale: 1.08 }` (slight zoom-in, shifted up slightly) on alternating segments using `update_item` on `data.crop`. This creates visual variety at cuts. Process after all trims are done, before reporting completion.

No other changes to the Trim Editor. Video canvas positioning stays in Layout Editor.

---

### 3. Animator Prompt — Liquid Glass Across All Scenes

**File:** Animator system prompt (fullscreen rules, overlay rules, or unified prompt)
**File:** `packages/sandbox/template/docs/guidelines/studio-theme.md`

#### 3a. Liquid Glass in Remotion

Remotion renders to canvas — no `backdrop-filter`. Replace the static glass recipe in `studio-theme.md` with a Remotion-compatible liquid glass section:

**Glass Surface:** Animated `linear-gradient` background that shifts position over time:
```tsx
background: `linear-gradient(
  ${135 + Math.sin(frame * 0.02) * 10}deg,
  rgba(28, 28, 35, 0.65),
  rgba(45, 40, 60, 0.45)
)`;
```

**Specular Highlight:** A bright gradient overlay that translates across the panel surface over 40-60 frames:
```tsx
<div style={{
  position: 'absolute', inset: 0,
  background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.12) 50%, transparent 60%)',
  transform: `translateX(${interpolate(frame, [0, 50], [-100, 100], { extrapolateRight: 'clamp' })}%)`,
}} />
```

**Depth Shadows:** Scale with element size. Animate in with the panel (0 → full over 15 frames):
```tsx
boxShadow: `0 ${8 * depthFactor}px ${24 * depthFactor}px rgba(0,0,0,${0.4 * shadowOpacity}),
            inset 0 1px 0 rgba(255,255,255,${0.1 * shadowOpacity})`
```

**Grain Texture:** Subtle noise at 5-8% opacity. Shifts position every 3-4 frames:
```tsx
backgroundPosition: `${Math.floor(frame / 3) * 50}px ${Math.floor(frame / 3) * 30}px`
```

**Glass Shimmer:** At least one continuously oscillating property:
```tsx
// Highlight opacity breathes
opacity: 0.06 + Math.sin(frame * 0.04) * 0.03
```

**Key rule: Liquid glass is never static. Every glass surface must have at least one continuously animating property.**

#### 3b. Fullscreen Scenes Must Use Glass

Add to fullscreen rules:

> Every container, card, or panel in a fullscreen scene uses the liquid glass treatment. This is not optional. A fullscreen scene with flat-colored rectangles or static styled divs is a failure. The glass treatment (animated gradient surface + specular highlight sweep + depth shadow + grain) applies to every surface that holds content.

#### 3c. Content-Adaptive Color

Replace fixed `#08080C + #8B5CF6` approach:

> Color direction comes from the scene content, not a fixed palette. Read the scene's description from the plan:
> - Growth/money/success → emerald/gold tones (`#10b981`, `#f59e0b`)
> - Danger/urgency/warning → warm red/amber (`#ef4444`, `#f97316`)
> - Technical/data/analysis → cool blue/cyan (`#3b82f6`, `#06b6d4`)
> - Creative/inspiration → violet/magenta (`#8b5cf6`, `#ec4899`)
> - Calm/health/nature → teal/green (`#14b8a6`, `#22c55e`)
>
> The violet accent is ONE option, not the default. Each scene should feel like it belongs to the video's topic. The background base can shift too — deep navy, dark warm gray, or deep emerald instead of always `#08080C`.

#### 3d. Typography Upgrade

Remove max-weight-500 rule from `studio-theme.md`:

> Hero text (main numbers, key phrases, titles) uses weight 700-800. Supporting text and labels stay at 400-500 for contrast. The weight differential creates hierarchy that reads at scroll speed on a phone screen. Light text disappears in motion — bold text stops the scroll.

---

### 4. Animator Prompt — Motion Rewrite

**File:** Animator system prompt
**File:** `packages/sandbox/template/docs/guidelines/studio-theme.md`

#### 4a. Spring Vocabulary (Replaces Universal Spring)

Remove `SPRING_CONFIG = { damping: 30, mass: 1, stiffness: 500 }`. Replace with a vocabulary the animator selects from based on semantic purpose:

| Name | Config | Use For |
|------|--------|---------|
| **SNAPPY** | `{ damping: 20, mass: 1, stiffness: 180 }` | Hero reveals, key numbers, emphasis moments |
| **SMOOTH** | `{ damping: 28, mass: 1, stiffness: 120 }` | Cards, containers, supporting elements |
| **BOUNCY** | `{ damping: 12, mass: 0.8, stiffness: 200 }` | Icons, small accents, playful moments |
| **HEAVY** | `{ damping: 35, mass: 1.5, stiffness: 100 }` | Large panels, backgrounds, weighty arrivals |

**Rule: Adjacent elements must NOT use the same spring.** A hero number enters SNAPPY while its label enters SMOOTH. A card enters HEAVY while the icon inside enters BOUNCY. Contrast is what makes motion feel choreographed.

#### 4b. Varied Entrance Directions

Replace "everything enters from bottom with opacity fade":

> Entrance direction must vary within a scene:
> - **From bottom** (translateY +30 → 0) — default, primary content
> - **From left/right** (translateX ±40 → 0) — side-by-side elements, comparisons
> - **Scale up** (scale 0.85 → 1.0) — hero moments, emphasis
> - **Scale down** (scale 1.15 → 1.0) — "arriving from above" feeling
> - **Rotation** (rotate ±5deg → 0) — sparingly, accent elements only
>
> **Never have all elements in a scene enter from the same direction.** If the title comes from bottom, the supporting card should scale up or come from the side.

#### 4c. Mandatory Continuous Motion

Replace vague "ambient motion" with specific patterns:

> Every visible element that has settled MUST have idle motion:
> - **Float:** `translateY(Math.sin(frame * 0.03) * 3)` — gentle vertical drift
> - **Breathe:** `scale(1 + Math.sin(frame * 0.04) * 0.015)` — subtle pulse
> - **Rotate drift:** `rotate(Math.sin(frame * 0.02) * 1.5)` — barely perceptible tilt
> - **Glow pulse:** opacity oscillation on a shadow or highlight element
>
> The background is NEVER static. At least one of: gradient position shift, dot grid drift, slow color rotation, particle movement.
>
> **A scene where anything is frozen for more than 30 frames (1 second) is a failure.**

#### 4d. Overlapping Action

> Opacity and transform must NOT start on the same frame. For every entrance:
> - Opacity starts 3-5 frames BEFORE position/scale
> - OR position starts 3-5 frames BEFORE opacity
>
> Simultaneous opacity + transform is the #1 tell of amateur animation. The offset creates physical weight.

#### 4e. Scene Choreography

Replace rigid 3-act structure:

> Scene choreography follows audio energy. Read the transcript words for your scene's time range:
> - On emphasis words → trigger hero element entrance (SNAPPY spring)
> - On pauses → let elements breathe, ambient motion only
> - On lists/enumeration → stagger elements at 8-12 frame intervals, each from a different direction
> - On conclusion/summary → elements settle, subtle zoom-out (scale 1.0 → 0.98 over 30 frames)
>
> **No dead air.** If there are more than 20 frames where nothing is entering or transforming (only idle), add a secondary element: accent line drawing, number ticking, highlight sweep across existing content.

---

### 5. Planner — Scene Composition Variety

**File:** `packages/sandbox/src/prompts/planner/system.md`
**File:** `packages/sandbox/template/docs/guidelines/editing-style.md`

#### 5a. Layout Pattern Variety

Replace rigid zone percentages with composition patterns:

> No two adjacent scenes should use the same layout pattern. Available patterns:
> - **Center-dominant** — hero element large and centered, supporting text wraps around
> - **Asymmetric** — content weighted 60/40 or 70/30 to one side, creates visual tension
> - **Diagonal flow** — elements along a diagonal axis, top-left to bottom-right
> - **Stacked cascade** — elements overlap slightly with parallax depth, front-to-back
> - **Full-bleed** — single element fills entire canvas (large typography, one data point)
> - **Scattered** — elements placed organically, not grid-aligned, dynamic and less corporate
>
> The Planner specifies a `layout` field per scene in SCENE_PLAN.md. The Animator follows it.

#### 5b. Remove Rigid Zone System

Remove from animator fullscreen rules: "top 20% title, middle 40% content, bottom 25% detail". Replace with:

> Follow the layout pattern from the plan. Do not default to top/middle/bottom zones. Place elements according to the specified pattern. Leave bottom 12% clear for captions, but otherwise use the full canvas creatively.

---

## Files Changed

| File | Change Type | Description |
|------|-------------|-------------|
| `packages/sandbox/src/prompts/layout-editor/system.md` | Edit | New Step 0 (zoom-to-fill), enforce splits, enforce punch-ins, self-checks |
| `packages/sandbox/src/prompts/layout-editor/reminder.md` | Edit | Add zoom/split/punch-in reminders |
| `packages/sandbox/src/prompts/trim-editor/system.md` | Edit | Add jump-cut coverage zoom technique |
| Animator system prompt | Edit | Liquid glass section, content-adaptive color, typography, full motion rewrite |
| Animator fullscreen rules | Edit | Remove rigid zones, require glass on all surfaces |
| `packages/sandbox/src/prompts/planner/system.md` | Edit | Layout pattern variety, scene composition freedom |
| `packages/sandbox/template/docs/guidelines/studio-theme.md` | Edit | Liquid glass recipe for Remotion, spring vocabulary, remove max-weight-500 |
| `packages/sandbox/template/docs/guidelines/editing-style.md` | Edit | Remove rigid zone percentages, add layout patterns |
| `packages/sandbox/template/.claude/CLAUDE.md` | Edit | Add liquid glass rules, zoom-to-fill note |

## Out of Scope

- New template components (decision: prompts only)
- Rendering code changes (VideoItem.tsx, PlayerComposition.tsx already support crop)
- Orchestrator changes
- Frontend/editor changes
- QC gate for motion quality (may add later based on results)

## Success Criteria

After implementation, a pipeline run should produce:
1. **Zero black bars** — video fills the 9:16 canvas completely
2. **Visible zoom cuts** — at least 2 punch-ins and alternating crop at edit points
3. **Glass on every surface** — fullscreen scenes use animated gradients, specular highlights, depth shadows, grain
4. **Content-appropriate colors** — scenes use topic-relevant accent colors, not always violet
5. **Dynamic motion** — varied springs, varied entrance directions, continuous idle motion, no frozen elements
6. **Layout variety** — no two adjacent scenes use the same composition pattern
