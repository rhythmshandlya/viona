# Sandbox Asset Integration Implementation Plan (PR-B)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the sandbox's one-shot `asset-sync.ts` directory-sweep with a DB-driven manifest + lazy-hydration MCP tools, so the agent can (a) read any project asset on demand via `read_asset(id)` and (b) register generated outputs as first-class assets via `register_asset(local_path, ...)`.

**Architecture:** On boot, the sandbox fetches its project's asset manifest from a new internal API endpoint (`GET /internal/sandbox/:sid/assets-manifest`) and writes it to `/workspace/assets-manifest.json`. Two new MCP tools wrap the remaining server round-trips: `read_asset(id)` streams asset bytes from `GET /internal/sandbox/:sid/asset/:aid/stream` into `/workspace/assets/{id}/{filename}` with a local disk cache; `register_asset(local_path, kind, parent_asset_ids?, label?)` uploads the file and calls `POST /internal/sandbox/:sid/asset/register` (a thin passthrough to the existing `POST /assets/register` flow). The legacy `asset-sync.ts` is gated to no-op when `ASSET_SYSTEM_V2=true`.

**Tech Stack:** Fastify (API internal routes), Claude Agent SDK MCP (`createSdkMcpServer` + `tool()`), Zod (schema), Node `fetch` + filesystem (sandbox helpers), Drizzle, MinIO, BullMQ already established, Vitest.

**Spec reference:** `docs/superpowers/specs/2026-04-19-asset-system-research.md` — §6.8 Phase 2 (step 7: "Sandbox boots" / manifest hydration), §7.2 PR-B.

**Depends on:** PR-A1 (asset schema + registration flow), PR-A2 (pipeline events available but not required here).

---

## Scope notes

**Dropped from the original PR-B spec**: "Tar agent working-dir state to S3 on shutdown; restore on boot." The existing `packages/sandbox/src/checkpoint.ts` already does exactly this via git bundles + MinIO, triggered on SIGTERM from `entry.ts`. No new work needed.

**Out of scope**: deletion of `asset-sync.ts` (gate it with a flag; removal ships in a later cleanup PR once no remaining projects depend on the old path).

---

## File Structure

**Create (API):**
- `packages/api/src/routes/internal-sandbox-assets.ts` — internal-only endpoints authed via `SANDBOX_SECRET`
- `packages/api/src/routes/internal-sandbox-assets.test.ts`

**Create (Sandbox):**
- `packages/sandbox/src/assets/manifest.ts` — fetches + writes `assets-manifest.json` on boot
- `packages/sandbox/src/assets/manifest.test.ts`
- `packages/sandbox/src/tools/read-asset.ts` — MCP tool
- `packages/sandbox/src/tools/read-asset.test.ts`
- `packages/sandbox/src/tools/register-asset.ts` — MCP tool
- `packages/sandbox/src/tools/register-asset.test.ts`
- `packages/sandbox/vitest.config.ts` — wires up the test runner (package currently has no `vitest.config`)

**Modify:**
- `packages/api/src/index.ts` — register the new internal route module behind `ASSET_SYSTEM_V2`
- `packages/sandbox/src/workspace-init.ts` — call the manifest fetcher on boot (gated by flag)
- `packages/sandbox/src/asset-sync.ts` — early-return when `ASSET_SYSTEM_V2=true` (keep file alive for legacy projects)
- `packages/sandbox/src/mcp-servers.ts` — add `assetsServer` wiring the two new tools
- `packages/sandbox/package.json` — add `vitest` if missing (check first)

**Do not touch:**
- `packages/sandbox/src/checkpoint.ts` (workspace-state preservation already done)
- `packages/sandbox/src/entry.ts` (boot ordering is fine; workspace-init wires in the manifest fetch)

---

## Conventions

- Model for implementer subagents: `opus` per user preference.
- `.js` import extensions on relative TS imports.
- All new API routes behind `ASSET_SYSTEM_V2` flag. Sandbox new code paths also gated.
- Internal (sandbox-to-api) routes use `Authorization: Bearer ${SANDBOX_SECRET}` — match the existing `/internal/sandbox/:sid/*` convention.
- Test colocation (`.test.ts` alongside source).

---

## Task 1: API — internal assets-manifest endpoint

**Files:**
- Create: `packages/api/src/routes/internal-sandbox-assets.ts`
- Create: `packages/api/src/routes/internal-sandbox-assets.test.ts`

Returns a JSON manifest for a sandbox: `[{ id, filename, mimeType, storageKey, sizeBytes, transcriptAssetId? }]`. Auth via Bearer matching `SANDBOX_SECRET` stored on the sandbox row.

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fastify from 'fastify';

const spies = vi.hoisted(() => ({
  listProjectAssets: vi.fn(),
  verifySecret: vi.fn(),
}));

vi.mock('../services/asset-link-service.js', () => ({
  listProjectAssets: spies.listProjectAssets,
}));
vi.mock('../sandbox/manager.js', () => ({
  sandboxManager: { verifySandboxSecret: spies.verifySecret },
}));

import internalSandboxAssetsRoutes from './internal-sandbox-assets.js';

async function build() {
  const app = fastify();
  await app.register(internalSandboxAssetsRoutes);
  return app;
}

beforeEach(() => { vi.clearAllMocks(); });

