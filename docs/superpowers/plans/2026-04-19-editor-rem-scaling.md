# Editor Density & Rem Scaling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the editor at 100 % browser zoom look the same density the user currently gets at ~70 % zoom, using `rem` everywhere so density stays consistent across zoom levels, display DPIs, and viewport sizes.

**Architecture:** The editor already uses Tailwind utilities (which are rem-internal) plus a mix of hardcoded `px` values in CSS variables and inline styles. We reduce the `html` root font-size **only while the editor is mounted** (scoped to `<html class="editor-density">` toggled by `Editor.tsx` on mount/unmount), which shrinks every rem-based token — every `text-xs`, `p-4`, `gap-2`, `h-10`, etc. — proportionally. Then we convert the remaining hardcoded px values (panel widths, CSS variables) to rem so they participate in the same scaling. The base is exposed as a CSS variable so you can tune density and optionally make it viewport-responsive via `clamp()` later.

**Tech Stack:** CSS (globals.css), React (Editor.tsx mount/unmount hook), Tailwind utility classes (unchanged — they auto-scale with root font-size), existing `editor-panel` / `editor-theme` CSS class system.

---

## Key Concept: Why Root `font-size` (Not Component-Local)

Tailwind compiles `p-4` to `padding: 1rem` and `text-xs` to `font-size: 0.75rem`. `rem` is always resolved against `html`'s font-size, not any intermediate ancestor. So `html.editor-density { font-size: 13px; }` instantly shrinks every rem-based utility inside the editor by ~19 %. A class on `body` or `.editor-theme` does **nothing** to rem — only changes `em` and inherited text size. This is the only root-level change that produces uniform scaling without rewriting Tailwind classes.

Choice of base: **13 px** as the starting point (81.25 % of 16). That's denser than the current 100 % zoom but not as cramped as 70 % (≈11.2 px) in practice — the other 10 % gap comes from OS DPI. Task 4 tunes the final value; 12 px–14 px are all reasonable. The variable is exposed so later adjustment is one line.

---

## File Structure

**Modified:**
- `apps/web/src/app/globals.css` — add `html.editor-density` rule + convert editor CSS variables (gap, radius, shadow offsets) from px to rem
- `apps/web/src/features/editor-v2/Editor.tsx` — add `useEffect` that toggles `document.documentElement.classList` on mount/unmount; convert the three hardcoded panel-width `style={{ width: N }}` values to rem
- `apps/web/src/features/editor-v2/components/RightPanel.tsx` — convert inline `width: 320 | 420` to rem
- `apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx` — if it has a hardcoded `width: 488`, convert (audit during Task 3)
- Other editor-v2 files with inline `width:` / `height:` px (audited in Task 3 — specific list generated at task execution time)

**Not modified (out of scope, kept in px on purpose):**
- Timeline frame math (`frameWidth * zoom`, `timelineHeight` state) — pixel-exact rendering by design
- Remotion player dimensions — bound to composition width/height
- Canvas / WebGL renderer pixel values — fidelity-sensitive
- Video preview letterbox sizing — computed from composition, already fluid

---

## Task 1: Add the `editor-density` root font-size override

**Files:**
- Modify: `apps/web/src/app/globals.css`
- Modify: `apps/web/src/features/editor-v2/Editor.tsx`

**Goal:** Shrink rem globally only while the editor is mounted. Marketing pages, auth, project list keep their 16 px base.

- [ ] **Step 1: Add the CSS rule + tuning variable**

In `apps/web/src/app/globals.css`, near the top (around the existing `html { font-size: 16px; }` at line 8) or in a dedicated `/* Editor density */` block, add:

```css
:root {
  --editor-root-size: 13px;
}

html.editor-density {
  font-size: var(--editor-root-size);
}
```

Place the variable at `:root` so it's inspectable globally even when the class isn't active (easier to tune from devtools).

- [ ] **Step 2: Toggle the class on editor mount**

