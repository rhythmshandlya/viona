import { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { existsSync } from 'fs';
import { mkdir, rm, readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { nanoid } from 'nanoid';

import { db, jobs } from '../db/index.js';
import { downloadFile, uploadFile } from '../services/minio.js';
import { logger } from '../logger.js';
import { publishJobProgress, publishJobComplete, publishJobError } from '../services/redis.js';
import { config } from '../config.js';
import { runSubprocess } from '../utils/subprocess.js';

const execFileAsync = promisify(execFile);
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
  /** All overlay scene ranges for background generation (one matte, N bg images) */
  bgRanges?: Array<{ sceneId: string; startMs: number; endMs: number }>;
  callbackUrl?: string;
  callbackSecret?: string;
}

export async function processSegmentationJob(job: Job<SegmentationJobData>) {
  const { projectId, jobId, videoKey, startMs, endMs, sceneId, outputKey, bgRanges, callbackUrl, callbackSecret } = job.data;
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

    // Step 2: Run segment_person.py on overlay ranges only (10-80%)
    // Only processes frames within overlay scene ranges (where matte is needed).
    // Frames outside these ranges get black matte (no model inference).
    // Maintains 1:1 frame correspondence with source at native frame rate.
    await publishJobProgress(jobId, 12, 'Running person segmentation...', pubExtras);

    const mattePath = join(workDir, 'matte.mp4');

    // Build bg ranges — use bgRanges if provided, otherwise fall back to single scene
    const effectiveBgRanges = bgRanges ?? [{ sceneId, startMs, endMs }];

    // Resolve script path (same pattern as head-tracking.ts)
    // In prod (tsup bundle): __dirname = .../dist → one level up
    // In dev (tsx):           __dirname = .../src/processors → two levels up
    let resolvedScriptPath = join(__dirname, '..', 'scripts', 'segment_person.py');
    if (!existsSync(resolvedScriptPath)) {
      resolvedScriptPath = join(__dirname, '..', '..', 'scripts', 'segment_person.py');
    }

    await runSegmentation(
      videoPath,
      mattePath,
      resolvedScriptPath,
      jobId,
      projectId,
      sceneId,
      effectiveBgRanges,
      workDir,
    );

    await publishJobProgress(jobId, 80, 'Segmentation complete', pubExtras);

    // Step 4: Upload matte + bbox to MinIO (90%)
    await publishJobProgress(jobId, 85, 'Uploading matte...', pubExtras);
    await uploadFile('outputs', outputKey, mattePath);

    // Upload matte-bbox.json (written by segment_person.py alongside the matte)
    // Full video matte: sourceStartMs is always 0 (no clipping)
    const bboxPath = join(workDir, 'matte-bbox.json');
    const bboxKey = outputKey.replace(/\.mp4$/, '-bbox.json');
    if (existsSync(bboxPath)) {
      const bboxData = JSON.parse(await readFile(bboxPath, 'utf-8'));
      bboxData.sourceStartMs = 0;
      await writeFile(bboxPath, JSON.stringify(bboxData));
      await uploadFile('outputs', bboxKey, bboxPath);
      logger.info({ projectId, sceneId, bboxKey }, 'Matte bbox uploaded');
    }

    // Upload foreground video (written by segment_person.py alongside the matte)
    const fgrPath = mattePath.replace(/\.mp4$/, '-fgr.mp4');
    const fgrKey = outputKey.replace(/\.mp4$/, '-fgr.mp4');
    if (existsSync(fgrPath)) {
      await uploadFile('outputs', fgrKey, fgrPath);
      logger.info({ projectId, sceneId, fgrKey }, 'Foreground video uploaded');
    }

    // Generate and upload proxy files (low-res for editor preview)
    const matteProxyPath = mattePath.replace(/\.mp4$/, '-proxy.mp4');
    const fgrProxyPath = mattePath.replace(/\.mp4$/, '-fgr-proxy.mp4');
    const matteProxyKey = outputKey.replace(/\.mp4$/, '-proxy.mp4');
    const fgrProxyKey = outputKey.replace(/\.mp4$/, '-fgr-proxy.mp4');

    try {
      // Downscale matte to 480p proxy — keyframe every 1s for fast seeking in editor
      await execFileAsync('ffmpeg', [
        '-i', mattePath,
        '-vf', 'scale=-2:480',
        '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28',
        '-force_key_frames', 'expr:gte(t,n_forced*1)',
        '-y', matteProxyPath,
      ], { timeout: 30_000, cwd: workDir });

      if (existsSync(matteProxyPath)) {
        await uploadFile('outputs', matteProxyKey, matteProxyPath);
        logger.info({ matteProxyKey }, 'Matte proxy uploaded');
      }
    } catch (proxyErr) {
      logger.warn({ err: proxyErr }, 'Matte proxy generation failed (non-critical)');
    }

    if (existsSync(fgrPath)) {
      try {
        // Downscale fgr to 480p proxy — keyframe every 1s for fast seeking in editor
        await execFileAsync('ffmpeg', [
          '-i', fgrPath,
          '-vf', 'scale=-2:480',
          '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28',
          '-force_key_frames', 'expr:gte(t,n_forced*1)',
          '-y', fgrProxyPath,
        ], { timeout: 30_000, cwd: workDir });

        if (existsSync(fgrProxyPath)) {
          await uploadFile('outputs', fgrProxyKey, fgrProxyPath);
          logger.info({ fgrProxyKey }, 'FGR proxy uploaded');
        }
      } catch (proxyErr) {
        logger.warn({ err: proxyErr }, 'FGR proxy generation failed (non-critical)');
      }
    }

    // Upload background images (one per scene, generated by segment_person.py via OpenAI)
    const bgKeys: Record<string, string> = {};
    for (const range of effectiveBgRanges) {
      const bgPath = join(workDir, `bg-${range.sceneId}.png`);
      const bgKey = `projects/${projectId}/bg-${range.sceneId}.png`;
      if (existsSync(bgPath)) {
        await uploadFile('outputs', bgKey, bgPath);
        bgKeys[range.sceneId] = bgKey;
        logger.info({ projectId, sceneId: range.sceneId, bgKey }, 'Background image uploaded');
      }
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
            allSceneIds: effectiveBgRanges.map(r => r.sceneId),
            outputKey,
            bboxKey,
            fgrKey,
            bgKeys,
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
  videoPath: string,
  mattePath: string,
  scriptPath: string,
  jobId: string,
  projectId: string,
  sceneId: string,
  bgRanges: Array<{ sceneId: string; startMs: number; endMs: number }>,
  workDir: string,
): Promise<void> {
  // Force system python which has CUDA PyTorch. The scripts/.venv has CPU-only.
  // Resolve: PYTHON_PATH env > conda env python > bare 'python'
  const pythonPath = process.env.PYTHON_PATH
    || (process.env.CONDA_PREFIX ? join(process.env.CONDA_PREFIX, 'python.exe') : null)
    || 'python';
  logger.info({ pythonPath, CONDA_PREFIX: process.env.CONDA_PREFIX || 'unset', PYTHON_PATH: process.env.PYTHON_PATH || 'unset' }, 'Resolved python path');
  let expectedFrames = 0;

  // Build bg-ranges JSON for the script
  const bgRangesArg = JSON.stringify(bgRanges.map(r => ({
    sceneId: r.sceneId,
    startMs: r.startMs,
    endMs: r.endMs,
    output: join(workDir, `bg-${r.sceneId}.png`),
  })));

  // Matte ranges = time ranges that need actual RVM inference (overlay scenes).
  // Frames outside these ranges get black matte output with no GPU work.
  const matteRangesArg = JSON.stringify(bgRanges.map(r => ({
    startMs: r.startMs,
    endMs: r.endMs,
  })));

  logger.info({ pythonPath, scriptPath, videoPath, mattePath, scale: '1.0', matteRanges: bgRanges.length }, 'Starting segmentation subprocess');

  await runSubprocess({
    command: pythonPath,
    args: [
      scriptPath,
      videoPath,
      '--output', mattePath,
      '--backbone', 'resnet50',
      '--scale', '1.0',            // full resolution on GPU
      '--fps', '0',                 // 0 = use source native frame rate
      '--downsample-ratio', '0.8',
      '--bg-ranges', bgRangesArg,
      '--matte-ranges', matteRangesArg,
    ],
    timeoutMs: 15 * 60 * 1000,     // 15 min — 10 min was too tight (be06b344 killed at 96%)
    name: 'segmentation',
    onStdoutLine: (line) => {
      logger.info({ name: 'segmentation', line: line.trim() }, 'Python stdout');
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
    onStderrLine: (line) => {
      if (line.trim()) logger.warn({ name: 'segmentation', line: line.trim() }, 'Python stderr');
    },
  });
}
