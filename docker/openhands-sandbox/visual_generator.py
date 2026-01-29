#!/usr/bin/env python3
"""
OpenHands Visual Generator Agent with Iterative Refinement.

Generates Remotion visuals using OpenHands SDK with a feedback loop:
1. Generator agent creates code
2. Critic agent validates and scores
3. If score < threshold, feed critique back and iterate
4. Max 3 iterations, return best attempt

Based on OpenHands SDK iterative refinement pattern:
https://docs.openhands.dev/sdk/guides/iterative-refinement
"""

import argparse
import json
import os
import re
import signal
import sys
from pathlib import Path
from typing import Optional

# Event types for progress tracking
EVENT_STARTED = "started"
EVENT_ITERATION_START = "iteration_start"
EVENT_TOOL_CALL = "tool_call"
EVENT_TOOL_RESULT = "tool_result"
EVENT_ITERATION_COMPLETE = "iteration_complete"
EVENT_CRITIC_RESULT = "critic_result"
EVENT_VALIDATION_ERROR = "validation_error"
EVENT_LLM_REASONING = "llm_reasoning"
EVENT_COMPLETE = "complete"
EVENT_ERROR = "error"
EVENT_CANCELLED = "cancelled"

# Configuration
MAX_ITERATIONS = 3
QUALITY_THRESHOLD = 90


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


def emit_validation_error(validation_type: str, errors: list):
    """Emit a validation error event."""
    emit_event(
        EVENT_VALIDATION_ERROR,
        validation_type=validation_type,
        errors=errors
    )


def load_skill(skill_path: str) -> str:
    """Load a skill file content."""
    path = Path(skill_path)
    if path.exists():
        return path.read_text(encoding="utf-8")
    return ""


def parse_critic_score(response: str) -> dict:
    """Parse the critic's JSON score from the response."""
    # Try to find JSON in the response
    json_match = re.search(r'\{[^{}]*"score"[^{}]*\}', response, re.DOTALL)
    if json_match:
        try:
            return json.loads(json_match.group())
        except json.JSONDecodeError:
            pass

    # Try to find a more complex JSON object
    try:
        # Find the last JSON object in the response
        json_objects = re.findall(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', response, re.DOTALL)
        for obj in reversed(json_objects):
            try:
                parsed = json.loads(obj)
                if "score" in parsed:
                    return parsed
            except json.JSONDecodeError:
                continue
    except Exception:
        pass

    # Return default failed score
    return {
        "score": 0,
        "breakdown": {"correctness": 0, "completeness": 0, "visualQuality": 0, "codeQuality": 0},
        "issues": ["Could not parse critic response"],
        "suggestion": "Review the generated code manually"
    }


def create_generator_agent(llm, remotion_skill: str, style_skill: str, file_editing_skill: str):
    """Create the generator agent with Remotion skills and file editing tools."""
    from openhands.sdk import Agent, AgentContext, Tool
    from openhands.sdk.context.skills.skill import Skill
    from openhands.sdk.tool import register_tool
    from openhands.tools.file_editor import FileEditorTool
    from openhands.tools.task_tracker import TaskTrackerTool
    from openhands.tools.terminal import TerminalTool, TerminalExecutor

    # Import custom file editing tools
    from tools.write_file import WriteFileTool
    from tools.diff_patch import DiffPatchTool

    # Register custom file tools
    def create_file_tools(conv_state):
        terminal_executor = TerminalExecutor(working_dir=conv_state.workspace.working_dir)
        tools = []
        tools.extend(WriteFileTool.create(conv_state))
        tools.extend(DiffPatchTool.create(conv_state, terminal_executor))
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
            Tool(name="FileToolSet"),  # Custom tools for reliable file editing
        ],
        agent_context=agent_context,
    )


def create_critic_agent(llm, scoring_rubric: str):
    """Create the critic agent with validation tools and scoring rubric."""
    from openhands.sdk import Agent, AgentContext, Tool
    from openhands.sdk.context.skills.skill import Skill
    from openhands.sdk.tool import register_tool
    from openhands.tools.terminal import TerminalExecutor

    # Import and register custom tools
    from tools.typescript_validator import TypeScriptValidatorTool
    from tools.remotion_bundle import RemotionBundleTool
    from tools.remotion_render_still import RemotionRenderStillTool
    from tools.submit_score import SubmitScoreTool

    # Create a shared terminal executor factory
    def create_validation_tools(conv_state):
        terminal_executor = TerminalExecutor(working_dir=conv_state.workspace.working_dir)
        tools = []
        tools.extend(TypeScriptValidatorTool.create(conv_state, terminal_executor))
        tools.extend(RemotionBundleTool.create(conv_state, terminal_executor))
        tools.extend(RemotionRenderStillTool.create(conv_state, terminal_executor))
        tools.extend(SubmitScoreTool.create(conv_state))  # Add score submission tool
        return tools

    register_tool("ValidationToolSet", create_validation_tools)

    skills = []
    if scoring_rubric:
        skills.append(Skill(name="scoring-rubric", content=scoring_rubric))

    agent_context = AgentContext(skills=skills) if skills else None

    return Agent(
        llm=llm,
        tools=[Tool(name="ValidationToolSet")],
        agent_context=agent_context,
    )


