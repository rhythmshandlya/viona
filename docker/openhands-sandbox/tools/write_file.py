"""
WriteFile Tool for OpenHands.

Writes complete file contents to disk, replacing if exists.
This bypasses the str_replace limitation when editing files with duplicate content.
"""

import json
import os
import re
from collections.abc import Sequence
from pathlib import Path
from typing import Optional

from pydantic import Field


def summarize_code_content(content: str, path: str) -> dict:
    """Extract a concise summary of code content for logging."""
    summary = {
        "lines": content.count('\n') + 1,
        "bytes": len(content.encode('utf-8')),
    }

    ext = Path(path).suffix.lower()

    if ext in ('.ts', '.tsx', '.js', '.jsx'):
        # Extract imports
        imports = re.findall(r"import\s+(?:\{([^}]+)\}|(\w+))\s+from\s+['\"]([^'\"]+)['\"]", content)
        if imports:
            summary["imports"] = [m[2] for m in imports[:5]]  # First 5 import sources

        # Extract exports
        exports = re.findall(r"export\s+(?:const|function|class|interface|type)\s+(\w+)", content)
        if exports:
            summary["exports"] = exports[:5]  # First 5 exports

        # Extract component names
        components = re.findall(r"(?:const|function)\s+(\w+).*?React\.FC|:\s*React\.FC", content)
        if components:
            summary["components"] = components[:3]

    elif ext == '.json':
        try:
            data = json.loads(content)
            summary["keys"] = list(data.keys())[:5] if isinstance(data, dict) else f"array[{len(data)}]"
        except json.JSONDecodeError:
            pass

    return summary


def emit_file_event(action: str, path: str, summary: dict, success: bool = True, error: str = None):
    """Emit a concise JSON event for file operations."""
    event = {
        "type": "file_operation",
        "action": action,
        "path": path,
        "success": success,
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


class WriteFileAction(Action):
    """Action to write complete file contents."""

    path: str = Field(
        description="File path relative to workspace (e.g., 'src/MyComponent.tsx')"
    )
    content: str = Field(
        description="Complete file content to write"
    )
    create_directories: bool = Field(
        default=True,
        description="Create parent directories if they don't exist"
    )


class WriteFileObservation(Observation):
    """Observation from file write operation."""

    success: bool = Field(default=False, description="Whether write succeeded")
    path: str = Field(default="", description="Absolute path of written file")
    bytes_written: int = Field(default=0, description="Number of bytes written")
    created_new: bool = Field(default=False, description="Whether file was newly created")
    error: str = Field(default="", description="Error message if failed")

    @property
    def to_llm_content(self) -> Sequence[TextContent | ImageContent]:
        if self.success:
            action = "Created" if self.created_new else "Updated"
            return [TextContent(text=f"""{action} file successfully.

Path: {self.path}
Size: {self.bytes_written} bytes""")]

        return [TextContent(text=f"""Failed to write file.

Error: {self.error}

Check that:
- The path is valid
- You have write permissions
- The content is valid UTF-8""")]


class WriteFileExecutor(ToolExecutor[WriteFileAction, WriteFileObservation]):
    """Executor that writes file contents to disk."""

    def __init__(self, working_dir: str = "/workspace"):
        self.working_dir = working_dir

    def __call__(
        self,
        action: WriteFileAction,
        conversation=None
    ) -> WriteFileObservation:
        try:
            # Resolve full path
            full_path = Path(self.working_dir) / action.path

            # Security check: ensure path is within workspace
            try:
                full_path.resolve().relative_to(Path(self.working_dir).resolve())
            except ValueError:
                return WriteFileObservation(
                    success=False,
                    error=f"Path '{action.path}' is outside workspace"
                )

            # Check if file exists before writing
            created_new = not full_path.exists()

            # Create parent directories if needed
            if action.create_directories:
                full_path.parent.mkdir(parents=True, exist_ok=True)

            # Write content
            content_bytes = action.content.encode('utf-8')
            full_path.write_bytes(content_bytes)

            # Emit concise summary event
            summary = summarize_code_content(action.content, action.path)
            emit_file_event(
                action="create" if created_new else "update",
                path=action.path,
                summary=summary,
                success=True
            )

            return WriteFileObservation(
                success=True,
                path=str(full_path),
                bytes_written=len(content_bytes),
                created_new=created_new
            )

        except PermissionError as e:
            return WriteFileObservation(
                success=False,
                error=f"Permission denied: {e}"
            )
        except OSError as e:
            return WriteFileObservation(
                success=False,
                error=f"OS error: {e}"
            )
        except UnicodeEncodeError as e:
            return WriteFileObservation(
                success=False,
                error=f"Invalid UTF-8 content: {e}"
            )
        except Exception as e:
            return WriteFileObservation(
                success=False,
                error=f"Unexpected error: {type(e).__name__}: {e}"
            )


_WRITE_FILE_DESCRIPTION = """Write complete file contents to disk.

Use this tool when:
- str_replace fails due to "multiple occurrences" error
- You need to create a new file with specific content
- You want to completely replace a file's contents

This tool writes the ENTIRE file content you provide. It will:
- Create parent directories automatically
- Replace existing files if they exist
- Validate the path is within the workspace

Example:
- path: "src/components/MyComponent.tsx"
- content: "import React from 'react';\\n\\nexport const MyComponent = () => <div>Hello</div>;"

IMPORTANT: Provide the COMPLETE file content, not just changes.
"""


class WriteFileTool(ToolDefinition[WriteFileAction, WriteFileObservation]):
    """File writing tool for complete file replacement."""

    name = "WriteFileTool"

    @classmethod
    def create(
        cls,
        conv_state,
        terminal_executor=None  # Not needed but keeps interface consistent
    ) -> Sequence[ToolDefinition]:
        """Create WriteFileTool instance.

        Args:
            conv_state: Conversation state for workspace info
            terminal_executor: Not used, kept for interface consistency

        Returns:
            Sequence containing the tool instance
        """
        working_dir = conv_state.workspace.working_dir

        executor = WriteFileExecutor(working_dir=working_dir)

        return [
            cls(
                description=_WRITE_FILE_DESCRIPTION,
                action_type=WriteFileAction,
                observation_type=WriteFileObservation,
                executor=executor,
            )
        ]
