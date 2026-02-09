# Editor Redesign - Unified Light Theme

**Date:** 2026-02-09
**Status:** Approved

## Overview

Redesign the project editor (`/project/[id]`) to match the landing page and dashboard aesthetic. The current dark, complex editor will become a warm, light, spacious interface that feels cohesive with the rest of the app.

### Goals

1. Unified light theme using existing dashboard color palette
2. Layout inspired by Reelio reference (left tools, center preview+timeline, right AI chat)
3. Simplified UI - the editor should feel approachable, not overwhelming
4. AI Assistant panel ready for future features (real-time progress, section-based edits)

### Current Features (keep scope minimal)

- Video preview with playback controls
- Transcript/caption editing
- Caption styling (font, color, animation)
- Export

---

## Layout Structure

```
┌──────────────────────────────────────────────────────────────────────┐
│  HEADER (56px)                                                       │
│  [Logo] | [← Back]     Project Name           [Undo][Redo] [Preview] [Export] │
├──────────┬───────────────────────────────────────┬───────────────────┤
│          │                                       │                   │
│  LEFT    │     VIDEO PREVIEW                     │   AI ASSISTANT    │
│  SIDEBAR │     + transport controls              │   (320px)         │
│  (300px) │                                       │                   │
│          ├───────────────────────────────────────┤                   │
│          │     TIMELINE (180px, resizable)       │                   │
│          │     (tracks: video, captions, audio)  │                   │
└──────────┴───────────────────────────────────────┴───────────────────┘
```

---

## Color Palette

| Token | Value | Usage |
|-------|-------|-------|
| `--background` | #FFFBF7 | Page background, header |
| `--surface` | #FFFFFF | Panels, sidebars, cards |
| `--canvas` | #F5F0EB | Video preview area background |
| `--muted` | #F5F5F5 | Input backgrounds, AI bubbles, timeline clips |
| `--border` | #E5E5E5 | All borders and dividers |
| `--foreground` | #1A1A1A | Primary text |
| `--muted-foreground` | #6B7280 | Secondary text, labels |
| `--primary` | #F97316 | Accent color, buttons, playhead, active states |
| `--primary-soft` | #FFF7ED | Active state backgrounds |

---

## Typography

- **Font family:** DM Sans / Outfit (existing)
- **UI labels:** 12-14px, font-medium
- **Section headers:** 11px, uppercase, tracking-wide, muted-foreground
- **Inputs:** 14px
- **Timeline timestamps:** 11px, monospace

---

## Component Specifications

### Header (56px height)

**Background:** #FFFBF7 with 1px bottom border (#E5E5E5)

**Layout:**
```
[Logo] | [← Projects]          Project Name          [Undo][Redo]  [Preview]  [Export]
```

