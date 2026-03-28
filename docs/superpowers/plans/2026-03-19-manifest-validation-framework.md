# Manifest Validation Framework — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent invalid manifest data from reaching the DB by adding sanitization, validation gates, and semantic warnings to all manifest write tools in the sandbox.

**Architecture:** Six-layer defense: (1) prompt rulebook loaded by all agents, (2) sanitization functions that fix common mistakes, (3) Zod validation gates before every write, (4) LLM-friendly error formatting, (5) schema additions for `style` + `displayMode`, (6) semantic warnings for "valid but wrong" operations. Schema changes land first so Zod doesn't strip new fields.

**Tech Stack:** TypeScript, Zod, Node.js (runs inside sandbox Docker container)

**Spec:** `docs/superpowers/specs/2026-03-19-manifest-validation-framework-design.md`

---

## File Structure

| File | Responsibility |
|------|---------------|
| `packages/shared/src/manifest-v2.ts` | Add `style` to item base, `displayMode` to scene data schema |
| `packages/shared/src/manifest-convert.ts` | Preserve `_style` in `manifestToDb` + reconstruct in `dbToManifest` |
| `packages/api/src/sandbox/sync.ts` | Add `_style` to data blob in `syncManifestToDb` |
| `packages/sandbox/src/tools/manifest-sanitize.ts` | NEW — sanitize functions, inline full-item Zod schema, error formatting helpers |
| `packages/sandbox/src/tools/manifest-warnings.ts` | NEW — `collectWarnings()` + `formatWarnings()` |
| `packages/sandbox/src/tools/manifest-ops.ts` | Wire sanitization, validation gates, and warnings into all write tools |
| `packages/sandbox/src/prompts/shared/manifest-rules.xml` | NEW — agent-facing field rulebook |
| `packages/sandbox/src/prompts/prompt-loader.ts` | Add `manifest-rules.xml` to `SHARED_FILES` array |
| `packages/sandbox/template/.claude/CLAUDE.md` | Add brief manifest rules reference |
| `scripts/temp/test-manifest-sanitize.ts` | Test script for sanitization functions |
| `scripts/temp/test-manifest-warnings.ts` | Test script for warning functions |

---

### Task 1: Schema additions — `style` + `displayMode`

Schema changes MUST land before validation gates (otherwise Zod `.strip()` silently removes these fields).

**Files:**
- Modify: `packages/shared/src/manifest-v2.ts:108-116` (itemBaseV2) and `:88-90` (sceneItemDataV2Schema)

- [ ] **Step 1: Add `style` to `itemBaseV2`**

In `packages/shared/src/manifest-v2.ts`, add `style` to the `itemBaseV2` object (line 108-116):

```typescript
const itemBaseV2 = {
  id: z.string(),
  trackId: z.string(),
  startMs: z.number().min(0),
  endMs: z.number().min(0),
  transform: transformSchema.optional(),
  keyframes: z.array(keyframeSchema).default([]),
  filters: filtersSchema.optional(),
  style: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
};
```

- [ ] **Step 2: Add `displayMode` to `sceneItemDataV2Schema`**

In the same file, update `sceneItemDataV2Schema` (line 88-90):

```typescript
export const sceneItemDataV2Schema = z.object({
  sceneFile: z.string(),
  displayMode: z.enum(['fullscreen', 'split-screen', 'overlay']).optional(),
});
```

- [ ] **Step 3: Update inline scene schema in `manifest-ops.ts`**

The inline `itemDataSchemas` in `manifest-ops.ts` also needs `displayMode`. Without this, the per-type data validation at the top of `addItemTool.execute()` would strip `displayMode` from `input.data` before the full-item validation gate ever sees it.

In `packages/sandbox/src/tools/manifest-ops.ts`, find `itemDataSchemas.scene`:

```typescript
scene: z.object({ sceneFile: z.string(), displayMode: z.enum(['fullscreen', 'split-screen', 'overlay']).optional() }),
```

- [ ] **Step 4: Verify the shared package builds**

Run: `cd packages/shared && npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/manifest-v2.ts packages/sandbox/src/tools/manifest-ops.ts
git commit -m "feat(shared): add style and displayMode to manifest v2 schema"
```

---

### Task 2: DB round-trip — preserve `_style` + `displayMode`

**Files:**
- Modify: `packages/api/src/sandbox/sync.ts:69-74`
- Modify: `packages/shared/src/manifest-convert.ts:376-418` (manifestToDb) and `:88-335` (dbToManifest, multiple type branches)

- [ ] **Step 1: Add `_style` to `sync.ts` data blob**

In `packages/api/src/sandbox/sync.ts`, update the data object construction at line 69-74:

```typescript
const data = {
  ...item.data,
  ...(item.transform ? { _transform: item.transform } : {}),
  ...(item.keyframes?.length ? { _keyframes: item.keyframes } : {}),
  ...(item.filters ? { _filters: item.filters } : {}),
  ...(item.style ? { _style: item.style } : {}),
};
```

- [ ] **Step 2: Add `_style` preservation to `manifestToDb` in `manifest-convert.ts`**

In `packages/shared/src/manifest-convert.ts`, in the `manifestToDb` function, add after the filters preservation block (after line 388):

```typescript
if ((item as any).style) {
  data._style = (item as any).style;
}
```

- [ ] **Step 3: Add `_style` reconstruction to `dbToManifest` — video branch**

In the video branch (around line 115-131), after `storedFilters`:

```typescript
const storedStyle = (data as any)._style as Record<string, unknown> | undefined;
```

And add to the return object: `...(storedStyle ? { style: storedStyle } : {}),`

- [ ] **Step 4: Add `_style` reconstruction to `dbToManifest` — visual/scene branch**

