<example>
# SCENE_PLAN.md

## Global
- **Canvas:** 1080x1920
- **Source video:** 1080x1920
- **Total duration:** 68000ms
- **Total scenes:** 6
- **Theme:** blackboard

---

## Scene 1: Opening Hook — The Failure Rate
**File:** Scene1.tsx
**Time:** 0 – 10000
**Transcript:** "seventy-three percent of people who start a fitness routine quit within the first three months and it's not because they're lazy it's because they're making three critical mistakes"
**Display mode:** Overlay
**Template:** explainer-stats
**Fork reason:** big number count-up (73%) with visual emphasis — adapt thermometer metaphor using stats layout and count-up animation

### Speaker layout
- Speaker: "full size"

### Scene dimensions
- Width: 1000 Height: 960

### Scene placement
- Placement: center-card

### Transition IN
- From: Speaker
- Transition: Speaker → Overlay

### Transition OUT
- To: Stacked (Scene 2)
- Transition: Overlay → Stacked

### Visual concept
A thermometer that rises from empty to the 73% mark, then cracks and leaks — visualizing the dropout rate as something that builds up and breaks.

### Key data
- 73%
- first three months
- three critical mistakes

### Must show
- the number 73%, the phrase "quit within 3 months"

### Animation brief
Large "73%" counter EMERGES BEHIND the speaker from center, scaling up as the speaker begins "seventy-three percent of people." The number is wide enough to PEEK from both sides of the speaker's shoulders. Red fill rises from 0% to 73% while the speaker says "who start a fitness routine quit" — counter ticks up in sync behind the speaker's body. As the speaker says "it's not because they're lazy," the glass cracks at the 73% mark and red tint pulses outward behind the speaker. "73% quit" text slides in IN FRONT of the speaker at the bottom third when the speaker hits "three critical mistakes." The depth contrast — massive stat behind, label in front — creates emphasis. Everything scales down and fades before the cut.

---

## Scene 2: Mistake #1 — No Progressive Overload
**File:** Scene2.tsx
**Time:** 10000 – 24000
**Transcript:** "mistake number one is ignoring progressive overload your body adapts fast if you're doing the same weight the same reps week after week your muscles have zero reason to grow you need to increase weight or reps by just two to five percent every single week"
**Display mode:** Stacked [50/50]
**Template:** explainer-cause-effect
**Fork reason:** plateau vs growth is a cause-effect relationship — adapt two-panel layout for staircase metaphor

### Speaker layout
- Speaker: "bottom 50%"

### Scene dimensions
- Width: 1080 Height: 960

### Scene placement
- Placement: top half

### Transition IN
- From: Overlay (Scene 1)
- Transition: Overlay → Stacked

### Transition OUT
- To: Fullscreen (Scene 3)
- Transition: Stacked → Fullscreen

### Visual concept
A staircase that should be climbing but flatlines — each step represents a week, and when weight stays the same the stairs stop rising and flatten into a plateau. Then the staircase rebuilds with each step slightly taller than the last, showing the 2-5% climb.

### Key data
- Progressive overload
- Same weight, same reps = no growth
- Increase 2-5% per week

### Must show
- "Progressive Overload" as a title, "2-5% per week", the contrast between plateau and growth

### Animation brief
"Mistake #1" badge slides in as the speaker says "mistake number one." Staircase steps build up as the speaker explains "your body adapts fast" — first 4 steps rise normally. When the speaker says "same weight the same reps week after week," steps 5-8 flatten to the same height with a red "PLATEAU" bar. As the speaker shifts to "you need to increase weight," the flatlined steps crumble and new steps rebuild, each 5% taller in an intensifying green gradient. "2-5% / week" text lands when the speaker says "two to five percent every single week." Elements slide out before the cut.

---

## Scene 3: Mistake #2 — Skipping Recovery
**File:** Scene3.tsx
**Time:** 24000 – 38000
**Transcript:** "mistake number two is skipping recovery most people think more gym time equals more results but your muscles don't grow in the gym they grow while you rest if you're training seven days a week you're actually breaking down faster than you can rebuild and that leads to injury burnout and zero progress"
**Display mode:** Fullscreen
**Template:** explainer-comparison
**Fork reason:** two-state battery comparison (overtraining vs recovery) maps to side-by-side comparison columns

### Speaker layout
- Speaker: "opacity: 0"

### Scene dimensions
- Width: 1080 Height: 1920

### Scene placement
- Placement: full canvas

### Transition IN
- From: Stacked (Scene 2)
- Transition: Stacked → Fullscreen

### Transition OUT
- To: Overlay (Scene 4)
- Transition: Fullscreen → Overlay

### Visual concept
A battery that charges and drains — the left side shows a battery icon hammered by 7 gym-day bolts draining it to zero, while the right side shows the same battery with rest days inserted, maintaining its charge level. The battery metaphor makes the invisible process of recovery tangible.

