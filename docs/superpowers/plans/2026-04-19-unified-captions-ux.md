# Unified Captions UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user edit caption *styling* on the left and caption *text* on the right simultaneously — no more tab flipping between "Captions" (transcript) and "Styles".

**Architecture:** Keep the existing `StylePanel` (global caption styling) and `TranscriptPanel` (word-level editing + bulk actions) unchanged in capability. Move the transcript editor from the left sidebar's "Captions" tab to the right properties panel. Collapse the left `style` tab into a single renamed `captions` tab that hosts `StylePanel`. Selecting a caption — or sitting on the unified left tab with no selection — auto-opens both panels.

**Tech Stack:** React + Zustand store (existing editor-v2), Tailwind, lucide-react icons, framer-motion animations.

---

## File Structure

**Modified:**
- `apps/web/src/features/editor-v2/Editor.tsx` — tab state, icon rail, auto-open rules, right-panel content switching
- `apps/web/src/features/editor-v2/components/RightPanel.tsx` — gains a `view: 'inspector' | 'transcript'` prop
- `apps/web/src/features/editor-v2/panels/TranscriptPanel.tsx` — minor polish for right-panel context (already has bulk actions + find/replace, no structural rewrite)
- `apps/web/src/features/editor-v2/timeline/context-menu/ContextMenu.tsx` — rename the `viona:caption-edit-style` handler to land on the new unified tab (if needed)

**Not modified (verified):**
- `apps/web/src/features/editor-v2/panels/StylePanel.tsx` — already reads `selectedIds.length > 0 ? 'editing N selected' : 'editing all captions'`; no-selection = all-selected behavior already correct
- Store (`editor-store.ts`), manifest-bridge, manifest-dispatch — no changes

---

## Task 1: Rename left tab id `style` → `captions`, drop the old transcript tab from the icon rail

**Files:**
- Modify: `apps/web/src/features/editor-v2/Editor.tsx`

**Goal:** The icon rail should show three non-agent tabs: `agent`, `captions` (was `style`), `assets`. The old transcript tab goes away. Internal tab id aligns with the label.

- [ ] **Step 1: Update the `leftSidebarTab` state type**

In `Editor.tsx` around line 62, change:

```tsx
const [leftSidebarTab, setLeftSidebarTab] = useState<'captions' | 'style' | 'assets' | 'agent'>('agent');
```

to:

```tsx
const [leftSidebarTab, setLeftSidebarTab] = useState<'captions' | 'assets' | 'agent'>('agent');
```

- [ ] **Step 2: Update the icon rail array + labels**

In `Editor.tsx` around lines 667–700, change the tab array and the `icons`/`labels` maps:

```tsx
{(['agent', 'captions', 'assets'] as const).map((tab) => {
  const icons = { agent: MessageSquareText, captions: Captions, assets: FolderOpen };
  const labels = { agent: 'Chat', captions: 'Captions', assets: 'Assets' };
  // …rest unchanged
```

Remove the `style: Paintbrush` / `style: 'Style'` entries. The `Paintbrush` import in the file header may no longer be needed — remove it if unused. Keep `Captions` from lucide-react.

- [ ] **Step 3: Make the `captions` tab render `StylePanel` (not the embedded RightPanel)**

In `Editor.tsx` around lines 749–780, replace the inner `{leftSidebarTab === 'captions' && ( … RightPanel embedded … )}` block AND the `{leftSidebarTab === 'style' && ( … StylePanel … )}` block with a single:

```tsx
{leftSidebarTab === 'captions' && (
  <ErrorBoundary name="Caption Settings">
    <Suspense fallback={<div className="flex items-center justify-center h-full"><span className="text-zinc-500 text-sm">Loading...</span></div>}>
      <StylePanel />
    </Suspense>
  </ErrorBoundary>
)}
```

Also update the header label in the same area (lines 735–740):

```tsx
<h3 className="text-xs font-normal text-[var(--editor-text-muted)] uppercase tracking-wide">
  {leftSidebarTab === 'captions' && 'Caption Settings'}
  {leftSidebarTab === 'assets' && 'Visual Assets'}
</h3>
```

