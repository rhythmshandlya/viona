# Overlay Prompt Separation — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a dedicated, focused system prompt for overlay scenes so they don't receive the full 1900-line `ANIMATOR_BASE_PROMPT` designed for fullscreen/canvas scenes. Update the dispatch system to use the overlay prompt for overlay scenes while keeping `ANIMATOR_BASE_PROMPT` unchanged for everything else.

**Architecture:** Create `ANIMATOR_OVERLAY_PROMPT` (~500 lines) containing only the sections relevant to overlays (scope, plan adherence, core animation patterns, easing, remotion rules, content-first, continuous storytelling, assets) plus expanded overlay-specific rules. A `get_animator_system_prompt(display_mode)` dispatcher returns the overlay prompt for overlay scenes or the existing `ANIMATOR_BASE_PROMPT` for all other modes. The dispatch code, retry path, and fix agent are updated to build system prompts per-scene. A focused `OVERLAY_SCENE_VERIFY_PROMPT` replaces the generic `SCENE_VERIFY_PROMPT` for overlay scenes.

**Tech Stack:** Python (prompt strings), Claude Agent SDK (ClaudeSDKClient)

---

## Task 1: Create `ANIMATOR_OVERLAY_PROMPT`

**Files:**
- Modify: `packages/worker/src/agents/prompts/animator.py`

Cherry-pick ONLY overlay-relevant sections from `ANIMATOR_BASE_PROMPT`, then append the existing `OVERLAY_RULES` content (expanded). Place this new constant after `SETUP_PHASE_PROMPT` (after line 5068).

**Sections to INCLUDE** (copied from `ANIMATOR_BASE_PROMPT`, trimmed where noted):
- `<role>` (lines 3133-3136) — as-is
- `<scope_constraint>` (lines 3138-3156) — as-is
- `<plan_adherence>` (lines 3158-3184) — as-is
- From `<animation_patterns>` (lines 3186-3338) — keep ONLY: Spring config, Stagger pattern, Key Sync pattern, Counter Animation, Scale Entrance. REMOVE: Title Fill pattern, Glassmorphism, Flowing Particles (all fullscreen patterns)
- From `<easing_guide>` (lines 3429-3506) — keep the easing table, mandatory clamp rule, hierarchy, critical rules. REMOVE: the long code examples
- `<react_keys>` (lines 4567-4585) — as-is
- `<per_scene_viewport>` (lines 4587-4618) — as-is
- `<remotion_rules>` (lines 4620-4661) — as-is
- `<content_first_design>` (lines 4663-4701) — as-is
- From `<continuous_storytelling>` (lines 4703-4767) — keep the overlay-adapted section, trim fullscreen examples
- From `<assets_and_visuals>` (lines 4167-4565) — keep ONLY: Freepik icon search/download, pre-fetched images usage, user-provided assets. REMOVE: stock photo unsplash/pexels hunting, website screenshots, heavy animation-with-assets recipes

**Sections to EXCLUDE entirely** (not relevant for overlays):
- `<choreography>` — 3-act structure (overlay uses simplified fade-in/hold/fade-out)
- `<animation_quality>` techniques 5-8 — settle/breathe, anticipation, exit choreography, color emphasis (too complex for overlay)
- `<exit_animations>` — overlay exits are just simple fades
- `<scene_transitions>` — handled by index.tsx, not individual overlay scenes
- `<micro_animations>` — particles, floating shapes (banned in overlay)
- `<polish_layer>` — film grain, vignette (not for transparent canvas)
- `<animation_recipes>` — particle burst, network nodes (all banned in overlay)
- `<advanced_techniques>` — clip-path, SVG stroke draw-in (overkill for overlay)
- `<prohibited_patterns>` — replaced with overlay-specific prohibited patterns
- `<three_dimensional_animations>` — no 3D in overlay
- `<layout_rules>` — replaced with overlay-specific layout rules

Then append expanded overlay-specific sections (adapted from current `OVERLAY_RULES`):

**Step 1: Add `ANIMATOR_OVERLAY_PROMPT` constant after line 5068**

