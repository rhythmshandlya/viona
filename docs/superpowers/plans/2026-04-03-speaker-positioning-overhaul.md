# Speaker Positioning Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the animation positioning pipeline so overlays are placed correctly relative to the speaker without manual repositioning — tighter bbox detection, scene-local coordinates, and Animator prompts that enforce usage.

**Architecture:** The fix spans 5 layers: Python bbox computation → TypeScript MCP tools → Layout Editor coordinate conversion → Setup Agent skeleton format → Animator prompt enforcement. Each layer is an independent task.

**Tech Stack:** Python (segment_person.py), TypeScript (asset-server.ts), Markdown prompts (layout-editor, setup-agent, animator, layer-compositing.xml)

---

## Root Cause Analysis

The positioning pipeline has **5 cascading failures**:

1. **Bbox is full-frame for close-up speakers.** RVM's matte with threshold >32 catches hair/arm halos, producing `w=1.0` bboxes. VISIBLE_ZONES reports zero usable space on sides.

2. **Coordinates are in the wrong space.** `SPEAKER.bboxPx` is written in canvas coordinates (1080×1920) but consumed in scene-local space (e.g., 1000×960 at offset 40,880). A canvas y=188 means nothing inside a scene starting at canvas y=880.

3. **Animators ignore SPEAKER entirely.** Every scene in the live sandbox uses hardcoded `SCENE_WIDTH/SCENE_HEIGHT` arithmetic. SPEAKER constants are dead exports. The Animator prompt shows examples using `SPEAKER.bboxPx` but the values are wrong (canvas space), so the AI learns to ignore them.

4. **`get_speaker_position` breaks for overlay scenes.** It looks for a video item overlapping the time range, but V0 is cut during overlays. Falls back to generic defaults.

5. **`auto_center_speaker` crashes at runtime.** Response references `faceCenterX`/`faceCenterY` which were renamed. Also centers on waist instead of face.

## File Map

| File | Changes |
|---|---|
| `packages/worker/scripts/segment_person.py` | Erode matte before bbox, raise threshold, add face-top estimate |
| `packages/mcp-servers/src/asset-server.ts` | Fix auto_center_speaker crash + face bias; fix get_speaker_position to work without video item; output scene-local coords |
| `packages/mcp-servers/src/utils/cover-transform.ts` | Rename `faceCenterX` param in computeCenterCrop |
| `packages/sandbox/src/prompts/layout-editor/system.md` | Convert SPEAKER to scene-local coords; don't write speaker data for stacked/fullscreen |
| `packages/sandbox/src/prompts/layout-editor/reminder.md` | Match scene-local coordinate changes |
| `packages/sandbox/src/prompts/setup-agent/system.md` | Update skeleton SPEAKER format to scene-local |
| `packages/sandbox/src/prompts/animator/system.md` | Rewrite SPEAKER usage examples in scene-local space; enforce usage |
| `packages/sandbox/src/prompts/shared/layer-compositing.xml` | Fix "face center" label; update constants reference to scene-local |

---

### Task 1: Tighten bbox computation in segment_person.py

**Files:**
- Modify: `packages/worker/scripts/segment_person.py:264-279`

The current bbox uses raw matte with threshold >32. For close-up speakers, hair/arm halos extend to frame edges → bbox covers the entire frame. Fix: erode the matte to shrink halos, raise threshold, and add a percentile-based trim.

- [ ] **Step 1: Add morphological erosion before bbox computation**

In `packages/worker/scripts/segment_person.py`, find the bbox loop (line 264-279):
```python
        for t in range(T):
            matte_u8 = mattes[t]

            # Extract bbox inline (avoids storing all frames in memory)
            rows = np.any(matte_u8 > 32, axis=1)
            cols = np.any(matte_u8 > 32, axis=0)
            if np.any(rows) and np.any(cols):
                rmin, rmax = np.where(rows)[0][[0, -1]]
                cmin, cmax = np.where(cols)[0][[0, -1]]
                bbox_frames.append({
                    "frame": frame_idx,
                    "x": float(cmin / out_w),
                    "y": float(rmin / out_h),
                    "w": float((cmax - cmin + 1) / out_w),
                    "h": float((rmax - rmin + 1) / out_h),
                })
```

