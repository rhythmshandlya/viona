import { buildReferenceExamplesSection } from './visual-references.js';
import { AD_MOTION_UTILITIES } from './motion-utilities.js';

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
- Main visual in MIDDLE (next 70% of height)
- Keep bottom 15% CLEAR for subtitle overlay (rendered separately)
- Use flexbox with RESPONSIVE gap: display: 'flex', flexDirection: 'column', gap: minDim * 0.03
- NEVER place text directly on top of diagrams
- NEVER add captions or subtitle text — subtitles are handled by a separate system

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

  apple: `
Style: Apple (Premium Minimalism)

**COLOR PALETTE:**
- Background: #000000 (pure black) or #ffffff (pure white)
- Accent: #0071e3 (Apple blue)
- Text: #f5f5f7 (on dark) or #1d1d1f (on light)
- No gradients — flat, clean surfaces

**DESIGN:**
- Extreme minimalism, maximum whitespace
- One focal element at a time
- Typography-driven: product name + one line of copy
- No borders, no shadows, no ornaments
- Max 3 visible elements at any moment

**ANIMATION:**
- Use spring({ damping: 30, stiffness: 40 }) - slow, deliberate, premium
- Stagger elements by 30 frames (one second apart)
- Fade + blur transitions: opacity 0→1 with filter blur(4px→0)
- Scale 0.95→1.0 (subtle settle, never overshoot)
- Hold each element for at least 60 frames before transitioning
- Movement should feel like breathing — unhurried, confident`,

  studio: `
Style: Studio (Polished Card Animations)

**DESIGN SYSTEM — DotGrid Theme:**
This style has a complete template library. When possible, USE EXISTING TEMPLATES as building blocks (see template catalog below). Copy their code into the workspace, customize props, and compose them into scenes.

**DESIGN:**
- Polished card-based layouts floating on dot-grid backgrounds
- Centered content containers with generous padding and rounded corners
- Dark/light mode support with consistent color tokens
- Clean typography hierarchy using Google Font pairs

**COLOR PALETTE:**
- Dark mode: Background #0B0F1A, text #FFFFFF, muted #94A3B8, grid #FFFFFF08
- Light mode: Background #F8FAFC, text #0F172A, muted #64748B, grid #0F172A08
- Accent: Indigo #6366F1 (primary), customizable per-scene

**BACKGROUND:**
Every scene MUST include a DotGrid SVG background layer:
\`\`\`tsx
<svg style={{ position: 'absolute', inset: 0 }} width="100%" height="100%">
  <pattern id="dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
    <circle cx="2" cy="2" r="1" fill={gridColor} />
  </pattern>
  <rect width="100%" height="100%" fill={bg} />
  <rect width="100%" height="100%" fill="url(#dots)" />
</svg>
\`\`\`

**TYPOGRAPHY (FONT_PAIRS):**
Use Google Fonts pairs. Default: boldImpact (Oswald + Inter).
Available: modernTech (Space Grotesk + IBM Plex Mono), friendlyTech (Nunito + Source Code Pro), strongReadable (Bebas Neue + Open Sans), elegantEditorial (Cormorant Garamond + Lato), cleanMinimal (Plus Jakarta Sans + JetBrains Mono).

**CARD LAYOUT:**
Scenes use centered card containers with rounded corners (borderRadius: 20px), padding: 48px, maxWidth: 85%. Cards float on the dot-grid background.

**ANIMATION:**
- Use spring({ damping: 14, stiffness: 80 }) for card entrances
- Stagger elements by 8-12 frames
- Standard timeline: fade-in (0-15 frames), content animate (20-260), hold (280-330), fade-out (330-360)
- Progress bars, counters, charts use smooth interpolate over 100+ frames

**MANDATORY: { extrapolateRight: 'clamp' } on ALL interpolate calls**
`,

  google: `
Style: Google (Material Design 3)

**COLOR PALETTE:**
- Background: #ffffff or #f8f9fa (light gray)
- Primary: #1a73e8 (Google Blue)
- Secondary: #34a853 (Google Green)
- Tertiary: #ea4335 (Google Red)
- Accent: #fbbc04 (Google Yellow)
- Text: #202124 (dark gray)

**DESIGN:**
- Material Design 3 principles: card-based, elevation shadows
- Rounded corners (28px on cards, pill-shaped buttons)
- Colorful but balanced — use Google's 4-color palette purposefully
- Elevation: cards float with box-shadow 0 2px 8px rgba(0,0,0,0.1)
- Clean iconography, product-grade UI elements

**ANIMATION:**
- Use spring({ damping: 18, stiffness: 100 }) - snappy, responsive, Material motion
- Stagger elements by 12 frames (fast, cascading)
- Slide-up motion: translateY(16→0) with fade
- Cards rise into view with subtle shadow growth
- Emphasize spatial relationships — elements come from where they "live"`,
};

