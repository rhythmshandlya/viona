import { buildReferenceExamplesSection } from './visual-references.js';

/**
 * Style guidelines with SPECIFIC design tokens.
 * Each style includes exact CSS values the AI should use.
 */
export const STYLE_GUIDELINES: Record<string, string> = {
  minimal: `
Style: Minimal (Clean & Professional)

**COLOR PALETTE:**
- Background: #1a1a1a (dark gray)
- Elements: #ffffff (white)
- Accent: #3b82f6 (blue)
- Muted: #6b7280

**DESIGN:**
- Clean geometric shapes, generous whitespace
- Monochrome diagrams with single accent color for highlights
- Thin lines, subtle shadows, elegant simplicity
- Icons: Line-style, single weight, consistent sizing

**ANIMATION:**
- Use spring({ damping: 20, stiffness: 60 }) - smooth, no bounce
- Stagger elements by 20 frames
- Fade in with interpolate over 20 frames
- Elements fade in smoothly, subtle position shifts`,

  modern: `
Style: Modern (Vibrant & Dynamic)

**COLOR PALETTE:**
- Background: #0f0f23 (deep navy/purple)
- Primary gradient: Purple #8b5cf6 to Blue #3b82f6
- Accent: Cyan #06b6d4
- Success: #22c55e
- White: #ffffff

**DESIGN:**
- Gradient-filled shapes, rounded corners on everything
- Vibrant colors that pop, glass morphism effects
- Icons: Filled style, colorful, modern flat design
- Colorful nodes, gradient connections, depth with shadows

**EFFECTS:**
- Glass cards: background blur, subtle borders
- Soft glows on key elements
- Gradient backgrounds

**LAYOUT (CRITICAL - avoid overlapping):**
- Stack elements vertically with clear separation
- Title/heading at TOP (first 15% of height)
- Main visual in MIDDLE (next 60% of height)
- Labels/captions at BOTTOM (last 25% of height)
- Use flexbox with RESPONSIVE gap: display: 'flex', flexDirection: 'column', gap: minDim * 0.03
- NEVER place text directly on top of diagrams

**ANIMATION:**
- Use spring({ damping: 12, stiffness: 80 }) - bouncy, satisfying
- Stagger elements by 15 frames
- Spring physics, elements bounce in, satisfying motion`,

  playful: `
Style: Playful (Fun & Energetic)

**COLOR PALETTE:**
- Background: #1a1a2e (dark purple)
- Primary: Orange #f97316
- Secondary: Yellow #eab308
- Accent: Pink #ec4899
- Success: Green #22c55e

**DESIGN:**
- Bright saturated colors, rounded bubbly shapes
- Hand-drawn style elements, imperfect circles, wobbly lines
- Icons: Emoji-style, illustrated, character-based
- Cartoon-like, characters pointing at things, fun illustrations

**ANIMATION:**
- Use spring({ damping: 8, stiffness: 200 }) - very bouncy with overshoot
- Add wiggle: rotation oscillates ±3 degrees
- Stagger by 10 frames for rapid fire effect
- Bouncy entrances, wiggle effects, playful transitions`,

  bold: `
Style: Bold (High Contrast & Impactful)

**COLOR PALETTE:**
- Background: #000000 (pure black)
- Primary: #ffffff (pure white)
- Accent: #ef4444 (red) or #eab308 (yellow)

**DESIGN:**
- Maximum contrast: black/white with ONE neon accent
- Large, chunky shapes that command attention
- Icons: Solid, heavy weight, impossible to miss
- Thick borders, heavy arrows, stark contrasts

**ANIMATION:**
- Use spring({ damping: 15, stiffness: 150 }) - snappy, powerful
- Scale from 0 to 1 for dramatic reveals
- Dramatic reveals, scale from zero, powerful presence`,

  classic: `
Style: Classic (Trustworthy & Educational)

**COLOR PALETTE:**
- Background: Navy #1e3a5f
- Primary: Gold #d4af37
- Text: Cream #f5f5dc
- Muted: Charcoal #374151

**DESIGN:**
- Traditional diagram layouts, clean data visualization
- Muted, professional color palette
- Icons: Traditional, professional, outline or subtle fill
- Academic charts, clean axes, proper labels, traditional graphs

**ANIMATION:**
- Use spring({ damping: 25, stiffness: 50 }) - dignified, no bounce
- Smooth fades over 30 frames
- Smooth fades, professional transitions, no gimmicks
- Understated motion, nothing flashy`,
};

