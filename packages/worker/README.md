# @reelify/worker

Background job processor for Cllipify, handling transcription, visual generation, and video rendering.

## Overview

The worker package processes async jobs from BullMQ queues:
- **transcribe** - Audio transcription with WhisperX or OpenAI API
- **enhance-audio** - Audio enhancement (noise reduction, loudness normalization)
- **generate-visuals** - AI visual generation using Claude Agent SDK
- **render** - Video rendering with Remotion

## Architecture

```
src/
├── index.ts              # Worker entry point
├── config.ts             # Environment configuration
├── logger.ts             # Pino logger
├── workspace.ts          # Workspace management
├── processors/
│   ├── transcribe.ts     # Transcription job processor
│   ├── enhance-audio.ts  # Audio enhancement processor
│   ├── generate-visuals.ts # Visual generation processor
│   └── render.ts         # Remotion render processor
├── agents/
│   └── claude-sdk/       # Claude Agent SDK integration
│       └── visual-generator.ts
├── utils/
│   ├── template.ts       # Template management
│   └── bundle.ts         # Bundle utilities
└── scripts/              # Python scripts for AI/audio

remotion-template/        # Base Remotion template
workspace/                # Generated project files (dev)
bundles/                  # Output bundles (dev)
```

## Job Types

### Transcribe
Converts audio to word-level transcript with timestamps.

```typescript
interface TranscribeJobData {
  projectId: string;
  audioPath: string;  // S3 key
}
```

### Generate Visuals
Uses Claude Agent SDK for AI-powered visual generation with two phases:
1. **Director** - Analyzes transcript and creates scene plan
2. **Animator** - Implements scenes with React/Remotion components

```typescript
interface GenerateVisualsJobData {
  projectId: string;
  transcript: TranscriptWord[];
}
```

### Render
Renders Remotion composition to video.

```typescript
interface RenderJobData {
  projectId: string;
  compositionId: string;
  bundleUrl: string;
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

The worker requires Python 3.10+ for AI visual generation.

```bash
# Using Miniconda (recommended)
conda create -n cllipify python=3.10 -y
conda activate cllipify
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

## Environment Variables

Key variables:
- `DATABASE_URL` - PostgreSQL connection
- `REDIS_URL` - Redis for BullMQ
- `S3_*` - Storage configuration
- `TRANSCRIPTION_MODE` - `local` or `api`
- `WHISPER_*` - WhisperX settings
- `ANTHROPIC_API_KEY` - Claude API key
- `CLAUDE_AGENT_*` - Agent configuration
- `PYTHON_PATH` - Python executable path

## Production (Railway)

In production:
- Uses `/tmp/workspace` for generated files
- Uses `/tmp/bundles` for output bundles
- Bundles are uploaded to S3 for persistence
- Claude CLI credentials are set from environment variables

## Dependencies

- **bullmq** - Job queue processing
- **@remotion/bundler** - Remotion bundle creation
- **@remotion/renderer** - Video rendering
- **execa** - Python subprocess execution
- **minio** - S3-compatible storage
- **@reelify/shared** - Shared types
- **@reelify/renderer** - Remotion components
