# Reference Codebase Analysis: twick

> Findings from `.reference/twick/` — a production-grade video editor SDK monorepo.
> Packages: canvas, timeline, effects, browser-render, live-player, media-utils, workflow, ai-models, render-server, studio, video-editor

---

## Progress

- [x] Video playback & browser rendering
- [x] Timeline architecture
- [x] Canvas rendering engine
- [x] Effects & media utils
- [x] Video editor & workflow
- [x] Render server
- [x] AI & MCP agent
- [x] Studio & examples
- [x] Cloud functions & visualizer

---

## 1. Video Playback & Browser Rendering

### Architecture overview

Twick splits rendering from playback:
- **browser-render**: Frame-by-frame export using **WebCodecs API** + **mp4-wasm** fallback. Not for real-time playback.
- **live-player**: Real-time preview via custom `<twick-player>` web component wrapping HTML5 `<video>`.

### Key patterns we should consider

#### Service Worker media caching (actionable)
**File**: `browser-render/public/audio-worker.js`
- Intercepts ALL media fetch requests (`.mp4, .webm, .mp3, .wav, .ogg, .m4a`)
- Caches responses in IndexedDB via `caches` API
- Transparent fallback to network on cache miss
- **Our equivalent**: blob prefetch. But a Service Worker would persist across page refreshes and provide a cache layer below our blob approach.

#### Video metadata preloading
**File**: `browser-render/src/browser-renderer.ts:675-704`
```typescript
const preloadVideo = document.createElement('video');
preloadVideo.crossOrigin = 'anonymous';
preloadVideo.preload = 'metadata';
preloadVideo.src = videoUrl;
// Wait for loadedmetadata event or 30s timeout
```
- Creates temporary `<video>` with `preload='metadata'` before rendering
- **Our equivalent**: `@remotion/preload`'s `preloadVideo()` does the same thing

#### Frame yielding for UI responsiveness
**File**: `browser-render/src/browser-renderer.ts:737-745`
```typescript
if (frame % 10 === 0) {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}
```
- Yields to browser every 10 frames during heavy rendering
- **Actionable**: We should do this in any long-running client operations

#### useRef for player state (avoid re-renders)
**File**: `live-player/src/components/live-player.tsx:92-96`
- Stores player instance, HTML element, and ID as refs, NOT state
- Prevents React re-renders when player internals change
- **Actionable**: Audit our `usePlayerSync` — we use refs correctly already

#### setAttribute instead of React props
**File**: `live-player/src/components/live-player.tsx:140-147`
- Updates project data via `setAttribute` on the web component instead of React props
- Avoids component re-mount on data changes
- **Our pattern is different** (Remotion Player with `inputProps`), but the principle of minimizing re-mounts is shared

#### Web Audio API for audio processing
**File**: `browser-render/src/audio/audio-processor.ts`
- `AudioContext` at 48kHz sample rate
- Dual decode: `decodeAudioData()` → fallback to `MediaElementAudioSourceNode`
- Audio mixing: averages channel data across buffers
- **Our approach**: Remotion handles audio internally via `<Audio>` component + `numberOfSharedAudioTags`

#### FFmpeg.wasm for muxing
**File**: `browser-render/src/audio/audio-video-muxer.ts`
- Uses `@twick/ffmpeg-web` for combining video + audio
- H.264 re-encode: `-c:v libx264 -preset veryfast -crf 20 -c:a aac -b:a 192k -movflags +faststart`
- **Our approach**: Remotion's `@remotion/renderer` handles this server-side

### Viona action items

| Pattern | Twick | Viona Status | Priority |
|---------|-------|-------------|----------|
| Service Worker media cache | Yes (IndexedDB) | No — blob prefetch only | **Medium** — would persist across refreshes |
| Video metadata preload | Yes (`preload='metadata'`) | Yes (`@remotion/preload`) | Already done |
| Frame yielding | Every 10 frames | Not needed (Remotion handles) | Low |
| useRef for player state | Yes | Yes (in `usePlayerSync`) | Already done |
| Web Audio API | Direct usage | Remotion abstracts | N/A |
| FFmpeg.wasm client-side | Yes | Server-side Remotion render | Different architecture |

