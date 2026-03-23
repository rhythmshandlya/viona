"""Director mixin — Phase 1: scene planning from transcript."""

import json
import shutil
from typing import Any

from sdk_config import (
    CLAUDE_CLI_PATH,
    ClaudeSDKClient,
    ClaudeAgentOptions,
)

class DirectorMixin:
    """Mixin providing _run_director for ClaudeVisualGenerator."""

    async def _run_director(
        self,
        formatted_transcript: str,
        width: int,
        height: int,
        duration_frames: int,
        fps: int,
        style_preset: str = "studio-dark",
        layout_mode: str = "pip",
        style_guide: str | None = None,
        source_width: int | None = None,
        source_height: int | None = None,
        pip_width: int | None = None,
        pip_height: int | None = None,
        safe_placement: list[str] | None = None,
    ) -> dict[str, Any]:
        """Phase 1: Run the Director agent to create the scene plan.

        The Director analyzes the transcript and creates:
        - SCENE_PLAN.md: Human-readable plan with visual story
        - scenes.json: Machine-readable scene data for Animator

        Returns:
            dict with success status and plan file paths
        """
        from prompts.director import get_director_prompt, build_director_user_message

        print(f"[ClaudeGenerator] Phase 1: Director analyzing transcript...")

        self.src_dir.mkdir(parents=True, exist_ok=True)

        director_message = build_director_user_message(
            project_id=self.project_id,
            formatted_transcript=formatted_transcript,
            width=width,
            height=height,
            duration_frames=duration_frames,
            fps=fps,
            style_preset=style_preset,
            layout_mode=layout_mode,
            style_guide=style_guide,
            output_dir=str(self.src_dir),
            source_width=source_width,
            source_height=source_height,
            pip_width=pip_width,
            pip_height=pip_height,
            safe_placement=safe_placement,
        )

        # Write restricted security settings for the Director
        director_settings_dir = self.src_dir / ".claude"
        director_settings_dir.mkdir(parents=True, exist_ok=True)
        src_dir_posix = str(self.src_dir).replace(chr(92), '/')
        workspace_posix = str(self.workspace).replace(chr(92), '/')
        director_settings = {
            "permissions": {
                "defaultMode": "acceptEdits",
                "allow": [
                    "Read(./**)",
                    "Write(./**)",
                    "Edit(./**)",
                    "Glob(./**)",
                    "Grep(./**)",
                    f"Read({src_dir_posix}/**)",
                    f"Write({src_dir_posix}/**)",
                    f"Edit({src_dir_posix}/**)",
                    f"Glob({src_dir_posix}/**)",
                    f"Grep({src_dir_posix}/**)",
                    f"Read({workspace_posix}/**)",
                    f"Glob({workspace_posix}/**)",
                    f"Grep({workspace_posix}/**)",
                    "Bash(*)",
                ],
            },
        }
        with open(director_settings_dir / "settings.local.json", "w", encoding="utf-8") as f:
            json.dump(director_settings, f, indent=2)

        client = ClaudeSDKClient(
            options=ClaudeAgentOptions(
                model=self.model,
                system_prompt={
                    "type": "preset",
                    "preset": "claude_code",
                    "append": get_director_prompt(self.genre)
                },
                cwd=str(self.src_dir),
                max_turns=50,
                max_thinking_tokens=self.max_thinking_tokens,
                allowed_tools=["Read", "Write", "Grep", "Glob", "WebSearch", "TodoWrite"],
                permission_mode="bypassPermissions",
                cli_path=CLAUDE_CLI_PATH,
            )
        )

        response_text = ""
        tool_calls_made = []
        async with client:
            await client.query(director_message)
            print(f"[Director] Query sent, waiting for response...", flush=True)

            async for msg in client.receive_response():
                msg_type = type(msg).__name__
                print(f"[Director] Received message type: {msg_type}", flush=True)

                if msg_type == "AssistantMessage" and hasattr(msg, "content"):
                    for block in msg.content:
                        block_type = type(block).__name__
                        if block_type == "TextBlock" and hasattr(block, "text"):
                            response_text += block.text
                            try:
                                print(block.text, end="", flush=True)
                            except UnicodeEncodeError:
                                safe_text = block.text.encode("ascii", errors="replace").decode("ascii")
                                print(safe_text, end="", flush=True)
                        elif block_type == "ToolUseBlock" and hasattr(block, "name"):
                            tool_calls_made.append(block.name)
                            print(f"\n[Director Tool: {block.name}]", flush=True)
                        elif block_type == "ToolResultBlock":
                            print(f"\n[Director Tool Result received]", flush=True)
                        elif block_type == "ThinkingBlock":
                            pass
                        else:
                            print(f"\n[Director] Unknown block type: {block_type}", flush=True)
                elif msg_type == "ErrorMessage":
                    print(f"[Director] ERROR: {msg}", flush=True)
                elif msg_type == "StopMessage":
                    print(f"[Director] Stop reason received", flush=True)

        print(f"\n[ClaudeGenerator] Director made {len(tool_calls_made)} tool calls: {tool_calls_made}", flush=True)
        print(f"\n[ClaudeGenerator] Director completed")

        # Verify plan files were created
        scene_plan = self.src_dir / "SCENE_PLAN.md"
        scenes_json = self.src_dir / "scenes.json"

        print(f"[ClaudeGenerator] Checking for plan files in: {self.src_dir}")
        if self.src_dir.exists():
            existing_files = list(self.src_dir.iterdir())
            print(f"[ClaudeGenerator] Files in src_dir: {[f.name for f in existing_files]}")
        else:
            print(f"[ClaudeGenerator] WARNING: src_dir does not exist!")
            self.src_dir.mkdir(parents=True, exist_ok=True)

        # ── Fallback file recovery ──
        if not scene_plan.exists() or not scenes_json.exists():
            print(f"[ClaudeGenerator] Plan files not in expected location, searching for misplaced files...")

            search_locations = [
                (self.workspace / "SCENE_PLAN.md", self.workspace / "scenes.json"),
                (self.workspace / f"{self.project_id}_SCENE_PLAN.md", self.workspace / f"{self.project_id}_scenes.json"),
                (self.workspace / "src" / "SCENE_PLAN.md", self.workspace / "src" / "scenes.json"),
            ]

            for alt_plan, alt_scenes in search_locations:
                if alt_plan.exists() and not scene_plan.exists():
                    print(f"[ClaudeGenerator] Found misplaced SCENE_PLAN.md at {alt_plan}, moving to {scene_plan}")
                    shutil.move(str(alt_plan), str(scene_plan))
                if alt_scenes.exists() and not scenes_json.exists():
                    print(f"[ClaudeGenerator] Found misplaced scenes.json at {alt_scenes}, moving to {scenes_json}")
                    shutil.move(str(alt_scenes), str(scenes_json))

            if not scene_plan.exists():
                for f in self.workspace.glob("*SCENE_PLAN.md"):
                    print(f"[ClaudeGenerator] Found misplaced plan file: {f}, moving to {scene_plan}")
                    shutil.move(str(f), str(scene_plan))
                    break
            if not scenes_json.exists():
                for f in self.workspace.glob("*scenes.json"):
                    print(f"[ClaudeGenerator] Found misplaced scenes file: {f}, moving to {scenes_json}")
                    shutil.move(str(f), str(scenes_json))
                    break

        if not scene_plan.exists():
            return {
                "success": False,
                "error": f"Director did not create SCENE_PLAN.md (expected at {scene_plan})",
            }

        if not scenes_json.exists():
            return {
                "success": False,
                "error": f"Director did not create scenes.json (expected at {scenes_json})",
            }

        # Validate scenes.json structure
        try:
            with open(scenes_json, encoding="utf-8") as f:
                plan_data = json.load(f)

            has_scenes = "scenes" in plan_data and len(plan_data.get("scenes", [])) > 0
            has_segments = "segments" in plan_data and len(plan_data.get("segments", [])) > 0

            if not has_scenes and not has_segments:
                return {
                    "success": False,
                    "error": "scenes.json has no scenes or segments defined",
                }

            scene_count = len(plan_data.get("scenes", plan_data.get("segments", [])))
            print(f"[ClaudeGenerator] Director created plan with {scene_count} {'segments' if has_segments else 'scenes'}")

        except json.JSONDecodeError as e:
            return {
                "success": False,
                "error": f"scenes.json is invalid JSON: {e}",
            }

        # ── Programmatic scene constraint validation ──
        validation = self._validate_scene_plan(
            plan_data, fps, duration_frames,
            canvas_width=width, canvas_height=height,
            layout_mode=layout_mode,
            pip_width=pip_width, pip_height=pip_height,
        )

        if validation["warnings"]:
            print(f"[ClaudeGenerator] Scene plan warnings ({len(validation['warnings'])}):")
            for w in validation["warnings"]:
                print(f"  ⚠ {w}")

        if validation["errors"]:
            print(f"[ClaudeGenerator] Scene plan ERRORS ({len(validation['errors'])}):")
            for e in validation["errors"]:
                print(f"  ✗ {e}")
            return {
                "success": False,
                "error": f"Scene plan validation failed: {'; '.join(validation['errors'])}",
            }

        if validation["repaired"]:
            print(f"[ClaudeGenerator] Auto-repaired scene plan, writing updated scenes.json")
            with open(scenes_json, "w", encoding="utf-8") as f:
                json.dump(plan_data, f, indent=2, ensure_ascii=False)
            scene_count = len(plan_data["scenes"])
            print(f"[ClaudeGenerator] Updated scene count after repairs: {scene_count}")

        return {
            "success": True,
            "scenePlanPath": str(scene_plan),
            "scenesJsonPath": str(scenes_json),
            "sceneCount": scene_count,
        }
