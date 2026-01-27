# Audio Separation & Enhancement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow users to separate audio from video into its own timeline track, with automatic speech enhancement via DeepFilterNet3 producing Instagram-ready studio-quality audio.

**Architecture:** New `enhance-audio` BullMQ job processed by the existing worker. Python script handles DeepFilterNet3 + loudness normalization. Node worker handles FFmpeg extraction, transcoding, and MinIO upload. Frontend adds "Separate Audio" button in context panel and an "Enhanced" badge on audio track items.

**Tech Stack:** DeepFilterNet3, pyloudnorm, FFmpeg, BullMQ, Zustand, Canvas API

---

### Task 1: Add `enhance-audio` job type to shared types

**Files:**
- Modify: `packages/shared/src/types/index.ts`

**Step 1: Update JobType union**

In `packages/shared/src/types/index.ts:254`, add `'enhance-audio'` to the `JobType` union:

```typescript
export type JobType = 'transcribe' | 'analyze' | 'generate-visual' | 'render' | 'enhance-audio';
```

**Step 2: Update AudioData interface**

Replace the existing `AudioData` interface at line 138 with enhanced fields:

```typescript
export interface AudioData {
  src: string;              // current playback URL (original or enhanced)
  originalSrc: string;      // always points to original audio file
  enhancedSrc?: string;     // points to enhanced audio file (once processed)
  isEnhanced: boolean;      // toggle state
  sourceVideoItemId: string; // links back to the parent video item
  volume: number;
  fadeIn?: number;
  fadeOut?: number;
}
```

**Step 3: Commit**

```bash
git add packages/shared/src/types/index.ts
git commit -m "feat: add enhance-audio job type and update AudioData interface"
```

---

### Task 2: Update editor store types for audio separation

**Files:**
- Modify: `apps/web/src/features/editor-v2/store/types.ts`

**Step 1: Update AudioItemData interface**

Replace the existing `AudioItemData` at line 36 with:

```typescript
export interface AudioItemData {
  src: string;              // current playback URL
  originalSrc: string;      // original audio file URL
  enhancedSrc?: string;     // enhanced audio file URL (once processed)
  isEnhanced: boolean;      // enhancement toggle state
  sourceVideoItemId: string; // links back to parent video
  volume: number;
  waveformData?: number[];
  enhancementStatus?: 'idle' | 'processing' | 'complete' | 'error';
  enhancementProgress?: number;
}
```

**Step 2: Update VideoItemData interface**

Add muted and linked audio fields to `VideoItemData` at line 28:

```typescript
export interface VideoItemData {
  src: string;
  width: number;
  height: number;
  volume: number;
  playbackRate: number;
  previewUrl?: string;
  muted?: boolean;                  // true when audio is separated
  separatedAudioItemId?: string;    // links to the separated audio item
}
```

**Step 3: Add audio separation actions to EditorActions**

Add to the `EditorActions` interface after the existing track actions (around line 318):

```typescript
  // Audio separation actions
  separateAudio: (videoItemId: string) => Promise<void>;
  toggleEnhancement: (audioItemId: string) => void;
  updateEnhancementStatus: (audioItemId: string, status: AudioItemData['enhancementStatus'], progress?: number, enhancedSrc?: string) => void;
```

**Step 4: Commit**

```bash
git add apps/web/src/features/editor-v2/store/types.ts
git commit -m "feat: add audio separation types to editor store"
```

---

### Task 3: Add enhance-audio queue to API

**Files:**
- Modify: `packages/api/src/services/queue.ts`

**Step 1: Add queue and job data type**

Add after the existing `RenderJobData` interface and `queueRenderJob` function:

```typescript
export interface EnhanceAudioJobData {
  projectId: string;
  jobId: string;
  videoKey: string;
  audioTrackId: string;
  audioItemId: string;
  videoItemId: string;
}

export const enhanceAudioQueue = new Queue('enhance-audio', { connection });

export async function queueEnhanceAudioJob(data: EnhanceAudioJobData) {
  return enhanceAudioQueue.add('enhance-audio', data, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  });
}
```

**Step 2: Commit**

```bash
git add packages/api/src/services/queue.ts
git commit -m "feat: add enhance-audio BullMQ queue"
```

---

### Task 4: Add separate-audio API endpoint

**Files:**
- Modify: `packages/api/src/routes/projects.ts`

**Step 1: Add the endpoint**

Add import for the new queue function at line 8:

```typescript
import { queueTranscribeJob, queueRenderJob, queueEnhanceAudioJob } from '../services/queue.js';
```

Add the endpoint before the `// Get download URL` comment (around line 300):

```typescript
  // Separate audio from video and enhance
  fastify.post('/projects/:id/separate-audio', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({
      videoItemId: z.string(),
    }).parse(request.body);

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, id),
    });

    if (!project) {
      return reply.status(404).send({ error: 'Project not found' });
    }

    if (!project.videoKey) {
      return reply.status(400).send({ error: 'No video uploaded' });
    }

    // Create audio track
    const [audioTrack] = await db.insert(tracks).values({
      projectId: id,
      type: 'audio',
      name: 'Audio',
      position: 2,
    }).returning();

    // Create audio timeline item (spans full video duration)
    const [audioItem] = await db.insert(timelineItems).values({
      trackId: audioTrack.id,
      type: 'audio',
      startMs: 0,
      endMs: project.durationMs || 0,
      data: {
        src: '',
        originalSrc: '',
        isEnhanced: false,
        sourceVideoItemId: body.videoItemId,
        volume: 1,
        enhancementStatus: 'processing',
        enhancementProgress: 0,
      },
    }).returning();

    // Create job record
    const [job] = await db.insert(jobs).values({
      projectId: id,
      type: 'enhance-audio',
      status: 'pending',
    }).returning();

    // Queue the enhancement job
    await queueEnhanceAudioJob({
      projectId: id,
      jobId: job.id,
      videoKey: project.videoKey,
      audioTrackId: audioTrack.id,
      audioItemId: audioItem.id,
      videoItemId: body.videoItemId,
    });

    return {
      jobId: job.id,
      trackId: audioTrack.id,
      itemId: audioItem.id,
    };
  });
```

