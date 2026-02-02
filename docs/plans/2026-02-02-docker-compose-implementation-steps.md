# Docker Compose Implementation Steps

Detailed step-by-step guide for implementing the Docker Compose full stack setup.

**Prerequisites:**
- Docker and Docker Compose installed
- Node.js 20+ and pnpm installed (for local testing)
- OpenRouter API key (for visual generation)

**Reference:** See `2026-02-02-docker-compose-full-stack-design.md` for architecture decisions.

---

## Phase 1: Code Cleanup & S3 Compatibility

### Step 1.1: Update API S3 Config

**File:** `packages/api/src/config.ts`

```typescript
// FIND this section:
minio: {
  endpoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT || '9000', 10),
  accessKey: process.env.MINIO_ACCESS_KEY || 'reelify',
  secretKey: process.env.MINIO_SECRET_KEY || 'reelify123',
  useSSL: process.env.MINIO_USE_SSL === 'true',
  buckets: {
    uploads: process.env.MINIO_BUCKET_UPLOADS || 'uploads',
    outputs: process.env.MINIO_BUCKET_OUTPUTS || 'outputs',
  },
},

// REPLACE with:
s3: {
  endpoint: process.env.S3_ENDPOINT || 'localhost',
  port: process.env.S3_PORT ? parseInt(process.env.S3_PORT, 10) : undefined,
  region: process.env.S3_REGION || 'us-east-1',
  accessKey: process.env.S3_ACCESS_KEY || 'clipify',
  secretKey: process.env.S3_SECRET_KEY || 'clipify123',
  useSSL: process.env.S3_USE_SSL === 'true',
  pathStyle: process.env.S3_PATH_STYLE !== 'false',
  buckets: {
    uploads: process.env.S3_BUCKET_UPLOADS || 'uploads',
    outputs: process.env.S3_BUCKET_OUTPUTS || 'outputs',
    bundles: process.env.S3_BUCKET_BUNDLES || 'bundles',
  },
},
```

**Also:** Remove the `bundles.dir` config (no longer needed):
```typescript
// DELETE this section:
bundles: {
  dir: process.env.BUNDLE_OUTPUT_DIR || 'C:/Users/armaa/Documents/cllipify/bundles',
},
```

### Step 1.2: Update API S3 Service

**File:** `packages/api/src/services/minio.ts`

```typescript
// REPLACE entire file with:
import { Client } from 'minio';
import { config } from '../config.js';

export const s3Client = new Client({
  endPoint: config.s3.endpoint,
  ...(config.s3.port && { port: config.s3.port }),
  region: config.s3.region,
  useSSL: config.s3.useSSL,
  accessKey: config.s3.accessKey,
  secretKey: config.s3.secretKey,
  pathStyle: config.s3.pathStyle,
});

export async function ensureBuckets() {
  const buckets = [
    config.s3.buckets.uploads,
    config.s3.buckets.outputs,
    config.s3.buckets.bundles,
  ];

  for (const bucket of buckets) {
    const exists = await s3Client.bucketExists(bucket);
    if (!exists) {
      await s3Client.makeBucket(bucket, config.s3.region);
      console.log(`Created bucket: ${bucket}`);
    }
  }
}

export async function getPresignedUploadUrl(
  bucket: string,
  key: string,
  expirySeconds = 3600
): Promise<string> {
  return s3Client.presignedPutObject(bucket, key, expirySeconds);
}

export async function getPresignedDownloadUrl(
  bucket: string,
  key: string,
  expirySeconds = 3600
): Promise<string> {
  return s3Client.presignedGetObject(bucket, key, expirySeconds);
}

export async function deleteObject(bucket: string, key: string): Promise<void> {
  await s3Client.removeObject(bucket, key);
}

export async function objectExists(bucket: string, key: string): Promise<boolean> {
  try {
    await s3Client.statObject(bucket, key);
    return true;
  } catch {
    return false;
  }
}

export async function getObjectStream(bucket: string, key: string) {
  return s3Client.getObject(bucket, key);
}

export async function getPartialObjectStream(
  bucket: string,
  key: string,
  offset: number,
  length?: number,
) {
  return length !== undefined
    ? s3Client.getPartialObject(bucket, key, offset, length)
    : s3Client.getPartialObject(bucket, key, offset);
}

export async function getObjectStat(bucket: string, key: string) {
  return s3Client.statObject(bucket, key);
}
```