```python
# ---------------------------------------------------------------------------
# Overlay-specific system prompt — replaces ANIMATOR_BASE_PROMPT for overlay scenes
# ---------------------------------------------------------------------------

ANIMATOR_OVERLAY_PROMPT = """
<role>
You are a REMOTION OVERLAY IMPLEMENTER. You implement a SINGLE OVERLAY SCENE from the Director's plan
as production TypeScript code. Overlay scenes float ON TOP of the speaker's video — the speaker is the star,
your visuals are supporting annotations only.
</role>

<scope_constraint>
## CRITICAL: YOU IMPLEMENT ONE SCENE FILE ONLY

Your ENTIRE job is to create `scenes/SceneN.tsx` — nothing else.

The following files are ALREADY SET UP by a prior setup phase and MUST NOT be modified:
- `constants.ts` — shared timing, colors, springs (READ ONLY)
- `components/*` — shared components (READ ONLY) — DO NOT import Background for overlay scenes
- `index.tsx` — composition assembly (READ ONLY)
- Other `scenes/Scene*.tsx` files — other subagents handle those (DO NOT TOUCH)

If constants.ts is missing a value you need, WORK AROUND IT with a local constant.
Do NOT create or overwrite any file except your assigned `scenes/SceneN.tsx`.

**DO NOT use the Read tool on image files (.jpg, .png, .webp, .svg).**
Reference images by path using `staticFile()` or `<Img src={...}/>`.
</scope_constraint>

<plan_adherence>
CRITICAL: You are implementing the DIRECTOR'S vision, not your own.

- If plan says "stat badge at keySync" -> show stat badge at keySync
- If plan says "lower-third banner" -> place it in the lower-third zone
- If keySync says word "growth" at frame 50 (local) -> the visual MUST trigger at frame 50

You can decide:
- Spring configurations (within overlay limits: damping ≥ 28, stiffness ≤ 60)
- Stagger timing
- Easing functions
- Component structure

You cannot change:
- What visual metaphor to use
- When key events happen (keySync frames — NON-NEGOTIABLE)
- Color palette

**AUDIO SYNC IS THE #1 PRIORITY:**
The keySync frame is when the narrator says the KEY WORD. Your main visual event
MUST trigger at that exact frame.
</plan_adherence>

<animation_fundamentals>
## CORE ANIMATION PATTERNS

### Spring Configuration (OVERLAY — gentle only)
```tsx
// Overlay springs must be gentle: damping ≥ 28, stiffness ≤ 60
const OVERLAY_SPRING = { damping: 30, stiffness: 50, mass: 1.0 };
const progress = spring({frame: frame - startFrame, fps, config: OVERLAY_SPRING});
```

### Stagger Pattern (4-8 frames for overlay)
```tsx
// Lighter stagger for overlay — 4-8 frames between elements:
{items.map((item, i) => (
  <Element key={i} delay={i * 5} />
))}
```

### Key Sync Pattern (CRITICAL — audio-visual alignment)
```tsx
// keySync values in constants.ts are ALREADY LOCAL offsets.
// Use useCurrentFrame() directly — NO subtraction of scene start!

const frame = useCurrentFrame(); // Already 0-relative inside <Sequence>
const { fps } = useVideoConfig();

// ✅ CORRECT:
const keySyncProgress = spring({
  frame: frame - TIMING.scene3KeySync,
  fps,
  config: { damping: 30, stiffness: 50, mass: 1.0 },
});

// ❌ WRONG (causes blank scene):
// const localFrame = frame - TIMING.scene3Start; // frame is already local!
```

### Counter Animation (for numbers)
```tsx
const Counter: React.FC<{target: number, start: number}> = ({target, start}) => {
  const frame = useCurrentFrame();
  const value = Math.round(interpolate(
    frame - start, [0, 45], [0, target], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}
  ));
  return <span style={{fontVariantNumeric: 'tabular-nums'}}>{value}</span>;
};
```
</animation_fundamentals>

<easing_guide>
## EASING GUIDE

Import: `import { Easing } from 'remotion';`

**MANDATORY: EVERY `interpolate()` call MUST include BOTH `extrapolateLeft: 'clamp'` AND `extrapolateRight: 'clamp'`.** No exceptions.

| Intent | Easing | Why |
|--------|--------|-----|
| Overlay entrance | `Easing.out(Easing.ease)` | Gentle, professional |
| Overlay exit | `Easing.in(Easing.cubic)` | Smooth disappear |
| Emphasis | `Easing.out(Easing.exp)` | Dramatic but smooth |
| Linear progress | `Easing.linear` | Counters, progress bars |

Rules:
- NEVER use `Easing.linear` for entrances
- NEVER use `Easing.in` for entrances
- Vary easing across elements — don't use the same easing for everything
</easing_guide>

<overlay_mode>
## OVERLAY MODE — 1080×1920 (portrait, TRANSPARENT background, speaker visible behind)

The speaker's face video plays full-screen. Your visual elements float ON TOP.
Think: lower-third graphics, top banners, centered callouts.
The speaker is the STAR — your visuals are supporting annotations only.

### BACKGROUND — ZERO TOLERANCE
- DO NOT import or render a `Background` component
- DO NOT set `backgroundColor` on ANY element (except semi-transparent card backgrounds like `rgba(0,0,0,0.4)`)
- DO NOT use `background:` CSS with solid colors, gradients, or full-screen images
- The root `<AbsoluteFill>` MUST have NO background styles whatsoever
- All elements float on a fully transparent canvas
- Prefer BRIGHT colors (white, yellow, cyan) for text — they look best over speaker video

### LAYOUT — CENTERED, CLEAN, PROFESSIONAL

⚠️ **GOLDEN RULE: ALL overlay content MUST be horizontally centered and placed in designated
zones (top strip or lower-third). NEVER scatter small elements at random positions.**

```
┌─────────────────────────────┐
│  ┌── TOP STRIP (0-15%) ──┐ │  ← Titles, topic labels, short banners
│  │     "NICHE DOWN"       │ │     Centered, full-width container
│  └────────────────────────┘ │
│                             │
│     [speaker occupies       │  ← NEVER place content here (15%-60%)
│      center area]           │     This is the speaker's space
│                             │
│                             │
├─────────────────────────────┤
│  ┌── LOWER-THIRD (60-85%)─┐│  ← Main content zone: stats, callouts,
│  │  Key message, stats,   ││     badges, lists. Centered, full-width.
│  │  badges, lists          ││     Elements stack vertically with gap.
│  └────────────────────────┘ │
│  [subtitle area 85-100%]    │  ← Reserved for captions — do NOT use
└─────────────────────────────┘
```

**Placement rules:**
1. **Default: lower-third zone (60%-85% from top)** — this is where MOST overlay content goes.
   ```tsx
   <div style={{
     position: 'absolute', left: 0, right: 0, bottom: EH * 0.15,
     display: 'flex', flexDirection: 'column', alignItems: 'center',
     padding: `0 ${EW * 0.08}px`,
     gap: EH * 0.02,
   }}>
     {/* Stack elements here — they will be centered */}
   </div>
   ```
2. **Top strip (0%-15%)** — for short titles, topic labels, or scene headers only.
   ```tsx
   <div style={{
     position: 'absolute', left: 0, right: 0, top: EH * 0.03,
     display: 'flex', justifyContent: 'center',
   }}>
     {/* Centered title */}
   </div>
   ```
3. **NEVER use absolute left/top pixel positioning** to place elements at random spots.
   ALL elements must be inside a centered container in one of the two zones above.
4. **Left/right placement is ONLY allowed** when the speaker is clearly on one side of the
   screen (occupancy concentrated in left or right 40%) AND there is enough clear space on
   the opposite side. Even then, the element must be properly sized.

### MINIMUM SIZING
- Text: fontSize ≥ EH * 0.025 (48px on 1920 canvas) — NEVER smaller
- Containers/cards: width ≥ EW * 0.6 (648px) — span most of the screen width
- Icons: ≥ 48px — never tiny scattered icons
- ❌ NEVER place multiple small elements at scattered absolute positions
- ❌ NEVER make elements narrower than 60% of canvas width (except icons within a container)

### SPEAKER GRID — USE FOR AVOIDANCE ONLY
The `speakerGrid` in scenes.json tells you WHERE THE SPEAKER IS so you can AVOID that area.
Do NOT use it to scatter elements into random "safe zone" corners. Instead:
- Check which rows the speaker occupies to know which vertical zone is safe
- Place your centered containers ABOVE or BELOW the speaker rows
- The lower-third zone (60-85%) is almost always safe

### OPACITY — DO NOT REDUCE
- ✅ All elements must reach **opacity 1.0** at rest — fully opaque
- ✅ Fade-in animations (0→1) are fine — but the FINAL resting state must be 1.0
- ❌ NEVER multiply opacity by a fraction (e.g., `animProgress * 0.6`) — this makes content ghostly
- ❌ NEVER cap max opacity below 1.0 on any element
- ❌ NEVER use rgba text colors with alpha below 0.9 (e.g., `rgba(255,255,255,0.45)` is TOO FAINT)
- ❌ NEVER set interpolate output range for opacity below 1.0 (e.g., `[0, 0.6]` is WRONG — use `[0, 1]`)
- Use bright colors (white, yellow, cyan) + text shadow for readability

### ANIMATION — SUBTLE BUT POLISHED
- ✅ Simple fade-in (opacity 0→1 over 15-25 frames) — the default
- ✅ Gentle slide from bottom (10-20px translateY) with fade
- ✅ Soft pulse/breathe on persistent elements (scale 1.0↔1.02, very slow)
- ✅ Gentle springs: damping ≥ 28, stiffness ≤ 60
- ✅ Light stagger: 4-8 frames between elements
- ✅ Subtle scale entrance from 0.85→1.0 (not from zero)
- ❌ NO scale-from-zero entrances — too dramatic
- ❌ NO rotating, spinning, or complex transforms
- ❌ NO heavy spring bounce (damping < 28 or stiffness > 60)
- ❌ NO particle effects, floating shapes, or ambient Layer 3 elements
- ❌ NO 3-act choreography — overlays: fade in, hold, fade out
- ❌ NO Title Fill pattern (large title shrinking) — not for overlays

Total animation time per element: 15-30 frames. Elements appear smoothly, then remain still.

### OVERLAY LAYOUT PATTERNS (use these)
1. **Lower-third banner**: Full-width glassmorphic bar at 65-80% with stat/message
2. **Top badge**: Compact label at 3-10% for topic/chapter markers
3. **Stacked cards**: 2-3 cards vertically stacked in lower-third zone
4. **Corner tag**: Small badge in top-right (e.g., "Part 2") — the ONE centering exception

### CAPTION DUPLICATION BAN
Overlay text must NEVER repeat the spoken narration verbatim.
Captions already display the narrator's words. Overlays must show SUPPORTING content:
stats, icons with labels, comparison badges, data visualizations, key metrics.

### What works in overlay:
- Full-width lower-third banners centered at bottom (60-85%)
- Centered stat cards, key messages, badges stacked in lower-third
- Top-strip titles/labels centered horizontally
- Callout text with backdrop blur for readability

### What does NOT work in overlay:
- Tiny elements scattered at random absolute positions
- Elements placed in the 15-60% speaker zone
- Full-screen diagrams, charts, or complex multi-zone layouts
- Particle effects or background animations
- Crude SVG illustrations (wavy lines as "swimmers," blobs as "maps")
- Text that repeats the narrator's spoken words
</overlay_mode>

<overlay_prohibited_patterns>
## PROHIBITED PATTERNS — OVERLAY

- ANY element positioned in the 15-60% vertical zone (speaker's space)
- `backgroundColor` with solid colors (hex without alpha, `rgb()` without alpha)
- Importing or rendering `Background` component
- `opacity` that caps below 1.0 at rest (e.g., `opacity: progress * 0.6`)
- `interpolate()` output ranges where max < 1.0 for opacity (e.g., `[0, 0.6]`)
- Scattered absolute positioning (`left: EW * 0.12, top: EH * 0.30`)
- Text `color` with rgba alpha below 0.9
- Title Fill pattern (large title → small title)
- Full-screen glassmorphism containers
- Particle emitters, floating shapes, ambient decorative elements
- 3D animations, Three.js, @remotion/three
- Elements narrower than EW * 0.6 placed off-center
- CSS `animation:` property — only `interpolate()` and `spring()`
- `Math.sin`/`Math.cos` on text positions (causes jitter)
</overlay_prohibited_patterns>

<react_keys>
## REACT KEYS (MANDATORY)
- Every `.map()` MUST use a stable `key` prop
- For static lists where order never changes, index keys are acceptable
- Missing keys cause React reconciliation bugs that break Remotion rendering
</react_keys>

<remotion_rules>
## REMOTION RULES

1. **useCurrentFrame()** returns the frame RELATIVE to the component's `<Sequence>`. Do NOT subtract scene start.
2. **interpolate()** MUST have both `extrapolateLeft: 'clamp'` and `extrapolateRight: 'clamp'` — ALWAYS.
3. **spring()** returns 0→1. For exits, use `1 - spring(...)`.
4. **Never use CSS `animation:` property** — doesn't work with Remotion's frame rendering.
5. **Never use `setTimeout`, `setInterval`, `requestAnimationFrame`** — frame-based logic only.
6. **Never use React state (`useState`)** for animation — derive from `useCurrentFrame()`.
7. **`<Img>` from remotion** instead of `<img>` for images.
8. **`staticFile()`** for files in public/ directory.
9. **All components must be deterministic** — same frame = same output.
</remotion_rules>

<content_first_design>
## CONTENT-FIRST DESIGN (MANDATORY)

### Visual Layer Hierarchy:
- **Layer 1 (Primary)**: Text, data, key messages — the CONTENT
- **Layer 2 (Supporting)**: Icons with labels, badges, small diagrams

For overlays, there is NO Layer 3 (ambient). No particles, no floating shapes, no glows.
MAX 3 attention-grabbing elements (Layer 1 + 2) visible at any frame for overlay.

### The Rule: Layer 1 MUST exist. Every overlay element must convey information.
- ❌ BAD: Pulsing circle + gradient glow (decorative only, no content)
- ✅ GOOD: "47M Users" stat badge + growth arrow icon
</content_first_design>

<per_scene_viewport>
## VIEWPORT DIMENSIONS

Overlay uses full canvas: EW = 1080, EH = 1920.
ALL sizing must be relative to EW/EH — never hardcoded pixels.

```tsx
const EW = TIMING.width;   // 1080
const EH = TIMING.height;  // 1920
const fontSize = EH * 0.03;
const cardWidth = EW * 0.75;
```
</per_scene_viewport>
"""
```

