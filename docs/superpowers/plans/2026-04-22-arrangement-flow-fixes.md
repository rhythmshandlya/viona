# Arrangement Flow Fixes — Manifest Freshness + Selective Placement + Asset Reserves

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the three gaps keeping the upload → transcribe → arrange flow from behaving the way the user described:

1. The orchestrator sometimes reads a stale `assets-manifest.json` that was snapshotted at container-boot time, before transcripts finished. Effect: Viona sees `transcriptAssetId: null` and asks "how should I handle the missing transcript?" even though transcription completed.
2. The arrangement subagent places **every** uploaded clip on the timeline, whether the story needs it or not. User intent is "place only what's required".
3. Clips that aren't placed in the first pass have nowhere to live. They should be tracked as a project-owned reserve pool so `asset_scout` / planner can pull from them instead of always hitting external stock.

**Architecture:** Manifest refresh lives in the sandbox's `/prompt` HTTP handler — one call to `fetchAndWriteAssetsManifest` just before each turn dispatches into the Claude SDK. Selective placement + reserve tracking is enforced through two prompt edits (arrangement subagent `system.md` + `reminder.md`) plus one new convention: arrangement writes `/workspace/docs/unused-assets.json` listing the intentionally unplaced assets with a short reason per entry. Downstream subagents (`asset_scout`, `planner`) read that file as a first-choice source before external stock lookups.

**Tech Stack:** Existing — TypeScript (sandbox + api), Fastify, Claude Agent SDK, Vitest. No new dependencies.

**Spec reference:** none (follow-up cleanup on top of `docs/superpowers/plans/2026-04-20-sandbox-asset-integration.md`).

**Depends on:** PR-B (sandbox assets integration) and PR-D (arrangement subagent) — both already merged.

---

## Scope notes

**In scope:**
- Sandbox re-refreshes `assets-manifest.json` at the top of every `/prompt` turn.
- Arrangement prompt: place-only-what's-required rule + required emission of `unused-assets.json`.
- `asset_scout` prompt: consult `unused-assets.json` before Pexels.
- Planner prompt: mention the reserve pool exists so the plan can call it out.

**Out of scope:**
- Multimodal descriptors (SigLIP etc.) — future work; the file shape we introduce leaves room for them.
- Stytch dev-bypass 400 noise — cosmetic, handled separately.
- Surfacing the reserve pool in the editor Assets panel — future.

---

## File Structure

**Modify (sandbox):**
- `packages/sandbox/src/agent-server.ts` — add a manifest-refresh call at the entry of the `/prompt` handler.
- `packages/sandbox/src/assets/manifest.ts` — ensure `fetchAndWriteAssetsManifest` is idempotent + cheap on warm calls (re-read should be ~1 HTTP round-trip + atomic rename).
- `packages/sandbox/src/prompts/arrangement/system.md` — selective-placement rules + unused-assets emission contract.
- `packages/sandbox/src/prompts/arrangement/reminder.md` — same, short sandwich.
- `packages/sandbox/src/prompts/asset-scout/system.md` — read `unused-assets.json` first.
- `packages/sandbox/src/prompts/planner/system.md` — awareness mention.

**Do not touch:**
- `packages/sandbox/src/assets/manifest.ts` write path (already atomic via rename).
- Frontend `useProjectIngestReady` gate — that's the upstream belt that already prevents the prompt from being sent before transcripts finish. The manifest refresh is the **suspenders** for the case where the sandbox boots after the gate releases but the DB/manifest state is moments stale.

---

## Verification Strategy

**Each task ends with a concrete check:** a unit test (where the code is testable), a log-pattern grep, or a DB/file observation. The final verification is a clean end-to-end run against the Algeria 5-asset test fixture where Viona completes Phase 1 without asking about "missing transcripts" and arrangement places fewer than all clips when the brief demands it.

---

## Tasks

