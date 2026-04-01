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

### Default track structure (matting always available)

```
position 4: overlay    — Captions, foreground HUD elements
position 3: scene-fg   — Animation elements IN FRONT of speaker
position 2: person     — Matted person layer (always present)
position 1: scene-bg   — Animation elements BEHIND speaker
position 0: video      — Source video (original background)
```

The person track is **always present** — matting is guaranteed. Every scene can place elements on `scene-fg` (in front) or `scene-bg` (behind) or both. This is the default, not an opt-in feature.

### How scenes use layers

A single scene's animation can span both `scene-bg` and `scene-fg` tracks. For example, an overlay stat card could:
- Slide in from the right on `scene-bg` (behind speaker)
- Cross behind the speaker's body
- The number portion pops up on `scene-fg` (in front of speaker)

The animator decides per-element which layer it belongs to. The layout editor sets up the track structure.

### Editor UI

1. **Layer panel**: Always shows the 5-track sandwich. User can drag items between fg/bg tracks.
2. **Track reordering**: User (or AI agent) can move any animation element between in-front and behind.
3. **Preview**: Remotion player always renders the sandwich composite with person layer.
4. **Per-element depth**: Each item in a scene can target `scene-fg` or `scene-bg` — not a binary scene-level decision.

---

## Planner Integration

### Display modes (updated with depth awareness)

Matting is always available. Depth interactions (elements behind/in front of the speaker) apply to **overlay mode only** — the speaker is full-screen, so there's a body to interact with. Stacked and fullscreen modes don't use depth.

| Mode | Description | Depth capability |
|------|-------------|-----------------|
| **Overlay** | Speaker full-screen, animations interact with speaker layers | **Full depth.** Elements can slide behind speaker's body, weave between layers, pass behind shoulders. Multiple animations per scene: stats behind + lower third in front + background wash. |
| **Stacked** | Speaker in bottom portion, animation in top portion | **No depth.** Speaker is cropped to bottom half — no full body to interact with. Animation stays in top portion. |
| **Fullscreen** | Speaker hidden, animation fills canvas | **No depth.** Speaker is faded out — nothing to go behind. Pure animation canvas. |

The planner's animation brief now describes **which elements go behind vs in front** of the speaker, not just what the animation does:

```markdown
## Scene 2: The Key Metric
**Display mode:** Overlay
**Animation brief:**
Large "73%" counter scales up BEHIND the speaker from center,
settling at chest height. The number peeks from behind both shoulders.
A label "of users" slides in from the right IN FRONT of the speaker,
positioned at the bottom third. The depth creates emphasis — the
stat feels massive, the speaker presents it.
```

### Planner vocabulary: Depth interactions

The planner uses these terms in animation briefs to describe layer behavior:

**Behind-speaker interactions:**
- `emerge-behind` — Element scales up or slides in behind the speaker
- `peek-sides` — Element is wide enough to be visible on both sides of the speaker
- `cascade-behind` — Multiple elements stack or flow behind the speaker
- `background-fill` — Color/gradient/pattern fills behind speaker (original bg still visible at edges)
- `depth-lower-third` — Bar/label passes behind speaker's body

**Front-to-back interactions (elements that cross layers):**
- `weave-through` — Element enters in front, passes behind speaker, exits in front (or vice versa)
- `split-depth` — Part of the element is behind speaker, part is in front (e.g., a bar chart where bars go behind but labels stay in front)
- `depth-reveal` — Element starts fully behind speaker, then the speaker moves/scales to reveal it

**Around-speaker interactions:**
- `flank` — Elements appear on both sides of the speaker, framing them
- `radial-from-speaker` — Elements emanate outward from behind the speaker's center
- `parallax-offset` — Elements at different depths move at different rates relative to speaker

**Anti-patterns (planner must avoid):**
- Don't put every element behind the speaker — mix front and back for contrast
- Don't animate multiple behind-speaker elements simultaneously (one motion per moment)
- Don't place readable text fully behind the speaker's face (occluded = invisible)
- Don't use depth interaction terms in Stacked or Fullscreen briefs (no speaker body to interact with)
- Depth vocabulary (`emerge-behind`, `peek-sides`, `weave-through`, etc.) is for Overlay mode only

---

## Layout Editor → Animator Handoff (Layer-Aware)

The existing handoff (Planner → Layout Editor → Setup Agent → Animator) is extended with layer awareness and speaker spatial data. Since matting is always available, every scene skeleton includes speaker position data and the animator always knows which layer each element targets.

### What the Planner writes (SCENE_PLAN.md)

