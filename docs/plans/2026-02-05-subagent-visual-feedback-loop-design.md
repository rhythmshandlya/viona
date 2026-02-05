# Subagent-Based Visual Feedback Loop Design

**Date:** 2026-02-05
**Status:** Draft
**Scope:** Multi-stage validation with subagents for visual generation

## Overview

Replace the current "generate and hope" approach with a **three-stage validation loop** using Claude Agent SDK subagents. Each stage validates a different aspect (plan, code, visuals) and can trigger targeted iteration.

## Key Design Questions Answered

### 1. How does the Validator make the Animator iterate?

**Answer: Orchestrator-Driven Loop with Resume**

```
Main Orchestrator (controls the loop)
    │
    ├── spawn Animator subagent → code
    │
    ├── spawn Validator subagent → feedback
    │       └── Returns: { passed: false, feedback: "Frame 45 missing dice" }
    │
    └── IF not passed:
            resume Animator with feedback → fixed code
            └── (Animator retains full context, just addresses feedback)
```

Subagents **cannot spawn other subagents** (SDK limitation), so the main orchestrator must:
1. Receive validation results
2. Decide whether to iterate
3. Resume the animator with specific feedback

### 2. What should the Validator check?

**Answer: Three-Stage Validation Pipeline (Code-Only, No Screenshots)**

| Stage | Agent | Validates | Triggers |
|-------|-------|-----------|----------|
| **Plan Validation** | `plan-validator` | scenes.json quality, sync points, continuity | Re-run Director |
| **Checkpoint Validation** | `checkpoint-validator` | Scene 1 code structure + patterns | Resume Animator |
| **Code Validation** | `code-validator` | All scenes implemented + animation logic matches plan | Resume Animator |

**Key insight:** The Code Validator verifies animations by **reading the code logic**, not by looking at screenshots. This avoids expensive image tokens in Claude's context.

---

## Architecture

### Validation Strategy: Checkpoint + Final

We use a **hybrid checkpoint approach**:
1. Validate scene 1 immediately (it sets the visual foundation)
2. Let animator complete remaining scenes uninterrupted
3. Full validation at the end

