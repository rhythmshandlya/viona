#!/usr/bin/env python3
"""
OpenHands Visual Generator Agent with Self-Healing and Visual Iteration.

Flow:
1. Generator Phase: Write code, self-heal until ZERO TypeScript errors
2. Visual Evaluation: Capture screenshots at transcript timestamps, evaluate quality
3. Visual Feedback: Create TODO of visual improvements
4. Improvement Phase: Fix visual issues, self-heal any new errors
5. Repeat 2-4 until visual quality passes

The iteration loop is for VISUAL improvements, not fixing compilation errors.
TypeScript errors should be fixed within the generation phase itself.
"""

import argparse
import json
import os
import re
import signal
import subprocess
import sys
from pathlib import Path
from typing import Optional

# Event types for progress tracking
EVENT_STARTED = "started"
EVENT_PHASE_START = "phase_start"
EVENT_TOOL_CALL = "tool_call"
EVENT_TOOL_RESULT = "tool_result"
EVENT_TYPESCRIPT_CHECK = "typescript_check"
EVENT_VISUAL_EVALUATION = "visual_evaluation"
EVENT_ITERATION_COMPLETE = "iteration_complete"
EVENT_LLM_REASONING = "llm_reasoning"
EVENT_COMPLETE = "complete"
EVENT_ERROR = "error"
EVENT_CANCELLED = "cancelled"

# Configuration
MAX_ITERATIONS = 3
QUALITY_THRESHOLD = 70
MAX_SELF_HEAL_ATTEMPTS = 3


def emit_event(event_type: str, **kwargs):
    """Emit a JSON event to stdout for the TypeScript worker to parse."""
    event = {"type": event_type, **kwargs}
    print(json.dumps(event, default=str), flush=True)


def emit_tool_call(tool: str, **kwargs):
    """Emit a tool call event."""
    emit_event(EVENT_TOOL_CALL, tool=tool, **kwargs)


def emit_tool_result(tool: str, success: bool, **kwargs):
    """Emit a tool result event with details."""
    emit_event(EVENT_TOOL_RESULT, tool=tool, success=success, **kwargs)


def emit_error(message: str, error_type: str = "unknown", stack_trace: str = None):
    """Emit an error event with full details."""
    emit_event(
        EVENT_ERROR,
        message=message,
        error_type=error_type,
        stack_trace=stack_trace
    )


def load_skill(skill_path: str) -> str:
    """Load a skill file content."""
    path = Path(skill_path)
    if path.exists():
        return path.read_text(encoding="utf-8")
    return ""


def fix_bundle_paths(bundle_dir: Path) -> bool:
    """
    Fix absolute paths in the Remotion bundle's index.html to be relative.

    Remotion bundle generates paths like `/bundle.js` which resolve to the server root.
    We need `./bundle.js` to resolve relative to the bundle directory.
    """
    index_html = bundle_dir / "index.html"
    if not index_html.exists():
        return False

    try:
        content = index_html.read_text(encoding="utf-8")

        # Fix script and link paths from absolute to relative
        # /bundle.js -> ./bundle.js
        # /favicon.ico -> ./favicon.ico
        # /public -> ./public
        content = content.replace('src="/bundle.js"', 'src="./bundle.js"')
        content = content.replace('href="/favicon.ico"', 'href="./favicon.ico"')
        content = content.replace('"/public"', '"./public"')
        content = content.replace("'/public'", "'./public'")

        index_html.write_text(content, encoding="utf-8")
        return True
    except Exception as e:
        emit_event(EVENT_ERROR, message=f"Failed to fix bundle paths: {e}")
        return False


def run_typescript_check(workspace: str, project_id: str) -> tuple[bool, list[str]]:
    """Run TypeScript compiler and return (success, errors)."""
    emit_tool_call("typescript_check", project_id=project_id)

    try:
        result = subprocess.run(
            ["npx", "tsc", "--noEmit", "--pretty", "false"],
            cwd=workspace,
            capture_output=True,
            text=True,
            timeout=120
        )

        output = result.stdout + result.stderr

        # Parse errors
        errors = []
        for line in output.split('\n'):
            if 'error TS' in line:
                errors.append(line.strip())

        success = result.returncode == 0 and len(errors) == 0

        emit_tool_result(
            "typescript_check",
            success=success,
            error_count=len(errors),
            errors=errors[:10] if errors else []
        )

        return success, errors

    except Exception as e:
        emit_tool_result("typescript_check", success=False, error=str(e))
        return False, [str(e)]


