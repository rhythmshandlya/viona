/**
 * Template Build CLI
 *
 * Compiles each template into a self-contained ESM bundle:
 * 1. Copies template source + shared modules into a resolved directory
 * 2. Rewrites ../../ imports to ./
 * 3. Bundles with esbuild (React/Remotion externalized via globals plugin)
 * 4. Content-hashes the output bundle
 * 5. Converts Zod schemas to JSON Schema
 * 6. Writes dist/bundles/manifest.json
 */

import { build } from 'esbuild';
import {
  readdirSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  cpSync,
  rmSync,
  statSync,
} from 'fs';
import { join, dirname, relative, resolve } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import { globalsPlugin, nodeModulesPlugin } from './esbuild-globals-plugin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PKG_ROOT = resolve(__dirname, '..');
const SRC_DIR = join(PKG_ROOT, 'src');
const TEMPLATES_DIR = join(SRC_DIR, 'templates');
const DIST_DIR = join(PKG_ROOT, 'dist', 'bundles');

// ── Helpers ─────────────────────────────────────────────────────────────────

function copyDirRecursive(src: string, dest: string) {
  cpSync(src, dest, { recursive: true });
}

function getAllFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getAllFiles(fullPath));
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Rewrite all `../../` relative imports in .ts/.tsx files to `./`.
 * This flattens the shared module references after copying them into
 * the resolved source directory.
 */
