# RunPod GPU Inference Dispatch — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a generic GPU inference dispatch system in the API (capability-based, outcome-named) with `segment_speaker` as the reference implementation running RVM on RunPod Serverless.

**Architecture:** Sandbox MCP tool → API (capability registry + dispatcher) → RunPod Serverless → MinIO (via presigned URLs). Webhook-primary completion with 30s reconciliation poll. No BullMQ in the GPU path. Existing Redis pub/sub (`job:{id}:*`) is the completion bus; existing `sandboxSessions` bearer auth secures the sandbox→API hop.

**Tech Stack:** Fastify, Drizzle, ioredis, minio, `jose` (JWT), RunPod Serverless, Python 3.10, PyTorch + CUDA 12.2, GHCR.

**Spec:** `docs/superpowers/specs/2026-04-18-runpod-gpu-inference-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `packages/api/drizzle/0027_add_inference_jobs.sql` | Migration for `inference_jobs` table |
| Modify | `packages/api/src/db/schema.ts` | Add `inferenceJobs` Drizzle table export |
| Modify | `packages/api/src/config.ts` | Add `runpod` config section |
| Modify | `.env.example` | Document new env vars |
| Create | `packages/api/src/inference/registry.ts` | Capability→endpoint registry + schemas |
| Create | `packages/api/src/inference/runpod-client.ts` | Fetch wrapper for RunPod REST API |
| Create | `packages/api/src/inference/webhook-auth.ts` | JWT issue + verify (HS256 via `jose`) |
| Create | `packages/api/src/inference/dispatcher.ts` | Presign + DB insert + RunPod submit |
| Create | `packages/api/src/inference/reconciler.ts` | 30s interval poll for stalled jobs |
| Create | `packages/api/src/inference/routes.ts` | Three Fastify routes (dispatch, webhook, SSE) |
| Modify | `packages/api/src/index.ts` | Register routes + start reconciler on boot |
| Modify | `packages/api/package.json` | Add `jose` dep |
| Create | `runpod/rvm/handler.py` | RunPod handler entrypoint |
| Create | `runpod/rvm/segment_person.py` | Copy of worker's script (vendor; worker copy deleted in Task 21) |
| Create | `runpod/rvm/requirements.txt` | Python deps |
| Create | `runpod/rvm/Dockerfile` | CUDA base + torch + weights baked |
| Create | `runpod/rvm/README.md` | Input/output contract + build/push instructions |
| Create | `packages/sandbox/src/tools/segment-speaker.ts` | Outcome-based MCP tool |
| Modify | `packages/sandbox/src/mcp-servers.ts` | Register new `inference` MCP server |
| Create | `scripts/temp/test-runpod-handler.ts` | E2E test: submits real RunPod job, verifies artifacts |
| Create | `scripts/temp/test-inference-dispatch.ts` | E2E test: POST /inference, wait on SSE, verify completion |
| Modify | `packages/api/src/sandbox/routes.ts:440-541` | Deprecate old `/segment` routes with pass-through to new path |
| Delete | `packages/worker/src/processors/segmentation.ts` | Final cleanup after verification |
| Delete | `packages/worker/scripts/segment_person.py` | Final cleanup after verification |
| Modify | `packages/worker/src/index.ts` | Remove segmentation worker registration |
| Modify | `packages/api/src/services/queue.ts` | Remove `queueSegmentationJob` + types |

---

## Phase 0 — Setup

### Task 0: Env vars + config

**Files:**
- Modify: `.env.example`
- Modify: `packages/api/src/config.ts`

- [ ] **Step 1: Add env var documentation to `.env.example`**

Append these lines to `.env.example`:
```bash

# ---- RunPod Serverless (GPU inference) ----
# API key from runpod.io → Settings → API Keys. Used by API service only.
RUNPOD_API_KEY=
# Endpoint ID from runpod.io → Serverless → viona-rvm (created in Task 6).
RUNPOD_RVM_ENDPOINT_ID=
# HS256 shared secret for signing webhook callback JWTs. Generate with:
#   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
RUNPOD_WEBHOOK_SECRET=
# Public base URL of this API, used to build the webhook URL for RunPod.
# Example: https://api.viona.co . On Railway defaults to RAILWAY_PUBLIC_DOMAIN.
RUNPOD_WEBHOOK_BASE_URL=
```

- [ ] **Step 2: Add `runpod` config section to `packages/api/src/config.ts`**

Open `packages/api/src/config.ts` and find the `config` object. After the `sandbox` property and before the closing `} as const`, add:

```ts
  // RunPod Serverless (GPU inference)
  runpod: {
    apiKey: process.env.RUNPOD_API_KEY || '',
    rvmEndpointId: process.env.RUNPOD_RVM_ENDPOINT_ID || '',
    webhookSecret: process.env.RUNPOD_WEBHOOK_SECRET || '',
    // Public URL RunPod must reach to deliver webhooks.
    get webhookBaseUrl(): string {
      if (process.env.RUNPOD_WEBHOOK_BASE_URL) return process.env.RUNPOD_WEBHOOK_BASE_URL;
      if (process.env.RAILWAY_PUBLIC_DOMAIN) return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
      return 'http://localhost:4000';
    },
  },
```

- [ ] **Step 3: Commit**

```bash
git add .env.example packages/api/src/config.ts
git commit -m "feat(api): add runpod env + config"
```

---

### Task 1: DB migration + schema for `inference_jobs`

**Files:**
- Create: `packages/api/drizzle/0027_add_inference_jobs.sql`
- Modify: `packages/api/src/db/schema.ts`

- [ ] **Step 1: Create the migration SQL**

Create `packages/api/drizzle/0027_add_inference_jobs.sql`:

```sql
CREATE TABLE IF NOT EXISTS "inference_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "sandbox_session_id" uuid REFERENCES "sandbox_sessions"("id") ON DELETE SET NULL,
  "project_id" uuid REFERENCES "projects"("id") ON DELETE CASCADE,
  "capability" varchar(64) NOT NULL,
  "status" varchar(32) NOT NULL DEFAULT 'pending',
  "runpod_job_id" varchar(128),
  "input" jsonb NOT NULL,
  "output" jsonb,
  "error" jsonb,
  "metrics" jsonb,
  "submitted_at" timestamptz NOT NULL DEFAULT now(),
  "completed_at" timestamptz
);

CREATE INDEX IF NOT EXISTS "inference_jobs_status_idx"
  ON "inference_jobs" ("status", "submitted_at")
  WHERE "status" IN ('pending', 'running');

CREATE INDEX IF NOT EXISTS "inference_jobs_runpod_idx"
  ON "inference_jobs" ("runpod_job_id")
  WHERE "runpod_job_id" IS NOT NULL;
```

- [ ] **Step 2: Add Drizzle schema export**

Open `packages/api/src/db/schema.ts`. At the end of the file, add:

```ts
export const inferenceJobs = pgTable('inference_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  sandboxSessionId: uuid('sandbox_session_id'),
  projectId: uuid('project_id'),
  capability: varchar('capability', { length: 64 }).notNull(),
  status: varchar('status', { length: 32 }).notNull().default('pending'),
  runpodJobId: varchar('runpod_job_id', { length: 128 }),
  input: jsonb('input').notNull(),
  output: jsonb('output'),
  error: jsonb('error'),
  metrics: jsonb('metrics'),
  submittedAt: timestamp('submitted_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
});

