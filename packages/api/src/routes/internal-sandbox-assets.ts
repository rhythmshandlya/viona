import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { sandboxManager } from '../sandbox/manager.js';
import { listProjectAssets } from '../services/asset-link-service.js';
import { minioClient } from '../services/minio.js';
import { config } from '../config.js';

function parseBearer(req: FastifyRequest): string | null {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return null;
  return h.slice(7).trim() || null;
}

async function authGate(req: FastifyRequest, reply: FastifyReply, sid: string): Promise<boolean> {
  const token = parseBearer(req);
  if (!token) {
    await reply.code(401).send({ error: 'missing_bearer' });
    return false;
  }
  const ok = await sandboxManager.verifySandboxSecret(sid, token);
  if (!ok) {
    await reply.code(403).send({ error: 'forbidden' });
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

  fastify.get<{ Params: { sid: string; aid: string } }>(
    '/internal/sandbox/:sid/asset/:aid/stream',
    async (request, reply) => {
      const { sid, aid } = request.params;
      if (!(await authGate(request, reply, sid))) return;

      const rows = await listProjectAssets(sid);
      const asset = rows.find((a) => a.id === aid);
      if (!asset) {
        return reply.code(403).send({ error: 'not_in_project' });
      }

      const stream = await minioClient.getObject(config.storage.bucket, asset.storageKey);
      reply.header('Content-Type', asset.mimeType);
      reply.header('Content-Length', String(asset.fileSize));
      return reply.send(stream);
    },
  );
};

export default internalSandboxAssetsRoutes;
