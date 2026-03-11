# Remotion-Only Render Pipeline — Design Spec

**Date:** 2026-03-11
**Status:** Approved
**Goal:** Eliminate all FFmpeg video/audio compositing from the export pipeline. Every render uses a single Remotion `renderMedia()` call that produces a complete video with video, audio, captions, layout, and AI-generated scenes.

---

## Motivation

The current render pipeline has 3 separate paths (audio-only, stacked, PiP) involving FFmpeg filter graphs, ASS subtitle generation, separate Remotion passes for captions, and audio muxing. This:

1. Produces ~3,200 LOC of complex FFmpeg filter logic
2. Makes preview ≠ export (different rendering engines)
3. Blocks agentic editing — AI can't modify one source of truth and have both preview + export update
4. Requires 2-3 encode passes per export (slow)

The target architecture (inspired by Cardboard/usecardboard.com) uses a single Remotion composition as the source of truth, consumed by both `<Player>` (browser preview) and `renderMedia()` (backend export) with identical `inputProps`.

---

## Architecture

### Single Render Path

```
processRenderJob()
  │
  ├─ 1. Fetch project data, subtitles, layout settings
  │
  ├─ 2. Copy assets to bundle public/
  │     ├─ Source video → public/source.mp4
  │     ├─ YouTube clips → public/clips/{sceneId}.mp4
  │     └─ Audio file (audio-only) → public/audio.mp4
  │
  ├─ 3. Rebuild bundle from sources (rebuildBundleFromCJS)
  │
  ├─ 4. Build inputProps (composition-props.json)
  │
  ├─ 5. renderMedia() → final.mp4
  │
  └─ 6. Upload to S3
```

No branching. Audio-only, stacked, PiP all use this same path. The difference is in the props:
- Audio-only: `sourceVideoFile: undefined`, `audioFile: 'audio.mp4'`
- Stacked: `layoutMode: 'stacked'`, `sourceVideoFile: 'source.mp4'`
- PiP: `layoutMode: 'pip'`, `pipSettings: {...}`

### FullComposition — The Universal Root

```tsx
<AbsoluteFill style={{ backgroundColor: '#000' }}>
  {/* Speaker video — unmuted, carries audio */}
  <SpeakerVideo />  // or hidden in fullscreen mode, or PiP bubble

  {/* AI-generated scenes */}
  <VisualsLayer>{children}</VisualsLayer>

  {/* PiP bubble (pip mode only) */}
  <PiPVideo />

  {/* Captions — inline, same React components as preview */}
  <SubtitleLayer />

  {/* Audio track for audio-only projects */}
  {audioFile && <Audio src={staticFile(audioFile)} />}
</AbsoluteFill>
```

### inputProps — Single Source of Truth

```typescript
interface FullCompositionProps {
  // Layout
  layoutMode: 'stacked' | 'pip';
  splitSettings: SplitSettings;
  pipSettings?: PiPSettings;
  layoutSegments: LayoutSegment[];

  // Speaker video
  sourceVideoFile?: string;          // undefined for audio-only
  videoCropSettings: VideoCropSettings;

  // Audio (audio-only projects)
  audioFile?: string;

  // Captions
  subtitles: SubtitleItemData[];
  defaultSubtitleStyle: SubtitleStyle;
}
```

Scenes are passed as `children` (React components), not serialized in props. This is because scenes contain animations, interpolations, and effects that are code, not data.

---

## Key Design Decisions

### 1. Speaker video is unmuted
The `<OffthreadVideo>` for the speaker carries audio naturally. No separate audio mux step. For audio-only projects, an `<Audio>` component plays the uploaded audio file.

### 2. Enhanced audio feature removed
No more noise reduction/normalization preprocessing. Simplifies the pipeline — audio comes directly from the source.

### 3. Fonts via @remotion/google-fonts
Replace HTML `<link>` injection with Remotion's native `loadFont()` API. Components call `loadFont()` dynamically with the configured font family. Handles downloading, caching, and subsetting automatically.

### 4. YouTube clips rendered in Remotion
Clips are downloaded to `public/clips/` and referenced via `staticFile()` in scene components as `<OffthreadVideo>`. No FFmpeg overlay.

