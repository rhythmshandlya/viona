# Post-Restructure Issues (Fresh Scan)

Tracked issues discovered via full codebase scan after Plans A-D restructure (2026-03-16).

**Status: 2 actionable, 1 informational**

---

## Open Issues

### 1. `prompt-assembly.ts` is dead code
**Severity:** Low — no runtime impact, pure cleanup
**File:** `packages/sandbox/src/prompt-assembly.ts`
**Details:** Zero importers in the entire codebase. Previously built per-display-mode animator prompts (`STACKED`, `FULLSCREEN`, `OVERLAY`). Display modes were fully removed in Plan D — single animator now receives dimensions from the scene plan. File was left behind during cleanup.
**Resolution:** Delete `packages/sandbox/src/prompt-assembly.ts`.

### 2. Worker v1 references deleted `remotion-template/`
**Severity:** Medium — breaks v1 worker dev path
**Files:**
- `packages/worker/src/utils/template.ts` (line ~33) — `remotion-template` used as dev-mode template source
- `packages/worker/src/config.ts` (line ~44) — references template directory
- `packages/worker/src/processors/index.ts` — v1 processors (`render`, `generate-visuals`, `edit-visuals`) still registered and active

**Details:** The entire `packages/worker/remotion-template/` directory was deleted as "unused by new renderer" during cleanup. However, the v1 worker processors are still registered and use `template.ts` to locate the template directory. In dev mode, this resolves to the now-deleted local path. Production may be unaffected if it pulls from a different source (e.g., S3/Docker image), but local dev will fail for any v1 job.
**Resolution:** Either (a) delete the v1 worker processors if they are fully superseded by the sandbox pipeline, or (b) restore `remotion-template/` for backward compatibility until v1 is formally decommissioned.

---

## Informational (No Action Required)

### 3. `overlayZone` vestigial in shared manifest schema
**File:** `packages/shared/src/manifest.ts` (line ~24)
**Details:** `overlayZone` is still defined as an optional field in `visualItemDataSchema`. It is no longer set by any code path — all overlay zone UI and logic was removed in Plan D. Keeping it as optional is harmless and prevents Zod validation failures on existing manifests that may have the field.
**Resolution:** None needed. Can be removed in a future breaking-change migration if desired.
