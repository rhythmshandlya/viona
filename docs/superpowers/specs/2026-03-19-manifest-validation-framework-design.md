# Manifest Validation Framework

**Date**: 2026-03-19
**Status**: Design
**Problem**: Sandbox manifest tools accept unvalidated data for complex fields (keyframes, transforms, filters), producing manifests that pass within the sandbox but fail Zod validation on the DB sync round-trip (`dbToManifest` -> `manifestV2Schema.parse()`).

---

## Root Cause

The manifest has two worlds:

1. **Sandbox** — `manifest-ops.ts` tools write raw JSON to `manifest.json`. Complex fields (`keyframes`, `transform`, `filters`) accept `any` with zero structural validation.
2. **DB sync** — `manifest-convert.ts` runs `manifestV2Schema.parse()` which enforces strict Zod types.

There is no validation bridge between them. The agent can write any shape of data, it works fine in the sandbox (raw JSON), and then explodes on the DB path.

---

## Scope

### In scope
- All 10 agent-facing manifest tools in `packages/sandbox/src/tools/manifest-ops.ts`
- The `update_manifest` HTTP-only tool (not agent-facing but used by PATCH /manifest)
- Rulebook prompt document for all 6 pipeline agents
- Sanitization + validation layer in the sandbox write path
- Error messages that help the LLM self-correct

### Out of scope
- `packages/shared/src/manifest-ops.ts` (client-side ops — separate system, separate fix)
- Frontend validation (already has its own layer)
- Changing the Zod schema itself (schema is correct, writes are wrong)

---

## Design

### Layer 1: Rulebook (Prompt-level prevention)

A new shared prompt module `docs/shared/manifest-rules.md` loaded by all agents that touch the manifest. Concise, example-heavy, LLM-optimized.

**Content structure:**

```markdown
# Manifest Field Rules

## Items
- `type`: one of: video, audio, text, image, scene, caption, shape
- `trackId`: must reference an existing track ID
- `startMs`: integer >= 0
- `endMs`: integer > startMs
- `data`: type-specific (see below)

## Transform (optional)
All fields have defaults. If you set transform, provide an object:
{ x: 0, y: 0, width: "100%", height: "100%", rotation: 0, opacity: 1 }
- x, y: number or string percentage ("50%")
- width, height: number or string percentage
- rotation: number (degrees)
- opacity: number 0-1

## Keyframes
Each keyframe MUST have all three fields:
{ timeMs: 500, props: { opacity: 0 }, easing: "ease-out" }
- timeMs: number >= 0 (relative to item start)
- props: object with transform properties to animate (REQUIRED, use {} if empty)
- easing: "linear" | "ease-in" | "ease-out" | "ease-in-out" | "spring" | cubic-bezier(...)

WRONG: { timeMs: 500, easing: "ease-out" }           // missing props
WRONG: { timeMs: 500, opacity: 0 }                   // props not nested
RIGHT: { timeMs: 500, props: { opacity: 0 }, easing: "ease-out" }

## Filters (optional)
{ brightness: 1, contrast: 1, saturation: 1, blur: 0, hue: 0, grayscale: 0, sepia: 0 }
- brightness, contrast, saturation: 0-2
- blur: >= 0
- hue: any number
- grayscale, sepia: 0-1

## Track types
One of: video, audio, overlay, caption

## Type-specific data

### video
{ src: string, startFrom: number>=0, volume: 0-2, playbackRate: 0.25-4 }

### audio
{ src: string, volume: 0-2, playbackRate: 0.25-4 }

### scene
{ sceneFile: "scenes/SceneN.tsx" }

### text
{ text: string, fontFamily: string, fontSize: number>=1, fontWeight: 100-900,
  color: "#hex", textAlign: "left"|"center"|"right" }

### image
{ src: string }

### caption
{ words: [{ text: string, startMs: number, endMs: number }] }

### shape
{ shape: "rectangle"|"circle"|"line", fill: "#hex" }
```

This module gets prepended to every agent that calls manifest tools (layout-editor, final-editor, trim-editor, and the orchestrator itself).

### Layer 2: Sanitization functions

New file: `packages/sandbox/src/tools/manifest-sanitize.ts`

