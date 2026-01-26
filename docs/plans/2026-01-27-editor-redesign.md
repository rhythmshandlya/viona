# Editor UI Redesign

## Overview

Redesign the video editor UI to follow a Figma/Linear-inspired aesthetic: clean, minimal, precise, keyboard-first with subtle polish animations.

## Design Decisions

| Aspect | Choice | Rationale |
|--------|--------|-----------|
| Style | Figma/Linear | Clean, minimal, focused editing experience |
| Colors | Monochrome dark + green accent | Modern, professional, creative energy |
| Layout | Minimal panels | Maximum preview space, contextual UI |
| Timeline | Thin tracks | Focus on content, expand when needed |
| Animations | Subtle polish | Responsive feel without distraction |

## Color System

```css
/* Background layers */
--bg-base:     #0A0A0A;   /* Main background */
--bg-surface:  #111111;   /* Cards, panels */
--bg-elevated: #191919;   /* Dropdowns, popovers */
--bg-hover:    #1F1F1F;   /* Hover states */

/* Borders */
--border-subtle:  #1F1F1F;  /* Dividers */
--border-default: #2A2A2A;  /* Input borders */
--border-focus:   #10B981;  /* Focus rings */

/* Text */
--text-primary:   #FAFAFA;  /* Headings, important */
--text-secondary: #A1A1A1;  /* Labels, descriptions */
--text-muted:     #525252;  /* Placeholders, disabled */

/* Accent (Green) */
--accent:         #10B981;  /* Buttons, active states */
--accent-hover:   #059669;  /* Button hover */
--accent-muted:   rgba(16, 185, 129, 0.125);  /* Subtle backgrounds */
```

## Layout Structure

```
┌──────────────────────────────────────────────────────────┐
│  ←  │  Project Name          │  ⌘K  │  ↗ Export  │  •••  │  48px header
├──────────────────────────────────────────────────────────┤
│                                                          │
│                                                          │
│              Scene Preview (maximized)                   │  flex-1
│              Dark background, centered video             │
│                                                          │
│                                                          │
├──────────────────────────────────────────────────────────┤
│  ▶ 00:03.24 / 00:15.00                    ─────●─────   │  40px playback bar
├──────────────────────────────────────────────────────────┤
│  ═══════════●═══════════════════════════════════════════ │  120px timeline
│  [  Video  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓           ] │  (expandable)
│  [ Caption ▓▓▓░░▓▓▓░░▓▓▓░░▓▓▓░░▓▓▓░░                   ] │
└──────────────────────────────────────────────────────────┘
```

### Key Layout Principles

- No persistent sidebars - preview gets maximum space
- Header reduced to single line with essentials only
- Playback controls in slim bar between preview and timeline
- Timeline docked at bottom, 120px default, drag to resize
- Contextual panel slides in from right when item selected

## Components

### Header (48px)

- **Back button**: Ghost style arrow, returns to project list
- **Project title**: Editable inline, shows border on hover
- **Command hint**: Shows ⌘K badge
- **Export button**: Solid green, primary action
- **Menu**: Three dots dropdown (settings, shortcuts, help)

### Scene Preview

- Maximized to fill available space
- Dark background (#0A0A0A)
- Video centered with contain fit
- Scale percentage shown bottom-right (subtle)

### Playback Bar (40px)

- Play/pause button (left)
- Time display: current / total
- Scrubber bar (right side, flex)
- Minimal styling, blends with UI

### Timeline (120px default)

**Ruler:**
- Subtle tick marks and time labels
- Background: --bg-surface

**Tracks:**
- Video track: 28px height, solid color blocks
- Caption track: 24px height, individual blocks with gaps
- Minimal labels, expand on hover

**Playhead:**
- 2px green vertical line
- Small triangle at top
- Draggable from ruler

**Interactions:**
- Click item → Select, show panel
- Double-click caption → Inline edit
- Drag edges → Resize with snap
- Drag middle → Move with snap
- ⌘+scroll → Zoom

### Contextual Panel (320px, slides from right)

**Appears when:**
- Caption selected → Style panel
- Video selected → Position/crop panel

**Structure:**
- Header with title and close button
- Grouped controls with subtle dividers
- Segmented controls for mode selection
- Sliders for numeric values
- Color pickers for colors
- Changes apply immediately

**Animation:**
- Slide in from right, 200ms ease-out
- Backdrop: none (panel overlays content)
- Dismiss: click outside, press Esc, or click ✕

### Command Palette (⌘K)

**Appearance:**
- Centered modal, 480px wide
- Backdrop blur with dark overlay
- Search input at top
- Grouped command list below

**Commands grouped by:**
- Recent (last used commands)
- Playback (play, pause, seek)
- Edit (undo, redo, split, delete)
- View (zoom, fit, toggle)
- Caption (style, font, position)
- Export (render, settings)

**Behavior:**
- Fuzzy search filtering
- Arrow keys to navigate
- Enter to execute
- Esc to close

## Visual Details

### Border Radius
- Default: 6px
- Cards/panels: 8px
- Small elements: 4px
- Buttons: 6px

### Shadows
- Minimal use
- Panels: subtle drop shadow for depth
- Popovers: small shadow for elevation

### Transitions
- Duration: 150-200ms
- Easing: ease-out for enters, ease-in for exits
- Properties: opacity, transform, background-color

### Focus States
- 2px green ring
- Slight offset (2px)
- Subtle glow on inputs

### Selection States
- Selected item: green border
- Hover: lighten background
- Active: darken slightly

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Space` | Play/pause |
| `←` / `→` | Previous/next frame |
| `⌘K` | Command palette |
| `⌘Z` | Undo |
| `⌘⇧Z` | Redo |
| `⌘S` | Save |
| `⌘⇧E` | Export |
| `S` | Split at playhead |
| `⌫` | Delete selected |
| `Esc` | Deselect / close panel |

## Files to Create/Modify

### New Components
- `components/editor/Header.tsx` - Minimal header
- `components/editor/PlaybackBar.tsx` - Slim playback controls
- `components/editor/ContextPanel.tsx` - Sliding properties panel
- `components/editor/CommandPalette.tsx` - Command palette modal
- `components/editor/TimelineTrack.tsx` - Redesigned track component

### Modified Components
- `features/editor-v2/Editor.tsx` - New layout structure
- `features/editor-v2/scene/Scene.tsx` - Maximized preview
- `features/editor-v2/timeline/Timeline.tsx` - Minimal timeline
- `app/globals.css` - New color variables

### New Hooks
- `hooks/use-command-palette.ts` - Command palette state
- `hooks/use-panel.ts` - Panel open/close state

## Implementation Order

1. **Phase 1: Foundation**
   - Add color variables to globals.css
   - Create new layout structure in Editor.tsx
   - Implement minimal Header component

2. **Phase 2: Core UI**
   - Redesign Scene for maximized preview
   - Create PlaybackBar component
   - Redesign Timeline with thin tracks

3. **Phase 3: Contextual UI**
   - Create ContextPanel component
   - Add slide-in animation
   - Connect to selection state

4. **Phase 4: Command Palette**
   - Create CommandPalette component
   - Implement fuzzy search
   - Add keyboard navigation

5. **Phase 5: Polish**
   - Add transitions and hover states
   - Refine colors and spacing
   - Test keyboard shortcuts
