# Depth Compositing Pipeline — Master Plan (Reference)

> **This is the master reference document (may contain stale details).** The actual executable plans are split into 6 focused plans below. Execute them in order. When in doubt, the sub-plans are authoritative.
>
> **Naming:** Item type is `matte` (not `person`). Component is `MatteItem` (not `PersonItem`). Variable names use `matte*` prefix.

**Goal:** Wire the sandbox pipeline end-to-end so overlay scenes use proper video cuts, OpenAI-generated backgrounds, stacked person mattes, and depth-aware animation placement that avoids the speaker's face.

## Execution Order

| # | Plan | What it does |
|---|------|-------------|
| 1 | [depth-1-cleanup-head-tracking](2026-04-02-depth-1-cleanup-head-tracking.md) | Remove deprecated detect_head.py + shot boundaries |
| 2 | [depth-2-asset-tools](2026-04-02-depth-2-asset-tools.md) | Worker outputs fgr+bg alongside matte, `matte` manifest type, MatteItem rewrite (fgrSrc+matteSrc) |
| 3 | [depth-3-orchestrator-pipeline](2026-04-02-depth-3-orchestrator-pipeline.md) | New Phase 5: poll segmentation (all assets arrive together), pass depthAssets to layout editor |
| 4 | [depth-4-layout-editor-cuts](2026-04-02-depth-4-layout-editor-cuts.md) | NLE video cuts, V0-V4 tracks, bg/matte placement, multi-layer transitions |
| 5 | [depth-5-overlay-positioning](2026-04-02-depth-5-overlay-positioning.md) | Speaker presets, cinematographer positioning, scene splitting, punch-ins |
| 6 | [depth-6-face-avoidance-prompts](2026-04-02-depth-6-face-avoidance-prompts.md) | Animator + layer-compositing face avoidance spatial rules |

**Dependencies:** Each plan depends on all previous plans being complete.

---

## Asset Handling — How Files Flow from Container to Frontend

All depth assets follow the same path as every other public file in the sandbox:

```
┌─────────────────────────────────────────────────────────────────────────┐
│ SANDBOX CONTAINER (/workspace/public/)                                  │
│                                                                         │
│  source.mp4                    ← original video                        │
│  audio.aac                     ← extracted audio                       │
│  matte/scene-1.mp4             ← RVM matte (grayscale alpha mask)     │
│  matte/scene-1-fgr.mp4         ← RVM foreground (clean speaker pixels)│
│  bg-scene-1.png                ← clean background (OpenAI, worker)    │
│                                                                         │
│  Agent server serves these at:  GET /public/{path}                     │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                    Docker network (host.docker.internal)
                               │
┌──────────────────────────────▼──────────────────────────────────────────┐
│ API SERVER (Fastify)                                                    │
│                                                                         │
│  GET /api/projects/{id}/sandbox/public/{path}                          │
│    → proxyFileRequest() → forwards to container /public/{path}         │
│    → streams response, forwards Range headers for video seeking        │
│    → caches media (video/audio/image) with Cache-Control: max-age=3600 │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                          Browser fetch
                               │
┌──────────────────────────────▼──────────────────────────────────────────┐
│ FRONTEND (Remotion Player)                                              │
│                                                                         │
│  useWorkspaceComposition.ts:                                           │
│    staticFile("matte/scene-1-fgr.mp4")                                 │
│      → /api/projects/{id}/sandbox/public/matte/scene-1-fgr.mp4       │
│                                                                         │
│    staticFile("bg-scene-1.png")                                        │
│      → /api/projects/{id}/sandbox/public/bg-scene-1.png               │
│                                                                         │
│  WorkspacePlayer.tsx prefetch():                                       │
│    - type "matte" + data.fgrSrc → prefetches foreground video         │
│    - type "matte" + data.matteSrc → prefetches matte video            │
│    - type "image" + data.src → prefetches background PNG               │
│    All downloaded into blob: URLs for instant seeks/renders             │
└─────────────────────────────────────────────────────────────────────────┘
```

**Key points:**
- **No new proxy routes needed.** The existing `/api/projects/{id}/sandbox/public/*` proxy serves ANY file from `/workspace/public/`.
- **All new assets go in `/workspace/public/`.** Foreground: `public/matte/{sceneId}-fgr.mp4`. Backgrounds: `public/bg-{sceneId}.png`.
- **staticFile() resolves paths automatically.** The shim in `useWorkspaceComposition.ts` maps to the proxy URL.
- **WorkspacePlayer prefetches matte items.** Updated to prefetch both `fgrSrc` and `matteSrc` for matte items.
- **Range headers forwarded.** The proxy forwards `Range` headers so video seeking works.
- **Rendering uses the same paths.** During `remotion render`, `staticFile()` resolves to `public/{path}` inside the container.

**When are assets created vs consumed:**

| Asset | Created by | When | Consumed by | When |
|-------|-----------|------|-------------|------|
| `source.mp4` | workspace-init | Init | Video items, stacked tool | All phases |
| `matte/{id}.mp4` | Worker segmentation job | Phase 3→5 (async) | PersonItem (alpha), speaker position tools | Phase 6+ |
| `matte/{id}-fgr.mp4` | Worker segmentation job | Phase 3→5 (async) | PersonItem (color pixels) | Phase 6+ |
| `bg-{id}.png` | Worker segmentation job | Phase 3→5 (async) | Image items on V1 | Phase 6+ |

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `packages/worker/scripts/segment_person.py` | Output fgr video + background image alongside matte |
| Modify | `packages/worker/src/processors/segmentation.ts` | Upload fgr + bg from worker |
| Modify | `packages/mcp-servers/src/asset-server.ts` | Download fgr + bg in check_segmentation_status |
| Modify | `packages/sandbox/src/tools/manifest-ops.ts` | Add `matte` type (fgrSrc + matteSrc) |
| Modify | `packages/sandbox/template/src/items/MatteItem.tsx` | Rewrite to composite fgr + matte (no stacked) |
| Modify | `packages/sandbox/src/prompts/orchestrator/system.md` | Add Phase 5 polling (no tool calls) |
| Modify | `packages/sandbox/src/prompts/layout-editor/system.md` | Video cuts, V0-V4 tracks, matte items with fgrSrc+matteSrc |
| Modify | `packages/sandbox/src/prompts/planner/system.md` | Depth-aware planning, face avoidance zones |
| Modify | `packages/sandbox/src/prompts/animator/system.md` | Face avoidance rules, depth layer usage |
| Modify | `packages/sandbox/src/prompts/shared/layer-compositing.xml` | Face avoidance spatial rules |
| Delete | `packages/worker/scripts/detect_head.py` | Remove deprecated head tracking script |
| Modify | `packages/worker/src/processors/head-tracking.ts` | Remove processor or gut it |
| Modify | `packages/sandbox/src/workspace-init.ts` | Remove shot-boundaries.json generation |
| Modify | `packages/mcp-servers/src/asset-server.ts` | Remove `get_shot_boundaries` tool |
| Modify | `packages/sandbox/src/prompts/planner/system.md` | Remove shot boundary references |
| Modify | `packages/sandbox/src/prompts/orchestrator/system.md` | Remove shot boundary references |

---

### Task 0: Remove deprecated head tracking and shot boundaries

**Files:**
- Delete: `packages/worker/scripts/detect_head.py`
- Modify: `packages/worker/src/processors/head-tracking.ts` — remove or delete the processor
- Modify: `packages/sandbox/src/workspace-init.ts` — remove `alignShotsWithTranscript()` and shot-boundaries.json write
- Modify: `packages/mcp-servers/src/asset-server.ts` — remove `get_shot_boundaries` tool
- Modify: `packages/sandbox/src/prompts/orchestrator/system.md` — remove `get_shot_boundaries` from Phase 3 Planner dispatch
- Modify: `packages/sandbox/src/prompts/planner/system.md` — remove "Shot Boundaries (Camera Cuts)" section and `get_shot_boundaries` call from workflow

`detect_head.py` (MediaPipe face/pose detection + PySceneDetect) is fully replaced by RVM segmentation which provides accurate full-body matte bounding boxes. Shot boundary detection doesn't work reliably and the Planner can plan scenes without it.

- [ ] **Step 1: Delete detect_head.py**

```bash
rm packages/worker/scripts/detect_head.py
```

- [ ] **Step 2: Remove or gut the head-tracking processor**

