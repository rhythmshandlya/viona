# Animation Recipe Quality — Replace Overused Patterns

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove particle/orbit recipes that the AI overuses and replace all animation examples across the codebase with professional explainer-video techniques (accent lines, progress fills, highlight sweeps, color shifts, anticipation).

**Architecture:** The AI gravitates toward patterns with full code recipes. Particle bursts and orbiting icons had 15-line copy-paste components; simpler professional techniques were one-line table entries. By removing the overused recipes and promoting professional patterns, the AI will naturally produce better animations.

**Tech Stack:** Markdown prompt files only. No code changes.

---

## Already Done (pre-plan)

The following were already implemented before this plan was written:

- `animator/system.md` `<animation_patterns>`: Removed `FlowingParticles` (15-line component), `ScaleIn` component. Added `Accent Line Draw`, `Progress Fill`, `Highlight Sweep`, `Color Shift`, `Anticipation + Follow-Through`.
- `animator/system.md` `<animation_recipes>`: Removed `Particle Burst` (10-line recipe), `Counter Explosion`, `Micro-Animations` (particle reference). Added `Staggered Card Cascade` (varied springs), `SVG Stroke Draw`, `Stat Reveal`.
- `animator.py`: SPRINGS presets aligned (SNAPPY 22, BOUNCY 20, GENTLE 20).
- `generate-visuals.ts`: All `damping: 12` → `damping: 20`.

## Remaining Work

### Task 1: Replace Hub & Orbit pattern in scene-patterns.md

The "Hub & Orbit" pattern in `generate-visuals/scene-patterns.md` directly teaches the AI to put orbiting satellites around a central element — the exact overused behavior. Replace it with a pattern that achieves the same goal (showing a central concept with related features) without orbital motion.

**Files:**
- Modify: `packages/worker/src/prompts/generate-visuals/scene-patterns.md:22-27`

- [ ] **Step 1: Replace Hub & Orbit with Radial Card Layout**

Replace lines 22-27:
```markdown
### 3. Hub & Orbit
**When:** Speaker describes a central concept with related features/properties ("X has these benefits", "core principle with...")
- Central element (larger, glowing) with orbiting satellite elements
- Satellites appear one by one, each with a connection line to hub
- Gentle rotation animation for the orbit ring
- Use for: frameworks, architectures, ecosystems, feature sets
```

With:
```markdown
### 3. Radial Feature Layout
**When:** Speaker describes a central concept with related features/properties ("X has these benefits", "core principle with...")
- Central element (larger, accent-bordered) with feature cards arranged around it
- Cards stagger in one by one with varied spring configs, connected by SVG stroke-draw lines to center
- Each card has an icon + label (never standalone icons)
- Cards ACTIVATE at sync points (dim → bright), not orbit
- Use for: frameworks, architectures, ecosystems, feature sets
```

- [ ] **Step 2: Verify no other file references "Hub & Orbit" by name**

Run: `grep -r "Hub.*Orbit\|orbit.*hub" packages/worker/src/prompts/`
Expected: Only the file we just changed (or zero results after edit).

- [ ] **Step 3: Commit**

```bash
git add packages/worker/src/prompts/generate-visuals/scene-patterns.md
git commit -m "fix(prompts): replace Hub & Orbit pattern with Radial Feature Layout"
```

### Task 2: Downgrade orbit-float in vocabulary.md

`orbit-float` is still listed as a technique in `shared/vocabulary.md`. It shouldn't be removed entirely (orbiting has legitimate rare uses) but it should be de-emphasized with a warning.

**Files:**
- Modify: `packages/worker/src/prompts/shared/vocabulary.md:26`

- [ ] **Step 1: Add warning to orbit-float entry**

Change:
```
| `orbit-float` | Elements slowly orbit/float around center | Ambient accents, satellites |
```
To:
```
| `orbit-float` | Elements slowly float around center (RARE — prefer stagger-cascade or radial layout) | Ambient only, max 1 scene per project |
```

- [ ] **Step 2: Commit**

```bash
git add packages/worker/src/prompts/shared/vocabulary.md
git commit -m "fix(prompts): de-emphasize orbit-float technique in vocabulary"
```

### Task 3: Add technique repetition cap to system.md

No animation technique should be used in more than 2 scenes per project. This prevents the AI from defaulting to the same pattern everywhere.

**Files:**
- Modify: `packages/worker/src/prompts/animator/system.md` — `<prohibited_patterns>` section

- [ ] **Step 1: Add repetition cap rule**

After the line `- **spring() for everything** — Vary with Easing`, add:
```
- **Same technique in 3+ scenes** — No animation technique (stagger-cascade, progress-fill, accent-line, etc.) may appear in more than 2 scenes per project. Vary techniques across scenes.
```

- [ ] **Step 2: Commit**

```bash
git add packages/worker/src/prompts/animator/system.md
git commit -m "fix(prompts): add technique repetition cap (max 2 scenes per technique)"
```

### Task 4: Add repetition cap to Director self-verification

