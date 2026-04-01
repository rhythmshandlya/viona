# Animation Quality Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite animation prompts to shift from SVG-density to typography-first restraint across the studio theme pipeline.

**Architecture:** 12 files across worker prompts, sandbox prompts, and one TypeScript validator. All changes are prompt/markdown rewrites except the animation-quality.ts validator which is TypeScript. No runtime behavior changes beyond the validator relaxation.

**Tech Stack:** Markdown prompt files, TypeScript (animation-quality.ts)

**Spec:** `docs/superpowers/specs/2026-03-22-animation-quality-overhaul-design.md`

---

### Task 1: Rewrite motion-design-principles.md (core philosophy)

**Files:**
- Modify: `packages/worker/src/prompts/shared/motion-design-principles.md`

- [ ] **Step 1: Replace `<motion_mindset>` section**

Replace lines 3-25 (from `## Think Like a Motion Designer` through `</motion_mindset>`) with:

```markdown
<motion_mindset>
## Think Like a Motion Designer

Every movement communicates. No decorative motion.

Before animating ANY element, answer three questions:
1. What is this element's ROLE? (hero content, supporting text, background)
2. What should the viewer FEEL? (confident, energetic, dramatic, playful)
3. Where should they LOOK NEXT? (guides eye to the next beat)

### One Hero Element (MANDATORY)

Every scene has ONE primary focus — the element the viewer's eye goes to first. Everything else supports it through typography hierarchy, not additional animated objects.

| Role | What it is | Example |
|------|-----------|---------|
| **Hero** | The single focal element. Large, bold, first to enter. | Hero stat counting up, bold title, key term |
| **Support** | Typography that contextualizes the hero. Smaller, lighter weight. | Subtitle, label, description text |
| **Background** | Subtle ambient texture. Optional, not mandatory. | Dot grid at low opacity, solid color fill |

A well-animated title with strong size/weight hierarchy IS professional.
Adding SVG illustrations, drawn connectors, and morphing shapes to compensate for weak typography IS amateur.
</motion_mindset>
```

- [ ] **Step 2: Update `<choreography>` section**

Replace lines 46-58 (the choreography section) with:

```markdown
<choreography>
## Choreography Phases (Every Scene)

` ` `
Phase 1 (frame 0-15):     ENTRANCE   — Hero element enters (title, main visual)
Phase 2 (frame 8-30):     SUPPORT    — Supporting text/elements stagger in (6-12 frame gaps)
Phase 3 (frame 30 to dF-30): HOLD    — Content rests. Viewer reads. Background may pulse subtly. Content does NOT float/breathe/rotate. Hero glow/shadow may pulse subtly.
Phase 4 (last 15-30 frames): EXIT    — Elements depart in reverse hierarchy
` ` `

The HOLD phase is where your scene earns its keep. If content moves during hold, the viewer can't read it. Stillness is confidence — fidgeting is amateur.
</choreography>
```

- [ ] **Step 3: Update `<visual_hierarchy>` section**

Replace lines 60-68 with:

```markdown
<visual_hierarchy>
## Visual Hierarchy

- **Hero element** — largest, boldest, highest contrast. The ONE thing the viewer looks at first.
- **Supporting text** — smaller, lighter weight, secondary color. Contextualizes the hero.
- **Background** — clean solid color or subtle dot grid. Animated gradients optional, not required.

Hierarchy by impact: Size > Color/Contrast > Weight > Position > Motion Speed
</visual_hierarchy>
```

- [ ] **Step 4: Rewrite `<few_shot>` example**

Replace lines 70-94 with:

```markdown
<few_shot>
## Developer Animation vs Motion Design

BAD (developer animation):
` ` `
- Title fades in at frame 0 (opacity only)
- Subtitle fades in at frame 10 (opacity only)
- Icon fades in at frame 20 (opacity only)
- All use same easing, same duration
- Background is static
` ` `

GOOD (motion design):
` ` `
- Hero number scales 1.1→1.0 with SMOOTH spring + opacity + translateY (frame 0)
- Supporting label slides up with SNAPPY spring + fade, different timing (frame 10)
- Subtitle fades in with gentle ease, lighter weight, secondary color (frame 18)
- Content holds still for 60 frames — viewer reads the information
- Exit: elements fade + drift down in reverse order (last 15 frames)
` ` `

The difference: strong typography hierarchy (3:1 size ratio hero vs support), varied easing per element, generous hold phase, every movement serves a purpose.
</few_shot>
```

