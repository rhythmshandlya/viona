# Viona

A full-stack video editing platform for creating short-form social media content with AI-generated visuals, automated transcription, and professional subtitle styling.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Monorepo Structure](#monorepo-structure)
- [System Diagrams](#system-diagrams)
- [Setup & Installation](#setup--installation)
- [Environment Variables](#environment-variables)
- [Development](#development)
- [Database Schema](#database-schema)
- [API Reference](#api-reference)
- [Features](#features)

---

## Overview

Viona is a modern video editor designed for creating Instagram Reels, TikTok videos, and YouTube Shorts. It combines:

- **Automated Transcription**: Word-level speech-to-text using WhisperX
- **AI Visual Generation**: Animated diagrams, charts, and infographics using Claude Agent SDK + Remotion
- **Creative Director Agent**: Conversational AI assistant for planning and editing visuals
- **Professional Subtitles**: 15+ animation presets with word-level styling
- **Audio Enhancement**: Loudness normalization and noise reduction
- **Real-time Progress**: WebSocket-based job tracking

---

## Architecture

### High-Level Overview

```mermaid
graph TB
    subgraph Frontend ["Frontend"]
        WEB[Web App<br/>Next.js 15 + React 19]
        LANDING[Landing Page<br/>Astro]
    end

    subgraph Backend ["Backend Services"]
        API[Fastify API<br/>Port 4000]
        AGENT[Creative Director<br/>Agent SSE]
        WORKER[Worker Process<br/>15 Job Processors]
    end

    subgraph Infrastructure ["Infrastructure"]
        PG[(PostgreSQL)]
        REDIS[(Redis)]
        MINIO[(MinIO / Railway<br/>Object Storage)]
    end

    subgraph AI ["AI Layer"]
        CLAUDE_SDK[Claude Agent SDK<br/>Visual Generation]
        CLAUDE_CLI[Claude CLI<br/>Subprocess]
        MCP[MCP Servers<br/>Assets + Viewport]
    end

    subgraph Processing ["Processing"]
        WHISPER[WhisperX<br/>Transcription]
        REMOTION[Remotion<br/>Video Rendering]
        FFMPEG[FFmpeg<br/>Audio/Video]
    end

    WEB --> API
    WEB -.WebSocket.-> API
    WEB -.SSE.-> AGENT
    API --> PG
    API --> REDIS
    API --> MINIO
    AGENT --> CLAUDE_SDK
    REDIS --> WORKER
    WORKER --> PG
    WORKER --> MINIO
    WORKER --> WHISPER
    WORKER --> CLAUDE_CLI
    CLAUDE_CLI --> MCP
    WORKER --> REMOTION
    WORKER --> FFMPEG
```

### Request Flow

```mermaid
sequenceDiagram
    participant U as User
    participant W as Web App
    participant A as API
    participant Q as Redis Queue
    participant WK as Worker
    participant M as MinIO
    participant DB as PostgreSQL

    U->>W: Upload Video
    W->>A: POST /api/projects
    A->>DB: Create project
    A->>M: Generate presigned URL
    A-->>W: Return upload URL
    W->>M: PUT video file

    U->>W: Click Process
    W->>A: POST /projects/:id/process
    A->>DB: Create jobs
    A->>Q: Queue transcribe job
    A-->>W: Return jobId

    Q->>WK: Dequeue job
    WK->>M: Download video
    WK->>WK: Run WhisperX
    WK->>DB: Save transcript
    WK->>A: Publish progress (Redis)
    A-->>W: WebSocket updates

    U->>W: Click Render
    W->>A: POST /projects/:id/render
    A->>Q: Queue render job
    WK->>WK: Remotion render
    WK->>M: Upload output
    WK->>DB: Update project

    U->>W: Download
    W->>A: GET /projects/:id/download
    A->>M: Generate download URL
    A-->>W: Presigned URL
```

---

## Tech Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| Next.js 15 | React framework (App Router) |
| React 19 | UI library |
| Astro | Landing page |
| TypeScript 5 | Type safety |
| Tailwind CSS 4 | Styling |
| Zustand | State management |
| Remotion | Video composition & preview |
| Radix UI | Accessible components |

### Backend
| Technology | Purpose |
|------------|---------|
| Fastify | HTTP server + WebSocket + SSE |
| Drizzle ORM | Database ORM & migrations |
| BullMQ | Job queue (15 processor types) |
| PostgreSQL 16 | Database |
| Redis 7 | Cache, queue & pub/sub |
| MinIO / Railway Bucket | S3-compatible object storage |
| Stytch | Authentication (JWT) |

### AI & Processing
| Technology | Purpose |
|------------|---------|
| Claude Agent SDK | Creative Director agent (API-side) |
| Claude CLI | Visual generation subprocess (Worker-side) |
| MCP Servers | Asset serving & viewport tools |
| WhisperX | Speech-to-text with word alignment |
| FFmpeg | Audio/video processing |
| Remotion | Programmatic video rendering |
| Freepik / Pexels | Stock image & video APIs |

---

## Monorepo Structure

```
viona/
├── apps/
│   ├── web/                    # Next.js 15 frontend (main editor)
│   │   ├── src/
│   │   │   ├── app/            # App Router pages
│   │   │   ├── features/
│   │   │   │   └── editor-v2/  # Video editor feature
│   │   │   ├── components/     # UI components (60+)
│   │   │   ├── hooks/          # Custom React hooks
│   │   │   ├── lib/            # Utilities & API client
│   │   │   ├── store/          # Zustand stores
│   │   │   └── utils/          # Helper functions
│   │   └── package.json
│   │
│   ├── landing/                # Astro landing page
│   └── templates/              # Template builder app
│
├── packages/
│   ├── api/                    # Fastify REST API + Agent
│   │   ├── src/
│   │   │   ├── routes/         # REST endpoints (projects, users)
│   │   │   ├── agent/          # Creative Director agent
│   │   │   │   ├── agent-router.ts      # SSE streaming endpoint
│   │   │   │   ├── agent-tools.ts       # Agent tool definitions
│   │   │   │   ├── agent-system-prompt.ts
│   │   │   │   └── conversation-store.ts
│   │   │   ├── services/       # MinIO, Redis, Queue, Stytch
│   │   │   ├── middleware/     # Auth middleware
│   │   │   ├── db/             # Drizzle schema & migrations
│   │   │   └── ws/             # WebSocket handler
│   │   └── package.json
│   │
│   ├── worker/                 # Background job processors
│   │   ├── src/
│   │   │   ├── processors/     # 15 job processors
│   │   │   │   ├── transcribe.ts
│   │   │   │   ├── render.ts           # 119KB - main render pipeline
│   │   │   │   ├── generate-visuals.ts  # AI visual generation
│   │   │   │   ├── plan-visuals.ts      # Visual planning/scenes
│   │   │   │   ├── edit-visuals.ts      # Conversational editing
│   │   │   │   ├── svg-animation.ts     # SVG animation gen
│   │   │   │   ├── enhance-audio.ts
│   │   │   │   ├── generate-broll.ts
│   │   │   │   ├── generate-caption-styles.ts
│   │   │   │   ├── generate-reframe.ts
│   │   │   │   ├── head-tracking.ts
│   │   │   │   └── preload-project.ts
│   │   │   ├── agents/          # AI agent integration
│   │   │   │   ├── claude-sdk/  # Claude Agent SDK (TS)
│   │   │   │   ├── mcp-servers/ # MCP servers (assets, viewport)
│   │   │   │   ├── prompts/     # Python system prompts
│   │   │   │   └── claude_visual_generator.py
│   │   │   ├── services/       # Freepik, Pexels, MinIO, logging
│   │   │   ├── prompts/        # TypeScript prompt builders
│   │   │   └── utils/          # Template, heartbeat, Python utils
│   │   └── package.json
│   │
│   ├── renderer/               # Remotion composition library
│   │   ├── src/
│   │   │   ├── components/     # Video & subtitle components
│   │   │   └── animations/     # Animation presets & easing
│   │   └── package.json
│   │
│   ├── shared/                 # Shared types & storage abstraction
│   │   └── src/
│   │       ├── types/          # TypeScript type definitions
│   │       └── storage.ts      # S3 storage service
│   │
│   └── templates/              # Template registry & definitions
│       └── src/
│           ├── registry.ts     # Template lookup
│           ├── fonts.ts        # Font definitions
│           └── templates/      # Template implementations
│
├── docker-compose.yml          # Local infrastructure (PG, Redis, MinIO)
├── package.json                # Root workspace config
└── pnpm-workspace.yaml
```

---

## System Diagrams

### Video Processing Pipeline

```mermaid
flowchart LR
    subgraph Upload
        A[Video File] --> B[MinIO Upload]
    end

    subgraph Transcription
        B --> C[Extract Audio]
        C --> D[WhisperX]
        D --> E[Word Timestamps]
    end

    subgraph Editing
        E --> F[Timeline Editor]
        F --> G[Style Captions]
        F --> H[Generate Visuals]
    end

    subgraph Rendering
        G --> I[Remotion Render]
        H --> I
        I --> J[Final MP4]
    end

    subgraph Delivery
        J --> K[MinIO Storage]
        K --> L[Download URL]
    end
```

### AI Visual Generation Flow

```mermaid
flowchart TB
    subgraph Input
        T[Transcript] --> PLAN
        S[Style / Template] --> PLAN
        D[Dimensions] --> PLAN
    end

    subgraph Planning ["Phase 1: Director"]
        PLAN[Plan Visuals] --> SCENES[Scene Breakdown]
        SCENES --> LAYOUT[Layout & Timing]
    end

    subgraph Generation ["Phase 2: Animator (Claude CLI)"]
        LAYOUT --> WORKSPACE[Create Workspace]
        WORKSPACE --> CODE[Generate React/TSX]
        CODE --> VAL{TypeScript Valid?}
        VAL -->|No| FIX[Self-Heal]
        FIX --> VAL
        VAL -->|Yes| SCREEN[Screenshot via MCP]
    end

    subgraph Evaluation
        SCREEN --> EVAL[Visual Evaluation]
        EVAL --> SCORE{Acceptable?}
        SCORE -->|No| IMPROVE[Iterate]
        IMPROVE --> CODE
        SCORE -->|Yes| BUNDLE[Bundle Code]
    end

    subgraph Output
        BUNDLE --> S3[Upload to S3]
        S3 --> BROWSER[Browser Preview]
        S3 --> RENDER[Render Pipeline]
    end

    subgraph Editing ["Conversational Editing"]
        BROWSER --> EDIT[Edit Visuals]
        EDIT --> CODE
    end
```

### State Management

```mermaid
flowchart TB
    subgraph EditorStore ["Zustand Editor Store"]
        PROJECT[Project State]
        TRACKS[Tracks]
        ITEMS[Timeline Items]
        SELECTION[Selection]
        PLAYBACK[Playback State]
        VIEWPORT[Viewport/Zoom]
        HISTORY[Undo/Redo Stack]
    end

    subgraph Components
        HEADER[Header] --> PROJECT
        TIMELINE[Timeline] --> TRACKS
        TIMELINE --> ITEMS
        TIMELINE --> VIEWPORT
        PLAYER[Player] --> PLAYBACK
        PANEL[Right Panel] --> SELECTION
        PANEL --> ITEMS
    end

    subgraph Actions
        LOAD[loadProject] --> EditorStore
        SAVE[saveProject] --> API
        UNDO[undo/redo] --> HISTORY
        EDIT[updateItem] --> ITEMS
    end

    API[(Backend API)] <--> LOAD
    API <--> SAVE
```

### Job Queue System

```mermaid
flowchart LR
    subgraph API
        REQ[Request] --> CREATE[Create Job Record]
        CREATE --> QUEUE[Add to Queue]
    end

    subgraph Redis ["Redis Queues"]
        QUEUE --> TQ[transcribe]
        QUEUE --> RQ[render]
        QUEUE --> AQ[enhance-audio]
        QUEUE --> VQ[generate-visuals]
        QUEUE --> PQ[plan-visuals]
        QUEUE --> EQ[edit-visuals]
        QUEUE --> SQ[svg-animation]
        QUEUE --> BQ[generate-broll]
        QUEUE --> CQ[generate-caption-styles]
        QUEUE --> HQ[head-tracking]
    end

    subgraph Workers ["Worker Processors"]
        TQ --> TW[Transcribe]
        RQ --> RW[Render]
        AQ --> AW[Audio]
        VQ --> VW[Visuals]
        PQ --> PW[Planner]
        EQ --> EW[Editor]
        SQ --> SW[SVG Anim]
        BQ --> BW[B-Roll]
        CQ --> CW[Captions]
        HQ --> HW[Head Track]
    end

    subgraph Progress
        TW & RW & VW & PW --> PUB[Redis Pub/Sub]
        PUB --> WS[WebSocket]
        WS --> CLIENT[Browser]
    end
```

### Database Entity Relationships

```mermaid
erDiagram
    USERS ||--o{ PROJECTS : owns
    PROJECTS ||--o{ TRACKS : has
    PROJECTS ||--o{ JOBS : has
    PROJECTS ||--o| TRANSCRIPTS : has
    PROJECTS ||--o{ VISUALS : has
    PROJECTS ||--o{ PROJECT_ASSETS : has
    PROJECTS ||--o{ CONVERSATIONS : has
    TRACKS ||--o{ TIMELINE_ITEMS : contains
    CONVERSATIONS ||--o{ CONVERSATION_MESSAGES : contains

    USERS {
        uuid id PK
        varchar stytchUserId UK
        varchar email
        timestamp createdAt
    }

    PROJECTS {
        uuid id PK
        uuid userId FK
        varchar status
        varchar videoKey
        varchar outputKey
        int durationMs
        int fps
        int sourceWidth
        int sourceHeight
        jsonb videoSettings
        timestamp createdAt
        timestamp updatedAt
    }

    TRACKS {
        uuid id PK
        uuid projectId FK
        varchar type
        varchar name
        int position
        boolean locked
        boolean visible
    }

    TIMELINE_ITEMS {
        uuid id PK
        uuid trackId FK
        varchar type
        int startMs
        int endMs
        jsonb data
        timestamp createdAt
        timestamp updatedAt
    }

    TRANSCRIPTS {
        uuid id PK
        uuid projectId FK
        jsonb words
        jsonb rawOutput
        timestamp createdAt
    }

    JOBS {
        uuid id PK
        uuid projectId FK
        varchar type
        varchar status
        int progress
        text error
        jsonb metrics
        text[] logs
        timestamp createdAt
        timestamp completedAt
    }

    VISUALS {
        uuid id PK
        uuid projectId FK
        varchar compositionId
        varchar bundleUrl
        varchar videoUrl
        int durationFrames
        int fps
        int width
        int height
        varchar stylePreset
        varchar llmModel
        jsonb timestamps
        timestamp createdAt
    }

    PROJECT_ASSETS {
        uuid id PK
        uuid projectId FK
        varchar key
        varchar type
        timestamp createdAt
    }

    CONVERSATIONS {
        uuid id PK
        uuid projectId FK
        timestamp createdAt
        timestamp updatedAt
    }

    CONVERSATION_MESSAGES {
        uuid id PK
        uuid conversationId FK
        varchar role
        text content
        jsonb toolCalls
        timestamp createdAt
    }
```

### Project Status Lifecycle

```mermaid
stateDiagram-v2
    [*] --> uploading: Create project
    uploading --> processing: Start processing
    processing --> ready: Transcription complete
    ready --> rendering: Start render
    ready --> generating: Generate visuals
    generating --> ready: Visuals complete
    rendering --> complete: Render complete
    processing --> failed: Error
    rendering --> failed: Error
    generating --> failed: Error
```

---

## Setup & Installation

### Prerequisites

- **Node.js** >= 20.0.0
- **pnpm** >= 9.0.0
- **Docker** & Docker Compose
- **Python** 3.10+ (for WhisperX transcription)
- **FFmpeg** (for audio/video processing)

### Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/your-org/viona.git
cd viona

# 2. Install dependencies
pnpm install

# 3. Start infrastructure (PostgreSQL, Redis, MinIO)
docker-compose up -d

# 4. Copy environment files
cp .env.example .env
cp packages/api/.env.example packages/api/.env
cp packages/worker/.env.example packages/worker/.env

# 5. Run database migrations
pnpm db:migrate

# 6. Start development servers (bucket auto-created on first start)
pnpm dev
```

This starts:
- **Web**: http://localhost:3000
- **API**: http://localhost:4000
- **MinIO Console**: http://localhost:9001 (user: reelify, pass: reelify123)

### Detailed Setup

For comprehensive setup instructions including:
- Python/Miniconda configuration
- WhisperX local transcription
- Audio enhancement
- Claude Agent SDK
- Troubleshooting

See **[docs/LOCAL_SETUP.md](docs/LOCAL_SETUP.md)**

### Production Deployment

For Railway deployment with 3 services (Web, API, Worker):

See **[docs/RAILWAY_DEPLOYMENT.md](docs/RAILWAY_DEPLOYMENT.md)**

---

## Environment Variables

### Storage Configuration

The project uses a single S3-compatible bucket with prefixes:
- `uploads/` - User uploaded videos
- `outputs/` - Generated outputs (videos, bundles)
- `templates/` - Remotion template files

### API (packages/api/.env)

```bash
PORT=4000
DATABASE_URL=postgresql://reelify:reelify123@localhost:5432/reelify
REDIS_URL=redis://localhost:6379

# Storage (S3-compatible, single bucket with prefixes)
S3_ENDPOINT=localhost
S3_PORT=9000
S3_ACCESS_KEY=reelify
S3_SECRET_KEY=reelify123
S3_USE_SSL=false
S3_BUCKET=viona
S3_REGION=us-east-1
```

### Worker (packages/worker/.env)

```bash
DATABASE_URL=postgresql://reelify:reelify123@localhost:5432/reelify
REDIS_URL=redis://localhost:6379

# Storage (same as API)
S3_ENDPOINT=localhost
S3_PORT=9000
S3_ACCESS_KEY=reelify
S3_SECRET_KEY=reelify123
S3_USE_SSL=false
S3_BUCKET=viona

# Transcription: "local" (WhisperX) or "api" (OpenAI Whisper API)
TRANSCRIPTION_MODE=local
WHISPER_MODEL=large-v2
WHISPER_LANGUAGE=en
WHISPER_DEVICE=auto
WHISPER_COMPUTE_TYPE=float16

# Audio Enhancement
AUDIO_ENHANCEMENT_ENABLED=true

# Claude Agent SDK (for AI visual generation)
ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_AGENT_MODEL=claude-sonnet-4-20250514
CLAUDE_AGENT_MAX_THINKING_TOKENS=10000
CLAUDE_AGENT_MAX_TURNS=100
```

### Web (apps/web/.env.local)

```bash
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_WS_URL=ws://localhost:4000
```

For complete environment variable reference, see [docs/LOCAL_SETUP.md](docs/LOCAL_SETUP.md#environment-variables-reference).

---

## Development

### Available Scripts

```bash
# Start all services in development mode
pnpm dev

# Start individual services
pnpm dev:web      # Frontend only
pnpm dev:api      # API only
pnpm dev:worker   # Worker only

# Build all packages
pnpm build

# Run linting
pnpm lint

# Type checking
pnpm typecheck

# Database operations
pnpm db:migrate   # Run migrations
pnpm db:seed      # Seed database

# Docker operations
pnpm docker:up    # Start infrastructure
pnpm docker:down  # Stop infrastructure
```

### Testing

```bash
# Run worker tests
cd packages/worker && pnpm test
```

### Project Structure Conventions

1. **Package naming**: `@viona/{package-name}`
2. **Imports**: Use `@/` alias for src directory
3. **Types**: Define in `packages/shared/src/types`
4. **API routes**: RESTful naming in `packages/api/src/routes`
5. **Components**: Functional components with TypeScript

---

## Database Schema

### Tables Overview

| Table | Description |
|-------|-------------|
| `users` | User accounts (Stytch authentication) |
| `projects` | Video projects with status and settings |
| `tracks` | Timeline tracks (video, audio, caption, visual) |
| `timeline_items` | Items on tracks with type-specific data |
| `transcripts` | Word-level transcriptions from WhisperX |
| `jobs` | Background job records with progress, metrics, and logs |
| `visuals` | AI-generated visual compositions with bundle URLs |
| `project_assets` | Uploaded media files associated with projects |
| `conversations` | Creative Director agent conversation sessions |
| `conversation_messages` | Messages within agent conversations |

---

## API Reference

### Projects

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects` | List all user projects |
| POST | `/api/projects` | Create new project |
| GET | `/api/projects/:id` | Get project with tracks & items |
| PUT | `/api/projects/:id` | Update project (tracks, items, settings) |
| DELETE | `/api/projects/:id` | Delete project |
| POST | `/api/projects/:id/upload-url` | Get presigned upload URL |
| POST | `/api/projects/:id/transcribe` | Start transcription job |
| POST | `/api/projects/:id/render` | Start video render job |
| POST | `/api/projects/:id/generate-visuals` | Generate AI visuals |
| POST | `/api/projects/:id/separate-audio` | Extract audio track |
| GET | `/api/projects/:id/download` | Get download URL |
| GET | `/api/projects/:id/video` | Stream video (range support) |

### Creative Director Agent

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/agent/chat` | Send message to agent (SSE streaming) |
| GET | `/api/agent/conversations/:id` | Get conversation history |

### Bundles & Sources

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/bundles/:compositionId/*` | Serve Remotion bundle files from S3 |
| GET | `/api/sources/:compositionId/*` | Serve source project files (for AI context) |

### Jobs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/jobs/:id` | Get job status & progress |
| POST | `/api/jobs/:id/cancel` | Cancel running job |

### WebSocket

Connect to `ws://localhost:4000/ws?projectId={id}` for real-time updates:

```typescript
// Message types
{ type: 'job:progress', payload: { jobId, progress, message } }
{ type: 'job:complete', payload: { jobId, projectId } }
{ type: 'job:error', payload: { jobId, error } }
{ type: 'job:logs', payload: { jobId, logs } }
```

---

## Features

### Subtitle Styling

15+ animation presets organized by category:

**Viral Style**
- elastic-pop, bounce-up, shake, color-wipe, 3d-flip, punch

**Cinematic Style**
- fade-rise, typewriter, smooth-slide, soft-scale, underline-wipe

**Display Modes**
- Phrase mode (all words, active highlighted)
- Karaoke mode (progressive fill)
- Word-by-word (single word display)

### AI Visual Presets

| Preset | Style | Best For |
|--------|-------|----------|
| Minimal | Clean geometric, monochrome | Business, professional |
| Modern | Vibrant gradients, spring animations | Tech tutorials |
| Playful | Bright saturated, bouncy | Education, entertainment |
| Bold | High contrast, dramatic scale | Key concepts |
| Classic | Muted professional | Finance, science |

### Layout Modes

- **Picture-in-Picture**: Visuals fullscreen, video as overlay
- **Split Horizontal**: Visuals top, video bottom
- **Split Vertical**: Visuals left, video right
- **Spatial Overlay**: Visuals composited over video with per-scene display modes
- **Video Only**: No visuals shown

---

## License

MIT License - see [LICENSE](LICENSE) for details.
