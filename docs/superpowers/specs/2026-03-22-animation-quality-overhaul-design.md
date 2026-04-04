# Animation Quality Overhaul — Studio Theme

**Date:** 2026-03-22
**Scope:** Prompt rewrites for studio theme animation quality
**Goal:** Shift animation quality from SVG-density to typography-first restraint

## Problem

The AI animator produces complex but aesthetically poor animations because the prompts:
1. Mandate 3 simultaneous animation layers on every scene
2. Push hand-drawn SVG paths as the primary richness technique
3. Require continuous idle motion on every element (float, breathe, rotate, glow)
4. Treat simple/clean layouts as failures ("slideshow paranoia")
5. Measure animation density, not visual clarity

AI-generated SVG `<path d="...">` drawings are thin, malformed, and ugly. Layering icons + SVG paths + ambient motion + glowing borders creates visual noise, not quality.

## Reference Quality: Magazine Templates

The magazine templates (newspaper, inkmap, collage) succeed because:
- **Typography is the hero** — Playfair Display at 76-152px, tight kerning, strong weight contrast
- **Texture from surfaces** — paper grain, torn edges, newsprint filters (not SVG drawings)
- **Restraint** — 60%+ whitespace, decoration under 10% of viewport
- **Phase-based motion** — enter, build, hold (viewers read), exit
- **Stillness is confidence** — elements rest after entering, no fidgeting

## Design Principles

1. **One hero element per scene** — not 3 mandatory layers
2. **Typography IS the visual** — size, weight, spacing, color hierarchy
3. **No hand-drawn SVGs** — never write `<path d="...">` by hand
4. **Hold phases are mandatory** — content rests so viewers can read
5. **Fewer elements, better styled** — max 5 distinct animated elements per scene
6. **Cards are valid** — when well-styled and varied, not identical rectangles
7. **Whitespace is design** — empty space is a choice, not a failure

## SVG Rules

- **BANNED:** Hand-written `<path d="...">`, strokeDasharray path-draw animations, morphing shapes, hand-drawn connectors/arrows
- **ALLOWED:** `<circle>`, `<rect>`, `<line>` primitives for geometric patterns (dot grids, progress bars, dividers)
- **ALLOWED:** Downloaded Iconify icons via MCP tools — max 1-2 per scene, purposeful only
- **ALLOWED:** SVG filters (feTurbulence for texture, feColorMatrix for color grading)

## File Changes

### 1. `packages/worker/src/prompts/shared/motion-design-principles.md`

**Kill:**
- "Three Simultaneous Layers (MANDATORY)" section — replace with "One Hero + Typography Support"
- "A scene with ONLY a title fading in = amateur" — a well-animated title IS professional
- Hard rule 3: "Every scene MUST have ambient motion"
- Hard rule 4: "NEVER use same easing for adjacent elements" (over-prescriptive)

**Add:**
- "One Hero Element" principle: every scene has ONE primary focus. Everything else supports it through typography hierarchy, not additional animated objects.
- Hold phase in choreography: after elements enter, content holds still for 30-60 frames. Background may have subtle ambient motion. Content elements do NOT float/breathe/rotate during hold.

**Keep:**
- Disney principles (anticipation, follow-through, staging, exaggeration, clean motion)
- Overlapping action (opacity before transform)
- Stagger rhythm guidance
- Exit rules (faster than entrances, reverse hierarchy)

### 2. `packages/worker/src/prompts/shared/quality-checklist.md`

**Remove:**
- "3+ elements animating with different start times"
- "Ambient layer present and continuous (background never static)"
- "No frozen frames — persistent elements have micro-motion"
- "SVG connectors/paths use straight lines (M+L) only — no curves" (SVG connectors banned entirely now)

**Add:**
- "Hero element identifiable within 1 second of scene start"
- "Scene uses ≤5 distinct animated elements"
- "No hand-written `<path d>` — only `<circle>`, `<rect>`, `<line>` primitives and downloaded Iconify icons"

**Keep:**
- All entries pair opacity + transform
- Stagger delays vary
- Only palette colors used
- Spring damping >= 18
- extrapolateLeft AND extrapolateRight: 'clamp'
- inputRange strictly monotonically increasing
- TypeScript compiles
- Spring configs vary between adjacent elements
- Stroke/border minimums
- ≥2 different animation techniques across scenes
- Content vertically centered
- Visual technique varies from adjacent scenes
- Last sync animation completes 30+ frames before outro

