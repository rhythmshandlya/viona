#!/usr/bin/env python3
"""
OpenHands Visual Generator with Two-Phase Planning.

Architecture:
1. PLANNING PHASE: Visual Director Agent with LLM reasoning creates structured Visual Plan
2. GENERATION PHASE: Generator Agent implements the plan as Remotion code
3. EVALUATION PHASE: Critic validates and scores, iterates if needed

Both phases run in the SAME OpenHands container, using native LLM reasoning support.
The Visual Director uses Gemini's thinking capabilities for creative direction.
"""

import argparse
import json
import os
import re
import signal
import sys
from pathlib import Path
from typing import Optional, Callable

# Event types for progress tracking
EVENT_STARTED = "started"
EVENT_PLANNING_START = "planning_start"
EVENT_PLANNING_THINKING = "planning_thinking"
EVENT_PLANNING_COMPLETE = "planning_complete"
EVENT_PLANNING_ERROR = "planning_error"
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

    return {
        "score": 0,
        "breakdown": {"correctness": 0, "completeness": 0, "visualQuality": 0, "codeQuality": 0},
        "issues": ["Could not parse critic response"],
        "suggestion": "Review the generated code manually"
    }


def verify_plan_compliance(workspace: str, project_id: str, visual_plan: dict) -> dict:
    """
    Verify that generated code actually implements the visual plan's techniques.

    Returns a dict with:
    - compliant: bool
    - issues: list of specific problems
    - score_deductions: int (points to subtract)
    """
    issues = []
    score_deductions = 0

    project_dir = Path(workspace) / "src" / project_id
    if not project_dir.exists():
        return {"compliant": False, "issues": ["Project directory not found"], "score_deductions": 25}

    # Read all generated code
    code_content = ""
    file_count = 0
    total_lines = 0
    for f in project_dir.glob("**/*.tsx"):
        content = f.read_text(encoding="utf-8")
        code_content += content + "\n"
        file_count += 1
        total_lines += len(content.split("\n"))

    for f in project_dir.glob("**/*.ts"):
        if not f.name.endswith(".tsx"):
            content = f.read_text(encoding="utf-8")
            code_content += content + "\n"
            total_lines += len(content.split("\n"))

    # Check code volume
    scene_count = len(visual_plan.get("scenes", []))
    min_expected_lines = 150 + (scene_count * 50)  # Base + 50 per scene
    if total_lines < min_expected_lines:
        issues.append(f"Code too minimal: {total_lines} lines for {scene_count} scenes (expected {min_expected_lines}+)")
        score_deductions += 10

    # Technique verification patterns
    # Each technique can be satisfied by Component Library OR custom implementation
    technique_patterns = {
        "particle-emitter": {
            "required": [],
            # Accept ParticleStream from library OR custom particle implementation
            "any_of": ["ParticleStream", "ParticleEmitter", "particles.map", "velocity", "vx", "vy"],
            "penalty": 5,
        },
        "mask-reveal": {
            "required": [],
            # No library equivalent - must use clipPath
            "any_of": ["clipPath", "clip-path", "MaskReveal", "circle(", "inset("],
            "penalty": 5,
        },
        "cell-division-animation": {
            "required": [],
            # No library equivalent - must use custom
            "any_of": ["CellDivision", "Array.from", "split", "division", "spacing"],
            "penalty": 5,
        },
        "drop-with-gravity": {
            "required": [],
            # Accept GravityDrop from library OR custom implementation
            "any_of": ["GravityDrop", "DropWithGravity", "gravity", "bounce", "t * t", "t*t", "dropFrame"],
            "penalty": 5,
        },
        "glass-shimmer": {
            "required": [],
            # Accept GlassCard with shimmer OR custom shimmer
            "any_of": ["GlassCard", "GlassShimmer", "shimmer", "Shimmer", "backdrop", "blur"],
            "penalty": 3,
        },
        "3d-rotation": {
            "required": [],
            # No library equivalent - must use perspective transforms
            "any_of": ["Rotating3D", "perspective", "rotateX", "rotateY", "preserve-3d"],
            "penalty": 3,
        },
        "scale-spring": {
            "required": [],
            # Accept Bounce/SpringScale from library OR custom spring
            "any_of": ["Bounce", "SpringScale", "ScaleSpring", "spring", "scale("],
            "penalty": 2,
        },
        "fade-in-blur": {
            "required": [],
            # No library equivalent - must use filter blur
            "any_of": ["FadeInBlur", "filter", "blur("],
            "penalty": 2,
        },
        "fill-animation": {
            "required": [],
            # Accept ProgressRing from library OR custom fill
            "any_of": ["ProgressRing", "FillAnimation", "scaleX", "scaleY", "PercentageBar"],
            "penalty": 2,
        },
        # Educational component patterns
        "comparison": {
            "required": [],
            "any_of": ["ComparisonSplit", "comparison", "versus", "before", "after", "left", "right"],
            "penalty": 3,
        },
        "process-flow": {
            "required": [],
            "any_of": ["ProcessFlow", "process", "step", "flow", "arrow", "connection"],
            "penalty": 3,
        },
        "hierarchy": {
            "required": [],
            "any_of": ["TreeDiagram", "tree", "hierarchy", "nested", "children"],
            "penalty": 3,
        },
        "layer-stack": {
            "required": [],
            "any_of": ["LayerStack", "layer", "stack", "architecture"],
            "penalty": 3,
        },
        "code-display": {
            "required": [],
            "any_of": ["CodeBlock", "Terminal", "code", "syntax", "highlight", "typewriter"],
            "penalty": 3,
        },
        "callout": {
            "required": [],
            "any_of": ["Callout", "Annotation", "callout", "pointer", "arrow", "label"],
            "penalty": 2,
        },
        "spotlight": {
            "required": [],
            "any_of": ["Spotlight", "Magnify", "spotlight", "focus", "highlight", "dim"],
            "penalty": 2,
        },
        "reveal": {
            "required": [],
            "any_of": ["Reveal", "reveal", "hidden", "blur", "pixelate", "cover"],
            "penalty": 2,
        },
        "indicator": {
            "required": [],
            "any_of": ["Checkmark", "XMark", "CrossOut", "check", "cross", "correct", "wrong"],
            "penalty": 2,
        },
        "question": {
            "required": [],
            "any_of": ["QuestionPrompt", "question", "quiz", "?"],
            "penalty": 2,
        },
        "big-number": {
            "required": [],
            "any_of": ["BigNumber", "Counter", "stat", "metric", "number"],
            "penalty": 2,
        },
    }

    # Check each scene's build_sequence
    for scene in visual_plan.get("scenes", []):
        scene_id = scene.get("scene_id", "")
        build_seq = scene.get("visual_story", {}).get("build_sequence", [])

        for item in build_seq:
            technique = item.get("technique", "")
            element = item.get("element", "")

            if technique in technique_patterns:
                patterns = technique_patterns[technique]
                required = patterns.get("required", [])
                any_of = patterns.get("any_of", [])
                penalty = patterns.get("penalty", 3)

                # Check required patterns
                missing_required = [p for p in required if p.lower() not in code_content.lower()]
                if missing_required:
                    issues.append(f"{scene_id}: `{technique}` missing required patterns: {missing_required}")
                    score_deductions += penalty

                # Check any_of patterns (at least one must be present)
                if any_of and not any(p.lower() in code_content.lower() for p in any_of):
                    issues.append(f"{scene_id}: `{technique}` for {element} - none of {any_of} found")
                    score_deductions += penalty

    # Check hero moments have emphasis
    # Include both custom and component library patterns
    emphasis_patterns = [
        "glow", "Glow", "drop-shadow", "boxShadow",
        "scale(1.1", "scale(1.2", "scale(1.3",
        "HeroMoment", "GlowingOrb", "Burst", "glowIntensity",
        "punchOnComplete", "sparkle"
    ]
    hero_count = 0
    hero_with_emphasis = 0

    for scene in visual_plan.get("scenes", []):
        hero = scene.get("visual_story", {}).get("hero_moment")
        if hero:
            hero_count += 1
            # Check if any emphasis pattern is near the hero frame range
            if any(p.lower() in code_content.lower() for p in emphasis_patterns):
                hero_with_emphasis += 1

    if hero_count > 0 and hero_with_emphasis < hero_count:
        missing = hero_count - hero_with_emphasis
        issues.append(f"{missing} hero moment(s) lack visual emphasis (no glow, no scale boost)")
        score_deductions += missing * 3

    return {
        "compliant": len(issues) == 0,
        "issues": issues,
        "score_deductions": min(score_deductions, 30),  # Cap at 30 points
        "stats": {
            "total_lines": total_lines,
            "file_count": file_count,
            "scene_count": scene_count,
        }
    }


