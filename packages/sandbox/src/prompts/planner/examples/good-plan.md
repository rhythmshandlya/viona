<example>
# SCENE_PLAN.md

## Global
- **Canvas:** 1080x1920
- **Source video:** 1080x1920
- **Total duration:** 62000ms
- **Total scenes:** 6

---

## Scene 1: Opening Hook — Communication Matters
**File:** Scene1.tsx
**Time:** 0 – 8500
**Transcript:** "most people think they're good communicators but studies show that sixty-five percent of workplace conflicts come from miscommunication"
**Display mode:** Overlay
**Scene type:** data-viz
**Layout pattern:** center-dominant

### Speaker layout
- Speaker: "full size"

### Scene dimensions
- Width: 800 Height: 480

### Scene placement
- Placement: lower-third-center

### Transition IN
- From: Speaker
- Transition: Speaker → Overlay

### Transition OUT
- To: Overlay (Scene 2)
- Transition: Overlay → Overlay

### Animation brief
- Description: Glass card appears at lower third with spring scale-in from 0.9 to 1.0. Inside the card, a large counter animates from 0 to 65, followed by a percent sign that fades in. Below the number, the text "workplace conflicts from miscommunication" types in word by word, synced to the speaker. A thin progress ring around the number fills clockwise as the counter increments. Card has a subtle violet glow border matching the studio theme.
- Key data: ["65%", "workplace conflicts", "miscommunication"]
- Must show: the number 65%, the phrase "workplace conflicts from miscommunication"

---

## Scene 2: Introduction — Three Steps Preview
**File:** Scene2.tsx
**Time:** 8500 – 16000
**Transcript:** "today I'm going to share three steps that completely changed how I communicate and they'll work for you too whether it's at work with friends or even with your family"
**Display mode:** Overlay
**Scene type:** custom
**Layout pattern:** asymmetric

### Speaker layout
- Speaker: "full size"

### Scene dimensions
- Width: 800 Height: 640

### Scene placement
- Placement: center-card

### Transition IN
- From: Overlay (Scene 1)
- Transition: Overlay → Overlay

### Transition OUT
- To: Stacked (Scene 3)
- Transition: Overlay → Stacked

### Animation brief
- Description: Three numbered circles (1, 2, 3) stagger in from the right edge with spring physics, 8 frames apart. Each circle is a frosted glass disc with the number inside in bold. They arrange vertically, slightly overlapping. After all three land, a subtle connecting line draws between them top-to-bottom with a violet glow pulse that travels down the line. The circles pulse gently in a breathing loop until the scene exits.
- Key data: ["three steps", "at work", "with friends", "with your family"]
- Must show: three distinct numbered circles representing the three steps

---

## Scene 3: Step 1 — Active Listening
**File:** Scene3.tsx
**Time:** 16000 – 29000
**Transcript:** "step one is active listening and I don't just mean nodding your head I mean actually pausing before you respond repeating back what you heard and asking clarifying questions these three things alone will transform how people perceive you"
**Display mode:** Stacked [50/50]
**Scene type:** step-cards
**Layout pattern:** diagonal-flow

### Speaker layout
- Speaker: "bottom 50%"

### Scene dimensions
- Width: 1080 Height: 960

### Scene placement
- Placement: top half

### Transition IN
- From: Overlay (Scene 2)
- Transition: Overlay → Stacked

### Transition OUT
- To: Stacked (Scene 4)
- Transition: Stacked → Stacked

### Animation brief
- Description: Title card "Active Listening" slides in from top with spring easing and settles at the top-left. Three action cards appear along a diagonal from top-left to bottom-right, staggered 10 frames apart. Card 1: "Pause before responding" with a pause icon. Card 2: "Repeat back what you heard" with a speech bubble icon. Card 3: "Ask clarifying questions" with a question mark icon. Each card is a frosted glass rectangle with an icon on the left and text on the right. After all three are visible, a checkmark stamps onto each card sequentially (6 frames apart) with a satisfying scale-bounce. A subtle number "1" badge sits in the top-right corner throughout.
- Key data: ["Active listening", "Pause before responding", "Repeat back what you heard", "Ask clarifying questions"]
- Must show: the title "Active Listening", all three sub-points with exact wording from the transcript, the number 1

---

## Scene 4: Step 2 — Emotional Awareness
**File:** Scene4.tsx
**Time:** 29000 – 42000
**Transcript:** "step two is emotional awareness before any important conversation check in with yourself ask am I frustrated am I anxious am I defensive because if you go in with unresolved emotions they leak into your tone your body language everything"
**Display mode:** Stacked [50/50]
**Scene type:** comparison
**Layout pattern:** stacked-cascade

### Speaker layout
- Speaker: "bottom 50%"

### Scene dimensions
- Width: 1080 Height: 960

### Scene placement
- Placement: top half

### Transition IN
- From: Stacked (Scene 3)
- Transition: Stacked → Stacked

### Transition OUT
- To: Fullscreen (Scene 5)
- Transition: Stacked → Fullscreen

### Animation brief
- Description: Title "Emotional Awareness" fades in at the top with a number "2" badge. Three emotional state cards cascade front-to-back with increasing blur/opacity: front card "Frustrated" with a flame icon (fully opaque), middle card "Anxious" with a wave icon (slightly recessed), back card "Defensive" with a shield icon (most recessed). The cascade creates a depth illusion. After the three emotions appear, an arrow animates from the card stack pointing right toward a results panel showing three leak targets: "Tone", "Body language", "Everything" — each appearing with a subtle red glow to indicate negative impact. The arrow pulses with a gradient that shifts from orange to red.
- Key data: ["Emotional awareness", "Frustrated", "Anxious", "Defensive", "Tone", "Body language", "Everything"]
- Must show: the title "Emotional Awareness", all three emotions (frustrated, anxious, defensive), the three leak targets (tone, body language, everything), the number 2