Lightweight coercion layer that fixes trivially-wrong data before validation. Runs before the Zod gate. Does NOT silently swallow real errors — only fills obvious defaults.

```typescript
// Known keyframe meta-fields (everything else is a flat transform prop)
const KF_META = new Set(['timeMs', 'props', 'easing']);

// Sanitize a single keyframe: ensure props exists, rescue flat transform props
function sanitizeKeyframe(kf: any): any {
  if (!kf || typeof kf !== 'object') return null; // unfixable

  // If props is already set, just ensure defaults
  if (kf.props && typeof kf.props === 'object') {
    return { timeMs: kf.timeMs, props: kf.props, easing: kf.easing ?? 'linear' };
  }

  // Rescue flat transform properties into props (the #1 agent bug pattern)
  // e.g. { timeMs: 0, opacity: 0 } → { timeMs: 0, props: { opacity: 0 }, easing: "linear" }
  const props: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(kf)) {
    if (!KF_META.has(k) && v !== undefined) props[k] = v;
  }
  return { timeMs: kf.timeMs, props, easing: kf.easing ?? 'linear' };
}

// Sanitize keyframes array
function sanitizeKeyframes(keyframes: any): any[] {
  if (!Array.isArray(keyframes)) return [];
  return keyframes.map(sanitizeKeyframe).filter(Boolean);
}

// Sanitize transform: fill defaults for missing fields, strip undefined values
function sanitizeTransform(t: any): any {
  if (!t || typeof t !== 'object') return undefined;
  const result: Record<string, unknown> = {
    x: 0, y: 0, width: '100%', height: '100%', rotation: 0, opacity: 1,
  };
  // Override defaults with actual values (skip undefined to prevent re-introducing gaps)
  for (const [k, v] of Object.entries(t)) {
    if (v !== undefined) result[k] = v;
  }
  return result;
}

// Sanitize filters: clamp ranges
function sanitizeFilters(f: any): any {
  if (!f || typeof f !== 'object') return undefined;
  const clamped: any = {};
  if (f.brightness != null) clamped.brightness = clamp(f.brightness, 0, 2);
  if (f.contrast != null) clamped.contrast = clamp(f.contrast, 0, 2);
  if (f.saturation != null) clamped.saturation = clamp(f.saturation, 0, 2);
  if (f.blur != null) clamped.blur = Math.max(0, f.blur);
  if (f.hue != null) clamped.hue = f.hue;
  if (f.grayscale != null) clamped.grayscale = clamp(f.grayscale, 0, 1);
  if (f.sepia != null) clamped.sepia = clamp(f.sepia, 0, 1);
  return Object.keys(clamped).length > 0 ? clamped : undefined;
}

// Full item sanitization pass
function sanitizeItem(item: any): any {
  return {
    ...item,
    keyframes: sanitizeKeyframes(item.keyframes),
    transform: item.transform ? sanitizeTransform(item.transform) : undefined,
    filters: item.filters ? sanitizeFilters(item.filters) : undefined,
  };
}
```

### Layer 3: Validation gate in manifest-ops.ts

After sanitization, validate the full item against `manifestItemV2Schema` before writing. On failure, return a structured error message the LLM can act on.

**Changes to `add_item` execute():**

```typescript
async execute(input) {
  return withManifestLock(async () => {
    // 1. Validate data against type-specific schema (existing)
    const schema = itemDataSchemas[input.type];
    if (schema) {
      const result = schema.safeParse(input.data);
      if (!result.success) { return formatZodError(...); }
      input.data = result.data;
    }

    // 2. Build the item
    const manifest = await readManifest();
    const raw = { id: input.id ?? randomUUID(), ... };

    // 3. Sanitize + validate (NEW)
    const sanitized = sanitizeItem(raw);
    const validation = manifestItemV2Schema.safeParse(sanitized);
    if (!validation.success) {
      return formatItemError(validation.error, sanitized);
    }

    // 4. Referential integrity check (NEW)
    const tracks = manifest.tracks ?? [];
    if (!tracks.some(t => t.id === sanitized.trackId)) {
      return `Track "${sanitized.trackId}" not found. Available: ${tracks.map(t => t.id).join(', ')}`;
    }

    // 5. Range check (NEW)
    if (sanitized.startMs >= sanitized.endMs) {
      return `startMs (${sanitized.startMs}) must be less than endMs (${sanitized.endMs})`;
    }

    // 6. Write validated item
    manifest.items.push(validation.data);
    await writeManifest(manifest);
    return JSON.stringify(validation.data);
  });
}
```

