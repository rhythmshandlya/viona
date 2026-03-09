#!/usr/bin/env python3
"""
E2E test for Phase 2e: Visual Screenshot Verification.

Tests the visual verification pipeline against the existing project in the workspace.
Uses real Claude API (OAuth via claude CLI).

Usage:
    python test_visual_verify_e2e.py [--scenes 1,2] [--skip-fix]
"""

import asyncio
import json
import os
import sys
import time
import traceback
from pathlib import Path

# Add current directory to path
sys.path.insert(0, str(Path(__file__).parent))

# Unset CLAUDECODE env var to allow nested Claude sessions (e2e testing)
os.environ.pop("CLAUDECODE", None)

# Workspace and project paths
WORKSPACE = Path(__file__).parent.parent.parent / "workspace"
PROJECT_ID = "proj_f9497e82_2d73_487b_a3cf_56dec6536adc"
SRC_DIR = WORKSPACE / "src" / PROJECT_ID
COMPOSITION_ID = "proj-f9497e82-2d73-487b-a3cf-56dec6536adc"


def banner(msg: str) -> None:
    print(f"\n{'='*60}")
    print(f"  {msg}")
    print(f"{'='*60}\n")


async def test_render_scene_still():
    """Test 1: Can we render a single still frame?"""
    banner("TEST 1: Render Scene Still")

    from claude_visual_generator import ClaudeVisualGenerator

    gen = ClaudeVisualGenerator(
        workspace=WORKSPACE,
        project_id=PROJECT_ID,
        bundle_output=WORKSPACE / "test-bundles",
    )

    # Set up entry point first
    original = gen._setup_entry_point()
    try:
        output_path = WORKSPACE / "visual-verify" / "test_still.png"
        output_path.parent.mkdir(parents=True, exist_ok=True)

        # Use frame 138 (keySync frame from Scene 1)
        print(f"Rendering still at frame 138 -> {output_path}")
        success, err = await gen._render_scene_still(
            composition_id=COMPOSITION_ID,
            frame=138,
            output_path=output_path,
        )

        if success:
            file_size = output_path.stat().st_size
            print(f"  PASS: Still rendered successfully ({file_size:,} bytes)")
            return True
        else:
            print(f"  FAIL: {err}")
            return False
    finally:
        gen._restore_entry_point(original)


async def test_visual_verify_pass():
    """Test 2: Can the verify agent review a screenshot and return PASS/FAIL?"""
    banner("TEST 2: Visual Verify Agent")

    from claude_visual_generator import ClaudeVisualGenerator

    gen = ClaudeVisualGenerator(
        workspace=WORKSPACE,
        project_id=PROJECT_ID,
        bundle_output=WORKSPACE / "test-bundles",
    )

    # First render a still
    original = gen._setup_entry_point()
    try:
        output_path = WORKSPACE / "visual-verify" / "test_verify.png"
        output_path.parent.mkdir(parents=True, exist_ok=True)

        success, err = await gen._render_scene_still(
            composition_id=COMPOSITION_ID,
            frame=138,
            output_path=output_path,
        )
        if not success:
            print(f"  SKIP: Could not render still: {err}")
            return None
    finally:
        gen._restore_entry_point(original)

    # Load scene data
    with open(SRC_DIR / "scenes.json", "r", encoding="utf-8") as f:
        scenes_data = json.load(f)
    plan_content = (SRC_DIR / "SCENE_PLAN.md").read_text(encoding="utf-8")

    scene_1 = scenes_data["scenes"][0]

    print(f"Running visual verify agent on Scene 1 screenshot...")
    start = time.time()
    passed, issues = await gen._run_visual_verify(
        scene_num=1,
        screenshot_path=output_path,
        scene_data=scene_1,
        plan_content=plan_content,
    )
    elapsed = time.time() - start

    print(f"  Result: {'PASS' if passed else 'FAIL'} (took {elapsed:.1f}s)")
    if issues:
        for i, issue in enumerate(issues):
            print(f"    {i+1}. {issue}")

    # Test passes if the agent returned a valid response (PASS or FAIL with issues)
    # The agent working correctly is the success criterion, not the scene passing
    if passed:
        print("  TEST OK: Agent reviewed and passed the scene")
        return True
    elif issues:
        print(f"  TEST OK: Agent reviewed and found {len(issues)} issue(s)")
        return True
    else:
        print("  TEST FAIL: Agent returned no response")
        return False


