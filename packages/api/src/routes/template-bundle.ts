import { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db, templates } from '../db/index.js';
import { getPresignedDownloadUrl } from '../services/minio.js';
import { logger } from '../logger.js';

export async function templateBundleRoutes(fastify: FastifyInstance) {
  // GET /templates/:slug/bundle — 302 to a presigned S3 URL for the bundle
  fastify.get<{ Params: { slug: string } }>('/templates/:slug/bundle', async (request, reply) => {
    const { slug } = request.params;

    const row = await db.query.templates.findFirst({
      where: eq(templates.slug, slug),
    });

    if (!row || !row.isPublished) {
      return reply.code(404).send({ error: 'Template not found' });
    }

    if (!row.bundleKey) {
      return reply.code(500).send({ error: 'Template is published but has no bundleKey' });
    }

    try {
      // Presigned URL so the browser can stream the bundle directly from S3/MinIO
      // without our api proxying bytes. Short TTL since consumers cache the eval'd
      // component in-memory — they don't re-fetch on every render.
      const url = await getPresignedDownloadUrl('templates', row.bundleKey, 60 * 10);
      return reply.redirect(302, url);
    } catch (err: any) {
      logger.error({ err: err.message, slug, bundleKey: row.bundleKey }, 'Failed to sign bundle URL');
      return reply.code(500).send({ error: 'Failed to sign bundle URL' });
    }
  });
}
