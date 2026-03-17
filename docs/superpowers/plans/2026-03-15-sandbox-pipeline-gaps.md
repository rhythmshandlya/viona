# Sandbox Pipeline Gaps Fix — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all gaps in the sandbox agent pipeline so the Director (orchestrator) can design, deliver, verify, and relay progress for a complete video — end to end.

**Architecture:** Four independent fix areas: (1) progress relay from sandbox → API → frontend → DB, (2) scene registry supporting meaningful names, (3) orchestrator prompt completing the verification loop and manifest-first execution, (4) orchestrator prompt adding `tsc` final verification step. Each can be implemented and tested independently.

**Tech Stack:** TypeScript, Fastify (API), Express (sandbox), Drizzle ORM (PostgreSQL), SSE streaming, Claude Agent SDK

---

## File Structure

| File | Responsibility | Action |
|------|---------------|--------|
| `packages/api/src/sandbox/proxy.ts` | SSE proxy with event interception | Modify: add `onProgress` callback |
| `packages/api/src/agent/agent-router.ts` | Agent route handler — wires callbacks | Modify: add progress handler to intercept callbacks |
| `packages/sandbox/src/tools/scene-registry.ts` | Scene registry list tool (return value) | Modify: fix regex filter |
| `packages/sandbox/src/prompts/orchestrator-system.md` | Orchestrator system prompt | Modify: add verification loop, tsc step, manifest-first detail |
| `scripts/temp/test-progress-relay.ts` | E2E test for progress persistence | Create |

---

## Chunk 1: Progress Relay — API Proxy + DB Persistence

The progress relay chain is broken: `report_progress` MCP tool calls flow through raw SSE to the browser, but the API proxy doesn't intercept them. On page refresh, all progress state is lost because nothing is saved to the `conversation_messages` table.

The fix is surgical: add `onProgress` to `InterceptCallbacks`, add a `case 'progress'` in the event parser, and wire a progress handler in the agent-router that appends a `progress` content block.

### Task 1: Add `onProgress` to InterceptCallbacks

**Files:**
- Modify: `packages/api/src/sandbox/proxy.ts:141-146`

- [ ] **Step 1: Add `onProgress` to the interface**

In `packages/api/src/sandbox/proxy.ts`, the `InterceptCallbacks` interface at line 141 currently has 4 callbacks. Add `onProgress`:

```typescript
export interface InterceptCallbacks {
  onText?: (text: string) => void;
  onDone?: (data: { sessionId?: string; cost?: number }) => Promise<void>;
  onWidget?: (widget: Record<string, unknown>) => void;
  onProgress?: (progress: { phase: string; percent: number; message: string }) => void;
  onError?: (error: string) => void;
}
```

- [ ] **Step 2: Add `case 'progress'` to the SSE event parser**

In the same file, the `switch (eventType)` block at line 231 handles `text`, `done`, `widget`, `error`. Add `progress` between `widget` and `error`:

```typescript
              switch (eventType) {
                case 'text':
                  callbacks.onText?.(data.text ?? data);
                  break;
                case 'done':
                  callbacks.onDone?.(data).catch((err) =>
                    logger.error({ err }, 'InterceptCallbacks.onDone failed'),
                  );
                  break;
                case 'widget':
                  callbacks.onWidget?.(data);
                  break;
                case 'progress':
                  callbacks.onProgress?.(data);
                  break;
                case 'error':
                  callbacks.onError?.(data.message ?? data.error ?? String(data));
                  break;
              }
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd packages/api && npx tsc --noEmit --pretty false 2>&1 | head -20`
Expected: No errors related to `proxy.ts`

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/sandbox/proxy.ts
git commit -m "feat: add onProgress to InterceptCallbacks for progress event interception"
```

---

### Task 2: Wire progress handler in agent-router

**Files:**
- Modify: `packages/api/src/agent/agent-router.ts:327-350`

The `proxyPromptWithIntercept` call at line 327 passes an object with `onText`, `onDone`, `onWidget`, `onError`. We need to add `onProgress` that saves a progress content block.

Progress blocks replace the previous progress block (there's only ever one active progress state) rather than appending, so we track the latest progress block index.

- [ ] **Step 1: Add progress tracking variable**

After line 291 where `let pendingText = '';` is defined, add:

```typescript
    let progressBlockIdx = -1; // Index of the current progress block in contentBlocks
