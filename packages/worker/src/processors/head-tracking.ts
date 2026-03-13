import { Job, Queue } from 'bullmq';
import { eq } from 'drizzle-orm';
import { existsSync } from 'fs';
import { mkdir, rm, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';
import { nanoid } from 'nanoid';
import { db, projects, jobs } from '../db/index.js';
import { downloadFile } from '../services/minio.js';
import { logger } from '../logger.js';
import { publishJobProgress, publishJobComplete, publishJobError } from '../services/redis.js';
import { config } from '../config.js';
import { redisConnection } from '../utils/redis.js';
import { runSubprocess } from '../utils/subprocess.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const reframeQueue = new Queue('generate-reframe', { connection: redisConnection });

export interface HeadTrackingJobData {
  projectId: string;
  jobId: string;
  videoKey: string;
}

export async function processHeadTrackingJob(job: Job<HeadTrackingJobData>) {
  const { projectId, jobId, videoKey } = job.data;
  const workDir = join(tmpdir(), `viona-headtrack-${nanoid()}`);

  try {
    await mkdir(workDir, { recursive: true });

    // Update job status
    await db.update(jobs)
      .set({ status: 'processing', progress: 0 })
      .where(eq(jobs.id, jobId));

    const pubExtras = { projectId };

    // Step 1: Download video (10%)
    await publishJobProgress(jobId, 5, 'Downloading video for head tracking...', pubExtras);
    const videoPath = join(workDir, 'video.mp4');
    await downloadFile('uploads', videoKey, videoPath);
    await publishJobProgress(jobId, 10, 'Video downloaded', pubExtras);

    // Step 2: Run detect_head.py (10-80%)
    await publishJobProgress(jobId, 15, 'Running head detection...', pubExtras);

    const trackingOutputPath = join(workDir, 'video_tracking.json');
    // detect_head.py is in packages/worker/scripts/
    // In prod (tsup bundle): __dirname = .../dist → one level up
    // In dev (tsx):           __dirname = .../src/processors → two levels up
    let resolvedScriptPath = join(__dirname, '..', 'scripts', 'detect_head.py');
    if (!existsSync(resolvedScriptPath)) {
      resolvedScriptPath = join(__dirname, '..', '..', 'scripts', 'detect_head.py');
    }

    await runHeadDetection(
      videoPath,
      trackingOutputPath,
      resolvedScriptPath,
      jobId,
      projectId,
    );

    await publishJobProgress(jobId, 80, 'Head detection complete', pubExtras);

    // Step 3: Read tracking data and store in DB (90%)
    await publishJobProgress(jobId, 85, 'Saving tracking data...', pubExtras);

    const trackingJson = await readFile(trackingOutputPath, 'utf-8');
    const trackingData = JSON.parse(trackingJson);

    await db.update(projects)
      .set({
        headTrackingData: trackingData,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, projectId));

    await publishJobProgress(jobId, 90, 'Tracking data saved', pubExtras);

    // Step 4: Auto-queue reframe generation
    await publishJobProgress(jobId, 92, 'Generating reframe keyframes...', pubExtras);

    try {
      // Create job record in DB and queue via module-level reframeQueue
      const [reframeJob] = await db.insert(jobs).values({
        projectId,
        type: 'generate-reframe',
        status: 'pending',
      }).returning();

      await reframeQueue.add('generate-reframe', {
        projectId,
        jobId: reframeJob.id,
      }, {
        attempts: 2,
        backoff: { type: 'exponential', delay: 5000 },
      });

      logger.info({ projectId, reframeJobId: reframeJob.id }, 'Auto-queued reframe generation');
    } catch (err) {
      logger.warn({ err, projectId }, 'Failed to auto-queue reframe generation (non-critical)');
    }

    // Step 5: Complete
    await db.update(jobs)
      .set({ status: 'complete', progress: 100, completedAt: new Date() })
      .where(eq(jobs.id, jobId));

    await publishJobProgress(jobId, 100, 'Complete', pubExtras);
    await publishJobComplete(jobId, projectId);

    logger.info({ projectId }, 'Head tracking complete');

  } catch (error) {
    logger.error({ projectId, err: error }, 'Head tracking failed');

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

async function runHeadDetection(
  videoPath: string,
  outputPath: string,
  scriptPath: string,
  jobId: string,
  projectId: string,
): Promise<void> {
  const pythonPath = config.pythonPath || 'python3';
  let expectedSamples = 0;

  await runSubprocess({
    command: pythonPath,
    args: [scriptPath, videoPath, '--output', outputPath, '--interval', '3'],
    timeoutMs: 5 * 60 * 1000,
    name: 'head-tracking',
    onStdoutLine: (line) => {
      // Parse total frame count from initial log line
      if (!expectedSamples && line.includes('Processing video:')) {
        const totalMatch = line.match(/(\d+) frames/);
        if (totalMatch) {
          expectedSamples = Math.ceil(parseInt(totalMatch[1], 10) / 3);
        }
      }
      // Parse progress
      if (line.includes('Processed') && line.includes('samples')) {
        const match = line.match(/Processed (\d+) samples/);
        if (match) {
          const samples = parseInt(match[1], 10);
          const total = expectedSamples || samples * 2;
          const ratio = Math.min(1, samples / total);
          const progress = Math.min(80, 15 + Math.round(ratio * 65));
          publishJobProgress(jobId, progress, `Tracking: ${samples} frames processed`, { projectId });
        }
      }
    },
  });
}
