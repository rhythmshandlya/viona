# Prompt Optimization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

> **MANDATORY: Load these skills BEFORE starting any task.** The rewritten prompts must reflect the knowledge from these skills — do NOT write prompts from general knowledge alone.
>
> **Motion Graphics Skills (load via Skill tool OR read from `packages/worker/workspace/.claude/skills/`):**
> 1. `framer-motion` — Remotion animation patterns (spring entrance, stagger, exit, orchestration)
> 2. `motion-one` — Disney's 12 principles in Remotion, spring config table, choreography phases, easing functions
> 3. `graphic-designer` — CRAP principles, visual hierarchy, 60-30-10 color rule, typography, self-review loop
> 4. `interaction-design` — Purposeful motion principle ("motion communicates, not decorates"), timing guidelines
> 5. `marketing-visual-design` — Video structure (Hook→Agitate→Solution→Proof→CTA), visual hierarchy for ads
> 6. `video-engagement` — Hook techniques, retention, color palettes, scene structure, visual metaphors (in `packages/worker/remotion-template/.claude/skills/`)
> 7. `remotion-best-practices` — Official Remotion patterns (shapes, noise, paths, transitions, 3D, audio)
>
> **Prompt Engineering Skills (load via Skill tool):**
> 8. `prompt-engineering-patterns` — Progressive disclosure, token efficiency, structured outputs, few-shot learning, system prompt design
>
> **Prompt Engineering Skills (read directly — not in Skill tool registry):**
> 9. `C:\Users\armaa\.claude\skills\customaize-agent-prompt-engineering\SKILL.md` — Agent prompting best practices, persuasion principles (authority, commitment, scarcity), degrees of freedom, conciseness
> 10. `C:\Users\armaa\.claude\skills\llm-application-dev-prompt-optimize\SKILL.md` + `resources/implementation-playbook.md` — Prompt assessment framework, CoT enhancement, model-specific optimization (Claude uses XML tags), evaluation framework
>
> **Key prompt engineering principles to apply throughout:**
> - **Concise is key**: Context window is shared. Only add context Claude doesn't already have. Challenge each paragraph: "Does this justify its token cost?"
> - **Authority for hard rules**: Use "YOU MUST", "NEVER", "No exceptions" for safety-critical patterns (interpolate clamping, frame timing, damping limits)
> - **Progressive disclosure**: Start simple, add complexity only when needed. Skills handle technique details — prompts provide role + workflow + constraints.
> - **Few-shot > description**: Show BAD vs GOOD examples instead of explaining principles abstractly
> - **Degrees of freedom**: Low freedom (exact code) for fragile operations (interpolate, keySync). High freedom (text guidance) for creative decisions (visual metaphors, color choices).
> - **XML tags for Claude**: Use `<tag>` sections for clear prompt structure — Claude performs best with XML-structured system prompts

**Goal:** Rewrite all prompts in `packages/worker/src/prompts/` to produce true motion graphics output, while eliminating ~60% token waste from duplication and slop.

**Architecture:** Extract shared content (motion design principles, technical rules, animation vocabulary, quality checklists) into `shared/` modules. Update Python loader/builders to compose `shared/* + role-specific/*` at runtime. Delete `animator/base.md` (1,822 lines of duplication). Rewrite remaining prompts with motion-design-first thinking and prompt engineering best practices.

**Tech Stack:** Markdown prompt files, Python builders (`animator.py`, `director.py`, `assistant_director.py`), TypeScript loader (`loader.ts`), Python loader (`loader.py`)

---

## Task 1: Create shared/motion-design-principles.md

**Files:**
- Create: `packages/worker/src/prompts/shared/motion-design-principles.md`

**Step 1: Create the shared directory and file**

