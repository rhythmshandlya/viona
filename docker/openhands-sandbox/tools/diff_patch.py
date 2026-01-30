"""
DiffPatch Tool for OpenHands.

Applies unified diff patches to files using the `patch` command.
This is a middle-ground between str_replace (token-efficient but fragile)
and WriteFileTool (reliable but token-heavy).

Based on community feedback from OpenHands issues #8112 and #9920.
"""

import json
import os
import re
import tempfile
from collections.abc import Sequence
from pathlib import Path
from typing import Optional

from pydantic import Field


def summarize_diff(diff: str) -> dict:
    """Extract a concise summary of diff changes."""
    summary = {
        "lines_added": diff.count('\n+') - diff.count('\n+++'),
        "lines_removed": diff.count('\n-') - diff.count('\n---'),
    }

    # Extract changed line numbers from hunks
    hunk_pattern = re.compile(r'^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@', re.MULTILINE)
    hunks = hunk_pattern.findall(diff)
    if hunks:
        summary["hunks"] = len(hunks)
        summary["at_lines"] = [int(h[0]) for h in hunks[:3]]

    # Extract specific changes (first few)
    changes = []
    for line in diff.split('\n'):
        if line.startswith('+') and not line.startswith('+++'):
            changes.append(f"+{line[1:30].strip()}...")
        elif line.startswith('-') and not line.startswith('---'):
            changes.append(f"-{line[1:30].strip()}...")
        if len(changes) >= 4:
            break
    if changes:
        summary["changes"] = changes

    return summary


def emit_diff_event(path: str, summary: dict, success: bool, hunks_applied: int = 0, error: str = None):
    """Emit a concise JSON event for diff operations."""
    event = {
        "type": "file_operation",
        "action": "patch",
        "path": path,
        "success": success,
        "hunks_applied": hunks_applied,
        **summary
    }
    if error:
        event["error"] = error
    print(json.dumps(event), flush=True)

from openhands.sdk import (
    Action,
    ImageContent,
    Observation,
    TextContent,
    ToolDefinition,
)
from openhands.sdk.tool import ToolExecutor
from openhands.tools.terminal import TerminalAction, TerminalExecutor


class DiffPatchAction(Action):
    """Action to apply a unified diff patch to a file."""

    path: str = Field(
        description="File path relative to workspace to patch (e.g., 'src/Root.tsx')"
    )
    diff: str = Field(
        description="""Unified diff to apply. Format:
--- a/original
+++ b/modified
@@ -start,count +start,count @@
 context line
-removed line
+added line
 context line"""
    )
    ignore_whitespace: bool = Field(
        default=True,
        description="Ignore whitespace differences when applying patch"
    )
    backup: bool = Field(
        default=True,
        description="Create .orig backup file before patching"
    )


class DiffPatchObservation(Observation):
    """Observation from diff patch operation."""

    success: bool = Field(default=False, description="Whether patch applied successfully")
    path: str = Field(default="", description="Path of patched file")
    hunks_applied: int = Field(default=0, description="Number of hunks successfully applied")
    hunks_failed: int = Field(default=0, description="Number of hunks that failed")
    error: str = Field(default="", description="Error message if failed")
    raw_output: str = Field(default="", description="Raw patch command output")

    @property
    def to_llm_content(self) -> Sequence[TextContent | ImageContent]:
        if self.success:
            return [TextContent(text=f"""Patch applied successfully.

Path: {self.path}
Hunks applied: {self.hunks_applied}""")]

        if self.hunks_failed > 0 and self.hunks_applied > 0:
            return [TextContent(text=f"""Patch partially applied.

Path: {self.path}
Hunks applied: {self.hunks_applied}
Hunks FAILED: {self.hunks_failed}

Some changes were applied but others failed. Check the .rej file for rejected hunks.
Consider using WriteFileTool to replace the entire file instead.""")]

        return [TextContent(text=f"""Patch failed.

Error: {self.error}

Common fixes:
- Ensure the diff targets the correct file
- Check that context lines match the current file content
- Use more context lines (3+ lines before/after changes)
- If patch keeps failing, use WriteFileTool to replace the entire file

Raw output:
{self.raw_output[:500]}""")]


