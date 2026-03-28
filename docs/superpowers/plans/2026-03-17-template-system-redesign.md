# Template System Redesign — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static template system with a backend-driven architecture: DB metadata, S3 storage, esbuild bundles, lightweight Remotion render pipeline, and templates tab in the web app.

**Architecture:** Templates stored in S3 (source + pre-compiled bundles + assets), metadata in PostgreSQL. Frontend loads bundles dynamically via fetch + blob URL. Worker renders MP4 from raw source via Remotion. Build CLI compiles, uploads, and registers templates.

**Tech Stack:** PostgreSQL/Drizzle, S3/MinIO, esbuild, Remotion, BullMQ, Fastify, Next.js 15, React 19, Zod, `zod-to-json-schema`

**Spec:** `docs/superpowers/specs/2026-03-17-template-system-redesign.md`

---

## File Map

### New Files
| Path | Purpose |
|------|---------|
| `packages/api/drizzle/0023_add_templates.sql` | Migration: `templates` + `template_exports` tables |
| `packages/api/src/routes/templates.ts` | Fastify routes for template listing, detail, export |
| `packages/worker/src/processors/render-template.ts` | Lightweight Remotion render processor |
| `packages/templates/scripts/build-templates.ts` | Build CLI: esbuild + screenshot + S3 upload + DB upsert |
| `packages/templates/scripts/esbuild-globals-plugin.ts` | esbuild plugin: rewrites React/Remotion imports to window globals |
| `apps/web/src/app/(dashboard)/projects/templates-tab.tsx` | Templates browse grid (Client Component) |
| `apps/web/src/app/(dashboard)/templates/[slug]/page.tsx` | Template detail page with Player + props editor |
| `apps/web/src/components/template-card.tsx` | Template card for browse grid |
| `apps/web/src/components/template-props-editor.tsx` | Auto-generated form from JSON Schema |
| `apps/web/src/components/template-bundle-loader.tsx` | Fetch + blob URL template loading |
| `apps/web/src/lib/template-globals.ts` | Exposes React/Remotion on `window` for template bundles |

### Modified Files
| Path | Change |
|------|--------|
| `packages/api/src/db/schema.ts` | Add `templates` + `templateExports` table definitions |
| `packages/api/src/index.ts` | Register template routes |
| `packages/api/src/services/minio.ts` | Add `templates` prefix if not present |
| `packages/worker/src/index.ts` | Register `render-template` worker |
| `packages/worker/src/db/index.ts` | Add `templateExports` table to worker's DB schema |
| `packages/api/src/services/queue.ts` | Add `renderTemplateQueue` export |
| `packages/templates/package.json` | Add `templates:build` script, add `esbuild` + `zod-to-json-schema` deps |
| `packages/templates/src/index.ts` | Remove 87 template imports, keep 3 |
| `packages/templates/src/types.ts` | Update types for new system |
| `apps/web/src/lib/api.ts` | Add template API client methods |
| `apps/web/src/app/(dashboard)/projects/page.tsx` | Add tab switching between Projects and Templates |
| `apps/web/package.json` | Add `remotion` to dependencies if not present (for Player) |

### Deleted Files/Directories
| Path | Reason |
|------|--------|
| `apps/templates/` (entire directory) | Standalone gallery app removed |
| `packages/templates/src/templates/*` (87 dirs) | All templates except `globe-spin`, `watercolor-map`, `country-highlight` |
| `packages/templates/r/*` (87 JSON files) | Registry output files for removed templates |
| `packages/worker/workspace/src/.templates/*` (matching dirs) | Cached workspace copies of removed templates |

---

## Task 1: Delete the Standalone Gallery App

**Files:**
- Delete: `apps/templates/` (entire directory)

- [ ] **Step 1: Verify apps/templates exists and check for cross-references**

Run: `grep -r "apps/templates" --include="*.json" --include="*.ts" --include="*.js" . | grep -v node_modules | grep -v ".git"`

Check for references in root `package.json` (workspace config), `turbo.json`, etc.

- [ ] **Step 2: Remove apps/templates from workspace config**

In root `package.json`, the `workspaces` field likely includes `apps/*`. Since other apps exist in `apps/`, this glob stays. If `turbo.json` or other configs reference `@viona/templates-app` specifically, remove those references.

- [ ] **Step 3: Delete the directory**

```bash
rm -rf apps/templates
```

- [ ] **Step 4: Verify build still works**

```bash
pnpm install
```

Ensure no broken workspace references.

- [ ] **Step 5: Commit**

```bash
git add -A apps/templates
git add package.json turbo.json  # if modified
git commit -m "chore: remove standalone templates gallery app"
```

---

## Task 2: Prune Templates — Keep Only 3

**Files:**
- Delete: 87 template directories from `packages/templates/src/templates/`
- Modify: `packages/templates/src/index.ts`

- [ ] **Step 1: List all template directories**

```bash
ls packages/templates/src/templates/
```

Identify all directories that are NOT `globe-spin`, `watercolor-map`, `country-highlight`.

- [ ] **Step 2: Delete all template directories except the 3 keepers**

Write a small Node.js script or use the following approach (works on Windows + Unix):

```bash
# From repo root, using node one-liner:
node -e "
const fs = require('fs');
const path = require('path');
const dir = 'packages/templates/src/templates';
const keep = new Set(['globe-spin', 'watercolor-map', 'country-highlight']);
for (const entry of fs.readdirSync(dir)) {
  if (!keep.has(entry) && fs.statSync(path.join(dir, entry)).isDirectory()) {
    fs.rmSync(path.join(dir, entry), { recursive: true, force: true });
    console.log('Deleted:', entry);
  }
}
"
```

- [ ] **Step 3: Update `packages/templates/src/index.ts`**

Remove all import lines for deleted templates. Keep only:

```typescript
import './templates/globe-spin/register';
import './templates/watercolor-map/register';
import './templates/country-highlight/register';
```

Plus any re-exports of registry functions (`getTemplate`, `listTemplates`, etc.).

- [ ] **Step 4: Delete stale registry output files**

```bash
node -e "
const fs = require('fs');
const path = require('path');
const dir = 'packages/templates/r';
const keep = new Set(['globe-spin.json', 'watercolor-map.json', 'country-highlight.json', 'use-scale.json', 'fonts.json']);
for (const f of fs.readdirSync(dir)) {
  if (!keep.has(f) && f.endsWith('.json')) {
    fs.unlinkSync(path.join(dir, f));
    console.log('Deleted:', f);
  }
}
"
```

- [ ] **Step 5: Clean workspace template cache**

```bash
node -e "
const fs = require('fs');
const path = require('path');
const dir = 'packages/worker/workspace/src/.templates';
if (fs.existsSync(dir)) {
  const keep = new Set(['globe-spin', 'watercolor-map', 'country-highlight']);
  for (const entry of fs.readdirSync(dir)) {
    if (!keep.has(entry) && fs.statSync(path.join(dir, entry)).isDirectory()) {
      fs.rmSync(path.join(dir, entry), { recursive: true, force: true });
      console.log('Deleted:', entry);
    }
  }
}
"
```

- [ ] **Step 6: Rebuild to verify nothing is broken**

```bash
cd packages/templates
pnpm build
```

Expected: Build succeeds with only 3 templates registered.

- [ ] **Step 7: Commit**

```bash
git add -A packages/templates packages/worker/workspace/src/.templates
git commit -m "chore: prune templates to 3 keepers (globe-spin, watercolor-map, country-highlight)"
```

---

## Task 3: Database Schema — Templates + Template Exports

**Files:**
- Modify: `packages/api/src/db/schema.ts`
- Create: `packages/api/drizzle/0023_add_templates.sql`

- [ ] **Step 1: Check the current latest migration number**

```bash
ls packages/api/drizzle/ | tail -5
```

Use the next sequential number (adjust `0023` if needed).

- [ ] **Step 2: Add Drizzle table definitions to `schema.ts`**

