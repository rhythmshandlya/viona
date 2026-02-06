# Two-Agent Visual Generator: Director + Animator Pipeline

## Overview

This design addresses the core problem with the current visual generator: **animations feel random and disconnected from the transcript content**.

### Problems Solved

| Problem | Root Cause | Solution |
|---------|------------|----------|
| No timing alignment | Agent doesn't analyze word timestamps | Director maps key words to exact frames |
| Generic/template feeling | Same patterns regardless of content | Director chooses metaphors specific to THIS topic |
| No narrative arc | Scenes don't build on each other | Director designs story arc with visual continuity |
| No visibility into reasoning | Can't debug why agent made choices | Animator logs every decision |

### Architecture

```
Transcript (with word-level timestamps from WhisperX)
        |
        v
   +-------------------------------------+
   |  DIRECTOR SUBAGENT                  |
   |  Model: Sonnet (fast planning)      |
   |  Tools: Read-only                   |
   |  Permission: plan mode              |
   |                                     |
   |  Outputs:                           |
   |  - SCENE_PLAN.md (human readable)   |
   |  - scenes.json (machine readable)   |
   +-------------------------------------+
        |
        v
   +-------------------------------------+
   |  ANIMATOR SUBAGENT                  |
   |  Model: Opus (quality)              |
   |  Tools: Read, Write, Edit, Bash     |
   |                                     |
   |  Workflow:                          |
   |  1. Read SCENE_PLAN.md              |
   |  2. Create TODO from scenes.json    |
   |  3. For each scene:                 |
   |     - Mark TODO in_progress         |
   |     - Log reasoning to LOG.md       |
   |     - Implement scene               |
   |     - Validate against plan         |
   |     - Mark TODO completed           |
   |                                     |
   |  Outputs:                           |
   |  - constants.ts, index.tsx          |
   |  - IMPLEMENTATION_LOG.md            |
   +-------------------------------------+
        |
        v
   Bundle & Validate
```

**Key Principle:** The Director owns "what story to tell and when." The Animator owns "how to animate it beautifully."

---

## Director Subagent

### Specification

**File:** `.claude/agents/visual-director.md`

```yaml
---
name: visual-director
description: Analyzes video transcripts and creates scene-by-scene animation plans. Use before implementing any visual generation.
tools: Read, Grep, Glob, Write
model: sonnet
permissionMode: plan
---
```

### Director's Process

1. **Parse transcript with timestamps** - Extract each word and its exact timing
2. **Identify story beats** - Find the natural narrative arc in the content
3. **Map concepts to metaphors** - For each abstract idea, choose a concrete visual
4. **Align key moments** - Sync visual events to specific spoken words
5. **Output both files** - `SCENE_PLAN.md` + `scenes.json`

### Director System Prompt

```python
DIRECTOR_SYSTEM_PROMPT = """
<role>
You are a VISUAL STORY DIRECTOR for short-form explainer videos.
Your job is to PLAN, not implement. You analyze transcripts and design scene-by-scene visual stories.
</role>

<philosophy>
The #1 problem with AI-generated animations: they feel RANDOM and DISCONNECTED from the content.

Your job is to FIX THIS by:
1. Deep transcript analysis - understand what's ACTUALLY being explained
2. Precise timestamp alignment - visuals sync to SPECIFIC WORDS
3. Visual continuity - the SAME elements transform across scenes
4. Concrete metaphors - every abstract concept gets a TANGIBLE visual
</philosophy>

<transcript_analysis>
When you receive a transcript with word-level timestamps:

1. **First pass - Understand the content**
   - What is the core concept being explained?
   - What makes this topic interesting/surprising?
   - What's the "aha moment"?

2. **Second pass - Find the story arc**
   - Where is the HOOK? (first intriguing statement)
   - Where is the PROBLEM? (tension/challenge)
   - Where is the INSIGHT? (the clever solution)
   - Where is the PAYOFF? (satisfying conclusion)

3. **Third pass - Identify sync points**
   - Which specific WORDS deserve visual emphasis?
   - "overflow" -> container cracks
   - "random" -> spotlight sweeps
   - "winner" -> element glows gold

4. **Fourth pass - Design visual continuity**
   - What SINGLE visual element persists throughout?
   - How does it TRANSFORM to show the story?
</transcript_analysis>

<output_format>
You MUST create two files:

1. **SCENE_PLAN.md** - Human-readable plan
2. **scenes.json** - Machine-readable for Animator

The Animator will read these files and implement your vision.
Be SPECIFIC. Not "particles appear" but "30 blue particles flow left-to-right at 2px/frame, representing data stream"
</output_format>

<quality_criteria>
Before finishing, verify your plan passes these tests:

[ ] MUTE TEST: Could someone understand the concept with sound off?
[ ] CONTINUITY TEST: Does the same visual element persist and transform?
[ ] SYNC TEST: Are key visuals aligned to specific transcript words?
[ ] UNIQUENESS TEST: Is this plan specific to THIS content, not generic?
[ ] CONNECTION TEST: Does each scene build from the previous?
</quality_criteria>
"""
```

