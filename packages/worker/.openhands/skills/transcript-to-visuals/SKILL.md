---
name: transcript-to-visuals
description: Convert transcript content to visual segment types. Maps content to title cards, stat counters, bullet lists, and other visualizations.
triggers:
  - transcript
  - content mapping
  - visual segment
  - title card
  - stat counter
  - bullet list
---

# Transcript to Visuals

## Content Mapping

| Content | Visual |
|---------|--------|
| Statistics | Animated counter, progress bar, chart |
| Lists/Steps | Staggered list, numbered sequence |
| Comparisons | Side-by-side, versus screen |
| Quotes | Large text with attribution |
| Processes | Flowchart, step-by-step diagram |

## Segment Components

```tsx
// Title card (3-5 sec)
const TitleCard = ({ title, subtitle }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 20], [0, 1]);
  const y = interpolate(frame, [0, 30], [30, 0], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ opacity, transform: `translateY(${y}px)` }}>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
    </AbsoluteFill>
  );
};

// Stat counter (4-6 sec)
const StatCounter = ({ value, label }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const animatedValue = Math.floor(interpolate(frame, [0, fps * 2], [0, value]));
  const scale = spring({ frame, fps, config: { damping: 12 } });
  return (
    <div style={{ transform: `scale(${scale})` }}>
      <div style={{ fontSize: 120 }}>{animatedValue.toLocaleString()}</div>
      <div>{label}</div>
    </div>
  );
};
```

## Timing

| Segment | Duration |
|---------|----------|
| Title cards | 3-5 sec |
| Stat counters | 4-6 sec |
| Bullet lists | 2-3 sec/item |
| Quotes | 5-8 sec |

## Workflow

1. Analyze transcript for key topics/statistics
2. Segment into 5-15 second visual segments
3. Match content to visualization type
4. Build components
5. Verify with `npx remotion still`
