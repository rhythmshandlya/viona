# Railway Deployment Guide

This guide covers deploying Viona to Railway with 3 static services (Web, API, Worker), dynamic sandbox services, and supporting infrastructure.

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                           Railway Project                            │
├─────────────┬─────────────┬─────────────┬──────────────┬────────────┤
│   Web App   │   API       │   Worker    │Infrastructure│  Sandbox   │
│  (Next.js)  │  (Fastify)  │  (Node+Py)  │              │ (dynamic,  │
│   Port 3000 │  Port 4000  │   No port   │ PostgreSQL   │  per-      │
│             │             │             │ Redis        │  project)  │
│             │             │             │ S3 Bucket    │            │
└─────────────┴─────────────┴─────────────┴──────────────┴────────────┘
```

## Prerequisites

1. Railway account (https://railway.app)
2. GitHub repository connected to Railway
3. Anthropic API key for Claude Agent SDK

## Step 1: Create Railway Project

1. Go to Railway Dashboard → New Project
2. Select "Empty Project"
3. Name it (e.g., "viona")

## Step 2: Add Infrastructure Services

### PostgreSQL
1. Click "New" → "Database" → "PostgreSQL"
2. Railway auto-provisions the database
3. Note: `DATABASE_URL` is auto-injected

### Redis
1. Click "New" → "Database" → "Redis"
2. Railway auto-provisions Redis
3. Note: `REDIS_URL` is auto-injected

### Storage Bucket
1. Click "New" → "Storage" → "Object Storage"
2. Railway creates an S3-compatible bucket
3. Note: These vars are auto-injected:
   - `BUCKET_ENDPOINT`
   - `BUCKET_ACCESS_KEY_ID`
   - `BUCKET_SECRET_ACCESS_KEY`
   - `BUCKET_NAME`

## Step 3: Deploy Services

### API Service
1. Click "New" → "GitHub Repo" → Select your repo
2. Configure:
   - **Name**: `api`
   - **Root Directory**: Leave empty (uses repo root)
   - **Config Path**: `packages/api/railway.toml`
3. Add environment variables:
   ```
   PORT=4000
   NODE_ENV=production
   ```
4. Link to PostgreSQL, Redis, and Storage Bucket (via Railway's service linking)

### Worker Service
1. Click "New" → "GitHub Repo" → Select your repo
2. Configure:
   - **Name**: `worker`
   - **Root Directory**: Leave empty (uses repo root)
   - **Config Path**: `packages/worker/railway.toml`
3. Add environment variables:
   ```
   NODE_ENV=production
   RAILWAY_ENVIRONMENT=true
   TRANSCRIPTION_MODE=api
   AUDIO_ENHANCEMENT_ENABLED=false
   OPENAI_API_KEY=sk-...
   ANTHROPIC_API_KEY=sk-ant-...
   CLAUDE_AGENT_MODEL=claude-sonnet-4-20250514
   ```
4. Link to PostgreSQL, Redis, and Storage Bucket

### Web Service
1. Click "New" → "GitHub Repo" → Select your repo
2. Configure:
   - **Name**: `web`
   - **Root Directory**: Leave empty (uses repo root)
   - **Config Path**: `apps/web/railway.toml`
3. Add environment variables:
   ```
   NODE_ENV=production
   NEXT_PUBLIC_API_URL=https://api-<your-project>.railway.app
   NEXT_PUBLIC_WS_URL=wss://api-<your-project>.railway.app
   ```
4. Generate domain: Settings → Networking → Generate Domain

### Sandbox Pipeline (Dynamic)

The sandbox is **not** a static Railway service — the API dynamically creates sandbox services on-demand via Railway's GraphQL API. Each project gets its own ephemeral container + persistent volume.

**Setup — add these env vars to the API service:**

```
SANDBOX_PROVIDER=railway
RAILWAY_API_TOKEN=<generate at railway.com → Account → Tokens>
RAILWAY_ENVIRONMENT_ID=<from Railway dashboard URL>
ANTHROPIC_API_KEY=sk-ant-...
```

**How it works:**
1. User opens a project in the editor → API calls Railway `serviceCreate` with `source: { repo }`
2. Railway builds the sandbox from `packages/sandbox/Dockerfile`
3. A volume is mounted at `/workspace` for the project files
4. After 10 min idle, the sandbox is suspended (volume backed up, service destroyed)
5. On next open, the volume is restored from backup

**Optimization (optional):** For faster sandbox creation (~30s vs ~3-5min), push the sandbox image to a Docker registry and set `SANDBOX_IMAGE=<registry-url>` on the API service.

## Step 4: Upload Remotion Template

Before the worker can generate visuals, upload the template to S3:

```bash
# Set environment variables (get from Railway dashboard)
export BUCKET_ENDPOINT=...
export BUCKET_ACCESS_KEY_ID=...
export BUCKET_SECRET_ACCESS_KEY=...
export BUCKET_NAME=...

