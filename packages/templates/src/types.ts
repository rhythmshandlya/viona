import type { z } from 'zod';
import type React from 'react';

export interface TemplateMeta {
  slug: string;
  name: string;
  description: string;
  category:
    | 'data-visualization'
    | 'text-typography'
    | 'comparison'
    | 'social-engagement'
    | 'geographic'
    | 'intro-outro'
    | 'timeline-process'
    | 'media'
    | 'marketing'
    | 'education'
    | 'social'
    | 'corporate'
    | 'entertainment'
    | 'overlay';
  tags: string[];
  stylePreset: string;
  aspectRatio: '16:9' | '9:16' | '1:1';
  sceneCount: number;
  estimatedDuration: string;
  thumbnail: string;
  type?: 'scene' | 'overlay';
  themes?: string[];
}

export interface CompositionMeta {
  compositionId: string;
  durationInFrames: number;
  fps: number;
  width: number;
  height: number;
}

export interface TemplateFile {
  path: string;
  content: string;
}

export interface TemplateRegistryEntry {
  meta: TemplateMeta;
  compositionMeta: CompositionMeta;
  schema: z.ZodType;
  defaultProps: Record<string, unknown>;
  getComponent: () => Promise<{ default: React.ComponentType<any> }>;
  getFiles: () => Promise<TemplateFile[]>;
}

export type TemplateCategory = TemplateMeta['category'];
export type AspectRatio = TemplateMeta['aspectRatio'];

export interface TemplateFilters {
  category?: TemplateCategory;
  aspectRatio?: AspectRatio;
  tags?: string[];
  search?: string;
  theme?: string;
}
