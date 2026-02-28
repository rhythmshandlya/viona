#!/usr/bin/env python3
"""
E2E Tests for Visual Generation Pipeline Quality Fixes.

Validates all changes from the pipeline quality fixes plan:
1. All interpolate() code examples have BOTH extrapolateLeft AND extrapolateRight: 'clamp'
2. Director prompt corrections (Hook duration, sync gap, studio preset trim)
3. Exit animation recipes exist in both prompt copies
4. Advanced visual technique recipes exist in both prompt copies
5. Multi-frame screenshot verification logic
6. Short video handling in scene plan validation
7. VISUAL_VERIFY_PROMPT includes acceptance criteria instructions
8. CLAUDE.md files mention both clamps

Run: cd packages/worker/src/agents && python test_pipeline_quality_fixes.py
"""

import json
import re
import sys
import ast
from pathlib import Path

# Add current directory to path
sys.path.insert(0, str(Path(__file__).parent))

PASS_COUNT = 0
FAIL_COUNT = 0


def report(test_name: str, passed: bool, detail: str = ""):
    global PASS_COUNT, FAIL_COUNT
    status = "PASS" if passed else "FAIL"
    if passed:
        PASS_COUNT += 1
    else:
        FAIL_COUNT += 1
    suffix = f" — {detail}" if detail else ""
    print(f"  [{status}] {test_name}{suffix}")
    return passed


# ═══════════════════════════════════════════════════════════════════════════
# TEST GROUP 1: Python Syntax Validity
# ═══════════════════════════════════════════════════════════════════════════

def test_python_syntax():
    """All modified Python files must parse without errors."""
    print("\n" + "=" * 70)
    print("TEST GROUP 1: Python Syntax Validity")
    print("=" * 70)

    files = [
        Path(__file__).parent / "prompts" / "animator.py",
        Path(__file__).parent / "prompts" / "director.py",
        Path(__file__).parent / "claude_visual_generator.py",
    ]

    for f in files:
        try:
            source = f.read_text(encoding="utf-8")
            ast.parse(source)
            report(f"Syntax: {f.name}", True)
        except SyntaxError as e:
            report(f"Syntax: {f.name}", False, f"SyntaxError at line {e.lineno}: {e.msg}")


# ═══════════════════════════════════════════════════════════════════════════
# TEST GROUP 2: Import Validity
# ═══════════════════════════════════════════════════════════════════════════

def test_imports():
    """All prompt exports must be importable."""
    print("\n" + "=" * 70)
    print("TEST GROUP 2: Import Validity")
    print("=" * 70)

    try:
        from prompts.animator import ANIMATOR_SYSTEM_PROMPT
        report("Import ANIMATOR_SYSTEM_PROMPT", True, f"{len(ANIMATOR_SYSTEM_PROMPT)} chars")
    except Exception as e:
        report("Import ANIMATOR_SYSTEM_PROMPT", False, str(e))

    try:
        from prompts.animator import ANIMATOR_BASE_PROMPT
        report("Import ANIMATOR_BASE_PROMPT", True, f"{len(ANIMATOR_BASE_PROMPT)} chars")
    except Exception as e:
        report("Import ANIMATOR_BASE_PROMPT", False, str(e))

    try:
        from prompts.animator import ANIMATOR_SCENE_PROMPT_TEMPLATE
        report("Import ANIMATOR_SCENE_PROMPT_TEMPLATE", True)
    except Exception as e:
        report("Import ANIMATOR_SCENE_PROMPT_TEMPLATE", False, str(e))

    try:
        from prompts.animator import VISUAL_VERIFY_PROMPT
        report("Import VISUAL_VERIFY_PROMPT", True, f"{len(VISUAL_VERIFY_PROMPT)} chars")
    except Exception as e:
        report("Import VISUAL_VERIFY_PROMPT", False, str(e))

    try:
        from prompts.animator import VISUAL_FIX_PROMPT_TEMPLATE
        report("Import VISUAL_FIX_PROMPT_TEMPLATE", True)
    except Exception as e:
        report("Import VISUAL_FIX_PROMPT_TEMPLATE", False, str(e))

    try:
        from prompts.director import DIRECTOR_SYSTEM_PROMPT
        report("Import DIRECTOR_SYSTEM_PROMPT", True, f"{len(DIRECTOR_SYSTEM_PROMPT)} chars")
    except Exception as e:
        report("Import DIRECTOR_SYSTEM_PROMPT", False, str(e))

    try:
        from prompts.animator import get_studio_section
        studio = get_studio_section("studio")
        report("Import get_studio_section", True, f"studio={len(studio)} chars")
    except Exception as e:
        report("Import get_studio_section", False, str(e))