/**
 * AutoAE-inspired scene composition patterns.
 * Teaches the AI about motion graphics templates for different content types.
 */
const AUTOAE_SCENE_PATTERNS = `
## 🎬 SCENE COMPOSITION PATTERNS (AutoAE-Inspired)

Use these composition templates when the transcript content matches. These are proven motion graphics patterns that create professional, engaging visuals.

### 1. Versus Comparison
**When:** Speaker compares two options, approaches, or technologies ("X vs Y", "unlike", "compared to")
- Split screen with two sides, each with an icon/visual + label
- Dramatic divider line between sides (animated, glowing)
- Staggered reveal: left side appears, then divider, then right side
- Use contrasting accent colors (e.g., blue vs red)
- Optional: one side pulses/scales slightly to indicate the "winner"

### 2. Podium Ranking
**When:** Speaker ranks items, lists "top 3", or establishes a hierarchy
- Three pedestals at different heights (1st tallest, centered)
- Items reveal from 3rd → 2nd → 1st with spring physics
- Each podium slot has an icon + label + optional number
- Gold/silver/bronze accent colors for ranking emphasis
- Final state: all three visible with the winner highlighted

### 3. Hub & Orbit
**When:** Speaker describes a central concept with related features/properties ("X has these benefits", "core principle with...")
- Central element (larger, glowing) with orbiting satellite elements
- Satellites appear one by one, each with a connection line to hub
- Gentle rotation animation for the orbit ring
- Use for: frameworks, architectures, ecosystems, feature sets

### 4. Card Flip Reveal
**When:** Speaker reveals information, answers a question, or does a "before/after" ("the answer is...", "turns out...")
- Card element that rotates 180° on Y-axis to reveal back side
- Front shows question/teaser, back shows answer/solution
- Use perspective transform for 3D depth
- Pause briefly before flip for dramatic tension

### 5. Process Steps
**When:** Speaker walks through a sequence ("first... then... finally", step-by-step instructions)
- Horizontal or vertical step chain with numbered nodes
- Each step appears with a connecting arrow/line animation
- Active step is highlighted, previous steps are dimmed
- Progress bar or connecting line fills between steps
- Use warm transition effects between step reveals

### 6. Spotlight Feature
**When:** Speaker highlights a single important item/feature/concept
- Dark background with a single illuminated element
- Radial gradient "spotlight" that draws attention to center
- Element scales up slightly with a subtle glow
- Supporting details fade in around the spotlight area
- Use for: key stats, hero features, important takeaways

### 7. Graph Draw
**When:** Speaker mentions data, growth, trends, metrics
- Animated line graph or bar chart that draws progressively
- Axis labels and values animate in sync with the drawing
- Key data points get a pulse/glow when reached
- Use smooth interpolation for the drawing animation
- Optional: counter that shows current value as line progresses

### 8. Speech Bubble
**When:** Speaker quotes someone, presents dialogue, or shows audience reactions
- Rounded bubble frame with a tail pointing to source
- Text types in or fades in within the bubble
- Multiple bubbles can stack in a conversation flow
- Bubbles can have different colors for different speakers
- Use spring physics for bubble entrance (scale from 0)
`;

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
  layoutMode: 'pip' | 'stacked';
}

