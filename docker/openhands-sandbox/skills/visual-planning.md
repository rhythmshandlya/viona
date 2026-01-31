# Visual Planning Process

## CRITICAL: Two-Phase Workflow

This is a **TWO-PHASE** process. You MUST complete Phase 1 entirely before starting Phase 2.

```
┌─────────────────────────────────────────────────────────────┐
│  PHASE 1: PLANNING (Read-Only)                              │
│  - Analyze the content                                       │
│  - Design the visual approach                                │
│  - Output complete plan                                      │
│  - NO CODE WRITING IN THIS PHASE                            │
├─────────────────────────────────────────────────────────────┤
│  CHECKPOINT: Verify plan completeness                        │
├─────────────────────────────────────────────────────────────┤
│  PHASE 2: EXECUTION                                          │
│  - Implement exactly what was planned                        │
│  - Reference plan while coding                               │
└─────────────────────────────────────────────────────────────┘
```

**VIOLATION WARNING:** If you write ANY code before completing the plan output, you WILL produce poor quality visuals with missing elements (like trees without edges, charts without labels).

---

# PHASE 1: PLANNING

## Step 1: Content Category Detection

Identify the content type. This determines which rules apply.

| Category | Examples | Primary Challenge |
|----------|----------|-------------------|
| **Structural** | Trees, graphs, hierarchies, org charts, networks, relationships | Showing connections/edges clearly |
| **Quantitative** | Numbers, charts, metrics, comparisons, trends, finance, statistics | Making data readable and impactful |
| **Sequential** | Processes, timelines, steps, flows, algorithms, instructions | Showing order and progression |
| **Conceptual** | Abstract ideas, metaphors, explanations, comparisons of ideas | Making intangible things tangible |
| **Text-focused** | Quotes, key points, callouts, titles, announcements | Typography and emphasis |

**Output format:**
```
CATEGORY: [Structural|Quantitative|Sequential|Conceptual|Text-focused]
REASON: [One sentence explaining why this category]
```

---

## Step 2: Content Analysis

Answer these questions explicitly:

### 2.1 Core Message
**What is the single most important thing the viewer should understand?**
- Must be answerable in ONE sentence
- If you need more than one sentence, you're trying to show too much

### 2.2 Key Elements
**What are the 2-4 elements that MUST appear?**
- List each element explicitly
- If more than 4, consider splitting into multiple scenes

### 2.3 Relationships
**What relationships exist between elements?**
- Parent-child? (A contains B)
- Sequential? (A then B)
- Comparative? (A vs B)
- Cause-effect? (A causes B)
- **These relationships MUST be visualized with lines/arrows/connections**

**Output format:**
```
CORE MESSAGE: [One sentence]

KEY ELEMENTS:
1. [Element name]: [Description]
2. [Element name]: [Description]
3. [Element name]: [Description]
4. [Element name]: [Description]

RELATIONSHIPS:
- [Element A] → [Element B]: [Relationship type]
- [Element B] → [Element C]: [Relationship type]
```

---

## Step 3: Visual Inventory (CRITICAL)

**You must list EVERY visual element before writing code.**

This is where most failures happen. If you don't list it here, you WILL forget to implement it.

### For ALL content types:
```
VISUAL INVENTORY:

Shapes/Objects:
- [ ] [Name]: [Description] at [position] sized [W]x[H]px
- [ ] [Name]: [Description] at [position] sized [W]x[H]px

Connections/Lines (IF ANY RELATIONSHIPS EXIST):
- [ ] Line from [A] to [B]: [style: solid/dashed] [color] [thickness]px
- [ ] Arrow from [X] to [Y]: [style] [color]

Text Labels:
- [ ] "[Text]" at [position]: [size]px [weight]
- [ ] "[Text]" at [position]: [size]px [weight]

Background:
- [ ] [Description of background]
```

### Category-Specific Inventory Requirements:

**STRUCTURAL (Trees, Graphs):**
- Count nodes: "N nodes total"
- Count edges: "E edges total"
- List EVERY edge: "root→left, root→right, left→leftChild, ..."
- **If nodes > edges+1 for a tree, you're missing edges!**

**QUANTITATIVE (Charts, Numbers):**
- List the actual data values
- Identify the "hero number" (largest visual emphasis)
- List all axis labels, legends, units

**SEQUENTIAL (Processes, Steps):**
- Number each step
- List connecting arrows between steps
- Identify visual state changes (current vs completed vs future)

---

## Step 3.5: Animation Inventory (MANDATORY)

**Every element MUST have a specified animation. Simple fades are REJECTED.**

Refer to the `motion-graphics` skill for animation techniques.

### Animation Requirements:

```
ANIMATION INVENTORY:

Background Animation:
- Type: [particles | gradient-shift | waves | grid-pulse | orbiting]
- Intensity: [subtle | medium | prominent]
- Motion: [description of continuous movement]

Element Animations:
┌─────────────────────────────────────────────────────────────────┐
│ Element: [Name]                                                  │
│ ├── Entrance: [scale | slide | draw | blur-focus | counter]     │
│ │   ├── Movement: [from-bottom | from-left | scale-up | etc]   │
│ │   ├── Duration: [X] frames                                    │
│ │   └── Easing: spring(damping: X, stiffness: Y) or bezier     │
│ ├── On-screen: [breathing | glow-pulse | static]                │
│ └── Exit (if any): [zoom-out | slide-out | fade]               │
└─────────────────────────────────────────────────────────────────┘

[Repeat for each element in Visual Inventory]
```

