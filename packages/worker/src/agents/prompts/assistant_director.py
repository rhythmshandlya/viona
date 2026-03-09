"""
Assistant Director Agent Prompts

The Assistant Director is Phase 0 of the pipeline. It analyzes scripts to
classify tone/theme and produces a Creative Brief that guides the Director
and Animator agents downstream.
"""

from prompts._loader import load_prompt

ASSISTANT_DIRECTOR_SYSTEM_PROMPT = load_prompt('assistant-director/system')


def build_assistant_director_message(
    transcript: str,
    style_preset: str = "modern",
    output_dir: str | None = None,
) -> str:
    """Build the user message for the Assistant Director agent.

    Args:
        transcript: Raw transcript or script text to analyze.
        style_preset: User-selected visual style preset (e.g. "modern", "playful").
        output_dir: Absolute path to the directory where CREATIVE_BRIEF.md should
                     be written. If provided, the prompt uses an absolute path to
                     prevent Claude from writing files to the wrong location.

    Returns:
        A formatted user message string for the Assistant Director agent.
    """

    # Use absolute path when output_dir is provided
    if output_dir:
        abs_brief_path = output_dir.replace("\\", "/") + "/CREATIVE_BRIEF.md"
    else:
        abs_brief_path = "CREATIVE_BRIEF.md"

    return f"""
## STYLE PRESET
The user has selected the **{style_preset}** style preset. Factor this into your
palette and font recommendations, but let the script's tone take priority when
there is a conflict.

## TRANSCRIPT / SCRIPT
```
{transcript}
```

## YOUR TASK
Analyze the transcript above and produce a Creative Brief.

1. Classify the tone (primary + optional secondary).
2. Choose a color palette and font pairing that match the tone and style preset.
3. Identify narrative beats and recommend an asset type for each.
4. Provide scene structure hints (count, pacing, hero moments, opening hook).

## OUTPUT FILE

**CRITICAL: You MUST use the Write tool to create the Creative Brief at the EXACT path below.**

**EXACT path (use this VERBATIM in your Write tool call):** `{abs_brief_path}`

Follow the structure defined in your system prompt exactly.

When the file is written, respond: "BRIEF COMPLETE"
"""
