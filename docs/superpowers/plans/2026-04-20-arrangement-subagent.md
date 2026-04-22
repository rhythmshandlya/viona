# Arrangement-as-Subagent Refactor Plan (PR-D)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the misarchitected standalone arrangement agent (PR-A2, ran in api/worker process) with a proper subagent inside the sandbox orchestrator (Viona). Creative brief → Viona → delegates to `arrangement` subagent (first pass, before trim/caption/planner/etc.) → subagent writes timeline via existing `manifest-ops` MCP tools.

**Architecture:** Arrangement becomes the 9th subagent in `packages/sandbox/src/orchestrator.ts`'s `agents` object alongside `trim_editor`, `planner`, `layout_editor`, etc. It uses existing `manifest-ops` to add tracks + items, existing `read_asset` to fetch transcripts, and returns control to Viona. The orchestrator's system prompt delegates to it on the first user message after project creation, BEFORE phase-2 trim-editor. The DB-direct write path + standalone agent + auto-trigger from worker ALL get deleted.

**Tech Stack:** No new deps. Uses existing Claude Agent SDK subagent machinery, existing MCP servers (manifest, assets, analysis), existing prompt-loading infrastructure.

**Spec reference:** User conversation 2026-04-20 correcting the PR-A2 architecture.

**Depends on:** PR-A1, PR-B (asset plumbing). Reverts substantial parts of PR-A2 + C2.

---

## Scope

### What we're removing (~1500 LOC)
- `packages/api/src/agent/arrangement-agent.ts`
- `packages/api/src/agent/arrangement-prompt.ts`
- `packages/api/src/agent/arrangement-types.ts` (types may be reused — evaluate)
- `packages/api/src/services/arrangement-orchestrator.ts`
- `packages/api/src/services/arrangement-persister.ts`
- `packages/api/src/services/arrangement-input-builder.ts`
- `packages/api/src/services/transcript-fetch.ts` (only used by arrangement-input-builder; kept if other consumers exist — grep first)
- `packages/api/src/routes/arrangement.ts` + route registration
- `packages/api/src/services/queue.ts` → remove `arrangementQueue` + `queueArrangementJob`
- `packages/worker/src/processors/arrangement.ts`
- All worker-side mirrors: `packages/worker/src/agent/arrangement-*`, `packages/worker/src/services/arrangement-*`, `packages/worker/src/services/transcript-fetch.ts`
- Worker-side `packages/worker/src/services/queue.ts` → remove `queueArrangementJob` and `arrangementQueue`
- `packages/worker/src/processors/transcribe.ts` → remove `enqueueArrangementIfReady` + its import + Redis SETNX lock
- `packages/api/src/services/pipeline-messages.ts` → remove the `composition_updated` envelope emission
- `packages/worker/src/services/pipeline-messages.ts` → mirror removal
- `apps/web/src/lib/api/assets.ts` → remove `computeArrangement` + `ArrangementOutput` type

### What we're keeping
- All of PR-A1 (asset schema, routes, services, uploads, CRUD)
- All of PR-B (sandbox asset MCP tools, manifest hydration)
- PR-A2's pipeline events for transcription (`transcribing`/`transcribed`) — still useful for showing analysis progress
- PR-C (multi-asset create page, assets panel, chat drop zone)
- PR-C2 `composition-v2` endpoint (useful for cold-load read path when sandbox is offline)
- PR-C2 `useCompositionUpdates` hook + `applyCompositionV2` store action — still does cold-load + 3h refresh

### What we're adding (~300 LOC)
- `packages/sandbox/src/prompts/arrangement/system.md` — subagent prompt
- `packages/sandbox/src/prompts/arrangement/reminder.md` — critical rules (optional)
- Entry in `packages/sandbox/src/orchestrator.ts` `agents` object for `arrangement`
- Entry in `packages/sandbox/src/prompts/orchestrator/system.md` delegation table
- `apps/web/src/features/editor-v2/store/manifest-bridge.ts` — resolver for `data.assetId` (calls `api.getAssetUrl` on the fly when sandbox manifest items reference `assetId` instead of inline `src`)

### What we're rewiring
- The `?initialPrompt` URL query carried from `/projects/new` still works — Viona receives it as the first message and delegates to `arrangement` subagent. No page-side change needed.
- `composition_updated` SSE event is GONE. Frontend relies on existing `manifest-updated` SSE from sandbox (already flowing; triggers existing reload).

