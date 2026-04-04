# Plan 1: Remove Deprecated Head Tracking & Shot Boundaries

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove `detect_head.py` (MediaPipe + PySceneDetect) and all shot boundary infrastructure. Speaker positioning now comes from RVM segmentation matte bounding boxes.

**Prerequisites:** None — this is standalone cleanup.

**Dependency chain:** `Plan 1` → `Plan 2` → `Plan 3` → `Plan 4` → `Plan 5` → `Plan 6`

---

### Task 1: Delete detect_head.py and gut the head-tracking processor

**Files:**
- Delete: `packages/worker/scripts/detect_head.py`
- Modify: `packages/worker/src/processors/head-tracking.ts`

- [ ] **Step 1: Delete detect_head.py**

```bash
rm packages/worker/scripts/detect_head.py
```

- [ ] **Step 2: Check if head-tracking processor is referenced by job queue**

```bash
grep -r "head-tracking\|head_tracking\|headTracking" packages/worker/src/ --include="*.ts" -l
```

If the processor is registered as a BullMQ job handler, replace its body with a no-op that immediately completes (to avoid queue errors). If nothing references it, delete the file.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove deprecated detect_head.py (MediaPipe head tracking)"
```

---

### Task 2: Remove shot-boundaries from workspace-init

**Files:**
- Modify: `packages/sandbox/src/workspace-init.ts`

- [ ] **Step 1: Find and remove shot boundary code**

Search for `shot-boundaries`, `alignShotsWithTranscript`, and `payload.headTracking.shots` in `workspace-init.ts`. Remove:
- The `alignShotsWithTranscript()` function definition
- The block that writes `/workspace/docs/shot-boundaries.json`
- Any references to `payload.headTracking.shots`

Keep everything else in workspace-init intact (video download, audio extraction, manifest setup, transcript, theme files).

- [ ] **Step 2: Remove headTracking.shots from InitPayload if it's typed**

Check if `InitPayload` interface references `shots` and clean up the type.

- [ ] **Step 3: Commit**

```bash
git add packages/sandbox/src/workspace-init.ts
git commit -m "chore: remove shot-boundaries.json generation from workspace-init"
```

---

### Task 3: Remove get_shot_boundaries MCP tool

**Files:**
- Modify: `packages/mcp-servers/src/asset-server.ts`
- Modify: `packages/sandbox/src/orchestrator.ts`

- [ ] **Step 1: Remove the tool registration**

In `packages/mcp-servers/src/asset-server.ts`, find and delete the entire `get_shot_boundaries` tool registration block (server.registerTool("get_shot_boundaries", ...)).

- [ ] **Step 2: Remove from orchestrator tool lists**

In `packages/sandbox/src/orchestrator.ts`, remove `'mcp__assets__get_shot_boundaries'` from `ASSET_TOOL_NAMES` and remove `get_shot_boundaries` from the activity labels.

- [ ] **Step 3: Commit**

```bash
git add packages/mcp-servers/src/asset-server.ts packages/sandbox/src/orchestrator.ts
git commit -m "chore: remove get_shot_boundaries MCP tool"
```

---

### Task 4: Clean shot boundary references from prompts

**Files:**
- Modify: `packages/sandbox/src/prompts/orchestrator/system.md`
- Modify: `packages/sandbox/src/prompts/planner/system.md`

- [ ] **Step 1: Clean orchestrator prompt**

Remove any instruction to call `get_shot_boundaries` or pass shot boundary data to the Planner.

- [ ] **Step 2: Clean planner prompt**

Remove:
- The "Shot Boundaries (Camera Cuts)" section
- The step that calls `get_shot_boundaries` from the workflow
- `isMultiCam` references
- Any self-verification checklist items about shot boundary alignment

- [ ] **Step 3: Verify no remaining references**

```bash
grep -r "shot.boundar\|shot_boundar\|isMultiCam\|get_shot_boundaries" packages/sandbox/src/ packages/mcp-servers/src/ --include="*.ts" --include="*.md"
```

Expected: no matches.

- [ ] **Step 4: Commit**

```bash
git add packages/sandbox/src/prompts/
git commit -m "chore: remove shot boundary references from orchestrator and planner prompts"
```
