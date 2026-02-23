#!/usr/bin/env python3
"""
E2E Test: Animator Prompt Quality Validation

Runs the full Director → Animator pipeline with a real transcript and validates:
1. Spring constants use new SPRINGS presets (not old damping:22/stiffness:90)
2. Continuous storytelling — visual content coverage across transcript
3. Overlay scenes use full opacity (no opacity reduction)
4. Proper choreography patterns (stagger, anticipation)
5. Particle configuration matches new standards
6. TypeScript compiles successfully

Uses real Claude API keys (OAuth via claude CLI).
"""

import asyncio
import json
import os
import re
import sys
import time
from pathlib import Path

# Add current directory to path
sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).parent / "prompts"))

from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions

# Apply Windows command line length monkey-patch
if sys.platform == "win32":
    import tempfile
    try:
        from claude_agent_sdk._internal.transport.subprocess_cli import SubprocessCLITransport

        _original_build_command = SubprocessCLITransport._build_command
        _temp_files = []

        def _patched_build_command(self):
            cmd = _original_build_command(self)
            MAX_ARG_LENGTH = 2000
            long_args = ['--system-prompt', '--append-system-prompt', '--agents', '--mcp-config', '--settings']
            for arg_name in long_args:
                if arg_name in cmd:
                    idx = cmd.index(arg_name)
                    if idx + 1 < len(cmd):
                        arg_value = cmd[idx + 1]
                        if len(arg_value) > MAX_ARG_LENGTH:
                            suffix = '.json' if arg_value.strip().startswith(('{', '[')) else '.txt'
                            tf = tempfile.NamedTemporaryFile(mode='w', suffix=suffix, delete=False, encoding='utf-8')
                            tf.write(arg_value)
                            tf.close()
                            _temp_files.append(tf.name)
                            cmd[idx + 1] = f"@{tf.name}"
                            print(f"  [Windows Fix] Wrote {arg_name} ({len(arg_value)} chars) to temp file")
            return cmd

        SubprocessCLITransport._build_command = _patched_build_command
        print("[Windows Fix] Applied command line length monkey-patch")
    except ImportError:
        print("[Windows Fix] Could not patch SubprocessCLITransport")

# Monkey-patch: skip unknown SSE events (rate_limit_event etc.)
try:
    from claude_agent_sdk._internal import message_parser as _mp
    from claude_agent_sdk._errors import MessageParseError

    _original_parse = _mp.parse_message

    def _patched_parse(data):
        try:
            return _original_parse(data)
        except MessageParseError as exc:
            if "Unknown message type" in str(exc):
                return None
            raise

    _mp.parse_message = _patched_parse

    from claude_agent_sdk.client import ClaudeSDKClient as _Client
    _original_recv = _Client.receive_messages

    async def _patched_recv(self):
        async for msg in _original_recv(self):
            if msg is not None:
                yield msg

    _Client.receive_messages = _patched_recv
    print("[SDK] Monkey-patch applied: unknown events will be skipped")
except Exception as e:
    print(f"[SDK] Warning: could not apply monkey-patch ({e})")

# Resolve claude CLI path
import shutil as _shutil

def _find_claude_cli() -> str:
    """Find claude CLI, checking common locations."""
    # Check env var first
    env_path = os.environ.get("CLAUDE_CLI_PATH")
    if env_path:
        return env_path

    # Check PATH
    found = _shutil.which("claude")
    if found:
        return found

    # Windows-specific locations
    if sys.platform == "win32":
        user_home = os.environ.get("USERPROFILE", "")
        candidates = [
            os.path.join(user_home, "AppData", "Roaming", "npm", "claude.cmd"),
            os.path.join(user_home, "AppData", "Roaming", "npm", "claude"),
            os.path.join(user_home, ".npm-global", "bin", "claude.cmd"),
        ]
        for c in candidates:
            if os.path.isfile(c):
                return c

    return "claude"  # fallback