**Step 2: Commit**

```bash
git add packages/api/src/routes/projects.ts
git commit -m "feat: add POST /projects/:id/separate-audio endpoint"
```

---

### Task 5: Add `separateAudio` API method to frontend client

**Files:**
- Modify: `apps/web/src/lib/api.ts`

**Step 1: Add response type and method**

Add the response interface after `DownloadResponse` (around line 78):

```typescript
export interface SeparateAudioResponse {
  jobId: string;
  trackId: string;
  itemId: string;
}
```

Add the method to `ApiClient` class after `renderProject` (around line 142):

```typescript
  async separateAudio(projectId: string, videoItemId: string): Promise<SeparateAudioResponse> {
    return this.request(`/api/projects/${projectId}/separate-audio`, {
      method: 'POST',
      body: JSON.stringify({ videoItemId }),
    });
  }
```

**Step 2: Commit**

```bash
git add apps/web/src/lib/api.ts
git commit -m "feat: add separateAudio API client method"
```

---

### Task 6: Write the Python enhancement script

**Files:**
- Create: `packages/worker/scripts/enhance_audio.py`
- Create: `packages/worker/scripts/requirements.txt`

**Step 1: Create scripts directory and requirements.txt**

```bash
mkdir -p packages/worker/scripts
```

`packages/worker/scripts/requirements.txt`:

```
deepfilternet>=0.5.6
pyloudnorm>=0.1.1
soundfile>=0.12.1
numpy>=1.24.0
```

**Step 2: Write enhance_audio.py**

```python
#!/usr/bin/env python3
"""
Audio enhancement pipeline for Reelify.
Uses DeepFilterNet3 for noise removal, FFmpeg for EQ/compression,
and pyloudnorm for loudness normalization to Instagram standards.

Usage:
  python enhance_audio.py --input raw.wav --output enhanced.wav [--lufs -14]
"""

import sys
import argparse
import subprocess
import tempfile
import os

import numpy as np
import soundfile as sf
import pyloudnorm as pyln


def emit_progress(percent: int, message: str):
    """Emit progress in format the Node worker can parse."""
    print(f"PROGRESS:{percent}%:{message}", file=sys.stderr, flush=True)


def dc_offset_and_normalize(audio: np.ndarray) -> np.ndarray:
    """Remove DC offset and peak-normalize to -1 dBFS."""
    audio = audio - np.mean(audio)
    peak = np.max(np.abs(audio))
    if peak > 0:
        audio = audio / peak * 0.891  # -1 dBFS
    return audio


def run_deepfilternet(input_path: str, output_path: str):
    """Run DeepFilterNet3 noise removal."""
    from df.enhance import enhance, init_df, load_audio, save_audio

    model, df_state, _ = init_df()
    audio, _ = load_audio(input_path, sr=df_state.sr())
    enhanced = enhance(model, df_state, audio)
    save_audio(output_path, enhanced, sr=df_state.sr())


def run_eq_chain(input_path: str, output_path: str):
    """Run FFmpeg EQ, compression, and limiting."""
    cmd = [
        "ffmpeg", "-y", "-i", input_path, "-af",
        ",".join([
            "highpass=f=80",
            "lowpass=f=12000",
            "equalizer=f=200:t=q:w=1.5:g=-2",
            "equalizer=f=3000:t=q:w=2:g=2",
            "equalizer=f=5000:t=q:w=2:g=1",
            "acompressor=threshold=0.1:ratio=4:attack=5:release=50:makeup=2:knee=4",
            "alimiter=limit=0.89",
        ]),
        "-ar", "48000", output_path,
    ]
    subprocess.run(cmd, check=True, capture_output=True)


def loudness_normalize(input_path: str, output_path: str, target_lufs: float = -14.0):
    """Normalize loudness to target LUFS and clamp true peak to -1 dBTP."""
    data, rate = sf.read(input_path)
    meter = pyln.Meter(rate)
    loudness = meter.integrated_loudness(data)

    # Normalize to target LUFS
    normalized = pyln.normalize.loudness(data, loudness, target_lufs)

    # Clamp true peak to -1 dBTP (0.891 linear)
    peak = np.max(np.abs(normalized))
    if peak > 0.891:
        normalized = normalized / peak * 0.891

    sf.write(output_path, normalized, rate)


def main():
    parser = argparse.ArgumentParser(description="Enhance speech audio for Instagram")
    parser.add_argument("--input", required=True, help="Input WAV file (48kHz)")
    parser.add_argument("--output", required=True, help="Output WAV file (enhanced)")
    parser.add_argument("--lufs", type=float, default=-14.0, help="Target loudness in LUFS (default: -14)")
    args = parser.parse_args()

    tmp_dir = tempfile.mkdtemp(prefix="reelify-enhance-")

    try:
        # Step 1: DC offset removal + peak normalize
        emit_progress(5, "Preprocessing audio")
        audio, sr = sf.read(args.input)
        audio = dc_offset_and_normalize(audio)
        prepped_path = os.path.join(tmp_dir, "prepped.wav")
        sf.write(prepped_path, audio, sr)
        emit_progress(10, "Preprocessing complete")

        # Step 2: DeepFilterNet3 noise removal
        emit_progress(15, "Running DeepFilterNet3")
        denoised_path = os.path.join(tmp_dir, "denoised.wav")
        run_deepfilternet(prepped_path, denoised_path)
        emit_progress(60, "Noise removal complete")

        # Step 3: EQ + compression + limiting
        emit_progress(65, "Applying EQ and compression")
        eq_path = os.path.join(tmp_dir, "eq.wav")
        run_eq_chain(denoised_path, eq_path)
        emit_progress(75, "EQ complete")

        # Step 4: Loudness normalization
        emit_progress(80, "Normalizing loudness")
        loudness_normalize(eq_path, args.output, target_lufs=args.lufs)
        emit_progress(95, "Loudness normalization complete")

        emit_progress(100, "Enhancement complete")

    except Exception as e:
        print(f"ERROR:{str(e)}", file=sys.stderr, flush=True)
        sys.exit(1)
    finally:
        # Cleanup temp files
        import shutil
        shutil.rmtree(tmp_dir, ignore_errors=True)


if __name__ == "__main__":
    main()
```

