# Viona Architecture — Data Flow & Contracts

This document is the single source of truth for how data flows through Viona. Both human developers and AI agents should reference it before modifying any part of the pipeline.

---

## Core Invariant

**The manifest is the source of truth.** No code in the pipeline should override manifest values. Code may:
- **Remap** paths (e.g., `src` from API URLs to sandbox-local filenames)
- **Default** missing fields (e.g., `volume ?? 1`)
- **Add** items that don't exist yet (e.g., auto-create audio track)

Code must **never** force-set a value that the manifest already defines.

---

## 1. Data Flow: DB → Browser Playback

```
┌─────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│ Postgres │────>│ dbToManifest │────>│  Sandbox     │────>│ Browser      │
│ (items,  │     │ (manifest-   │     │  Init Code   │     │ Editor Store │
│  tracks) │     │  convert.ts) │     │  (routes.ts) │     │ (editor-     │
└─────────┘     └──────────────┘     └─────────────┘     │  store.ts)   │
                                           │              └──────┬───────┘
                                           │                     │
                                           v                     v
                                     ┌───────────┐     ┌──────────────┐
                                     │ Sandbox    │     │ Workspace    │
                                     │ manifest   │     │ Manifest     │
                                     │ .json      │     │ (inputProps) │
                                     └─────┬─────┘     └──────┬───────┘
                                           │                   │
                                           v                   v
                                     ┌───────────┐     ┌──────────────┐
                                     │ Codegen    │     │ Remotion     │
                                     │ Player     │     │ <Player>     │
                                     │ Comp.tsx   │     │ Component    │
                                     └───────────┘     └──────────────┘
```

### Step-by-step

1. **DB → Manifest** (`packages/shared/src/manifest-convert.ts: dbToManifest`)
   - Reads items/tracks from Postgres via Drizzle
   - Defaults: `volume ?? 1`, `playbackRate ?? 1`, `startFrom ?? 0`
   - Outputs a v2 manifest JSON object

2. **Manifest → Sandbox Init** (`packages/api/src/sandbox/routes.ts`)
   - Remaps `src` paths only: video items get `src: 'source.mp4'`, audio items get `src: 'audio.aac'`
   - **Must not touch** `volume`, `playbackRate`, `opacity`, `transform`, or any other manifest value
   - Auto-creates an audio track+item if none exists (for waveform display)

3. **Sandbox stores manifest** → `/workspace/manifest.json`
   - Read by the esbuild-bundled `PlayerComposition.tsx` at render time
   - Read by the browser via API proxy at `/api/projects/{id}/sandbox/manifest`

4. **Manifest → Editor Store** (`apps/web/src/features/editor-v2/store/manifest-bridge.ts: manifestToStore`)
   - Converts manifest items to store `TimelineItem` types
   - **Must preserve all fields** on round-trip (see §3 below)
   - Store items get additional browser-only fields: `thumbnailSrc`, `browserSrc`

5. **Store → Workspace Manifest** (`manifest-bridge.ts: storeToManifest`)
   - Converts back to manifest format for the `<Player>` component
   - This is the `workspaceManifest` in editor state, passed as `inputProps`

6. **Remotion Player renders** using the CJS bundle from `/api/projects/{id}/sandbox/bundle/`
   - `staticFile()` is shimmed to resolve to `/api/projects/{id}/sandbox/public/{path}`
   - `<Video>` and `<Audio>` components receive `volume`, `playbackRate`, etc. from manifest data

---

## 2. File Contexts — Same File, Different URLs

A single media file exists in three contexts with different URLs:

| Context | Video URL | Audio URL |
|---------|-----------|-----------|
| **DB / API** | `/api/projects/{id}/video` (presigned) | `/api/projects/{id}/audio` (presigned) |
| **Sandbox filesystem** | `/workspace/public/source.mp4` | `/workspace/public/audio.aac` |
| **Sandbox manifest `src`** | `source.mp4` | `audio.aac` |
| **Browser (proxy)** | `/api/projects/{id}/sandbox/public/source.mp4` | `/api/projects/{id}/sandbox/public/audio.aac` |
| **Remotion (via staticFile)** | `staticFile('source.mp4')` → proxy URL | `staticFile('audio.aac')` → proxy URL |
| **Editor store** | `src: 'source.mp4'`, `thumbnailSrc: '/media-proxy/...'` | `src: 'audio.aac'`, `browserSrc: '/api/projects/.../sandbox/public/audio.aac'` |