- [ ] **Step 5: Update `<hard_rules>` section**

Replace lines 96-107 with:

```markdown
<hard_rules>
## Hard Rules (Non-Negotiable)

1. Minimum 6-frame stagger between sequential entrances
2. ALWAYS offset opacity from position/scale by 3-6 frames (overlapping action)
3. ALWAYS pair opacity + transform for entrances (opacity-only = amateur)
4. Exits are 75% the duration of entrances (faster out than in)
5. Exit in REVERSE hierarchy order (last in = first out)
6. NEVER write `<path d="...">` by hand — use `<circle>`, `<rect>`, `<line>` primitives or downloaded Iconify icons only
</hard_rules>
```

- [ ] **Step 6: Commit**

```bash
git add packages/worker/src/prompts/shared/motion-design-principles.md
git commit -m "refactor(prompts): replace 3-layer mandate with typography-first philosophy"
```

---

### Task 2: Update quality-checklist.md

**Files:**
- Modify: `packages/worker/src/prompts/shared/quality-checklist.md`

- [ ] **Step 1: Update `<scene_checklist>` section**

Remove these lines:
- `- [ ] 3+ elements animating with different start times`
- `- [ ] Ambient layer present and continuous (background never static)`
- `- [ ] No frozen frames — persistent elements have micro-motion`
- `- [ ] Elements visible 30+ frames have ambient motion (breathe/glow pulse — NO random floating particles)`
- `- [ ] SVG connectors/paths use straight lines (M+L) only — no curves (C/Q/A/S)`

Add these lines (after the existing items):
- `- [ ] Hero element identifiable within 1 second of scene start`
- `- [ ] Scene uses ≤5 distinct animated elements (fewer = better)`
- `- [ ] No hand-written <path d> — only <circle>, <rect>, <line> primitives and downloaded Iconify icons`
- `- [ ] Content holds still during hold phase (no float/breathe/rotate on text or content elements)`

- [ ] **Step 2: Update `<plan_checklist>` section**

Replace:
- `- [ ] LAYER TEST: Each description addresses background + primary element + motion?`

With:
- `- [ ] HERO TEST: Each scene has ONE clear hero element with strong typography hierarchy?`

- [ ] **Step 3: Commit**

```bash
git add packages/worker/src/prompts/shared/quality-checklist.md
git commit -m "refactor(prompts): update quality checklist for typography-first approach"
```

---

### Task 3: Rewrite sandbox animator system.md

**Files:**
- Modify: `packages/sandbox/src/prompts/animator/system.md`

- [ ] **Step 1: Rewrite "Don't Make a Slideshow" section (lines 31-51)**

Replace the current section with:

```markdown
## CRITICAL — Don't Make It Boring

Your #1 failure mode is producing weak visuals — thin SVG line drawings, cluttered layers, everything jittering. The fix is NOT more elements. It's better typography and motion.

What makes something feel like quality motion design:
- Strong typography hierarchy — hero text 3x larger than supporting text, bold weight vs light weight
- Progressive reveals that follow a spatial narrative (top-to-bottom, left-to-right)
- Kinetic typography where text IS the visual, not text in a box
- Deliberate whitespace — empty space is a design choice, not a failure
- One accent color used sparingly for emphasis (not on everything)

What makes something feel amateur:
- Hand-drawn SVG paths (thin, malformed, disproportionate)
- Everything moving at once (float, breathe, rotate, glow on every element)
- Layering clutter (icons + paths + dots + glows + borders stacked together)
- Identical cards for every scene

Cards are a valid pattern when well-styled (shadows, rounded corners, accent borders). The problem isn't cards — it's identical cards with no motion variety. Vary entrance directions, spring configs, and content hierarchy across cards.
```

- [ ] **Step 2: Replace "Continuous Idle Motion" section (lines 69-82)**

Replace with:

```markdown
### 2. Stillness After Entrance

After an element enters, it RESTS. The viewer needs to read the content. Stillness is confidence — fidgeting is amateur.

- **Content elements** (text, cards, icons): stay still after entrance. No float, no breathe, no rotate.
- **Background only**: may have subtle ambient motion (dot grid pulse at opacity 0.08-0.15, slow gradient shift). This is optional, not required.

**A static background with good typography is professional. A moving background with bad typography is amateur.**
```

