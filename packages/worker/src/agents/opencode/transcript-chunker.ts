/**
 * Transcript Chunker
 *
 * Analyzes transcript and splits it into semantic scenes based on:
 * - Topic changes
 * - Content type changes (intro, problem, solution, explanation, etc.)
 * - Natural break points in narrative flow
 */

import OpenAI from 'openai';
import { logger } from '../../logger.js';

export interface TranscriptWord {
  text: string;
  startMs: number;
  endMs: number;
}

export interface TranscriptScene {
  id: string;
  startMs: number;
  endMs: number;
  startFrame: number;
  endFrame: number;
  durationFrames: number;
  transcript: string;
  contentType: 'intro_hook' | 'problem_statement' | 'solution_introduction' | 'concept_explanation' | 'comparison' | 'step_by_step' | 'conclusion' | 'transition';
  visualSuggestion: string;
  animationLevel: 'minimal' | 'medium' | 'high';
  keyElements: string[];
}

export interface ChunkedTranscript {
  scenes: TranscriptScene[];
  totalDurationMs: number;
  totalFrames: number;
}

const CHUNKING_SYSTEM_PROMPT = `You are a creative visual storyteller analyzing transcripts to plan animated explainer videos.

Your task is to:
1. Split the transcript into SEMANTIC SCENES based on concept changes
2. For each scene, suggest a CREATIVE VISUAL METAPHOR that conveys the meaning WITHOUT text

## Scene Splitting Rules
- New concept/topic = new scene
- Minimum 2 seconds per scene
- Maximum 15 seconds per scene (split longer segments)
- Use natural sentence boundaries

## Visual Metaphor Guidelines
Think like a motion graphics artist:
- What REAL-WORLD OBJECT could represent this concept?
- What MOTION would make it instantly understandable?
- How can you show this WITHOUT any text?

Examples of good visual metaphors:
- "handling millions of requests" → flood of particles flowing through a funnel
- "sorting algorithm" → colored bars rearranging themselves
- "load balancer" → scale with weights shifting between sides
- "caching" → items being copied to a nearby shelf for quick access
- "encryption" → lock closing around data, key animating
- "API call" → arrow traveling between two boxes and returning
- "database query" → spotlight searching through rows of data
- "memory leak" → container slowly filling up and overflowing
- "recursion" → shape containing smaller version of itself
- "parallel processing" → multiple lanes of traffic vs single lane

## Output Format
Return a JSON array. Each scene needs:
- id: "scene_1", "scene_2", etc.
- startMs: Start time in milliseconds
- endMs: End time in milliseconds
- transcript: The text for this scene
- contentType: intro_hook | problem_statement | solution_introduction | concept_explanation | comparison | step_by_step | conclusion | transition
- visualSuggestion: SPECIFIC visual metaphor description (not generic like "show diagram")
- animationLevel: minimal | medium | high
- keyElements: Array of specific visual elements (shapes, objects, colors)

Example good visualSuggestion: "Flood of red task particles overwhelming a single processor box, causing it to flash warning and overflow"
Example bad visualSuggestion: "Show the problem with tasks" (too vague)

Output ONLY valid JSON, no markdown.`;

/**
 * Chunk transcript into semantic scenes using LLM
 */
