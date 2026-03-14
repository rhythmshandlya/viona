# Sandbox Orchestrator Migration — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the API-side Claude SDK agent + BullMQ worker visual pipeline with a sandbox-based orchestrator that runs all AI intelligence inside the container, supports heterogeneous edit types, and uses programmatic subagents.

**Architecture:** The sandbox `agent-server.ts` becomes the full Claude SDK orchestrator with Animator/Researcher/Trimmer subagents. The API `agent-router.ts` becomes a thin SSE relay that forwards prompts to the sandbox and persists conversation history. New skills in the sandbox template provide editorial planning, treatment selection, and editing craft knowledge.

**Tech Stack:** Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`), Fastify SSE (PassThrough streams), esbuild, Remotion, MinIO, Express (sandbox HTTP)

**Spec:** `docs/superpowers/specs/2026-03-14-sandbox-orchestrator-architecture-design.md`

---

## File Map

### New Files

| File | Responsibility |
|------|---------------|
| `packages/sandbox/src/orchestrator.ts` | SDK query config, subagent definitions, prompt builder, session management |
| `packages/sandbox/src/prompts/orchestrator-system.md` | Orchestrator system prompt (role, flow, tool usage, treatment guide) |
| `packages/sandbox/src/prompts/animator-system.md` | Animator subagent system prompt (migrated from worker prompts + shared modules) |
| `packages/sandbox/src/prompts/researcher-system.md` | Researcher subagent system prompt |
| `packages/sandbox/src/prompts/trimmer-system.md` | Trimmer subagent system prompt |
| `packages/sandbox/src/prompts/prompt-loader.ts` | Loads .md prompts, prepends shared modules, injects dynamic context |
| `packages/sandbox/template/.claude/skills/editorial-planning/` | Content type detection, section breakdown, edit plan format |
| `packages/sandbox/template/.claude/skills/visual-treatment-guide/` | Treatment selection decision tree |
| `packages/sandbox/template/.claude/skills/narrative-structure/` | Story arc detection, emotional pacing |
| `packages/sandbox/template/.claude/skills/transcript-analysis/` | Sync point ID, filler detection, beat mapping |
| `packages/sandbox/template/.claude/skills/cutting-and-pacing/` | Cut rules, retention rhythm |
| `packages/sandbox/template/.claude/skills/transitions/` | Transition types and when to use each |
| `packages/sandbox/template/.claude/skills/lower-third-and-overlays/` | Text overlay design, placement |
| `packages/sandbox/template/.claude/skills/screenshot-and-research/` | Web research, screenshot framing |

### Modified Files

| File | Change |
|------|--------|
| `packages/sandbox/src/agent-server.ts` | Stub → full orchestrator integration (calls orchestrator.ts) |
| `packages/sandbox/src/workspace-init.ts` | Copy shared prompt modules into workspace during init |
| `packages/sandbox/template/.claude/CLAUDE.md` | Update skill loading order for orchestrator + subagents |
| `packages/api/src/agent/agent-router.ts` | Full SDK orchestrator → thin SSE relay via `proxyPrompt()` |
| `packages/api/src/agent/agent-system-prompt.ts` | Full prompt builder → lightweight context builder for relay payload |
| `apps/web/src/features/editor-v2/hooks/use-job-websocket.ts` | Remove BullMQ job subscription, add sandbox event types |

### Preserved (No Changes)

| File | Why |
|------|-----|
| `packages/sandbox/src/tools/manifest-ops.ts` | Already complete, mutex-protected |
| `packages/sandbox/src/tools/scene-tools.ts` | Already complete |
| `packages/sandbox/src/tools/render-still.ts` | Already complete |
| `packages/sandbox/src/tools/trigger-rebuild.ts` | Already complete |
| `packages/sandbox/src/esbuild-watcher.ts` | Already complete |
| `packages/sandbox/src/asset-sync.ts` | Already complete |
| `packages/sandbox/src/file-server.ts` | Already complete |
| `packages/api/src/agent/conversation-store.ts` | Unchanged |
| `packages/api/src/sandbox/proxy.ts` | Already has `proxyPrompt()` pattern |
| `packages/worker/src/prompts/shared/` | Preserved, copied into subagent prompts |

### Removed (after migration complete)

| File | Why |
|------|-----|
| `packages/api/src/agent/agent-tools.ts` | Tools move to sandbox MCP servers |
| `packages/api/src/agent/agent-manifest-tools.ts` | Replaced by sandbox manifest-ops |
| `packages/worker/src/processors/plan-visuals.ts` | Planning moves to sandbox orchestrator |
| `packages/worker/src/processors/generate-visuals/` | Generation moves to sandbox subagents |

---

## Chunk 1: Sandbox Orchestrator Core

Build the orchestrator module that runs Claude SDK inside the sandbox, with subagent definitions and prompt loading. This is the heart of the migration.

### Task 1: Prompt Loader

**Files:**
- Create: `packages/sandbox/src/prompts/prompt-loader.ts`

- [ ] **Step 1: Create prompt loader with shared module prepending**

```typescript
// packages/sandbox/src/prompts/prompt-loader.ts
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// In production (sandbox container), .md files are at /app/dist/prompts/
// In dev, they're relative to the compiled source
const PROMPTS_DIR = process.env.NODE_ENV === 'production'
  ? '/app/dist/prompts'
  : join(__dirname);

// Shared modules are copied into /workspace/docs/shared/ during init
const WORKSPACE_SHARED = '/workspace/docs/shared';

const SHARED_MODULES = [
  'technical-rules.md',
  'motion-design-principles.md',
  'vocabulary.md',
  'quality-checklist.md',
];

async function loadFile(path: string): Promise<string> {
  return readFile(path, 'utf-8');
}

