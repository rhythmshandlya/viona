# Template System Reliability Overhaul

**Date:** 2026-03-24
**Status:** Draft
**Goal:** Make the template fork-from-S3 mechanism bulletproof so the agent can reliably select, fork, and use magazine templates without crashes or confusion.

---

## Problem Statement

The current template system has four classes of failures:

1. **Import rewriting fragility** — Four separate regex-based import rewrites (`build-registry.ts`, `build-templates.ts`, `upload-templates.ts`, `template-tools.ts`) with different logic. Each assumes the others ran correctly. Subtle mismatches cause templates to fork with broken imports.

2. **Silent dependency detection** — Shared libraries (magazine/, blackboard/) are detected by grepping source files for import patterns like `/from\s+['"](?:\.\.\/){2,}magazine\//`. If import syntax changes, templates ship without dependencies and crash at render time.

3. **Poor template discoverability** — Similar templates (magazine-comparison vs magazine-versus vs magazine-proscons) have vague descriptions. The agent picks the wrong template because `meta.json` doesn't explain when to use each one. False constraints (`aspectRatio: "9:16"`, `estimatedDuration: "5s"`) imply templates are locked to specific dimensions and durations.

4. **Sandbox integration gaps** — No validation between pipeline phases. Setup Agent parses template slugs from markdown with no guidance. Fork results are ignored. Animators have no recovery path if templates are missing. Checkpoint/restore may lose forked template files.

Additionally, all 27 magazine templates hardcode pixel values (1080x1920), font sizes, and frame counts. They don't use the `useScale()` hook that explainer templates already use successfully. This prevents them from working at different canvas sizes or durations.

---

## Non-Goals

- Changing the fork-from-S3 architecture (no move to npm packages or pre-built bundles)
- Pre-installing shared libraries in the base workspace (keeping per-template copies)
- Merging the three build scripts into one
- Changing template visual design (torn paper, tape marks, color palettes)

---

## Section 1: Merge Dependency Manifest into `meta.json`

### Problem

Shared library detection uses regex scanning of source files. Each build script and the fork tool independently scan for import patterns. If a template changes its import syntax slightly, dependencies are silently missed.

### Design

Instead of creating a separate `template.json` file, merge build-time dependency fields directly into `meta.json`. This avoids maintaining two metadata files per template with redundant slug fields and a three-way consistency check.

**Rationale:** `meta.json` is the single metadata file per template. Adding build-internal fields to it is cleaner than a separate manifest — there's no reason to keep them apart since both are read by build scripts and neither is user-facing.

New fields added to `meta.json`:

```json
{
  "slug": "magazine-comparison",
  "name": "Magazine Comparison",
  "description": "...",
  "sharedLibs": ["magazine", "fonts", "use-scale"],
  "npmDependencies": {},
  "siblingTemplates": []
}
```

**New dependency fields:**

| Field | Type | Purpose |
|-------|------|---------|
| `sharedLibs` | `Array<"magazine" \| "blackboard" \| "fonts" \| "use-scale">` | Shared libraries this template imports |
| `npmDependencies` | `Record<string, string>` | npm packages beyond base workspace deps (validated at build time against workspace `package.json` — see Section 6b) |
| `siblingTemplates` | `string[]` | Other templates this template imports from |

**What this replaces:**
- `detectSharedDeps()` regex in `build-registry.ts`
- `/from\s+['"](?:\.\.\/){2,}magazine\//` regex in `upload-templates.ts`
- Sibling template scanning in `build-templates.ts`
- Fork tool guessing about npm dependencies

**Validation:** Build scripts Zod-validate `meta.json` at load time. Missing or invalid fields are hard errors, not silent skips.

### Files Changed

- Modified: `packages/templates/src/templates/*/meta.json` (50+ files — add `sharedLibs`, `npmDependencies`, `siblingTemplates`)
- Modified: `packages/templates/scripts/build-registry.ts` — read `sharedLibs` from meta instead of `detectSharedDeps()`
- Modified: `packages/templates/scripts/build-templates.ts` — read `siblingTemplates` from meta instead of scanning
- Modified: `packages/templates/scripts/upload-templates.ts` — read `sharedLibs` from meta instead of regex detection

---

