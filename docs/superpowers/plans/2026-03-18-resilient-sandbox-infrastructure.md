# Resilient Sandbox Infrastructure — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the sandbox system for production scale (1000s of users) — extract SandboxManager, atomic limits, durable checkpoints, health monitoring, zombie GC, Docker hardening.

**Architecture:** Extract lifecycle orchestration from `routes.ts` into a `SandboxManager` class. Routes become thin HTTP handlers. The manager owns concurrent limits (DB-level), health sweeps, GC, graceful shutdown, and durable checkpoints. Docker provider rewrites with dockerode for dynamic ports, resource limits, and labels.

**Tech Stack:** Node.js, Fastify, Drizzle ORM, PostgreSQL, Redis, dockerode, MinIO/S3

**Spec:** `docs/superpowers/specs/2026-03-18-resilient-sandbox-infrastructure-design.md`

---

## File Structure

### New Files
- `packages/api/src/sandbox/manager.ts` — SandboxManager class: lifecycle (acquire/suspend), health loop, GC loop, graceful shutdown, durable checkpoint

### Modified Files
- `packages/api/src/db/schema.ts` — Add `suspendReason`, `agentUrl` columns; remove `sandboxPort`
- `packages/api/src/sandbox/provider.ts` — Add optional `listContainers()` for GC
- `packages/api/src/sandbox/docker.ts` — Full rewrite with dockerode, dynamic ports, resource limits, labels
- `packages/api/src/sandbox/health.ts` — Add `reason` param to suspend callback
- `packages/api/src/sandbox/routes.ts` — Slim down to thin handlers delegating to manager
- `packages/api/src/index.ts` — Wire manager.startMonitoring/stopMonitoring
- `packages/sandbox/src/workspace-init.ts` — Staging directory pattern for atomic init
- `packages/sandbox/Dockerfile` — Add HEALTHCHECK instruction
- `packages/api/package.json` — Add dockerode dependency

---

## Task 1: DB Schema Changes

**Spec:** R1.2, R9 (File Changes Summary)
**Files:**
- Modify: `packages/api/src/db/schema.ts:170-187`

Schema changes first since everything else depends on the new columns.

- [ ] **Step 1: Read current schema**

Read `packages/api/src/db/schema.ts` in full to see the current `sandboxSessions` table definition.

- [ ] **Step 2: Add `suspendReason` and `agentUrl` columns, remove `sandboxPort`**

In the `sandboxSessions` table definition:

```typescript
// Add after the existing columns (around line 182):
agentUrl: varchar('agent_url'),
suspendReason: varchar('suspend_reason'), // 'idle' | 'user' | 'health_failure' | 'limit_exceeded' | 'api_shutdown'
```

Remove the `sandboxPort` line (currently around line 181).

- [ ] **Step 3: Generate and run migration**

```bash
cd packages/api && npx drizzle-kit generate
```

Review the generated SQL migration file. Then:

```bash
cd packages/api && npx drizzle-kit push
```

- [ ] **Step 4: Verify API compiles**

```bash
cd packages/api && npx tsc --noEmit
```

Expected: Type errors in routes.ts where `sandboxPort` was used or `(session.metadata as any)?.agentUrl` is referenced. These are expected and will be fixed in Task 6.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/db/schema.ts packages/api/drizzle/
git commit -m "feat(db): add agentUrl and suspendReason columns, remove sandboxPort"
```

---

## Task 2: Provider Interface + Health Callback Update

**Spec:** R7.1, R1.2
**Files:**
- Modify: `packages/api/src/sandbox/provider.ts:24-42`
- Modify: `packages/api/src/sandbox/health.ts:13`

- [ ] **Step 1: Read current provider.ts and health.ts**

Read both files in full.

- [ ] **Step 2: Add optional `listContainers()` to provider interface**

In `provider.ts`, add to the `SandboxProvider` interface:

```typescript
/** List running sandbox containers/services for GC reconciliation. Optional — not all providers support it. */
listContainers?(): Promise<Array<{ id: string; projectId: string; createdAt: number }>>;
```

- [ ] **Step 3: Update health.ts suspend callback signature**

Change the `SuspendCallback` type to accept a reason:

```typescript
type SuspendCallback = (projectId: string, reason: string) => Promise<void>;
```

Update `onSandboxIdle()` and the idle timer invocation to pass `'idle'` as the reason:

```typescript
// In the idle timer callback (around line 83):
suspendCallback(projectId, 'idle');
```

- [ ] **Step 4: Verify API compiles**

```bash
cd packages/api && npx tsc --noEmit
```

Expected: May have errors in routes.ts where `suspendCallback` is called without reason. Note them for Task 6.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/sandbox/provider.ts packages/api/src/sandbox/health.ts
git commit -m "feat(sandbox): add listContainers to provider interface, add reason to suspend callback"
```

---

## Task 3: Docker Provider Rewrite with dockerode

**Spec:** R9.1–R9.3
**Files:**
- Modify: `packages/api/package.json`
- Modify: `packages/api/src/sandbox/docker.ts` (full rewrite)
- Modify: `packages/sandbox/Dockerfile`

- [ ] **Step 1: Install dockerode**

```bash
cd packages/api && pnpm add dockerode && pnpm add -D @types/dockerode
```

- [ ] **Step 2: Read current docker.ts**

Read `packages/api/src/sandbox/docker.ts` in full.

- [ ] **Step 3: Rewrite docker.ts with dockerode**