def create_generator_agent(llm, remotion_skill: str, style_skill: str, file_editing_skill: str):
    """Create the generator agent with Remotion skills and file editing tools."""
    from openhands.sdk import Agent, AgentContext, Tool
    from openhands.sdk.context.skills.skill import Skill
    from openhands.sdk.tool import register_tool
    from openhands.tools.file_editor import FileEditorTool
    from openhands.tools.task_tracker import TaskTrackerTool
    from openhands.tools.terminal import TerminalTool, TerminalExecutor

    # Import custom tools
    from tools.write_file import WriteFileTool
    from tools.diff_patch import DiffPatchTool
    from tools.typescript_validator import TypeScriptValidatorTool

    # Register custom file tools with TypeScript validation
    def create_file_tools(conv_state):
        terminal_executor = TerminalExecutor(working_dir=conv_state.workspace.working_dir)
        tools = []
        tools.extend(WriteFileTool.create(conv_state))
        tools.extend(DiffPatchTool.create(conv_state, terminal_executor))
        tools.extend(TypeScriptValidatorTool.create(conv_state, terminal_executor))
        return tools

    register_tool("FileToolSet", create_file_tools)

    skills = []
    if remotion_skill:
        skills.append(Skill(name="remotion-best-practices", content=remotion_skill))
    if style_skill:
        skills.append(Skill(name="visual-design", content=style_skill))
    if file_editing_skill:
        skills.append(Skill(name="file-editing-guide", content=file_editing_skill))

    agent_context = AgentContext(skills=skills) if skills else None

    return Agent(
        llm=llm,
        tools=[
            Tool(name=TerminalTool.name),
            Tool(name=FileEditorTool.name),
            Tool(name=TaskTrackerTool.name),
            Tool(name="FileToolSet"),
        ],
        agent_context=agent_context,
    )


def create_visual_evaluator_agent(llm, scoring_rubric: str):
    """Create the visual evaluator agent focused on screenshot analysis."""
    from openhands.sdk import Agent, AgentContext, Tool
    from openhands.sdk.context.skills.skill import Skill
    from openhands.sdk.tool import register_tool
    from openhands.tools.terminal import TerminalExecutor

    # Import visual evaluation tools
    from tools.remotion_render_still import RemotionRenderStillTool
    from tools.submit_score import SubmitScoreTool

    def create_visual_tools(conv_state):
        terminal_executor = TerminalExecutor(working_dir=conv_state.workspace.working_dir)
        tools = []
        tools.extend(RemotionRenderStillTool.create(conv_state, terminal_executor))
        tools.extend(SubmitScoreTool.create(conv_state))
        return tools

    register_tool("VisualToolSet", create_visual_tools)

    skills = []
    if scoring_rubric:
        skills.append(Skill(name="scoring-rubric", content=scoring_rubric))

    agent_context = AgentContext(skills=skills) if skills else None

    return Agent(
        llm=llm,
        tools=[Tool(name="VisualToolSet")],
        agent_context=agent_context,
    )


def auto_generate_root_tsx(workspace: str, project_id: str) -> bool:
    """Auto-generate Root.tsx from detected compositions.

    This always runs after generation to ensure Root.tsx correctly registers
    the composition. The prompt tells the agent NOT to modify Root.tsx directly,
    so this is the canonical way to update it.
    """
    from tools.root_generator import generate_and_write_root

    emit_tool_call(
        "root_generator",
        message="Auto-generating Root.tsx (always runs to ensure correct composition registration)"
    )

    try:
        success, message, compositions = generate_and_write_root(workspace, project_id)

        if success:
            comp_names = [c.composition_id for c in compositions]
            emit_tool_result(
                "root_generator",
                success=True,
                message=f"Generated Root.tsx with compositions: {', '.join(comp_names)}",
                compositions_found=len(compositions),
                output=message
            )
        else:
            emit_tool_result(
                "root_generator",
                success=False,
                message=f"Root.tsx generation: {message}",
                error=message
            )

        return success
    except Exception as e:
        import traceback
        emit_tool_result(
            "root_generator",
            success=False,
            error=str(e),
            stack_trace=traceback.format_exc()
        )
        return False


