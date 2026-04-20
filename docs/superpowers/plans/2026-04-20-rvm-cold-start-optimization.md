# RVM Cold-Start + Cost Optimization — Implementation Plan

> **For agentic workers:** Execute task-by-task. Each task has verification steps. Commit after each task.

**Goal:** Drive RunPod RVM cold start from ~8 min → ~3-5 min, cut per-job compute cost ~55%, and guarantee warm-worker hits for 95%+ of real user sessions. No idle billing.

**Three workstreams (can run in parallel):**
1. **Slim image** — build/push `ghcr.io/rhythmshandlya/viona-rvm:slim` (~1.6 GB compressed, down from 2.5 GB). Dockerfile already staged.
2. **Endpoint config swap** — cheapest GPU pool, extended idle, new image digest.
3. **Prewarm feature** — dispatcher method + API route + sandbox-side caller that fires a no-op RunPod job early in the pipeline.

Spend target: idle $0, per-job ~$0.0013 on A4000 (was $0.0029 on 4090).

---

## File structure

| Action | File | Responsibility |
|---|---|---|
| Commit | `models/rvm/Dockerfile.onnx.slim` (already staged) | Multi-stage slim variant |
| Modify | Railway/RunPod endpoint config (no local file) | GPU pool + idleTimeout + pinned digest |
| Modify | `packages/api/src/inference/dispatcher.ts` | Add `prewarmInference(capability)` |
| Modify | `packages/api/src/inference/routes.ts` | Add `POST /internal/inference/prewarm` |
| Modify | `packages/api/src/sandbox/routes.ts` (sandbox acquire handler) | Fire prewarm when a sandbox is acquired for a project |

---

## Task 1 — Commit + build + push slim image

### Files
- Modify: none (`models/rvm/Dockerfile.onnx.slim` is already `git add`ed)

### Steps

- [ ] **Step 1 — Commit the slim Dockerfile**

```bash
git status --short | grep Dockerfile.onnx.slim   # should show A  models/rvm/Dockerfile.onnx.slim
git -c commit.gpgsign=false commit -m "feat(runpod): slim ONNX Dockerfile (~1.6 GB target)"
```

- [ ] **Step 2 — Build the slim variant**

```bash
cd "$(git rev-parse --show-toplevel)"
docker build -f models/rvm/Dockerfile.onnx.slim -t ghcr.io/rhythmshandlya/viona-rvm:slim models/rvm 2>&1 | tee /tmp/rvm-slim-build.log
```

Expected: successful build, ~8-12 min first time.

- [ ] **Step 3 — Verify size target**

```bash
docker images ghcr.io/rhythmshandlya/viona-rvm --format "table {{.Tag}}\t{{.Size}}" | grep slim
```

Expected: `:slim ~4-5 GB` on-disk (uncompressed). If >6 GB, the strip didn't take — re-inspect Dockerfile.

- [ ] **Step 4 — Local smoke test (with real video)**

Run the handler against a pre-uploaded test input:

```bash
MSYS_NO_PATHCONV=1 docker run --rm --gpus all -v /c/tmp:/tmp \
  ghcr.io/rhythmshandlya/viona-rvm:slim \
  python /app/handler.py --test-input /tmp/rvm-input.json 2>&1 | tail -25
```

Expected: "RVM ONNX warmup complete" then "Processed N/N frames" then `artifacts: uploaded: true` × 3. If ORT crashes on missing `sympy` or `cryptography`, add back to `requirements-onnx.txt` and rebuild.

- [ ] **Step 5 — Push to GHCR**

```bash
docker push ghcr.io/rhythmshandlya/viona-rvm:slim 2>&1 | tail -5
```

Record the digest from the final line (`slim: digest: sha256:…`).

- [ ] **Step 6 — Commit**

(Already committed in Step 1 — no further commit for the build/push steps.)

### Verification
- Image size ≤ 5 GB on disk.
- Local smoke produces matte + fgr + bbox.
- GHCR push succeeds, returns a digest.

---

## Task 2 — Endpoint config swap

### Files
- None (pure RunPod GraphQL API)

### Steps