In `packages/worker/src/processors/head-tracking.ts`, either delete the file entirely or replace the processor body with a no-op that immediately completes (if other code references the job queue name).

- [ ] **Step 3: Remove shot-boundaries from workspace-init.ts**

In `packages/sandbox/src/workspace-init.ts`, remove:
- The `alignShotsWithTranscript()` function
- The block that writes `/workspace/docs/shot-boundaries.json`
- Any references to `payload.headTracking.shots`

Keep the rest of workspace-init intact — it still handles video download, audio extraction, manifest setup, transcript, etc.

- [ ] **Step 4: Remove get_shot_boundaries tool from asset-server.ts**

In `packages/mcp-servers/src/asset-server.ts`, remove the entire `get_shot_boundaries` tool registration block.

Also remove `'mcp__assets__get_shot_boundaries'` from `ASSET_TOOL_NAMES` in `packages/sandbox/src/orchestrator.ts`.

- [ ] **Step 5: Remove shot boundary references from prompts**

In `packages/sandbox/src/prompts/orchestrator/system.md`:
- Remove any instruction to call `get_shot_boundaries` or pass shot boundary data to the Planner

In `packages/sandbox/src/prompts/planner/system.md`:
- Remove the "Shot Boundaries (Camera Cuts)" section
- Remove step 9 (call `get_shot_boundaries`) from the workflow
- Remove `isMultiCam` references
- Remove any self-verification checklist items about shot boundary alignment

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: remove deprecated head tracking (detect_head.py) and shot boundary detection

