# Phase 1: Subtitle Pipeline Design

**Date:** January 26, 2026
**Status:** Ready for Implementation
**Scope:** Upload → Transcribe → Edit Subtitles → Export

---

## Overview

Build a vertical slice of Reelify that proves the core pipeline:
1. User uploads a video
2. System auto-transcribes with word-level timestamps
3. User edits subtitles in a video editor
4. User exports video with animated subtitles

This establishes the foundation for Phase 2 (semantic visual generation).

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           FRONTEND                                   │
│                   Vite + React + shadcn/ui                          │
│                   (DesignCombo Fork)                                │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │    Upload    │  │   Remotion   │  │   Download   │              │
│  │    Form      │  │   Player     │  │    Button    │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│                           │                                         │
│                    WS (status updates)                              │
└───────────────────────────┼─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      API SERVICE (Node.js)                          │
│                   Express/Fastify + BullMQ                          │
│                                                                     │
│  POST /api/projects       → Create project, get upload URL          │
│  POST /api/projects/:id/process → Queue transcription               │
│  GET  /api/projects/:id   → Get project with tracks                 │
│  PATCH /api/projects/:id  → Update project                          │
│  POST /api/projects/:id/render → Queue render job                   │
│  GET  /api/projects/:id/download → Get download URL                 │
│  WS   /ws                 → Real-time status updates                │
└─────────────────────────────────────────────────────────────────────┘
                            │
                   Redis (BullMQ + Pub/Sub)
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     WORKER (Node.js)                                │
│                                                                     │
│  Transcribe Job:                                                    │
│  1. Download video from MinIO                                       │
│  2. Extract audio (FFmpeg → 16kHz WAV)                             │
│  3. Transcribe (@remotion/install-whisper-cpp)                     │
│  4. toCaptions() → createTikTokStyleCaptions()                     │
│  5. Create subtitle track + timeline items                          │
│  6. Publish "complete" via Redis Pub/Sub                           │
│                                                                     │
│  Render Job:                                                        │
│  1. Load project from DB                                            │
│  2. Render with Remotion (video + subtitles)                       │
│  3. Upload to MinIO                                                 │
│  4. Publish "complete"                                              │
└─────────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          MinIO                                       │
│                                                                     │
│  Buckets:                                                           │
│    uploads/   → Raw uploaded videos                                 │
│    outputs/   → Rendered videos with subtitles                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Frontend | Next.js + React + shadcn/ui | Upload, editor, export UI |
| Editor Base | DesignCombo (forked) | Timeline, player, editing |
| API | Node.js + Fastify | HTTP endpoints, WebSocket |
| Job Queue | BullMQ + Redis | Background job management |
| Worker | Node.js + Remotion | Transcription, rendering |
| Transcription | @remotion/install-whisper-cpp | Word-level timestamps |
| Database | PostgreSQL | Projects, tracks, items |
| Storage | MinIO (S3-compatible) | Videos, outputs |

---

## Project Structure

```
reelify/
├── apps/
│   └── web/                    # Forked designcombo (Next.js)
│       ├── src/
│       │   ├── app/            # Next.js app router
│       │   ├── components/     # UI components (shadcn/ui)
│       │   ├── features/
│       │   │   ├── editor/     # Video editor (from designcombo)
│       │   │   ├── upload/     # Upload flow
│       │   │   └── export/     # Export flow
│       │   ├── hooks/
│       │   ├── lib/
│       │   │   ├── api.ts      # API client
│       │   │   └── ws.ts       # WebSocket client
│       │   └── store/          # State management
│       └── package.json
│
├── packages/
│   ├── api/                    # Fastify API
│   │   ├── src/
│   │   │   ├── routes/         # HTTP endpoints
│   │   │   ├── ws/             # WebSocket handlers
│   │   │   ├── jobs/           # Job definitions
│   │   │   └── services/       # MinIO, Redis clients
│   │   └── package.json
│   │
│   ├── worker/                 # BullMQ worker
│   │   ├── src/
│   │   │   ├── processors/
│   │   │   │   ├── transcribe.ts   # Whisper transcription
│   │   │   │   └── render.ts       # Remotion rendering
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── shared/                 # Shared types & utils
│       ├── src/
│       │   ├── types/          # Job, Caption, Project types
│       │   └── constants/
│       └── package.json
│
├── docker-compose.yml          # Redis + MinIO + Postgres
├── pnpm-workspace.yaml
└── package.json
```

---

## Data Model

### Core Types (Extensible for Phase 2)