Replace with:
```python
        for t in range(T):
            matte_u8 = mattes[t]

            # Tighter bbox: threshold at 128 (solid body only, not halos),
            # then erode to shrink edge noise from hair/clothing.
            mask = (matte_u8 > 128).astype(np.uint8)
            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15))
            mask = cv2.erode(mask, kernel, iterations=1)

            rows = np.any(mask > 0, axis=1)
            cols = np.any(mask > 0, axis=0)
            if np.any(rows) and np.any(cols):
                rmin, rmax = np.where(rows)[0][[0, -1]]
                cmin, cmax = np.where(cols)[0][[0, -1]]

                # Pad bbox by 5% of frame dimensions to give breathing room
                pad_h = int(out_h * 0.05)
                pad_w = int(out_w * 0.05)
                rmin = max(0, rmin - pad_h)
                rmax = min(out_h - 1, rmax + pad_h)
                cmin = max(0, cmin - pad_w)
                cmax = min(out_w - 1, cmax + pad_w)

                bbox_frames.append({
                    "frame": frame_idx,
                    "x": float(cmin / out_w),
                    "y": float(rmin / out_h),
                    "w": float((cmax - cmin + 1) / out_w),
                    "h": float((rmax - rmin + 1) / out_h),
                })
```

- [ ] **Step 2: Add `import cv2` at top of file**

Find the imports section (near top of file). Add `import cv2` after the existing numpy import if not already present. Check if opencv-python is in `packages/worker/requirements.txt` — if not, add it.

- [ ] **Step 3: Add face-top estimate to bbox JSON output**

After the bbox loop completes (after line ~310 where `bbox_data` is constructed), add a face estimate based on the top 35% of the average bbox height:

Find:
```python
    bbox_data = {"fps": effective_fps, "frames": bbox_frames}
```

Replace with:
```python
    # Compute aggregate stats for downstream tools
    if bbox_frames:
        avg_y = sum(f["y"] for f in bbox_frames) / len(bbox_frames)
        avg_h = sum(f["h"] for f in bbox_frames) / len(bbox_frames)
        avg_x = sum(f["x"] for f in bbox_frames) / len(bbox_frames)
        avg_w = sum(f["w"] for f in bbox_frames) / len(bbox_frames)
        face_y = avg_y + avg_h * 0.15  # face is ~15-35% from top of body bbox
        face_center_y = avg_y + avg_h * 0.25  # approximate face center
        aggregate = {
            "avgBbox": {"x": avg_x, "y": avg_y, "w": avg_w, "h": avg_h},
            "bodyCenter": {"x": avg_x + avg_w / 2, "y": avg_y + avg_h / 2},
            "faceEstimate": {"y": face_y, "centerY": face_center_y},
        }
    else:
        aggregate = None

    bbox_data = {"fps": effective_fps, "frames": bbox_frames, "aggregate": aggregate}
```

- [ ] **Step 4: Test locally**

Run on a short clip to verify the tighter bbox produces reasonable results:
```bash
cd packages/worker
python scripts/segment_person.py test-video.mp4 --output /tmp/test-matte.mp4 --scale 0.5 --fps 5
cat /tmp/matte-bbox.json | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf-8')); console.log('aggregate:', JSON.stringify(d.aggregate)); const f=d.frames; const avg_w = f.reduce((s,fr)=>s+fr.w,0)/f.length; console.log('avg w:', avg_w.toFixed(3), 'frames:', f.length);"
```

Expected: `avg_w` should be significantly less than 1.0 for a close-up speaker (target: 0.3-0.7 range depending on framing).

- [ ] **Step 5: Commit**

```bash
git add packages/worker/scripts/segment_person.py
git commit -m "fix(segmentation): tighten bbox with erosion + higher threshold + face estimate"
```

---

### Task 2: Fix `auto_center_speaker` crash and face bias

**Files:**
- Modify: `packages/mcp-servers/src/asset-server.ts:594-664`
- Modify: `packages/mcp-servers/src/utils/cover-transform.ts:72-73` (rename param)