## Section 2: Enriched Template Metadata (`meta.json`)

### Problem

Similar templates have vague descriptions. The agent can't distinguish magazine-comparison from magazine-versus from magazine-proscons. False fields (`aspectRatio`, `estimatedDuration`, `stylePreset`) suggest templates are locked to specific dimensions and durations when they're not — templates are React components that render at whatever canvas size the manifest specifies.

### Design

Add three fields. Remove three fields.

**New fields:**

| Field | Type | Required | Purpose |
|-------|------|----------|---------|
| `useCase` | `string` | Yes | One sentence: when should the agent pick this template? |
| `bestFor` | `string[]` | Yes (min 1) | Concrete content examples the agent matches against |
| `notFor` | `string[]` | No | Explicitly redirects to the correct template for common mis-picks |

**Removed fields:**
- `aspectRatio` — canvas-level setting, not a template property
- `estimatedDuration` — determined by scene plan and transcript, not the template
- `stylePreset` — vestigial from old shadcn-style registry format

**Example (magazine-comparison) — complete `meta.json` with all fields from Sections 1 and 2:**

```json
{
  "slug": "magazine-comparison",
  "name": "Magazine Comparison",
  "description": "Side-by-side torn paper scraps comparing two subjects with a red center divider and parallax push-pull",
  "useCase": "Structured comparison of two things across multiple categories (e.g. iPhone vs Android across price, battery, camera)",
  "bestFor": ["product comparisons", "feature-by-feature analysis", "A vs B with multiple dimensions"],
  "notFor": ["simple winner/loser matchups (use magazine-versus)", "pros and cons lists (use magazine-proscons)", "ranked lists (use magazine-ranking)"],
  "category": "overlay",
  "tags": ["magazine-theme", "comparison"],
  "themes": ["magazine"],
  "sharedLibs": ["magazine", "fonts", "use-scale"],
  "npmDependencies": {},
  "siblingTemplates": []
}
```

**Confusable clusters requiring `notFor`:**
- magazine-comparison / magazine-versus / magazine-proscons
- magazine-ranking / magazine-takeaways / magazine-steps
- magazine-stats / magazine-pricetag / magazine-verdict
- explainer-comparison / magazine-comparison

### Files Changed

- Modified: `packages/templates/src/templates/*/meta.json` (50+ files)
- Modified: `packages/templates/scripts/build-registry.ts` — remove `stylePreset`, `aspectRatio`, `estimatedDuration` from output
- Modified: `packages/templates/src/types.ts` — update `TemplateMeta` type
- Modified: `packages/templates/registry.json` — rebuilt without removed fields
- Modified: `packages/api/src/routes/templates.ts` — remove removed fields from API response if present
- Modified: `packages/templates/scripts/upload-templates.ts` — stop writing removed fields to DB; upload `use-scale.ts` and `fonts.ts` alongside magazine/blackboard shared libraries when declared in `sharedLibs` (currently only magazine/ and blackboard/ are uploaded, but `use-scale.ts` is missing from S3 — templates that import it after the responsiveness refactor would fail at fork time)
- Modified: DB migration — drop `aspect_ratio` column default or make it nullable (currently defaults to `'16:9'`)

---

## Section 3: Centralized Import Rewriting

### Problem

Import rewriting happens in 4 separate places with different regex patterns and depth assumptions. The build-registry pre-rewrites to prevent the build-templates regex from double-matching. This multi-stage dance is the fragility core.

### Design

A single shared utility in `packages/shared/src/rewrite-imports.ts` (the `@viona/shared` package):

**Why `@viona/shared`:** The utility is consumed by both `packages/templates/scripts/` (build-time) and `packages/sandbox/src/tools/template-tools.ts` (runtime in Docker). The sandbox package does not depend on the templates package, so the utility must live in a shared package that both can import. `@viona/shared` already exists and is a type-only dependency of sandbox — this adds one runtime export.

```ts
export function rewriteImports(
  source: string,
  fileDepth: number,
  sharedLibs: string[],
): string
```

**Parameters:**
- `source` — file content
- `fileDepth` — 0 for root files (`index.tsx`), 1 for `components/X.tsx`, etc.
- `sharedLibs` — from `meta.json`, determines which `../../` paths are valid