CLAUDE_CLI_PATH = _find_claude_cli()
print(f"Claude CLI: {CLAUDE_CLI_PATH}")

# ─────────────────────────────────────────────────────────────
# Test transcript (~15 seconds, covering REST APIs)
# Has enough content to require continuous storytelling
# ─────────────────────────────────────────────────────────────
TEST_TRANSCRIPT_WORDS = [
    {"word": "Machine", "start": 0.0, "end": 0.3},
    {"word": "learning", "start": 0.3, "end": 0.6},
    {"word": "is", "start": 0.6, "end": 0.75},
    {"word": "transforming", "start": 0.75, "end": 1.2},
    {"word": "how", "start": 1.2, "end": 1.4},
    {"word": "we", "start": 1.4, "end": 1.5},
    {"word": "build", "start": 1.5, "end": 1.8},
    {"word": "software", "start": 1.8, "end": 2.3},
    {"word": "Neural", "start": 2.5, "end": 2.8},
    {"word": "networks", "start": 2.8, "end": 3.2},
    {"word": "can", "start": 3.2, "end": 3.4},
    {"word": "process", "start": 3.4, "end": 3.8},
    {"word": "millions", "start": 3.8, "end": 4.2},
    {"word": "of", "start": 4.2, "end": 4.3},
    {"word": "data", "start": 4.3, "end": 4.6},
    {"word": "points", "start": 4.6, "end": 5.0},
    {"word": "in", "start": 5.0, "end": 5.1},
    {"word": "seconds", "start": 5.1, "end": 5.5},
    {"word": "Training", "start": 5.8, "end": 6.2},
    {"word": "a", "start": 6.2, "end": 6.3},
    {"word": "model", "start": 6.3, "end": 6.7},
    {"word": "requires", "start": 6.7, "end": 7.1},
    {"word": "three", "start": 7.1, "end": 7.4},
    {"word": "key", "start": 7.4, "end": 7.6},
    {"word": "steps", "start": 7.6, "end": 8.0},
    {"word": "First", "start": 8.3, "end": 8.6},
    {"word": "collect", "start": 8.6, "end": 9.0},
    {"word": "and", "start": 9.0, "end": 9.1},
    {"word": "clean", "start": 9.1, "end": 9.4},
    {"word": "your", "start": 9.4, "end": 9.6},
    {"word": "data", "start": 9.6, "end": 10.0},
    {"word": "Then", "start": 10.3, "end": 10.5},
    {"word": "choose", "start": 10.5, "end": 10.8},
    {"word": "the", "start": 10.8, "end": 10.9},
    {"word": "right", "start": 10.9, "end": 11.1},
    {"word": "algorithm", "start": 11.1, "end": 11.6},
    {"word": "Finally", "start": 11.9, "end": 12.3},
    {"word": "evaluate", "start": 12.3, "end": 12.8},
    {"word": "and", "start": 12.8, "end": 12.9},
    {"word": "iterate", "start": 12.9, "end": 13.4},
    {"word": "The", "start": 13.7, "end": 13.9},
    {"word": "results", "start": 13.9, "end": 14.3},
    {"word": "speak", "start": 14.3, "end": 14.6},
    {"word": "for", "start": 14.6, "end": 14.7},
    {"word": "themselves", "start": 14.7, "end": 15.2},
]

FPS = 30
DURATION_FRAMES = len(TEST_TRANSCRIPT_WORDS) // 3 * FPS  # ~150 frames per 5s
DURATION_FRAMES = int(15.2 * FPS) + 30  # 15.2s + 1s buffer = ~486 frames
WIDTH = 1080
HEIGHT = 1920


def format_transcript(words: list[dict], fps: int) -> str:
    """Format words into the transcript format the Director expects."""
    lines = ["## TRANSCRIPT (word-level timestamps)\n"]
    for w in words:
        frame = int(w["start"] * fps)
        lines.append(f'[{w["start"]:.2f}s] "{w["word"]}" (frame {frame})')
    return "\n".join(lines)


