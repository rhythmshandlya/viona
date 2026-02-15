import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { eq, inArray, or, and } from 'drizzle-orm';
import { db, projects, tracks, timelineItems, jobs, transcripts, visuals } from '../db/index.js';
import { getPresignedUploadUrl, getPresignedDownloadUrl, objectExists, getObjectStream, getPartialObjectStream, getObjectStat, uploadStream } from '../services/minio.js';
import { queueTranscribeJob, queueRenderJob, queueEnhanceAudioJob, queueGenerateVisualsJob, queueEditVisualsJob, queueSvgAnimationJob, queuePreloadProjectJob, publishJobCancel } from '../services/queue.js';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.js';
import type { ProjectStatus } from '@reelify/shared';

// Validation schemas
const createProjectSchema = z.object({
  filename: z.string().min(1),
  title: z.string().max(255).optional(),
  contentType: z.string().optional(),
});

const updateProjectSchema = z.object({
  title: z.string().max(255).optional(),
  tracks: z.array(z.object({
    id: z.string(),
    name: z.string().optional(),
    locked: z.boolean().optional(),
    visible: z.boolean().optional(),
  })).optional(),
  items: z.array(z.object({
    id: z.string(),
    trackId: z.string().optional(),
    type: z.string().optional(),
    startMs: z.number().optional(),
    endMs: z.number().optional(),
    data: z.record(z.unknown()).optional(),
  })).optional(),
  // IDs of all caption items currently in the editor — DB items not in this list are deleted
  captionItemIds: z.array(z.string()).optional(),
  videoSettings: z.record(z.unknown()).optional(),
});

// Helper to check if a user owns a project
function checkProjectOwnership(projectUserId: string | null, userId: string | undefined): boolean {
  // If project has no owner (legacy data), allow access for now
  if (!projectUserId) return true;
  // Otherwise check if user owns the project
  return projectUserId === userId;
}