- [ ] **Step 3: Replace "Surfaces Must Feel Alive" section (lines 84-92)**

Replace with:

```markdown
### 3. Clean Surfaces

Surfaces should be clean and purposeful:
- A solid background color with a subtle dot grid IS professional
- Animated gradients and shimmer are optional, not required
- Depth via box-shadow (animate shadow in over 15 frames for polish)
- Cards with proper border-radius, padding, and shadow are valid containers

Surfaces are NOT the star — they're containers. The real visual interest comes from typography hierarchy: size contrast, weight contrast, letter-spacing, color.
```

- [ ] **Step 4: Replace "Visual Density and Layering" section (lines 105-130)**

Replace with:

```markdown
### 5. Restraint and Focus

A great scene has ONE hero element, not layers of competing visuals:
- **Hero element** — the largest, boldest thing on screen. A number, a title, a key term.
- **Supporting text** — smaller, lighter, secondary color. 1-2 lines max.
- **Background** — solid color or subtle dot grid. Optional gradient.
- **Max 5 animated elements total** — fewer is better.

**BANNED:** Random floating particles, scattered circles, organic particle effects. These look cheap.

Even a "simple" 3-step scene only needs:
- The 3 steps revealed as styled cards or bold text, staggered with varied entrances
- Each step with a number/icon and label
- A hold phase where the viewer reads
- Clean exit in reverse order
```

- [ ] **Step 5: Ban hand-drawn SVGs in Remotion Coding Rules (after line 307)**

Add this rule to the existing Remotion Coding Rules section:

```markdown
- **No hand-drawn SVG paths:** NEVER write `<path d="...">` by hand. AI-generated SVG paths look thin, malformed, and amateur. Use ONLY: `<circle>`, `<rect>`, `<line>` primitives for geometric patterns (dot grids, progress bars, dividers). Use downloaded Iconify icons (via MCP tools) when you need a visual symbol — max 1-2 per scene. SVG filters (feTurbulence, feColorMatrix) are allowed for textures.
```

- [ ] **Step 6: Remove SVG path drawing code examples (lines 207-222)**

Remove the "SVG path drawing (STRAIGHT lines only)" code block and replace with:

```markdown
**Typography hierarchy:**
` ` `tsx
// Hero: large, bold, tight tracking
{ fontSize: SCENE_HEIGHT * 0.12, fontWeight: 800, letterSpacing: '-0.02em',
  color: COLORS.text }
// Support: smaller, lighter, wider tracking
{ fontSize: SCENE_HEIGHT * 0.035, fontWeight: 500, letterSpacing: '0.06em',
  textTransform: 'uppercase', color: COLORS.textMuted }
// Size ratio should be at least 3:1 between hero and support text
` ` `
```

- [ ] **Step 7: Remove straight-line connector code example (lines 173-183)**

Remove the "Straight-line connector between elements" code block. Replace with:

```markdown
**Simple divider line:**
` ` `tsx
// Clean horizontal or vertical divider using <line> primitive
<svg width={SCENE_WIDTH} height={2} style={{ position: 'absolute' }}>
  <line x1={0} y1={1} x2={lineWidth} y2={1}
    stroke={COLORS.textMuted} strokeWidth={SCENE_WIDTH * 0.003} opacity={0.3} />
</svg>
` ` `
```

- [ ] **Step 8: Rewrite scene type table (lines 253-268)**

Replace the scene type table with:

```markdown
| Type | Visual Approach |
|------|----------------|
| **step-cards** | Staggered cards with VARIED entrances (one from left, one scaling up, one from right). Number large and bold, label beneath. Vary card styles across steps — some with accent borders, some with gradient tint. |
| **comparison** | Side-by-side panels that slide in from opposite edges. Color contrast between sides. Items stagger within panels. Clean divider between sides. |
| **flowchart** | Steps revealed sequentially. Large step number/title as hero, supporting text below. Simple `<line>` primitive between steps if needed — no SVG path drawing. |
| **data-viz** | Hero number LARGE (15%+ of scene height) with counting animation. `<rect>` bar charts or progress bars. Glow pulse on peak values. Clean, geometric. |
| **definition** | Term enters BOLD and large (hero). Definition text fades in line-by-line below (support). Optional accent color on the term. Typography IS the visual. |
| **timeline** | Events staggered vertically with varied entrances. Simple `<line>` divider between events. Date/title large, description smaller. |
| **hierarchy** | Root item largest (hero), children indented and smaller. Visual hierarchy through size and weight, not drawn tree lines. |
| **cause-effect** | Cause large on one side, effect on the other. Simple `<line>` arrow between them. Color shift from cause-color to effect-color. |
| **progress** | Animated progress bar using `<rect>` primitives. Value counts up. Clean geometric fill animation. Label appears after value settles. |
| **custom** | Lead with typography. Use an Iconify icon if content demands visual representation. Keep composition to ≤4 elements. |
```