---

## Scene 5: Step 3 — Clear Structure
**File:** Scene5.tsx
**Time:** 42000 – 55000
**Transcript:** "and step three is structure your message before you speak think about what is my main point what are my supporting reasons and what do I want the other person to do this simple framework will make you ten times more persuasive I guarantee it"
**Display mode:** Fullscreen
**Scene type:** flowchart
**Layout pattern:** full-bleed

### Speaker layout
- Speaker: "opacity: 0"

### Scene dimensions
- Width: 1080 Height: 1920

### Scene placement
- Placement: full canvas

### Transition IN
- From: Stacked (Scene 4)
- Transition: Stacked → Fullscreen

### Transition OUT
- To: Overlay (Scene 6)
- Transition: Fullscreen → Overlay

### Animation brief
- Description: Dark background with a vertical flowchart that fills the canvas. Title "Structure Your Message" at the top with a number "3" badge. Three large frosted glass nodes connected by animated downward arrows. Node 1: "Main Point" with a target icon — enters from top with spring physics. Arrow draws downward (8 frames). Node 2: "Supporting Reasons" with a list icon — enters with spring. Arrow draws downward (8 frames). Node 3: "Desired Action" with a checkmark icon — enters with spring. After all three nodes are visible, a glowing "10x more persuasive" badge scales in at the bottom with a bounce animation and a starburst particle effect behind it. The connecting arrows pulse with a violet gradient that flows top-to-bottom in a loop.
- Key data: ["Structure your message", "Main point", "Supporting reasons", "Desired action", "10x more persuasive"]
- Must show: the title "Structure Your Message", all three framework elements (main point, supporting reasons, desired action), the "10x" claim, the number 3

---

## Scene 6: Closing Recap
**File:** Scene6.tsx
**Time:** 55000 – 62000
**Transcript:** "so remember active listening emotional awareness and clear structure master these three and you'll never struggle with communication again"
**Display mode:** Overlay
**Scene type:** step-cards
**Layout pattern:** scattered

### Speaker layout
- Speaker: "full size"

### Scene dimensions
- Width: 800 Height: 480

### Scene placement
- Placement: lower-third-center

### Transition IN
- From: Fullscreen (Scene 5)
- Transition: Fullscreen → Overlay

### Transition OUT
- To: Speaker
- Transition: Overlay → Speaker

### Animation brief
- Description: Three compact glass pills appear in a scattered arrangement at the lower third, slightly rotated for organic feel. Pill 1: "1. Active Listening" enters from bottom-left with spring. Pill 2: "2. Emotional Awareness" enters from bottom-center with spring (6 frame delay). Pill 3: "3. Clear Structure" enters from bottom-right with spring (6 frame delay). After all three are visible, a golden checkmark stamps over each pill sequentially (4 frames apart). The pills then gently float in place with a breathing animation. On exit, all three pills scale down and fade out simultaneously.
- Key data: ["Active listening", "Emotional awareness", "Clear structure"]
- Must show: all three steps with their numbers, exact names from transcript

---

## Punch-in Locations
| Timestamp | Crop | Notes |
|---|---|---|
| 5200ms | { x: 50, y: 40, scale: 1.3 } | "sixty-five percent" — emphasis on the statistic during Scene 1 (Overlay) |
| 12500ms | { x: 50, y: 42, scale: 1.25 } | "they'll work for you too" — personal connection during Scene 2 (Overlay) |
| 58000ms | { x: 50, y: 38, scale: 1.35 } | "you'll never struggle with communication again" — closing conviction during Scene 6 (Overlay) |

---

## Self-verification

- [x] Every moment of the timeline is covered (no speaker-only gaps): 0–8500 (Scene 1 Overlay) → 8500–16000 (Scene 2 Overlay) → 16000–29000 (Scene 3 Stacked) → 29000–42000 (Scene 4 Stacked) → 42000–55000 (Scene 5 Fullscreen) → 55000–62000 (Scene 6 Overlay). Complete coverage.
- [x] All transitions use names from the 15-transition set: Speaker → Overlay, Overlay → Overlay, Overlay → Stacked, Stacked → Stacked, Stacked → Fullscreen, Fullscreen → Overlay, Overlay → Speaker.
- [x] No two adjacent scenes use the same layout pattern: center-dominant → asymmetric → diagonal-flow → stacked-cascade → full-bleed → scattered.
- [x] All scene types are from the 10-type table: data-viz, custom, step-cards, comparison, flowchart, step-cards.
- [x] All display modes are Overlay, Stacked, or Fullscreen (no "split-screen"): Overlay, Overlay, Stacked, Stacked, Fullscreen, Overlay.
- [x] Transcript segments are copied verbatim — no paraphrasing.
- [x] Punch-ins only appear during overlay segments: 5200ms (Scene 1 Overlay), 12500ms (Scene 2 Overlay), 58000ms (Scene 6 Overlay).
- [x] Speaker transitions only at video boundaries: Speaker → Overlay at start (Scene 1), Overlay → Speaker at end (Scene 6).
- [x] Every field in the per-scene schema is present for every scene.
- [x] Every scene has a **File** field (Scene{N}.tsx format): Scene1.tsx through Scene6.tsx.
- [x] Every scene has **Scene dimensions** (Width × Height in pixels): Overlays use preset sizes, Stacked scenes 1080×960, Fullscreen 1080×1920.
- [x] Every Overlay scene uses a placement preset name from the preset table: lower-third-center, center-card, lower-third-center.
- [x] Stacked dimensions calculated correctly: 1080 × (1920 × 50%) = 1080 × 960.
</example>
