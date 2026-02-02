# Docker Compose Full Stack Design

## Problem Statement

Currently, running Clipify requires manual setup of multiple services:
- Infrastructure (PostgreSQL, Redis, MinIO) via existing `docker-compose.yml`
- Web app, API, and worker running natively with `pnpm dev`
- Python environment with WhisperX for transcription
- Docker for visual generation (spawning openhands-sandbox containers)

This creates friction for new developers and makes deployment complex.

**Goal**: Single `docker compose up` command that runs the entire stack.

---

## Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     docker compose up                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────────────┐ │
│  │ web     │  │ api     │  │ worker  │  │ visual-gen          │ │
│  │ :3000   │  │ :4000   │  │ (jobs)  │  │ (Python+Node+Chrome)│ │
│  │ Next.js │  │ Fastify │  │ BullMQ  │  │ BullMQ consumer     │ │
│  └────┬────┘  └────┬────┘  └────┬────┘  └──────────┬──────────┘ │
│       │            │            │                   │            │
│       │       ┌────▼────────────▼───────────────────▼─────┐     │
│       │       │                 Redis                      │     │
│       │       │            (queue + pubsub)                │     │
│       │       └────────────────────────────────────────────┘     │
│       │            │                                             │
│       │       ┌────▼────┐  ┌─────────┐                          │
│       │       │ postgres│  │  minio  │                          │
│       │       │  :5432  │  │ :9000   │                          │
│       └───────┴─────────┴──┴─────────┘                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Services

| Service | Base Image | Purpose | Ports |
|---------|-----------|---------|-------|
| `postgres` | postgres:16-alpine | Database | 5432 |
| `redis` | redis:7-alpine | Queue + cache | 6379 |
| `minio` | minio/minio | Object storage (S3-compatible) | 9000, 9001 |
| `web` | node:20-alpine | Next.js frontend | 3000 |
| `api` | node:20-alpine | Fastify REST API | 4000 |
| `worker` | node:20-slim + Python | Transcription, rendering, audio | - |
| `visual-gen` | python:3.12-slim + Node | AI visual generation | - |

### Key Design Decisions

1. **No Docker-in-Docker**: Visual generation is a separate service, not spawned containers
2. **Cloud-ready storage**: Bundles stored in MinIO/S3, not shared volumes
3. **Environment-based config**: Same code runs locally and in cloud
4. **OpenRouter for LLM**: Simple API key, no local proxy needed
5. **Models baked into images**: ML models pre-downloaded during Docker build for instant startup

---

## ML Model Strategy

### Models Inventory

| Model | Service | Purpose | Size |
|-------|---------|---------|------|
| **Whisper** (base) | worker | Speech-to-text transcription | ~150MB |
| **Whisper** (small/medium/large) | worker | Higher accuracy (optional) | 500MB - 3GB |
| **pyannote** | worker | Speaker diarization (WhisperX) | ~100MB |
| **demucs** (optional) | worker | Audio source separation | ~300MB |

### Approach: Bake Models into Docker Image

Models are pre-downloaded during Docker build, not at runtime:

```dockerfile
# docker/worker/Dockerfile

# Pre-download Whisper model during build
ARG WHISPER_MODEL=base
RUN python -c "import whisper; whisper.load_model('${WHISPER_MODEL}')"

# Pre-download pyannote models (for WhisperX alignment)
RUN python -c "from pyannote.audio import Pipeline; Pipeline.from_pretrained('pyannote/speaker-diarization')" || true
```

### Benefits

- **Instant startup**: No download wait on first run
- **Works offline**: No network dependency after build
- **Reproducible**: Same model version every time
- **CI/CD friendly**: Build once, deploy anywhere

### Trade-offs

- **Larger images**: worker image ~2GB (vs ~500MB without models)
- **Slower builds**: Initial build downloads models (cached after)
- **Model updates**: Rebuild image to update models

### Configurable Model Size

Build arg allows choosing model size:

```bash
# Build with base model (default, fastest, smallest)
docker compose build worker

# Build with larger model for better accuracy
docker compose build --build-arg WHISPER_MODEL=medium worker
```

