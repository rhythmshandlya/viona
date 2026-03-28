# Caption Preset System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken split caption style system (per-item + global) with a single `CaptionPreset` on the manifest, curate presets to 9, and simplify the StylePanel.

**Architecture:** `manifest.captionPreset` is the single source of truth. Caption items carry only content (words + timing). One store action `updateCaptionPreset()` handles all style changes. The renderer resolves preset + word roles at render time.

**Tech Stack:** TypeScript, Zustand (store), Zod (manifest schema), React (StylePanel, CaptionDragOverlay), Remotion (CaptionItem renderer)

**Spec:** `docs/superpowers/specs/2026-03-20-caption-preset-system-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `packages/shared/src/manifest-shared.ts` | Modify | Rename schema field, remove `dynamic-hierarchy` from displayMode enum, add `wordEmphasis` |
| `packages/shared/src/manifest-v2.ts` | Modify | Rename `captionStyle` → `captionPreset` on `manifestV2Schema` |
| `packages/shared/src/manifest-ops.ts` | Modify | Rename op `update_caption_style` → `update_caption_preset`, deep merge |
| `apps/web/src/lib/subtitle-presets.ts` | Modify | Curate to 9 presets, add `supportedModes`, remove categories |
| `apps/web/src/features/editor-v2/store/types.ts` | Modify | Add `captionPreset` to EditorState, strip `style` from CaptionItemData |
| `apps/web/src/features/editor-v2/store/editor-store.ts` | Modify | Replace 2 style actions with `updateCaptionPreset()`, update `syncWorkspaceManifest()` and `loadProject()` |
| `apps/web/src/features/editor-v2/store/manifest-bridge.ts` | Modify | Read/write `captionPreset` instead of `captionStyle`, update `StoreManifestOp` type, migration fallback |
| `apps/web/src/features/editor-v2/store/manifest-dispatch.ts` | Modify | Rename `updateCaptionStyle` → `updateCaptionPreset` in `SandboxOp` type |
| `apps/web/src/features/editor-v2/hooks/use-keyboard-shortcuts.ts` | Modify | Replace `updateAllCaptionStyles` → `updateCaptionPreset` for display mode shortcuts |
| `apps/web/src/features/editor-v2/panels/StylePanel.tsx` | Modify | Remove position/animation/effects tabs, simplify controls |
| `packages/sandbox/src/tools/manifest-ops.ts` | Modify | Rename `updateCaptionStyleTool` → `updateCaptionPresetTool`, update `generateCaptionsTool` references |
| `packages/sandbox/template/src/PlayerComposition.tsx` | Modify | Read `manifest.captionPreset` (fallback `captionStyle`), pass to CaptionItem |
| `packages/sandbox/template/src/items/CaptionItem.tsx` | Modify | Render words individually with role resolution |
| `packages/sandbox/template/src/composition/AnimatedSubtitle.tsx` | Modify | Remove `dynamic-hierarchy` display mode, update `captionStyle` references |
| `apps/web/src/features/editor-v2/components/CaptionDragOverlay.tsx` | Verify | Already uses global path — just update import names |

---

### Task 1: Shared Types — Rename captionStyle → captionPreset

**Files:**
- Modify: `packages/shared/src/manifest-shared.ts`
- Modify: `packages/shared/src/manifest-v2.ts`
- Modify: `packages/shared/src/manifest-ops.ts`

- [ ] **Step 1: Update the Zod schema in manifest-shared.ts**

In `packages/shared/src/manifest-shared.ts`, rename `manifestCaptionStyleSchema` to `manifestCaptionPresetSchema`. Remove `'dynamic-hierarchy'` from the `displayMode` enum (line 15). Add optional `wordEmphasis` field. Update the type export from `ManifestCaptionStyle` to `ManifestCaptionPreset`. Keep `ManifestCaptionStyle` as a deprecated alias for backwards compatibility.

The `displayMode` enum should be: `z.enum(['word-by-word', 'phrase', 'karaoke'])`

Add to the schema:
```typescript
wordEmphasis: z.object({
  enabled: z.boolean(),
  roles: z.record(z.string(), z.object({
    fontFamily: z.string().optional(),
    fontSize: z.number().optional(),
    fontWeight: z.number().optional(),
    color: z.string().optional(),
    activeColor: z.string().optional(),
    scale: z.number().optional(),
    letterSpacing: z.number().optional(),
    textTransform: z.enum(['none', 'uppercase', 'lowercase']).optional(),
    emphasisBg: z.string().optional(),
  })),
}).optional(),
```

Also update `captionWordSchema`: add optional `role: z.string()` field, keep `classification` and `styleOverrides` for backwards compat during migration.

- [ ] **Step 2: Update manifest-ops.ts**

In `packages/shared/src/manifest-ops.ts`:
1. In the `manifestOpSchema` discriminatedUnion (around line 38-41), rename the op from `update_caption_style` to `update_caption_preset`
2. In the switch case handler (around line 113-116), change from `m.captionStyle` to `m.captionPreset`
3. Change from shallow spread to deep merge for nested objects:

```typescript
case 'update_caption_preset': {
  const existing = m.captionPreset ?? {};
  const updates = op.updates;
  // Deep merge nested objects, shallow replace scalars
  m.captionPreset = {
    ...existing,
    ...updates,
    ...(updates.position && existing.position ? { position: { ...existing.position, ...updates.position } } : {}),
    ...(updates.animation && existing.animation && typeof existing.animation === 'object' ? { animation: { ...existing.animation, ...updates.animation } } : {}),
    ...(updates.effects && existing.effects ? { effects: { ...existing.effects, ...updates.effects } } : {}),
    ...(updates.wordEmphasis && existing.wordEmphasis ? { wordEmphasis: { ...existing.wordEmphasis, ...updates.wordEmphasis } } : {}),
    ...(updates.backgroundPadding && existing.backgroundPadding ? { backgroundPadding: { ...existing.backgroundPadding, ...updates.backgroundPadding } } : {}),
  } as any;
  break;
}
```

Also keep `update_caption_style` as a deprecated alias that does the same thing (writes to `m.captionPreset`) — this prevents sandbox agents using the old tool name from breaking.

- [ ] **Step 3: Update manifest-v2.ts schema**

In `packages/shared/src/manifest-v2.ts`:
1. The top-level `manifestV2Schema` (line 142-170) has `captionStyle: manifestCaptionStyleSchema.default(...)`. Rename this field to `captionPreset` and update the default to use the renamed schema (`manifestCaptionPresetSchema`).
2. Update the import at line 2: `manifestCaptionStyleSchema` → `manifestCaptionPresetSchema` (or import both if keeping the alias).
3. The `Manifest` interface on the Remotion `PlayerComposition.tsx` reads `captionStyle` — we need the schema to match `captionPreset`.

```typescript
// Line 153: was captionStyle, now captionPreset
captionPreset: manifestCaptionPresetSchema.default(() => ({
  displayMode: 'phrase' as const,
  wordsPerPhrase: 5,
  fontFamily: 'Inter',
  fontSize: 56,
  fontWeight: 800,
  color: '#FFFFFF',
  activeColor: '#FFD700',
  backgroundColor: 'transparent',
  activeBackgroundColor: 'transparent',
  animation: { in: 'elastic-pop', active: 'none', out: 'none', easing: 'spring' },
  position: { anchor: 'bottom' as const, offsetX: 0, offsetY: 0, textAlign: 'center' as const, rotation: 0 },
})),
```

- [ ] **Step 4: Verify build**

Run: `cd packages/shared && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/manifest-shared.ts packages/shared/src/manifest-v2.ts packages/shared/src/manifest-ops.ts
git commit -m "feat(shared): rename captionStyle → captionPreset, add wordEmphasis schema"
```

---

### Task 2: Curate Presets

**Files:**
- Modify: `apps/web/src/lib/subtitle-presets.ts`

- [ ] **Step 1: Update DEFAULT_CAPTION_STYLE.presetId FIRST**

In `apps/web/src/features/editor-v2/store/types.ts`, change `DEFAULT_CAPTION_STYLE.presetId` from `'mrbeast-bold'` to `'default'`. This must happen before deleting presets in Step 3, otherwise the default references a nonexistent preset.

- [ ] **Step 2: Add supportedModes to SubtitlePreset type**

Add to the `SubtitlePreset` interface:
```typescript
supportedModes: CaptionDisplayMode[];  // First mode is default
wordEmphasis?: {
  enabled: boolean;
  roles: Record<string, Partial<WordRoleStyle>>;
};
```

Import `CaptionDisplayMode` from the store types.

- [ ] **Step 3: Remove all presets except the curated 9 + default**

Keep ONLY these preset IDs: `default`, `hormozi`, `ali-abdaal`, `nas-daily`, `netflix`, `retro-vhs`, `cottagecore`, `apple-clean`, `google-material`.

Delete all others: `mrbeast`, `iman-gadzhi`, `devin-jatho`, `neon-karaoke`, `kalice-glow`, `sara`, `ryan-trahan`, `gary-vee`, `gradient-genz`, `pastel-bubble`, `wiggle-shake`, `documentary`, `typewriter`, `cinematic`, `behind-person`, `casey-neistat`, `vaporwave`, `minimal`, `box-highlight`, `classic`, `ad-headline`, `mkbhd-tech`, `spotlight`, `film-grain`, `glitch-text`, `slam`, `wave-bounce`, `versus`, `spin-entry`, `zoom-focus`, `perspective-3d`, `elastic-stretch`, `speed-lines`, `particle-burst`, `liquid-morph`, `newspaper-spin`, `underline-wipe`, `y2k-chrome`, `brutalist`, `dynamic-hierarchy`, `neon-flicker`.

- [ ] **Step 3: Add supportedModes to each remaining preset**

```typescript
'default': { ..., supportedModes: ['word-by-word', 'phrase', 'karaoke'] },
'hormozi': { ..., supportedModes: ['word-by-word', 'phrase', 'karaoke'] },
'ali-abdaal': { ..., supportedModes: ['word-by-word', 'phrase', 'karaoke'] },
'nas-daily': { ..., supportedModes: ['word-by-word', 'phrase'] },
'netflix': { ..., supportedModes: ['phrase', 'karaoke'] },
'retro-vhs': { ..., supportedModes: ['word-by-word', 'phrase'] },
'cottagecore': { ..., supportedModes: ['word-by-word', 'phrase', 'karaoke'] },
'apple-clean': { ..., supportedModes: ['phrase', 'karaoke'] },
'google-material': { ..., supportedModes: ['word-by-word', 'phrase'] },
```

- [ ] **Step 4: Remove PRESET_CATEGORIES and getPresetsByCategory**

The category system is unnecessary with only 9 presets. Remove the `PresetCategory` type, `PRESET_CATEGORIES` array, and `getPresetsByCategory()` function. If other files import these, update them to remove the import.

- [ ] **Step 5: Verify build**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json`
Expected: PASS (may need to fix imports of removed exports in other files)

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/subtitle-presets.ts apps/web/src/features/editor-v2/store/types.ts
git commit -m "feat: curate presets to 9, add supportedModes, remove categories"
```

---

### Task 3: Store State — captionPreset as Top-Level State

**Files:**
- Modify: `apps/web/src/features/editor-v2/store/types.ts`
- Modify: `apps/web/src/features/editor-v2/store/editor-store.ts`

- [ ] **Step 1: Update EditorState type**

In `types.ts`, add `captionPreset: CaptionStyle` to the `EditorState` interface (near the existing timeline data fields around line 430-450). Use the existing `CaptionStyle` type — we don't need a new type, just a new location.

In `CaptionItemData` (line 91-97), remove `style: CaptionStyle` and `styleOverrides`. Keep `words`, `text`, and `aiWordOverrides` (aiWordOverrides will be deprecated later but don't break it now):

```typescript
export interface CaptionItemData {
  text: string;   // Kept for search/display — spec omits it but we need it
  words: CaptionWord[];
  aiWordOverrides?: Record<number, WordStyleOverrides>;
  // style field REMOVED — lives at store.captionPreset
}
```

- [ ] **Step 2: Add captionPreset to initial state and HistoryEntry**

In `editor-store.ts`, add to `initialState` (around line 118):
```typescript
captionPreset: DEFAULT_CAPTION_STYLE,
```

In `types.ts`, add `captionPreset` to `HistoryEntry` (line 579-584) so undo/redo captures preset changes:
```typescript
export interface HistoryEntry {
  tracks: Track[];
  items: Record<string, TimelineItem>;
  itemIds: string[];
  selectedIds: string[];
  captionPreset: CaptionStyle;  // NEW — undo/redo captures preset state
}
```

Update `pushHistory()` in `editor-store.ts` to include `captionPreset: state.captionPreset` in history snapshots, and update the undo/redo restore logic to restore `captionPreset`.

- [ ] **Step 3: Update syncWorkspaceManifest()**

In `editor-store.ts` (around line 88-116), replace the caption style extraction logic:

```typescript
// BEFORE: extracts from first caption item
const firstCaption = state.itemIds.map(id => state.items[id]).find(item => item?.type === 'caption');
const captionStyle = firstCaption ? (firstCaption.data as CaptionItemData).style ?? DEFAULT_CAPTION_STYLE : DEFAULT_CAPTION_STYLE;

