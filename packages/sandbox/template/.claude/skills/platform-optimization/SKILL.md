# Platform Optimization Skill

## Purpose
Guide platform-specific video export decisions — aspect ratios, format specifications, text safe zones, hook optimization, and delivery best practices for YouTube, TikTok, Instagram Reels, and YouTube Shorts.

---

## 1. Platform Export Specifications

### YouTube (Landscape - Primary Format)

| Parameter | Specification |
|---|---|
| Aspect Ratio | 16:9 |
| Resolution | 1920x1080 (1080p) minimum, 3840x2160 (4K) preferred |
| Frame Rate | 30 fps (standard), 60 fps (gaming, fast motion) |
| Video Codec | H.264 (broad compatibility), H.265/HEVC (better quality at same bitrate) |
| Audio Codec | AAC-LC |
| Audio Sample Rate | 48 kHz |
| Audio Channels | Stereo |
| Container | MP4 |
| Max File Size | 256 GB |
| Max Duration | 12 hours |
| Bitrate (1080p) | 8-12 Mbps |
| Bitrate (4K) | 35-45 Mbps |
| Color Space | Rec. 709 (SDR), Rec. 2020 (HDR) |

**YouTube-Specific Considerations:**
- First frame becomes the auto-thumbnail if no custom thumbnail is set — make it visually compelling
- Chapters: Include timestamps in description (0:00 Intro, 1:23 Topic A, etc.)
- End screen: Reserve last 20 seconds for end screen elements (cards, subscribe button)
- Cards: Can appear at any point — plan visual layout to not conflict with card placement (top-right)
- Captions: YouTube auto-generates, but custom SRT improves accuracy and SEO

### TikTok

| Parameter | Specification |
|---|---|
| Aspect Ratio | 9:16 (vertical) |
| Resolution | 1080x1920 |
| Frame Rate | 30 fps |
| Video Codec | H.264 |
| Audio Codec | AAC |
| Container | MP4 |
| Max File Size | 10 GB (from app), 287.6 MB (web upload) |
| Max Duration | 10 minutes (but optimal: 15-60 seconds) |
| Bitrate | 6-10 Mbps |

**TikTok-Specific Considerations:**
- First 1-3 seconds determine whether the viewer stays or swipes
- Text must avoid bottom 20% (username, caption) and right 15% (action buttons)
- Sound-on by default — audio is critical for engagement
- Loopable content performs better (seamless end-to-start transitions)
- Trending sounds boost discoverability (but may not suit all content)

### Instagram Reels

| Parameter | Specification |
|---|---|
| Aspect Ratio | 9:16 (vertical) |
| Resolution | 1080x1920 |
| Frame Rate | 30 fps |
| Video Codec | H.264 |
| Audio Codec | AAC |
| Container | MP4 |
| Max File Size | 4 GB |
| Max Duration | 90 seconds |
| Bitrate | 5-8 Mbps |

**Reels-Specific Considerations:**
- Cover frame selection matters for grid appearance (center-crop to 4:5 for feed)
- Text safe zone more restrictive than TikTok — bottom 25%, right 15%
- Instagram compresses video aggressively — upload at higher quality than needed
- Hashtags in caption (not on-screen) for discoverability
- Preview in feed shows 4:5 crop of the 9:16 video — important content must be in the center

### YouTube Shorts

| Parameter | Specification |
|---|---|
| Aspect Ratio | 9:16 (vertical) |
| Resolution | 1080x1920 |
| Frame Rate | 30 fps |
| Video Codec | H.264 |
| Audio Codec | AAC |
| Container | MP4 |
| Max Duration | 60 seconds |
| Bitrate | 6-10 Mbps |

**Shorts-Specific Considerations:**
- Must include #Shorts in title or description for algorithm recognition
- Subscribe button overlays bottom center — avoid text there
- Looping is default behavior — design for seamless loops if possible
- Comment section takes bottom 30% when expanded
- Channel icon appears bottom-left — avoid placing key content there

---

## 2. Aspect Ratio Adaptation

### Landscape (16:9) to Portrait (9:16) Conversion

When repurposing landscape content for vertical platforms:

**Strategy 1: Center Crop**
```
Original 16:9:
┌─────────────────────────────────────────────┐
│ [cropped] │    Visible Area     │ [cropped] │
│           │ ┌─────────────────┐ │           │
│           │ │                 │ │           │
│           │ │   Speaker or    │ │           │
│           │ │   main content  │ │           │
│           │ │                 │ │           │
│           │ └─────────────────┘ │           │
└─────────────────────────────────────────────┘
```
- Simple but loses side content
- Works when speaker/content is centered
- Loses approximately 44% of frame width

**Strategy 2: Reframe with Speaker Focus**
```
Portrait 9:16:
┌─────────────────┐
│                 │
│    [Speaker     │  ← Dynamically tracked
│     cropped     │     and reframed
│     from 16:9]  │
│                 │
│   ───────────   │
│   Text overlay  │  ← Can add text below
│   with context  │     that wasn't in
│                 │     the original
└─────────────────┘
```
- Tracks the speaker's position in the 16:9 frame
- Dynamically repositions the crop to follow the speaker
- Best quality, but requires per-frame or per-section crop positioning

**Strategy 3: Stack Layout**
```
Portrait 9:16:
┌─────────────────┐
│                 │
│  ┌───────────┐  │
│  │ Full 16:9 │  │  ← Original video scaled to fit width
│  │  content   │  │
│  └───────────┘  │
│                 │
│  Title or       │  ← Additional context
│  captions or    │     below the video
│  comments       │
│                 │
└─────────────────┘
```
- Preserves full 16:9 frame (smaller)
- Uses remaining vertical space for text, captions, reactions
- Popular for reaction content, commentary

**Strategy 4: Split Stack**
```
Portrait 9:16:
┌─────────────────┐
│  ┌───────────┐  │
│  │  Speaker   │  │  ← Cropped close-up
│  │  close-up  │  │
│  └───────────┘  │
│  ┌───────────┐  │
│  │  Content   │  │  ← Cropped content area
│  │  (screen,  │  │
│  │  slides)   │  │
│  └───────────┘  │
└─────────────────┘
```
- Splits the 16:9 frame into two vertical panels
- Top: speaker face (cropped), Bottom: screen content (cropped)
- Best for screen-share content with picture-in-picture

### Choosing an Adaptation Strategy

| Content Type | Best Strategy | Rationale |
|---|---|---|
| Talking head (centered) | Center Crop | Speaker is naturally centered |
| Talking head (off-center) | Reframe | Need to track speaker position |
| Screen share | Split Stack | Both speaker and screen visible |
| Presentation | Stack Layout | Preserve slide content, add captions |
| Interview (2 people) | Center Crop or Reframe | Alternate between speakers |
| B-roll heavy | Reframe | Follow the visual interest |

---

## 3. Hook Optimization

### The First 3 Seconds

On algorithmic platforms (TikTok, Reels, Shorts), the first 3 seconds determine whether the viewer watches or swipes. YouTube has a slightly more forgiving 8-10 second window.

### Hook Techniques by Platform

**TikTok/Reels/Shorts (3-second hook):**

| Technique | Implementation | Example |
|---|---|---|
| Bold text hook | Full-screen text overlay, 2s, bold | "This ONE thing 10x'd my productivity" |
| Visual shock | Unexpected or striking visual | Before/after comparison, dramatic transformation |
| Pattern interrupt | Something that breaks scrolling hypnosis | Direct eye contact + addressing viewer, unexpected sound |
| Question | Text or spoken question that demands an answer | "Why do 90% of startups fail?" |
| Promise | Clear value proposition for watching | "By the end of this video you'll know..." |
| Controversy | Polarizing statement (use carefully) | "React is actually terrible and here's why" |

**YouTube (8-10 second hook):**

| Technique | Implementation | Example |
|---|---|---|
| Cold open | Start with the most compelling moment, then rewind | [climactic moment] → "Let me back up..." |
| Problem statement | Name the viewer's pain point immediately | "You're losing 3 hours a day to this mistake" |
| Credibility + promise | Brief credentials + what they'll learn | "After 10 years of X, here's what I wish I knew" |
| Preview montage | Quick clips of what's coming | 3-5 one-second clips from the video's best moments |
| Story open | Begin mid-story, create curiosity | "I was sitting in the meeting when my boss said..." |

