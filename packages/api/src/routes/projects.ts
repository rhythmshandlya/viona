import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { eq, inArray, or, and, desc } from 'drizzle-orm';
import { db, projects, tracks, timelineItems, jobs, transcripts, visuals, projectAssets } from '../db/index.js';
import { getPresignedUploadUrl, getPresignedDownloadUrl, objectExists, getObjectStream, getPartialObjectStream, getObjectStat, uploadStream, deleteObjectsByPrefix, deleteObject } from '../services/minio.js';
import { queueTranscribeJob, queueRenderJob, queueEnhanceAudioJob, queueGenerateVisualsJob, queueEditVisualsJob, queueSvgAnimationJob, queuePreloadProjectJob, queueHeadTrackingJob, queueGenerateCaptionStylesJob, publishJobCancel, segmentationQueue } from '../services/queue.js';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.js';
import type { ProjectStatus } from '@viona/shared';
import { apiProgressStore } from '../progress/progress-store.js';
import { logger } from '../logger.js';

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
  // IDs of all visual items currently in the editor — DB items not in this list are deleted
  visualItemIds: z.array(z.string()).optional(),
  // IDs of all video items currently in the editor — DB items not in this list are deleted
  videoItemIds: z.array(z.string()).optional(),
  // IDs of all audio items currently in the editor — DB items not in this list are deleted
  audioItemIds: z.array(z.string()).optional(),
  videoSettings: z.record(z.unknown()).optional(),
});

// Helper to check if a user owns a project
function checkProjectOwnership(projectUserId: string | null, userId: string | undefined): boolean {
  if (!userId) return false;
  // Legacy projects with no owner: deny access (admin can reassign via DB)
  if (!projectUserId) return false;
  return projectUserId === userId;
}

