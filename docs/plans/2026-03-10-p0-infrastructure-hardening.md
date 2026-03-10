# P0: Infrastructure Hardening Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 9 critical infrastructure issues that will cause failures at 50 concurrent users — DB pool exhaustion, Redis memory leak, missing shutdown handlers, race conditions, env var validation, migration conflicts, hollow health checks, and an ownership bypass.

**Architecture:** All changes are backend-only (API + Worker packages). Each task is independent — no ordering dependencies between tasks. All changes are additive or config-only; no schema changes or data migrations needed.

**Tech Stack:** Node.js, pg (node-postgres), BullMQ, Fastify, Drizzle ORM, Zod

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `packages/api/src/db/index.ts` | Modify | Add pool config (max, idle timeout, connection timeout) |
| `packages/worker/src/db/index.ts` | Modify | Add pool config (same) |
| `packages/api/src/services/queue.ts` | Modify | Add `removeOnComplete`/`removeOnFail` to all queues |
| `packages/api/src/index.ts` | Modify | Add graceful shutdown handler + real health check |
| `packages/worker/src/index.ts` | Modify | Add shutdown timeout + double-signal guard |
| `packages/api/src/config.ts` | Modify | Add Zod env var validation at import time |
| `packages/worker/src/config.ts` | Modify | Add Zod env var validation at import time |
| `packages/api/drizzle/0016_add_waitlist.sql` | Rename → `0016b_add_waitlist.sql` | Fix duplicate migration prefix |
| `packages/api/src/routes/projects.ts` | Modify | Fix ownership bypass (line 48) |
| `.github/workflows/deploy.yml` | Modify | Fix `@reelify/api` → `@viona/api` |

---

### Task 1: Configure Database Connection Pools

**Files:**
- Modify: `packages/api/src/db/index.ts`
- Modify: `packages/worker/src/db/index.ts`

**Why:** Default `pg.Pool` has `max: 10` connections, no idle timeout, no connection timeout. At 50 concurrent users with parallel queries, the pool exhausts immediately and subsequent queries hang forever.

- [ ] **Step 1: Update API pool config**

In `packages/api/src/db/index.ts`, replace the Pool constructor:

```typescript
// Before (line 6-8):
const pool = new pg.Pool({
  connectionString: config.database.url,
});

// After:
const pool = new pg.Pool({
  connectionString: config.database.url,
  max: 25,                      // 50 users × ~0.5 active queries each
  min: 2,                       // Keep 2 warm connections
  idleTimeoutMillis: 30_000,    // Close idle connections after 30s
  connectionTimeoutMillis: 10_000, // Fail fast if pool exhausted
});
```

- [ ] **Step 2: Update Worker pool config**

In `packages/worker/src/db/index.ts`, replace the Pool constructor (line 112-114):

```typescript
// Before:
const pool = new pg.Pool({
  connectionString: config.database.url,
});

// After:
const pool = new pg.Pool({
  connectionString: config.database.url,
  max: 10,                      // Workers have fewer concurrent queries
  min: 1,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});
```

- [ ] **Step 3: Verify** — Start API and Worker locally, confirm no connection errors in logs.

- [ ] **Step 4: Commit**
```bash
git add packages/api/src/db/index.ts packages/worker/src/db/index.ts
git commit -m "fix(db): configure connection pool limits to prevent exhaustion at scale"
```

---

### Task 2: Add removeOnComplete/removeOnFail to All Queues

**Files:**
- Modify: `packages/api/src/services/queue.ts`

**Why:** Without these options, every completed/failed job stays in Redis forever. At 50 users generating ~20 jobs/day, Redis memory grows ~600 jobs/day with full job payloads. Within weeks, Redis OOMs.

- [ ] **Step 1: Add default job options to each Queue constructor**

For every `new Queue(...)` call in the file, add `defaultJobOptions`. There are 13 queues. The pattern is:

```typescript
// Before (example — transcribeQueue):
export const transcribeQueue = new Queue('transcribe', { connection });

// After:
export const transcribeQueue = new Queue('transcribe', {
  connection,
  defaultJobOptions: {
    removeOnComplete: { count: 200 },  // Keep last 200 completed for debugging
    removeOnFail: { count: 500 },      // Keep last 500 failed for investigation
  },
});
```

Apply this to ALL queues:
- `transcribeQueue`
- `renderQueue`
- `enhanceAudioQueue`
- `generateVisualsQueue`
- `planVisualsQueue`
- `editVisualsQueue`
- `splitVisualSceneQueue`
- `svgAnimationQueue`
- `preloadProjectQueue` (already has removeOnComplete/removeOnFail: true — change to count-based)
- `headTrackingQueue`
- `generateReframeQueue`
- `generateCaptionStylesQueue`
- `youtubeClipQueue`
- `segmentationQueue`

For `preloadProjectQueue`, update from `removeOnComplete: true` (per-job override) to using the queue-level default instead, and remove the per-job overrides in `queuePreloadProjectJob`.

- [ ] **Step 2: Verify** — Start API, enqueue a test job, check Redis with `redis-cli KEYS bull:*` to confirm completed jobs are cleaned up.

- [ ] **Step 3: Commit**
```bash
git add packages/api/src/services/queue.ts
git commit -m "fix(queues): add removeOnComplete/removeOnFail to prevent Redis memory leak"
```

---

### Task 3: Add Graceful Shutdown to API Server

**Files:**
- Modify: `packages/api/src/index.ts`

**Why:** Without SIGTERM handling, every deploy drops active SSE connections and in-flight requests. Users see random failures during deploys.

- [ ] **Step 1: Add shutdown handler after `fastify.listen()`**

At the end of the `main()` function, after the `fastify.listen()` call (after line 293), add:

```typescript
  // Graceful shutdown — close server, finish in-flight requests
  const shutdown = async (signal: string) => {
    fastify.log.info({ signal }, 'Received shutdown signal, closing server...');
    try {
      await fastify.close();
      fastify.log.info('Server closed gracefully');
    } catch (err) {
      fastify.log.error({ err }, 'Error during shutdown');
    }
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
```

- [ ] **Step 2: Commit**
```bash
git add packages/api/src/index.ts
git commit -m "fix(api): add graceful shutdown handler for clean deploys"
```

---

### Task 4: Add Shutdown Timeout + Double-Signal Guard to Worker

**Files:**
- Modify: `packages/worker/src/index.ts`

**Why:** Two issues: (1) `Promise.allSettled(close())` can hang forever if a worker is stuck in a long ffmpeg call — Kubernetes kills the pod uncleanly. (2) SIGTERM + SIGINT can both fire, causing a double-shutdown race.

- [ ] **Step 1: Replace the existing shutdown function (lines 373-381)**

```typescript
  // Before:
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Received shutdown signal, closing workers...');
    await Promise.allSettled(allWorkers.map(w => w.close()));
    logger.info('All workers closed');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // After:
  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) {
      logger.warn({ signal }, 'Shutdown already in progress, ignoring duplicate signal');
      return;
    }
    shuttingDown = true;

    logger.info({ signal }, 'Received shutdown signal, closing workers...');

    // Give workers 25s to finish (Kubernetes default grace period is 30s)
    const timeout = setTimeout(() => {
      logger.error('Shutdown timeout exceeded (25s), forcing exit');
      process.exit(1);
    }, 25_000);

    await Promise.allSettled(allWorkers.map(w => w.close()));
    clearTimeout(timeout);
    logger.info('All workers closed');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
```

- [ ] **Step 2: Fix lock duration race condition (line 145)**

The generate-visuals worker has `lockDuration: 90 * 60 * 1000` which equals the subprocess timeout. If the subprocess times out at exactly 90 minutes, the lock has already expired. Add a 10-minute buffer:

