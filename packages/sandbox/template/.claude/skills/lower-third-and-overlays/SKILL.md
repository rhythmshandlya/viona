# Lower Third and Overlays Skill

## Purpose
Guide the design and implementation of text overlays, lower thirds, and on-screen graphics for video content. This skill covers typography, safe zones, animation timing, and overlay patterns.

---

## 1. Text Overlay Design Principles

### Hierarchy First

Every text overlay has a purpose. Before designing, identify which level it serves:

| Level | Purpose | Size | Weight | Duration | Example |
|---|---|---|---|---|---|
| **Primary** | Main title, section header | 48-72px | Bold/Black | 3-5s | "Why Rust Matters" |
| **Secondary** | Subtitle, context | 28-40px | Medium/Semibold | 3-5s | "A Systems Programming Revolution" |
| **Tertiary** | Supporting info, attribution | 18-24px | Regular/Light | 2-4s | "Source: Stack Overflow Survey 2025" |
| **Accent** | Numbers, stats, emphasis | 56-96px | Bold/Black | 2-4s | "340%" |
| **Caption** | Ongoing text, captions | 20-28px | Regular | Continuous | Subtitles |

**Rule**: Maximum 2 hierarchy levels visible at once. Never show primary + secondary + tertiary simultaneously — it's visual noise.

### Readability Requirements

**Contrast Ratio:**
- Minimum 4.5:1 for body text (WCAG AA)
- Minimum 7:1 for critical information (numbers, names)
- Always use a backdrop or shadow if text appears over variable backgrounds

**Backdrop Options (in order of preference):**
1. Semi-transparent panel: `background: rgba(0, 0, 0, 0.65)` — most reliable
2. Text shadow: `textShadow: '0 2px 8px rgba(0,0,0,0.7)'` — subtle, for short text
3. Gradient scrim: Bottom-to-transparent gradient behind lower-positioned text
4. Frosted glass: `backdropFilter: 'blur(12px)'` with light tint — modern, premium
5. Solid bar: Full-opacity colored bar — bold, broadcast-style

**Font Selection:**
- Sans-serif for all video text (serif is hard to read at small sizes on screens)
- Variable-weight font families preferred (Inter, Manrope, DM Sans, Outfit)
- Monospace only for code, numbers, or technical data
- Maximum 1 font family per video (use weight/size variations for hierarchy)
- Avoid thin weights (< 400) at sizes under 24px

### The 12-Word Rule

No single text overlay should contain more than 12 words. At standard viewing speeds:
- 3-5 words: Readable in 1.5s
- 6-8 words: Readable in 2.5s
- 9-12 words: Readable in 3.5s
- 13+ words: Too much — split into multiple overlays or reduce

If you need to display more text, use sequential reveals (one line at a time) or a bullet list with staggered animation.

---

## 2. Safe Zones

### Standard Safe Zones

Video content is viewed on different devices and platforms, each with different UI chrome that can obscure edges.

