#!/usr/bin/env python3
"""
Minimal focused E2E test for Dynamic Display Modes.

Tests that the Director agent produces scenes.json with per-scene
displayMode and transition fields for all layout modes.

Uses real Claude API keys (OAuth via claude CLI).
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

# Short transcript for fast test (< 10 seconds of content)
TEST_TRANSCRIPT = """## TRANSCRIPT (word-level timestamps)

[0.00s] "REST" (frame 0)
[0.30s] "APIs" (frame 9)
[0.60s] "let" (frame 18)
[0.80s] "your" (frame 24)
[1.00s] "app" (frame 30)
[1.30s] "talk" (frame 39)
[1.60s] "to" (frame 48)
[1.80s] "a" (frame 54)
[2.00s] "server" (frame 60)
[2.50s] "The" (frame 75)
[2.70s] "client" (frame 81)
[3.00s] "sends" (frame 90)
[3.30s] "a" (frame 99)
[3.50s] "request" (frame 105)
[4.00s] "and" (frame 120)
[4.20s] "gets" (frame 126)
[4.50s] "back" (frame 135)
[4.80s] "a" (frame 144)
[5.00s] "response" (frame 150)
[5.50s] "GET" (frame 165)
[5.80s] "retrieves" (frame 174)
[6.10s] "data" (frame 183)
[6.50s] "POST" (frame 195)
[6.80s] "creates" (frame 204)
[7.10s] "new" (frame 213)
[7.30s] "records" (frame 219)
[7.80s] "It's" (frame 234)
[8.00s] "that" (frame 240)
[8.20s] "simple" (frame 246)
"""


def get_director_prompt(layout_mode: str, source_width: int | None, source_height: int | None):
    """Build director prompt for a given layout mode."""
    sys.path.insert(0, str(Path(__file__).parent / "prompts"))
    from director import DIRECTOR_SYSTEM_PROMPT, build_director_user_message

    user_msg = build_director_user_message(
        project_id="test_display_modes",
        formatted_transcript=TEST_TRANSCRIPT,
        width=1080,
        height=1920,
        duration_frames=270,  # 9 seconds at 30fps
        fps=30,
        style_preset="modern",
        layout_mode=layout_mode,
        source_width=source_width,
        source_height=source_height,
    )
    return DIRECTOR_SYSTEM_PROMPT, user_msg


def validate_scenes_json(scenes_data: dict, layout_mode: str) -> list[str]:
    """Validate scenes.json has correct displayMode and transition fields."""
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

        # Check displayMode exists and is valid
        dm = scene.get("displayMode")
        if dm is None:
            errors.append(f"Scene {sid}: missing displayMode")
        elif dm not in valid_modes:
            errors.append(f"Scene {sid}: invalid displayMode '{dm}' (expected {valid_modes})")
        else:
            modes_used.add(dm)

        # Check transition exists and is valid
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
                        errors.append(f"Scene {sid}: transition.{direction}.type '{t_type}' not in {valid_transitions}")
                    if "durationMs" not in sub:
                        errors.append(f"Scene {sid}: transition.{direction} missing durationMs")

    # Check variety (should not be all the same mode for 3+ scenes)
    if len(scenes) >= 3 and len(modes_used) < 2:
        errors.append(f"No displayMode variety: only used {modes_used} across {len(scenes)} scenes")

    return errors


async def run_director_test(layout_mode: str, source_width: int | None = None, source_height: int | None = None) -> dict:
    """Run the Director agent and return parsed scenes.json."""
    system_prompt, user_msg = get_director_prompt(layout_mode, source_width, source_height)

    with tempfile.TemporaryDirectory() as tmpdir:
        work_dir = Path(tmpdir)

        # Create .claude settings to allow writing
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

        # Update paths in user_msg to point to temp dir
        abs_plan = (work_dir / "SCENE_PLAN.md").as_posix()
        abs_scenes = (work_dir / "scenes.json").as_posix()
        user_msg = user_msg.replace("SCENE_PLAN.md", abs_plan)
        # Only replace the exact path reference, not all occurrences
        user_msg = user_msg.replace(
            f"`scenes.json`\n**EXACT path",
            f"`scenes.json`\n**EXACT path"
        )

        # Inject absolute paths
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

        print(f"  Sending Director query ({layout_mode})...", flush=True)
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

        # Check output files
        scenes_path = work_dir / "scenes.json"
        if not scenes_path.exists():
            # Try common misplacements
            for candidate in work_dir.rglob("scenes.json"):
                scenes_path = candidate
                break

        if not scenes_path.exists():
            raise FileNotFoundError(f"scenes.json not created. Files in {work_dir}: {list(work_dir.rglob('*'))}")

        with open(scenes_path, encoding="utf-8") as f:
            return json.load(f)


async def main():
    print("\n" + "=" * 60)
    print("DYNAMIC DISPLAY MODES — E2E TEST")
    print("=" * 60)

    test_cases = [
        ("pip", None, None, "pip layout, no source dims"),
        ("split-horizontal", 1920, 1080, "split-horizontal + 16:9 source on 9:16 canvas (conservative)"),
        ("split-vertical", 1080, 1920, "split-vertical + 9:16 source on 9:16 canvas (flexible)"),
    ]

    results = {}
    all_passed = True

    for layout_mode, sw, sh, description in test_cases:
        print(f"\n--- TEST: {description} ---")
        try:
            scenes_data = await run_director_test(layout_mode, sw, sh)
            scene_count = len(scenes_data.get("scenes", []))
            print(f"  Got {scene_count} scenes")

            # Print scene summary
            for s in scenes_data.get("scenes", []):
                dm = s.get("displayMode", "MISSING")
                tr_enter = s.get("transition", {}).get("enter", {}).get("type", "MISSING")
                tr_exit = s.get("transition", {}).get("exit", {}).get("type", "MISSING")
                print(f"    Scene {s.get('id', '?')}: displayMode={dm}, enter={tr_enter}, exit={tr_exit}")

            # Validate
            errors = validate_scenes_json(scenes_data, layout_mode)
            if errors:
                print(f"  FAIL: {len(errors)} validation errors:")
                for e in errors:
                    print(f"    - {e}")
                all_passed = False
            else:
                print(f"  PASS")

            results[layout_mode] = {"passed": len(errors) == 0, "scenes": scene_count, "errors": errors}

        except Exception as e:
            print(f"  FAIL: {e}")
            results[layout_mode] = {"passed": False, "error": str(e)}
            all_passed = False

    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    for layout, result in results.items():
        status = "PASS" if result.get("passed") else "FAIL"
        scenes = result.get("scenes", 0)
        print(f"  {status} {layout}: {scenes} scenes")
        for err in result.get("errors", []):
            print(f"       - {err}")

    print(f"\nOverall: {'ALL PASSED' if all_passed else 'SOME FAILED'}")
    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
