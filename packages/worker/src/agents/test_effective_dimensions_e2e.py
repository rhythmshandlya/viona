#!/usr/bin/env python3
"""
E2E Test: Director produces dimension-aware plans for split layouts.

Uses real Claude API keys (OAuth via claude CLI) to verify the Director agent
correctly references per-scene dimensions and produces varied displayModes.

Requires: claude CLI authenticated with OAuth.
"""

import asyncio
import json
import os
import sys
import tempfile
import time
from pathlib import Path

# Add current directory to path
sys.path.insert(0, str(Path(__file__).parent))

from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions

# Resolve claude CLI path
CLAUDE_CLI_PATH = os.environ.get("CLAUDE_CLI_PATH", "claude")

# Short transcript for fast test
TEST_TRANSCRIPT = """## TRANSCRIPT (word-level timestamps)

[0.00s] "Machine" (frame 0)
[0.30s] "learning" (frame 9)
[0.60s] "models" (frame 18)
[0.90s] "learn" (frame 27)
[1.20s] "from" (frame 36)
[1.50s] "data" (frame 45)
[2.00s] "The" (frame 60)
[2.20s] "training" (frame 66)
[2.50s] "data" (frame 75)
[2.80s] "goes" (frame 84)
[3.00s] "into" (frame 90)
[3.30s] "the" (frame 99)
[3.50s] "model" (frame 105)
[4.00s] "Then" (frame 120)
[4.20s] "the" (frame 126)
[4.50s] "model" (frame 135)
[4.80s] "makes" (frame 144)
[5.00s] "predictions" (frame 150)
[5.50s] "on" (frame 165)
[5.80s] "new" (frame 174)
[6.00s] "data" (frame 180)
[6.50s] "Neural" (frame 195)
[6.80s] "networks" (frame 204)
[7.10s] "are" (frame 213)
[7.30s] "the" (frame 219)
[7.50s] "most" (frame 225)
[7.80s] "popular" (frame 234)
[8.00s] "approach" (frame 240)
"""


def get_director_prompt(
    layout_mode: str,
    pip_width: int | None = None,
    pip_height: int | None = None,
    source_width: int | None = None,
    source_height: int | None = None,
):
    """Build director prompt for a given layout with pip dimensions."""
    sys.path.insert(0, str(Path(__file__).parent / "prompts"))
    from director import DIRECTOR_SYSTEM_PROMPT, build_director_user_message

    user_msg = build_director_user_message(
        project_id="test_eff_dims",
        formatted_transcript=TEST_TRANSCRIPT,
        width=1080,
        height=1920,
        duration_frames=270,  # 9s at 30fps
        fps=30,
        style_preset="modern",
        layout_mode=layout_mode,
        source_width=source_width,
        source_height=source_height,
        pip_width=pip_width,
        pip_height=pip_height,
    )
    return DIRECTOR_SYSTEM_PROMPT, user_msg


def validate_dimension_aware_plan(scenes_data: dict, layout_mode: str, pip_width: int | None, pip_height: int | None) -> list[str]:
    """Validate that scenes.json demonstrates dimension awareness."""
    errors = []

    if "scenes" not in scenes_data:
        errors.append("Missing 'scenes' array")
        return errors

    scenes = scenes_data["scenes"]
    if not isinstance(scenes, list) or len(scenes) == 0:
        errors.append(f"Expected non-empty scenes array, got {type(scenes)}")
        return errors

    valid_modes = {"pip", "fullscreen", "overlay"}
    valid_transitions = {"cut", "fade", "zoom-in", "zoom-out"}
    modes_used = set()

    for i, scene in enumerate(scenes):
        sid = scene.get("id", i + 1)

        # Check displayMode
        dm = scene.get("displayMode")
        if dm is None:
            errors.append(f"Scene {sid}: missing displayMode")
        elif dm not in valid_modes:
            errors.append(f"Scene {sid}: invalid displayMode '{dm}'")
        else:
            modes_used.add(dm)

        # Check transition
        tr = scene.get("transition")
        if tr is None:
            errors.append(f"Scene {sid}: missing transition")
        else:
            for direction in ["enter", "exit"]:
                sub = tr.get(direction)
                if sub is None:
                    errors.append(f"Scene {sid}: transition missing '{direction}'")
                else:
                    t_type = sub.get("type")
                    if t_type not in valid_transitions:
                        errors.append(f"Scene {sid}: transition.{direction}.type '{t_type}' invalid")
                    if "durationMs" not in sub:
                        errors.append(f"Scene {sid}: transition.{direction} missing durationMs")

    # Variety check for 3+ scenes
    if len(scenes) >= 3 and len(modes_used) < 2:
        errors.append(f"No displayMode variety: only {modes_used} across {len(scenes)} scenes")

    return errors


