# Visual Treatment Guide Skill

## Purpose
Provide a systematic decision framework for selecting the right visual treatment for each section of an edit plan. This skill turns editorial intent into concrete visual specifications.

---

## 1. Treatment Decision Tree

For every section of transcript content, walk through this decision tree top-to-bottom. Take the first matching branch.

```
START
│
├─ Content is silence, filler words, or off-topic tangent?
│  └─ YES → TRIM
│
├─ Speaker references a specific visual artifact?
│  ├─ Website, app, or product UI → SCREENSHOT
│  ├─ Tweet, social media post → SCREENSHOT
│  ├─ Article or news headline → SCREENSHOT
│  ├─ Code editor or terminal → SCREENSHOT
│  └─ Physical object or place → STOCK-VIDEO
│
├─ Speaker explains an abstract concept?
│  ├─ Process or workflow → ANIMATION (flowchart/diagram)
│  ├─ Data or statistics → ANIMATION (chart/counter)
│  ├─ Comparison (A vs B) → ANIMATION (split-screen morph)
│  ├─ Timeline or history → ANIMATION (timeline reveal)
│  └─ Technical mechanism → ANIMATION (explainer diagram)
│
├─ Content contains a quotable moment?
│  ├─ Key statistic or number → TEXT-OVERLAY (stat display)
│  ├─ Memorable quote → TEXT-OVERLAY (pull quote)
│  ├─ Title or section header → TEXT-OVERLAY (title card)
│  ├─ List of items (3+) → TEXT-OVERLAY (bullet reveal)
│  └─ Definition or term → TEXT-OVERLAY (term card)
│
├─ Speaker describes a setting, mood, or context?
│  ├─ Geographic location → STOCK-VIDEO (establishing shot)
│  ├─ Time period or era → STOCK-VIDEO (archival/period footage)
│  ├─ Industry or workplace → STOCK-VIDEO (B-roll)
│  └─ Nature or environment → STOCK-VIDEO (ambient footage)
│
├─ Speaker delivers personal/emotional content?
│  ├─ Personal opinion → SPEAKER-ONLY
│  ├─ Emotional moment → SPEAKER-ONLY
│  ├─ Credibility statement → SPEAKER-ONLY
│  ├─ Humor or wit → SPEAKER-ONLY
│  └─ Call to action → SPEAKER-ONLY (with text-overlay accent)
│
└─ DEFAULT → SPEAKER-ONLY with subtle text-overlay
```

---

## 2. Treatment Specifications

### ANIMATION

Use animation when the content is abstract, conceptual, or data-driven. Animation makes invisible things visible.

**Sub-types:**

| Sub-type | When to Use | Visual Approach |
|---|---|---|
| Kinetic Typography | Key phrases, definitions, emphasis | Words animate onto screen with spring physics, scale/rotation for emphasis |
| Flowchart/Diagram | Processes, workflows, cause-effect | Nodes appear sequentially, connections draw between them, highlight active step |
| Data Visualization | Statistics, comparisons, trends | Animated counters, bar charts that grow, pie charts that fill |
| Split-Screen Compare | A vs B, before/after, old vs new | Two panels side by side, elements animate to highlight differences |
| Timeline Reveal | History, sequences, evolution | Horizontal timeline, events pop in chronologically with dates |
| Explainer Diagram | Technical mechanisms, architectures | Labeled components appear, arrows show data/control flow |
| Particle/Abstract | Mood, energy, transitions | Particle systems, flowing shapes, abstract motion for emotional beats |

**Animation Timing Rules:**
- Entrance: 8-12 frames (spring animation, SNAPPY config)
- Hold: minimum 45 frames (viewer needs time to read/absorb)
- Exit: 6-8 frames (faster than entrance — asymmetric feels more natural)
- Stagger between elements: 6-10 frames
- Total animation section: minimum 90 frames (3s at 30fps)

