import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { youtubeClipService } from '../services/youtube-clip.js';
import { youtubeSearchService } from '../services/youtube-search.js';
import { youtubeClipQueue, queueYouTubeClipJob } from '../services/queue.js';
import { authMiddleware } from '../middleware/auth.js';

// ============================================
// Schemas
// ============================================

// Strict YouTube URL validation with proper anchoring
const youtubeUrlSchema = z.string().url().refine(
  (url) => /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//.test(url),
  'Must be a valid YouTube URL'
);

const streamInfoSchema = z.object({
  url: youtubeUrlSchema,
  quality: z.string().optional(),
});

const extractClipSchema = z.object({
  url: youtubeUrlSchema,
  startSeconds: z.number().min(0),
  endSeconds: z.number().min(0),
  quality: z.string().optional(),
  projectId: z.string().optional(),
});

const searchVideosSchema = z.object({
  query: z.string().min(2).max(200),
  maxResults: z.number().min(1).max(20).optional().default(5),
  videoDuration: z.enum(['short', 'medium', 'long', 'any']).optional().default('any'),
  videoDefinition: z.enum(['high', 'standard', 'any']).optional().default('any'),
  order: z.enum(['relevance', 'date', 'viewCount', 'rating']).optional().default('relevance'),
});

// ============================================
// Routes
// ============================================

