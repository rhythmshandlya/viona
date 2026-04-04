# Depth Pipeline Audit Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all 16 issues found in the depth compositing pipeline audit — wrong track positions, missing types, misleading paths, contradictory docs, stale tool output.

**Architecture:** All changes are prompt text, tool output strings, and type annotations. No new files, no new features. Each task touches 1-2 files with surgical edits.

**Tech Stack:** TypeScript (MCP asset-server, orchestrator), Markdown (prompts), XML (manifest-tools)

---

## File Map

| File | Changes |
|---|---|
| `packages/mcp-servers/src/asset-server.ts` | Fix `get_depth_compositing_info` track positions + fgr filter + add fgr/bg paths; fix `request_segmentation` mattePaths; fix `auto_center_speaker` variable naming; type `allSceneIds` properly |
| `packages/sandbox/src/prompts/layout-editor/system.md` | Replace hardcoded `trk-V1`/`trk-V3` in examples; clarify audio split wording; expand V2 depth term mapping |
| `packages/sandbox/src/prompts/layout-editor/reminder.md` | Align audio wording with system.md fix |
| `packages/sandbox/src/prompts/shared/manifest-tools.xml` | Add `matte` to `add_item` type list; remove `update_manifest`; add `generate_captions`, `ripple_delete` |
| `packages/sandbox/src/orchestrator.ts` | Expand Layout Editor `criticalSystemReminder`; add `auto_center_speaker` to `TOOL_DISPLAY_NAMES`; fix orchestrator prompt depthAssets example to use shared primary scene paths |
| `packages/sandbox/src/prompts/orchestrator/system.md` | Fix depthAssets example to show shared matte paths; add Phase 5 bg image verification |

---

### Task 1: Fix `get_depth_compositing_info` — wrong track positions, fgr phantom scenes, missing paths

**Files:**
- Modify: `packages/mcp-servers/src/asset-server.ts:1195` (fgr filter), `:1220-1240` (track positions + fgr/bg paths)

This fixes audit issues #1 (wrong positions), #4 (phantom fgr scenes), #5 (missing fgr/bg info).

- [ ] **Step 1: Fix the `.mp4` filter to exclude `-fgr.mp4` files**

In `packages/mcp-servers/src/asset-server.ts`, find line 1195:
```typescript
        matteFiles = entries.filter(f => f.endsWith(".mp4"));
```

Replace with:
```typescript
        matteFiles = entries.filter(f => f.endsWith(".mp4") && !f.endsWith("-fgr.mp4"));
```

- [ ] **Step 2: Update scene objects to include fgr and bg paths**

Find lines 1203-1210:
```typescript
      const scenes = matteFiles.map(f => {
        const sceneId = f.replace(".mp4", "");
        return {
          sceneId,
          mattePath: `public/matte/${f}`,
          staticFile: `matte/${f}`,
        };
      });
```

Replace with:
```typescript
      const scenes = matteFiles.map(f => {
        const sceneId = f.replace(".mp4", "");
        const hasFgr = entries.includes(`${sceneId}-fgr.mp4`);
        return {
          sceneId,
          mattePath: `public/matte/${f}`,
          staticFile: `matte/${f}`,
          fgrPath: hasFgr ? `public/matte/${sceneId}-fgr.mp4` : null,
          fgrStaticFile: hasFgr ? `matte/${sceneId}-fgr.mp4` : null,
          bgPath: `public/bg-${sceneId}.png`,
          bgStaticFile: `bg-${sceneId}.png`,
        };
      });
```

- [ ] **Step 3: Fix the compositing technique track positions**

Find lines 1220-1239:
```typescript
            techniques: matteFiles.length > 0 ? {
              behindSpeaker: {
                description: "Place graphics behind the speaker using the person track's alpha matte compositing.",
                usage: [
                  "1. The person track automatically handles matte compositing — no manual setup needed.",
                  "2. Place behind-speaker animations on the scene-bg track (position 1).",
                  "3. Place in-front-of-speaker animations on the scene-fg track (position 3).",
                  "4. The person matte layer (position 2) composites the speaker between the two.",
                  "5. Use SPEAKER.bboxPx and VISIBLE_ZONES constants for spatial positioning.",
                ],
              },
              depthParallax: {
                description: "Create depth-of-field parallax with foreground/background separation.",
                usage: [
                  "1. Render background elements on scene-bg with slower parallax speed.",
                  "2. The person matte layer provides the natural depth separator.",
                  "3. Add foreground elements on scene-fg for additional depth layering.",
                ],
              },
            } : null,
```

