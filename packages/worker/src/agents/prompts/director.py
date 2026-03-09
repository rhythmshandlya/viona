"""
Director Agent Prompts

The Director analyzes transcripts with word-level timestamps and creates
scene-by-scene animation plans that sync precisely with narration.
"""


from prompts._loader import load_prompt
DIRECTOR_SYSTEM_PROMPT = load_prompt('director/system')


import math

from prompts._themes import STUDIO_THEMES

_STUDIO_STYLE_TEMPLATE = load_prompt('director/studio-style-template')


def get_style_description(style_preset: str) -> str:
    """Get the style description for the given preset, filled with theme colors."""
    theme = STUDIO_THEMES.get(style_preset, STUDIO_THEMES["studio-dark"])
    variant_label = "Dark mode" if theme["variant"] == "dark" else "Light mode"
    return _STUDIO_STYLE_TEMPLATE.format(variant_label=variant_label, **theme)


# Backward compat — some code may still reference this dict
STYLE_PRESET_DESCRIPTIONS = {
    "studio-dark": get_style_description("studio-dark"),
    "studio-light": get_style_description("studio-light"),
}


def get_aspect_ratio_name(width: int, height: int) -> str:
    """Get a human-readable aspect ratio name."""
    ratio = width / height

    # Common aspect ratios
    if abs(ratio - 9/16) < 0.05:
        return "9:16 (vertical/mobile)"
    elif abs(ratio - 16/9) < 0.05:
        return "16:9 (horizontal/desktop)"
    elif abs(ratio - 1) < 0.05:
        return "1:1 (square)"
    elif abs(ratio - 4/3) < 0.05:
        return "4:3 (standard)"
    elif abs(ratio - 3/4) < 0.05:
        return "3:4 (vertical)"
    elif ratio < 1:
        return f"vertical ({width}:{height})"
    else:
        return f"horizontal ({width}:{height})"


def _coverage_tier(source_width: int | None, source_height: int | None, canvas_w: int, canvas_h: int) -> str | None:
    """Return coverage-tier guidance when source dimensions are known."""
    if not source_width or not source_height or not canvas_w or not canvas_h:
        return None

    source_ar = source_width / source_height
    canvas_ar = canvas_w / canvas_h
    ratio = canvas_ar / source_ar if source_ar > canvas_ar else source_ar / canvas_ar

    if ratio > 0.8:
        return (
            "COVERAGE TIER: **flexible** (source and canvas share a similar aspect ratio).\n"
            "- `overlay` mode works well — the speaker crops cleanly.\n"
            "- All three display modes are equally viable."
        )
    if ratio >= 0.5:
        return (
            "COVERAGE TIER: **moderate** (some cropping when showing full speaker).\n"
            "- Prefer `overlay` alongside a visual rather than raw speaker fill.\n"
            "- `default` and `fullscreen` are your strongest modes."
        )
    return (
        "COVERAGE TIER: **conservative** (heavy crop when fitting source to canvas).\n"
        "- Prefer `overlay` to show the speaker without dedicating the full canvas to them.\n"
        "- `default` and `fullscreen` should dominate the plan; use `overlay` as a secondary accent."
    )


# Shared display-mode reference table used by all layout contexts
_DISPLAY_MODE_TABLE = load_prompt('director/display-mode-table')