Add to `packages/api/src/db/schema.ts`:

```typescript
export const templates = pgTable('templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  category: varchar('category', { length: 100 }).notNull(),
  tags: jsonb('tags').$type<string[]>().default([]),
  aspectRatio: varchar('aspect_ratio', { length: 10 }).notNull().default('16:9'),
  durationFrames: integer('duration_frames').notNull().default(360),
  fps: integer('fps').notNull().default(30),
  width: integer('width').notNull().default(1920),
  height: integer('height').notNull().default(1080),
  propsSchema: jsonb('props_schema').$type<Record<string, unknown>>(),
  defaultProps: jsonb('default_props').$type<Record<string, unknown>>(),
  screenshotUrl: varchar('screenshot_url', { length: 1024 }),
  bundleKey: varchar('bundle_key', { length: 1024 }),
  sourceKey: varchar('source_key', { length: 1024 }),
  version: integer('version').notNull().default(1),
  isPublished: boolean('is_published').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type Template = typeof templates.$inferSelect;
export type NewTemplate = typeof templates.$inferInsert;

export const templateExports = pgTable('template_exports', {
  id: uuid('id').primaryKey().defaultRandom(),
  templateId: uuid('template_id').notNull().references(() => templates.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  props: jsonb('props').$type<Record<string, unknown>>(),
  status: varchar('status', { length: 50 }).notNull().default('queued'),
  outputUrl: varchar('output_url', { length: 1024 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
});

export type TemplateExport = typeof templateExports.$inferSelect;
export type NewTemplateExport = typeof templateExports.$inferInsert;
```

- [ ] **Step 3: Write the SQL migration**

Create `packages/api/drizzle/0023_add_templates.sql`:

```sql
-- Templates table
CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) NOT NULL,
  tags JSONB DEFAULT '[]',
  aspect_ratio VARCHAR(10) NOT NULL DEFAULT '16:9',
  duration_frames INTEGER NOT NULL DEFAULT 360,
  fps INTEGER NOT NULL DEFAULT 30,
  width INTEGER NOT NULL DEFAULT 1920,
  height INTEGER NOT NULL DEFAULT 1080,
  props_schema JSONB,
  default_props JSONB,
  screenshot_url VARCHAR(1024),
  bundle_key VARCHAR(1024),
  source_key VARCHAR(1024),
  version INTEGER NOT NULL DEFAULT 1,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Index for filtering
CREATE INDEX idx_templates_category ON templates(category);
CREATE INDEX idx_templates_is_published ON templates(is_published);
CREATE INDEX idx_templates_slug ON templates(slug);

-- Template exports table
CREATE TABLE IF NOT EXISTS template_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  props JSONB,
  status VARCHAR(50) NOT NULL DEFAULT 'queued',
  output_url VARCHAR(1024),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMP
);

CREATE INDEX idx_template_exports_user ON template_exports(user_id);
CREATE INDEX idx_template_exports_status ON template_exports(status);
```

- [ ] **Step 4: Run the migration locally**

```bash
cd packages/api
pnpm dev  # or run migration directly
```

Verify tables are created in the database.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/db/schema.ts packages/api/drizzle/0023_add_templates.sql
git commit -m "feat: add templates and template_exports database tables"
```

---

## Task 4: esbuild Globals Plugin

**Files:**
- Create: `packages/templates/scripts/esbuild-globals-plugin.ts`

- [ ] **Step 1: Install esbuild as a dev dependency**

```bash
cd packages/templates
pnpm add -D esbuild
```

- [ ] **Step 2: Write the esbuild plugin**

Create `packages/templates/scripts/esbuild-globals-plugin.ts`:

```typescript
import type { Plugin } from 'esbuild';

/**
 * esbuild plugin that rewrites imports of specified packages to reference
 * window globals. This allows template bundles to use React/Remotion from
 * the host app without bundling them.
 *
 * Example: `import React from 'react'` → `const React = window.React`
 */