```markdown
# Motion Design Principles

<motion_mindset>
## Think Like a Motion Designer

Every movement communicates. No decorative motion.

Before animating ANY element, answer three questions:
1. What is this element's ROLE? (primary content, supporting detail, ambient texture)
2. What should the viewer FEEL? (confident, energetic, dramatic, playful)
3. Where should they LOOK NEXT? (guides eye to the next beat)

### Three Simultaneous Layers (MANDATORY)

Professional motion graphics have three layers animating simultaneously. Amateur work has only layer 1.

| Layer | Role | Opacity | Example |
|-------|------|---------|---------|
| **Primary** | Main element moving. One per beat. | 100% | Title scaling in, hero stat counting up |
| **Secondary** | Supporting elements reacting. 2-3 per beat. | 100% | Accent line drawing, icon popping, label fading in |
| **Ambient** | Background texture that NEVER stops. | ≤15% | Gradient rotation, floating particles, grid drift |

A scene with ONLY a title fading in = amateur.
A scene with title (primary) + accent line (secondary) + particle drift (ambient) = professional.
</motion_mindset>

<disney_principles>
## Disney's 5 Principles for Short-Form Video

### 1. Anticipation
Wind up before the main action. A slight pull-back (scale 0.95) over 5 frames before a spring entrance makes the reveal 3x more impactful.

### 2. Follow-Through
Secondary elements overshoot then settle. Use lower damping (14-18) on trailing elements so they arrive AFTER and bounce past the primary element.

### 3. Staging
Direct attention. Blur/dim background elements when the hero enters. The viewer's eye goes to the highest-contrast, fastest-moving element.

### 4. Exaggeration
Low damping + high stiffness for dramatic reveals. A stat counter that overshoots by 8-12% before settling reads as confident and premium.

### 5. Arcs
Natural curved motion paths. Elements that move in straight lines feel robotic. Use `Math.sin` on Y while interpolating X for parabolic arcs (on non-text elements only).
</disney_principles>

<choreography>
## Choreography Phases (Every Scene)

```
Phase 1 (frame 0):        AMBIENT    — Background begins (gradient, particles, grid)
Phase 2 (frame 0-15):     PRIMARY    — Hero element enters (title, main visual)
Phase 3 (keySync):        SETTLE     — Hero settles + secondary content appears
Phase 4 (keySync+8..):    STAGGER    — Details cascade in (8-12 frame stagger)
Phase 5 (last 15 frames): EXIT       — Elements depart in reverse hierarchy
```

No phase may be skipped. Phase 1 (ambient) runs continuously through ALL phases.
</choreography>

<visual_hierarchy>
## Visual Hierarchy (60-30-10 Rule)

- **60%** dominant — background treatment. NEVER static. Gradient rotation, grid drift, or color shift.
- **30%** secondary — containers, shapes, supporting elements. Consistent easing family.
- **10%** accent — highlights, data points, key moments. Springs + overshoot for emphasis.

Hierarchy by impact: Size > Color/Contrast > Position > Motion Speed > Weight
</visual_hierarchy>

<few_shot>
## Developer Animation vs Motion Design

BAD (developer animation):
```
- Title fades in at frame 0 (opacity only)
- Subtitle fades in at frame 10 (opacity only)
- Icon fades in at frame 20 (opacity only)
- All use same easing, same duration
- Background is static
```

GOOD (motion design):
```
- Gradient rotation starts immediately (ambient, continuous)
- Floating particles drift upward at opacity 0.10 (ambient, continuous)
- Title scales 1.1→1.0 with SMOOTH spring + opacity + translateY (primary, frame 0)
- Accent line draws beneath title left→right over 20 frames (secondary, frame 12)
- Subtitle slides up 20px with SNAPPY spring + fade (secondary, frame 18)
- Data point pops with scale overshoot + slight rotation (primary, frame 26)
- Background pulse brightens on data reveal (ambient responds to primary action)
```

The difference: 3 layers active simultaneously, varied easing per element, ambient motion continuous, every movement serves a purpose.
</few_shot>

<hard_rules>
## Hard Rules (Non-Negotiable)

1. Minimum 3 elements animating per scene with DIFFERENT start times
2. Minimum 8-frame stagger between sequential entrances
3. Every scene MUST have ambient motion (background is NEVER static)
4. NEVER use same easing for adjacent elements in a stagger
5. ALWAYS offset opacity from position/scale by 3-6 frames (overlapping action)
6. ALWAYS pair opacity + transform for entrances (opacity-only = amateur)
7. Exits are 75% the duration of entrances (faster out than in)
8. Exit in REVERSE hierarchy order (last in = first out)
</hard_rules>
```

**Step 2: Verify file exists**

Run: `cat packages/worker/src/prompts/shared/motion-design-principles.md | head -5`
Expected: Shows the `# Motion Design Principles` header

**Step 3: Commit**

```bash
git add packages/worker/src/prompts/shared/motion-design-principles.md
git commit -m "feat(prompts): add shared motion design principles module"
```

---

## Task 2: Create shared/technical-rules.md

**Files:**
- Create: `packages/worker/src/prompts/shared/technical-rules.md`

