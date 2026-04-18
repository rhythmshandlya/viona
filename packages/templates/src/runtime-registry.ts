import type React from 'react';

/**
 * Runtime registry client. Replaces the build-time static registry in
 * src/registry.ts for every consumer outside scripts/build-templates.ts.
 *
 * - `listTemplates()` -> GET {apiBase}/templates  (api shape: { items, pagination, themeContext? })
 * - `loadTemplate(slug)` -> GET {apiBase}/templates/:slug plus a one-time bundle eval
 * - Bundles load from the api's presigned `bundleUrl` when the detail endpoint returns one,
 *   else fall back to the proxy route `{apiBase}/templates/:slug/bundle` (Task 1 route).
 *
 * `resolveExternal` MUST handle at minimum these modules (see packages/templates/tsup.config.ts
 * + scripts/build-templates.ts externals):
 *   - 'react', 'react-dom', 'remotion', '@remotion/google-fonts', 'react-globe.gl'
 * Templates that add new externals (e.g. 'mapbox-gl' for a globe template) must have
 * those injected by the caller; unknown requests throw with the slug in the message.
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
  /** Either a presigned S3 URL (from api detail) or the api proxy path. */
  bundleUrl: string;
}

export interface LoadedTemplate {
  meta: TemplateSummary;
  Component: React.ComponentType<any>;
}

interface RuntimeRegistryOptions {
  /** Base URL for the api; defaults to same-origin '/api'. Required for Node consumers. */
  apiBase?: string;
  /** Inject a module resolver for externals requested by the template bundle. */
  resolveExternal?: (mod: string) => unknown;
}

// ── Cache ───────────────────────────────────────────────────────────────────
// Module-level singleton cache. Scope per tab / process. Callers that need
// isolation across hot-reload or test boundaries should call
// `clearTemplateRuntimeCache()`. Keyed by `${apiBase}::${slug}` so different
// base URLs don't collide in multi-tenant setups.
const summaryCache = new Map<string, TemplateSummary>();
const componentCache = new Map<string, React.ComponentType<any>>();

function cacheKey(apiBase: string, slug: string) {
  return `${apiBase}::${slug}`;
}

function base(opts?: RuntimeRegistryOptions) {
  return opts?.apiBase ?? '/api';
}

async function readErrorSnippet(res: Response): Promise<string> {
  const body = await res.text().catch(() => '');
  return body.slice(0, 200);
}

export async function listTemplates(
  opts?: RuntimeRegistryOptions & { category?: string; aspectRatio?: string; limit?: number }
): Promise<TemplateSummary[]> {
  const params = new URLSearchParams();
  if (opts?.category) params.set('category', opts.category);
  if (opts?.aspectRatio) params.set('aspectRatio', opts.aspectRatio);
  if (opts?.limit) params.set('limit', String(opts.limit));

  const apiBase = base(opts);
  const url = `${apiBase}/templates?${params}`;
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) {
    throw new Error(`listTemplates failed: ${res.status} at ${url} — ${await readErrorSnippet(res)}`);
  }

  // api shape: { items, pagination, themeContext? }
  const body = await res.json() as { items?: Array<Record<string, any>> };
  if (!Array.isArray(body.items)) {
    throw new Error(`listTemplates: unexpected response shape at ${url}`);
  }
  const out: TemplateSummary[] = body.items.map((row) => rowToSummary(row, apiBase));
  for (const s of out) summaryCache.set(cacheKey(apiBase, s.slug), s);
  return out;
}

export async function getTemplateSummary(slug: string, opts?: RuntimeRegistryOptions): Promise<TemplateSummary> {
  const apiBase = base(opts);
  const key = cacheKey(apiBase, slug);
  const cached = summaryCache.get(key);
  if (cached) return cached;

  const url = `${apiBase}/templates/${encodeURIComponent(slug)}`;
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) {
    throw new Error(`getTemplateSummary(${slug}) failed: ${res.status} at ${url} — ${await readErrorSnippet(res)}`);
  }
  const row = await res.json() as Record<string, any>;
  const summary = rowToSummary(row, apiBase);
  summaryCache.set(key, summary);
  return summary;
}