**Logic:**
1. Match all `from '../../anything'`, `import '../../anything'`, and `import('../../anything')` patterns (static imports, side-effect imports, and dynamic imports)
2. For each match, check if the imported path starts with a known shared lib
3. Rewrite to the correct depth-relative path (`./` for root, `../` for depth-1)
4. **Throw on unrecognized `../../` imports** — catches accidental escapes instead of silently mangling them

**Consumers:**
- `build-registry.ts` — calls it when inlining source into `r/{slug}.json`
- `build-templates.ts` — calls it when copying to `_resolved_source/`
- `template-tools.ts` (fork tool) — calls it after downloading from S3
- `upload-templates.ts` — no longer needs dependency detection (reads `meta.json`)

### Files Changed

- New: `packages/shared/src/rewrite-imports.ts`
- Modified: `packages/shared/package.json` — add export for `rewrite-imports`
- Modified: `packages/templates/scripts/build-registry.ts` — replace inline regex with `rewriteImports()`
- Modified: `packages/templates/scripts/build-templates.ts` — replace inline regex with `rewriteImports()`
- Modified: `packages/sandbox/src/tools/template-tools.ts` — replace inline regex with `rewriteImports()`
- Modified: `packages/sandbox/package.json` — `@viona/shared` becomes a runtime dep (not just type-only)

---

## Section 4: Build Pipeline Validation

### Problem

Invalid templates are silently skipped. Missing files cause runtime crashes. No schema validation for `meta.json` or `metadata.json`. Build scripts `console.warn()` and continue instead of failing.

### Design

**4a. Zod schemas for all template metadata**

New file `packages/templates/src/lib/template-schemas.ts`:

```ts
const MetaSchema = z.object({
  // Identity
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  description: z.string().min(10),
  // Discoverability (Section 2)
  useCase: z.string().min(10),
  bestFor: z.array(z.string()).min(1),
  notFor: z.array(z.string()).optional(),
  category: z.enum([
    'data-visualization', 'text-typography', 'comparison',
    'social-engagement', 'geographic', 'intro-outro',
    'timeline-process', 'media', 'marketing', 'education',
    'social', 'corporate', 'entertainment', 'overlay',
  ]),
  tags: z.array(z.string()),
  themes: z.array(z.string()).min(1),
  type: z.enum(['scene', 'overlay']).optional(),
  // Dependencies (Section 1)
  sharedLibs: z.array(z.enum(['magazine', 'blackboard', 'fonts', 'use-scale'])),
  npmDependencies: z.record(z.string()).default({}),
  siblingTemplates: z.array(z.string()).default([]),
});

const CompositionMetaSchema = z.object({
  compositionId: z.string(),
  durationInFrames: z.number().positive(),
  fps: z.number().positive(),
  width: z.number().positive(),
  height: z.number().positive(),
});
```

**4b. Validation checks (run before any build output)**

New script `packages/templates/scripts/validate-templates.ts`:

1. **Structural check** — every template directory must have: `meta.json`, `metadata.json`, `schema.ts`, `index.tsx`. Missing file = hard error.
2. **Schema validation** — parse all JSON files through Zod schemas. Invalid = hard error with field-level details.
3. **Slug consistency** — `meta.json` slug and directory name must match.
4. **Shared lib verification** — for each lib in `meta.json.sharedLibs`, verify source directory exists.
5. **Sibling template verification** — for each slug in `meta.json.siblingTemplates`, verify that template directory exists with valid `meta.json`.
6. **Import escape check** — scan all `.ts`/`.tsx` files for `../../` imports. Every match must resolve to a declared `sharedLib` or `siblingTemplate`. Undeclared escapes = hard error.
7. **`useScale()` enforcement** — every template `index.tsx` must import `useScale`. Catches the magazine hardcoding problem at build time.
8. **Removed fields check** — error if `meta.json` contains `aspectRatio`, `estimatedDuration`, or `stylePreset`.

**4c. Build scripts call validation first**

Each of the three build scripts calls `validateAllTemplates()` before doing any work. Shared template scanning and dependency reading is now shared code — scripts only differ in their output step.

### Files Changed

