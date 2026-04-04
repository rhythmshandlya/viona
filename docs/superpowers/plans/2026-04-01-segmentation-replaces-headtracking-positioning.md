# Segmentation Replaces Head-Tracking for Speaker Positioning

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace head-tracking-based speaker positioning with matte-derived full-body bbox from segmentation, and request segmentation for ALL overlay scenes (not just depth-vocabulary scenes).

**Architecture:** The orchestrator requests segmentation for every overlay scene after plan approval. The Layout Editor waits for segmentation to complete before calling `get_speaker_position`, which now reads matte bbox as the primary source. Head-tracking remains only for shot boundary detection — `speaker-grid.json` is no longer written to the workspace.

**Tech Stack:** Python (segment_person.py), TypeScript (MCP asset-server, orchestrator, prompts)

---

## Current State

**What exists:**
- `get_speaker_position` reads `speaker-grid.json` (head-tracking face landmarks) as primary source
- Matte bbox is secondary/override — only used when matte files happen to exist in `public/matte/`
- Orchestrator requests segmentation only for overlay scenes with depth vocabulary
- Layout Editor calls `get_speaker_position` immediately (no wait for segmentation)
- `workspace-init.ts` writes `speaker-grid.json` from head-tracking data

**What's wrong:**
- Head-tracking gives face+shoulder landmarks — misses arms, hair, torso → bad `VISIBLE_ZONES`
- Overlay animations consistently misalign with the speaker body
- Segmentation only requested for depth-vocabulary scenes, so most overlays never get matte bbox
- Even when matte exists, timing is wrong — Layout Editor calls `get_speaker_position` before mattes are ready

**What changes:**
1. Orchestrator requests segmentation for ALL overlay scenes (not just depth vocabulary)
2. Layout Editor waits for segmentation to complete before calling `get_speaker_position`
3. `get_speaker_position` requires matte bbox — fails gracefully with defaults if missing
4. `speaker-grid.json` no longer written to workspace (head-tracking only used for shots)
5. Orchestrator prompt restructured: segmentation moves earlier, check_status moves to before Layout Editor

---

### Task 1: Update orchestrator prompt — segment ALL overlay scenes

The orchestrator currently only requests segmentation for scenes with depth vocabulary. Change it to segment ALL overlay scenes, since every overlay needs accurate speaker positioning.

**Files:**
- Modify: `packages/sandbox/src/prompts/orchestrator/system.md`

- [ ] **Step 1: Replace the "After plan approval" segmentation section (lines 161-176)**

Replace:
```markdown
#### After plan approval: Request segmentation (if needed)

After the user approves the scene plan and BEFORE dispatching the Setup Agent:

1. Read `docs/SCENE_PLAN.md` and identify overlay scenes whose animation brief uses depth vocabulary (emerge-behind, peek-sides, cascade-behind, weave-through, split-depth, background-fill, depth-lower-third, flank, radial-from-speaker, parallax-offset, depth-reveal).
2. If any depth scenes exist, call `request_segmentation` with the time ranges of those scenes:
   ```
   request_segmentation({
     ranges: [
       { startMs: 15000, endMs: 25000, sceneId: "scene-2" },
       { startMs: 45000, endMs: 55000, sceneId: "scene-5" },
     ]
   })
   ```
3. This is non-blocking — the worker starts GPU matting in the background. Continue immediately to Phase 4.
4. If NO overlay scenes use depth vocabulary, skip this step entirely.
```

With:
```markdown
#### After plan approval: Request segmentation for overlay scenes

After the user approves the scene plan and BEFORE dispatching the Setup Agent:

1. Read `docs/SCENE_PLAN.md` and collect ALL overlay scenes (display mode: Overlay).
2. Call `request_segmentation` with the time ranges of every overlay scene:
   ```
   request_segmentation({
     ranges: [
       { startMs: 0, endMs: 6300, sceneId: "scene-1" },
       { startMs: 21020, endMs: 28760, sceneId: "scene-4" },
       { startMs: 35200, endMs: 41260, sceneId: "scene-6" },
     ]
   })
   ```
3. This is non-blocking — the worker starts GPU matting in the background. Continue immediately to Phase 4.
4. If the video has NO overlay scenes (all stacked/fullscreen), skip this step.

**Why every overlay:** The segmentation matte provides accurate full-body speaker bounds (shoulders, arms, hair, torso) for overlay positioning. Without it, animations misalign with the speaker. Depth-vocabulary scenes also need the matte for compositing — but ALL overlays need the bbox for positioning.
```