(Drop the `'Style Settings'` row.)

- [ ] **Step 4: Update the custom-event handlers for the new tab id**

In `Editor.tsx` around lines 245–266, both `handleEditText` and `handleEditStyle` currently set different tabs. After the merge they land on the same tab:

```tsx
const handleEditText = (e: Event) => {
  const detail = (e as CustomEvent<{ captionId: string }>).detail;
  if (!detail?.captionId) return;
  setLeftSidebarTab('captions');
  setLeftSidebarOpen(true);
  useEditorStore.getState().select([detail.captionId], 'replace');
};
const handleEditStyle = (e: Event) => {
  const detail = (e as CustomEvent<{ captionId: string }>).detail;
  if (!detail?.captionId) return;
  setLeftSidebarTab('captions');
  setLeftSidebarOpen(true);
  useEditorStore.getState().select([detail.captionId], 'replace');
};
```

- [ ] **Step 5: Update the auto-switch-on-caption-select effect**

In `Editor.tsx` around lines 414–423, replace:

```tsx
useEffect(() => {
  if (selectedIds.length === 1 && leftSidebarTab !== 'captions') {
    const state = useEditorStore.getState();
    const item = state.items[selectedIds[0]];
    if (item?.type === 'caption') {
      setLeftSidebarOpen(true);
      setLeftSidebarTab('style');
    }
  }
}, [selectedIds, leftSidebarTab]);
```

with:

```tsx
// When any caption gets selected from the timeline/preview, auto-open the
// Captions settings tab on the left. The right-side transcript editor opens
// through its own effect (Task 2), so the user lands with both panels visible.
useEffect(() => {
  if (selectedIds.length === 0) return;
  const state = useEditorStore.getState();
  const hasCaption = selectedIds.some((id) => state.items[id]?.type === 'caption');
  if (hasCaption && leftSidebarTab !== 'captions' && leftSidebarTab !== 'agent') {
    setLeftSidebarOpen(true);
    setLeftSidebarTab('captions');
  }
}, [selectedIds, leftSidebarTab]);
```

The `leftSidebarTab !== 'agent'` guard keeps the agent chat panel visible when the user is in an AI conversation — don't yank them out of it mid-message.

- [ ] **Step 6: Build + manual smoke test**

Run `npm run dev` (or existing dev script) in `apps/web`. Open a project, click through each icon-rail tab, confirm:
- 3 non-agent tabs are visible: Chat, Captions, Assets
- Clicking Captions opens StylePanel (the preset picker grid you already use)
- No "Style" tab or separate transcript tab exists
- No console errors

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/editor-v2/Editor.tsx
git commit -m "refactor(editor): collapse style+captions left tabs into unified 'Captions' tab"
```

---

## Task 2: Give `RightPanel` a `view` prop and render `TranscriptPanel` in caption-editing mode

**Files:**
- Modify: `apps/web/src/features/editor-v2/components/RightPanel.tsx`
- Modify: `apps/web/src/features/editor-v2/Editor.tsx`

**Goal:** The right properties panel is the new home for the transcript editor. It switches between `ItemInspector` (non-caption selection) and `TranscriptPanel` (caption editing mode) based on a prop.

- [ ] **Step 1: Add a `view` prop to `RightPanel`**

In `RightPanel.tsx`, extend the props type:

```tsx
export type RightPanelTab = 'properties' | 'transcript' | 'item-properties';

interface RightPanelProps {
  isOpen: boolean;
  activeTab: RightPanelTab;
  onTabChange: (tab: RightPanelTab) => void;
  onClose: () => void;
  layout?: 'stacked' | 'side-by-side';
  embedded?: boolean;
  view?: 'inspector' | 'transcript';
}
```

- [ ] **Step 2: Conditionally render `TranscriptPanel` or `ItemInspector`**

Replace the current main-content block (lines ~63–67 of `RightPanel.tsx`) with:

```tsx
{/* Content */}
<div className="flex-1 overflow-y-auto scrollbar-hide">
  {view === 'transcript' ? (
    <TranscriptPanel />
  ) : (
    <>
      <ItemInspector />
      <KeyframeEditor />
    </>
  )}
