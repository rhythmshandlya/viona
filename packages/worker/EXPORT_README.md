# Export System Documentation

This document explains how the video export system works end-to-end, from the frontend UI to the final rendered video.

## Overview

The export system renders a final video that matches the frontend preview exactly, including:
- **Remotion visuals** (AI-generated animations)
- **Source video** (in PiP or split layout)
- **Per-scene display modes** (fullscreen, overlay, PiP switching with transitions)
- **Enhanced audio** (if available)
- **Styled captions** (with word-by-word, phrase, or karaoke highlighting)
- **Audio-only projects** (black canvas + visuals + subtitles)

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│   API Server    │────▶│   Worker        │
│   ExportModal   │     │   /render       │     │   BullMQ Job    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
                                                ┌─────────────────────┐
                                                │    Render Steps     │
                                                │ 1. Load project     │
                                                │ 2. Download assets  │
                                                │ 3. Extract display  │
                                                │    mode segments    │
                                                │ 4. Remotion SSR     │
                                                │ 5. FFmpeg composite │
                                                │    + display modes  │
                                                │    + ASS subtitles  │
                                                │ 6. Upload S3        │
                                                └─────────────────────┘
```

## Frontend Flow

### 1. ExportModal Component
**File:** `apps/web/src/features/editor-v2/components/ExportModal.tsx`

```typescript
// Gets layout settings from editor store
const layoutSettings = useLayoutSettings();

// Triggers render with layout settings
const { jobId } = await api.renderProject(projectId, { layoutSettings });
```

The modal:
- Shows export options (format, quality)
- Passes `layoutSettings` to match preview exactly
- Subscribes to job progress via WebSocket
- Falls back to polling if WebSocket unavailable
- Shows download button when complete

### 2. Layout Settings Structure
**File:** `apps/web/src/features/editor-v2/store/types.ts`

```typescript
interface LayoutSettings {
  mode: 'pip' | 'split-horizontal' | 'split-vertical';
  pip: {
    position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    offsetX: number;
    offsetY: number;
    size: 'small' | 'medium' | 'large' | 'custom';
    customSize: number;      // 5-50% of canvas width
    shape: 'square' | 'circle' | 'rounded';
    borderRadius: number;
    borderWidth: number;
    borderColor: string;     // hex or rgba
    shadowEnabled: boolean;
    shadowColor: string;
    shadowBlur: number;
    opacity: number;         // 0-1
  };
  split: {
    position: 'visuals-first' | 'video-first';
    ratio: number;           // 0-100, percentage for visuals
    gap: number;
  };
}
```

### 3. Per-Scene Display Modes

Each visual timeline item can have its own `displayMode` stored in `item.data.displayMode`:

| Display Mode | Behavior |
|-------------|----------|
| `pip` (default) | Uses the global layout (PiP or split) |
| `fullscreen` | Remotion visuals fill entire canvas, hiding source video |
| `overlay` | Source video fullscreen with Remotion visuals at 70% opacity on top |

Scenes can also have per-scene transitions (`item.data.transition`) with enter/exit types (`cut` or fade) and durations. Gaps between visual items show the source video fullscreen.

## Backend API

### Render Endpoint
**File:** `packages/api/src/routes/projects.ts`

```
POST /api/projects/:id/render
Body: { layoutSettings?: LayoutSettings }
Response: { jobId: string }
```

The endpoint:
1. Validates project ownership
2. Creates a job record in database
3. Queues render job via BullMQ
4. Returns job ID for progress tracking

### Job Queue
**File:** `packages/api/src/services/queue.ts`

```typescript
interface RenderJobData {
  projectId: string;
  jobId: string;
  projectType?: string;           // 'video' (default) or 'audio'
  layoutSettings?: LayoutSettings;
  fullscreenSegments?: FullscreenSegment[];
}

// Job is queued with retry logic
await renderQueue.add('render', data, {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 }
});
```

## Worker Render Process

**File:** `packages/worker/src/processors/render.ts`

The render processor selects one of four paths based on project type and presence of visuals:

| Project Type | Has Visuals? | Render Path |
|-------------|-------------|-------------|
| Video | Yes | Remotion SSR + FFmpeg composite (layout + display modes + subtitles) |
| Video | No | Remotion browser-based subtitle render + audio mux |
| Audio | Yes | Remotion SSR + `finalizeRemotionVideo` (visuals + subtitles + audio, no source video) |
| Audio | No | FFmpeg black canvas + ASS subtitles + audio |

### Step 1: Load Project Data

```typescript
// Load project, tracks, and timeline items
const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
const allItems = []; // All timeline items across all tracks
```

### Step 2: Download Assets

```typescript
// Download source video
await downloadFile('uploads', project.videoKey, videoPath);

