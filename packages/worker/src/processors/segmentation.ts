import { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { existsSync } from 'fs';
import { mkdir, rm } from 'fs/promises';
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
    await publishJobProgress(jobId, 12, `Extracting ${startMs}ms\u2013${endMs}ms...`, pubExtras);
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