**Step 1: Create the file**

Extract and deduplicate from `animator/system.md` lines 232-550 (animation patterns, spring configs, easing guide, interpolate rules, frame timing). This content currently appears in BOTH `system.md` and `base.md`.

```markdown
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
| GENTLE | 14 | 80 | 1.2 | Background elements, ambient float |

**Rule:** Never use damping < 10. Match spring to intent — SMOOTH for reveals, SNAPPY for impact, HEAVY for weight.
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
## Interpolate Clamping (CRITICAL)

**EVERY `interpolate()` call MUST include BOTH clamp options:**
```tsx
interpolate(frame, [0, 30], [0, 1], {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
})
```

Without BOTH clamps, values extrapolate linearly beyond the range — causing scale: 13x, opacity: 85, or other catastrophic visual bugs. No exceptions.
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
```

**Step 2: Commit**

```bash
git add packages/worker/src/prompts/shared/technical-rules.md
git commit -m "feat(prompts): add shared technical rules module"
```

---

## Task 3: Create shared/vocabulary.md

**Files:**
- Create: `packages/worker/src/prompts/shared/vocabulary.md`

**Step 1: Create the file**

Extract from `director/system.md` lines 308-391 (animation vocabulary + archetypes). This vocabulary must be shared so the Director uses the same names the Animator implements.

```markdown
# Shared Animation Vocabulary

<text_animations>
## Text Animations
| Name | Effect | Best For |
|------|--------|----------|
| `word-cascade` | Words appear one-by-one with slide-up + fade | Quotes, taglines, explanations |
| `char-stagger` | Characters appear letter-by-letter with spring scale | Titles, emphasis words |
| `text-reveal` | Fade in with gentle scale (1.05-1.15x) + SMOOTH spring | Hook titles, big reveals |
| `typewriter` | Characters reveal left-to-right with blinking cursor | Code, terminal output |
| `text-morph-position` | Text smoothly repositions/rescales | Title settling after hook |
| `number-roll` | Counter animates from 0 to target with easing | Stats, metrics, data points |
</text_animations>

<element_animations>
## Element Animations
| Name | Effect | Best For |
|------|--------|----------|
| `spring-in` | Scale 0→1 with spring overshoot | Icons, cards, focal elements |
| `fade-rise` | Opacity 0→1 + translateY up 20px | Subtle entrances, secondary content |
| `stagger-cascade` | Multiple elements enter sequentially (6-8f apart) | Lists, grid items, steps |
| `draw-in` | SVG path draws progressively | Diagrams, connections, flow lines |
| `fill-progress` | Bar/shape fills from 0% to target | Progress bars, chart bars |
| `count-up` | Number ticks from 0 to value over ~45 frames | Metrics, scores, percentages |
| `pop-scatter` | Elements burst outward from center | Celebrations, impact moments |
| `orbit-float` | Elements slowly orbit/float around center | Ambient accents, satellites |
</element_animations>

<transitions>
## Transition Vocabulary
| Name | Effect | When to Use |
|------|--------|-------------|
| `crossfade` | Opacity blend over ~15 frames | Mood changes, gentle shifts |
| `slide-left` | New scene slides in from right | Sequential progression |
| `wipe-right` | Reveal wipe from left to right | Before/after, transformations |
| `glow-pulse` | Brightness pulse at boundary | Impact moments |
| `cut` | Instant switch (default) | Fast pace, dramatic contrast |
</transitions>

<scene_archetypes>
## Scene Archetypes
| Archetype | Best For | Key Animations |
|-----------|----------|----------------|
| `hook-title` | Opening scene | `text-reveal` → `text-morph-position` to top |
| `stat-reveal` | Data points, metrics | `count-up` + `text-reveal` for number |
| `process-flow` | How-to, algorithms | `draw-in` connections, `stagger-cascade` steps |
| `comparison-split` | Before/after, A vs B | `slide-left` divider, `stagger-cascade` each side |
| `feature-list` | Benefits, bullet points | `stagger-cascade` with `spring-in` icons |
| `timeline-march` | History, chronology | `draw-in` center line, `stagger-cascade` nodes |
| `code-demo` | Programming, CLI | `typewriter` code, `spring-in` output |
| `quote-spotlight` | Testimonials, key phrases | `word-cascade` quote, `fade-rise` attribution |
| `data-chart` | Charts, rankings | `draw-in` axes, `fill-progress` bars |
| `hero-image` | Real-world context | Ken Burns image + `text-reveal` overlay |
| `concept-visual` | Abstract ideas | `spring-in` template component |
| `payoff-close` | Conclusion, CTA | `spring-in` callback + `word-cascade` summary |

Archetypes are starting recipes, not rigid templates. Mix animations freely.
</scene_archetypes>
```