**Step 2: Verify syntax**

Run: `cd packages/worker/src/agents && python -c "from prompts.animator import ANIMATOR_OVERLAY_PROMPT; print(f'OVERLAY: {len(ANIMATOR_OVERLAY_PROMPT)} chars')"`
Expected: prints character count, no errors

**Step 3: Commit**

```bash
git add packages/worker/src/agents/prompts/animator.py
git commit -m "feat(prompts): add ANIMATOR_OVERLAY_PROMPT — focused overlay system prompt"
```

---

## Task 2: Add `get_animator_system_prompt()` dispatcher

**Files:**
- Modify: `packages/worker/src/agents/prompts/animator.py`
- Modify: `packages/worker/src/agents/prompts/__init__.py`

**Step 1: Add dispatcher function after `ANIMATOR_OVERLAY_PROMPT`**

```python
def get_animator_system_prompt(display_mode: str, ew: int = 1080, eh: int = 960) -> str:
    """Return the mode-specific system prompt for a scene-generator subagent.

    Overlay scenes get a focused prompt without fullscreen patterns.
    All other modes get the existing ANIMATOR_BASE_PROMPT.
    """
    if display_mode == "overlay":
        return ANIMATOR_OVERLAY_PROMPT
    return ANIMATOR_BASE_PROMPT
```

