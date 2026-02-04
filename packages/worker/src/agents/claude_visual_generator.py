#!/usr/bin/env python3
"""
Claude Code Visual Generator

Generates Remotion video compositions using Claude Agent SDK with OAuth authentication.
Uses Claude Pro/Max subscription (no API key costs).

Reference: Auto-Claude apps/backend/core/auth.py, client.py
"""

import asyncio
import json
import os
import shutil
import sys
from pathlib import Path
from typing import Any

# Claude Agent SDK imports
try:
    from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions
except ImportError:
    print("Error: claude-agent-sdk not installed. Run: pip install claude-agent-sdk")
    sys.exit(1)


# =============================================================================
# OAuth Authentication (Reference: Auto-Claude apps/backend/core/auth.py)
# =============================================================================


def get_oauth_token_from_credential_store() -> str | None:
    """
    Get OAuth token from Windows credential files.

    Claude Code on Windows stores credentials in ~/.claude/.credentials.json

    Reference: Auto-Claude apps/backend/core/auth.py lines 476-530
    """
    try:
        # Windows credential paths
        cred_paths = [
            os.path.expandvars(r"%USERPROFILE%\.claude\.credentials.json"),
            os.path.expandvars(r"%USERPROFILE%\.claude\credentials.json"),
            os.path.expandvars(r"%LOCALAPPDATA%\Claude\credentials.json"),
            os.path.expandvars(r"%APPDATA%\Claude\credentials.json"),
        ]

        for cred_path in cred_paths:
            if os.path.exists(cred_path):
                try:
                    with open(cred_path, encoding="utf-8") as f:
                        data = json.load(f)
                        token = data.get("claudeAiOauth", {}).get("accessToken")
                        if token and (
                            token.startswith("sk-ant-oat01-")
                            or token.startswith("enc:")
                        ):
                            return token
                except (json.JSONDecodeError, KeyError):
                    continue

        return None

    except Exception:
        return None


def require_oauth_token() -> str:
    """
    Get OAuth token or raise error with instructions.

    Reference: Auto-Claude apps/backend/core/auth.py lines 782-831
    """
    # Check environment variable first
    token = os.environ.get("CLAUDE_CODE_OAUTH_TOKEN")
    if token and token.startswith("sk-ant-oat01-"):
        return token

    # Try credential store
    token = get_oauth_token_from_credential_store()
    if token:
        return token

    raise ValueError(
        "No OAuth token found.\n\n"
        "Claude Visual Generator requires Claude Pro/Max subscription.\n"
        "API keys (ANTHROPIC_API_KEY) are NOT supported.\n\n"
        "To authenticate:\n"
        "  1. Run: claude\n"
        "  2. Type: /login\n"
        "  3. Complete OAuth in browser\n"
    )


def configure_sdk_auth() -> None:
    """
    Configure environment for Claude Agent SDK authentication.

    Reference: Auto-Claude apps/backend/core/auth.py lines 951-999
    """
    token = require_oauth_token()
    os.environ["CLAUDE_CODE_OAUTH_TOKEN"] = token


# =============================================================================
# System Prompt and User Message Templates
# =============================================================================


SYSTEM_PROMPT = """
You are a Remotion video generator. You create animated educational videos from transcripts.

## WORKSPACE
- Working directory: {workspace_dir}
- Output: src/{project_id}/index.tsx (single file, all components)
- Constants: src/{project_id}/constants.ts (colors, timing)

## PROCESS
1. **THINK** (use extended thinking): Plan the visual story
   - Identify 4-6 key moments from transcript
   - Design metaphors (abstract concepts → visual representations)
   - Plan timing (frames) for each scene

2. **WRITE**: Create the Remotion composition
   - Write constants.ts first (COLORS, TIMING, SIZES)
   - Write index.tsx with all scenes

3. **VALIDATE**: Run TypeScript check
   - Execute: npx tsc --noEmit --pretty false
   - Fix any errors before finishing

## ANIMATION RULES (CRITICAL)
- Spring config: {{damping: 22, stiffness: 90, mass: 0.9}}
- Stagger elements by 6+ frames (never animate all at once)
- No Math.sin/cos on text positions
- Use interpolate() with extrapolateRight: 'clamp'

## CONSTRAINTS
- Single file output (no splitting into components/)
- {width}x{height} resolution, {fps} FPS, {duration_frames} total frames
- Must pass TypeScript validation before finishing
"""


USER_MESSAGE = """
## PROJECT: {project_id}

## VIDEO SPECS
- Resolution: {width}x{height}
- Duration: {duration_frames} frames ({duration_seconds}s)
- FPS: {fps}

## TRANSCRIPT
{transcript}

## YOUR TASK
Create a visually engaging Remotion video that explains this content.

Requirements:
1. Plan 4-6 scenes that build understanding progressively
2. Use visual metaphors (don't just show text)
3. Include smooth animations with proper spring physics
4. Ensure all elements are readable at {width}x{height}

Output files:
- src/{project_id}/constants.ts
- src/{project_id}/index.tsx

When TypeScript validation passes, respond with "GENERATION COMPLETE" and a summary of what you created.
"""