Replace with:
```typescript
            techniques: matteFiles.length > 0 ? {
              behindSpeaker: {
                description: "Place graphics behind the speaker using the matte compositing stack.",
                usage: [
                  "1. V1 (position 1): Clean background image — replaces source video behind everything.",
                  "2. V2 (position 2): Behind-speaker animations — rendered between bg and matte.",
                  "3. V3 (position 3): Matte item (fgr + alpha) — composites the speaker cutout.",
                  "4. V4 (position 4): In-front-of-speaker animations — rendered on top of speaker.",
                  "5. Use SPEAKER.bboxPx and VISIBLE_ZONES constants for spatial positioning.",
                ],
              },
              depthParallax: {
                description: "Create depth-of-field parallax with foreground/background separation.",
                usage: [
                  "1. Place background elements on V2 (position 2) with slower parallax speed.",
                  "2. The matte on V3 (position 3) provides the natural depth separator.",
                  "3. Add foreground elements on V4 (position 4) for additional depth layering.",
                ],
              },
            } : null,
```

- [ ] **Step 4: Commit**

```bash
git add packages/mcp-servers/src/asset-server.ts
git commit -m "fix(asset-server): correct track positions, exclude fgr phantoms, add fgr/bg paths in get_depth_compositing_info"
```

---

### Task 2: Add `matte` to `manifest-tools.xml` and fix stale tool docs

**Files:**
- Modify: `packages/sandbox/src/prompts/shared/manifest-tools.xml`

This fixes audit issues #2 (missing matte type), #14 (stale update_manifest), #15 (undocumented tools).

- [ ] **Step 1: Update `manifest-tools.xml`**

Replace the full contents of `packages/sandbox/src/prompts/shared/manifest-tools.xml` with:

```xml
<tools>
## Manifest Tools (mcp__manifest__*)
- read_manifest — Read timeline state. ALWAYS read before editing.
- read_item — Read a single item by ID.
- add_track — Add a new track (video, audio, overlay, caption).
- update_track — Update track properties.
- remove_track — Remove a track and all its items.
- add_item — Add a new item (video, audio, text, image, scene, caption, shape, matte).
- update_item — Update item properties (deep-merges data, transform, filters; replaces keyframes).
- remove_item — Remove an item by ID.
- split_item — Split a video/audio item at a timestamp.
- update_caption_preset — Update global caption preset (font, colors, animation, position, effects).
- generate_captions — Generate captions from transcript and add to timeline.
- ripple_delete — Delete an item and close the gap by shifting later items.

## Scene Tools (mcp__scenes__*)
- write_scene_file — Write a .tsx scene file.
- delete_scene_file — Delete a scene file.

## Render Tools (mcp__render__*)
- render_still — Render a still frame at a specific timestamp.
- trigger_rebuild — Trigger esbuild rebuild after code changes.

## Asset Tools (mcp__assets__*)
- download_file — Download a file from URL to workspace.
- search_unsplash / search_pexels — Search stock photos.
- download_stock_photo — Download stock photo to /workspace/public/assets/.
- get_speaker_position — Get speaker canvas-space position for a time range.
- auto_center_speaker — Set optimal video crop to center the speaker's face.

## Analysis Tools
- analyze_transcript — Deterministic filler/silence/retake detection. Returns structured analysis.
- validate_timeline — Programmatic manifest integrity check. Returns pass/fail with issues.
</tools>
```

- [ ] **Step 2: Commit**

```bash
git add packages/sandbox/src/prompts/shared/manifest-tools.xml
git commit -m "fix(prompts): add matte type, generate_captions, ripple_delete to manifest-tools.xml; remove stale update_manifest"
```

---

### Task 3: Fix hardcoded track IDs in layout-editor examples

**Files:**
- Modify: `packages/sandbox/src/prompts/layout-editor/system.md:109-141`

This fixes audit issue #3.

- [ ] **Step 1: Replace the V1 background plate example**