// AFTER: reads directly from store state
const captionPreset = state.captionPreset;
```

Pass `captionPreset` to `storeToManifest()` (same parameter position as `captionStyle`).

- [ ] **Step 4: Replace updateAllCaptionStyles and updateSelectedCaptionStyles with updateCaptionPreset**

Remove `updateAllCaptionStyles` (around line 1193-1209) and `updateSelectedCaptionStyles` (around line 1211-1237). Replace with:

```typescript
updateCaptionPreset: (updates: Partial<CaptionStyle>) => {
  set((state) => {
    state.captionPreset = {
      ...state.captionPreset,
      ...updates,
      // Deep merge nested objects
      ...(updates.position && typeof state.captionPreset.position === 'object'
        ? { position: { ...state.captionPreset.position, ...updates.position } }
        : {}),
      ...(updates.animation && typeof state.captionPreset.animation === 'object'
        ? { animation: { ...(state.captionPreset.animation as any), ...(updates.animation as any) } }
        : {}),
      ...(updates.effects
        ? { effects: { ...state.captionPreset.effects, ...updates.effects } }
        : {}),
      ...(updates.backgroundPadding
        ? { backgroundPadding: { ...state.captionPreset.backgroundPadding, ...updates.backgroundPadding } }
        : {}),
    };
  });
  get().pushHistory();
  syncWorkspaceManifest();
  dispatchManifestOp({ op: 'update_caption_preset' as any, updates: { ...updates } });
},
```

- [ ] **Step 5: Update loadProject() to consume captionPreset from manifestToStore**

`loadProject()` calls `manifestToStore()` which now returns `captionPreset` (Task 4 Step 1). Update the destructure to include it:

```typescript
const { tracks, items, itemIds, duration, fps, videoSettings, captionPreset } = manifestToStore(manifest);
```

Set it on the state:
```typescript
state.captionPreset = captionPreset;
```

Also, in the caption item loop where items are loaded from DB (the `subtitle` → `caption` conversion path, around line 456-502), ensure:
1. Caption items do NOT get `data.style` set (content only: `text`, `words`)
2. Word migration: `w.role || w.classification || undefined`
3. If this code path extracts style from the first caption item, move that extraction to read from the project's manifest instead (since `manifestToStore` now handles it)

- [ ] **Step 6: Replace useFirstCaptionStyle with useCaptionPreset**

In `apps/web/src/features/editor-v2/store/use-editor-store.ts` (lines 74-83), the `useFirstCaptionStyle()` hook reads from `(caption?.data as CaptionItemData)?.style` which no longer exists after Step 1. Replace with:

```typescript
export function useCaptionPreset(): CaptionStyle {
  return useEditorStore((state) => state.captionPreset);
}
```

Search for all callers of `useFirstCaptionStyle()` (StylePanel, CaptionDragOverlay, etc.) and replace with `useCaptionPreset()`. The return type changes from `CaptionStyle | null` to `CaptionStyle` (always exists — defaults to `DEFAULT_CAPTION_STYLE`). Remove null checks at call sites.

- [ ] **Step 7: Update all references to updateAllCaptionStyles and updateSelectedCaptionStyles**

Search the codebase for all imports/uses of these two functions and replace with `updateCaptionPreset`. Key files:
- `apps/web/src/features/editor-v2/store/use-editor-store.ts` — update the `useCaptionActions` selector
- `apps/web/src/features/editor-v2/components/CaptionDragOverlay.tsx` — update import and usage
- `apps/web/src/features/editor-v2/panels/StylePanel.tsx` — update import and usage
- `apps/web/src/features/editor-v2/hooks/use-keyboard-shortcuts.ts` — line 250 calls `updateAllCaptionStyles({ displayMode })` for 1/2/3 shortcuts → change to `updateCaptionPreset({ displayMode })`

- [ ] **Step 7b: Update manifest-dispatch.ts SandboxOp type**

In `apps/web/src/features/editor-v2/store/manifest-dispatch.ts`:
- Rename `'updateCaptionStyle'` to `'updateCaptionPreset'` in the `SandboxOp.tool` union type (line 4)
- Keep `'generateCaptions'` as-is (the tool name on the sandbox side will be updated in Task 5)

```typescript
export interface SandboxOp {
  tool: 'addTrack' | 'updateTrack' | 'removeTrack' | 'addItem' | 'updateItem' | 'removeItem' | 'splitItem' | 'updateCaptionPreset' | 'generateCaptions';
  input: Record<string, unknown>;
}
```

- [ ] **Step 7c: Update StoreManifestOp type in manifest-bridge.ts**

In `apps/web/src/features/editor-v2/store/manifest-bridge.ts`, the `StoreManifestOp` type union includes `update_caption_style`. Rename to `update_caption_preset` to match the shared `manifest-ops.ts` change:

```typescript
// In the StoreManifestOp type:
| { op: 'update_caption_preset'; updates: Record<string, unknown> }
```

- [ ] **Step 8: Verify build**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/features/editor-v2/store/types.ts apps/web/src/features/editor-v2/store/editor-store.ts apps/web/src/features/editor-v2/store/use-editor-store.ts apps/web/src/features/editor-v2/store/manifest-bridge.ts apps/web/src/features/editor-v2/store/manifest-dispatch.ts apps/web/src/features/editor-v2/hooks/use-keyboard-shortcuts.ts apps/web/src/features/editor-v2/components/CaptionDragOverlay.tsx
git commit -m "feat: move captionPreset to top-level store state, single update action"
```

