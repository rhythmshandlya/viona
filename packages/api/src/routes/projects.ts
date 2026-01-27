import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { eq, inArray } from 'drizzle-orm';
import { db, projects, tracks, timelineItems, jobs, transcripts } from '../db/index.js';
import { config } from '../config.js';
import { getPresignedUploadUrl, getPresignedDownloadUrl, objectExists, getObjectStream, getPartialObjectStream, getObjectStat } from '../services/minio.js';
import { queueTranscribeJob, queueRenderJob, queueEnhanceAudioJob } from '../services/queue.js';
import type { ProjectStatus } from '@reelify/shared';

// Validation schemas
const createProjectSchema = z.object({
  filename: z.string().min(1),
  contentType: z.string().optional(),
});

const updateProjectSchema = z.object({
  tracks: z.array(z.object({
    id: z.string(),
    name: z.string().optional(),
    locked: z.boolean().optional(),
    visible: z.boolean().optional(),
  })).optional(),
  items: z.array(z.object({
    id: z.string(),
    startMs: z.number().optional(),
    endMs: z.number().optional(),
    data: z.record(z.unknown()).optional(),
  })).optional(),
});

export async function projectRoutes(fastify: FastifyInstance) {
  // Create a new project
  fastify.post('/projects', async (request, reply) => {
    const body = createProjectSchema.parse(request.body);

    // Generate video key
    const videoKey = `${nanoid()}/${body.filename}`;

    // Create project in database
    const [project] = await db.insert(projects).values({
      status: 'uploading' as ProjectStatus,
      videoKey,
    }).returning();

    // Create default video track
    await db.insert(tracks).values({
      projectId: project.id,
      type: 'video',
      name: 'Video',
      position: 0,
    });

    // Get presigned upload URL
    const uploadUrl = await getPresignedUploadUrl(
      config.minio.buckets.uploads,
      videoKey
    );

    return {
      projectId: project.id,
      uploadUrl,
    };
  });

  // Get a project with all data
  fastify.get('/projects/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, id),
    });

    if (!project) {
      return reply.status(404).send({ error: 'Project not found' });
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

    return {
      ...project,
      tracks: projectTracks,
      items,
      transcript,
    };
  });

  // Stream video file
  fastify.get('/projects/:id/video', async (request, reply) => {
    const { id } = request.params as { id: string };

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, id),
    });

    if (!project) {
      return reply.status(404).send({ error: 'Project not found' });
    }

    if (!project.videoKey) {
      return reply.status(400).send({ error: 'No video uploaded' });
    }

    // Check if video exists
    const exists = await objectExists(config.minio.buckets.uploads, project.videoKey);
    if (!exists) {
      return reply.status(404).send({ error: 'Video not found in storage' });
    }

    try {
      // Get object metadata for content-type and size
      const stat = await getObjectStat(config.minio.buckets.uploads, project.videoKey);

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
          config.minio.buckets.uploads,
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
      const stream = await getObjectStream(config.minio.buckets.uploads, project.videoKey);

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
  fastify.patch('/projects/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateProjectSchema.parse(request.body);

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, id),
    });

    if (!project) {
      return reply.status(404).send({ error: 'Project not found' });
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

    // Update timeline items if provided
    if (body.items) {
      for (const item of body.items) {
        await db.update(timelineItems)
          .set({
            startMs: item.startMs,
            endMs: item.endMs,
            data: item.data,
            updatedAt: new Date(),
          })
          .where(eq(timelineItems.id, item.id));
      }
    }

    // Update project timestamp
    await db.update(projects)
      .set({ updatedAt: new Date() })
      .where(eq(projects.id, id));

    return { success: true };
  });

  // Start processing (transcription + audio enhancement in parallel)
  fastify.post('/projects/:id/process', async (request, reply) => {
    const { id } = request.params as { id: string };

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, id),
    });

    if (!project) {
      return reply.status(404).send({ error: 'Project not found' });
    }

    if (!project.videoKey) {
      return reply.status(400).send({ error: 'No video uploaded' });
    }

    // Check if video exists in MinIO
    const exists = await objectExists(config.minio.buckets.uploads, project.videoKey);
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

  // Start rendering
  fastify.post('/projects/:id/render', async (request, reply) => {
    const { id } = request.params as { id: string };

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, id),
    });

    if (!project) {
      return reply.status(404).send({ error: 'Project not found' });
    }

    if (project.status !== 'ready') {
      return reply.status(400).send({ error: 'Project is not ready for rendering' });
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

    // Queue the job
    await queueRenderJob({
      projectId: id,
      jobId: job.id,
    });

    return { jobId: job.id };
  });

  // Separate audio from video and enhance
  fastify.post('/projects/:id/separate-audio', async (request, reply) => {
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
  fastify.get('/projects/:id/download', async (request, reply) => {
    const { id } = request.params as { id: string };

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, id),
    });

    if (!project) {
      return reply.status(404).send({ error: 'Project not found' });
    }

    if (!project.outputKey) {
      return reply.status(400).send({ error: 'No rendered output available' });
    }

    const url = await getPresignedDownloadUrl(
      config.minio.buckets.outputs,
      project.outputKey
    );

    const expiresAt = new Date(Date.now() + 3600 * 1000); // 1 hour

    return { url, expiresAt };
  });

  // Stream a media file from MinIO (used for enhanced/original audio)
  fastify.get('/media/:bucket/*', async (request, reply) => {
    const { bucket } = request.params as { bucket: string };
    const key = (request.params as Record<string, string>)['*'];

    if (!key) {
      return reply.status(400).send({ error: 'Missing key' });
    }

    // Only allow known buckets
    const allowedBuckets = [config.minio.buckets.uploads, config.minio.buckets.outputs];
    if (!allowedBuckets.includes(bucket)) {
      return reply.status(403).send({ error: 'Bucket not allowed' });
    }

    const exists = await objectExists(bucket, key);
    if (!exists) {
      return reply.status(404).send({ error: 'File not found' });
    }

    const stat = await getObjectStat(bucket, key);
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

        const stream = await getPartialObjectStream(bucket, key, start, chunkSize);
        reply.status(206);
        reply.header('Content-Type', contentType);
        reply.header('Content-Length', chunkSize);
        reply.header('Content-Range', `bytes ${start}-${end}/${totalSize}`);
        reply.header('Accept-Ranges', 'bytes');
        return reply.send(stream);
      }
    }

    // Full file response
    const stream = await getObjectStream(bucket, key);
    reply.header('Content-Type', contentType);
    reply.header('Content-Length', totalSize);
    reply.header('Accept-Ranges', 'bytes');
    return reply.send(stream);
  });

  // Get job status
  fastify.get('/jobs/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const job = await db.query.jobs.findFirst({
      where: eq(jobs.id, id),
    });

    if (!job) {
      return reply.status(404).send({ error: 'Job not found' });
    }

    return job;
  });
}
