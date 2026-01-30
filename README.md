# Clipify

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

Clipify is a modern video editor designed for creating Instagram Reels, TikTok videos, and YouTube Shorts. It combines:

- **Automated Transcription**: Word-level speech-to-text using WhisperX
- **AI Visual Generation**: Animated diagrams, charts, and infographics using LLMs + Remotion
- **Professional Subtitles**: 15+ animation presets with word-level styling
- **Audio Enhancement**: Loudness normalization and noise reduction
- **Real-time Progress**: WebSocket-based job tracking

---

## Architecture

### High-Level Overview

```mermaid
graph TB
    subgraph Frontend ["Frontend (Next.js 15)"]
        WEB[Web App<br/>React 19 + TypeScript]
        PLAYER[Remotion Player]
        EDITOR[Video Editor UI]
    end

    subgraph Backend ["Backend Services"]
        API[Fastify API<br/>Port 4000]
        WORKER[Worker Process<br/>Job Processors]
    end

    subgraph Infrastructure ["Infrastructure"]
        PG[(PostgreSQL)]
        REDIS[(Redis)]
        MINIO[(MinIO<br/>Object Storage)]
    end

    subgraph External ["External Services"]
        WHISPER[WhisperX<br/>Transcription]
        LLM[OpenRouter<br/>Gemini Flash]
        REMOTION[Remotion<br/>Video Rendering]
    end

    WEB --> API
    WEB -.WebSocket.-> API
    API --> PG
    API --> REDIS
    API --> MINIO
    REDIS --> WORKER
    WORKER --> PG
    WORKER --> MINIO
    WORKER --> WHISPER
    WORKER --> LLM
    WORKER --> REMOTION
    PLAYER --> WEB
    EDITOR --> WEB
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
| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 15.3.2 | React framework |
| React | 19.0.0 | UI library |
| TypeScript | 5 | Type safety |
| Tailwind CSS | 4 | Styling |
| Zustand | 5.0.4 | State management |
| Remotion | 4.0.315 | Video composition |
| Radix UI | - | Accessible components |

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| Fastify | 4.25.2 | HTTP server |
| Drizzle ORM | 0.29.3 | Database ORM |
| BullMQ | 5.1.0 | Job queue |
| PostgreSQL | 16 | Database |
| Redis | 7 | Cache & queue |
| MinIO | - | Object storage |

### AI & Processing
| Technology | Purpose |
|------------|---------|
| WhisperX | Speech-to-text with word alignment |
| OpenRouter/Gemini | LLM for visual generation |
| OpenHands | AI agent framework |
| FFmpeg | Audio/video processing |
| Remotion | Programmatic video rendering |

---

## Monorepo Structure

```
clipify/
├── apps/
│   └── web/                    # Next.js frontend application
│       ├── src/
│       │   ├── app/            # Next.js app router
│       │   ├── features/
│       │   │   └── editor-v2/  # Main video editor
│       │   ├── components/     # Shared UI components
│       │   ├── lib/            # Utilities & API client
│       │   └── store/          # Zustand stores
│       └── package.json
│
├── packages/
│   ├── api/                    # Fastify REST API
│   │   ├── src/
│   │   │   ├── routes/         # API endpoints
│   │   │   ├── services/       # MinIO, Redis, Queue
│   │   │   ├── db/             # Drizzle schema & migrations
│   │   │   └── ws/             # WebSocket handler
│   │   └── package.json
│   │
│   ├── worker/                 # Background job processors
│   │   ├── src/
│   │   │   ├── processors/     # Job handlers
│   │   │   │   ├── transcribe.ts
│   │   │   │   ├── render.ts
│   │   │   │   ├── enhance-audio.ts
│   │   │   │   └── generate-visuals.ts
│   │   │   ├── services/       # MinIO, Redis clients
│   │   │   └── prompts/        # LLM prompt builders
│   │   └── package.json
│   │
│   ├── renderer/               # Remotion composition library
│   │   ├── src/
│   │   │   ├── components/     # Video & subtitle components
│   │   │   └── animations/     # Animation presets
│   │   └── package.json
│   │
│   ├── shared/                 # Shared TypeScript types
│   │   └── src/types/
│   │
│   └── mcp-tools/              # MCP tools for Claude Code
│       └── src/tools/
│
├── docker/
│   ├── openhands-sandbox/      # AI agent Docker image
│   │   ├── visual_generator.py # Main generation script
│   │   ├── config.toml         # LLM configuration
│   │   ├── skills/             # OpenHands skills
│   │   └── tools/              # Custom tools
│   │
│   └── remotion-sandbox/       # Rendering Docker image
│
├── bundles/                    # Generated Remotion bundles
├── docker-compose.yml          # Local infrastructure
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
        T[Transcript] --> P[Build Prompt]
        S[Style Preset] --> P
        D[Dimensions] --> P
    end

    subgraph Generation ["OpenHands Agent"]
        P --> LLM[Gemini Flash LLM]
        LLM --> CODE[Generate React/TSX]
        CODE --> VAL{TypeScript Valid?}
        VAL -->|No| FIX[Self-Heal]
        FIX --> VAL
        VAL -->|Yes| SCREEN[Take Screenshots]
    end

    subgraph Evaluation
        SCREEN --> EVAL[Visual Evaluation]
        EVAL --> SCORE{Score >= 70?}
        SCORE -->|No| IMPROVE[Iterate & Improve]
        IMPROVE --> CODE
        SCORE -->|Yes| BUNDLE[Bundle Code]
    end

    subgraph Output
        BUNDLE --> CJS[CommonJS Module]
        BUNDLE --> MP4[Render Video]
        CJS --> BROWSER[Browser Loading]
        MP4 --> TIMELINE[Timeline Item]
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

    subgraph Redis
        QUEUE --> TQ[transcribe queue]
        QUEUE --> RQ[render queue]
        QUEUE --> AQ[enhance-audio queue]
        QUEUE --> VQ[generate-visuals queue]
    end

    subgraph Workers ["Worker Processes"]
        TQ --> TW[Transcribe Worker]
        RQ --> RW[Render Worker]
        AQ --> AW[Audio Worker]
        VQ --> VW[Visuals Worker]
    end

    subgraph Progress
        TW --> PUB[Publish Progress]
        RW --> PUB
        AW --> PUB
        VW --> PUB
        PUB --> WS[WebSocket]
        WS --> CLIENT[Browser]
    end