Note: `manifest-bridge.ts` is listed here for the `StoreManifestOp` type fix only. The full bridge update (read/write `captionPreset`) happens in Task 4.

---

### Task 4: Manifest Bridge — captionPreset Flow

**Files:**
- Modify: `apps/web/src/features/editor-v2/store/manifest-bridge.ts`

**Note:** Task 3 Step 7c already renamed `StoreManifestOp` `update_caption_style` → `update_caption_preset` in this file. This task completes the remaining bridge changes (read/write `captionPreset`, item conversion).

- [ ] **Step 1: Update ManifestToStoreResult and manifestToStore()**

In `manifest-bridge.ts`:
1. Add `captionPreset: CaptionStyle` to the `ManifestToStoreResult` interface (line 50-57):

```typescript
export interface ManifestToStoreResult {
  tracks: Track[];
  items: Record<string, TimelineItem>;
  itemIds: string[];
  duration: number;
  fps: number;
  videoSettings: VideoSettings;
  captionPreset: CaptionStyle;  // NEW
}
```

2. In `manifestToStore()` (around line 78-127):
- Read `manifest.captionPreset` with fallback to `manifest.captionStyle` for migration
- Return it in the result object
- Strip `data.style` from caption items during conversion
- Migrate `classification` → `role` on caption words

