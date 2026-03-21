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

export function discoverTemplates(): TemplateEntry[] {
  const templates: TemplateEntry[] = [];

  for (const [path, loader] of Object.entries(templateImports)) {
    const slug = path.match(/templates\/([^/]+)\//)?.[1];
    if (!slug) continue;

    const schemaMod = schemaModules[`../../src/templates/${slug}/schema.ts`];
    const metaMod = metaModules[`../../src/templates/${slug}/meta.json`];
    if (!schemaMod?.schema) continue;

    const meta = metaMod?.default ?? {};
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
