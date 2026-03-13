# Animator Prompt Quality Updates

Based on visual analysis of generated projects across all display modes (stacked, fullscreen, overlay).

## Problem

Generated visuals are technically correct but feel repetitive and lifeless after entrance animations. Five systemic patterns hurt quality across every generation:

1. **Post-entrance stasis** — elements freeze after springing in, dead for 50-100 frames until next sync
2. **Identical spring configs** — SPRINGS.SMOOTH copy-pasted on every element, same feel everywhere
3. **Glassmorphic monotony** — exact same card recipe in every scene, no variation
4. **Effect copy-paste** — shimmer sweeps, blueprint grids reused verbatim across scenes
5. **Single-dimension entrances** — many elements enter with opacity-only fade, no scale/slide

## Changes

All edits go in `packages/worker/src/prompts/animator/system.md`. No new files. Minimal additions — tighten existing sections rather than adding new blocks.

### Step 1: Make continuous motion mandatory

**File:** `system.md` — `<prohibited_patterns>` section

**What:** Move the "CONTINUOUS MOTION RECIPES" table from optional polish into the prohibited patterns as a violation. Add a rule: any element visible for 30+ frames without ambient motion is a bug.

**Why:** The recipes exist at line 382-393 but are positioned as "hold = ALIVE, not FROZEN" suggestions. The AI treats them as optional. Making stasis a prohibited pattern forces compliance.

**Rule to add (after "All elements animate simultaneously" line):**
```
- **Static elements** — Any element visible 30+ frames MUST have ambient motion (float, breathe, glow pulse). Settled ≠ frozen. Use the continuous motion recipes below.
```

Remove the "CONTINUOUS MOTION RECIPES" sub-header from prohibited_patterns and instead inline the table directly after the new rule so they're co-located.

### Step 2: Spring variation rule

**File:** `system.md` — `<animation_patterns>` section, after Spring + Stagger block

**What:** Add a 2-line rule requiring spring config variation between adjacent elements within a scene.

**Rule to add:**
```
### Spring Variation
No two elements entering within 20 frames of each other should share identical spring configs. Vary damping by ±4 or stiffness by ±30 between adjacent entrances. SMOOTH for titles, SNAPPY for heroes, custom for supporting elements.
```

**Why:** Currently card grids and product box lists all use identical SMOOTH configs. The monotony is immediately noticeable when multiple elements enter sequentially.

### Step 3: Glassmorphic variation guidance

**File:** `system.md` — `<animation_patterns>` section, Glassmorphism block (line 203-212)

**What:** Update the existing glassmorphism code block to show per-scene accent tinting. Don't add a new section — modify the existing one.

**Change the existing glass recipe from:**
```tsx
const glassStyle = {
  background: 'rgba(255, 255, 255, 0.1)',
  ...
};
```

**To:**
```tsx
// Tint glass with scene's accent color for variety:
const glassStyle = {
  background: `${COLORS.accent}0F`, // hex alpha — NOT always white rgba
  backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
  border: `1px solid ${COLORS.accent}25`,
  borderRadius: 16, boxShadow: `0 8px 32px rgba(0, 0, 0, 0.3)`,
  overflow: 'hidden' as const,
};
// Vary blur (16-24px), border opacity (0x10-0x25), and borderRadius (12-20) between scenes.
```

**Note:** Uses hex alpha suffix on `COLORS.accent` (which already exists in constants.ts) — NOT `COLORS.primaryRgb` which doesn't exist.

### Step 4: Strengthen anti-slop as mandatory post-scene check

**File:** `system.md` — `<logging_requirement>` section (line 129-141)

**What:** Merge the anti-slop checklist items from `<assets_and_visuals>` (line 486-493) into the mandatory post-scene checklist. Currently anti-slop lives in a separate section the AI skips.

**Add to the existing checklist (after "TypeScript compiles clean"):**
```
- [ ] No single-dimension entrances (every entrance has opacity + scale or slide)
- [ ] Spring configs vary between adjacent elements (not all SMOOTH)
- [ ] Elements visible 30+ frames have ambient motion (float/breathe/pulse)
- [ ] Glass card styling differs from previous scene (tint, blur, radius)
```

**Then delete** the "Anti-Slop Checklist" sub-section from `<assets_and_visuals>` (lines 486-493) to avoid duplication.

### Step 5: Multi-axis entrance requirement

**File:** `system.md` — `<choreography>` section, Act 1 block (line 256-260)

**What:** Update Act 1 description to require multi-axis entrances. Currently says "Title animates in (frame 0-15) via word-cascade or fade+scale(1.05-1.15x)" — this is good for titles but doesn't cover other elements.