</div>
```

`TranscriptPanel` is already imported at the top of the file. Default `view` to `'inspector'` when omitted so existing callers keep their current behavior.

- [ ] **Step 3: Widen the right panel when showing the transcript**

Still in `RightPanel.tsx`, the current non-side-by-side wrapper hardcodes `width: 320`. The transcript view needs more room. Change the wrapper to:

```tsx
<div
  className={isSideBySide
    ? "w-full h-full overflow-hidden bg-[var(--editor-bg-surface)]"
    : "flex-shrink-0 overflow-hidden editor-panel"
  }
  style={isSideBySide ? undefined : {
    width: isOpen ? (view === 'transcript' ? 420 : 320) : 0,
    transition: 'width 150ms ease-out',
  }}
>
  <div className={isSideBySide ? "w-full h-full flex flex-col" : "h-full flex flex-col"} style={isSideBySide ? undefined : { width: view === 'transcript' ? 420 : 320 }}>
```

(The inner `w-80` fixed-width class has to go so the width respects `view`.)

- [ ] **Step 4: Update `Editor.tsx` to open the right panel in transcript mode**

In `Editor.tsx`, update the panel-open effect (lines ~136–161) so caption selection (or unified-captions-tab-with-no-selection) opens the right panel in transcript view:

```tsx
useEffect(() => {
  if (selectedIds.length > 0) {
    const state = useEditorStore.getState();
    const allCaptions = selectedIds.every((id) => state.items[id]?.type === 'caption');
    // Caption selection now opens the right panel (transcript editor),
    // not hides it like before.
    setPanelOpen(true);

    if (selectedIds.length === 1) {
      const item = state.items[selectedIds[0]];
      if (item) {
        const currentMs = state.currentTimeMs;
        const isAlreadyOnItem = currentMs >= item.startMs && currentMs <= item.endMs;
        if (!isAlreadyOnItem) {
          const midpoint = Math.round((item.startMs + item.endMs) / 2);
          state.seek(midpoint);
        }
      }
    }
    // suppress unused-var lint for `allCaptions`
    void allCaptions;
  } else {
    // No selection — open the right panel only when the user is in the
    // unified Captions tab (they're "editing captions"; treat all as selected).
    setPanelOpen(leftSidebarTab === 'captions');
  }
}, [selectedIds, leftSidebarTab]);
```

- [ ] **Step 5: Pass the right `view` to `RightPanel`**

At the bottom of `Editor.tsx` (around lines 856–863), wherever `RightPanel` is rendered, derive the view from state and pass it:

```tsx
{panelOpen && (() => {
  const state = useEditorStore.getState();
  const anyCaptionSelected =
    selectedIds.length > 0 &&
    selectedIds.some((id) => state.items[id]?.type === 'caption');
  const noSelectionOnCaptionsTab =
    selectedIds.length === 0 && leftSidebarTab === 'captions';
  const view: 'inspector' | 'transcript' =
    anyCaptionSelected || noSelectionOnCaptionsTab ? 'transcript' : 'inspector';
  return (
    <RightPanel
      isOpen={panelOpen}
      activeTab="item-properties"
      onTabChange={handleTabChange}
      onClose={handleClosePanel}
      view={view}
    />
  );
})()}
```

(If you prefer not to use an IIFE, hoist the derivation into a `useMemo` above the return.)

- [ ] **Step 6: Manual smoke test**

- Open a project in the editor with existing captions.
- Click a caption in the timeline → left "Captions" tab opens on the left AND right panel opens with transcript editor.
- Click the empty letterbox area around the preview → selection clears, right panel stays open iff the Captions tab is active on the left.
- Click the Assets tab → left switches, right panel closes (no caption context).
- Click Captions tab with no selection → both panels visible, transcript on right listing all captions.
- Click a non-caption item (e.g., a visual) → right panel shows ItemInspector (not transcript).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/editor-v2/components/RightPanel.tsx apps/web/src/features/editor-v2/Editor.tsx
git commit -m "feat(editor): host transcript editor in right panel; unified caption editing surface"
```

