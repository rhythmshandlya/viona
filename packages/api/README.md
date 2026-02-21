# @viona/api

REST API server for Viona, built with Fastify.

## Overview

The API package provides:
- RESTful endpoints for project management (video and audio projects)
- Creative Director AI agent with SSE streaming chat
- WebSocket connections for real-time job progress updates
- Job queue management with BullMQ (transcribe, render, generate-visuals, edit-visuals, plan-visuals, enhance-audio, svg-animation, preload-project)
- File upload handling with proxy uploads and presigned URLs
- Bundle and source file serving from S3 storage
- Authentication via Stytch (session tokens and JWTs)
- User account management

## Architecture

```
src/
├── index.ts                 # Server entry point, plugin registration, inline routes (bundles, sources, health, debug)
├── config.ts                # Environment configuration (port, DB, Redis, S3, Stytch, Anthropic)
├── routes/
│   ├── projects.ts          # Project CRUD, media streaming, job triggers, visual management
│   └── users.ts             # User profile, user projects list, account deletion
├── agent/
│   ├── agent-router.ts      # Creative Director SSE chat endpoint, conversation history, cancel
│   ├── agent-tools.ts       # MCP tool definitions (analyze_transcript, plan/generate/edit visuals, widgets)
│   ├── agent-system-prompt.ts # Dynamic system prompt builder with project context
│   └── conversation-store.ts  # Conversation + message persistence (CRUD operations)
├── middleware/
│   └── auth.ts              # Stytch session validation, user resolution, required + optional auth
├── services/
│   ├── minio.ts             # S3-compatible storage client (presigned URLs, streaming, listing)
│   ├── queue.ts             # BullMQ job queues and queue producers for all job types
│   ├── redis.ts             # Redis pub/sub for real-time job progress, completion, and errors
│   └── stytch.ts            # Stytch client, session token + JWT validation
├── ws/
│   └── handler.ts           # WebSocket handler for real-time job progress via Redis pub/sub
├── db/
│   ├── index.ts             # Drizzle ORM client + schema re-exports
│   ├── schema.ts            # Database schema (users, projects, tracks, timeline_items, jobs, transcripts, visuals, conversations, conversation_messages)
│   └── migrate.ts           # Migration runner
└── scripts/
    └── migrate.ts           # CLI migration entry point
```

## Key Endpoints

### Health & Debug

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | No | Health check |
| GET | `/debug/claude-test` | No | Test Claude CLI subprocess availability |

### Projects (`/api/projects`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/projects` | Yes | Create project (video or audio), returns presigned upload URL |
| GET | `/api/projects/:id` | Yes | Get project with tracks, items, transcript, presigned media URLs |
| PATCH | `/api/projects/:id` | Yes | Update project title, tracks, timeline items, video settings |
| DELETE | `/api/projects/:id` | Yes | Delete project (cascades to all related data) |
| POST | `/api/projects/:id/upload` | Yes | Proxy upload file directly to S3 (bypasses CORS) |
| GET | `/api/projects/:id/video` | Yes | Stream video file with range request support |
| GET | `/api/projects/:id/audio` | Yes | Stream audio file with range request support |
| GET | `/api/projects/:id/thumbnail` | Yes | Get project thumbnail image |
| GET | `/api/projects/:id/download` | Yes | Get presigned download URL for rendered output |
| POST | `/api/projects/:id/process` | Yes | Start transcription + audio enhancement (parallel for video) |
| POST | `/api/projects/:id/render` | Yes | Trigger video render job with layout settings |
| POST | `/api/projects/:id/generate-visuals` | Yes | Trigger AI visual generation (requires transcript) |
| POST | `/api/projects/:id/edit-visuals` | Yes | Edit existing visuals with AI prompt |
| POST | `/api/projects/:id/upload-image` | Yes | Upload image for SVG animation (PNG, JPEG, WebP, GIF) |
| POST | `/api/projects/:id/svg-animation` | Yes | Create SVG animation from uploaded image |
| POST | `/api/projects/:id/separate-audio` | Yes | Separate and enhance audio from video |
| POST | `/api/projects/:id/reset-status` | Yes | Reset project status to ready (recovery from failed/stuck) |
| GET | `/api/projects/:id/scenes` | Yes | Get scene info with elements and timing |
| GET | `/api/projects/:id/assets` | Yes | Get extracted component assets for AI editing |
| DELETE | `/api/projects/:id/visuals` | Yes | Delete generated visuals for re-generation |

### Jobs (`/api/jobs`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/jobs/:id` | Yes | Get job status and progress |
| POST | `/api/jobs/:id/cancel` | Yes | Cancel an active job |

### Users (`/api/users`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/users/me` | Yes | Get current user profile |
| PATCH | `/api/users/me` | Yes | Update user name/avatar |
| GET | `/api/users/me/projects` | Yes | List current user's projects |
| DELETE | `/api/users/me` | Yes | Delete user account |

### Creative Director Agent (`/api/projects/:id/agent`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/projects/:id/agent/chat` | Yes | SSE streaming chat with AI agent (rate limited: 30/min) |
| GET | `/api/projects/:id/agent/conversation` | Yes | Get conversation history + active job status |
| DELETE | `/api/projects/:id/agent/conversation` | Yes | Clear conversation history |
| POST | `/api/projects/:id/agent/cancel` | Yes | Cancel active agent job |