```typescript
// Generic timeline item - not subtitle-specific
type TimelineItem = {
  id: string;
  type: 'subtitle' | 'visual' | 'audio' | 'effect';
  trackId: string;
  startMs: number;
  endMs: number;
  data: SubtitleData | VisualData | AudioData;
}

type SubtitleData = {
  text: string;
  words: { text: string; startMs: number; endMs: number }[];
  style: SubtitleStyle;
}

type VisualData = {
  visualType: 'chart' | 'flowchart' | 'list' | 'comparison';
  props: Record<string, unknown>;
  style: VisualStyle;
}

// Track system - supports multiple tracks
type Track = {
  id: string;
  type: 'video' | 'subtitle' | 'visual' | 'audio';
  name: string;
  locked: boolean;
  visible: boolean;
  items: TimelineItem[];
}

type Project = {
  id: string;
  status: 'uploading' | 'processing' | 'ready' | 'rendering' | 'complete';
  videoKey: string;
  outputKey?: string;
  duration: number;
  fps: number;
  width: number;
  height: number;
  tracks: Track[];
  transcript?: Transcript;
}

// Extensible job system
type Job =
  | { type: 'transcribe'; projectId: string }
  | { type: 'analyze'; projectId: string }       // Phase 2
  | { type: 'generate-visual'; itemId: string }  // Phase 2
  | { type: 'render'; projectId: string }
```

### Database Schema

```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY,
  user_id UUID,
  status VARCHAR(50),
  video_key VARCHAR(255),
  output_key VARCHAR(255),
  duration_ms INTEGER,
  fps INTEGER,
  width INTEGER,
  height INTEGER,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

CREATE TABLE tracks (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  type VARCHAR(50),
  name VARCHAR(255),
  position INTEGER,
  locked BOOLEAN DEFAULT false,
  visible BOOLEAN DEFAULT true
);

CREATE TABLE timeline_items (
  id UUID PRIMARY KEY,
  track_id UUID REFERENCES tracks(id),
  type VARCHAR(50),
  start_ms INTEGER,
  end_ms INTEGER,
  data JSONB,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

CREATE TABLE transcripts (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  raw_output JSONB,
  captions JSONB,
  created_at TIMESTAMP
);

CREATE TABLE jobs (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  type VARCHAR(50),
  status VARCHAR(50),
  progress INTEGER,
  error TEXT,
  created_at TIMESTAMP,
  completed_at TIMESTAMP
);
```

---

## API Endpoints

```
POST /api/projects
  → Create new project, get upload URL
  ← { projectId, uploadUrl }

POST /api/projects/:id/process
  → Trigger transcription job
  ← { jobId }

GET /api/projects/:id
  → Get project with all tracks/items
  ← { project }

PATCH /api/projects/:id
  → Update project (edit subtitle, move item, etc.)
  ← { project }

POST /api/projects/:id/render
  → Queue render job
  ← { jobId }

GET /api/projects/:id/download
  → Get presigned download URL
  ← { url }

WS /ws?projectId=xxx
  → Subscribe to project updates
  ← { type: 'job:progress' | 'job:complete' | 'job:error', payload }
```

---

## Editor Integration

### DesignCombo Fork Strategy

**Keep:**
- Timeline component
- Track management
- Playback controls
- Remotion Player integration
- Drag-to-resize items
- Keyboard shortcuts
- Zoom in/out
- State management pattern

**Strip:**
- Pexels integration
- AI background removal
- Image upscaling
- Smart cropping
- Effects & filters
- Multi-video compositing
- Audio waveform editing

### Editor Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│                         EditorLayout                                │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                      Toolbar                                 │   │
│  │  [Undo] [Redo] | [Split] [Delete] | [Style ▼] | [Export]   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌──────────────────────────────┐ ┌────────────────────────────┐   │
│  │                              │ │      PropertiesPanel       │   │
│  │       PlayerPreview          │ │                            │   │
│  │                              │ │  Text: [Hello...]          │   │
│  │    ┌──────────────────┐     │ │  Start: [00:01.234]        │   │
│  │    │  Remotion Player │     │ │  End:   [00:02.567]        │   │
│  │    │                  │     │ │                            │   │
│  │    │   "Hello world"  │     │ │  Font:  [Inter ▼]          │   │
│  │    │                  │     │ │  Size:  [48px]             │   │
│  │    └──────────────────┘     │ │  Color: [white]            │   │
│  │                              │ │  Position: [bottom]        │   │
│  └──────────────────────────────┘ │  Animation: [pop ▼]        │   │
│                                    └────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                       Timeline                               │   │
│  │  [00:00]     [00:10]     [00:20]     [00:30]               │   │
│  │                                                              │   │
│  │  Video    │████████████████████████████████████████████│   │   │
│  │  Subtitle │█Hi██ █there██ █world██ █this██ █is██ █a██│   │   │
│  │  Visual   │                                            │   │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Editor State