# ─────────────────────────────────────────────────────────────
# Phase 1: Director
# ─────────────────────────────────────────────────────────────

async def run_director(workspace: Path, project_id: str) -> dict:
    """Run Director phase and return scenes.json data."""
    from director import DIRECTOR_SYSTEM_PROMPT, build_director_user_message

    formatted = format_transcript(TEST_TRANSCRIPT_WORDS, FPS)

    user_msg = build_director_user_message(
        project_id=project_id,
        formatted_transcript=formatted,
        width=WIDTH,
        height=HEIGHT,
        duration_frames=DURATION_FRAMES,
        fps=FPS,
        style_preset="modern",
        layout_mode="pip",
        source_width=1920,
        source_height=1080,
    )

    src_dir = workspace / "src" / f"proj_{project_id}"
    src_dir.mkdir(parents=True, exist_ok=True)

    # Inject absolute paths into the user message
    abs_plan = (src_dir / "SCENE_PLAN.md").as_posix()
    abs_scenes = (src_dir / "scenes.json").as_posix()
    user_msg += f"\n\n**WRITE FILES TO:**\n- `{abs_plan}`\n- `{abs_scenes}`\n"

    client = ClaudeSDKClient(
        options=ClaudeAgentOptions(
            model="claude-sonnet-4-20250514",
            system_prompt={
                "type": "preset",
                "preset": "claude_code",
                "append": DIRECTOR_SYSTEM_PROMPT,
            },
            cwd=str(workspace),
            max_turns=30,
            max_thinking_tokens=3000,
            allowed_tools=["Read", "Write", "Grep", "Glob"],
            cli_path=CLAUDE_CLI_PATH,
        )
    )

    print("  [Director] Sending query...", flush=True)
    start = time.time()
    tool_calls = 0

    async with client:
        await client.query(user_msg)
        async for msg in client.receive_response():
            msg_type = type(msg).__name__
            if msg_type == "AssistantMessage" and hasattr(msg, "content"):
                for block in msg.content:
                    if type(block).__name__ == "ToolUseBlock":
                        tool_calls += 1
                        print(f"    [Tool: {block.name}]", flush=True)

    elapsed = time.time() - start
    print(f"  [Director] Completed in {elapsed:.1f}s ({tool_calls} tool calls)", flush=True)

    # Find scenes.json — Director may write to workspace root or src_dir
    scenes_path = src_dir / "scenes.json"
    plan_path = src_dir / "SCENE_PLAN.md"

    if not scenes_path.exists():
        # Check workspace root (common Director behavior)
        for candidate in [workspace / "scenes.json"]:
            if candidate.exists():
                # Copy to expected location for Animator
                import shutil
                shutil.copy2(candidate, scenes_path)
                print(f"  [Director] Copied scenes.json from {candidate} to {scenes_path}")
                break

    if not plan_path.exists():
        for candidate in [workspace / "SCENE_PLAN.md"]:
            if candidate.exists():
                import shutil
                shutil.copy2(candidate, plan_path)
                print(f"  [Director] Copied SCENE_PLAN.md from {candidate} to {plan_path}")
                break

    # Last resort: search recursively
    if not scenes_path.exists():
        for candidate in workspace.rglob("scenes.json"):
            if "node_modules" not in str(candidate) and "proj_f9497e82" not in str(candidate):
                import shutil
                shutil.copy2(candidate, scenes_path)
                break

    if not scenes_path.exists():
        raise FileNotFoundError(f"scenes.json not created. Files: {list(src_dir.rglob('*'))}")

    with open(scenes_path, encoding="utf-8") as f:
        return json.load(f)


# ─────────────────────────────────────────────────────────────
# Phase 2: Animator
# ─────────────────────────────────────────────────────────────

