import type { FastifyInstance } from 'fastify';
import { eq, and, inArray } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { projects, tracks, timelineItems, transcripts } from '../db/index.js';
import { logger } from '../logger.js';
import { proxyFileRequest, proxyPrompt, proxyManifestOp, proxyOps } from './proxy.js';
import { touchActivity } from './health.js';
import { redis } from '../services/redis.js';
import { dbToManifest } from '@viona/shared';
import { emitWorkspaceReady, emitBundleReady, emitManifestUpdated } from '../workspace/workspace-ws.js';
import { sandboxSessions } from '../db/schema.js';
import type { SandboxManager, InitData } from './manager.js';
import { syncManifestToDb } from './sync.js';

// ---------------------------------------------------------------------------
// Factory: createSandboxRoutes(manager)
// ---------------------------------------------------------------------------

export function createSandboxRoutes(manager: SandboxManager) {
  return async function sandboxRoutes(fastify: FastifyInstance): Promise<void> {

    // === Sandbox Lifecycle ===

    // POST /projects/:id/sandbox — Create or resume sandbox
    fastify.post('/projects/:id/sandbox', { preHandler: [authMiddleware] }, async (request, reply) => {
      const { id: projectId } = request.params as { id: string };
      const userId = request.user!.id;

      try {
        const initData = await buildInitData(projectId);
        if (!initData) {
          return reply.status(404).send({ error: 'Project not found' });
        }

        const env: Record<string, string> = {};
        if (process.env.ANTHROPIC_API_KEY) env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
        if (process.env.CLAUDE_CODE_OAUTH_TOKEN) env.CLAUDE_CODE_OAUTH_TOKEN = process.env.CLAUDE_CODE_OAUTH_TOKEN;

        const result = await manager.acquire(projectId, userId, { initData, env });

        const response: Record<string, unknown> = {
          status: result.sandbox.status,
          internalUrl: result.sandbox.internalUrl,
        };
        if (result.recovery === 'partial') {
          response.warning = 'Your workspace was recovered from a checkpoint. Some recent changes may be lost.';
        } else if (result.recovery === 'lost') {
          response.warning = "Your previous work session couldn't be recovered. Starting fresh.";
        }
        return reply.send(response);
      } catch (err: any) {
        fastify.log.error(err, 'Sandbox acquire failed');
        const status = err.message?.includes('limit') || err.message?.includes('Maximum concurrent') ? 429 : 500;
        return reply.status(status).send({ error: err.message });
      }
    });

    // DELETE /projects/:id/sandbox — Suspend sandbox
    fastify.delete('/projects/:id/sandbox', { preHandler: [authMiddleware] }, async (request, reply) => {
      const { id: projectId } = request.params as { id: string };
      await manager.suspend(projectId, 'user');
      return { status: 'suspended' };
    });

    // GET /projects/:id/sandbox/status
    fastify.get('/projects/:id/sandbox/status', { preHandler: [authMiddleware] }, async (request, reply) => {
      const { id: projectId } = request.params as { id: string };
      touchActivity(projectId);

      const status = await manager.getStatus(projectId);
      if (!status) return { status: 'inactive' };

      // Include legacy fields for backward compat
      // getStatus already returns busy/activeTasks/plan/startedAt
      // Add agentProgress/agentActivity from Redis for the frontend progress pill
      let agentProgress = null;
      let agentActivity = null;

      if (status.status === 'ready') {
        const [progressRaw, activityRaw] = await Promise.all([
          redis.get(`sandbox:progress:${projectId}`).catch(() => null),
          redis.get(`sandbox:activity:${projectId}`).catch(() => null),
        ]);
        if (progressRaw) try { agentProgress = JSON.parse(progressRaw); } catch {}
        if (activityRaw) try { agentActivity = JSON.parse(activityRaw); } catch {}
      }

      return {
        ...status,
        // Legacy fields (backward compat)
        agentProgress,
        agentActivity,
        agentPlan: status.plan,
      };
    });

    // === Proxy Routes ===

    // GET /projects/:id/sandbox/bundle/* — Proxy bundle files
    fastify.get('/projects/:id/sandbox/bundle/*', { preHandler: [authMiddleware] }, async (request, reply) => {
      const { id: projectId } = request.params as { id: string };
      const path = (request.params as { '*': string })['*'];
      touchActivity(projectId);

      const session = await manager.getActiveSession(projectId);
      if (!session) return reply.status(404).send({ error: 'No active sandbox' });

      await proxyFileRequest(session.internalUrl!, session.sandboxSecret, `/bundle/${path}`, request, reply);
    });

    // GET /projects/:id/sandbox/public/* — Proxy public files
    fastify.get('/projects/:id/sandbox/public/*', { preHandler: [authMiddleware] }, async (request, reply) => {
      const { id: projectId } = request.params as { id: string };
      const path = (request.params as { '*': string })['*'];
      touchActivity(projectId);

      const session = await manager.getActiveSession(projectId);
      if (!session) return reply.status(404).send({ error: 'No active sandbox' });

      await proxyFileRequest(session.internalUrl!, session.sandboxSecret, `/public/${path}`, request, reply);
    });

    // POST /projects/:id/sandbox/prompt — Forward prompt to agent
    fastify.post('/projects/:id/sandbox/prompt', { preHandler: [authMiddleware] }, async (request, reply) => {
      const { id: projectId } = request.params as { id: string };
      touchActivity(projectId);

      const session = await manager.getActiveSession(projectId);
      if (!session) return reply.status(404).send({ error: 'No active sandbox' });

      const agentUrl = session.agentUrl;
      if (!agentUrl) return reply.status(500).send({ error: 'Agent URL not found in session' });

      await proxyPrompt(agentUrl, session.sandboxSecret, request.body as any, reply);
    });

    // GET /projects/:id/sandbox/manifest — Read manifest from sandbox
    fastify.get('/projects/:id/sandbox/manifest', { preHandler: [authMiddleware] }, async (request, reply) => {
      const { id: projectId } = request.params as { id: string };
      touchActivity(projectId);

      const session = await manager.getActiveSession(projectId);
      if (!session) return reply.status(404).send({ error: 'No active sandbox' });

      const agentUrl = session.agentUrl;
      if (!agentUrl) return reply.status(500).send({ error: 'Agent URL not found in session' });
      try {
        const result = await proxyManifestOp(agentUrl, session.sandboxSecret, 'GET');
        return reply.status(result.status).send(result.data);
      } catch (err) {
        logger.warn({ err, projectId }, 'Sandbox manifest proxy failed — container may be dead');
        return reply.status(502).send({ error: 'Sandbox unavailable' });
      }
    });

    // PATCH /projects/:id/sandbox/manifest — Write manifest op to sandbox
    fastify.patch('/projects/:id/sandbox/manifest', { preHandler: [authMiddleware] }, async (request, reply) => {
      const { id: projectId } = request.params as { id: string };
      touchActivity(projectId);

      const session = await manager.getActiveSession(projectId);
      if (!session) return reply.status(404).send({ error: 'No active sandbox' });

      const agentUrl = session.agentUrl;
      if (!agentUrl) return reply.status(500).send({ error: 'Agent URL not found in session' });
      try {
        const result = await proxyManifestOp(agentUrl, session.sandboxSecret, 'PATCH', request.body as object);
        return reply.status(result.status).send(result.data);
      } catch (err) {
        logger.warn({ err, projectId }, 'Sandbox manifest proxy failed — container may be dead');
        return reply.status(502).send({ error: 'Sandbox unavailable' });
      }
    });

    // POST /projects/:id/sandbox/ops — Granular manifest operations
    fastify.post('/projects/:id/sandbox/ops', { preHandler: [authMiddleware] }, async (request, reply) => {
      const { id: projectId } = request.params as { id: string };
      touchActivity(projectId);

      const session = await manager.getActiveSession(projectId);
      if (!session) return reply.status(404).send({ error: 'No active sandbox' });

      const agentUrl = session.agentUrl;
      if (!agentUrl) return reply.status(500).send({ error: 'Agent URL not found in session' });

      try {
        const result = await proxyOps(agentUrl, session.sandboxSecret, request.body as any);
        return reply.status(result.status).send(result.data);
      } catch (err) {
        logger.warn({ err, projectId }, 'Sandbox ops proxy failed — container may be dead');
        return reply.status(502).send({ error: 'Sandbox unavailable' });
      }
    });

    // === Internal Callbacks (Sandbox → API) ===

    async function validateInternalCallback(request: any, reply: any): Promise<string | null> {
      const { id: projectId } = request.params as { id: string };
      const authHeader = request.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        reply.status(401).send({ error: 'Missing authorization' });
        return null;
      }
      const token = authHeader.slice(7);
      const [session] = await db.select().from(sandboxSessions)
        .where(and(eq(sandboxSessions.projectId, projectId), eq(sandboxSessions.sandboxSecret, token)))
        .limit(1);
      if (!session) {
        reply.status(403).send({ error: 'Invalid secret' });
        return null;
      }
      return projectId;
    }

    // POST /internal/sandbox/:id/ready
    fastify.post('/internal/sandbox/:id/ready', async (request, reply) => {
      const projectId = await validateInternalCallback(request, reply);
      if (!projectId) return;
      logger.info({ projectId }, 'Sandbox reports ready');
      const bundleBaseUrl = `/api/projects/${projectId}/sandbox/bundle`;
      await emitWorkspaceReady(projectId, { bundleUrl: bundleBaseUrl });
      return { ok: true };
    });

    // POST /internal/sandbox/:id/bundle-ready
    fastify.post('/internal/sandbox/:id/bundle-ready', async (request, reply) => {
      const projectId = await validateInternalCallback(request, reply);
      if (!projectId) return;
      const { version } = request.body as { version: number };
      logger.info({ projectId, version }, 'Bundle ready');
      const bundleBaseUrl = `/api/projects/${projectId}/sandbox/bundle`;
      await emitBundleReady(projectId, { bundleUrl: bundleBaseUrl });
      return { ok: true };
    });

    // POST /internal/sandbox/:id/manifest-updated
    fastify.post('/internal/sandbox/:id/manifest-updated', async (request, reply) => {
      const projectId = await validateInternalCallback(request, reply);
      if (!projectId) return;
      await emitManifestUpdated(projectId, { source: 'ai' });

      // Debounced DB sync via manager
      const session = await manager.getActiveSession(projectId);
      if (session) {
        const agentUrl = session.agentUrl;
        if (agentUrl) {
          manager.debouncedSync(projectId, agentUrl, session.sandboxSecret);
        }
      }

      return { ok: true };
    });

    // POST /internal/sandbox/:id/checkpoint — Upload manifest checkpoint to S3 + sync to DB
    fastify.post('/internal/sandbox/:id/checkpoint', async (request, reply) => {
      const projectId = await validateInternalCallback(request, reply);
      if (!projectId) return;
      const body = request.body as { manifest?: any };
      if (body.manifest) {
        // Upload to S3 (existing behavior)
        await manager.checkpoint(projectId, body.manifest);
        // Sync to DB so saveProject from frontend has current data
        await syncManifestToDb(projectId, body.manifest).catch(err => {
          logger.error({ err, projectId }, 'syncManifestToDb failed during checkpoint');
        });
      } else {
        logger.debug({ projectId }, 'Checkpoint received (no manifest payload)');
      }
      return { ok: true };
    });

    // POST /internal/sandbox/:id/agent-state — Receive agent state pushes
    fastify.post('/internal/sandbox/:id/agent-state', async (request, reply) => {
      const projectId = await validateInternalCallback(request, reply);
      if (!projectId) return;

      const { type, data, timestamp } = request.body as {
        type: string;
        data?: any;
        timestamp?: number;
      };

      const TASK_TTL = 30 * 60; // 30 minutes in seconds
      const tasksKey = `sandbox:tasks:${projectId}`;
      const busyKey = `sandbox:busy:${projectId}`;

      // Lua script for atomic task mutations — avoids TOCTOU race on concurrent callbacks
      const TASK_MUTATION_LUA = `
        local tasks_raw = redis.call('GET', KEYS[1])
        local tasks = tasks_raw and cjson.decode(tasks_raw) or {}
        local op = ARGV[1]
        local task_data = ARGV[2]
        local ttl = tonumber(ARGV[3])

        if op == 'add' then
          local task = cjson.decode(task_data)
          table.insert(tasks, task)
        elseif op == 'update' then
          local upd = cjson.decode(task_data)
          for i, t in ipairs(tasks) do
            if t.id == upd.id then
              t.action = upd.action
              break
            end
          end
        elseif op == 'complete' then
          local upd = cjson.decode(task_data)
          local new_tasks = {}
          for i, t in ipairs(tasks) do
            if t.id ~= upd.id then
              table.insert(new_tasks, t)
            end
          end
          tasks = new_tasks
        end

        redis.call('SET', KEYS[1], cjson.encode(tasks), 'EX', ttl)
        return #tasks
      `;

      try {
        switch (type) {
          case 'task_started': {
            await redis.eval(TASK_MUTATION_LUA, 1, tasksKey, 'add', JSON.stringify(data), TASK_TTL);
            await redis.set(busyKey, JSON.stringify({ busy: true, startedAt: timestamp ?? Date.now() }), 'EX', TASK_TTL);
            break;
          }
          case 'task_updated': {
            await redis.eval(TASK_MUTATION_LUA, 1, tasksKey, 'update', JSON.stringify(data), TASK_TTL);
            break;
          }
          case 'task_completed': {
            await redis.eval(TASK_MUTATION_LUA, 1, tasksKey, 'complete', JSON.stringify(data), TASK_TTL);
            break;
          }
          case 'plan': {
            await redis.set(`sandbox:plan:${projectId}`, JSON.stringify(data), 'EX', TASK_TTL);
            break;
          }
          case 'done': {
            await redis.del(tasksKey, busyKey);
            break;
          }
          case 'error': {
            await redis.del(tasksKey, busyKey);
            break;
          }
          default: {
            // Refresh TTL on busy key to keep it alive
            await redis.expire(busyKey, TASK_TTL);
            break;
          }
        }
      } catch (err) {
        logger.error({ err, projectId, type }, 'Failed to process agent-state callback');
        return reply.status(500).send({ error: 'Internal error' });
      }

      return { ok: true };
    });
  };
}