**Step 3: Commit**

```bash
git add packages/worker/scripts/
git commit -m "feat: add Python audio enhancement script (DeepFilterNet3 + loudness normalization)"
```

---

### Task 7: Write the enhance-audio worker processor

**Files:**
- Create: `packages/worker/src/processors/enhance-audio.ts`

**Step 1: Write the processor**

```typescript
import { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { nanoid } from 'nanoid';
import { spawn } from 'child_process';
import ffmpeg from 'fluent-ffmpeg';
import { db, jobs, timelineItems } from '../db/index.js';
import { downloadFile, uploadFile } from '../services/minio.js';
import { publishJobProgress, publishJobComplete, publishJobError } from '../services/redis.js';
import { config } from '../config.js';

export interface EnhanceAudioJobData {
  projectId: string;
  jobId: string;
  videoKey: string;
  audioTrackId: string;
  audioItemId: string;
  videoItemId: string;
}

/**
 * Extract audio from video as 48kHz WAV mono
 */
function extractAudio48k(videoPath: string, audioPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .outputOptions([
        '-vn',
        '-acodec', 'pcm_s16le',
        '-ar', '48000',
        '-ac', '1',
      ])
      .output(audioPath)
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run();
  });
}

/**
 * Transcode WAV to AAC m4a
 */
function transcodeToAac(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        '-c:a', 'aac',
        '-b:a', '192k',
        '-ar', '48000',
      ])
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run();
  });
}

/**
 * Run the Python enhancement script as a subprocess
 */
function runEnhancementScript(
  inputPath: string,
  outputPath: string,
  onProgress: (percent: number, message: string) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const scriptPath = join(process.cwd(), 'scripts', 'enhance_audio.py');
    const proc = spawn('python', [
      scriptPath,
      '--input', inputPath,
      '--output', outputPath,
      '--lufs', '-14',
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stderr = '';

    proc.stderr.on('data', (data: Buffer) => {
      const text = data.toString();
      stderr += text;

      // Parse progress lines: PROGRESS:XX%:message
      const lines = text.split('\n');
      for (const line of lines) {
        const match = line.match(/^PROGRESS:(\d+)%:(.+)$/);
        if (match) {
          onProgress(parseInt(match[1], 10), match[2]);
        }
        // Check for error
        if (line.startsWith('ERROR:')) {
          reject(new Error(line.slice(6)));
        }
      }
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Enhancement script exited with code ${code}: ${stderr}`));
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to start enhancement script: ${err.message}`));
    });
  });
}

export async function processEnhanceAudioJob(job: Job<EnhanceAudioJobData>) {
  const { projectId, jobId, videoKey, audioTrackId, audioItemId, videoItemId } = job.data;
  const workDir = join(tmpdir(), `reelify-enhance-${nanoid()}`);

  try {
    await mkdir(workDir, { recursive: true });

    const videoPath = join(workDir, 'video.mp4');
    const rawAudioPath = join(workDir, 'raw.wav');
    const enhancedWavPath = join(workDir, 'enhanced.wav');
    const originalM4aPath = join(workDir, 'original.m4a');
    const enhancedM4aPath = join(workDir, 'enhanced.m4a');

    // Update job status
    await db.update(jobs)
      .set({ status: 'processing', progress: 0 })
      .where(eq(jobs.id, jobId));

    // Step 1: Download video (0-10%)
    await publishJobProgress(jobId, 2, 'Downloading video...');
    await downloadFile(config.minio.buckets.uploads, videoKey, videoPath);
    await publishJobProgress(jobId, 10, 'Video downloaded');

    // Step 2: Extract audio as 48kHz WAV (10-15%)
    await publishJobProgress(jobId, 12, 'Extracting audio...');
    await extractAudio48k(videoPath, rawAudioPath);
    await publishJobProgress(jobId, 15, 'Audio extracted');

    // Step 3: Run Python enhancement pipeline (15-75%)
    // The Python script emits progress from 5-100%, we map to 15-75%
    await runEnhancementScript(rawAudioPath, enhancedWavPath, (percent, message) => {
      const mappedProgress = 15 + Math.round(percent * 0.6); // 15-75%
      publishJobProgress(jobId, mappedProgress, message);
    });
    await publishJobProgress(jobId, 75, 'Enhancement complete');

    // Step 4: Transcode to AAC (75-85%)
    await publishJobProgress(jobId, 77, 'Transcoding original to AAC...');
    await transcodeToAac(rawAudioPath, originalM4aPath);
    await publishJobProgress(jobId, 80, 'Transcoding enhanced to AAC...');
    await transcodeToAac(enhancedWavPath, enhancedM4aPath);
    await publishJobProgress(jobId, 85, 'Transcoding complete');

    // Step 5: Upload to MinIO (85-95%)
    const originalKey = `${projectId}/audio/original-${nanoid(8)}.m4a`;
    const enhancedKey = `${projectId}/audio/enhanced-${nanoid(8)}.m4a`;

    await publishJobProgress(jobId, 87, 'Uploading original audio...');
    await uploadFile(config.minio.buckets.outputs, originalKey, originalM4aPath);
    await publishJobProgress(jobId, 90, 'Uploading enhanced audio...');
    await uploadFile(config.minio.buckets.outputs, enhancedKey, enhancedM4aPath);
    await publishJobProgress(jobId, 95, 'Upload complete');

    // Step 6: Update database (95-100%)
    await publishJobProgress(jobId, 97, 'Updating project...');

    // Update the audio timeline item with the file URLs
    await db.update(timelineItems)
      .set({
        data: {
          src: enhancedKey,
          originalSrc: originalKey,
          enhancedSrc: enhancedKey,
          isEnhanced: true,
          sourceVideoItemId: videoItemId,
          volume: 1,
          enhancementStatus: 'complete',
          enhancementProgress: 100,
        },
        updatedAt: new Date(),
      })
      .where(eq(timelineItems.id, audioItemId));

    // Mark job complete
    await db.update(jobs)
      .set({ status: 'complete', progress: 100, completedAt: new Date() })
      .where(eq(jobs.id, jobId));

    await publishJobProgress(jobId, 100, 'Complete');
    await publishJobComplete(jobId, projectId);

    console.log(`Audio enhancement complete for project ${projectId}`);

  } catch (error) {
    console.error(`Audio enhancement failed for project ${projectId}:`, error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Update audio item to error state
    await db.update(timelineItems)
      .set({
        data: {
          src: '',
          originalSrc: '',
          isEnhanced: false,
          sourceVideoItemId: videoItemId,
          volume: 1,
          enhancementStatus: 'error',
        },
        updatedAt: new Date(),
      })
      .where(eq(timelineItems.id, audioItemId));

    await db.update(jobs)
      .set({ status: 'failed', error: errorMessage })
      .where(eq(jobs.id, jobId));

    await publishJobError(jobId, errorMessage);

    throw error;
  } finally {
    try {
      await rm(workDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}
```