def auto_generate_root_tsx(workspace: str, project_id: str) -> bool:
    """Auto-generate Root.tsx from detected compositions."""
    from tools.root_generator import generate_and_write_root

    emit_tool_call("root_generator", message="Auto-generating Root.tsx")

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


def run_generator(agent, workspace: str, prompt: str, project_id: str, critique: Optional[str] = None, iteration: int = 1) -> str:
    """Run the generator agent and return the conversation result."""
    from openhands.sdk import Conversation
    import time

    conversation = Conversation(agent=agent, workspace=workspace)

    if critique:
        message = f"""Previous attempt had issues. Fix them based on this feedback:

{critique}

Original task:
{prompt}"""
    else:
        message = prompt

    emit_tool_call("generator", message="Running generator agent", iteration=iteration)

    start_time = time.time()

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
        raise

    # Auto-generate Root.tsx after agent completes
    # This fixes the most common failure point (editing Root.tsx with duplicates)
    auto_generate_root_tsx(workspace, project_id)

    # Return last agent message
    return "Generation complete"


def run_critic(agent, workspace: str, project_id: str, duration_frames: int, fps: int, threshold: int = QUALITY_THRESHOLD) -> dict:
    """Run the critic agent and return the score."""
    from openhands.sdk import Conversation
    from tools.submit_score import get_last_score, clear_last_score
    import time

    # Clear any previous score
    clear_last_score()

    conversation = Conversation(agent=agent, workspace=workspace)

    # Calculate frames to check (start, middle, end)
    mid_frame = duration_frames // 2
    end_frame = max(0, duration_frames - 10)

    critic_prompt = f"""Evaluate the Remotion project at src/{project_id}/.

Follow these steps to evaluate the visual generation:

1. **TypeScript Validation**: Run TypeScriptValidatorTool on path "src/{project_id}"
2. **Bundle Validation**: Run RemotionBundleTool with entry_point="src/index.ts"
3. **Visual Inspection**: Run RemotionRenderStillTool for composition_id="{project_id}" at frames:
   - Frame 0 (start)
   - Frame {mid_frame} (middle)
   - Frame {end_frame} (near end)
4. **Check metadata.json** in src/{project_id}/ for completeness
5. **Review the code** for Remotion best practices

IMPORTANT: After running all validations, you MUST call SubmitScoreTool to submit your evaluation score.
Do NOT just output JSON - you MUST use the SubmitScoreTool tool with your score.

SCORING WEIGHTS (total = 100):
- visual_quality (0-70): 70% weight - MOST IMPORTANT!
  * Are animations smooth and well-timed?
  * Is it visually appealing and professional?
  * Does it match the requested style?
  * Do the screenshots look good?
- correctness (0-10): 10% weight - TypeScript compiles, no runtime errors
- completeness (0-10): 10% weight - All required files present, metadata.json complete
- code_quality (0-10): 10% weight - Clean code, follows Remotion best practices

Focus primarily on VISUAL QUALITY when scoring! The animations must look great."""

    emit_tool_call("critic", message="Running critic agent")
    start_time = time.time()

    try:
        conversation.send_message(critic_prompt)
        conversation.run()
        duration_ms = int((time.time() - start_time) * 1000)
    except Exception as e:
        emit_tool_result("critic", success=False, error=str(e))
        return {
            "score": 0,
            "breakdown": {"correctness": 0, "completeness": 0, "visualQuality": 0, "codeQuality": 0},
            "issues": [f"Critic agent failed: {str(e)}"],
            "suggestion": "Check agent logs for details"
        }

    # Get the score from the SubmitScoreTool
    score_result = get_last_score()

    if score_result is None:
        emit_event("debug", message="SubmitScoreTool was not called by critic agent")

        # Fallback: try to parse score from conversation events
        response = ""
        try:
            if hasattr(conversation, 'state') and hasattr(conversation.state, 'events'):
                for event in reversed(conversation.state.events):
                    content = getattr(event, 'content', None) or getattr(event, 'message', None) or getattr(event, 'text', None)
                    if content and '"score"' in str(content):
                        response = str(content)
                        break
        except Exception:
            pass

        score_result = parse_critic_score(response)
        emit_event("debug", fallback_parsing=True, response_length=len(response))

    # Emit detailed critic result
    emit_event(
        EVENT_CRITIC_RESULT,
        score=score_result.get("score", 0),
        threshold=threshold,
        breakdown=score_result.get("breakdown", {}),
        issues=score_result.get("issues", []),
        suggestion=score_result.get("suggestion", ""),
        duration_ms=duration_ms,
    )

    return score_result


