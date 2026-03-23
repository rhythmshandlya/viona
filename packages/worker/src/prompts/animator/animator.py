"""
Animator Agent Prompts

The Animator reads the Director's plan and implements it as Remotion TypeScript code,
maintaining a TODO list and logging reasoning for each scene.
"""

import json

from prompts._loader import load_prompt, load_shared_modules
from prompts.theme_loader import get_design_system, get_theme


def get_studio_section(style_preset: str) -> str:
    """Return the design system prompt for the given theme, or empty string."""
    if not get_theme(style_preset):
        return ""
    return get_design_system(style_preset)


# ---------------------------------------------------------------------------
# Video overlay section — injected when a scene has a video background
# ---------------------------------------------------------------------------

VIDEO_OVERLAY_SECTION = load_prompt('animator/video-overlay-section')


def get_video_overlay_section(has_video_scenes: bool) -> str:
    """Return the video overlay section if any scene has video backgrounds."""
    if has_video_scenes:
        return VIDEO_OVERLAY_SECTION
    return ""


# ---------------------------------------------------------------------------
# YouTube Clip Scene section — for scenes where type === "youtube-clip"
# ---------------------------------------------------------------------------

YOUTUBE_CLIP_SCENE_SECTION = load_prompt('animator/youtube-clip-section')


def get_youtube_clip_section(has_youtube_clip_scenes: bool) -> str:
    """Return the youtube-clip scene section if any scene has type: youtube-clip."""
    if has_youtube_clip_scenes:
        return YOUTUBE_CLIP_SCENE_SECTION
    return ""


ANIMATOR_SYSTEM_PROMPT = load_shared_modules() + "\n\n" + load_prompt('animator/system')