export function buildGenerateVisualsPrompt(options: PromptOptions): string {
  const { transcript, projectId, stylePreset, styleGuidelines, durationMs, fps, width, height, layoutMode } = options;

  const transcriptText = formatTranscript(transcript);
  const durationInFrames = Math.ceil((durationMs / 1000) * fps);

  const layoutContext = layoutMode === 'pip'
    ? 'Full-screen visuals (1080×1920) - video overlaid as small PiP window. Use full vertical space.'
    : `Stacked layout (${width}×${height}) - REDUCED HEIGHT. Stack elements tightly, use smaller fonts.`;

  const referenceExamples = buildReferenceExamplesSection(projectId);
  const adMotionSection = (stylePreset === 'apple' || stylePreset === 'google') ? `\n\n${AD_MOTION_UTILITIES}\n` : '';

  return `You are a world-class Motion Graphics Designer creating animated visuals for viral social media content.

## 📱 PLATFORM CONTEXT

**This is for Instagram Reels / TikTok / YouTube Shorts.**

You're creating visuals using **Remotion** (React-based video framework) that will be rendered and played on mobile devices. The visuals accompany spoken educational content (tutorials, explainers, tech breakdowns).

**What works on short-form:**
- Clean, bold visuals that read on small screens
- Fast enough to hold attention, slow enough to understand
- Visual explanations that ADD to speech (not duplicate it)
- Professional aesthetic that builds creator credibility

**What fails on short-form:**
- Tiny text or complex diagrams (can't read on phone)
- Slow, boring corporate animations
- Visuals that just repeat what's being said
- Cluttered screens with too many elements

**Your role:** Create the visual layer that makes educational content WATCHABLE and SHAREABLE. The speech provides information; your visuals provide understanding.

---

## 🚫 PURE VISUAL STORYTELLING — NO TEXT OVERLAYS

**Subtitles/captions are handled by a SEPARATE subtitle system that renders on top of your visuals.** Your animations must NEVER include:
- Captions, subtitles, or any text that duplicates what the speaker is saying
- "Caption zones" or bottom-of-screen text that mirrors the transcript
- Title cards with the spoken words written out
- Any text element whose purpose is to show what's being said

**What IS allowed:**
- Short labels on diagram elements (e.g., "Queue", "Server", "O(log n)")
- Data values inside visualizations (e.g., numbers in nodes, axis labels on charts)
- Concept names as part of the visual (e.g., "Priority Queue" as a heading on a diagram)

**The rule:** If removing the text would make the VISUAL less understandable, keep it. If the text just repeats what the viewer will hear, DELETE it. Subtitles handle all text the speaker says — your job is to create stunning VISUAL explanations.

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
| **stacked** | 1080×960 (50%) | Wide/short | Top half only - less vertical space |

**CRITICAL:** Hardcoded pixels will break across layout modes. Use relative sizing:

\`\`\`tsx
const { width, height, fps } = useVideoConfig();
const minDim = Math.min(width, height);
const frame = useCurrentFrame();

// ✅ CORRECT - Every value is relative AND all variables are used
const titleOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
const titleY = interpolate(frame, [0, 30], [-20, 0], { extrapolateRight: 'clamp' });
const contentScale = spring({ frame: frame - 15, fps, config: { damping: 12, stiffness: 80 } });

<div style={{
  fontSize: height * 0.035,      // ← uses height
  padding: minDim * 0.05,        // ← uses minDim
  borderRadius: minDim * 0.02,   // ← uses minDim
  gap: minDim * 0.03,            // ← uses minDim
  opacity: titleOpacity,         // ← uses titleOpacity (interpolate result)
  transform: \`translateY(\${titleY}px) scale(\${contentScale})\`,  // ← uses titleY, contentScale
}}>...</div>

// ❌ WRONG - Hardcoded values AND unused declarations
const minDim = Math.min(width, height);  // Declared but never used!
const titleOpacity = interpolate(...);    // Declared but never used!
fontSize: 48,    // Hardcoded - breaks in split layouts
padding: 60,     // Hardcoded - overflows 540px width
\`\`\`

**Sizing Reference (all relative to dimensions):**
| Element | Formula | Example (1080×1920) |
|---------|---------|---------------------|
| Title font | \`height * 0.04\` | ~77px |
| Body font | \`height * 0.025\` | ~48px |
| Small text | \`height * 0.018\` | ~35px |
| Main padding | \`minDim * 0.05\` | ~54px |
| Gap between | \`minDim * 0.03\` | ~32px |
| Border radius | \`minDim * 0.02\` | ~22px |
| Icon size | \`minDim * 0.08\` | ~86px |

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

### 5. NO UNUSED DECLARATIONS (TypeScript Strict Mode)
**Every variable you declare MUST be used.** Unused declarations cause TS6133 errors.

## ⚠️ CRITICAL: When you get TS6133 "declared but never read" errors:
**→ USE THE VARIABLE, don't delete it!**

The variable was declared for a reason. Find where it should be used and USE IT.

\`\`\`tsx
// ❌ WRONG PATTERN - Declare animation vars, then don't use them
const rotationInner = interpolate(frame, [0, 60], [0, 360]);
const springScale = spring({ frame, fps, config: { damping: 12 } });
const yPos = interpolate(frame, [0, 30], [100, 0]);
// Then render with HARDCODED or DIFFERENT values:
<div style={{ transform: 'rotate(45deg) scale(1)', top: 50 }}>  // ← WRONG! Use the vars!

// ✅ CORRECT PATTERN - Declare and USE in the same component
const rotationInner = interpolate(frame, [0, 60], [0, 360]);
const springScale = spring({ frame, fps, config: { damping: 12 } });
const yPos = interpolate(frame, [0, 30], [100, 0]);
<div style={{
  transform: \`rotate(\${rotationInner}deg) scale(\${springScale})\`,  // ← USES rotationInner, springScale
  top: yPos,  // ← USES yPos
}}>
\`\`\`

## The Pattern: DECLARE → IMMEDIATELY USE
\`\`\`tsx
// Step 1: Declare responsive sizes
const { width, height, fps } = useVideoConfig();
const minDim = Math.min(width, height);
const frame = useCurrentFrame();

// Step 2: Declare animations (only what you'll use!)
const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
const scale = spring({ frame, fps, config: { damping: 12 } });

// Step 3: USE EVERYTHING in the render
<div style={{
  fontSize: height * 0.035,     // ← uses height
  padding: minDim * 0.04,       // ← uses minDim
  opacity,                      // ← uses opacity
  transform: \`scale(\${scale})\`, // ← uses scale (which used frame, fps)
}}>
\`\`\`

**If you won't use a variable, DON'T DECLARE IT in the first place.**

---

## 🎯 YOUR TASK

**Transcript to Visualize:**
${transcriptText}

**Style: ${stylePreset}**
${styleGuidelines}
${adMotionSection}
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
    {/* TITLE ZONE — For intro/hook scenes, the title should START large and centered
        (filling the visual zone) then animate to this fixed position when content appears.
        See "Title Fill Pattern" in animation patterns. */}
    {/* TITLE ZONE - Fixed height, always centered */}
    <div data-element-name="title" style={{
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
    <div data-element-name="visual" style={{
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

    {/* NO CAPTION ZONE — subtitles are rendered by a separate system */}
    {/* Leave bottom ~15% of canvas clear for subtitle overlay */}
  </div>
</AbsoluteFill>
\`\`\`

### 🏷️ MANDATORY: data-element-name Attributes
Every distinct visual element (title, diagram, icon group, label, sidebar, etc.) MUST include a \`data-element-name\` attribute on its outermost wrapper. This enables the editor to highlight selected elements.

\`\`\`tsx
// ✅ CORRECT — each zone/element is tagged
<div data-element-name="title" style={{...}}>Title</div>
<div data-element-name="diagram" style={{...}}>Chart content</div>
<div data-element-name="icon-group" style={{...}}>Icons</div>

// ✅ For mapped items, use semantic names
{steps.map((step, i) => (
  <div key={i} data-element-name={\`step-\${i + 1}\`} style={{...}}>{step}</div>
))}

// ❌ WRONG — missing data-element-name
<div style={{...}}>Title</div>
\`\`\`

Use names that match the layout keys from scenes.json (primary, secondary, title, center, header, etc.) or describe the semantic purpose (diagram, icon-row, label, sidebar).

### Alignment Rules (STRICT)
| Element | Container Style | Content Style |
|---------|-----------------|---------------|
| Titles | \`display: 'flex', justifyContent: 'center', alignItems: 'center'\` | \`textAlign: 'center', margin: 0\` |
| Diagrams | \`flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center'\` | \`maxWidth: '85%', maxHeight: '90%'\` |
| Diagram labels | Same as titles | \`fontSize: height * 0.022\` |
| Multi-element rows | \`display: 'flex', justifyContent: 'center', gap: minDim * 0.03\` | Each item centered |

**⚠️ Leave bottom ~15% clear** — subtitles render there. Keep visuals in the top 85% of the canvas.

### Common Alignment Mistakes
| ❌ Wrong | ✅ Correct |
|----------|-----------|
| \`position: 'absolute', top: 50\` | \`flex: 1, justifyContent: 'center'\` |
| Hardcoded margins | Flexbox gap |
| No container constraints | \`maxWidth: '85%'\` on diagrams |
| Missing \`boxSizing: 'border-box'\` | Always include on main container |

### Layout Mode Considerations
- **stacked (1080×960):** Less vertical space - reduce title size, tighter gaps
- **pip (1080×1920):** Full space - can use more elaborate layouts

---

**metadata.json:**
\`\`\`json
{ "compositionId": "${projectId}", "durationInFrames": ${durationInFrames}, "fps": ${fps}, "width": ${width}, "height": ${height} }
\`\`\`

---

## 🎬 INTELLIGENT VISUAL DESIGN

You are creating **Instagram-worthy educational content**. Every visual must be SMART - matching what's being said.

### 🧠 UNDERSTAND THE TRANSCRIPT FIRST

Before designing ANY visual, ask: **"What is the speaker trying to convey?"**

| Transcript Type | What Speaker Wants | Correct Visual Response |
|-----------------|-------------------|------------------------|
| **Intro/Hook** | "Here's a challenge..." | Clean title card with topic name + relevant icon. NO random animations. Static or subtle fade-in. |
| **Problem Statement** | "You need to handle millions of tasks..." | SHOW the problem: tasks flooding in, queue overflowing, system struggling under load |
| **Solution Introduction** | "We can use a priority queue" | Show the TRANSITION: problem → solution. Queue organizing chaos, tasks getting prioritized |
| **Concept Explanation** | "This gives us logarithmic time" | EXPLAIN visually: tree halving with each step, counter showing O(log n) vs O(n) |
| **Comparison** | "Unlike a regular queue..." | Side-by-side: regular queue struggling vs priority queue handling efficiently |
| **Step-by-step** | "First we insert, then we heapify..." | Sequential animation showing each operation happening |

### ❌ STUPID vs ✅ SMART Animations

**Example: "Here is a system design challenge for you"**
- ❌ STUPID: Random shapes bouncing, decorative particles, meaningless motion
- ✅ SMART: Clean title "System Design Challenge" + challenge name + relevant architectural icon. Maybe subtle fade-in. That's it.

**Example: "You need to build a scheduler handling millions of delayed tasks"**
- ❌ STUPID: Static text "Scheduler" or a calendar icon sitting there
- ✅ SMART: Tasks flooding in (animated particles/items), a queue filling up, timestamps ticking, system visibly under pressure

**Example: "We can use a priority queue"**
- ❌ STUPID: Just show a heap diagram appearing
- ✅ SMART: Show the chaotic tasks from before NOW getting organized. High-priority items float to top. Order emerging from chaos.

**Example: "This gives us logarithmic time complexity"**
- ❌ STUPID: Text "O(log n)" appearing
- ✅ SMART: Show a tree where each decision eliminates HALF the remaining options. Counter showing steps: 1000→500→250→125→62→31→16→8→4→2→1. Visual proof of WHY it's log n.

### The Golden Rule
**If your animation doesn't EXPLAIN or ENHANCE the spoken content, it's decoration. Cut it.**

### When Static is Better Than Animated
- Intro title cards → Title fills viewport centrally, then springs to top. Professional and screen-filling.
- Topic transitions → Brief pause with clear label
- Complex diagrams → Let viewer absorb before animating
- After making a point → Hold for emphasis

### When Animation is Essential
- Showing a PROCESS (how something works)
- Showing CHANGE (before→after, problem→solution)
- Showing SCALE (millions of items, growing complexity)
- Showing TIME (steps, sequences, causation)

### Animation Techniques (Use When Appropriate)

**For PROBLEM_STATEMENT scenes** - Show scale and struggle:
\`\`\`tsx
// Tasks flooding in - shows "millions of tasks"
const taskCount = Math.floor(interpolate(frame, [0, 90], [0, 100]));
const tasks = Array.from({ length: taskCount }, (_, i) => (
  <div key={i} style={{
    transform: \`translateY(\${(i % 10) * 20}px)\`,
    opacity: interpolate(frame, [i * 0.5, i * 0.5 + 10], [0, 1]),
  }} />
));
\`\`\`

**For SOLUTION_INTRODUCTION scenes** - Show transformation:
\`\`\`tsx
// Chaos → Order transition
const orderProgress = interpolate(frame, [0, 60], [0, 1], { extrapolateRight: 'clamp' });
const itemY = interpolate(orderProgress, [0, 1], [randomY, sortedY]); // Items move to sorted positions
const itemColor = orderProgress > 0.5 ? COLORS.success : COLORS.warning; // Color shift
\`\`\`

**For CONCEPT_EXPLANATION scenes** - Show the WHY:
\`\`\`tsx
// "Logarithmic time" - show tree halving
const step = Math.floor(interpolate(frame, [0, 120], [0, 7]));
const remainingNodes = Math.pow(2, 7 - step); // 128 → 64 → 32 → 16 → 8 → 4 → 2 → 1
const eliminatedNodes = 128 - remainingNodes;
// Visual: highlight remaining path, fade out eliminated branches
\`\`\`

**For INTRO_HOOK scenes** - Title fills screen, then settles:
\`\`\`tsx
// Intro/hook: Title FILLS the screen centrally, then animates to top when content appears
const titleScale = interpolate(frame, [0, 15, 60, 75], [0, 1.6, 1.6, 1], { extrapolateRight: 'clamp' });
const titleY = interpolate(frame, [0, 60, 75], [0.5, 0.5, 0.08], { extrapolateRight: 'clamp' });
// Title fades in large and centered, holds, then shrinks to top position
// Supporting elements (icon, subtitle) fade in after title settles
const supportOpacity = interpolate(frame, [70, 85], [0, 1], { extrapolateRight: 'clamp' });
\`\`\`

---

## 📋 SCENE PLANNING WITH TRANSCRIPT INTELLIGENCE (REQUIRED FIRST STEP)

Before writing ANY code, analyze EACH transcript segment and determine the RIGHT visual approach.

**⚠️ CRITICAL: Understand WHAT the speaker is trying to convey, then design visuals that HELP.**

\`\`\`json
{
  "scenes": [
    {
      "timestamp": "0:00 - 0:03",
      "frameRange": [0, 90],
      "transcript": "Here's a system design challenge for you",
      "contentType": "INTRO_HOOK",
      "analysis": {
        "speakerIntent": "Set up the topic, create curiosity",
        "viewerNeeds": "Know what this video is about",
        "visualApproach": "STATIC_TITLE_CARD"
      },
      "visual": {
        "description": "Clean title: 'System Design Challenge' with subtle icon",
        "animation": "Simple fade-in, then hold. No bouncing or particles.",
        "whyThisWorks": "Viewer can read and understand topic without distraction"
      }
    },
    {
      "timestamp": "0:03 - 0:10",
      "frameRange": [90, 300],
      "transcript": "You need to build a scheduler that handles millions of delayed tasks",
      "contentType": "PROBLEM_STATEMENT",
      "analysis": {
        "speakerIntent": "Explain the scale and difficulty of the problem",
        "viewerNeeds": "FEEL the scale of millions, understand the challenge",
        "visualApproach": "ANIMATED_DEMONSTRATION"
      },
      "visual": {
        "description": "Tasks flooding in as particles/items, queue growing, numbers climbing",
        "animation": "Continuous stream of tasks, counter rapidly increasing, visual overwhelm",
        "whyThisWorks": "Viewer SEES millions, doesn't just hear the word"
      }
    },
    {
      "timestamp": "0:10 - 0:18",
      "transcript": "We can use a priority queue to solve this",
      "contentType": "SOLUTION_INTRODUCTION",
      "analysis": {
        "speakerIntent": "Introduce the solution and WHY it helps",
        "viewerNeeds": "See how this SOLVES the problem shown before",
        "visualApproach": "TRANSITION_BEFORE_AFTER"
      },
      "visual": {
        "description": "The chaotic tasks from before now getting organized into a heap structure",
        "animation": "Chaos → Order transition. High-priority items float up. Structure emerges.",
        "whyThisWorks": "Visual CONNECTS solution to problem. Not just showing a heap icon."
      }
    }
  ]
}
\`\`\`

### Content Types Reference
| Type | Visual Approach | Animation Level |
|------|-----------------|-----------------|
| INTRO_HOOK | Title fills screen centrally, then animates to top | Medium (scale + position spring) |
| PROBLEM_STATEMENT | Demonstrate the struggle | High (show scale, chaos) |
| SOLUTION_INTRODUCTION | Before→After transition | Medium-High (transformation) |
| CONCEPT_EXPLANATION | Visual proof/demonstration | High (show WHY it works) |
| COMPARISON | Side-by-side | Medium (highlight differences) |
| STEP_BY_STEP | Sequential operations | Medium (one step at a time) |
| CONCLUSION | Summary visual | Minimal (clean, memorable) |

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

### constants.ts Template (COMPLETE - include all colors you might need)
\`\`\`tsx
// All colors your components might use - add upfront to avoid TS errors
export const COLORS = {
  bg: '#0f0f23',
  primary: '#8b5cf6',
  secondary: '#3b82f6',
  accent: '#06b6d4',
  success: '#22c55e',
  warning: '#eab308',
  danger: '#ef4444',
  white: '#ffffff',
  text: '#e2e8f0',
  muted: '#64748b',        // ← Often forgotten, causes TS2339
  glass: 'rgba(255, 255, 255, 0.1)',
  glassBorder: 'rgba(255, 255, 255, 0.2)',
};

// Responsive sizing helper (use in components)
export const getResponsiveSizes = (width: number, height: number) => {
  const minDim = Math.min(width, height);
  return {
    fontSize: {
      sm: height * 0.022,
      md: height * 0.032,
      lg: height * 0.045,
      xl: height * 0.06,
    },
    spacing: {
      xs: minDim * 0.02,
      sm: minDim * 0.03,
      md: minDim * 0.05,
      lg: minDim * 0.08,
    },
    borderRadius: minDim * 0.02,
  };
};
\`\`\`

---

## 📦 COMPONENT LIBRARY (Optional Shortcuts)

Pre-built components at \`./components/\` are available as **time-savers**, not requirements. Create custom components whenever you have a better idea.

**Available if useful:** \`Counter\`, \`PathFollow\`, \`Stagger\`, \`ParticleStream\`, \`GlowingOrb\`, \`BarChart\`, \`LineGraph\`, \`Confetti\`, \`Burst\`, \`SafeZone\`

**Import:** \`import { Counter, PathFollow } from './components';\`

**Most visualizations should be custom** - the best explainer videos have unique, creative visuals specific to the content.

---

## 🎬 WHAT TO VISUALIZE — PREMIUM EXPLAINER ANIMATIONS

Think **3Blue1Brown meets Apple keynote**. Every frame should feel polished, intentional, and beautiful.

| Transcript Content | Visual to Create |
|-------------------|------------------|
| Steps/Process | Animated flowchart with smooth transitions, nodes appear with spring physics |
| Statistics/Numbers | Animated bar charts, counters with easing, progress rings with glow effects |
| Comparisons | Side-by-side with animated reveals, morphing transitions |
| Concepts/Frameworks | Elegant diagrams, animated mind maps with flowing connections |
| Hierarchies | Tree structures with expanding animations, depth-based lighting |
| Relationships | Animated connection lines with particle trails between nodes |

**IMPORTANT:** PURE VISUAL STORYTELLING. Never put caption/subtitle text on screen — that's handled separately. CREATE BEAUTIFUL VISUAL REPRESENTATIONS that explain concepts through motion, color, and spatial relationships. Every animation should make the viewer think "this looks premium".

---

${referenceExamples}

---

${AUTOAE_SCENE_PATTERNS}

---

## ✅ SELF-HEALING WORKFLOW

1. After writing each file, run \`TypeScriptValidatorTool\`
2. If ANY errors, fix them IMMEDIATELY

### ⚠️ For TS6133 "unused declaration" errors - THIS IS CRITICAL:

**WRONG approach:** Delete the unused variable
**RIGHT approach:** Find where it should be used and USE IT

| Unused Variable | WHERE TO USE IT |
|-----------------|-----------------|
| \`minDim\` | Replace ALL hardcoded px values: \`fontSize: minDim * 0.04\`, \`padding: minDim * 0.03\` |
| \`fps\` | Pass to spring(): \`spring({ frame, fps, config: {...} })\` |
| \`frame\` | Use in interpolate/spring for animations |
| \`opacity\` | Add to style: \`style={{ opacity }}\` |
| \`scale\`, \`rotation\`, \`yPos\` | Add to transform: \`transform: \\\`scale(\${scale}) rotate(\${rotation}deg) translateY(\${yPos}px)\\\`\` |
| \`springScale\`, \`springRotation\` | Same as above - use in transform |
| \`SPRING_CONFIGS\` | Use in spring calls: \`spring({ frame, fps, config: SPRING_CONFIGS.bouncy })\` |

**The variable was declared because you INTENDED to use it. Follow through!**

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