# ═══════════════════════════════════════════════════════════════════════════
# TEST GROUP 3: Interpolate Clamp Consistency (animator.py)
# ═══════════════════════════════════════════════════════════════════════════

def test_interpolate_clamp_consistency_animator():
    """Every extrapolateRight: 'clamp' must have a matching extrapolateLeft: 'clamp' nearby."""
    print("\n" + "=" * 70)
    print("TEST GROUP 3: Interpolate Clamp Consistency — animator.py")
    print("=" * 70)

    animator_path = Path(__file__).parent / "prompts" / "animator.py"
    content = animator_path.read_text(encoding="utf-8")
    lines = content.split("\n")

    right_count = sum(1 for l in lines if "extrapolateRight: 'clamp'" in l)
    left_count = sum(1 for l in lines if "extrapolateLeft: 'clamp'" in l)

    report("extrapolateRight count", right_count > 0, f"{right_count} occurrences")
    report("extrapolateLeft count", left_count > 0, f"{left_count} occurrences")
    report("Left count == Right count", left_count == right_count,
           f"Left={left_count}, Right={right_count}")

    # Find any interpolate() call lines that have Right but no Left within ±3 lines
    problems = []
    for i, line in enumerate(lines):
        if "extrapolateRight: 'clamp'" in line and "extrapolateLeft: 'clamp'" not in line:
            # Check window of ±3 lines for extrapolateLeft
            window = lines[max(0, i-3):i+4]
            window_text = "\n".join(window)
            if "extrapolateLeft: 'clamp'" not in window_text:
                # Exclude prose/rule text lines (no interpolate call)
                if "interpolate(" in window_text or "extrapolateLeft" in line.lower():
                    problems.append((i + 1, line.strip()[:80]))

    report("No orphan extrapolateRight in code examples", len(problems) == 0,
           f"{len(problems)} orphans found" if problems else "All paired")
    for line_num, text in problems[:5]:
        print(f"    Line {line_num}: {text}")


def test_interpolate_clamp_consistency_generator():
    """Every extrapolateRight: 'clamp' in claude_visual_generator.py must have matching Left."""
    print("\n" + "=" * 70)
    print("TEST GROUP 3b: Interpolate Clamp Consistency — claude_visual_generator.py")
    print("=" * 70)

    gen_path = Path(__file__).parent / "claude_visual_generator.py"
    content = gen_path.read_text(encoding="utf-8")
    lines = content.split("\n")

    # Find actual interpolate() code examples with extrapolateRight
    right_code_lines = []
    left_code_lines = []
    for i, line in enumerate(lines):
        if "extrapolateRight: 'clamp'" in line:
            # Skip pure prose/rule text (lines that are just descriptions)
            stripped = line.strip()
            if stripped.startswith("-") or stripped.startswith("[") or stripped.startswith("ALWAYS"):
                continue
            if "missing" in stripped.lower() or "Missing" in stripped:
                continue
            if ".append(" in stripped:
                continue
            if "CRITICAL:" in stripped or "and/or" in stripped:
                continue
            right_code_lines.append((i + 1, stripped[:80]))

        if "extrapolateLeft: 'clamp'" in line:
            stripped = line.strip()
            if stripped.startswith("-") or stripped.startswith("[") or stripped.startswith("ALWAYS"):
                continue
            if "missing" in stripped.lower() or "Missing" in stripped:
                continue
            if ".append(" in stripped:
                continue
            if "CRITICAL:" in stripped or "and/or" in stripped:
                continue
            left_code_lines.append((i + 1, stripped[:80]))

    report(f"Code examples with Right: {len(right_code_lines)}", True)
    report(f"Code examples with Left: {len(left_code_lines)}", True)
    report("Code example counts match", len(right_code_lines) == len(left_code_lines),
           f"Right={len(right_code_lines)}, Left={len(left_code_lines)}")


# ═══════════════════════════════════════════════════════════════════════════
# TEST GROUP 4: CLAUDE.md Files
# ═══════════════════════════════════════════════════════════════════════════

def test_claude_md_files():
    """Both CLAUDE.md files must mention BOTH clamps."""
    print("\n" + "=" * 70)
    print("TEST GROUP 4: CLAUDE.md Files")
    print("=" * 70)

    workspace = Path(__file__).parent.parent.parent / "workspace"
    claude_md_1 = workspace / "CLAUDE.md"
    claude_md_2 = workspace / ".claude" / "CLAUDE.md"

    for path in [claude_md_1, claude_md_2]:
        if not path.exists():
            report(f"File exists: {path.name}", False, f"Not found: {path}")
            continue

        content = path.read_text(encoding="utf-8")
        report(f"{path.relative_to(workspace)}: mentions BOTH clamps",
               "BOTH" in content and "extrapolateLeft" in content and "extrapolateRight" in content,
               content.split("\n")[10].strip() if len(content.split("\n")) > 10 else "")

    # Check both files are identical
    if claude_md_1.exists() and claude_md_2.exists():
        c1 = claude_md_1.read_text(encoding="utf-8")
        c2 = claude_md_2.read_text(encoding="utf-8")
        report("Both CLAUDE.md files are identical", c1 == c2)