**Replace Act 1 block with:**
```
### Act 1 — Anticipation (frames 0 to keySync - 10)
Screen is NOT empty — it's LOADING.
- Title animates in (frame 0-15) via word-cascade or fade+scale(1.05-1.15x)
- ALL entrances combine opacity + at least one of: scale, translateY, rotate. Never opacity-only.
- Background establishes mood (gradient, ambient particles at opacity <= 0.15)
- Subtle build-up hints at what's coming
```

One line added: "ALL entrances combine opacity + at least one of: scale, translateY, rotate."

### Step 6: Enforce Center-Then-Shift for opening content

**File:** `system.md` — `<layout_rules>` section, Center-Then-Shift block

**What:** The rule already says "Content ALWAYS vertically centered" but it's ignored — Scene 1 placed the ring cluster at `EH * 0.28` (upper third) instead of centered at ~`EH * 0.42`. The rule needs teeth.

**Problem observed:** Generated content commonly starts at EH * 0.25-0.30 (upper third) instead of vertically centered. On a 960px canvas, content floats high with dead space below. When it shifts up at sync, the movement is barely noticeable instead of a dramatic center → top shift.

**Add to the existing Center-Then-Shift pattern (after "Content ALWAYS vertically centered"):**
```
Initial content position MUST be vertically centered: top = (EH * 0.85 - contentHeight) / 2.
NOT EH * 0.25 or EH * 0.30 — compute from actual content height.
The shift from center → final position is what makes the animation feel alive.
```

### Step 7: Icon sizing and proximity to focal point

**File:** `system.md` — `<assets_and_visuals>` section, Guardrails block

**What:** Icons that support a focal element (like a rocket next to a progress ring) need to be sized relative to that element and positioned within its visual orbit — not placed at a distant absolute position.

**Problem observed:** Supporting icons often rendered at 40% the size of their focal element and placed far away (300+ px) from the focal center. Visually disconnected.

**Add to Guardrails:**
```
- Supporting icons near a focal element: size >= 50% of focal element, position within 1.5x focal radius. Don't scatter icons at absolute screen edges.
```

### Step 8: Last sync must finish before outro begins

**File:** `system.md` — `<exit_animations>` section

**What:** The last sync animation and outro fade overlap, causing the final visual to flash-appear then immediately vanish. There must be a minimum gap.

**Problem observed:** Last sync animations commonly finish just 5-10 frames before outro begins, giving the final visual element only ~133ms of breathing room. The viewer barely registers it before it fades.

**Add after "Every scene MUST have an outro (last ~30 frames)":**
```
**CRITICAL: Last sync gap.** The last sync animation must COMPLETE at least 30 frames before outro begins.
If last sync finishes at frame X, outro cannot start before X + 30.
If this violates scene duration, either shorten the last animation or start it earlier.
Formula: lastSyncFrame + animationDuration + 30 <= sceneDuration - outroDuration.
```

### Step 9: Director — crossfade between same-mode scenes with visual continuity

**File:** `packages/worker/src/prompts/director/system.md` — transitions section

**What:** When two adjacent scenes share the same displayMode AND the director plans visual continuity between them (e.g., "indigo line extends into blueprint grid"), a hard cut kills that continuity. The director should use crossfade/fade transitions automatically in this case.

**Problem observed:** Adjacent scenes sharing the same displayMode with planned visual continuity (`connectsTo`/`buildsFrom`) still get hard cuts. The planned visual threads become invisible. A 15-20 frame crossfade would let elements morph between scenes.

**Rule to add to Director transitions guidance:**
```
When two adjacent scenes share the same displayMode AND `connectsTo`/`buildsFrom` describe visual continuity, use `"crossfade"` (300-500ms) — NOT `"cut"`. Hard cuts break planned visual threads.
Reserve `"cut"` for displayMode changes (e.g., default → fullscreen) where a clean break is intentional.
```

**Note:** This is a Director prompt change, not animator. The animator already supports TransitionSeries crossfade — it just needs the Director to specify it.

### Step 10: Fullscreen scenes must center content in usable area, not use arbitrary top percentages

**File:** `system.md` — `<per_scene_viewport>` section

**What:** Fullscreen scenes (1080×1920) have a large canvas. The AI defaults to `startY = EH * 0.15` (288px) and builds downward, leaving the bottom 40% of the canvas empty. Content should be vertically centered within the usable area (0% to 85%, since bottom 15% is subtitle zone).

**Problem observed:** Fullscreen scenes default to `startY = EH * 0.15` and build downward, leaving the bottom 40% empty while the top feels cramped. Content should be vertically centered in the usable area (0% to 85%).