```typescript
// Read caption preset (with migration fallback)
const rawPreset = manifest.captionPreset ?? manifest.captionStyle;
const captionPreset = rawPreset
  ? convertManifestCaptionStyle(rawPreset)
  : DEFAULT_CAPTION_STYLE;

// Return captionPreset alongside existing fields
return { tracks, items, itemIds, duration, fps, videoSettings, captionPreset };
```

3. Update `loadProject()` in `editor-store.ts` (Task 3 Step 5) to consume `captionPreset` from the result:

```typescript
const { tracks, items, itemIds, duration, fps, videoSettings, captionPreset } = manifestToStore(manifest);
// ... set state.captionPreset = captionPreset;
```

This replaces the extraction logic described in Task 3 Step 5 — `manifestToStore()` is the single extraction point.

- [ ] **Step 2: Update storeToManifest()**

In `storeToManifest()` (around line 133-198):
1. Rename the function parameter from `captionStyle: CaptionStyle` to `captionPreset: CaptionStyle` (line 145)
2. Output `captionPreset` instead of `captionStyle` on the manifest object (line 187)

```typescript
// BEFORE:
captionStyle: convertStoreCaptionStyle(captionStyle),

// AFTER:
captionPreset: convertStoreCaptionStyle(captionPreset),
```