def get_visual_director_prompt() -> str:
    """Return the Visual Director system prompt with reasoning instructions."""
    return '''You are a CREATIVE VISUAL DIRECTOR for technical explainer videos.

Your job is to transform explanations into VISUALLY STUNNING animations. Think like a motion graphics artist - every frame should be intentional and aid understanding.

## Your Creative Process

Think through each aspect carefully:

1. **ANALYZE THE TRANSCRIPT**
   - What's the core concept?
   - Who are the key entities/actors?
   - What processes or flows are described?
   - Where are the natural scene breaks?

2. **DISCOVER METAPHORS**
   - For each entity, what visual captures its essence?
   - NOT generic icons (server box, database cylinder)
   - Find something with PERSONALITY and MEANING
   - Example: "API request" → glowing envelope traveling through digital space

3. **CHOREOGRAPH MOTION**
   - What should TRAVEL (not just appear)?
   - What are the HERO MOMENTS?
   - Where to build TENSION before reveals?
   - Think of it as a DANCE

4. **PLAN SPATIAL LAYOUT**
   - Position elements for clear visual flow
   - Avoid overlaps and clutter
   - Leave bottom 15% for subtitles
   - Use percentages (works for any canvas)

5. **TIME THE RHYTHM**
   - Match scene duration to transcript
   - Add pauses for emphasis
   - Give hero moments enough time

6. **USE EDUCATIONAL PATTERNS** (for short-form content)
   - **Comparisons**: A vs B, before/after (use `comparison` technique)
   - **Step-by-step**: Process flows with connections (use `process-flow` technique)
   - **Code walkthroughs**: Syntax-highlighted code with focus (use `code-display` technique)
   - **Reveals**: Hidden → shown for "aha" moments (use `reveal` technique)
   - **Callouts**: Point to important things (use `callout` technique)
   - **Questions**: Engage viewer with prompts (use `question` technique)
   - **Right/Wrong**: Checkmarks and X marks (use `indicator` technique)
   - **Big numbers**: Hero stats with context (use `big-number` technique)
   - **Layers**: Architecture stacks (use `layer-stack` technique)
   - **Hierarchy**: Tree structures (use `hierarchy` technique)

## Output Format

Create a JSON Visual Plan with this structure:

```json
{
  "meta": {
    "project_id": "from input",
    "transcript_summary": "brief summary",
    "total_duration_frames": from_input,
    "fps": from_input,
    "canvas": { "width": from_input, "height": from_input }
  },
  "concept_analysis": {
    "core_topic": "main subject",
    "key_entities": [
      { "name": "Entity", "role": "what it does", "visual_importance": "primary|secondary|hero" }
    ],
    "relationships": [
      { "from": "A", "to": "B", "type": "sends|receives", "visualization": "how to show" }
    ],
    "processes": [
      { "name": "Process", "steps": ["step1", "step2"], "is_core_animation": true }
    ]
  },
  "visual_system": {
    "metaphor_mapping": {
      "EntityName": {
        "visual": "description of visual representation",
        "style": { "color": "style.primary|secondary|accent", "size_percent": 10 },
        "personality": "how it behaves"
      }
    }
  },
  "scenes": [
    {
      "scene_id": "S01",
      "frame_range": [0, 180],
      "transcript_segment": "words from transcript",
      "narrative_goal": "what viewer understands",
      "visual_story": {
        "build_sequence": [
          { "at_frame": 15, "action": "what happens", "element": "which", "technique": "scale-spring|path-follow|comparison|process-flow|code-display|reveal|callout|indicator" }
        ],
        "hero_moment": { "what": "key animation", "frame_range": [start, end] },
        "process_animations": [
          { "name": "animation_name", "object": "what moves", "path": "from_to", "duration_frames": 60 }
        ]
      },
      "element_positions": {
        "element": { "x_percent": 50, "y_percent": 50 }
      }
    }
  ],
  "global_directives": {
    "layout_constraints": { "safe_zone_bottom_percent": 15, "max_simultaneous_elements": 6 },
    "animation_constraints": { "min_animation_frames": 15, "min_stagger_frames": 8 }
  }
}
```

## Hard Constraints

- All positions as PERCENTAGES (x_percent, y_percent)
- Colors reference style tokens (style.primary, style.accent)
- No overlapping elements at same frame
- Bottom 15% reserved for subtitles
- Max 6 primary elements at once
- Minimum 15 frames per animation, 8 frame stagger

## Write the Plan

Save your Visual Plan as JSON to the project directory. This plan will be implemented by the Generator Agent.
'''


