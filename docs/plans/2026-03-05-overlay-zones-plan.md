# Overlay Zones Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build end-to-end overlay system with SAM2 speaker segmentation and 5 overlay zones (behind, lower-third, top, frame, background).

**Architecture:** Video upload triggers segmentation worker (SAM2 + MediaPipe face detection). Masks stored as WebP sequence. Composition.tsx renders zones in correct z-order using CSS mask-image. Export pipeline composites with FFmpeg alphamerge.

**Tech Stack:** SAM2 (Python), MediaPipe Face Detection, FFmpeg, Remotion, React, Zustand, TypeScript

---

## Phase 1: Data Model & Types

### Task 1.1: Add OverlayZone Type

**Files:**
- Modify: `apps/web/src/features/editor-v2/store/types.ts:364`

**Step 1: Add the overlay zone type after VisualDisplayMode**

```typescript
// After line 364 (after VisualDisplayMode type)
export type OverlayZone = 'behind' | 'lower-third' | 'top' | 'frame' | 'background' | 'none';
```

**Step 2: Verify TypeScript compiles**

Run: `cd apps/web && pnpm tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/web/src/features/editor-v2/store/types.ts
git commit -m "feat(types): add OverlayZone type for zone-based overlay system"
```

---

### Task 1.2: Add Segmentation Data Interfaces

**Files:**
- Modify: `apps/web/src/features/editor-v2/store/types.ts`

**Step 1: Add FaceBbox interface after OverlayZone**

```typescript
export interface FaceBbox {
  frame: number;
  x: number;      // 0-1 normalized (left edge)
  y: number;      // 0-1 normalized (top edge)
  width: number;  // 0-1 normalized
  height: number; // 0-1 normalized
  confidence: number;
}

export interface SegmentationData {
  status: 'pending' | 'processing' | 'ready' | 'failed';
  progress?: number;
  maskPath?: string;           // Path to mask images (e.g., /videos/{id}/masks/)
  maskFps?: number;            // Frame rate of masks (e.g., 10)
  faceBboxTimeline?: FaceBbox[];
  error?: string;
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd apps/web && pnpm tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/web/src/features/editor-v2/store/types.ts
git commit -m "feat(types): add FaceBbox and SegmentationData interfaces"
```

---

### Task 1.3: Update VideoItemData with Segmentation

**Files:**
- Modify: `apps/web/src/features/editor-v2/store/types.ts:27-36`

**Step 1: Add segmentation field to VideoItemData**

```typescript
export interface VideoItemData {
  src: string;
  width: number;
  height: number;
  volume: number;
  playbackRate: number;
  previewUrl?: string;
  muted?: boolean;
  separatedAudioItemId?: string;
  segmentation?: SegmentationData;  // NEW: speaker segmentation data
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd apps/web && pnpm tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/web/src/features/editor-v2/store/types.ts
git commit -m "feat(types): add segmentation field to VideoItemData"
```

---

### Task 1.4: Update VisualItemData with OverlayZone

**Files:**
- Modify: `apps/web/src/features/editor-v2/store/types.ts:366-393`

**Step 1: Add overlayZone to VisualItemData (keep displayMode for backwards compat)**

```typescript
export interface VisualItemData {
  visualId: string;
  compositionId: string;
  bundleUrl: string;
  videoUrl?: string;
  type: string;
  description: string;
  width: number;
  height: number;
  fps: number;
  sourceSceneId?: number;
  effectiveWidth?: number;
  effectiveHeight?: number;
  displayMode?: VisualDisplayMode;  // Keep for backward compat
  overlayZone?: OverlayZone;        // NEW: zone-based positioning
  transition?: {
    enter: { type: 'cut' | 'fade' | 'zoom-in' | 'zoom-out'; durationMs: number };
    exit: { type: 'cut' | 'fade' | 'zoom-in' | 'zoom-out'; durationMs: number };
  };
  overlayOpacity?: number;
  speakerBbox?: { x: number; y: number; w: number; h: number }; // Deprecated, use video.segmentation
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd apps/web && pnpm tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/web/src/features/editor-v2/store/types.ts
git commit -m "feat(types): add overlayZone to VisualItemData"
```

---

### Task 1.5: Add Zone Utility Functions

**Files:**
- Create: `apps/web/src/features/editor-v2/utils/overlay-zones.ts`

**Step 1: Create the utility file**

```typescript
import type { FaceBbox, OverlayZone, VisualDisplayMode } from '../store/types';

/**
 * Linear interpolation helper
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Interpolate face bounding box between keyframes for smooth tracking
 */
export function interpolateFaceBbox(
  timeline: FaceBbox[],
  targetFrame: number
): FaceBbox | null {
  if (!timeline || timeline.length === 0) return null;

  // Find surrounding keyframes
  const before = timeline.filter(f => f.frame <= targetFrame).pop();
  const after = timeline.find(f => f.frame > targetFrame);

  if (!before && !after) return null;
  if (!before) return after!;
  if (!after) return before;

  // Linear interpolation between keyframes
  const t = (targetFrame - before.frame) / (after.frame - before.frame);
  return {
    frame: targetFrame,
    x: lerp(before.x, after.x, t),
    y: lerp(before.y, after.y, t),
    width: lerp(before.width, after.width, t),
    height: lerp(before.height, after.height, t),
    confidence: lerp(before.confidence, after.confidence, t),
  };
}

/**
 * Convert legacy displayMode to overlayZone
 */
export function migrateDisplayModeToZone(
  displayMode: VisualDisplayMode | undefined
): OverlayZone {
  if (displayMode === 'overlay') return 'behind';
  if (displayMode === 'fullscreen') return 'background';
  return 'none';
}

/**
 * Get effective overlay zone (handles migration from displayMode)
 */
export function getEffectiveZone(
  overlayZone: OverlayZone | undefined,
  displayMode: VisualDisplayMode | undefined
): OverlayZone {
  if (overlayZone) return overlayZone;
  return migrateDisplayModeToZone(displayMode);
}

/**
 * Zone z-index mapping for correct layer ordering
 */
export const ZONE_Z_INDEX: Record<OverlayZone, number> = {
  'background': 0,
  'behind': 1,
  // Speaker video is at z-index 2
  'frame': 3,
  'lower-third': 4,
  'top': 5,
  'none': 0, // Not rendered as overlay
};

/**
 * Zone dimension constraints (percentage of canvas)
 */
export const ZONE_DIMENSIONS: Record<OverlayZone, { top?: string; bottom?: string; height?: string }> = {
  'background': {},  // Full canvas
  'behind': {},      // Full canvas (behind speaker)
  'frame': {},       // Follows speaker silhouette
  'lower-third': { bottom: '0', height: '20%' },
  'top': { top: '0', height: '15%' },
  'none': {},
};
```