export function globalsPlugin(globals: Record<string, string>): Plugin {
  return {
    name: 'globals',
    setup(build) {
      // For each global mapping, intercept the import and return a module
      // that re-exports from the window global
      for (const [moduleName, globalName] of Object.entries(globals)) {
        const filter = new RegExp(`^${moduleName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);

        build.onResolve({ filter }, (args) => ({
          path: args.path,
          namespace: 'globals',
        }));

        build.onLoad({ filter: /.*/, namespace: 'globals' }, (args) => {
          const g = globals[args.path];
          return {
            contents: `
              const mod = window["${g}"];
              export default mod;
              export const {${getNamedExports(g)}} = mod;
            `,
            loader: 'js',
          };
        });
      }
    },
  };
}

/**
 * Returns a comma-separated list of commonly used named exports for
 * each library. This handles `import { useState } from 'react'` etc.
 */
function getNamedExports(globalName: string): string {
  const exports: Record<string, string[]> = {
    React: [
      'useState', 'useEffect', 'useCallback', 'useMemo', 'useRef',
      'useContext', 'useReducer', 'useId', 'forwardRef', 'memo',
      'createContext', 'createElement', 'Fragment', 'Suspense', 'lazy',
      'Children', 'cloneElement', 'isValidElement',
    ],
    ReactDOM: ['createRoot', 'createPortal', 'flushSync'],
    Remotion: [
      'useCurrentFrame', 'useVideoConfig', 'interpolate', 'spring',
      'Sequence', 'AbsoluteFill', 'Img', 'Audio', 'Video',
      'staticFile', 'delayRender', 'continueRender', 'Easing',
      'random', 'measureSpring',
    ],
  };

  return (exports[globalName] || []).join(', ');
}
```

- [ ] **Step 3: Test the plugin works with a simple build**

Create a quick test in `scripts/temp/`:

```bash
cd packages/templates
npx esbuild --version  # verify esbuild is installed
```

- [ ] **Step 4: Commit**

```bash
git add packages/templates/scripts/esbuild-globals-plugin.ts packages/templates/package.json
git commit -m "feat: add esbuild globals plugin for template bundle externals"
```

---

## Task 5: Template Build CLI

**Files:**
- Create: `packages/templates/scripts/build-templates.ts`
- Modify: `packages/templates/package.json`

- [ ] **Step 1: Install dependencies**

```bash
cd packages/templates
pnpm add -D zod-to-json-schema @remotion/renderer @remotion/bundler
```

- [ ] **Step 2: Write the build script**

Create `packages/templates/scripts/build-templates.ts`:

```typescript
import { build } from 'esbuild';
import { globalsPlugin } from './esbuild-globals-plugin.js';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { createHash } from 'crypto';
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync, cpSync } from 'fs';
import { join, resolve, relative } from 'path';

const TEMPLATES_DIR = resolve(import.meta.dirname, '../src/templates');
const SHARED_DIR = resolve(import.meta.dirname, '../src');
const DIST_DIR = resolve(import.meta.dirname, '../dist/bundles');
const KEEPER_TEMPLATES = ['globe-spin', 'watercolor-map', 'country-highlight'];

interface TemplateBuildResult {
  slug: string;
  bundlePath: string;
  bundleHash: string;
  meta: Record<string, unknown>;
  propsSchema: Record<string, unknown>;
  defaultProps: Record<string, unknown>;
  sourceDir: string;
}

async function buildTemplate(slug: string): Promise<TemplateBuildResult> {
  const templateDir = join(TEMPLATES_DIR, slug);
  const outDir = join(DIST_DIR, slug);

  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  // 1. Prepare source: copy shared modules into a temp resolved dir
  const resolvedDir = join(outDir, '_resolved_source');
  if (existsSync(resolvedDir)) {
    // Clean previous resolved source
    const { rmSync } = await import('fs');
    rmSync(resolvedDir, { recursive: true, force: true });
  }
  mkdirSync(resolvedDir, { recursive: true });

  // Copy template source
  cpSync(templateDir, resolvedDir, { recursive: true });

  // Copy shared modules that templates reference via ../../
  const sharedFiles = ['fonts.ts', 'use-scale.ts'];
  for (const file of sharedFiles) {
    const src = join(SHARED_DIR, file);
    if (existsSync(src)) {
      cpSync(src, join(resolvedDir, file));
    }
  }

  // Copy shared lib/ directory (for watercolor-map's lib/map/)
  const libDir = join(SHARED_DIR, 'lib');
  if (existsSync(libDir)) {
    cpSync(libDir, join(resolvedDir, 'lib'), { recursive: true });
  }

  // Rewrite relative imports in copied files: ../../fonts → ./fonts, etc.
  rewriteRelativeImports(resolvedDir);

  // 2. esbuild: compile to ESM with globals plugin
  const entryPoint = join(resolvedDir, 'index.tsx');
  const bundleFile = join(outDir, 'bundle.tmp.js');

  await build({
    entryPoints: [entryPoint],
    bundle: true,
    format: 'esm',
    outfile: bundleFile,
    minify: true,
    sourcemap: false,
    target: 'es2022',
    jsx: 'transform',
    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment',
    plugins: [
      globalsPlugin({
        'react': 'React',
        'react-dom': 'ReactDOM',
        'react/jsx-runtime': 'React',
        'react/jsx-dev-runtime': 'React',
        'remotion': 'Remotion',
        '@remotion/core': 'Remotion',
      }),
    ],
    loader: {
      '.json': 'json',
      '.png': 'dataurl',
      '.svg': 'dataurl',
    },
  });

  // 3. Content hash the bundle
  const bundleContent = readFileSync(bundleFile);
  const hash = createHash('md5').update(bundleContent).digest('hex').slice(0, 8);
  const hashedBundleName = `bundle.${hash}.js`;
  const hashedBundlePath = join(outDir, hashedBundleName);

  const { renameSync } = await import('fs');
  renameSync(bundleFile, hashedBundlePath);

  // 4. Load meta and schema
  const metaPath = join(templateDir, 'meta.json');
  const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));

  // Compile and import schema to get Zod object + default props
  // tsx handles dynamic .ts imports when running under tsx CLI
  const schemaPath = join(templateDir, 'schema.ts');
  const schemaModule = await import(`file://${schemaPath.replace(/\\/g, '/')}`);
  const zodSchema = schemaModule.schema;
  const defaultProps = schemaModule.defaultProps || zodSchema.parse({});
  const propsSchema = zodToJsonSchema(zodSchema);

  console.log(`  ✓ ${slug} → ${hashedBundleName} (${(bundleContent.length / 1024).toFixed(1)} KB)`);

  return {
    slug,
    bundlePath: hashedBundlePath,
    bundleHash: hash,
    meta,
    propsSchema,
    defaultProps,
    sourceDir: resolvedDir,
  };
}

function rewriteRelativeImports(dir: string): void {
  const files = readdirSync(dir);
  for (const file of files) {
    const fullPath = join(dir, file);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      rewriteRelativeImports(fullPath);
      continue;
    }

    if (!file.endsWith('.ts') && !file.endsWith('.tsx')) continue;

    let content = readFileSync(fullPath, 'utf-8');
    // Rewrite ../../fonts → ./fonts, ../../use-scale → ./use-scale, ../../lib/ → ./lib/
    content = content.replace(
      /from\s+['"]\.\.\/\.\.\/([^'"]+)['"]/g,
      "from './$1'"
    );
    writeFileSync(fullPath, content);
  }
}

async function main() {
  console.log('Building templates...\n');

  if (!existsSync(DIST_DIR)) mkdirSync(DIST_DIR, { recursive: true });

  const results: TemplateBuildResult[] = [];

  for (const slug of KEEPER_TEMPLATES) {
    const templateDir = join(TEMPLATES_DIR, slug);
    if (!existsSync(templateDir)) {
      console.error(`  ✗ ${slug} — directory not found`);
      continue;
    }

    try {
      const result = await buildTemplate(slug);
      results.push(result);
    } catch (err) {
      console.error(`  ✗ ${slug} — build failed:`, err);
    }
  }

  console.log(`\nBuilt ${results.length}/${KEEPER_TEMPLATES.length} templates`);

  // Write manifest for upload step
  const manifest = results.map((r) => ({
    slug: r.slug,
    bundlePath: r.bundlePath,
    bundleHash: r.bundleHash,
    meta: r.meta,
    propsSchema: r.propsSchema,
    defaultProps: r.defaultProps,
    sourceDir: r.sourceDir,
  }));

  writeFileSync(join(DIST_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`Manifest written to dist/bundles/manifest.json`);
}

main().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
```

- [ ] **Step 3: Add the build script to package.json**

In `packages/templates/package.json`, add to `"scripts"`:

```json
"templates:build": "tsx scripts/build-templates.ts"
```

- [ ] **Step 4: Run the build to verify**

```bash
cd packages/templates
pnpm templates:build
```

Expected: 3 templates compile successfully, `dist/bundles/manifest.json` written.

- [ ] **Step 5: Commit**

```bash
git add packages/templates/scripts/build-templates.ts packages/templates/package.json
git commit -m "feat: add template build CLI with esbuild compilation"
```

---

## Task 6: S3 Upload + DB Upsert Script

**Files:**
- Create: `packages/templates/scripts/upload-templates.ts`

This is a separate script from the build so they can be run independently. The `templates:build` can be extended to call this, or it can be run as `pnpm templates:upload`.

- [ ] **Step 1: Write the upload script**

Create `packages/templates/scripts/upload-templates.ts`:

```typescript
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { Client as MinioClient } from 'minio';
import pg from 'pg';

const DIST_DIR = resolve(import.meta.dirname, '../dist/bundles');

// Config from env
const S3_ENDPOINT = process.env.S3_ENDPOINT || 'localhost';
const S3_PORT = parseInt(process.env.S3_PORT || '9000');
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY || 'minioadmin';
const S3_SECRET_KEY = process.env.S3_SECRET_KEY || 'minioadmin';
const S3_BUCKET = process.env.S3_BUCKET || 'viona';
const S3_USE_SSL = process.env.S3_USE_SSL === 'true';
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/viona';

const minio = new MinioClient({
  endPoint: S3_ENDPOINT,
  port: S3_PORT,
  useSSL: S3_USE_SSL,
  accessKey: S3_ACCESS_KEY,
  secretKey: S3_SECRET_KEY,
});

async function uploadDirectory(localDir: string, s3Prefix: string): Promise<void> {
  const files = getAllFiles(localDir);
  for (const file of files) {
    const relativePath = file.replace(localDir, '').replace(/\\/g, '/').replace(/^\//, '');
    const s3Key = `${s3Prefix}${relativePath}`;
    const content = readFileSync(file);
    await minio.putObject(S3_BUCKET, s3Key, content);
  }
}

function getAllFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      results.push(...getAllFiles(fullPath));
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

async function main() {
  // Read build manifest
  const manifest = JSON.parse(readFileSync(join(DIST_DIR, 'manifest.json'), 'utf-8'));

  // Ensure bucket exists
  const bucketExists = await minio.bucketExists(S3_BUCKET);
  if (!bucketExists) {
    await minio.makeBucket(S3_BUCKET);
  }

  const pool = new pg.Pool({ connectionString: DATABASE_URL });

  for (const template of manifest) {
    const { slug, bundlePath, bundleHash, meta, propsSchema, defaultProps, sourceDir } = template;
    const s3Prefix = `templates/${slug}/`;

    console.log(`Uploading ${slug}...`);

    // Upload bundle — S3 key includes full path, DB stores WITHOUT 'templates/' prefix
    const bundleContent = readFileSync(bundlePath);
    const fullBundleKey = `templates/${slug}/bundle.${bundleHash}.js`;
    const dbBundleKey = `${slug}/bundle.${bundleHash}.js`; // stored in DB without prefix
    await minio.putObject(S3_BUCKET, fullBundleKey, bundleContent, undefined, {
      'Content-Type': 'application/javascript',
    });

    // Upload resolved source files (for worker rendering)
    await uploadDirectory(sourceDir, `templates/${slug}/source/`);

    // Upload assets if they exist
    const assetsDir = join(resolve(import.meta.dirname, '../src/templates', slug), 'assets');
    if (statSync(assetsDir, { throwIfNoEntry: false })) {
      await uploadDirectory(assetsDir, `templates/${slug}/assets/`);
    }

    // Generate screenshot using renderStill (Remotion API)
    let screenshotKey: string | null = null;
    try {
      const { bundle: remotionBundle } = await import('@remotion/bundler');
      const { renderStill, selectComposition } = await import('@remotion/renderer');

      // Create temp entry for Remotion
      const tempEntry = join(outDir, '_screenshot_entry.tsx');
      writeFileSync(tempEntry, `
import React from 'react';
import { registerRoot, Composition } from 'remotion';
import Component from './src/templates/${slug}/index';

const Root: React.FC = () => (
  <Composition id="screenshot" component={Component}
    durationInFrames={${compositionMeta.durationInFrames || 360}}
    fps={${compositionMeta.fps || 30}}
    width={${compositionMeta.width || 1920}}
    height={${compositionMeta.height || 1080}}
    defaultProps={${JSON.stringify(defaultProps)}} />
);
registerRoot(Root);
`);

      const screenshotBundlePath = join(outDir, '_screenshot_bundle');
      await remotionBundle({ entryPoint: tempEntry, outDir: screenshotBundlePath });

      const comp = await selectComposition({
        serveUrl: screenshotBundlePath,
        id: 'screenshot',
        inputProps: defaultProps,
      });

      const screenshotPath = join(outDir, 'screenshot.png');
      await renderStill({
        composition: comp,
        serveUrl: screenshotBundlePath,
        output: screenshotPath,
        frame: Math.floor((compositionMeta.durationInFrames || 360) / 3),
      });

      const fullScreenshotKey = `templates/${slug}/screenshot.png`;
      screenshotKey = `${slug}/screenshot.png`;
      const screenshotContent = readFileSync(screenshotPath);
      await minio.putObject(S3_BUCKET, fullScreenshotKey, screenshotContent, undefined, {
        'Content-Type': 'image/png',
      });

      console.log(`  ✓ ${slug} screenshot generated`);
    } catch (err) {
      console.warn(`  ⚠ ${slug} screenshot generation failed (non-fatal):`, (err as Error).message);
    }

    // Upsert into DB
    const compositionMeta = JSON.parse(
      readFileSync(join(resolve(import.meta.dirname, '../src/templates', slug), 'metadata.json'), 'utf-8')
    );

    await pool.query(
      `INSERT INTO templates (slug, name, description, category, tags, aspect_ratio,
        duration_frames, fps, width, height, props_schema, default_props,
        screenshot_url, bundle_key, source_key, version, is_published)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 1, true)
       ON CONFLICT (slug) DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         category = EXCLUDED.category,
         tags = EXCLUDED.tags,
         props_schema = EXCLUDED.props_schema,
         default_props = EXCLUDED.default_props,
         screenshot_url = EXCLUDED.screenshot_url,
         bundle_key = EXCLUDED.bundle_key,
         source_key = EXCLUDED.source_key,
         version = templates.version + 1,
         updated_at = NOW()`,
      [
        slug,
        meta.name,
        meta.description,
        meta.category,
        JSON.stringify(meta.tags || []),
        meta.aspectRatio || '16:9',
        compositionMeta.durationInFrames || 360,
        compositionMeta.fps || 30,
        compositionMeta.width || 1920,
        compositionMeta.height || 1080,
        JSON.stringify(propsSchema),
        JSON.stringify(defaultProps),
        screenshotKey,
        dbBundleKey,
        `${slug}/source/`,
      ]
    );

    console.log(`  ✓ ${slug} uploaded and registered`);
  }

  await pool.end();
  console.log('\nAll templates uploaded and registered.');
}

main().catch((err) => {
  console.error('Upload failed:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Add script to package.json**

```json
"templates:upload": "tsx scripts/upload-templates.ts",
"templates:publish": "pnpm templates:build && pnpm templates:upload"
```

- [ ] **Step 3: Test with local MinIO + DB**

```bash
cd packages/templates
pnpm templates:publish
```

Expected: Templates compiled, uploaded to S3, rows inserted in `templates` table.

- [ ] **Step 4: Commit**

```bash
git add packages/templates/scripts/upload-templates.ts packages/templates/package.json
git commit -m "feat: add template S3 upload and DB registration script"
```

---

## Task 7: API Routes — Template Listing and Detail

**Files:**
- Create: `packages/api/src/routes/templates.ts`
- Modify: `packages/api/src/index.ts`

- [ ] **Step 1: Write the template routes**

Create `packages/api/src/routes/templates.ts`:

```typescript
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { eq, and, ilike, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { templates, templateExports } from '../db/schema.js';
import { authMiddleware } from '../middleware/auth.js';
import { getPresignedDownloadUrl } from '../services/minio.js';

const listQuerySchema = z.object({
  category: z.string().optional(),
  search: z.string().optional(),
  aspectRatio: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20),
});

export async function templateRoutes(fastify: FastifyInstance) {
  // GET /templates — list with filters (public)
  fastify.get('/templates', async (request, reply) => {
    const query = listQuerySchema.parse(request.query);
    const { category, search, aspectRatio, page, limit } = query;
    const offset = (page - 1) * limit;

    const conditions = [eq(templates.isPublished, true)];

    if (category) {
      conditions.push(eq(templates.category, category));
    }
    if (aspectRatio) {
      conditions.push(eq(templates.aspectRatio, aspectRatio));
    }
    if (search) {
      conditions.push(ilike(templates.name, `%${search}%`));
    }

    const where = and(...conditions);

    const [items, countResult] = await Promise.all([
      db
        .select({
          id: templates.id,
          slug: templates.slug,
          name: templates.name,
          description: templates.description,
          category: templates.category,
          tags: templates.tags,
          aspectRatio: templates.aspectRatio,
          durationFrames: templates.durationFrames,
          fps: templates.fps,
          width: templates.width,
          height: templates.height,
          screenshotUrl: templates.screenshotUrl,
        })
        .from(templates)
        .where(where)
        .orderBy(templates.name)
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)` })
        .from(templates)
        .where(where),
    ]);

    // Generate presigned screenshot URLs
    // DB stores keys WITHOUT the 'templates/' prefix — minio service prepends it
    const itemsWithUrls = await Promise.all(
      items.map(async (item) => ({
        ...item,
        screenshotUrl: item.screenshotUrl
          ? await getPresignedDownloadUrl('templates', item.screenshotUrl, 3600)
          : null,
      }))
    );

    return {
      items: itemsWithUrls,
      total: Number(countResult[0]?.count || 0),
      page,
      limit,
    };
  });

  // GET /templates/categories — list categories with counts (public)
  fastify.get('/templates/categories', async (request, reply) => {
    const result = await db
      .select({
        category: templates.category,
        count: sql<number>`count(*)`,
      })
      .from(templates)
      .where(eq(templates.isPublished, true))
      .groupBy(templates.category)
      .orderBy(templates.category);

    return result.map((r) => ({ category: r.category, count: Number(r.count) }));
  });

  // GET /templates/:slug — full detail (public)
  fastify.get('/templates/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string };

    const template = await db.query.templates.findFirst({
      where: and(eq(templates.slug, slug), eq(templates.isPublished, true)),
    });

    if (!template) {
      return reply.status(404).send({ error: 'Template not found' });
    }

    // Generate presigned URL for the bundle
    // DB stores keys WITHOUT the 'templates/' prefix — minio service prepends it
    const bundleUrl = template.bundleKey
      ? await getPresignedDownloadUrl('templates', template.bundleKey, 3600)
      : null;

    // Asset base URL: return the S3 prefix for the template's assets directory.
    // Individual assets are fetched by appending filename to this base.
    // Note: This is NOT a presigned URL — assets should be served from a
    // public-read bucket path or individual presigned URLs generated on demand.
    const assetBaseUrl = `${slug}/assets`;

    const screenshotUrl = template.screenshotUrl
      ? await getPresignedDownloadUrl('templates', template.screenshotUrl, 3600)
      : null;

    return {
      ...template,
      bundleUrl,
      assetBaseUrl,
      screenshotUrl,
    };
  });

  // POST /templates/:slug/export — queue render job (auth required)
  fastify.post(
    '/templates/:slug/export',
    { preHandler: authMiddleware },
    async (request, reply) => {
      const { slug } = request.params as { slug: string };
      const userId = request.user!.id;

      // Rate limit: check recent exports
      const recentExports = await db
        .select({ count: sql<number>`count(*)` })
        .from(templateExports)
        .where(
          and(
            eq(templateExports.userId, userId),
            sql`${templateExports.createdAt} > NOW() - INTERVAL '1 hour'`
          )
        );

      if (Number(recentExports[0]?.count || 0) >= 5) {
        return reply.status(429).send({ error: 'Rate limit exceeded. Max 5 exports per hour.' });
      }

      const template = await db.query.templates.findFirst({
        where: and(eq(templates.slug, slug), eq(templates.isPublished, true)),
      });

      if (!template) {
        return reply.status(404).send({ error: 'Template not found' });
      }

      const body = (request.body as { props?: Record<string, unknown> }) || {};
      const props = body.props || template.defaultProps || {};

      // Create export record
      const [exportRecord] = await db
        .insert(templateExports)
        .values({
          templateId: template.id,
          userId,
          props,
          status: 'queued',
        })
        .returning();

      // Queue BullMQ job — use shared queue instance from queue.ts
      // (see Task 7, Step 1.5: add renderTemplateQueue to packages/api/src/services/queue.ts)
      const { renderTemplateQueue } = await import('../services/queue.js');

      await renderTemplateQueue.add('render-template', {
        exportId: exportRecord.id,
        templateId: template.id,
        slug: template.slug,
        sourceKey: template.sourceKey,
        props,
        width: template.width,
        height: template.height,
        fps: template.fps,
        durationInFrames: template.durationFrames,
      });

      return { exportId: exportRecord.id, status: 'queued' };
    }
  );

  // GET /templates/:slug/export/:exportId — poll status (auth required)
  fastify.get(
    '/templates/:slug/export/:exportId',
    { preHandler: authMiddleware },
    async (request, reply) => {
      const { exportId } = request.params as { exportId: string };
      const userId = request.user!.id;

      const exportRecord = await db.query.templateExports.findFirst({
        where: and(
          eq(templateExports.id, exportId),
          eq(templateExports.userId, userId)
        ),
      });

      if (!exportRecord) {
        return reply.status(404).send({ error: 'Export not found' });
      }

      let downloadUrl: string | null = null;
      if (exportRecord.status === 'completed' && exportRecord.outputUrl) {
        downloadUrl = await getPresignedDownloadUrl('', exportRecord.outputUrl, 28800);
      }

      return {
        id: exportRecord.id,
        status: exportRecord.status,
        downloadUrl,
        createdAt: exportRecord.createdAt,
        completedAt: exportRecord.completedAt,
      };
    }
  );
}
```

- [ ] **Step 1.5: Add render-template queue to queue.ts**

In `packages/api/src/services/queue.ts`, add alongside existing queue exports:

```typescript
export const renderTemplateQueue = new Queue('render-template', { connection });
```

Follow the existing pattern for other queues in the file.

- [ ] **Step 2: Register routes in API index**

In `packages/api/src/index.ts`, add:

```typescript
import { templateRoutes } from './routes/templates.js';

