# Template Registry + On-Demand Resolution Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace bulk-copy of 60 templates with a build-time registry and Director-driven selective resolution, matching the v0/shadcn pattern.

**Architecture:** Build-time script produces `registry.json` (metadata index) and `r/{slug}.json` (source-inlined items). Director receives categorized catalog, selects templates per scene. Resolution step copies only selected templates + deps before Animator runs. Python bulk copy deleted entirely.

**Tech Stack:** TypeScript (tsup, tsx), Zod schemas, existing Remotion template structure

**Design doc:** `docs/plans/2026-03-09-template-registry-design.md`

---

### Task 1: Add `category` field to TemplateMeta type

**Files:**
- Modify: `packages/templates/src/types.ts:4-15`

**Step 1: Update the TemplateMeta interface**

In `packages/templates/src/types.ts`, the `category` field already exists (line 7) but has limited values. Expand it to cover all template purposes:

```typescript
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
  | 'entertainment';
```

**Step 2: Verify typecheck passes**

Run: `cd packages/templates && pnpm typecheck`
Expected: May fail if existing meta.json categories don't match new union — that's expected, fixed in Task 2.

**Step 3: Commit**

```bash
git add packages/templates/src/types.ts
git commit -m "feat(templates): expand TemplateMeta category union for registry"
```

---

### Task 2: Add `category` to all template meta.json files

**Files:**
- Modify: `packages/templates/src/templates/*/meta.json` (54+ files)

**Step 1: Write a migration script**

Create `packages/templates/scripts/migrate-categories.ts`:

```typescript
import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const TEMPLATES_DIR = join(__dirname, '..', 'src', 'templates');

// Map existing categories + tag patterns to new categories
function inferCategory(meta: { category?: string; tags: string[]; slug: string }): string {
  const tags = meta.tags.join(' ').toLowerCase();
  const slug = meta.slug.toLowerCase();

  // Geographic/map templates
  if (['globe', 'map', 'road-trip', 'coverage', 'compass', 'elevation', 'heatmap',
       'neighborhood', 'pin-drop', 'postcard', 'property', 'satellite', 'territory',
       'timezone', 'choropleth', 'hub-spoke', 'event-locator', 'split-departure',
       'neon-dark-map', 'warm-intro'].some(k => slug.includes(k) || tags.includes(k))) {
    return 'geographic';
  }
  // Data visualization
  if (['stat-', 'bar-chart', 'chart', 'counter', 'meter', 'number-ticker', 'split-stat',
       'score-meter', 'rating-display'].some(k => slug.includes(k))) {
    return 'data-visualization';
  }
  // Text/typography
  if (['kinetic', 'headline', 'keyword', 'caption', 'bullet', 'formula',
       'definition', 'news-ticker'].some(k => slug.includes(k))) {
    return 'text-typography';
  }
  // Comparison
  if (['versus', 'pros-cons', 'before-after', 'comparison', 'poll-battle',
       'tier-board'].some(k => slug.includes(k))) {
    return 'comparison';
  }
  // Social engagement
  if (['subscribe', 'comment', 'follower', 'social', 'emoji', 'audience',
       'qr-code', 'link-callout', 'coupon'].some(k => slug.includes(k))) {
    return 'social-engagement';
  }
  // Intro/outro
  if (['intro', 'end-screen', 'logo-stinger', 'credits', 'channel-intro',
       'countdown', 'alert-banner'].some(k => slug.includes(k))) {
    return 'intro-outro';
  }
  // Timeline/process
  if (['timeline', 'process-flow', 'step-counter', 'agenda', 'journey',
       'multi-stop'].some(k => slug.includes(k))) {
    return 'timeline-process';
  }
  // Media
  if (['youtube', 'video', 'clip'].some(k => slug.includes(k))) {
    return 'media';
  }
  // Fallback based on existing category
  return meta.category || 'marketing';
}

for (const dir of readdirSync(TEMPLATES_DIR, { withFileTypes: true })) {
  if (!dir.isDirectory()) continue;
  const metaPath = join(TEMPLATES_DIR, dir.name, 'meta.json');
  try {
    const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
    meta.category = inferCategory(meta);
    writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n', 'utf-8');
    console.log(`${dir.name} → ${meta.category}`);
  } catch {
    // Skip dirs without meta.json
  }
}
```