**Why checkpoint scene 1?**
- Scene 1 establishes: color palette, visual metaphor, animation style
- If scene 1 is wrong, all subsequent scenes will inherit those problems
- Catching foundation errors early prevents cascading failures

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     MAIN ORCHESTRATOR AGENT                              │
│                                                                          │
│   ┌─────────────┐                                                        │
│   │  DIRECTOR   │ ──► scenes.json, SCENE_PLAN.md                         │
│   │  (Sonnet)   │                                                        │
│   └──────┬──────┘                                                        │
│          │                                                               │
│          ▼                                                               │
│   ┌─────────────────┐         ┌─────────────────┐                        │
│   │ PLAN VALIDATOR  │ ◄─────► │  Decision:      │                        │
│   │ (Haiku)         │         │  Pass? Retry?   │                        │
│   └─────────────────┘         └────────┬────────┘                        │
│          │                             │                                 │
│          │ (passed)                    │ (failed: re-run Director)       │
│          ▼                             │                                 │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │  ANIMATOR PHASE 1: Scene 1 Only                                  │   │
│   │  ┌─────────────┐                                                 │   │
│   │  │  ANIMATOR   │ ──► Scene 1 code (constants.ts + scene1 in tsx) │   │
│   │  │  (Opus)     │                                                 │   │
│   │  └──────┬──────┘                                                 │   │
│   │         │                                                        │   │
│   │         ▼                                                        │   │
│   │  ┌──────────────────┐    ┌─────────────────┐                     │   │
│   │  │ CHECKPOINT VALID │◄──►│ Foundation OK?  │                     │   │
│   │  │ (Code + Visual)  │    │ Colors? Style?  │                     │   │
│   │  └──────────────────┘    └────────┬────────┘                     │   │
│   │         │                         │                              │   │
│   │         │ (passed)                │ (failed: resume Animator)    │   │
│   └─────────┼─────────────────────────┼──────────────────────────────┘   │
│             │                         │                                  │
│             ▼                         │                                  │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │  ANIMATOR PHASE 2: Remaining Scenes                              │   │
│   │  ┌─────────────┐                                                 │   │
│   │  │  ANIMATOR   │ ──► Scenes 2-N (resume, continue index.tsx)     │   │
│   │  │  (Opus)     │     Uninterrupted flow                          │   │
│   │  └──────┬──────┘                                                 │   │
│   └─────────┼────────────────────────────────────────────────────────┘   │
│             │                                                            │
│             ▼                                                            │
│   ┌─────────────────┐         ┌─────────────────┐                        │
│   │ FINAL CODE      │ ◄─────► │  All scenes     │                        │
│   │ VALIDATOR       │         │  match plan?    │                        │
│   │ (reads code,    │         │  Animation      │                        │
│   │  verifies logic)│         │  logic correct? │                        │
│   └─────────────────┘         └────────┬────────┘                        │
│          │                             │                                 │
│          │ (passed)                    │ (failed: resume Animator)       │
│          ▼                             │                                 │
│   ┌─────────────────┐                  │                                 │
│   │     BUNDLE      │ ◄────────────────┘                                 │
│   │  (final output) │                                                    │
│   └──────┬──────────┘                                                    │
│          │                                                               │
│          ▼                                                               │
│   ┌─────────────────┐                                                    │
│   │    COMPLETE     │                                                    │
│   └─────────────────┘                                                    │
└─────────────────────────────────────────────────────────────────────────┘
```

### Checkpoint Validation (Scene 1)

The checkpoint validates the **foundation** before continuing:

| Check | Why |
|-------|-----|
| Colors match palette | All scenes will use these colors |
| Spring config works | Animation feel carries through |
| Visual metaphor present | Core element that transforms |
| Code structure correct | Patterns other scenes will follow |
| Frame 0 renders | Catches import/setup errors early |

---

## Subagent Definitions

### 1. Director (existing, now a subagent)

```python
"director": AgentDefinition(
    description="Plans visual stories from transcripts. Creates scene breakdowns with sync points.",
    prompt=DIRECTOR_SYSTEM_PROMPT,
    model="sonnet",
    tools=["Read", "Write", "Grep", "Glob", "WebSearch"]
)
```

### 2. Plan Validator (NEW)

```python
"plan-validator": AgentDefinition(
    description="Validates scene plans for quality, coherence, and sync accuracy.",
    prompt="""You validate visual story plans against quality criteria.

READ the scenes.json and SCENE_PLAN.md files, then evaluate:

## Checklist (Score 0-100)

### Structure (25 points)
- [ ] 2-8 scenes (not too many, not too few)
- [ ] Each scene minimum 90 frames (3 seconds)
- [ ] Scenes cover full duration without gaps

### Sync Points (25 points)
- [ ] Each scene has a keySync with specific word
- [ ] keySync.frame is within scene's frame range
- [ ] keySync.visualEvent describes a concrete action

### Visual Continuity (25 points)
- [ ] Primary metaphor identified
- [ ] Same visual element persists across scenes
- [ ] Each scene's "buildsFrom" references previous

### Specificity (25 points)
- [ ] Visuals are concrete, not abstract ("dice rolling" not "randomness shown")
- [ ] Color palette specified
- [ ] No generic descriptions

## Output Format

```json
{
  "passed": true/false,
  "score": 85,
  "issues": ["Scene 3 missing keySync", "Scenes 2-3 have 50 frame gap"],
  "suggestions": ["Add keySync for scene 3 at word 'algorithm'"]
}
```

If score < 75, set passed=false.""",
    model="haiku",  # Fast and cheap for validation
    tools=["Read", "Glob"]  # Read-only
)
```

### 3. Animator (existing, now a subagent)

```python
"animator": AgentDefinition(
    description="Implements Remotion animations from scene plans. Writes TypeScript/TSX code.",
    prompt=ANIMATOR_SYSTEM_PROMPT,
    model="opus",
    tools=["Read", "Write", "Edit", "Bash", "Glob", "Grep", "TodoWrite"]
)
```

### 4. Checkpoint Validator (NEW - Scene 1 Foundation)

```python
"checkpoint-validator": AgentDefinition(
    description="Validates scene 1 foundation: colors, style, structure, visual output.",
    prompt="""You validate the FOUNDATION established by Scene 1.

Scene 1 sets the visual language for the entire animation. Check:

## Code Foundation (Read index.tsx + constants.ts)

### Structure (25 points)
- [ ] constants.ts has COLORS object with primary, secondary, accent, background
- [ ] constants.ts has SPRING_CONFIG with damping, stiffness, mass
- [ ] constants.ts has TIMING object with scene frame ranges
- [ ] index.tsx has default export (MainComposition)
- [ ] index.tsx has RemotionRoot with Composition

### Patterns (25 points)
- [ ] useCurrentFrame() is used (not hardcoded frame numbers)
- [ ] spring() animations use SPRING_CONFIG from constants
- [ ] Colors reference COLORS from constants (not hardcoded hex)
- [ ] Scene 1 has proper frame range check

## Visual Foundation (Look at screenshot)

### Scene 1 Renders (25 points)
- [ ] Frame 0 shows something (not blank/error)
- [ ] Colors match the palette in constants.ts
- [ ] Primary visual element is visible

### KeySync Frame (25 points)
- [ ] The keySync.visualEvent is happening at keySync.frame
- [ ] Animation is at correct progress for this frame

## Output Format

```json
{
  "passed": true/false,
  "score": 85,
  "foundation_issues": ["COLORS.primary not used, hardcoded #ff0000 on line 45"],
  "visual_issues": ["Frame 0 is blank - check if composition renders"],
  "suggestion": "Replace hardcoded colors with COLORS constants"
}
```

IMPORTANT: This is a foundation check. Be strict - problems here cascade to all scenes.
If score < 80, set passed=false.""",
    model="sonnet",  # Needs to understand code + see images
    tools=["Read", "Glob"]
)
```

### 5. Code Validator (NEW - Final Check)

```python
"code-validator": AgentDefinition(
    description="Validates generated Remotion code for correctness and patterns.",
    prompt="""You validate Remotion animation code against best practices.

## Validation Steps

1. **Read the code**: index.tsx, constants.ts
2. **Read the plan**: scenes.json (to verify implementation matches)
3. **Check structure**:
   - Default export exists (MainComposition)
   - RemotionRoot exports Composition
   - useCurrentFrame() used for animations
   - No hardcoded frame numbers (use constants.ts TIMING)

4. **Check each scene from plan**:
   - Scene's visual description implemented
   - keySync frame has the described visual event
   - Proper spring() animations (not linear)

5. **Check patterns**:
   - SPRING_CONFIG used consistently
   - Colors from constants.ts COLORS
   - No inline styles with magic numbers

## Output Format

```json
{
  "passed": true/false,
  "score": 90,
  "issues": [
    "Scene 2 keySync at frame 90 should show 'dice mid-roll' but shows static cube",
    "Missing spring animation on line 45"
  ],
  "codeLocations": [
    {"file": "index.tsx", "line": 45, "issue": "Linear interpolation instead of spring"}
  ]
}
```

If score < 80 or any scene keySync is wrong, set passed=false.""",
    model="sonnet",  # Needs good code understanding
    tools=["Read", "Glob", "Grep"]  # Read-only
)
```

### 5. Visual Validator (NEW)

```python
"visual-validator": AgentDefinition(
    description="Compares rendered frame screenshots against scene plan descriptions.",
    prompt="""You validate rendered animation frames against the visual plan.

You will receive:
1. A screenshot of a rendered frame
2. The scene plan excerpt describing what should appear

## Evaluation Criteria

### Visual Match (50 points)
- Does the screenshot show what the plan describes?
- Is the key visual element present?
- Is it in the right position/state for this frame?

### Quality (30 points)
- Text is readable (if any)
- Colors match the palette
- No visual glitches or blank areas

### Animation State (20 points)
- For keySync frames: Is the visual event happening?
- Is the animation at the right progress for this frame number?

## Output Format

```json
{
  "passed": true/false,
  "score": 75,
  "frame": 45,
  "expected": "Dice should be mid-tumble, showing multiple faces",
  "actual": "Static cube visible, not rotating",
  "suggestion": "Add rotation animation: rotation={[frame * 0.1, frame * 0.15, 0]}"
}
```

If score < 70 for any keySync frame, set passed=false.""",
    model="haiku",  # Fast, uses vision capabilities
    tools=["Read"]  # Only needs to read plan for context
)
```

---

## Orchestration Flow

### Main Orchestrator Prompt

```python
ORCHESTRATOR_PROMPT = """You are the Visual Generation Orchestrator.

Your job is to coordinate subagents to generate high-quality Remotion animations.

## Workflow

### Phase 1: Planning
1. Use the `director` agent to create a scene plan
2. Use the `plan-validator` agent to validate the plan
3. If validation fails (score < 75), tell director the issues and re-run
4. Max 2 planning iterations

### Phase 2: Implementation
1. Use the `animator` agent to implement the plan
2. Use the `code-validator` agent to validate the code
3. If validation fails, RESUME the animator with specific feedback
4. Max 3 code iterations

### Phase 3: Visual Validation
1. Bundle the composition (npx remotion bundle)
2. Render key frames (npx remotion still --frame=N for each keySync)
3. Use the `visual-validator` agent for each key frame
4. If any frame fails, RESUME the animator with the visual feedback
5. Max 2 visual iterations

## Important Rules

- Always RESUME the animator (don't restart) - it retains context
- Pass specific line numbers and issues when requesting fixes
- If max iterations reached, return best attempt with warnings
- Track total iterations and report in final output

## Success Criteria

- Plan validation score >= 75
- Code validation score >= 80
- All keySync frames pass visual validation (score >= 70)
"""
```

### Python Implementation

```python
import asyncio
from claude_agent_sdk import query, ClaudeAgentOptions, AgentDefinition