- New: `packages/templates/src/lib/template-schemas.ts`
- New: `packages/templates/scripts/validate-templates.ts`
- Modified: `packages/templates/scripts/build-registry.ts` — call validation first, read manifests
- Modified: `packages/templates/scripts/build-templates.ts` — call validation first, read manifests
- Modified: `packages/templates/scripts/upload-templates.ts` — call validation first, read manifests

---

## Section 5: Magazine Template Responsiveness

### Problem

All 27 magazine templates hardcode pixel values for 1080x1920 canvas, raw font sizes, and absolute frame numbers. The `useScale()` hook exists and works (explainer templates prove it) but magazines don't use it. This locks them to a single canvas size and prevents duration-relative animations.

### Design

**5a. Shared library fixes**

Changes to magazine shared utilities that affect all templates:

**`magazine/animations.ts`** — `paperSlide()` gains an optional `canvasSize` parameter for canvas-relative offsets. The existing signature stays backward-compatible so templates can be migrated incrementally (not all 27 atomically):

```ts
// New overload — canvas-relative offsets
export function paperSlide(
  frame: number, start: number, duration: number, direction: string,
  canvasSize?: { width: number; height: number },
)
// When canvasSize is provided, uses width*1.1 / height*1.05 for offsets
// When omitted, falls back to hardcoded 1080/1920 values (backward compat)
```

The backward-compatible fallback is removed once all 27 templates are migrated (Section 5b). A follow-up commit deletes the fallback and makes `canvasSize` required.

**`magazine/typography.tsx`** — `SerifHeadline`, `SectionLabel` accept pre-scaled `size` prop. Caller applies `s()`:
```tsx
<SerifHeadline size={s(49)} />
```

**`magazine/effects.tsx`** and **`magazine/textures.tsx`** — accept scaled dimensions from caller.

**`magazine/decorations.tsx`** — `TapeMark` (60-100px) and `PinMark` (10px) accept scaled sizes.

**`fonts.ts`** — `FONT_SIZES` stays as a reference table of base values. Templates apply `s()` when using them: `s(FONT_SIZES.h1)`.

**5b. Per-template refactor pattern**

Every magazine template's `index.tsx` follows this migration:

```tsx
// BEFORE
const CARD_W = 940;
const CARD_H = 1400;
<div style={{ fontSize: 49, padding: '60px 50px' }}>

// AFTER
const s = useScale();
const { durationInFrames, width, height } = useVideoConfig();
const CARD_W = s(940);
const CARD_H = s(1400);
<div style={{ fontSize: s(49), padding: `${s(60)}px ${s(50)}px` }}>
```

**5c. Duration-aware animations**

Templates currently hardcode absolute frame numbers. The fix uses a **hybrid approach**: proportional timing for enter/exit phases, absolute frame offsets for internal choreography stagger.

**Rationale:** Fully proportional timing (`t = frame / durationInFrames`) breaks stagger choreography — a 90-frame scene would have 3x faster stagger than a 270-frame scene, making the visual feel rushed or sluggish. Internal stagger timing (e.g., 12-frame gaps between list items) should stay absolute because it represents physical motion, not scene proportion.

```tsx
// ENTER phase — proportional (first 20% of scene)
const enterEnd = Math.round(durationInFrames * 0.2);
const headerOpacity = interpolate(frame, [0, enterEnd * 0.3], [0, 1], {
  extrapolateLeft: 'clamp', extrapolateRight: 'clamp'
});

// INTERNAL stagger — absolute offsets (frame-precise choreography)
const ROW_STAGGER = 12; // always 12 frames between rows, regardless of duration
const rowStart = enterEnd + i * ROW_STAGGER;

// EXIT phase — proportional (last 10% of scene)
const exitStart = Math.round(durationInFrames * 0.9);
const exitOpacity = interpolate(frame, [exitStart, durationInFrames], [1, 0], {
  extrapolateLeft: 'clamp', extrapolateRight: 'clamp'
});
```

This preserves the snappy feel of frame-precise stagger while allowing scenes to run at different durations without enter/exit phases being cut off or stretched.

**5d. What stays the same**
- Spring-based animations (`spring()`) — already duration-independent
- `useCurrentFrame()` — still used, combined with normalized time
- Template visual design — identical look, responsive sizing

**5e. Build-time enforcement**