// Download enhanced audio (if available)
if (enhancedAudioItem) {
  await downloadFile('outputs', audioKey, enhancedAudioPath);
}
```

### Step 3: Extract Display Mode Segments

Before rendering, the pipeline analyzes all visual timeline items to extract per-scene display modes:

```typescript
// Each visual item has a displayMode: 'pip' | 'fullscreen' | 'overlay'
const fullscreenVisualSegments: DisplayModeSegment[] = [];  // Remotion fills canvas
const overlaySegments: DisplayModeSegment[] = [];           // Remotion at 70% opacity over source
const gapSegments: DisplayModeSegment[] = [];               // No visual active, source fullscreen

interface DisplayModeSegment {
  startMs: number;
  endMs: number;
  enterDurationMs?: number;  // transition duration when entering (0 = cut)
  exitDurationMs?: number;   // transition duration when exiting (0 = cut)
}
```

Transition durations are only applied when the layout actually changes between adjacent scenes (e.g., from `pip` to `fullscreen`). Consecutive scenes with the same display mode do not get transition effects at their shared boundary.

### Step 4: Render Remotion Visuals (if present)

```typescript
// Use pre-built bundle (compositionId uses underscores, bundle directory uses hyphens)
const bundleDirName = projectVisual.compositionId.replace(/_/g, '-');
const bundlePath = join(config.remotion.bundleOutputDir, bundleDirName);

await renderWithRemotion({
  bundlePath,
  compositionId: projectVisual.compositionId,
  outputPath: remotionTempPath,
  onProgress: (progress) => { /* 30-70% of job progress */ },
});
```

### Step 5: Composite with FFmpeg

The render uses different FFmpeg filter chains based on layout mode:

#### PiP Mode Filter Chain

```
┌─────────────────────────────────────────────────────────────────┐
│                    FFmpeg Filter Graph (PiP)                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [1:v] ──▶ scale/crop to full canvas ──────────────▶ [bg]      │
│            (Remotion visuals = background)                      │
│                                                                 │
│  [0:v] ──▶ scale/crop to PiP size ─────────────────▶ [pip]     │
│            (source video = PiP overlay)                         │
│                                                                 │
│  [bg][pip] ──▶ overlay at position ──▶ [outv]                  │
│                                                                 │
│  Optional: Per-scene display mode layers (see below)            │
│  Optional: Subtitles                                            │
│  [outv] ──▶ subtitles=file.ass:fontsdir=... ──▶ [final]       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

PiP sizes: `small` = 18%, `medium` = 25%, `large` = 35%, `custom` = user-specified.

#### Split Horizontal Mode Filter Chain (top/bottom)

```
┌─────────────────────────────────────────────────────────────────┐
│               FFmpeg Filter Graph (Split Horizontal)            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [0:v] ──▶ scale/crop (video section height) ──▶ [video]       │
│                                                                 │
│  [1:v] ──▶ scale/crop (visuals section height, crop 0:0)       │
│            ──▶ [visuals]                                        │
│                                                                 │
│  [visuals][video] ──▶ vstack ──▶ [outv]                        │
│  (or [video][visuals] if video-first)                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

Note: Remotion visuals crop from top-left (0:0) because content is rendered at position (0,0). Center crop would clip the visual content and show background instead.

#### Split Vertical Mode Filter Chain (left/right)

```
┌─────────────────────────────────────────────────────────────────┐
│               FFmpeg Filter Graph (Split Vertical)              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [0:v] ──▶ scale/crop (video section width) ──▶ [video]        │
│                                                                 │
│  [1:v] ──▶ scale/crop (visuals section width, crop 0:0)        │
│            ──▶ [visuals]                                        │
│                                                                 │
│  [visuals][video] ──▶ hstack ──▶ [outv]                        │
│  (or [video][visuals] if video-first)                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Per-Scene Display Mode Overlay Layers

When scenes use `fullscreen` or `overlay` display modes, or when there are gaps between visual items, additional FFmpeg overlay layers are chained after the base layout filter:

```
Base layout (pip/split) ──▶ [outv]
    │
    ▼  (if fullscreen/overlay/gap segments exist)
Split input streams:
  [0:v] ──▶ split N ──▶ [src_layout] + [src_extra]
  [1:v] ──▶ split N ──▶ [vis_layout] + [vis_fs] + [vis_ovl]
    │
    ▼
Layer 1: Fullscreen visual segments
  [vis_fs] ──▶ scale/crop full canvas ──▶ overlay with enable expr ──▶ [after_fs]
    │
    ▼
Layer 2: Gap + Overlay background (source video fullscreen)
  [src_extra] ──▶ scale/crop full canvas ──▶ overlay with enable expr ──▶ [after_src]
    │
    ▼
Layer 3: Overlay visual segments (Remotion at 70% opacity)
  [vis_ovl] ──▶ scale/crop ──▶ colorchannelmixer=aa=0.7 ──▶ overlay ──▶ [after_ovl]
    │
    ▼
  [after_ovl] ──▶ copy ──▶ [outv]
```

Each overlay uses FFmpeg `enable` expressions like `between(t,1.000,5.500)+between(t,8.000,12.000)` to activate only during the relevant time segments. Transitions use FFmpeg's `fade` filter with `alpha=1` for smooth enter/exit fades.

### Step 6: Generate ASS Subtitles

**Function:** `generateASSForComposite(subtitles, width, height, layoutSettings?, fontFamilyOverride?)`

Converts caption items to ASS (Advanced SubStation Alpha) format with full styling. PlayResX/PlayResY are set to the actual canvas dimensions so font sizes map 1:1 (no manual scaling needed).

```ass
[Script Info]
Title: Viona Subtitles
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Style: Default,Inter,56,&H00FFFFFF,&H0000FFFF,&H00000000,&H80000000,-1,0,0,0,100,117,0,0,1,3,2,2,10,10,150,1
Style: Active,Inter,56,&H0000FFFF,&H00FFFFFF,&H00000000,&H80000000,-1,0,0,0,100,117,0,0,1,3,2,2,10,10,150,1

[Events]
Dialogue: 0,0:00:01.00,0:00:02.50,Default,,0,0,0,,Hello world
Dialogue: 0,0:00:01.00,0:00:01.50,Default,,0,0,0,,{\c&H0000FFFF}Hello{\c&H00FFFFFF} world
```

#### Font Resolution

Fonts are resolved through a priority chain:
1. Direct match in Google Fonts registry (20+ fonts: Inter, Montserrat, Poppins, Anton, etc.)
2. Fallback map for commercial/system fonts (e.g., `Komika Axis` -> `Anton`, `Helvetica Neue` -> `Inter`)
3. Ultimate fallback: `Inter`

Fonts are downloaded from Google Fonts CSS API at export time and cached locally. In Docker, pre-installed system fonts in `/usr/share/fonts` are used instead.

#### Caption Style Properties Applied

| Frontend Property | ASS Equivalent |
|-------------------|----------------|
| `fontFamily` | Fontname (resolved via fallback chain) |
| `fontSize` | Fontsize (direct, no scaling -- PlayRes handles it) |
| `fontWeight` | Bold (-1 if >= 700) |
| `letterSpacing` | Spacing |
| `lineHeight` | ScaleY (lineHeight / 1.2 * 100, approximation) |
| `textTransform` | Applied to text content directly |
| `color` | PrimaryColour (with opacity applied to alpha) |
| `activeColor` | SecondaryColour + inline `\c` tags (with opacity) |
| `backgroundColor` | BackColour (transparent = outline+shadow mode, color = opaque box) |
| `opacity` | Alpha channel on PrimaryColour/SecondaryColour |
| `textShadow` | `\xshad`, `\yshad`, `\blur` override tags |
| `position` | Object `{anchor, offsetX, offsetY, rotation, textAlign}` or legacy string |
| `position.textAlign` | ASS Alignment column (left=1, center=2, right=3) |
| `position.anchor` | ASS Alignment row (bottom=0, center=3, top=6) |
| `position.offsetX/Y` | MarginL, MarginR, MarginV adjustments |
| `position.rotation` | `\frz` override tag |
| `wordsPerPhrase` | Number of words per phrase group |

#### Caption Display Modes

1. **word-by-word**: One Dialogue line per word, each using the Active style
2. **phrase** (default): Full phrase shown, one Dialogue line per word's active period with only the current word highlighted via inline `\c` color tags; gaps between words show all words in base color
3. **karaoke**: Full phrase with `\kf` (fill effect) tags for smooth left-to-right highlighting per word