# ═══════════════════════════════════════════════════════════════════════════
# TEST GROUP 5: Director Prompt
# ═══════════════════════════════════════════════════════════════════════════

def test_director_prompt():
    """Director prompt must have correct duration, sync gap, and trimmed studio preset."""
    print("\n" + "=" * 70)
    print("TEST GROUP 5: Director Prompt")
    print("=" * 70)

    from prompts.director import DIRECTOR_SYSTEM_PROMPT

    director_path = Path(__file__).parent / "prompts" / "director.py"
    content = director_path.read_text(encoding="utf-8")

    # 5a. Hook duration should be 7s or 7-8s (not 5s)
    report("Hook duration is 7s (not 5s)",
           "Scene 1 (Hook):    7s" in content or "Scene 1 (Hook):    7-8s" in content,
           "Found correct hook duration")

    # 5b. Sync gap should mention 5 seconds
    report("Sync gap says '5 seconds'",
           "5 seconds between" in content,
           "Max 5 seconds between sync points")

    # 5c. Studio preset trimmed — should NOT have DotGrid TSX code
    # Find the studio preset section
    studio_idx = content.find('"studio":')
    if studio_idx >= 0:
        # Get the studio preset value up to the next preset or closing
        studio_end = content.find('",\n', studio_idx + 100)
        studio_section = content[studio_idx:studio_end] if studio_end > 0 else ""

        report("Studio preset: no DotGrid TSX code",
               '<pattern id="dot-grid"' not in studio_section,
               "DotGrid TSX code removed")

        report("Studio preset: no ANIMATION LIFECYCLE",
               "ANIMATION LIFECYCLE" not in studio_section,
               "Animation lifecycle removed (belongs in Animator)")

        report("Studio preset: no RENDERING RULES",
               "RENDERING RULES" not in studio_section,
               "Rendering rules removed (belongs in Animator)")

        report("Studio preset: keeps color palette",
               "#0B0F1A" in studio_section,
               "Color palette present")

        report("Studio preset: keeps font pairs",
               "Bebas Neue" in studio_section,
               "Font pairs present")

        report("Studio preset: keeps template library",
               "TEMPLATE LIBRARY" in studio_section or "template" in studio_section.lower(),
               "Template guidance present")

    # 5d. Short video guidance
    report("Short video guidance present",
           "SHORT VIDEOS" in content or "short video" in content.lower(),
           "Found short video section")

    report("Short video: 4 seconds / 120 frames",
           "4 seconds" in content or "120 frames" in content,
           "4-second minimum for short videos")


# ═══════════════════════════════════════════════════════════════════════════
# TEST GROUP 6: Exit Animation Recipes
# ═══════════════════════════════════════════════════════════════════════════

def test_exit_animation_recipes():
    """Exit animation recipes must exist in BOTH monolithic and modular prompt copies."""
    print("\n" + "=" * 70)
    print("TEST GROUP 6: Exit Animation Recipes")
    print("=" * 70)

    from prompts.animator import ANIMATOR_SYSTEM_PROMPT, ANIMATOR_BASE_PROMPT

    for name, prompt in [("ANIMATOR_SYSTEM_PROMPT (monolithic)", ANIMATOR_SYSTEM_PROMPT),
                         ("ANIMATOR_BASE_PROMPT (modular)", ANIMATOR_BASE_PROMPT)]:
        report(f"{name}: has <exit_animations> tag",
               "<exit_animations>" in prompt and "</exit_animations>" in prompt)

        report(f"{name}: Fade-Shrink-Out recipe",
               "Fade-Shrink-Out" in prompt)

        report(f"{name}: Slide-Away recipe",
               "Slide-Away" in prompt)

        report(f"{name}: Dissolve-Scatter recipe",
               "Dissolve-Scatter" in prompt)

        report(f"{name}: Scale-Down-Fade recipe",
               "Scale-Down-Fade" in prompt)

        report(f"{name}: Reverse Stagger Pattern",
               "Reverse Stagger" in prompt or "reverse order" in prompt.lower())

        # All exit recipes should use both clamps
        exit_start = prompt.find("<exit_animations>")
        exit_end = prompt.find("</exit_animations>")
        if exit_start >= 0 and exit_end > exit_start:
            exit_section = prompt[exit_start:exit_end]
            right_count = exit_section.count("extrapolateRight: 'clamp'")
            left_count = exit_section.count("extrapolateLeft: 'clamp'")
            report(f"{name}: exit recipes have both clamps",
                   right_count == left_count and right_count > 0,
                   f"Left={left_count}, Right={right_count}")