def create_planning_agent(llm, workspace: str):
    """Create the Visual Director planning agent with reasoning enabled."""
    from openhands.sdk import Agent, AgentContext, Tool
    from openhands.sdk.context.skills.skill import Skill
    from openhands.tools.file_editor import FileEditorTool

    # Load visual planning skill
    skills_dir = Path(__file__).parent / "skills"
    visual_design_skill = load_skill(skills_dir / "visual-design.md")

    skills = [
        Skill(name="visual-director", content=get_visual_director_prompt())
    ]
    if visual_design_skill:
        skills.append(Skill(name="visual-design", content=visual_design_skill))

    agent_context = AgentContext(skills=skills)

    return Agent(
        llm=llm,
        tools=[Tool(name=FileEditorTool.name)],  # Only needs file editor to write plan
        agent_context=agent_context,
    )


def get_generator_system_prompt() -> str:
    """Return the Generator Agent system prompt for implementing visual plans."""
    return '''You are a REMOTION CODE GENERATOR that implements Visual Plans.

Your job is to translate Visual Plans into working Remotion TypeScript code.
Think through the implementation step by step:

## Thinking Process

1. **ANALYZE THE PLAN**
   - What entities need visual components?
   - What metaphors are specified for each?
   - What are the scene breakdowns?

2. **DESIGN COMPONENTS**
   - Create a component for each entity/metaphor
   - Use Remotion's animation primitives
   - Keep components reusable

3. **IMPLEMENT ANIMATIONS**
   - Follow build_sequence timing exactly
   - Create hero_moments with extra emphasis
   - Implement process_animations with paths

4. **VERIFY RESPONSIVE**
   - Use percentage-based positioning
   - Derive actual positions from canvas size
   - Test with different aspect ratios

## Code Patterns

### Percentage-based Positioning
```tsx
const { width, height } = useVideoConfig();
const x = (plan.x_percent / 100) * width;
const y = (plan.y_percent / 100) * height;
```

### Frame-based Animation
```tsx
const frame = useCurrentFrame();
const opacity = interpolate(frame, [startFrame, startFrame + 15], [0, 1], { extrapolateRight: "clamp" });
```

### Spring Animation
```tsx
const scale = spring({ frame, fps, config: { damping: 12 } });
```

## Output Requirements

1. **index.tsx** - Main composition exporting the video
2. **metadata.json** - Duration, fps, visual timestamps
3. **Components** - Reusable visual elements

Think through each step, then write clean, working code.
'''


