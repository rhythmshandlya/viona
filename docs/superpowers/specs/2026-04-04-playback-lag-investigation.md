# Playback Lag Investigation

**Date:** 2026-04-04
**Status:** Root cause identified, fix pending

## Symptoms

- Video playback is laggy/stuttery in the editor
- Pausing and seeking feel sluggish
- The lag persists even after all performance overhaul changes (MinIO direct, proxy files, Zustand transient updates, WebGL compositor)

## Investigation Method

Used Chrome DevTools MCP to instrument a live editor session with the full composition loaded (7 scenes, V1-V5 tracks, matte items, captions, audio).

## Key Finding: `crossOrigin="anonymous"` + Media Fragments = Stuck Seeks

### Evidence

Video elements in the Remotion Player during playback:

| Index | File | crossOrigin | Fragment | readyState | seeking | buffered | Status |
|-------|------|-------------|----------|------------|---------|----------|--------|
| 0 | scene-1-fgr-proxy.mp4 | anonymous | #t=35.2,41.27 | 4 | false | 0-65.80 | OK |
| 1 | scene-1-proxy.mp4 | anonymous | #t=35.2,41.27 | **1** | **true** | 0-65.80 | **STUCK** |
| 2 | scene-1-fgr-proxy.mp4 | anonymous | #t=41.27,53.8 | **1** | **true** | 0-41.93 | **STUCK** |
| 3 | scene-1-proxy.mp4 | anonymous | #t=41.27,53.8 | **1** | **true** | 0-65.80 | **STUCK** |
| 4 | source-proxy.mp4 | null | none | 4 | false | 0-42.03 | OK |
| 5 | scene-1-fgr-proxy.mp4 | null | none | 4 | false | 0-46.30 | OK |
| 6 | scene-1-proxy.mp4 | null | none | 4 | false | 0-65.80 | OK |

**Video 1** is the smoking gun: it has the **entire file buffered** (0-65.80s) yet is stuck with `readyState: 1` and `seeking: true`. All the data is there but the seek never resolves.

### Pattern

- Videos **with** `crossOrigin="anonymous"` + `#t=` media fragment = **stuck seeking** (readyState 1)
- Videos **without** `crossOrigin` = **work fine** (readyState 4)
- Videos **with** `crossOrigin="anonymous"` but **no** `#t=` fragment = work fine

The combination of `crossOrigin="anonymous"` + `#t=start,end` media fragment on cross-origin URLs causes Chrome to enter a stuck seek state. The browser has all the data but can't resolve the seek, likely due to a CORS revalidation issue on the range request triggered by the media fragment.

### Continuous Trace

Over 22 seconds of playback, every single sample showed:
```
scene-1-fgr-proxy.mp4[▶SB]@36.10  — Playing + Seeking + Buffering simultaneously
```
The fgr video oscillates between 35.20 and 36.10 but never advances. The `pauseWhenBuffering` prop causes a pause-resume-seek-buffer loop.

## Root Cause Chain

1. Remotion uses `#t=start,end` media fragments on `<Video>` elements to specify the playback range within a `<Sequence>`
2. We added `crossOrigin="anonymous"` to all `<Video>` elements for CORS canvas pixel access (needed for WebGL matte compositing with cross-origin MinIO URLs)
3. Chrome treats CORS video differently — each range request needs CORS validation
4. The `#t=` fragment triggers an immediate seek on load, which requires a range request
5. On cross-origin videos, this seek+range+CORS combination causes the seek to never resolve
6. `readyState` stays at 1 (HAVE_METADATA), the video appears buffered but can't play
7. Remotion's `pauseWhenBuffering` detects the buffering, pauses, then resumes, triggering another seek — infinite loop

## Why the JS Profiler Missed It

The `requestAnimationFrame` profiler showed 90fps because:
- rAF callbacks are cheap (just scheduling React renders)
- The actual video decode/seek happens on browser media threads
- The stuck seek doesn't block the main thread — it just means the video frame never updates
- The visual result is a frozen/stuttery video while the UI appears responsive

## Resource Count During Playback

- **5-7 video elements** simultaneously (premounting loads adjacent scenes)
- **6 audio elements** (Remotion shared audio tags)
- **4-5 canvases**
- **1099 DOM nodes**
- **62 transformed elements** (composite layers)

## Potential Fixes

### Option A: Remove `crossOrigin` from non-matte videos
Only MatteItem needs `crossOrigin="anonymous"` (for WebGL `texImage2D`). VideoItem and other video elements don't do canvas operations — they can work without CORS.

**Risk:** If we later add canvas-based effects to regular videos, they'll break.

### Option B: Remove `#t=` media fragments
Remotion adds `#t=start,end` to `<Video>` elements for the `startFrom` prop. We could patch the Remotion Player shim to strip fragments from cross-origin URLs and handle the offset via `currentTime` instead.

**Risk:** May break Remotion's internal frame sync.

### Option C: Serve via same-origin proxy for videos that need CORS
Keep cross-origin MinIO URLs for videos that DON'T need canvas access. For matte fgr/alpha videos (which need `crossOrigin` for WebGL), serve through the same-origin API proxy instead.

**Risk:** Matte videos go back through the proxy chain, but they're small (proxy files ~1-5MB).

### Option D: Use `crossOrigin="anonymous"` only on the specific video elements doing canvas work
MatteItem's fgr and matte `<Video>` elements need CORS. All other `<Video>` elements (VideoItem, SandwichComposite background) don't. Remove `crossOrigin` from non-matte elements.

**Risk:** Lowest risk. MatteItem videos may still have the seek issue with `#t=` fragments, but MatteItem uses `startFrom` which Remotion may handle differently.

### Recommended: Option D (safest, minimal change)

Remove `crossOrigin="anonymous"` from `VideoItem.tsx` and the background video in `SandwichComposite.tsx`. Keep it only on the hidden `<Video>` elements inside `MatteItem.tsx` that feed the WebGL shader.

## Additional Finding: Remotion Error in Scene Component

A runtime error in `MagazineCountryTour` scene component throws on every frame:
```
inputRange must be strictly monotonically increasing but got [10,30,62,60]
```
This error is caught by Remotion's error boundary but the throw+catch cycle per frame adds overhead. The agent attempted to fix it but the fix may not have persisted in the composition bundle.

## Files to Change

- `packages/sandbox/template/src/items/VideoItem.tsx` — remove `crossOrigin="anonymous"`
- `packages/sandbox/template/src/composition/SandwichComposite.tsx` — remove `crossOrigin="anonymous"` from the background/source video element (keep on matte video if applicable)
- `packages/sandbox/template/src/composition/VideoOverlay.tsx` — remove `crossOrigin="anonymous"`