**Changes to `update_item` execute():**

```typescript
async execute(input) {
  return withManifestLock(async () => {
    const manifest = await readManifest();
    const items: any[] = manifest.items ?? [];
    const idx = items.findIndex((i: any) => i.id === input.itemId);
    if (idx === -1) return `Item not found: ${input.itemId}`;

    // Snapshot for rollback — deep clone before mutation
    const snapshot = JSON.parse(JSON.stringify(items[idx]));
    const item = items[idx];

    // Apply updates (existing merge logic)
    if (input.startMs !== undefined) item.startMs = input.startMs;
    if (input.endMs !== undefined) item.endMs = input.endMs;
    if (input.trackId !== undefined) item.trackId = input.trackId;
    if (input.data) item.data = { ...item.data, ...input.data };
    if (input.transform) item.transform = { ...(item.transform ?? {}), ...input.transform };
    if (input.filters) item.filters = { ...(item.filters ?? {}), ...input.filters };
    if (input.style) item.style = { ...(item.style ?? {}), ...input.style };
    if (input.keyframes !== undefined) item.keyframes = input.keyframes;

    // NEW: Sanitize + validate the MERGED item
    const sanitized = sanitizeItem(item);
    const validation = manifestItemV2Schema.safeParse(sanitized);
    if (!validation.success) {
      // ROLLBACK: restore snapshot
      items[idx] = snapshot;
      return formatItemError(validation.error, sanitized);
    }

    // Range check
    if (sanitized.startMs >= sanitized.endMs) {
      items[idx] = snapshot;
      return `startMs (${sanitized.startMs}) must be less than endMs (${sanitized.endMs})`;
    }

    // Write validated item back
    items[idx] = validation.data;
    await writeManifest(manifest);
    return JSON.stringify(items[idx]);
  });
}
```

**Changes to `add_track` execute():**

```typescript
// Validate type enum
const validTypes = ['video', 'audio', 'overlay', 'caption'];
if (!validTypes.includes(input.type)) {
  return `Invalid track type "${input.type}". Must be one of: ${validTypes.join(', ')}`;
}
```

**Changes to `split_item` execute():**

```typescript
// After creating the new item, sanitize keyframes
newItem.keyframes = sanitizeKeyframes(newItem.keyframes);
```

### Layer 4: Error message formatting

The LLM needs actionable errors, not raw Zod output. New helper:

```typescript
function formatItemError(zodError: z.ZodError, item: any): string {
  const issues = zodError.issues.map(issue => {
    const path = issue.path.join('.');
    const got = getNestedValue(item, issue.path);
    return `  - ${path}: expected ${issue.message}, got ${JSON.stringify(got)}`;
  });

  return [
    `Invalid item (type: ${item.type}, id: ${item.id}):`,
    ...issues,
    '',
    'Fix the invalid fields and retry.',
  ].join('\n');
}
```

Example output the agent sees:
```
Invalid item (type: scene, id: abc123):
  - keyframes.0.props: expected object, got undefined
  - keyframes.1.props: expected object, got undefined

Fix the invalid fields and retry.
```

### Layer 5: `style` field handling

The `style` field is written by manifest-ops but is NOT in `manifestV2Schema`. It is also **not preserved during DB round-trips** — `manifestToDb` does not store it as `data._style`, and `dbToManifest` does not reconstruct it. This is a silent data-loss bug today.

**Fix (required)**:

1. Add `style` to the item schema:
```typescript
// In manifest-v2.ts, add to itemBaseV2:
style: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
```

2. Preserve in DB round-trip (`manifest-convert.ts`):
```typescript
// In manifestToDb — after filters preservation:
if ((item as any).style) {
  data._style = (item as any).style;
}

// In dbToManifest — in each item type branch that reads _transform/_keyframes:
const storedStyle = (data as any)._style as Record<string, unknown> | undefined;
// ...and include in return: ...(storedStyle ? { style: storedStyle } : {})
```

