"""
Claude Agent SDK Stub

This is a stub module that provides the interface for the Claude Agent SDK.
The actual SDK is not yet publicly available.

For now, this stub allows the code to import and provides placeholder classes.
The actual implementation will use subprocess to call Claude Code CLI directly.
"""

from dataclasses import dataclass, field
from typing import Any, Optional
import subprocess
import json
import os
import asyncio


@dataclass
class ClaudeAgentOptions:
    """Options for Claude agent sessions."""
    model: str = "claude-sonnet-4-20250514"
    system_prompt: str = ""
    cwd: str = "."
    max_turns: int = 50
    max_thinking_tokens: int = 10000
    settings: dict = field(default_factory=dict)


class ClaudeSDKClient:
    """
    Claude SDK Client stub.

    This implementation uses the Claude Code CLI via subprocess
    since the official SDK is not yet available.
    """

    def __init__(self):
        self._validate_claude_cli()

    def _validate_claude_cli(self):
        """Check if Claude Code CLI is available."""
        try:
            result = subprocess.run(
                ["claude", "--version"],
                capture_output=True,
                text=True,
                timeout=10
            )
            if result.returncode != 0:
                raise RuntimeError("Claude Code CLI not available")
        except FileNotFoundError:
            raise RuntimeError(
                "Claude Code CLI not found. Please install it from: "
                "https://github.com/anthropics/claude-code"
            )

    async def run(
        self,
        message: str,
        options: ClaudeAgentOptions,
    ) -> dict[str, Any]:
        """
        Run a Claude agent session.

        Uses Claude Code CLI in non-interactive mode.
        """
        # Build command
        cmd = [
            "claude",
            "--print",  # Non-interactive, print output
            "--output-format", "json",
            "--model", options.model,
        ]

        if options.max_turns:
            cmd.extend(["--max-turns", str(options.max_turns)])

        # Create settings file if provided
        settings_file = None
        if options.settings:
            import tempfile
            settings_file = tempfile.NamedTemporaryFile(
                mode='w',
                suffix='.json',
                delete=False
            )
            json.dump(options.settings, settings_file)
            settings_file.close()

        try:
            # Combine system prompt and message
            full_prompt = message
            if options.system_prompt:
                full_prompt = f"<system>\n{options.system_prompt}\n</system>\n\n{message}"

            # Run Claude Code CLI
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=options.cwd,
            )

            stdout, stderr = await process.communicate(input=full_prompt.encode())

            if process.returncode != 0:
                return {
                    "success": False,
                    "error": stderr.decode() if stderr else "Unknown error",
                    "output": stdout.decode() if stdout else "",
                }

            # Parse JSON output
            try:
                output = json.loads(stdout.decode())
                return {
                    "success": True,
                    "output": output,
                    "raw": stdout.decode(),
                }
            except json.JSONDecodeError:
                return {
                    "success": True,
                    "output": stdout.decode(),
                    "raw": stdout.decode(),
                }

        finally:
            # Cleanup settings file
            if settings_file:
                try:
                    os.unlink(settings_file.name)
                except:
                    pass


def configure_sdk_auth():
    """
    Configure SDK authentication.

    This stub implementation relies on Claude Code CLI's built-in
    authentication (OAuth via Claude Pro/Max subscription).
    """
    # Claude Code CLI handles auth automatically
    # Just verify it's configured
    try:
        result = subprocess.run(
            ["claude", "--version"],
            capture_output=True,
            text=True,
            timeout=10
        )
        if result.returncode != 0:
            raise RuntimeError("Claude Code CLI not configured")
    except FileNotFoundError:
        raise RuntimeError(
            "Claude Code CLI not found. Install from: "
            "https://github.com/anthropics/claude-code"
        )