In the visual branch (around line 161-181), same pattern:

```typescript
const storedStyle = (data as any)._style as Record<string, unknown> | undefined;
```

And add `...(storedStyle ? { style: storedStyle } : {})` to the return object.

- [ ] **Step 5: Add `_style` reconstruction to `dbToManifest` — text, image, shape, fallback branches**

Apply the same `_style` pattern to:
- Text branch (around line 249-284)
- Image branch (around line 288-317)
- Fallback branch (around line 320-334)

Each needs `const storedStyle = (data as any)._style as Record<string, unknown> | undefined;` and `...(storedStyle ? { style: storedStyle } : {})` in the return.

- [ ] **Step 6: Verify both packages build**

Run: `cd packages/shared && npx tsc --noEmit && cd ../api && npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 7: Commit**

```bash
git add packages/api/src/sandbox/sync.ts packages/shared/src/manifest-convert.ts
git commit -m "fix(shared): preserve style field in DB round-trip (sync.ts + manifest-convert.ts)"
```

---

### Task 3: Sanitization module

**Files:**
- Create: `packages/sandbox/src/tools/manifest-sanitize.ts`
- Create: `scripts/temp/test-manifest-sanitize.ts`

- [ ] **Step 1: Write the test file**

Create `scripts/temp/test-manifest-sanitize.ts`:

```typescript
// Test manifest sanitization functions
// Run: npx tsx scripts/temp/test-manifest-sanitize.ts

import { strict as assert } from 'assert';

// --- Inline copies of functions to test (until module is importable) ---
// We'll import from the actual module path once it exists.

async function run() {
  const {
    sanitizeKeyframe,
    sanitizeKeyframes,
    sanitizeTransform,
    sanitizeFilters,
    sanitizeItem,
    formatItemError,
    clamp,
    getNestedValue,
  } = await import('../../packages/sandbox/src/tools/manifest-sanitize.js');

  console.log('--- sanitizeKeyframe ---');

  // Flat props rescue: { timeMs: 0, opacity: 0 } → { timeMs: 0, props: { opacity: 0 }, easing: "linear" }
  const kf1 = sanitizeKeyframe({ timeMs: 0, opacity: 0 });
  assert.deepStrictEqual(kf1, { timeMs: 0, props: { opacity: 0 }, easing: 'linear' });
  console.log('PASS: flat props rescued into props object');

  // Already-correct keyframe passes through
  const kf2 = sanitizeKeyframe({ timeMs: 500, props: { opacity: 0.5 }, easing: 'ease-out' });
  assert.deepStrictEqual(kf2, { timeMs: 500, props: { opacity: 0.5 }, easing: 'ease-out' });
  console.log('PASS: correct keyframe preserved');

  // Missing easing defaults to linear
  const kf3 = sanitizeKeyframe({ timeMs: 100, props: {} });
  assert.strictEqual(kf3.easing, 'linear');
  console.log('PASS: missing easing defaults to linear');

  // Null/undefined returns null
  assert.strictEqual(sanitizeKeyframe(null), null);
  assert.strictEqual(sanitizeKeyframe(undefined), null);
  console.log('PASS: null/undefined → null');

  // Non-object returns null
  assert.strictEqual(sanitizeKeyframe('bad'), null);
  console.log('PASS: non-object → null');

  console.log('\n--- sanitizeKeyframes ---');

  // Non-array returns empty array
  assert.deepStrictEqual(sanitizeKeyframes('not array'), []);
  assert.deepStrictEqual(sanitizeKeyframes(undefined), []);
  console.log('PASS: non-array → []');

  // Filters out unfixable entries
  const kfs = sanitizeKeyframes([
    { timeMs: 0, opacity: 1 },
    null,
    { timeMs: 500, props: { opacity: 0 } },
  ]);
  assert.strictEqual(kfs.length, 2);
  assert.deepStrictEqual(kfs[0].props, { opacity: 1 });
  console.log('PASS: filters nulls, rescues flat props');

  console.log('\n--- sanitizeTransform ---');

  // Fills defaults
  const t1 = sanitizeTransform({ opacity: 0.5 });
  assert.strictEqual(t1.x, 0);
  assert.strictEqual(t1.y, 0);
  assert.strictEqual(t1.width, '100%');
  assert.strictEqual(t1.height, '100%');
  assert.strictEqual(t1.rotation, 0);
  assert.strictEqual(t1.opacity, 0.5);
  console.log('PASS: partial → full with defaults');

  // null/undefined returns undefined
  assert.strictEqual(sanitizeTransform(null), undefined);
  assert.strictEqual(sanitizeTransform(undefined), undefined);
  console.log('PASS: null → undefined');

  // Strips undefined values (doesn't re-introduce them)
  const t2 = sanitizeTransform({ x: 100, y: undefined });
  assert.strictEqual(t2.x, 100);
  assert.strictEqual(t2.y, 0); // default, not undefined
  console.log('PASS: undefined values use defaults');

  console.log('\n--- sanitizeFilters ---');

  // Clamps ranges
  const f1 = sanitizeFilters({ brightness: 5, contrast: -1, grayscale: 2 });
  assert.strictEqual(f1.brightness, 2);
  assert.strictEqual(f1.contrast, 0);
  assert.strictEqual(f1.grayscale, 1);
  console.log('PASS: clamps out-of-range values');

  // null returns undefined
  assert.strictEqual(sanitizeFilters(null), undefined);
  console.log('PASS: null → undefined');

  // Empty object returns undefined
  assert.strictEqual(sanitizeFilters({}), undefined);
  console.log('PASS: empty → undefined');

  console.log('\n--- clamp ---');
  assert.strictEqual(clamp(5, 0, 2), 2);
  assert.strictEqual(clamp(-1, 0, 2), 0);
  assert.strictEqual(clamp(1, 0, 2), 1);
  console.log('PASS: clamp works');

  console.log('\n--- getNestedValue ---');
  assert.strictEqual(getNestedValue({ a: { b: 42 } }, ['a', 'b']), 42);
  assert.strictEqual(getNestedValue({ a: [1, 2] }, ['a', 1]), 2);
  assert.strictEqual(getNestedValue(null, ['a']), undefined);
  console.log('PASS: getNestedValue works');

  console.log('\n--- sanitizeItem ---');
  const item = sanitizeItem({
    id: 'test',
    type: 'scene',
    trackId: 'track-1',
    startMs: 0,
    endMs: 5000,
    data: { sceneFile: 'scenes/S1.tsx' },
    keyframes: [{ timeMs: 0, opacity: 0 }],
    transform: { opacity: 0.5 },
  });
  assert.deepStrictEqual(item.keyframes[0].props, { opacity: 0 });
  assert.strictEqual(item.transform.x, 0); // defaults filled
  console.log('PASS: full item sanitization');

  console.log('\n✅ All sanitize tests passed');
}