- [ ] **Step 1 — Pin template to the slim digest**

Replace `<DIGEST>` with the slim digest from Task 1 Step 5.

```bash
curl -s -X POST "https://api.runpod.io/graphql?api_key=$RUNPOD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation { saveTemplate(input: { id: \"0nh9xg1ljy\", name: \"viona-rvm\", imageName: \"ghcr.io/rhythmshandlya/viona-rvm@sha256:<DIGEST>\", containerDiskInGb: 30, volumeInGb: 0, isServerless: true, dockerArgs: \"\", env: [], containerRegistryAuthId: \"cmo5s5mx50021jo08uduzbnye\" }) { id imageName } }"
  }'
```

Note: `containerDiskInGb: 30` (down from 50 — slim image doesn't need 50 GB of scratch).

- [ ] **Step 2 — Update endpoint: smaller GPU pool + longer idle**

```bash
curl -s -X POST "https://api.runpod.io/graphql?api_key=$RUNPOD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation { saveEndpoint(input: { id: \"47vqgfl96ncutj\", name: \"viona-rvm\", templateId: \"0nh9xg1ljy\", gpuIds: \"AMPERE_16,ADA_24\", workersMin: 0, workersMax: 2, idleTimeout: 300, executionTimeoutMs: 900000, scalerType: \"QUEUE_DELAY\", scalerValue: 4 }) { id gpuIds idleTimeout } }"
  }'
```

Config changes vs current:
- `gpuIds`: `ADA_24` → `AMPERE_16,ADA_24` (A4000 16GB primary, RTX 4090 fallback)
- `idleTimeout`: `60` → `300` (keep warm through pipeline batching)
- `containerDiskInGb`: `50` → `30` (image is smaller)

- [ ] **Step 3 — Verify endpoint config**

```bash
curl -s -X POST "https://api.runpod.io/graphql?api_key=$RUNPOD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ myself { endpoints { id name gpuIds idleTimeout workersMax } } }"}' \
  | python -c "import json,sys; d=json.load(sys.stdin); [print(e) for e in d['data']['myself']['endpoints'] if e['name']=='viona-rvm']"
```

Expected: `gpuIds: AMPERE_16,ADA_24`, `idleTimeout: 300`.

- [ ] **Step 4 — Smoke test the new setup**

Submit a fresh E2E test via `scripts/temp/test-runpod-against-railway-bucket.ts`. Record:
- First cold-start `delayTime` (should be ≤ 5 min — the image is smaller AND more layers pull in parallel)
- Worker GPU type (visible in dashboard — should be RTX A4000 unless fallback kicked in)

### Verification
- Endpoint config shows new pool + idle.
- Fresh cold-start job completes in ≤ 5 min wall-clock.
- `delayTime` is ≤ 250 s.
- Second job within 4 min of first completes with `delayTime ≤ 5 s` (worker still warm due to 300 s idle).

---

## Task 3 — Prewarm feature

### Files
- Modify: `packages/api/src/inference/dispatcher.ts`
- Modify: `packages/api/src/inference/routes.ts`
- Modify: `packages/api/src/sandbox/routes.ts` (find the sandbox-acquire handler, add a fire-and-forget prewarm call)

### Steps

- [ ] **Step 1 — Add `prewarmInference` to `dispatcher.ts`**

Append to `packages/api/src/inference/dispatcher.ts`:

```ts
/**
 * Fire a no-op RunPod job to warm a worker. Does NOT create an inferenceJobs
 * row. Returns immediately after submit — caller shouldn't await the outcome.
 * Only meaningful when provider === 'runpod'; no-op on worker provider.
 */
export async function prewarmInference(capability: string): Promise<void> {
  if (config.inference.provider !== 'runpod') return;
  const cap = getCapability(capability);
  try {
    await runpodSubmit(cap.getEndpointId(), {
      input: { inputs: {}, outputs: {}, params: {} },
      // no webhook — we don't care about the result
      policy: { executionTimeout: 30_000 },
    });
    logger.info({ capability }, 'Inference prewarm fired');
  } catch (err) {
    logger.warn({ capability, err: (err as Error).message }, 'Inference prewarm failed (non-fatal)');
  }
}
```

Note: this intentionally skips the DB row — the warmup job will fail with `KeyError: 'video'` in ~80 ms on a warm worker, and we don't care. Its only purpose is to kick RunPod to allocate a worker.

- [ ] **Step 2 — Add `POST /internal/inference/prewarm` route**

In `packages/api/src/inference/routes.ts`, inside `registerInferenceRoutes(fastify)`, add:

```ts
// POST /internal/inference/prewarm — fire-and-forget worker warmup
fastify.post('/internal/inference/prewarm', async (request, reply) => {
  const body = request.body as { capability?: string };
  if (!body.capability) return reply.status(400).send({ error: 'capability required' });
  // No sandbox auth — this is callable from any internal service.
  // Not user-facing; rate-limit at gateway if that changes.
  void prewarmInference(body.capability); // fire-and-forget
  return { ok: true };
});
```

Import `prewarmInference` at the top of `routes.ts`.

- [ ] **Step 3 — Wire sandbox-acquire to prewarm**

Grep for the sandbox creation/acquire route in `packages/api/src/sandbox/routes.ts`:

```bash
grep -n "POST.*sandbox\|acquire\|/projects/:id/sandbox" packages/api/src/sandbox/routes.ts | head -5
```

Find the handler (likely `POST /projects/:id/sandbox/acquire` or similar). After the sandbox session is successfully created but before returning the response, add a fire-and-forget prewarm:

```ts
import { prewarmInference } from '../inference/dispatcher.js';

// ... inside the sandbox-acquire handler, after sandbox session is created:
void prewarmInference('segment-speaker');
```

Don't await — the user should not wait on prewarm; they'll reach segmentation later in the pipeline.

- [ ] **Step 4 — Typecheck**

```bash
cd packages/api && pnpm typecheck
```

Expected: 0 new errors.

- [ ] **Step 5 — Manual integration test**

1. Start API locally: `pnpm -F @viona/api dev`.
2. Create a sandbox (via the usual flow or curl the acquire endpoint).
3. Watch RunPod dashboard — should see a worker initialize shortly after sandbox acquire.
4. Run `test-runpod-against-railway-bucket.ts` 2-5 min after sandbox acquire — should hit a warm worker with `delayTime < 5 s`.

- [ ] **Step 6 — Commit**

```bash
git add packages/api/src/inference/dispatcher.ts packages/api/src/inference/routes.ts packages/api/src/sandbox/routes.ts
git -c commit.gpgsign=false commit -m "feat(inference): prewarm dispatcher + route + sandbox-acquire wiring"
```

### Verification
- `POST /internal/inference/prewarm` returns `{ok:true}` immediately (< 100 ms).
- After an acquire, a RunPod worker appears in the dashboard within ~20 s.
- A real segmentation job dispatched 2-5 min after acquire completes with `delayTime < 5 s`.

---

## Execution order

Parallelizable:
- Task 1 (build image) + Task 3 (prewarm code) can run in parallel subagents.
- Task 2 must wait for Task 1's digest.

Suggested:
1. Kick Task 1 and Task 3 concurrently.
2. When Task 1 reports digest, do Task 2 inline (seconds).
3. Integration-smoke on the fully wired setup.

## Self-review

- **Spec coverage:** matches the three constraints the user stated: (a) cold start ≤ 5 min via smaller image, (b) cheaper GPU via AMPERE_16 primary, (c) warm hits via prewarm on acquire.
- **Fallback preserved:** ADA_24 remains in the pool so 4090 is available when A4000 is out — reliability unchanged.
- **No new idle cost:** `workersMin=0`, prewarm call fails fast, idleTimeout=300 still means worker dies eventually.
- **Rollback path:** each task's change is reversible via a single GraphQL mutation (digest pin, endpoint config) or git revert (prewarm code).

## What's NOT in this plan

- Replicate backend (separate future spec if needed).
- FlashBoot snapshot warming strategies (out of scope — RunPod handles it).
- Multi-region / multi-datacenter failover (single-region is fine at our volume).
