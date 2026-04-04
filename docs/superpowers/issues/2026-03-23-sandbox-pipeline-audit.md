# Sandbox Pipeline Audit — 2026-03-23

Comprehensive investigation of sandbox pipeline for project `d659a68f-4a56-435e-ac7e-bd744febb38b`.
Magazine theme, 8 scenes, Algeria exam cheating topic.

---

## Issue 1: `tsc` Missing from Docker Image — Self-Heals at Cost (HIGH)

**Impact:** The Docker image ships without `typescript/lib/tsc.js`. The pipeline self-heals by running `npm install` during Phase 4 (Setup), which installs TypeScript at 16:37 — 46 minutes after container start. Before that point, `npx tsc --noEmit` is broken. Type checking only works after the install completes.

**Evidence:**
```
# Docker image initial state:
node_modules/typescript/lib/tsc.js → MISSING
node_modules/.bin/ → MISSING (entire directory)
npx tsc → downloads wrong package (tsc@2.0.4)

# After pipeline self-heals (~16:37):
node_modules/typescript/lib/tsc.js → EXISTS (267 bytes shim → _tsc.js 6.2MB)
node_modules/.bin/tsc → EXISTS (symlink)
TypeScript version: 5.9.3
```

**Root cause (confirmed):** `packages/sandbox/Dockerfile` line 62:
```dockerfile
RUN sed -i '/"@viona\/shared"/d' package.json && npm install --omit=dev
```
`--omit=dev` skips devDependencies. TypeScript is listed as a devDependency in `packages/sandbox/package.json` line 31. This removes `typescript/lib/` entirely. The `bin/tsc` shim survives but its target `../lib/tsc.js` is gone.

**Fix:** Move `typescript` from `devDependencies` to `dependencies` in `packages/sandbox/package.json`, or add a separate `RUN npm install typescript` in the Dockerfile after the `--omit=dev` step.

---

## Issue 2: Planner Makes Excessive `browse_templates` Calls (MEDIUM)

**Impact:** Planner calls `browse_templates` 14+ times individually instead of one batch call.

**Fix:** Add `list_templates` tool that returns full registry, or pre-inject registry into Planner context.

---

## Issue 3: Scene Plan Uses SVG Stroke Language (MEDIUM)

**Impact:** Descriptions like "draws itself stroke-by-stroke" conflict with Animator rejection criteria for SVG stroke patterns.

**Fix:** Add banned-language list to Planner prompt matching Animator rejection criteria.

---

## Issue 4: Missing Shared Prompt Modules (MEDIUM, KNOWN)

**Impact:** Four modules (`technical-rules.md`, `motion-design-principles.md`, `vocabulary.md`, `quality-checklist.md`) never created.

**Fix:** Create modules in `packages/sandbox/src/prompts/shared/`.

---

## Issue 5: Setup Agent Forks Templates (not Animators) — Docs Outdated (LOW)

**Status:** Working better than documented. Update docs to match reality.

---

## Issue 6: Templates Architecturally Incompatible as Wrappers (CRITICAL)

**Impact:** 0/8 scenes use templates as thin wrappers. Animators write 4,943 lines of custom code instead of ~160 lines. The entire template system fails to achieve its purpose: code reuse and visual consistency.

**Evidence — per-scene breakdown:**

| Scene | Lines | Template Component Used? | Utility Imports |
|-------|-------|--------------------------|-----------------|
| Scene1 (didyouknow) | 680 | NO | TornEdge, PaperTexture, MAGAZINE_FONTS |
| Scene2 (comparison) | 615 | NO | TornEdge, PaperTexture, TapeMark, FONTS |
| Scene3 (country) | 425 | NO | None — "deps unavailable" |
| Scene4 (alert) | 588 | NO | FONTS, COLORS, editorialReveal, PaperTexture, FoldShadow |
| Scene5 (timeline) | 805 | NO | None — comment only |
| Scene6 (agenda) | 715 | NO | TornEdge, PaperTexture, FONTS |
| Scene7 (pricetag) | 579 | NO | TornEdge, PaperTexture |
| Scene8 (trivia) | 536 | NO | TornEdge, PaperTexture, FONTS |