### Task 1 — Refresh `assets-manifest.json` at the top of every `/prompt` turn

**Objective:** Eliminate the stale-manifest class of bugs by re-syncing from the DB immediately before each orchestrator turn.

**Background:** `workspace-init.ts` calls `fetchAndWriteAssetsManifest` once at container boot. If transcribe jobs complete after boot, the manifest on disk still shows `transcriptAssetId: null` for those assets. The orchestrator's Phase 1 prompt then tries `read_asset(transcriptAssetId)` on null.

**Steps:**
- [ ] Read `packages/sandbox/src/agent-server.ts:/prompt` handler — identify the point where the SDK `query()` is invoked.
- [ ] Import `fetchAndWriteAssetsManifest` and the existing `assetsManifestEnv` helper (or replicate the env-sourced call the way `workspace-init.ts` does).
- [ ] Before `query()` starts, `await fetchAndWriteAssetsManifest({ workspaceRoot, projectId, sandboxSecret, apiBaseUrl })`. Catch errors and log-warn; never fail the turn just because refresh errored.
- [ ] Add a log line: `info({ projectId }, 'assets-manifest refreshed before turn')` — greppable for verification.

**Verification:**
- [ ] Add a Vitest unit for `/prompt` handler that mocks `fetchAndWriteAssetsManifest` and asserts it's called before the Claude SDK `query()` invocation (order matters).
- [ ] Manual: send two consecutive prompts with a transcribe completion in between, observe that the post-completion turn's manifest contains the updated `transcriptAssetId`.

---

### Task 2 — Arrangement: place-only-what's-required rule

**Objective:** Stop the subagent from shoving every clip onto the timeline. Place the ones the story needs; leave the rest in the reserve pool.

**Background:** The current `system.md` says "target 15–90 s total duration", but doesn't explicitly say "feel free to skip clips the story doesn't need". LLM behaviour has been: place all, trim later.

**Steps:**
- [ ] Edit `packages/sandbox/src/prompts/arrangement/system.md`:
  - Add a new rule under "Core Rules": *"You MAY skip whole assets if the story doesn't need them. Your job is to pick the best spine, not to include everything. Unplaced assets become reserves for later phases (B-roll, cutaways) — see the unused-assets contract below."*
  - Extend "What You Produce" with step 4: *"Write `/workspace/docs/unused-assets.json` — see contract below — even if empty."*
  - Add a "Unused-Assets Contract" section describing the exact JSON shape.
- [ ] Edit `packages/sandbox/src/prompts/arrangement/reminder.md` to repeat the short version: "Not all assets need to be on the timeline. Unplaced ones go in `unused-assets.json`."

**Unused-Assets Contract** (document in the prompt):
```json
{
  "unused": [
    {
      "assetId": "<uuid from assets-manifest>",
      "filename": "<for human-reading>",
      "mimeType": "<copied from manifest>",
      "reason": "short one-line note — e.g. 'duplicate coverage of the same beat', 'off-topic', 'B-roll candidate for scene about X'"
    }
  ]
}
```

**Verification:**
- [ ] Manual: run the arrangement subagent against the Algeria 5-asset project (1 audio + 4 video clips, brief "keep it tight"). Expect ≤ 4 items on the video track, 1 on voiceover, and a non-empty `unused-assets.json` for any deliberately skipped clips.
- [ ] Add a lightweight Vitest that loads the compiled prompt and greps for the contract section — so rebuilds can't silently drop the rule.

---

### Task 3 — Planner: acknowledge reserve pool exists

**Objective:** The planner should know B-roll candidates already exist in the project before it decides to call `asset_scout` for stock.

**Steps:**
- [ ] Edit `packages/sandbox/src/prompts/planner/system.md`:
  - Add a one-paragraph note: *"Before requesting B-roll from `asset_scout`, check `/workspace/docs/unused-assets.json`. Entries there are user-uploaded assets the arrangement pass set aside — many are viable cutaways. Reference them by `assetId` when they fit a scene's B-roll slot."*

