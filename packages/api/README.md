# @reelify/api

REST API server for Cllipify, built with Fastify.

## Overview

The API package provides:
- RESTful endpoints for project management
- WebSocket connections for real-time updates
- Job queue management with BullMQ
- File upload handling with presigned URLs
- Bundle serving from S3 storage

## Architecture

```
src/
├── index.ts          # Server entry point
├── config.ts         # Environment configuration
├── routes/
│   └── projects.ts   # Project CRUD + job triggers
├── services/
│   ├── minio.ts      # S3-compatible storage
│   ├── queue.ts      # BullMQ job queues
│   └── db.ts         # PostgreSQL with Drizzle
├── ws/
│   └── handler.ts    # WebSocket for real-time updates
└── db/
    └── schema.ts     # Database schema
```

## Key Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/api/projects` | List all projects |
| POST | `/api/projects` | Create project |
| GET | `/api/projects/:id` | Get project details |
| DELETE | `/api/projects/:id` | Delete project |
| POST | `/api/projects/:id/upload-url` | Get presigned upload URL |
| POST | `/api/projects/:id/transcribe` | Trigger transcription job |
| POST | `/api/projects/:id/generate-visuals` | Trigger visual generation |
| POST | `/api/projects/:id/render` | Trigger video render |
| GET | `/api/bundles/:compositionId/*` | Serve bundle files from S3 |

## Development

```bash
# Start development server
pnpm dev

# Build for production
pnpm build

# Type check
pnpm typecheck

# Lint
pnpm lint
```

## Environment Variables

See `packages/api/.env.example` for full list.

Key variables:
- `PORT` - Server port (default: 4000)
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection for BullMQ
- `S3_*` - Storage configuration

## Database

Uses Drizzle ORM with PostgreSQL.

```bash
# Run migrations
pnpm db:migrate

# Generate migrations
pnpm db:generate

# Open Drizzle Studio
pnpm db:studio
```

## Dependencies

- **fastify** - Web framework
- **bullmq** - Job queue
- **drizzle-orm** - Database ORM
- **minio** - S3-compatible storage client
- **@reelify/shared** - Shared types and utilities
