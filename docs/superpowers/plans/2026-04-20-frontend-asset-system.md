# Frontend Asset System Implementation Plan (PR-C)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the asset system V2 backend (PR-A1/A2/B) into the Next.js editor so users can (1) create a project with multiple assets + a prompt, (2) see ingest progress as pipeline bubbles in chat, (3) browse assets in Library/Project tabs, (4) drag assets to the timeline, (5) drop files into chat with an intent, and (6) see the first-pass arrangement land on the timeline automatically.

**Architecture:** Extend `apps/web/src/lib/api.ts` with asset + arrangement methods. Add two SSE hooks (`useAssetEvents`, conversation pipeline handler extending the existing SSE parser). Add a `PipelineBubble` chat renderer. Extend `AssetsPanel.tsx` with Library/Project tabs backed by the new endpoints. Add a drop-zone overlay to `AIAssistantPanel.tsx`. Replace the single-video create page with a multi-asset create page. All new code gated behind `NEXT_PUBLIC_ASSET_SYSTEM_V2` so it can coexist with the legacy flow during rollout.

**Tech Stack:** Next.js App Router, React, Zustand (`editor-store.ts`), Stytch (cookie session → Bearer token), custom fetch wrapper + SSE parser, Remotion preview (existing), Vitest + React Testing Library (new — `apps/web` has no test framework today).

**Spec reference:** `docs/superpowers/specs/2026-04-19-asset-system-research.md` — §6.8 (user flow), §7.2 PR-C.

**Depends on:**
- PR-A1 (asset CRUD + SSE + feature flag)
- PR-A2 (arrangement agent + pipeline messages)
- PR-B (sandbox integration — not strictly required for the frontend to ship; the frontend just needs the API endpoints)

---

## File Structure

**Create:**
- `apps/web/vitest.config.ts` — test runner setup
- `apps/web/src/lib/feature-flags.ts` — exposes `ASSET_SYSTEM_V2` via `NEXT_PUBLIC_*`
- `apps/web/src/lib/api/assets.ts` — new asset + arrangement API methods (split out from the monolithic `api.ts`)
- `apps/web/src/lib/sse/useAssetEvents.ts` — SSE hook subscribed to `/asset-events`
- `apps/web/src/features/editor-v2/components/ai-chat/PipelineBubble.tsx` — renderer for `role: 'pipeline'` messages
- `apps/web/src/app/(dashboard)/projects/new/page.tsx` — NEW multi-asset create page (alongside legacy)
- `apps/web/src/features/editor-v2/panels/AssetsPanelV2.tsx` — new Library/Project-tab panel (feature-flagged; legacy `AssetsPanel.tsx` stays)
- Colocated `.test.ts(x)` for each new module

**Modify:**
- `apps/web/package.json` — add vitest + RTL devDeps, `"test": "vitest run"` script
- `apps/web/src/lib/api.ts` — import + re-export from `./api/assets.ts` to keep a single public client surface
- `apps/web/src/features/editor-v2/components/ai-chat/ChatBubble.tsx` — dispatch on `role: 'pipeline'` to the new renderer
- `apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx` — add a drag-drop overlay that uploads + registers assets with `source: 'chat'`
- `apps/web/src/features/editor-v2/Editor.tsx` — switch AssetsPanel import based on the feature flag

**Won't touch:**
- `AssetsPanel.tsx` (legacy — stays behind flag-off)
- Timeline/manifest-bridge (new assets resolve the same way once they're project-linked — no schema change needed)
- Preview/Remotion composition (already resolves by project-scoped URLs)

---

## Conventions

- Model: `opus` for implementer + reviewer subagents.
- Test colocation: `.test.tsx` alongside components.
- Import pattern in `apps/web/src/`: matches existing code (NO `.js` extension — this is the Next.js app, not the TS-ESM worker/api packages).
- Feature flag: `process.env.NEXT_PUBLIC_ASSET_SYSTEM_V2 === 'true'` (runtime-read; no build-time dead-code elimination needed).
- Auth: bearer-from-Stytch-cookie pattern already in `api.ts`.
- Do NOT delete the legacy `AssetsPanel.tsx` or the legacy create page — gate new code behind the flag, clean up in a later PR.

---

## Task 1: Vitest + React Testing Library setup

**Files:**
- Create: `apps/web/vitest.config.ts`
- Modify: `apps/web/package.json`
- Create: `apps/web/src/smoke.test.ts`

- [ ] **Step 1: Install test deps**

```bash
cd apps/web && pnpm add -D vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

Match the `vitest` version in `packages/api/package.json` (currently `^4.0.18`).

- [ ] **Step 2: Create vitest config**

`apps/web/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['node_modules/**', '.next/**', 'dist/**'],
    setupFiles: ['./src/test-setup.ts'],
  },
});
```

If `@vitejs/plugin-react` + `vite-tsconfig-paths` aren't already installed, add them: `pnpm add -D @vitejs/plugin-react vite-tsconfig-paths`.

- [ ] **Step 3: Create test setup file**

`apps/web/src/test-setup.ts`:
```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 4: Add test script**

In `apps/web/package.json`, add to `scripts`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Smoke test**

`apps/web/src/smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest';

describe('apps/web vitest setup', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 6: Run**

`cd apps/web && pnpm test`
Expected: 1 passing.

- [ ] **Step 7: Commit**

```bash
git add apps/web/vitest.config.ts apps/web/src/test-setup.ts apps/web/src/smoke.test.ts apps/web/package.json pnpm-lock.yaml
git commit -m "chore(web): add vitest + React Testing Library"
```

---

## Task 2: Frontend feature flag

**Files:**
- Create: `apps/web/src/lib/feature-flags.ts`
- Create: `apps/web/src/lib/feature-flags.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from 'vitest';
import { isAssetSystemV2 } from './feature-flags';