**Step 2: Commit**

```bash
git add packages/worker/src/prompts/shared/vocabulary.md
git commit -m "feat(prompts): add shared animation vocabulary module"
```

---

## Task 4: Create shared/quality-checklist.md

**Files:**
- Create: `packages/worker/src/prompts/shared/quality-checklist.md`

**Step 1: Create the file**

```markdown
# Quality Checklist

<scene_checklist>
## Per-Scene Verification (Animator)
Before marking any scene complete:
- [ ] All entries pair opacity + transform (no opacity-only fades)
- [ ] Stagger delays vary (not uniform gaps)
- [ ] 3+ elements animating with different start times
- [ ] Ambient layer present and continuous (background never static)
- [ ] Exits faster than entries (75% duration), reverse hierarchy order
- [ ] No frozen frames — persistent elements have micro-motion
- [ ] All content in centered flex container (not scattered absolute positions)
- [ ] Only palette colors used (no random hex values)
- [ ] Spring damping >= 10 everywhere
- [ ] Text scale never exceeds 1.15x during entry
- [ ] extrapolateLeft AND extrapolateRight: 'clamp' on EVERY interpolate()
- [ ] keySync visual triggers at exact TIMING.sceneNKeySync frame
- [ ] TypeScript compiles: `npx tsc --noEmit`
</scene_checklist>

<plan_checklist>
## Plan Verification (Director)
Before finalizing scene plan:
- [ ] MUTE TEST: Concept clear with sound off?
- [ ] CONTINUITY TEST: Same visual element persists and transforms across scenes?
- [ ] SYNC TEST: Key visuals aligned to specific transcript words?
- [ ] HOOK TEST: Scene 1 has motion from frame 0 and striking visual in <3 seconds?
- [ ] PACING TEST: Scene durations varied (not all same length)?
- [ ] DURATION TEST: Every scene under 450 frames (15 seconds)?
- [ ] SYNC GAP TEST: Max 90 frames (3 seconds) between consecutive sync points?
- [ ] ANCHOR TEST: Each scene specifies what carries in/out?
- [ ] LAYER TEST: Each description addresses background + primary element + motion?
- [ ] OVERLAY ZONE TEST: Overlay elements only in 0-15% or 58-85% Y zones?
</plan_checklist>

<coverage_checklist>
## Transcript Coverage (Both Agents)
- [ ] Every 3-5 seconds of narration has corresponding visual content
- [ ] No phrase in the transcript lacks visual representation
- [ ] Visual beats match narration beats (pause at any frame → viewer understands topic)
</coverage_checklist>
```

**Step 2: Commit**

```bash
git add packages/worker/src/prompts/shared/quality-checklist.md
git commit -m "feat(prompts): add shared quality checklist module"
```

---

## Task 5: Update Python loader to support shared/ composition

**Files:**
- Modify: `packages/worker/src/prompts/loader.py`

**Step 1: Add `load_shared_modules()` function**

Add this function to `loader.py` after the existing `clear_cache()`:

```python
# --- Shared module composition ---

_SHARED_MODULES = [
    "shared/technical-rules",
    "shared/motion-design-principles",
    "shared/vocabulary",
    "shared/quality-checklist",
]


def load_shared_modules() -> str:
    """Load and concatenate all shared prompt modules.

    Returns a single string with all shared modules separated by newlines.
    Used by agent builders to prepend shared context to role-specific prompts.
    """
    parts: list[str] = []
    for name in _SHARED_MODULES:
        parts.append(load_prompt(name))
    return "\n\n".join(parts)
```

**Step 2: Verify Python syntax**

Run: `cd packages/worker && python -c "from src.prompts.loader import load_shared_modules; print(len(load_shared_modules()))"`
Expected: Prints a number (the total character count of all shared modules)

Note: If the Python import path doesn't work directly, try:
Run: `cd packages/worker/src && python -c "from prompts.loader import load_shared_modules; print('OK:', len(load_shared_modules()))"`

**Step 3: Commit**

