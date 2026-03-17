import type { FastifyInstance } from 'fastify';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.js';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { sandboxSessions, projects, tracks, timelineItems, transcripts } from '../db/index.js';
import { logger } from '../logger.js';
import { withProjectMutex } from './mutex.js';
import { proxyFileRequest, proxyPrompt, proxyManifestOp, proxyOps } from './proxy.js';
import { touchActivity, onSandboxIdle, removeActivity } from './health.js';
import { dbToManifest } from '@viona/shared';
import { syncManifestToDb } from './sync.js';
import { emitWorkspaceReady, emitBundleReady, emitWorkspaceTeardown, emitManifestUpdated } from '../workspace/workspace-ws.js';
import type { SandboxProvider } from './provider.js';
import { DockerSandboxProvider } from './docker.js';

// Initialize provider based on config — promise-based singleton prevents race
let providerPromise: Promise<SandboxProvider> | null = null;

function getProvider(): Promise<SandboxProvider> {
  if (!providerPromise) {
    providerPromise = (async () => {
      if (config.sandbox.provider === 'railway') {
        const { RailwaySandboxProvider } = await import('./railway.js');
        return new RailwaySandboxProvider();
      }
      return new DockerSandboxProvider();
    })();
  }
  return providerPromise;
}

// Debounce map: projectId → timer
const syncTimers = new Map<string, ReturnType<typeof setTimeout>>();
const SYNC_DEBOUNCE_MS = 2000;

function debouncedSync(projectId: string, agentUrl: string, secret: string): void {
  const existing = syncTimers.get(projectId);
  if (existing) clearTimeout(existing);

  syncTimers.set(projectId, setTimeout(async () => {
    syncTimers.delete(projectId);
    try {
      const result = await proxyManifestOp(agentUrl, secret, 'GET');
      if (result.status === 200) {
        await syncManifestToDb(projectId, result.data);
        logger.debug({ projectId }, 'Manifest synced to DB');
      }
    } catch (err) {
      logger.error({ err, projectId }, 'Failed to sync manifest to DB');
    }
  }, SYNC_DEBOUNCE_MS));
}

