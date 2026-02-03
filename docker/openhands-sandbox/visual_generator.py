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
import time
import concurrent.futures
from pathlib import Path
from typing import Optional

# Set logging levels to suppress verbose output
logging.getLogger("openhands").setLevel(logging.ERROR)
logging.getLogger("litellm").setLevel(logging.ERROR)
logging.getLogger("httpx").setLevel(logging.ERROR)
logging.getLogger("httpcore").setLevel(logging.ERROR)
logging.getLogger("LiteLLM").setLevel(logging.ERROR)


# =============================================================================
# TIMEOUT UTILITIES - Prevent hanging on slow LLM API calls
# =============================================================================

class ConversationTimeoutError(Exception):
    """Raised when a conversation.run() call exceeds the timeout."""
    pass


def run_with_timeout(func, timeout_seconds: int, *args, **kwargs):
    """
    Run a function with a timeout using ThreadPoolExecutor.

    Works on both Windows and Unix (unlike signal-based timeouts).

    Args:
        func: The function to run
        timeout_seconds: Maximum seconds to wait
        *args, **kwargs: Arguments to pass to the function

    Returns:
        The result of func(*args, **kwargs)

    Raises:
        ConversationTimeoutError: If the function doesn't complete in time
    """
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(func, *args, **kwargs)
        try:
            return future.result(timeout=timeout_seconds)
        except concurrent.futures.TimeoutError:
            raise ConversationTimeoutError(
                f"Operation timed out after {timeout_seconds} seconds. "
                "The LLM API may be slow or unresponsive. Try again or check the API status."
            )


# Default timeouts for different operations (in seconds)
GENERATOR_TIMEOUT = 600  # 10 minutes for code generation
EVALUATOR_TIMEOUT = 300  # 5 minutes for evaluation
PLANNING_TIMEOUT = 180   # 3 minutes for visual planning


# =============================================================================
# PROJECT OUTPUT - Unified output structure for all artifacts
# =============================================================================

class ProjectOutput:
    """
    Unified project output manager.

    Creates a clean, organized structure for all project artifacts:

    bundles/{project-id}/
    ├── logs/
    │   └── generation.log      # Clean structured logs (JSON lines)
    ├── plans/
    │   ├── visual-plan.json    # Parsed visual plan
    │   ├── raw-response.txt    # Raw LLM output for debugging
    │   └── thinking.txt        # Planning reasoning/thinking
    ├── src/
    │   ├── index.tsx           # Main composition (copied from workspace)
    │   ├── constants.ts        # Colors, spring configs
    │   └── metadata.json       # Composition metadata
    ├── build/
    │   ├── index.html          # Bundle entry point
    │   ├── bundle.js           # Compiled JavaScript
    │   └── ...                 # Other bundle assets
    ├── video.mp4               # Rendered video (if successful)
    └── summary.json            # Final run summary
    """
    _project_dir: Path = None
    _log_file: Path = None
    _initialized: bool = False

    @classmethod
    def init(cls, bundle_dir: str, project_id: str):
        """Initialize project output directory structure."""
        composition_id = project_id.replace('_', '-')
        cls._project_dir = Path(bundle_dir) / composition_id

        # Create directory structure
        (cls._project_dir / "logs").mkdir(parents=True, exist_ok=True)
        (cls._project_dir / "plans").mkdir(parents=True, exist_ok=True)
        (cls._project_dir / "src").mkdir(parents=True, exist_ok=True)
        (cls._project_dir / "build").mkdir(parents=True, exist_ok=True)

        # Initialize log file
        cls._log_file = cls._project_dir / "logs" / "generation.log"
        cls._log_file.write_text("", encoding="utf-8")
        cls._initialized = True

        cls._log("INIT", f"Project output initialized: {cls._project_dir}")

    @classmethod
    def _log(cls, level: str, message: str, **data):
        """Write a structured log entry."""
        if not cls._initialized or cls._log_file is None:
            return
        import time
        timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
        entry = {"ts": timestamp, "level": level, "msg": message}
        if data:
            entry["data"] = data
        try:
            with open(cls._log_file, "a", encoding="utf-8") as f:
                f.write(json.dumps(entry, default=str) + "\n")
        except Exception:
            pass

    # Logging methods
    @classmethod
    def info(cls, message: str, **data):
        cls._log("INFO", message, **data)

    @classmethod
    def phase(cls, message: str, **data):
        cls._log("PHASE", message, **data)

    @classmethod
    def plan(cls, message: str, **data):
        cls._log("PLAN", message, **data)

    @classmethod
    def warn(cls, message: str, **data):
        cls._log("WARN", message, **data)

    @classmethod
    def error(cls, message: str, **data):
        cls._log("ERROR", message, **data)

    @classmethod
    def llm(cls, message: str, **data):
        cls._log("LLM", message, **data)

    # Plan artifact methods
    @classmethod
    def save_visual_plan(cls, plan: dict) -> Optional[str]:
        """Save the parsed visual plan."""
        if not cls._initialized:
            return None
        path = cls._project_dir / "plans" / "visual-plan.json"
        path.write_text(json.dumps(plan, indent=2), encoding="utf-8")
        cls._log("ARTIFACT", "Saved visual plan", path=str(path), scenes=len(plan.get("scenes", [])))
        return str(path)

    @classmethod
    def save_plan_raw_response(cls, response: str) -> Optional[str]:
        """Save the raw LLM response from planning."""
        if not cls._initialized:
            return None
        path = cls._project_dir / "plans" / "raw-response.txt"
        path.write_text(response, encoding="utf-8")
        cls._log("ARTIFACT", "Saved raw planning response", chars=len(response))
        return str(path)

    @classmethod
    def save_plan_thinking(cls, thinking: str) -> Optional[str]:
        """Save the thinking/reasoning from planning."""
        if not cls._initialized:
            return None
        path = cls._project_dir / "plans" / "thinking.txt"
        path.write_text(thinking, encoding="utf-8")
        cls._log("ARTIFACT", "Saved planning thinking", chars=len(thinking))
        return str(path)

    # Source code methods
    @classmethod
    def copy_source(cls, workspace: str, project_id: str) -> bool:
        """Copy final source code from workspace to output, including subdirectories."""
        if not cls._initialized:
            return False
        import shutil
        src_dir = Path(workspace) / "src" / project_id
        if not src_dir.exists():
            cls._log("WARN", "Source directory not found", path=str(src_dir))
            return False

        dest_dir = cls._project_dir / "src"
        dest_dir.mkdir(parents=True, exist_ok=True)

        # Copy all source files and directories (including components/)
        file_count = 0
        dir_count = 0
        for item in src_dir.glob("*"):
            if item.is_file():
                shutil.copy2(item, dest_dir / item.name)
                file_count += 1
            elif item.is_dir():
                # Copy subdirectories like components/, utils/, etc.
                dest_subdir = dest_dir / item.name
                if dest_subdir.exists():
                    shutil.rmtree(dest_subdir)
                shutil.copytree(item, dest_subdir)
                dir_count += 1
                # Count files in subdirectory
                file_count += sum(1 for _ in item.rglob("*") if _.is_file())

        cls._log("ARTIFACT", "Copied source files", count=file_count, dirs=dir_count, from_dir=str(src_dir))
        return file_count > 0

    @classmethod
    def get_build_dir(cls) -> Optional[Path]:
        """Get the build output directory path."""
        if not cls._initialized:
            return None
        return cls._project_dir / "build"

    @classmethod
    def save_error(cls, error_type: str, message: str, traceback: str = None):
        """Save error details for debugging."""
        if not cls._initialized:
            return
        path = cls._project_dir / "logs" / f"error-{error_type}.txt"
        content = f"Error Type: {error_type}\nMessage: {message}\n"
        if traceback:
            content += f"\nTraceback:\n{traceback}"
        path.write_text(content, encoding="utf-8")
        cls._log("ERROR", message, error_type=error_type)

    @classmethod
    def save_summary(cls, **data) -> Optional[str]:
        """Save the final run summary."""
        if not cls._initialized:
            return None
        import time
        summary = {
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "project_dir": str(cls._project_dir),
            **data
        }
        path = cls._project_dir / "summary.json"
        path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
        cls._log("ARTIFACT", "Saved summary", status=data.get("status"))
        return str(path)

    @classmethod
    def get_project_dir(cls) -> Optional[Path]:
        """Get the project output directory."""
        return cls._project_dir if cls._initialized else None

    @classmethod
    def get_log_path(cls) -> Optional[str]:
        """Get the path to the log file."""
        return str(cls._log_file) if cls._initialized else None


# Backwards compatibility alias
FileLogger = ProjectOutput


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
EVENT_PLANNING_START = "planning_start"
EVENT_PLANNING_THINKING = "planning_thinking"
EVENT_PLANNING_COMPLETE = "planning_complete"
EVENT_PLANNING_ERROR = "planning_error"

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


# Models with ~256K or smaller context windows
# These need aggressive context management to avoid overflow
SMALL_CONTEXT_MODELS = [
    'mimo',                 # MiMo v2 Flash - 262K context
    'grok-code-fast',       # xAI Grok Code Fast 1
    'minimax-m2',           # MiniMax M2
]


def is_small_context_model(model_name: str) -> bool:
    """Detect models with ~256K or smaller context windows."""
    model_lower = model_name.lower()
    return any(pattern in model_lower for pattern in SMALL_CONTEXT_MODELS)


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
        'animation-guardrails',         # ~148 lines - CONSTRAINTS FIRST (prevents bad patterns)
        'visual-planning',              # 500 lines - planning process
        'remotion-best-practices',      # 237 lines - essential
        'file-editing-guide',           # 140 lines - tool usage
        'component-library',            # 2503 lines - pre-built cinematic components
        'animation-techniques',         # 800 lines - technique implementations
        # 'motion-graphics' removed - too many options causes random selection
        # 'visual-design' removed - essential parts merged into guardrails
    ],
    'evaluation_mode': 'text',          # Text-based reasoning (no screenshots)
}

# Default configuration (Gemini/OpenRouter - large context window ~1M tokens)
DEFAULT_CONFIG = {
    'condenser_max_size': 100,
    'condenser_max_size_eval': 50,
    'condenser_keep_first': 4,
    'generator_max_iterations': 50,
    'evaluator_max_iterations': 15,
    'max_self_heal_attempts': 3,
    'skills_to_load': [
        'animation-guardrails',         # ~148 lines - CONSTRAINTS FIRST (prevents bad patterns)
        'visual-planning',              # 500 lines - planning process
        'remotion-best-practices',      # 237 lines - essential
        'file-editing-guide',           # 140 lines - tool usage
        'component-library',            # 2503 lines - pre-built cinematic components
        'animation-techniques',         # 800 lines - technique implementations
        # 'motion-graphics' removed - too many options causes random selection
        # 'visual-design' removed - essential parts merged into guardrails
    ],
}

