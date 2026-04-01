# Background Segmentation: Core Pipeline

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the end-to-end matting pipeline from sandbox request → worker GPU processing → matte delivery back to workspace.

**Architecture:** Sandbox agent calls MCP tool → API proxies to worker queue → worker extracts time range via FFmpeg, runs RVM Python script, uploads matte to MinIO → API delivers matte back to sandbox workspace public/matte/ folder.

**Tech Stack:** Python (PyTorch, RVM, FFmpeg), TypeScript (Fastify, BullMQ), MinIO S3

---

## Task 1: Add Python dependencies for RVM

**File:** `packages/worker/requirements.txt`

- [ ] **Step 1.1** — Append RVM dependencies to the existing requirements file.

```python
# Person segmentation (RVM — Robust Video Matting)
torch>=2.0.0
torchvision>=0.15.0
```

- [ ] **Step 1.2** — Verify installation.

```bash
cd packages/worker
pip install -r requirements.txt
python -c "import torch; print(torch.__version__); print('CUDA:', torch.cuda.is_available())"
```

**Expected output:** Torch version printed, CUDA availability shown (True on GPU machines).

---

## Task 2: Write the Python segmentation script

**File:** `packages/worker/scripts/segment_person.py`

This follows the same pattern as `packages/worker/scripts/detect_head.py`: CLI script that accepts a video path, processes it, outputs a matte MP4, and prints progress lines to stdout for the TypeScript processor to parse.

- [ ] **Step 2.1** — Create `packages/worker/scripts/segment_person.py` with the full implementation.

Uses the **tested** model loading approach from `scripts/temp/test_rvm_matting.py`: loads `MattingNetwork` from the local torch hub cache, applies JIT script+freeze for maximum speed. Outputs **RGB (3-channel white-on-black)** matte via FFmpeg subprocess pipe (NVENC with libx264 fallback), matching the spec's encoding requirements and ensuring browser canvas compositing compatibility. After segmentation, extracts per-frame speaker bounding boxes from the matte into `matte-bbox.json`.