---

## 2. Timeline Architecture

### Architecture overview

Twick's timeline is **DOM-based** (not canvas): absolutely positioned `<div>` elements within flex tracks, using `@use-gesture/react` for drag interactions and Framer Motion for animations. State flows through a layered system: React Context → `TimelineEditor` class → `TimelineContextStore` singleton → Track/Element instances.

### Key patterns

#### Pixel-based time mapping
```typescript
const pixelsPerSecond = 100 * zoom;
// left = element.start * pixelsPerSecond
// width = (element.end - element.start) * pixelsPerSecond
```

#### Changelog-based memoization (interesting pattern)
Instead of deep-comparing timeline objects, uses a simple version counter:
```typescript
const timelineData = useMemo(() => editor.getTimelineData(), [changeLog]);
```
Any mutation increments `changeLog`, which triggers re-renders via `useMemo` deps.

#### Snap utility (pure function)
```typescript
function snapTime(time: number, targets: number[], thresholdSec: number = 0.1): SnapResult {
  let nearestTarget: number | undefined;
  let minDist = thresholdSec;
  for (const target of targets) {
    const dist = Math.abs(time - target);
    if (dist < minDist) { minDist = dist; nearestTarget = target; }
  }
  return { time: nearestTarget ?? time, didSnap: nearestTarget !== undefined };
}
```

#### Undo/redo via JSON snapshots
- `past: ProjectJSON[]` (max 20), `present`, `future`
- Deep clone via `structuredClone()` on each edit
- Optional LocalStorage persistence

#### Element splitting — visitor pattern
- Video/audio: adjusts `startAt` based on playback rate at split point
- Text/caption: splits word array proportionally
- Shapes/images: simple time-based split, properties cloned

#### No virtualization
All tracks and elements render to DOM — no windowing. Works for 10-50 tracks but would degrade at 1000+ elements.

### Viona comparison

| Feature | Twick | Viona | Notes |
|---------|-------|-------|-------|
| Rendering | DOM + CSS absolute positioning | Canvas-based (`CanvasRenderer`) | **Ours is better** — canvas avoids DOM overhead |
| Drag library | `@use-gesture/react` | Custom `DragManager.ts` | Both work; ours is more integrated with canvas |
| Snapping | Pure function, 10px threshold | `SnapEngine.ts` | Similar approach |
| Undo/redo | JSON snapshots (max 20) | Zustand store | Could adopt snapshot limit |
| Splitting | Visitor pattern per element type | `SplitTool.ts` | Similar |
| Virtualization | None | Canvas (inherently virtualized) | **Ours is better** |
| Version tracking | `changeLog` counter | Zustand subscription | Changelog pattern is simpler |
| Zoom | `pixelsPerSecond = 100 * zoom` | Similar | Same concept |

**Verdict**: Our canvas-based timeline is architecturally superior for performance. The `changeLog` counter pattern for memoization is a nice simplification worth noting.

---

## 3. Effects & Media Utils

### Architecture overview

**Effects**: 27 WebGL fragment shaders (GPU-accelerated) applied per-clip as post-processing. Categories: color filters (sepia, HDR, hue shift), distortions (pixelate, warp, wave), glitch effects (RGB shift, halftone, scanlines), particles (sparkles, sparks, butterflies), and lighting (lightning, laser).

**Media Utils**: Client-side utilities for video metadata, thumbnails, frame extraction, audio processing, and dimension calculations. Uses Web Audio API + lamejs for MP3 encoding.

### Key patterns