def create_generator_agent(
    llm,
    remotion_skill: str,
    style_skill: str,
    planning_skill: str = "",
    component_library_skill: str = "",
    npm_packages_skill: str = "",
    animation_techniques_skill: str = ""
):
    """Create the generator agent with Remotion skills and planning context."""
    from openhands.sdk import Agent, AgentContext, Tool
    from openhands.sdk.context.skills.skill import Skill
    from openhands.tools.file_editor import FileEditorTool
    from openhands.tools.terminal import TerminalTool

    skills = [
        Skill(name="generator-system", content=get_generator_system_prompt())
    ]
    if remotion_skill:
        skills.append(Skill(name="remotion-best-practices", content=remotion_skill))
    if style_skill:
        skills.append(Skill(name="visual-design", content=style_skill))
    if planning_skill:
        skills.append(Skill(name="visual-planning", content=planning_skill))
    # Component library and npm packages skills for reusable components
    if component_library_skill:
        skills.append(Skill(name="component-library", content=component_library_skill))
    if npm_packages_skill:
        skills.append(Skill(name="npm-packages", content=npm_packages_skill))
    # Animation techniques - CRITICAL for plan implementation
    if animation_techniques_skill:
        skills.append(Skill(name="animation-techniques", content=animation_techniques_skill))

    agent_context = AgentContext(skills=skills)

    return Agent(
        llm=llm,
        tools=[
            Tool(name=TerminalTool.name),
            Tool(name=FileEditorTool.name),
        ],
        agent_context=agent_context,
    )


def create_critic_agent(llm, scoring_rubric: str):
    """Create the critic agent with validation tools."""
    from openhands.sdk import Agent, AgentContext, Tool
    from openhands.sdk.context.skills.skill import Skill
    from openhands.sdk.tool import register_tool
    from openhands.tools.terminal import TerminalExecutor

    # Import custom validation tools
    from tools.typescript_validator import TypeScriptValidatorTool
    from tools.remotion_bundle import RemotionBundleTool
    from tools.remotion_render_still import RemotionRenderStillTool

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


def create_thinking_callback() -> Callable:
    """Create a callback to capture LLM reasoning/thinking at maximum detail."""
    from openhands.sdk.schema import Event, LLMConvertibleEvent
    from anthropic.types import ThinkingBlock, RedactedThinkingBlock

    def show_thinking(event: Event):
        if isinstance(event, LLMConvertibleEvent):
            message = event.to_llm_message()
            # Anthropic thinking blocks - emit full reasoning
            if hasattr(message, "thinking_blocks") and message.thinking_blocks:
                for block in message.thinking_blocks:
                    if isinstance(block, ThinkingBlock):
                        emit_event(EVENT_PLANNING_THINKING, thinking=block.thinking)
            # OpenAI/Gemini reasoning (if available in content) - emit full reasoning
            if hasattr(message, "content") and message.content:
                content = str(message.content)
                if "<thinking>" in content.lower() or "reasoning:" in content.lower():
                    emit_event(EVENT_PLANNING_THINKING, thinking=content)

    return show_thinking