Head tracking replaced by RVM segmentation which provides accurate full-body
matte bounding boxes. Shot boundary detection (PySceneDetect) removed — unreliable
and not needed for scene planning."
```

---

### Task 1: Add person type to manifest-ops

**Files:**
- Modify: `packages/sandbox/src/tools/manifest-ops.ts:19-73` (itemDataSchemas) and `:368-370` (type enum)

The `add_item` tool currently only accepts `video|audio|text|image|scene|caption|shape`. The layout editor needs to add `person` items for depth compositing. Without this change, the tool rejects matte items.

- [ ] **Step 1: Add person data schema to itemDataSchemas**

In `packages/sandbox/src/tools/manifest-ops.ts`, add after the `shape` entry in `itemDataSchemas`:

```typescript
person: z.object({
  stackedSrc: z.string().describe('Path to stacked video (top=color, bottom=matte)'),
  startFrom: z.number().min(0).default(0).describe('Start offset in milliseconds'),
  crop: z.object({
    x: z.number().min(0).max(100).default(50),
    y: z.number().min(0).max(100).default(50),
    scale: z.number().min(0.5).max(3).default(1),
  }).optional(),
}),
```

- [ ] **Step 2: Add person to the type enum in addItemTool**

In `addItemTool.input_schema.properties.type.enum`, change:

```typescript
enum: ['video', 'audio', 'text', 'image', 'scene', 'caption', 'shape', 'person'],
```

- [ ] **Step 3: Verify the tool accepts matte items**

Start the sandbox, call `add_item` manually with type `person`:
```json
{
  "type": "person",
  "trackId": "test-track",
  "startMs": 0,
  "endMs": 5000,
  "data": { "stackedSrc": "matte/scene-1-stacked.mp4", "startFrom": 0 }
}
```

Expected: item is added to manifest with correct data. The schema should validate `stackedSrc` as required.

- [ ] **Step 4: Commit**

```bash
git add packages/sandbox/src/tools/manifest-ops.ts
git commit -m "feat: add matte item type to manifest-ops for depth compositing"
```

---

### Task 2: Create stacked video tool in asset server

**Files:**
- Modify: `packages/mcp-servers/src/asset-server.ts` (add new tool registration)

This tool combines a scene's source video clip with its matte into a single stacked video (color top half, matte bottom half). The stacked format lets PersonItem.tsx extract the alpha channel with a single video element using a WebGL/Canvas2D shader.

- [ ] **Step 1: Add the create_stacked_video tool**

Register a new tool in `packages/mcp-servers/src/asset-server.ts` after the `check_segmentation_status` tool:

```typescript
server.registerTool(
  "create_stacked_video",
  {
    description:
      "Create a stacked video for depth compositing. Combines a time range from the source " +
      "video with its matte into a single video: top half = RGB color, bottom half = grayscale matte. " +
      "Requires the matte to already exist at public/matte/{sceneId}.mp4 (from segmentation). " +
      "Output is saved to public/matte/{sceneId}-stacked.mp4.",
    inputSchema: {
      sceneId: z.string().describe("Scene identifier matching the matte file (e.g. 'scene-1')"),
      startMs: z.number().describe("Start time in milliseconds (used to extract source clip)"),
      endMs: z.number().describe("End time in milliseconds"),
    },
  },
  async ({ sceneId, startMs, endMs }: { sceneId: string; startMs: number; endMs: number }) => {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execFileAsync = promisify(execFile);

    const sourcePath = path.join(WORKSPACE, "public", "source.mp4");
    const mattePath = path.join(WORKSPACE, "public", "matte", `${sceneId}.mp4`);
    const outputPath = path.join(WORKSPACE, "public", "matte", `${sceneId}-stacked.mp4`);

    try {
      await stat(mattePath);
    } catch {
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ error: `Matte not found: ${mattePath}. Run segmentation first.` }),
        }],
        isError: true,
      };
    }

    // Probe source video dimensions
    const probeResult = await execFileAsync("ffprobe", [
      "-v", "error", "-select_streams", "v:0",
      "-show_entries", "stream=width,height",
      "-of", "csv=p=0", sourcePath,
    ]);
    const [srcW, srcH] = probeResult.stdout.trim().split(",").map(Number);

    // Probe matte dimensions
    const matteProbe = await execFileAsync("ffprobe", [
      "-v", "error", "-select_streams", "v:0",
      "-show_entries", "stream=width,height",
      "-of", "csv=p=0", mattePath,
    ]);
    const [matteW, matteH] = matteProbe.stdout.trim().split(",").map(Number);

    const startSec = (startMs / 1000).toFixed(3);
    const durationSec = ((endMs - startMs) / 1000).toFixed(3);

    // FFmpeg filter: extract source clip, scale matte to match, stack vertically
    // Source clip → top half (color RGB)
    // Matte → bottom half (grayscale, scaled to source dimensions)
    // Output: single video at srcW x (srcH * 2)
    try {
      await execFileAsync("ffmpeg", [
        "-hide_banner", "-loglevel", "error", "-y",
        "-ss", startSec, "-t", durationSec, "-i", sourcePath,
        "-i", mattePath,
        "-filter_complex",
        `[0:v]setpts=PTS-STARTPTS[color];` +
        `[1:v]scale=${srcW}:${srcH},format=gray,format=yuv420p[matte];` +
        `[color][matte]vstack=inputs=2[out]`,
        "-map", "[out]",
        "-c:v", "libx264", "-preset", "fast", "-crf", "18",
        "-pix_fmt", "yuv420p",
        "-an",
        outputPath,
      ], { timeout: 120_000 });

      const outputStat = await stat(outputPath);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            success: true,
            sceneId,
            outputPath: `public/matte/${sceneId}-stacked.mp4`,
            staticFile: `matte/${sceneId}-stacked.mp4`,
            dimensions: { width: srcW, height: srcH * 2 },
            sizeBytes: outputStat.size,
          }),
        }],
      };
    } catch (err) {
      return {
        content: [{
          type: "text" as const,
          text: `Error creating stacked video: ${errorMessage(err)}`,
        }],
        isError: true,
      };
    }
  }
);
```

- [ ] **Step 2: Test the tool manually**

With a sandbox container running that has segmentation mattes:
```bash
# Via the MCP tool call from the orchestrator
create_stacked_video({ sceneId: "scene-1", startMs: 0, endMs: 5720 })
```

Expected: `public/matte/scene-1-stacked.mp4` created with dimensions `1080x3840` (double height).

Verify with ffprobe:
```bash
ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 public/matte/scene-1-stacked.mp4
```
Expected output: `1080,3840`

- [ ] **Step 3: Commit**

```bash
git add packages/mcp-servers/src/asset-server.ts
git commit -m "feat: add create_stacked_video MCP tool for depth compositing"
```

---

### Task 3: Create background generation tool in asset server

**Files:**
- Modify: `packages/mcp-servers/src/asset-server.ts` (add new tool registration)

This tool generates a clean background image (speaker removed) for overlay scenes using OpenAI's image editing API. It extracts a representative frame, creates a mask from the matte, and calls gpt-image-1.5 for inpainting.

- [ ] **Step 1: Add the generate_background tool**

Register a new tool in `packages/mcp-servers/src/asset-server.ts` after `create_stacked_video`:

```typescript
server.registerTool(
  "generate_background",
  {
    description:
      "Generate a clean background image for an overlay scene by removing the speaker. " +
      "Uses OpenAI gpt-image-1.5 to inpaint the area where the speaker was. " +
      "Requires the matte to exist at public/matte/{sceneId}.mp4 (from segmentation). " +
      "Output is saved to public/bg-{sceneId}.png. Requires OPENAI_API_KEY env var.",
    inputSchema: {
      sceneId: z.string().describe("Scene identifier matching the matte file (e.g. 'scene-1')"),
      startMs: z.number().describe("Start time of the scene in milliseconds"),
      endMs: z.number().describe("End time of the scene in milliseconds"),
      prompt: z.string().optional().describe(
        "Optional inpainting prompt. Default auto-generates from context."
      ),
    },
  },
  async ({ sceneId, startMs, endMs, prompt }: {
    sceneId: string; startMs: number; endMs: number; prompt?: string;
  }) => {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      return {
        content: [{
          type: "text" as const,
          text: "OPENAI_API_KEY env var not set. Cannot generate background.",
        }],
        isError: true,
      };
    }

    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execFileAsync = promisify(execFile);
    const sharp = await import("sharp").then(m => m.default);

    const sourcePath = path.join(WORKSPACE, "public", "source.mp4");
    const mattePath = path.join(WORKSPACE, "public", "matte", `${sceneId}.mp4`);
    const outputPath = path.join(WORKSPACE, "public", `bg-${sceneId}.png`);
    const tmpDir = path.join(WORKSPACE, ".tmp");
    await mkdir(tmpDir, { recursive: true });

    try {
      await stat(mattePath);
    } catch {
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ error: `Matte not found: ${mattePath}` }),
        }],
        isError: true,
      };
    }

    // Extract representative frame from midpoint of scene
    const midSec = ((startMs + endMs) / 2 / 1000).toFixed(3);
    const framePath = path.join(tmpDir, `bg-frame-${sceneId}.png`);
    const matteFramePath = path.join(tmpDir, `bg-matte-${sceneId}.png`);

    try {
      // Extract source frame
      await execFileAsync("ffmpeg", [
        "-hide_banner", "-loglevel", "error", "-y",
        "-ss", midSec, "-i", sourcePath,
        "-frames:v", "1", "-q:v", "2", framePath,
      ], { timeout: 30_000 });

      // Extract matte frame at relative midpoint (matte is scene-clipped)
      const matteRelMidSec = (((endMs - startMs) / 2) / 1000).toFixed(3);
      await execFileAsync("ffmpeg", [
        "-hide_banner", "-loglevel", "error", "-y",
        "-ss", matteRelMidSec, "-i", mattePath,
        "-frames:v", "1", "-q:v", "2", matteFramePath,
      ], { timeout: 30_000 });

      // Read images
      const sourceImg = sharp(framePath);
      const sourceMeta = await sourceImg.metadata();
      const srcW = sourceMeta.width!;
      const srcH = sourceMeta.height!;

      // OpenAI supports specific sizes — use closest portrait size
      const apiW = 1024;
      const apiH = Math.min(1536, Math.round((srcH / srcW) * apiW / 64) * 64);
      const apiSize = `${apiW}x${apiH}` as any;

      // Resize source to API dimensions and convert to RGBA PNG
      const resizedSource = await sourceImg
        .resize(apiW, apiH, { fit: "cover" })
        .ensureAlpha()
        .png()
        .toBuffer();

      // Create mask: transparent where speaker is (to inpaint), opaque elsewhere
      const matteImg = sharp(matteFramePath);
      const matteResized = await matteImg
        .resize(apiW, apiH, { fit: "cover" })
        .grayscale()
        .raw()
        .toBuffer();

      // Build RGBA mask: alpha = 255 where matte is dark (no speaker), 0 where bright (speaker)
      // OpenAI inpaints where alpha = 0 (transparent)
      const maskRgba = Buffer.alloc(apiW * apiH * 4);
      for (let i = 0; i < apiW * apiH; i++) {
        const matteVal = matteResized[i];
        // Dilate: treat anything above threshold as speaker
        const isSpeaker = matteVal > 80;
        maskRgba[i * 4 + 0] = 0;
        maskRgba[i * 4 + 1] = 0;
        maskRgba[i * 4 + 2] = 0;
        maskRgba[i * 4 + 3] = isSpeaker ? 0 : 255; // transparent = inpaint area
      }

      const maskPng = await sharp(maskRgba, {
        raw: { width: apiW, height: apiH, channels: 4 },
      }).png().toBuffer();

      // Save temp files for API upload
      const tmpSourcePath = path.join(tmpDir, `bg-api-src-${sceneId}.png`);
      const tmpMaskPath = path.join(tmpDir, `bg-api-mask-${sceneId}.png`);
      await writeFile(tmpSourcePath, resizedSource);
      await writeFile(tmpMaskPath, maskPng);

      // Call OpenAI gpt-image-1.5
      const inpaintPrompt = prompt ||
        "Remove the person completely. Fill the area with a natural continuation of the " +
        "background environment. Match the exact lighting, colors, textures, and camera " +
        "perspective. Empty scene, no person.";

      const { default: OpenAI } = await import("openai");
      const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

      const fs = await import("node:fs");
      const result = await openai.images.edit({
        model: "gpt-image-1",
        image: fs.createReadStream(tmpSourcePath) as any,
        mask: fs.createReadStream(tmpMaskPath) as any,
        prompt: inpaintPrompt,
        size: apiSize,
      });

      // Decode result and resize back to source dimensions
      const imageData = Buffer.from(result.data![0].b64_json!, "base64");
      await sharp(imageData)
        .resize(srcW, srcH, { fit: "cover" })
        .png()
        .toFile(outputPath);

      const outputStat = await stat(outputPath);

      // Cleanup temp files
      for (const f of [framePath, matteFramePath, tmpSourcePath, tmpMaskPath]) {
        try { await (await import("node:fs/promises")).unlink(f); } catch {}
      }

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            success: true,
            sceneId,
            outputPath: `public/bg-${sceneId}.png`,
            staticFile: `bg-${sceneId}.png`,
            dimensions: { width: srcW, height: srcH },
            sizeBytes: outputStat.size,
          }),
        }],
      };
    } catch (err) {
      return {
        content: [{
          type: "text" as const,
          text: `Error generating background: ${errorMessage(err)}`,
        }],
        isError: true,
      };
    }
  }
);
```

- [ ] **Step 2: Add sharp and openai as dependencies to mcp-servers**

```bash
cd packages/mcp-servers && pnpm add sharp openai
```

- [ ] **Step 3: Test the tool manually**

With a sandbox running that has segmentation mattes:
```json
generate_background({ "sceneId": "scene-1", "startMs": 0, "endMs": 5720 })
```

Expected: `public/bg-scene-1.png` created at source video dimensions (e.g. 1080x1920). Visually verify the speaker has been removed and the background looks natural.

- [ ] **Step 4: Commit**

```bash
git add packages/mcp-servers/src/asset-server.ts packages/mcp-servers/package.json
git commit -m "feat: add generate_background MCP tool using OpenAI gpt-image-1.5"
```

---

### Task 4: Forward OPENAI_API_KEY to sandbox container

**Files:**
- Modify: `packages/api/src/sandbox/docker.ts:86-89`

The `generate_background` tool needs the OpenAI API key inside the container. The container already forwards `ANTHROPIC_API_KEY` — add `OPENAI_API_KEY` the same way.

- [ ] **Step 1: Add OPENAI_API_KEY to env forwarding**

In `packages/api/src/sandbox/docker.ts`, after line 88 (`CLAUDE_CODE_OAUTH_TOKEN` forwarding), add:

```typescript
...(process.env.OPENAI_API_KEY ? { OPENAI_API_KEY: process.env.OPENAI_API_KEY } : {}),
```

- [ ] **Step 2: Verify the env var reaches the container**

After starting a sandbox, exec into the container and check:
```bash
docker exec <container> env | grep OPENAI
```

Expected: `OPENAI_API_KEY=sk-...` is present.

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/sandbox/docker.ts
git commit -m "feat: forward OPENAI_API_KEY to sandbox container for background generation"
```