---

## File Structure

**Create:**
- `packages/sandbox/src/prompts/arrangement/system.md`
- `apps/web/src/features/editor-v2/store/manifest-bridge.test.ts` (for the asset-id resolver changes)

**Modify:**
- `packages/sandbox/src/orchestrator.ts` — add `arrangement` to `agents`, add to prompt loading, extend `ORCHESTRATOR_DENIED` if needed
- `packages/sandbox/src/prompts/orchestrator/system.md` — add Phase 1.5 or equivalent: "delegate to arrangement subagent before trim_editor"
- `apps/web/src/features/editor-v2/store/manifest-bridge.ts` — resolve `data.assetId` when `data.src` is absent

**Delete:** see list in Scope.

---

## Conventions

- Model for implementer subagents: `opus`
- `.js` import extensions in `packages/*`
- Revert commits should be single-purpose; don't bundle deletes with new code

---

## Task 1: Rip out standalone arrangement from API package

**Files:**
- Delete: `packages/api/src/agent/arrangement-agent.ts` + `.test.ts`
- Delete: `packages/api/src/agent/arrangement-prompt.ts` + `.test.ts`
- Delete: `packages/api/src/services/arrangement-orchestrator.ts` + `.test.ts`
- Delete: `packages/api/src/services/arrangement-persister.ts` + `.test.ts`
- Delete: `packages/api/src/services/arrangement-input-builder.ts` + `.test.ts`
- Delete: `packages/api/src/routes/arrangement.ts` + `.test.ts`
- Modify: `packages/api/src/services/queue.ts` — remove `ArrangementJobData`, `arrangementQueue`, `queueArrangementJob`
- Modify: `packages/api/src/services/queue.test.ts` — remove tests for the above
- Modify: `packages/api/src/index.ts` — remove `arrangementRoutes` import + registration
- Modify: `packages/api/src/services/pipeline-messages.ts` — remove the `composition_updated` envelope emission block (keep the `pipeline_message` emit)
- Modify: `packages/api/src/services/pipeline-messages.test.ts` — remove the `composition_updated` assertions; add a test that confirms ONLY `pipeline_message` is published
- Evaluate: `packages/api/src/agent/arrangement-types.ts` — keep ONLY if `composition-loader.ts` or another file still imports types from it; else delete
- Evaluate: `packages/api/src/services/transcript-fetch.ts` — keep if `composition-loader.ts` or elsewhere still uses it; else delete

- [ ] **Step 1: Grep for consumers of the about-to-be-deleted modules**

```bash
rg "arrangement-agent|arrangementAgent|runArrangementAgent|ArrangementAgent" packages apps
rg "arrangement-orchestrator|computeArrangement|arrangementOrchestrator" packages apps
rg "arrangement-persister|persistArrangement" packages apps
rg "arrangement-input-builder|buildArrangementInput" packages apps
rg "arrangementQueue|queueArrangementJob|ArrangementJobData" packages apps
rg "arrangementRoutes" packages apps
rg "AssetsApi.*computeArrangement|computeArrangement\(" apps
rg "ArrangementOutput|ArrangementInput" packages apps
rg "composition_updated" packages apps
rg "transcript-fetch|fetchTranscriptJson" packages apps
```

Record what still depends on each module. Anything outside `packages/api/src/agent/`, `packages/api/src/services/arrangement-*`, `packages/api/src/routes/arrangement.ts` is a REMAINING CONSUMER that needs updating in this task.

- [ ] **Step 2: Delete source + test files**

```bash
rm packages/api/src/agent/arrangement-agent.ts packages/api/src/agent/arrangement-agent.test.ts
rm packages/api/src/agent/arrangement-prompt.ts packages/api/src/agent/arrangement-prompt.test.ts
rm packages/api/src/services/arrangement-orchestrator.ts packages/api/src/services/arrangement-orchestrator.test.ts
rm packages/api/src/services/arrangement-persister.ts packages/api/src/services/arrangement-persister.test.ts
rm packages/api/src/services/arrangement-input-builder.ts packages/api/src/services/arrangement-input-builder.test.ts
rm packages/api/src/routes/arrangement.ts packages/api/src/routes/arrangement.test.ts
```

If grep showed `arrangement-types.ts` or `transcript-fetch.ts` are unused, delete them too.