Section 4's validation checks that every `index.tsx` imports `useScale`. Once migrated, no template can regress.

### Files Changed

- Modified: `packages/templates/src/magazine/animations.ts`
- Modified: `packages/templates/src/magazine/typography.tsx`
- Modified: `packages/templates/src/magazine/effects.tsx`
- Modified: `packages/templates/src/magazine/textures.tsx`
- Modified: `packages/templates/src/magazine/decorations.tsx`
- Modified: `packages/templates/src/templates/magazine-*/index.tsx` (27 templates)

---

## Section 6: Fork Tool Hardening

### Problem

The fork tool downloads files from S3, rewrites imports with regex, runs `npm install` at runtime, and returns a text string. Missing dependencies, partial downloads, and npm failures cause silent breakage.

### Design

**6a. Manifest-driven dependency resolution**

After downloading template files from S3, the fork tool reads `meta.json` from the downloaded files for dependency info:

1. For each `sharedLib` in `meta.json`: check if already in workspace, download if not
2. For each `siblingTemplate` in `meta.json`: check `forkedSlugs` set, recursively fork if needed
3. No more grepping downloaded source files for import patterns

**6b. No runtime npm install**

Any npm package a template needs must be pre-installed in the Docker image's `/app/template/node_modules/`. The `meta.json` `npmDependencies` field is validated at build time against the workspace `package.json`. If a template declares a dep not in the base workspace, the build fails — forcing the fix at image build time.

**Tradeoff acknowledged:** This creates a tight coupling between template authoring and Docker image deploys. Adding a new npm dependency to a template requires: (1) add to workspace `package.json`, (2) rebuild Docker image, (3) redeploy. This is acceptable because it eliminates runtime npm failures and version drift. The workflow for adding a new dependency is documented in the workspace `package.json` comments.

**6c. Post-fork import verification**

After writing all files, verify integrity before returning success:

1. For every `sharedLib` in manifest: verify the lib directory exists at the expected workspace path
2. For every `.ts`/`.tsx` file written: scan imports, verify each path resolves to an actual file on disk
3. If any check fails: return detailed error (`"Fork of magazine-comparison failed: missing magazine/effects.tsx"`)

**6d. Shared lib deduplication**

When forking 5-10 magazine templates, each gets its own copy of `magazine/`. Add a fast path: if the shared lib directory already exists in the target from a previous fork, skip the copy. No checksumming needed — all copies originate from the same S3 upload of the same source tree, so version skew is a build/upload problem, not a fork-time problem.

**6e. Structured return value**

Replace text string with structured output:

```
Forked magazine-comparison to src/components/templates/magazine-comparison/
Files: 6 template files + magazine/ (5 files) + fonts.ts + use-scale.ts
Props schema: { leftLabel: string, rightLabel: string, items: Array<{category, left, right}> }
Use case: Structured comparison across multiple categories
Import: import MagazineComparison from '../components/templates/magazine-comparison';
```

### Files Changed

- Modified: `packages/sandbox/src/tools/template-tools.ts` — rewrite fork mechanism

---

## Section 7: Sandbox Compatibility

### Problem

The sandbox pipeline has structural gaps between phases: the orchestrator doesn't validate template slugs from the scene plan, Setup Agent ignores fork results, animators have no recovery if templates are missing, and checkpoint/restore may lose forked files.

### Design

**7a. Orchestrator pre-parses template slugs via structured sidecar**

The Planner already writes `SCENE_PLAN.md` (human-readable). Add a requirement for the Planner to also write `scene-templates.json` (machine-parseable sidecar):

```json
{
  "scenes": [
    { "sceneNumber": 1, "template": "magazine-comparison" },
    { "sceneNumber": 2, "template": "magazine-stats" },
    { "sceneNumber": 3, "template": "magazine-quote" }
  ]
}
```

**Why a sidecar instead of parsing markdown:** The Planner is an AI agent that writes freeform markdown. Regex-parsing `template: <slug>` from markdown is fragile — whitespace variations, bold formatting (`**Template:** slug`), backtick wrapping, etc. A structured JSON file eliminates all parsing ambiguity.

After Phase 3 (Planner completes), the orchestrator:

