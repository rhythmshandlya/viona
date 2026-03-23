"""
Director Agent Prompts

The Director analyzes transcripts with word-level timestamps and creates
scene-by-scene animation plans that sync precisely with narration.
"""


from prompts._loader import load_prompt, load_shared_modules, build_agent_prompt

_SEGMENT_GROUPING = load_prompt('director/segment-grouping')
DIRECTOR_SYSTEM_PROMPT = load_shared_modules() + "\n\n" + load_prompt('director/system') + "\n\n" + _SEGMENT_GROUPING


import math

from prompts.theme_loader import get_theme


def get_director_prompt(genre: str) -> str:
    """Build the Director system prompt for a given genre."""
    base = build_agent_prompt("director", genre)
    return f"{base}\n\n{_SEGMENT_GROUPING}"


def get_style_description(style_preset: str) -> str:
    """Get style description — returns minimal color/font summary from theme."""
    theme = get_theme(style_preset)
    if not theme:
        return ""
    colors = theme.get("colors", {})
    variant = theme.get("variant", "dark")
    return (
        f"Theme: {variant} mode. "
        f"Background: {colors.get('background', '#0B0F1A')}, "
        f"text: {colors.get('text', '#FFFFFF')}, "
        f"accent: {colors.get('accentDefault', '#6366F1')}, "
        f"secondary: {colors.get('secondaryDefault', '#EC4899')}."
    )


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


def get_layout_context(
    layout_mode: str,
    width: int,
    height: int,
    source_width: int | None = None,
    source_height: int | None = None,
    pip_width: int | None = None,
    pip_height: int | None = None,
) -> str:
    """Get v2 segment layout guidance based on dimensions.

    Args:
        layout_mode: Layout mode (pip, stacked) — used to set default visual area
        width: Full canvas width
        height: Full canvas height
        source_width: Source video width (optional, for coverage-tier guidance)
        source_height: Source video height (optional, for coverage-tier guidance)
        pip_width: Effective visual area width (for stacked layouts)
        pip_height: Effective visual area height (for stacked layouts)
    """
    aspect = get_aspect_ratio_name(width, height)
    coverage = _coverage_tier(source_width, source_height, width, height)
    coverage_block = f"\n{coverage}\n" if coverage else ""

    # Compute effective visual dimensions for stacked layout
    eff_pip_w = pip_width or width
    eff_pip_h = pip_height or height

    return f"""Canvas: {width}x{height}px ({aspect})
This is a {'tall vertical format — stack elements vertically, large text for mobile viewing' if height > width else 'wide horizontal format — use horizontal layouts'}.

### Segment Layout Types (v2)

Each **segment** specifies a `layout` that controls how visuals composite with the speaker video.
Consecutive beats with the same layout are grouped into one segment (one animation file).

| Layout | What happens | When to use |
|--------|-------------|-------------|
| `"stacked"` | Video + visuals split vertically. Visual area: {eff_pip_w}x{eff_pip_h}px. | DEFAULT — normal explanation, diagrams, animations (60-70% of beats) |
| `"fullscreen"` | Visuals fill entire canvas ({width}x{height}px), speaker hidden. | 1-3 key moments — big reveals, complex diagrams, title cards |
| `"overlay"` | Speaker fills canvas, visuals float on top ({width}x{height}px). | Speaker-focused moments — credibility, emotional beats, transitions |

### Layout Props

**stacked:**
```json
{{ "splitRatio": 70, "position": "video-first" }}
```
- `splitRatio`: 0-100, percentage of canvas for video (70 = video 70%, visuals 30%)
- `position`: `"video-first"` (video on top) or `"visuals-first"` (visuals on top)
- Effective visual area: {eff_pip_w}x{eff_pip_h}px
- Bottom 15% of the visual area is reserved for subtitles — design above that line

**fullscreen:**
```json
{{}}
```
- No props needed — visuals take the full {width}x{height}px canvas

**overlay:**
```json
{{ "x": "10%", "y": "60%", "width": "40%", "height": "35%" }}
```
- CSS percentage positions/dimensions for the visual overlay region
- Keep overlays in safe zones: top strip (0-15% Y) or lower-third (58-85% Y)

### Planning Guidelines
- Use `"stacked"` for 60-70% of beats — the bread and butter
- Use `"fullscreen"` for 1-2 key high-impact moments — big reveals, complex visuals
- Use `"overlay"` for speaker-focused moments — personal stories, emotional beats
- NEVER use the same layout for ALL segments — variety creates visual rhythm
- A layout change = new segment = new animation file, so minimize unnecessary switching
- Consecutive beats with the same layout MUST be in the same segment
{coverage_block}"""


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

