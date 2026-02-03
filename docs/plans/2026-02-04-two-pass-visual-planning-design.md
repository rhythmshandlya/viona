# Two-Pass Visual Planning Design

## Problem Statement

The Visual Director creates too many scenes for short transcripts. A 78-second video about reservoir sampling generated 22 scenes - one every 3.5 seconds. This produces visual chaos rather than deliberate storytelling.

The root cause: the planner treats each transcript line as a separate scene, jumping straight into visual design without understanding the content structure first.

## Solution: Two-Pass Planning

Split planning into two distinct phases:

1. **Pass 1 (Content Analysis)**: Identify narrative beats and decide a core metaphor
2. **Pass 2 (Visual Design)**: Design one scene per beat, constrained by Pass 1's decisions

This mirrors how a real creative director works - understand the story first, then design the visuals.

## Architecture

```
Pass 1: CONTENT ANALYSIS (~500 tokens output)
├── Identify 3-8 narrative beats with frame ranges
├── Decide ONE core metaphor for the entire video
└── Output: StructuredBrief JSON

Pass 2: VISUAL DESIGN (constrained by brief)
├── Design exactly one scene per narrative beat
├── All visuals build on the core metaphor
└── Output: Visual Plan JSON (4-8 scenes, not 22)
```

## Data Structures

### StructuredBrief (Pass 1 Output)

```json
{
  "core_metaphor": {
    "concept": "Game show with a single Winner's Throne",
    "why": "Reservoir sampling keeps one winner like a throne that can be taken"
  },
  "narrative_beats": [
    {
      "beat_id": "B01",
      "type": "problem",
      "frame_range": [0, 540],
      "summary": "Infinite comments pouring in, need to pick one winner",
      "key_visual": "Endless stream of comments flooding the screen"
    },
    {
      "beat_id": "B02",
      "type": "constraint",
      "frame_range": [540, 810],
      "summary": "Cannot store comments, only one variable of memory",
      "key_visual": "Single glowing memory slot"
    },
    {
      "beat_id": "B03",
      "type": "solution",
      "frame_range": [810, 1290],
      "summary": "Reservoir sampling - hold one winner, roll dice for replacement",
      "key_visual": "Throne with dice roll deciding who sits"
    },
    {
      "beat_id": "B04",
      "type": "proof",
      "frame_range": [1290, 1590],
      "summary": "Mathematical proof that everyone has equal chance",
      "key_visual": "Balance scale showing equal probability"
    },
    {
      "beat_id": "B05",
      "type": "challenge",
      "frame_range": [1590, 1890],
      "summary": "Extend algorithm to pick 5 winners",
      "key_visual": "Five thrones instead of one"
    },
    {
      "beat_id": "B06",
      "type": "outro",
      "frame_range": [1890, 2334],
      "summary": "Call to action - share solution",
      "key_visual": "Social share buttons"
    }
  ],
  "visual_elements": ["comment_stream", "throne", "dice", "probability_bars", "memory_slot"]
}
```

### Visual Plan (Pass 2 Output)

Same structure as current Visual Plan, but constrained to exactly N scenes where N = number of beats from Pass 1.

## Pass 1: Content Analysis Prompt

```
You are a CREATIVE DIRECTOR analyzing a video transcript.

Your job is to identify the NARRATIVE STRUCTURE - not design visuals yet.

## Input
- Transcript with frame timings
- Total duration and FPS
- Style preset

## Output a StructuredBrief JSON:

{
  "core_metaphor": {
    "concept": "One unifying visual idea that represents the whole video",
    "why": "Brief explanation of why this metaphor works"
  },
  "narrative_beats": [
    {
      "beat_id": "B01",
      "type": "problem|constraint|solution|proof|example|challenge|cta|outro",
      "frame_range": [start, end],
      "summary": "One sentence - what this beat is about",
      "key_visual": "What ONE thing should viewers see during this beat"
    }
  ],
  "visual_elements": ["3-5 recurring elements that tie scenes together"]
}

## Rules
- Maximum 8 beats for any video
- Minimum 2 beats (otherwise too short for structure)
- Each beat must be at least 5 seconds (150 frames at 30fps)
- The core metaphor must be concrete and visual, not abstract
- Beat types help categorize but don't force - use what fits the content
- Adjacent transcript lines about the same concept belong in ONE beat

## Beat Types
- problem: Introduces a challenge or question
- constraint: Adds limitations or complications
- solution: Presents the answer or method
- proof: Demonstrates why it works
- example: Shows a concrete instance
- challenge: Poses a follow-up question
- cta: Call to action
- outro: Closing/credits
```

## Pass 2: Visual Design Prompt

```
You are a VISUAL DESIGNER implementing a creative brief.

The Creative Director has already decided the structure. Your job is to design the visuals.

## Creative Brief
Core Metaphor: {core_metaphor.concept}
Rationale: {core_metaphor.why}

Narrative Beats:
{formatted_beats}

Recurring Visual Elements: {visual_elements}

## Your Task
Design ONE scene per beat. Do NOT create additional scenes.

For each scene:
1. How the core metaphor manifests in this beat
2. Build sequence (2-4 element entrances, not 10)
3. Hero moment (the memorable visual peak)
4. Transition to next scene

## Constraints
- You MUST create exactly {beat_count} scenes
- Scene IDs: S01, S02, ... matching beat order
- Scene frame_range MUST match the beat's frame_range exactly
- All visuals MUST use the core metaphor as the unifying thread
- Only use elements from visual_elements list - no new major concepts
- Each scene gets 2-4 build steps, not 8-10

## Output
Standard Visual Plan JSON with scenes array.
```

