# Narrative Structure Skill

## Purpose
Detect and enhance the narrative structure within video content. This skill identifies story arcs, emotional beats, pacing patterns, and continuity elements to create cohesive, engaging edits.

---

## 1. Story Arc Detection

Every effective video follows a narrative arc, even non-fiction content. Identify which arc pattern the content follows, then optimize the edit to reinforce it.

### The Five-Beat Arc

Most video content maps to this universal structure:

```
HOOK → TENSION → INSIGHT → PAYOFF → CLOSE
  |        |         |        |        |
 0-10%   10-40%   40-60%   60-85%   85-100%
```

**Beat 1: HOOK (0-10% of runtime)**
- Purpose: Capture attention, create curiosity
- Signals: Opening question, surprising statement, preview of payoff, cold open
- Treatment: High visual density (animation, bold text-overlay)
- Detection: First 10-15 seconds of transcript — look for rhetorical questions, superlatives, "imagine", "what if"
- If missing: Create a hook by pulling the most compelling quote/stat from later in the video and placing it first

**Beat 2: TENSION (10-40% of runtime)**
- Purpose: Establish the problem, create stakes, build "why should I care"
- Signals: Problem statements, conflict identification, "the issue is", "what most people don't realize"
- Treatment: Building complexity — start with speaker-only, layer in screenshots/evidence
- Detection: Look for negative framing, problem language, competitor criticism, gap identification
- If weak: Add text-overlays emphasizing stakes ("$2.3M lost per year to this bug")

**Beat 3: INSIGHT (40-60% of runtime)**
- Purpose: The turn — the new idea, framework, or solution
- Signals: "Here's what I discovered", "the key insight is", "but what if we", pivot language
- Treatment: Animation-heavy — this is where visual metaphors shine
- Detection: Tonal shift from negative to positive, from problem to solution, from question to answer
- If missing: The video may be purely informational — treat the most novel information as the insight

**Beat 4: PAYOFF (60-85% of runtime)**
- Purpose: Deliver on the promise — evidence, demonstration, proof
- Signals: Examples, case studies, demos, "let me show you", "here's the result"
- Treatment: Screenshots, demonstrations, data visualizations — concrete evidence
- Detection: Specific examples, named entities, numbers/results, demonstrations
- If weak: Add data visualization or comparison animations to make results tangible

**Beat 5: CLOSE (85-100% of runtime)**
- Purpose: Synthesize, call to action, emotional landing
- Signals: "So in summary", "the takeaway is", "what this means for you", future-looking language
- Treatment: Speaker-only with text-overlay for key takeaway, CTA
- Detection: Summary language, imperative mood ("go try this"), audience address ("you")
- If abrupt: Add a brief recap text-overlay before the final CTA

### Arc Variants

Not all content follows the five-beat arc exactly. Recognize these variants:

**List/Ranking Arc** (listicles, top-N videos):
```
HOOK → ITEM_1 → ITEM_2 → ... → ITEM_N → CLOSE
Each item is a mini-arc: setup → reveal → evidence
Pacing: acceleration (items get shorter toward the end)
```

**Tutorial Arc** (how-to, instructional):
```
HOOK → CONTEXT → STEP_1 → STEP_2 → ... → RESULT → CLOSE
Each step: show → explain → verify
Pacing: steady rhythm with brief breathers between steps
```

**Debate Arc** (opinion, analysis):
```
HOOK → SIDE_A → SIDE_B → ANALYSIS → VERDICT → CLOSE
Treatment: Split treatments for comparison, animation for analysis
Pacing: balanced time for each side, acceleration into verdict
```

**Journey Arc** (vlog, documentary):
```
HOOK → DEPARTURE → OBSTACLE → DISCOVERY → RETURN → CLOSE
Treatment: Stock-video heavy, speaker-only for reflections
Pacing: slow build, fast middle, reflective end
```

---

## 2. Beat Identification from Transcript