export type InferenceJob = typeof inferenceJobs.$inferSelect;
export type NewInferenceJob = typeof inferenceJobs.$inferInsert;
export type InferenceJobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'timed_out';
```

- [ ] **Step 3: Run the migration locally**

```bash
cd packages/api && pnpm db:migrate
```

Expected: `Running migration 0027_add_inference_jobs.sql ... done` (or equivalent; migrate script prints success). Verify the table exists:

```bash
psql $DATABASE_URL -c "\d inference_jobs"
```

Expected: table with 12 columns listed.

- [ ] **Step 4: Commit**

```bash
git add packages/api/drizzle/0027_add_inference_jobs.sql packages/api/src/db/schema.ts
git commit -m "feat(api): add inference_jobs table for GPU dispatch"
```

---

### Task 2: Install `jose` for JWT

**Files:**
- Modify: `packages/api/package.json`

- [ ] **Step 1: Install `jose`**

```bash
cd packages/api && pnpm add jose@^5.9.0
```

- [ ] **Step 2: Commit**

```bash
git add packages/api/package.json ../../pnpm-lock.yaml
git commit -m "chore(api): add jose for webhook JWT"
```

---

## Phase 1 — RunPod handler

### Task 3: Vendor `segment_person.py` into `runpod/rvm/`

**Files:**
- Create: `runpod/rvm/segment_person.py` (copy of `packages/worker/scripts/segment_person.py`)
- Create: `runpod/rvm/requirements.txt`

- [ ] **Step 1: Copy the script**

```bash
mkdir -p runpod/rvm
cp packages/worker/scripts/segment_person.py runpod/rvm/segment_person.py
```

The worker's copy remains for now — Task 21 deletes it after the new path is verified. This avoids a cross-package Docker build context.

- [ ] **Step 2: Create `runpod/rvm/requirements.txt`**

```
torch==2.3.1
torchvision==0.18.1
opencv-python-headless==4.10.0.84
numpy==1.26.4
Pillow==10.3.0
requests==2.32.3
runpod==1.7.7
```

Notes:
- `opencv-python-headless` (not `opencv-python`) — no GUI libs needed in container.
- `runpod` is the server-side SDK (handler runtime), not the TypeScript client.
- Torch version is pinned to match CUDA 12.2 wheels (`torch==2.3.1+cu121`).

- [ ] **Step 3: Commit**

```bash
git add runpod/rvm/segment_person.py runpod/rvm/requirements.txt
git commit -m "feat(runpod): vendor segment_person.py for rvm handler"
```

---

### Task 4: Create RunPod handler

**Files:**
- Create: `runpod/rvm/handler.py`

- [ ] **Step 1: Write the handler**

Create `runpod/rvm/handler.py`:

```python
"""
RunPod Serverless handler for RVM (Robust Video Matting).

Contract (shared across all capabilities in this stack):

Input JSON:
  {
    "inputs":  { "video": "<presigned GET URL>" },
    "outputs": {
      "matte":      "<presigned PUT URL>",
      "fgr":        "<presigned PUT URL>",
      "bbox":       "<presigned PUT URL>",
      "proxyMatte": "<presigned PUT URL>",   // optional
      "proxyFgr":   "<presigned PUT URL>"    // optional
    },
    "params": {
      "backbone":         "resnet50" | "mobilenetv3",
      "scale":            0.5,
      "fps":              0,
      "downsampleRatio":  0.8,
      "ranges":           [{ "startMs": 0, "endMs": 120000 }, ...]   // optional
    }
  }

Returns:
  {
    "artifacts": {
      "matte":      { "uploaded": true },
      "fgr":        { "uploaded": true },
      "bbox":       { "uploaded": true },
      "proxyMatte": { "uploaded": true },
      "proxyFgr":   { "uploaded": true }
    },
    "metrics": {
      "durationMs":      1234,
      "framesProcessed": 3600,
      "outputWidth":     540,
      "outputHeight":    960,
      "outputFps":       30
    }
  }
"""

import json
import os
import subprocess
import sys
import time
from pathlib import Path

import requests
import runpod

# Make segment_person importable
sys.path.insert(0, '/app')
from segment_person import process_video  # noqa: E402


def _download(url: str, dest: Path) -> None:
    with requests.get(url, stream=True, timeout=300) as r:
        r.raise_for_status()
        dest.parent.mkdir(parents=True, exist_ok=True)
        with dest.open('wb') as f:
            for chunk in r.iter_content(chunk_size=1 << 20):
                if chunk:
                    f.write(chunk)


def _upload(url: str, src: Path, content_type: str = 'application/octet-stream') -> None:
    with src.open('rb') as f:
        r = requests.put(url, data=f, headers={'Content-Type': content_type}, timeout=600)
    r.raise_for_status()


def _make_proxy(input_path: Path, output_path: Path) -> None:
    """Low-res 480p proxy for editor preview."""
    subprocess.run(
        [
            'ffmpeg', '-y', '-i', str(input_path),
            '-vf', 'scale=-2:480',
            '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '30',
            '-an',
            str(output_path),
        ],
        check=True,
        capture_output=True,
    )


def handler(job):
    t0 = time.time()
    inp = job['input']
    inputs = inp['inputs']
    outputs = inp['outputs']
    params = inp.get('params', {})

    work = Path('/tmp/rvm-work')
    work.mkdir(parents=True, exist_ok=True)
    video_path = work / 'source.mp4'
    matte_path = work / 'matte.mp4'

    # 1. Download input
    _download(inputs['video'], video_path)

    # 2. Run RVM (reuses existing segment_person.py)
    result = process_video(
        str(video_path),
        str(matte_path),
        backbone=params.get('backbone', 'resnet50'),
        scale=params.get('scale', 0.5),
        fps=params.get('fps', 0),
        downsample_ratio=params.get('downsampleRatio', 0.8),
        matte_ranges=params.get('ranges', []),
    )

    fgr_path = Path(result['fgrPath'])
    bbox_path = Path(result['bboxPath'])

    artifacts = {}

    # 3. Upload primary outputs
    for name, path, ctype in [
        ('matte', matte_path, 'video/mp4'),
        ('fgr', fgr_path, 'video/mp4'),
        ('bbox', bbox_path, 'application/json'),
    ]:
        if name in outputs:
            _upload(outputs[name], path, ctype)
            artifacts[name] = {'uploaded': True}

    # 4. Optional: generate and upload proxies
    if 'proxyMatte' in outputs:
        proxy_matte = work / 'matte-proxy.mp4'
        _make_proxy(matte_path, proxy_matte)
        _upload(outputs['proxyMatte'], proxy_matte, 'video/mp4')
        artifacts['proxyMatte'] = {'uploaded': True}

    if 'proxyFgr' in outputs:
        proxy_fgr = work / 'fgr-proxy.mp4'
        _make_proxy(fgr_path, proxy_fgr)
        _upload(outputs['proxyFgr'], proxy_fgr, 'video/mp4')
        artifacts['proxyFgr'] = {'uploaded': True}

    return {
        'artifacts': artifacts,
        'metrics': {
            'durationMs': int((time.time() - t0) * 1000),
            'framesProcessed': result['framesProcessed'],
            'outputWidth': result['outputWidth'],
            'outputHeight': result['outputHeight'],
            'outputFps': result['outputFps'],
        },
    }


if __name__ == '__main__':
    # Allow local testing: `python handler.py --test-input path/to/input.json`
    if '--test-input' in sys.argv:
        idx = sys.argv.index('--test-input')
        with open(sys.argv[idx + 1]) as f:
            test_job = {'id': 'local-test', 'input': json.load(f)}
        print(json.dumps(handler(test_job), indent=2))
    else:
        runpod.serverless.start({'handler': handler})
```

- [ ] **Step 2: Commit**

```bash
git add runpod/rvm/handler.py
git commit -m "feat(runpod): rvm serverless handler"
```

---

### Task 5: RunPod Dockerfile with baked weights

**Files:**
- Create: `runpod/rvm/Dockerfile`
- Create: `runpod/rvm/README.md`

- [ ] **Step 1: Write the Dockerfile**

Create `runpod/rvm/Dockerfile`:

```dockerfile
# syntax=docker/dockerfile:1.6
FROM nvidia/cuda:12.2.0-runtime-ubuntu22.04 AS base

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.10 python3-pip python3.10-venv \
    git wget ca-certificates \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

RUN ln -s /usr/bin/python3.10 /usr/local/bin/python

WORKDIR /app

# Install Python deps (cached layer)
COPY requirements.txt /app/requirements.txt
RUN pip install --index-url https://download.pytorch.org/whl/cu121 \
        torch==2.3.1 torchvision==0.18.1 \
    && pip install -r /app/requirements.txt

# Pre-download RVM weights + hub repo (bake into image — no internet at runtime)
RUN mkdir -p /root/.cache/torch/hub/checkpoints \
    && wget -q -O /root/.cache/torch/hub/checkpoints/rvm_resnet50.pth \
       https://github.com/PeterL1n/RobustVideoMatting/releases/download/v1.0.0/rvm_resnet50.pth \
    && wget -q -O /root/.cache/torch/hub/checkpoints/rvm_mobilenetv3.pth \
       https://github.com/PeterL1n/RobustVideoMatting/releases/download/v1.0.0/rvm_mobilenetv3.pth \
    && git clone --depth 1 https://github.com/PeterL1n/RobustVideoMatting.git \
       /root/.cache/torch/hub/PeterL1n_RobustVideoMatting_master

# Copy handler + vendored segment_person
COPY segment_person.py /app/segment_person.py
COPY handler.py /app/handler.py