export async function loadTemplate(slug: string, opts?: RuntimeRegistryOptions): Promise<LoadedTemplate> {
  const apiBase = base(opts);
  const meta = await getTemplateSummary(slug, opts);

  const key = cacheKey(apiBase, slug);
  const cached = componentCache.get(key);
  if (cached) return { meta, Component: cached };

  let bundleRes = await fetch(meta.bundleUrl, { credentials: 'include' });
  // One retry on 401 — Stytch JWT refresh race (same pattern as the workspace composition loader).
  if (bundleRes.status === 401) {
    await new Promise(r => setTimeout(r, 2000));
    bundleRes = await fetch(meta.bundleUrl, { credentials: 'include' });
  }
  if (!bundleRes.ok) {
    throw new Error(`fetch bundle ${meta.bundleUrl} -> ${bundleRes.status}: ${await readErrorSnippet(bundleRes)}`);
  }

  const contentType = bundleRes.headers.get('content-type') ?? '';
  const rawCode = await bundleRes.text();
  const looksLikeJs =
    /javascript|text\/plain/i.test(contentType) ||
    /module\.exports|exports\.default|export\s*\{|export\s+default/.test(rawCode);
  if (!looksLikeJs) {
    throw new Error(
      `Template bundle for "${slug}" response is not JavaScript (content-type="${contentType}", first 80 bytes: ${rawCode.slice(0, 80)})`
    );
  }

  // Bundles are built as ESM (`format: 'esm'` in scripts/build-templates.ts) with
  // externals resolved via globals (window.React, window.Remotion). We eval them
  // inside a CJS wrapper (`new Function('module', ...)`) which doesn't accept ESM
  // `export` syntax — rewrite ESM exports to CJS `module.exports.*` assignments.
  const code = rewriteEsmExportsToCjs(rawCode);

  // Mini CJS eval — bundles externalize react/react-dom/remotion/@remotion/google-fonts/react-globe.gl.
  const requireFn = (mod: string) => {
    if (opts?.resolveExternal) {
      try {
        return opts.resolveExternal(mod);
      } catch (err) {
        throw new Error(`Template bundle "${slug}" required "${mod}" and resolveExternal threw: ${String(err)}`);
      }
    }
    throw new Error(`Template bundle for "${slug}" needs "${mod}" but no resolveExternal was provided`);
  };

  const moduleObj: { exports: Record<string, unknown> } = { exports: {} };
  try {
    const fn = new Function('module', 'exports', 'require', code);
    fn(moduleObj, moduleObj.exports, requireFn);
  } catch (err) {
    throw new Error(`Template bundle for "${slug}" failed to evaluate: ${String(err)}`);
  }

  const Component = (moduleObj.exports as any).default as React.ComponentType<any> | undefined;
  if (!Component || (typeof Component !== 'function' && typeof Component !== 'object')) {
    throw new Error(`Template bundle for "${slug}" did not export a valid default component`);
  }

  componentCache.set(key, Component);
  return { meta, Component };
}

export function clearTemplateRuntimeCache() {
  summaryCache.clear();
  componentCache.clear();
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Rewrite ESM export syntax at the tail of an esbuild `format: 'esm'` bundle
 * into equivalent CJS `module.exports.*` assignments so `new Function(...)`
 * can evaluate the code. The bundle's externals are already resolved via
 * `window.*` globals (see scripts/esbuild-globals-plugin.ts), so no `import`
 * statements remain — only a trailing `export { X as default }` (or similar).
 */
function rewriteEsmExportsToCjs(code: string): string {
  let out = code;

  // `export default X;` / `export default function ...` — rare with esbuild bundle,
  // but cheap to handle defensively.
  out = out.replace(/\bexport\s+default\s+/g, 'module.exports.default=');

  // `export { a, b as c, d };` → multiple `module.exports.X = Y;` lines.
  out = out.replace(/\bexport\s*\{\s*([^}]+)\s*\}\s*;?/g, (_match, body: string) => {
    return body
      .split(',')
      .map((raw) => {
        const trimmed = raw.trim();
        if (!trimmed) return '';
        const asMatch = trimmed.match(/^(\w+)\s+as\s+(\w+)$/);
        if (asMatch) return `module.exports.${asMatch[2]}=${asMatch[1]};`;
        return `module.exports.${trimmed}=${trimmed};`;
      })
      .join('');
  });

  return out;
}

function rowToSummary(row: Record<string, any>, apiBase: string): TemplateSummary {
  const slug = row.slug;
  // Prefer the api's presigned bundleUrl when present (detail endpoint provides it
  // with a 1h TTL); otherwise fall back to the api proxy route that 302s to a fresh
  // presigned URL on each hit.
  const bundleUrl =
    typeof row.bundleUrl === 'string' && row.bundleUrl.length > 0
      ? row.bundleUrl
      : `${apiBase}/templates/${encodeURIComponent(slug)}/bundle`;

  return {
    slug,
    name: row.name,
    description: row.description ?? null,
    category: row.category,
    tags: Array.isArray(row.tags) ? row.tags : [],
    aspectRatio: row.aspectRatio ?? '16:9',
    durationFrames: row.durationFrames ?? 360,
    fps: row.fps ?? 30,
    width: row.width ?? 1920,
    height: row.height ?? 1080,
    screenshotUrl: row.screenshotUrl ?? null,
    defaultProps: row.defaultProps ?? {},
    propsSchema: row.propsSchema ?? null,
    bundleUrl,
  };
}