```typescript
import type Docker from 'dockerode';
import { randomUUID } from 'crypto';
import { join, resolve } from 'path';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { homedir } from 'os';
import { logger } from '../logger.js';
import { config } from '../config.js';
import type { SandboxProvider, Sandbox, CreateSandboxOpts } from './provider.js';

const WORKSPACES_ROOT = resolve(process.cwd(), '.sandbox-workspaces');

// Lazy-load dockerode (only used in Docker provider, not on Railway)
let _docker: Docker | null = null;
async function getDocker(): Promise<Docker> {
  if (!_docker) {
    const { default: DockerClient } = await import('dockerode');
    _docker = new DockerClient();
  }
  return _docker;
}

export class DockerSandboxProvider implements SandboxProvider {
  async create(opts: CreateSandboxOpts): Promise<Sandbox> {
    const { projectId, backupId, env = {} } = opts;
    const docker = await getDocker();
    const containerName = `sandbox-${projectId}`;
    const workspacePath = join(WORKSPACES_ROOT, projectId);
    const secret = randomUUID();

    try {
      // 1. Kill any existing container for THIS project (not all sandboxes)
      try {
        const existing = docker.getContainer(containerName);
        await existing.remove({ force: true });
      } catch {
        // Container doesn't exist — fine
      }

      // 2. Create workspace directory
      mkdirSync(workspacePath, { recursive: true });

      // 3. Restore from backup if provided
      if (backupId) {
        const { execFile } = await import('child_process');
        const { promisify } = await import('util');
        const execFileAsync = promisify(execFile);
        await execFileAsync('docker', [
          'run', '--rm',
          '-v', `${backupId}:/backup`,
          '-v', `${workspacePath}:/workspace`,
          'busybox', 'cp', '-a', '/backup/.', '/workspace/',
        ], { timeout: 60_000 });
      }

      // 4. Build environment
      const envEntries: Record<string, string> = {
        SANDBOX_SECRET: secret,
        SANDBOX_ID: projectId,
        API_CALLBACK_URL: `http://host.docker.internal:${config.port}/api`,
        CHECKPOINT_INTERVAL_MS: String(config.sandbox.checkpointIntervalMs),
        MINIO_ENDPOINT: 'host.docker.internal',
        MINIO_PORT: String(config.storage.port),
        MINIO_ACCESS_KEY: config.storage.accessKey,
        MINIO_SECRET_KEY: config.storage.secretKey,
        MINIO_BUCKET: config.storage.bucket,
        MINIO_USE_SSL: 'false',
        ...env,
      };

      // 5. Create container with resource limits and dynamic ports
      const binds = [`${workspacePath}:/workspace`];
      const claudeDir = join(homedir(), '.claude');
      if (existsSync(claudeDir)) {
        binds.push(`${claudeDir}:/home/sandbox/.claude`);
      }

      const container = await docker.createContainer({
        name: containerName,
        Image: config.sandbox.image,
        Env: Object.entries(envEntries).map(([k, v]) => `${k}=${v}`),
        Labels: {
          'viona.sandbox': 'true',
          'viona.projectId': projectId,
          'viona.createdAt': String(Date.now()),
        },
        ExposedPorts: { '8080/tcp': {}, '8081/tcp': {} },
        HostConfig: {
          Init: true,
          Memory: 4 * 1024 ** 3,       // 4GB
          MemorySwap: 4 * 1024 ** 3,   // no swap
          NanoCpus: 2e9,               // 2 CPUs
          PidsLimit: 512,
          Binds: binds,
          PortBindings: {
            '8080/tcp': [{ HostPort: '0' }],  // dynamic
            '8081/tcp': [{ HostPort: '0' }],  // dynamic
          },
        },
      });

      await container.start();

      // 6. Read dynamic port assignments
      const info = await container.inspect();
      const filePort = info.NetworkSettings.Ports['8080/tcp']?.[0]?.HostPort;
      const agentPort = info.NetworkSettings.Ports['8081/tcp']?.[0]?.HostPort;

      if (!filePort || !agentPort) {
        throw new Error('Failed to get dynamic port assignments');
      }

      const sandbox: Sandbox = {
        id: info.Id,
        projectId,
        volumeId: workspacePath,
        volumeInstanceId: workspacePath,
        internalUrl: `http://localhost:${filePort}`,
        agentUrl: `http://localhost:${agentPort}`,
        secret,
        status: 'creating',
      };

      // 7. Wait for health
      await this.waitForReady(sandbox.internalUrl, 60_000);
      sandbox.status = 'ready';

      return sandbox;
    } catch (err: any) {
      logger.error({ message: err.message, containerName }, 'Docker sandbox create failed');
      // Cleanup
      try {
        const docker2 = await getDocker();
        const c = docker2.getContainer(containerName);
        await c.remove({ force: true });
      } catch {}
      if (!backupId) {
        try { rmSync(workspacePath, { recursive: true, force: true }); } catch {}
      }
      throw new Error(`Docker sandbox create failed: ${err.message}`);
    }
  }

  async destroy(sandbox: Pick<Sandbox, 'id' | 'volumeId' | 'projectId'>): Promise<void> {
    const docker = await getDocker();
    const containerName = `sandbox-${sandbox.projectId}`;
    try {
      const container = docker.getContainer(containerName);
      await container.stop({ t: 30 }).catch(() => {});
      await container.remove().catch(() => {});
    } catch (err: any) {
      logger.warn({ err: err.message }, 'Docker stop/rm failed');
    }

    const workspacePath = join(WORKSPACES_ROOT, sandbox.projectId);
    try {
      rmSync(workspacePath, { recursive: true, force: true });
      logger.info({ workspacePath }, 'Workspace directory deleted');
    } catch (err: any) {
      logger.warn({ err: err.message, workspacePath }, 'Workspace directory delete failed');
    }
  }

  async backup(sandbox: Pick<Sandbox, 'id' | 'volumeId' | 'volumeInstanceId' | 'projectId'>): Promise<string> {
    const { execFile } = await import('child_process');
    const { promisify } = await import('util');
    const execFileAsync = promisify(execFile);

    const backupVolume = `viona-backup-${sandbox.projectId}`;
    const workspacePath = join(WORKSPACES_ROOT, sandbox.projectId);

    try { await execFileAsync('docker', ['volume', 'rm', backupVolume]); } catch {}

    await execFileAsync('docker', ['volume', 'create', backupVolume]);
    await execFileAsync('docker', [
      'run', '--rm',
      '-v', `${workspacePath}:/workspace`,
      '-v', `${backupVolume}:/backup`,
      'busybox', 'cp', '-a', '/workspace/.', '/backup/',
    ], { timeout: 120_000 });

    return backupVolume;
  }

  async isReady(url: string): Promise<boolean> {
    try {
      const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) return false;
      const body = await res.json() as { initialized?: boolean };
      return body.initialized === true;
    } catch {
      return false;
    }
  }

  async listContainers(): Promise<Array<{ id: string; projectId: string; createdAt: number }>> {
    const docker = await getDocker();
    const containers = await docker.listContainers({
      all: true,
      filters: { label: ['viona.sandbox=true'] },
    });
    return containers.map(c => ({
      id: c.Id,
      projectId: c.Labels['viona.projectId'] || '',
      createdAt: Number(c.Labels['viona.createdAt'] || 0),
    }));
  }

  private async waitForReady(url: string, timeoutMs: number): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(2000) });
        if (res.ok) return;
      } catch {}
      await new Promise(r => setTimeout(r, 1000));
    }
    throw new Error(`Sandbox not ready after ${timeoutMs}ms`);
  }
}
```

- [ ] **Step 4: Add HEALTHCHECK to Dockerfile**

Read `packages/sandbox/Dockerfile` and add before the `EXPOSE` line (around line 108):

```dockerfile
HEALTHCHECK --interval=10s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://localhost:8080/health').then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))"
```

- [ ] **Step 5: Verify API compiles**

```bash
cd packages/api && npx tsc --noEmit
```

Expected: No new errors from docker.ts. Existing errors from routes.ts schema changes are expected.

- [ ] **Step 6: Commit**

```bash
git add packages/api/package.json packages/api/src/sandbox/docker.ts packages/sandbox/Dockerfile pnpm-lock.yaml
git commit -m "feat(sandbox): rewrite Docker provider with dockerode, dynamic ports, resource limits, labels