### Hook Metrics

A successful hook achieves:
- **Scroll-stop** (TikTok/Reels): > 50% of impressions result in 3+ second views
- **Retention** (YouTube): > 70% retention at the 30-second mark
- **Curiosity gap**: Viewer has a question that can only be answered by continuing

### Anti-Patterns (Hook Killers)

- Starting with "Hey guys, welcome back to my channel" (no value, no hook)
- Starting with the logo/intro animation (wasted seconds)
- Starting with context before the hook (save context for after the hook)
- Starting too slow (the viewer won't wait for you to get interesting)
- Clickbait hooks that don't pay off (destroys trust, hurts retention)

---

## 4. Platform-Specific Text Safe Zones

### YouTube (16:9)

```
┌─────────────────────────────────────────────┐
│ ⚠️ Top: Channel watermark (top-right)       │
│                                             │
│                                             │
│         ✅ SAFE ZONE FOR TEXT               │
│         (center 70% of frame)               │
│                                             │
│                                             │
│ ⚠️ Bottom: Captions, progress bar           │
│ ⚠️ Right: Cards overlay area                │
└─────────────────────────────────────────────┘

Margins:
  Top:    10% (channel watermark area)
  Bottom: 12% (captions + progress bar)
  Left:   10% (standard safe)
  Right:  12% (cards overlay)
```

### TikTok (9:16)

```
┌─────────────────┐
│ ⚠️ Status bar    │ ← Top 8%
│                 │
│                 │
│ ✅ SAFE ZONE    │ ← Center 55%
│ (center of      │
│  frame)         │
│                 │ ⚠️ Action    ← Right 15%
│                 │    buttons
│                 │
│ ⚠️ Username     │ ← Bottom 20%
│ ⚠️ Caption      │
│ ⚠️ Sound bar    │
└─────────────────┘

Margins:
  Top:    8%
  Bottom: 20%
  Left:   5%
  Right:  15%
```

### Instagram Reels (9:16)

```
┌─────────────────┐
│ ⚠️ Header       │ ← Top 10%
│                 │
│                 │
│ ✅ SAFE ZONE    │ ← Center 50%
│                 │
│                 │ ⚠️ Icons     ← Right 15%
│                 │
│ ⚠️ Username     │ ← Bottom 25%
│ ⚠️ Caption      │    (more chrome
│ ⚠️ CTA buttons  │     than TikTok)
└─────────────────┘

Margins:
  Top:    10%
  Bottom: 25%
  Left:   5%
  Right:  15%
```

### YouTube Shorts (9:16)

```
┌─────────────────┐
│ ⚠️ Status       │ ← Top 8%
│                 │
│ ✅ SAFE ZONE    │ ← Center 50%
│                 │
│                 │ ⚠️ Actions   ← Right 12%
│                 │
│ ⚠️ Channel icon │ ← Bottom 28%
│ ⚠️ Subscribe    │    (heaviest
│ ⚠️ Title        │     chrome of
│ ⚠️ Music        │     all platforms)
└─────────────────┘

Margins:
  Top:    8%
  Bottom: 28%
  Left:   5%
  Right:  12%
```

### Universal Safe Zone (all portrait platforms)

If you want one safe zone that works on all vertical platforms:
```
Top:    10%  (192px at 1920h)
Bottom: 28%  (538px at 1920h)
Left:   5%   (54px at 1080w)
Right:  15%  (162px at 1080w)

Usable area: 864 x 1190 px (center of 1080x1920)
```

This is conservative but guarantees text visibility on every platform.

---

## 5. Platform-Specific Content Strategy

### YouTube Optimization

**Video structure:**
1. Hook (0-10s): Grab attention, state the value proposition
2. Intro (10-20s): Brief self-introduction, outline what's coming
3. Body (main content): Deliver on the promise, use chapters
4. CTA mid-roll: At 60-70% through, ask for like/subscribe (when value is proven)
5. End screen (last 20s): Point to related videos, subscribe prompt

**SEO elements:**
- Title: Include primary keyword, keep under 60 characters
- Description: First 2 lines visible above fold — make them count
- Tags: 5-10 relevant tags including long-tail keywords
- Chapters: Timestamp every major section in description
- Cards: Link to related content at relevant moments

**Retention optimization:**
- Re-engage every 2-3 minutes with a new hook/preview
- Use pattern interrupts (visual changes, B-roll, graphics) every 15-25s
- Front-load value — don't save the best for last
- Tease upcoming content ("In a moment, I'll show you...")

### TikTok Optimization

**Video structure:**
1. Hook (0-3s): Bold text or visual, stop the scroll
2. Content (3-50s): Deliver value quickly, no padding
3. Payoff (last 5-10s): Satisfy the hook's promise
4. Loop setup (last 1-2s): End connects to beginning for replay

**Algorithm signals:**
- Completion rate is king — shorter videos that get watched fully > long videos with dropoff
- Saves and shares weight more than likes
- Comments boost reach — ask questions, make statements people want to respond to
- Use trending sounds when relevant (but don't force it)
- Post during audience active hours

**Content format:**
- Text on screen reinforces spoken words (many viewers watch sound-off initially)
- Fast pacing — no dead moments, every second must earn its place
- Single topic per video — don't try to cover everything
- Clear, specific titles/hooks — vague doesn't work on TikTok

### Instagram Reels Optimization

**Video structure:**
- Similar to TikTok but can be slightly more polished
- Instagram audience responds to aesthetics — visual quality matters more
- Hashtags in caption (3-5 relevant, not spammy)
- Cover frame appears in grid — design a clean, representative frame

**Algorithm signals:**
- Saves are the strongest signal for Reels
- Sharing to Stories also boosts reach
- Consistency matters — regular posting schedule
- Original audio preferred over repurposed TikTok audio

### YouTube Shorts Optimization

**Video structure:**
- Most similar to TikTok in structure
- Can include end screen elements
- Subscribers from Shorts convert at lower rates — focus on channel awareness
- Include channel branding but keep it subtle

---

## 6. Multi-Platform Export Strategy

### Primary vs. Derivative Exports

**Primary export:** The version you produce first, at full quality, optimized for one platform.
**Derivative exports:** Adapted versions for other platforms.

**Recommended workflow:**
```
1. Produce the YouTube (16:9) version first → Primary export
2. Create TikTok/Reels/Shorts (9:16) adaptation → Derivative export
   - Reframe for vertical
   - Adjust text positions to platform safe zones
   - Shorten if necessary (Reels: 90s max, Shorts: 60s max)
3. Export at platform-specific specs
```

### Export Checklist

For each platform export, verify:

- [ ] Correct aspect ratio and resolution
- [ ] Text within platform safe zones
- [ ] Hook optimized for platform (3s for short-form, 8s for YouTube)
- [ ] Audio optimized (sound-on assumption for TikTok, variable for YouTube)
- [ ] Duration within platform limits
- [ ] File size within upload limits
- [ ] No branded elements from other platforms (no TikTok watermark on Reels)
- [ ] Appropriate bitrate (not over-compressed, not unnecessarily large)
- [ ] Cover frame/thumbnail selected
- [ ] Captions embedded or prepared for upload

---

## 7. Format Quick Reference

| Property | YouTube | TikTok | Reels | Shorts |
|---|---|---|---|---|
| Ratio | 16:9 | 9:16 | 9:16 | 9:16 |
| Resolution | 1920x1080+ | 1080x1920 | 1080x1920 | 1080x1920 |
| Max Duration | 12h | 10m | 90s | 60s |
| Optimal Duration | 8-15m | 15-60s | 15-60s | 15-60s |
| FPS | 30/60 | 30 | 30 | 30 |
| Hook Window | 8-10s | 1-3s | 1-3s | 1-3s |
| Text Safe (bottom) | 12% | 20% | 25% | 28% |
| Text Safe (right) | 12% | 15% | 15% | 12% |
| Audio Priority | Medium | High | High | High |
| Caption Priority | Medium | High | Medium | Medium |
