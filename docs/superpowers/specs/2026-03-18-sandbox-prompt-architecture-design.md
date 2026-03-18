# Sandbox Prompt Architecture Redesign — Design Spec

> **Goal:** Restructure the sandbox from 4 overloaded agents to 5 focused agents with optimized prompts, deterministic tooling, and professional video editing techniques.

---

## Problem Statement

The current sandbox pipeline makes mistakes across all 4 subagents (Editor, Planner, Animator, Reviewer). Root causes:

1. **Prompts are too long** — Editor is 34.6KB (3 jobs in one), Animator is 64KB+shared. Research shows LLM instruction-following degrades around 3,000 tokens; the Animator prompt is ~16K tokens.
2. **"Lost in the middle" effect** — Critical rules (interpolate clamping, frame timing) get buried in pages of technique descriptions. Models attend to beginning and end, not middle.
3. **No professional editing techniques** — J-cuts, L-cuts, zoom punch-ins for jump cuts, pacing oscillation are absent.
4. **Timestamp desync bug** — Planner reads raw `transcript.json` but Editor has already modified the manifest with ripple shifts. Scene boundaries and sync points are wrong.
5. **Editor overload** — One agent handles transcript trimming, rough cut, and final assembly — three fundamentally different skill sets.
6. **Unreliable skill loading** — Agents are told to call the `Skill` tool but may skip it, working without critical domain knowledge.
7. **No full-timeline QC** — Reviewer only checks individual scenes, never the assembled timeline.

---

## Architecture: 5-Agent Pipeline

### Agents

| Agent | Responsibility | Model | Prompt Budget |
|-------|---------------|-------|---------------|
| **Trim Editor** | Transcript trimming, jump cut coverage, J/L-cuts, pacing, captions | Opus | ~4KB system + skills |
| **Planner** | Transcript analysis, spatial layout, creative direction, display modes | Opus | ~6KB system + skills |
| **Visual Editor** | Rough cut (Phase 4), final assembly (Phase 7) | Opus | ~4KB system + skills |
| **Animator** | Per-scene .tsx file generation (no base prompt, only per-scene assembly) | Opus | ~3KB per-scene |
| **QC Reviewer** | Per-scene review + full-timeline verification after assembly | Sonnet | ~4KB system + skills |

### Orchestrator

Slim orchestrator (~10-15KB): personality, phase flow, dispatch rules, widget/progress mechanics. Each agent owns its own domain knowledge.

### Pipeline Flow

```
Phase 1: Brainstorm (Orchestrator — no subagent)
    │ analyzeTranscript() deterministic tool
    ▼
Phase 2: Trim Editor
    │ sync_transcript built into manifest ops
    ▼
Phase 3: Planner (reads current transcript.json)
    │ user approves plan via widget
    ▼
Phase 4: Visual Editor — Rough Cut
    ▼
Phase 5: Animator (per scene, parallel)
    │ ↕ QC Reviewer (per scene, mesh iteration, max 2 retries)
    ▼
Phase 7: Visual Editor — Final Assembly
    ▼
Phase 7.5: QC Reviewer — Full Timeline QC
    ▼
Phase 8: Refinement (Orchestrator dispatches targeted agent)
```

---

## Prompt Architecture

### Assembly Order (per agent)

Research-backed structure:

1. **Shared modules (cacheable prefix)** — Context, reference material at TOP
2. **Agent system prompt (~500 words)** — Role, core rules, task
3. **Few-shot example (~300-500 words)** — One concrete good/bad example
4. **Injected context (variable)** — Scene brief, theme, dimensions
5. **Critical rules repeated (~100 words)** — Sandwich pattern at BOTTOM

### Format Convention

XML tags for structural boundaries (Claude is trained for these), Markdown for readable content inside:

```xml
<role>
You are a Trim Editor for the Viona platform...
</role>

<rules>
- ALWAYS process trims in reverse chronological order
- Audio and video items from same source are married — edit both identically
</rules>

<context>
{{INJECTED_CONTEXT}}
</context>

<task>
Phase 2: Trim the transcript...
</task>

<example>
## Good trim decision
Before: "So, um, the thing is, um, we need to, you know, focus on..."
After: "So, the thing is, we need to focus on..."
Removed: 2 fillers ("um" x2), 1 hedge ("you know")
Padding: 150ms gaps at each removal point
</example>

<critical_reminder>
REVERSE chronological order. Edit BOTH audio and video. Never cut pauses < 300ms.
</critical_reminder>
```

### File Structure

```
packages/sandbox/src/prompts/
  shared/
    identity.xml              # Shared Viona persona fragment
    manifest-tools.xml        # Tool reference table (all agents)
    quality-rules.xml         # Non-negotiable rules (clamping, sync, etc.)

  orchestrator/
    system.md                 # ~10-15KB: personality, phases, dispatch

  trim-editor/
    system.md                 # ~3-4KB: identity, core rules, task
    examples/
      good-trim.md            # Concrete before/after trim example

  planner/
    system.md                 # ~5-6KB: identity, analysis, layout rules
    examples/
      good-plan.md            # Concrete SCENE_PLAN.md example

  visual-editor/
    system.md                 # ~3-4KB: identity, rough cut + assembly rules
    examples/
      good-rough-cut.md       # Concrete rough cut example

  animator/
    # NO system.md — prompt-assembly.ts is the ONLY prompt source
    # Skills loaded via SDK skills field

  qc-reviewer/
    system.md                 # ~3-4KB: checklist, verdict rules
    examples/
      good-review.md          # Concrete pass/fail verdict example

  prompt-loader.ts            # Assembles: shared + agent prompt + examples + context + reminder
  prompt-assembly.ts          # Animator per-scene builder (existing, expanded)
```

### Prompt Loader Assembly

```typescript
async function assemblePrompt(agentName: string, ctx: PromptContext): Promise<string> {
  const shared = await loadSharedModules();          // cacheable prefix
  const system = await loadAgentSystem(agentName);   // agent-specific
  const examples = await loadExamples(agentName);    // few-shot
  const reminder = await loadCriticalReminder(agentName); // sandwich bottom

  const assembled = [shared, system, examples].join('\n\n---\n\n');
  const injected = injectContext(assembled, ctx);

  return injected + '\n\n---\n\n' + reminder;
}
```

### Prompt Caching Strategy

Layers 1-3 (shared + system + examples) are static per agent type — cacheable across dispatches. Only layer 4 (injected context) varies per scene/phase. This enables Anthropic's prompt caching (up to 90% cost reduction, 85% latency reduction on repeated dispatches).

---

## Deterministic Tools (Not LLM Agents)

### `mcp__manifest__sync_transcript`

Built into manifest trim/split/remove operations as a side effect. Every time a manifest operation changes timing:

1. Reads `transcript-original.json` (preserved at ingest)
2. Computes cumulative ripple shifts from current manifest state
3. Rewrites `transcript.json` with adjusted word timings
4. Filters out words that fall within removed segments

The agent never calls this — it fires automatically.

### `analyzeTranscript()` MCP Tool

Deterministic filler/silence/retake detection. Called by the orchestrator before dispatching the Trim Editor:

```typescript
interface TranscriptAnalysis {
  fillers: Array<{ wordIndex: number; text: string; startMs: number; endMs: number; tier: 1 | 2 }>;
  silences: Array<{ startMs: number; endMs: number; durationMs: number; tier: 1 | 3 }>;
  retakes: Array<{ segmentA: number; segmentB: number; overlapRatio: number }>;
  falseStarts: Array<{ segmentIndex: number; wordCount: number }>;
  contentType: 'tutorial' | 'podcast' | 'interview' | 'vlog' | 'presentation' | 'keynote';
}
```

### `mcp__manifest__validate_timeline` MCP Tool

Programmatic manifest validation for QC (zero tokens):

- No gaps/overlaps between items on same track
- All scene files referenced in manifest exist
- Caption timing aligns with video items
- `startFrom` values are valid
- Transition durations within 200-500ms
- `durationMs` matches last item extent