### Bundles & Sources (inline routes in index.ts)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/bundles/:compositionId/*` | No | Serve Remotion bundle files from S3 (cached 1 year) |
| GET | `/api/sources/:compositionId` | No | List source files with categorization for AI context restore |
| GET | `/api/sources/:compositionId/*` | No | Serve source files from S3 (cached 1 hour) |
| GET | `/api/media/:prefix/*` | No | Stream media files from storage (uploads/outputs) with range support |

### WebSocket

| Path | Auth | Description |
|------|------|-------------|
| `/ws?projectId=X&token=Y` | Yes (via query param) | Real-time job progress, completion, and error events via Redis pub/sub |

## Agent System

The Creative Director is a conversational AI agent powered by Claude Agent SDK. It runs as an in-process MCP server with the following tools:

| Tool | Description |
|------|-------------|
| `analyze_transcript` | Read transcript text and word-level timestamps for a time range |
| `get_current_visuals` | List all existing visual scenes with timing and descriptions |
| `get_scene_details` | Get detailed info about a specific scene |
| `show_widget` | Show interactive UI widgets (theme picker, layout picker, confirmation, choice) |
| `plan_visuals` | Run the Director planning phase to create a scene-by-scene visual plan |
| `update_plan` | Modify scenes in an existing plan (update, split, merge, remove) |
| `start_generation` | Start generating visuals from an approved plan |
| `edit_visuals` | Make targeted edits to existing visuals |

The agent uses SSE streaming with `PassThrough` streams (not `reply.hijack()`) to preserve the Fastify plugin pipeline including CORS. Conversations are persisted to the database with periodic auto-save during streaming.

## Services

### MinIO / S3 (`services/minio.ts`)
S3-compatible object storage using a single bucket with prefix-based organization (`uploads/`, `outputs/`, `templates/`, `sources/`). Supports presigned URLs (separate client for public endpoint in production), streaming uploads/downloads, partial object reads for range requests, and object listing.

### Queue (`services/queue.ts`)
BullMQ job queues for background processing:
- `transcribe` - Speech-to-text transcription
- `render` - Video rendering with layout settings
- `generate-visuals` - AI visual generation
- `plan-visuals` - AI scene planning (Director phase)
- `edit-visuals` - AI visual editing
- `enhance-audio` - Audio separation and enhancement
- `svg-animation` - Image to animated SVG conversion
- `preload-project` - Workspace warm-up for faster edits

### Redis (`services/redis.ts`)
Redis pub/sub for real-time communication between API and workers. Channels: `job:{id}:progress`, `job:{id}:complete`, `job:{id}:error`, `project:{id}:updated`. Also persists progress to DB for polling-based fallback.

### Stytch (`services/stytch.ts`)
Authentication via Stytch session tokens and JWTs. Validates sessions and extracts user identity (email, name).

## Middleware

### Auth (`middleware/auth.ts`)
- `authMiddleware` - Required authentication. Extracts session token from `Authorization: Bearer` header or `stytch_session_token`/`stytch_session_jwt` cookies. Validates with Stytch, auto-creates user records on first login.
- `optionalAuthMiddleware` - Same extraction/validation but continues without error if no token is present.

## Development

```bash
# Start development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

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
- `REDIS_URL` - Redis connection for BullMQ and pub/sub
- `BUCKET_ENDPOINT` / `S3_ENDPOINT` - Storage endpoint
- `BUCKET_ACCESS_KEY_ID` / `S3_ACCESS_KEY` - Storage access key
- `BUCKET_SECRET_ACCESS_KEY` / `S3_SECRET_KEY` - Storage secret key
- `BUCKET_NAME` / `S3_BUCKET` - Storage bucket name (default: `viona`)
- `STYTCH_PROJECT_ID` - Stytch project ID for authentication
- `STYTCH_SECRET` - Stytch secret key
- `ANTHROPIC_MODEL` - Claude model for the agent (default: `claude-sonnet-4-5-20250929`)
- `CORS_ORIGIN` - Allowed CORS origins (comma-separated, production only)
- `COOKIE_SECRET` - Cookie signing secret (required in production)

## Database

Uses Drizzle ORM with PostgreSQL. Migrations run automatically on server startup.

Tables: `users`, `projects`, `tracks`, `timeline_items`, `jobs`, `transcripts`, `visuals`, `conversations`, `conversation_messages`.

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
- **@fastify/cors** - CORS support
- **@fastify/cookie** - Cookie parsing and signing
- **@fastify/rate-limit** - Rate limiting
- **@fastify/websocket** - WebSocket support
- **@fastify/multipart** - File upload handling
- **@fastify/static** - Static file serving (local dev bundles)
- **@anthropic-ai/claude-agent-sdk** - Claude Agent SDK for Creative Director
- **@anthropic-ai/sdk** - Anthropic SDK types
- **bullmq** - Job queue for background processing
- **ioredis** - Redis client for pub/sub and queue connections
- **drizzle-orm** - Database ORM
- **pg** - PostgreSQL driver
- **minio** - S3-compatible storage client
- **stytch** - Authentication provider
- **zod** - Request validation
- **nanoid** - ID generation
- **dotenv** - Environment variable loading
- **@viona/shared** - Shared types and utilities