**Add to per-scene viewport section:**
```
For fullscreen scenes, compute centered startY:
  const usableHeight = EH * 0.85; // bottom 15% is subtitle zone
  const contentHeight = totalGridHeight; // sum of rows + gaps
  const startY = (usableHeight - contentHeight) / 2;
Do NOT use arbitrary EH * 0.15 or EH * 0.20 — always compute from content height.
```

This reinforces Step 6's centering rule but specifically for fullscreen mode where the tall canvas amplifies any offset.

Multi-element compositions should be grouped in a single centered flex container (see Step 11) with computed vertical centering (see Step 6), not scattered at arbitrary EH/EW percentages.

### Step 11: Icons must be grouped with their parent content, not absolute-positioned independently

**File:** `system.md` — `<layout_rules>` section, Centering block

**What:** Icons that illustrate a concept (like a wheel for "don't reinvent the wheel") must be positioned relative to the text/card they support, inside a shared flex container — not independently absolute-positioned at arbitrary screen percentages.

**Problem observed:** Related elements (badge card, text label, icon) commonly placed as independent `position: absolute` divs at hardcoded percentages, causing them to look scattered rather than composed. They should share a flex container.

**Add to the Centering block (after the flexbox centering example):**
```
Icons that illustrate a text label MUST be in the same flex container as that label.
Never scatter related elements (card + label + icon) as independent absolute-positioned divs.
Group them: flex column → card → label → icon. Then position the group, not each piece.
```

This reinforces Step 7's proximity rule but at a structural level — it's about DOM hierarchy, not just distance.

### Step 12: Semantic icons should have continuous motion matching their meaning

**File:** `system.md` — `<prohibited_patterns>` section, Continuous Motion Recipes table

**What:** When an icon has an obvious semantic motion (gear = rotation, rocket = upward drift, heartbeat = pulse, arrow = oscillation), it should use that motion as its ambient animation. The current recipes are generic (float, breathe, pulse) — they don't consider what the icon represents.

**Problem observed:** Icons with obvious semantic motion (gears, rockets, hearts) slide in and freeze. A gear should slowly rotate — it's the most natural ambient motion. Generic float is the fallback, not the default.

**Add a note after the Continuous Motion Recipes table:**
```
Match ambient motion to icon semantics: gears rotate, rockets drift upward, hearts pulse, arrows oscillate, waves undulate. Generic float is the fallback, not the default.
```

### Step 13: Animation Technique Library — expand from ~8 to 12 core techniques

**Root cause:** The current system knows only ~8 animation patterns: spring-in, fade-rise, stagger-cascade, draw-in, fill-progress, count-up, pop-scatter, orbit-float. Professional explainer studios (Kurzgesagt, Vox, TED-Ed) use 12+ core techniques. The missing techniques cause every scene to feel like "fade in → spring → stagger" because that's all the AI knows.

**Problem observed:** Scenes that describe convergence, selection, depth, or before/after reveals all default to "fade in → spring → stagger" because techniques like `converge-to-point`, `morph-collapse`, `parallax-layers`, and `mask-reveal` don't exist in the vocabulary.

#### Current techniques (keep as-is):
1. `spring-in` — scale entrance with overshoot
2. `fade-rise` — opacity + translateY
3. `stagger-cascade` — sequential entrance
4. `draw-in` — SVG stroke animation
5. `fill-progress` — bar/circle filling
6. `count-up` — number ticker
7. `pop-scatter` — burst outward
8. `orbit-float` — ambient orbital motion

#### New techniques to add (the missing industry core):

**Files to change:**
- `shared/vocabulary.md` — add to Element Animations table (Director reads this)
- `animator/system.md` — add code recipes to `<animation_recipes>` section (Animator implements from this)
- `director/system.md` — add to `<visual_metaphors>` table + `<visual_decomposition>` (Director plans with this)

---

**A. Transformation Techniques** (modify shape/state — currently zero coverage)

**9. `converge-to-point`** — Multiple elements translate+scale toward a single point
```
When: "one thing in common", "all lead to", consensus, focus
Script cue: convergence, commonality, unification
```
Animator recipe:
```tsx
const convergeProgress = interpolate(frame, [syncFrame, syncFrame + 30], [0, 1], {
  extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic),
});
const itemX = interpolate(convergeProgress, [0, 1], [originalX, centerX]);
const itemY = interpolate(convergeProgress, [0, 1], [originalY, centerY]);
const itemScale = interpolate(convergeProgress, [0, 0.8, 1], [1, 0.5, 0]);
const centerPulse = spring({ frame: frame - (syncFrame + 20), fps, config: SPRINGS.SNAPPY });
```

