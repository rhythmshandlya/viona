# RunPod GPU Inference Dispatch — Design

**Date:** 2026-04-18
**Status:** Approved (pending review)
**Scope:** Generic GPU inference mechanism, reference implementation = `segment_speaker`

## Context

Today the only local GPU workload is RVM segmentation (`packages/worker/scripts/segment_person.py`, driven by `packages/worker/src/processors/segmentation.ts`). In production on Railway there are no GPUs, so RVM falls back to CPU float32 + libx264 encoding, which is ~5–10× slower than GPU and a blocker for scaling the pipeline.

We are moving GPU work to **RunPod Serverless**. RVM is the first consumer; future consumers include a local Whisper (small), audio enhancement models, and anything else that needs a GPU. The mechanism must be model-agnostic, agent-friendly, and reuse existing infrastructure where possible.

## Guiding principle

- **CPU / API-only work stays in the worker.** Remotion render, OpenAI Whisper API calls, Claude Agent SDK orchestration, caption analysis — all remain BullMQ-driven processors.
- **GPU work dispatches through the API with a pluggable provider.** In production (Railway), the provider is RunPod Serverless. In local dev the provider is the worker itself, which runs the model on whatever hardware is available (CPU or local GPU). The API is the sole holder of RunPod credentials; the sandbox and every other caller see the same interface regardless of where the compute lands.

### Provider switch

Set `INFERENCE_PROVIDER` in API env:

| Value | Use case | How it runs |
|---|---|---|
| `runpod` | Prod (default on Railway) | API presigns MinIO, submits to RunPod `/run`, webhook + reconciler resolve. |
| `worker` | Local dev, CI, RunPod-outage fallback | API enqueues a BullMQ `inference` job; worker pulls, runs the capability locally, uploads outputs to MinIO, publishes completion on Redis. |

Both providers publish terminal state to the same Redis channels (`job:{id}:complete|error`), so the sandbox SSE tool is completely provider-agnostic.

## Scope

### In scope
- A generic GPU inference dispatch system in the API that can expose arbitrary *capabilities* (outcome-based, not model-named) to callers.
- A sandbox MCP tool for the first capability: `segment_speaker`.
- Two provider backends (selected via `INFERENCE_PROVIDER`):
  - **RunPod Serverless** — endpoint + Docker handler for RVM (reference prod implementation).
  - **Worker-local** — BullMQ `inference` queue + per-capability modules that reuse existing Python scripts for dev/CI.