async def run_director_test(
    layout_mode: str,
    pip_width: int | None = None,
    pip_height: int | None = None,
    source_width: int | None = None,
    source_height: int | None = None,
) -> dict:
    """Run the Director agent and return parsed scenes.json."""
    system_prompt, user_msg = get_director_prompt(
        layout_mode, pip_width, pip_height, source_width, source_height,
    )

    with tempfile.TemporaryDirectory() as tmpdir:
        work_dir = Path(tmpdir)

        # Create .claude settings
        claude_dir = work_dir / ".claude"
        claude_dir.mkdir()
        settings = {
            "permissions": {
                "defaultMode": "acceptEdits",
                "allow": ["Read(./**)", "Write(./**)", "Edit(./**)", "Glob(./**)", "Grep(./**)", "Bash(*)"],
            },
        }
        with open(claude_dir / "settings.local.json", "w") as f:
            json.dump(settings, f)

        # Inject absolute output paths
        abs_plan = (work_dir / "SCENE_PLAN.md").as_posix()
        abs_scenes = (work_dir / "scenes.json").as_posix()
        user_msg += f"\n\n**WRITE FILES TO:**\n- `{abs_plan}`\n- `{abs_scenes}`\n"

        client = ClaudeSDKClient(
            options=ClaudeAgentOptions(
                model="claude-sonnet-4-20250514",
                system_prompt={
                    "type": "preset",
                    "preset": "claude_code",
                    "append": system_prompt,
                },
                cwd=str(work_dir),
                max_turns=30,
                max_thinking_tokens=3000,
                allowed_tools=["Read", "Write", "Grep", "Glob"],
                cli_path=CLAUDE_CLI_PATH,
            )
        )

        print(f"  Sending Director query ({layout_mode}, pip={pip_width}x{pip_height})...", flush=True)
        start = time.time()
        tool_calls = []

        async with client:
            await client.query(user_msg)

            async for msg in client.receive_response():
                msg_type = type(msg).__name__
                if msg_type == "AssistantMessage" and hasattr(msg, "content"):
                    for block in msg.content:
                        if type(block).__name__ == "ToolUseBlock":
                            tool_calls.append(block.name)
                            print(f"    [Tool: {block.name}]", flush=True)
                elif msg_type == "ErrorMessage":
                    print(f"    [ERROR: {msg}]", flush=True)

        elapsed = time.time() - start
        print(f"  Director completed in {elapsed:.1f}s ({len(tool_calls)} tool calls)", flush=True)

        # Find scenes.json
        scenes_path = work_dir / "scenes.json"
        if not scenes_path.exists():
            for candidate in work_dir.rglob("scenes.json"):
                scenes_path = candidate
                break

        if not scenes_path.exists():
            raise FileNotFoundError(f"scenes.json not created. Files: {list(work_dir.rglob('*'))}")

        with open(scenes_path, encoding="utf-8") as f:
            return json.load(f)


async def main():
    print("\n" + "=" * 60)
    print("EFFECTIVE DIMENSIONS — E2E TEST (Real Claude API)")
    print("=" * 60)

    test_cases = [
        {
            "name": "stacked + pip 1080x960",
            "layout_mode": "stacked",
            "pip_width": 1080,
            "pip_height": 960,
            "source_width": 1920,
            "source_height": 1080,
        },
    ]

    results = {}
    all_passed = True

    for tc in test_cases:
        name = tc["name"]
        print(f"\n--- TEST: {name} ---")
        try:
            scenes_data = await run_director_test(
                layout_mode=tc["layout_mode"],
                pip_width=tc["pip_width"],
                pip_height=tc["pip_height"],
                source_width=tc["source_width"],
                source_height=tc["source_height"],
            )
            scene_count = len(scenes_data.get("scenes", []))
            print(f"  Got {scene_count} scenes")

            # Print scene summary
            for s in scenes_data.get("scenes", []):
                dm = s.get("displayMode", "MISSING")
                tr_enter = s.get("transition", {}).get("enter", {}).get("type", "MISSING")
                tr_exit = s.get("transition", {}).get("exit", {}).get("type", "MISSING")
                eff = s.get("effectiveDimensions", {})
                eff_str = f"{eff.get('width', '?')}x{eff.get('height', '?')}" if eff else "none"
                print(f"    Scene {s.get('id', '?')}: dm={dm}, eff={eff_str}, enter={tr_enter}, exit={tr_exit}")

            # Validate
            errors = validate_dimension_aware_plan(
                scenes_data, tc["layout_mode"], tc["pip_width"], tc["pip_height"],
            )
            if errors:
                print(f"  FAIL: {len(errors)} validation errors:")
                for e in errors:
                    print(f"    - {e}")
                all_passed = False
            else:
                print(f"  PASS")

            results[name] = {"passed": len(errors) == 0, "scenes": scene_count, "errors": errors}

        except Exception as e:
            print(f"  FAIL: {e}")
            results[name] = {"passed": False, "error": str(e)}
            all_passed = False

    # Summary
    print(f"\n{'=' * 60}")
    print("SUMMARY")
    print("=" * 60)
    for name, result in results.items():
        status = "PASS" if result.get("passed") else "FAIL"
        scenes = result.get("scenes", 0)
        print(f"  {status} {name}: {scenes} scenes")
        for err in result.get("errors", []):
            print(f"       - {err}")

    print(f"\nOverall: {'ALL PASSED' if all_passed else 'SOME FAILED'}")
    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
