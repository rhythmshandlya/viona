# Frontend End-to-End Integration Plan (PR-C2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the architectural mismatch surfaced by the frontend end-to-end audit: the PR-A2 arrangement persister writes to Postgres `tracks`/`timelineItems` but the editor loads timeline state from the sandbox's `manifest.json`. Wire the bridge, resolve `assetId → URL` on the frontend, fix production S3 CORS, and link the new create page from navigation — so flipping `ASSET_SYSTEM_V2=true` produces an actually-working user flow.

**Architecture:** Backend gains a `GET /api/projects/:id/composition-v2` endpoint that returns tracks + timelineItems + per-asset presigned URLs in one shot. Arrangement worker emits a project-scoped SSE event (`composition_updated`) that triggers frontend refetch. Frontend's `manifest-bridge` is taught to resolve `assetId` via a lookup table the endpoint provides. Timeline drop handler detects V2 payloads (no `url`) and fetches the URL on drop. CORS config widened to include `PUT`.

**Tech Stack:** Next.js App Router, Fastify, Redis pub/sub, Drizzle, MinIO, Vitest.

**Spec reference:** `docs/superpowers/specs/2026-04-19-asset-system-research.md` §6.8; **audit findings from 2026-04-20 frontend integration audit** — 5 broken scenarios out of 9.

**Depends on:** PR-A1, PR-A2, PR-B, PR-C + 9 audit fixes (all landed on `dev`). This is PR-C2 — the integration layer that PR-C skipped.

---

## Scope notes

**High-priority fixes** (tasks 1–6): required before flag flip is user-usable.
**Medium-priority polish** (tasks 7–8): render quality + stream-out-of-turn pipeline bubbles.

**Out of scope:**
- Chat-drop auto-hint to agent
- `MessageBlock` union type-widening (currently cast — low priority)
- Cleanup debt (worker mirrors, legacy paths)

---

## File Structure

**Create:**
- `packages/api/src/routes/composition.ts` — new `GET /api/projects/:id/composition-v2` endpoint
- `packages/api/src/services/composition-loader.ts` — merges `tracks` + `timelineItems` + asset resolution into one response shape
- `apps/web/src/lib/api/composition.ts` — client for the new endpoint
- `apps/web/src/lib/sse/useCompositionEvents.ts` — SSE hook for `composition_updated` events
- colocated `.test.ts(x)` for each

**Modify:**
- `packages/api/src/services/pipeline-messages.ts` — on `arranged` emit, also publish `composition_updated` envelope
- `packages/api/src/agent/agent-router.ts` — relay `composition_updated` SSE alongside `pipeline_message`
- `packages/api/src/index.ts` — register new composition route under `/api` prefix, gated by `ASSET_SYSTEM_V2`
- `packages/worker/src/services/pipeline-messages.ts` — mirror: emit `composition_updated` envelope
- `apps/web/src/features/editor-v2/store/manifest-bridge.ts` — resolve `d.assetId` via the new composition endpoint's asset map
- `apps/web/src/features/editor-v2/store/editor-store.ts` — new load path that pulls composition-v2 when flag on; `reloadComposition()` action
- `apps/web/src/features/editor-v2/panels/AssetsPanelV2.tsx` — render thumbnails + duration via `getAssetUrl` / `thumbnailKey`
- `apps/web/src/features/editor-v2/timeline/timeline-canvas.tsx` (path per audit) — drop handler detects V2 payload (no `url`), fetches URL
- `apps/web/src/features/editor-v2/Editor.tsx` — on mount, subscribe to `useCompositionEvents`
- `apps/web/src/app/(dashboard)/projects/page.tsx` — gate the existing "Create project" CTA on `isAssetSystemV2()`; route to `/projects/new` when on
- `scripts/configure-minio-cors.sh` — add `PUT` + `POST` to `AllowedMethods`, widen `AllowedHeaders`

**Won't touch:**
- Arrangement persister (already writes correctly; it's the frontend that wasn't reading)
- Legacy `AssetsPanel.tsx`, legacy `/projects` dashboard flow, legacy `/project/:id` route

---

## Conventions

- Model for implementer subagents: `opus` per user preference.
- `.js` extensions on relative TS imports in `packages/*`; NO `.js` on relative imports in `apps/web`.
- Feature flag gates: backend `config.featureFlags.assetSystemV2`; frontend `isAssetSystemV2()`.
- Auth: Stytch bearer from cookie — existing pattern.
- Tests: colocate `.test.ts(x)` next to source. Use `vi.hoisted()` for spies where factory hoisting matters.

---

## Task 1: MinIO CORS — allow PUT + POST

