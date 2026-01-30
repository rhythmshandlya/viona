"""
Remotion Render Still Tool for OpenHands.

Renders a single frame from a Remotion composition as a PNG image.
Returns the image as ImageContent for the agent to visually inspect.

Auto-regenerates Root.tsx before rendering to ensure compositions are registered.
"""

import base64
import json
import os
import shlex
from collections.abc import Sequence
from typing import Optional

from pydantic import Field


def emit_root_generation_event(success: bool, compositions: int, message: str):
    """Emit a JSON event for Root.tsx generation."""
    event = {
        "type": "root_generation",
        "tool": "RemotionRenderStillTool",
        "success": success,
        "compositions_found": compositions,
        "message": message
    }
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


class RemotionRenderStillAction(Action):
    """Action to render a still frame from a Remotion composition."""

    composition_id: str = Field(
        description="The composition ID to render. This is the ID string from your Composition component (e.g., 'proj-1131d09e' or 'MyAnimation'), NOT a file path. Do NOT use file paths like './src/index.tsx' here."
    )
    frame: int = Field(
        default=0,
        description="Frame number to render (0-indexed)"
    )
    entry_point: str = Field(
        default="src/index.ts",
        description="Entry point file (usually leave as default). The tool handles this automatically."
    )
    output_path: Optional[str] = Field(
        default=None,
        description="Output path for the PNG (auto-generated if not provided)"
    )
    width: int = Field(
        default=1920,
        description="Output width in pixels"
    )
    height: int = Field(
        default=1080,
        description="Output height in pixels"
    )
    timeout: int = Field(
        default=120,
        description="Timeout in seconds for the render command (default 120s, use longer for first render)"
    )


class RemotionRenderStillObservation(Observation):
    """Observation from rendering a still frame."""

    success: bool = Field(default=False, description="Whether rendering succeeded")
    image_path: str = Field(default="", description="Path to the rendered PNG")
    image_base64: str = Field(default="", description="Base64 encoded PNG data")
    frame: int = Field(default=0, description="Frame that was rendered")
    composition_id: str = Field(default="", description="Composition that was rendered")
    errors: list[str] = Field(default_factory=list, description="Error messages")
    raw_output: str = Field(default="", description="Raw command output")

    @property
    def to_llm_content(self) -> Sequence[TextContent | ImageContent]:
        if self.success and self.image_base64:
            # OpenHands SDK expects image_urls with data URLs for base64 images
            data_url = f"data:image/png;base64,{self.image_base64}"
            return [
                TextContent(text=f"Rendered frame {self.frame} of composition '{self.composition_id}'.\n"
                           f"Image path: {self.image_path}\n"
                           f"Review the image below:"),
                ImageContent(
                    type="image",
                    image_urls=[data_url]
                )
            ]
        elif self.success:
            return [TextContent(text=f"Rendered frame {self.frame} to {self.image_path}, but could not load image data.")]

        error_text = "\n".join(f"- {e}" for e in self.errors[:5])
        return [TextContent(text=f"""Failed to render frame {self.frame} of composition '{self.composition_id}'.

Errors:
{error_text}

Common fixes:
- Ensure the composition ID exists and is exported correctly
- Check that the frame number is within the composition duration
- Verify all components render without throwing errors
- Make sure Chromium/Puppeteer dependencies are installed""")]