```python
#!/usr/bin/env python3
"""
Person Segmentation Script (RVM — Robust Video Matting)

Extracts a person alpha matte from a video clip using RVM.
Outputs an RGB (white-on-black) H.264 MP4 at 0.5x source resolution, 30fps,
encoded via FFmpeg subprocess pipe (NVENC with libx264 fallback).

Also outputs matte-bbox.json with per-frame speaker bounding boxes
(normalized 0-1 coordinates) for agent spatial positioning.

Progress protocol (stdout, parsed by TypeScript processor):
  - "Processing video: {W}x{H} @ {fps}fps, {total} frames"
  - "Processed {n} frames..."
  - "Done! Processed {n} frames"

Usage:
    python segment_person.py /path/to/clip.mp4 --output /path/to/matte.mp4
    python segment_person.py /path/to/clip.mp4 --output /path/to/matte.mp4 --backbone mobilenetv3
"""

import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path

import numpy as np
import torch

# ---------------------------------------------------------------------------
# Configuration (tested on RTX 4050)
# ---------------------------------------------------------------------------
BACKBONE = "resnet50"
SCALE_FACTOR = 0.5
MATTE_FPS = 30
DOWNSAMPLE_RATIO = 0.8
SEQ_CHUNK = 4

# Model download URLs (official RVM GitHub releases)
MODEL_URLS = {
    "resnet50": "https://github.com/PeterL1n/RobustVideoMatting/releases/download/v1.0.0/rvm_resnet50.pth",
    "mobilenetv3": "https://github.com/PeterL1n/RobustVideoMatting/releases/download/v1.0.0/rvm_mobilenetv3.pth",
}


def parse_arguments() -> argparse.Namespace:
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description="Extract person alpha matte from video using RVM."
    )
    parser.add_argument("input", type=str, help="Path to input video file")
    parser.add_argument(
        "--output",
        type=str,
        required=True,
        help="Output matte MP4 path",
    )
    parser.add_argument(
        "--backbone",
        type=str,
        default=BACKBONE,
        choices=["resnet50", "mobilenetv3"],
        help=f"RVM backbone (default: {BACKBONE})",
    )
    parser.add_argument(
        "--scale",
        type=float,
        default=SCALE_FACTOR,
        help=f"Output scale factor relative to source (default: {SCALE_FACTOR})",
    )
    parser.add_argument(
        "--fps",
        type=int,
        default=MATTE_FPS,
        help=f"Output matte FPS (default: {MATTE_FPS})",
    )
    parser.add_argument(
        "--downsample-ratio",
        type=float,
        default=DOWNSAMPLE_RATIO,
        help=f"RVM internal downsample ratio (default: {DOWNSAMPLE_RATIO})",
    )
    return parser.parse_args()


def probe_video(input_path: str) -> dict:
    """Probe video dimensions, fps, and duration using ffprobe."""
    probe = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0",
         "-show_entries", "stream=width,height,r_frame_rate,duration",
         "-show_entries", "format=duration",
         "-of", "csv=p=0", input_path],
        capture_output=True, text=True
    )
    lines = probe.stdout.strip().split("\n")
    parts = lines[0].split(",")
    src_w, src_h = int(parts[0]), int(parts[1])
    fps_num, fps_den = map(int, parts[2].split("/"))
    fps = fps_num / fps_den

    duration_s = 0
    for p in parts[3:]:
        try:
            duration_s = float(p)
            break
        except (ValueError, IndexError):
            pass
    if duration_s == 0 and len(lines) > 1:
        try:
            duration_s = float(lines[1].strip())
        except (ValueError, IndexError):
            pass

    return {"width": src_w, "height": src_h, "fps": fps, "duration_s": duration_s}


def load_rvm_model(backbone: str, device: torch.device, dtype: torch.dtype):
    """Load RVM from local torch hub cache, apply JIT script+freeze.

    This is the tested approach from scripts/temp/test_rvm_matting.py.
    Loads MattingNetwork directly from the cached hub repo, then loads
    weights from the hub checkpoints directory.
    """
    RVM_DIR = os.path.expanduser("~/.cache/torch/hub/PeterL1n_RobustVideoMatting_master")
    sys.path.insert(0, RVM_DIR)
    from model import MattingNetwork

    weights_file = f"rvm_{backbone}.pth"
    weights_path = os.path.expanduser(f"~/.cache/torch/hub/checkpoints/{weights_file}")
    if not os.path.exists(weights_path):
        url = MODEL_URLS[backbone]
        print(f"Downloading {backbone} weights: {url}")
        torch.hub.download_url_to_file(url, weights_path)

    model = MattingNetwork(backbone).eval().to(device, dtype)
    model.load_state_dict(torch.load(weights_path, map_location=device, weights_only=True))
    model = torch.jit.script(model)
    model = torch.jit.freeze(model)
    print(f"Model loaded: {backbone} | {device} | {dtype} | JIT frozen")
    return model


def make_ffmpeg_encoder(output_path: str, w: int, h: int, fps: int):
    """Create FFmpeg encoder subprocess for RGB matte output (NVENC with libx264 fallback)."""
    use_nvenc = w <= 4096 and h <= 4096
    if use_nvenc:
        codec_args = ["-c:v", "h264_nvenc", "-preset", "p1", "-rc", "constqp", "-qp", "18"]
    else:
        codec_args = ["-c:v", "libx264", "-preset", "ultrafast", "-crf", "18"]

    cmd = [
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-f", "rawvideo", "-pix_fmt", "rgb24",
        "-s", f"{w}x{h}", "-r", str(fps),
        "-i", "pipe:0",
        *codec_args,
        "-pix_fmt", "yuv420p",
        output_path,
    ]
    return subprocess.Popen(cmd, stdin=subprocess.PIPE, bufsize=w * h * 3 * SEQ_CHUNK)


def extract_matte_bboxes(matte_frames_u8: list, out_w: int, out_h: int, fps: int) -> dict:
    """Scan matte frames and extract per-frame speaker bounding boxes.

    Returns normalized 0-1 coordinates for each frame where a person is detected.
    """
    bbox_frames = []
    for idx, matte in enumerate(matte_frames_u8):
        # matte is [H, W] uint8 (0-255), find white pixel extent
        rows = np.any(matte > 32, axis=1)
        cols = np.any(matte > 32, axis=0)

        if not np.any(rows) or not np.any(cols):
            # No person detected in this frame — skip
            continue

        y_min = np.argmax(rows)
        y_max = out_h - np.argmax(rows[::-1])
        x_min = np.argmax(cols)
        x_max = out_w - np.argmax(cols[::-1])

        bbox_frames.append({
            "frame": idx,
            "x": round(float(x_min) / out_w, 4),
            "y": round(float(y_min) / out_h, 4),
            "w": round(float(x_max - x_min) / out_w, 4),
            "h": round(float(y_max - y_min) / out_h, 4),
        })

    return {
        "fps": fps,
        "frames": bbox_frames,
    }


def process_video(
    input_path: str,
    output_path: str,
    backbone: str,
    scale: float,
    fps: int,
    downsample_ratio: float,
) -> dict:
    """Run RVM segmentation on a video file, output RGB matte MP4 via FFmpeg pipe."""
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    use_fp16 = device.type == "cuda"
    dtype = torch.float16 if use_fp16 else torch.float32
    print(f"Using device: {device} | {dtype}")

    # Load model (tested approach: local hub cache + JIT freeze)
    print(f"Loading RVM model ({backbone})...")
    model = load_rvm_model(backbone, device, dtype)

    # Probe input video
    info = probe_video(input_path)
    src_w, src_h = info["width"], info["height"]
    src_fps = info["fps"]
    duration_s = info["duration_s"]

    # Processing resolution — round to nearest even number
    out_w = int(src_w * scale) // 2 * 2
    out_h = int(src_h * scale) // 2 * 2
    max_frames = int(duration_s * fps)

    print(f"Processing video: {src_w}x{src_h} @ {src_fps:.0f}fps, {max_frames} frames")
    print(f"Output: {out_w}x{out_h} @ {fps}fps, scale={scale}")

    # Warmup GPU
    if device.type == "cuda":
        rec = [None] * 4
        dummy = torch.randn(1, 1, 3, out_h, out_w, device=device, dtype=dtype)
        for _ in range(3):
            _, _, *rec = model(dummy, *rec, downsample_ratio)
        del dummy
        torch.cuda.synchronize()
        torch.cuda.empty_cache()

    # FFmpeg decode (scaled, resampled to matte fps)
    decode_cmd = [
        "ffmpeg", "-hide_banner", "-loglevel", "error",
        "-hwaccel", "cuda",
        "-i", input_path,
        "-vf", f"scale={out_w}:{out_h},fps={fps}",
        "-f", "rawvideo", "-pix_fmt", "rgb24",
        "pipe:1",
    ]
    decoder = subprocess.Popen(
        decode_cmd, stdout=subprocess.PIPE,
        bufsize=out_w * out_h * 3 * SEQ_CHUNK,
    )

    # FFmpeg encode — RGB (3-channel white-on-black) matte for browser compatibility
    encoder = make_ffmpeg_encoder(output_path, out_w, out_h, fps)

    # Main inference loop
    frame_size = out_w * out_h * 3
    rec = [None] * 4
    frame_idx = 0
    start_time = time.time()
    all_matte_frames = []  # Collect for bbox extraction

    while True:
        # Read seq_chunk frames
        frames_rgb = []
        for _ in range(SEQ_CHUNK):
            raw = decoder.stdout.read(frame_size)
            if len(raw) < frame_size:
                break
            frames_rgb.append(np.frombuffer(raw, dtype=np.uint8).reshape(out_h, out_w, 3))

        if not frames_rgb:
            break

        T = len(frames_rgb)
        batch = np.stack(frames_rgb)  # [T, H, W, 3]

        src = torch.from_numpy(batch).permute(0, 3, 1, 2).unsqueeze(0)  # [1, T, 3, H, W]
        src = src.to(device, dtype=dtype, non_blocking=True).div(255.0)

        with torch.no_grad():
            fgr, pha, *rec = model(src, *rec, downsample_ratio)

        mattes = pha[0, :, 0].float().mul(255).clamp(0, 255).byte().cpu().numpy()

        for t in range(T):
            matte_u8 = mattes[t]  # [H, W] single channel
            all_matte_frames.append(matte_u8)

            # Convert to RGB (white-on-black) for browser canvas compositing
            matte_rgb = np.stack([matte_u8, matte_u8, matte_u8], axis=-1)  # [H, W, 3]
            encoder.stdin.write(matte_rgb.tobytes())
            frame_idx += 1

        # Progress reporting (same protocol as detect_head.py)
        if frame_idx % 100 < SEQ_CHUNK:
            print(f"Processed {frame_idx} frames...")

    # Cleanup FFmpeg processes
    decoder.stdout.close()
    decoder.wait()
    encoder.stdin.close()
    encoder.wait()

    elapsed = time.time() - start_time
    print(f"Done! Processed {frame_idx} frames in {elapsed:.1f}s ({frame_idx / max(1, elapsed):.1f} fps)")

    # Extract speaker bounding boxes from matte frames
    print("Extracting speaker bounding boxes...")
    bbox_data = extract_matte_bboxes(all_matte_frames, out_w, out_h, fps)
    bbox_path = str(Path(output_path).parent / "matte-bbox.json")
    with open(bbox_path, "w") as f:
        json.dump(bbox_data, f)
    print(f"Bounding boxes saved: {bbox_path} ({len(bbox_data['frames'])} frames)")

    return {
        "framesProcessed": frame_idx,
        "framesWritten": frame_idx,
        "outputWidth": out_w,
        "outputHeight": out_h,
        "outputFps": fps,
        "bboxPath": bbox_path,
    }


def main():
    args = parse_arguments()

    # Validate input
    input_path = Path(args.input)
    if not input_path.exists():
        print(f"Error: Input file not found: {args.input}", file=sys.stderr)
        sys.exit(2)

    result = process_video(
        str(input_path),
        args.output,
        args.backbone,
        args.scale,
        args.fps,
        args.downsample_ratio,
    )

    print(f"Matte saved: {args.output}")
    print(f"Bbox saved: {result['bboxPath']}")
    sys.exit(0)


if __name__ == "__main__":
    main()
```