### 3. `packages/sandbox/src/prompts/animator/system.md`

**Rewrite "Don't Make a Slideshow" section:**
- Shift from "needs more elements/SVG paths" to "needs better typography and motion"
- Quality signals become: strong type hierarchy, progressive reveals, varied entrances, deliberate whitespace, accent color used sparingly
- Cards are rehabilitated as valid when well-styled and varied
- Remove "Elements connected by drawn SVG paths" as quality signal
- Remove "Morphing shapes" as quality signal
- Keep "Progressive reveals" and "Kinetic typography"

**Kill "Continuous Idle Motion" section (lines 69-82):**
- Remove the 45-frame rule
- Remove mandatory float/breathe/rotate/glow on every element
- Replace with: "After entrance, elements rest. Stillness is confidence. Only background has subtle ambient motion."

**Rewrite "Surfaces Must Feel Alive" (lines 84-92):**
- Remove "at least TWO treatments" mandate
- Remove "static background is forbidden"
- Replace with: "Surfaces should be clean and purposeful. A solid background color with a subtle dot grid IS professional. Animated gradients and shimmer are optional, not required."

**Ban hand-drawn SVG paths:**
- Add explicit rule in Remotion Coding Rules section
- Remove SVG path drawing code examples (lines 207-222)
- Remove straight-line connector code example (lines 173-183)

**Rewrite scene type table:**
- step-cards: staggered cards with varied entrances, large numbers, no SVG connectors
- flowchart: sequential reveals, large step titles, simple `<line>` between steps
- data-viz: hero number large (15%+ scene height), `<rect>` bar charts, counting numbers
- timeline: events staggered vertically, `<line>` divider, date/title prominent
- hierarchy: size hierarchy (root largest, children smaller), not drawn tree lines
- cause-effect: cause/effect on opposite sides, simple `<line>` arrow, color contrast
- custom: lead with typography, ≤4 elements, Iconify icon if content demands

**Keep:**
- Skeleton workflow
- Display mode rules (overlay, stacked, fullscreen)
- Remotion coding rules (all of them)
- Self-healing (tsc + render_still)
- Techniques: texture/grain SVG filters, structured dot grid, depth shadows, typography hierarchy, gradient animation, perspective

### 4. `packages/worker/src/prompts/themes/studio/design-system.md`

**Kill:**
- RULE 4 ("No emoji as content" → pushes SVG) — replace with "Use Iconify icons when visual needed"
- RULE 5 ("No placeholder SVG shapes" → forces complex `<path d>`) — replace with "Clean geometric primitives (`<circle>`, `<rect>`, `<line>`) preferred over complex SVG"
- "VISUAL CONTENT HIERARCHY (MANDATORY)" 3-layer table — replace with typography-first guidance
- "Plain Divs as Illustrations" anti-pattern — well-styled divs are valid
- "Text-Only Scene" anti-pattern — typography-driven scenes are valid
- "CONTINUOUS MOTION RECIPES" table — content elements don't float/breathe/rotate during hold
- "Over-Animated Text" anti-pattern wording — keep the spirit but soften (text gets clean animation, not no animation)

**Rewrite "WHAT NOT TO BUILD":**
- Keep: "Decorative Icons" (icons need labels), "Caption Duplication", "Empty Frames"
- Soften: "Every Scene in a Card" → "Don't use identical card styles. Vary treatments."
- Remove: "Text-Only Scene", "Plain Divs as Illustrations"
- Add: "Hand-drawn SVG paths — never write `<path d>` by hand. Use Iconify or geometric primitives."

**Keep everything else:**
- Theme colors, font system, dot grid background, responsive scaling, card container styles, accent transparency convention, animation lifecycle (intro → activation → hold → outro), spring configs, stroke/border minimums, rendering rules, sync coverage

### 5. `packages/worker/src/prompts/references/common-patterns.md`

**Remove:**
- Ball physics simulation
- Shake effect

**Keep:**
- Responsive sizing helper
- Standard color palettes
- Spring configs by style
- Layout structure

### 6. `packages/worker/src/prompts/animator/system.md` (worker copy)