The Director should also check for technique variety when planning.

**Files:**
- Modify: `packages/worker/src/prompts/director/system.md` — self-verification table

- [ ] **Step 1: Add repetition check to scene_validation rules**

After line `8. buildsFrom/connectsTo anchors are specific, not generic` in `<scene_validation>`, add:
```
9. No animation technique name appears in more than 2 scene descriptions
```

- [ ] **Step 2: Commit**

```bash
git add packages/worker/src/prompts/director/system.md
git commit -m "fix(prompts): add technique repetition check to Director validation"
```

### Task 5: Replace particle references in Layer 3 descriptions

Multiple files describe Layer 3 (ambient) as "particles, glows" — this primes the AI to reach for particles. Broaden the language to include the new techniques.

**Files:**
- Modify: `packages/worker/src/prompts/animator/system.md` — lines referencing Layer 3
- Modify: `packages/worker/src/prompts/animator/scene-template.md:51`

- [ ] **Step 1: Update Layer 3 descriptions in system.md**

Find all instances of "particles/glows" or "particles, glows" or "particles, gentle pulses" in system.md and replace with broader language:

| Current | Replace with |
|---------|-------------|
| `particles/glows at opacity <= 0.15` | `ambient texture (gradient drift, glow pulse, grid shift) at opacity <= 0.15` |
| `particles, gentle pulses` | `ambient motion (glow pulses, color shifts, grid drift)` |
| `ambient particles at opacity <= 0.15` | `ambient texture at opacity <= 0.15 (gradient shift, dot-grid drift, subtle glow)` |

Keep the overlay rule "no particles" as-is — that's a correct restriction.

- [ ] **Step 2: Update scene-template.md Layer 3 placeholder**

Change line 51:
```
- Layer 3 (Ambient): [atmospheric depth — particles, glows, gradients at opacity ≤ 0.15]
```
To:
```
- Layer 3 (Ambient): [atmospheric depth — gradient drift, glow pulse, grid shift at opacity ≤ 0.15]
```

- [ ] **Step 3: Commit**

```bash
git add packages/worker/src/prompts/animator/system.md packages/worker/src/prompts/animator/scene-template.md
git commit -m "fix(prompts): broaden Layer 3 language from particles to ambient techniques"
```

### Task 6: Update design-system.md ambient layer description

The studio theme design system also references particles in its Layer 3 description.

**Files:**
- Modify: `packages/worker/src/prompts/themes/studio/design-system.md:189-191`

- [ ] **Step 1: Update ambient layer description**

Change:
```
Subtle depth: DotGrid, particle flow, glow intensification at sync points.
Direction must match narrative (upward particles = growth, lateral = progression).
```
To:
```
Subtle depth: DotGrid, gradient drift, glow intensification at sync points.
Direction must match narrative (upward drift = growth, lateral = progression).
```

- [ ] **Step 2: Commit**

```bash
git add packages/worker/src/prompts/themes/studio/design-system.md
git commit -m "fix(prompts): replace particle references in studio design system"
```

### Task 7: Update content_first_design BAD example

The BAD example in system.md still says "11 colored dots orbiting a glow" — keep it as the BAD example but also add a note about particles specifically.

**Files:**
- Modify: `packages/worker/src/prompts/animator/system.md` — `<content_first_design>` section

- [ ] **Step 1: Strengthen the BAD example**

Change:
```
BAD: 11 colored dots orbiting a glow (Layer 3 only)
GOOD: Large "11" counter (L1) + "AI Agents" subtitle (L1) + 3 agent cards (L2) + soft particles (L3)
```
To:
```
BAD: 11 colored dots orbiting a glow (Layer 3 only — no content)
BAD: Particle burst + orbiting icons as the main visual (decoration, not explanation)
GOOD: Large "11" counter (L1) + "AI Agents" subtitle (L1) + 3 agent cards with accent lines (L2) + subtle gradient drift (L3)
```

- [ ] **Step 2: Commit**

```bash
git add packages/worker/src/prompts/animator/system.md
git commit -m "fix(prompts): strengthen content-first BAD examples against particles/orbits"
```

### Task 8: Validation grep

- [ ] **Step 1: Verify no particle/orbit recipes remain**

Run: `grep -rn "FlowingParticle\|Particle Burst\|Counter Explosion\|orbit-float.*Ambient accents" packages/worker/src/prompts/`
Expected: Zero results.

- [ ] **Step 2: Verify orbit-float has warning**

Run: `grep "orbit-float" packages/worker/src/prompts/shared/vocabulary.md`
Expected: Contains "RARE" and "max 1 scene per project".

- [ ] **Step 3: Verify repetition cap exists**

Run: `grep "3+ scenes\|more than 2 scenes" packages/worker/src/prompts/animator/system.md`
Expected: One match for the repetition cap rule.

- [ ] **Step 4: Verify Layer 3 language broadened**

Run: `grep -c "particles/glows" packages/worker/src/prompts/animator/system.md`
Expected: 0 (all replaced with broader language).