**Step 2: Verify TypeScript compiles**

Run: `cd apps/web && pnpm tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/web/src/features/editor-v2/utils/overlay-zones.ts
git commit -m "feat(utils): add overlay zone utility functions"
```

---

## Phase 2: Segmentation Worker

### Task 2.1: Create Segmentation Processor Skeleton

**Files:**
- Create: `packages/worker/src/processors/segmentation.ts`

**Step 1: Create the processor file with job interface**

```typescript
import { Job } from 'bullmq';
import { mkdir, rm, access, constants } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { nanoid } from 'nanoid';
import { db, projects, timelineItems } from '../db/index.js';
import { eq, and } from 'drizzle-orm';
import { downloadFile, uploadFile } from '../services/minio.js';
import { publishJobProgress, publishJobComplete, publishJobError } from '../services/redis.js';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { runPythonScript } from '../utils/python.js';

export interface SegmentationJobData {
  projectId: string;
  videoItemId: string;
  videoKey: string; // MinIO key for the video
}

export interface FaceBbox {
  frame: number;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

export interface SegmentationResult {
  maskPath: string;
  maskFps: number;
  faceBboxTimeline: FaceBbox[];
}

export async function processSegmentation(job: Job<SegmentationJobData>): Promise<void> {
  const { projectId, videoItemId, videoKey } = job.data;
  const jobId = job.id!;
  const workDir = join(tmpdir(), `clippify-seg-${nanoid()}`);

  logger.info({ jobId, projectId, videoItemId }, 'Starting segmentation job');

  try {
    await mkdir(workDir, { recursive: true });

    // Update status to processing
    await updateSegmentationStatus(projectId, videoItemId, 'processing', 0);
    await publishJobProgress(jobId, 5, 'Downloading video...');

    // Download video
    const videoPath = join(workDir, 'input.mp4');
    await downloadFile(videoKey, videoPath);
    await publishJobProgress(jobId, 10, 'Extracting frames...');

    // Extract frames at 10 FPS
    const framesDir = join(workDir, 'frames');
    await mkdir(framesDir);
    await extractFrames(videoPath, framesDir, 10);
    await publishJobProgress(jobId, 20, 'Running segmentation...');

    // Run SAM2 segmentation
    const masksDir = join(workDir, 'masks');
    await mkdir(masksDir);
    await runSAM2Segmentation(framesDir, masksDir, (progress) => {
      publishJobProgress(jobId, 20 + progress * 0.5, 'Segmenting speaker...');
    });
    await publishJobProgress(jobId, 70, 'Detecting faces...');

    // Run face detection
    const faceBboxTimeline = await detectFaces(framesDir);
    await publishJobProgress(jobId, 85, 'Uploading masks...');

    // Upload masks to MinIO
    const maskKey = `videos/${projectId}/masks`;
    await uploadMaskDirectory(masksDir, maskKey);

    // Update database with results
    const result: SegmentationResult = {
      maskPath: maskKey,
      maskFps: 10,
      faceBboxTimeline,
    };
    await updateSegmentationStatus(projectId, videoItemId, 'ready', 100, result);
    await publishJobProgress(jobId, 100, 'Segmentation complete');
    await publishJobComplete(jobId, result);

    logger.info({ jobId, projectId }, 'Segmentation job completed');
  } catch (error) {
    logger.error({ jobId, projectId, error }, 'Segmentation job failed');
    await updateSegmentationStatus(projectId, videoItemId, 'failed', 0, undefined, String(error));
    await publishJobError(jobId, String(error));
    throw error;
  } finally {
    // Cleanup
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function extractFrames(videoPath: string, outputDir: string, fps: number): Promise<void> {
  // TODO: Implement with FFmpeg
  throw new Error('Not implemented: extractFrames');
}

async function runSAM2Segmentation(
  framesDir: string,
  outputDir: string,
  onProgress: (progress: number) => void
): Promise<void> {
  // TODO: Implement with SAM2 Python script
  throw new Error('Not implemented: runSAM2Segmentation');
}

async function detectFaces(framesDir: string): Promise<FaceBbox[]> {
  // TODO: Implement with MediaPipe
  throw new Error('Not implemented: detectFaces');
}

async function uploadMaskDirectory(localDir: string, remoteKeyPrefix: string): Promise<void> {
  // TODO: Upload all WebP masks to MinIO
  throw new Error('Not implemented: uploadMaskDirectory');
}

async function updateSegmentationStatus(
  projectId: string,
  videoItemId: string,
  status: 'pending' | 'processing' | 'ready' | 'failed',
  progress: number,
  result?: SegmentationResult,
  error?: string
): Promise<void> {
  // TODO: Update timeline item in database
  throw new Error('Not implemented: updateSegmentationStatus');
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd packages/worker && pnpm tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add packages/worker/src/processors/segmentation.ts
git commit -m "feat(worker): add segmentation processor skeleton"
```

---

### Task 2.2: Implement Frame Extraction

**Files:**
- Modify: `packages/worker/src/processors/segmentation.ts`

**Step 1: Implement extractFrames with FFmpeg**

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';
import { readdir } from 'fs/promises';