---

### Task 5: Update orchestrator — full pipeline timing and async handoffs

**Files:**
- Modify: `packages/sandbox/src/orchestrator.ts` (tool names, activity labels)
- Modify: `packages/sandbox/src/prompts/orchestrator/system.md` (pipeline phases)

This task rewires the orchestrator pipeline to handle the full depth compositing flow. The critical challenge is **timing**: segmentation is GPU-heavy and async, stacked video + background generation depend on segmentation output, and the layout editor depends on ALL depth assets being ready.

#### Pipeline Timeline (visual overview)

```
Phase 3: Planner creates SCENE_PLAN.md
         ↓
         Orchestrator reads plan, identifies overlay scenes
         ↓
         Calls request_segmentation({ ranges: [...overlay scenes...] })  ← NON-BLOCKING
         Returns immediately with jobIds
         ↓
Phase 4: Setup Agent scaffolds workspace          ← RUNS IN PARALLEL with segmentation
         (constants.ts, Background.tsx, scene      (Worker GPU job processing mattes
          skeletons — ~2-3 min)                     via BullMQ — ~1-5 min)
         ↓                                          ↓
         Setup complete                             Segmentation still running...
         ↓
Phase 5: BLOCKING WAIT — poll for segmentation
         ↓
         Poll check_segmentation_status every 10s
         Timeout: 180s (3 min)
         ↓
         ┌─── ALL scenes complete ───────────────────────────────────────┐
         │                                                               │
         │  For EACH overlay scene (sequential):                        │
         │    1. create_stacked_video(sceneId, startMs, endMs)  ~10-30s │
         │    2. generate_background(sceneId, startMs, endMs)   ~15-30s │
         │                                                               │
         │  Total: ~30-60s per overlay scene                             │
         │  3 overlay scenes = ~2-3 min                                  │
         └───────────────────────────────────────────────────────────────┘
         ↓
         ┌─── SOME scenes failed ────────────────────────────────────────┐
         │                                                               │
         │  For FAILED scenes:                                           │
         │    - Skip stacked video + background generation               │
         │    - Mark scene as "no-depth" in dispatch to layout editor    │
         │    - Layout editor falls back to opacity-only overlay         │
         │      (no video cut, no bg-plate, no matte item)             │
         │                                                               │
         │  For SUCCEEDED scenes:                                        │
         │    - Generate stacked video + background as normal            │
         └───────────────────────────────────────────────────────────────┘
         ↓
         ┌─── ALL scenes failed OR no overlay scenes ────────────────────┐
         │                                                               │
         │  Skip entire depth asset phase.                               │
         │  Layout editor builds timeline without depth compositing.     │
         │  Overlay scenes use simple opacity overlays (current behavior)│
         └───────────────────────────────────────────────────────────────┘
         ↓
Phase 6: Layout Editor
         Receives: list of depth-ready scenes with asset paths
         Cuts video, places bg-plates, places matte items
         ↓
Phase 7: Animators (parallel)
         ↓
Phase 8: Final Editor
         ↓
Phase 9: Done
```

#### Decision tree: What if segmentation isn't ready?

```
check_segmentation_status returns:
├── allComplete: true  → proceed to stacked video + background gen
├── allComplete: false, no failures yet, elapsed < 180s → wait 10s, poll again
├── allComplete: false, no failures yet, elapsed >= 180s → TIMEOUT
│   └── Treat unfinished scenes as failed (skip depth for those)
│       Proceed with whatever scenes DID complete
├── anyFailed: true, some complete → proceed with completed scenes only
│   └── Failed scenes get "no-depth" flag
└── anyFailed: true, ALL failed → skip depth asset phase entirely
```

#### What the Layout Editor receives

The orchestrator passes a `depthAssets` manifest in its dispatch message:

```json
{
  "depthAssets": {
    "scene-1": {
      "status": "ready",
      "stackedVideo": "matte/scene-1-stacked.mp4",
      "background": "bg-scene-1.png"
    },
    "scene-4": {
      "status": "ready",
      "stackedVideo": "matte/scene-4-stacked.mp4",
      "background": "bg-scene-4.png"
    },
    "scene-6": {
      "status": "failed",
      "reason": "segmentation timed out"
    }
  }
}
```

The Layout Editor checks each overlay scene's status:
- `"ready"` → cut video, place bg-plate on V1, place matte item on V3
- `"failed"` → keep video continuous with opacity keyframes (legacy behavior), no bg-plate, no matte item

---

- [ ] **Step 1: Add the new tools to ASSET_TOOL_NAMES in orchestrator.ts**

In `packages/sandbox/src/orchestrator.ts`, add to the `ASSET_TOOL_NAMES` array:

```typescript
'mcp__assets__create_stacked_video',
'mcp__assets__generate_background',
```

Also add to the activity labels:
```typescript
create_stacked_video: 'Creating stacked video',
generate_background: 'Generating clean background',
```

- [ ] **Step 2: Replace Phase 5 in orchestrator system prompt**

In `packages/sandbox/src/prompts/orchestrator/system.md`, replace the current Phase 5 (Layout) section. Insert Phase 5 (Depth Assets) before the Layout phase and renumber Layout to Phase 6:

```markdown
### Phase 5: Depth Asset Generation (no subagent — you do this directly)

This phase creates the visual assets needed for depth compositing in overlay scenes. It BLOCKS until all assets are ready (or failed).

Report progress: `{ phase: "depth-assets", message: "Generating depth assets..." }`

**If there are NO overlay scenes in the plan, skip this phase entirely.**

#### Step 5a: Wait for segmentation to complete

Segmentation was requested after plan approval (Phase 3). The GPU worker has been processing mattes in the background during Phase 4 (Setup). Now you must wait for it to finish.

Poll `check_segmentation_status` with the jobIds from Phase 3:
- **Poll interval:** every 10 seconds
- **Timeout:** 180 seconds (3 minutes)
- **Stop when:** `allComplete: true` OR timeout reached

```
// First call
check_segmentation_status({ jobIds: ["job-abc", "job-def", "job-ghi"] })
// Response: { allComplete: false, jobs: [{ id: "job-abc", status: "completed" }, ...] }

// Keep polling...
check_segmentation_status({ jobIds: ["job-abc", "job-def", "job-ghi"] })
// Response: { allComplete: true, jobs: [...] }
```

**On timeout:** Treat any still-processing scenes as failed. Proceed with scenes that DID complete.

**On all failed:** Skip the rest of Phase 5. Proceed to Phase 6 (Layout) without depth assets. Pass `depthAssets: {}` to Layout Editor.

#### Step 5b: Generate stacked videos and backgrounds

For EACH overlay scene where segmentation succeeded, run BOTH tools in sequence:

```
// Scene 1: stacked video first, then background
create_stacked_video({ sceneId: "scene-1", startMs: 0, endMs: 6300 })
generate_background({ sceneId: "scene-1", startMs: 0, endMs: 6300 })

// Scene 4: same pattern
create_stacked_video({ sceneId: "scene-4", startMs: 21020, endMs: 28760 })
generate_background({ sceneId: "scene-4", startMs: 21020, endMs: 28760 })
```

Process scenes **sequentially** (one scene at a time, both tools per scene). Do NOT parallelize — ffmpeg and OpenAI calls compete for resources.

**If `create_stacked_video` fails for a scene:** Mark that scene as failed. Skip its `generate_background`. Continue to next scene.

**If `generate_background` fails for a scene:** Mark that scene as failed (stacked video exists but background doesn't — depth compositing needs both). Continue to next scene.

#### Step 5c: Build depth asset manifest

After processing all scenes, build a depthAssets summary:

```
depthAssets = {
  "scene-1": { status: "ready", stackedVideo: "matte/scene-1-stacked.mp4", background: "bg-scene-1.png" },
  "scene-4": { status: "ready", stackedVideo: "matte/scene-4-stacked.mp4", background: "bg-scene-4.png" },
  "scene-6": { status: "failed", reason: "segmentation timed out" }
}
```

Write phase marker: `echo "phase5-complete" > /workspace/.pipeline-phase`

### Phase 6: Layout → dispatch **Layout Editor**

Report progress: `{ phase: "layout", message: "Building layout..." }`

Dispatch Layout Editor with these instructions appended to the standard dispatch:

```
Depth asset status for overlay scenes:
- scene-1: READY — stacked video at matte/scene-1-stacked.mp4, background at bg-scene-1.png
- scene-4: READY — stacked video at matte/scene-4-stacked.mp4, background at bg-scene-4.png
- scene-6: FAILED — use legacy opacity overlay (no video cut, no bg-plate, no matte item)

