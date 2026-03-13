---
name: video-engagement
description: Design principles for scroll-stopping short-form video content. Covers hook techniques, retention, color palettes, scene structure, and visual metaphors. Use when planning or building Instagram Reels, TikTok, or YouTube Shorts compositions.
---

# Video Engagement Design Guide

## The Hook (First 3 Seconds)

Your video has 0.5-3 seconds to stop the scroll. The opening MUST be visually striking.

**Hook Techniques (use at least one):**
1. **Bold Statement** - Large, animated text with a provocative claim
2. **Visual Paradox** - Something unexpected (data flowing backwards, impossible shapes)
3. **Dramatic Reveal** - Start zoomed in, pull back to reveal context
4. **Motion Explosion** - Particles/elements bursting from center
5. **Question Hook** - Animated question mark or "Did you know...?"

## Retention Techniques

1. **Progressive Revelation** - Don't show everything at once. Build understanding.
2. **Visual Payoff Every 3-5 Seconds** - New animation, new element, new insight
3. **Anticipation Loops** - Show something partially, then reveal fully
4. **Counter/Progress Indicators** - Numbers counting, progress bars filling
5. **Pattern Interrupts** - Just when viewer expects X, do Y

## Color Palettes

**Electric Sunset (high energy):**
- Primary: `#ff6b6b` (coral), Secondary: `#feca57` (gold), Accent: `#ff9ff3` (pink), Dark: `#1a1a2e`
- Gradient: `linear-gradient(135deg, #ff6b6b 0%, #feca57 50%, #ff9ff3 100%)`

**Cyber Neon (tech/data):**
- Primary: `#00f5d4` (cyan), Secondary: `#7b2cbf` (purple), Accent: `#f72585` (magenta), Dark: `#0a0a0f`
- Gradient: `linear-gradient(135deg, #00f5d4 0%, #7b2cbf 50%, #f72585 100%)`

**Soft Gradient (calm/educational):**
- Primary: `#667eea` (indigo), Secondary: `#764ba2` (purple), Accent: `#66a6ff` (sky), Dark: `#1e1e2f`
- Gradient: `linear-gradient(135deg, #667eea 0%, #764ba2 100%)`

**Forest Tech (nature + tech):**
- Primary: `#00b894` (mint), Secondary: `#0984e3` (ocean), Accent: `#fdcb6e` (gold), Dark: `#0c1618`
- Gradient: `linear-gradient(135deg, #00b894 0%, #0984e3 100%)`

## Mobile Typography (1080x1920 vertical)

| Role | fontSize | fontWeight | lineHeight |
|------|----------|------------|------------|
| Hero | 96 | 900 | 1.1 |
| Title | 64 | 800 | 1.2 |
| Subtitle | 48 | 600 | 1.3 |
| Body | 36 | 500 | 1.5 |
| Caption | 28 | 400 | 1.4 |

For 1920x1080 horizontal, use 75% of these values.

## Scene Structure for Engagement

```
Scene 1 (0-3s):  THE HOOK       - Stop the scroll, create curiosity
Scene 2 (3-8s):  THE SETUP      - Establish the problem/question
Scene 3 (8-15s): THE BUILD      - Progressive revelation of concept
Scene 4 (15-22s):THE PAYOFF     - Visual climax, "aha" moment
Scene 5 (22-28s):THE REINFORCE  - Solidify understanding
Scene 6 (28-30s):THE CTA        - Call to action, loop point
```

## Backgrounds That Pop

Never use plain solid colors. Always add depth:

```tsx
const AnimatedBackground: React.FC = () => {
  const frame = useCurrentFrame();
  const gradientAngle = interpolate(frame, [0, 300], [135, 225]);
  return (
    <AbsoluteFill style={{
      background: `linear-gradient(${gradientAngle}deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)`,
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.1) 1px, transparent 0)',
        backgroundSize: '40px 40px',
      }} />
    </AbsoluteFill>
  );
};
```

## Motion Design Trends

1. **Morphing Shapes** - Elements smoothly transforming into other shapes
2. **Liquid Motion** - Blob-like, organic movements
3. **Kinetic Typography** - Text that moves with meaning
4. **3D Depth** - Parallax layers, perspective transforms
5. **Micro-interactions** - Small details that reward attention

## Visual Metaphors (Make Abstract Concrete)

| Abstract Concept | Visual Metaphor |
|------------------|-----------------|
| Data flow | River of glowing particles |
| Algorithm | Assembly line / conveyor belt |
| Recursion | Mirrors reflecting mirrors |
| API call | Package being delivered |
| Cache | Drawer/filing cabinet |
| Memory | Grid of glowing boxes |
| Process | Gears turning together |
| Network | Connected nodes with pulses |
| Error | Red warning flash + shake |
| Success | Green checkmark + confetti |