**Files:**
- Modify: `scripts/configure-minio-cors.sh`

Closes audit finding: browser PUTs fail CORS preflight in production.

- [ ] **Step 1: Inspect current config**

Read `scripts/configure-minio-cors.sh` in full. The hardcoded `AllowedMethods` is currently `["GET", "HEAD"]`.

- [ ] **Step 2: Widen methods + headers**

Change the `AllowedMethods` array to `["GET", "HEAD", "PUT", "POST"]`.

Change `AllowedHeaders` (if restrictive) to `["*"]` OR at minimum `["Content-Type", "Content-Length", "x-amz-*", "Authorization"]`.

Leave `AllowedOrigins` unchanged (it should match the deployed frontend origin).

- [ ] **Step 3: Manual verification**

Cannot be automated via unit test. Document a verification command in the commit message:

```bash
curl -X OPTIONS \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: PUT" \
  http://localhost:9000/viona/users/u/assets/pending/test.mp4 \
  -v 2>&1 | grep -i access-control
```

Expected: `Access-Control-Allow-Methods: ..., PUT, ...`.

- [ ] **Step 4: Commit**

```bash
git add scripts/configure-minio-cors.sh
git commit -m "fix(infra): MinIO CORS allows PUT + POST for direct-to-S3 browser uploads"
```

---

## Task 2: Dashboard links to `/projects/new`

**Files:**
- Modify: `apps/web/src/app/(dashboard)/projects/page.tsx`

Closes audit finding 1: users can't reach `/projects/new` without typing the URL.

- [ ] **Step 1: Inspect the existing dashboard**

Read `apps/web/src/app/(dashboard)/projects/page.tsx` to find the current "Create project" button / chat-send CTA.

- [ ] **Step 2: Gate the CTA on the flag**

Import `isAssetSystemV2` at the top:
```tsx
import { isAssetSystemV2 } from '@/lib/feature-flags';
```

Find the click handler that currently runs the legacy `handleChatSend` (calls `api.createProject + uploadViaProxy + processProject + createSandbox`). Replace it with:

```tsx
const onCreateClick = useCallback(() => {
  if (isAssetSystemV2()) {
    router.push('/projects/new');
    return;
  }
  // ...existing legacy chat-send flow...
}, [router, /* existing deps */]);
```

- [ ] **Step 3: Verify with a test**

If the dashboard has test coverage, extend it. If not, skip automated testing — manual smoke is sufficient for a routing change.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/\(dashboard\)/projects/page.tsx
git commit -m "feat(web): dashboard CTA routes to /projects/new when ASSET_SYSTEM_V2 is on"
```

---

## Task 3: Composition-v2 endpoint

**Files:**
- Create: `packages/api/src/services/composition-loader.ts`
- Create: `packages/api/src/services/composition-loader.test.ts`
- Create: `packages/api/src/routes/composition.ts`
- Create: `packages/api/src/routes/composition.test.ts`
- Modify: `packages/api/src/index.ts`

Returns the editor everything it needs to render the DB-authored timeline: tracks, timelineItems, per-asset URL + metadata.

- [ ] **Step 1: Failing test for the loader service**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const spies = vi.hoisted(() => ({
  selectTracks: vi.fn(),
  selectItems: vi.fn(),
  selectAssets: vi.fn(),
  getPresignedDownloadUrl: vi.fn(),
}));

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn((table: unknown) => ({
        where: (...a: unknown[]) => {
          const name = String(table);
          if (name.includes('tracks')) return Promise.resolve(spies.selectTracks(...a));
          if (name.includes('timelineItems') || name.includes('timeline_items')) return Promise.resolve(spies.selectItems(...a));
          return Promise.resolve(spies.selectAssets(...a));
        },
        innerJoin: vi.fn(() => ({
          where: (...a: unknown[]) => Promise.resolve(spies.selectAssets(...a)),
        })),
      })),
    })),
  },
}));

vi.mock('./minio.js', () => ({
  getPresignedDownloadUrl: spies.getPresignedDownloadUrl,
}));

import { loadComposition } from './composition-loader.js';

beforeEach(() => { vi.clearAllMocks(); });

describe('loadComposition', () => {
  it('returns tracks + items + per-asset resolved URLs', async () => {
    spies.selectTracks.mockReturnValueOnce([
      { id: 't-0', projectId: 'p-1', position: 0, type: 'video', name: 'Track 1' },
    ]);
    spies.selectItems.mockReturnValueOnce([
      { id: 'i-1', trackId: 't-0', type: 'video', startMs: 0, endMs: 3000,
        data: { assetId: 'a-1', sourceStartMs: 0, sourceDurationMs: 3000, source: 'arrangement_agent' } },
    ]);
    spies.selectAssets.mockReturnValueOnce([
      { id: 'a-1', filename: 'hero.mp4', mimeType: 'video/mp4', storageKey: 'users/u-1/assets/abc/hero.mp4', durationMs: 3000 },
    ]);
    spies.getPresignedDownloadUrl.mockReturnValueOnce('https://signed/hero.mp4');

    const result = await loadComposition({ projectId: 'p-1', userId: 'u-1' });
    expect(result.tracks).toHaveLength(1);
    expect(result.timelineItems).toHaveLength(1);
    expect(result.assets).toHaveProperty('a-1');
    expect(result.assets['a-1']).toMatchObject({
      filename: 'hero.mp4',
      url: 'https://signed/hero.mp4',
      mimeType: 'video/mp4',
      durationMs: 3000,
    });
  });

  it('returns empty composition for a new project', async () => {
    spies.selectTracks.mockReturnValueOnce([]);
    spies.selectItems.mockReturnValueOnce([]);
    spies.selectAssets.mockReturnValueOnce([]);
    const result = await loadComposition({ projectId: 'p-1', userId: 'u-1' });
    expect(result.tracks).toEqual([]);
    expect(result.timelineItems).toEqual([]);
    expect(result.assets).toEqual({});
  });
});
```