Per-word style overrides (font, color, size, transform) are supported via inline ASS override tags, with reset tags between overridden words.

### Step 7: Final FFmpeg Encode

```typescript
const args = [
  '-i', 'source.mp4',
  '-i', 'remotion.mp4',
  '-i', 'audio.m4a',        // if enhanced audio
  '-filter_complex', filterComplex,
  '-map', '[outv]',
  '-map', '2:a',            // audio from enhanced source (or '-map', '0:a?' for source)
  '-c:v', 'libx264',
  '-preset', 'faster',      // balances quality and memory usage to avoid OOM
  '-crf', '18',
  '-threads', '4',
  '-c:a', 'aac',
  '-shortest',
  'output.mp4'
];
```

### Step 8: Upload and Complete

```typescript
// Upload to S3/MinIO
await uploadFile('outputs', outputKey, outputPath);

// Update project and job status
await db.update(projects).set({
  outputKey,
  status: 'complete',
});
await db.update(jobs).set({
  status: 'complete',
  progress: 100,
  completedAt: new Date(),
});

// Notify frontend via Redis pub/sub
await publishJobComplete(jobId, projectId);
```

## PiP Layout Details

The FFmpeg PiP composite uses a simple scale + crop + overlay pipeline. Shape masks (circle, rounded), borders, shadows, and opacity from the `LayoutSettings.pip` config are applied by Remotion during the visual rendering phase, not by FFmpeg. The FFmpeg layer handles only positioning and sizing:

```
[1:v] scale to full canvas, crop, setsar=1 ──▶ [bg]     (Remotion = background)
[0:v] scale to PiP size, crop, setsar=1 ──▶ [pip]       (source video = overlay)
[bg][pip] overlay at computed (x, y) ──▶ [outv]
```

PiP position is computed from `pip.position` (corner) and `pip.offsetX/Y` (pixel offsets from that corner).

## Caption Positioning with Layout

The ASS generator adjusts caption position based on layout mode. Margins are computed as percentages of effective height (10% for top, 15% for bottom, 50% for center), modified by the `position.offsetY` value.

### PiP Mode
- If caption at bottom and PiP at bottom: increase margin to avoid overlap
- Margin = max(default_margin, pip_height + pip_offset + 20)

### Split Horizontal Mode
- If visuals-first: captions in bottom video section (effective height = video section only)
- If video-first: captions in top video section, margin adjusted for visuals section below

### Split Vertical Mode
- Captions span the full height, no vertical offset adjustment needed

## Progress Reporting

Progress is reported via Redis pub/sub and received by frontend WebSocket:

| Progress | Stage |
|----------|-------|
| 5% | Loading project data |
| 10% | Downloading video/audio assets |
| 20% | Preparing render (fonts, subtitles) |
| 30-70% | Rendering Remotion visuals (with per-scene progress messages) |
| 75-85% | Compositing with FFmpeg (layout + display modes + subtitles) |
| 85% | Uploading result to S3 |
| 100% | Complete |

For projects without Remotion visuals, the 30-70% range is used for Remotion-based subtitle rendering or direct FFmpeg subtitle burn-in.

## Error Handling

- Jobs retry 3 times with exponential backoff (5s, 10s, 20s)
- Errors published via Redis for frontend display
- Temp files cleaned up on success or failure
- Job status persisted in database

## File Locations

| Type | Bucket | Key Pattern |
|------|--------|-------------|
| Source Video | uploads | `{nanoid}/{filename}` |
| Source Audio (audio projects) | uploads | `{audioKey}` |
| Enhanced Audio | outputs | `{projectId}/enhanced.m4a` |
| Remotion Bundle | local | `{REMOTION_BUNDLE_OUTPUT_DIR}/{compositionId-with-hyphens}` |
| Temp Work Dir | local | `{tmpdir}/viona-render-{nanoid}/` |
| Font Cache | local | `{tmpdir}/clippify-fonts/` |
| Final Output | outputs | `{nanoid}/output.mp4` |

Note: The Remotion bundle directory name uses hyphens (e.g., `my-composition-id`), while the composition ID registered in the bundle uses underscores (e.g., `my_composition_id`).

## Environment Variables

```env
REDIS_URL=redis://localhost:6379
DATABASE_URL=postgresql://...
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=...
MINIO_SECRET_KEY=...
REMOTION_BUNDLE_OUTPUT_DIR=/app/bundles
```