For READY overlay scenes:
1. CUT OUT the video segment (split + remove)
2. Place background image on V1
3. Place matte item on V3 with stackedSrc
4. Place scene animation on V2 or V4 based on depth brief

For FAILED overlay scenes:
1. KEEP video segment (full canvas transform, no depth assets)
2. Place scene animation on V4 only

For fullscreen scenes:
1. CUT OUT the video segment (split + remove — animations cover everything)
2. Place scene animation on V4

For stacked scenes:
1. KEEP video segment (transform to bottom portion)
2. Place scene animation on V4 (top portion)
```
```

- [ ] **Step 3: Update phase markers**

Update the phase marker list in the orchestrator prompt to include the new phase:
```
Phase markers: `phase2-complete`, `phase3-complete`, `phase4-complete`, `phase5-complete`, `phase6-complete`, `phase7-complete`, `phase8-complete`, `phase9-complete`.
```

Renumber all downstream phases: Layout → 6, Animation → 7, Final Editor → 8, Done → 9.

- [ ] **Step 4: Update the on-resume logic**

Update the resume phase detection to handle the new phase:
```markdown
**On session resume:** Read `/workspace/.pipeline-phase`:
- `phase5-complete` → skip to Phase 6 (Layout)
- `phase6-complete` → skip to Phase 7 (Animation)
- `phase7-complete` → skip to Phase 8 (Final Editor)
```

Also: on resume after `phase4-complete`, the orchestrator must check if depth assets already exist before re-running Phase 5. Check for `public/matte/*-stacked.mp4` files — if they exist, skip to Phase 6.

- [ ] **Step 5: Commit**

```bash
git add packages/sandbox/src/orchestrator.ts packages/sandbox/src/prompts/orchestrator/system.md
git commit -m "feat: add depth asset generation phase with polling, fallback, and per-scene status"
```

---

### Task 6: Update layout editor prompt — video cuts and depth items

**Files:**
- Modify: `packages/sandbox/src/prompts/layout-editor/system.md`

This is the largest prompt change. The layout editor must now: (1) CUT the source video at overlay/fullscreen boundaries instead of using opacity keyframes, (2) place background images on track V1, and (3) use `stackedSrc` for matte items instead of `videoSrc`/`matteSrc`.

- [ ] **Step 1: Replace the Core Principle section**

Replace the current "Core Principle — Keyframes, Not Splits" section with:

```markdown
## Core Principle — Cut Video Like a Proper NLE

The source video is physically CUT at every scene boundary. No opacity tricks — if the speaker isn't visible, the video segment is removed from the timeline. Audio is separate and never touched.

**Overlay (READY):** Video CUT OUT. Replaced by bg-plate (V1) + person matte (V3). Animations on V2/V4.

**Overlay (FAILED):** Video KEPT (no depth assets to replace it). Transform to full canvas. Animations on V4 only.

**Fullscreen:** Video CUT OUT. Nothing replaces it — animations on V4 fill the entire canvas over empty V0.

**Stacked:** Video KEPT but transformed to bottom portion. Animations fill the top on V4.

**The process:**
1. Read the depth asset status from the orchestrator dispatch (which overlay scenes are READY vs FAILED)
2. Split the video at ALL scene boundaries using `split_item`
3. DELETE video segments within fullscreen scenes and READY overlay scenes
4. KEEP video segments within stacked scenes (transform to bottom) and FAILED overlay scenes (full canvas)
5. For READY overlay scenes: add bg-plate image on V1, matte item on V3
6. For ALL scenes: add scene animation items on V2 or V4

**Audio is NEVER cut.** The audio track is already separate and plays continuously regardless of video cuts.

### Scene Transitions — Coordinated Multi-Layer Fades

With the multi-layer architecture, every scene transition involves synchronized opacity changes across V0, V1, V3, and the scene tracks. All transitions are 300ms. The Layout Editor must add matching keyframes to every layer involved.

**Transition matrix — what happens to each layer at each boundary:**

| Transition | V0 (video) | V1 (bg-plate) | V3 (person) | V2/V4 (scenes) |
|---|---|---|---|---|
| **Stacked → Overlay** | fade out last 300ms of stacked segment | fade in first 300ms | fade in first 300ms | outgoing scene fades out, incoming fades in |
| **Overlay → Stacked** | fade in first 300ms of stacked segment | fade out last 300ms | fade out last 300ms | outgoing scene fades out, incoming fades in |
| **Stacked → Fullscreen** | fade out last 300ms of stacked segment | — | — | outgoing fades out, incoming fades in |
| **Fullscreen → Stacked** | fade in first 300ms of stacked segment | — | — | outgoing fades out, incoming fades in |
| **Overlay → Fullscreen** | — (both cut) | fade out last 300ms | fade out last 300ms | outgoing fades out, incoming fades in |
| **Fullscreen → Overlay** | — (both cut) | fade in first 300ms | fade in first 300ms | outgoing fades out, incoming fades in |
| **Overlay → Overlay** | — (both cut) | cross-fade if different bg | person position animates if changed | outgoing fades out, incoming fades in |
| **Stacked → Stacked** | video transform animates if split changes | — | — | outgoing fades out, incoming fades in |
| **Fullscreen → Fullscreen** | — (both cut) | — | — | outgoing fades out, incoming fades in |

**Key rules:**

1. **V0 segments that border a cut need fade keyframes.** When a kept video segment ends right before a cut gap (overlay/fullscreen), add `opacity: 1→0` in the last 300ms. When a kept segment starts right after a gap, add `opacity: 0→1` in the first 300ms.

2. **V1 and V3 items always have 300ms fade in/out.** Every bg-plate and matte item gets entrance fade `0→1` at start and exit fade `1→0` at end. This is already in the placement rules — transitions are handled by these item-level keyframes.

3. **Overlay → Overlay transitions:** If two consecutive overlay scenes have different backgrounds, the outgoing V1 fades out and incoming V1 fades in (300ms overlap). If the person position changes between scenes (e.g., speaker-default → speaker-lowered), the matte item for the second scene starts with its new position — the 300ms cross-fade between outgoing and incoming matte items creates a smooth morph.

4. **Scene items always cross-fade.** Outgoing scene fades out in last 300ms, incoming scene fades in first 300ms. Same as current behavior — this part doesn't change.

**Example — Stacked → Overlay → Fullscreen:**
```
Time:      5700    6000    6300         12000   12300
           ←300ms→         ←300ms→
V0:   [...stacked, opacity 1→0]                [fullscreen gap]
V1:                [bg-img, opacity 0→1...........opacity 1→0]
V3:                [person, opacity 0→1...........opacity 1→0]
V2/V4:    [sceneA, opacity 1→0][sceneB, 0→1...........1→0][sceneC, 0→1...]
A0:   [═══════════════ continuous audio ═══════════════════════]
```

All fades are synchronized — at 6000ms the stacked video fades out while the bg-plate, person, and new scene all fade in together over 300ms.
```

- [ ] **Step 2: Update Step 2 (track creation) to use V1-V4 naming**

Replace the track creation section with:

```markdown
### Step 2: Create the layer sandwich tracks

Create FOUR overlay tracks that form the depth sandwich. Tracks follow NLE naming convention: V0 is the base video track (already exists), V1-V4 are overlay layers stacked above it.

```
add_track({ type: "overlay", name: "V1", position: 1 })  → trk-V1 (background plates)
add_track({ type: "overlay", name: "V2", position: 2 })  → trk-V2 (behind-speaker animations)
add_track({ type: "overlay", name: "V3", position: 3 })  → trk-V3 (matted speaker)
add_track({ type: "overlay", name: "V4", position: 4 })  → trk-V4 (in-front-of-speaker animations)
```

**Layer roles:**
| Track | Role | Contents |
|---|---|---|
| V1 | Background plate | Clean background images (overlay scenes only) |
| V2 | Behind-speaker | Scene items with depth briefs (emerge-behind, peek-sides, etc.) |
| V3 | Speaker matte | Person items with stacked video (overlay scenes only) |
| V4 | In-front-of-speaker | All other scene items (overlay, stacked, fullscreen) |

Track assignment for scene items:
- **Overlay scenes with depth briefs** (animation brief contains "behind", "emerge-behind", "peek-sides", "cascade-behind", "background-fill", "depth-lower-third") → place on `trk-V2`
- **All other scenes** (overlay without depth, stacked, fullscreen) → place on `trk-V4`

**Background plate items (REQUIRED for each overlay scene):** For every overlay scene, add an image item on `trk-V1` covering the same time range. The clean background image was generated by the orchestrator.

```
// For each overlay scene:
add_item({
  trackId: "trk-V1",
  type: "image",
  startMs: 0,        // same as the overlay scene item
  endMs: 5720,       // same as the overlay scene item
  transform: { x: 0, y: 0, width: CANVAS_W, height: CANVAS_H, rotation: 0, opacity: 1 },
  keyframes: [
    { timeMs: 0, props: { opacity: 0 } },
    { timeMs: 300, props: { opacity: 1 } },
    { timeMs: 5420, props: { opacity: 1 } },
    { timeMs: 5720, props: { opacity: 0 } }
  ],
  data: {
    src: "bg-scene-1.png"    // matches sceneId from orchestrator
  }
})
```

**Person items (REQUIRED for each overlay scene):** For every overlay scene, add a matte item on `trk-V3` covering the same time range. Uses the stacked video (combined color+matte).

```
// For each overlay scene:
add_item({
  trackId: "trk-V3",
  type: "person",
  startMs: 0,
  endMs: 5720,
  transform: { x: 0, y: 0, width: CANVAS_W, height: CANVAS_H, rotation: 0, opacity: 1 },
  data: {
    stackedSrc: "matte/scene-1-stacked.mp4",   // stacked video from orchestrator
    startFrom: 0                                 // stacked videos are pre-clipped to scene range
  }
})
```
```

- [ ] **Step 3: Replace Step 3 (speaker transforms) with video cutting logic**

Replace the Step 3 section with:

```markdown
### Step 3: Cut source video at scene boundaries

Split the source video at every scene boundary. Then delete segments where the speaker isn't directly visible.

**Which scenes get video cuts:**
| Scene type | Depth status | Video action |
|---|---|---|
| Overlay | READY | **CUT OUT** — delete segment. bg-plate (V1) + person matte (V3) replace it |
| Overlay | FAILED | **KEEP** — no depth assets, video stays as fallback |
| Fullscreen | n/a | **CUT OUT** — delete segment. Animations fill V4, nothing behind |
| Stacked | n/a | **KEEP** — transform to bottom portion of canvas |

**Algorithm:**
1. Read the manifest and list all video items on the video track, sorted by startMs
2. List ALL scene boundaries from SCENE_PLAN.md, sorted by startMs
3. Split the video at every scene boundary:
   - For each boundary timestamp, find the video segment spanning it
   - Call `split_item` at that timestamp → `{ originalId, newId }`
   - After splitting: also split paired audio item at the same timestamp (but NEVER delete audio)
4. After all splits, each video segment maps to exactly one scene. Process each:

   **DELETE segments** (scenes where speaker video is not shown):
   ```
   // Fullscreen scene — animations cover everything
   remove_item({ itemId: "vid-fullscreen-segment" })

   // READY overlay — bg-plate + person matte replace it
   remove_item({ itemId: "vid-overlay-segment" })
   ```

   **KEEP segments** (scenes where speaker video is visible):
   ```
   // Stacked — speaker in bottom portion
   update_item({
     itemId: "vid-stacked-segment",
     transform: { x: 0, y: SCENE_H, width: CANVAS_W, height: CANVAS_H - SCENE_H }
   })

   // FAILED overlay — full canvas fallback
   update_item({
     itemId: "vid-failed-overlay-segment",
     transform: { x: 0, y: 0, width: CANVAS_W, height: CANVAS_H }
   })
   ```

5. Re-read manifest to verify V0 track state

**Example — 4 scenes: Stacked → Overlay(READY) → Fullscreen → Stacked**
```
Before cuts (single continuous video):
  V0: [═══════════════════ source.mp4 ═══════════════════]
       0        6000       12000       18000       24000ms

After splitting at 6000, 12000, 18000:
  V0: [seg-A] [seg-B] [seg-C] [seg-D]

After deleting overlay + fullscreen segments (B and C):
  V0: [seg-A]                         [seg-D]
       0    6000                     18000  24000ms
              ↑ gap (overlay) ↑  ↑ gap (FS) ↑

  V1: ........[bg-scene-2.png]....................  ← bg-plate fills overlay gap
  V3: ........[stacked.mp4]........................  ← person matte fills overlay gap
  V4: ........[Scene2.tsx]......[Scene3.tsx].......  ← animations on both gaps

  seg-A: stacked transform (bottom portion)
  seg-D: stacked transform (bottom portion)
  Fullscreen gap: V4 animation covers the empty V0
  Overlay gap: V1 bg-plate + V3 person + V2/V4 animations
```

**IMPORTANT:** Always split paired audio items at the same timestamps, but NEVER delete audio segments. Audio plays continuously across all gaps.
```

- [ ] **Step 4: Update the track structure table**

Replace the track structure table with:

```markdown
## Track Structure (after Layout Editor)

| Track | Type | Position | Contents |
|---|---|---|---|
| V5 | `overlay` | 5 | Captions, foreground HUD (Final Editor) |
| V4 | `overlay` | 4 | Animations IN FRONT of speaker |
| V3 | `overlay` | 3 | Matted speaker (stacked video, overlay scenes only) |
| V2 | `overlay` | 2 | Animations BEHIND speaker |
| V1 | `overlay` | 1 | Clean background images (overlay scenes only) |
| V0 | `video` | 0 | Source video (ONLY during stacked scenes — cut for overlay/fullscreen) |
| A0 | `audio` | — | Speaker audio — continuous, never cut |
```

- [ ] **Step 5: Commit**

```bash
git add packages/sandbox/src/prompts/layout-editor/system.md
git commit -m "feat: update layout editor for video cuts, V1-V4 tracks, and stacked matte items"
```

---

### Task 7: Enhanced overlay positioning system

**Files:**
- Modify: `packages/sandbox/src/prompts/planner/system.md` — speaker positioning directives
- Modify: `packages/sandbox/src/prompts/layout-editor/system.md` — matte item transforms, scene splitting, punch-ins
- Modify: `packages/sandbox/src/prompts/animator/system.md` — face avoidance, depth layer coding patterns

This task implements the core insight from the reference edits in sandbox-4fc2c8e9: **the Layout Editor actively composes the shot** by repositioning the speaker, splitting scenes across tracks, and adding punch-in keyframes. This isn't just "place items" — it's cinematography.

#### Reference patterns from sandbox-4fc2c8e9

```
Scene 1 — "Content above speaker":
  Person:   x:-90, y:292, w:1173, h:1900  (pushed DOWN 292px, oversized 8%)
  Scene-bg: x:32, y:-146, w:1000, h:960   (above speaker, behind)
  Result:   Title/stats sit above head, speaker occupies lower 2/3

Scene 5 — "Content above AND below speaker":
  Person:   x:-99, y:183, w:1329, h:1821  (pushed down, oversized 23%)
  Scene-bg: x:-31, y:-115, w:1064, h:541  (stat behind speaker, upper zone)
  Scene-fg: x:272, y:1263, w:1064, h:422  (bullet list, lower third, in front)
  Result:   $390M stat peeks from behind shoulders, bullets below

Scene 6 — "Lower third overlay":
  Person:   x:0, y:34, w:1080, h:1920     (near-default, full canvas)
  Scene-fg: x:40, y:880, w:1000, h:960    (VS comparison in lower half, in front)
  Result:   Comparison content below chest, speaker dominates upper half
```

**Key rules derived:**
1. **Person items are oversized 10-25%** wider than canvas to prevent bg graphics leaking around edges
2. **Speaker can be moved DOWN** (positive y offset) to create space above for animations
3. **Scenes with both behind + in-front elements get SPLIT** into two items on different tracks
4. **Punch-in keyframes on matte items** (scale 1→1.25 or 1→1.3) for emphasis moments synced to transcript

---

- [ ] **Step 1: Add speaker positioning directives to planner prompt**

In `packages/sandbox/src/prompts/planner/system.md`, in the Overlay section, add:

```markdown
**Speaker positioning (MANDATORY for all overlay scenes):**

In overlay mode, the speaker is composited on a generated background — you have full control over WHERE the speaker sits on the canvas. Use this to create space for animations:

**Speaker position presets:**
| Preset | Speaker Y offset | Best for |
|---|---|---|
| `speaker-default` | y: 0 | Lower-thirds only, content below chest |
| `speaker-lowered` | y: +200-300px | Content ABOVE head — speaker pushed to lower 2/3 |
| `speaker-centered` | y: 0 | Content flanking both sides, balanced |

Every overlay scene MUST specify:
- **Speaker position:** one of the presets above
- **Content zones:** where animations appear relative to the speaker
- **Depth layers:** which elements go behind vs in front
- **Punch-in moments:** scale emphasis synced to transcript highlights. EVERY overlay scene should have at least one punch-in. Most should have 2-3.

**Face avoidance is absolute:** The speaker's face must NEVER be covered. The face is the top 30% of the speaker bbox. Animations go above the head, below the chest, or peek from behind shoulders. No exceptions.

**Scene splitting rule:** If an overlay scene has elements on BOTH behind-speaker AND in-front-of-speaker layers, the plan must call this out explicitly: "Split: Scene7 (behind) + Scene8 (in front)". The Layout Editor will place them on separate tracks with the person matte between them.

### Animation brief (overlay)

Required for each element:
- **Layer:** `behind-speaker` or `in-front-of-speaker`
- **Zone:** `above-head`, `below-chest`, `lower-third`, `flank-left`, `flank-right`
- **Motion:** animation direction and timing
- **Punch-ins:** 1-3 per overlay scene. Mark each with transcript anchor word + scale (1.15x for subtle, 1.25x for emphasis, 1.35x for dramatic). Punch-ins are a PRIMARY editing tool — they add energy and direct viewer attention. Every key stat, emotional beat, or topic shift should get one.

Example — content above AND below:
"Speaker position: speaker-lowered. As the speaker says '$390 million', a large stat counter (behind-speaker, above-head zone) emerges above the speaker's head, partially occluded by their crown. Scale counter punch-in 1.25x at '$390 million'. A bullet list (in-front-of-speaker, lower-third zone) slides up from bottom as the speaker lists consequences. Split: Scene7 (behind stats) + Scene8 (front bullets)."

Example — lower third only:
"Speaker position: speaker-default. A comparison card (in-front-of-speaker, below-chest zone) appears in the lower portion. Speaker stays at default position. Punch-in 1.3x at the conclusion."
```

- [ ] **Step 2: Add self-verification checklist items to planner prompt**

```markdown
- [ ] **Speaker position:** Every overlay scene specifies a speaker position preset
- [ ] **Face avoidance:** No element targets the face zone (center-screen, head area)
- [ ] **Depth layers:** Every overlay element specifies behind-speaker or in-front-of-speaker
- [ ] **Scene splitting:** Overlay scenes with BOTH layers are marked for splitting
- [ ] **Punch-ins:** EVERY overlay scene has 1-3 punch-ins. Key stats, emotional beats, topic shifts all get a punch-in. Vary scale: 1.15x (subtle), 1.25x (standard), 1.35x (dramatic)
```

- [ ] **Step 3: Rewrite layout editor overlay positioning — think like an editor**

The Layout Editor is not a mechanical item placer. For overlay scenes, it IS the cinematographer. It reads the plan's animation brief, understands what spatial arrangement the animation needs, and calculates exact transforms to make the composition work.

Replace the overlay person/scene item placement section in `packages/sandbox/src/prompts/layout-editor/system.md` with:

```markdown
### Overlay Compositing — Think Like an Editor

For every overlay scene, you are making a composition decision. You have:
- The speaker's body position (from `get_speaker_position`)
- The animation brief (from SCENE_PLAN.md — what content goes where)
- Full control over the matte item's position, size, and keyframes
- Full control over the scene item's position and size

**Your job is to read the brief, understand what the animation needs spatially, and calculate the exact transforms that make the composition work.**

#### The mental model

Imagine the canvas as a stage. The speaker is standing on it. You can:
1. Move the speaker (shift matte item's y) — push them down to create headroom, or keep them centered
2. Scale the speaker (oversize the matte item) — prevent graphics from leaking around edges
3. Place the animation canvas (scene item transform) — position it exactly where the brief says content should go
4. Add emphasis (punch-in keyframes) — zoom in on the speaker at key transcript moments

#### Step-by-step for EACH overlay scene

**A. Read the brief and determine spatial needs:**

Ask: "Where does the animation content go?"
- Above the speaker's head → need headroom → push speaker DOWN
- Below the speaker's chest → lower-third → speaker stays at default
- Both above and below → push speaker to middle, split scene into two items
- Behind speaker shoulders → need oversized person to cover edges

**B. Call `get_speaker_position` and read the bbox:**

```
speaker.bounds = { top: 188, bottom: 1833, left: 0, right: 1080 }
speaker.center = { x: 540, y: 1010 }
```

The bbox tells you WHERE the speaker's body actually is in the source video. Use this to calculate offsets.

**C. Calculate matte item transform:**

Start from the speaker bbox and apply adjustments:

```
// Base: speaker fills canvas with 15% oversize to prevent edge leaking
const oversize = 1.15;
const personW = Math.round(CANVAS_W * oversize);
const personH = Math.round(CANVAS_H * oversize);
const personX = Math.round(-(personW - CANVAS_W) / 2);  // center horizontally

// Then adjust Y based on spatial needs:
```

| Brief says | Person Y calculation | Scene item zone |
|---|---|---|
| "above-head" content | `personY = +200 to +300` (push speaker down) | Scene at `y: -150 to 0`, `h: 400-600` (top of canvas) |
| "lower-third" content | `personY = 0` (speaker at natural position) | Scene at `y: CANVAS_H * 0.6`, `h: CANVAS_H * 0.4` (bottom 40%) |
| "above AND below" | `personY = +150` (moderate push down) | Split: V2 scene at top, V4 scene at bottom |
| "flanking" content | `personY = 0` | Scene uses full width, positioned at sides |

**D. Calculate scene item transform:**

The scene item transform defines where the animation renders on canvas. Match it to the brief's zones:

```
// "above-head" — scene occupies the top strip above the speaker
sceneTransform = {
  x: 0,
  y: -100,                    // can extend above canvas (negative y)
  width: CANVAS_W,
  height: 500,                // enough for headline + stat
}

// "lower-third" — scene occupies bottom portion
sceneTransform = {
  x: 40,                      // slight padding
  y: speaker.bounds.bottom - 200,  // starts at chest level
  width: CANVAS_W - 80,
  height: CANVAS_H - speaker.bounds.bottom + 200,
}

// "full overlay" — scene spans most of canvas, speaker in front occludes center
sceneTransform = {
  x: 0,
  y: 0,
  width: CANVAS_W,
  height: CANVAS_H,
}
```

**E. Scene splitting (when brief says "Split"):**

When the plan marks a scene for splitting, create TWO scene items with TWO separate skeleton files:

```
// Behind-speaker content → V2
add_item({
  trackId: "trk-V2",
  type: "scene",
  data: { sceneFile: "Scene5Behind.tsx", displayMode: "overlay" },
  transform: { x: -31, y: -115, width: 1064, height: 541 },  // upper zone, behind
})

// In-front-of-speaker content → V4
add_item({
  trackId: "trk-V4",
  type: "scene",
  data: { sceneFile: "Scene5Front.tsx", displayMode: "overlay" },
  transform: { x: 272, y: 1263, width: 1064, height: 422 },  // lower zone, in front
})
```

The Setup Agent must create BOTH skeleton files when the plan calls for a split.

**F. Punch-in keyframes (V1 background + V3 person — matched):**

A punch-in zooms the camera on the speaker. Since background and person are on separate layers, BOTH must zoom together with identical keyframes. Animations on V2/V4 stay at their own scale — they have their own choreography.

When the plan specifies a punch-in moment (e.g., "punch-in 1.25x at '$390 million'"):

1. Find the transcript word timestamp for the anchor phrase
2. Convert to relative timeMs within the items
3. Add MATCHING scale keyframes to BOTH the V1 bg-plate image AND V3 matte item:

```
// Punch-in = zoom V1 + V3 together. V2/V4 animations stay unchanged.
const punchScale = 1.25;