- [ ] **Step 2: Run, expect RED**

- [ ] **Step 3: Implement loader**

`packages/api/src/services/composition-loader.ts`:

```ts
import { eq, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { tracks, timelineItems, assets } from '../db/schema.js';
import { getPresignedDownloadUrl } from './minio.js';

export interface CompositionTrack {
  id: string;
  projectId: string;
  position: number;
  type: string;
  name: string;
}

export interface CompositionItem {
  id: string;
  trackId: string;
  type: string;
  startMs: number;
  endMs: number;
  data: Record<string, unknown>;
}

export interface ResolvedAsset {
  id: string;
  filename: string;
  mimeType: string;
  durationMs: number | null;
  width: number | null;
  height: number | null;
  url: string;
  thumbnailUrl: string | null;
}

export interface Composition {
  tracks: CompositionTrack[];
  timelineItems: CompositionItem[];
  assets: Record<string, ResolvedAsset>;
}

const ASSET_URL_TTL_SECONDS = 24 * 3600;

export async function loadComposition(input: { projectId: string; userId: string }): Promise<Composition> {
  const projectTracks = await db.select().from(tracks).where(eq(tracks.projectId, input.projectId));
  const trackIds = projectTracks.map((t) => t.id);

  let items: CompositionItem[] = [];
  if (trackIds.length > 0) {
    items = (await db.select().from(timelineItems).where(inArray(timelineItems.trackId, trackIds))) as CompositionItem[];
  }

  const assetIds = new Set<string>();
  for (const item of items) {
    const d = item.data as { assetId?: string };
    if (typeof d.assetId === 'string') assetIds.add(d.assetId);
  }

  let assetRows: (typeof assets.$inferSelect)[] = [];
  if (assetIds.size > 0) {
    assetRows = await db.select().from(assets).where(inArray(assets.id, Array.from(assetIds)));
  }

  const resolvedAssets: Record<string, ResolvedAsset> = {};
  for (const a of assetRows) {
    const url = getPresignedDownloadUrl('uploads', a.storageKey, ASSET_URL_TTL_SECONDS);
    const thumbnailUrl = a.thumbnailKey
      ? getPresignedDownloadUrl('uploads', a.thumbnailKey, ASSET_URL_TTL_SECONDS)
      : null;
    resolvedAssets[a.id] = {
      id: a.id,
      filename: a.filename,
      mimeType: a.mimeType,
      durationMs: a.durationMs,
      width: a.width,
      height: a.height,
      url,
      thumbnailUrl,
    };
  }

  return {
    tracks: projectTracks as CompositionTrack[],
    timelineItems: items,
    assets: resolvedAssets,
  };
}
```

If `assets.thumbnailKey` is stored without the `uploads/` prefix (verify via `packages/api/src/services/minio.ts`), the `getPresignedDownloadUrl('uploads', ...)` call prepends it correctly.

- [ ] **Step 4: Run, expect GREEN**

- [ ] **Step 5: Route**

Create `packages/api/src/routes/composition.ts`:

```ts
import type { FastifyPluginAsync } from 'fastify';
import { eq } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { projects } from '../db/schema.js';
import { loadComposition } from '../services/composition-loader.js';

async function requireProjectOwnership(projectId: string, userId: string): Promise<boolean> {
  const rows = await db.select({ userId: projects.userId }).from(projects).where(eq(projects.id, projectId));
  return rows.length > 0 && rows[0].userId === userId;
}

const compositionRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authMiddleware);

  fastify.get<{ Params: { id: string } }>(
    '/projects/:id/composition-v2',
    async (request, reply) => {
      const userId = request.user!.id;
      const projectId = request.params.id;

      if (!(await requireProjectOwnership(projectId, userId))) {
        return reply.code(403).send({ error: 'forbidden' });
      }

      const composition = await loadComposition({ projectId, userId });
      return reply.send(composition);
    },
  );
};

export default compositionRoutes;
```

Route test:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fastify from 'fastify';

const spies = vi.hoisted(() => ({
  loadComposition: vi.fn(),
  selectProjectOwner: vi.fn(),
}));

vi.mock('../services/composition-loader.js', () => ({
  loadComposition: spies.loadComposition,
}));
vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: (...a: unknown[]) => {
          spies.selectProjectOwner(...a);
          return Promise.resolve(spies.selectProjectOwner.mock.results.at(-1)?.value ?? []);
        },
      })),
    })),
  },
}));
vi.mock('../middleware/auth.js', () => ({
  authMiddleware: async (req: { user: { id: string } }) => {
    req.user = { id: 'u-1' } as unknown as never;
  },
}));

import compositionRoutes from './composition.js';

beforeEach(() => { vi.clearAllMocks(); });

async function build() {
  const app = fastify();
  await app.register(compositionRoutes);
  return app;
}

function seedOwner(userId: string | null) {
  spies.selectProjectOwner.mockImplementationOnce(() => userId === null ? [] : [{ userId }]);
}

describe('GET /projects/:id/composition-v2', () => {
  it('returns 403 when caller does not own the project', async () => {
    seedOwner('other-user');
    const app = await build();
    const res = await app.inject({ method: 'GET', url: '/projects/p-1/composition-v2' });
    expect(res.statusCode).toBe(403);
    expect(spies.loadComposition).not.toHaveBeenCalled();
  });

  it('returns composition when owned', async () => {
    seedOwner('u-1');
    spies.loadComposition.mockResolvedValueOnce({ tracks: [], timelineItems: [], assets: {} });
    const app = await build();
    const res = await app.inject({ method: 'GET', url: '/projects/p-1/composition-v2' });
    expect(res.statusCode).toBe(200);
    expect(spies.loadComposition).toHaveBeenCalledWith({ projectId: 'p-1', userId: 'u-1' });
  });
});
```

- [ ] **Step 6: Register in index.ts**

In `packages/api/src/index.ts`, inside the existing `ASSET_SYSTEM_V2` block:

```ts
import compositionRoutes from './routes/composition.js';
// ...
if (config.featureFlags.assetSystemV2) {
  // ...existing registrations...
  await fastify.register(compositionRoutes, { prefix: '/api' });
}
```

Use the `/api` prefix to match the existing convention (Task B3 fix).

- [ ] **Step 7: Commit**

```bash
git add packages/api/src/services/composition-loader.ts packages/api/src/services/composition-loader.test.ts \
  packages/api/src/routes/composition.ts packages/api/src/routes/composition.test.ts \
  packages/api/src/index.ts
git commit -m "feat(api): GET /api/projects/:id/composition-v2 — tracks + items + resolved asset URLs"
```

---

## Task 4: `composition_updated` SSE event

**Files:**
- Modify: `packages/api/src/services/pipeline-messages.ts`
- Modify: `packages/worker/src/services/pipeline-messages.ts` (mirror)
- Modify: `packages/api/src/agent/agent-router.ts` — relay composition events
- Modify: `packages/api/src/sandbox/proxy.ts` — extend `InterceptCallbacks.attachSideChannel` to handle the new frame type (may already work if it's a generic relay)

Today, `pipeline-messages.ts` publishes a `pipeline_message` envelope when `arranged` event fires. Extend so on `arranged` it ALSO publishes a `composition_updated` envelope on the same `conversation:{projectId}` channel. Frontend (Task 5) listens and refetches.

- [ ] **Step 1: Inspect current pipeline-messages.ts**

Read `packages/api/src/services/pipeline-messages.ts`. Find where the Redis publish happens (~line 60 per grounding). Today: one publish per call, envelope with `kind: 'pipeline_message'`.

- [ ] **Step 2: Failing test**

Extend `packages/api/src/services/pipeline-messages.test.ts` with:

```ts
it('also publishes composition_updated when eventType is "arranged" with ok:true', async () => {
  spies.addMessage.mockResolvedValueOnce({ id: 'm-1', conversationId: 'c-1', role: 'pipeline' });
  await insertPipelineMessage({
    conversationId: 'c-1', projectId: 'p-1',
    eventType: 'arranged',
    details: { ok: true, itemCount: 5 },
  });
  const publishedChannels = spies.publish.mock.calls.map((c) => c[0]);
  expect(publishedChannels).toContain('conversation:p-1');
  // Now also expect a composition_updated envelope published on the same channel:
  const payloads = spies.publish.mock.calls.map((c) => c[1] as string);
  const compositionPayload = payloads.find((p) => p.includes('"kind":"composition_updated"'));
  expect(compositionPayload).toBeDefined();
  expect(compositionPayload).toContain('"projectId":"p-1"');
});

