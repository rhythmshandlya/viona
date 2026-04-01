# Background Segmentation & Depth Compositing Design Spec

**Date:** 2026-04-01
**Status:** Draft (v2)
**Goal:** Create a layered depth compositing system where animations can appear *behind* the speaker but *on top of* the original video background, using person matting.

---

## Core Concept

Matting does NOT remove the background. It creates a **sandwich composite** — three layers that the planner, layout editor, and animator use to place graphics between the person and their background:

```
┌─────────────────────────────┐
│  Layer 3: Foreground        │  Captions, overlays ON TOP of person
├─────────────────────────────┤
│  Layer 2: Person (matte)    │  Extracted speaker via alpha matte
├─────────────────────────────┤
│  Layer 1: Mid-layer         │  Animations, text, graphics BEHIND speaker
├─────────────────────────────┤
│  Layer 0: Background        │  Original video (visible through gaps)
└─────────────────────────────┘
```

The original video background stays visible. The mid-layer sits between the background and the person, creating depth. This is the "text-behind-subject" technique used across TikTok, YouTube, and professional motion design.

---

## Pipeline: Matting Happens on the Final Cut

The user uploads a 5-10 minute video. The trim editor cuts sections, arranges the storyline, produces a final cut. **Only the final cut gets matted** — not the raw upload.

```
Upload → Transcribe → Head Tracking → Reframe
                                        ↓
User edits in NLE editor (trim, arrange, storyline)
                                        ↓
Final cut assembled (manifest with trimmed video items)
                                        ↓
Worker: segmentation job on final cut (GPU)
                                        ↓
Matte video → MinIO
                                        ↓
Sandbox starts → downloads matte from MinIO
                                        ↓
Planner decides which scenes use depth compositing
                                        ↓
Layout Editor creates layer structure
                                        ↓
Animators write mid-layer animations for depth scenes
```

### When matting runs

Matting runs in the **worker** (which has GPU access), NOT in the sandbox (Docker, no GPU). The trigger is when the user finalizes their edit and launches AI generation:

1. User finishes trimming/arranging in the NLE editor
2. User triggers AI generation → API assembles the final cut from the manifest
3. **Worker job**: `segmentation` — renders the trimmed video sections into a continuous file, runs RVM, produces matte MP4
4. Matte uploaded to MinIO at `projects/{projectId}/matte.mp4`
5. Sandbox starts → workspace init downloads matte from MinIO into `public/matte.mp4`
6. Orchestrator writes `docs/segmentation-info.json` with matte metadata
7. Planner reads segmentation info and decides which scenes use depth compositing

This keeps GPU work in the worker where it belongs, and the sandbox receives the pre-computed matte as an asset.

---

## RVM Processing (Tested Configuration)

Based on local testing with RTX 4050:

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| **Model** | RVM resnet50 | Better edge quality than mobilenetv3 |
| **Scale** | 0.5x source resolution | Clean edges, manageable data size |
| **Matte FPS** | 30fps | No jitter at playback; 15fps causes visible stutter |
| **downsample_ratio** | 0.8 | High internal resolution for fine hair/finger detail |
| **seq_chunk** | 4 | Fits in 6GB VRAM at 0.5x scale |
| **Precision** | fp16 | 2x throughput on RTX tensor cores |
| **JIT** | script + freeze | Fused ops, no Python overhead |
| **Decode** | FFmpeg NVDEC + scale filter | GPU-assisted decode at reduced resolution |
| **Encode** | NVENC (h264_nvenc) with libx264 fallback | Dedicated ASIC for encoding |

**Performance**: ~10 fps at 1080x1920 input (0.5x of 2160x3840). A 2-minute final cut processes in ~6-12 seconds at 30fps matte.

### Script: `packages/worker/scripts/segment_person.py`

Lives alongside `detect_head.py` in the worker. Runs as a subprocess during the segmentation job. Same progress protocol as `detect_head.py` (JSON lines to stdout).

### Worker Processor: `packages/worker/src/processors/segmentation.ts`

Same pattern as `head-tracking.ts`:

1. Receive final cut info (trimmed video segments from manifest)
2. FFmpeg: concatenate trimmed segments into a continuous video (if needed)
3. Run `segment_person.py` on the continuous video
4. Upload matte MP4 to MinIO at `projects/{projectId}/matte.mp4`
5. Update project record with matte metadata (videoKey, width, height, fps, status)
6. Clean up temp directory

**Queue**: job type `segmentation`, triggered when user launches AI generation (before sandbox creation).

---

## NLE Editor: Track-Based Layer System

The editor already has track-based z-ordering via `Track.position`. When matting is available, the manifest gains additional tracks:

### Current track structure
```
position 3: overlay    — Scenes/graphics (on top of everything)
position 2: caption    — Subtitles
position 1: audio      — Speaker audio
position 0: video      — Source video (background)
```

### With depth compositing enabled
```
position 5: overlay    — Foreground overlays (captions, etc.)
position 4: scene      — Templates/animations ON TOP of person
position 3: person     — Matted person layer (extracted speaker)
position 2: midlayer   — Animations/graphics BEHIND speaker
position 1: audio      — Speaker audio
position 0: video      — Source video (background)
```

