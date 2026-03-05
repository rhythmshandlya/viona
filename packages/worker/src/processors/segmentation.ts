import { Job } from 'bullmq';
import { exec, spawn } from 'child_process';
import { mkdir, rm, readdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { promisify } from 'util';
import { nanoid } from 'nanoid';
import { getPythonPath } from '../utils/python.js';

const execAsync = promisify(exec);
import { eq } from 'drizzle-orm';
import { db, timelineItems } from '../db/index.js';
import { downloadFile, uploadFile } from '../services/minio.js';
import { publishJobProgress, publishJobComplete, publishJobError } from '../services/redis.js';
import { logger } from '../logger.js';

export interface SegmentationJobData {
  projectId: string;
  videoItemId: string;
  videoKey: string;
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

    await updateSegmentationStatus(projectId, videoItemId, 'processing', 0);
    await publishJobProgress(jobId, 5, 'Downloading video...');

    const videoPath = join(workDir, 'input.mp4');
    // downloadFile takes (prefix, key, destPath) - videoKey contains the full path
    // Split videoKey into prefix and key parts
    const keyParts = videoKey.split('/');
    const prefix = keyParts[0];
    const key = keyParts.slice(1).join('/');
    await downloadFile(prefix, key, videoPath);
    await publishJobProgress(jobId, 10, 'Extracting frames...');

    const framesDir = join(workDir, 'frames');
    await mkdir(framesDir);
    await extractFrames(videoPath, framesDir, 10);
    await publishJobProgress(jobId, 20, 'Running segmentation...');

    const masksDir = join(workDir, 'masks');
    await mkdir(masksDir);
    await runSAM2Segmentation(framesDir, masksDir, (progress) => {
      publishJobProgress(jobId, 20 + progress * 0.5, 'Segmenting speaker...');
    });
    await publishJobProgress(jobId, 70, 'Detecting faces...');

    const faceBboxTimeline = await detectFaces(framesDir);
    await publishJobProgress(jobId, 85, 'Uploading masks...');

    const maskKey = `videos/${projectId}/masks`;
    await uploadMaskDirectory(masksDir, maskKey);

    const result: SegmentationResult = {
      maskPath: maskKey,
      maskFps: 10,
      faceBboxTimeline,
    };
    await updateSegmentationStatus(projectId, videoItemId, 'ready', 100, result);
    await publishJobProgress(jobId, 100, 'Segmentation complete');
    await publishJobComplete(jobId, projectId, result as unknown as Record<string, unknown>);

    logger.info({ jobId, projectId }, 'Segmentation job completed');
  } catch (error) {
    logger.error({ jobId, projectId, error }, 'Segmentation job failed');
    await updateSegmentationStatus(projectId, videoItemId, 'failed', 0, undefined, String(error));
    await publishJobError(jobId, String(error));
    throw error;
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function extractFrames(videoPath: string, outputDir: string, fps: number): Promise<number> {
  const cmd = `ffmpeg -i "${videoPath}" -vf "fps=${fps}" -q:v 2 "${outputDir}/%04d.png"`;

  await execAsync(cmd, { maxBuffer: 50 * 1024 * 1024 });

  const files = await readdir(outputDir);
  const frameCount = files.filter(f => f.endsWith('.png')).length;

  logger.info({ frameCount, fps }, 'Extracted frames');
  return frameCount;
}

async function runSAM2Segmentation(
  framesDir: string,
  outputDir: string,
  onProgress: (progress: number) => void
): Promise<void> {
  const scriptPath = join(__dirname, '../scripts/sam2_segment.py');
  const device = process.env.SAM2_DEVICE || 'cuda';
  const pythonPath = getPythonPath();

  const proc = spawn(pythonPath, [scriptPath, framesDir, outputDir, '--device', device]);

  return new Promise((resolve, reject) => {
    proc.stdout.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const msg = JSON.parse(line);
          if (msg.progress !== undefined) {
            onProgress(msg.progress);
          }
        } catch {
          // Non-JSON output, ignore
        }
      }
    });

    proc.stderr.on('data', (data: Buffer) => {
      logger.warn({ output: data.toString() }, 'SAM2 stderr');
    });

    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`SAM2 script exited with code ${code}`));
    });

    proc.on('error', reject);
  });
}

async function detectFaces(framesDir: string): Promise<FaceBbox[]> {
  const scriptPath = join(__dirname, '../scripts/face_detect.py');
  const pythonPath = getPythonPath();

  const { stdout } = await execAsync(`"${pythonPath}" "${scriptPath}" "${framesDir}"`, {
    maxBuffer: 50 * 1024 * 1024
  });

  try {
    const results = JSON.parse(stdout);
    logger.info({ faceCount: results.length }, 'Face detection complete');
    return results;
  } catch (error) {
    logger.error({ error, stdout }, 'Failed to parse face detection output');
    return [];
  }
}

async function uploadMaskDirectory(localDir: string, remoteKeyPrefix: string): Promise<void> {
  const files = await readdir(localDir);
  const webpFiles = files.filter(f => f.endsWith('.webp'));
  for (const file of webpFiles) {
    const localPath = join(localDir, file);
    // uploadFile takes (prefix, key, srcPath)
    // remoteKeyPrefix is like "videos/{projectId}/masks"
    // We use 'outputs' as the storage prefix
    const remoteKey = `${remoteKeyPrefix}/${file}`;
    await uploadFile('outputs', remoteKey, localPath);
  }
  logger.info({ count: webpFiles.length, prefix: remoteKeyPrefix }, 'Uploaded mask files');
}

async function updateSegmentationStatus(
  projectId: string,
  videoItemId: string,
  status: 'pending' | 'processing' | 'ready' | 'failed',
  progress: number,
  result?: SegmentationResult,
  error?: string
): Promise<void> {
  // timelineItems doesn't have projectId directly - query by id only
  // (videoItemId is unique across the database)
  const item = await db.query.timelineItems.findFirst({
    where: eq(timelineItems.id, videoItemId),
  });

  if (!item) {
    logger.warn({ projectId, videoItemId }, 'Video item not found');
    return;
  }

  const currentData = item.data as Record<string, unknown>;
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

  await db.update(timelineItems)
    .set({ data: { ...currentData, segmentation } })
    .where(eq(timelineItems.id, videoItemId));

  logger.info({ projectId, videoItemId, status }, 'Updated segmentation status');
}