### Validation Rules:

❌ **REJECT** if any element entrance is only "fade in" or "opacity 0→1"
❌ **REJECT** if background has no animation (static solid color)
❌ **REJECT** if numbers appear instantly (must use counter tick-up)
❌ **REJECT** if all elements animate at the same time (no stagger)

✅ **REQUIRE** at least one "hero" animation (complex, attention-grabbing)
✅ **REQUIRE** background with continuous subtle motion
✅ **REQUIRE** staggered timing (primary → secondary → labels)
✅ **REQUIRE** spring() or easing for all movements (no linear)

### Example Animation Inventory:

```
ANIMATION INVENTORY:

Background Animation:
- Type: floating particles + gradient-shift
- Intensity: subtle
- Motion: 20 particles drift and pulse, gradient hue shifts 20° over duration

Element Animations:

Element: Hero Number ($1.2M)
├── Entrance: counter tick-up + scale
│   ├── Movement: counts from 0, scales from 0.8 to 1
│   ├── Duration: 45 frames
│   └── Easing: spring(damping: 50, stiffness: 100)
├── On-screen: glow-pulse
└── Exit: none (holds)

Element: Chart Bars (4 bars)
├── Entrance: slide + scale
│   ├── Movement: slide from bottom, grow to target height
│   ├── Duration: 20 frames each, staggered by 5 frames
│   └── Easing: spring(damping: 12, stiffness: 200)
├── On-screen: subtle breathing
└── Exit: none

Element: Labels
├── Entrance: slide
│   ├── Movement: slide from bottom 30px
│   ├── Duration: 12 frames
│   └── Easing: spring(damping: 15, stiffness: 150)
├── On-screen: static
└── Exit: none
```

---

## Step 4: Layout Planning

Divide the 1920x1080 canvas into zones:

```
┌─────────────────────────────────────────────────────────────────┐
│                        SAFE ZONE (80px padding)                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    TOP ZONE (~15%)                         │  │
│  │                 Titles, headers, context                   │  │
│  ├───────────────────────────────────────────────────────────┤  │
│  │                                                            │  │
│  │                    CENTER ZONE (~55%)                      │  │
│  │                    Main visual content                     │  │
│  │                                                            │  │
│  ├───────────────────────────────────────────────────────────┤  │
│  │                    BOTTOM ZONE (~30%)                      │  │
│  │              Labels, legends, progress bars                │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

**Output format:**
```
LAYOUT:
- Canvas: 1920x1080
- Safe padding: 80px all sides
- Usable area: 1760x920

Zone assignments:
- TOP (y: 80-240): [What goes here]
- CENTER (y: 240-700): [What goes here]
- BOTTOM (y: 700-1000): [What goes here]

Focal point: [x, y coordinates]
Visual flow: [Left→Right | Top→Down | Center→Out]
Whitespace target: [30-40%]
```

---

## Step 5: Animation Timeline

Plan the animation sequence with specific frame ranges.
Assume 30fps unless specified otherwise.

**Output format:**
```
ANIMATION TIMELINE (30fps, [total]s = [total frames] frames):

Frame 0-15 (0.0-0.5s): [Background/setup]
Frame 15-45 (0.5-1.5s): [Primary element] - [animation type]
Frame 45-75 (1.5-2.5s): [Connections/edges] - [animation type]
Frame 75-105 (2.5-3.5s): [Secondary elements] - [animation type]
Frame 105-135 (3.5-4.5s): [Labels/text] - [animation type]
Frame 135+: Hold for viewer absorption
```

**Animation Rules:**
- One element at a time (max 2 simultaneous)
- 300-500ms (10-15 frames) per element entrance
- 200-300ms (6-10 frames) pause between animations
- Structure → Connections → Labels → Decorations

---

## CHECKPOINT: Plan Validation

Before proceeding to Phase 2, verify your plan:

```
PLAN VALIDATION CHECKLIST:

Content & Structure:
[ ] Category identified with reason
[ ] Core message is ONE sentence
[ ] Key elements listed (2-4 items)
[ ] ALL relationships have corresponding connections in inventory
[ ] Visual inventory lists EVERY shape, line, and label
[ ] For Structural: edge count matches relationship count

Layout:
[ ] Layout zones assigned with pixel coordinates
[ ] Animation timeline covers all inventory items
[ ] Total animation time fits within duration