Uses dockerode for structured Docker API access. Dynamic port allocation
via -p 0:port. Resource limits: 4GB memory, 2 CPUs, 512 PIDs. Container
labels for GC. HEALTHCHECK added to Dockerfile."
```

---

## Task 4: SandboxManager — Core Lifecycle

**Spec:** R1.1–R1.4, R2.1–R2.3, R3.1–R3.3, R10.1–R10.3
**Files:**
- Create: `packages/api/src/sandbox/manager.ts`

This is the largest task. Creates the SandboxManager with `acquire()`, `suspend()`, `getStatus()`, and atomic concurrent limits. Health loop and GC loop are added in Task 5.

- [ ] **Step 1: Read routes.ts sections that will be extracted**

Read `packages/api/src/sandbox/routes.ts` focusing on:
- Lines 65–340 (create/resume logic — becomes `acquire()`)
- Lines 704–749 (`suspendSandbox()` — becomes `suspend()`)
- Lines 350–437 (status endpoint logic — becomes `getStatus()`)
- Lines 38–54 (`debouncedSync` — moves into manager)
- Lines 758–793 (`rehydrateActiveSandboxes` — becomes `rehydrate()`)

Also read `packages/api/src/sandbox/mutex.ts` in full.

- [ ] **Step 2: Create manager.ts with types and constructor**

```typescript
// packages/api/src/sandbox/manager.ts