**Step 2: Run the migration**

Run: `cd packages/templates && npx tsx scripts/migrate-categories.ts`
Expected: Prints each template slug → category mapping.

**Step 3: Verify a few meta.json files look correct**

Spot-check: `cat packages/templates/src/templates/stat-counter/meta.json` should show `"category": "data-visualization"`.
Spot-check: `cat packages/templates/src/templates/globe-spin/meta.json` should show `"category": "geographic"`.

**Step 4: Verify typecheck**

Run: `cd packages/templates && pnpm typecheck`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/templates/src/templates/*/meta.json packages/templates/scripts/migrate-categories.ts
git commit -m "feat(templates): assign registry categories to all template meta.json"
```

---

### Task 3: Build the `build-registry` script

**Files:**
- Create: `packages/templates/scripts/build-registry.ts`
- Modify: `packages/templates/package.json` (add script)

**Step 1: Write the build-registry script**

Create `packages/templates/scripts/build-registry.ts`:

```typescript
/**
 * Build-time script that produces:
 * - registry.json  (metadata-only index for catalog prompts)
 * - r/{slug}.json  (full item with inlined source for each template)
 * - r/use-scale.json, r/fonts.json  (shared dependencies)
 *
 * Follows the shadcn registry-item.json schema.
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'fs';
import { join, relative } from 'path';

const TEMPLATES_DIR = join(__dirname, '..', 'src', 'templates');
const SRC_DIR = join(__dirname, '..', 'src');
const OUTPUT_DIR = join(__dirname, '..', 'r');
const REGISTRY_PATH = join(__dirname, '..', 'registry.json');

// Ensure output dir exists
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
  meta: Record<string, unknown>;
}

// Files to skip when reading template source
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

// Detect shared dependency imports to populate registryDependencies
function detectSharedDeps(files: RegistryFile[]): string[] {
  const deps = new Set<string>();
  for (const f of files) {
    if (f.content.includes('use-scale')) deps.add('use-scale');
    if (f.content.includes('fonts') && f.content.match(/from\s+['"]\.\.\/\.\.\/fonts['"]/)) deps.add('fonts');
  }
  return Array.from(deps);
}

// Build per-template registry items
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
  if (!tags.includes('studio-theme')) continue;

  // Read all source files
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

  // Write per-template JSON
  writeFileSync(join(OUTPUT_DIR, `${meta.slug}.json`), JSON.stringify(item, null, 2), 'utf-8');

  // Catalog entry (no file contents)
  catalogItems.push({
    name: meta.slug as string,
    type: 'registry:component',
    description: (meta.description as string) || '',
    categories: [meta.category as string].filter(Boolean),
    meta: {
      stylePreset: meta.stylePreset,
      aspectRatio: meta.aspectRatio,
      estimatedDuration: meta.estimatedDuration,
    },
  });

  templateCount++;
}

// Build shared dependency items
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
    files: [
      {
        path: sharedFile,
        content: readFileSync(srcPath, 'utf-8'),
        type: 'registry:lib',
      },
    ],
    meta: {},
  };
  writeFileSync(join(OUTPUT_DIR, `${name}.json`), JSON.stringify(item, null, 2), 'utf-8');
}

// Write top-level registry.json (metadata only)
const registry = {
  name: 'viona-templates',
  homepage: 'https://viona.app',
  items: catalogItems,
};
writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2), 'utf-8');

console.log(`Built registry: ${templateCount} templates, ${catalogItems.length} catalog items`);
console.log(`Output: ${REGISTRY_PATH} + ${OUTPUT_DIR}/`);
```

**Step 2: Add script to package.json**

In `packages/templates/package.json`, add to `"scripts"`:
```json
"build:registry": "tsx scripts/build-registry.ts"
```

**Step 3: Run it**

Run: `cd packages/templates && pnpm build:registry`
Expected: Prints `Built registry: ~60 templates, ~60 catalog items` and creates `registry.json` + `r/*.json` files.

**Step 4: Verify output**

Check: `cat packages/templates/registry.json | head -20` — should show metadata-only items.
Check: `cat packages/templates/r/stat-counter.json | head -20` — should show files with inlined content.
Check: `ls packages/templates/r/ | wc -l` — should be ~62 (60 templates + use-scale + fonts).

**Step 5: Add `r/` and `registry.json` to package exports**

In `packages/templates/package.json`, add to `"exports"`:
```json
"./registry.json": "./registry.json",
"./r/*": "./r/*"
```

**Step 6: Add `r/` to .gitignore**

The `r/` directory is a build artifact. Add to `packages/templates/.gitignore`:
```
r/
```

But `registry.json` should be committed (it's small, useful for reference).

**Step 7: Commit**

```bash
git add packages/templates/scripts/build-registry.ts packages/templates/package.json packages/templates/.gitignore packages/templates/registry.json
git commit -m "feat(templates): add build-registry script producing shadcn-style registry"
```

---

### Task 4: Rewrite `buildStudioTemplateCatalog()` to use registry.json

**Files:**
- Modify: `packages/worker/src/prompts/studio-templates.ts`

**Step 1: Rewrite the function to read registry.json and produce categorized output**

Replace the entire file `packages/worker/src/prompts/studio-templates.ts`:

```typescript
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

// Human-readable labels for categories
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

**How to use:** Select templates by slug in scenes.json. The Animator will receive their full source code.
If no template fits a scene, use an empty array — the Animator will create custom visuals.
`;
}
```

**Step 2: Verify the worker still builds**

Run: `cd packages/worker && pnpm build`
Expected: PASS (may need to run `pnpm build:registry` in templates first)

**Step 3: Commit**

```bash
git add packages/worker/src/prompts/studio-templates.ts
git commit -m "refactor(worker): rewrite catalog builder to use registry.json with categories"
```

---

### Task 5: Add `templates` field to scenes.json schema + Director prompt

**Files:**
- Modify: `packages/worker/src/processors/generate-visuals/types.ts`
- Modify: `packages/worker/src/prompts/director/director.py`

**Step 1: Add `templates` to the scene type**

In `packages/worker/src/processors/generate-visuals/types.ts`, find the scene interface and add:

```typescript
templates?: string[];
```

**Step 2: Update Director prompt with template selection instruction**

In `packages/worker/src/prompts/director/director.py`, find the scenes.json format section (around lines 193-247) and add after the scene schema:

```python
# Add to the scenes.json format description, after displayMode/transition:
"""
  "templates": ["slug1"]       // (optional) template slugs from the catalog to use for this scene. Empty array or omit if no template fits.
"""
```

Also add an instruction near the template catalog injection point:

```python
"""
When planning scenes, review the template catalog and select templates where they match the scene's purpose.
Add a "templates" field to each scene in scenes.json listing the slugs.
Select at most 2 templates per scene. If no template fits, omit the field or use an empty array.
"""
```

**Step 3: Commit**

```bash
git add packages/worker/src/processors/generate-visuals/types.ts packages/worker/src/prompts/director/director.py
git commit -m "feat(worker): add templates field to scenes.json schema + Director instruction"
```

---

### Task 6: Create `template-resolver.ts` — selective resolution

**Files:**
- Create: `packages/worker/src/processors/generate-visuals/template-resolver.ts`

**Step 1: Write the resolver**

Create `packages/worker/src/processors/generate-visuals/template-resolver.ts`:

```typescript
import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { logger } from '../../logger.js';
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
  templates?: string[];
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
 * Reads scenes.json, collects unique template slugs selected by the Director,
 * resolves their source from the registry, copies files to workspace, and
 * returns the resolved template data for Animator prompt injection.
 */