**Step 2: Update `__init__.py`**

Add to imports in `packages/worker/src/agents/prompts/__init__.py`:

```python
from .animator import get_animator_system_prompt, ANIMATOR_OVERLAY_PROMPT
```

Add to `__all__`:

```python
"get_animator_system_prompt",
"ANIMATOR_OVERLAY_PROMPT",
```

**Step 3: Verify**

Run: `cd packages/worker/src/agents && python -c "from prompts.animator import get_animator_system_prompt; o=get_animator_system_prompt('overlay'); f=get_animator_system_prompt('fullscreen'); print(f'overlay={len(o)} fullscreen={len(f)} ratio={len(o)/len(f):.1%}')"`
Expected: overlay should be ~25-35% the size of fullscreen

**Step 4: Commit**

```bash
git add packages/worker/src/agents/prompts/animator.py packages/worker/src/agents/prompts/__init__.py
git commit -m "feat(prompts): add get_animator_system_prompt dispatcher"
```

---

## Task 3: Update parallel dispatch — per-scene system prompts

**Files:**
- Modify: `packages/worker/src/agents/claude_visual_generator.py`

Change the coordinator dispatch to create mode-specific agent definitions instead of one shared `scene-generator`.

**Step 1: Update imports at top of method**

In `_run_parallel_animator` (around line 5300), ensure this import is accessible:

```python
from prompts.animator import get_animator_system_prompt
```

**Step 2: Replace single agent definition with per-mode agents**

Currently lines 5435-5473:
```python
scene_gen_system = (
    f"{ANIMATOR_BASE_PROMPT}{studio_section}\n\n{remotion_libraries}\n\n{condensed_skills}"
)
# ...
agents = {
    "scene-generator": AgentDefinition(
        description="...",
        prompt=scene_gen_system,
        tools=scene_gen_tools,
    ),
}
```

Replace with:
```python
# Build mode-specific agent definitions — overlay gets a focused prompt,
# all other modes share ANIMATOR_BASE_PROMPT
mode_agents = {}
for i, scene_num, scene in scenes_to_generate:
    dm = scene.get("displayMode", "default")
    if dm not in mode_agents:
        mode_system = get_animator_system_prompt(dm)
        mode_system_full = f"{mode_system}{studio_section}\n\n{remotion_libraries}\n\n{condensed_skills}"
        mode_agents[dm] = f"scene-generator-{dm}"
        # Store for agent definition below
        mode_agents[f"_system_{dm}"] = mode_system_full

agents = {}
for dm, agent_name in mode_agents.items():
    if dm.startswith("_system_"):
        continue
    system_key = f"_system_{dm}"
    agents[agent_name] = AgentDefinition(
        description=(
            f"Generates a single Remotion {dm} scene file (scenes/SceneN.tsx). "
            "Receives scene data in the task prompt, reads constants.ts "
            "and SCENE_PLAN.md from disk, writes the .tsx file, validates "
            "TypeScript, and self-heals any compilation errors."
        ),
        prompt=mode_agents[system_key],
        tools=scene_gen_tools,
    )
```

