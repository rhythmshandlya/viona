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
EVENT_ITERATION_COMPLETE = "iteration_complete"
EVENT_COMPLETE = "complete"
EVENT_ERROR = "error"
EVENT_CANCELLED = "cancelled"

# Configuration
MAX_ITERATIONS = 3
QUALITY_THRESHOLD = 90


def emit_event(event_type: str, **kwargs):
    """Emit a JSON event to stdout for the TypeScript worker to parse."""
    event = {"type": event_type, **kwargs}
    print(json.dumps(event), flush=True)


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


def create_generator_agent(llm, remotion_skill: str, style_skill: str, enable_planning: bool = True):
    """Create the generator agent with Remotion skills.

    Args:
        llm: The LLM configuration
        remotion_skill: Remotion best practices skill content
        style_skill: Visual design skill content
        enable_planning: Enable planning mode for long-horizon tasks (default: True)
    """
    from openhands.sdk import Agent, AgentContext, Tool
    from openhands.sdk.context.skills.skill import Skill
    from openhands.tools.file_editor import FileEditorTool
    from openhands.tools.task_tracker import TaskTrackerTool
    from openhands.tools.terminal import TerminalTool

    skills = []
    if remotion_skill:
        skills.append(Skill(name="remotion-best-practices", content=remotion_skill))
    if style_skill:
        skills.append(Skill(name="visual-design", content=style_skill))

    agent_context = AgentContext(skills=skills) if skills else None

    # Use planning-aware system prompt for long-horizon visual generation tasks
    # This enables the TaskTrackerTool to maintain a structured plan
    system_prompt = "system_prompt_long_horizon.j2" if enable_planning else "system_prompt.j2"

    return Agent(
        llm=llm,
        tools=[
            Tool(name=TerminalTool.name),
            Tool(name=FileEditorTool.name),
            Tool(name=TaskTrackerTool.name),
        ],
        agent_context=agent_context,
        system_prompt_filename=system_prompt,
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

    # Create a shared terminal executor factory
    def create_validation_tools(conv_state):
        terminal_executor = TerminalExecutor(working_dir=conv_state.workspace.working_dir)
        tools = []
        tools.extend(TypeScriptValidatorTool.create(conv_state, terminal_executor))
        tools.extend(RemotionBundleTool.create(conv_state, terminal_executor))
        tools.extend(RemotionRenderStillTool.create(conv_state, terminal_executor))
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


def run_generator(agent, workspace: str, prompt: str, critique: Optional[str] = None) -> str:
    """Run the generator agent and return the conversation result."""
    from openhands.sdk import Conversation

    conversation = Conversation(agent=agent, workspace=workspace)

    if critique:
        message = f"""Previous attempt had issues. Fix them based on this feedback:

{critique}

Original task:
{prompt}"""
    else:
        message = prompt

    emit_event(EVENT_TOOL_CALL, tool="generator", message="Running generator agent")
    conversation.send_message(message)
    conversation.run()

    # Return last agent message
    return "Generation complete"


def run_critic(agent, workspace: str, project_id: str, duration_frames: int, fps: int) -> dict:
    """Run the critic agent and return the score."""
    from openhands.sdk import Conversation

    conversation = Conversation(agent=agent, workspace=workspace)

    # Calculate frames to check (start, middle, end)
    mid_frame = duration_frames // 2
    end_frame = max(0, duration_frames - 10)

    critic_prompt = f"""Evaluate the Remotion project at src/{project_id}/.

Follow the scoring rubric to evaluate this visual generation:

1. **TypeScript Validation**: Run TypeScriptValidatorTool on path "src/{project_id}"
2. **Bundle Validation**: Run RemotionBundleTool with entry_point="src/index.ts"
3. **Visual Inspection**: Run RemotionRenderStillTool for composition_id="{project_id}" at frames:
   - Frame 0 (start)
   - Frame {mid_frame} (middle)
   - Frame {end_frame} (near end)
4. **Check metadata.json** in src/{project_id}/ for completeness
5. **Review the code** for Remotion best practices

After evaluation, output ONLY a JSON object with this exact format:
{{
  "score": <0-100>,
  "breakdown": {{
    "correctness": <0-25>,
    "completeness": <0-25>,
    "visualQuality": <0-25>,
    "codeQuality": <0-25>
  }},
  "issues": ["list of specific issues found"],
  "suggestion": "specific actionable fix instructions"
}}"""

    emit_event(EVENT_TOOL_CALL, tool="critic", message="Running critic agent")
    conversation.send_message(critic_prompt)
    conversation.run()

    # Extract response and parse score
    # Get the last message from the conversation
    response = ""
    try:
        # Access conversation state to get messages
        if hasattr(conversation, 'state') and hasattr(conversation.state, 'messages'):
            for msg in reversed(conversation.state.messages):
                if hasattr(msg, 'content') and msg.content:
                    response = str(msg.content)
                    break
    except Exception:
        pass

    return parse_critic_score(response)


def main():
    parser = argparse.ArgumentParser(description="OpenHands Visual Generator with Iterative Refinement")
    parser.add_argument("--workspace", required=True, help="Path to Remotion project")
    parser.add_argument("--project-id", required=True, help="Composition ID")
    parser.add_argument("--model", required=True, help="LLM model for code generation (Pro)")
    parser.add_argument("--model-flash", help="LLM model for critic/other tasks (Flash). Defaults to --model if not specified")
    parser.add_argument("--prompt-file", required=True, help="Path to prompt file")
    parser.add_argument("--api-key-env", default="LLM_API_KEY", help="Env var for API key")
    parser.add_argument("--duration-frames", type=int, default=900, help="Video duration in frames")
    parser.add_argument("--fps", type=int, default=30, help="Video FPS")
    parser.add_argument("--width", type=int, default=1080, help="Video width")
    parser.add_argument("--height", type=int, default=1920, help="Video height")
    parser.add_argument("--temperature", type=float, default=1.0, help="LLM temperature")
    parser.add_argument("--max-iterations", type=int, default=MAX_ITERATIONS, help="Max refinement iterations")
    parser.add_argument("--quality-threshold", type=int, default=QUALITY_THRESHOLD, help="Quality score threshold")
    parser.add_argument("--enable-planning", action="store_true", default=True, help="Enable planning mode for structured task tracking")
    parser.add_argument("--no-planning", action="store_false", dest="enable_planning", help="Disable planning mode")
    args = parser.parse_args()

    # Use Flash model for critic if specified, otherwise fall back to main model
    critic_model = args.model_flash or args.model

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

    emit_event(
        EVENT_STARTED,
        model=args.model,
        model_flash=critic_model,
        workspace=args.workspace,
        max_iterations=args.max_iterations,
        planning_mode=args.enable_planning,
    )

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
        def get_model_name(model: str) -> str:
            """Convert model string to litellm format."""
            model_lower = model.lower()
            if "gemini" in model_lower:
                return f"gemini/{model}"
            elif "claude" in model_lower:
                return f"anthropic/{model}"
            elif "gpt" in model_lower:
                return f"openai/{model}"
            return model

        # Configure LLM for code generation (Pro - higher quality)
        generator_model_name = get_model_name(args.model)
        generator_llm = LLM(
            model=generator_model_name,
            api_key=SecretStr(api_key),
            temperature=args.temperature,
            usage_id="code-generation",  # For cost tracking
        )

        # Configure LLM for critic/other tasks (Flash - faster, cheaper)
        critic_model_name = get_model_name(critic_model)
        critic_llm = LLM(
            model=critic_model_name,
            api_key=SecretStr(api_key),
            temperature=args.temperature,
            usage_id="visual-evaluation",  # For cost tracking
        )

        emit_event(EVENT_TOOL_CALL, tool="config", message=f"Generator: {generator_model_name}, Critic: {critic_model_name}")

        # Load skills
        skills_dir = Path(__file__).parent / "skills"
        remotion_skill = load_skill(skills_dir / "remotion-best-practices.md")
        style_skill = load_skill(skills_dir / "visual-design.md")
        scoring_rubric = load_skill(skills_dir / "scoring-rubric.md")

        # Create agents with appropriate models
        # Generator uses Pro for high-quality code generation
        generator_agent = create_generator_agent(
            generator_llm, remotion_skill, style_skill, enable_planning=args.enable_planning
        )
        # Critic uses Flash for faster, cheaper validation
        critic_agent = create_critic_agent(critic_llm, scoring_rubric)

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
            run_generator(generator_agent, args.workspace, prompt, critique_feedback)

            if cancelled:
                break

            # Phase 2: Critic evaluates
            score_result = run_critic(
                critic_agent,
                args.workspace,
                args.project_id,
                args.duration_frames,
                args.fps
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
        emit_event(EVENT_ERROR, message=str(e))
        sys.exit(1)


if __name__ == "__main__":
    main()