- [ ] **Step 2: Move segmentation check from Phase 7 to before Phase 5 (Layout Editor)**

The Layout Editor needs matte bbox data before calling `get_speaker_position`. Move the check_segmentation_status call from Phase 7 (Final Assembly) to before Phase 5 (Layout Editor).

Find the Phase 7 section (line 219):
```markdown
**Before dispatching Final Editor:** If segmentation was requested in Phase 3, call `check_segmentation_status` to verify mattes are ready. If any are still processing, wait up to 30 seconds (poll every 5 seconds). If they fail, note the failure — the Final Editor will render those scenes without depth compositing (graceful degradation).
```

Replace with:
```markdown
**Before dispatching Final Editor:** Proceed directly — segmentation was already verified before the Layout Editor.
```

Then find the Phase 5 section (line 186, before "Report progress: `{ phase: "layout"...`"). Add BEFORE the Layout Editor dispatch:
```markdown
**Before dispatching Layout Editor:** If segmentation was requested after plan approval, call `check_segmentation_status` to verify mattes and bbox data are ready. If any are still processing, wait up to 60 seconds (poll every 10 seconds). The Layout Editor needs matte-derived speaker bounds for accurate overlay positioning. If segmentation fails, the Layout Editor will use default center-screen speaker bounds (less accurate but functional).
```

- [ ] **Step 3: Commit**

```bash
git add packages/sandbox/src/prompts/orchestrator/system.md
git commit -m "feat(prompts): segment all overlay scenes, check status before layout editor"
```

---

### Task 2: Stop writing speaker-grid.json to workspace

Head-tracking data is no longer needed for speaker positioning. It stays in the DB for shot boundary detection only. Remove the workspace file write.

**Files:**
- Modify: `packages/sandbox/src/workspace-init.ts`

- [ ] **Step 1: Find and remove the speaker-grid.json write**

Search for `speaker-grid` in `workspace-init.ts`. Find the block that writes head-tracking data to `docs/speaker-grid.json` and remove it. It looks like:

```typescript
if (payload.headTracking) {
  await writeFile(
    join(baseDir, 'docs', 'speaker-grid.json'),
    JSON.stringify(payload.headTracking, null, 2),
  );
}
```

Remove this entire block. The head-tracking data stays in the DB — `get_shot_boundaries` reads it from its own source, not from this file.

- [ ] **Step 2: Verify get_shot_boundaries doesn't read speaker-grid.json**

Search in `packages/mcp-servers/src/asset-server.ts` for `shot-boundaries` and `speaker-grid`. Confirm `get_shot_boundaries` reads from `docs/shot-boundaries.json` (which is written separately by workspace-init from the `shots` array), NOT from `speaker-grid.json`. If it reads from `speaker-grid.json`, update it to read from `shot-boundaries.json` instead.

- [ ] **Step 3: Update the workspace CLAUDE.md to remove speaker-grid reference**

In `packages/sandbox/template/.claude/CLAUDE.md`, the workspace layout section lists `speaker-grid.json`. Remove that line:
```
  speaker-grid.json              # Head-tracking data (access via get_speaker_position tool, not directly)
```

- [ ] **Step 4: Commit**

```bash
git add packages/sandbox/src/workspace-init.ts packages/sandbox/template/.claude/CLAUDE.md
git commit -m "feat(sandbox): stop writing speaker-grid.json, head-tracking only for shot detection"
```

---

### Task 3: Rewrite get_speaker_position to require matte bbox

The tool currently treats matte bbox as an optional override on top of head-tracking. Invert this: matte bbox is the primary (and only) source for speaker bounds. Head-tracking face detection is removed entirely. When no matte bbox exists, return defaults.

**Files:**
- Modify: `packages/mcp-servers/src/asset-server.ts` (the `get_speaker_position` tool, lines ~753-1112)

- [ ] **Step 1: Remove head-tracking read and face detection logic**

Replace the entire `get_speaker_position` tool implementation. The new version:

1. Reads manifest for canvas size and video item geometry (same as before)
2. Computes cover transform (same as before)
3. Scans `public/matte/` for bbox JSON files matching the time range
4. If matte bbox found: computes speaker bounds, available space, safe placements from matte data
5. If no matte bbox: returns default center-screen bounds

```typescript
server.registerTool(
  "get_speaker_position",
  {
    description:
      "Get the speaker's position on the canvas for a given time range. " +
      "Returns pixel coordinates in canvas space from matte-derived full-body bounds, " +
      "accounting for objectFit:cover and crop transforms. Includes body bounds, " +
      "available space in each direction, and safe placement rects for overlay elements. " +
      "Requires segmentation mattes — call request_segmentation first for overlay scenes.",
    inputSchema: {
      startMs: z.number().describe("Start of time range in milliseconds"),
      endMs: z.number().describe("End of time range in milliseconds"),
    },
  },
  async ({ startMs, endMs }: { startMs: number; endMs: number }) => {
    try {
      // 1. Read manifest for canvas and video geometry
      const manifestPath = path.join(WORKSPACE, "manifest.json");
      const manifest = JSON.parse(await readFile(manifestPath, "utf-8"));
      const canvas = manifest.canvas || { width: 1080, height: 1920 };

      // Find video item active during [startMs, endMs]
      let videoItem: any = null;
      let bestOverlap = 0;
      for (const item of manifest.items || []) {
        if (item.type !== "video") continue;
        const itemStart = item.startMs ?? 0;
        const itemEnd = item.endMs ?? (itemStart + (item.durationMs ?? 0));
        const overlapStart = Math.max(startMs, itemStart);
        const overlapEnd = Math.min(endMs, itemEnd);
        const overlap = overlapEnd - overlapStart;
        if (overlap > bestOverlap) {
          bestOverlap = overlap;
          videoItem = item;
        }
      }

      const vt = videoItem?.transform || {};
      const itemW = typeof vt.width === 'number' ? vt.width : canvas.width;
      const itemH = typeof vt.height === 'number' ? vt.height : canvas.height;
      const itemX = typeof vt.x === 'number' ? vt.x : 0;
      const itemY = typeof vt.y === 'number' ? vt.y : 0;
      const cropX = videoItem?.data?.crop?.x ?? 50;
      const cropY = videoItem?.data?.crop?.y ?? 50;
      const cropScale = videoItem?.data?.crop?.scale ?? 1;

      // Source video dimensions — read from manifest or default
      const srcW = manifest.canvas?.sourceWidth || canvas.width;
      const srcH = manifest.canvas?.sourceHeight || canvas.height;

      // 2. Compute cover transform
      const transform = computeCoverTransform(srcW, srcH, itemW, itemH, cropX, cropY, cropScale);

      // 3. Scan matte bbox files for matching time range
      const matteDir = path.join(WORKSPACE, "public", "matte");
      let matteBbox: MatteBboxData | null = null;
      try {
        const matteFiles = await readdir(matteDir);
        const bboxFiles = matteFiles.filter(f => f.endsWith('-bbox.json'));
        for (const bboxFile of bboxFiles) {
          const data: MatteBboxData = JSON.parse(await readFile(path.join(matteDir, bboxFile), "utf-8"));
          if (data.frames && data.frames.length > 0) {
            const fps = data.fps || 30;
            const firstMs = (data.frames[0].frame / fps) * 1000;
            const lastMs = (data.frames[data.frames.length - 1].frame / fps) * 1000;
            if (firstMs <= endMs && lastMs >= startMs) {
              matteBbox = data;
              break;
            }
          }
        }
      } catch {
        // No matte dir — use defaults
      }

      // 4. Compute speaker bounds
      let boundsTop: number, boundsBottom: number, boundsLeft: number, boundsRight: number;

      if (matteBbox && matteBbox.frames.length > 0) {
        const mFps = matteBbox.fps || 30;
        const matteFrames = matteBbox.frames.filter(mf => {
          const ms = (mf.frame / mFps) * 1000;
          return ms >= startMs && ms <= endMs;
        });

        if (matteFrames.length > 0) {
          // Average matte bbox across frames in range
          let mLeft = 0, mTop = 0, mRight = 0, mBottom = 0;
          for (const mf of matteFrames) {
            mLeft += mf.x * srcW;
            mTop += mf.y * srcH;
            mRight += (mf.x + mf.w) * srcW;
            mBottom += (mf.y + mf.h) * srcH;
          }
          mLeft /= matteFrames.length;
          mTop /= matteFrames.length;
          mRight /= matteFrames.length;
          mBottom /= matteFrames.length;

          const topLeftCanvas = sourceToCanvas(mLeft, mTop, transform, itemX, itemY);
          const bottomRightCanvas = sourceToCanvas(mRight, mBottom, transform, itemX, itemY);

          boundsLeft = Math.max(0, Math.round(Math.min(topLeftCanvas.x, bottomRightCanvas.x)));
          boundsTop = Math.max(0, Math.round(Math.min(topLeftCanvas.y, bottomRightCanvas.y)));
          boundsRight = Math.min(canvas.width, Math.round(Math.max(topLeftCanvas.x, bottomRightCanvas.x)));
          boundsBottom = Math.min(canvas.height, Math.round(Math.max(topLeftCanvas.y, bottomRightCanvas.y)));
        } else {
          // Matte file exists but no frames in range — use defaults
          boundsLeft = Math.round(canvas.width * 0.25);
          boundsTop = Math.round(canvas.height * 0.05);
          boundsRight = Math.round(canvas.width * 0.75);
          boundsBottom = Math.round(canvas.height * 0.90);
        }
      } else {
        // No matte data — use defaults (generous center-screen bounds)
        boundsLeft = Math.round(canvas.width * 0.25);
        boundsTop = Math.round(canvas.height * 0.05);
        boundsRight = Math.round(canvas.width * 0.75);
        boundsBottom = Math.round(canvas.height * 0.90);
      }

      // 5. Compute available space (20px margin)
      const margin = 20;
      const availableSpace = {
        above: { from: 0, to: Math.max(0, boundsTop - margin), height: Math.max(0, boundsTop - margin) },
        below: { from: Math.min(canvas.height, boundsBottom + margin), to: canvas.height, height: Math.max(0, canvas.height - boundsBottom - margin) },
        left: { from: 0, to: Math.max(0, boundsLeft - margin), width: Math.max(0, boundsLeft - margin) },
        right: { from: Math.min(canvas.width, boundsRight + margin), to: canvas.width, width: Math.max(0, canvas.width - boundsRight - margin) },
      };

      // 6. Generate safe placements
      const safePlacements: Array<{ name: string; rect: { x: number; y: number; width: number; height: number } }> = [];
      const minDimPct = 0.10;
      if (availableSpace.above.height > canvas.height * minDimPct) {
        safePlacements.push({ name: "top-strip", rect: { x: 0, y: 0, width: canvas.width, height: availableSpace.above.to } });
      }
      if (availableSpace.below.height > canvas.height * minDimPct) {
        safePlacements.push({ name: "lower-third", rect: { x: 0, y: availableSpace.below.from, width: canvas.width, height: availableSpace.below.height } });
      }
      if (availableSpace.left.width > canvas.width * minDimPct) {
        safePlacements.push({ name: "left-panel", rect: { x: 0, y: 0, width: availableSpace.left.to, height: canvas.height } });
      }
      if (availableSpace.right.width > canvas.width * minDimPct) {
        safePlacements.push({ name: "right-panel", rect: { x: availableSpace.right.from, y: 0, width: availableSpace.right.width, height: canvas.height } });
      }
      if (safePlacements.length === 0) {
        safePlacements.push({ name: "top-strip-tight", rect: { x: 0, y: 0, width: canvas.width, height: Math.max(50, boundsTop) } });
      }

      // 7. Compute speaker center (midpoint of bounds)
      const centerX = Math.round((boundsLeft + boundsRight) / 2);
      const centerY = Math.round((boundsTop + boundsBottom) / 2);

      const result = {
        canvas,
        videoTransform: {
          sourceSize: { width: srcW, height: srcH },
          coverScale: transform.baseCoverScale,
          crop: { x: cropX, y: cropY, scale: cropScale },
        },
        speaker: {
          bounds: { top: boundsTop, bottom: boundsBottom, left: boundsLeft, right: boundsRight },
          center: { x: centerX, y: centerY },
        },
        availableSpace,
        safePlacements,
        source: matteBbox ? 'matte' as const : 'defaults' as const,
      };

      return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Error getting speaker position: ${errorMessage(err)}` }],
        isError: true,
      };
    }
  }
);
```

- [ ] **Step 2: Remove unused types and the old head-tracking reading code**

Remove these types that are no longer used:
- `HeadTrackingFrame`
- `HeadTrackingData`
- `FaceBbox`

Keep `MatteBboxFrame` and `MatteBboxData` — they're still used.

Remove the `SpeakerPositionResult` interface — the new return shape is simpler (no `face`, `shoulderLine`, `hands`, `movement` fields).

- [ ] **Step 3: Remove the readFile import of speaker-grid.json**

Search for any remaining references to `speaker-grid` in `asset-server.ts` and remove them. The tool no longer reads from this file.

- [ ] **Step 4: Commit**

```bash
git add packages/mcp-servers/src/asset-server.ts
git commit -m "feat(mcp): rewrite get_speaker_position to use matte bbox, remove head-tracking dependency"
```

---

### Task 4: Update Layout Editor prompt for new speaker position flow

The Layout Editor prompt currently tells the agent to call `get_speaker_position` immediately after placing scene items. Now it should know that matte data is already available (orchestrator waited for segmentation before dispatching Layout Editor).

**Files:**
- Modify: `packages/sandbox/src/prompts/layout-editor/system.md`

- [ ] **Step 1: Update the speaker spatial data section (lines 149-192)**

Find the section starting `#### Speaker spatial data (REQUIRED on every scene item)` (line 149).

