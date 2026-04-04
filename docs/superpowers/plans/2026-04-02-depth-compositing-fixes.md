# Depth Compositing — Complete Implementation Record

> Comprehensive record of all research, testing, fixes, and architectural decisions made during the background segmentation / depth compositing implementation on 2026-04-01 and 2026-04-02.

## Architecture Overview

The depth compositing system enables animations to appear BEHIND the speaker in talking-head videos using a 5-track sandwich:

```
Position 0: Video track       → original source video (background + speaker)
Position 1: scene-bg track    → animations BEHIND speaker
Position 2: person track      → speaker extracted via alpha matte (WebGL)
Position 3: scene-fg track    → animations IN FRONT of speaker
Position 4: Captions track    → subtitle overlays
Position 5: Audio track       → speaker audio
```

The person track uses a **shared video ref** architecture: PersonItem reads the SAME `<video>` DOM element as the background VideoItem via React context. A WebGL shader composites `video.rgb * matte.r` to extract the speaker with transparency. This guarantees identical RGB pixels between background and person layers (same decoder, same frame).

---

## Pipeline Flow

```
Upload → Transcribe + Head-track → User edits → AI Generation (Sandbox)

Sandbox Pipeline:
  Phase 1-2: Trim Editor
  Phase 3: Planner (identifies overlay scenes)
  After plan approval: request_segmentation for ALL overlay scenes
  Phase 4: Setup Agent (writes scene skeletons with placeholder SPEAKER constants)
  Before Phase 5: check_segmentation_status (downloads matte + bbox to workspace)
  Phase 5: Layout Editor (creates person items, writes real SPEAKER constants to scene files)
  Phase 6: Animators (use SPEAKER/VISIBLE_ZONES for depth positioning)
  Phase 7: Final Editor
```

---

## Key Technical Decisions

### 1. Full-Video Matte (not per-scene clips)

**Decision:** Process the ENTIRE source video through RVM once, producing a single full-length matte.

**Why:**
- **Frame-perfect correspondence**: Frame N of matte = frame N of source, guaranteed
- **No frame rate drift**: Both at native 29.97fps (30000/1001) — per-scene clips were 30fps causing ~4 frames drift over 12s
- **No FFmpeg seeking errors**: No `-ss` seeking to nearest keyframe
- **Best RVM quality**: Recurrent hidden state (ConvGRU) builds continuously — no cold starts at segment boundaries
- **Temporal consistency**: No "matting pops" at scene transitions

**Tradeoff:** Full video processing at 1080x1920 takes ~5.5 minutes (5.9 fps on RTX 4050) vs ~30s per scene clip. Acceptable for production quality.

### 2. Shared Video Ref (not separate video elements)

**Decision:** PersonItem reads the SAME `<video>` DOM element as the background VideoItem via React context (`VideoRefContext`).

**Why:**
- Two `<video>` elements of the same source drift by 0.5-1 frames in browser preview
- `texImage2D` reads raw decoded pixels from the video element — guaranteed same frame as displayed
- Only one video decoder for the source (matte is a separate, small file)
- Eliminates the "double speaker" ghost effect

**Architecture:**
```
VideoRefProvider (wraps PlayerComposition)
  ├─ VideoItem: <Video ref={register}> → shares DOM element
  └─ PersonItem: getVideo() → reads SAME element → texImage2D → WebGL shader
```

### 3. CSS Crop Matching (not shader UV)

**Decision:** Apply the same CSS crop (`objectFit: cover`, `objectPosition`, `transform: scale`) to PersonItem's canvas as VideoItem applies to its video element.

**Why:**
- `texImage2D` reads RAW uncropped pixels regardless of CSS styling
- Both the video and canvas start from identical raw 1080x1920 frame
- Same CSS transform = same visual crop = perfect alignment
- No shader approximation of CSS behavior needed

### 4. WebGL Fragment Shader (not Canvas 2D)

**Decision:** Use WebGL `texImage2D` + fragment shader instead of Canvas 2D `getImageData`.

**Why:**
- Canvas 2D `getImageData` at 1080x1920 = 33MB GPU→CPU copy per frame (~25-35ms)
- WebGL shader runs entirely on GPU: ~0.5ms per frame
- No CPU pixel loops, no GPU-to-RAM readback

**Shader:**
```glsl
vec4 color = texture2D(u_video, v_texCoord);    // from shared background video
float alpha = texture2D(u_matte, v_texCoord).r;  // from matte video
gl_FragColor = vec4(color.rgb * alpha, alpha);    // premultiplied alpha
```

### 5. Frequent Keyframes in Matte (every 1 second)

**Decision:** Encode matte with `-g 30 -keyint_min 30` (keyframe every 30 frames = 1 second).

**Why:**
- Original matte had only 1 keyframe at frame 0 — browser had to decode from start for any seek
- Seeking to 40.9s required decoding 1227 frames → froze the player
- With 1s keyframes, max 30 frames decode-forward for any seek
- File size dropped from 17MB to 4MB (matte is grayscale, high CRF is fine)

