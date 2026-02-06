# Claude Code Visual Generator - Optimization Guide

**Date:** 2026-02-04
**Purpose:** Best practices and optimizations for the Claude Code visual generator

## Overview

This guide documents state-of-the-art practices for Claude Agent SDK to maximize the quality and efficiency of our visual generator.

---

## 1. Context Optimization

### Key Principles

Context is the most valuable resource. Performance degrades significantly as context fills up:
- **70%**: Quality starts degrading
- **80-100%**: Disproportionately poor value
- **95%**: Auto-compaction triggers

### Strategies for Visual Generator

#### A. Use Subagents for Isolation
Each subagent runs in a separate context window, keeping the main context clean:

```python
from claude_agent_sdk import query, ClaudeAgentOptions, AgentDefinition

# Define specialized subagents
agents = {
    "code-writer": AgentDefinition(
        description="Writes Remotion component code",
        prompt="Generate high-quality TypeScript/React code for Remotion.",
        tools=["Write", "Edit", "Read"]
    ),
    "validator": AgentDefinition(
        description="Validates TypeScript code",
        prompt="Run TypeScript validation and fix any errors.",
        tools=["Bash", "Read", "Edit"]
    )
}
```

#### B. Compact System Prompts
Keep system prompts focused. Move detailed references to CLAUDE.md or skills:

```markdown
# Bad - Bloated system prompt
You are a Remotion video generator...
[500+ lines of examples and guidelines]

# Good - Focused system prompt with external references
You are a Remotion video generator.

## Resources
- Animation patterns: See component-library skill
- Style guidelines: See CLAUDE.md
```

#### C. Use Skills for Code Examples
Instead of embedding code examples in prompts, use skills:

```yaml
# ~/.claude/skills/remotion-patterns/SKILL.md
---
name: remotion-patterns
description: Common Remotion animation patterns and components
user-invocable: false
---

## Spring Animation
```tsx
const progress = spring({
  frame: frame - startFrame,
  fps,
  config: { damping: 22, stiffness: 90, mass: 0.9 }
});
```

## Staggered Elements
```tsx
{items.map((item, i) => (
  <Element key={i} style={{
    opacity: spring({
      frame: frame - startFrame - i * 6,
      fps,
      config: SPRING_CONFIG
    })
  }} />
))}
```
```

---

## 2. Extended Thinking / Planning Mode

### Configuration

```python
client = ClaudeSDKClient(options=ClaudeAgentOptions(
    model="claude-sonnet-4-20250514",
    max_thinking_tokens=10000,  # Minimum: 1024
    # ...
))
```

### Budget Guidelines

| Task Complexity | Recommended Budget |
|-----------------|-------------------|
| Simple edits | 1024-2048 |
| Single component | 2048-5000 |
| Multi-scene composition | 5000-10000 |
| Complex architecture | 10000-20000 |

### Prompting for Thinking

**Less effective (prescriptive):**
```
Think through this step by step:
1. First, identify the scenes
2. Then, design the animations...
```

**More effective (general):**
```
Please think about this video composition thoroughly.
Consider multiple visual approaches and show your complete reasoning.
Plan the timing and transitions before writing any code.
```

### Self-Verification Prompting

```python
USER_MESSAGE = """
...

When finished:
1. Verify TypeScript compiles: npx tsc --noEmit
2. Check all scenes have proper timing
3. Verify spring configs use damping >= 20
4. Fix any issues before declaring complete.
"""
```

### Trigger Words for Thinking Budget

In Claude Code, these phrases map to increasing budgets:
- `"think"` → minimal budget
- `"think hard"` → moderate budget
- `"think harder"` → large budget
- `"ultrathink"` → maximum budget (include in skill content)

---

## 3. Skills Architecture

### Skill Structure for Visual Generation

```
packages/worker/
├── .claude/
│   ├── CLAUDE.md                    # Project context
│   └── skills/
│       ├── remotion-patterns/
│       │   └── SKILL.md             # Animation patterns
│       ├── visual-metaphors/
│       │   └── SKILL.md             # Visual metaphor examples
│       └── validation/
│           └── SKILL.md             # TypeScript validation
└── remotion-template/
    └── .claude/
        └── CLAUDE.md                # Template-specific context
```

### Example Skills