- [ ] **Step 9: Commit**

```bash
git add packages/sandbox/src/prompts/animator/system.md
git commit -m "refactor(prompts): rewrite sandbox animator for typography-first quality"
```

---

### Task 4: Rewrite studio design-system.md

**Files:**
- Modify: `packages/worker/src/prompts/themes/studio/design-system.md`

- [ ] **Step 1: Replace RULE 4 and RULE 5**

Replace RULE 4 ("No emoji as content") with:
```markdown
**RULE 4: Use Iconify icons when visual representation needed**
Download icons via MCP icon tools. Max 1-2 icons per scene, each paired with a text label. Never use emoji as content. Never hand-draw SVG paths.
```

Replace RULE 5 ("No placeholder SVG shapes") with:
```markdown
**RULE 5: Clean geometric primitives preferred**
Use `<circle>`, `<rect>`, `<line>` for geometric patterns (dot grids, progress bars, dividers). These are clean and intentional. Never write `<path d="...">` by hand — AI-generated SVG paths look thin and amateur.
```

- [ ] **Step 2: Replace VISUAL CONTENT HIERARCHY section**

Replace the entire "VISUAL CONTENT HIERARCHY (MANDATORY)" section (Layer 1/2/3 table and the "Best Techniques" table) with:

```markdown
### VISUAL CONTENT HIERARCHY (MANDATORY)

The hero element for most scenes is **typography** — a large number, a bold statement, a key term. Support it with color, spacing, and one Iconify icon if the content requires visual representation.

**Don't illustrate what can be communicated through text hierarchy.**

| Concept | Hero approach | Avoid |
|---------|--------------|-------|
| Number/stat | Large animated counter (15%+ scene height) | Small number in a card |
| Comparison | Bold labels with color contrast per side | Complex diagrams |
| Process/Steps | Large step numbers + titles, staggered | SVG flowchart arrows |
| Data trend | Animated `<rect>` bar chart or progress bar | Complex radial charts |
| Hook/Bold claim | Large kinetic typography | Small text in a card |
| Definition | Bold term + lighter definition text | Decorative illustrations |

**Typography is ONE option, not the only option.** Use Iconify icons and `<rect>`/`<circle>` charts when data visualization genuinely serves the content. But default to typography, not illustration.
```

- [ ] **Step 3: Remove CONTINUOUS MOTION RECIPES table**

Replace the "CONTINUOUS MOTION RECIPES" section with:

```markdown
### HOLD PHASE (content rests)

During the hold phase, content elements stay STILL so the viewer can read:
- **Cards, text, icons**: no float, no breathe, no rotate. Static after entrance.
- **Background dot grid**: may pulse subtly (opacity 0.08-0.15 via Math.sin). This is optional.
- **Glow/shadow**: may pulse subtly on the hero element only (amplitude 0.1 opacity range max).

The hold phase should be generous — 30-60 frames minimum of still content between entrance and exit.
```

- [ ] **Step 4: Rewrite WHAT NOT TO BUILD section**

Keep: "Decorative Icons", "Caption Duplication", "Empty Frames", "Same Visual Pattern Repeated"

Remove: "Text-Only Scene", "Plain Divs as Illustrations"

Replace "Every Scene in a Card" with:
```markdown
**Identical Cards:** Don't use the same card style in every scene. Vary treatments: some with accent borders, some with gradient backgrounds, some open (no card at all). The variety of visual structure prevents the "PowerPoint" feel.
```

Replace "Over-Animated Text" with:
```markdown
**Over-Animated Text:** Text gets clean entrance animation (spring + opacity + translateY). Save dramatic springs for hero numbers. Text should NOT bounce, rotate, or have particle effects.
```

Add:
```markdown
**Hand-drawn SVG Paths:** NEVER write `<path d="...">` by hand. AI-generated SVG paths are thin, malformed, and ugly. Use Iconify icons (via MCP) for visual symbols. Use `<circle>`, `<rect>`, `<line>` for geometric shapes. Use SVG filters for textures.
```