// In the route registration section:
fastify.register(templateRoutes, { prefix: '/api' });
```

- [ ] **Step 3: Verify the API starts without errors**

```bash
cd packages/api
pnpm dev
```

Test with curl:
```bash
curl http://localhost:4000/api/templates
curl http://localhost:4000/api/templates/categories
```

Expected: Empty arrays (no templates seeded yet) but no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/routes/templates.ts packages/api/src/index.ts
git commit -m "feat: add template API routes (list, detail, categories, export)"
```

---

## Task 8: Render-Template Worker Processor

**Files:**
- Create: `packages/worker/src/processors/render-template.ts`
- Modify: `packages/worker/src/index.ts`

- [ ] **Step 1: Write the processor**

Create `packages/worker/src/processors/render-template.ts`:

```typescript
import { Job } from 'bullmq';
import { join } from 'path';
import { mkdirSync, writeFileSync, existsSync, rmSync } from 'fs';
import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { db, templateExports } from '../db/index.js';
import { listObjects, downloadFile, uploadFile } from '../services/minio.js';
import { logger } from '../utils/index.js';

/**
 * Downloads all files under an S3 prefix into a local directory.
 * Uses listObjects + downloadFile since the minio service doesn't have
 * a built-in downloadDirectory helper.
 */
async function downloadS3Directory(prefix: string, s3Prefix: string, localDir: string): Promise<void> {
  const objects = await listObjects(prefix, s3Prefix);
  for (const obj of objects) {
    const relativePath = obj.name.replace(s3Prefix, '');
    if (!relativePath) continue;
    const localPath = join(localDir, relativePath);
    const dir = join(localPath, '..');
    mkdirSync(dir, { recursive: true });
    await downloadFile(prefix, obj.name, localPath);
  }
}

export interface RenderTemplateJobData {
  exportId: string;
  templateId: string;
  slug: string;
  sourceKey: string;
  props: Record<string, unknown>;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
}

export async function processRenderTemplateJob(job: Job<RenderTemplateJobData>) {
  const { exportId, slug, sourceKey, props, width, height, fps, durationInFrames } = job.data;
  const workDir = join(process.cwd(), 'tmp', `render-template-${nanoid(8)}`);

  try {
    // Update status to processing
    await db
      .update(templateExports)
      .set({ status: 'processing' })
      .where(eq(templateExports.id, exportId));

    logger.info({ slug, exportId }, 'Starting template render');

    // 1. Download source files from S3
    // sourceKey is relative (e.g., 'globe-spin/source/') — 'templates' prefix added by minio service
    const sourceDir = join(workDir, 'src');
    mkdirSync(sourceDir, { recursive: true });
    await downloadS3Directory('templates', sourceKey, sourceDir);

    // Download assets if they exist
    const assetsKey = sourceKey.replace('/source/', '/assets/');
    const assetsDir = join(workDir, 'public', 'assets');
    mkdirSync(assetsDir, { recursive: true });
    try {
      await downloadS3Directory('templates', assetsKey, assetsDir);
    } catch {
      // Assets may not exist for all templates
    }

    // 2. Create Remotion entry file
    const entryPath = join(workDir, 'entry.tsx');
    writeFileSync(
      entryPath,
      `
