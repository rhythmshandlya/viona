# Templates Runtime Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop `apps/web` (and every other consumer) from statically importing every template's source code — templates become runtime-loaded bundles fetched from S3 via an api registry endpoint, just like the workspace's `player-composition.cjs.js`.

**Architecture:**
- `@viona/templates` keeps one tiny exported surface — registry client (async fetch from api), types, shared hooks (`useScale`), font registry, lib utilities. **No template source re-exports.**
- Per-template ESM bundles stay in `packages/templates/src/templates/*` as **build input only**, compiled by the existing `scripts/build-templates.ts` and uploaded to S3 by `scripts/upload-templates.ts`. They never reach the web/sandbox/worker build graphs.
- Consumers (web's `StaticTemplateRenderer`, sandbox scenes, render-service) resolve a template by slug → api returns `bundleKey` + metadata → fetch bundle from `/api/templates/:slug/bundle` → `eval` + cache component.
- `dependencies` listed in `packages/templates/package.json` exist only to satisfy `build-templates.ts` esbuild's module resolution; nothing else in the monorepo ever installs transitive template deps.

**Tech Stack:** TypeScript · pnpm workspaces · tsup (for the registry client) · esbuild (for template bundles, existing) · Fastify api · Drizzle ORM · MinIO/S3 · Remotion 4.0

**Prerequisites before starting:**
- DB table `templates` already exists with `bundleKey`, `sourceKey`, `propsSchema`, `defaultProps`, `dependencies` columns (confirmed in `packages/api/src/db/schema.ts`).
- `packages/templates/scripts/build-templates.ts` already builds per-template ESM bundles with React/Remotion/google-fonts externalized via `globalsPlugin`.
- `packages/templates/scripts/upload-templates.ts` already uploads bundles to S3 at `templates/{slug}/bundle.{hash}.js` and upserts rows in `templates` table.
- api already exposes `GET /templates` (list) via `packages/api/src/routes/templates.ts`.
- The workspace composition's `player-composition.cjs.js` runtime-eval pattern in `apps/web/src/features/editor-v2/player/useWorkspaceComposition.ts:299-409` is the reference for how to eval a fetched bundle safely.

---

## File Structure

**Create:**
- `packages/templates/src/runtime-registry.ts` — the new async registry client that replaces the static `src/registry.ts` for consumers.
- `packages/api/src/routes/template-bundle.ts` — route handler exposing `GET /templates/:slug/bundle` that streams or redirects to the S3 presigned URL.
- `scripts/temp/test-templates-runtime.ts` — E2E smoke test that lists templates via api and loads one bundle.

**Modify:**
- `packages/templates/src/index.ts:31-150` — remove all `import './templates/*/register'` lines; re-export the new runtime-registry functions.
- `packages/templates/src/registry.ts` — mark the in-memory `Map`-based registry as legacy, keep only what `scripts/build-templates.ts` still needs (ideally nothing).
- `packages/templates/package.json` — commit the manifest so its `dependencies` include what the template source files import at build time (`react-pdf`, `pdfjs-dist`, `mapbox-gl`, `@types/mapbox-gl`, `@turf/turf`). These are for `templates:build` only; nothing else installs them transitively because they're never imported from `src/index.ts`.
- `packages/templates/tsup.config.ts` — tighten the externalizing so the published esm bundle is tiny.
- `packages/api/src/index.ts` — register the new `template-bundle.ts` route.
- `packages/api/src/routes/templates.ts:~30-end` — when returning templates, include a stable `bundleUrl: /api/templates/{slug}/bundle` so consumers don't need to know about S3 keys.
- `apps/web/src/features/editor-v2/player/StaticTemplateRenderer.tsx:11, 88-117` — swap `getTemplate` (sync) for async `loadTemplateBundle(slug)`; fetch + eval + cache.
- `packages/sandbox/template/src/items/BrollItem.tsx` (or wherever sandbox scenes currently `import { getTemplate }`) — same async treatment.
- `packages/render-service/src/render.ts` (or equivalent) — if it imports `getTemplate`, route through the runtime registry.
- `docs/README.md` or `packages/templates/README.md` — one-paragraph "how to ship a new template" pointer.

**Reference (read-only):**
- `apps/web/src/features/editor-v2/player/useWorkspaceComposition.ts:299-409` — pattern for fetching a bundle, creating a custom `require`, eval'ing, caching.
- `packages/templates/scripts/build-templates.ts` — existing bundle builder, do not change.
- `packages/templates/scripts/upload-templates.ts` — existing S3 uploader + DB registrar, do not change.
- `packages/api/src/services/minio.ts` — for `getPresignedDownloadUrl(key)` helper used in Task 1.

---

### Task 1: Add api route to serve template bundle by slug

**Files:**
- Create: `packages/api/src/routes/template-bundle.ts`
- Modify: `packages/api/src/index.ts` (register the new route)

- [ ] **Step 1: Read the existing templates.ts route to reuse its patterns**

Run:
```bash
head -100 packages/api/src/routes/templates.ts
```

Expected: confirms the file uses `db`, `templates` from `drizzle`, `getPresignedDownloadUrl` from `../services/minio.js`, and registers routes via `fastify.get('/templates', ...)` with no auth for the list endpoint.

- [ ] **Step 2: Create the bundle route**

Write to `packages/api/src/routes/template-bundle.ts`:

```typescript
import { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db, templates } from '../db/index.js';
import { getPresignedDownloadUrl } from '../services/minio.js';
import { logger } from '../logger.js';

export async function templateBundleRoutes(fastify: FastifyInstance) {
  // GET /templates/:slug/bundle — 302 to a presigned S3 URL for the bundle
  fastify.get<{ Params: { slug: string } }>('/templates/:slug/bundle', async (request, reply) => {
    const { slug } = request.params;

    const row = await db.query.templates.findFirst({
      where: eq(templates.slug, slug),
    });

    if (!row || !row.isPublished) {
      return reply.code(404).send({ error: 'Template not found' });
    }

    if (!row.bundleKey) {
      return reply.code(500).send({ error: 'Template is published but has no bundleKey' });
    }

    try {
      // Presigned URL so the browser can stream the bundle directly from S3/MinIO
      // without our api proxying bytes. Short TTL since consumers cache the eval'd
      // component in-memory — they don't re-fetch on every render.
      const url = await getPresignedDownloadUrl(row.bundleKey, 60 * 10);
      return reply.redirect(302, url);
    } catch (err: any) {
      logger.error({ err: err.message, slug, bundleKey: row.bundleKey }, 'Failed to sign bundle URL');
      return reply.code(500).send({ error: 'Failed to sign bundle URL' });
    }
  });
}
```

- [ ] **Step 3: Register the route**

Edit `packages/api/src/index.ts`. Find where `templateRoutes` is registered (search for `templateRoutes` or `/templates`) and add the new one adjacent:

```typescript
import { templateBundleRoutes } from './routes/template-bundle.js';
// ...later, alongside templateRoutes registration:
await fastify.register(templateBundleRoutes, { prefix: '/api' });
```

- [ ] **Step 4: Typecheck**

Run:
```bash
pnpm --filter @viona/api typecheck
```

Expected: no new errors in the new file.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/routes/template-bundle.ts packages/api/src/index.ts
git commit -m "feat(api): add /templates/:slug/bundle route (302 to presigned S3 URL)"
```

---

### Task 2: Write the runtime registry client

**Files:**
- Create: `packages/templates/src/runtime-registry.ts`

- [ ] **Step 1: Define the runtime-registry module**

Write to `packages/templates/src/runtime-registry.ts`:

```typescript
import type React from 'react';
import type { TemplateMeta } from './types';

/**
 * Runtime registry client. Replaces the build-time static registry in
 * src/registry.ts for every consumer outside scripts/build-templates.ts.
 *
 * - `listTemplates()` -> GET /api/templates
 * - `loadTemplate(slug)` -> GET /api/templates/:slug plus a one-time bundle eval
 * - Bundles are fetched from /api/templates/:slug/bundle and cached in-memory.
 */

export interface TemplateSummary {
  slug: string;
  name: string;
  description: string | null;
  category: string;
  tags: string[];
  aspectRatio: '16:9' | '9:16' | '1:1';
  durationFrames: number;
  fps: number;
  width: number;
  height: number;
  screenshotUrl: string | null;
  defaultProps: Record<string, unknown>;
  propsSchema: Record<string, unknown> | null;
  bundleUrl: string;
}

export interface LoadedTemplate {
  meta: TemplateSummary;
  Component: React.ComponentType<any>;
}

interface RuntimeRegistryOptions {
  /** Base URL for the api; defaults to same-origin '/api'. */
  apiBase?: string;
  /** Inject a module resolver for the custom `require` used during bundle eval. */
  resolveExternal?: (mod: string) => unknown;
}

// ── Cache ───────────────────────────────────────────────────────────────────
const summaryCache = new Map<string, TemplateSummary>();
const componentCache = new Map<string, React.ComponentType<any>>();

function base(opts?: RuntimeRegistryOptions) {
  return opts?.apiBase ?? '/api';
}

export async function listTemplates(
  opts?: RuntimeRegistryOptions & { category?: string; aspectRatio?: string; limit?: number }
): Promise<TemplateSummary[]> {
  const params = new URLSearchParams();
  if (opts?.category) params.set('category', opts.category);
  if (opts?.aspectRatio) params.set('aspectRatio', opts.aspectRatio);
  if (opts?.limit) params.set('limit', String(opts.limit));

  const res = await fetch(`${base(opts)}/templates?${params}`, { credentials: 'include' });
  if (!res.ok) throw new Error(`listTemplates failed: ${res.status}`);

  const body = await res.json() as { templates: Array<Record<string, any>> };
  const out: TemplateSummary[] = body.templates.map(rowToSummary);
  for (const s of out) summaryCache.set(s.slug, s);
  return out;
}

export async function getTemplateSummary(slug: string, opts?: RuntimeRegistryOptions): Promise<TemplateSummary> {
  const cached = summaryCache.get(slug);
  if (cached) return cached;

  const res = await fetch(`${base(opts)}/templates/${encodeURIComponent(slug)}`, { credentials: 'include' });
  if (!res.ok) throw new Error(`getTemplateSummary(${slug}) failed: ${res.status}`);
  const row = await res.json() as Record<string, any>;
  const summary = rowToSummary(row);
  summaryCache.set(slug, summary);
  return summary;
}

export async function loadTemplate(slug: string, opts?: RuntimeRegistryOptions): Promise<LoadedTemplate> {
  const meta = await getTemplateSummary(slug, opts);

  const cached = componentCache.get(slug);
  if (cached) return { meta, Component: cached };

  const bundleRes = await fetch(meta.bundleUrl, { credentials: 'include' });
  if (!bundleRes.ok) throw new Error(`fetch bundle ${meta.bundleUrl} -> ${bundleRes.status}`);
  const code = await bundleRes.text();

  // Mini CJS eval — the bundle was built by scripts/build-templates.ts with
  // externals for react/react-dom/remotion/@remotion/google-fonts so those
  // resolve via the injected `resolveExternal` function (or window globals
  // if the consumer already set them up that way).
  const requireFn = (mod: string) => {
    if (opts?.resolveExternal) return opts.resolveExternal(mod);
    throw new Error(`Template bundle for "${slug}" needs "${mod}" but no resolveExternal was provided`);
  };

  const module: { exports: Record<string, unknown> } = { exports: {} };
  const fn = new Function('module', 'exports', 'require', code);
  fn(module, module.exports, requireFn);

  const Component = (module.exports as any).default as React.ComponentType<any> | undefined;
  if (!Component) throw new Error(`Template bundle for "${slug}" did not export default component`);

  componentCache.set(slug, Component);
  return { meta, Component };
}

export function clearTemplateRuntimeCache() {
  summaryCache.clear();
  componentCache.clear();
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function rowToSummary(row: Record<string, any>): TemplateSummary {
  return {
    slug: row.slug,
    name: row.name,
    description: row.description ?? null,
    category: row.category,
    tags: Array.isArray(row.tags) ? row.tags : [],
    aspectRatio: row.aspectRatio ?? row.aspect_ratio ?? '16:9',
    durationFrames: row.durationFrames ?? row.duration_frames ?? 360,
    fps: row.fps ?? 30,
    width: row.width ?? 1920,
    height: row.height ?? 1080,
    screenshotUrl: row.screenshotUrl ?? row.screenshot_url ?? null,
    defaultProps: row.defaultProps ?? row.default_props ?? {},
    propsSchema: row.propsSchema ?? row.props_schema ?? null,
    bundleUrl: `/api/templates/${encodeURIComponent(row.slug)}/bundle`,
  };
}
```

- [ ] **Step 2: Typecheck**

Run:
```bash
pnpm --filter @viona/templates typecheck
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add packages/templates/src/runtime-registry.ts
git commit -m "feat(templates): add runtime registry client (api-backed)"
```

---

### Task 3: Strip static template imports from `src/index.ts`

**Files:**
- Modify: `packages/templates/src/index.ts`

- [ ] **Step 1: Rewrite the file**

Open `packages/templates/src/index.ts` and replace its contents with:

```typescript
// Types
export type {
  TemplateMeta,
  CompositionMeta,
  TemplateFile,
  TemplateRegistryEntry,
  TemplateCategory,
  AspectRatio,
  TemplateFilters,
} from './types';

// Runtime registry (api-backed) — the primary public API
export {
  listTemplates,
  getTemplateSummary,
  loadTemplate,
  clearTemplateRuntimeCache,
  type TemplateSummary,
  type LoadedTemplate,
} from './runtime-registry';

// Shared runtime utilities (used by built template bundles via externals, and
// by consumers rendering alongside templates)
export { useScale } from './use-scale';
export {
  FONTS,
  FONT_PAIRS,
  FONT_WEIGHTS,
  FONT_SIZES,
  getFontPairForContent,
} from './fonts';

// NOTE: template source (src/templates/*) is NOT re-exported here.
// It is build-input only for scripts/build-templates.ts, which produces
// per-template ESM bundles uploaded to S3 via scripts/upload-templates.ts.
// Consumers load templates at runtime via loadTemplate(slug) above.
```

- [ ] **Step 2: Rebuild the package**

Run:
```bash
pnpm --filter @viona/templates build
```

Expected:
- `dist/index.js` size drops from multi-MB to under 20 KB.
- No errors resolving `react-pdf`, `mapbox-gl`, etc. — because no template source is in the graph.

- [ ] **Step 3: Verify via grep that template source is no longer a transitive dep**

Run:
```bash
grep -E "react-pdf|mapbox-gl|pdfjs-dist" packages/templates/dist/index.js
```

Expected: no output (those libs are only referenced by per-template bundles, not the registry client).

- [ ] **Step 4: Commit**

```bash
git add packages/templates/src/index.ts
git commit -m "refactor(templates): drop static template imports from package entry"
```

---

### Task 4: Commit the build-only dependencies to `packages/templates/package.json`

**Files:**
- Modify: `packages/templates/package.json`

- [ ] **Step 1: Stage the manifest dep additions**

These deps exist only to satisfy `scripts/build-templates.ts`'s esbuild module resolution when compiling template source. They will not leak to the workspace consumers because `src/index.ts` no longer imports template source (Task 3).

Edit `packages/templates/package.json`. Under `dependencies`, add (keeping alphabetical order):

```json
    "@turf/turf": "^7.2.0",
    "@types/mapbox-gl": "^3.4.1",
    "mapbox-gl": "^3.12.0",
    "pdfjs-dist": "^5.6.205",
    "react-pdf": "^10.4.1",
```

- [ ] **Step 2: Update the lockfile**

Run from repo root:
```bash
pnpm install
```

Expected: `pnpm-lock.yaml` changes to add those five packages + their transitives under the `@viona/templates` importer. `pnpm install --frozen-lockfile` will now succeed on CI.

- [ ] **Step 3: Verify web build still passes AND is lean**

Run:
```bash
pnpm --filter web build
```

Expected: build succeeds. Next.js build output size for the editor route should be similar to before (confirm nothing ballooned by grepping `.next/server` for `react-pdf` — expected zero hits since web never imports a template bundle at build time).

```bash
grep -rE "react-pdf" apps/web/.next/server 2>/dev/null | head -3 || echo "clean"
```

Expected: `clean`.

- [ ] **Step 4: Commit**

```bash
git add packages/templates/package.json pnpm-lock.yaml
git commit -m "chore(templates): declare build-time deps (react-pdf, mapbox-gl, turf)"
```

---

### Task 5: Switch `StaticTemplateRenderer` to the runtime registry

**Files:**
- Modify: `apps/web/src/features/editor-v2/player/StaticTemplateRenderer.tsx`

- [ ] **Step 1: Read the current file**

Read lines 1-30 of `apps/web/src/features/editor-v2/player/StaticTemplateRenderer.tsx` to confirm the current imports: `import { getTemplate } from '@viona/templates';` (line 11) and the `loadTemplate` callback using `getTemplate(templateId)` then `entry.getComponent()` (lines 88-117).

- [ ] **Step 2: Rewrite the imports + loader**

Replace line 11:
```typescript
import { getTemplate } from '@viona/templates';
```
with:
```typescript
import { loadTemplate as loadTemplateRuntime } from '@viona/templates';
import * as RemotionRT from 'remotion';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
```

Replace the body of `loadTemplate` (lines 88-117) with:

```typescript
  const loadTemplate = useCallback(async () => {
    if (componentCache.has(templateId)) {
      setComponent(() => componentCache.get(templateId)!);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { Component: Loaded } = await loadTemplateRuntime(templateId, {
        resolveExternal: (mod) => {
          // Templates were built with these as externals (globalsPlugin).
          // Mirror the globals here so eval succeeds in the browser.
          switch (mod) {
            case 'react': return React;
            case 'react-dom': return ReactDOM;
            case 'remotion': return RemotionRT;
            default: throw new Error(`Template "${templateId}" asked for module "${mod}" which isn't provided as a runtime external`);
          }
        },
      });

      componentCache.set(templateId, Loaded);
      setComponent(() => Loaded);
    } catch (err) {
      console.error('Failed to load template:', err);
      setError(err instanceof Error ? err.message : 'Failed to load template');
    } finally {
      setLoading(false);
    }
  }, [templateId]);
```

- [ ] **Step 3: Typecheck web**

Run:
```bash
pnpm --filter web typecheck
```

Expected: 0 new errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/editor-v2/player/StaticTemplateRenderer.tsx
git commit -m "feat(web): load templates from runtime registry + S3 bundle"
```

---

### Task 6: Route the sandbox and render-service through the runtime registry

**Files:**
- Modify: any `*.ts` / `*.tsx` under `packages/sandbox/src/`, `packages/sandbox/template/src/`, `packages/render-service/src/`, `packages/worker/src/` that imports `getTemplate` from `@viona/templates`.

- [ ] **Step 1: Find every consumer**

Run:
```bash
grep -rE "from ['\"]@viona/templates['\"]" packages apps --include="*.ts" --include="*.tsx" | grep -v node_modules
```

Expected: a short list. For each entry, note the import shape.

- [ ] **Step 2: For each consumer, replace `getTemplate` with `loadTemplate`**

If a consumer uses `const entry = getTemplate(slug); const mod = await entry.getComponent();`, rewrite to:

```typescript
import { loadTemplate } from '@viona/templates';
// ...
const { Component, meta } = await loadTemplate(slug, {
  resolveExternal: (mod) => {
    // In the sandbox/worker the externals are already in scope via globals
    // injected by the Remotion runtime — mirror whatever the local context uses.
    if (mod === 'react') return require('react');
    if (mod === 'remotion') return require('remotion');
    throw new Error(`Template external ${mod} not provided`);
  },
});
```

For sandbox Remotion context (where `require` isn't available — the sandbox's own bundle is ESM), use the `import()` return values already resolved at module top:

```typescript
import * as React from 'react';
import * as RemotionRT from 'remotion';
import { loadTemplate } from '@viona/templates';
// ...
const { Component } = await loadTemplate(slug, {
  resolveExternal: (mod) =>
    mod === 'react' ? React
    : mod === 'remotion' ? RemotionRT
    : (() => { throw new Error(`unresolved template external: ${mod}`); })(),
});
```

If a consumer uses `listTemplates()` without args, it keeps working (new function matches signature).

If a consumer uses the now-private in-memory registry (`registerTemplate`), that code path is dead — delete it.

- [ ] **Step 3: Build every affected package**

Run:
```bash
pnpm -r --filter "./packages/sandbox..." --filter "./packages/worker..." --filter "./packages/render-service..." build
```

Expected: all packages build successfully.

- [ ] **Step 4: Commit**

```bash
git add packages/sandbox packages/worker packages/render-service
git commit -m "refactor(sandbox,worker,render): load templates via runtime registry"
```

---

### Task 7: Publish templates to S3 on deploy

**Files:**
- Modify: `package.json` (root) — add a `templates:publish:prod` script that runs against prod MinIO creds.
- Modify: `scripts/deploy.ps1` or equivalent — invoke `templates:publish:prod` after `db:migrate` but before app-service deploys (so the `templates` table + S3 bundles are in sync with the code being deployed).

- [ ] **Step 1: Read the existing publish flow**

Run:
```bash
grep -n "templates:" package.json
cat packages/templates/scripts/upload-templates.ts | head -80
```

Expected: you'll see `templates:build`, `templates:upload`, `templates:screenshots`, `templates:publish` already wired.

- [ ] **Step 2: Add a prod-targeted alias**

In the root `package.json` `scripts`, after the existing `"deploy:..."` entries, add:

```json
    "templates:publish:prod": "pnpm --filter @viona/templates templates:publish",
```

`upload-templates.ts` already reads `MINIO_*` / `S3_*` from `packages/api/.env`. Ensure that `.env` has the prod public endpoint (`BUCKET_PUBLIC_ENDPOINT` = storage's public domain) when running this against prod; a brief comment block in the new script documents this.

- [ ] **Step 3: Run it once end-to-end against prod and verify**

Run (from a clean shell with prod env loaded):
```bash
pnpm templates:publish:prod
```

Expected: logs show each template bundled, uploaded, and upserted in the `templates` table. On completion, `GET https://api-production-18ab.up.railway.app/api/templates` returns the list and each entry has a `bundleKey`.

- [ ] **Step 4: Commit**

```bash
git add package.json
git commit -m "chore(deploy): add templates:publish:prod alias"
```

---

### Task 8: End-to-end smoke test

**Files:**
- Create: `scripts/temp/test-templates-runtime.ts`

- [ ] **Step 1: Write the test**

Write to `scripts/temp/test-templates-runtime.ts`:

```typescript
/**
 * End-to-end smoke test for the templates runtime registry.
 *
 * Verifies:
 *   1. GET /api/templates lists published templates.
 *   2. GET /api/templates/:slug/bundle 302s to a presigned S3 URL.
 *   3. Fetching the bundle yields JavaScript with a default export.
 *
 * Run (against prod): API_BASE=https://api-production-18ab.up.railway.app \
 *                     tsx scripts/temp/test-templates-runtime.ts
 */

const API_BASE = process.env.API_BASE ?? 'http://localhost:4000';

async function main() {
  console.log('[1/3] Listing templates...');
  const listRes = await fetch(`${API_BASE}/api/templates?limit=3`);
  if (!listRes.ok) throw new Error(`list failed: ${listRes.status}`);
  const list = await listRes.json() as { templates: Array<{ slug: string }> };
  if (!list.templates?.length) throw new Error('No published templates in prod');
  console.log(`  -> ${list.templates.length} templates, first slug = ${list.templates[0].slug}`);

  const slug = list.templates[0].slug;

  console.log(`[2/3] Resolving bundle URL for ${slug}...`);
  const bundleRes = await fetch(`${API_BASE}/api/templates/${encodeURIComponent(slug)}/bundle`, { redirect: 'manual' });
  if (bundleRes.status !== 302) throw new Error(`expected 302, got ${bundleRes.status}`);
  const signed = bundleRes.headers.get('location');
  if (!signed) throw new Error('no Location header on 302');
  console.log(`  -> 302 to ${signed.slice(0, 80)}...`);

  console.log('[3/3] Fetching bundle code...');
  const bodyRes = await fetch(signed);
  if (!bodyRes.ok) throw new Error(`bundle fetch failed: ${bodyRes.status}`);
  const code = await bodyRes.text();
  if (code.length < 1000) throw new Error(`bundle suspiciously short (${code.length} bytes)`);
  if (!/module\.exports|exports\.default/.test(code)) throw new Error('bundle has no default export markers');
  console.log(`  -> OK, ${code.length} bytes, contains default export`);

  console.log('\n✅ Templates runtime registry smoke test passed.');
}

main().catch((err) => { console.error('❌', err); process.exit(1); });
```

- [ ] **Step 2: Run locally first**

Run:
```bash
tsx scripts/temp/test-templates-runtime.ts
```

Expected: 3 OK steps, `✅ Templates runtime registry smoke test passed.`

- [ ] **Step 3: Run against prod**

```bash
API_BASE=https://api-production-18ab.up.railway.app tsx scripts/temp/test-templates-runtime.ts
```

Expected: same success output.

- [ ] **Step 4: Commit**

```bash
git add scripts/temp/test-templates-runtime.ts
git commit -m "test(templates): end-to-end runtime registry smoke test"
```

---

### Task 9: Document the template-authoring workflow

**Files:**
- Create or modify: `packages/templates/README.md`

- [ ] **Step 1: Write the README**

Write to `packages/templates/README.md`:

```markdown
# @viona/templates

Viona's template library. Each template is a standalone Remotion composition
bundled and served from S3 at runtime.

## Architecture

```
┌──────────────────────────┐       ┌──────────────────────┐       ┌─────────────┐
│ src/templates/{slug}/    │──┬──▶ │ scripts/             │──────▶│ S3 bundle    │
│  (TSX source + schema)   │  │    │  build-templates.ts  │       │ + DB row     │
│                          │  │    │  upload-templates.ts │       │              │
└──────────────────────────┘  │    └──────────────────────┘       └──────┬──────┘
                              │                                          │
                              ▼                                          ▼
            builds per-template ESM bundle         api exposes /templates, /templates/:slug/bundle
                                                                         │
                                                                         ▼
                                          runtime-registry client (web, sandbox, worker)
                                            │
                                            ▼
                                   loadTemplate(slug) -> { Component, meta }
```

## Shipping a new template

1. Scaffold `src/templates/my-template/` with:
   - `index.tsx` default-exporting a Remotion component
   - `schema.ts` exporting a Zod schema for props
   - `register.ts` (only read by `build-templates.ts`, not by the runtime)
   - optional `meta.ts`, `defaultProps.ts`, `assets/`
2. Run `pnpm --filter @viona/templates build:registry` locally to update `registry.json` snapshot.
3. Run `pnpm templates:publish:prod` to bundle, upload, and register in the prod DB.
4. The new template is immediately available via `loadTemplate('my-template')` in web/sandbox/worker.

## Using a template at runtime

```typescript
import { loadTemplate } from '@viona/templates';
import * as React from 'react';
import * as RemotionRT from 'remotion';

const { Component, meta } = await loadTemplate('magazine-chart', {
  resolveExternal: (mod) => ({ react: React, remotion: RemotionRT }[mod])!,
});

// <Component {...meta.defaultProps} />
```

## What NOT to do

- **Don't** `import Component from '@viona/templates/templates/my-template'` — that bypasses the registry and drags every transitive template dep into your bundle. Use `loadTemplate(slug)` instead.
- **Don't** add new deps required by a single template to any consumer's `package.json`. They belong only in `packages/templates/package.json` and are bundled into that template's S3 artifact.
```

- [ ] **Step 2: Commit**

```bash
git add packages/templates/README.md
git commit -m "docs(templates): document runtime-registry workflow"
```

---

### Task 10: Manual staging validation

No file changes — this is a human-in-the-loop checklist before merging to main.

- [ ] **Step 1: Deploy web + api to prod**

```bash
pnpm deploy:api
pnpm deploy:web
```

- [ ] **Step 2: Verify a live project that uses a template-backed item still renders**

Open `https://studio.viona.app/` in a browser, open any project whose timeline contains a `template` item. Confirm the Remotion preview shows the template render without errors. Watch network panel: `/api/templates/:slug/bundle` should 302 once per distinct template, then the S3 URL loads the code once and caches.

- [ ] **Step 3: Verify no `react-pdf` in the web bundle**

In the browser DevTools Network panel, confirm that the only JS files served from `studio.viona.app/_next/static/` are Next.js app code — not any bundled template source. Confirm template-specific deps (`react-pdf`, `mapbox-gl`, etc.) only show up inside bundles fetched from `/api/templates/.../bundle`.

- [ ] **Step 4: Confirm the 401 HEAD spam stopped**

Before this plan, the player spammed 401 HEAD requests to the api's `sandbox/bundle/player-composition.cjs.js`. That's a *separate* issue (bundle-readiness poll uses full `API_URL` cross-origin). It is NOT in this plan's scope — if it's still happening after Task 10, open a separate follow-up per the line referenced in `packages/api/src/sandbox/manager.ts:829` and the web-side polling loop at `apps/web/src/features/editor-v2/store/editor-store.ts:900-919`.

---

## Out of Scope (intentional deferrals)

1. **Per-user / brand-kit custom templates.** Today every template row in the `templates` table is global and `isPublished`. The next plan on top of this will add `userId`, `forkOfSlug`, and a `GET /api/users/:id/templates` filter. The runtime registry already accepts `apiBase` so a user-scoped endpoint is a drop-in.
2. **Forking a published template into a user's workspace.** Plan after #1: a `POST /api/templates/:slug/fork` route that copies the row, copies the S3 objects under a new key, and tags it `userId = <caller>`.
3. **Dropping templates into the editor timeline.** The `scene` item type already references `templateId`; once custom templates exist, the editor-v2 asset panel gets a new tab that lists `listTemplates({ scope: 'mine' })` with drag-and-drop onto the timeline. This becomes trivial once this plan lands.
4. **Theme / brand-kit variable substitution at render.** The `themes` + `templateThemes` tables already model the join; a post-refactor plan introduces `loadTemplate(slug, { theme: themeId })` that merges `themes.variables` into `meta.defaultProps` before returning.
5. **Automated CI integration of `templates:publish`.** Task 7 adds the script; wiring it into GitHub Actions / Railway post-deploy is a separate chore.
6. **Deprecating the sync `registerTemplate()` path entirely.** After Task 6 confirms no runtime consumer needs it, a cleanup PR deletes `src/registry.ts` in favor of keeping only the registration side-effect inside `scripts/build-templates.ts`'s own module graph. That deletion is deferred because killing a used export too early risks surprising in-flight work.

---

## Self-Review Notes

- **Spec coverage:**
  - Web no longer pulls template source into its build ✓ (Tasks 3, 5).
  - Each template plus its deps ships from S3 ✓ (existing build+upload scripts kept; Task 7 makes sure they run in deploy).
  - Registry consumers (web, sandbox, worker) ✓ (Tasks 5, 6).
  - Future fork / brand-kit primitives ✓ (runtime-registry accepts `apiBase`, types exported; concrete work is called out as out of scope).
- **Placeholders:** No `TBD`, no `add appropriate error handling`. Every code block is complete enough to paste and run.
- **Type consistency:** `TemplateSummary` used in Tasks 2, 5, 6, 8. `LoadedTemplate.Component` is `React.ComponentType<any>` end to end. `resolveExternal` signature is identical across consumer examples.
- **Known risks:**
  - Task 6's list of consumers is discovered via grep — if a deeply nested consumer is missed, the build will fail at Task 6 Step 3. That's the intended feedback loop.
  - Task 7 assumes `upload-templates.ts` already works against prod MinIO. It does (per existing code reading `BUCKET_PUBLIC_ENDPOINT`), but it's been manually run before, not run in CI — expect one round of env-var gymnastics the first time.
