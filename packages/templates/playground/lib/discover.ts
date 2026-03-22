import type { z } from 'zod';
import type { TemplateEntry, ThemeDefinition } from './types';

// -- Template discovery -------------------------------------------------------

const templateImports = import.meta.glob(
  '../../src/templates/*/index.tsx',
) as Record<string, () => Promise<{ default: React.FC<any> }>>;

const schemaModules = import.meta.glob(
  '../../src/templates/*/schema.ts',
  { eager: true },
) as Record<string, { schema: z.ZodObject<any>; defaultProps: any }>;

const metaModules = import.meta.glob(
  '../../src/templates/*/meta.json',
  { eager: true },
) as Record<string, { default: Record<string, any> }>;

const metadataModules = import.meta.glob(
  '../../src/templates/*/metadata.json',
  { eager: true },
) as Record<string, { default: { compositionId?: string; durationInFrames?: number; fps?: number; width?: number; height?: number } }>;

export function discoverTemplates(): TemplateEntry[] {
  const templates: TemplateEntry[] = [];

  for (const [path, loader] of Object.entries(templateImports)) {
    const slug = path.match(/templates\/([^/]+)\//)?.[1];
    if (!slug) continue;

    const schemaMod = schemaModules[`../../src/templates/${slug}/schema.ts`];
    const metaMod = metaModules[`../../src/templates/${slug}/meta.json`];
    const metadataMod = metadataModules[`../../src/templates/${slug}/metadata.json`];
    if (!schemaMod?.schema) continue;

    const meta = metaMod?.default ?? {};
    const metadata = metadataMod?.default ?? {};
    templates.push({
      id: slug,
      name: meta.name ?? slug,
      description: meta.description ?? '',
      category: meta.category ?? 'uncategorized',
      tags: meta.tags ?? [],
      themes: meta.themes ?? [],
      loader,
      schema: schemaMod.schema,
      defaultProps: schemaMod.defaultProps ?? schemaMod.schema.parse({}),
      meta,
      durationInFrames: metadata.durationInFrames ?? 360,
      fps: metadata.fps ?? 30,
      width: metadata.width ?? 1080,
      height: metadata.height ?? 1080,
    });
  }

  return templates.sort((a, b) => a.name.localeCompare(b.name));
}

// -- Theme discovery ----------------------------------------------------------

const themeModules = import.meta.glob(
  '../../themes/*.json',
  { eager: true },
) as Record<string, { default: ThemeDefinition }>;

export function discoverThemes(): ThemeDefinition[] {
  const themes: ThemeDefinition[] = [];

  for (const [, mod] of Object.entries(themeModules)) {
    if (mod?.default?.slug) {
      themes.push(mod.default);
    }
  }

  return themes.sort((a, b) => a.name.localeCompare(b.name));
}