it('does NOT publish composition_updated on arranged with ok:false', async () => {
  spies.addMessage.mockResolvedValueOnce({ id: 'm-1', conversationId: 'c-1', role: 'pipeline' });
  await insertPipelineMessage({
    conversationId: 'c-1', projectId: 'p-1',
    eventType: 'arranged',
    details: { ok: false, error: 'boom' },
  });
  const payloads = spies.publish.mock.calls.map((c) => c[1] as string);
  const compositionPayload = payloads.find((p) => p.includes('"kind":"composition_updated"'));
  expect(compositionPayload).toBeUndefined();
});
```

- [ ] **Step 3: Implement**

In `packages/api/src/services/pipeline-messages.ts`, after the existing publish:

```ts
// If this was a successful arrangement completion, also emit a composition_updated
// envelope on the same channel so the editor refetches its timeline.
if (input.eventType === 'arranged' && input.details.ok === true) {
  const compositionEnvelope = JSON.stringify({
    kind: 'composition_updated',
    projectId: input.projectId,
    trigger: 'arranged',
    itemCount: input.details.itemCount ?? null,
  });
  await redis.publish(`conversation:${input.projectId}`, compositionEnvelope);
}
```

Mirror the change in `packages/worker/src/services/pipeline-messages.ts`.

- [ ] **Step 4: Relay in agent-router SSE**

In `packages/api/src/agent/agent-router.ts`, find the `attachSideChannel` callback (added in commit `613d7b793`). It currently parses `kind: 'pipeline_message'` and writes SSE frames. Extend to also relay `kind: 'composition_updated'`:

```ts
if (envelope.kind === 'pipeline_message') {
  stream.write(`event: pipeline_message\ndata: ${JSON.stringify(envelope)}\n\n`);
} else if (envelope.kind === 'composition_updated') {
  stream.write(`event: composition_updated\ndata: ${JSON.stringify(envelope)}\n\n`);
}
```

- [ ] **Step 5: Run tests + commit**

```bash
cd packages/api && pnpm test -- src/services/pipeline-messages.test.ts
git add packages/api/src/services/pipeline-messages.ts packages/api/src/services/pipeline-messages.test.ts \
  packages/worker/src/services/pipeline-messages.ts \
  packages/api/src/agent/agent-router.ts
git commit -m "feat(api): emit composition_updated SSE event on arranged completion"
```

---

## Task 5: Frontend — listen for `composition_updated` and refetch

**Files:**
- Create: `apps/web/src/lib/sse/useCompositionEvents.ts` — OR extend the existing agent-chat SSE consumer in `AIAssistantPanel.tsx`
- Create: `apps/web/src/lib/api/composition.ts` — client for the new endpoint
- Modify: `apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx` — on `composition_updated` frame, trigger editor-store reload

The chat SSE now carries `composition_updated` events (Task 4). The simplest wire is to extend the existing `handleSSEEvent` in `AIAssistantPanel.tsx` with a new branch.

- [ ] **Step 1: Composition client**

```ts
// apps/web/src/lib/api/composition.ts
import { getSessionToken } from '../auth';

export interface ResolvedAsset {
  id: string;
  filename: string;
  mimeType: string;
  durationMs: number | null;
  width: number | null;
  height: number | null;
  url: string;
  thumbnailUrl: string | null;
}

export interface Composition {
  tracks: Array<{ id: string; projectId: string; position: number; type: string; name: string }>;
  timelineItems: Array<{ id: string; trackId: string; type: string; startMs: number; endMs: number; data: Record<string, unknown> }>;
  assets: Record<string, ResolvedAsset>;
}

export class CompositionApi {
  constructor(private readonly baseUrl: string) {}