- [ ] **Step 2.2** — Smoke test the script locally with a short clip.

```bash
cd packages/worker
python scripts/segment_person.py scripts/temp/test-clip.mp4 --output scripts/temp/test-matte.mp4
```

**Expected output:** Progress lines printed to stdout, RGB matte MP4 written to disk, `matte-bbox.json` written alongside it. Verify matte is 3-channel (not grayscale) with `ffprobe scripts/temp/test-matte.mp4`.

---

## Task 3: Add segmentation queue to the API queue service

**File:** `packages/api/src/services/queue.ts`

Follows the exact same pattern as `headTrackingQueue` in the same file.

- [ ] **Step 3.1** — Add the segmentation queue, job data interface, and queue creator function at the end of the file (before the Redis publisher section).

```typescript
// Person segmentation queue — RVM alpha matte extraction
export interface SegmentationJobData {
  projectId: string;
  jobId: string;
  videoKey: string;
  startMs: number;
  endMs: number;
  sceneId: string;
  outputKey: string;
  /** Callback URL for the sandbox to be notified when matte is ready */
  callbackUrl?: string;
  callbackSecret?: string;
}

export const segmentationQueue = new Queue('segmentation', {
  connection,
  defaultJobOptions: {
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 500 },
  },
});

export async function queueSegmentationJob(data: SegmentationJobData) {
  return segmentationQueue.add('segmentation', data, {
    jobId: `${data.projectId}:segment:${data.sceneId}:${Date.now()}`,
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  });
}
```

- [ ] **Step 3.2** — Verify the file compiles.

```bash
cd packages/api && npx tsc --noEmit
```

**Expected output:** No type errors.

---

## Task 4: Write the worker segmentation processor

**File:** `packages/worker/src/processors/segmentation.ts`

Follows the exact same pattern as `packages/worker/src/processors/head-tracking.ts`: download video → FFmpeg extract range → run Python script → upload result to MinIO → publish completion.

- [ ] **Step 4.1** — Create the processor file.

```typescript
import { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { existsSync } from 'fs';
import { mkdir, rm, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';
import { nanoid } from 'nanoid';
import { db, jobs } from '../db/index.js';
import { downloadFile, uploadFile } from '../services/minio.js';
import { logger } from '../logger.js';
import { publishJobProgress, publishJobComplete, publishJobError } from '../services/redis.js';
import { config } from '../config.js';
import { runSubprocess } from '../utils/subprocess.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface SegmentationJobData {
  projectId: string;
  jobId: string;
  videoKey: string;
  startMs: number;
  endMs: number;
  sceneId: string;
  outputKey: string;
  callbackUrl?: string;
  callbackSecret?: string;
}

export async function processSegmentationJob(job: Job<SegmentationJobData>) {
  const { projectId, jobId, videoKey, startMs, endMs, sceneId, outputKey, callbackUrl, callbackSecret } = job.data;
  const workDir = join(tmpdir(), `viona-segment-${nanoid()}`);

  try {
    await mkdir(workDir, { recursive: true });

    // Update job status
    await db.update(jobs)
      .set({ status: 'processing', progress: 0 })
      .where(eq(jobs.id, jobId));

    const pubExtras = { projectId, sceneId };

    // Step 1: Download source video (10%)
    await publishJobProgress(jobId, 5, 'Downloading video for segmentation...', pubExtras);
    const videoPath = join(workDir, 'source.mp4');
    await downloadFile('uploads', videoKey, videoPath);
    await publishJobProgress(jobId, 10, 'Video downloaded', pubExtras);

    // Step 2: Extract time range with FFmpeg (20%)
    await publishJobProgress(jobId, 12, `Extracting ${startMs}ms–${endMs}ms...`, pubExtras);
    const clipPath = join(workDir, 'clip.mp4');
    const startSec = (startMs / 1000).toFixed(3);
    const durationSec = ((endMs - startMs) / 1000).toFixed(3);

    await runSubprocess({
      command: 'ffmpeg',
      args: [
        '-ss', startSec,
        '-i', videoPath,
        '-t', durationSec,
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-an',  // no audio needed for matte
        '-y',
        clipPath,
      ],
      timeoutMs: 2 * 60 * 1000,
      name: 'ffmpeg-extract',
    });
    await publishJobProgress(jobId, 20, 'Time range extracted', pubExtras);

    // Step 3: Run segment_person.py (20-80%)
    await publishJobProgress(jobId, 22, 'Running person segmentation...', pubExtras);

    const mattePath = join(workDir, 'matte.mp4');

    // Resolve script path (same pattern as head-tracking.ts)
    // In prod (tsup bundle): __dirname = .../dist → one level up
    // In dev (tsx):           __dirname = .../src/processors → two levels up
    let resolvedScriptPath = join(__dirname, '..', 'scripts', 'segment_person.py');
    if (!existsSync(resolvedScriptPath)) {
      resolvedScriptPath = join(__dirname, '..', '..', 'scripts', 'segment_person.py');
    }

    await runSegmentation(
      clipPath,
      mattePath,
      resolvedScriptPath,
      jobId,
      projectId,
      sceneId,
    );

    await publishJobProgress(jobId, 80, 'Segmentation complete', pubExtras);

    // Step 4: Upload matte + bbox to MinIO (90%)
    await publishJobProgress(jobId, 85, 'Uploading matte...', pubExtras);
    await uploadFile('outputs', outputKey, mattePath);

    // Upload matte-bbox.json (written by segment_person.py alongside the matte)
    const bboxPath = join(workDir, 'matte-bbox.json');
    const bboxKey = outputKey.replace(/\.mp4$/, '-bbox.json');
    if (existsSync(bboxPath)) {
      await uploadFile('outputs', bboxKey, bboxPath);
      logger.info({ projectId, sceneId, bboxKey }, 'Matte bbox uploaded');
    }

    await publishJobProgress(jobId, 90, 'Matte uploaded', pubExtras);

    // Step 5: Notify sandbox via callback if provided
    if (callbackUrl) {
      try {
        await fetch(callbackUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(callbackSecret ? { 'Authorization': `Bearer ${callbackSecret}` } : {}),
          },
          body: JSON.stringify({
            type: 'segmentation_complete',
            sceneId,
            outputKey,
            bboxKey,
            jobId,
          }),
        });
        logger.info({ projectId, sceneId, jobId }, 'Segmentation callback sent');
      } catch (err) {
        logger.warn({ err, projectId, sceneId }, 'Segmentation callback failed (non-critical)');
      }
    }

    // Step 6: Complete
    await db.update(jobs)
      .set({ status: 'complete', progress: 100, completedAt: new Date() })
      .where(eq(jobs.id, jobId));

    await publishJobProgress(jobId, 100, 'Complete', pubExtras);
    await publishJobComplete(jobId, projectId);

    logger.info({ projectId, sceneId }, 'Segmentation complete');

  } catch (error) {
    logger.error({ projectId, sceneId, err: error }, 'Segmentation failed');

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await db.update(jobs)
      .set({ status: 'failed', error: errorMessage })
      .where(eq(jobs.id, jobId));

    await publishJobError(jobId, errorMessage, { projectId });

    throw error;
  } finally {
    try {
      await rm(workDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}

async function runSegmentation(
  clipPath: string,
  mattePath: string,
  scriptPath: string,
  jobId: string,
  projectId: string,
  sceneId: string,
): Promise<void> {
  const pythonPath = config.pythonPath || 'python3';
  let expectedFrames = 0;

  await runSubprocess({
    command: pythonPath,
    args: [
      scriptPath,
      clipPath,
      '--output', mattePath,
      '--backbone', 'resnet50',
      '--scale', '0.5',
      '--fps', '30',
      '--downsample-ratio', '0.8',
    ],
    timeoutMs: 5 * 60 * 1000,
    name: 'segmentation',
    onStdoutLine: (line) => {
      // Parse total frame count from initial log line
      if (!expectedFrames && line.includes('Processing video:')) {
        const totalMatch = line.match(/(\d+) frames/);
        if (totalMatch) {
          expectedFrames = parseInt(totalMatch[1], 10);
        }
      }
      // Parse progress
      if (line.includes('Processed') && line.includes('frames')) {
        const match = line.match(/Processed (\d+) frames/);
        if (match) {
          const processed = parseInt(match[1], 10);
          const total = expectedFrames || processed * 2;
          const ratio = Math.min(1, processed / total);
          const progress = Math.min(80, 22 + Math.round(ratio * 58));
          publishJobProgress(jobId, progress, `Segmenting: ${processed} frames processed`, { projectId, sceneId });
        }
      }
    },
  });
}
```