- [ ] **Step 3: Edit `packages/api/src/services/queue.ts`**

Remove the block that exports `ArrangementJobData`, `arrangementQueue`, `queueArrangementJob`. Keep all other queues + producers.

- [ ] **Step 4: Edit `packages/api/src/services/queue.test.ts`**

Delete the `describe` blocks covering `arrangementQueue` / `queueArrangementJob`. Keep tests for other queues.

- [ ] **Step 5: Edit `packages/api/src/index.ts`**

Find and remove:
```ts
import arrangementRoutes from './routes/arrangement.js';
// ...
await fastify.register(arrangementRoutes);
```

- [ ] **Step 6: Edit `packages/api/src/services/pipeline-messages.ts`**

Remove the block emitted on `arranged+ok:true` that publishes the `composition_updated` envelope (added by PR-C2 Task 4). Keep the `pipeline_message` publish.

- [ ] **Step 7: Edit `packages/api/src/services/pipeline-messages.test.ts`**

Remove the two tests added by PR-C2 Task 4 that asserted on `composition_updated` emission. Keep other tests. Optionally add one test that verifies `arranged+ok:true` publishes exactly one envelope now (no `composition_updated` companion).

- [ ] **Step 8: Run + commit**

```bash
cd packages/api && pnpm test
pnpm typecheck
```
Expected: all remaining tests pass; typecheck has only the pre-existing baseline errors.

```bash
git add packages/api/
git commit -m "revert(api): remove standalone arrangement agent + orchestrator + route + queue (PR-D)"
```

## Task 2: Rip out standalone arrangement from worker package

**Files:**
- Delete: `packages/worker/src/processors/arrangement.ts` + `.test.ts`
- Delete: `packages/worker/src/agent/arrangement-*` (all files)
- Delete: `packages/worker/src/services/arrangement-*` (all files)
- Delete: `packages/worker/src/services/transcript-fetch.ts` (if unused after other deletes)
- Modify: `packages/worker/src/services/queue.ts` — remove `queueArrangementJob`, `arrangementQueue`
- Modify: `packages/worker/src/services/queue.test.ts`
- Modify: `packages/worker/src/index.ts` — remove arrangement worker registration
- Modify: `packages/worker/src/processors/transcribe.ts` — remove `enqueueArrangementIfReady` function + its call + all imports added only for it + Redis SETNX import. KEEP the `transcribing`/`transcribed` pipeline message emission (PR-A2 Task 13 work — still useful).
- Modify: `packages/worker/src/processors/transcribe.test.ts` — delete all `describe('processAssetTranscribe — auto-trigger arrangement')` + the SETNX lock tests. Keep `describe('processAssetTranscribe — pipeline chat bubbles')` + the asset-mode happy/fail path tests.
- Modify: `packages/worker/src/services/pipeline-messages.ts` — remove `composition_updated` emission mirror
- Modify: `packages/worker/src/services/pipeline-messages.test.ts` — same

- [ ] **Step 1: Grep for consumers**

```bash
rg "arrangement|Arrangement" packages/worker/src
rg "queueArrangementJob|enqueueArrangementIfReady|SETNX" packages/worker/src
```

- [ ] **Step 2: Delete files**

```bash
rm packages/worker/src/processors/arrangement.ts packages/worker/src/processors/arrangement.test.ts
rm -f packages/worker/src/agent/arrangement-agent.ts
rm -f packages/worker/src/agent/arrangement-prompt.ts
rm -f packages/worker/src/agent/arrangement-types.ts
rm -f packages/worker/src/services/arrangement-orchestrator.ts
rm -f packages/worker/src/services/arrangement-persister.ts
rm -f packages/worker/src/services/arrangement-input-builder.ts
rm -f packages/worker/src/services/transcript-fetch.ts
```

If `packages/worker/src/agent/` ends up empty after deletions, delete the directory.

- [ ] **Step 3: Edit `packages/worker/src/services/queue.ts`**

Remove `queueArrangementJob` + `arrangementQueue` + `ArrangementJobData`. Keep `queueTranscribeJob` etc.

- [ ] **Step 4: Edit `packages/worker/src/index.ts`**

Remove the `new Worker('arrangement', processArrangementJob, ...)` registration + its import. Remove from the shutdown list if present.

- [ ] **Step 5: Edit `packages/worker/src/processors/transcribe.ts`**