```bash
git add packages/worker/src/prompts/loader.py
git commit -m "feat(prompts): add load_shared_modules() to Python loader"
```

---

## Task 6: Rewrite animator/system.md — Core Rewrite

This is the largest task. The current file is 2,117 lines. The target is ~800 lines.

**Files:**
- Modify: `packages/worker/src/prompts/animator/system.md` (rewrite)
- Delete: `packages/worker/src/prompts/animator/base.md`

**Step 1: Back up current files**

```bash
cp packages/worker/src/prompts/animator/system.md packages/worker/src/prompts/animator/system.md.bak
cp packages/worker/src/prompts/animator/base.md packages/worker/src/prompts/animator/base.md.bak
```

**Step 2: Rewrite animator/system.md**

The new file keeps ONLY content that is:
(a) Animator-specific (not in shared/), AND
(b) Actionable (not aspirational slop)

**What stays (rewritten for clarity):**
- `<MANDATORY_PROCESS>` — process enforcement (lines 1-15) — KEEP, tighten
- `<role>` — role definition (lines 17-30) — KEEP, tighten
- `<workflow>` — phases 1-3 (lines 32-174) — KEEP, tighten
- `<plan_adherence>` — director's vision (lines 176-202) — KEEP as-is
- `<logging_requirement>` — implementation log (lines 204-230) — KEEP, slim
- Key sync pattern example (lines 249-295) — KEEP (but remove duplicated spring config table → now in shared/)
- Title fill pattern (lines 297-325) — KEEP
- Glassmorphism pattern (lines 327-338) — KEEP
- 3-act choreography (lines 386-473) — MOVE reference to shared/motion-design-principles.md, keep only Animator-specific override notes
- Prohibited patterns (lines 1109-1149) — KEEP, consolidate
- 3D animations (lines 1151-1209) — KEEP
- Assets & Freepik (lines 1211-1609) — KEEP, slim (remove redundant examples)
- Overlay mode (lines 1610-1723) — MOVE to overlay-rules.md (already partially there)
- React keys (lines 1727-1745) — KEEP (short)
- Per-scene viewport (lines 1747-1783) — KEEP
- Remotion rules (lines 1785-1826) — MOVE to shared/technical-rules.md (already there)
- Content-first design (lines 1828-1866) — KEEP, tighten
- Continuous storytelling (lines 1868-1932) — KEEP, tighten
- Layout rules (lines 1934-2117) — KEEP, slim

**What gets deleted (now in shared/):**
- Spring config table (lines 236-239) → `shared/technical-rules.md`
- Easing guide (lines 475-550) → `shared/technical-rules.md`
- Animation quality techniques (lines 552-696) → `shared/motion-design-principles.md` covers this
- Exit animation recipes (lines 698-773) → Keep ONE recipe, delete the other 3
- Scene transitions (lines 776-832) → Keep mapping table, delete verbose examples
- Micro-animation polish layer (lines 834-903) → Keep particle recipe only, delete grain/vignette
- Professional polish techniques (lines 905-948) → Delete entirely (aspirational, rarely followed)
- Animation recipe library (lines 950-1027) → Keep 2 best, delete 3 redundant
- Advanced techniques (lines 1029-1107) → Keep clip-path + SVG draw-in, delete rest (covered by skills)
- Frame timing rules (lines 1785-1826) → `shared/technical-rules.md`

Write the new `animator/system.md` with this structure:
```
<MANDATORY_PROCESS> (15 lines — unchanged)
<role> (12 lines — tightened)
<workflow> (100 lines — phases 1-3, tightened)
<plan_adherence> (25 lines — unchanged)
<logging_requirement> (30 lines — slimmed)
<animation_patterns> (80 lines — key sync + title fill + glassmorphism only, reference shared/ for springs/easing)
<choreography_notes> (20 lines — reference shared/motion-design-principles.md, Animator-specific overlay override)
<prohibited_patterns> (40 lines — consolidated from current 40 lines)
<three_dimensional> (50 lines — unchanged)
<assets_and_visuals> (200 lines — Freepik/Iconify workflow, slimmed examples)
<content_first_design> (30 lines — tightened)
<continuous_storytelling> (40 lines — tightened)
<layout_rules> (100 lines — centering patterns, zone diagram, responsive sizing reference to shared/)
<per_scene_viewport> (30 lines — unchanged)
<react_keys> (15 lines — unchanged)
```

Target: ~800 lines total.