3. Update `syncWorkspaceManifest()` in `editor-store.ts` to pass the renamed parameter (should already be done in Task 3 Step 3)

- [ ] **Step 3: Update convertManifestItemV2 for captions**

Stop passing `captionStyle` to individual caption items. The caption item conversion should only extract `words` and `text`, not `style`.

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/editor-v2/store/manifest-bridge.ts
git commit -m "feat: manifest bridge reads/writes captionPreset, migration fallback"
```

---

### Task 5: Sandbox Tools + PlayerComposition — Rename and Update

**Files:**
- Modify: `packages/sandbox/src/tools/manifest-ops.ts`
- Modify: `packages/sandbox/template/src/PlayerComposition.tsx`

- [ ] **Step 1: Rename updateCaptionStyleTool → updateCaptionPresetTool**

In `packages/sandbox/src/tools/manifest-ops.ts` (around line 591-632):
1. Rename the tool object: `updateCaptionStyleTool` → `updateCaptionPresetTool`
2. Change `name` from `'update_caption_style'` to `'update_caption_preset'`
3. Update description to mention "caption preset" instead of "caption style"
4. Change the execute function to read/write `manifest.captionPreset` instead of `manifest.captionStyle`
5. Add migration: if `manifest.captionPreset` is undefined but `manifest.captionStyle` exists, migrate it

- [ ] **Step 2: Update generateCaptionsTool**

In the same file, `generateCaptionsTool` (around line 670-727) reads/writes `manifest.captionStyle`. Update it:
1. Read `manifest.captionPreset ?? manifest.captionStyle` (migration fallback)
2. Write to `manifest.captionPreset` instead of `manifest.captionStyle`
3. If both exist after migration, delete `manifest.captionStyle`

- [ ] **Step 3: Update readManifestTool summary output**

In `readManifestTool` (around line 188), the summary mode returns `captionStyle: manifest.captionStyle ?? null`. Update to:
```typescript
captionPreset: manifest.captionPreset ?? manifest.captionStyle ?? null,
```

Also remove `dynamic-hierarchy` from any description strings in tool definitions.

- [ ] **Step 3b: Update tool registration**

Search for where `updateCaptionStyleTool` is registered (likely in an array of tools or MCP server setup) and update the reference to `updateCaptionPresetTool`.

- [ ] **Step 4: Update PlayerComposition.tsx**

In `packages/sandbox/template/src/PlayerComposition.tsx`:
1. In the `Manifest` interface (line 35), add `captionPreset?: any` alongside `captionStyle?: any`
2. In the destructure (line 47), read with fallback: `const captionPreset = manifest.captionPreset ?? manifest.captionStyle ?? {};`
3. Pass `captionPreset` (not `captionStyle`) to `ItemRenderer` at lines 68, 83, 139
4. In `ItemRendererProps` (line 101), rename prop to `captionPreset`
5. In the `ItemRenderer` component (line 104), rename destructured prop
6. At line 139 (caption case), pass: `<CaptionItem data={item.data} captionStyle={captionPreset} fps={fps} itemStartMs={item.startMs} />`
   - Note: CaptionItem prop can stay named `captionStyle` for now — it receives the preset data either way. The internal rename happens in Task 6.

- [ ] **Step 5: Verify build**

Run: `cd packages/sandbox && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/sandbox/src/tools/manifest-ops.ts packages/sandbox/template/src/PlayerComposition.tsx
git commit -m "feat(sandbox): rename updateCaptionStyle → updateCaptionPreset, update generateCaptions, PlayerComposition reads captionPreset"
```

---

### Task 6: Renderer — Word Role Resolution

**Files:**
- Modify: `packages/sandbox/template/src/items/CaptionItem.tsx`

- [ ] **Step 1: Update CaptionWord interface**

Add `role` field, keep `classification` for backwards compat:

```typescript
interface CaptionWord {
  text: string;
  startMs: number;
  endMs: number;
  role?: string;
  classification?: 'power' | 'medium' | 'filler';  // deprecated, use role
  styleOverrides?: Record<string, unknown>;           // deprecated
}
```

- [ ] **Step 2: Add WordRoleStyle resolution**

Update the CaptionItem render to resolve each word individually:

```tsx
const captionPreset = captionStyle; // prop name may still be captionStyle from PlayerComposition