**Animation Complexity Budget:**
- Simple (1-2 animated elements): 3-5s section
- Medium (3-5 elements with stagger): 5-10s section
- Complex (6+ elements, multi-phase): 10-20s section
- Never exceed 8 simultaneously animated elements (visual overload)

**Examples:**

*Speaker says: "There are three main types of machine learning: supervised, unsupervised, and reinforcement learning"*
```
Treatment: ANIMATION (diagram)
Visual: Three labeled boxes appear with spring animation, staggered 8 frames apart.
Each box has an icon (labeled data → supervised, clusters → unsupervised,
game controller → reinforcement). Connecting lines draw from a central
"Machine Learning" node to each box. Active box highlights as speaker
mentions each type.
```

*Speaker says: "Revenue grew 340% year over year"*
```
Treatment: ANIMATION (data visualization)
Visual: Animated counter rolls from 0 to 340 with a "%" suffix.
Behind it, a minimal bar chart shows this year vs last year,
with the current year bar growing to 3.4x the height.
Color: accent green (#22C55E) for the growth bar.
```

---

### SCREENSHOT

Use screenshot when the speaker references a specific, real visual artifact. Screenshots ground abstract discussion in concrete evidence.

**Sub-types:**

| Sub-type | When to Use | Visual Approach |
|---|---|---|
| Full Page | Overview of a website or app | Browser chrome mockup, slight shadow, subtle zoom on load |
| Zoomed Region | Specific UI element or text passage | Start full, animate zoom to region of interest, highlight with border/glow |
| Tweet/Social | Social media post reference | Styled card with avatar, handle, content; dark or light mode to match video |
| Code Block | Code snippet or terminal output | Syntax-highlighted code in editor theme, line-by-line reveal or highlight |
| Article Headline | News article or blog post | Headline + source + date in a clean card layout, blurred body text |
| Product UI | App or product being discussed | Clean capture with device frame (phone/laptop mockup) |

**Screenshot Composition Rules:**
- Always use a device frame or browser chrome (never raw screenshot)
- Add subtle drop shadow (4px blur, 10% opacity black)
- Animate entrance: slide up + fade in (12 frames)
- For zoomed regions: animate the zoom over 20 frames, add a highlight rectangle
- Resolution: minimum 2x for readability at 1080p output
- Text must be legible at final output resolution — zoom if necessary
- Add source attribution (small text, bottom-right: "Source: domain.com")

**Examples:**

*Speaker says: "If you look at the React documentation..."*
```
Treatment: SCREENSHOT (zoomed region)
Visual: React docs page in browser chrome. Initial full-page view for 1s,
then smooth zoom (20 frames) to the specific section being discussed.
Yellow highlight rectangle pulses around the relevant paragraph.
Source: "react.dev" in small text, bottom-right.
```

*Speaker says: "This tweet went viral last week"*
```
Treatment: SCREENSHOT (tweet/social)
Visual: Tweet card with dark background. Avatar, display name, handle,
verified badge, tweet text, engagement metrics (likes, retweets).
Card slides in from right with spring animation.
Engagement numbers animate up with counter effect.
```

---

### STOCK-VIDEO

Use stock video for establishing context, conveying mood, or illustrating real-world scenarios that the speaker describes but doesn't show.

**Sub-types:**

| Sub-type | When to Use | Visual Approach |
|---|---|---|
| Establishing Shot | Setting the scene, location context | Wide shot, slow pan or static, 3-5s |
| B-Roll Activity | People doing things the speaker describes | Medium shot of relevant activity, 3-8s |
| Ambient/Mood | Emotional undertone, tone-setting | Abstract or atmospheric footage, slow motion, 3-5s |
| Archival | Historical reference, past events | Period-appropriate footage or photos, slight Ken Burns effect |
| Nature/Environment | Environmental topics, metaphors | Landscape, weather, natural phenomena |

