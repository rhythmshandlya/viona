# Plan 2: Depth Asset Tools — Segmentation Outputs, Person Type, MatteItem

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Modify the worker segmentation job to output foreground video + background image alongside the matte (single pass, all in worker), add `matte` item type to manifest, and rewrite MatteItem to composite fgr+matte.

**Prerequisites:** Plan 1 complete (head tracking removed).

**Dependency chain:** `Plan 1` → **`Plan 2`** → `Plan 3` → `Plan 4` → `Plan 5` → `Plan 6`

---

## How matte extraction works after this plan

```
Worker segmentation job (single pass) outputs:
  matte/{id}.mp4       → grayscale alpha mask (white=person, black=bg)
  matte/{id}-fgr.mp4   → clean foreground (RVM decontaminated speaker pixels, transparent bg, zeros where no speaker)
  matte/{id}-bbox.json  → per-frame bounding boxes (already exists)
  bg-{id}.png          → clean background image (OpenAI inpainting, speaker removed)

All uploaded to MinIO → downloaded to sandbox by check_segmentation_status.
No OpenAI calls from sandbox. No extra processing steps after segmentation.

MatteItem composites at render time:
  fgr video pixels + matte as alpha → clean speaker cutout, no halos
```

## Asset flow

```
Worker job                     → MinIO (outputs bucket)
check_segmentation_status      → downloads to /workspace/public/
MatteItem                     → reads fgrSrc + matteSrc from public/
Background image               → reads from public/ as regular image item on V1
```

All served to frontend via existing `/api/projects/{id}/sandbox/public/*` proxy.

---

### Task 1: Modify segment_person.py to output foreground video

**Files:**
- Modify: `packages/worker/scripts/segment_person.py`

RVM already produces `fgr` (foreground) — we just discard it. Save it as a second video alongside the matte.

- [ ] **Step 1: Add a second ffmpeg encoder for the foreground**

In `segment_person.py`, in the `process_video` function, after the matte encoder is created, add a foreground encoder:

```python
# Existing: matte encoder
encoder = make_ffmpeg_encoder(output_path, out_w, out_h, effective_fps_str)

# NEW: foreground encoder — same dimensions, outputs clean speaker pixels
fgr_output_path = str(Path(output_path).with_suffix('')) + '-fgr.mp4'
fgr_encoder = make_ffmpeg_encoder(fgr_output_path, out_w, out_h, effective_fps_str)
```

- [ ] **Step 2: Save foreground frames alongside matte frames**

In the frame processing loop, after writing the matte frame, also write the foreground:

```python
# Existing: write matte
matte_rgb = np.stack([matte_u8, matte_u8, matte_u8], axis=-1)
encoder.stdin.write(matte_rgb.tobytes())

# NEW: write foreground (fgr * pha = premultiplied foreground, clean edges)
fgr_frame = fgr[0, t].permute(1, 2, 0).float().mul(255).clamp(0, 255).byte().cpu().numpy()
alpha_f = pha[0, t, 0].float().cpu().numpy()
fgr_premul = (fgr_frame.astype(np.float32) * alpha_f[:, :, None]).clip(0, 255).astype(np.uint8)
fgr_encoder.stdin.write(fgr_premul.tobytes())
```

- [ ] **Step 3: Close the foreground encoder and include in return data**

```python
fgr_encoder.stdin.close()
fgr_encoder.wait()
```

Add to return dict:
```python
"fgrPath": fgr_output_path,
```

- [ ] **Step 4: Commit**

```bash
git add packages/worker/scripts/segment_person.py
git commit -m "feat: output foreground video (fgr) alongside matte in segment_person.py"
```

---

### Task 2: Add background generation to segment_person.py

**Files:**
- Modify: `packages/worker/scripts/segment_person.py`

Generate a clean background image by extracting a representative frame and calling OpenAI to inpaint the speaker out. This happens in the same worker pass — no separate job.

- [ ] **Step 1: Add a generate_background function**

```python
def generate_background(input_path: str, matte_path: str, output_path: str, start_ms: int, end_ms: int) -> str:
    """Generate clean background by inpainting speaker out of a mid-scene frame."""
    import base64, tempfile
    from io import BytesIO
    from PIL import Image

    OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
    if not OPENAI_API_KEY:
        print("Warning: OPENAI_API_KEY not set, skipping background generation", file=sys.stderr)
        return ""

    from openai import OpenAI
    client = OpenAI(api_key=OPENAI_API_KEY)

    # Extract midpoint frame from source
    mid_sec = ((start_ms + end_ms) / 2) / 1000
    # ... extract frame with ffmpeg, extract matte frame
    # ... build mask (speaker area = transparent)
    # ... call client.images.edit()
    # ... resize to source dimensions, save as PNG
    return output_path
```

(Full implementation follows the same pattern as the `generate_backgrounds.py` test script in `scripts/temp/depth_test/` — extract frame, build mask from matte, call OpenAI, resize back.)