### Step 1.3: Update API Imports

**Find all files that import from minio.ts and update:**

```bash
# Run this to find all imports:
grep -r "from.*minio" packages/api/src --include="*.ts"
```

**For each file found, update:**
```typescript
// BEFORE:
import { minioClient, ... } from '../services/minio.js';

// AFTER:
import { s3Client, ... } from '../services/minio.js';
```

**Files likely affected:**
- `packages/api/src/index.ts`
- `packages/api/src/routes/projects.ts`
- `packages/api/src/routes/uploads.ts`

### Step 1.4: Update Worker S3 Config

**File:** `packages/worker/src/config.ts`

```typescript
// FIND this section:
minio: {
  endpoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT || '9000', 10),
  accessKey: process.env.MINIO_ACCESS_KEY || 'reelify',
  secretKey: process.env.MINIO_SECRET_KEY || 'reelify123',
  useSSL: process.env.MINIO_USE_SSL === 'true',
  buckets: {
    uploads: process.env.MINIO_BUCKET_UPLOADS || 'uploads',
    outputs: process.env.MINIO_BUCKET_OUTPUTS || 'outputs',
  },
},

// REPLACE with:
s3: {
  endpoint: process.env.S3_ENDPOINT || 'localhost',
  port: process.env.S3_PORT ? parseInt(process.env.S3_PORT, 10) : undefined,
  region: process.env.S3_REGION || 'us-east-1',
  accessKey: process.env.S3_ACCESS_KEY || 'clipify',
  secretKey: process.env.S3_SECRET_KEY || 'clipify123',
  useSSL: process.env.S3_USE_SSL === 'true',
  pathStyle: process.env.S3_PATH_STYLE !== 'false',
  buckets: {
    uploads: process.env.S3_BUCKET_UPLOADS || 'uploads',
    outputs: process.env.S3_BUCKET_OUTPUTS || 'outputs',
    bundles: process.env.S3_BUCKET_BUNDLES || 'bundles',
  },
},
```

**Also:** Remove hardcoded Windows paths:
```typescript
// FIND:
remotion: {
  projectDir: process.env.REMOTION_PROJECT_DIR || 'C:/Users/armaa/test',
  bundleOutputDir: process.env.BUNDLE_OUTPUT_DIR || 'C:/Users/armaa/Documents/cllipify/bundles',
},

// REPLACE with:
remotion: {
  projectDir: process.env.REMOTION_PROJECT_DIR || './remotion-workspace',
},
// Note: bundleOutputDir removed - bundles go to S3 now
```

### Step 1.5: Update Worker S3 Service

**File:** `packages/worker/src/services/minio.ts`

```typescript
// REPLACE entire file with:
import { Client } from 'minio';
import { createWriteStream, createReadStream } from 'fs';
import { readdir, stat } from 'fs/promises';
import { join } from 'path';
import { pipeline } from 'stream/promises';
import { config } from '../config.js';

export const s3Client = new Client({
  endPoint: config.s3.endpoint,
  ...(config.s3.port && { port: config.s3.port }),
  region: config.s3.region,
  useSSL: config.s3.useSSL,
  accessKey: config.s3.accessKey,
  secretKey: config.s3.secretKey,
  pathStyle: config.s3.pathStyle,
});

export async function downloadFile(bucket: string, key: string, destPath: string): Promise<void> {
  const stream = await s3Client.getObject(bucket, key);
  const writeStream = createWriteStream(destPath);
  await pipeline(stream, writeStream);
}

export async function uploadFile(bucket: string, key: string, srcPath: string): Promise<void> {
  await s3Client.fPutObject(bucket, key, srcPath);
}

export async function uploadDirectory(bucket: string, prefix: string, dirPath: string): Promise<void> {
  const entries = await readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);
    const s3Key = prefix ? `${prefix}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      await uploadDirectory(bucket, s3Key, fullPath);
    } else {
      await s3Client.fPutObject(bucket, s3Key, fullPath);
    }
  }
}

export async function getObjectStream(bucket: string, key: string) {
  return s3Client.getObject(bucket, key);
}