**Stock Video Selection Rules:**
- Duration: 3-8s per clip (shorter clips for faster pacing)
- Match the color grade to the video's palette (warm, cool, neutral)
- Avoid cliche footage (handshake = business, brain = AI, globe = international)
- Prefer footage with subtle motion (slow pan, gentle movement) over static or hyperactive
- Layer speaker audio over stock footage — the voice continues, only the visual changes
- Add slight slow-motion (80% speed) for a polished feel
- Cross-dissolve in (15 frames) and out (15 frames)

**Search Query Formulation:**
When searching for stock footage, use specific, concrete queries:
- Bad: "technology" "business" "success"
- Good: "software developer typing dark room" "startup team whiteboard brainstorm" "person celebrating achievement office"

**Examples:**

*Speaker says: "When I visited the factory in Shenzhen..."*
```
Treatment: STOCK-VIDEO (establishing shot)
Visual: Aerial or wide shot of Shenzhen cityscape or electronics factory.
Slow dolly forward, warm color grade. Duration: 4s.
Cross-dissolve from speaker to footage, speaker audio continues.
Lower third: "Shenzhen, China" in clean sans-serif.
```

---

### TEXT-OVERLAY

Use text overlay when specific words, numbers, or phrases deserve visual emphasis. Text overlays reinforce key messages and aid retention.

**Sub-types:**

| Sub-type | When to Use | Visual Approach |
|---|---|---|
| Title Card | Section headers, topic introductions | Large bold text, centered, full-screen background |
| Lower Third | Names, titles, locations | Bottom third of frame, semi-transparent background bar |
| Stat Display | Numbers, percentages, metrics | Large number with label, animated counter |
| Pull Quote | Memorable speaker quotes | Quotation marks, italicized text, subtle background |
| Bullet List | Series of points or items | Sequential reveal, checkmark or arrow bullets |
| Term Definition | Jargon, acronyms, technical terms | Term in bold + definition below, dictionary-card style |
| Caption/Callout | Supplementary info, corrections | Smaller text, positioned near relevant visual element |

