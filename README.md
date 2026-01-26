# Reelify

AI-powered video creation platform that transforms talking-head videos into visually-rich content with animated subtitles.

## Project Structure

```
reelify/
├── apps/
│   └── web/                    # Frontend (DesignCombo fork)
├── packages/
│   ├── api/                    # Fastify API server
│   ├── worker/                 # BullMQ background worker
│   └── shared/                 # Shared types and utilities
├── docker-compose.yml          # Local development services
└── docs/plans/                 # Design documents
```

## Prerequisites

- Node.js >= 20.0.0
- pnpm >= 9.0.0
- Docker and Docker Compose
- FFmpeg (for video processing)

## Setup

### 1. Clone and install dependencies

```bash
git clone <repo-url>
cd reelify
pnpm install
```

### 2. Set up the frontend (DesignCombo fork)

```bash
# Clone designcombo into apps/web
git clone https://github.com/designcombo/react-video-editor.git apps/web
cd apps/web
rm -rf .git  # Remove their git history
cd ../..
```

### 3. Start Docker services

```bash
pnpm docker:up
```

This starts:
- Redis (port 6379) - Job queue and pub/sub
- MinIO (ports 9000, 9001) - S3-compatible storage
- PostgreSQL (port 5432) - Database

### 4. Run database migrations

```bash
pnpm db:migrate
```

### 5. Install Whisper (one-time)

```bash
pnpm whisper:install
```

This downloads whisper.cpp and the medium.en model (~1.5GB).

### 6. Start development servers

```bash
pnpm dev
```

This starts:
- Web: http://localhost:3000
- API: http://localhost:4000
- Worker: Background job processor

## Environment Variables

Copy the example env files:

```bash
cp packages/api/.env.example packages/api/.env
cp packages/worker/.env.example packages/worker/.env
```

## Architecture

See [docs/plans/2026-01-26-phase1-subtitle-pipeline-design.md](docs/plans/2026-01-26-phase1-subtitle-pipeline-design.md) for full design documentation.

### Flow

1. User uploads video → stored in MinIO
2. API queues transcription job
3. Worker: Downloads video → Extracts audio → Whisper transcription
4. Worker: Creates subtitle track with word-level timestamps
5. User edits subtitles in video editor
6. User exports → Worker renders final video with subtitles

### Tech Stack

- **Frontend**: Next.js + React + shadcn/ui (DesignCombo fork)
- **API**: Node.js + Fastify + BullMQ
- **Worker**: Node.js + Remotion + Whisper
- **Database**: PostgreSQL + Drizzle ORM
- **Queue**: Redis + BullMQ
- **Storage**: MinIO (S3-compatible)

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all services in development mode |
| `pnpm build` | Build all packages |
| `pnpm docker:up` | Start Docker services |
| `pnpm docker:down` | Stop Docker services |
| `pnpm db:migrate` | Run database migrations |
| `pnpm whisper:install` | Install Whisper.cpp and model |
| `pnpm lint` | Run ESLint |
| `pnpm typecheck` | Run TypeScript type checking |

## MinIO Console

Access the MinIO console at http://localhost:9001

- Username: `reelify`
- Password: `reelify123`

## License

Private - All rights reserved
