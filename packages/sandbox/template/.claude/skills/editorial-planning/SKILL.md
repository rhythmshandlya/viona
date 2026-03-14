# Editorial Planning Skill

## Purpose
Transform raw transcript content into structured edit plans that guide visual treatment, pacing, and narrative flow for video production.

---

## 1. Content Type Detection

Analyze the transcript to classify the video into one of these content types. Detection uses pattern matching on linguistic markers, speaker count, and structural cues.

### Detection Rules

| Content Type | Key Signals |
|---|---|
| **Tutorial** | Imperative verbs ("click here", "open the", "next step"), numbered sequences, screen-reference language ("you'll see", "on your screen") |
| **Podcast** | Multi-speaker dialogue, casual register, tangential topics, laughter/filler, long unstructured segments (>60s per topic) |
| **Interview** | Question-answer cadence, two distinct speakers with asymmetric talk time, formal introductions, "tell me about" / "what do you think" patterns |
| **Vlog** | First-person narrative, location references, time-of-day markers ("this morning", "later that day"), personal anecdotes, emotional self-disclosure |
| **Presentation** | Slide-reference language ("on this slide", "as you can see"), structured sections with transitions ("moving on to", "let's talk about"), data citations |
| **Keynote** | Audience interaction ("raise your hand", "how many of you"), applause markers, grand narrative arc, inspirational rhetoric, call-to-action close |

### Multi-Signal Scoring

When signals overlap (e.g., a tutorial-style presentation), score each type:

```
1. Count matched signals per type
2. Weight by strength: imperative verbs (3), question-answer cadence (3),
   slide references (2), casual register (1)
3. Primary type = highest score
4. Secondary type = second highest (if score > 50% of primary)
5. Output: "tutorial-presentation" or just "tutorial"
```

### Type-Specific Defaults

Each content type has default treatment preferences:

- **Tutorial**: Heavy screenshot/screencast, text-overlay for steps, speaker for intro/outro
- **Podcast**: Speaker-focused with B-roll cutaways, text-overlay for key quotes
- **Interview**: Split or alternating speaker shots, text-overlay for name/title, B-roll for topics discussed
- **Vlog**: Mixed speaker/B-roll, fast pacing, text-overlay for location/time
- **Presentation**: Screenshot of slides with speaker picture-in-picture, animation for data
- **Keynote**: Speaker-dominant with audience reactions, animation for key concepts, text-overlay for memorable quotes

---

## 2. Section Breakdown Methodology

### Step 1: Identify Narrative Beats

Scan the transcript for structural markers that indicate section boundaries:

**Hard boundaries** (always start a new section):
- Topic change: speaker explicitly introduces new subject
- Structural markers: "first", "second", "next", "finally", "in conclusion"
- Time jumps: gaps in timestamps > 3 seconds of silence
- Speaker change in interviews

**Soft boundaries** (start a new section if segment > 20s):
- Tonal shift: from serious to humorous or vice versa
- Energy change: speaking rate shifts significantly
- Rhetorical pivot: "but here's the thing", "now what's interesting"
- Example/anecdote start: "let me give you an example", "I remember when"

### Step 2: Map Topic Shifts

For each boundary identified:
```
1. Label the topic on each side of the boundary
2. Rate the shift magnitude: minor (sub-topic) | major (new topic) | pivot (contradiction/reveal)
3. Major shifts and pivots = definite section breaks
4. Minor shifts = merge into parent section unless > 20s
```

### Step 3: Trace Emotional Arcs

Tag each section with an emotional register:
- **Neutral/informative**: facts, explanations, step-by-step
- **Energetic/excited**: enthusiasm, speed increase, superlatives
- **Reflective/serious**: slower pace, deeper voice, philosophical
- **Humorous/light**: jokes, asides, self-deprecation
- **Dramatic/intense**: emphasis, pauses for effect, revelations

Goal: ensure the edit plan has emotional variety. Flag sequences of 3+ sections with the same register as potential pacing problems.

### Step 4: Assign Section Durations

Guidelines for section length:
- **Minimum**: 5 seconds (anything shorter is a transition, not a section)
- **Maximum**: 30 seconds typical; up to 45s for complex explanations or emotional peaks
- **Ideal**: 10-20 seconds for most sections
- **Variety**: alternate between short (5-10s) and medium (15-25s) sections; avoid runs of same-length sections

