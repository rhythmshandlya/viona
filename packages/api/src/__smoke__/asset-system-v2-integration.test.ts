/**
 * asset-system-v2 integration smoke test (§6.8 Phase 1+2 critical path)
 *
 * Goal: exercise the end-to-end asset ingest → link → list → arrangement flow
 * through REAL service code (`asset-service`, `asset-link-service`,
 * `asset-events`, `pipeline-messages`, `project-assets` + `arrangement` route
 * ownership checks) against a real Postgres DB, with only the
 * _infrastructure_ (MinIO, BullMQ queue, Redis pub/sub, arrangement
 * orchestrator, Stytch auth) mocked.
 *
 * Catches inter-PR integration bugs that per-task unit tests miss — wrong
 * channel name, endpoint path mismatch, event-type union drift, cross-service
 * wiring regressions.
 *
 * Opt-in: gated behind `ASSET_INTEGRATION_TEST=1`. Normal `pnpm test` runs
 * skip the suite entirely, so CI without a Postgres stays green. Mirrors the
 * pattern of `asset-ingest-smoke.test.ts` (PR-A1 Task 14) but uses
 * `app.inject()` instead of `fetch()` so no live server process is needed —
 * just a reachable Postgres pointed at by `DATABASE_URL`.
 *
 * Approach: Option A (real Postgres). Before running, ensure migrations are
 * applied against the target DB (`pnpm -F @viona/api db:migrate`).
 *
 *   ASSET_INTEGRATION_TEST=1 DATABASE_URL=postgresql://viona:viona123@localhost:5432/viona \
 *     pnpm -F @viona/api test -- src/__smoke__/asset-system-v2-integration.test.ts
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { createHash, randomUUID } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';

// ---------------------------------------------------------------------------
// Infrastructure mocks — registered BEFORE importing routes / services so
// hoisted vi.mock() rewrites the import graph as it's loaded.
// ---------------------------------------------------------------------------

const spies = vi.hoisted(() => ({
  presignMultipart: vi.fn(),
  presignDownload: vi.fn(),
  queueAssetMetadata: vi.fn().mockResolvedValue(undefined),
  redisPublish: vi.fn().mockResolvedValue(1),
  redisDuplicate: vi.fn(),
  computeArrangement: vi.fn(),
}));

// MinIO helpers — presigned URL generation must not hit a real S3.
vi.mock('../services/minio.js', () => ({
  getPresignedMultipartUploadUrls: (...a: unknown[]) => spies.presignMultipart(...a),
  getPresignedDownloadUrl: (...a: unknown[]) => spies.presignDownload(...a),
}));

// BullMQ queue producer for asset-metadata. We only verify it's called with
// the right shape; the actual Redis/queue insertion is out of scope.
vi.mock('../services/queue.js', () => ({
  queueAssetMetadataJob: (...a: unknown[]) => spies.queueAssetMetadata(...a),
}));

// Redis client used by asset-events + asset-events-sse. `publish` is what
// emitAssetEvent calls; `duplicate` is what the SSE route calls.
vi.mock('../services/redis.js', () => {
  const fakeRedis = {
    publish: (...a: unknown[]) => spies.redisPublish(...a),
    duplicate: () => spies.redisDuplicate(),
  };
  return {
    redis: fakeRedis,
    getRedis: () => fakeRedis,
    getRedisSubscriber: () => spies.redisDuplicate(),
  };
});

// Arrangement orchestrator runs the Claude Agent SDK — fully mock, the point
// of this test is route wiring + ownership, not the agent itself.
vi.mock('../services/arrangement-orchestrator.js', () => ({
  computeArrangement: (...a: unknown[]) => spies.computeArrangement(...a),
}));

// Header-driven fake auth middleware: sets request.user from x-test-user-id.
// Real Stytch path is untestable in-process. Both the assets and
// project-assets routes addHook('preHandler', authMiddleware), so this single
// mock covers them all.
vi.mock('../middleware/auth.js', () => ({
  authMiddleware: async (req: {
    headers: Record<string, string | undefined>;
    user?: { id: string };
  }, reply: { code: (n: number) => { send: (b: unknown) => unknown } }) => {
    const userId = req.headers['x-test-user-id'];
    if (!userId) {
      return reply.code(401).send({ error: 'no_test_user' });
    }
    req.user = { id: userId };
  },
  optionalAuthMiddleware: async (req: {
    headers: Record<string, string | undefined>;
    user?: { id: string };
  }) => {
    const userId = req.headers['x-test-user-id'];
    if (userId) req.user = { id: userId };
  },
  getDevBypassUser: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Real imports — these pull in the production code paths we want to exercise.
// ---------------------------------------------------------------------------
import assetRoutes from '../routes/assets.js';
import projectAssetRoutes from '../routes/project-assets.js';
import arrangementRoutes from '../routes/arrangement.js';
import compositionRoutes from '../routes/composition.js';
import { db } from '../db/index.js';
import {
  projects,
  users,
  assets,
  assetProjectLinks,
  assetEvents,
  tracks,
  timelineItems,
} from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { insertPipelineMessage } from '../services/pipeline-messages.js';

const enabled = process.env.ASSET_INTEGRATION_TEST === '1';

// ---------------------------------------------------------------------------
// Mock the agent conversation store for the pipeline-messages smoke check.
// The pipeline-messages service itself is real; only its downstream
// addMessage dependency is stubbed (it writes to the conversations table
// which isn't the focus here).
// ---------------------------------------------------------------------------
vi.mock('../agent/conversation-store.js', () => ({
  addMessage: vi.fn().mockResolvedValue({
    id: 'mock-message-id',
    conversationId: 'mock-convo-id',
    role: 'pipeline',
    content: [],
  }),
  getOrCreateConversation: vi.fn(),
}));

describe.skipIf(!enabled)('asset-system-v2 integration (§6.8 Phase 1+2)', () => {
  let app: FastifyInstance;
  let ownerId: string;
  let otherId: string;
  let ownerProjectId: string;
  let otherProjectId: string;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(assetRoutes);
    await app.register(projectAssetRoutes);
    await app.register(arrangementRoutes);
    // composition-v2 route lives under /api prefix — matches production mount
    // and lets us assert the full `/api/projects/:id/composition-v2` path.
    await app.register(compositionRoutes, { prefix: '/api' });
    await app.ready();

    // Seed two users + one project each. Using real inserts so foreign-key
    // constraints and cascade semantics are actually exercised.
    const suffix = Date.now().toString(36);
    const [owner] = await db
      .insert(users)
      .values({
        stytchUserId: `integ-owner-${suffix}`,
        email: `integ-owner-${suffix}@test.local`,
        name: 'Integration Owner',
      })
      .returning();
    const [other] = await db
      .insert(users)
      .values({
        stytchUserId: `integ-other-${suffix}`,
        email: `integ-other-${suffix}@test.local`,
        name: 'Integration Other',
      })
      .returning();
    ownerId = owner.id;
    otherId = other.id;

    const [ownerProject] = await db
      .insert(projects)
      .values({ userId: ownerId, title: `integ-owner-project-${suffix}` })
      .returning();
    const [otherProject] = await db
      .insert(projects)
      .values({ userId: otherId, title: `integ-other-project-${suffix}` })
      .returning();
    ownerProjectId = ownerProject.id;
    otherProjectId = otherProject.id;
  });

  afterAll(async () => {
    // Best-effort cleanup. cascade on asset_project_links → projects covers
    // links; we still nuke the asset + event rows explicitly because they
    // aren't tied to the project via FK.
    try {
      await db.delete(assetEvents).where(eq(assetEvents.userId, ownerId));
      await db.delete(assetEvents).where(eq(assetEvents.userId, otherId));
      await db.delete(assetProjectLinks).where(eq(assetProjectLinks.projectId, ownerProjectId));
      await db.delete(assetProjectLinks).where(eq(assetProjectLinks.projectId, otherProjectId));
      // tracks → timeline_items cascade on delete; projects → tracks cascade
      // on delete, so deleting projects below would also sweep these. Explicit
      // cleanup still runs first in case project delete fails partway.
      await db.delete(tracks).where(eq(tracks.projectId, ownerProjectId));
      await db.delete(tracks).where(eq(tracks.projectId, otherProjectId));
      await db.delete(assets).where(eq(assets.userId, ownerId));
      await db.delete(assets).where(eq(assets.userId, otherId));
      await db.delete(projects).where(eq(projects.id, ownerProjectId));
      await db.delete(projects).where(eq(projects.id, otherProjectId));
      await db.delete(users).where(eq(users.id, ownerId));
      await db.delete(users).where(eq(users.id, otherId));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[integration-smoke] cleanup error (non-fatal):', err);
    }
    await app.close();
  });

  beforeEach(() => {
    spies.presignMultipart.mockReset();
    spies.presignDownload.mockReset();
    spies.queueAssetMetadata.mockClear();
    spies.redisPublish.mockClear().mockResolvedValue(1);
    spies.computeArrangement.mockReset();
  });

  // Shared state mutated across tests in sequence — each scenario builds on
  // the previous one, matching the real client flow.
  const sharedContent = Buffer.from('integration-smoke-content-' + Math.random());
  const sha256 = createHash('sha256').update(sharedContent).digest('hex');
  let storageKey: string;
  let registeredAssetId: string;

  // ──────────────────────────────────────────────────────────────────────
  // Scenario 1: POST /assets/upload-urls returns storageKey under
  //             users/{userId}/assets/pending/ + mocked multipart URLs.
  // ──────────────────────────────────────────────────────────────────────
  it('1. POST /assets/upload-urls returns user-scoped pending storageKey', async () => {
    spies.presignMultipart.mockResolvedValueOnce({
      uploadId: 'mp-1',
      partUrls: [{ partNumber: 1, url: 'https://s3.mock/put' }],
      expiresAt: new Date(Date.now() + 3600_000),
    });
    const res = await app.inject({
      method: 'POST',
      url: '/assets/upload-urls',
      headers: { 'x-test-user-id': ownerId },
      payload: {
        filename: 'hero.mp4',
        mimeType: 'video/mp4',
        fileSize: sharedContent.length,
        partCount: 1,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.uploadId).toBe('mp-1');
    expect(body.partUrls).toHaveLength(1);
    expect(body.storageKey).toMatch(
      new RegExp(`^users/${ownerId}/assets/pending/[^/]+/hero\\.mp4$`),
    );
    storageKey = body.storageKey;
  });

  // ──────────────────────────────────────────────────────────────────────
  // Scenario 2: POST /assets/register inserts assets + asset_project_links
  //             rows (B1) and enqueues metadata job.
  // ──────────────────────────────────────────────────────────────────────
  it('2. POST /assets/register creates asset + auto-link (B1) + enqueues metadata', async () => {
    expect(storageKey).toBeDefined(); // chained from scenario 1
    const res = await app.inject({
      method: 'POST',
      url: '/assets/register',
      headers: { 'x-test-user-id': ownerId },
      payload: {
        storageKey,
        sha256,
        filename: 'hero.mp4',
        mimeType: 'video/mp4',
        fileSize: sharedContent.length,
        source: 'upload',
        projectId: ownerProjectId,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.deduped).toBe(false);
    expect(body.asset.id).toBeDefined();
    expect(body.asset.status).toBe('ready');
    expect(body.asset.userId).toBe(ownerId);
    registeredAssetId = body.asset.id;

    // B1: auto-link row present in asset_project_links.
    const [link] = await db
      .select()
      .from(assetProjectLinks)
      .where(eq(assetProjectLinks.assetId, registeredAssetId));
    expect(link).toBeDefined();
    expect(link.projectId).toBe(ownerProjectId);
    expect(link.addedVia).toBe('upload');

    // Metadata job enqueued exactly once with the new asset id.
    expect(spies.queueAssetMetadata).toHaveBeenCalledTimes(1);
    expect(spies.queueAssetMetadata).toHaveBeenCalledWith({
      assetId: registeredAssetId,
    });

    // Created event landed in asset_events AND was published to Redis on
    // BOTH user and project channels.
    const events = await db
      .select()
      .from(assetEvents)
      .where(eq(assetEvents.assetId, registeredAssetId));
    expect(events.some((e) => e.type === 'created')).toBe(true);
    expect(events.some((e) => e.type === 'linked')).toBe(true);
    const channels = spies.redisPublish.mock.calls.map((c) => c[0] as string);
    expect(channels).toContain(`asset-events:${ownerId}`);
    expect(channels).toContain(`asset-events:project:${ownerProjectId}`);
  });

  // ──────────────────────────────────────────────────────────────────────
  // Scenario 3: GET /assets returns the new asset.
  // ──────────────────────────────────────────────────────────────────────
  it('3. GET /assets returns the registered asset for its owner', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/assets',
      headers: { 'x-test-user-id': ownerId },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.assets)).toBe(true);
    expect(body.assets.some((a: { id: string }) => a.id === registeredAssetId)).toBe(true);
  });

  // ──────────────────────────────────────────────────────────────────────
  // Scenario 4: GET /projects/:id/assets by OWNER → includes the new asset.
  // ──────────────────────────────────────────────────────────────────────
  it('4. GET /projects/:id/assets returns linked asset for project owner (S3)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/projects/${ownerProjectId}/assets`,
      headers: { 'x-test-user-id': ownerId },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.assets.some((a: { id: string }) => a.id === registeredAssetId)).toBe(true);
  });

  // ──────────────────────────────────────────────────────────────────────
  // Scenario 5: GET /projects/:id/assets by NON-owner → 403 (S3).
  // ──────────────────────────────────────────────────────────────────────
  it('5. GET /projects/:id/assets by non-owner returns 403 (S3)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/projects/${ownerProjectId}/assets`,
      headers: { 'x-test-user-id': otherId },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: 'forbidden' });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Scenario 6: POST /projects/:id/arrangement/compute by OWNER → delegates
  //             to orchestrator (mocked).
  // ──────────────────────────────────────────────────────────────────────
  it('6. POST /projects/:id/arrangement/compute by owner invokes orchestrator', async () => {
    spies.computeArrangement.mockResolvedValueOnce({
      timelineItems: [{ assetId: registeredAssetId, trackIndex: 0, startMs: 0, durationMs: 3000 }],
      summary: 'ok',
    });
    const res = await app.inject({
      method: 'POST',
      url: `/projects/${ownerProjectId}/arrangement/compute`,
      headers: { 'x-test-user-id': ownerId },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().summary).toBe('ok');
    expect(spies.computeArrangement).toHaveBeenCalledWith(ownerProjectId);
  });

  // ──────────────────────────────────────────────────────────────────────
  // Scenario 7: POST /projects/:id/arrangement/compute by NON-owner → 403 (S2).
  // ──────────────────────────────────────────────────────────────────────
  it('7. POST /projects/:id/arrangement/compute by non-owner returns 403 (S2)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/projects/${ownerProjectId}/arrangement/compute`,
      headers: { 'x-test-user-id': otherId },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: 'forbidden' });
    expect(spies.computeArrangement).not.toHaveBeenCalled();
  });

  // ──────────────────────────────────────────────────────────────────────
  // Scenario 8: POST /assets/register with storageKey for a DIFFERENT user
  //             → 400 invalid_storage_key (S1).
  // ──────────────────────────────────────────────────────────────────────
  it('8. POST /assets/register rejects cross-user storageKey with 400 (S1)', async () => {
    const victimKey = `users/${otherId}/assets/pending/${randomUUID()}/x.mp4`;
    const res = await app.inject({
      method: 'POST',
      url: '/assets/register',
      headers: { 'x-test-user-id': ownerId },
      payload: {
        storageKey: victimKey, // owner-scoped caller tries to claim other's staged upload
        sha256: createHash('sha256').update('different').digest('hex'),
        filename: 'x.mp4',
        mimeType: 'video/mp4',
        fileSize: 1,
        source: 'upload',
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'invalid_storage_key' });
    expect(spies.queueAssetMetadata).not.toHaveBeenCalled();
  });

  // ──────────────────────────────────────────────────────────────────────
  // Scenario 9: POST /assets/upload-urls with partCount=10001 → 400 (S4).
  // ──────────────────────────────────────────────────────────────────────
  it('9. POST /assets/upload-urls rejects partCount > 10000 with 400 (S4)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/assets/upload-urls',
      headers: { 'x-test-user-id': ownerId },
      payload: {
        filename: 'huge.mp4',
        mimeType: 'video/mp4',
        fileSize: 999_999_999_999,
        partCount: 10001,
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'invalid_upload_request' });
    expect(spies.presignMultipart).not.toHaveBeenCalled();
  });

  // ──────────────────────────────────────────────────────────────────────
  // Smoke-only: asset_events SSE endpoint opens under bearer auth without
  // 500-ing. Uses a mocked redis.duplicate that returns a minimal
  // subscriber shim — we do NOT assert on message flow here.
  // ──────────────────────────────────────────────────────────────────────
  it('SSE smoke: GET /asset-events opens without 500 under bearer auth', async () => {
    // Build a tiny subscriber shim that the SSE route uses. We await
    // `subscribe` completing so we know the handler got past auth + into
    // the pub/sub setup without throwing.
    let subscribeResolved: () => void;
    const subscribedOnce = new Promise<void>((r) => { subscribeResolved = r; });
    const subscriberShim = {
      subscribe: vi.fn().mockImplementation(async () => {
        subscribeResolved();
      }),
      unsubscribe: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      disconnect: vi.fn(),
    };
    spies.redisDuplicate.mockReturnValue(subscriberShim);

    const assetEventsSseRoutes = (await import('../routes/asset-events-sse.js')).default;
    const sseApp = Fastify({ logger: false });
    await sseApp.register(assetEventsSseRoutes);
    await sseApp.ready();

    // Don't await the inject promise — SSE keeps the stream open forever.
    // We only need to verify the handler makes it past auth and subscribes
    // to the right Redis channel. Close the app to tear down the stream.
    void sseApp.inject({
      method: 'GET',
      url: '/asset-events',
      headers: { 'x-test-user-id': ownerId },
    }).catch(() => {/* stream closed on app.close() */});

    await subscribedOnce;
    expect(subscriberShim.subscribe).toHaveBeenCalledWith(`asset-events:${ownerId}`);
    await sseApp.close();
  }, 2000);

  // ──────────────────────────────────────────────────────────────────────
  // Smoke-only: insertPipelineMessage lands a row in the mocked conversation
  // store AND publishes to the Redis conversation channel.
  // ──────────────────────────────────────────────────────────────────────
  it('Pipeline message smoke: insertPipelineMessage publishes to conversation channel', async () => {
    spies.redisPublish.mockClear();
    const result = await insertPipelineMessage({
      conversationId: 'convo-smoke',
      projectId: ownerProjectId,
      eventType: 'arranging',
      details: { smoke: true },
    });
    expect(result.id).toBe('mock-message-id');
    expect(spies.redisPublish).toHaveBeenCalledWith(
      `conversation:${ownerProjectId}`,
      expect.stringContaining('"eventType":"arranging"'),
    );
    const payload = spies.redisPublish.mock.calls[0][1] as string;
    expect(payload).toContain('"kind":"pipeline_message"');
  });

  // ──────────────────────────────────────────────────────────────────────
  // Scenario 12: GET /api/projects/:id/composition-v2 returns tracks +
  //              timelineItems + resolved asset URLs after arrangement-agent
  //              persists its output. Seeds the rows directly via drizzle
  //              since earlier scenarios already exercise the register flow.
  // ──────────────────────────────────────────────────────────────────────
  it('12. GET /api/projects/:id/composition-v2 returns tracks + items + resolved assets after arrangement persists', async () => {
    // Presigned URL generation for the seeded asset — the composition-loader
    // calls getPresignedDownloadUrl('uploads', storageKey, ttl) once per
    // unique asset, so a single mock return is enough.
    spies.presignDownload.mockResolvedValue('https://s3.mock/get/seed.mp4');

    const [seedAsset] = await db
      .insert(assets)
      .values({
        userId: ownerId,
        source: 'upload',
        status: 'ready',
        sha256: 'composition-seed-' + Date.now(),
        storageKey: `users/${ownerId}/assets/xyz/seed.mp4`,
        filename: 'seed.mp4',
        mimeType: 'video/mp4',
        fileSize: 1000,
        label: 'seed.mp4',
        durationMs: 3000,
        parentAssetIds: [],
        thumbnailStatus: 'not_applicable',
        waveformStatus: 'not_applicable',
        transcriptStatus: 'not_applicable',
      })
      .returning();

    // Seed a track + timelineItem simulating arrangement-agent output.
    const [seedTrack] = await db
      .insert(tracks)
      .values({
        projectId: ownerProjectId,
        type: 'video',
        name: 'Track 1',
        position: 0,
        locked: false,
        visible: true,
      })
      .returning();
    await db.insert(timelineItems).values({
      trackId: seedTrack.id,
      type: 'video',
      startMs: 0,
      endMs: 3000,
      data: {
        assetId: seedAsset.id,
        sourceStartMs: 0,
        sourceDurationMs: 3000,
        source: 'arrangement_agent',
      },
    });

    // Note: composition route is mounted under `/api` prefix per production
    // registration, so the inject URL must match.
    const res = await app.inject({
      method: 'GET',
      url: `/api/projects/${ownerProjectId}/composition-v2`,
      headers: { 'x-test-user-id': ownerId },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.tracks).toHaveLength(1);
    expect(body.tracks[0].id).toBe(seedTrack.id);
    expect(body.timelineItems).toHaveLength(1);
    expect(body.timelineItems[0].data).toMatchObject({
      assetId: seedAsset.id,
      source: 'arrangement_agent',
    });
    expect(body.assets[seedAsset.id]).toMatchObject({
      filename: 'seed.mp4',
      mimeType: 'video/mp4',
      durationMs: 3000,
      url: expect.stringContaining('http'),
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Scenario 13: GET /api/projects/:id/composition-v2 by non-owner → 403.
  // Confirms composition-v2 honors the same ownership gate the rest of
  // the project-scoped routes do.
  // ──────────────────────────────────────────────────────────────────────
  it('13. GET /api/projects/:id/composition-v2 returns 403 to non-owner', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/projects/${ownerProjectId}/composition-v2`,
      headers: { 'x-test-user-id': otherId },
    });
    expect(res.statusCode).toBe(403);
  });
});
