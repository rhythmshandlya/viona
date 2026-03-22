<example>
# SCENE_PLAN.md

## Global
- **Canvas:** 1080x1920
- **Source video:** 1080x1920
- **Total duration:** 68000ms
- **Total scenes:** 6

---

## Scene 1: Opening Hook — The Failure Rate
**File:** Scene1.tsx
**Time:** 0 – 10000
**Transcript:** "seventy-three percent of people who start a fitness routine quit within the first three months and it's not because they're lazy it's because they're making three critical mistakes"
**Display mode:** Overlay
**Scene type:** data-viz
**Layout pattern:** center-dominant

### Speaker layout
- Speaker: "full size"

### Scene dimensions
- Width: 800 Height: 640

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

### Animation timeline
| Phase | Frames | What happens |
|-------|--------|-------------|
| Entrance | 0–30 | Thermometer outline draws itself with strokeDashoffset from bottom to top, opacity fading in |
| Build | 30–120 | Red fill rises inside the thermometer from 0% to 73%, counter ticks up in sync; tick marks appear at 25/50/75 |
| Develop | 120–200 | At 73% the glass cracks — jagged SVG path animates across the bulb, red tint pulses outward as a radial gradient shift |
| Payoff | 200–260 | "73% quit" text scales in with spring beside the thermometer; the "3 months" label fades in below |
| Exit | 260–300 | Entire composition scales down to 0.9 and fades to opacity 0 over 300ms |

---

## Scene 2: Mistake #1 — No Progressive Overload
**File:** Scene2.tsx
**Time:** 10000 – 24000
**Transcript:** "mistake number one is ignoring progressive overload your body adapts fast if you're doing the same weight the same reps week after week your muscles have zero reason to grow you need to increase weight or reps by just two to five percent every single week"
**Display mode:** Stacked [50/50]
**Scene type:** cause-effect
**Layout pattern:** diagonal-flow

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

### Animation timeline
| Phase | Frames | What happens |
|-------|--------|-------------|
| Entrance | 0–50 | "Mistake #1" badge slides in from left; staircase outline begins drawing step-by-step along diagonal axis using strokeDashoffset |
| Build | 50–180 | First 4 steps rise normally, then steps 5-8 flatten to the same height — a red "PLATEAU" label fades in with a horizontal flatline drawn across the top |
| Develop | 180–320 | Flatlined steps crumble downward (translateY + opacity), then new steps rebuild from the base, each 5% taller than the previous, colored in a green gradient that intensifies per step |
| Payoff | 320–380 | "2-5% / week" text appears at the top of the rising staircase with spring scale; an upward arrow draws itself along the staircase edge |
| Exit | 380–420 | All elements slide out diagonally toward bottom-right with staggered 4-frame delays |

---

## Scene 3: Mistake #2 — Skipping Recovery
**File:** Scene3.tsx
**Time:** 24000 – 38000
**Transcript:** "mistake number two is skipping recovery most people think more gym time equals more results but your muscles don't grow in the gym they grow while you rest if you're training seven days a week you're actually breaking down faster than you can rebuild and that leads to injury burnout and zero progress"
**Display mode:** Fullscreen
**Scene type:** comparison
**Layout pattern:** asymmetric

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

### Animation timeline
| Phase | Frames | What happens |
|-------|--------|-------------|
| Entrance | 0–45 | "Mistake #2" badge fades in top-left; a large battery outline draws itself center-screen using strokeDashoffset |
| Build | 45–200 | Battery splits into two copies that slide apart (translateX ±200px). Left battery: 7 bolt icons strike it sequentially, each draining the fill level lower via clip-path reveal. Charge bar color shifts from green → yellow → red |
| Develop | 200–340 | Right battery: 5 bolts strike but 2 rest-day moon icons insert between them, and the fill level stays above 60%. Left battery hits 0% — cracks appear (SVG path draw). Three consequence labels ("Injury", "Burnout", "Zero Progress") cascade downward below the left battery with staggered fade-in |
| Payoff | 340–390 | Right battery pulses with a green glow; "Recovery = Growth" text scales in with spring between the two batteries |
| Exit | 390–420 | Both batteries and all labels scale to 0 from their centers with easeIn timing |

---

## Scene 4: Mistake #3 — No Nutrition Plan
**File:** Scene4.tsx
**Time:** 38000 – 50000
**Transcript:** "and mistake number three is having no nutrition plan you can train perfectly but if you're not eating enough protein your body can't repair the research is clear you need point seven to one gram of protein per pound of body weight every single day that's non-negotiable"
**Display mode:** Overlay
**Scene type:** data-viz
**Layout pattern:** stacked-cascade

### Speaker layout
- Speaker: "full size"

### Scene dimensions
- Width: 800 Height: 480

### Scene placement
- Placement: lower-third-center

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

### Animation timeline
| Phase | Frames | What happens |
|-------|--------|-------------|
| Entrance | 0–30 | Gauge arc draws itself with strokeDashoffset; "Mistake #3" label fades in above the gauge |
| Build | 30–130 | Needle rotates from far-left "Empty" zone through yellow "Low" zone; zone labels fade in as the needle passes each section; the arc fills with color behind the needle path |
| Develop | 130–220 | Needle reaches the green "0.7–1.0g/lb" optimal zone and bounces with spring physics; the optimal zone pulses with a glow; "per pound, per day" text types in below the gauge word by word |
| Payoff | 220–270 | A checkmark stamps onto the optimal zone with scale-bounce; "Non-negotiable" text fades in with slight translateY upward |
| Exit | 270–300 | Gauge and all labels fade out with opacity transition over 300ms |

