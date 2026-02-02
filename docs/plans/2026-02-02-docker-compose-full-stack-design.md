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
| `worker` | node:20-slim | Python 3.12, FFmpeg, WhisperX |
| `visual-gen` | python:3.12-slim | Node 20, Chromium, Remotion, pnpm |

### Image Sizes (Estimated)

| Service | Size |
|---------|------|
| web | ~300MB |
| api | ~250MB |
| worker | ~1.5GB |
| visual-gen | ~2.5GB |

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
    environment:
      DATABASE_URL: postgresql://clipify:${POSTGRES_PASSWORD:-clipify123}@postgres:5432/clipify
      REDIS_URL: redis://redis:6379
      S3_ENDPOINT: http://minio:9000
      S3_ACCESS_KEY: ${S3_ACCESS_KEY:-clipify}
      S3_SECRET_KEY: ${S3_SECRET_KEY:-clipify123}
      S3_BUCKET_UPLOADS: uploads
      S3_BUCKET_OUTPUTS: outputs
      WHISPER_MODEL: ${WHISPER_MODEL:-base}
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

### Phase 1: Infrastructure & Dockerfiles
1. Create `.dockerignore`
2. Create `docker/api/Dockerfile`
3. Create `docker/web/Dockerfile`
4. Create `docker/worker/Dockerfile` (without visual-gen)
5. Create new `docker-compose.yml`
6. Test: `docker compose up` runs api, web, worker

### Phase 2: Visual Generation Service
1. Create `docker/visual-gen/Dockerfile` (based on openhands-sandbox)
2. Create `docker/visual-gen/worker.py` (BullMQ consumer)
3. Add S3 upload logic for bundles
4. Update `generate-visuals.ts` to just queue (not spawn Docker)
5. Test: visual generation works end-to-end

### Phase 3: Polish & Documentation
1. Create `.env.example`
2. Create `docker-compose.override.yml` (dev hot reload)
3. Update README with Docker instructions
4. Add health checks and proper logging

---

## Developer Workflow

```bash
# First time setup
cp .env.example .env
# Edit .env, add OPENROUTER_API_KEY

# Start everything
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

---

## Summary

| Aspect | Decision |
|--------|----------|
| Architecture | 7 services (postgres, redis, minio, web, api, worker, visual-gen) |
| Visual generation | Separate `visual-gen` service, no Docker-in-Docker |
| Storage | MinIO (local) / S3 (cloud) for bundles |
| LLM | OpenRouter API only |
| Cloud-ready | Yes - env-based config, S3-compatible storage |
| Shared volumes | None between app services (only infra persistence) |