**Three architectural gaps prevent wrapping:**

### Gap A: Hardcoded 1080×1920 Dimensions

Animator prompt claims: *"Templates use `AbsoluteFill` to fill available space — NOT width/height."*

Reality — every template hardcodes pixel math:
```tsx
// magazine-didyouknow/index.tsx (113 lines)
const CANVAS_W = 1080;
const CANVAS_H = 1920;
const cardX = (CANVAS_W - CARD_W) / 2 + cardSlide.translateX;
```

But scenes need variable sizes per display mode:
- Overlay scenes: 800×640 or 800×480
- Split-screen: 1080×960
- Fullscreen: 1080×1920 (only match)

A thin wrapper can't resize hardcoded pixel math.

### Gap B: Props Too Narrow

Template schemas accept static content (2-3 props) but scenes need 5-phase animation control:

| Template | Schema Props | Scene Actually Needs |
|----------|-------------|---------------------|
| didyouknow | `fact, source` | hookQuestion, payoffPhrase, 172-frame 5-phase timeline, paper scatter exit, typing effect, glow bloom |
| comparison | `leftLabel, rightLabel, items[]` | Side-by-side cards with parallax, divider animation, per-item staggered entrance |
| country | `countryName, cityLat/Lng, mapStyle...` | Country outline path, concentric escalation rings, radar pulse |
| timeline | `events[], title` | Thread drawing, 8 year markers on alternating sides, counter tick-up, traveling highlight |

Templates have ZERO timing/duration/phase control in their schemas.

### Gap C: Cross-Template Dependencies Missing

`magazine-country/index.tsx` imports:
```tsx
import { findCountry } from '../country-highlight/data/countries';
import MapTileGrid from '../country-highlight/components/MapTileGrid';
import CountryOverlay from '../country-highlight/components/CountryOverlay';
```

`country-highlight` exists as a separate template in S3 but `fork_template` does NOT pull cross-template dependencies. The forked `magazine-country` has broken imports.

### Root Cause

Templates were designed as **standalone compositions** (self-contained videos with own timeline/dimensions). The pipeline needs **scene building blocks** (flexible components accepting external timing, dimensions, and content).

### Recommendation

**Option A — Fix templates for composability (HIGH EFFORT):**
1. Replace `CANVAS_W/H` with `useVideoConfig()` or width/height props
2. Add `durationInFrames`, `phaseTimeline` props to schemas
3. Accept `children` or render prop for custom content
4. Auto-fork cross-template dependencies

**Option B — Redefine as style libraries (LOW EFFORT, RECOMMENDED):**
1. Accept templates are utility libraries, not wrappable components
2. Update Animator prompt: "Import utilities (effects, textures, constants, animations) from the template's `magazine/` shared library"
3. Remove thin-wrapper instruction and example code
4. Templates become a design system: consistent fonts, effects, textures, animations

---

## Issue 7: Scene2 Animator Duplicate-Forked Template (LOW)

**Impact:** Two identical copies of `magazine-comparison`:
```
src/components/templates/magazine-comparison/   → Setup Agent (correct)
src/scenes/template-magazine-comparison/        → Animator re-fork (duplicate)
```

**Fix:** Update Animator prompt: "Templates already forked at `src/components/templates/<slug>/`. Do NOT call `fork_template`."

---

## Issue 8: Zod Version Mismatch — 4.x Installed Over 3.x (HIGH)

**Impact:** Remotion 4.0.422 requires `zod@3.22.3`. The workspace `package.json` and lockfile both specify 3.22.3. But at 16:40, something in the pipeline ran `npm install` and upgraded zod to `4.3.6`.

**Evidence:**
```
package.json:     "zod": "3.22.3"
package-lock.json: zod → 3.22.3
Actual loaded:    4.3.6 (modified at 16:40)

Remotion warning:
  "zod: installed 4.3.6, required 3.22.3"
  "You may experience breakages: React context/hooks not working,
   failed renders and unclear errors"
```

Zod 4.x has a different API from 3.x. This breaks Remotion's internal schema validation and may cause template schema parsing failures.