import React from 'react';
import { registerRoot, Composition } from 'remotion';
import TemplateComponent from './src/index';

const Root: React.FC = () => {
  return (
    <Composition
      id="template"
      component={TemplateComponent}
      durationInFrames={${durationInFrames}}
      fps={${fps}}
      width={${width}}
      height={${height}}
      defaultProps={${JSON.stringify(props)}}
    />
  );
};

registerRoot(Root);
`
    );

    // 3. Bundle with Remotion (webpack)
    const bundlePath = join(workDir, 'bundle');
    await bundle({
      entryPoint: entryPath,
      outDir: bundlePath,
    });

    // 4. Select composition and render
    const composition = await selectComposition({
      serveUrl: bundlePath,
      id: 'template',
      inputProps: props,
    });

    const outputPath = join(workDir, 'output.mp4');
    await renderMedia({
      composition,
      serveUrl: bundlePath,
      codec: 'h264',
      outputLocation: outputPath,
      inputProps: props,
    });

    // 5. Upload to S3
    const outputKey = `exports/${nanoid()}/output.mp4`;
    await uploadFile('outputs', outputKey, outputPath);

    // 6. Update DB
    await db
      .update(templateExports)
      .set({
        status: 'completed',
        outputUrl: outputKey,
        completedAt: new Date(),
      })
      .where(eq(templateExports.id, exportId));

    logger.info({ slug, exportId }, 'Template render completed');
  } catch (err) {
    logger.error({ slug, exportId, err }, 'Template render failed');

    await db
      .update(templateExports)
      .set({ status: 'failed' })
      .where(eq(templateExports.id, exportId));

    throw err;
  } finally {
    // Cleanup
    if (existsSync(workDir)) {
      rmSync(workDir, { recursive: true, force: true });
    }
  }
}
```