interface TranscriptWord {
  text: string;
  startMs: number;
  endMs: number;
}

interface PromptOptions {
  transcript: TranscriptWord[];
  projectId: string;
  stylePreset: string;
  styleGuidelines: string;
  durationMs: number;
  fps: number;
  width: number;
  height: number;
  layoutMode: 'pip' | 'split-horizontal' | 'split-vertical';
}

export function buildGenerateVisualsPrompt(options: PromptOptions): string {
  const { transcript, projectId, stylePreset, styleGuidelines, durationMs, fps, width, height, layoutMode } = options;

  const transcriptText = formatTranscript(transcript);
  const durationInFrames = Math.ceil((durationMs / 1000) * fps);

  const layoutContext = layoutMode === 'pip'
    ? 'Full-screen visuals (1080×1920) - video overlaid as small PiP window. Use full vertical space.'
    : layoutMode === 'split-horizontal'
      ? `Top portion of 50/50 horizontal split (${width}×${height}) - REDUCED HEIGHT. Stack elements tightly, use smaller fonts.`
      : `Left portion of 50/50 vertical split (${width}×${height}) - REDUCED WIDTH. Avoid wide layouts, stack vertically.`;

  const referenceExamples = buildReferenceExamplesSection(projectId);

  return `You are a world-class Motion Graphics Designer creating animated visuals for viral social media content.

---

## ⛔ CRITICAL CONSTRAINTS (Read First!)

These rules are NON-NEGOTIABLE. Violating them causes runtime errors.

### 1. React key Prop (MANDATORY)
EVERY \`.map()\` call MUST have a \`key\` prop. Missing keys cause React errors.

\`\`\`tsx
// ✅ CORRECT
{items.map((item, i) => <div key={i}>{item}</div>)}
{steps.map((step, i) => <React.Fragment key={i}><Arrow /><Node /></React.Fragment>)}

// ❌ WRONG - Will cause errors
{items.map((item) => <div>{item}</div>)}
\`\`\`

### 2. Responsive Sizing for Layout Modes (MANDATORY)
Your visuals must adapt to different layout configurations:

| Layout Mode | Dimensions | Aspect Ratio | Constraint |
|-------------|------------|--------------|------------|
| **pip** | 1080×1920 | 9:16 portrait | Full screen - visuals behind PiP video |
| **split-horizontal** | 1080×960 (50%) | Wide/short | Top half only - less vertical space |
| **split-vertical** | 540×1920 (50%) | Narrow/tall | Left half only - less horizontal space |

**CRITICAL:** Hardcoded pixels will break across layout modes. Use relative sizing:

\`\`\`tsx
const { width, height, fps } = useVideoConfig();
const minDim = Math.min(width, height);

// ✅ CORRECT - Scales to any layout mode
fontSize: height * 0.035,      // Readable in split-horizontal (960px height)
padding: minDim * 0.05,        // Works in split-vertical (540px width)
borderRadius: minDim * 0.02,
gap: minDim * 0.03,

// ❌ WRONG - Breaks in split layouts
fontSize: 48,    // Too large for 960px height
padding: 60,     // Overflows 540px width
\`\`\`

### 3. Forbidden Patterns (Will Break Rendering)
- ❌ CSS transitions or @keyframes (Remotion renders frame-by-frame)
- ❌ setTimeout/setInterval (not frame-deterministic)
- ❌ useState for animation values (use \`useCurrentFrame()\` instead)
- ❌ Hardcoded pixel dimensions

### 4. Required Remotion Patterns
\`\`\`tsx
const frame = useCurrentFrame();
const { width, height, fps } = useVideoConfig();

// Animation: pure function of frame
const opacity = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: 'clamp' });
const scale = spring({ frame, fps, config: { damping: 12, stiffness: 80 } });
\`\`\`

---

## 🎯 YOUR TASK

**Transcript to Visualize:**
${transcriptText}

**Style: ${stylePreset}**
${styleGuidelines}

---

## 📐 Video Specifications

- **Resolution: ${width}x${height}** (${width < height ? 'VERTICAL/Portrait' : width > height ? 'HORIZONTAL/Landscape' : 'SQUARE'})
- **Duration:** ${durationMs}ms (${durationInFrames} frames at ${fps} FPS)
- **Layout:** ${layoutContext}
- **Composition ID:** \`${projectId}\`

Your composition MUST render at exactly ${width}x${height} pixels.

---

## 🎨 LAYOUT & ALIGNMENT (Critical for Visual Quality)

### ⚠️ MANDATORY: Use This Layout Structure
**Every composition MUST use this flexbox structure to prevent misalignment:**

\`\`\`tsx
const { width, height } = useVideoConfig();
const minDim = Math.min(width, height);

<AbsoluteFill style={{ background: '#0f0f23' }}>
  <div style={{
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    padding: minDim * 0.04,
    gap: minDim * 0.025,
    boxSizing: 'border-box',  // CRITICAL: Prevents overflow
  }}>
    {/* TITLE ZONE - Fixed height, always centered */}
    <div style={{
      flex: '0 0 auto',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: height * 0.08,
    }}>
      <h1 style={{
        fontSize: height * 0.04,
        textAlign: 'center',
        margin: 0,  // Remove default margins
      }}>Title Here</h1>
    </div>

    {/* VISUAL ZONE - Expands to fill, centers content */}
    <div style={{
      flex: 1,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',  // Prevent diagram overflow
    }}>
      {/* Diagram container - constrained size */}
      <div style={{
        maxWidth: '85%',
        maxHeight: '90%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}>
        {/* Your diagram/chart goes here */}
      </div>
    </div>

    {/* CAPTION ZONE - Fixed height (optional) */}
    <div style={{
      flex: '0 0 auto',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: height * 0.06,
    }}>
      <p style={{ fontSize: height * 0.022, textAlign: 'center', margin: 0 }}>Caption</p>
    </div>
  </div>
</AbsoluteFill>
\`\`\`

### Alignment Rules (STRICT)
| Element | Container Style | Content Style |
|---------|-----------------|---------------|
| Titles | \`display: 'flex', justifyContent: 'center', alignItems: 'center'\` | \`textAlign: 'center', margin: 0\` |
| Diagrams | \`flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center'\` | \`maxWidth: '85%', maxHeight: '90%'\` |
| Labels | Same as titles | \`fontSize: height * 0.022\` |
| Multi-element rows | \`display: 'flex', justifyContent: 'center', gap: minDim * 0.03\` | Each item centered |

### Common Alignment Mistakes
| ❌ Wrong | ✅ Correct |
|----------|-----------|
| \`position: 'absolute', top: 50\` | \`flex: 1, justifyContent: 'center'\` |
| Hardcoded margins | Flexbox gap |
| No container constraints | \`maxWidth: '85%'\` on diagrams |
| Missing \`boxSizing: 'border-box'\` | Always include on main container |

### Layout Mode Considerations
- **split-horizontal (1080×960):** Less vertical space - reduce title size, tighter gaps
- **split-vertical (540×1920):** Less horizontal space - stack elements vertically, avoid wide layouts
- **pip (1080×1920):** Full space - can use more elaborate layouts

---

**metadata.json:**
\`\`\`json
{ "compositionId": "${projectId}", "durationInFrames": ${durationInFrames}, "fps": ${fps}, "width": ${width}, "height": ${height} }
\`\`\`

---

## 🎬 ANIMATION PHILOSOPHY

You are creating **visual narratives**, not decorated slides.

### The Three Laws of Meaningful Animation:

**1. CONTINUOUS MOTION**
Every sequence must have animation throughout its duration, not just entrance effects.
- ❌ Elements spring in, then sit static
- ✅ Elements enter, then DEMONSTRATE, then transition

**2. CONCEPTUAL, NOT LITERAL**
Show WHY and HOW, not just WHAT.
- ❌ "Binary tree" → Draw a static tree diagram
- ✅ "Binary tree is slow here" → Show search path growing longer, O(n) counter climbing
- ❌ "Caching improves speed" → Show a cache icon
- ✅ "Caching improves speed" → Show request hitting cache (instant) vs database (long journey)

**3. ZERO TEXT OVERLAYS**
Subtitles handle all text. Your job is PURE VISUAL STORYTELLING.
- ❌ Animated text saying "Step 1: Configure"
- ✅ Visual metaphors that need no explanation
- Exception: Single numbers/percentages for data viz (e.g., "85%" in a progress ring)

### Rich Animation Techniques (NOT just fade-in!)

**Multi-phase animations** - Each element should have entrance → action → hold:
\`\`\`tsx
// Phase 1: Entrance (frames 0-30)
const entranceScale = spring({ frame, fps, config: { damping: 12 } });

// Phase 2: Action (frames 30-90) - the element DOES something
const actionProgress = interpolate(frame, [30, 90], [0, 1], { extrapolateRight: 'clamp' });
const rotation = Math.sin(actionProgress * Math.PI * 2) * 10; // Wobble
const pulseScale = 1 + Math.sin(actionProgress * Math.PI * 4) * 0.05; // Pulse

// Phase 3: Hold with subtle motion (frames 90+)
const breathe = 1 + Math.sin(frame * 0.1) * 0.02; // Subtle breathing
\`\`\`

**Layered motion** - Multiple properties animating at different rates:
\`\`\`tsx
const opacity = interpolate(frame, [0, 20], [0, 1]);
const y = interpolate(frame, [0, 40], [50, 0], { extrapolateRight: 'clamp' });
const scale = spring({ frame: frame - 10, fps, config: { damping: 8 } }); // Delayed
const rotation = interpolate(frame, [0, 60], [-5, 0]); // Slower
\`\`\`

**State transitions** - Elements change appearance over time:
\`\`\`tsx
const progress = interpolate(frame, [startFrame, endFrame], [0, 1]);
const color = progress < 0.5 ? '#3b82f6' : '#22c55e'; // Blue → Green
const size = interpolate(progress, [0, 0.5, 1], [1, 1.2, 1]); // Grow then shrink
\`\`\`

---

## 📋 SCENE PLANNING WITH TIMESTAMP SYNC (REQUIRED FIRST STEP)

Before writing ANY code, analyze the transcript and output a scene plan.

**⚠️ CRITICAL: Visuals MUST match transcript timestamps exactly!**

\`\`\`json
{
  "scenes": [
    {
      "timestamp": "0:00 - 0:08",
      "frameRange": [0, 240],
      "transcript": "Exact words being spoken",
      "reasoning": {
        "whatIsBeingExplained": "The core concept",
        "whyNotLiteral": "Why a literal depiction would fail",
        "whatWouldMakeItClick": "The aha moment visual",
        "howAnimationAddsUnderstanding": "What motion communicates"
      },
      "decision": {
        "visualMetaphor": "The chosen representation",
        "animationNarrative": "Beat-by-beat motion description",
        "keyframes": ["start state", "middle state", "end state"]
      }
    }
  ]
}
\`\`\`

### Timestamp Synchronization Rules
1. **Calculate frame ranges:** \`startFrame = (startMs / 1000) * fps\`, \`endFrame = (endMs / 1000) * fps\`
2. **Each scene's animation MUST start and end within its frame range**
3. **Use \`<Sequence from={startFrame} durationInFrames={duration}>\`** to enforce timing
4. **Verify with stills:** Check frames at 0%, 25%, 50%, 75%, 100% of each scene

**Reasoning Quality Checklist:**
- [ ] Frame ranges calculated from transcript timestamps
- [ ] "whyNotLiteral" identifies specific failure of obvious approach
- [ ] "whatWouldMakeItClick" describes an insight, not just a visual
- [ ] "howAnimationAddsUnderstanding" explains what MOTION contributes
- [ ] Animation narrative has multiple beats (not just "elements appear")

---

## 📁 Project Structure

Write files ONLY in \`src/${projectId}/\`:

\`\`\`
src/${projectId}/
├── index.tsx          # Main composition (export as ${projectId})
├── constants.ts       # COLORS, TIMING, FONTS
├── metadata.json      # Composition metadata
└── components/        # Reusable visual components
\`\`\`

---

## 🎬 WHAT TO VISUALIZE

| Transcript Content | Visual to Create |
|-------------------|------------------|
| Steps/Process | Animated flowchart, nodes appear sequentially |
| Statistics/Numbers | Animated bar chart, counters, progress rings |
| Comparisons | Side-by-side graphics, VS animations |
| Concepts/Frameworks | Diagrams, mind maps, Venn diagrams |
| Hierarchies | Org charts, tree structures |
| Relationships | Connection lines animating between nodes |

**IMPORTANT:** Don't just put text on screen. CREATE A VISUAL REPRESENTATION.

---

${referenceExamples}

---

## ✅ SELF-HEALING WORKFLOW

1. After writing each file, run \`TypeScriptValidatorTool\`
2. If ANY errors, fix them IMMEDIATELY
3. Repeat until ZERO TypeScript errors
4. **Render stills at multiple frames to verify:**
   - \`--frame=0\` (start) - Check initial state
   - \`--frame=${Math.floor(durationInFrames * 0.25)}\` (25%) - Check first scene
   - \`--frame=${Math.floor(durationInFrames * 0.5)}\` (50%) - Check mid-point
   - \`--frame=${Math.floor(durationInFrames * 0.75)}\` (75%) - Check later scenes
   - \`--frame=${durationInFrames - 1}\` (end) - Check final state

5. **Verify alignment in each still:**
   - [ ] Title centered horizontally
   - [ ] Diagram centered in visual zone
   - [ ] No elements overlapping
   - [ ] No elements cut off at edges
   - [ ] Consistent spacing throughout

6. **Verify timestamp sync:**
   - [ ] Scene content matches transcript at that frame
   - [ ] Animations active during their designated scenes
   - [ ] No static periods during active scenes

---

Now analyze the transcript and create visually stunning Remotion components.
`;
}

function formatTranscript(words: TranscriptWord[]): string {
  if (!words || words.length === 0) {
    return 'No transcript available.';
  }

  const segments: Array<{ startMs: number; endMs: number; text: string }> = [];
  let currentSegment: TranscriptWord[] = [];
  let segmentStartMs = 0;

  for (const word of words) {
    if (currentSegment.length === 0) {
      segmentStartMs = word.startMs;
    }

    currentSegment.push(word);

    const text = word.text.trim();
    const isEndOfSentence = /[.!?]$/.test(text);
    const segmentDuration = word.endMs - segmentStartMs;

    if (isEndOfSentence || segmentDuration > 5000) {
      segments.push({
        startMs: segmentStartMs,
        endMs: word.endMs,
        text: currentSegment.map(w => w.text).join(' '),
      });
      currentSegment = [];
    }
  }

  if (currentSegment.length > 0) {
    segments.push({
      startMs: segmentStartMs,
      endMs: currentSegment[currentSegment.length - 1].endMs,
      text: currentSegment.map(w => w.text).join(' '),
    });
  }

  return segments
    .map(s => `[${formatTime(s.startMs)} - ${formatTime(s.endMs)}] ${s.text}`)
    .join('\n');
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
