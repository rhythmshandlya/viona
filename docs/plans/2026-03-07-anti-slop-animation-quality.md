# Anti-Slop Animation Quality Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate generic "AI slop" animation patterns from the visual generation pipeline by adding explicit anti-slop rules and quality standards to the Animator prompt.

**Architecture:** Add a new `<anti_slop>` section to `_STUDIO_DESIGN_SYSTEM_TEMPLATE` in `animator.py` (injected only for studio presets). Also update the monolithic `ANIMATOR_SYSTEM_PROMPT` with a condensed version of the same rules so they apply regardless of preset. Update workspace `CLAUDE.md` files with anti-slop reminders.

**Tech Stack:** Python prompt engineering (animator.py), Markdown (CLAUDE.md)

---

### Task 1: Add anti-slop quality section to `_STUDIO_DESIGN_SYSTEM_TEMPLATE`

**Files:**
- Modify: `packages/worker/src/agents/prompts/animator.py:156-173` (after DotGrid, before CARD CONTAINERS)

**Step 1: Read the current template to find insertion point**

Read `packages/worker/src/agents/prompts/animator.py` lines 156-200 to confirm the insertion point after `"A scene without the studio background..."` and before `### CARD CONTAINERS`.

**Step 2: Insert the anti-slop section**

Insert the following block between the DotGrid background enforcement and the CARD CONTAINERS section (after line 156, before line 158 `### CARD CONTAINERS`):

```python
### ANIMATION QUALITY STANDARDS (MANDATORY)

**The difference between professional and AI-slop animations is INTENTIONALITY.**
Every animation choice must serve the narration. If you can't explain WHY an element
animates the way it does, redesign it.

#### RULE 1: Combine Opacity + Scale + Slide (NEVER animate in one dimension)
Single-dimension animation (fade-only) is the #1 sign of AI slop.
All element entrances MUST combine at least 2 of: opacity, scale, translateX, translateY.

WRONG:
```tsx
<span style={{{{{{ opacity: fadeIn }}}}}}>Key Point</span>
```

RIGHT:
```tsx
const textOpacity = interpolate(frame, [f1, f2], [0, 1], {{{{ extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }}}});
const textScale = spring({{{{ frame: frame - f1, fps, config: SPRINGS.SNAPPY }}}});
const textSlideY = interpolate(frame, [f1, f2], [s(15), 0], {{{{ extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }}}});
<span style={{{{{{
  opacity: textOpacity,
  transform: `scale(${{{{0.95 + textScale * 0.05}}}}) translateY(${{{{textSlideY}}}}px)`
}}}}}}>Key Point</span>
```

#### RULE 2: Vary animation types across staggered elements
Don't clone the same animation with different delays — that's robotic.
Element 1 should pop (spring), Element 2 should slide (interpolate), Element 3 should scale differently.

WRONG: all items use identical `spring() + opacity` with only delay varying
RIGHT: item 0 pops with SNAPPY spring, item 1 slides from left, item 2 fades with scale from below

#### RULE 3: Spring config MUST match animation intent
- Impact/pop: `{{{{ damping: 10, stiffness: 200, mass: 1.4 }}}}` — bouncy, energetic
- Smooth settle: `{{{{ damping: 26, stiffness: 120, mass: 1.0 }}}}` — no overshoot
- Snappy reveal: `{{{{ damping: 18, stiffness: 180, mass: 0.8 }}}}` — responsive
- Use `Easing.out(Easing.cubic)` for connecting lines and progress bars

WRONG: every animation uses the same `SPRINGS.SMOOTH` config
RIGHT: hero text uses SNAPPY, cards use SMOOTH, connecting elements use `Easing.out(Easing.cubic)`

#### RULE 4: No emoji as content
Emoji (🏊💪😴♥) is placeholder thinking. Use custom SVG paths with animation.
The ONLY acceptable emoji use: tiny decorative accent in a larger composition.

#### RULE 5: No placeholder SVG shapes
Simple `<ellipse>` and `<rect>` without detail look AI-generated.
Every SVG shape must either: (a) use custom `<path>` with curves, or (b) animate meaningfully
(stroke-dashoffset reveal, scale pulse tied to sync point, etc.).
Use the Iconify MCP tool or Freepik MCP tool for professional icons instead of hand-drawing.

#### RULE 6: Glow/shadow intensity must match narrative moments
Glow should INTENSIFY at key sync points, not be constant.
Use layered text-shadow with 3 opacity tiers for depth:
```tsx
textShadow: `
  0 0 ${{{{s(20)}}}}px ${{{{accentColor}}}}88,
  0 0 ${{{{s(60)}}}}px ${{{{accentColor}}}}44,
  0 0 ${{{{s(100)}}}}px ${{{{accentColor}}}}22
`
```

#### RULE 7: Gradient direction must encode meaning
- `90deg` (left→right): progression, sequence, time
- `135deg` (diagonal): emphasis, growth
- `radial`: explosion, energy radiating from center
Don't use random gradient angles. The direction should reinforce the scene's narrative.

#### RULE 8: Every visual moment must connect to narration
Before coding, mentally map each narration phrase to a visual event.
Pause test: at ANY frame, can the viewer understand what's being discussed?
If a sync point has no corresponding visual change, ADD ONE.
```