**Root cause:** An agent during the pipeline ran `npm install zod` (or `npm install` without `--frozen-lockfile`) which resolved to zod 4.x since `"zod": "3.22.3"` in package.json doesn't have a caret but npm's resolution might pick a newer version.

**Fix:**
1. Pin zod in package.json: `"zod": "3.22.3"` (no caret)
2. Add `--frozen-lockfile` to any `npm install` calls in the pipeline
3. Add a workspace init check that validates zod version matches Remotion requirements
4. Add to Animator/Setup Agent prompts: "NEVER run `npm install` for packages already in package.json"

---

## Issue 9: `render_still` Produces Black Frames — Visual Verification Broken (CRITICAL)

**Impact:** ALL render_still calls produce identical black 1920×1080 frames regardless of frame number. The Animators' visual verification step is completely useless — they can't see what they built.

**Evidence:**
```
still-10.png:           34,418 bytes  (16:13)  MD5: fe75da4d...
still-50.png:           34,418 bytes  (16:43)  MD5: fe75da4d... (IDENTICAL)
validate-still-10.png:  34,418 bytes  (16:10)  MD5: fe75da4d... (IDENTICAL)

PNG dimensions: 1920 × 1080   ← WRONG
Manifest canvas: 1080 × 1920  ← CORRECT (portrait)
```

All three stills are byte-identical across different frames and different timestamps.

**Root cause:** `Root.tsx` uses `calculateMetadata` to fetch the manifest:
```tsx
calculateMetadata={async () => {
    try {
        const res = await fetch(staticFile('manifest.json'));
        const manifest = await res.json();
        return { props: { manifest }, durationInFrames, fps, width, height };
    } catch (err) {
        console.error('calculateMetadata error:', err);
        return {};  // ← SILENT FALLBACK
    }
}}
```

When `calculateMetadata` fails, it returns `{}`, and Remotion uses defaultProps:
```tsx
defaultProps={{
    manifest: {
        canvas: { width: 1920, height: 1080 },  // ← Wrong orientation
        tracks: [],
        items: [],   // ← Empty! Nothing renders.
        assets: {},
    },
}}
```

Result: 1920×1080 black frame with zero items. The `staticFile('manifest.json')` fetch likely fails in Remotion CLI's headless mode — either the static file server isn't starting or the manifest can't be fetched.

**Fix:**
1. **Immediate:** Change `render_still` to pass manifest as props directly instead of relying on `calculateMetadata`:
   ```ts
   // In render-still.ts, pass manifest as input-props:
   `--props=${JSON.stringify({ manifest: require('/workspace/manifest.json') })}`
   ```
2. **Better:** Add error propagation to `calculateMetadata` — throw instead of returning `{}` so Remotion aborts with a clear error
3. **Also fix:** Update defaultProps to match expected orientation (1080×1920) as a safety net

---

## Issue 10: `country-highlight` Dependency Not Forked by `fork_template` (MEDIUM)

**Impact:** `magazine-country` template's `index.tsx` imports from `../country-highlight/` which is a SEPARATE template in S3. `fork_template` downloads only the requested template — it doesn't resolve cross-template imports.

**Evidence:**
```
S3: /templates/magazine-country/source/index.tsx imports from '../country-highlight/'
S3: /templates/country-highlight/ exists as separate template
Sandbox: /workspace/src/components/templates/country-highlight/ → NOT FOUND
```

**Fix options:**
1. Add dependency resolution to `fork_template` — parse imports, detect cross-template refs, fork dependencies too
2. Bundle `country-highlight` INTO `magazine-country`'s source (eliminate the cross-dep at upload time)
3. Mark `magazine-country` as depending on `country-highlight` in `registry.json` metadata

---

## Issue 12: Three Cascading Prompt Contradictions Cause Template Non-Usage (CRITICAL)

**Impact:** This is the ROOT CAUSE of Issue 6. Agent tracing of JSONL logs inside the container reveals three cascading failures where prompts contradict each other, causing every Animator to build from scratch.

### Failure 1: Setup Agent Violates Its Own Prompt

Setup Agent system prompt (`packages/sandbox/src/prompts/setup-agent/system.md` line 290) says:
> **"Do NOT fork templates yourself."** Each Animator should handle its own fork.

