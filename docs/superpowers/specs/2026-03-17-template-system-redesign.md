# Template System Redesign — Backend-Driven Architecture

**Date:** 2026-03-17
**Status:** Approved

## Overview

Replace the current static template system (90 templates in an npm package + standalone gallery app) with a backend-driven, scalable template architecture. Templates are stored in S3, metadata in PostgreSQL, and served through the Fastify API. The web app gets a Templates tab on the projects page for browsing, previewing, customizing, and exporting templates as MP4.

## Goals

- Remove the standalone `apps/templates` gallery app
- Remove 87 low-quality templates, keep 3 (globe-spin, watercolor-map, country-highlight)
- Build a scalable, backend-driven template system (DB + S3)
- Integrate template browsing into the main Viona web app
- Templates serve as the free-tier value prop (no AI credits needed)
- Future: "Remix" button to drop templates onto the NLE editor timeline

## Non-Goals

- Editor timeline integration (future phase)
- Template marketplace / user-submitted templates (future)
- Admin panel for template management (future)

---

## Database Schema

**`templates` table:**

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `slug` | varchar | Unique, URL-friendly |
| `name` | varchar | Display name |
| `description` | text | |
| `category` | varchar | e.g. `geographic`, `data-visualization` |
| `tags` | jsonb | String array for filtering |
| `aspect_ratio` | varchar | `16:9`, `9:16`, `1:1` |
| `duration_frames` | integer | Default duration |
| `fps` | integer | Default 30 |
| `width` | integer | Composition width |
| `height` | integer | Composition height |
| `props_schema` | jsonb | JSON Schema (generated via `zod-to-json-schema` at build time) |
| `default_props` | jsonb | Default prop values |
| `screenshot_url` | varchar | S3 path to auto-generated still frame |
| `bundle_key` | varchar | S3 key to content-hashed bundle (e.g. `templates/globe-spin/bundle.a1b2c3.js`) |
| `source_key` | varchar | S3 key prefix for template source files |
| `version` | integer | Incremented on each build, used for cache busting |
| `is_published` | boolean | Controls visibility |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

No separate categories/tags tables — `category` is a constrained varchar and `tags` is a jsonb array. Keeps it simple until relational tag management is needed.

---

## Storage Layout (S3/MinIO)

```
templates/
├── {slug}/
│   ├── source/              # Raw source files (for editing/rebuilding)
│   │   ├── index.tsx        # Main Remotion component
│   │   ├── schema.ts        # Zod props schema
│   │   ├── constants.ts     # Template constants
│   │   └── components/      # Sub-components
│   ├── assets/              # Heavy runtime assets (loaded via URL, not bundled)
│   │   ├── globe-model.glb  # Example: globe template
│   │   ├── world-110m.json  # Example: map data
│   │   └── ...
│   ├── bundle.js            # Pre-compiled esbuild bundle (self-contained)
│   └── screenshot.png       # Auto-generated still frame for browse grid
```

- Source files stored individually (update a single file without re-uploading everything)
- Heavy assets loaded at runtime via URL, not bundled into the app
- Template components reference assets via an `assetBaseUrl` prop. The `GET /templates/:slug` API endpoint returns this URL as a separate field (presigned S3 prefix). The frontend merges it into props before passing to `<Player>`. The Zod schema does not include `assetBaseUrl` — it is injected externally.
- `source_key` in DB points to `templates/{slug}/`
- S3 bucket must have CORS configured to allow `fetch()` from the web app's origin (for bundle and asset loading).

---

## Template Bundle Architecture

### Build Side

Each template is compiled by **esbuild** into a self-contained **UMD bundle**:

- **Externals:** `react`, `react-dom`, `remotion`, `@remotion/core` (provided by the host app)
- **Bundled in:** All other dependencies (three.js, d3-geo, topojson, `@remotion/google-fonts`, etc.)
- **Output format:** ESM with a custom esbuild plugin that rewrites bare `react`/`remotion` imports to `window.React`/`window.Remotion` global references
- **Output:** Single `bundle.{contentHash}.js` per template (content-hashed for cache busting)

