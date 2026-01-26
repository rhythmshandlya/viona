# StateManager Singleton Fix

**Date:** January 26, 2026
**Status:** Ready for Implementation
**Scope:** Fix editor data loading by sharing StateManager instance

---

## Problem

The ReelifyEditor creates a separate StateManager instance inside the component. When `dispatch(DESIGN_LOAD, ...)` is called, the event goes to the global event bus which is connected to the *original* editor's StateManager, not ours. Result: zustand store remains empty.

**Evidence:**
- API returns 14 subtitle items correctly
- Project converter creates 15 track items (1 video + 14 captions)
- Data reaches `dispatch(DESIGN_LOAD, ...)` call
- Zustand store ends up empty (`trackItemIds: []`, `trackItemsMap: {}`)

---

## Solution

Create a shared StateManager module that both editors use. The singleton pattern ensures all `dispatch()` calls reach the same instance.

### Architecture

```
apps/web/src/features/editor/
├── state-manager.ts (NEW - exports singleton)
├── editor.tsx (imports from state-manager.ts)
└── ...

apps/web/src/features/reelify-editor/
├── index.tsx (imports from state-manager.ts)
└── ...
```

---

## Implementation

### New File: `state-manager.ts`

```typescript
import StateManager from "@designcombo/state";

const DEFAULT_SIZE = { width: 1080, height: 1920 };

let stateManager: StateManager | null = null;

export function getStateManager(): StateManager {
  if (!stateManager) {
    stateManager = new StateManager({ size: DEFAULT_SIZE });
  }
  return stateManager;
}

export function resizeStateManager(width: number, height: number): void {
  const sm = getStateManager();
  if (typeof (sm as any).resize === 'function') {
    (sm as any).resize({ width, height });
  }
}

export function resetStateManager(): void {
  stateManager = null;
}

export { DESIGN_LOAD } from "@designcombo/state";
export default getStateManager;
```

### Changes to `editor.tsx`

```typescript
// Remove:
const stateManager = new StateManager({
  size: { width: 1080, height: 1920 },
});

// Add:
import getStateManager from "./state-manager";
const stateManager = getStateManager();
```

### Changes to `reelify-editor/index.tsx`

```typescript
import getStateManager, { resizeStateManager, resetStateManager } from "../editor/state-manager";

const ReelifyEditor = ({ projectId, initialData }) => {
  const stateManager = getStateManager();

  useEffect(() => {
    resetStateManager();
    const sm = getStateManager();
    resizeStateManager(initialData.size.width, initialData.size.height);
    dispatch(DESIGN_LOAD, { payload: initialData });
  }, [projectId, initialData]);

  // ...
}
```

---

## Edge Cases

| Case | Handling |
|------|----------|
| Navigate between projects | `resetStateManager()` clears old data before loading new |
| Return to original editor | Original editor's DESIGN_LOAD overwrites (expected) |
| Hot module reload | Singleton check prevents duplicates; state persists |

---

## Implementation Steps

1. Create `apps/web/src/features/editor/state-manager.ts`
2. Update `apps/web/src/features/editor/editor.tsx` to import from shared module
3. Update `apps/web/src/features/reelify-editor/index.tsx` to use shared module
4. Test: upload video, verify video + captions appear in editor
5. Test: navigate between projects, verify no stale data

---

## Success Criteria

- [ ] Video appears in editor player
- [ ] Captions appear on timeline
- [ ] Captions render over video during playback
- [ ] Original DesignCombo editor still works
- [ ] Navigating between projects loads correct data
