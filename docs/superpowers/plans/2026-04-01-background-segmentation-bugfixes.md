# Background Segmentation Bugfixes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all bugs identified in the code review of the background segmentation feature — 2 critical, 5 important, 5 minor.

**Architecture:** All fixes are surgical edits to existing files. No new files, no new dependencies. The critical fixes restore correct canvas compositing and bbox data flow. The important fixes address resource safety and dead code. The minor fixes improve validation, type safety, and accuracy.

**Tech Stack:** TypeScript, React/Remotion, Python, FFmpeg, Fastify

---

### Task 1: Fix canvas RGB-to-alpha compositing (Critical #1)

The `SandwichComposite` uses `globalCompositeOperation: 'destination-in'` which relies on the alpha channel. But the matte is RGB H.264 (white-on-black) — every decoded pixel has `alpha=255`. The matte has zero masking effect. Person extraction doesn't work.

**Files:**
- Modify: `packages/sandbox/template/src/composition/SandwichComposite.tsx:53-77`

- [ ] **Step 1: Add luma-to-alpha conversion in renderCanvas**

Replace the canvas compositing logic at lines 53-77 with code that converts the matte's red channel to alpha before applying `destination-in`:

```typescript
const renderCanvas = useCallback(() => {
  const canvas = canvasRef.current;
  const sourceVideo = sourceVideoRef.current;
  const matteVideo = matteVideoRef.current;
  if (!canvas || !sourceVideo || !matteVideo) return;
  if (sourceVideo.readyState < 2 || matteVideo.readyState < 2) return;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;

  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  // Step 1: Draw matte frame onto canvas
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(matteVideo, 0, 0, width, height);

  // Step 2: Convert RGB luma to alpha channel
  // The matte is white-on-black RGB with alpha=255 everywhere.
  // Copy the red channel (luma) into the alpha channel so
  // 'destination-in' can use it as a mask.
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    data[i + 3] = data[i]; // R → A
    data[i] = 255;         // Set RGB to white (person color comes from source)
    data[i + 1] = 255;
    data[i + 2] = 255;
  }
  ctx.putImageData(imageData, 0, 0);

  // Step 3: Draw source video — 'destination-in' keeps source pixels
  // only where the canvas alpha (our converted matte) is non-zero.
  ctx.globalCompositeOperation = 'destination-in';
  // Wait — that's backwards. We want the SOURCE video pixels where matte is white.
  // After putImageData, the canvas has: RGB=white, A=matte_luma.
  // We need: draw source video, keep ONLY where canvas alpha exists.
  // 'source-in' draws source pixels using existing canvas alpha as mask.

  // Actually the correct approach:
  // 1. Clear canvas
  // 2. Draw source video
  // 3. Set 'destination-in'
  // 4. Draw matte (with alpha channel set from luma)
  // But we can't drawImage after putImageData with destination-in using the matte video
  // because the matte video still has alpha=255 everywhere.
  //
  // Instead: use a second pass.

  // Clear and start over with the correct order:
  ctx.clearRect(0, 0, width, height);

  // Draw source video (full frame, person + background)
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(sourceVideo, 0, 0, width, height);

  // Apply converted matte as alpha mask
  // 'destination-in': keeps existing (source video) pixels only where
  // the new draw has alpha > 0. We draw a rect using the imageData's alpha.
  ctx.globalCompositeOperation = 'destination-in';
  ctx.putImageData(imageData, 0, 0);

  // Reset
  ctx.globalCompositeOperation = 'source-over';
}, [width, height]);
```

Wait — `putImageData` ignores `globalCompositeOperation`. It always replaces pixels. We need a different approach.

The correct fix uses a temporary canvas for the matte alpha conversion:

```typescript
const renderCanvas = useCallback(() => {
  const canvas = canvasRef.current;
  const sourceVideo = sourceVideoRef.current;
  const matteVideo = matteVideoRef.current;
  if (!canvas || !sourceVideo || !matteVideo) return;
  if (sourceVideo.readyState < 2 || matteVideo.readyState < 2) return;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;

  ctx.clearRect(0, 0, width, height);

  // Step 1: Draw source video (person + background)
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(sourceVideo, 0, 0, width, height);

  // Step 2: Convert matte luma→alpha on a temp canvas, then use as mask.
  // The matte is RGB white-on-black with alpha=255 everywhere.
  // We need a surface where alpha = matte brightness.
  if (!tempCanvasRef.current) {
    tempCanvasRef.current = document.createElement('canvas');
  }
  const temp = tempCanvasRef.current;
  temp.width = width;
  temp.height = height;
  const tCtx = temp.getContext('2d', { willReadFrequently: true })!;
  tCtx.drawImage(matteVideo, 0, 0, width, height);
  const imageData = tCtx.getImageData(0, 0, width, height);
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i + 3] = d[i]; // Copy red channel → alpha
  }
  tCtx.putImageData(imageData, 0, 0);

  // Step 3: 'destination-in' keeps source video pixels where temp canvas alpha > 0
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(temp, 0, 0);

  ctx.globalCompositeOperation = 'source-over';
}, [width, height]);
```

Apply this fix. Add `tempCanvasRef` alongside the other refs:
```typescript
const tempCanvasRef = useRef<HTMLCanvasElement | null>(null);
```