- [ ] **Step 2: Call it from main() after segmentation**

```python
# After segmentation completes:
bg_output_path = str(Path(output_path).parent / f"bg-{Path(output_path).stem.replace('matte-', '')}.png")
generate_background(str(input_path), output_path, bg_output_path, 0, int(duration_s * 1000))
```

- [ ] **Step 3: Add --start-ms and --end-ms CLI args**

Add optional args so the processor can pass scene time ranges:

```python
parser.add_argument("--start-ms", type=int, default=0)
parser.add_argument("--end-ms", type=int, default=0)
```

- [ ] **Step 4: Commit**

```bash
git add packages/worker/scripts/segment_person.py
git commit -m "feat: generate clean background image in segment_person.py via OpenAI"
```

---

### Task 3: Upload foreground + background in segmentation processor

**Files:**
- Modify: `packages/worker/src/processors/segmentation.ts`

- [ ] **Step 1: Pass start/end times to segment_person.py**

Add `--start-ms` and `--end-ms` args to the subprocess call:

```typescript
args: [
  scriptPath,
  videoPath,
  '--output', mattePath,
  '--backbone', 'resnet50',
  '--scale', '1.0',
  '--fps', '0',
  '--downsample-ratio', '0.8',
  '--start-ms', String(startMs),  // NEW
  '--end-ms', String(endMs),      // NEW
],
```

- [ ] **Step 2: Upload foreground video**

After the matte upload:

```typescript
const fgrPath = mattePath.replace(/\.mp4$/, '-fgr.mp4');
const fgrKey = outputKey.replace(/\.mp4$/, '-fgr.mp4');
if (existsSync(fgrPath)) {
  await uploadFile('outputs', fgrKey, fgrPath);
  logger.info({ projectId, sceneId, fgrKey }, 'Foreground video uploaded');
}
```

- [ ] **Step 3: Upload background image**

```typescript
const bgPath = join(workDir, `bg-${sceneId}.png`);
const bgKey = outputKey.replace(/matte\/.*\.mp4$/, `bg-${sceneId}.png`);
if (existsSync(bgPath)) {
  await uploadFile('outputs', bgKey, bgPath);
  logger.info({ projectId, sceneId, bgKey }, 'Background image uploaded');
}
```

- [ ] **Step 4: Include fgr + bg keys in callback**

```typescript
body: JSON.stringify({
  type: 'segmentation_complete',
  sceneId,
  outputKey,
  bboxKey,
  fgrKey,
  bgKey,
  jobId,
}),
```

- [ ] **Step 5: Commit**

```bash
git add packages/worker/src/processors/segmentation.ts
git commit -m "feat: upload fgr video + background image from segmentation processor"
```

---

### Task 4: Download fgr + background in check_segmentation_status

**Files:**
- Modify: `packages/mcp-servers/src/asset-server.ts`

- [ ] **Step 1: Download foreground and background when jobs complete**

In the `check_segmentation_status` tool, where it downloads the matte, also download fgr and bg:

```typescript
// After matte download:
const fgrKey = outputKey.replace(/\.mp4$/, '-fgr.mp4');
const fgrLocalPath = matteLocalPath.replace(/\.mp4$/, '-fgr.mp4');
try { await downloadFromMinio(fgrKey, fgrLocalPath); } catch { /* non-fatal */ }

const bgKey = outputKey.replace(/matte\/.*\.mp4$/, `bg-${sceneId}.png`);
const bgLocalPath = path.join(WORKSPACE, "public", `bg-${sceneId}.png`);
try { await downloadFromMinio(bgKey, bgLocalPath); } catch { /* non-fatal */ }
```

- [ ] **Step 2: Include paths in response**

```typescript
{
  sceneId,
  mattePath: `public/matte/${id}.mp4`,
  fgrPath: `public/matte/${id}-fgr.mp4`,
  bgPath: `public/bg-${id}.png`,
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/mcp-servers/src/asset-server.ts
git commit -m "feat: download fgr + background in check_segmentation_status"
```

---

### Task 5: Add matte type to manifest-ops

**Files:**
- Modify: `packages/sandbox/src/tools/manifest-ops.ts`

- [ ] **Step 1: Add matte data schema**

In `itemDataSchemas`, add after `shape`:

```typescript
matte: z.object({
  fgrSrc: z.string().describe('Path to foreground video (clean speaker pixels, transparent bg, zeros where no speaker)'),
  matteSrc: z.string().describe('Path to matte video (grayscale alpha mask)'),
  startFrom: z.number().min(0).default(0).describe('Start offset in milliseconds'),
}),
```

- [ ] **Step 2: Add matte to type enum**

```typescript
enum: ['video', 'audio', 'text', 'image', 'scene', 'caption', 'shape', 'matte'],
```

- [ ] **Step 3: Commit**

