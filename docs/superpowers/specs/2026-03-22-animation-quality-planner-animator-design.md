# Animation Quality: Planner + Animator Improvements

**Goal:** Raise the quality of AI-generated scene animations from "PowerPoint with springs" to professional motion design — conceived with creative ambition by the Planner, built with visual craft by the Animator.

**Scope:** Changes to sandbox prompt files + a new validation tool:
- `packages/sandbox/src/prompts/planner/system.md` — how scenes are planned
- `packages/sandbox/src/prompts/animator/system.md` — how scenes are built
- `packages/sandbox/src/prompts/planner/examples/good-plan.md` — the few-shot example
- `packages/sandbox/src/prompts/orchestrator/system.md` — post-animation validation step
- `packages/sandbox/src/tools/analysis-tools.ts` — new `validate_animation_quality` MCP tool

---

## Problem

Two distinct failures combine to produce generic animations:

### Planner: Describes static end-states, not temporal choreography

The current Animation Brief is a free-text paragraph describing what the scene "looks like" at its final state:

> "An asymmetric two-column comparison visualizing the minority vs majority split. On the left, a small 10% label enters with spring scale-up... On the right, a large muted 90% appears..."

This tells the Animator WHAT to place but not WHAT HAPPENS OVER TIME. Result: the Animator builds entrance animations (first 2 seconds), then the scene sits static with imperceptible idle motion (0.012 scale oscillation, 2px float) for the remaining 7+ seconds.

The planner also thinks in formulaic scene types — "comparison" always becomes two columns, "cause-effect" always becomes connected nodes, "progress" always becomes a ring with counter. The scene type vocabulary constrains rather than inspires.

### Animator: Knows the rules, ignores the craft

The Animator prompt already states:
- "Surfaces must feel alive — two animated treatments per container"
- "45 frames frozen = scene has FAILED"
- "No flat rectangles as primary visual structure"

But the actual output produces exactly those things. Scene 3 from a real project: `background: 'rgba(18, 18, 28, 0.85)'` with `border: 1px solid`. Three centered dark rectangles connected by straight lines. The prompt's quality rules are aspirational text, not enforceable constraints.

The Animator also lacks knowledge of techniques that create visual richness:
- SVG filters (`feTurbulence`, `feColorMatrix`, `feGaussianBlur`) for texture and grain
- Generated `clip-path: polygon()` for organic shapes and transitions
- Perspective transforms for cinematic camera feel
- Multi-layer gradient composition for depth
- Typographic craft (weight hierarchy, letter-spacing, line-height tuning)

These are all standard Remotion/React/SVG — the Animator just doesn't know to use them.

---

## Design

### Change 1: Planner — Structured Animation Timeline

Replace the free-text `Animation brief` section with a structured format that forces the planner to fill the entire scene duration with events.

**Current format:**
```markdown
### Animation brief
- Description: [free-text paragraph describing end-state]
- Key data: [...]
- Must show: [...]
```

**New format:**
```markdown
### Visual concept
[1-2 sentences: what is the creative idea? Not "comparison layout" but the actual visual metaphor or approach]

### Key data
[extracted items from transcript]

### Must show
[verbatim text/numbers that must appear]

### Animation timeline
| Phase | Frames | What happens |
|-------|--------|-------------|
| Entrance | 0–F1 | [what enters, how, from where] |
| Build | F1–F2 | [what develops, transforms, reveals progressively] |
| Develop | F2–F3 | [how the visual evolves — elements morph, rearrange, react to each other] |
| Payoff | F3–F4 | [the key moment — emphasis, reveal, climax of the visual] |
| Exit | F4–end | [how it departs] |
```

**Rules for the timeline:**
1. Every scene MUST have 3-5 phases covering the full frame range
2. "Build" and "Develop" phases are MANDATORY — they fill the middle 60-70% that's currently dead
3. No phase may span more than 40% of the scene duration without at least 2 distinct visual events inside it
4. Elements must CHANGE during the scene (morph shape, shift color, rearrange position, reveal new content) — not just enter and sit
5. At least one element must do something other than enter/idle/exit — it must transform, react, or evolve mid-scene

