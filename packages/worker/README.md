# @viona/worker

Background job processor for Viona, handling transcription, AI visual generation, audio enhancement, video rendering, and more.

## Overview

The worker package consumes async jobs from BullMQ queues. It orchestrates a multi-phase AI visual generation pipeline powered by Claude Agent SDK, manages audio/video processing via Python scripts and FFmpeg, and renders final output with Remotion.

**Registered queues (12):**

| Queue | Concurrency | Description |
|---|---|---|
| `transcribe` | 1 | Audio transcription with WhisperX (local) or OpenAI Whisper API |
| `render` | 2 | Video rendering with Remotion SSR |
| `generate-visuals` | 1 | Full AI visual generation pipeline (Director + Animator) |
| `plan-visuals` | 1 | Director phase only (creates scene plan for user approval) |
| `edit-visuals` | 1 | Conversational editing of existing compositions |
| `svg-animation` | 1 | Converts uploaded images to animated SVG compositions |
| `preload-project` | 2 | Warms up workspace when the editor opens |
| `head-tracking` | 1 | Face/body detection for smart reframing |
| `generate-reframe` | 1 | Auto-reframe from head tracking data |
| `generate-caption-styles` | 2 | AI-powered per-caption styling |
| `youtube-clip` | 2 | YouTube clip extraction |
| `segmentation` | 1 | Speaker isolation (GPU-intensive) |

## Architecture

```
src/
├── index.ts                 # Worker entry, registers all 12 BullMQ workers
├── config.ts                # Environment configuration
├── logger.ts                # Pino logger
├── workspace.ts             # Workspace management (dev + prod paths)
│
├── processors/              # Job processors (one per queue)
│   ├── index.ts             # Barrel re-exports
│   ├── transcribe.ts
│   ├── plan-visuals.ts
│   ├── head-tracking.ts
│   ├── generate-reframe.ts
│   ├── generate-caption-styles.ts
│   ├── preload-project.ts
│   ├── segmentation.ts
│   ├── youtube-clip.ts
│   ├── render/              # Video rendering + subtitle burn-in
│   │   ├── index.ts         # processRenderJob + re-exports
│   │   ├── types.ts         # Interfaces, constants
│   │   ├── fonts.ts         # Google Fonts download, caching, metrics
│   │   ├── subtitles.ts     # ASS subtitle generation
│   │   └── ffmpeg.ts        # FFmpeg encoding, Remotion bundle, compositing
│   ├── generate-visuals/    # Full AI visual generation pipeline
│   │   ├── index.ts         # processGenerateVisualsJob + re-exports
│   │   ├── types.ts
│   │   ├── validation.ts    # Speaker grid, asset extraction, pre-processing
│   │   ├── storage.ts       # S3 bundle/source uploads
│   │   └── subprocess.ts    # Claude Code subprocess management
│   ├── edit-visuals/        # Conversational editing
│   │   ├── index.ts         # processEditVisualsJob + re-exports
│   │   ├── types.ts
│   │   ├── context.ts       # Scene/layout/asset context building
│   │   ├── editor.ts        # Claude editor subprocess
│   │   └── build.ts         # esbuild compilation, S3 uploads
│   └── svg-animation/       # Image → SVG animation
│       ├── index.ts         # processSvgAnimationJob + re-exports
│       ├── types.ts
│       ├── converter.ts     # Image-to-SVG conversion (OpenAI Vision)
│       ├── components.ts    # Remotion component code generation
│       └── build.ts         # Compilation, bundling, S3 uploads
│
├── agents/                  # AI agent system
│   ├── claude-sdk/          # TypeScript Claude Agent SDK integration
│   │   ├── index.ts
│   │   └── visual-generator.ts
│   ├── mcp-servers/         # MCP tool servers for the Animator agent
│   ├── claude_visual_generator.py  # Python-based visual generator
│   ├── visual_director.py
│   ├── transcript_formatter.py
│   ├── npm_search.py
│   └── setup_claude_auth.py
│
├── prompts/                 # All prompt files (Python loaders + .md templates)
│   ├── index.ts             # Barrel re-exports
│   ├── loader.ts            # TypeScript .md file loader with caching
│   ├── loader.py            # Python .md file loader
│   ├── _loader.py           # Python bridge module
│   ├── _themes.py           # Shared theme constants
│   ├── __init__.py          # Python barrel exports
│   ├── generate-visuals.ts  # Style guidelines with design tokens
│   ├── visual-references.ts # Few-shot Remotion code examples
│   ├── studio-templates.ts  # Studio template catalog builder
│   ├── animator/            # Animator phase prompts
│   │   ├── animator.py      # Python prompt builder
│   │   └── *.md             # System, base, verify, fix prompts
│   ├── director/            # Director phase prompts
│   │   ├── director.py      # Python prompt builder
│   │   └── *.md             # System, display-mode, style prompts
│   ├── assistant-director/
│   ├── motion/              # Motion utility reference prompts
│   ├── references/          # Few-shot example prompts
│   └── transcribe/          # Word analysis prompts
│
├── services/                # External service integrations
│   ├── index.ts             # Barrel re-exports
│   ├── redis.ts             # Redis pub/sub, job progress, cancel handlers
│   ├── minio.ts             # MinIO/S3 file upload/download
│   ├── freepik.ts           # Freepik API (illustrations)
│   ├── pexels.ts            # Pexels API (photos)
│   ├── iconify.ts           # Iconify icon search
│   └── image-fetcher.ts     # Routes [IMAGE: keyword] to Pexels/Freepik
│
├── utils/
│   ├── index.ts             # Barrel re-exports
│   ├── template.ts          # Remotion template download/extraction
│   ├── python.ts            # Python subprocess utilities
│   ├── redis.ts             # Redis connection helper
│   └── heartbeat-progress.ts
│
├── types/
│   └── renderer.d.ts        # Ambient type declarations
│
└── db/
    └── index.ts             # Drizzle ORM schema + PostgreSQL connection
```