```

- [ ] **Step 2: Add `onProgress` callback to the intercept object**

Inside the callbacks object passed to `proxyPromptWithIntercept` (line 329), add `onProgress` after `onWidget`:

```typescript
          onProgress: (progress) => {
            flushText();
            if (progressBlockIdx >= 0) {
              // Replace existing progress block with updated state
              contentBlocks[progressBlockIdx] = { type: 'progress', ...progress };
            } else {
              // First progress event — append new block
              progressBlockIdx = contentBlocks.length;
              contentBlocks.push({ type: 'progress', ...progress });
            }
          },
```

This approach:
- Flushes any pending text so block order is correct (text before progress)
- Reuses a single progress slot — no duplicate blocks
- The progress block has `{ type: 'progress', phase, percent, message }`
- On `onDone`, the existing `flushText() + updateMessageContent()` call persists the final `contentBlocks` array to DB — no extra DB call needed

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd packages/api && npx tsc --noEmit --pretty false 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/agent/agent-router.ts
git commit -m "feat: persist progress events to conversation_messages content blocks"
```

---

### Task 3: Test progress relay end-to-end

**Files:**
- Create: `scripts/temp/test-progress-relay.ts`

- [ ] **Step 1: Write an E2E test script**

Create `scripts/temp/test-progress-relay.ts` that:
1. Sends a prompt to a running sandbox that will trigger `report_progress` (e.g., "Generate visuals" on a project with an approved plan)
2. Captures SSE events and checks that `progress` events arrive
3. After the stream ends, queries `GET /projects/:id/agent/conversation` and checks that the latest assistant message has a content block with `type: 'progress'`

```typescript
// scripts/temp/test-progress-relay.ts
// Manual E2E test — run against a live sandbox session
//
// Usage: npx tsx scripts/temp/test-progress-relay.ts <projectId> <apiBaseUrl>
//
// Verifies:
// 1. SSE "progress" events arrive during streaming
// 2. Progress blocks are persisted in conversation_messages
// 3. GET /conversation returns the progress block on reload

const [projectId, apiBase = 'http://localhost:3001'] = process.argv.slice(2);
if (!projectId) {
  console.error('Usage: npx tsx scripts/temp/test-progress-relay.ts <projectId> [apiBaseUrl]');
  process.exit(1);
}

async function main() {
  // 1. Fetch conversation to see current state
  const convRes = await fetch(`${apiBase}/api/projects/${projectId}/agent/conversation`, {
    credentials: 'include',
  });
  const conv = await convRes.json();
  console.log(`Conversation has ${conv.messages?.length ?? 0} messages`);

  // 2. Check last assistant message for progress blocks
  const lastAssistant = [...(conv.messages || [])].reverse().find((m: any) => m.role === 'assistant');
  if (lastAssistant) {
    const blocks = lastAssistant.content as Array<{ type: string }>;
    const progressBlocks = blocks.filter(b => b.type === 'progress');
    console.log(`Last assistant message has ${progressBlocks.length} progress block(s)`);
    if (progressBlocks.length > 0) {
      console.log('Progress block:', JSON.stringify(progressBlocks[0], null, 2));
      console.log('\n✅ Progress relay is working — block persisted in DB');
    } else {
      console.log('\n❌ No progress blocks found — relay may not be wired');
    }
  } else {
    console.log('No assistant messages found');
  }
}

main().catch(console.error);
```

- [ ] **Step 2: Commit**

```bash
git add scripts/temp/test-progress-relay.ts
git commit -m "test: add E2E progress relay verification script"
```

---

## Chunk 2: Scene Registry — Support Meaningful Names

The scene registry tool's return-value filter at `packages/sandbox/src/tools/scene-registry.ts:23` uses `/^Scene\d+\.tsx$/` which rejects meaningful names like `HookTitle.tsx`. The actual `generateSceneRegistry()` function at `packages/sandbox/src/scene-registry-generator.ts:16` already handles all `.tsx`/`.ts` files correctly — only the wrapper tool's return filter is broken.

### Task 4: Fix scene registry tool filter

**Files:**
- Modify: `packages/sandbox/src/tools/scene-registry.ts:22-28`

- [ ] **Step 1: Update the file filter regex**

In `packages/sandbox/src/tools/scene-registry.ts`, replace the filter and sort at lines 22-28:

Current code:
```typescript
  return files
    .filter((f) => /^Scene\d+\.tsx$/.test(f))
    .sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)![0], 10);
      const numB = parseInt(b.match(/\d+/)![0], 10);
      return numA - numB;
    });
```

Replace with:
```typescript
  return files
    .filter((f) => /\.(tsx|ts)$/.test(f) && !f.startsWith('.'))
    .sort();
```