**Example — Scene 2 from the real project (comparison, 289 frames) rewritten:**

```markdown
### Visual concept
Scale metaphor: the 10% productive minority shown as a focused, rising column vs the 90% majority shown as a spreading, sinking weight — the visual relationship between them evolves as the speaker explains why.

### Animation timeline
| Phase | Frames | What happens |
|-------|--------|-------------|
| Entrance | 0–40 | Thin horizontal divider draws across. "10%" scales up from left with emerald glow. "90%" fades in large and muted on right. |
| Build | 40–100 | Under "10%": three action icons (arrow, gear, target) stagger in diagonally. As each appears, the 10% column grows taller (bar rising behind it). Under "90%": "MAJORITY" label drifts in, stays dim. |
| Develop | 100–200 | The 10% column's rising bar hits a "HIGH STANDARD" threshold line that draws across it. The bar color shifts green→gold as it passes the line. Meanwhile the 90% side's text slowly sinks downward (translateY increasing) and dims further — visual weight pulling it down. A dashed curve begins drawing from the 10% column toward the 90%, pulsing. |
| Payoff | 200–260 | The connecting curve completes. A pulse of color travels along it from 10%→90%. The 90% side briefly brightens as if receiving the comparison. The threshold line on the 10% side glows. |
| Exit | 260–289 | All elements drift down 10px and fade. 10% side exits 4 frames after 90% side (reverse of entrance order). |
```

This plan gives the Animator 5 concrete things happening between frames 40-260, instead of "elements enter, then idle float."

#### Complete new per-scene schema

The full per-scene template in the planner prompt becomes:

```markdown
## Scene N: [Title]
**File:** Scene{N}.tsx
**Time:** startMs – endMs
**Transcript:** "[exact verbatim words]"
**Display mode:** Fullscreen | Stacked [top%/bottom%] | Overlay
**Scene type:** [one of 10 types]
**Layout pattern:** [one of 6 patterns]

### Speaker layout
- Speaker: "full size" | "bottom X%" | "opacity: 0"

### Scene dimensions
- Width: [px] Height: [px]

### Scene placement
- Placement: [preset name or "top half" / "full canvas"]

### Transition IN
- From: [previous state]
- Transition: [name]

### Transition OUT
- To: [next state]
- Transition: [name]

### Visual concept
[1-2 sentences: the creative idea — a metaphor, visual relationship, or motion concept. NOT a layout description.]

### Key data
[extracted items from transcript]

### Must show
[verbatim text/numbers that must appear on screen]

### Animation timeline
| Phase | Frames | What happens |
|-------|--------|-------------|
| Entrance | 0–F1 | [what enters, how, from where] |
| Build | F1–F2 | [what develops, transforms, reveals] |
| Develop | F2–F3 | [how the visual evolves mid-scene] |
| Payoff | F3–F4 | [emphasis, reveal, climax] |
| Exit | F4–end | [how it departs] |
```

All fields above the Visual Concept section are UNCHANGED from the current schema. The changes are:
- `Animation brief` (Description, Key data, Must show) → `Visual concept` + `Key data` + `Must show` + `Animation timeline`

#### Downstream consumer impact

The following agents consume `SCENE_PLAN.md` and need to be checked:

| Consumer | Reads what | Impact |
|----------|-----------|--------|
| **Setup Agent** | Scene type, display mode, dimensions, key data, must-show → builds skeleton DATA objects | **No change needed.** The fields it reads (scene type, display mode, dimensions, key data, must show) are preserved in the same format. The new `Visual concept` and `Animation timeline` sections are additional — the Setup Agent ignores fields it doesn't need. |
| **Layout Editor** | Time ranges, display modes, transitions, dimensions, placement → builds timeline | **No change needed.** Reads only structural fields which are unchanged. |
| **Animator** | The full scene section including the brief → implements the animation | **Benefits from change.** The phased timeline gives it more structured input. The Animator dispatch message from the orchestrator already passes the full scene section from SCENE_PLAN.md — no format change needed in how it's passed. |
| **Orchestrator** | Validates plan diversity, coordinates, bounds | **Minor addition.** Phase 3 validation should check that Animation Timeline exists and has 3-5 phases. See Change 6. |
| **Final Editor** | Verifies scene files match plan | **No change needed.** Checks file existence and structural completeness, not animation brief content. |

