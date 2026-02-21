# @viona/shared

Shared TypeScript types, constants, utilities, and storage service for the Viona monorepo.

## Exports

The package exposes three entry points:

### `@viona/shared` (main)

Re-exports everything from `./types` and `./storage`.

```typescript
import { Project, StorageService, getStorage } from '@viona/shared';
```

### `@viona/shared/types`

All type definitions, interfaces, constants, and helper functions used across the API, worker, and web app.

```typescript
import { Project, TimelineItem, SubtitleStyle } from '@viona/shared/types';
```

### `@viona/shared/storage`

S3-compatible storage abstraction built on the `minio` client.

```typescript
import { getStorage, StorageService, StorageConfig } from '@viona/shared/storage';
```

## Types

Defined in `src/types/index.ts`:

### Timeline & Items

| Type | Description |
|------|-------------|
| `TimelineItemType` | `'subtitle' \| 'visual' \| 'audio' \| 'effect'` |
| `TimelineItem<T>` | Generic timeline entry with `id`, `trackId`, `startMs`, `endMs`, `data` |
| `TimelineItemData` | Union of `SubtitleData \| VisualData \| AudioData \| EffectData` |
| `SubtitleItem` | `TimelineItem<SubtitleData>` |
| `VisualItem` | `TimelineItem<VisualData>` |

### Subtitles & Captions

| Type | Description |
|------|-------------|
| `SubtitleDisplayMode` | `'word-by-word' \| 'phrase' \| 'karaoke'` |
| `SubtitleWord` | Word with `text`, `startMs`, `endMs`, optional `styleOverrides` |
| `SubtitleStyle` | Full caption styling: font, colors, animation, position, effects |
| `SubtitleData` | `text` + `words[]` + `style` + optional `styleOverrides` |
| `WordStyleOverrides` | Per-word overrides: `color`, `fontWeight`, `scale`, `emphasisBg` |

### Position System (V2)

| Type | Description |
|------|-------------|
| `CaptionPosition` | Anchor-based positioning: `anchor`, `offsetX`, `offsetY`, `rotation`, `textAlign` |
| `SubtitlePositionLegacy` | Legacy `'top' \| 'center' \| 'bottom'` (backward compat) |
| `SafeZone` | Platform-specific safe margins (`top`, `bottom`, `left`, `right` as %) |
| `PLATFORM_SAFE_ZONES` | Presets for TikTok, Instagram Reels, YouTube Shorts, Universal |
| `migratePosition()` | Converts legacy string position to `CaptionPosition` object |

### Animation System (V2)

| Type | Description |
|------|-------------|
| `AnimationType` | 30+ animation types across Viral, Cinematic, Ad, and Motion categories |
| `EasingType` | `'linear' \| 'ease-out' \| 'ease-in-out' \| 'spring' \| 'elastic' \| 'bounce'` |
| `AnimationConfig` | `{ in, active, out, easing }` |
| `SubtitleAnimationLegacy` | Legacy `'none' \| 'pop' \| 'fade' \| 'highlight'` |

### Effects System (V3)

| Type | Description |
|------|-------------|
| `CaptionEffects` | Combined `shadow` + `shadowSecondary` + `glow` |
| `ShadowEffect` | `offsetX`, `offsetY`, `blur`, `color`, `opacity` |
| `GlowEffect` | `enabled`, `color`, `intensity`, `size` |
| `StrokeStyle` | Text outline: `width`, `color` |
| `migrateTextShadow()` | Converts legacy CSS `textShadow` string to `CaptionEffects` |

### Visuals

| Type | Description |
|------|-------------|
| `VisualType` | `'chart' \| 'flowchart' \| 'list' \| 'comparison' \| 'framework' \| 'stat'` |
| `VisualData` | `visualType` + `props` + `style` |
| `VisualStyle` | Theme (`minimal`, `modern`, `playful`, etc.) + colors |

### Dynamic Layout

| Type | Description |
|------|-------------|
| `DisplayMode` | `'pip' \| 'fullscreen' \| 'overlay'` |
| `LayoutTransitionType` | `'cut' \| 'fade' \| 'zoom-in' \| 'zoom-out'` |
| `LayoutTransition` | Enter/exit transitions with duration |
| `coverageRatio()` | Calculates visible % of source frame when cover-fitting into canvas |
| `CoverageTier` | `'flexible' \| 'moderate' \| 'conservative'` based on coverage ratio |

### Video Settings

| Type | Description |
|------|-------------|
| `VideoSettings` | Output dimensions (`canvasWidth`, `canvasHeight`), crop (`cropX`, `cropY`), `scale` |
| `CanvasFormat` | Format preset with `id`, `name`, `width`, `height`, `aspectRatio`, `description` |
| `CANVAS_FORMATS` | Presets: 9:16 (Vertical), 16:9 (Landscape), 1:1 (Square), 4:5 (Portrait) |

### Project

| Type | Description |
|------|-------------|
| `Project` | Core entity: `id`, `status`, `videoKey`, `durationMs`, `fps`, source dims, `videoSettings` |
| `ProjectStatus` | `'uploading' \| 'processing' \| 'ready' \| 'rendering' \| 'complete' \| 'failed'` |
| `ProjectWithTracks` | `Project` + `tracks[]` |
| `ProjectFull` | `ProjectWithTracks` + `items[]` + optional `transcript` |

### Track