describe('GET /internal/sandbox/:sid/assets-manifest', () => {
  it('returns 401 when Bearer token missing', async () => {
    const app = await build();
    const res = await app.inject({ method: 'GET', url: '/internal/sandbox/p-1/assets-manifest' });
    expect(res.statusCode).toBe(401);
  });

  it('returns 403 when secret mismatches', async () => {
    spies.verifySecret.mockResolvedValueOnce(false);
    const app = await build();
    const res = await app.inject({
      method: 'GET',
      url: '/internal/sandbox/p-1/assets-manifest',
      headers: { authorization: 'Bearer wrong' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('returns manifest JSON when auth passes', async () => {
    spies.verifySecret.mockResolvedValueOnce(true);
    spies.listProjectAssets.mockResolvedValueOnce([
      { id: 'a-1', filename: 'hero.mp4', mimeType: 'video/mp4', storageKey: 'k1', fileSize: 1000, transcriptAssetId: 't-1' },
      { id: 'a-2', filename: 'logo.png', mimeType: 'image/png', storageKey: 'k2', fileSize: 500, transcriptAssetId: null },
    ]);
    const app = await build();
    const res = await app.inject({
      method: 'GET',
      url: '/internal/sandbox/p-1/assets-manifest',
      headers: { authorization: 'Bearer good-secret' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.projectId).toBe('p-1');
    expect(body.assets).toHaveLength(2);
    expect(body.assets[0]).toMatchObject({ id: 'a-1', filename: 'hero.mp4', mimeType: 'video/mp4', sizeBytes: 1000, transcriptAssetId: 't-1' });
    expect(body.assets[0].storageKey).toBeUndefined();  // don't leak storage keys to sandbox
  });
});
```

- [ ] **Step 2: Run, expect RED**

`cd packages/api && pnpm test -- src/routes/internal-sandbox-assets.test.ts`

- [ ] **Step 3: Implement**

Create `packages/api/src/routes/internal-sandbox-assets.ts`:

```ts
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { sandboxManager } from '../sandbox/manager.js';
import { listProjectAssets } from '../services/asset-link-service.js';

function parseBearer(req: FastifyRequest): string | null {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return null;
  return h.slice(7).trim() || null;
}

async function authGate(req: FastifyRequest, reply: FastifyReply, sid: string): Promise<boolean> {
  const token = parseBearer(req);
  if (!token) {
    reply.code(401).send({ error: 'missing_bearer' });
    return false;
  }
  const ok = await sandboxManager.verifySandboxSecret(sid, token);
  if (!ok) {
    reply.code(403).send({ error: 'forbidden' });
    return false;
  }
  return true;
}

const internalSandboxAssetsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { sid: string } }>(
    '/internal/sandbox/:sid/assets-manifest',
    async (request, reply) => {
      const { sid } = request.params;
      if (!(await authGate(request, reply, sid))) return;

      const rows = await listProjectAssets(sid);
      const assets = rows.map((a) => ({
        id: a.id,
        filename: a.filename,
        mimeType: a.mimeType,
        sizeBytes: a.fileSize,
        durationMs: a.durationMs ?? undefined,
        width: a.width ?? undefined,
        height: a.height ?? undefined,
        userIntent: a.userIntent ?? undefined,
        userDescription: a.userDescription ?? undefined,
        transcriptAssetId: a.transcriptAssetId ?? null,
      }));
      return reply.send({ projectId: sid, assets, generatedAt: new Date().toISOString() });
    },
  );
};

export default internalSandboxAssetsRoutes;
```

**Note:** `sandboxManager.verifySandboxSecret(projectId, token)` must exist. If it doesn't, inspect `packages/api/src/sandbox/manager.ts` and add one that reads the sandbox row's stored `secret` field and does a constant-time compare. If there's an existing auth helper (e.g. existing internal routes use `requireSandboxSecret` middleware), reuse it. Check `packages/api/src/index.ts` for patterns like `/internal/sandbox/:sid/ready` — the sandbox's entry.ts posts to these already.

**Storage key is NOT returned** — the sandbox only receives asset IDs and metadata. Bytes come through the streaming endpoint (Task 2).

- [ ] **Step 4: Run, expect GREEN**

`cd packages/api && pnpm test -- src/routes/internal-sandbox-assets.test.ts`

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/routes/internal-sandbox-assets.ts packages/api/src/routes/internal-sandbox-assets.test.ts
git commit -m "feat(api): GET /internal/sandbox/:sid/assets-manifest — project asset list for sandbox boot"
```

---

## Task 2: API — internal asset-stream endpoint

**Files:**
- Modify: `packages/api/src/routes/internal-sandbox-assets.ts`
- Modify: `packages/api/src/routes/internal-sandbox-assets.test.ts`

Streams asset bytes from MinIO through the API to the sandbox. Simpler than presigned-URL juggling + hides the storage key.

- [ ] **Step 1: Extend failing test**

```ts
describe('GET /internal/sandbox/:sid/asset/:aid/stream', () => {
  it('returns 403 when asset is not owned by the sandbox project', async () => {
    spies.verifySecret.mockResolvedValueOnce(true);
    spies.listProjectAssets.mockResolvedValueOnce([]);  // asset not in project
    const app = await build();
    const res = await app.inject({
      method: 'GET',
      url: '/internal/sandbox/p-1/asset/a-999/stream',
      headers: { authorization: 'Bearer good-secret' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('streams bytes from MinIO with correct content-type on success', async () => {
    spies.verifySecret.mockResolvedValueOnce(true);
    spies.listProjectAssets.mockResolvedValueOnce([
      { id: 'a-1', filename: 'hero.mp4', mimeType: 'video/mp4', storageKey: 'users/u/assets/abc/hero.mp4', fileSize: 1000, transcriptAssetId: null },
    ]);
    spies.getObject.mockResolvedValueOnce({
      [Symbol.asyncIterator]: async function* () { yield Buffer.from('abc'); },
    });

    const app = await build();
    const res = await app.inject({
      method: 'GET',
      url: '/internal/sandbox/p-1/asset/a-1/stream',
      headers: { authorization: 'Bearer good-secret' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('video/mp4');
    expect(res.rawPayload.toString()).toBe('abc');
  });
});
```

Add `getObject: vi.fn()` to the `spies` hoisted object at the top of the file, and `vi.mock('../services/minio.js', () => ({ minioClient: { getObject: spies.getObject } }))` alongside the other mocks. Also ensure the `config` mock exports `{ storage: { bucket: 'viona' } }` if the endpoint reads it.

- [ ] **Step 2: Run, expect RED**

- [ ] **Step 3: Implement** — append this route to `internal-sandbox-assets.ts`:

```ts
import { minioClient } from '../services/minio.js';
import { config } from '../config.js';

fastify.get<{ Params: { sid: string; aid: string } }>(
  '/internal/sandbox/:sid/asset/:aid/stream',
  async (request, reply) => {
    const { sid, aid } = request.params;
    if (!(await authGate(request, reply, sid))) return;

    const rows = await listProjectAssets(sid);
    const asset = rows.find((a) => a.id === aid);
    if (!asset) return reply.code(403).send({ error: 'not_in_project' });

    const stream = await minioClient.getObject(config.storage.bucket, asset.storageKey);
    reply.header('Content-Type', asset.mimeType);
    reply.header('Content-Length', String(asset.fileSize));
    return reply.send(stream);
  },
);
```

- [ ] **Step 4: Run, expect GREEN**

`cd packages/api && pnpm test -- src/routes/internal-sandbox-assets.test.ts`

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/routes/internal-sandbox-assets.ts packages/api/src/routes/internal-sandbox-assets.test.ts
git commit -m "feat(api): GET /internal/sandbox/:sid/asset/:aid/stream — proxy asset bytes from MinIO"
```

---

## Task 3: API — internal asset-register endpoint

**Files:**
- Modify: `packages/api/src/routes/internal-sandbox-assets.ts`
- Modify: `packages/api/src/routes/internal-sandbox-assets.test.ts`

Sandbox-scoped `POST /internal/sandbox/:sid/asset/register`. Thin passthrough to `createOrDedupAsset` (already ownership-agnostic — it takes `userId`) plus auto-linking the newly-created asset to the project.

The sandbox provides: `sha256`, `storageKey` (where its MCP tool just uploaded the bytes), `filename`, `mimeType`, `fileSize`, `source: 'generated' | 'derived'`, `parentAssetIds?`, `label?`, and the `projectId` is `:sid` from the path.

- [ ] **Step 1: Extend failing test**

```ts
describe('POST /internal/sandbox/:sid/asset/register', () => {
  it('creates + links the asset to the project', async () => {
    spies.verifySecret.mockResolvedValueOnce(true);
    spies.getProjectOwner.mockResolvedValueOnce('u-1');  // owner of the sandbox project
    spies.createOrDedupAsset.mockResolvedValueOnce({
      asset: { id: 'a-new', userId: 'u-1' },
      deduped: false,
    });
    spies.linkAssetToProject.mockResolvedValueOnce({ id: 'l-1' });

    const app = await build();
    const res = await app.inject({
      method: 'POST',
      url: '/internal/sandbox/p-1/asset/register',
      headers: { authorization: 'Bearer good-secret', 'content-type': 'application/json' },
      payload: {
        sha256: 'abc',
        storageKey: 'users/u-1/assets/abc/render.mp4',
        filename: 'render.mp4',
        mimeType: 'video/mp4',
        fileSize: 5000,
        source: 'generated',
        parentAssetIds: ['a-parent'],
        label: 'First render',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.asset.id).toBe('a-new');
    expect(body.deduped).toBe(false);

    expect(spies.createOrDedupAsset).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'u-1',
      sha256: 'abc',
      source: 'generated',
      parentAssetIds: ['a-parent'],
      projectIdForEvent: 'p-1',
    }));
    expect(spies.linkAssetToProject).toHaveBeenCalledWith(expect.objectContaining({
      assetId: 'a-new',
      projectId: 'p-1',
      userId: 'u-1',
      addedVia: 'generated',
    }));
  });

  it('skips re-linking when the asset already belongs to the project (dedup path)', async () => {
    spies.verifySecret.mockResolvedValueOnce(true);
    spies.getProjectOwner.mockResolvedValueOnce('u-1');
    spies.createOrDedupAsset.mockResolvedValueOnce({
      asset: { id: 'a-existing', userId: 'u-1' },
      deduped: true,
    });
    spies.linkAssetToProject.mockResolvedValueOnce({ id: 'l-existing' });  // idempotent from PR-A1 Task 4

    const app = await build();
    const res = await app.inject({
      method: 'POST',
      url: '/internal/sandbox/p-1/asset/register',
      headers: { authorization: 'Bearer good-secret', 'content-type': 'application/json' },
      payload: {
        sha256: 'abc', storageKey: 'k', filename: 'f.mp4',
        mimeType: 'video/mp4', fileSize: 1, source: 'generated',
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().deduped).toBe(true);
    // Link is always attempted (idempotent) so agent gets a stable link regardless.
    expect(spies.linkAssetToProject).toHaveBeenCalled();
  });
});
```

Add to the hoisted spies: `createOrDedupAsset`, `linkAssetToProject`, `getProjectOwner`. Mock `../services/asset-service.js` for `createOrDedupAsset`, `../services/asset-link-service.js` for `linkAssetToProject`, and figure out where `getProjectOwner` lives — likely a helper in `packages/api/src/services/` or reachable via a direct `db.select(projects.userId).from(projects).where(eq(projects.id, sid))`. If no helper exists, add one locally as a simple function in the route file.

- [ ] **Step 2: Run, expect RED**

- [ ] **Step 3: Implement**

Append to `packages/api/src/routes/internal-sandbox-assets.ts`:

```ts
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { projects } from '../db/schema.js';
import { createOrDedupAsset } from '../services/asset-service.js';
import { linkAssetToProject, type AddedVia } from '../services/asset-link-service.js';

async function getProjectOwner(projectId: string): Promise<string | null> {
  const [row] = await db.select({ userId: projects.userId }).from(projects).where(eq(projects.id, projectId));
  return row?.userId ?? null;
}

fastify.post<{
  Params: { sid: string };
  Body: {
    sha256: string;
    storageKey: string;
    filename: string;
    mimeType: string;
    fileSize: number;
    source: 'generated' | 'derived';
    parentAssetIds?: string[];
    label?: string;
  };
}>(
  '/internal/sandbox/:sid/asset/register',
  async (request, reply) => {
    const { sid } = request.params;
    if (!(await authGate(request, reply, sid))) return;

    const userId = await getProjectOwner(sid);
    if (!userId) return reply.code(404).send({ error: 'project_not_found' });

    const body = request.body;
    const result = await createOrDedupAsset({
      userId,
      sha256: body.sha256,
      storageKey: body.storageKey,
      filename: body.filename,
      mimeType: body.mimeType,
      fileSize: body.fileSize,
      source: body.source,
      parentAssetIds: body.parentAssetIds,
      label: body.label,
      projectIdForEvent: sid,
    });

    // Always (re)link — link service is idempotent via onConflictDoNothing.
    const addedVia: AddedVia = body.source === 'derived' ? 'generated' : 'generated';
    await linkAssetToProject({
      assetId: result.asset.id,
      projectId: sid,
      userId,
      addedVia,
    });

    return reply.send({ asset: result.asset, deduped: result.deduped });
  },
);
```

- [ ] **Step 4: Run, expect GREEN**

- [ ] **Step 5: Register the module in `packages/api/src/index.ts`** behind `ASSET_SYSTEM_V2`. Alongside the existing asset routes block:

```ts
import internalSandboxAssetsRoutes from './routes/internal-sandbox-assets.js';
// ...
if (config.featureFlags.assetSystemV2) {
  // ...existing route registrations...
  await fastify.register(internalSandboxAssetsRoutes);
}
```

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/routes/internal-sandbox-assets.ts packages/api/src/routes/internal-sandbox-assets.test.ts packages/api/src/index.ts
git commit -m "feat(api): POST /internal/sandbox/:sid/asset/register — sandbox-originated asset creation + auto-link"
```

---

## Task 4: Sandbox vitest config + first test

**Files:**
- Create: `packages/sandbox/vitest.config.ts`
- Modify: `packages/sandbox/package.json` — add `test` script + vitest devDep if missing

The sandbox package currently has no unit tests. Scaffold vitest so later tasks can drop `.test.ts` files.

- [ ] **Step 1: Check existing package.json**

Run: `cat packages/sandbox/package.json`
Note whether `vitest` is already a devDep and whether a `test` script exists.

- [ ] **Step 2: Install vitest if missing**

```bash
cd packages/sandbox && pnpm add -D vitest
```

Match the version used in `packages/api` and `packages/worker`. If the version is already pinned repo-wide via pnpm workspaces, no manual version pick needed.

- [ ] **Step 3: Create vitest.config.ts**

`packages/sandbox/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
  },
});
```

- [ ] **Step 4: Add `"test": "vitest run"` to `packages/sandbox/package.json` scripts block**

- [ ] **Step 5: Placeholder smoke test**

Create `packages/sandbox/src/smoke.test.ts` to prove the runner works:
```ts
import { describe, it, expect } from 'vitest';
describe('sandbox vitest setup', () => {
  it('runs', () => { expect(1 + 1).toBe(2); });
});
```

- [ ] **Step 6: Run**

`cd packages/sandbox && pnpm test`
Expected: 1 passing test.

- [ ] **Step 7: Commit**

```bash
git add packages/sandbox/vitest.config.ts packages/sandbox/package.json packages/sandbox/src/smoke.test.ts pnpm-lock.yaml
git commit -m "chore(sandbox): add vitest test runner + smoke test"
```

---

## Task 5: Sandbox — manifest fetcher

**Files:**
- Create: `packages/sandbox/src/assets/manifest.ts`
- Create: `packages/sandbox/src/assets/manifest.test.ts`

Fetches the assets manifest from the API and writes to `/workspace/assets-manifest.json`. Called during sandbox boot.

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const spies = vi.hoisted(() => ({
  fetch: vi.fn(),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

vi.stubGlobal('fetch', spies.fetch);
vi.mock('node:fs/promises', () => ({
  writeFile: spies.writeFile,
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

import { fetchAndWriteAssetsManifest } from './manifest.js';

beforeEach(() => { vi.clearAllMocks(); });

describe('fetchAndWriteAssetsManifest', () => {
  it('fetches from API with Bearer auth and writes the manifest to /workspace', async () => {
    spies.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        projectId: 'p-1',
        assets: [{ id: 'a-1', filename: 'hero.mp4', mimeType: 'video/mp4', sizeBytes: 1000 }],
      }),
    });

    await fetchAndWriteAssetsManifest({
      apiUrl: 'http://api:3000',
      sandboxId: 'p-1',
      secret: 's',
      workspaceRoot: '/workspace',
    });

    expect(spies.fetch).toHaveBeenCalledWith(
      'http://api:3000/internal/sandbox/p-1/assets-manifest',
      expect.objectContaining({
        headers: { authorization: 'Bearer s' },
      }),
    );
    expect(spies.writeFile).toHaveBeenCalledWith(
      '/workspace/assets-manifest.json',
      expect.stringContaining('"id":"a-1"'),
      'utf8',
    );
  });

  it('throws when the API returns non-2xx', async () => {
    spies.fetch.mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'boom' });
    await expect(fetchAndWriteAssetsManifest({
      apiUrl: 'http://api:3000', sandboxId: 'p-1', secret: 's', workspaceRoot: '/workspace',
    })).rejects.toThrow(/500/);
    expect(spies.writeFile).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run, expect RED**

`cd packages/sandbox && pnpm test -- src/assets/manifest.test.ts`

- [ ] **Step 3: Implement**

```ts
import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';

export interface ManifestAsset {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  durationMs?: number;
  width?: number;
  height?: number;
  userIntent?: string;
  userDescription?: string;
  transcriptAssetId?: string | null;
}

export interface AssetsManifest {
  projectId: string;
  assets: ManifestAsset[];
  generatedAt: string;
}

export interface FetchManifestInput {
  apiUrl: string;
  sandboxId: string;
  secret: string;
  workspaceRoot: string;
}

export async function fetchAndWriteAssetsManifest(input: FetchManifestInput): Promise<AssetsManifest> {
  const url = `${input.apiUrl}/internal/sandbox/${input.sandboxId}/assets-manifest`;
  const res = await fetch(url, {
    headers: { authorization: `Bearer ${input.secret}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`assets-manifest fetch failed ${res.status}: ${body}`);
  }
  const manifest = (await res.json()) as AssetsManifest;

  const outPath = join(input.workspaceRoot, 'assets-manifest.json');
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(manifest, null, 2), 'utf8');

  return manifest;
}
```

- [ ] **Step 4: Run, expect GREEN**

- [ ] **Step 5: Commit**

```bash
git add packages/sandbox/src/assets/manifest.ts packages/sandbox/src/assets/manifest.test.ts
git commit -m "feat(sandbox): fetchAndWriteAssetsManifest — boot-time manifest hydration"
```

---

## Task 6: Sandbox — wire manifest fetch into workspace-init

**Files:**
- Modify: `packages/sandbox/src/workspace-init.ts`

Call the fetcher on initial boot (first-time init) if `ASSET_SYSTEM_V2=true`. On subsequent boots (checkpoint restore), re-fetch so new assets uploaded between sessions show up.

- [ ] **Step 1: Inspect current `initWorkspace` shape**

Read `packages/sandbox/src/workspace-init.ts` to find where `asset-sync.ts` is called today (per grounding: around line 531). The new call goes at a similar point, gated by the feature flag.

- [ ] **Step 2: Add a wrapper that toggles old vs new path**

Near the existing `syncAssets()` call site, add:

```ts
import { fetchAndWriteAssetsManifest } from './assets/manifest.js';

async function runAssetBootstrap() {
  const assetSystemV2 = process.env.ASSET_SYSTEM_V2 === 'true';
  if (assetSystemV2) {
    const apiUrl = process.env.API_CALLBACK_URL;
    const sandboxId = process.env.SANDBOX_ID;
    const secret = process.env.SANDBOX_SECRET;
    if (!apiUrl || !sandboxId || !secret) {
      logger.warn({ apiUrl: !!apiUrl, sandboxId: !!sandboxId, secret: !!secret },
        'assets-manifest env not set, skipping v2 bootstrap');
      return;
    }
    await fetchAndWriteAssetsManifest({
      apiUrl, sandboxId, secret,
      workspaceRoot: WORKSPACE,
    });
  } else {
    await syncAssets(/* existing args */);
  }
}
```

Replace the existing direct call to `syncAssets(...)` with `await runAssetBootstrap()`. Preserve the argument list that `syncAssets` currently takes.

- [ ] **Step 3: Manual smoke — start the sandbox locally with `ASSET_SYSTEM_V2=true` and verify `/workspace/assets-manifest.json` is written**

This step is a local verification — no automated test. Document the result in the commit message.

- [ ] **Step 4: Commit**

```bash
git add packages/sandbox/src/workspace-init.ts
git commit -m "feat(sandbox): gate asset-bootstrap on ASSET_SYSTEM_V2 — manifest fetch or legacy asset-sync"
```

---

## Task 7: Sandbox — `read_asset` MCP tool

**Files:**
- Create: `packages/sandbox/src/tools/read-asset.ts`
- Create: `packages/sandbox/src/tools/read-asset.test.ts`

Given an asset id, downloads (if not cached) to `/workspace/assets/{id}/{filename}` and returns the local path. The filename comes from the manifest, which the tool reads from `/workspace/assets-manifest.json`.

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Readable } from 'node:stream';

const spies = vi.hoisted(() => ({
  fetch: vi.fn(),
  access: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
  createWriteStream: vi.fn(),
  pipeline: vi.fn().mockResolvedValue(undefined),
}));

vi.stubGlobal('fetch', spies.fetch);
vi.mock('node:fs/promises', () => ({
  access: spies.access,
  readFile: spies.readFile,
  writeFile: spies.writeFile,
  mkdir: spies.mkdir,
}));
vi.mock('node:fs', () => ({ createWriteStream: spies.createWriteStream }));
vi.mock('node:stream/promises', () => ({ pipeline: spies.pipeline }));

import { readAssetTool } from './read-asset.js';

beforeEach(() => { vi.clearAllMocks(); });

describe('readAssetTool', () => {
  it('returns the cached path when the file is already on disk', async () => {
    spies.readFile.mockResolvedValueOnce(JSON.stringify({
      projectId: 'p-1',
      assets: [{ id: 'a-1', filename: 'hero.mp4', mimeType: 'video/mp4', sizeBytes: 1000 }],
    }));
    spies.access.mockResolvedValueOnce(undefined);  // file exists

    const res = await readAssetTool.execute({ id: 'a-1' });
    expect(res).toContain('/workspace/assets/a-1/hero.mp4');
    expect(spies.fetch).not.toHaveBeenCalled();
  });

  it('streams from API and writes to disk on cache miss', async () => {
    spies.readFile.mockResolvedValueOnce(JSON.stringify({
      projectId: 'p-1',
      assets: [{ id: 'a-1', filename: 'hero.mp4', mimeType: 'video/mp4', sizeBytes: 1000 }],
    }));
    spies.access.mockRejectedValueOnce(new Error('ENOENT'));
    const body = Readable.from([Buffer.from('abc')]);
    spies.fetch.mockResolvedValueOnce({ ok: true, body });
    spies.createWriteStream.mockReturnValueOnce({});

    const res = await readAssetTool.execute({ id: 'a-1' });
    expect(spies.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/internal/sandbox/p-1/asset/a-1/stream'),
      expect.any(Object),
    );
    expect(spies.pipeline).toHaveBeenCalled();
    expect(res).toContain('/workspace/assets/a-1/hero.mp4');
  });

  it('returns an error string if the asset id is not in the manifest', async () => {
    spies.readFile.mockResolvedValueOnce(JSON.stringify({
      projectId: 'p-1', assets: [],
    }));
    const res = await readAssetTool.execute({ id: 'unknown' });
    expect(res.toLowerCase()).toContain('not found');
  });
});
```

- [ ] **Step 2: Run, expect RED**

`cd packages/sandbox && pnpm test -- src/tools/read-asset.test.ts`

- [ ] **Step 3: Implement**

```ts
import { access, readFile, mkdir } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { join } from 'node:path';
import type { AssetsManifest } from '../assets/manifest.js';

const WORKSPACE = process.env.WORKSPACE_DIR ?? '/workspace';

async function loadManifest(): Promise<AssetsManifest> {
  const raw = await readFile(join(WORKSPACE, 'assets-manifest.json'), 'utf8');
  return JSON.parse(raw) as AssetsManifest;
}

async function fileExists(p: string): Promise<boolean> {
  try { await access(p); return true; } catch { return false; }
}

export const readAssetTool = {
  name: 'read_asset',
  description:
    'Download an asset to the local workspace and return its path. Uses a disk cache at /workspace/assets/{id}/{filename} — call is idempotent.',
  input_schema: {
    type: 'object' as const,
    properties: {
      id: { type: 'string', description: 'Asset id from assets-manifest.json' },
    },
    required: ['id'],
  },
  async execute(input: { id: string }): Promise<string> {
    const manifest = await loadManifest();
    const entry = manifest.assets.find((a) => a.id === input.id);
    if (!entry) return `ERROR: asset ${input.id} not found in assets-manifest.json`;

    const dir = join(WORKSPACE, 'assets', entry.id);
    const path = join(dir, entry.filename);
    if (await fileExists(path)) return path;

    await mkdir(dir, { recursive: true });
    const apiUrl = process.env.API_CALLBACK_URL;
    const secret = process.env.SANDBOX_SECRET;
    const sandboxId = process.env.SANDBOX_ID;
    if (!apiUrl || !secret || !sandboxId) {
      return 'ERROR: sandbox env vars missing (API_CALLBACK_URL, SANDBOX_SECRET, SANDBOX_ID)';
    }

    const res = await fetch(
      `${apiUrl}/internal/sandbox/${sandboxId}/asset/${entry.id}/stream`,
      { headers: { authorization: `Bearer ${secret}` } },
    );
    if (!res.ok || !res.body) {
      return `ERROR: asset stream failed ${res.status}`;
    }
    const readable = res.body as unknown as Readable;
    await pipeline(readable, createWriteStream(path));
    return path;
  },
};
```

- [ ] **Step 4: Run, expect GREEN**

- [ ] **Step 5: Commit**

```bash
git add packages/sandbox/src/tools/read-asset.ts packages/sandbox/src/tools/read-asset.test.ts
git commit -m "feat(sandbox): read_asset MCP tool — lazy download + disk cache"
```

---

## Task 8: Sandbox — `register_asset` MCP tool

**Files:**
- Create: `packages/sandbox/src/tools/register-asset.ts`
- Create: `packages/sandbox/src/tools/register-asset.test.ts`

Given a local path inside `/workspace`, hash + upload to MinIO, then POST to the internal register endpoint. Returns the new asset id.

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const spies = vi.hoisted(() => ({
  readFile: vi.fn(),
  stat: vi.fn(),
  putObject: vi.fn(),
  fetch: vi.fn(),
}));

vi.stubGlobal('fetch', spies.fetch);
vi.mock('node:fs/promises', () => ({
  readFile: spies.readFile,
  stat: spies.stat,
}));
vi.mock('../services/minio.js', () => ({
  minioClient: { putObject: spies.putObject },
  getBucket: () => 'viona',
}));

import { registerAssetTool } from './register-asset.js';

beforeEach(() => { vi.clearAllMocks(); });

describe('registerAssetTool', () => {
  it('hashes the file, uploads to MinIO, and calls the register endpoint', async () => {
    spies.readFile.mockResolvedValueOnce(Buffer.from('content'));
    spies.stat.mockResolvedValueOnce({ size: 7 });
    spies.putObject.mockResolvedValueOnce(undefined);
    spies.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ asset: { id: 'a-new' }, deduped: false }),
    });

    const res = await registerAssetTool.execute({
      localPath: '/workspace/output/render.mp4',
      kind: 'generated',
      parentAssetIds: ['a-parent'],
      label: 'My render',
    });

    expect(spies.putObject).toHaveBeenCalled();
    expect(spies.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/asset/register'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ authorization: expect.stringContaining('Bearer') }),
      }),
    );
    expect(res).toContain('a-new');
  });

  it('returns an error string when the local file does not exist', async () => {
    spies.readFile.mockRejectedValueOnce(new Error('ENOENT'));
    const res = await registerAssetTool.execute({
      localPath: '/workspace/missing.mp4', kind: 'generated',
    });
    expect(res.toLowerCase()).toContain('error');
  });
});
```

Check whether `packages/sandbox/` has access to a MinIO client. The sandbox's existing `asset-sync.ts` uses one (lines 1–30 of that file) — reuse the same client construction pattern, likely via `packages/sandbox/src/minio.ts` or inline in `asset-sync.ts`. If the MinIO client is only constructed inline there, extract it to a small shared module `packages/sandbox/src/minio.ts` as part of this task.

- [ ] **Step 2: Run, expect RED**

- [ ] **Step 3: Implement**

```ts
import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { basename, extname } from 'node:path';
import { minioClient, getBucket } from '../minio.js';