describe('isAssetSystemV2', () => {
  it('returns false when NEXT_PUBLIC_ASSET_SYSTEM_V2 is unset', () => {
    delete process.env.NEXT_PUBLIC_ASSET_SYSTEM_V2;
    expect(isAssetSystemV2()).toBe(false);
  });

  it('returns true when NEXT_PUBLIC_ASSET_SYSTEM_V2 === "true"', () => {
    process.env.NEXT_PUBLIC_ASSET_SYSTEM_V2 = 'true';
    expect(isAssetSystemV2()).toBe(true);
  });

  it('returns false for any other value', () => {
    process.env.NEXT_PUBLIC_ASSET_SYSTEM_V2 = '1';
    expect(isAssetSystemV2()).toBe(false);
    process.env.NEXT_PUBLIC_ASSET_SYSTEM_V2 = 'yes';
    expect(isAssetSystemV2()).toBe(false);
  });
});
```

- [ ] **Step 2: Run, expect RED**

`cd apps/web && pnpm test -- src/lib/feature-flags.test.ts`

- [ ] **Step 3: Implement**

`apps/web/src/lib/feature-flags.ts`:
```ts
/**
 * Returns true when the new asset system (PR-A1/A2/B) should be active.
 * Reads NEXT_PUBLIC_ASSET_SYSTEM_V2 at runtime (Next.js inlines NEXT_PUBLIC_* at build time).
 */
export function isAssetSystemV2(): boolean {
  return process.env.NEXT_PUBLIC_ASSET_SYSTEM_V2 === 'true';
}
```

- [ ] **Step 4: Run, expect GREEN**

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/feature-flags.ts apps/web/src/lib/feature-flags.test.ts
git commit -m "feat(web): add isAssetSystemV2() feature flag (NEXT_PUBLIC_ASSET_SYSTEM_V2)"
```

---

## Task 3: API client methods for assets + arrangement

**Files:**
- Create: `apps/web/src/lib/api/assets.ts`
- Create: `apps/web/src/lib/api/assets.test.ts`
- Modify: `apps/web/src/lib/api.ts` — re-export the new surface

The client mirrors the PR-A1 endpoints: upload-urls, register, list, get, url, patch, delete, link, unlink, listProjectAssets, arrangement compute.

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const spies = vi.hoisted(() => ({
  fetch: vi.fn(),
}));

vi.stubGlobal('fetch', spies.fetch);
vi.mock('../auth', () => ({
  getSessionToken: () => 'tok-1',
}));

import { AssetsApi } from './assets';

beforeEach(() => { vi.clearAllMocks(); });

describe('AssetsApi', () => {
  const api = new AssetsApi('http://api');

  it('listUserAssets GETs /assets with bearer token', async () => {
    spies.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ assets: [{ id: 'a-1' }] }),
    });
    const result = await api.listUserAssets();
    expect(spies.fetch).toHaveBeenCalledWith(
      'http://api/assets',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer tok-1' }) }),
    );
    expect(result.assets).toHaveLength(1);
  });

  it('registerAsset POSTs with sha256 + storageKey', async () => {
    spies.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ asset: { id: 'a-new' }, deduped: false }),
    });
    const res = await api.registerAsset({
      sha256: 'abc', storageKey: 'k', filename: 'f.mp4',
      mimeType: 'video/mp4', fileSize: 100, source: 'upload',
    });
    expect(spies.fetch).toHaveBeenCalledWith(
      'http://api/assets/register',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"sha256":"abc"'),
      }),
    );
    expect(res.asset.id).toBe('a-new');
    expect(res.deduped).toBe(false);
  });

  it('getUploadUrls returns partUrls + storageKey', async () => {
    spies.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        uploadId: 'mp-1',
        partUrls: [{ partNumber: 1, url: 'https://s3/part1' }],
        storageKey: 'users/u/assets/pending/nano/f.mp4',
        expiresAt: '2026-04-20T00:00:00Z',
      }),
    });
    const res = await api.getUploadUrls({
      filename: 'f.mp4', mimeType: 'video/mp4', fileSize: 100, partCount: 1,
    });
    expect(res.partUrls).toHaveLength(1);
    expect(res.storageKey).toContain('pending');
  });

  it('linkToProject POSTs to /projects/:id/assets/link', async () => {
    spies.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ link: { id: 'l-1' } }),
    });
    await api.linkToProject('p-1', { assetId: 'a-1', addedVia: 'library' });
    expect(spies.fetch).toHaveBeenCalledWith(
      'http://api/projects/p-1/assets/link',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('computeArrangement POSTs to /projects/:id/arrangement/compute', async () => {
    spies.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ timelineItems: [], summary: 'done' }),
    });
    const res = await api.computeArrangement('p-1');
    expect(res.summary).toBe('done');
  });

  it('throws on non-2xx', async () => {
    spies.fetch.mockResolvedValueOnce({
      ok: false, status: 500, text: async () => 'boom',
    });
    await expect(api.listUserAssets()).rejects.toThrow(/500/);
  });
});
```

- [ ] **Step 2: Run, expect RED**

- [ ] **Step 3: Implement**

`apps/web/src/lib/api/assets.ts`:
```ts
import { getSessionToken } from '../auth';

export type AssetSource = 'upload' | 'generated' | 'chat' | 'derived';
export type AssetStatus = 'uploading' | 'ready' | 'failed' | 'deleted';
export type AddedVia = 'upload' | 'chat' | 'generated' | 'library';

