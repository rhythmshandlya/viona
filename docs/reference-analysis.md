# Reference Codebase Analysis: free-react-video-editor

> Findings from `.reference/free-react-video-editor/` — patterns and optimizations we can adopt.

---

## Progress

- [x] Timeline & drag-drop interactions
- [x] State management & memoization patterns
- [x] Composition rendering & React optimization
- [x] UI/UX patterns (controls, thumbnails, waveforms)
- [x] File structure & component architecture

---

## 1. State Management & Memoization

### What they do

- **No external state library** — pure `useState` colocated in main component
- **Composition wrapped in `useCallback([clips, textOverlays])`** — prevents Remotion Player from re-reconciling the entire composition tree on unrelated re-renders
- **`React.memo` on TimelineMarker** — high-frequency component (updates every frame)
- **Frame polling at 30fps** — `setInterval(1000/30)` with `getCurrentFrame()`, not event-driven
- **`inputProps={{}}`** — NOT memoized, but works because `Composition` itself is memoized

### Viona audit

| Pattern | Reference | Viona | Action |
|---------|-----------|-------|--------|
| Composition has stable identity | `useCallback` | CJS eval → `useState` setter | **OK** — `compositionCache` gives stable ref per cache key |
| `inputProps` memoized | No | Yes (`useMemo`) | Keep |
| Frame sync throttled | 30fps `setInterval` | `requestAnimationFrame` + `frameupdate` event | **Better** — ours is event-driven, not polling |
| Playhead memoized | `React.memo` | Canvas-based | **Better** — canvas doesn't trigger React re-renders |
| Timeline items memoized | No | Canvas-based | **Better** — no DOM elements to re-render |

**Verdict**: Our architecture is more performant than the reference for state management. No changes needed.

---

## 2. Composition Rendering & React Optimization

### What they do

- **Flat Sequence layout** — all items in a single flat list, sorted by start time, each wrapped in `<Sequence>`
- **Type discrimination via `"src" in item`** — not a switch/case, just property check
- **No AbsoluteFill, Series, or TransitionSeries** at composition level
- **No premounting, no prefetching, no buffering config** — bare minimum
- **Video elements have minimal props** — just `<Video src={item.src} />`, no `style`, `objectFit`, `volume`, `playbackRate`
- **TextOverlayComponent NOT memoized** — re-renders every frame due to `useCurrentFrame()`
- **Row field defined in data but never used in composition rendering** — multi-track is UI-only, not in playback

### Viona comparison

| Pattern | Reference | Viona | Notes |
|---------|-----------|-------|-------|
| Composition structure | Flat Sequences | Tracks → Sequences per track → Items | Ours is richer (proper multi-track) |
| Video props | Just `src` | `src`, `startFrom`, `pauseWhenBuffering`, `volume`, `playbackRate`, `style` | Ours is more complete |
| Transitions | None | Supports via Remotion transitions | More capable |
| Premounting | None | 18-frame cap | Better for smooth cuts |
| Prefetching | None | 3-layer (prefetch + preload + premount) | Much better |

**Verdict**: Reference is a minimal demo. Our composition rendering is production-grade. No patterns to copy here.

---

## 3. Timeline & Drag-Drop Interactions

### What they do

- **Percentage-based positioning**: `left: ${(item.start / totalDuration) * 100}%`
- **Fixed row height**: 44px per track row
- **NO drag-and-drop** — no libraries, no mouse handlers
- **NO trimming or splitting**
- **NO zoom/scale**
- **NO snapping or alignment**
- **Playhead**: CSS-positioned red line with border-trick triangle, `pointer-events-none`
- **Seeking**: Relies on Remotion Player built-in controls only

### Viona comparison

