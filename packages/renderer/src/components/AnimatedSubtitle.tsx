import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';

export interface SubtitleWord {
  text: string;
  startMs: number;
  endMs: number;
}

export interface SubtitleStyle {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  color?: string;
  activeColor?: string;
  backgroundColor?: string;
  activeBackgroundColor?: string;
  position?: 'top' | 'center' | 'bottom';
  animation?: 'none' | 'pop' | 'fade' | 'highlight' | 'karaoke';
}

export interface AnimatedSubtitleProps {
  words: SubtitleWord[];
  startMs: number;
  endMs: number;
  style?: SubtitleStyle;
}

const defaultStyle: SubtitleStyle = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 48,
  fontWeight: 700,
  color: '#ffffff',
  activeColor: '#ffff00',
  backgroundColor: 'transparent',
  activeBackgroundColor: 'transparent',
  position: 'bottom',
  animation: 'highlight',
};

export const AnimatedSubtitle: React.FC<AnimatedSubtitleProps> = ({
  words,
  startMs,
  style: customStyle = {},
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const style = { ...defaultStyle, ...customStyle };

  const currentTimeMs = (frame / fps) * 1000;

  // Position styles
  const positionStyles: React.CSSProperties = {
    position: 'absolute',
    left: '50%',
    transform: 'translateX(-50%)',
    ...(style.position === 'top' && { top: '10%' }),
    ...(style.position === 'center' && { top: '50%', transform: 'translate(-50%, -50%)' }),
    ...(style.position === 'bottom' && { bottom: '15%' }),
  };

  return (
    <div
      style={{
        ...positionStyles,
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        maxWidth: '80%',
        gap: '8px',
      }}
    >
      {words.map((word, index) => (
        <Word
          key={index}
          word={word}
          style={style}
          currentTimeMs={currentTimeMs}
          globalStartMs={startMs}
          fps={fps}
        />
      ))}
    </div>
  );
};

interface WordProps {
  word: SubtitleWord;
  style: SubtitleStyle;
  currentTimeMs: number;
  globalStartMs: number;
  fps: number;
}

const Word: React.FC<WordProps> = ({
  word,
  style,
  currentTimeMs,
  globalStartMs,
  fps,
}) => {
  // Calculate if this word is currently active
  const wordStartMs = word.startMs;
  const wordEndMs = word.endMs;

  const isActive = currentTimeMs >= wordStartMs && currentTimeMs < wordEndMs;
  const hasAppeared = currentTimeMs >= wordStartMs;
  const progress = hasAppeared
    ? Math.min((currentTimeMs - wordStartMs) / (wordEndMs - wordStartMs), 1)
    : 0;

  // Animation calculations
  let scale = 1;
  let opacity = 1;
  let backgroundColor = style.backgroundColor;
  let color = style.color;

  switch (style.animation) {
    case 'pop':
      if (isActive) {
        // Pop in effect
        const popProgress = Math.min(progress * 3, 1);
        scale = interpolate(popProgress, [0, 0.5, 1], [0.8, 1.1, 1]);
      }
      color = isActive ? style.activeColor : (hasAppeared ? style.color : style.color);
      break;

    case 'fade':
      opacity = hasAppeared ? 1 : 0.3;
      color = isActive ? style.activeColor : (hasAppeared ? style.color : '#666666');
      break;

    case 'highlight':
      color = isActive ? style.activeColor : (hasAppeared ? style.color : style.color);
      backgroundColor = isActive ? style.activeBackgroundColor : style.backgroundColor;
      if (isActive) {
        scale = 1.05;
      }
      break;

    case 'karaoke':
      // Karaoke style - fill from left to right
      color = style.color;
      break;

    case 'none':
    default:
      // No animation
      break;
  }

  const wordStyle: React.CSSProperties = {
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    color: color,
    backgroundColor: backgroundColor,
    padding: '4px 8px',
    borderRadius: '8px',
    transform: `scale(${scale})`,
    opacity,
    transition: 'transform 0.1s ease-out',
    textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8)',
    display: 'inline-block',
  };

  // For karaoke effect, use a gradient mask
  if (style.animation === 'karaoke' && hasAppeared) {
    const fillPercent = isActive ? progress * 100 : (hasAppeared ? 100 : 0);
    wordStyle.background = `linear-gradient(90deg, ${style.activeColor} ${fillPercent}%, ${style.color} ${fillPercent}%)`;
    wordStyle.WebkitBackgroundClip = 'text';
    wordStyle.WebkitTextFillColor = 'transparent';
    wordStyle.backgroundClip = 'text';
  }

  return <span style={wordStyle}>{word.text}</span>;
};

export default AnimatedSubtitle;
