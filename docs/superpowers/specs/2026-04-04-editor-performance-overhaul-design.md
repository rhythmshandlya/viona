# Editor Performance Overhaul

**Date:** 2026-04-04
**Status:** Draft (reviewed)

## Problem

The editor is unusable with depth-composited projects. A typical project loads ~346MB of media through a 3-hop Node.js proxy chain, the matte compositor blocks the main thread with ~500MB/s of pixel shuffling, and 14+ React components re-render every frame during playback. The result: long initial load, choppy playback, laggy scrubbing, and full UI freezes.

## Audit Findings

### Media Loading (346MB through proxy chain)
- Source video (160MB) served via Fastify streaming from MinIO (1-hop proxy, not truly direct)
- Audio (2.6MB), matte fgr (169MB), matte alpha (14MB), bg images (15MB) route through 3-hop chain: Browser → Next.js rewrite → Fastify API → sandbox Express → Docker filesystem
- All preloads fire simultaneously with no prioritization, competing for 6 HTTP/1.1 connections on the same origin
- Proxy files exist (`source-proxy.mp4` at 4.7MB, `audio-proxy.aac` at 542KB) but never used in browser — `WorkspacePlayer.tsx:198` strips assets map to `{}`
- `asset-sync.ts` already uploads all public files to MinIO and generates presigned URLs in `manifest.assets`, but the assets map is stripped before reaching the Remotion Player
- `asset-sync.ts:58` does NOT recurse into subdirectories — matte files in `public/matte/` are never uploaded or given presigned URLs
- `syncAssets()` only runs once at init — never re-runs after matte download

### Matte Compositing (main thread blocked every frame)
- `MatteItem.tsx` does two `getImageData` (8.3MB each) + one JS pixel loop + one `putImageData` per frame
- At 1080x1920 @ 30fps = ~500MB/s of CPU pixel throughput
- Canvas `tmpCanvas` dimensions reset every frame (forces backing store re-allocation)
- `willReadFrequently` hint missing on the main canvas
- `getContext('2d')` called every frame instead of cached
- `SandwichComposite.tsx` has the same issue but slightly cheaper (~16.6MB/frame vs ~24.9MB) and lacks the `lastTimeRef` dedup guard

### React Re-renders (14+ components at 30fps)
- `currentTimeMs` zustand state updates at 30fps during playback
- 14+ components subscribe, including: `Scene.tsx`, `TranscriptPanel`, `StylePanel`, `ItemDragOverlay`, `Timeline`, `TimelineRuler`, `PlaybackBar`, `PreviewControls`, `BrollPanel`, `KeyframeList`, `MiniTimeline`, `ContextMenu`, `use-keyboard-shortcuts`
- `Scene.tsx` subscribes only for click-to-select hit testing — doesn't need per-frame updates
- `PlayerComposition` and `ItemRenderer` are not memoized — entire Remotion tree re-renders on manifest changes

### Matte File Size
- **Correction:** Matte and fgr are already at 0.5x source resolution (540x960), NOT 1.0x. `segment_person.py:38` sets `SCALE_FACTOR = 0.5`, and the worker passes `--scale 1.0` which overrides to full source res. Actual output from segmentation.ts `--scale 1.0` = 1080x1920.
- Matte and fgr share the same encoder (`make_ffmpeg_encoder`) with identical quality: NVENC `h264_nvenc -preset p1 -rc constqp -qp 18` (or libx264 `-crf 18 -preset ultrafast` fallback)
- Matte is grayscale tripled to RGB (`np.stack([matte_u8]*3)`) before encoding — wastes 3x pipe bandwidth but output is identical since `yuv420p` stores luma at full res
- Matte fgr (169MB) is the largest file — straight alpha foreground has high entropy

## Design

### Phase 1: MinIO Direct Serving

**Goal:** Eliminate the proxy chain. Serve all media directly from MinIO/S3 via presigned URLs.

**Prerequisites:**

1. **Configure MinIO CORS** (critical — currently not configured)
   - Presigned URLs are cross-origin. Without CORS:
     - `<video>` elements load for playback, BUT canvas `getImageData` on cross-origin video frames throws `SecurityError` (taints the canvas) — **breaks matte compositing completely**
     - Remotion's `prefetch()` for images uses `fetch()` which requires CORS
   - Required MinIO bucket CORS policy:
     ```json
     {
       "CORSRules": [{
         "AllowedOrigins": ["https://your-app-domain.com", "http://localhost:3000"],
         "AllowedMethods": ["GET", "HEAD"],
         "AllowedHeaders": ["Range"],
         "ExposeHeaders": ["Content-Range", "Content-Length", "Accept-Ranges", "ETag"],
         "MaxAgeSeconds": 86400
       }]
     }
     ```
   - Set via `mc admin config set` or S3 PutBucketCors API