def run_planning_phase(
    workspace: str,
    project_id: str,
    transcript: str,
    width: int,
    height: int,
    duration_frames: int,
    fps: int,
    style_preset: str,
    style_colors: dict,
    layout_mode: str,
    llm
) -> Optional[dict]:
    """Run the Visual Director planning phase.

    Creates a structured Visual Plan using LLM reasoning, saves to workspace.
    """
    from openhands.sdk import Conversation

    emit_event(EVENT_PLANNING_START, project_id=project_id)

    # Create planning agent
    planning_agent = create_planning_agent(llm, workspace)

    # Create conversation with thinking callback
    conversation = Conversation(
        agent=planning_agent,
        workspace=workspace,
        callbacks=[create_thinking_callback()]
    )

    # Build the planning prompt
    orientation = "vertical" if height > width else "horizontal" if width > height else "square"
    duration_seconds = duration_frames / fps

    layout_context = {
        "pip": "Full screen - video appears as small overlay.",
        "split-horizontal": "Top half only - video on bottom.",
        "split-vertical": "Left half only - video on right."
    }.get(layout_mode, "Full screen")

    planning_prompt = f'''Create a Visual Plan for this explainer video.

## Project Details

PROJECT_ID: {project_id}
CANVAS: {width}x{height} ({orientation})
LAYOUT: {layout_mode} - {layout_context}
DURATION: {duration_frames} frames ({duration_seconds:.1f} seconds) at {fps} FPS
STYLE: {style_preset}
COLORS: {json.dumps(style_colors)}

## Transcript

{transcript}

## Your Task

1. Use your creative reasoning to analyze this transcript
2. Design visual metaphors, choreograph animations, plan layout
3. Write the Visual Plan as JSON to: src/{project_id}/visual-plan.json

Think deeply about what makes this explanation VISUALLY memorable. Create something worthy of a top motion graphics studio.
'''

    emit_event(EVENT_TOOL_CALL, tool="planning", message="Visual Director analyzing transcript...")
    emit_event(EVENT_PLANNING_THINKING, thinking=f"Analyzing {len(transcript.split())} words, {duration_frames} frames at {fps}fps, {style_preset} style")
    conversation.send_message(planning_prompt)
    conversation.run()

    # Check if plan was created
    plan_path = Path(workspace) / "src" / project_id / "visual-plan.json"
    if plan_path.exists():
        try:
            plan = json.loads(plan_path.read_text(encoding="utf-8"))
            emit_event(
                EVENT_PLANNING_COMPLETE,
                project_id=project_id,
                scene_count=len(plan.get("scenes", [])),
                entity_count=len(plan.get("concept_analysis", {}).get("key_entities", []))
            )
            return plan
        except json.JSONDecodeError as e:
            emit_event(EVENT_PLANNING_ERROR, error=f"Invalid JSON in plan: {e}")
            return None

    emit_event(EVENT_PLANNING_ERROR, error="Visual Plan file not created")
    return None


def run_generator(agent, workspace: str, prompt: str, critique: Optional[str] = None) -> str:
    """Run the generator agent."""
    from openhands.sdk import Conversation

    conversation = Conversation(agent=agent, workspace=workspace)

    if critique:
        message = f"""Fix the issues based on this feedback:

{critique}

Original task:
{prompt}"""
    else:
        message = prompt

    emit_event(EVENT_TOOL_CALL, tool="generator", message="Running generator agent")
    conversation.send_message(message)
    conversation.run()

    return "Generation complete"