#### LRU frame cache with video element reuse
```typescript
class VideoFrameExtractor {
  private frameCache: LRUCache<string, string>;  // Default 50 entries
  private videoElements: Map<string, VideoElementState>;  // Max 5 elements, reused per URL
  // Cache key: `${videoUrl}:${Math.round(seekTime * 100) / 100}` (100ms granularity)
}
```

#### Client-side audio stitching via OfflineAudioContext
```typescript
// Stitch multiple audio segments with individual volume control
function stitchAudio(segments: AudioSegment[], totalDuration?): Promise<string> {
  // 1. Create OfflineAudioContext(2ch, totalFrames, 44100Hz)
  // 2. For each segment: decode → gain node (if volume !== 1) → source.start(segment.s)
  // 3. Render → encode to MP3 via lamejs (22050Hz, 48kbps)
  // 4. Return blob URL
}
```

#### Concurrency limiter for media loading
```typescript
function limit(fn: () => Promise<T>): Promise<T>
// Max 5 concurrent tasks, queues the rest
// Used for image dimension loading
```

#### WebGL effect pipeline
1. Upload frame as texture (`texImage2D` with Y-flip)
2. Chain fragment shaders via `applyEffects()` with uniforms: `uTexture`, `uTime`, `uIntensity`, `uResolution`
3. Readback via FBO + `readPixels()` to `Uint8Array`
4. Windows workaround: copy canvas before `VideoFrame` creation

### Viona comparison

| Feature | Twick | Viona | Notes |
|---------|-------|-------|-------|
| Video effects | 27 WebGL fragment shaders | Remotion transitions | Different paradigm — theirs is GPU, ours is React-based |
| Transitions | None built-in (per-clip only) | Remotion TransitionSeries | **Ours is more capable** |
| Thumbnails | `VideoFrameExtractor` + LRU cache | `ThumbnailCache.ts` | Similar approach |
| Waveforms | Not found | `WaveformCache.ts` | We have this, they don't |
| Audio processing | Web Audio API + lamejs MP3 | Remotion `<Audio>` component | Different architecture |
| Concurrency control | Max 5 concurrent loads | Not explicit | **Actionable** — we should limit concurrent media loads |
| Frame cache | LRU with 100ms granularity | Per-thumbnail | Similar |

**Verdict**: Their WebGL effects pipeline is impressive but irrelevant to us (Remotion handles effects differently). The concurrency limiter for media loading is a good pattern to adopt.

---

## 4. Video Editor & Workflow

### Architecture overview

The video editor uses a **three-panel + timeline layout**: left panel (configurable), center (player + canvas overlay), right panel, and bottom timeline. State management is **Context-based** (not Redux/Zustand): `useTimelineContext()` as single source of truth, with a `TimelineEditor` class handling operations. The workflow package provides functional builders for constructing timeline projects programmatically (captions, templates).

### Key patterns

#### Canvas overlay on pause (interesting UX)
When paused, a Fabric.js canvas overlay replaces the video player (opacity transition). Users manipulate objects directly on canvas. When playing, canvas fades out and video resumes.
```typescript
// PlayerManager: canvas opacity 0 when playing, 1 when paused
// Updated on: seek, pause, element change, changeLog update
```

#### Batch canvas updates
```typescript
setCanvasElements({
  elements, watermark, seekTime, captionProps,
  cleanAndAdd: true,  // Clear and rebuild (vs incremental)
  lockAspectRatio: canvasConfig?.lockAspectRatio,
})
```
Promise-based batch to prevent multiple redraws.

#### Workflow builders (for AI integration)
```typescript
buildCaptionProject(input): WorkflowProjectJSON  // Full project from captions
applyCaptionsToProject(project, input): ProjectJSON  // Add captions to existing
buildProjectFromTemplateSpec(spec): WorkflowProjectJSON  // From template
applyProjectPatch(project, patch): ProjectJSON  // Generic patch system
```

#### Asset library abstraction
```typescript
interface AssetLibrary {
  listAssets(params): Promise<Paginated<MediaItem>>;
  uploadAsset(file, options?): Promise<MediaItem>;
  deleteAsset(id): Promise<void>;
}
// Browser implementation uses IndexedDB for local storage
```