  async getComposition(projectId: string): Promise<Composition> {
    const token = getSessionToken();
    const res = await fetch(`${this.baseUrl}/api/projects/${projectId}/composition-v2`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) throw new Error(`${res.status} composition: ${await res.text()}`);
    return res.json() as Promise<Composition>;
  }
}
```

Colocated test mirrors the existing `AssetsApi` test pattern (hoisted fetch spy, auth mock).

- [ ] **Step 2: Wire into AIAssistantPanel SSE handler**

In `apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx`, find the existing `handleSSEEvent` (which already handles `pipeline_message` after commit `ab4a3a053`). Add a branch:

```tsx
import { CompositionApi } from '@/lib/api/composition';
import { useEditorStore } from '@/features/editor-v2/store/editor-store';  // or actual path

// ...inside the component, get a store action:
const applyCompositionV2 = useEditorStore((s) => s.applyCompositionV2);

// In handleSSEEvent:
if (event.event === 'composition_updated') {
  try {
    const envelope = JSON.parse(event.data);
    if (envelope.projectId === projectId) {
      // Refetch + apply to store.
      const api = new CompositionApi(process.env.NEXT_PUBLIC_API_URL ?? '');
      const composition = await api.getComposition(projectId);
      applyCompositionV2(composition);
    }
  } catch {
    // ignore
  }
  return;
}
```

Define `applyCompositionV2` on the Zustand store in Task 6.

- [ ] **Step 3: Run + commit**

```bash
git add apps/web/src/lib/api/composition.ts apps/web/src/lib/api/composition.test.ts \
  apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx
git commit -m "feat(web): SSE composition_updated triggers editor-store refetch"
```

---

## Task 6: Editor store — `applyCompositionV2` + manifest-bridge assetId resolution

**Files:**
- Modify: `apps/web/src/features/editor-v2/store/editor-store.ts`
- Modify: `apps/web/src/features/editor-v2/store/manifest-bridge.ts`

Editor store gains an action that accepts `Composition` and applies it to `tracks` + `items` state. `manifest-bridge` learns to resolve `data.assetId` via the composition's `assets` map.

- [ ] **Step 1: Inspect existing store shape**

Read `apps/web/src/features/editor-v2/store/editor-store.ts` end-to-end. Find the existing `loadProject` or `reloadVisuals` action. The Zustand store holds `tracks: Track[]` + `items: TimelineItem[]` + `itemIds: string[]` per the grounding.

- [ ] **Step 2: Add `applyCompositionV2` action**

```ts
import type { Composition } from '@/lib/api/composition';

// Inside the store's state slice:
interface EditorState {
  // ...existing...
  applyCompositionV2: (composition: Composition) => void;
}

// Inside create((set, get) => ({ ... })):
applyCompositionV2: (composition) => set((state) => {
  // Convert composition to store shape.
  const tracks = composition.tracks.map((t) => ({
    id: t.id,
    type: t.type as Track['type'],  // cast to existing Track type union
    name: t.name,
    position: t.position,
  }));

  const items = composition.timelineItems.map((i) => {
    const d = i.data as { assetId?: string; sourceStartMs?: number; sourceDurationMs?: number };
    const asset = d.assetId ? composition.assets[d.assetId] : undefined;
    return {
      id: i.id,
      type: i.type as TimelineItem['type'],
      trackId: i.trackId,
      startMs: i.startMs,
      endMs: i.endMs,
      data: {
        ...d,
        // Attach resolved URL + thumbnail for the existing player/preview to consume.
        src: asset?.url ?? d.src,
        thumbnailUrl: asset?.thumbnailUrl,
        filename: asset?.filename,
      },
    } as TimelineItem;
  });

  return {
    ...state,
    tracks,
    items,
    itemIds: items.map((i) => i.id),
  };
}),
```

Adjust to match the actual store shape + `TimelineItem` / `Track` interfaces the codebase already defines. Don't fight the types — read them first.

- [ ] **Step 3: Teach manifest-bridge about `assetId`**

If the editor still primarily uses `manifest-bridge` on initial load (reading from sandbox manifest), add a pass that, after the manifest is loaded, fetches the composition-v2 and merges arrangement-authored items:

In `editor-store.ts`'s `loadProject` (or equivalent):

```ts
loadProject: async (projectId) => {
  // ...existing manifest-bridge load...

  if (isAssetSystemV2()) {
    const api = new CompositionApi(process.env.NEXT_PUBLIC_API_URL ?? '');
    try {
      const composition = await api.getComposition(projectId);
      if (composition.timelineItems.length > 0) {
        get().applyCompositionV2(composition);
      }
    } catch (err) {
      console.error('[editor-store] composition-v2 load failed', err);
    }
  }
},
```

If the existing `loadProject` signature is different, adapt. The goal: after legacy load, if V2 composition has arrangement rows, they override.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/editor-v2/store/editor-store.ts apps/web/src/features/editor-v2/store/manifest-bridge.ts
git commit -m "feat(web): editor-store applyCompositionV2 + loadProject merges composition-v2"
```