- [ ] **Step 4.2** — Verify the file compiles.

```bash
cd packages/worker && npx tsc --noEmit
```

**Expected output:** No type errors.

---

## Task 5: Register the segmentation worker in the worker entry point

**File:** `packages/worker/src/index.ts`

Follows the exact same pattern as `headTrackingWorker` in the same file.

- [ ] **Step 5.1** — Add the import at the top of `packages/worker/src/index.ts` (alongside the other processor imports).

```typescript
import { processSegmentationJob, SegmentationJobData } from './processors/segmentation.js';
```

- [ ] **Step 5.2** — Add the worker instance after the `renderTemplateWorker` block and before the `logger.info('Worker started, waiting for jobs...');` line.

```typescript
  // Segmentation worker — RVM person matting (GPU)
  const segmentationWorker = new Worker<SegmentationJobData>(
    'segmentation',
    async (job) => {
      logger.info({ jobId: job.id, projectId: job.data.projectId, sceneId: job.data.sceneId }, 'Processing segmentation job');
      await processSegmentationJob(job);
    },
    {
      connection,
      concurrency: 2, // Multiple time ranges can be matted in parallel
      lockDuration: 5 * 60 * 1000, // 5 minutes
      stalledInterval: 2 * 60 * 1000,
      maxStalledCount: 2,
    }
  );

  segmentationWorker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Segmentation job completed');
  });

  segmentationWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Segmentation job failed');
  });
```

- [ ] **Step 5.3** — Add `segmentationWorker` to the `allWorkers` array for graceful shutdown.

In the `allWorkers` array, add `segmentationWorker`:

```typescript
  const allWorkers = [
    transcribeWorker,
    svgAnimationWorker, preloadProjectWorker,
    headTrackingWorker, generateReframeWorker, generateCaptionStylesWorker,
    youtubeClipWorker, renderTemplateWorker,
    segmentationWorker,
  ];
```

- [ ] **Step 5.4** — Verify compilation.

```bash
cd packages/worker && npx tsc --noEmit
```

**Expected output:** No type errors.

---

## Task 6: Add the segmentation API endpoint

**File:** `packages/api/src/sandbox/routes.ts`

This endpoint is called by the sandbox agent's MCP tool. It creates job records, queues them to the worker, and returns job IDs. Uses the same `validateInternalCallback` pattern for auth since the sandbox calls this as an internal callback.

- [ ] **Step 6.0** — Extend the `progressMeta` type in `packages/api/src/db/schema.ts` to include `sceneId` and `outputKey` fields. The job creation code below stores `{ sceneId, outputKey }` in `progressMeta`, but the Drizzle `$type<>` definition on that column doesn't include those fields, which forces the `as any` cast and breaks type safety on reads.

In the `jobs` table definition, find the `progressMeta` column type (around line 73) and add:

```typescript
  progressMeta: jsonb('progress_meta').$type<{
    phase?: string;
    phaseName?: string;
    scene?: number;
    totalScenes?: number;
    iteration?: number;
    maxIterations?: number;
    score?: number;
    detail?: string;
    sceneId?: string;
    outputKey?: string;
  }>(),
```

After this change, remove the `as any` cast from the `progressMeta` value in Step 6.1 below — TypeScript will accept `{ sceneId, outputKey }` natively.

- [ ] **Step 6.1** — Add the `POST /internal/sandbox/:id/segment` route inside the `createSandboxRoutes` function, after the existing internal callback routes (after the `agent-state` route, before the closing `};` of the factory).

```typescript
    // POST /internal/sandbox/:id/segment — Request person segmentation for time ranges
    fastify.post('/internal/sandbox/:id/segment', async (request, reply) => {
      const projectId = await validateInternalCallback(request, reply);
      if (!projectId) return;

      const { ranges } = request.body as {
        ranges: Array<{ startMs: number; endMs: number; sceneId: string }>;
      };

      if (!ranges || !Array.isArray(ranges) || ranges.length === 0) {
        return reply.status(400).send({ error: 'Missing or empty ranges array' });
      }

      // Look up project to get videoKey
      const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
      if (!project?.videoKey) {
        return reply.status(400).send({ error: 'Project has no video' });
      }

      // Look up the sandbox session to get callback info
      const [session] = await db.select().from(sandboxSessions)
        .where(eq(sandboxSessions.projectId, projectId))
        .limit(1);

      const { queueSegmentationJob } = await import('../services/queue.js');
      const { jobs: jobsTable } = await import('../db/index.js');

      const jobIds: string[] = [];

      for (const range of ranges) {
        const outputKey = `projects/${projectId}/matte-${range.sceneId}.mp4`;

        // Create job record in DB — store sceneId and outputKey in progressMeta
        // so the download endpoint can read them directly without BullMQ lookup
        const [job] = await db.insert(jobsTable).values({
          projectId,
          type: 'segmentation',
          status: 'pending',
          progressMeta: {
            sceneId: range.sceneId,
            outputKey,
          } as any,
        }).returning();

        // Build callback URL so worker can notify sandbox when done
        const callbackUrl = session?.agentUrl
          ? `${session.agentUrl}/segmentation-ready`
          : undefined;

        await queueSegmentationJob({
          projectId,
          jobId: job.id,
          videoKey: project.videoKey,
          startMs: range.startMs,
          endMs: range.endMs,
          sceneId: range.sceneId,
          outputKey,
          callbackUrl,
          callbackSecret: session?.sandboxSecret,
        });

        jobIds.push(job.id);
        logger.info({ projectId, jobId: job.id, sceneId: range.sceneId }, 'Segmentation job queued');
      }

      // Estimate duration: ~3-5 seconds per 15s clip on GPU
      const totalDurationMs = ranges.reduce((sum, r) => sum + (r.endMs - r.startMs), 0);
      const estimatedDurationMs = Math.max(3000, Math.round(totalDurationMs * 0.3));

      return { jobIds, estimatedDurationMs };
    });
```