### SCENE_PLAN.md Format

```markdown
# Scene Plan: {project_id}

## Transcript Analysis
- **Core Concept:** [One sentence - what is this video explaining?]
- **Hook Angle:** [What makes this interesting? The "why should I care?"]
- **Unique Visual Identity:** [What makes THIS video distinct from generic templates?]

## Story Arc
1. **Curiosity** (0-10%): [What intrigues the viewer?]
2. **Tension** (10-30%): [What problem/challenge builds?]
3. **Revelation** (30-50%): [The "aha" insight]
4. **Understanding** (50-80%): [How it works step-by-step]
5. **Satisfaction** (80-100%): [Payoff and reinforcement]

## Visual Metaphor System
- **Primary Metaphor:** [e.g., "Data as a river of glowing particles"]
- **Transformation:** [How it evolves - "River overflows bucket -> bucket learns to sample"]
- **Color Palette:** [Specific to this content's mood]

## Scene Breakdown

### Scene 1: Hook (frames 0-90)
- **Timestamp:** 0.00s - 3.00s
- **Transcript excerpt:** "Have you ever wondered how..."
- **Key word sync:** "wondered" at 1.2s -> trigger visual curiosity element
- **Visual:** [What appears on screen]
- **Emotion:** [What viewer should feel]
- **Metaphor connection:** [How this connects to the primary metaphor]

### Scene 2: Problem (frames 90-240)
- **Timestamp:** 3.00s - 8.00s
- **Transcript excerpt:** "But storing everything would..."
- **Key word sync:** "everything" at 4.5s -> container starts overflowing
- **Visual:** [Description]
- **Emotion:** Tension, concern
- **Builds from Scene 1:** [How it connects]

[...continues for each scene...]
```

### scenes.json Format

```json
{
  "projectId": "proj_abc123",
  "fps": 30,
  "totalScenes": 6,
  "primaryMetaphor": "Data as river of particles, memory as physical container",
  "colorPalette": "Cyber Neon",
  "visualContinuity": "The particle stream and container persist throughout",
  "scenes": [
    {
      "id": 1,
      "name": "Hook",
      "frames": [0, 90],
      "timestampRange": [0.0, 3.0],
      "keySync": {
        "word": "wondered",
        "timestamp": 1.2,
        "frame": 36,
        "visualEvent": "curiosity burst animation"
      },
      "visual": "Particles flood in from edges, counter spins wildly",
      "emotion": "intrigue",
      "connectsTo": "Scene 2 - same particles become the problem"
    },
    {
      "id": 2,
      "name": "Problem",
      "frames": [90, 240],
      "timestampRange": [3.0, 8.0],
      "keySync": {
        "word": "everything",
        "timestamp": 4.5,
        "frame": 135,
        "visualEvent": "container starts overflowing"
      },
      "visual": "Container fills with particles, cracks appear, turns red",
      "emotion": "tension",
      "buildsFrom": "Scene 1 particles",
      "connectsTo": "Scene 3 - cracked container transforms"
    }
  ]
}
```

---

## Animator Subagent

### Specification

**File:** `.claude/agents/visual-animator.md`

```yaml
---
name: visual-animator
description: Implements Remotion animations from scene plans. Reads SCENE_PLAN.md, maintains TODO progress, logs reasoning. Use after visual-director completes.
tools: Read, Write, Edit, Bash, Grep, Glob
model: opus
memory: project
hooks:
  PostToolUse:
    - matcher: "Write|Edit"
      hooks:
        - type: command
          command: "npx tsc --noEmit --pretty false 2>&1 | head -20"
---
```

### Animator Workflow