**What actually happened:** The Setup Agent called `mcp__templates__fork_template` for all 8 templates during Phase 4, forking them to `src/components/templates/magazine-*/`.

This pre-empted the Animators' workflow. They no longer need to call `fork_template`, which bypasses the step that would have placed templates at `src/scenes/template-<slug>/` (the path the thin-wrapper import pattern expects).

### Failure 2: Orchestrator Dispatch Message Contradicts System Prompt

The Animator system prompt says:
> "Write your SceneN.tsx as a **thin wrapper** that imports and renders the template component."

But the Orchestrator's dynamically generated dispatch message (sent to each Animator) says:
> "Fork and study: `magazine-didyouknow` — The forked template is at `/workspace/src/components/templates/magazine-didyouknow/`. Read the index.tsx and magazine/ subdirectory to understand the animation patterns... **Adapt these patterns into your scene.**"

"Adapt these patterns" ≠ "use as thin wrapper." The dispatch is the most recent, most specific instruction — Animators follow it over the system prompt.

### Failure 3: All 8 Animators Follow Dispatch, Not System Prompt

From JSONL trace:
- 0/8 Animators called `fork_template` (templates already forked by Setup Agent)
- 0/8 Animators mentioned "thin wrapper" in their reasoning
- 0/8 scenes import a template component as main render
- 8/8 scenes cherry-pick utilities and build custom 425-805 line implementations

Only Scene 3 (Algeria) explicitly acknowledged a limitation: "The country-highlight components don't exist... I'll build from scratch, adapting the editorial/magazine patterns." The other 7 silently chose the same approach.

### Root Cause Chain

```
Setup Agent prompt says "don't fork" → Setup Agent forks anyway → templates land at wrong path
                                                                          ↓
Orchestrator sends "adapt patterns" instead of "use as thin wrapper" → Animators adapt, don't wrap
                                                                          ↓
Templates have hardcoded 1080x1920 + narrow props → even if wrapping attempted, it wouldn't work
```

Three independent failures reinforce each other. Even fixing one wouldn't fix the outcome.

### Fix (all three must be fixed):

1. **Setup Agent prompt:** Either keep "don't fork" and enforce it, OR officially delegate forking to Setup Agent and update ALL downstream prompts to match the new path (`src/components/templates/<slug>/`)
2. **Orchestrator dispatch generation:** Change the dispatch template in `packages/sandbox/src/orchestrator.ts` from "adapt patterns" to "use as thin wrapper — import the default export from the forked template and render it with your scene's data"
3. **Template architecture (Issue 6):** Fix templates to actually BE wrappable — accept dimensions, timing, and flexible content props

---

## Issue 13: `fork_template` Tool Gaps (MEDIUM)

**Impact:** The `fork_template` MCP tool (`packages/sandbox/src/tools/template-tools.ts`) has several gaps that contribute to template failures.

**Findings from code audit:**

1. **Import rewriting only handles 2+ `../` levels** (lines 175-181):
   ```ts
   .replace(/from\s+['"](?:\.\.\/){2,}([^'"]+)['"]/g, `from './$1'`)
   ```
   Single-level relative imports (`../foo`) are NOT rewritten. This means any template importing from `../country-highlight/` (one level up) won't have its imports fixed.

2. **No cross-template dependency resolution:** The tool downloads only the requested template's files. If `magazine-country` references `country-highlight`, the dependency is not auto-fetched. The `register.ts` for magazine-country DOES list country-highlight files in its `getFiles()`, but `fork_template` doesn't use `register.ts` — it just lists S3 objects by prefix.

3. **No file completeness verification:** After download, the tool only checks `objects.length > 0`. It doesn't verify that `index.tsx`, `schema.ts`, or the `magazine/` shared library are present.

4. **No compilation check:** After forking, the tool doesn't run `tsc` or `esbuild` to verify the forked code compiles.

**Fix:**
1. Rewrite ALL relative imports (not just 2+ levels)
2. Add dependency metadata to template registry — `fork_template` should check for deps and fork them too
3. Validate required files exist after fork (`index.tsx`, `schema.ts`)

