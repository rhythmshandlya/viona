# Social Preview Overlay Design

## Overview

A toggleable overlay on the video preview that shows how the video will look on Instagram Reels, TikTok, and YouTube Shorts. Two modes: full platform UI mockup and safe zone guides.

This is a display-only feature. It does not affect project data, Remotion composition, or video export.

## Architecture

### Components

1. **`SceneToolbar`** — Bar at the bottom-center of the Scene area with platform toggle buttons and mode switch.
2. **`SocialPreviewOverlay`** — Absolutely-positioned overlay rendered on top of the Remotion player inside Scene.

### State

Local React state in `Scene.tsx`:

```typescript
type SocialPlatform = 'instagram' | 'tiktok' | 'youtube';
type OverlayMode = 'mockup' | 'safezones';

const [activePlatform, setActivePlatform] = useState<SocialPlatform | null>(null);
const [overlayMode, setOverlayMode] = useState<OverlayMode>('mockup');
```

No Zustand store changes. No project data changes. No Remotion changes.

### Rendering

- The overlay is a sibling `<div>` positioned absolutely over the player container with `pointer-events: none`.
- All mockup elements are HTML/CSS with simple SVG icons (no external assets).
- Scales proportionally with the player container dimensions.

## Platform UI Mockups

Each platform overlay renders simplified but recognizable UI chrome. Elements are semi-transparent so they don't fully obscure the video.

### Instagram Reels

- **Right side:** Heart, Comment, Share, Bookmark, "..." icons stacked vertically (bottom-right)
- **Bottom-left:** Circle avatar + "username" + "Follow" button
- **Bottom:** Description text placeholder (2 lines), audio ticker bar
- **Very bottom:** Navigation bar with Home/Search/Add/Reels/Profile icons

### TikTok

- **Right side:** Profile pic circle + Like, Comment, Bookmark, Share icons stacked vertically (bottom-right)
- **Bottom-left:** "@username" + description text (3 lines) + music row with marquee icon
- **Bottom-right:** Spinning music disc
- **Top:** No persistent chrome (full-bleed)

### YouTube Shorts

- **Right side:** Like, Dislike, Comment, Share, "..." icons stacked vertically
- **Bottom-left:** Channel icon + "Channel Name" + "Subscribe" pill button
- **Bottom:** Description text placeholder, audio info
- **Bottom nav:** Home/Shorts/+/Subscriptions/Library icons

All icons are simple SVG shapes (circles, hearts, chat bubbles, arrows) — recognizable, not pixel-perfect replicas.

## Safe Zone Guides

Translucent colored rectangles highlighting danger areas where platform UI covers content.

### Zone Definitions (percentage of video dimensions)

| Zone | Instagram Reels | TikTok | YouTube Shorts |
|------|----------------|--------|----------------|
| Top (status bar) | 5% height | 5% height | 5% height |
| Bottom (description + nav) | 25% height | 20% height | 25% height |
| Right (action buttons) | 15% width | 15% width | 15% width |

### Visual Treatment

- Danger zones: semi-transparent red fill (`rgba(255, 80, 60, 0.15)`) with dashed border
- Small label in each zone: "Status bar", "Actions", "Description & nav"
- Safe center area: subtle green border indicating content-safe region
- All zones use `pointer-events: none`

The safe area (center ~60-70% of frame) is where subtitles and key content should live.

## Toolbar UI

Positioned at bottom-center of the Scene area, above the existing scale indicator.

```
[ IG icon | TT icon | YT icon ]  ·  [ Mockup | Safe Zones ]    85%
```

- **Left group:** Three platform icon buttons. Click to activate; click active to deactivate.
- **Separator:** Subtle dot divider.
- **Right group:** Segmented control for Mockup vs Safe Zones. Only visible when a platform is active.
- **Far right:** Existing scale percentage indicator.

### Styling

- Dark surface background (`--editor-bg-surface`), muted text, compact sizing
- Active platform button highlighted with accent color
- `backdrop-blur` and slight transparency
- ~36px tall

### Keyboard Shortcut

`P` toggles the overlay on/off (toggles last-used platform). Same pattern as existing `T` shortcut for transcript panel.

## File Structure

```
apps/web/src/features/editor-v2/
  scene/
    Scene.tsx                    # Updated: add toolbar + overlay state
    SocialPreviewOverlay.tsx     # New: overlay rendering
    SceneToolbar.tsx             # New: toolbar with platform/mode toggles
    social-platforms.ts          # New: platform definitions, zone data, SVG icons
```

## Implementation Notes

- Platform zone percentages are constants in `social-platforms.ts` for easy tuning.
- SVG icons are inline React components, not imported assets.
- Overlay scales using the same `dimensions` state already computed in Scene.tsx.
- No changes to the Remotion player, composition, or export pipeline.