1. Reads `scene-templates.json` from disk (hard error if missing)
2. Calls `browse_templates` to verify every slug exists
3. Passes the validated slug list directly in the Setup Agent dispatch message

If a slug doesn't exist, the orchestrator fails before Setup Agent starts.

**Planner prompt update:** Add instruction to write `scene-templates.json` alongside `SCENE_PLAN.md`. The Planner already writes structured output (scenes.json), so this is a natural addition.

### Additional files changed

- Modified: `packages/sandbox/src/prompts/planner/system.md` — instruction to write `scene-templates.json`

**7b. Setup Agent writes `workspace-templates.json`**

After all forks complete, Setup Agent writes a manifest:

```json
{
  "forkedAt": "2026-03-24T12:00:00Z",
  "templates": {
    "magazine-comparison": {
      "path": "src/components/templates/magazine-comparison",
      "sharedLibs": ["magazine", "fonts", "use-scale"],
      "propsSchema": { "leftLabel": "string", "rightLabel": "string" }
    }
  }
}
```

This becomes the single source of truth for downstream agents. It also serves checkpoint/restore — on session resume, the orchestrator reads this file to verify all templates are present before dispatching animators (see 7e).

**7c. Animators get explicit template info in dispatch**

Instead of relying on skeleton comments, the orchestrator passes:

```
Scene 3 uses template magazine-comparison
  Path: src/components/templates/magazine-comparison/
  Shared libs: magazine/effects.tsx, magazine/typography.tsx
  Props: { leftLabel: string, rightLabel: string, items: Array<{category, left, right}> }
```

**7d. Checkpoint/restore preserves templates**

Forked template files are committed to git during Setup Agent's phase. The checkpoint system already bundles everything in git, so templates survive session resume.

**7e. Setup-to-Animator gate**

After Setup Agent returns, orchestrator:

1. Reads `workspace-templates.json` — confirms it exists
2. Verifies `src/components/templates/<slug>/index.tsx` exists for each entry
3. Only then proceeds to Phase 6 (animator dispatch)

### Files Changed

- Modified: `packages/sandbox/src/orchestrator.ts` — template slug parsing, phase gate, animator dispatch enrichment
- Modified: `packages/sandbox/src/tools/template-tools.ts` — write `workspace-templates.json`
- Modified: `packages/sandbox/src/prompts/setup-agent/system.md` — instructions to validate fork results
- Modified: `packages/sandbox/src/prompts/animator/system.md` — updated template usage instructions
- Modified: `packages/sandbox/src/prompts/orchestrator/system.md` — template validation flow

---

## Migration Strategy

### Phase 1: Infrastructure (Sections 1, 3, 4)
- Create `rewrite-imports.ts` in `@viona/shared`
- Create `template-schemas.ts` Zod schemas
- Create `validate-templates.ts` script
- **Bootstrap step:** Run a one-time migration script that scans each template's source files using the *existing* regex detection logic to generate `sharedLibs`, `npmDependencies`, and `siblingTemplates` fields, then writes them into each template's `meta.json`. This is the last time the old regex logic runs — after this, the manifests become the source of truth.
- Update build scripts to use shared utilities

### Phase 2: Metadata (Section 2)
- Add `useCase`, `bestFor`, `notFor` to all 50+ `meta.json` files
- Remove `aspectRatio`, `estimatedDuration`, `stylePreset`
- Update registry output and API responses

### Phase 3: Magazine Responsiveness (Section 5)
- Update magazine shared libraries (`animations.ts`, `typography.tsx`, `effects.tsx`, `textures.tsx`, `decorations.tsx`)
- Migrate all 27 magazine templates to `useScale()` + `useVideoConfig()`
- Enable build-time `useScale()` enforcement

### Phase 4: Fork Tool + Sandbox (Sections 6, 7)
- Rewrite fork tool with manifest-driven resolution
- Add post-fork verification
- Update orchestrator with template slug parsing and phase gates
- Update agent prompts
- Write `workspace-templates.json` flow

### Ordering Rationale
- Phase 1 before 2: validation must exist before metadata changes
- Phase 2 before 3: templates need correct metadata before responsiveness refactor
- Phase 3 before 4: templates must be responsive before fork tool changes (so forked templates work correctly)
- Phase 4 last: sandbox changes depend on all template-side changes being complete
