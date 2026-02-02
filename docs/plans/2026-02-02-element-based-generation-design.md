# Element-Based Visual Generation Design

## Problem Statement

The visual generator agent fails to follow instructions reliably. Even with scene-by-scene generation, the agent misses techniques specified in the visual plan. The core issues are:

1. **"Lost in the Middle"** - LLMs focus on start/end of prompts, miss middle content
2. **No think-before-act** - Agent jumps into coding without understanding
3. **Prompts too large** - Scene-level prompts have 5-10 instructions, agent cherry-picks
4. **Self-verification bias** - Agent verifying its own work copies the same mistakes

## Solution: Element-by-Element Generation

Break generation down to atomic units (one element, one technique per prompt) with separate validation context.

### Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                    VISUAL GENERATION PIPELINE                     │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Phase 1: PLAN → Work Queue (no LLM, pure parsing)               │
│                              ↓                                    │
│  Phase 2: GENERATE element-by-element (single conversation)      │
│                              ↓                                    │
│  Phase 3: VALIDATE with fresh agent (separate context)           │
│                              ↓                                    │
│  Phase 4: FIX missing techniques (targeted prompts)              │
│                              ↓                                    │
│           Loop back to Phase 3 until score >= threshold          │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

---

## Data Structures

```python
from dataclasses import dataclass
from typing import List
from enum import Enum

class TaskStatus(Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"

@dataclass
class ElementTask:
    """Atomic unit of work - ONE element, ONE technique."""
    scene_id: str           # "S01"
    element: str            # "comment-particles"
    technique: str          # "particle-emitter"
    frame_start: int        # 0
    frame_end: int          # 150
    is_hero: bool           # True if this is a hero moment
    requirements: List[str] # ["velocity", "gravity", "glow"]
    reference_code: str     # Code snippet from animation-techniques.md
    status: TaskStatus = TaskStatus.PENDING

@dataclass
class WorkQueue:
    """All tasks extracted from visual plan."""
    tasks: List[ElementTask]
    scaffold_complete: bool = False

@dataclass
class ValidationResult:
    """Output from Validator Agent."""
    technique: str
    status: str  # "FOUND" or "MISSING"
    evidence: str  # Line number or reason

@dataclass
class VerificationReport:
    """Full verification output."""
    results: List[ValidationResult]
    score: int  # 0-100
    missing: List[str]  # Techniques that need fixes
```

---

## Phase 1: Extract Work Queue

Parse visual plan into atomic tasks. No LLM needed - pure Python.

```python
TECHNIQUE_REQUIREMENTS = {
    "particle-emitter": {
        "patterns": ["velocity", "gravity", "vx", "vy"],
        "min_matches": 2,
    },
    "mask-reveal": {
        "patterns": ["clipPath", "clip-path", "mask"],
        "min_matches": 1,
    },
    "scale-spring": {
        "patterns": ["spring(", "scale", "damping"],
        "min_matches": 2,
    },
    "staggered-letter-drop": {
        "patterns": [".split('')", ".map", "index"],
        "min_matches": 3,
    },
    # ... more techniques
}

def extract_work_queue(visual_plan: dict, animation_skill: str) -> WorkQueue:
    """Parse visual plan into atomic ElementTask items."""
    tasks = []

    for scene in visual_plan.get("scenes", []):
        scene_id = scene.get("scene_id")
        frame_range = scene.get("frame_range", [0, 100])
        visual_story = scene.get("visual_story", {})

        # Each build_sequence item → ONE task
        for item in visual_story.get("build_sequence", []):
            technique = item.get("technique", "fade-in")
            tech_info = TECHNIQUE_REQUIREMENTS.get(technique, {})

            tasks.append(ElementTask(
                scene_id=scene_id,
                element=item.get("element", "unknown"),
                technique=technique,
                frame_start=frame_range[0] + item.get("at_frame", 0),
                frame_end=frame_range[1],
                is_hero=False,
                requirements=tech_info.get("patterns", []),
                reference_code=extract_technique_code(animation_skill, technique),
            ))

        # Hero moment → ONE task
        hero = visual_story.get("hero_moment", {})
        if hero:
            tasks.append(ElementTask(
                scene_id=scene_id,
                element=hero.get("what", "hero"),
                technique=f"hero-{hero.get('treatment', 'glow')}",
                frame_start=hero.get("frame_range", frame_range)[0],
                frame_end=hero.get("frame_range", frame_range)[1],
                is_hero=True,
                requirements=["scale", "glow", "emphasis"],
                reference_code=get_hero_reference_code(),
            ))

    return WorkQueue(tasks=tasks)
```

---

## Phase 2: Element-by-Element Generation

