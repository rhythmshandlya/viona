import type { FastifyPluginAsync } from 'fastify';
import { authMiddleware } from '../middleware/auth.js';
import { getAssetById } from '../services/asset-service.js';
import {
  linkAssetToProject,
  unlinkAssetFromProject,
  listProjectAssets,
  type AddedVia,
} from '../services/asset-link-service.js';

const projectAssetRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authMiddleware);

  fastify.post<{ Params: { id: string }; Body: { assetId: string; addedVia: AddedVia } }>(
    '/projects/:id/assets/link',
    async (request, reply) => {
      const userId = request.user!.id;
      const { id: projectId } = request.params;
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

      const asset = await getAssetById(assetId, userId);
      if (!asset) return reply.code(403).send({ error: 'forbidden' });

      const ok = await unlinkAssetFromProject({ assetId, projectId, userId });
      return reply.send({ ok });
    },
  );

  /**
   * Lists all non-deleted assets linked to the given project.
   * TODO: Add project-ownership enforcement once project ACLs are wired (PR-A2+).
   * Current behavior: any authenticated user can read any project's asset list if they know its ID.
   */
  fastify.get<{ Params: { id: string } }>('/projects/:id/assets', async (request, reply) => {
    const assets = await listProjectAssets(request.params.id);
    return reply.send({ assets });
  });
};

export default projectAssetRoutes;