Analyze this transcript and create a segment-based animation plan.

### Step 1: Identify Narrative Beats
First, identify the narrative beats in the content (as many as needed — no cap):
- Hook (what grabs attention — must be IMMEDIATELY striking in <3 seconds)
- Problem/Setup (what challenge exists — build tension)
- Insight/Solution (the clever answer — the "aha" moment)
- Understanding (how it works — step-by-step mechanism)
- Payoff (satisfying conclusion — fast and punchy)

Vary the pacing: short beats (7-8s) for hook and payoff, longer beats (10-15s) for core explanation.

**SPLIT RULE:** If a narrative section covers two distinct ideas (e.g., "problem" then "solution", or "chart analysis" then "comparison"), those are TWO separate beats — even if they're related. Each beat = one visual. A beat with a topic shift in the middle will have dead visual space where the first topic's visual sits stale while the narrator moves on. Always split at topic transitions.

### Step 2: Design Visual Metaphor System
Choose ONE primary visual metaphor that persists throughout:
- What concrete object represents the abstract concept?
- How does it transform across beats?
- What color palette fits the mood?

### Step 3: Map Key Sync Points
For each important word in the transcript:
- Identify the exact timestamp and frame
- Decide what visual event should trigger
- This creates the "sync magic" - visuals match narration

### Step 4: Plan Visual Continuity (Cross-Beat Anchoring)
Ensure beats connect through SPECIFIC visual anchors:
- Each beat's ANCHOR-OUT element must appear as the next beat's ANCHOR-IN
- Example: Beat 1 ends with a key flying rightward → Beat 2 opens with that key arriving at buckets
- The `buildsFrom` and `connectsTo` fields must name the EXACT element, not "previous visual"
- Never cut to completely unrelated visuals — always carry at least ONE element forward
- Within a segment, motion flows continuously (no hard cuts). Hard cuts happen at segment boundaries.

### Step 5: Write Layered Visual Descriptions
For each beat's "visual" field, describe in layers:
- Background → Primary element → Secondary elements → Accents → Motion → Text
- Use one movement per sentence — don't combine multiple actions
- Answer: WHAT appears, WHERE on canvas, WHEN it moves, HOW it moves, WHY it matters

### Step 6: Self-Verification (MANDATORY before writing scenes.json)
Compute these values for EVERY planned beat and create the Verification Table:
- Duration in frames and seconds (must be 210-450 frames / 7-15 seconds)
- Max gap between consecutive sync points (must be under 90 frames / 3 seconds)
- Contiguity check (each beat starts where previous ends)
- Total frame coverage (first beat starts at 0, last ends at total_frames)
- Segment grouping check (consecutive beats with same layout are in the same segment)

If ANY beat fails a check, adjust boundaries or split the beat BEFORE writing scenes.json.
Write the verification table into SCENE_PLAN.md, then write scenes.json.

## OUTPUT FILES

**CRITICAL: You MUST use the Write tool to create these files at the EXACT paths below. Do not just describe them - actually write them.**

### 1. SCENE_PLAN.md
**EXACT path (use this VERBATIM in your Write tool call):** `{abs_plan_path}`
Human-readable plan with:
- Transcript analysis
- Story arc breakdown
- Visual metaphor system
- Beat-by-beat breakdown with sync points and segment grouping
- **MANDATORY: Verification Table** (see below)