export async function sandboxRoutes(fastify: FastifyInstance): Promise<void> {
  // Register idle suspension callback
  onSandboxIdle(async (projectId) => {
    await suspendSandbox(projectId);
  });

  // === Sandbox Lifecycle ===

  // POST /projects/:id/sandbox — Create or resume sandbox
  fastify.post('/projects/:id/sandbox', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { id: projectId } = request.params as { id: string };
    const userId = request.user!.id;

    // Touch activity
    touchActivity(projectId);

    return withProjectMutex(projectId, async () => {
      // Check if sandbox already exists and is active
      const [existing] = await db.select().from(sandboxSessions)
        .where(and(eq(sandboxSessions.projectId, projectId), eq(sandboxSessions.status, 'ready')))
        .limit(1);

      if (existing) {
        // Verify container is actually alive before trusting DB status
        const p = await getProvider();
        const healthy = existing.internalUrl ? await p.isReady(existing.internalUrl) : false;

        if (healthy) {
          return { status: 'ready', internalUrl: existing.internalUrl };
        }

        // Container is dead but DB says "ready" — recover
        logger.warn({ projectId }, 'Sandbox container unreachable, recovering stale session');

        const sandboxMeta = {
          id: existing.railwayServiceId!,
          projectId: existing.projectId,
          volumeId: existing.railwayVolumeId!,
          volumeInstanceId: existing.railwayVolumeInstanceId!,
        };

        // Try to backup volume (may still exist even though container died)
        let recoveredBackupId: string | undefined;
        try {
          recoveredBackupId = await p.backup(sandboxMeta);
          logger.info({ projectId, backupId: recoveredBackupId }, 'Recovered backup from stale session');
        } catch (err) {
          logger.warn({ err, projectId }, 'Failed to backup stale session volume');
        }

        // Clean up dead container/volume
        try {
          await p.destroy(sandboxMeta);
        } catch (err) {
          logger.warn({ err, projectId }, 'Failed to destroy stale sandbox');
        }

        // Mark session as suspended so creation flow picks up the backup
        await db.update(sandboxSessions)
          .set({
            status: 'suspended',
            backupId: recoveredBackupId || existing.backupId,
            railwayServiceId: null,
            railwayVolumeId: null,
            railwayVolumeInstanceId: null,
            internalUrl: null,
            metadata: {},
            suspendedAt: new Date(),
          })
          .where(eq(sandboxSessions.id, existing.id));

        removeActivity(projectId);
        // Fall through to creation flow below
      }

      // Check global concurrent limit
      const [{ count: activeCount }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(sandboxSessions)
        .where(eq(sandboxSessions.status, 'ready'));
      if (activeCount >= config.sandbox.maxConcurrent) {
        return reply.status(503).send({ error: 'Maximum concurrent sandboxes reached' });
      }

      // Check per-user limit (1 active sandbox)
      const [activeForUser] = await db.select().from(sandboxSessions)
        .where(and(eq(sandboxSessions.userId, userId), eq(sandboxSessions.status, 'ready')))
        .limit(1);

      if (activeForUser && activeForUser.projectId !== projectId) {
        // Suspend the other sandbox first
        await suspendSandbox(activeForUser.projectId);
      }

      // Check for suspended session (has backup)
      const [suspended] = await db.select().from(sandboxSessions)
        .where(and(eq(sandboxSessions.projectId, projectId), eq(sandboxSessions.status, 'suspended')))
        .limit(1);

      // Get project data for manifest generation
      const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
      if (!project) {
        return reply.status(404).send({ error: 'Project not found' });
      }

      // Build env vars for sandbox
      const env: Record<string, string> = {};
      if (process.env.ANTHROPIC_API_KEY) {
        env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
      }
      if (process.env.CLAUDE_CODE_OAUTH_TOKEN) {
        env.CLAUDE_CODE_OAUTH_TOKEN = process.env.CLAUDE_CODE_OAUTH_TOKEN;
      }

      const p = await getProvider();

      // Create sandbox
      const sandbox = await p.create({
        projectId,
        userId,
        backupId: suspended?.backupId || undefined,
        env,
      });

      // Upsert DB record — persist internalUrl AND agentUrl
      const sessionData = {
        status: 'ready' as const,
        railwayServiceId: sandbox.id,
        railwayVolumeId: sandbox.volumeId,
        railwayVolumeInstanceId: sandbox.volumeInstanceId,
        sandboxSecret: sandbox.secret,
        internalUrl: sandbox.internalUrl,
        metadata: { agentUrl: sandbox.agentUrl },
        lastActivityAt: new Date(),
        suspendedAt: null,
      };

      if (suspended) {
        await db.update(sandboxSessions)
          .set(sessionData)
          .where(eq(sandboxSessions.id, suspended.id));
      } else {
        await db.insert(sandboxSessions).values({
          projectId,
          userId,
          provider: config.sandbox.provider,
          ...sessionData,
        });
      }

      // Check if workspace is actually initialized (backup restore may have failed)
      let workspaceReady = false;
      if (suspended?.backupId) {
        try {
          const checkRes = await fetch(`${sandbox.agentUrl}/health`, { signal: AbortSignal.timeout(5000) });
          if (checkRes.ok) {
            const body = await checkRes.json() as { initialized?: boolean };
            workspaceReady = body.initialized === true;
          }
        } catch {
          // Sandbox not reachable yet or workspace broken
        }
        if (!workspaceReady) {
          logger.warn({ projectId }, 'Backup restore did not produce initialized workspace — sending fresh init');
        }
      }

      // If first boot (no backup) or backup restore failed, send init data
      if (!suspended?.backupId || !workspaceReady) {
        try {
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
          // DB stores API endpoint URLs (e.g. /api/projects/:id/video) which don't exist inside sandbox
          if (Array.isArray(manifest.items)) {
            let hasAudioItem = false;
            let videoDurationMs = 0;

            for (const item of manifest.items) {
              if (item.type === 'video' && item.data) {
                item.data.src = 'source.mp4';
                item.data.volume = 0; // Mute — audio comes from separate audio item
                videoDurationMs = item.endMs || manifest.durationMs || 0;
              } else if (item.type === 'audio' && item.data) {
                item.data.src = 'audio.aac';
                hasAudioItem = true;
              }
            }

            // Create independent audio item if none exists
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
                data: { src: 'audio.aac', volume: 1 },
              });
            }
          }

          // Build init payload with optional transcript, brief, head-tracking, and project meta
          const initBody: Record<string, unknown> = {
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
          // Send init to sandbox
          const initRes = await fetch(`${sandbox.agentUrl}/init`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${sandbox.secret}`,
            },
            body: JSON.stringify(initBody),
          });

          if (!initRes.ok) {
            logger.error({ status: initRes.status }, 'Sandbox init failed');
          }
        } catch (err) {
          logger.error({ err }, 'Failed to send init data to sandbox');
        }
      }

      return { status: 'ready', internalUrl: sandbox.internalUrl };
    });
  });

  // DELETE /projects/:id/sandbox — Suspend sandbox
  fastify.delete('/projects/:id/sandbox', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { id: projectId } = request.params as { id: string };
    await suspendSandbox(projectId);
    return { status: 'suspended' };
  });

  // GET /projects/:id/sandbox/status
  fastify.get('/projects/:id/sandbox/status', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { id: projectId } = request.params as { id: string };
    touchActivity(projectId);

    const [session] = await db.select().from(sandboxSessions)
      .where(eq(sandboxSessions.projectId, projectId))
      .limit(1);

    if (!session) {
      return { status: 'inactive' };
    }

    // If DB says "ready", verify the container is actually alive
    if (session.status === 'ready' && session.internalUrl) {
      const p = await getProvider();
      const healthy = await p.isReady(session.internalUrl);
      if (!healthy) {
        return { status: 'suspended' };
      }
    }

    return {
      status: session.status,
      previewUrl: session.status === 'ready' ? `/api/projects/${projectId}/sandbox/bundle/player-composition.cjs.js` : null,
    };
  });

  // === Proxy Routes ===

  // GET /projects/:id/sandbox/bundle/* — Proxy bundle files
  fastify.get('/projects/:id/sandbox/bundle/*', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { id: projectId } = request.params as { id: string };
    const path = (request.params as { '*': string })['*'];
    touchActivity(projectId);

    const session = await getActiveSession(projectId);
    if (!session) return reply.status(404).send({ error: 'No active sandbox' });

    await proxyFileRequest(session.internalUrl!, session.sandboxSecret, `/bundle/${path}`, request, reply);
  });

  // GET /projects/:id/sandbox/public/* — Proxy public files
  fastify.get('/projects/:id/sandbox/public/*', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { id: projectId } = request.params as { id: string };
    const path = (request.params as { '*': string })['*'];
    touchActivity(projectId);

    const session = await getActiveSession(projectId);
    if (!session) return reply.status(404).send({ error: 'No active sandbox' });

    await proxyFileRequest(session.internalUrl!, session.sandboxSecret, `/public/${path}`, request, reply);
  });

  // POST /projects/:id/sandbox/prompt — Forward prompt to agent
  fastify.post('/projects/:id/sandbox/prompt', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { id: projectId } = request.params as { id: string };
    touchActivity(projectId);

    const session = await getActiveSession(projectId);
    if (!session) return reply.status(404).send({ error: 'No active sandbox' });

    const agentUrl = (session.metadata as any)?.agentUrl;
    if (!agentUrl) return reply.status(500).send({ error: 'Agent URL not found in session' });

    await proxyPrompt(agentUrl, session.sandboxSecret, request.body as any, reply);
  });

  // GET /projects/:id/sandbox/manifest — Read manifest from sandbox
  fastify.get('/projects/:id/sandbox/manifest', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { id: projectId } = request.params as { id: string };
    touchActivity(projectId);

    const session = await getActiveSession(projectId);
    if (!session) return reply.status(404).send({ error: 'No active sandbox' });

    const agentUrl = (session.metadata as any)?.agentUrl;
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

    const session = await getActiveSession(projectId);
    if (!session) return reply.status(404).send({ error: 'No active sandbox' });

    const agentUrl = (session.metadata as any)?.agentUrl;
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

    const session = await getActiveSession(projectId);
    if (!session) return reply.status(404).send({ error: 'No active sandbox' });

    const agentUrl = (session.metadata as any)?.agentUrl;
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

    // Debounced DB sync
    const session = await getActiveSession(projectId);
    if (session) {
      const agentUrl = (session.metadata as any)?.agentUrl;
      if (agentUrl) {
        debouncedSync(projectId, agentUrl, session.sandboxSecret);
      }
    }

    return { ok: true };
  });

  // POST /internal/sandbox/:id/checkpoint — Accept but don't persist to DB
  fastify.post('/internal/sandbox/:id/checkpoint', async (request, reply) => {
    const projectId = await validateInternalCallback(request, reply);
    if (!projectId) return;
    // Checkpoint data lives in sandbox volume only — no DB sync
    logger.debug({ projectId }, 'Checkpoint received (not persisted to DB)');
    return { ok: true };
  });
}

// Helper: get active sandbox session from DB
async function getActiveSession(projectId: string) {
  const [session] = await db.select().from(sandboxSessions)
    .where(and(eq(sandboxSessions.projectId, projectId), eq(sandboxSessions.status, 'ready')))
    .limit(1);
  return session;
}

// Suspend a sandbox: checkpoint, backup, destroy, update DB
async function suspendSandbox(projectId: string): Promise<void> {
  await withProjectMutex(projectId, async () => {
    const session = await getActiveSession(projectId);
    if (!session) return;

    const p = await getProvider();

    try {
      await db.update(sandboxSessions)
        .set({ status: 'suspending' })
        .where(eq(sandboxSessions.id, session.id));

      const sandboxMeta = {
        id: session.railwayServiceId!,
        projectId: session.projectId,
        volumeId: session.railwayVolumeId!,
        volumeInstanceId: session.railwayVolumeInstanceId!,
      };

      const backupId = await p.backup(sandboxMeta);
      await p.destroy(sandboxMeta);

      await db.update(sandboxSessions)
        .set({
          status: 'suspended',
          backupId,
          railwayServiceId: null,
          railwayVolumeId: null,
          railwayVolumeInstanceId: null,
          internalUrl: null,
          metadata: {},
          suspendedAt: new Date(),
        })
        .where(eq(sandboxSessions.id, session.id));

      removeActivity(projectId);

      await emitWorkspaceTeardown(projectId);

      logger.info({ projectId }, 'Sandbox suspended');
    } catch (err) {
      logger.error({ err, projectId }, 'Failed to suspend sandbox');
      throw err;
    }
  });
}

/**
 * On API restart, rehydrate sandbox state from DB.
 * Any sandbox marked 'ready' or 'creating' in DB needs to be:
 * - health-checked (if 'ready')
 * - cleaned up (if 'creating' — partial creation interrupted by crash)
 * - idle timers re-established
 */
export async function rehydrateActiveSandboxes(): Promise<void> {
  const activeSessions = await db.select().from(sandboxSessions)
    .where(inArray(sandboxSessions.status, ['ready', 'creating', 'suspending']));

  logger.info({ count: activeSessions.length }, 'Rehydrating sandbox sessions after restart');

  for (const session of activeSessions) {
    if (session.status === 'creating' || session.status === 'suspending') {
      // Partial operation interrupted by crash — mark as failed and clean up
      logger.warn({ projectId: session.projectId, status: session.status },
        'Found interrupted sandbox operation, cleaning up');
      await db.update(sandboxSessions)
        .set({ status: 'suspended', suspendedAt: new Date() })
        .where(eq(sandboxSessions.id, session.id));
      continue;
    }

    // Status is 'ready' — verify the sandbox is actually reachable
    if (session.internalUrl) {
      const p = await getProvider();
      const healthy = await p.isReady(session.internalUrl);

      if (healthy) {
        // Re-establish idle tracking
        touchActivity(session.projectId);
        logger.info({ projectId: session.projectId }, 'Sandbox still alive after restart');
      } else {
        // Sandbox died (container was removed, etc.) — mark suspended
        logger.warn({ projectId: session.projectId }, 'Sandbox unreachable after restart, marking suspended');
        await db.update(sandboxSessions)
          .set({ status: 'suspended', suspendedAt: new Date() })
          .where(eq(sandboxSessions.id, session.id));
      }
    }
  }
}

// Exported for crash recovery (Task 27)
export { getProvider, getActiveSession, suspendSandbox };
