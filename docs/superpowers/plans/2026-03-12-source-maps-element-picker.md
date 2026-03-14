# Source Maps + Element Picker — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable source-map-powered element picking so users can click elements in the video preview, see their source TSX location, and pass precise file+line context to the AI for surgical edits.

**Architecture:** The bundler produces inline source maps with every CJS build. The frontend loads a source-map library to resolve bundled positions → original TSX files. The existing `ElementInspectOverlay` is enhanced to display source location info and pass it to the AI agent tools.

**Tech Stack:** esbuild `--sourcemap=inline`, `source-map-js` npm package (pure JS, no WASM), React fiber walking, existing Zustand store

---

## Current State

What already exists:
- **`ElementInspectOverlay`** (`apps/web/src/features/editor-v2/scene/ElementInspectOverlay.tsx`) — scans `data-element-name` attributes, shows hover highlight, sets `selectedElement` on click
- **Store types** — `SelectedElement`, `elementPickerEnabled`, `inspectModeEnabled`, `selectedElement`, `aiEditRequested`
- **Scene.tsx** — renders `ElementInspectOverlay` when inspect mode is on, highlights selected element
- **PlaybackBar.tsx** — toggle button for inspect mode (keyboard shortcut `I`)
- **AI prompts** — `data-element-name` is MANDATORY in generated scenes (enforced in `generate-visuals.ts` and `animator.py`)
- **AI Assistant Panel** — sends `selectedElement` context with messages

What's missing:
1. **Source maps not generated** — bundler doesn't pass `--sourcemap` to esbuild
2. **No source map resolution** — no library to decode `.map` files → original TSX locations
3. **No React fiber walking** — can't trace a DOM element → React component → source location
4. **`SelectedElement` type lacks source location** — no `sourceFile`, `startLine`, `endLine` fields
5. **AI agent tools don't receive source location** — `edit_scene` tool doesn't accept line range
6. **No `SelectionHighlightOverlay`** — spec mentions it but doesn't exist (different from inspect overlay)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `packages/api/src/workspace/bundler-service.ts` | Modify | Add `--sourcemap=inline` to esbuild CJS compilation |
| `apps/web/src/features/editor-v2/player/useWorkspaceComposition.ts` | Modify | Extract source map from CJS bundle, expose resolver |
| `apps/web/src/features/editor-v2/player/source-map-resolver.ts` | Create | Utility to parse inline source maps and resolve locations |
| `apps/web/src/features/editor-v2/store/types.ts` | Modify | Add `sourceFile`, `startLine`, `endLine` to `SelectedElement` |
| `apps/web/src/features/editor-v2/scene/ElementInspectOverlay.tsx` | Modify | Use React fiber walking to get component source, show source info |
| `apps/web/src/features/editor-v2/scene/fiber-utils.ts` | Create | React fiber walking utilities to trace DOM → component → source |
| `apps/web/src/features/editor-v2/scene/SelectionHighlightOverlay.tsx` | Create | Persistent highlight for selected element with source badge |
| `apps/web/src/features/editor-v2/scene/Scene.tsx` | Modify | Add SelectionHighlightOverlay rendering |
| `apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx` | Modify | Pass source location in AI message context |
| `packages/api/src/agent/agent-tools.ts` | Modify | Add `sourceFile`, `startLine`, `endLine` params to edit tool |

---

## Chunk 1: Source Map Generation + Resolution

### Task 1: Enable source maps in esbuild CJS compilation

The CJS bundle sent to the frontend currently has no source maps. esbuild supports inline source maps which embed the map as a base64 data URL comment at the end of the file — no extra HTTP request needed.

**Files:**
- Modify: `packages/api/src/workspace/bundler-service.ts:167-184`

- [ ] **Step 1: Read the current esbuild args**

Read `packages/api/src/workspace/bundler-service.ts` lines 162-185.

- [ ] **Step 2: Add --sourcemap=inline to esbuild args**

After `--outfile=${cjsOutput}`, add `--sourcemap=inline`:

```typescript
const args = [
  'esbuild',
  entryPoint,
  '--bundle',
  '--format=cjs',
  '--platform=browser',
  '--target=es2020',
  '--external:react',
  '--external:react/jsx-runtime',
  '--external:react/jsx-dev-runtime',
  '--external:remotion',
  '--external:@remotion/noise',
  '--external:@remotion/shapes',
  '--external:@remotion/paths',
  '--external:@remotion/three',
  '--external:@remotion/google-fonts/*',
  '--external:remotion/no-react',
  `--outfile=${cjsOutput}`,
  '--sourcemap=inline',
];
```

`inline` embeds the source map as a `//# sourceMappingURL=data:application/json;base64,...` comment at the end of the file. This avoids needing to serve a separate `.map` file.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd packages/api && npx tsc --noEmit --pretty false`

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/workspace/bundler-service.ts
git commit -m "feat(bundler): enable inline source maps in CJS compilation"
```

---

### Task 2: Install source-map-js library and create resolver utility

The frontend needs to parse the inline source map and resolve bundled positions to original TSX file/line. We use `source-map-js` (pure JS, no WASM) instead of Mozilla's `source-map` (requires WASM binary loading). Same API surface, zero runtime dependencies.

**Files:**
- Create: `apps/web/src/features/editor-v2/player/source-map-resolver.ts`

- [ ] **Step 1: Install source-map-js package**

```bash
cd apps/web && pnpm add source-map-js
```

- [ ] **Step 2: Create the resolver module**

Create `apps/web/src/features/editor-v2/player/source-map-resolver.ts`:

```typescript
import { SourceMapConsumer, type RawSourceMap } from 'source-map-js';

export interface SourceLocation {
  /** Original source file path, e.g. "scenes/comp_abc123/scenes/Scene1.tsx" */
  sourceFile: string;
  /** 1-indexed line number in the original file */
  line: number;
  /** 0-indexed column */
  column: number;
}

/**
 * Extract the inline source map from a CJS bundle string.
 * Returns the raw JSON or null if no inline source map found.
 */
export function extractInlineSourceMap(code: string): RawSourceMap | null {
  const match = code.match(
    /\/\/# sourceMappingURL=data:application\/json;base64,(.+)$/m,
  );
  if (!match) return null;

  try {
    const json = atob(match[1]);
    return JSON.parse(json) as RawSourceMap;
  } catch {
    return null;
  }
}

/**
 * Create a source location resolver from a raw source map.
 * source-map-js is pure JS — no WASM init or async needed.
 */
export function createSourceResolver(
  rawMap: RawSourceMap,
): {
  resolve: (line: number, column: number) => SourceLocation | null;
} {
  const consumer = new SourceMapConsumer(rawMap);

  return {
    resolve(line: number, column: number): SourceLocation | null {
      const pos = consumer.originalPositionFor({ line, column });
      if (!pos.source || pos.line == null) return null;

      return {
        sourceFile: pos.source,
        line: pos.line,
        column: pos.column ?? 0,
      };
    },
  };
}

/**
 * Given a component name (from React fiber), find its definition
 * in the source map by searching the original sources.
 */
export function findComponentInSources(
  rawMap: RawSourceMap,
  componentName: string,
): { sourceFile: string; startLine: number; endLine: number } | null {
  if (!rawMap.sourcesContent) return null;

  for (let i = 0; i < rawMap.sources.length; i++) {
    const content = rawMap.sourcesContent[i];
    if (!content) continue;

    const lines = content.split('\n');
    // Look for component function/const definition
    const patterns = [
      // export function ComponentName
      new RegExp(`^export\\s+function\\s+${componentName}\\b`),
      // export const ComponentName
      new RegExp(`^export\\s+const\\s+${componentName}\\s*[=:]`),
      // function ComponentName
      new RegExp(`^function\\s+${componentName}\\b`),
      // const ComponentName
      new RegExp(`^const\\s+${componentName}\\s*[=:]`),
    ];

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const trimmed = lines[lineIdx].trimStart();
      if (patterns.some(p => p.test(trimmed))) {
        // Find the end of the component (next export or end of file)
        let endLine = lines.length;
        for (let j = lineIdx + 1; j < lines.length; j++) {
          const t = lines[j].trimStart();
          if (t.startsWith('export ') && !t.startsWith('export default')) {
            endLine = j;
            break;
          }
        }

        return {
          sourceFile: rawMap.sources[i],
          startLine: lineIdx + 1, // 1-indexed
          endLine,
        };
      }
    }
  }

  return null;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty false`