async def run_animator(workspace: Path, project_id: str) -> dict:
    """Run Animator phase (expects plan files from Director)."""
    from animator import (
        ANIMATOR_BASE_PROMPT,
        ANIMATOR_SETUP_PROMPT,
        ANIMATOR_SCENE_PROMPT_TEMPLATE,
        get_display_mode_rules,
        build_setup_user_message,
    )

    src_dir = workspace / "src" / f"proj_{project_id}"
    scenes_json_path = src_dir / "scenes.json"
    scene_plan_path = src_dir / "SCENE_PLAN.md"

    if not scenes_json_path.exists() or not scene_plan_path.exists():
        raise FileNotFoundError(f"Plan files not found in {src_dir}")

    with open(scenes_json_path, encoding="utf-8") as f:
        scenes_data = json.load(f)

    scenes = scenes_data.get("scenes", [])
    scene_count = len(scenes)
    print(f"  [Animator] {scene_count} scenes to implement", flush=True)

    # Step 1: Setup agent — creates constants.ts and shared components
    setup_user_msg = build_setup_user_message(project_id)

    client = ClaudeSDKClient(
        options=ClaudeAgentOptions(
            model="claude-sonnet-4-20250514",
            system_prompt={
                "type": "preset",
                "preset": "claude_code",
                "append": ANIMATOR_BASE_PROMPT + "\n\n" + ANIMATOR_SETUP_PROMPT,
            },
            cwd=str(workspace),
            max_turns=30,
            max_thinking_tokens=5000,
            allowed_tools=["Read", "Write", "Edit", "Grep", "Glob", "Bash"],
            cli_path=CLAUDE_CLI_PATH,
        )
    )

    print("  [Animator] Step 1: Setup (constants + shared components)...", flush=True)
    start = time.time()

    async with client:
        await client.query(setup_user_msg)
        async for msg in client.receive_response():
            msg_type = type(msg).__name__
            if msg_type == "AssistantMessage" and hasattr(msg, "content"):
                for block in msg.content:
                    if type(block).__name__ == "ToolUseBlock":
                        print(f"    [Tool: {block.name}]", flush=True)

    elapsed = time.time() - start
    print(f"  [Animator] Setup completed in {elapsed:.1f}s", flush=True)

    # Step 2: Generate each scene
    for i, scene in enumerate(scenes):
        scene_num = i + 1
        display_mode = scene.get("displayMode", "fullscreen")
        mode_rules = get_display_mode_rules(display_mode)

        # Build scene prompt using the template + appended scene data
        scene_prompt = ANIMATOR_SCENE_PROMPT_TEMPLATE.format(
            scene_number=scene_num,
            display_mode_rules=mode_rules,
            project_id=project_id,
        )
        scene_json_str = json.dumps(scene, indent=2)
        full_scene_prompt = f"""{scene_prompt}

## YOUR SCENE DATA
```json
{scene_json_str}
```

## CONTEXT FILES (read these before implementing)
1. Read `src/{project_id}/constants.ts` — shared constants (DO NOT modify)
2. Read `src/{project_id}/SCENE_PLAN.md` — narrative plan for context
3. List `src/{project_id}/components/` — available shared components

Write your implementation to `src/{project_id}/scenes/Scene{scene_num}.tsx`.
"""

        print(f"  [Animator] Step 2.{scene_num}: Scene {scene_num} ({display_mode})...", flush=True)
        scene_start = time.time()

        scene_client = ClaudeSDKClient(
            options=ClaudeAgentOptions(
                model="claude-sonnet-4-20250514",
                system_prompt={
                    "type": "preset",
                    "preset": "claude_code",
                    "append": ANIMATOR_BASE_PROMPT,
                },
                cwd=str(workspace),
                max_turns=30,
                max_thinking_tokens=5000,
                allowed_tools=["Read", "Write", "Edit", "Grep", "Glob", "Bash"],
                cli_path=CLAUDE_CLI_PATH,
            )
        )

        async with scene_client:
            await scene_client.query(full_scene_prompt)
            async for msg in scene_client.receive_response():
                msg_type = type(msg).__name__
                if msg_type == "AssistantMessage" and hasattr(msg, "content"):
                    for block in msg.content:
                        if type(block).__name__ == "ToolUseBlock":
                            print(f"    [Tool: {block.name}]", flush=True)

        scene_elapsed = time.time() - scene_start
        print(f"  [Animator] Scene {scene_num} completed in {scene_elapsed:.1f}s", flush=True)

    # Step 3: Create index.tsx
    index_prompt = f"""Create the main index.tsx file at `src/proj_{project_id}/index.tsx`.

Import ALL scene components from `./scenes/Scene1`, `./scenes/Scene2`, etc.
Use `<Sequence>` to arrange them according to scenes.json timing.

Read the scenes.json at `src/proj_{project_id}/scenes.json` for the timing data.
The composition ID should be `proj-{project_id.replace('_', '-')}`.

Also create `src/proj_{project_id}/metadata.json` with:
- compositionId: "proj-{project_id.replace('_', '-')}"
- durationInFrames: {DURATION_FRAMES}
- fps: {FPS}
- width: {WIDTH}
- height: {HEIGHT}
"""

    print("  [Animator] Step 3: Creating index.tsx...", flush=True)
    index_client = ClaudeSDKClient(
        options=ClaudeAgentOptions(
            model="claude-sonnet-4-20250514",
            system_prompt={
                "type": "preset",
                "preset": "claude_code",
                "append": ANIMATOR_BASE_PROMPT,
            },
            cwd=str(workspace),
            max_turns=15,
            max_thinking_tokens=3000,
            allowed_tools=["Read", "Write", "Edit", "Grep", "Glob"],
            cli_path=CLAUDE_CLI_PATH,
        )
    )

    async with index_client:
        await index_client.query(index_prompt)
        async for msg in index_client.receive_response():
            pass

    total_elapsed = time.time() - start
    print(f"  [Animator] All steps completed in {total_elapsed:.1f}s", flush=True)

    return {"success": True, "elapsed": total_elapsed}