---

## Issue 11: Interpolate Clamping Patterns Vary (INFO)

**Status:** All 8 scenes properly clamp all interpolations. Scenes 1-7 use inline syntax; Scene8 uses a DRY `const clamp` variable.

**Recommendation:** Standardize on the `const clamp` pattern in Animator prompt to reduce tokens.

---

## Issue 14: Post-Animation Agent Stuck — Context Explosion + Phase Replay (CRITICAL)

**Impact:** After all 8 Animators complete their scene code, the agent takes 20+ minutes to finish and may never complete. On session resume, the entire animation phase re-runs from scratch, doubling cost and time. Total cost for one video: **$22.42**.

**Evidence from container logs** (session `490b25e8`):

### Timeline of First Run
| Phase | Timestamp | Duration | Tool Calls |
|-------|-----------|----------|------------|
| Phases 1-5 (Brief→Layout) | start→1774282627693 | ~9 min | 65 |
| Phase 6: 8 Animators dispatched | 1774282627693→1774282724382 | 97s dispatch | 8 Agent calls |
| Animators working (parallel) | 1774282724382→~1774283486679 | **12.7 min** | Context compacting |
| Phase 7: Orchestrator reads all scenes | 1774283486679→1774284422780 | **15.6 min** | 70+ reads/validates |
| Phase 7: Final Editor Agent | 1774284422780→1774285036200 | **10.2 min** | Agent subagent |
| render_still ×3 (all black) | 1774285208820→1774285580992 | **6.2 min** | 3 render calls |
| Final validation + completion | 1774285580992→1774285709040 | **2.1 min** | Validates + reports |
| **First run total** | | **21.9 min** | **165 tool uses, 8180 messages, $20.95** |

### Session Resume Disaster
| Event | Duration | Cost |
|-------|----------|------|
| Resume #1: Quick user response | 13s | $0.62 |
| Resume #2: Trigger rebuild | 53s | $0.86 |
| **Resume #3: RE-DISPATCHES ALL 8 ANIMATORS** | 11+ min (never completed) | Unknown |
| SSE client disconnects | Frontend gives up | |
| Container continues burning resources | ... | ... |

### Root Causes (4 compounding issues):

**A. Post-animation phase is extremely chatty (~20 min):**
After animators return, the orchestrator makes 70+ sequential tool calls: reading all 8 scene files, reading the manifest 5+ times, checking speaker positions, updating tracks, dispatching Final Editor, validating timeline, rendering stills. No parallelism.