class VisualGeneratorOrchestrator:
    def __init__(self, workspace: Path, project_id: str):
        self.workspace = workspace
        self.project_id = project_id
        self.src_dir = workspace / "src" / project_id

        # Iteration limits
        self.max_plan_iterations = 2
        self.max_checkpoint_iterations = 2  # Scene 1 foundation
        self.max_code_iterations = 3        # Final code validation
        self.max_visual_iterations = 2      # Visual validation

    async def generate(self, transcript: str, width: int, height: int,
                       duration_frames: int, fps: int) -> dict:
        """Full generation with checkpoint + final validation."""

        # Track state
        animator_agent_id = None
        session_id = None
        iterations = {"plan": 0, "checkpoint": 0, "code": 0, "visual": 0}

        # ============ PHASE 1: PLANNING ============
        plan_valid = False
        while not plan_valid and iterations["plan"] < self.max_plan_iterations:
            iterations["plan"] += 1

            await self._run_director(transcript, width, height, duration_frames, fps)
            validation = await self._validate_plan()

            if validation["passed"]:
                plan_valid = True
                print(f"[Plan] Validated with score {validation['score']}")
            else:
                print(f"[Plan] Failed: {validation['issues']}")

        if not plan_valid:
            return {"success": False, "error": "Plan validation failed"}

        scenes = self._load_scenes()

        # ============ PHASE 2: CHECKPOINT (Scene 1 Only) ============
        checkpoint_valid = False
        while not checkpoint_valid and iterations["checkpoint"] < self.max_checkpoint_iterations:
            iterations["checkpoint"] += 1

            # First iteration: run animator for scene 1 only
            # Subsequent: resume with feedback
            if iterations["checkpoint"] == 1:
                result = await self._run_animator_scene1(scenes)
            else:
                result = await self._resume_animator(animator_agent_id, checkpoint_feedback)

            animator_agent_id = result.get("agent_id")
            session_id = result.get("session_id")

            # Checkpoint validation: code + visual for scene 1
            checkpoint_feedback = await self._validate_checkpoint(scenes["scenes"][0])

            if checkpoint_feedback["passed"]:
                checkpoint_valid = True
                print(f"[Checkpoint] Scene 1 foundation validated")
            else:
                print(f"[Checkpoint] Failed: {checkpoint_feedback['issues']}")

        if not checkpoint_valid:
            return {"success": False, "error": "Scene 1 checkpoint failed"}

        # ============ PHASE 3: REMAINING SCENES (Uninterrupted) ============
        print(f"[Animator] Continuing with scenes 2-{len(scenes['scenes'])}...")

        result = await self._resume_animator_remaining_scenes(
            animator_agent_id,
            session_id,
            scenes
        )
        animator_agent_id = result.get("agent_id")

        # ============ PHASE 4: FINAL CODE VALIDATION ============
        code_valid = False
        code_feedback = None
        while not code_valid and iterations["code"] < self.max_code_iterations:
            iterations["code"] += 1

            if code_feedback:
                # Resume animator with feedback
                result = await self._resume_animator(animator_agent_id, code_feedback)
                animator_agent_id = result.get("agent_id")

            validation = await self._validate_code(scenes)

            if validation["passed"]:
                code_valid = True
                print(f"[Code] All scenes validated with score {validation['score']}")
            else:
                code_feedback = validation
                print(f"[Code] Failed: {validation['issues']}")

        # ============ PHASE 5: FINAL VISUAL VALIDATION ============
        bundle_path = await self._bundle()
        key_frames = [s["keySync"]["frame"] for s in scenes["scenes"]]

        visual_valid = False
        while not visual_valid and iterations["visual"] < self.max_visual_iterations:
            iterations["visual"] += 1

            failed_frames = []
            for frame in key_frames:
                screenshot = await self._render_frame(bundle_path, frame)
                scene = self._get_scene_for_frame(scenes, frame)
                validation = await self._validate_visual(screenshot, scene, frame)

                if not validation["passed"]:
                    failed_frames.append(validation)

            if not failed_frames:
                visual_valid = True
                print(f"[Visual] All {len(key_frames)} key frames validated")
            else:
                # Resume animator with combined visual feedback
                visual_feedback = self._format_visual_feedback(failed_frames)
                await self._resume_animator(animator_agent_id, visual_feedback)
                bundle_path = await self._bundle()
                print(f"[Visual] {len(failed_frames)} frames failed, iterating")

        return {
            "success": True,
            "bundlePath": str(bundle_path),
            "iterations": iterations,
            "warnings": [] if visual_valid else ["Some frames may not perfectly match plan"]
        }

    # ==================== CHECKPOINT METHODS ====================

    async def _run_animator_scene1(self, scenes: dict) -> dict:
        """Run animator for ONLY scene 1 (foundation)."""
        scene1 = scenes["scenes"][0]

        prompt = f"""Implement ONLY Scene 1 from the plan. Stop after scene 1.

Read src/{self.project_id}/scenes.json

Create these files:
- src/{self.project_id}/constants.ts (colors, timing, spring config)
- src/{self.project_id}/index.tsx (Scene 1 ONLY - placeholder for others)

Scene 1 details:
- Name: {scene1['name']}
- Frames: {scene1['frames'][0]} to {scene1['frames'][1]}
- Visual: {scene1['visual']}
- Key sync: At frame {scene1['keySync']['frame']}, show "{scene1['keySync']['visualEvent']}"

IMPORTANT: Only implement scene 1. Add TODO comments for scenes 2-{len(scenes['scenes'])}."""

        return await self._invoke_animator(prompt)

    async def _resume_animator_remaining_scenes(self, agent_id: str,
                                                 session_id: str,
                                                 scenes: dict) -> dict:
        """Resume animator to complete remaining scenes."""
        remaining = scenes["scenes"][1:]

        prompt = f"""Resume agent {agent_id}

Scene 1 is complete and validated. Now implement the remaining {len(remaining)} scenes.

Continue in the same index.tsx file. Replace the TODO placeholders with actual implementations.

Remaining scenes to implement:
{self._format_remaining_scenes(remaining)}

Keep the same visual style, colors, and animation patterns established in Scene 1."""

        return await self._invoke_animator(prompt, resume_session=session_id)

    async def _validate_checkpoint(self, scene1: dict) -> dict:
        """Validate scene 1 foundation: code structure + visual output."""

        # Step 1: Quick code check
        code_check = await self._validate_code_structure()
        if not code_check["passed"]:
            return code_check

        # Step 2: Render frame 0 and keySync frame
        bundle_path = await self._bundle()

        frames_to_check = [0, scene1["keySync"]["frame"]]
        issues = []

        for frame in frames_to_check:
            try:
                screenshot = await self._render_frame(bundle_path, frame)
                visual_check = await self._validate_visual(screenshot, scene1, frame)

                if not visual_check["passed"]:
                    issues.append(visual_check)
            except Exception as e:
                issues.append({
                    "passed": False,
                    "frame": frame,
                    "issues": [f"Failed to render: {str(e)}"]
                })

        if issues:
            return {
                "passed": False,
                "issues": [i["issues"] for i in issues],
                "suggestion": "Fix scene 1 before continuing to other scenes"
            }

        return {"passed": True, "score": 100}

    async def _run_director(self, transcript, width, height, duration_frames, fps,
                            resume_id=None) -> dict:
        """Run Director subagent."""
        prompt = f"""Create a visual story plan for this transcript:

{transcript}

Dimensions: {width}x{height}, {duration_frames} frames at {fps}fps

Write SCENE_PLAN.md and scenes.json to src/{self.project_id}/"""

        session_id = None
        agent_id = None

        async for msg in query(
            prompt=prompt,
            options=ClaudeAgentOptions(
                allowed_tools=["Read", "Write", "Grep", "Glob", "WebSearch", "Task"],
                agents=self._get_agent_definitions(),
                resume=resume_id
            )
        ):
            if hasattr(msg, "session_id"):
                session_id = msg.session_id
            # Extract agent_id from Task tool results
            if hasattr(msg, "content"):
                agent_id = self._extract_agent_id(msg.content)

        return {"session_id": session_id, "agent_id": agent_id}

    async def _validate_plan(self) -> dict:
        """Run Plan Validator subagent."""
        async for msg in query(
            prompt=f"Validate the scene plan in src/{self.project_id}/",
            options=ClaudeAgentOptions(
                allowed_tools=["Read", "Glob", "Task"],
                agents=self._get_agent_definitions()
            )
        ):
            if hasattr(msg, "result"):
                # Parse JSON from result
                return self._parse_validation_result(msg.result)
        return {"passed": False, "score": 0, "issues": ["Validation failed to run"]}

    async def _run_animator(self) -> dict:
        """Run Animator subagent."""
        async for msg in query(
            prompt=f"""Use the animator agent to implement the scene plan.

Read src/{self.project_id}/scenes.json and create:
- src/{self.project_id}/constants.ts
- src/{self.project_id}/index.tsx
- src/{self.project_id}/metadata.json""",
            options=ClaudeAgentOptions(
                allowed_tools=["Read", "Write", "Edit", "Bash", "Glob", "Grep", "Task"],
                agents=self._get_agent_definitions()
            )
        ):
            if hasattr(msg, "session_id"):
                session_id = msg.session_id
            agent_id = self._extract_agent_id(msg)

        return {"session_id": session_id, "agent_id": agent_id}

    async def _resume_animator(self, agent_id: str, feedback: dict) -> dict:
        """Resume Animator with specific feedback."""
        feedback_prompt = self._format_feedback_prompt(feedback)

        async for msg in query(
            prompt=f"""Resume agent {agent_id} and fix these issues:

{feedback_prompt}

Make targeted fixes only - don't rewrite everything.""",
            options=ClaudeAgentOptions(
                allowed_tools=["Read", "Write", "Edit", "Bash", "Glob", "Grep", "Task"],
                agents=self._get_agent_definitions(),
                # Resume the session that contains the animator
            )
        ):
            agent_id = self._extract_agent_id(msg)

        return {"agent_id": agent_id}

    async def _validate_code(self) -> dict:
        """Run Code Validator subagent."""
        async for msg in query(
            prompt=f"""Use the code-validator agent to check:
- src/{self.project_id}/index.tsx
- src/{self.project_id}/constants.ts

Compare against src/{self.project_id}/scenes.json""",
            options=ClaudeAgentOptions(
                allowed_tools=["Read", "Glob", "Grep", "Task"],
                agents=self._get_agent_definitions()
            )
        ):
            if hasattr(msg, "result"):
                return self._parse_validation_result(msg.result)
        return {"passed": False, "score": 0, "issues": ["Validation failed"]}

    async def _render_frame(self, bundle_path: Path, frame: int) -> Path:
        """Render a single frame using Remotion."""
        output_path = self.workspace / "previews" / f"frame_{frame}.png"
        output_path.parent.mkdir(exist_ok=True)

        result = subprocess.run([
            "npx", "remotion", "still",
            str(bundle_path / "index.html"),
            self.project_id,
            str(output_path),
            f"--frame={frame}"
        ], capture_output=True, text=True)

        if result.returncode != 0:
            raise RuntimeError(f"Failed to render frame {frame}: {result.stderr}")

        return output_path

    async def _validate_visual(self, screenshot: Path, scene: dict, frame: int) -> dict:
        """Run Visual Validator subagent with screenshot."""
        # The visual-validator agent receives the image through the prompt
        async for msg in query(
            prompt=f"""Validate this rendered frame against the plan.

Frame: {frame}
Scene: {scene['name']}
Expected visual: {scene['visual']}
Key sync event: {scene['keySync']['visualEvent']}

[Screenshot attached: {screenshot}]""",
            options=ClaudeAgentOptions(
                allowed_tools=["Read", "Task"],
                agents=self._get_agent_definitions(),
                images=[str(screenshot)]  # Pass screenshot to Claude
            )
        ):
            if hasattr(msg, "result"):
                return self._parse_validation_result(msg.result)
        return {"passed": False, "frame": frame, "issues": ["Validation failed"]}

    def _format_feedback_prompt(self, feedback: dict) -> str:
        """Format validation feedback for animator."""
        if "codeLocations" in feedback:
            # Code validation feedback
            lines = ["## Code Issues to Fix\n"]
            for loc in feedback["codeLocations"]:
                lines.append(f"- **{loc['file']}:{loc['line']}** - {loc['issue']}")
            return "\n".join(lines)
        elif "frame" in feedback:
            # Visual validation feedback
            return f"""## Visual Issue at Frame {feedback['frame']}

**Expected:** {feedback['expected']}
**Actual:** {feedback['actual']}
**Suggestion:** {feedback['suggestion']}"""
        else:
            # Generic feedback
            return f"Issues: {feedback.get('issues', [])}"

    def _get_agent_definitions(self) -> dict:
        """Return all subagent definitions."""
        return {
            # Phase 1: Planning
            "director": AgentDefinition(
                description="Plans visual stories from transcripts",
                prompt=DIRECTOR_PROMPT,
                model="sonnet",
                tools=["Read", "Write", "Grep", "Glob", "WebSearch"]
            ),
            "plan-validator": AgentDefinition(
                description="Validates scene plans for quality",
                prompt=PLAN_VALIDATOR_PROMPT,
                model="haiku",
                tools=["Read", "Glob"]
            ),

            # Phase 2: Implementation
            "animator": AgentDefinition(
                description="Implements Remotion animations from plans",
                prompt=ANIMATOR_PROMPT,
                model="opus",
                tools=["Read", "Write", "Edit", "Bash", "Glob", "Grep", "TodoWrite"]
            ),

            # Phase 3: Checkpoint (Scene 1 foundation)
            "checkpoint-validator": AgentDefinition(
                description="Validates scene 1 foundation: code structure, patterns, visual output",
                prompt=CHECKPOINT_VALIDATOR_PROMPT,
                model="sonnet",  # Needs code understanding + vision
                tools=["Read", "Glob"]
            ),

            # Phase 4: Final validation
            "code-validator": AgentDefinition(
                description="Validates all scenes are implemented correctly",
                prompt=CODE_VALIDATOR_PROMPT,
                model="sonnet",
                tools=["Read", "Glob", "Grep"]
            ),
            "visual-validator": AgentDefinition(
                description="Compares rendered screenshots to plan descriptions",
                prompt=VISUAL_VALIDATOR_PROMPT,
                model="haiku",  # Fast, vision-capable
                tools=["Read"]
            )
        }