In `apps/web/src/features/editor-v2/Editor.tsx`, add a `useEffect` near the top of the `Editor` component body — ideally right after the existing `useEffect(() => { loadProject(projectId); }, ...)` call:

```tsx
// Scope the rem root to the editor: shrinks every Tailwind utility
// proportionally while the editor is mounted, without affecting the
// rest of the app (marketing, auth, project list).
useEffect(() => {
  document.documentElement.classList.add('editor-density');
  return () => {
    document.documentElement.classList.remove('editor-density');
  };
}, []);
```

Empty dep array is correct — the class toggles strictly on mount/unmount, not on any prop change.

- [ ] **Step 3: Verify**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: baseline 9 pre-existing errors, 0 new.

Visual smoke (manual, by you):
1. Open a project in the editor → density should visibly shrink compared to pre-change.
2. Click back to the project list (or `/upload`) → density should look unchanged at 16 px base.

If density is way too small, tune by editing the `--editor-root-size` value in globals.css (Task 4 re-tunes after Task 2 & 3 complete).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/globals.css apps/web/src/features/editor-v2/Editor.tsx
git commit -m "feat(editor): shrink rem base only while editor is mounted"
```

---

## Task 2: Convert editor CSS variables from px to rem

**Files:**
- Modify: `apps/web/src/app/globals.css`

**Goal:** Everything under `.editor-theme { --editor-*: Npx }` should be in rem so it scales with `--editor-root-size`. Currently px-valued variables don't participate in the rescaling.

- [ ] **Step 1: Convert size-class variables**

In `apps/web/src/app/globals.css`, find the `.editor-theme` block (around line 602) and convert these variables from px to rem. Formula: `N px = (N / 16) rem` — i.e., divide by 16 because rem is resolved against the current root (which will be 13 px in the editor, but the rem math stays anchored on 16, so we convert as if at 16 to preserve the current visual size, then the root override scales them all together).

Target conversions:

```css
  --editor-panel-gap: 0.25rem;      /* was 4px */
  --editor-panel-radius: 1rem;      /* was 16px */
```

For shadow offsets, box-shadow values can stay in px — shadows with small rem values look lossy at fractional values and most design systems keep them in px. Exception: leave `--editor-panel-shadow` as-is.

- [ ] **Step 2: Audit for other px-valued editor variables**

```bash
grep -n "^\s*--editor-.*: *[0-9]*px" apps/web/src/app/globals.css
```

For each hit, decide: spacing/sizing/layout → convert to rem; visual fidelity (shadow, border width) → keep px. Document the decision inline with a short comment only if the reason isn't obvious.

- [ ] **Step 3: Verify the editor still renders**

Manually open the editor (after Task 1 is landed). Panel rounding and gaps should look the same as before Task 2 at the current `--editor-root-size`. If gaps visibly shifted, a conversion was miscalculated — fix before committing.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "refactor(editor): convert editor-theme spacing tokens from px to rem"
```

---

## Task 3: Convert hardcoded inline px in editor-v2 components to rem

**Files:**
- Modify: `apps/web/src/features/editor-v2/Editor.tsx` (panel widths)
- Modify: `apps/web/src/features/editor-v2/components/RightPanel.tsx` (inspector/transcript widths)
- Modify: other editor-v2 component files found during the audit in Step 1

**Goal:** Replace `style={{ width: N }}` / `style={{ minWidth: "34px" }}` / similar numeric px with rem values (or CSS variables that evaluate to rem) so they scale with the editor root.

### Step 1: Audit

- [ ] **Run the audit query**

```bash
grep -rn "width:\s*[0-9]" apps/web/src/features/editor-v2 --include="*.tsx"
grep -rn "height:\s*[0-9]" apps/web/src/features/editor-v2 --include="*.tsx"
grep -rn "minWidth:\s*['\"][0-9]" apps/web/src/features/editor-v2 --include="*.tsx"
grep -rn "minHeight:\s*['\"][0-9]" apps/web/src/features/editor-v2 --include="*.tsx"
```

