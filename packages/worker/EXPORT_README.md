# Export System Documentation

This document explains how the video export system works end-to-end, from the frontend UI to the final rendered video.

## Overview

The export system renders a final video that matches the frontend preview exactly, including:
- **Remotion visuals** (AI-generated animations)
- **Source video** (in PiP or split layout)
- **Enhanced audio** (if available)
- **Styled captions** (with word-by-word highlighting)

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│   API Server    │────▶│   Worker        │
│   ExportModal   │     │   /render       │     │   BullMQ Job    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
                                                ┌─────────────────┐
                                                │   Render Steps  │
                                                │ 1. Remotion SSR │
                                                │ 2. FFmpeg Comp  │
                                                │ 3. Upload S3    │
                                                └─────────────────┘
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
  layoutSettings?: LayoutSettings;
}

// Job is queued with retry logic
await renderQueue.add('render', data, {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 }
});
```

## Worker Render Process

**File:** `packages/worker/src/processors/render.ts`

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

### Step 3: Render Remotion Visuals (if present)

```typescript
// Bundle and render Remotion composition
const bundled = await bundle(entryPoint);
const composition = await selectComposition({ serveUrl: bundled, id: compositionId });
await renderMedia({
  composition,
  serveUrl: bundled,
  outputLocation: remotionTempPath,
  codec: 'h264',
});
```

### Step 4: Composite with FFmpeg

The render uses different FFmpeg filter chains based on layout mode:

#### PiP Mode Filter Chain

```
┌─────────────────────────────────────────────────────────────────┐
│                    FFmpeg Filter Graph (PiP)                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [0:v] ──▶ scale/crop ──▶ shape mask ──▶ opacity ──┐           │
│            (source)       (circle/     (if < 1)    │           │
│                           rounded)                  │           │
│                                                     ▼           │
│  [1:v] ──▶ scale/crop ──────────────────────────▶ [bg]         │
│            (remotion)                               │           │
│                                                     │           │
│            ┌──────────────────────────────────────┐ │           │
│            │ Optional: Shadow                     │ │           │
│            │ split ──▶ colorize ──▶ boxblur ──▶ overlay        │
│            └──────────────────────────────────────┘ │           │
│                                                     │           │
│            ┌──────────────────────────────────────┐ │           │
│            │ Optional: Border                     │ │           │
│            │ color ──▶ shape mask ──▶ overlay     │ │           │
│            └──────────────────────────────────────┘ │           │
│                                                     │           │
│                                              [pip] ──▶ overlay ──▶ [outv]
│                                                                 │
│  Optional: Subtitles                                            │
│  [outv] ──▶ subtitles=file.ass ──▶ [final]                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Split Mode Filter Chain

```
┌─────────────────────────────────────────────────────────────────┐
│               FFmpeg Filter Graph (Split Horizontal)            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [0:v] ──▶ scale/crop (video section height) ──▶ [video]       │
│                                                                 │
│  [1:v] ──▶ scale/crop (visuals section height) ──▶ [visuals]   │
│                                                                 │
│  [visuals][video] ──▶ vstack ──▶ [outv]                        │
│  (or [video][visuals] if video-first)                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Step 5: Generate ASS Subtitles

**Function:** `generateASSForComposite()`

Converts caption items to ASS (Advanced SubStation Alpha) format with full styling:

```ass
[Script Info]
Title: Reelify Subtitles
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Style: Default,Inter,56,&H00FFFFFF,&H0000FFFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,3,2,2,10,10,150,1
Style: Active,Inter,56,&H0000FFFF,&H00FFFFFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,3,2,2,10,10,150,1

