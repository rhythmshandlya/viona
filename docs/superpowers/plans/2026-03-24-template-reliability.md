# Template System Reliability Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the template fork-from-S3 mechanism bulletproof — explicit dependency manifests, centralized import rewriting, build-time validation, magazine responsiveness, and sandbox integration fixes.

**Architecture:** Single `meta.json` per template declares everything (deps + discoverability). `rewriteImports()` utility in `@viona/shared` replaces 4 separate regex implementations. Build scripts validate before writing output. Magazine templates adopt `useScale()` + `useVideoConfig()`. Fork tool uses manifest-driven resolution. Orchestrator validates templates between pipeline phases.

**Tech Stack:** TypeScript, Zod, Remotion, esbuild, MinIO/S3, Docker

**Spec:** `docs/superpowers/specs/2026-03-24-template-reliability-design.md`

---

## Phase 1: Infrastructure (Sections 1, 3, 4)

### Task 1: Create `rewriteImports()` utility in `@viona/shared`

**Files:**
- Create: `packages/shared/src/rewrite-imports.ts`
- Modify: `packages/shared/src/index.ts` (add export)
- Modify: `packages/shared/package.json:8-33` (add export path)
- Create: `scripts/temp/test-rewrite-imports.ts`

- [ ] **Step 1: Write the test file**

Create `scripts/temp/test-rewrite-imports.ts`:

```ts
import { rewriteImports } from '../../packages/shared/src/rewrite-imports';

// Test 1: Root file (depth=0) importing magazine shared lib
const input1 = `import { SerifHeadline } from '../../magazine/typography';
import { MAGAZINE_COLORS } from '../../magazine/constants';`;
const result1 = rewriteImports(input1, 0, ['magazine', 'fonts', 'use-scale']);
console.assert(result1.includes(`from './magazine/typography'`), 'FAIL: root magazine import');
console.assert(result1.includes(`from './magazine/constants'`), 'FAIL: root magazine constants');

// Test 2: Nested file (depth=1, e.g. components/X.tsx) importing magazine
const input2 = `import { TornEdge } from '../../../magazine/effects';`;
const result2 = rewriteImports(input2, 1, ['magazine']);
console.assert(result2.includes(`from '../magazine/effects'`), 'FAIL: nested magazine import');

// Test 3: Root file importing fonts
const input3 = `import { FONT_SIZES } from '../../fonts';`;
const result3 = rewriteImports(input3, 0, ['fonts']);
console.assert(result3.includes(`from './fonts'`), 'FAIL: root fonts import');

// Test 4: Root file importing use-scale
const input4 = `import { useScale } from '../../use-scale';`;
const result4 = rewriteImports(input4, 0, ['use-scale']);
console.assert(result4.includes(`from './use-scale'`), 'FAIL: root use-scale import');

// Test 5: Dynamic import rewriting
const input5 = `const mod = await import('../../magazine/effects');`;
const result5 = rewriteImports(input5, 0, ['magazine']);
console.assert(result5.includes(`import('./magazine/effects')`), 'FAIL: dynamic import');

// Test 6: Side-effect import
const input6 = `import '../../magazine/styles.css';`;
const result6 = rewriteImports(input6, 0, ['magazine']);
console.assert(result6.includes(`import './magazine/styles.css'`), 'FAIL: side-effect import');

// Test 7: Unrecognized escape throws
let threw = false;
try {
  rewriteImports(`import { X } from '../../unknown/module';`, 0, ['magazine']);
} catch { threw = true; }
console.assert(threw, 'FAIL: should throw on unrecognized escape');

// Test 8: Does not touch single ../ (stays within template dir)
const input8 = `import { X } from '../components/Foo';`;
const result8 = rewriteImports(input8, 1, ['magazine']);
console.assert(result8.includes(`from '../components/Foo'`), 'FAIL: should not touch single ../');

// Test 9: Triple ../ from depth-1 file
const input9 = `import { X } from '../../../blackboard/effects';`;
const result9 = rewriteImports(input9, 1, ['blackboard']);
console.assert(result9.includes(`from '../blackboard/effects'`), 'FAIL: triple ../ from depth-1');

console.log('All rewriteImports tests passed');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx scripts/temp/test-rewrite-imports.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `rewriteImports()`**

Create `packages/shared/src/rewrite-imports.ts`:

```ts
/**
 * Rewrite imports that escape the template directory (../../ or deeper).
 *
 * @param source     File content
 * @param fileDepth  0 for root files (index.tsx), 1 for components/X.tsx, etc.
 * @param sharedLibs Declared shared libraries from meta.json
 * @returns          Rewritten source
 * @throws           If an unrecognized ../../ import is found
 */
