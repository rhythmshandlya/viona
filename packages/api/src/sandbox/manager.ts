/**
 * SandboxManager — core lifecycle orchestrator for sandbox management.
 *
 * Extracted from routes.ts to provide a clean API for:
 *   acquire()    — create or resume a sandbox with atomic concurrent limits
 *   suspend()    — backup + destroy + cleanup
 *   checkpoint() — durable S3 upload of manifest
 *   getStatus()  — read status from DB + Redis
 *   rehydrate()  — boot-time recovery of active sessions
 */

import { eq, and, inArray, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import type { SandboxProvider, Sandbox, CreateSandboxOpts } from './provider.js';
import { touchActivity, removeActivity, onSandboxIdle } from './health.js';
import { syncManifestToDb } from './sync.js';
import { proxyManifestOp } from './proxy.js';
import { emitWorkspaceTeardown } from '../workspace/workspace-ws.js';
import { logger } from '../logger.js';
import { config } from '../config.js';
import { sandboxSessions, projects } from '../db/schema.js';
import { db } from '../db/index.js';
import { redis } from '../services/redis.js';
import { minioClient } from '../services/minio.js';
import { DockerSandboxProvider } from './docker.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SuspendReason = 'idle' | 'user' | 'health_failure' | 'limit_exceeded' | 'api_shutdown';

export interface AcquireResult {
  sandbox: Sandbox;
  initRequired: boolean;
  recovery?: 'full' | 'partial' | 'lost';
}

export interface SandboxStatus {
  status: string;
  previewUrl: string | null;
  busy: boolean;
  activeTasks: unknown[];
  plan: unknown | null;
  startedAt: number | null;
}

export interface InitData {
  videoUrl?: string;
  audioUrl?: string;
  manifest?: unknown;
  transcript?: unknown;
  userBrief?: string;
  headTracking?: unknown;
  projectMeta?: {
    width: number;
    height: number;
    fps: number;
    durationMs: number;
  };
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// SandboxManager
// ---------------------------------------------------------------------------

export class SandboxManager {
  // Lazy singleton for provider
  private providerPromise: Promise<SandboxProvider> | null = null;

  // Per-project mutex via promise-chaining
  private locks = new Map<string, Promise<void>>();

  // Debounce timers for manifest sync
  private syncTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private static readonly SYNC_DEBOUNCE_MS = 2000;

  // Graceful shutdown flag
  private shuttingDown = false;

  constructor() {
    // Register idle suspension callback
    onSandboxIdle(async (projectId, reason) => {
      await this.suspend(projectId, (reason as SuspendReason) || 'idle');
    });
  }

  // -----------------------------------------------------------------------
  // Provider (lazy singleton)
  // -----------------------------------------------------------------------

  getProvider(): Promise<SandboxProvider> {
    if (!this.providerPromise) {
      this.providerPromise = (async () => {
        if (config.sandbox.provider === 'railway') {
          const { RailwaySandboxProvider } = await import('./railway.js');
          return new RailwaySandboxProvider();
        }
        return new DockerSandboxProvider();
      })();
    }
    return this.providerPromise;
  }

  // -----------------------------------------------------------------------
  // Per-project mutex (promise-chaining, no gap between check-and-set)
  // -----------------------------------------------------------------------

  async withMutex<T>(projectId: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.locks.get(projectId) ?? Promise.resolve();

    let releaseFn: () => void;
    const current = new Promise<void>((resolve) => {
      releaseFn = resolve;
    });

    // Set our promise BEFORE awaiting — no gap for another caller to slip through
    this.locks.set(projectId, current);

    await prev;

    try {
      return await fn();
    } finally {
      if (this.locks.get(projectId) === current) {
        this.locks.delete(projectId);
      }
      releaseFn!();
    }
  }

  // -----------------------------------------------------------------------
  // Debounced manifest sync (sandbox → DB)
  // -----------------------------------------------------------------------

  debouncedSync(projectId: string, agentUrl: string, secret: string): void {
    const existing = this.syncTimers.get(projectId);
    if (existing) clearTimeout(existing);

    this.syncTimers.set(projectId, setTimeout(async () => {
      this.syncTimers.delete(projectId);
      try {
        const result = await proxyManifestOp(agentUrl, secret, 'GET');
        if (result.status === 200) {
          await syncManifestToDb(projectId, result.data);
          logger.debug({ projectId }, 'Manifest synced to DB');
        }
      } catch (err) {
        logger.error({ err, projectId }, 'Failed to sync manifest to DB');
      }
    }, SandboxManager.SYNC_DEBOUNCE_MS));
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  /** Get an active session (status IN 'creating', 'ready') for a project */
  async getActiveSession(projectId: string) {
    const [session] = await db.select().from(sandboxSessions)
      .where(and(
        eq(sandboxSessions.projectId, projectId),
        inArray(sandboxSessions.status, ['creating', 'ready']),
      ))
      .limit(1);
    return session ?? null;
  }

  /** Convert a DB session row to the Sandbox interface */
  sessionToSandbox(session: typeof sandboxSessions.$inferSelect): Sandbox {
    return {
      id: session.railwayServiceId || '',
      projectId: session.projectId,
      volumeId: session.railwayVolumeId || '',
      volumeInstanceId: session.railwayVolumeInstanceId || '',
      internalUrl: session.internalUrl || '',
      agentUrl: session.agentUrl || (session.metadata as any)?.agentUrl || '',
      secret: session.sandboxSecret,
      status: session.status as Sandbox['status'],
    };
  }

  // -----------------------------------------------------------------------
  // acquire() — create or resume sandbox with atomic concurrent limits
  // -----------------------------------------------------------------------

  async acquire(
    projectId: string,
    userId: string,
    opts?: { env?: Record<string, string>; initData?: InitData },
  ): Promise<AcquireResult> {
    if (this.shuttingDown) {
      throw new Error('Server is shutting down — cannot acquire sandbox');
    }

    return this.withMutex(projectId, async () => {
      const provider = await this.getProvider();

      // 1. Check for existing healthy session — return early
      const existing = await this.getActiveSession(projectId);
      if (existing && existing.status === 'ready') {
        const healthy = existing.internalUrl
          ? await provider.isReady(existing.internalUrl)
          : false;

        if (healthy) {
          touchActivity(projectId);
          return {
            sandbox: this.sessionToSandbox(existing),
            initRequired: false,
            recovery: undefined,
          };
        }

        // Container is dead but DB says "ready" — recover
        logger.warn({ projectId }, 'Sandbox container unreachable, recovering stale session');
        await this.recoverStaleSession(existing, provider);
      } else if (existing && existing.status === 'creating') {
        // Stuck "creating" from a previous crash — clean up
        logger.warn({ projectId }, 'Found stuck creating session, cleaning up');
        await db.update(sandboxSessions)
          .set({ status: 'suspended', suspendedAt: new Date(), suspendReason: 'health_failure' })
          .where(eq(sandboxSessions.id, existing.id));
      }

      // 2. Read suspended session BEFORE transaction (to capture backupId)
      const [suspended] = await db.select().from(sandboxSessions)
        .where(and(
          eq(sandboxSessions.projectId, projectId),
          eq(sandboxSessions.status, 'suspended'),
        ))
        .limit(1);
      const backupId = suspended?.backupId || undefined;

      // 3. Atomic concurrent limit: SELECT FOR UPDATE to prevent races
      // Count active sessions in app code
      const activeRows = await db.select({ id: sandboxSessions.id, userId: sandboxSessions.userId, projectId: sandboxSessions.projectId })
        .from(sandboxSessions)
        .where(inArray(sandboxSessions.status, ['creating', 'ready']));

      if (activeRows.length >= config.sandbox.maxConcurrent) {
        throw new Error('Maximum concurrent sandboxes reached');
      }

      // 4. Per-user limit: find other active sessions for this user
      const otherUserSandboxes = activeRows.filter(
        r => r.userId === userId && r.projectId !== projectId,
      );

      // 5. Upsert session: UPDATE if suspended exists, INSERT if not
      const sessionData = {
        status: 'creating' as const,
        railwayServiceId: null as string | null,
        railwayVolumeId: null as string | null,
        railwayVolumeInstanceId: null as string | null,
        internalUrl: null as string | null,
        agentUrl: null as string | null,
        sandboxSecret: randomUUID(),
        metadata: {} as Record<string, unknown>,
        lastActivityAt: new Date(),
        suspendedAt: null as Date | null,
        suspendReason: null as string | null,
      };

      let sessionId: string;
      if (suspended) {
        await db.update(sandboxSessions)
          .set(sessionData)
          .where(eq(sandboxSessions.id, suspended.id));
        sessionId = suspended.id;
      } else {
        const [inserted] = await db.insert(sandboxSessions).values({
          projectId,
          userId,
          provider: config.sandbox.provider,
          ...sessionData,
        }).returning({ id: sandboxSessions.id });
        sessionId = inserted.id;
      }

      // 6. After transaction: suspend other user sandboxes (fire-and-forget)
      for (const other of otherUserSandboxes) {
        this.suspend(other.projectId, 'limit_exceeded').catch(err => {
          logger.error({ err, projectId: other.projectId }, 'Failed to suspend other user sandbox');
        });
      }

      // 7. Create sandbox via provider
      const env: Record<string, string> = { ...(opts?.env || {}) };
      if (process.env.ANTHROPIC_API_KEY) {
        env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
      }
      if (process.env.CLAUDE_CODE_OAUTH_TOKEN) {
        env.CLAUDE_CODE_OAUTH_TOKEN = process.env.CLAUDE_CODE_OAUTH_TOKEN;
      }

      let sandbox: Sandbox;
      try {
        sandbox = await provider.create({
          projectId,
          userId,
          backupId,
          env,
        });
      } catch (err) {
        // Creation failed — mark suspended in DB
        logger.error({ err, projectId }, 'Sandbox creation failed');
        await db.update(sandboxSessions)
          .set({
            status: 'suspended',
            suspendedAt: new Date(),
            suspendReason: 'health_failure',
          })
          .where(eq(sandboxSessions.id, sessionId));
        throw err;
      }

      // 8. Check if workspace initialized (isReady) for backup-restore case
      let workspaceReady = false;
      let recovery: AcquireResult['recovery'];

      if (backupId) {
        try {
          const checkRes = await fetch(`${sandbox.agentUrl}/health`, {
            signal: AbortSignal.timeout(5000),
          });
          if (checkRes.ok) {
            const body = await checkRes.json() as { initialized?: boolean };
            workspaceReady = body.initialized === true;
          }
        } catch {
          // Sandbox not reachable yet or workspace broken
        }

        if (workspaceReady) {
          recovery = 'full';
        } else {
          // Check if S3 checkpoint exists as fallback
          let hasS3Checkpoint = false;
          try {
            await minioClient.statObject(
              config.storage.bucket,
              `checkpoints/${projectId}/manifest.json`,
            );
            hasS3Checkpoint = true;
          } catch {
            // No S3 checkpoint
          }
          recovery = hasS3Checkpoint ? 'partial' : 'lost';
          logger.warn({ projectId, recovery }, 'Backup restore did not produce initialized workspace');
        }
      }

      // 9. If not initialized and initData provided: POST to agentUrl/init
      const initRequired = !workspaceReady;
      if (initRequired && opts?.initData) {
        try {
          const initRes = await fetch(`${sandbox.agentUrl}/init`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${sandbox.secret}`,
            },
            body: JSON.stringify(opts.initData),
          });

          if (!initRes.ok) {
            const errText = await initRes.text().catch(() => 'unknown');
            logger.error({ status: initRes.status, body: errText, projectId }, 'Sandbox init failed');
            // Init failure: destroy container and mark suspended
            try { await provider.destroy(sandbox); } catch {}
            await db.update(sandboxSessions)
              .set({
                status: 'suspended',
                suspendedAt: new Date(),
                suspendReason: 'health_failure',
              })
              .where(eq(sandboxSessions.id, sessionId));
            throw new Error(`Sandbox init failed with status ${initRes.status}: ${errText}`);
          }
        } catch (err: any) {
          if (err.message?.startsWith('Sandbox init failed')) throw err;
          logger.error({ err, projectId }, 'Failed to send init data to sandbox');
          try { await provider.destroy(sandbox); } catch {}
          await db.update(sandboxSessions)
            .set({
              status: 'suspended',
              suspendedAt: new Date(),
              suspendReason: 'health_failure',
            })
            .where(eq(sandboxSessions.id, sessionId));
          throw err;
        }
      }

      // 10. Update DB with sandbox info
      await db.update(sandboxSessions)
        .set({
          status: 'ready',
          railwayServiceId: sandbox.id,
          railwayVolumeId: sandbox.volumeId,
          railwayVolumeInstanceId: sandbox.volumeInstanceId,
          sandboxSecret: sandbox.secret,
          internalUrl: sandbox.internalUrl,
          agentUrl: sandbox.agentUrl,
          metadata: { agentUrl: sandbox.agentUrl },
          lastActivityAt: new Date(),
          suspendedAt: null,
          suspendReason: null,
        })
        .where(eq(sandboxSessions.id, sessionId));

      // 11. Start activity tracking
      touchActivity(projectId);

      return { sandbox, initRequired, recovery };
    });
  }

  // -----------------------------------------------------------------------
  // recoverStaleSession() — try volume backup, check S3, mark suspended
  // -----------------------------------------------------------------------

  async recoverStaleSession(
    session: typeof sandboxSessions.$inferSelect,
    provider: SandboxProvider,
  ): Promise<void> {
    const sandboxMeta = {
      id: session.railwayServiceId!,
      projectId: session.projectId,
      volumeId: session.railwayVolumeId!,
      volumeInstanceId: session.railwayVolumeInstanceId!,
    };

    // Try to backup volume (may still exist even though container died)
    let recoveredBackupId: string | undefined;
    try {
      recoveredBackupId = await provider.backup(sandboxMeta);
      logger.info({ projectId: session.projectId, backupId: recoveredBackupId }, 'Recovered backup from stale session');
    } catch (err) {
      logger.warn({ err, projectId: session.projectId }, 'Failed to backup stale session volume');

      // Check S3 for last checkpoint
      try {
        await minioClient.statObject(
          config.storage.bucket,
          `checkpoints/${session.projectId}/manifest.json`,
        );
        logger.info({ projectId: session.projectId }, 'S3 checkpoint exists for stale session');
      } catch {
        logger.warn({ projectId: session.projectId }, 'No S3 checkpoint for stale session — data may be lost');
      }
    }

    // Clean up dead container/volume
    try {
      await provider.destroy(sandboxMeta);
    } catch (err) {
      logger.warn({ err, projectId: session.projectId }, 'Failed to destroy stale sandbox');
    }

    // Mark session as suspended so creation flow picks up the backup
    await db.update(sandboxSessions)
      .set({
        status: 'suspended',
        backupId: recoveredBackupId || session.backupId,
        railwayServiceId: null,
        railwayVolumeId: null,
        railwayVolumeInstanceId: null,
        internalUrl: null,
        agentUrl: null,
        metadata: {},
        suspendedAt: new Date(),
        suspendReason: 'health_failure',
      })
      .where(eq(sandboxSessions.id, session.id));

    removeActivity(session.projectId);
  }

  // -----------------------------------------------------------------------
  // suspend() — full suspend flow
  // -----------------------------------------------------------------------

  async suspend(projectId: string, reason: SuspendReason = 'user'): Promise<void> {
    await this.withMutex(projectId, async () => {
      const [session] = await db.select().from(sandboxSessions)
        .where(and(
          eq(sandboxSessions.projectId, projectId),
          eq(sandboxSessions.status, 'ready'),
        ))
        .limit(1);

      if (!session) return;

      const provider = await this.getProvider();

      try {
        // Mark as suspending
        await db.update(sandboxSessions)
          .set({ status: 'suspending' })
          .where(eq(sandboxSessions.id, session.id));

        // Durable checkpoint to S3 (best-effort)
        await this.durableCheckpoint(projectId, session).catch(err => {
          logger.warn({ err, projectId }, 'Durable checkpoint failed during suspend');
        });

        const sandboxMeta = {
          id: session.railwayServiceId!,
          projectId: session.projectId,
          volumeId: session.railwayVolumeId!,
          volumeInstanceId: session.railwayVolumeInstanceId!,
        };

        // Backup volume via provider
        let backupId: string | undefined;
        try {
          backupId = await provider.backup(sandboxMeta);
        } catch (err) {
          logger.warn({ err, projectId }, 'Volume backup failed during suspend');
        }

        // Destroy container
        try {
          await provider.destroy(sandboxMeta);
        } catch (err) {
          logger.warn({ err, projectId }, 'Container destroy failed during suspend');
        }

        // Update DB
        await db.update(sandboxSessions)
          .set({
            status: 'suspended',
            backupId: backupId || session.backupId,
            railwayServiceId: null,
            railwayVolumeId: null,
            railwayVolumeInstanceId: null,
            internalUrl: null,
            agentUrl: null,
            metadata: {},
            suspendedAt: new Date(),
            suspendReason: reason,
          })
          .where(eq(sandboxSessions.id, session.id));

        // Clear Redis keys
        await redis.del(
          `sandbox:tasks:${projectId}`,
          `sandbox:busy:${projectId}`,
          `sandbox:progress:${projectId}`,
          `sandbox:activity:${projectId}`,
          `sandbox:plan:${projectId}`,
        ).catch(err => {
          logger.warn({ err, projectId }, 'Failed to clear Redis keys during suspend');
        });

        // Clean up activity tracking + notify WebSocket clients
        removeActivity(projectId);
        await emitWorkspaceTeardown(projectId);

        logger.info({ projectId, reason }, 'Sandbox suspended');
      } catch (err) {
        logger.error({ err, projectId }, 'Failed to suspend sandbox');
        throw err;
      }
    });
  }

  // -----------------------------------------------------------------------
  // durableCheckpoint() — fetch manifest from sandbox, upload to S3
  // -----------------------------------------------------------------------

  async durableCheckpoint(
    projectId: string,
    session: typeof sandboxSessions.$inferSelect,
  ): Promise<void> {
    const agentUrl = session.agentUrl || (session.metadata as any)?.agentUrl;
    if (!agentUrl) {
      logger.warn({ projectId }, 'No agentUrl for durable checkpoint');
      return;
    }

    const result = await proxyManifestOp(agentUrl, session.sandboxSecret, 'GET');
    if (result.status !== 200) {
      throw new Error(`Manifest fetch failed with status ${result.status}`);
    }

    const manifestJson = JSON.stringify(result.data);
    await minioClient.putObject(
      config.storage.bucket,
      `checkpoints/${projectId}/manifest.json`,
      Buffer.from(manifestJson),
      manifestJson.length,
      { 'Content-Type': 'application/json' },
    );

    logger.debug({ projectId }, 'Durable checkpoint uploaded to S3');
  }

  // -----------------------------------------------------------------------
  // checkpoint() — public: upload manifest directly to S3
  // -----------------------------------------------------------------------

  async checkpoint(projectId: string, manifest: unknown): Promise<void> {
    const manifestJson = JSON.stringify(manifest);
    await minioClient.putObject(
      config.storage.bucket,
      `checkpoints/${projectId}/manifest.json`,
      Buffer.from(manifestJson),
      manifestJson.length,
      { 'Content-Type': 'application/json' },
    );
    logger.debug({ projectId }, 'Manifest checkpoint uploaded to S3');
  }

  // -----------------------------------------------------------------------
  // getStatus() — read DB session + Redis state
  // -----------------------------------------------------------------------

  async getStatus(projectId: string): Promise<SandboxStatus> {
    const [session] = await db.select().from(sandboxSessions)
      .where(eq(sandboxSessions.projectId, projectId))
      .limit(1);

    if (!session) {
      return {
        status: 'inactive',
        previewUrl: null,
        busy: false,
        activeTasks: [],
        plan: null,
        startedAt: null,
      };
    }

    // If DB says "ready", verify the container is actually alive
    if (session.status === 'ready' && session.internalUrl) {
      const provider = await this.getProvider();
      const healthy = await provider.isReady(session.internalUrl);
      if (!healthy) {
        return {
          status: 'suspended',
          previewUrl: null,
          busy: false,
          activeTasks: [],
          plan: null,
          startedAt: null,
        };
      }
    }

    let activeTasks: unknown[] = [];
    let busy = false;
    let startedAt: number | null = null;
    let plan: unknown | null = null;

    if (session.status === 'ready') {
      const [tasksRaw, busyRaw, planRaw] = await Promise.all([
        redis.get(`sandbox:tasks:${projectId}`).catch(() => null),
        redis.get(`sandbox:busy:${projectId}`).catch(() => null),
        redis.get(`sandbox:plan:${projectId}`).catch(() => null),
      ]);

      if (tasksRaw) try { activeTasks = JSON.parse(tasksRaw); } catch {}
      if (busyRaw) try {
        const b = JSON.parse(busyRaw);
        busy = b.busy;
        startedAt = b.startedAt;
      } catch {}
      if (planRaw) try { plan = JSON.parse(planRaw); } catch {}

      // Fallback: poll sandbox directly if Redis has no busy state
      if (!busy) {
        const agentUrl = session.agentUrl || (session.metadata as any)?.agentUrl;
        if (agentUrl) {
          try {
            const sbStatus = await fetch(`${agentUrl}/status`, {
              headers: { 'Authorization': `Bearer ${session.sandboxSecret}` },
              signal: AbortSignal.timeout(3000),
            }).then(r => r.json()) as {
              busy?: boolean;
              activeTasks?: unknown[];
              startedAt?: number;
              plan?: unknown;
            };
            if (sbStatus.busy) {
              busy = true;
              activeTasks = sbStatus.activeTasks ?? [];
              startedAt = sbStatus.startedAt ?? null;
              plan = sbStatus.plan ?? plan;
            }
          } catch { /* sandbox unreachable — ignore */ }
        }
      }
    }

    return {
      status: session.status,
      previewUrl: session.status === 'ready'
        ? `/api/projects/${projectId}/sandbox/bundle/player-composition.cjs.js`
        : null,
      busy,
      activeTasks,
      plan,
      startedAt,
    };
  }

  // -----------------------------------------------------------------------
  // rehydrate() — clean up stuck sessions, health-check ready sessions
  // -----------------------------------------------------------------------

  async rehydrate(): Promise<void> {
    const activeSessions = await db.select().from(sandboxSessions)
      .where(inArray(sandboxSessions.status, ['ready', 'creating', 'suspending']));

    logger.info({ count: activeSessions.length }, 'Rehydrating sandbox sessions after restart');

    for (const session of activeSessions) {
      if (session.status === 'creating' || session.status === 'suspending') {
        // Partial operation interrupted by crash — mark as suspended
        logger.warn(
          { projectId: session.projectId, status: session.status },
          'Found interrupted sandbox operation, cleaning up',
        );
        await db.update(sandboxSessions)
          .set({ status: 'suspended', suspendedAt: new Date(), suspendReason: 'api_shutdown' })
          .where(eq(sandboxSessions.id, session.id));
        continue;
      }

      // Status is 'ready' — verify the sandbox is actually reachable
      if (session.internalUrl) {
        const provider = await this.getProvider();
        const healthy = await provider.isReady(session.internalUrl);

        if (healthy) {
          touchActivity(session.projectId);
          logger.info({ projectId: session.projectId }, 'Sandbox still alive after restart');
        } else {
          logger.warn({ projectId: session.projectId }, 'Sandbox unreachable after restart, marking suspended');
          await db.update(sandboxSessions)
            .set({ status: 'suspended', suspendedAt: new Date(), suspendReason: 'api_shutdown' })
            .where(eq(sandboxSessions.id, session.id));
        }
      }
    }
  }

  // -----------------------------------------------------------------------
  // Graceful shutdown
  // -----------------------------------------------------------------------

  /** Mark manager as shutting down — acquire() will reject */
  markShuttingDown(): void {
    this.shuttingDown = true;
  }

  /** Cancel all debounced sync timers */
  clearSyncTimers(): void {
    for (const timer of this.syncTimers.values()) {
      clearTimeout(timer);
    }
    this.syncTimers.clear();
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const sandboxManager = new SandboxManager();