The key insight: anything on tracks between `video` (0) and `person` (3) appears **behind the speaker**. Anything above `person` appears **in front**.

### SegmentationData (already exists in types.ts)

The editor store already defines:
```typescript
interface SegmentationData {
  status: 'pending' | 'processing' | 'ready' | 'failed';
  progress?: number;
  maskPath?: string;     // Path to matte video
  maskFps?: number;      // Matte frame rate
  error?: string;
}
```

This lives on `VideoItemData.segmentation` — when `status === 'ready'`, the editor knows a matte is available and can show the layer controls.

### Editor UI Changes

1. **Layer panel**: When matte is available, show a toggle "Enable depth compositing" that creates the person + midlayer tracks
2. **Track reordering**: User (or AI agent) can drag tracks to change layer order
3. **Preview**: The Remotion player renders the sandwich composite in real-time using the matte
4. **Per-item depth**: Each overlay item can be set to render "in front of" or "behind" the speaker by moving it between tracks

---

## Planner Integration

### New display mode: "Depth"

Extend the planner's display mode vocabulary:

| Mode | Description | When to use |
|------|-------------|-------------|
| **Overlay** | Speaker full-screen, graphic floats on top | Simple callouts, stats |
| **Stacked** | Speaker bottom, animation top | Charts, diagrams |
| **Fullscreen** | Speaker hidden, animation fills canvas | Immersive visuals |
| **Depth** | Speaker matted, animation plays BEHIND speaker | Impact moments, reveals, depth effects |

The planner writes `"displayMode": "Depth"` in SCENE_PLAN.md for scenes that should use the sandwich composite.

### Planner vocabulary: Depth techniques

The planner can specify depth techniques in the animation brief:

**Simple (planner can use freely):**
- `behind-text-slide` — Large text slides in behind the speaker
- `background-color-wash` — Solid color/gradient fills behind speaker
- `radial-burst` — Rays/lines expand outward from behind speaker
- `rising-elements` — Icons/emojis rise from bottom behind speaker
- `stat-counter-behind` — Large numbers animate behind speaker
- `background-progress-bar` — Meter fills across behind speaker
- `depth-lower-third` — Name bar that passes behind the speaker's body
- `bokeh-depth` — Soft out-of-focus light circles between layers

**Medium (planner should pair with specific scenes):**
- `background-b-roll` — Image/photo composited behind person
- `split-background-panels` — Multiple images arranged around person
- `carousel-behind` — Image slideshow behind speaker
- `parallax-depth` — Person and background move at different speeds
- `silhouette-edge-glow` — Colored glow traces the person's outline
- `animated-pattern-fill` — Geometric patterns tile behind speaker
- `floating-data-cards` — Info cards float at various positions behind speaker

**What NOT to do (anti-patterns for planner):**
- Never use depth mode for every scene — reserve for 30-40% of scenes max
- Never combine multiple mid-layer animations simultaneously (one motion per moment)
- Never use depth mode when the speaker is moving rapidly (matte edges degrade)
- Never fully replace the background — keep original visible through gaps

---

## Remotion Compositing: Sandwich Component

The workspace template includes a `SandwichComposite` component that the layout editor places for depth scenes:

```tsx
// Template component provided in workspace
const SandwichComposite: React.FC<{
  videoSrc: string;       // source.mp4
  matteSrc: string;       // matte.mp4
  startFrom: number;      // frame offset into source
  children: React.ReactNode; // mid-layer content (animations)
}> = ({ videoSrc, matteSrc, startFrom, children }) => {
  // Layer 0: Original video (background)
  // Layer 1: {children} — mid-layer animations
  // Layer 2: Person extracted via canvas matte compositing
  //
  // Canvas approach:
  //   1. Draw source video frame
  //   2. Use matte as alpha: globalCompositeOperation 'destination-in'
  //   3. Result: person-only pixels on transparent background
  //   4. Render over children (which sit over the background video)
};
```

The animator writes the mid-layer content as children:

```tsx
// Example: text sliding behind speaker
<SandwichComposite videoSrc={src} matteSrc={matteSrc} startFrom={0}>
  <AbsoluteFill>
    <h1 style={{ fontSize: 120, ... }}>
      KEY INSIGHT
    </h1>
  </AbsoluteFill>
</SandwichComposite>
```

---

## MCP Tool: `get_depth_compositing_info`

Available to planner, layout editor, and animator via the asset server:

```json
{
  "available": true,
  "mattePath": "matte.mp4",
  "matteWidth": 1080,
  "matteHeight": 1920,
  "matteFps": 30,
  "matteDurationMs": 42000,
  "sourceVideoDurationMs": 42000,
  "techniques": ["behind-text-slide", "radial-burst", "background-color-wash", ...],
  "compositingComponent": "SandwichComposite",
  "usage": "Import SandwichComposite from '../components/SandwichComposite'. Pass videoSrc, matteSrc, startFrom. Place mid-layer animations as children.",
  "antiPatterns": ["Don't use for every scene", "One motion per moment", "Keep original background visible"]
}
```