export function rewriteImports(
  source: string,
  fileDepth: number,
  sharedLibs: string[],
): string {
  const prefix = fileDepth === 0 ? './' : '../'.repeat(fileDepth);

  // Match: from '../../...', import '../../...', import('../../...')
  // Captures the quote style and the path after the ../../+ prefix
  const pattern = /(from\s+['"]|import\s+['"]|import\(\s*['"])(?:\.\.\/){2,}([^'"]+)(['"])/g;

  return source.replace(pattern, (match, before: string, importPath: string, quote: string) => {
    // Extract the top-level module name (e.g., 'magazine' from 'magazine/effects')
    const topLevel = importPath.split('/')[0];

    // Check if this is a recognized shared lib
    const isRecognized = sharedLibs.some(lib => topLevel === lib);
    if (!isRecognized) {
      throw new Error(
        `Unrecognized import escape: ${match.trim()} — ` +
        `'${topLevel}' is not in sharedLibs [${sharedLibs.join(', ')}]. ` +
        `Add it to meta.json sharedLibs or fix the import.`
      );
    }

    return `${before}${prefix}${importPath}${quote}`;
  });
}
```

- [ ] **Step 4: Add export to `@viona/shared`**

Add to `packages/shared/src/index.ts`:
```ts
export { rewriteImports } from './rewrite-imports';
```

Add export path to `packages/shared/package.json` exports map:
```json
"./rewrite-imports": {
  "types": "./dist/rewrite-imports.d.ts",
  "import": "./dist/rewrite-imports.mjs",
  "require": "./dist/rewrite-imports.js"
}
```

Also add `rewrite-imports` to the tsup `entry` array in `packages/shared/tsup.config.ts` (or package.json tsup config) so it gets built.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx tsx scripts/temp/test-rewrite-imports.ts`
Expected: "All rewriteImports tests passed"

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/rewrite-imports.ts packages/shared/src/index.ts packages/shared/package.json scripts/temp/test-rewrite-imports.ts
git commit -m "feat(shared): add rewriteImports utility for template import resolution"
```

---

### Task 2: Create Zod validation schemas for template metadata

**Files:**
- Create: `packages/templates/src/lib/template-schemas.ts`
- Create: `scripts/temp/test-template-schemas.ts`

- [ ] **Step 1: Write the test file**

Create `scripts/temp/test-template-schemas.ts`:

```ts
import { MetaSchema, CompositionMetaSchema } from '../../packages/templates/src/lib/template-schemas';

// Test 1: Valid meta.json
const valid = MetaSchema.parse({
  slug: 'magazine-comparison',
  name: 'Magazine Comparison',
  description: 'Side-by-side torn paper comparison',
  useCase: 'Structured comparison of two things across multiple categories',
  bestFor: ['product comparisons', 'A vs B analysis'],
  notFor: ['winner/loser matchups (use magazine-versus)'],
  category: 'overlay',
  tags: ['magazine-theme'],
  themes: ['magazine'],
  sharedLibs: ['magazine', 'fonts', 'use-scale'],
  npmDependencies: {},
  siblingTemplates: [],
});
console.assert(valid.slug === 'magazine-comparison', 'FAIL: valid parse');

// Test 2: Missing useCase should fail
let err1 = false;
try { MetaSchema.parse({ slug: 'x', name: 'X', description: 'short descr.', category: 'overlay', tags: [], themes: ['m'], sharedLibs: [], bestFor: ['x'] }); }
catch { err1 = true; }
console.assert(err1, 'FAIL: missing useCase should throw');

// Test 3: Invalid category should fail
let err2 = false;
try { MetaSchema.parse({ slug: 'x', name: 'X', description: 'short descr.', useCase: 'some use case here', category: 'INVALID', tags: [], themes: ['m'], sharedLibs: [], bestFor: ['x'] }); }
catch { err2 = true; }
console.assert(err2, 'FAIL: invalid category should throw');

// Test 4: Removed fields should fail
let err3 = false;
try { MetaSchema.strict().parse({ slug: 'x', name: 'X', description: 'short descr.', useCase: 'some use case', category: 'overlay', tags: [], themes: ['m'], sharedLibs: [], bestFor: ['x'], aspectRatio: '9:16' }); }
catch { err3 = true; }
console.assert(err3, 'FAIL: aspectRatio should be rejected in strict mode');

// Test 5: Valid composition meta
const comp = CompositionMetaSchema.parse({ compositionId: 'Main', durationInFrames: 150, fps: 30, width: 1080, height: 1920 });
console.assert(comp.fps === 30, 'FAIL: composition meta parse');

console.log('All template schema tests passed');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx scripts/temp/test-template-schemas.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement schemas**

Create `packages/templates/src/lib/template-schemas.ts`:

```ts
import { z } from 'zod';

export const TEMPLATE_CATEGORIES = [
  'data-visualization', 'text-typography', 'comparison',
  'social-engagement', 'geographic', 'intro-outro',
  'timeline-process', 'media', 'marketing', 'education',
  'social', 'corporate', 'entertainment', 'overlay',
] as const;

export const SHARED_LIBS = ['magazine', 'blackboard', 'fonts', 'use-scale', 'lib'] as const;
// 'lib' contains map utilities (tile-math, geo-utils, camera) used by geographic templates

export const MetaSchema = z.object({
  // Identity
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  description: z.string().min(10),
  // Discoverability (optional in Phase 1, tightened to required in Phase 2 Task 9)
  useCase: z.string().min(10).optional(),
  bestFor: z.array(z.string()).min(1).optional(),
  notFor: z.array(z.string()).optional(),
  category: z.enum(TEMPLATE_CATEGORIES),
  tags: z.array(z.string()),
  themes: z.array(z.string()).min(1),
  type: z.enum(['scene', 'overlay']).optional(),
  // Dependencies
  sharedLibs: z.array(z.enum(SHARED_LIBS)),
  npmDependencies: z.record(z.string()).default({}),
  siblingTemplates: z.array(z.string()).default([]),
});

export const CompositionMetaSchema = z.object({
  compositionId: z.string(),
  durationInFrames: z.number().positive(),
  fps: z.number().positive(),
  width: z.number().positive(),
  height: z.number().positive(),
});

export type TemplateMeta = z.infer<typeof MetaSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx scripts/temp/test-template-schemas.ts`
Expected: "All template schema tests passed"

- [ ] **Step 5: Commit**

```bash
git add packages/templates/src/lib/template-schemas.ts scripts/temp/test-template-schemas.ts
git commit -m "feat(templates): add Zod validation schemas for template metadata"
```

---

### Task 3: Bootstrap migration — add dependency fields to all `meta.json`

**Files:**
- Create: `scripts/temp/bootstrap-meta-deps.ts` (one-time migration script)
- Modify: `packages/templates/src/templates/*/meta.json` (50+ files)

This task runs the existing regex detection logic ONE FINAL TIME to generate explicit `sharedLibs`, `npmDependencies`, and `siblingTemplates` fields for every template's `meta.json`.

- [ ] **Step 1: Write the bootstrap migration script**

Create `scripts/temp/bootstrap-meta-deps.ts`:

```ts
/**
 * One-time migration: scan each template's source files using the OLD regex
 * detection logic, then write sharedLibs/npmDependencies/siblingTemplates
 * into meta.json. After this, the manifests are the source of truth.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEMPLATES_DIR = join(__dirname, '../../packages/templates/src/templates');
const SRC_DIR = join(__dirname, '../../packages/templates/src');

function readAllSourceFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fp = join(dir, entry.name);
    if (entry.isDirectory()) results.push(...readAllSourceFiles(fp));
    else if (/\.(ts|tsx)$/.test(entry.name)) results.push(fp);
  }
  return results;
}

function detectSharedLibs(files: string[]): string[] {
  const libs = new Set<string>();
  for (const fp of files) {
    const content = readFileSync(fp, 'utf-8');
    if (content.includes('use-scale')) libs.add('use-scale');
    if (/from\s+['"]\.\.?\/[^'"]*fonts['"]/.test(content) ||
        /from\s+['"](?:\.\.\/){2,}fonts['"]/.test(content)) libs.add('fonts');
    if (/from\s+['"](?:\.\.\/)*magazine\//.test(content) ||
        /from\s+['"](?:\.\.\/){2,}magazine\//.test(content)) libs.add('magazine');
    if (/from\s+['"](?:\.\.\/)*blackboard\//.test(content) ||
        /from\s+['"](?:\.\.\/){2,}blackboard\//.test(content)) libs.add('blackboard');
  }
  // Implicit deps
  if (libs.has('magazine')) libs.add('fonts');
  if (libs.has('blackboard')) libs.add('fonts');
  return Array.from(libs).sort();
}

function detectSiblingTemplates(files: string[], currentSlug: string): string[] {
  const siblings = new Set<string>();
  for (const fp of files) {
    const content = readFileSync(fp, 'utf-8');
    const matches = content.matchAll(/from\s+['"]\.\.\/([a-z0-9-]+)\//g);
    for (const m of matches) {
      const slug = m[1];
      if (slug !== currentSlug && existsSync(join(TEMPLATES_DIR, slug, 'meta.json'))) {
        siblings.add(slug);
      }
    }
  }
  return Array.from(siblings).sort();
}

let updated = 0;
for (const dir of readdirSync(TEMPLATES_DIR, { withFileTypes: true })) {
  if (!dir.isDirectory()) continue;
  const metaPath = join(TEMPLATES_DIR, dir.name, 'meta.json');
  if (!existsSync(metaPath)) continue;

  const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
  const sourceFiles = readAllSourceFiles(join(TEMPLATES_DIR, dir.name));

  meta.sharedLibs = detectSharedLibs(sourceFiles);
  meta.npmDependencies = meta.dependencies || {};
  meta.siblingTemplates = detectSiblingTemplates(sourceFiles, dir.name);

  // Remove old fields
  delete meta.dependencies;

  writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n', 'utf-8');
  updated++;
  console.log(`${dir.name}: sharedLibs=[${meta.sharedLibs}] siblings=[${meta.siblingTemplates}]`);
}
console.log(`\nUpdated ${updated} meta.json files`);
```

- [ ] **Step 2: Run the migration**

Run: `npx tsx scripts/temp/bootstrap-meta-deps.ts`
Expected: Lists each template with detected deps. ~50 files updated.

- [ ] **Step 3: Spot-check results**

Verify a few templates:
- `magazine-comparison/meta.json` should have `sharedLibs: ["fonts", "magazine", "use-scale"]` (use-scale will be missing initially — that's expected since magazines don't use it yet; it will be added in Phase 3)
- `explainer-stats/meta.json` should have `sharedLibs: ["blackboard", "fonts", "use-scale"]`
- `magazine-inkmap/meta.json` should have `sharedLibs: ["fonts", "magazine"]`

- [ ] **Step 4: Commit**

```bash
git add packages/templates/src/templates/*/meta.json scripts/temp/bootstrap-meta-deps.ts
git commit -m "feat(templates): bootstrap sharedLibs/npmDeps/siblingTemplates into meta.json"
```

---

### Task 4: Create `validate-templates.ts` build script

**Files:**
- Create: `packages/templates/scripts/validate-templates.ts`

- [ ] **Step 1: Implement the validation script**

Create `packages/templates/scripts/validate-templates.ts`:

```ts
import { readdirSync, readFileSync, existsSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';
import { MetaSchema, CompositionMetaSchema, SHARED_LIBS } from '../src/lib/template-schemas';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(__dirname, '..', 'src', 'templates');
const SRC_DIR = join(__dirname, '..', 'src');

const REQUIRED_FILES = ['meta.json', 'metadata.json', 'schema.ts', 'index.tsx'];
const REMOVED_FIELDS = ['aspectRatio', 'estimatedDuration', 'stylePreset', 'sceneCount', 'thumbnail'];

interface ValidationError {
  template: string;
  check: string;
  message: string;
}

const errors: ValidationError[] = [];

function addError(template: string, check: string, message: string) {
  errors.push({ template, check, message });
}

function readSourceFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fp = join(dir, entry.name);
    if (entry.isDirectory()) results.push(...readSourceFiles(fp));
    else if (/\.(ts|tsx)$/.test(entry.name)) results.push(fp);
  }
  return results;
}

const dirs = readdirSync(TEMPLATES_DIR, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .sort((a, b) => a.name.localeCompare(b.name));

for (const dir of dirs) {
  const slug = dir.name;
  const templateDir = join(TEMPLATES_DIR, slug);
  const metaPath = join(templateDir, 'meta.json');

  if (!existsSync(metaPath)) {
    addError(slug, 'structural', 'Missing meta.json — skipping all checks');
    continue;
  }

  // 1. Structural check
  for (const file of REQUIRED_FILES) {
    if (!existsSync(join(templateDir, file))) {
      addError(slug, 'structural', `Missing required file: ${file}`);
    }
  }

  // 2. Meta.json schema validation
  let meta: any;
  try {
    meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
    MetaSchema.parse(meta);
  } catch (err: any) {
    addError(slug, 'meta-schema', err.message?.slice(0, 500) || 'Invalid meta.json');
    continue; // Can't proceed without valid meta
  }

  // 3. Slug consistency
  if (meta.slug !== slug) {
    addError(slug, 'slug-consistency', `meta.json slug "${meta.slug}" !== directory name "${slug}"`);
  }

  // 4. Removed fields check
  for (const field of REMOVED_FIELDS) {
    if (field in meta) {
      addError(slug, 'removed-fields', `meta.json contains removed field: ${field}`);
    }
  }

  // 5. metadata.json validation
  const compositionPath = join(templateDir, 'metadata.json');
  if (existsSync(compositionPath)) {
    try {
      const comp = JSON.parse(readFileSync(compositionPath, 'utf-8'));
      CompositionMetaSchema.parse(comp);
    } catch (err: any) {
      addError(slug, 'composition-schema', err.message?.slice(0, 500) || 'Invalid metadata.json');
    }
  }

  // 6. Shared lib verification
  for (const lib of meta.sharedLibs || []) {
    const libPath = lib === 'fonts' ? join(SRC_DIR, 'fonts.ts')
      : lib === 'use-scale' ? join(SRC_DIR, 'use-scale.ts')
      : join(SRC_DIR, lib);
    if (!existsSync(libPath)) {
      addError(slug, 'shared-lib', `Declared sharedLib "${lib}" not found at ${libPath}`);
    }
  }

  // 7. Sibling template verification
  for (const sibling of meta.siblingTemplates || []) {
    const siblingMeta = join(TEMPLATES_DIR, sibling, 'meta.json');
    if (!existsSync(siblingMeta)) {
      addError(slug, 'sibling', `Declared siblingTemplate "${sibling}" not found`);
    }
  }

  // 8. Import escape check
  const sourceFiles = readSourceFiles(templateDir);
  for (const fp of sourceFiles) {
    const content = readFileSync(fp, 'utf-8');
    const relFile = relative(templateDir, fp).replace(/\\/g, '/');
    const escapePattern = /(?:from|import)\s+['"](?:\.\.\/){2,}([^'"]+)['"]/g;
    let match;
    while ((match = escapePattern.exec(content)) !== null) {
      const importPath = match[1];
      const topLevel = importPath.split('/')[0];
      const isSharedLib = (meta.sharedLibs || []).includes(topLevel);
      const isSibling = (meta.siblingTemplates || []).includes(topLevel);
      if (!isSharedLib && !isSibling) {
        addError(slug, 'import-escape', `${relFile}: undeclared ../../ import to "${topLevel}" — add to sharedLibs or siblingTemplates`);
      }
    }
  }

  // 9. useScale enforcement (index.tsx must import useScale)
  const indexPath = join(templateDir, 'index.tsx');
  if (existsSync(indexPath)) {
    const indexContent = readFileSync(indexPath, 'utf-8');
    if (!indexContent.includes('useScale')) {
      addError(slug, 'use-scale', 'index.tsx does not import useScale — required for responsive rendering');
    }
  }
}

// Report
if (errors.length === 0) {
  console.log(`✓ All ${dirs.length} templates passed validation`);
  process.exit(0);
} else {
  console.error(`\n✗ ${errors.length} validation errors in ${new Set(errors.map(e => e.template)).size} templates:\n`);
  for (const e of errors) {
    console.error(`  [${e.template}] ${e.check}: ${e.message}`);
  }
  process.exit(1);
}
```

- [ ] **Step 2: Run validation to see current state**

Run: `npx tsx packages/templates/scripts/validate-templates.ts`
Expected: Failures for missing `useCase`/`bestFor` (not yet added) and missing `useScale` in magazine templates (not yet migrated). This establishes the baseline.

- [ ] **Step 3: Commit**

```bash
git add packages/templates/scripts/validate-templates.ts
git commit -m "feat(templates): add build-time template validation script"
```

---

### Task 5: Update `build-registry.ts` to use shared utilities

**Files:**
- Modify: `packages/templates/scripts/build-registry.ts:69-84` (replace `detectSharedDeps`)
- Modify: `packages/templates/scripts/build-registry.ts:162-176` (replace inline import rewriting)
- Modify: `packages/templates/scripts/build-registry.ts:141-152` (read meta.json with validation)

- [ ] **Step 1: Replace `detectSharedDeps()` with `meta.json` read**

In `build-registry.ts`, remove the `detectSharedDeps()` function (lines 69-84) and replace its usage at line 185:

```ts
// BEFORE:
// const registryDeps = detectSharedDeps(files);

// AFTER:
const registryDeps = (meta.sharedLibs as string[]) || [];
```

- [ ] **Step 2: Replace inline import rewriting with `rewriteImports()`**

Add import at top:
```ts
import { rewriteImports } from '@viona/shared/rewrite-imports';
```

Replace lines 162-176 (the inline regex rewriting in the file-reading loop):

```ts
// BEFORE: depth-aware regex rewriting inline
// AFTER:
const depth = relPath.split('/').length - 1;
content = rewriteImports(content, depth, (meta.sharedLibs as string[]) || []);
```

- [ ] **Step 3: Add validation call at script start**

After the directory constants, add:
```ts
import { MetaSchema } from '../src/lib/template-schemas';
```

Replace the try/catch meta parsing (lines 147-152):
```ts
// BEFORE: silent catch + console.warn
// AFTER:
let meta: any;
try {
  const raw = JSON.parse(readFileSync(metaPath, 'utf-8'));
  meta = MetaSchema.parse(raw);
} catch (err: any) {
  console.error(`FATAL: ${dir.name}/meta.json validation failed: ${err.message}`);
  process.exit(1);
}
```

- [ ] **Step 4: Verify build still works**

Run: `cd packages/templates && pnpm build:registry`
Expected: Builds successfully with same output (may fail on missing `useCase` etc. — that's expected until Phase 2)

Note: If validation fails on missing new fields, temporarily make `useCase`/`bestFor` optional in the schema with `.optional()` until Phase 2 adds them. Revert after Phase 2.

- [ ] **Step 5: Commit**

```bash
git add packages/templates/scripts/build-registry.ts
git commit -m "refactor(templates): build-registry uses meta.json sharedLibs + rewriteImports()"
```

---

### Task 6: Update `build-templates.ts` to use shared utilities

**Files:**
- Modify: `packages/templates/scripts/build-templates.ts` (replace sibling detection + import rewriting)

- [ ] **Step 1: Replace sibling template detection with `meta.json` read**

Replace the source-scanning sibling detection logic with:

```ts
const meta = JSON.parse(readFileSync(join(templateDir, 'meta.json'), 'utf-8'));
const siblingTemplates = (meta.siblingTemplates as string[]) || [];
```

- [ ] **Step 2: Replace import rewriting with `rewriteImports()`**

Add import:
```ts
import { rewriteImports } from '@viona/shared/rewrite-imports';
```

Replace the naive `../../` → `./` regex with:
```ts
const depth = relPath.split('/').length - 1;
content = rewriteImports(content, depth, (meta.sharedLibs as string[]) || []);
```

- [ ] **Step 3: Convert shared lib copy step to manifest-driven**

The current `build-templates.ts` (lines 159-183) unconditionally copies `magazine/`, `blackboard/`, `fonts.ts`, `use-scale.ts`, and `lib/` into every resolved directory regardless of need. Replace with:

```ts
// Only copy declared shared libs
const meta = JSON.parse(readFileSync(join(templateDir, 'meta.json'), 'utf-8'));
for (const lib of (meta.sharedLibs as string[]) || []) {
  if (lib === 'fonts' || lib === 'use-scale') {
    const srcFile = join(SRC_DIR, `${lib === 'use-scale' ? 'use-scale' : 'fonts'}.ts`);
    if (existsSync(srcFile)) copyFileSync(srcFile, join(resolvedDir, `${lib}.ts`));
  } else {
    // lib is a directory: magazine, blackboard, or lib
    const srcDir = join(SRC_DIR, lib);
    if (existsSync(srcDir)) copyDirRecursive(srcDir, join(resolvedDir, lib));
  }
}
```

- [ ] **Step 4: Remove deprecated fields from manifest output**

In the manifest writing section (~line 324), remove `stylePreset`, `aspectRatio`, `estimatedDuration`, `sceneCount` from the `meta` object written to manifest.json. These fields propagate to `upload-templates.ts` and must be removed at the source.

- [ ] **Step 5: Verify bundle build works**

Run: `cd packages/templates && pnpm templates:build`
Expected: Bundles build successfully

- [ ] **Step 6: Commit**

```bash
git add packages/templates/scripts/build-templates.ts
git commit -m "refactor(templates): build-templates uses meta.json deps + rewriteImports(), remove deprecated fields"
```

---

### Task 7: Update `upload-templates.ts` — use manifest + upload `use-scale.ts`

**Files:**
- Modify: `packages/templates/scripts/upload-templates.ts:172-224` (replace regex detection)

- [ ] **Step 1: Replace regex-based shared lib detection with `meta.json` read**

Replace lines 172-224 (the regex `usesMagazine` / `usesBlackboard` detection):

```ts
const meta = JSON.parse(readFileSync(join(TEMPLATES_DIR, slug, 'meta.json'), 'utf-8'));
const sharedLibs: string[] = meta.sharedLibs || [];

// Upload each declared shared lib
for (const lib of sharedLibs) {
  if (lib === 'magazine' || lib === 'blackboard') {
    const libDir = join(SRC_DIR, lib);
    if (!existsSync(libDir)) continue;
    const libFiles = getAllFiles(libDir);
    console.log(`  Uploading ${libFiles.length} shared ${lib} library files...`);
    for (const filePath of libFiles) {
      const relativePath = filePath.substring(libDir.length + 1);
      const s3Key = toS3Key(`${S3_PREFIX}${slug}/source/${lib}/${relativePath}`);
      await uploadFileToS3(client, filePath, s3Key, 'text/typescript');
    }
  }
  if (lib === 'fonts') {
    const fontsPath = join(SRC_DIR, 'fonts.ts');
    if (existsSync(fontsPath)) {
      const s3Key = toS3Key(`${S3_PREFIX}${slug}/source/fonts.ts`);
      await uploadFileToS3(client, fontsPath, s3Key, 'text/typescript');
    }
  }
  if (lib === 'use-scale') {
    const scalePath = join(SRC_DIR, 'use-scale.ts');
    if (existsSync(scalePath)) {
      const s3Key = toS3Key(`${S3_PREFIX}${slug}/source/use-scale.ts`);
      await uploadFileToS3(client, scalePath, s3Key, 'text/typescript');
    }
  }
}
```

- [ ] **Step 2: Remove `aspectRatio`/`estimatedDuration` from DB upsert**

In the DB upsert section (~line 244+), stop writing removed fields. If `aspect_ratio` column has a NOT NULL constraint, update to nullable or provide a default.

- [ ] **Step 3: Verify upload script works (dry run)**

Run: `cd packages/templates && pnpm templates:build` (prerequisite)
Then review the upload script logic — actual upload requires S3 credentials.

- [ ] **Step 4: Commit**

```bash
git add packages/templates/scripts/upload-templates.ts
git commit -m "refactor(templates): upload uses meta.json sharedLibs, adds use-scale.ts to S3"
```

---

## Phase 2: Metadata Enrichment (Section 2)

### Task 8: Update `TemplateMeta` type and remove deprecated fields

**Files:**
- Modify: `packages/templates/src/types.ts:4-32`

- [ ] **Step 1: Update the `TemplateMeta` interface**

Replace the interface at lines 4-32:

```ts
export interface TemplateMeta {
  slug: string;
  name: string;
  description: string;
  // Discoverability
  useCase: string;
  bestFor: string[];
  notFor?: string[];
  category:
    | 'data-visualization'
    | 'text-typography'
    | 'comparison'
    | 'social-engagement'
    | 'geographic'
    | 'intro-outro'
    | 'timeline-process'
    | 'media'
    | 'marketing'
    | 'education'
    | 'social'
    | 'corporate'
    | 'entertainment'
    | 'overlay';
  tags: string[];
  type?: 'scene' | 'overlay';
  themes: string[];
  // Dependencies
  sharedLibs: string[];
  npmDependencies?: Record<string, string>;
  siblingTemplates?: string[];
}
```

- [ ] **Step 2: Fix any TypeScript errors from removed fields**

Run: `cd packages/templates && npx tsc --noEmit`
Fix references to `stylePreset`, `aspectRatio`, `estimatedDuration`, `sceneCount`, `thumbnail` in:
- `src/registry.ts` (if it references these)
- `scripts/build-registry.ts` (meta output)
- Any `register.ts` files that pass these fields

- [ ] **Step 3: Commit**

```bash
git add packages/templates/src/types.ts
git commit -m "refactor(templates): update TemplateMeta — add useCase/bestFor/notFor, remove deprecated fields"
```

---

### Task 9: Add `useCase`, `bestFor`, `notFor` to all `meta.json` files

**Files:**
- Create: `scripts/temp/enrich-meta-discoverability.ts`
- Modify: `packages/templates/src/templates/*/meta.json` (50+ files)

This task uses an LLM-assisted migration script since writing 50+ `useCase`/`bestFor`/`notFor` descriptions requires understanding each template's purpose.

- [ ] **Step 1: Write the enrichment script**

Create `scripts/temp/enrich-meta-discoverability.ts` that reads each template's `meta.json`, `schema.ts`, and `index.tsx` to generate draft `useCase`, `bestFor`, and `notFor` fields. Since this requires semantic understanding, the script should:

1. Read existing `description`, `tags`, `category`, and schema props
2. Generate a draft `useCase` (1 sentence describing when to pick this template)
3. Generate draft `bestFor` (2-4 concrete content examples)
4. For confusable clusters, generate `notFor` redirects
5. Write updated meta.json

**Confusable clusters to add `notFor` redirects:**
- magazine-comparison / magazine-versus / magazine-proscons
- magazine-ranking / magazine-takeaways / magazine-steps
- magazine-stats / magazine-pricetag / magazine-verdict
- explainer-comparison / magazine-comparison (cross-theme)

- [ ] **Step 2: Run the script and review output**

Run: `npx tsx scripts/temp/enrich-meta-discoverability.ts`
Manually review a sample of 10 meta.json files to verify quality.

- [ ] **Step 3: Remove deprecated fields from all meta.json**

Create a cleanup script that removes `aspectRatio`, `estimatedDuration`, `stylePreset`, `sceneCount`, `thumbnail` from all meta.json files:

```ts
// scripts/temp/cleanup-meta-fields.ts
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const TEMPLATES_DIR = 'packages/templates/src/templates';
const REMOVE = ['aspectRatio', 'estimatedDuration', 'stylePreset', 'sceneCount', 'thumbnail'];

for (const dir of readdirSync(TEMPLATES_DIR, { withFileTypes: true })) {
  if (!dir.isDirectory()) continue;
  const metaPath = join(TEMPLATES_DIR, dir.name, 'meta.json');
  if (!existsSync(metaPath)) continue;
  const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
  for (const field of REMOVE) delete meta[field];
  writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n');
}
```

Run: `npx tsx scripts/temp/cleanup-meta-fields.ts`

- [ ] **Step 4: Tighten schema — make `useCase`/`bestFor` required**

Now that all templates have these fields, update `packages/templates/src/lib/template-schemas.ts`:
```ts
// Change from .optional() to required:
useCase: z.string().min(10),
bestFor: z.array(z.string()).min(1),
```

- [ ] **Step 5: Run validation**

Run: `npx tsx packages/templates/scripts/validate-templates.ts`
Expected: Only `useScale` check failures remain (magazine templates, fixed in Phase 3). All metadata checks should pass.

- [ ] **Step 6: Commit**

```bash
git add packages/templates/src/templates/*/meta.json packages/templates/src/lib/template-schemas.ts scripts/temp/enrich-meta-discoverability.ts scripts/temp/cleanup-meta-fields.ts
git commit -m "feat(templates): add useCase/bestFor/notFor to all templates, remove deprecated fields"
```

---

### Task 10: Update registry output and API response

**Files:**
- Modify: `packages/templates/scripts/build-registry.ts` (registry.json catalog format)
- Modify: `packages/api/src/routes/templates.ts` (API response)

- [ ] **Step 1: Update registry.json catalog item format**

In `build-registry.ts`, update the `catalogItems.push()` block (~line 212) to include new fields and exclude removed ones:

```ts
catalogItems.push({
  name: meta.slug,
  type: 'registry:component',
  description: meta.description,
  useCase: meta.useCase,
  bestFor: meta.bestFor,
  notFor: meta.notFor,
  categories: [meta.category].filter(Boolean),
  tags: meta.tags,
  themes: meta.themes,
  sharedLibs: meta.sharedLibs,
  // NO: stylePreset, aspectRatio, estimatedDuration
});
```

- [ ] **Step 2: Rebuild registry**

Run: `cd packages/templates && pnpm build:registry`
Verify `registry.json` output has new fields, no removed fields.

- [ ] **Step 3: Update API route if needed**

In `packages/api/src/routes/templates.ts`, ensure the `GET /templates` response includes `useCase`, `bestFor`, `notFor` from the DB. If these aren't in the DB schema yet, they'll be served from the registry.json or added to the templates table in the upload script.

- [ ] **Step 4: Commit**

```bash
git add packages/templates/scripts/build-registry.ts packages/templates/registry.json packages/api/src/routes/templates.ts
git commit -m "feat(templates): registry and API include useCase/bestFor/notFor, drop deprecated fields"
```

---

### Task 10b: DB migration for removed fields

**Files:**
- Modify: `packages/api/src/db/schema.ts:199` (templates table)
- Create: `packages/api/drizzle/XXXX_drop_template_deprecated_fields.sql`

- [ ] **Step 1: Update Drizzle schema**

In `packages/api/src/db/schema.ts`, the templates table has:
```ts
aspectRatio: varchar('aspect_ratio', { length: 10 }).notNull().default('16:9'),
```

Make it nullable with no default (or drop it entirely if no code reads it):
```ts
aspectRatio: varchar('aspect_ratio', { length: 10 }),
```

Also check for `estimatedDuration`, `stylePreset`, `sceneCount` columns and make nullable or remove.

- [ ] **Step 2: Generate Drizzle migration**

Run: `cd packages/api && npx drizzle-kit generate`
Expected: Creates a migration SQL file

- [ ] **Step 3: Update `packages/api/src/routes/templates.ts`**

Remove references to deprecated columns in SELECT queries and response shapes. If the API was returning `aspectRatio` from the DB, remove it from the response.

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/db/schema.ts packages/api/drizzle/ packages/api/src/routes/templates.ts
git commit -m "feat(api): drop deprecated template fields from DB schema"
```

---

## Phase 3: Magazine Responsiveness (Section 5)

### Task 11: Update magazine shared libraries for responsive sizing

**Files:**
- Modify: `packages/templates/src/magazine/animations.ts:19-48` (paperSlide)
- Modify: `packages/templates/src/magazine/typography.tsx` (components already accept `size` prop)
- Modify: `packages/templates/src/magazine/decorations.tsx:8-54,60-89` (TapeMark, PinMark)
- Modify: `packages/templates/src/magazine/effects.tsx` (if needed)

- [ ] **Step 1: Add backward-compatible `canvasSize` param to `paperSlide()`**

In `packages/templates/src/magazine/animations.ts`, update `paperSlide` (line 19):

```ts
export function paperSlide(
  frame: number,
  start: number,
  duration = 25,
  direction: 'left' | 'right' | 'up' | 'down' = 'up',
  canvasSize?: { width: number; height: number },
) {
  const w = canvasSize?.width ?? 1080;
  const h = canvasSize?.height ?? 1920;
  const offsets: Record<string, [number, number]> = {
    left: [-w * 1.1, 0],
    right: [w * 1.1, 0],
    up: [0, -h * 1.05],
    down: [0, h * 1.05],
  };
  // ... rest of function uses offsets[direction] as before
```

- [ ] **Step 2: Update `TapeMark` and `PinMark` to accept scaled sizes**

In `packages/templates/src/magazine/decorations.tsx`:

```ts
// TapeMark — add optional scale prop
function TapeMark({
  corner,
  seed,
  scale = 1,  // NEW: multiply all dimensions by this
}: { corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'; seed: number; scale?: number })
// Apply: width *= scale, height *= scale throughout

// PinMark — add optional scale prop
function PinMark({
  x, y, seed,
  scale = 1,  // NEW
}: { x: number; y: number; seed: number; scale?: number })
// Apply: radius *= scale throughout
```

- [ ] **Step 3: Verify shared library compiles**

Run: `cd packages/templates && npx tsc --noEmit`
Expected: No errors — all changes are backward compatible.

- [ ] **Step 4: Commit**

```bash
git add packages/templates/src/magazine/animations.ts packages/templates/src/magazine/decorations.tsx
git commit -m "feat(magazine): backward-compatible responsive params for paperSlide, TapeMark, PinMark"
```

---

### Task 12: Migrate magazine templates to `useScale()` + `useVideoConfig()` (batch 1: 15 templates)

**Files:**
- Modify: `packages/templates/src/templates/magazine-{agenda,alert,beforeafter,chart,checklist,collage,comparison,country,definition,didyouknow,factfile,inkmap,location,mythfact,newspaper}/index.tsx`

- [ ] **Step 1: Create migration helper script**

Create `scripts/temp/migrate-magazine-responsive.ts` that for each magazine template:

1. Adds `import { useScale } from '../../use-scale';` if missing
2. Adds `import { useVideoConfig } from 'remotion';` (or extends existing import)
3. Adds `const s = useScale();` and `const { durationInFrames, width, height } = useVideoConfig();` at top of component
4. Wraps all numeric literals in dimension-like positions (font sizes, widths, heights, paddings, margins) with `s()`
5. Converts absolute frame numbers in enter/exit `interpolate()` calls to duration-relative

**Note:** This is a semi-automated migration — the script handles the mechanical wrapping, but each template needs manual review for correctness. The script produces a diff that must be reviewed.

- [ ] **Step 2: Run migration on first batch (15 templates: agenda through newspaper)**

Run the script on templates A-N.
Manually review each diff for correctness.

- [ ] **Step 3: Verify compilation**

Run: `cd packages/templates && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add packages/templates/src/templates/magazine-*/index.tsx
git commit -m "feat(magazine): migrate first 14 magazine templates to useScale + useVideoConfig"
```

---

### Task 13: Migrate remaining magazine templates (batch 2: 14 templates)

**Files:**
- Modify: `packages/templates/src/templates/magazine-{pricetag,profile,proscons,quote,ranking,stats,steps,takeaways,timeline,trivia,typewriter,verdict,versus,warning}/index.tsx`

- [ ] **Step 1: Run migration on second batch (14 templates: pricetag through warning)**

Same process as Task 12 for remaining templates.

- [ ] **Step 2: Update meta.json for all magazine templates — add `use-scale` to `sharedLibs`**

```ts
// Quick script to add 'use-scale' to all magazine templates' sharedLibs
for (const dir of readdirSync(TEMPLATES_DIR, { withFileTypes: true })) {
  if (!dir.name.startsWith('magazine-')) continue;
  const metaPath = join(TEMPLATES_DIR, dir.name, 'meta.json');
  const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
  if (!meta.sharedLibs.includes('use-scale')) {
    meta.sharedLibs.push('use-scale');
    meta.sharedLibs.sort();
  }
  writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n');
}
```

- [ ] **Step 3: Run full validation**

Run: `npx tsx packages/templates/scripts/validate-templates.ts`
Expected: All checks pass (useScale now present in every template)

- [ ] **Step 4: Commit**

```bash
git add packages/templates/src/templates/magazine-*/index.tsx packages/templates/src/templates/magazine-*/meta.json
git commit -m "feat(magazine): migrate remaining 14 templates to useScale, enable validation"
```

---

## Phase 4: Fork Tool + Sandbox (Sections 6, 7)

### Task 14: Rewrite fork tool with manifest-driven resolution

**Files:**
- Modify: `packages/sandbox/src/tools/template-tools.ts` (rewrite `forkTemplateTool`)

- [ ] **Step 1: Update fork tool to read `meta.json` from downloaded files**

After downloading files from S3, find and parse `meta.json`:

```ts
const metaFile = downloadedFiles.find(f => f.path === 'meta.json');
if (!metaFile) throw new Error(`Fork failed: no meta.json in template ${slug}`);
const meta = JSON.parse(metaFile.content);
```

- [ ] **Step 2: Replace regex-based import rewriting with `rewriteImports()`**

```ts
import { rewriteImports } from '@viona/shared/rewrite-imports';

// For each downloaded file:
const depth = filePath.split('/').length - 1;
const rewritten = rewriteImports(content, depth, meta.sharedLibs || []);
```

- [ ] **Step 3: Add shared lib deduplication**

```ts
// Skip copy if shared lib directory already exists from a previous fork
for (const lib of meta.sharedLibs || []) {
  const libDir = join(WORKSPACE, targetDir, lib);
  if (existsSync(libDir)) {
    console.log(`Shared lib ${lib}/ already exists, skipping`);
    continue;
  }
  // ... download and write lib files
}
```

- [ ] **Step 4: Remove runtime `npm install`**

Delete the `npm install --no-save` block. If `meta.json.npmDependencies` has entries, log a warning that they should be pre-installed in the Docker image.

- [ ] **Step 5: Add post-fork import verification**

After all files written:

```ts
// Verify every import resolves to a real file
for (const file of writtenFiles) {
  if (!file.path.endsWith('.ts') && !file.path.endsWith('.tsx')) continue;
  const importPattern = /from\s+['"](\.[^'"]+)['"]/g;
  let match;
  while ((match = importPattern.exec(file.content)) !== null) {
    const importPath = match[1];
    const resolved = resolveImportPath(join(WORKSPACE, targetDir, dirname(file.path)), importPath);
    if (!resolved) {
      errors.push(`${file.path}: unresolved import "${importPath}"`);
    }
  }
}
if (errors.length > 0) {
  return `Fork of ${slug} completed with import errors:\n${errors.join('\n')}`;
}
```

- [ ] **Step 6: Return structured output**

```ts
return [
  `Forked ${slug} to ${targetDir}/`,
  `Files: ${writtenFiles.length} template files` +
    (meta.sharedLibs?.length ? ` + ${meta.sharedLibs.join(', ')}` : ''),
  `Use case: ${meta.useCase}`,
  `Import: import Component from '../components/templates/${slug}';`,
  meta.propsSchema ? `Props: ${JSON.stringify(meta.propsSchema).slice(0, 200)}` : '',
].filter(Boolean).join('\n');
```

- [ ] **Step 7: Commit**

```bash
git add packages/sandbox/src/tools/template-tools.ts
git commit -m "refactor(sandbox): fork tool uses meta.json manifest, adds post-fork verification"
```

---

### Task 15: Add `scene-templates.json` sidecar to planner output

**Files:**
- Modify: `packages/sandbox/src/prompts/planner/system.md:304-338`

- [ ] **Step 1: Add instruction to planner prompt**

In the template section of `planner/system.md` (~line 304), add:

```markdown
## Template Output

After writing SCENE_PLAN.md, also write `docs/scene-templates.json`:

```json
{
  "scenes": [
    { "sceneNumber": 1, "template": "magazine-comparison" },
    { "sceneNumber": 2, "template": "magazine-stats" }
  ]
}
```

This file is machine-parsed by the orchestrator. SCENE_PLAN.md remains the human-readable plan.
Every scene that uses a template MUST appear in this file. Scenes without templates are omitted.
```

- [ ] **Step 2: Commit**

```bash
git add packages/sandbox/src/prompts/planner/system.md
git commit -m "feat(sandbox): planner writes scene-templates.json sidecar for machine parsing"
```

---

### Task 15b: Planner template study — deep browse before planning

**Problem:** The planner calls `browse_templates` once but doesn't study what each template actually offers. For example, `magazine-inkmap` has real map tiles, radar pulses, pin drops — perfect for a video about countries — but the planner recommends a custom "concentric rectangles" concept instead because it doesn't understand the template's capabilities.

**Files:**
- Modify: `packages/sandbox/src/prompts/planner/system.md:256-270` (task section)
- Modify: `packages/sandbox/src/prompts/planner/system.md:304-338` (template registry section)

- [ ] **Step 1: Add template study phase to planner task list**

In `planner/system.md`, between steps 6 and 7 of the `<task>` section (~line 263), insert a template study phase:

```markdown
7. **Template study** — call `browse_templates` with the active theme. For EACH template returned:
   - Read the `description`, `useCase`, `bestFor` fields
   - Consider whether ANY scene in the transcript could use this template
   - Pay special attention to geographic/location templates (inkmap, country, globe-spin) when the content mentions countries, cities, or places
   - Pay special attention to data templates (stats, chart, barchart) when the content mentions numbers or statistics
   - Pay special attention to comparison templates (versus, proscons, beforeafter) when the content contrasts two or more things
   - **Think creatively:** a "definition" template isn't just for dictionary words — it works for any term the speaker explains. A "map" template isn't just for travel — it works for any content mentioning a specific place or country.
8. For each scene, check the template list and assign a template if one fits. Scenes without a matching template use `template: none`.
```

Renumber subsequent steps accordingly (current steps 7-11 become 9-13).

- [ ] **Step 2: Strengthen the Template Registry section**

Replace the current Template Registry section (lines 304-338) with:

```markdown
## Template Registry — MANDATORY

You MUST call `browse_templates` with the active theme before writing ANY scene plans. Templates are production-quality, pre-tested components that save animation time and ensure visual consistency.

### Template Study Protocol
1. Call `browse_templates(theme: "{{THEME}}")` — ONE call returns all templates
2. Read EVERY template's description, useCase, and bestFor fields carefully
3. For EACH scene you're planning, check if a template matches the content — not just the scene type
4. **Default is to USE a template.** Only set `template: none` when no template is even close to the scene's content.

### Template Selection Criteria
- Match by **content**, not just scene type. A video mentioning "Algeria" should use `magazine-country` or `magazine-inkmap`, even if the scene type is "custom"
- Match by **visual need**. If the scene needs a big number, use `magazine-stats` or `explainer-stats` regardless of scene type
- Match by **structure**. If the scene compares things, check `magazine-versus`, `magazine-comparison`, `magazine-proscons`, `magazine-beforeafter`
- When multiple templates could work, pick the one whose `bestFor` most closely matches the scene content

### Theme → Template Quick Reference

| Scene type | Blackboard theme | Magazine theme |
|---|---|---|
| `definition` | `explainer-definition` | `magazine-definition` |
| `step-cards` | `explainer-process`, `explainer-howitworks` | `magazine-steps`, `magazine-checklist` |
| `comparison` | `explainer-comparison`, `explainer-venn` | `magazine-comparison`, `magazine-proscons`, `magazine-versus`, `magazine-beforeafter` |
| `flowchart` | `explainer-flow`, `explainer-cycle` | — |
| `data-viz` | `explainer-stats`, `explainer-barchart`, `explainer-funnel` | `magazine-stats`, `magazine-chart`, `magazine-pricetag` |
| `timeline` | `explainer-timeline` | `magazine-timeline` |
| `hierarchy` | `explainer-tree`, `explainer-layers` | — |
| `cause-effect` | `explainer-cause-effect` | — |
| `custom` | `explainer-network`, `explainer-orbit`, `explainer-matrix` | `magazine-quote`, `magazine-profile`, `magazine-trivia`, `magazine-didyouknow` |
| `progress` | `explainer-ranking` | `magazine-ranking` |
| **geographic** | `globe-spin`, `country-highlight` | `magazine-inkmap`, `magazine-country`, `magazine-location` |
| **alert/warning** | — | `magazine-alert`, `magazine-warning` |
| **verdict/review** | — | `magazine-verdict`, `magazine-mythfact` |

**NOTE:** The "geographic" row is NOT a scene type — it's a content signal. If the transcript mentions countries, cities, or locations, consider geographic templates regardless of scene type.
```

- [ ] **Step 3: Commit**

```bash
git add packages/sandbox/src/prompts/planner/system.md
git commit -m "feat(sandbox): planner deeply studies templates before planning scenes"
```

---

### Task 15c: Add `template:` to per-scene schema and update good-plan example

**Problem:** The per-scene schema (lines 93-140) lists every required field but omits `template:`. The good-plan example (`good-plan.md`) has 6 scenes with zero template fields. LLMs follow examples over instructions — this is the #1 reason planners skip templates.

**Files:**
- Modify: `packages/sandbox/src/prompts/planner/system.md:93-140` (per-scene schema)
- Modify: `packages/sandbox/src/prompts/planner/system.md:204-225` (self-verification checklist)
- Modify: `packages/sandbox/src/prompts/planner/examples/good-plan.md`

- [ ] **Step 1: Add template fields to per-scene schema**

In `planner/system.md`, after line 100 (`**Layout pattern:**`), add:

```markdown
**Template:** [slug from registry] | none
**Fork reason:** [why this template fits — only if template is not "none"]
```

So the schema block becomes:
```
## Scene N: [Name]
**File:** Scene{N}.tsx
**Time:** startMs – endMs
**Transcript:** "exact words from this segment — copied verbatim, no paraphrasing"
**Display mode:** Fullscreen | Stacked [top%/bottom%] | Overlay
**Scene type:** step-cards | comparison | flowchart | data-viz | definition | timeline | hierarchy | cause-effect | progress | custom
**Layout pattern:** center-dominant | asymmetric | diagonal-flow | stacked-cascade | full-bleed | scattered
**Template:** [slug from registry] | none
**Fork reason:** [why this template fits — only if template is not "none"]
```

- [ ] **Step 2: Add template checks to self-verification checklist**

In `planner/system.md`, add these items to the self-verification checklist (~line 225):

```markdown
- [ ] Every scene has a **Template** field (either a slug or "none")
- [ ] At least 50% of scenes with a matching template in the registry use one (not all "none")
- [ ] Geographic content (countries, cities, locations) uses a geographic template (inkmap, country, location, globe-spin)
- [ ] Data content (numbers, statistics, percentages) uses a data template (stats, chart, barchart, pricetag)
```

- [ ] **Step 3: Update good-plan example with template fields**

In `packages/sandbox/src/prompts/planner/examples/good-plan.md`, add template fields to existing scenes. The example uses the blackboard theme (based on its style tokens). Update each scene:

**Scene 1** (data-viz, thermometer):
```markdown
**Template:** explainer-stats
**Fork reason:** big number count-up (73%) with visual emphasis — adapt thermometer metaphor using stats layout and count-up animation
```

**Scene 2** (cause-effect, staircase):
```markdown
**Template:** explainer-cause-effect
**Fork reason:** plateau vs growth is a cause-effect relationship — adapt two-panel layout for staircase metaphor
```

**Scene 3** (comparison, battery):
```markdown
**Template:** explainer-comparison
**Fork reason:** two-state battery comparison (overtraining vs recovery) maps to side-by-side comparison columns
```

**Scene 4** (data-viz, fuel gauge):
```markdown
**Template:** explainer-stats
**Fork reason:** protein target is a big number (0.7-1.0g/lb) — adapt gauge visual using stats count-up animation
```

**Scene 5** (timeline, calendar ribbon):
```markdown
**Template:** explainer-timeline
**Fork reason:** 12-week framework is a chronological sequence — adapt timeline nodes for weekly markers
```

**Scene 6** (step-cards, puzzle pieces):
```markdown
**Template:** none
**Fork reason:** —
```

Also add to the Global section at the top:
```markdown
- **Theme:** blackboard
```

And update the self-verification checklist at the bottom to include:
```markdown
- [x] Every scene has a **Template** field: explainer-stats, explainer-cause-effect, explainer-comparison, explainer-stats, explainer-timeline, none (5 of 6 scenes use templates).
- [x] At least 50% of scenes use templates: 5/6 = 83%.
```

- [ ] **Step 4: Commit**

```bash
git add packages/sandbox/src/prompts/planner/system.md packages/sandbox/src/prompts/planner/examples/good-plan.md
git commit -m "feat(sandbox): template field required in scene schema, good-plan example updated with templates"
```

---

### Task 16: Add orchestrator template validation gate

**Files:**
- Modify: `packages/sandbox/src/orchestrator.ts` (after Phase 3, before Phase 4, before Phase 6)

- [ ] **Step 1: Add template slug parsing after Planner completes**

**Note:** The orchestrator runs inside the sandbox container and has direct filesystem access to `/workspace` via the `WORKSPACE` env var. It already uses `readFileSync` for reading `generation-progress.json` and `.pipeline-phase`. The file I/O below follows the same pattern.

After Phase 3 completion in orchestrator.ts, add:

```ts
// Parse scene-templates.json written by Planner
const templatesJsonPath = join(WORKSPACE, 'docs/scene-templates.json');
let requiredTemplates: Array<{ sceneNumber: number; template: string }> = [];
if (existsSync(templatesJsonPath)) {
  try {
    const data = JSON.parse(readFileSync(templatesJsonPath, 'utf-8'));
    requiredTemplates = data.scenes || [];
  } catch (err) {
    console.error('Failed to parse scene-templates.json:', err);
  }
}
```

- [ ] **Step 2: Pass validated slug list to Setup Agent dispatch**

Update the Setup Agent dispatch message to include:

```ts
const templateSlugs = [...new Set(requiredTemplates.map(t => t.template))];
const setupPrompt = `${baseSetupPrompt}\n\nRequired templates to fork: ${JSON.stringify(templateSlugs)}`;
```

- [ ] **Step 3: Add Setup-to-Animator gate**

After Setup Agent returns, before dispatching animators:

```ts
// Verify all templates were forked
const workspaceTemplatesPath = join(WORKSPACE, 'workspace-templates.json');
if (existsSync(workspaceTemplatesPath)) {
  const forked = JSON.parse(readFileSync(workspaceTemplatesPath, 'utf-8'));
  for (const slug of templateSlugs) {
    const entry = forked.templates?.[slug];
    if (!entry) {
      console.error(`Template ${slug} not found in workspace-templates.json`);
      // Re-dispatch Setup Agent for this specific slug, or fail
    }
    const indexPath = join(WORKSPACE, entry.path, 'index.tsx');
    if (!existsSync(indexPath)) {
      console.error(`Template ${slug} fork incomplete: missing index.tsx`);
    }
  }
}
```

- [ ] **Step 4: Enrich animator dispatch with template info**

When dispatching animators for scenes with templates:

```ts
const sceneTemplate = requiredTemplates.find(t => t.sceneNumber === sceneNum);
if (sceneTemplate && forkedTemplates[sceneTemplate.template]) {
  const tpl = forkedTemplates[sceneTemplate.template];
  animatorPrompt += `\n\nTemplate: ${sceneTemplate.template}` +
    `\n  Path: ${tpl.path}/` +
    `\n  Shared libs: ${tpl.sharedLibs.join(', ')}`;
}
```

- [ ] **Step 5: Commit**

```bash
git add packages/sandbox/src/orchestrator.ts
git commit -m "feat(sandbox): orchestrator validates templates between pipeline phases"
```

---

### Task 17: Update agent prompts

**Files:**
- Modify: `packages/sandbox/src/prompts/setup-agent/system.md`
- Modify: `packages/sandbox/src/prompts/animator/system.md`

- [ ] **Step 1: Update Setup Agent prompt**

Add instructions to:
1. Check `fork_template()` return value for errors
2. Write `workspace-templates.json` after all forks complete
3. Commit template files to git (for checkpoint/restore)

```markdown
## Template Forking

Required templates are listed in your dispatch message. For each:

1. Call `fork_template` with the slug
2. **Check the response** — if it contains "error" or "failed", stop and report
3. After ALL forks succeed, write `/workspace/workspace-templates.json`:
   ```json
   { "forkedAt": "<ISO timestamp>", "templates": { "<slug>": { "path": "src/components/templates/<slug>", "sharedLibs": [...] } } }
   ```
4. Commit all template files: `git add src/components/templates/ && git commit -m "chore: fork templates"`
```

- [ ] **Step 2: Update Animator prompt**

Replace the current template instructions with:

```markdown
## Using Forked Templates

Your dispatch message includes template info for this scene:
- **Path**: where the template is forked
- **Shared libs**: what utilities are available (e.g., magazine/effects.tsx)

Import from the forked template path. Do NOT call `fork_template`.
If imports fail, report to orchestrator — do not attempt to fix missing templates.
```

- [ ] **Step 3: Commit**

```bash
git add packages/sandbox/src/prompts/setup-agent/system.md packages/sandbox/src/prompts/animator/system.md
git commit -m "feat(sandbox): update agent prompts for manifest-driven template flow"
```

---

## Final: End-to-End Verification

### Task 18: Run full build pipeline and validation

- [ ] **Step 1: Run template validation**

Run: `npx tsx packages/templates/scripts/validate-templates.ts`
Expected: All templates pass all checks

- [ ] **Step 2: Run registry build**

Run: `cd packages/templates && pnpm build:registry`
Expected: Builds successfully, registry.json has `useCase`/`bestFor`/`notFor`, no `aspectRatio`/`estimatedDuration`

- [ ] **Step 3: Run template bundle build**

Run: `cd packages/templates && pnpm templates:build`
Expected: All bundles compile

- [ ] **Step 4: Run sandbox TypeScript check**

Run: `cd packages/sandbox && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit any remaining fixes**

Stage only the specific files that were fixed (avoid `git add -A` which could stage unrelated changes):

```bash
git add packages/templates/ packages/sandbox/ packages/shared/ packages/api/
git commit -m "fix: address any remaining issues from end-to-end verification"
```