export async function deleteDirectory(bucket: string, prefix: string): Promise<void> {
  const objects = s3Client.listObjects(bucket, prefix, true);
  const objectsToDelete: string[] = [];

  for await (const obj of objects) {
    if (obj.name) {
      objectsToDelete.push(obj.name);
    }
  }

  if (objectsToDelete.length > 0) {
    await s3Client.removeObjects(bucket, objectsToDelete);
  }
}
```

### Step 1.6: Update Worker Imports

**Find all files that use minio and update:**

```bash
grep -r "from.*minio\|minioClient\|config\.minio" packages/worker/src --include="*.ts"
```

**Update each file:**
- Change `minioClient` → `s3Client`
- Change `config.minio` → `config.s3`

**Files likely affected:**
- `packages/worker/src/processors/transcribe.ts`
- `packages/worker/src/processors/render.ts`
- `packages/worker/src/processors/enhance-audio.ts`
- `packages/worker/src/processors/generate-visuals.ts`

### Step 1.7: Create .dockerignore

**File:** `.dockerignore` (in project root)

```
# Dependencies
node_modules
**/node_modules
**/.pnpm-store

# Build outputs
dist
**/dist
.next
**/.next
out

# Development
.git
.gitignore
*.md
docs/

# Environment
.env
.env.*
!.env.example

# IDE
.vscode
.idea
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Test
coverage
**/__tests__
**/*.test.ts
**/*.spec.ts

# Python
__pycache__
*.pyc
.venv
venv

# Logs
*.log
logs/

# Temp
tmp/
temp/
*.tmp
```

### Step 1.8: Update .env for Local Development

**File:** `.env` (update existing or create)

```bash
# Database
DATABASE_URL=postgresql://clipify:clipify123@localhost:5432/clipify

# Redis
REDIS_URL=redis://localhost:6379

# S3 (MinIO for local dev)
S3_ENDPOINT=localhost
S3_PORT=9000
S3_REGION=us-east-1
S3_ACCESS_KEY=clipify
S3_SECRET_KEY=clipify123
S3_USE_SSL=false
S3_PATH_STYLE=true
S3_BUCKET_UPLOADS=uploads
S3_BUCKET_OUTPUTS=outputs
S3_BUCKET_BUNDLES=bundles

# Remotion
REMOTION_PROJECT_DIR=./remotion-workspace

# Whisper
WHISPER_MODEL=base
WHISPER_DEVICE=cpu

# LLM
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=your-key-here
```

### Step 1.9: Verify Changes

```bash
# 1. Start infrastructure
docker compose up -d postgres redis minio

# 2. Build packages
pnpm build

# 3. Run API (should start without errors)
pnpm dev:api

# 4. Run Worker (should start without errors)
pnpm dev:worker

# 5. Check S3 buckets created
# Open http://localhost:9001 (MinIO console)
# Login: clipify / clipify123
# Verify buckets: uploads, outputs, bundles exist
```

**Checkpoint:** All services start without errors, buckets created in MinIO.

---

## Phase 2: Infrastructure Dockerfiles

### Step 2.1: Create API Dockerfile

**File:** `docker/api/Dockerfile`

```dockerfile
# =============================================================================
# Stage 1: Dependencies
# =============================================================================
FROM node:20-alpine AS deps

RUN corepack enable pnpm

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/api/package.json ./packages/api/

# Install dependencies
RUN pnpm install --frozen-lockfile --filter @reelify/api...

# =============================================================================
# Stage 2: Builder
# =============================================================================
FROM node:20-alpine AS builder

RUN corepack enable pnpm

WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/packages/api/node_modules ./packages/api/node_modules

# Copy source
COPY packages/shared ./packages/shared
COPY packages/api ./packages/api
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Build
RUN pnpm --filter @reelify/shared build
RUN pnpm --filter @reelify/api build

# =============================================================================
# Stage 3: Runner
# =============================================================================
FROM node:20-alpine AS runner

WORKDIR /app

# Copy built files
COPY --from=builder /app/packages/api/dist ./dist
COPY --from=builder /app/packages/api/package.json ./
COPY --from=builder /app/node_modules ./node_modules

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 api
USER api

EXPOSE 4000

ENV NODE_ENV=production
ENV PORT=4000

CMD ["node", "dist/index.js"]
```

### Step 2.2: Create Web Dockerfile

**File:** `docker/web/Dockerfile`

```dockerfile
# =============================================================================
# Stage 1: Dependencies
# =============================================================================
FROM node:20-alpine AS deps

