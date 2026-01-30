export const STYLE_GUIDELINES: Record<string, string> = {
  minimal: `
Style: Minimal (Clean & Professional)
- Clean lines, generous whitespace
- Monochrome with single bold accent color for emphasis
- Simple geometric shapes, no clutter
- Quick fade/slide animations (0.3s duration)
- Sans-serif fonts: Inter or SF Pro (LARGE sizes for mobile!)
- Colors: #1a1a1a background, #ffffff text, one bright accent
- Perfect for: Business tips, productivity content, professional advice
- Social media tip: Let the speaker be the star, visuals just highlight key points`,

  modern: `
Style: Modern (Trendy & Eye-catching)
- Vibrant gradients and rounded corners (very TikTok/Instagram native)
- High saturation colors that pop on mobile screens
- Smooth spring animations with slight overshoot
- Glass morphism / frosted glass effects for overlays
- Sans-serif fonts: Poppins, Plus Jakarta Sans (bold weights)
- Colors: Purple-blue gradients, cyan accents, dark backgrounds
- Perfect for: Tech content, tutorials, explainers
- Social media tip: Gradient backgrounds grab attention in feeds`,

  playful: `
Style: Playful (Fun & Engaging)
- Bright, saturated candy colors
- Bouncy animations with elastic overshoot (spring config: stiffness 200, damping 10)
- Rounded shapes, emoji-style icons welcome
- Handwritten or rounded fonts (Comic Neue, Nunito)
- Colors: Orange #f97316, Yellow #eab308, Pink #ec4899, Green #22c55e
- Perfect for: Lifestyle, entertainment, casual education
- Social media tip: Energy matches the fast-paced scroll, very shareable`,

  bold: `
Style: Bold (High Impact)
- Maximum contrast: pure black and white with ONE accent color
- LARGE typography that fills the frame - impossible to miss
- Dramatic scale animations (start at 0, spring to 100%)
- Minimal decoration, every element has purpose
- Heavy weight fonts: Anton, Bebas Neue, Impact
- Colors: #000000, #ffffff, one neon accent (red, yellow, or cyan)
- Perfect for: Hot takes, controversial opinions, strong statements
- Social media tip: This style STOPS the scroll - use for hooks`,

  classic: `
Style: Classic (Trustworthy & Educational)
- Traditional layouts, clean data visualization
- Serif fonts for authority (Playfair Display, Georgia)
- Muted, professional tones that feel credible
- Smooth, dignified animations (no bounce)
- Chart styles: clean bars, simple line graphs
- Colors: Navy #1e3a5f, Gold #d4af37, Cream #f5f5dc, Charcoal #374151
- Perfect for: Finance, history, academic content, news-style
- Social media tip: Builds trust, great for expert positioning`,
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
**Format:** Talking head video with visual overlays
**Audience:** Social media users with short attention spans (3-5 second hooks needed)

**The Setup:**
- A person is speaking directly to camera (the "talking head")
- Your visuals will appear ${layoutMode === 'pip' ? 'BEHIND the speaker (who appears as a small PiP overlay)' : layoutMode === 'split-horizontal' ? 'ABOVE the speaker (split screen)' : 'BESIDE the speaker (split screen)'}
- The speaker is explaining concepts - your visuals SUPPORT their message
- Viewers are scrolling fast - visuals must grab attention INSTANTLY

**Design Principles for Short-Form Content:**
1. **BOLD & CLEAR** - Text must be readable on a phone screen (no tiny fonts!)
2. **FAST ANIMATIONS** - Quick entrances (0.3-0.5s), don't make viewers wait
3. **HIGH CONTRAST** - Visuals must pop against any background
4. **COMPLEMENT, DON'T COMPETE** - Support the speaker, don't distract from them
5. **MOBILE-FIRST** - ${width < height ? 'This is VERTICAL video - perfect for mobile!' : 'Design for thumb-stopping impact'}
6. **HOOK EARLY** - First 3 seconds need something visually interesting

**What Works on Social Media:**
- Animated text that appears with the speaker's key points
- Simple diagrams that build up piece by piece
- Progress bars, counters, checkmarks for lists
- Bold headlines that reinforce what's being said
- Subtle motion (not static, but not overwhelming)

**What to AVOID:**
- Walls of text (max 5-7 words per text element)
- Slow, subtle animations (they'll scroll past)
- Complex diagrams that need time to understand
- Anything that requires reading while listening
- Visuals that fight for attention with the speaker

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

1. **Analyze the transcript** for visual opportunities (BEST for talking head videos):

   **HIGH IMPACT visuals (use these!):**
   - Key phrases/quotes → Big animated text that appears AS the speaker says it
   - Numbers/statistics → Animated counters, bold stat cards ("3X faster!")
   - Lists (3-5 items) → Checkmarks/bullets that appear one by one
   - Before/After → Simple two-panel comparison
   - Steps/Process → Numbered steps (1, 2, 3) appearing sequentially

   **MEDIUM IMPACT visuals:**
   - Frameworks → Simple diagram that builds up (max 4-5 elements)
   - Comparisons → VS graphics, simple side-by-side
   - Timelines → Horizontal progress with milestones

   **USE SPARINGLY (can distract from speaker):**
   - Complex flowcharts (too much to process)
   - Detailed data visualizations (need focus to read)
   - Anything with lots of small text

   **GOLDEN RULE:** If someone can't understand the visual in 2 seconds, simplify it!

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
- [ ] Animations are FAST (0.3-0.5s entrances) - no slow fades!
- [ ] Text is LARGE and readable on mobile (min ${Math.round(height * 0.025)}px)
- [ ] High contrast - visuals pop against any background
- [ ] Timing syncs with speaker's words in transcript
- [ ] First 3 seconds have something visually interesting (hook!)
- [ ] No text element has more than 7 words
- [ ] Visuals SUPPORT the speaker, don't compete for attention

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
