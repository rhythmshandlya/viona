# Agent Issues Log

Tracking bugs, inefficiencies, and optimization opportunities observed during sandbox agent runs.

---

## Issue #1: `planApproved` not updated in generation-progress.json
**Severity:** Medium
**Status:** Open
**Observed:** 2026-03-23, project `050e2182`
**Description:** User approved the plan in the frontend UI (shows "accepted"), but `generation-progress.json` still reads `planApproved: false`. The approval signal from the frontend isn't being written back to the progress file.
**Impact:** Progress tracking is inaccurate. Any logic that depends on `planApproved` would behave incorrectly.
**Where to look:** The `report_plan` widget flow — how does the frontend send approval back to the sandbox? Check `mcp__widgets__report_plan` tool and the widget callback mechanism.

---

## Issue #2: Shared modules not found during workspace-init
**Severity:** Low
**Status:** Open
**Observed:** 2026-03-23, project `050e2182`
**Description:** Four shared modules logged as missing during workspace init:
- `technical-rules.md`
- `motion-design-principles.md`
- `vocabulary.md`
- `quality-checklist.md`
**Impact:** These are creative guidance files that the agents would benefit from. Their absence may reduce output quality.
**Where to look:** `packages/sandbox/src/workspace-init.ts` — the `load_shared_modules()` logic. These files may have been removed or renamed during the theme replacement work.

---

## Issue #3: `fork_template` creates empty directories
**Severity:** High
**Status:** Fixed (2026-03-23)
**Observed:** 2026-03-23, project `050e2182`
**Root cause:** Two bugs compounding:
1. `upload-templates.ts` had wrong bucket fallback: `MINIO_BUCKET_UPLOADS` (= `uploads`) instead of `MINIO_BUCKET` (= `viona`). Template source files were uploaded to the wrong bucket.
2. `fork_template` in `template-tools.ts` called `mkdirSync` before checking if S3 files exist, creating empty directories on failure. No logging made failures invisible.
**Fixes applied (2026-03-23):**
- Fixed `upload-templates.ts` bucket fallback from `MINIO_BUCKET_UPLOADS` to `MINIO_BUCKET`
- Added post-upload verification step that checks files actually landed in the target bucket
- Fixed `fork_template` to defer `mkdirSync` until after confirming S3 objects exist
- Added console logging throughout fork_template for debugging
- Fixed import rewrite regex to handle any depth of `../` (was only handling `../../`)
- On download failure, fork_template now cleans up the empty target directory
- Re-uploaded all 51 templates to correct `viona` bucket
- Verified: 43/43 e2e tests passing (DB records, MinIO files, API endpoint, fork simulation, config check)
- Verified: fork works from inside Docker container (15 files downloaded for magazine-typewriter)
**Prevention:** upload-templates.ts now verifies each template post-upload. Will fail if 0 objects found.

---

## Issue #4: Frontend shows "setting up workspace" while agent is deep in implementation
**Severity:** Medium
**Status:** Open
**Observed:** 2026-03-23, project `050e2182`
**Description:** The frontend progress display still shows "setting up workspace" even though the workspace was initialized 20+ minutes ago and the agent has written all 8 scene files, forked 5 templates, and is at message count 631+.
**Impact:** User has no visibility into actual agent progress. This is likely related to Issue #1 (progress file not being updated) or the `report_progress` widget events not reaching the frontend.
**Where to look:** The `mcp__widgets__report_progress` tool flow — agent did call it (at messages 298 and 1410), but the frontend may not be consuming the events. Check SSE event delivery from sandbox to API to frontend.

---

## Issue #5: Scene files contain TODO comments instead of full implementations
**Severity:** High
**Status:** Open
**Observed:** 2026-03-23, project `050e2182`
**Description:** All scene files (Scene1-Scene8.tsx) contain `{/* Implement: ... */}` comment blocks describing animations that were NOT actually implemented. The scenes have basic layout/spring structure but lack:
- SVG path animations (strokeDashoffset)
- Typewriter character-by-character reveals
- Counter tick-up animations
- Ink bloom effects
- 3D perspective transforms beyond basic rotateX
- Route line tracing
- Conspiracy board thread lines
The agent wrote skeletal components and moved on rather than implementing the full animation plan.
**Impact:** Rendered output will be static/basic cards with spring entrances but none of the creative animation described in the scene plan. The visual quality gap between plan and implementation is severe.
**Where to look:** This may be a token/context issue — the subagent may have run out of turns or hit a limit. Check `max_turns` on the animator subagent. Also check if the agent plans to come back and fill in these TODOs in a second pass.

---

## Issue #6: Forked templates not used — scenes written from scratch
**Severity:** High
**Status:** Prompt fix applied (2026-03-23), needs verification on next run
**Observed:** 2026-03-23, project `050e2182`, `884ef140`, and `6a2d0ef7`
**Description:** Templates are forked successfully (3 templates × 11 files each in run `6a2d0ef7`). Both Setup Agent and Animators fork templates. But the Animators read the forked code as reference material and then write completely new Scene files from scratch — they never import the forked template components. Scene files only import from `../constants`, `../use-scale`, `../fonts`.
**Root cause:** Two issues:
1. The Animator prompt said "read the forked code, then adapt" — too vague. Animators interpreted "adapt" as "use as inspiration" rather than "import and customize."
2. The Setup Agent also forked templates (redundant with Animators), creating duplicate fork work.
**Fixes applied (2026-03-23):**
- Rewrote Animator template section: "MUST USE WHEN AVAILABLE" with explicit import/wrapper pattern and code example
- Updated Setup Agent: "Do NOT fork templates yourself" — Animators handle their own template forking
- Fixed `scene-registry-generator.ts` to only register `Scene\d+.tsx` files (forked template files in `src/scenes/` would otherwise break the registry)
**What to verify on next run:** Scene files should have `import ExplainerDefinition from './ExplainerDefinition'` (or similar) and render the forked component with custom data/props.

---

## Issue #7: generation-progress.json never advances past "initialized"
**Severity:** Medium
**Status:** Open (reproduced on 3rd run)
**Observed:** 2026-03-23, projects `050e2182` and `6a2d0ef7`
**Description:** `generation-progress.json` stays at `{ phase: "initialized", planApproved: false, totalScenes: 0 }` throughout the entire run. The agent never calls any tool to update this file. Related to Issue #1 (planApproved) but broader — no field in this file ever gets updated.
**Impact:** Any monitoring system or frontend that reads this file gets stale data. The orchestrator's `report_progress` widget events work (frontend SSE), but the file-based progress is dead.
**Where to look:** Who is supposed to write to `generation-progress.json`? Check if workspace-init creates it but no agent/tool updates it. The orchestrator emits progress via callbacks (SSE), but the file is a separate mechanism.

---