export async function chunkTranscript(
  words: TranscriptWord[],
  fps: number,
  options?: {
    openai?: OpenAI;
    onLog?: (msg: string) => void;
  }
): Promise<ChunkedTranscript> {
  const log = options?.onLog || ((msg: string) => logger.info(msg));

  // Create OpenAI client if not provided
  const openai = options?.openai || new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  // Format transcript with timestamps
  const formattedTranscript = formatTranscriptForChunking(words);

  if (!formattedTranscript || words.length === 0) {
    log('No transcript to chunk, returning empty scenes');
    return {
      scenes: [],
      totalDurationMs: 0,
      totalFrames: 0,
    };
  }

  const totalDurationMs = words[words.length - 1].endMs;
  const totalFrames = Math.ceil((totalDurationMs / 1000) * fps);

  log(`Chunking transcript: ${words.length} words, ${totalDurationMs}ms duration`);

  const userPrompt = `Analyze this transcript and split it into semantic scenes:

TRANSCRIPT (with timestamps):
${formattedTranscript}

METADATA:
- Total duration: ${totalDurationMs}ms
- FPS: ${fps}
- Total frames: ${totalFrames}

Return a JSON array of scenes. Remember:
- Each scene should represent ONE visual concept
- Minimum 2 seconds per scene (except transitions)
- Maximum 15 seconds per scene
- Split based on CONTENT changes, not just punctuation`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: CHUNKING_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3, // Lower temperature for more consistent chunking
      max_tokens: 4096,
    });

    let content = response.choices[0]?.message?.content || '[]';

    // Clean up response
    content = content
      .replace(/^```(?:json)?\n?/i, '')
      .replace(/\n?```$/i, '')
      .trim();

    const rawScenes = JSON.parse(content);

    // Process and validate scenes
    const scenes: TranscriptScene[] = rawScenes.map((scene: any, index: number) => ({
      id: scene.id || `scene_${index + 1}`,
      startMs: scene.startMs,
      endMs: scene.endMs,
      startFrame: Math.floor((scene.startMs / 1000) * fps),
      endFrame: Math.ceil((scene.endMs / 1000) * fps),
      durationFrames: Math.ceil(((scene.endMs - scene.startMs) / 1000) * fps),
      transcript: scene.transcript,
      contentType: scene.contentType || 'concept_explanation',
      visualSuggestion: scene.visualSuggestion || 'Animated visual',
      animationLevel: scene.animationLevel || 'medium',
      keyElements: scene.keyElements || [],
    }));

    log(`Chunked into ${scenes.length} scenes`);

    return {
      scenes,
      totalDurationMs,
      totalFrames,
    };

  } catch (error) {
    log(`Chunking failed, falling back to time-based splitting: ${error}`);

    // Fallback: split by time (every 5 seconds)
    return fallbackTimeBasedChunking(words, fps);
  }
}

/**
 * Format transcript for LLM analysis
 */
function formatTranscriptForChunking(words: TranscriptWord[]): string {
  if (!words || words.length === 0) return '';

  // Group words into sentences/segments
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

    if (isEndOfSentence) {
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

  return segments
    .map(s => `[${s.startMs}ms - ${s.endMs}ms] ${s.text}`)
    .join('\n');
}

/**
 * Fallback chunking by time intervals
 */
function fallbackTimeBasedChunking(words: TranscriptWord[], fps: number): ChunkedTranscript {
  if (!words || words.length === 0) {
    return { scenes: [], totalDurationMs: 0, totalFrames: 0 };
  }

  const totalDurationMs = words[words.length - 1].endMs;
  const totalFrames = Math.ceil((totalDurationMs / 1000) * fps);
  const sceneIntervalMs = 5000; // 5 seconds per scene

  const scenes: TranscriptScene[] = [];
  let sceneIndex = 0;
  let currentStartMs = 0;

  while (currentStartMs < totalDurationMs) {
    const endMs = Math.min(currentStartMs + sceneIntervalMs, totalDurationMs);

    // Get transcript for this time range
    const sceneWords = words.filter(w => w.startMs >= currentStartMs && w.startMs < endMs);
    const transcript = sceneWords.map(w => w.text).join(' ');

    if (transcript.trim()) {
      scenes.push({
        id: `scene_${sceneIndex + 1}`,
        startMs: currentStartMs,
        endMs,
        startFrame: Math.floor((currentStartMs / 1000) * fps),
        endFrame: Math.ceil((endMs / 1000) * fps),
        durationFrames: Math.ceil(((endMs - currentStartMs) / 1000) * fps),
        transcript,
        contentType: sceneIndex === 0 ? 'intro_hook' : 'concept_explanation',
        visualSuggestion: 'Animated visual for this segment',
        animationLevel: 'medium',
        keyElements: [],
      });
      sceneIndex++;
    }

    currentStartMs = endMs;
  }

  return { scenes, totalDurationMs, totalFrames };
}
