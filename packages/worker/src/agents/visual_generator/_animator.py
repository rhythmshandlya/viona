"""Animator mixin — Phase 2: parallel scene generation via coordinator + subagents."""

import asyncio
import json
import math
import os
from pathlib import Path
from typing import Any

from sdk_config import (
    CLAUDE_CLI_PATH,
    safe_print,
    emit_progress,
    build_mcp_servers,
    bash_security_hook,
    get_skills_directive,
    ClaudeSDKClient,
    ClaudeAgentOptions,
    HookMatcher,
)
from prompts.theme_loader import get_theme


class AnimatorMixin:
    """Mixin providing animator methods for ClaudeVisualGenerator."""

    async def _run_scene_agent(
        self,
        scene_num: int,
        scene_system: str,
        scene_user_msg: str,
        mcp_servers: dict,
        bash_security_hook_fn,
        label: str = "",
    ) -> None:
        """Spawn a scene agent (Opus) to implement a single scene file."""
        tag = f"Scene{scene_num}{' ' + label if label else ''}"
        client = ClaudeSDKClient(
            options=ClaudeAgentOptions(
                model=self.model,
                system_prompt={
                    "type": "preset",
                    "preset": "claude_code",
                    "append": scene_system,
                },
                cwd=str(self.workspace),
                max_turns=40,
                max_thinking_tokens=self.max_thinking_tokens,
                max_buffer_size=10 * 1024 * 1024,
                allowed_tools=[
                    "Read", "Write", "Edit", "Glob", "Grep", "Bash", "Skill",
                    "mcp__freepik__search_icons",
                    "mcp__freepik__get_icon_detail_by_id",
                    "mcp__freepik__download_icon_by_id",
                    "mcp__freepik__search_resources",
                    "mcp__freepik__get_resource_detail_by_id",
                    "mcp__freepik__download_resource_by_id",
                    "mcp__better-icons__search_icons",
                    "mcp__better-icons__get_icon",
                    "mcp__better-icons__recommend_icons",
                    "mcp__better-icons__find_similar_icons",
                    "mcp__assets__download_file",
                    "mcp__assets__screenshot",
                    "mcp__assets__search_unsplash",
                    "mcp__assets__search_pexels",
                    "mcp__assets__download_stock_photo",
                    "mcp__assets__get_speaker_grid",
                    "mcp__viewport__get_scene_dimensions",
                    "mcp__viewport__validate_scene_code",
                ],
                mcp_servers=mcp_servers,
                permission_mode="bypassPermissions",
                setting_sources=["project"],
                hooks={
                    "PreToolUse": [
                        HookMatcher(matcher="Bash", hooks=[bash_security_hook_fn]),
                    ],
                },
                cli_path=CLAUDE_CLI_PATH,
            )
        )

        async with client:
            await client.query(scene_user_msg)

            async for msg in client.receive_response():
                msg_type = type(msg).__name__
                if msg_type == "AssistantMessage" and hasattr(msg, "content"):
                    for block in msg.content:
                        block_type = type(block).__name__
                        if block_type == "TextBlock" and hasattr(block, "text"):
                            try:
                                print(block.text[:200], end="", flush=True)
                            except UnicodeEncodeError:
                                pass
                        elif block_type == "ToolUseBlock" and hasattr(block, "name"):
                            print(f"\n[{tag} Tool: {block.name}]", flush=True)

    async def _run_animator_sequential(
        self,
        width: int,
        height: int,
        duration_frames: int,
        fps: int,
        style_preset: str = "blackboard",
        skip_scenes: set[int] | None = None,
    ) -> dict[str, Any]:
        """Phase 2 (Parallel): Implement scenes via SDK subagents.

        Returns:
            dict with success status
        """
        from prompts.animator import (
            ANIMATOR_SETUP_PROMPT,
            ANIMATOR_SCENE_PROMPT_TEMPLATE,
            get_animator_prompt,
            get_display_mode_rules,
            build_setup_user_message,
            build_scene_user_message,
            build_scene_task_prompt,
            get_theme_section,
        )
        from claude_agent_sdk import AgentDefinition

        print("[ClaudeGenerator] Phase 2 (Parallel): Implementing scenes via subagents...")

        theme_section = get_theme_section(style_preset)

        # Read scenes.json and SCENE_PLAN.md
        scenes_json_path = self.src_dir / "scenes.json"
        scene_plan_path = self.src_dir / "SCENE_PLAN.md"

        with open(scenes_json_path, "r", encoding="utf-8") as f:
            scenes_data = json.load(f)
        with open(scene_plan_path, "r", encoding="utf-8") as f:
            scene_plan_content = f.read()

        scenes = scenes_data.get("scenes", [])
        total_scenes = len(scenes)

        # ── CHECKPOINT DETECTION ──
        constants_path = self.src_dir / "constants.ts"
        scenes_dir = self.src_dir / "scenes"
        existing_scenes: set[int] = set()
        if scenes_dir.exists():
            for f in scenes_dir.iterdir():
                if f.suffix == ".tsx" and f.stem.startswith("Scene"):
                    try:
                        scene_num = int(f.stem[5:])
                        if f.stat().st_size > 100:
                            existing_scenes.add(scene_num)
                    except (ValueError, OSError):
                        pass

        if skip_scenes:
            print(f"[ClaudeGenerator] CLI --skip-scenes: treating scenes {sorted(skip_scenes)} as already done")
            existing_scenes |= skip_scenes

        setup_exists = constants_path.exists() and constants_path.stat().st_size > 50
        all_scene_nums = set(range(1, total_scenes + 1))
        missing_scenes_set = all_scene_nums - existing_scenes

        if setup_exists and existing_scenes:
            print(f"[ClaudeGenerator] CHECKPOINT RESUME: Setup done, {len(existing_scenes)}/{total_scenes} scenes exist. Missing: {sorted(missing_scenes_set) or 'none'}")
        elif setup_exists:
            print(f"[ClaudeGenerator] CHECKPOINT RESUME: Setup done, no scenes yet")

        skills_directive = get_skills_directive()
        mcp_servers = build_mcp_servers(str(self.workspace))

        # Inject user-provided assets summary
        user_assets_section = ""
        user_assets_path = self.src_dir / "user_assets.json"
        if user_assets_path.exists():
            try:
                user_assets_data = json.loads(user_assets_path.read_text(encoding="utf-8"))
                if user_assets_data.get("assets"):
                    asset_lines = []
                    for a in user_assets_data["assets"]:
                        asset_lines.append(f"- **{a['label']}**: `staticFile('{a['remotionPath']}')` ({a['contentType']})")
                    user_assets_section = f"\n\n## USER-PROVIDED ASSETS\n\nThe user uploaded these custom assets. ALWAYS prefer them over Freepik/Iconify when they match.\n\n" + "\n".join(asset_lines)
                    print(f"[ClaudeGenerator] Injected {len(asset_lines)} user asset(s) into sequential pipeline prompts")
            except Exception as e:
                print(f"[ClaudeGenerator] Warning: Failed to read user_assets.json: {e}")

        # ── Phase 2a: SETUP ──
        if setup_exists:
            print(f"[ClaudeGenerator] Skipping Setup phase — constants.ts already exists")
            emit_progress(40, "Resuming — setup already done", {"phase": "workspace", "phaseName": "Setting up workspace"})
            constants_content = constants_path.read_text(encoding="utf-8")
            components_dir = self.src_dir / "components"
            components_list = (
                [f.name for f in components_dir.iterdir() if f.suffix == ".tsx"]
                if components_dir.exists()
                else []
            )
        else:
            emit_progress(38, "Setting up project foundation...", {"phase": "workspace", "phaseName": "Setting up workspace"})
            setup_system = f"{get_animator_prompt(self.genre)}{theme_section}\n\n{skills_directive}\n\n{ANIMATOR_SETUP_PROMPT}{user_assets_section}"
            setup_message = build_setup_user_message(self.project_id)

            setup_client = ClaudeSDKClient(
                options=ClaudeAgentOptions(
                    model=self.model,
                    max_thinking_tokens=self.max_thinking_tokens,
                    system_prompt={
                        "type": "preset",
                        "preset": "claude_code",
                        "append": setup_system,
                    },
                    cwd=str(self.workspace),
                    max_turns=30,
                    max_buffer_size=10 * 1024 * 1024,
                    allowed_tools=[
                        "Read", "Write", "Edit", "Glob", "Bash", "Skill",
                        "mcp__viewport__get_scene_dimensions",
                    ],
                    mcp_servers={"viewport": mcp_servers["viewport"]},
                    permission_mode="bypassPermissions",
                    setting_sources=["project"],
                    hooks={
                        "PreToolUse": [
                            HookMatcher(matcher="Bash", hooks=[bash_security_hook]),
                        ],
                    },
                    cli_path=CLAUDE_CLI_PATH,
                )
            )

            async with setup_client:
                await setup_client.query(setup_message)

                async for msg in setup_client.receive_response():
                    msg_type = type(msg).__name__
                    if msg_type == "AssistantMessage" and hasattr(msg, "content"):
                        for block in msg.content:
                            block_type = type(block).__name__
                            if block_type == "TextBlock" and hasattr(block, "text"):
                                try:
                                    print(block.text[:200], end="", flush=True)
                                except UnicodeEncodeError:
                                    safe_text = block.text.encode("ascii", errors="replace").decode("ascii")
                                    print(safe_text[:200], end="", flush=True)
                            elif block_type == "ToolUseBlock" and hasattr(block, "name"):
                                print(f"\n[Setup Tool: {block.name}]", flush=True)

            if not constants_path.exists():
                raise RuntimeError("Setup failed: constants.ts not created")

            constants_content = constants_path.read_text(encoding="utf-8")

            components_dir = self.src_dir / "components"
            components_list = (
                [f.name for f in components_dir.iterdir() if f.suffix == ".tsx"]
                if components_dir.exists()
                else []
            )

            emit_progress(40, "Project foundation ready", {"phase": "workspace", "phaseName": "Setting up workspace"})

        # ── Phase 2b: PARALLEL SCENE GENERATION ──
        scenes_dir = self.src_dir / "scenes"
        scenes_dir.mkdir(exist_ok=True)

        scenes_to_generate = []
        for i, scene in enumerate(scenes):
            scene_num = i + 1
            if scene_num in existing_scenes:
                print(f"[ClaudeGenerator] Skipping Scene {scene_num} — already exists from checkpoint")
                continue
            scenes_to_generate.append((i, scene_num, scene))

        if not scenes_to_generate:
            print(f"[ClaudeGenerator] All {total_scenes} scenes already exist — skipping to validation")
            emit_progress(50, f"All {total_scenes} scenes restored from checkpoint", {"phase": "animate", "phaseName": "Animating scenes", "scene": total_scenes, "totalScenes": total_scenes})
        else:
            scenes_to_dispatch = len(scenes_to_generate)
            emit_progress(40, f"Animating {scenes_to_dispatch} of {total_scenes} scenes...", {"phase": "animate", "phaseName": "Animating scenes", "totalScenes": total_scenes})
            print(f"\n[ClaudeGenerator] Phase 2b: Dispatching {scenes_to_dispatch} scene-generator subagents ({total_scenes - scenes_to_dispatch} from checkpoint)...")

            scene_gen_system = (
                f"{get_animator_prompt(self.genre)}{theme_section}\n\n{skills_directive}"
            )

            scene_gen_tools = [
                "Read", "Write", "Edit", "Glob", "Grep", "Bash",
                "mcp__freepik__search_icons",
                "mcp__freepik__get_icon_detail_by_id",
                "mcp__freepik__download_icon_by_id",
                "mcp__freepik__search_resources",
                "mcp__freepik__get_resource_detail_by_id",
                "mcp__freepik__download_resource_by_id",
                "mcp__better-icons__search_icons",
                "mcp__better-icons__get_icon",
                "mcp__better-icons__recommend_icons",
                "mcp__better-icons__find_similar_icons",
                "mcp__assets__download_file",
                "mcp__assets__screenshot",
                "mcp__assets__search_unsplash",
                "mcp__assets__search_pexels",
                "mcp__assets__download_stock_photo",
                "mcp__assets__get_speaker_grid",
                "mcp__viewport__get_scene_dimensions",
                "mcp__viewport__validate_scene_code",
            ]

            agents = {
                "scene-generator": AgentDefinition(
                    description=(
                        "Generates a single Remotion scene file (scenes/SceneN.tsx). "
                        "Receives scene data in the task prompt, reads constants.ts "
                        "and SCENE_PLAN.md from disk, writes the .tsx file, validates "
                        "TypeScript, and self-heals any compilation errors."
                    ),
                    prompt=scene_gen_system,
                    tools=scene_gen_tools,
                ),
            }

            scene_task_entries = ""
            scene_nums_to_dispatch = []
            for i, scene_num, scene in scenes_to_generate:
                task_prompt = build_scene_task_prompt(
                    self.project_id, scene_num, scene.get("displayMode", "default"),
                    scene_data=scene,
                    style_preset=style_preset,
                )
                scene_task_entries += f"### Scene {scene_num}\n<scene_{scene_num}_task>\n{task_prompt}\n</scene_{scene_num}_task>\n\n"
                scene_nums_to_dispatch.append(scene_num)

            MAX_PARALLEL = 6
            num_batches = math.ceil(scenes_to_dispatch / MAX_PARALLEL)
            batch_instructions = ""
            for batch_idx in range(num_batches):
                start = batch_idx * MAX_PARALLEL
                end = min((batch_idx + 1) * MAX_PARALLEL, scenes_to_dispatch)
                batch_scene_nums = scene_nums_to_dispatch[start:end]
                batch_instructions += f"**Batch {batch_idx + 1}:** Dispatch scenes {', '.join(str(s) for s in batch_scene_nums)} — make {len(batch_scene_nums)} Task tool calls in ONE response. Wait for ALL to complete before starting the next batch.\n"

            coordinator_user_msg = f"""You are the Animation Coordinator. Dispatch {scenes_to_dispatch} scene-generator subagents in batches of {MAX_PARALLEL}.

IMPORTANT: Do NOT dispatch all {scenes_to_dispatch} scenes at once. Follow this batching plan:
{batch_instructions}
{scene_task_entries}

After ALL batches complete, run: ls src/{self.project_id}/scenes/
Report which scenes were created.
"""

            prev_timeout = os.environ.get("CLAUDE_CODE_STREAM_CLOSE_TIMEOUT")
            os.environ["CLAUDE_CODE_STREAM_CLOSE_TIMEOUT"] = "120000"

            coordinator_client = ClaudeSDKClient(
                options=ClaudeAgentOptions(
                    model=self.model,
                    max_thinking_tokens=2000,
                    system_prompt={
                        "type": "preset",
                        "preset": "claude_code",
                        "append": f"You are an animation coordinator. Your ONLY job is to dispatch scene-generator subagents via the Task tool in batches. You must NOT implement scenes yourself. Do NOT use Write or Edit. After each batch completes, use Glob to verify the expected scene files were created (e.g., `src/{self.project_id}/scenes/Scene*.tsx`). If any are missing, report which ones failed. Dispatch each batch in a single response, then wait for all tasks in that batch to complete before starting the next batch.",
                    },
                    cwd=str(self.workspace),
                    max_turns=scenes_to_dispatch + num_batches * 2 + 4,
                    max_buffer_size=10 * 1024 * 1024,
                    permission_mode="bypassPermissions",
                    allowed_tools=["Bash", "Task", "Read", "Glob"],
                    agents=agents,
                    mcp_servers=mcp_servers,
                    hooks={
                        "PreToolUse": [
                            HookMatcher(matcher="Bash", hooks=[bash_security_hook]),
                        ],
                    },
                    cli_path=CLAUDE_CLI_PATH,
                )
            )

            try:
                async with coordinator_client:
                    await coordinator_client.query(coordinator_user_msg)

                    async for msg in coordinator_client.receive_response():
                        msg_type = type(msg).__name__
                        if msg_type == "AssistantMessage" and hasattr(msg, "content"):
                            for block in msg.content:
                                block_type = type(block).__name__
                                if block_type == "TextBlock" and hasattr(block, "text"):
                                    try:
                                        print(block.text[:200], end="", flush=True)
                                    except UnicodeEncodeError:
                                        safe_text = block.text.encode("ascii", errors="replace").decode("ascii")
                                        print(safe_text[:200], end="", flush=True)
                                elif block_type == "ToolUseBlock" and hasattr(block, "name"):
                                    print(f"\n[Coordinator Tool: {block.name}]", flush=True)
            finally:
                if prev_timeout is not None:
                    os.environ["CLAUDE_CODE_STREAM_CLOSE_TIMEOUT"] = prev_timeout
                else:
                    os.environ.pop("CLAUDE_CODE_STREAM_CLOSE_TIMEOUT", None)

        # Post-dispatch: verify all scene files exist, retry missing ones
        missing_scenes = []
        for i in range(total_scenes):
            scene_file = self.src_dir / "scenes" / f"Scene{i + 1}.tsx"
            if not scene_file.exists():
                missing_scenes.append(i + 1)

        if missing_scenes:
            print(f"[ClaudeGenerator] WARNING: Missing scene files after dispatch (including checkpoint): {missing_scenes}")
            for scene_num in missing_scenes:
                i = scene_num - 1
                scene = scenes[i]
                display_mode = scene.get("displayMode", "default")
                eff = scene.get("effectiveDimensions", {})
                ew = eff.get("width", 1080)
                eh = eff.get("height", 960)
                mode_rules = get_display_mode_rules(display_mode, ew, eh)
                scene_prompt_filled = ANIMATOR_SCENE_PROMPT_TEMPLATE.format(
                    scene_number=scene_num,
                    display_mode_rules=mode_rules,
                    project_id=self.project_id,
                )
                scene_system = f"{get_animator_prompt(self.genre)}{theme_section}\n\n{skills_directive}\n\n{scene_prompt_filled}{user_assets_section}"
                scene_user_msg = build_scene_user_message(
                    project_id=self.project_id,
                    scene_index=i,
                    scene_data=scene,
                    total_scenes=total_scenes,
                    constants_content=constants_content,
                    components_list=components_list,
                    scene_plan_content=scene_plan_content,
                    display_mode=display_mode,
                )
                print(f"[ClaudeGenerator] Retrying Scene {scene_num} individually...")
                await self._run_scene_agent(
                    scene_num=scene_num,
                    scene_system=scene_system,
                    scene_user_msg=scene_user_msg,
                    mcp_servers=mcp_servers,
                    bash_security_hook_fn=bash_security_hook,
                    label="Retry",
                )

        # TypeScript validation
        emit_progress(50, "Validating TypeScript...", {"phase": "animate", "phaseName": "Animating scenes", "totalScenes": total_scenes})
        ts_success, ts_errors = await self._verify_typescript()
        if not ts_success:
            print("[ClaudeGenerator] TypeScript errors after scene generation, running self-heal...")
            await self._run_self_heal(ts_errors)

        emit_progress(52, f"{total_scenes} scenes generated", {"phase": "animate", "phaseName": "Animating scenes", "scene": total_scenes, "totalScenes": total_scenes})

        constants_content = constants_path.read_text(encoding="utf-8")

        # ── Phase 2b+: PER-SCENE VERIFICATION ──
        emit_progress(53, "Verifying scenes against plan...", {"phase": "verify", "phaseName": "Verifying scenes"})
        print("\n[ClaudeGenerator] Phase 2b+: Running per-scene verification...")

        verify_tasks = [
            self._verify_and_fix_scene_code(
                scene_num=i + 1,
                scene_data=scene,
                scene_plan_content=scene_plan_content,
                constants_content=constants_content,
                theme_section=theme_section,
                skills_directive=skills_directive,
            )
            for i, scene in enumerate(scenes)
        ]
        verify_results = await asyncio.gather(*verify_tasks, return_exceptions=True)
        success_count = 0
        for i, result in enumerate(verify_results):
            if isinstance(result, Exception):
                print(f"[ClaudeGenerator] Scene {i+1} verify/fix exception: {result}")
            elif result[0]:
                success_count += 1
        print(f"[ClaudeGenerator] Phase 2b+: {success_count}/{len(scenes)} scenes passed verification")

        emit_progress(54, "Scene verification done", {"phase": "verify", "phaseName": "Verifying scenes"})

        # ── Phase 2c: ASSEMBLY ──
        emit_progress(55, "Assembling composition...", {"phase": "bundle", "phaseName": "Bundling for preview"})
        print("\n[ClaudeGenerator] Assembling index.tsx and metadata.json...")

        constants_text = constants_path.read_text(encoding="utf-8")

        missing_timing = []
        for i in range(total_scenes):
            n = i + 1
            for key in [f"scene{n}Start", f"scene{n}End"]:
                if f"TIMING.{key}" not in constants_text and key not in constants_text:
                    missing_timing.append(key)
        if missing_timing:
            print(f"[ClaudeGenerator] WARNING: constants.ts missing TIMING keys: {missing_timing}")

        for i in range(total_scenes):
            scene_file = self.src_dir / "scenes" / f"Scene{i + 1}.tsx"
            if scene_file.exists():
                scene_code = scene_file.read_text(encoding="utf-8")
                if f"export const Scene{i + 1}" not in scene_code:
                    print(f"[ClaudeGenerator] WARNING: Scene{i + 1}.tsx missing 'export const Scene{i + 1}'")

        index_content = self._generate_index_tsx(scenes, self.project_id)
        index_path = self.src_dir / "index.tsx"
        index_path.write_text(index_content, encoding="utf-8")

        metadata_content = self._generate_metadata_json(scenes_data, self.project_id)
        metadata_path = self.src_dir / "metadata.json"
        metadata_path.write_text(metadata_content, encoding="utf-8")

        ts_success, ts_errors = await self._verify_typescript_file(
            str(index_path.relative_to(self.workspace))
        )
        if not ts_success:
            print("[ClaudeGenerator] index.tsx has TS errors, running self-heal...")
            await self._run_self_heal(ts_errors)
            ts_success, ts_errors = await self._verify_typescript_file(
                str(index_path.relative_to(self.workspace))
            )

        # ── Phase 2d: COMPOSITION VERIFY ──
        emit_progress(57, "Verifying composition...", {"phase": "verify", "phaseName": "Verifying scenes"})

        comp_passed, comp_issues = await self._run_composition_verify(
            project_id=self.project_id,
            scenes_data=scenes_data,
            plan_content=scene_plan_content,
        )

        if not comp_passed:
            _critical_patterns = [
                "bundle fail", "bundle error", "cannot find module",
                "module not found", "import error", "missing import",
                "failed to compile", "compilation error", "syntax error",
            ]
            critical_issues = [
                issue for issue in comp_issues
                if any(pat in issue.lower() for pat in _critical_patterns)
            ]
            warning_issues = [
                issue for issue in comp_issues
                if issue not in critical_issues
            ]

            if warning_issues:
                print(f"[ClaudeGenerator] Composition warnings (non-blocking): {warning_issues}")

            if critical_issues:
                print(f"[ClaudeGenerator] Composition CRITICAL issues: {critical_issues}")
                ts_success, ts_errors = await self._verify_typescript()
                if not ts_success:
                    await self._run_self_heal(ts_errors)

        emit_progress(58, "All scenes implemented", {"phase": "animate", "phaseName": "Animating scenes"})

        if not index_path.exists():
            return {"success": False, "error": "Sequential animator did not create index.tsx"}

        return {
            "success": True,
            "indexPath": str(index_path),
            "pipeline": "sequential",
        }
