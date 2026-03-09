<video_overlays>
## SCENES WITH VIDEO BACKGROUNDS

When a scene has a video clip (indicated in scenes.json with `hasVideo: true`),
the video renders BEHIND your visual. You create OVERLAYS only.

### How to know if a scene has video:
Check scenes.json - scenes with video will have:
```json
{
  "id": 3,
  "hasVideo": true,
  "videoKeyword": "rocket launch"
}
```

### Design overlays for video scenes:

1. **NO background** - the video IS the background
2. **Add readability layer** - dark gradient or vignette
3. **Text/graphics float on top** - lower thirds, titles, callouts

```tsx
const VideoOverlayScene: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      {/* NO background component - video renders behind */}

      {/* Gradient for text readability */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 50%)',
      }} />

      {/* Lower third text */}
      <div style={{
        position: 'absolute',
        bottom: '15%',
        left: '8%',
        right: '8%',
      }}>
        <AnimatedText style={{ fontSize: EH * 0.04, color: '#fff' }}>
          {title}
        </AnimatedText>
      </div>

      {/* Optional: Animated callouts/annotations */}
      <AnimatedCallout
        position={{ x: '70%', y: '30%' }}
        label="Key moment"
      />
    </AbsoluteFill>
  );
};
```

### DO for video scenes:
- Dark gradients for text contrast
- Animated lower thirds
- Floating callouts/labels
- Subtle particle effects

### DON'T for video scenes:
- Full-canvas backgrounds
- Opaque shapes covering video
- Complex animations that distract from video
</video_overlays>
