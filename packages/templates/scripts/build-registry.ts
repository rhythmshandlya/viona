/**
 * Build-time script that produces:
 * - registry.json  (metadata-only index for catalog prompts)
 * - r/{slug}.json  (full item with inlined source for each template)
 * - r/use-scale.json, r/fonts.json  (shared dependencies)
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, relative, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TEMPLATES_DIR = join(__dirname, '..', 'src', 'templates');
const SRC_DIR = join(__dirname, '..', 'src');
const OUTPUT_DIR = join(__dirname, '..', 'r');
const REGISTRY_PATH = join(__dirname, '..', 'registry.json');

mkdirSync(OUTPUT_DIR, { recursive: true });

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

interface RegistryCatalogItem {
  name: string;
  type: string;
  description: string;
  categories: string[];
  tags: string[];
  meta: Record<string, unknown>;
}

const SKIP_FILES = new Set(['register.ts', 'thumbnail.png', 'meta.json', 'metadata.json']);

function readDirRecursive(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...readDirRecursive(fullPath));
    } else if (!SKIP_FILES.has(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

function classifyFile(relativePath: string): string {
  if (relativePath === 'index.tsx') return 'registry:component';
  if (relativePath === 'schema.ts') return 'registry:lib';
  if (relativePath.startsWith('lib/')) return 'registry:lib';
  if (relativePath.startsWith('components/')) return 'registry:component';
  return 'registry:lib';
}

function detectSharedDeps(files: RegistryFile[]): string[] {
  const deps = new Set<string>();
  for (const f of files) {
    if (f.content.includes('use-scale')) deps.add('use-scale');
    if (f.content.includes('fonts') && f.content.match(/from\s+['"]\.\.\/\.\.\/fonts['"]/)) deps.add('fonts');
  }
  return Array.from(deps);
}

const catalogItems: RegistryCatalogItem[] = [];
let templateCount = 0;

for (const dir of readdirSync(TEMPLATES_DIR, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
  if (!dir.isDirectory()) continue;
  const metaPath = join(TEMPLATES_DIR, dir.name, 'meta.json');
  if (!existsSync(metaPath)) continue;

  let meta: Record<string, unknown>;
  try {
    meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
  } catch {
    console.warn(`Skipping ${dir.name}: invalid meta.json`);
    continue;
  }

  const tags = (meta.tags as string[]) || [];

  const templateDir = join(TEMPLATES_DIR, dir.name);
  const filePaths = readDirRecursive(templateDir);
  const files: RegistryFile[] = filePaths.map(fp => {
    const relPath = relative(templateDir, fp).replace(/\\/g, '/');
    return {
      path: relPath,
      content: readFileSync(fp, 'utf-8'),
      type: classifyFile(relPath),
    };
  });

  const registryDeps = detectSharedDeps(files);

  const item: RegistryItem = {
    name: meta.slug as string,
    type: 'registry:component',
    description: (meta.description as string) || '',
    categories: [meta.category as string].filter(Boolean),
    registryDependencies: registryDeps,
    files,
    meta: {
      stylePreset: meta.stylePreset,
      aspectRatio: meta.aspectRatio,
      estimatedDuration: meta.estimatedDuration,
    },
  };

  writeFileSync(join(OUTPUT_DIR, `${meta.slug}.json`), JSON.stringify(item, null, 2), 'utf-8');

  catalogItems.push({
    name: meta.slug as string,
    type: 'registry:component',
    description: (meta.description as string) || '',
    categories: [meta.category as string].filter(Boolean),
    tags,
    meta: {
      stylePreset: meta.stylePreset,
      aspectRatio: meta.aspectRatio,
      estimatedDuration: meta.estimatedDuration,
    },
  });

  templateCount++;
}

// Shared dependency items
for (const sharedFile of ['use-scale.ts', 'fonts.ts']) {
  const name = sharedFile.replace('.ts', '');
  const srcPath = join(SRC_DIR, sharedFile);
  if (!existsSync(srcPath)) continue;

  const item = {
    name,
    type: 'registry:lib',
    description: `Shared utility: ${name}`,
    categories: [],
    registryDependencies: [],
    files: [{ path: sharedFile, content: readFileSync(srcPath, 'utf-8'), type: 'registry:lib' }],
    meta: {},
  };
  writeFileSync(join(OUTPUT_DIR, `${name}.json`), JSON.stringify(item, null, 2), 'utf-8');
}

const registry = {
  name: 'viona-templates',
  homepage: 'https://viona.app',
  items: catalogItems,
};
writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2), 'utf-8');

console.log(`Built registry: ${templateCount} templates, ${catalogItems.length} catalog items`);
console.log(`Output: ${REGISTRY_PATH} + ${OUTPUT_DIR}/`);