- [ ] **Step 1: Fix the runtime crash — response still references old variable names**

In `packages/mcp-servers/src/asset-server.ts`, find lines 654-661:
```typescript
          text: JSON.stringify({
            adjusted: true,
            faceCenter: {
              x: Math.round(faceCenterX),
              y: Math.round(faceCenterY),
              sourceSize: { width: videoW, height: videoH },
            },
            items: updated,
```

Replace with:
```typescript
          text: JSON.stringify({
            adjusted: true,
            bodyCenter: {
              x: Math.round(bodyCenterX),
              y: Math.round(bodyCenterY),
              sourceSize: { width: videoW, height: videoH },
            },
            items: updated,
```

- [ ] **Step 2: Use face estimate instead of body center for crop centering**

In `packages/mcp-servers/src/asset-server.ts`, find the body center computation (lines 594-604):
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

Replace with:
```typescript
      // 3. Compute face-biased center for crop anchoring.
      // Matte bbox is full-body — body center is ~waist level.
      // For talking-head video, crop should center on the face (~top 25% of bbox).
      // Also check for aggregate.faceEstimate from newer bbox data.
      let sumX = 0, sumFaceY = 0;
      for (const mf of allBboxFrames) {
        sumX += (mf.x + mf.w / 2) * videoW;
        // Face is approximately at top 25% of the body bbox
        sumFaceY += (mf.y + mf.h * 0.25) * videoH;
      }
      const bodyCenterX = sumX / allBboxFrames.length;
      const bodyCenterY = sumFaceY / allBboxFrames.length;
```

- [ ] **Step 3: Commit**

```bash
git add packages/mcp-servers/src/asset-server.ts
git commit -m "fix(asset-server): fix auto_center_speaker crash, use face-biased center for crop"
```

---

### Task 3: Fix `get_speaker_position` for overlay scenes (no video item)

**Files:**
- Modify: `packages/mcp-servers/src/asset-server.ts:697-810`

When the Layout Editor cuts V0 video during overlay scenes, `get_speaker_position` can't find a video item for the time range and falls back to vague defaults. Fix: use canvas dimensions directly when no video item exists (the matte bbox is already in normalized source coordinates and the canvas IS the source for 1080x1920 portrait videos).

- [ ] **Step 1: Handle missing video item gracefully**

In `packages/mcp-servers/src/asset-server.ts`, find the section after `videoItem` lookup where `vt` (video transform) and `crop` values are extracted (around line 724-735):

```typescript
      // Video item dimensions from item.transform
      const vt = videoItem?.transform || {};
      const itemW = typeof vt.width === 'number' ? vt.width : canvas.width;
      const itemH = typeof vt.height === 'number' ? vt.height : canvas.height;
      const itemX = typeof vt.x === 'number' ? vt.x : 0;
      const itemY = typeof vt.y === 'number' ? vt.y : 0;
      const cropX = videoItem?.data?.crop?.x ?? 50;
      const cropY = videoItem?.data?.crop?.y ?? 50;
      const cropScale = videoItem?.data?.crop?.scale ?? 1;

      // 2. Compute cover transform
      const transform = computeCoverTransform(srcW, srcH, itemW, itemH, cropX, cropY, cropScale);
```

Replace with:
```typescript
      // Video item dimensions from item.transform
      // For overlay scenes, V0 video is cut — use canvas as the reference frame.
      const vt = videoItem?.transform || {};
      const itemW = typeof vt.width === 'number' ? vt.width : canvas.width;
      const itemH = typeof vt.height === 'number' ? vt.height : canvas.height;
      const itemX = typeof vt.x === 'number' ? vt.x : 0;
      const itemY = typeof vt.y === 'number' ? vt.y : 0;
      const cropX = videoItem?.data?.crop?.x ?? 50;
      const cropY = videoItem?.data?.crop?.y ?? 50;
      const cropScale = videoItem?.data?.crop?.scale ?? 1;

      // 2. Compute cover transform
      // When no video item exists (overlay scene — V0 cut), the matte bbox
      // is still in source-normalized coords. Use canvas as the item frame
      // with default 50/50 crop — the matte-to-canvas mapping is direct.
      const transform = computeCoverTransform(srcW, srcH, itemW, itemH, cropX, cropY, cropScale);

      if (!videoItem) {
        console.error(`[asset-server] No video item for range ${startMs}-${endMs}ms — using canvas frame (likely overlay scene with V0 cut)`);
      }
```