export async function loadSharedModules(): Promise<string> {
  const modules: string[] = [];
  for (const file of SHARED_MODULES) {
    try {
      const content = await loadFile(join(WORKSPACE_SHARED, file));
      modules.push(`## ${file.replace('.md', '').replace(/-/g, ' ').toUpperCase()}\n\n${content}`);
    } catch {
      // Shared module not found — skip (dev environment)
    }
  }
  return modules.join('\n\n---\n\n');
}

export async function loadPrompt(name: string): Promise<string> {
  return loadFile(join(PROMPTS_DIR, `${name}.md`));
}

export async function loadPromptWithShared(name: string): Promise<string> {
  const [shared, prompt] = await Promise.all([
    loadSharedModules(),
    loadPrompt(name),
  ]);
  return `${shared}\n\n---\n\n${prompt}`;
}

export interface PromptContext {
  canvasWidth: number;
  canvasHeight: number;
  fps: number;
  durationMs: number | null;
  hasTranscript: boolean;
  theme?: string;
  projectType?: string;
}

export function injectContext(prompt: string, ctx: PromptContext): string {
  return prompt
    .replace('{{CANVAS_WIDTH}}', String(ctx.canvasWidth))
    .replace('{{CANVAS_HEIGHT}}', String(ctx.canvasHeight))
    .replace('{{FPS}}', String(ctx.fps))
    .replace('{{DURATION_MS}}', String(ctx.durationMs ?? 'unknown'))
    .replace('{{THEME}}', ctx.theme ?? 'studio-dark')
    .replace('{{PROJECT_TYPE}}', ctx.projectType ?? 'video');
}
```

- [ ] **Step 2: Verify prompt loader compiles**

Run: `cd packages/sandbox && npx tsc --noEmit src/prompts/prompt-loader.ts`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/sandbox/src/prompts/prompt-loader.ts
git commit -m "feat(sandbox): add prompt loader with shared module prepending"
```

### Task 2: Orchestrator Module

**Files:**
- Create: `packages/sandbox/src/orchestrator.ts`

- [ ] **Step 1: Create orchestrator with SDK query config and subagent definitions**

```typescript
// packages/sandbox/src/orchestrator.ts
import { query, type ClaudeAgentOptions } from '@anthropic-ai/claude-agent-sdk';
import { loadPrompt, loadPromptWithShared, injectContext, type PromptContext } from './prompts/prompt-loader.js';
import { allManifestTools } from './tools/manifest-ops.js';
import { writeSceneFileTool, deleteSceneFileTool } from './tools/scene-tools.js';
import { renderStillTool } from './tools/render-still.js';
import { triggerRebuildTool } from './tools/trigger-rebuild.js';

export interface OrchestratorRequest {
  prompt: string;
  conversationHistory: Array<{ role: string; content: string }>;
  projectContext: PromptContext;
  sessionId?: string | null;
  widgetResponse?: { widgetId: string; value: unknown };
  editingContext?: { type: string; itemId?: string; sceneId?: number };
}

export interface OrchestratorCallbacks {
  onText: (text: string) => void;
  onWidget: (widget: Record<string, unknown>) => void;
  onProgress: (progress: { phase: string; percent: number; message: string }) => void;
  onDone: (result: { sessionId?: string; cost?: number }) => void;
  onError: (error: string) => void;
  signal?: AbortSignal;
}

// Tool names for MCP servers (registered by agent-server)
const MANIFEST_TOOL_NAMES = allManifestTools.map(t => `mcp__manifest__${t.name}`);
const SCENE_TOOL_NAMES = ['mcp__scenes__write_scene_file', 'mcp__scenes__delete_scene_file'];
const RENDER_TOOL_NAMES = ['mcp__render__render_still', 'mcp__render__trigger_rebuild'];

export async function buildOrchestratorOptions(
  ctx: PromptContext
): Promise<Partial<ClaudeAgentOptions>> {
  // Load prompts
  const [orchestratorPrompt, animatorPrompt, researcherPrompt, trimmerPrompt] = await Promise.all([
    loadPrompt('orchestrator-system'),
    loadPromptWithShared('animator-system'),
    loadPrompt('researcher-system'),
    loadPrompt('trimmer-system'),
  ]);

  const systemPrompt = injectContext(orchestratorPrompt, ctx);

  return {
    model: 'opus',
    systemPrompt,
    allowedTools: [
      'Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash',
      'WebSearch', 'WebFetch', 'Agent', 'Skill',
      ...MANIFEST_TOOL_NAMES,
      ...SCENE_TOOL_NAMES,
      ...RENDER_TOOL_NAMES,
    ],
    permissionMode: 'bypassPermissions',
    settingSources: ['project'],
    agents: {
      animator: {
        description: 'Writes Remotion .tsx scene files for animation sections. Dispatch with the section details from the edit plan, manifest context, and style info.',
        prompt: injectContext(animatorPrompt, ctx),
        tools: [
          'Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash', 'Skill',
          ...MANIFEST_TOOL_NAMES,
          ...SCENE_TOOL_NAMES,
          ...RENDER_TOOL_NAMES,
        ],
        model: 'opus',
      },
      researcher: {
        description: 'Finds web content, captures screenshots, downloads stock images. Dispatch with the section details and target dimensions.',
        prompt: injectContext(researcherPrompt, ctx),
        tools: [
          'Read', 'Write', 'Bash', 'WebSearch', 'WebFetch',
          ...MANIFEST_TOOL_NAMES,
        ],
        model: 'sonnet',
      },
      trimmer: {
        description: 'Detects silence, filler words, and dead air. Analyzes transcript timestamps and audio. Dispatch with transcript path and audio file path.',
        prompt: injectContext(trimmerPrompt, ctx),
        tools: [
          'Read', 'Write', 'Bash', 'Grep',
          ...MANIFEST_TOOL_NAMES,
        ],
        model: 'sonnet',
      },
    },
    maxTurns: 100,
    maxBudgetUsd: 5.0,
    includePartialMessages: true,
  };
}

export async function runOrchestrator(
  request: OrchestratorRequest,
  callbacks: OrchestratorCallbacks
): Promise<void> {
  const options = await buildOrchestratorOptions(request.projectContext);

  // Build the user message with conversation history context
  let userMessage = request.prompt;

  // Inject widget response as user message text
  if (request.widgetResponse) {
    const { widgetId, value } = request.widgetResponse;
    userMessage = `[User responded to widget "${widgetId}": ${JSON.stringify(value)}]\n\n${userMessage}`.trim();
  }

  // Inject editing context
  if (request.editingContext) {
    userMessage = `[Editing context: ${JSON.stringify(request.editingContext)}]\n\n${userMessage}`.trim();
  }

  if (request.conversationHistory.length > 0) {
    const historyText = request.conversationHistory
      .map(m => `${m.role}: ${m.content}`)
      .join('\n\n');
    userMessage = `<conversation_history>\n${historyText}\n</conversation_history>\n\n${userMessage}`;
  }

  try {
    // Attempt resume if sessionId provided
    const queryOptions: Record<string, unknown> = {
      ...options,
      prompt: userMessage,
    };

    if (request.sessionId) {
      queryOptions.resume = request.sessionId;
    }

    const stream = query(queryOptions as ClaudeAgentOptions);

    for await (const event of stream) {
      if (callbacks.signal?.aborted) {
        break;
      }

      // Route SDK events to callbacks
      if (event.type === 'assistant_message' || event.type === 'partial_message') {
        const text = extractText(event);
        if (text) {
          callbacks.onText(text);
        }
      } else if (event.type === 'done') {
        callbacks.onDone({
          sessionId: event.sessionId,
          cost: event.cost?.totalUsd,
        });
        return;
      } else if (event.type === 'error') {
        callbacks.onError(event.error?.message ?? 'Unknown orchestrator error');
        return;
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // If resume failed, retry without resume
    if (request.sessionId && message.includes('session')) {
      callbacks.onText(''); // Signal reset
      return runOrchestrator(
        { ...request, sessionId: null },
        callbacks
      );
    }

    callbacks.onError(message);
  }
}

function extractText(event: Record<string, unknown>): string | null {
  // Extract text content from SDK message events
  // Actual shape depends on SDK version — adapt as needed
  const message = event.message as Record<string, unknown> | undefined;
  if (!message) return null;
  const content = message.content as Array<Record<string, unknown>> | undefined;
  if (!content) return null;
  const textBlocks = content.filter(b => b.type === 'text');
  return textBlocks.map(b => b.text as string).join('') || null;
}
```

