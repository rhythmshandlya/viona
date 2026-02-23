#!/usr/bin/env python3
"""
E2E test: Does visual verification catch and fix broken animations?

Intentionally breaks Scene2 with common animation bugs, then runs
the verify-and-fix loop to see if Claude catches and repairs them.

Test cases:
  1. Blank scene (empty div) — should detect "no content"
  2. White-on-white text — should detect "text not readable"
  3. Restore original after each test
"""

import asyncio
import json
import os
import shutil
import sys
import time
from pathlib import Path

os.environ.pop("CLAUDECODE", None)
sys.path.insert(0, str(Path(__file__).parent))

WORKSPACE = Path(__file__).parent.parent.parent / "workspace"
PROJECT_ID = "proj_f9497e82_2d73_487b_a3cf_56dec6536adc"
SRC_DIR = WORKSPACE / "src" / PROJECT_ID
COMPOSITION_ID = "proj-f9497e82-2d73-487b-a3cf-56dec6536adc"
SCENE2_PATH = SRC_DIR / "scenes" / "Scene2.tsx"

# ── Broken scene variants ──

BLANK_SCENE = '''import React from 'react';
import { AbsoluteFill } from 'remotion';

export const Scene2: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: 'transparent' }}>
      {/* Nothing here */}
    </AbsoluteFill>
  );
};
'''

WHITE_ON_WHITE_SCENE = '''import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';

export const Scene2: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ background: '#FFFFFF' }}>
      <div style={{
        position: 'absolute',
        top: '35%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        opacity,
      }}>
        <h1 style={{ color: '#FFFFFF', fontSize: 60, fontWeight: 'bold' }}>
          OpenClaw Definition
        </h1>
        <p style={{ color: '#FEFEFE', fontSize: 30, marginTop: 20 }}>
          AI Agent Platform — compare with Claude Code
        </p>
      </div>
    </AbsoluteFill>
  );
};
'''


def banner(msg: str) -> None:
    print(f"\n{'='*60}")
    print(f"  {msg}")
    print(f"{'='*60}\n")


async def run_verify_on_scene(
    scene_num: int,
    scene_data: dict,
    plan_content: str,
) -> tuple[bool, list[str], float]:
    """Run verify-and-fix on a single scene, return (passed_first_check, issues, elapsed)."""
    from claude_visual_generator import ClaudeVisualGenerator

    gen = ClaudeVisualGenerator(
        workspace=WORKSPACE,
        project_id=PROJECT_ID,
        bundle_output=WORKSPACE / "test-bundles",
    )

    # Render screenshot
    original = gen._setup_entry_point()
    try:
        verify_dir = WORKSPACE / "visual-verify"
        screenshot = verify_dir / f"broken_test_scene{scene_num}.png"
        screenshot.parent.mkdir(parents=True, exist_ok=True)

        # Get the frame to render
        key_sync = scene_data.get("keySync", {})
        if key_sync.get("frame") is not None:
            frame = key_sync["frame"]
        else:
            frames = scene_data.get("frames", [0, 60])
            start = frames[0] if len(frames) > 0 else 0
            end = frames[1] if len(frames) > 1 else start + 60
            frame = (start + end) // 2

        success, err = await gen._render_scene_still(COMPOSITION_ID, frame, screenshot)
        if not success:
            print(f"  Render failed: {err[:200]}")
            return True, [], 0.0  # Can't test without screenshot

        # Run visual verify (no fix loop — just check if it catches the issue)
        start_time = time.time()
        passed, issues = await gen._run_visual_verify(
            scene_num=scene_num,
            screenshot_path=screenshot,
            scene_data=scene_data,
            plan_content=plan_content,
        )
        elapsed = time.time() - start_time
        return passed, issues, elapsed
    finally:
        gen._restore_entry_point(original)


async def run_full_fix_loop(
    scene_num: int,
    scene_data: dict,
    plan_content: str,
) -> float:
    """Run the full verify-and-fix loop on a scene, return elapsed time."""
    from claude_visual_generator import ClaudeVisualGenerator

    gen = ClaudeVisualGenerator(
        workspace=WORKSPACE,
        project_id=PROJECT_ID,
        bundle_output=WORKSPACE / "test-bundles",
    )

    original = gen._setup_entry_point()
    try:
        start_time = time.time()
        await gen._verify_and_fix_scene(
            scene_num=scene_num,
            scene_data=scene_data,
            plan_content=plan_content,
            composition_id=COMPOSITION_ID,
        )
        return time.time() - start_time
    finally:
        gen._restore_entry_point(original)


async def test_blank_scene():
    """Test 1: Does the reviewer catch a completely blank scene?"""
    banner("TEST 1: Blank Scene Detection")

    # Backup original
    original_content = SCENE2_PATH.read_text(encoding="utf-8")

    with open(SRC_DIR / "scenes.json", "r", encoding="utf-8") as f:
        scenes_data = json.load(f)
    plan_content = (SRC_DIR / "SCENE_PLAN.md").read_text(encoding="utf-8")
    scene2_data = scenes_data["scenes"][1]

    try:
        # Replace with blank scene
        SCENE2_PATH.write_text(BLANK_SCENE, encoding="utf-8")
        print("  Wrote blank Scene2.tsx (empty AbsoluteFill)")

        passed, issues, elapsed = await run_verify_on_scene(2, scene2_data, plan_content)

        print(f"  Verify result: {'PASS' if passed else 'FAIL'} ({elapsed:.1f}s)")
        if issues:
            for i, issue in enumerate(issues):
                print(f"    {i+1}. {issue[:120]}")

        if not passed:
            print(f"\n  SUCCESS: Reviewer correctly detected blank scene ({len(issues)} issues)")
            return True
        else:
            print(f"\n  FAILURE: Reviewer did NOT catch the blank scene!")
            return False
    finally:
        SCENE2_PATH.write_text(original_content, encoding="utf-8")
        print("  Restored original Scene2.tsx")