def main():
    parser = argparse.ArgumentParser(description="OpenHands Visual Generator with Iterative Refinement")
    parser.add_argument("--workspace", required=True, help="Path to Remotion project")
    parser.add_argument("--project-id", required=True, help="Composition ID")
    parser.add_argument("--model", required=True, help="LLM model to use")
    parser.add_argument("--prompt-file", required=True, help="Path to prompt file")
    parser.add_argument("--api-key-env", default="LLM_API_KEY", help="Env var for API key")
    parser.add_argument("--duration-frames", type=int, default=900, help="Video duration in frames")
    parser.add_argument("--fps", type=int, default=30, help="Video FPS")
    parser.add_argument("--max-iterations", type=int, default=MAX_ITERATIONS, help="Max refinement iterations")
    parser.add_argument("--quality-threshold", type=int, default=QUALITY_THRESHOLD, help="Quality score threshold")
    args = parser.parse_args()

    # Get API key from environment
    api_key = os.environ.get(args.api_key_env)
    if not api_key:
        api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("OPENAI_API_KEY")

    if not api_key:
        emit_event(EVENT_ERROR, message=f"Missing API key in {args.api_key_env} or provider-specific env vars")
        sys.exit(1)

    # Read prompt from file
    prompt_path = Path(args.prompt_file)
    if not prompt_path.exists():
        emit_event(EVENT_ERROR, message=f"Prompt file not found: {args.prompt_file}")
        sys.exit(1)

    prompt = prompt_path.read_text(encoding="utf-8")

    # Import OpenHands
    try:
        from pydantic import SecretStr
        from openhands.sdk import LLM
    except ImportError as e:
        emit_event(EVENT_ERROR, message=f"Failed to import OpenHands: {e}")
        sys.exit(1)

    emit_event(EVENT_STARTED, model=args.model, workspace=args.workspace, max_iterations=args.max_iterations)

    # Track state for graceful cancellation
    cancelled = False

    def handle_sigterm(signum, frame):
        nonlocal cancelled
        cancelled = True
        emit_event(EVENT_CANCELLED, message="Received SIGTERM")
        sys.exit(0)

    signal.signal(signal.SIGTERM, handle_sigterm)
    signal.signal(signal.SIGINT, handle_sigterm)

    try:
        # Determine model name for litellm
        model_lower = args.model.lower()
        if "gemini" in model_lower:
            model_name = f"gemini/{args.model}"
        elif "claude" in model_lower:
            model_name = f"anthropic/{args.model}"
        elif "gpt" in model_lower:
            model_name = f"openai/{args.model}"
        else:
            model_name = args.model

        # Configure LLM
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
        critic_agent = create_critic_agent(llm, scoring_rubric)

        # Iterative refinement loop
        best_score = 0
        best_iteration = 0
        critique_feedback = None
        final_status = "failed"

        for iteration in range(args.max_iterations):
            if cancelled:
                break

            emit_event(EVENT_ITERATION_START, iteration=iteration + 1, max_iterations=args.max_iterations)

            # Phase 1: Generate code
            run_generator(
                generator_agent,
                args.workspace,
                prompt,
                args.project_id,
                critique_feedback,
                iteration=iteration + 1
            )

            if cancelled:
                break

            # Phase 2: Critic evaluates
            score_result = run_critic(
                critic_agent,
                args.workspace,
                args.project_id,
                args.duration_frames,
                args.fps,
                threshold=args.quality_threshold
            )

            current_score = score_result.get("score", 0)

            # Track best attempt
            if current_score > best_score:
                best_score = current_score
                best_iteration = iteration + 1

            emit_event(
                EVENT_ITERATION_COMPLETE,
                iteration=iteration + 1,
                score=current_score,
                breakdown=score_result.get("breakdown", {}),
                issues=score_result.get("issues", []),
                suggestion=score_result.get("suggestion", ""),
                threshold=args.quality_threshold,
            )

            # Phase 3: Decision
            if current_score >= args.quality_threshold:
                final_status = "passed"
                break

            # Prepare feedback for next iteration
            critique_feedback = f"""Score: {current_score}/100 (need {args.quality_threshold} to pass)

Issues found:
{chr(10).join('- ' + issue for issue in score_result.get('issues', []))}

Suggestion:
{score_result.get('suggestion', 'Review and fix the issues above.')}"""

        # Count generated files
        project_dir = Path(args.workspace) / "src" / args.project_id
        files_written = 0
        if project_dir.exists():
            files_written = len([f for f in project_dir.glob("**/*") if f.is_file()])

        # Determine final status
        if final_status != "passed" and best_score > 0:
            final_status = "completed_with_warnings"

        emit_event(
            EVENT_COMPLETE,
            status=final_status,
            final_score=best_score,
            best_iteration=best_iteration,
            total_iterations=min(iteration + 1, args.max_iterations) if 'iteration' in dir() else 0,
            files_written=files_written,
            threshold=args.quality_threshold,
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