| Feature | Reference | Viona |
|---------|-----------|-------|
| Drag-drop | None | `DragManager.ts` with custom handlers |
| Trimming | None | Yes |
| Splitting | None | `SplitTool.ts` |
| Zoom/scale | None | Yes |
| Snapping | None | `SnapEngine.ts` |
| Timeline rendering | DOM-based | Canvas-based (`CanvasRenderer.ts`) |
| Track headers | None | `TrackHeaders.tsx` |
| Thumbnails | None | `ThumbnailCache.ts` |
| Waveforms | None | `WaveformCache.ts` |
| Hit testing | None | `HitTester.ts` |
| Auto-scroll | None | `AutoScroll.ts` |
| Context menu | None | `ContextMenu.tsx` |
| Clipboard | None | `ClipboardManager.ts` |

**Verdict**: Our timeline is vastly more capable. The reference is a static demo with no interactions.

---

## 4. UI/UX Patterns

### What they do

- **No thumbnails** — timeline clips are solid color boxes
- **No waveforms** — audio type defined but unused
- **Playback controls**: Remotion Player built-in `controls` prop only
- **Fixed player size**: 700×400px container, 1920×1080 composition
- **No resizable panels** — static vertical layout
- **No media import** — hardcoded Supabase video URL
- **No keyboard shortcuts**
- **No timeline ruler** — just the playhead marker
- **Tailwind CSS** — utility-first, no CSS modules
- **Mobile detection**: Shows warning on screens ≤768px

### Patterns worth noting

1. **`renderLoading` callback** — simple `<div>Loading...</div>`, but the pattern of providing a loading state to Player is important
2. **Composition aspect ratio scaling** — 1920×1080 composition in 700×400 container auto-scales via Remotion Player
3. **Button hover transitions** — `transition-colors duration-200` on Tailwind classes

**Verdict**: Nothing to adopt. Our UI is already far more complete.

---

## 5. File Structure & Architecture

### What they have

```
free-react-video-editor/
├── app/              # Next.js 14 App Router
│   ├── layout.tsx    # Root layout (Inter font, globals)
│   ├── page.tsx      # Home — mounts Banner + Editor
│   └── globals.css   # @tailwind directives only
├── components/
│   ├── banner.tsx    # Promo banner
│   └── react-video-editor.tsx  # THE ENTIRE EDITOR (~500 lines)
├── types/
│   └── types.ts      # Clip, TextOverlay, Sound, Effect, PexelsMedia
├── tailwind.config.ts
├── tsconfig.json     # Strict, @/* alias
└── next.config.mjs   # Empty (all defaults)
```

- **Single-component monolith** — `ReactVideoEditor` contains everything: state, Player, Composition, Timeline, Controls
- **Deps**: `remotion@4.0.208`, `@remotion/player@4.0.208`, `next@14.2.7`, `react@18.3.1`, `lucide-react`, Tailwind
- **No state library, no testing, no CI, no persistence**
- **Unused types**: `Sound`, `Effect`, `PexelsMedia` defined but never used

### Viona comparison

Our editor is split across ~30+ focused files in `features/editor-v2/` with dedicated subsystems for timeline (canvas), player, store, hooks, panels, and components. The reference's single-file approach would not scale.

---

## Overall Assessment

The reference repo is a **minimal educational demo** (~500 lines in a single component). It demonstrates:
- Basic Remotion Player integration
- Simple `useCallback` composition memoization
- Percentage-based timeline layout

**It does NOT demonstrate any advanced optimization.** Our codebase is significantly more sophisticated in every area:
- 3-layer video preloading (prefetch + preload + premount)
- Canvas-based timeline rendering
- Event-driven frame sync
- Full NLE interactions (drag, trim, split, snap, clipboard)

### Actionable items from this analysis

The only patterns from the reference that confirm our approach:

1. **`useCallback` for Composition** — our CJS-eval approach is different but achieves the same goal (stable component identity via cache)
2. **`inputProps` memoization** — we already do this with `useMemo`, correctly
3. **Flat Sequence rendering** — the reference sorts items by start time. Our template renders by track order, which is correct for multi-track

### Things the reference does NOT do that we should keep doing

- Blob-based prefetch (critical for performance)
- `@remotion/preload` decoder warming
- `premountFor` for smooth cuts
- `pauseWhenBuffering` on media elements
- `numberOfSharedAudioTags` pre-allocation
- `bufferStateDelayInMilliseconds` for UX
