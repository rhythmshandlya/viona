import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { PhraseLayout } from './PhraseLayout';
import type {
  WordDirective,
  CinematicFonts,
  CinematicColors,
  CinematicScales,
  CinematicWordWord,
} from './CinematicWord';
import type { AnimationConfig } from '../animations/types';

// --- Inline types (caption-analysis.ts is not exported from @viona/shared) ---

type PhraseLayoutType = 'single-line' | 'stacked' | 'split' | 'cascade';

interface PhraseGroup {
  wordIndices: number[];
  layout: PhraseLayoutType;
  alignment: 'center' | 'left' | 'right';
  durationMs: number;
}

interface SentenceDirective {
  wordRange: [number, number];
  phraseGroups: PhraseGroup[];
  mood: 'dramatic' | 'urgent' | 'curious' | 'calm' | 'impactful';
  punctuationEffect?: 'question-pop' | 'exclaim-shake' | 'ellipsis-fade' | 'none';
}

interface CaptionAnalysis {
  words: WordDirective[];
  sentences: SentenceDirective[];
  speakerEmphasis: Array<{
    wordIndex: number;
    confidence: number;
    type: 'slow-delivery' | 'pause-before' | 'pause-after' | 'pace-change';
    durationRatio: number;
  }>;
  metadata: {
    analyzedAt: string;
    model: string;
    version: number;
  };
}

// --- Props ---

export interface CinematicSubtitleProps {
  words: { text: string; startMs: number; endMs: number }[];
  analysis: CaptionAnalysis;
  startMs: number;
  endMs: number;
  style: {
    fontFamily: string;
    fontSize: number;
    animation: AnimationConfig;
    position: { anchor: string; offsetX: number; offsetY: number; textAlign: string };
    useCinematicRenderer?: boolean;
    cinematicFonts?: { boldSans: string; elegantCursive: string; default: string };
    cinematicColors?: { primary: string; accent: string; accentGradient?: string; glow: string };
    cinematicScales?: { hero: number; accent: number; normal: number; whisper: number };
  };
  canvasWidth: number;
  canvasHeight: number;
}

// --- Default Configs ---

const DEFAULT_FONTS: CinematicFonts = {
  boldSans: 'Impact, Arial Black, sans-serif',
  elegantCursive: 'Georgia, serif',
  default: 'Arial, sans-serif',
};

const DEFAULT_COLORS: CinematicColors = {
  primary: '#FFFFFF',
  accent: '#FFD700',
  glow: '#FFD700',
};

const DEFAULT_SCALES: CinematicScales = {
  hero: 1.8,
  accent: 1.3,
  normal: 1.0,
  whisper: 0.7,
};

// --- Helpers ---

/**
 * Find the active sentence given the current playback time.
 * Uses word timing from the first and last word in the sentence's wordRange.
 * Applies a 100ms lead-in and 50ms tail for smooth transitions.
 */
function findActiveSentence(
  sentences: SentenceDirective[],
  words: { text: string; startMs: number; endMs: number }[],
  currentMs: number,
): SentenceDirective | null {
  for (const sentence of sentences) {
    const [startIdx, endIdx] = sentence.wordRange;
    const firstWord = words[startIdx];
    const lastWordIdx = Math.max(startIdx, endIdx - 1);
    const lastWord = words[lastWordIdx];

    if (!firstWord || !lastWord) continue;

    const sentenceStartMs = firstWord.startMs - 100; // 100ms lead-in
    const sentenceEndMs = lastWord.endMs + 50;       // 50ms tail

    if (currentMs >= sentenceStartMs && currentMs < sentenceEndMs) {
      return sentence;
    }
  }
  return null;
}

/**
 * Find the active phrase group within a sentence given the current playback time.
 * Each phraseGroup occupies durationMs starting from the first word's startMs.
 */