**B. render_still black frames → confusion loops:**
Each `render_still` takes 60-70 seconds and returns a black frame (Issue #9). The orchestrator/Final Editor tries 3 times, wastes 3-4 minutes, and gets confused by blank output it can't diagnose.

**C. 32 context compactions:**
The session accumulated 8,180 messages. The SDK compacted context 32 times during the run. Each compaction re-initializes all 70 tools and 9 MCP servers. Overhead adds up.

**D. Session resume replays Phase 6:**
On the 4th resume, the orchestrator created a TodoWrite, edited files, then dispatched 8 NEW Animator agents — repeating all of Phase 6. The resumed orchestrator either lost context about already-completed work (context compaction erased it) or decided a re-do was needed. This is the single biggest time sink.

**E. Subagent completion tracking is broken:**
Zero `"Subagent completed"` log entries exist despite 16+ subagent dispatches. The `processStream` handler at line 624-650 of `orchestrator.ts` never fires because SDK v0.1.x doesn't surface `tool_result` messages for `Task` calls as `user` type messages. This means:
- Progress tracking never shows subagent completion to the frontend
- Post-subagent checkpoints never fire
- The frontend has no way to know when individual animators finish

### Fix:

1. **Reduce post-animation work:** The orchestrator should NOT read all 8 scene files after animators complete — each animator already validated their own code. Phase 7 should only validate the manifest and do 1 render_still.

2. **Fix render_still (Issue #9):** Without this, every post-animation verification step is wasted time.

3. **Prevent Phase replay on resume:** Add a phase marker file (e.g., `/workspace/.pipeline-phase`) that the orchestrator checks on resume. If Phase 6 already completed, skip to Phase 7.

4. **Fix subagent completion tracking:** Either upgrade to SDK v0.2+ that surfaces tool_result for Task calls, or add an alternative mechanism (file-based signaling) for the orchestrator to know when subagents finish.

5. **Limit context growth:** Cap `maxTurns` to something realistic (currently 100 for orchestrator, 60 per animator = up to 580 total turns). Consider clearing intermediate context after each phase boundary.

---

## Summary Table

| # | Issue | Severity | Category |
|---|-------|----------|----------|
| 14 | Post-animation stuck — context explosion + phase replay | CRITICAL | Pipeline architecture |
| 12 | Three cascading prompt contradictions | CRITICAL | Root cause of template failure |
| 9 | render_still produces black frames | CRITICAL | Rendering broken |
| 6 | Templates incompatible as wrappers | CRITICAL | Architecture gap |
| 8 | Zod 4.x overwrites 3.x at runtime | HIGH | Dependency corruption |
| 1 | tsc missing from Docker image (--omit=dev) | HIGH | Docker build |
| 13 | fork_template tool gaps | MEDIUM | Tool implementation |
| 10 | country-highlight not forked with magazine-country | MEDIUM | fork_template gap |
| 2 | Excessive browse_templates calls | MEDIUM | Agent efficiency |
| 3 | SVG stroke language in scene plans | MEDIUM | Prompt gap |
| 4 | Missing shared prompt modules | MEDIUM | Prompt gap |
| 7 | Duplicate template fork | LOW | Agent confusion |
| 5 | Setup Agent forks (not Animators) — docs wrong | LOW | Docs |
| 11 | Clamping pattern variance | INFO | Style |

## Priority Fix Order

1. **Issue 9** (render_still black frames) — Without visual verification, the entire quality loop is broken. Fix: pass manifest as `--props` to Remotion CLI.
2. **Issue 14** (post-animation stuck) — Phase replay on resume doubles cost/time. Fix: add phase markers, reduce post-animation tool calls, fix subagent tracking.
3. **Issue 8** (zod mismatch) — Corrupts Remotion internals. Fix: pin zod 3.22.3, add `--frozen-lockfile`.
4. **Issue 12** (prompt contradictions) — The root cause of template non-usage. Fix orchestrator dispatch template, align Setup Agent behavior with prompts, decide on canonical template workflow.
5. **Issue 6** (templates not wrappable) — Choose Option B (style library) for quick fix, or Option A (composable templates) if investing long-term.
6. **Issue 1** (tsc missing) — Move typescript to dependencies, or add explicit install in Dockerfile.
7. **Issue 13 + 10** (fork_template gaps) — Fix import rewriting, add dependency resolution, validate completeness.

## Key Metrics

| Metric | Expected | Actual |
|--------|----------|--------|
| render_still visual verification | Working | Broken — all black |
| Manifest orientation | 1080×1920 (portrait) | Renders as 1920×1080 |
| Template component wrapper usage | 8/8 scenes | 0/8 scenes |
| Template utility imports | 8/8 scenes | 6/8 scenes |
| Average scene size (wrapper) | ~20 lines | 618 lines |
| Total scene code (wrapper) | ~160 lines | 4,943 lines |
| Interpolate clamping | 100% | 100% (correct) |
| Zod version match | 3.22.3 | 4.3.6 (mismatch) |
| tsc available at startup | Yes | No (self-heals after 46 min) |
| Duplicate template forks | 0 | 1 (Scene2) |
| Missing template deps | 0 | 1 (country-highlight) |
| Esbuild bundle includes all scenes | Yes | Yes (8/8) |
| SVG stroke in scene code | 0 scenes | 1 scene (Scene3 — filled paths, borderline) |
| Background component in overlay | 0 scenes | 0 scenes (correct) |
| Post-animation completion time | < 5 min | 20+ min |
| Context compactions per run | 0-5 | 32 |
| Session resume replays Phase 6 | No | Yes (re-dispatches all 8 animators) |
| Total cost per video | ~$5 | $22.42 |
| Subagent completion tracked | Yes | No (0 events logged) |
