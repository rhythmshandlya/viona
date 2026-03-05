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
  layoutMode: 'pip' | 'stacked';
  pipPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  pipSize: number;
}

export interface RenderJobData {
  projectId: string;
  jobId: string;
  projectType?: string;
  layoutSettings?: {
    mode: 'pip' | 'stacked';
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
  fullscreenSegments?: Array<{ startMs: number; endMs: number }>;
  visualDisplayData?: Array<{
    startMs: number;
    endMs: number;
    displayMode?: string;
    transition?: {
      enter: { type: string; durationMs: number };
      exit: { type: string; durationMs: number };
    };
    overlayOpacity?: number;
  }>;
}

// Queue job creators
export async function queueTranscribeJob(data: TranscribeJobData) {
  return transcribeQueue.add('transcribe', data, {
    attempts: 1,
  });
}

export async function queueRenderJob(data: RenderJobData) {
  return renderQueue.add('render', data, {
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

export const enhanceAudioQueue = new Queue('enhance-audio', { connection });

export async function queueEnhanceAudioJob(data: EnhanceAudioJobData) {
  return enhanceAudioQueue.add('enhance-audio', data, {
    attempts: 1,
  });
}

export type VisualsLayoutMode = 'pip' | 'stacked';

export interface VisualsDimensions {
  width: number;
  height: number;
}

export interface VideoSelection {
  videoId: string;
  title: string;
  thumbnailUrl: string;
  duration?: string;
  url: string;
}

export interface GenerateVisualsJobData {
  projectId: string;
  jobId: string;
  stylePreset: 'minimal' | 'modern' | 'playful' | 'bold' | 'classic' | 'apple' | 'google' | 'studio' | 'kinetic-typography';
  layoutMode: VisualsLayoutMode;
  dimensions: VisualsDimensions;
  /** Effective dimensions for pip scenes in split layouts */
  pipEffective?: VisualsDimensions;
  styleGuide?: string;
  planJobId?: string;  // ID of the plan-visuals job that created the plan
  /** User-selected videos for scenes: sceneIndex → keyword → VideoSelection */
  selectedVideos?: Record<number, Record<string, VideoSelection>>;
}

export const generateVisualsQueue = new Queue('generate-visuals', { connection });

export async function queueGenerateVisualsJob(data: GenerateVisualsJobData) {
  return generateVisualsQueue.add('generate-visuals', data, {
    jobId: `${data.projectId}:generate:${Date.now()}`,
    attempts: 1,
  });
}

export interface PlanVisualsJobData {
  projectId: string;
  jobId: string;
  stylePreset: 'minimal' | 'modern' | 'playful' | 'bold' | 'classic' | 'apple' | 'google' | 'studio' | 'kinetic-typography';
  layoutMode: VisualsLayoutMode;
  dimensions: VisualsDimensions;
  /** Effective dimensions for pip scenes in split layouts */
  pipEffective?: VisualsDimensions;
  styleGuide?: string;
  sourceWidth?: number;
  sourceHeight?: number;
}

export const planVisualsQueue = new Queue('plan-visuals', { connection });

export async function queuePlanVisualsJob(data: PlanVisualsJobData) {
  return planVisualsQueue.add('plan-visuals', data, {
    jobId: `${data.projectId}:plan:${Date.now()}`,
    attempts: 1,
  });
}

// Edit visuals job - for continuing to edit existing compositions
export interface EditVisualsJobData {
  projectId: string;
  jobId: string;
  compositionId: string;  // The existing composition to edit
  prompt: string;         // User's edit request (e.g., "Make particles bigger")
  sceneId?: number;       // Optional: target a specific scene (1-indexed)
  elementName?: string;   // Optional: target a specific element within the scene
  transcript?: string;    // Full transcript text with timestamps for context
  scenePlan?: string;     // JSON scene plan so the agent understands the visual structure
}

export const editVisualsQueue = new Queue('edit-visuals', { connection });

export async function queueEditVisualsJob(data: EditVisualsJobData) {
  return editVisualsQueue.add('edit-visuals', data, {
    jobId: `${data.projectId}:edit:${Date.now()}`,
    attempts: 1,
  });
}

// Split visual scene job — triggered when user cuts a visual timeline item
export interface SplitVisualSceneJobData {
  projectId: string;
  jobId: string;
  compositionId: string;      // e.g. "proj-abc-def" (with hyphens)
  sourceSceneId: number;      // 1-indexed scene being split
  splitAtMs: number;          // Absolute timeline position of cut
  leftItemId: string;         // New timeline item ID for left half
  rightItemId: string;        // New timeline item ID for right half
  transcript?: string;        // Full transcript text with timestamps for context
}

export const splitVisualSceneQueue = new Queue('split-visual-scene', { connection });

export async function queueSplitVisualSceneJob(data: SplitVisualSceneJobData) {
  return splitVisualSceneQueue.add('split-visual-scene', data, {
    jobId: `${data.projectId}:split:${Date.now()}`,
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

export const svgAnimationQueue = new Queue('svg-animation', { connection });

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

export const preloadProjectQueue = new Queue('preload-project', { connection });

export async function queuePreloadProjectJob(data: PreloadProjectJobData) {
  // Use jobId based on compositionId to prevent duplicate preloads
  return preloadProjectQueue.add('preload-project', data, {
    jobId: `preload-${data.compositionId}`,
    attempts: 1,
    removeOnComplete: true,
    removeOnFail: true,
  });
}

// Head tracking queue — ML speaker detection pipeline
export interface HeadTrackingJobData {
  projectId: string;
  jobId: string;
  videoKey: string;
}

export const headTrackingQueue = new Queue('head-tracking', { connection });

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

export const generateReframeQueue = new Queue('generate-reframe', { connection });

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

export const generateCaptionStylesQueue = new Queue('generate-caption-styles', { connection });

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

export const youtubeClipQueue = new Queue('youtube-clip', { connection });

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

// Segmentation queue — ML video segmentation pipeline
export interface SegmentationJobData {
  projectId: string;
  videoItemId: string;
  videoKey: string;
}

export const segmentationQueue = new Queue('segmentation', { connection });

export async function queueSegmentationJob(data: SegmentationJobData) {
  return segmentationQueue.add('segment-video', data, {
    jobId: `${data.projectId}:segment:${Date.now()}`,
    attempts: 1,
  });
}

// Redis publisher for job cancellation
const redisPublisher = new Redis(config.redis.url);

export async function publishJobCancel(jobId: string): Promise<void> {
  await redisPublisher.publish('job:cancel', JSON.stringify({ jobId }));
}
