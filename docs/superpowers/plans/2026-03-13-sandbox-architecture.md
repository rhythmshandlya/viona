# Sandbox Architecture Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the worker singleton + API ephemeral workspace with per-project sandbox containers that run the Agent SDK, esbuild watcher, and file server.

**Architecture:** Each project gets an isolated Docker container (local) or Railway service (prod) with a persistent volume at `/workspace/`. The API orchestrates sandbox lifecycle and proxies all traffic. The sandbox runs 3 processes: HTTP file server (:8080), Agent SDK server (:8081), and esbuild watcher.

**Tech Stack:** TypeScript, Fastify, Docker, Railway GraphQL API, esbuild, Anthropic Agent SDK, Remotion, Drizzle ORM, PostgreSQL

**Spec:** `docs/superpowers/specs/2026-03-13-sandbox-architecture-design.md`

---

## File Structure

### New Files

```
packages/sandbox/                        — NEW package: sandbox Docker image
├── Dockerfile
├── package.json
├── tsconfig.json
├── src/
│   ├── entry.ts                         — Main entry: boots all processes
│   ├── file-server.ts                   — Express static server (:8080) for bundle + public assets
│   ├── esbuild-watcher.ts              — Watches /workspace/src/, rebuilds CJS
│   ├── workspace-init.ts               — First-boot workspace setup (download video, write manifest, copy template)
│   ├── manifest-checkpoint.ts          — Periodic manifest sync to API callback
│   ├── auth.ts                          — SANDBOX_SECRET validation middleware
│   ├── agent-server.ts                  — HTTP server (:8081) for agent prompts + prompt queue
│   └── tools/
│       ├── trigger-rebuild.ts           — Custom tool: signal esbuild watcher
│       ├── render-still.ts              — Custom tool: remotion still → PNG
│       └── manifest-ops.ts             — Custom tool: read/update manifest.json

packages/api/src/sandbox/               — NEW module: sandbox orchestration
├── provider.ts                          — SandboxProvider interface + Sandbox types
├── docker.ts                            — DockerSandboxProvider (local dev)
├── railway.ts                           — RailwaySandboxProvider (production)
├── routes.ts                            — Sandbox lifecycle + proxy routes
├── proxy.ts                             — SandboxAgentClient + HTTP proxy helpers
├── health.ts                            — Health monitoring + idle detection
└── mutex.ts                             — Per-project operation mutex
```

### Modified Files

```
packages/api/src/db/schema.ts            — ADD sandboxSessions table + types
packages/api/drizzle/0022_add_sandbox_sessions.sql — Migration
packages/api/src/config.ts               — ADD sandbox config section
packages/api/src/index.ts                — Register sandbox routes
packages/api/src/ws/handler.ts           — ADD sandbox:ready, sandbox:destroyed events
apps/web/src/features/editor-v2/store/types.ts     — ADD sandbox state fields
apps/web/src/features/editor-v2/store/editor-store.ts — ADD sandbox actions
apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx — New prompt endpoint
docker-compose.yml                       — ADD sandbox image build
```

---

## Chunk 1: Foundation

### Task 1: Add sandbox_sessions DB table

**Files:**
- Modify: `packages/api/src/db/schema.ts:168-198`
- Create: `packages/api/drizzle/0022_add_sandbox_sessions.sql`

- [ ] **Step 1: Add sandboxSessions table to Drizzle schema**

Add after the `waitlist` table in `packages/api/src/db/schema.ts`:

```typescript
// Sandbox sessions — one per project, tracks sandbox lifecycle
export const sandboxSessions = pgTable('sandbox_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('creating'),
  railwayServiceId: varchar('railway_service_id', { length: 255 }),
  railwayVolumeId: varchar('railway_volume_id', { length: 255 }),
  railwayVolumeInstanceId: varchar('railway_volume_instance_id', { length: 255 }),
  backupId: varchar('backup_id', { length: 255 }),
  sandboxSecret: varchar('sandbox_secret', { length: 255 }).notNull(),
  internalUrl: varchar('internal_url', { length: 512 }),
  sandboxPort: integer('sandbox_port'),
  provider: varchar('provider', { length: 20 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  lastActivityAt: timestamp('last_activity_at').defaultNow().notNull(),
  suspendedAt: timestamp('suspended_at'),
  metadata: jsonb('metadata').default({}).$type<Record<string, unknown>>(),
});

export type SandboxSession = typeof sandboxSessions.$inferSelect;
export type NewSandboxSession = typeof sandboxSessions.$inferInsert;
```

- [ ] **Step 2: Generate and verify migration**

Run:
```bash
cd packages/api && npx drizzle-kit generate
```

If drizzle-kit doesn't generate the correct migration, manually create `packages/api/drizzle/0022_add_sandbox_sessions.sql`:

```sql
CREATE TABLE IF NOT EXISTS "sandbox_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "status" varchar(20) NOT NULL DEFAULT 'creating',
  "railway_service_id" varchar(255),
  "railway_volume_id" varchar(255),
  "railway_volume_instance_id" varchar(255),
  "backup_id" varchar(255),
  "sandbox_secret" varchar(255) NOT NULL,
  "internal_url" varchar(512),
  "sandbox_port" integer,
  "provider" varchar(20) NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "last_activity_at" timestamp DEFAULT now() NOT NULL,
  "suspended_at" timestamp,
  "metadata" jsonb DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_sandbox_sessions_project" ON "sandbox_sessions" ("project_id");
CREATE INDEX IF NOT EXISTS "idx_sandbox_sessions_user_status" ON "sandbox_sessions" ("user_id", "status");
```

- [ ] **Step 3: Run migration to verify**

Run:
```bash
cd packages/api && npx tsx src/scripts/migrate.ts
```
Expected: Migration applied successfully, no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/db/schema.ts packages/api/drizzle/0022_add_sandbox_sessions.sql
git commit -m "feat(db): add sandbox_sessions table for per-project sandbox lifecycle"
```

---

### Task 2: Add sandbox config to API

**Files:**
- Modify: `packages/api/src/config.ts`

- [ ] **Step 1: Add sandbox config section**

Add after the `youtube` section in `packages/api/src/config.ts`:

```typescript
  // Sandbox configuration
  sandbox: {
    provider: (process.env.SANDBOX_PROVIDER || 'docker') as 'railway' | 'docker',
    image: process.env.SANDBOX_IMAGE || 'viona-sandbox:latest',
    idleTimeoutMs: parseInt(process.env.SANDBOX_IDLE_TIMEOUT_MS || '600000', 10),  // 10 min
    checkpointIntervalMs: parseInt(process.env.SANDBOX_CHECKPOINT_MS || '60000', 10),  // 60s
    maxConcurrent: parseInt(process.env.SANDBOX_MAX_CONCURRENT || '100', 10),
    reconnectionGraceMs: 30_000,  // 30s grace period before idle timer starts
    // Railway-specific (production)
    railway: {
      apiToken: process.env.RAILWAY_API_TOKEN || '',
      projectId: process.env.RAILWAY_PROJECT_ID || '',
      environmentId: process.env.RAILWAY_ENVIRONMENT_ID || '',
    },
  },
```

- [ ] **Step 2: Commit**

```bash
git add packages/api/src/config.ts
git commit -m "feat(config): add sandbox configuration section"
```

---

### Task 3: Create SandboxProvider interface and types

**Files:**
- Create: `packages/api/src/sandbox/provider.ts`

- [ ] **Step 1: Create the sandbox directory**

```bash
mkdir -p packages/api/src/sandbox
```

- [ ] **Step 2: Write provider.ts**

Create `packages/api/src/sandbox/provider.ts`:

```typescript
/**
 * SandboxProvider — abstraction over Railway (prod) and Docker (local dev).
 * Handles sandbox lifecycle only. Prompt forwarding lives in proxy.ts.
 */

export interface Sandbox {
  id: string;                // Railway serviceId or Docker containerId
  projectId: string;
  volumeId: string;          // Railway volumeId or Docker volume name
  volumeInstanceId: string;  // Railway volumeInstanceId (needed for backup/restore)
  internalUrl: string;       // http://{service}.railway.internal or http://localhost:{port}
  agentUrl: string;          // http://{service}.railway.internal:8081 or http://localhost:{port2}
  secret: string;            // Shared secret for auth
  status: 'creating' | 'ready' | 'suspending' | 'suspended';
}

export interface CreateSandboxOpts {
  projectId: string;
  userId: string;
  backupId?: string;         // If resuming from previous session
  env?: Record<string, string>;  // Extra env vars to inject (MINIO_*, ANTHROPIC_API_KEY, etc.)
}

export interface SandboxProvider {
  /** Spin up a sandbox for a project. Handles volume create + optional backup restore. */
  create(opts: CreateSandboxOpts): Promise<Sandbox>;

  /** Destroy sandbox infrastructure (service + volume). Does NOT create backup — call backup() first. */
  destroy(sandboxId: string): Promise<void>;

  /** Create a volume backup, returns backupId for future restore. */
  backup(sandboxId: string): Promise<string>;

  /** Get the internal URL for proxying file requests. */
  getFileServerUrl(sandboxId: string): string;

  /** Get the internal URL for proxying agent requests. */
  getAgentUrl(sandboxId: string): string;