**Rule:** Manifest items always store sandbox-relative `src` values (`source.mp4`, `audio.aac`). Browser-accessible URLs are derived at load time in the editor store and should never be written back to the manifest.

---

## 3. Manifest Round-Trip Contract

When data flows `manifest → store → manifest`, **no fields may be lost**. This table defines what must survive:

### Video Items
| Manifest Field | Store Field | Required |
|---------------|-------------|----------|
| `src` | `src` | yes |
| `startFrom` | `startFrom` | yes |
| `volume` | `volume` | yes |
| `playbackRate` | `playbackRate` | yes |
| `crop` | `crop` | if present |
| `fadeInMs` | `fadeInMs` | if present |
| `fadeOutMs` | `fadeOutMs` | if present |

### Audio Items
| Manifest Field | Store Field | Required |
|---------------|-------------|----------|
| `src` | `src` | yes |
| `volume` | `volume` | yes |
| `playbackRate` | `playbackRate` | yes |
| `fadeInMs` | `fadeInMs` | if present |
| `fadeOutMs` | `fadeOutMs` | if present |

### Scene/Visual Items
| Manifest Field | Store Field | Required |
|---------------|-------------|----------|
| `sceneFile` | derived from `sourceSceneId` | yes |
| `transition` | `transition` | if present |
| `speakerBbox` | `speakerBbox` | if present |

### Common (all items)
| Manifest Field | Store Field | Required |
|---------------|-------------|----------|
| `id` | `id` | yes |
| `trackId` | `trackId` | yes |
| `startMs` | `startMs` | yes |
| `endMs` | `endMs` | yes |
| `transform` | `transform` | if present |
| `keyframes` | `keyframes` | if present |

**Store-only fields** (never written to manifest): `thumbnailSrc`, `browserSrc`, `enhancementStatus`, `enhancementProgress`, `sourceVideoItemId`, `isEnhanced`, `originalSrc`, `waveformData`.

---

## 4. Audio Pipeline

### How audio gets into the sandbox
1. `workspace-init.ts` downloads source video and extracts audio: `ffmpeg -i source.mp4 -vn -acodec copy -y audio.aac`
2. Both files land in `/workspace/public/`
3. Sandbox file-server serves them via Express static on port 8080

### How audio plays in the browser
- The `PlayerComposition.tsx` (generated by codegen) renders:
  - `<Video>` with `volume={d.volume ?? 1}` — plays video's embedded audio
  - `<Audio>` with `volume={d.volume ?? 1}` — plays the separated audio track
- Volume is controlled entirely by the manifest. If both video and audio items exist for the same content, one should have `volume: 0` to avoid echo.
- The manifest decides this, not the init code.

### How waveform displays on timeline
- `AudioRenderer` requests waveform data from `WaveformCache`
- Uses `browserSrc` (resolved proxy URL) for fetching, not the raw `src`
- Failed fetches are tracked to prevent infinite retry loops
- Waveform is purely visual — it doesn't affect audio playback

### Audio volume rules
- Manifest is the authority on volume values
- Default is `1` (full volume) for all item types
- Range is `0` to `2` (0 = muted, 1 = normal, 2 = boosted)
- `fadeInMs` / `fadeOutMs` are schema fields for gradual volume changes

---

## 5. Codegen Contract

`workspace-codegen.ts` generates `PlayerComposition.tsx` which reads `manifest.json` at runtime.

**What codegen must pass through from manifest data:**
- Video: `src`, `volume`, `playbackRate`, `startFrom`, `crop`
- Audio: `src`, `volume`, `playbackRate`
- All items: `transform` (x, y, width, height, rotation, opacity), `keyframes`

