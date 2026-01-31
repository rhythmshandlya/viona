# Visual Planning Process

## MANDATORY: Complete These Steps BEFORE Writing Code

You MUST complete all planning steps and output your thinking BEFORE writing any code.
Skipping this process results in poor quality visuals.

---

## Step 0: Content Category Detection

First, identify what type of content you're visualizing:

| Category | Examples | Key Challenge |
|----------|----------|---------------|
| **Structural** | Trees, graphs, hierarchies, org charts, relationships | Showing connections clearly |
| **Quantitative** | Numbers, charts, metrics, comparisons, trends, finance | Making data readable and impactful |
| **Sequential** | Processes, timelines, steps, flows, algorithms | Showing order and progression |
| **Conceptual** | Abstract ideas, metaphors, explanations | Making intangible things tangible |
| **Text-focused** | Quotes, key points, callouts, titles | Typography and emphasis |

**Output:** "Category: [X]" before proceeding.

---

## Step 1: Content Analysis

Answer these questions:

1. **What is the single most important thing the viewer should understand?**
   - If you can't answer in one sentence, you're trying to show too much

2. **What are the 2-4 key elements that MUST appear?**
   - List them explicitly
   - If more than 4, you need multiple scenes

3. **What relationships/connections exist between elements?**
   - Parent-child? Sequential? Comparative? Cause-effect?
   - These MUST be visualized, not implied

**Output:** Write your answers before proceeding.

---

## Step 2: Visual Inventory

List EVERY visual element you will create:

```
Elements:
- [ ] Element 1: [description] - [approximate size]
- [ ] Element 2: [description] - [approximate size]
- [ ] Connection: [from] → [to] - [line/arrow style]
- [ ] Label: [text] - [where it goes]
```

**Critical for Structural content:**
- List every node AND every edge
- Example: "Binary tree: 7 nodes, 6 edges (root→left, root→right, left→leftleft, etc.)"
- If you don't list edges, you WILL forget to draw them

**Critical for Quantitative content:**
- List the actual numbers/values
- List axes, labels, legends needed
- Identify which number is the "hero" (biggest visual emphasis)

---

## Step 3: Layout Planning

Divide the screen into zones and assign elements:

```
┌─────────────────────────────────────┐
│           TOP (titles, headers)      │  ~15% height
├─────────────────────────────────────┤
│                                      │
│           CENTER (main content)      │  ~60% height
│                                      │
├─────────────────────────────────────┤
│           BOTTOM (labels, progress)  │  ~25% height
└─────────────────────────────────────┘
```

**Answer:**
- Where is the focal point? (Center is default, top-third for titles)
- How much whitespace? (Aim for 30-40% empty space)
- What's the visual flow direction? (Left→right? Top→down? Center→out?)

---

## Step 4: Animation Timeline

Plan the sequence with frame numbers:

```
Timeline (assuming 30fps):
- Frame 0-15: Background fades in
- Frame 15-45: [Primary element] animates in from [direction]
- Frame 45-75: [Connections/edges] draw in
- Frame 75-105: [Labels] fade in
- Frame 105+: Hold for viewer to absorb
```

**Rules:**
- One element animates at a time (max 2 simultaneous)
- 300-500ms per element (10-15 frames at 30fps)
- 200-300ms pause between animations (6-10 frames)
- Budget 2-4 seconds per major concept

---

## NOW Write Code

Only after completing Steps 0-4 should you write code.

Reference your plan as you code:
- Check off elements from your inventory as you implement them
- Follow your layout zones
- Match your animation timeline

---

# Design Rules Reference

## Universal Rules (Apply to ALL content)

### Layout
- **Edge padding:** 80px minimum from all edges
- **Content fill:** Never exceed 70% of screen area
- **Spacing:** Pick one value (40px, 60px, or 80px) and use consistently
- **Focal point:** Center or upper-third of screen

### Typography
- **Title:** 64-96px, bold
- **Heading:** 48-64px, semibold
- **Body:** 32-40px, regular
- **Caption/Label:** 24-32px, regular or light
- **Minimum readable:** Never below 24px

### Animation
- **Duration per element:** 300-500ms (10-15 frames at 30fps)
- **Pause between:** 200-300ms (6-10 frames)
- **Sequence:** Structure → Connections → Labels → Decorations
- **Direction:** Enter from logical direction (hierarchy: top→down, sequence: left→right)
- **Easing:** Use spring() for organic, interpolate() for mechanical