```
1. READ PLAN
   +-- Read SCENE_PLAN.md (understand the story)
   +-- Read scenes.json (load scene list)
   +-- Log: "Plan loaded: {totalScenes} scenes, metaphor: {primaryMetaphor}"

2. CREATE TODO LIST
   +-- TodoWrite: Create one item per scene
   |   Scene 1: Hook - "Particles flood in, counter spins"
   |   Scene 2: Problem - "Container fills and cracks"
   |   ...
   +-- Log: "TODO initialized with {n} scenes"

3. FOR EACH SCENE:
   |
   +-- Mark TODO: in_progress
   |   activeForm: "Implementing Scene 2: Problem - container overflow"
   |
   +-- LOG REASONING (write to IMPLEMENTATION_LOG.md)
   |   "Scene 2 connects from Scene 1's particles.
   |    Plan says: container fills, cracks, turns red at 'everything' (4.5s = frame 135)
   |    I'll use: interpolate for fill level, spring for crack appearance,
   |    color transition red at frame 135 to sync with word."
   |
   +-- IMPLEMENT
   |   Write the scene code in index.tsx
   |
   +-- VALIDATE (against plan)
   |   [x] Does scene use the planned metaphor? (container)
   |   [x] Does key visual sync to correct frame? (135)
   |   [x] Does it connect to previous scene? (same particles)
   |   [x] TypeScript compiles?
   |
   +-- Mark TODO: completed
       content: "Scene 2: Problem - container overflow"

4. FINAL VALIDATION
   +-- Run full TypeScript check
   +-- Verify all scenes connect (visual continuity)
   +-- Write completion summary to IMPLEMENTATION_LOG.md
```

### Animator System Prompt

```python
ANIMATOR_SYSTEM_PROMPT = """
<role>
You are a REMOTION ANIMATION IMPLEMENTER.
You receive a SCENE_PLAN.md from the Director and translate it into production TypeScript code.
The Director decides WHAT to show. You decide HOW to animate it.
</role>

<workflow>
MANDATORY WORKFLOW - Follow this exactly:

1. **READ THE PLAN FIRST**
   - Read SCENE_PLAN.md completely
   - Read scenes.json to understand structure
   - DO NOT write any code until you understand the full plan

2. **CREATE YOUR TODO LIST**
   - Use TodoWrite to create one item per scene
   - Format: "Scene {n}: {name} - {brief description}"

3. **IMPLEMENT SCENE BY SCENE**
   For each scene:

   a) Mark TODO as in_progress
      activeForm: "Implementing Scene {n}: {name}"

   b) Write reasoning to IMPLEMENTATION_LOG.md
      - What does the plan say for this scene?
      - What animation techniques will I use?
      - How does this connect to the previous scene?

   c) Write the code
      - Follow the plan's visual description
      - Sync to the exact frame from keySync
      - Ensure visual continuity with previous scene

   d) Validate against plan
      - Does my implementation match what Director specified?
      - Is the key sync at the correct frame?
      - Does it connect to previous scene?

   e) Mark TODO as completed

4. **FINAL VALIDATION**
   - Run: npx tsc --noEmit
   - Verify all scenes are implemented
   - Check visual continuity across all scenes
</workflow>

<plan_adherence>
CRITICAL: You are implementing the DIRECTOR'S vision, not your own.

- If plan says "container cracks at frame 135" -> animate crack at frame 135
- If plan says "same particles from Scene 1" -> reuse the SAME particle component
- If plan says "blue cyber palette" -> use those exact colors

You can decide:
- Spring configurations (damping, stiffness)
- Stagger timing
- Easing functions
- Component structure

You cannot change:
- What visual metaphor to use
- When key events happen (frame sync)
- How scenes connect
- Color palette
</plan_adherence>

<logging_requirement>
You MUST write to IMPLEMENTATION_LOG.md as you work.

For each scene, log:

## Scene {n}: {name}

**Plan says:**
{quote from SCENE_PLAN.md}

**Key sync:**
{word} at {timestamp}s = frame {frame}

**My implementation:**
- Component: {what I'm building}
- Animation: {technique used}
- Connection to previous: {how it links}

**Validation:**
- [ ] Matches plan's visual description
- [ ] Key sync at correct frame
- [ ] Connects to previous scene
- [ ] TypeScript compiles

This log helps debug issues and proves you followed the plan.
</logging_requirement>
"""
```

