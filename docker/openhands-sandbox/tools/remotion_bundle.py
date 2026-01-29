"""
Remotion Bundle Tool for OpenHands.

Runs the Remotion bundler to create a production bundle of the composition.
This validates that all imports resolve, components render, and the project
is ready for video rendering.
"""

import os
import re
import shlex
from collections.abc import Sequence
from typing import Optional

from pydantic import Field

from openhands.sdk import (
    Action,
    ImageContent,
    Observation,
    TextContent,
    ToolDefinition,
)
from openhands.sdk.tool import ToolExecutor
from openhands.tools.terminal import TerminalAction, TerminalExecutor


class RemotionBundleAction(Action):
    """Action to bundle a Remotion composition."""

    entry_point: str = Field(
        default="src/index.ts",
        description="Entry point file for the Remotion project"
    )
    out_dir: str = Field(
        default="build",
        description="Output directory for the bundle"
    )
    composition_id: Optional[str] = Field(
        default=None,
        description="Specific composition ID to validate (optional)"
    )


class RemotionBundleObservation(Observation):
    """Observation from Remotion bundling."""

    success: bool = Field(default=False, description="Whether bundling succeeded")
    bundle_path: str = Field(default="", description="Path to the generated bundle")
    errors: list[str] = Field(default_factory=list, description="Error messages")
    warnings: list[str] = Field(default_factory=list, description="Warning messages")
    raw_output: str = Field(default="", description="Raw bundler output")
    duration_ms: int = Field(default=0, description="Bundle time in milliseconds")

    @property
    def to_llm_content(self) -> Sequence[TextContent | ImageContent]:
        if self.success:
            return [TextContent(text=f"""Remotion bundle succeeded!

Bundle path: {self.bundle_path}
Duration: {self.duration_ms}ms

{f"Warnings ({len(self.warnings)}): " + "; ".join(self.warnings[:5]) if self.warnings else "No warnings."}""")]

        error_text = "\n".join(f"- {e}" for e in self.errors[:10])
        more = f"\n... and {len(self.errors) - 10} more errors" if len(self.errors) > 10 else ""

        return [TextContent(text=f"""Remotion bundle FAILED!

Errors:
{error_text}{more}

Common fixes:
- Check imports are correct (relative paths, file extensions)
- Ensure all components are properly exported
- Verify Remotion hooks are used inside components
- Check for missing dependencies in package.json""")]


class RemotionBundleExecutor(ToolExecutor[RemotionBundleAction, RemotionBundleObservation]):
    """Executor that runs Remotion bundler."""

    # Patterns to extract errors and warnings
    ERROR_PATTERNS = [
        re.compile(r'Error:\s*(.+)', re.MULTILINE),
        re.compile(r'error\s*[:-]\s*(.+)', re.IGNORECASE | re.MULTILINE),
        re.compile(r'Cannot find module\s*[\'"](.+?)[\'"]', re.MULTILINE),
        re.compile(r'Module not found:\s*(.+)', re.MULTILINE),
        re.compile(r'SyntaxError:\s*(.+)', re.MULTILINE),
    ]

    WARNING_PATTERN = re.compile(r'warning\s*[:-]\s*(.+)', re.IGNORECASE | re.MULTILINE)

    def __init__(self, terminal: TerminalExecutor, working_dir: str = "/workspace"):
        self.terminal = terminal
        self.working_dir = working_dir

    def __call__(
        self,
        action: RemotionBundleAction,
        conversation=None
    ) -> RemotionBundleObservation:
        import time
        start_time = time.time()

        # Build remotion bundle command
        entry_point = shlex.quote(os.path.join(self.working_dir, action.entry_point))
        out_dir = shlex.quote(os.path.join(self.working_dir, action.out_dir))

        cmd = f"cd {shlex.quote(self.working_dir)} && npx remotion bundle {entry_point} --out-dir {out_dir}"

        # Run bundler
        result = self.terminal(TerminalAction(command=cmd))
        output = result.text if hasattr(result, 'text') else str(result)

        duration_ms = int((time.time() - start_time) * 1000)

        # Extract errors
        errors = []
        for pattern in self.ERROR_PATTERNS:
            for match in pattern.finditer(output):
                error_msg = match.group(1).strip()
                if error_msg and error_msg not in errors:
                    errors.append(error_msg)

        # Extract warnings
        warnings = []
        for match in self.WARNING_PATTERN.finditer(output):
            warning_msg = match.group(1).strip()
            if warning_msg and warning_msg not in warnings:
                warnings.append(warning_msg)

        # Determine success
        # Check for explicit success indicators or absence of errors
        success = (
            len(errors) == 0 and
            "bundle" in output.lower() and
            ("success" in output.lower() or "done" in output.lower() or "created" in output.lower())
        )

        # If no clear indicators, check exit behavior
        if not success and len(errors) == 0:
            # Check if bundle directory was created
            bundle_check_cmd = f"test -d {out_dir} && echo 'EXISTS'"
            check_result = self.terminal(TerminalAction(command=bundle_check_cmd))
            check_output = check_result.text if hasattr(check_result, 'text') else str(check_result)
            success = "EXISTS" in check_output

        bundle_path = os.path.join(self.working_dir, action.out_dir) if success else ""

        return RemotionBundleObservation(
            success=success,
            bundle_path=bundle_path,
            errors=errors,
            warnings=warnings,
            raw_output=output[:3000],  # Limit raw output size
            duration_ms=duration_ms
        )


_REMOTION_BUNDLE_DESCRIPTION = """Remotion bundle validation tool.

Runs `npx remotion bundle` to create a production bundle and validate:
- All imports resolve correctly
- Components compile without errors
- Remotion-specific APIs are used correctly
- Dependencies are available

Use this AFTER TypeScript validation passes, as bundling is slower but catches
runtime and import issues that tsc might miss.

Returns bundle path on success, or detailed error messages on failure.
"""


class RemotionBundleTool(ToolDefinition[RemotionBundleAction, RemotionBundleObservation]):
    """Remotion bundling tool for full build validation."""

    name = "RemotionBundleTool"

    @classmethod
    def create(
        cls,
        conv_state,
        terminal_executor: Optional[TerminalExecutor] = None
    ) -> Sequence[ToolDefinition]:
        """Create RemotionBundleTool instance.

        Args:
            conv_state: Conversation state for workspace info
            terminal_executor: Optional shared terminal executor

        Returns:
            Sequence containing the tool instance
        """
        working_dir = conv_state.workspace.working_dir

        if terminal_executor is None:
            terminal_executor = TerminalExecutor(working_dir=working_dir)

        executor = RemotionBundleExecutor(
            terminal=terminal_executor,
            working_dir=working_dir
        )

        return [
            cls(
                description=_REMOTION_BUNDLE_DESCRIPTION,
                action_type=RemotionBundleAction,
                observation_type=RemotionBundleObservation,
                executor=executor,
            )
        ]