This produces a list of ~80 hits. Categorize each as:
- **Convert:** user-facing chrome sizes (panel widths, toolbar heights, sidebar widths, icon sizes)
- **Keep px:** timeline frame math (pixel per frame), Remotion dimensions, canvas/WebGL renderer, video preview dimensions, resize-handle drag math (user sees a cursor, the math is pixel-native)

Flag each hit in your notes before editing.

### Step 2: Convert the known big ones

- [ ] **In `Editor.tsx`:** Panel width inline styles. Three sites use numeric values for panel sizes:

```tsx
// AI Assistant Panel wrapper:
style={{
  width: leftSidebarOpen && leftSidebarTab === 'agent' ? 488 : 0,
  ...
}}
```

Change to:

```tsx
style={{
  width: leftSidebarOpen && leftSidebarTab === 'agent' ? '30.5rem' : 0,
  ...
}}
```

And the framer-motion `animate={{ width: 488 }}` for the other left-sidebar panels — change to `animate={{ width: '30.5rem' }}` (framer-motion accepts string rem values).

Timeline height `[timelineHeight, setTimelineHeight] = useState(250)` plus the resize-start handler: **keep in px**. This is user-dragged math; converting mid-drag is painful and not user-visible in any density-relevant way. Add a one-line comment acknowledging this is intentional.

- [ ] **In `RightPanel.tsx`:** Convert the `320`/`420` numeric widths:

```tsx
style={isSideBySide ? undefined : {
  width: isOpen ? (view === 'transcript' ? 420 : 320) : 0,
  transition: 'width 150ms ease-out',
}}
```

to:

```tsx
style={isSideBySide ? undefined : {
  width: isOpen ? (view === 'transcript' ? '26.25rem' : '20rem') : 0,
  transition: 'width 150ms ease-out',
}}
```

(420/16 = 26.25; 320/16 = 20.)

### Step 3: Convert remaining audit hits

- [ ] **For each audit hit flagged "convert":** change the numeric value to a rem string. Standard conversion `Npx = (N/16)rem`. Examples:
  - `width: 56` → `width: '3.5rem'` (icon rail — already Tailwind `w-14`, so likely no hit; if an inline style exists, convert)
  - `minWidth: '34px'` → `minWidth: '2.125rem'`
  - `height: 10` → `height: '0.625rem'`

Keep commits reasonably small — if the audit produces more than ~10 sites, split the conversion into two or three commits by area (e.g., one commit for panels, one for toolbar, one for inspector). Aim for commits that are easy to review and revert.

### Step 4: Verify

- [ ] **Type-check**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: 0 new errors.

- [ ] **Visual spot check**

With Task 1 already landed and `--editor-root-size: 13px`, every converted site should now be visually smaller than pre-Task-1 at the same browser zoom. Because Task 1 and Task 3 combined make the whole editor ~19 % smaller at default zoom.

### Step 5: Commit

- [ ] **Commit each bundle**

```bash
git add apps/web/src/features/editor-v2/Editor.tsx apps/web/src/features/editor-v2/components/RightPanel.tsx
git commit -m "refactor(editor): convert panel width inline styles from px to rem"
```

For subsequent audit-result bundles, similarly scoped commits.

---

## Task 4: Tune the density base to feel right

**Files:**
- Modify (maybe): `apps/web/src/app/globals.css`

**Goal:** 13 px was the starting guess. Adjust to taste.

- [ ] **Step 1: Load the editor, compare to the "70 % zoom looked good" baseline**

With browser at 100 % zoom, does the editor now look "about the same density" as it did at 70 % zoom pre-change? If yes, skip the tune. If too cramped, bump `--editor-root-size` up. If still too big, bump down.

Typical tuning values to try in order:
- 13 px (current)
- 12.5 px (a bit denser)
- 13.5 px (a bit roomier)
- 14 px (closer to native 16 but still denser than pre-change)
- 12 px (as dense as most productivity IDEs)

Change is one variable, takes under 5 seconds per iteration:

```css
:root {
  --editor-root-size: 12.5px;
}
```