### IMPLEMENTATION_LOG.md Format

```markdown
# Implementation Log: proj_abc123

## Plan Summary
- **Primary Metaphor:** Data as river of particles, memory as container
- **Total Scenes:** 6
- **Visual Continuity:** Particle stream and container persist throughout

---

## Scene 1: Hook (frames 0-90)

**Plan says:**
- Particles flood in from edges, counter spins wildly
- Key sync: "wondered" at 1.2s (frame 36) -> curiosity burst

**My approach:**
- Using FlowingParticles component with 40 particles
- Counter uses AnimatedCounter with tabular-nums
- Curiosity burst: ParticleEmitter triggered at frame 36
- Spring config: damping 22, stiffness 90

**Validation:**
- [x] Metaphor matches plan (particles)
- [x] Key sync at frame 36
- [x] TypeScript compiles

---

## Scene 2: Problem (frames 90-240)

**Plan says:**
- Container fills with particles, cracks appear, turns red
- Key sync: "everything" at 4.5s (frame 135) -> overflow begins

**My approach:**
- Reusing particles from Scene 1 (visual continuity)
- Container component with fill level interpolation
- Crack SVG overlay appears at frame 135
- Color transition: blue -> red using interpolateColors

**Validation:**
- [x] Metaphor matches plan (container)
- [x] Key sync at frame 135
- [x] Connects to Scene 1 (same particles)
- [x] TypeScript compiles

---

[...continues for each scene...]

## Final Summary

- **Scenes implemented:** 6/6
- **All key syncs verified:** Yes
- **Visual continuity maintained:** Yes
- **TypeScript status:** Compiles cleanly
```

---

## Transcript Format

The Director needs word-level timestamps to sync visuals precisely.

### Input Format (from WhisperX)

```python
# WhisperX output structure
words = [
    {"word": "Have", "start": 0.00, "end": 0.14},
    {"word": "you", "start": 0.15, "end": 0.27},
    {"word": "ever", "start": 0.28, "end": 0.44},
    {"word": "wondered", "start": 0.45, "end": 0.71},
    # ...
]
```

### Director Format

```markdown
## TRANSCRIPT WITH TIMESTAMPS

| Time (s) | Frame | Word |
|----------|-------|------|
| 0.00 | 0 | Have |
| 0.15 | 4 | you |
| 0.28 | 8 | ever |
| 0.45 | 13 | wondered |
| 0.72 | 21 | how |
| 0.89 | 26 | streaming |
| 1.21 | 36 | services |
| 1.58 | 47 | pick |
| 1.76 | 52 | a |
| 1.82 | 54 | random |
| 2.15 | 64 | song |
| 2.42 | 72 | from |
| 2.58 | 77 | millions? |

## FULL TEXT

Have you ever wondered how streaming services pick a random song from millions?
```

### Formatter Function

```python
def format_transcript_for_director(
    words: list[dict],  # WhisperX output
    fps: int = 30
) -> str:
    """
    Convert WhisperX word-level output to Director-friendly format.
    """
    lines = ["## TRANSCRIPT WITH TIMESTAMPS\n"]
    lines.append("| Time (s) | Frame | Word |")
    lines.append("|----------|-------|------|")

    for w in words:
        time_s = w["start"]
        frame = int(time_s * fps)
        word = w["word"]
        lines.append(f"| {time_s:.2f} | {frame} | {word} |")

    # Also provide full text for context
    lines.append("\n## FULL TEXT\n")
    full_text = " ".join(w["word"] for w in words)
    lines.append(full_text)

    return "\n".join(lines)
```

---

## Integration

### Changes to claude_visual_generator.py