Replace lines 149-192 with:

```markdown
#### Speaker spatial data (REQUIRED on every overlay scene item)

After creating each **overlay** scene item, call `get_speaker_position` with the scene's `{ startMs, endMs }` to get the speaker's full-body position during that time range. Segmentation mattes are already available in the workspace (the orchestrator requested them before dispatching you). Add the returned data to the scene item's `data` field:

```
// For each OVERLAY scene item:
const pos = get_speaker_position({ startMs: 15000, endMs: 25000 });

update_item({
  itemId: "scene-1",
  data: {
    ...existingData,
    speakerBbox: { x: 0.28, y: 0.10, w: 0.44, h: 0.75 },   // normalized 0-1 from pos.speaker.bounds
    speakerCenter: { x: 0.50, y: 0.45 },                       // normalized center
    visibleZones: {                                              // areas NOT behind speaker
      left:   { x: 0, y: 0, w: 0.28, h: 1.0 },
      right:  { x: 0.72, y: 0, w: 0.28, h: 1.0 },
      top:    { x: 0, y: 0, w: 1.0, h: 0.10 },
      bottom: { x: 0, y: 0.85, w: 1.0, h: 0.15 }
    }
  }
})
```

Normalize values to 0-1 range. `get_speaker_position` returns `speaker.bounds` as `{ top, bottom, left, right }` in **pixel coordinates**. Convert with:
```
x = bounds.left / canvasWidth
y = bounds.top / canvasHeight
w = (bounds.right - bounds.left) / canvasWidth
h = (bounds.bottom - bounds.top) / canvasHeight
center.x = speaker.center.x / canvasWidth
center.y = speaker.center.y / canvasHeight
```

If `get_speaker_position` returns `source: "defaults"` (no matte data), the bounds are approximate. Use them as-is — they default to a generous center-screen speaker region.

**Stacked and Fullscreen scenes:** Do NOT call `get_speaker_position` or add speaker data. These modes don't use overlay positioning.
```