// ---------------------------------------------------------------------------
// buildInitData — assemble init payload from DB for sandbox boot
// ---------------------------------------------------------------------------

async function buildInitData(projectId: string): Promise<InitData | null> {
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project) return null;

  const projectTracks = await db.select().from(tracks).where(eq(tracks.projectId, projectId));
  const trackIds = projectTracks.map(t => t.id);
  const allItems = trackIds.length > 0
    ? await db.select().from(timelineItems).where(inArray(timelineItems.trackId, trackIds))
    : [];

  const manifest = dbToManifest({
    project: {
      fps: project.fps || 30,
      durationMs: project.durationMs || 0,
      sourceWidth: project.sourceWidth || 1920,
      sourceHeight: project.sourceHeight || 1080,
      videoSettings: (project.videoSettings as Record<string, unknown>) || null,
    },
    tracks: projectTracks,
    items: allItems.map(item => ({
      ...item,
      data: (item.data as Record<string, unknown>) ?? {},
    })),
  });

  // Override video/audio src to sandbox-local paths (workspace-init downloads them)
  // DB stores API endpoint URLs (e.g. /api/projects/:id/video) which don't exist inside sandbox.
  if (Array.isArray(manifest.items)) {
    let hasAudioItem = false;
    let videoDurationMs = 0;

    for (const item of manifest.items) {
      if (item.type === 'video' && item.data) {
        item.data.src = 'source.mp4';
        videoDurationMs = item.endMs || manifest.durationMs || 0;
      } else if (item.type === 'audio' && item.data) {
        item.data.src = 'audio.aac';
        hasAudioItem = true;
      }
    }

    // Create independent audio item if none exists (for timeline waveform display)
    if (!hasAudioItem && videoDurationMs > 0) {
      const audioTrackId = crypto.randomUUID();
      if (Array.isArray(manifest.tracks)) {
        manifest.tracks.push({
          id: audioTrackId,
          type: 'audio',
          name: 'Speaker Audio',
          position: manifest.tracks.length,
        });
      }
      manifest.items.push({
        id: crypto.randomUUID(),
        type: 'audio',
        trackId: audioTrackId,
        startMs: 0,
        endMs: videoDurationMs,
        keyframes: [],
        data: { src: 'audio.aac', volume: 1, playbackRate: 1 },
      });
    }
  }

  // Build init payload with optional transcript, brief, head-tracking, and project meta
  const initBody: InitData = {
    videoUrl: project.videoKey ? `uploads/${project.videoKey}` : '',
    audioUrl: project.audioKey ? `uploads/${project.audioKey}` : undefined,
    manifest,
  };

  // Add transcript if available (lives in separate table)
  // Send full rawOutput (words + segments + language) so planner has complete context
  const [transcript] = await db.select().from(transcripts)
    .where(eq(transcripts.projectId, projectId))
    .limit(1);
  if (transcript?.rawOutput) {
    initBody.transcript = transcript.rawOutput;
  }

  // Add user brief if available
  if (project.description) {
    initBody.userBrief = project.description;
  }

  // Add head-tracking data if available
  if (project.headTrackingData) {
    initBody.headTracking = project.headTrackingData;
  }

  // Add project metadata
  initBody.projectMeta = {
    width: project.sourceWidth || 1080,
    height: project.sourceHeight || 1920,
    fps: project.fps || 30,
    durationMs: project.durationMs || 0,
  };

  return initBody;
}