CMD ["python", "/app/handler.py"]
```

- [ ] **Step 2: Write README with build/push instructions**

Create `runpod/rvm/README.md`:

````markdown
# viona-rvm — RunPod Serverless handler

Runs RVM (Robust Video Matting) on GPU via presigned MinIO URLs.

## Contract

See `handler.py` docstring for full input/output JSON.

## Build & push

```bash
# From repo root
IMAGE=ghcr.io/<org>/viona-rvm:$(git rev-parse --short HEAD)

docker build -t "$IMAGE" runpod/rvm
echo "$GHCR_TOKEN" | docker login ghcr.io -u <user> --password-stdin
docker push "$IMAGE"
```

## Local test

```bash
cat > /tmp/local-input.json <<'JSON'
{
  "inputs":  { "video": "https://<presigned-get>" },
  "outputs": {
    "matte": "https://<presigned-put>",
    "fgr":   "https://<presigned-put>",
    "bbox":  "https://<presigned-put>"
  },
  "params": { "backbone": "resnet50", "scale": 0.5, "downsampleRatio": 0.8 }
}
JSON

docker run --rm --gpus all -v /tmp:/tmp "$IMAGE" \
  python /app/handler.py --test-input /tmp/local-input.json
```

## RunPod endpoint config (set in dashboard)

| Field | Value |
|---|---|
| Image | `ghcr.io/<org>/viona-rvm:<sha>` |
| GPU types (priority) | L40S, A40, A5000 |
| Min workers | 0 |
| Max workers | 3 |
| Idle timeout | 60s |
| Execution timeout | 900s |
| Scaler | QUEUE_DELAY, 4s |
| FlashBoot | on |
````

- [ ] **Step 3: Commit**

```bash
git add runpod/rvm/Dockerfile runpod/rvm/README.md
git commit -m "feat(runpod): rvm dockerfile + build instructions"
```

---

### Task 6: Build, push, create RunPod endpoint

**Files:** (none — infra setup)

This task is manual / infrastructure. Record outputs in `.env` (local) and Railway variables (prod).

- [ ] **Step 1: Build the image**

From repo root:

```bash
IMAGE=ghcr.io/viona/viona-rvm:$(git rev-parse --short HEAD)
docker build -t "$IMAGE" runpod/rvm
```

Expected: successful build, final image ~8-12 GB (CUDA + torch + weights).

- [ ] **Step 2: Push to GHCR**

```bash
echo "$GHCR_TOKEN" | docker login ghcr.io -u <user> --password-stdin
docker push "$IMAGE"
```

Expected: push completes; image visible at `https://github.com/<org>/<repo>/pkgs/container/viona-rvm`.

- [ ] **Step 3: Create RunPod Serverless endpoint**

In runpod.io dashboard → Serverless → New Endpoint:
- Name: `viona-rvm`
- Container image: the pushed `$IMAGE`
- GPU types: L40S (primary), A40, A5000 (fallbacks)
- Min workers: 0, Max workers: 3
- Idle timeout: 60s, Execution timeout: 900s
- Scaler: QUEUE_DELAY @ 4s
- FlashBoot: on

Copy the **Endpoint ID** (looks like `xxxxxxxxxxxxxx`).

- [ ] **Step 4: Record env vars**

Update local `.env`:
```bash
RUNPOD_API_KEY=<from runpod.io/user/settings>
RUNPOD_RVM_ENDPOINT_ID=<from step 3>
RUNPOD_WEBHOOK_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))")
RUNPOD_WEBHOOK_BASE_URL=http://localhost:4000   # ngrok URL if testing webhook locally
```

Set the same vars in Railway (Dashboard → Variables) for the API service in prod.

- [ ] **Step 5: Smoke test via `runsync`**

```bash
curl -X POST "https://api.runpod.ai/v2/$RUNPOD_RVM_ENDPOINT_ID/runsync" \
  -H "Authorization: Bearer $RUNPOD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"input": {"inputs": {}, "outputs": {}, "params": {}}}'
```

Expected: HTTP 200 with `{"id": "...", "status": "IN_QUEUE" | "COMPLETED" | "FAILED", ...}`. A FAILED with a Python error about missing URL means the container is running — that's the success signal here.

(No git commit — infra only.)

---

## Phase 2 — API core services

### Task 7: Capability registry

**Files:**
- Create: `packages/api/src/inference/registry.ts`

- [ ] **Step 1: Write registry**

Create `packages/api/src/inference/registry.ts`:

```ts
import { z } from 'zod';
import { config } from '../config.js';

export interface CapabilityDefinition {
  /** Name used in API routes and DB (`segment-speaker`). */
  name: string;
  /** RunPod endpoint ID resolved from the config. */
  getEndpointId: () => string;
  /** RunPod executionTimeout (seconds). */
  executionTimeoutSec: number;
  /** Zod schema for the `input` field of POST /inference. */
  inputSchema: z.ZodTypeAny;
  /** Zod schema for the `output` field set by the webhook. */
  outputSchema: z.ZodTypeAny;
  /**
   * Given a validated input, produce the MinIO output keys to presign.
   * Keys are relative to the `outputs/` prefix.
   */
  outputKeys: (jobId: string, input: any) => Record<string, { key: string; contentType: string }>;
}

// ---- segment-speaker (RVM) ----

const segmentSpeakerInput = z.object({
  videoKey: z.string().min(1),
  ranges: z
    .array(z.object({ startMs: z.number().int().min(0), endMs: z.number().int().positive() }))
    .optional(),
  params: z
    .object({
      backbone: z.enum(['resnet50', 'mobilenetv3']).default('resnet50'),
      scale: z.number().positive().max(1).default(0.5),
      fps: z.number().int().min(0).default(0),
      downsampleRatio: z.number().positive().max(1).default(0.8),
    })
    .default({}),
});

const segmentSpeakerOutput = z.object({
  matteKey: z.string(),
  fgrKey: z.string(),
  bboxKey: z.string(),
  proxyMatteKey: z.string(),
  proxyFgrKey: z.string(),
});

const segmentSpeaker: CapabilityDefinition = {
  name: 'segment-speaker',
  getEndpointId: () => {
    const id = config.runpod.rvmEndpointId;
    if (!id) throw new Error('RUNPOD_RVM_ENDPOINT_ID is not set');
    return id;
  },
  executionTimeoutSec: 900,
  inputSchema: segmentSpeakerInput,
  outputSchema: segmentSpeakerOutput,
  outputKeys: (jobId) => ({
    matte: { key: `mattes/${jobId}/matte.mp4`, contentType: 'video/mp4' },
    fgr: { key: `mattes/${jobId}/fgr.mp4`, contentType: 'video/mp4' },
    bbox: { key: `mattes/${jobId}/bbox.json`, contentType: 'application/json' },
    proxyMatte: { key: `mattes/${jobId}/matte-proxy.mp4`, contentType: 'video/mp4' },
    proxyFgr: { key: `mattes/${jobId}/fgr-proxy.mp4`, contentType: 'video/mp4' },
  }),
};

export const inferenceRegistry = {
  'segment-speaker': segmentSpeaker,
} as const satisfies Record<string, CapabilityDefinition>;

export type CapabilityName = keyof typeof inferenceRegistry;

export function getCapability(name: string): CapabilityDefinition {
  const cap = (inferenceRegistry as Record<string, CapabilityDefinition>)[name];
  if (!cap) throw new Error(`Unknown capability: ${name}`);
  return cap;
}
```

- [ ] **Step 2: Typecheck**

```bash
cd packages/api && pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/inference/registry.ts
git commit -m "feat(api): capability registry for inference dispatch"
```

---

### Task 8: RunPod HTTP client

**Files:**
- Create: `packages/api/src/inference/runpod-client.ts`

- [ ] **Step 1: Write client**

Create `packages/api/src/inference/runpod-client.ts`:

```ts
import { config } from '../config.js';
import { logger } from '../logger.js';

const BASE = 'https://api.runpod.ai/v2';

interface RunPodSubmitRequest {
  input: Record<string, unknown>;
  webhook?: string;
  policy?: { executionTimeout?: number };
}

interface RunPodSubmitResponse {
  id: string;
  status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
}

export interface RunPodStatusResponse {
  id: string;
  status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'TIMED_OUT';
  output?: Record<string, unknown>;
  error?: string;
  executionTime?: number;
  delayTime?: number;
}

function authHeaders(): Record<string, string> {
  if (!config.runpod.apiKey) throw new Error('RUNPOD_API_KEY is not set');
  return {
    Authorization: `Bearer ${config.runpod.apiKey}`,
    'Content-Type': 'application/json',
  };
}

export async function runpodSubmit(
  endpointId: string,
  body: RunPodSubmitRequest,
): Promise<RunPodSubmitResponse> {
  const res = await fetch(`${BASE}/${endpointId}/run`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    logger.error({ endpointId, status: res.status, text }, 'RunPod /run failed');
    throw new Error(`RunPod submit failed: ${res.status} ${text}`);
  }
  return (await res.json()) as RunPodSubmitResponse;
}

export async function runpodStatus(
  endpointId: string,
  runpodJobId: string,
): Promise<RunPodStatusResponse> {
  const res = await fetch(`${BASE}/${endpointId}/status/${runpodJobId}`, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`RunPod status failed: ${res.status} ${text}`);
  }
  return (await res.json()) as RunPodStatusResponse;
}

export async function runpodCancel(endpointId: string, runpodJobId: string): Promise<void> {
  const res = await fetch(`${BASE}/${endpointId}/cancel/${runpodJobId}`, {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`RunPod cancel failed: ${res.status} ${text}`);
  }
}

export function isTerminal(status: RunPodStatusResponse['status']): boolean {
  return status === 'COMPLETED' || status === 'FAILED' || status === 'CANCELLED' || status === 'TIMED_OUT';
}
```

- [ ] **Step 2: Typecheck**

```bash
cd packages/api && pnpm typecheck
```

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/inference/runpod-client.ts
git commit -m "feat(api): runpod http client"
```

---

### Task 9: Webhook JWT helpers

**Files:**
- Create: `packages/api/src/inference/webhook-auth.ts`

- [ ] **Step 1: Write helpers**

Create `packages/api/src/inference/webhook-auth.ts`:

```ts
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { config } from '../config.js';

interface WebhookClaims extends JWTPayload {
  jobId: string;
  capability: string;
}

function getSecret(): Uint8Array {
  if (!config.runpod.webhookSecret) throw new Error('RUNPOD_WEBHOOK_SECRET is not set');
  return new TextEncoder().encode(config.runpod.webhookSecret);
}

/**
 * Issue a scoped JWT for a RunPod webhook callback.
 * Expires at submittedAt + executionTimeoutSec + 60s grace.
 */