**Left zone:**
- Clipify logo (32px height)
- Vertical divider (1px #E5E5E5, 24px tall)
- Back link: ghost button with arrow + "Projects" text

**Center zone:**
- Project name: `text-base font-medium text-foreground`
- Editable on click (inline input)

**Right zone:**
- Undo/Redo: 36px icon buttons, ghost style, `text-muted-foreground`, hover `text-primary`
- Preview: Ghost button with play icon
- Export: Filled button `bg-primary text-white h-9 px-4 rounded-md`

**Spacing:**
- 16px padding on edges
- 8px gap between right-side buttons

---

### Left Sidebar (300px total)

#### Icon Rail (64px width)

**Tools:**
- Captions (T icon) - transcript editing
- Style (paintbrush icon) - caption appearance
- Layout (grid icon) - video positioning

**Item styling:**
- Size: 64px × 56px
- Icon: 20px centered, label 11px below
- Default: transparent, `text-muted-foreground`
- Hover: `bg-muted` (#F5F5F5)
- Active: `bg-primary/10`, `text-primary`, 2px left border `bg-primary`

#### Settings Panel (236px width)

Contextual based on selected tool.

**Captions panel:**
- Font section: family dropdown, size input
- Style section: color picker, weight, outline toggle
- Animation section: preset cards (2×2 grid)

**Style panel:**
- Caption Box: background color, padding, radius
- Position: alignment buttons (top/middle/bottom)

**Layout panel:**
- Video: fit mode (fill/fit/crop)
- Background: color picker for letterbox

**Panel styling:**
- Padding: 16px
- Section header: `text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2`
- Section spacing: 20px between sections
- Inputs: existing `h-9 rounded-md border-input` style

---

### Center Area - Video Preview

**Background:** #F5F0EB (warm gray canvas)

#### Preview Canvas

- Padding: 24px around video
- Video centered horizontally and vertically
- Aspect ratio: 9:16 (vertical/shorts)
- Border radius: 8px
- Shadow: `shadow-card`

**Zoom control** (top-left):
- Dropdown: "68%" with chevron
- Ghost style, `text-sm text-muted-foreground`
- Options: Fit, 50%, 75%, 100%, 150%

**Fullscreen toggle** (top-right):
- Icon button, 32px, ghost style

#### Transport Controls (64px height)

```
[00:11] ════════════●══════════════ [08:32]
        [🔊] [⏮] [▶] [⏭] [⛶]
```

**Scrubber:**
- Track: 4px, `bg-border`, rounded-full
- Progress: `bg-primary`
- Handle: 14px circle, white, `shadow-md`, `border-2 border-primary`

**Time display:** `text-sm font-mono text-muted-foreground`

**Buttons:**
- 36px icon buttons, ghost style
- Play: 40px, `bg-primary text-white rounded-full`

---

### Timeline (180px height, resizable)

**Background:** #FFFFFF with 1px top border #E5E5E5

#### Time Ruler (28px height)

- Background: #FAFAFA
- Bottom border: 1px #E5E5E5
- Labels: `text-xs font-mono text-muted-foreground`

**Playhead bubble:**
- `bg-primary text-white text-xs font-mono px-2 py-0.5 rounded`

#### Track Area

**Track row:** 48px height each

**Track controls** (left, 48px width):
- Lock, Mute, Visibility icons
- 16px, `text-muted-foreground`, hover `text-foreground`

**Tracks:**
1. Video track - frame thumbnails
2. Captions track - rounded blocks with "T" icon + text preview
3. Audio track - waveform visualization

**Clip styling:**
- Background: `bg-muted` (#F5F5F5)
- Border radius: 6px
- Border: 1px #E5E5E5
- Selected: `ring-2 ring-primary`
- Hover: `shadow-sm`

#### Playhead

- 2px vertical line, `bg-primary`
- Full height of track area
- Draggable

---

### Right Panel - AI Assistant (320px width)

**Background:** #FFFFFF with 1px left border #E5E5E5

#### Header (56px)

```
[✨] AI Assistant                    [···]
```

- Sparkle icon: 20px, `text-primary`
- Title: `text-sm font-semibold`
- Menu button: ghost, for settings/collapse

#### Chat Area (scrollable)

**Empty state:**
- Centered: 48px sparkle icon `text-primary/30`
- Text: "Ask AI to help edit your video"
- `text-sm text-muted-foreground`

**User message:**
- Align right
- `bg-primary text-white`
- `rounded-2xl rounded-br-md px-4 py-2 text-sm`
- Max-width: 85%

**AI message:**
- Align left
- `bg-muted text-foreground`
- `rounded-2xl rounded-bl-md px-4 py-2 text-sm`
- Max-width: 85%

**Progress indicator** (future):
- Inside AI bubble
- Animated progress bar
- Status text: `text-xs text-muted-foreground`

#### Input Area (fixed bottom)

- Padding: 16px
- Top border: 1px #E5E5E5
- Input: `bg-muted rounded-xl px-4 py-3 text-sm`
- Placeholder: "Ask AI to make changes..."
- Send button: 32px circle inside input, `bg-primary text-white`, arrow-up icon

---

## Responsive Behavior

- **Min width:** 1024px (desktop-first editor)
- **Right panel:** Collapsible via toggle on smaller screens
- **Timeline:** Resizable height (drag top edge)

---

## Animations

- Panel transitions: 200ms ease-out
- Hover lifts: `translateY(-1px)`
- Playhead: smooth scrubbing
- Chat messages: fade-in-up on appear
- Button hovers: color transitions 150ms

---

## Future AI Features (design accommodates)

1. **Real-time progress** - Progress bar inside AI message bubbles
2. **Section selection** - After visuals generated, user selects sections in chat to request edits
3. **Quick actions** - Chip buttons for common AI commands (optional future addition)

---

## Implementation Notes

- Replace existing `--editor-*` CSS variables with light theme values
- Keep existing panel structure, restyle components
- AI chat is UI shell only for now (backend not connected)
- Use existing dashboard components where possible (Button, Input, Card patterns)