export async function projectRoutes(fastify: FastifyInstance) {
  // Create a new project
  fastify.post('/projects', { preHandler: authMiddleware }, async (request, reply) => {
    const body = createProjectSchema.parse(request.body);

    // Detect audio files by extension
    const audioExtensions = ['.mp3', '.m4a', '.wav', '.ogg', '.flac'];
    const ext = body.filename.toLowerCase().match(/\.[^.]+$/)?.[0] || '';
    const isAudio = audioExtensions.includes(ext);

    // Generate storage key
    const storageKey = `${nanoid()}/${body.filename}`;

    // Create project in database with user ownership
    const [project] = await db.insert(projects).values({
      status: 'uploading' as ProjectStatus,
      title: body.title || null,
      projectType: isAudio ? 'audio' : 'video',
      videoKey: isAudio ? null : storageKey,
      audioKey: isAudio ? storageKey : null,
      userId: request.user!.id, // Associate with authenticated user
    }).returning();

    // Create default video track only for video projects
    if (!isAudio) {
      await db.insert(tracks).values({
        projectId: project.id,
        type: 'video',
        name: 'Video',
        position: 0,
      });
    }

    // Get presigned upload URL
    const uploadUrl = await getPresignedUploadUrl('uploads', storageKey);

    return {
      projectId: project.id,
      uploadUrl,
      projectType: project.projectType,
      // Also return videoKey for proxy upload (or audioKey for audio)
      videoKey: storageKey,
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

    const storageKey = project.videoKey || project.audioKey;
    if (!storageKey) {
      return reply.status(400).send({ error: 'Project has no storage key' });
    }

    try {
      const data = await request.file();
      if (!data) {
        return reply.status(400).send({ error: 'No file uploaded' });
      }

      // Stream the file directly to MinIO
      await uploadStream(
        'uploads',
        storageKey,
        data.file,
        undefined, // size unknown for streams
        data.mimetype
      );

      // For video projects, create video item and trigger segmentation
      if (project.projectType !== 'audio' && project.videoKey) {
        // Find the video track
        const videoTrack = await db.query.tracks.findFirst({
          where: and(eq(tracks.projectId, id), eq(tracks.type, 'video')),
        });

        if (videoTrack) {
          // Check if a video item already exists
          const existingVideoItem = await db.select().from(timelineItems).where(
            and(eq(timelineItems.trackId, videoTrack.id), eq(timelineItems.type, 'video'))
          );

          if (existingVideoItem.length === 0) {
            // Create video timeline item (duration will be updated by transcribe worker)
            const [videoItem] = await db.insert(timelineItems).values({
              trackId: videoTrack.id,
              type: 'video',
              startMs: 0,
              endMs: 0, // Will be updated once duration is known
              data: {
                src: `/api/projects/${id}/video`,
                volume: 1,
              },
            }).returning();

            // Queue segmentation job (non-blocking)
            segmentationQueue.add('segment-video', {
              projectId: id,
              videoItemId: videoItem.id,
              videoKey: project.videoKey,
            }).catch((err) => {
              fastify.log.warn({ err, projectId: id }, 'Failed to queue segmentation job (non-critical)');
            });
          }
        }
      }

      return { success: true, videoKey: storageKey };
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

    // Generate presigned URL for video playback (valid for 8 hours)
    // This allows the frontend to load video without cookies for cross-origin requests
    const PRESIGNED_TTL = 28800; // 8 hours — covers a full editing session
    let videoPresignedUrl: string | null = null;
    if (project.videoKey) {
      try {
        fastify.log.info({ videoKey: project.videoKey }, 'Checking if video exists for presigned URL');
        const exists = await objectExists('uploads', project.videoKey);
        fastify.log.info({ videoKey: project.videoKey, exists }, 'Video exists check result');
        if (exists) {
          videoPresignedUrl = await getPresignedDownloadUrl('uploads', project.videoKey, PRESIGNED_TTL);
          fastify.log.info({ videoKey: project.videoKey, urlGenerated: !!videoPresignedUrl, videoPresignedUrl }, 'Presigned URL generated');
        }
      } catch (err) {
        fastify.log.warn({ err, videoKey: project.videoKey }, 'Failed to generate presigned URL for video');
      }
    } else {
      fastify.log.info({ projectId: id }, 'No videoKey for project, skipping presigned URL');
    }

    // Generate presigned URL for audio playback (audio projects)
    let audioPresignedUrl: string | null = null;
    if (project.audioKey) {
      try {
        const exists = await objectExists('uploads', project.audioKey);
        if (exists) {
          audioPresignedUrl = await getPresignedDownloadUrl('uploads', project.audioKey, PRESIGNED_TTL);
        }
      } catch (err) {
        fastify.log.warn({ err, audioKey: project.audioKey }, 'Failed to generate presigned URL for audio');
      }
    }

    // Auto-create audio track + item if a video project has no audio track yet
    if (project.videoKey && project.projectType !== 'audio') {
      const hasAudioTrack = projectTracks.some(t => t.type === 'audio');
      if (!hasAudioTrack) {
        try {
          // Find the video track/item to copy timing from
          const videoTrack = projectTracks.find(t => t.type === 'video');
          const videoItem = videoTrack
            ? items.find(i => i.trackId === videoTrack.id && i.type === 'video')
            : null;

          const startMs = videoItem ? videoItem.startMs : 0;
          const endMs = videoItem ? videoItem.endMs : (project.durationMs || 0);

          if (endMs > startMs) {
            // Store a stable API path as src — the frontend resolves it with the API_URL
            const stableSrc = `/api/projects/${id}/video`;

            const [audioTrack] = await db.insert(tracks).values({
              projectId: id,
              type: 'audio',
              name: 'Audio',
              position: projectTracks.length,
              locked: false,
              visible: true,
            }).returning();

            const [audioItem] = await db.insert(timelineItems).values({
              trackId: audioTrack.id,
              type: 'audio',
              startMs,
              endMs,
              data: {
                src: stableSrc,
                originalSrc: stableSrc,
                isEnhanced: false,
                sourceVideoItemId: videoItem?.id || '',
                volume: 1,
              },
            }).returning();

            projectTracks.push(audioTrack);
            items.push(audioItem);
          }
        } catch (err) {
          fastify.log.warn({ err, projectId: id }, 'Failed to auto-create audio track (non-critical)');
        }
      }
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
      audioPresignedUrl,
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

  // Stream audio file (for audio projects)
  fastify.get('/projects/:id/audio', { preHandler: authMiddleware }, async (request, reply) => {
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

    if (!project.audioKey) {
      return reply.status(400).send({ error: 'No audio uploaded' });
    }

    const exists = await objectExists('uploads', project.audioKey);
    if (!exists) {
      return reply.status(404).send({ error: 'Audio not found in storage' });
    }

    try {
      const stat = await getObjectStat('uploads', project.audioKey);
      const ext = project.audioKey.split('.').pop()?.toLowerCase();
      const contentTypes: Record<string, string> = {
        mp3: 'audio/mpeg',
        m4a: 'audio/mp4',
        wav: 'audio/wav',
        ogg: 'audio/ogg',
        flac: 'audio/flac',
      };
      const contentType = contentTypes[ext || ''] || 'application/octet-stream';

      const range = request.headers.range;
      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
        const chunkSize = end - start + 1;

        const stream = await getPartialObjectStream('uploads', project.audioKey, start, chunkSize);
        reply.status(206);
        reply.header('Content-Range', `bytes ${start}-${end}/${stat.size}`);
        reply.header('Accept-Ranges', 'bytes');
        reply.header('Content-Length', chunkSize);
        reply.header('Content-Type', contentType);
        return reply.send(stream);
      }

      const stream = await getObjectStream('uploads', project.audioKey);
      reply.header('Content-Type', contentType);
      reply.header('Content-Length', stat.size);
      reply.header('Accept-Ranges', 'bytes');
      return reply.send(stream);
    } catch (err) {
      fastify.log.error(err, 'Failed to stream audio');
      return reply.status(500).send({ error: 'Failed to stream audio' });
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

    // Delete visual items that no longer exist in the editor (removed by split)
    if (body.visualItemIds) {
      const trackIds = (await db.query.tracks.findMany({
        where: eq(tracks.projectId, id),
      })).map(t => t.id);

      if (trackIds.length > 0) {
        // Find all visual items in the project
        const existingVisualItems = await db.select({ id: timelineItems.id }).from(timelineItems)
          .where(and(
            inArray(timelineItems.trackId, trackIds),
            eq(timelineItems.type, 'visual')
          ));

        // Delete items not in the editor's current list
        const visualIdsToDelete = existingVisualItems
          .map(i => i.id)
          .filter(dbId => !body.visualItemIds!.includes(dbId));

        if (visualIdsToDelete.length > 0) {
          await db.delete(timelineItems).where(inArray(timelineItems.id, visualIdsToDelete));
          fastify.log.info({ deletedCount: visualIdsToDelete.length }, 'Deleted orphaned visual items from split');
        }
      }

      // Sync visuals.timestamps from current timeline state
      const visual = await db.query.visuals.findFirst({
        where: eq(visuals.projectId, id),
      });

      if (visual?.timestamps) {
        const originalTimestamps = visual.timestamps as Array<{
          startMs: number;
          endMs: number;
          type: string;
          description: string;
          sourceSceneId?: number;
          elements?: Array<{ id: string; name: string; type: string; x: string; y: string; width: string; height: string }>;
        }>;

        // Get all current visual items sorted by startMs
        const trackIds2 = (await db.query.tracks.findMany({
          where: eq(tracks.projectId, id),
        })).map(t => t.id);

        const currentVisualItems = trackIds2.length > 0
          ? await db.select().from(timelineItems)
              .where(and(
                inArray(timelineItems.trackId, trackIds2),
                eq(timelineItems.type, 'visual')
              ))
          : [];

        currentVisualItems.sort((a, b) => a.startMs - b.startMs);

        // Rebuild timestamps array from current timeline items
        const newTimestamps = currentVisualItems.map((item) => {
          const data = item.data as Record<string, unknown>;
          const itemSourceSceneId = data.sourceSceneId as number | undefined;

          // Match to original timestamp: prefer sourceSceneId, fall back to time overlap
          let matched: typeof originalTimestamps[0] | undefined;
          if (itemSourceSceneId) {
            matched = originalTimestamps.find(t => (t.sourceSceneId || 0) === itemSourceSceneId)
              || originalTimestamps[itemSourceSceneId - 1];
          }
          if (!matched) {
            // Time-overlap matching: find the original timestamp with most overlap
            let bestOverlap = 0;
            for (const t of originalTimestamps) {
              const overlapStart = Math.max(item.startMs, t.startMs);
              const overlapEnd = Math.min(item.endMs, t.endMs);
              const overlap = Math.max(0, overlapEnd - overlapStart);
              if (overlap > bestOverlap) {
                bestOverlap = overlap;
                matched = t;
              }
            }
          }

          return {
            startMs: item.startMs,
            endMs: item.endMs,
            type: matched?.type || (data.type as string) || 'visual',
            description: matched?.description || (data.description as string) || '',
            sourceSceneId: itemSourceSceneId || matched?.sourceSceneId,
            elements: matched?.elements,
          };
        });

        // Update visuals.timestamps in DB
        await db.update(visuals)
          .set({ timestamps: newTimestamps })
          .where(eq(visuals.id, visual.id));
        fastify.log.info({ projectId: id, sceneCount: newTimestamps.length }, 'Synced visuals.timestamps from timeline state');
      }
    }

    // Delete video items that no longer exist in the editor (removed by split/delete)
    if (body.videoItemIds) {
      const trackIds = (await db.query.tracks.findMany({
        where: eq(tracks.projectId, id),
      })).map(t => t.id);

      if (trackIds.length > 0) {
        const existingVideoItems = await db.select({ id: timelineItems.id }).from(timelineItems)
          .where(and(
            inArray(timelineItems.trackId, trackIds),
            eq(timelineItems.type, 'video')
          ));

        const videoIdsToDelete = existingVideoItems
          .map(i => i.id)
          .filter(dbId => !body.videoItemIds!.includes(dbId));

        if (videoIdsToDelete.length > 0) {
          await db.delete(timelineItems).where(inArray(timelineItems.id, videoIdsToDelete));
          fastify.log.info({ deletedCount: videoIdsToDelete.length }, 'Deleted orphaned video items from split');
        }
      }
    }

    // Delete audio items that no longer exist in the editor (removed by split/delete)
    if (body.audioItemIds) {
      const trackIds = (await db.query.tracks.findMany({
        where: eq(tracks.projectId, id),
      })).map(t => t.id);

      if (trackIds.length > 0) {
        const existingAudioItems = await db.select({ id: timelineItems.id }).from(timelineItems)
          .where(and(
            inArray(timelineItems.trackId, trackIds),
            eq(timelineItems.type, 'audio')
          ));

        const audioIdsToDelete = existingAudioItems
          .map(i => i.id)
          .filter(dbId => !body.audioItemIds!.includes(dbId));

        if (audioIdsToDelete.length > 0) {
          await db.delete(timelineItems).where(inArray(timelineItems.id, audioIdsToDelete));
          fastify.log.info({ deletedCount: audioIdsToDelete.length }, 'Deleted orphaned audio items from split');
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

  // Start processing (transcription + head-tracking in parallel)
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

    const isAudio = project.projectType === 'audio';
    const mediaKey = isAudio ? project.audioKey : project.videoKey;

    if (!mediaKey) {
      return reply.status(400).send({ error: isAudio ? 'No audio uploaded' : 'No video uploaded' });
    }

    // Check if media exists in storage
    const exists = await objectExists('uploads', mediaKey);
    if (!exists) {
      return reply.status(400).send({ error: `${isAudio ? 'Audio' : 'Video'} not found in storage` });
    }

    // Create transcription job
    const [transcribeJob] = await db.insert(jobs).values({
      projectId: id,
      type: 'transcribe',
      status: 'pending',
    }).returning();

    // Audio projects: only 1 job (transcribe). No enhance-audio, no audio track/item here.
    // The transcribe worker creates the audio track for audio projects.
    if (isAudio) {
      // Update project status
      await db.update(projects)
        .set({ status: 'processing' })
        .where(eq(projects.id, id));

      await queueTranscribeJob({
        projectId: id,
        jobId: transcribeJob.id,
        videoKey: mediaKey,
      });

      return {
        jobId: transcribeJob.id,
        transcribeJobId: transcribeJob.id,
        enhanceJobId: null,
        totalJobs: 1,
      };
    }

    // Video projects: transcribe + head-tracking in parallel
    const [headTrackJob] = await db.insert(jobs).values({
      projectId: id,
      type: 'head-tracking',
      status: 'pending',
    }).returning();

    // Update project status
    await db.update(projects)
      .set({ status: 'processing' })
      .where(eq(projects.id, id));

    await Promise.all([
      queueTranscribeJob({
        projectId: id,
        jobId: transcribeJob.id,
        videoKey: mediaKey,
      }),
      queueHeadTrackingJob({
        projectId: id,
        jobId: headTrackJob.id,
        videoKey: mediaKey,
      }),
    ]);

    return {
      jobId: transcribeJob.id,
      transcribeJobId: transcribeJob.id,
      enhanceJobId: null,
      headTrackJobId: headTrackJob.id,
      totalJobs: 2,
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
    const body = request.body as { layoutSettings?: any; fullscreenSegments?: Array<{ startMs: number; endMs: number }>; visualDisplayData?: Array<{ startMs: number; endMs: number; displayMode?: string; transition?: { enter: { type: string; durationMs: number }; exit: { type: string; durationMs: number } } }> } || {};

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

    // Queue the job with layout settings, fullscreen segments, and visual display data for exact preview match
    await queueRenderJob({
      projectId: id,
      jobId: job.id,
      projectType: project.projectType || 'video',
      layoutSettings: body.layoutSettings,
      fullscreenSegments: body.fullscreenSegments,
      visualDisplayData: body.visualDisplayData,
    });

    return { jobId: job.id };
  });

  // Generate AI caption styles — LLM analyzes transcript and generates per-caption style overrides
  fastify.post('/projects/:id/generate-caption-styles', { preHandler: authMiddleware }, async (request, reply) => {
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

    // Create job record
    const [job] = await db.insert(jobs).values({
      projectId: id,
      type: 'generate-caption-styles',
      status: 'pending',
    }).returning();

    await queueGenerateCaptionStylesJob({
      projectId: id,
      jobId: job.id,
    });

    return { jobId: job.id };
  });

  // Generate AI visuals
  fastify.post('/projects/:id/generate-visuals', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({
      stylePreset: z.string(),
      layoutMode: z.enum(['pip', 'stacked']),
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

  // Upload a project media asset (logo, icon, brand image)
  fastify.post('/projects/:id/media', { preHandler: authMiddleware }, async (request, reply) => {
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

    try {
      const data = await request.file();
      if (!data) {
        return reply.status(400).send({ error: 'No file uploaded' });
      }

      const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'];
      if (!allowedTypes.includes(data.mimetype)) {
        return reply.status(400).send({
          error: 'Invalid file type. Allowed: PNG, JPEG, WebP, GIF, SVG'
        });
      }

      // Read label and description from multipart fields
      const label = (data.fields?.label as any)?.value as string | undefined;
      const description = (data.fields?.description as any)?.value as string | undefined;

      const ext = data.mimetype === 'image/svg+xml' ? 'svg'
        : data.mimetype.split('/')[1].replace('jpeg', 'jpg');
      const storageKey = `assets/${id}/${nanoid()}.${ext}`;

      await uploadStream('uploads', storageKey, data.file, undefined, data.mimetype);

      // Validate file size AFTER stream consumption (bytesRead is 0 before)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (data.file.bytesRead > maxSize) {
        // Clean up the already-uploaded file
        try { await deleteObject('uploads', storageKey); } catch {}
        return reply.status(413).send({ error: 'File too large (max 10MB)' });
      }

      const [asset] = await db.insert(projectAssets).values({
        projectId: id,
        filename: data.filename,
        label: label || null,
        description: description || null,
        storageKey,
        contentType: data.mimetype,
        fileSize: data.file.bytesRead || null,
      }).returning();

      const url = await getPresignedDownloadUrl('uploads', storageKey);

      return {
        id: asset.id,
        filename: asset.filename,
        label: asset.label,
        description: asset.description,
        mimeType: asset.contentType,
        fileSize: asset.fileSize,
        url,
        createdAt: asset.createdAt.toISOString(),
      };
    } catch (err) {
      fastify.log.error(err, 'Failed to upload media asset');
      return reply.status(500).send({ error: 'Failed to upload media asset' });
    }
  });

  // List project media assets
  fastify.get('/projects/:id/media', { preHandler: authMiddleware }, async (request, reply) => {
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

    const assets = await db.select().from(projectAssets)
      .where(eq(projectAssets.projectId, id))
      .orderBy(desc(projectAssets.createdAt));

    const assetsWithUrls = await Promise.all(assets.map(async (asset) => {
      const url = await getPresignedDownloadUrl('uploads', asset.storageKey);
      return {
        id: asset.id,
        filename: asset.filename,
        label: asset.label,
        description: asset.description,
        mimeType: asset.contentType,
        fileSize: asset.fileSize,
        url,
        createdAt: asset.createdAt.toISOString(),
      };
    }));

    return { assets: assetsWithUrls };
  });

  // Update a project media asset (label, description)
  const updateAssetSchema = z.object({
    label: z.string().max(255).optional(),
    description: z.string().max(2000).optional(),
  });

  fastify.patch('/projects/:id/media/:assetId', { preHandler: authMiddleware }, async (request, reply) => {
    const { id, assetId } = request.params as { id: string; assetId: string };

    const parsed = updateAssetSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid input', details: parsed.error.flatten() });
    }
    const { label, description } = parsed.data;

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, id),
    });

    if (!project) {
      return reply.status(404).send({ error: 'Project not found' });
    }

    if (!checkProjectOwnership(project.userId, request.user?.id)) {
      return reply.status(403).send({ error: 'Access denied' });
    }

    const asset = await db.query.projectAssets.findFirst({
      where: and(eq(projectAssets.id, assetId), eq(projectAssets.projectId, id)),
    });

    if (!asset) {
      return reply.status(404).send({ error: 'Asset not found' });
    }

    const updates: { label?: string | null; description?: string | null } = {};
    if (label !== undefined) updates.label = label || null;
    if (description !== undefined) updates.description = description || null;

    if (Object.keys(updates).length === 0) {
      return reply.status(400).send({ error: 'No fields to update' });
    }

    const [updated] = await db.update(projectAssets)
      .set(updates)
      .where(eq(projectAssets.id, assetId))
      .returning();

    const url = await getPresignedDownloadUrl('uploads', updated.storageKey);

    return {
      id: updated.id,
      filename: updated.filename,
      label: updated.label,
      description: updated.description,
      mimeType: updated.contentType,
      fileSize: updated.fileSize,
      url,
      createdAt: updated.createdAt.toISOString(),
    };
  });

  // Delete a project media asset
  fastify.delete('/projects/:id/media/:assetId', { preHandler: authMiddleware }, async (request, reply) => {
    const { id, assetId } = request.params as { id: string; assetId: string };

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, id),
    });

    if (!project) {
      return reply.status(404).send({ error: 'Project not found' });
    }

    if (!checkProjectOwnership(project.userId, request.user?.id)) {
      return reply.status(403).send({ error: 'Access denied' });
    }

    const asset = await db.query.projectAssets.findFirst({
      where: and(eq(projectAssets.id, assetId), eq(projectAssets.projectId, id)),
    });

    if (!asset) {
      return reply.status(404).send({ error: 'Asset not found' });
    }

    // Delete from storage and DB
    try {
      await deleteObject('uploads', asset.storageKey);
    } catch (err) {
      fastify.log.warn({ err, storageKey: asset.storageKey }, 'Failed to delete asset from storage');
    }

    await db.delete(projectAssets).where(eq(projectAssets.id, assetId));

    return { success: true };
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
        logger.warn({ err }, 'Could not fetch scenes.json from source');
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
      logger.warn({ err }, 'Could not fetch assets.json from S3');
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
          logger.info({ workspacePath }, 'Loaded assets from local workspace');
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

      // Delete related jobs (plan + generation) so stale planJobIds aren't referenced
      await db.delete(jobs).where(eq(jobs.projectId, id));

      // Reset project status and clear stale outputKey
      await db.update(projects)
        .set({ status: 'ready' as ProjectStatus, outputKey: null })
        .where(eq(projects.id, id));

      // Get all visuals for this project
      const projectVisuals = await db.query.visuals.findMany({
        where: eq(visuals.projectId, id),
      });

      if (projectVisuals.length === 0) {
        return { message: 'No visuals to delete (plan and jobs cleared)', deleted: 0 };
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

      // Delete MinIO storage files (bundles + sources) for each visual
      const storageCleanup: Promise<unknown>[] = [];
      for (const visual of projectVisuals) {
        const compId = visual.compositionId;
        storageCleanup.push(
          deleteObjectsByPrefix('outputs', `bundles/${compId}/`).catch(err =>
            fastify.log.warn({ compositionId: compId, err }, 'Failed to delete bundle files from storage')
          ),
          deleteObjectsByPrefix('outputs', `sources/${compId}/`).catch(err =>
            fastify.log.warn({ compositionId: compId, err }, 'Failed to delete source files from storage')
          ),
        );
      }
      await Promise.all(storageCleanup);

      // Delete visuals from database
      await db.delete(visuals).where(eq(visuals.projectId, id));

      return {
        message: 'Visuals deleted successfully',
        deleted: projectVisuals.length,
      };
    } catch (err) {
      fastify.log.error(err, 'Failed to delete visuals');
      return reply.status(500).send({ error: 'Failed to delete visuals', details: String(err) });
    }
  });

  // Separate audio from video (returns video source as audio track — no enhancement)
  fastify.post('/projects/:id/separate-audio', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { videoItemId } = request.body as { videoItemId?: string };

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, id),
    });

    if (!project) {
      return reply.status(404).send({ error: 'Project not found' });
    }

    if (!checkProjectOwnership(project.userId, request.user?.id)) {
      return reply.status(403).send({ error: 'Access denied' });
    }

    if (!project.videoKey) {
      return reply.status(400).send({ error: 'Project has no video' });
    }

    // Check if audio track already exists
    const existingTracks = await db.query.tracks.findMany({
      where: eq(tracks.projectId, id),
    });
    if (existingTracks.some(t => t.type === 'audio')) {
      return reply.status(409).send({ error: 'Audio track already exists' });
    }

    // Get video item timing
    const videoTrack = existingTracks.find(t => t.type === 'video');
    let startMs = 0;
    let endMs = project.durationMs || 0;
    if (videoTrack) {
      const videoItems = await db.select().from(timelineItems).where(
        and(eq(timelineItems.trackId, videoTrack.id), eq(timelineItems.type, 'video'))
      );
      if (videoItems[0]) {
        startMs = videoItems[0].startMs;
        endMs = videoItems[0].endMs;
      }
    }

    const stableSrc = `/api/projects/${id}/video`;

    // Persist to database
    const [audioTrack] = await db.insert(tracks).values({
      projectId: id,
      type: 'audio',
      name: 'Audio',
      position: existingTracks.length,
      locked: false,
      visible: true,
    }).returning();

    const [audioItem] = await db.insert(timelineItems).values({
      trackId: audioTrack.id,
      type: 'audio',
      startMs,
      endMs,
      data: {
        src: stableSrc,
        originalSrc: stableSrc,
        isEnhanced: false,
        sourceVideoItemId: videoItemId || '',
        volume: 1,
      },
    }).returning();

    // Return presigned URL for immediate playback
    const src = await getPresignedDownloadUrl('uploads', project.videoKey);

    return { trackId: audioTrack.id, itemId: audioItem.id, src };
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

  // Update plan scenes (manual edits from the frontend)
  fastify.patch('/projects/:id/plan/:planJobId', { preHandler: authMiddleware }, async (request, reply) => {
    const { id, planJobId } = request.params as { id: string; planJobId: string };

    const updatePlanScenesSchema = z.object({
      scenes: z.array(z.object({
        id: z.number(),
        title: z.string().optional(),
        description: z.string().optional(),
        displayMode: z.enum(['default', 'fullscreen', 'overlay']).optional(),
      })),
    });

    const body = updatePlanScenesSchema.parse(request.body);

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, id),
    });

    if (!project) {
      return reply.status(404).send({ error: 'Project not found' });
    }

    if (!checkProjectOwnership(project.userId, request.user?.id)) {
      return reply.status(403).send({ error: 'Access denied' });
    }

    const planJob = await db.query.jobs.findFirst({
      where: and(eq(jobs.id, planJobId), eq(jobs.projectId, id)),
    });

    if (!planJob || !planJob.planData) {
      return reply.status(404).send({ error: 'Plan job not found or has no plan data' });
    }

    if (planJob.status !== 'complete') {
      return reply.status(409).send({ error: 'Plan is still being generated. Wait for it to complete before editing.' });
    }

    const planData = planJob.planData as { scenePlan: string; scenes: Record<string, unknown> };
    const scenesObj = planData.scenes as Record<string, unknown>;
    const scenesArray = (scenesObj.scenes as Array<Record<string, unknown>>) || [];

    // Apply partial updates
    for (const update of body.scenes) {
      const scene = scenesArray.find((s: any) => s.id === update.id) as Record<string, unknown> | undefined;
      if (!scene) continue;

      if (update.title !== undefined) {
        scene.name = update.title;
      }
      if (update.description !== undefined) {
        scene.visual = update.description;
      }
      if (update.displayMode !== undefined) {
        scene.displayMode = update.displayMode;
      }
    }

    // Rebuild markdown from scenes (same logic as update_plan tool)
    const updatedMarkdown = scenesArray.map((s: any) => {
      const startS = (s.timestampRange?.[0] ?? 0).toFixed(1);
      const endS = (s.timestampRange?.[1] ?? 0).toFixed(1);
      return `### Scene ${s.id}: ${s.name} (${startS}s – ${endS}s)\n**Visual**: ${s.visual || ''}\n**Emotion**: ${s.emotion || ''}`;
    }).join('\n\n');

    // Save back to DB
    const updatedPlanData = {
      scenePlan: updatedMarkdown,
      scenes: { ...scenesObj, scenes: scenesArray, totalScenes: scenesArray.length },
    };
    await db.update(jobs).set({ planData: updatedPlanData }).where(eq(jobs.id, planJobId));

    // Return updated scenes in widget format
    const widgetScenes = scenesArray.map((s: any) => ({
      startMs: Math.round((s.timestampRange?.[0] || 0) * 1000),
      endMs: Math.round((s.timestampRange?.[1] || 0) * 1000),
      title: s.name || `Scene ${s.id}`,
      description: s.visual || s.emotion || '',
      emotion: s.emotion || '',
      keySync: s.keySync ? {
        word: s.keySync.word,
        timestamp: s.keySync.timestamp,
        visualEvent: s.keySync.visualEvent,
      } : undefined,
      buildsFrom: s.buildsFrom || null,
      connectsTo: s.connectsTo || null,
      layout: s.layout || null,
      frames: s.frames || null,
      icons: s.icons || [],
      displayMode: s.displayMode || 'default',
      transition: s.transition || undefined,
    }));

    return { success: true, scenes: widgetScenes };
  });

  // Get job status — merges Redis (real-time) progress with DB row
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

    // For active jobs, check Redis for fresher progress data
    if (job.status === 'processing' || job.status === 'pending') {
      try {
        const redisProgress = await apiProgressStore.get(id);
        if (redisProgress && redisProgress.percent > job.progress) {
          return {
            ...job,
            progress: redisProgress.percent,
            progressMessage: redisProgress.message,
            progressMeta: {
              phase: redisProgress.phase,
              phaseName: redisProgress.phaseName,
              ...(redisProgress.meta || {}),
            },
          };
        }
      } catch {
        // Redis unavailable — fall through to DB data
      }
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