- [ ] **Step 1.5: Add `templateExports` to worker's DB schema**

The worker has its own DB schema at `packages/worker/src/db/index.ts` (duplicated from API). Add the `templateExports` table definition matching the one in `packages/api/src/db/schema.ts`.

- [ ] **Step 2: Register the worker in `packages/worker/src/index.ts`**

Add alongside the existing workers:

```typescript
import { processRenderTemplateJob, RenderTemplateJobData } from './processors/render-template.js';

// After existing worker registrations:
const renderTemplateWorker = new Worker<RenderTemplateJobData>(
  'render-template',
  async (job) => {
    await processRenderTemplateJob(job);
  },
  {
    connection,
    concurrency: 2,
    lockDuration: 5 * 60 * 1000, // 5 minutes (templates are simpler than full renders)
    stalledInterval: 2 * 60 * 1000,
    maxStalledCount: 2,
  }
);

renderTemplateWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Render-template job completed');
});

renderTemplateWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Render-template job failed');
});
```

- [ ] **Step 3: Verify worker starts**

```bash
cd packages/worker
pnpm dev
```

Expected: Worker starts, `render-template` queue registered without errors.

- [ ] **Step 4: Commit**

```bash
git add packages/worker/src/processors/render-template.ts packages/worker/src/index.ts
git commit -m "feat: add lightweight render-template worker processor"
```

---

## Task 9: Frontend — API Client Methods

**Files:**
- Modify: `apps/web/src/lib/api.ts`

- [ ] **Step 1: Add template types and API methods**

Add to `apps/web/src/lib/api.ts`:

```typescript
export interface TemplateListItem {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string;
  tags: string[];
  aspectRatio: string;
  durationFrames: number;
  fps: number;
  width: number;
  height: number;
  screenshotUrl: string | null;
}

export interface TemplateDetail extends TemplateListItem {
  propsSchema: Record<string, unknown>;
  defaultProps: Record<string, unknown>;
  bundleUrl: string | null;
  assetBaseUrl: string | null;
  version: number;
}

export interface TemplateCategory {
  category: string;
  count: number;
}

export interface TemplateExportStatus {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  downloadUrl: string | null;
  createdAt: string;
  completedAt: string | null;
}

// Inside the api object:

async getTemplates(params?: {
  category?: string;
  search?: string;
  aspectRatio?: string;
  page?: number;
  limit?: number;
}): Promise<{ items: TemplateListItem[]; total: number; page: number; limit: number }> {
  const searchParams = new URLSearchParams();
  if (params?.category) searchParams.set('category', params.category);
  if (params?.search) searchParams.set('search', params.search);
  if (params?.aspectRatio) searchParams.set('aspectRatio', params.aspectRatio);
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.limit) searchParams.set('limit', String(params.limit));

  const res = await fetch(`${API_URL}/api/templates?${searchParams}`);
  if (!res.ok) throw new Error('Failed to fetch templates');
  return res.json();
},

async getTemplate(slug: string): Promise<TemplateDetail> {
  const res = await fetch(`${API_URL}/api/templates/${slug}`);
  if (!res.ok) throw new Error('Failed to fetch template');
  return res.json();
},

async getTemplateCategories(): Promise<TemplateCategory[]> {
  const res = await fetch(`${API_URL}/api/templates/categories`);
  if (!res.ok) throw new Error('Failed to fetch categories');
  return res.json();
},

async exportTemplate(slug: string, props: Record<string, unknown>): Promise<{ exportId: string }> {
  const token = await getSessionToken();
  const res = await fetch(`${API_URL}/api/templates/${slug}/export`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ props }),
  });
  if (!res.ok) throw new Error('Failed to export template');
  return res.json();
},

async getExportStatus(slug: string, exportId: string): Promise<TemplateExportStatus> {
  const token = await getSessionToken();
  const res = await fetch(`${API_URL}/api/templates/${slug}/export/${exportId}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch export status');
  return res.json();
},
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/api.ts
git commit -m "feat: add template API client methods"
```

---

## Task 10: Frontend — Template Globals Setup

**Files:**
- Create: `apps/web/src/lib/template-globals.ts`

- [ ] **Step 1: Create the globals setup module**

This script exposes React and Remotion on `window` so template bundles can reference them.

Create `apps/web/src/lib/template-globals.ts`:

```typescript
"use client";

import React from 'react';
import * as Remotion from 'remotion';

/**
 * Exposes React and Remotion on the window object so dynamically loaded
 * template bundles can reference them as externals.
 * Call this once on app startup before loading any template bundles.
 */
export function setupTemplateGlobals(): void {
  if (typeof window === 'undefined') return;

  (window as any).React = React;
  (window as any).Remotion = Remotion;
}

// Auto-setup on import
setupTemplateGlobals();
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/template-globals.ts
git commit -m "feat: add template globals setup (React/Remotion on window)"
```

---

## Task 11: Frontend — Template Bundle Loader

**Files:**
- Create: `apps/web/src/components/template-bundle-loader.tsx`

- [ ] **Step 1: Write the bundle loader component**

Create `apps/web/src/components/template-bundle-loader.tsx`:

```typescript
"use client";

import { useEffect, useState, useRef } from 'react';
import '@/lib/template-globals'; // ensure globals are set up

interface TemplateBundleLoaderProps {
  bundleUrl: string;
  onLoad: (Component: React.ComponentType<any>) => void;
  onError: (error: Error) => void;
}

// Cache loaded components to avoid re-fetching
const componentCache = new Map<string, React.ComponentType<any>>();

/**
 * Loads a template bundle from a URL using fetch + blob URL pattern.
 * The bundle is an ESM file that expects React and Remotion to be
 * available as window globals.
 */