Expected: no new errors (pre-existing ones are OK).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/editor-v2/player/source-map-resolver.ts apps/web/package.json pnpm-lock.yaml
git commit -m "feat(player): add source-map resolver utility for inline CJS source maps"
```

---

### Task 3: Extract source map and store in Zustand

When the CJS bundle is loaded via `new Function()`, extract the inline source map and store it in the editor Zustand store. This avoids threading the source map through 3+ layers of component props (useWorkspaceComposition → WorkspacePlayer → Player → Scene).

**Files:**
- Modify: `apps/web/src/features/editor-v2/store/types.ts`
- Modify: `apps/web/src/features/editor-v2/store/editor-store.ts`
- Modify: `apps/web/src/features/editor-v2/store/use-editor-store.ts`
- Modify: `apps/web/src/features/editor-v2/player/useWorkspaceComposition.ts`

- [ ] **Step 1: Add workspaceSourceMap to EditorState**

In `apps/web/src/features/editor-v2/store/types.ts`, add to `EditorState`:
```typescript
/** Raw source map from CJS bundle — used by element picker for source location resolution */
workspaceSourceMap: Record<string, unknown> | null;
```

Use `Record<string, unknown>` instead of `RawSourceMap` to avoid importing source-map-js types into the store.

- [ ] **Step 2: Add initial state and selector**

In `editor-store.ts`, add to `initialState`:
```typescript
workspaceSourceMap: null,
```

In `use-editor-store.ts`, add selector:
```typescript
export const useWorkspaceSourceMap = () => useEditorStore((s) => s.workspaceSourceMap);
```

- [ ] **Step 3: Extract source map in useWorkspaceComposition**

In `apps/web/src/features/editor-v2/player/useWorkspaceComposition.ts`, import:
```typescript
import { extractInlineSourceMap } from './source-map-resolver';
import { useEditorStore } from '../store/editor-store';
```

After `const code = await response.text();` and the content validation, extract and store:
```typescript
// Extract inline source map for element picker
const rawMap = extractInlineSourceMap(code);
useEditorStore.setState({ workspaceSourceMap: rawMap as Record<string, unknown> | null });
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty false`

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/editor-v2/store/types.ts apps/web/src/features/editor-v2/store/editor-store.ts apps/web/src/features/editor-v2/store/use-editor-store.ts apps/web/src/features/editor-v2/player/useWorkspaceComposition.ts
git commit -m "feat(player): extract inline source map from CJS bundle, store in Zustand"
```

---

## Chunk 2: React Fiber Walking + Element Picker Enhancement

### Task 4: Create React fiber walking utilities

To trace a DOM element → React component → source location, we need to walk React's internal fiber tree. React attaches a `__reactFiber$` property to DOM nodes.

**Files:**
- Create: `apps/web/src/features/editor-v2/scene/fiber-utils.ts`

- [ ] **Step 1: Create fiber-utils.ts**