| Model | Accuracy | Image Size | GPU Memory |
|-------|----------|------------|------------|
| base | Good | +150MB | 1GB |
| small | Better | +500MB | 2GB |
| medium | Great | +1.5GB | 5GB |
| large | Best | +3GB | 10GB |

---

## Scalability: No Shared Filesystem

### Problem with Current Architecture

The current visual generation uses **shared filesystem paths** between services:

```
Worker → writes to → projectDir/src/{compositionId}/
                            ↓
Container → reads from → projectDir/ (mounted volume)
                            ↓
Container → writes to → bundleOutputDir/{compositionId}/ (mounted volume)
                            ↓
API → serves from → bundles.dir/{compositionId}/ (same path)
```

**This requires:**
- Shared volume mounts between containers
- In cloud: NFS/EFS (expensive, slow, single point of failure)
- Cannot scale horizontally (all instances need same filesystem)

### Scalable Architecture: Everything Through S3

**Principle: All persistent data flows through object storage. Local filesystem is ephemeral only.**

```
┌────────────────────────────────────────────────────────────────────────┐
│                     Scalable Data Flow                                  │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  visual-gen (horizontally scalable)                                    │
│      │                                                                  │
│      │ 1. Receive job from Redis queue                                 │
│      │    - Job contains: transcript, style, config (NOT file paths)   │
│      │                                                                  │
│      │ 2. Work in LOCAL /tmp/{jobId}/ (ephemeral)                      │
│      │    - Generate source files                                      │
│      │    - Run Remotion bundler                                       │
│      │    - Take screenshots for validation                            │
│      │                                                                  │
│      │ 3. Upload to MinIO (persistent)                                 │
│      │    - PUT bundles/{compositionId}/* (all bundle files)           │
│      │    - PUT outputs/{compositionId}/preview.mp4 (optional video)   │
│      │                                                                  │
│      │ 4. Update database                                              │
│      │    - visuals.bundleUrl = 'bundles/{compositionId}/index.html'   │
│      │                                                                  │
│      │ 5. Cleanup LOCAL /tmp/{jobId}/                                  │
│      ▼                                                                  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                        MinIO / S3                                 │  │
│  │  Bucket: bundles/                                                 │  │
│  │    └── {compositionId}/                                           │  │
│  │        ├── index.html                                             │  │
│  │        ├── bundle.js                                              │  │
│  │        ├── bundle.js.map                                          │  │
│  │        └── assets/...                                             │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│      │                                                                  │
│      │ 6. Browser requests bundle                                      │
│      ▼                                                                  │
│  api (horizontally scalable)                                           │
│      │                                                                  │
│      │ 7. Generate presigned URL or redirect                           │
│      │    GET /bundles/{compositionId}/index.html                      │
│      │    → 302 Redirect to MinIO presigned URL                        │
│      ▼                                                                  │
│  Browser loads bundle directly from MinIO/S3                           │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
```

### Scalability Comparison

| Aspect | Shared Filesystem | S3-Based (This Design) |
|--------|-------------------|------------------------|
| Horizontal scaling | ❌ All need same mount | ✅ Stateless workers |
| Cloud deployment | ❌ Requires EFS/NFS | ✅ Uses native S3 |
| Cost | ❌ EFS is expensive | ✅ S3 is cheap |
| Latency | ❌ Network filesystem | ✅ Direct S3 access |
| Failure isolation | ❌ Shared state | ✅ Job-level isolation |
| Multi-region | ❌ Complex replication | ✅ S3 cross-region |

### Job Data: Redis, Not Filesystem

**Current (filesystem-based):**
```typescript
// Write prompt to file, pass path to container
await writeFile(promptPath, prompt);
spawn('docker', ['-v', `${promptPath}:/tmp/prompt.txt`]);
```

**Scalable (Redis-based):**
```typescript
// All job data in Redis, no filesystem needed
await queue.add('generate-visuals', {
  projectId,
  compositionId,
  transcript: [...],  // Inline data
  style: 'modern',
  dimensions: { width: 1080, height: 1920 },
});
```

---

## Cloud-Ready Storage Architecture