#### Self-verification checklist additions

Add to the planner's existing 16-item self-verification checklist:

```markdown
- [ ] Every scene has an **Animation timeline** table with 3-5 phases
- [ ] Every scene has a **Build** and **Develop** phase (not just Entrance + Exit)
- [ ] No single phase spans more than 40% of the scene's total frame count
- [ ] Every **Visual concept** describes a creative idea, not a layout ("two-column", "three cards")
```

### Change 2: Planner — Creative ambition in the Visual Concept field

The `Visual concept` field replaces the tendency to think in layouts ("two-column comparison") with visual thinking. The planner prompt will include guidance:

> **Visual concept** is NOT a layout description. It's the creative idea. Ask yourself: "If I described this scene to a motion designer, what would make them excited to build it?" A comparison doesn't have to be two columns. It could be a scale/balance that tips, a thermometer that splits into two paths, elements that transform from one state to another. Think in metaphors and motion, not in grids.

The planner prompt will also add this anti-pattern:

> **AVOID these generic concepts:**
> - "Two-column layout with X on left and Y on right" — that's a layout, not a concept
> - "Three connected nodes with arrows" — that's a flowchart, think of something better
> - "Progress ring that fills to N%" — only use if the content is literally about a percentage
> - "Glass card with text inside" — that's a container, not a concept
>
> **Instead, think about:**
> - What RELATIONSHIP between ideas does this scene show? (contrast, growth, collapse, transformation, sequence)
> - What MOTION tells that story? (something rising vs falling, expanding vs contracting, connecting vs separating)
> - What makes the viewer WATCH for the full duration? (progressive reveal, building tension, visual surprise)

### Change 3: Planner — Rewrite the example plan

The current `good-plan.md` example reinforces the exact patterns we're trying to fix:
- "Glass card appears... counter animates to 65%"
- "Three numbered circles stagger in... connecting line draws between them"
- "Three frosted glass nodes connected by animated downward arrows"

Replace it with a new example that demonstrates:
- Phased animation timelines with full-duration coverage
- Creative visual concepts (not formulaic layouts)
- Elements that transform mid-scene

The new example must include:
- At least 5 scenes (to demonstrate variety at scale)
- At least one each of Overlay, Stacked, and Fullscreen display modes
- At least 3 different scene types
- No "glass card with text" or "three nodes connected by arrows" patterns
- Every scene has a Build and Develop phase with mid-scene transformations
- The complete self-verification checklist (including new timeline items)

Writing the full replacement example is part of the implementation task.

### Change 4: Animator — Teach craft techniques as patterns

Add a new section to the Animator prompt: **"Techniques for Visual Richness."** Not a vocabulary list — concrete patterns the Animator can apply from scratch. These are all standard React/SVG/CSS that work in Remotion:

**Texture & grain (SVG filters):**
```tsx
// Creates subtle noise texture overlay
<svg><filter id="grain">
  <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves={4} />
  <feColorMatrix values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0.08 0" />
</filter>
<rect width="100%" height="100%" filter="url(#grain)" /></svg>
```

**Organic shapes (generated clip-path):**
```tsx
// Irregular edge — generate polygon points with controlled randomness
// Uses Remotion's deterministic random(): import { random } from 'remotion';
const points = Array.from({length: 20}, (_, i) => {
  const angle = (i / 20) * Math.PI * 2;
  const r = baseRadius + random(`edge-${i}`) * variance;
  return `${50 + Math.cos(angle) * r}% ${50 + Math.sin(angle) * r}%`;
});
style={{ clipPath: `polygon(${points.join(', ')})` }}
```

