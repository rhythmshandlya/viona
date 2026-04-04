<youtube_clip_scenes>
## YOUTUBE CLIP SCENES (type: "youtube-clip")

When a scene has `type: "youtube-clip"` in scenes.json, the ENTIRE scene is a YouTube video
displayed with a themed frame. DO NOT create custom animations — just render the video
inside a frame that matches the studio theme.

### How to identify youtube-clip scenes:
Check scenes.json for:
```json
{
  "id": 4,
  "type": "youtube-clip",
  "videoSearch": "AI code assistant demo"
}
```

### Implementation for youtube-clip scenes:

IMPORTANT: The scene must accept `videoClips` from inputProps for preview playback.
During preview, the frontend passes `{ videoClips: { "4": "http://..." } }` with streaming URLs.
During export, render.ts downloads clips and passes local paths.
Special value `__loading__` means the video URL is being fetched - show a loading state.

**Frame styling:** Default to the studio theme's card styling for the frame around the video —
`COLORS.cardBg` as background, `boxShadow` for depth (no thin borders), `EW * 0.03` border radius,
and a subtle box shadow.

If the Director specifies a `frameStyle` in scenes.json (e.g., `"phone"`, `"laptop"`, `"browser"`, `"polaroid"`, `"film"`), implement that frame style instead. When no frameStyle is specified, use the default card frame.

```tsx
// scenes/Scene4.tsx - YouTube Clip Scene
import React from 'react';
import { AbsoluteFill, Video, staticFile } from 'remotion';
import { COLORS } from '../constants';

const EW = 1080;
const EH = 960;

interface Scene4Props {
  videoClips?: Record<string, string>;
}

export const Scene4: React.FC<Scene4Props> = ({ videoClips }) => {
  const clipUrl = videoClips?.['4'];
  const isLoading = clipUrl === '__loading__';
  const videoSrc = clipUrl && !isLoading ? clipUrl : staticFile('assets/clips/scene4-youtube-clip.mp4');

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.background }}>
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {/* Themed card frame */}
        <div style={{
          width: EW * 0.85,
          background: COLORS.cardBg,
          borderRadius: EW * 0.03,
          boxShadow: `0 ${EH * 0.008}px ${EH * 0.03}px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)`,
          overflow: 'hidden',
          padding: EW * 0.008,
        }}>
          <div style={{
            width: '100%',
            aspectRatio: '16/9',
            borderRadius: 24,
            overflow: 'hidden',
          }}>
            <Video
              src={videoSrc}
              muted
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
```

### Critical rules for youtube-clip scenes:
1. **Accept videoClips prop** — scene must receive `videoClips?: Record<string, string>` from inputProps
2. **Handle loading state** — check for `'__loading__'` value before using the URL:
   ```tsx
   const clipUrl = videoClips?.['N'];
   const isLoading = clipUrl === '__loading__';
   const videoSrc = clipUrl && !isLoading ? clipUrl : staticFile('assets/clips/sceneN-youtube-clip.mp4');
   ```
3. **Always muted** — add `muted` prop to `<Video>` — only speaker audio should play
4. **Use studio theme frame by default** — COLORS.cardBg, COLORS.cardBorder, 32px radius. If `frameStyle` is specified in scenes.json, use that style instead.
5. **Minimal code** — just themed frame + video
7. **Center the frame** — use flexbox to center

### DO for youtube-clip scenes:
- Studio theme card frame
- Subtle shadow and rounded corners
- Center alignment

### DON'T for youtube-clip scenes:
- Complex animations or transitions
- Multiple visual elements
- Text overlays (unless specified in visual description)
</youtube_clip_scenes>