---

## Task 3: Drop the dead left-side transcript path & legacy `RightPanel embedded` usage

**Files:**
- Modify: `apps/web/src/features/editor-v2/components/RightPanel.tsx`

**Goal:** After Task 1 the `embedded={true}` + `activeTab="transcript"` invocation of `RightPanel` no longer has any caller. Remove the dead branch so future readers don't trip on it.

- [ ] **Step 1: Remove the `embedded` branch from `RightPanel`**

In `RightPanel.tsx`, delete lines ~28–36:

```tsx
if (embedded) {
  return (
    <div className="flex-1 overflow-y-auto -mx-4 -mt-3">
      <TranscriptPanel />
    </div>
  );
}
```

Also remove `embedded?: boolean` from the props interface and the destructuring. Keep the `TranscriptPanel` import — it's still used by the transcript view.

- [ ] **Step 2: Verify no external callers**

```bash
grep -rn "embedded" apps/web/src/features/editor-v2
```

Expected: no hits referencing this prop after the delete. If any show up, update them.

- [ ] **Step 3: Build + confirm no TS errors**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: clean (or pre-existing errors only — diff against main if uncertain).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/editor-v2/components/RightPanel.tsx
git commit -m "refactor(editor): drop embedded-mode RightPanel branch; no callers after unification"
```

---

## Task 4: Polish `TranscriptPanel` for its new right-panel home

**Files:**
- Modify: `apps/web/src/features/editor-v2/panels/TranscriptPanel.tsx`

**Goal:** The panel already has bulk actions and find/replace, but it was designed for a 488px embedded container. At 420px on the right it needs a quick pass for compact layout and to expose "Apply to all" affordances clearly when no selection exists.

- [ ] **Step 1: Audit the current TranscriptPanel for width-sensitive layout**

Open `TranscriptPanel.tsx`. Look for:
- Fixed `min-w-*` values that exceed 420px on row action clusters
- Horizontal action rows with `gap-4` or larger that could crowd at 420
- Any `w-[...]` that would overflow

List the specific classes to change. If none found, skip to Step 3.

- [ ] **Step 2: Tighten spacing where needed**

For any over-wide element found in Step 1, reduce `gap-*` / padding by one Tailwind step. Keep row-level hover actions (merge↑ / split / merge↓ / delete) visible. Do not change interaction logic.

- [ ] **Step 3: Confirm the "editing all captions" state is self-evident**

Near the top of the panel, when `selectedIds.length === 0`, show a thin explanatory line — e.g.:

```tsx
{selectedIds.length === 0 && (
  <div className="px-3 pt-2 text-[10px] text-[var(--editor-text-muted)] uppercase tracking-wide">
    Editing all {captionItems.length} captions
  </div>
)}
```

Place it above the existing search/action bar. This makes the "no selection = all selected" rule visible to the user.

- [ ] **Step 4: Manual smoke test**

- Open the right panel in transcript view at 420px width.
- No row content overflows or clips.
- "Editing all N captions" line appears when nothing is selected; disappears on selection.
- Find/replace, merge, split, delete all still work from the narrower width.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/editor-v2/panels/TranscriptPanel.tsx
git commit -m "ui(editor): tighten TranscriptPanel for right-panel width; surface 'editing all' state"
```

---

## Task 5: Audit context-menu event dispatchers for the renamed tab id

**Files:**
- Modify (if needed): `apps/web/src/features/editor-v2/timeline/context-menu/ContextMenu.tsx`

**Goal:** The timeline right-click menu dispatches `viona:caption-edit-text` and `viona:caption-edit-style` window events. After the tab rename both land on the unified `captions` tab (Task 1 Step 4). Confirm the consumer side still reacts correctly; collapse the two menu entries to one "Edit caption" entry if they now do the same thing.

- [ ] **Step 1: Inspect the context menu's caption-item branch**