```markdown
## Scene 3: The Key Insight
**File:** Scene3.tsx
**Time:** 15000 – 25000ms
**Display mode:** Overlay

### Scene dimensions
- Width: 1080 Height: 1920

### Scene placement
- Placement: overlay-large

### Animation brief
Large "THE KEY INSIGHT" text EMERGES BEHIND the speaker from the right,
settling at chest height — speaker's shoulders partially occlude it,
creating depth. A supporting label "everything changes here" slides in
IN FRONT of the speaker at the bottom third. The contrast between
behind and in-front elements creates the emphasis beat.
```

### What the Layout Editor writes (manifest)

Since matting is always available, **every scene item** gets speaker spatial data — not just depth-specific scenes:

```typescript
add_item({
  type: "scene",
  trackId: "trk-scenes",
  startMs: 15000,
  endMs: 25000,
  data: {
    sceneFile: "Scene3.tsx",
    displayMode: "overlay",
    speakerBbox: { x: 0.28, y: 0.10, w: 0.44, h: 0.75 },  // normalized 0-1
    speakerCenter: { x: 0.50, y: 0.45 },                     // face center
    visibleZones: {                                            // areas NOT behind speaker
      left:   { x: 0, y: 0, w: 0.28, h: 1.0 },
      right:  { x: 0.72, y: 0, w: 0.28, h: 1.0 },
      top:    { x: 0, y: 0, w: 1.0, h: 0.10 },
      bottom: { x: 0, y: 0.85, w: 1.0, h: 0.15 }
    }
  },
  transform: { x: 0, y: 0, width: 1080, height: 1920 }
})
```

**Every scene item includes:**
- `speakerBbox` — normalized bounding box of the speaker (matte-derived)
- `speakerCenter` — center point (for radial effects, glow origin, etc.)
- `visibleZones` — areas not occluded by the speaker (for fully-readable content)

The animator reads these to decide where to place behind-speaker vs in-front elements.

**Speaker position source: matte-derived bbox (replaces head tracking).**

The old head tracking pipeline (MediaPipe face/pose landmarks via `detect_head.py`) is deprecated for speaker positioning. The matte video provides a more accurate full-body silhouette — shoulders, arms, hair, torso — not just face landmarks.

Speaker bbox is derived from the matte by scanning the alpha channel for the bounding rectangle of white pixels per frame. This runs as a lightweight post-processing step after RVM segmentation (no additional ML model needed — just numpy operations on the matte frames).

The `get_speaker_position` MCP tool will be updated to read from matte-derived data instead of head tracking data. Head tracking (`detect_head.py`) remains only for shot boundary detection — speaker positioning is fully replaced by matte-derived bounds.

### What the Setup Agent writes (skeleton)

```tsx
// src/scenes/Scene3.tsx — skeleton (every scene gets speaker data)
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';

export const SCENE_WIDTH = 1080;
export const SCENE_HEIGHT = 1920;
export const DISPLAY_MODE = 'overlay';

// Speaker position (matte-derived, always available)
export const SPEAKER = {
  bbox: { x: 0.28, y: 0.10, w: 0.44, h: 0.75 },
  center: { x: 0.50, y: 0.45 },
  bboxPx: { x: 302, y: 192, w: 475, h: 1440 },
  centerPx: { x: 540, y: 864 },
};

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

  // Scene has two output layers:
  // - Elements returned in <BehindSpeaker> render on scene-bg (behind person)
  // - Elements returned in <InFrontOfSpeaker> render on scene-fg (in front of person)
  // - Elements behind SPEAKER.bboxPx are partially occluded by the person
  // - Elements in VISIBLE_ZONES are fully visible
  //
  // A single scene can have MULTIPLE animations across both layers:
  //   - A stat counter emerging behind the speaker
  //   - A label sliding in front at the bottom
  //   - A lower third weaving behind the speaker's body
  // Mix and match layers per element for the best visual result.

  return (
    <>
      <BehindSpeaker>
        {/* Elements that render behind the person */}
      </BehindSpeaker>
      <InFrontOfSpeaker>
        {/* Elements that render in front of the person */}
      </InFrontOfSpeaker>
    </>
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

### Animator prompt additions (`layer-compositing.xml`)

New shared prompt module loaded for ALL scenes (not just depth):

```xml
<layer-compositing>
  <principle>
    Every scene has two output layers: BehindSpeaker and InFrontOfSpeaker.
    The person (extracted via matte) sits between them. You can place ANY
    element on EITHER layer — mix and match for the best visual result.

    A single scene can have MULTIPLE animations across both layers:
    - A stat counter emerging behind the speaker (BehindSpeaker)
    - A label positioned as a lower third in front (InFrontOfSpeaker)
    - A progress bar that starts behind, then a callout pops in front
    - Background color wash behind + floating data card in front

    The creative brief tells you what goes where. When it says "emerge behind"
    or "peek from behind shoulders", use BehindSpeaker. When it says "overlay",
    "lower third", "in front", use InFrontOfSpeaker. When it doesn't specify,
    use your judgment — whatever makes the video look best.
  </principle>

  <spatial-rules>
    - SPEAKER.bboxPx defines the person's silhouette on canvas
    - VISIBLE_ZONES are areas around the speaker (not occluded)
    - BehindSpeaker elements behind SPEAKER.bboxPx → partially hidden = depth effect
    - BehindSpeaker elements in VISIBLE_ZONES → fully visible
    - InFrontOfSpeaker elements → always fully visible, on top of person
    - Position key behind-speaker content to PEEK from edges (partially visible)
    - Don't put readable text fully behind the speaker's face
    - Use SPEAKER.centerPx as origin for radial/burst effects
  </spatial-rules>

  <multi-element-scenes>
    Overlay scenes are no longer limited to a single floating card. With layers,
    a scene can combine:
    - Behind: background color wash or pattern
    - Behind: large stat/text peeking from behind shoulders
    - Front: lower third name bar
    - Front: small callout card positioned in a visible zone
    Stagger entrances so only one element animates at a time.
  </multi-element-scenes>
