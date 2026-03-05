# Overlay Zones Design Document

**Date:** 2026-03-05
**Status:** Approved
**Author:** Claude (with user collaboration)

## Overview

This document describes the end-to-end overlay system that enables zone-based positioning of animations and graphics around a segmented speaker. The system uses SAM2 for speaker segmentation during video upload and provides 5 overlay zones for creative placement.

## Problem Statement

Current overlay implementation has several issues:
1. `speakerBbox` field exists but is never populated (head detection broken)
2. Overlays simply composite on top with opacity, no spatial awareness
3. Cannot place graphics BEHIND the speaker
4. Layout modes (PiP, Stacked) are separate from display modes, causing confusion
5. No zone-based positioning for lower-thirds, titles, or creative effects

## Solution Summary

1. **SAM2 Segmentation on Upload**: Extract speaker from background using SAM2
2. **5 Overlay Zones**: Behind, Lower-Third, Top, Frame, Background
3. **Face Detection**: MediaPipe for face bounding box tracking
4. **Zone-Aware Templates**: Animations receive face position and adapt
5. **Layered Composition**: Remotion renders zones in correct z-order

---

## Architecture

### 1. Video Upload Processing Pipeline

```
Upload → Extract Frames → SAM2 Segmentation → Face Detection → Store Results
```

**Processing Steps:**

1. **Frame Extraction**: Extract frames at 10 FPS using FFmpeg
2. **SAM2 Segmentation**:
   - Detect person in first frame (auto or prompted)
   - Track across all frames using SAM2's video tracking
   - Output: per-frame alpha mask (person = white, background = black)
3. **Face Detection**:
   - Run MediaPipe Face Detection on each frame
   - Output: face bounding box timeline
4. **Storage**:
   - Masks: Compressed WebP sequence
   - Face data: JSON timeline stored with video metadata

**Storage Structure:**
```
/videos/{videoId}/
  ├── original.mp4
  ├── masks/
  │   ├── 0001.webp
  │   ├── 0002.webp
  │   └── ...
  └── metadata.json  // includes segmentation data
```

### 2. Overlay Zone System

```
┌─────────────────────────────────────────┐
│          TOP ZONE (15%)                 │  ← Titles, branding
├─────────────────────────────────────────┤
│                                         │
│     ┌─────────────┐                     │
│     │  SPEAKER    │ ← Extracted via     │
│     │  (Segmented)│   SAM2 mask         │
│     └─────────────┘                     │
│                                         │
│   BEHIND ZONE (full canvas)             │  ← Animations behind speaker
│                                         │
├─────────────────────────────────────────┤
│        LOWER-THIRD ZONE (20%)           │  ← Names, CTAs, captions
└─────────────────────────────────────────┘

FRAME ZONE: Effects around speaker silhouette
FULL BACKGROUND: Complete background replacement
```

**Zone Definitions:**

| Zone | Description | Use Cases |
|------|-------------|-----------|
| `behind` | Full canvas, renders UNDER speaker | Animated backgrounds, particles |
| `lower-third` | Bottom 20% of canvas | Name badges, CTAs, captions |
| `top` | Top 15% of canvas | Chapter titles, branding |
| `frame` | Follows speaker silhouette edge | Glow effects, borders, halos |
| `background` | Complete background replacement | Virtual backgrounds |

**Z-Order (bottom to top):**
1. Background replacement (if any)
2. Behind zone
3. Speaker (segmented)
4. Frame zone (edge effects)
5. Lower-third zone
6. Top zone

### 3. Data Model

**New Types:**