def run_generator_with_self_healing(
    agent,
    workspace: str,
    prompt: str,
    project_id: str,
    visual_feedback: Optional[str] = None,
    iteration: int = 1
) -> tuple[bool, str]:
    """
    Run generator with self-healing loop.

    The generator writes code AND validates TypeScript.
    If there are errors, it fixes them before completing.
    Returns (success, message).
    """
    from openhands.sdk import Conversation
    import time

    emit_event(EVENT_PHASE_START, phase="generation", iteration=iteration)

    # Build the prompt with project structure requirements
    # Convert project_id to valid component name (PascalCase, no underscores/hyphens)
    component_name = ''.join(word.capitalize() for word in project_id.replace('-', '_').split('_'))

    agent_context = """
## WHO YOU ARE

You are a Remotion visual generation agent. Your job is to create animated video visuals
using React and the Remotion framework. These visuals will be rendered into actual videos
that accompany spoken content (like podcasts, tutorials, or presentations).

## YOUR END GOAL

Create a working Remotion composition that:
1. Compiles with ZERO TypeScript errors
2. Produces visually appealing animations that match the content
3. Can be bundled and rendered into a video

After you finish, your code will be automatically bundled using `npx remotion bundle`.
If your code has errors or doesn't follow the structure, the bundle will fail and
your work will be wasted. Focus on getting it RIGHT.

## IMPORTANT: UNDERSCORE vs HYPHEN

- Folder names use UNDERSCORES: `src/proj_xxx_xxx/`
- Composition IDs use HYPHENS: `proj-xxx-xxx`
- When running `remotion still`, use HYPHENS in the composition ID

"""

    project_structure = f"""
## PROJECT STRUCTURE REQUIREMENTS - FOLLOW EXACTLY

**Folder name:** src/{project_id}/
**Component name:** {component_name}

You MUST create files in this structure:
```
src/
└── {project_id}/           # YOUR CODE GOES HERE - use this EXACT folder name!
    ├── index.tsx           # Main composition (export as {component_name})
    ├── metadata.json       # Composition config (compositionId: "{project_id.replace('_', '-')}")
    └── components/         # Reusable components (optional)
```

**CRITICAL:**
- Create the folder `src/{project_id}/` (NOT src/Counter, NOT src/MyProject - use EXACT name!)
- Export your main component as: `export const {component_name}: React.FC = () => ...`
- In metadata.json, use compositionId: "{project_id.replace('_', '-')}" (HYPHENS, not underscores!)
- Do NOT edit Root.tsx - it is auto-generated
- When using `remotion still`, the composition ID is: "{project_id.replace('_', '-')}" (with HYPHENS)
"""

    if visual_feedback:
        message = f"""{agent_context}{project_structure}

Improve the visuals based on this feedback:

{visual_feedback}

IMPORTANT:
- Focus on the VISUAL improvements mentioned above
- After making changes, validate TypeScript and fix any errors
- Do NOT finish until TypeScript compiles with ZERO errors

Original task:
{prompt}"""
    else:
        message = f"""{agent_context}{project_structure}

{prompt}

CRITICAL REQUIREMENT - SELF-HEALING:
After writing ALL files, you MUST:
1. Run TypeScriptValidatorTool to check for errors
2. If there are ANY errors, fix them
3. Run TypeScriptValidatorTool again
4. Repeat until ZERO errors

Do NOT finish until TypeScript validation passes with no errors.
This is a hard requirement - code that doesn't compile is unacceptable."""

    emit_tool_call("generator", message="Running self-healing generator", iteration=iteration)

    start_time = time.time()
    conversation = Conversation(agent=agent, workspace=workspace)

    try:
        conversation.send_message(message)
        conversation.run()

        duration_ms = int((time.time() - start_time) * 1000)
        emit_tool_result(
            "generator",
            success=True,
            duration_ms=duration_ms,
            message="Generator completed"
        )
    except Exception as e:
        import traceback
        duration_ms = int((time.time() - start_time) * 1000)
        emit_tool_result(
            "generator",
            success=False,
            duration_ms=duration_ms,
            error=str(e),
            stack_trace=traceback.format_exc()
        )
        return False, str(e)

    # Auto-generate Root.tsx
    auto_generate_root_tsx(workspace, project_id)

    # Verify TypeScript compiles (safety check)
    ts_success, ts_errors = run_typescript_check(workspace, project_id)

    if not ts_success:
        emit_event(
            EVENT_TYPESCRIPT_CHECK,
            success=False,
            message="Generator finished but TypeScript still has errors",
            error_count=len(ts_errors),
            errors=ts_errors[:5]
        )
        # Return with error info - the outer loop can decide to retry
        return False, f"TypeScript errors: {'; '.join(ts_errors[:3])}"

    emit_event(EVENT_TYPESCRIPT_CHECK, success=True, message="TypeScript validation passed")
    return True, "Generation complete with zero errors"