def build_animator_user_message(project_id: str, style_preset: str = "studio-dark") -> str:
    """Build the user message for the Animator agent."""
    # Composition ID must use dashes (Remotion requirement), folder uses underscores
    composition_id = project_id.replace("_", "-")

    base_message = f"""
## CRITICAL: READ THIS FIRST

**⚠️ WARNING: DO NOT EXIT AFTER JUST READING FILES ⚠️**

Reading SCENE_PLAN.md and scenes.json is NOT completion.
You MUST WRITE index.tsx with actual implementation code.
If you exit without creating index.tsx, the task FAILS.

**YOU MUST WORK ONE SCENE AT A TIME.**

The correct workflow is:
1. Read the plan files (THIS IS JUST THE BEGINNING, NOT THE END)
2. Create TODO list with TodoWrite (BEFORE any code)
3. Write constants.ts with colors/timing
4. For EACH scene:
   - Mark TODO in_progress
   - Write reasoning to IMPLEMENTATION_LOG.md
   - THEN write the code for that ONE scene to index.tsx
   - Mark TODO completed
5. Write metadata.json
6. Run TypeScript validation

**DO NOT write all scenes in one file at once. This is wrong.**
**DO NOT exit after just reading - you must WRITE files.**

---

## YOUR TASK

Implement the animation plan created by the Visual Director.

### Step 1: Read the Plan
Read these files from `src/{project_id}/`:
- `SCENE_PLAN.md` - The Director's visual story plan
- `scenes.json` - Machine-readable scene data

Understand the plan completely before writing any code.

### Step 2: Create TODO List (MANDATORY - DO THIS NOW)
Use TodoWrite IMMEDIATELY to create one item per scene from scenes.json.
Do not skip this step. Do not write code before creating the TODO list.

### Step 3: Set Up Project Structure
1. Create folder structure:
   - `components/` - for reusable components
   - `scenes/` - for individual scene components
2. Create `constants.ts` with colors, timing, and spring config from the plan

### Step 4: Create Shared Components
Create reusable components in `components/`:
- `Background.tsx` - animated background (if plan specifies one)
- Any shared elements used across multiple scenes (icons, shapes, etc.)

### Step 5: Implement Each Scene (ONE AT A TIME)
For each scene in order:
1. Mark TODO as in_progress
2. Write reasoning to IMPLEMENTATION_LOG.md (WHY you're making choices)
3. Check the scene's special requirements:
   - If `requires3D: true` -> use @remotion/three for 3D rendering
   - If `icons` array has items -> use Freepik MCP (mcp__freepik__search_icons -> mcp__freepik__download_icon_by_id) to get SVG icons
   - If scene needs illustrations/vectors -> use Freepik MCP (mcp__freepik__search_resources -> mcp__freepik__download_resource_by_id)
4. Create scene file in `scenes/Scene{{N}}.tsx`
5. Export the scene component
6. Validate against the plan
7. Mark TODO as completed
8. **ONLY THEN move to the next scene**

### Step 6: Assemble in index.tsx
After all scenes are created:
1. Import all scenes from `./scenes/`
2. Import shared components from `./components/`
3. Compose them in MainComposition with proper Sequences

### Step 7: Final Validation
- Run TypeScript check
- Verify all scenes implemented
- Check visual continuity

## OUTPUT FILES (create in src/{project_id}/)

### Directory Structure
```
src/{project_id}/
├── index.tsx           # Main composition - imports and assembles scenes
├── constants.ts        # Colors, timing, spring config
├── metadata.json       # Composition metadata for renderer
├── IMPLEMENTATION_LOG.md
├── components/         # Reusable components
│   ├── Background.tsx  # Animated background component
│   └── ...             # Other shared components (icons, shapes, etc.)
└── scenes/             # Individual scene components
    ├── Scene1.tsx
    ├── Scene2.tsx
    └── ...
```

### constants.ts
```tsx
// STUDIO THEME: COLORS must ONLY use these keys. NO domain-specific names.
// DO NOT add: water, poolLane, danger, warning, success, lava, circuit, etc.
// Express all visual meaning through accent/secondary + opacity variations.
export const COLORS = {{
  background: '#...',   // from studio theme
  text: '#...',         // from studio theme
  textMuted: '...',     // from studio theme
  accent: '#...',       // primary accent (default #6366F1 or from plan)
  secondary: '#...',    // secondary accent (default #EC4899 or from plan)
  cardBg: '...',        // from studio theme
  cardBorder: '...',    // from studio theme
  gridColor: '...',     // from studio theme
}};

// Standard spring config (matches SPRINGS.SMOOTH for backwards compatibility)
export const SPRING_CONFIG = {{ damping: 26, stiffness: 120, mass: 1.0 }};

// Semantic motion tokens — use these instead of raw spring values
// Based on Apple iOS, Framer Motion, and After Effects industry standards
export const SPRINGS = {{
  SNAPPY:  {{ damping: 22, stiffness: 170, mass: 0.8 }},  // Hero reveals, card entrances (~12 frames)
  SMOOTH:  {{ damping: 26, stiffness: 120, mass: 1.0 }},  // Apple "smooth" equivalent — premium settle (~18 frames)
  BOUNCY:  {{ damping: 20, stiffness: 200, mass: 1.0 }},  // Playful, energetic — visible overshoot (~15 frames)
  HEAVY:   {{ damping: 24, stiffness: 120, mass: 1.4 }},  // Big numbers, weighty settle — smooth authority
  STIFF:   {{ damping: 24, stiffness: 300, mass: 0.6 }},  // Micro-interactions, fast snaps (~8 frames)
  GENTLE:  {{ damping: 20, stiffness: 80,  mass: 1.2 }},  // Background elements, ambient motion (~25 frames)
  OVERLAY: {{ damping: 32, stiffness: 50,  mass: 1.0 }},  // Overlay scenes — subtle, non-distracting
}};

export const DURATION = {{
  QUICK: 8,       // Micro-transitions, icon swaps
  NORMAL: 15,     // Standard element entrances
  SLOW: 30,       // Dramatic reveals, counter animations (1s @30fps)
  DRAMATIC: 45,   // Full-scene builds, climactic moments (1.5s @30fps)
}};

export const STAGGER = {{
  RAPID: 2,       // Particles, dots, decorative elements
  TIGHT: 4,       // List items, small cards, characters in text
  NORMAL: 6,      // Default for most content (research sweet spot)
  WIDE: 8,        // Hero sections, dramatic reveals
  CASCADE: 10,    // Title words, section reveals, cinematic pacing
}};

// CRITICAL: These values come from scenes.json - DO NOT CHANGE THEM
export const TIMING = {{
  // Video specs from scenes.json (MUST MATCH EXACTLY)
  totalFrames: /* from scenes.json.totalFrames */,
  fps: /* from scenes.json.fps */,
  width: /* full canvas width from project specs */,
  height: /* full canvas height from project specs */,

  // Scene timing from scenes.json.scenes[].frames
  scene1Start: 0,
  scene1End: /* from scenes.json.scenes[0].frames[1] */,
  scene2Start: /* from scenes.json.scenes[1].frames[0] */,
  scene2End: /* from scenes.json.scenes[1].frames[1] */,
  // ... etc for all scenes

  // PER-SCENE EFFECTIVE VIEWPORT — from scenes.json.scenes[].effectiveDimensions
  // Each scene designs content for these dimensions (positioned from top-left 0,0).
  // pip-in-split scenes get the split area; fullscreen/overlay get full canvas.
  scene1EffectiveWidth: /* from scenes.json.scenes[0].effectiveDimensions.width */,
  scene1EffectiveHeight: /* from scenes.json.scenes[0].effectiveDimensions.height */,
  scene2EffectiveWidth: /* from scenes.json.scenes[1].effectiveDimensions.width */,
  scene2EffectiveHeight: /* from scenes.json.scenes[1].effectiveDimensions.height */,
  // ... etc for all scenes

  // KEY SYNC FRAMES — MUST BE LOCAL (absolute keySync.frame MINUS sceneStart)
  // These tell you the EXACT local frame when the key word is spoken.
  // The most important visual event in each scene MUST trigger at this frame.
  // CRITICAL: Store the SUBTRACTED value, NOT the absolute frame!
  scene1KeySync: /* scenes.json.scenes[0].keySync.frame - scenes.json.scenes[0].frames[0] */,
  scene2KeySync: /* scenes.json.scenes[1].keySync.frame - scenes.json.scenes[1].frames[0] */,
  // ... etc for all scenes

  // ADDITIONAL SYNC POINTS — MUST BE LOCAL (absolute frame MINUS sceneStart)
  // Each scene may have 2-5 additional sync points for secondary visual events.
  // ALWAYS pre-subtract sceneStart here. Scene code uses these directly with useCurrentFrame().
  // Example (scene2 starts at frame 80):
  //   scene2Sync_overflow: 135 - 80, // = 55 (local frame for "overflow")
  //   scene2Sync_crash: 160 - 80,    // = 80 (local frame for "crash")
  // ❌ WRONG: scene2Sync_overflow: 135,  // absolute frame — will cause blank scene!
  // ✅ RIGHT: scene2Sync_overflow: 55,   // local frame — works correctly
}};

// OVERLAY FRAME RANGES — scenes with displayMode === "overlay" in scenes.json.
// index.tsx uses this to conditionally skip Background during overlay frames.
// Populate from scenes.json: for each scene where displayMode === "overlay",
// add [sceneStart, sceneEnd] (frame numbers).
export const OVERLAY_RANGES: [number, number][] = [
  // Example: [TIMING.scene3Start, TIMING.scene3End],
  // Add one entry per overlay scene from scenes.json
];
```

**CRITICAL:** The `totalFrames` value in TIMING MUST match `scenes.json.totalFrames` exactly.
The Animator does NOT decide the video duration - it comes from the Director's plan.

**CRITICAL:** Each `sceneNKeySync` is a LOCAL frame offset (relative to scene start).
Use it in scene code as: `spring({{ frame: frame - TIMING.sceneNKeySync, fps, config: SPRING_CONFIG }})` where `frame = useCurrentFrame()`.
This is what syncs your animation to the spoken narration.

### components/Background.tsx (example)
```tsx
import React from 'react';
import {{ AbsoluteFill, useCurrentFrame }} from 'remotion';
import {{ COLORS }} from '../constants';

export const Background: React.FC = () => {{
  const frame = useCurrentFrame();
  // Animated background logic here
  return (
    <AbsoluteFill style={{{{ backgroundColor: COLORS.background }}}}>
      {{/* Background elements */}}
    </AbsoluteFill>
  );
}};
```

### scenes/Scene1.tsx (example)
```tsx
import React from 'react';
import {{ AbsoluteFill, useCurrentFrame, spring, useVideoConfig, interpolate }} from 'remotion';
import {{ COLORS, SPRING_CONFIG, TIMING }} from '../constants';

// NOTE: No startFrame prop needed! useCurrentFrame() inside a Sequence already returns
// local frames starting at 0. All TIMING sync values are pre-computed as local offsets.
export const Scene1: React.FC = () => {{
  const frame = useCurrentFrame(); // Already 0-relative inside <Sequence>
  const {{ fps }} = useVideoConfig();

  // Per-scene effective viewport — content must fit within these dimensions
  const EW = TIMING.scene1EffectiveWidth;
  const EH = TIMING.scene1EffectiveHeight;

  // Setup elements: animate BEFORE the key word is spoken (anticipation)
  const setupProgress = interpolate(frame, [0, TIMING.scene1KeySync], [0, 1], {{
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  }});

  // KEY SYNC: Main visual event triggers when the narrator says the key word
  const keySyncProgress = spring({{
    frame: frame - TIMING.scene1KeySync,
    fps,
    config: SPRING_CONFIG,
  }});

  return (
    <AbsoluteFill>
      {{/* Clip content to effective area */}}
      <div style={{{{ position: 'absolute', top: 0, left: 0, width: EW, height: EH, overflow: 'hidden' }}}}>
        {{/* Setup/anticipation elements (visible before key word) */}}
        <div data-element-name="setup" style={{{{ opacity: setupProgress }}}}>
          {{/* Background elements, secondary visuals — use EW/EH for sizing */}}
        </div>

        {{/* KEY SYNC EVENT: triggers at the exact frame the narrator says the key word */}}
        <div data-element-name="primary" style={{{{
          opacity: keySyncProgress,
          transform: `scale(${{keySyncProgress}})`,
          position: 'absolute',
          left: 0,
          right: 0,
          top: EH * 0.3,
          display: 'flex',
          justifyContent: 'center',
          textAlign: 'center',
          // Font sizes relative to EH, positions relative to EW/EH
        }}}}>
          {{/* Main visual event described in keySync.visualEvent */}}
        </div>
      </div>
    </AbsoluteFill>
  );
}};
```

### index.tsx
```tsx
import React from 'react';
import {{
  AbsoluteFill,
  Composition,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
}} from 'remotion';
import {{ COLORS, TIMING, OVERLAY_RANGES }} from './constants';
import {{ Background }} from './components/Background';
import {{ Scene1 }} from './scenes/Scene1';
import {{ Scene2 }} from './scenes/Scene2';
// ... import other scenes

// CRITICAL: Accept inputProps for video clips and other runtime data
interface MainCompositionProps {{
  videoClips?: Record<string, string>;  // sceneId → video URL for youtube-clip scenes
}}

const MainComposition: React.FC<MainCompositionProps> = ({{ videoClips }}) => {{
  const frame = useCurrentFrame();
  // During overlay frames, skip Background so the composition is transparent.
  // The editor uses real alpha compositing; FFmpeg export uses screen blend.
  const isOverlay = OVERLAY_RANGES.some(([s, e]) => frame >= s && frame < e);

  return (
    <AbsoluteFill style={{isOverlay ? undefined : {{ backgroundColor: COLORS.background }}}}>
      {{!isOverlay && <Background key="bg" />}}

      {{/* useCurrentFrame() inside each Scene returns 0 at the Sequence start — already local! */}}
      <Sequence key="scene1" from={{TIMING.scene1Start}} durationInFrames={{TIMING.scene1End - TIMING.scene1Start}}>
        <Scene1 videoClips={{videoClips}} />
      </Sequence>

      <Sequence key="scene2" from={{TIMING.scene2Start}} durationInFrames={{TIMING.scene2End - TIMING.scene2Start}}>
        <Scene2 videoClips={{videoClips}} />
      </Sequence>

      {{/* Add more scenes — pass videoClips to ALL scenes (they'll use it if needed) */}}
    </AbsoluteFill>
  );
}};

export const RemotionRoot: React.FC = () => {{
  return (
    <Composition
      id="{composition_id}"
      component={{MainComposition}}
      durationInFrames={{TIMING.totalFrames}}
      fps={{TIMING.fps}}
      width={{TIMING.width}}
      height={{TIMING.height}}
    />
  );
}};

// CRITICAL: Export MainComposition as default (NOT RemotionRoot!)
export default MainComposition;

// NOTE: Do NOT call registerRoot here - the workspace index.ts handles registration
```

### metadata.json
**MUST match scenes.json values exactly:**
```json
{{
  "compositionId": "{composition_id}",
  "durationInFrames": /* MUST equal scenes.json.totalFrames */,
  "fps": /* MUST equal scenes.json.fps */,
  "width": /* from project specs */,
  "height": /* from project specs */,
  "visuals": [
    {{"startMs": 0, "endMs": /* totalFrames / fps * 1000 */, "type": "generated", "description": "AI-generated visual"}}
  ]
}}
```

### IMPLEMENTATION_LOG.md
Your reasoning trail - document WHY you made each choice.

## COMPLETION

**CRITICAL: DO NOT EXIT EARLY**

You MUST NOT send your final response or stop working until ALL of these are true:
1. constants.ts file has been WRITTEN (not just read)
2. index.tsx file has been WRITTEN with ALL scenes implemented
3. metadata.json file has been WRITTEN
4. TypeScript validation has PASSED (run `npx tsc --noEmit`)

**If you only READ files and did not WRITE index.tsx, you have NOT completed the task.**
**Reading the plan is NOT completion. You must IMPLEMENT the plan.**

ONLY when ALL files are written AND TypeScript passes, respond:

"GENERATION COMPLETE"
- Files created: constants.ts, index.tsx, metadata.json
- Scenes implemented: X/Y
- TypeScript status: Clean

**DO NOT respond with "GENERATION COMPLETE" if index.tsx does not exist.**
"""

    # Conditionally append studio template workflow instructions
    if get_theme(style_preset):
        base_message += """

---

## STUDIO TEMPLATE WORKFLOW

You are working with the **Studio** style preset. A library of 60 pre-built templates
is available in `src/.templates/`. These are **source code you own** (shadcn model) —
copy, modify, and combine freely.

### MANDATORY: Theme Immersion Before Implementation

**Before writing ANY scene code, you MUST:**

1. **Read at least 3 templates** from `src/.templates/` — include at least ONE non-card template (e.g., `path-draw-reveal`, `animated-diagram`, `shape-morph-transition`) alongside card templates (e.g., `stat-counter`, `versus-screen`)
2. **Study how they use:** DotGrid backgrounds, `useScale()`, `FONT_PAIRS`, spring configs, accent color transparency, SVG path animation, animated diagrams, shape morphing
3. **Write `constants.ts` using STUDIO THEME COLORS** — NOT the Director's `colorPalette`

The Director's `colorPalette` in scenes.json is a topic hint only. Your constants.ts MUST use the studio theme values from the design system section above. If you skip this step, your scenes will look generic and off-brand.

### How to use templates:
1. **Read 3+ templates** to absorb studio design language (MANDATORY)
2. **Check `suggestedTemplates`** in `scenes.json` — the Director picked matching templates
3. **Read the template source** from `src/.templates/{slug}/` — especially `index.tsx`
   and any files in `components/`
4. **Implement scene** — use template patterns (DotGrid, cards, springs, fonts) whether copying or going custom
5. **Customize** — swap data, adjust timing to your frame range, use studio theme colors

### When to use vs. when to go custom:
- **Use a template** when the `suggestedTemplates` entry is a 60%+ visual match —
  adapting existing code is faster and more consistent
- **Go custom** when nothing in `suggestedTemplates` fits — but even then, you already
  read 3+ templates in step 1, so apply those patterns (DotGrid, cards, springs, fonts)

Templates are a starting point, not a constraint. Rename variables, merge pieces from
multiple templates, delete what you don't need, add new elements.
"""
        theme = get_theme(style_preset)
        variant = theme.get("variant", "dark") if theme else "dark"
        base_message += f"\nWhen adapting template code, use `BACKGROUNDS.{variant}` for theme colors.\n"

    return base_message