```python
async def generate(self, transcript: str, words: list[dict], ...) -> dict:
    """
    Two-phase generation:
    1. Director analyzes transcript, outputs SCENE_PLAN.md + scenes.json
    2. Animator reads plan, implements scene-by-scene with TODO tracking
    """

    # Format transcript with word-level timestamps
    formatted_transcript = format_transcript_for_director(words, fps)

    # Phase 1: Director
    print("[ClaudeGenerator] Phase 1: Director analyzing transcript...")
    director_result = await self._run_director(formatted_transcript, ...)

    if not director_result["success"]:
        raise RuntimeError(f"Director failed: {director_result['error']}")

    # Verify plan files exist
    scene_plan = self.src_dir / "SCENE_PLAN.md"
    scenes_json = self.src_dir / "scenes.json"

    if not scene_plan.exists() or not scenes_json.exists():
        raise RuntimeError("Director did not produce required plan files")

    print(f"[ClaudeGenerator] Plan created: {scenes_json}")

    # Phase 2: Animator
    print("[ClaudeGenerator] Phase 2: Animator implementing scenes...")
    animator_result = await self._run_animator(...)

    if not animator_result["success"]:
        raise RuntimeError(f"Animator failed: {animator_result['error']}")

    # Bundle and return
    bundle_path = await self._run_bundle()
    await self._compile_cjs(bundle_path)

    return {
        "success": True,
        "bundleUrl": f"/bundles/{bundle_id}/index.html",
        "planFile": str(scene_plan),
        "logFile": str(self.src_dir / "IMPLEMENTATION_LOG.md"),
    }
```

### Director Invocation

```python
async def _run_director(self, formatted_transcript: str, ...) -> dict:
    """Run the Director subagent to create the scene plan."""

    director_prompt = f"""
Analyze this transcript and create a scene-by-scene animation plan.

{formatted_transcript}

## VIDEO SPECS
- Resolution: {width}x{height}
- Duration: {duration_frames} frames ({duration_frames/fps:.1f}s)
- FPS: {fps}

## YOUR TASK
1. Identify the narrative arc (curiosity -> tension -> revelation -> understanding -> satisfaction)
2. For each key concept, choose a CONCRETE visual metaphor
3. Find KEY WORDS where visuals should sync (the "aha" moments)
4. Ensure VISUAL CONTINUITY - same elements transform across scenes

## OUTPUT (create both files in src/{project_id}/)
1. `SCENE_PLAN.md` - Human-readable plan with reasoning
2. `scenes.json` - Machine-readable scene list for the Animator

The Animator will read your plan and implement it. Be specific about:
- WHAT visual appears (not generic "particles" but "river of blue particles flowing left-to-right")
- WHEN it syncs (exact word and timestamp)
- HOW scenes connect (what transforms into what)
"""

    client = ClaudeSDKClient(
        options=ClaudeAgentOptions(
            model="claude-sonnet-4-20250514",
            system_prompt=DIRECTOR_SYSTEM_PROMPT,
            cwd=str(self.workspace),
            max_turns=30,
            allowed_tools=["Read", "Write", "Grep", "Glob"],
        )
    )

    async with client:
        await client.query(director_prompt)
        async for msg in client.receive_response():
            # Stream Director's output
            ...

    return {"success": True}
```

### Animator Invocation

```python
async def _run_animator(self, ...) -> dict:
    """Run the Animator subagent to implement the scene plan."""

    animator_prompt = f"""
## YOUR TASK
Implement the animation plan in SCENE_PLAN.md.

## WORKFLOW
1. Read SCENE_PLAN.md and scenes.json from src/{project_id}/
2. Create a TODO list with one item per scene
3. For each scene:
   - Mark it in_progress
   - Write your reasoning to IMPLEMENTATION_LOG.md
   - Implement the scene in index.tsx
   - Validate it matches the plan
   - Mark it completed
4. Run final TypeScript validation

## RULES
- Follow the plan EXACTLY - the Director decided WHAT, you decide HOW
- Each scene must connect visually to the previous (check "buildsFrom" in plan)
- Sync key visuals to the exact frames specified in "keySync"
- Log your reasoning for EVERY decision

## OUTPUT FILES
- src/{project_id}/constants.ts
- src/{project_id}/index.tsx
- src/{project_id}/metadata.json
- src/{project_id}/IMPLEMENTATION_LOG.md

When complete, respond: "GENERATION COMPLETE"
"""

    client = ClaudeSDKClient(
        options=ClaudeAgentOptions(
            model="claude-opus-4-5-20251101",
            system_prompt=ANIMATOR_SYSTEM_PROMPT,
            cwd=str(self.workspace),
            max_turns=100,
            max_thinking_tokens=10000,
            allowed_tools=["Read", "Write", "Edit", "Bash", "Grep", "Glob", "TodoWrite"],
        )
    )

    async with client:
        await client.query(animator_prompt)
        async for msg in client.receive_response():
            # Stream Animator's output + TODO updates
            ...

    return {"success": True}
```

---

## Validation

### Scene Validation Script