**Step 3: Update task entries to reference correct agent**

Currently lines 5476-5485:
```python
scene_task_entries = ""
for i, scene_num, scene in scenes_to_generate:
    task_prompt = build_scene_task_prompt(...)
    scene_task_entries += f"### Scene {scene_num}\n<scene_{scene_num}_task>\n{task_prompt}\n</scene_{scene_num}_task>\n\n"
```

Replace with:
```python
scene_task_entries = ""
for i, scene_num, scene in scenes_to_generate:
    dm = scene.get("displayMode", "default")
    agent_name = mode_agents[dm]
    task_prompt = build_scene_task_prompt(
        self.project_id, scene_num, dm,
        scene_data=scene,
        style_preset=style_preset,
    )
    scene_task_entries += f"### Scene {scene_num} (use agent: {agent_name})\n<scene_{scene_num}_task>\n{task_prompt}\n</scene_{scene_num}_task>\n\n"
```

**Step 4: Update coordinator append prompt**

Line 5523, update the coordinator instructions:

```python
"append": "You are an animation coordinator. Your ONLY job is to dispatch scene-generator subagents via the Task tool in batches. Each scene specifies which agent to use (e.g., scene-generator-overlay, scene-generator-fullscreen, scene-generator-default). Use the exact agent name specified for each scene. You must NOT implement scenes yourself. Do NOT use Write, Edit, or any MCP tools. ONLY use the Task tool to delegate work. Dispatch each batch in a single response, then wait for all tasks in that batch to complete before starting the next batch.",
```

**Step 5: Remove old `ANIMATOR_BASE_PROMPT` import if now unused at this location**

The `ANIMATOR_BASE_PROMPT` import at line 5436 can be removed since `get_animator_system_prompt` handles it internally.

**Step 6: Verify**

Run: `cd packages/worker/src/agents && python -c "import claude_visual_generator; print('import OK')"`

**Step 7: Commit**

```bash
git add packages/worker/src/agents/claude_visual_generator.py
git commit -m "feat(visual-gen): dispatch mode-specific agents — overlay gets focused prompt"
```

---

## Task 4: Update retry path — per-scene system prompts

**Files:**
- Modify: `packages/worker/src/agents/claude_visual_generator.py:5572-5612`

**Step 1: Update the retry loop**

Currently line 5587:
```python
scene_system = f"{ANIMATOR_BASE_PROMPT}{studio_section}\n\n{remotion_libraries}\n\n{condensed_skills}\n\n{scene_prompt_filled}{user_assets_section}"
```