This accepts any `.tsx` or `.ts` file (matching the generator's own filter at `scene-registry-generator.ts:16`) and sorts alphabetically instead of by number.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd packages/sandbox && npx tsc --noEmit --pretty false 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/sandbox/src/tools/scene-registry.ts
git commit -m "fix: scene registry tool now accepts meaningful filenames (not just Scene\\d+)"
```

---

## Chunk 3: Orchestrator Prompt — Verification Loop + Final tsc Check

The orchestrator prompt describes Phase 3 execution steps but is missing the explicit verification/healing loop and the final TypeScript verification pass.

### Task 5: Add verification loop to Phase 3

**Files:**
- Modify: `packages/sandbox/src/prompts/orchestrator-system.md`

- [ ] **Step 1: Rewrite Phase 3 execution steps 2-5**

In `orchestrator-system.md`, the Phase 3 execution steps currently read:

```
2. **Dispatch Animator subagents**: ...
3. **Emit progress** SSE events as scenes complete via `mcp__widgets__report_progress`.
4. **After all scenes finish**, trigger a rebuild via `mcp__render__trigger_rebuild`.
5. **Sighted verification**: ...
```

Replace steps 2-5 with this expanded version:

```markdown
2. **Dispatch subagents per beat type**:
   - `animation` beats → Dispatch **Animator** subagent (one at a time, sequentially). In your dispatch message, ALWAYS include:
     - The beat's plan details, meaningful `sceneFile` name, and sync points
     - **Effective dimensions**: "This scene renders in STACKED mode at {{CANVAS_WIDTH}}x{{STACKED_VISUAL_HEIGHT}}" (or fullscreen/overlay equivalent)
     - **Display mode context**: For stacked → "Design for the visual panel area, speaker is visible below"; for fullscreen → "Full canvas, no speaker"; for overlay → "Transparent background, speaker behind, max 2 elements"
   - `stock_video` / `screenshot` beats → Dispatch **Researcher** subagent with search query, target dimensions, output path, and context
   - `text_overlay` beats → Use `mcp__manifest__add_item` directly (no subagent)
   - `speaker_only` beats → No action (gap in timeline = speaker visible)

3. **Verify each scene after generation** (MANDATORY for animation beats):
   After each Animator finishes:
   a. Trigger rebuild via `mcp__render__trigger_rebuild`.
   b. Dispatch **Verifier** subagent with: scene file path, frame range, expected visual description, expected display mode.
   c. **If Verifier passes** → emit progress via `mcp__widgets__report_progress`, move to next scene.
   d. **If Verifier fails** → dispatch **Healer** subagent with the error details and original plan description.
   e. After Healer patches → trigger rebuild → re-dispatch Verifier.
   f. **Max 2 verification retries per scene.** After 2 failures, accept the scene with a warning and move on.

4. **Final TypeScript verification**: After ALL scenes are generated and verified, run `tsc --noEmit --pretty false` via Bash tool to catch any cross-file type errors. If errors:
   a. Dispatch Healer with the full error output.
   b. After fix → re-run tsc.
   c. Max 2 tsc fix attempts. After that, warn the user about remaining issues.

5. **Emit progress** throughout via `mcp__widgets__report_progress`:
   - After plan approval: `{ phase: "generating", percent: 5, message: "Starting scene generation..." }`
   - After each scene verified: `{ phase: "generating", percent: <scaled>, message: "Scene N of M complete: <name>" }`
   - After tsc pass: `{ phase: "verifying", percent: 95, message: "TypeScript verification passed" }`
   - After final rebuild: `{ phase: "complete", percent: 100, message: "All scenes generated and verified" }`

6. **Sighted verification**: Render 2-3 key stills via `mcp__render__render_still` at different timestamps to see the complete composition (video + speaker + visuals together in the stacked layout). Check that scenes fit their panel area and don't overflow. Fix any issues.
```

- [ ] **Step 2: Verify the prompt file has no syntax issues**

Read back the modified file and check that markdown formatting is correct, template variables like `{{CANVAS_WIDTH}}` are preserved, and no content was accidentally deleted.

Run: `grep -c '{{CANVAS_WIDTH}}' packages/sandbox/src/prompts/orchestrator-system.md`
Expected: Should match original count (at least 6 occurrences)

- [ ] **Step 3: Commit**

```bash
git add packages/sandbox/src/prompts/orchestrator-system.md
git commit -m "feat: add verification loop, Researcher dispatch, tsc check, and progress cadence to Phase 3"
```

---

### Task 6: Add scene plan validation rules to orchestrator prompt

**Files:**
- Modify: `packages/sandbox/src/prompts/orchestrator-system.md`

- [ ] **Step 1: Add validation section after Phase 2**

After the Phase 2 section (step 5: "STOP and wait"), add a validation gate:

```markdown
#### Post-Planner Validation (before showing to user)

After the Planner returns `scenes.json`, validate before showing the widget:

1. **Frame duration**: Every beat must be 210-450 frames (7-15 seconds at 30fps). If a beat exceeds 450, split it at the largest sync point gap. If under 210, merge with an adjacent beat.
2. **Contiguity**: Beat frame ranges must be contiguous — no gaps, no overlaps. `beat[N].frames[1]` must equal `beat[N+1].frames[0]`.
3. **Display mode distribution**: At least 70% of beats should use `default` (stacked). Max 1-2 `fullscreen` beats. Hook (first beat) MUST be `default` — never fullscreen.
4. **Coverage**: Beats must cover the full video duration. First beat starts at frame 0, last beat ends at total frames.

If violations are found, fix them directly (adjust frames, change display modes) before building the widget. Do NOT re-dispatch the Planner for minor fixes.
```

- [ ] **Step 2: Commit**

```bash
git add packages/sandbox/src/prompts/orchestrator-system.md
git commit -m "feat: add post-Planner scene plan validation rules to orchestrator prompt"
```

---

## Chunk 4: Orchestrator Prompt — Manifest-First Execution Detail

The orchestrator prompt's Phase 3 step 1 says "create manifest structure" but doesn't spell out the full flow clearly enough for the AI to execute reliably. This task adds explicit sequencing.

### Task 7: Expand manifest-first execution in Phase 3

**Files:**
- Modify: `packages/sandbox/src/prompts/orchestrator-system.md`

- [ ] **Step 1: Expand Phase 3 step 1 with detailed sub-steps**

Replace the current step 1 content with this more explicit version:

```markdown
1. **Create manifest structure** (BEFORE dispatching any subagents):
   Read `/workspace/scenes.json` and create the full manifest skeleton upfront:

   a. **Create overlay track**: `mcp__manifest__add_track` with `type: "overlay"`, `name: "Visuals"`.
   b. **Create scene items for every animation beat**: For each beat in scenes.json, call `mcp__manifest__add_item` with:
      ```json
      {
        "trackId": "<overlay-track-id>",
        "type": "scene",
        "startMs": "<beat.frames[0] / fps * 1000>",
        "endMs": "<beat.frames[1] / fps * 1000>",
        "data": {
          "sceneFile": "<beat.sceneFile>",
          "displayMode": "<segment layout: 'default' | 'fullscreen' | 'overlay'>",
          "enter": { "type": "crossfade", "durationMs": 300 },
          "exit": { "type": "crossfade", "durationMs": 300 }
        }
      }
      ```
      See **Scene Transitions** quality standard for transition type selection rules.
   c. **Create items for other beat types**: `stock_video` → `type: "broll"`, `screenshot` → `type: "image"`, `text_overlay` → `type: "text"`. Each with appropriate timing.
   d. **Skip `speaker_only` beats**: Gaps in the manifest timeline naturally show the speaker.

   The manifest structure must be complete BEFORE dispatching Animators. This ensures the timeline is coherent even if generation is interrupted.
```

- [ ] **Step 2: Verify template variables preserved**

Run: `grep -c '{{STACKED_VISUAL_HEIGHT}}' packages/sandbox/src/prompts/orchestrator-system.md`
Expected: At least 3 occurrences

- [ ] **Step 3: Commit**

```bash
git add packages/sandbox/src/prompts/orchestrator-system.md
git commit -m "feat: expand manifest-first execution detail in Phase 3 orchestrator prompt"
```

---

## Summary

| Task | What it fixes | Priority |
|------|--------------|----------|
| Task 1 | `InterceptCallbacks` missing `onProgress` — progress events not parsed | P1 |
| Task 2 | Agent-router not persisting progress to DB — lost on refresh | P1 |
| Task 3 | E2E test to verify progress relay works | P1 |
| Task 4 | Scene registry rejects meaningful names (`HookTitle.tsx`) | P2 |
| Task 5 | No verification loop (Verify → Heal → Re-verify) in prompt | P2 |
| Task 6 | No post-Planner scene plan validation rules | P3 |
| Task 7 | Manifest-first execution not detailed enough for AI | P3 |