RUN corepack enable pnpm

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/renderer/package.json ./packages/renderer/
COPY apps/web/package.json ./apps/web/

# Install dependencies
RUN pnpm install --frozen-lockfile --filter web...

# =============================================================================
# Stage 2: Builder
# =============================================================================
FROM node:20-alpine AS builder

RUN corepack enable pnpm

WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules

# Copy source
COPY packages/shared ./packages/shared
COPY packages/renderer ./packages/renderer
COPY apps/web ./apps/web
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Build shared packages first
RUN pnpm --filter @reelify/shared build
RUN pnpm --filter @reelify/renderer build

# Build Next.js with standalone output
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter web build

# =============================================================================
# Stage 3: Runner
# =============================================================================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone build
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/web/server.js"]
```

**Note:** Requires Next.js standalone output. Add to `apps/web/next.config.js`:
```javascript
module.exports = {
  output: 'standalone',
  // ... other config
}
```

### Step 2.3: Create Worker Dockerfile

**File:** `docker/worker/Dockerfile`

```dockerfile
# =============================================================================
# Stage 1: Dependencies
# =============================================================================
FROM node:20-slim AS deps

RUN corepack enable pnpm

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/renderer/package.json ./packages/renderer/
COPY packages/worker/package.json ./packages/worker/

# Install dependencies
RUN pnpm install --frozen-lockfile --filter @reelify/worker...

# =============================================================================
# Stage 2: Builder
# =============================================================================
FROM node:20-slim AS builder

RUN corepack enable pnpm

WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages

# Copy source
COPY packages/shared ./packages/shared
COPY packages/renderer ./packages/renderer
COPY packages/worker ./packages/worker
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Build
RUN pnpm --filter @reelify/shared build
RUN pnpm --filter @reelify/renderer build
RUN pnpm --filter @reelify/worker build

# =============================================================================
# Stage 3: Runner with Python
# =============================================================================
FROM node:20-slim AS runner

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Create Python virtual environment
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install Python dependencies for WhisperX
RUN pip install --no-cache-dir \
    torch torchaudio --index-url https://download.pytorch.org/whl/cpu \
    openai-whisper \
    whisperx

# Pre-download Whisper model (baked into image)
ARG WHISPER_MODEL=base
ENV WHISPER_MODEL=${WHISPER_MODEL}
RUN python3 -c "import whisper; whisper.load_model('${WHISPER_MODEL}')"

WORKDIR /app

# Copy built files
COPY --from=builder /app/packages/worker/dist ./dist
COPY --from=builder /app/packages/worker/package.json ./
COPY --from=builder /app/packages/worker/scripts ./scripts
COPY --from=builder /app/node_modules ./node_modules

