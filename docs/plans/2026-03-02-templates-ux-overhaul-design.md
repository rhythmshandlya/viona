# Templates App UX Overhaul Design

**Date**: 2026-03-02
**Goal**: Transform the templates web app from a dev-tool feel to a premium, consumer-grade template browser that matches the main Viona app's design language.

## Context

The `apps/templates/` Next.js app has 50+ Remotion video templates with a gallery page and detail pages. The current UI is functional but feels generic — tiny text, cramped cards, raw HTML selects, and no animations. It needs to match the main Viona app's premium aesthetic: violet brand color, soft shadows, `fadeInUp` stagger animations, Inter font, and polished micro-interactions.

## Design

### 1. Global Styles & Animations

**CSS token alignment with main app:**
- `--radius: 0.5rem` (from 0.625rem)
- Add shadow scale: `--shadow-sm`, `--shadow-md`, `--shadow-lg` matching main app
- Body font: `var(--font-inter), system-ui, sans-serif`

**Animation system:**
- `@keyframes fadeInUp` — opacity 0→1, translateY 12px→0, 400ms ease-out
- Stagger delay classes: `.stagger-1` (50ms) through `.stagger-8` (400ms)
- Smooth filter transitions on result grid

### 2. Gallery Page — Header

Replace the plain V-box + text header with:
- Sticky navbar with `backdrop-blur-sm` + semi-transparent `bg-card/80`
- Viona wordmark on the left
- Template count badge (e.g., "48 templates") on the right as a muted pill
- Slim height, clean separation via subtle border-b

### 3. Gallery Page — Hero Section

Replace `<h2>` + description with:
- Bold heading with a subtle violet gradient on one keyword (e.g., "Template **Library**" where Library has a violet gradient)
- Concise subtitle in muted-foreground
- More whitespace — py-12 instead of py-8

### 4. Gallery Page — Cards

**Layout:** 2/3/4 column grid (from 2-6):
- `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`
- `gap-5` (from gap-3)

**Card design:**
- Larger thumbnail area with better loading skeleton
- Text sizes: name 14px semibold, description 13px, badges 12px (up from 10-11px)
- Duration as a semi-transparent overlay badge on the thumbnail corner
- Category badge with violet-tinted colors
- `fadeInUp` animation with stagger on mount

**Hover state:**
- `scale(1.02)` + `shadow-lg` + `border-primary/40` glow
- Animated thumbnail: cycle through 3 frames (0s, 2s, 4s) on hover using Remotion Thumbnail with frame cycling via setInterval
- Smooth `transition-all duration-300`

**Empty state:** Icon + heading + subtext + clear-filters button

### 5. Filter Bar

- **Search input:** Same but with main-app focus ring style
- **Category pills:** Rounded-full buttons with violet active state, `transition-all duration-200`, more padding (px-4 py-2)
- **Aspect ratio:** Replace `<select>` with 4 pill buttons (Any / 16:9 / 9:16 / 1:1)
- **Tags:** Replace `<select>` with a styled custom dropdown component (button + popover)
- **Result count:** "Showing X of Y templates" text below filters
- **Active filters:** Clear-all button visible when any filter is active

### 6. Detail Page — Header

- Same sticky backdrop-blur header style
- Back arrow + template name on left
- "Copy Props" button on right using main app's button style (violet primary)

### 7. Detail Page — Preview

- Dark canvas background (`bg-neutral-950`) behind the player for cinematic contrast
- Player in a rounded container with `shadow-xl` + subtle border
- Video specs (resolution, fps, duration, frames) as elegant inline badge row below

### 8. Detail Page — Props Sidebar

- Match main app's input styling: `h-9`, `rounded-md`, proper focus rings
- Better spacing between field groups
- Collapsible sections for nested objects (accordion style)
- Section header "Properties" with cleaner typography

### 9. Detail Page — Bottom Section

- Template tags as styled violet-tinted pills
- "Related Templates" row: 3-4 TemplateCards from the same category, horizontally scrollable

### 10. Files Changed

| File | Change |
|------|--------|
| `globals.css` | Align tokens, add animations/shadows |
| `page.tsx` (gallery) | New header + hero section |
| `TemplateGallery.tsx` | New grid layout, stagger animations, result count |
| `TemplateCard.tsx` | Bigger cards, hover animations, animated thumbnail |
| `FilterBar.tsx` | Pill buttons, custom tag dropdown, active filter indicators |
| `[slug]/page.tsx` | Dark preview canvas, related templates, layout polish |
| `TemplatePreview.tsx` | Dark background wrapper, badge-style specs |
| `PropsEditor.tsx` | Better styling, collapsible sections |
| `PropsEditorField.tsx` | Match main app input styling |

## Non-Goals

- No new data models or API changes
- No routing changes
- No dark mode toggle (keeping light mode default)
- No template CRUD — this is read-only browsing
