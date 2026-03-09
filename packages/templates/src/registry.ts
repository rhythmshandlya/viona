import type { TemplateRegistryEntry, TemplateFilters, TemplateFile } from './types';

const registry = new Map<string, TemplateRegistryEntry>();

export function registerTemplate(entry: TemplateRegistryEntry): void {
  registry.set(entry.meta.slug, entry);
}

export function getTemplate(slug: string): TemplateRegistryEntry | undefined {
  return registry.get(slug);
}

export function listTemplates(filters?: TemplateFilters): TemplateRegistryEntry[] {
  let entries = Array.from(registry.values());

  if (!filters) return entries;

  if (filters.category) {
    entries = entries.filter((e) => e.meta.category === filters.category);
  }

  if (filters.aspectRatio) {
    entries = entries.filter((e) => e.meta.aspectRatio === filters.aspectRatio);
  }

  if (filters.tags && filters.tags.length > 0) {
    entries = entries.filter((e) =>
      filters.tags!.some((tag) => e.meta.tags.includes(tag))
    );
  }

  if (filters.theme) {
    entries = entries.filter((e) => e.meta.tags.includes(`${filters.theme}-theme`));
  }

  if (filters.search) {
    const q = filters.search.toLowerCase();
    entries = entries.filter(
      (e) =>
        e.meta.name.toLowerCase().includes(q) ||
        e.meta.description.toLowerCase().includes(q) ||
        e.meta.tags.some((t) => t.toLowerCase().includes(q))
    );
  }

  return entries;
}

export async function getTemplateFiles(slug: string): Promise<TemplateFile[]> {
  const entry = registry.get(slug);
  if (!entry) throw new Error(`Template "${slug}" not found`);
  return entry.getFiles();
}
