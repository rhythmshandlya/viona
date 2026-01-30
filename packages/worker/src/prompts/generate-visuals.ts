export const STYLE_GUIDELINES: Record<string, string> = {
  minimal: `
Style: Minimal (Clean & Professional)
- Clean geometric shapes, generous whitespace
- Monochrome diagrams with single accent color for highlights
- Thin lines, subtle shadows, elegant simplicity
- Smooth fade/slide animations, nothing flashy
- Icons: Line-style, single weight, consistent sizing
- Colors: #1a1a1a background, #ffffff elements, #3b82f6 accent
- Diagram style: Clean flowcharts, simple node connections, understated
- Animation style: Elements fade in smoothly, subtle position shifts
- Best for: Business processes, professional workflows, corporate content`,

  modern: `
Style: Modern (Vibrant & Dynamic)
- Gradient-filled shapes, rounded corners on everything
- Vibrant colors that pop, glass morphism effects
- Smooth spring animations with slight overshoot
- Icons: Filled style, colorful, modern flat design
- Colors: Purple #8b5cf6 to Blue #3b82f6 gradients, Cyan #06b6d4 accents
- Diagram style: Colorful nodes, gradient connections, depth with shadows
- Animation style: Spring physics, elements bounce in, satisfying motion
- Best for: Tech tutorials, SaaS explainers, startup content`,

  playful: `
Style: Playful (Fun & Energetic)
- Bright saturated colors, rounded bubbly shapes
- Bouncy animations with elastic overshoot (spring: stiffness 200, damping 10)
- Hand-drawn style elements, imperfect circles, wobbly lines
- Icons: Emoji-style, illustrated, character-based
- Colors: Orange #f97316, Yellow #eab308, Pink #ec4899, Green #22c55e
- Diagram style: Cartoon-like, characters pointing at things, fun illustrations
- Animation style: Bouncy entrances, wiggle effects, playful transitions
- Best for: Educational content for younger audiences, lifestyle, entertainment`,

  bold: `
Style: Bold (High Contrast & Impactful)
- Maximum contrast: black/white with ONE neon accent
- Large, chunky shapes that command attention
- Dramatic scale animations (0 to 100% spring)
- Icons: Solid, heavy weight, impossible to miss
- Colors: #000000, #ffffff, accent: #ef4444 (red) or #eab308 (yellow)
- Diagram style: Thick borders, heavy arrows, stark contrasts
- Animation style: Dramatic reveals, scale from zero, powerful presence
- Best for: Strong statements, key concepts, memorable moments`,

  classic: `
Style: Classic (Trustworthy & Educational)
- Traditional diagram layouts, clean data visualization
- Muted, professional color palette
- Smooth, dignified animations without bounce
- Icons: Traditional, professional, outline or subtle fill
- Colors: Navy #1e3a5f, Gold #d4af37, Cream #f5f5dc, Charcoal #374151
- Diagram style: Academic charts, clean axes, proper labels, traditional graphs
- Animation style: Smooth fades, professional transitions, no gimmicks
- Best for: Finance, science, history, academic explanations, data-heavy content`,
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

  return `
You are generating animated visuals for a SHORT-FORM SOCIAL MEDIA video using Remotion.

## 🎬 VIDEO CONTEXT - READ THIS FIRST

**Platform:** Instagram Reels, TikTok, YouTube Shorts
**Format:** Talking head video with animated visual explanations
**Purpose:** Create RICH, COMPLEX animated visuals that explain concepts visually

**The Setup:**
- A person is speaking directly to camera (the "talking head")
- Your visuals will appear ${layoutMode === 'pip' ? 'BEHIND the speaker (who appears as a small PiP overlay)' : layoutMode === 'split-horizontal' ? 'ABOVE the speaker (split screen)' : 'BESIDE the speaker (split screen)'}
- **SUBTITLES ARE SEPARATE** - text/captions are handled elsewhere, you create VISUALS
- The speaker explains concepts verbally - your job is to VISUALIZE those concepts
- Think of yourself as creating animated infographics, diagrams, and illustrations

**Your Goal: Complex Animated Visualizations**
You are NOT creating text overlays or captions. You are creating:
- Animated diagrams that build up step by step
- Flowcharts with elements appearing in sequence
- Data visualizations (charts, graphs) that animate in
- Process illustrations showing how things work
- Concept maps and relationship diagrams
- Visual metaphors and illustrations
- Animated icons and symbols representing ideas

**Design Principles:**
1. **VISUAL, NOT TEXTUAL** - Minimize text! Use shapes, icons, diagrams, illustrations
2. **ANIMATE PROGRESSIVELY** - Build complexity over time, reveal piece by piece
3. **SYNC WITH SPEECH** - When speaker mentions Step 1, show Step 1 animating in
4. **EDUCATIONAL VALUE** - Visuals should help viewers UNDERSTAND the concept
5. **PROFESSIONAL QUALITY** - Smooth animations, consistent style, polished look
6. **MOBILE-OPTIMIZED** - ${width < height ? 'Vertical format - stack elements, use full height' : 'Design for mobile viewing'}

**What to Create:**
- Flowcharts that animate node by node
- Diagrams that build up as concepts are explained
- Charts/graphs with animated data points
- Process visualizations (arrows, steps, cycles)
- Comparison graphics (vs, before/after)
- Icon-based illustrations
- Animated infographics

**What NOT to Create:**
- Text captions or subtitles (handled separately)
- Simple text overlays (not your job)
- Static images (everything should animate)
- Overly simple visuals (aim for rich, educational content)

## Project Setup
The workspace is a pre-configured Remotion project with all dependencies installed.

**File Structure:**
\`\`\`
/workspace/
├── package.json          # DO NOT MODIFY
├── tsconfig.json         # DO NOT MODIFY (has skipLibCheck: true)
├── node_modules/         # Pre-installed, DO NOT MODIFY
└── src/
    ├── index.tsx         # Entry point, DO NOT MODIFY
    ├── Root.tsx          # AUTO-GENERATED, DO NOT MODIFY
    └── ${projectId}/     # YOUR CODE GOES HERE
        ├── index.tsx     # Main composition (export as ${projectId})
        ├── constants.ts  # Colors, timing constants
        ├── metadata.json # Composition metadata
        └── components/   # Reusable components
\`\`\`

**Your Composition ID:** "${projectId}"

## IMPORTANT Rules
1. Only write files inside \`src/${projectId}/\`
2. Do NOT edit src/Root.tsx - it is auto-generated
3. Do NOT modify package.json, tsconfig.json, or node_modules
4. Export your main composition as: \`export const ${projectId}: React.FC = () => ...\`

## Video Properties
- Duration: ${durationMs}ms (${durationInFrames} frames)
- FPS: ${fps}
- **Resolution: ${width}x${height}** (THIS IS CRITICAL - see below)
- Layout: ${layoutContext}

## ⚠️ CRITICAL: Dimension Requirements
**Your visuals MUST be designed for ${width}x${height} pixels.**

This is ${width < height ? 'a VERTICAL (portrait) format' : width > height ? 'a HORIZONTAL (landscape) format' : 'a SQUARE format'}.
${layoutMode !== 'pip' ? `The user chose a SPLIT layout, so these dimensions are for the visuals portion only (not full screen).` : ''}

**Design Rules for ${width}x${height}:**
- Use \`useVideoConfig()\` to get width/height dynamically - NEVER hardcode dimensions
- Font sizes should be proportional: titles ~${Math.round(height * 0.04)}px, body ~${Math.round(height * 0.025)}px
- Margins/padding: ~${Math.round(Math.min(width, height) * 0.05)}px
- ${width < height ? 'Stack elements VERTICALLY - this is portrait mode!' : 'Arrange elements HORIZONTALLY for landscape'}
- Center important content - don't let it get cut off at edges

**In metadata.json, you MUST use exactly:**
\`\`\`json
"width": ${width},
"height": ${height}
\`\`\`

## Transcript
${transcriptText}

## Style Preset: ${stylePreset}
${styleGuidelines}

## Your Task

1. **Analyze the transcript** for visualization opportunities:

   **PROCESSES & WORKFLOWS:**
   - Steps being explained → Animated flowchart building node by node
   - Sequences → Timeline with milestones appearing in order
   - Cycles → Circular diagram with rotating/highlighting sections
   - Cause & effect → Animated arrows showing relationships

   **DATA & COMPARISONS:**
   - Statistics mentioned → Animated bar/line charts, pie charts
   - Numbers → Animated counters, gauge meters, progress rings
   - Comparisons → Side-by-side graphics, VS animations
   - Rankings → Podium graphics, leaderboard animations

   **CONCEPTS & FRAMEWORKS:**
   - Mental models → Animated diagrams (pyramids, matrices, Venn diagrams)
   - Hierarchies → Org charts, tree structures that expand
   - Categories → Icon grids, grouped elements
   - Relationships → Mind maps, connection lines animating between nodes

   **VISUAL METAPHORS:**
   - Abstract concepts → Illustrative animations (growth = plant growing, speed = rocket)
   - Transformations → Before/after morphing animations
   - Journeys → Path animations, roadmaps

   **IMPORTANT:** Analyze what the speaker is EXPLAINING, then create visuals that SHOW it.
   Don't just put text on screen - CREATE A VISUAL REPRESENTATION of the concept.

2. **Create Remotion components** in src/${projectId}/:
   - index.tsx - Main composition with Sequences for each visual
   - constants.ts - Colors, timing, style constants
   - components/ - Reusable visual components
   - Each visual should sync with transcript timestamps

3. **Use Remotion best practices**:
   - useCurrentFrame() for animation timing
   - useVideoConfig() to get fps AND dimensions
   - interpolate() for smooth value transitions - ALWAYS use \`extrapolateRight: 'clamp'\`
   - spring({ frame, fps, config: {...} }) - fps is REQUIRED, never omit it!
   - Sequence components for timed sections
   - AbsoluteFill for layout
   - All animation values must be PURE FUNCTIONS of frame - no state!

4. **⛔ FORBIDDEN PATTERNS - These will break rendering:**
   - ❌ CSS transitions (transition: all 0.3s) - causes flickering
   - ❌ CSS animations (@keyframes) - not frame-accurate
   - ❌ CSS transform with transition - use Remotion's interpolate instead
   - ❌ setTimeout/setInterval - breaks deterministic rendering
   - ❌ useState for animation values - use useCurrentFrame instead
   - ❌ Relative animations (previous frame + delta) - must be absolute from frame 0

   **WHY:** Remotion renders each frame independently. CSS animations and state
   don't work because each frame must produce the SAME output given the SAME frame number.
   Always calculate animation values as: \`f(frame) = value\`

4. **SELF-HEALING: Validate and fix TypeScript errors**:
   - After writing each file, run TypeScriptValidatorTool
   - If there are ANY errors, fix them IMMEDIATELY
   - Run TypeScriptValidatorTool again to verify the fix
   - Repeat until ZERO errors before moving to next file
   - CRITICAL: You MUST finish with ZERO TypeScript errors
   - Code that doesn't compile is UNACCEPTABLE

5. **Iterate with screenshots**:
   - Use: npx remotion still ./src/index.ts ${projectId} ./src/${projectId}/preview.png --frame=X
   - Capture key moments and evaluate visually
   - Refine until the visual clearly communicates the concept
   - The preview.png will be saved in your project directory for easy access

6. **Create metadata.json** in src/${projectId}/ when done:
\`\`\`json
{
  "compositionId": "${projectId}",
  "durationInFrames": ${durationInFrames},
  "fps": ${fps},
  "width": ${width},
  "height": ${height},
  "visuals": [
    {
      "startMs": 5000,
      "endMs": 12000,
      "type": "process",
      "description": "5-step workflow diagram"
    }
  ]
}
\`\`\`

## Decision Making
Do NOT ask questions. Make reasonable decisions:
- If multiple visual types fit, choose the clearest one
- If data is ambiguous, use what's stated in transcript
- If unsure whether to visualize, err toward visualizing
- If something fails, try an alternative approach

You must complete the task without human input.

## CRITICAL: Zero Error Requirement
Before finishing, you MUST verify TypeScript compiles with ZERO errors:
1. Run TypeScriptValidatorTool on the entire project
2. If ANY errors exist, fix them
3. Run TypeScriptValidatorTool again
4. Repeat until you see "TypeScript validation passed. No errors found."

## Quality Checklist
- [ ] TypeScript compiles with ZERO errors (REQUIRED)
- [ ] **metadata.json has width: ${width}, height: ${height}** (REQUIRED)
- [ ] **Design fits ${width}x${height} - no hardcoded 1920x1080!** (REQUIRED)
- [ ] Visuals are ANIMATED (not static images) - elements build progressively
- [ ] Animations are smooth with proper easing (use spring() or interpolate())
- [ ] Timing syncs with transcript - visuals appear when speaker mentions concepts
- [ ] Minimal text - diagrams and shapes convey meaning, not words
- [ ] Visual complexity matches the concept being explained
- [ ] Professional polish - consistent colors, aligned elements, clean design
- [ ] Educational value - viewer learns from watching the visual

## Example Component Structure

\`\`\`tsx
// src/${projectId}/index.tsx
import React from 'react';
import { AbsoluteFill, Sequence, useVideoConfig } from 'remotion';
import { COLORS, TIMING } from './constants';
import { ProcessDiagram } from './components/ProcessDiagram';

export const ${projectId}: React.FC = () => {
  // ALWAYS use useVideoConfig() to get dimensions - NEVER hardcode!
  const { width, height } = useVideoConfig();

  // Calculate responsive sizes based on actual dimensions
  const padding = Math.min(width, height) * 0.05;
  const titleSize = height * 0.04;

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.background, padding }}>
      <Sequence from={TIMING.processStart} durationInFrames={TIMING.processDuration}>
        <ProcessDiagram steps={['Step 1', 'Step 2', 'Step 3']} />
      </Sequence>
    </AbsoluteFill>
  );
};

// src/${projectId}/components/ProcessDiagram.tsx - Example with responsive sizing
import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';

export const ProcessDiagram: React.FC<{ steps: string[] }> = ({ steps }) => {
  const frame = useCurrentFrame();
  // Get BOTH fps AND dimensions from useVideoConfig()
  const { fps, width, height } = useVideoConfig();

  // Responsive layout: stack vertically for portrait, horizontally for landscape
  const isPortrait = height > width;
  const gap = Math.min(width, height) * 0.02;
  const fontSize = height * 0.03;

  return (
    <div style={{
      display: 'flex',
      flexDirection: isPortrait ? 'column' : 'row',
      gap,
      justifyContent: 'center',
      alignItems: 'center',
    }}>
      {steps.map((step, i) => {
        const scale = spring({
          frame: frame - i * 10,
          fps,  // REQUIRED!
          config: { damping: 10, stiffness: 100 },
        });
        return (
          <div key={i} style={{
            transform: \`scale(\${scale})\`,
            fontSize,
          }}>
            {step}
          </div>
        );
      })}
    </div>
  );
};
\`\`\`

Now analyze the transcript and create appropriate visuals.
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