---

## Files Changed

| File | Change |
|------|--------|
| `packages/sandbox/src/tools/manifest-sanitize.ts` | NEW — sanitization functions + formatItemError helper |
| `packages/sandbox/src/tools/manifest-ops.ts` | Add validation gates to add_item, update_item, add_track, split_item, update_caption_style |
| `packages/shared/src/manifest-v2.ts` | Add optional `style` field to item base schema |
| `packages/shared/src/manifest-convert.ts` | Add `_style` preservation in manifestToDb + reconstruction in dbToManifest |
| `packages/sandbox/src/prompts/shared/manifest-rules.md` | NEW — agent rulebook |
| `packages/sandbox/src/prompts/prompt-loader.ts` | Load manifest-rules.md into agents that use manifest tools |
| `packages/sandbox/template/.claude/CLAUDE.md` | Add brief manifest rules reference |

---

## What this catches

| Error class | Caught by |
|---|---|
| Missing `keyframe.props` | Sanitization (auto-fix: rescue flat props into `props`) + Validation gate |
| Flat keyframe transform props (`{ timeMs, opacity }`) | Sanitization (auto-rescue into `props`) |
| Duplicate item ID | Referential integrity check in add_item |
| Wrong transform field types | Validation gate |
| Invalid track/item type enum | Validation gate (enum check) |
| Nonexistent trackId | Referential integrity check |
| startMs >= endMs | Range check |
| Extra unknown fields | Zod `.strip()` in schema parse |
| Filter values out of range | Sanitization (clamp) + Validation gate |
| Deep-merge producing invalid state | Post-merge validation on update_item |
| Invalid caption word structure | Existing data validation (already works) |
| Invalid keyframe easing string | Validation gate |
| Non-schema `style` field | Schema addition (Option A) |

---

## Layer 6: Semantic warnings

Non-blocking warnings appended to the tool's success response. The write goes through, but the agent gets a nudge about likely-wrong side effects. Returned as a `⚠ Warnings:` block after the JSON result.

Example tool response:
```
{"id": "abc", "type": "scene", ...}

⚠ Warnings:
- Audio item "audio-xyz" covers same source range (8000-22000ms). Split/adjust it too.
- Scene file "scenes/SceneNonExistent.tsx" not found on disk.
```

New file: `packages/sandbox/src/tools/manifest-warnings.ts`

Exports a single function: `collectWarnings(manifest, item, operation)` that returns `string[]`.

### Warning catalog

#### Video-audio coupling (on split_item, update_item time changes, remove_item)

| # | Condition | Warning |
|---|---|---|
| W1 | Video item split/moved/trimmed but paired audio item at same source range not touched | `Audio item "{id}" covers same source range ({startMs}-{endMs}). Split/adjust it too.` |
| W2 | Audio item split/moved/trimmed but paired video item not touched | `Video item "{id}" covers same source range ({startMs}-{endMs}). Split/adjust it too.` |
| W3 | Video or audio playbackRate changed, partner has different rate | `Audio item "{id}" has playbackRate {x} but video has {y}. They should match.` |
| W4 | Video item being removed (not opacity-hidden) | `Removing this video item removes speaker audio for {startMs}-{endMs}. Use opacity:0 keyframes to hide speaker visually while keeping audio.` |
| W5 | After operation, video track has a gap with no item | `Gap on video track: {startMs}-{endMs} has no video item. Speaker audio will be silent.` |

Detection: Find items on video/audio tracks with overlapping time ranges and matching `data.src` or `data.startFrom` offsets.

#### Scene file references (on add_item, update_item with sceneFile)

| # | Condition | Warning |
|---|---|---|
| W6 | Scene item's `data.sceneFile` points to nonexistent .tsx file | `Scene file "{sceneFile}" not found in /workspace/src/scenes/. Render will fail.` |
| W7 | Scene/shape mockup item missing `data.displayMode` | `Scene item "{id}" has no displayMode. Downstream agents need this to determine layout.` |
| W8 | .tsx file exists in scenes/ but no manifest item references it | `Scene file "{file}" exists but has no manifest item. Orphan file.` |