---

## Orchestrator Changes

### Workspace init: download matte

In `workspace-init.ts`, after downloading source video, check if the matte is available in init data and download it:

```typescript
// After source video download
if (payload.segmentationMatte) {
  const matteStream = await minio.getObject(bucket, payload.segmentationMatte.videoKey);
  await pipeline(matteStream, createWriteStream(join(baseDir, 'public', 'matte.mp4')));

  // Write metadata for planner/agents
  await writeFile(join(baseDir, 'docs', 'segmentation-info.json'), JSON.stringify({
    available: true,
    mattePath: 'matte.mp4',
    width: payload.segmentationMatte.width,
    height: payload.segmentationMatte.height,
    fps: payload.segmentationMatte.fps,
    durationMs: payload.segmentationMatte.durationMs,
  }));
}
```

### SandwichComposite component

Copied into the workspace during setup phase (alongside other shared components):

```
Phase 1: Init (download video, audio, matte, extract, proxy)
Phase 2: Plan (planner reads docs/segmentation-info.json, decides depth scenes)
Phase 3: Setup (constants, shared components including SandwichComposite)
Phase 4: Layout (creates track structure with person/midlayer tracks for depth scenes)
Phase 5: Animate (animators write mid-layer content for depth scenes)
Phase 6: Review (render stills, verify depth compositing looks correct)
Phase 7: Final assembly
```

---

## Data Flow (Complete)

```
1. User uploads video (5-10 min)
2. Worker: transcribe, head-track, reframe (parallel, high priority)
3. User opens editor, trims video, arranges storyline
4. User triggers AI generation
5. Worker: segmentation job on final cut (GPU)
   ├── Concatenate trimmed segments if needed
   ├── Run segment_person.py (RVM)
   ├── Upload matte.mp4 to MinIO
   └── Update project with matte metadata
6. Sandbox starts → workspace init:
   ├── Download source.mp4 → public/source.mp4
   ├── Download matte.mp4 → public/matte.mp4
   └── Write docs/segmentation-info.json
7. Planner reads segmentation-info.json
   ├── Scene 1: displayMode "Overlay" (no matte needed)
   ├── Scene 2: displayMode "Depth" — behind-text-slide
   ├── Scene 3: displayMode "Stacked" (no matte needed)
   └── Scene 4: displayMode "Depth" — radial-burst + stat-counter
8. Layout Editor:
   ├── Creates person track (position 3) for depth scenes
   ├── Creates midlayer track (position 2) for depth scenes
   ├── Places SandwichComposite items at depth scene timecodes
   └── Non-depth scenes use normal track structure
9. Animators:
   ├── Depth scenes: write mid-layer content inside SandwichComposite
   └── Normal scenes: write overlays as usual
10. Review: render stills at depth scenes, verify compositing
11. Final render: Remotion renders full sandwich composite
```

---

## Processing Configuration

Based on test results (RTX 4050 Laptop GPU):

```python
BACKBONE = "resnet50"        # Quality over speed for edge detail
SCALE_FACTOR = 0.5           # Half source resolution
MATTE_FPS = 30               # Smooth playback, no jitter
DOWNSAMPLE_RATIO = 0.8       # Fine internal resolution for hair/fingers
SEQ_CHUNK = 4                # Fits 6GB VRAM at 0.5x scale
USE_FP16 = True              # 2x throughput
JIT = "script+freeze"        # Fused ops
```

**Output**: Grayscale H.264 MP4 at 0.5x source resolution, 30fps. Small file (~2-5 MB/min).

---

## Edge Cases

| Case | Handling |
|------|----------|
| Matte not ready when planner starts | Planner skips depth mode, uses Overlay/Stacked/Fullscreen only |
| No person detected | Near-black matte; segmentation-info.json marks `available: false` |
| Multiple people | RVM segments all as foreground (single matte) — acceptable for V1 |
| Speaker moves rapidly | Planner avoids depth mode for fast-motion sections (matte edges degrade) |
| Very long final cut (>5min) | Processing at 0.5x/30fps takes ~1-3 min; acceptable within sandbox timeout |
| Matte/video duration mismatch | SandwichComposite clamps matte to video duration |
| Audio-only | No segmentation phase; planner sees `available: false` |

---

## Out of Scope (V1)

- **Full background removal** — V1 keeps original background visible; "clean plate" is V2
- **Per-person mattes** — single combined matte for all people
- **Real-time browser preview** of depth compositing — batch render only
- **User-facing matte controls** — no threshold/feather sliders
- **Background inpainting** — filling behind the person for clean replacement

---

## Success Criteria

1. Matte quality: clean edges on hair/fingers, no temporal flickering between frames
2. Planner correctly identifies scenes that benefit from depth compositing (30-40% of scenes)
3. Animations behind speaker look natural — no halos, no competing motion
4. Non-depth scenes are unaffected by the matting pipeline
5. Segmentation adds <2 min to sandbox processing for a typical 2-min final cut
6. Editor shows layered track structure when depth compositing is active
7. The AI agent can control layer ordering (move items between midlayer and overlay tracks)
