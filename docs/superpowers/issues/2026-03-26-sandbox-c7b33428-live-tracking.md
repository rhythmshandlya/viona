# Sandbox c7b33428 — Live Issue Tracking

**Container**: `c7b33428ac4fe2c9e033827861d9cd25d10ec57c182fff23a724abc07ba6da3e`
**Video**: `Algeria_testsample.mp4` (65.8s, 1080x1920 portrait)
**Started**: 2026-03-26T16:48:39Z
**Model**: claude-opus-4-6
**Session**: dfcd7598-2bfb-47e8-b3d5-8c03b9806447

## Timeline

| Time (UTC) | Event | Notes |
|---|---|---|
| 16:48:39 | Container started | |
| 16:48:44 | Workspace init begins | Source video download |
| 16:49:09 | Video downloaded | Duration: 65835ms |
| 16:49:32 | Workspace initialized | Git repo, esbuild watcher |
| 16:49:52 | Orchestrator session established | 70 tools, 9 MCP servers, 0 failed |
| 16:50:05 | Reads CLAUDE.md, transcript, brief | |
| 16:50:23 | `report_plan` called (initial) | |
| 16:50:23 | `report_progress` — step 1 | |
| 16:50:31 | Trim Editor subagent dispatched | Full video, no trims needed |
| 16:51:14 | Trim Editor completed | |
| 16:51:20 | `report_plan` updated (post-trim) | |
| 16:51:21 | `get_shot_boundaries` called | Entering visual planning phase |
| 16:51:06–16:53:39 | 14x `browse_templates` + Reads/Greps | Heavy template browsing phase |
| 16:55:49 | SCENE_PLAN.md written | 7 scenes, magazine theme |
| 16:56:06 | Plan edited (revision) | |
| 16:56:31 | Planner subagent completed | |
| 16:57:08 | Orchestrator completed 1st session | $2.27, 57 tool uses, 17 turns |
| 16:58:30 | Session resumed (2nd) | |
| 16:58:58 | Setup Agent dispatched | Scaffolding 7 scenes |
| 16:59:38 | 5 templates forked | country-highlight, definition, timeline, stats, versus |
| 17:02:08 | Setup Agent completed | 7 scene scaffolds + scenes.json |
| 17:03:47 | Layout Editor dispatched | |
| 17:04:14 | Scene items added to manifest | 7 items, correct positions |
| 17:06:16 | Layout Editor completed | ~5.5 min, verified with render stills |
| 17:10:03 | Animator Scene 1 dispatched | Parallel fire-and-forget |
| 17:10:17 | Animator Scene 2 dispatched | All 7 animators running in parallel |
| 17:10:30 | Animator Scene 3 dispatched | |
| 17:10:44 | Animator Scene 4 dispatched | |
| 17:10:58 | Animator Scene 5 dispatched | |
| 17:11:11 | Animator Scene 6 dispatched | |
| 17:11:30 | Animator Scene 7 dispatched | |
| 17:12:53 | Scene 1 animation completed | 504 lines, custom scene |
| 17:13:xx | Templates modified | country:457, definition:306, timeline:603, versus:450, stats:182 |
| 17:16:16 | Orchestrator detects Scene 2 overwrite | URGENT FIX dispatched |
| 17:16:16 | Scene 2 rewritten standalone | 457 lines |
| 17:17:29 | Final Editor dispatched | Caption styling, validation |
| 17:17:29 | Final Editor completed | Stills verified |
| 17:19:40 | TS fix agent dispatched | Unused import cleanup |
| 17:19:59 | TS fix agent completed | 5 edits |
| 17:20:03 | Post-fix workspace validation | |
| 17:22:xx | Final verification stills | Bundle v15 |
| 17:26:24 | **Orchestrator COMPLETED** | $12.52 total, 161 tool uses, 17 turns |
| 17:26:38 | Final checkpoint | Pipeline done |

## Summary

**Total pipeline duration**: ~38 minutes (16:48:39 → 17:26:38)
**Total cost**: $12.52 (across all sessions + parallel subagents)
**Scenes produced**: 7 (all animated)
**Template usage**: 6/7 scenes use templates
**Critical issues**: 2 (shared template overwrite, map tile system not used)

## Issues Found

### ISSUE-1: Scene 1 & 2 below 210-frame minimum (SEVERITY: HIGH)
- Scene 1: 0–5720ms = **171 frames** (min 210)
- Scene 2: 5720–10460ms = **142 frames** (min 210)
- Our validation enforces min 210 frames. If this isn't auto-corrected, these scenes will be too short for meaningful animation.
- **Status**: NOT CAUGHT — plan validation did not flag this