async def test_verify_and_fix_scene():
    """Test 3: Full verify-and-fix loop for a single scene."""
    banner("TEST 3: Verify-and-Fix Loop (Scene 1)")

    from claude_visual_generator import ClaudeVisualGenerator

    gen = ClaudeVisualGenerator(
        workspace=WORKSPACE,
        project_id=PROJECT_ID,
        bundle_output=WORKSPACE / "test-bundles",
    )

    with open(SRC_DIR / "scenes.json", "r", encoding="utf-8") as f:
        scenes_data = json.load(f)
    plan_content = (SRC_DIR / "SCENE_PLAN.md").read_text(encoding="utf-8")

    scene_1 = scenes_data["scenes"][0]

    # We need entry point set up for the verify-and-fix loop
    original = gen._setup_entry_point()
    try:
        print(f"Running verify-and-fix loop for Scene 1...")
        start = time.time()
        await gen._verify_and_fix_scene(
            scene_num=1,
            scene_data=scene_1,
            plan_content=plan_content,
            composition_id=COMPOSITION_ID,
        )
        elapsed = time.time() - start
        print(f"  Completed in {elapsed:.1f}s")
        return True
    except Exception as e:
        print(f"  ERROR: {e}")
        traceback.print_exc()
        return False
    finally:
        gen._restore_entry_point(original)


async def test_full_verification_phase():
    """Test 4: Full Phase 2e orchestrator (all scenes, parallel)."""
    banner("TEST 4: Full Visual Verification Phase (all scenes)")

    from claude_visual_generator import ClaudeVisualGenerator

    gen = ClaudeVisualGenerator(
        workspace=WORKSPACE,
        project_id=PROJECT_ID,
        bundle_output=WORKSPACE / "test-bundles",
    )

    with open(SRC_DIR / "scenes.json", "r", encoding="utf-8") as f:
        scenes_data = json.load(f)
    plan_content = (SRC_DIR / "SCENE_PLAN.md").read_text(encoding="utf-8")

    print(f"Running full visual verification phase ({len(scenes_data['scenes'])} scenes)...")
    start = time.time()
    try:
        await gen._run_visual_verification_phase(
            composition_id=COMPOSITION_ID,
            scenes_data=scenes_data,
            plan_content=plan_content,
        )
        elapsed = time.time() - start
        print(f"  Completed in {elapsed:.1f}s")
        return True
    except Exception as e:
        print(f"  ERROR: {e}")
        traceback.print_exc()
        return False


async def test_nonblocking_bad_composition():
    """Test 5: Non-blocking - bad composition ID should not crash."""
    banner("TEST 5: Non-blocking with Bad Composition ID")

    from claude_visual_generator import ClaudeVisualGenerator

    gen = ClaudeVisualGenerator(
        workspace=WORKSPACE,
        project_id=PROJECT_ID,
        bundle_output=WORKSPACE / "test-bundles",
    )

    with open(SRC_DIR / "scenes.json", "r", encoding="utf-8") as f:
        scenes_data = json.load(f)
    plan_content = (SRC_DIR / "SCENE_PLAN.md").read_text(encoding="utf-8")

    print("Running with bad composition ID 'nonexistent-comp'...")
    start = time.time()
    try:
        await gen._run_visual_verification_phase(
            composition_id="nonexistent-comp",
            scenes_data=scenes_data,
            plan_content=plan_content,
        )
        elapsed = time.time() - start
        print(f"  PASS: Completed without crashing ({elapsed:.1f}s)")
        return True
    except Exception as e:
        print(f"  FAIL: Crashed with: {e}")
        return False


async def main():
    import argparse
    parser = argparse.ArgumentParser(description="E2E test for Phase 2e Visual Verification")
    parser.add_argument("--test", type=str, default="all",
                        help="Which test to run: still, verify, fix, full, nonblock, all")
    args = parser.parse_args()

    banner("Phase 2e Visual Verification E2E Test")
    print(f"Workspace: {WORKSPACE}")
    print(f"Project:   {PROJECT_ID}")
    print(f"Scenes:    {SRC_DIR / 'scenes.json'}")

    # Verify prerequisites
    if not WORKSPACE.exists():
        print("ERROR: Workspace not found")
        sys.exit(1)
    if not (SRC_DIR / "scenes.json").exists():
        print("ERROR: scenes.json not found")
        sys.exit(1)

    results = {}
    test_map = {
        "still": ("Render Still", test_render_scene_still),
        "verify": ("Visual Verify Agent", test_visual_verify_pass),
        "fix": ("Verify-and-Fix Loop", test_verify_and_fix_scene),
        "full": ("Full Verification Phase", test_full_verification_phase),
        "nonblock": ("Non-blocking Bad Comp", test_nonblocking_bad_composition),
    }

    if args.test == "all":
        tests_to_run = list(test_map.keys())
    else:
        tests_to_run = [t.strip() for t in args.test.split(",")]

    for test_key in tests_to_run:
        if test_key not in test_map:
            print(f"Unknown test: {test_key}")
            continue
        name, func = test_map[test_key]
        try:
            result = await func()
            results[name] = result
        except Exception as e:
            print(f"  EXCEPTION: {e}")
            traceback.print_exc()
            results[name] = False

    # Summary
    banner("RESULTS")
    for name, result in results.items():
        status = "PASS" if result else ("SKIP" if result is None else "FAIL")
        print(f"  [{status}] {name}")

    failed = sum(1 for r in results.values() if r is False)
    if failed:
        print(f"\n{failed} test(s) failed")
        sys.exit(1)
    else:
        print(f"\nAll tests passed!")


if __name__ == "__main__":
    asyncio.run(main())