In `packages/sandbox/src/prompts/layout-editor/system.md`, find lines 108-121:
```
**V1 — Background plate:**
```
add_item({
  trackId: "trk-V1", type: "image",
  startMs: sceneStartMs, endMs: sceneEndMs,
  transform: { x: 0, y: 0, width: CANVAS_W, height: CANVAS_H, opacity: 1 },
  keyframes: [
    { timeMs: 0, props: { opacity: 0 } },
    { timeMs: 300, props: { opacity: 1 } },
    { timeMs: sceneDuration - 300, props: { opacity: 1 } },
    { timeMs: sceneDuration, props: { opacity: 0 } },
  ],
  data: { src: depthAssets[sceneId].background }
})
```
```

Replace with:
```
**V1 — Background plate:**
```
add_item({
  trackId: v1TrackId, type: "image",   // v1TrackId from add_track Step 2
  startMs: sceneStartMs, endMs: sceneEndMs,
  transform: { x: 0, y: 0, width: CANVAS_W, height: CANVAS_H, opacity: 1 },
  keyframes: [
    { timeMs: 0, props: { opacity: 0 } },
    { timeMs: 300, props: { opacity: 1 } },
    { timeMs: sceneDuration - 300, props: { opacity: 1 } },
    { timeMs: sceneDuration, props: { opacity: 0 } },
  ],
  data: { src: depthAssets[sceneId].background }
})
```
```

- [ ] **Step 2: Replace the V3 matte example**

Find lines 124-141:
```
**V3 — Person matte:**
```
add_item({
  trackId: "trk-V3", type: "matte",
  startMs: sceneStartMs, endMs: sceneEndMs,
  transform: { x: 0, y: 0, width: CANVAS_W, height: CANVAS_H, opacity: 1 },
  keyframes: [
    { timeMs: 0, props: { opacity: 0 } },
    { timeMs: 300, props: { opacity: 1 } },
    { timeMs: sceneDuration - 300, props: { opacity: 1 } },
    { timeMs: sceneDuration, props: { opacity: 0 } },
  ],
  data: {
    fgrSrc: depthAssets[sceneId].fgrVideo,
    matteSrc: depthAssets[sceneId].matteVideo,
    startFrom: sceneStartMs
  }
})
```
```

Replace with:
```
**V3 — Person matte:**
```
add_item({
  trackId: v3TrackId, type: "matte",   // v3TrackId from add_track Step 2
  startMs: sceneStartMs, endMs: sceneEndMs,
  transform: { x: 0, y: 0, width: CANVAS_W, height: CANVAS_H, opacity: 1 },
  keyframes: [
    { timeMs: 0, props: { opacity: 0 } },
    { timeMs: 300, props: { opacity: 1 } },
    { timeMs: sceneDuration - 300, props: { opacity: 1 } },
    { timeMs: sceneDuration, props: { opacity: 0 } },
  ],
  data: {
    fgrSrc: depthAssets[sceneId].fgrVideo,
    matteSrc: depthAssets[sceneId].matteVideo,
    startFrom: sceneStartMs
  }
})
```
```

- [ ] **Step 3: Commit**

```bash
git add packages/sandbox/src/prompts/layout-editor/system.md
git commit -m "fix(layout-editor): replace hardcoded trk-V1/trk-V3 with variable references in examples"
```

---

### Task 4: Expand V2 depth term mapping in layout-editor

**Files:**
- Modify: `packages/sandbox/src/prompts/layout-editor/system.md:78`
- Modify: `packages/sandbox/src/prompts/layout-editor/reminder.md:27`

This fixes audit issue #5 — planner depth terms `weave-through`, `split-depth`, `depth-reveal`, `flank`, `radial-from-speaker`, `parallax-offset` missing from V2 assignment.

- [ ] **Step 1: Update the V2 assignment rule in system.md**

In `packages/sandbox/src/prompts/layout-editor/system.md`, find line 78:
```
- Overlay scenes with depth briefs (behind, emerge-behind, peek-sides, cascade-behind, background-fill, depth-lower-third) → **V2**
```

Replace with:
```
- Overlay scenes with depth briefs (behind, emerge-behind, peek-sides, cascade-behind, background-fill, depth-lower-third, weave-through, split-depth, depth-reveal, flank, radial-from-speaker, parallax-offset) → **V2**
```

- [ ] **Step 2: Update the reminder.md to match**

