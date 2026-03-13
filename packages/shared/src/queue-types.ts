import { z } from 'zod';

// ---- Shared Layout Types ----

export type VisualsLayoutMode = 'pip' | 'stacked';

export const visualsDimensionsSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});
export type VisualsDimensions = z.infer<typeof visualsDimensionsSchema>;

// ---- Style Preset ----

export type StylePreset = string;

// ---- Video Selection (for scene video picks) ----

export interface VideoSelection {
  videoId: string;
  title: string;
  thumbnailUrl: string;
  duration?: string;
  url: string;
}

// ---- Job Data Types ----

export const generateVisualsOptionsSchema = z.object({
  stylePreset: z.string().min(1),
  layoutMode: z.enum(['pip', 'stacked']),
  dimensions: visualsDimensionsSchema,
  styleGuide: z.string().optional(),
});
export type GenerateVisualsOptions = z.infer<typeof generateVisualsOptionsSchema>;

export interface GenerateVisualsJobData extends GenerateVisualsOptions {
  projectId: string;
  jobId: string;
  pipEffective?: VisualsDimensions;
  planJobId?: string;
  selectedVideos?: Record<number, Record<string, VideoSelection>>;
  verbose?: boolean;
}

export interface PlanVisualsJobData {
  projectId: string;
  jobId: string;
  stylePreset: string;
  layoutMode: VisualsLayoutMode;
  dimensions: VisualsDimensions;
  pipEffective?: VisualsDimensions;
  styleGuide?: string;
  sourceWidth?: number;
  sourceHeight?: number;
}

export interface EditVisualsJobData {
  projectId: string;
  jobId: string;
  compositionId: string;
  prompt: string;
  sceneId?: number;
  sceneIds?: number[];    // Multiple scenes to edit (1-indexed). Takes priority over sceneId.
  elementName?: string;
  transcript?: string;
  scenePlan?: string;
}

// ---- Layout Settings (for render) ----

export const pipSettingsSchema = z.object({
  position: z.enum(['top-left', 'top-right', 'bottom-left', 'bottom-right']),
  offsetX: z.number(),
  offsetY: z.number(),
  size: z.enum(['small', 'medium', 'large', 'custom']),
  customSize: z.number(),
  shape: z.enum(['square', 'circle', 'rounded']),
  borderRadius: z.number(),
  borderWidth: z.number(),
  borderColor: z.string(),
  shadowEnabled: z.boolean(),
  shadowColor: z.string(),
  shadowBlur: z.number(),
  opacity: z.number(),
});

export const splitSettingsSchema = z.object({
  position: z.enum(['visuals-first', 'video-first']),
  ratio: z.number(),
  gap: z.number(),
});

export const layoutSettingsSchema = z.object({
  mode: z.enum(['pip', 'stacked']),
  pip: pipSettingsSchema,
  split: splitSettingsSchema,
});
export type LayoutSettings = z.infer<typeof layoutSettingsSchema>;

export const renderOptionsSchema = z.object({
  layoutSettings: layoutSettingsSchema.optional(),
  fullscreenSegments: z.array(z.object({
    startMs: z.number(),
    endMs: z.number(),
  })).optional(),
  visualDisplayData: z.array(z.object({
    startMs: z.number(),
    endMs: z.number(),
    displayMode: z.string().optional(),
    transition: z.object({
      enter: z.object({ type: z.string(), durationMs: z.number() }),
      exit: z.object({ type: z.string(), durationMs: z.number() }),
    }).optional(),
  })).optional(),
});
export type RenderOptions = z.infer<typeof renderOptionsSchema>;
