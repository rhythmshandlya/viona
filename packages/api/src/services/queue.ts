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
export const transcribeQueue = new Queue('transcribe', { connection });
export const renderQueue = new Queue('render', { connection });

// Job data types
export interface TranscribeJobData {
  projectId: string;
  jobId: string;
  videoKey: string;
}

export interface ExportOptions {
  layoutMode: 'pip' | 'split-h' | 'split-v' | 'overlay';
  pipPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  pipSize: number;
}

export interface RenderJobData {
  projectId: string;
  jobId: string;
  exportOptions?: ExportOptions;
}

// Queue job creators
export async function queueTranscribeJob(data: TranscribeJobData) {
  return transcribeQueue.add('transcribe', data, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  });
}

export async function queueRenderJob(data: RenderJobData) {
  return renderQueue.add('render', data, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
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

export type VisualsLayoutMode = 'pip' | 'split-horizontal' | 'split-vertical';

export interface VisualsDimensions {
  width: number;
  height: number;
}

export interface GenerateVisualsJobData {
  projectId: string;
  jobId: string;
  stylePreset: 'minimal' | 'modern' | 'playful' | 'bold' | 'classic';
  layoutMode: VisualsLayoutMode;
  dimensions: VisualsDimensions;
  styleGuide?: string;
}

export const generateVisualsQueue = new Queue('generate-visuals', { connection });

export async function queueGenerateVisualsJob(data: GenerateVisualsJobData) {
  return generateVisualsQueue.add('generate-visuals', data, {
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 10000,
    },
  });
}

// Redis publisher for job cancellation
const redisPublisher = new Redis(config.redis.url);

export async function publishJobCancel(jobId: string): Promise<void> {
  await redisPublisher.publish('job:cancel', JSON.stringify({ jobId }));
}