If a natural section exceeds 30s:
1. Look for internal sub-beats to split on
2. If no natural split, insert a visual change point at 15-20s (B-roll cutaway, text overlay) while keeping it as one logical section
3. Mark these forced splits with `[SPLIT]` so the editor knows it's a pacing decision, not a content boundary

---

## 3. Edit Plan Format Specification

### Section Entry Format

Every section in the edit plan must follow this exact format:

```markdown
### Section N: [Descriptive Name]
- **Time:** M:SS - M:SS
- **Treatment:** animation | screenshot | stock-video | text-overlay | speaker-only | trim
- **Description:** [Vivid, specific description of what the viewer sees]
- **Rationale:** [Why this treatment for this content]
```

### Field Rules

**Section Name**: Short, descriptive (2-5 words). Should communicate the content at a glance.
- Good: "API Rate Limiting Explained", "The Pivotal Realization", "Hook: Shocking Statistic"
- Bad: "Part 1", "Introduction", "More Talking"

**Time**: Use M:SS format. Start time of one section = end time of previous section. No gaps allowed.

**Treatment**: Exactly one primary treatment. If combining (e.g., speaker with text overlay), use the dominant one as primary and note the secondary in Description.
- `animation` - Motion graphics, kinetic typography, data visualization, illustrated concepts
- `screenshot` - Web pages, tweets, articles, product screens, code editors
- `stock-video` - B-roll footage, establishing shots, environmental context
- `text-overlay` - Titles, lower thirds, statistics, pull quotes over speaker or background
- `speaker-only` - Talking head, no additional visual elements
- `trim` - Content to be removed (filler, dead air, tangents)

**Description**: Must be specific enough that a designer could produce the visual without hearing the audio. Include:
- What appears on screen (objects, text content, colors)
- How it moves (entrance direction, animation style)
- What the speaker is saying at this moment (brief summary)
- Any text content verbatim (for text-overlays)

**Rationale**: Explain the editorial reasoning. Reference:
- Why this treatment fits the content (not just "it looks good")
- How it serves the narrative (builds tension, provides evidence, offers a breather)
- How it contrasts with adjacent sections (pacing variety)

### Complete Example

```markdown
## Edit Plan: "Why Rust is Taking Over Systems Programming"
**Content Type:** Presentation (tutorial secondary)
**Total Duration:** 4:32
**Section Count:** 14

### Section 1: Hook - The Memory Bug
- **Time:** 0:00 - 0:08
- **Treatment:** animation
- **Description:** Dark background with a terminal-style animation. Code lines appear character by character showing a C buffer overflow. Red "SEGFAULT" text crashes onto screen with screen-shake effect. Counter appears: "70% of security vulnerabilities are memory safety bugs - Microsoft, 2019"
- **Rationale:** Opens with a visceral, dramatic hook. The crash animation creates urgency. The statistic provides credibility immediately. Animation treatment because the concept (memory bugs) is abstract and benefits from visualization.

### Section 2: Speaker Introduction
- **Time:** 0:08 - 0:15
- **Treatment:** speaker-only
- **Description:** Speaker on camera, natural framing. Lower third fades in at 0:10 with name and title. Clean background, good lighting.
- **Rationale:** After the dramatic hook, the speaker grounds the viewer with a personal presence. Speaker-only establishes trust before diving into technical content. Brief section keeps momentum from the hook.

### Section 3: The Ownership Model
- **Time:** 0:15 - 0:32
- **Treatment:** animation
- **Description:** Split screen: left side shows a variable as a physical "box" being passed between functions (ownership transfer). Right side shows the equivalent Rust code with syntax highlighting. Arrows animate to show how ownership moves. When a second function tries to use the moved variable, a red X appears with "compile error" badge.
- **Rationale:** The ownership model is Rust's core differentiator and is inherently spatial/visual. Animation makes the abstract concept tangible. The split-screen approach connects the metaphor to real code, serving both beginners and experienced developers.
```

---

## 4. Section Timing Guidelines

### Pacing Patterns by Content Type

**Tutorial** (instructional pacing):
- Steps: 10-20s each
- Demonstrations: 15-30s
- Transitions between topics: 3-5s
- Summary/review sections: 10-15s
- Pattern: medium-medium-short-medium-medium-short

**Podcast** (conversational pacing):
- Key points: 15-25s
- Banter/humor: 5-10s (trim excess)
- Story/anecdote: 20-40s (let it breathe)
- Pattern: long-short-long-medium-long-short