Note: The exact SDK event types will need adaptation based on the `@anthropic-ai/claude-agent-sdk` API. The Agent SDK's `query()` function returns an async iterable of events. Check the SDK source at `node_modules/@anthropic-ai/claude-agent-sdk` for exact event shapes before implementing.

- [ ] **Step 2: Verify orchestrator compiles**

Run: `cd packages/sandbox && npx tsc --noEmit src/orchestrator.ts`
Expected: May have type issues with SDK — fix based on actual SDK types

- [ ] **Step 3: Commit**

```bash
git add packages/sandbox/src/orchestrator.ts
git commit -m "feat(sandbox): add orchestrator module with subagent definitions"
```

### Task 3: Integrate Orchestrator into Agent Server

**Files:**
- Modify: `packages/sandbox/src/agent-server.ts`

- [ ] **Step 1: Read current agent-server.ts**

Read the full file to understand the existing stub structure, the prompt queue, and the SSE response pattern.

- [ ] **Step 2: Replace the `processNext()` stub with orchestrator integration**

The current `processNext()` function at ~line 37 has a TODO comment. Replace it with:

```typescript
// Inside processNext() — replace the TODO block

import { runOrchestrator, type OrchestratorRequest } from './orchestrator.js';

// In the processNext function, where it processes a queued prompt:
async function handlePrompt(
  expressReq: express.Request,
  res: express.Response
): Promise<void> {
  const body = expressReq.body as OrchestratorRequest;

  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  let eventId = 0;
  const sendSSE = (event: string, data: unknown) => {
    eventId++;
    res.write(`id: ${eventId}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // Heartbeat to keep connection alive
  const heartbeat = setInterval(() => sendSSE('heartbeat', {}), 15000);

  // Wire cancellation to connection close
  const abortController = new AbortController();
  currentAbortController = abortController;
  expressReq.on('close', () => abortController.abort());

  try {
    await runOrchestrator(
      body,
      {
        onText: (text) => sendSSE('text', { text }),
        onWidget: (widget) => sendSSE('widget', widget),
        onProgress: (progress) => sendSSE('progress', progress),
        onDone: (result) => sendSSE('done', result),
        onError: (error) => sendSSE('error', { message: error }),
        signal: abortController.signal,
      }
    );
  } catch (err) {
    sendSSE('error', { message: err instanceof Error ? err.message : 'Internal error' });
  } finally {
    clearInterval(heartbeat);
    res.end();
  }
}
```

Key changes:
- The existing queue system (`processNext()`) stays — it ensures sequential prompt processing
- The `POST /prompt` handler passes the request body to `handlePrompt()` which calls `runOrchestrator()`
- SSE events are emitted in the same format the API expects to relay
- AbortController wired to request close for cancellation support

- [ ] **Step 3: Add cancel endpoint**

Add `POST /cancel` route to agent-server.ts:

```typescript
app.post('/cancel', authMiddleware, (_req, res) => {
  // Abort current orchestration
  if (currentAbortController) {
    currentAbortController.abort();
  }
  res.json({ ok: true });
});
```

Store `currentAbortController` at module level, set it in `handlePrompt()`, clear on completion.

- [ ] **Step 4: Verify agent-server compiles**

Run: `cd packages/sandbox && npx tsc --noEmit`
Expected: Clean compilation

- [ ] **Step 5: Commit**

```bash
git add packages/sandbox/src/agent-server.ts
git commit -m "feat(sandbox): integrate orchestrator into agent server with SSE streaming"
```

### Task 4: Copy Shared Prompt Modules During Init

**Files:**
- Modify: `packages/sandbox/src/workspace-init.ts`

- [ ] **Step 1: Read current workspace-init.ts**

Read to find the right location to add shared module copying.

- [ ] **Step 2: Add shared module copy step after template copy**

After the existing `copyDirRecursive()` call that copies `/app/template/` → `/workspace/`, add:

```typescript
// Copy shared prompt modules into workspace for orchestrator access
const sharedSrc = join('/app', 'prompts', 'shared');
const sharedDst = join(WORKSPACE_DIR, 'docs', 'shared');
await mkdir(sharedDst, { recursive: true });
for (const file of ['technical-rules.md', 'motion-design-principles.md', 'vocabulary.md', 'quality-checklist.md']) {
  try {
    await copyFile(join(sharedSrc, file), join(sharedDst, file));
  } catch {
    logger.warn(`Shared module ${file} not found — skipping`);
  }
}
```

This requires the shared prompt .md files to be copied into the Docker image at build time. We also need to update the Dockerfile.

- [ ] **Step 3: Commit**

```bash
git add packages/sandbox/src/workspace-init.ts
git commit -m "feat(sandbox): copy shared prompt modules into workspace during init"
```

---

## Chunk 2: Orchestrator & Subagent Prompts

Write the system prompts for the orchestrator and each subagent, migrating battle-tested content from the worker prompts.

### Task 5: Orchestrator System Prompt

**Files:**
- Create: `packages/sandbox/src/prompts/orchestrator-system.md`

- [ ] **Step 1: Write the orchestrator system prompt**

This prompt establishes the Creative Director persona and the full Lovable-style flow. Source content from:
- `packages/api/src/agent/agent-system-prompt.ts` — personality, widget usage, flow rules
- `packages/worker/src/prompts/director/system.md` — transcript analysis, scene constraints, visual decomposition
- New content for treatment selection, edit plan format, subagent dispatch rules

The prompt must cover:
1. **Role** — Creative editor and director
2. **Personality** — Sharp, opinionated, concise (from current API agent)
3. **Flow phases** — Understanding (chat) → Planning → Execution → Refinement
4. **Content type detection** — Transcript pattern → content type mapping
5. **Treatment selection** — Decision tree for animation vs screenshot vs B-roll vs text vs speaker-only
6. **Edit plan format** — The markdown format from the spec (Section 3)
7. **Subagent dispatch rules** — When to dispatch Animator/Researcher/Trimmer, what context to provide
8. **Manifest tool usage** — How to use manifest MCP tools for direct edits
9. **Widget usage** — show_widget for theme/layout/plan approval
10. **Quality standards** — Sync point cadence, pacing variety, visual rhythm
11. **Canvas/timing context** — Template variables `{{CANVAS_WIDTH}}`, `{{FPS}}`, etc.

- [ ] **Step 2: Verify prompt is well-formed markdown**

Read the file back and check for formatting issues, unclosed code blocks, etc.

- [ ] **Step 3: Commit**

```bash
git add packages/sandbox/src/prompts/orchestrator-system.md
git commit -m "feat(sandbox): add orchestrator system prompt with full creative director flow"
```

### Task 6: Animator Subagent System Prompt

**Files:**
- Create: `packages/sandbox/src/prompts/animator-system.md`

- [ ] **Step 1: Write the animator system prompt**

Migrate from `packages/worker/src/prompts/animator/system.md`. This is the largest prompt.

Key sections to migrate (preserve exact wording for battle-tested content):
1. **Role** — Motion graphics engineer
2. **Workflow** — Read plan → create TODO → setup → per-scene implementation → verify
3. **constants.ts template** — COLORS, SPRING_CONFIG, SPRINGS presets (SNAPPY, SMOOTH, BOUNCY, HEAVY, STIFF, GENTLE, OVERLAY), DURATION/STAGGER tokens — **COPY VERBATIM**
4. **Scene component template** — Frame timing, spring setup, layout structure
5. **Display mode rules** — Merge overlay-rules.md and fullscreen-rules.md inline
6. **Verification** — Scene-verify, composition-verify content
7. **Fix template** — From fix-template.md

Key changes from old prompt:
- No `assistant-director.py` context — subagent is self-contained
- Receives section details via Agent tool prompt, not via job metadata
- Uses manifest MCP tools directly (not Python workspace module)
- Uses `mcp__scenes__write_scene_file` (not direct file writes)
- `mcp__render__render_still` for visual verification
- Reads skills from `/workspace/.claude/skills/` (framer-motion, motion-one, video-engagement)

Shared modules (technical-rules, motion-design, vocabulary, quality-checklist) are prepended automatically by the prompt loader.

- [ ] **Step 2: Commit**

```bash
git add packages/sandbox/src/prompts/animator-system.md
git commit -m "feat(sandbox): add animator subagent system prompt migrated from worker"
```

### Task 7: Researcher Subagent System Prompt

**Files:**
- Create: `packages/sandbox/src/prompts/researcher-system.md`

- [ ] **Step 1: Write the researcher system prompt**

New prompt — no direct migration source. Cover:
1. **Role** — Web researcher and content capturer
2. **Workflow** — Receive section from edit plan → search web → capture screenshot → save asset → update manifest
3. **Screenshot capture** — Use Chromium via Bash: `chromium --headless --screenshot=/workspace/public/research/{name}.png --window-size=1920,1080 {url}`
4. **Browser mockup** — How to frame screenshots in browser chrome (or skip if not needed)
5. **Asset management** — Save to `/workspace/public/research/`, add to manifest as image item
6. **Research documentation** — Write findings to `/workspace/docs/research.md`
7. **Error handling** — Graceful degradation if screenshot fails (fallback to text card description)
8. **Stock image search** — Pexels/Unsplash via WebSearch, download via Bash curl

- [ ] **Step 2: Commit**

```bash
git add packages/sandbox/src/prompts/researcher-system.md
git commit -m "feat(sandbox): add researcher subagent system prompt"
```

### Task 8: Trimmer Subagent System Prompt

**Files:**
- Create: `packages/sandbox/src/prompts/trimmer-system.md`

- [ ] **Step 1: Write the trimmer system prompt**

New prompt — no direct migration source. Cover:
1. **Role** — Audio/video trimmer and silence detector
2. **Workflow** — Analyze transcript timestamps → detect gaps → ffmpeg silence detection → write trim plan → apply to manifest
3. **Silence detection** — ffmpeg silencedetect: `ffmpeg -i /workspace/public/audio.mp3 -af silencedetect=noise=-30dB:d=0.5 -f null -`
4. **Filler word detection** — Scan transcript for "um", "uh", "like", "you know", "basically", "actually" with timestamps
5. **Trim plan format** — Write `/workspace/docs/trim-plan.md` with detected cuts, timestamps, durations, recommended actions
6. **Manifest operations** — Use `split_video` to split items at cut points, `remove_item` for gaps, `update_item` to adjust timing
7. **Timeline adjustment** — After cuts, update edit-plan.md section timings to reflect new timeline
8. **Safety** — Never trim speech content, preserve 0.1s padding around cuts

- [ ] **Step 2: Commit**

```bash
git add packages/sandbox/src/prompts/trimmer-system.md
git commit -m "feat(sandbox): add trimmer subagent system prompt"
```

---

## Chunk 3: New Skills for Sandbox Template

Create the editorial planning and editing craft skills that the orchestrator reads before planning.

### Task 9: Editorial Planning Skill

**Files:**
- Create: `packages/sandbox/template/.claude/skills/editorial-planning/SKILL.md`

- [ ] **Step 1: Write the editorial planning skill**

Cover:
1. Content type detection rules (transcript patterns → type — from spec Section 2)
2. Section breakdown methodology (identify narrative beats, topic shifts, emotional arcs)
3. Edit plan format specification (the markdown format from spec Section 3)
4. Section timing guidelines (min 5s, max 30s typical, variety in pacing)
5. Treatment assignment heuristics (which treatment for which content pattern)
6. Plan iteration (how to update plan based on user feedback)

- [ ] **Step 2: Commit**

```bash
git add packages/sandbox/template/.claude/skills/editorial-planning/
git commit -m "feat(sandbox): add editorial-planning skill"
```

### Task 10: Visual Treatment Guide Skill

**Files:**
- Create: `packages/sandbox/template/.claude/skills/visual-treatment-guide/SKILL.md`

- [ ] **Step 1: Write the visual treatment guide skill**

Decision tree for treatment selection:
- Animation: abstract concepts, data visualization, comparisons, kinetic typography
- Screenshot: articles, tweets, web references, product pages
- Stock video: B-roll establishing shots, environmental context, transitions
- Text overlay: titles, lower thirds, callouts, stat displays
- Speaker only: personal opinion, credibility moments, emotional delivery
- Trim: silence, filler, dead air detection

Include examples for each treatment type and when to combine them.

- [ ] **Step 2: Commit**

```bash
git add packages/sandbox/template/.claude/skills/visual-treatment-guide/
git commit -m "feat(sandbox): add visual-treatment-guide skill"
```

### Task 11: Narrative Structure Skill

**Files:**
- Create: `packages/sandbox/template/.claude/skills/narrative-structure/SKILL.md`

- [ ] **Step 1: Write the narrative structure skill**

Cover:
- Story arc detection (hook → tension → insight → payoff → close)
- Beat identification from transcript (topic shifts, emphasis, pauses)
- Emotional pacing (high energy → breather → buildup patterns)
- Section boundary detection (linguistic markers: "now", "but here's the thing", "so what does this mean")
- Continuity planning (visual elements that bridge sections)

- [ ] **Step 2: Commit**

```bash
git add packages/sandbox/template/.claude/skills/narrative-structure/
git commit -m "feat(sandbox): add narrative-structure skill"
```

### Task 12: Transcript Analysis Skill

**Files:**
- Create: `packages/sandbox/template/.claude/skills/transcript-analysis/SKILL.md`

- [ ] **Step 1: Write the transcript analysis skill**

Cover:
- Sync point identification methodology (key moments for visual emphasis)
- Word-level timestamp analysis patterns
- Filler word detection patterns
- Topic shift detection (semantic breaks in content)
- Speaking rate analysis (words per minute, intensity mapping)
- Quote/citation detection (for screenshot treatment signals)

- [ ] **Step 2: Commit**

```bash
git add packages/sandbox/template/.claude/skills/transcript-analysis/
git commit -m "feat(sandbox): add transcript-analysis skill"
```

### Task 13: Cutting, Pacing, Transitions, Lower-Third, and Research Skills

**Files:**
- Create: `packages/sandbox/template/.claude/skills/cutting-and-pacing/SKILL.md`
- Create: `packages/sandbox/template/.claude/skills/transitions/SKILL.md`
- Create: `packages/sandbox/template/.claude/skills/lower-third-and-overlays/SKILL.md`
- Create: `packages/sandbox/template/.claude/skills/screenshot-and-research/SKILL.md`

- [ ] **Step 1: Write cutting-and-pacing skill**

Dmytryk's 7 rules of cutting, J/L cut patterns, retention rhythm (visual change every 15-25s), when to hold vs cut, pacing for different content types.

- [ ] **Step 2: Write transitions skill**

Cut types (hard cut, jump cut, match cut), dissolves, wipes, slide transitions. When to use each — cuts for pace, dissolves for time passage, match cuts for continuity.

- [ ] **Step 3: Write lower-third-and-overlays skill**

Text overlay design principles, safe zones, typography hierarchy, animation timing for text entry/exit, lower third patterns (name, title, stat, quote).

- [ ] **Step 4: Write screenshot-and-research skill**

Web research methodology, search query formulation, screenshot framing (browser mockup, zoom to headline), image source attribution, fallback strategies.

- [ ] **Step 5: Commit all four skills**

```bash
git add packages/sandbox/template/.claude/skills/cutting-and-pacing/ \
  packages/sandbox/template/.claude/skills/transitions/ \
  packages/sandbox/template/.claude/skills/lower-third-and-overlays/ \
  packages/sandbox/template/.claude/skills/screenshot-and-research/