function findActivePhrase(
  sentence: SentenceDirective,
  words: { text: string; startMs: number; endMs: number }[],
  currentMs: number,
): { phraseGroup: PhraseGroup; phraseStartMs: number } | null {
  for (const phraseGroup of sentence.phraseGroups) {
    if (phraseGroup.wordIndices.length === 0) continue;

    const firstIdx = phraseGroup.wordIndices[0];
    const firstWord = words[firstIdx];
    if (!firstWord) continue;

    const phraseStartMs = firstWord.startMs;
    // Use actual word timing for phrase end (last word's endMs), falling back to durationMs
    const lastIdx = phraseGroup.wordIndices[phraseGroup.wordIndices.length - 1];
    const lastWord = words[lastIdx];
    const phraseEndMs = lastWord ? lastWord.endMs : phraseStartMs + phraseGroup.durationMs;

    if (currentMs >= phraseStartMs - 100 && currentMs < phraseEndMs + 50) {
      return { phraseGroup, phraseStartMs };
    }
  }
  return null;
}

/**
 * Map anchor string to flex justification for vertical positioning.
 */
function anchorToJustifyContent(anchor: string): React.CSSProperties['justifyContent'] {
  switch (anchor.toLowerCase()) {
    case 'top':
      return 'flex-start';
    case 'center':
      return 'center';
    case 'bottom':
    default:
      return 'flex-end';
  }
}

// --- Component ---

export const CinematicSubtitle: React.FC<CinematicSubtitleProps> = ({
  words,
  analysis,
  startMs,
  style,
  canvasWidth,
  canvasHeight,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Absolute current time in ms
  const currentMs = startMs + (frame / fps) * 1000;

  // Resolve cinematic config with defaults
  const fonts: CinematicFonts = style.cinematicFonts
    ? {
        boldSans: style.cinematicFonts.boldSans,
        elegantCursive: style.cinematicFonts.elegantCursive,
        default: style.cinematicFonts.default,
      }
    : { ...DEFAULT_FONTS, default: style.fontFamily || DEFAULT_FONTS.default };

  const colors: CinematicColors = style.cinematicColors ?? DEFAULT_COLORS;
  const scales: CinematicScales = style.cinematicScales ?? DEFAULT_SCALES;

  // Find active sentence
  const activeSentence = findActiveSentence(analysis.sentences, words, currentMs);

  // Find active phrase group within sentence
  const activePhraseResult = activeSentence
    ? findActivePhrase(activeSentence, words, currentMs)
    : null;

  // Position anchor → flex layout
  const { anchor, offsetX, offsetY } = style.position;
  const justifyContent = anchorToJustifyContent(anchor);

  // Outer container: absolute fill, flex column, vertical anchoring
  const outerStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: canvasWidth,
    height: canvasHeight,
    display: 'flex',
    flexDirection: 'column',
    justifyContent,
    alignItems: 'center',
    pointerEvents: 'none',
    transform: `translate(${offsetX}px, ${offsetY}px)`,
  };

  // Nothing to render if no active phrase
  if (!activePhraseResult) {
    return <div style={outerStyle} />;
  }

  const { phraseGroup, phraseStartMs } = activePhraseResult;

  // Build word/directive arrays for PhraseLayout (only words in this phraseGroup)
  const phraseWords: CinematicWordWord[] = phraseGroup.wordIndices.map((idx) => words[idx]);
  const phraseDirectives: WordDirective[] = phraseGroup.wordIndices.map((idx) => {
    // Find directive for this word index; fallback to default
    const directive = analysis.words.find((d) => d.wordIndex === idx);
    if (directive) return directive;
    return {
      wordIndex: idx,
      tier: 'normal',
      fontRole: 'default',
      animation: 'fade-rise',
      entryDelayMs: 0,
      colorRole: 'primary',
    } satisfies WordDirective;
  });

  return (
    <div style={outerStyle}>
      <PhraseLayout
        words={phraseWords}
        directives={phraseDirectives}
        layout={phraseGroup.layout}
        alignment={phraseGroup.alignment}
        fonts={fonts}
        colors={colors}
        scales={scales}
        baseFontSize={style.fontSize}
        canvasWidth={canvasWidth}
        defaultAnimation={style.animation}
        phraseStartMs={phraseStartMs}
        phraseDurationMs={phraseGroup.durationMs}
        captionStartMs={startMs}
      />
    </div>
  );
};

export default CinematicSubtitle;