In `packages/sandbox/src/prompts/layout-editor/reminder.md`, find line 27:
```
- Depth scenes (brief mentions "behind", "emerge-behind", etc.) go on V2. All other scenes go on V4. Sequential within each track, no overlap.
```

Replace with:
```
- Depth scenes (brief mentions "behind", "emerge-behind", "peek-sides", "cascade-behind", "background-fill", "depth-lower-third", "weave-through", "split-depth", "depth-reveal", "flank", "radial-from-speaker", "parallax-offset") go on V2. All other scenes go on V4. Sequential within each track, no overlap.
```

- [ ] **Step 3: Commit**

```bash
git add packages/sandbox/src/prompts/layout-editor/system.md packages/sandbox/src/prompts/layout-editor/reminder.md
git commit -m "fix(layout-editor): add all planner depth terms to V2 track assignment rule"
```

---

### Task 5: Clarify audio split wording across prompts

**Files:**
- Modify: `packages/sandbox/src/prompts/layout-editor/system.md:27`
- Modify: `packages/sandbox/src/prompts/layout-editor/reminder.md:5`
- Modify: `packages/sandbox/src/orchestrator.ts:413`

This fixes audit issue #6 — "NEVER cut" contradicts "split at same timestamps."

- [ ] **Step 1: Fix the system.md audio rule**

In `packages/sandbox/src/prompts/layout-editor/system.md`, find line 27:
```
- Audio items are NEVER cut or deleted. When splitting video at a boundary, split the paired audio item at the same timestamp to keep them aligned — but never remove audio segments.
```

Replace with:
```
- Audio items are NEVER deleted. When splitting video at a boundary, also `split_item` the paired audio at the same timestamp to keep them aligned — but never `remove_item` audio segments.
```

- [ ] **Step 2: Fix the reminder.md audio rule**

In `packages/sandbox/src/prompts/layout-editor/reminder.md`, find line 5:
```
- Audio is NEVER cut or deleted. Split audio at same timestamps as video to keep alignment.
```

Replace with:
```
- Audio is NEVER deleted. Split audio at same timestamps as video to keep alignment, but never remove audio segments.
```

- [ ] **Step 3: Fix the orchestrator criticalSystemReminder**

In `packages/sandbox/src/orchestrator.ts`, find line 413:
```typescript
          '- CUT video for overlay and fullscreen scenes (remove segments from V0). Audio on A0 is never cut.\n' +
```

Replace with:
```typescript
          '- CUT video for overlay and fullscreen scenes (remove segments from V0). Audio on A0 is never deleted (split to align, but never remove).\n' +
```

- [ ] **Step 4: Commit**

```bash
git add packages/sandbox/src/prompts/layout-editor/system.md packages/sandbox/src/prompts/layout-editor/reminder.md packages/sandbox/src/orchestrator.ts
git commit -m "fix(prompts): clarify audio split vs delete wording — split OK, delete never"
```

---

### Task 6: Fix `request_segmentation` misleading per-scene mattePaths

**Files:**
- Modify: `packages/mcp-servers/src/asset-server.ts:949-956`

This fixes audit issue #7.

- [ ] **Step 1: Fix mattePaths to use primary scene ID**

In `packages/mcp-servers/src/asset-server.ts`, find lines 949-956:
```typescript
      const data = await res.json() as { jobIds: string[]; estimatedDurationMs: number };

      // Build expected matte paths for the caller
      const mattePaths = ranges.map(r => ({
        sceneId: r.sceneId,
        mattePath: `public/matte/${r.sceneId}.mp4`,
        staticFile: `matte/${r.sceneId}.mp4`,
      }));
```

Replace with:
```typescript
      const data = await res.json() as { jobIds: string[]; allSceneIds: string[]; estimatedDurationMs: number };
      const primarySceneId = ranges[0].sceneId;

      // All scenes share the same matte/fgr (full-video pass), only bg images differ per scene
      const mattePaths = ranges.map(r => ({
        sceneId: r.sceneId,
        mattePath: `public/matte/${primarySceneId}.mp4`,
        fgrPath: `public/matte/${primarySceneId}-fgr.mp4`,
        staticFile: `matte/${primarySceneId}.mp4`,
        fgrStaticFile: `matte/${primarySceneId}-fgr.mp4`,
        bgStaticFile: `bg-${r.sceneId}.png`,
      }));
```