def run_visual_evaluation(
    agent,
    workspace: str,
    project_id: str,
    transcript_segments: list,
    duration_frames: int,
    fps: int
) -> dict:
    """
    Run visual evaluation focused on screenshot analysis.

    Captures screenshots at transcript-aligned timestamps and evaluates:
    - Animation smoothness
    - Visual appeal
    - Style consistency
    - Timing alignment with speech

    Returns score and visual improvement feedback.
    """
    from openhands.sdk import Conversation
    from tools.submit_score import get_last_score, clear_last_score
    import time

    emit_event(EVENT_PHASE_START, phase="visual_evaluation")

    clear_last_score()

    # Try to read actual duration from metadata.json (more reliable than passed value)
    actual_duration = duration_frames
    actual_fps = fps
    metadata_path = Path(workspace) / "src" / project_id / "metadata.json"
    if metadata_path.exists():
        try:
            import json
            metadata = json.loads(metadata_path.read_text())
            if "durationInFrames" in metadata:
                actual_duration = metadata["durationInFrames"]
                emit_event(EVENT_TOOL_CALL, tool="metadata_read",
                           message=f"Read duration from metadata.json: {actual_duration} frames")
            if "fps" in metadata:
                actual_fps = metadata["fps"]
        except Exception as e:
            emit_event(EVENT_TOOL_CALL, tool="metadata_read",
                       message=f"Could not read metadata.json: {e}, using passed duration: {duration_frames}")

    # Calculate frames to capture based on transcript
    frames_to_check = []

    # Cap all frames at actual_duration - 1 to avoid out-of-bounds errors
    max_frame = max(0, actual_duration - 1)

    # Always check start and end
    frames_to_check.append({"frame": 0, "description": "Opening frame"})
    frames_to_check.append({"frame": min(max_frame, max(0, actual_duration - 10)), "description": "Closing frame"})

    # Add frames at transcript segment boundaries
    for segment in transcript_segments[:10]:  # Limit to 10 segments
        start_frame = int((segment.get("startMs", 0) / 1000) * actual_fps)
        mid_frame = int(((segment.get("startMs", 0) + segment.get("endMs", 0)) / 2 / 1000) * actual_fps)

        # Cap frames at max_frame to prevent out-of-bounds
        start_frame = min(start_frame, max_frame)
        mid_frame = min(mid_frame, max_frame)

        if start_frame < actual_duration:
            frames_to_check.append({
                "frame": start_frame,
                "description": f"Segment start: {segment.get('text', '')[:50]}..."
            })
        if mid_frame < actual_duration and mid_frame != start_frame:
            frames_to_check.append({
                "frame": mid_frame,
                "description": f"Segment middle"
            })

    # Deduplicate and sort
    seen_frames = set()
    unique_frames = []
    for f in frames_to_check:
        if f["frame"] not in seen_frames:
            seen_frames.add(f["frame"])
            unique_frames.append(f)
    unique_frames.sort(key=lambda x: x["frame"])

    # Convert project_id to valid composition ID (underscores to hyphens)
    composition_id = project_id.replace('_', '-')

    # Build evaluation prompt
    frames_list = "\n".join([
        f"   - Frame {f['frame']}: {f['description']}"
        for f in unique_frames[:8]  # Limit to 8 frames
    ])

    # Log which frames will be captured for debugging
    emit_event(
        EVENT_TOOL_CALL,
        tool="visual_evaluation_setup",
        composition_id=composition_id,
        actual_duration=actual_duration,
        passed_duration=duration_frames,
        fps=actual_fps,
        frames_to_capture=[f['frame'] for f in unique_frames[:8]],
        message=f"Will capture {len(unique_frames[:8])} frames from composition '{composition_id}' (actual duration: {actual_duration} frames, passed: {duration_frames})"
    )

    eval_prompt = f"""Evaluate the visual quality of the Remotion composition.

The code has already been verified to compile with ZERO TypeScript errors.
Your job is to evaluate VISUAL QUALITY only.

## Steps:

1. **Capture Screenshots** using RemotionRenderStillTool:
   composition_id: "{composition_id}"
   Frames to capture:
{frames_list}

2. **Evaluate Each Screenshot** for:
   - Animation smoothness (do transitions look professional?)
   - Visual appeal (is it visually pleasing?)
   - Style consistency (does it match the requested style?)
   - Text readability (is text clear and legible?)
   - Timing (does content appear at appropriate moments?)

3. **Create Improvement TODO** - List specific visual improvements:
   - "Fade transition at frame X is too abrupt, use longer duration"
   - "Text at frame Y is too small, increase font size to 48px"
   - "Color contrast is poor in frame Z, use darker background"
   - etc.

4. **Submit Score** using SubmitScoreTool:
   - visual_quality (0-70): The MAIN score - how good do the visuals look?
   - correctness (10): Full points - code compiles
   - completeness (0-10): Are all transcript segments covered?
   - code_quality (10): Full points - assume good
   - issues: List of specific visual problems found
   - suggestion: Detailed TODO for visual improvements

Focus on VISUAL QUALITY. The code works - we're evaluating how good it LOOKS."""

    emit_tool_call("visual_evaluator", message="Running visual evaluation")
    start_time = time.time()

    # Retry logic for LLM failures (empty responses, rate limits, etc.)
    max_retries = 3
    retry_delay = 5  # seconds
    last_error = None

    for attempt in range(max_retries):
        try:
            conversation = Conversation(agent=agent, workspace=workspace)
            conversation.send_message(eval_prompt)
            conversation.run()
            duration_ms = int((time.time() - start_time) * 1000)
            break  # Success - exit retry loop
        except Exception as e:
            last_error = e
            error_str = str(e).lower()

            # Check if it's a retryable error (empty response, rate limit, timeout)
            is_retryable = any(indicator in error_str for indicator in [
                "empty", "choices", "rate", "limit", "timeout", "429", "503", "overloaded"
            ])

            if is_retryable and attempt < max_retries - 1:
                emit_event(
                    EVENT_TOOL_CALL,
                    tool="visual_evaluator_retry",
                    attempt=attempt + 1,
                    max_retries=max_retries,
                    error=str(e),
                    message=f"LLM returned error, retrying in {retry_delay}s (attempt {attempt + 1}/{max_retries})"
                )
                time.sleep(retry_delay)
                retry_delay *= 2  # Exponential backoff
                continue
            else:
                # Non-retryable error or max retries reached
                emit_tool_result("visual_evaluator", success=False, error=str(e))
                return {
                    "score": 20,  # Low score but not zero since code compiles
                    "visual_quality": 0,
                    "correctness": 10,
                    "completeness": 5,
                    "code_quality": 5,
                    "issues": [f"Visual evaluation failed after {attempt + 1} attempts: {str(e)}"],
                    "suggestion": "LLM API issues - check API key, quota, and model availability"
                }
    else:
        # All retries exhausted
        emit_tool_result("visual_evaluator", success=False, error=str(last_error))
        return {
            "score": 20,
            "visual_quality": 0,
            "correctness": 10,
            "completeness": 5,
            "code_quality": 5,
            "issues": [f"Visual evaluation failed after {max_retries} retries: {str(last_error)}"],
            "suggestion": "LLM API consistently failing - check service status"
        }

    # Get score from SubmitScoreTool
    score_result = get_last_score()

    if score_result is None:
        # Fallback
        score_result = {
            "score": 30,
            "visual_quality": 10,
            "correctness": 10,
            "completeness": 5,
            "code_quality": 5,
            "issues": ["Could not parse visual evaluation"],
            "suggestion": "Review screenshots manually"
        }

    emit_event(
        EVENT_VISUAL_EVALUATION,
        score=score_result.get("score", 0),
        visual_quality=score_result.get("visual_quality", 0),
        issues=score_result.get("issues", []),
        suggestion=score_result.get("suggestion", ""),
        duration_ms=duration_ms
    )

    return score_result