export function useTemplateBundle(bundleUrl: string | null) {
  const [Component, setComponent] = useState<React.ComponentType<any> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!bundleUrl) return;

    // Check cache first
    const cached = componentCache.get(bundleUrl);
    if (cached) {
      setComponent(() => cached);
      return;
    }

    let cancelled = false;

    async function loadBundle() {
      setLoading(true);
      setError(null);

      try {
        // Fetch the bundle
        const response = await fetch(bundleUrl!);
        if (!response.ok) {
          throw new Error(`Failed to fetch template bundle: ${response.status}`);
        }

        const code = await response.text();

        // Create blob URL for same-origin import
        const blob = new Blob([code], { type: 'application/javascript' });
        const blobUrl = URL.createObjectURL(blob);
        blobUrlRef.current = blobUrl;

        // Dynamic import from blob URL
        const module = await import(/* webpackIgnore: true */ blobUrl);
        const LoadedComponent = module.default as React.ComponentType<any>;

        if (!cancelled) {
          componentCache.set(bundleUrl!, LoadedComponent);
          setComponent(() => LoadedComponent);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadBundle();

    return () => {
      cancelled = true;
      // Revoke blob URL on unmount
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [bundleUrl]);

  return { Component, loading, error };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/template-bundle-loader.tsx
git commit -m "feat: add template bundle loader with fetch + blob URL pattern"
```

---

## Task 12: Frontend — Projects Page Tab Switching

**Files:**
- Modify: `apps/web/src/app/(dashboard)/projects/page.tsx`
- Create: `apps/web/src/app/(dashboard)/projects/templates-tab.tsx`

- [ ] **Step 1: Add tab switching to the projects page**

Modify `apps/web/src/app/(dashboard)/projects/page.tsx` to add a tab bar at the top with "My Projects" and "Templates" tabs. Use a simple state variable `activeTab` to switch between the existing project list content and a new `<TemplatesTab />` component.

Add to imports:
```typescript
import { TemplatesTab } from './templates-tab';
```

Add tab state:
```typescript
const [activeTab, setActiveTab] = useState<'projects' | 'templates'>('projects');
```

Add tab bar UI above the existing content (use existing UI patterns from the codebase — likely Tailwind tab styles):
```tsx
<div className="flex gap-1 mb-6">
  <button
    onClick={() => setActiveTab('projects')}
    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
      activeTab === 'projects'
        ? 'bg-white/10 text-white'
        : 'text-white/50 hover:text-white/70'
    }`}
  >
    My Projects
  </button>
  <button
    onClick={() => setActiveTab('templates')}
    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
      activeTab === 'templates'
        ? 'bg-white/10 text-white'
        : 'text-white/50 hover:text-white/70'
    }`}
  >
    Templates
  </button>
</div>
```

Wrap existing project list in `{activeTab === 'projects' && (...)}` and add `{activeTab === 'templates' && <TemplatesTab />}`.

- [ ] **Step 2: Create the TemplatesTab component**

Create `apps/web/src/app/(dashboard)/projects/templates-tab.tsx`:

```typescript
"use client";

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api, type TemplateListItem, type TemplateCategory } from '@/lib/api';
import { TemplateCard } from '@/components/template-card';