# ---------------------------------------------------------------------------
# Modular prompt constants for the parallel (multi-agent) Animator pipeline.
# The monolithic ANIMATOR_SYSTEM_PROMPT + build_animator_user_message above
# are kept for backward compatibility.  The constants below are used by the
# new orchestrator that fans out one agent per scene.
# ---------------------------------------------------------------------------


ANIMATOR_BASE_PROMPT = ANIMATOR_SYSTEM_PROMPT  # base.md deleted — was 95% duplicate


def get_animator_prompt(genre: str) -> str:
    """Build the Animator system prompt for a given genre."""
    from prompts._loader import build_agent_prompt
    return build_agent_prompt("animator", genre)


ANIMATOR_SETUP_PROMPT = load_prompt('animator/setup')


ANIMATOR_SCENE_PROMPT_TEMPLATE = load_prompt('animator/scene-template')


SCENE_VERIFY_PROMPT = load_prompt('animator/scene-verify')


COMPOSITION_VERIFY_PROMPT = load_prompt('animator/composition-verify')


# ---------------------------------------------------------------------------
# Visual verification prompt — screenshot reviewer subagent (Phase 2e)
# ---------------------------------------------------------------------------

VISUAL_VERIFY_PROMPT = load_prompt('animator/verify')


VISUAL_FIX_PROMPT_TEMPLATE = load_prompt('animator/fix-template')