### Bundle Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Bundle Flow                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  visual-gen                                                          │
│      │                                                               │
│      │ 1. Generate bundle locally (/tmp/bundle-xyz)                  │
│      │ 2. Upload to MinIO/S3: s3://bundles/{compositionId}/          │
│      │ 3. Update DB: visuals.bundleUrl = "s3://bundles/..."          │
│      ▼                                                               │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    MinIO / S3                                │    │
│  │  buckets:                                                    │    │
│  │    - uploads/    (source videos)                             │    │
│  │    - outputs/    (rendered videos)                           │    │
│  │    - bundles/    (Remotion bundles)                          │    │
│  └─────────────────────────────────────────────────────────────┘    │
│      │                                                               │
│      │ 3. Frontend requests bundle                                   │
│      ▼                                                               │
│  api                                                                 │
│      │                                                               │
│      │ 4. Generate presigned URL or proxy request                    │
│      ▼                                                               │
│  web (browser)                                                       │
│      │                                                               │
│      │ 5. Load Remotion bundle from URL                              │
│      ▼                                                               │
│  Remotion Player renders visual                                      │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### MinIO Buckets

| Bucket | Purpose | Access |
|--------|---------|--------|
| `uploads` | Source video files | Private (presigned URLs) |
| `outputs` | Rendered final videos | Private (presigned URLs) |
| `bundles` | Remotion composition bundles | Public (anonymous download) |

### Environment Variables for Storage

```bash
# Local (MinIO)
S3_ENDPOINT=http://minio:9000
S3_ACCESS_KEY=clipify
S3_SECRET_KEY=clipify123
S3_BUCKET_UPLOADS=uploads
S3_BUCKET_OUTPUTS=outputs
S3_BUCKET_BUNDLES=bundles

# Cloud (AWS S3) - same code, different config
S3_ENDPOINT=https://s3.us-east-1.amazonaws.com
S3_ACCESS_KEY=AKIA...
S3_SECRET_KEY=...
S3_REGION=us-east-1
```

---

## Cloud Deployment Path

This architecture maps cleanly to cloud providers:

| Component | Docker Compose | AWS | GCP |
|-----------|---------------|-----|-----|
| postgres | Container | RDS | Cloud SQL |
| redis | Container | ElastiCache | Memorystore |
| minio | Container | S3 | Cloud Storage |
| web | Container | Vercel / ECS | Cloud Run |
| api | Container | ECS / Lambda | Cloud Run |
| worker | Container | ECS | Cloud Run Jobs |
| visual-gen | Container | ECS (Fargate) | Cloud Run Jobs |

---

## Dockerfile Strategy

### Monorepo Build Pattern

Multi-stage builds to handle shared workspace packages:

```dockerfile
# Stage 1: Install dependencies for entire monorepo
FROM node:20-alpine AS base
RUN corepack enable pnpm
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/renderer/package.json ./packages/renderer/
COPY packages/api/package.json ./packages/api/
RUN pnpm install --frozen-lockfile

# Stage 2: Build
FROM base AS builder
COPY . .
RUN pnpm --filter @reelify/api build

# Stage 3: Production (minimal)
FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/packages/api/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
CMD ["node", "dist/index.js"]
```

### Service Requirements

| Service | Base | Extra Dependencies |
|---------|------|-------------------|
| `web` | node:20-alpine | None |
| `api` | node:20-alpine | None |
| `worker` | node:20-slim | Python 3.12, FFmpeg, WhisperX, **Whisper model (baked)** |
| `visual-gen` | python:3.12-slim | Node 20, Chromium, Remotion, pnpm |

### Image Sizes (Estimated)

| Service | Size | Notes |
|---------|------|-------|
| web | ~300MB | |
| api | ~250MB | |
| worker | ~2GB | Includes Whisper base model (~150MB) + PyTorch |
| worker (large) | ~4.5GB | With Whisper large model (~3GB) |
| visual-gen | ~2.5GB | Includes Chromium |

### Worker Dockerfile (with baked models)

```dockerfile
FROM node:20-slim AS base

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.12 python3-pip python3.12-venv \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Install Python ML dependencies
RUN pip3 install --no-cache-dir \
    whisperx \
    torch torchaudio --index-url https://download.pytorch.org/whl/cpu

# Pre-download Whisper model (baked into image for instant startup)
ARG WHISPER_MODEL=base
ENV WHISPER_MODEL=${WHISPER_MODEL}
RUN python3 -c "import whisper; print(f'Downloading {\"${WHISPER_MODEL}\"} model...'); whisper.load_model('${WHISPER_MODEL}')"

# Pre-download pyannote for speaker diarization (optional, may require HF token)
# RUN python3 -c "from pyannote.audio import Pipeline"

# ... Node.js build stages follow ...
```

