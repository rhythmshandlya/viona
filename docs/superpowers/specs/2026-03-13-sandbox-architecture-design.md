# Sandbox Architecture Design — Phase 1

## Problem

The current system has two separate workspaces (worker singleton + API ephemeral) connected by S3 round-trips. This creates format mismatches, multiple failure points, no live feedback loop, and cannot scale beyond one machine. Railway volumes can't be shared between services and don't support replicas.

## Solution

Every project gets its own isolated Railway service (sandbox) with a persistent volume. The sandbox runs the Claude Agent SDK, esbuild bundler, an HTTP file server, and Remotion. The API orchestrates sandbox lifecycle via Railway's GraphQL API and proxies all traffic. Locally, Docker replaces Railway.

This follows the architecture patterns from [Anthropic's Agent SDK hosting guide](https://platform.claude.com/docs/en/agent-sdk/hosting) (Pattern 2: Long-Running Sessions) and [Ramp's background agent](https://builders.ramp.com/post/why-we-built-our-background-agent).

## Reference

- [Anthropic: Hosting the Agent SDK](https://platform.claude.com/docs/en/agent-sdk/hosting) — Pattern 2: Long-Running Sessions
- [Anthropic: Securely deploying AI agents](https://platform.claude.com/docs/en/agent-sdk/secure-deployment) — Container isolation patterns
- [Ramp: Why we built our background agent](https://builders.ramp.com/post/why-we-built-our-background-agent) — Image registry, snapshot/restore, prompt queuing
- [Railway: Background Agent template](https://railway.com/deploy/background-agent) — `serviceCreate` for ephemeral sandboxes
- [Railway: Manage Volumes API](https://docs.railway.com/integrations/api/manage-volumes) — Programmatic volume + backup management

---

## Architecture

```
Frontend (Next.js)
    ↕ WebSocket + REST (existing patterns)
API Service (Fastify, permanent Railway service)
    ↕ Railway internal network (prod) / localhost (dev)
Sandbox per project (ephemeral Railway service + volume / Docker container)
    ├── /workspace/src/            ← Agent writes Composition.tsx, segments/
    ├── /workspace/public/         ← source.mp4, audio, user assets
    ├── /workspace/manifest.json   ← Timeline state (sync layer)
    ├── /workspace/.build/         ← CJS bundle output
    ├── /workspace/.claude/        ← Agent skills, CLAUDE.md
    ├── /workspace/package.json    ← Remotion project config
    ├── /workspace/tsconfig.json   ← TypeScript config
    ├── node_modules/              ← Pre-installed in Docker image
    │
    ├── Agent SDK process          ← Handles user prompts (plan, generate, edit)
    ├── esbuild watcher            ← Rebuilds CJS on src/ changes
    ├── HTTP server (:8080)        ← Serves bundle + public assets
    └── Remotion CLI               ← Export/render on demand
```

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Sandbox provider (prod) | Railway `serviceCreate` | Stay on Railway, internal networking, GraphQL API for lifecycle |
| Sandbox provider (local) | Docker | Matches production behavior, consistent dev experience |
| Persistence | Railway volume + backup/restore | Native snapshot/restore like Ramp's Modal approach |
| Frontend ↔ sandbox communication | API as middleman (proxy) | Auth in one place, single endpoint, prompt queuing |
| Docker image strategy | Heavy pre-built (~2-3GB) | All deps baked in, near-instant boot on volume restore |
| Rendering | Inside sandbox | Workspace files already there, no transfer overhead |
| Transcription / head-tracking | Out of scope (Phase 2) | Sandbox created when user opens project, not on upload |
| Worker package | Keep as reference, don't delete | Processor code useful for reference during sandbox implementation |

---

## 1. Sandbox Lifecycle

### Create (user opens project)

```
API receives: POST /projects/:id/editor/open
  1. Check DB for existing sandbox metadata (backupId, volumeId)
  2. If returning user (backupId exists):
     a. serviceCreate (from viona-sandbox Docker image)
     b. volumeCreate (attached to new service, mountPath: /workspace)
     c. volumeInstanceBackupRestore (restore previous state)
     d. Start sandbox processes (agent, esbuild, HTTP server)
  3. If first time:
     a. serviceCreate (from viona-sandbox Docker image)
     b. volumeCreate (attached to new service, mountPath: /workspace)
     c. Sandbox init script:
        - Download video from MinIO → /workspace/public/source.mp4
        - Generate manifest from DB → /workspace/manifest.json
        - Copy template files (Root.tsx, index.ts, PlayerComposition.tsx)
        - Build initial CJS bundle
     d. Start sandbox processes
  4. Store sandbox metadata in DB (serviceId, volumeId, internalUrl)
  5. Return { sandboxUrl, previewReady: false }
  6. When sandbox HTTP server is up → WebSocket: sandbox:ready
```

### Active (user working)

```
- API proxies prompt requests to sandbox agent endpoint
- API proxies preview/bundle requests to sandbox HTTP server
- API proxies manifest ops to sandbox filesystem
- Manifest checkpoint: sandbox syncs manifest to DB every 60s via API callback
  + also triggered immediately after each agent prompt completes
- Idle detection: API tracks activity per project (not per WebSocket connection)
  + Any activity resets idle timer: WS connect, REST call, prompt submission
  + Multiple tabs: idle timer only starts when ALL connections for the project disconnect
  + Reconnection grace period: 30s after last disconnect before starting idle countdown
```

### Concurrency Safety

```
- Sandbox create/suspend/resume use an in-memory mutex per projectId
  (prevents double-create if user clicks "open" twice quickly, or suspend racing with create)
- Mutex implementation: Map<projectId, Promise> — second caller awaits first
- DB status transitions enforce valid state machine:
  creating → ready → suspending → suspended → creating (resume)
  Concurrent writes fail on status check, not silently overwrite
```

### Resource Limits

```
- Per-user: 1 active sandbox at a time (Phase 1)
  Opening a second project suspends the first
- Global: SANDBOX_MAX_CONCURRENT=100 — returns 503 when exceeded
- Railway project limits: depends on plan (Team plan supports ~100 services)
- Volume storage: ~500MB per sandbox (video + workspace), ~50GB total for 100 sandboxes
```

### Suspend (user leaves)

```
API detects idle (WebSocket disconnect + 10 min timeout):
  1. Sync manifest to DB (final checkpoint)
  2. volumeInstanceBackupCreate → save backupId to DB
  3. serviceDelete (removes service + detaches volume)
  4. volumeDelete (volume data preserved in backup)
  5. Update DB: sandbox status = 'suspended', store backupId
  6. WebSocket: sandbox:destroyed
```

### Resume (user returns)

Same as "Create → returning user" path. Volume backup restores /workspace/ exactly as it was — source files, video, build artifacts, agent conversation state. CJS bundle is already built; preview loads instantly.

### Delete (project deleted)

```
  1. If sandbox active: serviceDelete
  2. If volume exists: volumeDelete (this deletes all backups too)
  3. Clean up DB metadata
```

---

## 2. Sandbox Docker Image (`viona-sandbox`)

### Contents

Pre-built, ~2-3GB, rebuilt on deploy when dependencies or template change.

```dockerfile
FROM node:20-slim

# System deps
RUN apt-get update && apt-get install -y chromium ffmpeg python3 && rm -rf /var/lib/apt/lists/*

# Pre-install all Remotion + build dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Copy template files (composition infrastructure, .claude/, skills)
COPY template/ /app/template/

# Copy sandbox entry script
COPY src/ /app/src/

# Workspace will be mounted as a volume at /workspace
VOLUME /workspace

EXPOSE 8080
CMD ["node", "/app/src/entry.js"]
```

### Entry Script (`/app/src/entry.js`)

On boot:
1. Check if `/workspace/manifest.json` exists (volume restored vs first boot)
2. If first boot: wait for `POST /init` from API with `{ videoUrl, manifest }`:
   - Download video from MinIO using `videoUrl` + injected `MINIO_*` credentials → `/workspace/public/source.mp4`
   - Write manifest to `/workspace/manifest.json`
   - Copy template files from `/app/template/` to `/workspace/` (Root.tsx, index.ts, .claude/, etc.)
3. If restored: skip init (all files already on volume)
4. Symlink `node_modules`: `/workspace/node_modules` → `/app/node_modules`
   (Note: if Docker image version changes between suspend/resume, symlink target may have different deps. Workspace `package.json` is pinned to the template version — if image deps diverge, re-run `npm ci` in workspace.)
5. Start esbuild watcher on `/workspace/src/` → outputs to `/workspace/.build/`
6. Start HTTP server on `:8080` serving `/workspace/.build/` and `/workspace/public/`
7. Start Agent SDK listener on `:8081` (HTTP endpoint for prompts, validates `SANDBOX_SECRET`)
8. Report ready to API via callback URL

### Processes Inside Sandbox

| Process | Port | Purpose |
|---------|------|---------|
| HTTP file server | :8080 | Serves CJS bundle + public assets (video, audio) |
| Agent SDK | :8081 | Receives prompts from API, executes with workspace access |
| esbuild watcher | — | Watches `/workspace/src/`, rebuilds CJS on change |

---

## 3. SandboxProvider Interface

```typescript
// packages/api/src/sandbox/provider.ts

interface Sandbox {
  id: string;              // Railway serviceId or Docker containerId
  projectId: string;
  volumeId: string;        // Railway volumeId or Docker volume name
  volumeInstanceId: string; // Railway volumeInstanceId (needed for backup/restore)
  internalUrl: string;     // http://{service}.railway.internal or http://localhost:{port}
  status: 'creating' | 'ready' | 'suspending' | 'suspended';
}

interface CreateOpts {
  projectId: string;
  backupId?: string;    // If resuming from previous session
  videoKey?: string;     // MinIO key for source video (first boot)
  manifest?: object;     // Initial manifest from DB (first boot)
}

interface SandboxProvider {
  /** Spin up a sandbox for a project */
  create(opts: CreateOpts): Promise<Sandbox>;

  /** Destroy sandbox, optionally backing up first */
  destroy(sandboxId: string): Promise<void>;

  /** Create a volume backup, returns backupId */
  backup(sandboxId: string): Promise<string>;

  /** Get the internal URL for proxying requests */
  getInternalUrl(sandboxId: string): string;

  /** Health check — is the sandbox responsive? */
  isReady(sandboxId: string): Promise<boolean>;
}
```

**Note:** `sendPrompt` is intentionally NOT on the provider — it's the same HTTP POST to `internalUrl` regardless of provider. Prompt forwarding lives in `proxy.ts` (a `SandboxAgentClient` class that takes an `internalUrl` and forwards prompts).

### Authentication

Every sandbox receives a `SANDBOX_SECRET` env var (random UUID, generated per sandbox at create time, stored in DB). All requests from API → sandbox include `Authorization: Bearer {secret}`. The sandbox validates this on every request.

- **Railway (prod):** Internal networking (`*.railway.internal`) is not publicly routable. The shared secret is defense-in-depth.
- **Docker (local):** `localhost:{dynamicPort}` is accessible on the host. The shared secret prevents accidental cross-sandbox requests. Dev-only — acceptable risk.

### RailwaySandboxProvider

```
create():
  1. Generate sandboxSecret = randomUUID()
  2. serviceCreate(projectId, image: "viona-sandbox", variables: { PROJECT_ID, API_CALLBACK_URL, SANDBOX_SECRET, MINIO_* })
  3. volumeCreate(serviceId, mountPath: "/workspace")
  4. serviceInstanceDeployV2(serviceId) — trigger deployment
  5. Wait for deployment, then query volume.volumeInstances[0].id → volumeInstanceId
  6. If backupId: volumeInstanceBackupRestore(backupId, volumeInstanceId)
  7. Poll until sandbox reports ready via callback
  8. Return { id: serviceId, volumeInstanceId, internalUrl: "{service}.railway.internal", ... }

  On failure at any step: clean up resources created so far (delete service if created, delete volume if created). Log error. Return failure.

destroy():
  1. serviceDelete(serviceId) — this also removes the volume attachment

backup():
  1. volumeInstanceBackupCreate(volumeInstanceId) — uses stored volumeInstanceId from create/DB
  2. Return backupId
```

### DockerSandboxProvider

```
create():
  1. Generate sandboxSecret = randomUUID()
  2. docker volume create viona-{projectId}
  3. If backupId: docker run --rm -v backup:/backup -v viona-{projectId}:/workspace busybox cp -a /backup/. /workspace/
  4. docker run -d --name sandbox-{projectId} -v viona-{projectId}:/workspace -e SANDBOX_SECRET={secret} -e MINIO_*=... -p {dynamicPort}:8080 -p {dynamicPort2}:8081 viona-sandbox
  5. Poll until HTTP server responds
  6. Return { id: containerId, internalUrl: "http://localhost:{dynamicPort}", ... }

  On failure: docker rm -f sandbox-{projectId} if container was started. docker volume rm viona-{projectId} if volume was created. Log error. Return failure.

destroy():
  1. docker stop sandbox-{projectId}
  2. docker rm sandbox-{projectId}

backup():
  1. docker run --rm -v viona-{projectId}:/workspace -v viona-backup-{projectId}:/backup busybox cp -a /workspace/. /backup/
  2. Return "viona-backup-{projectId}"
```

---

## 4. API Routes

### Sandbox Lifecycle

```
POST   /projects/:id/sandbox          → Create/resume sandbox
DELETE /projects/:id/sandbox          → Suspend sandbox (backup + destroy)
GET    /projects/:id/sandbox/status   → Get sandbox status + preview URL
```

### Proxy Routes (API → Sandbox)

```
GET    /projects/:id/sandbox/bundle/* → Proxy to sandbox :8080 (CJS + assets)
GET    /projects/:id/sandbox/public/* → Proxy to sandbox :8080 (video, audio)
POST   /projects/:id/sandbox/prompt   → Forward prompt to sandbox :8081, returns SSE stream directly
PATCH  /projects/:id/sandbox/manifest → Write manifest op to sandbox filesystem
GET    /projects/:id/sandbox/manifest → Read manifest from sandbox
```

### Internal Callbacks (Sandbox → API)

```
POST   /internal/sandbox/:id/ready       → Sandbox reports boot complete
POST   /internal/sandbox/:id/bundle-ready → esbuild rebuild complete
POST   /internal/sandbox/:id/checkpoint   → Periodic manifest sync to DB
```

---

## 5. Agent Inside Sandbox

The Claude Agent SDK runs as a long-lived process inside the sandbox. It receives prompts via HTTP from the API and has full filesystem access to `/workspace/`.

### Agent SDK Initialization

The sandbox uses the **Anthropic Agent SDK** (`@anthropic-ai/claude-agent-sdk`) with an API key (not OAuth — sandbox doesn't have user auth context).

```typescript
// packages/sandbox/src/agent-server.ts
import { Agent } from '@anthropic-ai/claude-agent-sdk';

const agent = new Agent({
  model: 'claude-sonnet-4-20250514',  // Phase 1: Sonnet for speed. Opus for complex tasks in Phase 2.
  apiKey: process.env.ANTHROPIC_API_KEY,  // Injected by API at sandbox creation
  systemPrompt: loadSystemPrompt(),       // Loaded from /workspace/.claude/ + /app/template/
  tools: [triggerRebuild, renderStill, readManifest, updateManifest],
  maxTurns: 50,
});
```

**Credential injection:** API injects `ANTHROPIC_API_KEY` and `MINIO_*` credentials as env vars at `serviceCreate` / `docker run` time. The sandbox never has user auth tokens — it only needs the Anthropic API key to call the model.

**Session persistence:** Each prompt call creates a new Agent turn. Multi-turn context is maintained by the Agent SDK's built-in conversation history. On suspend/resume, conversation state is lost (volume backup doesn't include in-memory SDK state). The frontend's conversation history (stored in DB) provides continuity — on resume, the system prompt includes a summary of prior conversation context.

**System prompt:** Loaded from `/workspace/.claude/CLAUDE.md` (project-specific context) merged with `/app/template/.claude/skills/` (Remotion coding skills). Same structure as current `packages/worker/remotion-template/.claude/`.

### Agent Tools

| Tool | Purpose |
|------|---------|
| `readFile` / `writeFile` / `editFile` | Built-in Agent SDK file tools (workspace access) |
| `bash` | Built-in Agent SDK bash tool (run commands in sandbox) |
| `triggerRebuild` | Custom MCP tool — signals esbuild watcher to rebuild |
| `renderStill` | Custom MCP tool — `remotion still` to capture frame PNG |
| `readManifest` | Custom MCP tool — read current manifest.json |
| `updateManifest` | Custom MCP tool — apply manifest operation, trigger rebuild |

### Agent Capabilities (Phase 1)

- **Plan visuals**: Read transcript/context, create scene plan, write SCENE_PLAN.md + scenes.json
- **Generate visuals**: Write Composition.tsx, segments/*.tsx, constants.ts
- **Edit visuals**: Targeted edits to existing source files ("make title bigger")
- **Self-verify**: Render still frames, check against plan, fix issues
- **Timeline ops**: Add/move/delete items in manifest via updateManifest tool

### Prompt Queuing & Streaming

Like Ramp, prompts are queued per-session. If the agent is busy, follow-up prompts queue and execute sequentially. This prevents race conditions on the filesystem.

Each `POST /projects/:id/sandbox/prompt` returns an SSE stream directly in the response (matching the current pattern in `AIAssistantPanel.tsx`). No separate GET endpoint needed — the POST response IS the stream.

```typescript
// Inside sandbox agent server
const promptQueue: PromptRequest[] = [];
let processing = false;

async function enqueuePrompt(prompt: string, stream: SSEStream) {
  promptQueue.push({ prompt, stream });
  if (!processing) processNext();
}

async function processNext() {
  if (promptQueue.length === 0) { processing = false; return; }
  processing = true;
  const { prompt, stream } = promptQueue.shift()!;
  // Run Agent SDK, stream events to `stream`
  await runAgent(prompt, stream);
  // Trigger manifest checkpoint after agent completes
  await checkpointManifest();
  processNext();
}
```

---

## 6. Frontend Integration

### Preview Player

Current `useWorkspaceComposition` hook stays, but `bundleUrl` points to the sandbox proxy route:

```
GET /api/projects/{id}/sandbox/bundle/player-composition.cjs.js
```

`customStaticFile` for video/audio:

```
GET /api/projects/{id}/sandbox/public/source.mp4
```

### Editor Store Changes

```typescript
// New sandbox state (replaces workspace state)
sandboxStatus: 'inactive' | 'creating' | 'ready' | 'suspending';
sandboxPreviewUrl: string | null;
sandboxBundleVersion: number;
```

### WebSocket Events

| Event | Payload | When |
|-------|---------|------|
| `sandbox:ready` | `{ previewUrl }` | Sandbox booted, preview available |
| `sandbox:destroyed` | `{}` | Sandbox suspended/destroyed |
| `bundle:ready` | `{ version }` | esbuild rebuild complete |
| `manifest:updated` | `{ source: 'user' \| 'ai', ops }` | Manifest changed |
| `agent:progress` | `{ message, phase }` | Agent working (streaming) |
| `agent:complete` | `{ filesChanged }` | Agent finished prompt |
| `agent:error` | `{ error }` | Agent failed |

### AI Sidebar

The existing `AIAssistantPanel.tsx` sends prompts via:

```typescript
// Current: SSE to API agent endpoint
// New: Same API endpoint, but API proxies to sandbox agent
const response = await fetch(`/api/projects/${projectId}/sandbox/prompt`, {
  method: 'POST',
  body: JSON.stringify({ prompt, conversationId }),
});
// SSE stream back with agent events
```

---

## 7. Backup & Recovery

### Normal Shutdown (user leaves)

1. Sandbox syncs manifest to DB (final checkpoint)
2. API calls `volumeInstanceBackupCreate` → backupId stored in DB
3. API calls `serviceDelete`
4. API calls `volumeDelete` (backup survives independently)

### Crash Recovery (sandbox dies unexpectedly)

1. Volume still exists on Railway (attached to dead service)
2. API detects sandbox unresponsive (health check fails)
3. API creates backup from existing volume
4. API cleans up dead service
5. On next user visit: restore from backup

### Periodic Checkpoint

Every 60 seconds, sandbox POSTs manifest to API callback endpoint. API writes to DB. If both sandbox AND volume are lost, manifest in DB is the fallback — source files would need to be regenerated by the agent.

---

## 8. DB Schema Changes

```sql
-- New table: sandbox sessions
CREATE TABLE sandbox_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),     -- Owner, for per-user limits
  status VARCHAR(20) NOT NULL DEFAULT 'creating',  -- creating, ready, suspending, suspended
  railway_service_id VARCHAR(255),     -- Railway service ID (null when suspended)
  railway_volume_id VARCHAR(255),      -- Railway volume ID (null when suspended)
  railway_volume_instance_id VARCHAR(255), -- Railway volume instance ID (needed for backup API)
  backup_id VARCHAR(255),             -- Last volume backup ID (for restore)
  sandbox_secret VARCHAR(255),        -- Shared secret for sandbox ↔ API auth
  internal_url VARCHAR(512),          -- Internal network URL for proxying
  sandbox_port INTEGER,               -- Port (for Docker provider)
  provider VARCHAR(20) NOT NULL,      -- 'railway' or 'docker'
  created_at TIMESTAMP DEFAULT NOW(),
  last_activity_at TIMESTAMP DEFAULT NOW(),
  suspended_at TIMESTAMP,
  metadata JSONB DEFAULT '{}'         -- Provider-specific data
);

-- One sandbox per project
CREATE UNIQUE INDEX idx_sandbox_sessions_project ON sandbox_sessions(project_id);

-- Per-user active sandbox lookup (for enforcing 1-active limit)
CREATE INDEX idx_sandbox_sessions_user_status ON sandbox_sessions(user_id, status);
```

---

## 9. Package Structure

```
packages/
├── api/                          (existing — add sandbox orchestration)
│   └── src/
│       ├── sandbox/
│       │   ├── provider.ts       — SandboxProvider interface
│       │   ├── railway.ts        — RailwaySandboxProvider
│       │   ├── docker.ts         — DockerSandboxProvider
│       │   ├── routes.ts         — Sandbox lifecycle + proxy routes
│       │   ├── proxy.ts          — HTTP proxy to sandbox internal URL
│       │   └── health.ts         — Sandbox health monitoring
│       └── ...existing code
│
├── sandbox/                      (NEW — sandbox Docker image)
│   ├── Dockerfile
│   ├── package.json
│   ├── src/
│   │   ├── entry.ts              — Main entry: starts all processes
│   │   ├── agent-server.ts       — HTTP server for agent prompts (:8081)
│   │   ├── file-server.ts        — HTTP server for bundle + assets (:8080)
│   │   ├── esbuild-watcher.ts    — Watches src/, rebuilds CJS
│   │   ├── workspace-init.ts     — First-boot workspace setup
│   │   ├── manifest-checkpoint.ts — Periodic manifest sync to API
│   │   └── tools/
│   │       ├── trigger-rebuild.ts
│   │       ├── render-still.ts
│   │       └── manifest-ops.ts
│   └── template/                 — Copied from worker/remotion-template/
│       ├── .claude/
│       ├── src/composition/
│       ├── package.json
│       └── tsconfig.json
│
├── shared/                       (existing — manifest types, schema)
│
└── worker/                       (existing — KEPT as reference, not used at runtime)
```

---

## 10. Configuration

```typescript
// Environment variables
SANDBOX_PROVIDER=railway|docker       // Which provider to use
RAILWAY_API_TOKEN=xxx                 // Railway API token (prod)
RAILWAY_PROJECT_ID=xxx               // Railway project to create services in
RAILWAY_ENVIRONMENT_ID=xxx           // Railway environment
SANDBOX_IMAGE=viona-sandbox:latest   // Docker image for sandboxes
SANDBOX_IDLE_TIMEOUT_MS=600000       // 10 min idle before suspend
SANDBOX_CHECKPOINT_MS=60000          // Manifest checkpoint interval
SANDBOX_MAX_CONCURRENT=100           // Max concurrent sandboxes
```

---

## 11. What This Enables (Phase 2+)

- **Full visual generation pipeline** — agent plans + generates motion graphics, b-rolls, transitions inside sandbox
- **Live preview during generation** — agent writes code, esbuild rebuilds, preview updates in real-time
- **Multi-agent** — sandbox can spawn sub-agents for parallel tasks
- **Collaborative editing** — multiple clients editing manifest simultaneously
- **Template workspaces** — pre-built starter compositions users can fork
