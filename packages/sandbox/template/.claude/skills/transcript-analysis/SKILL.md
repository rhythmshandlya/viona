# Transcript Analysis Skill

## Purpose
Extract structured information from raw transcripts to drive editorial decisions. This skill covers sync point identification, timestamp analysis, filler detection, topic modeling, speaking rate analysis, and citation detection.

---

## 1. Sync Point Identification

Sync points are moments in the transcript where a visual change should align precisely with the spoken content. They are the backbone of a well-edited video.

### What Makes a Sync Point

A sync point occurs when the speaker says something that demands visual reinforcement at that exact moment. Not every sentence is a sync point — only those where visual-audio alignment creates impact.

**High-Priority Sync Points:**

| Type | Signal | Example | Visual Action |
|---|---|---|---|
| Number/Statistic | Speaker states a specific number | "Revenue hit $4.2 million" | Animated counter lands on the number at this timestamp |
| Named Entity | Speaker mentions a person, company, product | "Google just announced..." | Logo or screenshot appears |
| Question | Rhetorical or direct question | "But what does this actually mean?" | Text-overlay with the question |
| List Item | Speaker introduces an item in a sequence | "The third reason is..." | Bullet point or numbered item reveals |
| Reveal | Speaker unveils a conclusion or surprise | "And the answer is..." | Bold text or animation payoff |
| Reference | Speaker points to external content | "If you look at this chart..." | Screenshot or data visualization appears |
| Emphasis | Speaker uses verbal emphasis | "This is CRITICAL" | Text-overlay with emphasis styling |

**Medium-Priority Sync Points:**

| Type | Signal | Example | Visual Action |
|---|---|---|---|
| Topic Shift | Speaker moves to new subject | "Now let's talk about..." | Section title card or transition |
| Example Start | Speaker begins an illustration | "For instance..." | Treatment change (speaker → animation/screenshot) |
| Contrast | Speaker introduces opposition | "But on the other hand..." | Visual style shift or split-screen |
| Definition | Speaker defines a term | "What I mean by X is..." | Term card overlay |

**Low-Priority Sync Points:**

| Type | Signal | Example | Visual Action |
|---|---|---|---|
| Filler Transition | Brief connecting phrase | "So, moving on..." | Subtle visual transition |
| Agreement/Reaction | In multi-speaker, agreement cues | "Exactly, yes" | No visual change needed |
| Repetition | Speaker rephrases the same point | "In other words..." | Optional text-overlay if phrasing is better |

### Sync Point Density Guidelines

- **Target**: 1 sync point every 5-10 seconds
- **Maximum**: 1 sync point every 3 seconds (more = overwhelming)
- **Minimum**: 1 sync point every 15 seconds (less = static, boring)
- **Hook section** (first 15s): 3-5 sync points (high density for engagement)
- **Body sections**: 1-2 sync points per section
- **Close section**: 2-3 sync points (recap key moments)

### Sync Point Timing Precision

When mapping sync points to timestamps:

```
1. Identify the KEY WORD in the sync point phrase
   "Revenue hit FOUR POINT TWO MILLION dollars"
   Key word: "four" (the number starts here)

2. Place the visual trigger 2-3 frames BEFORE the key word
   This creates a "visual anticipation" effect — the eye catches the
   visual just as the ear hears the word

3. For animation sync points, start the animation 10-15 frames
   BEFORE the key word so the animation LANDS on the key word
   Counter animation starts early → reaches "4.2M" exactly when speaker says it

4. For text-overlay sync points, the text should be fully visible
   (animation complete) 2-3 frames before the spoken word
```

### Sync Point Extraction Process

```
For each sentence in the transcript:
  1. Does it contain a number, name, or specific fact? → Mark as sync point
  2. Does it introduce a new topic or transition? → Mark as sync point
  3. Does it contain emphasis markers (capitals, exclamation)? → Mark as sync point
  4. Is it a question? → Mark as sync point
  5. Record: timestamp, key word, sync type, priority (high/medium/low)

Output format:
  { time: "1:23.450", word: "million", type: "statistic", priority: "high" }
```

---

## 2. Word-Level Timestamp Analysis

### Working with Word Timestamps