class DiffPatchExecutor(ToolExecutor[DiffPatchAction, DiffPatchObservation]):
    """Executor that applies unified diffs using patch command."""

    # Pattern to validate unified diff format
    DIFF_HEADER_PATTERN = re.compile(r'^---\s+\S+', re.MULTILINE)
    HUNK_PATTERN = re.compile(r'^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@', re.MULTILINE)

    # Pattern to count applied/failed hunks from patch output
    HUNK_SUCCESS_PATTERN = re.compile(r'patching file|Hunk #\d+ succeeded', re.IGNORECASE)
    HUNK_FAIL_PATTERN = re.compile(r'Hunk #\d+ FAILED|rejected', re.IGNORECASE)

    def __init__(self, terminal: TerminalExecutor, working_dir: str = "/workspace"):
        self.terminal = terminal
        self.working_dir = working_dir

    def validate_diff(self, diff: str) -> tuple[bool, str]:
        """Validate that the diff is well-formed."""
        if not diff.strip():
            return False, "Diff is empty"

        if not self.DIFF_HEADER_PATTERN.search(diff):
            return False, "Missing diff header (--- a/file)"

        if not self.HUNK_PATTERN.search(diff):
            return False, "Missing hunk header (@@ -line,count +line,count @@)"

        # Check for common LLM mistakes
        if '<<<<<<' in diff or '======' in diff or '>>>>>>' in diff:
            return False, "Diff contains merge conflict markers"

        return True, ""

    def __call__(
        self,
        action: DiffPatchAction,
        conversation=None
    ) -> DiffPatchObservation:
        # Validate diff format
        is_valid, error_msg = self.validate_diff(action.diff)
        if not is_valid:
            return DiffPatchObservation(
                success=False,
                error=f"Invalid diff format: {error_msg}"
            )

        # Resolve full path
        full_path = Path(self.working_dir) / action.path

        # Security check: ensure path is within workspace
        try:
            full_path.resolve().relative_to(Path(self.working_dir).resolve())
        except ValueError:
            return DiffPatchObservation(
                success=False,
                error=f"Path '{action.path}' is outside workspace"
            )

        # Check file exists
        if not full_path.exists():
            return DiffPatchObservation(
                success=False,
                error=f"File does not exist: {action.path}"
            )

        try:
            # Write diff to temp file
            with tempfile.NamedTemporaryFile(
                mode='w',
                suffix='.patch',
                delete=False,
                encoding='utf-8'
            ) as f:
                f.write(action.diff)
                patch_file = f.name

            # Build patch command
            cmd_parts = ["patch"]

            if action.ignore_whitespace:
                cmd_parts.append("--ignore-whitespace")

            if action.backup:
                cmd_parts.append("--backup")

            # Use -p0 to not strip path prefixes, or -p1 for standard git diff format
            # Try to detect which format is being used
            if action.diff.startswith('--- a/') or '\n--- a/' in action.diff:
                cmd_parts.append("-p1")
            else:
                cmd_parts.append("-p0")

            cmd_parts.extend([
                str(full_path),
                f"< {patch_file}"
            ])

            cmd = " ".join(cmd_parts)

            # Run patch command
            result = self.terminal(TerminalAction(command=cmd))
            output = result.text if hasattr(result, 'text') else str(result)

            # Clean up temp file
            try:
                os.unlink(patch_file)
            except OSError:
                pass

            # Count hunks
            hunks_applied = len(self.HUNK_SUCCESS_PATTERN.findall(output))
            hunks_failed = len(self.HUNK_FAIL_PATTERN.findall(output))

            # If no explicit counts, check for success indicators
            if hunks_applied == 0 and hunks_failed == 0:
                if "patching file" in output.lower():
                    hunks_applied = len(self.HUNK_PATTERN.findall(action.diff))

            # Determine success
            success = hunks_failed == 0 and (
                "patching file" in output.lower() or
                hunks_applied > 0
            )

            # Check for common failure patterns
            if "FAILED" in output or "rejected" in output.lower():
                success = False

            # Emit concise summary event
            diff_summary = summarize_diff(action.diff)
            emit_diff_event(
                path=action.path,
                summary=diff_summary,
                success=success,
                hunks_applied=hunks_applied,
                error=None if success else "Patch failed"
            )

            return DiffPatchObservation(
                success=success,
                path=str(full_path),
                hunks_applied=hunks_applied,
                hunks_failed=hunks_failed,
                error="" if success else "Patch application failed",
                raw_output=output[:2000]
            )

        except Exception as e:
            return DiffPatchObservation(
                success=False,
                error=f"Unexpected error: {type(e).__name__}: {e}"
            )


_DIFF_PATCH_DESCRIPTION = """Apply unified diff patches to files.

Use this tool when:
- str_replace fails due to "multiple occurrences" but you don't want to rewrite the whole file
- You have multiple related changes to make in one operation
- You want to be token-efficient while still being reliable

Format your diff as a standard unified diff:
```
--- a/src/Component.tsx
+++ b/src/Component.tsx
@@ -10,7 +10,7 @@
 import React from 'react';

 export const Component = () => {
-  return <div>Old</div>;
+  return <div>New</div>;
 };
```

Tips for success:
- Include 3+ lines of context before and after changes
- Make sure context lines EXACTLY match the current file
- Use line numbers in the @@ header that match the actual file
- If patch fails, fall back to WriteFileTool

If this tool fails twice, use WriteFileTool to replace the entire file.
"""


class DiffPatchTool(ToolDefinition[DiffPatchAction, DiffPatchObservation]):
    """Diff patching tool for surgical file edits."""

    name = "DiffPatchTool"

    @classmethod
    def create(
        cls,
        conv_state,
        terminal_executor: Optional[TerminalExecutor] = None
    ) -> Sequence[ToolDefinition]:
        """Create DiffPatchTool instance.

        Args:
            conv_state: Conversation state for workspace info
            terminal_executor: Optional shared terminal executor

        Returns:
            Sequence containing the tool instance
        """
        working_dir = conv_state.workspace.working_dir

        if terminal_executor is None:
            terminal_executor = TerminalExecutor(working_dir=working_dir)

        executor = DiffPatchExecutor(
            terminal=terminal_executor,
            working_dir=working_dir
        )

        return [
            cls(
                description=_DIFF_PATCH_DESCRIPTION,
                action_type=DiffPatchAction,
                observation_type=DiffPatchObservation,
                executor=executor,
            )
        ]
