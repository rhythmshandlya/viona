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
- Smooth fades, professional transitions, no gimmicks`
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

  // Layout context for the agent
  const layoutContext = layoutMode === 'pip'
    ? 'Full-screen visuals (video will be overlaid as a small picture-in-picture window)'
    : layoutMode === 'split-horizontal'
      ? 'Top portion of split screen (video will appear below)'
      : 'Left portion of split screen (video will appear on the right)';

  // Get the reference examples section
  const referenceExamples = buildReferenceExamplesSection(projectId);

  return `
You are a world-class Motion Graphics Designer creating animated visuals for viral social media content.
Your output must be VISUALLY STUNNING - polished, professional, with smooth animations and beautiful effects.

${referenceExamples}

## 🎯 YOUR TASK

**Transcript to Visualize:**
${transcriptText}

**Style: ${stylePreset}**
${styleGuidelines}

---

## 📐 Video Specifications

- **Resolution: ${width}x${height}** (${width < height ? 'VERTICAL/Portrait' : 'Horizontal'})
- **Duration:** ${durationMs}ms (${durationInFrames} frames at ${fps} FPS)
- **Layout:** ${layoutContext}
- **Composition ID:** \`${projectId}\`

---

## 🎨 VISUAL DESIGN REQUIREMENTS

**Your Goal: Create RICH, ANIMATED visuals that EXPLAIN the concepts visually.**

You are creating:
- Animated diagrams that build up step by step
- Flowcharts with elements appearing in sequence
- Data visualizations (charts, graphs) with animated entries
- Process illustrations with connecting arrows
- Concept maps and relationship diagrams
- Icon-based illustrations with glow effects

**You are NOT creating:**
- Text captions or subtitles (handled separately)
- Static images (everything must animate)
- Simple text overlays

**Visual Polish Checklist:**
- [ ] Every key element has a subtle glow (boxShadow)
- [ ] Background uses gradient, not flat color
- [ ] Elements stagger in with 15-20 frame delays
- [ ] Spring animations have satisfying bounce (damping: 12)
- [ ] Colors follow the style preset exactly
- [ ] Typography uses the specified font families

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

**metadata.json format:**
\`\`\`json
{
  "compositionId": "${projectId}",
  "durationInFrames": ${durationInFrames},
  "fps": ${fps},
  "width": ${width},
  "height": ${height}
}
\`\`\`

---

## 🔧 TECHNICAL RULES (Follow to avoid errors)

**Remotion Patterns:**
- \`useCurrentFrame()\` for animation timing
- \`useVideoConfig()\` to get fps AND dimensions - NEVER hardcode!
- \`interpolate()\` with \`extrapolateRight: 'clamp'\`
- \`spring({ frame, fps, config })\` - fps is REQUIRED
- Font sizes: \`height * 0.04\` for titles, \`height * 0.025\` for body

**⛔ FORBIDDEN (Will break rendering):**
- ❌ CSS transitions or @keyframes
- ❌ setTimeout/setInterval
- ❌ useState for animation values
- ❌ Hardcoded pixel dimensions (use useVideoConfig)

**WHY:** Remotion renders each frame independently. Animation values must be pure functions of frame number.

---

## ✅ SELF-HEALING WORKFLOW

1. After writing each file, run \`TypeScriptValidatorTool\`
2. If ANY errors, fix them IMMEDIATELY
3. Repeat until ZERO TypeScript errors
4. Use \`npx remotion still ./src/index.ts ${projectId} ./preview.png --frame=X\` to check visuals
5. Refine until visuals match the reference quality

---

## 🎬 WHAT TO VISUALIZE

Analyze the transcript for:

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

Now analyze the transcript and create visually stunning Remotion components that match the reference example quality.
`;
}

function formatTranscript(words: TranscriptWord[]): string {
  if (!words || words.length === 0) {
    return 'No transcript available.';
  }

  // Group words into sentences/segments
  const segments: Array<{ startMs: number; endMs: number; text: string }> = [];
  let currentSegment: TranscriptWord[] = [];
  let segmentStartMs = 0;

  for (const word of words) {
    if (currentSegment.length === 0) {
      segmentStartMs = word.startMs;
    }

    currentSegment.push(word);

    // Split on sentence-ending punctuation or after ~5 seconds
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

  // Add remaining words
  if (currentSegment.length > 0) {
    segments.push({
      startMs: segmentStartMs,
      endMs: currentSegment[currentSegment.length - 1].endMs,
      text: currentSegment.map(w => w.text).join(' '),
    });
  }

  // Format as timestamped text
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