Transcripts with word-level timestamps enable precise editing. Each word has a start and end time:

```json
{
  "word": "revolutionary",
  "start": 45.230,
  "end": 45.890,
  "confidence": 0.97
}
```

### Timestamp Analysis Patterns

**Gap Detection:**
Identify gaps between words that indicate pauses:

```
For each consecutive word pair (word_a, word_b):
  gap = word_b.start - word_a.end

  If gap > 0.3s and < 1.0s: Natural pause (keep)
  If gap > 1.0s and < 2.0s: Deliberate pause (keep, may be emphasis)
  If gap > 2.0s and < 5.0s: Dead air (candidate for trim)
  If gap > 5.0s: Extended silence (definitely trim unless intentional)
```

**Overlap Detection (multi-speaker):**
When speakers talk simultaneously:

```
If speaker_a.word.end > speaker_b.word.start:
  overlap_duration = speaker_a.word.end - speaker_b.word.start

  If overlap < 0.3s: Normal conversational overlap (keep)
  If overlap > 0.3s: Cross-talk (consider trimming one speaker)
```

**Sentence Boundary Detection:**
Group words into sentences for section-level analysis:

```
Sentence boundary markers:
  - Period-equivalent pause: gap > 0.5s after a non-filler word
  - Falling intonation pattern (if prosody data available)
  - Conjunction after pause: "And...", "So...", "But..."
  - Speaker change
```

**Phrase Grouping for Animation:**
When creating text-overlay animations, group words into readable phrases:

```
Rules for phrase boundaries:
  - Maximum 4-6 words per phrase
  - Break at natural speech pauses (gap > 0.2s)
  - Keep prepositional phrases together ("in the cloud")
  - Keep adjective-noun pairs together ("machine learning")
  - Never break a number from its unit ("4.2 | million" not "4.2 million |")
```

### Timestamp Normalization

Transcription services return timestamps in different formats. Normalize to seconds:

```
"1:23" → 83.0
"1:23.450" → 83.45
"00:01:23,450" → 83.45 (SRT format)
83450 → 83.45 (milliseconds)
```

Always work in seconds internally. Convert to M:SS for display in edit plans.

---

## 3. Filler Word Detection

### Filler Categories

**Verbal Fillers** (remove most instances):
- Hesitation: "um", "uh", "er", "ah"
- Hedge: "like", "you know", "I mean", "sort of", "kind of", "basically"
- Stall: "so", "well", "right", "okay" (at sentence starts, not as content words)

**Discourse Markers** (keep most instances):
- Transition: "so" (when introducing a new point), "now", "anyway"
- Emphasis: "actually", "literally", "honestly"
- Connection: "and then", "because", "therefore"

### Detection Rules

```
For each word in transcript:
  1. Is it in the filler word list? → Flag it
  2. Check context:
     a. Is it at sentence start after a pause > 0.5s? → Likely filler
     b. Is it mid-sentence with no pause? → Likely discourse marker (keep)
     c. Is it repeated ("like, like, like")? → Definitely filler (remove all but one)
     d. Is "so" followed by a new topic? → Discourse marker (keep)
     e. Is "so" followed by a repeat of previous sentence? → Filler (remove)
```

### Filler Density Analysis

Calculate filler rate to determine overall transcript quality:

```
filler_rate = filler_count / total_word_count * 100

If filler_rate < 3%: Clean speaker — minimal trimming needed
If filler_rate 3-8%: Normal speaker — trim obvious clusters
If filler_rate 8-15%: Heavy filler — aggressive trimming recommended
If filler_rate > 15%: Very heavy — consider re-recording or extensive trim pass
```

### Filler Removal Strategy

**Quick Remove** (always safe to trim):
- "Um" or "uh" with pauses on both sides
- Triple+ filler clusters ("like, you know, um, basically")
- False start fillers ("So what I — um — what I want to say is")

**Context Check** (trim carefully):
- "Like" — keep when used as comparison ("it's like a factory"), remove when filler ("I was like, you know, like thinking")
- "So" — keep when causal ("so it breaks"), remove when stalling ("so... um... anyway")
- "Right" — keep when confirming ("that's right"), remove when seeking validation ("right? right?")

