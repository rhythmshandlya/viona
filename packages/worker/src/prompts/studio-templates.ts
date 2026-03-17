import { readFileSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getTemplateTags } from './theme-loader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Resolve the monorepo packages/ root from this file's location */
function findPackagesRoot(): string {
  // packages/worker/src/prompts/studio-templates.ts -> packages/
  return resolve(__dirname, '..', '..', '..');
}

interface RegistryCatalogItem {
  name: string;
  description: string;
  categories: string[];
  tags?: string[];
  meta: { stylePreset?: string; aspectRatio?: string; estimatedDuration?: string };
}

interface Registry {
  name: string;
  items: RegistryCatalogItem[];
}

const CATEGORY_LABELS: Record<string, string> = {
  'data-visualization': 'Data Visualization',
  'text-typography': 'Text & Typography',
  'comparison': 'Comparison & Versus',
  'social-engagement': 'Social & Engagement',
  'geographic': 'Geographic & Maps',
  'intro-outro': 'Intro & Outro',
  'timeline-process': 'Timeline & Process',
  'media': 'Media & Video',
  'marketing': 'Marketing',
  'education': 'Education',
  'social': 'Social',
  'corporate': 'Corporate',
  'entertainment': 'Entertainment',
  'non-card': 'Non-Card Templates',
};

/**
 * Build a categorized template catalog for the given theme preset.
 * Filters registry items by the preset's templateTags.
 */
export function buildTemplateCatalog(preset: string): string {
  const registryPath = join(findPackagesRoot(), 'templates', 'registry.json');
  const registry: Registry = JSON.parse(readFileSync(registryPath, 'utf-8'));

  const themeTags = getTemplateTags(preset);

  // Filter items that match the theme's tags
  const filtered = registry.items.filter(item => {
    const itemTags = item.tags || [];
    return themeTags.some(tag => itemTags.includes(tag));
  });

  // Group by category
  const groups = new Map<string, RegistryCatalogItem[]>();
  for (const item of filtered) {
    const cat = item.categories[0] || 'other';
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(item);
  }

  // Build categorized catalog
  const sections: string[] = [];
  for (const [cat, items] of groups) {
    const label = CATEGORY_LABELS[cat] || cat;
    const lines = items.map(t => `- \`${t.name}\`: ${t.description}`).join('\n');
    sections.push(`### ${label} (${items.length})\n${lines}`);
  }

  return `## Available Templates by Category

${sections.join('\n\n')}

**How to use:** Select templates by slug in scenes.json \`"templates"\` field. The Animator will receive their full source code.
If no template fits a scene, use an empty array — the Animator will create custom visuals.
`;
}

/** @deprecated Use buildTemplateCatalog(preset) instead */
export function buildStudioTemplateCatalog(): string {
  return buildTemplateCatalog('studio-dark');
}
