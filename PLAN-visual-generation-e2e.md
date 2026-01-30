# Plan: Streamline End-to-End Visual Generation Pipeline

## Current State

The visual generation pipeline currently works but requires manual terminal modifications:
1. Agent generates Remotion TSX code ✓
2. Remotion bundles to index.html + bundle.js ✓
3. **MISSING**: CJS compilation for browser dynamic loading
4. Worker creates timeline items (but needs verification)
5. Frontend loads composition via DynamicVisualLoader ✓

## Problem

After bundling, the output is an ESM bundle (`composition.js`) that cannot be directly executed in the browser with a custom `require()`. The DynamicVisualLoader expects a CommonJS file (`composition.cjs.js`) that we currently generate manually.

## Solution: Add CJS Compilation Step

### Change 1: Update visual_generator.py

**File**: `docker/openhands-sandbox/visual_generator.py`

Add a new function to compile the ESM output to CJS after bundling:

```python
def compile_to_cjs(bundle_dir: Path, composition_id: str) -> bool:
    """Compile ESM composition.js to CommonJS composition.cjs.js for browser loading."""
    esm_file = bundle_dir / "composition.js"
    cjs_file = bundle_dir / "composition.cjs.js"

    if not esm_file.exists():
        logger.error(f"ESM file not found: {esm_file}")
        return False

    # Find the source TSX file
    src_dir = REMOTION_PROJECT_DIR / "src" / composition_id
    entry_file = src_dir / "index.tsx"

    if not entry_file.exists():
        logger.error(f"Source entry file not found: {entry_file}")
        return False

    # Use esbuild to compile to CommonJS
    result = subprocess.run([
        "npx", "esbuild",
        str(entry_file),
        "--bundle",
        "--format=cjs",
        "--platform=browser",
        "--external:react",
        "--external:remotion",
        f"--outfile={cjs_file}"
    ], capture_output=True, text=True, cwd=REMOTION_PROJECT_DIR)

    if result.returncode != 0:
        logger.error(f"CJS compilation failed: {result.stderr}")
        return False

    logger.info(f"CJS compilation successful: {cjs_file}")
    return True
```

**Integration point** in `create_remotion_bundle()`:

After the bundle command succeeds and before returning, add:
```python
# Compile to CJS for browser dynamic loading
if not compile_to_cjs(bundle_dir, composition_id):
    logger.warning("CJS compilation failed, falling back to ESM")
```

### Change 2: Verify Worker Creates Correct Timeline Item

**File**: `packages/worker/src/processors/generate-visuals.ts`

The worker should already create a single timeline item. Verify these aspects:

1. **Single item creation**: Worker creates ONE timeline item for full composition duration
2. **Correct bundleUrl**: Points to `/bundles/{projectId}/index.html` (DynamicVisualLoader converts to `.cjs.js`)
3. **compositionId**: Uses the correct composition ID format

Current code correctly does this:
```typescript
// Create ONE timeline item for the full composition
const fullDurationMs = Math.round((metadata.durationInFrames / metadata.fps) * 1000);
await db.insert(timelineItems).values({
  trackId: visualsTrack.id,
  type: 'visual',
  startMs: 0,
  endMs: fullDurationMs,
  data: { visualId, compositionId, bundleUrl, videoUrl, ... },
});
```

### Change 3: Ensure Bundles Directory is Served

**File**: `packages/api/src/index.ts` (or equivalent)

Verify the bundles directory is served statically so the frontend can fetch:
- `GET /bundles/{projectId}/composition.cjs.js`

This should already be configured based on existing code.

## File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `docker/openhands-sandbox/visual_generator.py` | Modify | Add `compile_to_cjs()` function and integrate into bundling |

## Implementation Steps

1. **Add CJS compilation function** to `visual_generator.py`
   - Create `compile_to_cjs()` function
   - Call it after `create_remotion_bundle()` succeeds

2. **Test with new project**
   - Trigger visual generation for a new project
   - Verify composition.cjs.js is created in bundle directory
   - Verify timeline item appears in editor
   - Verify visual plays correctly in split view

## Verification Checklist

- [ ] New project triggers visual generation
- [ ] OpenHands agent generates valid TSX code
- [ ] Remotion bundles successfully (index.html, bundle.js, composition.js)
- [ ] CJS compilation creates composition.cjs.js
- [ ] Worker creates single timeline item with correct data
- [ ] Frontend loads and displays visual in top 50% of player
- [ ] Video displays in bottom 50% of player
- [ ] No manual terminal modifications required

## Risk Assessment

- **Low risk**: Adding compilation step is additive, doesn't break existing flow
- **Fallback**: If CJS compilation fails, we can fall back to video rendering approach
- **Dependencies**: esbuild must be installed in Docker container (already present)