def get_layout_context(
    layout_mode: str,
    width: int,
    height: int,
    source_width: int | None = None,
    source_height: int | None = None,
    pip_width: int | None = None,
    pip_height: int | None = None,
) -> str:
    """Get layout-specific design guidance based on dimensions.

    Args:
        layout_mode: Layout mode (pip, stacked)
        width: Full canvas width
        height: Full canvas height
        source_width: Source video width (optional, for coverage-tier guidance)
        source_height: Source video height (optional, for coverage-tier guidance)
        pip_width: Effective pip area width (for split layouts)
        pip_height: Effective pip area height (for split layouts)
    """
    aspect = get_aspect_ratio_name(width, height)
    coverage = _coverage_tier(source_width, source_height, width, height)
    coverage_block = f"\n{coverage}\n" if coverage else ""

    # Compute effective pip dimensions if not provided
    eff_pip_w = pip_width or width
    eff_pip_h = pip_height or height

    # Per-displayMode pixel dimensions block
    per_dm_dims = f"""
**Per-scene dimensions (based on displayMode):**
- `"default"` → {eff_pip_w}x{eff_pip_h}px (the standard visual area for this layout)
- `"fullscreen"` → {width}x{height}px (takes over entire canvas)
- `"overlay"` → {width}x{height}px (full canvas, semi-transparent over speaker)
"""

    if layout_mode == "pip":
        return f"""Picture-in-Picture (Full Canvas) with DYNAMIC LAYOUT SWITCHING
- Your visuals fill the ENTIRE screen at {width}x{height}px ({aspect})
- The speaker video will be overlaid as a small picture-in-picture window
- Design for FULL-SCREEN IMPACT - use the entire canvas
- This is a {'tall vertical format - stack elements vertically, large text for mobile viewing' if height > width else 'wide horizontal format - use horizontal layouts'}
{_DISPLAY_MODE_TABLE}
{per_dm_dims}{coverage_block}"""

    elif layout_mode == "stacked" or layout_mode == "split-horizontal":
        return f"""Stacked Layout (Top/Bottom) with DYNAMIC LAYOUT SWITCHING
- DEFAULT: Your visuals appear in the TOP portion, speaker video BELOW
- Standard area: {eff_pip_w}x{eff_pip_h}px ({get_aspect_ratio_name(eff_pip_w, eff_pip_h)})
- Full canvas: {width}x{height}px ({aspect})
- Design for a {'wide horizontal strip' if eff_pip_w > eff_pip_h else 'compact area'} — arrange elements horizontally in the top half
- Keep critical content centered, avoid edges that feel cramped
- Bottom 15% of the visual area is reserved for subtitles — design above that line

**However, each scene can BREAK OUT of the stacked layout to a different displayMode:**
{_DISPLAY_MODE_TABLE}
In stacked layout, the modes map as follows:
- `"default"` → **Standard stacked**: visual in top half ({eff_pip_w}x{eff_pip_h}px), speaker in bottom half
- `"fullscreen"` → **Takeover**: visual expands to fill the ENTIRE canvas ({width}x{height}px), speaker hidden. Great for complex diagrams or big reveals.
- `"overlay"` → **Speaker focus**: speaker fills the canvas, your visual composites on top at ~70% opacity ({width}x{height}px). Use for credibility moments.

This means most scenes stay in the familiar stacked layout, but 1-3 high-impact scenes can "punch out" to fullscreen or overlay for dramatic effect.

{per_dm_dims}{coverage_block}"""

    else:
        return f"Custom layout: {width}x{height}px ({aspect})"