Same philosophy changes as sandbox animator — ban SVG paths, typography-first, hold phases, rehabilitate cards, kill idle motion mandate. Specific sections to update:
- `VISUAL LAYERS` in REASONING template — remove "animated SVG illustration, path-drawing animation, morphing shape" as Layer 1 options
- Replace with typography-first guidance matching the sandbox version
- Update any code examples that show hand-drawn SVG paths

### 7. `packages/worker/src/prompts/director/system.md`

The Director plans scenes the Animator builds. If the Director keeps planning SVG-heavy scenes, the Animator can't follow the new philosophy.

**Update `<motion_design_planning>` section:**
- Remove "SVG path drawing, shape morphing" from core techniques list
- Remove "No content is too abstract — SVG path draws"
- Replace with typography-first techniques: "kinetic typography, counting numbers, progress bars, clean geometric layouts, Iconify icons"

**Update technique table:**
- Remove `path-drawing` (SVG strokeDasharray)
- Remove `shape-morph`
- Remove `svg-illustration`
- Remove `animated-diagram` (nodes + connecting lines drawing)
- Keep: `kinetic-typography`, `counter`, `progress-bar`, `comparison-layout`
- Add: `typography-hierarchy` (size/weight contrast as the primary visual), `icon-accent` (single Iconify icon supporting text)

**Update `<visual_decomposition>` section:**
- Remove SVG paths as a decomposition option
- Align with the new "one hero + typography" philosophy

### 8. `packages/worker/src/prompts/themes/studio/director-style.md`

**Rewrite technique table:**
- Remove: "SVG path drawing", "Shape morphing", "Full-scene SVG", "Animated diagram"
- Replace with: "Kinetic typography", "Counting numbers", "Progress/bar charts", "Icon accent (Iconify)", "Typography hierarchy"
- Update the opening line from "The Animator has a rich toolkit: SVG path-drawing, shape morphing..." to reflect the new typography-first toolkit

### 9. `packages/worker/src/prompts/shared/vocabulary.md`

**Redefine `draw-in`:**
- Current: "SVG path draws progressively" for "Diagrams, connections, flow lines"
- New: "Element extends progressively using `<line>` primitives or width/height interpolation" — no SVG path drawing

**Review all vocabulary entries** for SVG-specific language and update to match the new approach.

### 10. `packages/sandbox/src/tools/animation-quality.ts`

Automated validator that enforces old rules. Two checks directly contradict the new philosophy:

**Update `checkIdleAmplitude`:**
- Current: validates Math.sin idle motion amplitudes meet minimum thresholds
- New: remove or disable this check. Content elements resting is correct behavior, not a failure.

**Update `checkSurfaceTreatment`:**
- Current: flags flat rgba backgrounds as failures ("Surfaces need at least 2 animated treatments")
- New: remove or relax. A solid background + dot grid IS professional.

### 11. `packages/worker/src/prompts/themes/studio/dark/style-guide.md` + `light/style-guide.md`

Both files echo the old philosophy:

**Remove/update:**
- "SVG illustrations, path-drawing animations, kinetic typography, morphing shapes" — remove SVG/morphing references, keep kinetic typography
- "No frozen frames — add micro-motion (0.5% scale oscillation) to persistent elements" — remove, elements can rest

### 12. `packages/worker/src/prompts/shared/motion-design-principles.md` — additional sections

Beyond the kills listed in section 1, these sections also need updating:

**Rewrite `<visual_hierarchy>` (60-30-10 Rule):**
- Remove "NEVER static" from the 60% dominant description
- Change to: "60% dominant — background. Clean solid color or subtle dot grid. Animated gradients optional, not required."

**Rewrite `<few_shot>` example:**
- Current GOOD example reinforces 3-layer thinking ("3 layers active simultaneously", "Accent line draws", "Dot grid pulses")
- New GOOD example should show typography-first restraint: hero text with strong size/weight, clean entrance, hold phase, maybe one Iconify icon

**Update choreography phases:**
- Remove "Phase 1 (ambient) runs continuously through ALL phases"
- Add explicit HOLD phase between STAGGER and EXIT where content rests

## Out of Scope

- Magazine theme templates (separate system, already high quality)
- Planner prompt (already updated for template browsing in previous change)
- Remotion coding rules (no changes to interpolate/spring/clamp rules)
- Spring configs (no changes)
- Template registry system (no changes)