## Visual Generation Pipeline

The visual generation pipeline is a multi-phase AI system that converts transcripts into animated Remotion compositions.

### Phase 0: Assistant Director

Analyzes the transcript to classify tone/theme and produces a **Creative Brief** (`CREATIVE_BRIEF.md`) that guides downstream agents. Responsibilities:
- Tone classification (playful, professional, dramatic, educational, inspirational)
- Visual asset strategy (photos vs illustrations vs icons per beat)
- Color palette and font pairing recommendations
- Scene structure hints (beat count, hero moments, pacing)

### Phase 1: Director

Reads the Creative Brief and transcript, then creates a detailed scene-by-scene plan:
- Outputs `SCENE_PLAN.md` (human-readable) and `scenes.json` (machine-readable)
- Defines timing, visual focus, transitions, key elements per scene
- Tags scenes with `[IMAGE: keyword]` entries for asset fetching
- The **Image Fetcher** service then routes image requests to Pexels (photos) or Freepik (illustrations) and downloads assets into the workspace

### Phase 2: Animator

Implements the Director's plan as production TypeScript/React code for Remotion:
- Reads `SCENE_PLAN.md` and `scenes.json`
- Generates one scene at a time with chain-of-thought reasoning logged to `IMPLEMENTATION_LOG.md`
- Has access to **MCP tool servers**:
  - **Asset Server** - download files, take screenshots, search stock photo APIs
  - **Viewport Server** - query effective scene dimensions, validate scene code
- Uses pre-built Studio templates when available, custom visuals otherwise
- Outputs bundled Remotion compositions uploaded to MinIO/S3

### Orchestration

- `generate-visuals` processor runs all three phases end-to-end
- `plan-visuals` processor runs only Phases 0-1 for user approval before committing to generation
- `edit-visuals` processor restores existing source files and runs Claude with the user's edit request

## Job Types

### Transcribe
Converts audio/video to word-level transcript with timestamps.

```typescript
interface TranscribeJobData {
  projectId: string;
  jobId: string;
  videoKey: string; // S3 key
}
```

### Generate Visuals
Runs the full AI pipeline (Assistant Director, Director, Animator).

```typescript
interface GenerateVisualsJobData {
  projectId: string;
  jobId: string;
  stylePreset: 'minimal' | 'modern' | 'playful' | 'bold' | 'classic' | 'apple' | 'google' | 'studio';
  layoutMode: 'pip' | 'split-horizontal' | 'split-vertical';
  dimensions: { width: number; height: number };
}
```

### Plan Visuals
Director-only phase for plan approval flow.

```typescript
interface PlanVisualsJobData {
  projectId: string;
  jobId: string;
  stylePreset: string;
  layoutMode: string;
  dimensions: { width: number; height: number };
}
```

### Edit Visuals
Conversational editing of existing compositions.