- [ ] **Step 6.2** — Add the `GET /internal/sandbox/:id/segment/status` route for polling job completion. Place it right after the segment POST route.

```typescript
    // GET /internal/sandbox/:id/segment/status — Check segmentation job statuses
    fastify.get('/internal/sandbox/:id/segment/status', async (request, reply) => {
      const projectId = await validateInternalCallback(request, reply);
      if (!projectId) return;

      const { jobIds } = request.query as { jobIds?: string };
      if (!jobIds) {
        return reply.status(400).send({ error: 'Missing jobIds query parameter' });
      }

      const ids = jobIds.split(',').filter(Boolean);
      if (ids.length === 0) {
        return reply.status(400).send({ error: 'Empty jobIds' });
      }

      const { jobs: jobsTable } = await import('../db/index.js');
      const jobRecords = await db.select().from(jobsTable)
        .where(inArray(jobsTable.id, ids));

      const results = jobRecords.map(j => {
        const meta = j.progressMeta as { sceneId?: string; outputKey?: string } | null;
        return {
          jobId: j.id,
          status: j.status,
          progress: j.progress,
          error: j.error,
          sceneId: meta?.sceneId,
          outputKey: meta?.outputKey,
        };
      });

      const allComplete = results.every(r => r.status === 'complete');
      const anyFailed = results.some(r => r.status === 'failed');

      return {
        jobs: results,
        allComplete,
        anyFailed,
      };
    });
```

- [ ] **Step 6.3** — Verify compilation.

```bash
cd packages/api && npx tsc --noEmit
```

**Expected output:** No type errors.

---

## Task 7: Add MCP tools to the asset server

**File:** `packages/mcp-servers/src/asset-server.ts`

Adds `request_segmentation` and `check_segmentation_status` tools. These call the sandbox's API server (which proxies to the API endpoint). The MCP server runs inside the sandbox container, so it uses the `API_INTERNAL_URL` env var to reach the API.

- [ ] **Step 7.1** — Add environment variables and helpers at the top of the file (in the Config section, after the existing `PEXELS_API_KEY` line).

```typescript
const API_INTERNAL_URL: string = process.env.API_INTERNAL_URL || "";
const SANDBOX_SECRET: string = process.env.SANDBOX_SECRET || "";
const PROJECT_ID: string = process.env.PROJECT_ID || "";
const MATTE_DIR: string = path.join(WORKSPACE, "public", "matte");

/** Ensure the matte directory exists. */
async function ensureMatteDir(): Promise<void> {
  await mkdir(MATTE_DIR, { recursive: true });
}
```

- [ ] **Step 7.2** — Add the `request_segmentation` MCP tool registration (after the last existing tool registration, before `server.run(transport)`).

```typescript
// -- request_segmentation ----------------------------------------------------
server.registerTool(
  "request_segmentation",
  {
    description:
      "Request person alpha matte segmentation for specific time ranges. " +
      "Queues GPU worker jobs to extract person mattes from the source video. " +
      "Returns job IDs that you can poll with check_segmentation_status. " +
      "Call this early (during planning) so mattes are ready by layout/animation time. " +
      "Each range produces a separate matte clip in public/matte/{sceneId}.mp4.",
    inputSchema: {
      ranges: z.array(z.object({
        startMs: z.number().describe("Start time in milliseconds"),
        endMs: z.number().describe("End time in milliseconds"),
        sceneId: z.string().describe("Scene identifier (e.g. 'scene-2'). Matte will be saved as public/matte/{sceneId}.mp4"),
      })).min(1).describe("Time ranges to segment"),
    },
  },
  async ({ ranges }: { ranges: Array<{ startMs: number; endMs: number; sceneId: string }> }) => {
    try {
      if (!API_INTERNAL_URL || !PROJECT_ID) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              error: "Segmentation not available — missing API_INTERNAL_URL or PROJECT_ID",
            }),
          }],
          isError: true,
        };
      }

      const res = await fetch(`${API_INTERNAL_URL}/internal/sandbox/${PROJECT_ID}/segment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SANDBOX_SECRET}`,
        },
        body: JSON.stringify({ ranges }),
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error((err as any).error || `Segment request failed: ${res.status}`);
      }

      const result = await res.json() as { jobIds: string[]; estimatedDurationMs: number };

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            success: true,
            jobIds: result.jobIds,
            estimatedDurationMs: result.estimatedDurationMs,
            ranges: ranges.map(r => ({
              sceneId: r.sceneId,
              mattePath: `public/matte/${r.sceneId}.mp4`,
              staticFile: `matte/${r.sceneId}.mp4`,
            })),
            hint: "Continue working on other scenes. Call check_segmentation_status({ jobIds }) when you need the mattes.",
          }),
        }],
      };
    } catch (err) {
      return {
        content: [{
          type: "text" as const,
          text: `Error requesting segmentation: ${errorMessage(err)}`,
        }],
        isError: true,
      };
    }
  }
);
```

- [ ] **Step 7.3** — Add the `check_segmentation_status` MCP tool registration right after `request_segmentation`.

```typescript
// -- check_segmentation_status -----------------------------------------------
server.registerTool(
  "check_segmentation_status",
  {
    description:
      "Check the status of segmentation jobs and download completed mattes. " +
      "Poll this after calling request_segmentation. When jobs are complete, " +
      "the matte files are automatically downloaded to public/matte/{sceneId}.mp4 " +
      "for use with SandwichComposite.",
    inputSchema: {
      jobIds: z.array(z.string()).min(1).describe("Job IDs returned by request_segmentation"),
    },
  },
  async ({ jobIds }: { jobIds: string[] }) => {
    try {
      if (!API_INTERNAL_URL || !PROJECT_ID) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ error: "Segmentation not available" }),
          }],
          isError: true,
        };
      }

      // Poll status from API
      const statusRes = await fetch(
        `${API_INTERNAL_URL}/internal/sandbox/${PROJECT_ID}/segment/status?jobIds=${jobIds.join(",")}`,
        {
          headers: {
            "Authorization": `Bearer ${SANDBOX_SECRET}`,
          },
          signal: AbortSignal.timeout(15_000),
        },
      );

      if (!statusRes.ok) {
        throw new Error(`Status check failed: ${statusRes.status}`);
      }

      const status = await statusRes.json() as {
        jobs: Array<{ jobId: string; status: string; progress: number | null; error: string | null }>;
        allComplete: boolean;
        anyFailed: boolean;
      };

      // For completed jobs, download the matte files from MinIO via API proxy
      const downloaded: string[] = [];
      await ensureMatteDir();

      for (const job of status.jobs) {
        if (job.status !== "complete") continue;

        // Determine scene ID from job — we need to map jobId back to sceneId
        // The segment status endpoint should include this, but as a fallback
        // we can fetch the matte file using the job's outputKey pattern
        try {
          const matteRes = await fetch(
            `${API_INTERNAL_URL}/internal/sandbox/${PROJECT_ID}/segment/${job.jobId}/matte`,
            {
              headers: { "Authorization": `Bearer ${SANDBOX_SECRET}` },
              signal: AbortSignal.timeout(60_000),
            },
          );

          if (matteRes.ok) {
            const sceneId = matteRes.headers.get("x-scene-id") || job.jobId;
            const mattePath = path.join(MATTE_DIR, `${sceneId}.mp4`);
            const buf = Buffer.from(await matteRes.arrayBuffer());
            await writeFile(mattePath, buf);
            downloaded.push(`public/matte/${sceneId}.mp4`);
          }
        } catch (err) {
          console.error(`[asset-server] Failed to download matte for job ${job.jobId}: ${err}`);
        }
      }

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            ...status,
            downloaded,
            hint: status.allComplete
              ? "All mattes are ready in public/matte/. Use staticFile('matte/{sceneId}.mp4') in SandwichComposite."
              : status.anyFailed
                ? "Some segmentation jobs failed. Affected scenes should fall back to non-depth display mode."
                : "Still processing. Call check_segmentation_status again in a few seconds.",
          }),
        }],
      };
    } catch (err) {
      return {
        content: [{
          type: "text" as const,
          text: `Error checking segmentation status: ${errorMessage(err)}`,
        }],
        isError: true,
      };
    }
  }
);
```