---

## Task 7: Timeline drop handler — V2 payload support

**Files:**
- Modify: `apps/web/src/features/editor-v2/timeline/timeline-canvas.tsx` (path per audit)

Closes audit finding 8. The existing drop handler reads `application/x-project-asset` and creates items with `data: { src: asset.url, volume: 1 }`. V2 payloads have `{ id, mimeType, filename, label, durationMs }` — no `url`.

- [ ] **Step 1: Inspect the existing drop handler**

Find the handler (likely around `timeline-canvas.tsx:515-571` per audit). Note the shape it expects.

- [ ] **Step 2: Detect V2 payload + resolve URL**

```tsx
import { AssetsApi } from '@/lib/api/assets';

const assetsApi = new AssetsApi(process.env.NEXT_PUBLIC_API_URL ?? '');

// Inside the drop handler:
const payload = JSON.parse(e.dataTransfer.getData('application/x-project-asset'));

let src: string;
if (payload.url) {
  src = payload.url;  // legacy payload
} else if (payload.id) {
  // V2 payload — resolve via API.
  const { url } = await assetsApi.getAssetUrl(payload.id);
  src = url;
} else {
  console.warn('[timeline drop] unknown payload shape', payload);
  return;
}

// Existing item-creation logic with `data: { src, assetId: payload.id, volume: 1 }`...
```

Include `assetId` in the item data so downstream consumers (preview, save-back-to-sandbox-manifest) can re-resolve if needed.

- [ ] **Step 3: Test**

Frontend drag tests exist for AssetsPanelV2. The timeline-canvas drop handler may not have tests — if not, skip and smoke-test manually (automated drop-event testing is tricky).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/editor-v2/timeline/timeline-canvas.tsx
git commit -m "feat(web): timeline drop handler resolves V2 asset payload via getAssetUrl"
```

---

## Task 8: AssetsPanelV2 tiles — thumbnail + duration

**Files:**
- Modify: `apps/web/src/features/editor-v2/panels/AssetsPanelV2.tsx`
- Modify: `apps/web/src/features/editor-v2/panels/AssetsPanelV2.test.tsx`

Closes audit finding 5 partial. Today tiles are filename-only.

- [ ] **Step 1: Extend test**

```tsx
it('renders thumbnail img when thumbnailKey is present', async () => {
  spies.listProjectAssets.mockResolvedValueOnce({
    assets: [{
      id: 'a-1', filename: 'hero.mp4', label: 'hero.mp4', mimeType: 'video/mp4',
      status: 'ready', durationMs: 5000, thumbnailKey: 'users/u/derived/abc/thumbnail.jpg',
    }],
  });
  render(<AssetsPanelV2 projectId="p-1" />);
  await waitFor(() => screen.getByText(/hero\.mp4/i));
  const tile = screen.getByTestId('asset-tile-a-1');
  const img = tile.querySelector('img');
  expect(img).not.toBeNull();
});

