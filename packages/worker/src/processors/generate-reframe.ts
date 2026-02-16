import { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { db, projects, jobs } from '../db/index.js';
import { logger } from '../logger.js';
import { publishJobProgress, publishJobComplete, publishJobError } from '../services/redis.js';

export interface GenerateReframeJobData {
  projectId: string;
  jobId: string;
}

interface TrackingFrame {
  frame: number;
  timestamp_ms: number;
  face: {
    bbox: { x: number; y: number; width: number; height: number } | null;
    landmarks: Record<string, { x: number; y: number }> | null;
  } | null;
  body: Record<string, { x: number; y: number; visible: boolean }> | null;
  confidence: number;
}

interface TrackingData {
  video: { width: number; height: number; fps: number; duration_ms: number };
  frames: TrackingFrame[];
}

interface ReframeKeyframe {
  timestampMs: number;
  cropX: number;
  cropY: number;
  scale: number;
}

export async function processGenerateReframeJob(job: Job<GenerateReframeJobData>) {
  const { projectId, jobId } = job.data;

  try {
    // Update job status
    await db.update(jobs)
      .set({ status: 'processing', progress: 0 })
      .where(eq(jobs.id, jobId));

    await publishJobProgress(jobId, 10, 'Loading tracking data...');

    // Load project with head tracking data
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    if (!project) {
      throw new Error('Project not found');
    }

    const trackingData = project.headTrackingData as TrackingData | null;
    if (!trackingData || !trackingData.frames || trackingData.frames.length === 0) {
      throw new Error('No head tracking data found. Run head tracking first.');
    }

    await publishJobProgress(jobId, 20, 'Generating reframe keyframes...');

    const { width: videoWidth, height: videoHeight } = trackingData.video;

    // Convert face bboxes to cropX/cropY values (0-100)
    const rawKeyframes: ReframeKeyframe[] = [];

    for (const frame of trackingData.frames) {
      if (!frame.face?.bbox) continue;

      const bbox = frame.face.bbox;
      // Calculate center of face bounding box
      const faceCenterX = bbox.x + bbox.width / 2;
      const faceCenterY = bbox.y + bbox.height / 2;

      // Convert to 0-100 scale
      const cropX = (faceCenterX / videoWidth) * 100;
      const cropY = (faceCenterY / videoHeight) * 100;

      rawKeyframes.push({
        timestampMs: frame.timestamp_ms,
        cropX: Math.max(0, Math.min(100, cropX)),
        cropY: Math.max(0, Math.min(100, cropY)),
        scale: 1.0,
      });
    }

    if (rawKeyframes.length === 0) {
      throw new Error('No face detections found in tracking data.');
    }

    await publishJobProgress(jobId, 50, 'Applying temporal smoothing...');

    // Apply exponential moving average smoothing (~500ms window)
    const smoothedKeyframes = applyTemporalSmoothing(rawKeyframes, 500);

    await publishJobProgress(jobId, 80, 'Saving reframe keyframes...');

    // Store in project's videoSettings
    const currentSettings = (project.videoSettings as Record<string, unknown>) || {};
    const updatedSettings = {
      ...currentSettings,
      reframeKeyframes: smoothedKeyframes,
      reframeEnabled: true,
    };

    await db.update(projects)
      .set({
        videoSettings: updatedSettings,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, projectId));

    // Complete
    await db.update(jobs)
      .set({ status: 'complete', progress: 100, completedAt: new Date() })
      .where(eq(jobs.id, jobId));

    await publishJobProgress(jobId, 100, 'Complete');
    await publishJobComplete(jobId, projectId);

    logger.info({
      projectId,
      keyframeCount: smoothedKeyframes.length,
      rawCount: rawKeyframes.length,
    }, 'Reframe keyframes generated');

  } catch (error) {
    logger.error({ projectId, err: error }, 'Reframe generation failed');

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await db.update(jobs)
      .set({ status: 'failed', error: errorMessage })
      .where(eq(jobs.id, jobId));

    await publishJobError(jobId, errorMessage);

    throw error;
  }
}

/**
 * Apply exponential moving average smoothing to keyframes.
 * windowMs controls the smoothing window — larger = smoother but less responsive.
 */
function applyTemporalSmoothing(
  keyframes: ReframeKeyframe[],
  windowMs: number,
): ReframeKeyframe[] {
  if (keyframes.length <= 1) return keyframes;

  const smoothed: ReframeKeyframe[] = [];
  let smoothX = keyframes[0].cropX;
  let smoothY = keyframes[0].cropY;
  let smoothScale = keyframes[0].scale;

  for (let i = 0; i < keyframes.length; i++) {
    const kf = keyframes[i];

    if (i === 0) {
      smoothed.push({ ...kf });
      continue;
    }

    // Calculate alpha based on time delta
    const dt = kf.timestampMs - keyframes[i - 1].timestampMs;
    const alpha = 1 - Math.exp(-dt / windowMs);

    smoothX = smoothX + alpha * (kf.cropX - smoothX);
    smoothY = smoothY + alpha * (kf.cropY - smoothY);
    smoothScale = smoothScale + alpha * (kf.scale - smoothScale);

    smoothed.push({
      timestampMs: kf.timestampMs,
      cropX: Math.round(smoothX * 100) / 100,
      cropY: Math.round(smoothY * 100) / 100,
      scale: Math.round(smoothScale * 1000) / 1000,
    });
  }

  return smoothed;
}