### Viona comparison

| Feature | Twick | Viona | Notes |
|---------|-------|-------|-------|
| State management | React Context + TimelineEditor class | Zustand store | Both work; Zustand is simpler |
| Canvas overlay on pause | Fabric.js overlay | N/A (Remotion handles) | Different architecture |
| Workflow builders | Programmatic project construction | Agent pipeline builds manifest | Similar concept |
| Asset library | IndexedDB + abstract interface | MinIO/S3 + API | Server-side is better for collaboration |
| Drag-to-canvas | Drop media onto canvas with position | N/A | We don't have canvas manipulation |
| Z-order context menu | Right-click → bring forward/back | N/A | Could be useful if we add canvas editing |

**Verdict**: Their workflow builder pattern for programmatic project construction is well-designed and mirrors what our agent pipeline does with manifests. Nothing directly actionable.

---

## 5. AI & MCP Agent

### Architecture overview

Twick has two AI packages: **`agents/mcp-agent`** (an MCP server for Claude Desktop that transcribes video → timed captions using Google Vertex AI/Gemini) and **`ai-models`** (a provider-agnostic abstraction layer with registry, orchestrator, and job lifecycle management supporting 16+ generation types across 6 providers).

### Key patterns

#### Provider registry + orchestrator
```typescript
class ProviderRegistry {
  registerAdapter(adapter: ProviderAdapter)
  getAdapter(provider: AIModelProvider)  // "fal" | "runware" | "openai" | "gemini" | "bedrock" | "local"
}

class Orchestrator {
  createJob() → dispatch() → waitForCompletion()
  // Multi-provider fallback: try primary, then fallback providers
  // Polling: 1500ms interval, 120s timeout
}
```

#### Timeline patch system (AI output → editor)
```typescript
type TimelinePatch =
  | TimelineCaptionPatch   // { type: "caption", captions: TimedTextSegment[] }
  | TimelineVoicePatch     // { type: "voice", mediaUrl, captions }
  | TimelineAvatarPatch    // { type: "avatar", mediaUrl, thumbnailUrl }
  | TimelineMediaPatch     // { type: "media", mediaUrl }
  // ... 12 more patch types

function toTimelinePatch(job: GenerationJob): TimelinePatch
// Converts completed AI job output → structured timeline patch
```

#### 16 generation types
`caption | translation | voice | avatar | image | video | imageToVideo | scriptToTimeline | videoEnhancement | assetSelection | pdfToVideo | overlayGeneration | personalization | autoEdit | brollSuggestion | sceneAssembly`

### Viona comparison

| Feature | Twick | Viona | Notes |
|---------|-------|-------|-------|
| AI integration | MCP server for Claude Desktop | Claude Agent SDK in-editor | **Ours is more integrated** (conversational sidebar) |
| Provider abstraction | Registry + adapter pattern | Direct Claude SDK | Theirs supports more providers |
| Timeline patches | Typed patch system | Manifest-based pipeline | Similar concept, different implementation |
| Caption generation | Gemini via Vertex AI | Whisper (worker) | Different providers |
| Generation types | 16 types | Director/Animator/Assistant Director | Different scope |

**Verdict**: Their provider registry pattern is well-architected but we don't need it (we're Claude-only). The timeline patch type system is interesting — our manifest serves the same purpose.

---

## 6. Cloud Functions & Visualizer

### Architecture overview

6 AWS Lambda functions: **export-video** (Puppeteer + headless Chrome rendering → S3), **transcript** (Google Cloud Speech-to-Text v2, short/long audio paths), **subtitle-video** (transcribe → build Twick project JSON), **generate-media** (FAL.ai for images/videos), **file-uploader** (pre-signed S3 URLs for browser-direct upload), **yt-downloader** (yt-dlp → S3). **FFmpeg-web** wraps `@ffmpeg/ffmpeg` WASM for client-side muxing.

