import { nanoid } from 'nanoid';
import type { FastifyPluginAsync } from 'fastify';
import { eq } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.js';
import {
  getPresignedMultipartUploadUrls,
  getPresignedDownloadUrl,
  getPresignedUploadUrl,
} from '../services/minio.js';
import {
  createOrDedupAsset,
  getAssetById,
  listUserAssets,
  updateAssetMetadata,
  softDeleteAsset,
  type AssetSource,
} from '../services/asset-service.js';
import { linkAssetToProject } from '../services/asset-link-service.js';
import { queueAssetMetadataJob } from '../services/queue.js';
import { db, projects } from '../db/index.js';

const UPLOAD_URL_TTL_SECONDS = 3600;
const ASSET_URL_TTL_SECONDS = 24 * 3600;

/**
 * Returns true iff the given user owns the given project.
 * Used to gate /assets/register when body.projectId is set, so one user
 * cannot attach their own asset to another user's project (M3).
 * Duplicates the inline helper in arrangement.ts / project-assets.ts /
 * composition.ts — extraction to a shared helper is cleanup-debt.
 */
async function requireProjectOwnership(projectId: string, userId: string): Promise<boolean> {
  const rows = await db
    .select({ userId: projects.userId })
    .from(projects)
    .where(eq(projects.id, projectId));
  if (rows.length === 0) return false;
  return rows[0].userId === userId;
}

const assetRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authMiddleware);

  fastify.post<{
    Body: {
      filename: string;
      mimeType: string;
      fileSize: number;
      partCount: number;
    };
  }>('/assets/upload-urls', async (request, reply) => {
    const { filename, mimeType, fileSize, partCount } = request.body ?? ({} as {
      filename?: string;
      mimeType?: string;
      fileSize?: number;
      partCount?: number;
    });
    if (
      !filename ||
      !mimeType ||
      typeof fileSize !== 'number' || fileSize <= 0 ||
      typeof partCount !== 'number' || partCount < 1 || partCount > 10000
    ) {
      return reply.code(400).send({ error: 'invalid_upload_request' });
    }
    const userId = request.user!.id;
    const stagingKey = `users/${userId}/assets/pending/${nanoid()}/${filename}`;

    // Single-part shortcut: use a plain presigned PUT. Multipart uploads
    // require a CompleteMultipartUpload call after the parts finish, which
    // the client isn't doing (and a 1-part multipart is pointless anyway —
    // no concurrency benefit, and parts stay uncommitted until complete).
    if (partCount === 1) {
      const url = await getPresignedUploadUrl('uploads', stagingKey, UPLOAD_URL_TTL_SECONDS);
      return reply.send({
        uploadId: '',
        partUrls: [{ partNumber: 1, url }],
        storageKey: stagingKey,
        expiresAt: new Date(Date.now() + UPLOAD_URL_TTL_SECONDS * 1000).toISOString(),
      });
    }

    const presigned = await getPresignedMultipartUploadUrls({
      prefix: 'uploads',
      key: stagingKey,
      partCount,
      expirySeconds: UPLOAD_URL_TTL_SECONDS,
    });
    return reply.send({
      uploadId: presigned.uploadId,
      partUrls: presigned.partUrls,
      storageKey: stagingKey,
      expiresAt: presigned.expiresAt.toISOString(),
    });
  });

  fastify.post<{
    Body: {
      storageKey: string;
      sha256: string;
      filename: string;
      mimeType: string;
      fileSize: number;
      source: AssetSource;
      userIntent?: string;
      parentAssetIds?: string[];
      projectId?: string;
    };
  }>('/assets/register', async (request, reply) => {
    const userId = request.user!.id;
    const body = request.body;
    if (!body?.sha256 || !body?.storageKey || !body?.filename) {
      return reply.code(400).send({ error: 'missing_required_fields' });
    }
    // S1: validate storageKey is scoped to the caller's pending prefix.
    // Prevents an attacker from claiming ownership of arbitrary S3 objects
    // and then generating presigned download URLs via /assets/:id/url.
    // Note: no leading "uploads/" — that prefix is applied internally by
    // minio helpers (see getPresignedDownloadUrl in services/minio.ts),
    // and /assets/upload-urls returns the raw key matching this shape.
    const expectedPrefix = `users/${userId}/assets/pending/`;
    if (!body.storageKey.startsWith(expectedPrefix)) {
      return reply.code(400).send({ error: 'invalid_storage_key' });
    }
    const afterPrefix = body.storageKey.slice(expectedPrefix.length);
    if (afterPrefix.split('/').length !== 2 || afterPrefix.includes('..')) {
      return reply.code(400).send({ error: 'invalid_storage_key' });
    }
    // M3: when a projectId is attached to the register, verify the caller
    // owns it before we insert an asset row or create a link — otherwise a
    // user could attach their asset to someone else's project (asset
    // pollution, unwanted tiles, wasted event fanout).
    if (body.projectId) {
      if (!(await requireProjectOwnership(body.projectId, userId))) {
        return reply.code(403).send({ error: 'forbidden' });
      }
    }
    const result = await createOrDedupAsset({
      userId,
      sha256: body.sha256,
      storageKey: body.storageKey,
      filename: body.filename,
      mimeType: body.mimeType,
      fileSize: body.fileSize,
      source: body.source,
      userIntent: body.userIntent,
      parentAssetIds: body.parentAssetIds,
      projectIdForEvent: body.projectId ?? null,
    });
    if (!result.deduped) {
      await queueAssetMetadataJob({ assetId: result.asset.id });
    }
    // B1: auto-link to project so the asset shows up in the Project tab,
    // arrangement fires, and the sandbox manifest isn't empty.
    // Idempotent (asset-link-service uses onConflictDoNothing).
    if (body.projectId) {
      const addedVia = body.source === 'chat' ? 'chat' : 'upload';
      await linkAssetToProject({
        assetId: result.asset.id,
        projectId: body.projectId,
        userId,
        addedVia,
      });
    }
    return reply.send({ asset: result.asset, deduped: result.deduped });
  });

  fastify.get('/assets', async (request, reply) => {
    const userId = request.user!.id;
    const rows = await listUserAssets(userId);
    // Enrich each row with a presigned thumbnailUrl so the frontend (Assets
    // panel, chat, etc.) can render a preview without a second round-trip.
    // null when the asset has no thumbnail yet (e.g. metadata job not done).
    // Also include `url` — the presigned download URL to the asset itself —
    // for parity with GET /projects/:id/assets (PR-D Task 7).
    const assetsWithUrls = await Promise.all(
      rows.map(async (a) => ({
        ...a,
        thumbnailUrl: a.thumbnailKey
          ? await getPresignedDownloadUrl('uploads', a.thumbnailKey, ASSET_URL_TTL_SECONDS)
          : null,
        url: await getPresignedDownloadUrl('uploads', a.storageKey, ASSET_URL_TTL_SECONDS),
        proxyUrl: a.proxyKey
          ? await getPresignedDownloadUrl('uploads', a.proxyKey, ASSET_URL_TTL_SECONDS)
          : null,
      })),
    );
    return reply.send({ assets: assetsWithUrls });
  });

  fastify.get<{ Params: { id: string } }>('/assets/:id', async (request, reply) => {
    const userId = request.user!.id;
    const asset = await getAssetById(request.params.id, userId);
    if (!asset) return reply.code(404).send({ error: 'not_found' });
    return reply.send({ asset });
  });

  fastify.get<{ Params: { id: string } }>('/assets/:id/url', async (request, reply) => {
    const userId = request.user!.id;
    const asset = await getAssetById(request.params.id, userId);
    if (!asset) return reply.code(404).send({ error: 'not_found' });
    const url = await getPresignedDownloadUrl('uploads', asset.storageKey, ASSET_URL_TTL_SECONDS);
    return reply.send({
      url,
      expiresAt: new Date(Date.now() + ASSET_URL_TTL_SECONDS * 1000).toISOString(),
    });
  });

  fastify.patch<{
    Params: { id: string };
    Body: {
      label?: string;
      userDescription?: string | null;
      userIntent?: string | null;
      tags?: string[];
    };
  }>('/assets/:id', async (request, reply) => {
    const userId = request.user!.id;
    const patch = request.body ?? {};
    const updated = await updateAssetMetadata(request.params.id, userId, patch);
    if (!updated) return reply.code(404).send({ error: 'not_found' });
    return reply.send({ asset: updated });
  });

  fastify.delete<{ Params: { id: string } }>('/assets/:id', async (request, reply) => {
    const userId = request.user!.id;
    const ok = await softDeleteAsset(request.params.id, userId);
    if (!ok) return reply.code(404).send({ error: 'not_found' });
    return reply.send({ ok: true });
  });
};

export default assetRoutes;