### 5. Scenes as children, not props
AI-generated scenes are React components passed as `children` to FullComposition. This keeps the composition generic and enables future dynamic compilation (Babel JIT in browser for live preview).

---

## Component Changes

### FullComposition.tsx
- Add `audioFile` prop + `<Audio>` tag for audio-only projects
- Unmute `<SpeakerVideo>` (remove `muted` from `<OffthreadVideo>`)
- Already supports stacked + PiP + subtitles

### SpeakerVideo.tsx
- Remove `muted` prop from `<OffthreadVideo>`

### SubtitleLayer.tsx
- Add `loadFont()` call from `@remotion/google-fonts` using dynamic font family from `defaultStyle`

### PiPVideo.tsx
- No changes needed (already built)

### AnimatedSubtitle.tsx
- No changes needed (already built)

---

## Render Pipeline Changes (index.ts)

### Before: 3 branches (~400 LOC)
```
if (isAudioProject) {
  finalizeRemotionVideo() → renderVideo() for captions
} else if (useFullComposition) {
  muxAudioOnly()
} else {
  renderWithPiPLayout() → renderVideo() for captions
}
```

### After: 1 path (~50 LOC)
```
// Build inputProps
const compositionProps = { layoutMode, subtitles, defaultSubtitleStyle, ... };
writeFile('composition-props.json', JSON.stringify(compositionProps));

// Copy assets
copyFile(videoPath, join(bundlePublicDir, 'source.mp4'));
copyFile(clipPaths, join(bundlePublicDir, 'clips/'));

// Single render
renderWithRemotion({ bundlePath, compositionId, outputPath, inputProps: compositionProps });

// Upload
uploadFile(outputPath, ...);
```

---

## Deletions

| Target | Approx LOC | Reason |
|---|---|---|
| `packages/renderer/` (entire package) | ~800 | Second Remotion pass for captions |
| `renderWithPiPLayout()` | ~650 | FFmpeg PiP/stacked compositing |
| `finalizeRemotionVideo()` | ~100 | FFmpeg audio mux + ASS burn |
| `muxAudioOnly()` | ~40 | FFmpeg audio stream copy |
| `encodeVideoWithAudio()` | ~65 | FFmpeg re-encode with audio |
| `generateASSForComposite()` | ~870 | ASS subtitle generation |
| `generateASSSubtitles()` | ~100 | Legacy ASS generation |
| `buildVideoCropFilter()` | ~40 | FFmpeg crop filter (now CSS) |
| Font injection in `rebuildBundleFromCJS()` | ~30 | Replaced by `@remotion/google-fonts` |
| Enhanced audio logic | ~50 | Feature removed |
| 3-way render branch | ~400 | Single path |
| Dead types | ~80 | Unused interfaces |
| **Total** | **~3,200** | |

### What stays in ffmpeg.ts:
- `rebuildBundleFromCJS()` — bundle reconstruction (simplified)
- `ensureBundleExists()` — S3 download
- `renderWithRemotion()` — the `renderMedia()` call (simplified)
- `downloadVideoClipsForRender()` — yt-dlp for YouTube clips

### What stays in subtitles.ts:
- `convertToSubtitles()` — timeline items → SubtitleItemData[]
- Delete all ASS-specific functions

---

## Future: Agentic Editing (next phase, not this revamp)

This architecture enables:

```
                    ┌──────────────┐
                    │   Database   │
                    │  inputProps  │  ← single source of truth
                    └──┬───────┬──┘
                       │       │
              write    │       │ read
                       │       │
                 ┌─────▼──┐ ┌──▼──────────┐
                 │  AI     │ │  Frontend   │
                 │  Agent  │ │  <Player>   │
                 └─────────┘ └─────────────┘
                                    │
                              same component
                                    │
                             ┌──────▼──────┐
                             │ renderMedia()│
                             │   (export)   │
                             └─────────────┘
```

- AI edits `inputProps` → preview + export both update
- `<Player>` in frontend replaces custom preview
- Dynamic Babel compilation for live scene code updates
- WebSocket sync for real-time collaboration

This revamp is the prerequisite — it establishes the shared composition model.