Single conversation, one element at a time, "Lost in the Middle" prompt structure.

### Prompt Structure (Every Prompt)

```
###CRITICAL: [THE ONE THING THAT MUST NOT BE MISSED]###

[Context - technique details, reference code]

###TASK###
[What to do]

###REMEMBER: [REPEAT THE CRITICAL THING]###
```

### Element Prompt Builder

```python
def build_element_prompt(task: ElementTask, project_id: str) -> str:
    critical = f"{task.technique} MUST have: {', '.join(task.requirements)}"
    wrong = get_common_mistakes(task.technique)

    return f"""###CRITICAL: {critical}###

## Task: Implement {task.element} in {task.scene_id}

**Technique:** {task.technique}
**Frame range:** {task.frame_start} - {task.frame_end}

### Reference Implementation (USE THIS):
```tsx
{task.reference_code}
```

### What to do:
1. Read `src/{project_id}/index.tsx` first
2. Add this element inside the {task.scene_id} section
3. Use the reference code above - don't improvise
4. Run TypeScriptValidatorTool after

### WRONG implementations (DO NOT):
{wrong}

###REMEMBER: {critical} - NOT just opacity fade###"""
```

### Generation Loop

```python
def run_element_by_element_generation(agent, workspace, project_id, work_queue, config):
    from openhands.sdk import Conversation

    # SINGLE conversation for all elements (maintains context)
    conversation = Conversation(
        agent=agent,
        workspace=workspace,
        max_iteration_per_run=config.get('element_max_iterations', 10)
    )

    # Step 1: Create scaffold
    conversation.send_message(build_scaffold_prompt(project_id, work_queue))
    conversation.run()

    # Step 2: Generate each element (WE control pacing)
    for task in work_queue.tasks:
        task.status = TaskStatus.IN_PROGRESS

        # Focused prompt for ONE element
        conversation.send_message(build_element_prompt(task, project_id))
        conversation.run()

        # TypeScript check after EACH element
        ts_ok, ts_errors = run_typescript_check(workspace, project_id)

        if not ts_ok:
            # Fix in same conversation (has context)
            conversation.send_message(f"Fix error: {ts_errors[0]}")
            conversation.run()

        task.status = TaskStatus.COMPLETED

    return True, "Generation complete"
```

---

## Phase 3: Separate Validation Agent

Fresh context - only sees plan + code, not the generation process.

### Why Separate Context?

Research shows self-verification with same context copies mistakes. The validator must:
- Never see the generation conversation
- Only receive: the plan and the generated code
- Have ONE job: verify techniques are implemented

### Validator Agent

```python
def create_validator_agent(llm, config):
    from openhands.sdk import Agent, AgentContext
    from openhands.sdk.context.skills.skill import Skill

    validation_skill = Skill(
        name="validation-rules",
        content="""# Validation Rules

For each technique, check these SPECIFIC patterns:

## particle-emitter
MUST HAVE: velocity/vx/vy AND gravity/* t * t
INVALID: Only opacity animation

## mask-reveal
MUST HAVE: clipPath OR clip-path OR SVG mask
INVALID: Only opacity or scale

## scale-spring
MUST HAVE: spring( AND scale AND damping
INVALID: Linear interpolate or CSS transition
"""
    )

    return Agent(
        llm=llm,
        tools=[FileEditorTool()],  # Only reads files
        context=AgentContext(skills=[validation_skill]),
    )
```

### Validation Prompt

```python
def run_validation(validator_agent, workspace, project_id, visual_plan, work_queue, config):
    # Read generated code
    code_content = read_file(f"src/{project_id}/index.tsx")

    # Build technique list to verify
    techniques = [{"scene": t.scene_id, "technique": t.technique,
                   "requirements": t.requirements} for t in work_queue.tasks]

    prompt = f"""###CRITICAL: Verify EACH technique is ACTUALLY implemented###

## Techniques to Verify
{json.dumps(techniques, indent=2)}

## Generated Code
```tsx
{code_content}
```

## Instructions
For EACH technique, report:
- FOUND (with line evidence) or MISSING (with reason)

## Output Format
TECHNIQUE: particle-emitter (S01)
STATUS: FOUND
EVIDENCE: Lines 45-67 have velocity, gravity

TECHNIQUE: mask-reveal (S02)
STATUS: MISSING
EVIDENCE: No clipPath found

SUMMARY:
FOUND: 5
MISSING: 2
MISSING_LIST: mask-reveal, hero-glow

###REMEMBER: Check ACTUAL patterns, not comments###"""

    # FRESH conversation - no generation context
    conversation = Conversation(agent=validator_agent, workspace=workspace)
    conversation.send_message(prompt)
    conversation.run()

    return parse_validation_response(conversation)
```

