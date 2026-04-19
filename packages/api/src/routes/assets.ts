import { nanoid } from 'nanoid';
import type { FastifyPluginAsync } from 'fastify';
import { authMiddleware } from '../middleware/auth.js';
import {
  getPresignedMultipartUploadUrls,
  getPresignedDownloadUrl,
} from '../services/minio.js';
import {
  createOrDedupAsset,
  getAssetById,
  listUserAssets,
  updateAssetMetadata,
  softDeleteAsset,
  type AssetSource,
} from '../services/asset-service.js';
import { queueAssetMetadataJob } from '../services/queue.js';

interface AuthedRequest { userId: string }

const ASSET_URL_TTL_SECONDS = 24 * 3600;

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
    const { filename, mimeType, fileSize, partCount } = request.body ?? {} as {
      filename?: string;
      mimeType?: string;
      fileSize?: number;
      partCount?: number;
    };
    if (
      !filename ||
      !mimeType ||
      typeof fileSize !== 'number' || fileSize <= 0 ||
      typeof partCount !== 'number' || partCount < 1
    ) {
      return reply.code(400).send({ error: 'invalid_upload_request' });
    }
    const userId = (request as unknown as AuthedRequest).userId;
    const stagingKey = `users/${userId}/assets/pending/${nanoid()}/${filename}`;
    const presigned = await getPresignedMultipartUploadUrls({
      prefix: 'uploads',
      key: stagingKey,
      partCount,
      expirySeconds: 3600,
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
    const userId = (request as unknown as AuthedRequest).userId;
    const body = request.body;
    if (!body?.sha256 || !body?.storageKey || !body?.filename) {
      return reply.code(400).send({ error: 'missing_required_fields' });
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
    return reply.send({ asset: result.asset, deduped: result.deduped });
  });

  fastify.get('/assets', async (request, reply) => {
    const userId = (request as unknown as AuthedRequest).userId;
    const rows = await listUserAssets(userId);
    return reply.send({ assets: rows });
  });

  fastify.get<{ Params: { id: string } }>('/assets/:id', async (request, reply) => {
    const userId = (request as unknown as AuthedRequest).userId;
    const asset = await getAssetById(request.params.id, userId);
    if (!asset) return reply.code(404).send({ error: 'not_found' });
    return reply.send({ asset });
  });

  fastify.get<{ Params: { id: string } }>('/assets/:id/url', async (request, reply) => {
    const userId = (request as unknown as AuthedRequest).userId;
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
    const userId = (request as unknown as AuthedRequest).userId;
    const updated = await updateAssetMetadata(request.params.id, userId, request.body ?? {});
    if (!updated) return reply.code(404).send({ error: 'not_found' });
    return reply.send({ asset: updated });
  });

  fastify.delete<{ Params: { id: string } }>('/assets/:id', async (request, reply) => {
    const userId = (request as unknown as AuthedRequest).userId;
    const ok = await softDeleteAsset(request.params.id, userId);
    if (!ok) return reply.code(404).send({ error: 'not_found' });
    return reply.send({ ok: true });
  });
};

export default assetRoutes;