it('renders duration badge when durationMs is present', async () => {
  spies.listProjectAssets.mockResolvedValueOnce({
    assets: [{
      id: 'a-1', filename: 'hero.mp4', label: 'hero.mp4', mimeType: 'video/mp4',
      status: 'ready', durationMs: 15000,
    }],
  });
  render(<AssetsPanelV2 projectId="p-1" />);
  await waitFor(() => {
    expect(screen.getByText(/0:15/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Implement**

Resolve the thumbnail URL client-side via `api.getAssetUrl(a.id)` OR accept that the `listProjectAssets` response doesn't include it and add a helper. **Easier:** extend the backend route to include `thumbnailUrl` (presigned) in the response body for each asset. Inspect `packages/api/src/routes/project-assets.ts:48-51` — `listProjectAssets` passes the raw rows; add a thumbnail URL in the response shape.

For this task, do the simpler frontend-only approach: compute thumbnail URL lazily per tile via a `useEffect + getAssetUrl` call. Cache per-asset in state so it doesn't re-fire. Good enough for shipping.

Update tile JSX:

```tsx
function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// Inside the tile:
<li data-testid={`asset-tile-${a.id}`} draggable onDragStart={...}>
  <div className="flex items-center gap-2">
    {a.thumbnailKey && <img src={thumbnailUrls[a.id]} alt="" className="h-8 w-12 rounded object-cover" />}
    <div className="flex-1 truncate">{a.filename}</div>
    {a.durationMs != null && (
      <span className="text-xs text-muted-foreground">{formatDuration(a.durationMs)}</span>
    )}
  </div>
</li>
```

Thumbnail URL state:

```tsx
const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({});

useEffect(() => {
  const toLoad = assets.filter((a) => a.thumbnailKey && !thumbnailUrls[a.id]);
  toLoad.forEach(async (a) => {
    try {
      const { url } = await api.getAssetUrl(a.id);
      setThumbnailUrls((prev) => ({ ...prev, [a.id]: url }));
    } catch {
      // ignore
    }
  });
}, [assets, thumbnailUrls]);
```

Note: `getAssetUrl` returns the MAIN asset URL, not the thumbnail. If the backend doesn't expose a thumbnail URL endpoint, extend `listProjectAssets` service to include `thumbnailUrl` inline, OR accept "no thumbnail preview" for this pass and just show mime-icon + filename + duration. Pick whichever is smallest. Prefer extending `listProjectAssets` on the backend if the frontend-only approach becomes messy.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/editor-v2/panels/AssetsPanelV2.tsx apps/web/src/features/editor-v2/panels/AssetsPanelV2.test.tsx
git commit -m "feat(web): AssetsPanelV2 renders thumbnail + duration per tile"
```

---

## Task 9: Typecheck + integration test extension

- [ ] **Step 1: Run all suites**

```bash
pnpm typecheck
cd packages/api && pnpm test
cd ../worker && pnpm test
cd ../sandbox && pnpm test
cd ../../apps/web && pnpm test
```

Baseline:
- API: 2 pre-existing errors — preserve
- Worker: clean
- Sandbox: clean
- Web: 9 pre-existing errors in unrelated files — preserve

No new errors from PR-C2.

- [ ] **Step 2: Extend the integration smoke test**

In `packages/api/src/__smoke__/asset-system-v2-integration.test.ts` (committed `b3b452341`), add a 12th scenario:

```ts
it('12: GET /api/projects/:id/composition-v2 returns tracks + items + resolved assets after arrangement persists', async () => {
  // Seed tracks + timelineItems directly via db (simulating arrangement worker output).
  const [track] = await db.insert(tracks).values({
    projectId, type: 'video', name: 'Track 1', position: 0, locked: false, visible: true,
  }).returning();
  await db.insert(timelineItems).values({
    trackId: track.id, type: 'video', startMs: 0, endMs: 3000,
    data: { assetId: seededAssetId, sourceStartMs: 0, sourceDurationMs: 3000, source: 'arrangement_agent' },
  });

  const res = await app.inject({
    method: 'GET',
    url: `/api/projects/${projectId}/composition-v2`,
    headers: { 'x-test-user-id': ownerUserId },
  });
  expect(res.statusCode).toBe(200);
  const body = res.json();
  expect(body.tracks).toHaveLength(1);
  expect(body.timelineItems).toHaveLength(1);
  expect(body.assets[seededAssetId]).toMatchObject({
    filename: expect.any(String),
    url: expect.stringContaining('http'),
  });
});
```

- [ ] **Step 3: Commit any final fixups**

```bash
git add packages/api/src/__smoke__/asset-system-v2-integration.test.ts
git commit -m "test(api): extend integration smoke test with composition-v2 scenario"
```

---

## Self-Review Checklist

**1. Spec coverage** (§6.8 Phase 2 step 10 — "Timeline populates; preview shows first pass"):
- ✅ DB → editor: Task 3 (endpoint) + Task 5 (SSE) + Task 6 (store action)
- ✅ Preview resolves asset URLs: composition-v2 returns presigned URLs in `assets` map; Task 6's `applyCompositionV2` merges `src` + `thumbnailUrl` into each item's data
- ✅ Timeline drop: Task 7 resolves V2 payload
- ✅ Live refresh: `composition_updated` SSE triggers refetch
- ✅ Navigation: Task 2 links `/projects/new`
- ✅ CORS: Task 1 widens to PUT
- ✅ Tiles render properly: Task 8

**2. Placeholder scan:** every task has runnable code. Task 6 has a "read the existing store shape + adapt types" instruction — intentional, not a placeholder.

**3. Type consistency:**
- `Composition` shape consistent between `composition-loader.ts`, `composition.ts` client, and `applyCompositionV2` action.
- `ResolvedAsset.url` is always a string (presigned, 24h); consumers don't null-check.
- SSE event name `composition_updated` consistent across emitter (Task 4), agent-router relay (Task 4), and frontend handler (Task 5).

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-20-frontend-e2e-integration.md`. Two execution options:

**1. Subagent-Driven (recommended)** — same workflow as PR-A1/A2/B/C.
**2. Inline Execution** — batch with checkpoints.

Which approach?