**Depth via multi-layer shadows:**
```tsx
// Animated depth — shadow grows as element enters
const shadowDepth = interpolate(frame, [enter, enter+15], [0, 1], {/*clamp*/});
boxShadow: `0 ${2*shadowDepth}px ${8*shadowDepth}px rgba(0,0,0,0.15),
            0 ${8*shadowDepth}px ${32*shadowDepth}px rgba(0,0,0,0.25)`
```

**Cinematic zoom-to-focus:**
```tsx
// Camera push: scale up while fading surroundings
const zoom = interpolate(frame, [start, end], [1, 2.5], {/*clamp*/});
const surroundFade = interpolate(frame, [start, end-5], [1, 0], {/*clamp*/});
// Apply zoom to container, surroundFade to non-focal elements
```

**SVG path drawing:**
```tsx
// Animated path that draws itself
const pathLength = 500; // measure or estimate
const draw = interpolate(frame, [start, end], [pathLength, 0], {/*clamp*/});
<path d="..." strokeDasharray={pathLength} strokeDashoffset={draw} />
// Add glow duplicate underneath:
<path d="..." strokeDasharray={pathLength} strokeDashoffset={draw}
      stroke={color} strokeWidth={6} opacity={0.3} filter="url(#blur)" />
```

**Perspective for 3D feel:**
```tsx
// Container with perspective — child rotates in 3D space
<div style={{ perspective: 1200 }}>
  <div style={{ transform: `rotateX(${rx}deg) rotateY(${ry}deg)` }}>
    {content}
  </div>
</div>
```

**Gradient animation:**
```tsx
// Animated gradient angle for living surfaces
const angle = 135 + Math.sin(frame * 0.02) * 15;
background: `linear-gradient(${angle}deg, color1, color2, color3)`
```

**Typography hierarchy:**
```tsx
// Hero number: tight tracking, heavy weight, multi-layer shadow
{ fontSize: EH * 0.15, fontWeight: 800, letterSpacing: '-0.03em',
  textShadow: '0 2px 8px rgba(0,0,0,0.4), 0 0 40px rgba(accent, 0.3)' }
// Supporting label: wide tracking, lighter weight
{ fontSize: EH * 0.04, fontWeight: 500, letterSpacing: '0.08em',
  textTransform: 'uppercase' }
```

These patterns replace the current vague rules ("surfaces must feel alive") with concrete code the Animator can apply.

### Change 5: Animator — Raise idle animation minimums

Current idle values are invisible:
- Scale: `0.012` (1.2% — imperceptible)
- Float: `2px` (sub-pixel on most displays)
- Rotation: `0.5deg` (invisible)

New minimums:
- Scale breathe: `Math.sin(frame * 0.025) * 0.025` minimum (2.5%)
- Float: `Math.sin(frame * 0.03) * 5` minimum (5px)
- Rotation drift: `Math.sin(frame * 0.02) * 2` minimum (2 degrees)
- Glow pulse: `0.3 + Math.sin(frame * 0.04) * 0.15` minimum (visible range)

The existing Animator prompt has idle motion examples in its "Continuous Idle Motion" section (float: `* 3`, breathe: `* 0.015`, rotate: `* 1.5`). These example values should be **replaced** with the new minimums — not duplicated. Add a clear "Minimum Amplitudes" callout immediately after the idle motion examples:

> **Minimum amplitudes (below these = viewer cannot perceive it):**
> - Scale: `* 0.025` | Translate: `* 5` | Rotation: `* 2` | Glow: base `0.3`, amplitude `0.15`

### Change 6: Programmatic validation after Animator completes

#### Architecture

A new MCP tool `validate_animation_quality` is added to the `analysis` tool server in `packages/sandbox/src/tools/analysis-tools.ts`. The orchestrator's prompt (Phase 6) is updated to call this tool after each Animator subagent returns, before marking the scene as complete.

The tool accepts:
- `sceneFile`: path to the `.tsx` file
- `totalFrames`: the scene's frame count (from SCENE_PLAN.md time range)

It returns a structured JSON response:
```typescript
interface AnimationQualityResult {
  passed: boolean;
  warnings: Array<{
    check: 'frame_coverage' | 'property_variety' | 'idle_amplitude' | 'surface_treatment';
    message: string;  // Human-readable description for the orchestrator
    severity: 'warning' | 'error';
  }>;
}
```