**IMPORTANT**: The file references `shared/` content. The Python builder (`animator.py`) will prepend shared modules. Add a note at the top:

```markdown
<!-- NOTE: This prompt is prepended with shared/ modules (technical-rules, motion-design-principles, vocabulary, quality-checklist) by the Python builder. Do NOT duplicate shared content here. -->
```

**Step 3: Delete animator/base.md**

```bash
rm packages/worker/src/prompts/animator/base.md
```

**Step 4: Verify the file is reasonable**

Run: `wc -l packages/worker/src/prompts/animator/system.md`
Expected: ~700-900 lines

**Step 5: Commit**

```bash
git add packages/worker/src/prompts/animator/system.md
git rm packages/worker/src/prompts/animator/base.md
git commit -m "refactor(prompts): rewrite animator system prompt, delete base.md duplicate

Reduces from 2,117 to ~800 lines. Shared content moved to shared/ modules.
Eliminates 1,822-line base.md (was 95% duplicate of system.md)."
```

---

## Task 7: Update animator.py to compose shared modules + handle base.md deletion

**Files:**
- Modify: `packages/worker/src/prompts/animator/animator.py`

**Step 1: Update imports and monolithic prompt**

At the top of `animator.py`, after the existing imports, add:

```python
from prompts.loader import load_shared_modules
```

Change the monolithic prompt composition. Find line 53:
```python
ANIMATOR_SYSTEM_PROMPT = load_prompt('animator/system')
```

Replace with:
```python
# Compose: shared modules + animator-specific system prompt
ANIMATOR_SYSTEM_PROMPT = load_shared_modules() + "\n\n" + load_prompt('animator/system')
```

**Step 2: Update modular prompt (base.md replacement)**

Find line 500:
```python
ANIMATOR_BASE_PROMPT = load_prompt('animator/base')
```

Replace with:
```python
# base.md is deleted — modular path now uses shared modules + system prompt
# (same content, deduplicated)
ANIMATOR_BASE_PROMPT = ANIMATOR_SYSTEM_PROMPT
```

**Step 3: Verify Python loads correctly**

Run: `cd packages/worker/src && python -c "from prompts.animator.animator import ANIMATOR_SYSTEM_PROMPT, ANIMATOR_BASE_PROMPT; print('System:', len(ANIMATOR_SYSTEM_PROMPT), 'Base:', len(ANIMATOR_BASE_PROMPT))"`
Expected: Both print non-zero lengths. Base should equal System.

**Step 4: Commit**

```bash
git add packages/worker/src/prompts/animator/animator.py
git commit -m "refactor(prompts): update animator.py to compose shared modules"
```

---

## Task 8: Rewrite director/system.md

**Files:**
- Modify: `packages/worker/src/prompts/director/system.md` (rewrite)

**Step 1: Back up**

```bash
cp packages/worker/src/prompts/director/system.md packages/worker/src/prompts/director/system.md.bak
```

**Step 2: Rewrite**

The Director prompt is 728 lines. Target: ~450 lines.

**What stays (rewritten):**
- `<critical_instruction>` — always create files (lines 1-12) — KEEP
- `<creative_brief>` — brief integration (lines 14-25) — KEEP
- `<role>` + `<philosophy>` — (lines 27-40) — KEEP, tighten
- `<transcript_analysis>` — 4-pass analysis (lines 42-65) — KEEP
- `<scene_constraints>` — constraints + overlay zones (lines 67-134) — KEEP
- `<hook_rule>` — 3-second rule (lines 136-150) — KEEP
- `<pacing_guide>` — scene pacing (lines 152-185) — KEEP
- `<output_format>` — file requirements (lines 187-202) — KEEP
- `<visual_decomposition>` — layered descriptions (lines 204-237) — KEEP
- `<cross_scene_anchoring>` — continuity (lines 239-266) — KEEP
- `<quality_criteria>` — plan verification (lines 268-285) — MOVE to reference shared/quality-checklist.md plan section
- `<visual_requirements>` — 3D, icons, images, video (lines 443-708) — KEEP, slim

**What gets deleted (now in shared/):**
- `<visual_metaphors>` (lines 287-306) — KEEP (Director-specific mapping, not duplicated)
- `<animation_vocabulary>` (lines 308-352) — MOVE to shared/vocabulary.md
- `<scene_archetypes>` (lines 354-391) — MOVE to shared/vocabulary.md
- `<color_palettes>` (lines 393-441) — KEEP (Director chooses palettes, but slim — studio theme note + 2 examples, not 7)