```typescript
/**
 * React Fiber Walking Utilities
 * Traces DOM elements to their React component definitions.
 *
 * React attaches internal fiber nodes to DOM elements via a property
 * starting with "__reactFiber$" or "__reactInternalInstance$".
 */

interface FiberNode {
  tag: number;
  type: string | Function | null;
  return: FiberNode | null;
  _debugSource?: {
    fileName: string;
    lineNumber: number;
    columnNumber?: number;
  };
  memoizedProps?: Record<string, unknown>;
  elementType?: Function & { displayName?: string; name?: string };
}

/**
 * Get the React fiber node for a DOM element.
 */
export function getFiberFromElement(element: HTMLElement): FiberNode | null {
  const key = Object.keys(element).find(
    (k) => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'),
  );
  if (!key) return null;
  return (element as any)[key] as FiberNode;
}

/**
 * Walk up the fiber tree to find the nearest user-defined component
 * (not a host element like 'div', 'span', etc.).
 *
 * React fiber tags: 0 = FunctionComponent, 1 = ClassComponent, 5 = HostComponent
 */
export function findNearestComponent(fiber: FiberNode): {
  name: string;
  fiber: FiberNode;
} | null {
  let current: FiberNode | null = fiber;

  while (current) {
    // Tag 0 = FunctionComponent, Tag 1 = ClassComponent
    if ((current.tag === 0 || current.tag === 1) && typeof current.type === 'function') {
      const name =
        (current.type as any).displayName ||
        (current.type as any).name ||
        'Anonymous';

      // Skip internal/framework components
      if (!name.startsWith('_') && name !== 'Anonymous' && name.length > 1) {
        return { name, fiber: current };
      }
    }

    current = current.return;
  }

  return null;
}

/**
 * Walk up the fiber tree to collect all component names in the ancestry.
 * Useful for building a breadcrumb: "Scene1 > Background > GradientCircle"
 */
export function getComponentAncestry(fiber: FiberNode, maxDepth = 5): string[] {
  const names: string[] = [];
  let current: FiberNode | null = fiber;
  let depth = 0;

  while (current && depth < maxDepth) {
    if ((current.tag === 0 || current.tag === 1) && typeof current.type === 'function') {
      const name =
        (current.type as any).displayName ||
        (current.type as any).name ||
        null;

      if (name && !name.startsWith('_') && name !== 'Anonymous') {
        names.push(name);
        depth++;
      }
    }

    current = current.return;
  }

  return names;
}

/**
 * Get the debug source info from a fiber node (if available).
 * This works when React is in development mode with source info.
 * In production bundles, _debugSource is stripped — use source maps instead.
 */
export function getDebugSource(fiber: FiberNode): {
  fileName: string;
  lineNumber: number;
} | null {
  let current: FiberNode | null = fiber;

  while (current) {
    if (current._debugSource) {
      return {
        fileName: current._debugSource.fileName,
        lineNumber: current._debugSource.lineNumber,
      };
    }
    current = current.return;
  }

  return null;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty false`

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/editor-v2/scene/fiber-utils.ts
git commit -m "feat(scene): add React fiber walking utilities for element → component tracing"
```

---

### Task 5: Update SelectedElement type with source location fields

**Files:**
- Modify: `apps/web/src/features/editor-v2/store/types.ts`

- [ ] **Step 1: Add source location fields to SelectedElement**

In `apps/web/src/features/editor-v2/store/types.ts`, update the `SelectedElement` interface:

```typescript
export interface SelectedElement {
  name: string;
  type: string;
  sceneId: number;
  description?: string;
  position?: { x: string; y: string };
  size?: { width: string; height: string };
  /** Component name from React fiber tree */
  componentName?: string;
  /** Component ancestry breadcrumb, e.g. ["GradientCircle", "Background", "Scene1"] */
  componentAncestry?: string[];
  /** Original source file path (from source map) */
  sourceFile?: string;
  /** Start line in source file (1-indexed) */
  startLine?: number;
  /** End line in source file (1-indexed) */
  endLine?: number;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty false`

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/editor-v2/store/types.ts
git commit -m "feat(store): add source location fields to SelectedElement type"
```

---

### Task 6: Enhance ElementInspectOverlay with fiber walking + source map resolution

Add React fiber walking to get component names, and source map resolution to get file/line info. Show this info in the tooltip.

**Files:**
- Modify: `apps/web/src/features/editor-v2/scene/ElementInspectOverlay.tsx`

- [ ] **Step 1: Read the current overlay**

Read `apps/web/src/features/editor-v2/scene/ElementInspectOverlay.tsx` fully.

- [ ] **Step 2: Add fiber walking imports**

At the top, add:
```typescript
import { getFiberFromElement, findNearestComponent, getComponentAncestry } from './fiber-utils';
import { findComponentInSources } from '../player/source-map-resolver';
```

- [ ] **Step 3: Read sourceMap from Zustand store (not props)**

The source map is stored in the Zustand editor store (Task 3). Read it inside the component:
```typescript
import { useWorkspaceSourceMap } from '../store/use-editor-store';
import type { RawSourceMap } from 'source-map-js';

// Inside the component:
const rawSourceMap = useWorkspaceSourceMap();
const sourceMap = rawSourceMap as RawSourceMap | null;
```

The props interface does NOT need a `sourceMap` prop — it comes from the store.

- [ ] **Step 4: Enhance scanElements to capture DOM element reference**

Update `ElementRect` to include the DOM element reference:
```typescript
interface ElementRect {
  name: string;
  left: number;
  top: number;
  width: number;
  height: number;
  area: number;
  element: HTMLElement; // Reference to actual DOM element
}
```

In `scanElements`, store the element:
```typescript
results.push({
  name,
  left: r.left - containerRect.left,
  top: r.top - containerRect.top,
  width: r.width,
  height: r.height,
  area: r.width * r.height,
  element: el as HTMLElement,
});
```

- [ ] **Step 5: Add fiber + source map resolution on click**

In `handleClick`, after creating the base `SelectedElement`, enhance it with fiber info:

```typescript
// Fiber walking — get component name and ancestry
const fiber = getFiberFromElement(hoveredElement.element);
if (fiber) {
  const component = findNearestComponent(fiber);
  if (component) {
    element.componentName = component.name;
    element.componentAncestry = getComponentAncestry(fiber);
  }
}

// Source map resolution — get file/line info
if (element.componentName && sourceMap) {
  const location = findComponentInSources(sourceMap, element.componentName);
  if (location) {
    element.sourceFile = location.sourceFile;
    element.startLine = location.startLine;
    element.endLine = location.endLine;
  }
}
```

- [ ] **Step 6: Show component name + source location in tooltip**

Update the tooltip to show richer info:
```typescript
{mousePos && (
  <div
    className="absolute pointer-events-none px-2 py-1 rounded-md text-xs font-medium text-white bg-black/80 backdrop-blur-sm border border-white/10 whitespace-nowrap"
    style={{
      left: Math.min(mousePos.x + 16, (overlayRef.current?.clientWidth ?? 1000) - 200),
      top: Math.min(mousePos.y + 16, (overlayRef.current?.clientHeight ?? 800) - 50),
    }}
  >
    <div>{hoveredElement.name}</div>
    {hoveredComponentRef.current && (
      <div className="text-white/50 text-[10px] mt-0.5">
        {hoveredComponentRef.current}
      </div>
    )}
  </div>
)}
```

To populate `hoveredComponentRef`, add a ref that updates on hover:
```typescript
const hoveredComponentRef = useRef<string | null>(null);
```

In `handleMouseMove`, after finding the hit element:
```typescript
if (hit) {
  const fiber = getFiberFromElement(hit.element);
  const comp = fiber ? findNearestComponent(fiber) : null;
  hoveredComponentRef.current = comp?.name ?? null;
} else {
  hoveredComponentRef.current = null;
}
```

- [ ] **Step 7: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty false`

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/features/editor-v2/scene/ElementInspectOverlay.tsx
git commit -m "feat(scene): enhance element picker with fiber walking + source map resolution"
```

---

### Task 7: Create SelectionHighlightOverlay

A persistent overlay that shows when an element is selected (after clicking in inspect mode). Shows the element name, component path, and source location as a badge.

**Files:**
- Create: `apps/web/src/features/editor-v2/scene/SelectionHighlightOverlay.tsx`

- [ ] **Step 1: Create the component**

```typescript
/**
 * SelectionHighlightOverlay
 * Persistent highlight for the currently selected element.
 * Shows element name + source location badge when elementPickerEnabled is true.
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { useEditorStore } from '../store/editor-store';
import { useSelectedElement, useElementPickerEnabled } from '../store/use-editor-store';

interface SelectionHighlightOverlayProps {
  playerContainerRef: React.RefObject<HTMLDivElement | null>;
}

export function SelectionHighlightOverlay({ playerContainerRef }: SelectionHighlightOverlayProps) {
  const selectedElement = useSelectedElement();
  const elementPickerEnabled = useElementPickerEnabled();
  const [highlightRect, setHighlightRect] = useState<{
    left: number; top: number; width: number; height: number;
  } | null>(null);

  // Find the selected element's position
  useEffect(() => {
    if (!selectedElement || !elementPickerEnabled || !playerContainerRef.current) {
      setHighlightRect(null);
      return;
    }

    const findAndUpdate = () => {
      const container = playerContainerRef.current;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const name = selectedElement.name;

      // Try various casing/formatting
      const variants = [
        name,
        name.toLowerCase(),
        name.toLowerCase().replace(/\s+/g, '-'),
      ];

      for (const v of variants) {
        const el = container.querySelector(`[data-element-name="${v}"]`);
        if (el) {
          const r = el.getBoundingClientRect();
          setHighlightRect({
            left: r.left - containerRect.left,
            top: r.top - containerRect.top,
            width: r.width,
            height: r.height,
          });
          return;
        }
      }

      setHighlightRect(null);
    };

    findAndUpdate();
    // Re-scan periodically in case animation moves the element
    const interval = setInterval(findAndUpdate, 500);
    return () => clearInterval(interval);
  }, [selectedElement, elementPickerEnabled, playerContainerRef]);

  if (!highlightRect || !selectedElement || !elementPickerEnabled) return null;

  return (
    <div className="absolute inset-0 z-20 pointer-events-none">
      {/* Selection highlight border */}
      <div
        className="absolute transition-all duration-150"
        style={{
          left: highlightRect.left - 2,
          top: highlightRect.top - 2,
          width: highlightRect.width + 4,
          height: highlightRect.height + 4,
          border: '2px solid #8b5cf6',
          borderRadius: 6,
          boxShadow: '0 0 0 1px rgba(139, 92, 246, 0.3), 0 0 12px rgba(139, 92, 246, 0.15)',
        }}
      />

      {/* Source location badge */}
      <div
        className="absolute px-2 py-1 rounded-md text-[10px] font-mono text-white bg-violet-600/90 backdrop-blur-sm border border-violet-400/30 whitespace-nowrap"
        style={{
          left: highlightRect.left,
          top: Math.max(0, highlightRect.top - 24),
        }}
      >
        <span className="font-semibold">{selectedElement.name}</span>
        {selectedElement.sourceFile && (
          <span className="text-violet-200 ml-1.5">
            {selectedElement.sourceFile.split('/').pop()}
            {selectedElement.startLine ? `:${selectedElement.startLine}` : ''}
          </span>
        )}
      </div>

      {/* Dismiss hint */}
      <div
        className="absolute px-1.5 py-0.5 rounded text-[9px] text-white/50 bg-black/50"
        style={{
          left: highlightRect.left + highlightRect.width + 6,
          top: highlightRect.top,
        }}
      >
        ESC to deselect
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty false`

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/editor-v2/scene/SelectionHighlightOverlay.tsx
git commit -m "feat(scene): add SelectionHighlightOverlay with source location badge"
```

---

### Task 8: Wire up overlays in Scene.tsx — replace inline highlight with SelectionHighlightOverlay

Scene.tsx currently has **inline** element highlight code at lines 196-236 (a `<div>` with border + boxShadow spotlight, and a fallback dim overlay). This is replaced by the new `SelectionHighlightOverlay` component created in Task 7.

**Files:**
- Modify: `apps/web/src/features/editor-v2/scene/Scene.tsx`

- [ ] **Step 1: Read the current Scene.tsx**

Read `apps/web/src/features/editor-v2/scene/Scene.tsx` fully.

- [ ] **Step 2: Import SelectionHighlightOverlay**

Add import:
```typescript
import { SelectionHighlightOverlay } from './SelectionHighlightOverlay';
```

- [ ] **Step 3: Remove the inline element highlight code (lines 196-236)**

Delete the entire block that starts with `{/* Element selection overlay */}` and ends with the closing `</div>` + `)}` — this is approximately lines 196-236. This is the block that contains:
- `{elementPickerEnabled && selectedElement && (`
- The spotlight div with `border: '2px solid var(--editor-accent, #8b5cf6)'` and `boxShadow: '0 0 0 9999px ...'`
- The fallback dim overlay with "Regenerate visuals to enable element highlighting"

Replace it with:
```typescript
{/* Element selection highlight — persistent overlay with source location badge */}
<SelectionHighlightOverlay playerContainerRef={playerContainerRef} />
```

Note: `SelectionHighlightOverlay` handles its own visibility check internally (returns null when no element selected or picker disabled), so no conditional wrapper is needed.

- [ ] **Step 4: Remove unused `highlightRect` state and related code**

After removing the inline highlight, check if `highlightRect` state and the `useEffect` that computes it are now unused. If so, remove them to avoid dead code. The `SelectionHighlightOverlay` manages its own highlight rect internally.

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty false`

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/editor-v2/scene/Scene.tsx
git commit -m "refactor(scene): replace inline highlight with SelectionHighlightOverlay"
```

---

## Chunk 3: AI Integration

### Task 9: Pass source location context to AI assistant

When the user sends a message with a selected element, include the source file and line range so the AI can make surgical edits.

**Files:**
- Modify: `apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx`

- [ ] **Step 1: Read the message sending code**

Read `apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx` around lines 945-968 where `context` is built.

- [ ] **Step 2: Add source location to context**

Update the context object to include source info:

```typescript
const context: {
  selectedTimeRange?: { startMs: number; endMs: number };
  selectedSceneId?: number;
  selectedElement?: {
    name: string;
    sceneId: number;
    componentName?: string;
    componentAncestry?: string[];
    sourceFile?: string;
    startLine?: number;
    endLine?: number;
  };
  selectedVisualItem?: { id: string; description: string };
} = {};
```

Where `selectedElement` is populated, spread the full element data:
```typescript
if (editingContext?.element) {
  context.selectedElement = {
    name: editingContext.element.name,
    sceneId: editingContext.element.sceneId,
    componentName: editingContext.element.componentName,
    componentAncestry: editingContext.element.componentAncestry,
    sourceFile: editingContext.element.sourceFile,
    startLine: editingContext.element.startLine,
    endLine: editingContext.element.endLine,
  };
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty false`

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx
git commit -m "feat(assistant): include source file + line range in AI message context"
```

---

### Task 10: Add source location params to AI agent edit tool

The backend `edit_scene` tool should accept optional `sourceFile`, `startLine`, `endLine` params so the AI can scope its edits precisely.

**Files:**
- Modify: `packages/api/src/agent/agent-tools.ts`

- [ ] **Step 1: Read the current edit tool definition**

Read `packages/api/src/agent/agent-tools.ts` and find the edit scene/visual tool definition.

- [ ] **Step 2: Add source location parameters**

Add optional parameters to the tool's Zod schema:

```typescript
sourceFile: z.string().optional().describe('Original source file path from source map, e.g. "scenes/comp_abc123/scenes/Scene1.tsx"'),
startLine: z.number().optional().describe('Start line in source file (1-indexed) to scope the edit'),
endLine: z.number().optional().describe('End line in source file (1-indexed) to scope the edit'),
```

- [ ] **Step 3: Pass source location to the edit prompt**

When building the edit prompt/system message, include the source location if provided:

```typescript
if (params.sourceFile) {
  editContext += `\nTarget: ${params.sourceFile}`;
  if (params.startLine && params.endLine) {
    editContext += ` (lines ${params.startLine}-${params.endLine})`;
  }
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd packages/api && npx tsc --noEmit --pretty false`

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/agent/agent-tools.ts
git commit -m "feat(agent): accept source file + line range in edit tool for surgical edits"
```

---

## Summary

| # | Category | Task | Lines Changed |
|---|----------|------|---------------|
| 1 | Backend | Enable inline source maps in esbuild | ~1 |
| 2 | Frontend | Source map resolver utility | ~100 |
| 3 | Frontend | Extract source map in useWorkspaceComposition | ~10 |
| 4 | Frontend | React fiber walking utilities | ~100 |
| 5 | Store | Add source location to SelectedElement type | ~6 |
| 6 | Frontend | Enhance ElementInspectOverlay with fiber + source map | ~40 |
| 7 | Frontend | SelectionHighlightOverlay component | ~120 |
| 8 | Frontend | Wire up overlays in Scene.tsx | ~15 |
| 9 | Frontend | Pass source location to AI assistant | ~15 |
| 10 | Backend | Add source location to AI agent edit tool | ~15 |

**Total: ~420 lines across 10 tasks**