# Create non-root user
RUN groupadd --system --gid 1001 nodejs
RUN useradd --system --uid 1001 worker
RUN chown -R worker:nodejs /app
USER worker

ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
```

### Step 2.4: Create docker-compose.yml

**File:** `docker-compose.yml` (replace existing)

```yaml
services:
  # =============================================================================
  # Infrastructure
  # =============================================================================
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: clipify
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-clipify123}
      POSTGRES_DB: clipify
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U clipify"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
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
      - "9000:9000"
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
      mc alias set local http://minio:9000 $${MINIO_ROOT_USER:-clipify} $${MINIO_ROOT_PASSWORD:-clipify123};
      mc mb local/uploads --ignore-existing;
      mc mb local/outputs --ignore-existing;
      mc mb local/bundles --ignore-existing;
      mc anonymous set download local/bundles;
      echo 'Buckets initialized';
      "
    environment:
      MINIO_ROOT_USER: ${S3_ACCESS_KEY:-clipify}
      MINIO_ROOT_PASSWORD: ${S3_SECRET_KEY:-clipify123}

  # =============================================================================
  # Database Migration
  # =============================================================================
  db-migrate:
    build:
      context: .
      dockerfile: docker/api/Dockerfile
    command: ["node", "-e", "require('./dist/scripts/migrate.js')"]
    environment:
      DATABASE_URL: postgresql://clipify:${POSTGRES_PASSWORD:-clipify123}@postgres:5432/clipify
    depends_on:
      postgres:
        condition: service_healthy
    restart: "no"

  # =============================================================================
  # Application Services
  # =============================================================================
  api:
    build:
      context: .
      dockerfile: docker/api/Dockerfile
    ports:
      - "4000:4000"
    environment:
      NODE_ENV: production
      PORT: 4000
      DATABASE_URL: postgresql://clipify:${POSTGRES_PASSWORD:-clipify123}@postgres:5432/clipify
      REDIS_URL: redis://redis:6379
      S3_ENDPOINT: minio
      S3_PORT: 9000
      S3_REGION: us-east-1
      S3_ACCESS_KEY: ${S3_ACCESS_KEY:-clipify}
      S3_SECRET_KEY: ${S3_SECRET_KEY:-clipify123}
      S3_USE_SSL: "false"
      S3_PATH_STYLE: "true"
      S3_BUCKET_UPLOADS: uploads
      S3_BUCKET_OUTPUTS: outputs
      S3_BUCKET_BUNDLES: bundles
    depends_on:
      db-migrate:
        condition: service_completed_successfully
      redis:
        condition: service_healthy
      minio-init:
        condition: service_completed_successfully
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:4000/health"]
      interval: 10s
      timeout: 5s
      retries: 3

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

  worker:
    build:
      context: .
      dockerfile: docker/worker/Dockerfile
      args:
        WHISPER_MODEL: ${WHISPER_MODEL:-base}
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://clipify:${POSTGRES_PASSWORD:-clipify123}@postgres:5432/clipify
      REDIS_URL: redis://redis:6379
      S3_ENDPOINT: minio
      S3_PORT: 9000
      S3_REGION: us-east-1
      S3_ACCESS_KEY: ${S3_ACCESS_KEY:-clipify}
      S3_SECRET_KEY: ${S3_SECRET_KEY:-clipify123}
      S3_USE_SSL: "false"
      S3_PATH_STYLE: "true"
      S3_BUCKET_UPLOADS: uploads
      S3_BUCKET_OUTPUTS: outputs
      WHISPER_MODEL: ${WHISPER_MODEL:-base}
      WHISPER_DEVICE: cpu
    depends_on:
      db-migrate:
        condition: service_completed_successfully
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

### Step 2.5: Add Health Check Endpoint to API

**File:** `packages/api/src/index.ts`

Add before server start:
```typescript
// Health check endpoint
fastify.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});
```

### Step 2.6: Verify Phase 2

```bash
# Build all images
docker compose build

# Start infrastructure only first
docker compose up -d postgres redis minio minio-init

# Wait for MinIO init
docker compose logs minio-init

# Run migration
docker compose up db-migrate

# Start all services
docker compose up -d

# Check all services are running
docker compose ps

# Check logs for errors
docker compose logs api
docker compose logs worker
docker compose logs web

# Test API health
curl http://localhost:4000/health

# Test web
open http://localhost:3000
```

**Checkpoint:** All services running, health check returns OK, web loads.

---

## Phase 3: API Bundle Serving from S3

### Step 3.1: Remove Static Bundle Serving

**File:** `packages/api/src/index.ts`

```typescript
// FIND and REMOVE this section:
import fastifyStatic from '@fastify/static';

await fastify.register(fastifyStatic, {
  root: config.bundles.dir,
  prefix: '/bundles/',
  decorateReply: false,
});
```

### Step 3.2: Add S3 Bundle Route

**File:** `packages/api/src/routes/bundles.ts` (create new file)