Remove "SVG Quality Threshold" paragraph.

- [ ] **Step 5: Commit**

```bash
git add packages/worker/src/prompts/themes/studio/design-system.md
git commit -m "refactor(prompts): rewrite studio design system for typography-first approach"
```

---

### Task 5: Clean up common-patterns.md

**Files:**
- Modify: `packages/worker/src/prompts/references/common-patterns.md`

- [ ] **Step 1: Remove Ball Physics Simulation**

Remove the entire "Ball Physics Simulation" section (the `simulateBallPhysics` function and surrounding comments).

- [ ] **Step 2: Remove Shake Effect**

Remove the entire "Shake Effect (Stress Indicator)" section.

- [ ] **Step 3: Commit**

```bash
git add packages/worker/src/prompts/references/common-patterns.md
git commit -m "refactor(prompts): remove ball physics and shake effect patterns"
```

---

### Task 6: Update worker animator system.md

**Files:**
- Modify: `packages/worker/src/prompts/animator/system.md`

- [ ] **Step 1: Replace VISUAL LAYERS in REASONING template (lines 70-73)**

Replace:
```
- Layer 1 (Primary): the VISUAL that carries the segment's meaning — animated SVG illustration, path-drawing animation, morphing shape, data visualization, kinetic typography, or diagram. NOT just a card with text.
- Layer 2 (Supporting): labeled icons, annotations, connecting elements
- Layer 3 (Ambient): ambient texture (gradient drift, glow pulse, structured dot grid pulse) at opacity <= 0.20
```

With:
```
- Hero: the ONE focal element — large typography, animated counter, bold key term, or data visualization. Default to typography.
- Support: smaller text that contextualizes the hero — subtitle, label, description. Lighter weight, secondary color.
- Background: solid color or subtle dot grid. Optional gradient. NOT mandatory animated.
```

- [ ] **Step 2: Remove SVG path drawing recipe (lines 494-505)**

Remove the "SVG Path Drawing (strokeDasharray)" code block. Replace with a typography hierarchy example matching Task 3 Step 6.

- [ ] **Step 3: Remove shape morphing recipe (lines 507-516)**

Remove the "Shape Morphing (cross-fade + scale)" code block entirely.

- [ ] **Step 4: Remove SVG stroke draw recipe (lines 876-885)**

Remove the `evolvePath` based stroke draw recipe.

- [ ] **Step 5: Update continuous motion recipes (lines 473-486)**

Replace with the same hold phase guidance from Task 4 Step 3 — content rests, only background may pulse subtly.

- [ ] **Step 6: Update PROHIBITED PATTERNS (line 462)**

Replace "Curved SVG paths for connectors — Use straight line segments (M + L)" with:
```
Hand-drawn SVG paths — NEVER write `<path d="...">` by hand. Use `<circle>`, `<rect>`, `<line>` primitives or downloaded Iconify icons only.
```

- [ ] **Step 7: Update overlay idle motion guidance (line 362)**

Replace "Gentle entrance + living idle. Fade-in 15-25 frames with gentle spring... elements have subtle idle animation: scale breathing... or Y float... Elements are never frozen." with:
```
Gentle entrance. Fade-in 15-25 frames with gentle spring (damping >= 28, stiffness <= 60). After settling, elements rest — no scale breathing, no Y float. Stillness makes overlays feel confident, not distracting.
```

- [ ] **Step 8: Update "Plain colored divs" prohibited pattern (line 457)**

Replace "If you need a visual object, build it with detailed SVG paths, animated strokes, or download via MCP." with:
```
If you need a visual object, download a professional icon via MCP tools, or use <circle>, <rect>, <line> primitives. A well-styled div with typography, shadows, and animation IS a valid visual element.
```

- [ ] **Step 9: Update "Text-only scenes" prohibited pattern (line 460)**

Replace "Every scene needs a VISUAL element: animated SVG, path-draw, morph, diagram, data-viz, or illustration." with:
```
Typography-driven scenes ARE valid when the text has strong hierarchy (3:1 size ratio hero vs support, weight contrast, accent color). A scene needs visual interest, but typography IS visual interest.
```

- [ ] **Step 10: Commit**

```bash
git add packages/worker/src/prompts/animator/system.md
git commit -m "refactor(prompts): rewrite worker animator for typography-first quality"
```

---