---

## Phase 4: Targeted Fixes

Fix ONLY missing techniques with tiny, focused prompts.

```python
def build_fix_prompt(task: ElementTask, project_id: str) -> str:
    critical = f"ADD {task.technique} - MUST have {', '.join(task.requirements[:2])}"

    return f"""###CRITICAL: {critical}###

## FIX REQUIRED: {task.technique} is MISSING from {task.scene_id}

### What's Wrong
Code does NOT have: {', '.join(task.requirements)}

### How to Fix
Add this to {task.scene_id}:
```tsx
{task.reference_code}
```

### Steps
1. Find {task.scene_id} in `src/{project_id}/index.tsx`
2. Add the code above
3. Run TypeScriptValidatorTool

###REMEMBER: {critical}###"""


def run_targeted_fixes(agent, workspace, project_id, work_queue, verification, config):
    conversation = Conversation(agent=agent, workspace=workspace)

    # Read current code first
    conversation.send_message(f"Read `src/{project_id}/index.tsx`. Say 'Ready' when done.")
    conversation.run()

    for technique in verification.missing:
        task = find_task(work_queue, technique)
        conversation.send_message(build_fix_prompt(task, project_id))
        conversation.run()

        # TypeScript check
        ts_ok, _ = run_typescript_check(workspace, project_id)
        if not ts_ok:
            conversation.send_message("Fix TypeScript error. Do NOT remove the technique.")
            conversation.run()

    return True, f"Fixed {len(verification.missing)} techniques"
```

---

## Main Orchestration

```python
def run_element_based_generation(
    workspace, project_id, visual_plan, prompt,
    generator_llm, validator_llm, config, max_fix_rounds=2
):
    # Phase 1: Extract work queue (no LLM)
    work_queue = extract_work_queue(visual_plan, animation_skill)

    # Phase 2: Create generator agent
    generator_agent = create_generator_agent(generator_llm, config)

    # Phase 3: Element-by-element generation
    gen_success, gen_message = run_element_by_element_generation(
        generator_agent, workspace, project_id, work_queue, config
    )

    # Phase 4-5: Validation loop
    for fix_round in range(max_fix_rounds + 1):
        # Create FRESH validator each round
        validator_agent = create_validator_agent(validator_llm, config)

        # Validate
        verification = run_validation(
            validator_agent, workspace, project_id, visual_plan, work_queue, config
        )

        if verification.score >= config.get('quality_threshold', 80):
            return True, verification.score, "All techniques implemented"

        if not verification.missing or fix_round >= max_fix_rounds:
            break

        # Targeted fixes
        run_targeted_fixes(
            generator_agent, workspace, project_id, work_queue, verification, config
        )

    return True, verification.score, f"Completed with score {verification.score}"
```

---

## Key Design Decisions

### Why Element-Level (not Scene-Level)?

| Scene-Level | Element-Level |
|-------------|---------------|
| 5-10 instructions per prompt | 1 instruction per prompt |
| Agent cherry-picks easy parts | Can't miss - only ONE thing |
| Hard to verify what's missing | Clear FOUND/MISSING per element |

### Why Separate Validator?

| Self-Verification | Separate Validator |
|-------------------|-------------------|
| Same context, copies mistakes | Fresh context, no bias |
| "I think I did it right" | "Here's the code, verify it" |
| Can rationalize missing items | Only sees evidence |

### Why "Lost in the Middle" Structure?

Research shows LLMs focus on prompt start/end. By placing critical requirements at BOTH positions:
- Start: `###CRITICAL: velocity + gravity###`
- End: `###REMEMBER: velocity + gravity###`

The agent can't miss the requirement.

---

## Command Line Arguments

```python
parser.add_argument("--element-based", action="store_true", default=True)
parser.add_argument("--no-element-based", dest="element_based", action="store_false")
parser.add_argument("--max-fix-rounds", type=int, default=2)
parser.add_argument("--element-max-iterations", type=int, default=10)
```

---

## Expected Outcomes

1. **Higher technique compliance** - Each technique gets dedicated focus
2. **Fewer missed instructions** - Only ONE instruction per prompt
3. **Better validation** - Fresh context catches actual missing items
4. **Targeted fixes** - Only fix what's actually missing

---

## Implementation Priority

1. Add data structures (ElementTask, WorkQueue, etc.)
2. Implement extract_work_queue() - parse plan into tasks
3. Implement build_element_prompt() with Lost-in-Middle structure
4. Implement run_element_by_element_generation()
5. Implement create_validator_agent() and run_validation()
6. Implement run_targeted_fixes()
7. Wire up main orchestration
8. Add command line arguments
9. Test with existing visual plans
