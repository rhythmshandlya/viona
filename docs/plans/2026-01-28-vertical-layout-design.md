# Vertical-First Editor Layout

## Problem

The current editor layout stacks the video preview above a full-width timeline. For 9:16 reel content on a 16:9 monitor, this wastes massive horizontal space — the video appears small, squeezed vertically between the header and timeline.

## Design

Optimize the single layout for vertical (9:16) content with a collapsible right panel.

### Default State (panel closed)

Video preview centered and maximized in the full scene area. No side panels visible.

```
┌──────────────────────────────────────────────────┐
│ Header                                           │
├──────────────────────────────────────────────────┤
│                 ┌──────────────┐                 │
│                 │   9:16       │                 │
│                 │   Video      │                 │
│                 │  (maximized) │                 │
│                 └──────────────┘                 │
├──────────────────────────────────────────────────┤
│ Playback Bar                                     │
├──────────────────────────────────────────────────┤
│ Timeline                                         │
└──────────────────────────────────────────────────┘
```

### Panel Open State

Right panel (~320px) slides in. Video rescales to fit remaining space.

```
┌──────────────────────────────────────────────────┐
│ Header                                           │
├─────────────────────────┬────────────────────────┤
│     ┌─────────┐         │ [Transcript] [Props]   │
│     │  9:16   │         │                        │
│     │  Video  │         │  (tab content)         │
│     │(adapts) │         │                        │
│     └─────────┘         │                        │
├─────────────────────────┴────────────────────────┤
│ Playback Bar                                     │
├──────────────────────────────────────────────────┤
│ Timeline                                         │
└──────────────────────────────────────────────────┘
```

### Panel Behavior

- **Two tabs:** Transcript (default) and Properties.
- **Auto-open:** Selecting a timeline item opens the panel and switches to Properties.
- **Auto-restore:** Deselecting returns to previous tab, or closes panel if it was closed before selection.
- **Manual toggle:** Header transcript button toggles the Transcript tab.
- **Close:** Close button or Escape collapses the panel.
- **Transition:** ~150ms CSS width transition; video rescales via ResizeObserver.

### File Changes

**Modified:**

- `Editor.tsx` — Replace left-sidebar + floating-overlay with single right panel state (`rightPanelOpen`, `activeTab`). Scene area becomes horizontal flex.
- `Scene.tsx` — Replace `window.resize` listener with `ResizeObserver` on container for auto-rescale when panel opens/closes.
- `ContextPanel` — Remove absolute positioning. Render as plain content inside Properties tab.
- `TranscriptPanel` — Remove fixed-width sidebar wrapper. Render inside Transcript tab.

**New:**

- `components/RightPanel.tsx` — Tabbed container with Transcript/Properties tabs, close button, slide transition.

**Unchanged:** Timeline, PlaybackBar, Header (just rewire transcript toggle), SceneToolbar, CommandPalette.