Detection: `existsSync()` check for scene files, scan manifest items for sceneFile references.

#### Item-track type matching (on add_item, update_item with trackId)

| # | Condition | Warning |
|---|---|---|
| W9 | Item type doesn't match track type (scene on audio, video on caption, etc.) | `Item type "{itemType}" placed on track type "{trackType}". Expected: {expectedTrackTypes}.` |

Detection: Map of valid item→track pairings: `video→video`, `audio→audio`, `scene→overlay`, `text→overlay`, `image→overlay`, `shape→overlay`, `caption→caption`.

#### Timing & overlap (on add_item, update_item, split_item)

| # | Condition | Warning |
|---|---|---|
| W10 | Item endMs exceeds manifest.durationMs | `Item extends past timeline end ({endMs}ms > durationMs {durationMs}ms).` |
| W11 | New/moved item overlaps another on same track | `Overlaps with item "{id}" on same track ({startMs}-{endMs}).` |
| W12 | add_item called with ID that already exists | `Item "{id}" already exists. Use update_item to modify it.` |
| W13 | Image/video `data.src` references file not found in workspace | `Source file "{src}" not found in workspace.` |

#### Keyframe integrity (on add_item, update_item with keyframes)

| # | Condition | Warning |
|---|---|---|
| W14 | Keyframe timeMs exceeds item duration | `Keyframe at {timeMs}ms exceeds item duration ({duration}ms). It will never execute.` |
| W15 | Keyframe animates a property that's also in static transform | `Keyframe props and static transform both set "{prop}". Keyframe will override — remove from transform if intentional.` |
| W16 | Adjacent scenes with no transition keyframes between them | `Scenes "{a}" and "{b}" are adjacent with no opacity keyframes. This creates an abrupt cut.` |

#### Speaker visibility (on add_item scene type, update_item)

| # | Condition | Warning |
|---|---|---|
| W17 | Fullscreen scene added but video item in that range has no opacity:0 keyframe | `Fullscreen scene at {startMs}-{endMs} but speaker video item has no opacity:0 keyframe. Speaker will be visible behind the scene.` |
| W18 | Split-screen video transform missing required fields (x, y, width, height) | `Split-screen speaker transform incomplete — missing {fields}. Speaker may render at wrong size/position.` |

Detection for W17: Look at video items overlapping the scene's time range. Check their keyframes for any `props.opacity === 0` entry.

#### Overlay safe zones (on add_item, update_item with transform on overlay track)

| # | Condition | Warning |
|---|---|---|
| W19 | Overlay transform covers speaker face zone (top 40% or per speaker-grid.json) | `Overlay transform covers speaker face zone (y:{y} height:{h} enters top {threshold}%). Move overlay lower or reduce height.` |
| W20 | Overlay transform extends into caption area (bottom 15% of canvas) | `Overlay extends into caption area (y+height={bottom} > {captionThreshold}). Captions may be covered.` |

Detection: Read canvas dimensions from manifest, compute overlay bounds from transform, compare against safe zones. If `speaker-grid.json` exists, use face bounding box; else default to top 40%.

#### Caption sync (on split_item, remove_item, update_item time changes)

| # | Condition | Warning |
|---|---|---|
| W21 | Caption words extend beyond the item's new time range | `Caption item "{id}" has words extending to {wordEndMs}ms but item ends at {endMs}ms.` |
| W22 | Video segment has transcript words but no caption coverage | `No caption covers {startMs}-{endMs} where speaker is talking.` |

#### Track operations (on remove_track)

| # | Condition | Warning |
|---|---|---|
| W23 | Deleting track that has items on it | `Track "{name}" has {n} items. Removing it will delete all of them.` |
| W24 | Overlay track position not between video (bottom) and caption (top) | `Overlay track "{name}" at position {pos} is outside expected z-order (video < overlay < caption).` |

### Implementation