# Upload template
cd packages/worker
pnpm run upload-template
```

## Step 5: Run Database Migrations

```bash
# Set DATABASE_URL from Railway
export DATABASE_URL=postgresql://...

# Run migrations
pnpm --filter @viona/api db:migrate
```

## Environment Variables Reference

### API Service
| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port (default: 4000) | No |
| `DATABASE_URL` | PostgreSQL connection string | Yes (auto-injected) |
| `REDIS_URL` | Redis connection string | Yes (auto-injected) |
| `BUCKET_*` | S3 storage credentials | Yes (auto-injected) |
| `SANDBOX_PROVIDER` | `railway` for production | Yes (prod) |
| `RAILWAY_API_TOKEN` | Railway API token for sandbox management | Yes (prod) |
| `RAILWAY_ENVIRONMENT_ID` | Railway environment ID | Yes (prod) |
| `ANTHROPIC_API_KEY` | Claude API key (passed to sandboxes) | Yes |
| `SANDBOX_REPO` | GitHub repo for sandbox builds (default: `rhythmshandlya/clippify`) | No |
| `SANDBOX_BRANCH` | Branch to build sandbox from (default: `main`) | No |

### Worker Service
| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes (auto-injected) |
| `REDIS_URL` | Redis connection string | Yes (auto-injected) |
| `BUCKET_*` | S3 storage credentials | Yes (auto-injected) |
| `ANTHROPIC_API_KEY` | Claude API key | Yes |
| `OPENAI_API_KEY` | OpenAI API key (for transcription) | Yes |
| `TRANSCRIPTION_MODE` | `api` for production | Yes |
| `AUDIO_ENHANCEMENT_ENABLED` | `false` for production | Yes |
| `CLAUDE_AGENT_MODEL` | Claude model ID | No |

### Web Service
| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_API_URL` | API server URL | Yes |
| `NEXT_PUBLIC_WS_URL` | WebSocket URL | Yes |

## Troubleshooting

### Build Fails
- Check that all workspace packages are included in the Dockerfile
- Verify `pnpm-lock.yaml` is up to date

### Worker Can't Connect to Storage
- Ensure Storage Bucket is linked to the Worker service
- Check `BUCKET_*` env vars are injected

### Template Not Found
- Run `pnpm run upload-template` with correct credentials
- Verify template exists: check S3 bucket for `templates/remotion-template.zip`

### Database Connection Issues
- Ensure PostgreSQL is linked to the service
- Check `DATABASE_URL` is injected

## Local Development vs Production

| Feature | Local (Dev) | Railway (Prod) |
|---------|-------------|----------------|
| Transcription | WhisperX (local) | OpenAI API |
| Audio Enhancement | Enabled | Disabled |
| Storage | MinIO (Docker) | Railway Bucket |
| Template | Local directory | S3 download |
| Bundles | Shared directory | Ephemeral |
| Sandbox | Docker containers | Railway dynamic services |

## Updating

Push to main branch triggers automatic redeployment of affected services based on watch patterns:

- `packages/api/**` → API redeploys
- `packages/worker/**` → Worker redeploys
- `apps/web/**` → Web redeploys
- `packages/shared/**` → All services redeploy