# ---------------------------------------------------------------------------
# Helper functions for the modular animator pipeline
# ---------------------------------------------------------------------------


def _extract_section(tag: str) -> str:
    """Extract content between <tag> and </tag> from composition.md.
    Uses load_prompt() which has its own cache — no extra caching needed."""
    import re
    content = load_prompt("composition")
    pattern = rf"<{tag}>(.*?)</{tag}>"
    match = re.search(pattern, content, re.DOTALL)
    if match:
        return match.group(1).strip()
    return ""


def get_display_mode_rules(display_mode: str, ew: int = 1080, eh: int = 960) -> str:
    """Get display-mode-specific rules with runtime dimension injection."""
    if display_mode == "overlay":
        rules = _extract_section("overlay_rules")
    elif display_mode == "fullscreen":
        rules = _extract_section("fullscreen_rules")
    else:
        # Select compact vs portrait based on aspect ratio
        is_compact = eh < ew * 1.2
        tag = "stacked_compact_rules" if is_compact else "stacked_portrait_rules"
        rules = _extract_section(tag)

    return rules.replace("{ew}", str(ew)).replace("{eh}", str(eh))


def build_setup_user_message(project_id: str) -> str:
    """Build the user message for the Setup phase agent."""
    return f"""
## Setup Phase for project: {project_id}

Read the plan files from `src/{project_id}/`:
- `SCENE_PLAN.md` — The Director's visual story plan
- `scenes.json` — Machine-readable scene data with timing, colors, sync points

Then create:
1. `src/{project_id}/constants.ts` — COPY the motion tokens from the system prompt VERBATIM, then add COLORS, TIMING (from scenes.json), and OVERLAY_RANGES
2. `src/{project_id}/components/Background.tsx` — Animated background using COLORS from the plan
3. Directory structure: `src/{project_id}/scenes/` (empty, for later scene agents)

**CRITICAL**: TIMING values MUST be extracted from scenes.json exactly. Do not invent values.
"""