### Key data
- Recovery is when muscles grow
- Training 7 days = breakdown
- Leads to injury, burnout, zero progress

### Must show
- "Recovery" as the title, "7 days/week" on the overtraining side, "injury", "burnout", "zero progress" as outcomes

### Animation brief
Battery scales in as the speaker says "skipping recovery." It splits into two when the speaker contrasts "more gym time equals more results" — left battery starts draining. As "training seven days a week" plays, 7 bolt icons strike the left battery sequentially, each draining the fill (green → yellow → red). Right battery shows the alternative with rest-day moon icons keeping fill above 60%. When the speaker says "injury burnout and zero progress," those three labels cascade below the drained battery. Right battery pulses green; "Recovery = Growth" lands as emphasis. Everything exits before the cut.

---

## Scene 4: Mistake #3 — No Nutrition Plan
**File:** Scene4.tsx
**Time:** 38000 – 50000
**Transcript:** "and mistake number three is having no nutrition plan you can train perfectly but if you're not eating enough protein your body can't repair the research is clear you need point seven to one gram of protein per pound of body weight every single day that's non-negotiable"
**Display mode:** Overlay
**Template:** explainer-stats
**Fork reason:** protein target is a big number (0.7-1.0g/lb) — adapt gauge visual using stats count-up animation

### Speaker layout
- Speaker: "full size"

### Scene dimensions
- Width: 900 Height: 760

### Scene placement
- Placement: overlay-medium

### Transition IN
- From: Fullscreen (Scene 3)
- Transition: Fullscreen → Overlay

### Transition OUT
- To: Stacked (Scene 5)
- Transition: Overlay → Stacked

### Visual concept
A fuel gauge needle swinging from "Empty" to the optimal zone — the gauge represents daily protein intake, and the needle's arc movement shows the minimum-to-target range, making an abstract nutrition number feel like a physical dial you can read.

### Key data
- Protein is required for repair
- 0.7–1.0g per pound of body weight
- Daily requirement

### Must show
- "0.7–1.0g / lb", the word "protein", "daily" or "every day"

### Animation brief
Gauge arc scales in as the speaker says "no nutrition plan." Needle starts rotating as "if you're not eating enough protein" plays — sweeping through "Empty" and "Low" zones with labels fading in at each section. When the speaker says "point seven to one gram," the needle reaches the green optimal zone and bounces with spring physics; zone pulses. "per pound, per day" types in word by word synced to "every single day." Checkmark stamps when the speaker hits "that's non-negotiable." Fade out before cut.

---

## Scene 5: The Fix — Weekly Framework
**File:** Scene5.tsx
**Time:** 50000 – 60000
**Transcript:** "here's what actually works train four days recover three days hit your protein target daily and increase your weights by two to five percent each week do that consistently for twelve weeks and you'll see more results than most people get in a year"
**Display mode:** Stacked [55/45]
**Template:** explainer-timeline
**Fork reason:** 12-week framework is a chronological sequence — adapt timeline nodes for weekly markers

### Speaker layout
- Speaker: "bottom 45%"

### Scene dimensions
- Width: 1080 Height: 1056

### Scene placement
- Placement: top half

### Transition IN
- From: Overlay (Scene 4)
- Transition: Overlay → Stacked

### Transition OUT
- To: Overlay (Scene 6)
- Transition: Stacked → Overlay

### Visual concept
A 12-week calendar ribbon that unrolls horizontally, with each week showing the 4-train/3-rest pattern as colored segments. As weeks progress, a subtle upward curve bends the ribbon — each week sits slightly higher than the last, embodying compounding progress over 12 weeks.

### Key data
- Train 4 days, recover 3 days
- Hit protein daily
- Increase 2-5% per week
- 12 weeks for results

### Must show
- "4 days train / 3 days recover", "protein daily", "2-5%/week", "12 weeks"

### Animation brief
Timeline bar starts growing as the speaker says "here's what actually works." When "train four days recover three days" plays, week blocks unroll showing 4 blue + 3 green segments. As "hit your protein target daily" plays, protein icons appear above each week. During "increase your weights by two to five percent," "+2-5%" arrows appear beside each week, growing slightly larger each time — the timeline curves upward. "12 Weeks" text scales in when the speaker says "twelve weeks." Results badge appears at the peak on "more results than most people get in a year." Ribbon rolls back at exit.

---

## Scene 6: Closing — Commit Today
**File:** Scene6.tsx
**Time:** 60000 – 68000
**Transcript:** "so stop making these three mistakes start with progressive overload prioritize recovery fix your nutrition and I promise you the results will come faster than you ever expected"
**Display mode:** Overlay
**Template:** none
**Fork reason:** —

### Speaker layout
- Speaker: "full size"

### Scene dimensions
- Width: 900 Height: 760

