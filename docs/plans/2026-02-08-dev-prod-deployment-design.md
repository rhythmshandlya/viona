# Dev & Prod Deployment Design

**Date:** 2026-02-08
**Status:** Draft
**Goal:** Perfect setup for dev (runs everywhere) and prod (one-shot Railway deploy)

## Overview

### Dev Mode
- Docker Compose for deps only (Redis, Postgres, MinIO)
- Services run locally (web, api, worker)
- MinIO data stored in `.minio-data/` (gitignored)
- WhisperX + audio enhancement enabled
- Python auto-detected (no hardcoded paths)
- One command setup: `pnpm setup` or `scripts/setup-dev.sh`

### Prod Mode (Railway)
- 3 separate services: web, api, worker
- Railway managed: Redis, Postgres, Simple S3
- Whisper API for transcription (no local Python ML)
- Audio enhancement disabled
- Worker downloads template from S3 on startup

## Architecture

### Dev Environment
```
┌─────────────────────────────────────────────────────┐
│  Local Machine                                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │   Web    │  │   API    │  │  Worker  │          │
│  │ (Next.js)│  │ (Node.js)│  │(Node+Py) │          │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘          │
│       │             │             │                 │
│  ─────┴─────────────┴─────────────┴──────           │
│                     │                               │
│  ┌─────────────────────────────────────────────┐   │
│  │  Docker Compose (deps only)                  │   │
│  │  ┌────────┐ ┌────────┐ ┌────────┐           │   │
│  │  │ Redis  │ │Postgres│ │ MinIO  │           │   │
│  │  └────────┘ └────────┘ └───┬────┘           │   │
│  └────────────────────────────┼────────────────┘   │
│                               │                     │
│  ┌────────────────────────────▼────────────────┐   │
│  │  .minio-data/ (gitignored)                   │   │
│  │  ├── uploads/                                │   │
│  │  ├── outputs/                                │   │
│  │  └── templates/                              │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### Prod Environment (Railway)
```
┌─────────────────────────────────────────────────────┐
│  Railway                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │   Web    │  │   API    │  │  Worker  │          │
│  │ Dockerfile│ │Dockerfile│  │Dockerfile│          │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘          │
│       │             │             │                 │
│  ┌────┴─────────────┴─────────────┴────┐           │
│  │  Railway Services                    │           │
│  │  ┌───────┐ ┌────────┐ ┌──────────┐  │           │
│  │  │ Redis │ │Postgres│ │ Simple S3│  │           │
│  │  └───────┘ └────────┘ └──────────┘  │           │
│  └─────────────────────────────────────┘           │
└─────────────────────────────────────────────────────┘
```

## Environment Configuration

### Unified .env.example
```bash
NODE_ENV=development

# Database
DATABASE_URL=postgresql://reelify:reelify123@localhost:5432/reelify

# Redis
REDIS_URL=redis://localhost:6379

# Storage (S3-compatible - MinIO locally, Railway Simple S3 in prod)
S3_ENDPOINT=localhost
S3_PORT=9000
S3_ACCESS_KEY=reelify
S3_SECRET_KEY=reelify123
S3_USE_SSL=false
S3_BUCKET_UPLOADS=uploads
S3_BUCKET_OUTPUTS=outputs
S3_BUCKET_TEMPLATES=templates

# Transcription
TRANSCRIPTION_MODE=local
# OPENAI_API_KEY=           # Required when TRANSCRIPTION_MODE=api

# Audio Enhancement
AUDIO_ENHANCEMENT_ENABLED=true

# Claude Agent SDK (for visual generation)
ANTHROPIC_API_KEY=

# API
API_URL=http://localhost:4000

# Web
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_WS_URL=ws://localhost:4000
```

### Prod Overrides (Railway Dashboard)
```bash
NODE_ENV=production
S3_ENDPOINT=your-simple-s3.railway.app
S3_PORT=443
S3_USE_SSL=true
TRANSCRIPTION_MODE=api
AUDIO_ENHANCEMENT_ENABLED=false
```

## Storage Service

### Interface
```typescript
// packages/shared/src/storage.ts
interface StorageService {
  // Templates
  uploadTemplate(files: Buffer[]): Promise<string>
  downloadTemplate(version: string): Promise<Buffer>

  // Bundles
  uploadBundle(projectId: string, files: Buffer): Promise<string>
  getBundle(projectId: string): Promise<Buffer>
  getBundleUrl(projectId: string): Promise<string>

  // Uploads/Outputs
  uploadFile(bucket: string, key: string, data: Buffer): Promise<string>
  downloadFile(bucket: string, key: string): Promise<Buffer>
  getSignedUrl(bucket: string, key: string): Promise<string>
}
```

### Worker Startup Flow
1. Worker container starts
2. Entrypoint script runs
3. Download template from S3 → `/tmp/template/`
4. Run `npm install` in template dir
5. Template ready, start processing jobs

### Per-Project Flow
1. Copy `/tmp/template` → `/tmp/projects/{projectId}/`
2. Claude generates code
3. Remotion bundles → `/tmp/bundles/{projectId}/`
4. Upload bundle to S3
5. Clean up local temp dirs

## Dockerfiles

### Worker (Node + Python)
```dockerfile
FROM node:20-slim

