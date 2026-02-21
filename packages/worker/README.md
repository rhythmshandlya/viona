# @viona/worker

Background job processor for Viona, handling transcription, AI visual generation, audio enhancement, video rendering, and more.

## Overview

The worker package consumes async jobs from BullMQ queues. It orchestrates a multi-phase AI visual generation pipeline powered by Claude Agent SDK, manages audio/video processing via Python scripts and FFmpeg, and renders final output with Remotion.

**Registered queues (8):**

| Queue | Concurrency | Description |
|---|---|---|
| `transcribe` | 1 | Audio transcription with WhisperX (local) or OpenAI Whisper API |
| `render` | 2 | Video rendering with Remotion (SSR or Lambda) |
| `enhance-audio` | 1 | Audio enhancement (noise reduction, loudness normalization) |
| `generate-visuals` | 1 | Full AI visual generation pipeline (Director + Animator) |
| `plan-visuals` | 1 | Director phase only (creates scene plan for user approval) |
| `edit-visuals` | 1 | Conversational editing of existing compositions |
| `svg-animation` | 1 | Converts uploaded images to animated SVG compositions |
| `preload-project` | 2 | Warms up workspace when the editor opens |

## Architecture

```
src/
├── index.ts                 # Worker entry, registers all 8 BullMQ workers
├── config.ts                # Environment configuration
├── logger.ts                # Pino logger
├── workspace.ts             # Workspace management (dev + prod paths)
│
├── processors/              # Job processors (one per queue)
│   ├── transcribe.ts        # WhisperX / OpenAI Whisper transcription
│   ├── render.ts            # Remotion SSR + Lambda rendering, subtitle burn-in
│   ├── enhance-audio.ts     # FFmpeg-based audio enhancement pipeline
│   ├── generate-visuals.ts  # Full visual generation (Assistant Director → Director → Animator)
│   ├── plan-visuals.ts      # Director-only phase for plan approval flow
│   ├── edit-visuals.ts      # Edit existing compositions with user prompts
│   ├── svg-animation.ts     # Image → SVG → animated Remotion composition
│   ├── generate-broll.ts    # Auto-generates B-roll track from Pexels videos
│   ├── generate-caption-styles.ts  # AI-powered per-caption styling
│   ├── generate-reframe.ts  # Auto-reframe from head tracking data
│   ├── head-tracking.ts     # Face/body tracking via Python (detect_head.py)
│   └── preload-project.ts   # Workspace warm-up from MinIO/S3 sources
│
├── agents/                  # AI agent system
│   ├── claude-sdk/          # TypeScript Claude Agent SDK integration
│   │   ├── index.ts         # Exports generateVisualsWithClaudeSDK
│   │   └── visual-generator.ts  # SDK-based visual generation with planning + scene gen
│   │
│   ├── mcp-servers/         # MCP tool servers for the Animator agent
│   │   ├── asset-server.js  # download_file, screenshot, search_unsplash, search_pexels, download_stock_photo
│   │   └── viewport-server.js  # get_scene_dimensions, validate_scene_code
│   │
│   ├── prompts/             # Python prompt modules for each agent phase
│   │   ├── __init__.py
│   │   ├── assistant_director.py  # Phase 0: tone classification, creative brief
│   │   ├── director.py            # Phase 1: scene planning, visual story design
│   │   └── animator.py            # Phase 2: Remotion code implementation
│   │
│   ├── claude_visual_generator.py  # Python-based visual generator (Claude Agent SDK + OAuth)
│   ├── visual_director.py         # Director utilities (style colors, event emission, plan validation)
│   ├── transcript_formatter.py    # Converts WhisperX output to Director-friendly format
│   ├── npm_search.py              # NPM package search/validation for animation packages
│   ├── token_utils.py             # OAuth token export/import/refresh for server deployment
│   └── setup_claude_auth.py       # Claude Code credential setup helper
│
├── services/                # External service integrations
│   ├── redis.ts             # Redis pub/sub for job progress, cancel handlers
│   ├── minio.ts             # MinIO/S3 file upload/download
│   ├── remotion-lambda.ts   # Remotion Lambda rendering (AWS)
│   ├── log-streamer.ts      # Debounced log streaming for agent output
│   ├── freepik.ts           # Freepik API (icon/illustration search and download)
│   ├── pexels.ts            # Pexels API (photo search and download)
│   └── image-fetcher.ts     # Orchestrator: routes [IMAGE: keyword] to Pexels/Freepik
│
├── prompts/                 # Visual generation prompt libraries (TypeScript)
│   ├── generate-visuals.ts  # Style guidelines with design tokens per preset
│   ├── visual-references.ts # Few-shot Remotion code examples (common patterns)
│   ├── studio-templates.ts  # Studio theme template catalog builder
│   ├── motion-utilities.ts  # Apple/Google ad-style motion snippets
│   └── physics-helpers.ts   # Physics simulation patterns (gravity, bounce, etc.)
│
├── utils/
│   ├── template.ts          # Remotion template download/extraction from S3
│   ├── python.ts            # Python subprocess execution utilities
│   └── heartbeat-progress.ts  # Periodic progress heartbeat to prevent stalls
│
└── db/
    └── index.ts             # Drizzle ORM schema + PostgreSQL connection

scripts/                     # Setup and utility scripts
├── whisperx_transcribe.py   # WhisperX transcription script
├── enhance_audio.py         # Audio enhancement (denoising, normalization)
├── detect_head.py           # Face/body detection for head tracking
├── setup-whisperx.sh / .bat # WhisperX environment setup
├── setup-enhance.sh / .bat  # Audio enhancement environment setup
├── upload-template.ts       # Upload Remotion template to S3
├── download-template.ts     # Download Remotion template from S3
├── push-claude-tokens.js    # Push OAuth tokens to production
├── test_enhance.py          # Audio enhancement tests
├── test-bundle-loading.cjs  # Bundle loading smoke test
└── requirements.txt         # Python dependencies

remotion-template/           # Base Remotion template (downloaded from S3)
workspace/                   # Generated project files (dev)
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

### Enhance Audio
Applies noise reduction and loudness normalization via FFmpeg/Python.

```typescript
interface EnhanceAudioJobData {
  projectId: string;
  jobId: string;
  videoKey: string;
  audioTrackId: string;
  audioItemId: string;
  videoItemId: string;
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
- Graceful shutdown closes all 8 workers in parallel, waiting for in-progress jobs

## Dependencies

### Runtime
- **bullmq** - Job queue processing
- **@remotion/bundler** + **@remotion/renderer** + **@remotion/lambda** - Remotion bundle creation, rendering (local + Lambda)
- **@remotion/captions** - Caption processing
- **drizzle-orm** + **pg** - PostgreSQL database access
- **minio** - S3-compatible storage client
- **ioredis** - Redis client for pub/sub and BullMQ
- **execa** - Python subprocess execution
- **fluent-ffmpeg** - FFmpeg wrapper for audio/video processing
- **openai** - OpenAI Whisper API for cloud transcription
- **archiver** + **unzipper** - ZIP handling for templates and bundles
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
