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

## Pipeline: On-Demand Async Matting

Matting is **not** a preprocessing step. The agent decides which sections need depth compositing, requests matting of only those time ranges from the worker (async, GPU), continues working on other scenes, and stitches the results when ready.

```
Upload → Transcribe → Head Tracking → Reframe
                                        ↓
User edits in NLE editor (trim, arrange, storyline)
                                        ↓
User triggers AI generation → Sandbox starts
                                        ↓
Planner decides which scenes use Depth display mode
  e.g., Scene 2 (15s-30s), Scene 5 (45s-55s)
                                        ↓
Agent requests matting of ONLY those ranges (async)
  ├── Worker: mat 15s-30s → matte-scene2.mp4
  └── Worker: mat 45s-55s → matte-scene5.mp4
                                        ↓
Agent continues with non-depth scenes (no blocking)
                                        ↓
Matte sections ready → agent downloads and stitches into composition
```

### Why on-demand, not full-video preprocessing

- **No wasted compute** — a 5-min video might only need 20s of matting
- **No waiting** — nobody blocks on matting; agent works on other scenes in parallel
- **Fast** — matting 15s of video at our config takes ~3-5 seconds on GPU
- **Scalable** — only pays GPU cost proportional to depth scenes used

### Worker processor: `packages/worker/src/processors/segmentation.ts`

Accepts a **time range** (not full video):

1. Receive job: `{ projectId, videoKey, startMs, endMs, outputKey }`
2. FFmpeg: extract the time range from source video
3. Run `segment_person.py` on the extracted clip
4. Upload matte clip to MinIO at `outputKey`
5. Notify sandbox (via callback or polling) that matte is ready

**Queue**: job type `segmentation`, triggered by sandbox agent via API call. Multiple jobs can run in parallel for different time ranges.

### API endpoint: `POST /api/sandbox/:sandboxId/segment`

Called by the sandbox agent to request matting:

```typescript
// Request
{
  ranges: [
    { startMs: 15000, endMs: 30000, sceneId: "scene-2" },
    { startMs: 45000, endMs: 55000, sceneId: "scene-5" },
  ]
}

// Response
{
  jobIds: ["job-abc", "job-def"],
  estimatedDurationMs: 8000
}
```

The sandbox polls for completion or receives a callback when each matte clip is ready. Completed mattes are downloaded into `public/matte/scene-2.mp4`, `public/matte/scene-5.mp4`, etc.

### MCP tool: `request_segmentation`

Available to the planner/layout editor agent:

```
request_segmentation({ ranges: [{ startMs, endMs, sceneId }] })
→ Queues worker jobs, returns job IDs
→ Agent continues with other work
→ check_segmentation_status({ jobIds }) to poll readiness
```

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

## Layout Editor → Animator Handoff for Depth Scenes

The existing handoff pattern is: Planner writes SCENE_PLAN.md → Layout Editor creates manifest items with transforms → Setup Agent bakes dimensions into skeleton → Animator fills the canvas. Depth scenes extend this with layer awareness, speaker spatial data, and technique metadata.

### What the Planner writes (SCENE_PLAN.md)

```markdown
## Scene 3: The Key Insight
**File:** Scene3.tsx
**Time:** 15000 – 25000ms
**Display mode:** Depth
**Depth technique:** behind-text-slide

### Scene dimensions
- Width: 1080 Height: 1920 (full canvas — mid-layer fills behind speaker)

### Scene placement
- Layer: midlayer (behind speaker, on top of background video)

### Animation brief
Large bold text "THE KEY INSIGHT" slides in from the right behind the speaker,
settling center-frame. Speaker's body partially occludes the text, creating
natural depth. Text should be oversized (120px+) and positioned at speaker's
chest height so the head and shoulders mask the top portion.
```

### What the Layout Editor writes (manifest)

For depth scenes, the Layout Editor creates items on the **midlayer track** (not the scene track):

```typescript
// 1. Create midlayer track if it doesn't exist
add_track({ type: "overlay", name: "Midlayer", position: 2 })

// 2. Place scene item on midlayer with full-canvas dimensions
add_item({
  type: "scene",
  trackId: "trk-midlayer",
  startMs: 15000,
  endMs: 25000,
  data: {
    sceneFile: "Scene3.tsx",
    displayMode: "depth",
    depthTechnique: "behind-text-slide",
    speakerBbox: { x: 0.28, y: 0.10, w: 0.44, h: 0.75 },  // normalized 0-1
    speakerCenter: { x: 0.50, y: 0.45 },                     // face center
    visibleZones: {                                            // areas NOT behind speaker
      left:   { x: 0, y: 0, w: 0.28, h: 1.0 },
      right:  { x: 0.72, y: 0, w: 0.28, h: 1.0 },
      top:    { x: 0, y: 0, w: 1.0, h: 0.10 },
      bottom: { x: 0, y: 0.85, w: 1.0, h: 0.15 }
    }
  },
  transform: { x: 0, y: 0, width: 1080, height: 1920 }  // full canvas
})
```