# Configuration for MiMo and other 256K context models
# Total skill budget: ~500 lines to leave room for prompt + conversation
SMALL_CONTEXT_CONFIG = {
    'condenser_max_size': 20,           # Aggressive condensing - summarize after 20 messages
    'condenser_max_size_eval': 10,      # Even more aggressive for eval
    'condenser_keep_first': 2,          # Keep only system + first user message
    'generator_max_iterations': 30,     # Fewer iterations to prevent context blowup
    'evaluator_max_iterations': 8,      # Fewer eval iterations
    'max_self_heal_attempts': 2,        # Fewer retries
    'skills_to_load': [
        'animation-guardrails',         # ~148 lines - ESSENTIAL constraints
        'remotion-best-practices',      # ~237 lines - core Remotion patterns
        # NOTE: component-library (2503 lines) and animation-techniques (800 lines)
        # are TOO LARGE for 256K context. Agent must generate from scratch.
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

1. **damping >= 15** in ALL spring configs. Use `{ damping: 20, stiffness: 100 }` as default.
2. **NO Math.sin() or Math.cos()** on text positions, rotations, or transforms.
3. **Stagger by 6+ frames**: Each element's delay must differ by `index * 6` minimum.
4. **Clamp text positions**: Use `extrapolateRight: 'clamp'` so text STAYS after entrance.
5. **NO "bouncy/playful/wiggle"** comments - use "premium/elegant/settled" terminology.

### CRITICAL: Constants & Scope Rules
- **Put ALL constants in constants.ts** - NOT inside components
- **Export and import** spring configs, colors, sizes from constants.ts
- Child components CANNOT access variables defined inside parent components
- If a value is used in multiple components, it MUST be in constants.ts

### Quick Spring Reference:
```tsx
// CORRECT - Settled, premium motion
const SPRING_SETTLED = { damping: 20, stiffness: 100, mass: 0.8 };

// ALSO ACCEPTABLE
// { damping: 15, stiffness: 120 }  // Slightly more responsive
// { damping: 18, stiffness: 100 }  // Good balance

// WRONG - Causes excessive bounce (NEVER USE)
// { damping: 8, stiffness: 200 }   // TOO BOUNCY
// { damping: 10, stiffness: 150 }  // STILL TOO BOUNCY
```

### Component Library (USE IT!)
Before creating any component, check skills/component-library.md:
- ProcessFlow, ComparisonSplit, TreeDiagram - structural components
- ParticleEmitter, MaskReveal, FadeInBlur - animation components
- CodeBlock, Terminal, BigNumber - display components
- GlassCard - container with glass effect

**Copy code from the library - don't reinvent!**

### TASK COMPLETION:
Your task is COMPLETE when TypeScriptValidatorTool shows "No errors found".
Once TypeScript passes - STOP IMMEDIATELY. Do not make more changes. Your job is done.

### DO NOT WASTE ITERATIONS:
- Do NOT use task_tracker - start coding immediately
- Do NOT run exploratory commands (find, ls, etc.) - the project structure is in the prompt
- Do NOT plan excessively - write code first, fix errors after
- Every iteration counts - make progress on EVERY turn

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
    # Note: damping 15-17 can work for some effects, but <15 is always too bouncy
    damping_matches = re.findall(r'damping:\s*(\d+)', code_content)
    for match in damping_matches:
        if int(match) < 15:  # Relaxed from 18 - damping 15+ is acceptable
            violations.append({
                'severity': 'critical',
                'penalty': 10,  # Reduced from 15
                'issue': f'Excessive bounce: damping: {match} is too low (minimum is 15)',
                'fix': 'Change damping to 18 or higher. Use { damping: 20, stiffness: 100 } as default.'
            })
            break  # Only report once even if multiple instances

    # MAJOR: Intent to create bouncy/playful motion (in comments)
    # Note: Exclude legitimate uses like "screen-shake", "camera-shake" for impact effects
    # and "playful" as a style preset name
    bouncy_matches = re.findall(r'(bouncy|wiggle|wobble)', code_content, re.IGNORECASE)

    # Check for problematic "shake" usage (not screen-shake or camera-shake)
    shake_matches = re.findall(r'(?<!screen-)(?<!camera-)(?<!impact-)\bshake\b', code_content, re.IGNORECASE)
    # Filter out shake in effect contexts like "effects": ["camera-shake"]
    if shake_matches:
        # Check if shake is used in problematic context (not as effect name)
        problematic_shake = [m for m in shake_matches if not re.search(r'["\'].*shake.*["\']', code_content)]
        if problematic_shake:
            bouncy_matches.extend(['shake'] * len(problematic_shake))

    # Check for "playful" only if it's describing motion, not style preset
    playful_matches = re.findall(r'playful\s+(motion|animation|bounce|movement)', code_content, re.IGNORECASE)
    if playful_matches:
        bouncy_matches.append('playful motion')

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


def extract_visuals_from_code(code_content: str, fps: int = 30) -> list:
    """
    Extract visual timestamps from generated Remotion code by parsing Sequence components.
    Returns list of visual dicts with startMs, endMs, type, and description.
    """
    visuals = []

    # Pattern to find Sequence components with from and durationInFrames
    # Matches: <Sequence from={X} durationInFrames={Y}>
    sequence_pattern = re.compile(
        r'<Sequence[^>]*\s+from=\{?\s*(\d+)\s*\}?[^>]*\s+durationInFrames=\{?\s*(\d+)\s*\}?[^>]*>',
        re.IGNORECASE
    )

    # Alternative pattern: from={X}> without explicit duration
    sequence_alt_pattern = re.compile(
        r'<Sequence[^>]*\s+from=\{?\s*(\d+)\s*\}?[^>]*>',
        re.IGNORECASE
    )

    # Pattern to find component names inside Sequence
    component_pattern = re.compile(r'<(\w+)(?:\s|/>|>)')

    # Find all Sequence blocks
    for match in sequence_pattern.finditer(code_content):
        start_frame = int(match.group(1))
        duration_frames = int(match.group(2))
        start_ms = int((start_frame / fps) * 1000)
        end_ms = int(((start_frame + duration_frames) / fps) * 1000)

        # Try to find what's inside this Sequence
        seq_start = match.end()
        # Find closing tag (simplified - find next component)
        seq_content = code_content[seq_start:seq_start + 500]
        comp_match = component_pattern.search(seq_content)
        component_name = comp_match.group(1) if comp_match else "Visual"

        # Skip if it's just a div or other HTML element
        if component_name.lower() in ['div', 'span', 'p', 'h1', 'h2', 'h3', 'style']:
            component_name = "Visual Element"

        visuals.append({
            'startMs': start_ms,
            'endMs': end_ms,
            'type': component_name,
            'description': f'{component_name} animation ({start_frame}-{start_frame + duration_frames} frames)'
        })

    # Also find Sequences without explicit duration (they run to end)
    for match in sequence_alt_pattern.finditer(code_content):
        start_frame = int(match.group(1))
        # Check if this was already captured
        if any(v['startMs'] == int((start_frame / fps) * 1000) for v in visuals):
            continue

        start_ms = int((start_frame / fps) * 1000)

        # Find component inside
        seq_start = match.end()
        seq_content = code_content[seq_start:seq_start + 500]
        comp_match = component_pattern.search(seq_content)
        component_name = comp_match.group(1) if comp_match else "Visual"

        if component_name.lower() in ['div', 'span', 'p', 'h1', 'h2', 'h3', 'style']:
            component_name = "Visual Element"

        visuals.append({
            'startMs': start_ms,
            'endMs': None,  # Runs to end
            'type': component_name,
            'description': f'{component_name} (from frame {start_frame})'
        })

    # Sort by start time
    visuals.sort(key=lambda v: v['startMs'])

    return visuals


# =============================================================================
# FILE BACKUP AND ROLLBACK SYSTEM
# =============================================================================

def backup_source_files(workspace: str, project_id: str, iteration: int) -> Optional[str]:
    """
    Backup source files before each iteration.
    Returns backup directory path or None if no files to backup.
    """
    src_dir = Path(workspace) / "src" / project_id
    if not src_dir.exists():
        return None

    backup_dir = Path(workspace) / ".backups" / f"iteration_{iteration}"
    backup_dir.mkdir(parents=True, exist_ok=True)

    # Copy all source files
    import shutil
    for file in src_dir.glob("**/*"):
        if file.is_file():
            rel_path = file.relative_to(src_dir)
            dest = backup_dir / rel_path
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(file, dest)

    ProjectOutput.info("Source files backed up", iteration=iteration, backup_dir=str(backup_dir))
    return str(backup_dir)


def restore_source_files(workspace: str, project_id: str, from_iteration: int) -> bool:
    """
    Restore source files from a previous iteration's backup.
    Returns True if successful, False otherwise.
    """
    backup_dir = Path(workspace) / ".backups" / f"iteration_{from_iteration}"
    src_dir = Path(workspace) / "src" / project_id

    if not backup_dir.exists():
        ProjectOutput.warn("Backup not found", iteration=from_iteration)
        return False

    # Clear current source and restore from backup
    import shutil
    if src_dir.exists():
        shutil.rmtree(src_dir)
    src_dir.mkdir(parents=True, exist_ok=True)

    for file in backup_dir.glob("**/*"):
        if file.is_file():
            rel_path = file.relative_to(backup_dir)
            dest = src_dir / rel_path
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(file, dest)

    ProjectOutput.info("Source files restored", from_iteration=from_iteration)
    return True


def generate_targeted_fix_instructions(violations: list, code_content: str) -> str:
    """
    Generate specific fix instructions instead of asking for full rewrite.
    Returns targeted fix instructions for the agent.
    """
    if not violations:
        return ""

    instructions = ["## TARGETED FIXES REQUIRED (Do NOT rewrite everything - fix ONLY these issues):\n"]

    for v in violations:
        issue = v.get("issue", "")
        fix = v.get("fix", "")
        severity = v.get("severity", "major")

        # Try to find the line number if possible
        if "damping:" in issue:
            # Find damping violations in code
            import re
            matches = list(re.finditer(r'damping:\s*(\d+)', code_content))
            for m in matches:
                if int(m.group(1)) < 15:
                    # Find line number
                    line_num = code_content[:m.start()].count('\n') + 1
                    instructions.append(f"- **Line ~{line_num}**: {issue}")
                    instructions.append(f"  FIX: {fix}")
                    break
        elif "Math.sin" in issue or "Math.cos" in issue:
            # Find Math.sin/cos in code
            import re
            match = re.search(r'Math\.(sin|cos)', code_content)
            if match:
                line_num = code_content[:match.start()].count('\n') + 1
                instructions.append(f"- **Line ~{line_num}**: {issue}")
                instructions.append(f"  FIX: {fix}")
        else:
            instructions.append(f"- **[{severity.upper()}]**: {issue}")
            instructions.append(f"  FIX: {fix}")

    instructions.append("\n**IMPORTANT**: Make minimal changes. Do NOT simplify or remove working code.")
    instructions.append("**IMPORTANT**: Keep ALL existing animations and components intact.")

    return "\n".join(instructions)


def pre_check_violations(workspace: str, project_id: str) -> tuple[bool, list, str]:
    """
    Pre-check source code for violations BEFORE expensive LLM evaluation.
    Returns (has_critical_violations, violations_list, code_content)
    """
    src_dir = Path(workspace) / "src" / project_id
    index_file = src_dir / "index.tsx"

    if not index_file.exists():
        return False, [], ""

    code_content = index_file.read_text(encoding="utf-8")
    violations = scan_for_violations(code_content)

    # Check for critical violations that need immediate fix
    critical = [v for v in violations if v.get("severity") == "critical"]

    return len(critical) > 0, violations, code_content


def check_plan_compliance(code_content: str, visual_plan: dict) -> dict:
    """
    Check how well the generated code implements the Visual Plan.
    Returns compliance report with score and details.
    """
    if not visual_plan:
        return {'score': 100, 'implemented': [], 'missing': [], 'details': 'No plan to verify'}

    report = {
        'score': 0,
        'implemented': [],
        'missing': [],
        'details': ''
    }

    scenes = visual_plan.get('scenes', [])
    entities = visual_plan.get('concept_analysis', {}).get('key_entities', [])
    metaphors = visual_plan.get('visual_system', {}).get('metaphor_mapping', {})

    if not scenes:
        return {'score': 100, 'implemented': [], 'missing': [], 'details': 'No scenes in plan'}

    # Check each scene
    scene_checks = []
    for scene in scenes:
        scene_id = scene.get('scene_id', 'unknown')
        frame_range = scene.get('frame_range', [0, 0])
        build_sequence = scene.get('visual_story', {}).get('build_sequence', [])

        # Look for evidence this scene was implemented
        # Check 1: Sequence with matching frame range
        frame_pattern = rf'from=\{{\s*{frame_range[0]}\s*\}}|from=\{{{frame_range[0]}\}}'
        has_frame = bool(re.search(frame_pattern, code_content))

        # Check 2: Elements from build_sequence mentioned in code
        elements_found = []
        for step in build_sequence:
            element = step.get('element', '')
            if element and re.search(rf'\b{re.escape(element)}\b', code_content, re.IGNORECASE):
                elements_found.append(element)

        # Check 3: Comments mentioning scene ID
        has_comment = bool(re.search(rf'{scene_id}', code_content, re.IGNORECASE))

        implemented = has_frame or len(elements_found) > 0 or has_comment
        scene_checks.append({
            'scene_id': scene_id,
            'implemented': implemented,
            'has_frame': has_frame,
            'elements_found': elements_found,
            'has_comment': has_comment
        })

        if implemented:
            report['implemented'].append(scene_id)
        else:
            report['missing'].append(scene_id)

    # Check metaphors
    metaphor_checks = []
    for metaphor_name, metaphor_def in metaphors.items():
        # Look for component or variable matching metaphor name
        found = bool(re.search(rf'\b{re.escape(metaphor_name)}\b', code_content, re.IGNORECASE))
        metaphor_checks.append({'name': metaphor_name, 'found': found})

    implemented_metaphors = sum(1 for m in metaphor_checks if m['found'])

    # Calculate score
    scene_score = (len(report['implemented']) / len(scenes)) * 60 if scenes else 60
    metaphor_score = (implemented_metaphors / len(metaphors)) * 40 if metaphors else 40

    report['score'] = int(scene_score + metaphor_score)
    report['scene_checks'] = scene_checks
    report['metaphor_checks'] = metaphor_checks
    report['details'] = (
        f"Scenes: {len(report['implemented'])}/{len(scenes)}, "
        f"Metaphors: {implemented_metaphors}/{len(metaphors)}"
    )

    return report


def enrich_metadata(metadata: dict, code_content: str, visual_plan: dict = None, fps: int = 30) -> dict:
    """
    Enrich metadata.json with extracted visual timestamps and plan compliance.
    """
    # Extract visuals from code
    visuals = extract_visuals_from_code(code_content, fps)
    if visuals:
        metadata['visuals'] = visuals

    # Add plan compliance if we have a plan
    if visual_plan:
        compliance = check_plan_compliance(code_content, visual_plan)
        metadata['planCompliance'] = {
            'score': compliance['score'],
            'scenesImplemented': len(compliance['implemented']),
            'scenesTotal': len(visual_plan.get('scenes', [])),
            'details': compliance['details']
        }

    return metadata


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
    Log to ProjectOutput when initialized, otherwise to stderr.

    When ProjectOutput is initialized, logs go to the clean log file.
    When not initialized (e.g., during startup), logs go to stderr.

    Prefixes: PHASE, EVAL, ERROR, WARN, INFO, TOOL, SCORE
    """
    # Route to ProjectOutput if initialized (clean file logs, no stderr noise)
    if ProjectOutput._initialized:
        if prefix == "ERROR":
            ProjectOutput.error(message, **kwargs)
        elif prefix == "WARN":
            ProjectOutput.warn(message, **kwargs)
        elif prefix in ("PHASE", "EVAL", "SCORE"):
            ProjectOutput.phase(message, **kwargs)
        else:
            ProjectOutput.info(message, **kwargs)
        return

    # Fallback to stderr only during startup (before ProjectOutput.init)
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


# =============================================================================
# VISUAL DIRECTOR - Planning Phase
# Creates a structured Visual Plan before code generation
# =============================================================================

VISUAL_DIRECTOR_SYSTEM_PROMPT = '''You are a CREATIVE VISUAL DIRECTOR for technical explainer videos.

Your job is to transform dry explanations into VISUALLY STUNNING, MEMORABLE animations that make complex concepts click. Think like a motion graphics artist at a top studio - every frame should be intentional, beautiful, and aid understanding.

## Your Creative Mission

You're not just placing icons on screen. You're telling a VISUAL STORY:

1. **INVENT METAPHORS** - Don't use generic icons. Find the perfect visual analogy.
   - REST API? A postal service with letters flying between buildings
   - Database query? A librarian searching towering bookshelves
   - Load balancer? A traffic controller directing cars to different lanes
   - Be SURPRISING. Be MEMORABLE. Make viewers say "oh, that's clever!"

2. **CHOREOGRAPH MOTION** - Everything should MOVE with purpose and beauty
   - Objects don't just "appear" - they have ENTRANCES worthy of a character
   - Data doesn't teleport - it TRAVELS along beautiful arcing paths with trails
   - Processes have RHYTHM - build tension, release, breathe, repeat
   - Think of it as a DANCE - every element has its moment

3. **CREATE MOMENTS** - Each scene needs a "hero moment" that's extra special
   - The request flying across the screen with a glowing trail
   - The server "processing" with satisfying internal machinery
   - The success state with celebration particles

4. **BUILD DRAMA** - Progressive revelation creates engagement
   - Start simple, add complexity layer by layer
   - Create anticipation before big reveals
   - Use timing to create rhythm (fast-fast-SLOW for emphasis)

## Output Schema

Think through your creative process in <thinking> tags, then output a COMPLETE Visual Plan JSON:

```json
{
  "meta": {
    "project_id": "from_input",
    "transcript_summary": "1-2 sentence summary",
    "total_duration_frames": 900,
    "fps": 30,
    "canvas": { "width": 1080, "height": 1920, "orientation": "vertical" },
    "style_preset": "modern",
    "layout_mode": "pip"
  },

  "concept_analysis": {
    "core_topic": "main subject being explained",
    "key_entities": [
      {
        "name": "Client",
        "role": "Initiates requests, receives responses",
        "examples": ["browser", "mobile app"],
        "visual_importance": "primary"
      }
    ],
    "relationships": [
      {
        "from": "Client",
        "to": "Server",
        "type": "sends",
        "what": "Request",
        "visualization": "traveling-object-along-path"
      }
    ],
    "processes": [
      {
        "name": "API Call Lifecycle",
        "steps": ["client prepares request", "request travels to server", "server processes", "response returns"],
        "is_core_animation": true
      }
    ]
  },

  "visual_system": {
    "metaphor_mapping": {
      "Client": {
        "visual": "laptop-computer-icon with glowing screen",
        "style": { "color": "style.primary", "size_percent": 12, "glow": "subtle" },
        "personality": "active, initiating, waiting for results"
      },
      "Server": {
        "visual": "server-rack-icon with status lights",
        "style": { "color": "style.secondary", "size_percent": 12 },
        "personality": "stable, processing, powerful"
      },
      "Request": {
        "visual": "glowing envelope with arrow",
        "style": { "color": "style.accent", "size_percent": 8 },
        "personality": "traveling, carrying intent"
      }
    },

    "visual_vocabulary": {
      "sending": {
        "animation": "object travels along curved path",
        "effects": ["motion-trail", "slight-scale-pulse-at-start"]
      },
      "receiving": {
        "animation": "object absorbs into target",
        "effects": ["ripple-on-target", "brief-glow"]
      },
      "processing": {
        "animation": "target pulses, internal activity",
        "effects": ["gear-spin-icon", "scanning-line", "glow-intensifies"]
      },
      "appearing": {
        "animation": "scale from 0 with spring",
        "effects": ["particle-burst-on-arrival", "brief-glow"]
      }
    },

    "spatial_layout": {
      "type": "horizontal-flow",
      "description": "Client on left, Server on right, connection between",
      "positions": {
        "client_area": { "x_percent": 20, "y_percent": 45 },
        "server_area": { "x_percent": 80, "y_percent": 45 },
        "label_area": { "y_percent": 70 },
        "title_area": { "y_percent": 12 }
      },
      "safe_zones": {
        "bottom": { "height_percent": 15, "reserved_for": "subtitles" },
        "edges": { "margin_percent": 5 }
      }
    },

    "motion_principles": {
      "default_spring": { "damping": 22, "stiffness": 90, "mass": 0.9 },
      "travel_duration_frames": 45,
      "stagger_delay_frames": 8,
      "hold_after_key_moment": 20
    }
  },

  "scenes": [
    {
      "scene_id": "S01",
      "frame_range": [0, 180],
      "transcript_segment": "exact transcript text for this segment",
      "narrative_goal": "Introduce the CLIENT as the starting point",
      "viewer_takeaway": "The client is where requests originate",

      "visual_story": {
        "setup": {
          "description": "Empty stage with subtle animated background",
          "mood": "anticipation, beginning of journey"
        },
        "build_sequence": [
          {
            "at_frame": 15,
            "action": "Client icon materializes center-left",
            "element": "Client",
            "technique": "scale-spring-from-zero",
            "effects": ["particle-burst", "subtle-glow-pulse"],
            "rationale": "Dramatic entrance - this is our protagonist"
          },
          {
            "at_frame": 50,
            "action": "Label 'Client' appears below icon",
            "element": "client_label",
            "technique": "typewriter-reveal",
            "effects": [],
            "rationale": "Name what we're seeing"
          }
        ],
        "hero_moment": {
          "what": "Client icon appearing with particle effects",
          "frame_range": [15, 45],
          "treatment": "Extra attention - particle effects, slight hold after"
        },
        "process_animations": [],
        "elements_on_stage_at_end": ["Client", "client_label"]
      },

      "element_positions": {
        "Client": { "x_percent": 20, "y_percent": 45 },
        "client_label": { "x_percent": 20, "y_percent": 55 }
      },

      "background": {
        "type": "animated-gradient",
        "colors": ["style.bg", "style.bg_secondary"],
        "animation": { "type": "slow-hue-shift", "speed": "barely-perceptible" }
      },

      "transition_to_next": {
        "type": "continuation",
        "elements_that_persist": ["Client", "client_label"],
        "elements_that_exit": []
      }
    }
  ],

  "global_directives": {
    "layout_constraints": {
      "no_element_overlap": true,
      "safe_zone_bottom_percent": 15,
      "edge_margin_percent": 5,
      "max_simultaneous_elements": 6
    },
    "animation_constraints": {
      "min_animation_frames": 15,
      "min_stagger_frames": 8,
      "min_travel_frames": 45,
      "spring_damping_min": 20
    },
    "timing_constraints": {
      "build_before_speak_frames": 10,
      "hero_hold_frames": 20
    },
    "prohibited_patterns": [
      "instant_teleportation",
      "static_backgrounds",
      "all_elements_animating_simultaneously",
      "fade_only_for_hero_elements",
      "elements_in_subtitle_zone"
    ]
  }
}
```

## CRITICAL REQUIREMENTS

1. **ALL positions use percentages** (x_percent, y_percent: 0-100)
2. **Colors reference style tokens** (style.primary, style.accent, etc.)
3. **Bottom 15% is RESERVED** for subtitles - NO elements there
4. **Maximum 6 elements** visible simultaneously
5. **Minimum 15 frames** per animation
6. **Minimum 8 frame stagger** between element entries
7. **Hero moments get 30+ frames** with special treatment
8. **Travel animations use paths** with motion trails (no teleporting)
9. **Every scene has a hero_moment** - the one thing that makes it memorable
10. **build_sequence has frame-precise timing** with technique and effects

Think deeply in <thinking> tags, then output the COMPLETE JSON plan.
'''


# =============================================================================
# TWO-PASS PLANNING PROMPTS
# Pass 1: Content Analysis - identify narrative beats and core metaphor
# Pass 2: Visual Design - design scenes constrained by the brief
# =============================================================================

CONTENT_ANALYST_PROMPT = '''You are a CREATIVE DIRECTOR analyzing a video transcript.

Your job is to identify the NARRATIVE STRUCTURE and output a JSON brief.

## Rules
- Maximum 8 beats, minimum 2 beats
- Each beat must be at least 150 frames (5 seconds at 30fps)
- Group related transcript lines into ONE beat
- The core metaphor must be concrete and visual

## Beat Types
problem, constraint, solution, proof, example, challenge, cta, outro

## CRITICAL: Output Format
You MUST output valid JSON. Do NOT use <thinking> tags. Do NOT explain.
Start your response with ```json and end with ```.

```json
{
  "core_metaphor": {
    "concept": "One visual metaphor for the whole video",
    "why": "Why this works"
  },
  "narrative_beats": [
    {
      "beat_id": "B01",
      "type": "problem",
      "frame_range": [0, 540],
      "summary": "What this beat is about",
      "key_visual": "Main visual element"
    }
  ],
  "visual_elements": ["element1", "element2", "element3"]
}
```

Remember: JSON only, no thinking tags, no explanation.
'''

VISUAL_DESIGNER_PROMPT = '''You are a VISUAL DESIGNER implementing a creative brief.

The Creative Director has already decided the structure. Your job is to design the visuals.

## Your Task
Design ONE scene per beat. Do NOT create additional scenes.

For each scene:
1. How the core metaphor manifests in this beat
2. Build sequence (2-4 element entrances, not 10)
3. Hero moment (the memorable visual peak)
4. Transition to next scene

## Constraints
- You MUST create exactly {beat_count} scenes
- Scene IDs: S01, S02, ... matching beat order
- Scene frame_range MUST match the beat's frame_range exactly
- All visuals MUST use the core metaphor as the unifying thread
- Only use elements from visual_elements list - no new major concepts
- Each scene gets 2-4 build steps, not 8-10
- Bottom 15% reserved for subtitles - no elements there

## Output Format
Output ONLY the Visual Plan JSON (no thinking tags):

```json
{{
  "meta": {{
    "project_id": "{project_id}",
    "transcript_summary": "1-2 sentence summary",
    "total_duration_frames": {duration_frames},
    "fps": {fps},
    "canvas": {{ "width": {width}, "height": {height}, "orientation": "{orientation}" }},
    "style_preset": "{style_preset}",
    "layout_mode": "{layout_mode}"
  }},
  "concept_analysis": {{
    "core_topic": "from brief",
    "key_entities": [{{ "name": "...", "role": "...", "visual_importance": "primary|secondary" }}],
    "relationships": [],
    "processes": []
  }},
  "visual_system": {{
    "metaphor_mapping": {{}},
    "visual_vocabulary": {{}},
    "spatial_layout": {{}},
    "motion_principles": {{}}
  }},
  "scenes": [
    {{
      "scene_id": "S01",
      "frame_range": [0, 540],
      "transcript_segment": "text from transcript",
      "narrative_goal": "from beat summary",
      "visual_story": {{
        "setup": {{ "description": "...", "mood": "..." }},
        "build_sequence": [
          {{ "at_frame": 15, "action": "...", "element": "...", "technique": "...", "effects": [] }}
        ],
        "hero_moment": {{ "what": "...", "frame_range": [100, 200], "treatment": "..." }}
      }},
      "element_positions": {{}},
      "background": {{}},
      "transition_to_next": {{}}
    }}
  ]
}}
```
'''


def get_style_colors(preset: str) -> dict:
    """Get colors for a style preset."""
    presets = {
        "minimal": {"bg": "#1a1a1a", "primary": "#ffffff", "secondary": "#888888", "accent": "#3b82f6", "text": "#ffffff"},
        "modern": {"bg": "#0f0f23", "primary": "#8b5cf6", "secondary": "#3b82f6", "accent": "#06b6d4", "text": "#ffffff"},
        "playful": {"bg": "#1a1a2e", "primary": "#f97316", "secondary": "#eab308", "accent": "#ec4899", "text": "#ffffff"},
        "bold": {"bg": "#000000", "primary": "#ffffff", "secondary": "#888888", "accent": "#ef4444", "text": "#ffffff"},
        "classic": {"bg": "#1e3a5f", "primary": "#d4af37", "secondary": "#c0c0c0", "accent": "#d4af37", "text": "#f5f5dc"},
    }
    return presets.get(preset, presets["modern"])


# =============================================================================
# TWO-PASS PLANNING FUNCTIONS
# =============================================================================

def validate_brief(brief: dict, fps: int = 30) -> tuple[bool, str]:
    """Validate StructuredBrief before Pass 2.

    Returns (is_valid, reason).
    """
    if not brief:
        return False, "Brief is empty"

    beats = brief.get('narrative_beats', [])

    if len(beats) < 2:
        return False, f"Too few beats ({len(beats)})"
    if len(beats) > 8:
        return False, f"Too many beats ({len(beats)})"

    core_metaphor = brief.get('core_metaphor', {})
    if not core_metaphor.get('concept'):
        return False, "Missing core metaphor"

    # Check beat coverage (no gaps > 3 seconds)
    for i, beat in enumerate(beats[:-1]):
        current_end = beat.get('frame_range', [0, 0])[1]
        next_start = beats[i+1].get('frame_range', [0, 0])[0]
        gap = next_start - current_end
        if gap > fps * 3:  # 3 second gap
            return False, f"Gap of {gap} frames between beats {i+1} and {i+2}"

    # Check minimum beat duration (5 seconds)
    min_frames = fps * 5
    for i, beat in enumerate(beats):
        frame_range = beat.get('frame_range', [0, 0])
        duration = frame_range[1] - frame_range[0]
        if duration < min_frames:
            # Allow shorter beats for outro/cta
            if beat.get('type') not in ('outro', 'cta'):
                return False, f"Beat {i+1} is too short ({duration} frames)"

    return True, "Valid"


def parse_brief_json(response: str) -> Optional[dict]:
    """Extract and parse StructuredBrief JSON from response."""
    import re

    # Method 1: Try to find JSON block in markdown code fence
    json_match = re.search(r'```(?:json)?\s*(\{[\s\S]+\})\s*```', response)
    if json_match:
        json_str = json_match.group(1)
        try:
            parsed = json.loads(json_str)
            if 'narrative_beats' in parsed and 'core_metaphor' in parsed:
                return parsed
        except json.JSONDecodeError:
            pass

    # Method 2: Find balanced braces
    brace_count = 0
    start_idx = None

    for i, char in enumerate(response):
        if char == '{':
            if start_idx is None:
                start_idx = i
            brace_count += 1
        elif char == '}':
            brace_count -= 1
            if brace_count == 0 and start_idx is not None:
                json_str = response[start_idx:i+1]
                try:
                    parsed = json.loads(json_str)
                    if 'narrative_beats' in parsed and 'core_metaphor' in parsed:
                        return parsed
                except json.JSONDecodeError:
                    pass
                start_idx = None

    return None


def analyze_content_structure(
    transcript: str,
    transcript_formatted: str,
    duration_frames: int,
    fps: int,
    llm,
    api_key: str = None,
    api_base: str = None,
    planning_model: str = None,
) -> Optional[dict]:
    """Pass 1: Extract narrative beats and core metaphor.

    Returns StructuredBrief dict or None on failure.
    """
    import litellm

    emit_event("planning_pass1_start")
    ProjectOutput.plan("Pass 1: Analyzing content structure")

    # Use planning_model if provided, otherwise fall back to llm's model
    model_name = planning_model or getattr(llm, 'model', None) or getattr(llm, 'model_name', 'google/gemini-2.5-flash-lite')
    ProjectOutput.plan(f"Pass 1 using model: {model_name}")

    duration_seconds = duration_frames / fps

    prompt = f'''Analyze this transcript and output a StructuredBrief JSON.

## Transcript
{transcript_formatted}

## Details
Duration: {duration_frames} frames ({duration_seconds:.1f}s) at {fps} FPS

## Requirements
1. Identify 4-8 narrative BEATS (group related lines together)
2. Choose ONE visual metaphor for the entire video
3. List 3-5 recurring visual elements

## Output
Respond with ONLY a JSON code block. No thinking, no explanation.

```json
{{
  "core_metaphor": {{ "concept": "...", "why": "..." }},
  "narrative_beats": [
    {{ "beat_id": "B01", "type": "problem", "frame_range": [0, 500], "summary": "...", "key_visual": "..." }}
  ],
  "visual_elements": ["element1", "element2", "element3"]
}}
```
'''

    litellm_kwargs = {
        'model': model_name,
        'messages': [
            {"role": "system", "content": CONTENT_ANALYST_PROMPT},
            {"role": "user", "content": prompt}
        ],
        'temperature': 0.7,
        'max_tokens': 2000,
        'timeout': 60,
    }
    if api_key:
        litellm_kwargs['api_key'] = api_key
    if api_base:
        litellm_kwargs['api_base'] = api_base

    try:
        ProjectOutput.llm("Pass 1: Calling LLM for content analysis", model=model_name)
        response = litellm.completion(**litellm_kwargs)

        if response and response.choices:
            content = response.choices[0].message.content or ""
            ProjectOutput.plan("Pass 1: Got response", length=len(content))

            # Save raw response
            ProjectOutput.save_file("pass1-raw-response.txt", content)

            brief = parse_brief_json(content)
            if brief:
                beat_count = len(brief.get('narrative_beats', []))
                metaphor = brief.get('core_metaphor', {}).get('concept', 'unknown')
                ProjectOutput.plan("Pass 1: Brief parsed",
                                 beats=beat_count,
                                 metaphor=metaphor[:50])

                # Save brief
                ProjectOutput.save_file("brief.json", json.dumps(brief, indent=2))

                emit_event("planning_pass1_complete", beat_count=beat_count, metaphor=metaphor[:50])
                return brief
            else:
                ProjectOutput.error("Pass 1: Failed to parse brief JSON")
                return None
        else:
            ProjectOutput.error("Pass 1: No response from LLM")
            return None

    except Exception as e:
        ProjectOutput.error(f"Pass 1 failed: {e}")
        return None


def design_visuals_from_brief(
    brief: dict,
    transcript_formatted: str,
    project_id: str,
    width: int,
    height: int,
    duration_frames: int,
    fps: int,
    style_preset: str,
    style_colors: dict,
    layout_mode: str,
    llm,
    api_key: str = None,
    api_base: str = None,
    planning_model: str = None,
) -> Optional[dict]:
    """Pass 2: Design scenes constrained by the brief.

    Returns Visual Plan dict or None on failure.
    """
    import litellm

    emit_event("planning_pass2_start")
    ProjectOutput.plan("Pass 2: Designing visuals from brief")

    # Use planning_model if provided, otherwise fall back to llm's model
    model_name = planning_model or getattr(llm, 'model', None) or getattr(llm, 'model_name', 'google/gemini-2.5-flash-lite')
    ProjectOutput.plan(f"Pass 2 using model: {model_name}")

    orientation = "vertical" if height > width else "horizontal" if width > height else "square"
    beat_count = len(brief.get('narrative_beats', []))

    # Format the brief for the prompt
    core_metaphor = brief.get('core_metaphor', {})
    beats = brief.get('narrative_beats', [])
    visual_elements = brief.get('visual_elements', [])

    beats_formatted = "\n".join([
        f"- {b['beat_id']}: [{b['frame_range'][0]}-{b['frame_range'][1]}] {b['type'].upper()} - {b['summary']}"
        for b in beats
    ])

    # Build the designer prompt with filled-in template
    designer_prompt = VISUAL_DESIGNER_PROMPT.format(
        beat_count=beat_count,
        project_id=project_id,
        duration_frames=duration_frames,
        fps=fps,
        width=width,
        height=height,
        orientation=orientation,
        style_preset=style_preset,
        layout_mode=layout_mode,
    )

    prompt = f'''Design visuals for this video based on the Creative Brief.

## Creative Brief

**Core Metaphor:** {core_metaphor.get('concept', 'undefined')}
**Rationale:** {core_metaphor.get('why', '')}

**Narrative Beats ({beat_count} total):**
{beats_formatted}

**Visual Elements to Use:** {', '.join(visual_elements)}

## Transcript with Frame Timings
{transcript_formatted}

## Style
- Preset: {style_preset}
- Colors: bg={style_colors["bg"]}, primary={style_colors["primary"]}, secondary={style_colors["secondary"]}, accent={style_colors["accent"]}
- Canvas: {width}x{height} ({orientation})
- Layout: {layout_mode}

## Constraints
- Create EXACTLY {beat_count} scenes (one per beat)
- Scene frame_range MUST match beat frame_range
- All visuals must connect to the core metaphor
- 2-4 build steps per scene, not 8-10

Output ONLY the Visual Plan JSON.
'''

    litellm_kwargs = {
        'model': model_name,
        'messages': [
            {"role": "system", "content": designer_prompt},
            {"role": "user", "content": prompt}
        ],
        'temperature': 0.7,
        'max_tokens': 12000,
        'timeout': 120,
    }
    if api_key:
        litellm_kwargs['api_key'] = api_key
    if api_base:
        litellm_kwargs['api_base'] = api_base

    try:
        ProjectOutput.llm("Pass 2: Calling LLM for visual design", model=model_name)
        response = litellm.completion(**litellm_kwargs)

        if response and response.choices:
            content = response.choices[0].message.content or ""
            ProjectOutput.plan("Pass 2: Got response", length=len(content))

            # Save raw response
            ProjectOutput.save_file("pass2-raw-response.txt", content)

            plan = parse_visual_plan_json(content)
            if plan:
                scene_count = len(plan.get('scenes', []))
                ProjectOutput.plan("Pass 2: Plan parsed", scenes=scene_count, expected=beat_count)

                if scene_count != beat_count:
                    ProjectOutput.warn(f"Scene count mismatch: got {scene_count}, expected {beat_count}")

                emit_event("planning_pass2_complete", scene_count=scene_count)
                return plan
            else:
                ProjectOutput.error("Pass 2: Failed to parse Visual Plan JSON")
                return None
        else:
            ProjectOutput.error("Pass 2: No response from LLM")
            return None

    except Exception as e:
        ProjectOutput.error(f"Pass 2 failed: {e}")
        return None


def run_visual_director(
    transcript: str,
    project_id: str,
    width: int,
    height: int,
    duration_frames: int,
    fps: int,
    style_preset: str,
    layout_mode: str,
    llm,
    reasoning_effort: str = "high",
    workspace: str = None,
    bundle_dir: str = None,
    planning_model: str = None,
) -> Optional[dict]:
    """
    Run the Visual Director to create a structured Visual Plan.

    Uses LLM directly (via LiteLLM) to analyze transcript and create a plan
    that guides the code generation phase.
    """
    emit_event(EVENT_PLANNING_START, project_id=project_id)
    log_debug("PHASE", "=== Visual Director Planning ===", project_id=project_id)

    style_colors = get_style_colors(style_preset)

    # Build the planning prompt
    orientation = "vertical" if height > width else "horizontal" if width > height else "square"
    duration_seconds = duration_frames / fps

    layout_context = {
        "pip": "Full screen available - video appears as small overlay.",
        "split-horizontal": "Top half only - video on bottom.",
        "split-vertical": "Left half only - video on right."
    }.get(layout_mode, "Full screen available")

    # Pre-process transcript to extract segments with frame timings
    import re
    transcript_with_frames = []
    # Match patterns like [0:00 - 0:05] or [0:05 - 0:12]
    segment_pattern = r'\[(\d+):(\d+)\s*-\s*(\d+):(\d+)\]\s*(.+?)(?=\[\d+:\d+|$)'
    matches = re.findall(segment_pattern, transcript, re.DOTALL)

    if matches:
        for match in matches:
            start_min, start_sec, end_min, end_sec, text = match
            start_seconds = int(start_min) * 60 + int(start_sec)
            end_seconds = int(end_min) * 60 + int(end_sec)
            start_frame = start_seconds * fps
            end_frame = end_seconds * fps
            text_clean = text.strip()
            transcript_with_frames.append(
                f"[FRAMES {start_frame}-{end_frame}] ({start_seconds}s-{end_seconds}s): {text_clean}"
            )
        transcript_formatted = "\n".join(transcript_with_frames)
    else:
        # Fallback: use raw transcript
        transcript_formatted = transcript

    # Get API credentials from LLM object
    api_key = getattr(llm, 'api_key', None)
    if api_key and hasattr(api_key, 'get_secret_value'):
        api_key = api_key.get_secret_value()
    api_base = getattr(llm, 'base_url', None) or getattr(llm, 'api_base', None)

    # ==========================================================================
    # TWO-PASS PLANNING (preferred)
    # Pass 1: Analyze content structure -> StructuredBrief
    # Pass 2: Design visuals from brief -> Visual Plan
    # ==========================================================================

    ProjectOutput.plan("Attempting two-pass planning")

    # Pass 1: Content Analysis
    brief = analyze_content_structure(
        transcript=transcript,
        transcript_formatted=transcript_formatted,
        duration_frames=duration_frames,
        fps=fps,
        llm=llm,
        api_key=api_key,
        api_base=api_base,
        planning_model=planning_model,
    )

    if brief:
        # Validate the brief
        is_valid, reason = validate_brief(brief, fps)

        if is_valid:
            ProjectOutput.plan("Brief validated", beats=len(brief.get('narrative_beats', [])))

            # Pass 2: Visual Design
            plan = design_visuals_from_brief(
                brief=brief,
                transcript_formatted=transcript_formatted,
                project_id=project_id,
                width=width,
                height=height,
                duration_frames=duration_frames,
                fps=fps,
                style_preset=style_preset,
                style_colors=style_colors,
                layout_mode=layout_mode,
                llm=llm,
                api_key=api_key,
                api_base=api_base,
                planning_model=planning_model,
            )

            if plan:
                scene_count = len(plan.get("scenes", []))
                entity_count = len(plan.get("concept_analysis", {}).get("key_entities", []))

                ProjectOutput.plan("Two-pass planning successful",
                                 scenes=scene_count,
                                 entities=entity_count)

                # Save visual plan
                ProjectOutput.save_visual_plan(plan)

                # Copy to workspace for generator
                if workspace:
                    plan_json = json.dumps(plan, indent=2)
                    plan_path = Path(workspace) / "src" / project_id / "visual-plan.json"
                    plan_path.parent.mkdir(parents=True, exist_ok=True)
                    plan_path.write_text(plan_json, encoding="utf-8")

                emit_event(
                    EVENT_PLANNING_COMPLETE,
                    project_id=project_id,
                    scene_count=scene_count,
                    entity_count=entity_count,
                    planning_mode="two-pass"
                )
                return plan
            else:
                ProjectOutput.warn("Pass 2 failed, falling back to single-pass")
        else:
            ProjectOutput.warn(f"Brief validation failed: {reason}, falling back to single-pass")
    else:
        ProjectOutput.warn("Pass 1 failed, falling back to single-pass")

    # ==========================================================================
    # SINGLE-PASS FALLBACK (original behavior)
    # ==========================================================================

    ProjectOutput.plan("Using single-pass planning (fallback)")

    planning_prompt = f'''Create a Visual Plan for this explainer video.

## Project Details

PROJECT_ID: {project_id}
CANVAS: {width}x{height} ({orientation})
LAYOUT: {layout_mode} - {layout_context}
DURATION: {duration_frames} frames ({duration_seconds:.1f} seconds) at {fps} FPS
STYLE: {style_preset}
COLORS: background={style_colors["bg"]}, primary={style_colors["primary"]}, secondary={style_colors["secondary"]}, accent={style_colors["accent"]}

## Transcript with Frame Timings

IMPORTANT: Use the EXACT frame ranges below for your scenes!

{transcript_formatted}

## Frame Timing Rules

- 1 second = {fps} frames
- Scene frame_range MUST match the transcript segment frames
- Animations within a scene should start AFTER the scene's start frame
- Leave 10-15 frames buffer at scene transitions

## Your Task

1. Analyze this transcript - what concepts need visualization?
2. Design visual metaphors for each entity
3. Create a scene-by-scene plan with EXACT frame timings from above

Output the Visual Plan JSON directly. Keep any thinking BRIEF (under 50 words) to save tokens for the full JSON.
The JSON must be COMPLETE with all scenes - do not truncate.
'''

    try:
        import litellm

        # Use LiteLLM directly for planning - simpler than full agent for text generation
        emit_tool_call("planning", message="Visual Director analyzing transcript...")

        # Build the model name from the llm object
        # OpenHands LLM objects store model as 'model' attribute
        model_name = getattr(llm, 'model', None) or getattr(llm, 'model_name', 'google/gemini-3-flash-preview')

        # Get API configuration from LLM object or environment
        api_key = getattr(llm, 'api_key', None)
        if api_key and hasattr(api_key, 'get_secret_value'):
            api_key = api_key.get_secret_value()  # Handle SecretStr
        api_base = getattr(llm, 'base_url', None) or getattr(llm, 'api_base', None)

        # Log to file (clean, no noise)
        ProjectOutput.plan("Starting Visual Director",
                       model=model_name,
                       has_api_key=bool(api_key),
                       api_base=api_base[:50] if api_base else "env",
                       prompt_length=len(planning_prompt),
                       transcript_segments=len(transcript_formatted.split('\n')))

        # Call LLM directly for planning
        # Pass API config explicitly to avoid relying on environment variables
        litellm_kwargs = {
            'model': model_name,
            'messages': [
                {"role": "system", "content": VISUAL_DIRECTOR_SYSTEM_PROMPT},
                {"role": "user", "content": planning_prompt}
            ],
            'temperature': 0.7,
            'max_tokens': 32000,  # Large Visual Plans need more tokens - 16K was truncating
            'timeout': 180,  # 3 minute timeout to prevent hanging on slow API responses
        }
        if api_key:
            litellm_kwargs['api_key'] = api_key
        if api_base:
            litellm_kwargs['api_base'] = api_base

        # Enable native model reasoning based on provider
        # This allows models to "think" before responding
        model_lower = model_name.lower()

        if 'gemini' in model_lower:
            # Gemini 3 models via OpenRouter: Use reasoning parameter with effort level
            # OpenRouter maps effort to Google's thinkingLevel API
            # Valid values: "minimal", "low", "medium", "high"
            if reasoning_effort and reasoning_effort != 'none':
                # Map our effort levels to OpenRouter's expected values
                effort_map = {
                    'low': 'low',
                    'medium': 'medium',
                    'high': 'high',
                    'max': 'high',  # OpenRouter doesn't have 'max', use 'high'
                }
                effort = effort_map.get(reasoning_effort, 'high')
                litellm_kwargs['reasoning'] = {
                    'effort': effort
                }
                ProjectOutput.plan("Gemini reasoning enabled via OpenRouter", effort=effort)

        elif 'claude' in model_lower:
            # Claude models: Use extended thinking
            # Requires Anthropic API with thinking support
            if reasoning_effort != 'none':
                thinking_budget_map = {
                    'low': 2048,
                    'medium': 4096,
                    'high': 8192,
                    'max': 16384,
                }
                budget = thinking_budget_map.get(reasoning_effort, 4096)
                litellm_kwargs['thinking'] = {
                    'type': 'enabled',
                    'budget_tokens': budget
                }
                # Claude extended thinking requires higher max_tokens
                litellm_kwargs['max_tokens'] = max(8000, budget + 4000)
                ProjectOutput.plan("Claude extended thinking enabled", budget_tokens=budget)

        elif 'o1' in model_lower or 'o3' in model_lower:
            # OpenAI o1/o3 models: Have built-in reasoning
            # Just increase token budget for reasoning output
            litellm_kwargs['max_tokens'] = 12000
            ProjectOutput.plan("OpenAI reasoning model detected")

        ProjectOutput.llm("Calling LiteLLM", model=model_name, max_tokens=litellm_kwargs.get('max_tokens', 8000), reasoning=reasoning_effort)
        planning_response = litellm.completion(**litellm_kwargs)

        # Extract response text and native reasoning
        response = ""
        native_thinking = ""

        if planning_response and planning_response.choices:
            choice = planning_response.choices[0]
            message = choice.message
            response = message.content or ""
            finish_reason = getattr(choice, 'finish_reason', 'unknown')

            # Extract native reasoning from different model formats
            # 1. Gemini: thinking in message.thinking or message.reasoning
            if hasattr(message, 'thinking') and message.thinking:
                native_thinking = message.thinking
                ProjectOutput.plan("Gemini native thinking captured", chars=len(native_thinking))
            elif hasattr(message, 'reasoning') and message.reasoning:
                native_thinking = message.reasoning
                ProjectOutput.plan("Native reasoning captured", chars=len(native_thinking))

            # 2. Claude: thinking blocks in message content (list format)
            if hasattr(message, 'content') and isinstance(message.content, list):
                for block in message.content:
                    if hasattr(block, 'type') and block.type == 'thinking':
                        native_thinking += getattr(block, 'thinking', '') + "\n"
                    elif hasattr(block, 'type') and block.type == 'text':
                        response = getattr(block, 'text', response)
                if native_thinking:
                    ProjectOutput.plan("Claude thinking blocks captured", chars=len(native_thinking))

            # 3. Check for thinking in tool_calls or function_call (some models)
            if hasattr(message, 'tool_calls') and message.tool_calls:
                for tc in message.tool_calls:
                    if hasattr(tc, 'function') and 'think' in getattr(tc.function, 'name', '').lower():
                        native_thinking += str(getattr(tc.function, 'arguments', ''))

            ProjectOutput.llm("LLM response received",
                          response_length=len(response),
                          thinking_length=len(native_thinking),
                          finish_reason=finish_reason)
        else:
            ProjectOutput.error("LLM returned no choices",
                           response_type=type(planning_response).__name__)

        if not response:
            emit_event(EVENT_PLANNING_ERROR, error="No response from Visual Director LLM")
            ProjectOutput.error("Empty response from Visual Director")
            return None

        # Always save raw response for debugging
        ProjectOutput.save_plan_raw_response(response)

        # Emit native thinking first (higher quality than parsed thinking)
        if native_thinking:
            emit_event(EVENT_PLANNING_THINKING, thinking=native_thinking, source="native")
            ProjectOutput.plan("Native model reasoning", thinking_chars=len(native_thinking))
            ProjectOutput.save_plan_thinking(native_thinking)

        # Also check for XML-style thinking tags in response (fallback)
        thinking_match = re.search(r'<thinking>([\s\S]*?)</thinking>', response, re.IGNORECASE)
        if thinking_match and not native_thinking:
            thinking = thinking_match.group(1)
            emit_event(EVENT_PLANNING_THINKING, thinking=thinking, source="xml_tags")
            ProjectOutput.plan("Visual Director reasoning (from tags)", thinking_chars=len(thinking))
            ProjectOutput.save_plan_thinking(thinking)

        # Parse JSON from response
        plan = parse_visual_plan_json(response)

        if plan:
            scene_count = len(plan.get("scenes", []))
            entity_count = len(plan.get("concept_analysis", {}).get("key_entities", []))
            metaphors = list(plan.get("visual_system", {}).get("metaphor_mapping", {}).keys())

            ProjectOutput.plan("Visual Plan parsed successfully",
                             scenes=scene_count,
                             entities=entity_count,
                             metaphors=metaphors[:5])

            # Emit per-scene reasoning for visibility
            for scene in plan.get("scenes", []):
                scene_id = scene.get("scene_id", "?")
                frame_range = scene.get("frame_range", [0, 0])
                narrative_goal = scene.get("narrative_goal", "")
                hero_moment = scene.get("visual_story", {}).get("hero_moment", {})
                build_steps = len(scene.get("visual_story", {}).get("build_sequence", []))

                emit_event(
                    EVENT_PLANNING_THINKING,
                    thinking=f"Scene {scene_id} [{frame_range[0]}-{frame_range[1]}]: {narrative_goal}",
                    scene_id=scene_id,
                    frame_range=frame_range,
                    build_steps=build_steps,
                    has_hero_moment=bool(hero_moment)
                )

            # Emit metaphor decisions
            for entity_name, metaphor in plan.get("visual_system", {}).get("metaphor_mapping", {}).items():
                visual_desc = metaphor.get("visual", "")
                emit_event(
                    EVENT_PLANNING_THINKING,
                    thinking=f"Metaphor: {entity_name} → {visual_desc}",
                    entity=entity_name,
                    visual=visual_desc
                )

            # Save visual plan to plans/ directory (ProjectOutput handles location)
            ProjectOutput.save_visual_plan(plan)

            # Also save to workspace so generator agent can access it
            if workspace:
                plan_json = json.dumps(plan, indent=2)
                plan_path = Path(workspace) / "src" / project_id / "visual-plan.json"
                plan_path.parent.mkdir(parents=True, exist_ok=True)
                plan_path.write_text(plan_json, encoding="utf-8")
                ProjectOutput.plan("Visual Plan copied to workspace", path=str(plan_path))

            emit_event(
                EVENT_PLANNING_COMPLETE,
                project_id=project_id,
                scene_count=scene_count,
                entity_count=entity_count
            )
            ProjectOutput.plan("Visual Director complete",
                             scenes=scene_count,
                             entities=entity_count,
                             metaphors=len(metaphors))
            return plan
        else:
            # Log detailed failure information
            ProjectOutput.error("Failed to parse Visual Plan JSON",
                              response_length=len(response),
                              contains_json='{' in response and '}' in response,
                              contains_scenes='"scenes"' in response,
                              contains_meta='"meta"' in response)
            emit_event(EVENT_PLANNING_ERROR, error="Failed to parse Visual Plan JSON")
            return None

    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        ProjectOutput.save_error("planning", str(e), tb)
        emit_event(EVENT_PLANNING_ERROR, error=str(e), error_type=type(e).__name__)
        return None


def fix_json_arithmetic(json_str: str) -> str:
    """Fix common JSON issues like arithmetic expressions.

    LLMs sometimes output things like "y_percent": 45 + 12 which is invalid JSON.
    This function evaluates simple arithmetic expressions to fix them.
    """
    import re

    def eval_expr(match):
        """Safely evaluate simple arithmetic expression."""
        expr = match.group(1)
        try:
            # Only allow simple arithmetic with numbers
            if re.match(r'^[\d\s\+\-\*\/\.\(\)]+$', expr):
                result = eval(expr)
                return str(result)
        except Exception:
            pass
        return match.group(0)

    # Match patterns like: 45 + 12, 100 - 20, etc. after a colon
    # Pattern: number operator number (with optional spaces)
    fixed = re.sub(r':\s*(\d+(?:\.\d+)?\s*[\+\-\*\/]\s*\d+(?:\.\d+)?)', lambda m: ': ' + eval_expr(m), json_str)

    return fixed


def parse_visual_plan_json(response: str) -> Optional[dict]:
    """Extract and parse Visual Plan JSON from response.

    Returns parsed JSON dict or None. Logs detailed errors on failure.
    """
    ProjectOutput.plan("Parsing Visual Plan JSON", response_length=len(response))

    # Method 1: Try to find JSON block in markdown code fence
    # Use greedy matching to get the full JSON block
    json_match = re.search(r'```(?:json)?\s*(\{[\s\S]+\})\s*```', response)
    if json_match:
        json_str = json_match.group(1)
        ProjectOutput.plan("Found JSON in code fence", json_length=len(json_str))

        # Fix common JSON issues (like arithmetic expressions)
        json_str = fix_json_arithmetic(json_str)

        try:
            parsed = json.loads(json_str)
            ProjectOutput.plan("Successfully parsed JSON from code fence")
            return parsed
        except json.JSONDecodeError as e:
            ProjectOutput.warn(f"JSON parse error in code fence: {e}",
                          position=e.pos,
                          context=json_str[max(0, e.pos-50):e.pos+50] if e.pos else "")

    # Method 2: Find balanced braces (handles nested JSON)
    ProjectOutput.plan("Trying balanced brace extraction")
    brace_count = 0
    start_idx = None
    best_json = None
    best_json_str = None

    for i, char in enumerate(response):
        if char == '{':
            if start_idx is None:
                start_idx = i
            brace_count += 1
        elif char == '}':
            brace_count -= 1
            if brace_count == 0 and start_idx is not None:
                json_str = response[start_idx:i+1]
                # Fix common JSON issues
                json_str = fix_json_arithmetic(json_str)
                try:
                    parsed = json.loads(json_str)
                    # Keep the largest valid JSON (most complete plan)
                    if best_json is None or len(json_str) > len(best_json_str):
                        best_json = parsed
                        best_json_str = json_str
                        ProjectOutput.plan("Found valid JSON block", length=len(json_str))
                except json.JSONDecodeError:
                    pass  # Try next block
                start_idx = None

    if best_json:
        # Validate the plan has required structure
        if 'scenes' in best_json or 'concept_analysis' in best_json:
            ProjectOutput.plan("Visual Plan parsed successfully",
                          has_scenes='scenes' in best_json,
                          has_analysis='concept_analysis' in best_json,
                          scene_count=len(best_json.get('scenes', [])))
            return best_json
        else:
            ProjectOutput.warn("Parsed JSON missing required fields",
                          keys=list(best_json.keys())[:10])

    # Log failure details
    ProjectOutput.error("Failed to parse Visual Plan JSON",
                    response_length=len(response),
                    contains_json_fence='```json' in response or '```' in response,
                    contains_brace='{' in response,
                    first_500_chars=response[:500] if response else "EMPTY")

    return None


def inject_visual_plan_into_prompt(original_prompt: str, visual_plan: dict) -> str:
    """Inject the Visual Plan into the generator prompt."""
    if not visual_plan:
        return original_prompt

    # Extract key info for summary
    entities = visual_plan.get("concept_analysis", {}).get("key_entities", [])
    scenes = visual_plan.get("scenes", [])
    metaphors = visual_plan.get("visual_system", {}).get("metaphor_mapping", {})

    plan_json = json.dumps(visual_plan, indent=2)

    plan_section = f'''
## VISUAL PLAN (Follow This Exactly)

The Visual Director created this plan. Your job is to IMPLEMENT it as Remotion code.
Do NOT make your own creative decisions - follow the plan exactly.

### Quick Summary
- **Entities**: {len(entities)} ({', '.join(e.get('name', '') for e in entities[:5])})
- **Scenes**: {len(scenes)}
- **Metaphors defined**: {len(metaphors)}

### Full Plan
```json
{plan_json}
```

## Implementation Guide

### Step 1: Create Visual Components
For EACH entity in `concept_analysis.key_entities`:
1. Look up its metaphor in `visual_system.metaphor_mapping`
2. Create a React component that renders the described visual
3. Use colors from `visual_system.color_tokens`
4. Position using `x_percent` and `y_percent` (multiply by canvas size)

### Step 2: Implement Scenes (CRITICAL - TIMING MUST MATCH!)
For EACH scene in `scenes`:
1. **USE EXACT frame_range** - Scene "S01" with frame_range [0, 150] means ALL animations in that scene happen between frame 0-150
2. The `at_frame` values in `build_sequence` are ABSOLUTE frame numbers - use them directly
3. Implement `hero_moment` during its specified frame_range with extra emphasis
4. `process_animations` duration should fit within the scene's frame_range
5. Position elements as specified in `element_positions`

**SYNC CHECK:** If transcript says [FRAMES 150-360], your scene MUST animate between those frames!

### Step 3: Animation Techniques (USE COMPONENT LIBRARY!)

**CRITICAL: Check skills/component-library.md for pre-built components!**

Technique-to-Component Mapping:
| Plan Technique | Use Component From Library |
|----------------|---------------------------|
| `particle-emitter` | ParticleEmitter (with physics config) |
| `mask-reveal` | MaskReveal (clipPath-based reveal) |
| `fade-in-blur` | FadeInBlur (filter: blur animation) |
| `scale-spring` | Spring-based scale with damping 18-22 |
| `glass-shimmer` | GlassCard with shimmerEffect |
| `draw-stroke` | SVG with strokeDasharray/Dashoffset |
| `drop-with-gravity` | Gravity physics: y = initialY + 0.5 * g * t^2 |
| `cell-division` | Array.from() with spring-based positioning |
| `3d-rotation` | perspective + rotateX/Y + preserve-3d |
| `fill-animation` | scaleX/scaleY with interpolate |

Spring config: `{{ damping: 20, stiffness: 100, mass: 0.8 }}`
Use `interpolate()` with `extrapolateRight: 'clamp'`
Stagger elements by 6-12 frames (e.g., `index * 8`)

### Step 4: Output Files
1. `index.tsx` - Main composition with all scenes
2. `metadata.json` - Composition info

---

'''

    return plan_section + original_prompt


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
    component_library_skill: str = None,
    animation_techniques_skill: str = None,
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
    # Component library - reusable pre-built components
    if component_library_skill:
        skills.append(Skill(name="component-library", content=component_library_skill))
    # Animation techniques - how to implement specific techniques from the plan
    if animation_techniques_skill:
        skills.append(Skill(name="animation-techniques", content=animation_techniques_skill))
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
## DELIBERATE CODING PROCESS - THINK BEFORE YOU CODE

You are a Remotion code generation expert. You MUST think step-by-step before writing any code.

### MANDATORY WORKFLOW (Follow This Order):

**PHASE 1: UNDERSTAND (Do NOT skip)**
Before writing ANY code, you MUST:
1. Read and understand the Visual Plan completely
2. Identify ALL entities, metaphors, and techniques specified
3. List the scenes and their build_sequences
4. Note any hero_moments that need special treatment

**PHASE 2: PLAN YOUR IMPLEMENTATION**
Think through and write down your approach:
- What components will you create?
- Which techniques from the plan will you use?
- Check the component-library skill - can you use pre-built components?
- Check the animation-techniques skill - how to implement each technique?

**PHASE 3: CODE SYSTEMATICALLY**
Only AFTER planning, write code:
1. Create index.tsx with imports and main composition
2. Create components for each visual element
3. Implement animations matching the plan's techniques EXACTLY
4. Create metadata.json with correct timing

**PHASE 4: VALIDATE**
After writing:
1. Run TypeScriptValidatorTool to check for errors
2. Fix any errors found
3. Repeat until ZERO errors

### CRITICAL: USE YOUR SKILLS (MANDATORY - DO NOT SKIP!)

You have access to skills in your context. You MUST check them BEFORE coding:

**STEP 1: Before writing ANY component, SEARCH skills/component-library.md**
Use FileEditorTool to read or grep to search:
```bash
grep -i "ProcessFlow\\|ComparisonSplit\\|ParticleEmitter" skills/component-library.md
```

**STEP 2: Check skills/animation-techniques.md for EVERY plan technique**
If plan says "particle-emitter", "mask-reveal", "glass-shimmer", etc. - the implementation code is in the skill!

**Pre-built components you MUST use (do NOT recreate from scratch):**
- **ProcessFlow** - For step-by-step processes
- **ComparisonSplit** - For before/after comparisons
- **TreeDiagram** - For hierarchical structures
- **LayerStack** - For layered visualizations
- **ParticleEmitter** - For particle effects
- **GlassCard** - For glassmorphism containers
- **CodeBlock** - For code snippets
- **BigNumber** - For statistics/numbers
- **Terminal** - For command line displays
- **FadeInBlur** - For blur-based reveals
- **MaskReveal** - For clipPath reveals

**IMPORTANT: If a skill has the component/technique, COPY IT - don't improvise!**

### END GOAL

Create a working Remotion composition that:
1. Compiles with ZERO TypeScript errors
2. Implements the Visual Plan EXACTLY (techniques, timing, hero moments)
3. Uses component library where applicable
4. Produces premium, visually appealing animations

### NAMING CONVENTIONS

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

## THINK STEP BY STEP - PLAN BEFORE CODING

You MUST plan extensively before each action. DO NOT just make tool calls without thinking.

**Before writing ANY code, think through:**
1. What does the Visual Plan specify for this scene/element?
2. What technique is required (particle-emitter, mask-reveal, etc.)?
3. Does my component-library skill have a pre-built component for this?
4. Does my animation-techniques skill show how to implement this?

**Use your tools to search and verify:**
- Use FileEditorTool to READ the skills if you need to look up a component
- Use TerminalTool with `grep -r "ComponentName" /opt/openhands/skills/` to search skills
- Read existing code before modifying it

**Between each action, reflect:**
- Did my last action succeed?
- Am I implementing the plan correctly?
- What should I do next?

## CRITICAL REQUIREMENT - SELF-HEALING:
After writing ALL files, you MUST:
1. Run TypeScriptValidatorTool to check for errors
2. If there are ANY errors, fix them
3. Run TypeScriptValidatorTool again
4. Repeat until ZERO errors

ERROR RECOVERY: If you lose context or forget what errors to fix,
read the file `.typescript-errors.txt` in the workspace root.
It contains the current TypeScript errors that need fixing.

## COMPLETION CRITERIA - WHEN TO STOP:
Your task is COMPLETE when TypeScript validation passes with ZERO errors.
Once you see "TypeScript validation passed. No errors found." - STOP IMMEDIATELY.
Do NOT make any more changes. Do NOT run any more commands. Your job is done.

Do NOT finish BEFORE TypeScript validation passes with no errors.
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
        # Use timeout wrapper to prevent indefinite hanging on slow LLM API
        run_with_timeout(conversation.run, GENERATOR_TIMEOUT)

        duration_ms = int((time.time() - start_time) * 1000)
        log_debug("PHASE", "Generator completed", duration_ms=duration_ms)
        emit_tool_result(
            "generator",
            success=True,
            duration_ms=duration_ms,
            message="Generator completed"
        )
    except ConversationTimeoutError as e:
        duration_ms = int((time.time() - start_time) * 1000)
        log_debug("ERROR", f"Generator timed out after {GENERATOR_TIMEOUT}s", duration_ms=duration_ms)
        emit_tool_result(
            "generator",
            success=False,
            duration_ms=duration_ms,
            error=f"Generator timed out after {GENERATOR_TIMEOUT} seconds"
        )
        return False, str(e)
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


def generate_plan_verification_criteria(visual_plan: dict) -> str:
    """Generate evaluation criteria from the visual plan - focused on SCENES."""
    if not visual_plan:
        return ""

    criteria_lines = []
    criteria_lines.append("## VISUAL PLAN VERIFICATION (Score based on this!):")
    criteria_lines.append("The code MUST implement these planned scenes. Check the code for each:")

    # Scene-based verification (PRIMARY scoring criteria)
    scenes = visual_plan.get("scenes", [])
    if scenes:
        criteria_lines.append("\n### SCENE IMPLEMENTATION CHECKLIST:")
        for i, scene in enumerate(scenes[:6]):  # Check up to 6 scenes
            scene_id = scene.get("scene_id", f"S{i+1:02d}")
            frame_range = scene.get("frame_range", [0, 0])
            narrative_goal = scene.get("narrative_goal", "")[:60]

            # Get visual story details
            visual_story = scene.get("visual_story", {})

            # Hero moment - most important
            hero = visual_story.get("hero_moment", {})
            hero_what = hero.get("what", "") if isinstance(hero, dict) else ""

            # Build sequence elements
            build_seq = visual_story.get("build_sequence", [])
            elements = list(set([step.get("element", "") for step in build_seq if step.get("element")]))[:3]

            # Process animations
            process_anims = visual_story.get("process_animations", [])

            criteria_lines.append(f"\n**{scene_id}** [frames {frame_range[0]}-{frame_range[1]}]:")
            criteria_lines.append(f"  Goal: {narrative_goal}")
            if elements:
                criteria_lines.append(f"  - [ ] Elements present: {', '.join(elements)}")
            if hero_what:
                criteria_lines.append(f"  - [ ] Hero moment: {hero_what[:50]}")
            if process_anims:
                for anim in process_anims[:2]:
                    anim_name = anim.get("name", anim.get("object", ""))
                    criteria_lines.append(f"  - [ ] Animation: {anim_name}")

            # Check for specific techniques in build_sequence
            techniques = list(set([step.get("technique", "") for step in build_seq if step.get("technique")]))[:3]
            if techniques:
                criteria_lines.append(f"  - [ ] Uses techniques: {', '.join(techniques)}")

    # Visual metaphors (SECONDARY - should be components in code)
    visual_system = visual_plan.get("visual_system", {})
    metaphor_mapping = visual_system.get("metaphor_mapping", {})
    if metaphor_mapping:
        criteria_lines.append("\n### VISUAL COMPONENTS (should be React components or elements):")
        for name, details in list(metaphor_mapping.items())[:4]:
            if isinstance(details, dict):
                visual = details.get("visual", "")[:40]
                criteria_lines.append(f"- [ ] {name}: {visual}")

    # Motion principles
    motion = visual_system.get("motion_principles", {})
    if motion:
        spring_config = motion.get("default_spring", {})
        if isinstance(spring_config, dict) and spring_config.get("damping"):
            criteria_lines.append(f"\n### MOTION REQUIREMENTS:")
            criteria_lines.append(f"- [ ] Spring damping >= {spring_config.get('damping', 20)}")
            criteria_lines.append(f"- [ ] Stagger delay >= {motion.get('stagger_delay_frames', 8)} frames")

    criteria_lines.append("\n**SCORING:** -5 points per missing scene, -3 per missing hero moment, -2 per missing element")

    # Animation style (simple check)
    global_directives = visual_plan.get("global_directives", {})
    animation_style = global_directives.get("animation_style", {})
    if animation_style:
        criteria_lines.append("\n### Animation Style Requirements:")
        # Handle both string and dict formats
        if isinstance(animation_style, str):
            criteria_lines.append(f"- [ ] Animation style: {animation_style}")
        elif isinstance(animation_style, dict):
            timing = animation_style.get("timing", "")
            entrance = animation_style.get("entrance", "")
            if timing:
                criteria_lines.append(f"- [ ] Timing: {timing}")
            if entrance:
                criteria_lines.append(f"- [ ] Entrance style: {entrance}")

    if criteria_lines:
        criteria_lines.append("\nDeduct 5 points from visual_quality for EACH planned component/scene NOT implemented.")

    return "\n".join(criteria_lines)


def run_visual_evaluation(
    agent,
    workspace: str,
    project_id: str,
    transcript_segments: list,
    duration_frames: int,
    fps: int,
    config: dict = None,
    is_claude: bool = False,
    visual_plan: dict = None,
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

    # Generate plan verification criteria if a visual plan was provided
    plan_criteria = generate_plan_verification_criteria(visual_plan)
    if plan_criteria:
        log_debug("EVAL", "Added plan verification criteria to evaluation")

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
- Scale animations: transform with scale() (+5)
- Counter animations: Number interpolation over frames (+5)
- Draw/reveal effects: clipPath or strokeDashoffset (+5)

## Transcript Alignment (0-20 points) - CHECK EACH:
{criteria_list}

Score: +3-4 points for each criterion met (look for the specific content in code)

{plan_criteria}

## Scoring Guide:
- 80-100: Excellent animations + all transcript content visualized
- 60-79: Good animations + most transcript content present
- 40-59: Basic animations, some transcript content missing
- 0-39: Static or transcript content not represented

IMMEDIATELY call SubmitScoreTool:
- visual_quality (0-50): Animation patterns found + plan compliance
- transcript_alignment (0-20): How many criteria above are met
- correctness: 10 (code compiles)
- completeness: 10 (assume complete)
- code_quality: 10 (assume good)
- issues: List unmet transcript criteria AND unimplemented planned components
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
- Scale animations: transform with scale() (+5)
- Counter animations: Number interpolation (+5)
- Draw/reveal: clipPath or strokeDashoffset (+5)

## Transcript-Specific Criteria (0-20 points) - CHECK EACH:
{criteria_list}

{plan_criteria}

## Scoring Guide:
- 80-100: Excellent - spring(), staggering, background motion, all transcript content
- 60-79: Good - some animation variety, most transcript content
- 40-59: Basic - mostly fades, some transcript content missing
- 0-39: Poor - static or transcript content not represented

IMMEDIATELY call SubmitScoreTool:
- visual_quality (0-50): Based on animation patterns in code + plan compliance
- transcript_alignment (0-20): How many criteria above are met
- correctness: 10 (code compiles)
- completeness: 10 (assume complete)
- code_quality: 10 (assume good)
- issues: List missing animation patterns AND unimplemented planned components
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
            # Use timeout wrapper to prevent indefinite hanging on slow LLM API
            run_with_timeout(conversation.run, EVALUATOR_TIMEOUT)
            duration_ms = int((time.time() - start_time) * 1000)
            log_debug("EVAL", f"LLM completed", duration_ms=duration_ms)
            break  # Success - exit retry loop
        except ConversationTimeoutError as e:
            last_error = e
            log_debug("ERROR", f"Evaluator timed out after {EVALUATOR_TIMEOUT}s", attempt=attempt+1)
            # Timeout is retryable - LLM might be overloaded
            if attempt < max_retries - 1:
                log_debug("WARN", f"Retrying after timeout in {retry_delay}s", attempt=attempt+1)
                time.sleep(retry_delay)
                retry_delay *= 2
                continue
            else:
                return {
                    "score": 20,
                    "breakdown": {"visualQuality": 0, "transcriptAlignment": 0, "correctness": 10, "completeness": 5, "codeQuality": 5},
                    "issues": [f"Evaluation timed out after {max_retries} attempts"],
                    "suggestion": "LLM API is slow or unresponsive - try again later"
                }
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
    parser.add_argument("--planning-model", default="google/gemini-2.5-flash-lite", help="LLM model for planning phase (needs good instruction-following). Defaults to gemini-2.5-flash-lite")
    parser.add_argument("--prompt-file", required=True, help="Path to prompt file")
    parser.add_argument("--base-url", required=True, help="LLM API base URL")
    parser.add_argument("--api-key", default=os.environ.get("OPENROUTER_API_KEY", os.environ.get("OPENAI_API_KEY", "not-needed")), help="LLM API key")
    parser.add_argument("--duration-frames", type=int, default=900, help="Video duration in frames")
    parser.add_argument("--fps", type=int, default=30, help="Video FPS")
    parser.add_argument("--width", type=int, default=1080, help="Visual width in pixels")
    parser.add_argument("--height", type=int, default=1920, help="Visual height in pixels")
    parser.add_argument("--temperature", type=float, default=1.0, help="LLM temperature (1.0 required for Gemini 3.x)")
    parser.add_argument("--max-iterations", type=int, default=MAX_ITERATIONS, help="Max visual improvement iterations")
    parser.add_argument("--quality-threshold", type=int, default=QUALITY_THRESHOLD, help="Quality score threshold")
    parser.add_argument("--style-preset", default="modern", help="Style preset (minimal, modern, playful, bold, classic)")
    parser.add_argument("--layout-mode", default="pip", help="Layout mode (pip, split-horizontal, split-vertical)")
    parser.add_argument("--reasoning-effort", default="high", help="Reasoning effort for LLM (none, low, medium, high)")
    parser.add_argument("--skip-planning", action="store_true", help="Skip Visual Director planning phase")
    args = parser.parse_args()

    # Initialize project output directory structure
    if args.bundle_dir:
        ProjectOutput.init(args.bundle_dir, args.project_id)
        ProjectOutput.info("Visual Generator started",
                         project_id=args.project_id,
                         model=args.model,
                         model_flash=args.model_flash,
                         width=args.width,
                         height=args.height,
                         duration_frames=args.duration_frames,
                         style_preset=args.style_preset)

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

    # Detect model type and select appropriate config
    is_claude = is_claude_model(args.model)
    is_small_context = is_small_context_model(args.model)

    if is_claude:
        config = CLAUDE_CONFIG
        context_mode = "claude-200k"
    elif is_small_context:
        config = SMALL_CONTEXT_CONFIG
        context_mode = "small-256k"
    else:
        config = DEFAULT_CONFIG
        context_mode = "large-1m"

    log_debug("PHASE", "=== Starting ===", model=args.model, is_claude=is_claude, context_mode=context_mode)

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
        context_mode=context_mode,
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
            context_mode=context_mode,
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
        component_library_skill = load_skill(skills_dir / "component-library.md") if 'component-library' in skills_to_load else None
        animation_techniques_skill = load_skill(skills_dir / "animation-techniques.md") if 'animation-techniques' in skills_to_load else None
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
            component_library_skill=component_library_skill,  # Component library - reusable components
            animation_techniques_skill=animation_techniques_skill,  # Animation technique implementations
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

        # ========================================
        # PHASE 0: VISUAL DIRECTOR (Planning)
        # ========================================
        visual_plan = None

        if not args.skip_planning:
            ProjectOutput.phase("=== Phase 0: Visual Director ===")

            visual_plan = run_visual_director(
                transcript=prompt,
                project_id=args.project_id,
                width=args.width,
                height=args.height,
                duration_frames=args.duration_frames,
                fps=args.fps,
                style_preset=args.style_preset,
                layout_mode=args.layout_mode,
                llm=evaluator_llm,  # Use flash model for planning (faster, cheaper)
                reasoning_effort=args.reasoning_effort,
                workspace=args.workspace,
                bundle_dir=args.bundle_dir,  # Save to mounted volume immediately
                planning_model=args.planning_model,  # Dedicated model for planning phase
            )

            if visual_plan:
                # Inject plan into prompt for generator
                prompt = inject_visual_plan_into_prompt(prompt, visual_plan)
                ProjectOutput.phase("Visual plan injected into generator prompt",
                               plan_size=len(json.dumps(visual_plan)))
            else:
                ProjectOutput.warn("Visual Director did not produce a plan - proceeding without")
        else:
            ProjectOutput.phase("Planning phase skipped (--skip-planning)")

        # State tracking
        best_score = 0
        best_iteration = 0
        best_code_backup = None  # Track which iteration has best code
        visual_feedback = None
        final_status = "failed"

        for iteration in range(args.max_iterations):
            if cancelled:
                break

            ProjectOutput.phase(f"=== Iteration {iteration + 1}/{args.max_iterations} ===")
            emit_event(EVENT_PHASE_START, phase="iteration", iteration=iteration + 1, max_iterations=args.max_iterations)

            # ===== PHASE 0.5: Backup existing code before generation =====
            if iteration > 0:
                # Backup current code before potentially overwriting
                backup_source_files(args.workspace, args.project_id, iteration)

            # ===== PHASE 1: Generate with self-healing =====
            ProjectOutput.info("Starting generator with self-healing", iteration=iteration + 1)
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
                # Generator failed - try to restore previous good code
                ProjectOutput.error("Generator failed to self-heal",
                               iteration=iteration + 1,
                               error=gen_message[:200])

                # Restore best code if available
                if best_code_backup is not None:
                    ProjectOutput.info("Restoring best code from iteration", from_iteration=best_code_backup)
                    restore_source_files(args.workspace, args.project_id, best_code_backup)

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

            ProjectOutput.info("Generator completed successfully", iteration=iteration + 1)

            # ===== PHASE 1.5: Pre-check for violations (fast fail) =====
            has_critical, violations, code_content = pre_check_violations(
                args.workspace, args.project_id
            )
            if has_critical:
                ProjectOutput.warn("Critical violations detected - will generate targeted fixes",
                              violations=len(violations))
                # Generate targeted fix instructions for next iteration
                targeted_fixes = generate_targeted_fix_instructions(violations, code_content)
                visual_feedback = targeted_fixes

            # ===== PHASE 2: Visual evaluation =====
            ProjectOutput.info("Starting visual evaluation", iteration=iteration + 1)
            score_result = run_visual_evaluation(
                visual_evaluator,
                args.workspace,
                args.project_id,
                transcript_segments,
                args.duration_frames,
                args.fps,
                config=config,
                is_claude=is_claude,
                visual_plan=visual_plan,
            )

            current_score = score_result.get("score", 0)
            ProjectOutput.info("Evaluation complete",
                          iteration=iteration + 1,
                          score=current_score,
                          threshold=args.quality_threshold)
            log_debug("SCORE", f"Iteration result", iteration=iteration+1, score=current_score, threshold=args.quality_threshold)

            # Track best and rollback if score degraded
            if current_score > best_score:
                best_score = current_score
                best_iteration = iteration + 1
                # Backup this version as it's the best so far
                backup_source_files(args.workspace, args.project_id, iteration + 1)
                log_debug("SCORE", f"New best score", best=best_score)
            elif current_score < best_score and best_iteration > 0:
                # Score degraded - restore the best version
                ProjectOutput.warn("Score degraded, restoring best code",
                                  current=current_score, best=best_score, restoring=best_iteration)
                log_debug("SCORE", "Restoring best iteration due to degradation",
                         current=current_score, best=best_score)
                restore_source_files(args.workspace, args.project_id, best_iteration)
                # Update feedback to be more targeted
                visual_feedback = f"""CRITICAL: Your changes DEGRADED the score from {best_score} to {current_score}.
The best code from iteration {best_iteration} has been RESTORED.

DO NOT rewrite from scratch. Make SMALL, TARGETED improvements.
Focus on the specific issues below:
{visual_feedback}"""

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
                final_status = "ready"  # "ready" status allows export
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

        # ===== METADATA ENRICHMENT =====
        # Extract visual timestamps and plan compliance from generated code
        if metadata_path.exists():
            try:
                metadata = json.loads(metadata_path.read_text(encoding='utf-8'))
                index_file = project_dir / "index.tsx"
                if index_file.exists():
                    code_content = index_file.read_text(encoding='utf-8')
                    metadata = enrich_metadata(
                        metadata,
                        code_content,
                        visual_plan=visual_plan,
                        fps=args.fps
                    )
                    metadata_path.write_text(json.dumps(metadata, indent=2), encoding='utf-8')

                    visuals_count = len(metadata.get('visuals', []))
                    compliance = metadata.get('planCompliance', {})
                    emit_event(
                        EVENT_TOOL_CALL,
                        tool="metadata_enrichment",
                        message=f"Enriched metadata: {visuals_count} visuals extracted",
                        visuals_count=visuals_count,
                        plan_compliance_score=compliance.get('score', 0),
                        plan_compliance_details=compliance.get('details', '')
                    )
                    ProjectOutput.phase("Metadata enriched with visual timestamps")
            except Exception as e:
                emit_event(EVENT_TOOL_CALL, tool="metadata_enrichment", message=f"Warning: {e}", success=False)

        if final_status != "ready" and best_score > 0:
            final_status = "ready"  # Allow export even if score didn't meet threshold

        # Copy source files to unified project output (src/)
        ProjectOutput.copy_source(args.workspace, args.project_id)
        ProjectOutput.phase("Source files copied to project output")

        # Also copy to legacy output directory for backwards compatibility
        output_dir = Path(args.output_dir)
        if output_dir.exists():
            project_src = Path(args.workspace) / "src" / args.project_id
            output_project = output_dir / args.project_id

            if project_src.exists():
                import shutil
                if output_project.exists():
                    shutil.rmtree(output_project)
                shutil.copytree(project_src, output_project)

        # =================================================================
        # BUNDLE THE PROJECT - This is the agent's END GOAL
        # The agent cannot exit successfully without a working bundle
        # =================================================================
        bundle_success = False
        bundle_dir = Path(args.bundle_dir)

        # Convert project_id to composition ID (underscores to dashes)
        composition_id = args.project_id.replace('_', '-')

        if project_dir.exists() and bundle_dir.exists():
            ProjectOutput.phase("=== Bundling ===", composition=composition_id)
            emit_event(EVENT_PHASE_START, phase="bundling", message="Creating Remotion bundle...")

            try:
                import shutil

                # Run remotion bundle command
                # Bundle to a temp location first, then merge into project output
                bundle_output = bundle_dir / composition_id
                bundle_temp = bundle_dir / f"{composition_id}-bundle-temp"

                # Clean up temp bundle directory if it exists
                if bundle_temp.exists():
                    shutil.rmtree(bundle_temp)

                emit_tool_call("remotion_bundle", composition_id=composition_id)

                bundle_cmd = [
                    "npx", "remotion", "bundle",
                    "src/index.ts",
                    f"--out-dir={bundle_temp}",
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
                    ProjectOutput.phase("Bundle command succeeded")
                    # Verify bundle was created in temp location
                    bundle_index = bundle_temp / "index.html"

                    # List what files were actually created for debugging
                    if bundle_temp.exists():
                        created_files = list(bundle_temp.glob("*"))
                        ProjectOutput.info(f"Bundle created with {len(created_files)} files")

                    if bundle_index.exists():
                        bundle_success = True
                        ProjectOutput.phase("Bundle verified (index.html found)")
                        # Fix absolute paths in index.html to be relative
                        fix_bundle_paths(bundle_temp)
                        # Compile source TSX to CJS for browser dynamic loading
                        compile_to_cjs(args.workspace, args.project_id, bundle_temp)

                        # Copy bundle files to project output root (for backwards compatibility)
                        # This preserves logs/, plans/, src/ while adding bundle files
                        for f in bundle_temp.glob("*"):
                            if f.is_file():
                                shutil.copy2(f, bundle_output / f.name)
                            elif f.is_dir():
                                dest = bundle_output / f.name
                                if dest.exists():
                                    shutil.rmtree(dest)
                                shutil.copytree(f, dest)

                        # Also copy to build/ subdirectory for organized structure
                        build_dir = ProjectOutput.get_build_dir()
                        if build_dir and build_dir.exists():
                            for f in bundle_temp.glob("*"):
                                if f.is_file():
                                    shutil.copy2(f, build_dir / f.name)
                            ProjectOutput.phase("Bundle copied to build/")

                        # Clean up temp directory
                        shutil.rmtree(bundle_temp)

                        emit_tool_result(
                            "remotion_bundle",
                            success=True,
                            message=f"Bundle created at {bundle_output}",
                            bundle_path=str(bundle_output)
                        )
                    else:
                        # Check if bundle is in a subdirectory of temp
                        for subdir in bundle_temp.iterdir() if bundle_temp.exists() else []:
                            if subdir.is_dir() and (subdir / "index.html").exists():
                                bundle_success = True
                                fix_bundle_paths(subdir)
                                compile_to_cjs(args.workspace, args.project_id, subdir)

                                # Copy to project output
                                for f in subdir.glob("*"):
                                    if f.is_file():
                                        shutil.copy2(f, bundle_output / f.name)

                                emit_tool_result(
                                    "remotion_bundle",
                                    success=True,
                                    message=f"Bundle found in subdirectory {subdir}",
                                    bundle_path=str(bundle_output)
                                )
                                break

                        # Clean up temp
                        if bundle_temp.exists():
                            shutil.rmtree(bundle_temp)

                        if not bundle_success:
                            emit_tool_result(
                                "remotion_bundle",
                                success=False,
                                error="Bundle directory created but index.html not found",
                                bundle_dir_exists=bundle_temp.exists(),
                                files_found=[f.name for f in bundle_temp.glob("*")][:10] if bundle_temp.exists() else []
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

        # Log final summary
        total_iters = min(iteration + 1, args.max_iterations) if 'iteration' in dir() else 0
        ProjectOutput.phase("=== Generation Complete ===",
                          status=final_status,
                          final_score=best_score,
                          best_iteration=best_iteration,
                          total_iterations=total_iters,
                          files_written=files_written,
                          bundle_success=bundle_success,
                          video_rendered=video_url is not None,
                          had_visual_plan=visual_plan is not None)

        # Save final summary
        ProjectOutput.save_summary(
            status=final_status,
            final_score=best_score,
            quality_threshold=args.quality_threshold,
            best_iteration=best_iteration,
            total_iterations=total_iters,
            had_visual_plan=visual_plan is not None,
            bundle_success=bundle_success,
            video_url=video_url,
            files_written=files_written,
            model=args.model,
            model_flash=args.model_flash,
        )

        emit_event(
            EVENT_COMPLETE,
            status=final_status,
            final_score=best_score,
            best_iteration=best_iteration,
            total_iterations=total_iters,
            files_written=files_written,
            video_url=video_url,
            threshold=args.quality_threshold,
            bundle_success=bundle_success,
            bundle_path=str(bundle_dir / composition_id) if bundle_success else None,
        )

    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        ProjectOutput.save_error("fatal", str(e), tb)
        emit_error(
            message=str(e),
            error_type=type(e).__name__,
            stack_trace=tb
        )
        sys.exit(1)


if __name__ == "__main__":
    main()