2. **Add `crossorigin="anonymous"` to all `<Video>` elements**
   - `MatteItem.tsx`: both fgr and matte `<Video>` elements
   - `VideoItem.tsx`: the visible video element
   - `SandwichComposite.tsx`: all three video elements
   - Remotion's `<Video>` component supports `crossOrigin` prop

**What changes:**

1. **Fix `asset-sync.ts` to recurse into subdirectories**
   - Currently `readdir(PUBLIC_DIR, { withFileTypes: true })` only reads top-level files
   - Matte files in `public/matte/` are skipped — never get presigned URLs
   - Change to recursive walk, preserving relative paths as asset keys (e.g., `matte/scene-1.mp4`)

2. **Re-run `syncAssets()` after matte download**
   - `check_segmentation_status` in `asset-server.ts:1037-1145` downloads matte/fgr/bg to workspace
   - Currently `syncAssets()` never runs again — matte files never get presigned URLs
   - Call `syncAssets()` (or incremental variant) after download completes

3. **Frontend: stop stripping the assets map**
   - `WorkspacePlayer.tsx:198` passes `assets: {}` — change to pass full assets map
   - `resolveMediaSrc.ts` already checks assets map first, falls back to `staticFile()`
   - Preload URLs in `WorkspacePlayer.tsx` must also resolve through the assets map (not just `customStaticFile`)

4. **Presigned URL lifecycle**
   - Increase TTL from 8h to 24h (covers most editing sessions)
   - Add frontend error handling: on 403 from MinIO (expired signature), request manifest refresh from sandbox to regenerate presigned URLs
   - Fallback: if presigned URL fails, fall through to sandbox proxy path (existing `staticFile()` fallback)

5. **Remove `resolveDirectMediaUrl` special case**
   - The hardcoded `source.mp4` → `/api/projects/{id}/video` bypass is no longer needed
   - All media resolves from the assets map uniformly