```

---

## Validation Criteria Summary

### 1. Plan Validation (plan-validator)

| Criterion | Points | Check |
|-----------|--------|-------|
| Scene count | 10 | 2-8 scenes |
| Scene duration | 10 | Each >= 90 frames |
| Coverage | 5 | No gaps in timeline |
| Key sync present | 10 | Each scene has keySync |
| Key sync valid | 10 | Frame within scene range |
| Visual continuity | 15 | buildsFrom references work |
| Specificity | 15 | Concrete descriptions |
| Metaphor | 10 | Primary metaphor identified |
| Colors | 5 | Palette specified |
| Mute test | 10 | Could understand on mute |

**Pass threshold: 75/100**

### 2. Checkpoint Validation (checkpoint-validator) - Scene 1 Only

| Criterion | Points | Check |
|-----------|--------|-------|
| **Code Structure** | | |
| COLORS defined | 10 | constants.ts has color palette |
| SPRING_CONFIG defined | 10 | constants.ts has animation config |
| TIMING defined | 5 | constants.ts has frame ranges |
| Default export | 5 | MainComposition exported |
| RemotionRoot | 5 | Composition registered |
| **Code Patterns** | | |
| useCurrentFrame | 10 | Not hardcoded frame numbers |
| spring() used | 10 | Animations use spring config |
| Constants referenced | 10 | No hardcoded colors/timing |
| **Visual Output** | | |
| Frame 0 renders | 10 | Not blank/error |
| Colors correct | 5 | Match palette |
| KeySync visible | 10 | Event happening at right frame |

**Pass threshold: 80/100** (Strict - foundation must be solid)

### 3. Code Validation (code-validator) - All Scenes

| Criterion | Points | Check |
|-----------|--------|-------|
| Compiles | 20 | TypeScript passes |
| All scenes present | 20 | Each scene from plan implemented |
| Scene frame ranges | 15 | Match scenes.json exactly |
| KeySync accuracy | 20 | Each keySync has matching visual |
| Transitions | 10 | Scenes connect smoothly |
| No regressions | 15 | Scene 1 patterns maintained |

**Pass threshold: 80/100**

### 4. Visual Validation (visual-validator) - All Key Frames

| Criterion | Points | Check |
|-----------|--------|-------|
| Element present | 30 | Key visual element visible |
| Position correct | 20 | Right location in frame |
| Animation state | 20 | Correct progress for frame |
| Text readable | 15 | If text present, readable |
| No glitches | 15 | No blank/broken areas |

**Pass threshold: 70/100 per frame**

---

## Iteration Limits

| Phase | Max Iterations | On Exceed | When |
|-------|---------------|-----------|------|
| Planning | 2 | Fail job | After Director |
| Checkpoint | 2 | Fail job | After Scene 1 |
| Code | 3 | Use best + warning | After all scenes |
| Visual | 2 | Use best + warning | After bundle |

**Total worst case:** 2 + 2 + 3 + 2 = 9 iterations
**Typical case:** 1 + 1 + 1 + 1 = 4 validations (most pass first try)

### Flow Summary

```
Director ──► Plan Validator ──► [PASS] ──► Animator (Scene 1)
                   │                              │
                   │                              ▼
                   │                     Checkpoint Validator
                   │                              │
                   │                         [PASS] ──► Animator (Scenes 2-N)
                   │                              │              │
                   ▼                              │              ▼
              [FAIL: retry                        │      Code Validator
               Director x2]                       │              │
                                                  │         [PASS] ──► Bundle + Render
                                                  │              │           │
                                                  ▼              │           ▼
                                             [FAIL: resume       │   Visual Validator
                                              Animator x2]       │           │
                                                                 │      [PASS] ──► DONE
                                                                 │           │
                                                                 ▼           ▼
                                                            [FAIL: resume   [FAIL: resume
                                                             Animator x3]    Animator x2]