Note: All `{{` in the template must be `{{{{` due to Python `.format()` escaping (the template uses `{background}`, `{text}` etc. as format variables).

**Step 3: Verify the template still renders**

Run:
```bash
cd packages/worker && python -c "from src.agents.prompts.animator import get_studio_section; result = get_studio_section('studio-dark'); print('OK' if 'RULE 1' in result and 'RULE 8' in result else 'MISSING')"
```
Expected: `OK`

**Step 4: Commit**

```bash
git add packages/worker/src/agents/prompts/animator.py
git commit -m "feat(worker): add anti-slop animation quality standards to Animator studio prompt"
```

---

### Task 2: Add condensed anti-slop rules to monolithic ANIMATOR_SYSTEM_PROMPT

**Files:**
- Modify: `packages/worker/src/agents/prompts/animator.py` — find the `ANIMATOR_SYSTEM_PROMPT` string (the large monolithic prompt), locate the animation quality section

**Step 1: Find the insertion point in ANIMATOR_SYSTEM_PROMPT**

Search for the monolithic prompt's animation/quality section. Look for strings like `"ANIMATION LIFECYCLE"` or `"RENDERING RULES"` within `ANIMATOR_SYSTEM_PROMPT`. The anti-slop rules should go right before the rendering rules section.

**Step 2: Insert condensed anti-slop rules**

Add a condensed version (no code examples, just the rules) to the monolithic prompt. This ensures anti-slop rules apply even if the studio design system section isn't injected:

```
### ANIMATION QUALITY (ANTI-SLOP)

These patterns make animations look cheap and AI-generated. NEVER use them:
- Single-dimension animation (opacity-only fade). ALWAYS combine opacity + scale + slide.
- Cloned stagger (same animation type with different delays). VARY animation types per element.
- Same spring config everywhere. Match spring to intent: bouncy for impact, smooth for reveals.
- Emoji as content (🏊💪😴). Use SVG paths or MCP icon tools instead.
- Placeholder SVG shapes (bare ellipse/rect). Use custom paths or professional icons.
- Constant glow/shadow. Tie intensity to sync points; use 3-layer alpha progression (88/44/22).
- Random gradient angles. Direction must encode meaning (90°=progression, radial=energy).
- Visual filler unrelated to narration. Every animation must connect to what's being said.
```

**Step 3: Verify no syntax errors**

Run:
```bash
cd packages/worker && python -c "from src.agents.prompts.animator import ANIMATOR_SYSTEM_PROMPT; print('OK' if 'ANTI-SLOP' in ANIMATOR_SYSTEM_PROMPT else 'MISSING')"
```
Expected: `OK`

**Step 4: Commit**

```bash
git add packages/worker/src/agents/prompts/animator.py
git commit -m "feat(worker): add condensed anti-slop rules to monolithic Animator prompt"
```

---

### Task 3: Add anti-slop rules to the per-scene prompt template

**Files:**
- Modify: `packages/worker/src/agents/prompts/animator.py` — find `ANIMATOR_SCENE_PROMPT_TEMPLATE` or `build_animator_scene_message` function

**Step 1: Find the per-scene prompt function**