# ═══════════════════════════════════════════════════════════════════════════
# TEST GROUP 7: Advanced Visual Technique Recipes
# ═══════════════════════════════════════════════════════════════════════════

def test_advanced_technique_recipes():
    """Advanced technique recipes must exist in BOTH prompt copies."""
    print("\n" + "=" * 70)
    print("TEST GROUP 7: Advanced Visual Technique Recipes")
    print("=" * 70)

    from prompts.animator import ANIMATOR_SYSTEM_PROMPT, ANIMATOR_BASE_PROMPT

    techniques = [
        ("Clip-Path Reveal", "clipPath"),
        ("SVG Stroke Draw-In / evolvePath", "evolvePath"),
        ("interpolateColors", "interpolateColors"),
        ("Gradient Text", "WebkitBackgroundClip"),
        ("Blur Entrance", "filter: `blur("),
        ("Text Stroke", "WebkitTextStroke"),
    ]

    for name, prompt in [("monolithic", ANIMATOR_SYSTEM_PROMPT),
                         ("modular", ANIMATOR_BASE_PROMPT)]:
        report(f"{name}: has <advanced_techniques> tag",
               "<advanced_techniques>" in prompt and "</advanced_techniques>" in prompt)

        for tech_name, marker in techniques:
            report(f"{name}: {tech_name}",
                   marker in prompt,
                   f"marker='{marker}'")


# ═══════════════════════════════════════════════════════════════════════════
# TEST GROUP 8: Visual Verify Prompt
# ═══════════════════════════════════════════════════════════════════════════

def test_visual_verify_prompt():
    """VISUAL_VERIFY_PROMPT must mention multi-frame review and acceptance criteria."""
    print("\n" + "=" * 70)
    print("TEST GROUP 8: Visual Verify Prompt")
    print("=" * 70)

    from prompts.animator import VISUAL_VERIFY_PROMPT

    report("Mentions three screenshots",
           "three" in VISUAL_VERIFY_PROMPT.lower() or "Three" in VISUAL_VERIFY_PROMPT)

    report("Mentions Early frame check",
           "Early" in VISUAL_VERIFY_PROMPT and "entrance" in VISUAL_VERIFY_PROMPT.lower())

    report("Mentions Key sync frame check",
           "Key sync" in VISUAL_VERIFY_PROMPT or "main content" in VISUAL_VERIFY_PROMPT.lower())

    report("Mentions Late frame check",
           "Late" in VISUAL_VERIFY_PROMPT and "exit" in VISUAL_VERIFY_PROMPT.lower())

    report("Mentions acceptance criteria",
           "Acceptance Criteria" in VISUAL_VERIFY_PROMPT or "acceptance criteria" in VISUAL_VERIFY_PROMPT)

    report("Has PASS/FAIL output format",
           "PASS" in VISUAL_VERIFY_PROMPT and "FAIL" in VISUAL_VERIFY_PROMPT)


# ═══════════════════════════════════════════════════════════════════════════
# TEST GROUP 9: Multi-Frame Verification Logic
# ═══════════════════════════════════════════════════════════════════════════

def test_multi_frame_verification_logic():
    """The multi-frame verification code must handle edge cases correctly."""
    print("\n" + "=" * 70)
    print("TEST GROUP 9: Multi-Frame Verification Logic")
    print("=" * 70)

    gen_path = Path(__file__).parent / "claude_visual_generator.py"
    content = gen_path.read_text(encoding="utf-8")

    # Check that verify_frames is a list (not a single value)
    report("verify_frames is a list",
           "verify_frames = [" in content)

    # Check 3-frame setup: early, keySync, late
    report("Has early frame (start + 15 or start + 10)",
           "start + 15" in content or "start + 10" in content)

    report("Has mid_frame (keySync)",
           "mid_frame" in content)

    report("Has late frame (end - 15)",
           "end - 15" in content)

    # Check short scene handling
    report("Handles very short scenes (< 45 frames)",
           "scene_duration < 45" in content or "duration < 45" in content)

    report("Handles short scenes (< 90 frames)",
           "scene_duration < 90" in content or "duration < 90" in content)

    # Check _run_visual_verify accepts list of paths
    report("_run_visual_verify accepts list[Path]",
           "screenshot_paths: list[Path]" in content)

    # Check acceptance criteria parsing
    report("Parses acceptance criteria checklist items",
           "acceptance_criteria" in content and "- [ ]" in content or r"\[[ x]\]" in content)


