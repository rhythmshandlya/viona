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