- [ ] **Step 7.4** — Add the `get_depth_compositing_info` MCP tool registration right after `check_segmentation_status`. This is a discovery tool that agents call before requesting segmentation to check matte availability, file paths, available techniques, and compositing usage instructions.

```typescript
// -- get_depth_compositing_info ------------------------------------------------
server.registerTool(
  "get_depth_compositing_info",
  {
    description:
      "Check if depth compositing (person matting) is available for this project, " +
      "and get usage instructions. Call this BEFORE request_segmentation to understand " +
      "what's available and how to use it. Returns matte file paths, available techniques, " +
      "and the SandwichComposite component API.",
    inputSchema: {},
  },
  async () => {
    try {
      // Check if segmentation is available from workspace flag
      const segFlagPath = path.join(WORKSPACE, "docs", "segmentation-available.json");
      let available = false;
      try {
        const raw = await readFile(segFlagPath, "utf-8");
        available = JSON.parse(raw).available === true;
      } catch {
        // File missing = segmentation not available
      }

      // Check for existing matte files
      await ensureMatteDir();
      const matteFiles: string[] = [];
      try {
        const entries = await readdir(MATTE_DIR);
        for (const entry of entries) {
          if (entry.endsWith(".mp4")) {
            matteFiles.push(`public/matte/${entry}`);
          }
        }
      } catch {
        // Directory empty or inaccessible
      }

      // Check for bbox data
      const bboxFiles: string[] = [];
      try {
        const entries = await readdir(MATTE_DIR);
        for (const entry of entries) {
          if (entry.endsWith("-bbox.json")) {
            bboxFiles.push(`public/matte/${entry}`);
          }
        }
      } catch {
        // No bbox files
      }

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            available,
            existingMattes: matteFiles,
            existingBboxFiles: bboxFiles,
            techniques: [
              "behind-text-slide",
              "radial-burst",
              "background-color-wash",
              "parallax-depth-push",
              "environment-swap",
              "particle-field-behind",
            ],
            compositingComponent: "SandwichComposite",
            usage: [
              "Import SandwichComposite from '../components/SandwichComposite'.",
              "Pass videoSrc (source video), matteSrc (matte file), startFrom (frame offset).",
              "Place mid-layer animations as children — they render BETWEEN background and person.",
              "Use staticFile('matte/{sceneId}.mp4') for the matteSrc path.",
            ].join(" "),
            antiPatterns: [
              "Don't use depth compositing for every scene — reserve for 30-40% of scenes max",
              "One motion per moment — avoid layering multiple depth effects",
              "Keep the original background visible — don't fully replace it",
              "Don't animate the person layer itself — only animate elements behind/in-front",
            ],
            hint: available
              ? "Segmentation is available. Call request_segmentation with time ranges for scenes that benefit from depth compositing."
              : "Segmentation is NOT available for this project (no person detected in head tracking). Use standard overlay/stacked display modes.",
          }),
        }],
      };
    } catch (err) {
      return {
        content: [{
          type: "text" as const,
          text: `Error checking depth compositing info: ${errorMessage(err)}`,
        }],
        isError: true,
      };
    }
  }
);
```

- [ ] **Step 7.5** — Add the `readdir` import at the top of the file alongside the existing `fs/promises` imports. Find the `import { mkdir, readFile, writeFile } from "node:fs/promises"` line and add `readdir`:

```typescript
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
```

- [ ] **Step 7.6** — Verify compilation.

```bash
cd packages/mcp-servers && npx tsc --noEmit
```

**Expected output:** No type errors.

---

## Task 8: Add matte download endpoint to the API

**File:** `packages/api/src/sandbox/routes.ts`

The `check_segmentation_status` MCP tool needs to download completed matte files from MinIO. This endpoint streams the matte file from MinIO to the sandbox.

- [ ] **Step 8.1** — Add the `GET /internal/sandbox/:id/segment/:jobId/matte` route inside `createSandboxRoutes`, right after the `segment/status` GET route.

**Key fix:** Read `sceneId` and `outputKey` from the DB job record's `progressMeta` column (stored during job creation in Task 6), instead of looking up BullMQ. The BullMQ job ID format includes a timestamp (`{projectId}:segment:{sceneId}:{Date.now()}`), so looking it up by `{projectId}:segment:{jobId}` would never match.

```typescript
    // GET /internal/sandbox/:id/segment/:jobId/matte — Download completed matte file
    fastify.get('/internal/sandbox/:id/segment/:jobId/matte', async (request, reply) => {
      const projectId = await validateInternalCallback(request, reply);
      if (!projectId) return;

      const { jobId } = request.params as { jobId: string };

      // Look up the job record — sceneId and outputKey are stored in progressMeta
      const { jobs: jobsTable } = await import('../db/index.js');
      const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, jobId)).limit(1);

      if (!job || job.status !== 'complete') {
        return reply.status(404).send({ error: 'Job not found or not complete' });
      }

      // Read sceneId and outputKey directly from DB (stored at job creation time)
      const meta = job.progressMeta as { sceneId?: string; outputKey?: string } | null;
      const sceneId = meta?.sceneId || jobId;
      const outputKey = meta?.outputKey || `projects/${projectId}/matte-${sceneId}.mp4`;

      const { getObjectStream } = await import('../services/minio.js');

      try {
        const stream = await getObjectStream('outputs', outputKey);
        reply.header('Content-Type', 'video/mp4');
        reply.header('X-Scene-Id', sceneId);
        return reply.send(stream);
      } catch (err) {
        logger.error({ err, projectId, jobId, outputKey }, 'Failed to stream matte from MinIO');
        return reply.status(404).send({ error: 'Matte file not found in storage' });
      }
    });
```