type RegisterKind = 'generated' | 'derived';

export const registerAssetTool = {
  name: 'register_asset',
  description:
    'Upload a file from the sandbox workspace to storage and register it as a first-class asset linked to the current project. Returns the new asset id.',
  input_schema: {
    type: 'object' as const,
    properties: {
      localPath: { type: 'string', description: 'Absolute path inside /workspace' },
      kind: { type: 'string', enum: ['generated', 'derived'] },
      parentAssetIds: { type: 'array', items: { type: 'string' } },
      label: { type: 'string' },
      mimeType: { type: 'string', description: 'Optional — inferred from extension if omitted' },
    },
    required: ['localPath', 'kind'],
  },
  async execute(input: {
    localPath: string; kind: RegisterKind;
    parentAssetIds?: string[]; label?: string; mimeType?: string;
  }): Promise<string> {
    let bytes: Buffer;
    try {
      bytes = await readFile(input.localPath);
    } catch (err) {
      return `ERROR reading ${input.localPath}: ${(err as Error).message}`;
    }

    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const filename = basename(input.localPath);
    const info = await stat(input.localPath);
    const mimeType = input.mimeType ?? inferMimeType(filename);

    const sandboxId = process.env.SANDBOX_ID!;
    const apiUrl = process.env.API_CALLBACK_URL!;
    const secret = process.env.SANDBOX_SECRET!;
    const storageKey = `sandbox/${sandboxId}/assets/${sha256}/${filename}`;

    await minioClient.putObject(getBucket(), storageKey, bytes, bytes.length, {
      'Content-Type': mimeType,
    });

    const res = await fetch(`${apiUrl}/internal/sandbox/${sandboxId}/asset/register`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({
        sha256,
        storageKey,
        filename,
        mimeType,
        fileSize: info.size,
        source: input.kind,
        parentAssetIds: input.parentAssetIds,
        label: input.label,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      return `ERROR register ${res.status}: ${body}`;
    }
    const data = (await res.json()) as { asset: { id: string }; deduped: boolean };
    return `OK assetId=${data.asset.id} deduped=${data.deduped}`;
  },
};

function inferMimeType(filename: string): string {
  const ext = extname(filename).toLowerCase();
  const map: Record<string, string> = {
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.webm': 'video/webm',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.json': 'application/json',
    '.txt': 'text/plain',
  };
  return map[ext] ?? 'application/octet-stream';
}
```

**Inspect `packages/sandbox/src/asset-sync.ts`** for the actual MinIO client construction + bucket accessor. If there's no `packages/sandbox/src/minio.ts`, extract it from asset-sync.ts as a small shared module in this task. Otherwise import from wherever the existing one lives.

- [ ] **Step 4: Run, expect GREEN**

- [ ] **Step 5: Commit**

```bash
git add packages/sandbox/src/tools/register-asset.ts packages/sandbox/src/tools/register-asset.test.ts
# include the extracted minio helper if you created one:
git add packages/sandbox/src/minio.ts 2>/dev/null || true
git commit -m "feat(sandbox): register_asset MCP tool — hash, upload, register with auto-link"
```

---

## Task 9: Sandbox — wire tools into mcp-servers

**Files:**
- Modify: `packages/sandbox/src/mcp-servers.ts`

Add the two new tools to the MCP server graph. Per grounding: `mcp-servers.ts` has 7 existing servers with `wrapTool()` + `createSdkMcpServer`. Add an 8th `assetsServer` that bundles `read_asset` + `register_asset`.

- [ ] **Step 1: Inspect existing `createMcpServers()`**

Look at how servers are composed around lines 91–205. Each server is `createSdkMcpServer({ name, version, tools: [wrapTool(xTool), wrapTool(yTool)] })`.

- [ ] **Step 2: Add the assets server**

At the bottom of `createMcpServers()`:

```ts
import { readAssetTool } from './tools/read-asset.js';
import { registerAssetTool } from './tools/register-asset.js';

const assetsServer = createSdkMcpServer({
  name: 'assets',
  version: '1.0.0',
  tools: [
    wrapTool(readAssetTool),
    wrapTool(registerAssetTool),
  ],
});
```

And include it in the returned object:

```ts
return {
  manifest: manifestServer,
  scenes: scenesServer,
  render: renderServer,
  widgets: widgetsServer,
  analysis: analysisServer,
  templates: templatesServer,
  inference: inferenceServer,
  assets: assetsServer,  // NEW
};
```

Gate the entire assets server behind the feature flag if the sandbox has visibility into `ASSET_SYSTEM_V2`:

```ts
const assetsEnabled = process.env.ASSET_SYSTEM_V2 === 'true';
// ...
return {
  // ...
  ...(assetsEnabled ? { assets: assetsServer } : {}),
};
```

- [ ] **Step 3: Verify query-session picks up the new server**

Read `packages/sandbox/src/query-session.ts` — it should consume the object returned by `createMcpServers()` and pass it to the Claude SDK query options. No edit needed if that file iterates all keys; if it has a hardcoded list, extend it.

- [ ] **Step 4: Typecheck**

`pnpm --filter @viona/sandbox typecheck`
Expected: clean (other packages may retain their baseline errors — don't fix unrelated ones).

- [ ] **Step 5: Commit**

```bash
git add packages/sandbox/src/mcp-servers.ts packages/sandbox/src/query-session.ts
git commit -m "feat(sandbox): wire read_asset + register_asset into MCP server graph (assetsServer)"
```

Stage query-session.ts only if you actually changed it.

---

## Task 10: Deprecate `asset-sync.ts` under the flag

**Files:**
- Modify: `packages/sandbox/src/asset-sync.ts`

Short-circuit the sync loop when `ASSET_SYSTEM_V2=true`. Keep the file so legacy projects (flag off) still work.

- [ ] **Step 1: Modify the top of `syncAssets()`**

At the start of the function body (inside `packages/sandbox/src/asset-sync.ts`):

```ts
if (process.env.ASSET_SYSTEM_V2 === 'true') {
  logger.info('ASSET_SYSTEM_V2 active — asset-sync directory-sweep disabled; manifest hydration handles it');
  return;
}
```

Place it before the directory walk starts (around line 67 per grounding). Keep the rest of the function untouched so flag-off boots behave identically.

- [ ] **Step 2: Manual verification**

With `ASSET_SYSTEM_V2=false` (or unset), boot a sandbox and confirm asset-sync runs as before (logs "Syncing assets..." or similar).

With `ASSET_SYSTEM_V2=true`, boot and confirm:
- `asset-sync.ts` early-returns (log message visible)
- `/workspace/assets-manifest.json` exists (from Task 6's `fetchAndWriteAssetsManifest`)

- [ ] **Step 3: Commit**

```bash
git add packages/sandbox/src/asset-sync.ts
git commit -m "chore(sandbox): asset-sync.ts no-ops when ASSET_SYSTEM_V2=true"
```

---

## Task 11: Final typecheck + test baseline

- [ ] **Step 1: Typecheck**

`pnpm typecheck` across the monorepo.

Baseline (preserve, do NOT fix):
- `packages/api/src/sandbox/proxy.ts:583`
- `packages/api/src/sandbox/routes.ts:503`
- `packages/worker/src/processors/generate-caption-styles.ts:246`

If any NEW errors appear in code touched by PR-B, fix them and commit:
```bash
git commit -m "chore: typecheck + test baseline clean for sandbox-asset-integration scope"
```

- [ ] **Step 2: Run all test suites**

```bash
cd packages/api && pnpm test
cd ../worker && pnpm test
cd ../sandbox && pnpm test
```

All three must pass. Record counts.

- [ ] **Step 3: Summary report**

| Package | Typecheck | Test files | Tests passing | Tests failing |
|---|---|---|---|---|
| @viona/api | baseline only | N | M | 0 |
| @viona/worker | baseline only | N | M | 0 |
| @viona/sandbox | clean | N | M | 0 |

Plus PR-B commit list via `git log --oneline <first-pr-b-sha>^..HEAD`.

---

## Self-Review Checklist

**1. Spec coverage** (against §7.2 PR-B):
- ✅ `assets-manifest.json` generated at sandbox boot — Tasks 1 + 5 + 6.
- ✅ Hydration sidecar via lazy read-through cache — Task 7 (`read_asset` MCP tool is the sidecar; file-system mounting was explicitly deferred in the spec).
- ✅ MCP `read_asset` — Task 7.
- ✅ MCP `register_asset` — Task 8 + Task 3 API endpoint.
- ✅ Remove `asset-sync.ts` directory-sweep — Task 10 (gated, not deleted).
- ⛔ Tar working-dir state — already handled by `checkpoint.ts`; out of scope.

**2. Placeholder scan**: no `TBD`, `TODO` (except legitimate inline TODOs in emitted code that reference work explicitly deferred), no "fill in details". Task 6 has a local-smoke manual step (no automated test) because `workspace-init.ts` integration is hard to mock cleanly — that's intentional, flagged in the task body as manual.

**3. Type consistency**:
- `AssetsManifest` shape (from Task 5) matches what API returns (Task 1) — projectId, assets[], generatedAt.
- `read_asset` input `{ id: string }` — matches manifest entry id.
- `register_asset` input (`localPath`, `kind`, `parentAssetIds`, `label`) — matches the register endpoint body in Task 3.
- `source: 'generated' | 'derived'` is the same enum used by Task 3's endpoint body and by PR-A1's `createOrDedupAsset`.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-20-sandbox-asset-integration.md`. Two execution options:

**1. Subagent-Driven (recommended)** — continues the pattern from PR-A1 and PR-A2. Spec + code-quality review between each task.

**2. Inline Execution** — batch execution with checkpoints.

Which approach?