class RemotionRenderStillExecutor(ToolExecutor[RemotionRenderStillAction, RemotionRenderStillObservation]):
    """Executor that renders a still frame using Remotion."""

    def __init__(self, terminal: TerminalExecutor, working_dir: str = "/workspace"):
        self.terminal = terminal
        self.working_dir = working_dir
        self._first_render_done = False

    def __call__(
        self,
        action: RemotionRenderStillAction,
        conversation=None
    ) -> RemotionRenderStillObservation:
        # Auto-regenerate Root.tsx before rendering to ensure composition is registered
        # This is critical - without this, Remotion won't find newly created compositions
        try:
            from tools.root_generator import generate_and_write_root
            success, message, compositions = generate_and_write_root(self.working_dir)
            emit_root_generation_event(
                success=success,
                compositions=len(compositions),
                message=message
            )
        except Exception as e:
            # Log but don't fail - the render will fail if composition isn't found
            emit_root_generation_event(
                success=False,
                compositions=0,
                message=f"Root.tsx generation failed: {e}"
            )

        # Generate output path if not provided
        output_path = action.output_path
        if not output_path:
            output_path = f"/tmp/remotion_frame_{action.composition_id}_{action.frame}.png"

        # Build remotion still command
        entry_point = os.path.join(self.working_dir, action.entry_point)

        # Remotion 4.0.247+ uses chrome-headless-shell auto-downloaded to node_modules
        # No need to specify browser executable - Remotion finds it automatically
        # Use --log-level=verbose to capture more details on failure
        cmd_parts = [
            "cd", shlex.quote(self.working_dir), "&&",
            "npx", "remotion", "still",
            shlex.quote(entry_point),
            shlex.quote(action.composition_id),
            shlex.quote(output_path),
            "--frame=" + str(action.frame),
            "--log-level=verbose",
        ]

        cmd = " ".join(cmd_parts)

        # First render takes longer due to browser initialization
        # Use longer timeout for first render (180s), shorter for subsequent (120s)
        timeout = action.timeout
        if not self._first_render_done:
            timeout = max(timeout, 180)  # At least 180s for first render

        # Run renderer with stderr captured (2>&1 redirects stderr to stdout)
        # Use timeout command to enforce time limit
        # IMPORTANT: Wrap in bash -c because timeout can't run shell builtins like 'cd'
        full_cmd = f"timeout {timeout}s bash -c {shlex.quote(cmd)} 2>&1"
        result = self.terminal(TerminalAction(command=full_cmd))
        output = result.text if hasattr(result, 'text') else str(result)

        # Mark first render as done (successful or not)
        self._first_render_done = True

        # Extract errors from output
        errors = []
        error_indicators = ["error", "Error", "ERROR", "failed", "Failed", "FAILED", "Cannot", "cannot", "not found", "does not exist", "out of range", "exceeds"]
        for line in output.split("\n"):
            line_stripped = line.strip()
            if line_stripped and any(indicator in line for indicator in error_indicators):
                errors.append(line_stripped)

        # Check if file was created
        check_cmd = f"test -f {shlex.quote(output_path)} && echo 'EXISTS'"
        check_result = self.terminal(TerminalAction(command=check_cmd))
        check_output = check_result.text if hasattr(check_result, 'text') else str(check_result)
        file_exists = "EXISTS" in check_output

        # If file doesn't exist and no errors found, add diagnostic info
        if not file_exists and not errors:
            errors.append(f"Output file was not created at {output_path}")
            errors.append(f"Frame requested: {action.frame}")
            errors.append(f"Composition ID: {action.composition_id}")
            # Include last few lines of output for context
            output_lines = [l.strip() for l in output.split("\n") if l.strip()]
            if output_lines:
                errors.append(f"Remotion output: {' | '.join(output_lines[-5:])}")
            else:
                errors.append("Remotion produced no output - check if composition exists in Root.tsx")

        success = file_exists and len(errors) == 0

        # Read and encode image if successful
        image_base64 = ""
        if success:
            try:
                read_cmd = f"base64 -w 0 {shlex.quote(output_path)}"
                base64_result = self.terminal(TerminalAction(command=read_cmd))
                base64_output = base64_result.text if hasattr(base64_result, 'text') else str(base64_result)
                # Clean up the output:
                # 1. Remove ANSI escape codes (terminal control sequences like \x1b[?2004l)
                # 2. Remove whitespace/newlines
                import re
                # Remove all ANSI escape sequences
                base64_output = re.sub(r'\x1b\[[0-9;?]*[a-zA-Z]', '', base64_output)
                # Remove any non-base64 characters (keep only A-Za-z0-9+/=)
                base64_output = re.sub(r'[^A-Za-z0-9+/=]', '', base64_output)
                image_base64 = base64_output.strip()
            except Exception as e:
                errors.append(f"Could not read image: {str(e)}")

        return RemotionRenderStillObservation(
            success=success,
            image_path=output_path if success else "",
            image_base64=image_base64,
            frame=action.frame,
            composition_id=action.composition_id,
            errors=errors[:10],  # Limit errors
            raw_output=output[:2000]
        )


_REMOTION_RENDER_STILL_DESCRIPTION = """Remotion still frame renderer.

Renders a single frame from a Remotion composition as a PNG image for visual inspection.

Use this tool to:
- Verify the visual output looks correct
- Check text is readable and properly positioned
- Confirm colors and styling match the design
- Detect blank or broken frames

The rendered image is returned as base64-encoded PNG data that you can visually analyze.

Best practice: Render frames at 0% (start), 50% (middle), and 100% (near end) of the
composition to verify the entire video looks correct.

IMPORTANT - Parameters:
- composition_id: The ID string from your <Composition id="..."> component.
  Examples: "proj-1131d09e-3e38-437d-9680-36e02088237b", "MyAnimation", "ExampleTest"
  NOT a file path! Do NOT use paths like "./src/index.tsx" or "src/proj_xxx/index.tsx"
- frame: Frame number to render (0-indexed, based on fps)
- width/height: Output dimensions (default 1920x1080)

Example usage:
  composition_id: "proj-1131d09e-3e38-437d-9680-36e02088237b"  (correct - ID string)
  composition_id: "./src/index.tsx"  (WRONG - this is a file path, not composition ID)
"""


class RemotionRenderStillTool(ToolDefinition[RemotionRenderStillAction, RemotionRenderStillObservation]):
    """Remotion still renderer for visual verification."""

    name = "RemotionRenderStillTool"

    @classmethod
    def create(
        cls,
        conv_state,
        terminal_executor: Optional[TerminalExecutor] = None
    ) -> Sequence[ToolDefinition]:
        """Create RemotionRenderStillTool instance.

        Args:
            conv_state: Conversation state for workspace info
            terminal_executor: Optional shared terminal executor

        Returns:
            Sequence containing the tool instance
        """
        working_dir = conv_state.workspace.working_dir

        if terminal_executor is None:
            terminal_executor = TerminalExecutor(working_dir=working_dir)

        executor = RemotionRenderStillExecutor(
            terminal=terminal_executor,
            working_dir=working_dir
        )

        return [
            cls(
                description=_REMOTION_RENDER_STILL_DESCRIPTION,
                action_type=RemotionRenderStillAction,
                observation_type=RemotionRenderStillObservation,
                executor=executor,
            )
        ]