// Resolve role for a word (role field, or fallback to classification)
const getWordRole = (word: CaptionWord): string | undefined => {
  return word.role || word.classification || undefined;
};

// Resolve style for a word based on its role
const resolveWordStyle = (word: CaptionWord) => {
  const role = getWordRole(word);
  const roleStyle = role ? captionPreset.wordEmphasis?.roles?.[role] : undefined;
  return {
    fontFamily: roleStyle?.fontFamily ?? captionPreset.fontFamily ?? 'Inter',
    fontSize: roleStyle?.fontSize ?? captionPreset.fontSize ?? 56,
    fontWeight: roleStyle?.fontWeight ?? captionPreset.fontWeight ?? 800,
    color: roleStyle?.activeColor ?? roleStyle?.color ?? captionPreset.activeColor ?? captionPreset.color ?? '#FFD700',
    letterSpacing: roleStyle?.letterSpacing ?? captionPreset.letterSpacing,
    textTransform: roleStyle?.textTransform ?? captionPreset.textTransform,
    lineHeight: captionPreset.lineHeight,
    scale: roleStyle?.scale,
    emphasisBg: roleStyle?.emphasisBg,
  };
};
```

- [ ] **Step 3: Render words individually**

Replace the single `<span>` with per-word spans:

```tsx
return (
  <div style={positionStyles} data-caption-overlay>
    {activeWords.map((word, i) => {
      const ws = resolveWordStyle(word);
      return (
        <span
          key={i}
          style={{
            fontFamily: ws.fontFamily,
            fontSize: ws.fontSize,
            fontWeight: ws.fontWeight,
            color: ws.color,
            letterSpacing: ws.letterSpacing,
            textTransform: ws.textTransform as any,
            lineHeight: ws.lineHeight,
            transform: ws.scale && ws.scale !== 1 ? `scale(${ws.scale})` : undefined,
            display: 'inline-block',
            backgroundColor: ws.emphasisBg ?? (captionPreset.activeBackgroundColor ?? 'transparent'),
            padding: captionPreset.backgroundPadding
              ? `${captionPreset.backgroundPadding.y}px ${captionPreset.backgroundPadding.x}px`
              : undefined,
            borderRadius: captionPreset.backgroundRadius,
          }}
        >
          {word.text}{i < activeWords.length - 1 ? ' ' : ''}
        </span>
      );
    })}
  </div>
);
```

- [ ] **Step 4: Verify the sandbox template builds**

Run: `cd packages/sandbox/template && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/sandbox/template/src/items/CaptionItem.tsx
git commit -m "feat(renderer): per-word rendering with role resolution"
```

---

### Task 7: StylePanel — Simplify

**Files:**
- Modify: `apps/web/src/features/editor-v2/panels/StylePanel.tsx`

- [ ] **Step 1: Remove tabs system**

The current panel has 4 tabs: `templates`, `font`, `position`, `transitions`. Remove the `position` and `transitions` tabs entirely. Merge `templates` and `font` into a single scrollable panel.

Remove the `topTab` state and tab buttons. The panel becomes:
1. Preset picker grid (top)
2. Display mode + words per phrase
3. Typography controls (font family, size, weight, letter spacing, text transform, line height)
4. Colors (text, active, background, active background)
5. Background (padding, radius)

- [ ] **Step 2: Update preset picker to use curated presets**

Replace category filter tabs with a simple grid of 9 presets. Remove all references to `PRESET_CATEGORIES`, `getPresetsByCategory`, and `PresetCategory`.

Show `supportedModes` under each preset card (subtle chips showing e.g. "W·P·K" for word-by-word, phrase, karaoke).

- [ ] **Step 3: Fix applyPreset function**

Replace the current broken `applyPreset` with:

```typescript
const applyPreset = (preset: SubtitlePreset) => {
  const fontEntry = findFont(preset.fontFamily.split(',')[0].trim());
  if (fontEntry) loadFont(fontEntry);

  updateCaptionPreset({
    presetId: preset.id,
    fontFamily: preset.fontFamily,
    fontSize: preset.fontSize,
    fontWeight: preset.fontWeight,
    letterSpacing: preset.letterSpacing ?? 0,
    textTransform: preset.textTransform ?? 'none',
    opacity: preset.opacity ?? 1,
    lineHeight: preset.lineHeight ?? 1.4,
    color: preset.color,
    activeColor: preset.activeColor,
    backgroundColor: preset.backgroundColor,
    activeBackgroundColor: preset.activeBackgroundColor,
    stroke: preset.stroke ?? null,
    textShadow: preset.textShadow,
    textStroke: preset.textStroke,
    effects: preset.effects ?? { shadow: null, shadowSecondary: null, glow: null },
    backgroundPadding: preset.backgroundPadding,
    backgroundRadius: preset.backgroundRadius,
    animation: preset.animation,
    displayMode: preset.supportedModes[0], // Default mode for the preset
    wordsPerPhrase: preset.wordsPerPhrase ?? 5,
  });
};
```

- [ ] **Step 4: Wire display mode picker to supportedModes**

The display mode dropdown should only show modes from the active preset's `supportedModes`:

```typescript
const activePreset = style.presetId ? SUBTITLE_PRESETS[style.presetId] : null;
const availableModes = activePreset?.supportedModes ?? ['word-by-word', 'phrase', 'karaoke'];
```

- [ ] **Step 5: Update all style reads to use store.captionPreset**

Replace `const style = firstCaptionItem?.data?.style` pattern with reading from the store's `captionPreset`:

```typescript
const captionPreset = useEditorStore((s) => s.captionPreset);
```

All `updateStyle()` / `customizeStyle()` calls become `updateCaptionPreset()`.

- [ ] **Step 6: Remove effects, stroke, opacity, position, and transitions sections**

Delete the following UI sections:
- Effects section (shadow, secondary shadow, glow editors)
- Text stroke section
- Position tab content
- Transitions tab content
- Opacity slider
- "Apply to selected only" toggle

- [ ] **Step 7: Remove dynamic-hierarchy references**

Remove any code that handles the `dynamic-hierarchy` display mode or dispatches `generateCaptionStyles`. Remove the AI styling status state (`aiStylingStatus`, `aiStylingJobId`).

- [ ] **Step 8: Verify build**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/features/editor-v2/panels/StylePanel.tsx
git commit -m "feat: simplify StylePanel — curated presets, remove position/animation/effects"
```

