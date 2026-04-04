# Live Sandbox Tracking: 4fc2c8e9-67b0-493c-abdf-5519ba2c9fb0

**Started:** 2026-04-01 23:15 IST
**Docker image:** `d9cf927118cf` (built 23:09 IST — contains new segmentation code)
**Container:** `sandbox-4fc2c8e9-67b0-493c-abdf-5519ba2c9fb0`

## Pipeline Progress

| Phase | Status | Time | Notes |
|-------|--------|------|-------|
| Init | DONE | 17:45 UTC | No speaker-grid.json, no segmentation-available.json ✅ |
| Trim Editor | DONE | ~17:48 UTC | Fillers removed |
| Planner | DONE | ~17:52 UTC | 6 scenes, revised once (map feedback) |
| Plan Approval | DONE | ~18:02 UTC | User approved |
| Segmentation Request | FAILED | 18:04 UTC | API returned 500 — BullMQ colon bug (ISSUE 1) |
| Setup Agent | DONE | ~18:07 UTC | Templates forked, skeletons written with default SPEAKER |
| Layout Editor | DONE | ~18:11 UTC | Used DEFAULT speaker bounds (no matte data) |
| Animators | DONE | ~18:33 UTC | 6 scenes animated |
| Final Editor | DONE | ~18:42 UTC | Pipeline complete, $12.53 total cost |
| Manual fixes | DONE | 18:45+ UTC | Matte generation, manifest fixes, WebM alpha encoding |

## Scene Plan

| Scene | Mode | Time | Track | Segmentation |
|-------|------|------|-------|-------------|
| 1 | **Overlay** | 0–5720ms | scene-bg | ✅ Manual |
| 2 | Stacked | 5720–20880ms | scene-fg | N/A |
| 3 | Stacked | 20880–28760ms | scene-fg | N/A |
| 4 | Stacked | 28760–40900ms | scene-fg | N/A |
| 5 | **Overlay** | 40900–53800ms | scene-bg | ✅ Manual |
| 6 | **Overlay** | 53800–65799ms | scene-bg | ✅ Manual |

## Issues Found (Chronological)

### ISSUE 1: BullMQ rejects colons in segmentation job ID ✅ FIXED
**Severity:** CRITICAL
**Root cause:** `queueSegmentationJob` used job ID `${projectId}:segment:${sceneId}:${Date.now()}`. BullMQ in the API's Redis config rejects colons. API returned 500 to the MCP tool. DB record created but never queued to Redis.
**Fix:** Changed to `segment-${sceneId}-${Date.now()}` in `packages/api/src/services/queue.ts`.
**Verified:** Re-queued manually, worker processed successfully.

### ISSUE 2: Only scene-1 segmented, scenes 5+6 missing
**Severity:** Important
**Root cause:** The orchestrator only sent scene-1 in the `request_segmentation` call (even though prompt says "ALL overlay scenes"). LLM judgment error, or the 500 error on scene-1 prevented scene-5/6 from being sent.
**Fix:** Manual — queued scene-5 and scene-6 segmentation jobs directly via API.

### ISSUE 3: Nobody adds person items to person track ✅ FIXED
**Severity:** CRITICAL
**Root cause:** Layout Editor creates person track but no prompt instructed any agent to add person items with `type: "person"` and `matteSrc`.
**Fix:** Updated Layout Editor prompt to create person items for each overlay scene.

### ISSUE 4: Setup Agent runs before Layout Editor — wrong SPEAKER data ✅ FIXED
**Severity:** CRITICAL
**Root cause:** Phase 4 (Setup) → Phase 5 (Layout). Setup Agent bakes SPEAKER constants from manifest, but Layout Editor writes speaker data later.
**Fix:** Setup Agent writes placeholders; Layout Editor overwrites with real values.

### ISSUE 5: Player freezes during overlay scenes ✅ FIXED
**Severity:** CRITICAL
**Root cause:** SandwichComposite used Canvas 2D `getImageData()` — 33MB GPU→CPU copy per frame at 1080x1920. Even with WebGL replacement, 3 simultaneous video decoders overwhelmed the browser.
**Fix:** Pre-encode WebM VP9 with embedded alpha channel. PersonItem uses single `<Video>` element — browser decodes alpha natively. 2 decoders instead of 3, zero pixel processing.

### ISSUE 6: Matte misaligned with speaker — wrong startFrom ✅ FIXED
**Severity:** CRITICAL
**Root cause:** Person items had `startFrom: 40900` (source timeline offset) but the alpha WebM is already clipped to the scene range (starts at frame 0). Remotion tried to seek 40900ms into a 12.9s file.
**Fix:** Set `startFrom: 0` for all person items — the alpha WebM starts at the scene boundary.

### ISSUE 7: Matte misaligned with speaker — no crop matching ✅ FIXED
**Severity:** CRITICAL
**Root cause:** Video track has `crop: { x: 51, y: 9, scale: 1.15 }` (zoomed + repositioned) but person matte had no crop applied. The matte showed the uncropped source position while the video was zoomed/panned.
**Fix:** PersonItem now reads `data.crop` and applies matching `objectPosition` + `transform: scale()`. Crop data + keyframes copied from video item to person items in manifest.

### ISSUE 8: Overlay scene transforms off-screen ✅ FIXED
**Severity:** Important
**Root cause:** Agent placed Scene1 at y=-178 (above canvas), Scene5 at y=995 (below canvas edge).
**Fix:** Manually corrected: Scene1 → (40,480), Scene5 → (40,480).

### ISSUE 9: Person item transforms wrong ✅ FIXED
**Severity:** Important
**Root cause:** Person items had non-zero x/y and wrong dimensions (e.g., 1234x2081 for scene-6).
**Fix:** Set all to exactly {x:0, y:0, w:1080, h:1920}.