import { eq, and, inArray, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import type { FastifyInstance } from 'fastify';
import type { SandboxProvider, Sandbox, CreateSandboxOpts } from './provider.js';
import { touchActivity, addConnection, removeConnection, removeActivity, onSandboxIdle } from './health.js';
import { syncManifestToDb } from './sync.js';
import { minioClient } from '../services/minio.js';
import { emitWorkspaceTeardown } from '../workspace/workspace-ws.js';
import { logger } from '../logger.js';
import { config } from '../config.js';
import { sandboxSessions, projects } from '../db/schema.js';

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

export class SandboxManager {
  private provider!: SandboxProvider;
  private providerPromise: Promise<SandboxProvider> | null = null;
  private db: any; // Drizzle instance
  private redis: any; // ioredis instance
  private fastify: FastifyInstance;

  // Mutex: per-project promise chains
  private mutexMap = new Map<string, Promise<unknown>>();

  // Health monitoring
  private healthTimer: ReturnType<typeof setInterval> | null = null;
  private gcTimer: ReturnType<typeof setInterval> | null = null;
  private healthFailures = new Map<string, { count: number; lastCheck: number; skipUntil: number }>();

  // Debounced manifest sync
  private syncTimers = new Map<string, ReturnType<typeof setTimeout>>();

  // Shutdown flag
  shuttingDown = false;

  constructor(fastify: FastifyInstance, db: any, redis: any) {
    this.fastify = fastify;
    this.db = db;
    this.redis = redis;
  }

  // --- Provider loading (same lazy singleton pattern as current routes.ts) ---

  async getProvider(): Promise<SandboxProvider> {
    if (!this.providerPromise) {
      this.providerPromise = (async () => {
        if (config.sandbox.provider === 'railway') {
          const { RailwaySandboxProvider } = await import('./railway.js');
          return new RailwaySandboxProvider();
        }
        const { DockerSandboxProvider } = await import('./docker.js');
        return new DockerSandboxProvider();
      })();
    }
    return this.providerPromise;
  }

  // --- Per-project mutex (moved from mutex.ts) ---

  async withMutex<T>(projectId: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.mutexMap.get(projectId) ?? Promise.resolve();
    const next = prev.then(fn, fn);
    this.mutexMap.set(projectId, next);
    try {
      return await next;
    } finally {
      if (this.mutexMap.get(projectId) === next) {
        this.mutexMap.delete(projectId);
      }
    }
  }

  // --- Debounced manifest sync (moved from routes.ts) ---

  debouncedSync(projectId: string): void {
    const existing = this.syncTimers.get(projectId);
    if (existing) clearTimeout(existing);
    this.syncTimers.set(projectId, setTimeout(async () => {
      this.syncTimers.delete(projectId);
      try {
        const session = await this.getActiveSession(projectId);
        if (!session) return;
        const url = session.agentUrl || (session.metadata as any)?.agentUrl;
        if (!url) return;
        const res = await fetch(`${url}/manifest`, {
          headers: { 'Authorization': `Bearer ${session.sandboxSecret}` },
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
          const manifest = await res.json();
          await syncManifestToDb(projectId, manifest);
        }
      } catch (err: any) {
        logger.warn({ err: err.message, projectId }, 'Debounced manifest sync failed');
      }
    }, 2000));
  }

  // --- Helper: get active session ---

  async getActiveSession(projectId: string) {
    return this.db.query.sandboxSessions.findFirst({
      where: and(
        eq(sandboxSessions.projectId, projectId),
        inArray(sandboxSessions.status, ['creating', 'ready']),
      ),
    });
  }
}
```

- [ ] **Step 3: Add `acquire()` method with atomic concurrent limits**

Add to the SandboxManager class:

```typescript
  async acquire(projectId: string, userId: string, opts: {
    initData?: any;
    env?: Record<string, string>;
  } = {}): Promise<AcquireResult> {
    if (this.shuttingDown) {
      throw new Error('Server is shutting down — cannot create new sandboxes');
    }

    return this.withMutex(projectId, async () => {
      const provider = await this.getProvider();
      let recovery: 'full' | 'partial' | 'lost' | undefined;

      // 1. Check for existing ready session
      const existing = await this.getActiveSession(projectId);
      if (existing && existing.status === 'ready') {
        const healthy = await provider.isReady(existing.internalUrl!);
        if (healthy) {
          touchActivity(projectId);
          return {
            sandbox: this.sessionToSandbox(existing),
            initRequired: false,
          };
        }
        // Dead container — attempt recovery
        recovery = await this.recoverStaleSession(existing, provider);
      }

      // 2. Read suspended session BEFORE the transaction (to capture backupId)
      const suspended = await this.db.query.sandboxSessions.findFirst({
        where: and(
          eq(sandboxSessions.projectId, projectId),
          eq(sandboxSessions.status, 'suspended'),
        ),
      });
      const backupId = suspended?.backupId || undefined;

      // 3. Atomic concurrent limit check (DB-level FOR UPDATE)
      let deferredSuspensions: Array<{ projectId: string }> = [];

      await this.db.transaction(async (tx: any) => {
        // Lock all active session rows to prevent concurrent creates
        const activeRows = await tx.execute(
          sql`SELECT id FROM sandbox_sessions WHERE status IN ('creating', 'ready') FOR UPDATE`
        );
        const activeCount = activeRows.rows?.length ?? activeRows.length ?? 0;

        if (activeCount >= config.sandbox.maxConcurrent) {
          throw new Error(`Concurrent sandbox limit reached (${config.sandbox.maxConcurrent})`);
        }

        // Per-user limit: check if user has other active sandboxes
        const userRows = await tx.execute(
          sql`SELECT id, project_id FROM sandbox_sessions WHERE user_id = ${userId} AND status IN ('creating', 'ready') AND project_id != ${projectId} FOR UPDATE`
        );
        deferredSuspensions = (userRows.rows ?? userRows)
          .map((r: any) => ({ projectId: r.project_id }));

        // Update existing session or insert new one
        if (suspended) {
          await tx.update(sandboxSessions)
            .set({ status: 'creating', userId, sandboxSecret: randomUUID() })
            .where(eq(sandboxSessions.id, suspended.id));
        } else {
          await tx.insert(sandboxSessions).values({
            projectId,
            userId,
            status: 'creating',
            sandboxSecret: randomUUID(),
            provider: config.sandbox.provider,
            metadata: {},
          });
        }
      });

      // Deferred: suspend user's other sandboxes after transaction committed
      for (const s of deferredSuspensions) {
        this.suspend(s.projectId, 'limit_exceeded').catch(err => {
          logger.warn({ err: err.message, projectId: s.projectId }, 'Failed to suspend other user sandbox');
        });
      }

      // 4. Create sandbox via provider
      let sandbox: Sandbox;
      try {
        sandbox = await provider.create({
          projectId,
          userId,
          backupId,
          env: opts.env,
        });
      } catch (err) {
        // Mark as suspended on creation failure
        await this.db.update(sandboxSessions)
          .set({ status: 'suspended' })
          .where(eq(sandboxSessions.projectId, projectId));
        throw err;
      }

      // 5. Check if workspace already initialized (restored from backup)
      let initRequired = false;
      const initialized = await provider.isReady(sandbox.internalUrl);

      if (!initialized && opts.initData) {
        // 6. Send init data — fail loudly if it doesn't work
        const initResponse = await fetch(`${sandbox.agentUrl}/init`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${sandbox.secret}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(opts.initData),
          signal: AbortSignal.timeout(120_000),
        });

        if (!initResponse.ok) {
          const error = await initResponse.text();
          // Clean up the container
          await provider.destroy(sandbox).catch(() => {});
          await this.db.update(sandboxSessions)
            .set({ status: 'suspended' })
            .where(eq(sandboxSessions.projectId, projectId));
          throw new Error(`Workspace initialization failed: ${error}`);
        }
        initRequired = true;
      }

      // 7. Update DB with sandbox info
      await this.db.update(sandboxSessions).set({
        status: 'ready',
        internalUrl: sandbox.internalUrl,
        agentUrl: sandbox.agentUrl,
        sandboxSecret: sandbox.secret,
        railwayServiceId: sandbox.id.startsWith('sandbox-') ? null : sandbox.id,
        railwayVolumeId: sandbox.volumeId,
        railwayVolumeInstanceId: sandbox.volumeInstanceId,
        metadata: { agentUrl: sandbox.agentUrl }, // keep backward compat
        lastActivityAt: new Date(),
      }).where(eq(sandboxSessions.projectId, projectId));

      // 8. Start activity tracking
      touchActivity(projectId);

      return { sandbox, initRequired, recovery };
    });
  }

  private async recoverStaleSession(
    session: any,
    provider: SandboxProvider,
  ): Promise<'full' | 'partial' | 'lost'> {
    let level: 'full' | 'partial' | 'lost' = 'lost';

    // Try volume backup first
    try {
      const backupId = await provider.backup({
        id: session.railwayServiceId || session.id,
        volumeId: session.railwayVolumeId || session.internalUrl,
        volumeInstanceId: session.railwayVolumeInstanceId || session.internalUrl,
        projectId: session.projectId,
      });
      await this.db.update(sandboxSessions).set({
        status: 'suspended',
        backupId,
        internalUrl: null,
        agentUrl: null,
        suspendReason: 'health_failure',
      }).where(eq(sandboxSessions.id, session.id));
      level = 'full';
    } catch {
      // Try S3 checkpoint
      try {
        const s3Key = `checkpoints/${session.projectId}/manifest.json`;
        // Use raw minioClient.statObject (checkpoints/ is not a standard prefix)
        const exists = await minioClient.statObject(config.storage.bucket, s3Key).then(() => true, () => false);
        if (exists) {
          level = 'partial';
        }
      } catch {}

      // Mark as suspended regardless
      await this.db.update(sandboxSessions).set({
        status: 'suspended',
        backupId: null,
        internalUrl: null,
        agentUrl: null,
        suspendReason: 'health_failure',
      }).where(eq(sandboxSessions.id, session.id));
    }

    // Cleanup the dead container
    try {
      await provider.destroy({
        id: session.railwayServiceId || session.id,
        volumeId: session.railwayVolumeId || '',
        projectId: session.projectId,
      });
    } catch {}

    removeActivity(session.projectId);
    return level;
  }

  private sessionToSandbox(session: any): Sandbox {
    return {
      id: session.railwayServiceId || session.id,
      projectId: session.projectId,
      volumeId: session.railwayVolumeId || '',
      volumeInstanceId: session.railwayVolumeInstanceId || '',
      internalUrl: session.internalUrl!,
      agentUrl: session.agentUrl || (session.metadata as any)?.agentUrl || '',
      secret: session.sandboxSecret,
      status: session.status,
    };
  }
```

- [ ] **Step 4: Add `suspend()` method**

```typescript
  async suspend(projectId: string, reason: SuspendReason): Promise<void> {
    return this.withMutex(projectId, async () => {
      const provider = await this.getProvider();
      const session = await this.getActiveSession(projectId);
      if (!session) return;

      // 1. Mark as suspending
      await this.db.update(sandboxSessions)
        .set({ status: 'suspending' })
        .where(eq(sandboxSessions.id, session.id));

      // 2. Durable checkpoint to S3
      await this.durableCheckpoint(projectId, session).catch(err => {
        logger.warn({ err: err.message, projectId }, 'Pre-suspend checkpoint failed');
      });

      // 3. Backup volume
      let backupId: string | null = null;
      try {
        backupId = await provider.backup({
          id: session.railwayServiceId || session.id,
          volumeId: session.railwayVolumeId || session.internalUrl,
          volumeInstanceId: session.railwayVolumeInstanceId || session.internalUrl,
          projectId,
        });
      } catch (err: any) {
        logger.warn({ err: err.message, projectId }, 'Backup failed during suspend');
      }

      // 4. Destroy container
      try {
        await provider.destroy({
          id: session.railwayServiceId || session.id,
          volumeId: session.railwayVolumeId || '',
          projectId,
        });
      } catch (err: any) {
        logger.warn({ err: err.message, projectId }, 'Destroy failed during suspend');
      }

      // 5. Update DB
      await this.db.update(sandboxSessions).set({
        status: 'suspended',
        backupId,
        internalUrl: null,
        agentUrl: null,
        railwayServiceId: null,
        railwayVolumeId: null,
        railwayVolumeInstanceId: null,
        suspendReason: reason,
        suspendedAt: new Date(),
      }).where(eq(sandboxSessions.id, session.id));

      // 6. Clear Redis state
      const keys = [
        `sandbox:tasks:${projectId}`,
        `sandbox:busy:${projectId}`,
        `sandbox:progress:${projectId}`,
        `sandbox:activity:${projectId}`,
        `sandbox:plan:${projectId}`,
      ];
      await this.redis.del(...keys).catch(() => {});

      // 7. Remove activity tracking + notify frontend
      removeActivity(projectId);
      await emitWorkspaceTeardown(projectId);

      logger.info({ projectId, reason, backupId }, 'Sandbox suspended');
    });
  }

  private async durableCheckpoint(projectId: string, session: any): Promise<void> {
    const agentUrl = session.agentUrl || (session.metadata as any)?.agentUrl;
    if (!agentUrl) return;

    try {
      const res = await fetch(`${agentUrl}/manifest`, {
        headers: { 'Authorization': `Bearer ${session.sandboxSecret}` },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return;
      const manifest = await res.json();

      // Upload to S3 via MinIO client directly (checkpoints/ is not a standard prefix)
      await minioClient.putObject(
        config.storage.bucket,
        `checkpoints/${projectId}/manifest.json`,
        Buffer.from(JSON.stringify(manifest)),
        undefined,
        { 'Content-Type': 'application/json' },
      );
    } catch (err: any) {
      logger.debug({ err: err.message, projectId }, 'Durable checkpoint failed');
    }
  }
```

- [ ] **Step 5: Add `getStatus()` and `checkpoint()` methods**

```typescript
  async getStatus(projectId: string): Promise<SandboxStatus | null> {
    const session = await this.db.query.sandboxSessions.findFirst({
      where: eq(sandboxSessions.projectId, projectId),
    });
    if (!session) return null;

    // Use API proxy URL (not internal container URL — browser can't reach internal)
    let previewUrl: string | null = null;
    if (session.status === 'ready' && session.internalUrl) {
      previewUrl = `/api/projects/${projectId}/sandbox/bundle/player-composition.cjs.js`;
    }

    // Read from Redis
    const [tasksRaw, busyRaw, planRaw] = await Promise.all([
      this.redis.get(`sandbox:tasks:${projectId}`).catch(() => null),
      this.redis.get(`sandbox:busy:${projectId}`).catch(() => null),
      this.redis.get(`sandbox:plan:${projectId}`).catch(() => null),
    ]);

    let activeTasks: unknown[] = [];
    let busy = false;
    let startedAt: number | null = null;

    if (tasksRaw) try { activeTasks = JSON.parse(tasksRaw); } catch {}
    if (busyRaw) try {
      const b = JSON.parse(busyRaw);
      busy = b.busy;
      startedAt = b.startedAt;
    } catch {}
    let plan = null;
    if (planRaw) try { plan = JSON.parse(planRaw); } catch {}

    // Fallback: poll sandbox directly if Redis empty and session ready
    if (!busy && session.status === 'ready') {
      const agentUrl = session.agentUrl || (session.metadata as any)?.agentUrl;
      if (agentUrl) {
        try {
          const sbStatus = await fetch(`${agentUrl}/status`, {
            headers: { 'Authorization': `Bearer ${session.sandboxSecret}` },
            signal: AbortSignal.timeout(3000),
          }).then(r => r.json()) as any;
          if (sbStatus.busy) {
            busy = true;
            activeTasks = sbStatus.activeTasks ?? [];
            startedAt = sbStatus.startedAt;
            plan = sbStatus.plan ?? plan;
          }
        } catch {}
      }
    }

    return {
      status: session.status,
      previewUrl,
      busy,
      activeTasks,
      plan,
      startedAt,
    };
  }

  async checkpoint(projectId: string, manifest: any): Promise<void> {
    // Upload to S3 for durability (uses raw minioClient — checkpoints/ is not a standard prefix)
    try {
      await minioClient.putObject(
        config.storage.bucket,
        `checkpoints/${projectId}/manifest.json`,
        Buffer.from(JSON.stringify(manifest)),
        undefined,
        { 'Content-Type': 'application/json' },
      );
    } catch (err: any) {
      logger.warn({ err: err.message, projectId }, 'S3 checkpoint upload failed');
    }
  }
```

- [ ] **Step 6: Add `rehydrate()` method**

```typescript
  async rehydrate(): Promise<void> {
    const provider = await this.getProvider();

    // 1. Clean up sessions stuck in transitional states
    const stuckSessions = await this.db.query.sandboxSessions.findMany({
      where: inArray(sandboxSessions.status, ['creating', 'suspending']),
    });
    for (const session of stuckSessions) {
      logger.warn({ projectId: session.projectId, status: session.status }, 'Cleaning up stuck session on boot');
      await this.db.update(sandboxSessions)
        .set({ status: 'suspended', suspendReason: 'api_shutdown' })
        .where(eq(sandboxSessions.id, session.id));
    }

    // 2. Health-check all "ready" sessions
    const readySessions = await this.db.query.sandboxSessions.findMany({
      where: eq(sandboxSessions.status, 'ready'),
    });
    for (const session of readySessions) {
      if (!session.internalUrl) {
        await this.db.update(sandboxSessions)
          .set({ status: 'suspended', suspendReason: 'health_failure' })
          .where(eq(sandboxSessions.id, session.id));
        continue;
      }

      const healthy = await provider.isReady(session.internalUrl);
      if (healthy) {
        // Re-establish activity tracking
        touchActivity(session.projectId);
        logger.info({ projectId: session.projectId }, 'Rehydrated active sandbox');
      } else {
        logger.warn({ projectId: session.projectId }, 'Sandbox unhealthy on boot, marking suspended');
        await this.recoverStaleSession(session, provider);
      }
    }
  }
```

- [ ] **Step 7: Verify it compiles**

```bash
cd packages/api && npx tsc --noEmit src/sandbox/manager.ts
```

Fix any type errors. The `storage.js` dynamic import may need the actual function names — check `packages/api/src/storage.ts` for the exact export names (`uploadObject`, `objectExists`).

- [ ] **Step 8: Commit**

```bash
git add packages/api/src/sandbox/manager.ts
git commit -m "feat(sandbox): add SandboxManager with acquire, suspend, checkpoint, rehydrate

Extracts lifecycle orchestration from routes.ts. Atomic concurrent limits
via SELECT FOR UPDATE. Stale recovery hierarchy (volume → S3 → fresh).
Durable checkpoints to S3. Init failure returns error, not 200."
```

---

## Task 5: SandboxManager — Health Loop + GC Loop + Graceful Shutdown

**Spec:** R6.1–R6.4, R7.1–R7.3, R8.1–R8.3
**Files:**
- Modify: `packages/api/src/sandbox/manager.ts`

- [ ] **Step 1: Add `startMonitoring()` and health sweep**

Add to SandboxManager:

```typescript
  startMonitoring(): void {
    // Register idle callback
    onSandboxIdle(async (projectId, reason) => {
      await this.suspend(projectId, reason as SuspendReason);
    });

    // Health sweep every 30s
    this.healthTimer = setInterval(() => {
      this.healthSweep().catch(err => {
        logger.error({ err: err.message }, 'Health sweep failed');
      });
    }, 30_000);

    // GC sweep every 5 minutes
    this.gcTimer = setInterval(() => {
      this.gcSweep().catch(err => {
        logger.error({ err: err.message }, 'GC sweep failed');
      });
    }, 5 * 60_000);

    // Rehydrate existing sessions
    this.rehydrate().catch(err => {
      logger.error({ err: err.message }, 'Rehydration failed');
    });

    logger.info('Sandbox monitoring started');
  }

  private async healthSweep(): Promise<void> {
    const provider = await this.getProvider();
    const sessions = await this.db.query.sandboxSessions.findMany({
      where: eq(sandboxSessions.status, 'ready'),
    });

    for (const session of sessions) {
      if (!session.internalUrl) continue;

      // Check skip window (exponential backoff for known-unhealthy)
      const tracking = this.healthFailures.get(session.id);
      if (tracking && Date.now() < tracking.skipUntil) continue;

      const healthy = await provider.isReady(session.internalUrl);

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
            logger.error({ err: err.message, projectId: session.projectId }, 'Auto-suspend failed');
          });
        }
      }
    }
  }