### Task 7: Update director system.md

**Files:**
- Modify: `packages/worker/src/prompts/director/system.md`

- [ ] **Step 1: Update motion design planning section (lines 36-47)**

Replace lines 36-47 (starting from "Each scene description should address ALL THREE motion layers"). Change the three-layer mandate to "one hero element + supporting typography." Change the "Primary element" description from "SVG path drawing, shape morphing, kinetic typography cascade, animated diagram" to:
```
This should be a VISUAL TECHNIQUE: kinetic typography, animated counter, progress bar, clean geometric layout, or Iconify icon accent. Default to typography — large, bold text with strong size/weight hierarchy IS the visual. Plan ≤5 animated elements per scene.
```

- [ ] **Step 2: Update technique table (lines 393-403)**

Replace the valid technique list. Remove: `path-drawing`, `shape-morph`, `svg-illustration`, `animated-diagram`.

New list:
```
card-data, typography-hierarchy, kinetic-typography, counter, progress-bar, split-composition, dot-grid-pulse, data-viz, icon-accent, comparison-layout
```

- [ ] **Step 3: Update visual technique references (lines 28-29)**

Replace "SVG illustration, path drawing, kinetic typography, shape morphing, animated diagrams" with:
"kinetic typography, animated counters, progress bars, typography hierarchy, Iconify icon accents, clean geometric data-viz"

- [ ] **Step 4: Update JSON example in `<output_format>` section (around lines 321-344)**

Replace any `"technique": "path-drawing"` or `"technique": "animated-diagram"` examples with valid new technique values like `"technique": "typography-hierarchy"` and `"technique": "counter"`.

- [ ] **Step 5: Update `<visual_decomposition>` section (lines 406-438)**

Remove references to `morph-collapse` and `exploded-view` from the technique list at line 437. Replace with vocabulary entries that are still valid (e.g., `converge-to-point`, `mask-reveal`, `parallax-layers`, `zoom-transition`, `spotlight-focus`).

- [ ] **Step 6: Update `<visual_metaphors>` table (lines 474-501)**

Replace SVG-heavy technique references:
- "Shape morph, color-shift transition" → "Color-shift transition, scale transform"
- "SVG path-drawing between nodes" → "Large step numbers + titles, staggered with `<line>` connectors"
- "SVG morph (shape A → shape B)" → "Cross-fade with scale transform"
- "Full-scene SVG illustration" → "Large kinetic typography, Iconify icon accent"
- Remove `morph-collapse` and `exploded-view` references, replace with valid vocabulary entries

- [ ] **Step 7: Commit**

```bash
git add packages/worker/src/prompts/director/system.md
git commit -m "refactor(prompts): update director to plan typography-first scenes"
```

---

### Task 8: Rewrite director-style.md

**Files:**
- Modify: `packages/worker/src/prompts/themes/studio/director-style.md`

- [ ] **Step 1: Update opening description (line 2)**

Replace "The Animator has a rich toolkit: SVG path-drawing, shape morphing, kinetic typography, animated diagrams, data visualization, AND card-based templates." with:
```
The Animator's toolkit prioritizes typography and clean motion: kinetic typography, animated counters, progress bars, Iconify icon accents, data visualization, and card-based templates. NO hand-drawn SVG paths.
```

- [ ] **Step 2: Rewrite visual techniques table (lines 18-31)**

Replace the technique table. Remove: "SVG path drawing", "Shape morphing", "Full-scene SVG", "Animated diagram".

New table:

```markdown
| Technique | When to plan it | Description |
|-----------|----------------|-------------|
| Typography hierarchy | Default for most scenes | Hero text 3x larger than support, bold vs light weight, tight vs wide spacing |
| Kinetic typography | Hooks, bold claims, emotional beats | Text IS the animation — words scale, reveal word-by-word, or cascade |
| Counter / data-viz | Stats, percentages, trends | Large animated number + `<rect>` bar chart or progress bar |
| Icon accent | Concepts needing visual symbol | Single Iconify icon paired with text label, max 1-2 per scene |
| Card + data | Structured data, comparisons | Well-styled cards with varied treatments (accent border, gradient tint, etc.) |
| Split composition | Before/after, comparison | Two panels from opposite sides with color contrast |
| Structured dot pulse | Ambient background | Dot grid at 0.08-0.15 opacity, optional subtle pulse |
```

- [ ] **Step 3: Commit**