git commit -m "feat(sandbox): add editing craft skills (cutting, transitions, overlays, research)"
```

### Task 13b: Sound Design and Platform Optimization Skills (Deferred)

**Files:**
- Create: `packages/sandbox/template/.claude/skills/sound-design/SKILL.md`
- Create: `packages/sandbox/template/.claude/skills/platform-optimization/SKILL.md`

> **Note:** These skills are in the spec (Section 6) but are lower priority. Sound design covers audio decisions that are mostly future work. Platform optimization covers export specs that don't affect the core orchestrator flow. Implement these after the core migration is working.

- [ ] **Step 1: Write sound-design skill**

Sound hierarchy, music selection guidance, SFX timing, volume ducking rules, fade in/out patterns.

- [ ] **Step 2: Write platform-optimization skill**

YouTube/TikTok/Reels export specs, aspect ratios, hook optimization, platform-specific text safe zones.

- [ ] **Step 3: Commit**

```bash
git add packages/sandbox/template/.claude/skills/sound-design/ \
  packages/sandbox/template/.claude/skills/platform-optimization/
git commit -m "feat(sandbox): add sound-design and platform-optimization skills"
```

### Task 14: Update CLAUDE.md Skill Loading Order

**Files:**
- Modify: `packages/sandbox/template/.claude/CLAUDE.md`

- [ ] **Step 1: Read current CLAUDE.md**

Read `packages/sandbox/template/.claude/CLAUDE.md` to understand current directives.

- [ ] **Step 2: Add orchestrator skill loading order**

Add section at the top of CLAUDE.md:

```markdown
## Skill Loading Order