### Key patterns

#### Pre-signed URL uploads (browser-direct)
```typescript
// Lambda generates presigned PutObject URL (1hr expiry)
// Client uploads directly to S3 — server never handles file binary
const url = await getSignedUrl(s3Client, new PutObjectCommand({...}), { expiresIn: 3600 });
// Return: { uploadUrl, bucket, key, contentType, instructions: { method: "PUT" } }
```

#### Short vs long audio transcription path
- **< 6 seconds**: `client.recognize()` with base64 audio content (inline)
- **> 6 seconds**: Upload to GCS first, then `client.batchRecognize()` with GCS URI

#### Caption phrase grouping
Groups words into display phrases based on: min/max word count, duration thresholds, pause breaks (silence), punctuation breaks. Returns `{ t, s, e, w }` format.

#### YouTube download with bot detection handling
- Uses `yt-dlp` with Android client user-agent to avoid bot detection
- FFmpeg merge for separate video/audio streams
- Detailed error handling with hints for bot detection

### Viona comparison

| Feature | Twick | Viona | Notes |
|---------|-------|-------|-------|
| Video export | Puppeteer + headless Chrome | Remotion `@remotion/renderer` | Different approach, both valid |
| Transcription | Google Cloud Speech-to-Text v2 | Whisper (local) | Ours is local/free |
| File upload | Pre-signed S3 URLs (browser-direct) | Server-proxied upload | **Actionable** — pre-signed URLs reduce server load |
| Media generation | FAL.ai | Claude visual generation | Different approach |
| YouTube import | yt-dlp Lambda | Not implemented | Could be useful feature |
| FFmpeg client-side | WASM wrapper with CDN fallback | Server-side only | Different architecture |

**Verdict**: Pre-signed URL uploads for media files is a solid pattern that could reduce our API server load. YouTube import via yt-dlp is a nice feature we don't have.

---

## 7. Canvas Rendering Engine

### Architecture overview

Twick's canvas package is a **Fabric.js 6.6.2-based 2D compositor** for interactive editing. Videos are rendered as **frozen thumbnail frames at seek time** (not live decode), manipulated as Fabric.js objects. The architecture uses a **controller-handler registry pattern** where element types register handlers for rendering and state sync. Coordinates map bidirectionally between video space (e.g., 1920x1080) and display space (e.g., 800x600).

### Key patterns

#### Controller-handler registry
```typescript
elementController.register(VideoElement);   // dispatch by element.type
elementController.register(ImageElement);
elementController.register(TextElement);
// Each handler has: add(params) + updateFromFabricObject()
```

#### Manual render control (performance)
```typescript
const canvas = new FabricCanvas(canvasRef, {
  renderOnAddRemove: false,  // No auto-render on add
  stateful: false,           // No auto-state tracking
});
// Batch adds → single canvas.requestRenderAll()
```

#### Coordinate transformation
```typescript
// Video → Canvas: scale + center offset
convertToCanvasPosition(x, y, canvasMetadata): { x: x * scaleX + width/2, y: y * scaleY + height/2 }
// Canvas → Video: inverse
convertToVideoPosition(x, y, canvasMetadata, videoSize): { x: x / scaleX - width/2, y: y / scaleY - height/2 }
```

#### Shift-axis lock (professional editor pattern)
Holding Shift during drag constrains to dominant axis (mirrors Figma/Photoshop behavior).

### Viona comparison

| Feature | Twick | Viona | Notes |
|---------|-------|-------|-------|
| Canvas library | Fabric.js | N/A (Remotion compositions) | Different paradigm |
| Video on canvas | Frozen thumbnails at seek time | Live `<Video>` playback | Different architecture |
| Interactive editing | Click-drag-rotate on canvas | Prompt-based generation | We're AI-driven, not WYSIWYG |
| Element registry | Handler per type | React component per type | Similar pattern |
| Coordinate system | Video space ↔ display space transforms | Remotion handles internally | N/A |