- [ ] **Step 2: Freeze the value**

Once happy with density, lock the number.

- [ ] **Step 3: Commit (only if changed from 13 px)**

```bash
git add apps/web/src/app/globals.css
git commit -m "chore(editor): tune rem base density to Npx"
```

---

## Task 5 (optional): Responsive density via clamp()

**Files:**
- Modify: `apps/web/src/app/globals.css`

**Goal:** Make `--editor-root-size` fluid across viewport widths so users on very large or very small displays get density-appropriate rendering without any JavaScript.

Skip this task if Task 4's fixed value feels good on the target displays.

- [ ] **Step 1: Replace the fixed base with clamp()**

```css
:root {
  --editor-root-size: clamp(12px, 0.7rem + 0.2vw, 15px);
}
```

Breakdown:
- Minimum 12 px on tiny laptop screens
- Scales with viewport: 0.7 rem base + 0.2 % of viewport width
- Maximum 15 px on 4 K displays

Adjust the three `clamp` values if the scaling feels too aggressive or too flat.

- [ ] **Step 2: Smoke at multiple widths**

Resize the browser window to 1280, 1440, 1920, 2560, 3840 px wide. Confirm density feels appropriate at each.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "feat(editor): make editor rem base viewport-responsive via clamp()"
```

---

## Task 6: End-to-end smoke pass

- [ ] **Step 1: Test all editor surfaces at 100 % browser zoom**

1. Icon rail (left) — buttons comfortable, labels readable
2. Left sidebar at each tab (Chat, Captions, Assets) — panels visually balanced
3. Preview + controls — video readable, playbar controls clickable
4. Timeline — tracks navigable, handles draggable
5. Right panel (inspector view on a visual item) — fields readable
6. Right panel (transcript view with caption selected) — rows scannable
7. Context menus — readable, not cramped
8. Header — buttons comfortable

- [ ] **Step 2: Test at 50 %, 75 %, 100 %, 125 %, 150 % browser zoom**

Editor should stay usable and well-proportioned at all zoom levels. No overflow scrollbars should appear just from zoom change.

- [ ] **Step 3: Test leaving the editor**

Click back to project list / upload / landing. Those pages should render at their usual density (unaffected by the editor's rem override).

- [ ] **Step 4: Test multiple enter/exit cycles**

Enter editor → exit → enter → exit → enter. The `editor-density` class on `html` should add/remove correctly; no leftover state after exit.

- [ ] **Step 5: File any issues and adjust**

If specific components look bad at the new density, they likely have hardcoded px that weren't caught by Task 3's audit. Patch each by re-running the audit queries against the offending file.

---

## Self-Review Notes

**Spec coverage:**
- Reduce editor density at 100 % zoom ✔ (Tasks 1, 4)
- Convert to rem for consistent scaling across screen sizes ✔ (Tasks 1, 2, 3)
- Don't affect the rest of the app ✔ (Task 1 — scoped to html class toggled on mount)

**Non-goals (deliberately out of scope):**
- Rewriting Tailwind configuration — utilities already rem, no config change needed
- Converting timeline frame-pixel math to rem — frame math is pixel-exact by design
- Converting Remotion / canvas renderer sizes — fidelity-sensitive, stay in px
- Media-query-based responsive layout (hide sidebar on narrow viewports, etc.) — separate concern; this plan only handles density, not layout breakpoints

**Risk:** If a third-party component inside the editor expects a specific rem base (e.g., a Radix Popover assumes 16 px rem for offset math), it may misplace itself when the root is 13 px. Exit the offending component in devtools to verify the math, and if needed, move its offset to px or to a local em-based sizing. Unlikely — most Radix / headless libs are rem-respecting.

**Risk 2:** Users with large system font sizes set in OS accessibility preferences may rely on the 16 px base. Our override overrides that. If accessibility is a priority, consider replacing the fixed `13px` with a user preference stored in localStorage and surfaced via a UI toggle — follow-up plan, out of scope here.