</layer-compositing>
```

### Pre-built depth templates

Depth variants of existing content templates, registered in the template registry with `-depth` suffix. These render at full canvas (1080x1920) on the midlayer, designed to look good when partially occluded by the speaker's silhouette.

**Magazine theme depth templates:**

| Template | Base | What it does behind the speaker |
|----------|------|--------------------------------|
| `magazine-stats-depth` | `magazine-stats` | Oversized stat cards scatter across full canvas with torn paper edges. Cards behind speaker are partially hidden, cards at speaker's sides are fully visible. The speaker becomes a natural divider between data points. |
| `magazine-timeline-depth` | `magazine-timeline` | Timeline thread runs vertically behind speaker. Event cards emerge from behind speaker's shoulders, staggering left and right. Speaker stands "in front of history." |
| `magazine-quote-depth` | `magazine-quote` | Large serif quote text fills the background behind speaker. Speaker partially occludes the quote, creating a "words behind the person" editorial magazine feel. |
| `magazine-comparison-depth` | `magazine-comparison` | Left subject appears behind speaker's left side, right subject behind the right. Speaker stands between the two options being compared. |
| `magazine-checklist-depth` | `magazine-checklist` | Checklist items stack vertically behind speaker, ticking off as narrated. Items peek from behind the speaker's torso. |

**Explainer/blackboard theme depth templates:**

| Template | Base | What it does behind the speaker |
|----------|------|--------------------------------|
| `explainer-process-depth` | `explainer-process` | Process steps emerge from behind speaker one-by-one, flowing from speaker center outward. Glow effects radiate from behind the silhouette. |
| `explainer-layers-depth` | `explainer-layers` | System layers stack in depth behind speaker — back layers are smaller/dimmer, front layers are larger/brighter. Speaker stands "in front of the architecture." |
| `explainer-stats-depth` | `explainer-stats` | CountUp numbers scale up from behind speaker's center mass. Numbers grow large enough to peek past the speaker's edges. Clean dark background with glow emphasis. |
| `explainer-comparison-depth` | `explainer-comparison` | Two sides of the comparison split behind the speaker, one on each side. Glow highlights the winning side. Speaker is the neutral center. |

**Shared depth utilities (not templates, used by all depth templates):**

| Component | Purpose |
|-----------|---------|
| `SpeakerAwareLayout.tsx` | Positions children relative to speaker bbox — methods: `peekLeft()`, `peekRight()`, `behindCenter()`, `flanking()` |
| `DepthEntrance.tsx` | Animated entrance that originates from behind speaker center and expands outward |
| `DepthParallax.tsx` | True depth parallax — near elements move more than far elements relative to speaker position |

**Design rules for depth templates:**
- Full canvas (1080x1920) — the entire background is your canvas
- Speaker bbox is available as constants — position key content to PEEK from behind edges
- Don't center important content directly behind speaker's face (fully occluded = invisible)
- Place content at chest/shoulder height for natural partial occlusion
- Use the speaker's sides (VISIBLE_ZONES.left, VISIBLE_ZONES.right) for content that must be fully readable
- Preserve theme aesthetics — magazine depth uses torn paper/parallax, blackboard depth uses glow/clean lines

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