**Key fields the Layout Editor adds for depth:**
- `depthTechnique` — which technique the animator should implement
- `speakerBbox` — normalized bounding box of the speaker (from head tracking)
- `speakerCenter` — face center point (for radial effects, glow origin, etc.)
- `visibleZones` — areas not occluded by the speaker (for placing elements that need to be fully visible)

**Speaker position sources (progressive refinement):**
- **Initial (Phase 3-5):** Head tracking data (face bbox from `get_speaker_position` MCP tool, already available from upload). Less accurate — face only, no body contour.
- **Refined (when matte arrives):** Derive exact silhouette bounding box from the matte video — full body outline including shoulders, arms, hair. Tighter and more accurate than face-only head tracking. The matte-derived bbox can replace the head tracking estimate in the skeleton before animators run.

The Layout Editor uses head tracking as the initial estimate. If the matte clip arrives before Setup Agent writes skeletons (likely for short clips), the Setup Agent uses matte-derived bounds instead. This means `speakerBbox` and `visibleZones` progressively improve as data becomes available.

### What the Setup Agent writes (skeleton)

```tsx
// src/scenes/Scene3.tsx — skeleton for depth scene
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';

export const SCENE_WIDTH = 1080;
export const SCENE_HEIGHT = 1920;
export const DISPLAY_MODE = 'depth';
export const DEPTH_TECHNIQUE = 'behind-text-slide';

// Speaker position (normalized 0-1, from head tracking)
export const SPEAKER = {
  bbox: { x: 0.28, y: 0.10, w: 0.44, h: 0.75 },
  center: { x: 0.50, y: 0.45 },
  // Pixel helpers
  bboxPx: { x: 302, y: 192, w: 475, h: 1440 },
  centerPx: { x: 540, y: 864 },
};

// Areas visible around the speaker (not occluded by person layer)
export const VISIBLE_ZONES = {
  left:   { x: 0, y: 0, w: 302, h: 1920 },
  right:  { x: 778, y: 0, w: 302, h: 1920 },
  top:    { x: 0, y: 0, w: 1080, h: 192 },
  bottom: { x: 0, y: 1632, w: 1080, h: 288 },
};

const s = (px: number) => Math.round((px / 1080) * SCENE_WIDTH);

export default function Scene3() {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // TODO: Animator implements behind-text-slide here
  // Your animation renders on the MIDLAYER — behind the speaker.
  // The person layer (matte) will be composited ON TOP of your output.
  // Elements behind SPEAKER.bboxPx will be partially hidden by the speaker.
  // Elements in VISIBLE_ZONES will be fully visible.

  return (
    <AbsoluteFill>
      {/* Depth animation goes here */}
    </AbsoluteFill>
  );
}
```

### What the Animator knows

The animator's skeleton tells it everything:

1. **Layer position**: `DISPLAY_MODE = 'depth'` → "my code renders behind the speaker"
2. **Technique**: `DEPTH_TECHNIQUE = 'behind-text-slide'` → look up reference implementation
3. **Speaker position**: `SPEAKER.bboxPx` → the person occupies this rectangle
4. **Visible zones**: `VISIBLE_ZONES` → elements here are fully visible, not behind speaker
5. **Design intent**: elements placed behind `SPEAKER.bboxPx` create the depth effect (partially occluded by person layer)

### Animator prompt additions (`depth-compositing.xml`)

New shared prompt module loaded for depth scenes:

```xml
<depth-compositing>
  <principle>
    Your scene renders on the MIDLAYER — between the background video and the
    person layer. The person (extracted via matte) is composited ON TOP of your
    output. This means:
    - Elements behind SPEAKER.bboxPx → partially hidden by speaker = DEPTH EFFECT
    - Elements in VISIBLE_ZONES → fully visible around the speaker
    - Elements crossing the speaker edge → natural occlusion at the matte boundary
  </principle>

  <spatial-rules>
    - Position key content so it PEEKS from behind the speaker (partially visible)
    - Don't center animations directly behind the speaker's face (fully hidden = wasted)
    - Use SPEAKER.centerPx as the origin for radial/burst effects
    - Text should be at SPEAKER chest/shoulder height for natural partial occlusion
    - Animate FROM visible zones INTO the speaker area (slide-in creates reveal)
  </spatial-rules>

  <technique-refs>
    Each DEPTH_TECHNIQUE has a reference implementation in
    src/components/depth-templates/. Use as starting point, adapt to scene brief.
  </technique-refs>
</depth-compositing>
```

### Pre-built depth templates

Common techniques ship as reference implementations in `src/components/depth-templates/`:

| Template | What it does | Animator adapts |
|----------|-------------|-----------------|
| `BehindTextSlide.tsx` | Large text slides in from side, settles behind speaker | Text content, direction, timing |
| `RadialBurst.tsx` | Lines/rays expand from speaker center outward | Color, ray count, timing |
| `BackgroundColorWash.tsx` | Gradient fills behind speaker | Colors, direction, easing |
| `RisingElements.tsx` | Icons/shapes rise from bottom behind speaker | Element type, count, speed |
| `StatCounterBehind.tsx` | Large number animates behind speaker | Value, font size, position |
| `BokehDepth.tsx` | Soft light circles float between layers | Color palette, density, speed |
| `DepthLowerThird.tsx` | Name bar that passes behind speaker's body | Text content, bar style |
| `SilhouetteEdgeGlow.tsx` | Colored glow traces person outline | Color, pulse speed, intensity |

These are NOT full templates (not in the template registry). They're reference Remotion components the animator imports or copies code from.

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

## Sandbox Integration

### Init data

`buildInitData()` includes a flag that segmentation is available as a capability (head tracking data confirms a person is in the video):

```typescript
segmentationAvailable: !!project.headTrackingData?.faces?.length
```

No matte is downloaded during init — it doesn't exist yet.

### Orchestrator pipeline

Code writing doesn't need the matte — only rendering does. The key rendering checkpoints:

| Phase | Sub-agent | Renders? | Needs matte? |
|-------|-----------|----------|-------------|
| 2 | Trim Editor | No | No |
| 3 | Planner | 1-2 stills max | No |
| 4 | Setup Agent | `render_still` max 1 cycle | Possible (skeleton scenes) |
| 5 | Layout Editor | `render_still` multiple times | **Yes** — verifies depth layouts |
| 6 | Animators (parallel) | **Forbidden** by prompt | No |
| 7 | Final Editor | `validate_workspace` (1 still/scene) | **Yes** |

```
Phase 1: Init (download video, audio, extract, proxy)
Phase 2: Trim Editor (trim fillers, silences)
Phase 3: Planner (decides depth scenes → calls request_segmentation async)
           ↳ Worker starts matting depth ranges on GPU in background
Phase 4: Setup Agent (writes scene skeletons, shared components incl. SandwichComposite)
Phase 5: Layout Editor (builds timeline, keyframes, track structure)
           ↳ Matte should be ready by now (short clips: 3-10s on GPU)
           ↳ If not ready: SandwichComposite falls back to normal video render
Phase 6: Animators in parallel (write all scene animations — rendering forbidden)
Phase 7: Final Editor (validate_workspace renders 1 still/scene — matte MUST be available)
```

**Matte request fires in Phase 3 (Planner).** Short clips (5-30s) process in ~3-10s on GPU. By Phase 5 (Layout Editor), mattes are typically ready. Phase 7 (Final Editor) is the hard deadline — `validate_workspace` renders stills and `SandwichComposite` must have the matte files. If matte is late, Phase 5 renders gracefully degrade (show normal video).

### Matte delivery to workspace

When the worker completes a segmentation job, the API proxies the matte clip from MinIO into the sandbox workspace:

```
Worker completes → MinIO: projects/{id}/matte-scene-2.mp4
                        ↓
API callback to sandbox → downloads to public/matte/scene-2.mp4
                        ↓
Agent picks up and uses in SandwichComposite
```

---

## Data Flow (Complete)

```
1. User uploads video (5-10 min)
2. Worker: transcribe, head-track, reframe
3. User opens editor, trims video, arranges storyline
4. User triggers AI generation → sandbox starts
5. Workspace init: download source.mp4, audio, etc.
6. Planner knows segmentation is available (head tracking detected faces)
   ├── Scene 1: displayMode "Overlay" (no matte needed)
   ├── Scene 2: displayMode "Depth" — behind-text-slide (15s-30s)
   ├── Scene 3: displayMode "Stacked" (no matte needed)
   └── Scene 4: displayMode "Depth" — radial-burst (45s-55s)
7. Agent calls request_segmentation for depth ranges:
   ├── Worker: extract 15s-30s → RVM → matte-scene-2.mp4 → MinIO
   └── Worker: extract 45s-55s → RVM → matte-scene-5.mp4 → MinIO
8. Agent continues with non-depth scenes (setup, layout, animation)
9. Matte clips ready → downloaded to public/matte/scene-2.mp4, scene-5.mp4
10. Depth scene animators use SandwichComposite with matte clips
11. Review: render stills at depth scenes, verify compositing
12. Final render: Remotion renders full sandwich composite
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
| No person detected (no head tracking) | `segmentationAvailable: false`; planner skips depth mode entirely |
| Worker segmentation job fails | Agent falls back to non-depth display mode for that scene |
| Worker segmentation slow | No impact — all animations are written without matte; only review/render waits |
| Multiple people | RVM segments all as foreground (single matte) — acceptable for V1 |
| Speaker moves rapidly | Planner avoids depth mode for fast-motion sections (matte edges degrade) |
| Many depth scenes requested | Worker processes ranges in parallel; each is short (5-30s) |
| Audio-only | No head tracking → `segmentationAvailable: false` |

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