```typescript
// Overlay zone options
export type OverlayZone = 'behind' | 'lower-third' | 'top' | 'frame' | 'background' | 'none';

// Segmentation data stored with video
export interface SegmentationData {
  maskPath: string;           // Path to mask images
  maskFps: number;            // Frame rate of masks (e.g., 10)
  faceBboxTimeline: FaceBbox[];
}

export interface FaceBbox {
  frame: number;
  x: number;      // 0-1 normalized
  y: number;      // 0-1 normalized
  width: number;  // 0-1 normalized
  height: number; // 0-1 normalized
  confidence: number;
}

// Updated VideoItemData
export interface VideoItemData {
  // ... existing fields
  segmentation?: SegmentationData;
}

// Updated VisualItemData
export interface VisualItemData {
  // ... existing fields
  overlayZone: OverlayZone;
}
```

**Migration:**
- `displayMode: 'overlay'` → `overlayZone: 'behind'`
- `displayMode: 'default'` → `overlayZone: 'none'`
- Remove deprecated `speakerBbox` from VisualItemData

### 4. Remotion Composition

```tsx
const Composition = () => {
  const frame = useCurrentFrame();
  const video = useVideo();
  const segmentation = video.segmentation;

  // Load mask for current frame
  const maskFrame = Math.floor(frame / (fps / segmentation.maskFps));
  const maskUrl = `${segmentation.maskPath}/${maskFrame.toString().padStart(4, '0')}.webp`;

  // Get interpolated face bbox
  const faceBbox = interpolateFaceBbox(segmentation.faceBboxTimeline, frame);

  return (
    <AbsoluteFill>
      {/* Layer 1: Background zone */}
      {visuals.filter(v => v.overlayZone === 'background').map(v => (
        <VisualRenderer template={v} zone="background" />
      ))}

      {/* Layer 2: Behind zone */}
      {visuals.filter(v => v.overlayZone === 'behind').map(v => (
        <VisualRenderer template={v} zone="behind" faceBbox={faceBbox} />
      ))}

      {/* Layer 3: Segmented speaker */}
      <div style={{
        WebkitMaskImage: `url(${maskUrl})`,
        maskImage: `url(${maskUrl})`,
      }}>
        <Video src={video.src} />
      </div>

      {/* Layer 4: Frame effects */}
      {visuals.filter(v => v.overlayZone === 'frame').map(v => (
        <FrameEffect maskUrl={maskUrl} template={v} />
      ))}

      {/* Layer 5: Top zone */}
      <div style={{ position: 'absolute', top: 0, height: '15%', width: '100%' }}>
        {visuals.filter(v => v.overlayZone === 'top').map(v => (
          <VisualRenderer template={v} zone="top" />
        ))}
      </div>

      {/* Layer 6: Lower-third zone */}
      <div style={{ position: 'absolute', bottom: 0, height: '20%', width: '100%' }}>
        {visuals.filter(v => v.overlayZone === 'lower-third').map(v => (
          <VisualRenderer template={v} zone="lower-third" />
        ))}
      </div>
    </AbsoluteFill>
  );
};
```

### 5. Face Detection & Interpolation

**MediaPipe Integration:**

```typescript
import * as faceDetection from '@mediapipe/face_detection';

async function detectFacesInVideo(frames: string[]): Promise<FaceBbox[]> {
  const detector = new faceDetection.FaceDetection({
    modelSelection: 1,
    minDetectionConfidence: 0.5
  });

  const results: FaceBbox[] = [];

  for (let i = 0; i < frames.length; i++) {
    const image = await loadImage(frames[i]);
    const detections = await detector.process(image);

    if (detections.detections.length > 0) {
      const face = detections.detections[0];
      results.push({
        frame: i,
        x: face.boundingBox.xCenter - face.boundingBox.width / 2,
        y: face.boundingBox.yCenter - face.boundingBox.height / 2,
        width: face.boundingBox.width,
        height: face.boundingBox.height,
        confidence: face.score
      });
    }
  }

  return results;
}
```

**Interpolation for Smooth Tracking:**