---

## Docker Compose Configuration

### docker-compose.yml

```yaml
services:
  # ============== Infrastructure ==============
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: clipify
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-clipify123}
      POSTGRES_DB: clipify
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U clipify"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${S3_ACCESS_KEY:-clipify}
      MINIO_ROOT_PASSWORD: ${S3_SECRET_KEY:-clipify123}
    volumes:
      - minio_data:/data
    ports:
      - "9001:9001"
    healthcheck:
      test: ["CMD", "mc", "ready", "local"]
      interval: 5s
      timeout: 5s
      retries: 5

  minio-init:
    image: minio/mc
    depends_on:
      minio:
        condition: service_healthy
    entrypoint: >
      /bin/sh -c "
      mc alias set local http://minio:9000 clipify clipify123;
      mc mb local/uploads --ignore-existing;
      mc mb local/outputs --ignore-existing;
      mc mb local/bundles --ignore-existing;
      mc anonymous set download local/bundles;
      "

  # ============== Application ==============
  web:
    build:
      context: .
      dockerfile: docker/web/Dockerfile
    ports:
      - "3000:3000"
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:4000
      NEXT_PUBLIC_WS_URL: ws://localhost:4000
    depends_on:
      - api

  api:
    build:
      context: .
      dockerfile: docker/api/Dockerfile
    ports:
      - "4000:4000"
    environment:
      DATABASE_URL: postgresql://clipify:${POSTGRES_PASSWORD:-clipify123}@postgres:5432/clipify
      REDIS_URL: redis://redis:6379
      S3_ENDPOINT: http://minio:9000
      S3_ACCESS_KEY: ${S3_ACCESS_KEY:-clipify}
      S3_SECRET_KEY: ${S3_SECRET_KEY:-clipify123}
      S3_BUCKET_UPLOADS: uploads
      S3_BUCKET_OUTPUTS: outputs
      S3_BUCKET_BUNDLES: bundles
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      minio-init:
        condition: service_completed_successfully

  worker:
    build:
      context: .
      dockerfile: docker/worker/Dockerfile
      args:
        WHISPER_MODEL: ${WHISPER_MODEL:-base}  # Model baked into image
    environment:
      DATABASE_URL: postgresql://clipify:${POSTGRES_PASSWORD:-clipify123}@postgres:5432/clipify
      REDIS_URL: redis://redis:6379
      S3_ENDPOINT: http://minio:9000
      S3_ACCESS_KEY: ${S3_ACCESS_KEY:-clipify}
      S3_SECRET_KEY: ${S3_SECRET_KEY:-clipify123}
      S3_BUCKET_UPLOADS: uploads
      S3_BUCKET_OUTPUTS: outputs
      WHISPER_DEVICE: ${WHISPER_DEVICE:-cpu}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  visual-gen:
    build:
      context: .
      dockerfile: docker/visual-gen/Dockerfile
    environment:
      DATABASE_URL: postgresql://clipify:${POSTGRES_PASSWORD:-clipify123}@postgres:5432/clipify
      REDIS_URL: redis://redis:6379
      S3_ENDPOINT: http://minio:9000
      S3_ACCESS_KEY: ${S3_ACCESS_KEY:-clipify}
      S3_SECRET_KEY: ${S3_SECRET_KEY:-clipify123}
      S3_BUCKET_BUNDLES: bundles
      OPENROUTER_API_KEY: ${OPENROUTER_API_KEY}
      LLM_MODEL: ${LLM_MODEL:-google/gemini-2.0-flash-001}
    deploy:
      resources:
        limits:
          memory: 4G
        reservations:
          memory: 2G
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

volumes:
  postgres_data:
  redis_data:
  minio_data:

networks:
  default:
    name: clipify
```

---

## File Structure

### New Files to Create