### Linguistic Markers for Section Boundaries

These phrases reliably indicate narrative beat transitions. Scan the transcript for them:

**Topic Introduction Markers:**
- "Let's talk about...", "Now, moving on to...", "The next thing is..."
- "Speaking of which...", "That brings me to..."
- "So, [new topic]...", "[Number], [topic]..."
- "Another important aspect is..."

**Pivot/Contrast Markers:**
- "But here's the thing...", "However,...", "On the other hand..."
- "What's interesting though is...", "The plot twist is..."
- "Now, you might think..., but actually..."
- "Contrary to popular belief..."

**Emphasis/Key Point Markers:**
- "This is the key...", "The most important thing is..."
- "Pay attention to this...", "This is critical..."
- "If you remember one thing from this video..."
- "Let me repeat that...", "I want to emphasize..."

**Evidence/Example Markers:**
- "For example...", "Let me show you...", "Take a look at this..."
- "Here's a real-world case...", "In practice..."
- "The data shows...", "According to..."
- "I ran an experiment...", "When I tested this..."

**Summary/Conclusion Markers:**
- "So in summary...", "To wrap up...", "The bottom line is..."
- "What does this all mean?", "Here's the takeaway..."
- "If you want to get started...", "The next step is..."
- "Thanks for watching...", "Don't forget to..."

### Prosodic Beat Markers

Beyond words, detect beats through delivery patterns:

**Energy Increase** (new section or key point):
- Speaking rate increases > 20% from baseline
- Volume rises
- Shorter sentences, more declarative

**Energy Decrease** (transition or reflection):
- Speaking rate drops
- Longer pauses between sentences
- Qualifiers appear ("kind of", "sort of", "in a way")

**Dramatic Pause** (emphasis, reveal):
- Silence > 1.5s followed by a short, impactful statement
- Indicates: This is a key moment. Use bold text-overlay or animation.

**List Cadence** (enumeration):
- Rhythmic delivery with similar intonation per item
- "First... Second... Third..."
- Indicates: Use sequential text-overlay with bullet reveal

---

## 3. Emotional Pacing

### The Energy Curve

Map each section's emotional energy on a 1-5 scale:

| Level | Label | Characteristics | Treatment Approach |
|---|---|---|---|
| 1 | Calm | Reflective, slow, quiet | Speaker-only, ambient stock-video |
| 2 | Steady | Informational, neutral, explanatory | Screenshot, simple text-overlay |
| 3 | Engaged | Enthusiastic, interested, flowing | Mixed treatments, moderate animation |
| 4 | Intense | Passionate, urgent, emphatic | Bold animation, dramatic text-overlay |
| 5 | Peak | Revelatory, climactic, emotional crescendo | Full-screen animation, impact effects |

### Pacing Patterns

**The Rollercoaster** (most engaging):
```
Energy: 4 → 2 → 3 → 5 → 2 → 4 → 3 → 5 → 1
       Hook  Setup  Build Peak Rest Build Build Climax Close
```
Alternate high and low energy. Never stay at the same level for more than 2 sections.

**The Ramp** (builds to a climax):
```
Energy: 3 → 2 → 3 → 3 → 4 → 4 → 5 → 5 → 2
       Hook  Context  Build  Build  Rise  Rise  Peak  Peak  Land
```
Steady build with a single peak near the end. Good for reveals and tutorials.

**The Plateau** (avoid this):
```
Energy: 3 → 3 → 3 → 3 → 3 → 3 → 3 → 3 → 3
       All sections at the same energy level
```
Monotonous. If detected, artificially create peaks by adding animation/text-overlay emphasis to key moments and creating valleys with speaker-only breathers.

### Energy Transition Rules