This already falls through correctly because when no video item exists, `itemW/itemH` default to canvas dimensions and `cropX/cropY` default to 50 — which gives a correct identity-like transform for matching aspect ratios. No functional change needed, but the log helps debug.

- [ ] **Step 2: Add scene-local coordinate conversion to the response**

After the `safePlacements` computation (around line 858), before the `result` object is assembled, add scene-local conversion helpers:

Find:
```typescript
      const result = {
        canvas: { width: canvas.width, height: canvas.height },
        speaker: {
          bounds: { top: boundsTop, bottom: boundsBottom, left: boundsLeft, right: boundsRight },
          center: { x: centerX, y: centerY },
        },
        availableSpace,
        safePlacements,
        source,
      };
```

Replace with:
```typescript
      // Normalized 0-1 coordinates (for scene-local conversion downstream)
      const normalized = {
        bbox: {
          x: boundsLeft / canvas.width,
          y: boundsTop / canvas.height,
          w: (boundsRight - boundsLeft) / canvas.width,
          h: (boundsBottom - boundsTop) / canvas.height,
        },
        center: {
          x: centerX / canvas.width,
          y: centerY / canvas.height,
        },
      };

      const result = {
        canvas: { width: canvas.width, height: canvas.height },
        speaker: {
          bounds: { top: boundsTop, bottom: boundsBottom, left: boundsLeft, right: boundsRight },
          center: { x: centerX, y: centerY },
          normalized,
        },
        availableSpace,
        safePlacements,
        source,
      };
```

- [ ] **Step 3: Commit**

```bash
git add packages/mcp-servers/src/asset-server.ts
git commit -m "fix(asset-server): get_speaker_position handles overlay scenes, adds normalized coords"
```

---

### Task 4: Convert SPEAKER constants to scene-local coordinates

**Files:**
- Modify: `packages/sandbox/src/prompts/layout-editor/system.md:178-238`
- Modify: `packages/sandbox/src/prompts/layout-editor/reminder.md:36-40`

