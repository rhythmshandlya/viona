"""Visual verification mixin — screenshot rendering, visual review, fix loops."""

import asyncio
import json
import shutil
from pathlib import Path

from sdk_config import (
    IS_WINDOWS,
    CLAUDE_CLI_PATH,
    ClaudeSDKClient,
    ClaudeAgentOptions,
    build_mcp_servers,
    get_skills_directive,
)


class VisualVerificationMixin:
    """Mixin providing visual verification methods for ClaudeVisualGenerator."""

    async def _render_scene_still(
        self,
        composition_id: str,
        frame: int,
        output_path: Path,
    ) -> tuple[bool, str]:
        """Render a single still frame using remotion still (async subprocess).

        Args:
            composition_id: Remotion composition ID (with dashes)
            frame: Frame number to render
            output_path: Where to save the PNG

        Returns:
            (success, error_message)
        """
        output_path.parent.mkdir(parents=True, exist_ok=True)

        cmd_parts = [
            "npx", "remotion", "still",
            composition_id,
            str(output_path),
            f"--frame={frame}",
        ]

        try:
            if IS_WINDOWS:
                cmd_str = " ".join(cmd_parts)
                proc = await asyncio.create_subprocess_shell(
                    cmd_str,
                    cwd=str(self.workspace),
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
            else:
                proc = await asyncio.create_subprocess_exec(
                    *cmd_parts,
                    cwd=str(self.workspace),
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )

            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=120)

            if proc.returncode != 0:
                err = stderr.decode("utf-8", errors="replace") if stderr else "Unknown error"
                print(f"[ClaudeGenerator] remotion still failed (frame {frame}): {err[:500]}")
                return False, err

            print(f"[ClaudeGenerator] Rendered still at frame {frame}: {output_path}")
            return True, ""

        except asyncio.TimeoutError:
            print(f"[ClaudeGenerator] remotion still timed out (frame {frame})")
            return False, "Render timed out after 120s"
        except Exception as e:
            print(f"[ClaudeGenerator] remotion still error (frame {frame}): {e}")
            return False, str(e)

    async def _run_visual_verify(
        self,
        scene_num: int,
        screenshot_paths: list[Path],
        scene_data: dict,
        plan_content: str,
    ) -> tuple[bool, list[str]]:
        """Spawn a Sonnet subagent to review screenshots against the plan.

        Returns:
            (passed, issues_list)
        """
        from prompts.animator import VISUAL_VERIFY_PROMPT

        scene_json_str = json.dumps(scene_data, indent=2)
        display_mode = scene_data.get("displayMode", "default")
        description = scene_data.get("visual", scene_data.get("description", "No description"))

        screenshot_lines = []
        labels = ["Early (entrance check)", "Key sync (main content)", "Late (exit/outro check)"]
        for i, path in enumerate(screenshot_paths):
            path_str = str(path).replace("\\", "/")
            label = labels[i] if i < len(labels) else f"Frame {i+1}"
            screenshot_lines.append(f"- **{label}**: `{path_str}`")
        screenshots_str = "\n".join(screenshot_lines)

        user_msg = f"""## Visual Review: Scene {scene_num}

### Screenshots
Read each screenshot file to see the rendered frames:
{screenshots_str}

### Scene Data:
```json
{scene_json_str}
```

### Display Mode: `{display_mode}`
### Scene Description: {description}

### Director's Plan:
{plan_content}

Review ALL screenshots against the plan and scene data:
- **Early frame**: Check entrance animations are visible (elements should be appearing)
- **Key sync frame**: Check main content is present and correctly laid out
- **Late frame**: Check exit/outro phase (elements may be fading, content still visible)

After reviewing all screenshots, call the `mcp__viewport__submit_verdict` tool with your verdict.
"""

        try:
            mcp_servers_config = build_mcp_servers(str(self.workspace))
            client = ClaudeSDKClient(
                options=ClaudeAgentOptions(
                    model=self.model,
                    max_thinking_tokens=self.max_thinking_tokens,
                    system_prompt={
                        "type": "preset",
                        "preset": "claude_code",
                        "append": VISUAL_VERIFY_PROMPT,
                    },
                    cwd=str(self.workspace),
                    max_turns=5,
                    allowed_tools=["Read", "mcp__viewport__submit_verdict"],
                    mcp_servers={"viewport": mcp_servers_config["viewport"]},
                    permission_mode="bypassPermissions",
                    cli_path=CLAUDE_CLI_PATH,
                )
            )

            messages = []
            async with client:
                await client.query(user_msg)

                async for msg in client.receive_response():
                    messages.append(msg)
                    msg_type = type(msg).__name__
                    if msg_type == "AssistantMessage" and hasattr(msg, "content"):
                        for block in msg.content:
                            block_type = type(block).__name__
                            if block_type == "ToolUseBlock" and hasattr(block, "name"):
                                print(f"\n[VisualVerify{scene_num} Tool: {block.name}]", flush=True)

            return self._parse_verdict_from_response(messages, f"VisualVerify{scene_num}")

        except Exception as e:
            print(f"[ClaudeGenerator] Scene {scene_num} visual verify error: {e}")
            return True, []  # Non-blocking

    async def _verify_and_fix_scene(
        self,
        scene_num: int,
        scene_data: dict,
        plan_content: str,
        composition_id: str,
        style_preset: str = "studio-dark",
    ) -> None:
        """Per-scene verify → fix → re-verify loop."""
        from prompts.animator import VISUAL_FIX_PROMPT_TEMPLATE, get_animator_prompt, get_studio_section

        studio_section = get_studio_section(style_preset)
        display_mode = scene_data.get("displayMode", "default")
        description = scene_data.get("visual", scene_data.get("description", "No description"))
        verify_dir = self.workspace / "visual-verify"

        # Determine verification frames
        frames_range = scene_data.get("frames", [0, 60])
        start = frames_range[0] if len(frames_range) > 0 else 0
        end = frames_range[1] if len(frames_range) > 1 else start + 60
        scene_duration = end - start

        key_sync = scene_data.get("keySync", {})
        mid_frame = key_sync.get("frame") if key_sync.get("frame") is not None else (start + end) // 2

        if scene_duration < 45:
            verify_frames = [mid_frame]
        elif scene_duration < 90:
            verify_frames = [start + 10, mid_frame]
        else:
            early = min(start + 15, mid_frame - 1)
            late = max(end - 15, mid_frame + 1)
            verify_frames = [early, mid_frame, late]

        max_retries = 2
        for attempt in range(max_retries + 1):
            # Step 1: Render stills
            screenshot_paths: list[Path] = []
            render_failed = False
            for i, vf in enumerate(verify_frames):
                screenshot_path = verify_dir / f"scene{scene_num}_f{i}_attempt{attempt}.png"
                success, err = await self._render_scene_still(
                    composition_id, vf, screenshot_path
                )
                if not success:
                    print(f"[ClaudeGenerator] Scene {scene_num} still render failed (frame {vf}): {err[:200]}")
                    render_failed = True
                    break
                screenshot_paths.append(screenshot_path)

            if render_failed:
                return

            # Step 2: Visual verify
            passed, issues = await self._run_visual_verify(
                scene_num, screenshot_paths, scene_data, plan_content
            )

            if passed:
                print(f"[ClaudeGenerator] Scene {scene_num} passed visual verification")
                return

            print(f"[ClaudeGenerator] Scene {scene_num} failed visual verify: {issues}")

            if attempt >= max_retries:
                print(f"[ClaudeGenerator] Scene {scene_num} accepting as-is after {max_retries} fix attempts")
                return

            # Step 3: Fix
            issues_str = "\n".join(f"{i+1}. {issue}" for i, issue in enumerate(issues))
            fix_screenshot = screenshot_paths[1] if len(screenshot_paths) > 1 else screenshot_paths[0]
            fix_msg = VISUAL_FIX_PROMPT_TEMPLATE.format(
                scene_num=scene_num,
                project_id=self.project_id,
                display_mode=display_mode,
                scene_description=description,
                screenshot_path=str(fix_screenshot).replace("\\", "/"),
                issues=issues_str,
            )

            skills_directive = get_skills_directive()

            try:
                fix_client = ClaudeSDKClient(
                    options=ClaudeAgentOptions(
                        model=self.model,
                        max_thinking_tokens=self.max_thinking_tokens,
                        system_prompt={
                            "type": "preset",
                            "preset": "claude_code",
                            "append": f"{get_animator_prompt(self.genre)}{studio_section}\n\n{skills_directive}",
                        },
                        cwd=str(self.workspace),
                        max_turns=15,
                        allowed_tools=["Read", "Edit", "Bash", "Glob", "Skill"],
                        permission_mode="bypassPermissions",
                        cli_path=CLAUDE_CLI_PATH,
                    )
                )

                async with fix_client:
                    await fix_client.query(fix_msg)
                    async for msg in fix_client.receive_response():
                        msg_type = type(msg).__name__
                        if msg_type == "AssistantMessage" and hasattr(msg, "content"):
                            for block in msg.content:
                                block_type = type(block).__name__
                                if block_type == "ToolUseBlock" and hasattr(block, "name"):
                                    print(f"\n[VisualFix{scene_num} Tool: {block.name}]", flush=True)

                print(f"[ClaudeGenerator] Scene {scene_num} visual fix attempt {attempt + 1} complete")

            except Exception as e:
                print(f"[ClaudeGenerator] Scene {scene_num} visual fix error: {e}")
                return

    async def _run_visual_verification_phase(
        self,
        composition_id: str,
        scenes_data: dict,
        plan_content: str,
        style_preset: str = "studio-dark",
        width: int = 1080,
        height: int = 1920,
        fps: int = 60,
        duration_frames: int = 1800,
    ) -> None:
        """Top-level orchestrator for Phase 2e visual verification."""
        scenes = scenes_data.get("scenes", [])
        if not scenes:
            print("[ClaudeGenerator] No scenes to verify")
            return

        original_index_ts = self._setup_entry_point(
            width=width, height=height, fps=fps, duration_frames=duration_frames,
        )
        verify_dir = self.workspace / "visual-verify"

        try:
            tasks = []
            for i, scene in enumerate(scenes):
                scene_num = i + 1
                scene_file = self.src_dir / "scenes" / f"Scene{scene_num}.tsx"
                if not scene_file.exists():
                    print(f"[ClaudeGenerator] Skipping visual verify for Scene{scene_num} (no .tsx file)")
                    continue

                tasks.append(
                    self._verify_and_fix_scene(
                        scene_num=scene_num,
                        scene_data=scene,
                        plan_content=plan_content,
                        composition_id=composition_id,
                        style_preset=style_preset,
                    )
                )

            if tasks:
                results = await asyncio.gather(*tasks, return_exceptions=True)
                for i, result in enumerate(results):
                    if isinstance(result, Exception):
                        print(f"[ClaudeGenerator] Visual verify task {i+1} exception: {result}")

        finally:
            self._restore_entry_point(original_index_ts)
            if verify_dir.exists():
                try:
                    shutil.rmtree(verify_dir)
                except Exception as e:
                    print(f"[ClaudeGenerator] Failed to clean up visual-verify dir: {e}")