```
clipify/
├── docker/
│   ├── api/
│   │   └── Dockerfile
│   ├── web/
│   │   └── Dockerfile
│   ├── worker/
│   │   └── Dockerfile
│   └── visual-gen/
│       ├── Dockerfile
│       ├── entrypoint.sh
│       └── worker.py          # BullMQ consumer (Python)
├── docker-compose.yml          # Replace existing
├── docker-compose.override.yml # Dev overrides (hot reload)
├── .env.example
└── .dockerignore
```

### Files to Modify

| File | Change |
|------|--------|
| `packages/worker/src/processors/generate-visuals.ts` | Remove Docker spawning, just queue job |
| `packages/api/src/services/minio.ts` | Add `bundles` bucket support |
| `packages/worker/src/config.ts` | Remove OpenHands Docker config |
| `package.json` | Add docker scripts |

---

## Environment Configuration

### .env.example

```bash
# Database
POSTGRES_PASSWORD=clipify123

# S3/MinIO
S3_ACCESS_KEY=clipify
S3_SECRET_KEY=clipify123

# LLM (required for visual generation)
OPENROUTER_API_KEY=sk-or-v1-xxx

# Optional: Whisper config
WHISPER_MODEL=base        # base, small, medium, large
WHISPER_DEVICE=cpu        # cpu, cuda

# Optional: LLM model override
LLM_MODEL=google/gemini-2.0-flash-001
```

### Package.json Scripts

```json
{
  "scripts": {
    "docker:up": "docker compose up -d",
    "docker:down": "docker compose down",
    "docker:build": "docker compose build",
    "docker:logs": "docker compose logs -f",
    "docker:clean": "docker compose down -v --rmi local"
  }
}
```

---

## Implementation Phases

### Phase 1: Code Cleanup & Preparation
1. Remove hardcoded Windows paths from `packages/worker/src/config.ts`
2. Remove hardcoded Windows paths from `packages/api/src/config.ts`
3. Add `bundles` bucket to MinIO setup
4. Create `.dockerignore`
5. Test: existing code still works with environment variables

### Phase 2: Infrastructure Dockerfiles
1. Create `docker/api/Dockerfile` (multi-stage build)
2. Create `docker/web/Dockerfile` (Next.js standalone)
3. Create `docker/worker/Dockerfile` (Node + Python + Whisper model)
4. Create new `docker-compose.yml` (infrastructure + api + web + worker)
5. Add database migration init container
6. Test: `docker compose up` runs api, web, worker (without visual-gen)

### Phase 3: API Bundle Serving from S3
1. Remove static file serving for `/bundles/`
2. Add MinIO `bundles` bucket initialization
3. Add new route to proxy/redirect bundle requests to MinIO
4. Update frontend to handle new bundle URL format
5. Test: bundles served from MinIO work in browser

### Phase 4: Visual Generation Service
1. Create `docker/visual-gen/` directory structure
2. Move `generate-visuals.ts` logic to visual-gen service
3. Create visual-gen Dockerfile (Node + Python + Chromium + Remotion)
4. Add S3 upload for generated bundles
5. Remove generate-visuals processor from worker
6. Add visual-gen to docker-compose.yml
7. Test: visual generation works end-to-end

### Phase 5: Polish & Documentation
1. Create `.env.example` with all variables documented
2. Create `docker-compose.override.yml` (dev hot reload with volume mounts)
3. Add health check endpoints to all services
4. Update README with Docker setup instructions
5. Test: full stack works on fresh clone + `docker compose up`

---

## Developer Workflow

```bash
# First time setup
cp .env.example .env
# Edit .env, add OPENROUTER_API_KEY

# Start everything (uses base Whisper model by default)
pnpm docker:up

# View logs
pnpm docker:logs

# Rebuild after code changes
pnpm docker:build && pnpm docker:up

# Stop everything
pnpm docker:down

# Full cleanup (removes volumes)
pnpm docker:clean
```

### Building with Different Model Sizes

```bash
# Default: base model (~150MB, fastest, good accuracy)
docker compose build worker

# Small model (~500MB, better accuracy)
WHISPER_MODEL=small docker compose build worker

# Medium model (~1.5GB, great accuracy)
WHISPER_MODEL=medium docker compose build worker

# Large model (~3GB, best accuracy, needs GPU for speed)
WHISPER_MODEL=large docker compose build worker
```

**Recommendation**: Start with `base` for development, use `small` or `medium` for production.

