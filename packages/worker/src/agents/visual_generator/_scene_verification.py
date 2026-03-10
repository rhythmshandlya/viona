"""Scene code verification mixin — verify scenes against plan, fix issues."""

import json

from sdk_config import (
    CLAUDE_CLI_PATH,
    ClaudeSDKClient,
    ClaudeAgentOptions,
    build_mcp_servers,
)


class SceneVerificationMixin:
    """Mixin providing scene code verification for ClaudeVisualGenerator."""

    async def _run_scene_verify(
        self,
        scene_num: int,
        scene_data: dict,
        plan_description: str,
        display_mode: str,
        constants_content: str,
    ) -> tuple[bool, list[str]]:
        """Spawn a Sonnet verification subagent for a single scene.

        Returns:
            (passed, issues_list) — passed is True if PASS
        """
        from prompts.animator import SCENE_VERIFY_PROMPT

        scene_file = f"src/{self.project_id}/scenes/Scene{scene_num}.tsx"
        scene_json_str = json.dumps(scene_data, indent=2)

        user_msg = f"""
## Verify Scene {scene_num}

Scene file: `{scene_file}`
Display mode: `{display_mode}`

### Scene Data:
```json
{scene_json_str}
```

### Plan Description:
{plan_description}

### constants.ts:
```typescript
{constants_content}
```

Read the scene file and verify it against the plan and scene data.
After your analysis, call the `mcp__viewport__submit_verdict` tool with your verdict.
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
                        "append": SCENE_VERIFY_PROMPT,
                    },
                    cwd=str(self.workspace),
                    max_turns=10,
                    allowed_tools=["Read", "Bash", "mcp__viewport__submit_verdict"],
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
                                print(f"\n[SceneVerify{scene_num} Tool: {block.name}]", flush=True)

            return self._parse_verdict_from_response(messages, f"SceneVerify{scene_num}")

        except Exception as e:
            print(f"[ClaudeGenerator] Scene {scene_num} verify error: {e}")
            return True, []  # Don't block on verify failures

    async def _verify_and_fix_scene_code(
        self,
        scene_num: int,
        scene_data: dict,
        scene_plan_content: str,
        constants_content: str,
        studio_section: str,
        skills_directive: str,
    ) -> tuple[bool, list[str]]:
        """Verify a single scene's code against the plan and fix if needed.

        Returns (passed, issues) tuple.
        """
        scene_file = self.src_dir / "scenes" / f"Scene{scene_num}.tsx"
        if not scene_file.exists():
            return True, []

        # Run static overlay validation
        scene_code = scene_file.read_text(encoding="utf-8")
        overlay_issues = self._validate_overlay_placement(scene_num, scene_data, scene_code)

        # Run DotGrid validation
        dotgrid_issues = self._validate_dotgrid(scene_num, scene_code)
        overlay_issues.extend(dotgrid_issues)

        passed, issues = await self._run_scene_verify(
            scene_num=scene_num,
            scene_data=scene_data,
            plan_description=scene_plan_content,
            display_mode=scene_data.get("displayMode", "default"),
            constants_content=constants_content,
        )

        # Merge overlay issues
        if overlay_issues:
            issues = overlay_issues + issues
            passed = False

        if passed:
            print(f"[ClaudeGenerator] Scene {scene_num} passed verification")
            return True, []

        if not issues:
            return passed, []

        print(f"[ClaudeGenerator] Scene {scene_num} failed verification: {issues}")

        from prompts.animator import ANIMATOR_BASE_PROMPT

        feedback_msg = "\n".join(f"- {iss}" for iss in issues)

        # Include speaker grid context for overlay fix agents
        grid_context = ""
        if scene_data.get("displayMode") == "overlay" and scene_data.get("speakerGrid"):
            grid_context = f"""

## OVERLAY LAYOUT RULES
Canvas: {scene_data.get('effectiveDimensions', {}).get('width', 1080)}x{scene_data.get('effectiveDimensions', {}).get('height', 1920)}
ALL overlay elements must be horizontally centered (left: 0, right: 0 with centered flex).
Place content in top strip (0-15% from top) or lower-third (60-85% from top).
NEVER scatter elements at random absolute positions.
All overlay elements must have opacity 1.0 at rest — no ghosting.
"""
        fix_prompt = f"""Fix these issues in src/{self.project_id}/scenes/Scene{scene_num}.tsx:

{feedback_msg}
{grid_context}
Read the scene file and fix the listed issues.
Do NOT modify constants.ts or other scene files.
Do NOT run tsc — TypeScript will be validated after all scenes are verified.
When done, respond: "FIX COMPLETE"
"""
        try:
            fix_client = ClaudeSDKClient(
                options=ClaudeAgentOptions(
                    model=self.model,
                    max_thinking_tokens=self.max_thinking_tokens,
                    system_prompt={
                        "type": "preset",
                        "preset": "claude_code",
                        "append": f"{ANIMATOR_BASE_PROMPT}{studio_section}\n\n{skills_directive}",
                    },
                    cwd=str(self.workspace),
                    max_turns=15,
                    allowed_tools=["Read", "Edit", "Bash", "Glob"],
                    permission_mode="bypassPermissions",
                    cli_path=CLAUDE_CLI_PATH,
                )
            )

            async with fix_client:
                await fix_client.query(fix_prompt)
                async for msg in fix_client.receive_response():
                    msg_type = type(msg).__name__
                    if msg_type == "AssistantMessage" and hasattr(msg, "content"):
                        for block in msg.content:
                            block_type = type(block).__name__
                            if block_type == "ToolUseBlock" and hasattr(block, "name"):
                                print(f"\n[SceneFix{scene_num} Tool: {block.name}]", flush=True)

            # Re-verify (accept regardless after 1 retry)
            fixed_code = scene_file.read_text(encoding="utf-8")
            overlay_issues2 = self._validate_overlay_placement(scene_num, scene_data, fixed_code)

            passed2, issues2 = await self._run_scene_verify(
                scene_num=scene_num,
                scene_data=scene_data,
                plan_description=scene_plan_content,
                display_mode=scene_data.get("displayMode", "default"),
                constants_content=constants_content,
            )
            if overlay_issues2:
                issues2 = overlay_issues2 + issues2
                passed2 = False

            if passed2:
                print(f"[ClaudeGenerator] Scene {scene_num} passed verification after fix")
                return True, []
            else:
                print(f"[ClaudeGenerator] Scene {scene_num} still has issues after fix (accepted): {issues2}")
                return False, issues2
        except Exception as fix_err:
            print(f"[ClaudeGenerator] Scene {scene_num} fix agent error: {fix_err}")
            return False, issues

    async def _run_composition_verify(
        self,
        project_id: str,
        scenes_data: dict,
        plan_content: str,
    ) -> tuple[bool, list[str]]:
        """Spawn a Sonnet verification subagent for the full composition.

        Returns:
            (passed, issues_list)
        """
        from prompts.animator import COMPOSITION_VERIFY_PROMPT

        scenes = scenes_data.get("scenes", [])
        scene_count = len(scenes)
        scenes_summary = json.dumps(
            {
                "totalFrames": scenes_data.get("totalFrames"),
                "fps": scenes_data.get("fps"),
                "sceneCount": scene_count,
                "scenes": [
                    {"name": s.get("name", f"Scene {i+1}"), "displayMode": s.get("displayMode", "default")}
                    for i, s in enumerate(scenes)
                ],
            },
            indent=2,
        )

        user_msg = f"""
## Verify Full Composition

Project directory: `src/{project_id}/`
Scene count: {scene_count}

### scenes.json summary:
```json
{scenes_summary}
```

### Plan:
{plan_content}

Verify all scenes exist, constants match, and TypeScript compiles.
Fix any issues you can.
After your analysis, call the `mcp__viewport__submit_verdict` tool with your verdict.
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
                        "append": COMPOSITION_VERIFY_PROMPT,
                    },
                    cwd=str(self.workspace),
                    max_turns=15,
                    allowed_tools=["Read", "Bash", "Edit", "Glob", "mcp__viewport__submit_verdict"],
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
                                print(f"\n[CompVerify Tool: {block.name}]", flush=True)

            return self._parse_verdict_from_response(messages, "CompVerify")

        except Exception as e:
            print(f"[ClaudeGenerator] Composition verify error: {e}")
            return True, []  # Don't block on verify failures