**Verdict**: Their Fabric.js-based canvas is a full WYSIWYG editor — fundamentally different from our AI-generated Remotion compositions. No patterns to adopt, but the coordinate transform system is well-designed if we ever add direct manipulation.

---

## 8. Render Server

### Architecture overview

Dual-stack rendering: **server-side** (Express + Puppeteer headless Chrome + FFmpeg in Docker) and **browser-side** (WebCodecs API + mp4-wasm fallback + FFmpeg.wasm for muxing). In-memory concurrency control (default: 2 concurrent renders). The browser renderer applies GL effects per-frame, mixes audio via Web Audio API, then muxes with FFmpeg.wasm.

### Key patterns

#### Simple concurrency limiter
```typescript
let activeRenders = 0;
const renderQueue: Array<() => void> = [];
const MAX_CONCURRENT = parseInt(process.env.TWICK_MAX_CONCURRENT_RENDERS ?? "2");

async function withRenderSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (activeRenders >= MAX_CONCURRENT) {
    await new Promise<void>(resolve => renderQueue.push(resolve));
  }
  activeRenders++;
  try { return await fn(); }
  finally { activeRenders--; renderQueue.shift()?.(); }
}
```

#### Multi-phase progress reporting
- **0-90%**: Video frame encoding (`frame / totalFrames * 0.9`)
- **90-97%**: Audio generation
- **97-100%**: Muxing + finalization

#### Abort signal support
```typescript
const throwIfAborted = () => {
  if (abortSignal?.aborted) throw new DOMException("Rendering aborted", "AbortError");
};
// Checked every frame in render loop
```

#### WebCodecs bitrate auto-scaling
```typescript
const bitrate = Math.max(500_000, (w * h * fps * 0.1) | 0);
// Scales with resolution — 720p ≈ 2.5Mbps, 1080p ≈ 6.2Mbps
```

#### Windows canvas copy workaround
Canvas → separate canvas → VideoFrame (avoids invalid encoder output on Windows).

### Viona comparison

| Feature | Twick | Viona | Notes |
|---------|-------|-------|-------|
| Server rendering | Puppeteer + Chrome + FFmpeg | Remotion `@remotion/renderer` | Both headless browser-based |
| Browser rendering | WebCodecs API + mp4-wasm | N/A (server-only) | Could add for client export |
| Concurrency | In-memory queue (max 2) | BullMQ workers | **Ours is better** — persistent queue |
| Progress reporting | Multi-phase (0-90-97-100) | Not implemented | **Actionable** — could add to our render pipeline |
| Abort support | AbortSignal per frame | Not implemented | **Actionable** — for long renders |
| Rate limiting | IP-based in-memory | Stytch auth + API limits | Different approach |

**Verdict**: Their multi-phase progress reporting and abort signal patterns are solid and could improve our render UX. The concurrency limiter is simpler than our BullMQ but less robust.

---

## 9. Studio & Examples

### Architecture overview

The studio is a React-based editor shell that integrates all twick packages into a cohesive UI. Examples demonstrate the SDK in both Vite (examples) and Create React App (examples-cra) environments. The studio showcases panel layout, theming, and plugin points.

### Key patterns

- **Panel-based layout**: Left (media library), center (player + canvas), right (properties), bottom (timeline)
- **Theme system**: CSS custom properties for dark/light mode
- **Plugin architecture**: Editor accepts custom panel components via props
- **Asset provider system**: Pluggable media providers (Pexels, Unsplash, Pixabay, custom)

### Viona comparison