```typescript
// manifest-warnings.ts

import { existsSync } from 'fs';
import { join } from 'path';

const WORKSPACE = '/workspace';
const SCENES_DIR = join(WORKSPACE, 'src/scenes');

// Valid item type → track type mapping
const ITEM_TRACK_MAP: Record<string, string[]> = {
  video: ['video'],
  audio: ['audio'],
  scene: ['overlay'],
  text: ['overlay'],
  image: ['overlay'],
  shape: ['overlay'],
  caption: ['caption'],
};

export type WarningContext = {
  operation: 'add' | 'update' | 'remove' | 'split';
  item: any;
  manifest: any;
  previousItem?: any;  // snapshot before update (for detecting what changed)
};

export function collectWarnings(ctx: WarningContext): string[] {
  const warnings: string[] = [];
  const { operation, item, manifest } = ctx;
  const items: any[] = manifest.items ?? [];
  const tracks: any[] = manifest.tracks ?? [];
  const track = tracks.find((t: any) => t.id === item.trackId);

  // --- W9: Item-track type mismatch ---
  if (track && ITEM_TRACK_MAP[item.type]) {
    if (!ITEM_TRACK_MAP[item.type].includes(track.type)) {
      warnings.push(
        `Item type "${item.type}" placed on track type "${track.type}". ` +
        `Expected track type: ${ITEM_TRACK_MAP[item.type].join(' or ')}.`
      );
    }
  }

  // --- W6: Scene file not found ---
  if (item.type === 'scene' && item.data?.sceneFile) {
    const sceneFile = item.data.sceneFile.replace(/^scenes\//, '');
    const scenePath = join(SCENES_DIR, sceneFile);
    if (!existsSync(scenePath)) {
      warnings.push(`Scene file "${item.data.sceneFile}" not found. Render will fail.`);
    }
  }

  // --- W7: Scene mockup missing displayMode ---
  if ((item.type === 'scene' || item.type === 'shape') && item.data?.sceneFile && !item.data?.displayMode) {
    warnings.push(`Scene item "${item.id}" has no displayMode. Downstream agents need this.`);
  }

  // --- W10: Item exceeds durationMs ---
  if (manifest.durationMs && item.endMs > manifest.durationMs + 100) {
    warnings.push(
      `Item extends past timeline end (${item.endMs}ms > durationMs ${manifest.durationMs}ms).`
    );
  }

  // --- W11: Overlap on same track ---
  for (const other of items) {
    if (other.id === item.id || other.trackId !== item.trackId) continue;
    if (item.startMs < other.endMs && item.endMs > other.startMs) {
      warnings.push(
        `Overlaps with item "${other.id}" on same track (${other.startMs}-${other.endMs}ms).`
      );
      break; // one overlap warning is enough
    }
  }

  // --- W12: Duplicate ID ---
  if (operation === 'add') {
    if (items.some((i: any) => i.id === item.id)) {
      warnings.push(`Item "${item.id}" already exists. Use update_item to modify it.`);
    }
  }

  // --- W14: Keyframe beyond item duration ---
  const duration = item.endMs - item.startMs;
  for (const kf of item.keyframes ?? []) {
    if (kf.timeMs > duration) {
      warnings.push(`Keyframe at ${kf.timeMs}ms exceeds item duration (${duration}ms). It will never execute.`);
      break;
    }
  }

  // --- W1/W2: Video-audio coupling ---
  if (operation !== 'add' && (item.type === 'video' || item.type === 'audio')) {
    const partnerType = item.type === 'video' ? 'audio' : 'video';
    const partners = items.filter((i: any) =>
      i.type === partnerType &&
      i.startMs < item.endMs && i.endMs > item.startMs
    );
    for (const p of partners) {
      // Check if partner timing still matches after this operation
      if (ctx.previousItem) {
        const timeChanged = ctx.previousItem.startMs !== item.startMs ||
                           ctx.previousItem.endMs !== item.endMs;
        if (timeChanged && (p.startMs !== item.startMs || p.endMs !== item.endMs)) {
          warnings.push(
            `${partnerType.charAt(0).toUpperCase() + partnerType.slice(1)} item "${p.id}" ` +
            `covers same source range (${p.startMs}-${p.endMs}ms). Split/adjust it too.`
          );
        }
      }
    }
  }

  // --- W4: Removing video item removes speaker audio ---
  if (operation === 'remove' && item.type === 'video') {
    warnings.push(
      `Removing video item removes speaker audio for ${item.startMs}-${item.endMs}ms. ` +
      `Use opacity:0 keyframes to hide speaker visually while keeping audio.`
    );
  }

  // --- W17: Fullscreen scene without speaker opacity ---
  if (item.type === 'scene' && item.data?.displayMode === 'fullscreen') {
    const videoItems = items.filter((i: any) =>
      i.type === 'video' && i.startMs < item.endMs && i.endMs > item.startMs
    );
    for (const vi of videoItems) {
      const hasOpacityZero = (vi.keyframes ?? []).some((kf: any) =>
        kf.props?.opacity === 0 && kf.timeMs >= (item.startMs - vi.startMs) &&
        kf.timeMs <= (item.endMs - vi.startMs)
      );
      if (!hasOpacityZero) {
        warnings.push(
          `Fullscreen scene at ${item.startMs}-${item.endMs}ms but speaker video has no ` +
          `opacity:0 keyframe. Speaker will be visible behind the scene.`
        );
        break;
      }
    }
  }

  // --- W19/W20: Overlay safe zone violations ---
  if (track?.type === 'overlay' && item.transform) {
    const canvasH = manifest.canvas?.height ?? 1920;
    const t = item.transform;
    const y = typeof t.y === 'number' ? t.y : 0;
    const h = typeof t.height === 'number' ? t.height : canvasH;
    const bottom = y + h;
    const faceThreshold = canvasH * 0.4;
    const captionThreshold = canvasH * 0.85;

    if (y < faceThreshold && h > 100) {
      warnings.push(
        `Overlay covers speaker face zone (y:${y} height:${h} enters top 40%). ` +
        `Move overlay lower or reduce height.`
      );
    }
    if (bottom > captionThreshold) {
      warnings.push(
        `Overlay extends into caption area (y+height=${bottom} > ${captionThreshold}). ` +
        `Captions may be covered.`
      );
    }
  }

  return warnings;
}

// Format warnings block to append to tool result
export function formatWarnings(warnings: string[]): string {
  if (warnings.length === 0) return '';
  return '\n\n⚠ Warnings:\n' + warnings.map(w => `- ${w}`).join('\n');
}
```