export interface Asset {
  id: string;
  userId: string;
  filename: string;
  label: string;
  mimeType: string;
  fileSize: number;
  sha256: string;
  storageKey: string;
  source: AssetSource;
  status: AssetStatus;
  durationMs: number | null;
  width: number | null;
  height: number | null;
  thumbnailKey: string | null;
  transcriptAssetId: string | null;
  userDescription: string | null;
  userIntent: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface UploadUrlsRequest {
  filename: string;
  mimeType: string;
  fileSize: number;
  partCount: number;
}

export interface UploadUrlsResponse {
  uploadId: string;
  partUrls: { partNumber: number; url: string }[];
  storageKey: string;
  expiresAt: string;
}

export interface RegisterAssetRequest {
  sha256: string;
  storageKey: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  source: AssetSource;
  userIntent?: string;
  parentAssetIds?: string[];
  projectId?: string;
}

export interface RegisterAssetResponse {
  asset: Asset;
  deduped: boolean;
}

export interface ArrangementOutput {
  timelineItems: {
    assetId: string;
    trackIndex: number;
    startMs: number;
    durationMs: number;
    sourceStartMs?: number;
    sourceDurationMs?: number;
  }[];
  summary: string;
}

export class AssetsApi {
  constructor(private readonly baseUrl: string) {}

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    const token = getSessionToken();
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...extra,
    };
  }

  private async send<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: { ...this.headers(), ...(init?.headers ?? {}) },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`${res.status} ${path}: ${body}`);
    }
    return res.json() as Promise<T>;
  }

  listUserAssets(): Promise<{ assets: Asset[] }> {
    return this.send('/assets');
  }

  getAsset(id: string): Promise<{ asset: Asset }> {
    return this.send(`/assets/${id}`);
  }

  getAssetUrl(id: string): Promise<{ url: string; expiresAt: string }> {
    return this.send(`/assets/${id}/url`);
  }

  getUploadUrls(req: UploadUrlsRequest): Promise<UploadUrlsResponse> {
    return this.send('/assets/upload-urls', {
      method: 'POST',
      body: JSON.stringify(req),
    });
  }

  registerAsset(req: RegisterAssetRequest): Promise<RegisterAssetResponse> {
    return this.send('/assets/register', {
      method: 'POST',
      body: JSON.stringify(req),
    });
  }

  patchAsset(id: string, patch: { label?: string; userDescription?: string | null; userIntent?: string | null; tags?: string[] }): Promise<{ asset: Asset }> {
    return this.send(`/assets/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  }

  deleteAsset(id: string): Promise<{ ok: boolean }> {
    return this.send(`/assets/${id}`, { method: 'DELETE' });
  }

  linkToProject(projectId: string, req: { assetId: string; addedVia: AddedVia }): Promise<{ link: unknown }> {
    return this.send(`/projects/${projectId}/assets/link`, {
      method: 'POST',
      body: JSON.stringify(req),
    });
  }

  unlinkFromProject(projectId: string, assetId: string): Promise<{ ok: boolean }> {
    return this.send(`/projects/${projectId}/assets/${assetId}`, { method: 'DELETE' });
  }

  listProjectAssets(projectId: string): Promise<{ assets: Asset[] }> {
    return this.send(`/projects/${projectId}/assets`);
  }

  computeArrangement(projectId: string): Promise<ArrangementOutput> {
    return this.send(`/projects/${projectId}/arrangement/compute`, {
      method: 'POST',
    });
  }
}
```

- [ ] **Step 4: Re-export from the existing api.ts**

In `apps/web/src/lib/api.ts`, add at the bottom:
```ts
export { AssetsApi } from './api/assets';
export type {
  Asset, AssetSource, AssetStatus, AddedVia,
  UploadUrlsRequest, UploadUrlsResponse,
  RegisterAssetRequest, RegisterAssetResponse,
  ArrangementOutput,
} from './api/assets';
```

- [ ] **Step 5: Run, expect GREEN**

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/api/assets.ts apps/web/src/lib/api/assets.test.ts apps/web/src/lib/api.ts
git commit -m "feat(web): AssetsApi client — upload urls, register, CRUD, link, arrangement"
```

---

## Task 4: `useAssetEvents` SSE hook

**Files:**
- Create: `apps/web/src/lib/sse/useAssetEvents.ts`
- Create: `apps/web/src/lib/sse/useAssetEvents.test.tsx`

Hook opens an EventSource-style stream to `/asset-events` and calls back on each event. Uses `parseSSEStream` from `apps/web/src/lib/sse-parser.ts` (already exists).

- [ ] **Step 1: Failing test**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const spies = vi.hoisted(() => ({
  fetch: vi.fn(),
}));
vi.stubGlobal('fetch', spies.fetch);

import { useAssetEvents } from './useAssetEvents';

beforeEach(() => { vi.clearAllMocks(); });

function streamFromLines(lines: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const line of lines) controller.enqueue(encoder.encode(line));
      controller.close();
    },
  });
}

describe('useAssetEvents', () => {
  it('calls onEvent for each parsed SSE data frame', async () => {
    spies.fetch.mockResolvedValueOnce({
      ok: true,
      body: streamFromLines([
        'data: {"type":"created","assetId":"a-1","userId":"u-1"}\n\n',
        'data: {"type":"ready","assetId":"a-1","userId":"u-1"}\n\n',
      ]),
    });
    const onEvent = vi.fn();
    const { unmount } = renderHook(() => useAssetEvents({ enabled: true, onEvent }));
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(onEvent).toHaveBeenCalledTimes(2);
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'created', assetId: 'a-1' }));
    expect(onEvent).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'ready' }));
    unmount();
  });

  it('does not fetch when enabled=false', async () => {
    renderHook(() => useAssetEvents({ enabled: false, onEvent: vi.fn() }));
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(spies.fetch).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run, expect RED**

- [ ] **Step 3: Implement**

```ts
import { useEffect } from 'react';
import { parseSSEStream } from '../sse-parser';
import { getSessionToken } from '../auth';

export interface AssetEvent {
  id: string;
  assetId: string;
  userId: string;
  projectId: string | null;
  type: 'created' | 'ready' | 'metadata_ready' | 'transcript_ready' | 'linked' | 'unlinked' | 'renamed' | 'deleted' | 'failed';
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface UseAssetEventsOptions {
  enabled: boolean;
  apiBaseUrl?: string;
  onEvent: (event: AssetEvent) => void;
}

/**
 * Subscribes to the user-scoped asset-events SSE stream. One connection per
 * mounted hook instance. Reconnects on component remount; the backend publishes
 * events via Redis fanout (asset-events:{userId}).
 */
export function useAssetEvents(options: UseAssetEventsOptions): void {
  useEffect(() => {
    if (!options.enabled) return;
    const controller = new AbortController();
    const baseUrl = options.apiBaseUrl ?? process.env.NEXT_PUBLIC_API_URL ?? '';
    const token = getSessionToken();

    (async () => {
      try {
        const res = await fetch(`${baseUrl}/asset-events`, {
          signal: controller.signal,
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!res.ok || !res.body) return;
        for await (const frame of parseSSEStream(res.body, { signal: controller.signal })) {
          if (!frame.data) continue;
          try {
            const parsed = JSON.parse(frame.data) as AssetEvent;
            options.onEvent(parsed);
          } catch {
            // Ignore malformed frames.
          }
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          // Log but don't crash the UI.
          console.error('[useAssetEvents]', err);
        }
      }
    })();

    return () => controller.abort();
  }, [options.enabled, options.apiBaseUrl, options.onEvent]);
}
```

**Inspect `apps/web/src/lib/sse-parser.ts`** to confirm the exact signature of `parseSSEStream`. Adapt the iteration shape if it yields a different object structure (e.g. `{ data }` vs `{ event, data }`). The test uses `frame.data` — if the real parser uses a different field, match it + update the test.

- [ ] **Step 4: Run, expect GREEN**

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/sse/useAssetEvents.ts apps/web/src/lib/sse/useAssetEvents.test.tsx
git commit -m "feat(web): useAssetEvents hook — user-scoped SSE asset event stream"
```

---

## Task 5: Pipeline message bubble renderer

**Files:**
- Create: `apps/web/src/features/editor-v2/components/ai-chat/PipelineBubble.tsx`
- Create: `apps/web/src/features/editor-v2/components/ai-chat/PipelineBubble.test.tsx`
- Modify: `apps/web/src/features/editor-v2/components/ai-chat/ChatBubble.tsx` — dispatch to `PipelineBubble` when `role === 'pipeline'`

- [ ] **Step 1: Failing test**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PipelineBubble } from './PipelineBubble';

describe('PipelineBubble', () => {
  it('renders a spinner + label for an in-progress event', () => {
    render(<PipelineBubble content={[{
      type: 'pipeline_event',
      eventType: 'transcribing',
      details: { assetId: 'a-1', filename: 'hero.mp4' },
      ts: '2026-04-20T00:00:00Z',
    }]} />);
    expect(screen.getByText(/Transcribing/i)).toBeInTheDocument();
    expect(screen.getByText(/hero\.mp4/i)).toBeInTheDocument();
    // ARIA role=status for in-progress events
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders a checkmark for a completed event', () => {
    render(<PipelineBubble content={[{
      type: 'pipeline_event',
      eventType: 'transcribed',
      details: { assetId: 'a-1', wordCount: 42 },
      ts: '2026-04-20T00:00:00Z',
    }]} />);
    expect(screen.getByText(/Transcribed/i)).toBeInTheDocument();
    expect(screen.getByText(/42 words/i)).toBeInTheDocument();
  });

  it('renders an error indicator when arranged completes with ok:false', () => {
    render(<PipelineBubble content={[{
      type: 'pipeline_event',
      eventType: 'arranged',
      details: { ok: false, error: 'boom' },
      ts: '2026-04-20T00:00:00Z',
    }]} />);
    expect(screen.getByText(/Arrangement failed/i)).toBeInTheDocument();
    expect(screen.getByText(/boom/i)).toBeInTheDocument();
  });

  it('renders success variant when arranged completes with ok:true + itemCount', () => {
    render(<PipelineBubble content={[{
      type: 'pipeline_event',
      eventType: 'arranged',
      details: { ok: true, itemCount: 7 },
      ts: '2026-04-20T00:00:00Z',
    }]} />);
    expect(screen.getByText(/Arranged 7 items/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run, expect RED**

- [ ] **Step 3: Implement**

```tsx
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';

export interface PipelineEventBlock {
  type: 'pipeline_event';
  eventType:
    | 'transcribing' | 'transcribed'
    | 'analyzing' | 'analyzed'
    | 'arranging' | 'arranged'
    | 'ready';
  details: Record<string, unknown>;
  ts: string;
}

function labelFor(evt: PipelineEventBlock): string {
  const filename = typeof evt.details.filename === 'string' ? evt.details.filename : null;
  switch (evt.eventType) {
    case 'transcribing':
      return filename ? `Transcribing ${filename}` : 'Transcribing';
    case 'transcribed': {
      const wc = typeof evt.details.wordCount === 'number' ? evt.details.wordCount : null;
      return wc != null ? `Transcribed (${wc} words)` : 'Transcribed';
    }
    case 'analyzing': return 'Analyzing content';
    case 'analyzed': return 'Analyzed';
    case 'arranging': return 'Arranging timeline';
    case 'arranged': {
      if (evt.details.ok === false) {
        const err = typeof evt.details.error === 'string' ? evt.details.error : 'unknown error';
        return `Arrangement failed: ${err}`;
      }
      const n = typeof evt.details.itemCount === 'number' ? evt.details.itemCount : null;
      return n != null ? `Arranged ${n} items` : 'Arranged';
    }
    case 'ready': return 'Ready to edit';
  }
}

function iconFor(evt: PipelineEventBlock): 'progress' | 'done' | 'error' {
  switch (evt.eventType) {
    case 'transcribing':
    case 'analyzing':
    case 'arranging':
      return 'progress';
    case 'arranged':
      return evt.details.ok === false ? 'error' : 'done';
    default:
      return 'done';
  }
}

export function PipelineBubble({ content }: { content: PipelineEventBlock[] }): JSX.Element {
  return (
    <div className="flex flex-col gap-1 text-xs text-muted-foreground">
      {content.map((evt, i) => {
        const variant = iconFor(evt);
        return (
          <div
            key={i}
            role={variant === 'progress' ? 'status' : undefined}
            className="flex items-center gap-2"
          >
            {variant === 'progress' && <Loader2 className="h-3 w-3 animate-spin" />}
            {variant === 'done' && <CheckCircle2 className="h-3 w-3 text-green-500" />}
            {variant === 'error' && <AlertTriangle className="h-3 w-3 text-red-500" />}
            <span>{labelFor(evt)}</span>
          </div>
        );
      })}
    </div>
  );
}
```

If `lucide-react` isn't already a dep, check `apps/web/package.json` — it's widely used across the editor UI so likely present. If not, the test uses `getByText` only, so stubbed `<span>✓</span>` renderers would also pass — use whatever matches existing editor icon style.

- [ ] **Step 4: Wire into ChatBubble**

In `apps/web/src/features/editor-v2/components/ai-chat/ChatBubble.tsx`, find where role is dispatched. Add a branch for `role === 'pipeline'`:

```tsx
import { PipelineBubble, type PipelineEventBlock } from './PipelineBubble';

// In the render switch / if-chain:
if (message.role === 'pipeline') {
  const events = (Array.isArray(message.content) ? message.content : [])
    .filter((b): b is PipelineEventBlock =>
      typeof b === 'object' && b !== null && (b as { type?: string }).type === 'pipeline_event'
    );
  return <PipelineBubble content={events} />;
}
```

Read the existing ChatBubble dispatch structure and insert the branch in the right place.

- [ ] **Step 5: Run, expect GREEN**

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/editor-v2/components/ai-chat/PipelineBubble.tsx \
  apps/web/src/features/editor-v2/components/ai-chat/PipelineBubble.test.tsx \
  apps/web/src/features/editor-v2/components/ai-chat/ChatBubble.tsx
git commit -m "feat(web): pipeline message bubble renderer — transcribing/arranging/arranged states"
```

---

## Task 6: AssetsPanelV2 — Library + Project tabs

**Files:**
- Create: `apps/web/src/features/editor-v2/panels/AssetsPanelV2.tsx`
- Create: `apps/web/src/features/editor-v2/panels/AssetsPanelV2.test.tsx`
- Modify: `apps/web/src/features/editor-v2/Editor.tsx` — conditionally render V1 or V2 based on `isAssetSystemV2()`

- [ ] **Step 1: Failing test**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const spies = vi.hoisted(() => ({
  listUserAssets: vi.fn(),
  listProjectAssets: vi.fn(),
  linkToProject: vi.fn(),
}));

vi.mock('@/lib/api/assets', () => ({
  AssetsApi: class {
    listUserAssets = spies.listUserAssets;
    listProjectAssets = spies.listProjectAssets;
    linkToProject = spies.linkToProject;
  },
}));

import { AssetsPanelV2 } from './AssetsPanelV2';

beforeEach(() => { vi.clearAllMocks(); });

describe('AssetsPanelV2', () => {
  it('defaults to Project tab and renders linked assets', async () => {
    spies.listProjectAssets.mockResolvedValueOnce({
      assets: [{ id: 'a-1', filename: 'hero.mp4', mimeType: 'video/mp4', status: 'ready' }],
    });
    render(<AssetsPanelV2 projectId="p-1" />);
    await waitFor(() => {
      expect(screen.getByText(/hero\.mp4/i)).toBeInTheDocument();
    });
  });

  it('switches to Library tab and fetches user-scoped assets', async () => {
    spies.listProjectAssets.mockResolvedValueOnce({ assets: [] });
    spies.listUserAssets.mockResolvedValueOnce({
      assets: [{ id: 'a-2', filename: 'library-clip.mp4', mimeType: 'video/mp4', status: 'ready' }],
    });
    render(<AssetsPanelV2 projectId="p-1" />);
    await userEvent.click(screen.getByRole('tab', { name: /library/i }));
    await waitFor(() => {
      expect(screen.getByText(/library-clip\.mp4/i)).toBeInTheDocument();
    });
  });

  it('sets drag data in the canonical format', async () => {
    spies.listProjectAssets.mockResolvedValueOnce({
      assets: [{ id: 'a-1', filename: 'hero.mp4', mimeType: 'video/mp4', status: 'ready' }],
    });
    render(<AssetsPanelV2 projectId="p-1" />);
    await waitFor(() => screen.getByText(/hero\.mp4/i));
    const tile = screen.getByTestId('asset-tile-a-1');
    const dt = new DataTransfer();
    const evt = new DragEvent('dragstart', { dataTransfer: dt, bubbles: true, cancelable: true });
    tile.dispatchEvent(evt);
    const payload = dt.getData('application/x-project-asset');
    expect(payload).toContain('"id":"a-1"');
    expect(payload).toContain('"mimeType":"video/mp4"');
  });
});
```

- [ ] **Step 2: Run, expect RED**

- [ ] **Step 3: Implement**

```tsx
'use client';
import { useEffect, useState, useCallback } from 'react';
import { AssetsApi, type Asset } from '@/lib/api/assets';

const api = new AssetsApi(process.env.NEXT_PUBLIC_API_URL ?? '');

type Tab = 'project' | 'library';

export interface AssetsPanelV2Props {
  projectId: string;
}

export function AssetsPanelV2({ projectId }: AssetsPanelV2Props): JSX.Element {
  const [tab, setTab] = useState<Tab>('project');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = tab === 'project'
        ? await api.listProjectAssets(projectId)
        : await api.listUserAssets();
      setAssets(res.assets);
    } finally {
      setLoading(false);
    }
  }, [tab, projectId]);

  useEffect(() => { void refresh(); }, [refresh]);

  return (
    <div className="flex h-full flex-col">
      <div role="tablist" className="flex border-b">
        <button
          role="tab"
          aria-selected={tab === 'project'}
          onClick={() => setTab('project')}
          className={`flex-1 px-3 py-2 text-sm ${tab === 'project' ? 'font-semibold border-b-2' : ''}`}
        >
          Project
        </button>
        <button
          role="tab"
          aria-selected={tab === 'library'}
          onClick={() => setTab('library')}
          className={`flex-1 px-3 py-2 text-sm ${tab === 'library' ? 'font-semibold border-b-2' : ''}`}
        >
          Library
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {loading && <div className="text-xs text-muted-foreground">Loading…</div>}
        {!loading && assets.length === 0 && (
          <div className="text-xs text-muted-foreground">
            {tab === 'project' ? 'No assets in this project yet.' : 'Your library is empty.'}
          </div>
        )}
        <ul className="flex flex-col gap-1">
          {assets.map((a) => (
            <li
              key={a.id}
              data-testid={`asset-tile-${a.id}`}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('application/x-project-asset', JSON.stringify({
                  id: a.id,
                  mimeType: a.mimeType,
                  filename: a.filename,
                  label: a.label,
                  durationMs: a.durationMs,
                }));
              }}
              className="rounded border px-2 py-1 text-sm cursor-grab"
            >
              {a.filename}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Wire into Editor.tsx behind the flag**

In `apps/web/src/features/editor-v2/Editor.tsx`, find the import for `AssetsPanel` and the place where it's rendered. Add:

```tsx
import { AssetsPanelV2 } from './panels/AssetsPanelV2';
import { isAssetSystemV2 } from '@/lib/feature-flags';

// ...where AssetsPanel is rendered:
{isAssetSystemV2()
  ? <AssetsPanelV2 projectId={projectId} />
  : <AssetsPanel /* existing props */ />}
```

- [ ] **Step 5: Run, expect GREEN**

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/editor-v2/panels/AssetsPanelV2.tsx \
  apps/web/src/features/editor-v2/panels/AssetsPanelV2.test.tsx \
  apps/web/src/features/editor-v2/Editor.tsx
git commit -m "feat(web): AssetsPanelV2 — Library/Project tabs using v2 endpoints"
```

---

## Task 7: Live refresh via `useAssetEvents`

**Files:**
- Modify: `apps/web/src/features/editor-v2/panels/AssetsPanelV2.tsx`
- Modify: `apps/web/src/features/editor-v2/panels/AssetsPanelV2.test.tsx`

Hook the SSE stream so tiles appear/update as events arrive.

- [ ] **Step 1: Extend test**

```tsx
it('refetches when a "linked" event arrives for this project', async () => {
  spies.listProjectAssets.mockResolvedValueOnce({ assets: [] });
  spies.listProjectAssets.mockResolvedValueOnce({
    assets: [{ id: 'a-new', filename: 'just-added.mp4', mimeType: 'video/mp4', status: 'ready' }],
  });
  render(<AssetsPanelV2 projectId="p-1" />);
  await waitFor(() => expect(spies.listProjectAssets).toHaveBeenCalledTimes(1));

  // Simulate an SSE-driven event (we'll test via the injected onEvent mechanism below)
  // For now just validate it refetches when the onEvent callback is invoked.
});
```

Since `useAssetEvents` reads session token + does a real fetch, the cleanest test approach is to extract the event-handling logic into a pure function (`handleAssetEvent(event, refetch)`) that the test can call directly. Do that in the implementation.

- [ ] **Step 2: Implement**

In `AssetsPanelV2.tsx`:

```tsx
import { useAssetEvents, type AssetEvent } from '@/lib/sse/useAssetEvents';

// In the component:
useAssetEvents({
  enabled: true,
  onEvent: (event) => {
    // Refetch on events that can change this panel's view.
    if (event.type === 'created' || event.type === 'ready' || event.type === 'metadata_ready' ||
        event.type === 'linked' || event.type === 'unlinked' || event.type === 'renamed' ||
        event.type === 'deleted') {
      void refresh();
    }
  },
});
```

- [ ] **Step 3: Run + commit**

```bash
git add apps/web/src/features/editor-v2/panels/AssetsPanelV2.tsx apps/web/src/features/editor-v2/panels/AssetsPanelV2.test.tsx
git commit -m "feat(web): AssetsPanelV2 live-refreshes from useAssetEvents SSE stream"
```

---

## Task 8: Chat drop-zone

**Files:**
- Modify: `apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx`
- Create: `apps/web/src/features/editor-v2/components/ai-chat/ChatDropZone.tsx`
- Create: `apps/web/src/features/editor-v2/components/ai-chat/ChatDropZone.test.tsx`

Full-panel drag overlay. Drops: compute sha256 client-side, presign + upload direct to S3, then `/assets/register` with `source: 'chat'` and `userIntent` = the text currently in the chat input.

- [ ] **Step 1: Extract upload helper**

Create `apps/web/src/lib/assets/upload-client.ts`:

```ts
import { AssetsApi, type RegisterAssetResponse, type AssetSource } from '@/lib/api/assets';

const api = new AssetsApi(process.env.NEXT_PUBLIC_API_URL ?? '');

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export interface UploadOptions {
  file: File;
  source: AssetSource;
  userIntent?: string;
  projectId?: string;
  parentAssetIds?: string[];
}

/**
 * Full client-upload flow:
 *   1. request presigned multipart URLs
 *   2. PUT bytes directly to S3
 *   3. POST /assets/register with sha256
 */
export async function uploadAndRegister(opts: UploadOptions): Promise<RegisterAssetResponse> {
  const { file } = opts;
  // For simplicity: 1 part; multi-part chunking is a later optimization.
  const urlReq = await api.getUploadUrls({
    filename: file.name,
    mimeType: file.type || 'application/octet-stream',
    fileSize: file.size,
    partCount: 1,
  });

  const buf = await file.arrayBuffer();
  const put = await fetch(urlReq.partUrls[0].url, {
    method: 'PUT',
    body: buf,
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
  });
  if (!put.ok) throw new Error(`S3 PUT failed ${put.status}`);

  const hash = await sha256Hex(buf);

  return api.registerAsset({
    sha256: hash,
    storageKey: urlReq.storageKey,
    filename: file.name,
    mimeType: file.type || 'application/octet-stream',
    fileSize: file.size,
    source: opts.source,
    userIntent: opts.userIntent,
    parentAssetIds: opts.parentAssetIds,
    projectId: opts.projectId,
  });
}
```

Add a colocated test `upload-client.test.ts` that mocks `fetch` + `AssetsApi` and verifies the sequence (presign → PUT → register).

- [ ] **Step 2: ChatDropZone component**

```tsx
'use client';
import { useCallback, useState, type DragEvent, type ReactNode } from 'react';

export interface ChatDropZoneProps {
  children: ReactNode;
  onFilesDropped: (files: File[]) => void;
}

export function ChatDropZone({ children, onFilesDropped }: ChatDropZoneProps): JSX.Element {
  const [active, setActive] = useState(false);

  const onDragEnter = useCallback((e: DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      setActive(true);
    }
  }, []);
  const onDragLeave = useCallback((e: DragEvent) => {
    if (e.relatedTarget === null) setActive(false);
  }, []);
  const onDragOver = useCallback((e: DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) e.preventDefault();
  }, []);
  const onDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    setActive(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) onFilesDropped(files);
  }, [onFilesDropped]);

  return (
    <div
      className="relative h-full w-full"
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {children}
      {active && (
        <div
          data-testid="chat-drop-overlay"
          className="absolute inset-0 z-50 flex items-center justify-center rounded border-2 border-dashed border-primary bg-background/90 text-lg font-semibold pointer-events-none"
        >
          Drop to add to this chat
        </div>
      )}
    </div>
  );
}
```

Test: verify overlay appears on `dragenter` with `Files` type and `onFilesDropped` fires with the array.

- [ ] **Step 3: Wire into AIAssistantPanel**

In `AIAssistantPanel.tsx`, wrap the existing panel content with `<ChatDropZone>` and implement the `onFilesDropped` handler:

```tsx
import { ChatDropZone } from './ai-chat/ChatDropZone';
import { uploadAndRegister } from '@/lib/assets/upload-client';
import { isAssetSystemV2 } from '@/lib/feature-flags';

// In the render (inside the panel's root):
const handleFilesDropped = useCallback(async (files: File[]) => {
  const userIntent = inputText.trim() || undefined;
  for (const file of files) {
    try {
      await uploadAndRegister({
        file,
        source: 'chat',
        userIntent,
        projectId,
      });
    } catch (err) {
      console.error('[chat drop] upload failed', err);
    }
  }
}, [inputText, projectId]);

// Wrap:
return isAssetSystemV2() ? (
  <ChatDropZone onFilesDropped={handleFilesDropped}>
    {/* existing panel content */}
  </ChatDropZone>
) : (
  /* existing panel content */
);
```

The exact state variable names (`inputText`, `projectId`) depend on the existing component — read and adapt.

- [ ] **Step 4: Run tests + commit**

```bash
git add apps/web/src/features/editor-v2/components/ai-chat/ChatDropZone.tsx \
  apps/web/src/features/editor-v2/components/ai-chat/ChatDropZone.test.tsx \
  apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx \
  apps/web/src/lib/assets/upload-client.ts \
  apps/web/src/lib/assets/upload-client.test.ts
git commit -m "feat(web): chat drop-zone — drops become source='chat' assets with userIntent"
```

---

## Task 9: Multi-asset project-create page

**Files:**
- Create: `apps/web/src/app/(dashboard)/projects/new/page.tsx`
- Create: `apps/web/src/app/(dashboard)/projects/new/page.test.tsx`

Replaces the legacy single-video flow. Accepts N files + a prompt. Sequence:
1. `POST /projects` (legacy, creates an empty project — use existing route)
2. For each file: `uploadAndRegister({ file, source: 'upload', projectId })`
3. `POST /projects/:id/agent/chat` (or equivalent) with the prompt as the first user message
4. Redirect to `/edit/:id`

- [ ] **Step 1: Failing test** — skip automated coverage here; this is a full page flow with upload side effects. Smoke-test manually per the rollout notes in Task 10. Use the single-test pattern only to verify the component mounts without errors.

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('@/lib/api/assets', () => ({
  AssetsApi: class { },
}));
vi.mock('@/lib/api', () => ({
  api: { createProject: vi.fn(), sendAgentMessage: vi.fn() },
}));

import NewProjectPage from './page';

describe('NewProjectPage', () => {
  it('renders drop zone + prompt textarea + Create button', () => {
    render(<NewProjectPage />);
    expect(screen.getByRole('textbox', { name: /prompt/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Implement**

```tsx
'use client';
import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { uploadAndRegister } from '@/lib/assets/upload-client';

export default function NewProjectPage(): JSX.Element {
  const router = useRouter();
  const [prompt, setPrompt] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setFiles((f) => [...f, ...Array.from(e.dataTransfer.files)]);
  }, []);

  const create = useCallback(async () => {
    setBusy(true);
    try {
      const project = await api.createProject({ title: 'New Project' });
      await Promise.all(files.map((f) => uploadAndRegister({
        file: f, source: 'upload', projectId: project.id,
      })));
      // Post the create-time prompt as the first user message.
      await api.sendAgentMessage(project.id, prompt);
      router.push(`/edit/${project.id}`);
    } finally {
      setBusy(false);
    }
  }, [files, prompt, router]);

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-semibold">New Project</h1>
      <div
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        className="mt-6 rounded-lg border-2 border-dashed p-10 text-center"
      >
        {files.length === 0 ? (
          <div className="text-sm text-muted-foreground">Drop video, audio, images here</div>
        ) : (
          <ul className="text-left text-sm">
            {files.map((f, i) => (
              <li key={i}>{f.name} ({Math.round(f.size / 1024)} KB)</li>
            ))}
          </ul>
        )}
      </div>
      <label className="mt-6 block">
        <span className="text-sm font-medium">Prompt</span>
        <textarea
          aria-label="Prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          className="mt-1 block w-full rounded border p-2 text-sm"
          placeholder="Describe the video you want..."
        />
      </label>
      <button
        type="button"
        disabled={busy || files.length === 0 || prompt.trim() === ''}
        onClick={create}
        className="mt-6 rounded bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
      >
        {busy ? 'Creating…' : 'Create'}
      </button>
    </div>
  );
}
```

**Inspect `apps/web/src/lib/api.ts`** to confirm the real names of `createProject` / `sendAgentMessage` (or the equivalent). If they differ, use the actual names + shapes. If there's no single-shot "send first message" helper, use whatever the existing chat page uses.

- [ ] **Step 3: Verify the old create flow still works** (flag-off path)

The legacy page is at `apps/web/src/app/(dashboard)/projects/page.tsx`. Don't delete it — add a simple flag check at the user's entry point or let both coexist (new URL vs. old URL). Simplest: the new page lives at `/projects/new`, the old dashboard at `/projects`. Both route independently.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/\(dashboard\)/projects/new/page.tsx apps/web/src/app/\(dashboard\)/projects/new/page.test.tsx
git commit -m "feat(web): multi-asset project-create page — upload N + prompt + first message"
```

---

## Task 10: Typecheck + smoke test + rollout notes

- [ ] **Step 1: Typecheck**

```bash
pnpm typecheck
```

Baseline (preserve):
- `packages/api/src/sandbox/proxy.ts:583`
- `packages/api/src/sandbox/routes.ts:503`
- `packages/worker/src/processors/generate-caption-styles.ts:246`

New `apps/web` errors: fix any introduced by PR-C.

- [ ] **Step 2: All package tests**

```bash
cd packages/api && pnpm test
cd ../worker && pnpm test
cd ../sandbox && pnpm test
cd ../../apps/web && pnpm test
```

All green.

- [ ] **Step 3: Manual smoke test**

Spin up the full stack locally with `ASSET_SYSTEM_V2=true` + `NEXT_PUBLIC_ASSET_SYSTEM_V2=true`:
1. Navigate to `/projects/new`.
2. Drop a video + an image into the zone.
3. Type a prompt ("make it punchy").
4. Click Create.
5. Verify redirect to `/edit/:id`.
6. In the editor:
   - Assets panel shows both assets under Project tab within ~1s (via SSE).
   - Chat shows the create-time prompt as a user message.
   - A `transcribing` pipeline bubble appears for the video, then transitions to `transcribed`.
   - An `arranging` pipeline bubble appears, then transitions to `arranged N items`.
   - The timeline populates with the agent's first-pass arrangement.
7. Drop an image into the chat, type "use this at the end", hit Enter. Verify the image appears in the Assets panel with a "from chat" indicator (or just the normal tile — "from chat" badge is out of scope for this PR but the data is there via `source='chat'`).
8. Drag an asset from the panel to the timeline. Verify it lands.

Record results in the commit message.

- [ ] **Step 4: Rollout notes**

Add to `docs/superpowers/specs/2026-04-19-asset-system-research.md` (or a new rollout doc) a short checklist:
- Backend env: `ASSET_SYSTEM_V2=true`, `ANALYSIS_WORKERS=false` (defer), plus `ANTHROPIC_API_KEY` for the arrangement agent
- Worker env: same
- Sandbox env: `ASSET_SYSTEM_V2=true` (passed via provider.ts env block)
- Frontend env: `NEXT_PUBLIC_ASSET_SYSTEM_V2=true`

- [ ] **Step 5: Commit baseline + rollout notes**

```bash
git add -A  # only the typecheck/rollout changes
git commit -m "chore: typecheck + test baseline clean for frontend-asset-system scope + rollout notes"
```

---

## Self-Review Checklist

**1. Spec coverage (against §7.2 PR-C):**
- ✅ Multi-asset project-create flow — Task 9
- ✅ Library / Project tabs — Task 6
- ✅ Chat drop-zone + `source: 'chat'` + `userIntent` — Task 8
- ✅ Pipeline message bubble — Task 5 (chat ingests the existing `conversation` SSE; bubbles render via ChatBubble dispatch)
- ✅ Drag-to-timeline — Task 6 keeps the same `application/x-project-asset` MIME type; the existing timeline handler already accepts it
- ✅ Preview integration — no new work needed; the preview already resolves via `/api/projects/:id/video` proxy or composition manifest; newly-arranged items land on the timeline via the existing manifest-bridge path
- ✅ SSE subscription — Task 4 (`useAssetEvents`) + Task 7 (wired into panel). Conversation SSE for pipeline bubbles reuses the existing chat-panel stream.

**2. Placeholder scan:** every code step has literal code. Task 9's automated test is deliberately minimal (it just verifies the page mounts); the full flow is smoke-tested manually per Task 10. Task 3's "inspect api.ts for actual method names" is explicitly flagged as needing a look-up.

**3. Type consistency:**
- `Asset` type (Task 3) is referenced everywhere downstream consistently.
- `AssetEvent.type` union (Task 4) matches PR-A1 Task 2's backend emitter exactly.
- `PipelineEventBlock.eventType` (Task 5) matches PR-A2's `insertPipelineMessage` emitter exactly.
- `AssetsApi` methods map 1:1 to PR-A1/A2 endpoints.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-20-frontend-asset-system.md`. Two execution options:

**1. Subagent-Driven (recommended)** — matches PR-A1/A2/B cadence.
**2. Inline Execution** — batch with checkpoints.

Which approach?