```typescript
interface EditorState {
  project: Project | null;
  currentTimeMs: number;
  isPlaying: boolean;
  zoom: number;
  scrollX: number;
  selectedTrackId: string | null;
  selectedItemIds: string[];
  isDragging: boolean;
  dragType: 'move' | 'resize-left' | 'resize-right' | null;
  history: Project[];
  historyIndex: number;
  isSaving: boolean;
  activePanel: 'subtitles' | 'styles' | 'export';
}
```

### Subtitle Styles

```typescript
interface SubtitleStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  backgroundColor?: string;
  position: 'top' | 'center' | 'bottom';
  animation: 'none' | 'pop' | 'fade' | 'typewriter' | 'highlight-word';
  highlightColor?: string;
}
```

---

## Local Development

### Docker Services

```yaml
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  minio:
    image: minio/minio:latest
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      MINIO_ROOT_USER: reelify
      MINIO_ROOT_PASSWORD: reelify123
    command: server /data --console-address ":9001"

  postgres:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: reelify
      POSTGRES_PASSWORD: reelify123
      POSTGRES_DB: reelify
```

### Environment Variables

```bash
# .env.local (web)
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_WS_URL=ws://localhost:4000

# .env (api)
PORT=4000
DATABASE_URL=postgresql://reelify:reelify123@localhost:5432/reelify
REDIS_URL=redis://localhost:6379
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=reelify
MINIO_SECRET_KEY=reelify123

# .env (worker)
REDIS_URL=redis://localhost:6379
WHISPER_MODEL=medium.en
```

### Setup Commands

```bash
pnpm install          # Install dependencies
pnpm docker:up        # Start Redis, MinIO, Postgres
pnpm whisper:install  # Download Whisper model (~1.5GB)
pnpm db:migrate       # Run migrations
pnpm dev              # Start all services
```

---

## Implementation Milestones

### Milestone 1: Project Setup
- Initialize monorepo (pnpm workspaces)
- Setup Docker (Redis, MinIO, Postgres)
- Fork designcombo into apps/web
- Create packages/api, packages/worker, packages/shared
- Configure TypeScript, ESLint

### Milestone 2: Upload Pipeline
- API: POST /projects endpoint
- API: Presigned URL generation for MinIO
- Web: Upload page with drag-drop
- Web: Direct upload to MinIO
- DB: Projects table + migrations

### Milestone 3: Transcription Worker
- Worker: BullMQ setup + job processor
- Worker: FFmpeg audio extraction
- Worker: Whisper transcription (word-level)
- Worker: Convert to captions format
- API: WebSocket for progress updates
- DB: Transcripts + timeline_items tables

### Milestone 4: Editor (Stripped DesignCombo)
- Strip unused features from fork
- Adapt state management to Project model
- Timeline: Video track + Subtitle track
- Player: Remotion preview with subtitles
- Properties panel: Edit text, timing, style
- API integration: Load/save project

### Milestone 5: Export Pipeline
- Remotion composition: Video + animated subtitles
- Worker: Render job processor
- API: POST /projects/:id/render
- API: GET /projects/:id/download
- Web: Export button + progress + download

### Milestone 6: Polish
- Subtitle styles (fonts, colors, animations)
- Keyboard shortcuts
- Undo/redo
- Error handling + edge cases
- Loading states + empty states

---

## Extensibility for Phase 2

This design ensures we can add semantic visual generation without refactoring:

| Phase 2 Need | How Phase 1 Supports It |
|--------------|-------------------------|
| Multiple visual types | `TimelineItem.type` is extensible |
| LLM transcript analysis | Raw transcript stored in `transcripts` table |
| Visual generation jobs | Worker supports multiple job types |
| Multiple timeline tracks | Track system supports N tracks |
| Visual components | Remotion composition dispatches by item type |

---

## Open Decisions

1. **State management:** Zustand vs Redux vs designcombo's existing solution
2. **Remotion version:** Pin to specific version used by designcombo
3. **Whisper model:** Start with `medium.en`, may need `large` for accuracy
4. **Subtitle animation library:** Build custom vs use existing Remotion templates