**Text Overlay Design Rules:**
- Maximum 12 words per overlay (viewers can't read more in 3-5s)
- Font hierarchy: title (48-64px), subtitle (32-40px), body (24-32px), caption (18-24px)
- Contrast ratio: minimum 4.5:1 against background (use semi-transparent backdrop if needed)
- Animation: fade + slide (8-12 frames in, 6-8 frames out)
- Hold time: minimum 2s for short text, 4s for longer text
- Position: respect safe zones (10% margin from edges)
- Never overlay text on speaker's face

**Examples:**

*Speaker says: "There are 2.5 billion gamers worldwide"*
```
Treatment: TEXT-OVERLAY (stat display)
Visual: "2.5B" in large bold text (64px) with animated counter effect.
Below it: "gamers worldwide" in lighter weight (32px).
Background: semi-transparent dark panel behind text.
Positioned: center-right of frame (speaker visible on left).
Duration: 4s (1s animate in, 2s hold, 1s animate out).
```

---

### SPEAKER-ONLY

Use speaker-only for moments where the speaker's presence, expression, and delivery are the content. Don't add visual noise to authentic moments.

**When Speaker-Only is Best:**
- Personal stories or anecdotes (authenticity matters)
- Humor and comedic timing (don't distract from the punchline)
- Emotional delivery (sadness, excitement, frustration — let the face carry it)
- Credibility moments ("In my 20 years of experience...")
- Call to action ("Subscribe", "Check the link below")
- Transitions between major topics (brief palate cleanser)

**Speaker-Only Enhancement Options:**
These are subtle additions that don't constitute a treatment change:
- Slow zoom in (0.5% per second) for intimacy/intensity
- Slight color grade shift (warmer for emotional, cooler for analytical)
- Shallow depth of field increase for focus on speaker
- Lower third for name/title (first appearance only)

**Duration Guidelines:**
- Minimum: 3s (shorter feels like a flash frame)
- Maximum: 15s before viewer engagement drops
- If speaker-only exceeds 15s, consider inserting a text-overlay accent at the midpoint

---

### TRIM

Content to be removed from the final edit. Trimming is as important as adding visuals.

**What to Trim:**
- Dead air: silence > 1.5s (keep natural pauses < 1s)
- Filler words: "um", "uh", "like", "you know" (when excessive, not every instance)
- False starts: "So what I — actually let me — okay so"
- Repetition: speaker says the same thing twice with different words (keep the better version)
- Tangents: off-topic digressions that don't serve the narrative (> 10s)
- Technical issues: audio glitches, camera adjustments, "can you hear me?"
- Throat clearing, coughing, sniffling (brief moments)

**What NOT to Trim:**
- Deliberate pauses for emphasis (speaker pauses before a reveal)
- Natural laughter or reactions (keeps it human)
- Brief filler that aids conversational flow (occasional "you know" is natural)
- Content that provides necessary context even if slightly tangential

**Trim Notation:**
```markdown
### Section 5: [TRIM] Dead Air
- **Time:** 1:45 - 1:48
- **Treatment:** trim
- **Description:** 3 seconds of silence while speaker checks notes
- **Rationale:** Dead air breaks momentum. Adjacent sections will be joined seamlessly.
```

---

## 3. Treatment Combination Patterns

Some sections benefit from layered treatments. These are the approved combination patterns:

### Speaker + Text-Overlay (most common combination)
Speaker remains visible while text appears in the lower third or side panel.
- Use for: name introductions, key statistics, reinforcing a verbal point
- Text occupies max 30% of frame, never overlaps speaker's face

### Speaker + Animation (picture-in-picture)
Speaker shrinks to corner while animation takes center stage.
- Use for: explaining concepts while maintaining speaker presence
- Speaker PiP: 20-25% of frame, bottom-right or bottom-left corner
- Animation: fills remaining frame space

### Screenshot + Text-Overlay
Screenshot with overlay annotation or callout.
- Use for: highlighting specific parts of a screenshot, adding context
- Overlay appears after screenshot is established (1s delay)

### Stock-Video + Text-Overlay
B-roll with text providing context or location information.
- Use for: establishing shots with location names, mood footage with quotes
- Text uses high-contrast treatment (dark backdrop bar)

### Forbidden Combinations
- Animation + Screenshot (too visually busy)
- Stock-Video + Animation (competing for attention)
- Two simultaneous text overlays (cognitive overload)
- Any treatment + trim (trim means remove, not overlay)

---

## 4. Treatment Pacing Rules

### Visual Variety Checklist

Before finalizing a treatment plan, verify:

- [ ] No three consecutive sections have the same treatment
- [ ] Speaker-only appears at least once every 60s (maintains personal connection)
- [ ] Animation sections are followed by simpler treatments (visual rest)
- [ ] The first section is NOT speaker-only (hook with something visual)
- [ ] The last section IS speaker-only or speaker + text-overlay (personal close)
- [ ] Text-overlay sections don't exceed 15% of total sections (overuse = slide deck feel)
- [ ] At least 3 different treatment types are used in any 2-minute span

### Treatment Density by Position

| Video Position | Treatment Density | Reasoning |
|---|---|---|
| First 15s (hook) | High — 2-3 treatments | Grab attention immediately |
| 15s - 60s (setup) | Medium — mix of treatments | Establish rhythm, introduce topic |
| Middle 60% (body) | Varied — follow content | Serve the content's needs |
| Last 15s (close) | Low — speaker-focused | Personal connection, CTA |

---

## 5. Quality Checklist

Before submitting a treatment plan, verify each section against:

1. **Specificity**: Could a designer create the visual from the description alone?
2. **Relevance**: Does the treatment directly serve the content, or is it decorative?
3. **Variety**: Is this treatment different from the adjacent sections?
4. **Duration**: Is the section long enough for the treatment to register (min 3s)?
5. **Feasibility**: Can this treatment be produced with available tools and assets?
6. **Readability**: If there's text, can it be read at the intended display size?
7. **Continuity**: Does this section visually connect to the sections around it?