def build_director_user_message(
    project_id: str,
    formatted_transcript: str,
    width: int,
    height: int,
    duration_frames: int,
    fps: int,
    style_preset: str = "studio-dark",
    layout_mode: str = "pip",
    style_guide: str | None = None,
    output_dir: str | None = None,
    source_width: int | None = None,
    source_height: int | None = None,
    pip_width: int | None = None,
    pip_height: int | None = None,
    safe_placement: list[str] | None = None,
) -> str:
    """Build the user message for the Director agent.

    Args:
        output_dir: Absolute path to the directory where SCENE_PLAN.md and scenes.json
                     should be written. If provided, the prompt uses absolute paths to
                     prevent Claude from writing files to the wrong location.
        source_width: Source video width (optional, for coverage-tier guidance)
        source_height: Source video height (optional, for coverage-tier guidance)
        pip_width: Effective pip area width (for split layouts)
        pip_height: Effective pip area height (for split layouts)
    """

    duration_seconds = duration_frames / fps

    # Get descriptions for selected options
    style_desc = get_style_description(style_preset)

    layout_context = get_layout_context(layout_mode, width, height, source_width, source_height, pip_width, pip_height)
    aspect_ratio = get_aspect_ratio_name(width, height)

    # Display mode fields for scenes.json — enabled for ALL layout modes
    display_mode_schema = """
      "displayMode": "default",
      "transition": {
        "enter": { "type": "cut", "durationMs": 0 },
        "exit": { "type": "cut", "durationMs": 0 }
      },"""
    display_mode_notes = """
**DISPLAY MODE (ALL layouts — per-scene):**
- Every scene MUST have a `displayMode` field: `"default"`, `"fullscreen"`, or `"overlay"`
- Every scene MUST have a `transition` object with `enter` and `exit` sub-objects
- Transition types: `"cut"` (instant), `"fade"`, `"zoom-in"`, `"zoom-out"`
- Transition durations: 0 for cuts, 300-500ms for fades, 200-400ms for zooms
- Use variety: do NOT make every scene the same displayMode
- Use `"fullscreen"` for 1-3 key high-impact scenes (complex diagrams, big reveals)
- Use `"overlay"` for speaker-focused moments (intro, credibility, emotional beats)
- Use `"default"` for standard explanation scenes (the majority)
"""
    display_mode_checklist = "5. [ ] Each scene has a displayMode and transition (with variety — not all the same)\n"

    # Build optional user style guide section
    user_guide_section = ""
    if style_guide and style_guide.strip():
        user_guide_section = f"""
## ADDITIONAL USER GUIDANCE
The user has provided the following specific guidance:

{style_guide}

Incorporate these preferences into your scene planning while maintaining quality standards.

"""

    # Build speaker awareness section for overlay planning
    speaker_section = ""
    if safe_placement:
        zones = ", ".join(safe_placement)
        speaker_section = f"""
## SPEAKER POSITION DATA
Head tracking analysis shows these zones are clear of the speaker: **{zones}**

When planning overlay scenes, place elements in these safe zones.
The lower-third (58-85% Y) and top strip (0-15% Y) are the primary safe zones.
If safe_placement includes "bottom" or "bottom-left"/"bottom-right", the lower-third is confirmed safe.
If safe_placement includes "top", the top strip is confirmed safe.
"""

    # Use absolute paths when output_dir is provided (prevents Claude from writing to wrong location)
    if output_dir:
        # Normalize to forward slashes for cross-platform compatibility
        abs_plan_path = output_dir.replace("\\", "/") + "/SCENE_PLAN.md"
        abs_scenes_path = output_dir.replace("\\", "/") + "/scenes.json"
    else:
        abs_plan_path = f"SCENE_PLAN.md"
        abs_scenes_path = f"scenes.json"

    return f"""
## PROJECT: {project_id}

## CANVAS SPECIFICATIONS
- Dimensions: {width}x{height}px
- Aspect Ratio: {aspect_ratio}
- Duration: {duration_frames} frames ({duration_seconds:.1f}s)
- FPS: {fps}

## LAYOUT MODE
{layout_context}

## RESPONSIVE DESIGN REQUIREMENTS
All visuals MUST be designed responsively for the {width}x{height}px canvas:
- Use RELATIVE positioning (percentages, flex, centered layouts) - never hardcoded pixel positions
- Text sizes must be proportional to canvas height (e.g., title = 5% of height, body = 3% of height)
- Maintain safe margins (10% padding from edges) to prevent content clipping
- Elements should scale proportionally - if canvas is {'tall and narrow' if height > width else 'wide'}, design accordingly
- Test mental model: "Would this look good if the canvas was 50% smaller or larger?"

## VISUAL STYLE: {style_preset.upper()}
{style_desc}

Your visuals MUST follow this style preset. Use colors, typography, and animation patterns that match this aesthetic.
{user_guide_section}{speaker_section}
{formatted_transcript}

## YOUR TASK

Analyze this transcript and create a scene-by-scene animation plan.

### Step 1: Identify Narrative Beats
First, identify the narrative beats in the content (as many as needed — no cap):
- Hook (what grabs attention — must be IMMEDIATELY striking in <3 seconds)
- Problem/Setup (what challenge exists — build tension)
- Insight/Solution (the clever answer — the "aha" moment)
- Understanding (how it works — step-by-step mechanism)
- Payoff (satisfying conclusion — fast and punchy)

Vary the pacing: short beats (7-8s) for hook and payoff, longer beats (10-15s) for core explanation.

**SPLIT RULE:** If a narrative section covers two distinct ideas (e.g., "problem" then "solution", or "chart analysis" then "comparison"), those are TWO separate beats — even if they're related. Each beat = one scene. A scene with a topic shift in the middle will have dead visual space where the first topic's visual sits stale while the narrator moves on. Always split at topic transitions.

### Step 2: Design Visual Metaphor System
Choose ONE primary visual metaphor that persists throughout:
- What concrete object represents the abstract concept?
- How does it transform across scenes?
- What color palette fits the mood?

### Step 3: Map Key Sync Points
For each important word in the transcript:
- Identify the exact timestamp and frame
- Decide what visual event should trigger
- This creates the "sync magic" - visuals match narration

### Step 4: Plan Visual Continuity (Cross-Scene Anchoring)
Ensure scenes connect through SPECIFIC visual anchors:
- Each scene's ANCHOR-OUT element must appear as the next scene's ANCHOR-IN
- Example: Scene 1 ends with a key flying rightward → Scene 2 opens with that key arriving at buckets
- The `buildsFrom` and `connectsTo` fields must name the EXACT element, not "previous visual"
- Never cut to completely unrelated visuals — always carry at least ONE element forward

### Step 5: Write Layered Visual Descriptions
For each scene's "visual" field, describe in layers:
- Background → Primary element → Secondary elements → Accents → Motion → Text
- Use one movement per sentence — don't combine multiple actions
- Answer: WHAT appears, WHERE on canvas, WHEN it moves, HOW it moves, WHY it matters

### Step 6: Self-Verification (MANDATORY before writing scenes.json)
Compute these values for EVERY planned scene and create the Verification Table:
- Duration in frames and seconds (must be 210-450 frames / 7-15 seconds)
- Max gap between consecutive sync points (must be under 150 frames / 5 seconds)
- Contiguity check (each scene starts where previous ends)
- Total frame coverage (first scene starts at 0, last ends at total_frames)

If ANY scene fails a check, adjust boundaries or split the scene BEFORE writing scenes.json.
Write the verification table into SCENE_PLAN.md, then write scenes.json.

## OUTPUT FILES

**CRITICAL: You MUST use the Write tool to create these files at the EXACT paths below. Do not just describe them - actually write them.**

### 1. SCENE_PLAN.md
**EXACT path (use this VERBATIM in your Write tool call):** `{abs_plan_path}`
Human-readable plan with:
- Transcript analysis
- Story arc breakdown
- Visual metaphor system
- Scene-by-scene breakdown with sync points
- **MANDATORY: Verification Table** (see below)

**VERIFICATION TABLE** — You MUST include this table at the END of SCENE_PLAN.md, BEFORE writing scenes.json.
Compute these values for EVERY scene and verify they pass. If any row FAILS, fix it before writing scenes.json.

```
## Scene Verification

| Scene | Frames | Duration | Status | Max Sync Gap | Gap Status | Sync Count |
|-------|--------|----------|--------|--------------|------------|------------|
| 1     | 0-360  | 12.0s    | OK     | 2.9s         | OK         | 5          |
| 2     | 360-630| 9.0s     | OK     | 4.1s         | OK         | 3          |
| ...   | ...    | ...      | ...    | ...          | ...        | ...        |

Duration rules: min 7s, max 15s. Max sync gap: 5s. Min sync points: 2.
Total frames: X / Y (must match exactly)
Contiguous: YES/NO (each scene must start where previous ends)
```

If any Status or Gap Status shows FAIL, you MUST adjust scene boundaries or add sync points BEFORE writing scenes.json.

### 2. scenes.json
**EXACT path (use this VERBATIM in your Write tool call):** `{abs_scenes_path}`
Machine-readable with this structure:
```json
{{
  "projectId": "{project_id}",
  "fps": {fps},
  "totalFrames": {duration_frames},
  "durationSeconds": {duration_seconds:.1f},
  "totalScenes": N,
  "primaryMetaphor": "description",
  "colorPalette": "palette name",
  "iconStyle": {{ "shape": "outline|fill|lineal-color|hand-drawn", "color": "solid-black|multicolor|white|blue|..." }},
  "visualContinuity": "what persists across scenes",
  "responsive": {{
    "safeMargin": "10%",
    "titleSize": "5% of height",
    "bodySize": "3% of height",
    "maxContentWidth": "80%"
  }},
  "scenes": [
    {{
      "id": 1,
      "name": "Scene Name",
      "type": "animation",  // "animation" (default) or "youtube-clip"
      "archetype": "hook-title",
      "frames": [startFrame, endFrame],
      "timestampRange": [startSec, endSec],
      "keySync": {{
        "word": "the word",
        "timestamp": secondsFloat,
        "frame": frameNumber,
        "visualEvent": "what happens"
      }},
      "syncPoints": [
        {{
          "word": "important word",
          "timestamp": secondsFloat,
          "frame": frameNumber,
          "visualEvent": "what visual change happens at this word"
        }}
      ],
      "visual": "detailed description with RELATIVE positioning (percentages)",{display_mode_schema}
      "layout": {{
        "primary": {{ "x": "center", "y": "20%", "width": "60%", "height": "auto" }},
        "secondary": {{ "x": "center", "y": "60%", "width": "80%", "height": "auto" }}
      }},
      "emotion": "what viewer feels",
      "buildsFrom": "previous scene connection or null",
      "connectsTo": "next scene connection",
      "requires3D": false,
      "icons": ["checkmark", "warning"],  // plain English nouns only — no hyphens, no library names
      "illustrations": ["concept search term if needed"],
      "iconAnimation": "pop",
      "images": [
        {{
          "keyword": "search term for photo/illustration",
          "type": "photo or illustration",
          "purpose": "hero, accent, or background",
          "description": "what the image should depict",
          "placement": "center, background, left, or right",
          "animation": "ken-burns"
        }}
      ],
      "videos": [
        {{
          "keyword": "search terms for YouTube video",
          "purpose": "hero, accent, or background",
          "placement": "center, background, left, or right",
          "trimHint": "optional hint for which part to use",
          "muted": true
        }}
      ],
      // For type: "youtube-clip" scenes only:
      "videoSearch": "search query for YouTube",  // Required for youtube-clip
      "frameStyle": "browser",  // phone | laptop | browser | polaroid | film | none
      "suggestedTemplates": ["stat-counter", "bar-chart-race"]
    }}
  ]
}}
```

**CRITICAL: All positions use percentages or "center"/"auto". Never use pixel values.**

**`suggestedTemplates` (studio preset only):**
- An array of 1-2 template slug strings from the STUDIO_TEMPLATES.md catalog
- Only include this field when style_preset is "studio" AND a template matches the scene's purpose
- The Animator will read the template source and use it as a starting point for the scene
- If no template fits, omit this field entirely — the Animator will create custom visuals

**SYNC POINTS:**
- `keySync` is the SINGLE most important word-visual pair in the scene (required)
- `syncPoints` is an array of ALL important word-visual pairs (2-5 per scene recommended)
- Include the keySync word in syncPoints too, plus any other words that should trigger visual events
- The Animator will use these to align animations precisely with the narration
- Frame values MUST be calculated as: `round(timestamp_seconds * {fps})`
- Example: if narrator says "overflow" at 4.5s in a 30fps video, frame = round(4.5 * 30) = 135

{display_mode_notes}**CRITICAL DURATION CONSTRAINT:**
- The video is EXACTLY {duration_frames} frames ({duration_seconds:.1f} seconds) at {fps} FPS
- Scene 1 MUST start at frame 0
- The LAST scene MUST end at frame {duration_frames}
- Scenes MUST be contiguous with NO gaps — each scene starts exactly where the previous one ends
- Scene frames MUST match transcript timestamps: frame = timestamp_seconds * {fps}
- DO NOT invent your own duration. Use the EXACT frame count given.

## REMEMBER
- One scene per narrative beat — use as many as the content needs, no arbitrary cap
- Each scene: minimum 7 seconds (210 frames), maximum 15 seconds (450 frames)
- No gap of 5+ seconds between sync points within a scene
- Every scene needs a keySync point AND 2-5 syncPoints
- Visual continuity: same element transforms across scenes
- Be SPECIFIC about visuals, not generic
- **TOTAL FRAMES MUST EQUAL {duration_frames}**
- **NO GAPS between scenes** — scenes must be back-to-back, covering every frame
- For studio preset: suggest matching template slugs in "suggestedTemplates" per scene

## FINAL CHECKLIST
Before responding "PLANNING COMPLETE":
1. [ ] Used Write tool to create `{abs_plan_path}` (includes Verification Table)
2. [ ] Used Write tool to create `{abs_scenes_path}`
3. [ ] scenes.json has valid JSON structure
4. [ ] Both files written to the EXACT paths above (not the workspace root!)
{display_mode_checklist}6. [ ] Scenes are contiguous — no gaps between any two consecutive scenes
7. [ ] Scene 1 starts at frame 0, last scene ends at frame {duration_frames}
8. [ ] Every scene is 210-450 frames (7-15 seconds) — verified in the table
9. [ ] Max sync gap within any scene is under 150 frames (5 seconds) — verified in the table
10. [ ] SCENE_PLAN.md written BEFORE scenes.json (verification must happen first)

**You MUST write both files using the Write tool. The Animator cannot proceed without them.**

## ⚠️ CRITICAL: DO NOT EXIT EARLY ⚠️

**You MUST NOT send your final response until you have ACTUALLY WRITTEN both files.**

If you have not yet used the Write tool to create SCENE_PLAN.md and scenes.json:
- DO NOT respond with "PLANNING COMPLETE"
- DO NOT send a final message
- GO BACK and use the Write tool to create the files

**Reading the transcript is NOT completion. Analyzing is NOT completion.**
**Only WRITING the output files to disk counts as completion.**

Your task is INCOMPLETE until both files exist. The Animator CANNOT proceed without them.

When your plan files are written (verified by using Write tool), respond: "PLANNING COMPLETE"
"""