**Shared module handling:** Templates import shared code from the package level (`fonts.ts`, `use-scale.ts`, `lib/map/`). At build time, the build CLI **inlines** these shared dependencies into each template's bundle. Each template is fully self-contained — no cross-template imports at runtime. Templates should only import the fonts they actually use (refactor away from the shared 20-font `fonts.ts`).

This means:
- The web app stays lightweight — zero template dependencies in the main bundle
- Each template is fully isolated — different templates can use different library versions
- No redeploy needed to add new templates

### Runtime Loading (Client)

Browser `import()` cannot reliably load ES modules from cross-origin S3 URLs. Instead, use the **fetch + blob URL** pattern:

1. Client fetches `bundle.{hash}.js` from S3 via presigned URL
2. Response text is wrapped in a Blob with `type: 'application/javascript'`
3. `URL.createObjectURL(blob)` creates a same-origin blob URL
4. `import(/* webpackIgnore: true */ blobUrl)` loads the module
5. The loaded component is passed to Remotion's `<Player>` for live preview
6. Blob URL is revoked on unmount to prevent memory leaks

The esbuild plugin rewrites `import React from 'react'` → `const React = window.React` (and same for Remotion) at build time, so the ESM bundle is self-contained with global references baked in.

The host page must expose React and Remotion on `window` before loading any template bundle. A one-time setup script in the app handles this.

### Runtime Loading (Worker)

For MP4 export, the worker uses **pre-processed source files** (not the esbuild client bundle) to avoid double-bundling:

1. Worker downloads pre-processed source files (shared modules already inlined by the build CLI) + `assets/` from S3 into temp directory
2. Creates a thin Remotion entry that imports the template source + wraps in `<Composition>`
3. `bundle()` from `@remotion/bundler` (webpack) compiles the source with full Node.js resolution
4. `selectComposition()` → `renderMedia()` → MP4
5. Uploads to S3, returns download URL

The build CLI uploads source with `../../fonts`, `../../use-scale`, `../../lib/map/` imports already resolved — shared modules are copied into each template's source directory in S3. This way the worker can compile in an isolated temp directory without needing the full package structure. The worker has all npm dependencies installed, so webpack resolves `three.js`, `d3-geo`, etc. normally.

---

## API Endpoints