**Note:** The sandbox still needs local files for `remotion render` (headless Chrome in Docker can't reach presigned public URLs). `resolveMediaSrc.ts:66-69` already skips the assets map when `isRendering=true` and uses `staticFile()` (local filesystem). No change needed for rendering.

**Impact:** All media served directly from MinIO. Eliminates Node.js event loop bottleneck. CDN-ready for S3 + CloudFront. Same 6-connection limit per origin (MinIO is still one origin), but each request is 1 hop instead of 3.

### Phase 2: Proxy Workflow

**Goal:** Edit with low-res proxy files (~25MB total), render with full-res.

**Prerequisites:** Phase 1 (assets map not stripped, `syncAssets` recursive).

**What changes:**

1. **Matte proxy generation via FFmpeg downscale (not re-inference)**
   - After `segment_person.py` produces full-res matte + fgr, use FFmpeg to downscale:
     ```bash
     ffmpeg -i scene-1.mp4 -vf scale=-2:480 -c:v libx264 -preset ultrafast -crf 28 -y scene-1-proxy.mp4
     ffmpeg -i scene-1-fgr.mp4 -vf scale=-2:480 -c:v libx264 -preset ultrafast -crf 28 -y scene-1-fgr-proxy.mp4
     ```
   - Adds ~5-10 seconds to segmentation pipeline (not minutes for re-inference)
   - Upload proxy files to MinIO alongside full-res in `segmentation.ts`

2. **Audio proxy already exists**
   - `audio-proxy.aac` (64kbps mono, 542KB) generated at workspace init
   - Already uploaded to MinIO by `syncAssets()` — just needs to be in the assets map (fixed by Phase 1)

3. **Source video proxy already exists**
   - `source-proxy.mp4` (270x480, CRF 28, ~4.7MB) generated at workspace init
   - Same as audio — already in MinIO via `syncAssets()`

4. **Frontend proxy resolution (already implemented, just disabled)**
   - `resolveMediaSrc.ts:55-61` has `deriveProxyKey()` logic: when `!isRendering`, derives proxy key (e.g., `source.mp4` → `source-proxy.mp4`), checks assets map
   - Currently dead code because assets map is `{}` — Phase 1 fixes this
   - `deriveProxyKey` uses `PROXY_EXTENSIONS` map: `.mp4`→`-proxy.mp4`, `.aac`→`-proxy.aac`, `.png`→`-proxy.webp`
   - Fallback is transparent: if proxy not in assets map, falls through to full-res

5. **Fix `SandwichComposite.tsx` to use `resolveMediaSrc`**
   - Currently has its own `resolveSrc()` (lines 163-168) that bypasses assets map and proxy logic
   - Must accept `assets` prop and use `resolveMediaSrc()` like `MatteItem` does
   - Without this, SandwichComposite always loads full-res (defeats the purpose for depth scenes)

6. **Fix preloading to use proxy URLs**
   - `WorkspacePlayer.tsx:85-92` resolves preload URLs via `resolveMedia()` which mirrors `customStaticFile`
   - Must also apply `deriveProxyKey` to preload the proxy, not the full-res file
   - Otherwise browser preloads full-res, then composition requests proxy = double bandwidth

**Render-time safety:** `resolveMediaSrc.ts:66-69` skips proxy path when `isRendering=true`, returning `staticFile(src)` (local full-res file). No change needed.

**Impact:** Editor loads ~25MB instead of ~346MB. Scrubbing and seeking dramatically faster.

### Phase 3: Matte Compression

**Goal:** Reduce matte file sizes through encoding optimization.

**Correction from original spec:** The matte is already at 0.5x when using the default `SCALE_FACTOR`, but `segmentation.ts:222` passes `--scale 1.0` which overrides to full source resolution. The matte IS at full res (1080x1920) currently.

**What changes:**

1. **Separate encoder settings for matte vs fgr**
   - Currently both use `make_ffmpeg_encoder` with identical QP 18 / CRF 18
   - Add a `quality` parameter to `make_ffmpeg_encoder` or create `make_matte_encoder`
   - Matte: QP 23-25 (NVENC) / CRF 23-25 (libx264) — saves ~50% file size
   - FGR: QP 20-22 — moderate savings, preserves person detail
   - Avoid QP 28+ on matte: causes visible banding in soft alpha gradients (hair edges) and temporal "breathing" artifacts between I-frames and P-frames

2. **Matte at 0.5x resolution**
   - Change `segmentation.ts:222` from `--scale 1.0` to `--scale 0.5` for the matte output only
   - Requires `segment_person.py` to accept separate scale for matte vs fgr, OR downscale the matte tensor in Python with `cv2.resize` before encoding
   - 540x960 matte upscaled to 1080x1920 via canvas `drawImage` (current) or WebGL `GL_LINEAR` (Phase 4) — bilinear filtering provides smooth edges
   - Risk: `SandwichComposite` uses source video (not fgr) + matte. Softer matte edges at 0.5x may cause slight background color bleed at edges. Acceptable tradeoff given fgr is the primary compositing path.

3. **Keep RGB H.264 yuv420p output**
   - Browser video decoders don't reliably support monochrome H.264 profiles
   - Optionally switch rawvideo pipe from `rgb24` to `gray` input format to reduce IPC bandwidth 3x (minor optimization)
   - VP9 not worth the complexity — CRF tuning within H.264 gives sufficient savings

**Impact:** Matte drops from ~14MB to ~5-7MB (QP tuning) or ~3-4MB (QP + 0.5x scale). FGR drops from ~169MB to ~100-120MB (QP tuning).

### Phase 4: WebGL Matte Compositor

**Goal:** Replace canvas2D pixel loop with GPU shader. Zero main-thread blocking.

**What changes:**

1. **New `WebGLMatteCompositor` component** replaces `MatteItem.tsx`
   - WebGL canvas with `{ alpha: true, premultipliedAlpha: true }` context attributes
   - `alpha: true` required so transparent pixels composite over background layers
   - Fragment shader (premultiplied output for correct CSS compositing):
   ```glsl
   precision mediump float;
   uniform sampler2D uFgr;
   uniform sampler2D uMatte;
   varying vec2 vUv;
   void main() {
       vec4 fgr = texture2D(uFgr, vUv);
       float alpha = texture2D(uMatte, vUv).r;
       gl_FragColor = vec4(fgr.rgb * alpha, alpha);
   }
   ```
   - Vertex shader (fullscreen quad):
   ```glsl
   attribute vec2 aPosition;
   varying vec2 vUv;
   void main() {
       vUv = aPosition * 0.5 + 0.5;
       gl_Position = vec4(aPosition, 0.0, 1.0);
   }
   ```
   - **Y-flip required:** `gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)` before `texImage2D` calls, or flip UV in vertex shader. Without this, the person renders upside down.
   - Two hidden `<Video>` elements feed textures via `gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, videoElement)` — single GPU-to-GPU transfer, no CPU readback
   - Texture params: `CLAMP_TO_EDGE` (required for non-power-of-2 video dimensions), `LINEAR` filtering (provides free bilinear upscaling for half-res matte from Phase 3)

2. **Use raw WebGL, not a library**
   - Total setup is ~60 lines of boilerplate (create program, compile shaders, 2 textures, 1 vertex buffer)
   - No scene graph, no matrix math, no multiple draw calls — twgl.js/regl not justified

3. **Render loop**
   - Driven by Remotion `useCurrentFrame()` in `useEffect` — NOT a `requestAnimationFrame` loop
   - Same `lastTimeRef` guard as current MatteItem: skip draw if video frame unchanged
   - `gl.clearColor(0, 0, 0, 0)` + `gl.clear()` before each draw to ensure transparency

4. **Fallback**
   - If `canvas.getContext('webgl')` returns null, fall back to current canvas2D approach
   - Works in headless Chrome: `remotion.config.ts` already configures SwANGLE (software WebGL) for Linux Docker

5. **Context loss handling**
   - `canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); })` — `preventDefault()` required to allow restoration
   - `canvas.addEventListener('webglcontextrestored', () => { reinitialize(); })`
   - During loss period: canvas shows last good frame (transparent fallback)

6. **Also upgrade `SandwichComposite.tsx`**
   - Same WebGL approach but with source video as the "foreground" texture (not fgr)
   - Lower priority: grep found zero `.tsx` consumers of SandwichComposite currently
   - Unify its `resolveSrc()` with `resolveMediaSrc()` (Phase 2 dependency)

**Impact:** Eliminates ~500MB/s CPU pixel throughput. Compositing becomes a single GPU draw call (~0.1ms vs ~15ms for canvas2D).

### Phase 5: Zustand Transient Updates

**Goal:** Stop 14+ components from re-rendering at 30fps during playback.

**Quick wins (zero risk, immediate — use `getState()` in handlers):**

1. **`Scene.tsx:92`** — subscribes for click-to-select hit testing. Use `useEditorStore.getState().currentTimeMs` inside the click handler. No subscription needed.
2. **`TimelineRuler.tsx:63`** — `currentTimeMs` in `useEffect` deps but not used in draw code. Remove from deps.
3. **`StylePanel.tsx:53`** — only reads time for a button callback. Use `getState()`.
4. **`KeyframeList.tsx:54`** — only reads time for "add keyframe at current time". Use `getState()`.
5. **`use-keyboard-shortcuts.ts:81`** — reads time for paste/step actions. Use `getState()` in keydown handler.
6. **`ContextMenu.tsx:93`** — reads time for split/keyframe actions. Use `getState()` in callbacks.

**Subscribe + ref mutation (visual updates without React re-renders):**

7. **`Playhead.tsx:23`** — update `style.transform` via ref:
   ```tsx
   useEffect(() => {
     return useEditorStore.subscribe(
       (state) => state.currentTimeMs,
       (timeMs) => {
         if (ref.current) ref.current.style.transform = `translateX(${timeMs * pxPerMs}px)`;
       }
     );
   }, [pxPerMs]);
   ```
8. **`PlaybackBar.tsx:33`** — update time display + progress bar width via ref
9. **`PreviewControls.tsx:50`** — update timecode display via ref, `getState()` for button handlers
10. **`MiniTimeline.tsx:29`** — subscribe + ref for keyframe editor playhead (low priority, usually paused)

**Conditional / throttled subscriptions:**

11. **`ItemDragOverlay.tsx:98`** — guard on active drag state; only subscribe when dragging keyframed items
12. **`TranscriptPanel.tsx:39`** — subscribe to derived value (active word index), re-render only on word boundary changes (~200ms intervals)
13. **`BrollPanel.tsx:52`** — subscribe to derived value (active clip), re-render only on clip boundary
14. **`Timeline.tsx:36`** — auto-scroll during play; throttle to ~200ms intervals

**Memoization:**

15. **`PlayerComposition`** — wrap in `React.memo`, memoize `sortedTracks` with `useMemo`
16. **`ItemRenderer`** — wrap in `React.memo` (many instances, biggest win)
17. Extract `trackItems` computation from inline JSX into a memoized sub-component per track

**Impact:** ~14 re-renders per frame → ~0 during playback (all visual updates via refs or throttled subscriptions).

## Implementation Order

1. **Phase 1 (MinIO direct)** — prerequisite for everything; includes CORS config, recursive asset-sync, stop stripping assets map
2. **Phase 5 (Zustand transient)** — independent of Phase 1, quick React-only fixes, 6 zero-risk quick wins
3. **Phase 2 (Proxy workflow)** — depends on Phase 1 for assets map infrastructure
4. **Phase 3 (Matte compression)** — independent Python/ffmpeg changes
5. **Phase 4 (WebGL compositor)** — most complex, do last; depends on Phase 1 for CORS (`crossorigin` on video elements)

Phases 3 and 5 can run in parallel with Phase 1. Phase 2 and 4 depend on Phase 1.

## Expected Results

| Metric | Before | After |
|--------|--------|-------|
| Media load size (editing) | ~346MB via 3-hop proxy | ~25MB via MinIO presigned URLs |
| HTTP hops for media | 3 (most files) | 0 (direct MinIO/S3) |
| Main thread per-frame cost | ~15ms (canvas pixel loop) | ~0.1ms (WebGL draw call) |
| React re-renders per frame | ~14 components | ~0 (ref mutations) |
| Matte alpha file size | ~14MB (QP 18, full res) | ~3-7MB (QP 23-25, optionally 0.5x) |
| FGR file size (editing) | 169MB full-res | ~5MB proxy |
| Time to first frame | Seconds (346MB competing on 6 connections) | Sub-second (25MB prioritized) |

## Files Changed

### Phase 1
- `packages/sandbox/src/asset-sync.ts` — recursive directory walk, re-run after matte download
- `packages/sandbox/src/mcp-servers/asset-server.ts` — call `syncAssets()` after matte download
- `apps/web/src/features/editor-v2/player/WorkspacePlayer.tsx` — stop stripping assets map, resolve preload URLs from assets map
- `apps/web/src/features/editor-v2/player/useWorkspaceComposition.ts` — remove `resolveDirectMediaUrl` special case
- `packages/sandbox/template/src/items/MatteItem.tsx` — add `crossOrigin="anonymous"` to `<Video>` elements
- `packages/sandbox/template/src/items/VideoItem.tsx` — add `crossOrigin="anonymous"`
- `packages/sandbox/template/src/composition/SandwichComposite.tsx` — add `crossOrigin="anonymous"`
- MinIO/S3: configure CORS policy on the `viona` bucket

### Phase 2
- `packages/worker/src/processors/segmentation.ts` — FFmpeg proxy generation after full-res output, upload proxy files
- `packages/sandbox/template/src/composition/SandwichComposite.tsx` — use `resolveMediaSrc()` instead of local `resolveSrc()`
- `apps/web/src/features/editor-v2/player/WorkspacePlayer.tsx` — apply `deriveProxyKey` in preload resolution

### Phase 3
- `packages/worker/scripts/segment_person.py` — separate encoder quality for matte (QP 23-25) vs fgr (QP 20-22); optionally add `--matte-scale` parameter

### Phase 4
- `packages/sandbox/template/src/items/MatteItem.tsx` — replace canvas2D with WebGL compositor
- `packages/sandbox/template/src/composition/SandwichComposite.tsx` — same WebGL approach (lower priority)

### Phase 5
- `apps/web/src/features/editor-v2/scene/Scene.tsx` — `getState()` in click handler
- `apps/web/src/features/editor-v2/timeline/TimelineRuler.tsx` — remove `currentTimeMs` from deps
- `apps/web/src/features/editor-v2/panels/StylePanel.tsx` — `getState()` in callback
- `apps/web/src/features/editor-v2/components/keyframe-editor/KeyframeList.tsx` — `getState()` in handler
- `apps/web/src/features/editor-v2/hooks/use-keyboard-shortcuts.ts` — `getState()` in keydown handler
- `apps/web/src/features/editor-v2/timeline/context-menu/ContextMenu.tsx` — `getState()` in actions
- `apps/web/src/features/editor-v2/timeline/Playhead.tsx` — subscribe + ref mutation
- `apps/web/src/features/editor-v2/components/PlaybackBar.tsx` — subscribe + ref mutation
- `apps/web/src/features/editor-v2/components/PreviewControls.tsx` — subscribe + ref for display, getState for handlers
- `apps/web/src/features/editor-v2/components/ItemDragOverlay.tsx` — conditional subscription
- `apps/web/src/features/editor-v2/panels/TranscriptPanel.tsx` — derived value subscription
- `packages/sandbox/template/src/PlayerComposition.tsx` — React.memo + useMemo on both components