### When planning (orchestrator mode):
1. FIRST: editorial-planning (content type detection, edit plan format)
2. SECOND: visual-treatment-guide (treatment selection decision tree)
3. THIRD: narrative-structure (story arc, emotional pacing)
4. FOURTH: transcript-analysis (sync points, filler detection)

### When editing code (animator mode):
1. FIRST: framer-motion (technique components)
2. SECOND: motion-one (spring configs, timing)
3. THIRD: video-engagement (hooks, retention, visual metaphors)
4. REFERENCE: remotion-best-practices, graphic-designer, interaction-design

### When researching (researcher mode):
1. FIRST: screenshot-and-research (web research, screenshot framing)

### When cutting (trimmer mode):
1. FIRST: cutting-and-pacing (cut rules, retention rhythm)
```

Preserve all existing content below.

- [ ] **Step 3: Commit**

```bash
git add packages/sandbox/template/.claude/CLAUDE.md
git commit -m "feat(sandbox): update CLAUDE.md with orchestrator skill loading order"
```

---

## Chunk 4: API Thin Relay Conversion

Convert the API agent router from a full Claude SDK orchestrator to a thin SSE relay.

### Task 15: Simplify Agent Router to Thin Relay

**Files:**
- Modify: `packages/api/src/agent/agent-router.ts`

- [ ] **Step 1: Read current agent-router.ts**

Read the full 683-line file to understand all routes and their current implementation.

- [ ] **Step 2: Simplify the POST /chat route**

Replace the Claude SDK `query()` call and MCP server setup with a call to `proxyPrompt()`. The route becomes:

1. Auth + rate limit check (keep)
2. Save user message to DB (keep)
3. Create empty assistant message row (keep)
4. Load conversation history from DB (keep)
5. Build project context (keep — simplified from agent-system-prompt.ts)
6. Call `proxyPrompt()` with prompt + history + context + sessionId (NEW — replaces SDK query)
7. Relay SSE events back to browser (keep SSE writer, change event source)
8. On each `text` event: update assistant message in DB (keep 2s debounce)
9. On `done` event: save sessionId to conversation DB (keep)

Remove:
- `createAgentMcpServer()` import and usage
- `buildSystemPrompt()` import (replace with lightweight context builder)
- Direct `query()` call
- `processStream()` async iterator (replace with SSE relay from proxy)
- `buildQueryOptions()` (no longer needed — sandbox builds its own)

Keep:
- `createSSEWriter()` (reuse for browser SSE)
- `formatConversationHistory()` (send to sandbox)
- Concurrent SSE limit logic
- Event buffering for Last-Event-ID
- Rate limiting
- DB operations

- [ ] **Step 3: Simplify the relay logic**

The existing `proxyPrompt()` in `packages/api/src/sandbox/proxy.ts` already handles the SSE relay pattern: it POSTs to the sandbox, creates a PassThrough stream, and pipes the response through to the Fastify reply. It does NOT return a readable stream — it writes to the reply directly.

The new chat handler uses a **two-stream pattern**:
1. `proxyPrompt()` pipes sandbox SSE → browser (unchanged)
2. A tee/interceptor captures events for DB persistence

```typescript
// Simplified POST /chat handler
const sandbox = await getSandboxForProject(projectId);