async def test_white_on_white():
    """Test 2: Does the reviewer catch white text on white background?"""
    banner("TEST 2: White-on-White Text Detection")

    original_content = SCENE2_PATH.read_text(encoding="utf-8")

    with open(SRC_DIR / "scenes.json", "r", encoding="utf-8") as f:
        scenes_data = json.load(f)
    plan_content = (SRC_DIR / "SCENE_PLAN.md").read_text(encoding="utf-8")
    scene2_data = scenes_data["scenes"][1]

    try:
        SCENE2_PATH.write_text(WHITE_ON_WHITE_SCENE, encoding="utf-8")
        print("  Wrote white-on-white Scene2.tsx")

        passed, issues, elapsed = await run_verify_on_scene(2, scene2_data, plan_content)

        print(f"  Verify result: {'PASS' if passed else 'FAIL'} ({elapsed:.1f}s)")
        if issues:
            for i, issue in enumerate(issues):
                print(f"    {i+1}. {issue[:120]}")

        if not passed:
            print(f"\n  SUCCESS: Reviewer correctly detected white-on-white ({len(issues)} issues)")
            return True
        else:
            print(f"\n  FAILURE: Reviewer did NOT catch white-on-white text!")
            return False
    finally:
        SCENE2_PATH.write_text(original_content, encoding="utf-8")
        print("  Restored original Scene2.tsx")


async def test_fix_loop_repairs_blank():
    """Test 3: Does the fix loop actually generate content for a blank scene?"""
    banner("TEST 3: Fix Loop Repairs Blank Scene")

    original_content = SCENE2_PATH.read_text(encoding="utf-8")

    with open(SRC_DIR / "scenes.json", "r", encoding="utf-8") as f:
        scenes_data = json.load(f)
    plan_content = (SRC_DIR / "SCENE_PLAN.md").read_text(encoding="utf-8")
    scene2_data = scenes_data["scenes"][1]

    try:
        SCENE2_PATH.write_text(BLANK_SCENE, encoding="utf-8")
        print("  Wrote blank Scene2.tsx")
        blank_size = len(BLANK_SCENE)

        elapsed = await run_full_fix_loop(2, scene2_data, plan_content)

        fixed_content = SCENE2_PATH.read_text(encoding="utf-8")
        fixed_size = len(fixed_content)

        print(f"  Fix loop completed in {elapsed:.1f}s")
        print(f"  Before: {blank_size} chars | After: {fixed_size} chars")

        if fixed_size > blank_size * 2:
            print(f"\n  SUCCESS: Fix agent generated substantial content ({fixed_size} chars)")
            # Check if the fixed content has meaningful elements
            has_interpolate = "interpolate" in fixed_content
            has_style = "style=" in fixed_content or "style={{" in fixed_content
            has_text = "OpenClaw" in fixed_content or "Claude" in fixed_content
            print(f"    Has interpolate(): {has_interpolate}")
            print(f"    Has styling: {has_style}")
            print(f"    Has relevant text: {has_text}")
            return True
        else:
            print(f"\n  FAILURE: Fix agent didn't add enough content")
            return False
    finally:
        SCENE2_PATH.write_text(original_content, encoding="utf-8")
        print("  Restored original Scene2.tsx")


async def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--test", type=str, default="all",
                        help="blank, white, fixloop, all")
    args = parser.parse_args()

    banner("Visual Verification: Broken Animation Detection Test")
    print(f"Workspace: {WORKSPACE}")
    print(f"Target: Scene 2 ({SCENE2_PATH.name})")

    test_map = {
        "blank": ("Blank Scene Detection", test_blank_scene),
        "white": ("White-on-White Detection", test_white_on_white),
        "fixloop": ("Fix Loop Repairs Blank", test_fix_loop_repairs_blank),
    }

    tests_to_run = list(test_map.keys()) if args.test == "all" else [t.strip() for t in args.test.split(",")]
    results = {}

    for key in tests_to_run:
        if key not in test_map:
            print(f"Unknown test: {key}")
            continue
        name, func = test_map[key]
        try:
            results[name] = await func()
        except Exception as e:
            print(f"  EXCEPTION: {e}")
            import traceback
            traceback.print_exc()
            results[name] = False
            # Always restore original on exception
            if SCENE2_PATH.exists():
                original = SRC_DIR / "scenes" / "Scene2.tsx.bak"
                if original.exists():
                    shutil.copy2(original, SCENE2_PATH)

    banner("RESULTS")
    for name, result in results.items():
        print(f"  [{'PASS' if result else 'FAIL'}] {name}")

    failed = sum(1 for r in results.values() if not r)
    if failed:
        print(f"\n{failed} test(s) failed")
        sys.exit(1)
    else:
        print("\nAll tests passed!")


if __name__ == "__main__":
    asyncio.run(main())