---

### Task 8: CaptionDragOverlay + Click Fix Cleanup

**Files:**
- Modify: `apps/web/src/features/editor-v2/components/CaptionDragOverlay.tsx`

- [ ] **Step 1: Update imports**

Replace `updateAllCaptionStyles` / `updateSelectedCaptionStyles` imports with `updateCaptionPreset` from the store.

- [ ] **Step 2: Replace getCaptionStyle() with store read**

The `getCaptionStyle()` function (line 166-173) reads from `(selected.data as CaptionItemData).style` which no longer exists. Replace it with a direct store read:

```typescript
const getCaptionStyle = useCallback((): CaptionStyle => {
  return useEditorStore.getState().captionPreset;
}, []);
```

This is simpler and always returns a valid style (never null).

- [ ] **Step 3: Verify updateStyle uses global path**

The `updateStyle` callback should already be:
```typescript
const updateStyle = useCallback(
  (updates: Partial<CaptionStyle>) => {
    updateCaptionPreset(updates);
  },
  [updateCaptionPreset]
);
```

If it still references `updateAllCaptionStyles`, change it.

- [ ] **Step 4: Verify click stopPropagation is in place**

Confirm the bounding box div and hover zone div both have `onClick={(e) => e.stopPropagation()}`. These were added earlier in this session — verify they survived.

