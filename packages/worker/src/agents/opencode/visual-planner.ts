/**
 * Visual Planner
 *
 * Analyzes the FULL transcript first to determine:
 * 1. The core concept being explained
 * 2. The best overall visual metaphor
 * 3. How to represent it visually across the video
 * 4. Then chunks into scenes that build on this unified vision
 */

import OpenAI from 'openai';
import { logger } from '../../logger.js';

export interface TranscriptWord {
  text: string;
  startMs: number;
  endMs: number;
}

export interface VisualPlan {
  // Overall understanding
  coreConcept: string;
  targetAudience: string;

  // Visual strategy
  visualMetaphor: string;
  visualDescription: string;
  persistentElements: string[]; // Elements that appear throughout (e.g., "heap structure", "main character")
  colorScheme: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
  };

  // Render mode
  renderMode: '2d' | '3d';

  // Scene breakdown
  scenes: PlannedScene[];
}

export interface PlannedScene {
  id: string;
  startMs: number;
  endMs: number;
  startFrame: number;
  endFrame: number;
  durationFrames: number;
  transcript: string;

  // Visual direction for this scene
  visualFocus: string; // What should the viewer focus on
  visualAction: string; // What happens visually in this scene
  transitionFromPrevious: string; // How it connects to previous scene (should describe smooth evolution)
  keyElements: string[]; // Specific elements to animate

  // Continuity info for seamless transitions
  startState?: string; // How elements should look at frame 0 (end state of previous scene)
  endState?: string; // How elements should look at final frame (start state for next scene)
}

const PLANNER_SYSTEM_PROMPT = `You are a creative director for animated explainer videos.

## ⛔ FORBIDDEN - NEVER DO THESE:
- NEVER use nature metaphors (rivers, fish, trees, animals, weather) for technical topics
- NEVER use literal interpretations of names (e.g., "reservoir" ≠ water, "tree" ≠ plant, "stack" ≠ papers)
- NEVER use cartoon-like or childish visuals
- NEVER use abstract art that doesn't explain the concept
- NEVER use metaphors that require explanation - the visual should BE the explanation

## ✅ REQUIRED - ALWAYS DO THESE:
For technical/programming topics, show the ACTUAL MECHANISM:
- Algorithms: Show data structures with values, show step-by-step operations
- Data structures: Show boxes/nodes with connections, show how data is stored/accessed
- Systems: Show components as labeled boxes, show data flow with arrows

## EXAMPLE OF CORRECT vs WRONG:

Topic: "Reservoir Sampling Algorithm"
❌ WRONG: River with fish swimming, net catching fish (literal interpretation of "reservoir")
✅ CORRECT:
   - A stream of numbered items (1, 2, 3, 4...) flowing from left
   - A fixed-size array with k slots (the reservoir)
   - Random number generator deciding which items replace existing ones
   - Show the probability calculation visually

Topic: "Binary Search Tree"
❌ WRONG: A tree with leaves and branches
✅ CORRECT:
   - Nodes as circles with numbers inside
   - Lines connecting parent to children
   - Show insertion/search by highlighting the path

## YOUR TASK
Create a UNIFIED VISUAL PLAN that:
1. Shows the ACTUAL MECHANISM being explained
2. Looks like a 3Blue1Brown or Stanford lecture diagram
3. Flows as ONE CONTINUOUS ANIMATION (no cuts)

## CRITICAL: NO VISIBLE TRANSITIONS
The video must feel like ONE FLOWING ANIMATION - not separate scenes cutting together.
- NO fade-to-black
- NO wipes or slides
- NO obvious "scene changes"
- The visual EVOLVES continuously
- Elements MORPH, GROW, MOVE - they don't disappear and reappear

### 2D vs 3D Decision
Set renderMode to "3d" ONLY when spatial depth genuinely helps understanding:
- Molecular/atomic structures, protein folding
- 3D geometry (rotations, cross-sections, volumes)
- Physics (orbits, force fields, wave propagation)
- Architecture, mechanical systems

Default to "2d" for everything else:
- Data structures, algorithms, flowcharts
- System architecture, processes
- Statistics, charts, timelines

## Your Process

### Step 1: Deeply Understand the Content
- Read the ENTIRE transcript carefully
- Identify the EXACT topic and domain
- List all technical terms and concepts mentioned
- Understand the narrative flow (problem → solution, intro → deep dive, etc.)

### Step 2: Choose a RELEVANT Visual Metaphor
The visual MUST directly represent the topic:
- For "heap sort" → animated heap tree structure
- For "load balancing" → servers with traffic distribution
- For "caching" → fast storage layer between client and database
- For "recursion" → function calling itself visually

NEVER choose a metaphor unrelated to the topic.

### Step 3: Plan CONTINUOUS Evolution
The visual should EVOLVE, not switch:
- Frame 1-100: Structure appears, initial state
- Frame 100-200: First operation/change happens
- Frame 200-300: Continue evolving, highlight key insight
- etc.

### Step 4: Define Moments (Not Scenes)
Each moment focuses on a different ASPECT of the same visual:
- The visual smoothly shifts attention, it doesn't cut
- Elements that were there STAY there (maybe fade slightly, move aside)

## Output Format
Return a JSON object with:
- coreConcept: One sentence summary
- targetAudience: Who this is for
- renderMode: "2d" or "3d" (default "2d")
- visualMetaphor: The SINGLE evolving visual (e.g., "A heap data structure that builds up and reorganizes")
- visualDescription: How this ONE visual evolves throughout the video
- persistentElements: Elements that are ALWAYS visible (the core structure)
- colorScheme: { primary, secondary, accent, background } hex colors
- scenes: Array of "moments" in the continuous animation

Each scene/moment needs:
- id: "scene_1", etc.
- startMs, endMs: Timing
- transcript: What's being said
- visualFocus: Where attention should be (part of the SAME visual)
- visualAction: What changes/moves (NOT "transition to X", but "the heap grows" or "highlight shifts to root")
- transitionFromPrevious: How it FLOWS from previous (should be "continuous" or describe smooth evolution like "camera zooms in on root node")
- keyElements: Parts of the visual to animate
- startState: How elements look at the START of this scene (should match end of previous scene!)
- endState: How elements look at the END of this scene (becomes startState for next scene)

CRITICAL FOR CONTINUITY:
- Scene 2's startState MUST match Scene 1's endState
- Scene 3's startState MUST match Scene 2's endState
- This is how we achieve seamless flow!

IMPORTANT:
- Output ONLY valid JSON
- Every scene should feel like a continuation, not a new scene
- The same visual structure should be recognizable throughout
- startState and endState create a CHAIN that ensures perfect continuity`;