### Visual Hierarchy
- **Maximum focal elements:** 3 per scene
- **Size ratio:** Primary should be 1.5-2x larger than secondary
- **Contrast:** Primary elements get highest contrast, secondary gets muted

### Color
- **Limit palette:** Maximum 3-4 colors per scene
- **Semantic colors:** Green=positive/success, Red=negative/warning (when relevant)
- **Text contrast:** Minimum 4.5:1 ratio against background

---

## Category-Specific Rules

### Structural (Trees, Graphs, Hierarchies)

**CRITICAL: Connections are NOT optional**
- Every relationship MUST have a visible line/edge
- Edge thickness: 2-4px
- Edge color: Slightly transparent (0.6-0.8 opacity) or muted
- Edges connect TO the node, not near it

**Node Layout**
- Same-level nodes: equal vertical position
- Level spacing: 120-150px vertical gap
- Sibling spacing: 80-120px horizontal gap
- Parent centered above children

**Animation Order**
1. Root/parent nodes appear first
2. Edges draw outward from parent to child
3. Child nodes appear as edges reach them
4. Labels appear last

**Common Mistakes to Avoid**
- ❌ Nodes without edges (looks like floating boxes)
- ❌ Edges that don't touch nodes (disconnected)
- ❌ Inconsistent level heights
- ❌ All nodes appearing at once (no hierarchy feel)

### Quantitative (Numbers, Charts, Finance)

**Hero Number**
- Identify the ONE most important number
- Make it 2-3x larger than other numbers
- Animate it counting up (not instant)
- Consider adding subtle glow or emphasis

**Charts**
- Always include axis labels
- Animate bars/lines growing, not appearing
- Use consistent bar widths
- Highlight the key data point with color or size

**Comparisons**
- Side-by-side layout with clear divider
- Use same scale for fair comparison
- Color code: consistent meaning across comparisons

**Trends**
- Show direction with arrows or slope
- Green for up/positive, red for down/negative (when contextually appropriate)
- Animate the change, not just the end state

**Common Mistakes to Avoid**
- ❌ Numbers too small to read quickly
- ❌ Charts without labels (what am I looking at?)
- ❌ Inconsistent scales in comparisons
- ❌ Too many data points (simplify!)

### Sequential (Processes, Steps, Flows)

**Flow Direction**
- Horizontal: left → right (most common)
- Vertical: top → down (for hierarchical steps)
- Be consistent within a scene

**Step Indicators**
- Number each step clearly (1, 2, 3 or bullets)
- Connect steps with arrows or lines
- Equal spacing between steps

**Progress Indication**
- Highlight current step (larger, brighter, or outlined)
- Dim completed steps (lower opacity)
- Gray out future steps

**Animation**
- Steps appear one at a time
- Arrow/connection draws before next step appears
- Current step gets emphasis animation (pulse, glow)

**Common Mistakes to Avoid**
- ❌ Steps without visual connection (just floating items)
- ❌ No indication of order (which comes first?)
- ❌ All steps same emphasis (no sense of progression)

### Conceptual (Abstract Ideas, Metaphors)

**Make It Concrete**
- Find a visual metaphor (abstract concept → familiar object)
- Example: "Growth" → plant growing, "Security" → shield/lock
- Keep metaphors simple and universal

**Visual Anchors**
- Every abstract concept needs a visual anchor (icon, shape, image)
- Don't rely on text alone
- Use consistent iconography style

**Relationships**
- Show how concepts connect (arrows, proximity, containers)
- Group related concepts visually
- Use color to categorize

**Animation**
- Build up concept piece by piece
- Reveal connections after establishing elements
- Use motion to reinforce meaning (growth = expanding, speed = fast motion)

### Text-Focused (Quotes, Key Points)

**Typography is Everything**
- Choose font weight to convey tone (bold = important, light = subtle)
- Use size hierarchy deliberately
- Limit to 2 font sizes per scene

**Emphasis**
- Highlight key words with color, underline, or size
- Don't highlight everything (defeats purpose)
- Maximum 3-5 words emphasized per scene

**Layout**
- Center alignment for short quotes
- Left alignment for longer text
- Generous line height (1.4-1.6x)

**Animation**
- Fade in full text, OR
- Word-by-word reveal for emphasis, OR
- Key words animate separately

**Common Mistakes to Avoid**
- ❌ Too much text (this is video, not a document)
- ❌ All text same size (no hierarchy)
- ❌ Text too close to edges (cramped feeling)
- ❌ Busy background behind text (readability)