```

### Database Entity Relationships

```mermaid
erDiagram
    PROJECTS ||--o{ TRACKS : has
    PROJECTS ||--o{ JOBS : has
    PROJECTS ||--o| TRANSCRIPTS : has
    PROJECTS ||--o{ VISUALS : has
    TRACKS ||--o{ TIMELINE_ITEMS : contains

    PROJECTS {
        uuid id PK
        uuid userId
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
- **Python** 3.12+ (for WhisperX and OpenHands)
- **FFmpeg** (for audio/video processing)

### Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/your-org/clipify.git
cd clipify

# 2. Install dependencies
pnpm install

# 3. Start infrastructure (PostgreSQL, Redis, MinIO)
docker-compose up -d

# 4. Run database migrations
pnpm db:migrate

# 5. Start development servers
pnpm dev
```

This starts:
- **Web**: http://localhost:3000
- **API**: http://localhost:4000
- **MinIO Console**: http://localhost:9001 (user: reelify, pass: reelify123)

### Docker Images

Build the AI sandbox images for visual generation:

```bash
# Build OpenHands sandbox (includes Node.js, Python, Chromium)
pnpm docker:build-sandbox

# Test the sandbox
pnpm docker:test-sandbox
```

### Python Setup (for transcription)

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows

# Install WhisperX
pip install whisperx

# Install audio enhancement dependencies
pip install pyloudnorm soundfile numpy
```

---

## Environment Variables

### API (packages/api/.env)

```bash
PORT=4000
DATABASE_URL=postgresql://reelify:reelify123@localhost:5432/reelify
REDIS_URL=redis://localhost:6379

# MinIO Configuration
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=reelify
MINIO_SECRET_KEY=reelify123
MINIO_USE_SSL=false
MINIO_BUCKET_UPLOADS=uploads
MINIO_BUCKET_OUTPUTS=outputs

# Bundle output directory
BUNDLE_OUTPUT_DIR=./bundles
```

### Worker (packages/worker/.env)

```bash
DATABASE_URL=postgresql://reelify:reelify123@localhost:5432/reelify
REDIS_URL=redis://localhost:6379

# MinIO Configuration
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=reelify
MINIO_SECRET_KEY=reelify123

# Python & WhisperX
PYTHON_PATH=python
WHISPER_MODEL=base
WHISPER_LANGUAGE=en
WHISPER_DEVICE=auto
WHISPER_COMPUTE_TYPE=float16

# Remotion
REMOTION_PROJECT_DIR=./
BUNDLE_OUTPUT_DIR=./bundles

# OpenHands (AI Visual Generation)
OPENHANDS_PYTHON_PATH=python
OPENHANDS_USE_DOCKER=false
OPENROUTER_API_KEY=your_api_key_here
```

### Web (apps/web/.env.local)

```bash
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_WS_URL=ws://localhost:4000
```

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

# Run Python tests (dimension validation)
cd docker/openhands-sandbox && python -m pytest tests/ -v
```

### Project Structure Conventions

1. **Package naming**: `@reelify/{package-name}`
2. **Imports**: Use `@/` alias for src directory
3. **Types**: Define in `packages/shared/src/types`
4. **API routes**: RESTful naming in `packages/api/src/routes`
5. **Components**: Functional components with TypeScript

---

## Database Schema

### Tables Overview

| Table | Description |
|-------|-------------|
| `projects` | Video projects with status and settings |
| `tracks` | Timeline tracks (video, audio, caption, visual) |
| `timeline_items` | Items on tracks with type-specific data |
| `transcripts` | Word-level transcriptions from WhisperX |
| `jobs` | Background job records with progress |
| `visuals` | AI-generated visual compositions |

---

## API Reference

### Projects

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/projects` | Create new project |
| GET | `/api/projects/:id` | Get project with tracks & items |
| PATCH | `/api/projects/:id` | Update tracks and items |
| POST | `/api/projects/:id/process` | Start transcription |
| POST | `/api/projects/:id/render` | Start video render |
| POST | `/api/projects/:id/generate-visuals` | Generate AI visuals |
| POST | `/api/projects/:id/separate-audio` | Extract audio track |
| GET | `/api/projects/:id/download` | Get download URL |
| GET | `/api/projects/:id/video` | Stream video (range support) |

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
- **Video Only**: No visuals shown

---

## License

MIT License - see [LICENSE](LICENSE) for details.
