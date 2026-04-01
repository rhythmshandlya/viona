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
  widget: unknown | null;
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
  theme?: string;
  segmentationAvailable?: boolean;
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

  // Health monitoring
  private healthTimer: ReturnType<typeof setInterval> | null = null;
  private gcTimer: ReturnType<typeof setInterval> | null = null;
  private healthFailures = new Map<string, { count: number; lastCheck: number; skipUntil: number }>();

  constructor() {
    // No-op — call startMonitoring() after boot
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
      agentUrl: session.agentUrl || '',
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
        // Two-level check: is the container alive? is the workspace initialized?
        // isReady() conflates both — check container liveness separately so we
        // don't destroy alive-but-uninitialized containers.
        let containerAlive = false;
        let workspaceInitialized = false;

        if (existing.internalUrl) {
          try {
            const healthRes = await fetch(`${existing.internalUrl}/health`, {
              signal: AbortSignal.timeout(3000),
            });
            if (healthRes.ok) {
              containerAlive = true;
              const body = await healthRes.json() as { initialized?: boolean };
              workspaceInitialized = body.initialized === true;
            }
          } catch {
            // Container not reachable
          }
        }

        if (containerAlive && workspaceInitialized) {
          touchActivity(projectId);
          return {
            sandbox: this.sessionToSandbox(existing),
            initRequired: false,
            recovery: undefined,
          };
        }

        if (containerAlive && !workspaceInitialized) {
          // Container is alive but init hasn't completed yet (or failed).
          // Return with initRequired: true — the caller will re-send init data.
          // DON'T destroy the container.
          logger.info({ projectId }, 'Container alive but not initialized — returning for re-init');
          touchActivity(projectId);
          const sandbox = this.sessionToSandbox(existing);

          // If initData provided, fire init again (with retry)
          if (opts?.initData) {
            const initUrl = `${sandbox.agentUrl}/init`;
            const initHeaders = {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${sandbox.secret}`,
            };
            const initBody = JSON.stringify(opts.initData);

            (async () => {
              const MAX_RETRIES = 5;
              const RETRY_DELAY = 3000;
              for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
                try {
                  const res = await fetch(initUrl, {
                    method: 'POST',
                    headers: initHeaders,
                    body: initBody,
                    signal: AbortSignal.timeout(120_000),
                  });
                  if (res.ok || res.status === 409) {
                    logger.info({ projectId, attempt }, 'Re-init completed');
                    return;
                  }
                  logger.warn({ projectId, status: res.status, attempt }, 'Re-init failed');
                } catch (err: any) {
                  logger.warn({ projectId, err: err.message, attempt }, 'Re-init POST failed');
                }
                if (attempt < MAX_RETRIES - 1) {
                  await new Promise(r => setTimeout(r, RETRY_DELAY));
                }
              }
              logger.error({ projectId }, 'Re-init failed after all retries');
            })();
          }

          return {
            sandbox,
            initRequired: true,
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

      // 3. Atomic concurrent limit check + session upsert inside a DB transaction
      //    SELECT FOR UPDATE locks active rows to prevent concurrent creates
      let deferredSuspensions: Array<{ projectId: string }> = [];
      let sessionId: string = '';

      await db.transaction(async (tx: any) => {
        // Lock all active session rows
        const activeRows = await tx.execute(
          sql`SELECT id, user_id, project_id FROM sandbox_sessions WHERE status IN ('creating', 'ready') FOR UPDATE`
        );
        const rows: Array<{ id: string; user_id: string; project_id: string }> = activeRows.rows ?? activeRows;

        if (rows.length >= config.sandbox.maxConcurrent) {
          throw new Error('Maximum concurrent sandboxes reached');
        }

        // Per-user limit: find other active sessions for this user
        deferredSuspensions = rows
          .filter(r => r.user_id === userId && r.project_id !== projectId)
          .map(r => ({ projectId: r.project_id }));

        // Upsert session: UPDATE if suspended exists, INSERT if not
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

        if (suspended) {
          await tx.update(sandboxSessions)
            .set(sessionData)
            .where(eq(sandboxSessions.id, suspended.id));
          sessionId = suspended.id;
        } else {
          const [inserted] = await tx.insert(sandboxSessions).values({
            projectId,
            userId,
            provider: config.sandbox.provider,
            ...sessionData,
          }).returning({ id: sandboxSessions.id });
          sessionId = inserted.id;
        }
      });

      // 4. After transaction committed: suspend other user sandboxes (fire-and-forget)
      for (const other of deferredSuspensions) {
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

      // 8. Wait for container to be reachable, then check if workspace initialized
      let workspaceReady = false;
      let recovery: AcquireResult['recovery'];

      // Retry health check — container needs time to start its HTTP server
      const MAX_HEALTH_RETRIES = 15;
      const HEALTH_RETRY_DELAY_MS = 1000;
      for (let attempt = 0; attempt < MAX_HEALTH_RETRIES; attempt++) {
        try {
          const checkRes = await fetch(`${sandbox.agentUrl}/health`, {
            signal: AbortSignal.timeout(3000),
          });
          if (checkRes.ok) {
            const body = await checkRes.json() as { initialized?: boolean };
            workspaceReady = body.initialized === true;
            break; // Container is reachable
          }
        } catch {
          // Container not ready yet — wait and retry
        }
        if (attempt < MAX_HEALTH_RETRIES - 1) {
          await new Promise(r => setTimeout(r, HEALTH_RETRY_DELAY_MS));
        }
      }

      if (workspaceReady) {
        recovery = 'full';
      } else if (backupId) {
        // Had a backup but workspace not ready — check S3 for manifest-only fallback
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
        logger.warn({ projectId, recovery }, 'Restore did not produce initialized workspace');
      }

      // 9. If not initialized and initData provided: fire-and-forget POST to agentUrl/init
      // The init endpoint downloads media, generates proxies, etc. which can take minutes.
      // We don't block on it — the container is already reachable and the frontend
      // navigates to the editor immediately. The sandbox /init runs in the background
      // and the orchestrator starts after it completes.
      const initRequired = !workspaceReady;
      if (initRequired && opts?.initData) {
        const initUrl = `${sandbox.agentUrl}/init`;
        const initHeaders = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sandbox.secret}`,
        };
        const initBody = JSON.stringify(opts.initData);

        // Fire-and-forget with retry: the container may need a moment after health check
        // passes before it can accept large POST bodies. Retry up to 5 times with backoff.
        const MAX_INIT_RETRIES = 5;
        const INIT_RETRY_DELAY_MS = 3000;

        (async () => {
          for (let attempt = 0; attempt < MAX_INIT_RETRIES; attempt++) {
            try {
              const initRes = await fetch(initUrl, {
                method: 'POST',
                headers: initHeaders,
                body: initBody,
                signal: AbortSignal.timeout(120_000), // 2min timeout for large payloads
              });

              if (initRes.ok) {
                logger.info({ projectId, attempt }, 'Sandbox init completed (async)');
                return; // Success
              }

              // HTTP error — check if retryable
              const errText = await initRes.text().catch(() => 'unknown');
              if (initRes.status === 409) {
                // Already initialized (race with volume restore) — not an error
                logger.info({ projectId }, 'Sandbox already initialized (409)');
                return;
              }

              logger.warn({ status: initRes.status, body: errText, projectId, attempt }, 'Sandbox init failed, will retry');
            } catch (err: any) {
              logger.warn({ err: err.message, projectId, attempt }, 'Init POST failed (network), will retry');
            }

            // Wait before retry (skip wait on last attempt)
            if (attempt < MAX_INIT_RETRIES - 1) {
              await new Promise(r => setTimeout(r, INIT_RETRY_DELAY_MS));
            }
          }

          // All retries exhausted — log error but DON'T destroy the container.
          // The container is still alive and the user can retry via page refresh.
          // Destroying creates a worse UX (full container recreate cycle).
          logger.error({ projectId, retries: MAX_INIT_RETRIES }, 'Sandbox init failed after all retries — container left alive for manual retry');
        })();
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
          metadata: {},
          lastActivityAt: new Date(),
          suspendedAt: null,
          suspendReason: null,
        })
        .where(eq(sandboxSessions.id, sessionId));

      // 11. Mark project workspace as active
      await db.update(projects)
        .set({
          workspaceStatus: 'active',
          workspaceLastActivity: new Date(),
        })
        .where(eq(projects.id, projectId));

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

        // Mark project workspace as inactive
        await db.update(projects)
          .set({ workspaceStatus: 'inactive' })
          .where(eq(projects.id, projectId));

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
    const agentUrl = session.agentUrl;
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
        widget: null,
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
          widget: null,
          startedAt: null,
        };
      }
    }

    let activeTasks: unknown[] = [];
    let busy = false;
    let startedAt: number | null = null;
    let plan: unknown | null = null;
    let widget: unknown | null = null;

    if (session.status === 'ready') {
      const [tasksRaw, busyRaw, planRaw, widgetRaw] = await Promise.all([
        redis.get(`sandbox:tasks:${projectId}`).catch(() => null),
        redis.get(`sandbox:busy:${projectId}`).catch(() => null),
        redis.get(`sandbox:plan:${projectId}`).catch(() => null),
        redis.get(`sandbox:widget:${projectId}`).catch(() => null),
      ]);

      if (tasksRaw) try { activeTasks = JSON.parse(tasksRaw); } catch {}
      if (busyRaw) try {
        const b = JSON.parse(busyRaw);
        busy = b.busy;
        startedAt = b.startedAt;
      } catch {}
      if (planRaw) try { plan = JSON.parse(planRaw); } catch {}
      if (widgetRaw) try { widget = JSON.parse(widgetRaw); } catch {}

      // Fallback: poll sandbox directly if Redis has no busy state
      if (!busy) {
        const agentUrl = session.agentUrl;
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
              widget?: unknown;
            };
            if (sbStatus.busy) {
              busy = true;
              activeTasks = sbStatus.activeTasks ?? [];
              startedAt = sbStatus.startedAt ?? null;
              plan = sbStatus.plan ?? plan;
              widget = sbStatus.widget ?? widget;
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
      widget,
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
  // Monitoring — startMonitoring() / stopMonitoring()
  // -----------------------------------------------------------------------

  /** Start health sweep, GC sweep, and idle-suspension callback. Call once on boot. */
  startMonitoring(): void {
    // Register idle callback — when health.ts detects idle, suspend with reason
    onSandboxIdle(async (projectId, reason) => {
      await this.suspend(projectId, (reason as SuspendReason) || 'idle');
    });

    // Health sweep every 30s
    this.healthTimer = setInterval(() => {
      this.healthSweep().catch(err => {
        logger.error({ err: (err as Error).message }, 'Health sweep failed');
      });
    }, 30_000);

    // GC sweep every 5 minutes
    this.gcTimer = setInterval(() => {
      this.gcSweep().catch(err => {
        logger.error({ err: (err as Error).message }, 'GC sweep failed');
      });
    }, 5 * 60_000);

    // Rehydrate existing sessions on boot
    this.rehydrate().catch(err => {
      logger.error({ err: (err as Error).message }, 'Rehydration failed');
    });

    logger.info('Sandbox monitoring started');
  }

  // -----------------------------------------------------------------------
  // healthSweep() — check all ready sessions, suspend after 3 consecutive failures
  // -----------------------------------------------------------------------

  private async healthSweep(): Promise<void> {
    const provider = await this.getProvider();
    const sessions = await db.query.sandboxSessions.findMany({
      where: eq(sandboxSessions.status, 'ready'),
    });

    // Filter to sessions that need checking (skip those in backoff window)
    const toCheck = sessions.filter(session => {
      if (!session.internalUrl) return false;
      const tracking = this.healthFailures.get(session.id);
      return !tracking || Date.now() >= tracking.skipUntil;
    });

    // Check in parallel batches of 20 to avoid overwhelming the network
    const BATCH_SIZE = 20;
    for (let i = 0; i < toCheck.length; i += BATCH_SIZE) {
      const batch = toCheck.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(async session => {
          const healthy = await provider.isReady(session.internalUrl!);
          return { session, healthy };
        })
      );

      for (const result of results) {
        if (result.status === 'rejected') continue;
        const { session, healthy } = result.value;

        if (healthy) {
          this.healthFailures.delete(session.id);
        } else {
          const current = this.healthFailures.get(session.id) || { count: 0, lastCheck: 0, skipUntil: 0 };
          current.count++;
          current.lastCheck = Date.now();
          // Exponential skip: 30s, 60s, 120s, 240s cap
          const skipMs = Math.min(30_000 * Math.pow(2, current.count - 1), 240_000);
          current.skipUntil = Date.now() + skipMs;
          this.healthFailures.set(session.id, current);

          if (current.count >= 3) {
            logger.warn({ projectId: session.projectId, failures: current.count }, 'Sandbox unhealthy, suspending');
            this.healthFailures.delete(session.id);
            await this.suspend(session.projectId, 'health_failure').catch(err => {
              logger.error({ err: (err as Error).message, projectId: session.projectId }, 'Auto-suspend failed');
            });
          }
        }
      }
    }
  }

  // -----------------------------------------------------------------------
  // gcSweep() — clean orphaned containers + stuck transitional DB rows
  // -----------------------------------------------------------------------

  private async gcSweep(): Promise<void> {
    const provider = await this.getProvider();

    // 1. Provider-level orphan detection (if supported)
    if (provider.listContainers) {
      try {
        const containers = await provider.listContainers();
        const activeSessions = await db.query.sandboxSessions.findMany({
          where: inArray(sandboxSessions.status, ['creating', 'ready']),
          columns: { projectId: true, railwayServiceId: true },
        });

        // Match by full projectId (Docker labels) OR by service ID (Railway)
        const knownProjectIds = new Set(activeSessions.map((s: any) => s.projectId));
        const knownServiceIds = new Set(activeSessions.map((s: any) => s.railwayServiceId).filter(Boolean));

        for (const c of containers) {
          const isKnown = knownProjectIds.has(c.projectId) || knownServiceIds.has(c.id);
          if (!isKnown) {
            // Grace period: don't delete containers younger than 10 minutes
            if (Date.now() - c.createdAt < 10 * 60_000) continue;
            logger.warn({ projectId: c.projectId, containerId: c.id }, 'Orphaned container found, removing');
            try {
              await provider.destroy({ id: c.id, volumeId: '', projectId: c.projectId });
            } catch (err: unknown) {
              logger.error({ err: (err as Error).message }, 'Failed to remove orphaned container');
            }
          }
        }
      } catch (err: unknown) {
        logger.warn({ err: (err as Error).message }, 'Container listing for GC failed');
      }
    }

    // 2. DB cleanup: stuck transitional states
    const now = new Date();
    const tenMinAgo = new Date(now.getTime() - 10 * 60_000);
    const fiveMinAgo = new Date(now.getTime() - 5 * 60_000);

    const stuckCreating = await db.query.sandboxSessions.findMany({
      where: and(
        eq(sandboxSessions.status, 'creating'),
        sql`${sandboxSessions.createdAt} < ${tenMinAgo}`,
      ),
    });
    for (const s of stuckCreating) {
      logger.warn({ projectId: s.projectId }, 'Session stuck in creating for >10min, marking suspended');
      await db.update(sandboxSessions)
        .set({ status: 'suspended', suspendReason: 'health_failure' })
        .where(eq(sandboxSessions.id, s.id));
    }

    const stuckSuspending = await db.query.sandboxSessions.findMany({
      where: and(
        eq(sandboxSessions.status, 'suspending'),
        sql`${sandboxSessions.lastActivityAt} < ${fiveMinAgo}`,
      ),
    });
    for (const s of stuckSuspending) {
      logger.warn({ projectId: s.projectId }, 'Session stuck in suspending for >5min, force cleanup');
      try {
        await provider.destroy({
          id: s.railwayServiceId || s.id,
          volumeId: s.railwayVolumeId || '',
          projectId: s.projectId,
        });
      } catch { /* best-effort */ }
      await db.update(sandboxSessions)
        .set({ status: 'suspended', suspendReason: 'health_failure' })
        .where(eq(sandboxSessions.id, s.id));
    }
  }

  // -----------------------------------------------------------------------
  // stopMonitoring() — graceful shutdown: checkpoint all, drain, clean up
  // -----------------------------------------------------------------------

  async stopMonitoring(): Promise<void> {
    this.shuttingDown = true;

    // Stop loops
    if (this.healthTimer) { clearInterval(this.healthTimer); this.healthTimer = null; }
    if (this.gcTimer) { clearInterval(this.gcTimer); this.gcTimer = null; }

    // Clear sync timers
    for (const timer of this.syncTimers.values()) clearTimeout(timer);
    this.syncTimers.clear();

    // Graceful drain: backup all active sandboxes
    const readySessions = await db.query.sandboxSessions.findMany({
      where: eq(sandboxSessions.status, 'ready'),
    });

    if (readySessions.length === 0) {
      logger.info('Shutdown complete: no active sandboxes');
      return;
    }

    logger.info({ count: readySessions.length }, 'Shutting down: backing up active sandboxes');

    let succeeded = 0;
    let failed = 0;

    // Process in batches of 10
    const batchSize = 10;
    for (let i = 0; i < readySessions.length; i += batchSize) {
      const batch = readySessions.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map(async (session) => {
          const prov = await this.getProvider();
          // Checkpoint to S3
          await this.durableCheckpoint(session.projectId, session).catch(() => {});
          // Backup volume
          let backupId: string | null = null;
          try {
            backupId = await prov.backup({
              id: session.railwayServiceId || session.id,
              volumeId: session.railwayVolumeId || session.internalUrl || '',
              volumeInstanceId: session.railwayVolumeInstanceId || session.internalUrl || '',
              projectId: session.projectId,
            });
          } catch { /* best-effort */ }
          // Mark as suspended
          await db.update(sandboxSessions)
            .set({ status: 'suspended', backupId, suspendReason: 'api_shutdown', suspendedAt: new Date() })
            .where(eq(sandboxSessions.id, session.id));
        })
      );
      for (const r of results) {
        if (r.status === 'fulfilled') succeeded++;
        else failed++;
      }
    }

    logger.info({ succeeded, failed }, 'Shutdown complete');
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const sandboxManager = new SandboxManager();