```bash
grep -n "viona:caption-edit" apps/web/src/features/editor-v2/timeline/context-menu/ContextMenu.tsx
```

Read the dispatching sites. If both events now set the same tab and select the same caption, one of the two menu items is redundant.

- [ ] **Step 2: Decide: keep two entries or collapse to one**

Option A (collapse — recommended): the menu shows "Edit caption" which dispatches `viona:caption-edit-text` (Editor.tsx handler already selects the caption and opens both panels). Drop the "Edit style" entry.

Option B (keep both): retain "Edit text" and "Edit style" as separate entries for affordance. They behave identically in terms of tab activation, but "Edit text" could additionally focus the target row in TranscriptPanel (already handled by that component's listener). Leave both.

Pick one based on menu density. If unsure, keep both (lowest-risk).

- [ ] **Step 3: Apply the change**

If you chose A, remove the "Edit Style" menu item and the `viona:caption-edit-style` dispatch. If you chose B, no code change — but verify the "Edit text" path in the TranscriptPanel listener still wakes up edit mode on the row.

- [ ] **Step 4: Manual smoke test**

Right-click a caption in the timeline → menu appears → clicking the edit entry opens left + right panels with the correct caption selected and, for "Edit text", the row in edit mode.

- [ ] **Step 5: Commit (only if code changed)**

```bash
git add apps/web/src/features/editor-v2/timeline/context-menu/ContextMenu.tsx
git commit -m "ui(timeline): collapse caption context-menu edit entries under unified captions surface"
```

If no code changed, skip this step.

---

## Task 6: End-to-end smoke pass

- [ ] **Step 1: Exercise the full flow**

With a project that has captions loaded:

1. Open the editor. Default left tab = Chat (agent). Right panel closed.
2. Click the Captions icon on the left rail → StylePanel opens on the left, transcript (all captions) opens on the right. "Editing all N captions" line is visible.
3. Click a single caption in the preview or timeline → left stays on Captions, right stays on transcript (now highlighting the selected row). Style edits on the left still apply to preset (the existing "Editing N selected" indicator in StylePanel flips to show the selection count).
4. Drag a caption in the preview → works as before; preset vs per-item override logic unchanged.
5. Right-click a caption → context-menu edit action lands on the unified surface.
6. Click a non-caption timeline item → left stays where it was (Captions, or wherever), right switches to ItemInspector.
7. Click empty preview letterbox → selection clears. If left tab was Captions, right panel stays in transcript mode (no selection = all selected). If left tab was Assets or Chat, right panel closes.
8. Switch to Assets tab with captions selected → left switches; right stays in transcript view (caption selection still active).
9. Clear selection while on Assets tab → right closes.

- [ ] **Step 2: Fix anything that surprises you**

If any of the steps above diverges from the plan's mental model, note the divergence, fix it in the owning file from Task 1–5, and re-run the affected step.

- [ ] **Step 3: Final commit (only if fixes were needed)**

```bash
git add -A
git commit -m "fix(editor): end-to-end smoke fixes for unified captions UX"
```

---

## Self-Review Notes

**Spec coverage:**
- Left tab rename + removal: Task 1 ✔
- Transcript moves to right: Task 2 ✔
- No-selection = all-selected (right panel opens on unified left tab with no selection): Task 2 Step 4 ✔
- Context-menu consistency: Task 5 ✔
- Dead path cleanup: Task 3 ✔

**Non-goals (deliberately out of scope):**
- Adding a standalone "Generate captions" button — StylePanel's existing "no captions → auto-generate on preset pick" flow is left intact. A future plan can add an explicit button if the user asks.
- Rewriting TranscriptPanel structurally — it already has bulk actions, find/replace, and row-level merge/split that satisfy the requirement.
- ⌘F global palette for find/replace — transcript's own search bar is sufficient in the new home.

**Risk:** The width change on `RightPanel` (320 → 420 for transcript view) may conflict with narrower viewports. If the preview gets uncomfortably squeezed, make the 420 conditional on viewport width (≥1280px) in a follow-up; keep 420 for now on the assumption of desktop-first users.