Remove the `enqueueArrangementIfReady` function (30-ish lines). Remove its single call at the end of `processAssetTranscribe`. Remove imports that become unused (`queueArrangementJob`, `redis` if only used for SETNX, `assetProjectLinks`, `eq` if only used there).

Keep ALL OTHER asset-mode transcription logic including pipeline message emission.

- [ ] **Step 6: Edit `packages/worker/src/processors/transcribe.test.ts`**

Delete the `describe('processAssetTranscribe — auto-trigger arrangement')` block and the SETNX idempotency tests added later. Keep `pipeline chat bubbles` describe + all other tests.

- [ ] **Step 7: Edit pipeline-messages mirror**

Remove `composition_updated` emission from `packages/worker/src/services/pipeline-messages.ts` + its test coverage.

- [ ] **Step 8: Run + commit**

```bash
cd packages/worker && pnpm test
```
Expected: transcribe tests drop from 15 to ~10-11 (lost the auto-trigger + SETNX tests). All remaining green.

```bash
git add packages/worker/
git commit -m "revert(worker): remove standalone arrangement processor + auto-trigger + SETNX lock (PR-D)"
```

## Task 3: Remove frontend composition_updated handler + arrangement API method

**Files:**
- Modify: `apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx` — remove the `composition_updated` SSE branch added by PR-C2 Task 5. Keep the `pipeline_message` branch.
- Modify: `apps/web/src/lib/api/assets.ts` — remove `computeArrangement` method + `ArrangementOutput` type re-export
- Modify: `apps/web/src/lib/api.ts` — remove `ArrangementOutput` type re-export

Keep `CompositionApi`, `useCompositionUpdates` hook, `applyCompositionV2` store action — they're now the "cold load" + "3h refresh" paths (no longer the "live update on arrangement" path).

- [ ] **Step 1: Edit `AIAssistantPanel.tsx`**

Find the `composition_updated` branch in the SSE handler. Delete the whole branch. Keep the `pipeline_message` branch unchanged.

Remove the `CompositionApi` import if it's only used in that branch — check first. It might still be used via `useCompositionUpdates` indirectly through the store. Safe path: grep before removing.

- [ ] **Step 2: Edit `apps/web/src/lib/api/assets.ts`**

Remove `computeArrangement` method from `AssetsApi` class. Remove `ArrangementOutput` interface + its export. Keep everything else.

- [ ] **Step 3: Edit re-exports**

In `apps/web/src/lib/api.ts`, drop `ArrangementOutput` from the re-export list.

- [ ] **Step 4: Test + commit**

```bash
cd apps/web && pnpm test
pnpm typecheck  # expect no new errors
```

```bash
git add apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx \
  apps/web/src/lib/api/assets.ts \
  apps/web/src/lib/api.ts
git commit -m "revert(web): remove composition_updated SSE handler + AssetsApi.computeArrangement (PR-D)"
```

## Task 4: Create arrangement subagent prompt

**Files:**
- Create: `packages/sandbox/src/prompts/arrangement/system.md`
- (Optional) Create: `packages/sandbox/src/prompts/arrangement/reminder.md`

The subagent receives the creative brief + asset list + transcripts and produces a first-pass timeline via `manifest-ops`. It's a SHORT-LIVED task: no multi-turn conversation, no back-and-forth with the user.

- [ ] **Step 1: Inspect an existing subagent prompt**