The orchestrator uses this to decide whether to re-dispatch the Animator with fix instructions or accept the scene.

#### Parsing strategy

All checks use **regex-based parsing** of the `.tsx` source text. This is the pragmatic choice — the generated code follows predictable patterns (the Animator works from a skeleton with known import structure). AST parsing (e.g., via `ts-morph`) would be more robust but adds a heavy dependency for limited benefit.

Known limitation: if the Animator stores frame ranges in variables and references them indirectly, the regex won't resolve the values. This is acceptable — the check is a best-effort heuristic, not a compiler. False negatives (missing a violation) are preferable to false positives.

#### Check details

**a) Frame coverage:**
Extract `interpolate(frame, [A, B], ...)` patterns via regex. Collect all `[A, B]` ranges. Exclude ranges that appear inside idle patterns (identified by being inside a `Math.sin(...)` expression or having very small output ranges). Compute the union of active frame ranges. If the union covers less than 50% of `totalFrames`, emit a warning.

The 50% threshold is chosen because: Entrance (~15%) + Build (~25%) + Develop (~25%) + Payoff (~15%) + Exit (~10%) = ~90% in a well-phased scene. A scene at 50% is clearly missing mid-scene animation. This threshold avoids false positives on short scenes with legitimate sparse animation.

**b) Property variety:**
Regex-match the CSS properties being animated — look for `interpolate`/`spring` results assigned to or used in `opacity`, `translateX`, `translateY`, `scale`, `rotate`, `width`, `height`, `strokeDashoffset`, `color`/`fill`/`stroke` RGB values, `borderRadius`, `clipPath`. Count distinct properties. If fewer than 4, emit a warning.

**c) Idle amplitude check:**
Match `Math.sin(.*) * N` patterns. Extract `N`. Cross-reference with the property being animated (heuristic: if the containing expression includes `scale`, it's a scale amplitude; if it includes `translate`, it's a translate amplitude). Flag if below minimums.

**d) Surface treatment check:**
Match `background:` or `backgroundColor:` style assignments. If the value is a single `rgba(...)` or `rgb(...)` without `gradient`, `url(`, or multiple color values, flag it as a flat surface. Exclude elements that are clearly decorative (opacity < 0.2) or structural (width/height < 10px).

#### Orchestrator prompt addition (Phase 6)

After each Animator subagent returns and the scene file is written:
```
After each Animator completes, call `validate_animation_quality` with the scene file path and frame count.
If warnings are returned, re-dispatch the Animator with the specific warnings as fix instructions.
Maximum 1 quality fix round per scene — if the second attempt still has warnings, accept it and move on.
```

---

## Files Modified

| File | Change |
|------|--------|
| `packages/sandbox/src/prompts/planner/system.md` | Replace Animation Brief with Visual Concept + Animation Timeline. Add creative ambition guidance. Add anti-pattern list. Update `<per_scene_schema>`. Add 4 items to self-verification checklist. |
| `packages/sandbox/src/prompts/planner/examples/good-plan.md` | Full rewrite with phased timelines, creative concepts, mid-scene transforms |
| `packages/sandbox/src/prompts/animator/system.md` | Add "Techniques for Visual Richness" section with code patterns. Replace idle motion example values with new minimums. Add "Minimum Amplitudes" callout. |
| `packages/sandbox/src/prompts/orchestrator/system.md` | Add `validate_animation_quality` tool call after each Animator in Phase 6. Max 1 fix round per scene. |
| `packages/sandbox/src/tools/analysis-tools.ts` | New `validate_animation_quality` MCP tool with 4 regex-based checks (frame coverage, property variety, idle amplitude, surface treatment). Returns structured JSON. |

## Out of Scope

- Template system or component library — animations are designed from scratch each time
- Changes to the worker pipeline (Director/Animator in `packages/worker/`) — sandbox only
- Changes to the theme system or studio-theme.md
- New shared components or reusable animation modules
