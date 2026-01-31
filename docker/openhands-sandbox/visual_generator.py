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

# =============================================================================
# LOGGING SUPPRESSION - MUST BE BEFORE ANY IMPORTS
# =============================================================================
import os
os.environ["LITELLM_LOG"] = "ERROR"
os.environ["OPENHANDS_LOG_LEVEL"] = "ERROR"

# Suppress litellm verbose output (must be before openhands import)
import litellm
litellm.suppress_debug_info = True
litellm.set_verbose = False

import argparse
import json
import logging
import re
import signal
import subprocess
import sys
from pathlib import Path
from typing import Optional

# Set logging levels to suppress verbose output
logging.getLogger("openhands").setLevel(logging.ERROR)
logging.getLogger("litellm").setLevel(logging.ERROR)
logging.getLogger("httpx").setLevel(logging.ERROR)
logging.getLogger("httpcore").setLevel(logging.ERROR)
logging.getLogger("LiteLLM").setLevel(logging.ERROR)

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

# Default Configuration (can be overridden by config.toml or CLI args)
MAX_ITERATIONS = 3
QUALITY_THRESHOLD = 70
MAX_SELF_HEAL_ATTEMPTS = 3
DEFAULT_TEMPERATURE = 1.0  # CRITICAL: Gemini 3.x requires 1.0

# =============================================================================
# CLAUDE PROXY CONTEXT MANAGEMENT
# Claude has 200K context vs Gemini's 1M, so we need aggressive limits
# =============================================================================

def is_claude_model(model_name: str) -> bool:
    """Detect if using Claude (via proxy or direct)."""
    claude_patterns = ['claude', 'anthropic']
    return any(p in model_name.lower() for p in claude_patterns)


# Configuration for Claude proxy (use ~80% of 200K context)
# Text-based evaluation - no screenshots to avoid context overflow from images
CLAUDE_CONFIG = {
    'condenser_max_size': 150,          # Use 80% of context window
    'condenser_max_size_eval': 80,      # Higher for text eval (no images)
    'condenser_keep_first': 5,          # More context preserved
    'generator_max_iterations': 45,     # Near Gemini's 50
    'evaluator_max_iterations': 15,     # Same as Gemini
    'max_self_heal_attempts': 3,        # Same as default
    'skills_to_load': [
        'animation-guardrails',         # ~70 lines - CONSTRAINTS FIRST (prevents bad patterns)
        'visual-planning',              # 500 lines - planning process
        'remotion-best-practices',      # 237 lines - essential
        'file-editing-guide',           # 140 lines - tool usage
        # 'motion-graphics' removed - too many options causes random selection
        # 'visual-design' removed - essential parts merged into guardrails
    ],
    'evaluation_mode': 'text',          # Text-based reasoning (no screenshots)
}

# Default configuration (Gemini/OpenRouter - large context window)
DEFAULT_CONFIG = {
    'condenser_max_size': 100,
    'condenser_max_size_eval': 50,
    'condenser_keep_first': 4,
    'generator_max_iterations': 50,
    'evaluator_max_iterations': 15,
    'max_self_heal_attempts': 3,
    'skills_to_load': [
        'animation-guardrails',         # ~70 lines - CONSTRAINTS FIRST (prevents bad patterns)
        'visual-planning',              # 500 lines - planning process
        'remotion-best-practices',      # 237 lines - essential
        'file-editing-guide',           # 140 lines - tool usage
        # 'motion-graphics' removed - too many options causes random selection
        # 'visual-design' removed - essential parts merged into guardrails
    ],
}

# Inline guidance for Claude (compensates for reduced skills)
CLAUDE_INLINE_GUIDANCE = """
## Animation Style: PREMIUM & POLISHED

Based on Disney's 12 Principles + Material Design easing.

### Premium Spring Config (DEFAULT):
```tsx
spring({fps, config: {damping: 20, stiffness: 100, mass: 0.8}})  // Responsive, polished
```

### Key Principles for Expensive-Looking Animation:
1. **Ease-out curve**: Fast start, gentle deceleration (not linear)
2. **Stagger reveals**: delay = index * 6 frames (not all at once)
3. **Arc motion**: Add subtle X movement to Y slides for natural curves
4. **Overlapping action**: Different parts move at different times
5. **Follow-through**: Slight overshoot, then settle to final position

### Motion Formula:
```tsx
// Arc slide (curved path, not straight)
const y = interpolate(progress, [0, 1], [40, 0]);
const x = interpolate(progress, [0, 0.5, 1], [10, 5, 0]);  // Subtle arc
```

### AVOID (Looks Cheap):
- Linear easing (robotic)
- Everything animating at once (chaotic)
- Excessive bounce (damping < 18)
- Shake/wiggle effects (stressful)
- Straight-line movement (use arcs)
- EMOJIS - Never use emojis. Use geometric shapes or styled text instead.
"""

# =============================================================================
# PERSISTENT CONSTRAINTS - Injected into EVERY prompt to survive condensation
# =============================================================================
PERSISTENT_CONSTRAINTS = """
## ANIMATION CONSTRAINTS (ALWAYS APPLY - MANDATORY)

These rules MUST be followed in ALL code you write or modify. Violations cause rejection.

1. **damping >= 20** in ALL spring configs. Use `{ damping: 22, stiffness: 90 }` as default.
2. **NO Math.sin() or Math.cos()** on text positions, rotations, or transforms.
3. **Stagger by 6+ frames**: Each element's delay must differ by `index * 6` minimum.
4. **Clamp text positions**: Use `extrapolateRight: 'clamp'` so text STAYS after entrance.
5. **NO "bouncy/playful/wiggle"** comments - use "premium/elegant/settled" terminology.

### Quick Spring Reference:
```tsx
// CORRECT - Settled, premium motion
const SPRING_SETTLED = { damping: 22, stiffness: 90, mass: 0.9 };

// WRONG - Causes bounce (NEVER USE)
// { damping: 8, stiffness: 200 }  // TOO BOUNCY
// { damping: 12, stiffness: 150 } // STILL TOO BOUNCY
```

Violation of ANY constraint = code will be rejected and you must fix it.
"""