```typescript
import { FastifyInstance } from 'fastify';
import { s3Client } from '../services/minio.js';
import { config } from '../config.js';

export async function bundleRoutes(fastify: FastifyInstance) {
  // Serve bundle files from S3
  fastify.get('/bundles/:compositionId/*', async (request, reply) => {
    const { compositionId } = request.params as { compositionId: string };
    const path = (request.params as { '*': string })['*'] || 'index.html';
    const key = `${compositionId}/${path}`;

    try {
      // Check if object exists
      await s3Client.statObject(config.s3.buckets.bundles, key);

      // Generate presigned URL (valid for 1 hour)
      const url = await s3Client.presignedGetObject(
        config.s3.buckets.bundles,
        key,
        3600
      );

      // Redirect to presigned URL
      return reply.redirect(302, url);
    } catch (error) {
      fastify.log.error({ compositionId, key, error }, 'Bundle not found');
      return reply.status(404).send({ error: 'Bundle not found' });
    }
  });

  // Alternative: Proxy the content (if CORS is an issue)
  fastify.get('/bundles-proxy/:compositionId/*', async (request, reply) => {
    const { compositionId } = request.params as { compositionId: string };
    const path = (request.params as { '*': string })['*'] || 'index.html';
    const key = `${compositionId}/${path}`;

    try {
      const stat = await s3Client.statObject(config.s3.buckets.bundles, key);
      const stream = await s3Client.getObject(config.s3.buckets.bundles, key);

      // Set content type based on extension
      const ext = path.split('.').pop() || '';
      const contentTypes: Record<string, string> = {
        html: 'text/html',
        js: 'application/javascript',
        css: 'text/css',
        json: 'application/json',
        png: 'image/png',
        jpg: 'image/jpeg',
        svg: 'image/svg+xml',
      };

      reply.header('Content-Type', contentTypes[ext] || 'application/octet-stream');
      reply.header('Content-Length', stat.size);

      return reply.send(stream);
    } catch (error) {
      fastify.log.error({ compositionId, key, error }, 'Bundle not found');
      return reply.status(404).send({ error: 'Bundle not found' });
    }
  });
}
```

### Step 3.3: Register Bundle Routes

**File:** `packages/api/src/index.ts`

```typescript
// Add import
import { bundleRoutes } from './routes/bundles.js';

// Register routes (add after other route registrations)
await fastify.register(bundleRoutes);
```

### Step 3.4: Update Frontend Bundle URL Handling

**File:** `apps/web/src/components/visual-player.tsx` (or similar)

The frontend should handle both redirect responses and direct URLs. No changes needed if using standard fetch/iframe - redirects are followed automatically.

### Step 3.5: Verify Phase 3

```bash
# Rebuild API
docker compose build api
docker compose up -d api

# Test bundle route (should return 404 - no bundles yet)
curl -I http://localhost:4000/bundles/test/index.html

# Upload a test file to bundles bucket via MinIO console
# Then test again - should redirect to presigned URL
```

**Checkpoint:** Bundle route returns 302 redirect to MinIO presigned URL.

---

## Phase 4: Visual Generation Service

### Step 4.1: Create visual-gen Directory Structure

```bash
mkdir -p docker/visual-gen/src
mkdir -p docker/visual-gen/scripts
mkdir -p docker/visual-gen/remotion-template
```

### Step 4.2: Create visual-gen Service Entry Point

**File:** `docker/visual-gen/src/index.ts`

```typescript
import { Worker, Job } from 'bullmq';
import { config } from './config.js';
import { processGenerateVisualsJob } from './processor.js';
import { logger } from './logger.js';

const connection = {
  host: new URL(config.redis.url).hostname,
  port: parseInt(new URL(config.redis.url).port || '6379'),
};

const worker = new Worker(
  'generate-visuals',
  async (job: Job) => {
    logger.info({ jobId: job.id, data: job.data }, 'Processing visual generation job');
    await processGenerateVisualsJob(job);
  },
  {
    connection,
    concurrency: 1,
    limiter: {
      max: 1,
      duration: 1000,
    },
  }
);

worker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Job completed');
});

worker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, error: err.message }, 'Job failed');
});

logger.info('Visual generation worker started');

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Shutting down...');
  await worker.close();
  process.exit(0);
});
```

### Step 4.3: Create visual-gen Processor

**File:** `docker/visual-gen/src/processor.ts`

This file should contain the visual generation logic adapted from `packages/worker/src/processors/generate-visuals.ts`, with these key changes:

1. Remove Docker spawning - run Python directly
2. Use local temp directories only
3. Upload bundles to S3 at the end
4. Clean up all local files