## Implementation

### New Functions

```python
def analyze_content_structure(
    transcript: str,
    duration_frames: int,
    fps: int,
    llm,
    config: dict
) -> Optional[dict]:
    """Pass 1: Extract narrative beats and core metaphor.

    Returns StructuredBrief dict or None on failure.
    """
    pass

def design_visuals_from_brief(
    brief: dict,
    transcript: str,
    style_preset: str,
    style_colors: dict,
    width: int,
    height: int,
    llm,
    config: dict
) -> Optional[dict]:
    """Pass 2: Design scenes constrained by the brief.

    Returns Visual Plan dict or None on failure.
    """
    pass

def validate_brief(brief: dict) -> tuple[bool, str]:
    """Validate StructuredBrief before Pass 2."""
    beats = brief.get('narrative_beats', [])

    if len(beats) < 2:
        return False, "Too few beats"
    if len(beats) > 8:
        return False, f"Too many beats ({len(beats)})"
    if not brief.get('core_metaphor', {}).get('concept'):
        return False, "Missing core metaphor"

    # Check beat coverage
    for i, beat in enumerate(beats[:-1]):
        gap = beats[i+1]['frame_range'][0] - beat['frame_range'][1]
        if gap > 90:  # 3 second gap
            return False, f"Gap between beats {i+1} and {i+2}"

    return True, "Valid"

def run_visual_director(
    transcript: str,
    duration_frames: int,
    # ... other params
) -> Optional[dict]:
    """Orchestrates two-pass planning."""

    # Pass 1: Analyze structure
    brief = analyze_content_structure(transcript, duration_frames, fps, llm, config)

    if not brief:
        log("Pass 1 failed, falling back to single-pass")
        return run_single_pass_planning(...)

    valid, reason = validate_brief(brief)
    if not valid:
        log(f"Brief invalid: {reason}, falling back")
        return run_single_pass_planning(...)

    # Save brief for debugging
    save_json(brief, "plans/brief.json")

    # Pass 2: Design visuals
    plan = design_visuals_from_brief(brief, transcript, style, llm, config)

    if not plan:
        log("Pass 2 failed")
        return None

    # Validate scene count matches beat count
    if len(plan.get('scenes', [])) != len(brief['narrative_beats']):
        log("Scene count mismatch, retrying Pass 2")
        plan = design_visuals_from_brief(...)  # One retry

    return plan
```

### Modified Flow

```
run_visual_director()
  ├── Pass 1: analyze_content_structure()
  │     ├── LLM call with CONTENT_ANALYST_PROMPT
  │     ├── max_tokens: 2000 (brief is small)
  │     ├── Returns StructuredBrief
  │     └── Validate: 2-8 beats, has metaphor, no gaps
  │
  └── Pass 2: design_visuals_from_brief()
        ├── LLM call with VISUAL_DESIGNER_PROMPT + brief
        ├── max_tokens: 12000 (fewer but richer scenes)
        ├── Returns Visual Plan
        └── Validate: scene count == beat count
```

## Error Handling

| Failure | Handling |
|---------|----------|
| Pass 1 returns no beats | Fall back to single-pass planning |
| Pass 1 returns >8 beats | Reject and retry with stronger constraint |
| Pass 1 missing metaphor | Reject and retry |
| Pass 2 wrong scene count | Retry once, then accept best effort |
| Either pass times out | Retry with temperature 0.5 |
| Both passes fail | Fall back to single-pass planning |

## Logging & Debugging

Events emitted:
- `planning_pass1_start` - Beginning content analysis
- `planning_pass1_complete` - Brief ready, includes beat count
- `planning_pass2_start` - Beginning visual design
- `planning_pass2_complete` - Visual Plan ready

Files saved to `plans/` folder:
- `brief.json` - Pass 1 output
- `visual-plan.json` - Pass 2 output (existing)
- `raw-response-pass1.txt` - Raw LLM response for Pass 1
- `raw-response-pass2.txt` - Raw LLM response for Pass 2

## Expected Outcomes

1. **Fewer scenes**: 4-8 scenes instead of 15-25
2. **Coherent visuals**: Single metaphor ties everything together
3. **Better token efficiency**: ~14K total vs ~16K (often truncated)
4. **Richer scenes**: Each scene gets more detail, not less total content
5. **Predictable output**: Beat count determines scene count
6. **Manageable generator workload**: Fewer scenes means the generator agent naturally creates fewer tasks via OpenHands' TaskTrackerTool - no special prompting needed

## Files to Modify

- `docker/openhands-sandbox/visual_generator.py`
- `packages/worker/src/agents/visual_generator.py` (sync copy)

## Implementation Priority

1. Add `CONTENT_ANALYST_PROMPT` constant
2. Add `VISUAL_DESIGNER_PROMPT` constant
3. Implement `analyze_content_structure()`
4. Implement `validate_brief()`
5. Implement `design_visuals_from_brief()`
6. Modify `run_visual_director()` to orchestrate both passes
7. Add fallback to single-pass on failure
8. Add logging and file saves
9. Test with reservoir sampling transcript
10. Sync to worker package