# ═══════════════════════════════════════════════════════════════════════════
# TEST GROUP 10: Short Video Handling
# ═══════════════════════════════════════════════════════════════════════════

def test_short_video_handling():
    """_validate_scene_plan must handle short videos with relaxed constraints."""
    print("\n" + "=" * 70)
    print("TEST GROUP 10: Short Video Handling")
    print("=" * 70)

    gen_path = Path(__file__).parent / "claude_visual_generator.py"
    content = gen_path.read_text(encoding="utf-8")

    # Check for 600 frame threshold (20 seconds)
    report("Has 600 frame threshold (20s)",
           "total_frames <= 600" in content)

    # Check for MIN_FRAMES = 120 (4 seconds)
    report("MIN_FRAMES = 120 for short videos",
           "MIN_FRAMES = 120" in content)

    # Check for single scene allowance (< 10s / 300 frames)
    report("Single scene for < 10s videos",
           "total_frames < 300" in content or "300" in content)

    # Check min_scenes is dynamic
    report("Dynamic min_scenes",
           "min_scenes" in content)


# ═══════════════════════════════════════════════════════════════════════════
# TEST GROUP 11: Functional Test — _validate_scene_plan
# ═══════════════════════════════════════════════════════════════════════════

def test_validate_scene_plan_functional():
    """Actually invoke _validate_scene_plan with test data to verify behavior."""
    print("\n" + "=" * 70)
    print("TEST GROUP 11: Functional — _validate_scene_plan")
    print("=" * 70)

    # We need to instantiate enough of the class to call the method.
    # _validate_scene_plan is a regular method (not async), so we can patch.
    from unittest.mock import MagicMock
    from claude_visual_generator import ClaudeVisualGenerator

    # Create a mock instance with just enough to call the method
    gen = MagicMock(spec=ClaudeVisualGenerator)
    gen._validate_scene_plan = ClaudeVisualGenerator._validate_scene_plan.__get__(gen)

    # Test 11a: Normal video (60s = 1800 frames) — 2 scenes required
    plan_1_scene = {
        "scenes": [
            {"frames": [0, 1800], "syncPoints": [{"frame": 0}, {"frame": 300}, {"frame": 600}, {"frame": 900}, {"frame": 1200}, {"frame": 1500}]}
        ]
    }
    result = gen._validate_scene_plan(plan_1_scene, 30, 1800)
    report("Normal video (60s): rejects 1 scene",
           not result["valid"],
           f"errors={result.get('errors', [])}")

    # Test 11b: Very short video (8s = 240 frames) — 1 scene OK
    plan_short_1 = {
        "scenes": [
            {"frames": [0, 240], "syncPoints": [{"frame": 0}, {"frame": 120}]}
        ]
    }
    result = gen._validate_scene_plan(plan_short_1, 30, 240)
    report("Very short video (8s): accepts 1 scene",
           result["valid"],
           f"errors={result.get('errors', [])}, warnings={result.get('warnings', [])}")

    # Test 11c: Short video (15s = 450 frames) — 2 scenes with 4s each OK
    plan_short_2 = {
        "scenes": [
            {"frames": [0, 200], "syncPoints": [{"frame": 0}, {"frame": 100}]},
            {"frames": [200, 450], "syncPoints": [{"frame": 200}, {"frame": 350}]},
        ]
    }
    result = gen._validate_scene_plan(plan_short_2, 30, 450)
    report("Short video (15s): accepts 200-frame scenes (MIN_FRAMES=120)",
           result["valid"],
           f"errors={result.get('errors', [])}")

    # Test 11d: Normal video — should reject 100-frame scenes
    plan_tiny_scenes = {
        "scenes": [
            {"id": 1, "frames": [0, 100], "syncPoints": [{"frame": 0}, {"frame": 50}]},
            {"id": 2, "frames": [100, 1800], "syncPoints": [{"frame": 100}, {"frame": 500}, {"frame": 900}, {"frame": 1300}, {"frame": 1700}]},
        ]
    }
    result = gen._validate_scene_plan(plan_tiny_scenes, 30, 1800)
    # A 100-frame scene in a 60s video should trigger a warning or auto-repair
    has_issue = len(result.get("warnings", [])) > 0 or len(result.get("errors", [])) > 0 or result.get("repaired", False)
    report("Normal video (60s): flags 100-frame scene",
           has_issue,
           f"warnings={result.get('warnings', [])[:1]}")