function rewriteRelativeImports(dir: string) {
  const files = getAllFiles(dir);
  for (const filePath of files) {
    if (!/\.(ts|tsx)$/.test(filePath)) continue;

    let content = readFileSync(filePath, 'utf-8');
    const original = content;

    // Rewrite `from '../../fonts'` → `from './fonts'`
    // Rewrite `from '../../use-scale'` → `from './use-scale'`
    // Rewrite `from '../../lib/map'` → `from './lib/map'`
    // Rewrite `from '../../lib/map/types'` → `from './lib/map/types'`
    // Also handle `import type` and `import(...)` patterns
    content = content.replace(
      /(from\s+['"])\.\.\/\.\.\/(.*?)(['"])/g,
      '$1./$2$3',
    );
    content = content.replace(
      /(import\s*\(\s*['"])\.\.\/\.\.\/(.*?)(['"])/g,
      '$1./$2$3',
    );

    if (content !== original) {
      writeFileSync(filePath, content, 'utf-8');
    }
  }
}

/**
 * Detect sibling template imports (e.g. ../country-highlight/) by scanning
 * all .ts/.tsx files for `from '../<slug>/...'` patterns.
 */
function detectSiblingTemplateDeps(dir: string): string[] {
  const slugs = new Set<string>();
  const files = getAllFiles(dir);
  for (const filePath of files) {
    if (!/\.(ts|tsx)$/.test(filePath)) continue;
    const content = readFileSync(filePath, 'utf-8');
    // Match `from '../some-template/...'` — single ../ referencing a sibling
    const matches = content.matchAll(/from\s+['"]\.\.\/([a-z0-9-]+)\//g);
    for (const m of matches) {
      const candidate = m[1];
      // Verify it's an actual template directory, not a parent like 'lib'
      if (existsSync(join(TEMPLATES_DIR, candidate, 'meta.json'))) {
        slugs.add(candidate);
      }
    }
  }
  return Array.from(slugs);
}

function contentHash(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 12);
}

// ── Main ────────────────────────────────────────────────────────────────────

interface ManifestEntry {
  slug: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  bundleFile: string;
  bundleHash: string;
  bundleSizeBytes: number;
  schemaFile: string;
  meta: Record<string, unknown>;
  compositionMeta: Record<string, unknown>;
  defaultProps: Record<string, unknown>;
}

async function buildTemplate(slug: string): Promise<ManifestEntry> {
  const templateDir = join(TEMPLATES_DIR, slug);
  const metaPath = join(templateDir, 'meta.json');
  const compositionMetaPath = join(templateDir, 'metadata.json');

  if (!existsSync(metaPath)) {
    throw new Error(`No meta.json found for template: ${slug}`);
  }

  const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
  const compositionMeta = existsSync(compositionMetaPath)
    ? JSON.parse(readFileSync(compositionMetaPath, 'utf-8'))
    : {};

  console.log(`  Building ${slug}...`);

  // ── 1. Create resolved source directory ──────────────────────────
  const resolvedDir = join(DIST_DIR, slug, '_resolved_source');
  if (existsSync(resolvedDir)) {
    rmSync(resolvedDir, { recursive: true, force: true });
  }
  mkdirSync(resolvedDir, { recursive: true });

  // Copy template source files
  copyDirRecursive(templateDir, resolvedDir);

  // Copy shared modules into the resolved directory
  const fontsPath = join(SRC_DIR, 'fonts.ts');
  if (existsSync(fontsPath)) {
    cpSync(fontsPath, join(resolvedDir, 'fonts.ts'));
  }

  const useScalePath = join(SRC_DIR, 'use-scale.ts');
  if (existsSync(useScalePath)) {
    cpSync(useScalePath, join(resolvedDir, 'use-scale.ts'));
  }

  const libDir = join(SRC_DIR, 'lib');
  if (existsSync(libDir)) {
    copyDirRecursive(libDir, join(resolvedDir, 'lib'));
  }

  const magazineDir = join(SRC_DIR, 'magazine');
  if (existsSync(magazineDir)) {
    copyDirRecursive(magazineDir, join(resolvedDir, 'magazine'));
  }

  const blackboardDir = join(SRC_DIR, 'blackboard');
  if (existsSync(blackboardDir)) {
    copyDirRecursive(blackboardDir, join(resolvedDir, 'blackboard'));
  }

  // ── 1b. Copy sibling template dependencies ────────────────────────
  // Some templates import from siblings (e.g. ../country-highlight/).
  // Since resolvedDir is at _resolved_source/, ../ resolves to the parent
  // (dist/bundles/{slug}/), so copy sibling templates there.
  const siblingDeps = detectSiblingTemplateDeps(resolvedDir);
  for (const siblingSlug of siblingDeps) {
    const siblingDir = join(TEMPLATES_DIR, siblingSlug);
    const siblingDest = join(DIST_DIR, slug, siblingSlug);
    if (existsSync(siblingDir) && !existsSync(siblingDest)) {
      copyDirRecursive(siblingDir, siblingDest);
      // Also rewrite ../../ imports within the sibling's files
      rewriteRelativeImports(siblingDest);
      // Copy shared modules into sibling too so its imports resolve
      if (existsSync(fontsPath)) cpSync(fontsPath, join(siblingDest, 'fonts.ts'));
      if (existsSync(useScalePath)) cpSync(useScalePath, join(siblingDest, 'use-scale.ts'));
      if (existsSync(libDir)) copyDirRecursive(libDir, join(siblingDest, 'lib'));
    }
  }

  // ── 2. Rewrite ../../ imports to ./ ───────────────────────────────
  rewriteRelativeImports(resolvedDir);

  // ── 3. Determine entry point ──────────────────────────────────────
  const entryPoint = existsSync(join(resolvedDir, 'index.tsx'))
    ? join(resolvedDir, 'index.tsx')
    : join(resolvedDir, 'index.ts');

  if (!existsSync(entryPoint)) {
    throw new Error(`No index.tsx or index.ts found for template: ${slug}`);
  }

  // ── 4. Bundle with esbuild ────────────────────────────────────────
  const tempBundlePath = join(DIST_DIR, slug, '_temp_bundle.js');

  await build({
    entryPoints: [entryPoint],
    absWorkingDir: PKG_ROOT,
    bundle: true,
    format: 'esm',
    outfile: tempBundlePath,
    minify: true,
    sourcemap: false,
    target: 'es2022',
    jsx: 'transform',
    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment',
    // Override tsconfig jsx setting — prevents esbuild from reading
    // the project tsconfig which has "jsx": "react-jsx" (automatic runtime)
    tsconfigRaw: JSON.stringify({
      compilerOptions: {
        jsx: 'react',
        esModuleInterop: true,
        resolveJsonModule: true,
      },
    }),
    plugins: [
      globalsPlugin({
        'react': 'React',
        'react-dom': 'ReactDOM',
        'react/jsx-runtime': 'React',
        'react/jsx-dev-runtime': 'React',
        'remotion': 'Remotion',
        '@remotion/core': 'Remotion',
      }),
      // Resolve bare npm imports from the package root (not the temp dir)
      nodeModulesPlugin(PKG_ROOT),
    ],
    loader: { '.json': 'json', '.png': 'dataurl', '.svg': 'dataurl' },
    logLevel: 'warning',
  });

  // ── 5. Content-hash the bundle ────────────────────────────────────
  const bundleContent = readFileSync(tempBundlePath);
  const hash = contentHash(bundleContent);
  const bundleFileName = `${slug}.${hash}.js`;
  const finalBundlePath = join(DIST_DIR, slug, bundleFileName);

  // Rename temp → final hashed name
  writeFileSync(finalBundlePath, bundleContent);
  rmSync(tempBundlePath, { force: true });

  const bundleSizeBytes = statSync(finalBundlePath).size;

  // ── 6. Convert Zod schema to JSON Schema ──────────────────────────
  const schemaPath = join(templateDir, 'schema.ts');
  let jsonSchema: Record<string, unknown> = {};
  let defaultProps: Record<string, unknown> = {};

  if (existsSync(schemaPath)) {
    try {
      // Dynamic import of the original TypeScript schema (tsx handles it)
      const normalizedPath = schemaPath.replace(/\\/g, '/');
      const schemaModule = await import(`file:///${normalizedPath}`);

      if (schemaModule.schema) {
        const { zodToJsonSchema } = await import('zod-to-json-schema');
        jsonSchema = zodToJsonSchema(schemaModule.schema, {
          name: slug,
          $refStrategy: 'none',
        }) as Record<string, unknown>;
      }

      if (schemaModule.defaultProps) {
        defaultProps = schemaModule.defaultProps;
      }
    } catch (err) {
      console.warn(`    Warning: Could not convert schema for ${slug}:`, (err as Error).message);
    }
  }

  const schemaFileName = `${slug}.schema.json`;
  writeFileSync(
    join(DIST_DIR, slug, schemaFileName),
    JSON.stringify(jsonSchema, null, 2),
    'utf-8',
  );

  // ── 7. Clean up resolved source directory + sibling copies ────────
  rmSync(resolvedDir, { recursive: true, force: true });
  for (const siblingSlug of siblingDeps) {
    const siblingDest = join(DIST_DIR, slug, siblingSlug);
    if (existsSync(siblingDest)) {
      rmSync(siblingDest, { recursive: true, force: true });
    }
  }

  const sizeKb = (bundleSizeBytes / 1024).toFixed(1);
  console.log(`    ✓ ${bundleFileName} (${sizeKb} KB)`);

  return {
    slug,
    name: meta.name || slug,
    description: meta.description || '',
    category: meta.category || '',
    tags: meta.tags || [],
    bundleFile: `${slug}/${bundleFileName}`,
    bundleHash: hash,
    bundleSizeBytes,
    schemaFile: `${slug}/${schemaFileName}`,
    meta: {
      stylePreset: meta.stylePreset,
      aspectRatio: meta.aspectRatio,
      estimatedDuration: meta.estimatedDuration,
      sceneCount: meta.sceneCount,
      type: meta.type,
      themes: meta.themes,
    },
    compositionMeta,
    defaultProps,
  };
}

async function main() {
  console.log('Building template bundles...\n');

  // Clean dist/bundles
  if (existsSync(DIST_DIR)) {
    rmSync(DIST_DIR, { recursive: true, force: true });
  }
  mkdirSync(DIST_DIR, { recursive: true });

  // Discover templates
  const templateSlugs = readdirSync(TEMPLATES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .filter((d) => existsSync(join(TEMPLATES_DIR, d.name, 'meta.json')))
    .map((d) => d.name)
    .sort();

  if (templateSlugs.length === 0) {
    console.log('No templates found.');
    return;
  }

  console.log(`Found ${templateSlugs.length} templates: ${templateSlugs.join(', ')}\n`);

  // Build each template
  const manifest: ManifestEntry[] = [];
  let failures = 0;

  for (const slug of templateSlugs) {
    try {
      const entry = await buildTemplate(slug);
      manifest.push(entry);
    } catch (err) {
      console.error(`  ✗ Failed to build ${slug}:`, (err as Error).message);
      failures++;
    }
  }

  // Write manifest
  const manifestPath = join(DIST_DIR, 'manifest.json');
  writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        version: 1,
        builtAt: new Date().toISOString(),
        templates: manifest,
      },
      null,
      2,
    ),
    'utf-8',
  );

  console.log(`\nManifest written to ${manifestPath}`);
  console.log(`${manifest.length} templates built successfully${failures > 0 ? `, ${failures} failed` : ''}.`);

  if (failures > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