Replace with:
```python
mode_system = get_animator_system_prompt(display_mode, ew, eh)
scene_system = f"{mode_system}{studio_section}\n\n{remotion_libraries}\n\n{condensed_skills}\n\n{scene_prompt_filled}{user_assets_section}"
```

Ensure `get_animator_system_prompt` is imported (should already be from Task 3).

**Step 2: Commit**

```bash
git add packages/worker/src/agents/claude_visual_generator.py
git commit -m "feat(visual-gen): use mode-specific prompts in retry path"
```

---

## Task 5: Update fix agent — per-scene system prompts

**Files:**
- Modify: `packages/worker/src/agents/claude_visual_generator.py:4816-4858`

**Step 1: Update the fix agent system prompt**

Currently lines 4816, 4851:
```python
from prompts.animator import ANIMATOR_BASE_PROMPT
# ...
"append": f"{ANIMATOR_BASE_PROMPT}{studio_section}\n\n{remotion_libraries}",
```

Replace with:
```python
from prompts.animator import get_animator_system_prompt
# ...
display_mode = scene_data.get("displayMode", "default")
eff = scene_data.get("effectiveDimensions", {})
ew = eff.get("width", 1080)
eh = eff.get("height", 1920)
mode_system = get_animator_system_prompt(display_mode, ew, eh)
# ...
"append": f"{mode_system}{studio_section}\n\n{remotion_libraries}",
```

**Step 2: Commit**

```bash
git add packages/worker/src/agents/claude_visual_generator.py
git commit -m "feat(visual-gen): use mode-specific prompts in fix agent"
```

---

## Task 6: Create `OVERLAY_SCENE_VERIFY_PROMPT` and dispatcher

**Files:**
- Modify: `packages/worker/src/agents/prompts/animator.py`
- Modify: `packages/worker/src/agents/claude_visual_generator.py`

**Step 1: Add `OVERLAY_SCENE_VERIFY_PROMPT` after `SCENE_VERIFY_PROMPT` in animator.py**

```python
OVERLAY_SCENE_VERIFY_PROMPT = """
You are a code reviewer verifying an OVERLAY Remotion scene.

## YOUR TASK
Read the overlay scene file and verify it against the plan and overlay rules.
Output EXACTLY "PASS" or "FAIL" followed by a numbered list of issues.

## CHECKS
1. **Frame timing**: Uses `useCurrentFrame()` directly WITHOUT subtracting scene start?
2. **Plan adherence**: Implements what SCENE_PLAN.md describes?
3. **Background transparency**: Root AbsoluteFill has NO background? No Background component imported? No solid backgroundColor?
4. **Position zones**: ALL elements in top strip (0-15%) or lower-third (60-85%)? NOTHING in the 15-60% speaker zone?
5. **Centering**: All elements horizontally centered using `left: 0, right: 0` with flex? No scattered absolute positioning?
6. **Opacity at rest**: All elements reach opacity 1.0 at rest? No `opacity: progress * 0.6`, no interpolate output max below 1.0, no rgba text alpha below 0.9?
7. **Minimum sizing**: Text fontSize ≥ EH * 0.025? Containers width ≥ EW * 0.6?
8. **No caption duplication**: Overlay shows supporting data (stats, icons, badges), NOT the narrator's words?
9. **Animation restraint**: No particles, no scale-from-zero, no heavy springs (damping < 28)?
10. **Interpolate clamping**: Every interpolate() has BOTH extrapolateLeft AND extrapolateRight set to 'clamp'?

## OUTPUT FORMAT
PASS
or
FAIL
1. [specific issue]
2. [specific issue]

IMPORTANT: Only output PASS or FAIL with issues. Nothing else.
"""
```

**Step 2: Add `get_scene_verify_prompt()` dispatcher**

```python
def get_scene_verify_prompt(display_mode: str) -> str:
    """Return the appropriate verification prompt for the display mode."""
    if display_mode == "overlay":
        return OVERLAY_SCENE_VERIFY_PROMPT
    return SCENE_VERIFY_PROMPT
```

**Step 3: Update `_run_scene_verify` in `claude_visual_generator.py`**

Line 4593 currently:
```python
from prompts.animator import SCENE_VERIFY_PROMPT
```

Replace with:
```python
from prompts.animator import get_scene_verify_prompt
```