```typescript
// Before (line 145):
lockDuration: 90 * 60 * 1000,   // 90 min — matches subprocess timeout

// After:
lockDuration: 100 * 60 * 1000,  // 100 min — 10 min buffer above 90 min subprocess timeout
```

- [ ] **Step 3: Commit**
```bash
git add packages/worker/src/index.ts
git commit -m "fix(worker): add shutdown timeout, double-signal guard, and lock duration buffer"
```

---

### Task 5: Validate Environment Variables at Startup

**Files:**
- Modify: `packages/api/src/config.ts`
- Modify: `packages/worker/src/config.ts`

**Why:** Both packages silently fall back to dev defaults (`reelify:reelify123@localhost`) in production. If `DATABASE_URL` isn't set on Railway, the API connects to nothing and crashes on first query instead of at startup.

- [ ] **Step 1: Add Zod validation to API config**

At the top of `packages/api/src/config.ts`, add production env var validation:

```typescript
import 'dotenv/config';
import { resolve, join } from 'path';
import { z } from 'zod';

const isProduction = !!process.env.RAILWAY_ENVIRONMENT;

// In production, these vars are REQUIRED — crash fast if missing
if (isProduction) {
  const prodEnvSchema = z.object({
    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url(),
    COOKIE_SECRET: z.string().min(16),
    STYTCH_PROJECT_ID: z.string().min(1),
    STYTCH_SECRET: z.string().min(1),
  });

  const result = prodEnvSchema.safeParse(process.env);
  if (!result.success) {
    console.error('FATAL: Missing required environment variables in production:');
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }
}
```

Place this block right after the imports, before the `const isRailway = ...` line.

- [ ] **Step 2: Add Zod validation to Worker config**

At the top of `packages/worker/src/config.ts`, add:

```typescript
import 'dotenv/config';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { hostname } from 'os';
import { z } from 'zod';

const isProduction = !!process.env.RAILWAY_ENVIRONMENT;

if (isProduction) {
  const prodEnvSchema = z.object({
    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url(),
    CLAUDE_CODE_OAUTH_TOKEN: z.string().min(1),
  });

  const result = prodEnvSchema.safeParse(process.env);
  if (!result.success) {
    console.error('FATAL: Missing required environment variables in production:');
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }
}
```

- [ ] **Step 3: Verify** — Set `RAILWAY_ENVIRONMENT=production` locally without `DATABASE_URL`, run `pnpm --filter @viona/api dev`. Confirm it exits with clear error.

- [ ] **Step 4: Commit**
```bash
git add packages/api/src/config.ts packages/worker/src/config.ts
git commit -m "fix(config): validate required env vars at startup in production"
```

---

### Task 6: Fix Duplicate Migration Numbering

**Files:**
- Rename: `packages/api/drizzle/0016_add_waitlist.sql` → `packages/api/drizzle/0016b_add_waitlist.sql`

**Why:** Two files share the `0016` prefix. Migration runner sorts alphabetically, so `0016_add_sdk_session_id.sql` runs before `0016_add_waitlist.sql` — this works but is fragile. On a fresh deploy, both have already been applied (tracked by filename in `_migrations` table), so we must NOT change the `0016_add_sdk_session_id.sql` filename. Instead, rename the waitlist file.

**Important safety note:** Since the migration tracker uses filenames, we need to handle already-applied databases. The rename means new deployments will see `0016b_add_waitlist.sql` as unapplied. But the table already exists because of `CREATE TABLE IF NOT EXISTS`. So this is safe — worst case, it re-runs idempotently.

- [ ] **Step 1: Rename the file**
```bash
cd packages/api/drizzle
git mv 0016_add_waitlist.sql 0016b_add_waitlist.sql
```

- [ ] **Step 2: Verify** — Check `0016b_add_waitlist.sql` content still has `CREATE TABLE IF NOT EXISTS waitlist` (it does — idempotent).