**Interview** (rhythmic pacing):
- Questions: 3-5s
- Answers: 15-30s (trim if longer)
- Follow-ups: 10-15s
- Pattern: short-long-short-long (Q&A rhythm)

**Presentation** (academic pacing):
- Slide content: 15-25s per slide
- Speaker transitions: 5-8s
- Data/charts: 20-30s (need time to absorb)
- Pattern: medium-short-medium-long-medium-short

### Retention Rhythm

Regardless of content type, apply this retention rule:
- **Visual change every 15-25 seconds minimum**
- If a section exceeds 25s without a visual change, insert a treatment shift
- The first 30 seconds must have at least 3 visual changes (hook the viewer)
- The last 15 seconds should accelerate pacing (end on energy)

### Duration Budget

For a typical video, aim for this treatment distribution:
- Speaker-only: 20-35% of total runtime
- Animation: 20-30%
- Text overlay: 10-20%
- Screenshot: 5-15%
- Stock video: 5-10%
- Trim: 0-15% (content removed)

---

## 5. Treatment Assignment Heuristics

### Decision Flow

For each section, evaluate in this order:

```
1. Is this dead air, filler, or off-topic?
   YES → trim

2. Is the speaker referencing something visual (website, tweet, article, product)?
   YES → screenshot

3. Is the speaker explaining an abstract concept (algorithm, process, comparison)?
   YES → animation

4. Is there a key quote, statistic, or title that should be emphasized?
   YES → text-overlay

5. Is the speaker describing a place, mood, or establishing context?
   YES → stock-video

6. Is this a personal moment (opinion, emotion, credibility, humor)?
   YES → speaker-only

7. Default: speaker-only with text-overlay accent
```

### Treatment Adjacency Rules

Avoid placing the same treatment back-to-back more than twice:
- Bad: animation → animation → animation
- Good: animation → speaker-only → animation
- Exception: speaker-only can appear consecutively if sections are short (<10s)

When forced to repeat a treatment, vary the sub-style:
- Two animations back-to-back: first uses kinetic typography, second uses diagram/flowchart
- Two text-overlays back-to-back: first is a stat, second is a pull quote with different styling

### Treatment Intensity Mapping

Match treatment complexity to content importance:
- **High importance** (key insight, thesis statement, hook): Full animation, bold text overlay
- **Medium importance** (supporting evidence, examples): Screenshot, subtle animation
- **Low importance** (transitions, context-setting): Speaker-only, simple text overlay
- **Filler** (tangents, repetition, dead air): Trim

---

## 6. Plan Iteration

### Responding to User Feedback

When users request changes to the edit plan, follow these patterns:

**"Make it shorter":**
1. Identify sections marked `speaker-only` that are > 15s — trim to key sentence
2. Look for redundant sections (same point made twice) — merge or trim
3. Reduce stock-video sections to 3-5s max
4. Cut any section with rationale containing "breather" or "context" if adjacent sections cover it

**"Make it more dynamic":**
1. Convert speaker-only sections > 10s into split treatments (speaker + text-overlay)
2. Add animation sections for any abstract concepts currently shown as speaker-only
3. Increase visual change frequency (target: every 10-15s instead of 15-25s)
4. Add transition effects between major topic shifts

**"Focus more on [topic]":**
1. Identify all sections mentioning the topic
2. Extend those sections by 5-10s each (reallocate from less relevant sections)
3. Upgrade treatment: if speaker-only, consider animation or text-overlay
4. Add a new section if the topic isn't adequately covered

**"Change the tone":**
1. More professional: reduce stock-video, increase screenshot/data, formal text-overlay styling
2. More casual: increase speaker-only percentage, add humor-tagged sections, informal text overlays
3. More dramatic: animation-heavy, bold color schemes, shorter sections for pace

### Versioning

When iterating on a plan:
- Keep the original section numbering stable (don't renumber after removing sections)
- Mark changed sections with `[REVISED]`
- Mark new sections with `[NEW]`
- Mark removed sections with `[REMOVED]` (don't delete — cross out)
- Include a changelog at the top of the revised plan:
  ```markdown
  ## Changelog
  - v2: Shortened sections 3, 7 per user feedback. Added section 8b for deeper API coverage.
  - v1: Initial plan
  ```
