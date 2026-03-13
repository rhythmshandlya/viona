# Worker Package Cleanup Design

## Goal

Organize, standardize, and improve readability of `packages/worker` through moderate decomposition of large files, prompt consolidation, and consistency fixes.

## 1. Decompose Large Processors

Break processors >30KB into sub-module folders. Smaller processors stay as single files.

### `processors/render/` (from 182KB render.ts)

- `index.ts` — main `processRenderJob` flow, re-exports
- `subtitles.ts` — subtitle generation, ASS formatting, style mapping
- `ffmpeg.ts` — FFmpeg filter chains, audio mixing
- `fonts.ts` — font loading, Google Fonts integration
- `types.ts` — shared render types

### `processors/generate-visuals/` (from 67KB)

- `index.ts` — main `processGenerateVisualsJob` orchestration, re-exports
- `director.ts` — scene planning phase
- `animator.ts` — code generation phase
- `verifier.ts` — screenshot verification + fix loop
- `validation.ts` — scene plan validation, interpolate clamping checks
- `types.ts` — shared types

### `processors/edit-visuals/` (from 40KB)

- `index.ts` — main `processEditVisualsJob`, re-exports
- `conversation.ts` — conversation context management
- `tools.ts` — edit tool definitions
- `types.ts` — shared types

### `processors/svg-animation/` (from 36KB)

- `index.ts` — main flow, re-exports
- `converter.ts` — image-to-SVG conversion
- `animator.ts` — SVG animation logic
- `types.ts`

### Single-file processors (unchanged)

`transcribe.ts`, `head-tracking.ts`, `preload-project.ts`, `generate-reframe.ts`, `generate-caption-styles.ts`, `segmentation.ts`, `youtube-clip.ts`

## 2. Consolidate Prompts into `src/prompts/`

All prompt files (`.md`, `.py` loaders, `.ts` loaders) live under `src/prompts/`.

- Move `src/agents/prompts/*.py` into `src/prompts/` (update Python import paths)
- Remove duplicate `src/prompts/loader.py`
- Add `index.ts` barrel exports per prompt subdirectory
- Python loaders (`_loader.py`, `animator.py`, `director.py`) sit alongside the `.md` files they load

## 3. Fix Inconsistencies

- Add missing `.js` extensions on imports (e.g., `workspace.ts` line 11)
- Standardize all exports to named exports (no default exports)
- Add barrel `index.ts` to every folder and sub-module folder
- Remove dead references (e.g., pexels in image-fetcher if present)

## 4. Target Folder Structure

```
src/
├── index.ts
├── config.ts
├── logger.ts
├── workspace.ts
├── processors/
│   ├── index.ts
│   ├── transcribe.ts
│   ├── head-tracking.ts
│   ├── preload-project.ts
│   ├── generate-reframe.ts
│   ├── generate-caption-styles.ts
│   ├── segmentation.ts
│   ├── youtube-clip.ts
│   ├── render/
│   │   ├── index.ts
│   │   ├── subtitles.ts
│   │   ├── ffmpeg.ts
│   │   ├── fonts.ts
│   │   └── types.ts
│   ├── generate-visuals/
│   │   ├── index.ts
│   │   ├── director.ts
│   │   ├── animator.ts
│   │   ├── verifier.ts
│   │   ├── validation.ts
│   │   └── types.ts
│   ├── edit-visuals/
│   │   ├── index.ts
│   │   ├── conversation.ts
│   │   ├── tools.ts
│   │   └── types.ts
│   └── svg-animation/
│       ├── index.ts
│       ├── converter.ts
│       ├── animator.ts
│       └── types.ts
├── agents/
│   ├── claude-sdk/
│   │   ├── index.ts
│   │   └── visual-generator.ts
│   ├── mcp-servers/
│   ├── claude_visual_generator.py
│   ├── visual_director.py
│   ├── transcript_formatter.py
│   ├── npm_search.py
│   └── setup_claude_auth.py
├── prompts/
│   ├── index.ts
│   ├── _loader.py
│   ├── animator/
│   │   ├── index.ts
│   │   ├── animator.py
│   │   ├── base.md
│   │   ├── system.md
│   │   └── ...
│   ├── director/
│   │   ├── index.ts
│   │   ├── director.py
│   │   └── ...
│   ├── assistant-director/
│   ├── generate-visuals/
│   ├── motion/
│   ├── references/
│   └── transcribe/
├── services/
│   ├── index.ts
│   ├── redis.ts
│   ├── minio.ts
│   ├── freepik.ts
│   ├── iconify.ts
│   └── image-fetcher.ts
├── utils/
│   ├── index.ts
│   ├── template.ts
│   ├── python.ts
│   ├── redis.ts
│   └── heartbeat-progress.ts
├── types/
│   ├── index.ts
│   └── renderer.d.ts
└── db/
    └── index.ts
```

## 5. Unchanged

- `config.ts`, `logger.ts` — already clean
- Small single-file processors
- Python agent files in `agents/` (only prompt files move)
- MCP servers in `agents/mcp-servers/`
- Test files move alongside their processor (e.g., `render.test.ts` → `render/render.test.ts`)