#### remotion-patterns/SKILL.md
```yaml
---
name: remotion-patterns
description: Remotion animation patterns for visual generation
user-invocable: false
---

## Spring Configuration (ALWAYS use this)
```tsx
const SPRING_CONFIG = { damping: 22, stiffness: 90, mass: 0.9 };
const progress = spring({frame: frame - startFrame, fps, config: SPRING_CONFIG});
```

## Glassmorphism Container
```tsx
const GlassCard: React.FC<{children: React.ReactNode}> = ({children}) => (
  <div style={{
    background: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
  }}>
    {children}
  </div>
);
```

## Particle System
```tsx
const ParticleEmitter: React.FC<{count: number, startFrame: number}> = ({count, startFrame}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return (
    <>
      {Array.from({length: count}).map((_, i) => {
        const delay = i * 6;
        const progress = spring({
          frame: frame - startFrame - delay,
          fps,
          config: SPRING_CONFIG
        });
        const angle = (i / count) * Math.PI * 2;
        const radius = progress * 100;
        return (
          <div key={i} style={{
            position: 'absolute',
            left: `calc(50% + ${Math.cos(angle) * radius}px)`,
            top: `calc(50% + ${Math.sin(angle) * radius}px)`,
            width: 8, height: 8,
            borderRadius: '50%',
            background: '#8b5cf6',
            opacity: interpolate(progress, [0, 0.8, 1], [0, 1, 0]),
          }} />
        );
      })}
    </>
  );
};
```

## PROHIBITED Patterns
- Math.sin/cos on text rotation
- damping < 20 in spring config
- All elements animating simultaneously (always stagger by 6+ frames)
- Static backgrounds with no motion
```

#### validation/SKILL.md
```yaml
---
name: ts-validation
description: TypeScript validation for generated code
context: fork
agent: general-purpose
allowed-tools: Bash, Read, Edit
---

Validate the generated TypeScript code:

1. Run: `npx tsc --noEmit --pretty false`
2. If errors found:
   - Read the error messages
   - Fix each error in the code
   - Re-run validation
3. Repeat until all errors are fixed
4. Report success or remaining issues
```

### CLAUDE.md for Project Context

```markdown
# Remotion Visual Generator Workspace

## Code Style
- Use TypeScript with React
- All components must be typed
- Use `useCurrentFrame()` and `useVideoConfig()` hooks
- Prefer `interpolate()` over manual calculations

## Animation Rules
- ALWAYS use spring config: { damping: 22, stiffness: 90, mass: 0.9 }
- Stagger elements by 6+ frames minimum
- Use `extrapolateRight: 'clamp'` in interpolate()
- NO Math.sin/cos on text positions

## File Structure
- constants.ts: Colors, timing, sizes
- index.tsx: Main composition with all scenes

## Commands
- Validate: `npx tsc --noEmit`
- Bundle: `npx remotion bundle`
```

---

## 4. System Prompt Best Practices

### Use XML Tags for Structure

```python
SYSTEM_PROMPT = """
<role>
You are a Remotion video generator that creates animated educational videos.
</role>

<workspace>
- Working directory: {workspace_dir}
- Output: src/{project_id}/index.tsx
- Constants: src/{project_id}/constants.ts
</workspace>

<process>
1. THINK: Plan the visual story (use extended thinking)
2. WRITE: Create the Remotion composition
3. VALIDATE: Run TypeScript check and fix errors
</process>

<constraints>
- Single file output (no splitting)
- {width}x{height} resolution, {fps} FPS
- Must pass TypeScript validation
</constraints>

<use_parallel_tool_calls>
When reading multiple files or making independent changes,
use parallel tool calls for efficiency.
</use_parallel_tool_calls>
"""
```

### Be Explicit About Actions

```python
# Less effective
"Create an animated video"

# More effective
"""
Create an animated video composition. Include:
- 4-6 distinct scenes with clear transitions
- Visual metaphors for abstract concepts
- Smooth spring animations (damping >= 20)
- Staggered element entrances (6+ frame delays)

Before finishing, verify:
1. TypeScript compiles without errors
2. All imports are valid
3. No unused variables
"""
```

### Add Context for Rules

```python
# Less effective
"NEVER use Math.sin on text"

# More effective
"""
NEVER use Math.sin/cos for text positioning.
This causes jittery, unreadable text that harms video quality.
Use spring() for smooth, natural motion instead.
"""
```

---

## 5. Tool Usage Optimization

### Parallel Tool Calls

```xml
<parallel_tools>
When reading or writing multiple independent files,
make all calls in parallel. For example:
- Reading constants.ts and index.tsx: 2 parallel Read calls
- Writing both files: 2 parallel Write calls
Never wait for one to complete before starting another
if they're independent.
</parallel_tools>
```

### Tool Selection Guidelines

| Task | Preferred Tool |
|------|---------------|
| Read files | Read (not cat) |
| Write files | Write (not echo) |
| Edit files | Edit (not sed) |
| Find files | Glob (not find) |
| Search content | Grep (not grep) |
| Run commands | Bash |
| Validate code | Bash with tsc |

