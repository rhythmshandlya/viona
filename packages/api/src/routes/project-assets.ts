import type { FastifyPluginAsync } from 'fastify';
import { eq } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.js';
import { getAssetById } from '../services/asset-service.js';
import { getPresignedDownloadUrl } from '../services/minio.js';
import { db, projects } from '../db/index.js';
import {
  linkAssetToProject,
  unlinkAssetFromProject,
  listProjectAssets,
  type AddedVia,
} from '../services/asset-link-service.js';

const ASSET_URL_TTL_SECONDS = 24 * 3600;

/**
 * Returns true iff the given user owns the given project.
 * Used to gate the /projects/:id/assets/* endpoints so one user cannot
 * read/mutate another user's project's asset links (S3/S6).
 */
async function requireProjectOwnership(projectId: string, userId: string): Promise<boolean> {
  const rows = await db
    .select({ userId: projects.userId })
    .from(projects)
    .where(eq(projects.id, projectId));
  if (rows.length === 0) return false;
  return rows[0].userId === userId;
}

const projectAssetRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authMiddleware);

  fastify.post<{ Params: { id: string }; Body: { assetId: string; addedVia: AddedVia } }>(
    '/projects/:id/assets/link',
    async (request, reply) => {
      const userId = request.user!.id;
      const { id: projectId } = request.params;
      if (!(await requireProjectOwnership(projectId, userId))) {
        return reply.code(403).send({ error: 'forbidden' });
      }

      const { assetId, addedVia } = request.body;

      const asset = await getAssetById(assetId, userId);
      if (!asset) return reply.code(403).send({ error: 'forbidden' });

      const link = await linkAssetToProject({ assetId, projectId, userId, addedVia });
      return reply.send({ link });
    },
  );

  fastify.delete<{ Params: { id: string; assetId: string } }>(
    '/projects/:id/assets/:assetId',
    async (request, reply) => {
      const userId = request.user!.id;
      const { id: projectId, assetId } = request.params;
      if (!(await requireProjectOwnership(projectId, userId))) {
        return reply.code(403).send({ error: 'forbidden' });
      }

      const asset = await getAssetById(assetId, userId);
      if (!asset) return reply.code(403).send({ error: 'forbidden' });

      const ok = await unlinkAssetFromProject({ assetId, projectId, userId });
      return reply.send({ ok });
    },
  );

  /**
   * Lists all non-deleted assets linked to the given project.
   * Requires the caller to own the project; otherwise 403.
   */
  fastify.get<{ Params: { id: string } }>('/projects/:id/assets', async (request, reply) => {
    const userId = request.user!.id;
    const { id: projectId } = request.params;
    if (!(await requireProjectOwnership(projectId, userId))) {
      return reply.code(403).send({ error: 'forbidden' });
    }
    const assets = await listProjectAssets(projectId);
    // Enrich each row with a presigned thumbnailUrl so the frontend (Assets
    // panel, chat, etc.) can render a preview without a second round-trip.
    // null when the asset has no thumbnail yet (e.g. metadata job not done).
    // Also include `url` — the presigned download URL to the asset itself —
    // so manifest-bridge can resolve timeline items written with `data.assetId`
    // (e.g. by the arrangement subagent) without N extra `/assets/:id/url`
    // round-trips (PR-D Task 7).
    const assetsWithUrls = await Promise.all(
      assets.map(async (a) => ({
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
};

export default projectAssetRoutes;