```typescript
// Key structure (full implementation requires adapting generate-visuals.ts)

import { Job } from 'bullmq';
import { spawn } from 'child_process';
import { mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { uploadDirectory, deleteDirectory } from './s3.js';
import { db, jobs, visuals } from './db.js';

export async function processGenerateVisualsJob(job: Job) {
  const { projectId, compositionId, transcript, style, dimensions } = job.data;

  // ALL work in ephemeral temp directory
  const workDir = join(tmpdir(), `visual-gen-${job.id}`);

  try {
    await mkdir(workDir, { recursive: true });

    // 1. Generate source files
    const srcDir = join(workDir, 'src');
    await generateSourceFiles(srcDir, { transcript, style, dimensions });

    // 2. Bundle Remotion
    const bundleDir = join(workDir, 'bundle');
    await bundleRemotionProject(srcDir, bundleDir);

    // 3. Upload to S3
    await uploadDirectory('bundles', compositionId, bundleDir);

    // 4. Update database
    await db.update(visuals).set({
      bundleUrl: `bundles/${compositionId}/index.html`,
    });

    await db.update(jobs).set({
      status: 'complete',
      progress: 100,
    });

  } finally {
    // 5. ALWAYS cleanup
    await rm(workDir, { recursive: true, force: true });
  }
}
```

### Step 4.4: Create visual-gen Dockerfile

**File:** `docker/visual-gen/Dockerfile`

```dockerfile
FROM python:3.12-slim-bookworm

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    wget \
    # Chromium dependencies
    libnss3 \
    libdbus-1-3 \
    libatk1.0-0 \
    libasound2 \
    libxrandr2 \
    libxkbcommon-dev \
    libxfixes3 \
    libxcomposite1 \
    libxdamage1 \
    libgbm-dev \
    libcups2 \
    libcairo2 \
    libpango-1.0-0 \
    libatk-bridge2.0-0 \
    # Fonts
    fonts-liberation \
    fonts-noto-color-emoji \
    fonts-dejavu-core \
    fontconfig \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 20
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm and Remotion CLI
RUN npm install -g pnpm @remotion/cli typescript

# Install Python dependencies
RUN pip install --no-cache-dir \
    openhands-sdk \
    litellm \
    openai \
    pydantic

# Setup Remotion template
WORKDIR /opt/remotion-template
COPY docker/visual-gen/remotion-template/package.json ./
RUN npm install
COPY docker/visual-gen/remotion-template/ ./
RUN npx remotion browser ensure

# Pre-warm webpack cache
RUN npx remotion still ./src/index.ts placeholder /tmp/prewarm.png --frame=0 || true && rm -f /tmp/prewarm.png

# Setup Node.js application
WORKDIR /app
COPY docker/visual-gen/package.json ./
RUN pnpm install

COPY docker/visual-gen/src ./src
COPY docker/visual-gen/scripts ./scripts

RUN pnpm build

ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=4096"

CMD ["node", "dist/index.js"]
```

### Step 4.5: Remove generate-visuals from Worker

**File:** `packages/worker/src/index.ts`

```typescript
// REMOVE the generate-visuals worker registration:

// FIND and DELETE:
const generateVisualsWorker = new Worker(
  'generate-visuals',
  // ...
);
```

### Step 4.6: Add visual-gen to docker-compose.yml

Add to `docker-compose.yml`:

```yaml
  visual-gen:
    build:
      context: .
      dockerfile: docker/visual-gen/Dockerfile
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://clipify:${POSTGRES_PASSWORD:-clipify123}@postgres:5432/clipify
      REDIS_URL: redis://redis:6379
      S3_ENDPOINT: minio
      S3_PORT: 9000
      S3_REGION: us-east-1
      S3_ACCESS_KEY: ${S3_ACCESS_KEY:-clipify}
      S3_SECRET_KEY: ${S3_SECRET_KEY:-clipify123}
      S3_USE_SSL: "false"
      S3_PATH_STYLE: "true"
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
      db-migrate:
        condition: service_completed_successfully
      redis:
        condition: service_healthy
```

### Step 4.7: Verify Phase 4

```bash
# Rebuild all
docker compose build

# Start
docker compose up -d

# Check visual-gen logs
docker compose logs visual-gen

# Trigger a visual generation job through the UI
# Watch logs
docker compose logs -f visual-gen

# Verify bundle uploaded to MinIO
# Check bundles bucket in MinIO console
```

**Checkpoint:** Visual generation creates bundles in S3, job completes successfully.

---

## Phase 5: Polish & Documentation

### Step 5.1: Create .env.example

**File:** `.env.example`

