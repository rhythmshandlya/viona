---
triggers:
  - transcript
  - content mapping
  - visual segment
  - title card
  - stat counter
  - bullet list
---

# Transcript to Visual Conversion

## Content-to-Visual Mapping

| Content Type | Visual Treatment |
|--------------|------------------|
| Statistics/Numbers | Animated counter, progress bar, chart |
| Lists/Steps | Staggered list animation, numbered sequence |
| Comparisons | Side-by-side, before/after, versus screen |
| Quotes | Large text with attribution |
| Definitions | Term + explanation card |
| Processes | Flowchart, step-by-step diagram |
| Timeline/History | Horizontal timeline, year markers |

## Visual Segment Types

### Title Card (3-5 seconds)
```tsx
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
```

### Stat Counter (4-6 seconds)
```tsx
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

### Bullet List (2-3 sec/item)
```tsx
const BulletList = ({ items }) => {
  const frame = useCurrentFrame();

  return (
    <div>
      {items.map((item, i) => {
        const delay = i * 15;
        const opacity = interpolate(frame, [delay, delay + 20], [0, 1], {
          extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
        });
        return <div key={i} style={{ opacity }}>{item}</div>;
      })}
    </div>
  );
};
```

## Timing Guidelines

| Segment | Duration |
|---------|----------|
| Title cards | 3-5 sec (90-150 frames) |
| Stat counters | 4-6 sec |
| Bullet lists | 2-3 sec per item |
| Quotes | 5-8 sec |
| Transitions | 0.5-1 sec overlap |

## Workflow

1. Analyze transcript - Identify key topics, statistics, lists
2. Segment content - Break into 5-15 second visual segments
3. Choose visual type - Match content to visualization
4. Create components - Build Remotion components
5. Verify with screenshots - `npx remotion still`
6. Create metadata.json - Document timing