| Feature | Twick | Viona | Notes |
|---------|-------|-------|-------|
| Layout | Panel-based (configurable) | Resizable panels + AI sidebar | Similar approach |
| Theming | CSS custom properties | Tailwind + CSS vars | Similar |
| Media providers | Pluggable (Pexels, Unsplash, etc.) | Upload only | Could add stock media providers |
| Examples | Vite + CRA examples | N/A | SDK pattern (we're not an SDK) |

**Verdict**: Standard editor patterns. Nothing novel to adopt. Their pluggable asset provider system is nice but irrelevant to our architecture.

---

## 10. Visualizer (FFmpeg-web)

### Architecture overview

The **visualizer** is a scene-based composition engine built on `@twick/2d` and `@twick/core` using generator functions for precise timing control. It processes multi-track projects (video, audio, caption, effects) with parallel track execution. It does **not** implement waveform/spectrogram visualization — it's a playback/rendering engine. **FFmpeg-web** wraps `@ffmpeg/ffmpeg` WASM with CDN fallback for client-side audio-video muxing.

### Key patterns

#### Generator-based timing
```typescript
*create({ containerRef, element, view }) {
  yield* waitFor(element.s);  // Wait for start time
  // ... create and mount element
  yield* waitFor(element.e - element.s);  // Wait for duration
  yield elementRef().remove();  // Cleanup
}
```

#### Parallel track execution
```typescript
const movie = tracks.map(track => makeTrack({ view, track }));
yield* all(...movie);  // Run all tracks concurrently
```

#### 16 color filters
Saturated, bright, vibrant, retro, B&W, sepia, cool, warm, cinematic, soft glow, moody, dreamy, inverted, vintage, dramatic, faded — applied via direct filter method calls on element refs.

### Viona comparison

| Feature | Twick | Viona | Notes |
|---------|-------|-------|-------|
| Composition engine | Generator-based (@twick/core) | Remotion (React components) | Different paradigm |
| Timing | `yield* waitFor(seconds)` | `useCurrentFrame()` + `<Sequence>` | Both frame-accurate |
| Color filters | 16 CSS-style filters | Remotion CSS filters | Similar capability |
| Track execution | Parallel generators | React tree rendering | Both handle multi-track |

**Verdict**: Interesting generator-based approach but architecturally incompatible with Remotion. No patterns to adopt.

---

## Overall Synthesis & Actionable Items

### High-priority patterns to adopt

| # | Pattern | Source | Impact | Effort |
|---|---------|--------|--------|--------|
| 1 | **Pre-signed URL uploads** | Cloud functions | Reduces API server load for media uploads — browser uploads directly to S3 | Medium |
| 2 | **Multi-phase render progress** | Render server | Better UX during long renders (0-90% video, 90-97% audio, 97-100% muxing) | Low |
| 3 | **Render abort signal** | Render server | Users can cancel long renders; checked per-frame | Low |
| 4 | **Concurrency limiter for media loads** | Media utils | Prevent browser from opening 20+ concurrent media connections | Low |

### Medium-priority patterns to note

| # | Pattern | Source | Notes |
|---|---------|--------|-------|
| 5 | Service Worker media cache | Browser render | Would persist blob cache across page refreshes |
| 6 | LRU cache with seek-time rounding | Media utils | Better cache hit rate for timeline scrubbing (round to 100ms) |
| 7 | Changelog counter for memoization | Timeline | Simpler than deep-comparing timeline state objects |
| 8 | Pre-signed URL + yt-dlp YouTube import | Cloud functions | Potential feature: import YouTube videos |

### Patterns we already do better

| Pattern | Twick | Viona |
|---------|-------|-------|
| Timeline rendering | DOM-based (performance degrades at scale) | Canvas-based (inherently virtualized) |
| Job queue | In-memory (loses state on restart) | BullMQ (persistent, distributed) |
| Video preloading | `preload='metadata'` only | 3-layer (prefetch/blob + preload/decoder + premount) |
| AI integration | MCP for Claude Desktop only | In-editor conversational agent with SDK |
| Media playback | Frozen thumbnails on canvas | Live `<Video>` in Remotion Player |
| Transitions | None built-in | Remotion TransitionSeries |
| Waveforms | Not implemented | WaveformCache in timeline |