[Events]
Dialogue: 0,0:00:01.00,0:00:02.50,Default,,0,0,0,,Hello world
Dialogue: 1,0:00:01.00,0:00:01.50,Default,,0,0,0,,{\c&H0000FFFF}Hello{\c&H00FFFFFF} world
```

#### Caption Style Properties Applied

| Frontend Property | ASS Equivalent |
|-------------------|----------------|
| `fontFamily` | Fontname |
| `fontSize` | Fontsize (scaled for resolution) |
| `fontWeight` | Bold (-1 if >= 700) |
| `letterSpacing` | Spacing |
| `textTransform` | Applied to text content |
| `color` | PrimaryColour |
| `activeColor` | SecondaryColour + inline `\c` tags |
| `backgroundColor` | BackColour |
| `textShadow` | Outline + Shadow values |
| `position` | Alignment (2=bottom, 8=top, 5=center) |

#### Display Modes

1. **word-by-word**: Shows one word at a time with active color
2. **phrase**: Shows full phrase, highlights current word with overlay
3. **karaoke**: Uses `\kf` tags for fill effect animation

### Step 6: Final FFmpeg Encode

```typescript
const args = [
  '-i', 'source.mp4',
  '-i', 'remotion.mp4',
  '-i', 'audio.m4a',        // if enhanced audio
  '-filter_complex', filterComplex,
  '-map', '[outv]',
  '-map', '2:a',            // audio from enhanced source
  '-c:v', 'libx264',
  '-preset', 'medium',
  '-crf', '18',
  '-c:a', 'aac',
  '-shortest',
  'output.mp4'
];
```

### Step 7: Upload and Complete

```typescript
// Upload to S3/MinIO
await uploadFile('outputs', outputKey, outputPath);

// Update project status
await db.update(projects).set({
  outputKey,
  status: 'complete',
});

// Notify frontend via Redis pub/sub
await publishJobComplete(jobId, { outputKey });
```

## PiP Styling Implementation Details

### Shape Masks (geq filter)

**Circle:**
```
geq=a='if(gt(pow(X-radius,2)+pow(Y-radius,2),pow(radius,2)),0,255)'
```

**Rounded Rectangle:**
```
geq=a='if(between(X,r,W-r)+between(Y,r,H-r)+
       lte(hypot(X-r,Y-r),r)+lte(hypot(X-W+r,Y-r),r)+
       lte(hypot(X-r,Y-H+r),r)+lte(hypot(X-W+r,Y-H+r),r),255,0)'
```

### Shadow Effect

```
split[main][shadow_src];
[shadow_src]geq=r='R':g='G':b='B':a='alpha(X,Y)*0.6',boxblur=10:10[shadow];
[bg][shadow]overlay=x+offset:y+offset[bg_shadow];
[bg_shadow][main]overlay=x:y[outv]
```

### Border Effect

```
color=c=0xRRGGBB:s=WxH[border_bg];
[border_bg]<shape_mask>[border_shaped];
[bg][border_shaped]overlay=x-bw:y-bw[bg_border];
[bg_border][pip]overlay=x:y[outv]
```

### Opacity

```
colorchannelmixer=aa=0.8
```

## Caption Positioning with Layout

The ASS generator adjusts caption position based on layout mode:

### PiP Mode
- If caption at bottom and PiP at bottom: increase margin to avoid overlap
- Margin = max(default_margin, pip_height + pip_offset + 20)

### Split Horizontal Mode
- If visuals-first: captions in bottom video section
- If video-first: captions in top video section, margin adjusted for visuals below

## Progress Reporting

Progress is reported via Redis pub/sub and received by frontend WebSocket:

| Progress | Stage |
|----------|-------|
| 5% | Loading project |
| 10% | Downloading video |
| 20% | Preparing render |
| 30% | Rendering Remotion visuals |
| 60% | Remotion complete |
| 75% | Compositing with FFmpeg |
| 90% | Uploading |
| 100% | Complete |

## Error Handling

- Jobs retry 3 times with exponential backoff (5s, 10s, 20s)
- Errors published via Redis for frontend display
- Temp files cleaned up on success or failure
- Job status persisted in database

## File Locations

| Type | Bucket | Key Pattern |
|------|--------|-------------|
| Source Video | uploads | `{nanoid}/{filename}` |
| Enhanced Audio | outputs | `{projectId}/enhanced.m4a` |
| Remotion Bundle | local | `/app/bundles/{compositionId}` |
| Final Output | outputs | `{nanoid}/output.mp4` |

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
