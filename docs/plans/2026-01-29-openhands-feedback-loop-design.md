# OpenHands Feedback Loop Design

**Date:** 2026-01-29
**Status:** Approved
**Scope:** Validation feedback loop for Remotion visual generation

## Overview

Implement an iterative refinement loop for the OpenHands visual generator that validates generated code, scores output quality, and iterates until the code compiles and renders correctly.

## Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                    OPENHANDS ITERATIVE REFINEMENT                  │
│                                                                    │
│  ┌─────────────┐         ┌─────────────┐         ┌─────────────┐  │
│  │  GENERATOR  │ ──────► │   CRITIC    │ ──────► │  DECISION   │  │
│  │    Agent    │         │    Agent    │         │   (Score)   │  │
│  └─────────────┘         └─────────────┘         └─────────────┘  │
│        │                       │                       │          │
│        │                       │                  < 90 pts?       │
│        │                       │                       │          │
│        └───────────────────────┴───────────────────────┘          │
│                         (loop if needed)                          │
└────────────────────────────────────────────────────────────────────┘
```

- **Generator Agent**: Creates Remotion code with terminal, file editor tools
- **Critic Agent**: Runs validation tools, scores output, provides feedback
- **Decision**: If score < 90, feed critique back to generator. Max 3 iterations.

## Custom Tools

### 1. TypeScriptValidatorTool

```python
# Action: { files: ["src/proj_xxx/index.tsx"] }
# Executor: Runs `npx tsc --noEmit` on specified files
# Observation: { success: bool, errors: [{ file, line, message }] }
```

Fast syntax/type check. Returns structured errors the agent can parse and fix.

### 2. RemotionBundleTool

```python
# Action: { compositionId: "proj_xxx" }
# Executor: Runs `npx remotion bundle` with the composition
# Observation: { success: bool, bundlePath: str, errors: [] }
```

Full build validation. Catches import errors, missing dependencies, Remotion-specific issues.

### 3. RemotionRenderStillTool

```python
# Action: { compositionId: "proj_xxx", frame: 90 }
# Executor: Runs `npx remotion still` to render a single frame as PNG
# Observation: { success: bool, imagePath: str, imageContent: ImageContent }
```

Renders a frame and returns it as `ImageContent` so the critic agent can see it via vision.

## Scoring System

**Total: 100 points (threshold: 90 to pass)**

| Dimension | Points | Criteria |
|-----------|--------|----------|
| **Correctness** | 25 | TypeScript compiles (10), Remotion bundles (15) |
| **Completeness** | 25 | All transcript segments have visuals (metadata.json covers full duration) |
| **Visual Quality** | 25 | Text readable (10), colors match style (8), no blank/broken frames (7) |
| **Code Quality** | 25 | Uses Remotion patterns correctly (interpolate, useCurrentFrame, etc.) |

**Critic Output Format:**
```json
{
  "score": 85,
  "breakdown": { "correctness": 25, "completeness": 25, "visual": 20, "codeQuality": 15 },
  "issues": ["Text is too small at frame 90", "Missing animation for segment 2"],
  "suggestion": "Increase font size and add fade-in for the second segment"
}
```

## Configuration

- **MAX_ITERATIONS**: 3 cycles
- **QUALITY_THRESHOLD**: 90 points
- **On failure**: Return best attempt with "completed_with_warnings" status

## Agent Configuration

```python
# Generator Agent
generator = Agent(
    llm=llm,
    tools=[
        Tool(name=TerminalTool.name),
        Tool(name=FileEditorTool.name),
        Tool(name=TaskTrackerTool.name),
    ],
    agent_context=AgentContext(skills=[remotion_skill])
)

# Critic Agent
critic = Agent(
    llm=llm,
    tools=[
        Tool(name="TypeScriptValidatorTool"),
        Tool(name="RemotionBundleTool"),
        Tool(name="RemotionRenderStillTool"),
    ],
    agent_context=AgentContext(skills=[scoring_rubric_skill])
)
```

## Files to Create/Modify

| File | Action |
|------|--------|
| `docker/openhands-sandbox/visual_generator.py` | Rewrite with iterative refinement |
| `docker/openhands-sandbox/tools/__init__.py` | Tool package init |
| `docker/openhands-sandbox/tools/typescript_validator.py` | Custom tool |
| `docker/openhands-sandbox/tools/remotion_bundle.py` | Custom tool |
| `docker/openhands-sandbox/tools/remotion_render_still.py` | Custom tool |
| `docker/openhands-sandbox/skills/scoring_rubric.md` | Critic scoring skill |
| `docker/openhands-sandbox/Dockerfile` | Ensure Remotion CLI available |

## Event Stream

Events emitted for TypeScript worker progress tracking:

- `iteration_start` - Beginning iteration N
- `tool_call` - Agent using a tool
- `iteration_complete` - Iteration finished with score
- `complete` - Final status (passed/completed_with_warnings)

## References

- [OpenHands SDK Documentation](https://docs.openhands.dev/sdk)
- [Iterative Refinement Guide](https://docs.openhands.dev/sdk/guides/iterative-refinement)
- [Custom Tools Guide](https://docs.openhands.dev/sdk/guides/custom-tools)
- [Skills Guide](https://docs.openhands.dev/sdk/guides/skill)