**Preserve** (do not trim):
- Fillers that create comedic timing
- Fillers that convey genuine uncertainty (authentic moment)
- Fillers in quoted speech ("and she was like, 'um, I don't think so'")

### Filler Report Format

```markdown
## Filler Analysis
- Total words: 2,847
- Filler count: 156 (5.5% — normal range)
- Most common: "like" (47), "um" (38), "you know" (29)
- Cluster locations: 2:15-2:22 (heavy), 5:40-5:48 (heavy)
- Recommended trims: 89 instances (estimated time saved: 24s)
```

---

## 4. Topic Shift Detection

### Semantic Break Analysis

Detect where the content's topic changes by analyzing semantic similarity between adjacent segments.

**Keyword Window Method:**

```
1. Divide transcript into 10-second windows
2. Extract content words (nouns, verbs, adjectives) from each window
3. Calculate overlap between adjacent windows:

   overlap = |keywords_A ∩ keywords_B| / |keywords_A ∪ keywords_B|

4. Low overlap (<0.2) = likely topic shift
5. Very low overlap (<0.1) = definite topic shift
```

**Topic Shift Markers (Linguistic):**

Strong shift indicators (score +3 each):
- "Now, let's talk about [new topic]"
- "Moving on to..."
- "The next thing I want to cover is..."
- "Switching gears..."
- "On a completely different note..."

Medium shift indicators (score +2 each):
- "Another thing is..."
- "Related to this..."
- "Speaking of [new topic]..."
- "This reminds me of..."
- "By the way..."

Weak shift indicators (score +1 each):
- "Also..."
- "And then..."
- "So..."
- New paragraph in transcript

### Topic Hierarchy

Build a topic tree from detected shifts:

```
Main Topic: "Rust Programming Language"
├── Subtopic: "Memory Safety"
│   ├── Point: "Ownership model"
│   ├── Point: "Borrowing rules"
│   └── Point: "Lifetime annotations"
├── Subtopic: "Performance"
│   ├── Point: "Zero-cost abstractions"
│   └── Point: "Comparison with C++"
└── Subtopic: "Ecosystem"
    ├── Point: "Cargo package manager"
    └── Point: "Community growth"
```

This hierarchy informs:
- Section grouping (subtopics = sections, points = subsections)
- Visual consistency (same subtopic = same color accent)
- Navigation structure (if generating chapters/timestamps)

### Topic Duration Analysis

For each detected topic, calculate:
- Duration (seconds)
- Percentage of total runtime
- Word count
- Filler density within the topic

Flag imbalances:
- Topic covering > 40% of runtime but being a minor point → consider trimming
- Topic covering < 5% of runtime but being the stated main topic → consider expanding or noting to the user
- Two adjacent topics covering the same ground → merge or trim one

---

## 5. Speaking Rate Analysis

### Words Per Minute (WPM) Calculation

```
For each 10-second window:
  wpm = (word_count_in_window / 10) * 60

Baseline WPM for the speaker:
  baseline = median(all_window_wpms)
```

### Rate Categories

| WPM Range | Label | Interpretation |
|---|---|---|
| < 100 | Very slow | Emphasis, reflection, or struggling to articulate |
| 100-130 | Slow | Deliberate, serious, or explaining complex concept |
| 130-160 | Normal | Comfortable delivery, conversational |
| 160-190 | Fast | Enthusiastic, excited, or listing |
| > 190 | Very fast | Urgent, anxious, or ranting |

### Intensity Mapping

Combine WPM with other signals to create an intensity score:

```
intensity = 0

# Speaking rate contribution
if wpm > baseline * 1.2: intensity += 2  # Speaking fast
if wpm < baseline * 0.8: intensity += 1  # Speaking slow (emphasis)

# Pause contribution
if avg_pause_duration < 0.2s: intensity += 1  # Rapid-fire
if avg_pause_duration > 0.8s: intensity += 1  # Dramatic pauses

# Volume contribution (if available)
if volume > baseline * 1.3: intensity += 2  # Speaking loudly
if volume < baseline * 0.7: intensity += 1  # Speaking quietly (intimate)

# Score interpretation
# 0-1: Low intensity → Speaker-only, calm treatment
# 2-3: Medium intensity → Mixed treatment
# 4-5: High intensity → Bold animation, dramatic text-overlay
# 6+: Peak intensity → Full visual treatment, maximum impact
```