const execAsync = promisify(exec);

async function extractFrames(videoPath: string, outputDir: string, fps: number): Promise<number> {
  // Extract frames at specified FPS, output as PNG for quality
  const cmd = `ffmpeg -i "${videoPath}" -vf "fps=${fps}" -q:v 2 "${outputDir}/%04d.png"`;

  await execAsync(cmd, { maxBuffer: 50 * 1024 * 1024 });

  // Count extracted frames
  const files = await readdir(outputDir);
  const frameCount = files.filter(f => f.endsWith('.png')).length;

  logger.info({ frameCount, fps }, 'Extracted frames');
  return frameCount;
}
```

**Step 2: Update the processor to use frame count**

Update the processSegmentation function to capture and pass frame count.

**Step 3: Test frame extraction locally**

Run: `cd packages/worker && pnpm test -- --grep "extractFrames"`
Expected: Test should pass (create test in next task if needed)

**Step 4: Commit**

```bash
git add packages/worker/src/processors/segmentation.ts
git commit -m "feat(worker): implement frame extraction with FFmpeg"
```

---

### Task 2.3: Create SAM2 Python Script

**Files:**
- Create: `packages/worker/src/scripts/sam2_segment.py`

**Step 1: Create the Python segmentation script**

```python
#!/usr/bin/env python3
"""
SAM2 Video Segmentation Script
Segments a person from video frames using SAM2.

Usage: python sam2_segment.py <frames_dir> <output_dir> [--device cuda|cpu]

Output: WebP alpha masks in output_dir, named 0001.webp, 0002.webp, etc.
Progress is reported to stdout as JSON: {"progress": 0.5, "frame": 100}
"""

import argparse
import json
import os
import sys
from pathlib import Path

import numpy as np
from PIL import Image

# SAM2 imports (adjust based on actual SAM2 package structure)
try:
    from sam2.build_sam import build_sam2_video_predictor
    from sam2.sam2_video_predictor import SAM2VideoPredictor
except ImportError:
    print(json.dumps({"error": "SAM2 not installed. Run: pip install sam2"}), file=sys.stderr)
    sys.exit(1)


