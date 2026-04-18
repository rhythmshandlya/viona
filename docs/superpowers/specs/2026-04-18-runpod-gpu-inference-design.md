# RunPod GPU Inference Dispatch — Design

**Date:** 2026-04-18
**Status:** Approved (pending review)
**Scope:** Generic GPU inference mechanism, reference implementation = `segment_speaker`

## Context

Today the only local GPU workload is RVM segmentation (`packages/worker/scripts/segment_person.py`, driven by `packages/worker/src/processors/segmentation.ts`). In production on Railway there are no GPUs, so RVM falls back to CPU float32 + libx264 encoding, which is ~5–10× slower than GPU and a blocker for scaling the pipeline.

We are moving GPU work to **RunPod Serverless**. RVM is the first consumer; future consumers include a local Whisper (small), audio enhancement models, and anything else that needs a GPU. The mechanism must be model-agnostic, agent-friendly, and reuse existing infrastructure where possible.

## Guiding principle

- **CPU / API-only work stays in the worker.** Remotion render, OpenAI Whisper API calls, Claude Agent SDK orchestration, caption analysis — all remain BullMQ-driven processors.
- **GPU work goes to RunPod, dispatched from the API.** No BullMQ in this path. The API is the sole holder of RunPod credentials and the sole place RunPod is called from.

## Scope

### In scope
- A generic GPU inference dispatch system in the API that can expose arbitrary *capabilities* (outcome-based, not model-named) to callers.
- A sandbox MCP tool for the first capability: `segment_speaker`.
- RunPod Serverless endpoint + Docker handler for RVM (reference implementation).
- Webhook + reconciliation for completion tracking.
- Scoped JWT for webhook auth.
- Capability registry so additional models plug in by config.

### Out of scope (future specs)
- Whisper-small capability (`transcribe` tool). Design reusable by construction; implementation is a follow-up.
- Audio enhancement capability. Same.
- Migrating non-sandbox callers (e.g., upload-triggered transcription) to call the same API. The API endpoint will be callable from anywhere, but refactoring worker processors to use it is later work.
- Replacing the existing BullMQ `segmentation` queue. It stays for now as dead code and is removed once the new path is proven.

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│ Sandbox (E2B)                                                        │
│                                                                      │
│  MCP tool: segment_speaker(videoKey, ranges)                         │
│   │                                                                  │
│   ├─1. POST /internal/sandbox/:id/inference → { jobId }              │
│   ├─2. GET /internal/sandbox/:id/inference/:jobId/stream (SSE)       │
│   │     ↑ blocks until terminal event or timeout                     │
│   ├─3. Download outputs via sandbox's MinIO client → /workspace/…    │
│   └─4. Return { mattePath, fgrPath, bbox } to agent                  │
└──────────────────────────────────────────────────────────────────────┘
                            ↑ Bearer sandboxSecret
                            │ HTTPS to API
                            │
┌──────────────────────────────────────────────────────────────────────┐
│ Viona API (Fastify)                                                  │
│                                                                      │
│  Capability registry: segment-speaker → { runpodEndpointId, gpuTier, │
│                                            executionTimeout, schemas }│
│                                                                      │
│  POST /internal/sandbox/:id/inference                                │
│   │  - validate bearer (existing sandboxSessions auth)               │
│   │  - presign MinIO: input GET, output PUTs                         │
│   │  - INSERT jobs row (status='pending', runpodJobId=null)          │
│   │  - issue scoped JWT (claims: jobId, capability, exp=1h)          │
│   │  - POST runpod /run { input, webhook={API}/runpod/callback?...}  │
│   │  - UPDATE jobs.runpodJobId                                       │
│   │  └─ return { jobId }                                             │
│                                                                      │
│  GET /internal/sandbox/:id/inference/:jobId/stream  (SSE)            │
│   │  - validate bearer                                               │
│   │  - subscribe to Redis job:${jobId}:progress/complete/error       │
│   │  - relay events as SSE                                           │
│   │  - close on terminal event                                       │
│                                                                      │
│  POST /internal/runpod/callback/:jobId?token=JWT  (from RunPod)      │
│   │  - verify JWT (jobId + capability match)                         │
│   │  - UPDATE jobs row (status, outputs, error, metrics)             │
│   │  - redis.publish(job:${jobId}:${complete|error}, payload)        │
│                                                                      │
│  Reconciliation job (setInterval 30s):                               │
│   │  - SELECT jobs WHERE status='pending' AND submittedAt older 30s  │
│   │  - GET runpod /status/:runpodJobId                               │
│   │  - If terminal: same path as webhook                             │
└──────────────────────────────────────────────────────────────────────┘
                            ↑ HTTPS + RUNPOD_API_KEY
                            │ (key lives in API env only)
                            │