**Step 2: Commit**

```bash
git add packages/worker/src/processors/enhance-audio.ts
git commit -m "feat: add enhance-audio worker processor"
```

---

### Task 8: Register enhance-audio worker

**Files:**
- Modify: `packages/worker/src/index.ts`

**Step 1: Add import and worker registration**

Add import at line 3:

```typescript
import { processEnhanceAudioJob, EnhanceAudioJobData } from './processors/enhance-audio.js';
```

Add the new worker after the render worker block (before `console.log('Worker started...')` at line 63):

```typescript
  // Enhance audio worker
  const enhanceAudioWorker = new Worker<EnhanceAudioJobData>(
    'enhance-audio',
    async (job) => {
      console.log(`Processing enhance-audio job ${job.id} for project ${job.data.projectId}`);
      await processEnhanceAudioJob(job);
    },
    {
      connection,
      concurrency: 1,
    }
  );

  enhanceAudioWorker.on('completed', (job) => {
    console.log(`Enhance-audio job ${job.id} completed`);
  });

  enhanceAudioWorker.on('failed', (job, err) => {
    console.error(`Enhance-audio job ${job?.id} failed:`, err);
  });
```

Update the shutdown handler to include the new worker:

```typescript
  const shutdown = async () => {
    console.log('Shutting down worker...');
    await transcribeWorker.close();
    await renderWorker.close();
    await enhanceAudioWorker.close();
    process.exit(0);
  };
```

**Step 2: Commit**

```bash
git add packages/worker/src/index.ts
git commit -m "feat: register enhance-audio worker in main entry"
```

---

### Task 9: Add `separateAudio` and `toggleEnhancement` store actions

**Files:**
- Modify: `apps/web/src/features/editor-v2/store/editor-store.ts`

**Step 1: Add the audio separation actions**

Add import for `AudioItemData` and `VideoItemData` at line 21 (in the existing import block from `./types`):

```typescript
import {
  EditorStore,
  EditorState,
  Track,
  TimelineItem,
  HistoryEntry,
  DEFAULT_TRACK_HEIGHT,
  DEFAULT_ZOOM,
  DEFAULT_FPS,
  DEFAULT_VIDEO_SETTINGS,
  DEFAULT_CAPTION_STYLE,
  CaptionItemData,
  VideoItemData,
  AudioItemData,
  VideoSettings,
  CaptionStyle,
} from './types';
```

Add the new actions inside the `immer((set, get) => ({` block, after `reorderTracks` (before the closing `}))` at line 725):