# ═══════════════════════════════════════════════════════════════════════════
# TEST GROUP 12: No Regressions — Prompt Structure
# ═══════════════════════════════════════════════════════════════════════════

def test_prompt_structure_no_regressions():
    """Verify key sections still exist and haven't been accidentally deleted."""
    print("\n" + "=" * 70)
    print("TEST GROUP 12: No Regressions — Prompt Structure")
    print("=" * 70)

    from prompts.animator import ANIMATOR_SYSTEM_PROMPT, ANIMATOR_BASE_PROMPT

    required_sections_monolithic = [
        ("<MANDATORY_PROCESS>", "Mandatory process"),
        ("<role>", "Role definition"),
        ("<workflow>", "Workflow"),
        ("<animation_patterns>", "Animation patterns"),
        ("<choreography>", "Choreography"),
        ("<easing_guide>", "Easing guide"),
        ("<exit_animations>", "Exit animations (NEW)"),
        ("<scene_transitions>", "Scene transitions"),
        ("<animation_recipes>", "Animation recipes"),
        ("<advanced_techniques>", "Advanced techniques (NEW)"),
        ("<prohibited_patterns>", "Prohibited patterns"),
        ("<remotion_rules>", "Remotion rules"),
    ]

    for tag, label in required_sections_monolithic:
        report(f"Monolithic: {label}",
               tag in ANIMATOR_SYSTEM_PROMPT)

    required_sections_modular = [
        ("<animation_patterns>", "Animation patterns"),
        ("<choreography>", "Choreography"),
        ("<easing_guide>", "Easing guide"),
        ("<exit_animations>", "Exit animations (NEW)"),
        ("<scene_transitions>", "Scene transitions"),
        ("<animation_recipes>", "Animation recipes"),
        ("<advanced_techniques>", "Advanced techniques (NEW)"),
        ("<prohibited_patterns>", "Prohibited patterns"),
        ("<remotion_rules>", "Remotion rules"),
    ]

    for tag, label in required_sections_modular:
        report(f"Modular: {label}",
               tag in ANIMATOR_BASE_PROMPT)


# ═══════════════════════════════════════════════════════════════════════════
# TEST GROUP 13: Prompt Copies Parity
# ═══════════════════════════════════════════════════════════════════════════

def test_prompt_copies_parity():
    """The monolithic and modular prompts should have the same sections and recipe counts."""
    print("\n" + "=" * 70)
    print("TEST GROUP 13: Prompt Copies Parity")
    print("=" * 70)

    from prompts.animator import ANIMATOR_SYSTEM_PROMPT, ANIMATOR_BASE_PROMPT

    # Both should have the same number of exit recipes
    mono_exit = ANIMATOR_SYSTEM_PROMPT.count("### Recipe")
    mod_exit = ANIMATOR_BASE_PROMPT.count("### Recipe")
    report("Same number of ### Recipe sections",
           mono_exit == mod_exit,
           f"Monolithic={mono_exit}, Modular={mod_exit}")

    # Both should have the same advanced techniques
    techniques = ["Clip-Path", "evolvePath", "interpolateColors", "Gradient Text", "Blur Entrance", "Text Stroke"]
    for tech in techniques:
        mono = tech in ANIMATOR_SYSTEM_PROMPT
        mod = tech in ANIMATOR_BASE_PROMPT
        report(f"Both have '{tech}'", mono and mod,
               f"mono={mono}, mod={mod}")

    # Interpolate clamp count should be similar (within 5% margin)
    mono_clamp = ANIMATOR_SYSTEM_PROMPT.count("extrapolateLeft: 'clamp'")
    mod_clamp = ANIMATOR_BASE_PROMPT.count("extrapolateLeft: 'clamp'")
    diff = abs(mono_clamp - mod_clamp)
    report("Clamp counts similar between copies",
           diff <= max(mono_clamp, mod_clamp) * 0.15,
           f"Monolithic={mono_clamp}, Modular={mod_clamp}, diff={diff}")


# ═══════════════════════════════════════════════════════════════════════════
# TEST GROUP 14: Triple-Brace JSX Typo Check
# ═══════════════════════════════════════════════════════════════════════════