**10. `morph-collapse`** — Non-survivors slide toward survivor, survivor absorbs with scale pulse
```
When: "pick one", "narrow down", selection, filtering
Script cue: choosing, eliminating, focusing
```
Animator recipe:
```tsx
const slideX = interpolate(collapseProgress, [0, 1], [myX, survivorX]);
const slideY = interpolate(collapseProgress, [0, 1], [myY, survivorY]);
const shrink = interpolate(collapseProgress, [0, 0.7, 1], [1, 0.6, 0]);
const absorbScale = spring({ frame: frame - (syncFrame + 25), fps, config: SPRINGS.SNAPPY });
const survivorScale = interpolate(absorbScale, [0, 1], [1, 1.15]);
```

**11. `split-expand`** — One element splits into multiple copies spreading outward
```
When: "branches into", "splits into", distribution, diversification
Script cue: one-to-many, expansion
```

---

**B. Reveal Techniques** (control how elements appear — only fade/scale currently)

**12. `mask-reveal`** — Element revealed through animated clipPath
```
When: before/after, unveiling, dramatic reveals
Script cue: "reveal", "uncover", "behind the scenes"
```
Animator recipe:
```tsx
const revealProgress = interpolate(frame, [syncFrame, syncFrame + 30], [0, 100], {
  extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
});
// Circle reveal from center:
<div style={{ clipPath: `circle(${revealProgress}% at 50% 50%)` }}>{content}</div>
// Or directional wipe:
<div style={{ clipPath: `inset(0 ${100 - revealProgress}% 0 0)` }}>{content}</div>
```

**13. `modular-assembly`** — Parts fly in from edges and assemble into final form
```
When: "building blocks", "components", "put together", construction
Script cue: assembly, building, composition
```
Animator recipe:
```tsx
// Each part starts off-screen at a different edge
const partProgress = spring({ frame: frame - (syncFrame + partIndex * 8), fps, config: SPRINGS.SMOOTH });
const partX = interpolate(partProgress, [0, 1], [startOffscreenX, finalX]);
const partY = interpolate(partProgress, [0, 1], [startOffscreenY, finalY]);
const partRotate = interpolate(partProgress, [0, 1], [randomAngle, 0]);
```

**14. `exploded-view`** — Object breaks apart to show components, then reassembles
```
When: "let's break this down", "components are", anatomy, structure
Script cue: decomposition, analysis, breakdown
```

---

**C. Camera-Based Techniques** (currently zero coverage)

**15. `parallax-layers`** — Foreground/background move at different speeds for depth
```
When: environmental scenes, depth, journey, continuous motion
Script cue: layers, depth, immersion
```
Animator recipe:
```tsx
// 3 depth layers with different speeds
const bgX = frame * 0.2;   // slow background
const midX = frame * 0.5;  // medium midground
const fgX = frame * 1.0;   // fast foreground
<div style={{ transform: `translateX(${-bgX}px)` }}>{bgLayer}</div>
<div style={{ transform: `translateX(${-midX}px)` }}>{midLayer}</div>
<div style={{ transform: `translateX(${-fgX}px)` }}>{fgLayer}</div>
```

**16. `zoom-transition`** — Camera zooms into element to reveal next content
```
When: "let's zoom in", "look closer", scene transitions, focus shifts
Script cue: detail, closer look, drilling down
```
Animator recipe:
```tsx
const zoomProgress = interpolate(frame, [syncFrame, syncFrame + 20], [1, 3], {
  extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic),
});
const zoomOpacity = interpolate(frame, [syncFrame + 15, syncFrame + 20], [1, 0], {
  extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
});
<div style={{ transform: `scale(${zoomProgress})`, opacity: zoomOpacity, transformOrigin: `${focusX}px ${focusY}px` }}>
```

---

**D. Symbolic Techniques** (currently no spotlight or scale comparison)

**17. `spotlight-focus`** — Darken everything except the key element
```
When: "the key is", "focus on", "most important", isolation
Script cue: emphasis, isolation, importance
```
Animator recipe:
```tsx
// Overlay darkens everything, target element gets z-index above overlay
const dimOpacity = interpolate(frame, [syncFrame, syncFrame + 15], [0, 0.7], {
  extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
});
<div style={{ position: 'absolute', inset: 0, background: '#000', opacity: dimOpacity }} />
<div style={{ position: 'relative', zIndex: 2 }}>{targetElement}</div>
```