```typescript
    // ========================================
    // Audio Separation Actions
    // ========================================

    separateAudio: async (videoItemId: string) => {
      const { project, items } = get();
      if (!project) return;

      const videoItem = items[videoItemId];
      if (!videoItem || videoItem.type !== 'video') return;

      try {
        // Call API to start separation
        const response = await api.separateAudio(project.id, videoItemId);

        // Optimistically add audio track and item
        const audioTrackId = response.trackId;
        const audioItemId = response.itemId;

        set((state) => {
          // Add audio track
          const newTrack: Track = {
            id: audioTrackId,
            type: 'audio',
            name: 'Audio',
            position: state.tracks.length,
            locked: false,
            visible: true,
            height: DEFAULT_TRACK_HEIGHT,
            collapsed: false,
          };
          state.tracks.push(newTrack);
          state.tracks.sort((a, b) => a.position - b.position);

          // Add audio item (processing state)
          const audioItem: TimelineItem = {
            id: audioItemId,
            type: 'audio',
            trackId: audioTrackId,
            startMs: videoItem.startMs,
            endMs: videoItem.endMs,
            data: {
              src: '',
              originalSrc: '',
              isEnhanced: false,
              sourceVideoItemId: videoItemId,
              volume: 1,
              enhancementStatus: 'processing',
              enhancementProgress: 0,
            } as AudioItemData,
          };
          state.items[audioItemId] = audioItem;
          state.itemIds.push(audioItemId);

          // Mute the video item
          const vid = state.items[videoItemId];
          if (vid) {
            (vid.data as VideoItemData).muted = true;
            (vid.data as VideoItemData).separatedAudioItemId = audioItemId;
          }
        });

        get().pushHistory();
      } catch (err) {
        set((state) => {
          state.error = err instanceof Error ? err.message : 'Failed to separate audio';
        });
      }
    },

    toggleEnhancement: (audioItemId: string) => {
      set((state) => {
        const item = state.items[audioItemId];
        if (!item || item.type !== 'audio') return;

        const data = item.data as AudioItemData;
        if (!data.enhancedSrc || !data.originalSrc) return;

        // Toggle between enhanced and original
        data.isEnhanced = !data.isEnhanced;
        data.src = data.isEnhanced ? data.enhancedSrc : data.originalSrc;
      });

      get().pushHistory();
    },

    updateEnhancementStatus: (
      audioItemId: string,
      status: AudioItemData['enhancementStatus'],
      progress?: number,
      enhancedSrc?: string
    ) => {
      set((state) => {
        const item = state.items[audioItemId];
        if (!item || item.type !== 'audio') return;

        const data = item.data as AudioItemData;
        data.enhancementStatus = status;
        if (progress !== undefined) data.enhancementProgress = progress;
        if (enhancedSrc) {
          data.enhancedSrc = enhancedSrc;
          data.src = enhancedSrc;
          data.isEnhanced = true;
        }
      });
    },
```

**Step 2: Commit**

```bash
git add apps/web/src/features/editor-v2/store/editor-store.ts
git commit -m "feat: add separateAudio and toggleEnhancement store actions"
```

---

### Task 10: Add audio context to ContextPanel

**Files:**
- Modify: `apps/web/src/features/editor-v2/components/ContextPanel.tsx`

**Step 1: Add video panel audio separation button and audio panel**

Add imports at top (add to the existing import from `../store/types`):

```typescript
import { AudioItemData, VideoItemData } from '../store/types';
```

Add `useEditorActions` usage: it's already imported. Add `useItems` to the import from `../store/use-editor-store`:

```typescript
import {
  useSelectedIds,
  useItem,
  useFirstCaptionStyle,
  useVideoSettings,
  useEditorActions,
} from '../store/use-editor-store';
```

Update the panel title logic at line 52 to include audio:

```typescript
  const panelTitle = firstSelectedItem.type === 'caption' ? 'Caption Style' :
                     firstSelectedItem.type === 'video' ? 'Video' :
                     firstSelectedItem.type === 'audio' ? 'Audio' :
                     'Properties';
```

Add audio panel render in the content section (around line 79):

```typescript
        {firstSelectedItem.type === 'caption' && <CaptionStylePanel />}
        {firstSelectedItem.type === 'video' && <VideoPanel />}
        {firstSelectedItem.type === 'audio' && <AudioPanel />}
```

**Step 2: Create the VideoPanel (replaces VideoPositionPanel call)**

Rename `VideoPositionPanel` to `VideoPanel` and add the separation button. Replace the existing `VideoPositionPanel` function:

```typescript
function VideoPanel() {
  const selectedIds = useSelectedIds();
  const videoItem = useItem(selectedIds[0] || '');
  const videoSettings = useVideoSettings();
  const { updateVideoSettings, separateAudio } = useEditorActions();
  const [isSeparating, setIsSeparating] = useState(false);

  if (!videoSettings || !videoItem) return null;

  const videoData = videoItem.data as VideoItemData;
  const isAudioSeparated = !!videoData.muted;

  const handleSeparateAudio = async () => {
    setIsSeparating(true);
    await separateAudio(videoItem.id);
    setIsSeparating(false);
  };

  return (
    <div className="p-4 space-y-6">
      {/* Audio Separation */}
      {!isAudioSeparated && (
        <Section label="Audio">
          <button
            onClick={handleSeparateAudio}
            disabled={isSeparating}
            className="w-full py-2 px-3 text-sm font-medium rounded-md
                       bg-[var(--editor-accent)] text-white
                       hover:opacity-90 transition-opacity
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSeparating ? 'Separating...' : 'Separate Audio'}
          </button>
          <p className="text-xs text-[var(--editor-text-muted)]">
            Extract audio into its own track with automatic enhancement
          </p>
        </Section>
      )}

      {isAudioSeparated && (
        <Section label="Audio">
          <div className="flex items-center gap-2 py-1 px-2 rounded bg-[var(--editor-bg-elevated)]">
            <span className="text-xs text-[var(--editor-text-muted)]">
              Audio separated — video is muted
            </span>
          </div>
        </Section>
      )}

      <Divider />

      {/* Horizontal Position */}
      <Section label="Horizontal Pan">
        <div className="flex items-center gap-3">
          <Slider
            value={[videoSettings.cropX]}
            min={0}
            max={100}
            step={1}
            onValueChange={([cropX]) => updateVideoSettings({ cropX })}
            className="flex-1"
          />
          <span className="text-xs text-[var(--editor-text-secondary)] w-10 text-right">
            {videoSettings.cropX}%
          </span>
        </div>
      </Section>

      {/* Vertical Position */}
      <Section label="Vertical Pan">
        <div className="flex items-center gap-3">
          <Slider
            value={[videoSettings.cropY]}
            min={0}
            max={100}
            step={1}
            onValueChange={([cropY]) => updateVideoSettings({ cropY })}
            className="flex-1"
          />
          <span className="text-xs text-[var(--editor-text-secondary)] w-10 text-right">
            {videoSettings.cropY}%
          </span>
        </div>
      </Section>

      <Divider />

      {/* Zoom */}
      <Section label="Zoom">
        <div className="flex items-center gap-3">
          <Slider
            value={[videoSettings.scale * 100]}
            min={100}
            max={200}
            step={5}
            onValueChange={([scale]) => updateVideoSettings({ scale: scale / 100 })}
            className="flex-1"
          />
          <span className="text-xs text-[var(--editor-text-secondary)] w-10 text-right">
            {Math.round(videoSettings.scale * 100)}%
          </span>
        </div>
      </Section>

      {/* Reset button */}
      <button
        onClick={() => updateVideoSettings({ cropX: 50, cropY: 50, scale: 1 })}
        className="w-full py-2 text-sm text-[var(--editor-text-secondary)]
                   hover:text-[var(--editor-text-primary)] hover:bg-[var(--editor-bg-hover)]
                   rounded transition-colors"
      >
        Reset to center
      </button>
    </div>
  );
}
```

**Step 3: Create the AudioPanel**

```typescript
function AudioPanel() {
  const selectedIds = useSelectedIds();
  const audioItem = useItem(selectedIds[0] || '');
  const { toggleEnhancement, updateItemData } = useEditorActions();

  if (!audioItem || audioItem.type !== 'audio') return null;

  const data = audioItem.data as AudioItemData;
  const isProcessing = data.enhancementStatus === 'processing';
  const isComplete = data.enhancementStatus === 'complete';
  const isError = data.enhancementStatus === 'error';

  return (
    <div className="p-4 space-y-6">
      {/* Enhancement Status */}
      <Section label="Enhancement">
        {isProcessing && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[var(--editor-accent)] animate-pulse" />
              <span className="text-xs text-[var(--editor-text-secondary)]">
                Enhancing audio... {data.enhancementProgress || 0}%
              </span>
            </div>
            <div className="w-full h-1 bg-[var(--editor-bg-elevated)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--editor-accent)] transition-all duration-300"
                style={{ width: `${data.enhancementProgress || 0}%` }}
              />
            </div>
          </div>
        )}

        {isComplete && (
          <button
            onClick={() => toggleEnhancement(audioItem.id)}
            className={`w-full py-2 px-3 text-sm font-medium rounded-md transition-all ${
              data.isEnhanced
                ? 'bg-[var(--editor-accent)] text-white'
                : 'bg-[var(--editor-bg-elevated)] text-[var(--editor-text-secondary)] border border-[var(--editor-border-default)]'
            }`}
          >
            {data.isEnhanced ? 'Enhanced ✓' : 'Use Original'}
          </button>
        )}

        {isError && (
          <div className="py-2 px-3 text-xs text-red-400 bg-red-900/20 rounded-md">
            Enhancement failed. Using original audio.
          </div>
        )}
      </Section>

      <Divider />

      {/* Volume */}
      <Section label="Volume">
        <div className="flex items-center gap-3">
          <Slider
            value={[data.volume * 100]}
            min={0}
            max={200}
            step={1}
            onValueChange={([vol]) => updateItemData(audioItem.id, { volume: vol / 100 })}
            className="flex-1"
          />
          <span className="text-xs text-[var(--editor-text-secondary)] w-10 text-right">
            {Math.round(data.volume * 100)}%
          </span>
        </div>
      </Section>
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add apps/web/src/features/editor-v2/components/ContextPanel.tsx
git commit -m "feat: add Separate Audio button and Audio panel to ContextPanel"
```

---

### Task 11: Add "Enhanced" badge to timeline canvas renderer

**Files:**
- Modify: `apps/web/src/features/editor-v2/timeline/canvas/CanvasRenderer.ts`

**Step 1: Update drawAudioItem to show enhancement badge**

Add `AudioItemData` to the import at line 8:

```typescript
import {
  Track,
  TimelineItem,
  Viewport,
  SelectionBox,
  DragState,
  CaptionItemData,
  AudioItemData,
  SnapTarget,
} from '../../store/types';
```

Replace the `drawAudioItem` method (around line 328) with:

```typescript
  private drawAudioItem(
    item: TimelineItem,
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    const { ctx, options } = this;
    const data = item.data as AudioItemData;

    // Draw simple waveform visualization
    ctx.strokeStyle = options.textColor;
    ctx.lineWidth = 1;
    ctx.beginPath();

    const waveHeight = height * 0.6;
    const centerY = y + height / 2;
    const steps = Math.min(width / 3, 50);

    for (let i = 0; i < steps; i++) {
      const xPos = x + (i / steps) * width;
      const amplitude = Math.sin(i * 0.5) * (waveHeight / 2) * 0.7;
      if (i === 0) {
        ctx.moveTo(xPos, centerY + amplitude);
      } else {
        ctx.lineTo(xPos, centerY + amplitude);
      }
    }
    ctx.stroke();

    // Draw enhancement badge or processing indicator
    if (data.enhancementStatus === 'processing') {
      // Pulsing indicator
      const badgeX = x + width - 70;
      const badgeY = y + 4;
      if (width > 80) {
        ctx.fillStyle = 'rgba(34, 197, 94, 0.3)'; // green with low opacity
        this.roundRect(badgeX, badgeY, 62, 18, 4);
        ctx.fill();
        ctx.fillStyle = '#22c55e';
        ctx.font = '10px system-ui, sans-serif';
        ctx.textBaseline = 'middle';
        ctx.fillText('Enhancing...', badgeX + 4, badgeY + 9);
      }
    } else if (data.isEnhanced && data.enhancementStatus === 'complete') {
      // Green "Enhanced" badge
      const badgeX = x + width - 68;
      const badgeY = y + 4;
      if (width > 80) {
        ctx.fillStyle = 'rgba(34, 197, 94, 0.2)';
        this.roundRect(badgeX, badgeY, 60, 18, 4);
        ctx.fill();
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 1;
        this.roundRect(badgeX, badgeY, 60, 18, 4);
        ctx.stroke();
        ctx.fillStyle = '#22c55e';
        ctx.font = 'bold 10px system-ui, sans-serif';
        ctx.textBaseline = 'middle';
        ctx.fillText('Enhanced', badgeX + 6, badgeY + 9);
      }
    }
  }
```

**Step 2: Also add muted indicator to drawVideoItem**

Update `drawVideoItem` to show muted state. Add `VideoItemData` to the import:

```typescript
import {
  Track,
  TimelineItem,
  Viewport,
  SelectionBox,
  DragState,
  CaptionItemData,
  AudioItemData,
  VideoItemData,
  SnapTarget,
} from '../../store/types';
```

In `drawVideoItem`, add after the label drawing (around line 325):

```typescript
    // Muted indicator
    const videoData = item.data as VideoItemData;
    if (videoData.muted && width > 120) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = '10px system-ui, sans-serif';
      ctx.fillText('🔇 Muted', x + padding + iconSize + 50, y + height / 2);
    }
```

**Step 3: Commit**

```bash
git add apps/web/src/features/editor-v2/timeline/canvas/CanvasRenderer.ts
git commit -m "feat: add Enhanced badge and muted indicator to timeline canvas"
```

---

### Task 12: Export `separateAudio` and `toggleEnhancement` from the store hooks

**Files:**
- Modify: `apps/web/src/features/editor-v2/store/use-editor-store.ts`

**Step 1: Check and update the store hooks file**

Read the file to understand the current exports, then add the new actions to the `useEditorActions` hook if it exists, or export them.

The new actions (`separateAudio`, `toggleEnhancement`, `updateEnhancementStatus`) should be accessible through `useEditorActions()` which already returns all actions from the store. Since they're added to the store in Task 9, they should automatically be available. Verify the hook re-exports the full store.

**Step 2: Commit (if changes needed)**

```bash
git add apps/web/src/features/editor-v2/store/use-editor-store.ts
git commit -m "feat: export audio separation actions from store hooks"
```

---

### Task 13: Handle WebSocket enhancement progress in the editor

**Files:**
- Modify: `apps/web/src/features/editor-v2/Editor.tsx`

**Step 1: Add WebSocket listener for enhance-audio job progress**

The editor component needs to listen for WebSocket messages and update the audio item's enhancement progress. Read the current Editor.tsx to find where WebSocket connections are set up, then add handling for `job:progress` and `job:complete` events that update the audio item via `updateEnhancementStatus`.

Add a `useEffect` in the Editor component that connects to the WebSocket and handles `enhance-audio` job events:

```typescript
// Inside the Editor component, add a useEffect for WebSocket enhancement progress
useEffect(() => {
  // Listen for enhancement job updates via WebSocket
  // When job:progress arrives with enhance-audio type, call updateEnhancementStatus
  // When job:complete arrives, update with final enhancedSrc URL
}, []);
```

The exact integration depends on the current WebSocket setup in Editor.tsx. Read the file and adapt accordingly.

**Step 2: Commit**

```bash
git add apps/web/src/features/editor-v2/Editor.tsx
git commit -m "feat: handle WebSocket enhance-audio progress events in editor"
```

---

### Task 14: Add Python enhancement setup script

**Files:**
- Create: `packages/worker/scripts/setup-enhance.sh`
- Create: `packages/worker/scripts/setup-enhance.bat`

**Step 1: Create setup scripts**

`packages/worker/scripts/setup-enhance.sh`:

```bash
#!/bin/bash
set -e

echo "Setting up audio enhancement dependencies..."

# Create virtual environment if it doesn't exist
if [ ! -d "venv-enhance" ]; then
  python -m venv venv-enhance
fi

# Activate and install
source venv-enhance/bin/activate
pip install -r scripts/requirements.txt

echo "Audio enhancement setup complete!"
```

`packages/worker/scripts/setup-enhance.bat`:

```batch
@echo off
echo Setting up audio enhancement dependencies...

if not exist "venv-enhance" (
  python -m venv venv-enhance
)

call venv-enhance\Scripts\activate.bat
pip install -r scripts\requirements.txt

echo Audio enhancement setup complete!
```

**Step 2: Add setup script to worker package.json**

Add to the `scripts` section of `packages/worker/package.json`:

```json
"enhance:setup": "bash ./scripts/setup-enhance.sh",
"enhance:setup:win": ".\\scripts\\setup-enhance.bat"
```

**Step 3: Commit**

```bash
git add packages/worker/scripts/setup-enhance.sh packages/worker/scripts/setup-enhance.bat packages/worker/package.json
git commit -m "feat: add setup scripts for audio enhancement Python dependencies"
```

---

### Task 15: Handle audio track deletion (unmute video)

**Files:**
- Modify: `apps/web/src/features/editor-v2/store/editor-store.ts`

**Step 1: Update `deleteTrack` to unmute linked video**

Find the existing `deleteTrack` action (around line 689) and update it to check if the deleted track contains audio items with `sourceVideoItemId`. If so, unmute the linked video item:

Update the `deleteTrack` action:

```typescript
    deleteTrack: (id) => {
      set((state) => {
        // Find items on this track that might be linked audio
        const itemsOnTrack = state.itemIds
          .map((itemId) => state.items[itemId])
          .filter((item) => item?.trackId === id);

        // If any are audio items linked to video, unmute the video
        for (const item of itemsOnTrack) {
          if (item?.type === 'audio') {
            const audioData = item.data as AudioItemData;
            if (audioData.sourceVideoItemId) {
              const videoItem = state.items[audioData.sourceVideoItemId];
              if (videoItem) {
                (videoItem.data as VideoItemData).muted = false;
                (videoItem.data as VideoItemData).separatedAudioItemId = undefined;
              }
            }
          }
        }

        // Delete all items on this track
        const itemsToDelete = state.itemIds.filter(
          (itemId) => state.items[itemId]?.trackId === id
        );
        for (const itemId of itemsToDelete) {
          delete state.items[itemId];
          state.selectedIds = state.selectedIds.filter((sId) => sId !== itemId);
        }
        state.itemIds = state.itemIds.filter((itemId) => !itemsToDelete.includes(itemId));

        // Delete track
        state.tracks = state.tracks.filter((t) => t.id !== id);
      });

      get().pushHistory();
    },
```

**Step 2: Commit**

```bash
git add apps/web/src/features/editor-v2/store/editor-store.ts
git commit -m "feat: unmute video when linked audio track is deleted"
```

---

### Task 16: Test the enhancement pipeline

**Files:**
- Create: `packages/worker/src/processors/enhance-audio.test.ts`

**Step 1: Write unit tests for the processor helpers**

```typescript
import { describe, it, expect, vi } from 'vitest';

// Test the progress parsing logic used by runEnhancementScript
describe('enhance-audio progress parsing', () => {
  it('parses PROGRESS lines correctly', () => {
    const progressRegex = /^PROGRESS:(\d+)%:(.+)$/;

    const line1 = 'PROGRESS:15%:Running DeepFilterNet3';
    const match1 = line1.match(progressRegex);
    expect(match1).not.toBeNull();
    expect(match1![1]).toBe('15');
    expect(match1![2]).toBe('Running DeepFilterNet3');

    const line2 = 'PROGRESS:100%:Enhancement complete';
    const match2 = line2.match(progressRegex);
    expect(match2).not.toBeNull();
    expect(match2![1]).toBe('100');
    expect(match2![2]).toBe('Enhancement complete');
  });

  it('does not match non-progress lines', () => {
    const progressRegex = /^PROGRESS:(\d+)%:(.+)$/;

    expect('Some random output'.match(progressRegex)).toBeNull();
    expect('ERROR:something went wrong'.match(progressRegex)).toBeNull();
    expect(''.match(progressRegex)).toBeNull();
  });
});

describe('enhance-audio progress mapping', () => {
  it('maps Python progress (0-100) to job progress (15-75)', () => {
    const mapProgress = (percent: number) => 15 + Math.round(percent * 0.6);

    expect(mapProgress(0)).toBe(15);
    expect(mapProgress(50)).toBe(45);
    expect(mapProgress(100)).toBe(75);
  });
});
```

**Step 2: Run tests**

```bash
cd packages/worker && npx vitest run src/processors/enhance-audio.test.ts
```

Expected: PASS

**Step 3: Commit**

```bash
git add packages/worker/src/processors/enhance-audio.test.ts
git commit -m "test: add unit tests for enhance-audio progress parsing"
```

---

### Task 17: Final integration verification

**Step 1: Verify TypeScript compiles**

```bash
cd packages/shared && npx tsc --noEmit
cd packages/worker && npx tsc --noEmit
cd packages/api && npx tsc --noEmit
cd apps/web && npx tsc --noEmit
```

Fix any type errors.

**Step 2: Run all tests**

```bash
cd packages/worker && npx vitest run
```

**Step 3: Final commit if any fixes**

```bash
git add -A
git commit -m "fix: resolve type errors from audio separation integration"
```