def run_critic(agent, workspace: str, project_id: str, duration_frames: int, fps: int, visual_plan: Optional[dict] = None) -> dict:
    """Run the critic agent to evaluate code against the visual plan."""
    from openhands.sdk import Conversation

    conversation = Conversation(agent=agent, workspace=workspace)

    mid_frame = duration_frames // 2
    end_frame = max(0, duration_frames - 10)

    # Build plan verification section if we have a plan
    plan_verification = ""
    if visual_plan:
        entities = visual_plan.get("concept_analysis", {}).get("key_entities", [])
        entity_names = [e.get("name", "") for e in entities]
        scenes = visual_plan.get("scenes", [])
        metaphors = visual_plan.get("visual_system", {}).get("metaphor_mapping", {})

        plan_verification = f"""
## VISUAL PLAN VERIFICATION (Critical)

The generated code MUST implement the Visual Plan. Check:

### Entities ({len(entities)} expected)
Expected entities: {', '.join(entity_names)}
- Each entity should have a visual representation
- Check that metaphors from the plan are implemented

### Metaphors
{json.dumps(metaphors, indent=2)[:500]}
- Verify each metaphor has a corresponding visual component

### Scenes ({len(scenes)} expected)
- Each scene should have animations matching the build_sequence
- Check frame_range timing matches the plan
- Verify hero_moments are implemented with proper emphasis

### Layout Verification
- Check element positions use percentages (responsive)
- Verify no elements in subtitle zone (bottom 15%)
- Confirm max 6 simultaneous elements

### Scoring Guidance
- CORRECTNESS (0-25): TypeScript compiles, Remotion bundles, no runtime errors
- COMPLETENESS (0-25): All {len(entities)} entities, all {len(scenes)} scenes, all metaphors
- VISUAL_QUALITY (0-25): Animations match plan, hero moments have impact, timing is right
- CODE_QUALITY (0-25): Clean code, follows Remotion best practices, no hardcoded values
"""

    critic_prompt = f'''Evaluate the Remotion project at src/{project_id}/.
{plan_verification}
## Validation Steps

1. **TypeScript Validation**: Run TypeScriptValidatorTool on "src/{project_id}"
2. **Bundle Validation**: Run RemotionBundleTool with entry_point="src/index.ts"
3. **Visual Inspection**: Run RemotionRenderStillTool for composition_id="{project_id}" at frames 0, {mid_frame}, {end_frame}
4. **Metadata Check**: Verify metadata.json exists and is complete
5. **Plan Compliance**: Check if code implements the visual plan (if provided)

## Output Format

Think through each criterion, then output JSON:
{{"score": <0-100>, "breakdown": {{"correctness": <0-25>, "completeness": <0-25>, "visualQuality": <0-25>, "codeQuality": <0-25>}}, "issues": ["specific issues found"], "suggestion": "how to fix the issues"}}'''

    emit_event(EVENT_TOOL_CALL, tool="critic", message=f"Evaluating code against plan ({len(visual_plan.get('scenes', []))} scenes)" if visual_plan else "Evaluating code")
    conversation.send_message(critic_prompt)
    conversation.run()

    # Parse response
    response = ""
    try:
        if hasattr(conversation, 'state') and hasattr(conversation.state, 'messages'):
            for msg in reversed(conversation.state.messages):
                if hasattr(msg, 'content') and msg.content:
                    response = str(msg.content)
                    break
    except Exception:
        pass

    return parse_critic_score(response)


