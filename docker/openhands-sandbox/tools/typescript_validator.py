"""
TypeScript Validator Tool for OpenHands.

Runs TypeScript compiler in noEmit mode to check for syntax and type errors
without generating output files. Returns structured error information.
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


class TypeScriptValidatorAction(Action):
    """Action to validate TypeScript files."""

    path: str = Field(
        default=".",
        description="Directory or file path to validate (relative to workspace)"
    )
    strict: bool = Field(
        default=True,
        description="Enable strict mode for more thorough checking"
    )


class TypeScriptError:
    """Structured TypeScript error."""

    def __init__(self, file: str, line: int, column: int, code: str, message: str):
        self.file = file
        self.line = line
        self.column = column
        self.code = code
        self.message = message

    def to_dict(self):
        return {
            "file": self.file,
            "line": self.line,
            "column": self.column,
            "code": self.code,
            "message": self.message,
        }

    def __str__(self):
        return f"{self.file}:{self.line}:{self.column} - {self.code}: {self.message}"


class TypeScriptValidatorObservation(Observation):
    """Observation from TypeScript validation."""

    success: bool = Field(default=False, description="Whether validation passed")
    error_count: int = Field(default=0, description="Number of errors found")
    errors: list[dict] = Field(default_factory=list, description="List of errors")
    raw_output: str = Field(default="", description="Raw compiler output")

    @property
    def to_llm_content(self) -> Sequence[TextContent | ImageContent]:
        if self.success:
            return [TextContent(text="TypeScript validation passed. No errors found.")]

        error_list = "\n".join(
            f"- {e['file']}:{e['line']} - {e['code']}: {e['message']}"
            for e in self.errors[:20]  # Limit to first 20 errors
        )

        more = f"\n... and {self.error_count - 20} more errors" if self.error_count > 20 else ""

        return [TextContent(text=f"""TypeScript validation FAILED with {self.error_count} error(s):

{error_list}{more}

Fix these errors before proceeding.""")]


class TypeScriptValidatorExecutor(ToolExecutor[TypeScriptValidatorAction, TypeScriptValidatorObservation]):
    """Executor that runs TypeScript compiler for validation."""

    # Regex to parse TypeScript error output
    # Format: path/file.tsx(line,col): error TS1234: message
    ERROR_PATTERN = re.compile(
        r'^(.+?)\((\d+),(\d+)\):\s+(error)\s+(TS\d+):\s+(.+)$',
        re.MULTILINE
    )

    def __init__(self, terminal: TerminalExecutor, working_dir: str = "/workspace"):
        self.terminal = terminal
        self.working_dir = working_dir

    def __call__(
        self,
        action: TypeScriptValidatorAction,
        conversation=None
    ) -> TypeScriptValidatorObservation:
        # Build tsc command
        path = shlex.quote(os.path.join(self.working_dir, action.path))

        cmd_parts = ["npx", "tsc", "--noEmit", "--pretty", "false"]

        if action.strict:
            cmd_parts.append("--strict")

        # Add project flag if checking a directory
        if os.path.isdir(action.path) or action.path == ".":
            cmd_parts.extend(["--project", path])
        else:
            cmd_parts.append(path)

        cmd = " ".join(cmd_parts)

        # Run TypeScript compiler
        result = self.terminal(TerminalAction(command=cmd))
        output = result.text if hasattr(result, 'text') else str(result)

        # Parse errors
        errors = []
        for match in self.ERROR_PATTERN.finditer(output):
            file_path, line, column, _, code, message = match.groups()
            errors.append(TypeScriptError(
                file=file_path,
                line=int(line),
                column=int(column),
                code=code,
                message=message.strip()
            ).to_dict())

        # Check for success (exit code 0 and no errors)
        success = len(errors) == 0 and "error" not in output.lower()

        return TypeScriptValidatorObservation(
            success=success,
            error_count=len(errors),
            errors=errors,
            raw_output=output[:2000]  # Limit raw output size
        )


_TYPESCRIPT_VALIDATOR_DESCRIPTION = """TypeScript validation tool.

Runs the TypeScript compiler in --noEmit mode to check for:
- Syntax errors
- Type errors
- Import/export issues
- Unused variables (in strict mode)

Use this tool FIRST before attempting to bundle, as it's faster and catches most issues.

Returns structured error information including file, line number, and error message
so you can fix issues precisely.
"""


class TypeScriptValidatorTool(ToolDefinition[TypeScriptValidatorAction, TypeScriptValidatorObservation]):
    """TypeScript validation tool for checking code before bundling."""

    name = "TypeScriptValidatorTool"

    @classmethod
    def create(
        cls,
        conv_state,
        terminal_executor: Optional[TerminalExecutor] = None
    ) -> Sequence[ToolDefinition]:
        """Create TypeScriptValidatorTool instance.

        Args:
            conv_state: Conversation state for workspace info
            terminal_executor: Optional shared terminal executor

        Returns:
            Sequence containing the tool instance
        """
        working_dir = conv_state.workspace.working_dir

        if terminal_executor is None:
            terminal_executor = TerminalExecutor(working_dir=working_dir)

        executor = TypeScriptValidatorExecutor(
            terminal=terminal_executor,
            working_dir=working_dir
        )

        return [
            cls(
                description=_TYPESCRIPT_VALIDATOR_DESCRIPTION,
                action_type=TypeScriptValidatorAction,
                observation_type=TypeScriptValidatorObservation,
                executor=executor,
            )
        ]