- [ ] **Step 8.2** — The `getObjectStream` is dynamically imported in the route handler (via `await import`), so no top-level import is needed — consistent with how `queueSandboxRender` is imported in the same file.

- [ ] **Step 8.3** — Verify compilation.

```bash
cd packages/api && npx tsc --noEmit
```

**Expected output:** No type errors.

---

## Task 9: Add `segmentationAvailable` flag to buildInitData

**File:** `packages/api/src/sandbox/routes.ts`

The sandbox needs to know if segmentation is available (i.e., if head tracking detected a person in the video). This flag goes into the init data payload.

- [ ] **Step 9.1** — Add the `segmentationAvailable` field to the `initBody` object in the `buildInitData` function, right after the `headTracking` assignment (around line 530).

Find this block:

```typescript
  // Add head-tracking data if available
  if (project.headTrackingData) {
    initBody.headTracking = project.headTrackingData;
  }
```

Add after it:

```typescript
  // Flag whether person segmentation is available (requires head tracking with face detections)
  const htData = project.headTrackingData as { metadata?: { frames_with_face?: number } } | null;
  initBody.segmentationAvailable = !!(htData?.metadata?.frames_with_face && htData.metadata.frames_with_face > 0);
```

- [ ] **Step 9.2** — Add `segmentationAvailable` to the `InitData` interface in `packages/api/src/sandbox/manager.ts`.

Find the `InitData` interface and add the field:

```typescript
export interface InitData {
  videoUrl?: string;
  audioUrl?: string;
  manifest?: unknown;
  transcript?: unknown;
  userBrief?: string;
  headTracking?: unknown;
  projectMeta?: {
    width: number;
    height: number;
    fps: number;
    durationMs: number;
  };
  theme?: string;
  segmentationAvailable?: boolean;  // <-- add this
  [key: string]: unknown;
}
```

- [ ] **Step 9.3** — Verify compilation.

```bash
cd packages/api && npx tsc --noEmit
```

**Expected output:** No type errors.

---

## Task 10: Pass sandbox env vars for MCP tool API access

**File:** `packages/api/src/sandbox/routes.ts`

The MCP tools in the sandbox need `API_INTERNAL_URL`, `SANDBOX_SECRET`, and `PROJECT_ID` to call back to the API for segmentation. These need to be passed as environment variables when the sandbox is created.

- [ ] **Step 10.1** — In the `POST /projects/:id/sandbox` route handler, add the segmentation-related env vars to the `env` object. Find the block that builds `env`:

```typescript
        const env: Record<string, string> = {};
        if (process.env.ANTHROPIC_API_KEY) env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
        if (process.env.CLAUDE_CODE_OAUTH_TOKEN) env.CLAUDE_CODE_OAUTH_TOKEN = process.env.CLAUDE_CODE_OAUTH_TOKEN;
```

After it, add:

```typescript
        // API URL for sandbox→API callbacks (segmentation, etc.)
        env.PROJECT_ID = projectId;
        // API_INTERNAL_URL and SANDBOX_SECRET are set by the sandbox manager during acquire()
```

- [ ] **Step 10.2** — Verify that the sandbox manager already passes `API_INTERNAL_URL` and `SANDBOX_SECRET` as env vars to the container. Check `packages/api/src/sandbox/docker.ts` or `packages/api/src/sandbox/manager.ts` for existing patterns.

```bash
cd packages/api && grep -n "API_INTERNAL_URL\|SANDBOX_SECRET\|sandboxSecret" src/sandbox/docker.ts src/sandbox/manager.ts | head -20
```

If `API_INTERNAL_URL` is not already set, it must be added to the container environment in the Docker creation code. The exact location depends on the existing pattern in `docker.ts`.

- [ ] **Step 10.3** — Verify compilation.

```bash
cd packages/api && npx tsc --noEmit
```

**Expected output:** No type errors.

---

## Task 11: Write workspace-init matte directory creation

**File:** `packages/sandbox/src/workspace-init.ts`

The workspace needs a `public/matte/` directory created during init so mattes can be downloaded there later.

- [ ] **Step 11.1** — In the `initWorkspaceInDir` function, add `public/matte` to the directory creation block. Find:

```typescript
  await mkdir(join(baseDir, 'public'), { recursive: true });
```

Add after it:

```typescript
  await mkdir(join(baseDir, 'public', 'matte'), { recursive: true });
```

- [ ] **Step 11.2** — Write the `segmentationAvailable` flag to a workspace-accessible file so the orchestrator/planner can read it. Add after the head-tracking write block:

```typescript
  // Write segmentation availability flag
  if ((payload as any).segmentationAvailable !== undefined) {
    await writeFile(
      join(baseDir, 'docs', 'segmentation-available.json'),
      JSON.stringify({ available: !!(payload as any).segmentationAvailable }),
    );
  }
```

- [ ] **Step 11.3** — Add `segmentationAvailable` to the `InitPayload` interface in the same file:

```typescript
  segmentationAvailable?: boolean;  // Whether person segmentation is available
```

- [ ] **Step 11.4** — Verify compilation.

```bash
cd packages/sandbox && npx tsc --noEmit
```

**Expected output:** No type errors.

---

## Task 12: End-to-end integration test

**File:** `scripts/temp/test-segmentation-e2e.ts` (temporary test script)

- [ ] **Step 12.1** — Create `scripts/temp/test-segmentation.py` that runs `segment_person.py` on a real test video and validates all outputs.