export async function resolveSelectedTemplates(
  scenesJson: ScenesJson,
  workspaceSrc: string
): Promise<ResolvedTemplates> {
  const registryDir = join(findPackagesRoot(), 'templates', 'r');

  // 1. Collect unique slugs from all scenes
  const slugs = new Set<string>();
  for (const scene of scenesJson.scenes) {
    for (const slug of scene.templates ?? []) {
      slugs.add(slug);
    }
  }

  if (slugs.size === 0) {
    logger.info('No templates selected by Director — Animator will create custom visuals');
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
      logger.warn({ slug, err }, `Failed to resolve template "${slug}" — skipping`);
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
        // Ensure subdirectories exist (e.g., lib/, components/)
        mkdirSync(join(fileDest, '..'), { recursive: true });
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

  logger.info(
    { slugs: Array.from(slugs), copiedCount, depsResolved: resolved.size - copiedCount },
    'Resolved selected templates from registry'
  );

  return { templates: templateResults, copiedCount };
}

/**
 * Formats resolved templates into a markdown string for injection into the Animator prompt.
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
```

**Step 2: Commit**

```bash
git add packages/worker/src/processors/generate-visuals/template-resolver.ts
git commit -m "feat(worker): add template-resolver for on-demand registry resolution"
```

---

### Task 7: Replace bulk copy in `generate-visuals/index.ts`

**Files:**
- Modify: `packages/worker/src/processors/generate-visuals/index.ts:256-288`

**Step 1: Remove the bulk copy block and write catalog only**

Replace lines 256-288 in `packages/worker/src/processors/generate-visuals/index.ts`.

Remove the entire `if (stylePreset === 'studio-dark' || stylePreset === 'studio-light')` block that does bulk copy.

Replace with:

```typescript
// Write categorized template catalog for Director prompt
if (stylePreset === 'studio-dark' || stylePreset === 'studio-light') {
  await publishJobProgress(jobId, 13, 'Preparing template catalog...');
  try {
    const srcDir = join(workspacePath, 'src');
    const catalog = buildStudioTemplateCatalog();
    await writeFile(join(srcDir, 'STUDIO_TEMPLATES.md'), catalog, 'utf-8');
    logger.info('Studio template catalog written to workspace');
  } catch (err) {
    logger.warn({ err }, 'Failed to write studio template catalog (non-fatal)');
  }
}
```

Note: Template resolution (selective copy) now happens AFTER the Director phase, not before. See Task 8.

**Step 2: Remove the `listTemplates` import if no longer used**

Check if `listTemplates` from `@viona/templates` is used elsewhere in this file. If not, remove the import (line 21).

**Step 3: Verify build**

Run: `cd packages/worker && pnpm build`
Expected: PASS

**Step 4: Commit**

```bash
git add packages/worker/src/processors/generate-visuals/index.ts
git commit -m "refactor(worker): replace bulk template copy with catalog-only write"
```

---

### Task 8: Add resolution step after Director, before Animator (Python)

**Files:**
- Modify: `packages/worker/src/agents/claude_visual_generator.py`

This is the largest change. Four things happen:

1. Delete `_copy_studio_templates()` method entirely (lines 2386-2434)
2. Remove all 3 duplicate catalog injections (Animator, Setup, per-scene) — keep only Director injection
3. After Director writes `scenes.json`, call out to a Node resolver script that reads scenes.json, resolves templates, copies selected ones, and returns the formatted source
4. Inject the resolved template source into the Animator prompt (replacing the catalog)

**Step 1: Delete `_copy_studio_templates()` method**

Remove lines 2386-2434 (the entire method).

**Step 2: Remove all calls to `_copy_studio_templates()`**

Search for `_copy_studio_templates` in the file. Remove every call (there are ~3 call sites — around lines 5111, 5495, 5581).

**Step 3: Remove duplicate catalog injections**

Keep the Director catalog injection (around line 2463-2472). Remove the catalog injection from:
- Animator prompt (around lines 2753-2759)
- Setup agent prompt (around lines 3683-3689)
- Per-scene retry prompt (around lines 3942-3947)

**Step 4: Add template resolution after Director phase**

After the Director writes `scenes.json` and before the Animator runs, add a call to resolve templates. The Python agent should invoke a small Node script that wraps `resolveSelectedTemplates()`:

Create `packages/worker/src/processors/generate-visuals/resolve-templates-cli.ts`:

```typescript
#!/usr/bin/env tsx
/**
 * CLI wrapper for template resolution.
 * Called by the Python visual generator after Director writes scenes.json.
 *
 * Usage: tsx resolve-templates-cli.ts <scenes-json-path> <workspace-src-path>
 * Output: JSON to stdout with resolved template markdown for Animator prompt.
 */
import { readFileSync } from 'fs';
import { resolveSelectedTemplates, formatTemplatesForAnimator } from './template-resolver.js';

const [scenesPath, workspaceSrc] = process.argv.slice(2);
if (!scenesPath || !workspaceSrc) {
  console.error('Usage: tsx resolve-templates-cli.ts <scenes.json> <workspace-src>');
  process.exit(1);
}

const scenesJson = JSON.parse(readFileSync(scenesPath, 'utf-8'));
const resolved = await resolveSelectedTemplates(scenesJson, workspaceSrc);
const markdown = formatTemplatesForAnimator(resolved);

// Output JSON so Python can parse it
console.log(JSON.stringify({ markdown, copiedCount: resolved.copiedCount }));
```

In Python, after Director completes and `scenes.json` is written:

```python
# Resolve selected templates from registry
if style_preset.startswith("studio"):
    scenes_path = self.src_dir / "scenes.json"
    if scenes_path.exists():
        try:
            resolve_script = Path(__file__).parent.parent / "processors" / "generate-visuals" / "resolve-templates-cli.ts"
            result = subprocess.run(
                ["npx", "tsx", str(resolve_script), str(scenes_path), str(self.workspace / "src")],
                capture_output=True, text=True, timeout=30,
                cwd=str(Path(__file__).parent.parent.parent)
            )
            if result.returncode == 0:
                resolve_data = json.loads(result.stdout)
                self._resolved_templates_md = resolve_data.get("markdown", "")
                safe_print(f"[ClaudeGenerator] Resolved {resolve_data.get('copiedCount', 0)} templates from registry")
            else:
                safe_print(f"[ClaudeGenerator] Template resolution failed: {result.stderr}")
                self._resolved_templates_md = ""
        except Exception as e:
            safe_print(f"[ClaudeGenerator] Template resolution error: {e}")
            self._resolved_templates_md = ""
```

**Step 5: Inject resolved template source into Animator prompt**

Where the Animator catalog injection used to be, inject `self._resolved_templates_md` instead:

```python
# Inject selected template source for studio preset
if style_preset.startswith("studio") and self._resolved_templates_md:
    animator_message += f"\n\n{self._resolved_templates_md}"
    safe_print(f"[ClaudeGenerator] Injected {len(self._resolved_templates_md)} chars of selected template source into Animator prompt")
```

**Step 6: Commit**

```bash
git add packages/worker/src/agents/claude_visual_generator.py packages/worker/src/processors/generate-visuals/resolve-templates-cli.ts
git commit -m "refactor(worker): replace bulk template copy with Director-driven selective resolution"
```

---

### Task 9: Wire up the build pipeline

**Files:**
- Modify: `packages/templates/package.json`
- Modify: root `package.json` or turbo config (if applicable)

**Step 1: Make `build:registry` run as part of the templates build**

In `packages/templates/package.json`, update the build script:

```json
"build": "tsup && tsx scripts/build-registry.ts"
```

This ensures `registry.json` and `r/` are always up-to-date after building templates.

**Step 2: Verify full build**

Run: `cd packages/templates && pnpm build`
Expected: tsup builds dist/, then build-registry creates registry.json + r/

**Step 3: Verify worker build**

Run: `cd packages/worker && pnpm build`
Expected: PASS

**Step 4: Commit**

```bash
git add packages/templates/package.json
git commit -m "chore(templates): wire build:registry into main build pipeline"
```

---

### Task 10: End-to-end verification

**Step 1: Run the full build from root**

Run: `pnpm build` (or however the monorepo builds)
Expected: All packages build successfully.

**Step 2: Verify registry output**

Run: `ls packages/templates/r/ | wc -l`
Expected: ~62 files (60 templates + use-scale + fonts)

Run: `cat packages/templates/registry.json | python -c "import json,sys; d=json.load(sys.stdin); print(len(d['items']), 'items')"`
Expected: ~60 items

**Step 3: Verify catalog format**

Run: `cd packages/worker && node -e "const {buildStudioTemplateCatalog} = require('./dist/prompts/studio-templates.js'); console.log(buildStudioTemplateCatalog())"`
Expected: Categorized markdown output with section headers.

**Step 4: Check for any remaining references to deleted code**

Run: `grep -r "_copy_studio_templates" packages/worker/src/` — should return nothing.
Run: `grep -r "AVAILABLE STUDIO TEMPLATES" packages/worker/src/` — should return nothing (that was the duplicate injection header).

**Step 5: Commit any cleanup**

```bash
git commit -m "chore: verify template registry end-to-end pipeline"
```