```bash
git add packages/sandbox/src/tools/manifest-ops.ts
git commit -m "feat: add matte item type with fgrSrc + matteSrc to manifest-ops"
```

---

### Task 6: Rewrite MatteItem to composite fgr + matte

**Files:**
- Modify: `packages/sandbox/template/src/items/MatteItem.tsx`
- Modify: `apps/web/src/features/editor-v2/player/WorkspacePlayer.tsx`

Replace the stacked video approach with separate fgr + matte compositing via Canvas 2D.

- [ ] **Step 1: Rewrite MatteItem.tsx**

```tsx
import React, { useRef, useEffect, useCallback } from "react";
import { Video, useCurrentFrame, useVideoConfig } from "remotion";
import { resolveMediaSrc } from "./resolveMediaSrc";

/**
 * MatteItem — Foreground + Matte compositing
 *
 * Two separate videos:
 *   fgrSrc  = extracted foreground (speaker pixels only, transparent where no speaker)
 *   matteSrc = grayscale alpha mask (white=person, black=transparent)
 *
 * Canvas composites: fgr pixels with matte.red as alpha.
 */

interface MatteItemData {
  fgrSrc: string;
  matteSrc: string;
  startFrom?: number;
}

interface MatteItemProps {
  data: MatteItemData;
  assets: Record<string, string>;
  fps: number;
}

export const MatteItem: React.FC<MatteItemProps> = React.memo(({ data, assets }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fgrVideoRef = useRef<HTMLVideoElement>(null);
  const matteVideoRef = useRef<HTMLVideoElement>(null);
  const tmpCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastTimeRef = useRef<number>(-1);

  const fgrSrc = resolveMediaSrc(data.fgrSrc, assets);
  const matteSrc = resolveMediaSrc(data.matteSrc, assets);
  const startFromFrames = Math.round(((data.startFrom ?? 0) / 1000) * fps);

  const doRender = useCallback(() => {
    const canvas = canvasRef.current;
    const fgrVideo = fgrVideoRef.current;
    const matteVideo = matteVideoRef.current;
    if (!canvas || !fgrVideo || !matteVideo) return;
    if (fgrVideo.readyState < 2 || matteVideo.readyState < 2) return;
    if (fgrVideo.currentTime === lastTimeRef.current) return;
    lastTimeRef.current = fgrVideo.currentTime;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (!tmpCanvasRef.current) tmpCanvasRef.current = document.createElement("canvas");
    const tmp = tmpCanvasRef.current;
    tmp.width = width;
    tmp.height = height;
    const tmpCtx = tmp.getContext("2d", { willReadFrequently: true });
    if (!tmpCtx) return;

    // Draw foreground, read pixels
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(fgrVideo, 0, 0, width, height);
    const fgrData = ctx.getImageData(0, 0, width, height);
    const fgrPx = fgrData.data;

    // Draw matte, read pixels
    tmpCtx.clearRect(0, 0, width, height);
    tmpCtx.drawImage(matteVideo, 0, 0, width, height);
    const matteData = tmpCtx.getImageData(0, 0, width, height);
    const mattePx = matteData.data;

    // Apply matte red channel as alpha
    for (let i = 0; i < fgrPx.length; i += 4) {
      fgrPx[i + 3] = mattePx[i];
    }

    ctx.putImageData(fgrData, 0, 0);
  }, [width, height]);

  useEffect(() => { doRender(); }, [frame, doRender]);

  return (
    <div style={{ width: "100%", height: "100%", overflow: "hidden" }}>
      <Video ref={fgrVideoRef} src={fgrSrc} startFrom={startFromFrames}
        style={{ position: "absolute", opacity: 0, pointerEvents: "none" }}
        pauseWhenBuffering muted onLoadedData={doRender} />
      <Video ref={matteVideoRef} src={matteSrc} startFrom={startFromFrames}
        style={{ position: "absolute", opacity: 0, pointerEvents: "none" }}
        pauseWhenBuffering muted onLoadedData={doRender} />
      <canvas ref={canvasRef} width={width} height={height}
        style={{ width: "100%", height: "100%" }} />
    </div>
  );
});
```

- [ ] **Step 2: Update WorkspacePlayer prefetch**

In `WorkspacePlayer.tsx`, change:

```typescript
// Old:
if (item.type === 'matte' && item.data?.stackedSrc) {
  currentMedia.add(resolveMedia(item.data.stackedSrc as string));
}

// New:
if (item.type === 'matte') {
  if (item.data?.fgrSrc) currentMedia.add(resolveMedia(item.data.fgrSrc as string));
  if (item.data?.matteSrc) currentMedia.add(resolveMedia(item.data.matteSrc as string));
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/sandbox/template/src/items/MatteItem.tsx apps/web/src/features/editor-v2/player/WorkspacePlayer.tsx
git commit -m "feat: rewrite MatteItem to composite fgr + matte (no stacked videos)"
```