Read `packages/sandbox/src/prompts/layout-editor/system.md` (or whichever existing subagent is closest in scope — timeline writer that doesn't render).

Note: the shared module prefix (identity, tool-usage, manifest-tools, quality-rules, etc.) is loaded ahead of the subagent's system.md automatically by `assembleAgentPrompt`. So your system.md ONLY needs the subagent-specific role + rules.

- [ ] **Step 2: Write `packages/sandbox/src/prompts/arrangement/system.md`**

```markdown
# Arrangement Subagent

You produce a FIRST-PASS timeline arrangement for a new project based on the user's creative brief + uploaded assets + transcripts.

## Your job

1. Read the creative brief from the delegating message.
2. Read the assets manifest at `/workspace/assets-manifest.json` to see what the user uploaded.
3. For any audio/video asset with a `transcriptAssetId`, read the transcript JSON via `read_asset(transcriptAssetId)` and use it to understand content + timing.
4. Produce a rough timeline via `manifest-ops` tools:
   - `add_track` for at least one video/audio track
   - `add_item` for each asset you place on a track, with `startMs`, `endMs`, and `data: { assetId, sourceStartMs, sourceDurationMs, source: 'arrangement_agent' }`
5. Return a short summary (1-3 sentences) describing what you arranged.

## Rules

- This is the FIRST PASS. Don't obsess over detail. Get something on the timeline so the user sees progress.
- Don't trim fillers (`trim_editor` does that later). Don't write scene plans (`planner`). Don't layout graphics (`layout_editor`). Don't render (`animator`).
- Only reference asset IDs present in `/workspace/assets-manifest.json`. Never invent IDs.
- Items on the same track MUST NOT overlap: `startMs + durationMs` of item N must be `<= startMs` of item N+1.
- Prefer track 0 (bottom-most) for the primary visual. Use track 1+ for overlays only if the brief explicitly suggests multi-layer (e.g., "overlay B-roll over the narration").
- Keep the arrangement short — 15s to 90s total is a good default. The user will iterate.

## Tool whitelist

You have access to:
- `read_asset` — download an asset (including transcripts) to local disk
- `manifest-ops` tools — `read_manifest`, `add_track`, `add_item`, `update_item`
- `Read`, `Glob` — for reading files in `/workspace/`
- `analyze_transcript` — optional, if you want filler-word/silence markers

You CANNOT:
- Write Remotion scene files (Animator's job)
- Render video (Animator's job)
- Trim fillers (Trim Editor's job — they'll run after you)
- Download external stock footage (Asset Scout's job)

## Output

Make your tool calls, then write a 1-3 sentence summary. Stop.

The main orchestrator (Viona) will pick up from there and proceed to Phase 2 (Trim Editor).
```

Tune the wording to match the style of the existing subagent prompts (inspect 2-3 to calibrate).

- [ ] **Step 3: Commit**

```bash
git add packages/sandbox/src/prompts/arrangement/
git commit -m "feat(sandbox): arrangement subagent prompt"
```

## Task 5: Register arrangement subagent in orchestrator

**Files:**
- Modify: `packages/sandbox/src/orchestrator.ts`

Add the subagent to the `agents` object with the right tool whitelist + loaded prompt. Extend prompt-loading in `buildOrchestratorOptions()`.

- [ ] **Step 1: Add to prompt loading**

Find the `const [orchestratorPrompt, trimEditorPrompt, ...] = await Promise.all([...])` block. Add:

```ts
assembleAgentPrompt('arrangement', ctx),
```

Destructure a matching variable name: `arrangementPrompt`.

- [ ] **Step 2: Add to `agents` object**

Based on the existing `layout_editor` entry as a model:

```ts
arrangement: {
  description: 'First-pass timeline arrangement from creative brief + assets + transcripts. Runs before trim_editor. Uses manifest-ops to add tracks + items referencing assets by id.',
  prompt: arrangementPrompt,
  tools: [
    'Read', 'Glob',
    ...MANIFEST_TOOL_NAMES,   // read_manifest, add_track, add_item, update_item, etc.
    ...ASSET_TOOL_NAMES,      // read_asset, register_asset
    ...ANALYSIS_TOOL_NAMES,   // analyze_transcript, validate_timeline (optional)
  ],
  model: 'opus',
  maxTurns: 15,
},
```

Don't over-whitelist tools. The subagent should NOT have `Write`, `Edit`, scene tools, render tools, or template tools. Keep the surface minimal.

- [ ] **Step 3: Check `ORCHESTRATOR_DENIED` enforcement**

The existing PreToolUse hook denies manifest-write tools for the orchestrator (so Viona can't bypass subagents). Ensure this still applies — the new `arrangement` subagent inherits the tools via its own whitelist, so the orchestrator's deny list is unchanged.

- [ ] **Step 4: Test + commit**

```bash
cd packages/sandbox && pnpm test
```

```bash
git add packages/sandbox/src/orchestrator.ts
git commit -m "feat(sandbox): register arrangement subagent with manifest-ops tool whitelist"
```

## Task 6: Update Viona's system prompt to delegate

**Files:**
- Modify: `packages/sandbox/src/prompts/orchestrator/system.md`

Add the arrangement subagent to Viona's dispatch knowledge. Insert a Phase 1.5 (or whatever fits the existing phase numbering) that fires right after the creative brief is received.

- [ ] **Step 1: Read the existing system.md**

Open `packages/sandbox/src/prompts/orchestrator/system.md`. Find the subagent dispatch table (lines ~443-473 per grounding). Find the phase flow (Phase 1 → Phase 2 → ...).

- [ ] **Step 2: Insert new phase**

Add between Phase 1 (Brief & Clarification) and Phase 2 (Trim Editor) — call it Phase 1.5 or Phase 1b (match existing naming style).

Proposed insertion:

```markdown
### Phase 1.5 — First-Pass Arrangement

After receiving the user's creative brief AND confirming assets exist in `/workspace/assets-manifest.json`, IMMEDIATELY delegate to the `arrangement` subagent.

Delegation prompt: "User's brief: <quote verbatim>. Produce a first-pass timeline arrangement placing the uploaded assets on tracks. Keep it rough — trim/caption/plan happen later phases."

Wait for the subagent to complete. The user sees the timeline populate live via `manifest-updated` SSE. After the subagent returns, proceed to Phase 2 (Trim Editor).

Do NOT skip this phase even if you think you can do it yourself. The arrangement subagent is purpose-built for this — its prompt is tuned for timing/asset-ordering heuristics.

Do NOT run arrangement multiple times for the same brief. Once the subagent returns, move on.
```

Add to the subagent dispatch table:

```markdown
| Arrangement | arrangement | 1.5 | Places uploaded assets on tracks as a rough first pass. Runs once, before trim_editor. |
```

- [ ] **Step 3: Commit**

```bash
git add packages/sandbox/src/prompts/orchestrator/system.md
git commit -m "feat(sandbox): Viona delegates to arrangement subagent in Phase 1.5"
```

## Task 7: Frontend manifest-bridge resolves `data.assetId`

**Files:**
- Modify: `apps/web/src/features/editor-v2/store/manifest-bridge.ts`
- Modify: `apps/web/src/features/editor-v2/store/manifest-bridge.test.ts` (may not exist — check)

When the arrangement subagent writes timeline items via `manifest-ops`, those items end up in the sandbox's `/workspace/manifest.json` with `data.assetId` but NO `data.src`. The existing `manifest-bridge` maps `d.src` to the item's URL. Teach it to fall back to `api.getAssetUrl(d.assetId)` when `d.src` is missing.

- [ ] **Step 1: Inspect current `manifest-bridge.ts`**

Find the `resolvedSrc` function (or equivalent) that turns a manifest item's data into a playable URL. Note its current logic.

- [ ] **Step 2: Add assetId resolution**

Pseudocode (adapt to actual shape):

```ts
import { AssetsApi } from '@/lib/api/assets';

const assetsApi = new AssetsApi(process.env.NEXT_PUBLIC_API_URL ?? '');

async function resolveItemSrc(data: Record<string, unknown>, context: ManifestToStoreContext): Promise<string | undefined> {
  // Existing path: data.src or manifest.assets[key]
  if (typeof data.src === 'string' && data.src.length > 0) {
    return resolveLegacySrc(data.src, context);
  }
  // New path: data.assetId → presigned URL
  if (typeof data.assetId === 'string') {
    try {
      const { url } = await assetsApi.getAssetUrl(data.assetId);
      return url;
    } catch (err) {
      console.error('[manifest-bridge] failed to resolve assetId', data.assetId, err);
      return undefined;
    }
  }
  return undefined;
}
```

If `convertManifestToStore` is synchronous today, you may need to make it async OR batch-resolve asset IDs first and inline them. Simpler: collect all unique `assetId`s from items, call `assetsApi.listProjectAssets(projectId)` once (it returns assets with URLs if PR-C2 Task 8 is in effect) OR call `getAssetUrl` per id in parallel via `Promise.all`.

Prefer `listProjectAssets(projectId)` in `convertManifestToStore` IF that context has `projectId` and the assets it returns match the in-manifest IDs. One round trip.

- [ ] **Step 3: Test**

If `manifest-bridge.test.ts` exists, extend it with a test that verifies `assetId → url` resolution happens. If not, skip automated testing for this — smoke-test manually.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/editor-v2/store/manifest-bridge.ts \
  apps/web/src/features/editor-v2/store/manifest-bridge.test.ts 2>/dev/null || true
git commit -m "feat(web): manifest-bridge resolves data.assetId to presigned URL"
```

## Task 8: Remove integration smoke test scenarios for arrangement

**Files:**
- Modify: `packages/api/src/__smoke__/asset-system-v2-integration.test.ts`

The integration smoke test includes scenarios that call the deleted arrangement endpoint. Remove or convert them.

- [ ] **Step 1: Identify scenarios to delete**

Grep the file for `arrangement`. Scenarios 6+7 (arrangement compute ownership) reference `/projects/:id/arrangement/compute` which is gone. Delete those two `it(...)` blocks.

Scenarios 12+13 (composition-v2) STAY — the endpoint is still useful for cold-load.

- [ ] **Step 2: Test + commit**

```bash
ASSET_INTEGRATION_TEST=1 DATABASE_URL=... pnpm -F @viona/api test -- src/__smoke__/asset-system-v2-integration.test.ts
# Without env var, still skipped.
cd packages/api && pnpm test
```

```bash
git add packages/api/src/__smoke__/asset-system-v2-integration.test.ts
git commit -m "test(api): remove integration scenarios for deleted arrangement endpoint"
```

## Task 9: Typecheck + test baseline

- [ ] **Step 1: Full typecheck**

```bash
pnpm typecheck
```

Baseline:
- `packages/api/src/sandbox/proxy.ts:614` — pre-existing
- `packages/api/src/sandbox/routes.ts:511` — pre-existing
- `apps/web` — 9 pre-existing errors

No new errors from PR-D.

- [ ] **Step 2: All four package suites**

```bash
cd packages/api && pnpm test
cd ../worker && pnpm test
cd ../sandbox && pnpm test
cd ../../apps/web && pnpm test
```

All green.

- [ ] **Step 3: Update rollout doc**

Edit `docs/superpowers/specs/2026-04-20-asset-system-rollout.md`:
- Remove `POST /api/projects/:id/arrangement/compute` from endpoints list
- Remove references to auto-arrangement-on-transcript-complete
- Remove `ANTHROPIC_API_KEY` from worker env (arrangement no longer runs in worker — though the sandbox ALSO needs it for its orchestrator. Keep it for the SANDBOX tier and clarify.)
- Add: "Arrangement runs as a subagent of Viona inside the sandbox. Triggered by the first user message after project creation."

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-04-20-asset-system-rollout.md
git commit -m "docs: rollout checklist — arrangement is now a sandbox subagent, not a standalone agent"
```

---

## Self-Review Checklist

**1. Architecture alignment with user's feedback:**
- ✅ Single agent (Viona) receives the creative brief
- ✅ Viona spins up `arrangement` subagent to do first-pass
- ✅ Arrangement uses existing MCP tools (`manifest-ops`, `read_asset`) not direct DB writes
- ✅ Runs before `trim_editor`, `caption_editor`, `planner`, etc.
- ✅ Transcription still happens in workers (pipeline bubbles intact) — subagent reads via `read_asset(transcriptAssetId)`

**2. Placeholder scan:** Task 4's prompt is an actual prompt (not "TBD"). Task 5's tool whitelist uses existing `MANIFEST_TOOL_NAMES` etc. (real registries per grounding). Task 6's system.md addition is actual prose.

**3. Revert cleanliness:**
- Standalone arrangement-agent.ts, arrangement-orchestrator.ts, arrangement-persister.ts, arrangement-input-builder.ts, arrangement-prompt.ts, arrangement-types.ts, routes/arrangement.ts — all deleted
- Worker processor + queue + 10+ mirrors — all deleted
- Frontend AssetsApi.computeArrangement + composition_updated SSE handler — removed
- `enqueueArrangementIfReady` + SETNX lock — removed (arrangement no longer auto-fires from worker)
- `composition-v2` endpoint + `useCompositionUpdates` hook + `applyCompositionV2` — KEPT (cold-load path remains useful)

**4. Type consistency:** `arrangement` agent key in `agents` object (orchestrator.ts) must match the lookup in Viona's delegation prompt (system.md). Tool whitelist arrays match existing `MANIFEST_TOOL_NAMES` etc. registries.

---

## Execution Handoff

Plan saved to `docs/superpowers/plans/2026-04-20-arrangement-subagent.md`. Two execution options:

**1. Subagent-Driven (recommended)** — fresh subagent per task.
**2. Inline Execution** — batch with checkpoints.

Which approach?