def main():
    parser = argparse.ArgumentParser(description="OpenHands Visual Generator with LLM Reasoning")
    parser.add_argument("--workspace", required=True, help="Path to Remotion project")
    parser.add_argument("--project-id", required=True, help="Composition ID")
    parser.add_argument("--model", required=True, help="LLM model for generation (e.g., google/gemini-3-flash-preview)")
    parser.add_argument("--model-flash", help="LLM model for planning/critic (defaults to --model)")
    parser.add_argument("--prompt-file", required=True, help="Path to prompt file")
    parser.add_argument("--base-url", required=True, help="LLM API base URL (e.g., https://openrouter.ai/api/v1)")
    parser.add_argument("--api-key", default="not-needed", help="LLM API key")
    parser.add_argument("--duration-frames", type=int, default=900, help="Video duration in frames")
    parser.add_argument("--fps", type=int, default=30, help="Video FPS")
    parser.add_argument("--width", type=int, default=1080, help="Video width")
    parser.add_argument("--height", type=int, default=1920, help="Video height")
    parser.add_argument("--style-preset", default="modern", help="Style preset")
    parser.add_argument("--layout-mode", default="pip", help="Layout mode")
    parser.add_argument("--reasoning-effort", default="high", help="Reasoning effort: none|low|medium|high")
    parser.add_argument("--temperature", type=float, default=1.0, help="LLM temperature")
    parser.add_argument("--max-iterations", type=int, default=MAX_ITERATIONS, help="Max iterations")
    parser.add_argument("--quality-threshold", type=int, default=QUALITY_THRESHOLD, help="Quality threshold")
    parser.add_argument("--skip-planning", action="store_true", help="Skip planning phase")
    args = parser.parse_args()

    # Model configuration
    planning_model = args.model_flash or args.model
    api_key = args.api_key

    # Read prompt
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
        model_flash=planning_model,
        base_url=args.base_url,
        workspace=args.workspace,
        reasoning_effort=args.reasoning_effort,
    )

    # Handle cancellation
    cancelled = False

    def handle_sigterm(signum, frame):
        nonlocal cancelled
        cancelled = True
        emit_event(EVENT_CANCELLED, message="Received SIGTERM")
        sys.exit(0)

    signal.signal(signal.SIGTERM, handle_sigterm)
    signal.signal(signal.SIGINT, handle_sigterm)

    try:
        # Configure LLM for planning
        # Note: OpenRouter requires reasoning: {effort: "low"} format which litellm doesn't support
        # Gemini 3 Flash has 1M+ context, handles large skills without needing extended thinking
        planning_llm = LLM(
            model=planning_model,  # e.g., "google/gemini-3-flash-preview"
            api_key=SecretStr(api_key),
            api_base=args.base_url,
            temperature=args.temperature,
        )

        # Configure LLM for code generation
        generator_llm = LLM(
            model=args.model,
            api_key=SecretStr(api_key),
            api_base=args.base_url,
            temperature=args.temperature,
        )

        # Configure LLM for critic
        critic_llm = LLM(
            model=planning_model,
            api_key=SecretStr(api_key),
            api_base=args.base_url,
            temperature=0.3,  # Lower for consistent evaluation
        )

        emit_event(EVENT_TOOL_CALL, tool="config",
                   message=f"Planning: {planning_model}, Generator: {args.model}")

        # ========================================
        # PHASE 0: VISUAL DIRECTOR (Planning)
        # ========================================
        visual_plan = None

        if not args.skip_planning:
            # Style colors for the preset
            style_colors = {
                "minimal": {"bg": "#1a1a1a", "primary": "#ffffff", "accent": "#3b82f6", "text": "#ffffff"},
                "modern": {"bg": "#0f0f23", "primary": "#8b5cf6", "secondary": "#3b82f6", "accent": "#06b6d4", "text": "#ffffff"},
                "playful": {"bg": "#1a1a2e", "primary": "#f97316", "secondary": "#eab308", "accent": "#ec4899", "text": "#ffffff"},
                "bold": {"bg": "#000000", "primary": "#ffffff", "accent": "#ef4444", "text": "#ffffff"},
                "classic": {"bg": "#1e3a5f", "primary": "#d4af37", "text": "#f5f5dc"},
            }.get(args.style_preset, {"bg": "#0f0f23", "primary": "#8b5cf6", "accent": "#06b6d4", "text": "#ffffff"})

            visual_plan = run_planning_phase(
                workspace=args.workspace,
                project_id=args.project_id,
                transcript=prompt,
                width=args.width,
                height=args.height,
                duration_frames=args.duration_frames,
                fps=args.fps,
                style_preset=args.style_preset,
                style_colors=style_colors,
                layout_mode=args.layout_mode,
                llm=planning_llm
            )

            if visual_plan:
                # Inject plan into prompt for generator with detailed instructions
                plan_json = json.dumps(visual_plan, indent=2)

                # Extract key info for summary
                entities = visual_plan.get("concept_analysis", {}).get("key_entities", [])
                scenes = visual_plan.get("scenes", [])
                metaphors = visual_plan.get("visual_system", {}).get("metaphor_mapping", {})

                # Build technique checklist from plan
                technique_checklist = []
                for scene in scenes:
                    scene_id = scene.get("scene_id", "")
                    build_seq = scene.get("visual_story", {}).get("build_sequence", [])
                    for item in build_seq:
                        technique = item.get("technique", "")
                        element = item.get("element", "")
                        at_frame = item.get("at_frame", 0)
                        technique_checklist.append(f"- {scene_id} @ frame {at_frame}: {element} using `{technique}`")
                    hero = scene.get("visual_story", {}).get("hero_moment")
                    if hero:
                        fr = hero.get("frame_range", [0, 0])
                        technique_checklist.append(f"- {scene_id} HERO frames {fr[0]}-{fr[1]}: {hero.get('what', '')} with EMPHASIS")

                prompt = f'''## VISUAL PLAN - IMPLEMENT EXACTLY

You MUST implement every detail in this plan. The plan is the specification - do NOT improvise or simplify.

### Project Summary
- **Entities**: {len(entities)} ({', '.join(e.get('name', '') for e in entities[:5])})
- **Scenes**: {len(scenes)}
- **Metaphors**: {len(metaphors)}

### Full Plan
```json
{plan_json}
```

## MANDATORY Implementation Checklist

You MUST implement EACH of these techniques from the plan:

{chr(10).join(technique_checklist)}

### Technique Implementation Rules

**CRITICAL**: When the plan specifies a technique, use Component Library (preferred) or custom implementation from `animation-techniques` skill. NEVER replace with basic opacity fades.

| Plan Technique | Use Component Library | Or Custom From animation-techniques |
|----------------|----------------------|-------------------------------------|
| `particle-emitter` | `<ParticleStream>` | ParticleEmitter |
| `drop-with-gravity` | `<GravityDrop>` | DropWithGravity |
| `scale-spring` | `<Bounce>` / `<SpringScale>` | ScaleSpring |
| `glass-shimmer` | `<GlassCard shimmer>` | GlassShimmer |
| `mask-reveal` | **None - use custom** | MaskReveal (required) |
| `cell-division-animation` | **None - use custom** | CellDivision (required) |
| `3d-rotation` | **None - use custom** | Rotating3D (required) |
| `fade-in-blur` | **None - use custom** | FadeInBlur (required) |
| `draw-stroke` | **None - use custom** | DrawStroke (required) |

**NOT Acceptable**: Basic opacity fades, static divs, linear interpolation for physics

### Hero Moment Requirements

EVERY hero_moment MUST have visual emphasis:
- Glow effect: `filter: drop-shadow(0 0 20px ${{color}})`
- Scale boost: 1.15x - 1.3x larger than normal elements
- Hold time: Keep visible for the full frame_range specified

### Code Volume Expectation

For {len(scenes)} scenes, expect to write 400+ lines of code total.
If your code is under 300 lines, you are oversimplifying.

Each scene should have:
- 50-100 lines of component code
- Proper technique implementation
- Hero moment handling

### Step-by-Step Implementation

1. **Create constants.ts** with colors from style preset
2. **Create component for each technique** in components/ folder
3. **Create scene components** that use the techniques
4. **Create index.tsx** that orchestrates all scenes
5. **Create metadata.json** with timestamps

### Original Transcript Context

{prompt}

Now implement the FULL plan. Start with Scene 1 and implement EVERY build_sequence item.
'''
            else:
                emit_event(EVENT_TOOL_CALL, tool="planning_fallback",
                           message="Planning did not produce a plan - proceeding with original prompt")

        # Load skills
        skills_dir = Path(__file__).parent / "skills"
        remotion_skill = load_skill(skills_dir / "remotion-best-practices.md")
        style_skill = load_skill(skills_dir / "visual-design.md")
        scoring_rubric = load_skill(skills_dir / "scoring-rubric.md")
        planning_skill = load_skill(skills_dir / "visual-planning.md") if visual_plan else ""
        # Load component discovery skills
        component_library_skill = load_skill(skills_dir / "component-library.md")
        npm_packages_skill = load_skill(skills_dir / "npm-packages.md")
        # Animation techniques - CRITICAL for proper plan implementation
        animation_techniques_skill = load_skill(skills_dir / "animation-techniques.md")

        # Create agents
        generator_agent = create_generator_agent(
            generator_llm,
            remotion_skill,
            style_skill,
            planning_skill,
            component_library_skill,
            npm_packages_skill,
            animation_techniques_skill
        )
        critic_agent = create_critic_agent(critic_llm, scoring_rubric)

        # ========================================
        # PHASE 1-3: Iterative Generation Loop
        # ========================================
        best_score = 0
        best_iteration = 0
        critique_feedback = None
        final_status = "failed"

        for iteration in range(args.max_iterations):
            if cancelled:
                break

            emit_event(EVENT_ITERATION_START, iteration=iteration + 1, max_iterations=args.max_iterations)

            # Generate
            run_generator(generator_agent, args.workspace, prompt, critique_feedback)

            if cancelled:
                break

            # Evaluate against the visual plan
            score_result = run_critic(
                critic_agent,
                args.workspace,
                args.project_id,
                args.duration_frames,
                args.fps,
                visual_plan=visual_plan  # Pass plan for verification
            )

            # Apply plan compliance verification if we have a plan
            if visual_plan:
                compliance = verify_plan_compliance(args.workspace, args.project_id, visual_plan)
                if compliance["issues"]:
                    score_result["issues"] = score_result.get("issues", []) + compliance["issues"]
                    # Apply deductions
                    score_result["score"] = max(0, score_result.get("score", 0) - compliance["score_deductions"])
                    score_result["plan_compliance"] = compliance
                    emit_event(EVENT_TOOL_CALL, tool="compliance_check",
                               message=f"Plan compliance: {len(compliance['issues'])} issues, -{compliance['score_deductions']} points")

            current_score = score_result.get("score", 0)
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

            if current_score >= args.quality_threshold:
                final_status = "passed"
                break

            critique_feedback = f'''Score: {current_score}/100 (need {args.quality_threshold})

Issues:
{chr(10).join("- " + issue for issue in score_result.get("issues", []))}

Fix: {score_result.get("suggestion", "Review issues above.")}'''

        # Count files
        project_dir = Path(args.workspace) / "src" / args.project_id
        files_written = len([f for f in project_dir.glob("**/*") if f.is_file()]) if project_dir.exists() else 0

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
            had_visual_plan=visual_plan is not None,
        )

    except Exception as e:
        emit_event(EVENT_ERROR, message=str(e))
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