run().catch(err => { console.error('FAIL:', err); process.exit(1); });
```

- [ ] **Step 2: Run the test — expect FAIL (module doesn't exist yet)**

Run: `npx tsx scripts/temp/test-manifest-sanitize.ts`
Expected: FAIL with `Cannot find module` error.

- [ ] **Step 3: Create `manifest-sanitize.ts`**

Create `packages/sandbox/src/tools/manifest-sanitize.ts`:

```typescript
import { z } from 'zod';

// ---- Helpers ----

export function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}

export function getNestedValue(obj: any, path: (string | number)[]): unknown {
  let current = obj;
  for (const key of path) {
    if (current == null) return undefined;
    current = current[key];
  }
  return current;
}

// ---- Inline schemas (mirrors @viona/shared/manifest-v2) ----
// Duplicated to avoid runtime dependency on @viona/shared inside Docker container.
// Keep in sync with packages/shared/src/manifest-v2.ts.

const transformSchema = z.object({
  x: z.union([z.number(), z.string()]).default(0),
  y: z.union([z.number(), z.string()]).default(0),
  width: z.union([z.number(), z.string()]).default('100%'),
  height: z.union([z.number(), z.string()]).default('100%'),
  rotation: z.number().default(0),
  opacity: z.number().min(0).max(1).default(1),
});

const keyframeSchema = z.object({
  timeMs: z.number().min(0),
  props: transformSchema.partial(),
  easing: z.union([
    z.enum(['linear', 'ease-in', 'ease-out', 'ease-in-out', 'spring']),
    z.string().regex(/^cubic-bezier\(\s*[\d.]+\s*,\s*[\d.-]+\s*,\s*[\d.]+\s*,\s*[\d.-]+\s*\)$/),
  ]).default('linear'),
});

const filtersSchema = z.object({
  brightness: z.number().min(0).max(2).default(1),
  contrast: z.number().min(0).max(2).default(1),
  saturation: z.number().min(0).max(2).default(1),
  blur: z.number().min(0).default(0),
  hue: z.number().default(0),
  grayscale: z.number().min(0).max(1).default(0),
  sepia: z.number().min(0).max(1).default(0),
}).partial();

const captionWordSchema = z.object({
  text: z.string(),
  startMs: z.number().min(0),
  endMs: z.number().min(0),
  classification: z.enum(['power', 'medium', 'filler']).optional(),
  styleOverrides: z.record(z.string(), z.unknown()).optional(),
});

const itemBaseV2 = {
  id: z.string(),
  trackId: z.string(),
  startMs: z.number().min(0),
  endMs: z.number().min(0),
  transform: transformSchema.optional(),
  keyframes: z.array(keyframeSchema).default([]),
  filters: filtersSchema.optional(),
  style: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
};

export const manifestItemV2Schema = z.discriminatedUnion('type', [
  z.object({ ...itemBaseV2, type: z.literal('video'), data: z.object({
    src: z.string(),
    startFrom: z.number().min(0).default(0),
    volume: z.number().min(0).max(2).default(1),
    playbackRate: z.number().min(0.25).max(4).default(1),
    fadeInMs: z.number().min(0).optional(),
    fadeOutMs: z.number().min(0).optional(),
    crop: z.object({
      x: z.number().min(0).max(100).default(50),
      y: z.number().min(0).max(100).default(50),
      scale: z.number().min(0.5).max(3).default(1),
    }).optional(),
  }) }),
  z.object({ ...itemBaseV2, type: z.literal('audio'), data: z.object({
    src: z.string(),
    volume: z.number().min(0).max(2).default(1),
    playbackRate: z.number().min(0.25).max(4).default(1),
    fadeInMs: z.number().min(0).optional(),
    fadeOutMs: z.number().min(0).optional(),
  }) }),
  z.object({ ...itemBaseV2, type: z.literal('text'), data: z.object({
    text: z.string(),
    fontFamily: z.string().default('Inter'),
    fontSize: z.number().min(1).default(48),
    fontWeight: z.number().min(100).max(900).default(600),
    color: z.string().default('#FFFFFF'),
    backgroundColor: z.string().optional(),
    borderRadius: z.number().optional(),
    padding: z.number().optional(),
    textAlign: z.enum(['left', 'center', 'right']).default('center'),
    lineHeight: z.number().optional(),
    letterSpacing: z.number().optional(),
    textTransform: z.enum(['none', 'uppercase', 'lowercase']).default('none'),
  }) }),
  z.object({ ...itemBaseV2, type: z.literal('image'), data: z.object({ src: z.string() }) }),
  z.object({ ...itemBaseV2, type: z.literal('scene'), data: z.object({
    sceneFile: z.string(),
    displayMode: z.enum(['fullscreen', 'split-screen', 'overlay']).optional(),
  }) }),
  z.object({ ...itemBaseV2, type: z.literal('caption'), data: z.object({
    words: z.array(captionWordSchema),
  }) }),
  z.object({ ...itemBaseV2, type: z.literal('shape'), data: z.object({
    shape: z.enum(['rectangle', 'circle', 'line']),
    fill: z.string().default('#FFFFFF'),
    stroke: z.string().optional(),
    strokeWidth: z.number().optional(),
    borderRadius: z.number().optional(),
  }) }),
]);