- [ ] **Step 2: Commit**

```bash
git add packages/mcp-servers/src/asset-server.ts
git commit -m "fix(asset-server): use primary scene ID for shared matte paths in request_segmentation response"
```

---

### Task 7: Type `allSceneIds` properly in `check_segmentation_status`

**Files:**
- Modify: `packages/mcp-servers/src/asset-server.ts:1019-1030` (type), `:1042` (remove `as any`)

This fixes audit issue #12.

- [ ] **Step 1: Add `allSceneIds` to the response type and remove `as any`**

In `packages/mcp-servers/src/asset-server.ts`, find the type assertion for the status response. It will look like:
```typescript
      const data = await res.json() as {
        jobs: Array<{
          jobId: string;
          status: string;
          progress: number;
          sceneId: string | null;
          outputKey: string | null;
          error: string | null;
        }>;
```

Add `allSceneIds` to the job type:
```typescript
      const data = await res.json() as {
        jobs: Array<{
          jobId: string;
          status: string;
          progress: number;
          sceneId: string | null;
          allSceneIds?: string[];
          outputKey: string | null;
          error: string | null;
        }>;
```

Then find line 1042:
```typescript
          const allSceneIds: string[] = (job as any).allSceneIds ?? [primarySceneId];
```

Replace with:
```typescript
          const allSceneIds: string[] = job.allSceneIds ?? [primarySceneId];
```

- [ ] **Step 2: Commit**

```bash
git add packages/mcp-servers/src/asset-server.ts
git commit -m "fix(asset-server): type allSceneIds properly in check_segmentation_status response"
```

---

### Task 8: Rename `faceCenterX/Y` to `bodyCenterX/Y` in `auto_center_speaker`

**Files:**
- Modify: `packages/mcp-servers/src/asset-server.ts:594-602`

This fixes audit issue #9.

- [ ] **Step 1: Rename the variables**

In `packages/mcp-servers/src/asset-server.ts`, find lines 594-602:
```typescript
      // 3. Compute average body center in source pixels from matte bbox
      let sumX = 0, sumY = 0;
      for (const mf of allBboxFrames) {
        // Matte bbox is normalized 0-1 — convert to source pixels
        sumX += (mf.x + mf.w / 2) * videoW;
        sumY += (mf.y + mf.h / 2) * videoH;
      }
      const faceCenterX = sumX / allBboxFrames.length;
      const faceCenterY = sumY / allBboxFrames.length;
```

Replace with:
```typescript
      // 3. Compute average body center in source pixels from matte bbox
      // Note: matte bbox is full-body, not face-only. The center is ~waist level.
      // computeCenterCrop handles this correctly for cover-crop centering.
      let sumX = 0, sumY = 0;
      for (const mf of allBboxFrames) {
        // Matte bbox is normalized 0-1 — convert to source pixels
        sumX += (mf.x + mf.w / 2) * videoW;
        sumY += (mf.y + mf.h / 2) * videoH;
      }
      const bodyCenterX = sumX / allBboxFrames.length;
      const bodyCenterY = sumY / allBboxFrames.length;
```

Then find the two references to `faceCenterX` and `faceCenterY` in the `computeCenterCrop` call (should be a few lines below, around line 615):
```typescript
        const crop = computeCenterCrop(
          faceCenterX, faceCenterY,
          videoW, videoH,
          itemW, itemH,
        );
```

Replace with:
```typescript
        const crop = computeCenterCrop(
          bodyCenterX, bodyCenterY,
          videoW, videoH,
          itemW, itemH,
        );
```

- [ ] **Step 2: Commit**

```bash
git add packages/mcp-servers/src/asset-server.ts
git commit -m "fix(asset-server): rename faceCenterX/Y to bodyCenterX/Y — matte bbox is full-body not face"
```

---

### Task 9: Expand Layout Editor `criticalSystemReminder` in orchestrator

**Files:**
- Modify: `packages/sandbox/src/orchestrator.ts:409-418`

This fixes audit issue #10 — the reminder is incomplete vs the full system prompt.

- [ ] **Step 1: Replace the criticalSystemReminder block**

