# Plan 3: Orchestrator Depth Asset Pipeline

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a post-segmentation blocking phase to the orchestrator that polls until all depth assets (matte, foreground video, background image) are ready, then passes a depthAssets manifest to the layout editor.

**Prerequisites:** Plan 2 complete (worker outputs fgr + bg alongside matte).

**Dependency chain:** `Plan 1` → `Plan 2` → **`Plan 3`** → `Plan 4` → `Plan 5` → `Plan 6`

---

## Pipeline timing

```
Phase 3: Plan approved → request_segmentation() (non-blocking)
         Worker does everything: matte + fgr + bbox + bg image (single job)
Phase 4: Setup Agent (parallel with worker)
Phase 5: NEW — Block, poll segmentation until all assets arrive
Phase 6: Layout Editor (receives depthAssets manifest)
```

No tools to call in Phase 5. Just poll `check_segmentation_status` until done. The worker already produced everything.

---

### Task 1: Update orchestrator prompt — add Phase 5

**Files:**
- Modify: `packages/sandbox/src/prompts/orchestrator/system.md`

- [ ] **Step 1: Insert Phase 5 between Setup and Layout, renumber downstream**

```markdown
### Phase 5: Wait for Depth Assets (no subagent — you do this directly)

Report progress: `{ phase: "depth-assets", message: "Waiting for segmentation..." }`

**If there are NO overlay scenes in the plan, skip this phase entirely.**

The worker segmentation job (triggered after plan approval in Phase 3) produces ALL depth assets in a single pass:
- `matte/{sceneId}.mp4` — grayscale alpha matte
- `matte/{sceneId}-fgr.mp4` — clean foreground video (speaker pixels)
- `matte/{sceneId}-bbox.json` — per-frame bounding boxes
- `bg-{sceneId}.png` — clean background image (speaker inpainted out)

All are downloaded to `/workspace/public/` when `check_segmentation_status` reports completion.

**Polling:**
- Call `check_segmentation_status({ jobIds })` every 10 seconds
- Timeout: 180 seconds
- On timeout: treat unfinished scenes as failed
- On all failed: pass empty depthAssets to Layout Editor

**Build depthAssets manifest:**

```json
{
  "scene-1": {
    "status": "ready",
    "fgrVideo": "matte/scene-1-fgr.mp4",
    "matteVideo": "matte/scene-1.mp4",
    "background": "bg-scene-1.png"
  },
  "scene-4": { "status": "failed", "reason": "segmentation timed out" }
}
```

Write phase marker: `echo "phase5-complete" > /workspace/.pipeline-phase`

### Phase 6: Layout → dispatch **Layout Editor**

Dispatch with depth asset status per overlay scene:

For READY overlay scenes: CUT video, place bg on V1, matte item (fgrSrc+matteSrc) on V3, scene on V2/V4
For FAILED overlay scenes: KEEP video on V0, scene on V4 only
For fullscreen scenes: CUT video, scene on V4
For stacked scenes: KEEP video (bottom portion), scene on V4
```

- [ ] **Step 2: Update phase markers and resume logic**

Renumber: Layout → 6, Animation → 7, Final → 8, Done → 9.

On resume after `phase4-complete`: check for `public/matte/*-fgr.mp4` files — if they exist, skip to Phase 6.

- [ ] **Step 3: Remove generate_background from orchestrator tool lists (if present)**

Ensure `ASSET_TOOL_NAMES` does NOT include `generate_background` or `create_stacked_video`. These tools no longer exist.

- [ ] **Step 4: Commit**

```bash
git add packages/sandbox/src/orchestrator.ts packages/sandbox/src/prompts/orchestrator/system.md
git commit -m "feat: add Phase 5 segmentation polling to orchestrator (no tool calls, just wait)"
```