### Allowed Tools Configuration

```python
ClaudeAgentOptions(
    allowed_tools=[
        "Read(./**)",      # Read any file in workspace
        "Write(./**)",     # Write to workspace
        "Edit(./**)",      # Edit workspace files
        "Glob(./**)",      # Find files
        "Grep(./**)",      # Search content
        "Bash(*)",         # Run any command
    ],
    permission_mode="acceptEdits"  # Auto-approve file changes
)
```

---

## 6. Session & State Management

### For Multi-Step Generation

```python
# Track session for potential resume
session_id = None

async for message in query(
    prompt=user_message,
    options=ClaudeAgentOptions(...)
):
    if hasattr(message, 'subtype') and message.subtype == 'init':
        session_id = message.data.get('session_id')

    if hasattr(message, 'result'):
        # Generation complete
        break

# Can resume later if needed
async for message in query(
    prompt="Continue fixing remaining issues",
    options=ClaudeAgentOptions(resume=session_id)
):
    ...
```

### State Files for Long-Running Tasks

Create structured state files for tracking:

```json
// generation-state.json
{
  "projectId": "proj-abc123",
  "phase": "validation",
  "scenes": [
    {"id": 1, "name": "intro", "status": "complete"},
    {"id": 2, "name": "concept", "status": "in_progress"}
  ],
  "validationPassed": false,
  "lastError": null
}
```

---

## 7. Implementation Checklist

### Updated System Prompt Template

```python
SYSTEM_PROMPT = """
<role>
You are a Remotion video generator. You create animated educational videos from transcripts.
</role>

<workspace>
- Working directory: {workspace_dir}
- Output files:
  - src/{project_id}/constants.ts (colors, timing, sizes)
  - src/{project_id}/index.tsx (main composition)
</workspace>

<process>
1. **PLAN** (use extended thinking thoroughly):
   - Identify 4-6 key moments from transcript
   - Design visual metaphors for abstract concepts
   - Plan timing (frames) for each scene
   - Consider transitions between scenes

2. **WRITE**: Create the Remotion composition
   - Write constants.ts first
   - Write index.tsx with all scenes and animations

3. **VALIDATE**: Run TypeScript check
   - Execute: npx tsc --noEmit --pretty false
   - Fix ALL errors before finishing
</process>

<animation_rules>
CRITICAL - Follow these exactly:
- Spring config: {{ damping: 22, stiffness: 90, mass: 0.9 }}
- Stagger elements by 6+ frames (NEVER animate all at once)
- Use interpolate() with extrapolateRight: 'clamp'
- NO Math.sin/cos on text positions (causes jittery text)
</animation_rules>

<constraints>
- Resolution: {width}x{height}
- Duration: {duration_frames} frames ({fps} FPS)
- Single file output (no component splitting)
- MUST pass TypeScript validation
</constraints>

<quality_checklist>
Before declaring complete, verify:
- [ ] All scenes have proper timing
- [ ] Spring damping >= 20 in all configs
- [ ] Elements staggered (not simultaneous)
- [ ] TypeScript compiles with no errors
- [ ] All imports are valid
</quality_checklist>
"""
```

### Updated User Message Template

```python
USER_MESSAGE = """
## PROJECT: {project_id}

## VIDEO SPECS
- Resolution: {width}x{height}
- Duration: {duration_frames} frames ({duration_seconds}s)
- FPS: {fps}

## TRANSCRIPT
{transcript}

## YOUR TASK
Create a visually engaging Remotion video that explains this content.

Think thoroughly about:
1. What visual metaphors best represent the concepts?
2. How should scenes flow and transition?
3. What animations will enhance understanding?

Requirements:
- 4-6 scenes building understanding progressively
- Visual metaphors (not just text)
- Smooth spring animations (damping >= 20)
- Staggered element entrances (6+ frame delays)
- All elements readable at {width}x{height}

Output files:
- src/{project_id}/constants.ts
- src/{project_id}/index.tsx

When TypeScript validation passes, respond with:
GENERATION COMPLETE

Include a brief summary of scenes created.
"""
```

---

## 8. Sources

- [Agent SDK Overview](https://platform.claude.com/docs/en/agent-sdk/overview)
- [Claude Code Skills](https://code.claude.com/docs/en/skills)
- [Extended Thinking Tips](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/extended-thinking-tips)
- [Effective Context Engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [Claude 4.x Prompting Best Practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-4-best-practices)
- [XML Tags in Prompts](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/use-xml-tags)