- Webhook + reconciliation for completion tracking (RunPod path only; worker path uses BullMQ's native retry).
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
│  Capability registry: segment-speaker → { runpodEndpointIdEnv,       │
│                         workerModule, executionTimeout, schemas }    │
│                                                                      │
│  POST /internal/sandbox/:id/inference                                │
│   │  - validate bearer                                               │
│   │  - INSERT inferenceJobs row (status='pending')                   │
│   │  - branch on INFERENCE_PROVIDER:                                 │
│   │                                                                  │
│   │    ┌─ provider=runpod ────────────────────────────────────────┐  │
│   │    │  presign MinIO GET(input) + PUTs(outputs)                │  │
│   │    │  issue scoped JWT, call RunPod /run with webhook URL     │  │
│   │    │  UPDATE runpodJobId, return { jobId }                    │  │
│   │    └──────────────────────────────────────────────────────────┘  │
│   │                                                                  │
│   │    ┌─ provider=worker ────────────────────────────────────────┐  │
│   │    │  queue BullMQ 'inference' job { capability, jobId, input}│  │
│   │    │  return { jobId }                                        │  │
│   │    └──────────────────────────────────────────────────────────┘  │
│                                                                      │
│  GET /internal/sandbox/:id/inference/:jobId/stream  (SSE)            │
│   │  - validate bearer                                               │
│   │  - subscribe to Redis job:${jobId}:progress/complete/error       │
│   │  - relay events as SSE                                           │
│   │  - close on terminal event                                       │
│                                                                      │
│  POST /internal/runpod/callback/:jobId?token=JWT  (RunPod only)      │
│   │  - verify JWT, UPDATE row, redis.publish(job:{id}:complete|error)│
│                                                                      │
│  Reconciliation job (setInterval 30s, RunPod-provider rows only):    │
│   │  - SELECT inferenceJobs WHERE status IN ('pending','running')    │
│   │                           AND provider='runpod'                  │
│   │  - GET runpod /status/:runpodJobId                               │
│   │  - If terminal: same path as webhook                             │
└──────────────────────────────────────────────────────────────────────┘
                │                                  │
   provider=runpod│                  provider=worker│
                ↓                                  ↓
┌──────────────────────────────────────┐   ┌───────────────────────────┐
│ RunPod Serverless endpoint:          │   │ Worker (BullMQ)           │
│ viona-rvm                            │   │                           │
│                                      │   │ 'inference' queue:        │
│ Docker image (GHCR, weights baked):  │   │  processor reads          │
│   cuda:12.2 + torch + RVM weights +  │   │    {capability, jobId,    │
│   handler.py + segment_person.py     │   │     input}                │
│                                      │   │  → looks up capability   │
│ handler(job):                        │   │     module               │
│   1. Download via presigned GET      │   │  → module downloads from │
│   2. Run segment_person.main()       │   │     MinIO                │
│   3. Upload via presigned PUTs       │   │  → runs local python     │
│   4. return {artifacts, metrics}     │   │     subprocess           │
│                                      │   │  → uploads to MinIO      │
│ RunPod POSTs webhook on terminal.    │   │  → publishes to Redis    │
└──────────────────────────────────────┘   │     job:{id}:complete    │
                                           └───────────────────────────┘
```

## Components

### 1. Capability Registry (`packages/api/src/inference/registry.ts`)

Single source of truth mapping capability name → RunPod config + worker module + schemas + policy.

```ts
export const inferenceRegistry = {
  'segment-speaker': {
    runpodEndpointIdEnv: 'RUNPOD_RVM_ENDPOINT_ID',
    // Name used by the worker's generic 'inference' processor to dynamic-import
    // the local runner: `packages/worker/src/inference/segment-speaker.ts`
    workerModule: 'segment-speaker',
    gpuTier: ['L40S', 'A40', 'A5000'],
    executionTimeoutSec: 900,
    inputSchema: z.object({ /* as before */ }),
    outputSchema: z.object({ /* as before */ }),
    outputKeys: (jobId) => ({ /* as before */ }),
  },
} satisfies Record<string, CapabilityDefinition>;
```

Adding a new capability = add a row here + (for prod) deploy a RunPod endpoint + (for dev) add a worker module + (optionally) add a sandbox MCP tool. Prod and dev can be added independently — you can ship worker-only capabilities during development, promote to RunPod when the cost/perf case is clear.

### 2. API routes (`packages/api/src/inference/routes.ts`)

- `POST /internal/sandbox/:id/inference` — dispatch (provider-branched).
- `GET /internal/sandbox/:id/inference/:jobId/stream` — SSE event stream.
- `POST /internal/runpod/callback/:jobId?token=JWT` — webhook sink (RunPod only).

Helpers in `packages/api/src/inference/`:
- `dispatcher.ts` — branches on `config.inference.provider`; either presigns + RunPod submits, or enqueues to BullMQ.
- `webhook-auth.ts` — issue + verify capability JWT (RunPod only).
- `reconciler.ts` — 30s interval; queries only rows with `provider='runpod'`.
- `runpod-client.ts` — fetch wrapper for RunPod REST API.

### 3. Database

New table `inferenceJobs`:

```ts
inferenceJobs {
  id: uuid (PK)
  sandboxSessionId: uuid (FK)
  capability: text             -- 'segment-speaker'
  provider: text               -- 'runpod' | 'worker'
  status: 'pending' | 'running' | 'completed' | 'failed' | 'timed_out'
  runpodJobId: text | null     -- RunPod job ID when provider='runpod', null for worker
  input: jsonb                 -- full validated input
  output: jsonb | null         -- on completion, matches capability outputSchema
  error: jsonb | null          -- { message, stage, recoverable }
  metrics: jsonb | null        -- { durationMs, gpuType?, costUsd? }
  submittedAt: timestamptz
  completedAt: timestamptz | null
}
```

The `provider` column lets the reconciler target only RunPod rows and lets observability distinguish dev/prod compute.

Why not reuse existing `jobs` table? That table's lifecycle is coupled to BullMQ retries for the legacy worker processors. Keeping a separate table lets the new generic inference path evolve cleanly, and the same table serves both providers uniformly.

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

### 5. Worker local runner (`packages/worker/src/inference/`)

When `INFERENCE_PROVIDER=worker`, the worker's generic `inference` BullMQ processor dispatches by capability name to a per-capability module:

```
packages/worker/src/
  processors/
    inference.ts                # generic processor: reads capability, dispatches
  inference/
    segment-speaker.ts          # thin wrapper: download from MinIO, spawn
                                # segment_person.py, upload outputs, publish
                                # completion on Redis job:{id}:*
  scripts/
    segment_person.py           # unchanged — source of truth for the Python code
```

This is ~80% lift-and-shift from the existing `packages/worker/src/processors/segmentation.ts`. What changes:
- Input/output shapes match the registry's `inputSchema` and `outputKeys` (not the legacy `SegmentationJobData`).
- Output MinIO keys come from `cap.outputKeys(jobId, input)` so worker and RunPod paths are bit-identical.
- Publishes to `job:{id}:complete|error` on the same Redis channels the SSE stream listens on.

### 6. RunPod handler (`runpod/rvm/`)

Directory layout:
```
runpod/
  rvm/
    Dockerfile        # cuda + torch + baked RVM weights; COPY-in from repo root
    handler.py        # thin wrapper; imports segment_person from /app
    requirements.txt
    README.md         # input/output contract + build instructions
```

**Build context is repo root** so the Dockerfile can `COPY packages/worker/scripts/segment_person.py /app/`. The Python script has exactly one source of truth (`packages/worker/scripts/segment_person.py`); both the worker and the RunPod image consume it.

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

### 7. Endpoint configuration (RunPod)

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

Steps 1–4 and 9–12 are provider-agnostic. Steps 5–8 differ per provider.

1. Sandbox agent (LLM) calls tool `segment_speaker({ videoKey: "uploads/abc/source.mp4", ranges: [...] })`. `videoKey` comes from the project manifest; the tool never accepts workspace file paths for inputs.
2. Tool calls `POST /internal/sandbox/:id/inference` with `{ capability: 'segment-speaker', input: { videoKey, ranges, params } }`.
3. API validates bearer, loads registry entry for `segment-speaker`, validates input against schema.
4. API inserts `inferenceJobs` row (`status='pending'`, `provider=<env>`). Returns `{ jobId }` eagerly as soon as submission succeeds.

### 5–8 — provider=runpod

5. API presigns a GET URL for `videoKey` and PUT URLs for each output under `outputs/mattes/{jobId}/…`.
6. API issues scoped JWT (claims: `{ jobId, capability, exp: submittedAt+executionTimeout+60s }`).
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
8. API updates `inferenceJobs.runpodJobId`, status → `running`. When RunPod finishes, it POSTs the webhook; API verifies JWT, updates row, publishes `job:{id}:{complete|error}` to Redis.

### 5–8 — provider=worker

5. API enqueues a BullMQ `inference` job: `{ jobId, capability, input }`.
6. API updates status → `running`.
7. Worker pulls the job. The generic `inference` processor looks up the capability's local runner (`packages/worker/src/inference/segment-speaker.ts`), which:
   - Downloads the source video from MinIO (using the worker's existing MinIO client — no presigning needed since the worker has creds).
   - Spawns `python packages/worker/scripts/segment_person.py` with the CLI args derived from `input.params`/`input.ranges`.
   - Uploads each output artifact to MinIO using keys from `cap.outputKeys(jobId, input)` — identical to the RunPod path.
8. Worker writes `output`, `status`, `metrics` onto the `inferenceJobs` row and publishes `job:{id}:{complete|error}` to Redis.

### 9–12 — shared terminal path

9. Sandbox tool opens SSE `GET /internal/sandbox/:id/inference/:jobId/stream`. API subscribes to Redis `job:{jobId}:*` and relays events as SSE (`progress`, `complete`, `error`). Tool uses MCP `report_progress` to surface these to the agent UI.
10. SSE stream relays the terminal event (same format from either provider), then closes.
11. Tool reads output keys from the event and downloads each file from MinIO directly (using the sandbox's existing MinIO client) to `outputDir`.
12. Tool parses `bbox.json`, returns `{ mattePath, fgrPath, bbox, durationMs, costUsd }` to the agent.

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

| Failure | Provider | Handling |
|---|---|---|
| RunPod handler crashes | runpod | Status flips to `FAILED`; webhook still fires with error. Reconciler catches missed webhooks. |
| Webhook lost (network / API down) | runpod | Reconciler polls `/status/:runpodJobId` every 30s for `provider='runpod'` rows only; terminal state triggers same code path as webhook. |
| RunPod execution timeout (> 900s) | runpod | Status → `timed_out`. Sandbox tool surfaces error; agent can retry with smaller input. |
| Worker subprocess crashes | worker | Processor throws; BullMQ's built-in retry (2 attempts, exponential backoff) handles transient failures. Terminal failure marks row `failed` and publishes to Redis. |
| Worker container crashes mid-job | worker | BullMQ redelivers the job to another worker instance on lock expiry. Idempotency: re-dispatch reuses the same `jobId` and re-uploads to the same MinIO keys. |
| Python subprocess hangs | worker | Processor enforces a 15-min timeout (matches `executionTimeoutSec`); kills child process on expiry, publishes `error`. |
| API restarts mid-job | both | `inferenceJobs` row persists. For `runpod`: reconciler resumes polling. For `worker`: BullMQ job survives (Redis-backed), continues processing. SSE stream drops; sandbox tool reconnects (up to 3 retries). |
| Sandbox SSE connection drops | both | Tool reconnects to `GET .../stream` (idempotent — just resubscribes to Redis). If terminal event already published, stream immediately re-emits last state from the DB row on connect. |
| Cost blowout | runpod | Per-sandbox-session cost ceiling checked at dispatch time (reject if projected > budget). Reconciler also cancels pending jobs on session termination. |
| Sandbox evicted mid-wait | both | Compute finishes regardless; outputs land in MinIO. When sandbox reconnects, it can query job status by jobId if it persisted it (deferred). |

## Rollout

1. **Phase 1 — DB, config, registry, JWT, RunPod client.** Lays down the shared foundation used by both providers.
2. **Phase 2 — worker provider.** New BullMQ `inference` queue + generic processor + `segment-speaker` module (lifted from existing `segmentation.ts`). End-to-end test with `INFERENCE_PROVIDER=worker` locally. This validates the registry, DB, routes, and SSE stream end-to-end without RunPod dependency.
3. **Phase 3 — RunPod provider.** Build `runpod/rvm/` Dockerfile + `handler.py`. Push image, create endpoint, test via `INFERENCE_PROVIDER=runpod` locally (with ngrok for webhook).
4. **Phase 4 — sandbox MCP tool.** Register `segment_speaker` in the sandbox MCP server. End-to-end test with both providers.
5. **Phase 5 — migrate real pipeline.** Sandbox agents' current segmentation calls point at the new tool. Dev/CI uses `INFERENCE_PROVIDER=worker`; Railway prod uses `INFERENCE_PROVIDER=runpod`.
6. **Phase 6 — cleanup.** Delete the legacy `packages/worker/src/processors/segmentation.ts` processor, the `segmentation` BullMQ queue, and the old `/internal/sandbox/:id/segment` routes. **Keep** `packages/worker/scripts/segment_person.py` — it's the source of truth consumed by both the worker's new `inference` queue and the RunPod image.

## Env vars added
- `INFERENCE_PROVIDER` (API, worker) — `runpod` or `worker`. Default: `runpod` in Railway, `worker` locally.
- `RUNPOD_API_KEY` (API only, when provider=runpod)
- `RUNPOD_RVM_ENDPOINT_ID` (API only, when provider=runpod)
- `RUNPOD_WEBHOOK_SECRET` (API only — signs JWTs, when provider=runpod)
- `RUNPOD_WEBHOOK_BASE_URL` (API only — public URL for the webhook callback; defaults to `RAILWAY_PUBLIC_DOMAIN`)

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
| Webhook vs polling | **Webhook primary + 30s reconciliation poll as truth** (RunPod path). |
| Where does RunPod key live | **API only — never in sandbox.** |
| BullMQ in the GPU path | **No** when provider=runpod (RunPod is the queue; `inferenceJobs` is durability). **Yes** when provider=worker (BullMQ's native retry is ideal for local subprocess work). |
| Tool blocking vs handle | **Blocking via SSE.** Upgrade to MCP Tasks when SDK supports it. |
| Output delivery | **MinIO → file in `/workspace/outputs/...` via sandbox's existing MinIO client.** Never inlined in tool result. |
| Tool naming | **Outcome-based** (`segment_speaker`), not model-named. Registry hides model choice AND provider choice. |
| First capability | **`segment_speaker` only.** Others follow the established pattern. |
| Dev vs prod compute | **Same API, same DB, same sandbox tool. Provider chosen via `INFERENCE_PROVIDER` env var.** Same interface, two backends. |
| Where does `segment_person.py` live | **`packages/worker/scripts/segment_person.py` (single source of truth).** Worker's `inference` queue spawns it directly; RunPod Dockerfile `COPY`s it from repo root at build time. |
