import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { findPackagesRoot } from './validation.js';

interface RegistryFile {
  path: string;
  content: string;
  type: string;
}

interface RegistryItem {
  name: string;
  type: string;
  description: string;
  categories: string[];
  registryDependencies: string[];
  files: RegistryFile[];
  meta: Record<string, unknown>;
}

interface Scene {
  suggestedTemplates?: string[];
  [key: string]: unknown;
}

interface ScenesJson {
  scenes: Scene[];
}

export interface ResolvedTemplate {
  slug: string;
  description: string;
  files: RegistryFile[];
}

export interface ResolvedTemplates {
  templates: ResolvedTemplate[];
  copiedCount: number;
}

/**
 * Collects unique template slugs from scenes.json (suggestedTemplates field),
 * resolves their source from the registry r/{slug}.json files, copies selected
 * template files to the workspace, and returns resolved data for prompt injection.
 */
export function resolveSelectedTemplates(
  scenesJson: ScenesJson,
  workspaceSrc: string
): ResolvedTemplates {
  const registryDir = join(findPackagesRoot(), 'templates', 'r');

  // 1. Collect unique slugs from all scenes
  const slugs = new Set<string>();
  for (const scene of scenesJson.scenes) {
    for (const slug of scene.suggestedTemplates ?? []) {
      slugs.add(slug);
    }
  }

  if (slugs.size === 0) {
    console.error('No templates selected by Director — Animator will create custom visuals');
    return { templates: [], copiedCount: 0 };
  }

  // 2. Resolve each template + its dependencies
  const resolved = new Map<string, RegistryItem>();
  const toResolve = Array.from(slugs);

  while (toResolve.length > 0) {
    const slug = toResolve.pop()!;
    if (resolved.has(slug)) continue;

    try {
      const itemPath = join(registryDir, `${slug}.json`);
      const item: RegistryItem = JSON.parse(readFileSync(itemPath, 'utf-8'));
      resolved.set(slug, item);

      // Queue dependencies for resolution
      for (const dep of item.registryDependencies ?? []) {
        if (!resolved.has(dep)) toResolve.push(dep);
      }
    } catch (err) {
      console.error(`Failed to resolve template "${slug}" — skipping: ${err}`);
    }
  }

  // 3. Write files to workspace
  const templatesDir = join(workspaceSrc, '.templates');
  mkdirSync(templatesDir, { recursive: true });

  let copiedCount = 0;
  const templateResults: ResolvedTemplate[] = [];

  for (const [slug, item] of resolved) {
    if (item.type === 'registry:lib') {
      // Shared deps (use-scale, fonts) go to workspace/src/ directly
      for (const file of item.files) {
        writeFileSync(join(workspaceSrc, file.path), file.content, 'utf-8');
      }
    } else {
      // Template components go to workspace/src/.templates/{slug}/
      const destDir = join(templatesDir, slug);
      mkdirSync(destDir, { recursive: true });
      for (const file of item.files) {
        const fileDest = join(destDir, file.path);
        mkdirSync(dirname(fileDest), { recursive: true });
        writeFileSync(fileDest, file.content, 'utf-8');
      }
      templateResults.push({
        slug,
        description: item.description,
        files: item.files,
      });
      copiedCount++;
    }
  }

  console.error(
    `Resolved ${copiedCount} templates (${resolved.size - copiedCount} deps) from registry: ${Array.from(slugs).join(', ')}`
  );

  return { templates: templateResults, copiedCount };
}

/**
 * Formats resolved templates into markdown for injection into the Animator prompt.
 * Includes full source code so the Animator can import/customize without reading files.
 */
export function formatTemplatesForAnimator(resolved: ResolvedTemplates): string {
  if (resolved.templates.length === 0) return '';

  const sections = resolved.templates.map(t => {
    const fileList = t.files.map(f => f.path).join(', ');
    const codeBlocks = t.files.map(f =>
      `#### ${f.path}\n\`\`\`tsx\n${f.content}\n\`\`\``
    ).join('\n\n');

    return `### \`${t.slug}\` — ${t.description}
**Files:** ${fileList}
**Import:** \`import ${toPascalCase(t.slug)} from '../../.templates/${t.slug}'\`

${codeBlocks}`;
  }).join('\n\n---\n\n');

  return `## Selected Templates

The Director chose these templates for this video. Their source is copied to \`src/.templates/{slug}/\`.
You can import them directly or copy their code and customize.

${sections}
`;
}

function toPascalCase(slug: string): string {
  return slug.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('');
}