def scan_for_violations(code_content: str) -> list:
    """
    Scan code for animation anti-patterns that must be fixed.
    Returns list of violation dicts with severity, penalty, issue, and fix.
    """
    violations = []

    # CRITICAL: Seesaw/oscillation on text (Math.sin/cos on transforms)
    if re.search(r'Math\.(sin|cos)\s*\(\s*(local)?[Ff]rame', code_content):
        # Check if applied to text/title/rotation
        if re.search(r'(wiggle|oscillat|sway|rotate.*Math\.(sin|cos)|translateY.*Math\.(sin|cos))', code_content, re.IGNORECASE):
            violations.append({
                'severity': 'critical',
                'penalty': 15,
                'issue': 'Seesaw/oscillation detected: Math.sin/cos on text rotation or position',
                'fix': 'Remove Math.sin/cos from text transforms. Text should settle and STAY still.'
            })

    # CRITICAL: Low damping values (causes bounce)
    damping_matches = re.findall(r'damping:\s*(\d+)', code_content)
    for match in damping_matches:
        if int(match) < 18:
            violations.append({
                'severity': 'critical',
                'penalty': 15,
                'issue': f'Excessive bounce: damping: {match} is too low (minimum is 20)',
                'fix': 'Change damping to 22 or higher. Use { damping: 22, stiffness: 90 } as default.'
            })
            break  # Only report once even if multiple instances

    # MAJOR: Intent to create bouncy/playful motion (in comments)
    bouncy_matches = re.findall(r'(bouncy|playful|wiggle|shake|wobble)', code_content, re.IGNORECASE)
    if bouncy_matches:
        violations.append({
            'severity': 'major',
            'penalty': 10,
            'issue': f'Bounce intent detected in code/comments: {", ".join(set(bouncy_matches))}',
            'fix': 'Remove bouncy/playful terminology. Use "premium", "elegant", "settled" motion instead.'
        })

    # MAJOR: No stagger detected (all elements animate simultaneously)
    if re.search(r'\.map\s*\(\s*\([^)]*index', code_content):
        # Has a map with index, check if delay uses index
        if not re.search(r'delay.*index\s*\*\s*[4-9]|index\s*\*\s*[4-9].*delay', code_content):
            if not re.search(r'frame\s*-\s*\(?.*index\s*\*\s*[4-9]', code_content):
                violations.append({
                    'severity': 'major',
                    'penalty': 10,
                    'issue': 'No stagger detected: Elements may animate simultaneously',
                    'fix': 'Add stagger: delay = index * 6 (minimum 6 frames between elements)'
                })

    # MINOR: Missing extrapolateRight clamp on text positions
    if re.search(r'interpolate\s*\([^)]*\)', code_content):
        if not re.search(r"extrapolateRight:\s*['\"]clamp['\"]", code_content):
            # Check if it's for text elements (approximation)
            if re.search(r'(translateY|top|bottom).*interpolate|interpolate.*translateY', code_content, re.IGNORECASE):
                violations.append({
                    'severity': 'minor',
                    'penalty': 5,
                    'issue': 'Text position may not be clamped after entrance',
                    'fix': "Add extrapolateRight: 'clamp' to text position interpolations"
                })

    return violations


def load_config() -> dict:
    """
    Load configuration from config.toml if available.
    Returns empty dict if file not found or invalid.
    """
    config_path = Path(__file__).parent / "config.toml"
    if not config_path.exists():
        return {}

    try:
        # Try to import tomllib (Python 3.11+) or toml package
        try:
            import tomllib
            with open(config_path, "rb") as f:
                return tomllib.load(f)
        except ImportError:
            try:
                import toml
                return toml.load(config_path)
            except ImportError:
                # No TOML parser available, use defaults
                return {}
    except Exception as e:
        emit_event(EVENT_ERROR, message=f"Failed to load config.toml: {e}")
        return {}


# Load config at module level
CONFIG = load_config()


def emit_event(event_type: str, **kwargs):
    """Emit a JSON event to stdout for the TypeScript worker to parse."""
    event = {"type": event_type, **kwargs}
    print(json.dumps(event, default=str), flush=True)


def log_debug(prefix: str, message: str, **kwargs):
    """
    Log to stderr with clear prefix markers for easy filtering.
    Use: grep "\\[EVAL\\]" or grep "\\[ERROR\\]" to filter logs.

    Prefixes: PHASE, EVAL, ERROR, WARN, INFO, TOOL, SCORE
    """
    import time
    timestamp = time.strftime("%H:%M:%S")
    extra = " ".join(f"{k}={v}" for k, v in kwargs.items()) if kwargs else ""
    log_line = f"[{prefix}] {timestamp} {message}"
    if extra:
        log_line += f" | {extra}"
    print(log_line, file=sys.stderr, flush=True)


def emit_tool_call(tool: str, **kwargs):
    """Emit a tool call event."""
    emit_event(EVENT_TOOL_CALL, tool=tool, **kwargs)


def emit_tool_result(tool: str, success: bool, **kwargs):
    """Emit a tool result event with details."""
    emit_event(EVENT_TOOL_RESULT, tool=tool, success=success, **kwargs)


def emit_error(message: str, error_type: str = "unknown", stack_trace: str = None):
    """Emit an error event with full details."""
    log_debug("ERROR", message, error_type=error_type)
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


def compile_to_cjs(workspace: str, project_id: str, bundle_dir: Path) -> bool:
    """
    Compile source TSX to CommonJS for browser dynamic loading.

    The DynamicVisualLoader expects composition.cjs.js (CommonJS format)
    for dynamic execution with a custom require(). This compiles the source
    TSX directly to CommonJS using esbuild.
    """
    src_dir = Path(workspace) / "src" / project_id
    entry_file = src_dir / "index.tsx"
    cjs_file = bundle_dir / "composition.cjs.js"

    emit_tool_call("cjs_compilation", entry_file=str(entry_file), output=str(cjs_file))

    if not entry_file.exists():
        emit_tool_result(
            "cjs_compilation",
            success=False,
            error=f"Entry file not found: {entry_file}"
        )
        return False

    try:
        result = subprocess.run(
            [
                "npx", "esbuild",
                str(entry_file),
                "--bundle",
                "--format=cjs",
                "--platform=browser",
                "--external:react",
                "--external:remotion",
                f"--outfile={cjs_file}"
            ],
            capture_output=True,
            text=True,
            cwd=workspace,
            timeout=60
        )

        if result.returncode == 0:
            emit_tool_result(
                "cjs_compilation",
                success=True,
                message=f"CJS compilation successful: {cjs_file}",
                output_path=str(cjs_file)
            )
            return True
        else:
            emit_tool_result(
                "cjs_compilation",
                success=False,
                error=result.stderr[:500] if result.stderr else "Unknown esbuild error",
                stdout=result.stdout[:500] if result.stdout else ""
            )
            return False

    except subprocess.TimeoutExpired:
        emit_tool_result("cjs_compilation", success=False, error="CJS compilation timed out")
        return False
    except Exception as e:
        emit_tool_result("cjs_compilation", success=False, error=str(e))
        return False


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


