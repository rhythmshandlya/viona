export const STYLE_GUIDELINES: Record<string, string> = {
  minimal: `
Style: Minimal
- Clean lines, lots of whitespace
- Monochrome with single accent color
- Simple geometric shapes
- Subtle animations (fade, slide)
- Sans-serif fonts (Inter, Helvetica)
- Colors: #1a1a1a, #ffffff, one accent`,

  modern: `
Style: Modern
- Gradients and rounded corners
- Vibrant colors with good contrast
- Smooth spring animations
- Glass morphism effects where appropriate
- Sans-serif fonts (Inter, Poppins)
- Colors: Use modern palette with blues, purples, teals`,

  playful: `
Style: Playful
- Hand-drawn feel, slightly imperfect
- Bright, saturated colors
- Bouncy animations with overshoot
- Icons and illustrations
- Rounded, friendly fonts
- Colors: Warm, inviting palette`,

  bold: `
Style: Bold
- High contrast, large text
- Strong typography
- Dramatic animations (scale, rotate)
- Minimal decoration, maximum impact
- Heavy weight fonts
- Colors: Black, white, one bold accent`,

  classic: `
Style: Classic
- Traditional chart styles
- Serif fonts for headings
- Muted, professional tones
- Subtle, refined animations
- Clean data visualization
- Colors: Navy, gold, cream, gray`,
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
You are generating animated visuals for an educational video using Remotion.

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

1. **Analyze the transcript** for visual opportunities:
   - Processes/steps being explained → Flowcharts, timelines
   - Data/statistics mentioned → Charts, counters, stat cards
   - Frameworks/models described → Diagrams, matrices, pyramids
   - Comparisons being made → Side-by-side, versus graphics
   - Lists being enumerated → Animated bullet points, icon grids
   - Key concepts → Text callouts, visual metaphors

2. **Create Remotion components** in src/${projectId}/:
   - index.tsx - Main composition with Sequences for each visual
   - constants.ts - Colors, timing, style constants
   - components/ - Reusable visual components
   - Each visual should sync with transcript timestamps

3. **Use Remotion best practices**:
   - useCurrentFrame() for animation timing
   - useVideoConfig() to get fps for spring animations
   - interpolate() for smooth value transitions
   - spring({ frame, fps, config: {...} }) - fps is REQUIRED
   - Sequence components for timed sections
   - AbsoluteFill for layout

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
- [ ] Animations are smooth, not jarring
- [ ] Text is readable (good contrast, appropriate size)
- [ ] Timing matches speech in transcript
- [ ] Visual supports comprehension, not just decoration

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