// ---- Sanitization functions ----

const KF_META = new Set(['timeMs', 'props', 'easing']);

export function sanitizeKeyframe(kf: any): any {
  if (!kf || typeof kf !== 'object') return null;

  if (kf.props && typeof kf.props === 'object') {
    return { timeMs: kf.timeMs, props: kf.props, easing: kf.easing ?? 'linear' };
  }

  // Rescue flat transform properties into props
  const props: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(kf)) {
    if (!KF_META.has(k) && v !== undefined) props[k] = v;
  }
  return { timeMs: kf.timeMs, props, easing: kf.easing ?? 'linear' };
}

export function sanitizeKeyframes(keyframes: any): any[] {
  if (!Array.isArray(keyframes)) return [];
  return keyframes.map(sanitizeKeyframe).filter(Boolean);
}

export function sanitizeTransform(t: any): any {
  if (!t || typeof t !== 'object') return undefined;
  const result: Record<string, unknown> = {
    x: 0, y: 0, width: '100%', height: '100%', rotation: 0, opacity: 1,
  };
  for (const [k, v] of Object.entries(t)) {
    if (v !== undefined) result[k] = v;
  }
  return result;
}

export function sanitizeFilters(f: any): any {
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

export function sanitizeItem(item: any): any {
  return {
    ...item,
    keyframes: sanitizeKeyframes(item.keyframes),
    transform: item.transform ? sanitizeTransform(item.transform) : undefined,
    filters: item.filters ? sanitizeFilters(item.filters) : undefined,
  };
}

// ---- Error formatting ----

export function formatItemError(zodError: z.ZodError, item: any): string {
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

- [ ] **Step 4: Run the tests — expect PASS**

Run: `npx tsx scripts/temp/test-manifest-sanitize.ts`
Expected: `✅ All sanitize tests passed`

- [ ] **Step 5: Verify sandbox package builds**

Run: `cd packages/sandbox && npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 6: Commit**

```bash
git add packages/sandbox/src/tools/manifest-sanitize.ts scripts/temp/test-manifest-sanitize.ts
git commit -m "feat(sandbox): add manifest sanitization module with inline schema"
```

---

### Task 4: Rulebook prompt + prompt-loader wiring

**Files:**
- Create: `packages/sandbox/src/prompts/shared/manifest-rules.xml`
- Modify: `packages/sandbox/src/prompts/prompt-loader.ts:16`
- Modify: `packages/sandbox/template/.claude/CLAUDE.md`

- [ ] **Step 1: Create `manifest-rules.xml`**

Create `packages/sandbox/src/prompts/shared/manifest-rules.xml` with the rulebook content from the spec (Layer 1). Use the exact content from the spec's `<manifest-rules>` XML block in `docs/superpowers/specs/2026-03-19-manifest-validation-framework-design.md` lines 46-112.

- [ ] **Step 2: Add to `SHARED_FILES` in `prompt-loader.ts`**

In `packages/sandbox/src/prompts/prompt-loader.ts` line 16, add `manifest-rules.xml`:

```typescript
const SHARED_FILES = ['identity.xml', 'manifest-tools.xml', 'quality-rules.xml', 'manifest-rules.xml'];
```

- [ ] **Step 3: Add manifest rules reference to workspace CLAUDE.md**

In `packages/sandbox/template/.claude/CLAUDE.md`, append after the Scene Export Convention section:

```markdown

## Manifest Field Rules
Keyframes require `{ timeMs, props: { ...transformProps }, easing }`. Never put transform props flat on the keyframe — always nest inside `props`. Valid props keys: x, y, width, height, rotation, opacity. See the full rulebook in your system prompt for all field constraints.
```

- [ ] **Step 4: Verify sandbox builds**

Run: `cd packages/sandbox && npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 5: Commit**

```bash
git add packages/sandbox/src/prompts/shared/manifest-rules.xml packages/sandbox/src/prompts/prompt-loader.ts packages/sandbox/template/.claude/CLAUDE.md
git commit -m "feat(sandbox): add manifest field rulebook prompt for all agents"
```

---

### Task 5: Validation gates — `add_item` + `add_track`

**Files:**
- Modify: `packages/sandbox/src/tools/manifest-ops.ts:295-377` (addItemTool) and `:196-232` (addTrackTool)

- [ ] **Step 1: Add imports to `manifest-ops.ts`**

At the top of `packages/sandbox/src/tools/manifest-ops.ts`, after the existing imports (line 6), add:

```typescript
import {
  sanitizeItem,
  manifestItemV2Schema,
  formatItemError,
} from './manifest-sanitize.js';
```

- [ ] **Step 2: Add track type validation to `add_track`**

In `addTrackTool.execute()` (around line 213), add validation before the track creation:

```typescript
async execute(input: { type: string; name: string }): Promise<string> {
  return withManifestLock(async () => {
    try {
      // Validate track type enum
      const validTypes = ['video', 'audio', 'overlay', 'caption'];
      if (!validTypes.includes(input.type)) {
        return `Invalid track type "${input.type}". Must be one of: ${validTypes.join(', ')}`;
      }

      const manifest = await readManifest();
      // ... rest of existing code unchanged
```

- [ ] **Step 3: Rewrite `add_item` execute with validation gate**

Replace `addItemTool.execute()` body (lines 343-377) with the validated version. The full new body:

```typescript
async execute(input: { /* existing types */ }): Promise<string> {
  return withManifestLock(async () => {
    try {
      // 1. Validate data against type-specific schema (existing)
      const schema = itemDataSchemas[input.type];
      if (schema) {
        const result = schema.safeParse(input.data);
        if (!result.success) {
          const issues = result.error.issues.map((i: any) => `${i.path.join('.')}: ${i.message}`).join('; ');
          return `Invalid data for ${input.type} item: ${issues}`;
        }
        input.data = result.data;
      }

      const manifest = await readManifest();
      const items: any[] = manifest.items ?? [];

      // 2. Build the item
      const raw: any = {
        id: input.id ?? randomUUID(),
        type: input.type,
        trackId: input.trackId,
        startMs: input.startMs,
        endMs: input.endMs,
        data: input.data,
        keyframes: input.keyframes ?? [],
      };
      if (input.transform) raw.transform = input.transform;
      if (input.filters) raw.filters = input.filters;
      if (input.style) raw.style = input.style;

      // 3. Duplicate ID check (hard error)
      if (items.some((i: any) => i.id === raw.id)) {
        return `Item "${raw.id}" already exists. Use update_item to modify it.`;
      }

      // 4. Sanitize + validate
      const sanitized = sanitizeItem(raw);
      const validation = manifestItemV2Schema.safeParse(sanitized);
      if (!validation.success) {
        return formatItemError(validation.error, sanitized);
      }

      // 5. Referential integrity check
      const tracks = manifest.tracks ?? [];
      if (!tracks.some((t: any) => t.id === sanitized.trackId)) {
        return `Track "${sanitized.trackId}" not found. Available: ${tracks.map((t: any) => t.id).join(', ')}`;
      }

      // 6. Range check
      if (sanitized.startMs >= sanitized.endMs) {
        return `startMs (${sanitized.startMs}) must be less than endMs (${sanitized.endMs})`;
      }

      // 7. Write validated item
      manifest.items = items;
      manifest.items.push(validation.data);
      await writeManifest(manifest);
      return JSON.stringify(validation.data);
    } catch (err: any) {
      return `Failed to add item: ${err.message}`;
    }
  });
}
```

- [ ] **Step 4: Verify sandbox builds**

Run: `cd packages/sandbox && npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 5: Commit**

```bash
git add packages/sandbox/src/tools/manifest-ops.ts
git commit -m "feat(sandbox): add validation gates to add_item and add_track"
```

---

### Task 6: Validation gate — `update_item` (with rollback)

**Files:**
- Modify: `packages/sandbox/src/tools/manifest-ops.ts:404-442` (updateItemTool)

- [ ] **Step 1: Add `sanitizeKeyframes` to imports**

Update the import from `manifest-sanitize.js` in `manifest-ops.ts` to also include `sanitizeKeyframes`:

```typescript
import {
  sanitizeItem,
  sanitizeKeyframes,
  manifestItemV2Schema,
  formatItemError,
} from './manifest-sanitize.js';
```

- [ ] **Step 2: Rewrite `update_item` execute with validation gate + rollback**

Replace `updateItemTool.execute()` body (lines 415-441):

```typescript
async execute(input: { /* existing types */ }): Promise<string> {
  return withManifestLock(async () => {
    try {
      const manifest = await readManifest();
      const items: any[] = manifest.items ?? [];
      const idx = items.findIndex((i: any) => i.id === input.itemId);
      if (idx === -1) return `Item not found: ${input.itemId}`;

      // Snapshot for rollback
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

      // Sanitize + validate the MERGED item
      const sanitized = sanitizeItem(item);
      const validation = manifestItemV2Schema.safeParse(sanitized);
      if (!validation.success) {
        items[idx] = snapshot; // ROLLBACK
        return formatItemError(validation.error, sanitized);
      }

      // Range check
      if (sanitized.startMs >= sanitized.endMs) {
        items[idx] = snapshot; // ROLLBACK
        return `startMs (${sanitized.startMs}) must be less than endMs (${sanitized.endMs})`;
      }

      items[idx] = validation.data;
      await writeManifest(manifest);
      return JSON.stringify(items[idx]);
    } catch (err: any) {
      return `Failed to update item: ${err.message}`;
    }
  });
}
```

- [ ] **Step 3: Verify sandbox builds**

Run: `cd packages/sandbox && npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add packages/sandbox/src/tools/manifest-ops.ts
git commit -m "feat(sandbox): add validation gate to update_item with snapshot rollback"
```

---

### Task 7: Validation — `split_item` + `update_caption_style`

**Files:**
- Modify: `packages/sandbox/src/tools/manifest-ops.ts:490-541` (splitItemTool) and `:544-585` (updateCaptionStyleTool)

- [ ] **Step 1: Add keyframe sanitization to `split_item`**

In `splitItemTool.execute()`, after the `newItem` construction (around line 522), add sanitization for both items' keyframes:

```typescript
// Sanitize keyframes on both halves
newItem.keyframes = sanitizeKeyframes(newItem.keyframes);
item.keyframes = sanitizeKeyframes(item.keyframes);
```

Insert these two lines before `items.push(newItem);` (line 532).

- [ ] **Step 2: Add validation to `update_caption_style`**

This requires importing `manifestCaptionStyleSchema`. Since `manifest-ops.ts` avoids `@viona/shared`, add an inline caption style schema to `manifest-sanitize.ts`. Add at the end of `manifest-sanitize.ts`:

```typescript
// Caption style schema (mirrors @viona/shared/manifest.ts manifestCaptionStyleSchema)
export const manifestCaptionStyleSchema = z.object({
  displayMode: z.enum(['word-by-word', 'phrase', 'karaoke', 'dynamic-hierarchy']).default('phrase'),
  wordsPerPhrase: z.number().min(1).max(10).default(5),
  fontFamily: z.string().default('Inter'),
  fontSize: z.number().min(8).max(200).default(56),
  fontWeight: z.number().min(100).max(900).default(800),
  letterSpacing: z.number().optional(),
  textTransform: z.enum(['none', 'uppercase', 'lowercase']).optional(),
  opacity: z.number().min(0).max(1).optional(),
  lineHeight: z.number().optional(),
  color: z.string().default('#FFFFFF'),
  activeColor: z.string().default('#FFD700'),
  backgroundColor: z.string().default('transparent'),
  activeBackgroundColor: z.string().default('transparent'),
  backgroundPadding: z.object({ x: z.number(), y: z.number() }).optional(),
  backgroundRadius: z.number().optional(),
  stroke: z.object({ width: z.number(), color: z.string() }).nullable().optional(),
  animation: z.object({
    in: z.string(), active: z.string(), out: z.string(), easing: z.string(),
  }).default({ in: 'elastic-pop', active: 'none', out: 'none', easing: 'spring' }),
  position: z.object({
    anchor: z.enum(['top', 'center', 'bottom']).default('bottom'),
    offsetX: z.number().default(0),
    offsetY: z.number().default(0),
    textAlign: z.enum(['left', 'center', 'right']).default('center'),
    rotation: z.number().default(0),
  }).default(() => ({ anchor: 'bottom' as const, offsetX: 0, offsetY: 0, textAlign: 'center' as const, rotation: 0 })),
  effects: z.object({
    shadow: z.object({ offsetX: z.number(), offsetY: z.number(), blur: z.number(), color: z.string(), opacity: z.number() }).nullable().default(null),
    shadowSecondary: z.object({ offsetX: z.number(), offsetY: z.number(), blur: z.number(), color: z.string(), opacity: z.number() }).nullable().default(null),
    glow: z.object({ enabled: z.boolean(), color: z.string(), intensity: z.number(), size: z.number() }).nullable().default(null),
  }).optional(),
  presetId: z.string().nullable().optional(),
}).passthrough();

export function formatCaptionStyleError(zodError: z.ZodError, style: any): string {
  const issues = zodError.issues.map(issue => {
    const path = issue.path.join('.');
    const got = getNestedValue(style, issue.path);
    return `  - ${path}: expected ${issue.message}, got ${JSON.stringify(got)}`;
  });
  return [
    'Invalid caption style:',
    ...issues,
    '',
    'Fix the invalid fields and retry.',
  ].join('\n');
}
```

- [ ] **Step 3: Update `update_caption_style` in `manifest-ops.ts`**

Add `manifestCaptionStyleSchema` and `formatCaptionStyleError` to the import from `manifest-sanitize.js`. Then update `updateCaptionStyleTool.execute()`:

```typescript
async execute(input: { updates: Record<string, unknown> }): Promise<string> {
  return withManifestLock(async () => {
    try {
      const manifest = await readManifest();
      const existing = manifest.captionStyle ?? {};
      // Deep-merge nested objects (existing logic)
      for (const [key, value] of Object.entries(input.updates)) {
        if (value && typeof value === 'object' && !Array.isArray(value) && existing[key] && typeof existing[key] === 'object') {
          existing[key] = { ...existing[key], ...value };
        } else {
          existing[key] = value;
        }
      }
      // Validate merged caption style
      const validation = manifestCaptionStyleSchema.safeParse(existing);
      if (!validation.success) {
        return formatCaptionStyleError(validation.error, existing);
      }
      manifest.captionStyle = validation.data;
      await writeManifest(manifest);
      return JSON.stringify(manifest.captionStyle);
    } catch (err: any) {
      return `Failed to update caption style: ${err.message}`;
    }
  });
}
```

- [ ] **Step 4: Verify sandbox builds**

Run: `cd packages/sandbox && npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 5: Commit**

```bash
git add packages/sandbox/src/tools/manifest-sanitize.ts packages/sandbox/src/tools/manifest-ops.ts
git commit -m "feat(sandbox): add validation to split_item and update_caption_style"
```

---

### Task 8: Semantic warnings

**Files:**
- Create: `packages/sandbox/src/tools/manifest-warnings.ts`
- Create: `scripts/temp/test-manifest-warnings.ts`
- Modify: `packages/sandbox/src/tools/manifest-ops.ts` (integrate warnings into all write tools)

- [ ] **Step 1: Write the test file**

Create `scripts/temp/test-manifest-warnings.ts`:

```typescript
// Test manifest warning functions
// Run: npx tsx scripts/temp/test-manifest-warnings.ts

import { strict as assert } from 'assert';

async function run() {
  const { collectWarnings, formatWarnings } = await import(
    '../../packages/sandbox/src/tools/manifest-warnings.js'
  );

  const baseManifest = {
    durationMs: 30000,
    canvas: { width: 1080, height: 1920 },
    tracks: [
      { id: 'vid', type: 'video', name: 'Video', position: 0 },
      { id: 'aud', type: 'audio', name: 'Audio', position: 1 },
      { id: 'ov1', type: 'overlay', name: 'Overlay 1', position: 2 },
      { id: 'cap', type: 'caption', name: 'Captions', position: 3 },
    ],
    items: [],
  };

  console.log('--- W9: Item-track type mismatch ---');
  const w9 = collectWarnings({
    operation: 'add',
    item: { id: 'x', type: 'video', trackId: 'cap', startMs: 0, endMs: 5000, data: { src: 's.mp4' }, keyframes: [] },
    manifest: baseManifest,
  });
  assert(w9.some((w: string) => w.includes('Item type "video" placed on track type "caption"')));
  console.log('PASS: W9 fires for mismatched item/track types');

  console.log('\n--- W10: Item exceeds durationMs ---');
  const w10 = collectWarnings({
    operation: 'add',
    item: { id: 'x', type: 'scene', trackId: 'ov1', startMs: 0, endMs: 35000, data: { sceneFile: 'scenes/S1.tsx' }, keyframes: [] },
    manifest: baseManifest,
  });
  assert(w10.some((w: string) => w.includes('extends past timeline end')));
  console.log('PASS: W10 fires when item exceeds durationMs');

  console.log('\n--- W11: Overlap on same track ---');
  const manifestWithItem = {
    ...baseManifest,
    items: [{ id: 'existing', type: 'scene', trackId: 'ov1', startMs: 2000, endMs: 8000, data: {} }],
  };
  const w11 = collectWarnings({
    operation: 'add',
    item: { id: 'new', type: 'scene', trackId: 'ov1', startMs: 5000, endMs: 10000, data: { sceneFile: 'scenes/S1.tsx' }, keyframes: [] },
    manifest: manifestWithItem,
  });
  assert(w11.some((w: string) => w.includes('Overlaps with item')));
  console.log('PASS: W11 fires for overlapping items');

  console.log('\n--- W14: Keyframe beyond duration ---');
  const w14 = collectWarnings({
    operation: 'add',
    item: { id: 'x', type: 'scene', trackId: 'ov1', startMs: 0, endMs: 5000, data: { sceneFile: 'scenes/S1.tsx' }, keyframes: [{ timeMs: 6000, props: {}, easing: 'linear' }] },
    manifest: baseManifest,
  });
  assert(w14.some((w: string) => w.includes('exceeds item duration')));
  console.log('PASS: W14 fires for out-of-range keyframe');

  console.log('\n--- W4: Video removal warning ---');
  const w4 = collectWarnings({
    operation: 'remove',
    item: { id: 'x', type: 'video', trackId: 'vid', startMs: 0, endMs: 5000, data: { src: 's.mp4' }, keyframes: [] },
    manifest: baseManifest,
  });
  assert(w4.some((w: string) => w.includes('Removing video item removes speaker audio')));
  console.log('PASS: W4 fires for video removal');

  console.log('\n--- formatWarnings ---');
  assert.strictEqual(formatWarnings([]), '');
  const formatted = formatWarnings(['Warning 1', 'Warning 2']);
  assert(formatted.includes('⚠ Warnings:'));
  assert(formatted.includes('- Warning 1'));
  console.log('PASS: formatWarnings formats correctly');

  console.log('\n--- No warnings for clean operation ---');
  const clean = collectWarnings({
    operation: 'add',
    item: { id: 'x', type: 'scene', trackId: 'ov1', startMs: 0, endMs: 5000, data: { sceneFile: 'scenes/S1.tsx', displayMode: 'overlay' }, keyframes: [] },
    manifest: baseManifest,
  });
  // Should only have W6 (scene file not found) since we're not in a real workspace
  const nonFileWarnings = clean.filter((w: string) => !w.includes('not found'));
  assert.strictEqual(nonFileWarnings.length, 0);
  console.log('PASS: clean operation produces no non-file warnings');

  console.log('\n✅ All warning tests passed');
}

run().catch(err => { console.error('FAIL:', err); process.exit(1); });
```

- [ ] **Step 2: Run test — expect FAIL (module doesn't exist yet)**

Run: `npx tsx scripts/temp/test-manifest-warnings.ts`
Expected: FAIL with `Cannot find module` error.

- [ ] **Step 3: Create `manifest-warnings.ts`**

Create `packages/sandbox/src/tools/manifest-warnings.ts` with the full implementation from the spec (lines 575-743). Copy the `collectWarnings()` and `formatWarnings()` functions exactly as specified.

```typescript
import { existsSync } from 'fs';
import { join } from 'path';

const WORKSPACE = '/workspace';
const SCENES_DIR = join(WORKSPACE, 'src/scenes');

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
  previousItem?: any;
};

export function collectWarnings(ctx: WarningContext): string[] {
  const warnings: string[] = [];
  const { operation, item, manifest } = ctx;
  const items: any[] = manifest.items ?? [];
  const tracks: any[] = manifest.tracks ?? [];
  const track = tracks.find((t: any) => t.id === item.trackId);

  // W9: Item-track type mismatch
  if (track && ITEM_TRACK_MAP[item.type]) {
    if (!ITEM_TRACK_MAP[item.type].includes(track.type)) {
      warnings.push(
        `Item type "${item.type}" placed on track type "${track.type}". ` +
        `Expected track type: ${ITEM_TRACK_MAP[item.type].join(' or ')}.`
      );
    }
  }

  // W6: Scene file not found
  if (item.type === 'scene' && item.data?.sceneFile) {
    const sceneFile = item.data.sceneFile.replace(/^scenes\//, '');
    const scenePath = join(SCENES_DIR, sceneFile);
    if (!existsSync(scenePath)) {
      warnings.push(`Scene file "${item.data.sceneFile}" not found. Render will fail.`);
    }
  }

  // W7: Scene mockup missing displayMode
  if ((item.type === 'scene' || item.type === 'shape') && item.data?.sceneFile && !item.data?.displayMode) {
    warnings.push(`Scene item "${item.id}" has no displayMode. Downstream agents need this.`);
  }

  // W10: Item exceeds durationMs
  if (manifest.durationMs && item.endMs > manifest.durationMs + 100) {
    warnings.push(
      `Item extends past timeline end (${item.endMs}ms > durationMs ${manifest.durationMs}ms).`
    );
  }

  // W11: Overlap on same track
  for (const other of items) {
    if (other.id === item.id || other.trackId !== item.trackId) continue;
    if (item.startMs < other.endMs && item.endMs > other.startMs) {
      warnings.push(
        `Overlaps with item "${other.id}" on same track (${other.startMs}-${other.endMs}ms).`
      );
      break;
    }
  }

  // W14: Keyframe beyond item duration
  const duration = item.endMs - item.startMs;
  for (const kf of item.keyframes ?? []) {
    if (kf.timeMs > duration) {
      warnings.push(`Keyframe at ${kf.timeMs}ms exceeds item duration (${duration}ms). It will never execute.`);
      break;
    }
  }

  // W1/W2: Video-audio coupling
  if (operation !== 'add' && (item.type === 'video' || item.type === 'audio')) {
    const partnerType = item.type === 'video' ? 'audio' : 'video';
    const partners = items.filter((i: any) =>
      i.type === partnerType &&
      i.startMs < item.endMs && i.endMs > item.startMs
    );
    for (const p of partners) {
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

  // W4: Removing video item removes speaker audio
  if (operation === 'remove' && item.type === 'video') {
    warnings.push(
      `Removing video item removes speaker audio for ${item.startMs}-${item.endMs}ms. ` +
      `Use opacity:0 keyframes to hide speaker visually while keeping audio.`
    );
  }

  // W17: Fullscreen scene without speaker opacity
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

  // W19/W20: Overlay safe zone violations
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

export function formatWarnings(warnings: string[]): string {
  if (warnings.length === 0) return '';
  return '\n\n⚠ Warnings:\n' + warnings.map(w => `- ${w}`).join('\n');
}
```

- [ ] **Step 4: Run warning tests — expect PASS**

Run: `npx tsx scripts/temp/test-manifest-warnings.ts`
Expected: `✅ All warning tests passed`

- [ ] **Step 5: Integrate warnings into `manifest-ops.ts`**

Add import at the top of `manifest-ops.ts`:

```typescript
import { collectWarnings, formatWarnings } from './manifest-warnings.js';
```

Then update each write tool's return statement:

**`add_item`** — after `await writeManifest(manifest)`:
```typescript
const warnings = collectWarnings({ operation: 'add', item: validation.data, manifest });
return JSON.stringify(validation.data) + formatWarnings(warnings);
```

**`update_item`** — after `await writeManifest(manifest)`:
```typescript
const warnings = collectWarnings({ operation: 'update', item: items[idx], manifest, previousItem: snapshot });
return JSON.stringify(items[idx]) + formatWarnings(warnings);
```

**`remove_item`** — before `items.splice(idx, 1)`:
```typescript
const removedItem = items[idx];
const warnings = collectWarnings({ operation: 'remove', item: removedItem, manifest });
items.splice(idx, 1);
await writeManifest(manifest);
syncTranscript().catch(() => {});
return JSON.stringify({ removed: input.itemId }) + formatWarnings(warnings);
```

**`split_item`** — after `await writeManifest(manifest)`:
```typescript
const warnings = collectWarnings({ operation: 'split', item: newItem, manifest });
syncTranscript().catch(() => {});
return JSON.stringify({ originalId: item.id, newId }) + formatWarnings(warnings);
```

**`remove_track`** — before `manifest.tracks.splice(trackIdx, 1)`:
```typescript
const trackToRemove = manifest.tracks[trackIdx];
const itemsOnTrack = (manifest.items ?? []).filter((i: any) => i.trackId === input.trackId);
const trackWarnings: string[] = [];
if (itemsOnTrack.length > 0) {
  trackWarnings.push(`Track "${trackToRemove.name}" has ${itemsOnTrack.length} items. Removing it will delete all of them.`);
}
// ... existing splice + filter + writeManifest ...
return JSON.stringify({ removed: input.trackId, removedItems: removedCount }) + formatWarnings(trackWarnings);
```

- [ ] **Step 6: Verify sandbox builds**

Run: `cd packages/sandbox && npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 7: Commit**

```bash
git add packages/sandbox/src/tools/manifest-warnings.ts packages/sandbox/src/tools/manifest-ops.ts scripts/temp/test-manifest-warnings.ts
git commit -m "feat(sandbox): add semantic warnings to all manifest write tools"
```

---

### Task 9: Final verification

- [ ] **Step 1: Run all test scripts**

```bash
npx tsx scripts/temp/test-manifest-sanitize.ts && npx tsx scripts/temp/test-manifest-warnings.ts
```

Expected: Both pass.

- [ ] **Step 2: Verify all packages build**

```bash
cd packages/shared && npx tsc --noEmit && cd ../api && npx tsc --noEmit && cd ../sandbox && npx tsc --noEmit
```

Expected: No type errors in any package.

- [ ] **Step 3: Verify prompt file is loadable**

```bash
cat packages/sandbox/src/prompts/shared/manifest-rules.xml | head -5
```

Expected: Shows `<manifest-rules>` tag.

- [ ] **Step 4: Final commit if any remaining changes**

```bash
git status
# If any uncommitted changes, stage and commit them
```