export async function projectRoutes(fastify: FastifyInstance) {
  // Create a new project
  fastify.post('/projects', { preHandler: authMiddleware }, async (request, reply) => {
    const body = createProjectSchema.parse(request.body);

    // Generate video key
    const videoKey = `${nanoid()}/${body.filename}`;

    // Create project in database with user ownership
    const [project] = await db.insert(projects).values({
      status: 'uploading' as ProjectStatus,
      title: body.title || null,
      videoKey,
      userId: request.user!.id, // Associate with authenticated user
    }).returning();

    // Create default video track
    await db.insert(tracks).values({
      projectId: project.id,
      type: 'video',
      name: 'Video',
      position: 0,
    });

    // Get presigned upload URL
    const uploadUrl = await getPresignedUploadUrl('uploads', videoKey);

    return {
      projectId: project.id,
      uploadUrl,
      // Also return videoKey for proxy upload
      videoKey,
    };
  });

  // Proxy upload endpoint - bypasses CORS issues with direct S3 uploads
  fastify.post('/projects/:id/upload', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, id),
    });

    if (!project) {
      return reply.status(404).send({ error: 'Project not found' });
    }

    // Check ownership
    if (!checkProjectOwnership(project.userId, request.user?.id)) {
      return reply.status(403).send({ error: 'Access denied' });
    }

    if (!project.videoKey) {
      return reply.status(400).send({ error: 'Project has no video key' });
    }

    try {
      const data = await request.file();
      if (!data) {
        return reply.status(400).send({ error: 'No file uploaded' });
      }

      // Stream the file directly to MinIO
      await uploadStream(
        'uploads',
        project.videoKey,
        data.file,
        undefined, // size unknown for streams
        data.mimetype
      );

      return { success: true, videoKey: project.videoKey };
    } catch (err) {
      fastify.log.error(err, 'Failed to upload file');
      return reply.status(500).send({ error: 'Failed to upload file' });
    }
  });

  // Get a project with all data
  fastify.get('/projects/:id', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, id),
    });

    if (!project) {
      return reply.status(404).send({ error: 'Project not found' });
    }

    // Check ownership
    if (!checkProjectOwnership(project.userId, request.user?.id)) {
      return reply.status(403).send({ error: 'Access denied' });
    }

    const projectTracks = await db.query.tracks.findMany({
      where: eq(tracks.projectId, id),
    });

    const trackIds = projectTracks.map(t => t.id);
    const items = trackIds.length > 0
      ? await db.select().from(timelineItems).where(
          inArray(timelineItems.trackId, trackIds)
        )
      : [];

    const transcript = await db.query.transcripts.findFirst({
      where: eq(transcripts.projectId, id),
    });

    // Generate presigned URL for video playback (valid for 1 hour)
    // This allows the frontend to load video without cookies for cross-origin requests
    let videoPresignedUrl: string | null = null;
    if (project.videoKey) {
      try {
        fastify.log.info({ videoKey: project.videoKey }, 'Checking if video exists for presigned URL');
        const exists = await objectExists('uploads', project.videoKey);
        fastify.log.info({ videoKey: project.videoKey, exists }, 'Video exists check result');
        if (exists) {
          videoPresignedUrl = await getPresignedDownloadUrl('uploads', project.videoKey, 3600);
          fastify.log.info({ videoKey: project.videoKey, urlGenerated: !!videoPresignedUrl, videoPresignedUrl }, 'Presigned URL generated');
        }
      } catch (err) {
        fastify.log.warn({ err, videoKey: project.videoKey }, 'Failed to generate presigned URL for video');
      }
    } else {
      fastify.log.info({ projectId: id }, 'No videoKey for project, skipping presigned URL');
    }

    // Trigger preload of visual source files to worker workspace (non-blocking)
    // This warms up the cache so AI edits are faster
    const visual = await db.query.visuals.findFirst({
      where: eq(visuals.projectId, id),
    });
    if (visual?.compositionId) {
      queuePreloadProjectJob({
        projectId: id,
        compositionId: visual.compositionId,
      }).catch((err) => {
        fastify.log.warn({ err, projectId: id }, 'Failed to queue preload job (non-critical)');
      });
    }

    return {
      ...project,
      tracks: projectTracks,
      items,
      transcript,
      videoPresignedUrl,
    };
  });

  // Stream video file
  fastify.get('/projects/:id/video', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, id),
    });

    if (!project) {
      return reply.status(404).send({ error: 'Project not found' });
    }

    // Check ownership
    if (!checkProjectOwnership(project.userId, request.user?.id)) {
      return reply.status(403).send({ error: 'Access denied' });
    }

    if (!project.videoKey) {
      return reply.status(400).send({ error: 'No video uploaded' });
    }

    // Check if video exists
    const exists = await objectExists('uploads', project.videoKey);
    if (!exists) {
      return reply.status(404).send({ error: 'Video not found in storage' });
    }

    try {
      // Get object metadata for content-type and size
      const stat = await getObjectStat('uploads', project.videoKey);

      // Determine content type from file extension
      const ext = project.videoKey.split('.').pop()?.toLowerCase();
      const contentTypes: Record<string, string> = {
        mp4: 'video/mp4',
        mov: 'video/quicktime',
        webm: 'video/webm',
      };
      const contentType = contentTypes[ext || ''] || 'application/octet-stream';

      // Handle range requests for video seeking
      const range = request.headers.range;

      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
        const chunkSize = end - start + 1;

        const stream = await getPartialObjectStream(
          'uploads',
          project.videoKey,
          start,
          chunkSize,
        );

        reply.status(206);
        reply.header('Content-Range', `bytes ${start}-${end}/${stat.size}`);
        reply.header('Accept-Ranges', 'bytes');
        reply.header('Content-Length', chunkSize);
        reply.header('Content-Type', contentType);

        return reply.send(stream);
      }

      // Full file request
      const stream = await getObjectStream('uploads', project.videoKey);

      reply.header('Content-Type', contentType);
      reply.header('Content-Length', stat.size);
      reply.header('Accept-Ranges', 'bytes');

      return reply.send(stream);
    } catch (err) {
      fastify.log.error(err, 'Failed to stream video');
      return reply.status(500).send({ error: 'Failed to stream video' });
    }
  });

  // Update a project
  fastify.patch('/projects/:id', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateProjectSchema.parse(request.body);

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, id),
    });

    if (!project) {
      return reply.status(404).send({ error: 'Project not found' });
    }

    // Check ownership
    if (!checkProjectOwnership(project.userId, request.user?.id)) {
      return reply.status(403).send({ error: 'Access denied' });
    }

    // Update tracks if provided
    if (body.tracks) {
      for (const track of body.tracks) {
        await db.update(tracks)
          .set({
            name: track.name,
            locked: track.locked,
            visible: track.visible,
          })
          .where(eq(tracks.id, track.id));
      }
    }

    // Upsert timeline items if provided (handles both existing and new items from split/merge)
    if (body.items) {
      for (const item of body.items) {
        // Try UPDATE first
        const result = await db.update(timelineItems)
          .set({
            startMs: item.startMs,
            endMs: item.endMs,
            data: item.data,
            updatedAt: new Date(),
          })
          .where(eq(timelineItems.id, item.id))
          .returning({ id: timelineItems.id });

        // If no rows updated, INSERT the new item (from split/merge)
        if (result.length === 0 && item.trackId && item.type && item.startMs != null && item.endMs != null && item.data) {
          await db.insert(timelineItems).values({
            id: item.id,
            trackId: item.trackId,
            type: item.type,
            startMs: item.startMs,
            endMs: item.endMs,
            data: item.data,
          });
        }
      }
    }

    // Delete caption items that no longer exist in the editor (removed by split/merge)
    if (body.captionItemIds) {
      const trackIds = (await db.query.tracks.findMany({
        where: eq(tracks.projectId, id),
      })).map(t => t.id);

      if (trackIds.length > 0) {
        // Find all subtitle/caption items in the project
        const existingItems = await db.select({ id: timelineItems.id }).from(timelineItems)
          .where(and(
            inArray(timelineItems.trackId, trackIds),
            or(eq(timelineItems.type, 'subtitle'), eq(timelineItems.type, 'caption'))
          ));

        // Delete items not in the editor's current list
        const idsToDelete = existingItems
          .map(i => i.id)
          .filter(dbId => !body.captionItemIds!.includes(dbId));

        if (idsToDelete.length > 0) {
          await db.delete(timelineItems).where(inArray(timelineItems.id, idsToDelete));
          fastify.log.info({ deletedCount: idsToDelete.length }, 'Deleted orphaned caption items from split/merge');
        }
      }
    }

    // Update project fields
    const updateData: { updatedAt: Date; title?: string; videoSettings?: unknown } = { updatedAt: new Date() };
    if (body.title !== undefined) {
      updateData.title = body.title;
    }
    if (body.videoSettings !== undefined) {
      updateData.videoSettings = body.videoSettings;
    }
    await db.update(projects)
      .set(updateData)
      .where(eq(projects.id, id));

    return { success: true };
  });

  // Start processing (transcription + audio enhancement in parallel)
  fastify.post('/projects/:id/process', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, id),
    });

    if (!project) {
      return reply.status(404).send({ error: 'Project not found' });
    }

    // Check ownership
    if (!checkProjectOwnership(project.userId, request.user?.id)) {
      return reply.status(403).send({ error: 'Access denied' });
    }

    if (!project.videoKey) {
      return reply.status(400).send({ error: 'No video uploaded' });
    }

    // Check if video exists in storage
    const exists = await objectExists('uploads', project.videoKey);
    if (!exists) {
      return reply.status(400).send({ error: 'Video not found in storage' });
    }

    // Create transcription job
    const [transcribeJob] = await db.insert(jobs).values({
      projectId: id,
      type: 'transcribe',
      status: 'pending',
    }).returning();

    // Create audio track, timeline item, and enhancement job
    const [audioTrack] = await db.insert(tracks).values({
      projectId: id,
      type: 'audio',
      name: 'Audio',
      position: 2,
    }).returning();

    const [audioItem] = await db.insert(timelineItems).values({
      trackId: audioTrack.id,
      type: 'audio',
      startMs: 0,
      endMs: project.durationMs || 0, // Updated by worker after probing
      data: {
        src: '',
        originalSrc: '',
        isEnhanced: false,
        sourceVideoItemId: '',
        volume: 1,
        enhancementStatus: 'processing',
        enhancementProgress: 0,
      },
    }).returning();

    const [enhanceJob] = await db.insert(jobs).values({
      projectId: id,
      type: 'enhance-audio',
      status: 'pending',
    }).returning();

    // Update project status
    await db.update(projects)
      .set({ status: 'processing' })
      .where(eq(projects.id, id));

    // Queue both jobs in parallel
    await Promise.all([
      queueTranscribeJob({
        projectId: id,
        jobId: transcribeJob.id,
        videoKey: project.videoKey,
      }),
      queueEnhanceAudioJob({
        projectId: id,
        jobId: enhanceJob.id,
        videoKey: project.videoKey,
        audioTrackId: audioTrack.id,
        audioItemId: audioItem.id,
        videoItemId: '',
      }),
    ]);

    return {
      jobId: transcribeJob.id,
      transcribeJobId: transcribeJob.id,
      enhanceJobId: enhanceJob.id,
    };
  });

  // Reset project status to ready (for recovery from failed state)
  fastify.post('/projects/:id/reset-status', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, id),
    });

    if (!project) {
      return reply.status(404).send({ error: 'Project not found' });
    }

    // Check ownership
    if (!checkProjectOwnership(project.userId, request.user?.id)) {
      return reply.status(403).send({ error: 'Access denied' });
    }

    // Only allow reset from failed, complete, or processing states (processing can get stuck)
    if (project.status !== 'failed' && project.status !== 'complete' && project.status !== 'processing') {
      return reply.status(400).send({
        error: `Cannot reset project in '${project.status}' state. Only 'failed', 'complete', or 'processing' projects can be reset.`
      });
    }

    await db.update(projects)
      .set({ status: 'ready' as ProjectStatus, updatedAt: new Date() })
      .where(eq(projects.id, id));

    return { success: true, message: 'Project status reset to ready', previousStatus: project.status };
  });

  // Start rendering
  fastify.post('/projects/:id/render', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { layoutSettings?: any; fullscreenSegments?: Array<{ startMs: number; endMs: number }> } || {};

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, id),
    });

    if (!project) {
      return reply.status(404).send({ error: 'Project not found' });
    }

    // Check ownership
    if (!checkProjectOwnership(project.userId, request.user?.id)) {
      return reply.status(403).send({ error: 'Access denied' });
    }

    // Create job record
    const [job] = await db.insert(jobs).values({
      projectId: id,
      type: 'render',
      status: 'pending',
    }).returning();

    // Update project status
    await db.update(projects)
      .set({ status: 'rendering' })
      .where(eq(projects.id, id));

    // Queue the job with layout settings and fullscreen segments for exact preview match
    await queueRenderJob({
      projectId: id,
      jobId: job.id,
      layoutSettings: body.layoutSettings,
      fullscreenSegments: body.fullscreenSegments,
    });

    return { jobId: job.id };
  });

  // Generate AI visuals
  fastify.post('/projects/:id/generate-visuals', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({
      stylePreset: z.enum(['minimal', 'modern', 'playful', 'bold', 'classic', 'apple', 'google']),
      layoutMode: z.enum(['pip', 'split-horizontal', 'split-vertical']),
      dimensions: z.object({
        width: z.number().int().min(100).max(4096),
        height: z.number().int().min(100).max(4096),
      }),
      styleGuide: z.string().max(2000).optional(),
    }).parse(request.body);

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, id),
    });

    if (!project) {
      return reply.status(404).send({ error: 'Project not found' });
    }

    // Check ownership
    if (!checkProjectOwnership(project.userId, request.user?.id)) {
      return reply.status(403).send({ error: 'Access denied' });
    }

    // Check for transcript
    const transcript = await db.query.transcripts.findFirst({
      where: eq(transcripts.projectId, id),
    });

    if (!transcript || !transcript.words) {
      return reply.status(400).send({ error: 'Project has no transcript. Run processing first.' });
    }

    // Check for existing pending/processing job (idempotency check)
    const existingJob = await db.query.jobs.findFirst({
      where: and(
        eq(jobs.projectId, id),
        eq(jobs.type, 'generate-visuals'),
        or(eq(jobs.status, 'pending'), eq(jobs.status, 'processing'))
      ),
    });

    if (existingJob) {
      return reply.status(409).send({
        error: 'A visual generation job is already in progress',
        jobId: existingJob.id,
      });
    }

    // Create job record
    const [job] = await db.insert(jobs).values({
      projectId: id,
      type: 'generate-visuals',
      status: 'pending',
    }).returning();

    // Update project status
    await db.update(projects)
      .set({ status: 'generating' })
      .where(eq(projects.id, id));

    // Queue the job
    await queueGenerateVisualsJob({
      projectId: id,
      jobId: job.id,
      stylePreset: body.stylePreset,
      layoutMode: body.layoutMode,
      dimensions: body.dimensions,
      styleGuide: body.styleGuide,
    });

    return { jobId: job.id };
  });

  // Edit existing visuals with AI
  // User types a prompt like "Make particles bigger" and AI edits the existing composition
  // Optional sceneId targets edits to a specific scene
  fastify.post('/projects/:id/edit-visuals', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({
      prompt: z.string().min(1).max(2000),
      sceneId: z.number().int().min(1).optional(),
      elementName: z.string().optional(),
    }).parse(request.body);

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, id),
    });

    if (!project) {
      return reply.status(404).send({ error: 'Project not found' });
    }

    // Check ownership
    if (!checkProjectOwnership(project.userId, request.user?.id)) {
      return reply.status(403).send({ error: 'Access denied' });
    }

    // Check for existing visuals (need something to edit)
    const visual = await db.query.visuals.findFirst({
      where: eq(visuals.projectId, id),
    });

    if (!visual) {
      return reply.status(400).send({ error: 'No visuals to edit. Generate visuals first.' });
    }

    // Note: We don't check sourceUrl here anymore - the worker will attempt to
    // download source files from MinIO based on compositionId. This allows
    // editing even if sourceUrl wasn't stored in DB (for older projects that
    // might still have sources in MinIO).

    // Check for existing pending/processing edit job
    const existingJob = await db.query.jobs.findFirst({
      where: and(
        eq(jobs.projectId, id),
        eq(jobs.type, 'edit-visuals'),
        or(eq(jobs.status, 'pending'), eq(jobs.status, 'processing'))
      ),
    });

    if (existingJob) {
      return reply.status(409).send({
        error: 'An edit job is already in progress',
        jobId: existingJob.id,
      });
    }

    // Create job record
    const [job] = await db.insert(jobs).values({
      projectId: id,
      type: 'edit-visuals',
      status: 'pending',
    }).returning();

    // Update project status
    await db.update(projects)
      .set({ status: 'generating' })
      .where(eq(projects.id, id));

    // Queue the edit job
    await queueEditVisualsJob({
      projectId: id,
      jobId: job.id,
      compositionId: visual.compositionId,
      prompt: body.prompt,
      sceneId: body.sceneId,
      elementName: body.elementName,
    });

    return { jobId: job.id };
  });

  // Upload image for SVG animation
  fastify.post('/projects/:id/upload-image', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, id),
    });

    if (!project) {
      return reply.status(404).send({ error: 'Project not found' });
    }

    // Check ownership
    if (!checkProjectOwnership(project.userId, request.user?.id)) {
      return reply.status(403).send({ error: 'Access denied' });
    }

    try {
      const data = await request.file();
      if (!data) {
        return reply.status(400).send({ error: 'No file uploaded' });
      }

      // Validate file type
      const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
      if (!allowedTypes.includes(data.mimetype)) {
        return reply.status(400).send({
          error: 'Invalid file type. Allowed: PNG, JPEG, WebP, GIF'
        });
      }

      // Validate file size (max 10MB)
      const maxSize = 10 * 1024 * 1024;
      // Note: file size is checked during stream processing

      // Generate image key
      const ext = data.mimetype.split('/')[1].replace('jpeg', 'jpg');
      const imageKey = `images/${id}/${nanoid()}.${ext}`;

      // Stream the file to storage
      await uploadStream(
        'uploads',
        imageKey,
        data.file,
        undefined,
        data.mimetype
      );

      return { imageKey };
    } catch (err) {
      fastify.log.error(err, 'Failed to upload image');
      return reply.status(500).send({ error: 'Failed to upload image' });
    }
  });

  // Create SVG animation from uploaded image
  fastify.post('/projects/:id/svg-animation', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({
      imageKey: z.string().min(1),
      animationType: z.enum(['draw', 'motion']),
      animationStyle: z.enum(['elegant', 'playful', 'minimal']),
      durationSeconds: z.number().int().min(1).max(30).default(3),
      trackId: z.string().nullable(),
      startMs: z.number().int().min(0),
      width: z.number().int().min(100).max(4096),
      height: z.number().int().min(100).max(4096),
      description: z.string().optional(),  // Description for scene matching
      sceneId: z.number().int().nullable().optional(),  // Target scene ID
      useOriginalImage: z.boolean().optional(),  // Display original image instead of SVG
    }).parse(request.body);

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, id),
    });

    if (!project) {
      return reply.status(404).send({ error: 'Project not found' });
    }

    // Check ownership
    if (!checkProjectOwnership(project.userId, request.user?.id)) {
      return reply.status(403).send({ error: 'Access denied' });
    }

    // Verify image exists in storage
    const imageExists = await objectExists('uploads', body.imageKey);
    if (!imageExists) {
      return reply.status(400).send({ error: 'Image not found in storage' });
    }

    // Check for existing pending/processing svg-animation job
    const existingJob = await db.query.jobs.findFirst({
      where: and(
        eq(jobs.projectId, id),
        eq(jobs.type, 'svg-animation'),
        or(eq(jobs.status, 'pending'), eq(jobs.status, 'processing'))
      ),
    });

    if (existingJob) {
      return reply.status(409).send({
        error: 'An SVG animation job is already in progress',
        jobId: existingJob.id,
      });
    }

    // Create job record
    const [job] = await db.insert(jobs).values({
      projectId: id,
      type: 'svg-animation',
      status: 'pending',
    }).returning();

    // Queue the job
    // Default to using original image when description is provided (no SVG conversion)
    const useOriginalImage = body.useOriginalImage ?? (body.description ? true : false);

    await queueSvgAnimationJob({
      projectId: id,
      jobId: job.id,
      imageKey: body.imageKey,
      animationType: body.animationType,
      animationStyle: body.animationStyle,
      durationSeconds: body.durationSeconds,
      trackId: body.trackId,
      startMs: body.startMs,
      width: body.width,
      height: body.height,
      description: body.description,
      sceneId: body.sceneId,
      useOriginalImage,
    });

    return { jobId: job.id };
  });

  // Get scenes information for a project (used by AI chat to show scene context)
  fastify.get('/projects/:id/scenes', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, id),
    });

    if (!project) {
      return reply.status(404).send({ error: 'Project not found' });
    }

    // Check ownership
    if (!checkProjectOwnership(project.userId, request.user?.id)) {
      return reply.status(403).send({ error: 'Access denied' });
    }

    // Get visual for this project
    const visual = await db.query.visuals.findFirst({
      where: eq(visuals.projectId, id),
    });

    if (!visual || !visual.timestamps) {
      return { scenes: [], compositionId: visual?.compositionId || null };
    }

    // Check if elements are already in database
    const timestamps = visual.timestamps as Array<{
      startMs: number;
      endMs: number;
      type: string;
      description: string;
      elements?: Array<{
        id: string;
        name: string;
        type: string;
        x: string;
        y: string;
        width: string;
        height: string;
      }>;
    }>;

    const hasElements = timestamps.some(t => t.elements && t.elements.length > 0);

    // If no elements in DB, try to fetch from source files in S3
    let scenesFromSource: any[] | null = null;
    if (!hasElements && visual.compositionId) {
      try {
        const sourceCompositionId = visual.compositionId.replace(/_/g, '-');
        const scenesKey = `${sourceCompositionId}/scenes.json`;
        const exists = await objectExists('sources', scenesKey);

        if (exists) {
          const stream = await getObjectStream('sources', scenesKey);
          const chunks: Buffer[] = [];
          for await (const chunk of stream) {
            chunks.push(Buffer.from(chunk));
          }
          const scenesJson = JSON.parse(Buffer.concat(chunks).toString('utf-8'));

          if (scenesJson.scenes && Array.isArray(scenesJson.scenes)) {
            scenesFromSource = scenesJson.scenes;
          }
        }
      } catch (err) {
        // Silently fail - elements just won't be available
        console.warn('Could not fetch scenes.json from source:', err);
      }
    }

    // Convert timestamps to scene info with ms timing and elements
    const scenes = timestamps.map((t, index) => {
      // Try to get elements from DB first, then from source
      let elements = t.elements?.map(el => ({
        name: el.name,
        type: el.type,
        description: el.name,
        position: { x: el.x, y: el.y },
        size: { width: el.width, height: el.height },
      }));

      // Compute contentDisplayMs from keySync in scenes.json
      let contentDisplayMs: number | undefined;
      if (scenesFromSource) {
        const sourceScene = scenesFromSource[index];

        // If no elements in DB, try to extract from source
        if (!elements && sourceScene?.layout && typeof sourceScene.layout === 'object') {
          elements = Object.entries(sourceScene.layout).map(([key, value]: [string, any]) => ({
            name: key.charAt(0).toUpperCase() + key.slice(1),
            type: key,
            description: key.charAt(0).toUpperCase() + key.slice(1),
            position: { x: value?.x || 'center', y: value?.y || '50%' },
            size: { width: value?.width || '100%', height: value?.height || '100%' },
          }));
        }

        // Extract keySync timing — the frame where main content is displayed
        if (sourceScene?.keySync?.timestamp != null && sourceScene?.timestampRange) {
          const sceneStartSec = sourceScene.timestampRange[0] as number;
          const sceneEndSec = sourceScene.timestampRange[1] as number;
          const keySyncSec = sourceScene.keySync.timestamp as number;
          const sceneDurationSec = sceneEndSec - sceneStartSec;
          if (sceneDurationSec > 0) {
            const ratio = (keySyncSec - sceneStartSec) / sceneDurationSec;
            contentDisplayMs = Math.round(t.startMs + ratio * (t.endMs - t.startMs));
          }
        }
      } else if (!elements) {
        // No source data at all — no elements to extract
      }

      return {
        id: index + 1,
        name: `Scene ${index + 1}`,
        startMs: t.startMs,
        endMs: t.endMs,
        description: t.description || t.type || '',
        elements,
        contentDisplayMs,
      };
    });

    return {
      scenes,
      compositionId: visual.compositionId,
    };
  });

  // Get assets for a project (extracted components for AI editing)
  fastify.get('/projects/:id/assets', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, id),
    });

    if (!project) {
      return reply.status(404).send({ error: 'Project not found' });
    }

    if (!checkProjectOwnership(project.userId, request.user?.id)) {
      return reply.status(403).send({ error: 'Access denied' });
    }

    const visual = await db.query.visuals.findFirst({
      where: eq(visuals.projectId, id),
    });

    if (!visual) {
      return { assets: [], compositionId: null };
    }

    // Try to fetch assets.json from S3 sources
    try {
      const sourceCompositionId = visual.compositionId.replace(/_/g, '-');
      const assetsKey = `${sourceCompositionId}/assets.json`;
      const exists = await objectExists('sources', assetsKey);

      if (exists) {
        const stream = await getObjectStream('sources', assetsKey);
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
          chunks.push(Buffer.from(chunk));
        }
        const assetsData = JSON.parse(Buffer.concat(chunks).toString('utf-8'));

        return {
          assets: assetsData.assets || [],
          compositionId: visual.compositionId,
          extractedAt: assetsData.extractedAt,
        };
      }
    } catch (err) {
      console.warn('Could not fetch assets.json from S3:', err);
    }

    // Fallback: Try local workspace (for development)
    // Try both hyphenated and underscored variants since DB uses hyphens but filesystem may use underscores
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const variants = [
        visual.compositionId,
        visual.compositionId.replace(/-/g, '_'),
      ];
      for (const variant of variants) {
        try {
          const workspacePath = path.join(process.cwd(), '..', 'worker', 'workspace', 'src', variant, 'assets.json');
          const localContent = await fs.readFile(workspacePath, 'utf-8');
          const assetsData = JSON.parse(localContent);
          console.log('Loaded assets from local workspace:', workspacePath);
          return {
            assets: assetsData.assets || [],
            compositionId: visual.compositionId,
            extractedAt: assetsData.extractedAt,
          };
        } catch {
          // Try next variant
        }
      }
    } catch {
      // Local fallback not available
    }

    return { assets: [], compositionId: visual.compositionId };
  });

  // Delete generated visuals for a project (for re-testing)
  fastify.delete('/projects/:id/visuals', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const project = await db.query.projects.findFirst({
        where: eq(projects.id, id),
      });

      if (!project) {
        return reply.status(404).send({ error: 'Project not found' });
      }

      // Check ownership
      if (!checkProjectOwnership(project.userId, request.user?.id)) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      // Get all visuals for this project
      const projectVisuals = await db.query.visuals.findMany({
        where: eq(visuals.projectId, id),
      });

      if (projectVisuals.length === 0) {
        return { message: 'No visuals to delete', deleted: 0 };
      }

      // Delete visual timeline items from all tracks
      const trackList = await db.query.tracks.findMany({
        where: eq(tracks.projectId, id),
      });

      for (const track of trackList) {
        if (track.type === 'visual') {
          // Delete all items on visual tracks
          await db.delete(timelineItems).where(eq(timelineItems.trackId, track.id));
          // Delete the visual track itself
          await db.delete(tracks).where(eq(tracks.id, track.id));
        }
      }

      // Delete visuals from database
      await db.delete(visuals).where(eq(visuals.projectId, id));

      // Delete related jobs (plan + generation) so stale planJobIds aren't referenced
      await db.delete(jobs).where(eq(jobs.projectId, id));

      // Reset project status to allow re-generation
      await db.update(projects)
        .set({ status: 'ready' as ProjectStatus })
        .where(eq(projects.id, id));

      return {
        message: 'Visuals deleted successfully',
        deleted: projectVisuals.length,
        bundleUrls: projectVisuals.map(v => v.bundleUrl),
      };
    } catch (err) {
      fastify.log.error(err, 'Failed to delete visuals');
      return reply.status(500).send({ error: 'Failed to delete visuals', details: String(err) });
    }
  });

  // Separate audio from video and enhance
  fastify.post('/projects/:id/separate-audio', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({
      videoItemId: z.string(),
    }).parse(request.body);

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, id),
    });

    if (!project) {
      return reply.status(404).send({ error: 'Project not found' });
    }

    // Check ownership
    if (!checkProjectOwnership(project.userId, request.user?.id)) {
      return reply.status(403).send({ error: 'Access denied' });
    }

    if (!project.videoKey) {
      return reply.status(400).send({ error: 'No video uploaded' });
    }

    // Create audio track
    const [audioTrack] = await db.insert(tracks).values({
      projectId: id,
      type: 'audio',
      name: 'Audio',
      position: 2,
    }).returning();

    // Create audio timeline item (spans full video duration)
    const [audioItem] = await db.insert(timelineItems).values({
      trackId: audioTrack.id,
      type: 'audio',
      startMs: 0,
      endMs: project.durationMs || 0,
      data: {
        src: '',
        originalSrc: '',
        isEnhanced: false,
        sourceVideoItemId: body.videoItemId,
        volume: 1,
        enhancementStatus: 'processing',
        enhancementProgress: 0,
      },
    }).returning();

    // Create job record
    const [job] = await db.insert(jobs).values({
      projectId: id,
      type: 'enhance-audio',
      status: 'pending',
    }).returning();

    // Queue the enhancement job
    await queueEnhanceAudioJob({
      projectId: id,
      jobId: job.id,
      videoKey: project.videoKey,
      audioTrackId: audioTrack.id,
      audioItemId: audioItem.id,
      videoItemId: body.videoItemId,
    });

    return {
      jobId: job.id,
      trackId: audioTrack.id,
      itemId: audioItem.id,
    };
  });

  // Get download URL
  fastify.get('/projects/:id/download', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, id),
    });

    if (!project) {
      return reply.status(404).send({ error: 'Project not found' });
    }

    // Check ownership
    if (!checkProjectOwnership(project.userId, request.user?.id)) {
      return reply.status(403).send({ error: 'Access denied' });
    }

    if (!project.outputKey) {
      return reply.status(400).send({ error: 'No rendered output available' });
    }

    const url = await getPresignedDownloadUrl('outputs', project.outputKey);

    const expiresAt = new Date(Date.now() + 3600 * 1000); // 1 hour

    return { url, expiresAt };
  });

  // Delete a project
  fastify.delete('/projects/:id', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, id),
    });

    if (!project) {
      return reply.status(404).send({ error: 'Project not found' });
    }

    // Check ownership
    if (!checkProjectOwnership(project.userId, request.user?.id)) {
      return reply.status(403).send({ error: 'Access denied' });
    }

    // Delete project (cascade will handle tracks, items, jobs, transcripts, visuals)
    await db.delete(projects).where(eq(projects.id, id));

    // Note: We're not deleting files from storage here for simplicity
    // Could add cleanup job later if needed

    return { success: true, message: 'Project deleted' };
  });

  // Get project thumbnail
  fastify.get('/projects/:id/thumbnail', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, id),
    });

    if (!project) {
      return reply.status(404).send({ error: 'Project not found' });
    }

    // Check ownership
    if (!checkProjectOwnership(project.userId, request.user?.id)) {
      return reply.status(403).send({ error: 'Access denied' });
    }

    if (!project.thumbnailKey) {
      // Return 204 No Content if no thumbnail
      return reply.status(204).send();
    }

    // Check if thumbnail exists
    const exists = await objectExists('uploads', project.thumbnailKey);
    if (!exists) {
      return reply.status(204).send();
    }

    try {
      const stream = await getObjectStream('uploads', project.thumbnailKey);
      reply.header('Content-Type', 'image/jpeg');
      reply.header('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
      return reply.send(stream);
    } catch (err) {
      fastify.log.error(err, 'Failed to get thumbnail');
      return reply.status(500).send({ error: 'Failed to get thumbnail' });
    }
  });

  // Stream a media file from storage (used for enhanced/original audio)
  // URL format: /media/:prefix/* where prefix is 'uploads' or 'outputs'
  fastify.get('/media/:prefix/*', async (request, reply) => {
    const { prefix } = request.params as { prefix: string };
    const key = (request.params as Record<string, string>)['*'];

    if (!key) {
      return reply.status(400).send({ error: 'Missing key' });
    }

    // Only allow known prefixes
    const allowedPrefixes = ['uploads', 'outputs'] as const;
    if (!allowedPrefixes.includes(prefix as typeof allowedPrefixes[number])) {
      return reply.status(403).send({ error: 'Prefix not allowed' });
    }

    const storagePrefix = prefix as 'uploads' | 'outputs';

    const exists = await objectExists(storagePrefix, key);
    if (!exists) {
      return reply.status(404).send({ error: 'File not found' });
    }

    const stat = await getObjectStat(storagePrefix, key);
    const totalSize = stat.size;
    const ext = key.split('.').pop()?.toLowerCase();
    const contentTypes: Record<string, string> = {
      m4a: 'audio/mp4',
      mp4: 'video/mp4',
      wav: 'audio/wav',
      mp3: 'audio/mpeg',
      mov: 'video/quicktime',
      webm: 'video/webm',
    };
    const contentType = contentTypes[ext || ''] || 'application/octet-stream';

    // Handle Range requests for media seeking/switching
    const rangeHeader = request.headers.range;
    if (rangeHeader) {
      const match = rangeHeader.match(/^bytes=(\d+)-(\d*)$/);
      if (match) {
        const start = parseInt(match[1], 10);
        const end = match[2] ? parseInt(match[2], 10) : totalSize - 1;
        const chunkSize = end - start + 1;

        const stream = await getPartialObjectStream(storagePrefix, key, start, chunkSize);
        reply.status(206);
        reply.header('Content-Type', contentType);
        reply.header('Content-Length', chunkSize);
        reply.header('Content-Range', `bytes ${start}-${end}/${totalSize}`);
        reply.header('Accept-Ranges', 'bytes');
        return reply.send(stream);
      }
    }

    // Full file response
    const stream = await getObjectStream(storagePrefix, key);
    reply.header('Content-Type', contentType);
    reply.header('Content-Length', totalSize);
    reply.header('Accept-Ranges', 'bytes');
    return reply.send(stream);
  });

  // Get job status
  fastify.get('/jobs/:id', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const job = await db.query.jobs.findFirst({
      where: eq(jobs.id, id),
    });

    if (!job) {
      return reply.status(404).send({ error: 'Job not found' });
    }

    // Verify job belongs to user's project
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, job.projectId),
    });

    if (!project || !checkProjectOwnership(project.userId, request.user?.id)) {
      return reply.status(403).send({ error: 'Access denied' });
    }

    return job;
  });

  // Cancel a job
  fastify.post('/jobs/:id/cancel', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const job = await db.query.jobs.findFirst({
      where: eq(jobs.id, id),
    });

    if (!job) {
      return reply.status(404).send({ error: 'Job not found' });
    }

    // Verify job belongs to user's project
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, job.projectId),
    });

    if (!project || !checkProjectOwnership(project.userId, request.user?.id)) {
      return reply.status(403).send({ error: 'Access denied' });
    }

    if (job.status !== 'processing' && job.status !== 'pending') {
      return reply.status(400).send({ error: 'Job cannot be cancelled' });
    }

    // Publish cancel command to worker
    await publishJobCancel(id);

    // Update job status
    await db.update(jobs)
      .set({ status: 'cancelled', error: 'Cancelled by user' })
      .where(eq(jobs.id, id));

    // Reset project status
    await db.update(projects)
      .set({ status: 'ready' })
      .where(eq(projects.id, job.projectId));

    return { success: true, message: 'Job cancellation requested' };
  });
}