```bash
git add packages/worker/src/prompts/themes/studio/director-style.md
git commit -m "refactor(prompts): update director style guide for typography-first approach"
```

---

### Task 9: Update shared vocabulary.md

**Files:**
- Modify: `packages/worker/src/prompts/shared/vocabulary.md`

- [ ] **Step 1: Redefine `draw-in`**

Replace `draw-in: SVG path draws progressively` with:
```
draw-in: Element extends progressively using <line> primitives or width/height interpolation — NOT SVG path drawing
```

- [ ] **Step 2: Remove or update SVG-heavy entries**

Remove `morph-collapse` (references shape morphing). Update `orbit-float` to note it's deprecated in favor of stagger-cascade. Remove `exploded-view` (implies complex SVG assembly).

- [ ] **Step 3: Update scene archetypes table (lines 50-66)**

Update `process-flow` archetype from "draw-in connections" to "stagger-cascade steps with `<line>` connectors". Update `data-chart` from "draw-in axes" to "`<line>` axes, fill-progress bars".

- [ ] **Step 4: Commit**

```bash
git add packages/worker/src/prompts/shared/vocabulary.md
git commit -m "refactor(prompts): update animation vocabulary to remove SVG path references"
```

---

### Task 10: Update animation-quality.ts validator

**Files:**
- Modify: `packages/sandbox/src/tools/animation-quality.ts`

- [ ] **Step 1: Disable checkIdleAmplitude (lines 117-155)**

Comment out or remove the body of `checkIdleAmplitude`. Content elements resting is correct behavior under the new philosophy. Replace with a no-op that returns no warnings:

```typescript
// Idle amplitude check removed — content elements should rest after entrance.
// Only background ambient motion is expected, and it's optional.
```

- [ ] **Step 2: Relax checkSurfaceTreatment (lines 161-192)**

Change the check to only warn if there is NO background at all (not even a solid color), instead of requiring "2 animated treatments". Update the warning message to:

```typescript
message: 'Scene has no background styling. Add at least a solid background color. Animated gradients are optional.'
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty false` from `packages/sandbox/`
Expected: no errors in animation-quality.ts

- [ ] **Step 4: Commit**

```bash
git add packages/sandbox/src/tools/animation-quality.ts
git commit -m "refactor(validator): relax animation quality checks for typography-first approach"
```

---

### Task 11: Update dark and light style guides

**Files:**
- Modify: `packages/worker/src/prompts/themes/studio/dark/style-guide.md`
- Modify: `packages/worker/src/prompts/themes/studio/light/style-guide.md`

- [ ] **Step 1: Update dark style guide**

Find and replace any lines referencing "SVG illustrations, path-drawing animations, morphing shapes" — keep only "kinetic typography" from that list.

Find and remove "No frozen frames — add micro-motion" rule. Elements can rest.

- [ ] **Step 2: Update light style guide**

Same changes as dark style guide.

- [ ] **Step 3: Commit**

```bash
git add packages/worker/src/prompts/themes/studio/dark/style-guide.md packages/worker/src/prompts/themes/studio/light/style-guide.md
git commit -m "refactor(prompts): update studio style guides to remove SVG/idle motion mandates"
```

---

### Task 12: Final verification pass

- [ ] **Step 1: Grep for remaining SVG path references**

Run: `grep -r "path-drawing\|shape.morph\|svg.illustration\|animated-diagram\|morph-collapse\|exploded-view\|Full-scene SVG\|orbit-float\|<path d\|strokeDasharray\|strokeDashoffset\|draw-in.*SVG\|morphing shape\|hand-coded SVG\|NEVER static\|never static\|idle.motion\|never frozen\|No frozen" packages/worker/src/prompts/ packages/sandbox/src/prompts/ --include="*.md" --include="*.ts" -l`

Any hits in modified files = missed edits. Fix them.

- [ ] **Step 2: Grep for "Three Simultaneous Layers" or "3 layers"**

Run: `grep -ri "three simultaneous\|3 layers\|three layers\|mandatory.*layer" packages/worker/src/prompts/ packages/sandbox/src/prompts/ --include="*.md" -l`

Should return 0 results.

- [ ] **Step 3: Commit any remaining fixes**

```bash
git add packages/worker/src/prompts/ packages/sandbox/src/prompts/ packages/sandbox/src/tools/animation-quality.ts
git commit -m "refactor(prompts): fix remaining SVG/layer references found in verification"
```
