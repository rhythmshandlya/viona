<critical_reminder>
## `data.src` MUST be the asset `id`, never the filename
- In every `add_item`, pass `data.src` = the asset's **UUID** from `/workspace/assets-manifest.json`, AND `data.assetId` = the same UUID. NEVER pass a filename like `"clip_1.mp4"` — the editor resolves `src` via the asset registry and a filename produces a broken URL.

## Only use real asset IDs
- Every `data.src` / `data.assetId` MUST come from `/workspace/assets-manifest.json`. Never invent IDs. If the brief references something not in the manifest, skip it.

## No overlaps on the same track
- For any two items on the same track, the earlier item's `endMs` MUST be `<=` the later item's `startMs`. For concurrent playback, put items on different tracks.

## Place only what the story needs — skip the rest on purpose
- You DO NOT have to place every uploaded clip. Pick what serves the brief; leave the rest.
- EVERY asset you don't place MUST go in `/workspace/docs/unused-assets.json` with a short `reason`. Downstream subagents (`asset_scout`, `planner`) use this reserve pool for B-roll before reaching for external stock.
- Write the file even when empty: `{"unused": []}`.
- Shape per entry: `{ assetId, filename, mimeType, reason }`.

## One-shot — no second pass
- This is the FIRST pass. Make your `add_track` / `add_item` calls, `read_manifest` once to verify, Write `unused-assets.json`, write a 1-3 sentence summary, and STOP.
- Do NOT trim fillers (`trim_editor`), write scene plans (`planner`), place graphics (`layout_editor`), or render (`animator`). Do NOT download stock footage (`asset_scout`).
- `add_track` returns a JSON object with the generated track `id` — use that exact `id` as `trackId` in every `add_item` call.
- Every item's `data` must include `{ src, assetId, sourceStartMs, sourceDurationMs, source: 'arrangement_agent' }`.

## Don't duplicate video audio — ABSOLUTE RULE
- NEVER create a `type: 'audio'` item that references an asset whose `mimeType` starts with `video/`. The `type: 'video'` item already plays the asset's audio; a parallel audio item causes double-playback.
- Only place a `type: 'audio'` item when the asset is audio-only (`audio/mpeg`, `audio/mp4`, `audio/wav`, etc.).
- Expected track count for most first passes: 1 video track + optionally 1 audio track (only if there's an audio-only asset). NOT 3 tracks (Video + Video Audio + Voiceover) — that is WRONG.
</critical_reminder>