def create_generator_agent(
    llm,
    remotion_skill: str,
    style_skill: str,
    file_editing_skill: str,
    planning_skill: str = None,
    motion_graphics_skill: str = None,
    guardrails_skill: str = None,
    condenser_llm=None,
    config: dict = None,
    inline_guidance: str = None,
):
    """Create the generator agent with Remotion skills and file editing tools.

    Args:
        config: Configuration dict with condenser settings (from CLAUDE_CONFIG or DEFAULT_CONFIG)
        guardrails_skill: Animation guardrails (constraints-first, loaded FIRST)
        inline_guidance: Optional inline guidance to add as a skill (for Claude)
    """
    from openhands.sdk import Agent, AgentContext, Tool
    from openhands.sdk.context.skills.skill import Skill
    from openhands.sdk.context.condenser import LLMSummarizingCondenser
    from openhands.sdk.tool import register_tool
    from openhands.tools.file_editor import FileEditorTool
    from openhands.tools.task_tracker import TaskTrackerTool
    from openhands.tools.terminal import TerminalTool, TerminalExecutor

    # Import custom tools
    from tools.write_file import WriteFileTool
    from tools.diff_patch import DiffPatchTool
    from tools.typescript_validator import TypeScriptValidatorTool

    # Use default config if not provided
    if config is None:
        config = DEFAULT_CONFIG

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
    # GUARDRAILS FIRST - Constraints must be seen before any examples/recipes
    # This prevents the LLM from picking random animation patterns
    if guardrails_skill:
        skills.append(Skill(name="animation-guardrails", content=guardrails_skill))
    # Planning skill second - instructs the LLM to think before coding
    if planning_skill:
        skills.append(Skill(name="visual-planning", content=planning_skill))
    # Motion graphics skill - animation recipes (OPTIONAL - may cause option overload)
    if motion_graphics_skill:
        skills.append(Skill(name="motion-graphics", content=motion_graphics_skill))
    if remotion_skill:
        skills.append(Skill(name="remotion-best-practices", content=remotion_skill))
    if style_skill:
        skills.append(Skill(name="visual-design", content=style_skill))
    if file_editing_skill:
        skills.append(Skill(name="file-editing-guide", content=file_editing_skill))
    # Inline guidance for Claude (compensates for reduced skills)
    if inline_guidance:
        skills.append(Skill(name="animation-quick-ref", content=inline_guidance))

    agent_context = AgentContext(skills=skills) if skills else None

    # Configure condenser to prevent context window overflow
    # Uses a cheaper/faster model to summarize conversation history
    condenser = None
    if condenser_llm:
        condenser = LLMSummarizingCondenser(
            llm=condenser_llm,
            max_size=config['condenser_max_size'],
            keep_first=config['condenser_keep_first'],
        )

    return Agent(
        llm=llm,
        tools=[
            Tool(name=TerminalTool.name),
            Tool(name=FileEditorTool.name),
            Tool(name=TaskTrackerTool.name),
            Tool(name="FileToolSet"),
        ],
        agent_context=agent_context,
        condenser=condenser,
    )


def create_visual_evaluator_agent(llm, scoring_rubric: str, condenser_llm=None, config: dict = None):
    """Create the visual evaluator agent focused on screenshot analysis.

    Args:
        config: Configuration dict with condenser settings (from CLAUDE_CONFIG or DEFAULT_CONFIG)
    """
    from openhands.sdk import Agent, AgentContext, Tool
    from openhands.sdk.context.skills.skill import Skill
    from openhands.sdk.context.condenser import LLMSummarizingCondenser
    from openhands.sdk.tool import register_tool
    from openhands.tools.terminal import TerminalExecutor

    # Import visual evaluation tools
    from tools.remotion_render_still import RemotionRenderStillTool
    from tools.submit_score import SubmitScoreTool

    # Use default config if not provided
    if config is None:
        config = DEFAULT_CONFIG

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

    # Configure condenser for visual evaluator
    # Use eval-specific max_size (smaller since evaluator has simpler task)
    condenser = None
    if condenser_llm:
        condenser = LLMSummarizingCondenser(
            llm=condenser_llm,
            max_size=config['condenser_max_size_eval'],
            keep_first=config['condenser_keep_first'] - 1,  # Keep fewer for evaluator
        )

    return Agent(
        llm=llm,
        tools=[Tool(name="VisualToolSet")],
        agent_context=agent_context,
        condenser=condenser,
    )


