import { readFile } from 'fs/promises';

interface Word {
  text: string;
  startMs: number;
  endMs: number;
  confidence: number;
}

interface Segment {
  text: string;
  startMs: number;
  endMs: number;
}

interface Transcript {
  words: Word[];
  segments: Segment[];
  language: string;
}

// Tier 1 fillers — always safe to cut
const TIER_1_FILLERS = new Set(['um', 'uh', 'er', 'ah', 'hmm', 'mmm', 'erm', 'uhm']);

// Tier 2 fillers — context-dependent
const TIER_2_FILLERS = new Set(['you know', 'i mean', 'like', 'so', 'basically', 'actually', 'literally', 'sort of', 'kind of']);

interface FillerDetection {
  wordIndex: number;
  text: string;
  startMs: number;
  endMs: number;
  tier: 1 | 2;
}

interface SilenceDetection {
  startMs: number;
  endMs: number;
  durationMs: number;
  tier: 1 | 3; // 1 = >2000ms (remove), 3 = 750-2000ms (shorten)
}

interface RetakeDetection {
  segmentAIndex: number;
  segmentBIndex: number;
  overlapRatio: number;
}

interface FalseStartDetection {
  segmentIndex: number;
  wordCount: number;
}

export interface TranscriptAnalysis {
  fillers: FillerDetection[];
  silences: SilenceDetection[];
  retakes: RetakeDetection[];
  falseStarts: FalseStartDetection[];
  contentType: 'tutorial' | 'podcast' | 'interview' | 'vlog' | 'presentation' | 'keynote';
  stats: {
    totalWords: number;
    totalDurationMs: number;
    fillerCount: number;
    silenceCount: number;
    estimatedTrimMs: number;
  };
}

function detectFillers(words: Word[]): FillerDetection[] {
  const fillers: FillerDetection[] = [];

  for (let i = 0; i < words.length; i++) {
    const w = words[i].text.toLowerCase().replace(/[.,!?]/g, '');

    // Tier 1: exact match (must be at least 150ms to avoid false positives)
    if (TIER_1_FILLERS.has(w) && words[i].endMs - words[i].startMs >= 150) {
      fillers.push({ wordIndex: i, text: w, startMs: words[i].startMs, endMs: words[i].endMs, tier: 1 });
      continue;
    }

    // Tier 2: bigrams
    if (i < words.length - 1) {
      const bigram = `${w} ${words[i + 1].text.toLowerCase().replace(/[.,!?]/g, '')}`;
      if (TIER_2_FILLERS.has(bigram)) {
        fillers.push({
          wordIndex: i,
          text: bigram,
          startMs: words[i].startMs,
          endMs: words[i + 1].endMs,
          tier: 2,
        });
      }
    }
  }

  return fillers;
}

function detectSilences(words: Word[]): SilenceDetection[] {
  const silences: SilenceDetection[] = [];

  for (let i = 0; i < words.length - 1; i++) {
    const gap = words[i + 1].startMs - words[i].endMs;

    if (gap > 2000) {
      silences.push({ startMs: words[i].endMs, endMs: words[i + 1].startMs, durationMs: gap, tier: 1 });
    } else if (gap >= 750) {
      silences.push({ startMs: words[i].endMs, endMs: words[i + 1].startMs, durationMs: gap, tier: 3 });
    }
  }

  return silences;
}

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[.,!?]/g, '').split(/\s+/).filter(Boolean);
}

function detectRetakes(segments: Segment[]): RetakeDetection[] {
  const retakes: RetakeDetection[] = [];

  for (let i = 0; i < segments.length - 1; i++) {
    const tokensA = tokenize(segments[i].text);
    const tokensB = tokenize(segments[i + 1].text);
    if (tokensA.length < 3 || tokensB.length < 3) continue;

    const setA = new Set(tokensA);
    const overlap = tokensB.filter(t => setA.has(t)).length;
    const ratio = overlap / Math.min(tokensA.length, tokensB.length);

    if (ratio > 0.7) {
      retakes.push({ segmentAIndex: i, segmentBIndex: i + 1, overlapRatio: ratio });
    }
  }

  return retakes;
}

function detectFalseStarts(segments: Segment[]): FalseStartDetection[] {
  const starts: FalseStartDetection[] = [];

  for (let i = 0; i < segments.length - 1; i++) {
    const tokens = tokenize(segments[i].text);
    const hasTerminal = /[.!?]$/.test(segments[i].text.trim());

    if (tokens.length < 5 && !hasTerminal) {
      starts.push({ segmentIndex: i, wordCount: tokens.length });
    }
  }

  return starts;
}

function detectContentType(segments: Segment[]): TranscriptAnalysis['contentType'] {
  const fullText = segments.map(s => s.text).join(' ').toLowerCase();

  const hasMultipleSpeakers = /\b(interviewer|host|guest|speaker [0-9])\b/.test(fullText);
  const hasQuestionAnswer = (fullText.match(/\?/g) || []).length > segments.length * 0.3;
  const hasInstructional = /\b(step [0-9]|first|then|next|finally|how to|tutorial)\b/.test(fullText);
  const hasPresentation = /\b(slide|next slide|as you can see|chart|graph)\b/.test(fullText);

  if (hasPresentation) return 'presentation';
  if (hasMultipleSpeakers && hasQuestionAnswer) return 'interview';
  if (hasMultipleSpeakers) return 'podcast';
  if (hasInstructional) return 'tutorial';
  return 'vlog';
}

export function analyzeTranscript(transcript: Transcript): TranscriptAnalysis {
  const fillers = detectFillers(transcript.words);
  const silences = detectSilences(transcript.words);
  const retakes = detectRetakes(transcript.segments);
  const falseStarts = detectFalseStarts(transcript.segments);
  const contentType = detectContentType(transcript.segments);

  const estimatedTrimMs =
    fillers.reduce((sum, f) => sum + (f.endMs - f.startMs), 0) +
    silences.filter(s => s.tier === 1).reduce((sum, s) => sum + s.durationMs - 400, 0) +
    silences.filter(s => s.tier === 3).reduce((sum, s) => sum + s.durationMs - 450, 0);

  const totalDurationMs = transcript.words.length > 0
    ? transcript.words[transcript.words.length - 1].endMs
    : 0;

  return {
    fillers,
    silences,
    retakes,
    falseStarts,
    contentType,
    stats: {
      totalWords: transcript.words.length,
      totalDurationMs,
      fillerCount: fillers.length,
      silenceCount: silences.length,
      estimatedTrimMs,
    },
  };
}

/**
 * MCP tool wrapper for analyzeTranscript — reads transcript from disk.
 */
export const analyzeTranscriptTool = {
  name: 'analyze_transcript',
  description:
    'Deterministic filler/silence/retake/false-start detection on the current transcript. ' +
    'Returns structured analysis with tier classifications and content type detection. ' +
    'No arguments — reads /workspace/docs/transcript.json automatically.',
  input_schema: {
    type: 'object' as const,
    properties: {} as Record<string, never>,
    required: [] as string[],
  },
  async execute(_input: Record<string, unknown>): Promise<string> {
    try {
      const raw = await readFile('/workspace/docs/transcript.json', 'utf-8');
      const transcript: Transcript = JSON.parse(raw);
      const analysis = analyzeTranscript(transcript);
      return JSON.stringify(analysis, null, 2);
    } catch (err: any) {
      return `Failed to analyze transcript: ${err.message}`;
    }
  },
};