# ─────────────────────────────────────────────────────────────
# Validation functions
# ─────────────────────────────────────────────────────────────

def validate_spring_constants(scene_files: list[Path]) -> list[str]:
    """Check that generated code uses new SPRINGS presets, not old values."""
    errors = []
    old_pattern = re.compile(r'damping:\s*22.*stiffness:\s*90')
    springs_import = re.compile(r'SPRINGS')

    for f in scene_files:
        content = f.read_text(encoding="utf-8")
        if old_pattern.search(content):
            errors.append(f"{f.name}: Still uses old spring values (damping:22, stiffness:90)")
        # Check that SPRINGS constant is used
        if "spring(" in content and not springs_import.search(content):
            errors.append(f"{f.name}: Uses spring() but doesn't import SPRINGS from constants")

    return errors


def validate_overlay_opacity(scene_files: list[Path], scenes_data: dict) -> list[str]:
    """Check overlay scenes don't reduce opacity below 1.0."""
    errors = []
    # Find which scenes are overlay
    overlay_scenes = set()
    for scene in scenes_data.get("scenes", []):
        if scene.get("displayMode") == "overlay":
            overlay_scenes.add(scene.get("id", 0))

    if not overlay_scenes:
        return ["INFO: No overlay scenes to validate"]

    opacity_reduction = re.compile(r'opacity.*\*\s*0\.[0-9]')
    max_opacity_cap = re.compile(r'Math\.min\([^)]*0\.[0-9]')

    for f in scene_files:
        # Check if this is an overlay scene file
        scene_num = re.search(r'Scene(\d+)', f.name)
        if not scene_num:
            continue
        num = int(scene_num.group(1))
        if num not in overlay_scenes:
            continue

        content = f.read_text(encoding="utf-8")
        if opacity_reduction.search(content):
            errors.append(f"{f.name} (overlay): Reduces opacity with multiplication (* 0.x)")
        if max_opacity_cap.search(content):
            errors.append(f"{f.name} (overlay): Caps opacity with Math.min below 1.0")

    return errors


