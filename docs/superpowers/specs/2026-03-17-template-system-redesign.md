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
| `props_schema` | jsonb | Zod-compatible JSON schema for customizable props |
| `default_props` | jsonb | Default prop values |
| `screenshot_url` | varchar | S3 path to auto-generated still frame |
| `source_key` | varchar | S3 key prefix for template source files |
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
- Template components reference assets via `props.__assetBaseUrl` injected by the API
- `source_key` in DB points to `templates/{slug}/`

---

## Template Bundle Architecture

### Build Side

Each template is compiled by **esbuild** into a self-contained ES module:

- **Externals:** `react`, `react-dom`, `remotion` (provided by the host app)
- **Bundled in:** All other dependencies (three.js, d3-geo, topojson, etc.)
- **Output:** Single `bundle.js` per template

This means:
- The web app stays lightweight — zero template dependencies in the main bundle
- Each template is fully isolated — different templates can use different library versions
- No redeploy needed to add new templates
- Same bundle works client-side (preview) and server-side (worker rendering)

### Runtime Loading (Client)

When a user opens a template detail view:
1. Client fetches `bundle.js` from S3 (via presigned URL or CDN)
2. Bundle is loaded via dynamic `import()`
3. React/Remotion are already on the page as externals
4. The loaded component is passed to Remotion's `<Player>` for live preview

### Runtime Loading (Worker)

For MP4 export:
1. Worker downloads `bundle.js` + `assets/` from S3 into temp directory
2. Creates a thin Remotion entry wrapping the component in a `<Composition>`
3. `bundle()` → `selectComposition()` → `renderMedia()` → MP4
4. Uploads to S3, returns download URL

---

## API Endpoints

All in `packages/api`.

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/templates` | GET | List templates with filters (category, tags, search, aspect_ratio). Paginated. Returns metadata + screenshot URLs. |
| `/templates/:slug` | GET | Full detail: metadata, props schema, default props, bundle URL (presigned S3) |
| `/templates/:slug/export` | POST | Accepts custom props, queues `render-template` BullMQ job, returns job ID |
| `/templates/:slug/export/:jobId` | GET | Poll job status + download URL when complete |
| `/templates/categories` | GET | List available categories with template counts (for filter UI) |

---

## Lightweight Template Render Pipeline

**New worker processor: `render-template`** in `packages/worker/src/processors/render-template.ts`

```
Input:  { slug, props, width, height, fps, durationInFrames }
Output: { downloadUrl: string }
```

**Flow:**
1. Download `bundle.js` + `assets/` from S3 into temp directory
2. Create thin Remotion entry file wrapping the template in `<Composition>`
3. `bundle()` from `@remotion/bundler` → static serve directory
4. `selectComposition()` → resolve composition with input props
5. `renderMedia()` → output MP4
6. Upload MP4 to S3, return presigned download URL
7. Clean up temp files

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
1. **esbuild** compiles source → `bundle.js` (React/Remotion as externals)
2. **`remotion still`** renders a frame → `screenshot.png`
3. **Uploads** bundle + screenshot + assets to S3
4. **Upserts** metadata row in the database

Adding a new template = write the code, run the build script, done.

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
- `packages/templates/src/registry.ts` — adapted for DB-driven architecture
- `packages/templates/src/types.ts` — updated type definitions
- Build scripts — replaced with esbuild-based `templates:build` CLI
- `StaticTemplateRenderer.tsx` — updated to load bundles dynamically from URLs

### Not Touched
- Existing visual generation pipeline (Director/Animator) — separate system
- Existing worker render pipeline — `render-template` is a new, independent processor