┌──────────────────────────────────────────────────────────────────────┐
│ RunPod Serverless endpoint: viona-rvm                                │
│                                                                      │
│  Docker image (built + pushed to GHCR, weights baked):               │
│    nvidia/cuda:12.2-runtime → python + torch + RVM weights +         │
│    handler.py + segment_person.py + minio client                     │
│                                                                      │
│  handler(job):                                                       │
│    1. Download via input.presignedGetUrl                             │
│    2. Run segment_person.main() unchanged                            │
│    3. Upload outputs via input.presignedPutUrls                      │
│    4. return { artifacts: {...}, metrics: {...} }                    │
│                                                                      │
│  RunPod auto-invokes webhook on terminal state.                      │
└──────────────────────────────────────────────────────────────────────┘
```

## Components

### 1. Capability Registry (`packages/api/src/inference/registry.ts`)

Single source of truth mapping capability name → RunPod config, payload schemas, default policy.

```ts
export const inferenceRegistry = {
  'segment-speaker': {
    runpodEndpointIdEnv: 'RUNPOD_RVM_ENDPOINT_ID',
    gpuTier: ['L40S', 'A40', 'A5000'],
    executionTimeoutSec: 900,
    inputSchema: z.object({
      videoKey: z.string(),
      ranges: z.array(z.object({ startMs: z.number(), endMs: z.number() })).optional(),
      params: z.object({
        backbone: z.enum(['resnet50', 'mobilenetv3']).default('resnet50'),
        downsampleRatio: z.number().default(0.8),
      }).default({}),
    }),
    outputSchema: z.object({
      matteKey: z.string(),
      fgrKey: z.string(),
      bboxKey: z.string(),
      proxyMatteKey: z.string(),
      proxyFgrKey: z.string(),
    }),
    estimateCostUsd: (input) => /* duration-based */ 0.10,
  },
} satisfies Record<string, CapabilityDefinition>;
```

Adding a new capability = add a row here + deploy a new RunPod endpoint + (optionally) add a sandbox MCP tool. No infra changes.

### 2. API routes (`packages/api/src/routes/internal/inference.ts`)

- `POST /internal/sandbox/:id/inference` — dispatch.
- `GET /internal/sandbox/:id/inference/:jobId/stream` — SSE event stream.
- `POST /internal/runpod/callback/:jobId?token=JWT` — webhook sink.

All three share helpers in `packages/api/src/inference/`:
- `dispatcher.ts` — presign + RunPod submit + DB row insert.
- `webhook-auth.ts` — issue + verify capability JWT.
- `reconciler.ts` — 30s interval `setInterval` loop started on API boot.

### 3. Database

New table `inferenceJobs` (mirrors existing `jobs` shape):

```ts
inferenceJobs {
  id: uuid (PK)
  sandboxSessionId: uuid (FK)
  capability: text             -- 'segment-speaker'
  status: 'pending' | 'running' | 'completed' | 'failed' | 'timed_out'
  runpodJobId: text | null
  input: jsonb                 -- full validated input
  output: jsonb | null         -- on completion, matches capability outputSchema
  error: jsonb | null          -- { message, stage, recoverable }
  metrics: jsonb | null        -- { durationMs, gpuType, costUsd }
  submittedAt: timestamptz
  completedAt: timestamptz | null
}
```

Why not reuse existing `jobs` table? That table is BullMQ-bound and its lifecycle is coupled to Bull retries. Keeping a separate table lets us kill BullMQ in this path cleanly.

### 4. Sandbox MCP tool (`packages/sandbox/src/mcp-servers/inference.ts`)

New in-process SDK MCP server, registered alongside the existing six in `packages/sandbox/src/mcp-servers.ts`.

```ts
tool('segment_speaker', {
  input: z.object({
    videoKey: z.string(),            // MinIO key; videos are already in storage
    ranges: z.array(...).optional(),
    outputDir: z.string().default('/workspace/outputs/segment'),
  }),
  output: z.object({
    mattePath: z.string(),
    fgrPath: z.string(),
    bbox: z.object({ /* shape of matte-bbox.json */ }),
    durationMs: z.number(),
    costUsd: z.number().optional(),
  }),
  handler: async (input, ctx) => {
    // 1. POST /internal/sandbox/:id/inference with { capability, input } → { jobId }
    // 2. Open SSE stream on /inference/:jobId/stream
    // 3. Relay progress events via ctx.report_progress (existing widget server tool)
    // 4. On terminal event, use sandbox's existing MinIO client to download
    //    each output key to outputDir
    // 5. Return file paths + parsed bbox JSON
  }
})
```

Tool blocks for the full inference duration. SSE keeps the MCP call alive; existing heartbeat pattern (`agent-server.ts:181-188`) handles proxy keepalive. On SSE drop, tool reconnects up to 3 times before failing.

**Storage access from the sandbox**: the sandbox already has direct MinIO client access for checkpoints (`packages/sandbox/src/checkpoint.ts:30-37`). Reuse this client for output downloads. Presigned URLs in the API→RunPod path exist because the RunPod container does **not** have our MinIO creds; the sandbox does, so its download path is direct.

### 5. RunPod handler (`runpod/rvm/`)

Directory layout:
```
runpod/
  _shared/            # base Dockerfile layer: cuda + python + minio + runpod sdk
    Dockerfile
    utils.py          # presigned url download/upload helpers
  rvm/
    Dockerfile        # FROM viona-runpod-base; bake RVM weights; copy handler.py
    handler.py
    requirements.txt
    README.md         # input/output contract