**File:** `scripts/validate-scene.py`

```python
#!/usr/bin/env python3
"""
Validates that implemented scene matches the Director's plan.
"""

import json
import re
import sys
from pathlib import Path

def validate_scene(project_dir: str, scene_id: int) -> dict:
    """
    Check if scene implementation matches plan.
    Returns {"valid": bool, "issues": [...]}
    """
    project_path = Path(project_dir)

    # Load plan
    scenes_json = project_path / "scenes.json"
    if not scenes_json.exists():
        return {"valid": False, "issues": ["scenes.json not found"]}

    plan = json.loads(scenes_json.read_text())
    scene_plan = next((s for s in plan["scenes"] if s["id"] == scene_id), None)

    if not scene_plan:
        return {"valid": False, "issues": [f"Scene {scene_id} not in plan"]}

    # Load implementation
    index_tsx = project_path / "index.tsx"
    if not index_tsx.exists():
        return {"valid": False, "issues": ["index.tsx not found"]}

    code = index_tsx.read_text()
    issues = []

    # Check 1: Key sync frame
    key_sync = scene_plan.get("keySync", {})
    if key_sync:
        expected_frame = key_sync.get("frame", 0)
        # Look for Sequence with approximately correct start frame
        tolerance = 5
        found = False
        for offset in range(-tolerance, tolerance + 1):
            if f"from={{{expected_frame + offset}}}" in code:
                found = True
                break
        if not found:
            issues.append(
                f"Key sync: expected visual event near frame {expected_frame} "
                f"for '{key_sync.get('word')}'"
            )

    # Check 2: Visual continuity
    builds_from = scene_plan.get("buildsFrom", "")
    if builds_from:
        if "particle" in builds_from.lower() and "particle" not in code.lower():
            issues.append(
                f"Visual continuity: plan says builds from '{builds_from}' "
                f"but no particle reference found"
            )

    return {
        "valid": len(issues) == 0,
        "issues": issues,
        "scene_id": scene_id,
        "scene_name": scene_plan.get("name")
    }

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: validate-scene.py <project_dir> <scene_id>")
        sys.exit(1)

    result = validate_scene(sys.argv[1], int(sys.argv[2]))
    print(json.dumps(result, indent=2))
    sys.exit(0 if result["valid"] else 1)
```

### Quality Gates

| Gate | Criteria | Action if Failed |
|------|----------|------------------|
| Plan exists | `SCENE_PLAN.md` + `scenes.json` created | Retry Director |
| All scenes logged | `IMPLEMENTATION_LOG.md` has entry for each scene | Warn, continue |
| TypeScript compiles | `npx tsc --noEmit` exits 0 | Retry Animator |
| Key syncs aligned | >80% of key syncs within +/-5 frames | Warn, log for review |

---

## Output Files

Per project, the pipeline produces:

```
src/{project_id}/
|-- SCENE_PLAN.md          # Director's human-readable plan
|-- scenes.json            # Director's machine-readable plan
|-- IMPLEMENTATION_LOG.md  # Animator's reasoning trail
|-- constants.ts           # Colors, timing, spring configs
|-- index.tsx              # Main Remotion composition
+-- metadata.json          # Remotion metadata
```

---

## Migration Path

### Phase 1: Add Director (low risk)
- Create Director subagent and prompts
- Add transcript formatting
- Run Director before existing generator
- Log Director output but don't use it yet
- Compare: does Director's plan match what current generator produces?

### Phase 2: Add Animator (replace existing)
- Create Animator subagent and prompts
- Modify `generate()` to run Director -> Animator pipeline
- Animator reads Director's plan
- Enable TODO tracking and implementation logging

### Phase 3: Validation & tuning
- Add validation hooks
- Tune prompts based on output quality
- Adjust scenes.json schema if needed

### Rollback Strategy
- Keep old single-agent code path behind a flag
- `USE_TWO_AGENT_PIPELINE=true` enables new flow
- Can revert instantly if issues arise

---

## References

- [Anthropic: Effective Harnesses for Long-Running Agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- [Claude Code: Create Custom Subagents](https://code.claude.com/docs/en/sub-agents)
- [Claude Agent SDK: Todo Tracking](https://platform.claude.com/docs/en/agent-sdk/todo-tracking)
- [Claude Code Plan Mode Best Practices](https://claudelog.com/mechanics/plan-mode/)