All in `packages/api`.

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/templates` | GET | No | List templates with filters (category, tags, search, aspect_ratio). Paginated. Returns metadata + screenshot URLs. |
| `/templates/:slug` | GET | No | Full detail: metadata, props schema, default props, bundle URL (presigned S3) |
| `/templates/:slug/export` | POST | Yes | Accepts custom props, queues `render-template` BullMQ job, returns job ID. Rate-limited per user. |
| `/templates/:slug/export/:jobId` | GET | Yes | Poll job status + download URL when complete |
| `/templates/categories` | GET | No | List available categories with template counts (for filter UI) |

Browse/detail endpoints are public (templates are the free-tier entry point). Export requires authentication to prevent abuse. The export endpoint is rate-limited (e.g., 5 exports/hour per user).

### Export Job Tracking

Template exports are tracked in a new `template_exports` table (separate from project jobs since templates have no project):

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `template_id` | uuid | FK to templates |
| `user_id` | uuid | FK to users (required — export requires auth) |
| `props` | jsonb | Props used for this render |
| `status` | varchar | `queued`, `processing`, `completed`, `failed` |
| `output_url` | varchar | S3 path to rendered MP4 |
| `created_at` | timestamp | |
| `completed_at` | timestamp | |

---

## Lightweight Template Render Pipeline

**New worker processor: `render-template`** in `packages/worker/src/processors/render-template.ts`

```
Input:  { templateId, slug, props, width, height, fps, durationInFrames }
Output: { downloadUrl: string }
```

**Flow:**
1. Download raw source files + `assets/` from S3 into temp directory (using `source_key` from DB)
2. Create thin Remotion entry file that imports the template source + wraps in `<Composition>`
3. `bundle()` from `@remotion/bundler` (webpack) compiles with full Node.js resolution
4. `selectComposition()` → resolve composition with input props
5. `renderMedia()` → output MP4
6. Upload MP4 to S3, return presigned download URL
7. Update `template_exports` row with status + output URL
8. Clean up temp files

Concurrency limit: 2 concurrent `render-template` jobs (configurable). Queue uses standard BullMQ priority.

**What it does NOT do** (unlike the existing visual generation pipeline):
- No AI agents, no Director/Animator
- No scene planning or scenes.json
- No screenshot verification
- No multi-scene orchestration
- No ffmpeg concat — single composition, single render

---

## Frontend

### Projects Page — Templates Tab

Route: `/projects` (existing page, new tab)

Two tabs at the top:
- **My Projects** — existing project list (current behavior)
- **Templates** — template browse grid

### Templates Tab

- **Server Component** for initial data fetch
- Filter bar: category dropdown, search input, aspect ratio filter
- Grid of template cards showing:
  - Static screenshot image (from S3 CDN) — no heavy Remotion player on browse
  - Name, category badge
  - Aspect ratio indicator
- Paginated or infinite scroll as collection grows

### Template Detail View

Route: `/templates/[slug]` (new page)

- **Left:** Remotion `<Player>` with live preview (Client Component, loads `bundle.js` on mount)
- **Right:** Props editor — auto-generated form from JSON schema:
  - `string` → text input
  - `number` → number input with min/max
  - `boolean` → toggle
  - `enum` → dropdown select
  - `color` → color picker (reuse existing component)
- **Buttons:**
  - **Export** — triggers `render-template` worker job, shows progress, provides download link
  - **Remix** (disabled) — grayed out with tooltip "Coming soon — edit in Viona editor"

Props changes re-render the Remotion Player in real-time.

---

## Build CLI

**Command:** `pnpm templates:build`

New script in `packages/templates` that for each template:
1. **Resolve shared modules** — inline `fonts.ts`, `use-scale.ts`, `lib/map/` into the template's source tree (temp copy)
2. **esbuild** compiles resolved source → `bundle.{contentHash}.js` (UMD, React/Remotion as externals)
3. **`zod-to-json-schema`** converts the Zod schema → JSON Schema for DB storage
4. **`renderStill()`** from `@remotion/renderer` API renders a frame → `screenshot.png` (programmatic, no CLI dependency)
5. **Uploads** bundle + screenshot + source + assets to S3
6. **Upserts** metadata row in the database (including `bundle_key` with content hash, `props_schema`, `version`)

Adding a new template = write the code, run the build script, done.

### Drizzle Migration

A new migration in `packages/api/drizzle/` creates the `templates` and `template_exports` tables.

---

## Cleanup Scope

### Deleted Entirely
- `apps/templates/` — standalone gallery app (all routes, components, configs)

### Deleted from `packages/templates/src/templates/`
- All 87 templates except `globe-spin`, `watercolor-map`, `country-highlight`
- Corresponding `r/{slug}.json` registry output files

### Cleaned Up
- `packages/templates/src/index.ts` — remove 87 import lines, keep 3
- `registry.json` — rebuilt with only 3 entries
- `packages/worker/workspace/src/.templates/` — remove cached directories except 3 keepers

### Kept & Refactored
- `packages/templates/` — becomes the template build toolkit (`@viona/template-builder`). Registry and types updated for the new system. Old runtime registry code removed (DB replaces it).
- Build scripts — replaced with esbuild-based `templates:build` CLI
- `StaticTemplateRenderer.tsx` — updated to load bundles dynamically via fetch + blob URL pattern

### Not Touched
- Existing visual generation pipeline (Director/Animator) — separate system
- Existing worker render pipeline — `render-template` is a new, independent processor