export const youtubeClipRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * Get video info and streaming URL for preview
   * POST /api/youtube/stream-info
   */
  fastify.post('/youtube/stream-info', { preHandler: authMiddleware }, async (request, reply) => {
    try {
      const body = streamInfoSchema.parse(request.body);

      // Get video info and stream URL in parallel
      const [info, stream] = await Promise.all([
        youtubeClipService.getVideoInfo(body.url),
        youtubeClipService.getStreamUrl(body.url, body.quality),
      ]);

      return {
        ...info,
        streamUrl: `/api/youtube/proxy/${stream.tokenId}`,
        tokenId: stream.tokenId,
        expiresAt: stream.expiresAt,
      };
    } catch (error: any) {
      fastify.log.error(error, 'Failed to get stream info');
      return reply.code(400).send({
        error: error.message || 'Failed to get video info',
      });
    }
  });

  /**
   * Proxy video stream with range request support
   * GET /api/youtube/proxy/:tokenId
   */
  fastify.get('/youtube/proxy/:tokenId', { preHandler: authMiddleware }, async (request, reply) => {
    const { tokenId } = request.params as { tokenId: string };
    const rangeHeader = request.headers.range;

    const token = youtubeClipService.getStreamToken(tokenId);
    if (!token) {
      return reply.code(410).send({ error: 'Stream token expired or invalid' });
    }

    try {
      const headers: Record<string, string> = {};
      if (rangeHeader) {
        headers['Range'] = rangeHeader;
      }

      const response = await fetch(token.directUrl, { headers });

      // Use actual content type from YouTube, or fallback to video/mp4
      // YouTube streams can be mp4 or webm depending on the format
      const upstreamContentType = response.headers.get('content-type');
      const contentType = upstreamContentType?.startsWith('video/')
        ? upstreamContentType
        : 'video/mp4';

      // Set response headers
      reply.header('Content-Type', contentType);
      reply.header('Accept-Ranges', 'bytes');

      const contentLength = response.headers.get('content-length');
      const contentRange = response.headers.get('content-range');

      if (contentLength) {
        reply.header('Content-Length', contentLength);
      }
      if (contentRange) {
        reply.header('Content-Range', contentRange);
      }

      // Set status code (200 or 206 for partial content)
      reply.code(response.status);

      // Stream the response body
      if (response.body) {
        return reply.send(response.body);
      }

      return reply.code(500).send({ error: 'No response body' });
    } catch (error: any) {
      fastify.log.error(error, 'Failed to proxy stream');
      return reply.code(500).send({ error: 'Failed to proxy stream' });
    }
  });

  /**
   * Queue clip extraction job
   * POST /api/youtube/extract
   */
  fastify.post('/youtube/extract', { preHandler: authMiddleware }, async (request, reply) => {
    try {
      const body = extractClipSchema.parse(request.body);

      // Validate time range
      if (body.endSeconds <= body.startSeconds) {
        return reply.code(400).send({
          error: 'End time must be after start time',
        });
      }

      // Limit clip duration (max 10 minutes)
      const duration = body.endSeconds - body.startSeconds;
      if (duration > 600) {
        return reply.code(400).send({
          error: 'Clip duration cannot exceed 10 minutes',
        });
      }

      const jobId = `ytclip-${Date.now()}`;

      const job = await queueYouTubeClipJob({
        jobId,
        url: body.url,
        startSeconds: body.startSeconds,
        endSeconds: body.endSeconds,
        quality: body.quality,
        projectId: body.projectId,
      });

      return {
        jobId: job.id,
        status: 'processing',
      };
    } catch (error: any) {
      fastify.log.error(error, 'Failed to queue clip extraction');
      return reply.code(400).send({
        error: error.message || 'Failed to queue clip extraction',
      });
    }
  });

  /**
   * Get extraction job status
   * GET /api/youtube/extract/:jobId
   */
  fastify.get('/youtube/extract/:jobId', { preHandler: authMiddleware }, async (request, reply) => {
    const { jobId } = request.params as { jobId: string };

    try {
      const job = await youtubeClipQueue.getJob(jobId);

      if (!job) {
        return reply.code(404).send({ error: 'Job not found' });
      }

      const state = await job.getState();

      if (state === 'completed' && job.returnvalue) {
        const result = job.returnvalue;

        // Use persistent proxy URL instead of expiring presigned URL
        // The /api/media/outputs/* endpoint streams files directly from storage
        const clipUrl = `/api/media/outputs/${result.clipUrl}`;

        return {
          status: 'complete',
          ...result,
          clipUrl, // Persistent proxy URL that doesn't expire
          clipKey: result.clipUrl, // Storage key for reference
        };
      }

      if (state === 'failed') {
        return {
          status: 'failed',
          error: job.failedReason || 'Unknown error',
        };
      }

      return {
        status: state,
        progress: job.progress,
      };
    } catch (error: any) {
      fastify.log.error(error, 'Failed to get job status');
      return reply.code(500).send({ error: 'Failed to get job status' });
    }
  });

  /**
   * Refresh stream token (get new URL if expired)
   * POST /api/youtube/refresh-stream
   */
  fastify.post('/youtube/refresh-stream', { preHandler: authMiddleware }, async (request, reply) => {
    try {
      const body = streamInfoSchema.parse(request.body);

      const stream = await youtubeClipService.getStreamUrl(body.url, body.quality);

      return {
        streamUrl: `/api/youtube/proxy/${stream.tokenId}`,
        tokenId: stream.tokenId,
        expiresAt: stream.expiresAt,
      };
    } catch (error: any) {
      fastify.log.error(error, 'Failed to refresh stream');
      return reply.code(400).send({
        error: error.message || 'Failed to refresh stream',
      });
    }
  });

  /**
   * Search YouTube videos
   * POST /api/youtube/search
   *
   * Used by AI to find relevant videos for scene planning.
   * Returns video metadata with thumbnails and durations.
   */
  fastify.post('/youtube/search', { preHandler: authMiddleware }, async (request, reply) => {
    try {
      const body = searchVideosSchema.parse(request.body);

      const results = await youtubeSearchService.searchVideos(body.query, {
        maxResults: body.maxResults,
        videoDuration: body.videoDuration,
        videoDefinition: body.videoDefinition,
        order: body.order,
      });

      return {
        query: body.query,
        results,
        total: results.length,
      };
    } catch (error: any) {
      fastify.log.error(error, 'Failed to search YouTube videos');
      return reply.code(400).send({
        error: error.message || 'Failed to search videos',
      });
    }
  });
};