### 6. NLE-Style Track Naming

**Decision:** Display tracks as V1, V2, V3, V4, A1, Captions — no internal jargon.

**Why:** Professional editors (Premiere Pro, DaVinci Resolve) use numbered tracks. Internal names like "scene-bg", "person", "scene-fg" leak implementation details.

---

## Bugs Found and Fixed

### Critical

| Bug | Root Cause | Fix |
|-----|-----------|-----|
| Segmentation jobs never queued | BullMQ rejects `:` in custom job IDs. `${projectId}:segment:${sceneId}:${Date.now()}` | Changed to `segment-${sceneId}-${Date.now()}` |
| Nobody adds person items | No prompt instructed any agent to create person items on the person track | Layout Editor prompt now creates person items for each overlay scene |
| Setup Agent can't read manifest | `MANIFEST_READ_TOOL_NAMES` missing from Setup Agent tool whitelist | Added to orchestrator.ts |
| Player freezes in overlay | Canvas 2D `getImageData` 33MB/frame at 1080x1920 | WebGL shader (0.5ms/frame) |
| Frame rate mismatch 29.97 vs 30fps | `segment_person.py` forced 30fps via `fps=30` filter | `--fps 0` uses source native rate |
| Per-scene clipping drift | FFmpeg `-ss` seeks to nearest keyframe + frame rate resampling | Process full video, no clipping |
| `segmentation-available.json` race condition | Written at sandbox init before head-tracking completed | Removed entirely — segmentation availability determined by env vars |

### Important

| Bug | Root Cause | Fix |
|-----|-----------|-----|
| Matte misaligned with speaker | `startFrom` set to source timeline offset for clipped matte | Full-video matte: `startFrom` matches scene position |
| CSS crop mismatch | `texImage2D` ignores CSS; PersonItem had no crop | Same CSS crop on PersonItem canvas as VideoItem video |
| Overlay scenes off-screen | Scene1 at y=-178, Scene5 at y=995 | Manually repositioned |
| Track positions not unique | Caption(1) = scene-bg(1), audio(2) = person(2) | Unique positions: 0-5 |
| Person items missing opacity keyframes | No fade in/out | Copied from matching scene items |
| `interpolate() Rules` accidentally deleted | Commit that removed speaker-grid.json also removed CLAUDE.md section | Restored |
| `auto_center_speaker` reads deleted file | Still referenced `speaker-grid.json` after removal | Rewired to read matte bbox |
| Matte keyframes only 1 at start | NVENC default GOP | Re-encode with `-g 30` (keyframe every 1s) |

### Minor

| Bug | Root Cause | Fix |
|-----|-----------|-----|
| `OffthreadVideo transparent` prop error | Frontend shim passes prop to DOM `<video>` | Use plain `<Video>` — browser handles VP9 alpha natively |
| MapTileGrid duplicate React keys | Agent-generated template code | Not depth-related, separate issue |
| Frontend bundle caching | Manual rebuild doesn't bump version counter | Hard refresh workaround |

---

## Files Changed

### Core Pipeline
- `packages/worker/scripts/segment_person.py` — Native fps support (`--fps 0`), no resampling
- `packages/worker/src/processors/segmentation.ts` — Full-video processing, no clipping, 15min timeout
- `packages/api/src/services/queue.ts` — Fixed BullMQ job ID (no colons)
- `packages/api/src/sandbox/routes.ts` — Removed `segmentationAvailable` race condition
- `packages/api/src/sandbox/manager.ts` — Removed `segmentationAvailable` from InitData

### MCP Tools
- `packages/mcp-servers/src/asset-server.ts` — Rewrote `get_speaker_position` (matte bbox primary), `auto_center_speaker` (matte bbox), `get_depth_compositing_info` (no flag file), removed dead head-tracking types

### Agent Prompts
- `packages/sandbox/src/prompts/orchestrator/system.md` — Segment ALL overlay scenes, check before Layout Editor
- `packages/sandbox/src/prompts/layout-editor/system.md` — Create person items, write SPEAKER constants, unique track positions
- `packages/sandbox/src/prompts/setup-agent/system.md` — Placeholder SPEAKER constants (Layout Editor overwrites)
- `packages/sandbox/src/prompts/animator/system.md` — Full-body silhouette language
- `packages/sandbox/src/prompts/animator/reminder.md` — Updated speaker positioning
- `packages/sandbox/src/orchestrator.ts` — Added MANIFEST_READ_TOOL_NAMES to Setup Agent

