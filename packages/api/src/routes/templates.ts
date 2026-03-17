import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { eq, and, ilike, sql, desc } from 'drizzle-orm';
import { db, templates, templateExports } from '../db/index.js';
import { getPresignedDownloadUrl } from '../services/minio.js';
import { queueRenderTemplateJob } from '../services/queue.js';
import { authMiddleware } from '../middleware/auth.js';
import { logger } from '../logger.js';

// Validation schemas
const listQuerySchema = z.object({
  category: z.string().optional(),
  search: z.string().optional(),
  aspectRatio: z.string().optional(),
  tags: z.string().optional(), // comma-separated
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

const exportBodySchema = z.object({
  props: z.record(z.unknown()).optional(),
});

export async function templateRoutes(fastify: FastifyInstance) {
  // ─── GET /templates — List templates with filters (public) ───
  fastify.get('/templates', async (request, reply) => {
    try {
      const query = listQuerySchema.parse(request.query);
      const { category, search, aspectRatio, tags, page, limit } = query;

      const conditions = [eq(templates.isPublished, true)];

      if (category) {
        conditions.push(eq(templates.category, category));
      }

      if (aspectRatio) {
        conditions.push(eq(templates.aspectRatio, aspectRatio));
      }

      if (search) {
        conditions.push(
          sql`(${ilike(templates.name, `%${search}%`)} OR ${ilike(templates.description, `%${search}%`)})`
        );
      }

      if (tags) {
        const tagList = tags.split(',').map(t => t.trim()).filter(Boolean);
        if (tagList.length > 0) {
          // Match templates that have ANY of the requested tags
          conditions.push(
            sql`${templates.tags} ?| array[${sql.join(tagList.map(t => sql`${t}`), sql`, `)}]`
          );
        }
      }

      const whereClause = and(...conditions);
      const offset = (page - 1) * limit;

      const [items, countResult] = await Promise.all([
        db.select({
          id: templates.id,
          slug: templates.slug,
          name: templates.name,
          description: templates.description,
          category: templates.category,
          tags: templates.tags,
          aspectRatio: templates.aspectRatio,
          durationFrames: templates.durationFrames,
          fps: templates.fps,
          width: templates.width,
          height: templates.height,
          screenshotUrl: templates.screenshotUrl,
          createdAt: templates.createdAt,
        })
          .from(templates)
          .where(whereClause)
          .orderBy(desc(templates.createdAt))
          .limit(limit)
          .offset(offset),
        db.select({ count: sql<number>`count(*)::int` })
          .from(templates)
          .where(whereClause),
      ]);

      const total = countResult[0]?.count ?? 0;

      // Generate presigned screenshot URLs for each template
      const itemsWithUrls = await Promise.all(
        items.map(async (item) => {
          let screenshotUrl: string | null = null;
          if (item.screenshotUrl) {
            try {
              screenshotUrl = await getPresignedDownloadUrl('templates', item.screenshotUrl, 3600);
            } catch {
              // If screenshot doesn't exist in storage, leave null
            }
          }
          return { ...item, screenshotUrl };
        })
      );

      return {
        items: itemsWithUrls,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Invalid query parameters', details: err.errors });
      }
      logger.error({ err }, 'Failed to list templates');
      return reply.status(500).send({ error: 'Failed to list templates' });
    }
  });

  // ─── GET /templates/categories — Categories with counts (public) ───
  // MUST be defined BEFORE /:slug to avoid param collision
  fastify.get('/templates/categories', async (_request, reply) => {
    try {
      const result = await db.select({
        category: templates.category,
        count: sql<number>`count(*)::int`,
      })
        .from(templates)
        .where(eq(templates.isPublished, true))
        .groupBy(templates.category)
        .orderBy(templates.category);

      return { categories: result };
    } catch (err) {
      logger.error({ err }, 'Failed to list template categories');
      return reply.status(500).send({ error: 'Failed to list categories' });
    }
  });

  // ─── GET /templates/:slug — Full detail + presigned URLs (public) ───
  fastify.get('/templates/:slug', async (request, reply) => {
    try {
      const { slug } = request.params as { slug: string };

      const template = await db.query.templates.findFirst({
        where: and(eq(templates.slug, slug), eq(templates.isPublished, true)),
      });

      if (!template) {
        return reply.status(404).send({ error: 'Template not found' });
      }

      // Generate presigned URLs
      let bundleUrl: string | null = null;
      let screenshotUrl: string | null = null;

      if (template.bundleKey) {
        try {
          bundleUrl = await getPresignedDownloadUrl('templates', template.bundleKey, 3600);
        } catch {
          // Bundle not available
        }
      }

      if (template.screenshotUrl) {
        try {
          screenshotUrl = await getPresignedDownloadUrl('templates', template.screenshotUrl, 3600);
        } catch {
          // Screenshot not available
        }
      }

      // Asset base URL is a relative path for asset resolution
      const assetBaseUrl = `${slug}/assets`;

      return {
        ...template,
        bundleUrl,
        screenshotUrl,
        assetBaseUrl,
      };
    } catch (err) {
      logger.error({ err }, 'Failed to get template detail');
      return reply.status(500).send({ error: 'Failed to get template' });
    }
  });

  // ─── POST /templates/:slug/export — Queue render job (auth required) ───
  fastify.post('/templates/:slug/export', { preHandler: [authMiddleware] }, async (request, reply) => {
    try {
      const { slug } = request.params as { slug: string };
      const userId = request.user!.id;

      // Parse body
      const body = exportBodySchema.parse(request.body || {});

      // Find the template
      const template = await db.query.templates.findFirst({
        where: and(eq(templates.slug, slug), eq(templates.isPublished, true)),
      });

      if (!template) {
        return reply.status(404).send({ error: 'Template not found' });
      }

      // Rate limit: 5 exports per hour per user
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentExports = await db.select({ count: sql<number>`count(*)::int` })
        .from(templateExports)
        .where(and(
          eq(templateExports.userId, userId),
          sql`${templateExports.createdAt} > ${oneHourAgo}`,
        ));

      const exportCount = recentExports[0]?.count ?? 0;
      if (exportCount >= 5) {
        return reply.status(429).send({
          error: 'Rate limit exceeded',
          message: 'Maximum 5 template exports per hour. Please try again later.',
        });
      }

      // Merge default props with user-provided props
      const mergedProps = {
        ...(template.defaultProps || {}),
        ...(body.props || {}),
      };

      // Create export record
      const [exportRecord] = await db.insert(templateExports).values({
        templateId: template.id,
        userId,
        props: mergedProps,
        status: 'queued',
      }).returning();

      // Queue the render job
      await queueRenderTemplateJob({
        exportId: exportRecord.id,
        templateId: template.id,
        slug: template.slug,
        bundleKey: template.bundleKey || '',
        props: mergedProps,
        userId,
      });

      return reply.status(201).send({
        exportId: exportRecord.id,
        status: 'queued',
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Invalid request body', details: err.errors });
      }
      logger.error({ err }, 'Failed to create template export');
      return reply.status(500).send({ error: 'Failed to create export' });
    }
  });

  // ─── GET /templates/:slug/export/:exportId — Poll export status (auth required) ───
  fastify.get('/templates/:slug/export/:exportId', { preHandler: [authMiddleware] }, async (request, reply) => {
    try {
      const { exportId } = request.params as { slug: string; exportId: string };
      const userId = request.user!.id;

      const exportRecord = await db.query.templateExports.findFirst({
        where: eq(templateExports.id, exportId),
      });

      if (!exportRecord) {
        return reply.status(404).send({ error: 'Export not found' });
      }

      // Ownership check
      if (exportRecord.userId !== userId) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      // If completed, generate presigned download URL
      let downloadUrl: string | null = null;
      if (exportRecord.status === 'completed' && exportRecord.outputUrl) {
        try {
          downloadUrl = await getPresignedDownloadUrl('templates', exportRecord.outputUrl, 3600);
        } catch {
          // Output not available
        }
      }

      return {
        id: exportRecord.id,
        status: exportRecord.status,
        props: exportRecord.props,
        downloadUrl,
        createdAt: exportRecord.createdAt,
        completedAt: exportRecord.completedAt,
      };
    } catch (err) {
      logger.error({ err }, 'Failed to get export status');
      return reply.status(500).send({ error: 'Failed to get export status' });
    }
  });
}