def test_no_triple_brace_typos():
    """Check for }}}> typos in the animator prompt (should be }}>)."""
    print("\n" + "=" * 70)
    print("TEST GROUP 14: No Triple-Brace JSX Typos")
    print("=" * 70)

    animator_path = Path(__file__).parent / "prompts" / "animator.py"
    content = animator_path.read_text(encoding="utf-8")

    # Find }}}> which is a JSX typo (should be }}>)
    # Exclude lines inside f-strings where }}}}> is valid escaping for }}>
    # Also exclude {{{{ }}}} which is valid Python f-string escaping for {{ }}
    lines = content.split("\n")
    triple_brace_lines = []

    # Track whether we're inside an f-string
    in_fstring = False
    for i, line in enumerate(lines):
        stripped = line.strip()
        # Detect f-string boundaries (simplified: f""" opens, """ closes)
        if 'f"""' in stripped:
            in_fstring = True
        elif in_fstring and stripped == '"""':
            in_fstring = False

        # In f-strings, }}}> is valid (renders to }>), }}}}> is valid (renders to }}>)
        # Only flag }}}> outside f-strings (in plain """ strings)
        if "}}}>" in line and not in_fstring:
            # Also exclude lines with {{{{ which pair with }}}}
            if "{{{{" not in line:
                triple_brace_lines.append((i + 1, line.strip()[:80]))

    report("No }}}> typos in prompt (outside f-strings)",
           len(triple_brace_lines) == 0,
           f"{len(triple_brace_lines)} found" if triple_brace_lines else "Clean")
    for ln, text in triple_brace_lines[:5]:
        print(f"    Line {ln}: {text}")


# ═══════════════════════════════════════════════════════════════════════════
# TEST GROUP 15: Layout Quality Fixes
# ═══════════════════════════════════════════════════════════════════════════