This is the core fix. SPEAKER.bboxPx must be in scene-local coordinates (relative to the scene's own width×height), not canvas coordinates.

- [ ] **Step 1: Rewrite the speaker spatial data section in system.md**

In `packages/sandbox/src/prompts/layout-editor/system.md`, find lines 178-238 (the "Speaker spatial data" section through the "Write SPEAKER constants" section).

Replace the entire section from `#### Speaker spatial data (REQUIRED on every overlay scene item)` through the end of the `VISIBLE_ZONES` code block (line 235) and the pixel conversion note (line 238) with:

```markdown
#### Speaker spatial data (REQUIRED on every overlay scene item)

After creating each **overlay** scene item, call `get_speaker_position` with the scene's `{ startMs, endMs }` to get the speaker's full-body position. The tool returns both pixel bounds (canvas space) and `speaker.normalized` (0-1 range). Use the **normalized** values to compute **scene-local** coordinates.

```
// For each OVERLAY scene item:
const pos = get_speaker_position({ startMs: 15000, endMs: 25000 });
const norm = pos.speaker.normalized;

// Scene-local pixel conversion: multiply by SCENE dimensions (not canvas)
const sceneW = 1000;  // from the placement preset
const sceneH = 960;

update_item({
  itemId: "scene-1",
  data: {
    ...existingData,
    speakerBbox: norm.bbox,              // normalized 0-1 (x, y, w, h)
    speakerCenter: norm.center,           // normalized 0-1 (x, y)
  }
})
```

**IMPORTANT:** `get_speaker_position` returns `speaker.normalized.bbox` in 0-1 range. Store these directly on the item data. The Animator converts to scene-local pixels inside the scene code using `SCENE_WIDTH` and `SCENE_HEIGHT`.

If `get_speaker_position` returns `source: "defaults"` (no matte data), the bounds are approximate. Use them as-is.

**Stacked and Fullscreen scenes:** Do NOT call `get_speaker_position` or add speaker data. These modes don't use overlay positioning.

#### Write SPEAKER constants to overlay scene files

After calling `get_speaker_position` for an overlay scene, write the SPEAKER and VISIBLE_ZONES constants directly into the scene skeleton file. **All values are in scene-local coordinates** — the Animator uses these directly with `position: absolute` inside the scene div.

Use the Edit tool to replace the existing SPEAKER/VISIBLE_ZONES block in the scene file:

```tsx
// Speaker position in SCENE-LOCAL coordinates (relative to SCENE_WIDTH × SCENE_HEIGHT)
export const SPEAKER = {
  bbox: { x: 0.28, y: 0.10, w: 0.44, h: 0.75 },     // normalized 0-1
  center: { x: 0.50, y: 0.45 },                        // normalized 0-1
  bboxPx: { x: 280, y: 96, w: 440, h: 720 },          // pixels in SCENE_WIDTH × SCENE_HEIGHT
  centerPx: { x: 500, y: 432 },                        // pixels in SCENE_WIDTH × SCENE_HEIGHT
};

export const VISIBLE_ZONES = {
  left:   { x: 0, y: 0, w: 280, h: 960 },             // scene-local pixels
  right:  { x: 720, y: 0, w: 280, h: 960 },
  top:    { x: 0, y: 0, w: 1000, h: 96 },
  bottom: { x: 0, y: 816, w: 1000, h: 144 },
};
```

**Scene-local pixel conversion:**
```
bboxPx.x = Math.round(bbox.x * SCENE_WIDTH)
bboxPx.y = Math.round(bbox.y * SCENE_HEIGHT)
bboxPx.w = Math.round(bbox.w * SCENE_WIDTH)
bboxPx.h = Math.round(bbox.h * SCENE_HEIGHT)
centerPx.x = Math.round(center.x * SCENE_WIDTH)
centerPx.y = Math.round(center.y * SCENE_HEIGHT)
```

Use `SCENE_WIDTH` and `SCENE_HEIGHT` from the scene's placement preset — NOT the full canvas 1080×1920. VISIBLE_ZONES pixel values also use scene dimensions:
```
VISIBLE_ZONES.left.w  = bboxPx.x                        // space left of speaker
VISIBLE_ZONES.right.x = bboxPx.x + bboxPx.w             // right edge of speaker
VISIBLE_ZONES.right.w = SCENE_WIDTH - VISIBLE_ZONES.right.x
VISIBLE_ZONES.top.h   = bboxPx.y                        // space above speaker
VISIBLE_ZONES.bottom.y = bboxPx.y + bboxPx.h            // bottom edge of speaker
VISIBLE_ZONES.bottom.h = SCENE_HEIGHT - VISIBLE_ZONES.bottom.y
```
```

- [ ] **Step 2: Update reminder.md to match**

In `packages/sandbox/src/prompts/layout-editor/reminder.md`, find lines 36-40:
```
## Speaker Spatial Data
- Every OVERLAY scene item MUST have `data.speakerBbox`, `data.speakerCenter`, `data.visibleZones`.
- Call `get_speaker_position` per overlay scene to get speaker coordinates.
- Normalize to 0-1 range (divide by canvas width/height).
- Write SPEAKER/VISIBLE_ZONES constants to overlay scene skeleton files.
```

Replace with:
```
## Speaker Spatial Data
- Every OVERLAY scene item MUST have `data.speakerBbox` and `data.speakerCenter` (normalized 0-1 from `speaker.normalized`).
- Call `get_speaker_position` per overlay scene. Use `speaker.normalized` values directly.
- Write SPEAKER/VISIBLE_ZONES constants to overlay scene files in **scene-local** pixels (multiply normalized values by SCENE_WIDTH/SCENE_HEIGHT, NOT canvas dimensions).
- Do NOT write speaker data for stacked/fullscreen scenes.
```

- [ ] **Step 3: Commit**

```bash
git add packages/sandbox/src/prompts/layout-editor/system.md packages/sandbox/src/prompts/layout-editor/reminder.md
git commit -m "fix(layout-editor): convert SPEAKER constants to scene-local coordinates"
```

---

### Task 5: Update Setup Agent skeleton format

**Files:**
- Modify: `packages/sandbox/src/prompts/setup-agent/system.md:153-174`

- [ ] **Step 1: Update the placeholder SPEAKER format**

In `packages/sandbox/src/prompts/setup-agent/system.md`, find lines 157-171:
```tsx
// Speaker position (placeholder — Layout Editor will update with matte-derived values)
export const SPEAKER = {
  bbox: { x: 0.25, y: 0.05, w: 0.50, h: 0.85 },
  center: { x: 0.50, y: 0.45 },
  bboxPx: { x: 270, y: 96, w: 540, h: 1632 },
  centerPx: { x: 540, y: 864 },
};

export const VISIBLE_ZONES = {
  left:   { x: 0, y: 0, w: 270, h: 1920 },
  right:  { x: 810, y: 0, w: 270, h: 1920 },
  top:    { x: 0, y: 0, w: 1080, h: 96 },
  bottom: { x: 0, y: 1728, w: 1080, h: 192 },
};
```

Replace with:
```tsx
// Speaker position in SCENE-LOCAL coordinates (Layout Editor will update with matte-derived values)
export const SPEAKER = {
  bbox: { x: 0.25, y: 0.05, w: 0.50, h: 0.85 },
  center: { x: 0.50, y: 0.45 },
  bboxPx: { x: Math.round(0.25 * SCENE_WIDTH), y: Math.round(0.05 * SCENE_HEIGHT), w: Math.round(0.50 * SCENE_WIDTH), h: Math.round(0.85 * SCENE_HEIGHT) },
  centerPx: { x: Math.round(0.50 * SCENE_WIDTH), y: Math.round(0.45 * SCENE_HEIGHT) },
};

export const VISIBLE_ZONES = {
  left:   { x: 0, y: 0, w: SPEAKER.bboxPx.x, h: SCENE_HEIGHT },
  right:  { x: SPEAKER.bboxPx.x + SPEAKER.bboxPx.w, y: 0, w: SCENE_WIDTH - (SPEAKER.bboxPx.x + SPEAKER.bboxPx.w), h: SCENE_HEIGHT },
  top:    { x: 0, y: 0, w: SCENE_WIDTH, h: SPEAKER.bboxPx.y },
  bottom: { x: 0, y: SPEAKER.bboxPx.y + SPEAKER.bboxPx.h, w: SCENE_WIDTH, h: SCENE_HEIGHT - (SPEAKER.bboxPx.y + SPEAKER.bboxPx.h) },
};
```

Note: This uses `SCENE_WIDTH`/`SCENE_HEIGHT` which are already defined in the skeleton before the SPEAKER block. The Layout Editor will overwrite with actual matte-derived values, but the placeholders are now in the correct coordinate space and self-consistent.

- [ ] **Step 2: Commit**

```bash
git add packages/sandbox/src/prompts/setup-agent/system.md
git commit -m "fix(setup-agent): SPEAKER placeholder uses scene-local coordinates"
```

---

### Task 6: Rewrite Animator prompt to enforce SPEAKER usage

**Files:**
- Modify: `packages/sandbox/src/prompts/animator/system.md:379-430`
- Modify: `packages/sandbox/src/prompts/shared/layer-compositing.xml:46-60`

This is the most impactful change. The Animator must USE the SPEAKER data, not ignore it. The prompt examples must show scene-local coordinates and make positioning relative to SPEAKER mandatory.

- [ ] **Step 1: Rewrite the spatial positioning section in animator/system.md**

In `packages/sandbox/src/prompts/animator/system.md`, find lines 379-430 (from "Call `get_speaker_position`" through the coding pattern example).

Replace lines 379-430 with:

```markdown
- Do NOT call `get_speaker_position` yourself — the data is already in your scene skeleton as SPEAKER and VISIBLE_ZONES constants.

**Depth layers (overlay mode):**

Your overlay skeleton includes `SPEAKER` and `VISIBLE_ZONES` constants in **scene-local** coordinates (relative to `SCENE_WIDTH × SCENE_HEIGHT`). These tell you exactly where the speaker's body is within your scene box and where you have space for content.

**How to use layers:**
- Elements in the `{/* BehindSpeaker layer */}` section render behind the person's body
- Elements in the `{/* InFrontOfSpeaker layer */}` section render in front of the person
- A single scene can have elements on BOTH layers — mix and match
- The animation brief tells you which elements go where ("EMERGES BEHIND" = BehindSpeaker, "IN FRONT" = InFrontOfSpeaker)

**Spatial positioning with SPEAKER constants (MANDATORY for overlay scenes):**

`SPEAKER.bboxPx` is in scene-local pixels — use it directly with `position: absolute` inside your scene div. No coordinate conversion needed.

- **SPEAKER.bboxPx** `{x, y, w, h}` — speaker's body rectangle in scene-local pixels
- **SPEAKER.centerPx** `{x, y}` — speaker's body center in scene-local pixels
- **VISIBLE_ZONES.left/right/top/bottom** `{x, y, w, h}` — areas NOT occluded by the speaker (scene-local pixels)

**Rules:**
- Place behind-speaker elements so they PEEK from the edges of `SPEAKER.bboxPx` — partially visible creates the depth illusion
- Position behind-speaker content at shoulder height (`SPEAKER.bboxPx.y + SPEAKER.bboxPx.h * 0.2` to `0.4`) for best partial-occlusion
- Use `VISIBLE_ZONES.left` and `VISIBLE_ZONES.right` for behind-speaker content that must be readable
- Use `SPEAKER.centerPx` as the origin for radial/burst effects behind the speaker
- Never place readable text fully behind the speaker's face area (top 30% of bboxPx)
- **ALWAYS position relative to SPEAKER constants** — never hardcode absolute pixel positions for overlay scene elements

**Coding pattern:**
```tsx
return (
  <div style={{ width: SCENE_WIDTH, height: SCENE_HEIGHT, overflow: 'hidden' }}>
    {/* BehindSpeaker layer */}
    <div style={{ position: 'absolute', inset: 0 }}>
      {/* Large stat peeking from behind shoulders — positioned relative to speaker */}
      <div style={{
        position: 'absolute',
        left: SPEAKER.centerPx.x - s(200),
        top: SPEAKER.bboxPx.y + SPEAKER.bboxPx.h * 0.25,
        fontSize: s(120),
        transform: `scale(${heroScale})`,
      }}>
        73%
      </div>
    </div>

    {/* InFrontOfSpeaker layer */}
    <div style={{ position: 'absolute', inset: 0 }}>
      {/* Lower third label — positioned in the bottom visible zone */}
      <div style={{
        position: 'absolute',
        left: VISIBLE_ZONES.bottom.x + s(40),
        top: VISIBLE_ZONES.bottom.y + s(20),
        fontSize: s(28),
      }}>
        of users agree
      </div>
    </div>
  </div>
);
```
```

- [ ] **Step 2: Fix layer-compositing.xml constants reference**

In `packages/sandbox/src/prompts/shared/layer-compositing.xml`, find lines 46-60:
```xml
  <constants_reference>
    Scene skeletons include these constants (always available in overlay scenes):

    SPEAKER.bbox    — normalized {x, y, w, h} (0-1 range)
    SPEAKER.center  — normalized {x, y} (face center)
    SPEAKER.bboxPx  — pixel values {x, y, w, h}
    SPEAKER.centerPx — pixel values {x, y}
    VISIBLE_ZONES.left   — pixel rect {x, y, w, h} (area left of speaker)
    VISIBLE_ZONES.right  — pixel rect {x, y, w, h} (area right of speaker)
    VISIBLE_ZONES.top    — pixel rect {x, y, w, h} (area above speaker)
    VISIBLE_ZONES.bottom — pixel rect {x, y, w, h} (area below speaker)

    These are derived from the person matte and represent the average speaker
    position across the scene's time range. Use them for static layout decisions.
  </constants_reference>
```

Replace with:
```xml
  <constants_reference>
    Scene skeletons include these constants (always available in overlay scenes).
    ALL pixel values are in SCENE-LOCAL coordinates (relative to SCENE_WIDTH × SCENE_HEIGHT):

    SPEAKER.bbox     — normalized {x, y, w, h} (0-1 range, relative to scene dimensions)
    SPEAKER.center   — normalized {x, y} (body center, 0-1 range)
    SPEAKER.bboxPx   — scene-local pixel {x, y, w, h} (use directly with position: absolute)
    SPEAKER.centerPx — scene-local pixel {x, y} (use directly with position: absolute)
    VISIBLE_ZONES.left   — scene-local pixel rect (area left of speaker)
    VISIBLE_ZONES.right  — scene-local pixel rect (area right of speaker)
    VISIBLE_ZONES.top    — scene-local pixel rect (area above speaker)
    VISIBLE_ZONES.bottom — scene-local pixel rect (area below speaker)

    These are derived from the person matte and represent the average speaker
    position across the scene's time range. Use them for ALL layout decisions
    in overlay scenes — do not hardcode positions without referencing SPEAKER.
  </constants_reference>
```

- [ ] **Step 3: Commit**

```bash
git add packages/sandbox/src/prompts/animator/system.md packages/sandbox/src/prompts/shared/layer-compositing.xml
git commit -m "fix(animator): rewrite SPEAKER usage for scene-local coords, enforce positioning rules"
```

---

### Task 7: Remove deprecated `get_speaker_grid` stub

**Files:**
- Modify: `packages/mcp-servers/src/asset-server.ts:880-902`

- [ ] **Step 1: Delete the deprecated tool registration**

In `packages/mcp-servers/src/asset-server.ts`, find and remove lines 880-902:
```typescript
// Deprecated alias — backward compat for prompts still referencing old name
server.registerTool(
  "get_speaker_grid",
  {
    description: "[Deprecated — use get_speaker_position] Get speaker position data for overlay placement.",
    inputSchema: {
      startMs: z.number().describe("Start of time range in milliseconds"),
      endMs: z.number().describe("End of time range in milliseconds"),
    },
  },
  async ({ startMs, endMs }: { startMs: number; endMs: number }) => {
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          deprecated: true,
          message: "Use get_speaker_position instead for canvas-space coordinates.",
          hint: "Call get_speaker_position with { startMs, endMs }",
        }),
      }],
    };
  }
);
```

- [ ] **Step 2: Verify no remaining references**

Search for `get_speaker_grid` in all prompts:
```bash
grep -r "get_speaker_grid" packages/sandbox/src/prompts/ packages/mcp-servers/
```

Remove any remaining references found.

- [ ] **Step 3: Commit**

```bash
git add packages/mcp-servers/src/asset-server.ts
git commit -m "chore(asset-server): remove deprecated get_speaker_grid stub"
```

---

## Summary

| Task | What it fixes | Impact |
|---|---|---|
| 1 | Bbox covers full frame for close-up speakers | Speaker takes ~40-70% of frame width instead of 100% → real VISIBLE_ZONES |
| 2 | auto_center_speaker crash + waist centering | Tool works; face centered in crop instead of waist |
| 3 | get_speaker_position fails for overlay scenes | Correct speaker bounds even when V0 is cut; normalized coords for downstream |
| 4 | SPEAKER in canvas coords, scene expects local | Layout Editor writes scene-local pixels → Animator can use directly |
| 5 | Setup Agent placeholder in wrong coord space | Consistent with Task 4 format; self-referencing via SCENE_WIDTH/HEIGHT |
| 6 | Animators ignore SPEAKER entirely | Prompt enforces usage; examples show correct scene-local positioning |
| 7 | Dead deprecated tool | Cleanup |

**Dependency chain:** Task 1 (tighter bbox) → Task 3 (normalized coords) → Task 4 (scene-local conversion) → Task 5 (skeleton format) → Task 6 (animator enforcement). Tasks 2 and 7 are independent.

**Not in scope (separate enhancement):**
- Dynamic face tracking per-frame (current approach: average position across scene range — sufficient for static overlay placement)
- WebGL matte compositing (current Canvas 2D is correct, just slower)
