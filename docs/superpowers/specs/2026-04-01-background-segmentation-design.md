# Background Segmentation Design Spec

**Date:** 2026-04-01
**Status:** Draft
**Goal:** Separate talking head person from background via video matting, enabling per-scene compositing techniques (animated backgrounds, PiP, person effects).

---

## Overview

Add a Robust Video Matting (RVM) pipeline step to the worker that produces a grayscale alpha matte video for every uploaded talking head video. The matte is stored in MinIO, downloaded into the Remotion workspace's `public/` folder during sandbox init, and used selectively by the agent/templates on scenes that require person/background separation.

**Key constraint:** The matte is NOT applied globally. It's an asset the agent pulls in only for scenes/frames where the creative direction requires compositing (e.g., animated backgrounds, picture-in-picture, glow effects on the person).

---

## Architecture

### Pipeline Position

```
Upload → Transcribe → Head Tracking → Reframe Generation
                            ↓ (lower priority, deferred)
                      Segmentation (RVM)
                            ↓
                      Matte video → MinIO
```

- **Trigger:** Auto-queued after head tracking completes, at lower BullMQ priority
- **Non-blocking:** Does not delay transcription, head tracking, or reframe — the critical path is untouched
- **Result:** Ready by the time the user enters the editor/sandbox

### Output Format

- **Grayscale H.264 MP4** — white pixels = person, black pixels = background
- Same resolution and FPS as source video
- Small file size (~1-2 MB/min of video)
- No transparent video codecs (no VP9 alpha / ProRes 4444) — keeps storage lean
- The matte + original video together yield both person and background layers at render time

---

## Components

### 1. Python Script: `packages/worker/scripts/segment_person.py`

Follows the same pattern as `detect_head.py`:

- **Input:** Source video path, output matte path
- **Model:** Robust Video Matting (RVM) via PyTorch
  - Temporal-consistent alpha mattes (recurrent architecture — no inter-frame flickering)
  - Works on CPU (slower) or GPU (faster) — no hard GPU requirement
  - Model weights auto-downloaded on first run (same pattern as MediaPipe in `detect_head.py`)
- **Processing:** Frame-by-frame through RVM, writes grayscale matte to H.264 MP4 via OpenCV
- **Progress:** JSON lines to stdout (`{"progress": 0.45}`) — same protocol as `detect_head.py`
- **Error handling:** Non-zero exit code + JSON error on stderr

### 2. Worker Processor: `packages/worker/src/processors/segmentation.ts`

Same structure as `head-tracking.ts`:

1. Download source video from MinIO to temp directory
2. Run `segment_person.py` as subprocess with timeout (longer than head tracking — ~10min for a 5min video on CPU)
3. Upload resulting matte MP4 to MinIO at `projects/{projectId}/matte.mp4`
4. Update project DB record: `videoSettings.segmentationMatte = { videoKey, width, height, status: 'ready' }`
5. Clean up temp directory

**Queue configuration:**
- Job type: `segmentation`
- Priority: Lower than `transcribe`, `head-tracking`, `generate-reframe`
- Auto-queued from head tracking completion handler
- Retries: 2 (with backoff)

### 3. Database Schema

No new tables. Extend the existing `videoSettings` JSONB field on the `projects` table:

```typescript
// Within videoSettings
segmentationMatte?: {
  videoKey: string;   // MinIO key: "projects/{id}/matte.mp4"
  width: number;      // Matches source resolution
  height: number;
  status: 'processing' | 'ready' | 'failed';
}
```

### 4. Sandbox Init: Asset Delivery

**In `packages/api/src/sandbox/routes.ts` → `buildInitData()`:**
- If `videoSettings.segmentationMatte.status === 'ready'`, include the matte key in init data:
  ```typescript
  segmentationMatte: {
    videoKey: "projects/{id}/matte.mp4",
    width: 1920,
    height: 1080
  }
  ```

**In `packages/sandbox/src/workspace-init.ts` → `initWorkspaceInDir()`:**
- If `payload.segmentationMatte` exists, download the matte from MinIO into `public/matte/source-matte.mp4`
- Same pattern as the source video download (stream from MinIO → write to file)
- The file lives at: `/workspace/public/matte/source-matte.mp4`

### 5. MCP Tool: `get_segmentation_info`

**In `packages/mcp-servers/src/asset-server.ts`:**

New tool added to the existing asset server:

**Returns:**
```json
{
  "available": true,
  "mattePath": "matte/source-matte.mp4",
  "staticFileRef": "staticFile('matte/source-matte.mp4')",
  "sourceWidth": 1920,
  "sourceHeight": 1080,
  "compositingGuide": "... Remotion compositing pattern ..."
}
```

**Compositing guide** provides the agent with a ready-to-use Remotion pattern for masking:
- Canvas-based approach: draw source video, use matte as globalCompositeOperation mask
- The agent includes this pattern only in scenes that need person/bg separation
- Guide includes both "person only" and "background only" extraction patterns

### 6. Remotion Compositing Pattern

When the agent/template decides a scene needs person/background separation, it writes code following this pattern:

```tsx
import { OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';

const PersonLayer: React.FC<{ opacity?: number }> = ({ opacity = 1 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  // Two hidden videos: source + matte
  // Canvas composites them: matte alpha determines visibility
  // White in matte = person visible, black = transparent

  return (
    <AbsoluteFill>
      {/* Hidden source video */}
      <OffthreadVideo
        src={staticFile('source.mp4')}
        style={{ display: 'none' }}
        ref={videoRef}
      />
      {/* Hidden matte video */}
      <OffthreadVideo
        src={staticFile('matte/source-matte.mp4')}
        style={{ display: 'none' }}
        ref={matteRef}
      />
      {/* Canvas composites them */}
      <canvas ref={canvasRef} width={width} height={height} style={{ opacity }} />
    </AbsoluteFill>
  );
};
```

**Note:** The exact compositing implementation may use Remotion's `<Series>` or custom canvas operations. The MCP tool's compositing guide will provide the tested, working pattern that agents copy.

---

## Data Flow

```
1. Upload video
2. Worker: transcribe (high priority)
3. Worker: head-tracking (high priority)
4. Worker: reframe (high priority)
5. Worker: segmentation (low priority, deferred)
   ├── Download source from MinIO
   ├── Run segment_person.py (RVM)
   ├── Upload matte.mp4 to MinIO
   └── Update videoSettings.segmentationMatte
6. User opens editor → sandbox created
7. Sandbox init:
   ├── Download source.mp4 → public/source.mp4 (existing)
   └── Download matte.mp4 → public/matte/source-matte.mp4 (new)
8. Agent plans scenes:
   ├── Scene A: normal talking head → uses source.mp4 directly
   ├── Scene B: animated background → calls get_segmentation_info
   │   └── Writes PersonLayer + custom background composition
   └── Scene C: PiP over B-roll → uses matte for person extraction
9. Render: Remotion bundles everything, matte compositing happens per-scene
```

---

## New Dependencies

Added to `packages/worker/requirements.txt`:

```
torch>=2.0.0
torchvision>=0.15.0
```

RVM model weights are downloaded at runtime (cached after first use), no additional package needed — the model is loaded directly via PyTorch.

---

## Edge Cases

| Case | Handling |
|------|----------|
| No person detected in video | RVM outputs near-black matte; status still `ready` — agent sees low-confidence matte via MCP tool and avoids using it |
| Multiple people in frame | RVM segments all people as foreground (single combined matte) — acceptable for V1 |
| Segmentation not ready when sandbox starts | `segmentationMatte` absent from init data; agent works without it; no matte in `public/` |
| Segmentation fails | `status: 'failed'`; not included in init data; agent proceeds without compositing |
| Very long video (>10min) | Longer processing time on CPU; timeout set generously (20min); consider chunked processing in V2 |
| Audio-only upload | No segmentation job queued (no video to segment) |

---

## Out of Scope (V1)

- **Per-person segmentation** — V1 produces a single matte for all people; individual person mattes are a V2 feature
- **Real-time browser preview** — segmentation is batch only; editor shows the composited result after render
- **Background inpainting** — filling the background behind the person (e.g., for clean plate) is not included
- **GPU requirement** — CPU-only for now; GPU acceleration is a deployment optimization
- **Matte refinement UI** — no user-facing controls for adjusting matte edges/threshold

---

## Success Criteria

1. `segment_person.py` produces temporally-stable matte videos with clean edges on hair/fingers
2. Matte is available in workspace `public/matte/` by the time the agent starts planning scenes
3. Agent can selectively use the matte for specific scenes without affecting scenes that don't need it
4. Composited render output shows clean person extraction over custom backgrounds with no visible artifacts (halos, flickering edges)
5. Pipeline adds <30s overhead to the critical path (segmentation runs in parallel, deferred)