```

- [ ] **Step 2: Add GC sweep**

```typescript
  private async gcSweep(): Promise<void> {
    const provider = await this.getProvider();

    // 1. Provider-level orphan detection (if supported)
    if (provider.listContainers) {
      try {
        const containers = await provider.listContainers();
        const dbProjectIds = new Set(
          (await this.db.query.sandboxSessions.findMany({
            where: inArray(sandboxSessions.status, ['creating', 'ready']),
            columns: { projectId: true },
          })).map((s: any) => s.projectId)
        );

        for (const c of containers) {
          if (!dbProjectIds.has(c.projectId)) {
            // Grace period: don't delete containers younger than 10 minutes
            if (Date.now() - c.createdAt < 10 * 60_000) continue;
            logger.warn({ projectId: c.projectId, containerId: c.id }, 'Orphaned container found, removing');
            try {
              await provider.destroy({ id: c.id, volumeId: '', projectId: c.projectId });
            } catch (err: any) {
              logger.error({ err: err.message }, 'Failed to remove orphaned container');
            }
          }
        }
      } catch (err: any) {
        logger.warn({ err: err.message }, 'Container listing for GC failed');
      }
    }

    // 2. DB cleanup: stuck transitional states
    const now = new Date();
    const tenMinAgo = new Date(now.getTime() - 10 * 60_000);
    const fiveMinAgo = new Date(now.getTime() - 5 * 60_000);

    const stuckCreating = await this.db.query.sandboxSessions.findMany({
      where: and(
        eq(sandboxSessions.status, 'creating'),
        sql`${sandboxSessions.createdAt} < ${tenMinAgo}`,
      ),
    });
    for (const s of stuckCreating) {
      logger.warn({ projectId: s.projectId }, 'Session stuck in creating for >10min, marking suspended');
      await this.db.update(sandboxSessions)
        .set({ status: 'suspended', suspendReason: 'health_failure' })
        .where(eq(sandboxSessions.id, s.id));
    }

    const stuckSuspending = await this.db.query.sandboxSessions.findMany({
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
      } catch {}
      await this.db.update(sandboxSessions)
        .set({ status: 'suspended', suspendReason: 'health_failure' })
        .where(eq(sandboxSessions.id, s.id));
    }
  }
