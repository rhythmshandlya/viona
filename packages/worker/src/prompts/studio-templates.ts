import { readFileSync } from 'fs';
import { join } from 'path';
import { findPackagesRoot } from '../processors/generate-visuals/validation.js';

interface RegistryCatalogItem {
  name: string;
  description: string;
  categories: string[];
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
};

export function buildStudioTemplateCatalog(): string {
  const registryPath = join(findPackagesRoot(), 'templates', 'registry.json');
  const registry: Registry = JSON.parse(readFileSync(registryPath, 'utf-8'));

  // Group by category
  const groups = new Map<string, RegistryCatalogItem[]>();
  for (const item of registry.items) {
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