**What codegen must NOT hardcode:**
- Volume values (always read from `d.volume`)
- Dimensions (always read from manifest `canvas` or item `transform`)
- Timing (always derived from item `startMs`/`endMs` and `fps`)

---

## 6. SSE Streaming Contract

### Server → Client SSE events

| Event | Payload | Purpose |
|-------|---------|---------|
| `text` | `{ text: string }` | Assistant message chunk |
| `done` | `{ sessionId?, cost? }` | Stream complete |
| `widget` | `{ id, type, ... }` | Interactive UI widget |
| `progress` | `{ phase, percent?, message, agentName? }` | Job progress |
| `activity` | `{ agent, action, phase?, startedAt? }` | Agent activity indicator |
| `agent_plan` | `{ title, tasks[] }` | Agent task plan |
| `error` | `{ message, recoverable? }` | Error |
| `tool_use` | tool call data | Tool invocation |
| `tool_result` | tool result data | Tool response |
| `heartbeat` | `{ activity? }` | Keep-alive (15s interval) |

### SSE parsing rules
- Per the SSE spec, multiple `data:` lines in a single event must be concatenated with `\n`
- Empty line (`\n\n`) terminates an event
- Lines starting with `:` are comments (used as heartbeats)

### Client disconnect handling
- Server detects via `PassThrough` close/error events
- Aborts the upstream sandbox fetch via `AbortController`
- Decrements `activeStreams` counter
- If stream ends without `done` event, server injects synthetic error

---

## 7. WebSocket Contract

Single persistent connection per project for real-time updates.

| Message Type | Direction | Purpose |
|-------------|-----------|---------|
| `bundle:ready` | server→client | Esbuild rebuild complete, reload player |
| `manifest:updated` | server→client | Manifest changed by AI agent |
| `workspace:lock_acquired` | server→client | AI took edit lock |
| `workspace:lock_released` | server→client | AI released edit lock |
| `job:progress` | server→client | Background job progress |
| `job:complete` | server→client | Background job finished |
| `subscribe:job` | client→server | Subscribe to job updates |

### Reconnection
- Exponential backoff: 1s, 2s, 4s, ... up to 10s cap
- Max 10 attempts
- Job subscriptions are preserved and re-sent on reconnect
- Reconnect timer is properly cancelled on `disconnect()`

---

## 8. For AI Agents (Sandbox)

If you're an AI agent working inside the sandbox, these are your rules:

1. **Read the manifest before modifying it.** Use `read_manifest` MCP tool first.
2. **Never hardcode volume, dimensions, or timing.** These come from the manifest.
3. **Scene files use `export default`** — the scene registry auto-detects default exports.
4. **`useCurrentFrame()` is 0-relative inside `<Sequence>`** — never subtract scene start.
5. **`interpolate()` needs BOTH `extrapolateLeft: 'clamp'` AND `extrapolateRight: 'clamp'`** — always.
6. **Audio is not your domain** unless explicitly asked. The `<Video>` element handles its own audio. Separate `<Audio>` items exist for timeline display and independent volume control.
7. **`staticFile('source.mp4')` resolves correctly** inside the sandbox — don't construct URLs manually.
8. **When adding items**, include all required fields from the schema. Missing fields cause data loss on round-trip.

---

## 9. For Human Developers

1. **Editing `routes.ts` init code?** Only remap `src` paths. Don't touch other manifest values.
2. **Editing `manifest-bridge.ts`?** Check the round-trip contract (§3). Every manifest field must survive `manifestToStore → storeToManifest`.
3. **Editing `workspace-codegen.ts`?** Pass through all manifest data fields. Don't hardcode defaults that override manifest values.
4. **Adding a new item type?** Update: manifest schema (`manifest-v2.ts`), bridge (`manifest-bridge.ts` both directions), codegen (`workspace-codegen.ts`), store types (`types.ts`).
5. **Adding a new manifest field?** Update all four files above, plus ensure the DB migration includes it.