def create_text_evaluator_agent(llm, scoring_rubric: str, condenser_llm=None, config: dict = None):
    """Create a text-based evaluator agent for Claude (no screenshots).

    This agent evaluates code quality by analyzing the source code directly,
    rather than rendering screenshots. This is more efficient for Claude's
    smaller context window and avoids image token overhead.

    Args:
        llm: The LLM to use for evaluation
        scoring_rubric: The scoring rubric skill content
        condenser_llm: Optional LLM for conversation condensation
        config: Configuration dict with condenser settings
    """
    from openhands.sdk import Agent, AgentContext, Tool
    from openhands.sdk.context.skills.skill import Skill
    from openhands.sdk.context.condenser import LLMSummarizingCondenser
    from openhands.sdk.tool import register_tool

    # Import only SubmitScoreTool (no RemotionRenderStillTool)
    from tools.submit_score import SubmitScoreTool

    # Use default config if not provided
    if config is None:
        config = CLAUDE_CONFIG

    def create_text_eval_tools(conv_state):
        """Create tools for text-based evaluation (SubmitScoreTool only)."""
        tools = []
        tools.extend(SubmitScoreTool.create(conv_state))
        return tools

    register_tool("TextEvalToolSet", create_text_eval_tools)

    skills = []
    if scoring_rubric:
        skills.append(Skill(name="scoring-rubric", content=scoring_rubric))

    agent_context = AgentContext(skills=skills) if skills else None

    # Configure condenser for text evaluator
    condenser = None
    if condenser_llm:
        condenser = LLMSummarizingCondenser(
            llm=condenser_llm,
            max_size=config['condenser_max_size_eval'],
            keep_first=config['condenser_keep_first'] - 1,
        )

    return Agent(
        llm=llm,
        tools=[Tool(name="TextEvalToolSet")],
        agent_context=agent_context,
        condenser=condenser,
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
    iteration: int = 1,
    config: dict = None,
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
## IMMEDIATE ACTION REQUIRED - START NOW

You are a Remotion code generation agent. Your task is to WRITE CODE NOW using the WriteFileTool.
Do NOT ask questions. Do NOT wait for clarification. START WRITING FILES IMMEDIATELY.

Your FIRST action must be: Use WriteFileTool to create the index.tsx file.

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
        message = f"""{PERSISTENT_CONSTRAINTS}

{agent_context}{project_structure}

## VIOLATIONS TO FIX (from previous evaluation):

{visual_feedback}

IMPORTANT:
- Fix ALL violations listed above FIRST
- Remember: damping >= 20, NO Math.sin on text, stagger by 6+ frames
- After making changes, validate TypeScript and fix any errors
- Do NOT finish until TypeScript compiles with ZERO errors

Original task:
{prompt}"""
    else:
        message = f"""{PERSISTENT_CONSTRAINTS}

{agent_context}{project_structure}

{prompt}

CRITICAL REQUIREMENT - SELF-HEALING:
After writing ALL files, you MUST:
1. Run TypeScriptValidatorTool to check for errors
2. If there are ANY errors, fix them
3. Run TypeScriptValidatorTool again
4. Repeat until ZERO errors

ERROR RECOVERY: If you lose context or forget what errors to fix,
read the file `.typescript-errors.txt` in the workspace root.
It contains the current TypeScript errors that need fixing.

Do NOT finish until TypeScript validation passes with no errors.
This is a hard requirement - code that doesn't compile is unacceptable."""

    # Use config if not provided
    if config is None:
        config = DEFAULT_CONFIG

    log_debug("PHASE", "Generator starting", iteration=iteration, max_iter=config['generator_max_iterations'])

    start_time = time.time()
    # Limit iterations to prevent runaway context growth
    # Use config value (25 for Claude, 50 for Gemini)
    conversation = Conversation(agent=agent, workspace=workspace, max_iteration_per_run=config['generator_max_iterations'])

    try:
        conversation.send_message(message)
        conversation.run()

        duration_ms = int((time.time() - start_time) * 1000)
        log_debug("PHASE", "Generator completed", duration_ms=duration_ms)
        emit_tool_result(
            "generator",
            success=True,
            duration_ms=duration_ms,
            message="Generator completed"
        )
    except Exception as e:
        import traceback
        duration_ms = int((time.time() - start_time) * 1000)
        log_debug("ERROR", f"Generator failed: {str(e)[:100]}", duration_ms=duration_ms)
        emit_tool_result(
            "generator",
            success=False,
            duration_ms=duration_ms,
            error=str(e),
            stack_trace=traceback.format_exc()
        )
        return False, str(e)

    # Auto-generate Root.tsx
    log_debug("PHASE", "Generating Root.tsx")
    auto_generate_root_tsx(workspace, project_id)

    # Verify TypeScript compiles (safety check)
    log_debug("PHASE", "TypeScript check")
    ts_success, ts_errors = run_typescript_check(workspace, project_id)

    if not ts_success:
        log_debug("ERROR", f"TypeScript failed", errors=len(ts_errors))
        emit_event(
            EVENT_TYPESCRIPT_CHECK,
            success=False,
            message="Generator finished but TypeScript still has errors",
            error_count=len(ts_errors),
            errors=ts_errors[:5]
        )
        # Return with error info - the outer loop can decide to retry
        return False, f"TypeScript errors: {'; '.join(ts_errors[:3])}"

    log_debug("PHASE", "TypeScript passed")
    emit_event(EVENT_TYPESCRIPT_CHECK, success=True, message="TypeScript validation passed")
    return True, "Generation complete with zero errors"


def generate_transcript_criteria(transcript_segments: list) -> dict:
    """
    Generate specific evaluation criteria from transcript content.

    Extracts:
    - Numbers/statistics that should be animated
    - Key phrases that need visual representation
    - Topics/themes for visual consistency

    Returns dict with 'criteria' list and 'summary' string.
    """
    import re

    criteria = []
    numbers_found = []
    key_phrases = []

    full_text = " ".join(seg.get("text", "") for seg in transcript_segments)

    # Extract numbers and statistics (money, percentages, counts)
    # Money patterns: $1.2M, $500K, $1,000,000
    money_pattern = r'\$[\d,]+(?:\.\d+)?[KMB]?|\$[\d,]+(?:\.\d+)?(?:\s*(?:million|billion|thousand))?'
    money_matches = re.findall(money_pattern, full_text, re.IGNORECASE)
    for m in money_matches[:3]:  # Limit to 3
        numbers_found.append(m.strip())
        criteria.append(f"Number '{m.strip()}' should have counter/tick-up animation (not instant appear)")

    # Percentage patterns: 50%, 25.5%
    pct_pattern = r'\d+(?:\.\d+)?%'
    pct_matches = re.findall(pct_pattern, full_text)
    for m in pct_matches[:2]:  # Limit to 2
        numbers_found.append(m)
        criteria.append(f"Percentage '{m}' should animate (counter or bar fill)")

    # Large numbers: 1,000, 10000, 5M
    num_pattern = r'\b\d{1,3}(?:,\d{3})+\b|\b\d+[KMB]\b|\b(?:one|two|three|five|ten)\s+(?:million|billion|thousand)\b'
    num_matches = re.findall(num_pattern, full_text, re.IGNORECASE)
    for m in num_matches[:2]:
        if m not in numbers_found:
            numbers_found.append(m)
            criteria.append(f"Number '{m}' should have counting animation")

    # Extract key action phrases (verbs + objects that suggest visuals)
    action_patterns = [
        r'(?:increase|grow|rise|boost|double|triple)[sd]?\s+(?:by\s+)?\w+',
        r'(?:decrease|drop|fall|reduce|cut)[sd]?\s+(?:by\s+)?\w+',
        r'(?:launch|release|introduce|announce)[sd]?\s+\w+',
        r'(?:compare|versus|vs\.?)\s+\w+',
    ]
    for pattern in action_patterns:
        matches = re.findall(pattern, full_text, re.IGNORECASE)
        for m in matches[:1]:
            key_phrases.append(m.strip())
            criteria.append(f"Action '{m.strip()}' should have corresponding motion (not static text)")

    # Extract quoted or emphasized content
    quote_pattern = r'"([^"]+)"'
    quotes = re.findall(quote_pattern, full_text)
    for q in quotes[:2]:
        if len(q) < 50:
            key_phrases.append(q)
            criteria.append(f"Quote '{q[:30]}...' should be visually emphasized")

    # Extract brand/product names (capitalized phrases)
    brand_pattern = r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b'
    brands = re.findall(brand_pattern, full_text)
    for b in brands[:2]:
        if b not in ['The', 'This', 'That', 'What', 'How', 'Why']:
            key_phrases.append(b)
            criteria.append(f"Brand/name '{b}' should have intro animation")

    # Add generic criteria if we didn't find enough specific ones
    if len(criteria) < 3:
        criteria.append("Key message from transcript should be visually prominent")
        criteria.append("Visual sequence should follow transcript flow/timing")

    # Build summary
    summary = ""
    if numbers_found:
        summary += f"Numbers to animate: {', '.join(numbers_found[:4])}\n"
    if key_phrases:
        summary += f"Key content: {', '.join(key_phrases[:4])}\n"

    return {
        "criteria": criteria[:6],  # Max 6 specific criteria
        "numbers": numbers_found[:4],
        "phrases": key_phrases[:4],
        "summary": summary.strip() or "Evaluate visual alignment with transcript content"
    }


def run_visual_evaluation(
    agent,
    workspace: str,
    project_id: str,
    transcript_segments: list,
    duration_frames: int,
    fps: int,
    config: dict = None,
    is_claude: bool = False,
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

    # Use config if not provided
    if config is None:
        config = DEFAULT_CONFIG

    emit_event(EVENT_PHASE_START, phase="visual_evaluation", max_iterations=config['evaluator_max_iterations'])

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

    # Build evaluation prompt - limit to 4 frames to save iterations for SubmitScoreTool
    frames_list = "\n".join([
        f"   - Frame {f['frame']}: {f['description']}"
        for f in unique_frames[:4]  # Limit to 4 frames to leave room for SubmitScoreTool
    ])

    # Log which frames will be captured for debugging
    emit_event(
        EVENT_TOOL_CALL,
        tool="visual_evaluation_setup",
        composition_id=composition_id,
        actual_duration=actual_duration,
        passed_duration=duration_frames,
        fps=actual_fps,
        frames_to_capture=[f['frame'] for f in unique_frames[:4]],
        message=f"Will capture {len(unique_frames[:4])} frames from composition '{composition_id}' (actual duration: {actual_duration} frames, passed: {duration_frames})"
    )

    # Generate transcript-specific evaluation criteria
    transcript_criteria = generate_transcript_criteria(transcript_segments)
    criteria_list = "\n".join(f"- [ ] {c}" for c in transcript_criteria["criteria"])
    log_debug("EVAL", f"Generated {len(transcript_criteria['criteria'])} transcript criteria")

    # Claude has limited context - skip screenshots to avoid overflow
    # Use text-based evaluation with code included directly in prompt
    if is_claude:
        log_debug("EVAL", "Starting text-based eval (Claude)", comp=composition_id)
        project_src_path = Path(workspace) / "src" / project_id / "index.tsx"

        # Read the source code to include directly in the prompt
        code_content = ""
        if project_src_path.exists():
            try:
                code_content = project_src_path.read_text(encoding="utf-8")
                line_count = code_content.count('\n') + 1
                log_debug("EVAL", f"Code loaded", lines=line_count)
            except Exception as e:
                log_debug("ERROR", f"Code read failed: {e}")
                code_content = "// Could not read code file"
        else:
            log_debug("WARN", f"Source not found: {project_src_path.name}")

        eval_prompt = f"""Evaluate visual quality using TEXT-BASED REASONING. Analyze the code below.

## Source Code (src/{project_id}/index.tsx):
```tsx
{code_content}
```

## SCORING WEIGHTS (100 total):
- Visual Quality: 50 points (50%)
- Transcript Alignment: 20 points (20%) - SPECIFIC CRITERIA BELOW
- Correctness: 10 points (10%)
- Completeness: 10 points (10%)
- Code Quality: 10 points (10%)

## Animation Quality (0-35 points):
- spring() usage: Look for `spring({{` with damping/stiffness config (+10)
- Staggering: Look for `delay = index * N` patterns (+10)
- Sequence components: Look for `<Sequence from={{N}}` (+5)
- Background motion: Look for animated gradients or particles (+10)

## Visual Effects (0-15 points):
- Scale animations: `transform: \`scale(${{...}})\`` (+5)
- Counter animations: Number interpolation over frames (+5)
- Draw/reveal effects: clipPath or strokeDashoffset (+5)

## Transcript Alignment (0-20 points) - CHECK EACH:
{criteria_list}

Score: +3-4 points for each criterion met (look for the specific content in code)

## Scoring Guide:
- 80-100: Excellent animations + all transcript content visualized
- 60-79: Good animations + most transcript content present
- 40-59: Basic animations, some transcript content missing
- 0-39: Static or transcript content not represented

IMMEDIATELY call SubmitScoreTool:
- visual_quality (0-50): Animation patterns found
- transcript_alignment (0-20): How many criteria above are met
- correctness: 10 (code compiles)
- completeness: 10 (assume complete)
- code_quality: 10 (assume good)
- issues: List unmet transcript criteria
- suggestion: Specific fix for highest-impact missing item

YOU MUST CALL SubmitScoreTool - this is the ONLY way to complete your task."""
    else:
        # Text-based evaluation for all models (no screenshots)
        # This is more reliable and avoids context overflow from images
        log_debug("EVAL", "Starting text-based eval (non-Claude)", comp=composition_id)
        project_src_path = Path(workspace) / "src" / project_id / "index.tsx"

        code_content = ""
        if project_src_path.exists():
            try:
                code_content = project_src_path.read_text(encoding="utf-8")
                line_count = code_content.count('\n') + 1
                log_debug("EVAL", f"Code loaded", lines=line_count)
            except Exception as e:
                log_debug("ERROR", f"Code read failed: {e}")
                code_content = "// Could not read code file"
        else:
            log_debug("WARN", f"Source not found: {project_src_path.name}")

        eval_prompt = f"""Evaluate visual quality by analyzing the code. Code compiles - check animation quality.

## Source Code (src/{project_id}/index.tsx):
```tsx
{code_content}
```

## SCORING WEIGHTS (100 total):
- Visual Quality: 50 points (50%)
- Transcript Alignment: 20 points (20%)
- Correctness: 10 points (10%)
- Completeness: 10 points (10%)
- Code Quality: 10 points (10%)

## Animation Quality (0-35 points) - CHECK CODE FOR:
- spring() with damping/stiffness config (+10)
- Stagger patterns: `delay = index * N` (+10)
- Sequence components: `<Sequence from={{N}}` (+5)
- Background motion: animated gradients or particles (+10)

## Visual Effects (0-15 points):
- Scale animations: `transform: \`scale(${{...}})\`` (+5)
- Counter animations: Number interpolation (+5)
- Draw/reveal: clipPath or strokeDashoffset (+5)

## Transcript-Specific Criteria (0-20 points) - CHECK EACH:
{criteria_list}

## Scoring Guide:
- 80-100: Excellent - spring(), staggering, background motion, all transcript content
- 60-79: Good - some animation variety, most transcript content
- 40-59: Basic - mostly fades, some transcript content missing
- 0-39: Poor - static or transcript content not represented

IMMEDIATELY call SubmitScoreTool:
- visual_quality (0-50): Based on animation patterns in code
- transcript_alignment (0-20): How many criteria above are met
- correctness: 10 (code compiles)
- completeness: 10 (assume complete)
- code_quality: 10 (assume good)
- issues: List specific missing animation patterns
- suggestion: One specific fix with code example

YOU MUST CALL SubmitScoreTool - this is the ONLY way to complete your task."""

    # Log prompt stats (not content)
    prompt_words = len(eval_prompt.split())
    prompt_lines = eval_prompt.count('\n') + 1
    log_debug("EVAL", "Prompt ready", words=prompt_words, lines=prompt_lines, criteria=len(transcript_criteria["criteria"]))
    start_time = time.time()

    # Retry logic for LLM failures (empty responses, rate limits, etc.)
    max_retries = 3
    retry_delay = 5  # seconds
    last_error = None

    for attempt in range(max_retries):
        try:
            log_debug("EVAL", f"LLM call attempt", attempt=attempt+1)
            # Evaluator needs to: render stills, analyze images, submit score
            # Use config value (8 for Claude, 15 for Gemini)
            conversation = Conversation(agent=agent, workspace=workspace, max_iteration_per_run=config['evaluator_max_iterations'])
            conversation.send_message(eval_prompt)
            conversation.run()
            duration_ms = int((time.time() - start_time) * 1000)
            log_debug("EVAL", f"LLM completed", duration_ms=duration_ms)
            break  # Success - exit retry loop
        except Exception as e:
            last_error = e
            error_str = str(e).lower()
            log_debug("ERROR", f"LLM call failed", attempt=attempt+1, error=str(e)[:100])

            # Check if it's a retryable error (empty response, rate limit, timeout)
            is_retryable = any(indicator in error_str for indicator in [
                "empty", "choices", "rate", "limit", "timeout", "429", "503", "overloaded"
            ])

            if is_retryable and attempt < max_retries - 1:
                log_debug("WARN", f"Retrying in {retry_delay}s", attempt=attempt+1)
                time.sleep(retry_delay)
                retry_delay *= 2  # Exponential backoff
                continue
            else:
                # Non-retryable error or max retries reached
                log_debug("ERROR", f"Eval failed (non-retryable)", attempts=attempt+1)
                return {
                    "score": 20,  # Low score but not zero since code compiles
                    "breakdown": {
                        "visualQuality": 0,
                        "transcriptAlignment": 0,
                        "correctness": 10,
                        "completeness": 5,
                        "codeQuality": 5,
                    },
                    "issues": [f"Visual evaluation failed after {attempt + 1} attempts: {str(e)}"],
                    "suggestion": "LLM API issues - check API key, quota, and model availability"
                }
    else:
        # All retries exhausted
        log_debug("ERROR", f"All retries exhausted", retries=max_retries)
        return {
            "score": 20,
            "breakdown": {
                "visualQuality": 0,
                "transcriptAlignment": 0,
                "correctness": 10,
                "completeness": 5,
                "codeQuality": 5,
            },
            "issues": [f"Visual evaluation failed after {max_retries} retries: {str(last_error)}"],
            "suggestion": "LLM API consistently failing - check service status"
        }

    # Get score from SubmitScoreTool
    score_result = get_last_score()

    if score_result is None:
        log_debug("WARN", "SubmitScoreTool NOT called - using fallback score")
        # SubmitScoreTool was never called - this usually means:
        # 1. Evaluator hit max iterations before calling SubmitScoreTool
        # 2. Screenshot rendering failed and agent gave up
        # 3. LLM didn't understand it needs to call the tool
        # Fallback with diagnostic message
        score_result = {
            "score": 30,
            "breakdown": {
                "visualQuality": 10,
                "transcriptAlignment": 0,
                "correctness": 10,
                "completeness": 5,
                "codeQuality": 5,
            },
            "issues": ["Evaluator did not call SubmitScoreTool - may have hit iteration limit or encountered errors"],
            "suggestion": "Check evaluator logs. The LLM may need more iterations or clearer instructions to complete evaluation."
        }
    else:
        # Extract visual_quality from breakdown (stored as camelCase)
        breakdown = score_result.get("breakdown", {})
        visual_quality = breakdown.get("visualQuality", 0)
        transcript_alignment = breakdown.get("transcriptAlignment", 0)
        log_debug("SCORE", f"Score received", score=score_result.get("score", 0), visual=visual_quality, transcript=transcript_alignment)

    # =======================================================================
    # VIOLATION SCANNING - Apply penalties for bad animation patterns
    # This catches issues the LLM evaluator might miss (seesaw, bounce, etc.)
    # =======================================================================
    if code_content:
        violations = scan_for_violations(code_content)
        if violations:
            total_penalty = sum(v['penalty'] for v in violations)
            original_score = score_result.get("score", 0)
            adjusted_score = max(0, original_score - total_penalty)

            # Log violations
            log_debug("SCORE", f"Violations found", count=len(violations), penalty=total_penalty)
            for v in violations:
                log_debug("VIOLATION", f"[{v['severity'].upper()}] {v['issue']}", penalty=v['penalty'])

            # Update score_result with violations
            score_result["score"] = adjusted_score
            score_result["original_score"] = original_score
            score_result["violation_penalty"] = total_penalty

            # Add violations to issues list
            existing_issues = score_result.get("issues", [])
            violation_issues = [f"[{v['severity'].upper()}] {v['issue']}" for v in violations]
            score_result["issues"] = violation_issues + existing_issues

            # Update suggestion with first critical fix
            critical_violations = [v for v in violations if v['severity'] == 'critical']
            if critical_violations:
                score_result["suggestion"] = critical_violations[0]['fix']

            emit_event(
                EVENT_TOOL_CALL,
                tool="violation_scanner",
                violations_found=len(violations),
                total_penalty=total_penalty,
                original_score=original_score,
                adjusted_score=adjusted_score,
                violations=[{"severity": v["severity"], "issue": v["issue"]} for v in violations]
            )

    # Get breakdown values for the event
    breakdown = score_result.get("breakdown", {})
    emit_event(
        EVENT_VISUAL_EVALUATION,
        score=score_result.get("score", 0),
        visual_quality=breakdown.get("visualQuality", 0),
        transcript_alignment=breakdown.get("transcriptAlignment", 0),
        issues=score_result.get("issues", []),
        suggestion=score_result.get("suggestion", ""),
        duration_ms=duration_ms,
        violation_penalty=score_result.get("violation_penalty", 0)
    )

    return score_result


def main():
    parser = argparse.ArgumentParser(description="OpenHands Visual Generator with Self-Healing")
    parser.add_argument("--workspace", default=os.environ.get("REMOTION_PROJECT_DIR", "/opt/remotion-template"),
                        help="Path to Remotion project (default: $REMOTION_PROJECT_DIR)")
    parser.add_argument("--output-dir", default="/output", help="Directory to copy source files (mounted from host)")
    parser.add_argument("--bundle-dir", default="/bundles", help="Directory to export bundle (mounted from host)")
    parser.add_argument("--project-id", required=True, help="Composition ID")
    parser.add_argument("--model", required=True, help="LLM model for code generation (Pro)")
    parser.add_argument("--model-flash", help="LLM model for evaluation/other tasks (Flash). Defaults to --model")
    parser.add_argument("--prompt-file", required=True, help="Path to prompt file")
    parser.add_argument("--base-url", required=True, help="LLM API base URL")
    parser.add_argument("--api-key", default="not-needed", help="LLM API key")
    parser.add_argument("--duration-frames", type=int, default=900, help="Video duration in frames")
    parser.add_argument("--fps", type=int, default=30, help="Video FPS")
    parser.add_argument("--width", type=int, default=1080, help="Visual width in pixels")
    parser.add_argument("--height", type=int, default=1920, help="Visual height in pixels")
    parser.add_argument("--temperature", type=float, default=1.0, help="LLM temperature (1.0 required for Gemini 3.x)")
    parser.add_argument("--max-iterations", type=int, default=MAX_ITERATIONS, help="Max visual improvement iterations")
    parser.add_argument("--quality-threshold", type=int, default=QUALITY_THRESHOLD, help="Quality score threshold")
    args = parser.parse_args()

    # API key comes directly from argument
    api_key = args.api_key

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

    # Detect Claude and select appropriate config
    is_claude = is_claude_model(args.model)
    config = CLAUDE_CONFIG if is_claude else DEFAULT_CONFIG
    log_debug("PHASE", "=== Starting ===", model=args.model, is_claude=is_claude)

    emit_event(
        EVENT_STARTED,
        model=args.model,
        base_url=args.base_url,
        workspace=args.workspace,
        max_iterations=args.max_iterations,
        width=args.width,
        height=args.height,
        temperature=args.temperature,
        provider="claude-proxy" if is_claude else "openrouter",
        context_mode="aggressive" if is_claude else "default",
        condenser_max_size=config['condenser_max_size'],
        skills_to_load=config['skills_to_load'],
    )

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
        # Configure LLM for code generation (Pro - higher quality)
        # When using custom base URL (Claude Max proxy or OpenRouter), use openai/* format for litellm
        # The base URL determines the actual provider
        generator_llm = LLM(
            model=f"openai/{args.model}",
            api_key=SecretStr(api_key),
            base_url=args.base_url,  # OpenHands SDK uses base_url, not api_base
            temperature=args.temperature,
            usage_id="code-generation",  # For cost tracking
        )

        # Configure LLM for evaluation (Flash - faster, cheaper)
        # Use flash model if specified, otherwise fall back to main model
        flash_model = args.model_flash or args.model
        evaluator_llm = LLM(
            model=f"openai/{flash_model}",
            api_key=SecretStr(api_key),
            base_url=args.base_url,  # OpenHands SDK uses base_url, not api_base
            temperature=args.temperature,
            usage_id="visual-evaluation",  # For cost tracking
        )

        emit_event(
            EVENT_TOOL_CALL,
            tool="config",
            message=f"Generator: {args.model}, Evaluator: {flash_model}, Base URL: {args.base_url}",
            context_mode="aggressive" if is_claude else "default",
            condenser_max_size=config['condenser_max_size'],
            generator_max_iterations=config['generator_max_iterations'],
            evaluator_max_iterations=config['evaluator_max_iterations'],
        )

        # Load skills based on config (Claude loads fewer to save context)
        skills_dir = Path(__file__).parent / "skills"
        skills_to_load = config['skills_to_load']

        # Only load skills that are in the config
        # GUARDRAILS MUST BE LOADED FIRST - prevents bad animation patterns
        guardrails_skill = load_skill(skills_dir / "animation-guardrails.md") if 'animation-guardrails' in skills_to_load else None
        planning_skill = load_skill(skills_dir / "visual-planning.md") if 'visual-planning' in skills_to_load else None
        motion_graphics_skill = load_skill(skills_dir / "motion-graphics.md") if 'motion-graphics' in skills_to_load else None
        remotion_skill = load_skill(skills_dir / "remotion-best-practices.md") if 'remotion-best-practices' in skills_to_load else None
        style_skill = load_skill(skills_dir / "visual-design.md") if 'visual-design' in skills_to_load else None
        file_editing_skill = load_skill(skills_dir / "file-editing-guide.md") if 'file-editing-guide' in skills_to_load else None
        # Scoring rubric is always loaded for evaluator
        scoring_rubric = load_skill(skills_dir / "scoring-rubric.md")

        # Inline guidance for Claude (compensates for reduced skills)
        inline_guidance = CLAUDE_INLINE_GUIDANCE if is_claude else None

        # Create agents with appropriate models and config
        # Generator uses Pro for high-quality code generation
        # Use the flash model for the condenser (summarizes conversation history when it gets too long)
        generator_agent = create_generator_agent(
            generator_llm,
            remotion_skill,
            style_skill,
            file_editing_skill,
            planning_skill=planning_skill,
            motion_graphics_skill=motion_graphics_skill,
            guardrails_skill=guardrails_skill,  # GUARDRAILS - loaded first in skills list
            condenser_llm=evaluator_llm,  # Use cheaper flash model for condensation
            config=config,
            inline_guidance=inline_guidance,
        )
        # Evaluator uses text-based analysis (no screenshots - more reliable)
        visual_evaluator = create_text_evaluator_agent(
            evaluator_llm,
            scoring_rubric,
            condenser_llm=evaluator_llm,
            config=config,
        )

        # State tracking
        best_score = 0
        best_iteration = 0
        visual_feedback = None
        final_status = "failed"

        for iteration in range(args.max_iterations):
            if cancelled:
                break

            log_debug("PHASE", f"=== Iteration {iteration + 1}/{args.max_iterations} ===")
            emit_event(EVENT_PHASE_START, phase="iteration", iteration=iteration + 1, max_iterations=args.max_iterations)

            # ===== PHASE 1: Generate with self-healing =====
            gen_success, gen_message = run_generator_with_self_healing(
                generator_agent,
                args.workspace,
                prompt,
                args.project_id,
                visual_feedback,
                iteration=iteration + 1,
                config=config,
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
                args.fps,
                config=config,
                is_claude=is_claude,
            )

            current_score = score_result.get("score", 0)
            log_debug("SCORE", f"Iteration result", iteration=iteration+1, score=current_score, threshold=args.quality_threshold)

            # Track best
            if current_score > best_score:
                best_score = current_score
                best_iteration = iteration + 1
                log_debug("SCORE", f"New best score", best=best_score)

            # Extract breakdown values
            breakdown = score_result.get("breakdown", {})
            visual_quality = breakdown.get("visualQuality", 0)
            transcript_alignment = breakdown.get("transcriptAlignment", 0)

            emit_event(
                EVENT_ITERATION_COMPLETE,
                iteration=iteration + 1,
                score=current_score,
                visual_quality=visual_quality,
                transcript_alignment=transcript_alignment,
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
Visual Quality: {visual_quality}/50
Transcript Alignment: {transcript_alignment}/20

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

        # ===== DIMENSION VALIDATION =====
        # Ensure metadata.json has correct dimensions (agent might have ignored them)
        metadata_path = project_dir / "metadata.json"
        if metadata_path.exists():
            try:
                import json
                metadata = json.loads(metadata_path.read_text(encoding='utf-8'))
                expected_width = args.width
                expected_height = args.height
                actual_width = metadata.get('width', 0)
                actual_height = metadata.get('height', 0)

                if actual_width != expected_width or actual_height != expected_height:
                    emit_event(
                        EVENT_TOOL_CALL,
                        tool="dimension_correction",
                        message=f"Correcting dimensions: {actual_width}x{actual_height} -> {expected_width}x{expected_height}",
                        original_width=actual_width,
                        original_height=actual_height,
                        corrected_width=expected_width,
                        corrected_height=expected_height
                    )
                    # Auto-correct the dimensions
                    metadata['width'] = expected_width
                    metadata['height'] = expected_height
                    metadata_path.write_text(json.dumps(metadata, indent=2), encoding='utf-8')
                else:
                    emit_event(
                        EVENT_TOOL_CALL,
                        tool="dimension_validation",
                        message=f"Dimensions correct: {expected_width}x{expected_height}",
                        success=True
                    )
            except Exception as e:
                emit_event(EVENT_ERROR, message=f"Failed to validate dimensions: {e}")

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
            log_debug("PHASE", "=== Bundling ===", composition=composition_id)
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
                    log_debug("PHASE", "Bundle command succeeded")
                    # Verify bundle was created
                    bundle_index = bundle_output / "index.html"

                    # List what files were actually created for debugging
                    if bundle_output.exists():
                        created_files = list(bundle_output.glob("*"))
                        log_debug("INFO", f"Bundle files: {len(created_files)}")

                    if bundle_index.exists():
                        bundle_success = True
                        log_debug("PHASE", "Bundle verified (index.html found)")
                        # Fix absolute paths in index.html to be relative
                        fix_bundle_paths(bundle_output)
                        # Compile source TSX to CJS for browser dynamic loading
                        compile_to_cjs(args.workspace, args.project_id, bundle_output)
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
                                # Compile source TSX to CJS for browser dynamic loading
                                compile_to_cjs(args.workspace, args.project_id, subdir)
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
                    log_debug("ERROR", f"Bundle failed", returncode=result.returncode)
                    emit_tool_result(
                        "remotion_bundle",
                        success=False,
                        error=result.stderr[:500] if result.stderr else "Unknown bundling error",
                        stdout=result.stdout[:500] if result.stdout else "",
                        exit_code=result.returncode
                    )

            except subprocess.TimeoutExpired:
                log_debug("ERROR", "Bundle timeout (5min)")
                emit_tool_result("remotion_bundle", success=False, error="Bundling timed out after 5 minutes")
            except Exception as e:
                log_debug("ERROR", f"Bundle exception: {str(e)[:100]}")
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
            log_debug("PHASE", "=== Rendering ===", composition=composition_id)
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
                    log_debug("PHASE", "Video rendered", url=video_url)
                    emit_tool_result(
                        "remotion_render",
                        success=True,
                        message=f"Video rendered successfully",
                        video_path=str(video_output_path),
                        video_url=video_url
                    )
                else:
                    log_debug("ERROR", f"Render failed", returncode=render_result.returncode)
                    emit_tool_result(
                        "remotion_render",
                        success=False,
                        error=render_result.stderr[:500] if render_result.stderr else "Render failed",
                        video_exists=video_output_path.exists()
                    )

            except subprocess.TimeoutExpired:
                log_debug("ERROR", "Render timeout (10min)")
                emit_tool_result("remotion_render", success=False, error="Rendering timed out after 10 minutes")
            except Exception as e:
                log_debug("ERROR", f"Render exception: {str(e)[:100]}")
                emit_tool_result("remotion_render", success=False, error=str(e))

        log_debug("PHASE", "=== Complete ===", status=final_status, score=best_score, bundle=bundle_success)
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