Also change `willReadFrequently: false` → `willReadFrequently: true` on line 60 (now reads pixel data every frame on the temp canvas; the main canvas doesn't need it but keeping `true` is fine).

- [ ] **Step 2: Update the JSDoc comment**

Update the comment block (lines 18-36) to reflect the actual algorithm:
```
 * Canvas approach:
 *   1. Draw source video frame onto canvas
 *   2. On a temp canvas: draw matte, convert R→A via getImageData
 *   3. Set globalCompositeOperation to 'destination-in'
 *   4. drawImage(tempCanvas) — keeps source pixels where matte alpha > 0
 *   5. Result: person-only pixels on transparent background
```

- [ ] **Step 3: Commit**

```bash
git add packages/sandbox/template/src/composition/SandwichComposite.tsx
git commit -m "fix: convert RGB matte luma to alpha for canvas destination-in compositing"
```

---

### Task 2: Fix PersonItem rendering duplicate background video (Important #7)

`PersonItem` delegates to `SandwichComposite`, which renders the background video as Layer 0. But the `video` track (position 0) already renders the background video. This means the background is rendered twice — wasting decode resources and potentially causing visual artifacts.

Since `PersonItem` sits on the `person` track (position 2), it should ONLY render the person-extracted canvas — not the full sandwich.

**Files:**
- Modify: `packages/sandbox/template/src/composition/SandwichComposite.tsx`
- Modify: `packages/sandbox/template/src/items/PersonItem.tsx`

- [ ] **Step 1: Add `backgroundless` prop to SandwichComposite**

Add an optional prop that skips the background video layer and mid-layer children. When `backgroundless` is true, the component only renders the person extraction canvas (Layer 2):

In the interface at line 11:
```typescript
interface SandwichCompositeProps {
  videoSrc: string;
  matteSrc: string;
  startFrom: number;
  children: React.ReactNode;
  /** When true, only render the person-extracted canvas (no background video or mid-layer) */
  backgroundless?: boolean;
}
```

In the JSX return (lines 88-143), wrap Layer 0 and Layer 1 in a conditional:
```tsx
return (
  <AbsoluteFill>
    {!backgroundless && (
      <>
        {/* Layer 0: Original video (background) */}
        <AbsoluteFill>
          <Video
            src={resolvedVideoSrc}
            startFrom={startFromFrames}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            pauseWhenBuffering
          />
        </AbsoluteFill>

        {/* Layer 1: Mid-layer children */}
        <AbsoluteFill>
          {children}
        </AbsoluteFill>
      </>
    )}

    {/* Layer 2: Person extracted via canvas matte */}
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {/* ... hidden videos + canvas unchanged ... */}
    </AbsoluteFill>
  </AbsoluteFill>
);
```

- [ ] **Step 2: Pass `backgroundless` from PersonItem**

In `packages/sandbox/template/src/items/PersonItem.tsx`, add the prop:

```tsx
return (
  <SandwichComposite
    videoSrc={videoSrc}
    matteSrc={matteSrc}
    startFrom={startFrom}
    backgroundless
  >
    <></>
  </SandwichComposite>
);
```

- [ ] **Step 3: Commit**

```bash
git add packages/sandbox/template/src/composition/SandwichComposite.tsx packages/sandbox/template/src/items/PersonItem.tsx
git commit -m "fix: PersonItem renders person-only canvas, no duplicate background video"
```

---

### Task 3: Add bbox download to check_segmentation_status (Critical #2)

The worker uploads `matte-bbox.json` to MinIO alongside the matte `.mp4`, but the `check_segmentation_status` MCP tool only downloads the `.mp4`. The `get_speaker_position` tool expects bbox files in `public/matte/` — they never arrive.

**Files:**
- Modify: `packages/mcp-servers/src/asset-server.ts:1355-1388`
- Modify: `packages/api/src/sandbox/routes.ts` (add bbox download endpoint)

- [ ] **Step 1: Add bbox download endpoint to API routes**

After the matte download endpoint (line 572), add a similar endpoint for bbox JSON:

```typescript
// GET /internal/sandbox/:id/segment/:jobId/bbox — Download matte bbox JSON
fastify.get('/internal/sandbox/:id/segment/:jobId/bbox', async (request, reply) => {
  const projectId = await validateInternalCallback(request, reply);
  if (!projectId) return;

  const { jobId } = request.params as { jobId: string };

  const [job] = await db.select().from(jobs)
    .where(and(
      eq(jobs.id, jobId),
      eq(jobs.projectId, projectId),
    ))
    .limit(1);

  if (!job) {
    return reply.status(404).send({ error: 'Job not found' });
  }

  if (job.status !== 'complete') {
    return reply.status(409).send({ error: `Job status is ${job.status}, not complete` });
  }

  const meta = job.progressMeta as { sceneId?: string; outputKey?: string } | null;
  const outputKey = meta?.outputKey;
  if (!outputKey) {
    return reply.status(500).send({ error: 'No outputKey in job metadata' });
  }

  const bboxKey = outputKey.replace(/\.mp4$/, '-bbox.json');

  try {
    const stream = await getObjectStream('outputs', bboxKey);
    reply.header('Content-Type', 'application/json');
    return reply.send(stream);
  } catch (err) {
    // Bbox may not exist for every job (e.g. empty matte)
    return reply.status(404).send({ error: 'Bbox file not found' });
  }
});
```

- [ ] **Step 2: Download bbox in check_segmentation_status MCP tool**

In `packages/mcp-servers/src/asset-server.ts`, inside the `for (const job of data.jobs)` loop at line 1359, after downloading the matte `.mp4`, also download the bbox JSON:

```typescript
for (const job of data.jobs) {
  if (job.status === "complete" && job.sceneId) {
    const localMattePath = path.join(MATTE_DIR, `${job.sceneId}.mp4`);
    const localBboxPath = path.join(MATTE_DIR, `${job.sceneId}-bbox.json`);

    // Download matte video (skip if exists)
    try {
      await stat(localMattePath);
      downloaded.push(job.sceneId);
    } catch {
      try {
        const matteRes = await fetch(
          `${API_INTERNAL_URL}/internal/sandbox/${PROJECT_ID}/segment/${job.jobId}/matte`,
          {
            headers: { "Authorization": `Bearer ${SANDBOX_SECRET}` },
            signal: AbortSignal.timeout(60_000),
          }
        );
        if (matteRes.ok) {
          const buf = Buffer.from(await matteRes.arrayBuffer());
          await writeFile(localMattePath, buf);
          downloaded.push(job.sceneId);
        }
      } catch (dlErr) {
        console.error(`[asset-server] Failed to download matte for ${job.sceneId}:`, dlErr);
      }
    }

    // Download bbox JSON (skip if exists)
    try {
      await stat(localBboxPath);
    } catch {
      try {
        const bboxRes = await fetch(
          `${API_INTERNAL_URL}/internal/sandbox/${PROJECT_ID}/segment/${job.jobId}/bbox`,
          {
            headers: { "Authorization": `Bearer ${SANDBOX_SECRET}` },
            signal: AbortSignal.timeout(15_000),
          }
        );
        if (bboxRes.ok) {
          const text = await bboxRes.text();
          await writeFile(localBboxPath, text);
        }
      } catch {
        // Bbox download is best-effort — speaker position falls back to head tracking
      }
    }
  }
}
```

Note: this also fixes Minor #11 — replaces `readFile` for existence checking with `stat`.

- [ ] **Step 3: Add `stat` to the imports**

At the top of `asset-server.ts`, ensure `stat` is imported from `fs/promises` alongside `readFile`, `writeFile`, `mkdir`, `readdir`.

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/sandbox/routes.ts packages/mcp-servers/src/asset-server.ts
git commit -m "fix: add bbox download endpoint and auto-download bbox in check_segmentation_status"
```

---

### Task 4: Reduce GPU segmentation concurrency to 1 (Important #3)

Two parallel RVM inference jobs will exceed the 6GB VRAM budget on the RTX 4050.

**Files:**
- Modify: `packages/worker/src/index.ts:234`

- [ ] **Step 1: Change concurrency from 2 to 1**

```typescript
{
  connection,
  concurrency: 1, // GPU-bound — single job avoids VRAM OOM
  lockDuration: 5 * 60 * 1000,
  stalledInterval: 2 * 60 * 1000,
  maxStalledCount: 2,
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/worker/src/index.ts
git commit -m "fix: reduce segmentation worker concurrency to 1 to avoid GPU VRAM OOM"
```

---

### Task 5: Add FFmpeg NVDEC fallback for CPU-only workers (Important #4)

The decode command hardcodes `-hwaccel cuda`, which fails on machines without an NVIDIA GPU.

**Files:**
- Modify: `packages/worker/scripts/segment_person.py:232-238`

- [ ] **Step 1: Conditionally add -hwaccel cuda**

Replace the hardcoded decode command with a conditional based on CUDA availability:

```python
decode_cmd = [
    "ffmpeg", "-hide_banner", "-loglevel", "error",
]
if device.type == "cuda":
    decode_cmd.extend(["-hwaccel", "cuda"])
decode_cmd.extend([
    "-i", input_path,
    "-vf", f"scale={out_w}:{out_h},fps={fps}",
    "-f", "rawvideo", "-pix_fmt", "rgb24",
    "pipe:1",
])
```

The `device` variable is already computed earlier in the function (line 213: `device = torch.device("cuda" if torch.cuda.is_available() else "cpu")`).

- [ ] **Step 2: Commit**

```bash
git add packages/worker/scripts/segment_person.py
git commit -m "fix: only use FFmpeg NVDEC hwaccel when CUDA is available"
```

---

### Task 6: Extract bboxes incrementally to avoid memory accumulation (Important #5)

All matte frames are stored in `all_matte_frames` for post-processing bbox extraction. For a 2-minute video at 30fps (3600 frames) at 540x960, this consumes ~1.8GB of RAM.

**Files:**
- Modify: `packages/worker/scripts/segment_person.py:251,275-298`

- [ ] **Step 1: Extract bboxes inline during the processing loop**

Remove `all_matte_frames = []` (line 251). Instead, build `bbox_frames` incrementally:

Replace lines 248-299 with:

```python
rec = [None] * 4
frame_idx = 0
start_time = time.time()
bbox_frames = []

while True:
    frames_rgb = []
    for _ in range(SEQ_CHUNK):
        raw = decoder.stdout.read(frame_size)
        if len(raw) < frame_size:
            break
        frames_rgb.append(np.frombuffer(raw, dtype=np.uint8).reshape(out_h, out_w, 3))

    if not frames_rgb:
        break

    T = len(frames_rgb)
    batch = np.stack(frames_rgb)

    src = torch.from_numpy(batch).permute(0, 3, 1, 2).unsqueeze(0)
    src = src.to(device, dtype=dtype, non_blocking=True).div(255.0)

    with torch.no_grad():
        fgr, pha, *rec = model(src, *rec, downsample_ratio)

    mattes = pha[0, :, 0].float().mul(255).clamp(0, 255).byte().cpu().numpy()

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

        matte_rgb = np.stack([matte_u8, matte_u8, matte_u8], axis=-1)
        encoder.stdin.write(matte_rgb.tobytes())
        frame_idx += 1

    if frame_idx % 100 < SEQ_CHUNK:
        print(f"Processed {frame_idx} frames...")

decoder.stdout.close()
decoder.wait()
encoder.stdin.close()
encoder.wait()

elapsed = time.time() - start_time
print(f"Done! Processed {frame_idx} frames in {elapsed:.1f}s ({frame_idx / max(1, elapsed):.1f} fps)")

print("Saving speaker bounding boxes...")
bbox_data = {"fps": fps, "frames": bbox_frames}
bbox_path = str(Path(output_path).parent / "matte-bbox.json")
with open(bbox_path, "w") as f:
    json.dump(bbox_data, f)
print(f"Bounding boxes saved: {bbox_path} ({len(bbox_frames)} frames)")
```

- [ ] **Step 2: Remove the `extract_matte_bboxes` function**

Delete the standalone `extract_matte_bboxes()` function (it's no longer called). Search for it and remove entirely.

- [ ] **Step 3: Commit**

```bash
git add packages/worker/scripts/segment_person.py
git commit -m "fix: extract matte bboxes inline to avoid O(n) memory accumulation"
```

---

### Task 7: Remove unused DepthLayers context (Important #6)

`DepthLayerProvider`, `BehindSpeaker`, and `InFrontOfSpeaker` are exported but never activated. The production path uses track z-ordering, not React context-based layer splitting. These components are misleading dead code.

**Files:**
- Delete: `packages/sandbox/template/src/composition/DepthLayers.tsx`
- Modify: `packages/sandbox/template/src/composition/index.ts` (if barrel exports exist)

- [ ] **Step 1: Check composition barrel export**

Check if `packages/sandbox/template/src/composition/index.ts` exists and exports from DepthLayers.

- [ ] **Step 2: Remove DepthLayers.tsx and its exports**

Delete the file. Remove any re-exports from barrel files. The agent prompts reference `BehindSpeaker`/`InFrontOfSpeaker` as JSX comment markers in scene skeletons — these are just comment labels, not actual component imports.

- [ ] **Step 3: Commit**

```bash
git add -A packages/sandbox/template/src/composition/
git commit -m "refactor: remove unused DepthLayers context (track z-ordering handles depth)"
```

---

### Task 8: Fix workspace-init `as any` cast (Minor #8)

**Files:**
- Modify: `packages/sandbox/src/workspace-init.ts:500-503`

- [ ] **Step 1: Remove unnecessary `as any` cast**

Replace:
```typescript
if ((payload as any).segmentationAvailable !== undefined) {
  await writeFile(
    join(baseDir, 'docs', 'segmentation-available.json'),
    JSON.stringify({ available: !!(payload as any).segmentationAvailable }),
  );
}
```

With:
```typescript
if (payload.segmentationAvailable !== undefined) {
  await writeFile(
    join(baseDir, 'docs', 'segmentation-available.json'),
    JSON.stringify({ available: !!payload.segmentationAvailable }),
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/sandbox/src/workspace-init.ts
git commit -m "fix: remove unnecessary as-any cast for segmentationAvailable"
```

---

### Task 9: Fix get_depth_compositing_info technique text (Minor #9)

The tool references `OffthreadVideo` but the implementation uses `SandwichComposite` and track-based compositing.

**Files:**
- Modify: `packages/mcp-servers/src/asset-server.ts:1466-1482`

- [ ] **Step 1: Update the techniques usage instructions**

Replace the current `behindSpeaker.usage` and `depthParallax.usage` arrays with accurate instructions:

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

- [ ] **Step 2: Commit**

```bash
git add packages/mcp-servers/src/asset-server.ts
git commit -m "fix: update depth compositing info to reference track system, not OffthreadVideo"
```

---

### Task 10: Add input validation on segmentation time ranges (Minor #10)

**Files:**
- Modify: `packages/api/src/sandbox/routes.ts:449-451`

- [ ] **Step 1: Add range validation after the array check**

After line 451 (`return reply.status(400).send(...)`) add:

```typescript
for (const range of ranges) {
  if (typeof range.startMs !== 'number' || typeof range.endMs !== 'number' || !range.sceneId) {
    return reply.status(400).send({ error: 'Each range must have startMs (number), endMs (number), sceneId (string)' });
  }
  if (range.startMs < 0 || range.endMs <= range.startMs) {
    return reply.status(400).send({ error: `Invalid range for ${range.sceneId}: startMs=${range.startMs}, endMs=${range.endMs}` });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/api/src/sandbox/routes.ts
git commit -m "fix: validate segmentation time ranges (positive, non-inverted, non-empty sceneId)"
```

---

### Task 11: Fix progress reporting in segment_person.py (Minor #12)

The modulo condition `frame_idx % 100 < SEQ_CHUNK` is fragile. Use a simpler approach.

**Files:**
- Modify: `packages/worker/scripts/segment_person.py` (inside the processing loop — if Task 6 is done first, this is already in the rewritten loop)

- [ ] **Step 1: Replace progress condition**

Change:
```python
if frame_idx % 100 < SEQ_CHUNK:
    print(f"Processed {frame_idx} frames...")
```

To a cleaner approach using a progress tracker:
```python
# After the for t in range(T) loop ends:
if frame_idx % 100 == 0 or frame_idx == 1:
    elapsed_so_far = time.time() - start_time
    fps_so_far = frame_idx / max(0.1, elapsed_so_far)
    print(f"Processed {frame_idx} frames ({fps_so_far:.1f} fps)")
```

Note: `frame_idx` is incremented inside the `for t` loop, so this check happens once per chunk (every 4 frames). The `% 100 == 0` check will fire when `frame_idx` lands exactly on 100, 200, etc. Since chunks are 4 frames, this hits every 100th frame ± 3 frames, which is good enough for progress reporting.

- [ ] **Step 2: Commit**

```bash
git add packages/worker/scripts/segment_person.py
git commit -m "fix: cleaner progress reporting in segmentation script"
```

---

## Task Dependency Order

Tasks can be grouped but should respect these dependencies:
- **Task 1** (canvas fix) → standalone, highest priority
- **Task 2** (PersonItem backgroundless) → depends on Task 1 (same file)
- **Task 3** (bbox download) → standalone
- **Task 4** (concurrency) → standalone, trivial
- **Task 5** (NVDEC fallback) → standalone
- **Task 6** (memory fix) → standalone, modifies same file as Task 5 and Task 11
- **Task 7** (remove DepthLayers) → standalone
- **Task 8** (workspace-init cast) → standalone, trivial
- **Task 9** (technique text) → standalone
- **Task 10** (validation) → standalone
- **Task 11** (progress reporting) → depends on Task 6 (same code region)

**Suggested batches:**
1. Tasks 1+2 (canvas compositing + PersonItem — same files)
2. Tasks 3+4+8 (bbox download + concurrency + workspace-init — independent files)
3. Tasks 5+6+11 (Python script — same file, do together)
4. Tasks 7+9+10 (cleanup — independent files)