### Scene placement
- Placement: overlay-medium

### Transition IN
- From: Stacked (Scene 5)
- Transition: Stacked → Overlay

### Transition OUT
- To: Speaker
- Transition: Overlay → Speaker

### Visual concept
Three remedy icons arranged in an organic triangle that lock together like puzzle pieces — each icon represents one fix, and they click into place one by one, forming a unified shape that conveys "complete system" rather than isolated tips.

### Key data
- Progressive overload
- Recovery
- Nutrition

### Must show
- "1. Progressive Overload", "2. Recovery", "3. Nutrition"

### Animation brief
As the speaker says "start with progressive overload," first icon + label springs in from bottom-left. "Prioritize recovery" triggers the second icon snapping into position with a magnetic pull. "Fix your nutrition" brings the third icon, completing the triangle — a background shape scales up behind all three, unifying them. When the speaker hits "the results will come," the unified shape pulses and all labels brighten. Icons scale down at exit before "faster than you ever expected."

---

## Punch-in Locations
| Timestamp | Crop | Notes |
|---|---|---|
| 3500ms | { x: 50, y: 40, scale: 1.3 } | "seventy-three percent" — emphasis on the shocking statistic during Scene 1 (Overlay) |
| 44000ms | { x: 50, y: 42, scale: 1.25 } | "that's non-negotiable" — conviction beat during Scene 4 (Overlay) |
| 64000ms | { x: 50, y: 38, scale: 1.35 } | "faster than you ever expected" — closing promise during Scene 6 (Overlay) |

---

## Self-verification

- [x] Every moment of the timeline is covered (no speaker-only gaps): 0–10000 (Scene 1 Overlay) → 10000–24000 (Scene 2 Stacked) → 24000–38000 (Scene 3 Fullscreen) → 38000–50000 (Scene 4 Overlay) → 50000–60000 (Scene 5 Stacked) → 60000–68000 (Scene 6 Overlay). Complete coverage.
- [x] All transitions use names from the 15-transition set: Speaker → Overlay, Overlay → Stacked, Stacked → Fullscreen, Fullscreen → Overlay, Overlay → Stacked, Stacked → Overlay, Overlay → Speaker.
- [x] All display modes are Overlay, Stacked, or Fullscreen (no "split-screen"): Overlay, Stacked, Fullscreen, Overlay, Stacked, Overlay.
- [x] Transcript segments are copied verbatim — no paraphrasing.
- [x] Punch-ins only appear during overlay segments: 3500ms (Scene 1 Overlay), 44000ms (Scene 4 Overlay), 64000ms (Scene 6 Overlay).
- [x] Speaker transitions only at video boundaries: Speaker → Overlay at start (Scene 1), Overlay → Speaker at end (Scene 6).
- [x] Every field in the per-scene schema is present for every scene.
- [x] Every scene has a **File** field (Scene{N}.tsx format): Scene1.tsx through Scene6.tsx.
- [x] Every scene has **Scene dimensions** (Width × Height in pixels): Overlays use preset sizes (1000×960, 900×760, 800×640), Stacked scenes use canvas calculations, Fullscreen uses 1080×1920.
- [x] Every Overlay scene uses a placement preset name from the preset table: center-card (Scene 1), overlay-medium (Scene 4), overlay-medium (Scene 6).
- [x] Stacked dimensions calculated correctly: Scene 2: 1080 × (1920 × 50%) = 1080 × 960. Scene 5: 1080 × (1920 × 55%) = 1080 × 1056.
- [x] Every scene has an **Animation brief** describing entrance, mid-scene evolution, visual climax, and exit.
- [x] No brief is just "elements enter and exit" — every scene has mid-scene change: thermometer cracks (1), staircase crumbles and rebuilds (2), battery drains vs charges (3), gauge needle travels zones (4), ribbon curves upward (5), puzzle pieces snap together (6).
- [x] Every **Visual concept** includes a metaphor/anchor, a primary motion, and an emotional beat: thermometer rising + cracking (Scene 1), staircase building + flatlining + rebuilding (Scene 2), battery splitting + draining vs charging (Scene 3), gauge needle swinging (Scene 4), ribbon unrolling + curving upward (Scene 5), puzzle pieces clicking together (Scene 6).
- [x] **No two adjacent scenes use the same primary motion**: gauge fill → progressive build → split comparison → gauge fill → progressive unroll → assembly. Scene 1 and 4 both use gauge/fill but are separated by 2 scenes.
- [x] **Visual concepts are genuinely distinct**: each scene has a unique physical metaphor (thermometer, staircase, battery, gauge, ribbon, puzzle).
- [x] Every scene has a **Template** field: explainer-stats, explainer-cause-effect, explainer-comparison, explainer-stats, explainer-timeline, none (5 of 6 scenes use templates).
- [x] At least 50% of scenes use templates: 5/6 = 83%.
</example>
