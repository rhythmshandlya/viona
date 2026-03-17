# Pipeline End-to-End Wiring Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire `prompt-assembly.ts` into the orchestrator, create per-display-mode Animator variants, add a dispatch message MCP tool, and fix the orchestrator prompt to match SDK reality — making the 8-phase pipeline production-ready.

**Architecture:** The orchestrator code builds 3 Animator agent variants (stacked/fullscreen/overlay) with display-mode-specific rules baked into their system prompts. A `build_animator_dispatch` MCP tool computes effective dimensions and formats scene-specific dispatch messages deterministically. The orchestrator prompt is updated to use these variants and to stop claiming subagent resume (which the SDK `Agent` tool doesn't support).

**Tech Stack:** TypeScript, Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`), Zod, in-process MCP servers

---

## Spec Reference

- Discussion notes: `docs/superpowers/specs/2026-03-15-pipeline-discussion-notes.md`
- Existing code audit: see conversation context

## File Structure

### Files to modify:
- `packages/sandbox/src/prompt-assembly.ts` — Add `buildAnimatorVariantPrompt()` export
- `packages/sandbox/src/mcp-servers.ts` — Add `build_animator_dispatch` tool, accept `PromptContext`
- `packages/sandbox/src/orchestrator.ts` — Build 3 Animator variants, wire dispatch tool
- `packages/sandbox/src/agent-server.ts` — Pass `projectContext` to `createMcpServers()`
- `packages/sandbox/src/prompts/orchestrator-system.md` — Identity, dispatch patterns, no "resume"
- `scripts/temp/test-orchestrator-config.ts` — Verify 3 variants, dispatch tool, identity
- `scripts/temp/test-prompt-assembly.ts` — Verify `buildAnimatorVariantPrompt()`

### Files NOT touched:
- `packages/sandbox/src/prompts/editor-system.md` — Already covers Phases 2/4/7
- `packages/sandbox/src/prompts/planner-system.md` — Already has research (WebSearch/WebFetch)
- `packages/sandbox/src/prompts/reviewer-system.md` — Already checks per-scene
- `packages/sandbox/src/prompts/animator-system.md` — Already has self-healing
- `packages/sandbox/src/prompts/prompt-loader.ts` — No changes needed
- `packages/sandbox/src/workspace-init.ts` — Already creates `generation-progress.json`
- `packages/sandbox/src/tools/widget-tools.ts` — Type-only file, MCP tool is inline in mcp-servers.ts

---

## Chunk 1: Wire prompt-assembly into the pipeline

### Task 1: Add `buildAnimatorVariantPrompt()` to prompt-assembly.ts

**Files:**
- Modify: `packages/sandbox/src/prompt-assembly.ts`
- Test: `scripts/temp/test-prompt-assembly.ts`

**Context:** `prompt-assembly.ts` exists but is dead code — nothing imports it. It already has `computeEffectiveDimensions()`, display mode rules (STACKED_RULES, FULLSCREEN_RULES, OVERLAY_RULES), theme loading, and `buildAnimatorPrompt()` (per-scene). We need a new function that builds a **variant system prompt** (per-display-mode, not per-scene) that gets baked into the agent definition.

The base animator prompt (`animator-system.md` + shared modules) already contains self-healing rules and animation techniques. The variant adds: theme design system + display-mode-specific rules with pre-computed effective dimensions.

- [ ] **Step 1: Write the failing test**

Add to `scripts/temp/test-prompt-assembly.ts` after the existing tests:

```typescript
// ---- Test: buildAnimatorVariantPrompt ----

import {
  buildAnimatorVariantPrompt,
} from '../../packages/sandbox/src/prompt-assembly.js';

console.log('\n=== buildAnimatorVariantPrompt ===\n');

const basePrompt = '# Base Animator Prompt\n\nYou are an Animator agent.';
const variantCtx = { canvasWidth: 1080, canvasHeight: 1920, theme: 'studio-dark' };

// Stacked variant
const stackedVariant = await buildAnimatorVariantPrompt('default', basePrompt, variantCtx);
assert(stackedVariant.includes('# Base Animator Prompt'), 'Stacked variant includes base prompt');
assert(stackedVariant.includes('STACKED'), 'Stacked variant includes stacked rules');
assert(stackedVariant.includes('1080×1056'), 'Stacked variant has computed dimensions (55% of 1920)');
assert(!stackedVariant.includes('FULLSCREEN'), 'Stacked variant does NOT include fullscreen rules');
assert(!stackedVariant.includes('OVERLAY'), 'Stacked variant does NOT include overlay rules');

// Fullscreen variant
const fullscreenVariant = await buildAnimatorVariantPrompt('fullscreen', basePrompt, variantCtx);
assert(fullscreenVariant.includes('FULLSCREEN'), 'Fullscreen variant includes fullscreen rules');
assert(fullscreenVariant.includes('1080×1920'), 'Fullscreen variant has full canvas dimensions');
assert(!fullscreenVariant.includes('STACKED'), 'Fullscreen variant does NOT include stacked rules');

// Overlay variant
const overlayVariant = await buildAnimatorVariantPrompt('overlay', basePrompt, variantCtx);
assert(overlayVariant.includes('OVERLAY'), 'Overlay variant includes overlay rules');
assert(overlayVariant.includes('Face zone OFF-LIMITS'), 'Overlay variant has safe zone rules');
assert(!overlayVariant.includes('STACKED'), 'Overlay variant does NOT include stacked rules');

// All variants include theme section
for (const [name, variant] of [['stacked', stackedVariant], ['fullscreen', fullscreenVariant], ['overlay', overlayVariant]]) {
  assert(variant.includes('THEME:'), `${name} variant has theme section`);
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/sandbox && cd ../.. && pnpm tsx scripts/temp/test-prompt-assembly.ts`
Expected: FAIL — `buildAnimatorVariantPrompt` is not exported from prompt-assembly.ts

- [ ] **Step 3: Implement `buildAnimatorVariantPrompt()`**

Add to `packages/sandbox/src/prompt-assembly.ts` after the existing `buildAnimatorDispatchMessage()` function:

```typescript
/**
 * Build an Animator variant system prompt for a specific display mode.
 * Called once per display mode during orchestrator initialization (3 total).
 *
 * The base prompt already contains shared modules, animation techniques,
 * and self-healing rules (from animator-system.md). This function adds:
 * - Theme design system (loaded from workspace)
 * - Display-mode-specific rules with pre-computed effective dimensions
 *
 * @param displayMode - Which display mode this variant targets
 * @param basePrompt - The base animator prompt (already context-injected)
 * @param ctx - Canvas dimensions and theme name
 */
export async function buildAnimatorVariantPrompt(
  displayMode: DisplayMode,
  basePrompt: string,
  ctx: { canvasWidth: number; canvasHeight: number; splitRatio?: number; theme?: string },
): Promise<string> {
  const splitRatio = ctx.splitRatio ?? 55;
  const dims = computeEffectiveDimensions(ctx.canvasWidth, ctx.canvasHeight, displayMode, splitRatio);

  let modeRules: string;
  switch (displayMode) {
    case 'default':
      modeRules = STACKED_RULES(dims);
      break;
    case 'fullscreen':
      modeRules = FULLSCREEN_RULES(dims);
      break;
    case 'overlay':
      modeRules = OVERLAY_RULES(dims);
      break;
  }

  const themeContent = await loadThemeContent(ctx.theme ?? 'studio-dark');

  return [basePrompt, '\n\n---\n\n', themeContent, '\n\n---\n\n', modeRules].join('');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm tsx scripts/temp/test-prompt-assembly.ts`
Expected: All tests pass (existing 27 + new variant tests)

- [ ] **Step 5: Commit**

```bash
git add packages/sandbox/src/prompt-assembly.ts scripts/temp/test-prompt-assembly.ts
git commit -m "feat: add buildAnimatorVariantPrompt() for per-display-mode agent prompts"
```

---

### Task 2: Add `build_animator_dispatch` MCP tool

**Files:**
- Modify: `packages/sandbox/src/mcp-servers.ts`
- Test: `scripts/temp/test-orchestrator-config.ts`

**Context:** `mcp-servers.ts` exports `createMcpServers(widgetCallbacks)` which returns 4 in-process MCP servers (manifest, scenes, render, widgets). The `widgets` server has `show_widget` and `report_progress` tools. We need to add a `build_animator_dispatch` tool that computes effective dimensions and formats the Animator dispatch message deterministically — so the orchestrator LLM doesn't have to do math.

The tool also needs canvas dimensions to compute effective dimensions. We'll pass a context object as a second parameter to `createMcpServers()`.

- [ ] **Step 1: Write the failing test**

Add to `scripts/temp/test-orchestrator-config.ts` in the "Agent Tool Registries" section:

```typescript
  // build_animator_dispatch tool should exist
  assert(mcpServersSrc.includes("'build_animator_dispatch'"), 'Has build_animator_dispatch MCP tool');
  assert(mcpServersSrc.includes("sceneName"), 'Dispatch tool has sceneName param');
  assert(mcpServersSrc.includes("sceneFile"), 'Dispatch tool has sceneFile param');
  assert(mcpServersSrc.includes("displayMode"), 'Dispatch tool has displayMode param');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm tsx scripts/temp/test-orchestrator-config.ts`
Expected: FAIL — 'build_animator_dispatch' not found in mcp-servers.ts

- [ ] **Step 3: Implement the tool**

In `packages/sandbox/src/mcp-servers.ts`:

**3a.** Add import at the top:
```typescript
import { computeEffectiveDimensions, buildAnimatorDispatchMessage, type SceneConfig } from './prompt-assembly.js';
```

**3b.** Change function signature to accept pipeline context:
```typescript
export function createMcpServers(
  widgetCallbacks: WidgetCallbacks,
  pipelineCtx?: { canvasWidth: number; canvasHeight: number; fps: number; theme: string },
) {
```

**3c.** Add the tool to the `widgetServer` tools array (after `report_progress`):
```typescript
      tool(
        'build_animator_dispatch',
        'Build a formatted dispatch message for an Animator subagent. Call this BEFORE dispatching an Animator — it computes effective dimensions and formats the scene assignment. Pass the result as the Agent tool prompt.',
        {
          sceneName: z.string().describe('Human-readable scene name (e.g., "Hook Title")'),
          sceneFile: z.string().describe('PascalCase filename without extension (e.g., "HookTitle")'),
          displayMode: z.enum(['default', 'fullscreen', 'overlay']).describe('Layout mode for this scene'),
          splitRatio: z.number().optional().describe('Split ratio percentage for stacked mode (default: 55)'),
          sceneBrief: z.string().describe('Visual description from the plan'),
          syncPoints: z.array(z.object({
            frame: z.number(),
            action: z.string(),
          })).describe('Key transcript moments tied to frame numbers'),
          durationFrames: z.number().describe('Scene duration in frames'),
        },
        async (input) => {
          if (!pipelineCtx) {
            return { content: [{ type: 'text' as const, text: 'Error: pipeline context not available' }] };
          }
          const config: SceneConfig = {
            sceneName: input.sceneName,
            sceneFile: input.sceneFile,
            displayMode: input.displayMode,
            splitRatio: input.splitRatio ?? 55,
            sceneBrief: input.sceneBrief,
            syncPoints: input.syncPoints,
            durationFrames: input.durationFrames,
            canvasWidth: pipelineCtx.canvasWidth,
            canvasHeight: pipelineCtx.canvasHeight,
            fps: pipelineCtx.fps,
            theme: pipelineCtx.theme,
          };
          const msg = buildAnimatorDispatchMessage(config);
          return { content: [{ type: 'text' as const, text: msg }] };
        },
      ),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm tsx scripts/temp/test-orchestrator-config.ts`
Expected: New assertions pass

- [ ] **Step 5: Commit**

```bash
git add packages/sandbox/src/mcp-servers.ts scripts/temp/test-orchestrator-config.ts
git commit -m "feat: add build_animator_dispatch MCP tool for deterministic scene dispatch"
```

---

### Task 3: Update orchestrator.ts — 3 Animator variants

**Files:**
- Modify: `packages/sandbox/src/orchestrator.ts`
- Test: `scripts/temp/test-orchestrator-config.ts`

**Context:** Currently defines one `animator` agent with a generic prompt. The discussion notes require per-display-mode Animator prompts assembled by code. We replace the single `animator` with 3 variants (`animator-stacked`, `animator-fullscreen`, `animator-overlay`), each with display-mode-specific rules baked into their system prompt.

Also add `mcp__widgets__build_animator_dispatch` to the orchestrator's allowed tools.

- [ ] **Step 1: Write the failing test**

Update `scripts/temp/test-orchestrator-config.ts`:

First, update the existing animator assertion (around line 46) — the old `animator:` check will break because we're replacing it with 3 variants. Change:
```typescript
  assert(orchestratorSrc.includes("animator:"), 'Has animator agent');
```
to:
```typescript
  // Generic animator replaced by 3 display-mode variants (tested below)
```

Then add new assertions:
```typescript
  // Should have 3 Animator variants
  assert(orchestratorSrc.includes("'animator-stacked':"), 'Has animator-stacked agent');
  assert(orchestratorSrc.includes("'animator-fullscreen':"), 'Has animator-fullscreen agent');
  assert(orchestratorSrc.includes("'animator-overlay':"), 'Has animator-overlay agent');

  // prompt-assembly.ts should be imported
  assert(orchestratorSrc.includes("from './prompt-assembly"), 'Imports prompt-assembly module');
  assert(orchestratorSrc.includes('buildAnimatorVariantPrompt'), 'Uses buildAnimatorVariantPrompt');

  // build_animator_dispatch tool should be in allowed tools
  assert(orchestratorSrc.includes("'mcp__widgets__build_animator_dispatch'"), 'Dispatch tool in allowed tools');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm tsx scripts/temp/test-orchestrator-config.ts`
Expected: FAIL — no animator-stacked, still has generic animator

- [ ] **Step 3: Implement 3 Animator variants**

In `packages/sandbox/src/orchestrator.ts`:

**3a.** Add import:
```typescript
import { buildAnimatorVariantPrompt } from './prompt-assembly.js';
```

**3b.** In `buildOrchestratorOptions()`, insert variant construction between the `systemPrompt` assignment (line 117) and the `return {` block (line 119). The current code inlines `injectContext(animatorPrompt, ctx)` inside the agent definition at line 180. We extract it and build 3 variants:

```typescript
  // Line 117 (existing):
  const systemPrompt = injectContext(orchestratorPrompt, ctx);

  // ---- INSERT THIS BLOCK after line 117 (before the return) ----
  const animatorBaseInjected = injectContext(animatorPrompt, ctx);

  // Build per-display-mode Animator variants — code assembles layered prompts
  const variantCtx = {
    canvasWidth: ctx.canvasWidth,
    canvasHeight: ctx.canvasHeight,
    theme: ctx.theme ?? 'studio-dark',
  };
  const [animatorStackedPrompt, animatorFullscreenPrompt, animatorOverlayPrompt] =
    await Promise.all([
      buildAnimatorVariantPrompt('default', animatorBaseInjected, variantCtx),
      buildAnimatorVariantPrompt('fullscreen', animatorBaseInjected, variantCtx),
      buildAnimatorVariantPrompt('overlay', animatorBaseInjected, variantCtx),
    ]);
  // ---- END INSERT ----
```

**3c.** Replace the single `animator` agent definition (lines 174-192) with 3 variants. Remove the entire `animator: { ... }` block and replace with:
```typescript
      // ---- Animator (Stacked) ----
      // For scenes with displayMode "default" (stacked layout).
      // System prompt includes stacked-specific rules and effective dimensions.
      // All 3 variants share the same tool array (copied from the old `animator:` block, lines 181-189):
      const animatorTools = [
        'Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash', 'Skill',
        ...MANIFEST_TOOL_NAMES,
        ...SCENE_TOOL_NAMES,
        ...RENDER_TOOL_NAMES,
        ...ASSET_TOOL_NAMES,
        ...VIEWPORT_TOOL_NAMES,
        ...ICON_TOOL_NAMES,
        ...FREEPIK_TOOL_NAMES,
      ];

      'animator-stacked': {
        description: 'Writes Remotion .tsx scene files for STACKED (default) display mode. Scene renders in the visual panel above the speaker. Self-heals compilation errors.',
        prompt: animatorStackedPrompt,
        tools: animatorTools,
        model: 'opus',
      },

      // ---- Animator (Fullscreen) ----
      'animator-fullscreen': {
        description: 'Writes Remotion .tsx scene files for FULLSCREEN display mode. Scene fills the entire canvas, speaker hidden. Animated background required. Self-heals compilation errors.',
        prompt: animatorFullscreenPrompt,
        tools: animatorTools,
        model: 'opus',
      },

      // ---- Animator (Overlay) ----
      'animator-overlay': {
        description: 'Writes Remotion .tsx scene files for OVERLAY display mode. Transparent background, content in safe zones only (top strip 0-15%, lower third 58-85%). Max 2 elements. Self-heals compilation errors.',
        prompt: animatorOverlayPrompt,
        tools: animatorTools,
        model: 'opus',
      },
```

**3d.** Add `'mcp__widgets__build_animator_dispatch'` to the `WIDGET_TOOL_NAMES` array:
```typescript
const WIDGET_TOOL_NAMES = ['mcp__widgets__show_widget', 'mcp__widgets__report_progress', 'mcp__widgets__build_animator_dispatch'];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm tsx scripts/temp/test-orchestrator-config.ts`
Expected: All assertions pass

- [ ] **Step 5: Commit**

```bash
git add packages/sandbox/src/orchestrator.ts scripts/temp/test-orchestrator-config.ts
git commit -m "feat: replace generic animator with 3 display-mode variants using prompt-assembly"
```

---

### Task 4: Wire pipeline context through agent-server

**Files:**
- Modify: `packages/sandbox/src/agent-server.ts`

**Context:** `agent-server.ts` calls `createMcpServers(callbacks)` but doesn't pass canvas dimensions. The new `build_animator_dispatch` tool needs them. The request body already has `projectContext: PromptContext` which contains `canvasWidth`, `canvasHeight`, `fps`, and `theme`.

- [ ] **Step 1: Update `createMcpServers()` call**

In `packages/sandbox/src/agent-server.ts`, change line 106-109 from:
```typescript
    const mcpServers = createMcpServers({
      onWidget: (widget) => sendSSE('widget', widget),
      onProgress: (progress) => sendSSE('progress', progress),
    });
```
to:
```typescript
    const mcpServers = createMcpServers(
      {
        onWidget: (widget) => sendSSE('widget', widget),
        onProgress: (progress) => sendSSE('progress', progress),
      },
      body.projectContext ? {
        canvasWidth: body.projectContext.canvasWidth,
        canvasHeight: body.projectContext.canvasHeight,
        fps: body.projectContext.fps,
        theme: body.projectContext.theme ?? 'studio-dark',
      } : undefined,
    );
```

- [ ] **Step 2: Verify no TypeScript errors introduced**

Run: `pnpm tsx scripts/temp/test-orchestrator-config.ts`
Expected: All tests still pass

- [ ] **Step 3: Commit**

```bash
git add packages/sandbox/src/agent-server.ts
git commit -m "feat: pass pipeline context to MCP servers for dispatch tool"
```

---

## Chunk 2: Fix orchestrator prompt to match SDK reality

### Task 5: Update identity and dispatch patterns

**Files:**
- Modify: `packages/sandbox/src/prompts/orchestrator-system.md`
- Test: `scripts/temp/test-orchestrator-config.ts`

**Context:** The orchestrator prompt has several mismatches with how the Claude Agent SDK actually works:
1. Identity says "Creative Director for Viona" — should be "You ARE Viona"
2. Says "resume Editor session" for Phase 7 — SDK `Agent` tool doesn't support subagent resume
3. Says "resume Animator with feedback" on review failure — same issue
4. References a single `animator` agent — should reference 3 variants
5. Says "layered prompt assembly done by code" but doesn't tell the LLM to use `build_animator_dispatch`

- [ ] **Step 1: Write the failing test**

Add to `scripts/temp/test-orchestrator-config.ts`:

```typescript
  // ---- Test: Identity ----
  console.log('\n=== Identity ===\n');

  assert(orchPrompt.includes('You are Viona'), 'Identity is "You are Viona" (not "Creative Director for Viona")');
  assert(!orchPrompt.includes('Creative Director for Viona'), 'No "Creative Director for Viona" phrasing');

  // ---- Test: SDK-accurate dispatch patterns ----
  console.log('\n=== SDK Dispatch Patterns ===\n');

  assert(orchPrompt.includes('animator-stacked'), 'References animator-stacked variant');
  assert(orchPrompt.includes('animator-fullscreen'), 'References animator-fullscreen variant');
  assert(orchPrompt.includes('animator-overlay'), 'References animator-overlay variant');
  assert(orchPrompt.includes('build_animator_dispatch'), 'References build_animator_dispatch tool');
  assert(!orchPrompt.includes('Resume from Phase 4 session'), 'No "resume from Phase 4 session" (SDK doesn\'t support subagent resume)');
  assert(!orchPrompt.includes('resume the originating Animator'), 'No "resume Animator" (use re-dispatch instead)');
  assert(!orchPrompt.includes('resume the Planner'), 'No "resume the Planner" (use re-dispatch instead)');
  assert(!orchPrompt.includes('Resume the **Animator**'), 'No "Resume the Animator" in Phase 8 table');
  assert(!orchPrompt.includes('Resume **Editor**'), 'No "Resume Editor" in Phase 8 table');
  assert(!orchPrompt.includes('Resume the **Editor**'), 'No "Resume the Editor" in Phase 7');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm tsx scripts/temp/test-orchestrator-config.ts`
Expected: FAIL — identity still "Creative Director for Viona", no variant references

- [ ] **Step 3: Apply prompt changes**

**3a-pre. Planner "resume"** (line 135): Change:
```
If the user gives feedback, resume the Planner with that feedback to revise the plan.
```
to:
```
If the user gives feedback, re-dispatch the Planner with that feedback to revise the plan. Each dispatch is a fresh session.
```

**3a. Identity** (line 3): Change:
```
You are the Creative Director for Viona — a sharp, opinionated AI collaborator
```
to:
```
You are Viona — a sharp, opinionated AI creative partner
```

**3b. Phase 7 dispatch** (lines 339-340): Change:
```
**Phase 7 (Final Assembly):**
- Resume from Phase 4 session (do not create a new Editor)
```
to:
```
**Phase 7 (Final Assembly):**
- Re-dispatch the Editor for Phase 7. It reads the manifest and workspace to understand what was built in Phase 4.
```

**3c. Animator dispatch** (lines 360-374): Replace the entire Animator subsection:
```markdown
### Animator (Phase 5)

Three display-mode variants: `animator-stacked`, `animator-fullscreen`, `animator-overlay`. Each has display-mode-specific rules and effective dimensions baked into its system prompt by code.

**Dispatch flow (for each animation scene):**
1. Call `mcp__widgets__build_animator_dispatch` with the scene config (name, file, displayMode, brief, syncPoints, durationFrames)
2. The tool returns a formatted dispatch message with pre-computed effective dimensions
3. Dispatch the matching variant (`animator-stacked`, `animator-fullscreen`, or `animator-overlay`) using the Agent tool with the formatted message as the prompt

Each Animator self-heals compilation errors (max 2 attempts). No separate Healer agent.

Before dispatching Animators, load skills: `framer-motion`, `motion-one`, `video-engagement`.
```

**3d. Reviewer fail path** (line 388): Change:
```
On fail, resume the originating Animator with feedback.
```
to:
```
On fail, re-dispatch the same Animator variant with the scene file path and the Reviewer's feedback. The Animator reads the existing code and applies fixes.
```

**3e-pre. Phase 8 table** (lines 264-266): Change:
```
| Animation looks wrong, scene visual issue | Resume the **Animator** that created it with feedback |
| Trim more, pacing feels off, cut this part | Resume **Editor** with trimming instructions |
| Composition issue, text too small, elements overlap | Dispatch **Reviewer** to diagnose, then resume **Animator** with feedback |
```
to:
```
| Animation looks wrong, scene visual issue | Re-dispatch the matching **Animator** variant with the scene file and feedback |
| Trim more, pacing feels off, cut this part | Re-dispatch **Editor** with trimming instructions |
| Composition issue, text too small, elements overlap | Dispatch **Reviewer** to diagnose, then re-dispatch the **Animator** variant with feedback |
```

**3e-pre2. Phase 6 fail path** (line 218): Change:
```
- **Fail** → Resume the Animator that created the scene with the Reviewer's feedback appended. The Animator fixes and self-heals. Re-dispatch Reviewer.
```
to:
```
- **Fail** → Re-dispatch the same Animator variant with the scene file path and the Reviewer's feedback. The Animator reads the existing code and applies fixes. Re-dispatch Reviewer to verify.
```

**3e-pre3. Phase 7 opening** (line 229): Change:
```
Resume the **Editor** from Phase 4 (using its saved session). The Editor performs final assembly:
```
to:
```
Re-dispatch the **Editor** for final assembly. The Editor reads the manifest and workspace to understand what was built in Phase 4. It performs:
```

**3e-pre4. Flow summary** (lines 697, 702): Change:
```
│  Phase 6: Review          │ ← Reviewer per scene as they complete
│                           │   Pass → next, Fail → resume Animator
```
to:
```
│  Phase 6: Review          │ ← Reviewer per scene as they complete
│                           │   Pass → next, Fail → re-dispatch Animator
```
and:
```
│  Phase 7: Final Assembly  │ ← Resume Editor: replace mockups,
```
to:
```
│  Phase 7: Final Assembly  │ ← Re-dispatch Editor: replace mockups,
```

**3e. Rules section** (line 726): Change:
```
- Editor is resumable — Phase 7 resumes the Phase 4 session.
```
to:
```
- Editor is re-dispatched for each phase (2, 4, 7). It reads workspace state to know what to do.
```

**3f-pre. Editor dispatch section** (line 325): Change:
```
The Editor handles transcript trimming, rough cut creation, and final assembly. It is resumable via session — Phase 7 resumes the session from Phase 4.
```
to:
```
The Editor handles transcript trimming, rough cut creation, and final assembly. Each phase re-dispatches a fresh Editor — it reads workspace state to know which phase to execute.
```

**3f. Rules section** (line 728): Change:
```
- Layered prompt assembly for Animators is done by code, not manually composed by Viona.
```
to:
```
- Use `mcp__widgets__build_animator_dispatch` before every Animator dispatch. Never manually compose the dispatch message.
```

**3g. Phase 5 body text** (lines 186-200): The Phase 5 section still describes manual prompt assembly. Update the "Step 2" paragraph (lines 186-200) from:
```
**Step 2 — Dispatch one Animator per animation scene:**
For each animation beat in the plan, dispatch an **Animator** subagent. The orchestrator CODE assembles a layered prompt per-scene that includes:
- Display mode rules for this scene's layout
...
```
to:
```
**Step 2 — Dispatch one Animator per animation scene:**
For each animation beat in the plan:
1. Call `mcp__widgets__build_animator_dispatch` with the scene config (name, file, displayMode, brief, syncPoints, durationFrames)
2. The tool returns a formatted dispatch message with pre-computed effective dimensions
3. Dispatch the matching variant (`animator-stacked`, `animator-fullscreen`, or `animator-overlay`) using the Agent tool with the formatted message as the prompt

Each variant already has display-mode-specific rules and theme configuration in its system prompt — the dispatch message adds the per-scene details (brief, sync points, duration).
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm tsx scripts/temp/test-orchestrator-config.ts`
Expected: All identity and dispatch pattern tests pass

- [ ] **Step 5: Commit**

```bash
git add packages/sandbox/src/prompts/orchestrator-system.md scripts/temp/test-orchestrator-config.ts
git commit -m "fix: update orchestrator prompt — identity, SDK-accurate dispatch, 3 Animator variants"
```

---

## Chunk 3: End-to-end validation

### Task 6: Full test suite + TypeScript compilation

**Files:**
- Test: `scripts/temp/test-orchestrator-config.ts`
- Test: `scripts/temp/test-prompt-assembly.ts`

- [ ] **Step 1: Run prompt assembly tests**

Run: `pnpm tsx scripts/temp/test-prompt-assembly.ts`
Expected: All pass (original 27 + new variant tests)

- [ ] **Step 2: Run orchestrator config tests**

Run: `pnpm tsx scripts/temp/test-orchestrator-config.ts`
Expected: All pass (original 47 + new variant/identity/dispatch tests)

- [ ] **Step 3: Run TypeScript compilation**

Run: `cd packages/sandbox && npx tsc --noEmit 2>&1 | grep -v 'Cannot find module' | grep -v 'implicitly has'`
Expected: No NEW errors (pre-existing missing module errors are acceptable — express, minio, chokidar, @anthropic-ai/claude-agent-sdk are installed in Docker only)

- [ ] **Step 4: Verify prompt-assembly is no longer dead code**

Run: `grep -r "prompt-assembly" packages/sandbox/src/ --include="*.ts" | grep -v "prompt-assembly.ts"`
Expected: At least 2 matches — one in `orchestrator.ts` (import), one in `mcp-servers.ts` (import)

- [ ] **Step 5: Verify no "resume" language remains for subagents**

Run: `grep -in "resume.*session\|resume.*animator\|resume.*editor.*phase\|resume.*planner\|resume the" packages/sandbox/src/prompts/orchestrator-system.md`
Expected: Zero matches (top-level orchestrator SDK session resume in the code is fine — only subagent "resume" language in the prompt is wrong)

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: pipeline end-to-end wiring — prompt-assembly integrated, 3 Animator variants, SDK-accurate dispatch

Wire prompt-assembly.ts into the orchestrator with per-display-mode Animator
variants (stacked/fullscreen/overlay). Add build_animator_dispatch MCP tool for
deterministic dimension computation. Fix orchestrator prompt: identity is now
'You are Viona', subagent dispatch uses re-dispatch instead of resume,
Animators dispatched via display-mode-specific variants with code-assembled
prompts."
```

---

## What This Achieves

After implementation, the pipeline is wired end-to-end:

| Discussion Requirement | How It's Wired |
|---|---|
| **Code assembles Animator prompts** | `buildAnimatorVariantPrompt()` builds 3 variants at startup |
| **Effective dimensions computed by code** | `computeEffectiveDimensions()` called in variants + dispatch tool |
| **Per-display-mode rules** | Each variant has STACKED/FULLSCREEN/OVERLAY rules in system prompt |
| **Theme injected by code** | `loadThemeContent()` called during variant assembly |
| **Deterministic dispatch messages** | `build_animator_dispatch` MCP tool formats scene config |
| **Identity: "You ARE Viona"** | Prompt line 3 updated |
| **No subagent resume claims** | "Re-dispatch" language throughout |
| **Editor Phase 2→4→7** | Re-dispatched per phase, reads workspace state |
| **Reviewer per-scene** | Re-dispatches Animator variant on failure |
| **Plan approval widget** | Already wired (widget response → next request) |
| **Progress with agent/track/time** | Already wired (report_progress tool → SSE) |
| **Captions after Phase 2** | In Editor prompt, no code changes needed |
| **Incremental preview** | Works naturally (Remotion reads manifest) |

## Known Tradeoffs

**Re-dispatch vs Resume:** The discussion notes describe subagent session resume (keeping full context from prior runs). The Claude Agent SDK `Agent` tool does NOT support this — each dispatch is a fresh session. This means:
- The Planner re-reads the transcript on feedback revisions (extra tokens, ~5-10s latency)
- The Editor re-reads manifest/workspace state for Phase 7 (extra tokens but workspace is the source of truth anyway)
- Animators on review failure re-read their scene file (minimal cost since files are small)

This is an inherent SDK limitation. The dispatch messages include enough context (workspace paths, feedback text) for agents to pick up effectively. If the SDK adds subagent resume in the future, the code change is minimal — add `resume: sessionId` to the Agent tool call.

## Out of Scope

- Background music sourcing (deferred per user request)
- Screenshot capture tool (WebFetch covers article content; visual screenshots are future work)