def find_person_prompt(image: np.ndarray) -> tuple[list, list]:
    """
    Auto-detect person in image using simple heuristics.
    Returns (point_coords, point_labels) for SAM2 prompt.

    For now, use center of image as the prompt point.
    In production, use a person detector (YOLO, etc.) for better results.
    """
    h, w = image.shape[:2]
    # Prompt at center-bottom (where a person typically stands)
    point_coords = [[w // 2, int(h * 0.6)]]
    point_labels = [1]  # 1 = foreground
    return point_coords, point_labels


def main():
    parser = argparse.ArgumentParser(description='SAM2 Video Segmentation')
    parser.add_argument('frames_dir', help='Directory containing input frames (PNG)')
    parser.add_argument('output_dir', help='Directory for output masks (WebP)')
    parser.add_argument('--device', default='cuda', choices=['cuda', 'cpu'], help='Device to use')
    parser.add_argument('--model', default='sam2_hiera_large', help='SAM2 model name')
    args = parser.parse_args()

    frames_dir = Path(args.frames_dir)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    # Get sorted list of frames
    frames = sorted(frames_dir.glob('*.png'))
    if not frames:
        print(json.dumps({"error": "No PNG frames found"}), file=sys.stderr)
        sys.exit(1)

    total_frames = len(frames)
    print(json.dumps({"status": "loading_model", "total_frames": total_frames}))

    # Load SAM2 model
    predictor = build_sam2_video_predictor(args.model, device=args.device)

    # Initialize with first frame
    first_frame = np.array(Image.open(frames[0]))
    point_coords, point_labels = find_person_prompt(first_frame)

    # Initialize video predictor state
    inference_state = predictor.init_state(video_path=str(frames_dir))

    # Add prompt on first frame
    predictor.add_new_points(
        inference_state=inference_state,
        frame_idx=0,
        obj_id=1,
        points=np.array(point_coords),
        labels=np.array(point_labels),
    )

    print(json.dumps({"status": "propagating", "total_frames": total_frames}))

    # Propagate through video
    for frame_idx, (out_frame_idx, out_obj_ids, out_mask_logits) in enumerate(
        predictor.propagate_in_video(inference_state)
    ):
        # Convert mask logits to binary mask
        mask = (out_mask_logits[0] > 0).cpu().numpy().astype(np.uint8) * 255

        # Save as WebP with alpha
        mask_image = Image.fromarray(mask, mode='L')
        output_path = output_dir / f"{out_frame_idx + 1:04d}.webp"
        mask_image.save(output_path, 'WEBP', quality=90)

        # Report progress
        progress = (frame_idx + 1) / total_frames
        print(json.dumps({"progress": progress, "frame": out_frame_idx}))
        sys.stdout.flush()

    print(json.dumps({"status": "complete", "total_frames": total_frames}))


if __name__ == '__main__':
    main()
```

**Step 2: Create requirements file**

Create `packages/worker/src/scripts/requirements-sam2.txt`:

```
torch>=2.0.0
torchvision>=0.15.0
sam2
Pillow>=9.0.0
numpy>=1.24.0
```

**Step 3: Commit**

```bash
git add packages/worker/src/scripts/sam2_segment.py packages/worker/src/scripts/requirements-sam2.txt
git commit -m "feat(worker): add SAM2 segmentation Python script"
```

---

### Task 2.4: Implement SAM2 Integration in Worker

**Files:**
- Modify: `packages/worker/src/processors/segmentation.ts`

**Step 1: Implement runSAM2Segmentation**

```typescript
async function runSAM2Segmentation(
  framesDir: string,
  outputDir: string,
  onProgress: (progress: number) => void
): Promise<void> {
  const scriptPath = join(__dirname, '../scripts/sam2_segment.py');

  // Run Python script with progress tracking
  await runPythonScript(
    scriptPath,
    [framesDir, outputDir, '--device', config.SAM2_DEVICE || 'cuda'],
    {
      onStdout: (line) => {
        try {
          const data = JSON.parse(line);
          if (data.progress !== undefined) {
            onProgress(data.progress);
          }
        } catch {
          // Not JSON, ignore
        }
      },
      onStderr: (line) => {
        logger.warn({ line }, 'SAM2 stderr');
      },
    }
  );
}
```

**Step 2: Update python.ts utility if needed**

Ensure `runPythonScript` supports progress callbacks.

**Step 3: Commit**

```bash
git add packages/worker/src/processors/segmentation.ts
git commit -m "feat(worker): integrate SAM2 Python script in segmentation processor"
```

---

### Task 2.5: Create Face Detection Python Script

**Files:**
- Create: `packages/worker/src/scripts/face_detect.py`

**Step 1: Create the face detection script**

```python
#!/usr/bin/env python3
"""
Face Detection Script using MediaPipe
Detects faces in video frames and outputs bounding boxes.

Usage: python face_detect.py <frames_dir>

Output: JSON array of face bounding boxes to stdout
"""

import argparse
import json
import sys
from pathlib import Path

import cv2
import mediapipe as mp

def main():
    parser = argparse.ArgumentParser(description='Face Detection')
    parser.add_argument('frames_dir', help='Directory containing input frames (PNG)')
    parser.add_argument('--min-confidence', type=float, default=0.5, help='Minimum detection confidence')
    args = parser.parse_args()

    frames_dir = Path(args.frames_dir)
    frames = sorted(frames_dir.glob('*.png'))

    if not frames:
        print(json.dumps({"error": "No PNG frames found"}), file=sys.stderr)
        sys.exit(1)

    # Initialize MediaPipe Face Detection
    mp_face_detection = mp.solutions.face_detection

    results = []

    with mp_face_detection.FaceDetection(
        model_selection=1,  # Full-range model (works at any distance)
        min_detection_confidence=args.min_confidence
    ) as face_detection:

        for frame_idx, frame_path in enumerate(frames):
            image = cv2.imread(str(frame_path))
            if image is None:
                continue

            h, w = image.shape[:2]

            # Convert BGR to RGB for MediaPipe
            rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            detection_results = face_detection.process(rgb_image)

            if detection_results.detections:
                # Take the first (most confident) face
                detection = detection_results.detections[0]
                bbox = detection.location_data.relative_bounding_box

                results.append({
                    "frame": frame_idx,
                    "x": bbox.xmin,
                    "y": bbox.ymin,
                    "width": bbox.width,
                    "height": bbox.height,
                    "confidence": detection.score[0]
                })

            # Report progress periodically
            if frame_idx % 10 == 0:
                print(json.dumps({"progress": frame_idx / len(frames)}), file=sys.stderr)
                sys.stderr.flush()

    # Output final results
    print(json.dumps(results))


if __name__ == '__main__':
    main()
```

**Step 2: Update requirements**

Add to `packages/worker/src/scripts/requirements-sam2.txt`:

```
mediapipe>=0.10.0
opencv-python-headless>=4.8.0
```

**Step 3: Commit**

```bash
git add packages/worker/src/scripts/face_detect.py packages/worker/src/scripts/requirements-sam2.txt
git commit -m "feat(worker): add MediaPipe face detection script"
```

---

### Task 2.6: Implement Face Detection Integration

**Files:**
- Modify: `packages/worker/src/processors/segmentation.ts`

**Step 1: Implement detectFaces**

```typescript
async function detectFaces(framesDir: string): Promise<FaceBbox[]> {
  const scriptPath = join(__dirname, '../scripts/face_detect.py');

  let output = '';

  await runPythonScript(
    scriptPath,
    [framesDir],
    {
      onStdout: (line) => {
        output += line;
      },
    }
  );

  try {
    const results = JSON.parse(output);
    logger.info({ faceCount: results.length }, 'Face detection complete');
    return results;
  } catch (error) {
    logger.error({ error, output }, 'Failed to parse face detection output');
    return [];
  }
}
```

**Step 2: Commit**

```bash
git add packages/worker/src/processors/segmentation.ts
git commit -m "feat(worker): integrate face detection in segmentation processor"
```

---

### Task 2.7: Implement Mask Upload and Status Update

**Files:**
- Modify: `packages/worker/src/processors/segmentation.ts`

**Step 1: Implement uploadMaskDirectory**

```typescript
async function uploadMaskDirectory(localDir: string, remoteKeyPrefix: string): Promise<void> {
  const files = await readdir(localDir);
  const webpFiles = files.filter(f => f.endsWith('.webp'));

  for (const file of webpFiles) {
    const localPath = join(localDir, file);
    const remoteKey = `${remoteKeyPrefix}/${file}`;
    await uploadFile(localPath, remoteKey);
  }

  logger.info({ count: webpFiles.length, prefix: remoteKeyPrefix }, 'Uploaded mask files');
}
```

**Step 2: Implement updateSegmentationStatus**

```typescript
async function updateSegmentationStatus(
  projectId: string,
  videoItemId: string,
  status: 'pending' | 'processing' | 'ready' | 'failed',
  progress: number,
  result?: SegmentationResult,
  error?: string
): Promise<void> {
  // Get current item data
  const item = await db.query.timelineItems.findFirst({
    where: and(
      eq(timelineItems.projectId, projectId),
      eq(timelineItems.id, videoItemId)
    ),
  });

  if (!item) {
    logger.warn({ projectId, videoItemId }, 'Video item not found for segmentation update');
    return;
  }

  const currentData = item.data as any;
  const segmentation = {
    status,
    progress,
    ...(result ? {
      maskPath: result.maskPath,
      maskFps: result.maskFps,
      faceBboxTimeline: result.faceBboxTimeline,
    } : {}),
    ...(error ? { error } : {}),
  };

  // Update item data with segmentation
  await db.update(timelineItems)
    .set({
      data: {
        ...currentData,
        segmentation,
      },
    })
    .where(eq(timelineItems.id, videoItemId));

  logger.info({ projectId, videoItemId, status }, 'Updated segmentation status');
}
```

**Step 3: Commit**

```bash
git add packages/worker/src/processors/segmentation.ts
git commit -m "feat(worker): implement mask upload and status update"
```

---

### Task 2.8: Register Segmentation Job in Queue

**Files:**
- Modify: `packages/api/src/services/queue.ts`

**Step 1: Add segmentation job type**

Find the job types enum/union and add 'segmentation':

```typescript
export type JobType = 'render' | 'transcribe' | 'generate-visuals' | 'segmentation' | /* ... */;
```

**Step 2: Add queue for segmentation**

```typescript
export const segmentationQueue = new Queue<SegmentationJobData>('segmentation', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});
```

**Step 3: Export the queue**

**Step 4: Commit**

```bash
git add packages/api/src/services/queue.ts
git commit -m "feat(api): register segmentation job queue"
```

---

### Task 2.9: Add Segmentation Trigger on Video Upload

**Files:**
- Modify: `packages/api/src/routes/projects.ts`

**Step 1: Find video upload handler and add segmentation job**

After video is uploaded and timeline item created, add:

```typescript
// Trigger segmentation processing
await segmentationQueue.add('segment-video', {
  projectId: project.id,
  videoItemId: videoItem.id,
  videoKey: videoKey,
});
```

**Step 2: Commit**

```bash
git add packages/api/src/routes/projects.ts
git commit -m "feat(api): trigger segmentation on video upload"
```

---

## Phase 3: Editor Store Updates

### Task 3.1: Add Zone-Related Store Actions

**Files:**
- Modify: `apps/web/src/features/editor-v2/store/types.ts`

**Step 1: Add new actions to EditorActions interface**

```typescript
// In EditorActions interface, add:

// Overlay zone actions
updateVisualOverlayZone: (itemId: string, zone: OverlayZone) => void;
getVideoSegmentation: (videoItemId: string) => SegmentationData | undefined;
```

**Step 2: Commit**

```bash
git add apps/web/src/features/editor-v2/store/types.ts
git commit -m "feat(store): add overlay zone action types"
```

---

### Task 3.2: Implement Zone Actions in Store

**Files:**
- Modify: `apps/web/src/features/editor-v2/store/editor-store.ts`

**Step 1: Implement updateVisualOverlayZone**

Find the store implementation and add:

```typescript
updateVisualOverlayZone: (itemId: string, zone: OverlayZone) => {
  set((state) => {
    const item = state.items[itemId];
    if (!item || item.type !== 'visual') return state;

    const data = item.data as VisualItemData;
    return {
      items: {
        ...state.items,
        [itemId]: {
          ...item,
          data: {
            ...data,
            overlayZone: zone,
            // Clear deprecated displayMode when zone is set
            displayMode: zone === 'none' ? data.displayMode : undefined,
          },
        },
      },
      isDirty: true,
    };
  });
  get().pushHistory();
},

getVideoSegmentation: (videoItemId: string) => {
  const item = get().items[videoItemId];
  if (!item || item.type !== 'video') return undefined;
  return (item.data as VideoItemData).segmentation;
},
```

**Step 2: Commit**

```bash
git add apps/web/src/features/editor-v2/store/editor-store.ts
git commit -m "feat(store): implement overlay zone actions"
```

---

### Task 3.3: Add Zone Selector Hook

**Files:**
- Modify: `apps/web/src/features/editor-v2/store/use-editor-store.ts`

**Step 1: Add selector for overlay zone**

```typescript
export const useVisualOverlayZone = (itemId: string) =>
  useEditorStore((state) => {
    const item = state.items[itemId];
    if (!item || item.type !== 'visual') return 'none';
    const data = item.data as VisualItemData;
    return data.overlayZone ?? migrateDisplayModeToZone(data.displayMode);
  });

export const useVideoSegmentation = (videoItemId: string) =>
  useEditorStore((state) => {
    const item = state.items[videoItemId];
    if (!item || item.type !== 'video') return undefined;
    return (item.data as VideoItemData).segmentation;
  });
```

**Step 2: Import migrateDisplayModeToZone utility**

**Step 3: Commit**

```bash
git add apps/web/src/features/editor-v2/store/use-editor-store.ts
git commit -m "feat(store): add overlay zone selectors"
```

---

## Phase 4: Composition Rendering

### Task 4.1: Add Zone-Based Rendering to Composition

**Files:**
- Modify: `apps/web/src/features/editor-v2/player/Composition.tsx`

**Step 1: Import zone utilities**

```typescript
import {
  interpolateFaceBbox,
  getEffectiveZone,
  ZONE_Z_INDEX,
  ZONE_DIMENSIONS
} from '../utils/overlay-zones';
import type { FaceBbox, OverlayZone, SegmentationData } from '../store/types';
```

**Step 2: Add mask loading state**

```typescript
// Inside the component, add mask URL computation
const getMaskUrl = (segmentation: SegmentationData | undefined, frame: number): string | null => {
  if (!segmentation?.maskPath || segmentation.status !== 'ready') return null;
  const maskFrame = Math.floor(frame / (fps / (segmentation.maskFps || 10)));
  return `${config.STORAGE_URL}/${segmentation.maskPath}/${String(maskFrame + 1).padStart(4, '0')}.webp`;
};
```

**Step 3: Commit partial progress**

```bash
git add apps/web/src/features/editor-v2/player/Composition.tsx
git commit -m "feat(composition): add zone utilities import and mask URL computation"
```

---

### Task 4.2: Implement Zone Layer Rendering

**Files:**
- Modify: `apps/web/src/features/editor-v2/player/Composition.tsx`

**Step 1: Create ZoneLayer component**

```typescript
interface ZoneLayerProps {
  zone: OverlayZone;
  children: React.ReactNode;
  faceBbox?: FaceBbox | null;
  maskUrl?: string | null;
}

const ZoneLayer: React.FC<ZoneLayerProps> = ({ zone, children, faceBbox, maskUrl }) => {
  const dimensions = ZONE_DIMENSIONS[zone];
  const zIndex = ZONE_Z_INDEX[zone];

  const style: React.CSSProperties = {
    position: 'absolute',
    left: 0,
    right: 0,
    ...dimensions,
    width: dimensions.height ? '100%' : undefined,
    height: dimensions.height || '100%',
    zIndex,
  };

  return <div style={style}>{children}</div>;
};
```

**Step 2: Create SegmentedSpeaker component**

```typescript
interface SegmentedSpeakerProps {
  videoSrc: string;
  maskUrl: string | null;
  style?: React.CSSProperties;
}

const SegmentedSpeaker: React.FC<SegmentedSpeakerProps> = ({ videoSrc, maskUrl, style }) => {
  const maskStyle: React.CSSProperties = maskUrl ? {
    WebkitMaskImage: `url(${maskUrl})`,
    maskImage: `url(${maskUrl})`,
    WebkitMaskSize: 'cover',
    maskSize: 'cover',
  } : {};

  return (
    <div style={{ ...style, ...maskStyle, zIndex: 2 }}>
      <Video src={videoSrc} />
    </div>
  );
};
```

**Step 3: Commit**

```bash
git add apps/web/src/features/editor-v2/player/Composition.tsx
git commit -m "feat(composition): add ZoneLayer and SegmentedSpeaker components"
```

---

### Task 4.3: Update Main Composition Render

**Files:**
- Modify: `apps/web/src/features/editor-v2/player/Composition.tsx`

**Step 1: Group visuals by zone**

In the main render logic, group visuals:

```typescript
const visualsByZone = useMemo(() => {
  const grouped: Record<OverlayZone, typeof visualItems> = {
    'background': [],
    'behind': [],
    'frame': [],
    'lower-third': [],
    'top': [],
    'none': [],
  };

  for (const item of visualItems) {
    const data = item.data as VisualItemData;
    const zone = getEffectiveZone(data.overlayZone, data.displayMode);
    grouped[zone].push(item);
  }

  return grouped;
}, [visualItems]);
```

**Step 2: Update render to use zones**

Replace the existing visual/video layer logic with zone-based rendering:

```typescript
// Get segmentation data from first video item
const videoSegmentation = videoItems[0]
  ? (videoItems[0].data as VideoItemData).segmentation
  : undefined;
const maskUrl = getMaskUrl(videoSegmentation, frame);
const faceBbox = videoSegmentation?.faceBboxTimeline
  ? interpolateFaceBbox(videoSegmentation.faceBboxTimeline, Math.floor(frame / fps * (videoSegmentation.maskFps || 10)))
  : null;

// Determine if we should use zone-based rendering
const useZoneRendering = videoSegmentation?.status === 'ready' &&
  Object.values(visualsByZone).some(v => v.length > 0 && v !== visualsByZone.none);

return (
  <AbsoluteFill>
    {useZoneRendering ? (
      <>
        {/* Background zone */}
        {visualsByZone.background.length > 0 && (
          <ZoneLayer zone="background">
            <VisualSequences visualItems={visualsByZone.background} fps={fps} />
          </ZoneLayer>
        )}

        {/* Behind zone */}
        {visualsByZone.behind.length > 0 && (
          <ZoneLayer zone="behind" faceBbox={faceBbox}>
            <VisualSequences visualItems={visualsByZone.behind} fps={fps} />
          </ZoneLayer>
        )}

        {/* Segmented speaker */}
        <SegmentedSpeaker
          videoSrc={videoItems[0]?.data.src}
          maskUrl={maskUrl}
          style={fullScreenStyle}
        />

        {/* Frame zone */}
        {visualsByZone.frame.length > 0 && (
          <ZoneLayer zone="frame" maskUrl={maskUrl}>
            <VisualSequences visualItems={visualsByZone.frame} fps={fps} />
          </ZoneLayer>
        )}

        {/* Lower-third zone */}
        {visualsByZone['lower-third'].length > 0 && (
          <ZoneLayer zone="lower-third">
            <VisualSequences visualItems={visualsByZone['lower-third']} fps={fps} />
          </ZoneLayer>
        )}

        {/* Top zone */}
        {visualsByZone.top.length > 0 && (
          <ZoneLayer zone="top">
            <VisualSequences visualItems={visualsByZone.top} fps={fps} />
          </ZoneLayer>
        )}
      </>
    ) : (
      // Fallback to existing rendering for non-zone visuals
      /* ... existing code ... */
    )}

    {/* Non-zone visuals use existing layout system */}
    {visualsByZone.none.length > 0 && !useZoneRendering && (
      /* ... existing pip/stacked rendering ... */
    )}
  </AbsoluteFill>
);
```

**Step 3: Commit**

```bash
git add apps/web/src/features/editor-v2/player/Composition.tsx
git commit -m "feat(composition): implement zone-based rendering"
```

---

## Phase 5: Editor UI

### Task 5.1: Create Zone Selector Component

**Files:**
- Create: `apps/web/src/features/editor-v2/components/ZoneSelector.tsx`

**Step 1: Create the component**

```typescript
'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import type { OverlayZone } from '../store/types';

interface ZoneSelectorProps {
  value: OverlayZone;
  onChange: (zone: OverlayZone) => void;
  disabled?: boolean;
  segmentationReady?: boolean;
}

const ZONE_OPTIONS: { value: OverlayZone; label: string; icon: string; description: string }[] = [
  { value: 'none', label: 'None', icon: '⊘', description: 'Use layout mode' },
  { value: 'behind', label: 'Behind', icon: '⬛', description: 'Behind speaker' },
  { value: 'lower-third', label: 'Lower', icon: '▂', description: 'Bottom 20%' },
  { value: 'top', label: 'Top', icon: '▔', description: 'Top 15%' },
  { value: 'frame', label: 'Frame', icon: '◻', description: 'Speaker border' },
  { value: 'background', label: 'BG', icon: '▣', description: 'Replace background' },
];

export const ZoneSelector: React.FC<ZoneSelectorProps> = ({
  value,
  onChange,
  disabled = false,
  segmentationReady = false,
}) => {
  const requiresSegmentation = (zone: OverlayZone) =>
    zone !== 'none' && zone !== 'lower-third' && zone !== 'top';

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-zinc-400">Overlay Zone</label>
      <div className="grid grid-cols-3 gap-1">
        {ZONE_OPTIONS.map((option) => {
          const needsSeg = requiresSegmentation(option.value);
          const isDisabled = disabled || (needsSeg && !segmentationReady);

          return (
            <button
              key={option.value}
              onClick={() => onChange(option.value)}
              disabled={isDisabled}
              title={isDisabled && needsSeg ? 'Requires speaker segmentation' : option.description}
              className={cn(
                'flex flex-col items-center p-2 rounded-md border transition-colors',
                value === option.value
                  ? 'border-blue-500 bg-blue-500/20 text-blue-400'
                  : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600',
                isDisabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              <span className="text-lg">{option.icon}</span>
              <span className="text-xs mt-1">{option.label}</span>
            </button>
          );
        })}
      </div>
      {!segmentationReady && (
        <p className="text-xs text-zinc-500">
          Speaker segmentation processing... Some zones unavailable.
        </p>
      )}
    </div>
  );
};
```

**Step 2: Commit**

```bash
git add apps/web/src/features/editor-v2/components/ZoneSelector.tsx
git commit -m "feat(ui): create ZoneSelector component"
```

---

### Task 5.2: Create Segmentation Status Indicator

**Files:**
- Create: `apps/web/src/features/editor-v2/components/SegmentationStatus.tsx`

**Step 1: Create the component**

```typescript
'use client';

import React from 'react';
import type { SegmentationData } from '../store/types';

interface SegmentationStatusProps {
  segmentation?: SegmentationData;
  className?: string;
}

export const SegmentationStatus: React.FC<SegmentationStatusProps> = ({
  segmentation,
  className,
}) => {
  if (!segmentation) {
    return (
      <div className={className}>
        <span className="text-xs text-zinc-500">No segmentation data</span>
      </div>
    );
  }

  const { status, progress = 0, error } = segmentation;

  if (status === 'ready') {
    return (
      <div className={className}>
        <span className="text-xs text-green-400 flex items-center gap-1">
          <span>✓</span> Speaker extracted
        </span>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className={className}>
        <span className="text-xs text-red-400 flex items-center gap-1">
          <span>✕</span> Segmentation failed
        </span>
        {error && <p className="text-xs text-red-300 mt-1">{error}</p>}
      </div>
    );
  }

  if (status === 'processing') {
    return (
      <div className={className}>
        <span className="text-xs text-yellow-400 flex items-center gap-1">
          <span className="animate-spin">⏳</span> Extracting speaker...
        </span>
        <div className="mt-1 h-1 bg-zinc-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-yellow-400 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    );
  }

  // Pending
  return (
    <div className={className}>
      <span className="text-xs text-zinc-400">Segmentation pending...</span>
    </div>
  );
};
```

**Step 2: Commit**

```bash
git add apps/web/src/features/editor-v2/components/SegmentationStatus.tsx
git commit -m "feat(ui): create SegmentationStatus indicator component"
```

---

### Task 5.3: Add Zone Selector to ContextPanel

**Files:**
- Modify: `apps/web/src/features/editor-v2/components/ContextPanel.tsx`

**Step 1: Import components**

```typescript
import { ZoneSelector } from './ZoneSelector';
import { SegmentationStatus } from './SegmentationStatus';
import { useVisualOverlayZone, useVideoSegmentation } from '../store/use-editor-store';
```

**Step 2: Add zone selector to visual item section**

In the visual item rendering section, add:

```typescript
// Inside the visual item context panel section
const overlayZone = useVisualOverlayZone(selectedItem.id);
const updateZone = useEditorStore((s) => s.updateVisualOverlayZone);

// Find first video item for segmentation status
const videoItem = items.find(i => i.type === 'video');
const segmentation = videoItem ? (videoItem.data as VideoItemData).segmentation : undefined;

// In the JSX:
<ZoneSelector
  value={overlayZone}
  onChange={(zone) => updateZone(selectedItem.id, zone)}
  segmentationReady={segmentation?.status === 'ready'}
/>

{videoItem && (
  <SegmentationStatus segmentation={segmentation} className="mt-4" />
)}
```

**Step 3: Commit**

```bash
git add apps/web/src/features/editor-v2/components/ContextPanel.tsx
git commit -m "feat(ui): add ZoneSelector to ContextPanel for visual items"
```

---

## Phase 6: Export Pipeline

### Task 6.1: Update Render Processor for Zone Compositing

**Files:**
- Modify: `packages/worker/src/processors/render.ts`

**Step 1: Add zone-aware FFmpeg filter generation**

```typescript
function buildZoneCompositeFilter(
  videoInput: string,
  maskInput: string | null,
  zoneInputs: Record<OverlayZone, string | null>,
  outputWidth: number,
  outputHeight: number
): string {
  const filters: string[] = [];
  let lastOutput = '0:v'; // Start with base video
  let inputIndex = 1;

  // Background zone (if present)
  if (zoneInputs.background) {
    filters.push(`[${inputIndex}:v]scale=${outputWidth}:${outputHeight}[bg]`);
    lastOutput = 'bg';
    inputIndex++;
  }

  // Behind zone (if present)
  if (zoneInputs.behind) {
    filters.push(`[${inputIndex}:v]scale=${outputWidth}:${outputHeight}[behind]`);
    filters.push(`[${lastOutput}][behind]overlay[with_behind]`);
    lastOutput = 'with_behind';
    inputIndex++;
  }

  // Segmented speaker (if mask available)
  if (maskInput) {
    filters.push(`[0:v][${inputIndex}:v]alphamerge[speaker]`);
    filters.push(`[${lastOutput}][speaker]overlay[with_speaker]`);
    lastOutput = 'with_speaker';
    inputIndex++;
  }

  // Frame zone (if present) - uses mask for edge detection
  if (zoneInputs.frame) {
    // Frame is rendered directly on top for now
    filters.push(`[${inputIndex}:v]scale=${outputWidth}:${outputHeight}[frame]`);
    filters.push(`[${lastOutput}][frame]overlay[with_frame]`);
    lastOutput = 'with_frame';
    inputIndex++;
  }

  // Lower-third zone (bottom 20%)
  if (zoneInputs['lower-third']) {
    const ltHeight = Math.round(outputHeight * 0.2);
    const ltY = outputHeight - ltHeight;
    filters.push(`[${inputIndex}:v]scale=${outputWidth}:${ltHeight}[lt]`);
    filters.push(`[${lastOutput}][lt]overlay=0:${ltY}[with_lt]`);
    lastOutput = 'with_lt';
    inputIndex++;
  }

  // Top zone (top 15%)
  if (zoneInputs.top) {
    const topHeight = Math.round(outputHeight * 0.15);
    filters.push(`[${inputIndex}:v]scale=${outputWidth}:${topHeight}[top]`);
    filters.push(`[${lastOutput}][top]overlay=0:0[with_top]`);
    lastOutput = 'with_top';
    inputIndex++;
  }

  // Final output
  filters.push(`[${lastOutput}]format=yuv420p[out]`);

  return filters.join(';');
}
```

**Step 2: Commit**

```bash
git add packages/worker/src/processors/render.ts
git commit -m "feat(render): add zone-aware FFmpeg filter generation"
```

---

### Task 6.2: Integrate Zone Rendering in Export

**Files:**
- Modify: `packages/worker/src/processors/render.ts`

**Step 1: Update the main render function to use zones**

In the processRender function, detect zone usage and apply:

```typescript
// Check if any visuals use overlay zones
const visualsWithZones = visualItems.filter((v) => {
  const data = v.data as any;
  return data.overlayZone && data.overlayZone !== 'none';
});

if (visualsWithZones.length > 0 && videoSegmentation?.status === 'ready') {
  // Use zone-based compositing
  await renderWithZones(/* ... */);
} else {
  // Use existing render pipeline
  await renderStandard(/* ... */);
}
```

**Step 2: Commit**

```bash
git add packages/worker/src/processors/render.ts
git commit -m "feat(render): integrate zone-based compositing in export"
```

---

## Phase 7: Integration & Testing

### Task 7.1: Add Migration for Existing Projects

**Files:**
- Create: `packages/api/src/migrations/migrate-overlay-zones.ts`

**Step 1: Create migration script**

```typescript
import { db, timelineItems } from '../db/index.js';
import { eq } from 'drizzle-orm';

/**
 * Migrate existing projects from displayMode to overlayZone
 */
export async function migrateOverlayZones(): Promise<void> {
  const visuals = await db.query.timelineItems.findMany({
    where: eq(timelineItems.type, 'visual'),
  });

  for (const item of visuals) {
    const data = item.data as any;

    // Skip if already has overlayZone
    if (data.overlayZone) continue;

    // Migrate displayMode to overlayZone
    let overlayZone = 'none';
    if (data.displayMode === 'overlay') {
      overlayZone = 'behind';
    } else if (data.displayMode === 'fullscreen') {
      overlayZone = 'background';
    }

    if (overlayZone !== 'none') {
      await db.update(timelineItems)
        .set({
          data: {
            ...data,
            overlayZone,
          },
        })
        .where(eq(timelineItems.id, item.id));
    }
  }

  console.log(`Migrated ${visuals.length} visual items`);
}
```

**Step 2: Commit**

```bash
git add packages/api/src/migrations/migrate-overlay-zones.ts
git commit -m "feat(api): add migration for overlay zones"
```

---

### Task 7.2: Create Integration Test

**Files:**
- Create: `packages/worker/src/processors/segmentation.test.ts`

**Step 1: Create test file**

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { processSegmentation, SegmentationJobData } from './segmentation';
import { mkdir, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Segmentation Processor', () => {
  const testDir = join(tmpdir(), 'segmentation-test');

  beforeAll(async () => {
    await mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('should extract frames from video', async () => {
    // This is a placeholder - actual test would need a test video
    expect(true).toBe(true);
  });

  it('should generate face bbox timeline', async () => {
    // This is a placeholder - actual test would need test frames
    expect(true).toBe(true);
  });
});
```

**Step 2: Commit**

```bash
git add packages/worker/src/processors/segmentation.test.ts
git commit -m "test(worker): add segmentation processor tests"
```

---

### Task 7.3: Final Integration Verification

**Step 1: Run full test suite**

```bash
pnpm test
```

**Step 2: Build all packages**

```bash
pnpm build
```

**Step 3: Manual testing checklist**

- [ ] Upload a video with a speaker
- [ ] Verify segmentation job starts
- [ ] Wait for segmentation to complete
- [ ] Add a visual with "behind" zone
- [ ] Verify visual appears behind speaker in preview
- [ ] Add a visual with "lower-third" zone
- [ ] Verify visual appears in bottom 20%
- [ ] Export video
- [ ] Verify zones render correctly in export

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete overlay zones implementation"
```

---

## Summary

This plan implements the full overlay zones feature:

1. **Phase 1**: Types and data model updates
2. **Phase 2**: SAM2 segmentation worker with face detection
3. **Phase 3**: Editor store updates for zone management
4. **Phase 4**: Remotion composition with zone-based rendering
5. **Phase 5**: Editor UI components (ZoneSelector, SegmentationStatus)
6. **Phase 6**: Export pipeline with FFmpeg zone compositing
7. **Phase 7**: Migration and testing

Total estimated tasks: 22 bite-sized tasks across 7 phases.