# =============================================================================
# Security Settings (Reference: Auto-Claude apps/backend/core/client.py)
# =============================================================================


def create_security_settings(workspace_path: str) -> dict:
    """
    Create security settings for Claude Agent SDK.

    Reference: Auto-Claude apps/backend/core/client.py lines 603-654
    """
    return {
        "sandbox": {"enabled": True, "autoAllowBashIfSandboxed": True},
        "permissions": {
            "defaultMode": "acceptEdits",
            "allow": [
                # Allow all file operations within workspace
                "Read(./**)",
                "Write(./**)",
                "Edit(./**)",
                "Glob(./**)",
                "Grep(./**)",
                # Also allow absolute paths
                f"Read({workspace_path}/**)",
                f"Write({workspace_path}/**)",
                f"Edit({workspace_path}/**)",
                f"Glob({workspace_path}/**)",
                f"Grep({workspace_path}/**)",
                # Allow bash for TypeScript validation
                "Bash(*)",
            ],
        },
    }


# =============================================================================
# Visual Generator Class
# =============================================================================


class ClaudeVisualGenerator:
    """
    Generates Remotion video compositions using Claude Agent SDK.

    Uses OAuth authentication from Claude Pro/Max subscription.
    """

    def __init__(
        self,
        workspace: Path,
        project_id: str,
        bundle_output: Path,
        model: str = "claude-sonnet-4-20250514",
        max_thinking_tokens: int = 10000,
        max_turns: int = 100,
    ):
        """
        Initialize the visual generator.

        Args:
            workspace: Path to the Remotion workspace (with node_modules)
            project_id: Unique project identifier
            bundle_output: Path to output bundled video
            model: Claude model to use
            max_thinking_tokens: Token budget for extended thinking
            max_turns: Maximum agent turns
        """
        self.workspace = workspace
        self.project_id = project_id
        self.src_dir = workspace / "src" / project_id
        self.bundle_output = bundle_output
        self.model = model
        self.max_thinking_tokens = max_thinking_tokens
        self.max_turns = max_turns

        # Configure OAuth authentication
        configure_sdk_auth()

    def _build_system_prompt(
        self,
        width: int,
        height: int,
        fps: int,
        duration_frames: int,
    ) -> str:
        """Build the system prompt with workspace context."""
        return SYSTEM_PROMPT.format(
            workspace_dir=str(self.workspace),
            project_id=self.project_id,
            width=width,
            height=height,
            fps=fps,
            duration_frames=duration_frames,
        )

    def _build_user_message(
        self,
        transcript: str,
        width: int,
        height: int,
        duration_frames: int,
        fps: int,
    ) -> str:
        """Build the user message with transcript and specs."""
        duration_seconds = duration_frames / fps
        return USER_MESSAGE.format(
            project_id=self.project_id,
            width=width,
            height=height,
            duration_frames=duration_frames,
            duration_seconds=f"{duration_seconds:.1f}",
            fps=fps,
            transcript=transcript,
        )

    def _write_security_settings(self) -> Path:
        """Write security settings to a temporary file."""
        settings = create_security_settings(str(self.workspace))
        settings_path = self.workspace / ".claude" / "settings.local.json"
        settings_path.parent.mkdir(parents=True, exist_ok=True)

        with open(settings_path, "w", encoding="utf-8") as f:
            json.dump(settings, f, indent=2)

        return settings_path

    async def _verify_typescript(self) -> bool:
        """Run TypeScript validation on the generated code."""
        import subprocess

        try:
            result = subprocess.run(
                ["npx", "tsc", "--noEmit", "--pretty", "false"],
                cwd=str(self.workspace),
                capture_output=True,
                text=True,
                timeout=60,
                shell=True,
            )
            return result.returncode == 0
        except subprocess.TimeoutExpired:
            return False
        except Exception:
            return False

    async def _run_bundle(self) -> Path:
        """Bundle the Remotion project."""
        import subprocess

        bundle_path = self.bundle_output / self.project_id

        # Create output directory
        bundle_path.mkdir(parents=True, exist_ok=True)

        try:
            result = subprocess.run(
                ["npx", "remotion", "bundle", "--out-dir", str(bundle_path)],
                cwd=str(self.workspace),
                capture_output=True,
                text=True,
                timeout=300,
                shell=True,
            )

            if result.returncode != 0:
                raise RuntimeError(f"Bundle failed: {result.stderr}")

            return bundle_path

        except subprocess.TimeoutExpired:
            raise RuntimeError("Bundle timed out after 5 minutes")

    async def generate(
        self,
        transcript: str,
        width: int = 1920,
        height: int = 1080,
        duration_frames: int = 1800,
        fps: int = 30,
        timeout_seconds: int = 300,
        max_retries: int = 2,
    ) -> dict[str, Any]:
        """
        Generate a Remotion video composition from a transcript.

        Args:
            transcript: The transcript text to visualize
            width: Video width in pixels
            height: Video height in pixels
            duration_frames: Total duration in frames
            fps: Frames per second
            timeout_seconds: Timeout for generation
            max_retries: Maximum retry attempts

        Returns:
            dict with success status and bundle URL

        Raises:
            ValueError: If OAuth authentication fails
            RuntimeError: If generation fails after all retries
        """
        last_error: Exception | None = None

        for attempt in range(max_retries + 1):
            try:
                print(f"[ClaudeGenerator] Attempt {attempt + 1}/{max_retries + 1}")

                # Clean previous attempt
                if self.src_dir.exists():
                    shutil.rmtree(self.src_dir)
                self.src_dir.mkdir(parents=True)

                # Write security settings
                settings_path = self._write_security_settings()

                # Build prompts
                system_prompt = self._build_system_prompt(
                    width, height, fps, duration_frames
                )
                user_message = self._build_user_message(
                    transcript, width, height, duration_frames, fps
                )

                print(f"[ClaudeGenerator] Starting Claude Agent SDK...")
                print(f"[ClaudeGenerator] Model: {self.model}")
                print(f"[ClaudeGenerator] Workspace: {self.workspace}")

                # Create Claude SDK client
                client = ClaudeSDKClient(
                    options=ClaudeAgentOptions(
                        model=self.model,
                        system_prompt=system_prompt,
                        cwd=str(self.workspace),
                        max_turns=self.max_turns,
                        max_thinking_tokens=self.max_thinking_tokens,
                        settings=str(settings_path),
                    )
                )

                # Run the agent
                await client.run(user_message)

                print(f"[ClaudeGenerator] Agent completed")

                # Verify output exists
                index_tsx = self.src_dir / "index.tsx"
                if not index_tsx.exists():
                    raise RuntimeError(
                        f"index.tsx not found at {index_tsx}. "
                        "Agent may not have generated the expected output."
                    )

                # Verify TypeScript
                print(f"[ClaudeGenerator] Verifying TypeScript...")
                if not await self._verify_typescript():
                    raise RuntimeError(
                        "TypeScript validation failed. "
                        "Generated code has type errors."
                    )

                print(f"[ClaudeGenerator] TypeScript validation passed")

                # Bundle
                print(f"[ClaudeGenerator] Bundling project...")
                bundle_path = await self._run_bundle()

                print(f"[ClaudeGenerator] Bundle complete: {bundle_path}")

                return {
                    "success": True,
                    "bundleUrl": f"/bundles/{self.project_id}/index.html",
                    "bundlePath": str(bundle_path),
                    "attempts": attempt + 1,
                }

            except ValueError:
                # Authentication errors should not be retried
                raise

            except Exception as e:
                last_error = e
                print(f"[ClaudeGenerator] Attempt {attempt + 1} failed: {e}")
                continue

        raise RuntimeError(
            f"Generation failed after {max_retries + 1} attempts: {last_error}"
        )