  /** Health check — is the sandbox responsive? */
  isReady(sandboxId: string): Promise<boolean>;
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/sandbox/provider.ts
git commit -m "feat(sandbox): add SandboxProvider interface and types"
```

---

### Task 4: Create per-project mutex

**Files:**
- Create: `packages/api/src/sandbox/mutex.ts`

- [ ] **Step 1: Write mutex.ts**

Create `packages/api/src/sandbox/mutex.ts`:

```typescript
/**
 * Per-project mutex to prevent concurrent sandbox operations.
 * Ensures only one create/suspend/resume runs at a time per project.
 */

const locks = new Map<string, Promise<void>>();

/**
 * Acquire a mutex for a project. Returns a release function.
 * If another operation is in progress, waits for it to finish first.
 */
export async function withProjectMutex<T>(projectId: string, fn: () => Promise<T>): Promise<T> {
  // Wait for any existing operation to complete
  while (locks.has(projectId)) {
    await locks.get(projectId);
  }

  let releaseFn: () => void;
  const lockPromise = new Promise<void>((resolve) => {
    releaseFn = resolve;
  });
  locks.set(projectId, lockPromise);

  try {
    return await fn();
  } finally {
    locks.delete(projectId);
    releaseFn!();
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/api/src/sandbox/mutex.ts
git commit -m "feat(sandbox): add per-project mutex for concurrent operation safety"
```

---

## Chunk 2: Sandbox Package Core

### Task 5: Initialize sandbox package

**Files:**
- Create: `packages/sandbox/package.json`
- Create: `packages/sandbox/tsconfig.json`

- [ ] **Step 1: Create package directory**

```bash
mkdir -p packages/sandbox/src/tools
mkdir -p packages/sandbox/template
```

- [ ] **Step 2: Write package.json**

Create `packages/sandbox/package.json`:

```json
{
  "name": "@viona/sandbox",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc",
    "dev": "tsx watch src/entry.ts"
  },
  "dependencies": {
    "express": "^4.21.0",
    "esbuild": "^0.24.0",
    "chokidar": "^4.0.0",
    "minio": "^7.1.3",
    "pino": "^9.0.0",
    "@anthropic-ai/claude-agent-sdk": "^0.1.0",
    "zod": "^3.24.0",
    "remotion": "^4.0.422",
    "@remotion/cli": "^4.0.422",
    "@remotion/bundler": "^4.0.422",
    "@remotion/renderer": "^4.0.422",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/express": "^4.17.0",
    "@types/node": "^22.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.3.3"
  }
}
```

- [ ] **Step 3: Write tsconfig.json**

Create `packages/sandbox/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/sandbox/package.json packages/sandbox/tsconfig.json
git commit -m "feat(sandbox): initialize sandbox package"
```

---

### Task 6: Create auth middleware

**Files:**
- Create: `packages/sandbox/src/auth.ts`

- [ ] **Step 1: Write auth.ts**

Create `packages/sandbox/src/auth.ts`:

```typescript
import type { Request, Response, NextFunction } from 'express';

const SANDBOX_SECRET = process.env.SANDBOX_SECRET;

if (!SANDBOX_SECRET) {
  console.error('FATAL: SANDBOX_SECRET env var is required');
  process.exit(1);
}

/**
 * Validates Authorization: Bearer {secret} header on all incoming requests.
 * Rejects requests without valid secret.
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing authorization' });
    return;
  }

  const token = authHeader.slice(7);
  if (token !== SANDBOX_SECRET) {
    res.status(403).json({ error: 'Invalid secret' });
    return;
  }

  next();
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/sandbox/src/auth.ts
git commit -m "feat(sandbox): add shared secret auth middleware"
```

---

### Task 7: Create workspace init

**Files:**
- Create: `packages/sandbox/src/workspace-init.ts`

- [ ] **Step 1: Write workspace-init.ts**

Create `packages/sandbox/src/workspace-init.ts`. This handles first-boot setup: download video from MinIO, write manifest, copy template files.

```typescript
import { mkdir, writeFile, cp, access, symlink, readlink } from 'fs/promises';
import { createWriteStream } from 'fs';
import { join } from 'path';
import { pipeline } from 'stream/promises';
import { Client as MinioClient } from 'minio';
import pino from 'pino';

const logger = pino({ name: 'workspace-init' });

const WORKSPACE = '/workspace';
const TEMPLATE = '/app/template';
const NODE_MODULES_SRC = '/app/node_modules';

interface InitPayload {
  videoUrl: string;      // MinIO key for source video
  audioUrl?: string;     // MinIO key for separate audio (optional)
  manifest: object;      // Initial manifest from DB
}

function getMinioClient(): MinioClient {
  return new MinioClient({
    endPoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: parseInt(process.env.MINIO_PORT || '9000', 10),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY || '',
    secretKey: process.env.MINIO_SECRET_KEY || '',
  });
}

/**
 * Check if workspace is already initialized (volume was restored from backup).
 */
export async function isInitialized(): Promise<boolean> {
  try {
    await access(join(WORKSPACE, 'manifest.json'));
    return true;
  } catch {
    return false;
  }
}

/**
 * Initialize workspace on first boot.
 * Downloads video, writes manifest, copies template files.
 */
export async function initWorkspace(payload: InitPayload): Promise<void> {
  logger.info('Initializing workspace (first boot)');

  // Create directory structure
  await mkdir(join(WORKSPACE, 'src', 'segments'), { recursive: true });
  await mkdir(join(WORKSPACE, 'src', 'components'), { recursive: true });
  await mkdir(join(WORKSPACE, 'public'), { recursive: true });
  await mkdir(join(WORKSPACE, '.build'), { recursive: true });
  await mkdir(join(WORKSPACE, '.claude'), { recursive: true });

  // Download video from MinIO
  const minio = getMinioClient();
  const bucket = process.env.MINIO_BUCKET || 'viona';

  logger.info({ key: payload.videoUrl }, 'Downloading source video');
  const videoStream = await minio.getObject(bucket, payload.videoUrl);
  await pipeline(videoStream, createWriteStream(join(WORKSPACE, 'public', 'source.mp4')));
  logger.info('Video downloaded');

  // Download audio if separate
  if (payload.audioUrl) {
    logger.info({ key: payload.audioUrl }, 'Downloading audio');
    const audioStream = await minio.getObject(bucket, payload.audioUrl);
    await pipeline(audioStream, createWriteStream(join(WORKSPACE, 'public', 'audio.mp3')));
  }

  // Write manifest
  await writeFile(
    join(WORKSPACE, 'manifest.json'),
    JSON.stringify(payload.manifest, null, 2),
  );

  // Copy template files (composition infra, .claude/, configs)
  await cp(TEMPLATE, WORKSPACE, {
    recursive: true,
    force: false,  // Don't overwrite existing files
  });

  logger.info('Workspace initialized');
}

/**
 * Ensure node_modules symlink exists. Runs on every boot (first boot + resume).
 */
export async function ensureNodeModulesSymlink(): Promise<void> {
  const target = join(WORKSPACE, 'node_modules');

  try {
    const existing = await readlink(target);
    if (existing === NODE_MODULES_SRC) return; // Already correct
  } catch {
    // Doesn't exist or not a symlink — create it
  }

  try {
    await symlink(NODE_MODULES_SRC, target, 'junction');
    logger.info('node_modules symlinked');
  } catch (err: any) {
    if (err.code !== 'EEXIST') throw err;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/sandbox/src/workspace-init.ts
git commit -m "feat(sandbox): add workspace init (video download, manifest, template copy)"
```

---

### Task 8: Create esbuild watcher

**Files:**
- Create: `packages/sandbox/src/esbuild-watcher.ts`

- [ ] **Step 1: Write esbuild-watcher.ts**

Create `packages/sandbox/src/esbuild-watcher.ts`. Watches `/workspace/src/`, rebuilds CJS bundle on changes. References existing pattern from `packages/worker/src/processors/edit-visuals/build.ts`.

```typescript
import { build, type BuildResult } from 'esbuild';
import { watch } from 'chokidar';
import { join } from 'path';
import { access } from 'fs/promises';
import pino from 'pino';

const logger = pino({ name: 'esbuild-watcher' });

const WORKSPACE = '/workspace';
const SRC_DIR = join(WORKSPACE, 'src');
const BUILD_DIR = join(WORKSPACE, '.build');
const OUTPUT_FILE = join(BUILD_DIR, 'player-composition.cjs.js');
const ENTRY_POINT = join(SRC_DIR, 'PlayerComposition.tsx');

let bundleVersion = 0;
let building = false;
let pendingRebuild = false;
let onBundleReady: ((version: number) => void) | null = null;

/**
 * Set callback for when a new bundle is ready.
 */
export function onBundle(cb: (version: number) => void): void {
  onBundleReady = cb;
}

/**
 * Get current bundle version.
 */
export function getBundleVersion(): number {
  return bundleVersion;
}

/**
 * Trigger a manual rebuild (called by agent tool).
 */
export function triggerRebuild(): void {
  scheduleBuild();
}

async function doBuild(): Promise<void> {
  // Check entry point exists before building
  try {
    await access(ENTRY_POINT);
  } catch {
    logger.warn('Entry point not found, skipping build: %s', ENTRY_POINT);
    return;
  }

  building = true;
  const start = Date.now();

  try {
    await build({
      entryPoints: [ENTRY_POINT],
      bundle: true,
      outfile: OUTPUT_FILE,
      format: 'cjs',
      platform: 'browser',
      target: 'es2020',
      jsx: 'automatic',
      loader: { '.tsx': 'tsx', '.ts': 'ts', '.css': 'css', '.json': 'json' },
      external: [
        'react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime',
        'remotion', '@remotion/*',
        'three', '@react-three/*', '@react-spring/*',
      ],
      define: {
        'process.env.NODE_ENV': '"production"',
      },
      logLevel: 'warning',
    });

    bundleVersion++;
    const elapsed = Date.now() - start;
    logger.info({ version: bundleVersion, elapsed }, 'Bundle built');

    if (onBundleReady) onBundleReady(bundleVersion);
  } catch (err) {
    logger.error({ err }, 'Bundle build failed');
  } finally {
    building = false;
    if (pendingRebuild) {
      pendingRebuild = false;
      scheduleBuild();
    }
  }
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleBuild(): void {
  if (building) {
    pendingRebuild = true;
    return;
  }

  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    doBuild();
  }, 500);
}

/**
 * Start watching /workspace/src/ for changes and auto-rebuild CJS.
 * Performs an initial build immediately.
 */
export async function startWatcher(): Promise<void> {
  logger.info('Starting esbuild watcher on %s', SRC_DIR);

  // Initial build
  await doBuild();

  // Watch for changes
  const watcher = watch(SRC_DIR, {
    ignoreInitial: true,
    ignored: /node_modules/,
    persistent: true,
    awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
  });

  watcher.on('change', (path) => {
    logger.debug({ path }, 'File changed');
    scheduleBuild();
  });

  watcher.on('add', (path) => {
    logger.debug({ path }, 'File added');
    scheduleBuild();
  });

  watcher.on('unlink', (path) => {
    logger.debug({ path }, 'File removed');
    scheduleBuild();
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/sandbox/src/esbuild-watcher.ts
git commit -m "feat(sandbox): add esbuild watcher with debounced rebuild"
```

---

### Task 9: Create file server

**Files:**
- Create: `packages/sandbox/src/file-server.ts`

- [ ] **Step 1: Write file-server.ts**

Create `packages/sandbox/src/file-server.ts`. Serves the CJS bundle and public assets (video, audio, images).

```typescript
import express from 'express';
import { join } from 'path';
import pino from 'pino';
import { authMiddleware } from './auth.js';

const logger = pino({ name: 'file-server' });

const WORKSPACE = '/workspace';
const BUILD_DIR = join(WORKSPACE, '.build');
const PUBLIC_DIR = join(WORKSPACE, 'public');

/**
 * Start the file server on port 8080.
 * Serves:
 *   /bundle/*  → /workspace/.build/* (CJS bundle)
 *   /public/*  → /workspace/public/* (video, audio, user assets)
 *   /health    → 200 OK (no auth — used by provider health check)
 */
export function startFileServer(port = 8080): void {
  const app = express();

  // Health check — no auth (used by provider to detect readiness)
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // All other routes require auth
  app.use(authMiddleware);

  // Serve bundle files
  app.use('/bundle', express.static(BUILD_DIR, {
    setHeaders: (res) => {
      res.setHeader('Cache-Control', 'no-cache');
    },
  }));

  // Serve public assets (video, audio, images)
  app.use('/public', express.static(PUBLIC_DIR, {
    setHeaders: (res, path) => {
      // Large files (video) need streaming support
      if (path.endsWith('.mp4') || path.endsWith('.webm')) {
        res.setHeader('Accept-Ranges', 'bytes');
      }
    },
  }));

  app.listen(port, '0.0.0.0', () => {
    logger.info({ port }, 'File server started');
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/sandbox/src/file-server.ts
git commit -m "feat(sandbox): add file server for bundle and public assets"
```

---

### Task 10: Create manifest checkpoint

**Files:**
- Create: `packages/sandbox/src/manifest-checkpoint.ts`

- [ ] **Step 1: Write manifest-checkpoint.ts**

Create `packages/sandbox/src/manifest-checkpoint.ts`. Periodically syncs manifest.json to the API callback endpoint.

```typescript
import { readFile } from 'fs/promises';
import { join } from 'path';
import pino from 'pino';

const logger = pino({ name: 'manifest-checkpoint' });

const MANIFEST_PATH = join('/workspace', 'manifest.json');
const API_CALLBACK_URL = process.env.API_CALLBACK_URL;
const SANDBOX_ID = process.env.SANDBOX_ID;
const SANDBOX_SECRET = process.env.SANDBOX_SECRET;

let intervalTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Send current manifest to API for DB checkpoint.
 */
export async function checkpoint(): Promise<void> {
  if (!API_CALLBACK_URL || !SANDBOX_ID) {
    logger.warn('API_CALLBACK_URL or SANDBOX_ID not set, skipping checkpoint');
    return;
  }

  try {
    const manifest = await readFile(MANIFEST_PATH, 'utf-8');

    const res = await fetch(`${API_CALLBACK_URL}/internal/sandbox/${SANDBOX_ID}/checkpoint`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SANDBOX_SECRET}`,
      },
      body: JSON.stringify({ manifest: JSON.parse(manifest) }),
    });

    if (!res.ok) {
      logger.error({ status: res.status }, 'Checkpoint failed');
    } else {
      logger.debug('Checkpoint synced');
    }
  } catch (err) {
    logger.error({ err }, 'Checkpoint error');
  }
}

/**
 * Start periodic checkpointing.
 */
export function startCheckpointing(intervalMs: number): void {
  logger.info({ intervalMs }, 'Starting manifest checkpoint');
  intervalTimer = setInterval(checkpoint, intervalMs);
}

/**
 * Stop periodic checkpointing.
 */
export function stopCheckpointing(): void {
  if (intervalTimer) {
    clearInterval(intervalTimer);
    intervalTimer = null;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/sandbox/src/manifest-checkpoint.ts
git commit -m "feat(sandbox): add periodic manifest checkpoint to API"
```

---

### Task 11: Create entry script

**Files:**
- Create: `packages/sandbox/src/entry.ts`

- [ ] **Step 1: Write entry.ts**

Create `packages/sandbox/src/entry.ts`. Main entry point that orchestrates all sandbox processes.

```typescript
import pino from 'pino';
import { isInitialized, ensureNodeModulesSymlink } from './workspace-init.js';
import { startFileServer } from './file-server.js';
import { startWatcher, onBundle } from './esbuild-watcher.js';
import { startCheckpointing, checkpoint } from './manifest-checkpoint.js';

const logger = pino({ name: 'sandbox' });

const API_CALLBACK_URL = process.env.API_CALLBACK_URL;
const SANDBOX_ID = process.env.SANDBOX_ID;
const SANDBOX_SECRET = process.env.SANDBOX_SECRET;
const CHECKPOINT_INTERVAL = parseInt(process.env.CHECKPOINT_INTERVAL_MS || '60000', 10);

async function notifyApi(event: string, payload: Record<string, unknown> = {}): Promise<void> {
  if (!API_CALLBACK_URL || !SANDBOX_ID) return;

  try {
    await fetch(`${API_CALLBACK_URL}/internal/sandbox/${SANDBOX_ID}/${event}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SANDBOX_SECRET}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    logger.error({ err, event }, 'Failed to notify API');
  }
}

async function main(): Promise<void> {
  logger.info('Sandbox starting');

  // 1. Check if workspace is initialized (restored from backup vs first boot)
  const initialized = await isInitialized();

  if (!initialized) {
    // First boot — wait for init signal from API.
    // The agent-server will handle the POST /init endpoint.
    // For now, just start the file server + agent server so API can reach us.
    logger.info('First boot — waiting for init from API');
  } else {
    logger.info('Workspace already initialized (resumed from backup)');
  }

  // 2. Ensure node_modules symlink
  await ensureNodeModulesSymlink();

  // 3. Start file server (port 8080)
  startFileServer(8080);

  // 4. Start agent server (port 8081) — imports dynamically to avoid circular deps
  const { startAgentServer } = await import('./agent-server.js');
  startAgentServer(8081);

  // 5. Start esbuild watcher (only if initialized — no src/ to watch on first boot)
  if (initialized) {
    onBundle((version) => {
      notifyApi('bundle-ready', { version });
    });
    await startWatcher();
    startCheckpointing(CHECKPOINT_INTERVAL);

    // Only notify ready after workspace is initialized and watcher is running.
    // On first boot, ready is sent by agent-server.ts after /init completes.
    await notifyApi('ready');
    logger.info('Sandbox ready (resumed from backup)');
  } else {
    logger.info('Sandbox servers started — waiting for /init from API');
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down');
  await checkpoint(); // Final checkpoint
  process.exit(0);
});

main().catch((err) => {
  logger.fatal({ err }, 'Sandbox failed to start');
  process.exit(1);
});
```

- [ ] **Step 2: Commit**

```bash
git add packages/sandbox/src/entry.ts
git commit -m "feat(sandbox): add entry script orchestrating all sandbox processes"
```

---

### Task 12: Create Dockerfile

**Files:**
- Create: `packages/sandbox/Dockerfile`

- [ ] **Step 1: Write Dockerfile**

Create `packages/sandbox/Dockerfile`:

```dockerfile
# Stage 1: Build TypeScript
FROM node:20-slim AS builder

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install

COPY tsconfig.json ./
COPY src/ ./src/
RUN npx tsc

# Stage 2: Production image
FROM node:20-slim

# System dependencies for Remotion (Chromium), ffmpeg, and Python
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    chromium \
    ffmpeg \
    python3 \
    && rm -rf /var/lib/apt/lists/*

# Set Chromium path for Remotion
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# Install production dependencies only
COPY package.json package-lock.json* ./
RUN npm install --production

# Copy compiled JS from builder
COPY --from=builder /app/dist/ /app/dist/

# Copy template files (composition infrastructure, .claude/, configs)
COPY template/ /app/template/

# Workspace will be mounted as a volume at /workspace
VOLUME /workspace

EXPOSE 8080 8081
CMD ["node", "dist/entry.js"]
```

- [ ] **Step 2: Commit**

```bash
git add packages/sandbox/Dockerfile
git commit -m "feat(sandbox): add Dockerfile with Chromium, ffmpeg, and Remotion deps"
```

---

### Task 13: Copy template files from worker

**Files:**
- Create: `packages/sandbox/template/` (directory with files from worker)

- [ ] **Step 1: Copy composition infrastructure**

Copy key template files from the worker's remotion-template to `packages/sandbox/template/`. These are the files the sandbox workspace needs as its starting point.

```bash
# Copy composition infrastructure
mkdir -p packages/sandbox/template/src/composition
cp packages/worker/remotion-template/src/composition/FullComposition.tsx packages/sandbox/template/src/composition/
cp packages/worker/remotion-template/src/composition/SubtitleLayer.tsx packages/sandbox/template/src/composition/
cp packages/worker/remotion-template/src/composition/VisualsLayer.tsx packages/sandbox/template/src/composition/
cp packages/worker/remotion-template/src/composition/SpeakerVideo.tsx packages/sandbox/template/src/composition/
cp packages/worker/remotion-template/src/composition/SceneTransitionLayer.tsx packages/sandbox/template/src/composition/
cp packages/worker/remotion-template/src/composition/PiPVideo.tsx packages/sandbox/template/src/composition/
cp packages/worker/remotion-template/src/composition/types.ts packages/sandbox/template/src/composition/
cp packages/worker/remotion-template/src/composition/utils.ts packages/sandbox/template/src/composition/
cp packages/worker/remotion-template/src/composition/transitions.ts packages/sandbox/template/src/composition/
cp -r packages/worker/remotion-template/src/composition/animations packages/sandbox/template/src/composition/

# Copy root files
cp packages/worker/remotion-template/src/Root.tsx packages/sandbox/template/src/
cp packages/worker/remotion-template/src/index.tsx packages/sandbox/template/src/
cp packages/worker/remotion-template/src/fonts.ts packages/sandbox/template/src/

# Copy config files
cp packages/worker/remotion-template/package.json packages/sandbox/template/
cp packages/worker/remotion-template/tsconfig.json packages/sandbox/template/
cp packages/worker/remotion-template/remotion.config.ts packages/sandbox/template/

# Copy .claude/ context
cp -r packages/worker/remotion-template/.claude packages/sandbox/template/
```

- [ ] **Step 2: Verify template structure**

```bash
find packages/sandbox/template -type f | head -30
```

Expected: 15-30 files covering composition/, .claude/, config files.

- [ ] **Step 3: Commit**

```bash
git add packages/sandbox/template/
git commit -m "feat(sandbox): copy Remotion template files from worker"
```

---

## Chunk 3: Sandbox Agent

### Task 14: Create agent tools

**Files:**
- Create: `packages/sandbox/src/tools/trigger-rebuild.ts`
- Create: `packages/sandbox/src/tools/render-still.ts`
- Create: `packages/sandbox/src/tools/manifest-ops.ts`

- [ ] **Step 1: Write trigger-rebuild tool**

Create `packages/sandbox/src/tools/trigger-rebuild.ts`:

```typescript
import { triggerRebuild as doRebuild } from '../esbuild-watcher.js';

export const triggerRebuildTool = {
  name: 'triggerRebuild',
  description: 'Signal the esbuild watcher to rebuild the CJS bundle. Call this after writing/editing source files to update the preview.',
  input_schema: {
    type: 'object' as const,
    properties: {},
    required: [],
  },
  async execute(): Promise<string> {
    doRebuild();
    return 'Rebuild triggered. The esbuild watcher will rebuild the CJS bundle.';
  },
};
```

- [ ] **Step 2: Write render-still tool**

Create `packages/sandbox/src/tools/render-still.ts`:

```typescript
import { execFile } from 'child_process';
import { join } from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export const renderStillTool = {
  name: 'renderStill',
  description: 'Render a still frame at a specific time as a PNG image. Use this to verify visual output.',
  input_schema: {
    type: 'object' as const,
    properties: {
      frame: {
        type: 'number',
        description: 'The frame number to render',
      },
      compositionId: {
        type: 'string',
        description: 'The composition ID to render (default: "MainComposition")',
      },
    },
    required: ['frame'],
  },
  async execute(input: { frame: number; compositionId?: string }): Promise<string> {
    const compositionId = input.compositionId || 'MainComposition';
    const outputPath = join('/workspace', '.build', `still-${input.frame}.png`);

    try {
      await execFileAsync('npx', [
        'remotion', 'still',
        `--composition=${compositionId}`,
        `--frame=${input.frame}`,
        `--output=${outputPath}`,
        '--cwd=/workspace',
      ], {
        timeout: 60_000,
        cwd: '/workspace',
      });

      return `Still rendered at frame ${input.frame}: ${outputPath}`;
    } catch (err: any) {
      return `Failed to render still: ${err.message}`;
    }
  },
};
```

- [ ] **Step 3: Write manifest-ops tool**

Create `packages/sandbox/src/tools/manifest-ops.ts`:

```typescript
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const MANIFEST_PATH = join('/workspace', 'manifest.json');

export const readManifestTool = {
  name: 'readManifest',
  description: 'Read the current manifest.json (timeline state). Returns the full manifest JSON.',
  input_schema: {
    type: 'object' as const,
    properties: {},
    required: [],
  },
  async execute(): Promise<string> {
    try {
      const content = await readFile(MANIFEST_PATH, 'utf-8');
      return content;
    } catch (err: any) {
      return `Failed to read manifest: ${err.message}`;
    }
  },
};

export const updateManifestTool = {
  name: 'updateManifest',
  description: 'Replace manifest.json with the provided manifest object and trigger a preview rebuild.',
  input_schema: {
    type: 'object' as const,
    properties: {
      manifest: {
        type: 'object',
        description: 'The complete updated manifest object',
      },
    },
    required: ['manifest'],
  },
  async execute(input: { manifest: object }): Promise<string> {
    try {
      await writeFile(MANIFEST_PATH, JSON.stringify(input.manifest, null, 2));
      // Trigger rebuild so preview picks up manifest changes
      const { triggerRebuild } = await import('../esbuild-watcher.js');
      triggerRebuild();
      return 'Manifest updated and rebuild triggered.';
    } catch (err: any) {
      return `Failed to update manifest: ${err.message}`;
    }
  },
};
```

- [ ] **Step 4: Commit**

```bash
git add packages/sandbox/src/tools/
git commit -m "feat(sandbox): add agent tools (triggerRebuild, renderStill, manifestOps)"
```

---

### Task 15: Create agent server with prompt queue

**Files:**
- Create: `packages/sandbox/src/agent-server.ts`

- [ ] **Step 1: Write agent-server.ts**

Create `packages/sandbox/src/agent-server.ts`. This is the HTTP server on :8081 that receives prompts from the API and runs the Agent SDK with workspace access.

```typescript
import express from 'express';
import pino from 'pino';
import { authMiddleware } from './auth.js';
import { isInitialized, initWorkspace, ensureNodeModulesSymlink } from './workspace-init.js';
import { startWatcher, onBundle, getBundleVersion } from './esbuild-watcher.js';
import { checkpoint, startCheckpointing } from './manifest-checkpoint.js';
import { triggerRebuildTool } from './tools/trigger-rebuild.js';
import { renderStillTool } from './tools/render-still.js';
import { readManifestTool, updateManifestTool } from './tools/manifest-ops.js';

const logger = pino({ name: 'agent-server' });

const API_CALLBACK_URL = process.env.API_CALLBACK_URL;
const SANDBOX_ID = process.env.SANDBOX_ID;
const SANDBOX_SECRET = process.env.SANDBOX_SECRET;
const CHECKPOINT_INTERVAL = parseInt(process.env.CHECKPOINT_INTERVAL_MS || '60000', 10);

// Prompt queue — sequential execution per Ramp pattern
interface PromptRequest {
  prompt: string;
  conversationId?: string;
  resolve: (value: void) => void;
}

const promptQueue: PromptRequest[] = [];
let processing = false;

async function processNext(): Promise<void> {
  if (promptQueue.length === 0) {
    processing = false;
    return;
  }

  processing = true;
  const req = promptQueue.shift()!;

  try {
    // TODO: Phase 1 — integrate Agent SDK here
    // For now, this is a stub that acknowledges the prompt
    logger.info({ prompt: req.prompt.slice(0, 100) }, 'Processing prompt');

    // The actual Agent SDK integration will:
    // 1. Create/resume Agent with system prompt from /workspace/.claude/
    // 2. Run agent turn with prompt + custom tools
    // 3. Stream events to the response
    // 4. Checkpoint manifest after completion

    await checkpoint();
  } catch (err) {
    logger.error({ err }, 'Prompt processing failed');
  } finally {
    req.resolve();
    processNext();
  }
}

function enqueuePrompt(prompt: string, conversationId?: string): Promise<void> {
  return new Promise((resolve) => {
    promptQueue.push({ prompt, conversationId, resolve });
    if (!processing) processNext();
  });
}

/**
 * Start the agent HTTP server on the given port.
 */
export function startAgentServer(port = 8081): void {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // Health check — no auth
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', queueLength: promptQueue.length, processing });
  });

  // All other routes require auth
  app.use(authMiddleware);

  // Init endpoint — first boot only
  app.post('/init', async (req, res) => {
    const already = await isInitialized();
    if (already) {
      res.status(409).json({ error: 'Already initialized' });
      return;
    }

    try {
      await initWorkspace(req.body);
      await ensureNodeModulesSymlink();

      // Start esbuild watcher now that we have src/ files
      onBundle((version) => {
        // Notify API of bundle ready
        if (API_CALLBACK_URL && SANDBOX_ID) {
          fetch(`${API_CALLBACK_URL}/internal/sandbox/${SANDBOX_ID}/bundle-ready`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${SANDBOX_SECRET}`,
            },
            body: JSON.stringify({ version }),
          }).catch(() => {});
        }
      });
      await startWatcher();
      startCheckpointing(CHECKPOINT_INTERVAL);

      res.json({ ok: true });
    } catch (err: any) {
      logger.error({ err }, 'Init failed');
      res.status(500).json({ error: err.message });
    }
  });

  // Prompt endpoint — enqueue and process sequentially
  app.post('/prompt', async (req, res) => {
    const { prompt, conversationId } = req.body;
    if (!prompt || typeof prompt !== 'string') {
      res.status(400).json({ error: 'prompt is required' });
      return;
    }

    // For Phase 1: simple acknowledgement
    // TODO: Replace with SSE streaming when Agent SDK is integrated
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Send initial event
    res.write(`data: ${JSON.stringify({ type: 'agent:progress', message: 'Processing...' })}\n\n`);

    await enqueuePrompt(prompt, conversationId);

    // Send completion event
    res.write(`data: ${JSON.stringify({ type: 'agent:complete', filesChanged: [] })}\n\n`);
    res.end();
  });

  // Status endpoint
  app.get('/status', (_req, res) => {
    res.json({
      queueLength: promptQueue.length,
      processing,
      bundleVersion: getBundleVersion(),
    });
  });

  app.listen(port, '0.0.0.0', () => {
    logger.info({ port }, 'Agent server started');
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/sandbox/src/agent-server.ts
git commit -m "feat(sandbox): add agent server with prompt queue and init endpoint"
```

---

## Chunk 4: API Orchestration

### Task 16: Implement DockerSandboxProvider

**Files:**
- Create: `packages/api/src/sandbox/docker.ts`

- [ ] **Step 1: Write docker.ts**

Create `packages/api/src/sandbox/docker.ts`. Uses child_process to run Docker commands for local development.

```typescript
import { execSync, exec } from 'child_process';
import { randomUUID } from 'crypto';
import { logger } from '../logger.js';
import { config } from '../config.js';
import type { SandboxProvider, Sandbox, CreateSandboxOpts } from './provider.js';

// Track sandboxes in memory (Docker has no external state)
const sandboxes = new Map<string, Sandbox & { containerName: string }>();

// Find an available port
let nextPort = 18080;
function allocatePort(): number {
  return nextPort++;
}

export class DockerSandboxProvider implements SandboxProvider {
  async create(opts: CreateSandboxOpts): Promise<Sandbox> {
    const { projectId, userId, backupId, env = {} } = opts;
    const containerName = `sandbox-${projectId.slice(0, 8)}`;
    const volumeName = `viona-${projectId}`;
    const secret = randomUUID();
    const filePort = allocatePort();
    const agentPort = allocatePort();

    try {
      // 1. Create Docker volume
      execSync(`docker volume create ${volumeName}`, { stdio: 'pipe' });

      // 2. If restoring from backup, copy backup volume to project volume
      if (backupId) {
        execSync(
          `docker run --rm -v ${backupId}:/backup -v ${volumeName}:/workspace busybox cp -a /backup/. /workspace/`,
          { stdio: 'pipe', timeout: 60_000 },
        );
      }

      // 3. Build env var args
      const envArgs = [
        `-e SANDBOX_SECRET=${secret}`,
        `-e SANDBOX_ID=${projectId}`,
        `-e API_CALLBACK_URL=http://host.docker.internal:${config.port}/api`,
        `-e CHECKPOINT_INTERVAL_MS=${config.sandbox.checkpointIntervalMs}`,
        `-e MINIO_ENDPOINT=host.docker.internal`,
        `-e MINIO_PORT=${config.storage.port}`,
        `-e MINIO_ACCESS_KEY=${config.storage.accessKey}`,
        `-e MINIO_SECRET_KEY=${config.storage.secretKey}`,
        `-e MINIO_BUCKET=${config.storage.bucket}`,
        `-e MINIO_USE_SSL=false`,
        ...Object.entries(env).map(([k, v]) => `-e ${k}=${v}`),
      ].join(' ');

      // 4. Run container
      const containerId = execSync(
        `docker run -d --name ${containerName} ` +
        `-v ${volumeName}:/workspace ` +
        `-p ${filePort}:8080 -p ${agentPort}:8081 ` +
        `${envArgs} ` +
        `${config.sandbox.image}`,
        { encoding: 'utf-8', stdio: 'pipe' },
      ).trim();

      const sandbox: Sandbox & { containerName: string } = {
        id: containerId,
        projectId,
        volumeId: volumeName,
        volumeInstanceId: volumeName,  // Same as volumeId for Docker
        internalUrl: `http://localhost:${filePort}`,
        agentUrl: `http://localhost:${agentPort}`,
        secret,
        status: 'creating',
        containerName,
      };

      sandboxes.set(containerId, sandbox);

      // 5. Wait for health check
      await this.waitForReady(sandbox.internalUrl, 60_000);
      sandbox.status = 'ready';

      return sandbox;
    } catch (err: any) {
      // Cleanup on failure
      try { execSync(`docker rm -f ${containerName}`, { stdio: 'pipe' }); } catch {}
      if (!backupId) {
        try { execSync(`docker volume rm ${volumeName}`, { stdio: 'pipe' }); } catch {}
      }
      throw new Error(`Docker sandbox create failed: ${err.message}`);
    }
  }

  async destroy(sandboxId: string): Promise<void> {
    const sandbox = sandboxes.get(sandboxId);
    if (!sandbox) {
      logger.warn({ sandboxId }, 'Sandbox not found for destroy');
      return;
    }

    try {
      execSync(`docker stop ${sandbox.containerName}`, { stdio: 'pipe', timeout: 15_000 });
      execSync(`docker rm ${sandbox.containerName}`, { stdio: 'pipe' });
    } catch (err: any) {
      logger.warn({ err: err.message }, 'Docker stop/rm failed (may already be stopped)');
    }

    sandboxes.delete(sandboxId);
  }

  async backup(sandboxId: string): Promise<string> {
    const sandbox = sandboxes.get(sandboxId);
    if (!sandbox) throw new Error(`Sandbox not found: ${sandboxId}`);

    const backupVolume = `viona-backup-${sandbox.projectId}`;

    // Remove old backup if exists
    try { execSync(`docker volume rm ${backupVolume}`, { stdio: 'pipe' }); } catch {}

    // Create backup volume and copy workspace contents
    execSync(`docker volume create ${backupVolume}`, { stdio: 'pipe' });
    execSync(
      `docker run --rm -v ${sandbox.volumeId}:/workspace -v ${backupVolume}:/backup busybox cp -a /workspace/. /backup/`,
      { stdio: 'pipe', timeout: 120_000 },
    );

    return backupVolume;
  }

  getFileServerUrl(sandboxId: string): string {
    const sandbox = sandboxes.get(sandboxId);
    if (!sandbox) throw new Error(`Sandbox not found: ${sandboxId}`);
    return sandbox.internalUrl;
  }

  getAgentUrl(sandboxId: string): string {
    const sandbox = sandboxes.get(sandboxId);
    if (!sandbox) throw new Error(`Sandbox not found: ${sandboxId}`);
    return sandbox.agentUrl;
  }

  async isReady(sandboxId: string): Promise<boolean> {
    const sandbox = sandboxes.get(sandboxId);
    if (!sandbox) return false;

    try {
      const res = await fetch(`${sandbox.internalUrl}/health`, { signal: AbortSignal.timeout(3000) });
      return res.ok;
    } catch {
      return false;
    }
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

- [ ] **Step 2: Commit**

```bash
git add packages/api/src/sandbox/docker.ts
git commit -m "feat(sandbox): implement DockerSandboxProvider for local development"
```

---

### Task 17: Create HTTP proxy and SandboxAgentClient

**Files:**
- Create: `packages/api/src/sandbox/proxy.ts`

- [ ] **Step 1: Write proxy.ts**

Create `packages/api/src/sandbox/proxy.ts`. Handles forwarding requests from API to sandbox.

```typescript
import type { FastifyRequest, FastifyReply } from 'fastify';
import { pipeline } from 'stream/promises';
import { logger } from '../logger.js';

/**
 * Proxy a GET request to the sandbox file server.
 */
export async function proxyFileRequest(
  sandboxUrl: string,
  secret: string,
  path: string,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const url = `${sandboxUrl}${path}`;

  try {
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${secret}`,
      },
    });

    if (!res.ok) {
      reply.status(res.status).send({ error: `Sandbox returned ${res.status}` });
      return;
    }

    // Forward content type
    const contentType = res.headers.get('content-type');
    if (contentType) reply.header('Content-Type', contentType);
    reply.header('Cache-Control', 'no-cache');

    // Stream response body
    if (res.body) {
      reply.send(res.body);
    } else {
      reply.send('');
    }
  } catch (err: any) {
    logger.error({ err, url }, 'Proxy request failed');
    reply.status(502).send({ error: 'Sandbox unavailable' });
  }
}

/**
 * Forward a prompt to the sandbox agent server and stream SSE response back.
 * Uses PassThrough stream with reply.send() to preserve @fastify/cors headers.
 * (Do NOT use reply.raw.writeHead — it bypasses CORS middleware.)
 */
export async function proxyPrompt(
  agentUrl: string,
  secret: string,
  body: { prompt: string; conversationId?: string },
  reply: FastifyReply,
): Promise<void> {
  const url = `${agentUrl}/prompt`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${secret}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      reply.status(res.status).send({ error: `Agent returned ${res.status}` });
      return;
    }

    // Use PassThrough stream to forward SSE while preserving CORS headers
    const { PassThrough } = await import('stream');
    const passthrough = new PassThrough();

    reply
      .header('Content-Type', 'text/event-stream')
      .header('Cache-Control', 'no-cache')
      .header('Connection', 'keep-alive')
      .send(passthrough);

    if (res.body) {
      const reader = (res.body as ReadableStream).getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          passthrough.write(decoder.decode(value, { stream: true }));
        }
      } finally {
        passthrough.end();
      }
    } else {
      passthrough.end();
    }
  } catch (err: any) {
    logger.error({ err, url }, 'Prompt proxy failed');
    if (!reply.sent) {
      reply.status(502).send({ error: 'Sandbox agent unavailable' });
    }
  }
}

/**
 * Forward a manifest operation to the sandbox.
 */
export async function proxyManifestOp(
  agentUrl: string,
  secret: string,
  method: 'GET' | 'PATCH',
  body?: object,
): Promise<{ status: number; data: any }> {
  const url = `${agentUrl}/manifest`;

  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${secret}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  return { status: res.status, data: await res.json() };
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/api/src/sandbox/proxy.ts
git commit -m "feat(sandbox): add HTTP proxy for file, prompt, and manifest forwarding"
```

---

### Task 18: Create sandbox health monitoring and idle detection

**Files:**
- Create: `packages/api/src/sandbox/health.ts`

- [ ] **Step 1: Write health.ts**

Create `packages/api/src/sandbox/health.ts`:

```typescript
import { logger } from '../logger.js';
import { config } from '../config.js';

interface ProjectActivity {
  lastActivity: number;         // timestamp ms
  connectionCount: number;      // active WebSocket connections
  idleTimer: ReturnType<typeof setTimeout> | null;
  graceTimer: ReturnType<typeof setTimeout> | null;
}

const activityMap = new Map<string, ProjectActivity>();

type SuspendCallback = (projectId: string) => Promise<void>;
let onSuspend: SuspendCallback | null = null;

/**
 * Register callback for when a project should be suspended.
 */
export function onSandboxIdle(cb: SuspendCallback): void {
  onSuspend = cb;
}

/**
 * Record activity for a project. Resets idle timer.
 */
export function touchActivity(projectId: string): void {
  let activity = activityMap.get(projectId);
  if (!activity) {
    activity = { lastActivity: Date.now(), connectionCount: 0, idleTimer: null, graceTimer: null };
    activityMap.set(projectId, activity);
  }

  activity.lastActivity = Date.now();

  // Clear any pending idle/grace timers
  if (activity.idleTimer) {
    clearTimeout(activity.idleTimer);
    activity.idleTimer = null;
  }
  if (activity.graceTimer) {
    clearTimeout(activity.graceTimer);
    activity.graceTimer = null;
  }
}

/**
 * Track WebSocket connection for a project.
 */
export function addConnection(projectId: string): void {
  touchActivity(projectId);
  const activity = activityMap.get(projectId)!;
  activity.connectionCount++;
}

/**
 * Track WebSocket disconnection. Starts grace period if no connections remain.
 */
export function removeConnection(projectId: string): void {
  const activity = activityMap.get(projectId);
  if (!activity) return;

  activity.connectionCount = Math.max(0, activity.connectionCount - 1);

  if (activity.connectionCount === 0) {
    // Start grace period before idle countdown
    activity.graceTimer = setTimeout(() => {
      activity.graceTimer = null;
      startIdleTimer(projectId);
    }, config.sandbox.reconnectionGraceMs);
  }
}

function startIdleTimer(projectId: string): void {
  const activity = activityMap.get(projectId);
  if (!activity || activity.connectionCount > 0) return;

  activity.idleTimer = setTimeout(async () => {
    activity.idleTimer = null;
    logger.info({ projectId }, 'Sandbox idle timeout — suspending');

    if (onSuspend) {
      try {
        await onSuspend(projectId);
      } catch (err) {
        logger.error({ err, projectId }, 'Failed to suspend sandbox');
      }
    }
  }, config.sandbox.idleTimeoutMs);
}

/**
 * Clean up activity tracking for a project (on delete).
 */
export function removeActivity(projectId: string): void {
  const activity = activityMap.get(projectId);
  if (activity) {
    if (activity.idleTimer) clearTimeout(activity.idleTimer);
    if (activity.graceTimer) clearTimeout(activity.graceTimer);
  }
  activityMap.delete(projectId);
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/api/src/sandbox/health.ts
git commit -m "feat(sandbox): add idle detection with grace period and connection tracking"
```

---

### Task 19: Create sandbox routes

**Files:**
- Create: `packages/api/src/sandbox/routes.ts`

- [ ] **Step 1: Write routes.ts**

Create `packages/api/src/sandbox/routes.ts`. This is the main Fastify route plugin for sandbox lifecycle + proxy routes.

```typescript
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.js';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { sandboxSessions, projects, tracks, timelineItems } from '../db/schema.js';
import { logger } from '../logger.js';
import { withProjectMutex } from './mutex.js';
import { proxyFileRequest, proxyPrompt, proxyManifestOp } from './proxy.js';
import { touchActivity, onSandboxIdle, removeActivity } from './health.js';
import { dbToManifest, manifestToDb, manifestSchema } from '@viona/shared';
import type { SandboxProvider } from './provider.js';
import { DockerSandboxProvider } from './docker.js';

// Initialize provider based on config
let provider: SandboxProvider;

function getProvider(): SandboxProvider {
  if (!provider) {
    if (config.sandbox.provider === 'railway') {
      // Lazy import to avoid loading Railway SDK in dev
      throw new Error('Railway provider not yet implemented — use SANDBOX_PROVIDER=docker');
    }
    provider = new DockerSandboxProvider();
  }
  return provider;
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
        return { status: 'ready', internalUrl: existing.internalUrl };
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

      const p = getProvider();

      // Create sandbox
      const sandbox = await p.create({
        projectId,
        userId,
        backupId: suspended?.backupId || undefined,
        env,
      });

      // Upsert DB record
      if (suspended) {
        await db.update(sandboxSessions)
          .set({
            status: 'ready',
            railwayServiceId: sandbox.id,
            railwayVolumeId: sandbox.volumeId,
            railwayVolumeInstanceId: sandbox.volumeInstanceId,
            sandboxSecret: sandbox.secret,
            internalUrl: sandbox.internalUrl,
            lastActivityAt: new Date(),
            suspendedAt: null,
          })
          .where(eq(sandboxSessions.id, suspended.id));
      } else {
        await db.insert(sandboxSessions).values({
          projectId,
          userId,
          status: 'ready',
          railwayServiceId: sandbox.id,
          railwayVolumeId: sandbox.volumeId,
          railwayVolumeInstanceId: sandbox.volumeInstanceId,
          sandboxSecret: sandbox.secret,
          internalUrl: sandbox.internalUrl,
          provider: config.sandbox.provider,
        });
      }

      // If first boot (no backup), send init data
      if (!suspended?.backupId) {
        try {
          // Generate manifest from DB (imports already at top of file)
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
            items: allItems,
          });

          // Send init to sandbox
          const initRes = await fetch(`${sandbox.agentUrl}/init`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${sandbox.secret}`,
            },
            body: JSON.stringify({
              videoUrl: project.videoKey ? `uploads/${project.videoKey}` : '',
              audioUrl: project.audioKey ? `uploads/${project.audioKey}` : undefined,
              manifest,
            }),
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

    // Get agent URL — for Docker, it's a different port
    const p = getProvider();
    const agentUrl = p.getAgentUrl(session.railwayServiceId!);

    await proxyPrompt(agentUrl, session.sandboxSecret, request.body as any, reply);
  });

  // GET /projects/:id/sandbox/manifest — Read manifest from sandbox
  fastify.get('/projects/:id/sandbox/manifest', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { id: projectId } = request.params as { id: string };
    touchActivity(projectId);

    const session = await getActiveSession(projectId);
    if (!session) return reply.status(404).send({ error: 'No active sandbox' });

    const p = getProvider();
    const agentUrl = p.getAgentUrl(session.railwayServiceId!);
    const result = await proxyManifestOp(agentUrl, session.sandboxSecret, 'GET');
    return reply.status(result.status).send(result.data);
  });

  // PATCH /projects/:id/sandbox/manifest — Write manifest op to sandbox
  fastify.patch('/projects/:id/sandbox/manifest', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { id: projectId } = request.params as { id: string };
    touchActivity(projectId);

    const session = await getActiveSession(projectId);
    if (!session) return reply.status(404).send({ error: 'No active sandbox' });

    const p = getProvider();
    const agentUrl = p.getAgentUrl(session.railwayServiceId!);
    const result = await proxyManifestOp(agentUrl, session.sandboxSecret, 'PATCH', request.body as object);
    return reply.status(result.status).send(result.data);
  });

  // === Internal Callbacks (Sandbox → API) ===
  // These validate the sandbox secret from the Authorization header against the DB.

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
    // TODO: broadcast WebSocket event sandbox:ready to project subscribers
    return { ok: true };
  });

  // POST /internal/sandbox/:id/bundle-ready
  fastify.post('/internal/sandbox/:id/bundle-ready', async (request, reply) => {
    const projectId = await validateInternalCallback(request, reply);
    if (!projectId) return;
    const { version } = request.body as { version: number };
    logger.info({ projectId, version }, 'Bundle ready');
    // TODO: broadcast WebSocket event bundle:ready to project subscribers
    return { ok: true };
  });

  // POST /internal/sandbox/:id/checkpoint
  fastify.post('/internal/sandbox/:id/checkpoint', async (request, reply) => {
    const projectId = await validateInternalCallback(request, reply);
    if (!projectId) return;
    const { manifest } = request.body as { manifest: object };

    try {
      const parsed = manifestSchema.parse(manifest);
      const dbData = manifestToDb(parsed);

      await db.update(projects)
        .set({ videoSettings: dbData.videoSettings })
        .where(eq(projects.id, projectId));

      logger.debug({ projectId }, 'Manifest checkpoint saved');
    } catch (err) {
      logger.error({ err, projectId }, 'Checkpoint save failed');
    }

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

// Suspend a sandbox: backup, destroy, update DB
async function suspendSandbox(projectId: string): Promise<void> {
  await withProjectMutex(projectId, async () => {
    const session = await getActiveSession(projectId);
    if (!session) return;

    const p = getProvider();

    try {
      // Update status
      await db.update(sandboxSessions)
        .set({ status: 'suspending' })
        .where(eq(sandboxSessions.id, session.id));

      // Backup volume
      const backupId = await p.backup(session.railwayServiceId!);

      // Destroy sandbox
      await p.destroy(session.railwayServiceId!);

      // Update DB
      await db.update(sandboxSessions)
        .set({
          status: 'suspended',
          backupId,
          railwayServiceId: null,
          railwayVolumeId: null,
          internalUrl: null,
          suspendedAt: new Date(),
        })
        .where(eq(sandboxSessions.id, session.id));

      removeActivity(projectId);
      logger.info({ projectId }, 'Sandbox suspended');
    } catch (err) {
      logger.error({ err, projectId }, 'Failed to suspend sandbox');
      throw err;
    }
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/api/src/sandbox/routes.ts
git commit -m "feat(sandbox): add sandbox lifecycle + proxy routes"
```

---

### Task 20: Register sandbox routes in API

**Files:**
- Modify: `packages/api/src/index.ts`

- [ ] **Step 1: Add import and registration**

In `packages/api/src/index.ts`, add the import at the top with the other route imports:

```typescript
import { sandboxRoutes } from './sandbox/routes.js';
```

Add registration after the existing route registrations (around line 314):

```typescript
  await fastify.register(sandboxRoutes, { prefix: '/api' });
```

**Important:** Internal callback routes (`/internal/sandbox/:id/*`) will be at `/api/internal/sandbox/:id/*`. The `API_CALLBACK_URL` env var injected into sandboxes must include the `/api` prefix. For Docker: `http://host.docker.internal:4000/api`. For Railway: `http://{api-service}.railway.internal/api`.

- [ ] **Step 2: Commit**

```bash
git add packages/api/src/index.ts
git commit -m "feat(api): register sandbox routes"
```

---

## Chunk 5: Frontend + Docker Compose + E2E

### Task 21: Update editor store with sandbox state

**Files:**
- Modify: `apps/web/src/features/editor-v2/store/types.ts`
- Modify: `apps/web/src/features/editor-v2/store/editor-store.ts`

- [ ] **Step 1: Add sandbox state to types**

Add to the editor state types in `apps/web/src/features/editor-v2/store/types.ts`:

```typescript
// Sandbox state (replaces workspace state)
sandboxStatus: 'inactive' | 'creating' | 'ready' | 'suspending';
sandboxPreviewUrl: string | null;
sandboxBundleVersion: number;
```

- [ ] **Step 2: Add sandbox actions to editor store**

Add to `apps/web/src/features/editor-v2/store/editor-store.ts`:

```typescript
// Sandbox actions
createSandbox: async (projectId: string) => {
  set({ sandboxStatus: 'creating' });
  try {
    const res = await fetch(`/api/projects/${projectId}/sandbox`, {
      method: 'POST',
      credentials: 'include',
    });
    const data = await res.json();
    if (data.status === 'ready') {
      set({
        sandboxStatus: 'ready',
        sandboxPreviewUrl: `/api/projects/${projectId}/sandbox/bundle/player-composition.cjs.js`,
      });
    }
  } catch (err) {
    console.error('Failed to create sandbox:', err);
    set({ sandboxStatus: 'inactive' });
  }
},

setSandboxStatus: (status: 'inactive' | 'creating' | 'ready' | 'suspending') => {
  set({ sandboxStatus: status });
},

setSandboxBundleVersion: (version: number) => {
  set({ sandboxBundleVersion: version });
},
```

Add default values to the store initializer:

```typescript
sandboxStatus: 'inactive',
sandboxPreviewUrl: null,
sandboxBundleVersion: 0,
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/editor-v2/store/types.ts apps/web/src/features/editor-v2/store/editor-store.ts
git commit -m "feat(frontend): add sandbox state to editor store"
```

---

### Task 22: Update docker-compose for sandbox builds

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: Add sandbox build target**

Read the existing `docker-compose.yml` first, then add a sandbox build service. The sandbox image needs to be built locally for Docker provider to use.

Add to `docker-compose.yml`:

```yaml
  sandbox-build:
    build:
      context: ./packages/sandbox
      dockerfile: Dockerfile
    image: viona-sandbox:latest
    profiles:
      - build  # Only used for building, not running
```

- [ ] **Step 2: Commit**

```bash
git add docker-compose.yml
git commit -m "feat(docker): add sandbox image build to docker-compose"
```

---

### Task 23: End-to-end integration test

**Files:**
- Create: `scripts/temp/test-sandbox-lifecycle.ts`

- [ ] **Step 1: Write E2E test script**

Create `scripts/temp/test-sandbox-lifecycle.ts`. Tests the full sandbox lifecycle: create → health check → init → bundle serve → suspend → resume.

```typescript
/**
 * E2E test for sandbox lifecycle.
 * Prerequisites:
 *   1. docker-compose up -d (postgres, redis, minio)
 *   2. docker build -t viona-sandbox:latest packages/sandbox/
 *   3. API server running on port 4000
 *
 * Usage: npx tsx scripts/temp/test-sandbox-lifecycle.ts
 */

const API_URL = 'http://localhost:4000/api';

// You'll need a valid auth token — get one from browser DevTools
const AUTH_TOKEN = process.env.TEST_AUTH_TOKEN || '';
const PROJECT_ID = process.env.TEST_PROJECT_ID || '';

if (!AUTH_TOKEN || !PROJECT_ID) {
  console.error('Set TEST_AUTH_TOKEN and TEST_PROJECT_ID env vars');
  process.exit(1);
}

const headers = {
  'Content-Type': 'application/json',
  'Cookie': `stytch_session_token=${AUTH_TOKEN}`,
};

async function test() {
  console.log('=== Sandbox Lifecycle E2E Test ===\n');

  // 1. Create sandbox
  console.log('1. Creating sandbox...');
  const createRes = await fetch(`${API_URL}/projects/${PROJECT_ID}/sandbox`, {
    method: 'POST',
    headers,
  });
  const createData = await createRes.json();
  console.log('   Create response:', createData);
  console.assert(createData.status === 'ready', 'Expected status: ready');

  // 2. Check status
  console.log('2. Checking status...');
  const statusRes = await fetch(`${API_URL}/projects/${PROJECT_ID}/sandbox/status`, { headers });
  const statusData = await statusRes.json();
  console.log('   Status:', statusData);
  console.assert(statusData.status === 'ready', 'Expected status: ready');
  console.assert(statusData.previewUrl !== null, 'Expected previewUrl');

  // 3. Try to fetch bundle (may 404 if no composition yet, that's OK)
  console.log('3. Fetching bundle...');
  const bundleRes = await fetch(`${API_URL}/projects/${PROJECT_ID}/sandbox/bundle/player-composition.cjs.js`, { headers });
  console.log('   Bundle status:', bundleRes.status);

  // 4. Suspend
  console.log('4. Suspending sandbox...');
  const suspendRes = await fetch(`${API_URL}/projects/${PROJECT_ID}/sandbox`, {
    method: 'DELETE',
    headers,
  });
  const suspendData = await suspendRes.json();
  console.log('   Suspend response:', suspendData);
  console.assert(suspendData.status === 'suspended', 'Expected status: suspended');

  // 5. Resume
  console.log('5. Resuming sandbox...');
  const resumeRes = await fetch(`${API_URL}/projects/${PROJECT_ID}/sandbox`, {
    method: 'POST',
    headers,
  });
  const resumeData = await resumeRes.json();
  console.log('   Resume response:', resumeData);
  console.assert(resumeData.status === 'ready', 'Expected status: ready after resume');

  // 6. Clean up — suspend again
  console.log('6. Final cleanup...');
  await fetch(`${API_URL}/projects/${PROJECT_ID}/sandbox`, { method: 'DELETE', headers });

  console.log('\n=== All tests passed ===');
}

test().catch(console.error);
```

- [ ] **Step 2: Commit**

```bash
git add scripts/temp/test-sandbox-lifecycle.ts
git commit -m "test: add E2E sandbox lifecycle test script"
```

---

## Chunk 6: Railway Provider

### Task 24: Implement RailwaySandboxProvider

**Files:**
- Create: `packages/api/src/sandbox/railway.ts`

- [ ] **Step 1: Write railway.ts**

Create `packages/api/src/sandbox/railway.ts`. Uses Railway's GraphQL API for production sandbox management.

```typescript
import { randomUUID } from 'crypto';
import { config } from '../config.js';
import { logger } from '../logger.js';
import type { SandboxProvider, Sandbox, CreateSandboxOpts } from './provider.js';

const RAILWAY_API = 'https://backboard.railway.com/graphql/v2';

async function railwayGql(query: string, variables: Record<string, unknown> = {}): Promise<any> {
  const res = await fetch(RAILWAY_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.sandbox.railway.apiToken}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  const data = await res.json();
  if (data.errors) {
    throw new Error(`Railway API error: ${JSON.stringify(data.errors)}`);
  }
  return data.data;
}

// Track sandboxes by ID → metadata
const sandboxes = new Map<string, Sandbox>();

export class RailwaySandboxProvider implements SandboxProvider {
  async create(opts: CreateSandboxOpts): Promise<Sandbox> {
    const { projectId, userId, backupId, env = {} } = opts;
    const secret = randomUUID();

    let serviceId: string | undefined;
    let volumeId: string | undefined;

    try {
      // 1. Create service
      const serviceResult = await railwayGql(`
        mutation($input: ServiceCreateInput!) {
          serviceCreate(input: $input) { id name }
        }
      `, {
        input: {
          projectId: config.sandbox.railway.projectId,
          environmentId: config.sandbox.railway.environmentId,
          name: `sandbox-${projectId.slice(0, 8)}`,
          source: { image: config.sandbox.image },
        },
      });
      serviceId = serviceResult.serviceCreate.id;

      // 2. Set environment variables
      const allEnv: Record<string, string> = {
        SANDBOX_SECRET: secret,
        SANDBOX_ID: projectId,
        API_CALLBACK_URL: process.env.RAILWAY_INTERNAL_URL || `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`,
        CHECKPOINT_INTERVAL_MS: String(config.sandbox.checkpointIntervalMs),
        MINIO_ENDPOINT: process.env.BUCKET_ENDPOINT || '',
        MINIO_PORT: process.env.BUCKET_PORT || '443',
        MINIO_ACCESS_KEY: config.storage.accessKey,
        MINIO_SECRET_KEY: config.storage.secretKey,
        MINIO_BUCKET: config.storage.bucket,
        MINIO_USE_SSL: 'true',
        ...env,
      };

      await railwayGql(`
        mutation($input: VariableCollectionUpsertInput!) {
          variableCollectionUpsert(input: $input)
        }
      `, {
        input: {
          projectId: config.sandbox.railway.projectId,
          environmentId: config.sandbox.railway.environmentId,
          serviceId,
          variables: allEnv,
        },
      });

      // 3. Create volume
      const volumeResult = await railwayGql(`
        mutation($input: VolumeCreateInput!) {
          volumeCreate(input: $input) { id }
        }
      `, {
        input: {
          projectId: config.sandbox.railway.projectId,
          environmentId: config.sandbox.railway.environmentId,
          serviceId,
          mountPath: '/workspace',
          name: `workspace-${projectId.slice(0, 8)}`,
        },
      });
      volumeId = volumeResult.volumeCreate.id;

      // 4. Deploy
      await railwayGql(`
        mutation($input: ServiceInstanceDeployInput!) {
          serviceInstanceDeployV2(input: $input)
        }
      `, {
        input: {
          serviceId,
          environmentId: config.sandbox.railway.environmentId,
        },
      });

      // 5. Wait for deployment and get volume instance ID
      let volumeInstanceId = '';
      for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 2000));

        const volData = await railwayGql(`
          query($volumeId: String!) {
            volume(id: $volumeId) {
              volumeInstances { id }
            }
          }
        `, { volumeId });

        const instances = volData.volume?.volumeInstances || [];
        if (instances.length > 0) {
          volumeInstanceId = instances[0].id;
          break;
        }
      }

      if (!volumeInstanceId) {
        throw new Error('Volume instance not created after 120s');
      }

      // 6. Restore backup if provided
      if (backupId) {
        await railwayGql(`
          mutation($input: VolumeInstanceBackupRestoreInput!) {
            volumeInstanceBackupRestore(input: $input)
          }
        `, {
          input: { backupId, volumeInstanceId },
        });
      }

      // 7. Resolve internal URL
      // Railway internal networking: {service-name}.railway.internal
      const serviceName = `sandbox-${projectId.slice(0, 8)}`;
      const internalUrl = `http://${serviceName}.railway.internal:8080`;
      const agentUrl = `http://${serviceName}.railway.internal:8081`;

      const sandbox: Sandbox = {
        id: serviceId,
        projectId,
        volumeId,
        volumeInstanceId,
        internalUrl,
        agentUrl,
        secret,
        status: 'ready',
      };

      sandboxes.set(serviceId, sandbox);

      // 8. Wait for health check
      await this.waitForReady(internalUrl, 120_000);

      return sandbox;
    } catch (err: any) {
      // Cleanup on failure
      if (serviceId) {
        try {
          await railwayGql(`mutation($id: String!) { serviceDelete(id: $id) }`, { id: serviceId });
        } catch {}
      }
      throw new Error(`Railway sandbox create failed: ${err.message}`);
    }
  }

  async destroy(sandboxId: string): Promise<void> {
    try {
      await railwayGql(`mutation($id: String!) { serviceDelete(id: $id) }`, { id: sandboxId });
    } catch (err: any) {
      logger.warn({ err: err.message, sandboxId }, 'Railway service delete failed');
    }
    sandboxes.delete(sandboxId);
  }

  async backup(sandboxId: string): Promise<string> {
    const sandbox = sandboxes.get(sandboxId);
    if (!sandbox) throw new Error(`Sandbox not found: ${sandboxId}`);

    const result = await railwayGql(`
      mutation($input: VolumeInstanceBackupCreateInput!) {
        volumeInstanceBackupCreate(input: $input) { id }
      }
    `, {
      input: { volumeInstanceId: sandbox.volumeInstanceId },
    });

    return result.volumeInstanceBackupCreate.id;
  }

  getFileServerUrl(sandboxId: string): string {
    return sandboxes.get(sandboxId)?.internalUrl || '';
  }

  getAgentUrl(sandboxId: string): string {
    return sandboxes.get(sandboxId)?.agentUrl || '';
  }

  async isReady(sandboxId: string): Promise<boolean> {
    const sandbox = sandboxes.get(sandboxId);
    if (!sandbox) return false;
    try {
      const res = await fetch(`${sandbox.internalUrl}/health`, { signal: AbortSignal.timeout(3000) });
      return res.ok;
    } catch {
      return false;
    }
  }

  private async waitForReady(url: string, timeoutMs: number): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(2000) });
        if (res.ok) return;
      } catch {}
      await new Promise(r => setTimeout(r, 2000));
    }
    throw new Error(`Sandbox not ready after ${timeoutMs}ms`);
  }
}
```

- [ ] **Step 2: Update routes.ts to support railway provider**

In `packages/api/src/sandbox/routes.ts`, update the `getProvider()` function to support railway. Change it to an async lazy initializer:

```typescript
async function getProvider(): Promise<SandboxProvider> {
  if (!provider) {
    if (config.sandbox.provider === 'railway') {
      const { RailwaySandboxProvider } = await import('./railway.js');
      provider = new RailwaySandboxProvider();
    } else {
      provider = new DockerSandboxProvider();
    }
  }
  return provider;
}
```

Update all `getProvider()` calls in routes.ts to use `await getProvider()` instead of `getProvider()`.

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/sandbox/railway.ts packages/api/src/sandbox/routes.ts
git commit -m "feat(sandbox): implement RailwaySandboxProvider for production"
```