def build_scene_user_message(
    project_id: str,
    scene_index: int,
    scene_data: dict,
    total_scenes: int,
    constants_content: str,
    components_list: list[str],
    scene_plan_content: str,
    display_mode: str,
) -> str:
    """Build the user message for a per-scene Animator agent."""
    scene_num = scene_index + 1
    scene_json_str = json.dumps(scene_data, indent=2)

    # Build components reference
    components_ref = "\n".join(f"  - {c}" for c in components_list) if components_list else "  (none yet)"

    return f"""
## Implement Scene {scene_num}/{total_scenes} for project: {project_id}

### Scene Data (from scenes.json)
```json
{scene_json_str}
```

### Display Mode: {display_mode}

### constants.ts (READ-ONLY reference — do NOT modify)
```typescript
{constants_content}
```

### Available Components in components/
{components_ref}

### Full Scene Plan (for narrative continuity)
{scene_plan_content}

---

**YOUR TASK**: Create `src/{project_id}/scenes/Scene{scene_num}.tsx` implementing this scene.
Use the constants, components, and scene data above. Follow the display mode rules.
After writing, validate with: `npx tsc --noEmit`
"""


def build_scene_brief(
    scene_index: int,
    scene_data: dict,
    total_scenes: int,
    display_mode: str,
) -> dict:
    """Build a compact scene brief dict to write to disk as JSON.

    Each subagent reads its brief from disk instead of receiving all scene
    data inline in the coordinator prompt.

    Args:
        scene_index: 0-based scene index
        scene_data: The scene dict from scenes.json
        total_scenes: Total number of scenes
        display_mode: The scene's display mode (overlay/fullscreen/default)

    Returns:
        Dict ready to be serialized as JSON
    """
    return {
        "sceneNumber": scene_index + 1,
        "totalScenes": total_scenes,
        "displayMode": display_mode,
        "sceneData": scene_data,
    }