- [ ] **Step 5: Verify build**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/editor-v2/components/CaptionDragOverlay.tsx
git commit -m "fix: CaptionDragOverlay uses updateCaptionPreset, click propagation fixed"
```

---

### Task 9: Integration Verification

**Files:**
- Verify/Fix: `packages/sandbox/template/src/composition/AnimatedSubtitle.tsx`
- Verify/Fix: all files modified in Tasks 1-8

- [ ] **Step 1: Update AnimatedSubtitle.tsx**

In `packages/sandbox/template/src/composition/AnimatedSubtitle.tsx` (~750 lines):
1. Remove `dynamic-hierarchy` from the display mode handling (any switch/case or if-else that handles this mode)
2. Update any references to `captionStyle` prop to also accept `captionPreset` shape
3. The `classifyWordTier()` function stays as a runtime fallback when `word.role` is not set — no changes needed there
4. Verify it reads `word.role ?? word.classification` for role resolution

This file is the full-featured renderer used by scene compositions. While `CaptionItem.tsx` (Task 6) is the main manifest-driven path, `AnimatedSubtitle.tsx` must also be updated to avoid runtime errors when `dynamic-hierarchy` is referenced.

- [ ] **Step 2: Full build check**

```bash
cd /c/Users/armaa/Documents/cllipify
npx tsc --noEmit --project apps/web/tsconfig.json
cd packages/shared && npx tsc --noEmit
cd ../sandbox && npx tsc --noEmit
cd template && npx tsc --noEmit
```

All should PASS.

- [ ] **Step 3: Search for stale references**

Search the entire codebase for remaining references to old names:
- `captionStyle` (in manifest context — store variable names are OK, but manifest schema fields, PlayerComposition, and sandbox tools should use `captionPreset`)
- `updateAllCaptionStyles`
- `updateSelectedCaptionStyles`
- `update_caption_style` (should only exist as deprecated alias in `manifest-ops.ts`)
- `dynamic-hierarchy` (should be removed everywhere)
- `updateCaptionStyleTool` (should be renamed)
- `SandboxOp` tool `'updateCaptionStyle'` (should be `'updateCaptionPreset'`)

Fix any stale references.

- [ ] **Step 3: Verify the editor loads**

Start the dev server (`npm run dev` or equivalent) and open the editor. Verify:
1. Preset picker shows 9 presets
2. Clicking a preset applies it (captions change in preview)
3. Display mode dropdown shows only supported modes for active preset
4. Font size slider works
5. Color pickers work
6. Caption drag/position works in preview
7. No console errors about "Item not found"

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve stale references from caption preset migration"
```
