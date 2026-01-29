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
| Key Points | Bullet points with icons |

## Visual Segment Types

### Title Card (3-5 seconds)
```tsx
const TitleCard = ({ title, subtitle }: { title: string; subtitle?: string }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 20], [0, 1]);
  const y = interpolate(frame, [0, 30], [30, 0], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ background: '#0a0a0a', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ opacity, transform: `translateY(${y}px)`, textAlign: 'center' }}>
        <h1 style={{ fontSize: 72, fontWeight: 700, color: '#fff', margin: 0 }}>{title}</h1>
        {subtitle && <p style={{ fontSize: 24, color: '#888', marginTop: 16 }}>{subtitle}</p>}
      </div>
    </AbsoluteFill>
  );
};
```

### Stat Counter (4-6 seconds)
```tsx
const StatCounter = ({ value, label, suffix = '' }: { value: number; label: string; suffix?: string }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const animatedValue = Math.floor(interpolate(frame, [0, fps * 2], [0, value]));
  const scale = spring({ frame, fps, config: { damping: 12 } });

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', background: '#0a0a0a' }}>
      <div style={{ transform: `scale(${scale})`, textAlign: 'center' }}>
        <div style={{ fontSize: 120, fontWeight: 800, color: '#fff' }}>
          {animatedValue.toLocaleString()}{suffix}
        </div>
        <div style={{ fontSize: 32, color: '#666', marginTop: 16 }}>{label}</div>
      </div>
    </AbsoluteFill>
  );
};
```

### Bullet List (2-3 seconds per item)
```tsx
const BulletList = ({ items }: { items: string[] }) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ padding: 80, justifyContent: 'center', background: '#0a0a0a' }}>
      <div>
        {items.map((item, i) => {
          const delay = i * 15;
          const opacity = interpolate(frame, [delay, delay + 20], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          const x = interpolate(frame, [delay, delay + 20], [-50, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });

          return (
            <div key={i} style={{ opacity, transform: `translateX(${x}px)`, display: 'flex', alignItems: 'center', marginBottom: 32 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#3b82f6', marginRight: 24, flexShrink: 0 }} />
              <span style={{ fontSize: 36, color: '#fff' }}>{item}</span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
```

### Quote Display (5-8 seconds)
```tsx
const QuoteDisplay = ({ quote, author }: { quote: string; author: string }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 30], [0, 1]);

  return (
    <AbsoluteFill style={{ padding: 120, justifyContent: 'center', background: '#0a0a0a' }}>
      <div style={{ opacity }}>
        <div style={{ fontSize: 64, color: '#3b82f6', marginBottom: 24 }}>"</div>
        <p style={{ fontSize: 48, color: '#fff', lineHeight: 1.4, fontStyle: 'italic', margin: 0 }}>{quote}</p>
        <p style={{ fontSize: 24, color: '#888', marginTop: 32 }}>— {author}</p>
      </div>
    </AbsoluteFill>
  );
};
```

## Timing Guidelines

- **Title cards**: 3-5 seconds (90-150 frames at 30fps)
- **Stat counters**: 4-6 seconds (allow counting animation)
- **Bullet lists**: 2-3 seconds per item
- **Quotes**: 5-8 seconds (reading time)
- **Transitions**: 0.5-1 second overlap

## Workflow

1. **Analyze transcript** - Identify key topics, statistics, lists
2. **Segment content** - Break into 5-15 second visual segments
3. **Choose visual type** - Match content to appropriate visualization
4. **Create components** - Build Remotion components
5. **Take screenshots** - Verify with `npx remotion still`
6. **Iterate** - Refine based on visual feedback
7. **Create metadata.json** - Document all segments with timing