// --- V3 matte item keyframes ---
const punchPersonW = Math.round(personW * punchScale);
const punchPersonH = Math.round(personH * punchScale);
const punchPersonX = Math.round(-(punchPersonW - CANVAS_W) / 2);
const punchPersonY = personY - Math.round((punchPersonH - personH) * 0.3);

personKeyframes: [
  { timeMs: anchorMs - 150, props: { x: personX, y: personY, width: personW, height: personH } },
  { timeMs: anchorMs + 150, props: { x: punchPersonX, y: punchPersonY, width: punchPersonW, height: punchPersonH } },
  { timeMs: anchorMs + 2150, props: { x: punchPersonX, y: punchPersonY, width: punchPersonW, height: punchPersonH } },
  { timeMs: anchorMs + 2450, props: { x: personX, y: personY, width: personW, height: personH } },
]

// --- V1 bg-plate image keyframes (SAME timing, SAME scale) ---
const bgW = CANVAS_W;  // bg starts at full canvas
const bgH = CANVAS_H;
const punchBgW = Math.round(bgW * punchScale);
const punchBgH = Math.round(bgH * punchScale);
const punchBgX = Math.round(-(punchBgW - CANVAS_W) / 2);
const punchBgY = Math.round(-(punchBgH - CANVAS_H) * 0.3);  // same zoom origin

bgKeyframes: [
  { timeMs: anchorMs - 150, props: { x: 0, y: 0, width: bgW, height: bgH } },
  { timeMs: anchorMs + 150, props: { x: punchBgX, y: punchBgY, width: punchBgW, height: punchBgH } },
  { timeMs: anchorMs + 2150, props: { x: punchBgX, y: punchBgY, width: punchBgW, height: punchBgH } },
  { timeMs: anchorMs + 2450, props: { x: 0, y: 0, width: bgW, height: bgH } },
]
```

The result: background and speaker zoom together like a real camera push-in. Animations hold position — intentional, like a HUD staying fixed while the camera moves.

**G. Verify with render_still:**

After placing ALL items for an overlay scene, render a still at the scene's midpoint. Visually confirm:
- Speaker's face is NOT covered by any animation element
- Behind-speaker content peeks from behind shoulders (not floating in empty space)
- Lower-third content is below the chest
- Person item edges don't show (oversizing is sufficient)
```

- [ ] **Step 4: Commit**

```bash
git add packages/sandbox/src/prompts/planner/system.md packages/sandbox/src/prompts/layout-editor/system.md
git commit -m "feat: enhanced overlay positioning — speaker presets, scene splitting, punch-ins"
```

---

### Task 8: Update animator and layer-compositing prompts — face avoidance

**Files:**
- Modify: `packages/sandbox/src/prompts/animator/system.md`
- Modify: `packages/sandbox/src/prompts/shared/layer-compositing.xml`

The animator must respect face avoidance zones and use depth layers as specified in the plan.

- [ ] **Step 1: Add face avoidance rules to animator prompt**

In `packages/sandbox/src/prompts/animator/system.md`, in the `<rules>` section, after the "Layout First, Then Animate" section, add a new section:

```markdown
---

## CRITICAL — Face Avoidance for Overlay Scenes

**Your #4 failure mode is covering the speaker's face with animation elements.** In overlay mode, the speaker is full-screen and their face is the viewer's primary visual anchor. Covering it breaks eye contact and looks unprofessional.

### The rules:

**1. NEVER place content over the speaker's face.** The face is approximately `SPEAKER.bboxPx.y` to `SPEAKER.bboxPx.y + SPEAKER.bboxPx.h * 0.3` (top 30% of the speaker bbox). No text, shapes, stats, or visual elements in this region.

**2. Primary content goes ABOVE or BELOW the speaker:**
- **Upper zone** (above `SPEAKER.bboxPx.y`): Headers, labels, stats. Use `VISIBLE_ZONES.top`.
- **Lower zone** (below `SPEAKER.bboxPx.y + SPEAKER.bboxPx.h * 0.6`): Cards, bars, detail text. Use `VISIBLE_ZONES.bottom`.

**3. Behind-speaker elements at SHOULDER height, not face height:**
- Elements using BehindSpeaker layer should position at `SPEAKER.centerPx.y + SPEAKER.bboxPx.h * 0.2` or lower (chest/shoulder level).
- This creates the depth peek effect at the body without occluding the face.

**4. Flank elements on the SIDES, not center:**
- Use `VISIBLE_ZONES.left` and `VISIBLE_ZONES.right` for side content.
- Content should be positioned at `x < SPEAKER.bboxPx.x` or `x > SPEAKER.bboxPx.x + SPEAKER.bboxPx.w`.

### Quick reference for overlay element placement:
```
┌─────────────────────────┐
│     UPPER ZONE          │  ← Headers, labels, stats (in-front OK)
│     (above head)        │
├─────────────────────────┤
│  ┌─┐  FACE ZONE  ┌─┐   │  ← FORBIDDEN — no elements here
│  │F│  ██████████  │F│   │
│  │L│  ██ FACE ██  │L│   │     FL/FR = flank zones (behind-speaker OK)
│  │A│  ██████████  │A│   │
│  │N│              │N│   │
│  │K│  SHOULDERS   │K│   │  ← Behind-speaker elements peek here
│  │ │              │ │   │
│  └─┘              └─┘   │
├─────────────────────────┤
│     LOWER ZONE          │  ← Cards, bars, detail text (both layers OK)
│     (below chest)       │
└─────────────────────────┘
```
```

- [ ] **Step 2: Update layer-compositing.xml with face avoidance**

In `packages/sandbox/src/prompts/shared/layer-compositing.xml`, add a new section after `<multi_element_scenes>`:

```xml
<face_avoidance>
  The speaker's face is the viewer's primary visual anchor. NEVER occlude it.

  Face region: SPEAKER.bboxPx.y to SPEAKER.bboxPx.y + SPEAKER.bboxPx.h * 0.3
  This is approximately the top 30% of the speaker's bounding box.

  Safe placement zones (prefer these):
  - ABOVE head: y less than SPEAKER.bboxPx.y (use VISIBLE_ZONES.top)
  - BELOW chest: y greater than SPEAKER.bboxPx.y + SPEAKER.bboxPx.h * 0.6 (use VISIBLE_ZONES.bottom)
  - LEFT flank: x less than SPEAKER.bboxPx.x (use VISIBLE_ZONES.left)
  - RIGHT flank: x greater than SPEAKER.bboxPx.x + SPEAKER.bboxPx.w (use VISIBLE_ZONES.right)

  Behind-speaker elements:
  - Position at SHOULDER or CHEST height for the depth peek effect
  - NOT at face height — even partially occluded face looks wrong
  - Use SPEAKER.centerPx.y + offset to target below the chin

  In-front-of-speaker elements:
  - Upper zone (above head) and lower zone (below chest) ONLY
  - NEVER overlay the face, even with semi-transparent elements
</face_avoidance>
```

- [ ] **Step 3: Commit**

```bash
git add packages/sandbox/src/prompts/animator/system.md packages/sandbox/src/prompts/shared/layer-compositing.xml
git commit -m "feat: add face avoidance rules to animator and layer-compositing prompts"
```

---

## Verification

After all tasks are complete, verify the full pipeline by running a sandbox job with a talking-head video that has overlay scenes in the plan. Check:

1. **Stacked videos created:** `public/matte/{sceneId}-stacked.mp4` exists for each overlay scene with correct dimensions (W x 2H).
2. **Background images created:** `public/bg-{sceneId}.png` exists for each overlay scene. Speaker is cleanly removed.
3. **Video properly cut:** V0 track has gaps where overlay/fullscreen scenes are. Audio is continuous.
4. **V1 populated:** Image items on V1 for each overlay scene, pointing to generated backgrounds.
5. **V3 populated:** Person items oversized 10-20% with correct speaker position presets from plan.
6. **Composition quality:** Render stills at midpoints of overlay scenes. Speaker's face is clear. Animations sit in correct zones (above head / below chest / flanks). Behind-speaker content peeks from shoulders, not floating in empty space.
7. **Scene splitting:** Overlay scenes with both behind + in-front elements have TWO scene items on V2 and V4 respectively.
8. **Punch-ins:** V1 (bg) and V3 (person) have MATCHING scale keyframes at emphasis moments. V2/V4 animations stay at their own scale.

**Compare against reference:** Sandbox-4fc2c8e9 scenes 1, 5, and 6 are the gold standard. The Layout Editor's output for similar overlay compositions should match the spatial quality of those manual edits.