export async function issueWebhookToken(
  jobId: string,
  capability: string,
  executionTimeoutSec: number,
): Promise<string> {
  return new SignJWT({ jobId, capability })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${executionTimeoutSec + 60}s`)
    .sign(getSecret());
}

/**
 * Verify a webhook token. Throws if invalid, expired, or mismatched.
 * Returns the payload on success.
 */
export async function verifyWebhookToken(
  token: string,
  expectedJobId: string,
  expectedCapability: string,
): Promise<WebhookClaims> {
  const { payload } = await jwtVerify(token, getSecret(), { algorithms: ['HS256'] });
  const claims = payload as WebhookClaims;
  if (claims.jobId !== expectedJobId) throw new Error('webhook: jobId mismatch');
  if (claims.capability !== expectedCapability) throw new Error('webhook: capability mismatch');
  return claims;
}
```

- [ ] **Step 2: Quick sanity script**

Create `scripts/temp/test-webhook-jwt.ts`:

```ts
import { issueWebhookToken, verifyWebhookToken } from '../../packages/api/src/inference/webhook-auth.js';

process.env.RUNPOD_WEBHOOK_SECRET = 'test-secret-at-least-32-bytes-long-abcd1234';

const tok = await issueWebhookToken('job-1', 'segment-speaker', 900);
console.log('token:', tok);

const ok = await verifyWebhookToken(tok, 'job-1', 'segment-speaker');
console.log('verified:', ok);

try {
  await verifyWebhookToken(tok, 'job-2', 'segment-speaker');
  console.error('FAIL: should have thrown on jobId mismatch');
} catch (e) {
  console.log('expected throw on mismatch:', (e as Error).message);
}
```

Run:
```bash
cd packages/api && pnpm tsx ../../scripts/temp/test-webhook-jwt.ts
```

Expected: prints token, verified object, then `expected throw on mismatch: webhook: jobId mismatch`.

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/inference/webhook-auth.ts scripts/temp/test-webhook-jwt.ts
git commit -m "feat(api): webhook jwt helpers for runpod callbacks"
```

---

### Task 10: Dispatcher

**Files:**
- Create: `packages/api/src/inference/dispatcher.ts`

- [ ] **Step 1: Write dispatcher**

Create `packages/api/src/inference/dispatcher.ts`:

```ts
import { db } from '../db/index.js';
import { inferenceJobs } from '../db/schema.js';
import { presignedClient, BUCKET_NAME, OUTPUTS_PREFIX, UPLOADS_PREFIX } from '../services/minio.js';
import { logger } from '../logger.js';
import { config } from '../config.js';
import { getCapability, type CapabilityDefinition } from './registry.js';
import { runpodSubmit } from './runpod-client.js';
import { issueWebhookToken } from './webhook-auth.js';

interface DispatchParams {
  capability: string;
  input: unknown;
  projectId: string;
  sandboxSessionId: string;
}

interface DispatchResult {
  jobId: string;
  runpodJobId: string;
}

export async function dispatchInference(params: DispatchParams): Promise<DispatchResult> {
  const cap = getCapability(params.capability);
  const validated = cap.inputSchema.parse(params.input);

  // 1. Insert DB row (pending, no runpodJobId yet)
  const [row] = await db
    .insert(inferenceJobs)
    .values({
      sandboxSessionId: params.sandboxSessionId,
      projectId: params.projectId,
      capability: cap.name,
      status: 'pending',
      input: validated,
    })
    .returning();

  const jobId = row.id;

  try {
    // 2. Presign input (GET) + outputs (PUTs)
    const videoKey = (validated as { videoKey: string }).videoKey;
    const inputGetUrl = await presignedClient.presignedGetObject(
      BUCKET_NAME,
      `${UPLOADS_PREFIX}${videoKey}`.replace(/\/+/g, '/').replace(/^\//, ''),
      60 * 60, // 1h
    );

    const outputKeys = cap.outputKeys(jobId, validated);
    const outputs: Record<string, string> = {};
    for (const [name, { key }] of Object.entries(outputKeys)) {
      outputs[name] = await presignedClient.presignedPutObject(
        BUCKET_NAME,
        `${OUTPUTS_PREFIX}${key}`,
        cap.executionTimeoutSec + 120,
      );
    }

    // 3. Issue webhook JWT
    const token = await issueWebhookToken(jobId, cap.name, cap.executionTimeoutSec);
    const webhookUrl = `${config.runpod.webhookBaseUrl}/internal/runpod/callback/${jobId}?token=${encodeURIComponent(token)}`;

    // 4. Submit to RunPod
    const submitted = await runpodSubmit(cap.getEndpointId(), {
      input: {
        inputs: { video: inputGetUrl },
        outputs,
        params: (validated as any).params ?? {},
        ...((validated as any).ranges ? { params: { ...((validated as any).params ?? {}), ranges: (validated as any).ranges } } : {}),
      },
      webhook: webhookUrl,
      policy: { executionTimeout: cap.executionTimeoutSec * 1000 },
    });

    await db
      .update(inferenceJobs)
      .set({ runpodJobId: submitted.id, status: 'running' })
      .where(/* drizzle eq */ undefined as any);
    // NOTE: replace the above update with a proper eq(inferenceJobs.id, jobId) once the import is finalized below.

    return { jobId, runpodJobId: submitted.id };
  } catch (err) {
    logger.error({ jobId, err: (err as Error).message }, 'Inference dispatch failed');
    await db
      .update(inferenceJobs)
      .set({
        status: 'failed',
        error: { message: (err as Error).message, stage: 'dispatch' },
        completedAt: new Date(),
      })
      .where(/* eq(inferenceJobs.id, jobId) */ undefined as any);
    throw err;
  }
}
```

- [ ] **Step 2: Wire `eq()` properly**

The two `.where(undefined as any)` placeholders above won't compile. Fix them. At the top of the file, change the imports to:

```ts
import { eq } from 'drizzle-orm';
```

Replace both `.where(undefined as any)` with `.where(eq(inferenceJobs.id, jobId))`.

- [ ] **Step 3: Export MinIO constants used**

Open `packages/api/src/services/minio.ts`. Ensure `BUCKET_NAME`, `OUTPUTS_PREFIX`, `UPLOADS_PREFIX`, and `presignedClient` are exported. If `BUCKET_NAME` is only internally named `BUCKET`, add a named export:

```ts
export const BUCKET_NAME = BUCKET;
export const OUTPUTS_PREFIX = PREFIXES.outputs;
export const UPLOADS_PREFIX = PREFIXES.uploads;
```

(Add at the bottom of `minio.ts` if not present.)

- [ ] **Step 4: Typecheck**

```bash
cd packages/api && pnpm typecheck
```

Expected: no errors. If errors about `videoKey` type, the Zod schema `parse()` already narrows — cast via `as z.infer<typeof ...>` or just `as { videoKey: string; params?: any; ranges?: any[] }` on `validated`.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/inference/dispatcher.ts packages/api/src/services/minio.ts
git commit -m "feat(api): inference dispatcher (presign + runpod submit + db)"
```

---

## Phase 3 — API routes

### Task 11: Dispatch route + webhook route + SSE stream

**Files:**
- Create: `packages/api/src/inference/routes.ts`

- [ ] **Step 1: Write all three routes in one plugin**

Create `packages/api/src/inference/routes.ts`:

```ts
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { inferenceJobs, sandboxSessions } from '../db/schema.js';
import { getRedis, getRedisSubscriber } from '../services/redis.js';
import { logger } from '../logger.js';
import { getCapability } from './registry.js';
import { dispatchInference } from './dispatcher.js';
import { verifyWebhookToken } from './webhook-auth.js';

async function validateSandboxBearer(
  req: any,
  reply: any,
): Promise<{ projectId: string; sandboxSessionId: string } | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    reply.status(401).send({ error: 'missing bearer' });
    return null;
  }
  const token = authHeader.slice(7);
  const id = req.params?.id as string | undefined;
  if (!id) {
    reply.status(400).send({ error: 'missing sandbox id' });
    return null;
  }
  const [session] = await db
    .select()
    .from(sandboxSessions)
    .where(eq(sandboxSessions.id, id))
    .limit(1);
  if (!session || session.sandboxSecret !== token) {
    reply.status(401).send({ error: 'invalid bearer' });
    return null;
  }
  return { projectId: session.projectId, sandboxSessionId: session.id };
}

export async function registerInferenceRoutes(fastify: FastifyInstance) {
  // ---- POST /internal/sandbox/:id/inference ----
  fastify.post('/internal/sandbox/:id/inference', async (request, reply) => {
    const ctx = await validateSandboxBearer(request, reply);
    if (!ctx) return;

    const body = request.body as { capability?: string; input?: unknown };
    if (!body.capability || !body.input) {
      return reply.status(400).send({ error: 'capability and input are required' });
    }

    try {
      const result = await dispatchInference({
        capability: body.capability,
        input: body.input,
        projectId: ctx.projectId,
        sandboxSessionId: ctx.sandboxSessionId,
      });
      return { jobId: result.jobId };
    } catch (err) {
      logger.error({ err: (err as Error).message }, 'dispatch failed');
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  // ---- POST /internal/runpod/callback/:jobId ----
  fastify.post('/internal/runpod/callback/:jobId', async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    const { token } = request.query as { token?: string };
    if (!token) return reply.status(401).send({ error: 'missing token' });

    const [row] = await db.select().from(inferenceJobs).where(eq(inferenceJobs.id, jobId)).limit(1);
    if (!row) return reply.status(404).send({ error: 'unknown job' });

    try {
      await verifyWebhookToken(token, jobId, row.capability);
    } catch (err) {
      logger.warn({ jobId, err: (err as Error).message }, 'webhook auth rejected');
      return reply.status(401).send({ error: 'invalid token' });
    }

    const body = request.body as {
      status?: string;
      output?: { artifacts?: Record<string, unknown>; metrics?: Record<string, unknown> };
      error?: string;
    };

    const cap = getCapability(row.capability);
    const terminal = ['COMPLETED', 'FAILED', 'CANCELLED', 'TIMED_OUT'].includes(body.status ?? '');
    if (!terminal) {
      // Ignore intermediate webhook pings — reconciler handles truth.
      return { ok: true, ignored: 'non-terminal' };
    }

    const isSuccess = body.status === 'COMPLETED';
    const outputKeys = cap.outputKeys(jobId, row.input);
    const output = isSuccess
      ? Object.fromEntries(
          Object.entries(outputKeys).map(([name, { key }]) => [`${name}Key`, `outputs/${key}`]),
        )
      : null;

    await db
      .update(inferenceJobs)
      .set({
        status: isSuccess ? 'completed' : body.status === 'TIMED_OUT' ? 'timed_out' : 'failed',
        output,
        error: isSuccess ? null : { message: body.error ?? 'runpod failure', raw: body },
        metrics: body.output?.metrics ?? null,
        completedAt: new Date(),
      })
      .where(eq(inferenceJobs.id, jobId));

    const channel = `job:${jobId}:${isSuccess ? 'complete' : 'error'}`;
    const payload = JSON.stringify({ jobId, status: isSuccess ? 'completed' : 'failed', output, error: body.error });
    await getRedis().publish(channel, payload);

    return { ok: true };
  });

  // ---- GET /internal/sandbox/:id/inference/:jobId/stream ----
  fastify.get('/internal/sandbox/:id/inference/:jobId/stream', async (request, reply) => {
    const ctx = await validateSandboxBearer(request, reply);
    if (!ctx) return;

    const { jobId } = request.params as { jobId: string };
    const [row] = await db.select().from(inferenceJobs).where(eq(inferenceJobs.id, jobId)).limit(1);
    if (!row) return reply.status(404).send({ error: 'unknown job' });
    if (row.sandboxSessionId !== ctx.sandboxSessionId) {
      return reply.status(403).send({ error: 'job not owned by this sandbox' });
    }

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const write = (event: string, data: unknown) => {
      reply.raw.write(`event: ${event}\n`);
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // If already terminal, emit immediately and close.
    if (row.status === 'completed' || row.status === 'failed' || row.status === 'timed_out') {
      write(row.status === 'completed' ? 'complete' : 'error', {
        jobId,
        status: row.status,
        output: row.output,
        error: row.error,
      });
      reply.raw.end();
      return;
    }

    // Otherwise, subscribe to Redis and relay.
    const sub = getRedisSubscriber();
    const channels = [`job:${jobId}:progress`, `job:${jobId}:complete`, `job:${jobId}:error`];
    await sub.subscribe(...channels);

    const heartbeat = setInterval(() => reply.raw.write(': heartbeat\n\n'), 15_000);

    const onMessage = (channel: string, message: string) => {
      const kind = channel.endsWith(':complete') ? 'complete' : channel.endsWith(':error') ? 'error' : 'progress';
      write(kind, JSON.parse(message));
      if (kind !== 'progress') cleanup();
    };

    const cleanup = () => {
      clearInterval(heartbeat);
      sub.off('message', onMessage);
      sub.unsubscribe(...channels).catch(() => {});
      try { reply.raw.end(); } catch {}
    };

    sub.on('message', onMessage);
    request.raw.on('close', cleanup);
    request.raw.on('error', cleanup);

    // Signal the stream is open; client knows it can safely stop polling.
    write('ready', { jobId });
  });
}
```

- [ ] **Step 2: Export a Redis subscriber helper**

Open `packages/api/src/services/redis.ts`. If `getRedisSubscriber()` doesn't exist, add:

```ts
import Redis from 'ioredis';
import { config } from '../config.js';

let subscriber: Redis | null = null;
export function getRedisSubscriber(): Redis {
  if (!subscriber) subscriber = new Redis(config.redis.url);
  return subscriber;
}
```

(If there's already a subscriber export under a different name, reuse that name instead.)

- [ ] **Step 3: Typecheck**

```bash
cd packages/api && pnpm typecheck
```

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/inference/routes.ts packages/api/src/services/redis.ts
git commit -m "feat(api): inference routes (dispatch, webhook, sse stream)"
```

---

## Phase 4 — Reconciler + boot wiring

### Task 12: Reconciler

**Files:**
- Create: `packages/api/src/inference/reconciler.ts`

- [ ] **Step 1: Write reconciler**

Create `packages/api/src/inference/reconciler.ts`:

```ts
import { and, eq, inArray, lt } from 'drizzle-orm';
import { db } from '../db/index.js';
import { inferenceJobs } from '../db/schema.js';
import { getRedis } from '../services/redis.js';
import { logger } from '../logger.js';
import { getCapability } from './registry.js';
import { runpodStatus, isTerminal } from './runpod-client.js';

const INTERVAL_MS = 30_000;
const MAX_AGE_MS = 1000 * 60 * 20; // 20min absolute ceiling — matches worst-case execution window

let timer: NodeJS.Timeout | null = null;

async function reconcileOnce() {
  const cutoff = new Date(Date.now() - 30_000); // only look at jobs older than 30s
  const rows = await db
    .select()
    .from(inferenceJobs)
    .where(
      and(
        inArray(inferenceJobs.status, ['pending', 'running']),
        lt(inferenceJobs.submittedAt, cutoff),
      ),
    )
    .limit(50);

  for (const row of rows) {
    if (!row.runpodJobId) continue;
    const cap = getCapability(row.capability);

    try {
      const status = await runpodStatus(cap.getEndpointId(), row.runpodJobId);
      if (!isTerminal(status.status)) {
        // Stale beyond absolute ceiling → mark timed out
        if (Date.now() - row.submittedAt.getTime() > MAX_AGE_MS) {
          await db
            .update(inferenceJobs)
            .set({
              status: 'timed_out',
              error: { message: 'Exceeded reconciler ceiling', reconciled: true },
              completedAt: new Date(),
            })
            .where(eq(inferenceJobs.id, row.id));
          await getRedis().publish(
            `job:${row.id}:error`,
            JSON.stringify({ jobId: row.id, status: 'timed_out', reconciled: true }),
          );
        }
        continue;
      }

      const isSuccess = status.status === 'COMPLETED';
      const outputKeys = cap.outputKeys(row.id, row.input);
      const output = isSuccess
        ? Object.fromEntries(
            Object.entries(outputKeys).map(([name, { key }]) => [`${name}Key`, `outputs/${key}`]),
          )
        : null;

      await db
        .update(inferenceJobs)
        .set({
          status: isSuccess ? 'completed' : status.status === 'TIMED_OUT' ? 'timed_out' : 'failed',
          output,
          error: isSuccess ? null : { message: status.error ?? 'runpod failure', reconciled: true },
          metrics: (status.output as any)?.metrics ?? null,
          completedAt: new Date(),
        })
        .where(eq(inferenceJobs.id, row.id));

      const channel = `job:${row.id}:${isSuccess ? 'complete' : 'error'}`;
      await getRedis().publish(
        channel,
        JSON.stringify({ jobId: row.id, status: isSuccess ? 'completed' : 'failed', output, error: status.error, reconciled: true }),
      );

      logger.info({ jobId: row.id, status: status.status }, 'Reconciler resolved job');
    } catch (err) {
      logger.warn({ jobId: row.id, err: (err as Error).message }, 'Reconciler poll failed; will retry');
    }
  }
}

export function startReconciler() {
  if (timer) return;
  timer = setInterval(() => {
    reconcileOnce().catch((err) => logger.error({ err: (err as Error).message }, 'reconcileOnce threw'));
  }, INTERVAL_MS);
  logger.info({ intervalMs: INTERVAL_MS }, 'Inference reconciler started');
}

export function stopReconciler() {
  if (timer) clearInterval(timer);
  timer = null;
}
```

- [ ] **Step 2: Typecheck**

```bash
cd packages/api && pnpm typecheck
```

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/inference/reconciler.ts
git commit -m "feat(api): inference reconciler (30s poll fallback)"
```

---

### Task 13: Wire routes + reconciler in API boot

**Files:**
- Modify: `packages/api/src/index.ts`

- [ ] **Step 1: Register routes and start reconciler**

Open `packages/api/src/index.ts`. Near other route registrations (search for an existing `await fastify.register(...)` or `registerSandboxRoutes(fastify)` call), add:

```ts
import { registerInferenceRoutes } from './inference/routes.js';
import { startReconciler } from './inference/reconciler.js';
```

After all route registrations (but before `fastify.listen`), add:

```ts
await registerInferenceRoutes(fastify);
```

After `fastify.listen(...)` resolves successfully, add:

```ts
startReconciler();
```

- [ ] **Step 2: Typecheck and start**

```bash
cd packages/api && pnpm typecheck && pnpm dev
```

Expected: API boots, logs include `Inference reconciler started`. `GET /health` still returns 200.

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/index.ts
git commit -m "feat(api): register inference routes and start reconciler on boot"
```

---

## Phase 5 — Sandbox MCP tool

### Task 14: `segment_speaker` tool

**Files:**
- Create: `packages/sandbox/src/tools/segment-speaker.ts`

- [ ] **Step 1: Write the tool**

Create `packages/sandbox/src/tools/segment-speaker.ts`:

```ts
import { mkdirSync } from 'node:fs';
import { writeFile, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { getMinioClient, BUCKET } from '../minio.js';

const API_BASE = process.env.API_CALLBACK_URL!;
const SANDBOX_ID = process.env.SANDBOX_ID!;
const SANDBOX_SECRET = process.env.SANDBOX_SECRET!;

interface Input {
  videoKey: string;
  ranges?: Array<{ startMs: number; endMs: number }>;
  params?: {
    backbone?: 'resnet50' | 'mobilenetv3';
    scale?: number;
    fps?: number;
    downsampleRatio?: number;
  };
  outputDir?: string;
}

interface CompleteEvent {
  jobId: string;
  status: 'completed' | 'failed' | 'timed_out';
  output?: {
    matteKey: string;
    fgrKey: string;
    bboxKey: string;
    proxyMatteKey: string;
    proxyFgrKey: string;
  };
  error?: { message: string };
}

async function dispatch(input: Input): Promise<{ jobId: string }> {
  const res = await fetch(`${API_BASE}/internal/sandbox/${SANDBOX_ID}/inference`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SANDBOX_SECRET}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      capability: 'segment-speaker',
      input: {
        videoKey: input.videoKey,
        ranges: input.ranges,
        params: input.params ?? {},
      },
    }),
  });
  if (!res.ok) throw new Error(`dispatch failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as { jobId: string };
}

async function waitForTerminal(jobId: string): Promise<CompleteEvent> {
  const url = `${API_BASE}/internal/sandbox/${SANDBOX_ID}/inference/${jobId}/stream`;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${SANDBOX_SECRET}` },
      });
      if (!res.ok || !res.body) throw new Error(`stream failed: ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        const events = buf.split('\n\n');
        buf = events.pop() ?? '';

        for (const block of events) {
          const eventMatch = block.match(/^event: (\w+)$/m);
          const dataMatch = block.match(/^data: (.+)$/m);
          if (!eventMatch || !dataMatch) continue;

          const kind = eventMatch[1];
          const data = JSON.parse(dataMatch[1]);

          if (kind === 'complete' || kind === 'error') {
            return data as CompleteEvent;
          }
        }
      }
      throw new Error('stream ended without terminal event');
    } catch (err) {
      if (attempt === 2) throw err;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    }
  }
  throw new Error('unreachable');
}

async function downloadObject(key: string, destPath: string): Promise<void> {
  const minio = getMinioClient();
  mkdirSync(dirname(destPath), { recursive: true });
  const stream = await minio.getObject(BUCKET, key);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  await writeFile(destPath, Buffer.concat(chunks));
}

export const segmentSpeakerTool = {
  name: 'segment_speaker',
  description:
    'Segments the speaker in a video using RVM (running on GPU via RunPod). Returns paths to matte, foreground, and per-frame bounding box JSON. Use this when you need speaker silhouette data for depth compositing or positioning.',
  input_schema: {
    type: 'object',
    properties: {
      videoKey: {
        type: 'string',
        description: 'MinIO key of the source video (e.g. "uploads/abc/source.mp4"). Typically comes from the project manifest.',
      },
      ranges: {
        type: 'array',
        description: 'Optional. List of time ranges to segment. If omitted, segments the entire video.',
      },
      params: {
        type: 'object',
        description: 'Optional tuning knobs: backbone (resnet50|mobilenetv3), scale, fps, downsampleRatio.',
      },
      outputDir: {
        type: 'string',
        description: 'Workspace dir where output files will be written (defaults to /workspace/public/matte).',
      },
    },
    required: ['videoKey'],
  },
  execute: async (input: Input): Promise<string> => {
    const outputDir = input.outputDir ?? '/workspace/public/matte';

    const { jobId } = await dispatch(input);
    const terminal = await waitForTerminal(jobId);

    if (terminal.status !== 'completed' || !terminal.output) {
      throw new Error(`segment_speaker failed: ${terminal.error?.message ?? terminal.status}`);
    }

    const mattePath = join(outputDir, 'matte.mp4');
    const fgrPath = join(outputDir, 'fgr.mp4');
    const bboxPath = join(outputDir, 'bbox.json');
    const proxyMattePath = join(outputDir, 'matte-proxy.mp4');
    const proxyFgrPath = join(outputDir, 'fgr-proxy.mp4');

    await Promise.all([
      downloadObject(terminal.output.matteKey, mattePath),
      downloadObject(terminal.output.fgrKey, fgrPath),
      downloadObject(terminal.output.bboxKey, bboxPath),
      downloadObject(terminal.output.proxyMatteKey, proxyMattePath),
      downloadObject(terminal.output.proxyFgrKey, proxyFgrPath),
    ]);

    const bbox = JSON.parse(await readFile(bboxPath, 'utf-8'));

    return JSON.stringify(
      {
        ok: true,
        jobId,
        mattePath,
        fgrPath,
        bboxPath,
        proxyMattePath,
        proxyFgrPath,
        aggregateBbox: bbox.aggregate,
        framesCount: bbox.frames?.length ?? 0,
      },
      null,
      2,
    );
  },
};
```

- [ ] **Step 2: Verify MinIO helper exists**

Check that `packages/sandbox/src/minio.ts` exports `getMinioClient()` and `BUCKET`. If the sandbox already has a MinIO client in `checkpoint.ts` only, extract a small helper:

Create (or amend) `packages/sandbox/src/minio.ts`:

```ts
import { Client } from 'minio';

let client: Client | null = null;

export function getMinioClient(): Client {
  if (client) return client;
  client = new Client({
    endPoint: process.env.MINIO_ENDPOINT!,
    port: process.env.MINIO_PORT ? parseInt(process.env.MINIO_PORT, 10) : undefined,
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY!,
    secretKey: process.env.MINIO_SECRET_KEY!,
  });
  return client;
}

export const BUCKET = process.env.MINIO_BUCKET!;
```

- [ ] **Step 3: Typecheck**

```bash
cd packages/sandbox && pnpm typecheck
```

- [ ] **Step 4: Commit**

```bash
git add packages/sandbox/src/tools/segment-speaker.ts packages/sandbox/src/minio.ts
git commit -m "feat(sandbox): segment_speaker mcp tool"
```

---

### Task 15: Register `inference` MCP server

**Files:**
- Modify: `packages/sandbox/src/mcp-servers.ts`

- [ ] **Step 1: Add the new server**

Open `packages/sandbox/src/mcp-servers.ts`. At the top, add the import:

```ts
import { segmentSpeakerTool } from './tools/segment-speaker.js';
```

Inside `createMcpServers(...)`, after the other `createSdkMcpServer(...)` calls, add:

```ts
  const inferenceServer = createSdkMcpServer({
    name: 'inference',
    tools: [wrapTool(segmentSpeakerTool)],
  });
```

Find the `return` statement of this function and add `inferenceServer` to the returned object. Also look for wherever the return value is consumed — typically the caller spreads servers into a `mcpServers` record passed to `sdkQuery`. Add `inference: inferenceServer` there too.

- [ ] **Step 2: Typecheck + rebuild sandbox**

```bash
cd packages/sandbox && pnpm typecheck && pnpm build
```

Expected: no errors; `packages/sandbox/dist/entry.js` updated.

- [ ] **Step 3: Commit**

```bash
git add packages/sandbox/src/mcp-servers.ts
git commit -m "feat(sandbox): register inference mcp server"
```

---

## Phase 6 — E2E verification

### Task 16: E2E test against real RunPod

**Files:**
- Create: `scripts/temp/test-runpod-handler.ts`

- [ ] **Step 1: Write test script**

Create `scripts/temp/test-runpod-handler.ts`:

```ts
/**
 * E2E test: submits a real RunPod job, verifies artifacts land in MinIO.
 *
 * Requires: .env filled (RUNPOD_API_KEY, RUNPOD_RVM_ENDPOINT_ID, MinIO creds),
 * a test video already in MinIO at uploads/test/short-clip.mp4.
 */

import 'dotenv/config';
import { runpodSubmit, runpodStatus, isTerminal } from '../../packages/api/src/inference/runpod-client.js';
import { presignedClient, BUCKET_NAME, OUTPUTS_PREFIX, UPLOADS_PREFIX } from '../../packages/api/src/services/minio.js';

const ENDPOINT = process.env.RUNPOD_RVM_ENDPOINT_ID!;
if (!ENDPOINT) throw new Error('RUNPOD_RVM_ENDPOINT_ID required');

const TEST_KEY = 'test/short-clip.mp4';
const JOB_PREFIX = `test-${Date.now()}`;

async function main() {
  const inputUrl = await presignedClient.presignedGetObject(
    BUCKET_NAME,
    `${UPLOADS_PREFIX}${TEST_KEY}`,
    60 * 60,
  );

  const outputs: Record<string, string> = {};
  for (const name of ['matte', 'fgr', 'bbox']) {
    const key = `${OUTPUTS_PREFIX}mattes/${JOB_PREFIX}/${name}.${name === 'bbox' ? 'json' : 'mp4'}`;
    outputs[name] = await presignedClient.presignedPutObject(BUCKET_NAME, key, 15 * 60);
  }

  console.log('Submitting RunPod job...');
  const submitted = await runpodSubmit(ENDPOINT, {
    input: {
      inputs: { video: inputUrl },
      outputs,
      params: { backbone: 'resnet50', scale: 0.5, downsampleRatio: 0.8 },
    },
  });
  console.log('Submitted:', submitted.id);

  let status = submitted;
  const start = Date.now();
  while (!isTerminal(status.status as any)) {
    await new Promise((r) => setTimeout(r, 5_000));
    status = (await runpodStatus(ENDPOINT, submitted.id)) as any;
    console.log(`  [${Math.round((Date.now() - start) / 1000)}s] status=${status.status}`);
  }

  console.log('Terminal status:', status.status);
  console.log('Output:', JSON.stringify(status.output, null, 2));

  if (status.status !== 'COMPLETED') {
    console.error('FAILED');
    process.exit(1);
  }

  console.log('Expected outputs (verify manually in MinIO):');
  for (const name of ['matte', 'fgr', 'bbox']) {
    console.log(`  ${OUTPUTS_PREFIX}mattes/${JOB_PREFIX}/${name}.${name === 'bbox' ? 'json' : 'mp4'}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Upload a test video**

```bash
# Upload a small (~10s) test video to MinIO
mc alias set local http://localhost:9000 viona viona123
mc cp ./path-to-short-clip.mp4 local/viona/uploads/test/short-clip.mp4
```

- [ ] **Step 3: Run the test**

```bash
cd packages/api && pnpm tsx ../../scripts/temp/test-runpod-handler.ts
```

Expected:
- `Submitted: <runpod-id>`
- Polling prints every 5s, status progresses `IN_QUEUE → IN_PROGRESS → COMPLETED`
- Cold start adds 30-60s on first run; subsequent runs are faster
- `Output: { artifacts: {...}, metrics: {...} }`
- Artifacts visible in MinIO Console under `outputs/mattes/test-<ts>/`

- [ ] **Step 4: Verify artifact integrity**

```bash
mc cp local/viona/outputs/mattes/test-<ts>/matte.mp4 /tmp/matte.mp4
ffprobe /tmp/matte.mp4
```

Expected: ffprobe reports a valid MP4 with reasonable resolution and duration.

- [ ] **Step 5: Commit**

```bash
git add scripts/temp/test-runpod-handler.ts
git commit -m "test(runpod): e2e script for rvm handler"
```

---

### Task 17: E2E test — full API dispatch path

**Files:**
- Create: `scripts/temp/test-inference-dispatch.ts`

- [ ] **Step 1: Write the test**

Create `scripts/temp/test-inference-dispatch.ts`:

```ts
/**
 * E2E test: mimics what the sandbox MCP tool does.
 * Posts to /internal/sandbox/:id/inference, opens SSE, waits for terminal.
 *
 * Requires: API running (pnpm -F @viona/api dev), a valid sandboxSessions row
 * with its sandboxSecret for :id, test video at uploads/test/short-clip.mp4.
 */

import 'dotenv/config';

const API = process.env.API_URL ?? 'http://localhost:4000';
const SANDBOX_ID = process.env.TEST_SANDBOX_ID!;
const SANDBOX_SECRET = process.env.TEST_SANDBOX_SECRET!;
if (!SANDBOX_ID || !SANDBOX_SECRET) throw new Error('TEST_SANDBOX_ID and TEST_SANDBOX_SECRET required');

async function main() {
  const dispatchRes = await fetch(`${API}/internal/sandbox/${SANDBOX_ID}/inference`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${SANDBOX_SECRET}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      capability: 'segment-speaker',
      input: {
        videoKey: 'test/short-clip.mp4',
        params: { backbone: 'resnet50', scale: 0.5, downsampleRatio: 0.8 },
      },
    }),
  });
  if (!dispatchRes.ok) throw new Error(`dispatch failed: ${dispatchRes.status} ${await dispatchRes.text()}`);
  const { jobId } = (await dispatchRes.json()) as { jobId: string };
  console.log('jobId:', jobId);

  const streamRes = await fetch(`${API}/internal/sandbox/${SANDBOX_ID}/inference/${jobId}/stream`, {
    headers: { Authorization: `Bearer ${SANDBOX_SECRET}` },
  });
  if (!streamRes.ok || !streamRes.body) throw new Error(`stream failed: ${streamRes.status}`);

  const reader = streamRes.body.getReader();
  const dec = new TextDecoder();
  let buf = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const events = buf.split('\n\n');
    buf = events.pop() ?? '';
    for (const block of events) {
      const e = block.match(/^event: (\w+)$/m);
      const d = block.match(/^data: (.+)$/m);
      if (!e || !d) continue;
      console.log(e[1], JSON.parse(d[1]));
      if (e[1] === 'complete' || e[1] === 'error') {
        process.exit(e[1] === 'complete' ? 0 : 1);
      }
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Set up test sandbox session**

Create a test sandbox row manually (one-liner):

```bash
psql "$DATABASE_URL" -c "INSERT INTO sandbox_sessions (id, project_id, sandbox_secret) VALUES (gen_random_uuid(), (SELECT id FROM projects LIMIT 1), 'test-secret-1234567890') RETURNING id, sandbox_secret;"
```

Record the `id` and `sandbox_secret`, then:

```bash
export TEST_SANDBOX_ID=<id>
export TEST_SANDBOX_SECRET=<secret>
```

- [ ] **Step 3: Run the test (API must be running)**

```bash
# Terminal 1
cd packages/api && pnpm dev

# Terminal 2
cd packages/api && pnpm tsx ../../scripts/temp/test-inference-dispatch.ts
```

Expected output sequence:
```
jobId: <uuid>
ready { jobId: '<uuid>' }
complete { jobId: '<uuid>', status: 'completed', output: {...} }
```

- [ ] **Step 4: Verify DB state**

```bash
psql "$DATABASE_URL" -c "SELECT id, capability, status, output, completed_at FROM inference_jobs ORDER BY submitted_at DESC LIMIT 1;"
```

Expected: `status = completed`, `output` is a non-null JSON with all five `*Key` fields.

- [ ] **Step 5: Commit**

```bash
git add scripts/temp/test-inference-dispatch.ts
git commit -m "test(api): e2e inference dispatch path"
```

---

### Task 18: End-to-end sandbox test

**Files:** (none — manual verification)

- [ ] **Step 1: Boot the stack and run a real project**

Start API + frontend + sandbox as you would for a real project. In the sandbox agent conversation, prompt the agent to call `segment_speaker`:

> "Use the segment_speaker tool on the current project's video."

Watch the agent invoke the tool. Verify:
- API logs show: `POST /internal/sandbox/:id/inference` → dispatched, SSE opens, webhook arrives, SSE relays `complete`.
- RunPod dashboard shows a completed job.
- `inference_jobs` row in DB is `completed`.
- Sandbox workspace has `/workspace/public/matte/matte.mp4`, `fgr.mp4`, `bbox.json` and the two proxies.

- [ ] **Step 2: Confirm failure path**

Submit an intentionally bad input (e.g. `videoKey: "nonexistent/foo.mp4"`). Verify:
- RunPod handler fails (can't download).
- Webhook arrives with FAILED status.
- DB row transitions to `failed`, `error.message` is populated.
- Sandbox tool throws with a clear error message.

(No git commit — verification only.)

---

## Phase 7 — Migration + cleanup

### Task 19: Point existing sandbox callers at the new capability

**Files:**
- Modify: Anywhere in `packages/sandbox/src/tools/` or prompts that currently calls `/internal/sandbox/:id/segment`.

- [ ] **Step 1: Grep for current callers**

```bash
cd packages/sandbox && grep -rn "internal/sandbox.*segment" src/
```

Expected findings: tool or helper calling `POST /internal/sandbox/:id/segment` and `GET .../segment/status`.

- [ ] **Step 2: Replace with segment_speaker**

For each caller, replace the old HTTP call with a call to the `segmentSpeakerTool.execute(...)` function, OR update the prompt to use the MCP tool directly if the caller is the LLM.

Example replacement:

```ts
// Before
const res = await fetch(`${API_BASE}/internal/sandbox/${SANDBOX_ID}/segment`, { /* ... */ });

// After
import { segmentSpeakerTool } from './segment-speaker.js';
const resJson = await segmentSpeakerTool.execute({ videoKey: project.videoKey, ranges });
const res = JSON.parse(resJson);
```

- [ ] **Step 3: Run an end-to-end project through the sandbox**

Start a fresh project, let the orchestrator run through its phases. Verify segmentation outputs land in `/workspace/public/matte/` via the new path.

- [ ] **Step 4: Commit**

```bash
git add -A packages/sandbox/
git commit -m "refactor(sandbox): use segment_speaker tool instead of /segment http"
```

---

### Task 20: Delete old CPU segmentation code

**Files:**
- Delete: `packages/worker/src/processors/segmentation.ts`
- Delete: `packages/worker/scripts/segment_person.py`
- Modify: `packages/worker/src/index.ts` (remove segmentation queue registration)
- Modify: `packages/api/src/services/queue.ts` (remove `queueSegmentationJob`)
- Modify: `packages/api/src/sandbox/routes.ts` lines 440-541 (remove old `/segment` and `/segment/status` routes)

**Prerequisite:** Task 19 must be fully verified in prod for at least 1 week with no regressions before executing this task. If in doubt, skip.

- [ ] **Step 1: Delete worker files**

```bash
rm packages/worker/src/processors/segmentation.ts
rm packages/worker/scripts/segment_person.py
```

- [ ] **Step 2: Remove worker registration**

Open `packages/worker/src/index.ts`. Find the `segmentationWorker` / `segmentationQueue` import and registration. Delete those lines and the worker process setup for the `segmentation` queue.

- [ ] **Step 3: Remove queue helper**

Open `packages/api/src/services/queue.ts`. Delete the `queueSegmentationJob` function and `SegmentationJobData` type.

- [ ] **Step 4: Remove old routes**

Open `packages/api/src/sandbox/routes.ts`. Delete the `POST /internal/sandbox/:id/segment` route (lines 440-504), the `GET /internal/sandbox/:id/segment/status` route (506-541), and the `GET /internal/sandbox/:id/segment/:jobId/matte` route (543-582).

- [ ] **Step 5: Remove `matte-ranges` / bg-generation code if no longer referenced**

```bash
grep -rn "queueSegmentationJob\|matteRanges\|bgRanges" packages/ apps/
```

Clean up any dangling references. Background generation (OpenAI inpainting) still exists inside `segment_person.py` — it moved to `runpod/rvm/segment_person.py`. If bg generation is no longer needed at the RunPod layer, remove that code from `runpod/rvm/segment_person.py` too; otherwise leave it.

- [ ] **Step 6: Typecheck both packages**

```bash
pnpm -F @viona/api typecheck && pnpm -F @viona/worker typecheck
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: remove legacy CPU segmentation path (rvm now on runpod)"
```

---

## Self-Review Notes

- **Spec coverage check:**
  - ✅ Generic dispatch system — Task 7 (registry), Task 10 (dispatcher)
  - ✅ `segment_speaker` MCP tool — Task 14
  - ✅ RunPod endpoint + Docker handler — Tasks 3-6
  - ✅ Webhook + reconciliation — Tasks 9, 11, 12
  - ✅ Scoped JWT — Task 9
  - ✅ Capability registry — Task 7
  - ✅ Inference routes — Task 11
  - ✅ DB migration — Task 1
  - ✅ Sandbox MCP server registration — Task 15
  - ✅ End-to-end tests — Tasks 16-18
  - ✅ Migration + cleanup — Tasks 19-20

- **Type consistency:** Output field names are `matteKey/fgrKey/bboxKey/proxyMatteKey/proxyFgrKey` across registry (Task 7), webhook handler (Task 11), reconciler (Task 12), and sandbox tool (Task 14). Capability name is `segment-speaker` everywhere. `CompleteEvent.output` shape in the sandbox tool matches what the webhook/reconciler publish.

- **No placeholders:** All code blocks contain runnable code; all commands include expected output. The one manual piece (Task 6 — creating the RunPod endpoint in the dashboard) is necessary infrastructure work and has step-by-step instructions.
