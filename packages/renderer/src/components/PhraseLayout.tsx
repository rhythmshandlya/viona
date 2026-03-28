import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { CinematicWord } from './CinematicWord';
import type {
  WordDirective,
  CinematicFonts,
  CinematicColors,
  CinematicScales,
  CinematicWordWord,
} from './CinematicWord';
import type { AnimationConfig } from '../animations/types';

// --- Props ---

export interface PhraseLayoutProps {
  words: CinematicWordWord[];
  directives: WordDirective[];
  layout: 'single-line' | 'stacked' | 'split' | 'cascade';
  alignment: 'center' | 'left' | 'right';
  fonts: CinematicFonts;
  colors: CinematicColors;
  scales: CinematicScales;
  baseFontSize: number;
  canvasWidth: number;
  defaultAnimation: AnimationConfig;
  phraseStartMs: number;
  phraseDurationMs: number;
  captionStartMs: number;
}

// --- Helper ---

function alignmentToJustify(
  alignment: 'center' | 'left' | 'right',
): React.CSSProperties['justifyContent'] {
  switch (alignment) {
    case 'center':
      return 'center';
    case 'left':
      return 'flex-start';
    case 'right':
      return 'flex-end';
  }
}

function alignmentToAlign(
  alignment: 'center' | 'left' | 'right',
): React.CSSProperties['alignItems'] {
  return alignmentToJustify(alignment) as React.CSSProperties['alignItems'];
}

function alignmentToTextAlign(
  alignment: 'center' | 'left' | 'right',
): React.CSSProperties['textAlign'] {
  return alignment;
}

// --- Component ---

export const PhraseLayout: React.FC<PhraseLayoutProps> = ({
  words,
  directives,
  layout,
  alignment,
  fonts,
  colors,
  scales,
  baseFontSize,
  canvasWidth,
  defaultAnimation,
  phraseStartMs,
  phraseDurationMs,
  captionStartMs,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const phraseEndMs = phraseStartMs + phraseDurationMs;
  const currentMs = captionStartMs + (frame / fps) * 1000;

  // Phrase-level opacity: fade in at start, hold, fade out at end
  const phraseOpacity = interpolate(
    currentMs,
    [phraseStartMs - 100, phraseStartMs, phraseEndMs - 50, phraseEndMs],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  const containerBase: React.CSSProperties = {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: alignmentToAlign(alignment),
    justifyContent: alignmentToJustify(alignment),
    textAlign: alignmentToTextAlign(alignment),
    opacity: phraseOpacity,
  };

  // Shared helper: render a single word
  const renderWord = (index: number, cascadeExtraDelayMs = 0) => {
    const word = words[index];
    const directive = directives[index];

    const effectiveWord: CinematicWordWord = cascadeExtraDelayMs > 0
      ? {
          ...word,
          startMs: word.startMs + cascadeExtraDelayMs,
        }
      : word;

    return (
      <CinematicWord
        key={index}
        word={effectiveWord}
        directive={directive}
        fonts={fonts}
        colors={colors}
        scales={scales}
        baseFontSize={baseFontSize}
        canvasWidth={canvasWidth}
        defaultAnimation={defaultAnimation}
        captionStartMs={captionStartMs}
      />
    );
  };

  // Shared helper: render a row of words
  const renderWordRow = (
    indices: number[],
    cascadeExtraDelayMsPerIndex?: (i: number) => number,
  ) => (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: '0.2em',
        justifyContent: alignmentToJustify(alignment),
        alignItems: 'baseline',
      }}
    >
      {indices.map((idx) =>
        renderWord(idx, cascadeExtraDelayMsPerIndex ? cascadeExtraDelayMsPerIndex(idx) : 0),
      )}
    </div>
  );

  // --- Layout: single-line ---
  if (layout === 'single-line') {
    return (
      <div
        style={{
          ...containerBase,
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: '0.2em',
          alignItems: 'baseline',
        }}
      >
        {words.map((_, i) => renderWord(i))}
      </div>
    );
  }

  // --- Layout: stacked ---
  if (layout === 'stacked') {
    // Find the first hero word index
    const heroIndex = directives.findIndex((d) => d.tier === 'hero');

    if (heroIndex === -1) {
      // No hero found, fall back to single-line stacked
      return (
        <div style={containerBase}>
          {renderWordRow(words.map((_, i) => i))}
        </div>
      );
    }

    const beforeIndices = words.map((_, i) => i).filter((i) => i < heroIndex);
    const afterIndices = words.map((_, i) => i).filter((i) => i > heroIndex);

    return (
      <div style={containerBase}>
        {beforeIndices.length > 0 && renderWordRow(beforeIndices)}
        {/* Hero word on its own line */}
        <div
          style={{
            display: 'flex',
            justifyContent: alignmentToJustify(alignment),
            alignItems: 'center',
          }}
        >
          {renderWord(heroIndex)}
        </div>
        {afterIndices.length > 0 && renderWordRow(afterIndices)}
      </div>
    );
  }

  // --- Layout: split ---
  if (layout === 'split') {
    const midpoint = Math.ceil(words.length / 2);
    const firstGroupIndices = words.map((_, i) => i).filter((i) => i < midpoint);
    const secondGroupIndices = words.map((_, i) => i).filter((i) => i >= midpoint);

    return (
      <div style={containerBase}>
        {firstGroupIndices.length > 0 && renderWordRow(firstGroupIndices)}
        {secondGroupIndices.length > 0 && renderWordRow(secondGroupIndices)}
      </div>
    );
  }

  // --- Layout: cascade ---
  // Words appear one by one with staggered timing (120ms per word)
  return (
    <div style={containerBase}>
      {renderWordRow(
        words.map((_, i) => i),
        (i) => i * 120,
      )}
    </div>
  );
};

export default PhraseLayout;
