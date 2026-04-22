import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import { sandboxManager } from '../sandbox/manager.js';
import { listProjectAssets, linkAssetToProject, type AddedVia } from '../services/asset-link-service.js';
import { createOrDedupAsset } from '../services/asset-service.js';
import { minioClient } from '../services/minio.js';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { projects } from '../db/schema.js';
import { stitchV2ProjectTranscript } from './projects.js';

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

async function getProjectOwner(projectId: string): Promise<string | null> {
  const [row] = await db
    .select({ userId: projects.userId })
    .from(projects)
    .where(eq(projects.id, projectId));
  return row?.userId ?? null;
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

  // Returns the timeline-stitched transcript for a project. The sandbox
  // fetches this per turn to keep /workspace/docs/transcript.json current —
  // otherwise Viona's Phase 1 + caption agent see an empty/missing transcript
  // file even when every asset has transcript_status='ready' (common right
  // after arrangement finishes but before the user reloads).
  //
  // Shape: `{ words: [...], segments: [...], text: "..." }` — matches the
  // legacy transcripts.rawOutput schema, so downstream tooling that expects
  // `transcript.words` / `transcript.segments` keeps working unchanged.
  fastify.get<{ Params: { sid: string } }>(
    '/internal/sandbox/:sid/transcript',
    async (request, reply) => {
      const { sid } = request.params;
      if (!(await authGate(request, reply, sid))) return;

      const stitched = await stitchV2ProjectTranscript(sid).catch((err) => {
        request.log.warn({ err, projectId: sid }, 'v2 transcript stitch failed (internal endpoint)');
        return null;
      });
      if (!stitched) {
        return reply.code(404).send({ error: 'no_transcript' });
      }
      return reply.send(stitched);
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

      const addedVia: AddedVia = 'generated';
      await linkAssetToProject({
        assetId: result.asset.id,
        projectId: sid,
        userId,
        addedVia,
      });

      return reply.send({ asset: result.asset, deduped: result.deduped });
    },
  );
};

export default internalSandboxAssetsRoutes;