- [ ] **Step 2: Commit**

```bash
git add packages/sandbox/src/prompts/layout-editor/system.md
git commit -m "feat(prompts): update layout editor for matte-based speaker positioning"
```

---

### Task 5: Update Setup Agent prompt — remove get_speaker_position references

The Setup Agent reads speaker data from the manifest (written by Layout Editor). It doesn't call `get_speaker_position` directly. But the prompt may reference the old tool or speaker-grid.json. Clean up any stale references.

**Files:**
- Modify: `packages/sandbox/src/prompts/setup-agent/system.md`

- [ ] **Step 1: Verify and update speaker data instructions**

The Setup Agent prompt at line 155 says: "The manifest's scene items include speaker spatial data (added by the Layout Editor)." This is still correct — no change needed to the SPEAKER/VISIBLE_ZONES constant generation.

Check for any references to `speaker-grid.json` or `head-tracking` or `face detection` in the Setup Agent prompt and remove them. The prompt should only reference reading speaker data from manifest scene items.

- [ ] **Step 2: Commit (if changes were needed)**

```bash
git add packages/sandbox/src/prompts/setup-agent/system.md
git commit -m "feat(prompts): clean up setup agent speaker positioning references"
```

---

### Task 6: Update Animator prompt — simplify speaker positioning language