- [ ] **Step 3: Commit**
```bash
git add packages/api/drizzle/
git commit -m "fix(migrations): rename duplicate 0016 migration to 0016b for unique ordering"
```

---

### Task 7: Add Real Health Check

**Files:**
- Modify: `packages/api/src/index.ts`

**Why:** Current health check returns `{status: 'ok'}` unconditionally. Load balancers route traffic to instances where DB or Redis are down.

- [ ] **Step 1: Replace the health endpoint (line 234)**

```typescript
  // Before:
  fastify.get('/health', async () => ({ status: 'ok' }));

  // After:
  fastify.get('/health', async (request, reply) => {
    const checks: Record<string, 'ok' | 'fail'> = {};

    // Check database
    try {
      const { db } = await import('./db/index.js');
      await db.execute(sql`SELECT 1`);
      checks.database = 'ok';
    } catch {
      checks.database = 'fail';
    }

    // Check Redis (via queue connection)
    try {
      const { default: Redis } = await import('ioredis');
      const redis = new Redis(config.redis.url, { lazyConnect: true, connectTimeout: 3000 });
      await redis.ping();
      await redis.quit();
      checks.redis = 'ok';
    } catch {
      checks.redis = 'fail';
    }

    const healthy = Object.values(checks).every(v => v === 'ok');
    return reply.code(healthy ? 200 : 503).send({
      status: healthy ? 'ok' : 'degraded',
      checks,
    });
  });
```

Also add at the top of the file with other imports:
```typescript
import { sql } from 'drizzle-orm';
```

- [ ] **Step 2: Commit**
```bash
git add packages/api/src/index.ts
git commit -m "fix(api): add real health check with DB and Redis probes"
```

---

### Task 8: Fix Ownership Bypass

**Files:**
- Modify: `packages/api/src/routes/projects.ts`

**Why:** `checkProjectOwnership` (line 46-51) returns `true` when `projectUserId` is NULL, allowing any authenticated user to access legacy projects. This is a security gap.

- [ ] **Step 1: Fix the function (line 46-51)**

```typescript
// Before:
function checkProjectOwnership(projectUserId: string | null, userId: string | undefined): boolean {
  // If project has no owner (legacy data), allow access for now
  if (!projectUserId) return true;
  return projectUserId === userId;
}

// After:
function checkProjectOwnership(projectUserId: string | null, userId: string | undefined): boolean {
  if (!userId) return false;
  // Legacy projects with no owner: deny access (admin can reassign via DB)
  if (!projectUserId) return false;
  return projectUserId === userId;
}
```

- [ ] **Step 2: Commit**
```bash
git add packages/api/src/routes/projects.ts
git commit -m "fix(auth): deny access to legacy projects with no owner instead of allowing all"
```

---

### Task 9: Fix CI/CD Package Scope

**Files:**
- Modify: `.github/workflows/deploy.yml`

**Why:** Line 41 uses `@reelify/api` but the package was renamed to `@viona/api` in Feb 2026. Deploy will fail on next push to main.

- [ ] **Step 1: Fix the reference (line 41)**

```yaml
# Before:
          railway run pnpm --filter @reelify/api db:migrate

# After:
          railway run pnpm --filter @viona/api db:migrate
```

- [ ] **Step 2: Commit**
```bash
git add .github/workflows/deploy.yml
git commit -m "fix(ci): update package scope from @reelify to @viona in deploy workflow"
```

---

## Verification Checklist

After all tasks are complete:

- [ ] `pnpm --filter @viona/api build` passes
- [ ] `pnpm --filter @viona/worker build` passes (note: this is the `worker` package, confirm filter name matches package.json)
- [ ] Start API locally → check health endpoint returns `{status: 'ok', checks: {database: 'ok', redis: 'ok'}}`
- [ ] Start Worker locally → confirm it connects and logs "Worker started, waiting for jobs..."
- [ ] Migrations directory has no duplicate prefixes: `ls packages/api/drizzle/*.sql | sort` shows unique prefixes