| Type | Description |
|------|-------------|
| `TrackType` | `'video' \| 'subtitle' \| 'visual' \| 'audio'` |
| `Track` | `id`, `projectId`, `type`, `name`, `position`, `locked`, `visible` |

### Transcript

| Type | Description |
|------|-------------|
| `TranscriptWord` | `text`, `startMs`, `endMs`, `confidence` |
| `Transcript` | `id`, `projectId`, `words[]`, `rawOutput` |

### Audio

| Type | Description |
|------|-------------|
| `AudioData` | `src`, `originalSrc`, optional `enhancedSrc`, `isEnhanced`, `volume`, fades |

### Jobs

| Type | Description |
|------|-------------|
| `JobType` | `'transcribe' \| 'analyze' \| 'generate-visual' \| 'render' \| 'enhance-audio'` |
| `JobStatus` | `'pending' \| 'processing' \| 'complete' \| 'failed'` |
| `Job` | `id`, `projectId`, `type`, `status`, `progress`, optional `error` |

### API Response Types

| Type | Description |
|------|-------------|
| `CreateProjectResponse` | `{ projectId, uploadUrl }` |
| `ProcessProjectResponse` | `{ jobId }` |
| `RenderProjectResponse` | `{ jobId }` |
| `DownloadResponse` | `{ url, expiresAt }` |

### WebSocket Types

| Type | Description |
|------|-------------|
| `WSMessageType` | `'job:progress' \| 'job:complete' \| 'job:error' \| 'project:updated'` |
| `WSMessage<T>` | `{ type, payload }` |
| `JobProgressPayload` | `{ jobId, progress, message? }` |
| `JobCompletePayload` | `{ jobId, projectId }` |
| `JobErrorPayload` | `{ jobId, error }` |

### Default Constants

| Constant | Value |
|----------|-------|
| `DEFAULT_VIDEO_SETTINGS` | 1080x1920, crop centered, scale 1.0 |
| `DEFAULT_SUBTITLE_STYLE` | Phrase mode, elastic-pop animation, Inter font, white/yellow |
| `DEFAULT_CAPTION_POSITION` | Bottom-anchored, centered |
| `DEFAULT_CAPTION_EFFECTS` | Standard drop shadow, no glow |
| `DEFAULT_LAYOUT_TRANSITION` | Cut (instant), 0ms duration |
| `DEFAULT_FPS` | 30 |
| `DEFAULT_CANVAS_WIDTH` | 1080 |
| `DEFAULT_CANVAS_HEIGHT` | 1920 |

## Storage Service

`StorageService` is a class wrapping the MinIO client with prefix-aware helpers for uploads, outputs, templates, and bundles.

### Configuration

Created from environment variables via `createStorageConfigFromEnv()`:

**Local (MinIO):**
```bash
S3_ENDPOINT=localhost
S3_PORT=9000
S3_ACCESS_KEY=reelify
S3_SECRET_KEY=reelify123
S3_BUCKET=viona
```

**Production (Railway Buckets):**
```bash
BUCKET_ENDPOINT=storage.railway.internal
BUCKET_ACCESS_KEY_ID=xxx
BUCKET_SECRET_ACCESS_KEY=xxx
BUCKET_NAME=xxx
```

Railway internal connections use HTTP; external connections use HTTPS.

### Usage

```typescript
import { getStorage } from '@viona/shared';

// Singleton (lazy-initialized from env vars)
const storage = getStorage();

// Or initialize with explicit config
import { initStorage } from '@viona/shared';
const storage = initStorage({ endpoint: '...', /* ... */ });
```

### Methods

| Category | Methods |
|----------|---------|
| **Generic** | `uploadBuffer`, `uploadStream`, `uploadFile`, `downloadBuffer`, `downloadFile`, `getObjectStream`, `getPartialObjectStream`, `deleteObject`, `objectExists`, `getObjectStat` |
| **Uploads** | `uploadUserFile`, `downloadUserFile`, `getUserFileUrl`, `getUploadPresignedUrl` |
| **Outputs** | `uploadOutput`, `downloadOutput`, `getOutputUrl` |
| **Bundles** | `uploadBundle`, `downloadBundle`, `getBundleUrl`, `bundleExists`, `deleteBundle` |
| **Templates** | `uploadTemplate`, `downloadTemplate`, `templateExists`, `listTemplates` |
| **Presigned URLs** | `getPresignedUploadUrl`, `getPresignedDownloadUrl` |
| **List** | `listObjects`, `deleteObjects` |
| **Bucket** | `ensureBucket` |
| **Accessors** | `bucketName`, `prefixes`, `getClient()`, `isRailway()` |

## Bucket Structure

Single bucket (`viona` locally, configured via env in production) with prefix-based organization:

```
<bucket>/
  uploads/        # User-uploaded source files
  outputs/
    bundles/      # Remotion bundle ZIPs (per project)
    videos/       # Rendered video outputs
  templates/      # Remotion template files
```

## Directory Structure

```
src/
  index.ts          # Re-exports types + storage
  types/
    index.ts        # All type definitions, interfaces, constants, helpers
  storage.ts        # StorageConfig, StorageService class, getStorage/initStorage
```

## Development

```bash
# Build
pnpm build

# Watch mode
pnpm dev

# Type check
pnpm typecheck

# Lint
pnpm lint
```

## Dependencies

- **minio** - S3-compatible object storage client
- **tsup** - Build tool (dev)
- **typescript** (dev)