def build_scene_task_prompt(
    project_id: str,
    scene_number: int,
    display_mode: str,
    scene_data: dict,
    style_preset: str = "studio-dark",
) -> str:
    """Build a Task prompt with scene data embedded inline.

    Embeds the scene JSON directly so the subagent has everything it needs
    without relying on disk reads for critical data. Constants and plan
    are read from disk (standard files the agent finds easily).

    Args:
        project_id: Project identifier
        scene_number: 1-based scene number
        display_mode: The scene's display mode
        scene_data: The scene dict from scenes.json
        style_preset: Visual style preset (e.g. "studio", "modern")

    Returns:
        Task prompt string with scene data inline
    """
    eff = scene_data.get("effectiveDimensions", {})
    ew = eff.get("width", 1080)
    eh = eff.get("height", 960)
    mode_rules = get_display_mode_rules(display_mode, ew, eh)
    scene_prompt = ANIMATOR_SCENE_PROMPT_TEMPLATE.format(
        scene_number=scene_number,
        display_mode_rules=mode_rules,
    )
    scene_json_str = json.dumps(scene_data, indent=2)

    # Add template hint for studio preset when suggestedTemplates is present
    template_hint = ""
    if get_theme(style_preset):
        suggested = scene_data.get("suggestedTemplates")
        if suggested:
            slugs = ", ".join(suggested)
            template_hint = f"""

## STUDIO TEMPLATES
**Suggested templates for this scene:** {slugs}
Read `src/.templates/{{slug}}/index.tsx` before implementing — copy and customize the template code.
If no template fits, create custom visuals but follow the Studio design system (DotGrid, cards, color palette).
"""
        else:
            template_hint = """

## STUDIO TEMPLATES
No specific template was suggested for this scene, but browse `src/.templates/` for inspiration.
Read 2-3 templates to absorb the Studio aesthetic, then build custom visuals following the design system.
"""

    return f"""{scene_prompt}

## YOUR SCENE DATA
```json
{scene_json_str}
```

## CONTEXT FILES (read these before implementing)
1. Read `src/{project_id}/constants.ts` — shared constants (DO NOT modify)
2. Read `src/{project_id}/SCENE_PLAN.md` — narrative plan for context
3. List `src/{project_id}/components/` — available shared components
{template_hint}
Write your implementation to `src/{project_id}/scenes/Scene{scene_number}.tsx`.

## QUALITY CHECK (before completing this scene)
- [ ] All entrances combine opacity + at least one transform (scale, translateX, translateY)
- [ ] Staggered elements use VARIED animation types (not all identical)
- [ ] Spring configs match intent (bouncy for impact, smooth for reveal)
- [ ] No emoji content, no placeholder SVG shapes
- [ ] Glow/shadow intensifies at sync points (not constant)
- [ ] Every sync point has a corresponding visual change
- [ ] Uses `useScale()` for all pixel values, `FONT_PAIRS` for fonts (studio preset)
- [ ] Studio background (THEME.background + DotGrid) present (non-overlay scenes)
"""