```bash
# =============================================================================
# Clipify Docker Compose Configuration
# =============================================================================
# Copy this file to .env and fill in your values

# -----------------------------------------------------------------------------
# Database
# -----------------------------------------------------------------------------
POSTGRES_PASSWORD=clipify123

# -----------------------------------------------------------------------------
# S3 Storage (MinIO locally, AWS S3 in production)
# -----------------------------------------------------------------------------
S3_ACCESS_KEY=clipify
S3_SECRET_KEY=clipify123

# For AWS S3:
# S3_ENDPOINT=s3.us-east-1.amazonaws.com
# S3_REGION=us-east-1
# S3_USE_SSL=true
# S3_PATH_STYLE=false

# -----------------------------------------------------------------------------
# Whisper Model (transcription)
# -----------------------------------------------------------------------------
# Options: base (150MB), small (500MB), medium (1.5GB), large (3GB)
WHISPER_MODEL=base

# -----------------------------------------------------------------------------
# LLM (visual generation)
# -----------------------------------------------------------------------------
# Get your API key from https://openrouter.ai/
OPENROUTER_API_KEY=sk-or-v1-your-key-here

# Optional: Override default model
# LLM_MODEL=google/gemini-2.0-flash-001
```

### Step 5.2: Create docker-compose.override.yml (Development)

**File:** `docker-compose.override.yml`

```yaml
# Development overrides - hot reload with volume mounts
# This file is automatically loaded by docker compose

services:
  api:
    build:
      target: deps  # Stop at deps stage for faster rebuilds
    volumes:
      - ./packages/api/src:/app/packages/api/src:ro
      - ./packages/shared/src:/app/packages/shared/src:ro
    command: ["pnpm", "--filter", "@reelify/api", "dev"]
    environment:
      NODE_ENV: development

  web:
    build:
      target: deps
    volumes:
      - ./apps/web/src:/app/apps/web/src:ro
      - ./apps/web/public:/app/apps/web/public:ro
    command: ["pnpm", "--filter", "web", "dev"]
    environment:
      NODE_ENV: development

  worker:
    volumes:
      - ./packages/worker/src:/app/src:ro
      - ./packages/worker/scripts:/app/scripts:ro
    command: ["pnpm", "--filter", "@reelify/worker", "dev"]
    environment:
      NODE_ENV: development
```

### Step 5.3: Update README

**File:** `README.md` (add Docker section)

```markdown
## Quick Start with Docker

### Prerequisites
- Docker and Docker Compose
- OpenRouter API key (for visual generation)

### Setup

1. Clone and configure:
   ```bash
   git clone https://github.com/your-org/clipify.git
   cd clipify
   cp .env.example .env
   # Edit .env and add your OPENROUTER_API_KEY
   ```

2. Start all services:
   ```bash
   docker compose up -d
   ```

3. Open the app:
   - Web UI: http://localhost:3000
   - API: http://localhost:4000
   - MinIO Console: http://localhost:9001 (clipify/clipify123)

### Common Commands

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f

# Stop all services
docker compose down

# Rebuild after code changes
docker compose build && docker compose up -d

# Full cleanup (removes volumes)
docker compose down -v
```

### Building with Different Whisper Models

```bash
# Default: base model (~150MB, fast)
docker compose build worker

# Better accuracy: small model (~500MB)
WHISPER_MODEL=small docker compose build worker

# Best accuracy: large model (~3GB, slow without GPU)
WHISPER_MODEL=large docker compose build worker
```
```

### Step 5.4: Final Verification

```bash
# Full cleanup
docker compose down -v

# Fresh start
cp .env.example .env
# Edit .env, add OPENROUTER_API_KEY

# Build and start
docker compose up -d

# Wait for all services to be healthy
docker compose ps

# Test complete workflow:
# 1. Open http://localhost:3000
# 2. Upload a video
# 3. Wait for transcription
# 4. Generate visuals
# 5. Verify bundle loads in player
```

**Final Checkpoint:** Fresh clone + `docker compose up` works end-to-end.

---

## Summary

| Phase | Steps | Key Deliverables |
|-------|-------|------------------|
| 1 | 9 | S3-compatible code, no hardcoded paths |
| 2 | 6 | Dockerfiles for api, web, worker |
| 3 | 5 | Bundle serving from S3 |
| 4 | 7 | visual-gen service |
| 5 | 4 | Documentation, dev overrides |

**Total: 31 detailed steps**