### Rate Change Detection

Sudden changes in speaking rate indicate important moments:

```
For each adjacent window pair:
  rate_change = abs(wpm_current - wpm_previous) / wpm_previous

  If rate_change > 0.3 (30% change):
    Mark as "rate shift" → Likely section boundary or emphasis point

  If speaker slows down > 30% then speeds back up:
    Mark as "emphasis sandwich" → The slow section is the key point

  If speaker speeds up > 30% and sustains:
    Mark as "energy ramp" → Building toward a climax
```

---

## 6. Quote and Citation Detection

### Quote Patterns

Detect when the speaker references external sources, which signals screenshot or text-overlay treatment:

**Direct Quote Signals:**
- "[Person] said...", "[Person] wrote...", "[Person] tweeted..."
- "According to [source]..."
- "There's a famous quote: ..."
- "As [person] puts it..."
- "The report/study/paper states..."
- Change in vocal delivery (speaker adopts a different tone/voice for the quote)

**Citation Signals:**
- "A study from [institution] found..."
- "Research published in [journal] shows..."
- "[Year] data from [source] indicates..."
- "The official documentation says..."
- "[Company] reported that..."

**URL/Reference Signals:**
- "If you go to [website]..."
- "I'll put the link in the description"
- "Check out [resource name]"
- "On their website, you can see..."

### Citation Processing

When a citation is detected:

```
1. Extract the source: Who/what is being cited?
2. Extract the claim: What fact or quote is attributed?
3. Determine treatment:
   - Named person quote → Text-overlay (pull quote with attribution)
   - Website/article → Screenshot (capture the referenced page)
   - Study/data → Animation (data visualization of the finding)
   - Book/publication → Text-overlay (title card with citation)
4. Flag for research: If the source is specific enough, it can be looked up
   for screenshot capture or fact verification
```

### Citation Density

Track citation frequency to assess content credibility level:

```
citations_per_minute = total_citations / video_duration_minutes

If < 0.5/min: Opinion-heavy content → more speaker-only treatment
If 0.5-2/min: Well-supported content → balanced treatment
If > 2/min: Research-heavy content → screenshot and data visualization heavy
```

---

## 7. Transcript Quality Assessment

Before beginning detailed analysis, assess the transcript's overall quality:

### Quality Metrics

```markdown
## Transcript Quality Report

### Accuracy Indicators
- Average word confidence: [0.0-1.0]
- Low-confidence segments: [count] (words with confidence < 0.8)
- Speaker diarization: [available/unavailable]
- Word-level timestamps: [available/unavailable]

### Content Metrics
- Total duration: [M:SS]
- Total word count: [N]
- Average WPM: [N]
- Filler rate: [N%]
- Unique topic count: [N]
- Citation count: [N]

### Structural Metrics
- Detected section boundaries: [N]
- Average section duration: [Ns]
- Longest section: [Ns] at [timestamp]
- Sync point density: [N per minute]

### Quality Score: [1-10]
- 9-10: Excellent — clean transcript, clear structure, rich with sync points
- 7-8: Good — minor filler, clear topics, adequate sync points
- 5-6: Fair — moderate filler, some unclear sections, needs careful analysis
- 3-4: Poor — heavy filler, unclear structure, limited sync opportunities
- 1-2: Very poor — unreliable transcript, may need manual review
```

### Quality-Based Strategy Adjustments

**High quality transcript (7+):**
- Trust section boundaries
- Use aggressive sync point mapping
- Fine-grained treatments (section-by-section)

**Medium quality transcript (4-6):**
- Verify section boundaries manually
- Focus sync points on high-confidence words only
- Broader treatment blocks (2-3 sections per treatment)

**Low quality transcript (1-3):**
- Rely on timestamp gaps and speaker changes for boundaries
- Minimal sync points (only the most obvious)
- Conservative treatments (more speaker-only, fewer animations)
- Flag low-confidence regions for manual review