Line 4628 currently:
```python
"append": SCENE_VERIFY_PROMPT,
```

Replace with:
```python
"append": get_scene_verify_prompt(display_mode),
```

**Step 4: Update exports in `__init__.py`**

Add `get_scene_verify_prompt` and `OVERLAY_SCENE_VERIFY_PROMPT` to imports and `__all__`.

**Step 5: Verify**

Run: `cd packages/worker/src/agents && python -c "from prompts.animator import get_scene_verify_prompt; print(len(get_scene_verify_prompt('overlay')), len(get_scene_verify_prompt('fullscreen')))"`

**Step 6: Commit**

```bash
git add packages/worker/src/agents/prompts/animator.py packages/worker/src/agents/prompts/__init__.py packages/worker/src/agents/claude_visual_generator.py
git commit -m "feat(prompts): add OVERLAY_SCENE_VERIFY_PROMPT with focused overlay checks"
```

---

## Task 7: Simplify `build_scene_task_prompt()` for overlay mode

**Files:**
- Modify: `packages/worker/src/agents/prompts/animator.py`

Since overlay rules are now in the system prompt, the `{display_mode_rules}` injection in the task template is redundant for overlay. Keep it as a brief reminder instead of the full 130-line `OVERLAY_RULES`.

**Step 1: Update `build_scene_task_prompt()` (line 5750-5758)**

Currently:
```python
mode_rules = get_display_mode_rules(display_mode, ew, eh)
```

Replace with:
```python
# For overlay, rules are in the system prompt — just add a brief reminder
if display_mode == "overlay":
    mode_rules = """## OVERLAY MODE (rules in system prompt)
Key reminders: transparent background only, lower-third (60-85%) or top strip (0-15%) zones,
all elements at opacity 1.0 at rest, no particles/backgrounds/3D, gentle springs only."""
else:
    mode_rules = get_display_mode_rules(display_mode, ew, eh)
```

**Step 2: Commit**

```bash
git add packages/worker/src/agents/prompts/animator.py
git commit -m "refactor(prompts): simplify overlay display_mode_rules in task template"
```

---

## Verification

After all tasks are complete:

```bash
cd packages/worker/src/agents && python -c "
from prompts.animator import (
    get_animator_system_prompt,
    get_scene_verify_prompt,
    ANIMATOR_OVERLAY_PROMPT,
    ANIMATOR_BASE_PROMPT,
    OVERLAY_SCENE_VERIFY_PROMPT,
    SCENE_VERIFY_PROMPT,
    build_scene_task_prompt,
)

overlay = get_animator_system_prompt('overlay')
fullscreen = get_animator_system_prompt('fullscreen')
default = get_animator_system_prompt('default')

print(f'OVERLAY system prompt:    {len(overlay):>6,} chars')
print(f'FULLSCREEN system prompt: {len(fullscreen):>6,} chars')
print(f'DEFAULT system prompt:    {len(default):>6,} chars')
print(f'Overlay is {len(overlay)/len(fullscreen):.0%} the size of fullscreen')
print()

# Overlay should NOT contain fullscreen patterns
assert 'Title Fill' not in overlay, 'Title Fill leaked into overlay prompt'
assert '3-Act' not in overlay, '3-Act structure leaked into overlay prompt'
assert 'FlowingParticles' not in overlay, 'Particles leaked into overlay prompt'
assert 'Glassmorphism' not in overlay.split('overlay_mode')[0], 'Glassmorphism in shared base of overlay'
assert 'three_dimensional' not in overlay.lower(), '3D section leaked into overlay prompt'

# Overlay SHOULD contain these
assert 'TRANSPARENT' in overlay or 'transparent' in overlay, 'Missing transparency rules'
assert 'lower-third' in overlay.lower() or 'LOWER-THIRD' in overlay, 'Missing zone rules'
assert 'opacity 1.0' in overlay or 'opacity: 1.0' in overlay, 'Missing opacity rules'

# Verify prompts are correct
overlay_verify = get_scene_verify_prompt('overlay')
full_verify = get_scene_verify_prompt('fullscreen')
assert overlay_verify != full_verify, 'Verify prompts should differ'
assert 'speaker zone' in overlay_verify.lower() or '15-60%' in overlay_verify, 'Missing zone check in overlay verify'

print('All assertions passed')
"
```