---

## Transcript Data Flow

```
Ingest:
  transcript.json ← raw from transcription service
  transcript-original.json ← exact copy, never modified

Phase 2 (Trim Editor):
  manifest ops (split/remove) → sync_transcript fires automatically
  transcript.json ← now reflects post-trim timeline

Phase 3 (Planner):
  reads transcript.json ← gets current/correct timings
  writes SCENE_PLAN.md with accurate timestamps

Phase 8 (Refinement — "trim more"):
  Trim Editor re-runs → manifest ops → sync_transcript fires again
  transcript.json ← updated again, all downstream agents see correct state
```

Single source of truth. Always current. No manual timestamp math.

---

## Professional Editing Techniques Added

### Trim Editor

| Technique | Description | Source |
|-----------|-------------|--------|
| **Radio cut methodology** | Edit audio-first, ignore visuals. Content and pacing before visual coverage. | Reference doc Phase 2 |
| **Jump cut coverage** | After trimming, add 3-8% zoom punch-ins at edit points to hide jump cuts | Reference doc Phase 2 |
| **J-cuts** | Incoming audio starts before incoming video — pulls viewer forward | Reference doc Phase 2 |
| **L-cuts** | Outgoing audio continues under new video — smooths B-roll transitions | Reference doc Phase 2 |
| **Pacing refinement** | Cut on energy peaks, vary cut length, leave intentional pauses | Reference doc Phase 2 |
| **Pacing oscillation** | Calm (10-20s) → Quick burst (5-10 cuts) → Calm → Burst | Reference doc Phase 5 |

### Planner

| Technique | Description |
|-----------|-------------|
| **Energy arc mapping** | Each scene mapped to energy 1-5, no two adjacent scenes at same level |
| **Pacing oscillation** | Plan alternates calm/burst sections explicitly |
| **Content-type speaker visibility** | Speaker visibility % driven by content type detection |

### QC Reviewer — Full Timeline Pass

| Check | Type |
|-------|------|
| No gaps/overlaps on same track | Programmatic (MCP tool) |
| Scene files exist | Programmatic |
| Caption-audio sync | Programmatic |
| Transition durations valid | Programmatic |
| Flash frames at scene boundaries | Visual (render 2-3 stills) |
| Speaker visible in stacked/overlay | Visual |
| Caption readability | Visual |
| Code review of scene .tsx files | LLM reads code |

---

## Agent Skill Injection

Skills are NOT loaded via the `Skill` tool (unreliable). They are injected programmatically via the SDK `skills` field on `AgentDefinition`:

| Agent | Skills Auto-Loaded |
|-------|--------------------|
| Trim Editor | `cutting-and-pacing`, `transcript-analysis`, `transitions` |
| Planner | `editorial-planning`, `visual-treatment-guide`, `narrative-structure`, `transcript-analysis` |
| Visual Editor | `cutting-and-pacing`, `transitions`, `lower-third-and-overlays`, `platform-optimization` |
| Animator | `remotion-best-practices`, `framer-motion`, `motion-one`, `video-engagement` |
| QC Reviewer | `remotion-best-practices`, `motion-one`, `framer-motion` |

### Orchestrator

Does NOT auto-load skills. It's a dispatcher, not a domain expert.

---

## Workspace CLAUDE.md

Stripped to file structure + import conventions only. Everything else moved to skills:

```markdown
## File Structure
src/
  scenes/         # Individual scene .tsx files (default export)
  components/     # Shared components (Background.tsx, etc.)
  constants.ts    # COLORS, TIMING, SPRING_CONFIG

## Import Pattern
import { COLORS, SPRING_CONFIG } from '../constants';
import { Background } from '../components/Background';

## Scene Export Convention
Scene files use `export default` for the component.
```

---

## orchestrator.ts Changes