Search for `build_animator_scene_message` or the function that builds the prompt for each individual scene implementation. This is where scene-specific instructions go.

**Step 2: Add a quality reminder to each scene prompt**

At the end of the per-scene message, add:

```
**QUALITY CHECK before completing this scene:**
- [ ] All entrances combine opacity + at least one transform (scale, translateX, translateY)
- [ ] Staggered elements use VARIED animation types (not all identical)
- [ ] Spring configs match intent (bouncy for impact, smooth for reveal)
- [ ] No emoji content, no placeholder SVG shapes
- [ ] Glow/shadow intensifies at sync points
- [ ] Every sync point has a corresponding visual change
- [ ] Uses `useScale()` for all pixel values, `FONT_PAIRS` for fonts
- [ ] Studio background (`THEME.background` + DotGrid) present (non-overlay scenes)
```

**Step 3: Verify template renders**

Run:
```bash
cd packages/worker && python -c "
from src.agents.prompts.animator import build_animator_scene_message
result = build_animator_scene_message(
    scene_data={'id': 1, 'name': 'Test', 'frames': [0, 300], 'visual': 'test', 'syncPoints': [], 'keySync': {'word': 'test', 'frame': 50}},
    project_id='test',
    style_preset='studio-dark',
    total_scenes=3
)
print('OK' if 'QUALITY CHECK' in result else 'MISSING')
"
```
Expected: `OK`

**Step 4: Commit**

```bash
git add packages/worker/src/agents/prompts/animator.py
git commit -m "feat(worker): add per-scene quality checklist to Animator scene prompt"
```

---

### Task 4: Update workspace CLAUDE.md files with anti-slop reminders

**Files:**
- Modify: `packages/worker/workspace/CLAUDE.md`
- Modify: `packages/worker/workspace/.claude/CLAUDE.md`

**Step 1: Read current CLAUDE.md files**

Read both files to find the "Common Gotchas" or "Code Style" sections.

**Step 2: Add anti-slop section to both files**

Add after the "Common Gotchas" section in both files:

```markdown
## Anti-Slop Animation Rules
- NEVER animate with opacity alone — combine opacity + scale + translateY at minimum
- NEVER use the same spring config for all animations — match config to intent
- NEVER use emoji as content — use SVG paths or Iconify/Freepik MCP tools
- NEVER use bare ellipse/rect SVG — use custom paths or professional icons
- ALWAYS tie glow/shadow intensity to narrative sync points
- ALWAYS vary animation types across staggered elements (pop, slide, scale, rotate)
- ALWAYS ensure every sync point has a corresponding visual change
- ALWAYS use `useScale()` and `FONT_PAIRS` (studio preset)
```

**Step 3: Commit**

```bash
git add packages/worker/workspace/CLAUDE.md packages/worker/workspace/.claude/CLAUDE.md
git commit -m "feat(worker): add anti-slop animation rules to workspace CLAUDE.md files"
```

---

### Task 5: Verify all changes work end-to-end

**Step 1: Run full import test**

```bash
cd packages/worker && python -c "
from src.agents.prompts.animator import get_studio_section, ANIMATOR_SYSTEM_PROMPT, build_animator_scene_message
from src.agents.prompts.director import get_style_description

# Test studio section
studio = get_studio_section('studio-dark')
assert 'RULE 1' in studio, 'Anti-slop rules missing from studio section'
assert '#0B0F1A' in studio, 'Theme colors missing'
assert 'MANDATORY' in studio, 'Theme immersion missing'

# Test monolithic prompt
assert 'ANTI-SLOP' in ANIMATOR_SYSTEM_PROMPT, 'Anti-slop missing from monolithic prompt'

# Test director
director = get_style_description('studio-dark')
assert 'studio-dark' in director, 'Style preset not injected'
assert 'WRONG' in director, 'colorPalette rule missing'

print('ALL CHECKS PASSED')
"
```
Expected: `ALL CHECKS PASSED`

**Step 2: Verify no Python syntax errors in full module**

```bash
cd packages/worker && python -c "import src.agents.prompts.animator; import src.agents.prompts.director; print('Import OK')"
```
Expected: `Import OK`

**Step 3: Commit (if any fixes needed)**

Only if previous steps required fixes.