```

---

## Cost Analysis

### Per Generation (Typical - No Iterations)

| Agent | Model | Invocations | Est. Tokens | Cost |
|-------|-------|-------------|-------------|------|
| Director | Sonnet | 1 | 10K | $0.03 |
| Plan Validator | Haiku | 1 | 2K | $0.001 |
| Animator (Scene 1) | Opus | 1 | 15K | $0.23 |
| Checkpoint Validator | Sonnet | 1 | 5K | $0.015 |
| Animator (Scenes 2-N) | Opus | 1 (resume) | 20K | $0.30 |
| Code Validator | Sonnet | 1 | 5K | $0.015 |
| Visual Validator | Haiku | 4-6 frames | 6K | $0.003 |

**Total typical:** ~$0.60 per generation

### With Iterations (Worst Case)

| Phase | Extra Cost |
|-------|------------|
| Plan retry (x1) | +$0.03 |
| Checkpoint retry (x1) | +$0.25 |
| Code retry (x2) | +$0.35 |
| Visual retry (x1) | +$0.30 |

**Total worst case:** ~$1.50 per generation

### Comparison to Current

| Approach | Cost | Success Rate | Effective Cost |
|----------|------|--------------|----------------|
| Current (no validation) | $0.50 | ~60% | $0.83/success |
| Checkpoint validation | $0.60 | ~85% | $0.71/success |
| Full validation (worst) | $1.50 | ~95% | $1.58/success |

**Net benefit:** Higher upfront cost, but fewer wasted generations and manual re-runs.

### Using OAuth (Claude Pro/Max)

If using OAuth authentication (no API costs), the token costs above don't apply. The main cost becomes compute time:
- Typical generation: 3-5 minutes
- With iterations: 5-10 minutes

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `packages/worker/src/agents/orchestrator.py` | NEW | Main orchestrator with checkpoint loop |
| `packages/worker/src/agents/prompts/plan_validator.py` | NEW | Plan validation prompt |
| `packages/worker/src/agents/prompts/checkpoint_validator.py` | NEW | Scene 1 foundation validation |
| `packages/worker/src/agents/prompts/code_validator.py` | NEW | All-scenes code validation |
| `packages/worker/src/agents/prompts/visual_validator.py` | NEW | Screenshot comparison prompt |
| `packages/worker/src/agents/render_utils.py` | NEW | renderStill wrapper for Python |
| `packages/worker/src/agents/claude_visual_generator.py` | MODIFY | Use orchestrator instead of direct generation |
| `packages/worker/src/processors/generate-visuals.ts` | MODIFY | Update to call new orchestrator |

### File Structure

```
packages/worker/src/agents/
├── orchestrator.py              # NEW: Main loop with checkpoints
├── render_utils.py              # NEW: Frame rendering helpers
├── claude_visual_generator.py   # MODIFY: Simplified, calls orchestrator
├── prompts/
│   ├── director.py              # EXISTS
│   ├── animator.py              # EXISTS
│   ├── plan_validator.py        # NEW
│   ├── checkpoint_validator.py  # NEW
│   ├── code_validator.py        # NEW
│   └── visual_validator.py      # NEW
└── ...
```

---

## Open Questions

1. **Image passing to subagents:** The `images` parameter in `query()` sends images to the main agent. For subagents, we may need to:
   - Write screenshot to disk, pass path in prompt
   - Or use base64 encoding in the prompt itself
   - Need to verify which approach works with Claude Agent SDK

2. **Session vs Agent ID:**
   - `session_id`: The conversation session (contains multiple agents)
   - `agent_id`: Specific subagent instance within a session
   - To resume animator, we need BOTH: resume session, then reference agent by ID

3. **Parallel visual validation:** Could spawn multiple visual-validator instances for different frames. But:
   - Increases complexity
   - May hit rate limits
   - Current sequential approach is simpler, add parallelism later if needed

4. **Bundle caching:** Currently re-bundles after each fix. Could:
   - Use `esbuild --watch` for faster rebuilds
   - Only invalidate changed files
   - Worth optimizing after basic flow works

---

## Implementation Phases

### Phase 1: Foundation (Do First)
1. Create `render_utils.py` with `render_frame()` using Remotion CLI
2. Create `checkpoint_validator.py` prompt
3. Modify `claude_visual_generator.py` to do scene-1-only + checkpoint
4. Test: Scene 1 generates → checkpoint validates → passes/fails

### Phase 2: Full Flow
1. Create `orchestrator.py` with complete loop
2. Add `code_validator.py` and `visual_validator.py` prompts
3. Implement resume logic for animator
4. Test: Full generation with all validation stages

### Phase 3: Optimization
1. Add parallel frame rendering
2. Optimize bundle caching
3. Add progress streaming to TypeScript processor
4. Measure and tune iteration limits

---

## Success Criteria

- [ ] Scene 1 checkpoint catches foundation errors before continuing
- [ ] Animator can be resumed with specific feedback (not full regeneration)
- [ ] Visual validator correctly identifies mismatches between screenshots and plan
- [ ] Total generation time < 10 minutes for typical case
- [ ] Success rate > 85% (vs current ~60%)