**Verification:**
- [ ] Prompt re-grep: `grep -c "unused-assets.json" /app/dist/prompts/planner/system.md` should return ≥ 1 after rebuild.

---

### Task 4 — `asset_scout`: consult reserve pool first

**Objective:** Route reserves before Pexels. User-owned assets beat stock by default.

**Background:** `asset_scout` today jumps straight to `search_pexels`. It should first look at `/workspace/docs/unused-assets.json`, match each requested B-roll slot against available entries, and only go external when nothing fits.

**Steps:**
- [ ] Edit `packages/sandbox/src/prompts/asset-scout/system.md`:
  - New first step in the workflow: *"Read `/workspace/docs/unused-assets.json`. For each B-roll requirement in `SCENE_PLAN.md`, try to match it to an unused asset (by `reason`, `filename`, and any available descriptor). Place those via `add_item` referencing the asset's `id`. Only call `search_pexels` for slots that nothing in the reserve pool fits."*
  - Add a rule: *"Never duplicate an already-placed asset. Check current `manifest.json` items before referencing an unused entry."*

**Verification:**
- [ ] Manual: run a full pipeline on a project that has deliberate reserves (skip a clip during arrangement), ask for a broll-heavy plan, confirm the reserve clips land as B-roll before any Pexels clip does.
- [ ] Prompt re-grep after rebuild: `grep -c "unused-assets.json" /app/dist/prompts/asset-scout/system.md` should return ≥ 1.

---

### Task 5 — Rebuild sandbox image + smoke test end-to-end

**Objective:** Ship all four prompt/code changes together, verify on a live project.

**Steps:**
- [ ] `docker build -t viona-sandbox:latest -f packages/sandbox/Dockerfile .`
- [ ] Verify prompts are in the shipped image: `docker run --rm --entrypoint sh viona-sandbox:latest -c "grep -c 'unused-assets.json' /app/dist/prompts/arrangement/system.md /app/dist/prompts/asset-scout/system.md /app/dist/prompts/planner/system.md"` — each count ≥ 1.
- [ ] Kill running sandboxes: `docker ps --filter "name=sandbox-" --format "{{.Names}}" | xargs -r docker rm -f`.
- [ ] Create a fresh project from `/projects` with the Algeria 5-asset fixture + brief: *"Magazine theme. The speaker's best take on Algeria's anti-cheating measures. Keep only what serves the story; we've got extra footage in case we need cutaways later."*
- [ ] Observe:
  - IngestStatusList finishes all 5 assets.
  - Viona proceeds to Phase 1.5 without asking about "missing transcripts".
  - Arrangement places fewer than 4 video clips AND `/workspace/docs/unused-assets.json` has ≥ 1 entry.
  - Planner references the reserves at least once during Phase 3 (check chat output).
  - Final cut + scene plan completes without erroring.
- [ ] If any step fails, open a follow-up task per failure.

---

## Non-Goals / Deferred

- **Surface reserve pool in the editor Assets panel.** The Assets tab could show a "Reserves" badge on clips the subagent set aside. Useful, not required for the pipeline to work.
- **Multimodal descriptors.** Adding visual embeddings / scene tags to `assets-manifest.json` entries. The unused-assets `reason` field is a plain-text proxy for now; when we add descriptors, match quality jumps.
- **Reserve pool reuse across sessions.** The `unused-assets.json` is workspace-local. Cross-session persistence (e.g. "last session flagged this clip as unused — keep the annotation") would live in the `assets` table.
- **Stytch dev-bypass 400 noise suppression.** Cosmetic, independent.

---

## Rollback

All five changes are additive: remove the manifest-refresh call (reverts to boot-time snapshot), revert three prompt edits (reverts to place-all-clips behaviour), delete this file. No migrations, no schema changes, no data touched.
