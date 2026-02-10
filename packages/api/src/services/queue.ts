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
  layoutSettings?: {
    mode: 'pip' | 'split-horizontal' | 'split-vertical';
    pip: {
      position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
      offsetX: number;
      offsetY: number;
      size: 'small' | 'medium' | 'large' | 'custom';
      customSize: number;
      shape: 'square' | 'circle' | 'rounded';
      borderRadius: number;
      borderWidth: number;
      borderColor: string;
      shadowEnabled: boolean;
      shadowColor: string;
      shadowBlur: number;
      opacity: number;
    };
    split: {
      position: 'visuals-first' | 'video-first';
      ratio: number;
      gap: number;
    };
  };
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

// Edit visuals job - for continuing to edit existing compositions
export interface EditVisualsJobData {
  projectId: string;
  jobId: string;
  compositionId: string;  // The existing composition to edit
  prompt: string;         // User's edit request (e.g., "Make particles bigger")
  sceneId?: number;       // Optional: target a specific scene (1-indexed)
}

export const editVisualsQueue = new Queue('edit-visuals', { connection });

export async function queueEditVisualsJob(data: EditVisualsJobData) {
  return editVisualsQueue.add('edit-visuals', data, {
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 10000,
    },
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
}

export const svgAnimationQueue = new Queue('svg-animation', { connection });

export async function queueSvgAnimationJob(data: SvgAnimationJobData) {
  return svgAnimationQueue.add('svg-animation', data, {
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