### ISSUE-2: Scene 1 "shattering shield" — SVG complexity risk (SEVERITY: MEDIUM)
- Animation brief: "shield shape cracks and fragments, each fragment tumbles with different rotation"
- Per our feedback: NO hand-drawn SVG paths, typography-first restraint, max 5 elements
- Shattering fragments = many SVG pieces = exactly what looks cheap
- **Status**: RESOLVED — implemented with CSS clip-path wedges (not SVG), 8 fragments is above max-5 rule but manageable
- Scene1.tsx uses proper clamping, canvas-relative sizing, spring configs

### ISSUE-3: Scene 3 "cartographic ink outline of Algeria" — SVG map risk (SEVERITY: HIGH)
- Drawing a country outline as SVG path is the highest-risk animation pattern we have
- Per feedback: stop using curved/organic lines, use straight clean geometric
- A country border IS organic curves by definition
- Uses `magazine-country` template (457 lines) — need to review implementation
- **Status**: PENDING REVIEW — need to read magazine-country/index.tsx

### ISSUE-4: Scene 7 "balance scale" — complex SVG prop (SEVERITY: LOW)
- Balance scale is geometric but multi-part (beam, pans, fulcrum, weights)
- Uses `magazine-versus` template (450 lines) — likely geometric shapes
- **Status**: PENDING REVIEW

### ISSUE-5: Stacked scenes use wrong displayMode name (SEVERITY: LOW)
- Scenes 4 & 5 have `displayMode: "split-screen"` in manifest
- Plan specifies "Stacked [50/50]" and self-verification says "no split-screen"
- Actual positions are correct (1080x960 top half)
- **Status**: Naming mismatch only — functional layout is correct

### ISSUE-6: Orchestrator session cycling (SEVERITY: MEDIUM)
- Orchestrator has restarted its SDK session 6+ times
- Each restart: report_plan → report_progress → SDK init
- Message count: 1st=3836, then 4360, 4552, 4737, 4961, 5706, 5725
- Likely hitting context limits and auto-compressing
- **Status**: MONITORING — may affect quality of later decisions

### ISSUE-7: Shared template overwrite — Scene 2 lost (SEVERITY: HIGH)
- Scene 2 and Scene 3 both use `magazine-country` template
- Scene 3's animator overwrote Scene 2's animation code in the shared template file
- Orchestrator detected this and dispatched "URGENT FIX" animator to rewrite Scene 2 standalone
- **Status**: FIX IN PROGRESS — watching for Scene2.tsx to be rewritten
- **Root cause**: Multiple scenes should NOT share the same template file path. The setup agent should have created separate copies (e.g., `magazine-country-scene2/` and `magazine-country-scene3/`)

### ISSUE-8: magazine-stats template may be under-animated (SEVERITY: RESOLVED)
- Only 182 lines for Scene 6 (the $390M consequences scene)
- REVIEWED: Uses shared theme components (TornEdge, PaperTexture, SerifHeadline, etc.) that do heavy lifting
- Animation quality is good: count-up hero number, staggered reveals, proper clamping
- **Status**: RESOLVED — line count is low but quality is good due to component reuse

### ISSUE-9: magazine-country ignores real map tile system (SEVERITY: HIGH)
- The `country-highlight` template was forked with MapTileGrid, CountryOverlay, geo-utils, tile-math
- But the animator for Scene 3 (Algeria) **ignored all of it** and drew a manual SVG polygon approximation
- The `ALGERIA_PATH` uses only straight `L` segments (no curves) — geometry is acceptable
- But the real map rendering system (MapTileGrid.tsx, camera.ts, countries.ts) was NOT used
- This means no actual map tiles, no proper country data, no camera zoom
- **Status**: CONFIRMED — animator should have used the available map components
- **Root cause**: The setup agent forked both `country-highlight` AND `magazine-country` separately. The animator working on `magazine-country` may not have known about the `country-highlight` components. The fork should have been a single merged template.

### ISSUE-10: TypeScript errors in templates (SEVERITY: LOW)
- Post-final-editor, orchestrator detected unused imports across template files
- Dispatched general-purpose fix agent to clean up
- 5+ Edit calls to remove unused imports
- **Status**: FIXED by cleanup agent

### ISSUE-11: Scene 2 fix — standalone rewrite quality unknown (SEVERITY: MEDIUM)
- Scene 2 was rewritten to 457-line standalone file after template overwrite
- Need to verify it matches the original plan (China & India dossier comparison)
- **Status**: PENDING REVIEW

| 17:17:29 | Final Editor completed | Caption styling, validations |
| 17:17:36 | Orchestrator dispatched TS fix agent | Unused import cleanup |
| 17:18:00 | Fix agent cleaning imports | 5+ Edit calls |