// Build the body to forward to sandbox
const proxyBody = {
  prompt: message,
  conversationHistory: formattedHistory,
  projectContext: buildProjectContext(project),
  sessionId: conversation.sdkSessionId,
  widgetResponse: body.widgetResponse,
  editingContext: body.editingContext,
};

// Use the existing proxyPrompt pattern — it writes SSE to reply via PassThrough.
// Add an onEvent interceptor for DB persistence:
await proxyPromptWithIntercept(sandbox.agentUrl, sandbox.secret, proxyBody, reply, {
  onText: (text) => debouncedFlush(assistantMessageId, text),
  onDone: async (data) => {
    await updateConversationSessionId(conversation.id, data.sessionId);
    await updateMessageContent(assistantMessageId, accumulatedContent);
  },
});
```

Create `proxyPromptWithIntercept()` in proxy.ts as a wrapper around `proxyPrompt()` that intercepts SSE events as they flow through the PassThrough stream. This is done by reading the stream chunks, parsing SSE events, calling the interceptor callbacks, and then forwarding to the reply. See Task 21 for implementation details.

- [ ] **Step 4: Add cancel relay route**

Add or update `POST /projects/:id/agent/cancel`:

```typescript
// Forward cancel to sandbox
const sandbox = await getSandboxForProject(projectId);
if (sandbox) {
  await fetch(`http://${sandbox.host}:8081/cancel`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${sandbox.secret}` },
  });
}
```

- [ ] **Step 5: Verify router compiles**

Run: `cd packages/api && npx tsc --noEmit`
Expected: Clean compilation (agent-tools.ts may show unused warnings — that's fine, removed in Task 17)

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/agent/agent-router.ts
git commit -m "feat(api): convert agent router to thin SSE relay to sandbox"
```

### Task 16: Simplify System Prompt Builder

**Files:**
- Modify: `packages/api/src/agent/agent-system-prompt.ts`

- [ ] **Step 1: Read current agent-system-prompt.ts**

Read the full 199-line file.

- [ ] **Step 2: Replace with lightweight context builder**

The API no longer builds the full system prompt — it just packages project context for the sandbox:

```typescript
// packages/api/src/agent/agent-system-prompt.ts
export interface ProjectContext {
  projectId: string;
  canvasWidth: number;
  canvasHeight: number;
  fps: number;
  durationMs: number | null;
  hasTranscript: boolean;
  theme?: string;
  projectType?: string;
}

export function buildProjectContext(project: Record<string, unknown>): ProjectContext {
  return {
    projectId: project.id as string,
    canvasWidth: (project.canvasWidth as number) || 1920,
    canvasHeight: (project.canvasHeight as number) || 1080,
    fps: (project.fps as number) || 30,
    durationMs: (project.durationMs as number) || null,
    hasTranscript: !!(project.transcriptId),
    theme: (project.theme as string) || 'studio-dark',
    projectType: (project.projectType as string) || 'video',
  };
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/agent/agent-system-prompt.ts
git commit -m "refactor(api): simplify system prompt builder to project context builder"
```

### Task 17: Remove Old Agent Tools

**Files:**
- Remove: `packages/api/src/agent/agent-tools.ts`
- Remove: `packages/api/src/agent/agent-manifest-tools.ts`

- [ ] **Step 1: Verify no remaining imports**

Search for imports of `agent-tools` and `agent-manifest-tools` across the codebase:

Run: `grep -r "agent-tools\|agent-manifest-tools" packages/api/src/ --include="*.ts" -l`

Expected: Only the files themselves (after Task 15, agent-router.ts should no longer import them)

- [ ] **Step 2: Delete the files**

```bash
git rm packages/api/src/agent/agent-tools.ts packages/api/src/agent/agent-manifest-tools.ts
```

- [ ] **Step 3: Commit**

```bash
git commit -m "refactor(api): remove old agent tools (moved to sandbox)"
```

---

## Chunk 5: Frontend Updates

Minimal frontend changes — update WebSocket event handling and progress phase names.

### Task 18: Update WebSocket Event Handling

**Files:**
- Modify: `apps/web/src/features/editor-v2/hooks/use-job-websocket.ts`

- [ ] **Step 1: Read current use-job-websocket.ts**

Read the full file to understand current event types and subscription pattern.

- [ ] **Step 2: Add sandbox event type handling**

The WebSocket already receives sandbox callbacks via Redis pub/sub. Ensure these event types are handled:

```typescript
// In the message handler switch/if block:
case 'bundle-ready':
  // Increment bundle version to trigger player reload
  onBundleReady?.(data.version);
  break;
case 'manifest-updated':
  // Trigger manifest refresh
  onManifestUpdated?.();
  break;
```

If these are already handled (they may be — the sandbox callbacks already exist), verify and adjust.

Check if `job:progress`, `job:complete`, `job:error` events are still needed. If the entire pipeline now runs through sandbox SSE (no more BullMQ jobs), these can be removed or kept as fallback.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/editor-v2/hooks/use-job-websocket.ts
git commit -m "feat(web): update WebSocket handler for sandbox orchestrator events"
```

### Task 19: Verify End-to-End SSE Flow (Manual Test)

- [ ] **Step 1: Start the dev environment**

```bash
pnpm dev
```

- [ ] **Step 2: Open a project in the editor**

Navigate to a project with an uploaded video. Verify sandbox boots.

- [ ] **Step 3: Send a chat message**

Type a message in the AI assistant panel. Verify:
- Message appears in chat
- SSE stream connects (check network tab)
- Text events stream back and render
- Done event received

- [ ] **Step 4: Test plan creation flow**

Ask the orchestrator to create an edit plan. Verify:
- Plan widget appears
- Can approve/reject
- On approval, execution begins
- Bundle-ready events trigger player reload
- Manifest-updated events refresh preview

- [ ] **Step 5: Test cancellation**

Click "Stop" during execution. Verify:
- Stream terminates cleanly
- Partial work preserved in preview
- Can send new message after cancellation

---

## Chunk 6: Docker & Cleanup

### Task 20: Update Sandbox Dockerfile

**Files:**
- Modify: `packages/sandbox/Dockerfile`

- [ ] **Step 1: Read current Dockerfile**

Read to understand the multi-stage build.

- [ ] **Step 2: Add shared prompt modules to Docker image**

In the builder stage, after copying source:

```dockerfile
# Copy shared prompt modules from worker
COPY packages/worker/src/prompts/shared/ /app/prompts/shared/
```

In the production stage, copy them:

```dockerfile
COPY --from=builder /app/prompts/shared/ /app/prompts/shared/
```

Also copy the new prompt .md files:

```dockerfile
COPY --from=builder /app/packages/sandbox/dist/prompts/ /app/dist/prompts/
```

- [ ] **Step 3: Ensure web access for Researcher subagent**

Verify the container doesn't block outbound HTTP (it shouldn't — Railway containers have internet by default). No Dockerfile change needed unless there's a firewall config.

- [ ] **Step 4: Commit**

```bash
git add packages/sandbox/Dockerfile
git commit -m "build(sandbox): include shared prompt modules and prompts in Docker image"
```

### Task 21: Update Sandbox proxy.ts for New Payload & Intercept Pattern

**Files:**
- Modify: `packages/api/src/sandbox/proxy.ts`

- [ ] **Step 1: Read current proxy.ts**

Read the full file. The existing `proxyPrompt()` takes `(agentUrl, secret, body, reply)` and writes SSE directly to the Fastify reply via a PassThrough stream. It does NOT return a stream.

- [ ] **Step 2: Create `proxyPromptWithIntercept()` wrapper**

Add a new function that extends the existing `proxyPrompt()` pattern with event interception for DB persistence:

```typescript
interface InterceptCallbacks {
  onText?: (text: string) => void;
  onDone?: (data: { sessionId?: string; cost?: number }) => Promise<void>;
  onWidget?: (widget: Record<string, unknown>) => void;
  onError?: (error: string) => void;
}

export async function proxyPromptWithIntercept(
  agentUrl: string,
  secret: string,
  body: {
    prompt: string;
    conversationHistory: Array<{ role: string; content: string }>;
    projectContext: Record<string, unknown>;
    sessionId?: string | null;
    widgetResponse?: { widgetId: string; value: unknown };
    editingContext?: { type: string; itemId?: string; sceneId?: number };
  },
  reply: FastifyReply,
  callbacks: InterceptCallbacks
): Promise<void> {
  // Same as proxyPrompt — POST to sandbox:8081/prompt
  // Create PassThrough stream, pipe to reply
  // BUT also parse SSE chunks as they flow through:
  //   - On "text" event: call callbacks.onText(data.text)
  //   - On "done" event: call callbacks.onDone(data)
  //   - On "widget" event: call callbacks.onWidget(data)
  //   - On "error" event: call callbacks.onError(data.message)
  // The SSE data still flows to the browser unchanged
}
```

The implementation reads each chunk from the sandbox response, scans for SSE event boundaries (`\n\n`), parses `event:` and `data:` fields, calls the appropriate callback, and then writes the raw chunk to the PassThrough (which flows to the browser). This preserves the existing pattern while adding DB persistence hooks.

- [ ] **Step 3: Add cancel proxy function**

```typescript
export async function proxyCancelAgent(agentUrl: string, secret: string): Promise<void> {
  await fetch(`${agentUrl}/cancel`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
  });
}
```

- [ ] **Step 4: Verify proxy compiles**

Run: `cd packages/api && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/sandbox/proxy.ts
git commit -m "feat(api): add proxyPromptWithIntercept for SSE relay with DB persistence"
```

### Task 22: Verify Claude Agent SDK Dependency

**Files:**
- Verify: `packages/sandbox/package.json`

- [ ] **Step 1: Check SDK is in dependencies**

Run: `grep "claude-agent-sdk" packages/sandbox/package.json`
Expected: `"@anthropic-ai/claude-agent-sdk": "0.1.0"` (already present per package.json research)

If missing, add it:
```bash
cd packages/sandbox && pnpm add @anthropic-ai/claude-agent-sdk
```

- [ ] **Step 2: Verify SDK types available**

Run: `cd packages/sandbox && npx tsc --noEmit`
Expected: No errors related to SDK imports

---

## Dependency Graph

```
Task 22 (verify SDK dep) — prerequisite for all sandbox code

Task 1 (prompt-loader) — no deps
  → Task 2 (orchestrator module) — depends on Task 1
    → Task 3 (agent-server integration) — depends on Task 2

Task 4 (workspace-init) — independent, needed at runtime
Task 5-8 (prompts) — independent, needed at runtime by Tasks 2/3
Task 9-13b (skills) — independent, needed at runtime
Task 14 (CLAUDE.md) — independent

Task 21 (proxy.ts intercept) — no deps
  → Task 15 (API relay) — depends on Task 21
    → Task 16 (simplify system prompt) — depends on Task 15
      → Task 17 (remove old tools) — depends on Tasks 15+16 (imports removed first)

Task 18 (frontend WebSocket) — independent
Task 20 (Dockerfile) — depends on Task 4 (knows what to copy)

Task 19 (E2E test) — depends on ALL above
```

**Recommended execution order for parallel subagents:**

- **Batch 1:** Tasks 22, 1, 5-8, 9-13b, 14, 18, 21 (independent setup: SDK check, prompt loader, all prompts, all skills, CLAUDE.md, frontend, proxy)
- **Batch 2:** Tasks 2, 4, 20 (orchestrator module, workspace-init, Dockerfile — need prompt loader done)
- **Batch 3:** Tasks 3, 15 (agent-server integration, API relay — need orchestrator + proxy)
- **Batch 4:** Tasks 16, 17 (system prompt simplification, tool removal — need API relay done)
- **Batch 5:** Task 19 (E2E test — everything done)