# =============================================================================
# CLI Entry Point
# =============================================================================


async def main():
    """CLI entry point for testing."""
    import argparse

    parser = argparse.ArgumentParser(description="Claude Code Visual Generator")
    parser.add_argument("--workspace", required=True, help="Path to Remotion workspace")
    parser.add_argument("--project-id", required=True, help="Project ID")
    parser.add_argument("--bundle-output", required=True, help="Bundle output directory")
    parser.add_argument("--transcript", required=True, help="Transcript text or file path")
    parser.add_argument("--width", type=int, default=1920, help="Video width")
    parser.add_argument("--height", type=int, default=1080, help="Video height")
    parser.add_argument("--duration", type=int, default=1800, help="Duration in frames")
    parser.add_argument("--fps", type=int, default=30, help="Frames per second")
    parser.add_argument("--model", default="claude-sonnet-4-20250514", help="Claude model")

    args = parser.parse_args()

    # Load transcript
    transcript = args.transcript
    if os.path.exists(transcript):
        with open(transcript, encoding="utf-8") as f:
            transcript = f.read()

    # Create generator
    generator = ClaudeVisualGenerator(
        workspace=Path(args.workspace),
        project_id=args.project_id,
        bundle_output=Path(args.bundle_output),
        model=args.model,
    )

    # Generate
    result = await generator.generate(
        transcript=transcript,
        width=args.width,
        height=args.height,
        duration_frames=args.duration,
        fps=args.fps,
    )

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