### Integration into manifest-ops.ts

Each tool calls `collectWarnings()` after a successful write and appends warnings to the return string:

```typescript
// In add_item, after writeManifest:
const warnings = collectWarnings({ operation: 'add', item: validation.data, manifest });
return JSON.stringify(validation.data) + formatWarnings(warnings);

// In update_item, after writeManifest:
const warnings = collectWarnings({ operation: 'update', item: items[idx], manifest, previousItem: snapshot });
return JSON.stringify(items[idx]) + formatWarnings(warnings);

// In remove_item, before splice:
const warnings = collectWarnings({ operation: 'remove', item: items[idx], manifest });
items.splice(idx, 1);
await writeManifest(manifest);
return JSON.stringify({ removed: input.itemId }) + formatWarnings(warnings);

// In split_item, after writeManifest:
const warnings = collectWarnings({ operation: 'split', item: newItem, manifest });
return JSON.stringify({ original: item.id, new: newItem.id }) + formatWarnings(warnings);
```

---

## What this does NOT catch

- Creative quality issues (handled by review phases)
- Scene plan divergence (plan is a doc, not machine-readable contract)
- Exact speaker-grid.json face bounding box (W19 uses 40% heuristic; future: parse actual grid)

---

## Migration / Rollout

Schema and prompt changes MUST land before validation gates (otherwise the gate strips valid `style` fields via Zod's default `strip` behavior).

1. Add `manifest-sanitize.ts` and the validation helpers (no behavior change yet)
2. Add `style` to schema + fix `manifest-convert.ts` round-trip (schema-only, no gates)
3. Add rulebook prompt module and wire into prompt-loader (gives agents guidance before gates)
4. Add validation gates to `add_item` and `add_track` (lowest risk, most common)
5. Add validation gate to `update_item` (with snapshot rollback)
6. Add validation to `split_item` and `update_caption_style`
7. Add duplicate item ID check to `add_item`

Each step is independently deployable. If validation causes false rejections in production, the sanitization layer can be made more permissive without removing the gate.
