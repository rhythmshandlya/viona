import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { config } from '../config.js';

// Parse Redis URL for BullMQ connection
function parseRedisUrl(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || '6379', 10),
    password: parsed.password || undefined,
  };
}

const connection = parseRedisUrl(config.redis.url);

// Job queues
export const transcribeQueue = new Queue('transcribe', {
  connection,
  defaultJobOptions: {
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 500 },
  },
});

// Job data types
export interface TranscribeJobData {
  projectId: string;
  jobId: string;
  videoKey: string;
}

// Queue job creators
export async function queueTranscribeJob(data: TranscribeJobData) {
  return transcribeQueue.add('transcribe', data, {
    attempts: 1,
  });
}

export interface EnhanceAudioJobData {
  projectId: string;
  jobId: string;
  videoKey: string;
  audioTrackId: string;
  audioItemId: string;
  videoItemId: string;
}

export const enhanceAudioQueue = new Queue('enhance-audio', {
  connection,
  defaultJobOptions: {
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 500 },
  },
});

export async function queueEnhanceAudioJob(data: EnhanceAudioJobData) {
  return enhanceAudioQueue.add('enhance-audio', data, {
    attempts: 1,
  });
}

// SVG Animation job - for converting images to animated SVG compositions
export interface SvgAnimationJobData {
  projectId: string;
  jobId: string;
  imageKey: string;
  animationType: 'draw' | 'motion';
  animationStyle: 'elegant' | 'playful' | 'minimal';
  durationSeconds: number;
  trackId: string | null;
  startMs: number;
  width: number;
  height: number;
  description?: string;  // Description for scene matching
  sceneId?: number | null;  // Target scene ID for placement
  useOriginalImage?: boolean;  // If true, display original image instead of converting to SVG
}

export const svgAnimationQueue = new Queue('svg-animation', {
  connection,
  defaultJobOptions: {
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 500 },
  },
});

export async function queueSvgAnimationJob(data: SvgAnimationJobData) {
  return svgAnimationQueue.add('svg-animation', data, {
    attempts: 1,
  });
}

// Preload project job - warms up workspace when editor opens
export interface PreloadProjectJobData {
  projectId: string;
  compositionId: string;
}

export const preloadProjectQueue = new Queue('preload-project', {
  connection,
  defaultJobOptions: {
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 500 },
  },
});

export async function queuePreloadProjectJob(data: PreloadProjectJobData) {
  // Use jobId based on compositionId to prevent duplicate preloads
  return preloadProjectQueue.add('preload-project', data, {
    jobId: `preload-${data.compositionId}`,
    attempts: 1,
  });
}

// Head tracking queue — ML speaker detection pipeline
export interface HeadTrackingJobData {
  projectId: string;
  jobId: string;
  videoKey: string;
}

export const headTrackingQueue = new Queue('head-tracking', {
  connection,
  defaultJobOptions: {
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 500 },
  },
});

export async function queueHeadTrackingJob(data: HeadTrackingJobData) {
  return headTrackingQueue.add('head-tracking', data, {
    jobId: `${data.projectId}:headtrack:${Date.now()}`,
    attempts: 1,
  });
}

// Generate reframe queue — auto-queued by head-tracking completion
export interface GenerateReframeJobData {
  projectId: string;
  jobId: string;
}

export const generateReframeQueue = new Queue('generate-reframe', {
  connection,
  defaultJobOptions: {
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 500 },
  },
});

export async function queueGenerateReframeJob(data: GenerateReframeJobData) {
  return generateReframeQueue.add('generate-reframe', data, {
    attempts: 1,
  });
}

// Generate caption styles job - AI-powered per-caption styling
export interface GenerateCaptionStylesJobData {
  projectId: string;
  jobId: string;
}

export const generateCaptionStylesQueue = new Queue('generate-caption-styles', {
  connection,
  defaultJobOptions: {
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 500 },
  },
});

export async function queueGenerateCaptionStylesJob(data: GenerateCaptionStylesJobData) {
  return generateCaptionStylesQueue.add('generate-caption-styles', data, {
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  });
}

// YouTube clip extraction queue
export interface YouTubeClipJobData {
  jobId: string;
  url: string;
  startSeconds: number;
  endSeconds: number;
  quality?: string;
  projectId?: string;
}

export const youtubeClipQueue = new Queue('youtube-clip', {
  connection,
  defaultJobOptions: {
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 500 },
  },
});

export async function queueYouTubeClipJob(data: YouTubeClipJobData) {
  return youtubeClipQueue.add('extract-clip', data, {
    jobId: data.jobId,
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  });
}

// Redis publisher for job cancellation
const redisPublisher = new Redis(config.redis.url);

export async function publishJobCancel(jobId: string): Promise<void> {
  await redisPublisher.publish('job:cancel', JSON.stringify({ jobId }));
}