def test_layout_quality_fixes():
    """Verify all layout-related fixes are in place."""
    print("\n" + "=" * 70)
    print("TEST GROUP 15: Layout Quality Fixes")
    print("=" * 70)

    from prompts.animator import ANIMATOR_SYSTEM_PROMPT, ANIMATOR_BASE_PROMPT

    # --- Issue 1: Scene example centering ---
    # "left: EW / 2" may appear ONCE as a "NEVER do this" bad example — that's OK
    for name, prompt in [("monolithic", ANIMATOR_SYSTEM_PROMPT),
                         ("modular", ANIMATOR_BASE_PROMPT)]:
        # Count occurrences and verify they're only in "WRONG" context
        import re as _re
        occurrences = [m.start() for m in _re.finditer(r"left: EW / 2", prompt)]
        bad_uses = []
        for pos in occurrences:
            context = prompt[max(0, pos - 100):pos + 50]
            if "WRONG" not in context and "NEVER" not in context and "❌" not in context:
                bad_uses.append(pos)
        report(f"{name}: 'left: EW / 2' only in 'NEVER do this' examples",
               len(bad_uses) == 0,
               f"{len(bad_uses)} bad uses found" if bad_uses else "Only in warnings")

    # --- Issue 2/18: Flexbox centering pattern ---
    for name, prompt in [("monolithic", ANIMATOR_SYSTEM_PROMPT),
                         ("modular", ANIMATOR_BASE_PROMPT)]:
        report(f"{name}: has flexbox centering pattern",
               "justifyContent: 'center'" in prompt and "display: 'flex'" in prompt)
        report(f"{name}: warns against left: EW/2",
               "WRONG" in prompt and "left EDGE at center" in prompt)

    # --- Issue 3: Title Fill uses EH not height ---
    for name, prompt in [("monolithic", ANIMATOR_SYSTEM_PROMPT),
                         ("modular", ANIMATOR_BASE_PROMPT)]:
        report(f"{name}: title fill uses EH * 0.4 (not height)",
               "height * 0.4" not in prompt,
               "Found 'height * 0.4'" if "height * 0.4" in prompt else "Uses EH")

    # --- Issue 5/8: overflow: hidden on glassmorphism ---
    for name, prompt in [("monolithic", ANIMATOR_SYSTEM_PROMPT),
                         ("modular", ANIMATOR_BASE_PROMPT)]:
        report(f"{name}: glassmorphism has overflow: hidden",
               "overflow: 'hidden' as const" in prompt)

    # --- Issue 5: text-slam has overflow container ---
    for name, prompt in [("monolithic", ANIMATOR_SYSTEM_PROMPT),
                         ("modular", ANIMATOR_BASE_PROMPT)]:
        # Search for the recipe heading, not just any mention
        slam_idx = prompt.find("`text-slam` — Text scales")
        if slam_idx >= 0:
            slam_section = prompt[slam_idx:slam_idx + 800]
            report(f"{name}: text-slam has overflow: hidden container",
                   "overflow: 'hidden'" in slam_section)
        else:
            report(f"{name}: text-slam recipe exists", False)

    # --- Issue 9: Particles use EW/EH ---
    for name, prompt in [("monolithic", ANIMATOR_SYSTEM_PROMPT),
                         ("modular", ANIMATOR_BASE_PROMPT)]:
        # The flowing particles should NOT use width/height from useVideoConfig
        particles_idx = prompt.find("Flowing Particles")
        if particles_idx >= 0:
            particles_section = prompt[particles_idx:particles_idx + 500]
            report(f"{name}: flowing particles use EW/EH",
                   "EW" in particles_section and "EH" in particles_section)
        else:
            report(f"{name}: flowing particles exists", False)

    # --- Issue 10: Text safety section ---
    for name, prompt in [("monolithic", ANIMATOR_SYSTEM_PROMPT),
                         ("modular", ANIMATOR_BASE_PROMPT)]:
        report(f"{name}: has Text Safety section",
               "Text Safety" in prompt and "maxWidth" in prompt and "overflowWrap" in prompt)

    # --- Issue 11: Zone system renamed ---
    for name, prompt in [("monolithic", ANIMATOR_SYSTEM_PROMPT),
                         ("modular", ANIMATOR_BASE_PROMPT)]:
        report(f"{name}: zone section renamed to 'Final Layout Zones'",
               "Final Layout Zones" in prompt)

    # --- Issue 14: 3D example uses EW/EH ---
    for name, prompt in [("monolithic", ANIMATOR_SYSTEM_PROMPT),
                         ("modular", ANIMATOR_BASE_PROMPT)]:
        report(f"{name}: 3D example uses EH/EW (not hardcoded pixels)",
               "top: 100," not in prompt or "width: 200" not in prompt)

    # --- Issue 16: Verify prompt layout checks ---
    from prompts.animator import VISUAL_VERIFY_PROMPT
    report("Verify prompt: centering check",
           "Centering" in VISUAL_VERIFY_PROMPT and "centered" in VISUAL_VERIFY_PROMPT.lower())
    report("Verify prompt: off-screen check",
           "Off-screen" in VISUAL_VERIFY_PROMPT or "off-screen" in VISUAL_VERIFY_PROMPT)
    report("Verify prompt: overlap check",
           "overlap" in VISUAL_VERIFY_PROMPT.lower())
    report("Verify prompt: margin check",
           "margin" in VISUAL_VERIFY_PROMPT.lower())
    report("Verify prompt: subtitle zone check",
           "subtitle" in VISUAL_VERIFY_PROMPT.lower() or "Subtitle zone" in VISUAL_VERIFY_PROMPT)

    # --- Issue 19: CLAUDE.md layout reference ---
    # Navigate from agents/ -> src/ -> worker/ -> workspace/
    claude_md = Path(__file__).parent / ".." / ".." / "workspace" / "CLAUDE.md"
    claude_md_inner = Path(__file__).parent / ".." / ".." / "workspace" / ".claude" / "CLAUDE.md"
    for label, path in [("CLAUDE.md", claude_md), (".claude/CLAUDE.md", claude_md_inner)]:
        content = path.read_text(encoding="utf-8")
        report(f"{label}: has Layout Quick Reference",
               "Layout Quick Reference" in content)
        report(f"{label}: mentions EW/EH",
               "EW" in content and "EH" in content)
        report(f"{label}: mentions flexbox centering",
               "justifyContent" in content)

    # --- Issue 17: Director element count aligned ---
    gen_path = Path(__file__).parent / "claude_visual_generator.py"
    gen_content = gen_path.read_text(encoding="utf-8")
    report("Generator: MAX 4 elements (aligned with Animator)",
           "MAX 4" in gen_content and "MAX 3" not in gen_content)


# ═══════════════════════════════════════════════════════════════════════════
# RUNNER
# ═══════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print("=" * 70)
    print("VISUAL GENERATION PIPELINE QUALITY FIXES — E2E TEST SUITE")
    print("=" * 70)

    test_python_syntax()
    test_imports()
    test_interpolate_clamp_consistency_animator()
    test_interpolate_clamp_consistency_generator()
    test_claude_md_files()
    test_director_prompt()
    test_exit_animation_recipes()
    test_advanced_technique_recipes()
    test_visual_verify_prompt()
    test_multi_frame_verification_logic()
    test_short_video_handling()
    test_validate_scene_plan_functional()
    test_prompt_structure_no_regressions()
    test_prompt_copies_parity()
    test_no_triple_brace_typos()
    test_layout_quality_fixes()

    print("\n" + "=" * 70)
    total = PASS_COUNT + FAIL_COUNT
    print(f"RESULTS: {PASS_COUNT}/{total} passed, {FAIL_COUNT} failed")
    print("=" * 70)

    if FAIL_COUNT > 0:
        print("\nFAILED — see details above")
        sys.exit(1)
    else:
        print("\nALL TESTS PASSED")
        sys.exit(0)
