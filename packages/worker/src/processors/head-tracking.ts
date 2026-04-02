import { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { db, jobs } from '../db/index.js';
import { logger } from '../logger.js';
import { publishJobComplete, publishJobError } from '../services/redis.js';

export interface HeadTrackingJobData {
  projectId: string;
  jobId: string;
  videoKey: string;
}

/**
 * Head-tracking processor — deprecated (MediaPipe detect_head.py removed).
 * Replaced by RVM segmentation (segmentation queue). Immediately completes
 * any in-flight jobs so the queue does not stall.
 */
export async function processHeadTrackingJob(job: Job<HeadTrackingJobData>) {
  const { projectId, jobId } = job.data;

  logger.warn({ projectId, jobId }, 'Head-tracking job received but processor is deprecated — completing as no-op');

  try {
    await db.update(jobs)
      .set({ status: 'complete', progress: 100, completedAt: new Date() })
      .where(eq(jobs.id, jobId));

    await publishJobComplete(jobId, projectId);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ projectId, jobId, err: error }, 'Head-tracking no-op failed to update DB');
    await publishJobError(jobId, errorMessage, { projectId });
    throw error;
  }
}
