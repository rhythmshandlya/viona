#!/usr/bin/env python3
"""
Test script for Visual Director Utilities.

Tests:
1. Style color retrieval
2. Plan validation
3. JSON parsing from LLM responses
"""

import json
import sys
from pathlib import Path

# Add current directory to path
sys.path.insert(0, str(Path(__file__).parent))

from visual_director import (
    get_style_colors,
    validate_visual_plan,
    parse_visual_plan,
    extract_thinking,
)


def test_style_colors():
    """Test style color retrieval."""
    print("=" * 50)
    print("TEST: Style Colors")
    print("=" * 50)

    for preset in ["minimal", "modern", "playful", "bold", "classic"]:
        colors = get_style_colors(preset)
        print(f"  {preset}: {len(colors)} colors - bg={colors.get('bg', 'N/A')}")

    # Test fallback to modern
    unknown = get_style_colors("unknown_preset")
    assert unknown == get_style_colors("modern")
    print("  OK Unknown preset falls back to modern")

    print("  OK PASSED\n")


def test_plan_validation():
    """Test plan validation logic."""
    print("=" * 50)
    print("TEST: Plan Validation")
    print("=" * 50)

    # Valid plan
    valid_plan = {
        "meta": {
            "project_id": "test",
            "total_duration_frames": 900,
            "fps": 30
        },
        "concept_analysis": {
            "key_entities": [
                {"name": "Client", "role": "sends requests", "visual_importance": "primary"}
            ],
            "relationships": [],
            "processes": []
        },
        "visual_system": {
            "metaphor_mapping": {
                "Client": {
                    "visual": "laptop-icon",
                    "style": {"color": "style.primary", "size_percent": 10}
                }
            }
        },
        "scenes": [
            {
                "scene_id": "S01",
                "frame_range": [0, 300],
                "narrative_goal": "Introduce client",
                "visual_story": {
                    "build_sequence": [
                        {"at_frame": 15, "action": "Client appears", "element": "Client", "technique": "spring"}
                    ],
                    "hero_moment": {
                        "what": "Client entrance",
                        "frame_range": [15, 60]
                    }
                },
                "element_positions": {
                    "Client": {"x_percent": 20, "y_percent": 40}
                }
            }
        ]
    }

    errors = validate_visual_plan(valid_plan, 1080, 1920)
    print(f"  Valid plan: {len(errors)} errors")
    assert len(errors) == 0, f"Expected 0 errors, got: {errors}"

    # Invalid plan - missing entity metaphor
    invalid_plan = json.loads(json.dumps(valid_plan))
    invalid_plan["visual_system"]["metaphor_mapping"] = {}

    errors2 = validate_visual_plan(invalid_plan, 1080, 1920)
    print(f"  Missing metaphor: {len(errors2)} errors")
    assert len(errors2) > 0

    # Invalid plan - absolute positions
    invalid_plan2 = json.loads(json.dumps(valid_plan))
    invalid_plan2["scenes"][0]["element_positions"]["Client"] = {"x": 100, "y": 200}

    errors3 = validate_visual_plan(invalid_plan2, 1080, 1920)
    print(f"  Absolute positions: {len(errors3)} errors")
    assert len(errors3) > 0

    # Invalid plan - stagger too short
    invalid_plan3 = json.loads(json.dumps(valid_plan))
    invalid_plan3["scenes"][0]["visual_story"]["build_sequence"] = [
        {"at_frame": 15, "action": "A appears", "element": "A"},
        {"at_frame": 18, "action": "B appears", "element": "B"},  # Only 3 frames gap
    ]

    errors4 = validate_visual_plan(invalid_plan3, 1080, 1920)
    print(f"  Short stagger: {len(errors4)} errors")
    assert len(errors4) > 0

    print("  OK PASSED\n")


def test_parse_visual_plan():
    """Test Visual Plan JSON parsing."""
    print("=" * 50)
    print("TEST: Parse Visual Plan")
    print("=" * 50)

    # Test with markdown code block
    response1 = """Here's the visual plan:
```json
{
  "meta": {"project_id": "test"},
  "concept_analysis": {"key_entities": []},
  "visual_system": {},
  "scenes": []
}
```
"""
    plan1 = parse_visual_plan(response1)
    assert plan1 is not None
    assert plan1["meta"]["project_id"] == "test"
    print("  OK Markdown code block parsing works")

    # Test with raw JSON
    response2 = '{"meta": {"project_id": "raw"}, "concept_analysis": {}, "visual_system": {}, "scenes": []}'
    plan2 = parse_visual_plan(response2)
    assert plan2 is not None
    assert plan2["meta"]["project_id"] == "raw"
    print("  OK Raw JSON parsing works")

    # Test with text before JSON
    response3 = """Let me create a plan for you.

{"meta": {"project_id": "mixed"}, "scenes": []}

That's the plan!"""
    plan3 = parse_visual_plan(response3)
    assert plan3 is not None
    assert plan3["meta"]["project_id"] == "mixed"
    print("  OK JSON embedded in text parsing works")

    print("  OK PASSED\n")


def test_extract_thinking():
    """Test thinking extraction."""
    print("=" * 50)
    print("TEST: Extract Thinking")
    print("=" * 50)

    # Test with thinking tags
    response1 = """<thinking>
This is my analysis of the problem.
I need to consider several factors.
</thinking>

Here's my plan..."""

    thinking1 = extract_thinking(response1)
    assert thinking1 is not None
    assert "analysis" in thinking1
    print("  OK Extracts thinking from tags")

    # Test with multiple thinking blocks
    response2 = """<thinking>First thought</thinking>
Some text
<thinking>Second thought</thinking>"""

    thinking2 = extract_thinking(response2)
    assert thinking2 is not None
    assert "First thought" in thinking2
    assert "Second thought" in thinking2
    print("  OK Extracts multiple thinking blocks")

    # Test without thinking tags
    response3 = "Just a plain response without any thinking tags."
    thinking3 = extract_thinking(response3)
    assert thinking3 is None
    print("  OK Returns None when no thinking tags")

    print("  OK PASSED\n")


def main():
    print("\n" + "=" * 50)
    print("VISUAL DIRECTOR UTILITIES TEST SUITE")
    print("=" * 50 + "\n")

    try:
        test_style_colors()
        test_plan_validation()
        test_parse_visual_plan()
        test_extract_thinking()

        print("=" * 50)
        print("ALL TESTS PASSED OK")
        print("=" * 50)
        return 0

    except AssertionError as e:
        print(f"\nFAIL TEST FAILED: {e}")
        return 1
    except Exception as e:
        print(f"\nFAIL ERROR: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