def validate_storytelling_coverage(scene_files: list[Path], scenes_data: dict) -> list[str]:
    """Check that scenes have enough visual elements for continuous storytelling."""
    errors = []
    warnings = []

    # Key phrases that should appear as visual elements
    key_phrases = [
        "machine learning", "neural network", "data", "algorithm",
        "training", "model", "collect", "evaluate", "iterate",
    ]

    all_content = ""
    for f in scene_files:
        all_content += f.read_text(encoding="utf-8").lower()

    found = 0
    for phrase in key_phrases:
        if phrase in all_content:
            found += 1

    coverage = found / len(key_phrases) * 100
    if coverage < 50:
        errors.append(f"Low storytelling coverage: only {found}/{len(key_phrases)} key phrases found in visuals ({coverage:.0f}%)")
    elif coverage < 75:
        warnings.append(f"Moderate coverage: {found}/{len(key_phrases)} key phrases ({coverage:.0f}%)")
    else:
        print(f"    Good storytelling coverage: {found}/{len(key_phrases)} key phrases ({coverage:.0f}%)")

    # Check element count per scene (should have multiple visual elements)
    for f in scene_files:
        content = f.read_text(encoding="utf-8")
        # Count distinct animated elements (spring/interpolate calls)
        spring_calls = len(re.findall(r'spring\s*\(', content))
        interpolate_calls = len(re.findall(r'interpolate\s*\(', content))
        total_animations = spring_calls + interpolate_calls

        if total_animations < 3:
            errors.append(f"{f.name}: Only {total_animations} animation calls — likely sparse visuals")

    return errors + warnings


def validate_choreography(scene_files: list[Path]) -> list[str]:
    """Check for proper animation choreography patterns."""
    errors = []

    for f in scene_files:
        content = f.read_text(encoding="utf-8")

        # Check for stagger usage
        has_stagger = "STAGGER" in content or re.search(r'\*\s*[4-9]\b', content) or "delay" in content.lower()
        has_multiple_springs = len(re.findall(r'spring\s*\(', content)) >= 2

        if has_multiple_springs and not has_stagger:
            errors.append(f"{f.name}: Multiple springs but no stagger/delay pattern")

        # Check for clamp on interpolate
        interpolate_count = len(re.findall(r'interpolate\s*\(', content))
        clamp_count = len(re.findall(r"extrapolateRight:\s*'clamp'", content))
        if interpolate_count > 0 and clamp_count < interpolate_count * 0.5:
            errors.append(f"{f.name}: {clamp_count}/{interpolate_count} interpolate calls have extrapolateRight:'clamp'")

    return errors


def validate_constants(constants_path: Path) -> list[str]:
    """Validate constants.ts has proper SPRINGS/STAGGER definitions."""
    errors = []

    if not constants_path.exists():
        errors.append("constants.ts not found!")
        return errors

    content = constants_path.read_text(encoding="utf-8")

    # Check SPRINGS object
    if "SPRINGS" not in content:
        errors.append("constants.ts: Missing SPRINGS definition")
    else:
        # Verify key presets exist
        for preset in ["SNAPPY", "SMOOTH", "BOUNCY", "HEAVY"]:
            if preset not in content:
                errors.append(f"constants.ts: Missing SPRINGS.{preset}")

        # Check for correct SMOOTH values
        if "damping: 26" not in content:
            errors.append("constants.ts: SMOOTH should have damping: 26")
        if "stiffness: 120" not in content:
            errors.append("constants.ts: SMOOTH should have stiffness: 120")

    # Check STAGGER object
    if "STAGGER" not in content:
        errors.append("constants.ts: Missing STAGGER definition")

    return errors