```

- [ ] **Step 3: Add graceful shutdown**

```typescript
  async stopMonitoring(): Promise<void> {
    this.shuttingDown = true;

    // Stop loops
    if (this.healthTimer) { clearInterval(this.healthTimer); this.healthTimer = null; }
    if (this.gcTimer) { clearInterval(this.gcTimer); this.gcTimer = null; }

    // Clear sync timers
    for (const timer of this.syncTimers.values()) clearTimeout(timer);
    this.syncTimers.clear();

    // Graceful drain: backup all active sandboxes (parallel, max 10)
    const readySessions = await this.db.query.sandboxSessions.findMany({
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
        batch.map(async (session: any) => {
          const provider = await this.getProvider();
          // Checkpoint to S3
          await this.durableCheckpoint(session.projectId, session).catch(() => {});
          // Backup volume
          let backupId: string | null = null;
          try {
            backupId = await provider.backup({
              id: session.railwayServiceId || session.id,
              volumeId: session.railwayVolumeId || session.internalUrl,
              volumeInstanceId: session.railwayVolumeInstanceId || session.internalUrl,
              projectId: session.projectId,
            });
          } catch {}
          // Mark as suspended with backupId
          await this.db.update(sandboxSessions)
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
```

- [ ] **Step 4: Verify it compiles**

```bash
cd packages/api && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/sandbox/manager.ts
git commit -m "feat(sandbox): add health monitoring loop, GC sweep, graceful shutdown

Health sweep every 30s with exponential backoff per session.
GC sweep every 5min cleans orphaned containers and stuck sessions.
Graceful shutdown checkpoints all active sandboxes to S3."
```

---

## Task 6: Rewrite routes.ts to Use SandboxManager

**Spec:** R1 (all), File Changes Summary
**Files:**
- Modify: `packages/api/src/sandbox/routes.ts`
- Modify: `packages/api/src/index.ts`

This is the integration task — routes.ts delegates to the manager and shrinks dramatically.

- [ ] **Step 1: Read current routes.ts in full**

Read `packages/api/src/sandbox/routes.ts` — all 797 lines. Map out which sections are replaced by the manager vs. which stay (proxy routes, internal callbacks).

- [ ] **Step 2: Rewrite routes.ts**

The new structure:
1. Import SandboxManager (created in Task 4-5)
2. Create/resume endpoint → `manager.acquire()`
3. Suspend endpoint → `manager.suspend()`
4. Status endpoint → `manager.getStatus()`
5. Proxy routes stay (bundle, public, manifest, ops, prompt) — these are thin wrappers around proxy.ts
6. Internal callbacks stay — these handle sandbox→API communication
7. Checkpoint endpoint now calls `manager.checkpoint()` for S3 durability
8. Remove inline lifecycle logic, `getProvider()`, `debouncedSync()`, `suspendSandbox()`, `getActiveSession()`
9. Update all `(session.metadata as any)?.agentUrl` references to use `session.agentUrl`

Key changes:

**POST /projects/:id/sandbox** — Replace the ~275-line inline block with:
```typescript
fastify.post('/projects/:id/sandbox', { preHandler: authMiddleware }, async (request, reply) => {
  const { id: projectId } = request.params as { id: string };
  const userId = request.user!.id;

  try {
    // Build init data from DB (same assembly as before — keep this logic)
    const initData = await buildInitData(projectId, fastify);

    const result = await manager.acquire(projectId, userId, {
      initData,
      env: buildSandboxEnv(),
    });

    // Return sandbox connection info
    const response: any = {
      status: result.sandbox.status,
      previewUrl: `${result.sandbox.internalUrl}/bundle/index.html`,
      agentUrl: result.sandbox.agentUrl,
    };
    if (result.recovery === 'partial') {
      response.warning = 'Your workspace was recovered from a checkpoint. Some recent changes may be lost.';
    } else if (result.recovery === 'lost') {
      response.warning = "Your previous work session couldn't be recovered. Starting fresh.";
    }
    return reply.send(response);
  } catch (err: any) {
    fastify.log.error(err, 'Sandbox acquire failed');
    return reply.status(err.message.includes('limit') ? 429 : 500).send({ error: err.message });
  }
});
```

**Helper function** — Extract init data assembly (currently lines 225-318 in routes.ts) into a standalone `buildInitData()` function that stays in routes.ts. This is HTTP-layer concern (reading DB, generating presigned URLs).

**DELETE /projects/:id/sandbox** — Replace with:
```typescript
fastify.delete('/projects/:id/sandbox', { preHandler: authMiddleware }, async (request, reply) => {
  const { id: projectId } = request.params as { id: string };
  await manager.suspend(projectId, 'user');
  return reply.send({ success: true });
});
```

**GET /projects/:id/sandbox/status** — Replace with:
```typescript
fastify.get('/projects/:id/sandbox/status', { preHandler: authMiddleware }, async (request, reply) => {
  const { id: projectId } = request.params as { id: string };
  const status = await manager.getStatus(projectId);
  if (!status) return reply.status(404).send({ error: 'No sandbox session' });
  return reply.send(status);
});
```

**Checkpoint callback** — Update to call `manager.checkpoint()`:
```typescript
fastify.post('/internal/sandbox/:projectId/checkpoint', async (request, reply) => {
  const projectId = await validateInternalCallback(request, reply);
  if (!projectId) return;
  const { manifest } = request.body as { manifest: any };
  await manager.checkpoint(projectId, manifest);
  return reply.send({ ok: true });
});
```

**Proxy routes** — Keep as-is but update session lookups to use `manager.getActiveSession()` and the new `agentUrl` column.

- [ ] **Step 3: Export `sandboxRoutes` as factory (Fastify plugin compat)**

Fastify plugins must follow `(fastify, opts, done?)` signature. Use a factory pattern:

```typescript
import { SandboxManager } from './manager.js';

export function createSandboxRoutes(manager: SandboxManager) {
  return async function sandboxRoutes(fastify: FastifyInstance) {
    // ... routes use manager instead of inline logic
  };
}
```

Remove the old `rehydrateActiveSandboxes()` export — the manager handles rehydration.

- [ ] **Step 4: Wire manager in index.ts**

Read `packages/api/src/index.ts` and update:

```typescript
// After DB and Redis initialization, before routes:
import { SandboxManager } from './sandbox/manager.js';
import { createSandboxRoutes } from './sandbox/routes.js';

const sandboxManager = new SandboxManager(fastify, db, redis);

// In route registration (replace the old fastify.register(sandboxRoutes)):
await fastify.register(createSandboxRoutes(sandboxManager), { prefix: '/api' });

// Replace rehydrateActiveSandboxes() call with:
sandboxManager.startMonitoring();

// In shutdown handler:
const shutdown = async () => {
  await sandboxManager.stopMonitoring();
  await fastify.close();
  process.exit(0);
};

// Use 30s timeout instead of current 15s
const SHUTDOWN_TIMEOUT = 30_000;
```

- [ ] **Step 5: Verify full API compiles**

```bash
cd packages/api && npx tsc --noEmit
```

Fix all type errors. This is the integration point — expect issues with import paths, function signatures, and the new schema columns.

- [ ] **Step 6: Test locally**

```bash
cd /c/Users/armaa/Documents/cllipify && pnpm dev
```

1. Open browser, create a project, upload a video
2. Click into the editor (triggers sandbox creation)
3. Verify sandbox starts (check API logs for `Sandbox monitoring started`, `Rehydrated active sandbox`)
4. Send a message to the agent — verify it works end-to-end
5. Close the browser tab — wait 30s + 10min — verify idle suspension fires
6. Reopen — verify sandbox resumes from backup

- [ ] **Step 7: Commit**

```bash
git add packages/api/src/sandbox/routes.ts packages/api/src/index.ts
git commit -m "feat(sandbox): routes delegate to SandboxManager, manager wired in index

routes.ts shrunk from ~800 to ~300 lines. All lifecycle logic in manager.
Health monitoring and GC loops start on boot. Graceful 30s shutdown
backs up all active sandboxes. Init failures return errors to frontend."
```

---

## Task 7: Atomic Workspace Init with Staging

**Spec:** R4.1–R4.3
**Files:**
- Modify: `packages/sandbox/src/workspace-init.ts`

- [ ] **Step 1: Read current workspace-init.ts**

Read `packages/sandbox/src/workspace-init.ts` in full (~269 lines). Understand the full list of files written during init.

- [ ] **Step 2: Add staging pattern**

Wrap the `initWorkspace()` function with staging logic:

```typescript
import { mkdirSync, rmSync, renameSync, readdirSync, cpSync, symlinkSync, existsSync } from 'fs';

export async function initWorkspace(payload: InitPayload): Promise<void> {
  const stagingDir = '/workspace/.staging';

  try {
    // Clean any previous failed staging
    rmSync(stagingDir, { recursive: true, force: true });
    mkdirSync(stagingDir, { recursive: true });

    // All init work writes to stagingDir instead of /workspace
    await initWorkspaceInDir(payload, stagingDir);

    // Atomic promotion: move all staging contents to workspace root
    const entries = readdirSync(stagingDir);
    for (const entry of entries) {
      const src = `${stagingDir}/${entry}`;
      const dest = `/workspace/${entry}`;
      // Remove existing destination if it exists
      rmSync(dest, { recursive: true, force: true });
      cpSync(src, dest, { recursive: true });
    }

    // Recreate symlinks (broken during copy)
    const manifestSymlink = '/workspace/public/manifest.json';
    rmSync(manifestSymlink, { force: true });
    symlinkSync('../manifest.json', manifestSymlink);

    // Clean up staging
    rmSync(stagingDir, { recursive: true, force: true });

    logger.info('Workspace initialized via staging (atomic)');
  } catch (err) {
    // Rollback: clean staging, leave workspace untouched
    rmSync(stagingDir, { recursive: true, force: true });
    throw err; // Propagate error — agent-server returns non-200
  }
}

// Rename existing initWorkspace logic to initWorkspaceInDir
// and change all /workspace references to use the passed dir parameter
async function initWorkspaceInDir(payload: InitPayload, baseDir: string): Promise<void> {
  // ... existing init logic with /workspace replaced by baseDir
}
```

The key change: extract the current body of `initWorkspace()` into `initWorkspaceInDir(payload, baseDir)`, replacing all hardcoded `/workspace` paths with `baseDir`. The outer `initWorkspace()` orchestrates staging → promotion → cleanup.

- [ ] **Step 3: Update path references**

Go through `initWorkspaceInDir` and replace all `/workspace/` references with `${baseDir}/`:
- `/workspace/public/` → `${baseDir}/public/`
- `/workspace/manifest.json` → `${baseDir}/manifest.json`
- `/workspace/docs/` → `${baseDir}/docs/`
- `/workspace/src/` → `${baseDir}/src/`
- etc.

Keep paths that reference installed dependencies (`/workspace/node_modules`) outside the staging scope — those don't move.

- [ ] **Step 4: Verify sandbox compiles**

```bash
cd packages/sandbox && npx tsc --noEmit
```

- [ ] **Step 5: Rebuild sandbox Docker image**

```bash
cd /c/Users/armaa/Documents/cllipify && docker build -t viona-sandbox:latest -f packages/sandbox/Dockerfile .
```

- [ ] **Step 6: Test init with a fresh project**

1. Start API + create a new project + upload video
2. Open editor (triggers sandbox creation + init)
3. Check sandbox logs: should see `Workspace initialized via staging (atomic)`
4. Verify the editor works (video loads, manifest renders)

- [ ] **Step 7: Commit**

```bash
git add packages/sandbox/src/workspace-init.ts
git commit -m "feat(sandbox): atomic workspace init with staging directory

Init writes to /workspace/.staging/ first. On success, promotes to
workspace root. On failure, staging is deleted and error propagates.
Symlinks recreated after promotion."
```

---

## Task 8: Durable Checkpoint Endpoint

**Spec:** R5.1–R5.4
**Files:**
- Modify: `packages/api/src/sandbox/routes.ts` (checkpoint callback)

The `manager.checkpoint()` method already uploads to S3 (implemented in Task 4). The checkpoint callback in routes.ts just needs to call it.

- [ ] **Step 1: Verify checkpoint callback uses manager.checkpoint()**

Read the checkpoint callback in routes.ts and confirm it calls `manager.checkpoint()`. This should already be done in Task 6 step 2. If not, update it now:

```typescript
fastify.post('/internal/sandbox/:projectId/checkpoint', async (request, reply) => {
  const projectId = await validateInternalCallback(request, reply);
  if (!projectId) return;
  const body = request.body as { manifest?: any };
  if (body.manifest) {
    await manager.checkpoint(projectId, body.manifest);
  }
  return reply.send({ ok: true });
});
```

- [ ] **Step 2: Verify S3 upload works**

Check that the `uploadObject` function exists in `packages/api/src/storage.ts` and accepts the right parameters. If it doesn't exist, check for alternative S3 upload methods (e.g., `putObject`, MinIO client).

- [ ] **Step 3: Test checkpoint durability**

1. Start sandbox, send a prompt, wait for checkpoint (60s)
2. Check API logs for `S3 checkpoint upload` activity
3. Verify the file exists in MinIO: `mc ls local/viona/checkpoints/{projectId}/`

- [ ] **Step 4: Commit** (if any changes were needed)

```bash
git add packages/api/src/sandbox/routes.ts
git commit -m "feat(sandbox): durable checkpoints uploaded to S3 via checkpoint endpoint"
```

---

## Task 9: Integration Test — End-to-End Verification

**Spec:** All requirements
**Files:** No new files

- [ ] **Step 1: Build sandbox image**

```bash
cd /c/Users/armaa/Documents/cllipify && docker build -t viona-sandbox:latest -f packages/sandbox/Dockerfile .
```

- [ ] **Step 2: Start the full stack**

```bash
cd /c/Users/armaa/Documents/cllipify && pnpm dev
```

- [ ] **Step 3: Verify R1 — Manager lifecycle**

1. Open editor → sandbox creates via manager.acquire()
2. Check logs: `Sandbox monitoring started`, health sweep running every 30s
3. Close browser → wait for idle timeout → verify suspension via manager.suspend()
4. Reopen → verify resume from backup

- [ ] **Step 4: Verify R5 — Durable checkpoints**

1. Send a message, wait 60s for checkpoint
2. Check MinIO for `checkpoints/{projectId}/manifest.json`
3. Force-kill the Docker container: `docker rm -f sandbox-{projectId}`
4. Reopen editor → should recover from S3 checkpoint (partial recovery warning)

- [ ] **Step 5: Verify R9 — Docker hardening**

1. Check container has resource limits: `docker inspect sandbox-{projectId} | grep -A5 Memory`
2. Check dynamic ports: `docker port sandbox-{projectId}`
3. Check labels: `docker inspect sandbox-{projectId} --format '{{json .Config.Labels}}'`
4. Check HEALTHCHECK: `docker inspect sandbox-{projectId} --format '{{json .State.Health}}'`

- [ ] **Step 6: Verify R10 — Init failure handling**

1. Temporarily break init (e.g., point to nonexistent video key)
2. Create sandbox → should get error response, not 200
3. Container should be cleaned up (no orphan)

- [ ] **Step 7: Verify R6 — Health monitoring**

1. Start sandbox normally
2. Force-stop container without going through API: `docker stop sandbox-{projectId}`
3. Wait for health sweep (30s) → should see `Sandbox unhealthy` log
4. After 3 failures → auto-suspend with reason `health_failure`

- [ ] **Step 8: Verify R7 — GC**

1. Manually create a container with the label: `docker run -d --label viona.sandbox=true --label viona.projectId=fake --label viona.createdAt=0 alpine sleep 3600`
2. Wait for GC sweep (5 min) → orphan should be detected and removed
3. Check logs for `Orphaned container found, removing`