```

Handler contract (same for all capabilities):

```python
def handler(job):
    inp = job["input"]
    # Standard fields every capability receives:
    #   inp["inputs"][<name>]   = presigned GET URL
    #   inp["outputs"][<name>]  = presigned PUT URL
    #   inp["params"]           = capability-specific dict
    # Must return:
    #   { "artifacts": { <name>: { "key": str, "contentType": str, "stats": dict } },
    #     "metrics":   { "durationMs": int, ... } }
```

Weights baked into image (not network volume) — RVM resnet50 is ~100 MB, cold-start cost is negligible vs. a volume mount. Multi-stage Dockerfile: base layer has deps + weights (cached), top layer has handler.py (fast iteration).

### 6. Endpoint configuration (RunPod)

| Setting | Value | Reasoning |
|---|---|---|
| `minWorkers` | 0 | RVM is background; cost > latency initially |
| `maxWorkers` | 3 | Leaves room for parallel scene segmentation |
| `idleTimeout` | 60s | Keep warm between clip requests in one session |
| `executionTimeout` | 900s | Matches current BullMQ lock on old segmentation |
| `scalerType` | QUEUE_DELAY | Scale when wait > 4s |
| `gpuTypes` | L40S → A40 → A5000 (fallback list) | Cheapest sufficient for RVM at 1080p |
| `flashBoot` | on | Reduces cold start to ~2s when traffic is steady |

## Data flow: `segment_speaker` end-to-end

1. Sandbox agent (LLM) calls tool `segment_speaker({ videoKey: "uploads/abc/source.mp4", ranges: [{startMs:0, endMs:120000}] })`. `videoKey` comes from the project manifest — the video was uploaded by the user and already lives in MinIO; the tool never accepts workspace file paths for inputs.
2. Tool calls `POST /internal/sandbox/:id/inference` with `{ capability: 'segment-speaker', input: { videoKey, ranges, params } }`.
4. API validates bearer, loads registry entry for `segment-speaker`, validates input against schema.
5. API presigns a GET URL for the input `videoKey` (so the RunPod handler can fetch it) and PUT URLs for each output artifact (matte, fgr, bbox, proxies) under `outputs/mattes/{jobId}/…`.
6. API inserts `inferenceJobs` row (status `pending`), issues scoped JWT (claims: `{ jobId, capability, exp: now+1h }`).
7. API calls RunPod `POST /run`:
   ```json
   {
     "input": {
       "inputs":  { "video": "<presigned GET>" },
       "outputs": { "matte": "<presigned PUT>", "fgr": "...", "bbox": "..." , "proxyMatte": "...", "proxyFgr": "..." },
       "params":  { "backbone": "resnet50", "downsampleRatio": 0.8, "ranges": [...] }
     },
     "webhook": "https://api.viona.co/internal/runpod/callback/{jobId}?token={JWT}",
     "policy":  { "executionTimeout": 900000 }
   }
   ```
8. API updates `inferenceJobs.runpodJobId`, returns `{ jobId }` to sandbox tool.
9. Sandbox tool opens SSE `GET /internal/sandbox/:id/inference/:jobId/stream`. API subscribes to Redis `job:{jobId}:*` and relays events as SSE (`progress`, `complete`, `error`). Tool uses MCP `report_progress` to surface these to the agent UI.
10. RunPod worker pulls image, runs handler, downloads video, runs RVM, uploads outputs, POSTs webhook with `{ output: {...}, executionTime: N }`.
11. API webhook handler verifies JWT, updates row, publishes to Redis. SSE stream relays `complete` event, then closes.
12. Tool receives terminal event, downloads each output from MinIO directly (using the sandbox's existing MinIO client) to `outputDir`, parses bbox JSON, returns `{ mattePath, fgrPath, bbox, durationMs, costUsd }` to the agent.

## Security

### Sandbox ↔ API
Existing `sandboxSessions.sandboxSecret` bearer token. No change.

### API ↔ RunPod
`RUNPOD_API_KEY` + `RUNPOD_RVM_ENDPOINT_ID` in API env only. Never in sandbox, worker, or frontend.

### Webhook callback (RunPod → API)
Scoped JWT on the webhook URL, HS256-signed with `RUNPOD_WEBHOOK_SECRET`:
```
claims: { jobId, capability, iat, exp }  // exp = submittedAt + executionTimeout + 60s
```
Verifier checks: signature, `jobId` matches URL, `capability` matches the DB row's capability, `exp` not passed. Prevents webhook replay against a different job or after job expiry.

### MinIO
Presigned URLs only. Bucket policy unchanged. RunPod handler never receives long-lived MinIO credentials.

## Failure modes

| Failure | Handling |
|---|---|
| RunPod handler crashes | Status flips to `FAILED`; webhook still fires with error. Reconciler catches missed webhooks. |
| Webhook lost (network / API down) | Reconciler polls `/status/:runpodJobId` every 30s; terminal state triggers same code path as webhook. |
| API restarts mid-job | `inferenceJobs` row persists; on restart, reconciler picks up all `pending` rows and resumes polling. SSE stream drops; sandbox tool reconnects (up to 3 retries). |
| Sandbox SSE connection drops | Tool reconnects to `GET .../stream` (idempotent — just resubscribes to Redis). If terminal event already published, stream immediately re-emits last state from DB on connect. |
| RunPod execution timeout (> 900s) | Status → `timed_out`. Sandbox tool surfaces error; agent can retry with smaller input. |
| Cost blowout | Per-sandbox-session cost ceiling checked at dispatch time (reject if projected > budget). Reconciler also cancels pending jobs on session termination. |
| Sandbox evicted mid-wait | Job continues on RunPod; outputs still land in MinIO. When sandbox reconnects, it can query job status by jobId if it persisted it (deferred). |

## Rollout

1. **Phase 1 — build + test handler offline.** Write `runpod/_shared` base + `runpod/rvm/` handler. Test against RunPod directly with hardcoded presigned URLs. Prove bit-exact output parity with local `segment_person.py`.
2. **Phase 2 — wire API dispatcher.** Registry, DB migration for `inferenceJobs`, three routes, JWT, reconciler. Unit-test with RunPod mocked.
3. **Phase 3 — wire sandbox MCP tool.** New in-process server under `packages/sandbox/src/mcp-servers/inference.ts`, registered in `mcp-servers.ts`. End-to-end test: sandbox agent invokes `segment_speaker`, files land in workspace.
4. **Phase 4 — migrate real pipeline.** Sandbox agents' current segmentation calls (which hit `/internal/sandbox/:id/segment`) point at the new path. Keep old path warm for 1 week, then delete.
5. **Phase 5 — cleanup.** Delete `packages/worker/src/processors/segmentation.ts`, Python subprocess code, related BullMQ queue. Weights no longer needed in worker container.

## Env vars added
- `RUNPOD_API_KEY` (API only)
- `RUNPOD_RVM_ENDPOINT_ID` (API only)
- `RUNPOD_WEBHOOK_SECRET` (API only — signs JWTs)

## Testing

- **Unit:** registry schema validation, JWT issue/verify, reconciler state transitions.
- **Integration:** API dispatch with RunPod `runsync` mock; SSE stream end-to-end with Redis.
- **E2E:** real RunPod endpoint, real MinIO, sandbox invokes tool, verifies matte bytes match baseline. Live test on one known clip.
- **Chaos:** kill webhook mid-flight → reconciler picks up; restart API mid-job → job resumes; drop SSE → tool reconnects.

## Non-goals / deferred

- MCP SEP-1686 `tasks` primitive — use existing SSE pattern until Claude Agent SDK supports the spec natively. Interface is forward-compatible (can swap internally).
- Priority queues / job preemption — everything is FIFO in RunPod's queue for now.
- Warm pool (`minWorkers=1`) — add later if user-facing latency measurements demand it.
- Whisper / audio-enhance capabilities — separate spec per capability, but each is just a registry entry + handler directory + (optional) MCP tool.
- Migrating existing worker processors (e.g., upload-triggered transcribe on OpenAI) to this API. Worker continues to own CPU/API work.

## Open questions resolved during brainstorming

| Q | Decision |
|---|---|
| Webhook vs polling | **Webhook primary + 30s reconciliation poll as truth** |
| Where does RunPod key live | **API only — never in sandbox** |
| BullMQ in the path | **No.** RunPod is the queue; `inferenceJobs` table is durability. BullMQ stays for CPU work. |
| Tool blocking vs handle | **Blocking via SSE.** Upgrade to MCP Tasks when SDK supports it. |
| Output delivery | **Presigned GET from MinIO → file in `/workspace/outputs/...`.** Never inlined in tool result. |
| Tool naming | **Outcome-based** (`segment_speaker`), not model-named. Registry hides model choice. |
| First capability | **`segment_speaker` only.** Others follow the established pattern. |