---

---

## Code Changes Required

### Critical: Remove Hardcoded Paths

**File: `packages/worker/src/config.ts`**
```typescript
// BEFORE (hardcoded Windows paths)
remotion: {
  projectDir: process.env.REMOTION_PROJECT_DIR || 'C:/Users/armaa/test',
  bundleOutputDir: process.env.BUNDLE_OUTPUT_DIR || 'C:/Users/armaa/Documents/cllipify/bundles',
}

// AFTER (environment-only, fail if not set in production)
remotion: {
  projectDir: process.env.REMOTION_PROJECT_DIR || './remotion-workspace',
  bundleOutputDir: process.env.BUNDLE_OUTPUT_DIR || './bundles',
}
```

**File: `packages/api/src/config.ts`**
```typescript
// BEFORE
bundles: {
  dir: process.env.BUNDLE_OUTPUT_DIR || 'C:/Users/armaa/Documents/cllipify/bundles',
}

// AFTER - Remove static file serving, use S3
// bundles.dir no longer needed - served from MinIO
```

### API: Change Bundle Serving to S3

**Current:** Static file serving from filesystem
```typescript
// REMOVE THIS
await fastify.register(fastifyStatic, {
  root: config.bundles.dir,
  prefix: '/bundles/',
});
```

**New:** Proxy or redirect to MinIO presigned URLs
```typescript
// ADD: New route for bundle access
fastify.get('/bundles/:compositionId/*', async (request, reply) => {
  const { compositionId } = request.params;
  const path = request.params['*'];
  const key = `${compositionId}/${path}`;

  // Option A: Redirect to presigned URL
  const url = await minioClient.presignedGetObject('bundles', key, 3600);
  return reply.redirect(302, url);

  // Option B: Proxy the content (for CORS)
  const stream = await minioClient.getObject('bundles', key);
  return reply.type(getMimeType(path)).send(stream);
});
```

### visual-gen: Fully Ephemeral Processing

The visual-gen service must use **only local temp storage** and upload everything to MinIO:

```typescript
// Job data comes from Redis (not filesystem)
const job = await queue.process('generate-visuals', async (job) => {
  const { projectId, compositionId, transcript, style, dimensions } = job.data;

  // ALL work in ephemeral temp directory
  const workDir = join(tmpdir(), `visual-gen-${job.id}`);
  await mkdir(workDir, { recursive: true });

  try {
    // 1. Write source files to LOCAL temp
    const srcDir = join(workDir, 'src');
    await generateSourceFiles(srcDir, { transcript, style, dimensions });

    // 2. Bundle Remotion in LOCAL temp
    const bundleDir = join(workDir, 'bundle');
    await bundleRemotionProject(srcDir, bundleDir);

    // 3. Upload entire bundle to MinIO
    await uploadDirectory('bundles', compositionId, bundleDir);

    // 4. Update database with S3 URL
    await db.update(visuals).set({
      bundleUrl: `bundles/${compositionId}/index.html`,
    });

  } finally {
    // 5. ALWAYS cleanup local files
    await rm(workDir, { recursive: true, force: true });
  }
});
```

### Key Change: Job Data in Redis, Not Filesystem

**Current (not scalable):**
```typescript
// Writes prompt to filesystem, mounts into container
const promptPath = join(tmpdir(), `prompt-${jobId}.txt`);
await writeFile(promptPath, prompt);
spawn('docker', ['-v', `${promptPath}:/tmp/prompt.txt`]);
```

**Scalable:**
```typescript
// All job data serialized in Redis
await queue.add('generate-visuals', {
  projectId,
  compositionId,
  transcript: transcriptWords,  // Inline, not file path
  style: 'modern',
  dimensions: { width: 1080, height: 1920 },
  // Max job data size: ~256KB (Redis limit configurable)
});
```

### Worker: Remove generate-visuals Processor

The worker service no longer handles visual generation:

```typescript
// packages/worker/src/index.ts

// REMOVE: generate-visuals queue registration
// This is now handled by visual-gen service
```

### Database Migrations

Add migration runner to service startup:

**Option A: Init container in docker-compose.yml**
```yaml
services:
  db-migrate:
    build: ./docker/api
    command: pnpm db:migrate
    depends_on:
      postgres:
        condition: service_healthy
    restart: "no"

  api:
    depends_on:
      db-migrate:
        condition: service_completed_successfully
```

**Option B: Entrypoint script**
```bash
#!/bin/sh
# docker/api/entrypoint.sh
pnpm db:migrate
exec node dist/index.js
```

---

## visual-gen Service Architecture

### Implementation: TypeScript + Python Subprocess

The visual-gen service is a Node.js BullMQ consumer that calls Python as a subprocess:

```
┌─────────────────────────────────────────────────────────────────┐
│                     visual-gen service                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐     ┌──────────────────────────────────────┐  │
│  │ BullMQ       │     │ Python subprocess                     │  │
│  │ Consumer     │────▶│ visual_generator.py                   │  │
│  │ (TypeScript) │     │ (OpenHands agent + Remotion)          │  │
│  └──────────────┘     └──────────────────────────────────────┘  │
│         │                              │                         │
│         │                              ▼                         │
│         │                    ┌──────────────────┐               │
│         │                    │ Local bundle     │               │
│         │                    │ /tmp/bundle-xxx  │               │
│         │                    └────────┬─────────┘               │
│         │                             │                         │
│         │                             ▼                         │
│         │                    ┌──────────────────┐               │
│         │                    │ Upload to MinIO  │               │
│         │                    │ s3://bundles/... │               │
│         │                    └──────────────────┘               │
│         │                                                       │
│         ▼                                                       │
│  ┌──────────────┐                                               │
│  │ Update DB    │                                               │
│  │ (job status) │                                               │
│  └──────────────┘                                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### What Moves from Worker to visual-gen

| Component | From | To |
|-----------|------|-----|
| `generate-visuals.ts` processor | worker | visual-gen |
| OpenHands Python agent | docker/openhands-sandbox | visual-gen image |
| Remotion bundling | spawned container | visual-gen image |
| LLM API calls | spawned container | visual-gen directly |

### visual-gen Dockerfile

Based on openhands-sandbox but as a long-running service:

```dockerfile
FROM python:3.12-slim-bookworm

# System dependencies (Node.js, Chromium, FFmpeg)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl git wget \
    # Chromium dependencies for Remotion
    libnss3 libdbus-1-3 libatk1.0-0 libasound2 \
    libxrandr2 libxkbcommon-dev libxfixes3 libxcomposite1 \
    libxdamage1 libgbm-dev libcups2 libcairo2 libpango-1.0-0 \
    # Fonts
    fonts-liberation fonts-noto-color-emoji fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 20
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs

# Install pnpm and global tools
RUN npm install -g pnpm @remotion/cli typescript

# Install Python dependencies
RUN pip install --no-cache-dir \
    openhands-sdk litellm openai pydantic

# Copy and install Node.js app (BullMQ consumer)
WORKDIR /app
COPY package*.json pnpm-lock.yaml ./
COPY packages/shared ./packages/shared
RUN pnpm install --frozen-lockfile

# Copy visual-gen specific code
COPY docker/visual-gen/src ./src
COPY docker/visual-gen/scripts ./scripts

# Copy Remotion template
COPY docker/visual-gen/remotion-template ./remotion-template
RUN cd remotion-template && npm install && npx remotion browser ensure

# Pre-warm Remotion webpack cache
RUN cd remotion-template && npx remotion still ./src/index.ts placeholder /tmp/prewarm.png --frame=0 || true

ENV NODE_OPTIONS="--max-old-space-size=4096"

CMD ["node", "dist/index.js"]
```

---

## Summary

| Aspect | Decision |
|--------|----------|
| Architecture | 7 services (postgres, redis, minio, web, api, worker, visual-gen) |
| Visual generation | Separate `visual-gen` service, TypeScript + Python subprocess |
| Bundle storage | MinIO/S3 only (no shared filesystem) |
| Bundle serving | API proxies/redirects to MinIO presigned URLs |
| LLM | OpenRouter API only |
| ML models | Baked into worker image (Whisper base by default, configurable) |
| Cloud-ready | Yes - env-based config, S3-compatible storage, no shared volumes |
| Shared volumes | None between app services (only infra persistence) |
| DB migrations | Init container runs before API starts |