def main():
    parser = argparse.ArgumentParser(description="OpenHands Visual Generator with Self-Healing")
    parser.add_argument("--workspace", default=os.environ.get("REMOTION_PROJECT_DIR", "/opt/remotion-template"),
                        help="Path to Remotion project (default: $REMOTION_PROJECT_DIR)")
    parser.add_argument("--output-dir", default="/output", help="Directory to copy source files (mounted from host)")
    parser.add_argument("--bundle-dir", default="/bundles", help="Directory to export bundle (mounted from host)")
    parser.add_argument("--project-id", required=True, help="Composition ID")
    parser.add_argument("--model", required=True, help="LLM model to use")
    parser.add_argument("--prompt-file", required=True, help="Path to prompt file")
    parser.add_argument("--api-key-env", default="LLM_API_KEY", help="Env var for API key")
    parser.add_argument("--duration-frames", type=int, default=900, help="Video duration in frames")
    parser.add_argument("--fps", type=int, default=30, help="Video FPS")
    parser.add_argument("--max-iterations", type=int, default=MAX_ITERATIONS, help="Max visual improvement iterations")
    parser.add_argument("--quality-threshold", type=int, default=QUALITY_THRESHOLD, help="Quality score threshold")
    args = parser.parse_args()

    # Get API key based on model provider
    api_key = os.environ.get(args.api_key_env)
    if not api_key:
        # Detect provider from model string
        model_lower = args.model.lower()
        if model_lower.startswith("openrouter/") or "openrouter" in model_lower:
            api_key = os.environ.get("OPENROUTER_API_KEY")
        elif "gemini" in model_lower:
            api_key = os.environ.get("GEMINI_API_KEY")
        elif "claude" in model_lower or "anthropic" in model_lower:
            api_key = os.environ.get("ANTHROPIC_API_KEY")
        elif "gpt" in model_lower or "openai" in model_lower:
            api_key = os.environ.get("OPENAI_API_KEY")
        else:
            # Fallback: try all keys
            api_key = (
                os.environ.get("OPENROUTER_API_KEY") or
                os.environ.get("GEMINI_API_KEY") or
                os.environ.get("ANTHROPIC_API_KEY") or
                os.environ.get("OPENAI_API_KEY")
            )

    if not api_key:
        emit_event(EVENT_ERROR, message=f"Missing API key for model {args.model}")
        sys.exit(1)

    # Read prompt
    prompt_path = Path(args.prompt_file)
    if not prompt_path.exists():
        emit_event(EVENT_ERROR, message=f"Prompt file not found: {args.prompt_file}")
        sys.exit(1)

    prompt = prompt_path.read_text(encoding="utf-8")

    # Extract transcript segments from prompt for screenshot timing
    transcript_segments = []
    for line in prompt.split('\n'):
        # Parse lines like "[0:05 - 0:12] Some text here"
        match = re.match(r'\[(\d+):(\d+)\s*-\s*(\d+):(\d+)\]\s*(.+)', line)
        if match:
            start_min, start_sec, end_min, end_sec, text = match.groups()
            transcript_segments.append({
                "startMs": (int(start_min) * 60 + int(start_sec)) * 1000,
                "endMs": (int(end_min) * 60 + int(end_sec)) * 1000,
                "text": text
            })

    # Import OpenHands
    try:
        from pydantic import SecretStr
        from openhands.sdk import LLM
    except ImportError as e:
        emit_event(EVENT_ERROR, message=f"Failed to import OpenHands: {e}")
        sys.exit(1)

    emit_event(EVENT_STARTED, model=args.model, workspace=args.workspace, max_iterations=args.max_iterations)

    # Cancellation handling
    cancelled = False

    def handle_sigterm(signum, frame):
        nonlocal cancelled
        cancelled = True
        emit_event(EVENT_CANCELLED, message="Received SIGTERM")
        sys.exit(0)

    signal.signal(signal.SIGTERM, handle_sigterm)
    signal.signal(signal.SIGINT, handle_sigterm)

    try:
        # Configure LLM model name
        model_lower = args.model.lower()
        if args.model.startswith("openrouter/") or "/" in args.model:
            # Already has provider prefix (e.g., openrouter/google/gemini-2.0-flash)
            model_name = args.model
        elif "gemini" in model_lower:
            model_name = f"gemini/{args.model}"
        elif "claude" in model_lower:
            model_name = f"anthropic/{args.model}"
        elif "gpt" in model_lower:
            model_name = f"openai/{args.model}"
        else:
            model_name = args.model

        llm = LLM(
            model=model_name,
            api_key=SecretStr(api_key),
        )

        # Load skills
        skills_dir = Path(__file__).parent / "skills"
        remotion_skill = load_skill(skills_dir / "remotion-best-practices.md")
        style_skill = load_skill(skills_dir / "visual-design.md")
        scoring_rubric = load_skill(skills_dir / "scoring-rubric.md")
        file_editing_skill = load_skill(skills_dir / "file-editing-guide.md")

        # Create agents
        generator_agent = create_generator_agent(llm, remotion_skill, style_skill, file_editing_skill)
        visual_evaluator = create_visual_evaluator_agent(llm, scoring_rubric)

        # State tracking
        best_score = 0
        best_iteration = 0
        visual_feedback = None
        final_status = "failed"

        for iteration in range(args.max_iterations):
            if cancelled:
                break

            emit_event(EVENT_PHASE_START, phase="iteration", iteration=iteration + 1, max_iterations=args.max_iterations)

            # ===== PHASE 1: Generate with self-healing =====
            gen_success, gen_message = run_generator_with_self_healing(
                generator_agent,
                args.workspace,
                prompt,
                args.project_id,
                visual_feedback,
                iteration=iteration + 1
            )

            if cancelled:
                break

            if not gen_success:
                # Generator failed to produce error-free code
                # This shouldn't happen often with self-healing
                emit_event(
                    EVENT_ITERATION_COMPLETE,
                    iteration=iteration + 1,
                    score=0,
                    issues=[gen_message],
                    suggestion="Generator failed to self-heal TypeScript errors"
                )
                # Try again in next iteration with feedback
                visual_feedback = f"CRITICAL: Code did not compile. Error: {gen_message}\nFix all TypeScript errors before proceeding."
                continue

            # ===== PHASE 2: Visual evaluation =====
            score_result = run_visual_evaluation(
                visual_evaluator,
                args.workspace,
                args.project_id,
                transcript_segments,
                args.duration_frames,
                args.fps
            )

            current_score = score_result.get("score", 0)

            # Track best
            if current_score > best_score:
                best_score = current_score
                best_iteration = iteration + 1

            emit_event(
                EVENT_ITERATION_COMPLETE,
                iteration=iteration + 1,
                score=current_score,
                visual_quality=score_result.get("visual_quality", 0),
                issues=score_result.get("issues", []),
                suggestion=score_result.get("suggestion", ""),
                threshold=args.quality_threshold,
            )

            # ===== PHASE 3: Check if done =====
            if current_score >= args.quality_threshold:
                final_status = "passed"
                break

            # ===== PHASE 4: Prepare visual feedback for next iteration =====
            issues_list = '\n'.join([f"- {issue}" for issue in score_result.get("issues", [])])
            visual_feedback = f"""Visual Quality Score: {current_score}/100 (need {args.quality_threshold} to pass)
Visual Quality: {score_result.get('visual_quality', 0)}/70

## Issues Found (TODO - fix these):
{issues_list}

## Suggestion:
{score_result.get('suggestion', 'Improve visual quality of animations and transitions.')}

Focus on improving the VISUAL quality - the code compiles fine."""

        # Count files
        project_dir = Path(args.workspace) / "src" / args.project_id
        files_written = 0
        if project_dir.exists():
            files_written = len([f for f in project_dir.glob("**/*") if f.is_file()])

        if final_status != "passed" and best_score > 0:
            final_status = "completed_with_warnings"

        # Copy generated files to output directory (mounted from host)
        output_dir = Path(args.output_dir)
        if output_dir.exists():
            project_src = Path(args.workspace) / "src" / args.project_id
            output_project = output_dir / args.project_id

            if project_src.exists():
                import shutil
                # Clean up any existing output
                if output_project.exists():
                    shutil.rmtree(output_project)
                # Copy generated project to output
                shutil.copytree(project_src, output_project)
                emit_event(EVENT_TOOL_CALL, tool="export", message=f"Exported source to {output_project}")
            else:
                emit_event(EVENT_TOOL_CALL, tool="export", message="No project directory found to export", success=False)

        # =================================================================
        # BUNDLE THE PROJECT - This is the agent's END GOAL
        # The agent cannot exit successfully without a working bundle
        # =================================================================
        bundle_success = False
        bundle_dir = Path(args.bundle_dir)

        # Convert project_id to composition ID (underscores to dashes)
        composition_id = args.project_id.replace('_', '-')

        if project_dir.exists() and bundle_dir.exists():
            emit_event(EVENT_PHASE_START, phase="bundling", message="Creating Remotion bundle...")

            try:
                # Run remotion bundle command
                bundle_output = bundle_dir / composition_id

                # Clean up any existing bundle
                if bundle_output.exists():
                    import shutil
                    shutil.rmtree(bundle_output)

                emit_tool_call("remotion_bundle", composition_id=composition_id)

                bundle_cmd = [
                    "npx", "remotion", "bundle",
                    "src/index.ts",
                    f"--out-dir={bundle_output}",
                    "--log-level=verbose",
                ]

                result = subprocess.run(
                    bundle_cmd,
                    cwd=args.workspace,
                    capture_output=True,
                    text=True,
                    timeout=300  # 5 minute timeout for bundling
                )

                # Log output for debugging regardless of return code
                emit_event(
                    EVENT_TOOL_CALL,
                    tool="remotion_bundle_output",
                    returncode=result.returncode,
                    stdout=result.stdout[:1000] if result.stdout else "",
                    stderr=result.stderr[:1000] if result.stderr else ""
                )

                if result.returncode == 0:
                    # Verify bundle was created
                    bundle_index = bundle_output / "index.html"

                    # List what files were actually created for debugging
                    if bundle_output.exists():
                        created_files = list(bundle_output.glob("*"))
                        emit_event(
                            EVENT_TOOL_CALL,
                            tool="remotion_bundle_files",
                            message=f"Files in bundle dir: {[f.name for f in created_files[:20]]}"
                        )

                    if bundle_index.exists():
                        bundle_success = True
                        # Fix absolute paths in index.html to be relative
                        fix_bundle_paths(bundle_output)
                        emit_tool_result(
                            "remotion_bundle",
                            success=True,
                            message=f"Bundle created at {bundle_output}",
                            bundle_path=str(bundle_output)
                        )
                    else:
                        # Check if bundle is in a subdirectory
                        for subdir in bundle_output.iterdir() if bundle_output.exists() else []:
                            if subdir.is_dir() and (subdir / "index.html").exists():
                                bundle_success = True
                                # Fix absolute paths in index.html to be relative
                                fix_bundle_paths(subdir)
                                emit_tool_result(
                                    "remotion_bundle",
                                    success=True,
                                    message=f"Bundle found in subdirectory {subdir}",
                                    bundle_path=str(subdir)
                                )
                                break
                        if not bundle_success:
                            emit_tool_result(
                                "remotion_bundle",
                                success=False,
                                error="Bundle directory created but index.html not found",
                                bundle_dir_exists=bundle_output.exists(),
                                files_found=[f.name for f in bundle_output.glob("*")][:10] if bundle_output.exists() else []
                            )
                else:
                    emit_tool_result(
                        "remotion_bundle",
                        success=False,
                        error=result.stderr[:500] if result.stderr else "Unknown bundling error",
                        stdout=result.stdout[:500] if result.stdout else "",
                        exit_code=result.returncode
                    )

            except subprocess.TimeoutExpired:
                emit_tool_result("remotion_bundle", success=False, error="Bundling timed out after 5 minutes")
            except Exception as e:
                emit_tool_result("remotion_bundle", success=False, error=str(e))
        else:
            if not project_dir.exists():
                emit_event(EVENT_ERROR, message="Cannot bundle: project directory not found")
            if not bundle_dir.exists():
                emit_event(EVENT_ERROR, message="Cannot bundle: bundle directory not mounted")

        # Update final status based on bundling result
        if not bundle_success:
            final_status = "bundle_failed"

        # RENDER VIDEO from the bundle
        video_url = None
        if bundle_success:
            emit_event(EVENT_PHASE_START, phase="rendering", message="Rendering video from bundle...")

            try:
                video_output_dir = bundle_dir / composition_id
                video_output_path = video_output_dir / "video.mp4"
                bundle_path = bundle_dir / composition_id

                emit_tool_call("remotion_render", composition_id=composition_id)

                render_cmd = [
                    "npx", "remotion", "render",
                    str(bundle_path),  # Bundle path (directory with index.html)
                    composition_id,     # Composition ID
                    str(video_output_path),  # Output video path
                    "--log-level=verbose",
                ]

                render_result = subprocess.run(
                    render_cmd,
                    cwd=args.workspace,
                    capture_output=True,
                    text=True,
                    timeout=600  # 10 minute timeout for rendering
                )

                emit_event(
                    EVENT_TOOL_CALL,
                    tool="remotion_render_output",
                    returncode=render_result.returncode,
                    stdout=render_result.stdout[:1000] if render_result.stdout else "",
                    stderr=render_result.stderr[:1000] if render_result.stderr else ""
                )

                if render_result.returncode == 0 and video_output_path.exists():
                    video_url = f"/bundles/{composition_id}/video.mp4"
                    emit_tool_result(
                        "remotion_render",
                        success=True,
                        message=f"Video rendered successfully",
                        video_path=str(video_output_path),
                        video_url=video_url
                    )
                else:
                    emit_tool_result(
                        "remotion_render",
                        success=False,
                        error=render_result.stderr[:500] if render_result.stderr else "Render failed",
                        video_exists=video_output_path.exists()
                    )

            except subprocess.TimeoutExpired:
                emit_tool_result("remotion_render", success=False, error="Rendering timed out after 10 minutes")
            except Exception as e:
                emit_tool_result("remotion_render", success=False, error=str(e))

        emit_event(
            EVENT_COMPLETE,
            status=final_status,
            final_score=best_score,
            best_iteration=best_iteration,
            total_iterations=min(iteration + 1, args.max_iterations) if 'iteration' in dir() else 0,
            files_written=files_written,
            video_url=video_url,
            threshold=args.quality_threshold,
            bundle_success=bundle_success,
            bundle_path=str(bundle_dir / composition_id) if bundle_success else None,
        )

    except Exception as e:
        import traceback
        emit_error(
            message=str(e),
            error_type=type(e).__name__,
            stack_trace=traceback.format_exc()
        )
        sys.exit(1)


if __name__ == "__main__":
    main()