## Animation Quality Notes

### Positive patterns:
- Good template coverage (6/7 scenes use templates)
- Layout variety: overlay/stacked/fullscreen well distributed
- Theme consistency (all magazine)
- Self-verification checklist is thorough
- Good metaphor variety across scenes
- Typography emphasis with "hero numbers" and counts (Scenes 4, 6)
- Scene 1 animation quality: good clamping, canvas-relative sizing, CSS-only (no SVG)
- Scene 3 (Algeria): straight-line polygon, proper escalation ring animation, good typography
- Scene 6 ($390M): strong count-up animation, proper editorial layout, torn edges
- Deterministic randomness via Remotion's `random()`
- All scenes use `s()` canvas-relative sizing function
- All reviewed scenes have proper `extrapolateLeft/Right: 'clamp'`

### Concerns:
- Two scenes are dangerously short (171, 142 frames) — NOT validated by plan validation
- Shared template overwrite issue — critical pipeline bug (Scene 2 had to be rewritten)
- Orchestrator cycling through SDK sessions rapidly — context pressure (6+ restarts)
- magazine-country did not use available map tile system — hand-drew SVG polygon instead
- Scene 2 standalone rewrite quality unverified

### ISSUE-12: Frontend track type mismatch — "overlay" vs "visual" (SEVERITY: HIGH)
- **Sandbox/backend** creates tracks with `type: 'overlay'`, name `"Scenes"` and items with `type: 'scene'`
- **Frontend store** internally uses `type: 'visual'` for tracks and items, name `"Visuals"`
- `manifest-bridge.ts:120` — manifest→store: `overlay` stays as `overlay` (NOT converted to `visual`)
- `manifest-bridge.ts:197` — store→manifest: `visual` → `overlay` (correct reverse mapping)
- `manifest-bridge.ts:355-363` — `scene` items are converted to `type: 'visual'` in the store
- **But** `editor-store.ts:312-325` auto-creates a `type: 'visual'`, name `"Visuals"` track if visual items exist without a visual track
- **Result**: Store has the original `overlay`/"Scenes" track from the manifest AND a new auto-created `visual`/"Visuals" track → **duplicate tracks**
- `editor-store.ts:915-917`: If visual items disappear, it removes the `visual` track entirely → track gets cleared
- **Root cause**: `manifest-bridge.ts:120` should map `overlay` → `visual` on import so the store recognizes the backend track as the visual track, preventing the auto-create
- **Files**:
  - `apps/web/src/features/editor-v2/store/manifest-bridge.ts:120` — missing `overlay` → `visual` mapping
  - `apps/web/src/features/editor-v2/store/editor-store.ts:312-325` — auto-creates duplicate track
  - `apps/web/src/features/editor-v2/store/editor-store.ts:906-917` — removes track when items disappear
- **Fix**: Either map `overlay` → `visual` in manifest-bridge import, or make the editor-store check for both `overlay` and `visual` track types

### ISSUE-13: Orchestrator dispatch doesn't describe what templates DO (SEVERITY: HIGH)
- The orchestrator dispatches animators with: "Template: magazine-country — already forked by Setup Agent to src/components/templates/magazine-country/"
- It does NOT describe what the template provides (e.g., "renders real map tiles with MapTileGrid, CountryOverlay, camera systems from country-highlight — adapt the props")
- The animator's system prompt says "read the template first" and "REJECTED if you rewrite" — but this isn't enough when the template has complex domain-specific code (geo rendering, tile math, camera systems)
- **Evidence**: When the user told the agent directly "country highlight template was literally built for this, you are not using it properly, analyze it and try to modify" — the agent immediately did it correctly, adapting the template with surgical edits
- This proves the model CAN adapt complex templates — it just needs to be told what the template does, not just its slug
- **Root cause**: `packages/sandbox/src/prompts/orchestrator/system.md:186` — dispatch instruction only says "Template: <slug> — already forked". Missing: a brief description of the template's capabilities
- **Fix options**:
  1. Orchestrator prompt should instruct: "Read the template's meta.json description AND its index.tsx imports before dispatching. Include a 1-2 sentence summary of what the template provides (e.g., 'this template renders real map tiles with MapTileGrid + CountryOverlay from country-highlight — adapt props, do NOT rewrite the rendering')"
  2. Or: the `fork_template` tool should return a capabilities summary that gets included in the dispatch
  3. Or: the setup agent could write a `TEMPLATE_NOTES.md` per scene describing what each forked template does and how to adapt it
- **Scope**: This affects ALL template-based scenes, not just magazine-country. Any template with complex sub-components (charts, maps, comparisons with custom components) is at risk of being rewritten