```typescript
agents: {
  trim_editor: {
    description: 'Trims transcript (fillers, silences, retakes), covers jump cuts with zoom punch-ins, applies J/L-cuts for smooth audio transitions, refines pacing, generates captions.',
    prompt: assembledTrimEditorPrompt,
    tools: ['Read', 'Write', 'Glob', 'Grep', 'Bash',
            ...MANIFEST_TOOL_NAMES, ...RENDER_TOOL_NAMES, ...ASSET_TOOL_NAMES],
    model: 'opus',
    skills: ['cutting-and-pacing', 'transcript-analysis', 'transitions'],
  },

  planner: {
    description: 'Analyzes transcript, designs spatial layout with exact coordinates, assigns display modes, creates SCENE_PLAN.md with sync points and energy arc.',
    prompt: assembledPlannerPrompt,
    tools: ['Read', 'Write', 'Glob', 'Grep', 'WebSearch', 'WebFetch',
            ...MANIFEST_TOOL_NAMES, ...RENDER_TOOL_NAMES, ...ASSET_TOOL_NAMES],
    model: 'opus',
    skills: ['editorial-planning', 'visual-treatment-guide', 'narrative-structure', 'transcript-analysis'],
  },

  visual_editor: {
    description: 'Builds rough cut with zoom crops, B-roll, and mockup placeholders (Phase 4). Handles final assembly replacing mockups with scenes, transitions, caption styling (Phase 7).',
    prompt: assembledVisualEditorPrompt,
    tools: ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash',
            ...MANIFEST_TOOL_NAMES, ...SCENE_TOOL_NAMES, ...RENDER_TOOL_NAMES,
            ...ASSET_TOOL_NAMES, ...ICON_TOOL_NAMES, ...FREEPIK_TOOL_NAMES],
    model: 'opus',
    skills: ['cutting-and-pacing', 'transitions', 'lower-third-and-overlays', 'platform-optimization'],
  },

  animator: {
    description: 'Writes Remotion .tsx scene files. Receives per-scene prompt with dimensions, brief, sync points. Self-heals compilation errors.',
    prompt: perSceneAnimatorPrompt,  // from prompt-assembly.ts ONLY
    tools: ANIMATOR_TOOL_NAMES,
    model: 'opus',
    skills: ['remotion-best-practices', 'framer-motion', 'motion-one', 'video-engagement'],
  },

  qc_reviewer: {
    description: 'Reviews scene screenshots + code quality. After final assembly, runs full-timeline verification (gaps, sync, transitions). Returns pass/fail with actionable feedback.',
    prompt: assembledQCReviewerPrompt,
    tools: ['Read', 'Glob', 'Grep', ...RENDER_TOOL_NAMES, ...VIEWPORT_TOOL_NAMES],
    model: 'sonnet',
    skills: ['remotion-best-practices', 'motion-one', 'framer-motion'],
  },
}
```

---

## Prompt Size Budget

| Component | Current | Proposed |
|-----------|---------|----------|
| Orchestrator | 41.6 KB | ~12 KB |
| Planner | 45 KB (with shared) | ~8 KB (system + example + shared) |
| Editor (all phases) | 34.6 KB | — (replaced) |
| Trim Editor | — | ~6 KB (system + example + shared) |
| Visual Editor | — | ~6 KB (system + example + shared) |
| Animator | 64 KB + shared | ~3 KB per scene (assembly only) |
| Reviewer | 10 KB | ~6 KB (system + example + shared) |
| **Total loaded per run** | **~195 KB** | **~41 KB** |
| **Reduction** | | **-79%** |

---

## Migration Path

1. Create new prompt file structure (`shared/`, per-agent folders)
2. Build new `prompt-loader.ts` with assembly order (shared → system → examples → context → reminder)
3. Build deterministic tools (`sync_transcript`, `analyzeTranscript`, `validate_timeline`)
4. Write each agent's slim system prompt with XML structure
5. Write few-shot examples for each agent
6. Update `orchestrator.ts` with 5-agent config
7. Update orchestrator system prompt (slim version)
8. Strip workspace CLAUDE.md
9. Test end-to-end with a real video