**What gets added:**
- Motion-design-aware planning language: "Plan choreography phases, not just what appears"
- Reference to shared/motion-design-principles.md: "The Animator implements using the motion design principles from shared modules. Plan with these in mind."
- Explicit choreography planning field in scene descriptions: each scene should specify which phase each visual element belongs to

Add at top:
```markdown
<!-- NOTE: This prompt is prepended with shared/ modules by the Python builder. Reference shared/vocabulary.md for animation names and archetypes. -->
```

**Step 3: Verify line count**

Run: `wc -l packages/worker/src/prompts/director/system.md`
Expected: ~400-500 lines

**Step 4: Commit**

```bash
git add packages/worker/src/prompts/director/system.md
git commit -m "refactor(prompts): rewrite director system prompt, extract shared content

Reduces from 728 to ~450 lines. Animation vocabulary and archetypes
moved to shared/vocabulary.md. Adds motion-design planning awareness."
```

---

## Task 9: Update director.py to compose shared modules

**Files:**
- Modify: `packages/worker/src/prompts/director/director.py`

**Step 1: Update prompt composition**

Add import at top:
```python
from prompts.loader import load_shared_modules
```

Change line 10:
```python
DIRECTOR_SYSTEM_PROMPT = load_prompt('director/system')
```

To:
```python
DIRECTOR_SYSTEM_PROMPT = load_shared_modules() + "\n\n" + load_prompt('director/system')
```

**Step 2: Verify**

Run: `cd packages/worker/src && python -c "from prompts.director.director import DIRECTOR_SYSTEM_PROMPT; print('Director:', len(DIRECTOR_SYSTEM_PROMPT))"`
Expected: Prints non-zero length

**Step 3: Commit**

```bash
git add packages/worker/src/prompts/director/director.py
git commit -m "refactor(prompts): update director.py to compose shared modules"
```

---

## Task 10: Update assistant-director/system.md

**Files:**
- Modify: `packages/worker/src/prompts/assistant-director/system.md`

**Step 1: Add motion design awareness**

The assistant director's brief currently guides tone, colors, and fonts. Add a `<motion_guidance>` section after the existing `<font_pairs>` section:

```markdown
<motion_guidance>
## Motion Design Guidance

In addition to tone, color, and font recommendations, your brief should guide the motion style.

Add this section to your CREATIVE_BRIEF.md output:

```
## Motion Style
**Motion mood:** [kinetic | dramatic | subtle | playful]
**Choreography intensity:** [minimal (2-3 elements) | moderate (4-5 elements) | rich (6+ elements)]
**Ambient style:** [particles | gradient-shift | grid-drift | none]
**Recommended spring feel:** [SMOOTH for calm | SNAPPY for energy | HEAVY for drama | BOUNCY for playful]
```

**Tone → Motion mapping:**
| Tone | Motion Mood | Choreography | Ambient | Spring |
|------|-------------|--------------|---------|--------|
| Playful | playful | rich | particles | BOUNCY |
| Professional | subtle | minimal | gradient-shift | SMOOTH |
| Dramatic | dramatic | moderate | grid-drift | HEAVY |
| Educational | subtle | moderate | gradient-shift | SMOOTH |
| Inspirational | kinetic | rich | particles | SNAPPY |
| Conversational | playful | minimal | none | SMOOTH |
</motion_guidance>
```

Also update the `<output_instructions>` section to include the new "Motion Style" section in the CREATIVE_BRIEF.md template.

**Step 2: Update assistant_director.py to compose shared modules**

In `packages/worker/src/prompts/assistant_director.py`, add:
```python
from prompts.loader import load_shared_modules
```

Change:
```python
ASSISTANT_DIRECTOR_SYSTEM_PROMPT = load_prompt('assistant-director/system')
```

To:
```python
ASSISTANT_DIRECTOR_SYSTEM_PROMPT = load_shared_modules() + "\n\n" + load_prompt('assistant-director/system')
```

**Step 3: Commit**

```bash
git add packages/worker/src/prompts/assistant-director/system.md packages/worker/src/prompts/assistant_director.py
git commit -m "feat(prompts): add motion design guidance to assistant director"
```

---

## Task 11: Update TypeScript loader for shared modules

**Files:**
- Modify: `packages/worker/src/prompts/loader.ts`

**Step 1: Add loadSharedModules function**