```
┌─────────────────────────────────────────────┐
│  10% margin (action safe)                   │
│  ┌───────────────────────────────────────┐  │
│  │  15% margin (title safe)              │  │
│  │  ┌─────────────────────────────────┐  │  │
│  │  │                                 │  │  │
│  │  │    SAFE CONTENT AREA            │  │  │
│  │  │    Place all text here          │  │  │
│  │  │                                 │  │  │
│  │  └─────────────────────────────────┘  │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

**Action Safe (10% margin):** All meaningful visual content should be within this zone. Graphics may extend to edges for aesthetic purposes but shouldn't carry information outside this zone.

**Title Safe (15% margin):** All text must be within this zone. Text at the edges of action safe may be cropped by some displays.

### Platform-Specific Safe Zones

**YouTube (16:9):**
- Title safe: 15% from all edges
- Bottom: Extra 10% margin if captions are enabled (viewer setting)
- Top: Extra 5% margin for channel watermark area
- Progress bar: Avoid bottom 40px in last 10% of video

**TikTok/Reels (9:16):**
- Bottom: 20% margin (username, caption, buttons overlay)
- Top: 10% margin (status bar, profile)
- Right: 15% margin (action buttons: like, comment, share)
- Left: 10% margin
- Safe area: center 60% of screen

**Shorts (9:16):**
- Similar to TikTok but bottom margin: 25% (more chrome)
- Title safe: center 50% of screen

### Safe Zone Implementation

```tsx
// Safe zone constants (1080p)
const SAFE_ZONES = {
  landscape: {
    actionSafe: { top: 108, right: 192, bottom: 108, left: 192 },  // 10%
    titleSafe: { top: 162, right: 288, bottom: 162, left: 288 },   // 15%
  },
  portrait: {
    // TikTok/Reels safe zone
    top: 108,       // 10%
    right: 162,     // 15%
    bottom: 384,    // 20% (platform UI)
    left: 108,      // 10%
  },
};
```

---

## 3. Lower Third Patterns

### Standard Lower Third

The most common overlay: speaker name and title in the bottom third of the frame.

```
┌─────────────────────────────────────────────┐
│                                             │
│                                             │
│           [Speaker on camera]               │
│                                             │
│                                             │
│  ┌────────────────────────┐                 │
│  │  Jane Smith             │                │
│  │  CEO, Acme Corp         │                │
│  └────────────────────────┘                 │
└─────────────────────────────────────────────┘
```

**Components:**
- Name: Primary text (24-32px, Bold)
- Title/Role: Secondary text (18-24px, Regular)
- Background: Semi-transparent panel or accent-colored bar
- Accent element: Colored line, logo, or icon

**Timing:**
- Appear: 2-3 seconds after the speaker starts talking (not immediately — let the viewer see the person first)
- Animation in: 10-15 frames (slide from left + fade)
- Hold: 3-4 seconds
- Animation out: 8-12 frames (fade or slide)
- Total on-screen: 4-5 seconds
- Show once per speaker per video (unless there's a significant time gap)

**Implementation:**
```tsx
const LowerThird: React.FC<{
  name: string;
  title: string;
  startFrame: number;
  accentColor?: string;
}> = ({ name, title, startFrame, accentColor = '#3B82F6' }) => {
  const frame = useCurrentFrame();
  const relFrame = frame - startFrame;

  const slideIn = spring({
    frame: relFrame,
    fps: 30,
    config: { damping: 26, stiffness: 120, mass: 1.0 },
  });

  const fadeOut = interpolate(
    relFrame,
    [105, 120],  // Fade out after ~3.5s
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  const opacity = relFrame < 105 ? slideIn : fadeOut;
  const translateX = interpolate(slideIn, [0, 1], [-100, 0]);

  return (
    <div style={{
      position: 'absolute',
      bottom: 120,
      left: 80,
      transform: `translateX(${translateX}px)`,
      opacity,
    }}>
      <div style={{
        borderLeft: `4px solid ${accentColor}`,
        paddingLeft: 16,
        background: 'rgba(0, 0, 0, 0.65)',
        padding: '12px 24px 12px 16px',
        borderRadius: '0 8px 8px 0',
      }}>
        <div style={{ fontSize: 28, fontWeight: 700, color: 'white' }}>
          {name}
        </div>
        <div style={{ fontSize: 20, fontWeight: 400, color: 'rgba(255,255,255,0.8)' }}>
          {title}
        </div>
      </div>
    </div>
  );
};
```

### Stat Display

Large number with context label for emphasizing statistics.

```
┌─────────────────────────────────────────────┐
│                                             │
│              340%                           │
│           revenue growth                    │
│           year over year                    │
│                                             │
│                                             │
└─────────────────────────────────────────────┘
```

**Components:**
- Number: Accent text (64-96px, Bold, accent color)
- Label: Secondary text (24-32px, Regular, white/light gray)
- Optional: Animated counter effect for the number
- Optional: Unit or comparison context ("vs. industry avg: 12%")

**Timing:**
- Counter animation: 20-30 frames (number counts up from 0)
- Label appears: 5-10 frames after counter completes
- Hold: 2-3 seconds after animation completes
- Total on-screen: 4-5 seconds

**Implementation:**
```tsx
const StatDisplay: React.FC<{
  value: number;
  suffix: string;
  label: string;
  startFrame: number;
}> = ({ value, suffix, label, startFrame }) => {
  const frame = useCurrentFrame();
  const relFrame = frame - startFrame;

  const countProgress = interpolate(
    relFrame,
    [0, 25],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  const displayValue = Math.round(value * countProgress);

  const labelOpacity = interpolate(
    relFrame,
    [25, 35],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  const fadeOut = interpolate(
    relFrame,
    [110, 125],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  const masterOpacity = relFrame < 110 ? 1 : fadeOut;

  return (
    <div style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      textAlign: 'center',
      opacity: masterOpacity,
    }}>
      <div style={{ fontSize: 80, fontWeight: 800, color: '#3B82F6' }}>
        {displayValue}{suffix}
      </div>
      <div style={{
        fontSize: 28,
        fontWeight: 400,
        color: 'rgba(255,255,255,0.7)',
        opacity: labelOpacity,
        marginTop: 8,
      }}>
        {label}
      </div>
    </div>
  );
};
```

### Pull Quote

Memorable quote from the speaker displayed prominently.

```
┌─────────────────────────────────────────────┐
│                                             │
│     "The best code is the code             │
│      you never have to write."              │
│                                             │
│                    — Jeff Atwood             │
│                                             │
└─────────────────────────────────────────────┘
```

**Components:**
- Quotation marks: Large, decorative (accent color, 60-80px)
- Quote text: Primary text (32-40px, Italic or Regular)
- Attribution: Tertiary text (20-24px, Regular, dimmed)
- Background: Full-screen darkened overlay or blurred background

**Timing:**
- Quotation marks appear first: frame 0
- Text reveals word-by-word or line-by-line: 5 frames per word or 15 frames per line
- Attribution fades in: 10 frames after text complete
- Hold: 2-3 seconds
- Fade out all elements: 15 frames

### Bullet List

Sequential reveal of list items.

```
┌─────────────────────────────────────────────┐
│                                             │
│     Key Takeaways                           │
│                                             │
│     ✓  Memory safety without GC             │
│     ✓  Zero-cost abstractions               │
│     →  Growing ecosystem                    │
│        Industry adoption                    │
│                                             │
└─────────────────────────────────────────────┘
```

**Components:**
- Header: Primary text (32-40px, Bold)
- Bullet items: Secondary text (24-32px, Regular)
- Bullet marker: checkmark, arrow, number, or custom icon
- Active item: full opacity + accent color marker
- Future items: reduced opacity (0.3) or hidden

**Timing:**
- Header appears: frame 0 (slide + fade, 12 frames)
- First item: 20 frames after header
- Each subsequent item: 15-25 frames apart (stagger)
- Active item highlights (marker changes color) on reveal
- All items visible for 2-3s after last reveal
- Total: depends on item count (typically 3-6s)

**Implementation:**
```tsx
const BulletReveal: React.FC<{
  title: string;
  items: string[];
  startFrame: number;
  stagger?: number;
}> = ({ title, items, startFrame, stagger = 20 }) => {
  const frame = useCurrentFrame();
  const relFrame = frame - startFrame;

  const titleProgress = spring({
    frame: relFrame,
    fps: 30,
    config: { damping: 26, stiffness: 120, mass: 1.0 },
  });

  return (
    <div style={{ position: 'absolute', top: '20%', left: '15%' }}>
      <div style={{
        fontSize: 36,
        fontWeight: 700,
        color: 'white',
        opacity: titleProgress,
        transform: `translateY(${(1 - titleProgress) * 20}px)`,
        marginBottom: 32,
      }}>
        {title}
      </div>
      {items.map((item, i) => {
        const itemDelay = 20 + i * stagger;
        const itemProgress = spring({
          frame: Math.max(0, relFrame - itemDelay),
          fps: 30,
          config: { damping: 26, stiffness: 120, mass: 1.0 },
        });
        return (
          <div key={i} style={{
            fontSize: 26,
            color: 'white',
            opacity: itemProgress,
            transform: `translateX(${(1 - itemProgress) * 30}px)`,
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}>
            <span style={{ color: '#3B82F6', fontSize: 20 }}>&#10003;</span>
            {item}
          </div>
        );
      })}
    </div>
  );
};
```

### Callout / Annotation

Small text that provides supplementary context, corrections, or commentary.

```
┌─────────────────────────────────────────────┐
│                              ┌───────────┐  │
│                              │ *Actually  │  │
│                              │  it was    │  │
│                              │  2024, not │  │
│                              │  2023      │  │
│           [Speaker]          └───────────┘  │
│                                             │
└─────────────────────────────────────────────┘
```

**Components:**
- Text: Caption text (18-22px, Regular)
- Background: Rounded rectangle, semi-transparent or solid accent color
- Optional: Arrow pointing to relevant area, asterisk prefix
- Position: Corner of frame, not overlapping speaker

**Timing:**
- Quick pop-in: 8-10 frames (scale from 0.8 to 1.0 + fade)
- Hold: 2-3 seconds
- Quick pop-out: 6-8 frames

---

## 4. Animation Timing for Text

### Entrance Animations

| Animation | Duration | Best For |
|---|---|---|
| Fade in | 8-12f | Subtle, non-distracting entries |
| Slide up + fade | 10-15f | Lower thirds, bottom-positioned text |
| Slide from left + fade | 10-15f | Names, titles, labels |
| Scale up + fade | 8-12f | Callouts, accent numbers |
| Character reveal | 2-3f per char | Dramatic reveals, kinetic typography |
| Word-by-word | 4-6f per word | Pull quotes, emphasis phrases |
| Line-by-line | 12-15f per line | Bullet lists, multi-line content |
| Typewriter | 1-2f per char | Code, technical text, retro style |

### Exit Animations

Exits should be faster than entrances (Rule: exit duration = entrance duration * 0.7):

| Animation | Duration | Notes |
|---|---|---|
| Fade out | 6-10f | Universal, always safe |
| Slide down + fade | 8-12f | Mirror of slide-up entrance |
| Scale down + fade | 6-10f | Shrinks away naturally |
| Blur + fade | 8-12f | Premium feel, defocus then disappear |

### Timing Relationships

**Text appears WITH spoken word:**
- Text animation should complete 2-3 frames BEFORE the speaker says the word
- This gives the viewer's eye time to read before the ear confirms

**Text appears AFTER spoken word:**
- Start text animation 5-10 frames after the word is spoken
- Reinforcement: viewer hears it, then sees it confirmed visually

**Text appears BEFORE spoken word (spoiler):**
- Start text animation 15-30 frames before the word is spoken
- Creates anticipation: viewer reads ahead, speaker confirms
- Use sparingly — can feel like subtitles if overused

### Spring Configuration for Text

```tsx
// Standard text entrance (smooth, professional)
const SMOOTH = { damping: 26, stiffness: 120, mass: 1.0 };

// Punchy text entrance (energetic, attention-grabbing)
const SNAPPY = { damping: 22, stiffness: 170, mass: 0.8 };

// Gentle text entrance (calm, elegant)
const GENTLE = { damping: 30, stiffness: 80, mass: 1.2 };
```

---

## 5. Overlay Composition Rules

### Z-Index Layering

When multiple overlays are visible simultaneously, layer them:

```
Layer 5 (top):   Callouts, corrections, annotations
Layer 4:         Stat displays, pull quotes (foreground text)
Layer 3:         Lower thirds, name bars
Layer 2:         Background panels, scrims, gradients
Layer 1 (base):  Video content, speaker, B-roll
```

### Maximum Overlay Count

- **1 overlay**: Ideal. Clean, focused, easy to read.
- **2 overlays**: Acceptable if they don't overlap and serve different purposes (e.g., lower third + corner watermark).
- **3 overlays**: Maximum. Only in special cases (lower third + stat + annotation). Must be in different screen quadrants.
- **4+ overlays**: Never. Visual overload. Reduce or sequence them.

### Overlay Spacing

- Minimum 40px between any two text overlays
- Overlays should not be in the same screen quadrant unless one is very small (callout)
- Leave breathing room around text (padding: 16-24px within panels)

### Color Consistency

All overlays in a video should share:
- Same font family
- Same accent color (used in borders, highlights, markers)
- Same background treatment (all semi-transparent panels, or all text-shadow, not mixed)
- Same corner radius on panels (0px for sharp/professional, 8px for modern, 16px for friendly)

---

## 6. Common Overlay Patterns by Section Type

### Hook Section
- Full-screen title card with bold primary text
- Animated counter for a shocking statistic
- No lower thirds (save for introduction)

### Speaker Introduction
- Lower third with name and title (appears 2-3s in)
- No other overlays (keep focus on the speaker)

### Explanation Section
- Term card when jargon is introduced
- Bullet list for multi-point explanations
- Stat display for supporting data

### Evidence Section
- Source attribution overlay on screenshots
- Highlight rectangle on zoomed screenshot regions
- Annotation callouts pointing to specific UI elements

### Conclusion Section
- Summary bullet list (key takeaways)
- CTA text overlay ("Subscribe", "Link in description")
- Final lower third (if guest speaker, show their info again)

---

## 7. Overlay Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| Text is unreadable | Low contrast against background | Add semi-transparent panel or increase text shadow |
| Overlay feels cluttered | Too many elements at once | Reduce to max 2 overlays, or sequence them |
| Text appears too late | Animation starts after the spoken word | Shift animation start 10-15 frames earlier |
| Text disappears too fast | Hold time too short | Ensure minimum 2s hold after animation completes |
| Lower third blocks speaker's face | Positioned too high | Move to bottom 15% of frame, verify safe zone |
| Numbers don't land on the beat | Counter animation timing off | Adjust counter duration so final number hits at the sync point |
| Overlay animation is jerky | Missing clamp on interpolate | Add both extrapolateLeft and extrapolateRight: 'clamp' |
| Text wraps unexpectedly | Container width not set | Set explicit maxWidth on text container |
| Overlay persists between sections | Missing exit animation | Add fadeOut interpolation tied to section end frame |