```typescript
function interpolateFaceBbox(timeline: FaceBbox[], targetFrame: number): FaceBbox {
  const before = timeline.filter(f => f.frame <= targetFrame).pop();
  const after = timeline.find(f => f.frame > targetFrame);

  if (!before) return after!;
  if (!after) return before;

  const t = (targetFrame - before.frame) / (after.frame - before.frame);
  return {
    frame: targetFrame,
    x: lerp(before.x, after.x, t),
    y: lerp(before.y, after.y, t),
    width: lerp(before.width, after.width, t),
    height: lerp(before.height, after.height, t),
    confidence: lerp(before.confidence, after.confidence, t)
  };
}
```

### 6. Template Zone Awareness

Templates receive zone and face position:

```typescript
interface OverlayTemplateProps {
  zone: OverlayZone;
  faceBbox?: FaceBbox;
  containerWidth: number;
  containerHeight: number;
}

// Example: Face-aware lower-third
const SmartLowerThird: React.FC<OverlayTemplateProps> = ({ faceBbox, containerHeight }) => {
  const faceBottom = faceBbox
    ? (faceBbox.y + faceBbox.height) * containerHeight
    : containerHeight * 0.7;

  const topPosition = Math.max(faceBottom + 20, containerHeight * 0.75);

  return (
    <div style={{ position: 'absolute', top: topPosition, left: '5%', width: '90%' }}>
      <NameBadge name="John Smith" title="CEO" />
    </div>
  );
};
```

### 7. Recommended Animations by Zone

| Zone | Animation Types | Examples |
|------|-----------------|----------|
| **Behind** | Particles, gradients, abstract shapes | Floating shapes, bokeh, color waves |
| **Lower-Third** | Name badges, CTAs, progress bars | Slide-in text, branded badges |
| **Top** | Titles, chapter markers | Fade-in text, animated logos |
| **Frame** | Glow, borders, halos | Pulsing glow, animated border |
| **Background** | Full scene replacement | Office scenes, abstract environments |

### 8. Editor UI

**Zone Selector:**
```
┌─────────────────────────────────────┐
│ Overlay Zone                        │
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐    │
│ │None │ │Behind│ │Lower│ │ Top │    │
│ └─────┘ └─────┘ └─────┘ └─────┘    │
│ ┌─────┐ ┌─────┐                     │
│ │Frame│ │ BG  │                     │
│ └─────┘ └─────┘                     │
└─────────────────────────────────────┘
```

**Segmentation Status:**
```
┌─────────────────────────────────────┐
│ 📹 my-video.mp4                     │
│ ⏳ Preparing speaker extraction...  │
│ ████████░░ 80%                      │
└─────────────────────────────────────┘
```

### 9. Export Pipeline

**Option A: FFmpeg Compositing**

```bash
ffmpeg -i background.mp4 -i behind.mp4 -i speaker.mp4 -i mask.mp4 \
  -i frame.mp4 -i top.mp4 -i lower-third.mp4 \
  -filter_complex "[2:v][3:v]alphamerge[speaker];
    [0:v][1:v]overlay[l1];
    [l1][speaker]overlay[l2];
    [l2][4:v]overlay[l3];
    [l3][5:v]overlay[l4];
    [l4][6:v]overlay[final]" \
  -map "[final]" output.mp4
```

**Option B: Single Remotion Render**

```typescript
const output = await renderMedia({
  composition: 'ZonedComposition',
  inputProps: { video, visuals, segmentation },
  codec: 'h264'
});
```

---

## Success Criteria

1. Videos process segmentation within 2x video duration
2. Face bbox accuracy > 90% for single-speaker videos
3. Zone preview renders at 30fps in browser
4. Export produces correct layer ordering
5. Templates can access face position and adapt layout

## Dependencies

- SAM2 (Meta's Segment Anything Model 2)
- MediaPipe Face Detection
- FFmpeg with alpha support
- Worker GPU support (for SAM2)

## Out of Scope (Future)

- Multi-person segmentation
- Face-tracking overlays (dynamic following)
- Audio-reactive zone effects
- Real-time segmentation (webcam)
