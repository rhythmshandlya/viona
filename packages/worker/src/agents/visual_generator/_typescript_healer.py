"""TypeScript verification and self-healing mixin."""

import subprocess

from sdk_config import (
    IS_WINDOWS,
    CLAUDE_CLI_PATH,
    ClaudeSDKClient,
    ClaudeAgentOptions,
)


class TypeScriptHealerMixin:
    """Mixin providing TypeScript verification and self-heal for ClaudeVisualGenerator."""

    async def _verify_typescript(self) -> tuple[bool, str]:
        """Run TypeScript validation on the generated code.

        Returns:
            Tuple of (success, error_output)
        """
        try:
            result = subprocess.run(
                ["npx", "tsc", "--noEmit"],
                cwd=str(self.workspace),
                capture_output=True,
                timeout=60,
                shell=IS_WINDOWS,
                encoding="utf-8",
                errors="replace",
            )
            if result.returncode == 0:
                return True, ""
            else:
                errors = result.stdout + result.stderr
                print(f"[ClaudeGenerator] TypeScript errors:\n{errors[:2000]}")
                return False, errors
        except subprocess.TimeoutExpired:
            return False, "TypeScript check timed out"
        except Exception as e:
            return False, str(e)

    async def _verify_typescript_file(self, file_path: str) -> tuple[bool, str]:
        """Run TypeScript validation on a specific file.

        Runs full project tsc check, then filters errors to those mentioning
        the target file.

        Args:
            file_path: Path relative to the workspace (e.g. "src/proj/scenes/Scene1.tsx")

        Returns:
            Tuple of (success, error_output)
        """
        try:
            result = subprocess.run(
                ["npx", "tsc", "--noEmit"],
                cwd=str(self.workspace),
                capture_output=True,
                timeout=90,
                shell=IS_WINDOWS,
                encoding="utf-8",
                errors="replace",
            )
            if result.returncode == 0:
                return True, ""
            else:
                all_errors = result.stdout + result.stderr
                file_key = file_path.replace("\\", "/")
                relevant = []
                for line in all_errors.splitlines():
                    normalized = line.replace("\\", "/")
                    if file_key in normalized or (relevant and not line.strip().startswith("src/")):
                        relevant.append(line)
                if relevant:
                    filtered = "\n".join(relevant)
                    print(f"[ClaudeGenerator] TypeScript errors in {file_path}:\n{filtered[:2000]}")
                    return False, filtered
                # Errors exist but not in our target file — treat as success for this file
                return True, ""
        except subprocess.TimeoutExpired:
            return False, "TypeScript check timed out"
        except Exception as e:
            return False, str(e)

    async def _run_self_heal(self, ts_errors: str) -> bool:
        """Run a mini-agent to fix TypeScript errors.

        Args:
            ts_errors: The TypeScript error output

        Returns:
            True if the agent ran successfully (doesn't guarantee errors fixed)
        """
        print(f"[ClaudeGenerator] Running self-heal agent...")

        heal_prompt = f"""
## TASK: Fix TypeScript Errors

The code has TypeScript compilation errors. Your job is to fix them.

### TypeScript Errors:
```
{ts_errors[:3000]}
```

### Instructions:
1. Read the error messages carefully
2. Identify the files and line numbers with errors
3. Read those files to understand the context
4. Fix each error - common issues are:
   - Missing imports
   - Type mismatches
   - Undefined variables
   - Syntax errors (missing brackets, etc.)
5. After fixing, run `npx tsc --noEmit` to verify

### Rules:
- Fix the MINIMUM needed to resolve errors
- Do NOT refactor or change working code
- Do NOT add new features
- Focus ONLY on making TypeScript compile

When done, respond: "SELF-HEAL COMPLETE"
"""

        try:
            client = ClaudeSDKClient(
                options=ClaudeAgentOptions(
                    model=self.model,
                    system_prompt={
                        "type": "preset",
                        "preset": "claude_code",
                        "append": "You are a TypeScript error fixer. Fix compilation errors quickly and precisely."
                    },
                    cwd=str(self.workspace),
                    max_turns=20,
                    max_thinking_tokens=self.max_thinking_tokens,
                    setting_sources=["project"],
                    allowed_tools=["Read", "Edit", "Bash", "Glob", "Skill"],
                    permission_mode="bypassPermissions",
                    cli_path=CLAUDE_CLI_PATH,
                )
            )

            async with client:
                await client.query(heal_prompt)

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
                                print(f"\n[SelfHeal Tool: {block.name}]", flush=True)

            print(f"\n[ClaudeGenerator] Self-heal agent completed")
            return True

        except Exception as e:
            print(f"[ClaudeGenerator] Self-heal agent error: {e}")
            return False