/**
 * Analyze transcript and create a unified visual plan
 */
export async function createVisualPlan(
  words: TranscriptWord[],
  fps: number,
  options?: {
    openai?: OpenAI;
    llmModel?: string;
    stylePreset?: string;
    onLog?: (msg: string) => void;
  }
): Promise<VisualPlan> {
  const log = options?.onLog || ((msg: string) => logger.info(msg));

  const openai = options?.openai || new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const model = options?.llmModel || 'gpt-4o';

  if (!words || words.length === 0) {
    throw new Error('No transcript provided');
  }

  // Format full transcript
  const fullTranscript = formatFullTranscript(words);
  const totalDurationMs = words[words.length - 1].endMs;
  const totalFrames = Math.ceil((totalDurationMs / 1000) * fps);

  log(`Analyzing full transcript: ${words.length} words, ${Math.round(totalDurationMs / 1000)}s`);

  const userPrompt = `Analyze this transcript and create a unified visual plan:

## Full Transcript
${fullTranscript}

## Technical Details
- Total duration: ${totalDurationMs}ms (${Math.round(totalDurationMs / 1000)} seconds)
- FPS: ${fps}
- Total frames: ${totalFrames}
- Style: ${options?.stylePreset || 'modern'}

## Your Task
1. First, understand what this video is teaching
2. Choose ONE powerful visual metaphor that can represent the entire concept
3. Plan how that metaphor evolves throughout the video
4. Break into scenes (2-10 seconds each) where each scene shows a different aspect

Remember: The viewer should understand the concept just by watching - no reading required.

Output the visual plan as JSON.`;

  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: PLANNER_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 4096,
    });

    let content = response.choices[0]?.message?.content || '{}';

    // Clean up response
    content = content
      .replace(/^```(?:json)?\n?/i, '')
      .replace(/\n?```$/i, '')
      .trim();

    const plan = JSON.parse(content) as VisualPlan;

    // Normalize renderMode — default to '2d' unless explicitly '3d'
    plan.renderMode = plan.renderMode === '3d' ? '3d' : '2d';

    // Normalize persistentElements — the AI sometimes returns a string instead of an array
    if (!Array.isArray(plan.persistentElements)) {
      plan.persistentElements = typeof plan.persistentElements === 'string'
        ? (plan.persistentElements as string).split(',').map((s: string) => s.trim()).filter(Boolean)
        : [];
    }

    // Add frame calculations to scenes and normalize keyElements
    plan.scenes = plan.scenes.map((scene, index) => ({
      ...scene,
      id: scene.id || `scene_${index + 1}`,
      keyElements: Array.isArray(scene.keyElements)
        ? scene.keyElements
        : typeof scene.keyElements === 'string'
          ? (scene.keyElements as string).split(',').map((s: string) => s.trim()).filter(Boolean)
          : [],
      startFrame: Math.floor((scene.startMs / 1000) * fps),
      endFrame: Math.ceil((scene.endMs / 1000) * fps),
      durationFrames: Math.ceil(((scene.endMs - scene.startMs) / 1000) * fps),
    }));

    log(`Visual plan created: "${plan.visualMetaphor}" with ${plan.scenes.length} scenes`);

    return plan;

  } catch (error) {
    log(`Visual planning failed: ${error}`);
    throw error;
  }
}

/**
 * Format transcript with timestamps for analysis
 */
function formatFullTranscript(words: TranscriptWord[]): string {
  // Group into sentences
  const sentences: Array<{ startMs: number; endMs: number; text: string }> = [];
  let currentSentence: TranscriptWord[] = [];
  let sentenceStartMs = 0;

  for (const word of words) {
    if (currentSentence.length === 0) {
      sentenceStartMs = word.startMs;
    }

    currentSentence.push(word);

    const text = word.text.trim();
    const isEndOfSentence = /[.!?]$/.test(text);

    if (isEndOfSentence) {
      sentences.push({
        startMs: sentenceStartMs,
        endMs: word.endMs,
        text: currentSentence.map(w => w.text).join(' '),
      });
      currentSentence = [];
    }
  }

  // Add remaining words
  if (currentSentence.length > 0) {
    sentences.push({
      startMs: sentenceStartMs,
      endMs: currentSentence[currentSentence.length - 1].endMs,
      text: currentSentence.map(w => w.text).join(' '),
    });
  }

  return sentences
    .map(s => `[${formatTime(s.startMs)} - ${formatTime(s.endMs)}] ${s.text}`)
    .join('\n');
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
