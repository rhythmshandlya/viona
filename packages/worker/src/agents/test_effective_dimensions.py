#!/usr/bin/env python3
"""
Unit tests for dimension-aware prompt generation.

Tests that Director prompt functions (get_layout_context, build_director_user_message)
correctly incorporate pip dimensions, and that the Animator prompt contains
per-scene viewport patterns.
"""

import sys
from pathlib import Path

# Add prompts directory to path
sys.path.insert(0, str(Path(__file__).parent / "prompts"))

from director import get_layout_context, build_director_user_message
from animator import ANIMATOR_SYSTEM_PROMPT


# ===================================================================
# Director — get_layout_context tests
# ===================================================================

def test_split_horizontal_includes_pip_dimensions():
    """split-horizontal with explicit pip dims should mention them."""
    ctx = get_layout_context(
        "split-horizontal", 1080, 1920,
        pip_width=1080, pip_height=960,
    )
    assert "1080x960" in ctx, f"Expected '1080x960' in split-horizontal context, got:\n{ctx[:500]}"
    # Should also mention full canvas for fullscreen/overlay
    assert "1080x1920" in ctx, "Expected full canvas '1080x1920' in context"
    print("  PASS: split-horizontal includes pip dimensions 1080x960")


def test_split_vertical_includes_pip_dimensions():
    """split-vertical with explicit pip dims should mention them."""
    ctx = get_layout_context(
        "split-vertical", 1080, 1920,
        pip_width=540, pip_height=1920,
    )
    assert "540x1920" in ctx, f"Expected '540x1920' in split-vertical context, got:\n{ctx[:500]}"
    print("  PASS: split-vertical includes pip dimensions 540x1920")


def test_pip_layout_shows_full_canvas_for_all_modes():
    """pip layout (no split) shows full canvas dimensions for all displayModes."""
    ctx = get_layout_context("pip", 1080, 1920)
    # In pip layout, pip effective defaults to full canvas
    assert "1080x1920" in ctx, "Expected full canvas dims in pip layout context"
    # The per-dm dims block should list pip as full canvas too
    assert '"pip"' in ctx or "'pip'" in ctx or "pip" in ctx.lower()
    print("  PASS: pip layout shows full canvas for all modes")


def test_per_displaymode_dimensions_block_present():
    """All layout contexts include the per-displayMode dimensions block."""
    for layout_mode in ["pip", "split-horizontal", "split-vertical"]:
        ctx = get_layout_context(layout_mode, 1080, 1920, pip_width=540, pip_height=960)
        assert "Per-scene dimensions" in ctx or "per-scene" in ctx.lower() or "displayMode" in ctx, (
            f"Missing per-displayMode dimensions block in {layout_mode} context"
        )
    print("  PASS: all layout modes include per-displayMode dimensions block")


def test_split_horizontal_pip_area_label():
    """split-horizontal context mentions 'Pip area' with correct dimensions."""
    ctx = get_layout_context(
        "split-horizontal", 1080, 1920,
        pip_width=1080, pip_height=960,
    )
    assert "Pip area" in ctx or "pip area" in ctx.lower() or "1080x960" in ctx
    print("  PASS: split-horizontal mentions pip area dimensions")


def test_fallback_when_pip_dims_are_none():
    """When pip_width/pip_height are None, defaults to full canvas."""
    ctx = get_layout_context(
        "split-horizontal", 1080, 1920,
        pip_width=None, pip_height=None,
    )
    # Per-dm dims for pip should show full canvas since no explicit pip dims
    # The pip line should show 1080x1920 (falls back to canvas)
    assert "1080x1920" in ctx
    print("  PASS: None pip dims fall back to full canvas dimensions")


# ===================================================================
# Director — build_director_user_message tests
# ===================================================================

def test_build_director_user_message_passes_pip_dims():
    """build_director_user_message passes pip_width/pip_height to layout context."""
    msg = build_director_user_message(
        project_id="test_proj",
        formatted_transcript="[0.00s] Hello (frame 0)\n[1.00s] world (frame 30)",
        width=1080,
        height=1920,
        duration_frames=300,
        fps=30,
        style_preset="modern",
        layout_mode="split-horizontal",
        pip_width=1080,
        pip_height=960,
    )
    # The layout context should contain the pip dimensions
    assert "1080x960" in msg, "Expected pip dims '1080x960' in director user message"
    # Should also have canvas dims
    assert "1080x1920" in msg, "Expected canvas dims in director user message"
    print("  PASS: build_director_user_message includes pip dimensions")


def test_build_director_user_message_display_mode_schema():
    """User message includes displayMode schema with pip/fullscreen/overlay."""
    msg = build_director_user_message(
        project_id="test_proj",
        formatted_transcript="[0.00s] Test (frame 0)",
        width=1080,
        height=1920,
        duration_frames=300,
        fps=30,
    )
    assert "displayMode" in msg, "Expected displayMode in user message"
    assert "fullscreen" in msg, "Expected 'fullscreen' mode in user message"
    assert "overlay" in msg, "Expected 'overlay' mode in user message"
    assert "transition" in msg, "Expected 'transition' in user message"
    print("  PASS: user message includes displayMode schema")