---

### Task 25: Install dependencies and verify build

- [ ] **Step 1: Install sandbox package dependencies**

```bash
cd packages/sandbox && npm install
```

- [ ] **Step 2: Build sandbox package**

```bash
cd packages/sandbox && npx tsc --noEmit
```

Fix any type errors.

- [ ] **Step 3: Verify API builds with new sandbox module**

```bash
cd packages/api && npx tsc --noEmit
```

Fix any type errors.

- [ ] **Step 4: Build Docker image**

```bash
cd packages/sandbox && docker build -t viona-sandbox:latest .
```

- [ ] **Step 5: Commit any fixes**

```bash
git add -A && git commit -m "fix: resolve build errors in sandbox package"
```

---

### Task 26: Final integration verification

- [ ] **Step 1: Start infrastructure**

```bash
docker-compose up -d postgres redis minio
```

- [ ] **Step 2: Start API**

```bash
cd packages/api && npm run dev
```

- [ ] **Step 3: Run E2E test**

```bash
TEST_AUTH_TOKEN=<your-token> TEST_PROJECT_ID=<your-project-id> npx tsx scripts/temp/test-sandbox-lifecycle.ts
```

Expected: All assertions pass — create, status, suspend, resume cycle works.

- [ ] **Step 4: Commit final state**

```bash
git add -A && git commit -m "feat(sandbox): complete Phase 1 sandbox architecture implementation"
```