### ISSUE 10: Person items missing opacity keyframes ✅ FIXED
**Severity:** Important
**Root cause:** Person items had no keyframes — visible for entire duration including non-overlay scenes.
**Fix:** Copied opacity keyframes from matching scene items (fade in/out at 300ms).

### ISSUE 11: Track positions not unique — duplicate React keys ✅ FIXED
**Severity:** Important
**Root cause:** Caption(pos 1) = scene-bg(pos 1), audio(pos 2) = person(pos 2). React key collisions.
**Fix:** Assigned unique positions: video=0, scene-bg=1, person=2, scene-fg=3, captions=4, audio=5.

### ISSUE 12: Frontend bundle caching — no refresh after manual rebuilds
**Severity:** Minor
**Root cause:** Manual esbuild doesn't trigger the watcher's version counter. Frontend caches old bundle.
**Workaround:** Hard refresh (Ctrl+Shift+R) in browser.

### ISSUE 13: OffthreadVideo `transparent` prop not supported in browser preview
**Severity:** Important
**Root cause:** The frontend's composition shim wraps Remotion's Video into a SafeVideo using `React.createElement(Remotion.Video, ...)`. The `transparent` prop passes through to the DOM `<video>` element as a non-boolean attribute.
**Fix:** Use plain `<Video>` instead of `<OffthreadVideo transparent>`. Chrome's native `<video>` handles VP9 alpha automatically — no special props needed.

### ISSUE 14: MapTileGrid duplicate React keys
**Severity:** Minor
**Root cause:** Agent-generated magazine-country template has duplicate keys in map tile rendering.
**Status:** Not depth-compositing related. Template code quality bug.

## Manual Fixes Applied to Workspace

### Matte generation (full resolution)
```bash
# Ran segment_person.py at --scale 1.0 for all 3 overlay scenes
# Then encoded WebM VP9 with alpha:
ffmpeg -ss {start} -t {dur} -i source.mp4 -i matte.mp4 \
  -filter_complex "[1:v]format=gray[mask];[0:v][mask]alphamerge,format=yuva420p" \
  -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 2M -r 30 -an person-alpha.webm
```

### Files in workspace `public/matte/`:
| File | Size | Notes |
|------|------|-------|
| scene-1.mp4 | 1.8MB | Full-res matte (1080x1920) |
| scene-1-bbox.json | 11KB | 172 frames, sourceStartMs=0 |
| scene-1-alpha.webm | 2.2MB | VP9 with alpha |
| scene-5.mp4 | 4.2MB | Full-res matte |
| scene-5-bbox.json | — | 387 frames, sourceStartMs=40900 |
| scene-5-alpha.webm | 5.1MB | VP9 with alpha |
| scene-6.mp4 | 3.5MB | Full-res matte |
| scene-6-bbox.json | — | 359 frames, sourceStartMs=53800 |
| scene-6-alpha.webm | 4.8MB | VP9 with alpha |

### Manifest changes:
- Added 3 person items (scene-bg track) with correct transforms, keyframes, crop data
- Fixed scene transforms (Scene1, Scene5 repositioned)
- Fixed track positions (all unique)
- Updated SPEAKER constants in Scene1.tsx with real matte-derived values

### Code changes:
- `PersonItem.tsx`: Replaced SandwichComposite with plain `<Video>` + crop CSS
- `SandwichComposite.tsx`: Had Canvas 2D → WebGL → now unused (PersonItem bypasses it)

## Key Learnings

1. **WebM VP9 with alpha is the right approach** — browser handles transparency natively, no JS pixel processing needed. Single video element, hardware decoded.

2. **Person matte MUST match video crop** — the alpha WebM is encoded from uncropped source, so `objectPosition` and `scale` must match the video track's crop keyframes.

3. **`startFrom` must be 0 for clipped videos** — the alpha WebM is already trimmed to the scene time range. Setting `startFrom` to the source timeline offset causes Remotion to seek past the end.

4. **Track positions must be unique** — React uses `position-index` as keys in the composition. Duplicate positions cause duplicate keys and rendering bugs.

5. **BullMQ job IDs** — avoid colons. Use dashes or underscores.

6. **The three-layer sandwich works** — same approach as Descript/CapCut/Canva: original video (bottom) → graphics (middle) → matted speaker (top). The speaker in the background video is perfectly overlapped by the alpha WebM.

## Latest Changes (2026-04-02)

### Full-video matte at native frame rate
- `segment_person.py` fixed: `--fps 0` = source native rate (29.97fps), no resampling
- Full video processed: 1972 frames matching source exactly (was per-scene clips at 30fps)
- Re-encoded with keyframes every 1s (`-g 30`) — file size 17MB → 4MB, seeking instant

### Shared video ref architecture
- `VideoRefContext` shares background video DOM element with PersonItem
- PersonItem reads SAME decoded frame as background — zero sync drift
- WebGL shader: `video.rgb * matte.r` for alpha extraction
- CSS crop on canvas matches video element crop

### Worker changes
- No more per-scene clipping (no FFmpeg `-ss` seeking)
- `--scale 1.0` for full resolution
- `--fps 0` for native frame rate preservation
- 15 minute timeout (full video at full res)

## Pending for Production

See `docs/superpowers/plans/2026-04-02-depth-compositing-fixes.md` for complete record.

Current blocker: Player still freezes during overlay scenes. The WebGL matte compositing with shared video ref is architecturally correct but the matte `<Video>` element seeking through even a 4MB file during playback causes performance issues. Need to investigate whether prefetching the matte into a blob URL resolves this, or whether the stacked-alpha single-video approach is needed for smooth preview playback.