The Animator prompt references `face`, `shoulderLine`, and specific face-based calculations. With matte-derived bounds, the speaker position is the full-body silhouette — no face-specific data.

**Files:**
- Modify: `packages/sandbox/src/prompts/animator/system.md`
- Modify: `packages/sandbox/src/prompts/animator/reminder.md`

- [ ] **Step 1: Update the overlay positioning section in animator/system.md**

Find lines 383-432 (the overlay skeleton section about SPEAKER constants). Update to reflect that SPEAKER.bboxPx is the full body silhouette, not just face+shoulders:

Replace references to face-based positioning:
- `SPEAKER.bboxPx.y + SPEAKER.bboxPx.h * 0.3` (chest height) → keep as-is, this is still valid for the body silhouette
- `SPEAKER.centerPx` as "face center" → change to "body center" — it's now the midpoint of the full body bbox
- Any references to `shoulderLine` → remove (no longer in the data)

Specifically at line 395, change:
```
- Use `SPEAKER.centerPx` as the origin for radial/burst effects behind the speaker
```
to:
```
- Use `SPEAKER.centerPx` as the origin for radial/burst effects behind the speaker (center of full body silhouette)
```

- [ ] **Step 2: Verify reminder.md**

In `packages/sandbox/src/prompts/animator/reminder.md`, line 45 says:
```
- Behind-speaker elements should PEEK from edges of SPEAKER.bboxPx — don't center behind the face.
```
Change to:
```
- Behind-speaker elements should PEEK from edges of SPEAKER.bboxPx — the full body silhouette, not just the face.
```

- [ ] **Step 3: Commit**

```bash
git add packages/sandbox/src/prompts/animator/system.md packages/sandbox/src/prompts/animator/reminder.md
git commit -m "feat(prompts): update animator for matte-derived full-body speaker bounds"
```

---

### Task 7: Update workspace CLAUDE.md — remove speaker-grid reference

The sandbox workspace CLAUDE.md documents the workspace layout and tools. Update it to reflect the new speaker positioning flow.

**Files:**
- Modify: `packages/sandbox/template/.claude/CLAUDE.md`

- [ ] **Step 1: Update Video Positioning section**

Find the "Video Positioning" section at the bottom of the file. Replace:
```markdown
- `get_speaker_position` returns the speaker's exact canvas-space coordinates for a time range. Use this when placing overlay elements — it accounts for the cover crop transform and returns concrete `safePlacements` rects.
- Do NOT read `speaker-grid.json` directly — use the tool instead.
```

With:
```markdown
- `get_speaker_position` returns the speaker's full-body canvas-space coordinates for a time range, derived from segmentation matte data. Use this when placing overlay elements — it accounts for the cover crop transform and returns concrete `safePlacements` rects.
- Speaker position data comes from segmentation mattes in `public/matte/` — do NOT read these files directly, use the tool.
```

- [ ] **Step 2: Commit**

```bash
git add packages/sandbox/template/.claude/CLAUDE.md
git commit -m "feat(docs): update workspace CLAUDE.md for matte-based speaker positioning"
```

---

## Task Dependency Order

```
Task 1 (orchestrator prompt) ─┐
Task 2 (remove speaker-grid)  ├─ Independent, can run in parallel
Task 7 (workspace CLAUDE.md)  ┘
          │
Task 3 (rewrite get_speaker_position) ← depends on understanding Task 2's removal
          │
Task 4 (layout editor prompt) ← depends on Task 3's new return shape
Task 5 (setup agent prompt)   ← independent, just cleanup
Task 6 (animator prompt)      ← depends on Task 3's new return shape
```

**Recommended batches:**
- **Batch A**: Tasks 1, 2, 7 (prompt + config changes, no code dependencies)
- **Batch B**: Task 3 (core tool rewrite)
- **Batch C**: Tasks 4, 5, 6 (downstream prompt updates)