# ─────────────────────────────────────────────────────────────
# TypeScript verification
# ─────────────────────────────────────────────────────────────

async def verify_typescript(workspace: Path) -> tuple[bool, str]:
    """Run TypeScript compiler to check for errors."""
    import subprocess

    try:
        result = subprocess.run(
            ["npx", "tsc", "--noEmit", "--pretty", "false"],
            cwd=str(workspace),
            capture_output=True,
            text=True,
            timeout=60,
            shell=True,  # Windows needs shell=True for npx
        )
        if result.returncode == 0:
            return True, ""
        return False, result.stdout + result.stderr
    except Exception as e:
        return False, str(e)


# ─────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────

async def main():
    print("\n" + "=" * 70)
    print("ANIMATOR PROMPT QUALITY — E2E TEST")
    print("=" * 70)

    workspace = Path(__file__).parent.parent.parent / "workspace"
    workspace = workspace.resolve()
    print(f"Workspace: {workspace}")

    project_id = "e2e_test_quality"
    src_dir = workspace / "src" / f"proj_{project_id}"

    # Check if Director output already exists (skip re-running)
    scenes_json_path = src_dir / "scenes.json"
    plan_path = src_dir / "SCENE_PLAN.md"

    results = {}

    if scenes_json_path.exists() and plan_path.exists():
        print(f"\n  Director output already exists at {src_dir}, skipping Phase 1")
        with open(scenes_json_path, encoding="utf-8") as f:
            scenes_data = json.load(f)
        scene_count = len(scenes_data.get("scenes", []))
        print(f"  {scene_count} scenes from previous Director run")
        results["director"] = {"passed": True, "scenes": scene_count, "cached": True}
    else:
        # Clean and run Director
        if src_dir.exists():
            import shutil
            shutil.rmtree(src_dir)
            print(f"Cleaned up previous test output at {src_dir}")

        # ──────── Phase 1: Director ────────
        print("\n" + "-" * 70)
        print("PHASE 1: DIRECTOR")
        print("-" * 70)

        try:
            scenes_data = await run_director(workspace, project_id)
            scene_count = len(scenes_data.get("scenes", []))
            print(f"\n  Director produced {scene_count} scenes:")
            for s in scenes_data.get("scenes", []):
                dm = s.get("displayMode", "?")
                frames = s.get("frames", ["?", "?"])
                print(f"    Scene {s.get('id', '?')}: {s.get('displayMode', '?')} [{frames[0]}-{frames[1]}]")
            results["director"] = {"passed": True, "scenes": scene_count}
        except Exception as e:
            print(f"\n  DIRECTOR FAILED: {e}")
            results["director"] = {"passed": False, "error": str(e)}
            print("\nCannot proceed without Director output. Aborting.")
            return 1

    # ──────── Phase 2: Animator ────────
    print("\n" + "-" * 70)
    print("PHASE 2: ANIMATOR")
    print("-" * 70)

    try:
        animator_result = await run_animator(workspace, project_id)
        results["animator"] = {"passed": animator_result["success"]}
    except Exception as e:
        print(f"\n  ANIMATOR FAILED: {e}")
        results["animator"] = {"passed": False, "error": str(e)}
        # Still try to validate whatever was generated

    # ──────── Phase 3: Validation ────────
    print("\n" + "-" * 70)
    print("PHASE 3: VALIDATION")
    print("-" * 70)

    # Collect generated files
    scene_files = sorted(src_dir.glob("scenes/Scene*.tsx")) if (src_dir / "scenes").exists() else []
    constants_path = src_dir / "constants.ts"

    print(f"\n  Generated files: {[f.name for f in scene_files]}")
    print(f"  Constants: {'exists' if constants_path.exists() else 'MISSING'}")

    all_errors = []
    all_warnings = []

    # 3a. Constants validation
    print("\n  3a. Constants validation...")
    const_errors = validate_constants(constants_path)
    if const_errors:
        for e in const_errors:
            print(f"    FAIL: {e}")
        all_errors.extend(const_errors)
    else:
        print("    PASS: Constants have correct SPRINGS/STAGGER definitions")

    # 3b. Spring constants in scenes
    print("\n  3b. Spring constant validation...")
    spring_errors = validate_spring_constants(scene_files)
    if spring_errors:
        for e in spring_errors:
            print(f"    FAIL: {e}")
        all_errors.extend(spring_errors)
    else:
        print("    PASS: No old spring values found")

    # 3c. Overlay opacity
    print("\n  3c. Overlay opacity validation...")
    opacity_errors = validate_overlay_opacity(scene_files, scenes_data)
    for e in opacity_errors:
        if e.startswith("INFO"):
            print(f"    {e}")
        else:
            print(f"    FAIL: {e}")
            all_errors.append(e)

    # 3d. Storytelling coverage
    print("\n  3d. Storytelling coverage...")
    story_results = validate_storytelling_coverage(scene_files, scenes_data)
    for r in story_results:
        if "Low" in r or "Only" in r:
            print(f"    FAIL: {r}")
            all_errors.append(r)
        else:
            print(f"    WARN: {r}")
            all_warnings.append(r)

    # 3e. Choreography
    print("\n  3e. Choreography validation...")
    choreo_errors = validate_choreography(scene_files)
    if choreo_errors:
        for e in choreo_errors:
            print(f"    FAIL: {e}")
        all_errors.extend(choreo_errors)
    else:
        print("    PASS: Good choreography patterns")

    # 3f. TypeScript compilation
    print("\n  3f. TypeScript compilation...")
    ts_ok, ts_errors = await verify_typescript(workspace)
    if ts_ok:
        print("    PASS: TypeScript compiles cleanly")
    else:
        # Filter to only errors from our test project
        relevant_errors = [
            line for line in ts_errors.split("\n")
            if project_id in line and "error TS" in line
        ]
        if relevant_errors:
            print(f"    FAIL: {len(relevant_errors)} TypeScript errors:")
            for e in relevant_errors[:10]:
                print(f"      {e}")
            all_errors.append(f"TypeScript: {len(relevant_errors)} compilation errors")
        else:
            print("    PASS: No TypeScript errors in test project (other files may have errors)")

    # ──────── Summary ────────
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)

    print(f"\n  Director: {'PASS' if results.get('director', {}).get('passed') else 'FAIL'}")
    print(f"  Animator:  {'PASS' if results.get('animator', {}).get('passed') else 'FAIL'}")
    print(f"  Errors:    {len(all_errors)}")
    print(f"  Warnings:  {len(all_warnings)}")

    if all_errors:
        print("\n  ERRORS:")
        for e in all_errors:
            print(f"    - {e}")

    if all_warnings:
        print("\n  WARNINGS:")
        for w in all_warnings:
            print(f"    - {w}")

    # Dump scene file contents for analysis
    print("\n" + "-" * 70)
    print("GENERATED CODE DUMP (for manual inspection)")
    print("-" * 70)

    if constants_path.exists():
        print(f"\n--- {constants_path.name} ---")
        print(constants_path.read_text(encoding="utf-8")[:2000])

    for f in scene_files[:3]:  # First 3 scenes
        print(f"\n--- {f.name} (first 3000 chars) ---")
        print(f.read_text(encoding="utf-8")[:3000])

    overall = len(all_errors) == 0
    print(f"\n{'=' * 70}")
    print(f"OVERALL: {'ALL PASSED' if overall else 'SOME FAILED'}")
    print(f"{'=' * 70}")

    return 0 if overall else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