**VERIFICATION TABLE** — You MUST include this table at the END of SCENE_PLAN.md, BEFORE writing scenes.json.
Compute these values for EVERY beat and verify they pass. If any row FAILS, fix it before writing scenes.json.

```
## Beat Verification

| Beat | Segment | Layout | Frames | Duration | Status | Max Sync Gap | Gap Status | Sync Count |
|------|---------|--------|--------|----------|--------|--------------|------------|------------|
| 1    | 1       | stacked| 0-360  | 12.0s    | OK     | 2.9s         | OK         | 5          |
| 2    | 1       | stacked| 360-630| 9.0s     | OK     | 2.8s         | OK         | 3          |
| 3    | 2       | overlay| 630-900| 9.0s     | OK     | 2.5s         | OK         | 4          |
| ...  | ...     | ...    | ...    | ...      | ...    | ...          | ...        | ...        |

Duration rules: min 7s, max 15s. Max sync gap: 3s (90 frames). Min sync points: 2.
Total frames: X / Y (must match exactly)
Contiguous: YES/NO (each beat must start where previous ends)
Segments contiguous: YES/NO (each segment must start where previous ends)
Same-layout grouping: YES/NO (consecutive beats with same layout in same segment)
```

If any Status or Gap Status shows FAIL, you MUST adjust beat boundaries or add sync points BEFORE writing scenes.json.

### 2. scenes.json
**EXACT path (use this VERBATIM in your Write tool call):** `{abs_scenes_path}`
Machine-readable v2 format with segments and beats:
```json
{{
  "version": 2,
  "projectId": "{project_id}",
  "fps": {fps},
  "totalFrames": {duration_frames},
  "durationSeconds": {duration_seconds:.1f},
  "primaryMetaphor": "description",
  "colorPalette": "palette name",
  "iconStyle": {{ "shape": "outline|fill|lineal-color|hand-drawn", "color": "solid-black|multicolor|white|blue|..." }},
  "segments": [
    {{
      "id": 1,
      "layout": "stacked",
      "layoutProps": {{ "splitRatio": 70, "position": "video-first" }},
      "frames": [0, 630],
      "beats": [
        {{
          "id": 1,
          "name": "Beat Name",
          "type": "animation",
          "archetype": "hook-title",
          "frames": [0, 360],
          "keySync": 45,
          "syncPoints": [
            {{ "frame": 45, "action": "Title springs in with text-reveal" }},
            {{ "frame": 120, "action": "Subtitle fades up below title" }}
          ],
          "technique": "path-drawing",
          "visual": "AMBIENT: ... PRIMARY: ... SECONDARY: ...",
          "buildsFrom": null,
          "connectsTo": "the glowing key element in motion",
          "icons": ["checkmark", "warning"],
          "illustrations": ["concept search term if needed"],
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
          "layout": {{
            "primary": {{ "element": "title", "y": "center" }},
            "secondary": {{ "element": "metaphor visual", "y": "60%" }},
            "alignment": "center"
          }},
          "suggestedTemplates": ["stat-counter"]
        }}
      ]
    }},
    {{
      "id": 2,
      "layout": "overlay",
      "layoutProps": {{ "x": "10%", "y": "60%", "width": "40%", "height": "35%" }},
      "frames": [630, 900],
      "beats": [
        {{
          "id": 3,
          "name": "Speaker Insight",
          "type": "animation",
          "archetype": "insight-reveal",
          "frames": [630, 900],
          "keySync": 90,
          "syncPoints": [
            {{ "frame": 90, "action": "Keyword appears in lower-third" }}
          ],
          "technique": "kinetic-typography",
          "visual": "...",
          "buildsFrom": "...",
          "connectsTo": "...",
          "icons": [],
          "illustrations": [],
          "images": [],
          "videos": [],
          "layout": {{
            "primary": {{ "element": "keyword", "y": "65%" }},
            "alignment": "center"
          }}
        }}
      ]
    }}
  ]
}}
```