**18. `kinetic-typography`** — Text IS the animation, words move/scale/rotate expressively
```
When: quotes, key phrases, emphasis moments, text-heavy sections
Script cue: impactful statements, taglines, quotes
```

---

#### Director prompt changes

**Add to `<visual_decomposition>` section:**
```
TRANSFORMATION > SUBSTITUTION:
When the narrative describes convergence, selection, or transformation, elements must
PHYSICALLY MOVE to their new state — not just fade/swap.
- BAD: "two boxes fade out, one remains" (substitution)
- GOOD: "two boxes slide toward the center box and merge into it" (transformation)

Use technique names from vocabulary: converge-to-point, morph-collapse, mask-reveal,
modular-assembly, exploded-view, parallax-layers, zoom-transition, spotlight-focus.
```

**Add to `<visual_metaphors>` table:**
```
| Convergence/focus | converge-to-point, morph-collapse, spotlight-focus | Elements physically move — NOT just pulse/fade |
| Revealing/unveiling | mask-reveal (circle or directional wipe) | clipPath animation — NOT just opacity fade |
| Building/construction | modular-assembly | Parts fly in from edges — NOT just stagger-cascade |
| Depth/journey | parallax-layers | Multi-speed layers — NOT flat slide |
| Drilling down | zoom-transition | Scale into element — NOT just cut |
| Breaking down | exploded-view | Parts spread out — NOT just list |
```

**Add to Director self-verification table:**
```
| Technique variety: ≥3 different techniques used across scenes? | ✓/✗ | ... |
```

### Step 14: Align damping thresholds across ALL prompt files

**Root cause:** Steps 1-13 fix the animator system prompt, but 6 other files still have inconsistent damping floors. The AI reads these during generation and gets conflicting signals.

**Files and changes:**

| File | Current | Change to |
|------|---------|-----------|
| `shared/quality-checklist.md` line 14 | `damping >= 10` | `damping >= 18` |
| `animator/scene-verify.md` line 14 | `damping >= 20` | `damping >= 18` |
| `themes/studio/light/style-guide.md` line 53 | `damping >= 20` | `damping >= 18` |
| `themes/studio/dark/style-guide.md` line 53 | `damping >= 18` | Already correct (verify) |
| `themes/studio/design-system.md` line 136 | `damping: 10, stiffness: 200` | `damping: 18, stiffness: 200` |
| `references/common-patterns.md` lines 101-103 | `modern: damping:12`, `playful: damping:8`, `bold: damping:15` | `modern: damping:20`, `playful: damping:18`, `bold: damping:18` |
| `references/stack-overflow.md` line 52 | `damping: 12` | `damping: 20` |
| `shared/motion-design-principles.md` line 34 | `damping (14-18)` | `damping (18-22)` |

**Rule:** After this step, `damping < 18` should appear zero times in any prompt file outside the prohibited-patterns rule itself.

### Step 15: Update verification prompts for new quality rules

**Files:** `animator/scene-verify.md`, `shared/quality-checklist.md`

**What:** The verification prompts check generated code but don't know about the new rules from Steps 1-13. Add checks for:

**In `quality-checklist.md` (Per-Scene Verification), add:**
```
- [ ] Spring configs vary between adjacent elements (not all SMOOTH)
- [ ] Elements visible 30+ frames have ambient motion (float/breathe/pulse)
- [ ] ≥2 different animation techniques used across scenes (not all spring-in + stagger)
- [ ] Content vertically centered: top = (usableHeight - contentHeight) / 2
- [ ] Related elements (icon + label + card) grouped in shared flex container
- [ ] Last sync animation completes 30+ frames before outro begins
```

**In `scene-verify.md`, add check #12:**
```
12. **Technique variety**: Does the scene use at least 2 different animation techniques (not just spring-in + fade for everything)?
```

## Validation

After applying all 15 steps, grep for consistency:
- `damping < 18` should appear zero times outside the prohibited rule itself
- `damping >= 10` should appear zero times (old threshold)
- `damping >= 20` should appear zero times in verification checks (standardized to >= 18)
- "CONTINUOUS MOTION RECIPES" header should no longer exist as a separate sub-section
- Anti-slop checklist should appear only in `<logging_requirement>`, not duplicated in `<assets_and_visuals>`
- Glassmorphism block should reference `COLORS.accent` hex alpha, not hardcoded white

## Not Changing

- Skill files (motion-one, framer-motion) — already updated for damping alignment in the immediate fixes before this plan. They provide reference patterns, not rules.
- `overlay-rules.md` — overlay damping >= 28 is intentionally stricter than the >= 18 floor. No change needed.
- Generated project files — user has already updated the code manually.
