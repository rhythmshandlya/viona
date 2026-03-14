// Sub-module processors
export { processRenderJob } from './render/index.js';
export type { RenderJobData } from './render/index.js';

export { processGenerateVisualsJob, validateEnvironment, cancelJob, getRunningJobs } from './generate-visuals/index.js';
export type { GenerateVisualsJobData } from './generate-visuals/index.js';

export { processEditVisualsJob } from './edit-visuals/index.js';
export type { EditVisualsJobData } from './edit-visuals/index.js';

export { processSvgAnimationJob } from './svg-animation/index.js';
export type { SvgAnimationJobData, SvgAnimationMetadata } from './svg-animation/index.js';

// Standalone processors
export { processGenerateCaptionStylesJob } from './generate-caption-styles.js';
export type { GenerateCaptionStylesJobData } from './generate-caption-styles.js';

export { processGenerateReframeJob } from './generate-reframe.js';
export type { GenerateReframeJobData } from './generate-reframe.js';

export { processHeadTrackingJob } from './head-tracking.js';
export type { HeadTrackingJobData } from './head-tracking.js';

export { processPlanVisualsJob, cancelPlanJob } from './plan-visuals.js';
export type { PlanVisualsJobData } from './plan-visuals.js';

export { processPreloadProjectJob } from './preload-project.js';
export type { PreloadProjectJobData } from './preload-project.js';

export { processSegmentation } from './segmentation.js';
export type { SegmentationJobData, FaceBbox, SegmentationResult } from './segmentation.js';

export { processTranscribeJob, mapWordTypeToOverrides } from './transcribe.js';
export type { TranscribeJobData, PerWordStyleOverrides, WordTier } from './transcribe.js';

export { processYouTubeClipJob } from './youtube-clip.js';
export type { YouTubeClipJobData, ClipResult } from './youtube-clip.js';
