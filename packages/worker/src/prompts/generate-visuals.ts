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
}

export function buildGenerateVisualsPrompt(options: PromptOptions): string {
  const { transcript, projectId, stylePreset, styleGuidelines, durationMs, fps } = options;

  const transcriptText = formatTranscript(transcript);
  const durationInFrames = Math.ceil((durationMs / 1000) * fps);

  return `
You are generating animated visuals for an educational video using Remotion.

## Project Setup
- Working directory: /workspace (Remotion project)
- Generate components in: src/${projectId}/
- Composition ID must be: "${projectId}"

## IMPORTANT: Do NOT edit src/Root.tsx
Root.tsx is AUTO-GENERATED after you finish. Just create your components in src/${projectId}/ and the system will register them automatically.

## Video Properties
- Duration: ${durationMs}ms (${durationInFrames} frames)
- FPS: ${fps}
- Resolution: 1920x1080

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
   - interpolate() for smooth value transitions
   - spring() for physics-based motion
   - Sequence components for timed sections
   - AbsoluteFill for layout

4. **Iterate with screenshots**:
   - Use: npx remotion still ./src/index.ts ${projectId} ./src/${projectId}/preview.png --frame=X
   - Capture key moments and evaluate visually
   - Refine until the visual clearly communicates the concept
   - The preview.png will be saved in your project directory for easy access

5. **Create metadata.json** in src/${projectId}/ when done:
\`\`\`json
{
  "compositionId": "${projectId}",
  "durationInFrames": ${durationInFrames},
  "fps": ${fps},
  "width": 1920,
  "height": 1080,
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

## Quality Checklist
Before finishing, verify:
- [ ] Animations are smooth, not jarring
- [ ] Text is readable (good contrast, appropriate size)
- [ ] Timing matches speech in transcript
- [ ] Visual supports comprehension, not just decoration
- [ ] Code compiles without errors
- [ ] metadata.json is created with accurate timestamps

## Example Component Structure

\`\`\`tsx
// src/${projectId}/index.tsx
import { AbsoluteFill, Sequence, useCurrentFrame, interpolate, spring } from 'remotion';
import { COLORS, TIMING } from './constants';
import { ProcessDiagram } from './components/ProcessDiagram';

export const ${projectId}: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.background }}>
      <Sequence from={TIMING.processStart} durationInFrames={TIMING.processDuration}>
        <ProcessDiagram steps={['Step 1', 'Step 2', 'Step 3']} />
      </Sequence>
    </AbsoluteFill>
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