- **Jump up** (1→4, 2→5): Allowed at hook and climax only. Elsewhere, it feels jarring.
- **Step up** (2→3, 3→4): Natural and frequent. The default progression.
- **Drop down** (4→2, 5→2): Use after peaks. Gives viewer time to process.
- **Gradual decline** (5→4→3→2): Natural for closing sequences.
- **Sustained high** (4→4→4): Maximum 2 sections before a mandatory drop. Exhausting otherwise.
- **Sustained low** (1→1→1): Maximum 1 section (except intro/outro). Risks losing viewer.

### Breather Placement

Insert a "breather" (energy level 1-2) after every 60-90 seconds of high-energy content:

**Breather Types:**
- **Visual breather**: Speaker-only with no overlays, slight zoom
- **Audio breather**: Quieter delivery, reflective tone
- **Pacing breather**: Slightly longer section (15-20s) after rapid-fire short sections
- **Content breather**: Anecdote or aside that's lighter than the main content

**Breather Timing:**
- After a major reveal or data dump (viewer needs to absorb)
- Before a topic transition (palate cleanser)
- At the 1/3 and 2/3 marks of the video (structural rhythm)

---

## 4. Section Boundary Detection

### Boundary Strength Classification

Not all section boundaries are equal. Classify each detected boundary:

**Hard Boundary** (always split here):
- Explicit topic change with transition language
- Speaker directly addresses the camera with a new subject
- Timestamp gap > 3 seconds
- Question-answer transition in interviews
- Score: 10/10

**Medium Boundary** (split if section > 15s):
- Tonal shift without explicit transition
- New example or case study within the same topic
- "So..." or "Now..." without clear new topic
- Shift from abstract to concrete or vice versa
- Score: 5-7/10

**Soft Boundary** (split only if section > 25s):
- Slight pause in delivery
- Repeated word or phrase (speaker restarting a thought)
- Parenthetical aside ("by the way", "as a side note")
- Score: 2-4/10

### Boundary Detection Algorithm

```
For each sentence in transcript:
  1. Check for linguistic markers (see Beat Identification above)
  2. Check for timestamp gaps > 2s
  3. Check for speaker change
  4. Calculate topic similarity with previous sentence
     (shared keywords, semantic continuity)
  5. Score the boundary potential (0-10)

  If score >= 8: Hard boundary → always split
  If score >= 5 AND current section > 15s: Medium boundary → split
  If score >= 3 AND current section > 25s: Soft boundary → consider split
  If score < 3: Continue current section
```

### Post-Processing Boundaries

After initial boundary detection, apply these corrections:

1. **Merge micro-sections**: Any section < 5s should be merged with its neighbor
2. **Split mega-sections**: Any section > 30s should be re-examined for internal boundaries
3. **Balance pacing**: If all sections are the same length (within 3s), vary them
4. **Protect pairs**: Keep question-answer pairs together (don't split between Q and A)
5. **Anchor key moments**: Ensure the most important content is at a section boundary (start of section = maximum visual impact)

---

## 5. Continuity Planning

### Visual Continuity Elements

Create visual threads that connect sections, making the video feel cohesive rather than a slideshow:

**Color Thread:**
- Establish a primary color palette (2-3 colors) in the first section
- Carry these colors through all treatments:
  - Animation backgrounds use palette colors
  - Text-overlay accents use the primary color
  - Screenshot borders/highlights use the palette
  - Lower thirds maintain consistent color scheme
- Shift palette temperature for emotional changes (cooler = analytical, warmer = emotional)

**Motif Thread:**
- Identify a recurring visual element from the content's metaphor
- Example: Video about "building" → construction motifs (blueprints, scaffolding, bricks)
- Use the motif in:
  - Transition animations (brick-laying reveal)
  - Section title cards (blueprint-style grid)
  - Data visualizations (bar chart as building floors)

**Typography Thread:**
- One font family throughout (with weight variations for hierarchy)
- Consistent text positioning (always bottom-third for captions, always centered for titles)
- Same animation style for all text entrances (all slide-up, or all fade, not mixed)

**Spatial Thread:**
- Consistent use of screen space:
  - Speaker always on the same side when in split-view
  - Animations use the same grid/alignment system
  - Text overlays appear in consistent zones
- Creates spatial predictability — viewer knows where to look

### Transition Continuity

Plan transitions between sections to reinforce narrative flow:

**Same Topic, New Point:**
- Simple cut or brief dissolve (8-12 frames)
- Maintains visual momentum
- Treatment can change but color palette stays

**New Topic:**
- Title card or text-overlay announces the new topic
- Slightly longer transition (15-20 frames)
- Color accent may shift slightly

**Emotional Shift:**
- Cross-dissolve (20-30 frames) with color grade shift
- Background music change or volume shift
- More dramatic visual break

**Contradiction/Pivot:**
- Hard cut (no transition) for maximum impact
- Visual style change (dark → light, warm → cool)
- Text-overlay reinforces the contrast ("But...", "However...")

### Recurring Element Schedule

Plan when recurring elements appear to create rhythm:

```
Section 1:  [Introduce motif]
Section 3:  [Callback to motif, slightly evolved]
Section 6:  [Motif appears in data visualization]
Section 9:  [Motif in transition animation]
Section 12: [Full motif reveal — connects all previous appearances]
```

This creates a sense of intentional design — the viewer subconsciously registers the pattern and feels the video is cohesive even if they can't articulate why.

---

## 6. Narrative Repair

When the raw transcript has structural problems, apply these fixes in the edit plan:

### Problem: No Clear Hook
**Fix**: Pull the most surprising or compelling statement from the body and create a cold open. Add a title card: "But first..." or simply cut to the hook moment, then jump back to chronological order with a "Let's back up" transition.

### Problem: Meandering Middle
**Fix**: Identify the 2-3 strongest points in the middle section. Cut or severely trim everything else. Reorder the remaining points from least to most impactful (building tension). Add text-overlay section headers to create artificial structure.

### Problem: Weak Close
**Fix**: Create a recap section with text-overlay bullet points summarizing key takeaways. Follow with a brief speaker-only CTA. If the speaker just trails off, find their strongest concluding sentence from anywhere in the video and use it as the closer.

### Problem: Monotonous Pacing
**Fix**: Insert visual intensity spikes every 30-45 seconds:
- Convert a speaker-only section to animation
- Add a dramatic text-overlay for a key quote
- Insert a quick stock-video B-roll cutaway (3-5s)
- Trim 20% of the slower sections

### Problem: Too Many Topics
**Fix**: Choose the 3 strongest topics. Reduce others to brief mentions (5s each) or trim entirely. Add a clear structure with numbered text-overlay headers ("1 of 3", "2 of 3"). This creates focus and helps viewer retention.

### Problem: Missing Context
**Fix**: Add text-overlay definitions for jargon. Insert screenshot sections for referenced materials. Use animation to explain prerequisite concepts briefly (10-15s max). These additions should feel organic, not like a textbook.

---

## 7. Narrative Assessment Checklist

Before finalizing the edit plan, score the narrative structure:

- [ ] **Hook present**: Does the video grab attention in the first 10 seconds?
- [ ] **Stakes established**: Does the viewer know why they should care by 30 seconds?
- [ ] **Clear arc**: Can you identify at least 3 of the 5 beats (hook, tension, insight, payoff, close)?
- [ ] **Emotional variety**: Are there at least 3 different energy levels across the video?
- [ ] **Breathers placed**: Is there a low-energy section after every 60-90s of high energy?
- [ ] **Climax positioned**: Is the most impactful moment in the 60-85% position?
- [ ] **Clean close**: Does the video end with intention (not just trailing off)?
- [ ] **Visual continuity**: Are there at least 2 recurring visual elements threading through sections?
- [ ] **Pacing variety**: Do section lengths vary (not all the same duration)?
- [ ] **No dead zones**: Are there any stretches > 25s without a visual change?

Score: Each checked item = 1 point. Target: 8/10 minimum before proceeding to production.