---

## Scene 5: The Fix — Weekly Framework
**File:** Scene5.tsx
**Time:** 50000 – 60000
**Transcript:** "here's what actually works train four days recover three days hit your protein target daily and increase your weights by two to five percent each week do that consistently for twelve weeks and you'll see more results than most people get in a year"
**Display mode:** Stacked [55/45]
**Scene type:** timeline
**Layout pattern:** full-bleed

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

### Animation timeline
| Phase | Frames | What happens |
|-------|--------|-------------|
| Entrance | 0–40 | A horizontal timeline axis draws from left to right with strokeDashoffset; "Week 1" marker fades in at the left edge |
| Build | 40–140 | Week blocks unroll along the timeline — each block shows 4 blue segments and 3 green segments staggering in; weeks 1-6 appear with 12-frame intervals between each week; the timeline curves gently upward via translateY |
| Develop | 140–230 | Weeks 7-12 continue unrolling, each sitting higher on the curve; a protein icon repeats above each week with fade-in; a small "+2-5%" arrow appears beside each new week, slightly larger than the previous one |
| Payoff | 230–270 | "12 Weeks" text scales in at the end of the ribbon with spring; a results badge appears at the peak of the curve with scale-bounce showing "More than most get in a year" |
| Exit | 270–300 | Ribbon rolls back up from right to left with translateX and opacity fade |

---

## Scene 6: Closing — Commit Today
**File:** Scene6.tsx
**Time:** 60000 – 68000
**Transcript:** "so stop making these three mistakes start with progressive overload prioritize recovery fix your nutrition and I promise you the results will come faster than you ever expected"
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

### Animation timeline
| Phase | Frames | What happens |
|-------|--------|-------------|
| Entrance | 0–30 | First icon + label ("1. Progressive Overload") springs in from bottom-left with rotation from -15° to 0° |
| Build | 30–100 | Second icon + label ("2. Recovery") springs in from bottom-center, 20 frames after the first; it slides into position adjacent to icon 1 with a magnetic snap (spring with damping) |
| Develop | 100–170 | Third icon + label ("3. Nutrition") springs in from bottom-right and snaps into place completing the triangle; a connecting border draws around all three using strokeDashoffset, unifying them |
| Payoff | 170–210 | The unified triangle shape pulses once with a scale 1.0→1.05→1.0 spring; all three labels brighten simultaneously with an opacity shift from 0.8 to 1.0 |
| Exit | 210–240 | All three icons scale down to 0 from the triangle's center point with staggered 4-frame delays |

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
- [x] No two adjacent scenes use the same layout pattern: center-dominant → diagonal-flow → asymmetric → stacked-cascade → full-bleed → scattered.
- [x] All scene types are from the 10-type table: data-viz, cause-effect, comparison, data-viz, timeline, step-cards.
- [x] All display modes are Overlay, Stacked, or Fullscreen (no "split-screen"): Overlay, Stacked, Fullscreen, Overlay, Stacked, Overlay.
- [x] Transcript segments are copied verbatim — no paraphrasing.
- [x] Punch-ins only appear during overlay segments: 3500ms (Scene 1 Overlay), 44000ms (Scene 4 Overlay), 64000ms (Scene 6 Overlay).
- [x] Speaker transitions only at video boundaries: Speaker → Overlay at start (Scene 1), Overlay → Speaker at end (Scene 6).
- [x] Every field in the per-scene schema is present for every scene.
- [x] Every scene has a **File** field (Scene{N}.tsx format): Scene1.tsx through Scene6.tsx.
- [x] Every scene has **Scene dimensions** (Width × Height in pixels): Overlays use preset sizes (800×640, 800×480), Stacked scenes use canvas calculations, Fullscreen uses 1080×1920.
- [x] Every Overlay scene uses a placement preset name from the preset table: center-card (Scene 1), lower-third-center (Scene 4), lower-third-center (Scene 6).
- [x] Stacked dimensions calculated correctly: Scene 2: 1080 × (1920 × 50%) = 1080 × 960. Scene 5: 1080 × (1920 × 55%) = 1080 × 1056.
- [x] **No more than 30% of scenes use `step-cards`**: 1 out of 6 scenes (16.7%) uses step-cards.
- [x] **At least 3 different scene types** are used across the plan: data-viz, cause-effect, comparison, timeline, step-cards (5 distinct types).
- [x] **No two adjacent scenes share the same scene type**: data-viz → cause-effect → comparison → data-viz → timeline → step-cards.
- [x] Every scene has an **Animation timeline** table with 3-5 phases: all 6 scenes have 5-phase tables (Entrance, Build, Develop, Payoff, Exit).
- [x] Every scene has a **Build** and **Develop** phase (not just Entrance + Exit): confirmed for all 6 scenes.
- [x] No single phase spans more than 40% of the scene's total frame count: verified — Build and Develop each span approximately 30-35%, no phase exceeds 40%.
- [x] Every **Visual concept** describes a creative idea, not a layout: thermometer cracking (Scene 1), staircase plateau vs growth (Scene 2), battery charge/drain (Scene 3), fuel gauge needle (Scene 4), unrolling calendar ribbon (Scene 5), puzzle pieces locking together (Scene 6).
</example>
