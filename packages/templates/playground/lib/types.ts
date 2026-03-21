import type { z } from 'zod';

export interface ThemeDefinition {
  slug: string;
  name: string;
  description: string;
  colorPalette: Record<string, string>;
  fontRecommendations: Record<string, string>;
  styleGuidance: string;
}

export interface TemplateEntry {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  themes: string[];
  loader: () => Promise<{ default: React.FC<any> }>;
  schema: z.ZodObject<any>;
  defaultProps: Record<string, any>;
  meta: Record<string, any>;
}

export type View =
  | { type: 'gallery' }
  | { type: 'detail'; templateId: string }
  | { type: 'themes'; themeSlug?: string };