```typescript
interface EditVisualsJobData {
  projectId: string;
  prompt: string;
  // ... compositionId, existing source context
}
```

### Render
Renders Remotion composition to video (local SSR or AWS Lambda).

```typescript
interface RenderJobData {
  projectId: string;
  compositionId: string;
  bundleUrl: string;
}
```

### SVG Animation
Converts uploaded images to animated SVG Remotion compositions.

```typescript
interface SvgAnimationJobData {
  projectId: string;
  // ... image key, description, placement info
}
```

### Head Tracking
Runs face/body detection on video for smart reframing.

```typescript
interface HeadTrackingJobData {
  projectId: string;
  jobId: string;
  videoKey: string;
}
```

### Preload Project
Warms up workspace by downloading source files when the editor opens.

```typescript
interface PreloadProjectJobData {
  projectId: string;
  compositionId: string;
}
```

## Development

```bash
# Start development (with hot reload)
pnpm dev

# Build for production
pnpm build

# Type check
pnpm typecheck

# Run tests
pnpm test
```

## Python Setup

The worker requires Python 3.10+ for AI visual generation, audio enhancement, and head tracking.

```bash
# Using Miniconda (recommended)
conda create -n viona python=3.10 -y
conda activate viona
pip install -r requirements.txt

# Using venv
python -m venv .venv
.venv/Scripts/activate  # Windows
source .venv/bin/activate  # macOS/Linux
pip install -r requirements.txt
```

Set `PYTHON_PATH` in your `.env` if not auto-detected.

## WhisperX Setup

For local transcription:

```bash
# Windows
pnpm whisperx:setup:win

# macOS/Linux
pnpm whisperx:setup
```

## Audio Enhancement Setup

```bash
# Windows
pnpm enhance:setup:win

# macOS/Linux
pnpm enhance:setup
```

## Environment Variables

Key variables:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis URL for BullMQ |
| `S3_*` / `MINIO_*` | MinIO/S3 storage configuration |
| `TRANSCRIPTION_MODE` | `local` (WhisperX) or `api` (OpenAI) |
| `WHISPER_*` | WhisperX settings |
| `CLAUDE_CODE_OAUTH_TOKEN` | OAuth token for Claude Agent SDK (from `claude setup-token`) |
| `CLAUDE_AGENT_MODEL` | Model for visual generation (default: `claude-opus-4-6`) |
| `CLAUDE_AGENT_MAX_TURNS` | Maximum agent turns (default: 100) |
| `CLAUDE_AGENT_TIMEOUT` | Generation timeout in seconds (default: 2700) |
| `PYTHON_PATH` | Python executable path |
| `FREEPIK_API_KEY` | Freepik API key for icon/illustration search |
| `PEXELS_API_KEY` | Pexels API key for stock photos/videos |
| `UNSPLASH_ACCESS_KEY` | Unsplash API key (used by asset MCP server) |
| `REMOTION_AWS_REGION` | AWS region for Lambda rendering |
| `REMOTION_FUNCTION_NAME` | Lambda function name for remote rendering |
| `REMOTION_SERVE_URL` | S3 URL to bundled Remotion site |

## Production (Railway)

In production:
- Uses `/tmp/workspace` for generated files
- Uses `/tmp/template` for the Remotion template
- Bundles are uploaded to S3 for persistence
- Claude OAuth token set via `CLAUDE_CODE_OAUTH_TOKEN` environment variable
- Template is downloaded from S3 on startup via `ensureTemplate()`
- Graceful shutdown closes all 12 workers in parallel, waiting for in-progress jobs

## Dependencies

### Runtime
- **bullmq** - Job queue processing
- **@remotion/bundler** + **@remotion/renderer** - Remotion bundle creation and SSR rendering
- **drizzle-orm** + **pg** - PostgreSQL database access
- **minio** - S3-compatible storage client
- **ioredis** - Redis client for pub/sub and BullMQ
- **openai** - OpenAI Whisper API for cloud transcription + SVG conversion
- **unzipper** - ZIP extraction for templates
- **pino** - Structured logging
- **nanoid** - ID generation
- **@viona/shared** - Shared types and constants
- **@viona/renderer** - Remotion video components
- **@viona/templates** - Pre-built Studio templates

### Dev
- **tsx** - TypeScript execution with hot reload
- **tsup** - TypeScript bundler
- **vitest** - Test runner
- **pino-pretty** - Pretty-printed dev logs