# Install Python and pip
RUN apt-get update && apt-get install -y \
    python3 python3-pip python3-venv \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Create python venv and install Claude SDK
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install claude-agent-sdk anthropic

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared ./packages/shared
COPY packages/worker ./packages/worker

# Install dependencies
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @reelify/worker build

# Startup script
COPY packages/worker/scripts/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "packages/worker/dist/index.js"]
```

### Worker Entrypoint
```bash
#!/bin/bash
set -e

echo "=== Worker Startup ==="

mkdir -p /tmp/template /tmp/projects /tmp/bundles

echo "Downloading template from S3..."
node /app/packages/worker/dist/scripts/download-template.js

echo "Installing template dependencies..."
cd /tmp/template && npm install --legacy-peer-deps

echo "Template ready!"
echo "=== Starting Worker ==="

exec "$@"
```

### API Dockerfile
```dockerfile
FROM node:20-slim

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared ./packages/shared
COPY packages/api ./packages/api

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @reelify/api build

CMD ["node", "packages/api/dist/index.js"]
```

### Web Dockerfile
```dockerfile
FROM node:20-slim AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/web ./apps/web

RUN pnpm install --frozen-lockfile
RUN pnpm --filter web build

FROM node:20-slim AS runner
WORKDIR /app

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

CMD ["node", "apps/web/server.js"]
```

## Python Auto-Detection

```typescript
// packages/worker/src/utils/python.ts
export async function findPython(): Promise<string> {
  const candidates = [
    process.env.PYTHON_PATH,
    '.venv/Scripts/python.exe',  // Windows local
    '.venv/bin/python',          // Unix local
    '/opt/venv/bin/python',      // Docker
    'python3',
    'python',
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      const result = await exec(`${candidate} --version`);
      if (result.stdout.includes('Python 3')) {
        return candidate;
      }
    } catch {
      continue;
    }
  }

  throw new Error('Python 3 not found');
}
```

## Transcription Mode Switching

```typescript
// packages/worker/src/processors/transcribe.ts
export async function transcribe(audioPath: string): Promise<Transcript> {
  const mode = process.env.TRANSCRIPTION_MODE || 'local';

  if (mode === 'api') {
    return transcribeWithWhisperAPI(audioPath);
  } else {
    return transcribeWithWhisperX(audioPath);
  }
}
```

## Dev Setup Script

```bash
#!/bin/bash
# scripts/setup-dev.sh
set -e

echo "=== Cllipify Dev Setup ==="

pnpm install
docker-compose up -d

# Wait for services
sleep 5

pnpm db:migrate

# Create MinIO buckets
docker-compose exec -T minio mc alias set local http://localhost:9000 reelify reelify123
docker-compose exec -T minio mc mb local/uploads --ignore-existing
docker-compose exec -T minio mc mb local/outputs --ignore-existing
docker-compose exec -T minio mc mb local/templates --ignore-existing

# Upload template
pnpm --filter @reelify/worker upload-template

# Python setup (optional)
if [ "$SKIP_PYTHON" != "true" ]; then
  cd packages/worker
  python3 -m venv .venv
  source .venv/bin/activate
  pip install claude-agent-sdk anthropic
  cd ../..
fi

echo "=== Setup Complete ==="
echo "Run 'pnpm dev' to start all services"
```

## docker-compose.yml

```yaml
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  postgres:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: reelify
      POSTGRES_PASSWORD: reelify123
      POSTGRES_DB: reelify
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U reelify"]
      interval: 5s
      timeout: 5s
      retries: 5

  minio:
    image: minio/minio:latest
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      MINIO_ROOT_USER: reelify
      MINIO_ROOT_PASSWORD: reelify123
    command: server /data --console-address ":9001"
    volumes:
      - ./.minio-data:/data
    healthcheck:
      test: ["CMD", "mc", "ready", "local"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  redis_data:
  postgres_data:
```

## Files to Create

```
scripts/
├── setup-dev.sh
├── setup-dev.ps1
└── upload-template.ts

packages/shared/src/
└── storage.ts

packages/worker/
├── Dockerfile
├── scripts/
│   ├── entrypoint.sh
│   └── download-template.ts
└── src/utils/
    └── python.ts

packages/api/
└── Dockerfile

apps/web/
└── Dockerfile

railway.json
```

## Files to Modify

```
docker-compose.yml
.gitignore
.env.example

packages/worker/src/
├── config.ts
├── processors/
│   ├── transcribe.ts
│   ├── enhance-audio.ts
│   └── generate-visuals.ts
└── services/
    └── template.ts
```

## Implementation Order

1. Storage service (packages/shared)
2. Update .gitignore
3. Update docker-compose.yml
4. Python auto-detection
5. Template to S3 (upload + download scripts)
6. Bundles to S3
7. Transcription mode switching
8. Audio enhancement toggle
9. Dockerfiles (all 3 services)
10. Dev setup scripts
11. Railway configuration and deploy

## Checklist

### Dev Mode
- [ ] One command setup works
- [ ] No hardcoded paths
- [ ] Works on Windows, Mac, Linux
- [ ] All data in `.minio-data/`
- [ ] Python auto-detected
- [ ] WhisperX + audio enhancement work

### Prod Mode
- [ ] One-click Railway deploy
- [ ] 3 independent services
- [ ] All storage via Simple S3
- [ ] Whisper API for transcription
- [ ] Audio enhancement disabled
- [ ] Worker starts with template ready
