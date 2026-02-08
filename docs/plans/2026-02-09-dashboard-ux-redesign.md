# Dashboard UX Redesign

## Overview

Consolidate the project management experience into a single unified dashboard. Remove the separate upload page and integrate all pre-editor functionality into `/projects`.

## Goals

- Make `/projects` the home page after login
- Enable project creation directly from the dashboard
- Add project naming at creation time
- Show video thumbnails on project cards
- Support basic project actions: open, delete

## Design

### Unified Dashboard (`/projects`)

The dashboard is the single pre-editor screen. Users land here after login.

**Layout:**
- Header with "My Projects" title
- "New Project" button (top-right, prominent)
- Responsive grid: 1 column (mobile), 2 columns (tablet), 3 columns (desktop)

**Empty State:**
- Inline upload UI (no modal)
- Project name input field
- Drag & drop zone
- Text: "Create your first project"

### Project Cards

Each card displays:
- Video thumbnail (16:9 aspect ratio, top)
- Project name (bold, truncated if long)
- Duration + created date (muted, small)
- Status badge (overlaid on thumbnail, top-right)

**Status Badges:**
- `uploading` / `processing` - blue, pulsing
- `ready` - green or hidden
- `failed` - red

**Interactions:**
- Hover: subtle lift effect
- Click: opens editor (`/project/:id`)
- Three-dot menu: "Delete" option

### New Project Modal

Triggered by "New Project" button when user has existing projects.

**Initial State:**
- Project name input (auto-focused, placeholder: "Untitled Project")
- Drag & drop zone for video
- Cancel button

**During Upload/Processing:**
- Name field remains editable
- Progress bar with percentage
- Status text updates: "Uploading..." → "Processing..." → "Done!"
- Cancel button available

**On Complete:**
- Brief success state (500ms)
- Modal closes
- New card appears in grid
- Auto-redirect to editor

**On Error:**
- Error message displayed
- "Try Again" button resets modal

### Delete Flow

**Trigger:** Three-dot menu → "Delete"

**Confirmation Dialog:**
- Title: "Delete project?"
- Text: "'{project name}' will be permanently deleted."
- Buttons: Cancel (secondary), Delete (red/destructive)

**Behavior:**
- Optimistic UI: card fades immediately
- On failure: card reappears, error toast shown

### Thumbnail Generation

- Backend extracts frame during video processing (~2 seconds in)
- Stored as `thumbnailKey` in project record
- Served via `/api/projects/:id/thumbnail`
- Fallback: gradient placeholder with video icon

## Routing Changes

- Remove `/upload` page entirely
- `/projects` becomes home after login
- Update auth redirects in middleware
- Update navbar links

## Database Changes

Add to projects table:
- `title` (string, nullable) - user-provided project name
- `thumbnailKey` (string, nullable) - S3 key for thumbnail image

## API Changes

- `POST /api/projects` - accept optional `title` field
- `PATCH /api/projects/:id` - allow updating `title`
- `GET /api/projects/:id/thumbnail` - serve thumbnail image
- `DELETE /api/projects/:id` - delete project and associated files

## Files to Modify

**Remove:**
- `apps/web/src/app/(dashboard)/upload/page.tsx`

**Create:**
- `apps/web/src/components/new-project-modal.tsx`
- `apps/web/src/components/project-card.tsx`
- `apps/web/src/components/delete-project-dialog.tsx`

**Modify:**
- `apps/web/src/app/(dashboard)/projects/page.tsx` - complete redesign
- `apps/web/src/middleware.ts` - update redirects
- `apps/web/src/components/navbar.tsx` - update links
- `packages/api/src/db/schema.ts` - add title, thumbnailKey
- `packages/api/src/routes/projects.ts` - add thumbnail route, update create/delete
- Worker: add thumbnail extraction during processing