```typescript
const SHARED_MODULES = [
  'shared/technical-rules',
  'shared/motion-design-principles',
  'shared/vocabulary',
  'shared/quality-checklist',
] as const;

export function loadSharedModules(): string {
  return SHARED_MODULES.map(loadPrompt).join('\n\n');
}
```

**Step 2: Export from index.ts**

In `packages/worker/src/prompts/index.ts`, add `loadSharedModules` to the export:
```typescript
export { loadPrompt, loadTemplate, loadSharedModules } from './loader.js';
```

**Step 3: Commit**

```bash
git add packages/worker/src/prompts/loader.ts packages/worker/src/prompts/index.ts
git commit -m "feat(prompts): add loadSharedModules to TypeScript loader"
```

---

## Task 12: Clean up backup files and verify

**Files:**
- Delete: `packages/worker/src/prompts/animator/system.md.bak`
- Delete: `packages/worker/src/prompts/animator/base.md.bak`
- Delete: `packages/worker/src/prompts/director/system.md.bak`

**Step 1: Run full Python import check**

```bash
cd packages/worker/src && python -c "
from prompts.animator.animator import ANIMATOR_SYSTEM_PROMPT, ANIMATOR_BASE_PROMPT
from prompts.director.director import DIRECTOR_SYSTEM_PROMPT
from prompts.assistant_director import ASSISTANT_DIRECTOR_SYSTEM_PROMPT
from prompts.loader import load_shared_modules

shared = load_shared_modules()
print(f'Shared modules: {len(shared)} chars')
print(f'Animator system: {len(ANIMATOR_SYSTEM_PROMPT)} chars')
print(f'Animator base: {len(ANIMATOR_BASE_PROMPT)} chars')
print(f'Director: {len(DIRECTOR_SYSTEM_PROMPT)} chars')
print(f'Asst Director: {len(ASSISTANT_DIRECTOR_SYSTEM_PROMPT)} chars')
print()
print('Shared modules present in Animator:', 'motion_mindset' in ANIMATOR_SYSTEM_PROMPT)
print('Shared modules present in Director:', 'motion_mindset' in DIRECTOR_SYSTEM_PROMPT)
print('Base == System:', ANIMATOR_BASE_PROMPT == ANIMATOR_SYSTEM_PROMPT)
print()
print('ALL CHECKS PASSED' if all([
    len(shared) > 1000,
    len(ANIMATOR_SYSTEM_PROMPT) > 3000,
    len(DIRECTOR_SYSTEM_PROMPT) > 3000,
    'motion_mindset' in ANIMATOR_SYSTEM_PROMPT,
    'motion_mindset' in DIRECTOR_SYSTEM_PROMPT,
    ANIMATOR_BASE_PROMPT == ANIMATOR_SYSTEM_PROMPT,
]) else 'SOME CHECKS FAILED')
"
```
Expected: `ALL CHECKS PASSED`

**Step 2: Run TypeScript compilation**

```bash
cd packages/worker && npx tsc --noEmit --pretty false 2>&1 | head -20
```
Expected: No errors related to prompts (other pre-existing errors are OK)

**Step 3: Delete backups**

```bash
rm packages/worker/src/prompts/animator/system.md.bak
rm packages/worker/src/prompts/animator/base.md.bak
rm packages/worker/src/prompts/director/system.md.bak
```

**Step 4: Final commit**

```bash
git add -A packages/worker/src/prompts/
git commit -m "chore(prompts): clean up backup files, verify all loaders"
```

---

## Summary

| Task | What | Lines Changed |
|------|------|---------------|
| 1 | shared/motion-design-principles.md | +120 new |
| 2 | shared/technical-rules.md | +100 new |
| 3 | shared/vocabulary.md | +80 new |
| 4 | shared/quality-checklist.md | +50 new |
| 5 | Update Python loader | +15 modified |
| 6 | Rewrite animator/system.md + delete base.md | -3,139 net (2117→800, delete 1822) |
| 7 | Update animator.py | +5 modified |
| 8 | Rewrite director/system.md | -278 net (728→450) |
| 9 | Update director.py | +3 modified |
| 10 | Update assistant-director + builder | +35 modified |
| 11 | Update TypeScript loader | +12 modified |
| 12 | Verify + cleanup | 0 net |
| **Total** | | **~-2,997 lines net** |

Shared modules add ~350 lines but replace ~1,200 lines of per-prompt duplication + ~1,800 lines of deleted slop.