**KEY FORMAT RULES:**
- `"version": 2` — REQUIRED at the top level
- `"segments"` array (NOT flat `"scenes"` array)
- Each segment has `layout`, `layoutProps`, `frames`, and `beats`
- Beat `frames` are ABSOLUTE (relative to video timeline), NOT segment-relative
- `keySync` is a LOCAL frame offset within the beat (relative to beat start frame)
- `syncPoints[].frame` values are also LOCAL offsets within the beat
- Segment `frames` must match the range of their beats: `[firstBeat.frames[0], lastBeat.frames[1]]`

**CRITICAL: All positions use percentages or "center"/"auto". Never use pixel values.**

**`suggestedTemplates` (studio preset only):**
- An array of 1-2 template slug strings from the template library in src/.templates/
- Only include this field when style_preset is "studio" AND a template matches the beat's purpose
- The Animator will read the template source and use it as a starting point for the beat
- If no template fits, omit this field entirely — the Animator will create custom visuals

**SYNC POINTS:**
- `keySync` is the LOCAL frame offset of the SINGLE most important sync moment in the beat
- `syncPoints` is an array of ALL important sync moments (2-5 per beat recommended)
- Include the keySync moment in syncPoints too, plus any other visual events
- The Animator will use these to align animations precisely with the narration
- Frame values MUST be calculated as LOCAL offsets: `round(timestamp_seconds * {fps}) - beat_start_frame`
- Example: if beat starts at frame 120, narrator says "overflow" at 4.5s (frame 135), keySync = 135 - 120 = 15

**TECHNIQUE FIELD (required per beat):**
Valid values: `"card-data"`, `"path-drawing"`, `"shape-morph"`, `"animated-diagram"`, `"split-composition"`, `"particle-scatter"`, `"svg-illustration"`, `"data-viz"`, `"kinetic-typography"`
No two adjacent beats should share the same `technique` value.

**CRITICAL DURATION CONSTRAINT:**
- The video is EXACTLY {duration_frames} frames ({duration_seconds:.1f} seconds) at {fps} FPS
- The first beat MUST start at frame 0
- The LAST beat MUST end at frame {duration_frames}
- Beats MUST be contiguous with NO gaps — each beat starts exactly where the previous one ends
- Segments MUST be contiguous — each segment starts where the previous one ends
- Beat frames MUST match transcript timestamps: frame = timestamp_seconds * {fps}
- DO NOT invent your own duration. Use the EXACT frame count given.

## REMEMBER
- One beat per narrative topic — use as many as the content needs, no arbitrary cap
- Each beat: minimum 7 seconds (210 frames), maximum 15 seconds (450 frames)
- No gap of 5+ seconds between sync points within a beat
- Every beat needs a keySync point AND 2-5 syncPoints
- Visual continuity: same element transforms across beats
- Be SPECIFIC about visuals, not generic
- **TOTAL FRAMES MUST EQUAL {duration_frames}**
- **NO GAPS between beats** — beats must be back-to-back, covering every frame
- Consecutive beats with the same layout MUST be in the same segment
- For studio preset: suggest matching template slugs in "suggestedTemplates" per beat

## FINAL CHECKLIST
Before responding "PLANNING COMPLETE":
1. [ ] Used Write tool to create `{abs_plan_path}` (includes Verification Table)
2. [ ] Used Write tool to create `{abs_scenes_path}`
3. [ ] scenes.json has valid JSON structure with `"version": 2` and `"segments"` array
4. [ ] Both files written to the EXACT paths above (not the workspace root!)
5. [ ] Segments are contiguous — no gaps between any two consecutive segments
6. [ ] Each segment has valid `layout` and `layoutProps` for its type
7. [ ] Consecutive beats with same layout are grouped in the same segment
8. [ ] First beat starts at frame 0, last beat ends at frame {duration_frames}
9. [ ] Every beat is 210-450 frames (7-15 seconds) — verified in the table
10. [ ] Max sync gap within any beat is under 90 frames (3 seconds) — verified in the table
11. [ ] SCENE_PLAN.md written BEFORE scenes.json (verification must happen first)

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