In `packages/sandbox/src/orchestrator.ts`, find lines 409-418:
```typescript
        criticalSystemReminder_EXPERIMENTAL:
          'CRITICAL RULES:\n' +
          '- Use Read tool before editing any file. Use Edit for targeted changes, Write only for new files.\n' +
          '- Use Glob/Grep instead of find/grep via Bash.\n' +
          '- CUT video for overlay and fullscreen scenes (remove segments from V0). Audio on A0 is never cut.\n' +
          '- For ready overlays: bg image on V1, matte item (fgrSrc + matteSrc) on V3, animation on V2/V4.\n' +
          '- Keyframe format: { timeMs, props: {...} } — NEVER flat { timeMs, opacity }.\n' +
          '- timeMs is RELATIVE to the item\'s own startMs, not the absolute timeline.\n' +
          '- Scene items MUST have data.sceneFile (.tsx), data.displayMode, data.sceneName.\n' +
          '- ALWAYS read_manifest before and after major operations to verify state.',
```

Replace with:
```typescript
        criticalSystemReminder_EXPERIMENTAL:
          'CRITICAL RULES:\n' +
          '- Use Read tool before editing any file. Use Edit for targeted changes, Write only for new files.\n' +
          '- Use Glob/Grep instead of find/grep via Bash.\n' +
          '- CUT video for overlay (READY) and fullscreen scenes (remove V0 segments). KEEP V0 for stacked and FAILED overlay.\n' +
          '- Audio on A0 is never deleted. Split audio at same timestamps as video, but never remove audio segments.\n' +
          '- For READY overlays: bg image on V1, matte item (fgrSrc + matteSrc) on V3, animation on V2 or V4.\n' +
          '- Track IDs are UUIDs returned by add_track — do NOT hardcode IDs like trk-V1.\n' +
          '- Call auto_center_speaker ONCE after all V0 cuts. Call get_speaker_position per overlay scene.\n' +
          '- All transitions: 300ms synchronized opacity fades across layers.\n' +
          '- Keyframe format: { timeMs, props: {...} } — NEVER flat { timeMs, opacity }.\n' +
          '- timeMs is RELATIVE to the item\'s own startMs, not the absolute timeline.\n' +
          '- Scene keyframes must ONLY animate opacity — NEVER x, y, width, height, rotation.\n' +
          '- Scene items MUST have data.sceneFile (.tsx), data.displayMode, data.sceneName.\n' +
          '- ALWAYS read_manifest before and after major operations to verify state.',
```

- [ ] **Step 2: Commit**

```bash
git add packages/sandbox/src/orchestrator.ts
git commit -m "fix(orchestrator): expand Layout Editor criticalSystemReminder with missing depth rules"
```

---

### Task 10: Add missing `TOOL_DISPLAY_NAMES` entry

**Files:**
- Modify: `packages/sandbox/src/orchestrator.ts:196-199`

This fixes audit issue #16.

- [ ] **Step 1: Add `auto_center_speaker` to TOOL_DISPLAY_NAMES**

In `packages/sandbox/src/orchestrator.ts`, find lines 196-199:
```typescript
  get_speaker_position: 'Analyzing speaker position',
  request_segmentation: 'Requesting speaker segmentation',
  check_segmentation_status: 'Checking segmentation status',
  get_depth_compositing_info: 'Checking depth compositing info',
```

Replace with:
```typescript
  get_speaker_position: 'Analyzing speaker position',
  auto_center_speaker: 'Centering speaker in frame',
  request_segmentation: 'Requesting speaker segmentation',
  check_segmentation_status: 'Checking segmentation status',
  get_depth_compositing_info: 'Checking depth compositing info',
```

- [ ] **Step 2: Commit**

```bash
git add packages/sandbox/src/orchestrator.ts
git commit -m "fix(orchestrator): add auto_center_speaker to TOOL_DISPLAY_NAMES"
```

---

### Task 11: Fix orchestrator prompt depthAssets example and Phase 5 resume logic

**Files:**
- Modify: `packages/sandbox/src/prompts/orchestrator/system.md:200-228`

This fixes audit issues #7 (depthAssets example shows per-scene matte paths) and #11 (Phase 5 resume skips without verifying bg images).

- [ ] **Step 1: Fix the file paths documentation**