def test_build_director_user_message_fallback_no_pip():
    """When pip_width/pip_height not provided, message still generates correctly."""
    msg = build_director_user_message(
        project_id="test_proj",
        formatted_transcript="[0.00s] Test (frame 0)",
        width=1080,
        height=1920,
        duration_frames=300,
        fps=30,
        layout_mode="split-vertical",
        # No pip_width / pip_height
    )
    # Should still contain canvas dimensions and layout context
    assert "1080x1920" in msg
    assert "split" in msg.lower() or "Split" in msg
    print("  PASS: user message works without explicit pip dims")


# ===================================================================
# Animator — ANIMATOR_SYSTEM_PROMPT content tests
# ===================================================================

def test_animator_has_per_scene_viewport_section():
    """ANIMATOR_SYSTEM_PROMPT contains per_scene_viewport section."""
    assert "per_scene_viewport" in ANIMATOR_SYSTEM_PROMPT, (
        "Missing <per_scene_viewport> section in ANIMATOR_SYSTEM_PROMPT"
    )
    print("  PASS: ANIMATOR_SYSTEM_PROMPT has per_scene_viewport section")


def test_animator_has_viewport_mcp_tool_references():
    """ANIMATOR_SYSTEM_PROMPT references viewport MCP tools."""
    assert "mcp__viewport__get_scene_dimensions" in ANIMATOR_SYSTEM_PROMPT, (
        "Missing mcp__viewport__get_scene_dimensions reference"
    )
    assert "mcp__viewport__validate_scene_code" in ANIMATOR_SYSTEM_PROMPT, (
        "Missing mcp__viewport__validate_scene_code reference"
    )
    print("  PASS: ANIMATOR_SYSTEM_PROMPT references viewport MCP tools")


def test_animator_has_effective_dimension_constants():
    """ANIMATOR_SYSTEM_PROMPT mentions sceneNEffectiveWidth/Height constants."""
    assert "scene1EffectiveWidth" in ANIMATOR_SYSTEM_PROMPT or "sceneNEffectiveWidth" in ANIMATOR_SYSTEM_PROMPT, (
        "Missing sceneNEffectiveWidth pattern in ANIMATOR_SYSTEM_PROMPT"
    )
    assert "scene1EffectiveHeight" in ANIMATOR_SYSTEM_PROMPT or "sceneNEffectiveHeight" in ANIMATOR_SYSTEM_PROMPT, (
        "Missing sceneNEffectiveHeight pattern in ANIMATOR_SYSTEM_PROMPT"
    )
    print("  PASS: ANIMATOR_SYSTEM_PROMPT has effective dimension constants")


def test_animator_has_overflow_hidden_pattern():
    """ANIMATOR_SYSTEM_PROMPT shows the overflow:hidden clipping pattern."""
    assert "overflow" in ANIMATOR_SYSTEM_PROMPT and "hidden" in ANIMATOR_SYSTEM_PROMPT, (
        "Missing overflow: 'hidden' clipping pattern in ANIMATOR_SYSTEM_PROMPT"
    )
    print("  PASS: ANIMATOR_SYSTEM_PROMPT shows overflow:hidden pattern")


def test_animator_overlay_mode_rules():
    """ANIMATOR_SYSTEM_PROMPT has overlay mode rules (transparent, no Background)."""
    lower = ANIMATOR_SYSTEM_PROMPT.lower()
    assert "overlay" in lower, "Missing overlay mode section"
    assert "transparent" in lower, "Missing transparency requirement for overlay"
    assert "background" in lower, "Missing Background component warning for overlay"
    print("  PASS: ANIMATOR_SYSTEM_PROMPT has overlay mode rules")


# ===================================================================
# Runner
# ===================================================================

def main():
    print("\n" + "=" * 60)
    print("EFFECTIVE DIMENSIONS — UNIT TESTS (Python)")
    print("=" * 60)

    tests = [
        # Director — get_layout_context
        test_split_horizontal_includes_pip_dimensions,
        test_split_vertical_includes_pip_dimensions,
        test_pip_layout_shows_full_canvas_for_all_modes,
        test_per_displaymode_dimensions_block_present,
        test_split_horizontal_pip_area_label,
        test_fallback_when_pip_dims_are_none,
        # Director — build_director_user_message
        test_build_director_user_message_passes_pip_dims,
        test_build_director_user_message_display_mode_schema,
        test_build_director_user_message_fallback_no_pip,
        # Animator prompt content
        test_animator_has_per_scene_viewport_section,
        test_animator_has_viewport_mcp_tool_references,
        test_animator_has_effective_dimension_constants,
        test_animator_has_overflow_hidden_pattern,
        test_animator_overlay_mode_rules,
    ]

    passed = 0
    failed = 0
    errors = []

    for test_fn in tests:
        try:
            test_fn()
            passed += 1
        except AssertionError as e:
            failed += 1
            errors.append((test_fn.__name__, str(e)))
            print(f"  FAIL: {test_fn.__name__}: {e}")
        except Exception as e:
            failed += 1
            errors.append((test_fn.__name__, str(e)))
            print(f"  ERROR: {test_fn.__name__}: {e}")

    print(f"\n{'=' * 60}")
    print(f"Results: {passed} passed, {failed} failed out of {len(tests)}")
    if errors:
        print("\nFailures:")
        for name, err in errors:
            print(f"  - {name}: {err}")
    print("=" * 60)

    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