### Sandbox Template
- `packages/sandbox/template/src/composition/VideoRefContext.tsx` — NEW: shared video element context
- `packages/sandbox/template/src/composition/StackedAlphaVideo.tsx` — NEW: stacked alpha WebGL (deprecated by shared ref approach)
- `packages/sandbox/template/src/composition/SandwichComposite.tsx` — Deprecated (was Canvas 2D, then WebGL two-video)
- `packages/sandbox/template/src/items/PersonItem.tsx` — Shared video ref + WebGL matte shader + CSS crop
- `packages/sandbox/template/src/items/VideoItem.tsx` — Registers video ref via context
- `packages/sandbox/template/src/PlayerComposition.tsx` — Wrapped in VideoRefProvider
- `packages/sandbox/template/.claude/CLAUDE.md` — Restored interpolate rules, updated speaker position docs
- `packages/sandbox/src/workspace-init.ts` — Removed speaker-grid.json write, removed segmentation-available.json

### Frontend
- `apps/web/src/features/editor-v2/player/WorkspacePlayer.tsx` — Prefetch person matte videos
- `apps/web/src/features/editor-v2/timeline/track-headers/TrackHeader.tsx` — NLE naming (V1-V4, A1, Captions)
- `apps/web/src/features/editor-v2/timeline/canvas/CanvasRenderer.ts` — Removed BG/FG badges
- `apps/web/src/features/editor-v2/components/ItemDragOverlay.tsx` — Removed Speaker Layer overlay

---

## Person Item Manifest Format

```json
{
  "type": "person",
  "trackId": "trk-person",
  "startMs": 40900,
  "endMs": 53800,
  "transform": { "x": 0, "y": 0, "width": 1080, "height": 1920, "rotation": 0, "opacity": 1 },
  "keyframes": [
    { "timeMs": 0, "props": { "opacity": 0 } },
    { "timeMs": 300, "props": { "opacity": 1 } },
    { "timeMs": 12600, "props": { "opacity": 1 } },
    { "timeMs": 12900, "props": { "opacity": 0 } }
  ],
  "data": {
    "videoSrc": "source.mp4",
    "matteSrc": "matte/full.mp4",
    "startFrom": 40900,
    "crop": { "x": 51, "y": 9, "scale": 1.15 }
  }
}
```

- `matteSrc`: Full-video matte (same frame count/rate as source)
- `startFrom`: Scene start position in ms (seeks into the full matte)
- `crop`: Must match video track's crop for alignment

---

## Matte Video Specs

| Property | Source | Matte |
|----------|--------|-------|
| Codec | H.264 | H.264 |
| Resolution | 1080x1920 | 1080x1920 |
| Frame rate | 30000/1001 (29.97fps) | 30000/1001 (29.97fps) |
| Frame count | 1972 | 1972 |
| Duration | 65.799067s | 65.799067s |
| Keyframe interval | Variable | Every 30 frames (1s) |
| File size | ~30MB | ~4MB |
| Content | Full color | Grayscale (white=person, black=bg) |

---

## Research Findings

### Why Two Video Elements Can't Sync
- Browser video decoding is compositor-thread, callback is main-thread
- `requestVideoFrameCallback` is "best effort" — may fire one vsync late
- `currentTime` seeking has internal rounding — not frame-accurate
- W3C acknowledges this as a known gap in web standards

### How Professional Tools Handle It
- **After Effects/DaVinci**: All layers share one composition frame rate — no independent clocks
- **CapCut/Descript**: Three-layer sandwich (original video + graphic + matted speaker) using native app renderers
- **Web tools (Clipchamp, Kapwing)**: WebCodecs for frame-level control
- **Jake Archibald's stacked-alpha**: Single video with color+alpha halves, WebGL shader splits them

### RVM Temporal Consistency
- Uses ConvGRU recurrent state across frames — processes frame-by-frame with memory
- Segmented processing resets hidden state → "matting pops" at boundaries
- Full-video processing = best quality (continuous recurrent state)
- 1:1 frame correspondence guaranteed (one output per input)

### Remotion Rendering
- Server-side render: `<OffthreadVideo>` extracts exact frames via FFmpeg → frame-perfect
- Browser preview: Two `<video>` elements can drift 0.5-1 frames
- Shared video ref pattern eliminates drift for the RGB layer
- Matte drift of 1 frame only shifts mask boundary — imperceptible

---

## Remaining Work

### Must Fix Before Production
- [ ] Worker: Add FFmpeg step to encode stacked alpha video (source+matte vstack) for cross-browser fallback
- [ ] Worker: Cache full-video matte per project (don't re-process for each scene request)
- [ ] API: Endpoint for downloading full matte (not per-scene)
- [ ] Orchestrator: Request ONE segmentation job for the full video instead of per-overlay-scene
- [ ] PersonItem: Handle dynamic crop keyframes (punch-ins) — currently only base crop is applied
- [ ] Test server-side render with the new PersonItem (WebGL + shared ref)

### Nice to Have
- [ ] Safari fallback (VP9 alpha not supported — use stacked alpha or HEVC)
- [ ] Matte prefetch optimization (17MB→4MB helps, but still large)
- [ ] `SandwichComposite.tsx` cleanup (deprecated, can be deleted)
- [ ] Validate matte files exist before render (silent failure if missing)