In `packages/sandbox/src/prompts/orchestrator/system.md`, find lines 200-204:
```markdown
The worker segmentation job (triggered after plan approval in Phase 3) produces ALL depth assets in a single pass. When `check_segmentation_status` reports completion, files are automatically downloaded to `/workspace/public/`:
- `public/matte/{sceneId}.mp4` — grayscale alpha matte
- `public/matte/{sceneId}-fgr.mp4` — clean foreground video (premultiplied speaker pixels, transparent where no speaker)
- `public/matte/{sceneId}-bbox.json` — per-frame normalized bounding boxes
- `public/bg-{sceneId}.png` — clean background image (speaker inpainted out via OpenAI)
```

Replace with:
```markdown
The worker segmentation job (triggered after plan approval in Phase 3) produces ALL depth assets in a single pass. All overlay scenes share the same matte/fgr files (keyed by the primary scene ID from the request). When `check_segmentation_status` reports completion, files are automatically downloaded to `/workspace/public/`:
- `public/matte/{primarySceneId}.mp4` — grayscale alpha matte (shared across all overlay scenes)
- `public/matte/{primarySceneId}-fgr.mp4` — clean foreground video (shared across all overlay scenes)
- `public/matte/{primarySceneId}-bbox.json` — per-frame normalized bounding boxes
- `public/bg-{sceneId}.png` — clean background image per scene (speaker inpainted out via OpenAI)
```

- [ ] **Step 2: Fix the depthAssets JSON example**

Find lines 216-226:
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

Replace with (assuming scene-1 is the primary):
```json
{
  "scene-1": {
    "status": "ready",
    "fgrVideo": "matte/scene-1-fgr.mp4",
    "matteVideo": "matte/scene-1.mp4",
    "background": "bg-scene-1.png"
  },
  "scene-4": {
    "status": "ready",
    "fgrVideo": "matte/scene-1-fgr.mp4",
    "matteVideo": "matte/scene-1.mp4",
    "background": "bg-scene-4.png"
  },
  "scene-6": { "status": "failed", "reason": "segmentation timed out" }
}
```

Note: `scene-4` shares `scene-1`'s matte/fgr paths but has its own unique `background`. This matches the actual behavior of `check_segmentation_status`.

- [ ] **Step 3: Strengthen the Phase 5 resume check**

Find the resume logic for phase4-complete. It should mention checking for `public/matte/*-fgr.mp4`. Update it to also verify bg images exist. Find this text:

```
On `phase4-complete` resume: check if `public/matte/*-fgr.mp4` files exist. If they do, depth assets were already downloaded — skip to Phase 6.
```

Replace with:

```
On `phase4-complete` resume: check if `public/matte/*-fgr.mp4` files AND `public/bg-*.png` files exist for all overlay scenes in the plan. If all present, skip to Phase 6. If matte exists but some bg images are missing, re-run `check_segmentation_status` to download the missing files.
```

- [ ] **Step 4: Commit**

```bash
git add packages/sandbox/src/prompts/orchestrator/system.md
git commit -m "fix(orchestrator-prompt): show shared matte paths in depthAssets example, strengthen Phase 5 resume check"
```

---

## Summary

| Task | Issues Fixed | Files |
|---|---|---|
| 1 | #1, #4, #5 | `asset-server.ts` |
| 2 | #2, #14, #15 | `manifest-tools.xml` |
| 3 | #3 | `layout-editor/system.md` |
| 4 | #5 (V2 terms) | `layout-editor/system.md`, `reminder.md` |
| 5 | #6 | `system.md`, `reminder.md`, `orchestrator.ts` |
| 6 | #7 | `asset-server.ts` |
| 7 | #12 | `asset-server.ts` |
| 8 | #9 | `asset-server.ts` |
| 9 | #10 | `orchestrator.ts` |
| 10 | #16 | `orchestrator.ts` |
| 11 | #7, #11 | `orchestrator/system.md` |

**Not fixed (by design):**
- Issue #8 (`auto_center_speaker` bypasses manifest MCP): The tool writes directly because it needs to update ALL video items atomically. The Layout Editor calls it ONCE, then re-reads via `read_manifest`. Safe in practice.
- Issue #13 (`validate_workspace` no matte validation): Low risk — malformed matte items would fail at render time with a clear error. Adding validation is a separate enhancement, not an audit fix.