```python
#!/usr/bin/env python3
"""
Test script for segment_person.py — validates the full segmentation pipeline.

Run: python scripts/temp/test-segmentation.py [optional_video_path]

Validates:
  1. segment_person.py runs without errors
  2. Output matte is a valid H.264 MP4 (RGB 3-channel, not grayscale)
  3. matte-bbox.json is written with correct schema
  4. Bounding box coordinates are normalized 0-1
  5. Frame count and FPS match expectations
"""

import json
import os
import subprocess
import sys
import tempfile
import shutil

# Default test video — override with CLI arg
TEST_VIDEO = sys.argv[1] if len(sys.argv) > 1 else None

if not TEST_VIDEO:
    # Try common test video locations
    candidates = [
        os.path.expanduser("~/Downloads/test-clip.mp4"),
        os.path.join(os.path.dirname(__file__), "test-clip.mp4"),
    ]
    for c in candidates:
        if os.path.exists(c):
            TEST_VIDEO = c
            break

if not TEST_VIDEO or not os.path.exists(TEST_VIDEO):
    print("ERROR: No test video found. Pass a video path as argument:")
    print("  python scripts/temp/test-segmentation.py /path/to/video.mp4")
    sys.exit(1)

SCRIPT_PATH = os.path.join(
    os.path.dirname(__file__), "..", "..", "packages", "worker", "scripts", "segment_person.py"
)
SCRIPT_PATH = os.path.abspath(SCRIPT_PATH)

if not os.path.exists(SCRIPT_PATH):
    print(f"ERROR: segment_person.py not found at {SCRIPT_PATH}")
    sys.exit(1)

# Create temp output directory
work_dir = tempfile.mkdtemp(prefix="viona-seg-test-")
matte_path = os.path.join(work_dir, "matte.mp4")
bbox_path = os.path.join(work_dir, "matte-bbox.json")

errors = []

try:
    print(f"=== Segmentation Pipeline Test ===")
    print(f"Video:  {TEST_VIDEO}")
    print(f"Script: {SCRIPT_PATH}")
    print(f"Output: {work_dir}")
    print()

    # Step 1: Run segment_person.py
    print("[1/5] Running segment_person.py...")
    result = subprocess.run(
        [sys.executable, SCRIPT_PATH, TEST_VIDEO, "--output", matte_path,
         "--scale", "0.5", "--fps", "30",
         "--backbone", "mobilenetv3"],  # mobilenetv3 is intentional: ~3x faster than resnet50 for quick test validation
        capture_output=True, text=True, timeout=300,
    )
    print(result.stdout)
    if result.returncode != 0:
        print(f"STDERR: {result.stderr}")
        errors.append(f"segment_person.py exited with code {result.returncode}")

    # Step 2: Verify matte MP4 exists and is valid
    print("[2/5] Validating matte MP4...")
    if not os.path.exists(matte_path):
        errors.append("Matte MP4 was not created")
    else:
        probe = subprocess.run(
            ["ffprobe", "-v", "error", "-select_streams", "v:0",
             "-show_entries", "stream=width,height,codec_name,pix_fmt,r_frame_rate",
             "-of", "json", matte_path],
            capture_output=True, text=True,
        )
        info = json.loads(probe.stdout)
        stream = info["streams"][0]
        print(f"  Codec: {stream['codec_name']}, PixFmt: {stream['pix_fmt']}, "
              f"Size: {stream['width']}x{stream['height']}, FPS: {stream['r_frame_rate']}")

        if stream["codec_name"] != "h264":
            errors.append(f"Expected h264 codec, got {stream['codec_name']}")
        if stream["pix_fmt"] != "yuv420p":
            errors.append(f"Expected yuv420p pix_fmt, got {stream['pix_fmt']}")

        file_size = os.path.getsize(matte_path) / 1024 / 1024
        print(f"  File size: {file_size:.1f} MB")
        if file_size < 0.01:
            errors.append("Matte file suspiciously small (< 10 KB)")

    # Step 3: Verify matte-bbox.json exists and has correct schema
    print("[3/5] Validating matte-bbox.json...")
    if not os.path.exists(bbox_path):
        errors.append("matte-bbox.json was not created")
    else:
        with open(bbox_path) as f:
            bbox_data = json.load(f)

        if "fps" not in bbox_data:
            errors.append("matte-bbox.json missing 'fps' field")
        if "frames" not in bbox_data:
            errors.append("matte-bbox.json missing 'frames' field")
        else:
            frames = bbox_data["frames"]
            print(f"  FPS: {bbox_data.get('fps')}, Frames with person: {len(frames)}")

            if len(frames) == 0:
                errors.append("No person detected in any frame (bbox frames empty)")

    # Step 4: Validate bbox coordinates are normalized 0-1
    print("[4/5] Validating bbox coordinates...")
    if os.path.exists(bbox_path) and "frames" in bbox_data and len(bbox_data["frames"]) > 0:
        sample = bbox_data["frames"][0]
        required_keys = {"frame", "x", "y", "w", "h"}
        if not required_keys.issubset(sample.keys()):
            errors.append(f"Bbox frame missing keys: {required_keys - sample.keys()}")

        for frame_data in bbox_data["frames"][:10]:
            for key in ["x", "y", "w", "h"]:
                val = frame_data.get(key, -1)
                if not (0 <= val <= 1):
                    errors.append(f"Bbox coordinate {key}={val} not in 0-1 range (frame {frame_data['frame']})")
                    break

        print(f"  Sample bbox: x={sample['x']:.3f} y={sample['y']:.3f} "
              f"w={sample['w']:.3f} h={sample['h']:.3f}")

    # Step 5: Verify progress output protocol
    print("[5/5] Checking progress protocol...")
    if "Processing video:" not in result.stdout:
        errors.append("Missing 'Processing video:' progress line")
    if "Done!" not in result.stdout:
        errors.append("Missing 'Done!' completion line")
    if "Bounding boxes saved:" not in result.stdout:
        errors.append("Missing bbox completion line")

    # Report
    print()
    if errors:
        print(f"FAILED — {len(errors)} error(s):")
        for e in errors:
            print(f"  - {e}")
        sys.exit(1)
    else:
        print("PASSED — All checks passed.")
        sys.exit(0)

finally:
    # Cleanup
    shutil.rmtree(work_dir, ignore_errors=True)
```

- [ ] **Step 12.2** — Run the test with a real video clip.

```bash
python scripts/temp/test-segmentation.py /path/to/short-clip.mp4
```

**Expected output:**
- All 5 checks pass
- Matte is H.264 yuv420p (RGB-encoded white-on-black)
- `matte-bbox.json` has normalized 0-1 bounding box coordinates
- Progress protocol lines present in stdout

- [ ] **Step 12.3** — Test the worker processor by starting the worker and submitting a job via Redis.

```bash
# Terminal 1: Start worker
cd packages/worker && pnpm dev

# Terminal 2: Queue a test job (requires project with uploaded video)
cd packages/api && npx tsx -e "
  const { queueSegmentationJob } = await import('./src/services/queue.js');
  await queueSegmentationJob({
    projectId: 'test-project-id',
    jobId: 'test-job-id',
    videoKey: 'test-video-key.mp4',
    startMs: 0,
    endMs: 5000,
    sceneId: 'scene-test',
    outputKey: 'projects/test/matte-scene-test.mp4',
  });
  console.log('Job queued');
"
```

**Expected output:** Worker picks up job, processes it, uploads matte to MinIO.

---

## Summary

| Task | Files | What it does |
|------|-------|-------------|
| 1 | `requirements.txt` | Add PyTorch dependencies |
| 2 | `scripts/segment_person.py` | RVM matting script (FFmpeg pipe, RGB matte, matte-bbox.json) |
| 3 | `api/services/queue.ts` | Segmentation BullMQ queue |
| 4 | `worker/processors/segmentation.ts` | Job processor (FFmpeg → RVM → MinIO) + bbox upload |
| 5 | `worker/index.ts` | Register segmentation worker |
| 6 | `api/sandbox/routes.ts` | POST/GET segment endpoints (stores sceneId/outputKey in DB) |
| 7 | `mcp-servers/asset-server.ts` | MCP tools: request, check status, get_depth_compositing_info |
| 8 | `api/sandbox/routes.ts` | Matte download endpoint (reads from DB, not BullMQ) |
| 9 | `api/sandbox/routes.ts` + `manager.ts` | segmentationAvailable flag in init data |
| 10 | `api/sandbox/routes.ts` | Pass env vars for MCP→API callbacks |
| 11 | `sandbox/workspace-init.ts` | Create matte dir + write availability flag |
| 12 | `scripts/temp/test-segmentation.py` | Python E2E test (validates matte + bbox output) |
