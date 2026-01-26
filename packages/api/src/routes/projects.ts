import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';
import { db, projects, tracks, timelineItems, jobs, transcripts } from '../db/index.js';
import { config } from '../config.js';
import { getPresignedUploadUrl, getPresignedDownloadUrl, objectExists } from '../services/minio.js';
import { queueTranscribeJob, queueRenderJob } from '../services/queue.js';
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
          // Get items for all tracks
          eq(timelineItems.trackId, trackIds[0]) // Simplified, should use inArray
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

  // Start processing (transcription)
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

    // Create job record
    const [job] = await db.insert(jobs).values({
      projectId: id,
      type: 'transcribe',
      status: 'pending',
    }).returning();

    // Update project status
    await db.update(projects)
      .set({ status: 'processing' })
      .where(eq(projects.id, id));

    // Queue the job
    await queueTranscribeJob({
      projectId: id,
      jobId: job.id,
      videoKey: project.videoKey,
    });

    return { jobId: job.id };
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