export function TemplatesTab() {
  const router = useRouter();
  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [categories, setCategories] = useState<TemplateCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const [searchQuery, setSearchQuery] = useState('');
  const [aspectRatio, setAspectRatio] = useState<string | undefined>();

  const loadTemplates = useCallback(async () => {
    setIsLoading(true);
    try {
      const [templatesData, categoriesData] = await Promise.all([
        api.getTemplates({
          category: selectedCategory,
          search: searchQuery || undefined,
          aspectRatio,
        }),
        api.getTemplateCategories(),
      ]);
      setTemplates(templatesData.items);
      setCategories(categoriesData);
    } finally {
      setIsLoading(false);
    }
  }, [selectedCategory, searchQuery, aspectRatio]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  return (
    <div>
      {/* Filter Bar */}
      <div className="flex gap-3 mb-6 flex-wrap">
        {/* Search */}
        <input
          type="text"
          placeholder="Search templates..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/20 w-64"
        />

        {/* Category filter */}
        <select
          value={selectedCategory || ''}
          onChange={(e) => setSelectedCategory(e.target.value || undefined)}
          className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-white/20"
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat.category} value={cat.category}>
              {cat.category} ({cat.count})
            </option>
          ))}
        </select>

        {/* Aspect ratio filter */}
        <select
          value={aspectRatio || ''}
          onChange={(e) => setAspectRatio(e.target.value || undefined)}
          className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-white/20"
        >
          <option value="">All Ratios</option>
          <option value="16:9">16:9</option>
          <option value="9:16">9:16</option>
          <option value="1:1">1:1</option>
        </select>
      </div>

      {/* Template Grid */}
      {isLoading ? (
        <div className="text-white/50 text-center py-12">Loading templates...</div>
      ) : templates.length === 0 ? (
        <div className="text-white/50 text-center py-12">No templates found</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {templates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onClick={() => router.push(`/templates/${template.slug}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create the TemplateCard component**

Create `apps/web/src/components/template-card.tsx`:

```typescript
"use client";

import type { TemplateListItem } from '@/lib/api';

interface TemplateCardProps {
  template: TemplateListItem;
  onClick: () => void;
}

export function TemplateCard({ template, onClick }: TemplateCardProps) {
  return (
    <button
      onClick={onClick}
      className="group text-left bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:border-white/20 transition-all hover:bg-white/8"
    >
      {/* Screenshot */}
      <div className="aspect-video bg-white/5 relative overflow-hidden">
        {template.screenshotUrl ? (
          <img
            src={template.screenshotUrl}
            alt={template.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/20 text-sm">
            No preview
          </div>
        )}
        {/* Aspect ratio badge */}
        <span className="absolute top-2 right-2 px-2 py-0.5 bg-black/50 backdrop-blur rounded text-xs text-white/70">
          {template.aspectRatio}
        </span>
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="text-white text-sm font-medium truncate">{template.name}</h3>
        <p className="text-white/40 text-xs mt-1 truncate">
          {template.description || template.category}
        </p>
        {/* Tags */}
        {template.tags.length > 0 && (
          <div className="flex gap-1 mt-2 flex-wrap">
            {template.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-1.5 py-0.5 bg-white/5 rounded text-[10px] text-white/40"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}
```

- [ ] **Step 4: Verify the page renders**

```bash
cd apps/web
pnpm dev
```

Navigate to `/projects` — should see two tabs. Templates tab should load (empty or with seeded data).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/(dashboard)/projects/page.tsx apps/web/src/app/(dashboard)/projects/templates-tab.tsx apps/web/src/components/template-card.tsx
git commit -m "feat: add Templates tab to projects page with filter bar and grid"
```

---

## Task 13: Frontend — Template Detail Page

**Files:**
- Create: `apps/web/src/app/templates/[slug]/page.tsx`
- Create: `apps/web/src/components/template-props-editor.tsx`

- [ ] **Step 1: Create the detail page**

Create `apps/web/src/app/(dashboard)/templates/[slug]/page.tsx`:

```typescript
"use client";

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Player } from '@remotion/player';
import { api, type TemplateDetail } from '@/lib/api';
import { useTemplateBundle } from '@/components/template-bundle-loader';
import { TemplatePropsEditor } from '@/components/template-props-editor';

export default function TemplateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [template, setTemplate] = useState<TemplateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentProps, setCurrentProps] = useState<Record<string, unknown>>({});
  const [exportStatus, setExportStatus] = useState<'idle' | 'exporting' | 'completed' | 'failed'>('idle');
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  // Load template metadata
  useEffect(() => {
    async function load() {
      try {
        const data = await api.getTemplate(slug);
        setTemplate(data);
        setCurrentProps(data.defaultProps || {});
      } catch {
        router.push('/projects');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug, router]);

  // Load bundle dynamically
  const { Component, loading: bundleLoading, error: bundleError } = useTemplateBundle(
    template?.bundleUrl || null
  );

  // Export handler
  const handleExport = useCallback(async () => {
    if (!template) return;
    setExportStatus('exporting');
    setDownloadUrl(null);

    try {
      const { exportId } = await api.exportTemplate(slug, currentProps);

      // Poll for completion
      const maxPolls = 120; // 2 minutes
      for (let i = 0; i < maxPolls; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const status = await api.getExportStatus(slug, exportId);

        if (status.status === 'completed' && status.downloadUrl) {
          setExportStatus('completed');
          setDownloadUrl(status.downloadUrl);
          return;
        }
        if (status.status === 'failed') {
          setExportStatus('failed');
          return;
        }
      }
      setExportStatus('failed');
    } catch {
      setExportStatus('failed');
    }
  }, [template, slug, currentProps]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white/50">
        Loading...
      </div>
    );
  }

  if (!template) return null;

  // Merge assetBaseUrl into props
  const playerProps = {
    ...currentProps,
    ...(template.assetBaseUrl ? { assetBaseUrl: template.assetBaseUrl } : {}),
  };

  return (
    <div className="min-h-screen p-6">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/projects')}
          className="text-white/50 hover:text-white text-sm mb-4 inline-block"
        >
          ← Back to Templates
        </button>
        <h1 className="text-2xl font-bold text-white">{template.name}</h1>
        {template.description && (
          <p className="text-white/50 mt-1">{template.description}</p>
        )}
      </div>

      <div className="flex gap-6 flex-col lg:flex-row">
        {/* Player */}
        <div className="flex-1">
          <div className="bg-black rounded-xl overflow-hidden">
            {bundleLoading ? (
              <div className="aspect-video flex items-center justify-center text-white/50">
                Loading preview...
              </div>
            ) : bundleError ? (
              <div className="aspect-video flex items-center justify-center text-red-400 text-sm">
                Failed to load preview: {bundleError.message}
              </div>
            ) : Component ? (
              <Player
                component={Component}
                inputProps={playerProps}
                durationInFrames={template.durationFrames}
                fps={template.fps}
                compositionWidth={template.width}
                compositionHeight={template.height}
                style={{ width: '100%' }}
                controls
                autoPlay
                loop
              />
            ) : null}
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 mt-4">
            <button
              onClick={handleExport}
              disabled={exportStatus === 'exporting'}
              className="px-4 py-2 bg-white/10 hover:bg-white/15 border border-white/10 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              {exportStatus === 'exporting' ? 'Exporting...' : 'Export MP4'}
            </button>

            {downloadUrl && (
              <a
                href={downloadUrl}
                download
                className="px-4 py-2 bg-green-600/20 hover:bg-green-600/30 border border-green-500/20 rounded-lg text-green-400 text-sm font-medium transition-colors"
              >
                Download MP4
              </a>
            )}

            {exportStatus === 'failed' && (
              <span className="px-4 py-2 text-red-400 text-sm">Export failed. Try again.</span>
            )}

            <button
              disabled
              className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white/30 text-sm font-medium cursor-not-allowed"
              title="Coming soon — edit in Viona editor"
            >
              Remix
            </button>
          </div>
        </div>

        {/* Props Editor */}
        <div className="w-full lg:w-80 shrink-0">
          <TemplatePropsEditor
            schema={template.propsSchema}
            values={currentProps}
            onChange={setCurrentProps}
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the props editor**

Create `apps/web/src/components/template-props-editor.tsx`:

```typescript
"use client";

import { useCallback } from 'react';

interface TemplatePropsEditorProps {
  schema: Record<string, unknown>;
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
}

/**
 * Auto-generates a form from a JSON Schema.
 * Handles: string, number, boolean, enum, color fields.
 * Nested objects render as collapsible sections.
 */
export function TemplatePropsEditor({ schema, values, onChange }: TemplatePropsEditorProps) {
  const properties = (schema as any)?.properties || {};

  const handleChange = useCallback(
    (key: string, value: unknown) => {
      onChange({ ...values, [key]: value });
    },
    [values, onChange]
  );

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
      <h2 className="text-white text-sm font-medium mb-4">Customize</h2>
      <div className="space-y-4">
        {Object.entries(properties).map(([key, propSchema]: [string, any]) => (
          <SchemaField
            key={key}
            name={key}
            schema={propSchema}
            value={values[key]}
            onChange={(val) => handleChange(key, val)}
          />
        ))}
      </div>
    </div>
  );
}

interface SchemaFieldProps {
  name: string;
  schema: any;
  value: unknown;
  onChange: (value: unknown) => void;
}

function SchemaField({ name, schema, value, onChange }: SchemaFieldProps) {
  const label = name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();

  // Enum → dropdown
  if (schema.enum) {
    return (
      <div>
        <label className="block text-white/50 text-xs mb-1">{label}</label>
        <select
          value={String(value || schema.default || '')}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded text-white text-sm focus:outline-none focus:border-white/20"
        >
          {schema.enum.map((opt: string) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
    );
  }

  // Boolean → toggle
  if (schema.type === 'boolean') {
    return (
      <div className="flex items-center justify-between">
        <label className="text-white/50 text-xs">{label}</label>
        <button
          onClick={() => onChange(!value)}
          className={`w-8 h-5 rounded-full transition-colors ${
            value ? 'bg-blue-500' : 'bg-white/10'
          } relative`}
        >
          <span
            className={`block w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-transform ${
              value ? 'translate-x-3.5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>
    );
  }

  // Number → number input
  if (schema.type === 'number' || schema.type === 'integer') {
    return (
      <div>
        <label className="block text-white/50 text-xs mb-1">{label}</label>
        <input
          type="number"
          value={Number(value || schema.default || 0)}
          min={schema.minimum}
          max={schema.maximum}
          step={schema.type === 'integer' ? 1 : 0.1}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded text-white text-sm focus:outline-none focus:border-white/20"
        />
      </div>
    );
  }

  // String with color hint → color picker
  if (schema.type === 'string' && (name.toLowerCase().includes('color') || String(value).match(/^#[0-9a-fA-F]{6}$/))) {
    return (
      <div>
        <label className="block text-white/50 text-xs mb-1">{label}</label>
        <div className="flex gap-2">
          <input
            type="color"
            value={String(value || schema.default || '#000000')}
            onChange={(e) => onChange(e.target.value)}
            className="w-8 h-8 bg-transparent border-0 cursor-pointer"
          />
          <input
            type="text"
            value={String(value || schema.default || '')}
            onChange={(e) => onChange(e.target.value)}
            className="flex-1 px-2 py-1.5 bg-white/5 border border-white/10 rounded text-white text-sm focus:outline-none focus:border-white/20"
          />
        </div>
      </div>
    );
  }

  // Nested object → collapsible section
  if (schema.type === 'object' && schema.properties) {
    const objValue = (value || {}) as Record<string, unknown>;
    return (
      <details className="group">
        <summary className="text-white/50 text-xs cursor-pointer hover:text-white/70 mb-2">
          {label}
        </summary>
        <div className="pl-3 border-l border-white/10 space-y-3">
          {Object.entries(schema.properties).map(([subKey, subSchema]: [string, any]) => (
            <SchemaField
              key={subKey}
              name={subKey}
              schema={subSchema}
              value={objValue[subKey]}
              onChange={(val) => onChange({ ...objValue, [subKey]: val })}
            />
          ))}
        </div>
      </details>
    );
  }

  // Default string → text input
  return (
    <div>
      <label className="block text-white/50 text-xs mb-1">{label}</label>
      <input
        type="text"
        value={String(value || schema.default || '')}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded text-white text-sm focus:outline-none focus:border-white/20"
      />
    </div>
  );
}
```

- [ ] **Step 3: Ensure `@remotion/player` is a dependency of the web app**

```bash
cd apps/web
pnpm add @remotion/player remotion
```

- [ ] **Step 4: Verify the page renders**

```bash
cd apps/web
pnpm dev
```

Navigate to `/templates/globe-spin` (after seeding data). Should show player + props editor.

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/app/(dashboard)/templates/[slug]/page.tsx" apps/web/src/components/template-props-editor.tsx apps/web/package.json
git commit -m "feat: add template detail page with Remotion Player and props editor"
```

---

## Task 14: End-to-End Verification

- [ ] **Step 1: Seed the 3 templates**

```bash
cd packages/templates
pnpm templates:publish
```

Verify 3 rows in the `templates` table, files in S3.

- [ ] **Step 2: Test API endpoints**

```bash
# List templates
curl http://localhost:4000/api/templates | jq

# Get categories
curl http://localhost:4000/api/templates/categories | jq

# Get detail
curl http://localhost:4000/api/templates/globe-spin | jq
```

- [ ] **Step 3: Test the frontend**

1. Navigate to `/projects` → click "Templates" tab → see 3 template cards
2. Click a card → navigate to `/templates/globe-spin` → see Remotion Player
3. Adjust props → player re-renders
4. Click "Export MP4" → poll until download link appears
5. Verify "Remix" button is disabled

- [ ] **Step 4: Verify worker renders**

Check worker logs for `render-template` job completion. Download the MP4 and verify it plays correctly.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete template system redesign — backend-driven architecture"
```