Animation (CRITICAL - Instagram-worthy quality):
[ ] Background has continuous motion (NOT static)
[ ] NO element uses fade-only entrance
[ ] Every element has movement (scale, slide, draw, or blur)
[ ] Numbers use counter tick-up (NOT instant appear)
[ ] Animations are staggered (NOT all at once)
[ ] Using spring() or easing (NOT linear interpolation)
[ ] At least one "hero" animation that grabs attention
```

**If any checkbox is unchecked, go back and complete it before proceeding.**

---

# PHASE 2: EXECUTION

Now implement the code. Reference your plan continuously.

## Implementation Order

1. **Set up component structure** - Create the React component with AbsoluteFill
2. **Implement background** - First visual layer
3. **Implement shapes/objects** - All nodes, shapes, containers
4. **Implement connections** - ALL edges, lines, arrows (check inventory!)
5. **Implement labels** - Text elements
6. **Implement animations** - Add spring/interpolate to each element
7. **Verify against inventory** - Check off each item

## Code Structure Template

```tsx
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';

export const [ComponentName]: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Animation timing (from your timeline)
  const phase1Start = 0;
  const phase2Start = 15;
  // ... etc

  return (
    <AbsoluteFill style={{ /* background */ }}>
      {/* 1. Background layer */}

      {/* 2. Shapes/objects from inventory */}

      {/* 3. Connections/edges from inventory - DON'T SKIP! */}

      {/* 4. Labels from inventory */}
    </AbsoluteFill>
  );
};
```

## Post-Implementation Verification

After writing code, verify:
- [ ] Every inventory item is implemented
- [ ] Every relationship has a visible connection
- [ ] Animations follow the timeline
- [ ] Safe padding (80px) is respected
- [ ] Text is at least 24px

---

# Design Rules Reference

## Universal Rules

### Layout
- **Edge padding:** 80px minimum from all edges
- **Content fill:** Never exceed 70% of screen area
- **Spacing:** Pick one value (40px, 60px, or 80px) and use consistently
- **Focal point:** Center or upper-third of screen

### Typography
| Type | Size | Weight |
|------|------|--------|
| Title | 64-96px | Bold |
| Heading | 48-64px | Semibold |
| Body | 32-40px | Regular |
| Caption/Label | 24-32px | Regular/Light |
| **Minimum** | 24px | - |

### Animation Timing
| Element | Duration | Notes |
|---------|----------|-------|
| Element entrance | 300-500ms (10-15f) | Use spring() for organic |
| Pause between | 200-300ms (6-10f) | Let viewer process |
| Connection draw | 400-600ms (12-18f) | Slightly longer than nodes |

### Color
- Maximum 3-4 colors per scene
- Semantic: Green=positive, Red=negative (when contextually appropriate)
- Text contrast: Minimum 4.5:1 ratio against background

---

## Category-Specific Rules

### Structural (Trees, Graphs, Hierarchies)

**CONNECTIONS ARE MANDATORY - NOT OPTIONAL**

| Rule | Specification |
|------|---------------|
| Edge thickness | 2-4px |
| Edge opacity | 0.6-0.8 (slightly transparent) |
| Edge endpoints | Connect TO the node center, not near it |
| Level spacing | 120-150px vertical |
| Sibling spacing | 80-120px horizontal |
| Parent position | Centered above children |

**Animation Order:**
1. Root/parent node appears
2. Edge draws from parent toward child
3. Child node appears as edge reaches it
4. Repeat for next level
5. Labels appear last

**Common Failures:**
- Nodes without edges (floating boxes)
- Edges not touching nodes (disconnected look)
- Inconsistent level heights
- All nodes appearing simultaneously

### Quantitative (Numbers, Charts, Finance)

**Hero Number Treatment:**
- ONE number gets primary emphasis
- 2-3x larger than other numbers
- Animate counting up (not instant appear)
- Optional: subtle glow or color accent

**Chart Requirements:**
- Always include axis labels
- Animate growth (bars grow up, lines draw)
- Consistent bar widths
- Highlight key data point

**Common Failures:**
- Numbers too small to read quickly
- Charts without axis labels
- Inconsistent scales in comparisons
- Too many data points (simplify!)

### Sequential (Processes, Steps, Flows)

**Flow Direction:**
- Horizontal: left → right (most common)
- Vertical: top → down (hierarchical)
- Be consistent within scene

**Step Indicators:**
- Number each step (1, 2, 3)
- Connect with arrows/lines
- Equal spacing

**Progress States:**
- Current: Bright, larger, or glowing
- Completed: Slightly dimmed
- Future: Grayed out

**Animation:**
- Steps appear one at a time
- Arrow draws before next step appears
- Current step pulses or glows

### Conceptual (Abstract Ideas)

**Make Abstract Concrete:**
- Map to visual metaphor (Growth → plant, Security → shield)
- Keep metaphors simple and universal
- Every concept needs a visual anchor (icon, shape)

**Show Relationships:**
- Use arrows, proximity, or containers
- Group related concepts
- Color-code categories

### Text-Focused (Quotes, Key Points)

**Typography:**
- Max 2 font sizes per scene
- Bold = important, Light = subtle
- Center short text, left-align longer text
- Line height: 1.4-1.6x

**Emphasis:**
- Highlight 3-5 key words max
- Use color, size, or underline
- Don't highlight everything

**Common Failures:**
- Too much text
- All text same size
- Text too close to edges
- Busy background hurting readability
